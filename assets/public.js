import { applySiteTheme } from './theme.js';
import { bundlePage, errorPage, bindRequest, trackingPage, verifyPage, photos, parishPhotos, paginateCollections } from './public-features.js';
import { homeView, mountHome, unmountHome } from './home.js';
import { trackView, watchActions } from './beacon.js';
import { parishView, mountParish, requestView, calendarPageView, eventView, mountSubpage, mountPlain, unmountParish } from './parish.js';

document.addEventListener('error',event=>{
  const image=event.target;
  if(!(image instanceof HTMLImageElement)||!image.matches('.parish-card-photo,.profile-photo,.public-gallery img')||image.dataset.defaultPhoto)return;
  image.dataset.defaultPhoto='true';image.src=photos[0];
  image.alt=document.documentElement.lang==='ar'?'صورة توضيحية افتراضية لكنيسة':'Default illustrative church photograph';
  const caption=image.closest('figure')?.querySelector('figcaption');if(caption)caption.textContent=image.alt;
},true);

// The public site reads only the server's published parish projection.
const copy = {
  skip: ['Skip to content', 'انتقل إلى المحتوى'],
  directory: ['Find a parish', 'ابحث عن رعية'],
  week: ['This week', 'هذا الأسبوع'],
  times: ['Mass times', 'مواعيد القداديس'],
  requests: ['Ask your parish', 'اطلب من رعيتك'],
  aboutNav: ['About ParishLife', 'عن ParishLife'],
  signIn: ['Members portal', 'بوّابة المؤمنين'],
  explore: ['Explore', 'استكشف'],
  forParishes: ['For parishes', 'للرعايا'],
  bundles: ['ParishLife bundles', 'باقات ParishLife'],
  verify: ['Check a signed document', 'التحقّق من وثيقة موقّعة'],
  footerIntro: ['The parishes of Lebanon, each with its light on.', 'رعايا لبنان، ولكلّ منها نورها.'],
  footer: ['Information published by participating parishes.', 'معلومات تنشرها الرعايا المشاركة.'],
  mapCredit: ['Map outline from Natural Earth', 'حدود الخريطة من Natural Earth'],
  photoCredit: ['Illustrative photographs from Unsplash', 'صور توضيحية من Unsplash']
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
/* A shared link can carry its language (?lang=ar), so it opens as the sender saw it. */
if (['ar', 'en'].includes(new URLSearchParams(location.search).get('lang'))) {
  lang = new URLSearchParams(location.search).get('lang');
  try { localStorage.setItem('pl-lang', lang); } catch {}
}
const L = (en, ar) => lang === 'ar' ? ar : en;
const T = key => L(...copy[key]);
const pair = (obj, en = 'en', ar = 'ar') => obj?.[lang === 'ar' ? ar : en] || obj?.[en] || obj?.[ar] || '';
const parishName = p => pair(p, 'name', 'ar');
const townName = p => pair(p, 'town', 'townAr');
const number = value => new Intl.NumberFormat(lang === 'ar' ? 'ar-LB' : 'en').format(value);
const profileURL = (id, hash = '') => 'public.html?parish=' + encodeURIComponent(id) + hash;
/* Visitors can request without an account; the office owns subsequent processing. */
const requestURL = (id, kind) => 'public.html?parish=' + encodeURIComponent(id) + '&request=' + encodeURIComponent(kind);
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
const localToday = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };
const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').toLowerCase();
const params = new URLSearchParams(location.search);
const filters = { diocese:'', rite:'', location:null, q: params.get('q') || '', town: params.get('town') || '', sort: params.get('sort') === 'town' ? 'town' : 'name' };
let directory = [], details = new Map(), site = null, selected = params.get('parish'), failed = [], loadFailure = false;
const app = document.querySelector('#app');
const content = (d, key) => pair(d?.content?.[key]);

function updateChrome() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = T(el.dataset.i18n); });
  document.querySelectorAll('#lang, #footer-lang').forEach(el => {
    el.textContent = L('العربية', 'English');
    el.lang = lang === 'ar' ? 'en' : 'ar';
    el.setAttribute('aria-label', L('Switch to Arabic', 'التبديل إلى الإنكليزية'));
  });
  document.querySelector('#menu-toggle').setAttribute('aria-label', L('Toggle navigation', 'فتح أو إغلاق القائمة'));
  document.querySelectorAll('.site-header .brand').forEach(el => el.setAttribute('aria-label', L('ParishLife home', 'الصفحة الرئيسية لـ ParishLife')));
  document.querySelector('.desktop-nav')?.setAttribute('aria-label', L('Main navigation', 'القائمة الرئيسية'));
  document.querySelector('#mobile-nav')?.setAttribute('aria-label', L('Mobile navigation', 'قائمة الهاتف'));
  document.querySelector('#year').textContent = new Date().getFullYear();
}

