import { safeRichText } from './rich-text.js';

// The public site reads only the server's published parish projection.
const copy = {
  skip: ['Skip to content', 'انتقل إلى المحتوى'],
  brandSub: ['FAITH & COMMUNITY', 'إيمان وجماعة'],
  directory: ['Find a parish', 'ابحث عن رعية'],
  times: ['Mass times', 'مواعيد القداديس'],
  events: ['Parish life', 'حياة الرعية'],
  aboutNav: ['About', 'عنّا'],
  signIn: ['My ParishLife', 'حسابي'],
  explore: ['Explore', 'استكشف'],
  stayConnected: ['Stay connected', 'ابقَ على تواصل'],
  footerIntro: ['A little closer to your parish. A little closer to one another.', 'أقرب إلى رعيتك. أقرب إلى بعضنا البعض.'],
  footer: ['Information published by participating parishes.', 'معلومات تنشرها الرعايا المشاركة.'],
  photoCredit: ['Illustrative photography · Unsplash ↗', 'صور توضيحية · Unsplash ↗']
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
  chevron: '<path d="m8 5 7 7-7 7"/>'
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
  }).join('') : empty(L('No parishes found', 'لم نعثر على رعايا'), L('Try a different name or choose another town.', 'جرّب اسمًا مختلفًا أو اختر بلدة أخرى.'), '<button class="text-link" id="clear-filters" type="button">' + L('Clear filters', 'إلغاء التصفية') + ' ↗</button>');
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
      empty(L('Times will be shared here', 'ستُنشر المواعيد هنا'), L('Mass and confession information has not been published yet. Visit your parish page for available contact details.', 'لم تُنشر مواعيد القداديس والاعتراف بعد. يمكنك زيارة صفحة رعيتك للاطّلاع على معلومات التواصل المتاحة.'), selected ? '<a class="text-link" href="#contact">' + L('Contact information', 'معلومات التواصل') + ' ↗</a>' : '<a class="text-link" href="#directory">' + L('Find your parish', 'ابحث عن رعيتك') + ' ↗</a>')) +
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
    '<section id="about" class="about-site section site-wrap"><div class="about-symbol" aria-hidden="true">' + icon('church') + '</div><div><span class="eyebrow">' + L('A SHARED PLACE FOR OUR PARISHES', 'مساحة مشتركة لرعايانا') + '</span><h2>' + L('Closer to your parish.<br>Closer to one another.', 'أقرب إلى رعيتك.<br>أقرب إلى بعضنا البعض.') + '</h2><p>' + L('ParishLife brings the information your parish shares into one welcoming place. Explore its story, plan a visit, and keep up with community life — in English or Arabic.', 'يجمع ParishLife المعلومات التي تنشرها رعيتك في مساحة واحدة ترحّب بك. اكتشف حكايتها، وخطّط لزيارة، وتابع حياة الجماعة بالإنجليزية أو العربية.') + '</p><a class="text-link" href="index.html">' + L('Go to My ParishLife', 'انتقل إلى حسابي') + icon('arrow') + '</a></div></section>';
}

