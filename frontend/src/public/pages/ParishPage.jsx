/* A parish's public page: the hero (its photograph, or its church at night with a candle lit on
   the sill), then its story, Mass times, calendar, ministries and clergy, requests, news,
   photographs and the way there, with its neighbours on the map. A section the parish has not
   published stays out rather than fill the page with placeholders. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LebanonMap, locate, projection } from '../components/LebanonMap.jsx';
import { scrollToTarget } from '../motion.js';
import { Sanctuary } from '../components/Sanctuary.jsx';
import {
  ParishCalendar,
  kindName,
  icsHref,
  icsAllHref,
  icsName,
  beirutNow as beirut
} from '../components/ParishCalendar.jsx';
import { safeRichText } from '../../lib/rich-text.js';
import { useSite, Lines, Paragraphs, Monogram, initialOf, digits, noun, still } from '../site.jsx';
import { Icon, Glyph } from '../components/icons.jsx';
import {
  Bring,
  CopyButton,
  ShareRow,
  TIME,
  Thumb,
  abroad,
  directionsURL,
  evLink,
  facts,
  loc,
  relative,
  title,
  usePage,
  when
} from './parish-parts.jsx';

const KM = projection.ky / 111.2; // map units per kilometre, north to south

const term = (c, n, key) => noun(c, n, key);

/* "A Maronite parish in Hadath, Archeparchy of Beirut." Arabic adjectives agree with رعية. */
function plainLede(c, f) {
  if (c.lang === 'ar') {
    const adj = f.rite && /^\S+ي$/.test(f.rite) ? f.rite + 'ة' : '';
    return `رعية${adj ? ' ' + adj : ''}${f.town ? ' في ' + f.town : ''}${f.rite && !adj ? ` (${f.rite})` : ''}${f.diocese ? '، ' + f.diocese : ''}.`;
  }
  const a = f.rite ? (/^[aeiou]/i.test(f.rite) ? 'An ' : 'A ') + f.rite + ' parish' : 'A parish';
  return `${a}${f.town ? ' in ' + f.town : ''}${f.diocese ? ', ' + f.diocese : ''}.`;
}

const minutes = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);