function publishedDate(value) {
  const date = new Date(value?.length === 10 ? value + 'T12:00:00' : value);
  return Number.isNaN(date.valueOf()) ? '' : new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB' : 'en', {dateStyle:'medium'}).format(date);
}
/* Everything the homepage reads, shared by its view and its behaviour. */
const eventURL = (id, eventId) => 'public.html?parish=' + encodeURIComponent(id) + '&event=' + encodeURIComponent(eventId);
/* The calendar feed of a parish, for calendars to subscribe to (webcal opens the calendar app). */
const feedURL = (id, scheme = location.protocol) => scheme.replace(':', '') + '://' + location.host + '/api/public/parishes/' + encodeURIComponent(id) + '/calendar.ics' + (lang === 'ar' ? '?lang=ar' : '');
/* A link to share: absolute, and in the language the visitor is reading. */
const shareURL = path => new URL(path + (lang === 'ar' ? (path.includes('?') ? '&' : '?') + 'lang=ar' : ''), location.href).href;
const homeContext = () => ({ lang, L, safe, htmlText, icon, directory, details, site, filters, pair, parishName, townName, number, normalize, localToday,
  content: (d, key) => content(d, key), profileURL, requestURL, calendarURL: id => 'public.html?parish=' + encodeURIComponent(id) + '&view=calendar',
  eventURL, feedURL, shareURL, REQUESTS, OTHER_REQUESTS, parishPhotos, publishedDate });

