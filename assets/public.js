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
  photoCredit: ['Illustrative photography · Unsplash', 'صور توضيحية · Unsplash']
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
const filters = { q: params.get('q') || '', town: params.get('town') || '', sort: params.get('sort') === 'town' ? 'town' : 'name' };
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

function directorySection() {
  const towns = [...new Map(directory.map(p => [p.town, p])).values()].sort((a, b) => townName(a).localeCompare(townName(b), lang));
  return '<section id="directory" class="section directory-section site-wrap">' +
    '<div class="section-head"><div><span class="eyebrow">' + L('OUR PARISHES', 'رعايانا') + '</span><h2>' + L('Find your place.<br><span>Feel at home.</span>', 'اعثر على رعيتك.<br><span>واشعر بالانتماء.</span>') + '</h2></div><p>' + L('Every parish has a story.<br>Discover the community waiting to welcome you.', 'لكل رعية حكاية.<br>اكتشف الجماعة التي ترحّب بك.') + '</p></div>' +
    '<form class="directory-filters" role="search"><label class="search-field">' + icon('search') + '<span class="sr-only">' + L('Search by parish or town', 'ابحث باسم الرعية أو البلدة') + '</span><input id="directory-filter" type="search" value="' + safe(filters.q) + '" placeholder="' + L('Search by parish or town…', 'ابحث باسم الرعية أو البلدة…') + '" autocomplete="off"></label>' +
    '<label class="town-field">' + icon('pin') + '<span class="sr-only">' + L('Filter by town', 'تصفية حسب البلدة') + '</span><select id="town-filter"><option value="">' + L('All towns', 'كل البلدات') + '</option>' + towns.map(p => '<option value="' + safe(p.town) + '"' + (filters.town === p.town ? ' selected' : '') + '>' + safe(townName(p)) + '</option>').join('') + '</select></label>' +
    '<button class="button" type="submit">' + L('Find a parish', 'ابحث عن رعية') + icon('arrow') + '</button></form>' +
    '<div class="results-bar"><p id="results-count" role="status" aria-live="polite"></p><label>' + L('Sort by', 'ترتيب حسب') + ' <select id="sort-filter" aria-label="' + L('Sort parishes', 'ترتيب الرعايا') + '"><option value="name"' + (filters.sort === 'name' ? ' selected' : '') + '>' + L('Parish name', 'اسم الرعية') + '</option><option value="town"' + (filters.sort === 'town' ? ' selected' : '') + '>' + L('Town', 'البلدة') + '</option></select></label></div>' +
    '<div id="directory-cards" class="parish-grid"></div></section>';
}