function profile(p, d) {
  const name = pair(d.parish, 'name', 'nameAr') || parishName(p);
  const meta = [pair(d.parish, 'town', 'townAr') || townName(p), pair(d.parish, 'rite', 'riteAr')].filter(Boolean).join(' · ');
  const phone = String(d.parish.phone || '').replace(/[^\d+]/g, '');
  const contact = content(d, 'contact');
  return '<div class="site-wrap breadcrumbs"><a href="public.html#directory">' + L('All parishes', 'كل الرعايا') + '</a>' + icon('chevron') + '<span>' + safe(name) + '</span></div>' +
    '<section class="profile-hero"><div class="site-wrap"><span class="eyebrow">' + safe(meta || L('YOUR PARISH COMMUNITY', 'جماعتك الرعوية')) + '</span><h1>' + safe(name) + '</h1><p>' + htmlText(content(d, 'welcome') || L('A place of faith, a life in community.', 'مكان للإيمان وحياة في الجماعة.')) + '</p><div class="actions"><a class="button button-light" href="#times">' + L('Mass & confession', 'القداديس والاعتراف') + icon('clock') + '</a><a class="button button-outline" href="#contact">' + L('Plan your visit', 'خطّط لزيارتك') + icon('arrow') + '</a></div></div></section>' +
    '<nav class="profile-nav" aria-label="' + L('Parish sections', 'أقسام الرعية') + '"><div class="site-wrap"><a href="#about">' + L('Our story', 'حكايتنا') + '</a><a href="#times">' + L('Mass & confession', 'القداديس والاعتراف') + '</a><a href="#events">' + L('What’s on', 'الأحداث') + '</a><a href="#updates">' + L('Announcements', 'الإعلانات') + '</a><a href="#contact">' + L('Visit & contact', 'الزيارة والتواصل') + '</a></div></nav>' +
    '<section id="about" class="section site-wrap parish-about"><div><span class="eyebrow">' + L('ROOTED IN COMMUNITY', 'متجذّرون في الجماعة') + '</span><h2>' + L('Every parish<br>has a story.', 'لكل رعية<br>حكاية.') + '</h2></div><div class="reading-copy"><h3>' + safe(name) + '</h3><p>' + htmlText(content(d, 'history') || L('The parish’s story will appear here when it is published.', 'ستظهر حكاية الرعية هنا عندما تُنشر.')) + '</p>' + (meta ? '<span class="location-note">' + icon('pin') + safe(meta) + '</span>' : '') + '</div></section>' +
    timesSection([p]) + eventsSection([p]) +
    '<section id="updates" class="updates-section"><div class="section site-wrap"><div class="section-head"><div><span class="eyebrow">' + L('FROM YOUR PARISH', 'من رعيتك') + '</span><h2>' + L('The latest, together.', 'جديد جماعتنا.') + '</h2></div></div><div class="updates-grid">' +
    (d.posts?.length ? d.posts.map(post => '<article class="update-card">' + (publishedDate(post.at) ? '<time datetime="' + safe(post.at) + '">' + safe(publishedDate(post.at)) + '</time>' : '') + '<h3>' + safe(post.title) + '</h3><div class="published-body">' + (/<[a-z][\s\S]*>/i.test(post.body || '') ? safeRichText(post.body) : htmlText(post.body)) + '</div></article>').join('') :
      empty(L('Updates will find a home here', 'هنا تجد مستجدّات الرعية'), L('Published parish announcements will appear in this space.', 'ستظهر إعلانات الرعية المنشورة في هذه المساحة.'))) + '</div></div></section>' +
    '<section id="contact" class="section site-wrap contact-section"><div><span class="eyebrow">' + L('YOU ARE WELCOME HERE', 'أهلًا بك') + '</span><h2>' + L('Come say hello.', 'تفضّل بزيارتنا.') + '</h2><p>' + L('Find your way to the parish.<br>We look forward to seeing you.', 'تعرّف على طريقك إلى الرعية.<br>نتطلّع إلى لقائك.') + '</p></div><div class="contact-panel"><h3>' + safe(name) + '</h3>' +
    (contact ? '<p>' + htmlText(contact) + '</p>' : '<p>' + L('Contact and visiting information has not been published yet.', 'لم تُنشر معلومات التواصل والزيارة بعد.') + '</p>') +
    (d.parish.address ? '<div class="contact-row">' + icon('pin') + '<span>' + safe(pair(d.parish, 'address', 'addressAr')) + '</span></div>' : '') +
    (phone ? '<a class="contact-row" href="tel:' + safe(phone) + '">' + icon('phone') + '<bdi>' + safe(d.parish.phone) + '</bdi></a>' : '') +
    '</div></section><div class="back-directory site-wrap"><a class="text-link" href="public.html#directory">' + L('Explore other parishes', 'استكشف رعايا أخرى') + icon('arrow') + '</a></div>';
}

function bindEventToggle(parishes) {
  document.querySelector('#more-events')?.addEventListener('click', () => {
    showAllEvents = !showAllEvents;
    document.querySelector('#events').outerHTML = eventsSection(parishes);
    bindEventToggle(parishes);
    document.querySelector('#more-events')?.focus({preventScroll:true});
  });
}

function render() {
  observer?.disconnect();
  updateChrome();
  const p = directory.find(p => p.id === selected), d = details.get(selected);
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

