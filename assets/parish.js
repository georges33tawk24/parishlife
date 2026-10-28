/* A parish's public page, in the homepage's language. Without a photograph the valley at
   night flies in to the parish's own light; with one, the photograph fills the hero. Then
   the parish's story, Mass times, calendar, ministries and clergy, requests, news,
   photographs and the way there, with its neighbours on the map. A section the parish has
   not published stays out rather than fill the page with placeholders. */
import { valleyMarkup, mountValley } from './home-valley.js';
import { mapMarkup, mountMap, locate, projection } from './home-map.js';
import { animateHome, scrollToTarget } from './home-motion.js';
import { monogram, dioceseName, digits, noun, paragraphs, watchHero } from './home.js';
import { calendarMarkup, mountCalendar, kindName, icsHref, icsAllHref, icsName, googleHref, beirutNow as beirut, ADD_ICON } from './public-calendar.js';
import { safeRichText } from './rich-text.js';

const svg = d => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const I = {
  pin: svg('<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>'),
  phone: svg('<path d="m8 3 2 5-3 2a15 15 0 0 0 7 7l2-3 5 2v3a2 2 0 0 1-2 2C10 20 4 14 3 5a2 2 0 0 1 2-2Z"/>'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>'),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/>'),
  route: svg('<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  door: svg('<path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M3 21h18M14.5 12h.01"/>'),
  access: svg('<circle cx="12" cy="4.5" r="1.8"/><path d="M6 8.5l6 1.2 6-1.2M12 9.7V15m0 0-3.5 6M12 15l3.5 6"/>'),
  cross: svg('<path d="M12 3v18M7 8h10"/>'),
  arrow: svg('<path d="M4 12h16m-6-6 6 6-6 6"/>'),
  cal: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M8 3v4m8-4v4M3.5 10h17"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  prev: svg('<path d="m15 5-7 7 7 7"/>'),
  next: svg('<path d="m9 5 7 7-7 7"/>'),
  play: svg('<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.5 3.5Z"/>'),
  share: svg('<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6m-7.6 6 7.6 3.6"/>'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  whatsapp: svg('<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7Z"/><path d="M9.2 8.6c0 3.2 3 6.2 6.2 6.2l.9-1.5-1.9-1-1 .8a5 5 0 0 1-2.5-2.5l.8-1-1-1.9Z"/>'),
  car: svg('<path d="M5 16v-5l2-4.5h10L19 11v5M3.5 16h17M5 11h14"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>'),
  star: svg('<path d="M12 3.5 14.3 9l5.7.4-4.4 3.7 1.4 5.6L12 15.6l-5 3.1 1.4-5.6L4 9.4 9.7 9Z"/>'),
  doc: svg('<path d="M7 3h7l4 4v14H7Z"/><path d="M14 3v4h4M10 12h5M10 15.5h5"/>'),
  bell: svg('<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15Z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  google: svg('<path d="M12.5 12H20a8 8 0 1 1-2.3-5.6"/>')
};
const PLURAL_AR = new Intl.PluralRules('ar');
const FORMS = {
  upcoming: { en: ['event coming up', 'events coming up'], ar: { one: 'حدث قادم', two: 'حدثان قادمان', few: 'أحداث قادمة', many: 'حدثاً قادماً', other: 'حدث قادم', zero: 'حدث قادم' } },
  ministry: { en: ['ministry', 'ministries'], ar: { one: 'خدمة', two: 'خدمتان', few: 'خدمات', many: 'خدمة', other: 'خدمة', zero: 'خدمة' } },
  post: { en: ['announcement', 'announcements'], ar: { one: 'إعلان', two: 'إعلانان', few: 'إعلانات', many: 'إعلاناً', other: 'إعلان', zero: 'إعلان' } }
};
const term = (c, n, key) => FORMS[key] ? (c.lang === 'ar' ? FORMS[key].ar[PLURAL_AR.select(n)] : FORMS[key].en[n === 1 ? 0 : 1]) : noun(c, n, key);
const hash = value => [...String(value)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
const KM = projection.ky / 111.2;   // map units per kilometre, north to south
let teardown = [];

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
/* Share a page: WhatsApp first (how Lebanon shares), copying the link, and the phone's own sheet. */
export function shareRow(c, url, text, label) {
  const { L, safe } = c, wa = 'https://wa.me/?text=' + encodeURIComponent(text + '\n' + url);
  return `<div class="share-row" data-share data-url="${safe(url)}" data-text="${safe(text)}">${label ? `<span class="share-label">${label}</span>` : ''}
    <a class="share-btn is-wa" href="${safe(wa)}" target="_blank" rel="noopener">${I.whatsapp}<span>WhatsApp</span></a>
    <button type="button" class="share-btn" data-copy-link>${I.link}<span data-copy-label>${L('Copy link', 'انسخ الرابط')}</span></button>
    <button type="button" class="share-btn" data-native-share hidden>${I.share}<span>${L('More', 'المزيد')}</span></button></div>`;
}
function shareMount(root, c) {
  root.querySelectorAll('[data-share]').forEach(box => {
    const native = box.querySelector('[data-native-share]');
    if (native && navigator.share) { native.hidden = false; native.onclick = () => navigator.share({ title: box.dataset.text, url: box.dataset.url }).catch(() => {}); }
  });
  root.querySelectorAll('[data-copy-link]').forEach(button => button.addEventListener('click', async () => {
    const url = button.dataset.url || button.closest('[data-share]')?.dataset.url || location.href, label = button.querySelector('[data-copy-label]') || button;
    try { await navigator.clipboard.writeText(url); } catch { return; }
    const was = label.textContent;
    label.textContent = c.L('Link copied', 'نُسخ الرابط'); button.classList.add('is-done');
    setTimeout(() => { label.textContent = was; button.classList.remove('is-done'); }, 2200);
  }));
}

export function parishView(c, p, d) {
  const f = facts(c, p, d), { L, safe } = c;
  const sections = [
    ['about', L('About', 'عن الرعية'), about(c, p, d, f)],
    ['times', L('Mass times', 'القداديس'), times(c, f)],
    ['calendar', L('Events', 'المناسبات'), calendar(c, p, f)],
    ['ministries', L('Ministries', 'الخدمات'), ministries(c, p, d)],
    ['sacraments', L('Requests', 'الطلبات'), requests(c, p, f)],
    ['updates', L('News', 'الأخبار'), news(c, d)],
    ['gallery', L('Photos', 'الصور'), gallery(c, f)],
    ['contact', L('Visit', 'الزيارة'), visit(c, p, d, f)]
  ].filter(s => s[2]);
  return `<div class="parish" data-parish-page>
    ${hero(c, p, d, f)}
    <nav class="ph-nav" data-ph-nav aria-label="${safe(L('On this page', 'في هذه الصفحة'))}"><div class="site-wrap ph-nav-inner">
      <a class="ph-nav-name" href="#top" data-ph-top>${monogram(f.name)}<span>${safe(f.name)}</span></a>
      <ul>${sections.map(([id, label]) => `<li><a href="#${id}" data-ph-link="${id}">${safe(label)}</a></li>`).join('')}</ul><span class="ph-nav-ink" aria-hidden="true"></span></div></nav>
    ${sections.map(s => s[2]).join('')}
    ${nearby(c, p, f)}
    <dialog class="ph-lightbox" data-lightbox aria-label="${safe(L('Photographs', 'الصور'))}"><figure><img alt=""><figcaption></figcaption></figure>
      <button type="button" class="icon-button lb-close" data-lb-close aria-label="${safe(L('Close', 'إغلاق'))}">${I.close}</button>
      <button type="button" class="icon-button lb-prev" data-lb-step="-1" aria-label="${safe(L('Previous photograph', 'الصورة السابقة'))}">${I.prev}</button>
      <button type="button" class="icon-button lb-next" data-lb-step="1" aria-label="${safe(L('Next photograph', 'الصورة التالية'))}">${I.next}</button></dialog>
  </div>`;
}

/* ---------- hero ---------- */
function hero(c, p, d, f) {
  const { L, safe } = c, mass = nextMass(f), next = f.upcoming.find(e => e !== mass), month = f.upcoming.filter(e => e.d < addDays(f.today, 31)).length;
  const fe = feast(c, f), live = https(f.visit.livestream), massTime = mass && massWhen(c, mass);
  const stat = (n, key) => n ? `<li><b data-count="${n}">${c.number(n)}</b><span>${term(c, n, key)}</span></li>` : '';
  const stats = [stat(month, 'upcoming'), stat((d.ministries || []).length, 'ministry'), stat((d.posts || []).length, 'post')].join('');
  const art = f.photos[0] ? `<div class="ph-photo"><img src="${safe(f.photos[0])}" alt="" decoding="async" fetchpriority="high"></div>` : valleyMarkup();
  return `<section class="hero ph" id="top" data-hero ${f.photos[0] ? 'data-photo' : 'data-push="1.22"'} aria-labelledby="ph-title">
    <div class="hero-art" data-scene>${art}</div><div class="hero-shade" aria-hidden="true"></div>
    <div class="site-wrap hero-inner ph-inner">
      <nav class="ph-crumbs" aria-label="${safe(L('Breadcrumb', 'مسار التنقّل'))}" data-hero-rise><a href="public.html#directory">${L('All parishes', 'كل الرعايا')}</a><span aria-hidden="true">/</span><span aria-current="page">${safe(f.name)}</span></nav>
      ${f.town || f.rite ? `<p class="ph-meta" data-hero-rise>${I.pin}<span>${[f.town, f.rite].filter(Boolean).map(safe).join(' · ')}</span></p>` : ''}
      ${fe && fe.days <= 40 ? `<p class="ph-feast" data-hero-rise>${I.star}<span>${fe.days === 0 ? L(`Today: <bdi>${safe(fe.name)}</bdi>`, `اليوم: <bdi>${safe(fe.name)}</bdi>`) : `<bdi>${safe(fe.name)}</bdi> · ${safe(digits(c, fe.day))} · ${safe(digits(c, new Intl.RelativeTimeFormat(c.lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' }).format(fe.days, 'day')))}`}</span></p>` : ''}
      <h1 class="hero-title ph-title" id="ph-title">${safe(f.name)}</h1>
      ${f.other ? `<p class="ph-other" lang="${c.lang === 'ar' ? 'en' : 'ar'}" dir="${c.lang === 'ar' ? 'ltr' : 'rtl'}" data-hero-rise>${safe(f.other)}</p>` : ''}
      <p class="hero-lede" data-hero-rise dir="auto">${f.welcome ? c.htmlText(f.welcome) : safe(plainLede(c, f))}</p>
      ${mass ? `<a class="ph-mass" href="${safe(evLink(c, p, mass))}" data-hero-rise><span class="lamp" aria-hidden="true"></span><span class="ph-mass-label">${L('Next Mass', 'القداس التالي')}</span>
        <b>${safe(massTime.when)}</b>${massTime.soon ? `<span class="ph-mass-in">${safe(massTime.soon)}</span>` : ''}${abroad() && TIME.test(mass.t || '') ? `<small>${L('Beirut time', 'بتوقيت بيروت')}</small>` : ''}</a>` : ''}
      <div class="ph-actions" data-hero-rise>
        ${f.open ? `<a class="btn btn-gilt" href="#sacraments" data-ph-jump>${L('Ask the parish office', 'اطلب من مكتب الرعية')}</a>` : ''}
        <a class="btn btn-line" href="#calendar" data-ph-jump>${I.cal}${L('Events and calendar', 'المناسبات والرزنامة')}</a>
        ${live ? `<a class="btn btn-line" href="${safe(live)}" target="_blank" rel="noopener">${I.play}${L('Watch Mass live', 'شاهد القداس مباشرة')}</a>` : ''}
        ${f.phone ? `<a class="btn btn-line" href="tel:${safe(f.phone)}">${I.phone}<bdi>${safe(d.parish.phone)}</bdi></a>` : ''}
      </div>
      ${stats ? `<ul class="hero-facts ph-facts" data-hero-rise>${stats}</ul>` : ''}
      <div data-hero-rise>${shareRow(c, c.shareURL(c.profileURL(p.id)), L(`${f.name}${f.town ? ', ' + f.town : ''} on ParishLife`, `رعية ${f.name}${f.town ? '، ' + f.town : ''} على ParishLife`), L('Share', 'شارك'))}</div>
    </div>
    ${next ? `<a class="ph-next" href="${safe(evLink(c, p, next))}"><span class="ph-next-label"><span class="lamp" aria-hidden="true"></span>${L('Next at the parish', 'القادم في الرعية')}</span>
      <strong dir="auto">${safe(title(c, next))}</strong><time datetime="${safe(next.d)}${next.t ? 'T' + safe(next.t) : ''}">${safe(when(c, next))}</time>${relative(c, next) ? `<span class="ph-next-in">${safe(relative(c, next))}</span>` : ''}</a>` : ''}
    <p class="hero-tip" data-hero-tip role="status" hidden></p>
  </section>`;
}
const addDays = (key, n) => { const d = new Date(key + 'T12:00:00'); d.setDate(d.getDate() + n); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };

/* ---------- about ---------- */
function about(c, p, d, f) {
  const { L, safe } = c;
  const art = f.photos[1] || f.photos[0];
  const fe = feast(c, f);
  const rows = [[L('Town', 'البلدة'), f.town], [L('Rite', 'الطقس'), f.rite], [L('Diocese', 'الأبرشية'), f.diocese],
    [L('Feast day', 'عيد الرعية'), fe && `${String(f.visit.feastName || '').trim() ? fe.name + ' · ' : ''}${digits(c, fe.day)}`]].filter(r => r[1]);
  return `<section class="ph-about" id="about" aria-labelledby="about-title"><div class="site-wrap ph-about-grid">
    <figure class="ph-arch${art ? '' : ' is-night'}" data-reveal>${art ? `<img src="${safe(art)}" alt="${safe(f.name)}" loading="lazy" decoding="async" data-parallax="-6">` : `${monogram(f.name)}<span class="ph-arch-light" aria-hidden="true"></span>`}</figure>
    <div class="ph-about-copy" ${f.history ? 'data-lit' : ''}>
      <h2 id="about-title">${L(`About ${safe(f.name)}`, `عن رعية ${safe(f.name)}`)}</h2>
      ${f.history ? `<div dir="auto">${paragraphs(c, f.history)}</div>` : `<p class="ph-quiet">${L('The parish office has not published the parish’s story yet. Its Mass times, news and calendar appear here as soon as they are shared.', 'لم ينشر مكتب الرعية حكايتها بعد. تظهر هنا مواعيد القداديس والأخبار والرزنامة فور نشرها.')}</p>`}
      ${rows.length ? `<dl class="ph-dl" data-reveal>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${safe(v)}</dd></div>`).join('')}</dl>` : ''}
    </div></div></section>`;
}

/* ---------- Mass times ---------- */
function times(c, f) {
  const { L, safe } = c, masses = f.upcoming.filter(e => e.kind === 'mass' && e.d < addDays(f.today, 7));
  const visitRows = [['confessionTimes', L('Confession', 'الاعتراف'), I.cross], ['officeHours', L('Parish office', 'مكتب الرعية'), I.door]].filter(([k]) => String(f.visit[k] || '').trim());
  const live = https(f.visit.livestream);
  if (!f.massTimes && !masses.length && !visitRows.length && !live) return '';
  return `<section class="ph-times" id="times" aria-labelledby="times-title"><div class="site-wrap ph-times-grid">
    <header class="sec-head" data-reveal><h2 id="times-title">${L('Mass times', 'مواعيد القداديس')}</h2><p>${L('As the parish office publishes them. On feast days, the calendar shows any change.', 'كما ينشرها مكتب الرعية. في الأعياد تظهر أي تغييرات في الرزنامة.')}</p></header>
    <div class="ph-times-body">
      ${f.massTimes ? `<div class="ph-board" data-reveal><span class="ph-board-mark" aria-hidden="true">${I.cross}</span><div class="ph-board-text" dir="auto">${c.htmlText(f.massTimes)}</div></div>` : ''}
      ${masses.length ? `<div class="ph-week-masses" data-reveal><h3>${L('Masses in the next seven days', 'القداديس في الأيام السبعة المقبلة')}</h3><ul>${masses.map(e => `<li data-reveal-item><time>${safe(new Intl.DateTimeFormat(loc(c), { weekday: 'short', day: 'numeric' }).format(new Date(e.d + 'T12:00:00')))}</time><b>${safe(digits(c, e.t || ''))}</b><span dir="auto">${safe(title(c, e))}</span></li>`).join('')}</ul></div>` : ''}
      ${visitRows.length || live ? `<dl class="ph-hours" data-reveal>${visitRows.map(([k, label, icon]) => `<div>${icon}<dt>${label}</dt><dd dir="auto">${c.htmlText(f.visit[k])}</dd></div>`).join('')}
        ${live ? `<div>${I.play}<dt>${L('Livestream', 'البث المباشر')}</dt><dd><a href="${safe(live)}" target="_blank" rel="noopener">${L('Watch the parish’s Masses online', 'شاهد قداديس الرعية عبر الإنترنت')}</a></dd></div>` : ''}</dl>` : ''}
    </div></div></section>`;
}

/* ---------- calendar ---------- */
/* Every parish has its events and calendar: the next celebrations as cards, all of them in one
   calendar file, and the month. Before anything is published, the calendar is there and says so. */
function calendar(c, p, f) {
  const { L, safe } = c, next = f.upcoming.slice(0, 4), loc = c.lang === 'ar' ? 'ar-LB' : 'en-GB';
  const place = [f.name, f.town].filter(Boolean).join(L(', ', '، '));
  const card = e => {
    const t = title(c, e), d = new Date(e.d + 'T12:00:00');
    return `<li class="wk-ev k-${safe(e.kind || 'event')}" data-reveal-item>
      <a class="wk-ev-link" href="${safe(evLink(c, p, e))}">
        <span class="wk-date" aria-hidden="true"><small>${safe(new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(d))}</small><b>${safe(digits(c, d.getDate()))}</b><small>${safe(new Intl.DateTimeFormat(loc, { month: 'short' }).format(d))}</small></span>
        <span class="wk-body"><span class="wk-meta">${e.t ? `<time>${safe(digits(c, e.t))}</time>` : ''}<span class="wk-kind">${safe(kindName(L, e.kind))}</span>${relative(c, e) ? `<span class="wk-in">${safe(relative(c, e))}</span>` : ''}</span>
          <strong dir="auto">${safe(t)}</strong><span class="sr-only">${safe(when(c, e))}</span></span></a>
      <a class="wk-add" href="${icsHref(e, t, place, e.id ? c.shareURL(c.eventURL(p.id, e.id)) : '')}" download="${safe(icsName(t))}" aria-label="${safe(L(`Add ${t} to my calendar`, `أضف «${t}» إلى رزنامتي`))}" title="${safe(L('Add to my calendar', 'أضف إلى رزنامتي'))}">${ADD_ICON}</a></li>`;
  };
  return `<section class="ph-cal" id="calendar" aria-labelledby="cal-title"><div class="site-wrap">
    <header class="sec-head" data-reveal><h2 id="cal-title">${L('Events and calendar', 'المناسبات والرزنامة')}</h2><p>${L('Masses, celebrations and gatherings the parish has published. Save any of them to your own calendar.', 'القداديس والاحتفالات واللقاءات التي نشرتها الرعية. احفظ أيّاً منها في رزنامتك.')}</p></header>
    ${next.length ? `<div class="ph-up" data-reveal><div class="ph-up-head"><h3>${L('Coming up', 'القادم')}</h3>
        <a class="btn btn-ink-line btn-small" href="${icsAllHref(f.upcoming, e => title(c, e), place, e => e.id ? c.shareURL(c.eventURL(p.id, e.id)) : '')}" download="${safe(icsName(f.name))}">${ADD_ICON}${L('Add all to my calendar', 'أضف الكل إلى رزنامتي')}</a></div>
        <ul class="wk-list">${next.map(card).join('')}</ul></div>`
      : `<div class="ph-cal-empty" data-reveal><span class="lamp is-unlit" aria-hidden="true"></span><p>${f.events.length ? L('Nothing is coming up in the parish calendar yet. Past events are still in the calendar below.', 'لا شيء قادم في رزنامة الرعية بعد. ما زالت الأحداث السابقة في الرزنامة أدناه.') : L('The parish has not published any events yet. Masses, feasts and gatherings appear here as soon as the parish office adds them to its calendar.', 'لم تنشر الرعية أي مناسبات بعد. تظهر القداديس والأعياد واللقاءات هنا فور إضافتها إلى رزنامة مكتب الرعية.')}</p></div>`}
    <div class="ph-cal-month" data-reveal>${calendarMarkup(L)}</div>
    ${follow(c, p, f)}
    <p class="ph-cal-more"><a class="text-button" href="${safe(c.calendarURL(p.id))}">${L('Open the calendar on its own page', 'افتح الرزنامة في صفحة مستقلّة')}</a></p></div></section>`;
}

/* Follow the parish: its calendar in the visitor's own (kept up to date), its WhatsApp channel,
   and following it from a ParishLife account. */
function follow(c, p, f) {
  const { L, safe } = c, webcal = c.feedURL(p.id, 'webcal:'), feed = c.feedURL(p.id), whatsapp = https(f.visit.whatsapp);
  return `<div class="ph-follow" data-reveal><span class="ph-follow-mark" aria-hidden="true">${I.bell}</span>
    <div class="ph-follow-copy"><h3>${L('Never miss a celebration', 'لا تفوّت أيّ احتفال')}</h3>
      <p>${L(`Subscribe once and every Mass and event ${safe(f.name)} publishes appears in your phone’s calendar, and stays up to date.`, `اشترك مرّة واحدة فتظهر كلّ القداديس والمناسبات التي تنشرها رعية ${safe(f.name)} في رزنامة هاتفك، وتبقى محدّثة.`)}</p></div>
    <div class="ph-follow-actions">
      <a class="btn btn-gilt btn-small" href="${safe(webcal)}">${I.cal}${L('Subscribe in my calendar', 'اشترك في رزنامتي')}</a>
      <a class="btn btn-ink-line btn-small" href="${safe('https://calendar.google.com/calendar/render?cid=' + encodeURIComponent(feed))}" target="_blank" rel="noopener">${I.google}${L('Google Calendar', 'رزنامة Google')}</a>
      ${whatsapp ? `<a class="btn btn-ink-line btn-small is-wa" href="${safe(whatsapp)}" target="_blank" rel="noopener">${I.whatsapp}${L('Follow on WhatsApp', 'تابع عبر واتساب')}</a>` : ''}
    </div>
    <p class="ph-follow-more">${L('Another calendar app?', 'تطبيق رزنامة آخر؟')} <button type="button" class="text-button" data-copy-link data-url="${safe(feed)}"><span data-copy-label>${L('Copy the calendar address', 'انسخ عنوان الرزنامة')}</span></button>
      · <a class="text-button" href="${safe('index.html?parish=' + encodeURIComponent(p.id) + '#/account')}">${L('Follow in your ParishLife account', 'تابع الرعية من حسابك على ParishLife')}</a></p></div>`;
}

/* ---------- ministries and clergy ---------- */
function ministries(c, p, d) {
  const { L, safe } = c, list = d.ministries || [], clergy = d.clergy || [];
  if (!list.length && !clergy.length) return '';
  const ask = g => c.requestURL(p.id, 'ministry') + '&ministry=' + encodeURIComponent(g.name);
  return `<section class="ph-min" id="ministries" aria-labelledby="min-title"><div class="site-wrap">
    <header class="sec-head" data-reveal><h2 id="min-title">${list.length ? L('Ministries', 'الخدمات') : L('Clergy', 'الإكليروس')}</h2><p>${list.length ? L('The groups that keep the parish alive. Each one welcomes new members; ask the parish office about joining.', 'الجماعات التي تُحيي الرعية. كلّ منها يرحّب بأعضاء جدد؛ استفسر من مكتب الرعية عن الانضمام.') : L('Contact the clergy through the parish office.', 'تواصل مع الكهنة عبر مكتب الرعية.')}</p></header>
    ${clergy.length ? `<ul class="ph-clergy">${clergy.map(m => `<li data-reveal-item><span class="arch-thumb">${monogram(m.name)}</span><span><b>${safe(m.name)}</b><small>${safe(m.title || '')}</small></span></li>`).join('')}</ul>` : ''}
    ${list.length ? `<ul class="ph-cards">${list.map(g => {
      const name = c.lang === 'ar' ? g.nameAr || g.name : g.name || g.nameAr;
      return `<li data-reveal-item><article class="ph-card" data-tilt><span class="ph-card-arch">${monogram(name)}</span>
        <h3 dir="auto">${safe(name)}</h3>${g.description ? `<p dir="auto">${safe(g.description)}</p>` : ''}
        ${g.responsible ? `<p class="ph-led">${L('Led by', 'بإشراف')} <b>${safe(g.responsible)}</b></p>` : ''}
        <a class="ph-card-link" href="${safe(ask(g))}">${L('Ask about joining', 'استفسر عن الانضمام')}${I.arrow}<span class="sr-only">: ${safe(name)}</span></a></article></li>`;
    }).join('')}</ul>` : ''}
  </div></section>`;
}

/* ---------- requests ---------- */
function requests(c, p, f) {
  if (!f.open) return '';
  const { L, safe } = c;
  const arch = ([kind, art, t, sub]) => `<li data-reveal-item><a class="arch" href="${safe(c.requestURL(p.id, kind))}" data-tilt><span class="arch-icon">${c.icon(art)}</span><strong>${L(...t)}</strong><small>${L(...sub)}</small></a></li>`;
  const wide = ([kind, art, t, sub]) => `<a class="ask-wide" href="${safe(c.requestURL(p.id, kind))}" data-reveal-item><span class="arch-icon">${c.icon(art)}</span><span><strong>${L(...t)}</strong><small>${L(...sub)}</small></span>${I.arrow}</a>`;
  return `<section class="ask ph-ask" id="sacraments" aria-labelledby="ask-title"><div class="site-wrap">
    <header class="sec-head" data-reveal><h2 id="ask-title">${L(`Ask ${safe(f.name)}`, `اطلب من رعية ${safe(f.name)}`)}</h2><p dir="auto">${f.intro ? c.htmlText(f.intro) : L('Baptisms, weddings, certificates and more. Send your request straight to the parish office without an account, and follow it with a private link.', 'معموديات وأكاليل وشهادات وغيرها. أرسل طلبك مباشرة إلى مكتب الرعية من دون حساب، وتابعه برابط خاص.')}</p></header>
    ${bring(c, f)}
    <ul class="arcade">${c.REQUESTS.map(arch).join('')}</ul>
    <div class="ask-more">${c.OTHER_REQUESTS.map(wide).join('')}</div>
  </div></section>`;
}

/* What to bring for a baptism, a wedding or a certificate, as the parish office writes it. */
function bring(c, f, side = false) {
  const notes = String(f.visit.sacramentNotes || '').trim();
  if (!notes) return '';
  return `<div class="ph-bring${side ? ' is-side' : ''}"${side ? '' : ' data-reveal'}><span class="ph-bring-mark" aria-hidden="true">${I.doc}</span>
    <div><h3>${c.L('Before you ask: what to bring', 'قبل أن تطلب: ما الذي تحضره')}</h3><div class="ph-bring-text" dir="auto">${c.htmlText(notes)}</div></div></div>`;
}

/* ---------- news ---------- */
function news(c, d) {
  const { L, safe } = c, posts = (d.posts || []).filter(x => x.title || x.body).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  if (!posts.length) return '';
  const body = text => /<[a-z][\s\S]*>/i.test(text || '') ? safeRichText(text) : c.htmlText(text || '');
  return `<section class="news ph-news" id="updates" aria-labelledby="news-title"><div class="site-wrap">
    <header class="sec-head" data-reveal><h2 id="news-title">${L('From the parish', 'من الرعية')}</h2><p>${L('Announcements published by the parish office.', 'إعلانات ينشرها مكتب الرعية.')}</p></header>
    <div class="news-list">${posts.map((post, i) => `<article class="news-item${i === 0 ? ' is-lead' : ''}" data-reveal-item>
      ${c.publishedDate(post.at) ? `<time datetime="${safe(post.at)}">${safe(c.publishedDate(post.at))}</time>` : ''}
      ${post.title ? `<h3 dir="auto">${safe(post.title)}</h3>` : ''}<div class="published-body" dir="auto">${body(post.body)}</div></article>`).join('')}</div>
  </div></section>`;
}

/* ---------- photographs ---------- */
function gallery(c, f) {
  if (f.photos.length < 2) return '';
  const { L, safe } = c;
  return `<section class="ph-gallery" id="gallery" aria-labelledby="gal-title"><div class="site-wrap">
    <header class="sec-head" data-reveal><h2 id="gal-title">${L('Photographs', 'صور الرعية')}</h2><p>${L('Published by the parish office.', 'ينشرها مكتب الرعية.')}</p></header>
    <ul class="ph-photos">${f.photos.map((src, i) => `<li data-reveal-item><button type="button" class="ph-photo-btn" data-lb-open="${i}" aria-label="${safe(L(`Open photograph ${i + 1}`, `افتح الصورة ${i + 1}`))}"><img src="${safe(src)}" alt="" loading="lazy" decoding="async"></button></li>`).join('')}</ul>
  </div></section>`;
}

/* ---------- visit ---------- */
const directionsURL = (p, d, v) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(
  /^-?\d+(\.\d+)?$/.test(String(v.latitude || '').trim()) && /^-?\d+(\.\d+)?$/.test(String(v.longitude || '').trim()) ? `${v.latitude},${v.longitude}` : [d.parish.name || p.name, d.parish.address, p.town, 'Lebanon'].filter(Boolean).join(' '));
function visit(c, p, d, f) {
  const { L, safe } = c, v = f.visit, directions = directionsURL(p, d, v);
  const website = /^https:\/\/[^\s]+$/.test(v.website || '') ? v.website : '';
  const email = /^[^\s@]+@[^\s@]+$/.test(v.email || '') ? v.email : '';
  const rows = [
    f.address && [I.pin, L('Address', 'العنوان'), safe(f.address)],
    f.phone && [I.phone, L('Phone', 'الهاتف'), `<a href="tel:${safe(f.phone)}"><bdi>${safe(d.parish.phone)}</bdi></a>`],
    email && [I.mail, L('Email', 'البريد الإلكتروني'), `<a href="mailto:${safe(email)}">${safe(email)}</a>`],
    website && [I.globe, L('Website', 'الموقع'), `<a href="${safe(website)}" target="_blank" rel="noopener">${safe(website.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>`],
    String(v.officeHours || '').trim() && [I.door, L('Office hours', 'ساعات المكتب'), c.htmlText(v.officeHours)]
  ].filter(Boolean);
  /* Plan your visit: what a newcomer wonders before coming for the first time. */
  const plan = [[I.cross, L('What to expect', 'ماذا تتوقّع'), v.expect], [I.globe, L('Languages and rite', 'اللغات والطقس'), v.languages],
    [I.car, L('Parking', 'ركن السيارة'), v.parking], [I.access, L('Accessibility', 'إمكانية الوصول'), v.accessibility]].filter(r => String(r[2] || '').trim());
  const where = f.at ? (f.at.exact ? L(`${f.name} on the map of Lebanon.`, `${f.name} على خريطة لبنان.`) : L(`Shown at the centre of ${f.town}. The parish office can add the church’s exact position to its public profile.`, `تظهر في وسط ${f.town}. يستطيع مكتب الرعية إضافة موقع الكنيسة الدقيق إلى صفحتها العامة.`)) : '';
  return `<section class="ph-visit" id="contact" aria-labelledby="visit-title"><div class="site-wrap ph-visit-grid">
    <div class="ph-visit-copy">
      <header class="sec-head" data-reveal><h2 id="visit-title">${L(`Visit ${safe(f.name)}`, `زيارة رعية ${safe(f.name)}`)}</h2>${f.contact ? `<p dir="auto">${c.htmlText(f.contact)}</p>` : ''}</header>
      ${rows.length ? `<dl class="ph-contact">${rows.map(([icon, k, val]) => `<div data-reveal-item><span class="ph-contact-icon">${icon}</span><dt>${k}</dt><dd dir="auto">${val}</dd></div>`).join('')}</dl>`
        : `<p class="ph-quiet" data-reveal>${f.massTimes || plan.length ? '' : L('Mass times and contact details have not been published yet. ', 'لم تُنشر مواعيد القداديس ومعلومات التواصل بعد. ')}${f.open ? L('You can still reach the parish office through any of the requests above.', 'يمكنك مع ذلك مراسلة مكتب الرعية عبر أيّ من الطلبات أعلاه.') : ''}</p>`}
      ${plan.length ? `<div class="ph-plan" data-reveal><h3>${L('Plan your visit', 'خطّط لزيارتك')}</h3><ul>${plan.map(([icon, k, val]) => `<li data-reveal-item><span class="ph-contact-icon">${icon}</span><b>${k}</b><span dir="auto">${c.htmlText(val)}</span></li>`).join('')}</ul></div>` : ''}
      <div class="ph-visit-actions" data-reveal><a class="btn btn-gilt" href="${safe(directions)}" target="_blank" rel="noopener">${I.route}${L('Directions', 'الاتجاهات')}</a>
        ${f.open ? `<a class="btn btn-ink-line" href="${safe(c.requestURL(p.id, 'appointment'))}">${I.door}${L('Ask for an appointment', 'اطلب موعداً')}</a>` : ''}</div>
    </div>
    ${f.at ? `<div class="ph-map" data-reveal>${mapMarkup(L)}<p class="ph-map-note">${safe(where)}</p></div>` : ''}
  </div></section>`;
}

/* ---------- neighbours ---------- */
function neighbours(c, p, f) {
  const others = c.directory.filter(x => x.id !== p.id);
  if (!others.length) return [];
  const rows = others.map(x => { const at = locate(x, c.details.get(x.id)); return { x, km: at && f.at ? Math.hypot(at.x - f.at.x, at.y - f.at.y) / KM : null }; });
  return rows.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity) || (a.x.diocese === p.diocese ? -1 : 0) - (b.x.diocese === p.diocese ? -1 : 0)).slice(0, 3);
}
function nearby(c, p, f) {
  const { L, safe } = c, rows = neighbours(c, p, f);
  if (!rows.length) return '';
  return `<section class="ph-near" aria-labelledby="near-title"><div class="site-wrap">
    <div class="ph-near-head" data-reveal><h2 id="near-title">${L('Parishes nearby', 'رعايا قريبة')}</h2><a class="text-button" href="public.html#directory">${L('Every parish on the map', 'كل الرعايا على الخريطة')}</a></div>
    <ul class="ph-near-list">${rows.map(({ x, km }) => {
      const photo = c.parishPhotos(c.details.get(x.id))[0];
      return `<li data-reveal-item><a href="${safe(c.profileURL(x.id))}"><span class="arch-thumb">${photo ? `<img src="${safe(photo)}" alt="" loading="lazy">` : monogram(c.parishName(x))}</span>
        <span><b>${safe(c.parishName(x))}</b><small>${safe(c.townName(x))}${km !== null ? ` · ${km < 1 ? L('under 1 km', 'أقل من ١ كم') : L(`about ${c.number(Math.round(km))} km`, `نحو ${c.number(Math.round(km))} كم`)}` : ''}</small></span>${I.arrow}</a></li>`;
    }).join('')}</ul></div></section>`;
}

/* ---------- behaviour ---------- */
export function mountParish(root, c, p, d) {
  unmountParish();
  const page = root.querySelector('[data-parish-page]');
  if (!page) return;
  const f = facts(c, p, d), hero = page.querySelector('[data-hero]');
  teardown.push(watchHero(hero));
  /* The valley: one light, this parish's, at a village of its own; the camera flies in to it. */
  const host = page.querySelector('[data-scene]');
  if (host?.querySelector('[data-valley]')) {
    const valley = mountValley(host, [{ id: p.id, name: f.name, town: f.town }], { start: hash(p.id) % 4, label: true, tip: page.querySelector('[data-hero-tip]'), onPick: () => scrollToTarget(page.querySelector('#contact')) });
    const aim = () => {
      const light = host.querySelector('.valley-light'), box = valley.valley.getBoundingClientRect();
      if (!light || light.hidden || !box.width) return;
      const r = light.getBoundingClientRect();
      valley.valley.style.transformOrigin = `${((r.left + r.width / 2 - box.left) / box.width * 100).toFixed(2)}% ${((r.top + r.height / 2 - box.top) / box.height * 100).toFixed(2)}%`;
    };
    aim();
    page._valley = valley;
    teardown.push(() => valley.destroy());
  }
  const removeNav = navMount(page);
  teardown.push(removeNav);
  page.querySelectorAll('[data-ph-jump], [data-ph-top]').forEach(a => a.addEventListener('click', e => {
    const target = a.dataset.phTop !== undefined ? page.querySelector('#top') : page.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault(); scrollToTarget(target, 130); history.replaceState(null, '', a.getAttribute('href'));
  }));
  if (page.querySelector('[data-pcal]')) teardown.push(mountCalendar(page, d.events || [], { L: c.L, lang: c.lang, place: [f.name, f.town].filter(Boolean).join(', '), link: e => c.eventURL(p.id, e.id) }));
  shareMount(page, c);
  mapMount(page, c, p, f);
  lightboxMount(page, c, f);
  animateHome(page, { onDawn: () => page._valley?.loadDawn() });
}
export function unmountParish() { teardown.forEach(fn => fn?.()); teardown = []; }

/* The section bar follows the reader; its gold ink slides under the section in view. */
function navMount(page) {
  const nav = page.querySelector('[data-ph-nav]'), links = [...nav.querySelectorAll('[data-ph-link]')], ink = nav.querySelector('.ph-nav-ink');
  const list = nav.querySelector('ul');
  let current = null;
  const place = link => {
    if (!link) { ink.style.opacity = '0'; return; }
    const r = link.getBoundingClientRect(), base = nav.querySelector('.ph-nav-inner').getBoundingClientRect();
    ink.style.opacity = '1';
    ink.style.width = r.width + 'px';
    ink.style.transform = `translateX(${r.left - base.left}px)`;
  };
  const move = link => {
    links.forEach(a => a.toggleAttribute('aria-current', a === link));
    place(link);
    if (!link) return;
    const r = link.getBoundingClientRect(), lr = list.getBoundingClientRect();
    if (r.left < lr.left || r.right > lr.right) list.scrollTo({ left: list.scrollLeft + (r.left - lr.left) - 24, behavior: 'smooth' });
  };
  list.addEventListener('scroll', () => place(current), { passive: true });
  links.forEach(a => a.addEventListener('click', e => {
    const target = page.querySelector('#' + a.dataset.phLink);
    if (!target) return;
    e.preventDefault(); scrollToTarget(target, 130); history.replaceState(null, '', '#' + a.dataset.phLink);
  }));
  const sections = links.map(a => page.querySelector('#' + a.dataset.phLink)).filter(Boolean);
  const pick = () => {
    const line = innerHeight * 0.35;
    let best = null;
    for (const s of sections) if (s.getBoundingClientRect().top <= line) best = s;
    const link = best ? links.find(a => a.dataset.phLink === best.id) : null;
    nav.classList.toggle('is-stuck', nav.getBoundingClientRect().top <= parseFloat(getComputedStyle(nav).top) + 1);
    if (link !== current) { current = link; move(link); }
  };
  addEventListener('scroll', pick, { passive: true });
  addEventListener('resize', pick);
  requestAnimationFrame(pick);
  return () => { removeEventListener('scroll', pick); removeEventListener('resize', pick); };
}

function mapMount(page, c, p, f) {
  const figure = page.querySelector('.ph-map [data-lebanon-map]');
  if (!figure || !f.at) return;
  const items = c.directory.map(x => ({ x, at: x.id === p.id ? f.at : locate(x, c.details.get(x.id)) })).filter(r => r.at)
    .map(({ x, at }) => ({ id: x.id, ...at, name: c.parishName(x), town: c.townName(x) }));
  const card = item => item.id === p.id ? `<div><h3>${c.safe(item.name)}</h3><p>${c.safe(item.town)}</p></div>`
    : `<button type="button" class="icon-button card-close" data-card-close aria-label="${c.safe(c.L('Close', 'إغلاق'))}">${I.close}</button><div><h3>${c.safe(item.name)}</h3><p>${c.safe(item.town)}</p><div class="card-actions"><a class="btn btn-gilt btn-small" href="${c.safe(c.profileURL(item.id))}">${c.L('Parish page', 'صفحة الرعية')}</a></div></div>`;
  const map = mountMap(figure, items, { L: c.L, card, onChoose: () => {} });
  map.filter([p.id]);
  let zoomed = false;
  const zoom = () => { if (zoomed) return; zoomed = true; map.focus([p.id]); setTimeout(() => map.mark(p.id), 950); };
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(e => { if (e.some(x => x.isIntersecting)) { io.disconnect(); setTimeout(zoom, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1100); } }, { rootMargin: '0px 0px -30% 0px' }) : null;
  io ? io.observe(figure) : zoom();
  teardown.push(() => { io?.disconnect(); map.destroy(); });
}

function lightboxMount(page, c, f) {
  const dialog = page.querySelector('[data-lightbox]'), buttons = page.querySelectorAll('[data-lb-open]');
  if (!dialog || !buttons.length || typeof dialog.showModal !== 'function') return;
  let at = 0;
  const img = dialog.querySelector('img'), caption = dialog.querySelector('figcaption');
  const show = i => { at = (i + f.photos.length) % f.photos.length; img.src = f.photos[at]; caption.textContent = c.L(`${at + 1} of ${f.photos.length}`, `${c.number(at + 1)} من ${c.number(f.photos.length)}`); };
  buttons.forEach(b => b.addEventListener('click', () => { show(Number(b.dataset.lbOpen)); dialog.showModal(); }));
  dialog.querySelectorAll('[data-lb-step]').forEach(b => b.addEventListener('click', () => show(at + Number(b.dataset.lbStep) * (c.lang === 'ar' ? -1 : 1))));
  dialog.querySelector('[data-lb-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') show(at + ((e.key === 'ArrowRight') === (c.lang !== 'ar') ? 1 : -1)); });
}

/* ---------- the parish's other pages: a request, the full calendar ---------- */
const subHero = (c, p, f, here, heading, lede) => `<section class="sub-hero" data-hero aria-labelledby="sub-title">
    <div class="sub-art" aria-hidden="true"><img src="assets/images/valley/valley-wide-dusk-far.webp" alt=""><img src="assets/images/valley/valley-wide-dusk-near.webp" alt=""></div>
    <div class="site-wrap sub-inner">
      <nav class="ph-crumbs" aria-label="${c.safe(c.L('Breadcrumb', 'مسار التنقّل'))}" data-hero-rise><a href="public.html#directory">${c.L('All parishes', 'كل الرعايا')}</a><span aria-hidden="true">/</span><a href="${c.safe(c.profileURL(p.id))}">${c.safe(f.name)}</a><span aria-hidden="true">/</span><span aria-current="page">${c.safe(here)}</span></nav>
      <h1 class="hero-title" id="sub-title">${heading}</h1>${lede ? `<p data-hero-rise>${lede}</p>` : ''}
    </div></section>`;

export function requestView(c, p, d, kind) {
  const f = facts(c, p, d), { L, safe } = c;
  const ministry = new URLSearchParams(location.search).get('ministry') || '';
  const all = [...c.REQUESTS, ...c.OTHER_REQUESTS, ['appointment', 'calendar', ['Appointment', 'موعد'], ['With the parish office', 'مع مكتب الرعية']], ['ministry', 'church', ['Joining a ministry', 'الانضمام إلى خدمة'], ['Ask how to take part', 'اسأل عن المشاركة']]];
  const chosen = all.some(r => r[0] === kind) ? kind : 'certificate';
  const steps = [[L('The office reads it', 'يقرأه المكتب'), L('Your request goes only to this parish’s office.', 'يصل طلبك إلى مكتب هذه الرعية فقط.')],
    [L('It answers or asks for documents', 'يجيب أو يطلب مستندات'), L('Follow each step with your private link.', 'تابع كل خطوة برابطك الخاص.')],
    [L('You collect what you asked for', 'تستلم ما طلبته'), L('At the parish, or as a secure download when it is offered.', 'من الرعية، أو بتنزيل آمن عند توفّره.')]];
  return `<div class="parish-sub" data-parish-sub>
    ${subHero(c, p, f, L('Request', 'طلب'), L(`Ask ${safe(f.name)}`, `اطلب من رعية ${safe(f.name)}`), L('No account is needed. Send your request to the parish office and keep the private link you receive to follow it.', 'لا حاجة إلى حساب. أرسل طلبك إلى مكتب الرعية واحتفظ بالرابط الخاص الذي تتلقاه لمتابعته.'))}
    <div class="site-wrap rq-grid">
      <div class="rq-main">
      <form class="rq-form" data-guest-request>
        <fieldset class="rq-step" data-reveal><legend><span class="rq-n" aria-hidden="true">${digits(c, 1)}</span>${L('What do you need?', 'ماذا تحتاج؟')}</legend>
          <div class="rq-kinds">${all.map(([k, art, t, sub]) => `<label class="rq-kind"><input type="radio" name="kind" value="${k}" ${k === chosen ? 'checked' : ''} required><span class="arch-icon">${c.icon(art)}</span><span><b>${L(...t)}</b><small>${L(...sub)}</small></span></label>`).join('')}</div>
        </fieldset>
        <fieldset class="rq-step" data-reveal><legend><span class="rq-n" aria-hidden="true">${digits(c, 2)}</span>${L('Who is asking?', 'من يطلب؟')}</legend>
          <div class="rq-fields">
            <label class="rq-field"><span>${L('Your full name', 'اسمك الكامل')}</span><input name="name" required maxlength="120" autocomplete="name"></label>
            <label class="rq-field"><span>${L('On behalf of', 'بالنيابة عن')} <small>${L('optional', 'اختياري')}</small></span><input name="behalf" maxlength="120"></label>
            <label class="rq-field"><span>${L('Email', 'البريد الإلكتروني')}</span><input type="email" name="email" autocomplete="email" maxlength="120" dir="ltr"></label>
            <label class="rq-field"><span>${L('Phone', 'الهاتف')}</span><input type="tel" name="phone" autocomplete="tel" maxlength="40" dir="ltr"></label>
          </div>
          <p class="rq-hint">${L('Give at least one way to reach you: an email address, a phone number, or both.', 'أدخل وسيلة واحدة على الأقل للتواصل معك: بريد إلكتروني أو رقم هاتف أو كليهما.')}</p>
        </fieldset>
        <fieldset class="rq-step" data-reveal><legend><span class="rq-n" aria-hidden="true">${digits(c, 3)}</span>${L('Your request', 'طلبك')}</legend>
          <label class="rq-field"><span>${L('Request details', 'تفاصيل الطلب')}</span><textarea name="description" required minlength="5" maxlength="4000" rows="5" placeholder="${safe(L('Names, dates and anything the office should know.', 'الأسماء والتواريخ وكل ما يجب أن يعرفه المكتب.'))}">${ministry ? safe(L('I would like to learn about joining ', 'أودّ الاستفسار عن الانضمام إلى ') + ministry) : ''}</textarea></label>
          <div class="rq-delivery" role="radiogroup" aria-labelledby="rq-delivery-label"><span class="rq-label" id="rq-delivery-label">${L('If there is a document, how would you like it?', 'إن كان هناك مستند، كيف تودّ استلامه؟')}</span>
            <label class="rq-opt"><input type="radio" name="delivery" value="collection" checked><span><b>${L('Collect from the parish', 'الاستلام من الرعية')}</b><small>${L('The office tells you when it is ready.', 'يُعلمك المكتب عندما يصبح جاهزاً.')}</small></span></label>
            <label class="rq-opt"><input type="radio" name="delivery" value="secure-download"><span><b>${L('Secure download, when available', 'تنزيل آمن عند توفّره')}</b><small>${L('From your private tracking link.', 'من رابط المتابعة الخاص بك.')}</small></span></label>
          </div>
        </fieldset>
        <label class="rq-check" data-reveal><input name="responsibleAdult" type="checkbox" required><span>${L('I am the responsible adult submitting this request. A child will be accompanied by a parent or guardian.', 'أنا الشخص البالغ المسؤول عن هذا الطلب. سيكون الطفل برفقة أحد الوالدين أو ولي الأمر.')}</span></label>
        <div class="rq-turnstile" data-turnstile hidden></div>
        <p class="rq-error" data-request-error role="alert"></p>
        <button class="btn btn-gilt rq-send" type="submit">${L('Send request', 'إرسال الطلب')}${I.arrow}</button>
      </form>
      <div data-request-result aria-live="polite"></div>
      </div>
      <aside class="rq-side" data-reveal>
        <a class="rq-parish" href="${safe(c.profileURL(p.id))}"><span class="arch-thumb">${f.photos[0] ? `<img src="${safe(f.photos[0])}" alt="" loading="lazy">` : monogram(f.name)}</span><span><b>${safe(f.name)}</b><small>${safe([f.town, f.rite].filter(Boolean).join(' · '))}</small></span></a>
        <h2>${L('What happens next', 'ماذا يحدث بعد ذلك')}</h2>
        <ol class="rq-steps">${steps.map(([b, s]) => `<li><b>${b}</b><span>${s}</span></li>`).join('')}</ol>
        ${bring(c, f, true)}
        <p class="rq-privacy">${L('No email or text message is sent automatically. Anyone with your tracking link can see the request’s status, so keep it to yourself.', 'لا تُرسل رسائل بريد أو رسائل نصية تلقائياً. يستطيع كل من يملك رابط المتابعة رؤية حالة الطلب، فاحتفظ به لنفسك.')}</p>
      </aside>
    </div></div>`;
}

export function calendarPageView(c, p, d) {
  const f = facts(c, p, d), { L, safe } = c;
  return `<div class="parish-sub" data-parish-sub>
    ${subHero(c, p, f, L('Calendar', 'الرزنامة'), L(`${safe(f.name)} calendar`, `رزنامة رعية ${safe(f.name)}`), L('Masses, celebrations and gatherings, as the parish office publishes them.', 'القداديس والاحتفالات واللقاءات، كما ينشرها مكتب الرعية.'))}
    <section class="site-wrap ph-calpage" data-reveal>${f.events.length ? '' : `<div class="ph-cal-empty"><span class="lamp is-unlit" aria-hidden="true"></span><p>${L('The parish has not published any events yet. They appear here as soon as the parish office adds them to its calendar.', 'لم تنشر الرعية أي مناسبات بعد. تظهر هنا فور إضافتها إلى رزنامة مكتب الرعية.')}</p></div>`}${calendarMarkup(L)}</section></div>`;
}

/* One event's own page: when and where, saving it to a calendar, sharing it, and what else is coming. */
export function eventView(c, p, d, id) {
  const f = facts(c, p, d), { L, safe } = c, e = f.events.find(x => x.id && String(x.id) === String(id));
  if (!e) return `<div class="parish-sub" data-parish-sub>
    ${subHero(c, p, f, L('Event', 'مناسبة'), L('This event is no longer in the calendar', 'لم تعد هذه المناسبة في الرزنامة'), L('The parish may have changed or removed it. Its calendar shows everything coming up.', 'ربما عدّلتها الرعية أو أزالتها. تعرض رزنامتها كلّ ما هو قادم.'))}
    <section class="site-wrap ev-missing" data-reveal><a class="btn btn-gilt" href="${safe(c.calendarURL(p.id))}">${I.cal}${L('Open the calendar', 'افتح الرزنامة')}</a><a class="btn btn-ink-line" href="${safe(c.profileURL(p.id))}">${L('Parish page', 'صفحة الرعية')}</a></section></div>`;
  const t = title(c, e), place = [f.name, f.town].filter(Boolean).join(L(', ', '، ')), url = c.shareURL(c.eventURL(p.id, e.id));
  const date = new Date(e.d + 'T12:00:00'), soon = e.d >= f.today ? relative(c, e) : '', more = f.upcoming.filter(x => x !== e).slice(0, 4);
  const fmt = o => new Intl.DateTimeFormat(loc(c), o).format(date);
  const facts_ = [[I.clock, L('When', 'متى'), `<time datetime="${safe(e.d)}${TIME.test(e.t || '') ? 'T' + safe(e.t) : ''}">${safe(when(c, e))}</time>${soon ? ` <span class="wk-in">${safe(soon)}</span>` : ''}${abroad() && TIME.test(e.t || '') ? `<small class="ev-zone">${L('Beirut time', 'بتوقيت بيروت')}</small>` : ''}`],
    [I.pin, L('Where', 'أين'), `${safe(place)}${f.address ? `<small dir="auto">${safe(f.address)}</small>` : ''}`],
    [I.cross, L('What', 'ماذا'), safe(kindName(L, e.kind))]];
  return `<div class="parish-sub ev-page" data-parish-sub data-doc-title="${safe(t + ' · ' + f.name)}">
    ${subHero(c, p, f, L('Event', 'مناسبة'), safe(t), safe(L(`${when(c, e)}, at ${f.name}`, `${when(c, e)}، في رعية ${f.name}`)))}
    <div class="site-wrap ev-grid">
      <article class="ev-card k-${safe(e.kind || 'event')}" data-reveal>
        <span class="wk-date ev-date" aria-hidden="true"><small>${safe(fmt({ weekday: 'short' }))}</small><b>${safe(digits(c, date.getDate()))}</b><small>${safe(fmt({ month: 'short' }))}</small></span>
        <dl class="ev-facts">${facts_.map(([icon, k, v]) => `<div><span class="ph-contact-icon">${icon}</span><dt>${k}</dt><dd dir="auto">${v}</dd></div>`).join('')}</dl>
        ${e.d < f.today ? `<p class="ev-past">${L('This event has already taken place.', 'جرت هذه المناسبة.')}</p>` : `<div class="ev-actions">
          <a class="btn btn-gilt" href="${icsHref(e, t, place, url)}" download="${safe(icsName(t))}">${ADD_ICON}${L('Add to my calendar', 'أضف إلى رزنامتي')}</a>
          <a class="btn btn-ink-line" href="${safe(googleHref(e, t, place, url))}" target="_blank" rel="noopener">${I.google}${L('Google Calendar', 'رزنامة Google')}</a>
          <a class="btn btn-ink-line" href="${safe(directionsURL(p, d, f.visit))}" target="_blank" rel="noopener">${I.route}${L('Directions', 'الاتجاهات')}</a></div>`}
        ${shareRow(c, url, `${t} · ${when(c, e)} · ${place}`, L('Share this event', 'شارك هذه المناسبة'))}
      </article>
      <aside class="ev-side" data-reveal>
        <a class="rq-parish" href="${safe(c.profileURL(p.id))}"><span class="arch-thumb">${f.photos[0] ? `<img src="${safe(f.photos[0])}" alt="" loading="lazy">` : monogram(f.name)}</span><span><b>${safe(f.name)}</b><small>${safe([f.town, f.rite].filter(Boolean).join(' · '))}</small></span></a>
        ${more.length ? `<h2>${L(`More at ${safe(f.name)}`, `المزيد في رعية ${safe(f.name)}`)}</h2><ul class="ev-more">${more.map(x => `<li><a href="${safe(evLink(c, p, x))}"><time>${safe(when(c, x))}</time><b dir="auto">${safe(title(c, x))}</b></a></li>`).join('')}</ul>` : ''}
        <a class="text-button" href="${safe(c.calendarURL(p.id))}">${L('The whole calendar', 'الرزنامة كاملة')}</a>
      </aside>
    </div></div>`;
}

export function mountSubpage(root, c, p, d) {
  unmountParish();
  const page = root.querySelector('[data-parish-sub]');
  if (!page) return;
  const f = facts(c, p, d);
  teardown.push(watchHero(page.querySelector('[data-hero]')));
  if (page.querySelector('[data-pcal]')) teardown.push(mountCalendar(page, d.events || [], { L: c.L, lang: c.lang, place: [f.name, f.town].filter(Boolean).join(', '), link: e => c.eventURL(p.id, e.id) }));
  shareMount(page, c);
  animateHome(page, {});
}

/* Pages without a parish (For parishes, a page that could not be shown): the header and motion only. */
export function mountPlain(root) {
  unmountParish();
  const page = root.querySelector('[data-plain-page]');
  if (!page) return;
  teardown.push(watchHero(page.querySelector('[data-hero]')));
  animateHome(page, {});
}
