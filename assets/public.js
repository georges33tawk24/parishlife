import { safeRichText } from './rich-text.js';
import { applySiteTheme } from './theme.js';

// The public site reads only the server's published parish projection.
const copy = {
  skip: ['Skip to content', 'انتقل إلى المحتوى'],
  brandSub: ['FAITH & COMMUNITY', 'إيمان وجماعة'],
  directory: ['Find a parish', 'ابحث عن رعية'],
  times: ['Mass times', 'مواعيد القداديس'],
  events: ['Parish life', 'حياة الرعية'],
  aboutNav: ['About', 'عنّا'],
  signIn: ['Members portal', 'بوّابة المؤمنين'],
  explore: ['Explore', 'استكشف'],
  stayConnected: ['Stay connected', 'ابقَ على تواصل'],
  footerIntro: ['A little closer to your parish. A little closer to one another.', 'أقرب إلى رعيتك. أقرب إلى بعضنا البعض.'],
  footer: ['Information published by participating parishes.', 'معلومات تنشرها الرعايا المشاركة.'],
  photoCredit: ['Illustrative photography · Unsplash', 'صور توضيحية · Unsplash'],
  plans: ['Plans for parishes', 'الخطط للرعايا']
};
const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const htmlText = value => safe(value).replace(/\n/g, '<br>');
const icons = {
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  church: '<path d="M12 2v6m-3-3h6M3 21V11l9-5 9 5v10H3Zm6 0v-6a3 3 0 0 1 6 0v6M6 13v3m12-3v3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18m-13 4h2m4 0h2"/>',
  phone: '<path d="m8 3 2 5-3 2a15 15 0 0 0 7 7l2-3 5 2v3a2 2 0 0 1-2 2C10 20 4 14 3 5a2 2 0 0 1 2-2Z"/>',
  cross: '<path d="M12 3v19M6 9h12"/>',
  chevron: '<path d="m8 5 7 7-7 7"/>',
  /* the sacraments, drawn on the app's 20-unit grid and scaled to this one */
  water: '<g transform="scale(1.2)" stroke-width="1.25"><path d="M10 3.2C12.9 6.8 14.9 9.5 14.9 12.1a4.9 4.9 0 0 1-9.8 0C5.1 9.5 7.1 6.8 10 3.2zM7.7 12.6a2.4 2.4 0 0 0 2.3 2.2"/></g>',
  chalice: '<g transform="scale(1.2)" stroke-width="1.25"><path d="M5.8 3.6h8.4c0 3.4-1.9 5.6-4.2 5.6S5.8 7 5.8 3.6zM10 9.2v5.2M6.8 16.4c.5-1.3 1.7-2 3.2-2s2.7.7 3.2 2z"/></g>',
  flame: '<g transform="scale(1.2)" stroke-width="1.25"><path d="M10 3.2c.4 2.4 3.9 4.2 3.9 8a3.9 3.9 0 0 1-7.8 0c0-1.9.9-3.2 2-4.1c.1 1.4.7 2.3 1.6 2.6c-.3-2.2 0-4.4.3-6.5z"/></g>',
  rings: '<g transform="scale(1.2)" stroke-width="1.25"><path d="M2.6 10a4.2 4.2 0 1 0 8.4 0a4.2 4.2 0 1 0 -8.4 0M9 10a4.2 4.2 0 1 0 8.4 0a4.2 4.2 0 1 0 -8.4 0"/></g>',
  candle: '<g transform="scale(1.2)" stroke-width="1.25"><path d="M8.2 9h3.6v7.4H8.2zM6.4 16.4h7.2M10 3.4c1 1.2 1.5 2.1 1.5 2.8a1.5 1.5 0 0 1-3 0c0-.7.5-1.6 1.5-2.8z"/></g>',
  cert: '<g transform="scale(1.2)" stroke-width="1.25"><path d="M10.2 16.4H4.6V3.6h10.8v6.2M7.2 6.8h5.6M7.2 9.4h3.4M7.2 12h2M11.8 12.4a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0M12.9 14.3l-.5 2.7 1.6-.9 1.6.9-.5-2.7"/></g>',
  hall: '<path d="M3 21V10l9-6 9 6v11M3 21h18M9 21v-6h6v6M7.5 12.5h.01M16.5 12.5h.01"/>',
  message: '<path d="M4 5h16v11H10l-4 4v-4H4z"/><path d="M8 9h8M8 12.5h5"/>'
};
const icon = name => '<svg class="icon icon-' + name + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] || icons.church) + '</svg>';
let lang = 'en';
try { if (localStorage.getItem('pl-lang') === 'ar') lang = 'ar'; } catch {}
const L = (en, ar) => lang === 'ar' ? ar : en;
const T = key => L(...copy[key]);
const pair = (obj, en = 'en', ar = 'ar') => obj?.[lang === 'ar' ? ar : en] || obj?.[en] || obj?.[ar] || '';
const parishName = p => pair(p, 'name', 'ar');
const townName = p => pair(p, 'town', 'townAr');
const number = value => new Intl.NumberFormat(lang === 'ar' ? 'ar-LB' : 'en').format(value);
const profileURL = (id, hash = '') => 'public.html?parish=' + encodeURIComponent(id) + hash;
/* A request starts in the member portal, in this parish; signing in comes first when needed. */
const requestURL = (id, kind) => 'index.html?parish=' + encodeURIComponent(id) + '#/myrequests/new/' + kind;
const REQUESTS = [
  ['baptism', 'water', ['Baptism', 'المعمودية'], ['For a child or an adult', 'لطفل أو لشخص بالغ']],
  ['communion', 'chalice', ['First Communion', 'المناولة الأولى'], ['For a child getting ready to receive', 'لطفل يستعدّ للمناولة']],
  ['confirmation', 'flame', ['Confirmation', 'الميرون'], ['Chrismation, the seal of the Holy Spirit', 'مسحة الميرون، ختم الروح القدس']],
  ['marriage', 'rings', ['Marriage', 'الإكليل'], ['Open your marriage file with the parish', 'افتح ملف الزواج مع الرعية']],
  ['funeral', 'candle', ['Funeral', 'الجنّاز'], ['For a family member who has died', 'لأحد أفراد العائلة المتوفّين']],
  ['certificate', 'cert', ['Certificate', 'شهادة'], ['A copy of an entry in the parish register', 'إفادة عن قيد في سجلّ الرعية']]
];
const OTHER_REQUESTS = [
  ['booking', 'hall', ['Book a hall or room', 'حجز قاعة أو مكان'], ['For a reception, a family gathering or a meeting — see when it is free', 'لاستقبال أو لقاء عائلي أو اجتماع — واطّلع على الأوقات المتاحة']],
  ['custom', 'message', ['Something else', 'طلب آخر'], ['A house blessing, a Mass intention, a visit to someone who is sick…', 'تبريك منزل، نيّة قدّاس، زيارة مريض…']]
];
const requestCard = (p, wide) => ([kind, art, title, sub]) => '<a class="request-card' + (wide ? ' request-card-wide' : '') + '" href="' + safe(requestURL(p.id, kind)) + '"><span class="request-icon">' + icon(art) + '</span><span class="request-text"><strong>' + L(...title) + '</strong><small>' + L(...sub) + '</small></span><span class="request-go">' + L('Start a request', 'ابدأ الطلب') + icon('arrow') + '</span></a>';
const signupURL = id => 'index.html?parish=' + encodeURIComponent(id) + '&signup=1#/myrequests';
const localToday = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };
const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').toLowerCase();
const params = new URLSearchParams(location.search);
const filters = { q: params.get('q') || '', town: params.get('town') || '', diocese: params.get('diocese') || '', rite: params.get('rite') || '', radius: '',
  sort: params.get('sort') === 'town' ? 'town' : 'name', layout: params.get('layout') === 'map' ? 'map' : 'list' };
let directory = [], details = new Map(), selected = params.get('parish'), failed = [], showAllEvents = false, loadFailure = false, observer;
const app = document.querySelector('#app');
const content = (d, key) => pair(d?.content?.[key]);
const empty = (heading, body, action = '') => '<div class="empty"><span class="empty-icon">' + icon('church') + '</span><div><h3>' + safe(heading) + '</h3><p>' + safe(body) + '</p>' + action + '</div></div>';

function updateChrome() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = T(el.dataset.i18n); });
  document.querySelectorAll('#lang, #footer-lang').forEach(el => {
    el.textContent = L('العربية', 'English');
    el.setAttribute('aria-label', L('Switch to Arabic', 'التبديل إلى الإنجليزية'));
  });
  document.querySelector('#menu-toggle').setAttribute('aria-label', L('Toggle navigation', 'فتح أو إغلاق القائمة'));
  document.querySelector('#year').textContent = new Date().getFullYear();
}

/* Full collections are shown ten at a time. Filters and search run on the whole collection first, then the
   result is paged; a new search starts again at its first page. */
const PER_PAGE = 10;
function paginate(root = document) {
  root.querySelectorAll('[data-paginate]').forEach(list => {
    if (list.dataset.paged) return;
    list.dataset.paged = '1';
    const items = [...list.children];
    if (items.length <= PER_PAGE) return;
    let page = 0;
    const pages = Math.ceil(items.length / PER_PAGE);
    const nav = document.createElement('nav');
    nav.className = 'public-pager';
    nav.setAttribute('aria-label', L('Pages', 'الصفحات'));
    list.after(nav);
    const show = (focus = false) => {
      items.forEach((el, i) => { el.hidden = i < page * PER_PAGE || i >= (page + 1) * PER_PAGE; });
      const from = page * PER_PAGE + 1, to = Math.min(items.length, (page + 1) * PER_PAGE);
      nav.innerHTML = '<button class="button button-outline" type="button" data-page="-1"' + (page === 0 ? ' disabled' : '') + '>' + L('Previous', 'السابق') + '</button>' +
        '<span>' + L(from + '–' + to + ' of ' + items.length + ' · page ' + (page + 1) + ' of ' + pages, number(from) + '–' + number(to) + ' من ' + number(items.length) + ' · الصفحة ' + number(page + 1) + ' من ' + number(pages)) + '</span>' +
        '<button class="button button-outline" type="button" data-page="1"' + (page >= pages - 1 ? ' disabled' : '') + '>' + L('Next', 'التالي') + '</button>';
      nav.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => { page += +b.dataset.page; show(true); }));
      if (focus) { list.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); nav.querySelector('[data-page="1"]:not([disabled]), [data-page="-1"]')?.focus({ preventScroll: true }); }
    };
    show();
  });
}

/* ---- directory: list and map share one set of filters ------------------------------------------------
   A visitor may use their own location to sort by distance; it stays in this page (never sent anywhere,
   never put in the address) and nothing is ever placed on the map or measured without published coordinates. */
