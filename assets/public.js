import { safeRichText } from './rich-text.js';
import { applySiteTheme } from './theme.js';
import { bundlePage, communitySlider, bindSlider, parishExtras, bindPublicCalendar, requestPage, bindRequest, trackingPage, photos, parishPhotos, paginateCollections } from './public-features.js';

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
const requestCard = (p, wide) => ([kind, art, title, sub]) => '<a class="request-card' + (wide ? ' request-card-wide' : '') + '" href="' + safe(requestURL(p.id, kind)) + '"><span class="request-icon">' + icon(art) + '</span><span class="request-text"><strong>' + L(...title) + '</strong><small>' + L(...sub) + '</small></span><span class="request-go">' + L('Start a request', 'ابدأ الطلب') + icon('arrow') + '</span></a>';
const signupURL = id => 'index.html?parish=' + encodeURIComponent(id) + '&signup=1#/myrequests';
const localToday = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };
const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').toLowerCase();
const params = new URLSearchParams(location.search);
const filters = { diocese:'', rite:'', view:'list', radius:25, location:null, q: params.get('q') || '', town: params.get('town') || '', sort: params.get('sort') === 'town' ? 'town' : 'name' };
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
  const choices=(key,label)=>`<label><span class="sr-only">${label}</span><select id="${key}-filter"><option value="">${label}</option>${[...new Set(directory.map(p=>key==='rite'?(details.get(p.id)?.parish.rite||''):p[key]).filter(Boolean))].sort().map(v=>`<option value="${safe(v)}" ${filters[key]===v?'selected':''}>${safe(v)}</option>`).join('')}</select></label>`;
  return `<section id="directory" class="section directory-section site-wrap"><div class="section-head"><div><span class="eyebrow">${L('OUR PARISHES','رعايانا')}</span><h2>${L('Find your place.<br><span>Feel at home.</span>','اعثر على رعيتك.<br><span>واشعر بالانتماء.</span>')}</h2></div></div>
    <form class="directory-filters" role="search"><label>${icon('search')}<input id="directory-filter" type="search" value="${safe(filters.q)}" placeholder="${L('Search parish or town','ابحث عن رعية أو بلدة')}" aria-label="${L('Search parish or town','ابحث عن رعية أو بلدة')}"></label>${choices('town',L('All locations','كل المواقع'))}${choices('diocese',L('All dioceses','كل الأبرشيات'))}${choices('rite',L('All rites','كل الطقوس'))}</form>
    <div class="directory-view"><div role="group" aria-label="${L('Directory view','عرض الدليل')}"><button data-directory-view="list" aria-pressed="${filters.view==='list'}">${L('List','قائمة')}</button><button data-directory-view="map" aria-pressed="${filters.view==='map'}">${L('Map preview','معاينة الخريطة')}</button></div><button id="reset-filters">${L('Reset filters','إعادة ضبط المرشّحات')}</button><button id="use-location">${L('Use my location','استخدم موقعي')}</button><label>${L('Nearby radius','نطاق القرب')} <select id="nearby-radius">${[5,10,25,50,100].map(v=>`<option value="${v}" ${filters.radius===v?'selected':''}>${v} km</option>`).join('')}</select></label><span id="location-status" role="status"></span></div>
    <div class="results-bar"><p id="results-count" role="status"></p><label>${L('Sort by','ترتيب حسب')} <select id="sort-filter"><option value="name">${L('Parish name','اسم الرعية')}</option><option value="town">${L('Town','البلدة')}</option></select></label></div><div id="directory-map" hidden></div><div id="directory-cards" class="parish-grid" data-paginate></div></section>`;
}
function distance(p) {
  const v=details.get(p.id)?.visit;
  if(!filters.location||v?.latitude===''||v?.longitude===''||!Number.isFinite(Number(v?.latitude))||!Number.isFinite(Number(v?.longitude)))return null;
  const [lat,lon]=filters.location,rad=x=>x*Math.PI/180,a=rad(Number(v.latitude)-lat),b=rad(Number(v.longitude)-lon);
  return 6371*2*Math.atan2(Math.sqrt(Math.sin(a/2)**2+Math.cos(rad(lat))*Math.cos(rad(Number(v.latitude)))*Math.sin(b/2)**2),Math.sqrt(1-(Math.sin(a/2)**2+Math.cos(rad(lat))*Math.cos(rad(Number(v.latitude)))*Math.sin(b/2)**2)));
}
function renderCards(updateURL=false) {
  const host=document.querySelector('#directory-cards');if(!host)return;
  const q=normalize(filters.q.trim()),rows=directory.filter(p=>(!filters.town||p.town===filters.town)&&(!filters.diocese||p.diocese===filters.diocese)&&(!filters.rite||details.get(p.id)?.parish.rite===filters.rite)&&(!q||normalize([p.name,p.ar,p.town,p.townAr].join(' ')).includes(q)))
    .sort((a,b)=>filters.location?(distance(a)??Infinity)-(distance(b)??Infinity)||(parishName(a).localeCompare(parishName(b),lang)):(filters.sort==='town'?townName(a):parishName(a)).localeCompare(filters.sort==='town'?townName(b):parishName(b),lang));
  document.querySelector('#results-count').textContent=L(`${rows.length} registered parishes`,`${number(rows.length)} رعايا مسجّلة`);
  host.hidden=filters.view==='map';
  host.innerHTML=rows.map((p,i)=>{const km=distance(p),custom=parishPhotos(details.get(p.id));return `<a class="parish-card" href="${profileURL(p.id)}"><img class="parish-card-photo" src="${safe(custom[0]||photos[i%photos.length])}" loading="lazy" alt="${custom.length?safe(parishName(p)):L('Default illustrative church photograph','صورة افتراضية توضيحية لكنيسة')}"><div class="card-location">${icon('pin')}${safe(townName(p))}</div><h3>${safe(parishName(p))}</h3><p>${safe(details.get(p.id)?.parish.rite||'')}</p>${km!==null?`<small>${km.toFixed(1)} km · ${km<=filters.radius?L('Within chosen radius','ضمن النطاق'):L('Outside radius — still available','خارج النطاق — متاحة أيضاً')}</small>`:''}<div class="card-bottom"><span>${L('View parish','عرض الرعية')}</span>${icon('arrow')}</div></a>`;}).join('')||empty(L('No parishes found','لا رعايا مطابقة'),L('Try another filter.','جرّب مرشّحاً آخر.'));
  const map=document.querySelector('#directory-map');map.hidden=filters.view!=='map';
  map.innerHTML=`<div class="map-preview"><h3>${L('Google Maps preview · not configured','معاينة خرائط Google · لم يتم الإعداد')}</h3><p>${L('The directory below is a preview, not a geographic map. Live map tiles and parish pins will be available after integration is configured.','هذا عرض تمهيدي للدليل وليس خريطة جغرافية. تتوفر الخريطة والمواقع بعد الإعداد.')}</p><div class="map-preview-links" data-paginate>${rows.map(p=>`<a href="${profileURL(p.id)}">${icon('pin')}${safe(parishName(p))} · ${safe(townName(p))}</a>`).join('')}</div></div>`;
  paginateCollections(document.querySelector('#directory'));
  if(updateURL){const url=new URL(location.href);for(const key of ['q','town','sort'])filters[key]?url.searchParams.set(key,filters[key]):url.searchParams.delete(key);history.replaceState(null,'',url);}
}
function bindDirectory() {
  document.querySelectorAll('[data-directory-view]').forEach(b=>b.onclick=()=>{filters.view=b.dataset.directoryView;document.querySelectorAll('[data-directory-view]').forEach(x=>x.setAttribute('aria-pressed',x===b));renderCards();});
  for(const key of ['diocese','rite'])document.querySelector('#'+key+'-filter')?.addEventListener('change',e=>{filters[key]=e.target.value;renderCards(true);});
  document.querySelector('#reset-filters')?.addEventListener('click',()=>{Object.assign(filters,{q:'',town:'',diocese:'',rite:'',location:null,radius:25});render();});
  document.querySelector('#nearby-radius')?.addEventListener('change',e=>{filters.radius=Number(e.target.value);renderCards();});
  document.querySelector('#use-location')?.addEventListener('click',()=>{
    const status=document.querySelector('#location-status');status.textContent=L('Requesting location…','جارٍ طلب الموقع…');
    if(!navigator.geolocation){status.textContent=L('Location is unavailable. All parishes remain visible.','الموقع غير متوفر. تبقى كل الرعايا متاحة.');return;}
    navigator.geolocation.getCurrentPosition(position=>{filters.location=[position.coords.latitude,position.coords.longitude];status.textContent=L('Nearby first where coordinates are published. All distances remain available.','الأقرب أولاً حيث تتوفر الإحداثيات. تبقى جميع الرعايا متاحة.');renderCards();},()=>status.textContent=L('Location unavailable. You can still browse every parish.','الموقع غير متوفر. يمكنك تصفّح كل الرعايا.'),{timeout:10000,maximumAge:60000});
  });
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
  const hasTimes=parishes.filter(p=>content(details.get(p.id),'massTimes'));
  return `<section id="times" class="times-section"><div class="site-wrap times-layout"><div><span class="eyebrow">${L('MAKE TIME FOR WHAT MATTERS','وقتٌ لما يهمّنا')}</span><h2>${L('A moment<br>of peace.','لحظة<br>سلام.')}</h2><p>${L('Find published Mass and confession information, and plan your next visit.','اطّلع على مواعيد القداديس والاعتراف المنشورة وخطّط لزيارتك القادمة.')}</p>${icon('cross')}</div><div class="times-list" data-paginate>${hasTimes.map(p=>{
    const phone=String(details.get(p.id)?.parish.phone||'').replace(/[^\d+]/g,'');
    const action=selected?(phone?`<a class="text-link" href="tel:${safe(phone)}">${L('Call the parish office','اتصل بمكتب الرعية')}</a>`:''):`<a class="text-link" href="${profileURL(p.id)}">${L('Visit parish page','صفحة الرعية')}</a>`;
    return `<details class="mass-detail" ${selected?'open':''}><summary><span><small>${safe(townName(p))}</small><strong>${safe(parishName(p))}</strong></span><span class="details-plus" aria-hidden="true">+</span></summary><div class="mass-body"><p>${htmlText(content(details.get(p.id),'massTimes'))}</p>${action}</div></details>`;
  }).join('')||empty(L('Times will be shared here','ستُنشر المواعيد هنا'),L('The parish office can confirm Mass and confession times.','يمكن لمكتب الرعية تأكيد مواعيد القداديس والاعتراف.'))}</div></div></section>`;
}