const addDays = (key, n) => {
  const d = new Date(key + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};

function nextMass(f) {
  const now = beirut();
  return (
    f.upcoming.find(
      e => e.kind === 'mass' && (e.d > now.d || (e.d === now.d && (!TIME.test(e.t || '') || e.t >= now.t)))
    ) || null
  );
}

/* "Today at 18:00" and "in 2 hours"; "Tomorrow at 08:00"; "Sunday 2 November at 10:30". */
function massWhen(c, e) {
  const { L } = c,
    now = beirut(),
    at = TIME.test(e.t || '') ? digits(c, e.t) : '';
  const day =
    e.d === now.d
      ? L('Today', 'اليوم')
      : e.d === addDays(now.d, 1)
        ? L('Tomorrow', 'غداً')
        : new Intl.DateTimeFormat(loc(c), { weekday: 'long', day: 'numeric', month: 'long' }).format(
            new Date(e.d + 'T12:00:00')
          );
  let soon = '';
  if (e.d === now.d && at) {
    const left = minutes(e.t) - minutes(now.t),
      rtf = new Intl.RelativeTimeFormat(c.lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
    soon =
      left < 1
        ? L('starting now', 'يبدأ الآن')
        : left < 60
          ? rtf.format(left, 'minute')
          : rtf.format(Math.round(left / 60), 'hour');
  }
  return { when: at ? L(`${day} at ${at}`, `${day} الساعة ${at}`) : day, soon: soon && digits(c, soon) };
}

/* The parish's feast: its name, the next date it falls on, and how far away that is. */
function feast(c, f) {
  const md = String(f.visit.feastDate || '');
  if (!/^\d{2}-\d{2}$/.test(md)) return null;
  const today = beirut().d,
    year = +today.slice(0, 4),
    date = `${year}-${md}` >= today ? `${year}-${md}` : `${year + 1}-${md}`;
  return {
    name: String(f.visit.feastName || '').trim() || c.L('The parish feast', 'عيد الرعية'),
    date,
    days: Math.round((new Date(date + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000),
    day: new Intl.DateTimeFormat(loc(c), { day: 'numeric', month: 'long' }).format(new Date(date + 'T12:00:00'))
  };
}

const https = value => (/^https:\/\/[^\s]+$/.test(String(value || '').trim()) ? String(value).trim() : '');

export function ParishPage({ p, d }) {
  const c = useSite(),
    f = facts(c, p, d),
    { L } = c;
  const root = useRef(null),
    hero = useRef(null);
  const [photo, setPhoto] = useState(-1);
  usePage(root, hero);
  const sections = [
    ['about', L('About', 'عن الرعية'), <About key="about" p={p} f={f} />],
    ['times', L('Mass times', 'القداديس'), hasTimes(f) && <Times key="times" f={f} />],
    ['calendar', L('Events', 'المناسبات'), <Calendar key="calendar" p={p} d={d} f={f} />],
    [
      'ministries',
      L('Ministries', 'الخدمات'),
      (d.ministries || []).length || (d.clergy || []).length ? <Ministries key="ministries" p={p} d={d} /> : null
    ],
    ['sacraments', L('Requests', 'الطلبات'), f.open && <Requests key="sacraments" p={p} f={f} />],
    ['updates', L('News', 'الأخبار'), (d.posts || []).some(x => x.title || x.body) && <News key="updates" d={d} />],
    ['gallery', L('Photos', 'الصور'), f.photos.length >= 2 && <Gallery key="gallery" f={f} onOpen={setPhoto} />],
    ['contact', L('Visit', 'الزيارة'), <Visit key="contact" p={p} d={d} f={f} />]
  ].filter(s => s[2]);
  const jump = (e, href, target) => {
    if (!target) return;
    e.preventDefault();
    scrollToTarget(target, 130);
    history.replaceState(null, '', href);
  };
  return (
    <div
      className="parish"
      data-parish-page
      ref={root}
      onClick={e => {
        const a = e.target.closest('[data-ph-jump], [data-ph-top]');
        if (a)
          jump(
            e,
            a.getAttribute('href'),
            a.hasAttribute('data-ph-top')
              ? root.current.querySelector('#top')
              : root.current.querySelector(a.getAttribute('href'))
          );
      }}
    >
      <Hero heroRef={hero} p={p} d={d} f={f} />
      <SectionBar root={root} name={f.name} sections={sections} />
      {sections.map(s => s[2])}
      <Nearby p={p} f={f} />
      <Lightbox photos={f.photos} at={photo} onClose={() => setPhoto(-1)} onStep={setPhoto} />
    </div>
  );
}

/* ---------- hero ---------- */
function Hero({ heroRef, p, d, f }) {
  const c = useSite(),
    { L } = c,
    mass = nextMass(f),
    next = f.upcoming.find(e => e !== mass),
    month = f.upcoming.filter(e => e.d < addDays(f.today, 31)).length;
  const fe = feast(c, f),
    live = https(f.visit.livestream),
    massTime = mass && massWhen(c, mass);
  const [tip, setTip] = useState(null);
  const candles = useMemo(() => [{ id: p.id, name: f.name, town: f.town }], [p.id, f.name, f.town]);
  const stat = (n, key) =>
    n ? (
      <li key={key}>
        <b data-count={n}>{c.number(n)}</b>
        <span>{term(c, n, key)}</span>
      </li>
    ) : null;
  const stats = [
    stat(month, 'upcoming'),
    stat((d.ministries || []).length, 'ministry'),
    stat((d.posts || []).length, 'post')
  ].filter(Boolean);
  /* Without a photograph, the parish's own church at night: its initial in the glass, its name
     gilded on the sill, and its candle among the others (Sanctuary.jsx). */
  return (
    <section
      className={'hero ph' + (f.photos[0] ? '' : ' hero-sanctuary')}
      id="top"
      data-hero
      data-photo={f.photos[0] ? '' : undefined}
      aria-labelledby="ph-title"
      ref={heroRef}
    >
      <div className="hero-art" data-scene>
        {f.photos[0] ? (
          <div className="ph-photo">
            <img src={f.photos[0]} alt="" decoding="async" fetchPriority="high" />
          </div>
        ) : (
          <Sanctuary
            inscription={f.name}
            seed={p.id}
            initial={initialOf(f.name)}
            places={candles}
            onTip={setTip}
            words={{
              light: L('Light a candle', 'أضئ شمعة'),
              lit: L('A candle lit for your intention', 'شمعة مضاءة على نيّتك')
            }}
            onPick={() => scrollToTarget(document.querySelector('[data-parish-page] #contact'))}
          />
        )}
      </div>
      <div className="hero-shade" aria-hidden="true"></div>
      <div className="site-wrap hero-inner ph-inner">
        <nav className="ph-crumbs" aria-label={L('Breadcrumb', 'مسار التنقّل')} data-hero-rise>
          <a href="public.html#directory">{L('All parishes', 'كل الرعايا')}</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{f.name}</span>
        </nav>
        {f.town || f.rite ? (
          <p className="ph-meta" data-hero-rise>
            <Glyph name="pin" />
            <span>{[f.town, f.rite].filter(Boolean).join(' · ')}</span>
          </p>
        ) : null}
        {fe && fe.days <= 40 ? (
          <p className="ph-feast" data-hero-rise>
            <Glyph name="star" />
            <span>
              {fe.days === 0 ? (
                <>
                  {L('Today: ', 'اليوم: ')}
                  <bdi>{fe.name}</bdi>
                </>
              ) : (
                <>
                  <bdi>{fe.name}</bdi> · {digits(c, fe.day)} ·{' '}
                  {digits(
                    c,
                    new Intl.RelativeTimeFormat(c.lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' }).format(
                      fe.days,
                      'day'
                    )
                  )}
                </>
              )}
            </span>
          </p>
        ) : null}
        <h1 className="hero-title ph-title" id="ph-title">
          {f.name}
        </h1>
        {f.other ? (
          <p
            className="ph-other"
            lang={c.lang === 'ar' ? 'en' : 'ar'}
            dir={c.lang === 'ar' ? 'ltr' : 'rtl'}
            data-hero-rise
          >
            {f.other}
          </p>
        ) : null}
        <p className="hero-lede" data-hero-rise dir="auto">
          {f.welcome ? <Lines text={f.welcome} /> : plainLede(c, f)}
        </p>
        {mass ? (
          <a className="ph-mass" href={evLink(c, p, mass)} data-hero-rise>
            <span className="lamp" aria-hidden="true"></span>
            <span className="ph-mass-label">{L('Next Mass', 'القداس التالي')}</span>
            <b>{massTime.when}</b>
            {massTime.soon ? <span className="ph-mass-in">{massTime.soon}</span> : null}
            {abroad() && TIME.test(mass.t || '') ? <small>{L('Beirut time', 'بتوقيت بيروت')}</small> : null}
          </a>
        ) : null}
        <div className="ph-actions" data-hero-rise>
          {f.open ? (
            <a className="btn btn-gilt" href="#sacraments" data-ph-jump>
              {L('Ask the parish office', 'اطلب من مكتب الرعية')}
            </a>
          ) : null}
          <a className="btn btn-line" href="#calendar" data-ph-jump>
            <Glyph name="cal" />
            {L('Events and calendar', 'المناسبات والرزنامة')}
          </a>
          {live ? (
            <a className="btn btn-line" href={live} target="_blank" rel="noopener" data-track="livestream">
              <Glyph name="play" />
              {L('Watch Mass live', 'شاهد القداس مباشرة')}
            </a>
          ) : null}
          {f.phone ? (
            <a className="btn btn-line" href={`tel:${f.phone}`}>
              <Glyph name="phone" />
              <bdi>{d.parish.phone}</bdi>
            </a>
          ) : null}
        </div>
        {stats.length ? (
          <ul className="hero-facts ph-facts" data-hero-rise>
            {stats}
          </ul>
        ) : null}
        <div data-hero-rise>
          <ShareRow
            url={c.shareURL(c.profileURL(p.id))}
            text={L(
              `${f.name}${f.town ? ', ' + f.town : ''} on ParishLife`,
              `رعية ${f.name}${f.town ? '، ' + f.town : ''} على ParishLife`
            )}
            label={L('Share', 'شارك')}
          />
        </div>
      </div>
      {next ? (
        <a className="ph-next" href={evLink(c, p, next)}>
          <span className="ph-next-label">
            <span className="lamp" aria-hidden="true"></span>
            {L('Next at the parish', 'القادم في الرعية')}
          </span>
          <strong dir="auto">{title(c, next)}</strong>
          <time dateTime={next.d + (next.t ? 'T' + next.t : '')}>{when(c, next)}</time>
          {relative(c, next) ? <span className="ph-next-in">{relative(c, next)}</span> : null}
        </a>
      ) : null}
      <p
        className="hero-tip"
        data-hero-tip
        role="status"
        hidden={!tip}
        style={tip ? { left: tip.left + 'px', top: tip.top + 'px' } : undefined}
      >
        {tip?.text}
      </p>
    </section>
  );
}

/* The section bar follows the reader; its gold ink slides under the section in view. */
function SectionBar({ root, name, sections }) {
  const { L } = useSite();
  const nav = useRef(null),
    list = useRef(null),
    ink = useRef(null);
  const [current, setCurrent] = useState(null);
  const place = id => {
    const link = id && nav.current.querySelector(`[data-ph-link="${id}"]`);
    if (!link) {
      ink.current.style.opacity = '0';
      return;
    }
    const r = link.getBoundingClientRect(),
      base = nav.current.querySelector('.ph-nav-inner').getBoundingClientRect();
    ink.current.style.opacity = '1';
    ink.current.style.width = r.width + 'px';
    ink.current.style.transform = `translateX(${r.left - base.left}px)`;
  };
  useEffect(() => {
    const ids = sections.map(s => s[0]);
    const pick = () => {
      const line = innerHeight * 0.35;
      let best = null;
      for (const id of ids) {
        const s = root.current.querySelector('#' + id);
        if (s && s.getBoundingClientRect().top <= line) best = id;
      }
      nav.current.classList.toggle(
        'is-stuck',
        nav.current.getBoundingClientRect().top <= parseFloat(getComputedStyle(nav.current).top) + 1
      );
      setCurrent(best);
    };
    addEventListener('scroll', pick, { passive: true });
    addEventListener('resize', pick);
    const frame = requestAnimationFrame(pick);
    return () => {
      removeEventListener('scroll', pick);
      removeEventListener('resize', pick);
      cancelAnimationFrame(frame);
    };
  }, []);
  useLayoutEffect(() => {
    place(current);
    const link = current && nav.current.querySelector(`[data-ph-link="${current}"]`);
    if (!link) return;
    const r = link.getBoundingClientRect(),
      lr = list.current.getBoundingClientRect();
    if (r.left < lr.left || r.right > lr.right)
      list.current.scrollTo({ left: list.current.scrollLeft + (r.left - lr.left) - 24, behavior: 'smooth' });
  }, [current]);
  return (
    <nav className="ph-nav" data-ph-nav aria-label={L('On this page', 'في هذه الصفحة')} ref={nav}>
      <div className="site-wrap ph-nav-inner">
        <a className="ph-nav-name" href="#top" data-ph-top>
          <Monogram name={name} />
          <span>{name}</span>
        </a>
        <ul ref={list} onScroll={() => place(current)}>
          {sections.map(([id, label]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                data-ph-link={id}
                aria-current={current === id ? 'true' : undefined}
                onClick={e => {
                  const target = root.current.querySelector('#' + id);
                  if (!target) return;
                  e.preventDefault();
                  e.stopPropagation();
                  scrollToTarget(target, 130);
                  history.replaceState(null, '', '#' + id);
                }}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
        <span className="ph-nav-ink" aria-hidden="true" ref={ink}></span>
      </div>
    </nav>
  );
}

/* ---------- about ---------- */
function About({ p, f }) {
  const c = useSite(),
    { L } = c,
    art = f.photos[1] || f.photos[0],
    fe = feast(c, f);
  const rows = [
    [L('Town', 'البلدة'), f.town],
    [L('Rite', 'الطقس'), f.rite],
    [L('Diocese', 'الأبرشية'), f.diocese],
    [
      L('Feast day', 'عيد الرعية'),
      fe && `${String(f.visit.feastName || '').trim() ? fe.name + ' · ' : ''}${digits(c, fe.day)}`
    ]
  ].filter(r => r[1]);
  return (
    <section className="ph-about" id="about" aria-labelledby="about-title">
      <div className="site-wrap ph-about-grid">
        <figure className={'ph-arch' + (art ? '' : ' is-night')} data-reveal>
          {art ? (
            <img src={art} alt={f.name} loading="lazy" decoding="async" data-parallax="-6" />
          ) : (
            <>
              <Monogram name={f.name} />
              <span className="ph-arch-light" aria-hidden="true"></span>
            </>
          )}
        </figure>
        <div className="ph-about-copy">
          <h2 id="about-title">{L(`About ${f.name}`, `عن رعية ${f.name}`)}</h2>
          {f.history ? (
            <div dir="auto">
              <Paragraphs text={f.history} />
            </div>
          ) : (
            <p className="ph-quiet">
              {L(
                'The parish office has not published the parish’s story yet. Its Mass times, news and calendar appear here as soon as they are shared.',
                'لم ينشر مكتب الرعية حكايتها بعد. تظهر هنا مواعيد القداديس والأخبار والرزنامة فور نشرها.'
              )}
            </p>
          )}
          {rows.length ? (
            <dl className="ph-dl" data-reveal>
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ---------- Mass times ---------- */
const VISIT_ROWS = [
  ['confessionTimes', ['Confession', 'الاعتراف'], 'cross'],
  ['officeHours', ['Parish office', 'مكتب الرعية'], 'door']
];

const hasTimes = f =>
  f.massTimes ||
  f.upcoming.some(e => e.kind === 'mass' && e.d < addDays(f.today, 7)) ||
  VISIT_ROWS.some(([k]) => String(f.visit[k] || '').trim()) ||
  https(f.visit.livestream);

function Times({ f }) {
  const c = useSite(),
    { L } = c,
    masses = f.upcoming.filter(e => e.kind === 'mass' && e.d < addDays(f.today, 7));
  const visitRows = VISIT_ROWS.filter(([k]) => String(f.visit[k] || '').trim()),
    live = https(f.visit.livestream);
  return (
    <section className="ph-times" id="times" aria-labelledby="times-title">
      <div className="site-wrap ph-times-grid">
        <header className="sec-head" data-reveal>
          <h2 id="times-title">{L('Mass times', 'مواعيد القداديس')}</h2>
          <p>
            {L(
              'As the parish office publishes them. On feast days, the calendar shows any change.',
              'كما ينشرها مكتب الرعية. في الأعياد تظهر أي تغييرات في الرزنامة.'
            )}
          </p>
        </header>
        <div className="ph-times-body">
          {f.massTimes ? (
            <div className="ph-board" data-reveal>
              <span className="ph-board-mark" aria-hidden="true">
                <Glyph name="cross" />
              </span>
              <div className="ph-board-text" dir="auto">
                <Lines text={f.massTimes} />
              </div>
            </div>
          ) : null}
          {masses.length ? (
            <div className="ph-week-masses" data-reveal>
              <h3>{L('Masses in the next seven days', 'القداديس في الأيام السبعة المقبلة')}</h3>
              <ul>
                {masses.map((e, i) => (
                  <li key={(e.id || i) + e.d} data-reveal-item>
                    <time>
                      {new Intl.DateTimeFormat(loc(c), { weekday: 'short', day: 'numeric' }).format(
                        new Date(e.d + 'T12:00:00')
                      )}
                    </time>
                    <b>{digits(c, e.t || '')}</b>
                    <span dir="auto">{title(c, e)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {visitRows.length || live ? (
            <dl className="ph-hours" data-reveal>
              {visitRows.map(([k, label, icon]) => (
                <div key={k}>
                  <Glyph name={icon} />
                  <dt>{L(...label)}</dt>
                  <dd dir="auto">
                    <Lines text={f.visit[k]} />
                  </dd>
                </div>
              ))}
              {live ? (
                <div>
                  <Glyph name="play" />
                  <dt>{L('Livestream', 'البث المباشر')}</dt>
                  <dd>
                    <a href={live} target="_blank" rel="noopener" data-track="livestream">
                      {L('Watch the parish’s Masses online', 'شاهد قداديس الرعية عبر الإنترنت')}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ---------- calendar ---------- */
/* Every parish has its events and calendar: the next celebrations as cards, all of them in one
   calendar file, and the month. Before anything is published, the calendar is there and says so. */
function Calendar({ p, d, f }) {
  const c = useSite(),
    { L } = c,
    next = f.upcoming.slice(0, 4),
    locale = loc(c);
  const place = [f.name, f.town].filter(Boolean).join(L(', ', '، '));
  return (
    <section className="ph-cal" id="calendar" aria-labelledby="cal-title">
      <div className="site-wrap">
        <header className="sec-head" data-reveal>
          <h2 id="cal-title">{L('Events and calendar', 'المناسبات والرزنامة')}</h2>
          <p>
            {L(
              'Masses, celebrations and gatherings the parish has published. Save any of them to your own calendar.',
              'القداديس والاحتفالات واللقاءات التي نشرتها الرعية. احفظ أيّاً منها في رزنامتك.'
            )}
          </p>
        </header>
        {next.length ? (
          <div className="ph-up" data-reveal>
            <div className="ph-up-head">
              <h3>{L('Coming up', 'القادم')}</h3>
              <a
                className="btn btn-ink-line btn-small"
                href={icsAllHref(
                  f.upcoming,
                  e => title(c, e),
                  place,
                  e => (e.id ? c.shareURL(c.eventURL(p.id, e.id)) : '')
                )}
                download={icsName(f.name)}
              >
                <Glyph name="add" />
                {L('Add all to my calendar', 'أضف الكل إلى رزنامتي')}
              </a>
            </div>
            <ul className="wk-list">
              {next.map((e, i) => {
                const t = title(c, e),
                  date = new Date(e.d + 'T12:00:00');
                return (
                  <li key={(e.id || i) + e.d} className={`wk-ev k-${e.kind || 'event'}`} data-reveal-item>
                    <a className="wk-ev-link" href={evLink(c, p, e)}>
                      <span className="wk-date" aria-hidden="true">
                        <small>{new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)}</small>
                        <b>{digits(c, date.getDate())}</b>
                        <small>{new Intl.DateTimeFormat(locale, { month: 'short' }).format(date)}</small>
                      </span>
                      <span className="wk-body">
                        <span className="wk-meta">
                          {e.t ? <time>{digits(c, e.t)}</time> : null}
                          <span className="wk-kind">{kindName(L, e.kind)}</span>
                          {relative(c, e) ? <span className="wk-in">{relative(c, e)}</span> : null}
                        </span>
                        <strong dir="auto">{t}</strong>
                        <span className="sr-only">{when(c, e)}</span>
                      </span>
                    </a>
                    <a
                      className="wk-add"
                      href={icsHref(e, t, place, e.id ? c.shareURL(c.eventURL(p.id, e.id)) : '')}
                      download={icsName(t)}
                      aria-label={L(`Add ${t} to my calendar`, `أضف «${t}» إلى رزنامتي`)}
                      title={L('Add to my calendar', 'أضف إلى رزنامتي')}
                    >
                      <Glyph name="add" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="ph-cal-empty" data-reveal>
            <span className="lamp is-unlit" aria-hidden="true"></span>
            <p>
              {f.events.length
                ? L(
                    'Nothing is coming up in the parish calendar yet. Past events are still in the calendar below.',
                    'لا شيء قادم في رزنامة الرعية بعد. ما زالت الأحداث السابقة في الرزنامة أدناه.'
                  )
                : L(
                    'The parish has not published any events yet. Masses, feasts and gatherings appear here as soon as the parish office adds them to its calendar.',
                    'لم تنشر الرعية أي مناسبات بعد. تظهر القداديس والأعياد واللقاءات هنا فور إضافتها إلى رزنامة مكتب الرعية.'
                  )}
            </p>
          </div>
        )}
        <div className="ph-cal-month" data-reveal>
          <ParishCalendar
            L={L}
            lang={c.lang}
            events={d.events || []}
            place={[f.name, f.town].filter(Boolean).join(', ')}
            link={e => c.eventURL(p.id, e.id)}
          />
        </div>
        <Follow p={p} f={f} />
        <p className="ph-cal-more">
          <a className="text-button" href={c.calendarURL(p.id)}>
            {L('Open the calendar on its own page', 'افتح الرزنامة في صفحة مستقلّة')}
          </a>
        </p>
      </div>
    </section>
  );
}

/* Follow the parish: its calendar in the visitor's own (kept up to date), its WhatsApp channel,
   and following it from a ParishLife account. */
function Follow({ p, f }) {
  const c = useSite(),
    { L } = c,
    webcal = c.feedURL(p.id, 'webcal:'),
    feed = c.feedURL(p.id),
    whatsapp = https(f.visit.whatsapp);
  if (!feed) return null; // no public calendar feed to subscribe to yet
  return (
    <div className="ph-follow" data-reveal>
      <span className="ph-follow-mark" aria-hidden="true">
        <Glyph name="bell" />
      </span>
      <div className="ph-follow-copy">
        <h3>{L('Never miss a celebration', 'لا تفوّت أيّ احتفال')}</h3>
        <p>
          {L(
            `Subscribe once and every Mass and event ${f.name} publishes appears in your phone’s calendar, and stays up to date.`,
            `اشترك مرّة واحدة فتظهر كلّ القداديس والمناسبات التي تنشرها رعية ${f.name} في رزنامة هاتفك، وتبقى محدّثة.`
          )}
        </p>
      </div>
      <div className="ph-follow-actions">
        <a className="btn btn-gilt btn-small" href={webcal}>
          <Glyph name="cal" />
          {L('Subscribe in my calendar', 'اشترك في رزنامتي')}
        </a>
        <a
          className="btn btn-ink-line btn-small"
          href={'https://calendar.google.com/calendar/render?cid=' + encodeURIComponent(feed)}
          target="_blank"
          rel="noopener"
        >
          <Glyph name="google" />
          {L('Google Calendar', 'رزنامة Google')}
        </a>
        {whatsapp ? (
          <a
            className="btn btn-ink-line btn-small is-wa"
            href={whatsapp}
            target="_blank"
            rel="noopener"
            data-track="whatsapp-follow"
          >
            <Glyph name="whatsapp" />
            {L('Follow on WhatsApp', 'تابع عبر واتساب')}
          </a>
        ) : null}
      </div>
      <p className="ph-follow-more">
        {L('Another calendar app?', 'تطبيق رزنامة آخر؟')}{' '}
        <CopyButton
          className="text-button"
          url={feed}
          data-url={feed}
          label={L('Copy the calendar address', 'انسخ عنوان الرزنامة')}
        />
        {' · '}
        <a className="text-button" href={'index.html?parish=' + encodeURIComponent(p.id) + '#/account'}>
          {L('Follow in your ParishLife account', 'تابع الرعية من حسابك على ParishLife')}
        </a>
      </p>
    </div>
  );
}

/* ---------- ministries and clergy ---------- */
function Ministries({ p, d }) {
  const c = useSite(),
    { L } = c,
    list = d.ministries || [],
    clergy = d.clergy || [];
  const ask = g => c.requestURL(p.id, 'ministry') + '&ministry=' + encodeURIComponent(g.name);
  return (
    <section className="ph-min" id="ministries" aria-labelledby="min-title">
      <div className="site-wrap">
        <header className="sec-head" data-reveal>
          <h2 id="min-title">{list.length ? L('Ministries', 'الخدمات') : L('Clergy', 'الإكليروس')}</h2>
          <p>
            {list.length
              ? L(
                  'The groups that keep the parish alive. Each one welcomes new members; ask the parish office about joining.',
                  'الجماعات التي تُحيي الرعية. كلّ منها يرحّب بأعضاء جدد؛ استفسر من مكتب الرعية عن الانضمام.'
                )
              : L('Contact the clergy through the parish office.', 'تواصل مع الكهنة عبر مكتب الرعية.')}
          </p>
        </header>
        {clergy.length ? (
          <ul className="ph-clergy">
            {clergy.map((m, i) => (
              <li key={i} data-reveal-item>
                <span className="arch-thumb">
                  <Monogram name={m.name} />
                </span>
                <span>
                  <b>{m.name}</b>
                  <small>{m.title || ''}</small>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {list.length ? (
          <ul className="ph-cards">
            {list.map((g, i) => {
              const name = c.lang === 'ar' ? g.nameAr || g.name : g.name || g.nameAr;
              return (
                <li key={i} data-reveal-item>
                  <article className="ph-card" data-tilt>
                    <span className="ph-card-arch">
                      <Monogram name={name} />
                    </span>
                    <h3 dir="auto">{name}</h3>
                    {g.description ? <p dir="auto">{g.description}</p> : null}
                    {g.responsible ? (
                      <p className="ph-led">
                        {L('Led by', 'بإشراف')} <b>{g.responsible}</b>
                      </p>
                    ) : null}
                    <a className="ph-card-link" href={ask(g)}>
                      {L('Ask about joining', 'استفسر عن الانضمام')}
                      <Glyph name="arrow" />
                      <span className="sr-only">: {name}</span>
                    </a>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- requests ---------- */
function Requests({ p, f }) {
  const c = useSite(),
    { L } = c;
  return (
    <section className="ask ph-ask" id="sacraments" aria-labelledby="ask-title">
      <div className="site-wrap">
        <header className="sec-head" data-reveal>
          <h2 id="ask-title">{L(`Ask ${f.name}`, `اطلب من رعية ${f.name}`)}</h2>
          <p dir="auto">
            {f.intro ? (
              <Lines text={f.intro} />
            ) : (
              L(
                'Baptisms, weddings, certificates and more. Send your request straight to the parish office without an account, and follow it with a private link.',
                'معموديات وأكاليل وشهادات وغيرها. أرسل طلبك مباشرة إلى مكتب الرعية من دون حساب، وتابعه برابط خاص.'
              )
            )}
          </p>
        </header>
        <Bring f={f} />
        <ul className="arcade">
          {c.REQUESTS.map(([kind, art, t, sub]) => (
            <li key={kind} data-reveal-item>
              <a className="arch" href={c.requestURL(p.id, kind)} data-tilt>
                <span className="arch-icon">
                  <Icon name={art} />
                </span>
                <strong>{L(...t)}</strong>
                <small>{L(...sub)}</small>
              </a>
            </li>
          ))}
        </ul>
        <div className="ask-more">
          {c.OTHER_REQUESTS.map(([kind, art, t, sub]) => (
            <a key={kind} className="ask-wide" href={c.requestURL(p.id, kind)} data-reveal-item>
              <span className="arch-icon">
                <Icon name={art} />
              </span>
              <span>
                <strong>{L(...t)}</strong>
                <small>{L(...sub)}</small>
              </span>
              <Glyph name="arrow" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- news ---------- */
function News({ d }) {
  const c = useSite(),
    { L } = c,
    posts = (d.posts || []).filter(x => x.title || x.body).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  /* a post written in the editor keeps its formatting, made safe; plain text keeps its lines */
  const body = text =>
    /<[a-z][\s\S]*>/i.test(text || '') ? (
      <div className="published-body" dir="auto" dangerouslySetInnerHTML={{ __html: safeRichText(text) }} />
    ) : (
      <div className="published-body" dir="auto">
        <Lines text={text || ''} />
      </div>
    );
  return (
    <section className="news ph-news" id="updates" aria-labelledby="news-title">
      <div className="site-wrap">
        <header className="sec-head" data-reveal>
          <h2 id="news-title">{L('From the parish', 'من الرعية')}</h2>
          <p>{L('Announcements published by the parish office.', 'إعلانات ينشرها مكتب الرعية.')}</p>
        </header>
        <div className="news-list">
          {posts.map((post, i) => (
            <article key={post.id || i} className={'news-item' + (i === 0 ? ' is-lead' : '')} data-reveal-item>
              {c.publishedDate(post.at) ? <time dateTime={post.at}>{c.publishedDate(post.at)}</time> : null}
              {post.title ? <h3 dir="auto">{post.title}</h3> : null}
              {body(post.body)}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- photographs ---------- */
function Gallery({ f, onOpen }) {
  const { L } = useSite();
  return (
    <section className="ph-gallery" id="gallery" aria-labelledby="gal-title">
      <div className="site-wrap">
        <header className="sec-head" data-reveal>
          <h2 id="gal-title">{L('Photographs', 'صور الرعية')}</h2>
          <p>{L('Published by the parish office.', 'ينشرها مكتب الرعية.')}</p>
        </header>
        <ul className="ph-photos">
          {f.photos.map((src, i) => (
            <li key={i} data-reveal-item>
              <button
                type="button"
                className="ph-photo-btn"
                data-lb-open={i}
                aria-label={L(`Open photograph ${i + 1}`, `افتح الصورة ${i + 1}`)}
                onClick={() => onOpen(i)}
              >
                <img src={src} alt="" loading="lazy" decoding="async" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Lightbox({ photos, at, onClose, onStep }) {
  const c = useSite(),
    { L } = c,
    dialog = useRef(null);
  useEffect(() => {
    const box = dialog.current;
    if (!box || typeof box.showModal !== 'function') return;
    if (at >= 0 && !box.open) box.showModal();
    if (at < 0 && box.open) box.close();
  }, [at]);
  const show = i => onStep((i + photos.length) % photos.length);
  const i = Math.max(0, at);
  return (
    <dialog
      className="ph-lightbox"
      data-lightbox
      aria-label={L('Photographs', 'الصور')}
      ref={dialog}
      onClose={onClose}
      onClick={e => {
        if (e.target === dialog.current) dialog.current.close();
      }}
      onKeyDown={e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft')
          show(i + ((e.key === 'ArrowRight') === (c.lang !== 'ar') ? 1 : -1));
      }}
    >
      <figure>
        <img alt="" src={at >= 0 ? photos[i] : undefined} />
        <figcaption>
          {at >= 0 ? L(`${i + 1} of ${photos.length}`, `${c.number(i + 1)} من ${c.number(photos.length)}`) : ''}
        </figcaption>
      </figure>
      <button
        type="button"
        className="icon-button lb-close"
        data-lb-close
        aria-label={L('Close', 'إغلاق')}
        onClick={() => dialog.current.close()}
      >
        <Glyph name="close" />
      </button>
      <button
        type="button"
        className="icon-button lb-prev"
        data-lb-step="-1"
        aria-label={L('Previous photograph', 'الصورة السابقة')}
        onClick={() => show(i - (c.lang === 'ar' ? -1 : 1))}
      >
        <Glyph name="prev" />
      </button>
      <button
        type="button"
        className="icon-button lb-next"
        data-lb-step="1"
        aria-label={L('Next photograph', 'الصورة التالية')}
        onClick={() => show(i + (c.lang === 'ar' ? -1 : 1))}
      >
        <Glyph name="next" />
      </button>
    </dialog>
  );
}

/* ---------- visit ---------- */
function Visit({ p, d, f }) {
  const c = useSite(),
    { L } = c,
    v = f.visit,
    directions = directionsURL(p, d, v),
    mapBox = useRef(null);
  const website = /^https:\/\/[^\s]+$/.test(v.website || '') ? v.website : '';
  const email = /^[^\s@]+@[^\s@]+$/.test(v.email || '') ? v.email : '';
  const rows = [
    f.address && ['pin', L('Address', 'العنوان'), f.address],
    f.phone && [
      'phone',
      L('Phone', 'الهاتف'),
      <a href={`tel:${f.phone}`}>
        <bdi>{d.parish.phone}</bdi>
      </a>
    ],
    email && ['mail', L('Email', 'البريد الإلكتروني'), <a href={`mailto:${email}`}>{email}</a>],
    website && [
      'globe',
      L('Website', 'الموقع'),
      <a href={website} target="_blank" rel="noopener">
        {website.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')}
      </a>
    ],
    String(v.officeHours || '').trim() && ['door', L('Office hours', 'ساعات المكتب'), <Lines text={v.officeHours} />]
  ].filter(Boolean);
  /* Plan your visit: what a newcomer wonders before coming for the first time. */
  const plan = [
    ['cross', L('What to expect', 'ماذا تتوقّع'), v.expect],
    ['globe', L('Languages and rite', 'اللغات والطقس'), v.languages],
    ['car', L('Parking', 'ركن السيارة'), v.parking],
    ['access', L('Accessibility', 'إمكانية الوصول'), v.accessibility]
  ].filter(r => String(r[2] || '').trim());
  const where = f.at
    ? f.at.exact
      ? L(`${f.name} on the map of Lebanon.`, `${f.name} على خريطة لبنان.`)
      : L(
          `Shown at the centre of ${f.town}. The parish office can add the church’s exact position to its public profile.`,
          `تظهر في وسط ${f.town}. يستطيع مكتب الرعية إضافة موقع الكنيسة الدقيق إلى صفحتها العامة.`
        )
    : '';
  return (
    <section className="ph-visit" id="contact" aria-labelledby="visit-title">
      <div className="site-wrap ph-visit-grid">
        <div className="ph-visit-copy">
          <header className="sec-head" data-reveal>
            <h2 id="visit-title">{L(`Visit ${f.name}`, `زيارة رعية ${f.name}`)}</h2>
            {f.contact ? (
              <p dir="auto">
                <Lines text={f.contact} />
              </p>
            ) : null}
          </header>
          {rows.length ? (
            <dl className="ph-contact">
              {rows.map(([icon, k, val]) => (
                <div key={k} data-reveal-item>
                  <span className="ph-contact-icon">
                    <Glyph name={icon} />
                  </span>
                  <dt>{k}</dt>
                  <dd dir="auto">{val}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="ph-quiet" data-reveal>
              {f.massTimes || plan.length
                ? ''
                : L(
                    'Mass times and contact details have not been published yet. ',
                    'لم تُنشر مواعيد القداديس ومعلومات التواصل بعد. '
                  )}
              {f.open
                ? L(
                    'You can still reach the parish office through any of the requests above.',
                    'يمكنك مع ذلك مراسلة مكتب الرعية عبر أيّ من الطلبات أعلاه.'
                  )
                : ''}
            </p>
          )}
          {plan.length ? (
            <div className="ph-plan" data-reveal>
              <h3>{L('Plan your visit', 'خطّط لزيارتك')}</h3>
              <ul>
                {plan.map(([icon, k, val]) => (
                  <li key={k} data-reveal-item>
                    <span className="ph-contact-icon">
                      <Glyph name={icon} />
                    </span>
                    <b>{k}</b>
                    <span dir="auto">
                      <Lines text={val} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="ph-visit-actions" data-reveal>
            <a className="btn btn-gilt" href={directions} target="_blank" rel="noopener">
              <Glyph name="route" />
              {L('Directions', 'الاتجاهات')}
            </a>
            {f.open ? (
              <a className="btn btn-ink-line" href={c.requestURL(p.id, 'appointment')}>
                <Glyph name="door" />
                {L('Ask for an appointment', 'اطلب موعداً')}
              </a>
            ) : null}
          </div>
        </div>
        {f.at ? (
          <div className="ph-map" data-reveal ref={mapBox}>
            <VisitMap p={p} f={f} box={mapBox} />
            <p className="ph-map-note">{where}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* The parish on the map among its neighbours: once seen, the map flies in to it. */
function VisitMap({ p, f, box }) {
  const c = useSite(),
    { L } = c,
    map = useRef(null);
  const items = useMemo(
    () =>
      c.directory
        .map(x => ({ x, at: x.id === p.id ? f.at : locate(x, c.details.get(x.id)) }))
        .filter(r => r.at)
        .map(({ x, at }) => ({ id: x.id, ...at, name: c.parishName(x), town: c.townName(x) })),
    [c.directory, c.details, c.lang]
  );
  useEffect(() => {
    let zoomed = false,
      mark = 0,
      wait = 0;
    const zoom = () => {
      if (zoomed) return;
      zoomed = true;
      map.current?.focus([p.id]);
      mark = setTimeout(() => map.current?.mark(p.id), 950);
    };
    const io =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            e => {
              if (e.some(x => x.isIntersecting)) {
                io.disconnect();
                wait = setTimeout(zoom, still() ? 0 : 1100);
              }
            },
            { rootMargin: '0px 0px -30% 0px' }
          )
        : null;
    io ? io.observe(box.current.querySelector('[data-lebanon-map]')) : zoom();
    return () => {
      io?.disconnect();
      clearTimeout(mark);
      clearTimeout(wait);
    };
  }, []);
  const card = (item, close) =>
    item.id === p.id ? (
      <div>
        <h3>{item.name}</h3>
        <p>{item.town}</p>
      </div>
    ) : (
      <>
        <button
          type="button"
          className="icon-button card-close"
          data-card-close
          aria-label={L('Close', 'إغلاق')}
          onClick={close}
        >
          <Glyph name="close" />
        </button>
        <div>
          <h3>{item.name}</h3>
          <p>{item.town}</p>
          <div className="card-actions">
            <a className="btn btn-gilt btn-small" href={c.profileURL(item.id)}>
              {L('Parish page', 'صفحة الرعية')}
            </a>
          </div>
        </div>
      </>
    );
  return <LebanonMap ref={map} L={L} items={items} visible={[p.id]} card={card} />;
}

/* ---------- neighbours ---------- */
function Nearby({ p, f }) {
  const c = useSite(),
    { L } = c,
    others = c.directory.filter(x => x.id !== p.id);
  if (!others.length) return null;
  const rows = others
    .map(x => {
      const at = locate(x, c.details.get(x.id));
      return { x, km: at && f.at ? Math.hypot(at.x - f.at.x, at.y - f.at.y) / KM : null };
    })
    .sort(
      (a, b) =>
        (a.km ?? Infinity) - (b.km ?? Infinity) ||
        (a.x.diocese === p.diocese ? -1 : 0) - (b.x.diocese === p.diocese ? -1 : 0)
    )
    .slice(0, 3);
  return (
    <section className="ph-near" aria-labelledby="near-title">
      <div className="site-wrap">
        <div className="ph-near-head" data-reveal>
          <h2 id="near-title">{L('Parishes nearby', 'رعايا قريبة')}</h2>
          <a className="text-button" href="public.html#directory">
            {L('Every parish on the map', 'كل الرعايا على الخريطة')}
          </a>
        </div>
        <ul className="ph-near-list">
          {rows.map(({ x, km }) => (
            <li key={x.id} data-reveal-item>
              <a href={c.profileURL(x.id)}>
                <Thumb src={c.parishPhotos(c.details.get(x.id))[0]} name={c.parishName(x)} />
                <span>
                  <b>{c.parishName(x)}</b>
                  <small>
                    {c.townName(x)}
                    {km !== null
                      ? ` · ${km < 1 ? L('under 1 km', 'أقل من ١ كم') : L(`about ${c.number(Math.round(km))} km`, `نحو ${c.number(Math.round(km))} كم`)}`
                      : ''}
                  </small>
                </span>
                <Glyph name="arrow" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