let origin = null, geoState = '', mapsConfig, mapsFailed = false;
const RADII = ['', '5', '10', '25', '50'];
const toRad = x => x * Math.PI / 180;
function kmBetween(a, b) {
  const h = Math.sin(toRad(b.lat - a.lat) / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
const kmText = km => km < 1 ? L('under 1 km', 'أقل من ١ كم') : L(number(Math.round(km * 10) / 10) + ' km', number(Math.round(km * 10) / 10) + ' كم');
const choices = (key, label) => [...new Map(directory.filter(p => p[key]).map(p => [p[key], p])).values()]
  .map(p => [p[key], label(p)]).sort((a, b) => a[1].localeCompare(b[1], lang));
const pageURL = (id, page) => 'public.html?parish=' + encodeURIComponent(id) + '&page=' + page;

function directorySection() {
  const select = (id, key, all, list) => '<label class="filter-field"><span>' + all[0] + '</span><select id="' + id + '" data-filter="' + key + '"><option value="">' + all[1] + '</option>' +
    list.map(([value, text]) => '<option value="' + safe(value) + '"' + (filters[key] === value ? ' selected' : '') + '>' + safe(text) + '</option>').join('') + '</select></label>';
  return '<section id="directory" class="section directory-section site-wrap">' +
    '<div class="section-head"><div><span class="eyebrow">' + L('OUR PARISHES', 'رعايانا') + '</span><h2>' + L('Find your place.<br><span>Feel at home.</span>', 'اعثر على رعيتك.<br><span>واشعر بالانتماء.</span>') + '</h2></div><p>' + L('Every parish registered in ParishLife. Search, filter, and see them as a list or on the map.', 'كل الرعايا المسجّلة في ParishLife. ابحث وصفِّ، واعرضها لائحةً أو على الخريطة.') + '</p></div>' +
    '<form class="directory-filters" role="search" aria-label="' + L('Find a parish', 'ابحث عن رعية') + '">' +
      '<label class="search-field">' + icon('search') + '<span class="sr-only">' + L('Search by parish or town', 'ابحث باسم الرعية أو البلدة') + '</span><input id="directory-filter" type="search" value="' + safe(filters.q) + '" placeholder="' + L('Search by parish or town…', 'ابحث باسم الرعية أو البلدة…') + '" autocomplete="off"></label>' +
      '<div class="filter-grid">' +
        select('town-filter', 'town', [L('Location', 'المكان'), L('All locations', 'كل الأماكن')], choices('town', townName)) +
        select('diocese-filter', 'diocese', [L('Diocese', 'الأبرشية'), L('All dioceses', 'كل الأبرشيات')], choices('diocese', p => pair(p, 'dioceseName', 'dioceseAr') || p.diocese)) +
        select('rite-filter', 'rite', [L('Rite', 'الطقس'), L('All rites', 'كل الطقوس')], choices('rite', p => pair(p, 'rite', 'riteAr'))) +
        '<label class="filter-field"><span>' + L('Distance', 'المسافة') + '</span><select id="radius-filter" data-filter="radius"' + (origin ? '' : ' disabled aria-describedby="geo-help"') + '>' +
          RADII.map(r => '<option value="' + r + '"' + (filters.radius === r ? ' selected' : '') + '>' + (r ? L('Within ' + r + ' km', 'ضمن ' + number(+r) + ' كم') : L('Any distance', 'أي مسافة')) + '</option>').join('') + '</select></label>' +
      '</div>' +
      '<div class="filter-actions"><button class="button" type="submit">' + L('Find a parish', 'ابحث عن رعية') + icon('arrow') + '</button>' +
        '<button class="text-button" type="button" id="use-location">' + icon('pin') + (origin ? L('Update my location', 'حدّث موقعي') : L('Use my location', 'استخدم موقعي')) + '</button>' +
        '<button class="text-button" type="button" id="reset-filters">' + L('Reset filters', 'إعادة ضبط التصفية') + '</button>' +
        '<p class="geo-status" id="geo-help" role="status" aria-live="polite">' + geoText() + '</p></div></form>' +
    '<div class="results-bar"><p id="results-count" role="status" aria-live="polite"></p>' +
      '<div class="layout-switch" role="group" aria-label="' + L('Show parishes as', 'اعرض الرعايا') + '">' +
        [['list', L('List', 'لائحة')], ['map', L('Map', 'خريطة')]].map(([v, t]) => '<button type="button" data-layout="' + v + '" aria-pressed="' + (filters.layout === v) + '">' + t + '</button>').join('') + '</div>' +
      '<label>' + L('Sort by', 'ترتيب حسب') + ' <select id="sort-filter" aria-label="' + L('Sort parishes', 'ترتيب الرعايا') + '"><option value="name"' + (filters.sort === 'name' ? ' selected' : '') + '>' + L('Parish name', 'اسم الرعية') + '</option><option value="town"' + (filters.sort === 'town' ? ' selected' : '') + '>' + L('Town', 'البلدة') + '</option>' +
        (origin ? '<option value="distance"' + (filters.sort === 'distance' ? ' selected' : '') + '>' + L('Distance', 'المسافة') + '</option>' : '') + '</select></label></div>' +
    '<div id="directory-results"></div></section>';
}
function geoText() {
  if (geoState === 'locating') return L('Finding your location…', 'جارٍ تحديد موقعك…');
  if (geoState === 'denied') return L('Location was not shared, so parishes are not sorted by distance. Every parish is still listed.', 'لم يُشارَك الموقع، فلا تُرتَّب الرعايا حسب المسافة. وتبقى كل الرعايا معروضة.');
  if (geoState === 'unavailable') return L('Your location could not be read on this device. Every parish is still listed.', 'تعذّرت قراءة موقعك على هذا الجهاز. وتبقى كل الرعايا معروضة.');
  if (origin) return L('Using your location (accurate to about ' + number(Math.round(origin.accuracy)) + ' m). It stays on this page.', 'نستخدم موقعك (بدقّة نحو ' + number(Math.round(origin.accuracy)) + ' م). ويبقى في هذه الصفحة.');
  return L('Optional: share your location to sort parishes by distance.', 'اختياري: شارك موقعك لترتيب الرعايا حسب المسافة.');
}

/* The parishes that pass the filters, with their distance when both ends are known. */
function filteredParishes() {
  const q = normalize(filters.q.trim());
  const rows = directory.filter(p => (!filters.town || p.town === filters.town) && (!filters.diocese || p.diocese === filters.diocese) &&
    (!filters.rite || p.rite === filters.rite) && (!q || normalize([p.name, p.ar, p.town, p.townAr, p.dioceseName, p.rite].join(' ')).includes(q)))
    .map(p => ({ ...p, km: origin && p.location ? kmBetween(origin, p.location) : null }));
  const byName = (a, b) => (filters.sort === 'town' ? townName(a) : parishName(a)).localeCompare(filters.sort === 'town' ? townName(b) : parishName(b), lang);
  rows.sort(filters.sort === 'distance' && origin ? (a, b) => (a.km ?? Infinity) - (b.km ?? Infinity) || byName(a, b) : byName);
  if (!origin || !filters.radius) return { shown: rows, beyond: [] };
  const limit = +filters.radius;
  return { shown: rows.filter(p => p.km !== null && p.km <= limit), beyond: rows.filter(p => p.km === null || p.km > limit) };
}

function parishCard(p, i) {
  return '<a class="parish-card" href="' + profileURL(p.id) + '"><div class="parish-card-top"><span class="parish-emblem" aria-hidden="true">' + icon('church') + '</span>' +
    (p.demo ? '<span class="demo-badge">' + L('Demo', 'للعرض') + '</span>' : '<span class="card-number" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</span>') + '</div>' +
    '<div class="card-location">' + icon('pin') + safe(townName(p)) + (p.km !== null && p.km !== undefined ? ' · ' + safe(kmText(p.km)) : '') + '</div><h3>' + safe(parishName(p)) + '</h3>' +
    '<p class="parish-other-name" lang="' + L('ar', 'en') + '" dir="' + L('rtl', 'ltr') + '">' + safe(L(p.ar || '', p.name || '')) + '</p>' +
    '<div class="card-bottom"><span>' + safe([pair(p, 'rite', 'riteAr'), pair(p, 'dioceseName', 'dioceseAr')].filter(Boolean).join(' · ') || L('Parish community', 'جماعة الرعية')) + '</span><span class="card-open">' + L('Explore', 'استكشف') + icon('arrow') + '</span></div></a>';
}

function renderCards(updateURL = false) {
  const host = document.querySelector('#directory-results');
  if (!host) return;
  const { shown, beyond } = filteredParishes();
  document.querySelector('#results-count').textContent = L('Showing ' + shown.length + ' of ' + directory.length + ' parishes', 'عرض ' + number(shown.length) + ' من ' + number(directory.length) + ' رعايا');
  const more = beyond.length ? '<div class="beyond"><p>' + L(beyond.length + ' more parishes are further away or have not published their location.', number(beyond.length) + ' رعايا أخرى أبعد أو لم تنشر موقعها.') +
    '</p><button class="button button-outline" type="button" id="show-all">' + L('Show all parishes', 'اعرض كل الرعايا') + icon('arrow') + '</button>' +
    (filters.radius !== '50' ? '<button class="text-button" type="button" id="widen">' + L('Widen the search', 'وسّع البحث') + '</button>' : '') + '</div>' : '';
  if (filters.layout === 'map') host.innerHTML = mapView(shown) + more;
  else host.innerHTML = (shown.length ? '<div class="parish-grid" data-paginate>' + shown.map(parishCard).join('') + '</div>'
    : empty(L('No parishes found', 'لم نعثر على رعايا'), L('Try a different name, or reset the filters.', 'جرّب اسمًا مختلفًا أو أعد ضبط التصفية.'), '<button class="text-link" id="clear-filters" type="button">' + L('Reset filters', 'إعادة ضبط التصفية') + icon('arrow') + '</button>')) + more;
  host.querySelector('#clear-filters')?.addEventListener('click', resetFilters);
  host.querySelector('#show-all')?.addEventListener('click', () => { filters.radius = ''; syncFilterControls(); renderCards(true); });
  host.querySelector('#widen')?.addEventListener('click', () => { filters.radius = RADII[Math.min(RADII.length - 1, RADII.indexOf(filters.radius) + 1)]; syncFilterControls(); renderCards(true); });
  if (filters.layout === 'map' && mapsConfig?.maps && !mapsFailed) liveMap(shown);
  paginate(host);
  if (updateURL) {
    const url = new URL(location.href);
    for (const key of ['q', 'town', 'diocese', 'rite', 'sort', 'layout']) filters[key] && !(key === 'sort' && filters[key] === 'name') && !(key === 'layout' && filters[key] === 'list') ? url.searchParams.set(key, filters[key]) : url.searchParams.delete(key);
    history.replaceState(null, '', url);
  }
}
function syncFilterControls() {
  document.querySelectorAll('.directory-filters [data-filter]').forEach(el => { el.value = filters[el.dataset.filter] || ''; });
  const q = document.querySelector('#directory-filter'); if (q) q.value = filters.q;
}
function resetFilters() {
  Object.assign(filters, { q: '', town: '', diocese: '', rite: '', radius: '', sort: origin ? 'distance' : 'name' });
  syncFilterControls();
  const sort = document.querySelector('#sort-filter'); if (sort) sort.value = filters.sort;
  renderCards(true);
  document.querySelector('#directory-filter')?.focus();
}
function useLocation() {
  if (!navigator.geolocation) { geoState = 'unavailable'; return rerenderDirectory(); }
  geoState = 'locating'; document.querySelector('#geo-help').textContent = geoText();
  navigator.geolocation.getCurrentPosition(pos => {
    origin = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
    geoState = 'ok'; filters.sort = 'distance'; rerenderDirectory();
  }, error => { geoState = error.code === 1 ? 'denied' : 'unavailable'; rerenderDirectory(); }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
}
function rerenderDirectory() {
  const section = document.querySelector('#directory');
  if (!section) return;
  section.outerHTML = directorySection();
  bindDirectory();
  renderCards(true);
}
function bindDirectory() {
  const form = document.querySelector('.directory-filters');
  if (!form) return;
  form.addEventListener('submit', event => { event.preventDefault(); renderCards(true); document.querySelector('#directory-results')?.scrollIntoView({ block: 'nearest' }); });
  document.querySelector('#directory-filter').addEventListener('input', event => { filters.q = event.target.value; renderCards(true); });
  form.querySelectorAll('[data-filter]').forEach(el => el.addEventListener('change', () => { filters[el.dataset.filter] = el.value; renderCards(true); }));
  document.querySelector('#sort-filter').addEventListener('change', event => { filters.sort = event.target.value; renderCards(true); });
  document.querySelector('#reset-filters').addEventListener('click', resetFilters);
  document.querySelector('#use-location').addEventListener('click', useLocation);
  document.querySelectorAll('[data-layout]').forEach(b => b.addEventListener('click', () => {
    filters.layout = b.dataset.layout;
    document.querySelectorAll('[data-layout]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderCards(true);
  }));
}

/* The map. Until a Google Maps key is configured this is a clearly marked preview: published coordinates
   drawn to scale on a plain background, not a live map. Parishes without coordinates are listed, never placed. */
function mapView(rows) {
  const placed = rows.filter(p => p.location), unplaced = rows.filter(p => !p.location);
  const live = mapsConfig?.maps && !mapsFailed;
  const list = unplaced.length ? '<div class="map-unplaced"><h3>' + L('Not on the map', 'ليست على الخريطة') + '</h3><p>' + L('These parishes have not published their location yet.', 'لم تنشر هذه الرعايا موقعها بعد.') + '</p><ul>' +
    unplaced.map(p => '<li><a href="' + profileURL(p.id) + '">' + safe(parishName(p)) + '</a> · ' + safe(townName(p)) + '</li>').join('') + '</ul></div>' : '';
  if (live) return '<div class="map-frame"><div id="live-map" class="live-map" role="region" aria-label="' + L('Map of parishes', 'خريطة الرعايا') + '"></div></div>' + list;
  return '<div class="map-frame map-preview"><p class="map-label"><b>' + L('Map preview', 'معاينة الخريطة') + '</b> · ' +
    L('Not a live map: Google Maps has not been configured yet. Points show the coordinates parishes have published, drawn to scale without streets or places.', 'ليست خريطة حيّة: لم تُضبط خرائط Google بعد. تُظهر النقاط الإحداثيات التي نشرتها الرعايا، مرسومة بمقياس دون شوارع أو أماكن.') + '</p>' +
    (placed.length ? previewSVG(placed) : '<p class="map-empty">' + L('None of the parishes shown has published its location yet.', 'لم تنشر أيّ من الرعايا المعروضة موقعها بعد.') + '</p>') + '</div>' + list;
}
function previewSVG(placed) {
  const pts = placed.map(p => p.location).concat(origin ? [origin] : []);
  let minLat = Math.min(...pts.map(x => x.lat)), maxLat = Math.max(...pts.map(x => x.lat)), minLng = Math.min(...pts.map(x => x.lng)), maxLng = Math.max(...pts.map(x => x.lng));
  const padLat = Math.max((maxLat - minLat) * 0.15, 0.01), padLng = Math.max((maxLng - minLng) * 0.15, 0.01);
  minLat -= padLat; maxLat += padLat; minLng -= padLng; maxLng += padLng;
  const W = 1000, H = 560, sx = W / (maxLng - minLng), sy = H / (maxLat - minLat), s = Math.min(sx, sy);
  const ox = (W - (maxLng - minLng) * s) / 2, oy = (H - (maxLat - minLat) * s) / 2;
  const xy = loc => [ox + (loc.lng - minLng) * s, oy + (maxLat - loc.lat) * s];
  return '<svg class="map-svg" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="' + L('Parish locations', 'مواقع الرعايا') + '">' +
    '<rect width="' + W + '" height="' + H + '" class="map-bg"/>' +
    (origin ? (([x, y]) => '<g class="map-origin" aria-label="' + L('Your location', 'موقعك') + '"><circle cx="' + x + '" cy="' + y + '" r="9"/><text x="' + (x + 14) + '" y="' + (y + 5) + '">' + L('You', 'أنت') + '</text></g>')(xy(origin)) : '') +
    placed.map(p => { const [x, y] = xy(p.location); return '<a href="' + profileURL(p.id) + '" class="map-pin"><title>' + safe(parishName(p) + ' · ' + townName(p)) + '</title>' +
      '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="11"/><text x="' + (x + 16).toFixed(1) + '" y="' + (y + 5).toFixed(1) + '">' + safe(parishName(p)) + '</text></a>'; }).join('') + '</svg>';
}
/* Prepared for when a browser key is configured (PARISHLIFE_GOOGLE_MAPS_KEY). Not exercised without a key;
   any failure falls back to the preview and says so. */
function liveMap(rows) {
  const host = document.querySelector('#live-map');
  if (!host) return;
  const draw = () => {
    try {
      const placed = rows.filter(p => p.location);
      const map = new google.maps.Map(host, { center: placed[0]?.location || origin || { lat: 33.89, lng: 35.5 }, zoom: placed.length ? 11 : 8 });
      const bounds = new google.maps.LatLngBounds();
      for (const p of placed) {
        const marker = new google.maps.Marker({ position: p.location, map, title: parishName(p) });
        marker.addListener('click', () => { location.href = profileURL(p.id); });
        bounds.extend(p.location);
      }
      if (placed.length > 1) map.fitBounds(bounds);
    } catch { mapsFailed = true; renderCards(); }
  };
  if (window.google?.maps) return draw();
  window.__plMapReady = draw;
  if (!document.querySelector('#gmaps-script')) {
    const s = Object.assign(document.createElement('script'), { id: 'gmaps-script', async: true,
      src: 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(mapsConfig.maps.key) + '&callback=__plMapReady' });
    s.onerror = () => { mapsFailed = true; renderCards(); };
    document.head.append(s);
  }
}

/* ---- the "More than a place" slider: parish stories, ministries and events, mixed ---------------- */
const ART = { story: 'community', ministry: 'ministry', event: 'event', parish: 'church' };
const plain = html => String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const clip = (text, n) => text.length > n ? text.slice(0, n - 1).trimEnd() + '…' : text;
function slidesFor(parishes) {
  const kinds = { story: [], ministry: [], event: [] };
  for (const p of parishes) {
    const d = details.get(p.id);
    if (!d) continue;
    const photos = (d.gallery || []).map(g => g.url);
    const photo = i => photos.length ? photos[i % photos.length] : null;
    (d.posts || []).slice(0, 2).forEach((post, i) => kinds.story.push({ kind: 'story', title: post.title, text: clip(plain(post.body), 150), p, photo: photo(i), href: profileURL(p.id, '#updates') }));
    (d.ministries || []).slice(0, 2).forEach((m, i) => kinds.ministry.push({ kind: 'ministry', title: pair(m, 'name', 'ar'), text: clip(plain(pair(m, 'about', 'aboutAr')) || pair(m, 'meets', 'meetsAr'), 150), p, photo: photo(i + 2), href: profileURL(p.id, '#ministries') }));
    (d.events || []).filter(e => e.d >= localToday()).slice(0, 2).forEach((e, i) => kinds.event.push({ kind: 'event', title: pair(e, 'title', 'titleAr'), text: [publishedDate(e.d), e.t].filter(Boolean).join(' · '), p, photo: photo(i + 4), href: pageURL(p.id, 'calendar') }));
  }
  const out = [];
  for (let i = 0; out.length < 8 && (kinds.story.length || kinds.ministry.length || kinds.event.length); i++) {
    for (const k of ['story', 'ministry', 'event']) if (kinds[k].length && out.length < 8) out.push(kinds[k].shift());
  }
  return out;
}
const KIND_NAME = { story: ['Parish story', 'من حياة الرعية'], ministry: ['Ministry', 'خدمة'], event: ['Event', 'حدث'] };
function slider(slides) {
  if (!slides.length) return '';
  return '<div class="slider" role="region" aria-roledescription="' + L('carousel', 'عرض شرائح') + '" aria-label="' + L('Parish stories, ministries and events', 'من حياة الرعايا وخدماتها وأحداثها') + '">' +
    '<div class="slides">' + slides.map((s, i) => '<article class="slide' + (i === 0 ? ' is-active' : '') + '" role="group" aria-roledescription="' + L('slide', 'شريحة') + '" aria-label="' + (i + 1) + ' / ' + slides.length + '"' + (i === 0 ? '' : ' hidden') + '>' +
      '<div class="slide-media">' + (s.photo ? '<img src="' + safe(s.photo) + '" alt="" loading="lazy">' : '<img src="assets/images/illustrations/' + ART[s.kind] + '.svg" alt="" loading="lazy"><span class="slide-tag">' + L('Illustrative image', 'صورة توضيحية') + '</span>') + '</div>' +
      '<div class="slide-copy"><span class="eyebrow">' + safe(L(...KIND_NAME[s.kind])) + ' · ' + safe(parishName(s.p)) + (s.p.demo ? ' · ' + L('demo', 'للعرض') : '') + '</span><h3>' + safe(s.title) + '</h3>' + (s.text ? '<p>' + safe(s.text) + '</p>' : '') +
      '<a class="text-link" href="' + s.href + '">' + L('Read more', 'اقرأ المزيد') + icon('arrow') + '</a></div></article>').join('') + '</div>' +
    (slides.length > 1 ? '<button class="slide-arrow slide-prev" type="button" aria-label="' + L('Previous slide', 'الشريحة السابقة') + '">' + icon('chevron') + '</button>' +
      '<button class="slide-arrow slide-next" type="button" aria-label="' + L('Next slide', 'الشريحة التالية') + '">' + icon('chevron') + '</button>' +
      '<div class="slide-bar"><button class="slide-pause" type="button" aria-pressed="false">' + L('Pause', 'إيقاف مؤقت') + '</button><div class="slide-dots" role="group" aria-label="' + L('Choose a slide', 'اختر شريحة') + '">' +
      slides.map((s, i) => '<button type="button" class="slide-dot" data-slide="' + i + '" aria-label="' + safe(L('Slide ' + (i + 1) + ': ', 'الشريحة ' + number(i + 1) + ': ') + s.title) + '"' + (i === 0 ? ' aria-current="true"' : '') + '><span></span></button>').join('') + '</div></div>' : '') + '</div>';
}
let slideTimer = null;
function bindSlider() {
  const root = document.querySelector('.slider');
  clearInterval(slideTimer);
  if (!root || root.querySelectorAll('.slide').length < 2) return;
  const slides = [...root.querySelectorAll('.slide')], dots = [...root.querySelectorAll('.slide-dot')], pause = root.querySelector('.slide-pause');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = 0, stopped = reduced, held = false;   // stopped: the visitor paused; held: pointer or focus is inside
  const show = i => {
    current = (i + slides.length) % slides.length;
    slides.forEach((s, n) => { s.hidden = n !== current; s.classList.toggle('is-active', n === current); });
    dots.forEach((d, n) => n === current ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current'));
    root.classList.remove('is-running'); void root.offsetWidth; sync();
  };
  const sync = () => {
    const running = !stopped && !held;
    root.classList.toggle('is-running', running);
    pause.setAttribute('aria-pressed', String(stopped));
    pause.textContent = stopped ? L('Play', 'تشغيل') : L('Pause', 'إيقاف مؤقت');
    clearInterval(slideTimer);
    if (running) slideTimer = setInterval(() => show(current + 1), 5000);
  };
  root.querySelector('.slide-prev').addEventListener('click', () => show(current - 1));
  root.querySelector('.slide-next').addEventListener('click', () => show(current + 1));
  dots.forEach(d => d.addEventListener('click', () => show(+d.dataset.slide)));
  pause.addEventListener('click', () => { stopped = !stopped; sync(); });
  root.addEventListener('mouseenter', () => { held = true; sync(); });
  root.addEventListener('mouseleave', () => { held = false; sync(); });
  root.addEventListener('focusin', () => { held = true; sync(); });
  root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget)) { held = false; sync(); } });
  root.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); show(current + ((event.key === 'ArrowRight') !== (document.dir === 'rtl') ? 1 : -1)); }
  });
  sync();
}

