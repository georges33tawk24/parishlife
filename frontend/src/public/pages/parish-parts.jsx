/* Pieces the parish pages share: the facts drawn from a parish's published details, the smaller
   pages' heading, dates and times in Beirut, share and copy buttons, photographs. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { locate } from '../components/LebanonMap.jsx';
import { animateHome, stopHomeMotion } from '../motion.js';
import { Sanctuary } from '../components/Sanctuary.jsx';
import { kindName } from '../components/ParishCalendar.jsx';
import { useSite, Lines, Monogram, initialOf, dioceseName, digits } from '../site.jsx';
import { Glyph } from '../components/icons.jsx';
import { useHeroWatch } from '../components/Chrome.jsx';

/* Everything the page says about the parish, read once. */
export function facts(c, p, d) {
  const parish = d.parish || {},
    raw = d.visit || {},
    visit = { ...raw };
  for (const k of [
    'officeHours',
    'confessionTimes',
    'expect',
    'languages',
    'parking',
    'accessibility',
    'sacramentNotes',
    'feastName'
  ])
    visit[k] = c.pair(raw, k, k + 'Ar');
  const name = c.pair(parish, 'name', 'nameAr') || c.parishName(p);
  const other = c.lang === 'ar' ? parish.name || p.name : parish.nameAr || p.ar;
  const town = c.pair(parish, 'town', 'townAr') || c.townName(p);
  const rite = c.pair(parish, 'rite', 'riteAr'),
    diocese = dioceseName(c, p.diocese);
  const today = c.localToday();
  const events = (d.events || [])
    .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.d || ''))
    .sort((a, b) => (a.d + (a.t || '')).localeCompare(b.d + (b.t || '')));
  const upcoming = events.filter(e => e.d >= today);
  const photos = c.parishPhotos(d);
  const phone = String(parish.phone || '').replace(/[^\d+]/g, '');
  const address = c.pair(parish, 'address', 'addressAr');
  const at = locate(p, d);
  return {
    name,
    other: other && other !== name ? other : '',
    town,
    rite,
    diocese,
    today,
    events,
    upcoming,
    photos,
    phone,
    address,
    visit,
    at,
    open: d.publicRequests !== false,
    massTimes: c.content(d, 'massTimes').trim(),
    history: c.content(d, 'history').trim(),
    welcome: c.content(d, 'welcome').trim(),
    contact: c.content(d, 'contact').trim(),
    intro: c.content(d, 'sacraments').trim()
  };
}

export const loc = c => (c.lang === 'ar' ? 'ar-LB' : 'en-GB');

export const when = (c, e) => {
  const date = new Date(e.d + 'T12:00:00'),
    day = new Intl.DateTimeFormat(loc(c), { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  return e.t ? `${day}${c.L(', ', '، ')}${digits(c, e.t)}` : day;
};

export function relative(c, e) {
  const days = Math.round((new Date(e.d + 'T12:00:00') - new Date(c.localToday() + 'T12:00:00')) / 86400000);
  return days > 60
    ? ''
    : digits(c, new Intl.RelativeTimeFormat(c.lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' }).format(days, 'day'));
}

export const title = (c, e) => (c.lang === 'ar' ? e.titleAr || e.title : e.title || e.titleAr) || kindName(c.L, e.kind);

export const TIME = /^\d{2}:\d{2}$/;

export const abroad = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone !== 'Asia/Beirut';
  } catch {
    return false;
  }
};

export const evLink = (c, p, e) => (e?.id ? c.eventURL(p.id, e.id) : c.calendarURL(p.id));

export const directionsURL = (p, d, v) =>
  'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent(
    /^-?\d+(\.\d+)?$/.test(String(v.latitude || '').trim()) && /^-?\d+(\.\d+)?$/.test(String(v.longitude || '').trim())
      ? `${v.latitude},${v.longitude}`
      : [d.parish.name || p.name, d.parish.address, p.town, 'Lebanon'].filter(Boolean).join(' ')
  );

export const Thumb = ({ src, name }) => (
  <span className="arch-thumb">{src ? <img src={src} alt="" loading="lazy" /> : <Monogram name={name} />}</span>
);

/* Copying a link: the button says so for a moment. */
export function CopyButton({ url, className, children, label, ...rest }) {
  const { L } = useSite();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(() => setDone(false), 2200);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <button
      type="button"
      className={className + (done ? ' is-done' : '')}
      data-copy-link
      {...rest}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url || location.href);
          setDone(true);
        } catch {
          /* not allowed */
        }
      }}
    >
      {children}
      <span data-copy-label>{done ? L('Link copied', 'نُسخ الرابط') : label}</span>
    </button>
  );
}