function home() {
  return '<section class="hero site-wrap"><div class="hero-copy"><span class="eyebrow"><span class="eyebrow-dot"></span>' + L('ROOTED IN FAITH. CONNECTED IN LIFE.', 'متجذّرون في الإيمان. متّصلون بالحياة.') + '</span><h1>' + L('A place to pray.<br>A community<br>to <em>belong.</em>', 'مكانٌ للصلاة.<br>جماعةٌ<br><em>للانتماء.</em>') + '</h1><p>' + L('Discover parishes, find a moment of peace, and stay close to the life of your community.', 'اكتشف الرعايا، واعثر على لحظة سلام، وابقَ قريبًا من حياة جماعتك.') + '</p><div class="actions"><a class="button" href="#directory">' + L('Find your parish', 'ابحث عن رعيتك') + icon('arrow') + '</a><a class="text-link" href="#times">' + L('Explore Mass times', 'مواعيد القداديس') + '</a></div><div class="hero-note"><span class="note-line"></span>' + L('Your parish. Your people. Your place.', 'رعيّتك. جماعتك. مكانك.') + '</div></div>' +
    '<div class="hero-art"><div class="hero-photo" role="img" aria-label="' + L('Sunlight filling a quiet church interior; illustrative photograph', 'ضوء الشمس في كنيسة هادئة؛ صورة توضيحية') + '"></div><div class="photo-caption"><span class="caption-mark">' + icon('cross') + '</span><span>' + L('Faith brings us together.', 'الإيمان يجمعنا.') + '<small>' + L('A COMMUNITY BEGINS WITH YOU', 'الجماعة تبدأ بك') + '</small></span></div><span class="vertical-label" aria-hidden="true">PARISHLIFE — LEBANON</span></div></section>' +
    directorySection() + communitySlider() + timesSection(directory) +
    '<section id="about" class="about-site section site-wrap"><div class="about-symbol" aria-hidden="true">' + icon('church') + '</div><div><span class="eyebrow">' + L('A SHARED PLACE FOR OUR PARISHES', 'مساحة مشتركة لرعايانا') + '</span><h2>' + L('Closer to your parish.<br>Closer to one another.', 'أقرب إلى رعيتك.<br>أقرب إلى بعضنا البعض.') + '</h2><p>' + L('ParishLife brings the information your parish shares into one welcoming place. Explore its story, plan a visit, and keep up with community life — in English or Arabic.', 'يجمع ParishLife المعلومات التي تنشرها رعيتك في مساحة واحدة ترحّب بك. اكتشف حكايتها، وخطّط لزيارة، وتابع حياة الجماعة بالإنجليزية أو العربية.') + '</p><a class="text-link" href="index.html">' + L('Open the members portal', 'ادخل إلى بوّابة المؤمنين') + icon('arrow') + '</a><a class="text-link" href="public.html?view=bundles">' + L('ParishLife bundles','باقات ParishLife') + '</a></div></section>';
}