function eventsFor(parishes) {
  return parishes.flatMap(p => (details.get(p.id)?.events || []).filter(e => e.d >= localToday()).map(e => ({ ...e, parish: p })))
    .sort((a, b) => (a.d + (a.t || '')).localeCompare(b.d + (b.t || '')));
}
function dateParts(value) {
  const date = new Date(value + 'T12:00:00');
  if (Number.isNaN(date.valueOf())) return [value, ''];
  return [new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB' : 'en', {day:'2-digit'}).format(date),
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB' : 'en', {month:'short', year:'numeric'}).format(date)];
}
function publishedDate(value) {
  const date = new Date(value?.length === 10 ? value + 'T12:00:00' : value);
  return Number.isNaN(date.valueOf()) ? '' : new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB' : 'en', {dateStyle:'medium'}).format(date);
}
function eventKind(kind) {
  return ({ mass: L('Mass', 'قدّاس'), event: L('Gathering', 'لقاء'), wedding: L('Wedding', 'زفاف'), baptism: L('Baptism', 'معمودية'), funeral: L('Funeral', 'جنازة') })[kind] || L('Parish event', 'حدث رعوي');
}
function timesSection(parishes) {
  const hasTimes = parishes.filter(p => content(details.get(p.id), 'massTimes'));
  return '<section id="times" class="times-section"><div class="site-wrap times-layout"><div><span class="eyebrow">' + L('MAKE TIME FOR WHAT MATTERS', 'وقتٌ لما يهمّنا') + '</span><h2>' + L('A moment<br>of peace.', 'لحظة<br>سلام.') + '</h2><p>' + L('Find published Mass and confession information, and plan your next visit.', 'اطّلع على مواعيد القداديس والاعتراف المنشورة وخطّط لزيارتك القادمة.') + '</p>' + icon('cross') + '</div><div class="times-list">' +
    (hasTimes.length ? hasTimes.map(p => '<details class="mass-detail"' + (selected ? ' open' : '') + '><summary><span><small>' + safe(townName(p)) + '</small><strong>' + safe(parishName(p)) + '</strong></span><span class="details-plus" aria-hidden="true">+</span></summary><div class="mass-body"><p>' + htmlText(content(details.get(p.id), 'massTimes')) + '</p>' + (selected ? '<a class="text-link" href="#contact">' + L('Contact the parish', 'تواصل مع الرعية') : '<a class="text-link" href="' + profileURL(p.id, '#times') + '">' + L('Visit parish page', 'صفحة الرعية')) + ' ' + icon('arrow') + '</a></div></details>').join('') :
      empty(L('Times will be shared here', 'ستُنشر المواعيد هنا'), L('Mass and confession information has not been published yet. Visit your parish page for available contact details.', 'لم تُنشر مواعيد القداديس والاعتراف بعد. يمكنك زيارة صفحة رعيتك للاطّلاع على معلومات التواصل المتاحة.'), selected ? '<a class="text-link" href="#contact">' + L('Contact information', 'معلومات التواصل') + icon('arrow') + '</a>' : '<a class="text-link" href="#directory">' + L('Find your parish', 'ابحث عن رعيتك') + icon('arrow') + '</a>')) +
    '</div></div></section>';
}

function home() {
  return '<section class="hero site-wrap"><div class="hero-copy"><span class="eyebrow"><span class="eyebrow-dot"></span>' + L('ROOTED IN FAITH. CONNECTED IN LIFE.', 'متجذّرون في الإيمان. متّصلون بالحياة.') + '</span><h1>' + L('A place to pray.<br>A community<br>to <em>belong.</em>', 'مكانٌ للصلاة.<br>جماعةٌ<br><em>للانتماء.</em>') + '</h1><p>' + L('Discover parishes, find a moment of peace, and stay close to the life of your community.', 'اكتشف الرعايا، واعثر على لحظة سلام، وابقَ قريبًا من حياة جماعتك.') + '</p><div class="actions"><a class="button" href="#directory">' + L('Find your parish', 'ابحث عن رعيتك') + icon('arrow') + '</a><a class="text-link" href="#times">' + L('Explore Mass times', 'مواعيد القداديس') + '</a></div><div class="hero-note"><span class="note-line"></span>' + L('Your parish. Your people. Your place.', 'رعيّتك. جماعتك. مكانك.') + '</div></div>' +
    '<div class="hero-art"><div class="hero-photo" role="img" aria-label="' + L('Sunlight filling a quiet church interior; illustrative photograph', 'ضوء الشمس في كنيسة هادئة؛ صورة توضيحية') + '"></div><div class="photo-caption"><span class="caption-mark">' + icon('cross') + '</span><span>' + L('Faith brings us together.', 'الإيمان يجمعنا.') + '<small>' + L('A COMMUNITY BEGINS WITH YOU', 'الجماعة تبدأ بك') + '</small></span></div><span class="vertical-label" aria-hidden="true">PARISHLIFE — LEBANON</span></div></section>' +
    directorySection() + communitySection() + timesSection(directory) +
    '<section id="about" class="about-site section site-wrap"><div class="about-symbol" aria-hidden="true">' + icon('church') + '</div><div><span class="eyebrow">' + L('A SHARED PLACE FOR OUR PARISHES', 'مساحة مشتركة لرعايانا') + '</span><h2>' + L('Closer to your parish.<br>Closer to one another.', 'أقرب إلى رعيتك.<br>أقرب إلى بعضنا البعض.') + '</h2><p>' + L('ParishLife brings the information your parish shares into one welcoming place. Explore its story, plan a visit, and keep up with community life — in English or Arabic.', 'يجمع ParishLife المعلومات التي تنشرها رعيتك في مساحة واحدة ترحّب بك. اكتشف حكايتها، وخطّط لزيارة، وتابع حياة الجماعة بالإنجليزية أو العربية.') + '</p><a class="text-link" href="index.html">' + L('Open the members portal', 'ادخل إلى بوّابة المؤمنين') + icon('arrow') + '</a></div></section>';
}

/* "More than a place": parish stories, ministries and events in one place — the slider, then what is coming up. */
function communitySection() {
  return '<section id="community" class="community-section"><div class="site-wrap"><div class="community-head"><span class="eyebrow">' + L('MORE THAN A PLACE', 'أكثر من مكان') + '</span><h2>' + L('Where faith finds<br>its community.', 'حيث يجد الإيمان<br>جماعته.') + '</h2><p>' +
    L('In a familiar face. In a shared prayer. In the everyday moments of parish life — Masses, gatherings, ministries and the stories parishes share.', 'في وجهٍ مألوف. في صلاةٍ مشتركة. في لحظات الحياة الرعوية اليومية — القداديس واللقاءات والخدمات والحكايات التي تشاركها الرعايا.') + '</p></div>' +
    slider(slidesFor(directory)) + '</div>' + eventsSection(directory, true) + '</section>';
}

function eventsSection(parishes, embedded = false) {
  const events = eventsFor(parishes), single = parishes.length === 1, visible = single ? events.slice(0, 5) : showAllEvents ? events : events.slice(0, 6);
  const list = '<div class="event-list"' + (showAllEvents && !single ? ' data-paginate' : '') + '>' + (visible.length ? visible.map(e => {
      const [day, month] = dateParts(e.d);
      return '<article class="event-row"><time class="event-date" datetime="' + safe(e.d) + '"><b>' + safe(day) + '</b><span>' + safe(month) + '</span></time><div class="event-info"><span class="eyebrow">' + safe(eventKind(e.kind)) + '</span><h3>' + safe(pair(e, 'title', 'titleAr')) + '</h3><p>' + safe(parishName(e.parish)) + ' · ' + safe(townName(e.parish)) + '</p></div><span class="event-time">' + (e.t ? icon('clock') + safe(e.t) : '') + '</span>' + (single ? '' : '<a class="round-link" href="' + pageURL(e.parish.id, 'calendar') + '" aria-label="' + safe(L('Calendar of ', 'رزنامة ') + parishName(e.parish)) + '">' + icon('arrow') + '</a>') + '</article>';
    }).join('') : empty(L('A little quiet for now', 'لحظات هادئة حاليًا'), L('Upcoming public events will appear here when a parish publishes them.', 'ستظهر الأحداث العامة القادمة هنا عندما تنشرها الرعية.'))) + '</div>';
  const more = single ? (events.length ? '<a class="text-link more-events" href="' + pageURL(parishes[0].id, 'calendar') + '">' + L('View the full calendar', 'اعرض الرزنامة كاملة') + icon('arrow') + '</a>' : '')
    : events.length > 6 ? '<button id="more-events" class="text-link more-events" type="button">' + (showAllEvents ? L('Show fewer events', 'عرض أحداث أقل') : L('View all ' + events.length + ' events', 'عرض كل الأحداث (' + number(events.length) + ')')) + ' ' + icon('arrow') + '</button>' : '';
  if (embedded) return '<div id="events" class="section site-wrap community-events"><h3 class="request-group">' + L('Coming up', 'قريباً') + '</h3>' + list + more + '</div>';
  return '<section id="events" class="section site-wrap"><div class="section-head"><div><span class="eyebrow">' + L('PUBLIC CALENDAR', 'الرزنامة العامة') + '</span><h2>' + L('What’s on', 'الأحداث') + '</h2></div></div>' + list + more + '</section>';
}

const DEMO_NOTE = () => '<div class="demo-note site-wrap" role="note">' + icon('cross') + '<span><b>' + L('Demonstration parish.', 'رعية للعرض.') + '</b> ' +
  L('This page shows sample information to demonstrate ParishLife. It is not a real parish’s published details.', 'تعرض هذه الصفحة معلومات نموذجية لعرض ParishLife، وليست معلومات منشورة لرعية حقيقية.') + '</span></div>';
const mapLink = loc => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(loc.lat + ',' + loc.lng);

function profile(p, d) {
  const name = pair(d.parish, 'name', 'nameAr') || parishName(p);
  const meta = [pair(d.parish, 'town', 'townAr') || townName(p), pair(d.parish, 'rite', 'riteAr'), pair(d.parish, 'dioceseName', 'dioceseAr')].filter(Boolean).join(' · ');
  const phone = String(d.parish.phone || '').replace(/[^\d+]/g, '');
  const hours = content(d, 'officeHours');
  const facts = [d.parish.address ? '<li>' + icon('pin') + '<span>' + safe(pair(d.parish, 'address', 'addressAr')) + '</span></li>' : '',
    phone ? '<li>' + icon('phone') + '<a href="tel:' + safe(phone) + '"><bdi>' + safe(d.parish.phone) + '</bdi></a></li>' : '',
    hours ? '<li>' + icon('clock') + '<span>' + safe(clip(hours.split('\n')[0], 90)) + '</span></li>' : ''].join('');
  return (d.parish.demo ? DEMO_NOTE() : '') + '<div class="site-wrap breadcrumbs"><a href="public.html#directory">' + L('All parishes', 'كل الرعايا') + '</a>' + icon('chevron') + '<span>' + safe(name) + '</span></div>' +
    '<section class="profile-hero"><div class="site-wrap"><span class="eyebrow">' + safe(meta || L('YOUR PARISH COMMUNITY', 'جماعتك الرعوية')) + '</span><h1>' + safe(name) + '</h1><p>' + htmlText(content(d, 'welcome') || L('A place of faith, a life in community.', 'مكان للإيمان وحياة في الجماعة.')) + '</p>' +
      (facts ? '<ul class="profile-facts">' + facts + '</ul>' : '') + '</div></section>' +
    '<nav class="profile-nav" aria-label="' + L('Parish sections', 'أقسام الرعية') + '"><div class="site-wrap"><a href="#about">' + L('Our story', 'حكايتنا') + '</a>' + (d.clergy?.length ? '<a href="#clergy">' + L('Clergy', 'الإكليروس') + '</a>' : '') + '<a href="#times">' + L('Mass & confession', 'القداديس والاعتراف') + '</a><a href="#events">' + L('What’s on', 'الأحداث') + '</a>' + (offers(d, 'ministries') ? '<a href="#ministries">' + L('Ministries', 'الخدمات') + '</a>' : '') + (hasRequests(d) ? '<a href="#sacraments">' + L('Sacraments', 'الأسرار') + '</a>' : '') + '<a href="#updates">' + L('Announcements', 'الإعلانات') + '</a><a href="#gallery">' + L('Gallery', 'الصور') + '</a><a href="#contact">' + L('Visit & contact', 'الزيارة والتواصل') + '</a></div></nav>' +
    '<section id="about" class="section site-wrap parish-about"><div><span class="eyebrow">' + L('ROOTED IN COMMUNITY', 'متجذّرون في الجماعة') + '</span><h2>' + L('Every parish<br>has a story.', 'لكل رعية<br>حكاية.') + '</h2></div><div class="reading-copy"><h3>' + safe(name) + '</h3><p>' + htmlText(content(d, 'history') || L('The parish’s story will appear here when it is published.', 'ستظهر حكاية الرعية هنا عندما تُنشر.')) + '</p>' + (meta ? '<span class="location-note">' + icon('pin') + safe(meta) + '</span>' : '') + '</div></section>' +
    clergySection(d) + timesSection([p]) + eventsSection([p]) + ministriesSection(p, d) + sacramentsSection(p, d, phone) + updatesSection(p, d, 4) + gallerySection(p, d, 6) + contactSection(p, d, name, phone) +
    '<div class="back-directory site-wrap"><a class="text-link" href="public.html#directory">' + L('Explore other parishes', 'استكشف رعايا أخرى') + icon('arrow') + '</a></div>';
}

/* The clergy serving the parish now, with the photos the parish published (initials until it has). */
function clergySection(d) {
  if (!d.clergy?.length) return '';
  const initials = c => (pair(c, 'name', 'nameAr') || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('');
  return '<section id="clergy" class="section site-wrap"><div class="section-head"><div><span class="eyebrow">' + L('SERVING THE PARISH', 'في خدمة الرعية') + '</span><h2>' + L('Clergy', 'الإكليروس') + '</h2></div></div><div class="clergy-grid">' +
    d.clergy.map(c => '<article class="clergy-card">' + (c.photo ? '<img src="' + safe(c.photo) + '" alt="' + safe(pair(c, 'name', 'nameAr')) + '" loading="lazy">' : '<span class="clergy-initials" aria-hidden="true">' + safe(initials(c)) + '</span>') +
      '<div><h3>' + safe([c.title, pair(c, 'name', 'nameAr')].filter(Boolean).join(' ')) + '</h3><p>' + safe(L(c.officeEn, c.officeAr)) + '</p></div></article>').join('') + '</div></section>';
}

function updatesSection(p, d, limit) {
  const posts = d.posts || [], shown = limit ? posts.slice(0, limit) : posts;
  return '<section id="updates" class="updates-section"><div class="section site-wrap"><div class="section-head"><div><span class="eyebrow">' + L('FROM YOUR PARISH', 'من رعيتك') + '</span><h2>' + L('The latest, together.', 'جديد جماعتنا.') + '</h2></div></div><div class="updates-grid"' + (limit ? '' : ' data-paginate') + '>' +
    (shown.length ? shown.map(post => '<article class="update-card">' + (publishedDate(post.at) ? '<time datetime="' + safe(post.at) + '">' + safe(publishedDate(post.at)) + '</time>' : '') + '<h3>' + safe(post.title) + '</h3><div class="published-body">' + (/<[a-z][\s\S]*>/i.test(post.body || '') ? safeRichText(post.body) : htmlText(post.body)) + '</div></article>').join('') :
      empty(L('Updates will find a home here', 'هنا تجد مستجدّات الرعية'), L('Published parish announcements will appear in this space.', 'ستظهر إعلانات الرعية المنشورة في هذه المساحة.'))) + '</div>' +
    (limit && posts.length > limit ? '<a class="text-link more-events" href="' + pageURL(p.id, 'announcements') + '">' + L('View all ' + posts.length + ' announcements', 'اعرض كل الإعلانات (' + number(posts.length) + ')') + icon('arrow') + '</a>' : '') + '</div></section>';
}

/* Photos the parish published; until it has, illustrative pictures that say so. */
function gallerySection(p, d, limit) {
  const photos = d.gallery || [], shown = limit ? photos.slice(0, limit) : photos;
  const body = shown.length ? '<div class="gallery-grid"' + (limit ? '' : ' data-paginate') + '>' + shown.map(g => '<figure><img src="' + safe(g.url) + '" alt="' + safe(g.name.replace(/\.[a-z]+$/i, '')) + '" loading="lazy"></figure>').join('') + '</div>'
    : '<div class="gallery-grid">' + ['church', 'community', 'candle'].map(a => '<figure class="illustrative"><img src="assets/images/illustrations/' + a + '.svg" alt="" loading="lazy"><figcaption>' + L('Illustrative image', 'صورة توضيحية') + '</figcaption></figure>').join('') + '</div>' +
      '<p class="gallery-note">' + L('This parish has not published photos yet; these are illustrations, not pictures of the parish.', 'لم تنشر هذه الرعية صوراً بعد؛ هذه رسوم توضيحية وليست صوراً للرعية.') + '</p>';
  return '<section id="gallery" class="section site-wrap"><div class="section-head"><div><span class="eyebrow">' + L('PARISH LIFE IN PICTURES', 'حياة الرعية بالصور') + '</span><h2>' + L('Gallery', 'الصور') + '</h2></div></div>' + body +
    (limit && photos.length > limit ? '<a class="text-link more-events" href="' + pageURL(p.id, 'gallery') + '">' + L('View all ' + photos.length + ' photos', 'اعرض كل الصور (' + number(photos.length) + ')') + icon('arrow') + '</a>' : '') + '</section>';
}

function contactSection(p, d, name, phone) {
  const contact = content(d, 'contact'), hours = content(d, 'officeHours'), directions = content(d, 'directions'), access = content(d, 'accessibility');
  const block = (title, text) => text ? '<div class="contact-block"><h4>' + title + '</h4><p>' + htmlText(text) + '</p></div>' : '';
  return '<section id="contact" class="section site-wrap contact-section"><div><span class="eyebrow">' + L('YOU ARE WELCOME HERE', 'أهلًا بك') + '</span><h2>' + L('Come say hello.', 'تفضّل بزيارتنا.') + '</h2><p>' + L('Find your way to the parish.<br>We look forward to seeing you.', 'تعرّف على طريقك إلى الرعية.<br>نتطلّع إلى لقائك.') + '</p></div><div class="contact-panel"><h3>' + safe(name) + '</h3>' +
    (contact ? '<p>' + htmlText(contact) + '</p>' : '<p>' + L('Contact and visiting information has not been published yet.', 'لم تُنشر معلومات التواصل والزيارة بعد.') + '</p>') +
    (d.parish.address ? '<div class="contact-row">' + icon('pin') + '<span>' + safe(pair(d.parish, 'address', 'addressAr')) + '</span></div>' : '') +
    (phone ? '<a class="contact-row" href="tel:' + safe(phone) + '">' + icon('phone') + '<bdi>' + safe(d.parish.phone) + '</bdi></a>' : '') +
    block(L('Office hours', 'ساعات عمل المكتب'), hours) + block(L('Getting here', 'الوصول إلينا'), directions) + block(L('Accessibility', 'تسهيلات الوصول'), access) +
    (d.parish.location ? '<a class="text-link" href="' + safe(mapLink(d.parish.location)) + '" target="_blank" rel="noopener noreferrer">' + L('Open the location in a map app', 'افتح الموقع في تطبيق خرائط') + icon('arrow') + '</a>' : '') +
    '</div></section>';
}

/* "View more": the parish's full calendar, all its announcements, or its whole gallery, each on its own page. */
let calendarOffset = 0, calendarQuery = '';
function morePage(p, d, page) {
  const name = pair(d.parish, 'name', 'nameAr') || parishName(p);
  const titles = { calendar: L('Calendar', 'الرزنامة'), announcements: L('Announcements', 'الإعلانات'), gallery: L('Gallery', 'الصور') };
  const body = page === 'calendar' ? calendarPage(p, d) : page === 'announcements' ? updatesSection(p, d, 0) : gallerySection(p, d, 0);
  return (d.parish.demo ? DEMO_NOTE() : '') + '<div class="site-wrap breadcrumbs"><a href="public.html#directory">' + L('All parishes', 'كل الرعايا') + '</a>' + icon('chevron') + '<a href="' + profileURL(p.id) + '">' + safe(name) + '</a>' + icon('chevron') + '<span>' + titles[page] + '</span></div>' +
    '<section class="profile-hero profile-hero-small"><div class="site-wrap"><span class="eyebrow">' + safe(name) + '</span><h1>' + titles[page] + '</h1></div></section>' + body +
    '<div class="back-directory site-wrap"><a class="text-link" href="' + profileURL(p.id) + '">' + L('Back to the parish page', 'العودة إلى صفحة الرعية') + icon('arrow') + '</a></div>';
}
function calendarPage(p, d) {
  const now = new Date(), start = new Date(now.getFullYear(), now.getMonth() + calendarOffset, 1);
  const key = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const q = normalize(calendarQuery.trim());
  const events = (d.events || []).filter(e => e.d >= key(start) && e.d < key(end) && (!q || normalize([e.title, e.titleAr].join(' ')).includes(q)))
    .sort((a, b) => (a.d + (a.t || '')).localeCompare(b.d + (b.t || '')));
  const lead = start.getDay(), days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate(), cells = Math.ceil((lead + days) / 7) * 7;
  const fmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB' : 'en', { month: 'long', year: 'numeric' });
  const weekday = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB' : 'en', { weekday: 'short' });
  return '<section class="section site-wrap public-calendar"><div class="calendar-toolbar"><button class="button button-outline" type="button" data-cal="-1" aria-label="' + L('Previous month', 'الشهر السابق') + '">‹</button>' +
    '<button class="text-button" type="button" data-cal="0">' + L('Today', 'اليوم') + '</button><h2 aria-live="polite">' + safe(fmt.format(start)) + '</h2>' +
    '<button class="button button-outline" type="button" data-cal="1" aria-label="' + L('Next month', 'الشهر التالي') + '">›</button>' +
    '<form class="calendar-search" role="search" id="calendar-search"><label class="sr-only" for="calendar-q">' + L('Search events by name', 'ابحث في الأحداث بالاسم') + '</label><input id="calendar-q" type="search" value="' + safe(calendarQuery) + '" placeholder="' + L('Search events by name', 'ابحث في الأحداث بالاسم') + '">' +
    '<label class="sr-only" for="calendar-date">' + L('Go to a date', 'انتقل إلى تاريخ') + '</label><input id="calendar-date" type="date"><button class="button" type="submit">' + L('Search', 'بحث') + '</button></form></div>' +
    '<div class="month-grid" role="grid" aria-label="' + safe(fmt.format(start)) + '"><div class="month-head" role="row">' + Array.from({ length: 7 }, (_, i) => '<span role="columnheader">' + safe(weekday.format(new Date(2026, 7, 2 + i))) + '</span>').join('') + '</div><div class="month-cells">' +
    Array.from({ length: cells }, (_, i) => {
      const day = new Date(start.getFullYear(), start.getMonth(), i - lead + 1), inMonth = day.getMonth() === start.getMonth(), dayEvents = events.filter(e => e.d === key(day));
      return '<div class="month-cell' + (inMonth ? '' : ' out') + (key(day) === localToday() ? ' today' : '') + '" role="gridcell"><time datetime="' + key(day) + '">' + day.getDate() + '</time>' +
        dayEvents.map(e => '<span class="month-event">' + safe((e.t ? e.t + ' ' : '') + pair(e, 'title', 'titleAr')) + '</span>').join('') + '</div>';
    }).join('') + '</div></div>' +
    '<h3 class="request-group">' + L('This month', 'هذا الشهر') + '</h3><div class="event-list" data-paginate>' + (events.length ? events.map(e => { const [dd, mm] = dateParts(e.d);
      return '<article class="event-row"><time class="event-date" datetime="' + safe(e.d) + '"><b>' + safe(dd) + '</b><span>' + safe(mm) + '</span></time><div class="event-info"><span class="eyebrow">' + safe(eventKind(e.kind)) + '</span><h3>' + safe(pair(e, 'title', 'titleAr')) + '</h3></div><span class="event-time">' + (e.t ? icon('clock') + safe(e.t) : '') + '</span></article>'; }).join('')
      : empty(q ? L('No event matches this search this month', 'لا حدث يطابق هذا البحث هذا الشهر') : L('Nothing published this month', 'لا شيء منشور هذا الشهر'), L('Try another month, or contact the parish office.', 'جرّب شهراً آخر أو تواصل مع مكتب الرعية.'))) + '</div></section>';
}

/* Public ministries: what each does, who leads it (by name only — never a leader's personal number or
   address), how to join, and a form to say you are interested. The form makes nobody a member. */
function ministriesSection(p, d) {
  if (!offers(d, 'ministries')) return '';
  const list = d.ministries || [];
  const text = (m, en) => pair(m, en, en + 'Ar');
  return '<section id="ministries" class="section site-wrap ministries-section"><div class="section-head"><div><span class="eyebrow">' + L('SERVE AND BELONG', 'خدمة وانتماء') + '</span><h2>' + L('Ministries', 'الخدمات') + '</h2></div><p>' +
    L('Choirs, catechism, youth and service groups. Ask about one below or through the parish office — leaders’ personal phone numbers and addresses are not published.', 'جوقات وتعليم مسيحي وشبيبة وفرق خدمة. اسأل عن إحداها أدناه أو عبر مكتب الرعية — لا تُنشر أرقام المسؤولين وعناوينهم الشخصية.') + '</p></div>' +
    (list.length ? '<div class="ministry-grid">' + list.map(m => '<article class="ministry-card"><span class="eyebrow">' + safe(pair(m, 'cat', 'catAr')) + '</span><h3>' + safe(pair(m, 'name', 'ar')) + '</h3>' +
      (text(m, 'about') ? '<p>' + htmlText(text(m, 'about')) + '</p>' : '') +
      '<dl>' + (m.leader ? '<dt>' + L('Led by', 'المسؤول') + '</dt><dd>' + safe(pair(m.leader, 'name', 'ar')) + '</dd>' : '') +
      (pair(m, 'meets', 'meetsAr') ? '<dt>' + L('Meets', 'يجتمع') + '</dt><dd>' + safe(pair(m, 'meets', 'meetsAr')) + '</dd>' : '') +
      (text(m, 'duties') ? '<dt>' + L('What members take on', 'ما يلتزم به الأعضاء') + '</dt><dd>' + htmlText(text(m, 'duties')) + '</dd>' : '') +
      (text(m, 'howToJoin') ? '<dt>' + L('How to join', 'كيف تنضمّ') + '</dt><dd>' + htmlText(text(m, 'howToJoin')) + '</dd>' : '') + '</dl>' +
      '<button class="text-button ministry-interest" type="button" data-ministry="' + safe(m.id) + '">' + L('I’m interested', 'أنا مهتمّ') + icon('arrow') + '</button></article>').join('') + '</div>' +
      '<form class="ministry-form" id="ministry-form" novalidate hidden><h3>' + L('Tell the parish you are interested', 'أخبر الرعية باهتمامك') + '</h3>' +
      '<p>' + L('The parish office or the ministry’s leader will get back to you. Sending this does not make you a member and opens nothing private.', 'سيعود إليك مكتب الرعية أو مسؤول الخدمة. إرسال هذا لا يجعلك عضواً ولا يفتح شيئاً خاصاً.') + '</p>' +
      '<label>' + L('Ministry', 'الخدمة') + '<select name="groupId">' + list.map(m => '<option value="' + safe(m.id) + '">' + safe(pair(m, 'name', 'ar')) + '</option>').join('') + '</select></label>' +
      '<label>' + L('Your name', 'اسمك') + '<input name="name" maxlength="120" autocomplete="name" required></label>' +
      '<div class="form-pair"><label>' + L('Phone', 'الهاتف') + '<input name="phone" type="tel" dir="ltr" maxlength="40" autocomplete="tel"></label>' +
      '<label>' + L('Email', 'البريد الإلكتروني') + '<input name="email" type="email" dir="ltr" maxlength="120" autocomplete="email"></label></div>' +
      '<small>' + L('Give a phone number, an email address, or both.', 'أدخل رقم هاتف أو بريداً إلكترونياً أو كليهما.') + '</small>' +
      '<label>' + L('Message (optional)', 'رسالة (اختيارية)') + '<textarea name="message" rows="3" maxlength="1000"></textarea></label>' +
      '<span class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></span>' +
      '<p class="form-status" role="status" aria-live="polite"></p><button class="button" type="submit">' + L('Send', 'إرسال') + icon('arrow') + '</button></form>'
      : empty(L('Ministries will be listed here', 'ستُدرج الخدمات هنا'), L('This parish has not published its ministries yet. The parish office can tell you more.', 'لم تنشر هذه الرعية خدماتها بعد. يمكن لمكتب الرعية إخبارك بالمزيد.'))) + '</section>';
}

function bindMinistryForm(p) {
  const form = document.querySelector('#ministry-form');
  if (!form) return;
  document.querySelectorAll('.ministry-interest').forEach(b => b.addEventListener('click', () => {
    form.hidden = false; form.groupId.value = b.dataset.ministry;
    form.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    form.name.focus({ preventScroll: true });
  }));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const status = form.querySelector('.form-status'), values = Object.fromEntries(new FormData(form));
    if (!values.name.trim()) { status.textContent = L('Enter your name.', 'أدخل اسمك.'); form.name.focus(); return; }
    if (!values.phone.trim() && !values.email.trim()) { status.textContent = L('Give a phone number or an email address, so the parish can reply.', 'أدخل رقم هاتف أو بريداً إلكترونياً ليتمكّن الرعية من الرد.'); form.phone.focus(); return; }
    const button = form.querySelector('[type=submit]'); button.disabled = true; status.textContent = L('Sending…', 'جارٍ الإرسال…');
    try {
      const response = await fetch('/api/public/parishes/' + encodeURIComponent(p.id) + '/inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || L('The message could not be sent.', 'تعذّر إرسال الرسالة.'));
      form.reset(); status.textContent = L('Thank you. The parish has your message and will get back to you.', 'شكراً. وصلت رسالتك إلى الرعية وستعود إليك.');
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
}

/* A certificate asked for without an account, for oneself or a family member. A child's is asked for by a parent
   or guardian. The private tracking link is shown once; it is only described as sent when it really was. */
const GUEST_DOCS = [['baptism', ['Baptism certificate', 'إفادة معمودية']], ['communion', ['First Communion certificate', 'إفادة مناولة أولى']],
  ['confirmation', ['Confirmation certificate', 'إفادة تثبيت']], ['marriage', ['Marriage certificate', 'إفادة زواج']]];
const RELATIONS = [['self', ['It is about me', 'تخصّني']], ['parent', ['I am a parent', 'أنا أحد الوالدين']], ['guardian', ['I am the legal guardian', 'أنا الوصي القانوني']],
  ['spouse', ['I am the spouse', 'أنا الزوج أو الزوجة']], ['child', ['I am a son or daughter', 'أنا الابن أو الابنة']], ['sibling', ['I am a brother or sister', 'أنا الأخ أو الأخت']], ['other', ['Another relative', 'قريب آخر']]];
function guestDocumentForm(p) {
  const field = (name, label, attrs = '') => '<label>' + label + '<input name="' + name + '" ' + attrs + '></label>';
  return '<details class="guest-doc" id="no-account"><summary><span><b>' + L('Only need a certificate? No account needed.', 'تحتاج إلى إفادة فقط؟ لا حاجة إلى حساب.') + '</b><small>' +
    L('Ask for yourself or for a family member. You get a private link to follow it.', 'اطلب لنفسك أو لأحد أفراد عائلتك. تحصل على رابط خاص لمتابعة الطلب.') + '</small></span>' + icon('chevron') + '</summary>' +
    '<form class="ministry-form guest-form" id="guest-form" novalidate>' +
    '<label>' + L('Document', 'الوثيقة') + '<select name="kind">' + GUEST_DOCS.map(([v, l]) => '<option value="' + v + '">' + L(...l) + '</option>').join('') + '</select></label>' +
    '<fieldset><legend>' + L('Who is the document about?', 'عمّن الوثيقة؟') + '</legend>' + field('subject.name', L('Full name', 'الاسم الكامل'), 'maxlength="120" required') +
    '<div class="form-pair">' + field('subject.birthDate', L('Date of birth', 'تاريخ الولادة'), 'type="date"') + field('subject.when', L('Date or year of the sacrament, if known', 'تاريخ السرّ أو سنته إن عُرف'), 'maxlength="120"') + '</div>' +
    '<div class="form-pair">' + field('subject.father', L('Father’s name', 'اسم الأب'), 'maxlength="120"') + field('subject.mother', L('Mother’s name', 'اسم الأم'), 'maxlength="120"') + '</div>' +
    '<small>' + L('For a child, a parent or legal guardian makes the request. The child does not need an account and does not come alone.', 'لطفل، يقدّم الطلبَ أحدُ الوالدين أو الوصي القانوني. لا يحتاج الطفل إلى حساب ولا يأتي وحده.') + '</small></fieldset>' +
    '<fieldset><legend>' + L('About you', 'عنك') + '</legend>' + field('requester.name', L('Your name', 'اسمك'), 'maxlength="120" autocomplete="name" required') +
    '<label>' + L('How you are related', 'صلة القرابة') + '<select name="requester.relationship">' + RELATIONS.map(([v, l]) => '<option value="' + v + '">' + L(...l) + '</option>').join('') + '</select></label>' +
    '<div class="form-pair">' + field('requester.phone', L('Phone', 'الهاتف'), 'type="tel" dir="ltr" maxlength="40" autocomplete="tel"') + field('requester.email', L('Email', 'البريد الإلكتروني'), 'type="email" dir="ltr" maxlength="120" autocomplete="email"') + '</div>' +
    '<small>' + L('Give a phone number, an email address, or both.', 'أدخل رقم هاتف أو بريداً إلكترونياً أو كليهما.') + '</small></fieldset>' +
    '<label>' + L('What it is for (optional)', 'الغاية منها (اختياري)') + '<input name="purpose" maxlength="500"></label>' +
    '<fieldset><legend>' + L('How will you receive it?', 'كيف ستستلمها؟') + '</legend><label class="radio"><input type="radio" name="delivery" value="collect" checked>' + L('I will collect it at the parish office', 'سأستلمها من مكتب الرعية') + '</label>' +
    '<label class="radio"><input type="radio" name="delivery" value="download">' + L('I will download it from my tracking link once it is released', 'سأنزّلها من رابط المتابعة بعد تسليمها') + '</label></fieldset>' +
    '<span class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></span>' +
    '<p class="form-status" role="status" aria-live="polite"></p><button class="button" type="submit">' + L('Send the request', 'إرسال الطلب') + icon('arrow') + '</button></form>' +
    '<div class="guest-done" id="guest-done" hidden></div></details>';
}
const LINK_SENT = {
  sent: ['We also sent this link to you.', 'وأرسلنا إليك هذا الرابط أيضاً.'],
  sending: ['We handed this link to our message service, which has not confirmed it yet. Keep a copy.', 'سلّمنا هذا الرابط إلى خدمة الرسائل التي لم تؤكّده بعد. احتفظ بنسخة.'],
  failed: ['We could not send this link to you. Keep a copy now.', 'تعذّر إرسال هذا الرابط إليك. احتفظ بنسخة الآن.'],
  console: ['Development server: this link was printed in the server console, not sent to you. Keep a copy.', 'خادم تطوير: طُبع هذا الرابط في نافذة الخادم ولم يُرسل إليك. احتفظ بنسخة.'],
  'not-configured': ['This link has not been sent anywhere: this site cannot send emails or text messages yet. Keep a copy now — it is the only way to follow your request.', 'لم يُرسل هذا الرابط إلى أي مكان: لا يستطيع هذا الموقع إرسال رسائل بريد أو رسائل نصية بعد. احتفظ بنسخة الآن — فهو الطريقة الوحيدة لمتابعة طلبك.']
};
function bindGuestForm(p) {
  const form = document.querySelector('#guest-form');
  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const status = form.querySelector('.form-status'), values = Object.fromEntries(new FormData(form));
    const body = { kind: values.kind, purpose: values.purpose, delivery: values.delivery, website: values.website, subject: {}, requester: {} };
    for (const [k, v] of Object.entries(values)) { const [group, key] = k.split('.'); if (key) body[group][key] = v; }
    if (!body.subject.name.trim()) { status.textContent = L('Enter the full name of the person the document is about.', 'أدخل الاسم الكامل لصاحب الوثيقة.'); return form.elements['subject.name'].focus(); }
    if (!body.requester.name.trim()) { status.textContent = L('Enter your name.', 'أدخل اسمك.'); return form.elements['requester.name'].focus(); }
    if (!body.requester.phone.trim() && !body.requester.email.trim()) { status.textContent = L('Give a phone number or an email address.', 'أدخل رقم هاتف أو بريداً إلكترونياً.'); return form.elements['requester.phone'].focus(); }
    const button = form.querySelector('[type=submit]'); button.disabled = true; status.textContent = L('Sending…', 'جارٍ الإرسال…');
    try {
      const response = await fetch('/api/public/parishes/' + encodeURIComponent(p.id) + '/document-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || L('The request could not be sent.', 'تعذّر إرسال الطلب.'));
      form.hidden = true;
      const done = document.querySelector('#guest-done');
      done.hidden = false;
      done.innerHTML = '<h3>' + L('Your request is saved', 'حُفظ طلبك') + ' · <bdi>' + safe(result.reference) + '</bdi></h3><p>' + L('This is your private link to follow it. Anyone with this link can see the request, so keep it to yourself.', 'هذا رابطك الخاص لمتابعة الطلب. من يملك هذا الرابط يرى الطلب، فاحتفظ به لنفسك.') + '</p>' +
        '<p class="track-link" dir="ltr">' + safe(result.link) + '</p><p><button class="text-button" type="button" id="copy-track">' + L('Copy the link', 'انسخ الرابط') + '</button> · <a class="text-link" href="' + safe(result.link) + '">' + L('Open it', 'افتحه') + '</a></p>' +
        '<p class="form-status">' + L(...(LINK_SENT[result.linkDelivery] || LINK_SENT['not-configured'])) + '</p>';
      done.querySelector('#copy-track').addEventListener('click', () => navigator.clipboard?.writeText(result.link).then(() => { done.querySelector('#copy-track').textContent = L('Copied', 'نُسخ'); }));
      done.scrollIntoView({ block: 'center' });
    } catch (error) { status.textContent = error.message; button.disabled = false; }
  });
}

/* The private tracking page for a request made without an account. */
const TRACK_STAGES = {
  received: ['Received by the parish office', 'استلمه مكتب الرعية'], review: ['Being prepared', 'قيد التحضير'], signed: ['Signed by the priest · with the bishop', 'وقّعها الكاهن · لدى المطران'],
  accepted: ['Accepted by the bishop', 'قبلها المطران'], ready: ['Ready', 'جاهزة'], collected: ['Collected', 'استُلمت'], declined: ['Not accepted', 'لم يُقبل'], cancelled: ['Cancelled', 'أُلغي']
};
const TRACK_EVENTS = { submitted: ['Request sent', 'أُرسل الطلب'], accepted: ['The parish office found the record', 'وجد مكتب الرعية القيد'], signed: ['Signed by the priest', 'وقّعها الكاهن'],
  'bishop-accepted': ['Accepted by the bishop', 'قبلها المطران'], review: ['Returned for review', 'أُعيدت للمراجعة'], ready: ['Released', 'سُلّمت'], collected: ['Collected', 'استُلمت'],
  declined: ['Not accepted', 'لم يُقبل'], cancelled: ['Cancelled', 'أُلغي'] };
async function trackPage(token) {
  app.setAttribute('aria-busy', 'true');
  let view;
  try {
    const response = await fetch('/api/public/requests/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    view = await response.json();
    if (!response.ok) throw new Error(view.error || '');
  } catch (error) {
    app.innerHTML = '<div class="site-wrap error-page">' + empty(L('We could not find this request', 'لم نعثر على هذا الطلب'), error.message || L('Check that you copied the whole link.', 'تحقّق من أنك نسخت الرابط كاملاً.')) + '</div>';
    app.setAttribute('aria-busy', 'false'); return;
  }
  const kind = GUEST_DOCS.find(([v]) => v === view.kind)?.[1] || ['Certificate', 'إفادة'];
  const when = at => publishedDate(at) || '';
  app.innerHTML = '<section class="section site-wrap track-page"><span class="eyebrow">' + safe(pair(view.parish, 'name', 'ar')) + ' · <bdi>' + safe(view.reference) + '</bdi></span>' +
    '<h1>' + L(...kind) + '</h1><p class="track-subject">' + safe(view.subject) + '</p>' +
    '<p class="track-stage"><b>' + L(...(TRACK_STAGES[view.stage] || TRACK_STAGES.received)) + '</b></p>' +
    (view.message ? '<p class="track-message">' + L('Message from the parish: ', 'رسالة من الرعية: ') + safe(view.message) + '</p>' : '') +
    (view.stage === 'ready' ? (view.download ? '<p><button class="button" type="button" id="track-download">' + L('Download the document', 'نزّل الوثيقة') + icon('arrow') + '</button></p>'
      : view.delivery === 'download' ? '<p>' + L('The document is released. The parish office is attaching the signed copy; check this page again soon, or collect it at the office.', 'سُلّمت الوثيقة. يرفق مكتب الرعية النسخة الموقّعة؛ عُد إلى هذه الصفحة قريباً أو استلمها من المكتب.') + '</p>'
      : '<p>' + L('Collect it at the parish office. Bring an identity document.', 'استلمها من مكتب الرعية، واصطحب وثيقة هوية.') + (view.minor ? ' ' + L('As it concerns a child, the parent or guardian who asked for it collects it.', 'ولأنها تخصّ طفلاً، يستلمها الوالد أو الوصي الذي طلبها.') : '') + '</p>') : '') +
    '<ol class="track-events">' + view.events.map(e => '<li><b>' + L(...(TRACK_EVENTS[e.key] || [e.key, e.key])) + '</b><small>' + safe(when(e.at)) + '</small></li>').join('') + '</ol>' +
    '<p class="track-note">' + L('This page is private to whoever holds its link. Have an account? Members can ask the parish office to add this request to their account from My requests.', 'هذه الصفحة خاصة بمن يملك رابطها. هل لديك حساب؟ يمكن للأعضاء أن يطلبوا من مكتب الرعية إضافة هذا الطلب إلى حسابهم من «طلباتي».') + '</p></section>';
  app.setAttribute('aria-busy', 'false');
  document.title = view.reference + ' · ParishLife';
  document.querySelector('#track-download')?.addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    try {
      const response = await fetch('/api/public/requests/document', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || L('The document could not be downloaded.', 'تعذّر تنزيل الوثيقة.'));
      const blob = await response.blob(), name = decodeURIComponent((response.headers.get('Content-Disposition') || '').split("''")[1] || view.reference);
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch (error) { alert(error.message); }
    finally { button.disabled = false; }
  });
}

/* What a parish's plan has switched on. Older answers without the list mean everything, as before. */
const offers = (d, module) => !d.modules || d.modules.includes(module);
const REQUEST_MODULE = { booking: 'reservations', custom: 'requests' };
const offeredRequests = (d, list) => offers(d, 'members') ? list.filter(([kind]) => offers(d, REQUEST_MODULE[kind] || 'sacraments')) : [];
const hasRequests = d => offeredRequests(d, REQUESTS).length || offeredRequests(d, OTHER_REQUESTS).length || d.documentsOpen !== false;

function sacramentsSection(p, d, phone) {
  if (!hasRequests(d)) return '';
  const intro = content(d, 'sacraments'), main = offeredRequests(d, REQUESTS), other = offeredRequests(d, OTHER_REQUESTS);
  return '<section id="sacraments" class="sacraments-section"><div class="section site-wrap"><div class="section-head"><div><span class="eyebrow">' + L('CELEBRATE WITH US', 'نحتفل معاً') + '</span><h2>' + L('Ask your parish', 'اطلب من رعيتك') + '</h2></div>' +
    '<p>' + (intro ? htmlText(intro) : L('Planning a baptism or a wedding, need a certificate, the parish hall, or something else? Send your request online and follow every step.', 'تخطّط لمعمودية أو إكليل، أو تحتاج إلى شهادة أو إلى قاعة الرعية أو إلى أمر آخر؟ أرسل طلبك عبر الإنترنت وتابع كل خطوة.')) + '</p></div>' +
    (main.length ? '<h3 class="request-group">' + L('Sacraments &amp; certificates', 'الأسرار والشهادات') + '</h3>' +
    '<div class="request-grid">' + main.map(requestCard(p, false)).join('') + '</div>' : '') +
    (other.length ? '<h3 class="request-group">' + L('Book a place, or ask for something else', 'احجز مكاناً، أو اطلب أمراً آخر') + '</h3>' +
    '<div class="request-grid request-grid-2">' + other.map(requestCard(p, true)).join('') + '</div>' : '') + (d.documentsOpen !== false ? guestDocumentForm(p) : '') +
    '<div class="request-steps"><ol>' +
      '<li><span>01</span><b>' + L('Sign in or create an account', 'سجّل الدخول أو أنشئ حساباً') + '</b><small>' + L('With your phone number or your email. It is free.', 'برقم هاتفك أو ببريدك الإلكتروني. إنه مجاني.') + '</small></li>' +
      '<li><span>02</span><b>' + L('Send your request', 'أرسل طلبك') + '</b><small>' + L('Choose what you need. It takes two minutes.', 'اختر ما تحتاج إليه. يستغرق ذلك دقيقتين.') + '</small></li>' +
      '<li><span>03</span><b>' + L('Follow every step', 'تابع كل خطوة') + '</b><small>' + L('Answers, dates and preparation, with a notification at each step.', 'الأجوبة والمواعيد والتحضير، مع إشعار عند كل خطوة.') + '</small></li></ol>' +
    '<p class="request-note">' + L('No account yet?', 'لا حساب لديك بعد؟') + ' <a href="' + safe(signupURL(p.id)) + '">' + L('Create one in a minute', 'أنشئ حساباً في دقيقة') + icon('arrow') + '</a> ' +
      L('Prefer to talk to someone? Call the parish office.', 'تفضّل التحدّث مع أحد؟ اتصل بمكتب الرعية.') +
      (phone ? ' <a href="tel:' + safe(phone) + '">' + icon('phone') + '<bdi>' + safe(d.parish.phone) + '</bdi></a>' : '') + '</p></div></div></section>';
}

function bindEventToggle(parishes) {
  document.querySelector('button#more-events')?.addEventListener('click', () => {
    showAllEvents = !showAllEvents;
    document.querySelector('#events').outerHTML = eventsSection(parishes, !selected);
    bindEventToggle(parishes);
    document.querySelector('#more-events')?.focus({preventScroll:true});
  });
}

/* A private tracking link opens its request instead of the directory (the link is the requester's own; pages
   are served with a same-origin referrer policy, so it is not passed on to other sites). */
const trackToken = params.get('track');
const plansView = params.get('view') === 'plans';
const MORE_PAGES = ['calendar', 'announcements', 'gallery'], morePageName = params.get('page');
function render() {
  observer?.disconnect();
  updateChrome();
  if (trackToken) return trackPage(trackToken);
  if (plansView) return plansPage();
  const p = directory.find(p => p.id === selected), d = details.get(selected);
  applySiteTheme(null);   // one shared website theme for every page; a parish's colours never change it
  if (loadFailure) {
    app.innerHTML = '<div class="site-wrap error-page">' + empty(L('We couldn’t load the directory', 'تعذّر تحميل الدليل'), L('Please check your connection and try again.', 'يرجى التحقّق من الاتصال والمحاولة مجدّدًا.'), '<button class="button retry-load" type="button">' + L('Try again', 'حاول مجدّدًا') + '</button>') + '</div>';
  } else if (selected && (!p || !d)) {
    app.innerHTML = '<div class="site-wrap error-page">' + empty(p ? L('This parish page is temporarily unavailable', 'صفحة الرعية غير متاحة حاليًا') : L('Parish not found', 'لم نعثر على الرعية'), L('You can return to the directory and explore another parish.', 'يمكنك العودة إلى الدليل واستكشاف رعية أخرى.'), (p ? '<button class="button retry-load" type="button">' + L('Try again', 'حاول مجدّدًا') + '</button>' : '') + '<a class="text-link" href="public.html#directory">' + L('Back to the directory', 'العودة إلى الدليل') + icon('arrow') + '</a>') + '</div>';
  } else {
    app.innerHTML = (failed.length ? '<div class="site-wrap load-notice" role="status">' + L('Some parish details could not be loaded. ', 'تعذّر تحميل بعض تفاصيل الرعايا. ') + '<button class="text-button retry-load">' + L('Try again', 'حاول مجدّدًا') + '</button></div>' : '') +
      (selected ? (MORE_PAGES.includes(morePageName) ? morePage(p, d, morePageName) : profile(p, d)) : home());
  }
  app.setAttribute('aria-busy', 'false');
  document.title = (selected && p ? parishName(p) : L('Find your parish', 'ابحث عن رعيتك')) + ' · ParishLife';
  renderCards();
  document.querySelectorAll('.retry-load').forEach(button => button.addEventListener('click', load));
  bindDirectory();
  bindSlider();
  bindEventToggle(selected && p ? [p] : directory);
  if (selected && p && d) { bindMinistryForm(p); bindGuestForm(p); }
  document.querySelectorAll('[data-cal]').forEach(b => b.addEventListener('click', () => { calendarOffset = +b.dataset.cal ? calendarOffset + +b.dataset.cal : 0; render(); document.querySelector('[data-cal="' + b.dataset.cal + '"]')?.focus(); }));
  document.querySelector('#calendar-search')?.addEventListener('submit', event => {
    event.preventDefault();
    calendarQuery = document.querySelector('#calendar-q').value;
    const day = document.querySelector('#calendar-date').value;
    if (day) { const now = new Date(); calendarOffset = (+day.slice(0, 4) - now.getFullYear()) * 12 + (+day.slice(5, 7) - 1 - now.getMonth()); }
    render(); document.querySelector('#calendar-q')?.focus();
  });
  paginate();
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), {threshold:0.12});
    document.querySelectorAll('.about-symbol, .parish-card').forEach(el => { el.classList.add('reveal'); observer.observe(el); });
  }
}