function renderCards(updateURL = false) {
  const host = document.querySelector('#directory-cards');
  if (!host) return;
  const q = normalize(filters.q.trim());
  const rows = directory.filter(p => (!filters.town || p.town === filters.town) && (!q || normalize([p.name, p.ar, p.town, p.townAr].join(' ')).includes(q)))
    .sort((a, b) => (filters.sort === 'town' ? townName(a) : parishName(a)).localeCompare(filters.sort === 'town' ? townName(b) : parishName(b), lang));
  document.querySelector('#results-count').textContent = L('Showing ' + rows.length + ' of ' + directory.length + ' parishes', 'عرض ' + number(rows.length) + ' من ' + number(directory.length) + ' رعايا');
  host.innerHTML = rows.length ? rows.map((p, i) => {
    const d = details.get(p.id), rite = pair(d?.parish, 'rite', 'riteAr');
    return '<a class="parish-card" href="' + profileURL(p.id) + '"><div class="parish-card-top"><span class="parish-emblem" aria-hidden="true">' + icon('church') + '</span><span class="card-number" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</span></div>' +
      '<div class="card-location">' + icon('pin') + safe(townName(p)) + '</div><h3>' + safe(parishName(p)) + '</h3><p class="parish-other-name" lang="' + L('ar', 'en') + '" dir="' + L('rtl', 'ltr') + '">' + safe(L(p.ar || '', p.name || '')) + '</p><div class="card-bottom"><span>' + safe(rite || L('Parish community', 'جماعة الرعية')) + '</span><span class="card-open">' + L('Explore', 'استكشف') + icon('arrow') + '</span></div></a>';
  }).join('') : empty(L('No parishes found', 'لم نعثر على رعايا'), L('Try a different name or choose another town.', 'جرّب اسمًا مختلفًا أو اختر بلدة أخرى.'), '<button class="text-link" id="clear-filters" type="button">' + L('Clear filters', 'إلغاء التصفية') + icon('arrow') + '</button>');
  document.querySelector('#clear-filters')?.addEventListener('click', () => {
    filters.q = ''; filters.town = ''; document.querySelector('#directory-filter').value = ''; document.querySelector('#town-filter').value = ''; renderCards(true); document.querySelector('#directory-filter').focus();
  });
  if (updateURL) {
    const url = new URL(location.href);
    for (const key of ['q', 'town', 'sort']) filters[key] && !(key === 'sort' && filters[key] === 'name') ? url.searchParams.set(key, filters[key]) : url.searchParams.delete(key);
    history.replaceState(null, '', url);
  }
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
function eventsSection(parishes) {
  const events = eventsFor(parishes), visible = showAllEvents ? events : events.slice(0, 6);
  return '<section id="events" class="section site-wrap"><div class="section-head"><div><span class="eyebrow">' + L('LIFE TOGETHER', 'حياتنا معًا') + '</span><h2>' + L('Come. Gather. Belong.', 'تعال. شارك. انتمِ.') + '</h2></div><p>' + L('Masses, gatherings, and moments<br>that bring us closer.', 'قداديس ولقاءات ولحظات<br>تجمعنا معًا.') + '</p></div>' +
    '<div class="event-list">' + (visible.length ? visible.map(e => {
      const [day, month] = dateParts(e.d);
      return '<article class="event-row"><time class="event-date" datetime="' + safe(e.d) + '"><b>' + safe(day) + '</b><span>' + safe(month) + '</span></time><div class="event-info"><span class="eyebrow">' + safe(eventKind(e.kind)) + '</span><h3>' + safe(pair(e, 'title', 'titleAr')) + '</h3><p>' + safe(parishName(e.parish)) + ' · ' + safe(townName(e.parish)) + '</p></div><span class="event-time">' + (e.t ? icon('clock') + safe(e.t) : '') + '</span>' + (selected ? '' : '<a class="round-link" href="' + profileURL(e.parish.id, '#events') + '" aria-label="' + safe(L('View events at ', 'أحداث رعية ') + parishName(e.parish)) + '">' + icon('arrow') + '</a>') + '</article>';
    }).join('') : empty(L('A little quiet for now', 'لحظات هادئة حاليًا'), L('Upcoming public events will appear here when a parish publishes them.', 'ستظهر الأحداث العامة القادمة هنا عندما تنشرها الرعية.'))) + '</div>' +
    (events.length > 6 ? '<button id="more-events" class="text-link more-events" type="button">' + (showAllEvents ? L('Show fewer events', 'عرض أحداث أقل') : L('View all ' + events.length + ' events', 'عرض كل الأحداث (' + number(events.length) + ')')) + ' ' + icon('arrow') + '</button>' : '') + '</section>';
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
    '<div class="quick-paths site-wrap">' + [
      ['01','church','#directory',L('Find your parish','اعثر على رعيتك'),L('A community close to you','جماعة قريبة منك')],
      ['02','clock','#times',L('Plan a visit','خطّط لزيارة'),L('Make space for a quiet moment','فسحة للحظات هادئة')],
      ['03','calendar','#events',L('Share in parish life','شارك في حياة الرعية'),L('Be part of what’s happening','كن جزءًا ممّا يجري')]
    ].map(([n, ico, href, title, sub]) => '<a href="' + href + '"><span class="path-number">' + n + '</span><span class="path-icon">' + icon(ico) + '</span><span><b>' + title + '</b><small>' + sub + '</small></span>' + icon('arrow') + '</a>').join('') + '</div>' +
    directorySection() +
    '<section class="fixed-story"><div class="site-wrap"><span class="eyebrow">' + L('MORE THAN A PLACE', 'أكثر من مكان') + '</span><h2>' + L('Where faith finds<br>its community.', 'حيث يجد الإيمان<br>جماعته.') + '</h2><p>' + L('In a familiar face. In a shared prayer.<br>In the everyday moments of parish life.', 'في وجهٍ مألوف. في صلاةٍ مشتركة.<br>في لحظات الحياة الرعوية اليومية.') + '</p><a class="button button-light" href="#events">' + L('Discover parish life', 'اكتشف حياة الرعية') + icon('arrow') + '</a></div><span class="story-footnote">' + L('A MOMENT TO PAUSE', 'لحظة للتأمّل') + '</span></section>' +
    timesSection(directory) + eventsSection(directory) +
    '<section id="about" class="about-site section site-wrap"><div class="about-symbol" aria-hidden="true">' + icon('church') + '</div><div><span class="eyebrow">' + L('A SHARED PLACE FOR OUR PARISHES', 'مساحة مشتركة لرعايانا') + '</span><h2>' + L('Closer to your parish.<br>Closer to one another.', 'أقرب إلى رعيتك.<br>أقرب إلى بعضنا البعض.') + '</h2><p>' + L('ParishLife brings the information your parish shares into one welcoming place. Explore its story, plan a visit, and keep up with community life — in English or Arabic.', 'يجمع ParishLife المعلومات التي تنشرها رعيتك في مساحة واحدة ترحّب بك. اكتشف حكايتها، وخطّط لزيارة، وتابع حياة الجماعة بالإنجليزية أو العربية.') + '</p><a class="text-link" href="index.html">' + L('Open the members portal', 'ادخل إلى بوّابة المؤمنين') + icon('arrow') + '</a></div></section>';
}

function profile(p, d) {
  const name = pair(d.parish, 'name', 'nameAr') || parishName(p);
  const meta = [pair(d.parish, 'town', 'townAr') || townName(p), pair(d.parish, 'rite', 'riteAr')].filter(Boolean).join(' · ');
  const phone = String(d.parish.phone || '').replace(/[^\d+]/g, '');
  const contact = content(d, 'contact');
  return '<div class="site-wrap breadcrumbs"><a href="public.html#directory">' + L('All parishes', 'كل الرعايا') + '</a>' + icon('chevron') + '<span>' + safe(name) + '</span></div>' +
    '<section class="profile-hero"><div class="site-wrap"><span class="eyebrow">' + safe(meta || L('YOUR PARISH COMMUNITY', 'جماعتك الرعوية')) + '</span><h1>' + safe(name) + '</h1><p>' + htmlText(content(d, 'welcome') || L('A place of faith, a life in community.', 'مكان للإيمان وحياة في الجماعة.')) + '</p><div class="actions"><a class="button button-light" href="#times">' + L('Mass & confession', 'القداديس والاعتراف') + icon('clock') + '</a><a class="button button-outline" href="#contact">' + L('Plan your visit', 'خطّط لزيارتك') + icon('arrow') + '</a></div></div></section>' +
    '<nav class="profile-nav" aria-label="' + L('Parish sections', 'أقسام الرعية') + '"><div class="site-wrap"><a href="#about">' + L('Our story', 'حكايتنا') + '</a><a href="#times">' + L('Mass & confession', 'القداديس والاعتراف') + '</a><a href="#events">' + L('What’s on', 'الأحداث') + '</a><a href="#ministries">' + L('Ministries', 'الخدمات') + '</a><a href="#sacraments">' + L('Sacraments', 'الأسرار') + '</a><a href="#updates">' + L('Announcements', 'الإعلانات') + '</a><a href="#contact">' + L('Visit & contact', 'الزيارة والتواصل') + '</a></div></nav>' +
    '<section id="about" class="section site-wrap parish-about"><div><span class="eyebrow">' + L('ROOTED IN COMMUNITY', 'متجذّرون في الجماعة') + '</span><h2>' + L('Every parish<br>has a story.', 'لكل رعية<br>حكاية.') + '</h2></div><div class="reading-copy"><h3>' + safe(name) + '</h3><p>' + htmlText(content(d, 'history') || L('The parish’s story will appear here when it is published.', 'ستظهر حكاية الرعية هنا عندما تُنشر.')) + '</p>' + (meta ? '<span class="location-note">' + icon('pin') + safe(meta) + '</span>' : '') + '</div></section>' +
    timesSection([p]) + eventsSection([p]) + ministriesSection(p, d) + sacramentsSection(p, d, phone) +
    '<section id="updates" class="updates-section"><div class="section site-wrap"><div class="section-head"><div><span class="eyebrow">' + L('FROM YOUR PARISH', 'من رعيتك') + '</span><h2>' + L('The latest, together.', 'جديد جماعتنا.') + '</h2></div></div><div class="updates-grid">' +
    (d.posts?.length ? d.posts.map(post => '<article class="update-card">' + (publishedDate(post.at) ? '<time datetime="' + safe(post.at) + '">' + safe(publishedDate(post.at)) + '</time>' : '') + '<h3>' + safe(post.title) + '</h3><div class="published-body">' + (/<[a-z][\s\S]*>/i.test(post.body || '') ? safeRichText(post.body) : htmlText(post.body)) + '</div></article>').join('') :
      empty(L('Updates will find a home here', 'هنا تجد مستجدّات الرعية'), L('Published parish announcements will appear in this space.', 'ستظهر إعلانات الرعية المنشورة في هذه المساحة.'))) + '</div></div></section>' +
    '<section id="contact" class="section site-wrap contact-section"><div><span class="eyebrow">' + L('YOU ARE WELCOME HERE', 'أهلًا بك') + '</span><h2>' + L('Come say hello.', 'تفضّل بزيارتنا.') + '</h2><p>' + L('Find your way to the parish.<br>We look forward to seeing you.', 'تعرّف على طريقك إلى الرعية.<br>نتطلّع إلى لقائك.') + '</p></div><div class="contact-panel"><h3>' + safe(name) + '</h3>' +
    (contact ? '<p>' + htmlText(contact) + '</p>' : '<p>' + L('Contact and visiting information has not been published yet.', 'لم تُنشر معلومات التواصل والزيارة بعد.') + '</p>') +
    (d.parish.address ? '<div class="contact-row">' + icon('pin') + '<span>' + safe(pair(d.parish, 'address', 'addressAr')) + '</span></div>' : '') +
    (phone ? '<a class="contact-row" href="tel:' + safe(phone) + '">' + icon('phone') + '<bdi>' + safe(d.parish.phone) + '</bdi></a>' : '') +
    '</div></section><div class="back-directory site-wrap"><a class="text-link" href="public.html#directory">' + L('Explore other parishes', 'استكشف رعايا أخرى') + icon('arrow') + '</a></div>';
}

/* Public ministries: what each does, who leads it (by name only — never a leader's personal number or
   address), how to join, and a form to say you are interested. The form makes nobody a member. */
function ministriesSection(p, d) {
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

function sacramentsSection(p, d, phone) {
  const intro = content(d, 'sacraments');
  return '<section id="sacraments" class="sacraments-section"><div class="section site-wrap"><div class="section-head"><div><span class="eyebrow">' + L('CELEBRATE WITH US', 'نحتفل معاً') + '</span><h2>' + L('Ask your parish', 'اطلب من رعيتك') + '</h2></div>' +
    '<p>' + (intro ? htmlText(intro) : L('Planning a baptism or a wedding, need a certificate, the parish hall, or something else? Send your request online and follow every step.', 'تخطّط لمعمودية أو إكليل، أو تحتاج إلى شهادة أو إلى قاعة الرعية أو إلى أمر آخر؟ أرسل طلبك عبر الإنترنت وتابع كل خطوة.')) + '</p></div>' +
    '<h3 class="request-group">' + L('Sacraments &amp; certificates', 'الأسرار والشهادات') + '</h3>' +
    '<div class="request-grid">' + REQUESTS.map(requestCard(p, false)).join('') + '</div>' +
    '<h3 class="request-group">' + L('Book a place, or ask for something else', 'احجز مكاناً، أو اطلب أمراً آخر') + '</h3>' +
    '<div class="request-grid request-grid-2">' + OTHER_REQUESTS.map(requestCard(p, true)).join('') + '</div>' + guestDocumentForm(p) +
    '<div class="request-steps"><ol>' +
      '<li><span>01</span><b>' + L('Sign in or create an account', 'سجّل الدخول أو أنشئ حساباً') + '</b><small>' + L('With your phone number or your email. It is free.', 'برقم هاتفك أو ببريدك الإلكتروني. إنه مجاني.') + '</small></li>' +
      '<li><span>02</span><b>' + L('Send your request', 'أرسل طلبك') + '</b><small>' + L('Choose what you need. It takes two minutes.', 'اختر ما تحتاج إليه. يستغرق ذلك دقيقتين.') + '</small></li>' +
      '<li><span>03</span><b>' + L('Follow every step', 'تابع كل خطوة') + '</b><small>' + L('Answers, dates and preparation, with a notification at each step.', 'الأجوبة والمواعيد والتحضير، مع إشعار عند كل خطوة.') + '</small></li></ol>' +
    '<p class="request-note">' + L('No account yet?', 'لا حساب لديك بعد؟') + ' <a href="' + safe(signupURL(p.id)) + '">' + L('Create one in a minute', 'أنشئ حساباً في دقيقة') + icon('arrow') + '</a> ' +
      L('Prefer to talk to someone? Call the parish office.', 'تفضّل التحدّث مع أحد؟ اتصل بمكتب الرعية.') +
      (phone ? ' <a href="tel:' + safe(phone) + '">' + icon('phone') + '<bdi>' + safe(d.parish.phone) + '</bdi></a>' : '') + '</p></div></div></section>';
}

function bindEventToggle(parishes) {
  document.querySelector('#more-events')?.addEventListener('click', () => {
    showAllEvents = !showAllEvents;
    document.querySelector('#events').outerHTML = eventsSection(parishes);
    bindEventToggle(parishes);
    document.querySelector('#more-events')?.focus({preventScroll:true});
  });
}

/* A private tracking link opens its request instead of the directory (the link is the requester's own; pages
   are served with a same-origin referrer policy, so it is not passed on to other sites). */
const trackToken = params.get('track');
function render() {
  observer?.disconnect();
  updateChrome();
  if (trackToken) return trackPage(trackToken);
  const p = directory.find(p => p.id === selected), d = details.get(selected);
  applySiteTheme(p && d ? d.parish.theme : null);   // a parish page wears its parish's colours; the directory stays in Forest
  if (loadFailure) {
    app.innerHTML = '<div class="site-wrap error-page">' + empty(L('We couldn’t load the directory', 'تعذّر تحميل الدليل'), L('Please check your connection and try again.', 'يرجى التحقّق من الاتصال والمحاولة مجدّدًا.'), '<button class="button retry-load" type="button">' + L('Try again', 'حاول مجدّدًا') + '</button>') + '</div>';
  } else if (selected && (!p || !d)) {
    app.innerHTML = '<div class="site-wrap error-page">' + empty(p ? L('This parish page is temporarily unavailable', 'صفحة الرعية غير متاحة حاليًا') : L('Parish not found', 'لم نعثر على الرعية'), L('You can return to the directory and explore another parish.', 'يمكنك العودة إلى الدليل واستكشاف رعية أخرى.'), (p ? '<button class="button retry-load" type="button">' + L('Try again', 'حاول مجدّدًا') + '</button>' : '') + '<a class="text-link" href="public.html#directory">' + L('Back to the directory', 'العودة إلى الدليل') + icon('arrow') + '</a>') + '</div>';
  } else {
    app.innerHTML = (failed.length ? '<div class="site-wrap load-notice" role="status">' + L('Some parish details could not be loaded. ', 'تعذّر تحميل بعض تفاصيل الرعايا. ') + '<button class="text-button retry-load">' + L('Try again', 'حاول مجدّدًا') + '</button></div>' : '') + (selected ? profile(p, d) : home());
  }
  app.setAttribute('aria-busy', 'false');
  document.title = (selected && p ? parishName(p) : L('Find your parish', 'ابحث عن رعيتك')) + ' · ParishLife';
  renderCards();
  document.querySelectorAll('.retry-load').forEach(button => button.addEventListener('click', load));
  document.querySelector('.directory-filters')?.addEventListener('submit', event => { event.preventDefault(); renderCards(true); document.querySelector('#directory-cards')?.scrollIntoView({block:'nearest'}); });
  document.querySelector('#directory-filter')?.addEventListener('input', event => { filters.q = event.target.value; renderCards(true); });
  document.querySelector('#town-filter')?.addEventListener('change', event => { filters.town = event.target.value; renderCards(true); });
  document.querySelector('#sort-filter')?.addEventListener('change', event => { filters.sort = event.target.value; renderCards(true); });
  bindEventToggle(selected && p ? [p] : directory);
  if (selected && p && d) { bindMinistryForm(p); bindGuestForm(p); }
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), {threshold:0.12});
    document.querySelectorAll('.about-symbol, .parish-card').forEach(el => { el.classList.add('reveal'); observer.observe(el); });
  }
}

async function getJSON(url) {
  const response = await fetch(url, {signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error('Could not load parish information');
  return response.json();
}
async function load() {
  if (trackToken) return render();
  app.setAttribute('aria-busy', 'true');
  loadFailure = false;
  try {
    const payload = await getJSON('/api/public/parishes');
    directory = payload.parishes || [];
    const responses = await Promise.allSettled(directory.map(p => getJSON('/api/public/parishes/' + encodeURIComponent(p.id))));
    details = new Map(); failed = [];
    responses.forEach((result, i) => result.status === 'fulfilled' ? details.set(directory[i].id, result.value) : failed.push(directory[i].id));
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
function closeMenu() { menu.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); }
menuButton.addEventListener('click', () => { const opening = menu.hidden; menu.hidden = !opening; menuButton.setAttribute('aria-expanded', String(opening)); });
menu.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) { closeMenu(); menuButton.focus(); } });
addEventListener('resize', () => { if (innerWidth > 900) closeMenu(); }, {passive:true});
updateChrome();
load();