function profileActions(p,d){
  return `<div class="actions">${d.publicRequests===false?'':`<a class="button button-light" href="public.html?parish=${encodeURIComponent(p.id)}&request=certificate">${L('Make a request · no account needed','قدّم طلباً · دون حساب')}</a>`}<a class="button button-outline" href="public.html?parish=${encodeURIComponent(p.id)}&view=calendar">${L('Open parish calendar','افتح رزنامة الرعية')}</a></div>`;
}
function profileImage(p,d){
  const custom=parishPhotos(d);
  return `<figure class="site-wrap profile-photo-wrap"><img class="profile-photo" src="${safe(custom[0]||photos[0])}" alt="${custom.length?safe(parishName(p)):L('Illustrative church photograph','صورة توضيحية لكنيسة')}" loading="lazy"></figure>`;
}
function profile(p, d) {
  const name = pair(d.parish, 'name', 'nameAr') || parishName(p);
  const meta = [pair(d.parish, 'town', 'townAr') || townName(p), pair(d.parish, 'rite', 'riteAr')].filter(Boolean).join(' · ');
  const phone = String(d.parish.phone || '').replace(/[^\d+]/g, '');
  const contact = content(d, 'contact');
  return '<div class="site-wrap breadcrumbs"><a href="public.html#directory">' + L('All parishes', 'كل الرعايا') + '</a>' + icon('chevron') + '<span>' + safe(name) + '</span></div>' +
    '<section class="profile-hero"><div class="site-wrap"><span class="eyebrow">' + safe(meta || L('YOUR PARISH COMMUNITY', 'جماعتك الرعوية')) + '</span><h1>' + safe(name) + '</h1><p>' + htmlText(content(d, 'welcome') || L('A place of faith, a life in community.', 'مكان للإيمان وحياة في الجماعة.')) + '</p>' + profileActions(p,d) + '</div></section>' + profileImage(p,d) +
    '<section id="about" class="section site-wrap parish-about"><div><span class="eyebrow">' + L('ROOTED IN COMMUNITY', 'متجذّرون في الجماعة') + '</span><h2>' + L('Every parish<br>has a story.', 'لكل رعية<br>حكاية.') + '</h2></div><div class="reading-copy"><h3>' + safe(name) + '</h3><p>' + htmlText(content(d, 'history') || L('The parish’s story will appear here when it is published.', 'ستظهر حكاية الرعية هنا عندما تُنشر.')) + '</p>' + (meta ? '<span class="location-note">' + icon('pin') + safe(meta) + '</span>' : '') + '</div></section>' +
    timesSection([p]) + parishExtras(p,d) + sacramentsSection(p, d, phone) +
    '<section id="updates" class="updates-section"><div class="section site-wrap"><div class="section-head"><div><span class="eyebrow">' + L('FROM YOUR PARISH', 'من رعيتك') + '</span><h2>' + L('The latest, together.', 'جديد جماعتنا.') + '</h2></div></div><div class="updates-grid" data-paginate>' +
    (d.posts?.length ? d.posts.map(post => '<article class="update-card">' + (publishedDate(post.at) ? '<time datetime="' + safe(post.at) + '">' + safe(publishedDate(post.at)) + '</time>' : '') + '<h3>' + safe(post.title) + '</h3><div class="published-body">' + (/<[a-z][\s\S]*>/i.test(post.body || '') ? safeRichText(post.body) : htmlText(post.body)) + '</div></article>').join('') :
      empty(L('Updates will find a home here', 'هنا تجد مستجدّات الرعية'), L('Published parish announcements will appear in this space.', 'ستظهر إعلانات الرعية المنشورة في هذه المساحة.'))) + '</div></div></section>' +
    '<section id="contact" class="section site-wrap contact-section"><div><span class="eyebrow">' + L('YOU ARE WELCOME HERE', 'أهلًا بك') + '</span><h2>' + L('Come say hello.', 'تفضّل بزيارتنا.') + '</h2><p>' + L('Find your way to the parish.<br>We look forward to seeing you.', 'تعرّف على طريقك إلى الرعية.<br>نتطلّع إلى لقائك.') + '</p></div><div class="contact-panel"><h3>' + safe(name) + '</h3>' +
    (contact ? '<p>' + htmlText(contact) + '</p>' : '<p>' + L('Contact and visiting information has not been published yet.', 'لم تُنشر معلومات التواصل والزيارة بعد.') + '</p>') +
    (d.parish.address ? '<div class="contact-row">' + icon('pin') + '<span>' + safe(pair(d.parish, 'address', 'addressAr')) + '</span></div>' : '') +
    (phone ? '<a class="contact-row" href="tel:' + safe(phone) + '">' + icon('phone') + '<bdi>' + safe(d.parish.phone) + '</bdi></a>' : '') +
    '</div></section><div class="back-directory site-wrap"><a class="text-link" href="public.html#directory">' + L('Explore other parishes', 'استكشف رعايا أخرى') + icon('arrow') + '</a></div>';
}