/* Plans for parishes: the modules a parish can switch on and the bundles on offer. No prices are set and
   nothing is charged yet; demonstration bundles say so. */
let plansData = null, plansFailed = false;
async function plansPage() {
  applySiteTheme(null);
  document.title = L('Plans for parishes', 'الخطط للرعايا') + ' · ParishLife';
  if (!plansData && !plansFailed) {
    app.innerHTML = '<div class="site-wrap error-page"><p role="status">' + L('Loading…', 'جارٍ التحميل…') + '</p></div>';
    try { plansData = await getJSON('/api/public/plans'); } catch { plansFailed = true; }
  }
  if (plansFailed) {
    app.innerHTML = '<div class="site-wrap error-page">' + empty(L('We couldn’t load the plans', 'تعذّر تحميل الخطط'), L('Please check your connection and try again.', 'يرجى التحقّق من الاتصال والمحاولة مجدّدًا.')) + '</div>';
    app.setAttribute('aria-busy', 'false');
    return;
  }
  const d = plansData, bundles = d.bundles;
  const docs = d.presenceDocuments === 'included' ? L('Included', 'مشمولة') : d.presenceDocuments === 'separate' ? L('Separate module', 'وحدة منفصلة') : L('Not decided yet', 'لم يُحسم بعد');
  const cell = (b, m) => {
    if (m.id === 'documents' && !b.modules.includes('documents') && b.modules.length === 1) return '<td>' + safe(docs) + '</td>';
    return '<td>' + (b.modules.includes(m.id) ? '<span aria-hidden="true">✓</span><span class="sr-only">' + L('Included', 'مشمول') + '</span>' : '<span aria-hidden="true">—</span><span class="sr-only">' + L('Not included', 'غير مشمول') + '</span>') + '</td>';
  };
  app.innerHTML = '<section class="plans-hero"><div class="site-wrap"><span class="eyebrow">' + L('FOR PARISHES', 'للرعايا') + '</span><h1>' + L('Plans for parishes', 'الخطط للرعايا') + '</h1><p>' +
      L('A parish switches on only the modules it needs. With Public Presence alone, it appears on ParishLife with its public profile and published information, without operational modules.', 'تفعّل الرعية الوحدات التي تحتاج إليها فقط. ومع الحضور العام وحده تظهر على ParishLife بملفها العام ومعلوماتها المنشورة، دون الوحدات التشغيلية.') + '</p>' +
      '<p class="plans-note" role="note">' + L('No prices, limits or billing periods have been set, and nothing is charged: billing is not live yet. Bundles marked “demonstration” only show how options can be put together — they are not approved packages.', 'لم تُحدَّد أسعار ولا حدود ولا فترات فوترة، ولا يُحتسب أي مبلغ: الفوترة غير مفعّلة بعد. والباقات المعلَّمة «للعرض» تبيّن فقط كيف يمكن جمع الخيارات — وليست باقات معتمدة.') + '</p></div></section>' +
    '<section class="section site-wrap"><div class="section-head"><div><span class="eyebrow">' + L('MODULES', 'الوحدات') + '</span><h2>' + L('What a parish can switch on', 'ما يمكن للرعية تفعيله') + '</h2></div><p>' + L('A module makes a part of ParishLife available to the parish. It never gives anyone access by itself: each person still needs the permissions of their role.', 'تجعل الوحدة جزءاً من ParishLife متاحاً للرعية. ولا تمنح أحداً وصولاً بذاتها: يبقى كل شخص بحاجة إلى صلاحيات دوره.') + '</p></div>' +
      '<ul class="plan-modules">' + d.modules.map(m => '<li><b>' + safe(L(m.en, m.ar)) + '</b><span>' + safe(L(m.about, m.aboutAr)) + '</span></li>').join('') + '</ul></section>' +
    '<section class="section site-wrap"><div class="section-head"><div><span class="eyebrow">' + L('BUNDLES', 'الباقات') + '</span><h2>' + L('Ways to start', 'طرق البدء') + '</h2></div><p>' + L('Any bundle can be extended with single modules.', 'يمكن توسيع أي باقة بوحدات منفردة.') + '</p></div>' +
      '<div class="plan-bundles">' + bundles.map(b => '<article class="plan-bundle"><h3>' + safe(L(b.name, b.nameAr || b.name)) + '</h3>' + (b.demo ? '<span class="plan-demo">' + L('Demonstration configuration', 'إعداد للعرض') + '</span>' : '') + '<p>' + safe(L(b.description, b.descriptionAr || b.description)) + '</p><p class="plan-count">' + b.modules.length + ' ' + L('of', 'من') + ' ' + d.modules.length + ' ' + L('modules', 'وحدات') + '</p></article>').join('') + '</div>' +
      '<div class="plan-table-wrap"><table class="plan-table"><caption>' + L('Modules in each bundle', 'الوحدات في كل باقة') + '</caption><thead><tr><th scope="col">' + L('Module', 'الوحدة') + '</th>' + bundles.map(b => '<th scope="col">' + safe(L(b.name, b.nameAr || b.name)) + '</th>').join('') + '</tr></thead><tbody>' +
      d.modules.map(m => '<tr><th scope="row">' + safe(L(m.en, m.ar)) + '</th>' + bundles.map(b => cell(b, m)).join('') + '</tr>').join('') + '</tbody></table></div>' +
      '<p class="plans-note">' + L('Whether Public Presence includes certificate requests from the public page: ', 'هل يشمل الحضور العام طلبات الشهادات من الصفحة العامة: ') + '<b>' + safe(docs) + '</b>.</p></section>' +
    '<section class="section site-wrap"><div class="section-head"><div><span class="eyebrow">' + L('HOW IT WORKS', 'كيف يعمل') + '</span><h2>' + L('Who chooses', 'من يختار') + '</h2></div></div><ol class="plan-steps">' +
      '<li><b>' + L('A parish that manages itself', 'رعية تدير نفسها') + '</b><span>' + L('Its parish priest switches a bundle or modules on directly.', 'يفعّل كاهن رعيتها باقة أو وحدات مباشرة.') + '</span></li>' +
      '<li><b>' + L('A parish the diocese covers', 'رعية تغطّيها الأبرشية') + '</b><span>' + L('One diocesan arrangement can cover several parishes; their priests ask the diocese for changes.', 'يمكن لترتيب أبرشي واحد أن يغطّي عدة رعايا؛ ويطلب كهنتها التغييرات من الأبرشية.') + '</span></li>' +
      '<li><b>' + L('Changing a plan', 'تغيير الخطة') + '</b><span>' + L('Switching a module off keeps every record, booking and waiting request.', 'إيقاف وحدة يُبقي كل سجلّ وحجز وطلب منتظر.') + '</span></li></ol>' +
      '<p><a class="button" href="index.html">' + L('Sign in to ParishLife', 'تسجيل الدخول إلى ParishLife') + icon('arrow') + '</a> <a class="text-link" href="public.html#directory">' + L('Find a parish', 'ابحث عن رعية') + icon('arrow') + '</a></p></section>';
  app.setAttribute('aria-busy', 'false');
}

