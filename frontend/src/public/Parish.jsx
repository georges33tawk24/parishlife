/* A parish's public page, in the homepage's language. Without a photograph the hero is the
   parish's own church at night, its candle lit on the sill; with one, the photograph fills it. Then
   the parish's story, Mass times, calendar, ministries and clergy, requests, news,
   photographs and the way there, with its neighbours on the map. A section the parish has
   not published stays out rather than fill the page with placeholders. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LebanonMap, locate, projection } from './LebanonMap.jsx';
import { animateHome, stopHomeMotion, scrollToTarget } from './motion.js';
import { Sanctuary } from './Sanctuary.jsx';
import { season, feastOn } from '../lib/liturgy.js';
import { ParishCalendar, kindName, icsHref, icsAllHref, icsName, googleHref, beirutNow as beirut } from './calendar.jsx';
import { safeRichText } from '../lib/rich-text.js';
import { mountTurnstile } from '../lib/turnstile.js';
import { trackAction } from '../lib/beacon.js';
import { useSite, Lines, Paragraphs, Monogram, initialOf, dioceseName, digits, noun, still } from './site.jsx';
import { Icon, Glyph } from './icons.jsx';
import { useHeroWatch } from './chrome.jsx';

const KM = projection.ky / 111.2;   // map units per kilometre, north to south

/* Everything the page says about the parish, read once. */
function facts(c, p, d) {
  const parish = d.parish || {}, visit = d.visit || {};
  const name = c.pair(parish, 'name', 'nameAr') || c.parishName(p);
  const other = c.lang === 'ar' ? parish.name || p.name : parish.nameAr || p.ar;
  const town = c.pair(parish, 'town', 'townAr') || c.townName(p);
  const rite = c.pair(parish, 'rite', 'riteAr'), diocese = dioceseName(c, p.diocese);
  const today = c.localToday();
  const events = (d.events || []).filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.d || '')).sort((a, b) => (a.d + (a.t || '')).localeCompare(b.d + (b.t || '')));
  const upcoming = events.filter(e => e.d >= today);
  const photos = c.parishPhotos(d);
  const phone = String(parish.phone || '').replace(/[^\d+]/g, '');
  const address = c.pair(parish, 'address', 'addressAr');
  const at = locate(p, d);
  return { name, other: other && other !== name ? other : '', town, rite, diocese, today, events, upcoming, photos, phone, address, visit, at,
    open: d.publicRequests !== false, massTimes: c.content(d, 'massTimes').trim(), history: c.content(d, 'history').trim(), welcome: c.content(d, 'welcome').trim(),
    contact: c.content(d, 'contact').trim(), intro: c.content(d, 'sacraments').trim() };
}
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
const loc = c => c.lang === 'ar' ? 'ar-LB' : 'en-GB';
const when = (c, e) => {
  const date = new Date(e.d + 'T12:00:00'), day = new Intl.DateTimeFormat(loc(c), { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  return e.t ? `${day}${c.L(', ', '، ')}${digits(c, e.t)}` : day;
};
function relative(c, e) {
  const days = Math.round((new Date(e.d + 'T12:00:00') - new Date(c.localToday() + 'T12:00:00')) / 86400000);
  return days > 60 ? '' : digits(c, new Intl.RelativeTimeFormat(c.lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' }).format(days, 'day'));
}
const title = (c, e) => (c.lang === 'ar' ? e.titleAr || e.title : e.title || e.titleAr) || kindName(c.L, e.kind);
const TIME = /^\d{2}:\d{2}$/;
const abroad = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone !== 'Asia/Beirut'; } catch { return false; } };
const minutes = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const addDays = (key, n) => { const d = new Date(key + 'T12:00:00'); d.setDate(d.getDate() + n); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };
function nextMass(f) {
  const now = beirut();
  return f.upcoming.find(e => e.kind === 'mass' && (e.d > now.d || (e.d === now.d && (!TIME.test(e.t || '') || e.t >= now.t)))) || null;
}
/* "Today at 18:00" and "in 2 hours"; "Tomorrow at 08:00"; "Sunday 2 November at 10:30". */
function massWhen(c, e) {
  const { L } = c, now = beirut(), at = TIME.test(e.t || '') ? digits(c, e.t) : '';
  const day = e.d === now.d ? L('Today', 'اليوم') : e.d === addDays(now.d, 1) ? L('Tomorrow', 'غداً')
    : new Intl.DateTimeFormat(loc(c), { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(e.d + 'T12:00:00'));
  let soon = '';
  if (e.d === now.d && at) {
    const left = minutes(e.t) - minutes(now.t), rtf = new Intl.RelativeTimeFormat(c.lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
    soon = left < 1 ? L('starting now', 'يبدأ الآن') : left < 60 ? rtf.format(left, 'minute') : rtf.format(Math.round(left / 60), 'hour');
  }
  return { when: at ? L(`${day} at ${at}`, `${day} الساعة ${at}`) : day, soon: soon && digits(c, soon) };
}
/* The parish's feast: its name, the next date it falls on, and how far away that is. */
function feast(c, f) {
  const md = String(f.visit.feastDate || '');
  if (!/^\d{2}-\d{2}$/.test(md)) return null;
  const today = beirut().d, year = +today.slice(0, 4), date = `${year}-${md}` >= today ? `${year}-${md}` : `${year + 1}-${md}`;
  return { name: String(f.visit.feastName || '').trim() || c.L('The parish feast', 'عيد الرعية'), date,
    days: Math.round((new Date(date + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000),
    day: new Intl.DateTimeFormat(loc(c), { day: 'numeric', month: 'long' }).format(new Date(date + 'T12:00:00')) };
}
const evLink = (c, p, e) => e?.id ? c.eventURL(p.id, e.id) : c.calendarURL(p.id);
const https = value => /^https:\/\/[^\s]+$/.test(String(value || '').trim()) ? String(value).trim() : '';
const directionsURL = (p, d, v) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(
  /^-?\d+(\.\d+)?$/.test(String(v.latitude || '').trim()) && /^-?\d+(\.\d+)?$/.test(String(v.longitude || '').trim()) ? `${v.latitude},${v.longitude}` : [d.parish.name || p.name, d.parish.address, p.town, 'Lebanon'].filter(Boolean).join(' '));
const Thumb = ({ src, name }) => <span className="arch-thumb">{src ? <img src={src} alt="" loading="lazy" /> : <Monogram name={name} />}</span>;

/* Copying a link: the button says so for a moment. */
function CopyButton({ url, className, children, label, ...rest }) {
  const { L } = useSite();
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) return undefined; const t = setTimeout(() => setDone(false), 2200); return () => clearTimeout(t); }, [done]);
  return <button type="button" className={className + (done ? ' is-done' : '')} data-copy-link {...rest} onClick={async () => { try { await navigator.clipboard.writeText(url || location.href); setDone(true); } catch { /* not allowed */ } }}>
    {children}<span data-copy-label>{done ? L('Link copied', 'نُسخ الرابط') : label}</span></button>;
}
/* Share a page: WhatsApp first (how Lebanon shares), copying the link, and the phone's own sheet. */
export function ShareRow({ url, text, label }) {
  const { L } = useSite(), wa = 'https://wa.me/?text=' + encodeURIComponent(text + '\n' + url);
  return <div className="share-row" data-share data-url={url} data-text={text}>{label ? <span className="share-label">{label}</span> : null}
    <a className="share-btn is-wa" href={wa} target="_blank" rel="noopener"><Glyph name="whatsapp" /><span>WhatsApp</span></a>
    <CopyButton className="share-btn" url={url} label={L('Copy link', 'انسخ الرابط')}><Glyph name="link" /></CopyButton>
    <button type="button" className="share-btn" data-native-share hidden={!navigator.share} onClick={() => navigator.share({ title: text, url }).catch(() => {})}><Glyph name="share" /><span>{L('More', 'المزيد')}</span></button></div>;
}

/* The page's motion and its header, from the page's root. */
function usePage(root, hero) {
  useHeroWatch(hero);
  useLayoutEffect(() => { animateHome(root.current); return () => stopHomeMotion(); }, []);
}

export function ParishPage({ p, d }) {
  const c = useSite(), f = facts(c, p, d), { L } = c;
  const root = useRef(null), hero = useRef(null);
  const [photo, setPhoto] = useState(-1);
  usePage(root, hero);
  const sections = [
    ['about', L('About', 'عن الرعية'), <About key="about" p={p} f={f} />],
    ['times', L('Mass times', 'القداديس'), hasTimes(f) && <Times key="times" f={f} />],
    ['calendar', L('Events', 'المناسبات'), <Calendar key="calendar" p={p} d={d} f={f} />],
    ['ministries', L('Ministries', 'الخدمات'), ((d.ministries || []).length || (d.clergy || []).length) ? <Ministries key="ministries" p={p} d={d} /> : null],
    ['sacraments', L('Requests', 'الطلبات'), f.open && <Requests key="sacraments" p={p} f={f} />],
    ['updates', L('News', 'الأخبار'), (d.posts || []).some(x => x.title || x.body) && <News key="updates" d={d} />],
    ['gallery', L('Photos', 'الصور'), f.photos.length >= 2 && <Gallery key="gallery" f={f} onOpen={setPhoto} />],
    ['contact', L('Visit', 'الزيارة'), <Visit key="contact" p={p} d={d} f={f} />]
  ].filter(s => s[2]);
  const jump = (e, href, target) => { if (!target) return; e.preventDefault(); scrollToTarget(target, 130); history.replaceState(null, '', href); };
  return <div className="parish" data-parish-page ref={root} onClick={e => {
    const a = e.target.closest('[data-ph-jump], [data-ph-top]');
    if (a) jump(e, a.getAttribute('href'), a.hasAttribute('data-ph-top') ? root.current.querySelector('#top') : root.current.querySelector(a.getAttribute('href')));
  }}>
    <Hero heroRef={hero} p={p} d={d} f={f} />
    <SectionBar root={root} name={f.name} sections={sections} />
    {sections.map(s => s[2])}
    <Nearby p={p} f={f} />
    <Lightbox photos={f.photos} at={photo} onClose={() => setPhoto(-1)} onStep={setPhoto} />
  </div>;
}

/* ---------- hero ---------- */
function Hero({ heroRef, p, d, f }) {
  const c = useSite(), { L } = c, mass = nextMass(f), next = f.upcoming.find(e => e !== mass), month = f.upcoming.filter(e => e.d < addDays(f.today, 31)).length;
  const fe = feast(c, f), live = https(f.visit.livestream), massTime = mass && massWhen(c, mass);
  const [tip, setTip] = useState(null);
  const candles = useMemo(() => [{ id: p.id, name: f.name, town: f.town }], [p.id, f.name, f.town]);
  const stat = (n, key) => n ? <li key={key}><b data-count={n}>{c.number(n)}</b><span>{term(c, n, key)}</span></li> : null;
  const stats = [stat(month, 'upcoming'), stat((d.ministries || []).length, 'ministry'), stat((d.posts || []).length, 'post')].filter(Boolean);
  /* Without a photograph, the parish's own church at night: its initial in the glass, its name
     gilded on the sill, and its candle among the others (Sanctuary.jsx). */
  return <section className={'hero ph' + (f.photos[0] ? '' : ' hero-sanctuary')} id="top" data-hero data-photo={f.photos[0] ? '' : undefined} aria-labelledby="ph-title" ref={heroRef}>
    <div className="hero-art" data-scene>{f.photos[0] ? <div className="ph-photo"><img src={f.photos[0]} alt="" decoding="async" fetchPriority="high" /></div>
      : <Sanctuary inscription={f.name} seed={p.id} initial={initialOf(f.name)} places={candles} onTip={setTip}
        words={{ light: L('Light a candle', 'أضئ شمعة'), lit: L('A candle lit for your intention', 'شمعة مضاءة على نيّتك') }}
        onPick={() => scrollToTarget(document.querySelector('[data-parish-page] #contact'))} />}</div>
    <div className="hero-shade" aria-hidden="true"></div>
    <div className="site-wrap hero-inner ph-inner">
      <nav className="ph-crumbs" aria-label={L('Breadcrumb', 'مسار التنقّل')} data-hero-rise><a href="public.html#directory">{L('All parishes', 'كل الرعايا')}</a><span aria-hidden="true">/</span><span aria-current="page">{f.name}</span></nav>
      {f.town || f.rite ? <p className="ph-meta" data-hero-rise><Glyph name="pin" /><span>{[f.town, f.rite].filter(Boolean).join(' · ')}</span></p> : null}
      {fe && fe.days <= 40 ? <p className="ph-feast" data-hero-rise><Glyph name="star" /><span>{fe.days === 0 ? <>{L('Today: ', 'اليوم: ')}<bdi>{fe.name}</bdi></>
        : <><bdi>{fe.name}</bdi> · {digits(c, fe.day)} · {digits(c, new Intl.RelativeTimeFormat(c.lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' }).format(fe.days, 'day'))}</>}</span></p> : null}
      <h1 className="hero-title ph-title" id="ph-title">{f.name}</h1>
      {f.other ? <p className="ph-other" lang={c.lang === 'ar' ? 'en' : 'ar'} dir={c.lang === 'ar' ? 'ltr' : 'rtl'} data-hero-rise>{f.other}</p> : null}
      <p className="hero-lede" data-hero-rise dir="auto">{f.welcome ? <Lines text={f.welcome} /> : plainLede(c, f)}</p>
      {mass ? <a className="ph-mass" href={evLink(c, p, mass)} data-hero-rise><span className="lamp" aria-hidden="true"></span><span className="ph-mass-label">{L('Next Mass', 'القداس التالي')}</span>
        <b>{massTime.when}</b>{massTime.soon ? <span className="ph-mass-in">{massTime.soon}</span> : null}{abroad() && TIME.test(mass.t || '') ? <small>{L('Beirut time', 'بتوقيت بيروت')}</small> : null}</a> : null}
      <div className="ph-actions" data-hero-rise>
        {f.open ? <a className="btn btn-gilt" href="#sacraments" data-ph-jump>{L('Ask the parish office', 'اطلب من مكتب الرعية')}</a> : null}
        <a className="btn btn-line" href="#calendar" data-ph-jump><Glyph name="cal" />{L('Events and calendar', 'المناسبات والرزنامة')}</a>
        {live ? <a className="btn btn-line" href={live} target="_blank" rel="noopener" data-track="livestream"><Glyph name="play" />{L('Watch Mass live', 'شاهد القداس مباشرة')}</a> : null}
        {f.phone ? <a className="btn btn-line" href={`tel:${f.phone}`}><Glyph name="phone" /><bdi>{d.parish.phone}</bdi></a> : null}
      </div>
      {stats.length ? <ul className="hero-facts ph-facts" data-hero-rise>{stats}</ul> : null}
      <div data-hero-rise><ShareRow url={c.shareURL(c.profileURL(p.id))} text={L(`${f.name}${f.town ? ', ' + f.town : ''} on ParishLife`, `رعية ${f.name}${f.town ? '، ' + f.town : ''} على ParishLife`)} label={L('Share', 'شارك')} /></div>
    </div>
    {next ? <a className="ph-next" href={evLink(c, p, next)}><span className="ph-next-label"><span className="lamp" aria-hidden="true"></span>{L('Next at the parish', 'القادم في الرعية')}</span>
      <strong dir="auto">{title(c, next)}</strong><time dateTime={next.d + (next.t ? 'T' + next.t : '')}>{when(c, next)}</time>{relative(c, next) ? <span className="ph-next-in">{relative(c, next)}</span> : null}</a> : null}
    <p className="hero-tip" data-hero-tip role="status" hidden={!tip} style={tip ? { left: tip.left + 'px', top: tip.top + 'px' } : undefined}>{tip?.text}</p>
  </section>;
}

/* The section bar follows the reader; its gold ink slides under the section in view. */
function SectionBar({ root, name, sections }) {
  const { L } = useSite();
  const nav = useRef(null), list = useRef(null), ink = useRef(null);
  const [current, setCurrent] = useState(null);
  const place = id => {
    const link = id && nav.current.querySelector(`[data-ph-link="${id}"]`);
    if (!link) { ink.current.style.opacity = '0'; return; }
    const r = link.getBoundingClientRect(), base = nav.current.querySelector('.ph-nav-inner').getBoundingClientRect();
    ink.current.style.opacity = '1';
    ink.current.style.width = r.width + 'px';
    ink.current.style.transform = `translateX(${r.left - base.left}px)`;
  };
  useEffect(() => {
    const ids = sections.map(s => s[0]);
    const pick = () => {
      const line = innerHeight * 0.35;
      let best = null;
      for (const id of ids) { const s = root.current.querySelector('#' + id); if (s && s.getBoundingClientRect().top <= line) best = id; }
      nav.current.classList.toggle('is-stuck', nav.current.getBoundingClientRect().top <= parseFloat(getComputedStyle(nav.current).top) + 1);
      setCurrent(best);
    };
    addEventListener('scroll', pick, { passive: true });
    addEventListener('resize', pick);
    const frame = requestAnimationFrame(pick);
    return () => { removeEventListener('scroll', pick); removeEventListener('resize', pick); cancelAnimationFrame(frame); };
  }, []);
  useLayoutEffect(() => {
    place(current);
    const link = current && nav.current.querySelector(`[data-ph-link="${current}"]`);
    if (!link) return;
    const r = link.getBoundingClientRect(), lr = list.current.getBoundingClientRect();
    if (r.left < lr.left || r.right > lr.right) list.current.scrollTo({ left: list.current.scrollLeft + (r.left - lr.left) - 24, behavior: 'smooth' });
  }, [current]);
  return <nav className="ph-nav" data-ph-nav aria-label={L('On this page', 'في هذه الصفحة')} ref={nav}><div className="site-wrap ph-nav-inner">
    <a className="ph-nav-name" href="#top" data-ph-top><Monogram name={name} /><span>{name}</span></a>
    <ul ref={list} onScroll={() => place(current)}>{sections.map(([id, label]) => <li key={id}><a href={`#${id}`} data-ph-link={id} aria-current={current === id ? 'true' : undefined}
      onClick={e => { const target = root.current.querySelector('#' + id); if (!target) return; e.preventDefault(); e.stopPropagation(); scrollToTarget(target, 130); history.replaceState(null, '', '#' + id); }}>{label}</a></li>)}</ul>
    <span className="ph-nav-ink" aria-hidden="true" ref={ink}></span></div></nav>;
}

/* ---------- about ---------- */
function About({ p, f }) {
  const c = useSite(), { L } = c, art = f.photos[1] || f.photos[0], fe = feast(c, f);
  const rows = [[L('Town', 'البلدة'), f.town], [L('Rite', 'الطقس'), f.rite], [L('Diocese', 'الأبرشية'), f.diocese],
    [L('Feast day', 'عيد الرعية'), fe && `${String(f.visit.feastName || '').trim() ? fe.name + ' · ' : ''}${digits(c, fe.day)}`]].filter(r => r[1]);
  return <section className="ph-about" id="about" aria-labelledby="about-title"><div className="site-wrap ph-about-grid">
    <figure className={'ph-arch' + (art ? '' : ' is-night')} data-reveal>{art ? <img src={art} alt={f.name} loading="lazy" decoding="async" data-parallax="-6" /> : <><Monogram name={f.name} /><span className="ph-arch-light" aria-hidden="true"></span></>}</figure>
    <div className="ph-about-copy">
      <h2 id="about-title">{L(`About ${f.name}`, `عن رعية ${f.name}`)}</h2>
      {f.history ? <div dir="auto"><Paragraphs text={f.history} /></div> : <p className="ph-quiet">{L('The parish office has not published the parish’s story yet. Its Mass times, news and calendar appear here as soon as they are shared.', 'لم ينشر مكتب الرعية حكايتها بعد. تظهر هنا مواعيد القداديس والأخبار والرزنامة فور نشرها.')}</p>}
      {rows.length ? <dl className="ph-dl" data-reveal>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl> : null}
    </div></div></section>;
}

/* ---------- Mass times ---------- */
const VISIT_ROWS = [['confessionTimes', ['Confession', 'الاعتراف'], 'cross'], ['officeHours', ['Parish office', 'مكتب الرعية'], 'door']];
const hasTimes = f => f.massTimes || f.upcoming.some(e => e.kind === 'mass' && e.d < addDays(f.today, 7)) || VISIT_ROWS.some(([k]) => String(f.visit[k] || '').trim()) || https(f.visit.livestream);
function Times({ f }) {
  const c = useSite(), { L } = c, masses = f.upcoming.filter(e => e.kind === 'mass' && e.d < addDays(f.today, 7));
  const visitRows = VISIT_ROWS.filter(([k]) => String(f.visit[k] || '').trim()), live = https(f.visit.livestream);
  return <section className="ph-times" id="times" aria-labelledby="times-title"><div className="site-wrap ph-times-grid">
    <header className="sec-head" data-reveal><h2 id="times-title">{L('Mass times', 'مواعيد القداديس')}</h2><p>{L('As the parish office publishes them. On feast days, the calendar shows any change.', 'كما ينشرها مكتب الرعية. في الأعياد تظهر أي تغييرات في الرزنامة.')}</p></header>
    <div className="ph-times-body">
      {f.massTimes ? <div className="ph-board" data-reveal><span className="ph-board-mark" aria-hidden="true"><Glyph name="cross" /></span><div className="ph-board-text" dir="auto"><Lines text={f.massTimes} /></div></div> : null}
      {masses.length ? <div className="ph-week-masses" data-reveal><h3>{L('Masses in the next seven days', 'القداديس في الأيام السبعة المقبلة')}</h3><ul>{masses.map((e, i) => <li key={(e.id || i) + e.d} data-reveal-item><time>{new Intl.DateTimeFormat(loc(c), { weekday: 'short', day: 'numeric' }).format(new Date(e.d + 'T12:00:00'))}</time><b>{digits(c, e.t || '')}</b><span dir="auto">{title(c, e)}</span></li>)}</ul></div> : null}
      {visitRows.length || live ? <dl className="ph-hours" data-reveal>{visitRows.map(([k, label, icon]) => <div key={k}><Glyph name={icon} /><dt>{L(...label)}</dt><dd dir="auto"><Lines text={f.visit[k]} /></dd></div>)}
        {live ? <div><Glyph name="play" /><dt>{L('Livestream', 'البث المباشر')}</dt><dd><a href={live} target="_blank" rel="noopener" data-track="livestream">{L('Watch the parish’s Masses online', 'شاهد قداديس الرعية عبر الإنترنت')}</a></dd></div> : null}</dl> : null}
    </div></div></section>;
}

/* ---------- calendar ---------- */
/* Every parish has its events and calendar: the next celebrations as cards, all of them in one
   calendar file, and the month. Before anything is published, the calendar is there and says so. */
function Calendar({ p, d, f }) {
  const c = useSite(), { L } = c, next = f.upcoming.slice(0, 4), locale = loc(c);
  const place = [f.name, f.town].filter(Boolean).join(L(', ', '، '));
  return <section className="ph-cal" id="calendar" aria-labelledby="cal-title"><div className="site-wrap">
    <header className="sec-head" data-reveal><h2 id="cal-title">{L('Events and calendar', 'المناسبات والرزنامة')}</h2><p>{L('Masses, celebrations and gatherings the parish has published. Save any of them to your own calendar.', 'القداديس والاحتفالات واللقاءات التي نشرتها الرعية. احفظ أيّاً منها في رزنامتك.')}</p></header>
    {next.length ? <div className="ph-up" data-reveal><div className="ph-up-head"><h3>{L('Coming up', 'القادم')}</h3>
        <a className="btn btn-ink-line btn-small" href={icsAllHref(f.upcoming, e => title(c, e), place, e => e.id ? c.shareURL(c.eventURL(p.id, e.id)) : '')} download={icsName(f.name)}><Glyph name="add" />{L('Add all to my calendar', 'أضف الكل إلى رزنامتي')}</a></div>
        <ul className="wk-list">{next.map((e, i) => {
          const t = title(c, e), date = new Date(e.d + 'T12:00:00');
          return <li key={(e.id || i) + e.d} className={`wk-ev k-${e.kind || 'event'}`} data-reveal-item>
            <a className="wk-ev-link" href={evLink(c, p, e)}>
              <span className="wk-date" aria-hidden="true"><small>{new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)}</small><b>{digits(c, date.getDate())}</b><small>{new Intl.DateTimeFormat(locale, { month: 'short' }).format(date)}</small></span>
              <span className="wk-body"><span className="wk-meta">{e.t ? <time>{digits(c, e.t)}</time> : null}<span className="wk-kind">{kindName(L, e.kind)}</span>{relative(c, e) ? <span className="wk-in">{relative(c, e)}</span> : null}</span>
                <strong dir="auto">{t}</strong><span className="sr-only">{when(c, e)}</span></span></a>
            <a className="wk-add" href={icsHref(e, t, place, e.id ? c.shareURL(c.eventURL(p.id, e.id)) : '')} download={icsName(t)} aria-label={L(`Add ${t} to my calendar`, `أضف «${t}» إلى رزنامتي`)} title={L('Add to my calendar', 'أضف إلى رزنامتي')}><Glyph name="add" /></a></li>;
        })}</ul></div>
      : <div className="ph-cal-empty" data-reveal><span className="lamp is-unlit" aria-hidden="true"></span><p>{f.events.length ? L('Nothing is coming up in the parish calendar yet. Past events are still in the calendar below.', 'لا شيء قادم في رزنامة الرعية بعد. ما زالت الأحداث السابقة في الرزنامة أدناه.') : L('The parish has not published any events yet. Masses, feasts and gatherings appear here as soon as the parish office adds them to its calendar.', 'لم تنشر الرعية أي مناسبات بعد. تظهر القداديس والأعياد واللقاءات هنا فور إضافتها إلى رزنامة مكتب الرعية.')}</p></div>}
    <div className="ph-cal-month" data-reveal><ParishCalendar L={L} lang={c.lang} events={d.events || []} place={[f.name, f.town].filter(Boolean).join(', ')} link={e => c.eventURL(p.id, e.id)} /></div>
    <Follow p={p} f={f} />
    <p className="ph-cal-more"><a className="text-button" href={c.calendarURL(p.id)}>{L('Open the calendar on its own page', 'افتح الرزنامة في صفحة مستقلّة')}</a></p></div></section>;
}

/* Follow the parish: its calendar in the visitor's own (kept up to date), its WhatsApp channel,
   and following it from a ParishLife account. */
function Follow({ p, f }) {
  const c = useSite(), { L } = c, webcal = c.feedURL(p.id, 'webcal:'), feed = c.feedURL(p.id), whatsapp = https(f.visit.whatsapp);
  return <div className="ph-follow" data-reveal><span className="ph-follow-mark" aria-hidden="true"><Glyph name="bell" /></span>
    <div className="ph-follow-copy"><h3>{L('Never miss a celebration', 'لا تفوّت أيّ احتفال')}</h3>
      <p>{L(`Subscribe once and every Mass and event ${f.name} publishes appears in your phone’s calendar, and stays up to date.`, `اشترك مرّة واحدة فتظهر كلّ القداديس والمناسبات التي تنشرها رعية ${f.name} في رزنامة هاتفك، وتبقى محدّثة.`)}</p></div>
    <div className="ph-follow-actions">
      <a className="btn btn-gilt btn-small" href={webcal}><Glyph name="cal" />{L('Subscribe in my calendar', 'اشترك في رزنامتي')}</a>
      <a className="btn btn-ink-line btn-small" href={'https://calendar.google.com/calendar/render?cid=' + encodeURIComponent(feed)} target="_blank" rel="noopener"><Glyph name="google" />{L('Google Calendar', 'رزنامة Google')}</a>
      {whatsapp ? <a className="btn btn-ink-line btn-small is-wa" href={whatsapp} target="_blank" rel="noopener" data-track="whatsapp-follow"><Glyph name="whatsapp" />{L('Follow on WhatsApp', 'تابع عبر واتساب')}</a> : null}
    </div>
    <p className="ph-follow-more">{L('Another calendar app?', 'تطبيق رزنامة آخر؟')} <CopyButton className="text-button" url={feed} data-url={feed} label={L('Copy the calendar address', 'انسخ عنوان الرزنامة')} />
      {' · '}<a className="text-button" href={'index.html?parish=' + encodeURIComponent(p.id) + '#/account'}>{L('Follow in your ParishLife account', 'تابع الرعية من حسابك على ParishLife')}</a></p></div>;
}

/* ---------- ministries and clergy ---------- */
function Ministries({ p, d }) {
  const c = useSite(), { L } = c, list = d.ministries || [], clergy = d.clergy || [];
  const ask = g => c.requestURL(p.id, 'ministry') + '&ministry=' + encodeURIComponent(g.name);
  return <section className="ph-min" id="ministries" aria-labelledby="min-title"><div className="site-wrap">
    <header className="sec-head" data-reveal><h2 id="min-title">{list.length ? L('Ministries', 'الخدمات') : L('Clergy', 'الإكليروس')}</h2><p>{list.length ? L('The groups that keep the parish alive. Each one welcomes new members; ask the parish office about joining.', 'الجماعات التي تُحيي الرعية. كلّ منها يرحّب بأعضاء جدد؛ استفسر من مكتب الرعية عن الانضمام.') : L('Contact the clergy through the parish office.', 'تواصل مع الكهنة عبر مكتب الرعية.')}</p></header>
    {clergy.length ? <ul className="ph-clergy">{clergy.map((m, i) => <li key={i} data-reveal-item><span className="arch-thumb"><Monogram name={m.name} /></span><span><b>{m.name}</b><small>{m.title || ''}</small></span></li>)}</ul> : null}
    {list.length ? <ul className="ph-cards">{list.map((g, i) => {
      const name = c.lang === 'ar' ? g.nameAr || g.name : g.name || g.nameAr;
      return <li key={i} data-reveal-item><article className="ph-card" data-tilt><span className="ph-card-arch"><Monogram name={name} /></span>
        <h3 dir="auto">{name}</h3>{g.description ? <p dir="auto">{g.description}</p> : null}
        {g.responsible ? <p className="ph-led">{L('Led by', 'بإشراف')} <b>{g.responsible}</b></p> : null}
        <a className="ph-card-link" href={ask(g)}>{L('Ask about joining', 'استفسر عن الانضمام')}<Glyph name="arrow" /><span className="sr-only">: {name}</span></a></article></li>;
    })}</ul> : null}
  </div></section>;
}

/* ---------- requests ---------- */
function Requests({ p, f }) {
  const c = useSite(), { L } = c;
  return <section className="ask ph-ask" id="sacraments" aria-labelledby="ask-title"><div className="site-wrap">
    <header className="sec-head" data-reveal><h2 id="ask-title">{L(`Ask ${f.name}`, `اطلب من رعية ${f.name}`)}</h2><p dir="auto">{f.intro ? <Lines text={f.intro} /> : L('Baptisms, weddings, certificates and more. Send your request straight to the parish office without an account, and follow it with a private link.', 'معموديات وأكاليل وشهادات وغيرها. أرسل طلبك مباشرة إلى مكتب الرعية من دون حساب، وتابعه برابط خاص.')}</p></header>
    <Bring f={f} />
    <ul className="arcade">{c.REQUESTS.map(([kind, art, t, sub]) => <li key={kind} data-reveal-item><a className="arch" href={c.requestURL(p.id, kind)} data-tilt><span className="arch-icon"><Icon name={art} /></span><strong>{L(...t)}</strong><small>{L(...sub)}</small></a></li>)}</ul>
    <div className="ask-more">{c.OTHER_REQUESTS.map(([kind, art, t, sub]) => <a key={kind} className="ask-wide" href={c.requestURL(p.id, kind)} data-reveal-item><span className="arch-icon"><Icon name={art} /></span><span><strong>{L(...t)}</strong><small>{L(...sub)}</small></span><Glyph name="arrow" /></a>)}</div>
  </div></section>;
}

/* What to bring for a baptism, a wedding or a certificate, as the parish office writes it. */
function Bring({ f, side = false }) {
  const { L } = useSite(), notes = String(f.visit.sacramentNotes || '').trim();
  if (!notes) return null;
  return <div className={'ph-bring' + (side ? ' is-side' : '')} data-reveal={side ? undefined : ''}><span className="ph-bring-mark" aria-hidden="true"><Glyph name="doc" /></span>
    <div><h3>{L('Before you ask: what to bring', 'قبل أن تطلب: ما الذي تحضره')}</h3><div className="ph-bring-text" dir="auto"><Lines text={notes} /></div></div></div>;
}

/* ---------- news ---------- */
function News({ d }) {
  const c = useSite(), { L } = c, posts = (d.posts || []).filter(x => x.title || x.body).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  /* a post written in the editor keeps its formatting, made safe; plain text keeps its lines */
  const body = text => /<[a-z][\s\S]*>/i.test(text || '') ? <div className="published-body" dir="auto" dangerouslySetInnerHTML={{ __html: safeRichText(text) }} /> : <div className="published-body" dir="auto"><Lines text={text || ''} /></div>;
  return <section className="news ph-news" id="updates" aria-labelledby="news-title"><div className="site-wrap">
    <header className="sec-head" data-reveal><h2 id="news-title">{L('From the parish', 'من الرعية')}</h2><p>{L('Announcements published by the parish office.', 'إعلانات ينشرها مكتب الرعية.')}</p></header>
    <div className="news-list">{posts.map((post, i) => <article key={post.id || i} className={'news-item' + (i === 0 ? ' is-lead' : '')} data-reveal-item>
      {c.publishedDate(post.at) ? <time dateTime={post.at}>{c.publishedDate(post.at)}</time> : null}
      {post.title ? <h3 dir="auto">{post.title}</h3> : null}{body(post.body)}</article>)}</div>
  </div></section>;
}

/* ---------- photographs ---------- */
function Gallery({ f, onOpen }) {
  const { L } = useSite();
  return <section className="ph-gallery" id="gallery" aria-labelledby="gal-title"><div className="site-wrap">
    <header className="sec-head" data-reveal><h2 id="gal-title">{L('Photographs', 'صور الرعية')}</h2><p>{L('Published by the parish office.', 'ينشرها مكتب الرعية.')}</p></header>
    <ul className="ph-photos">{f.photos.map((src, i) => <li key={i} data-reveal-item><button type="button" className="ph-photo-btn" data-lb-open={i} aria-label={L(`Open photograph ${i + 1}`, `افتح الصورة ${i + 1}`)} onClick={() => onOpen(i)}><img src={src} alt="" loading="lazy" decoding="async" /></button></li>)}</ul>
  </div></section>;
}
function Lightbox({ photos, at, onClose, onStep }) {
  const c = useSite(), { L } = c, dialog = useRef(null);
  useEffect(() => {
    const box = dialog.current;
    if (!box || typeof box.showModal !== 'function') return;
    if (at >= 0 && !box.open) box.showModal();
    if (at < 0 && box.open) box.close();
  }, [at]);
  const show = i => onStep((i + photos.length) % photos.length);
  const i = Math.max(0, at);
  return <dialog className="ph-lightbox" data-lightbox aria-label={L('Photographs', 'الصور')} ref={dialog} onClose={onClose}
    onClick={e => { if (e.target === dialog.current) dialog.current.close(); }}
    onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') show(i + ((e.key === 'ArrowRight') === (c.lang !== 'ar') ? 1 : -1)); }}>
    <figure><img alt="" src={at >= 0 ? photos[i] : undefined} /><figcaption>{at >= 0 ? L(`${i + 1} of ${photos.length}`, `${c.number(i + 1)} من ${c.number(photos.length)}`) : ''}</figcaption></figure>
    <button type="button" className="icon-button lb-close" data-lb-close aria-label={L('Close', 'إغلاق')} onClick={() => dialog.current.close()}><Glyph name="close" /></button>
    <button type="button" className="icon-button lb-prev" data-lb-step="-1" aria-label={L('Previous photograph', 'الصورة السابقة')} onClick={() => show(i - (c.lang === 'ar' ? -1 : 1))}><Glyph name="prev" /></button>
    <button type="button" className="icon-button lb-next" data-lb-step="1" aria-label={L('Next photograph', 'الصورة التالية')} onClick={() => show(i + (c.lang === 'ar' ? -1 : 1))}><Glyph name="next" /></button></dialog>;
}

/* ---------- visit ---------- */
function Visit({ p, d, f }) {
  const c = useSite(), { L } = c, v = f.visit, directions = directionsURL(p, d, v), mapBox = useRef(null);
  const website = /^https:\/\/[^\s]+$/.test(v.website || '') ? v.website : '';
  const email = /^[^\s@]+@[^\s@]+$/.test(v.email || '') ? v.email : '';
  const rows = [
    f.address && ['pin', L('Address', 'العنوان'), f.address],
    f.phone && ['phone', L('Phone', 'الهاتف'), <a href={`tel:${f.phone}`}><bdi>{d.parish.phone}</bdi></a>],
    email && ['mail', L('Email', 'البريد الإلكتروني'), <a href={`mailto:${email}`}>{email}</a>],
    website && ['globe', L('Website', 'الموقع'), <a href={website} target="_blank" rel="noopener">{website.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>],
    String(v.officeHours || '').trim() && ['door', L('Office hours', 'ساعات المكتب'), <Lines text={v.officeHours} />]
  ].filter(Boolean);
  /* Plan your visit: what a newcomer wonders before coming for the first time. */
  const plan = [['cross', L('What to expect', 'ماذا تتوقّع'), v.expect], ['globe', L('Languages and rite', 'اللغات والطقس'), v.languages],
    ['car', L('Parking', 'ركن السيارة'), v.parking], ['access', L('Accessibility', 'إمكانية الوصول'), v.accessibility]].filter(r => String(r[2] || '').trim());
  const where = f.at ? (f.at.exact ? L(`${f.name} on the map of Lebanon.`, `${f.name} على خريطة لبنان.`) : L(`Shown at the centre of ${f.town}. The parish office can add the church’s exact position to its public profile.`, `تظهر في وسط ${f.town}. يستطيع مكتب الرعية إضافة موقع الكنيسة الدقيق إلى صفحتها العامة.`)) : '';
  return <section className="ph-visit" id="contact" aria-labelledby="visit-title"><div className="site-wrap ph-visit-grid">
    <div className="ph-visit-copy">
      <header className="sec-head" data-reveal><h2 id="visit-title">{L(`Visit ${f.name}`, `زيارة رعية ${f.name}`)}</h2>{f.contact ? <p dir="auto"><Lines text={f.contact} /></p> : null}</header>
      {rows.length ? <dl className="ph-contact">{rows.map(([icon, k, val]) => <div key={k} data-reveal-item><span className="ph-contact-icon"><Glyph name={icon} /></span><dt>{k}</dt><dd dir="auto">{val}</dd></div>)}</dl>
        : <p className="ph-quiet" data-reveal>{f.massTimes || plan.length ? '' : L('Mass times and contact details have not been published yet. ', 'لم تُنشر مواعيد القداديس ومعلومات التواصل بعد. ')}{f.open ? L('You can still reach the parish office through any of the requests above.', 'يمكنك مع ذلك مراسلة مكتب الرعية عبر أيّ من الطلبات أعلاه.') : ''}</p>}
      {plan.length ? <div className="ph-plan" data-reveal><h3>{L('Plan your visit', 'خطّط لزيارتك')}</h3><ul>{plan.map(([icon, k, val]) => <li key={k} data-reveal-item><span className="ph-contact-icon"><Glyph name={icon} /></span><b>{k}</b><span dir="auto"><Lines text={val} /></span></li>)}</ul></div> : null}
      <div className="ph-visit-actions" data-reveal><a className="btn btn-gilt" href={directions} target="_blank" rel="noopener"><Glyph name="route" />{L('Directions', 'الاتجاهات')}</a>
        {f.open ? <a className="btn btn-ink-line" href={c.requestURL(p.id, 'appointment')}><Glyph name="door" />{L('Ask for an appointment', 'اطلب موعداً')}</a> : null}</div>
    </div>
    {f.at ? <div className="ph-map" data-reveal ref={mapBox}><VisitMap p={p} f={f} box={mapBox} /><p className="ph-map-note">{where}</p></div> : null}
  </div></section>;
}
/* The parish on the map among its neighbours: once seen, the map flies in to it. */
function VisitMap({ p, f, box }) {
  const c = useSite(), { L } = c, map = useRef(null);
  const items = useMemo(() => c.directory.map(x => ({ x, at: x.id === p.id ? f.at : locate(x, c.details.get(x.id)) })).filter(r => r.at)
    .map(({ x, at }) => ({ id: x.id, ...at, name: c.parishName(x), town: c.townName(x) })), [c.directory, c.details, c.lang]);
  useEffect(() => {
    let zoomed = false, mark = 0, wait = 0;
    const zoom = () => { if (zoomed) return; zoomed = true; map.current?.focus([p.id]); mark = setTimeout(() => map.current?.mark(p.id), 950); };
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(e => { if (e.some(x => x.isIntersecting)) { io.disconnect(); wait = setTimeout(zoom, still() ? 0 : 1100); } }, { rootMargin: '0px 0px -30% 0px' }) : null;
    io ? io.observe(box.current.querySelector('[data-lebanon-map]')) : zoom();
    return () => { io?.disconnect(); clearTimeout(mark); clearTimeout(wait); };
  }, []);
  const card = (item, close) => item.id === p.id ? <div><h3>{item.name}</h3><p>{item.town}</p></div>
    : <><button type="button" className="icon-button card-close" data-card-close aria-label={L('Close', 'إغلاق')} onClick={close}><Glyph name="close" /></button><div><h3>{item.name}</h3><p>{item.town}</p><div className="card-actions"><a className="btn btn-gilt btn-small" href={c.profileURL(item.id)}>{L('Parish page', 'صفحة الرعية')}</a></div></div></>;
  return <LebanonMap ref={map} L={L} items={items} visible={[p.id]} card={card} />;
}

/* ---------- neighbours ---------- */
function Nearby({ p, f }) {
  const c = useSite(), { L } = c, others = c.directory.filter(x => x.id !== p.id);
  if (!others.length) return null;
  const rows = others.map(x => { const at = locate(x, c.details.get(x.id)); return { x, km: at && f.at ? Math.hypot(at.x - f.at.x, at.y - f.at.y) / KM : null }; })
    .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity) || (a.x.diocese === p.diocese ? -1 : 0) - (b.x.diocese === p.diocese ? -1 : 0)).slice(0, 3);
  return <section className="ph-near" aria-labelledby="near-title"><div className="site-wrap">
    <div className="ph-near-head" data-reveal><h2 id="near-title">{L('Parishes nearby', 'رعايا قريبة')}</h2><a className="text-button" href="public.html#directory">{L('Every parish on the map', 'كل الرعايا على الخريطة')}</a></div>
    <ul className="ph-near-list">{rows.map(({ x, km }) => <li key={x.id} data-reveal-item><a href={c.profileURL(x.id)}><Thumb src={c.parishPhotos(c.details.get(x.id))[0]} name={c.parishName(x)} />
      <span><b>{c.parishName(x)}</b><small>{c.townName(x)}{km !== null ? ` · ${km < 1 ? L('under 1 km', 'أقل من ١ كم') : L(`about ${c.number(Math.round(km))} km`, `نحو ${c.number(Math.round(km))} كم`)}` : ''}</small></span><Glyph name="arrow" /></a></li>)}</ul></div></section>;
}

/* ---------- the parish's other pages: a request, the full calendar, an event ---------- */
/* The parish's window above its other pages: its light by the hour, without the candles. */
export function SubHero({ heroRef, crumbs, heading, lede, seed, initial }) {
  const { L } = useSite();
  return <section className="sub-hero is-sanctuary" data-hero aria-labelledby="sub-title" ref={heroRef}>
    <div className="sub-art sub-sanctuary" aria-hidden="true"><Sanctuary seed={seed} initial={initial} /></div>
    <div className="site-wrap sub-inner">
      <nav className="ph-crumbs" aria-label={L('Breadcrumb', 'مسار التنقّل')} data-hero-rise>{crumbs.flatMap(([label, href], i) => [i ? <span key={'/' + i} aria-hidden="true">/</span> : null,
        href ? <a key={i} href={href}>{label}</a> : <span key={i} aria-current="page">{label}</span>])}</nav>
      <h1 className="hero-title" id="sub-title">{heading}</h1>{lede ? <p data-hero-rise>{lede}</p> : null}
    </div></section>;
}
function ParishSub({ p, f, here, heading, lede, className = '', docTitle, children }) {
  const c = useSite(), { L } = c, root = useRef(null), hero = useRef(null);
  usePage(root, hero);
  return <div className={'parish-sub' + (className ? ' ' + className : '')} data-parish-sub data-doc-title={docTitle} ref={root}>
    <SubHero heroRef={hero} seed={p.id} initial={initialOf(f.name)} heading={heading} lede={lede}
      crumbs={[[L('All parishes', 'كل الرعايا'), 'public.html#directory'], [f.name, c.profileURL(p.id)], [here]]} />
    {children}</div>;
}

export function RequestPage({ p, d, kind }) {
  const c = useSite(), f = facts(c, p, d), { L } = c;
  const ministry = new URLSearchParams(location.search).get('ministry') || '';
  const all = [...c.REQUESTS, ...c.OTHER_REQUESTS, ['appointment', 'calendar', ['Appointment', 'موعد'], ['With the parish office', 'مع مكتب الرعية']], ['ministry', 'church', ['Joining a ministry', 'الانضمام إلى خدمة'], ['Ask how to take part', 'اسأل عن المشاركة']]];
  const chosen = all.some(r => r[0] === kind) ? kind : 'certificate';
  const steps = [[L('The office reads it', 'يقرأه المكتب'), L('Your request goes only to this parish’s office.', 'يصل طلبك إلى مكتب هذه الرعية فقط.')],
    [L('It answers or asks for documents', 'يجيب أو يطلب مستندات'), L('Follow each step with your private link.', 'تابع كل خطوة برابطك الخاص.')],
    [L('You collect what you asked for', 'تستلم ما طلبته'), L('At the parish, or as a secure download when it is offered.', 'من الرعية، أو بتنزيل آمن عند توفّره.')]];
  return <ParishSub p={p} f={f} here={L('Request', 'طلب')} heading={L(`Ask ${f.name}`, `اطلب من رعية ${f.name}`)} lede={L('No account is needed. Send your request to the parish office and keep the private link you receive to follow it.', 'لا حاجة إلى حساب. أرسل طلبك إلى مكتب الرعية واحتفظ بالرابط الخاص الذي تتلقاه لمتابعته.')}>
    <div className="site-wrap rq-grid">
      <div className="rq-main"><RequestForm p={p} all={all} chosen={chosen} ministry={ministry} /></div>
      <aside className="rq-side" data-reveal>
        <a className="rq-parish" href={c.profileURL(p.id)}><Thumb src={f.photos[0]} name={f.name} /><span><b>{f.name}</b><small>{[f.town, f.rite].filter(Boolean).join(' · ')}</small></span></a>
        <h2>{L('What happens next', 'ماذا يحدث بعد ذلك')}</h2>
        <ol className="rq-steps">{steps.map(([b, s]) => <li key={b}><b>{b}</b><span>{s}</span></li>)}</ol>
        <Bring f={f} side />
        <p className="rq-privacy">{L('No email or text message is sent automatically. Anyone with your tracking link can see the request’s status, so keep it to yourself.', 'لا تُرسل رسائل بريد أو رسائل نصية تلقائياً. يستطيع كل من يملك رابط المتابعة رؤية حالة الطلب، فاحتفظ به لنفسك.')}</p>
      </aside>
    </div></ParishSub>;
}

/* The request itself: sent to the parish office, answered with a private tracking link. */
function RequestForm({ p, all, chosen, ministry }) {
  const c = useSite(), { L } = c;
  const turnstile = useRef(null), check = useRef(null), result = useRef(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  useEffect(() => { let live = true; mountTurnstile(turnstile.current, c.lang === 'ar' ? 'ar' : 'en').then(state => { if (live) check.current = state; }); return () => { live = false; }; }, []);
  useEffect(() => { if (link) result.current?.scrollIntoView({ block: 'center', behavior: still() ? 'auto' : 'smooth' }); }, [link]);
  const send = async e => {
    e.preventDefault();
    const form = e.currentTarget;
    setSending(true); setError('');
    try {
      const q = { ...Object.fromEntries(new FormData(form)), parish: p.id, responsibleAdult: form.elements.responsibleAdult.checked, ...(check.current ? { turnstile: check.current.token } : {}) };
      const response = await fetch('/api/public/guest-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send request.');
      trackAction('request-sent', p.id);
      const url = new URL('public.html', location.href);
      url.hash = 'track=' + data.trackingToken;
      setLink(url.href);
    } catch (err) { setError(err.message); setSending(false); check.current?.reset(); }
  };
  return <>
    <form className="rq-form" data-guest-request hidden={!!link} onSubmit={send}>
      <fieldset className="rq-step" data-reveal><legend><span className="rq-n" aria-hidden="true">{digits(c, 1)}</span>{L('What do you need?', 'ماذا تحتاج؟')}</legend>
        <div className="rq-kinds">{all.map(([k, art, t, sub]) => <label key={k} className="rq-kind"><input type="radio" name="kind" value={k} defaultChecked={k === chosen} required /><span className="arch-icon"><Icon name={art} /></span><span><b>{L(...t)}</b><small>{L(...sub)}</small></span></label>)}</div>
      </fieldset>
      <fieldset className="rq-step" data-reveal><legend><span className="rq-n" aria-hidden="true">{digits(c, 2)}</span>{L('Who is asking?', 'من يطلب؟')}</legend>
        <div className="rq-fields">
          <label className="rq-field"><span>{L('Your full name', 'اسمك الكامل')}</span><input name="name" required maxLength="120" autoComplete="name" /></label>
          <label className="rq-field"><span>{L('On behalf of', 'بالنيابة عن')} <small>{L('optional', 'اختياري')}</small></span><input name="behalf" maxLength="120" /></label>
          <label className="rq-field"><span>{L('Email', 'البريد الإلكتروني')}</span><input type="email" name="email" autoComplete="email" maxLength="120" dir="ltr" /></label>
          <label className="rq-field"><span>{L('Phone', 'الهاتف')}</span><input type="tel" name="phone" autoComplete="tel" maxLength="40" dir="ltr" /></label>
        </div>
        <p className="rq-hint">{L('Give at least one way to reach you: an email address, a phone number, or both.', 'أدخل وسيلة واحدة على الأقل للتواصل معك: بريد إلكتروني أو رقم هاتف أو كليهما.')}</p>
      </fieldset>
      <fieldset className="rq-step" data-reveal><legend><span className="rq-n" aria-hidden="true">{digits(c, 3)}</span>{L('Your request', 'طلبك')}</legend>
        <label className="rq-field"><span>{L('Request details', 'تفاصيل الطلب')}</span><textarea name="description" required minLength="5" maxLength="4000" rows="5" placeholder={L('Names, dates and anything the office should know.', 'الأسماء والتواريخ وكل ما يجب أن يعرفه المكتب.')}
          defaultValue={ministry ? L('I would like to learn about joining ', 'أودّ الاستفسار عن الانضمام إلى ') + ministry : ''} /></label>
        <div className="rq-delivery" role="radiogroup" aria-labelledby="rq-delivery-label"><span className="rq-label" id="rq-delivery-label">{L('If there is a document, how would you like it?', 'إن كان هناك مستند، كيف تودّ استلامه؟')}</span>
          <label className="rq-opt"><input type="radio" name="delivery" value="collection" defaultChecked /><span><b>{L('Collect from the parish', 'الاستلام من الرعية')}</b><small>{L('The office tells you when it is ready.', 'يُعلمك المكتب عندما يصبح جاهزاً.')}</small></span></label>
          <label className="rq-opt"><input type="radio" name="delivery" value="secure-download" /><span><b>{L('Secure download, when available', 'تنزيل آمن عند توفّره')}</b><small>{L('From your private tracking link.', 'من رابط المتابعة الخاص بك.')}</small></span></label>
        </div>
      </fieldset>
      <label className="rq-check" data-reveal><input name="responsibleAdult" type="checkbox" required /><span>{L('I am the responsible adult submitting this request. A child will be accompanied by a parent or guardian.', 'أنا الشخص البالغ المسؤول عن هذا الطلب. سيكون الطفل برفقة أحد الوالدين أو ولي الأمر.')}</span></label>
      <div className="rq-turnstile" data-turnstile hidden ref={turnstile}></div>
      <p className="rq-error" data-request-error role="alert">{error}</p>
      <button className="btn btn-gilt rq-send" type="submit" disabled={sending}>{L('Send request', 'إرسال الطلب')}<Glyph name="arrow" /></button>
    </form>
    <div data-request-result aria-live="polite" ref={result}>{link ? <RequestDone link={link} /> : null}</div>
  </>;
}
function RequestDone({ link }) {
  const { L } = useSite(), field = useRef(null);
  const [copied, setCopied] = useState(false);
  return <div className="rq-done"><svg className="rq-tick" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="M15 27.5l7 7 15-16" /></svg><h2>{L('Request received', 'تم استلام الطلب')}</h2><p>{L('Save this private link. Anyone with it can see this request’s status. No email or SMS has been sent.', 'احفظ هذا الرابط الخاص. يستطيع كل من يملكه الاطّلاع على حالة الطلب. لم تُرسل أي رسالة عبر البريد الإلكتروني أو الرسائل النصية.')}</p>
    <label className="rq-link"><span>{L('Private tracking link', 'رابط المتابعة الخاص')}</span><span className="rq-link-row"><input readOnly dir="ltr" value={link} ref={field} />
      <button type="button" className="btn btn-small btn-ink-line" data-copy onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { field.current.select(); } }}>{copied ? L('Copied', 'تم النسخ') : L('Copy', 'نسخ')}</button></span></label>
    <a className="btn btn-gilt" href={link}>{L('Track my request', 'متابعة طلبي')}</a></div>;
}

export function CalendarPage({ p, d }) {
  const c = useSite(), f = facts(c, p, d), { L } = c;
  return <ParishSub p={p} f={f} here={L('Calendar', 'الرزنامة')} heading={L(`${f.name} calendar`, `رزنامة رعية ${f.name}`)} lede={L('Masses, celebrations and gatherings, as the parish office publishes them.', 'القداديس والاحتفالات واللقاءات، كما ينشرها مكتب الرعية.')}>
    <section className="site-wrap ph-calpage" data-reveal>{f.events.length ? null : <div className="ph-cal-empty"><span className="lamp is-unlit" aria-hidden="true"></span><p>{L('The parish has not published any events yet. They appear here as soon as the parish office adds them to its calendar.', 'لم تنشر الرعية أي مناسبات بعد. تظهر هنا فور إضافتها إلى رزنامة مكتب الرعية.')}</p></div>}
      <ParishCalendar L={L} lang={c.lang} events={d.events || []} place={[f.name, f.town].filter(Boolean).join(', ')} link={e => c.eventURL(p.id, e.id)} /></section></ParishSub>;
}

/* One event's own page: when and where, saving it to a calendar, sharing it, and what else is coming. */
export function EventPage({ p, d, id }) {
  const c = useSite(), f = facts(c, p, d), { L } = c, e = f.events.find(x => x.id && String(x.id) === String(id));
  if (!e) return <ParishSub p={p} f={f} here={L('Event', 'مناسبة')} heading={L('This event is no longer in the calendar', 'لم تعد هذه المناسبة في الرزنامة')} lede={L('The parish may have changed or removed it. Its calendar shows everything coming up.', 'ربما عدّلتها الرعية أو أزالتها. تعرض رزنامتها كلّ ما هو قادم.')}>
    <section className="site-wrap ev-missing" data-reveal><a className="btn btn-gilt" href={c.calendarURL(p.id)}><Glyph name="cal" />{L('Open the calendar', 'افتح الرزنامة')}</a><a className="btn btn-ink-line" href={c.profileURL(p.id)}>{L('Parish page', 'صفحة الرعية')}</a></section></ParishSub>;
  const t = title(c, e), place = [f.name, f.town].filter(Boolean).join(L(', ', '، ')), url = c.shareURL(c.eventURL(p.id, e.id));
  const date = new Date(e.d + 'T12:00:00'), soon = e.d >= f.today ? relative(c, e) : '', more = f.upcoming.filter(x => x !== e).slice(0, 4);
  const fmt = o => new Intl.DateTimeFormat(loc(c), o).format(date);
  // where the day stands in the Church's year, and its feast if it has one
  const year = season(e.d), feastDay = feastOn(e.d);
  const rows = [['clock', L('When', 'متى'), <><time dateTime={e.d + (TIME.test(e.t || '') ? 'T' + e.t : '')}>{when(c, e)}</time>{soon ? <> <span className="wk-in">{soon}</span></> : null}{abroad() && TIME.test(e.t || '') ? <small className="ev-zone">{L('Beirut time', 'بتوقيت بيروت')}</small> : null}</>],
    ['pin', L('Where', 'أين'), <>{place}{f.address ? <small dir="auto">{f.address}</small> : null}</>],
    ['cross', L('What', 'ماذا'), kindName(L, e.kind)],
    ['star', L('In the Maronite year', 'في السنة المارونية'), <>{L(year.en, year.ar)}{feastDay ? <small className="ev-feast">{L(feastDay.en, feastDay.ar)}</small> : null}</>]];
  return <ParishSub p={p} f={f} className="ev-page" docTitle={t + ' · ' + f.name} here={L('Event', 'مناسبة')} heading={t} lede={L(`${when(c, e)}, at ${f.name}`, `${when(c, e)}، في رعية ${f.name}`)}>
    <div className="site-wrap ev-grid">
      <article className={`ev-card k-${e.kind || 'event'}`} data-reveal>
        <span className="wk-date ev-date" aria-hidden="true"><small>{fmt({ weekday: 'short' })}</small><b>{digits(c, date.getDate())}</b><small>{fmt({ month: 'short' })}</small></span>
        <dl className="ev-facts">{rows.map(([icon, k, v]) => <div key={k}><span className="ph-contact-icon"><Glyph name={icon} /></span><dt>{k}</dt><dd dir="auto">{v}</dd></div>)}</dl>
        {e.d < f.today ? <p className="ev-past">{L('This event has already taken place.', 'جرت هذه المناسبة.')}</p> : <div className="ev-actions">
          <a className="btn btn-gilt" href={icsHref(e, t, place, url)} download={icsName(t)}><Glyph name="add" />{L('Add to my calendar', 'أضف إلى رزنامتي')}</a>
          <a className="btn btn-ink-line" href={googleHref(e, t, place, url)} target="_blank" rel="noopener"><Glyph name="google" />{L('Google Calendar', 'رزنامة Google')}</a>
          <a className="btn btn-ink-line" href={directionsURL(p, d, f.visit)} target="_blank" rel="noopener"><Glyph name="route" />{L('Directions', 'الاتجاهات')}</a></div>}
        <ShareRow url={url} text={`${t} · ${when(c, e)} · ${place}`} label={L('Share this event', 'شارك هذه المناسبة')} />
      </article>
      <aside className="ev-side" data-reveal>
        <a className="rq-parish" href={c.profileURL(p.id)}><Thumb src={f.photos[0]} name={f.name} /><span><b>{f.name}</b><small>{[f.town, f.rite].filter(Boolean).join(' · ')}</small></span></a>
        {more.length ? <><h2>{L(`More at ${f.name}`, `المزيد في رعية ${f.name}`)}</h2><ul className="ev-more">{more.map((x, i) => <li key={(x.id || i) + x.d}><a href={evLink(c, p, x)}><time>{when(c, x)}</time><b dir="auto">{title(c, x)}</b></a></li>)}</ul></> : null}
        <a className="text-button" href={c.calendarURL(p.id)}>{L('The whole calendar', 'الرزنامة كاملة')}</a>
      </aside>
    </div></ParishSub>;
}

/* Pages without a parish (For parishes, a page that could not be shown): the header and motion only. */
export function PlainPage({ className, heroRef, children }) {
  const root = useRef(null), fallback = useRef(null), hero = heroRef || fallback;
  useHeroWatch(hero);
  useLayoutEffect(() => { animateHome(root.current); return () => stopHomeMotion(); }, []);
  return <div className={className} data-plain-page ref={root}>{children}</div>;
}
