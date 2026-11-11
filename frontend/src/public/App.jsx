/* The public site: the homepage, each parish's pages, following a request, checking a signed
   document and the bundles for parishes. It reads only the server's published parish projection. */
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { applySiteTheme } from '../lib/theme.js';
import { trackView } from '../lib/beacon.js';
import { SiteContext, makeSite } from './site.jsx';
import { Header, Footer } from './components/Chrome.jsx';
import { Home } from './pages/Home.jsx';
import { ParishPage } from './pages/ParishPage.jsx';
import { RequestPage } from './pages/RequestPage.jsx';
import { CalendarPage } from './pages/CalendarPage.jsx';
import { EventPage } from './pages/EventPage.jsx';
import { TrackingPage } from './pages/TrackingPage.jsx';
import { VerifyPage } from './pages/VerifyPage.jsx';
import { BundlesPage } from './pages/BundlesPage.jsx';
import { LostPage } from './pages/LostPage.jsx';
import { loadDirectory, loadParish } from './api-data.js';

const params = new URLSearchParams(location.search);
const selected = params.get('parish');

export function setDocumentLanguage(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}
/* The visitor's language, remembered on this device; a shared link can carry its own (?lang=ar),
   so it opens as the sender saw it. */
export function startingLanguage() {
  let lang = 'en';
  try {
    if (localStorage.getItem('pl-lang') === 'ar') lang = 'ar';
  } catch {
    /* private mode */
  }
  if (['ar', 'en'].includes(params.get('lang'))) {
    lang = params.get('lang');
    try {
      localStorage.setItem('pl-lang', lang);
    } catch {
      /* private mode */
    }
  }
  return lang;
}