function render() {
  unmountHome();
  unmountParish();
  updateChrome();
  const p = directory.find(p => p.id === selected), d = details.get(selected);
  applySiteTheme(null);
  const token=location.hash.startsWith('#track=')?location.hash.slice(7):'';
  const verify = params.get('verify') ?? (params.get('view') === 'verify' ? '' : null);
  if (verify !== null) { verifyPage(app, verify); trackView('verify'); document.title = L('Check a signed document', 'التحقّق من وثيقة موقّعة') + ' · ParishLife'; app.setAttribute('aria-busy', 'false'); requestAnimationFrame(() => document.body.classList.add('is-ready')); return; }
  if(token){trackingPage(app,token);trackView('track');app.setAttribute('aria-busy','false');requestAnimationFrame(() => document.body.classList.add('is-ready'));return;}
  if (loadFailure) {
    app.innerHTML = errorPage(L('We couldn’t load the directory', 'تعذّر تحميل الدليل'), L('Please check your connection and try again.', 'يرجى التحقّق من الاتصال والمحاولة مجدّدًا.'), '<button class="btn btn-gilt retry-load" type="button">' + L('Try again', 'حاول مجدّدًا') + '</button>');
    mountPlain(app);
    trackView('error');
  } else if (selected && (!p || !d)) {
    app.innerHTML = errorPage(p ? L('This parish page is temporarily unavailable', 'صفحة الرعية غير متاحة حاليًا') : L('Parish not found', 'لم نعثر على الرعية'), p ? L('Its details could not be loaded just now. Try again, or explore another parish.', 'تعذّر تحميل تفاصيلها الآن. حاول مجدّدًا أو استكشف رعية أخرى.') : L('This link does not lead to a parish on ParishLife. It may have been mistyped, or the parish may have left.', 'هذا الرابط لا يقود إلى رعية على ParishLife. ربما كُتب خطأً، أو لم تعد الرعية مسجّلة.'), (p ? '<button class="btn btn-gilt retry-load" type="button">' + L('Try again', 'حاول مجدّدًا') + '</button>' : '') + '<a class="btn ' + (p ? 'btn-ink-line' : 'btn-gilt') + '" href="public.html#directory">' + L('Find a parish', 'ابحث عن رعية') + '</a>');
    mountPlain(app);
    trackView('error', p ? p.id : '');
  } else {
    const isHome = params.get('view') !== 'bundles' && !selected, c = homeContext();
    const page = params.get('view') === 'bundles' ? 'bundles' : !selected ? 'home' : params.has('request') ? (d.publicRequests === false ? 'closed' : 'request') : params.get('view') === 'calendar' ? 'calendar' : params.has('event') ? 'event' : 'parish';
    app.innerHTML = (navigator.onLine === false ? '<div class="site-wrap load-notice" role="status">' + L('You are offline. This is what ParishLife showed on this device last time.', 'أنت غير متصل بالإنترنت. هذا ما عرضه ParishLife على هذا الجهاز في المرة الأخيرة.') + '</div>' : '') + (failed.length ? '<div class="site-wrap load-notice" role="status">' + L('Some parish details could not be loaded. ', 'تعذّر تحميل بعض تفاصيل الرعايا. ') + '<button class="text-button retry-load">' + L('Try again', 'حاول مجدّدًا') + '</button></div>' : '') + ({
      bundles: () => bundlePage(),
      home: () => homeView(c),
      closed: () => errorPage(L('Contact the parish office', 'تواصل مع مكتب الرعية'), L('This parish takes requests through its office rather than online.', 'تستقبل هذه الرعية الطلبات عبر مكتبها لا عبر الإنترنت.') + (d.parish.phone ? ' <bdi>' + safe(d.parish.phone) + '</bdi>' : ''),
        (d.parish.phone ? `<a class="btn btn-gilt" href="tel:${safe(String(d.parish.phone).replace(/[^\d+]/g, ''))}">${L('Call the parish office', 'اتصل بمكتب الرعية')}</a>` : '') + `<a class="btn btn-ink-line" href="public.html?parish=${encodeURIComponent(p.id)}">${L('Parish page', 'صفحة الرعية')}</a>`),
      request: () => requestView(c, p, d, params.get('request')),
      calendar: () => calendarPageView(c, p, d),
      event: () => eventView(c, p, d, params.get('event')),
      parish: () => parishView(c, p, d)
    })[page]();
    if (isHome) mountHome(app, c);
    else if (page === 'parish') mountParish(app, c, p, d);
    else if (page === 'request' || page === 'calendar' || page === 'event') mountSubpage(app, c, p, d);
    else mountPlain(app);
    trackView(page === 'closed' ? 'request' : page, p ? p.id : '');
  }
  app.setAttribute('aria-busy', 'false');
  document.title = app.querySelector('[data-doc-title]')?.dataset.docTitle || (selected && p ? parishName(p) : L('Find your parish', 'ابحث عن رعيتك')) + ' · ParishLife';
  if(p&&d)bindRequest(app,p);
  paginateCollections(app);
  document.querySelectorAll('.retry-load').forEach(button => button.addEventListener('click', load));
  document.body.classList.toggle('is-home', !!document.querySelector('[data-home]'));
  requestAnimationFrame(() => document.body.classList.add('is-ready'));
}

async function getJSON(url) {
  const response = await fetch(url, {signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error('Could not load parish information');
  return response.json();
}
async function load() {
  app.setAttribute('aria-busy', 'true');
  loadFailure = false;
  try {
    // One overview of every parish; the homepage content is optional (without it the page uses its built-in wording).
    const [overview, siteContent] = await Promise.all([getJSON('/api/public/overview'), getJSON('/api/public/site').catch(() => null)]);
    directory = overview.parishes || [];
    site = siteContent;
    details = new Map(Object.entries(overview.details || {})); failed = [];
    // A parish's own pages need everything its office published, not only the overview's share.
    if (selected && directory.some(p => p.id === selected)) {
      try { details.set(selected, await getJSON('/api/public/parishes/' + encodeURIComponent(selected))); }
      catch { details.delete(selected); failed.push(selected); }
    }
    if (filters.town && !directory.some(p => p.town === filters.town)) filters.town = '';
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
function closeMenu() { menu.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); document.body.classList.remove('menu-open'); }
menuButton.addEventListener('click', () => { const opening = menu.hidden; menu.hidden = !opening; menuButton.setAttribute('aria-expanded', String(opening)); document.body.classList.toggle('menu-open', opening); });
menu.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) { closeMenu(); menuButton.focus(); } });
addEventListener('resize', () => { if (innerWidth > 900) closeMenu(); }, {passive:true});
updateChrome();
watchActions(() => selected || '');
load();
/* Installable, and readable offline with what it last showed (see sw.js). */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost'))
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
addEventListener('online', () => { if (loadFailure || document.querySelector('.load-notice')) load(); });