async function getJSON(url) {
  const response = await fetch(url, {signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error('Could not load parish information');
  return response.json();
}
async function load() {
  if (trackToken || plansView) return render();
  app.setAttribute('aria-busy', 'true');
  loadFailure = false;
  try {
    const [payload, config] = await Promise.all([getJSON('/api/public/parishes'), mapsConfig ? mapsConfig : getJSON('/api/public/config').catch(() => ({ maps: null }))]);
    mapsConfig = config;
    directory = payload.parishes || [];
    const responses = await Promise.allSettled(directory.map(p => getJSON('/api/public/parishes/' + encodeURIComponent(p.id))));
    details = new Map(); failed = [];
    responses.forEach((result, i) => result.status === 'fulfilled' ? details.set(directory[i].id, result.value) : failed.push(directory[i].id));
    if (filters.town && !directory.some(p => p.town === filters.town)) filters.town = '';
    if (filters.diocese && !directory.some(p => p.diocese === filters.diocese)) filters.diocese = '';
    if (filters.rite && !directory.some(p => p.rite === filters.rite)) filters.rite = '';
  } catch { loadFailure = true; }
  render();
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({behavior:'instant'});
}
function toggleLanguage() {
  lang = lang === 'ar' ? 'en' : 'ar';
  try { localStorage.setItem('pl-lang', lang); } catch {}
  const focused = document.activeElement?.id;
  render();
  if (focused) document.getElementById(focused)?.focus({preventScroll:true});
}
document.querySelectorAll('#lang, #footer-lang').forEach(button => button.addEventListener('click', toggleLanguage));
const menu = document.querySelector('#mobile-nav'), menuButton = document.querySelector('#menu-toggle');
function closeMenu() { menu.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); }
menuButton.addEventListener('click', () => { const opening = menu.hidden; menu.hidden = !opening; menuButton.setAttribute('aria-expanded', String(opening)); });
menu.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) { closeMenu(); menuButton.focus(); } });
addEventListener('resize', () => { if (innerWidth > 900) closeMenu(); }, {passive:true});
updateChrome();
load();