export function PublicApp({ initialLang }) {
  const [lang, setLang] = useState(initialLang);
  const [data, setData] = useState({
    loading: true,
    directory: [],
    details: new Map(),
    site: null,
    failed: [],
    loadFailure: false
  });
  const [filters, setFilters] = useState(() => ({
    diocese: '',
    rite: '',
    location: null,
    q: params.get('q') || '',
    town: params.get('town') || '',
    sort: params.get('sort') === 'town' ? 'town' : 'name'
  }));
  const [online, setOnline] = useState(navigator.onLine !== false);
  /* A private tracking link opened in a tab already on the site changes only the address's hash. */
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const follow = () => setHash(location.hash);
    addEventListener('hashchange', follow);
    return () => removeEventListener('hashchange', follow);
  }, []);
  const c = useMemo(
    () => makeSite({ lang, directory: data.directory, details: data.details, site: data.site, filters, setFilters }),
    [lang, data, filters]
  );
  const { L } = c;

  const load = useCallback(async () => {
    setData(d => ({ ...d, loading: true, loadFailure: false }));
    try {
      // The directory from ParishLife.Api, with each parish's website and calendar (public/api-data.js).
      // The homepage editor's content is not connected yet, so the page keeps its built-in wording.
      const { directory, details } = await loadDirectory(),
        siteContent = null,
        failed = [];
      // A parish's own page also needs its ministries.
      const chosen = selected && directory.find(p => p.id === selected);
      if (chosen) details.set(selected, await loadParish(chosen));
      if (filters.town && !directory.some(p => p.town === filters.town)) setFilters(f => ({ ...f, town: '' }));
      setData({ loading: false, directory, details, site: siteContent, failed, loadFailure: false });
    } catch (error) {
      /* 404: ParishLife.Api has no public parish directory yet, which is not the visitor's connection */
      setData(d => ({ ...d, loading: false, loadFailure: error?.status === 404 ? 'missing' : true }));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  /* Back online after a failure (or with an offline notice showing): load again. */
  useEffect(() => {
    const up = () => {
        setOnline(true);
        load();
      },
      down = () => setOnline(false);
    addEventListener('online', up);
    addEventListener('offline', down);
    return () => {
      removeEventListener('online', up);
      removeEventListener('offline', down);
    };
  }, [load]);
  /* A link to a section of the page (#directory) arrives there once the page is drawn. */
  useEffect(() => {
    if (!data.loading && location.hash && !location.hash.startsWith('#track='))
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' });
  }, [data.loading]);

  const toggleLanguage = () => {
    const next = lang === 'ar' ? 'en' : 'ar';
    try {
      localStorage.setItem('pl-lang', next);
    } catch {
      /* private mode */
    }
    setDocumentLanguage(next);
    setLang(next);
  };
  useLayoutEffect(() => {
    setDocumentLanguage(lang);
    applySiteTheme(null);
  }, [lang]);

  /* Which page this address asks for. */
  const p = data.directory.find(x => x.id === selected),
    d = data.details.get(selected);
  const token = hash.startsWith('#track=') ? hash.slice(7) : '';
  const verify = params.get('verify') ?? (params.get('view') === 'verify' ? '' : null);
  const retry = (
    <button className="btn btn-gilt retry-load" type="button" onClick={load}>
      {L('Try again', 'حاول مجدّدًا')}
    </button>
  );
  let page,
    view,
    parish = p ? p.id : '';
  if (verify !== null) {
    page = <VerifyPage code={verify} />;
    view = 'verify';
  } else if (token) {
    page = <TrackingPage key={token} token={token} />;
    view = 'track';
  } else if (data.loading && !data.directory.length) {
    page = (
      <div className="site-wrap loading" role="status">
        <span className="loading-line"></span>
        <p>{L('Loading parish information…', 'جارٍ تحميل معلومات الرعايا…')}</p>
      </div>
    );
  } else if (data.loadFailure) {
    page = (
      <LostPage
        title={L('We couldn’t load the directory', 'تعذّر تحميل الدليل')}
        body={
          data.loadFailure === 'missing'
            ? L(
                'The parish directory is not connected to the new backend yet.',
                'دليل الرعايا غير متّصل بالخادم الجديد بعد.'
              )
            : L('Please check your connection and try again.', 'يرجى التحقّق من الاتصال والمحاولة مجدّدًا.')
        }
        actions={retry}
      />
    );
    view = 'error';
  } else if (selected && (!p || !d)) {
    page = (
      <LostPage
        title={
          p
            ? L('This parish page is temporarily unavailable', 'صفحة الرعية غير متاحة حاليًا')
            : L('Parish not found', 'لم نعثر على الرعية')
        }
        body={
          p
            ? L(
                'Its details could not be loaded just now. Try again, or explore another parish.',
                'تعذّر تحميل تفاصيلها الآن. حاول مجدّدًا أو استكشف رعية أخرى.'
              )
            : L(
                'This link does not lead to a parish on ParishLife. It may have been mistyped, or the parish may have left.',
                'هذا الرابط لا يقود إلى رعية على ParishLife. ربما كُتب خطأً، أو لم تعد الرعية مسجّلة.'
              )
        }
        actions={
          <>
            {p ? retry : null}
            <a className={'btn ' + (p ? 'btn-ink-line' : 'btn-gilt')} href="public.html#directory">
              {L('Find a parish', 'ابحث عن رعية')}
            </a>
          </>
        }
      />
    );
    view = 'error';
  } else {
    view =
      params.get('view') === 'bundles'
        ? 'bundles'
        : !selected
          ? 'home'
          : params.has('request')
            ? d.publicRequests === false
              ? 'closed'
              : 'request'
            : params.get('view') === 'calendar'
              ? 'calendar'
              : params.has('event')
                ? 'event'
                : 'parish';
    page = {
      bundles: () => <BundlesPage />,
      home: () => <Home />,
      closed: () => (
        <LostPage
          title={L('Contact the parish office', 'تواصل مع مكتب الرعية')}
          body={
            <>
              {L(
                'This parish takes requests through its office rather than online.',
                'تستقبل هذه الرعية الطلبات عبر مكتبها لا عبر الإنترنت.'
              )}
              {d.parish.phone ? (
                <>
                  {' '}
                  <bdi>{d.parish.phone}</bdi>
                </>
              ) : null}
            </>
          }
          actions={
            <>
              {d.parish.phone ? (
                <a className="btn btn-gilt" href={`tel:${String(d.parish.phone).replace(/[^\d+]/g, '')}`}>
                  {L('Call the parish office', 'اتصل بمكتب الرعية')}
                </a>
              ) : null}
              <a className="btn btn-ink-line" href={`public.html?parish=${encodeURIComponent(p.id)}`}>
                {L('Parish page', 'صفحة الرعية')}
              </a>
            </>
          }
        />
      ),
      request: () => <RequestPage p={p} d={d} kind={params.get('request')} />,
      calendar: () => <CalendarPage p={p} d={d} />,
      event: () => <EventPage p={p} d={d} id={params.get('event')} />,
      parish: () => <ParishPage p={p} d={d} />
    }[view]();
    if (view === 'closed') view = 'request';
  }
  const ready = !!view,
    normal = ready && !['verify', 'track', 'error'].includes(view);

  /* Each page counts once as a visit; the title follows the page. */
  useEffect(() => {
    if (view) trackView(view, view === 'verify' || view === 'track' ? '' : parish);
  }, [view, parish]);
  useEffect(() => {
    if (!ready) return;
    if (view === 'verify') document.title = L('Check a signed document', 'التحقّق من وثيقة موقّعة') + ' · ParishLife';
    else if (view !== 'track')
      document.title =
        document.querySelector('[data-doc-title]')?.dataset.docTitle ||
        (selected && p ? c.parishName(p) : L('Find your parish', 'ابحث عن رعيتك')) + ' · ParishLife';
    document.body.classList.toggle('is-home', view === 'home');
    requestAnimationFrame(() => document.body.classList.add('is-ready'));
  });

  /* While the first data loads, the splash covers the screen: a header and footer drawn now would only
     jump when the page arrives, which counts as layout shift against the site. */
  if (data.loading && !data.directory.length && verify === null && !token)
    return (
      <p className="sr-only" role="status">
        {L('Loading parish information…', 'جارٍ تحميل معلومات الرعايا…')}
      </p>
    );

  /* The page is drawn afresh in the other language, as a new page. */
  return (
    <SiteContext.Provider value={c}>
      <a className="skip-link" href="#app">
        {L('Skip to content', 'انتقل إلى المحتوى')}
      </a>
      <Header L={L} lang={lang} onToggleLang={toggleLanguage} />
      <main id="app" tabIndex="-1" aria-busy={!ready}>
        {!online && normal ? (
          <div className="site-wrap load-notice" role="status">
            {L(
              'You are offline. This is what ParishLife showed on this device last time.',
              'أنت غير متصل بالإنترنت. هذا ما عرضه ParishLife على هذا الجهاز في المرة الأخيرة.'
            )}
          </div>
        ) : null}
        {data.failed.length && normal ? (
          <div className="site-wrap load-notice" role="status">
            {L('Some parish details could not be loaded. ', 'تعذّر تحميل بعض تفاصيل الرعايا. ')}
            <button className="text-button retry-load" onClick={load}>
              {L('Try again', 'حاول مجدّدًا')}
            </button>
          </div>
        ) : null}
        <Fragment key={lang}>{page}</Fragment>
      </main>
      <Footer L={L} lang={lang} onToggleLang={toggleLanguage} />
    </SiteContext.Provider>
  );
}