function sacramentsSection(p, d, phone) {
  if(d.publicRequests===false)return '';
  const intro = content(d, 'sacraments');
  return '<section id="sacraments" class="sacraments-section"><div class="section site-wrap"><div class="section-head"><div><span class="eyebrow">' + L('CELEBRATE WITH US', 'نحتفل معاً') + '</span><h2>' + L('Ask your parish', 'اطلب من رعيتك') + '</h2></div>' +
    '<p>' + (intro ? htmlText(intro) : L('Planning a baptism or a wedding, need a certificate, the parish hall, or something else? Send your request online and follow every step.', 'تخطّط لمعمودية أو إكليل، أو تحتاج إلى شهادة أو إلى قاعة الرعية أو إلى أمر آخر؟ أرسل طلبك عبر الإنترنت وتابع كل خطوة.')) + '</p></div>' +
    '<h3 class="request-group">' + L('Sacraments &amp; certificates', 'الأسرار والشهادات') + '</h3>' +
    '<div class="request-grid">' + REQUESTS.map(requestCard(p, false)).join('') + '</div>' +
    '<h3 class="request-group">' + L('Book a place, or ask for something else', 'احجز مكاناً، أو اطلب أمراً آخر') + '</h3>' +
    '<div class="request-grid request-grid-2">' + OTHER_REQUESTS.map(requestCard(p, true)).join('') + '</div>' +
    '<p class="request-note">' + L('No account needed. Submit your request and keep the private tracking link. The parish office reviews each request.', 'لا حاجة لحساب. أرسل طلبك واحتفظ برابط المتابعة الخاص. يراجع المكتب كل طلب.') + '</p></div></section>';

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
  applySiteTheme(null);
  const token=location.hash.startsWith('#track=')?location.hash.slice(7):'';
  if(token){trackingPage(app,token);app.setAttribute('aria-busy','false');return;}
  if (loadFailure) {
    app.innerHTML = '<div class="site-wrap error-page">' + empty(L('We couldn’t load the directory', 'تعذّر تحميل الدليل'), L('Please check your connection and try again.', 'يرجى التحقّق من الاتصال والمحاولة مجدّدًا.'), '<button class="button retry-load" type="button">' + L('Try again', 'حاول مجدّدًا') + '</button>') + '</div>';
  } else if (selected && (!p || !d)) {
    app.innerHTML = '<div class="site-wrap error-page">' + empty(p ? L('This parish page is temporarily unavailable', 'صفحة الرعية غير متاحة حاليًا') : L('Parish not found', 'لم نعثر على الرعية'), L('You can return to the directory and explore another parish.', 'يمكنك العودة إلى الدليل واستكشاف رعية أخرى.'), (p ? '<button class="button retry-load" type="button">' + L('Try again', 'حاول مجدّدًا') + '</button>' : '') + '<a class="text-link" href="public.html#directory">' + L('Back to the directory', 'العودة إلى الدليل') + icon('arrow') + '</a>') + '</div>';
  } else {
    app.innerHTML = (failed.length ? '<div class="site-wrap load-notice" role="status">' + L('Some parish details could not be loaded. ', 'تعذّر تحميل بعض تفاصيل الرعايا. ') + '<button class="text-button retry-load">' + L('Try again', 'حاول مجدّدًا') + '</button></div>' : '') + (params.get('view')==='bundles' ? bundlePage() : selected ? params.has('request') ? (d.publicRequests===false ? `<section class="section site-wrap"><h1>${L('Contact the parish office','تواصل مع مكتب الرعية')}</h1><p>${safe(d.parish.phone||'')}</p><a class="button" href="public.html?parish=${encodeURIComponent(p.id)}">${L('Parish details','معلومات الرعية')}</a></section>` : requestPage(p,params.get('request'))) : params.get('view')==='calendar' ? parishExtras(p,d,true) : profile(p,d) : home());
  }
  app.setAttribute('aria-busy', 'false');
  document.title = (selected && p ? parishName(p) : L('Find your parish', 'ابحث عن رعيتك')) + ' · ParishLife';
  renderCards();
  bindDirectory();bindSlider(app);
  if(p&&d){bindRequest(app,p);bindPublicCalendar(app,d);}
  paginateCollections(app);
  document.querySelectorAll('.retry-load').forEach(button => button.addEventListener('click', load));
  document.querySelector('.directory-filters')?.addEventListener('submit', event => { event.preventDefault(); renderCards(true); document.querySelector('#directory-cards')?.scrollIntoView({block:'nearest'}); });
  document.querySelector('#directory-filter')?.addEventListener('input', event => { filters.q = event.target.value; renderCards(true); });
  document.querySelector('#town-filter')?.addEventListener('change', event => { filters.town = event.target.value; renderCards(true); });
  document.querySelector('#sort-filter')?.addEventListener('change', event => { filters.sort = event.target.value; renderCards(true); });
  // Public event pages use the shared calendar.
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