/* Share a page: WhatsApp first (how Lebanon shares), copying the link, and the phone's own sheet. */
export function ShareRow({ url, text, label }) {
  const { L } = useSite(),
    wa = 'https://wa.me/?text=' + encodeURIComponent(text + '\n' + url);
  return (
    <div className="share-row" data-share data-url={url} data-text={text}>
      {label ? <span className="share-label">{label}</span> : null}
      <a className="share-btn is-wa" href={wa} target="_blank" rel="noopener">
        <Glyph name="whatsapp" />
        <span>WhatsApp</span>
      </a>
      <CopyButton className="share-btn" url={url} label={L('Copy link', 'انسخ الرابط')}>
        <Glyph name="link" />
      </CopyButton>
      <button
        type="button"
        className="share-btn"
        data-native-share
        hidden={!navigator.share}
        onClick={() => navigator.share({ title: text, url }).catch(() => {})}
      >
        <Glyph name="share" />
        <span>{L('More', 'المزيد')}</span>
      </button>
    </div>
  );
}

/* The page's motion and its header, from the page's root. */
export function usePage(root, hero) {
  useHeroWatch(hero);
  useLayoutEffect(() => {
    animateHome(root.current);
    return () => stopHomeMotion();
  }, []);
}

/* What to bring for a baptism, a wedding or a certificate, as the parish office writes it. */
export function Bring({ f, side = false }) {
  const { L } = useSite(),
    notes = String(f.visit.sacramentNotes || '').trim();
  if (!notes) return null;
  return (
    <div className={'ph-bring' + (side ? ' is-side' : '')} data-reveal={side ? undefined : ''}>
      <span className="ph-bring-mark" aria-hidden="true">
        <Glyph name="doc" />
      </span>
      <div>
        <h3>{L('Before you ask: what to bring', 'قبل أن تطلب: ما الذي تحضره')}</h3>
        <div className="ph-bring-text" dir="auto">
          <Lines text={notes} />
        </div>
      </div>
    </div>
  );
}

/* ---------- the parish's other pages: a request, the full calendar, an event ---------- */
/* The parish's window above its other pages: its light by the hour, without the candles. */
export function SubHero({ heroRef, crumbs, heading, lede, seed, initial }) {
  const { L } = useSite();
  return (
    <section className="sub-hero is-sanctuary" data-hero aria-labelledby="sub-title" ref={heroRef}>
      <div className="sub-art sub-sanctuary" aria-hidden="true">
        <Sanctuary seed={seed} initial={initial} />
      </div>
      <div className="site-wrap sub-inner">
        <nav className="ph-crumbs" aria-label={L('Breadcrumb', 'مسار التنقّل')} data-hero-rise>
          {crumbs.flatMap(([label, href], i) => [
            i ? (
              <span key={'/' + i} aria-hidden="true">
                /
              </span>
            ) : null,
            href ? (
              <a key={i} href={href}>
                {label}
              </a>
            ) : (
              <span key={i} aria-current="page">
                {label}
              </span>
            )
          ])}
        </nav>
        <h1 className="hero-title" id="sub-title">
          {heading}
        </h1>
        {lede ? <p data-hero-rise>{lede}</p> : null}
      </div>
    </section>
  );
}

export function ParishSub({ p, f, here, heading, lede, className = '', docTitle, children }) {
  const c = useSite(),
    { L } = c,
    root = useRef(null),
    hero = useRef(null);
  usePage(root, hero);
  return (
    <div
      className={'parish-sub' + (className ? ' ' + className : '')}
      data-parish-sub
      data-doc-title={docTitle}
      ref={root}
    >
      <SubHero
        heroRef={hero}
        seed={p.id}
        initial={initialOf(f.name)}
        heading={heading}
        lede={lede}
        crumbs={[[L('All parishes', 'كل الرعايا'), 'public.html#directory'], [f.name, c.profileURL(p.id)], [here]]}
      />
      {children}
    </div>
  );
}

/* Pages without a parish (For parishes, a page that could not be shown): the header and motion only. */
export function PlainPage({ className, heroRef, children }) {
  const root = useRef(null),
    fallback = useRef(null),
    hero = heroRef || fallback;
  useHeroWatch(hero);
  useLayoutEffect(() => {
    animateHome(root.current);
    return () => stopHomeMotion();
  }, []);
  return (
    <div className={className} data-plain-page ref={root}>
      {children}
    </div>
  );
}
