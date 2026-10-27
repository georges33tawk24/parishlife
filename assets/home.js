/* The public homepage. Every line comes from the dashboard: the Homepage editor
   (Administration → Homepage), each parish's Website content and public profile,
   and the events and announcements parishes publish. Empty sections say what a
   parish office can publish, rather than filling the page with placeholders. */
import { heroScene, mulberry, ridge, fillPath, cedar, yAt } from './home-scene.js';
import { mapMarkup, locate, mountMap, projection } from './home-map.js';
import { animateHome, stopHomeMotion } from './home-motion.js';
import { HOME_DEFAULTS } from './site-defaults.js';

let teardown = [];
const other = lang => lang === 'ar' ? 'en' : 'ar';
const isoDay = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const svgIcon = d => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const SEARCH = svgIcon('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>');
const PIN = svgIcon('<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>');
const NEAR = svgIcon('<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/><circle cx="12" cy="12" r="7.5"/>');
const PREV = svgIcon('<path d="m15 5-7 7 7 7"/>'), NEXT = svgIcon('<path d="m9 5 7 7-7 7"/>');
const CLOSE = svgIcon('<path d="M6 6l12 12M18 6 6 18"/>');

/* Bilingual CMS text: the visitor's language, else the built-in wording in that language. */
const words = (c, value, fallback) => value?.[c.lang]?.trim() || fallback?.[c.lang] || '';
/* CMS text without a default: the visitor's language, else the other one, marked as such. */
function either(c, value) {
  const own = value?.[c.lang]?.trim();
  if (own) return { text: own, attrs: '' };
  const alt = value?.[other(c.lang)]?.trim(), l = other(c.lang);
  return alt ? { text: alt, attrs: ` lang="${l}" dir="${l === 'ar' ? 'rtl' : 'ltr'}"` } : null;
}
const paragraphs = (c, text) => String(text || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => `<p>${c.htmlText(p)}</p>`).join('');
const plain = html => String(html || '').replace(/<(br|\/p|\/li|\/h\d)\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const clip = (text, n) => text.length > n ? text.slice(0, n).replace(/\s+\S*$/, '') + '…' : text;
const hash = value => [...String(value)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

/* A parish without photographs gets an arch of night sky over the hills, with its light. */
function archCover(seed) {
  const h = hash(seed), crest = 44 + (h % 9), x = 18 + (h % 25);
  return `<svg class="arch-cover" viewBox="0 0 60 76" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <rect width="60" height="76" fill="url(#cover-sky)"/>
    <circle cx="${12 + (h % 30)}" cy="${10 + (h % 7)}" r=".7" fill="#EEF1F6"/><circle cx="${40 - (h % 13)}" cy="${18 + (h % 5)}" r=".6" fill="#EEF1F6" opacity=".7"/>
    <path d="M0 ${crest - 4}L${8 + (h % 6)} ${crest - 14}L${20 + (h % 7)} ${crest - 6}L${32 + (h % 5)} ${crest - 19}L${46 - (h % 6)} ${crest - 8}L60 ${crest - 12}V76H0Z" fill="#33456F"/>
    <path d="M0 ${crest + 6}Q14 ${crest - 6} 26 ${crest + 2}T60 ${crest - 4}V76H0Z" fill="#1C2A4D"/>
    <path d="M0 ${crest + 16}Q20 ${crest + 6} 34 ${crest + 13}T60 ${crest + 10}V76H0Z" fill="#101A33"/>
    <circle cx="${x + 8}" cy="${crest + 12}" r="9" fill="url(#cover-lamp)"/><circle cx="${x + 8}" cy="${crest + 12}" r="1.7" fill="#FFE6AE"/></svg>`;
}

export function homeView(c) {
  const { L, safe, site } = c, on = key => site?.sections?.[key] !== false;
  const sections = [hero(c), on('week') ? week(c) : '', on('map') ? directory(c) : '', on('requests') ? requests(c) : '',
    on('times') ? times(c) : '', on('news') ? news(c) : '', on('stories') ? stories(c) : '', on('about') ? about(c) : '', on('join') ? join(c) : ''];
  return `<div class="home" data-home>
    <svg class="defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
      <linearGradient id="cover-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B1428"/><stop offset=".55" stop-color="#22365F"/><stop offset=".85" stop-color="#5E5A80"/><stop offset="1" stop-color="#9C7A78"/></linearGradient>
      <radialGradient id="cover-lamp" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE3A3"/><stop offset=".45" stop-color="#D7A548" stop-opacity=".5"/><stop offset="1" stop-color="#D7A548" stop-opacity="0"/></radialGradient>
    </defs></svg>
    ${sections.join('')}
    <dialog class="parish-picker" data-picker aria-labelledby="picker-title"><form method="dialog" class="picker-head"><h2 id="picker-title"></h2><button class="icon-button" aria-label="${L('Close', 'إغلاق')}">${CLOSE}</button></form>
      <label class="picker-search">${SEARCH}<span class="sr-only">${L('Search parishes', 'ابحث عن رعية')}</span><input type="search" data-picker-filter placeholder="${safe(L('Search parishes', 'ابحث عن رعية'))}"></label>
      <ul class="picker-list" data-picker-list></ul></dialog>
  </div>`;
}

/* ---------- hero ---------- */
function weekEvents(c) {
  const today = new Date(c.localToday() + 'T12:00:00');
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i); return isoDay(d); });
  const all = c.directory.flatMap(p => (c.details.get(p.id)?.events || []).map(e => ({ ...e, parish: p })))
    .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.d || '')).sort((a, b) => (a.d + (a.t || '')).localeCompare(b.d + (b.t || '')));
  return { days, all, inWeek: all.filter(e => e.d >= days[0] && e.d <= days[6]) };
}
function facts(c) {
  const dioceses = new Set(c.directory.map(p => p.diocese).filter(Boolean)).size;
  const towns = new Set(c.directory.map(p => (p.town || p.townAr || '').trim().toLowerCase()).filter(Boolean)).size;
  return { parishes: c.directory.length, dioceses, towns, week: weekEvents(c).inWeek.length };
}
function hero(c) {
  const { L, safe, site } = c, f = facts(c);
  const note = site?.announcement, text = note && either(c, note.text), label = note && either(c, note.linkLabel);
  const announcement = text ? `<p class="hero-note" data-hero-rise><span class="note-mark" aria-hidden="true"></span><span${text.attrs}>${safe(text.text)}</span>${note.link ? ` <a href="${safe(note.link)}"${label?.attrs || ''}>${safe(label?.text || L('Read more', 'اقرأ المزيد'))}</a>` : ''}</p>` : '';
  const stat = (n, [one, many], ar) => `<li><b>${c.number(n)}</b><span>${L(n === 1 ? one : many, ar)}</span></li>`;
  return `<section class="hero" id="top" data-hero aria-labelledby="hero-title">
    <div class="hero-art" data-scene></div><div class="hero-shade" aria-hidden="true"></div>
    <div class="site-wrap hero-inner">
      ${announcement}
      <h1 class="hero-title" id="hero-title">${safe(words(c, site?.hero?.title, HOME_DEFAULTS.hero.title))}</h1>
      <p class="hero-lede" data-hero-rise>${safe(words(c, site?.hero?.subtitle, HOME_DEFAULTS.hero.subtitle))}</p>
      <form class="hero-search" role="search" data-hero-search data-hero-rise>
        <label class="sr-only" for="hero-q">${L('Parish, town or village', 'رعية أو بلدة أو قرية')}</label>
        <div class="hero-field">${SEARCH}<input id="hero-q" type="search" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="hero-suggest" placeholder="${safe(L('Parish, town or village', 'رعية أو بلدة أو قرية'))}">
          <button type="submit">${L('Search', 'ابحث')}</button></div>
        <ul class="hero-suggest" id="hero-suggest" role="listbox" aria-label="${safe(L('Suggestions', 'اقتراحات'))}" hidden></ul>
      </form>
      <ul class="hero-facts" data-hero-rise aria-label="${safe(L('ParishLife in numbers', 'ParishLife بالأرقام'))}">
        ${stat(f.parishes, ['parish', 'parishes'], 'رعايا')}${stat(f.dioceses, ['diocese', 'dioceses'], 'أبرشيات')}${f.week ? stat(f.week, ['celebration this week', 'celebrations this week'], 'احتفالات هذا الأسبوع') : stat(f.towns, ['town or village', 'towns and villages'], 'بلدات وقرى')}
      </ul>
    </div>
    <p class="hero-tip" data-hero-tip role="status" hidden></p>
  </section>`;
}

/* ---------- this week ---------- */
function week(c) {
  const { L, safe } = c, { days, all, inWeek } = weekEvents(c), loc = c.lang === 'ar' ? 'ar-LB' : 'en-GB';
  const kind = e => ({ mass: L('Mass', 'قدّاس'), event: L('Gathering', 'لقاء'), wedding: L('Wedding', 'إكليل'), baptism: L('Baptism', 'معمودية'), funeral: L('Funeral', 'جنّاز') })[e.kind] || L('Parish event', 'حدث رعوي');
  const head = `<header class="sec-head" data-reveal><h2 id="week-title">${L('This week', 'هذا الأسبوع')}</h2><p>${L('Masses and celebrations the parishes have published for the next seven days.', 'القداديس والاحتفالات التي نشرتها الرعايا للأيام السبعة المقبلة.')}</p></header>`;
  if (!inWeek.length) {
    const next = all.find(e => e.d > days[6]);
    const when = next && new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(next.d + 'T12:00:00'));
    return `<section class="week" id="week" aria-labelledby="week-title"><div class="site-wrap">${head}
      <div class="week-empty" data-reveal><span class="lamp is-unlit" aria-hidden="true"></span><div><p class="lead">${L('No celebrations have been published for the next seven days yet.', 'لم تُنشر احتفالات للأيام السبعة المقبلة بعد.')}</p>
      <p>${next ? `${L('The next one is', 'الاحتفال التالي')} <a href="${safe(c.calendarURL(next.parish.id))}">${safe(c.pair(next, 'title', 'titleAr') || kind(next))}, ${safe(when)}, ${safe(c.parishName(next.parish))}</a>.` : L('Parish offices add public Masses and events from their parish calendar in ParishLife.', 'تضيف مكاتب الرعايا القداديس والأحداث العامة من رزنامة الرعية في ParishLife.')}</p></div></div></div></section>`;
  }
  const columns = days.map((d, i) => {
    const date = new Date(d + 'T12:00:00'), list = inWeek.filter(e => e.d === d), shown = list.slice(0, 4);
    const dow = new Intl.DateTimeFormat(loc, { weekday: 'long' }).format(date), dm = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' }).format(date);
    return `<li class="day${i === 0 ? ' is-today' : ''}${list.length ? '' : ' is-quiet'}" data-reveal-item>
      <h3><span class="dow">${safe(dow)}</span><time datetime="${d}">${safe(dm)}</time>${i === 0 ? `<span class="today"><span class="lamp" aria-hidden="true"></span>${L('Today', 'اليوم')}</span>` : ''}</h3>
      ${list.length ? `<ul>${shown.map(e => `<li><a href="${safe(c.calendarURL(e.parish.id))}">${e.t ? `<time>${safe(e.t)}</time>` : ''}<strong>${safe(c.pair(e, 'title', 'titleAr') || kind(e))}</strong><span>${safe(c.parishName(e.parish))}</span></a></li>`).join('')}</ul>${list.length > shown.length ? `<p class="more">${L(`${list.length - shown.length} more`, `و${c.number(list.length - shown.length)} غيرها`)}</p>` : ''}` : `<p class="quiet"><span aria-hidden="true">—</span><span class="sr-only">${L('Nothing published', 'لا شيء منشور')}</span></p>`}
    </li>`;
  }).join('');
  return `<section class="week" id="week" aria-labelledby="week-title"><div class="site-wrap">${head}<ol class="week-days">${columns}</ol></div></section>`;
}

/* ---------- directory ---------- */
function choices(c, key, label, values, current) {
  return `<label class="dir-select"><span class="sr-only">${label}</span><select data-filter="${key}"><option value="">${label}</option>${values.map(v => `<option value="${c.safe(v)}" ${current === v ? 'selected' : ''}>${c.safe(v)}</option>`).join('')}</select></label>`;
}
function directory(c) {
  const { L, safe, filters } = c, uniq = list => [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b, c.lang));
  return `<section class="directory" id="directory" aria-labelledby="directory-title"><div class="site-wrap dir-grid">
    <header class="sec-head dir-head" data-reveal><h2 id="directory-title">${L('Find a parish', 'ابحث عن رعية')}</h2><p>${L('Every parish on ParishLife, on the map of Lebanon. Choose a light, or search by name or town.', 'كل الرعايا المسجّلة على ParishLife على خريطة لبنان. اختر نوراً، أو ابحث بالاسم أو البلدة.')}</p></header>
    <div class="dir-map" data-reveal>${mapMarkup(L)}</div>
    <div class="dir-list">
      <form class="dir-filters" role="search" data-dir-form data-reveal>
        <label class="dir-search">${SEARCH}<span class="sr-only">${L('Search parish or town', 'ابحث عن رعية أو بلدة')}</span><input id="directory-filter" type="search" value="${safe(filters.q)}" placeholder="${safe(L('Parish, town or village', 'رعية أو بلدة أو قرية'))}"></label>
        <div class="dir-row">
          ${choices(c, 'town', L('All towns', 'كل البلدات'), uniq(c.directory.map(p => p.town)), filters.town)}
          ${choices(c, 'diocese', L('All dioceses', 'كل الأبرشيات'), uniq(c.directory.map(p => p.diocese)), filters.diocese)}
          ${choices(c, 'rite', L('All rites', 'كل الطقوس'), uniq(c.directory.map(p => c.details.get(p.id)?.parish?.rite)), filters.rite)}
        </div>
        <div class="dir-row dir-tools">
          <button type="button" class="chip" data-near aria-pressed="${filters.location ? 'true' : 'false'}">${NEAR}${L('Near me', 'بالقرب مني')}</button>
          <label class="dir-sort">${L('Sort by', 'الترتيب')} <select data-filter="sort"><option value="name" ${filters.sort === 'name' ? 'selected' : ''}>${L('Name', 'الاسم')}</option><option value="town" ${filters.sort === 'town' ? 'selected' : ''}>${L('Town', 'البلدة')}</option></select></label>
          <button type="reset" class="text-button" data-dir-reset>${L('Clear', 'مسح')}</button>
        </div>
        <p class="dir-status" data-dir-status role="status"></p>
      </form>
      <ol class="parish-list" data-parish-list></ol>
      <p class="dir-note" data-dir-note></p>
    </div>
  </div></section>`;
}
function km(c, item) {
  if (!c.filters.location || !item) return null;
  const { kx, ky, lon0, lat1 } = projection, lat = lat1 - item.y / ky, lon = lon0 + item.x / kx;
  const [la, lo] = c.filters.location, rad = v => v * Math.PI / 180, a = rad(lat - la), b = rad(lon - lo);
  const h = Math.sin(a / 2) ** 2 + Math.cos(rad(la)) * Math.cos(rad(lat)) * Math.sin(b / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function filtered(c, places) {
  const { filters } = c, q = c.normalize(filters.q.trim());
  return c.directory.filter(p => (!filters.town || p.town === filters.town) && (!filters.diocese || p.diocese === filters.diocese)
      && (!filters.rite || c.details.get(p.id)?.parish?.rite === filters.rite)
      && (!q || c.normalize([p.name, p.ar, p.town, p.townAr, p.diocese].join(' ')).includes(q)))
    .map(p => ({ p, d: km(c, places.get(p.id)) }))
    .sort((a, b) => filters.location ? (a.d ?? Infinity) - (b.d ?? Infinity) || c.parishName(a.p).localeCompare(c.parishName(b.p), c.lang)
      : (filters.sort === 'town' ? c.townName(a.p).localeCompare(c.townName(b.p), c.lang) : 0) || c.parishName(a.p).localeCompare(c.parishName(b.p), c.lang));
}
function thumb(c, p) {
  const photo = c.parishPhotos(c.details.get(p.id))[0];
  return `<span class="arch-thumb">${photo ? `<img src="${c.safe(photo)}" alt="" loading="lazy" decoding="async">` : archCover(p.id)}</span>`;
}
function listItems(c, rows, places) {
  const { L, safe } = c;
  if (!rows.length) return `<li class="list-empty"><p>${L('No parish matches this search.', 'لا رعية تطابق هذا البحث.')}</p><button type="button" class="text-button" data-dir-clear>${L('Show every parish', 'عرض كل الرعايا')}</button></li>`;
  return rows.map(({ p, d }) => {
    const rite = c.details.get(p.id)?.parish, riteName = c.pair(rite, 'rite', 'riteAr'), placed = places.get(p.id);
    return `<li class="parish-item" data-parish="${safe(p.id)}" data-reveal-item><a href="${safe(c.profileURL(p.id))}">${thumb(c, p)}
      <span class="pi-text"><strong>${safe(c.parishName(p))}</strong><span class="pi-town">${PIN}${safe(c.townName(p) || L('Town not published', 'البلدة غير منشورة'))}</span><small>${[p.diocese, riteName].filter(Boolean).map(safe).join(L(', ', '، '))}</small></span>
      ${d !== null ? `<span class="pi-km">${c.number(Math.round(d * 10) / 10)} ${L('km', 'كم')}</span>` : placed ? '' : `<span class="pi-km is-off">${L('Not on the map yet', 'ليست على الخريطة بعد')}</span>`}</a></li>`;
  }).join('');
}

/* ---------- requests ---------- */
function requests(c) {
  const { L, safe } = c, open = c.directory.filter(p => c.details.get(p.id)?.publicRequests !== false);
  if (!open.length) return '';
  const href = kind => open.length === 1 ? c.requestURL(open[0].id, kind) : '#requests';
  const arch = ([kind, art, title, sub]) => `<li data-reveal-item><a class="arch" href="${safe(href(kind))}" data-request="${kind}"><span class="arch-icon">${c.icon(art)}</span><strong>${L(...title)}</strong><small>${L(...sub)}</small></a></li>`;
  const wide = ([kind, art, title, sub]) => `<a class="ask-wide" href="${safe(href(kind))}" data-request="${kind}" data-reveal-item><span class="arch-icon">${c.icon(art)}</span><span><strong>${L(...title)}</strong><small>${L(...sub)}</small></span></a>`;
  return `<section class="ask" id="requests" aria-labelledby="requests-title"><div class="site-wrap">
    <header class="sec-head" data-reveal><h2 id="requests-title">${L('Ask your parish', 'اطلب من رعيتك')}</h2><p>${L('Baptisms, weddings, certificates and more. Send your request to the parish office without an account, and follow it with a private link.', 'معموديات وأكاليل وشهادات وغيرها. أرسل طلبك إلى مكتب الرعية من دون حساب، وتابعه برابط خاص.')}</p></header>
    <ul class="arcade">${c.REQUESTS.map(arch).join('')}</ul>
    <div class="ask-more">${c.OTHER_REQUESTS.map(wide).join('')}</div>
    <ol class="steps" data-reveal>
      <li><b>${L('Choose your parish and what you need', 'اختر رعيتك وما تحتاجه')}</b><span>${L('Describe the request in a few lines. No account is needed.', 'صِف طلبك في بضعة أسطر. لا حاجة إلى حساب.')}</span></li>
      <li><b>${L('The parish office reviews it', 'يراجعه مكتب الرعية')}</b><span>${L('The office answers, asks for documents if needed, and prepares what you asked for.', 'يجيب المكتب، ويطلب المستندات عند الحاجة، ويحضّر ما طلبته.')}</span></li>
      <li><b>${L('Follow it with your private link', 'تابعه برابطك الخاص')}</b><span>${L('Keep the link you receive to see each step and collect your documents.', 'احتفظ بالرابط الذي تتلقاه لتتابع كل خطوة وتستلم مستنداتك.')}</span></li>
    </ol></div></section>`;
}

/* ---------- Mass times ---------- */
function times(c) {
  const { L, safe } = c, rows = c.directory.filter(p => c.content(c.details.get(p.id), 'massTimes').trim());
  const head = `<header class="sec-head" data-reveal><h2 id="times-title">${L('Mass times', 'مواعيد القداديس')}</h2><p>${L('As published by each parish office. On feast days, check the parish page for changes.', 'كما ينشرها مكتب كل رعية. في الأعياد، راجع صفحة الرعية لمعرفة أي تغيير.')}</p></header>`;
  const body = rows.length ? `<div class="times-board">${rows.map((p, i) => `<article class="times-entry" data-reveal-item ${i >= 6 ? 'data-extra hidden' : ''}>
      <h3><a href="${safe(c.profileURL(p.id, '#times'))}">${safe(c.parishName(p))}</a></h3><p class="times-town">${safe(c.townName(p))}</p>
      <div class="times-text" dir="auto">${c.htmlText(c.content(c.details.get(p.id), 'massTimes'))}</div></article>`).join('')}</div>
      ${rows.length > 6 ? `<button type="button" class="text-button times-all" data-times-all>${L(`Show all ${rows.length} parishes`, `عرض كل الرعايا (${c.number(rows.length)})`)}</button>` : ''}`
    : `<div class="soft-empty" data-reveal><p class="lead">${L('No parish has published its Mass times yet.', 'لم تنشر أي رعية مواعيد قداديسها بعد.')}</p><p>${L('Parish offices add them under Website content in ParishLife.', 'تضيفها مكاتب الرعايا ضمن محتوى الموقع في ParishLife.')}</p></div>`;
  return `<section class="times" id="times" aria-labelledby="times-title"><div class="site-wrap times-grid">${head}<div>${body}</div></div></section>`;
}

/* ---------- announcements ---------- */
function news(c) {
  const { L, safe } = c;
  const posts = c.directory.flatMap(p => (c.details.get(p.id)?.posts || []).map(post => ({ ...post, parish: p })))
    .filter(post => post.title || post.body).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 6);
  if (!posts.length) return '';
  return `<section class="news" id="news" aria-labelledby="news-title"><div class="site-wrap">
    <header class="sec-head" data-reveal><h2 id="news-title">${L('From the parishes', 'من الرعايا')}</h2><p>${L('The latest announcements published by parish offices.', 'آخر الإعلانات التي نشرتها مكاتب الرعايا.')}</p></header>
    <div class="news-list">${posts.map((post, i) => `<article class="news-item${i === 0 ? ' is-lead' : ''}" data-reveal-item>
      ${c.publishedDate(post.at) ? `<time datetime="${safe(post.at)}">${safe(c.publishedDate(post.at))}</time>` : ''}
      <h3 dir="auto"><a href="${safe(c.profileURL(post.parish.id, '#updates'))}">${safe(post.title || clip(plain(post.body), 80))}</a></h3>
      <p dir="auto">${safe(clip(plain(post.body), i === 0 ? 320 : 170))}</p>
      <p class="news-parish">${safe(c.parishName(post.parish))}</p></article>`).join('')}</div></div></section>`;
}

/* ---------- stories (Homepage editor) ---------- */
function stories(c) {
  const { L, safe } = c, list = (c.site?.stories || []).map(s => ({ ...s, t: either(c, s.title), b: either(c, s.body) })).filter(s => s.t);
  if (!list.length) return '';
  return `<section class="stories" id="stories" aria-labelledby="stories-title"><div class="site-wrap stories-head">
    <h2 id="stories-title" data-reveal>${L('Stories', 'قصص')}</h2>
    ${list.length > 1 ? `<div class="story-nav"><button type="button" class="icon-button" data-story-step="-1" aria-label="${safe(L('Previous story', 'القصة السابقة'))}">${PREV}</button><button type="button" class="icon-button" data-story-step="1" aria-label="${safe(L('Next story', 'القصة التالية'))}">${NEXT}</button></div>` : ''}</div>
    <div class="story-track" data-story-track tabindex="0" role="region" aria-label="${safe(L('Stories', 'قصص'))}">${list.map(s => `<article class="story" data-reveal-item>
      <figure class="story-arch">${s.image ? `<img src="${safe(s.image)}" alt="" loading="lazy" decoding="async">` : archCover(s.id)}</figure>
      <h3${s.t.attrs}>${safe(s.t.text)}</h3>${s.b ? `<p${s.b.attrs}>${safe(s.b.text)}</p>` : ''}
      ${s.link ? `<a class="story-link" href="${safe(s.link)}">${L('Read more', 'اقرأ المزيد')}<span class="sr-only">: ${safe(s.t.text)}</span></a>` : ''}</article>`).join('')}</div></section>`;
}

/* ---------- about and join ---------- */
/* The cedar emblem beside the About text, drawn with the same cedar as the hero. */
function cedarMark() {
  return `<svg class="cedar-mark" viewBox="0 0 240 300" aria-hidden="true" focusable="false"><path d="M-10 300V272Q120 238 250 272V300Z" fill="currentColor" opacity=".18"/>
    <path d="${cedar(mulberry(31), 122, 260, 205)}" fill="currentColor"/></svg>`;
}
function about(c) {
  if (c.site && !c.site.about) return '';
  const { L, safe } = c, a = c.site?.about, f = facts(c);
  return `<section class="about" id="about" aria-labelledby="about-title"><div class="site-wrap about-grid">
    <div class="about-mark" data-reveal>${cedarMark()}</div>
    <div class="about-copy" data-reveal><h2 id="about-title">${safe(words(c, a?.title, HOME_DEFAULTS.about.title))}</h2>${paragraphs(c, words(c, a?.body, HOME_DEFAULTS.about.body))}
      <dl class="about-facts">${[[f.parishes, 'Parish', 'Parishes', 'رعايا'], [f.dioceses, 'Diocese', 'Dioceses', 'أبرشيات'], [f.towns, 'Town or village', 'Towns and villages', 'بلدات وقرى']]
        .map(([n, one, many, ar]) => `<div><dt>${L(n === 1 ? one : many, ar)}</dt><dd>${c.number(n)}</dd></div>`).join('')}</dl></div>
  </div></section>`;
}
function join(c) {
  if (c.site && !c.site.join) return '';
  const { L, safe } = c, j = c.site?.join;
  return `<section class="join" id="join" aria-labelledby="join-title"><div class="join-art" aria-hidden="true">${joinRidges()}</div><div class="site-wrap join-inner" data-reveal>
    <h2 id="join-title">${safe(words(c, j?.title, HOME_DEFAULTS.join.title))}</h2>${paragraphs(c, words(c, j?.body, HOME_DEFAULTS.join.body))}
    <div class="join-actions"><a class="btn btn-gilt" href="index.html">${L('Open the members portal', 'ادخل إلى بوّابة المؤمنين')}</a><a class="btn btn-line" href="index.html?signup=1">${L('Create an account', 'أنشئ حساباً')}</a><a class="text-button" href="public.html?view=bundles">${L('ParishLife bundles', 'باقات ParishLife')}</a></div>
  </div></section>`;
}
function joinRidges() {
  const rand = mulberry(9), W = 1600, H = 400;
  const layers = [[H * 0.62, H * 0.42, '#15233F'], [H * 0.78, H * 0.3, '#101B33'], [H * 0.93, H * 0.16, '#0B1428']].map(([base, amp, fill]) => ({ pts: ridge(rand, W, base, amp, { octaves: 6, crag: 0.1 }), fill }));
  const lights = [0.14, 0.38, 0.61, 0.79, 0.92].map(t => { const x = W * t; return [x, yAt(layers[1].pts, x) + 14 + rand() * 30]; });
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">${layers.slice(0, 2).map(l => `<path d="${fillPath(l.pts, H)}" fill="${l.fill}"/>`).join('')}
    ${lights.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="16" fill="url(#cover-lamp)"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="#FFE6AE"/>`).join('')}
    <path d="${fillPath(layers[2].pts, H)}" fill="${layers[2].fill}"/></svg>`;
}

/* ---------- behaviour ---------- */
export function mountHome(root, c) {
  unmountHome();
  const home = root.querySelector('[data-home]');
  if (!home) return;
  const places = new Map();
  for (const p of c.directory) { const at = locate(p, c.details.get(p.id)); if (at) places.set(p.id, at); }
  sceneMount(home, c);
  const map = directoryMount(home, c, places);
  searchMount(home, c, map);
  pickerMount(home, c);
  home.querySelector('[data-times-all]')?.addEventListener('click', e => { home.querySelectorAll('.times-entry[data-extra]').forEach(el => el.hidden = false); e.currentTarget.remove(); });
  storiesMount(home);
  headerMount(home);
  animateHome(home);
}
export function unmountHome() { stopHomeMotion(); teardown.forEach(fn => fn()); teardown = []; }

function sceneMount(home, c) {
  const host = home.querySelector('[data-scene]'), tip = home.querySelector('[data-hero-tip]');
  if (!host) return;
  const places = c.directory.map(p => ({ id: p.id, name: c.parishName(p), town: c.townName(p) }));
  let shape = '';
  const draw = () => {
    const w = innerWidth, h = Math.max(1, host.clientHeight || innerHeight), ratio = w / h, next = (ratio < 0.8 ? 'p' : 'l') + Math.round(ratio * 4);
    if (next === shape) return false;
    shape = next;
    host.innerHTML = heroScene({ width: Math.round(1000 * ratio), height: 1000, places, mirror: c.lang === 'ar' }).svg;
    host.querySelectorAll('.parish-light').forEach(light => {
      const p = places.find(x => x.id === light.dataset.light);
      light.addEventListener('pointerenter', () => { const r = light.getBoundingClientRect(), box = home.querySelector('[data-hero]').getBoundingClientRect();
        tip.textContent = p.town ? `${p.name}, ${p.town}` : p.name; tip.hidden = false;
        tip.style.left = (r.left + r.width / 2 - box.left) + 'px'; tip.style.top = (r.top - box.top) + 'px'; });
      light.addEventListener('pointerleave', () => { tip.hidden = true; });
      light.addEventListener('click', () => { location.href = c.profileURL(p.id); });
    });
    return true;
  };
  draw();
  let timer;
  const resize = () => { clearTimeout(timer); timer = setTimeout(() => { if (draw()) animateHome(home, { heroOnly: true }); }, 220); };
  addEventListener('resize', resize, { passive: true });
  teardown.push(() => { removeEventListener('resize', resize); clearTimeout(timer); });
}

function directoryMount(home, c, places) {
  const section = home.querySelector('#directory');
  if (!section) return null;
  const list = section.querySelector('[data-parish-list]'), status = section.querySelector('[data-dir-status]'), note = section.querySelector('[data-dir-note]');
  const items = c.directory.filter(p => places.has(p.id)).map(p => ({ id: p.id, ...places.get(p.id), name: c.parishName(p), town: c.townName(p) }));
  const { L, safe } = c;
  const card = item => {
    const p = c.directory.find(x => x.id === item.id), open = c.details.get(item.id)?.publicRequests !== false;
    return `<button type="button" class="icon-button card-close" data-card-close aria-label="${safe(L('Close', 'إغلاق'))}">${CLOSE}</button>
      ${thumb(c, p)}<div><h3>${safe(item.name)}</h3><p>${safe(item.town)}${item.exact ? '' : ` <small>${L('(shown at the town centre)', '(تظهر في وسط البلدة)')}</small>`}</p>
      <div class="card-actions"><a class="btn btn-gilt btn-small" href="${safe(c.profileURL(item.id))}">${L('Parish page', 'صفحة الرعية')}</a>${open ? `<a class="btn btn-line btn-small" href="${safe(c.requestURL(item.id, 'certificate'))}">${L('Make a request', 'قدّم طلباً')}</a>` : ''}</div></div>`;
  };
  const map = mountMap(section.querySelector('[data-lebanon-map]'), items, { L, card, onChoose: id => {
    const row = list.querySelector(`[data-parish="${CSS.escape(id)}"]`);
    list.querySelectorAll('.is-chosen').forEach(el => el.classList.remove('is-chosen'));
    row?.classList.add('is-chosen');
    row?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  } });
  teardown.push(() => map.destroy());
  const paint = (updateURL = false) => {
    const rows = filtered(c, places);
    list.innerHTML = listItems(c, rows, places);
    status.textContent = rows.length === c.directory.length ? L(`${rows.length} parishes`, `عدد الرعايا: ${c.number(rows.length)}`) : L(`${rows.length} of ${c.directory.length} parishes`, `${c.number(rows.length)} من أصل ${c.number(c.directory.length)} رعية`);
    map.filter(rows.map(r => r.p.id));
    const off = c.directory.filter(p => !places.has(p.id)).length;
    note.textContent = off ? L(`${off} ${off === 1 ? 'parish is' : 'parishes are'} not on the map yet. A parish office places its parish by adding coordinates to its public parish profile.`, `${c.number(off)} من الرعايا ليست على الخريطة بعد. يضع مكتب الرعية رعيته على الخريطة بإضافة الإحداثيات إلى صفحة الرعية العامة.`) : '';
    list.querySelectorAll('.parish-item').forEach(row => {
      const id = row.dataset.parish;
      row.addEventListener('pointerenter', () => map.mark(id));
      row.addEventListener('pointerleave', () => map.mark(null));
      row.addEventListener('focusin', () => map.mark(id));
      row.addEventListener('focusout', () => map.mark(null));
    });
    list.querySelector('[data-dir-clear]')?.addEventListener('click', () => { Object.assign(c.filters, { q: '', town: '', diocese: '', rite: '' }); sync(); paint(true); });
    if (updateURL) {
      const url = new URL(location.href);
      for (const key of ['q', 'town', 'sort']) c.filters[key] && !(key === 'sort' && c.filters.sort === 'name') ? url.searchParams.set(key, c.filters[key]) : url.searchParams.delete(key);
      history.replaceState(null, '', url);
    }
  };
  const form = section.querySelector('[data-dir-form]'), input = form.querySelector('#directory-filter');
  const sync = () => { input.value = c.filters.q; form.querySelectorAll('[data-filter]').forEach(s => { s.value = c.filters[s.dataset.filter] || (s.dataset.filter === 'sort' ? 'name' : ''); }); };
  input.addEventListener('input', () => { c.filters.q = input.value; paint(true); });
  form.addEventListener('submit', e => { e.preventDefault(); paint(true); });
  form.querySelectorAll('[data-filter]').forEach(s => s.addEventListener('change', () => { c.filters[s.dataset.filter] = s.value; paint(true); }));
  form.addEventListener('reset', e => { e.preventDefault(); Object.assign(c.filters, { q: '', town: '', diocese: '', rite: '', sort: 'name', location: null }); near.setAttribute('aria-pressed', 'false'); sync(); paint(true); map.reset(); });
  const near = form.querySelector('[data-near]');
  near.addEventListener('click', () => {
    if (c.filters.location) { c.filters.location = null; near.setAttribute('aria-pressed', 'false'); status.textContent = ''; paint(); return; }
    if (!navigator.geolocation) { status.textContent = L('Your location is not available in this browser.', 'موقعك غير متاح في هذا المتصفح.'); return; }
    status.textContent = L('Finding your location…', 'جارٍ تحديد موقعك…');
    navigator.geolocation.getCurrentPosition(pos => {
      c.filters.location = [pos.coords.latitude, pos.coords.longitude]; near.setAttribute('aria-pressed', 'true'); paint();
      status.textContent = L('Nearest parishes first. Distances are approximate.', 'الرعايا الأقرب أولاً. المسافات تقريبية.');
    }, () => { status.textContent = L('Your location could not be found. Every parish is still listed.', 'تعذّر تحديد موقعك. ما زالت كل الرعايا معروضة.'); }, { timeout: 10000, maximumAge: 60000 });
  });
  paint();
  return { map, paint, sync, section };
}

function searchMount(home, c, dir) {
  const form = home.querySelector('[data-hero-search]');
  if (!form) return;
  const input = form.querySelector('input'), box = form.querySelector('[role=listbox]'), { L, safe } = c;
  let options = [], active = -1;
  const towns = [...new Map(c.directory.filter(p => p.town || p.townAr).map(p => [p.town || p.townAr, p])).values()];
  const close = () => { box.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
  const render = () => {
    const q = c.normalize(input.value.trim());
    if (!q) return close();
    const parishes = c.directory.filter(p => c.normalize([p.name, p.ar, p.town, p.townAr].join(' ')).includes(q)).slice(0, 5)
      .map(p => ({ kind: 'parish', id: p.id, label: c.parishName(p), sub: c.townName(p) }));
    const places = towns.filter(p => c.normalize([p.town, p.townAr].join(' ')).includes(q)).slice(0, 3)
      .map(p => ({ kind: 'town', town: p.town, label: c.townName(p), sub: L('Town', 'بلدة') }));
    options = [...parishes, ...places];
    box.innerHTML = options.length ? options.map((o, i) => `<li role="option" id="hero-opt-${i}" data-index="${i}" aria-selected="false">${o.kind === 'parish' ? '<span class="lamp" aria-hidden="true"></span>' : PIN}<span><b>${safe(o.label)}</b><small>${safe(o.sub)}</small></span></li>`).join('')
      : `<li class="no-match" role="option" aria-disabled="true">${L('No parish or town matches. Press Search to look through the directory.', 'لا رعية أو بلدة مطابقة. اضغط «ابحث» للبحث في الدليل.')}</li>`;
    box.hidden = false; input.setAttribute('aria-expanded', 'true'); active = -1;
  };
  const pick = o => {
    if (!o) return;
    if (o.kind === 'parish') { location.href = c.profileURL(o.id); return; }
    Object.assign(c.filters, { q: '', town: o.town || '' });
    go();
  };
  const go = () => {
    close();
    if (!dir) return;
    dir.sync(); dir.paint(true);
    const ids = filtered(c, new Map()).map(r => r.p.id);
    if (ids.length && ids.length < c.directory.length) dir.map.focus(ids);
    dir.section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const highlight = i => {
    const opts = [...box.querySelectorAll('[data-index]')];
    if (!opts.length) return;
    active = (i + opts.length) % opts.length;
    opts.forEach((el, n) => el.setAttribute('aria-selected', String(n === active)));
    input.setAttribute('aria-activedescendant', opts[active].id);
  };
  input.addEventListener('input', render);
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (box.hidden) render(); highlight(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(active - 1); }
    else if (e.key === 'Escape') close();
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(options[active]); }
  });
  box.addEventListener('pointerdown', e => { const li = e.target.closest('[data-index]'); if (li) { e.preventDefault(); pick(options[Number(li.dataset.index)]); } });
  input.addEventListener('blur', () => setTimeout(close, 120));
  form.addEventListener('submit', e => { e.preventDefault(); Object.assign(c.filters, { q: input.value.trim(), town: '' }); go(); });
}

function pickerMount(home, c) {
  const dialog = home.querySelector('[data-picker]');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const { L, safe } = c, open = c.directory.filter(p => c.details.get(p.id)?.publicRequests !== false);
  if (open.length < 2) return;
  const list = dialog.querySelector('[data-picker-list]'), filter = dialog.querySelector('[data-picker-filter]'), title = dialog.querySelector('#picker-title');
  let kind = '';
  const paint = () => {
    const q = c.normalize(filter.value.trim());
    const rows = open.filter(p => !q || c.normalize([p.name, p.ar, p.town, p.townAr].join(' ')).includes(q)).sort((a, b) => c.parishName(a).localeCompare(c.parishName(b), c.lang));
    list.innerHTML = rows.map(p => `<li><a href="${safe(c.requestURL(p.id, kind))}">${thumb(c, p)}<span><b>${safe(c.parishName(p))}</b><small>${safe(c.townName(p))}</small></span></a></li>`).join('') || `<li class="no-match">${L('No parish matches.', 'لا رعية مطابقة.')}</li>`;
  };
  home.querySelectorAll('[data-request]').forEach(link => link.addEventListener('click', e => {
    e.preventDefault();
    kind = link.dataset.request;
    const label = [...c.REQUESTS, ...c.OTHER_REQUESTS].find(r => r[0] === kind);
    title.textContent = L(`${label ? label[2][0] : 'Request'}: which parish?`, `${label ? label[2][1] : 'طلب'}: من أي رعية؟`);
    filter.value = ''; paint(); dialog.showModal(); filter.focus();
  }));
  filter.addEventListener('input', paint);
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
}

function storiesMount(home) {
  const track = home.querySelector('[data-story-track]'), nav = home.querySelector('.story-nav');
  if (!track) return;
  if (nav) {
    const fits = new ResizeObserver(() => { nav.hidden = track.scrollWidth <= track.clientWidth + 4; });
    fits.observe(track);
    teardown.push(() => fits.disconnect());
  }
  home.querySelectorAll('[data-story-step]').forEach(button => button.addEventListener('click', () => {
    const story = track.querySelector('.story'), step = (story?.getBoundingClientRect().width || 300) + 32;
    const dir = getComputedStyle(track).direction === 'rtl' ? -1 : 1;
    track.scrollBy({ left: Number(button.dataset.storyStep) * step * dir, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }));
}

/* The header sits clear over the night sky, and turns solid once the hero is behind it. */
function headerMount(home) {
  const hero = home.querySelector('[data-hero]');
  document.body.classList.toggle('over-hero', !!hero);
  if (!hero || !('IntersectionObserver' in window)) return;
  const watch = new IntersectionObserver(([entry]) => document.body.classList.toggle('over-hero', entry.isIntersecting), { rootMargin: '-76px 0px 0px 0px', threshold: 0 });
  const scrolled = () => document.body.classList.toggle('is-scrolled', scrollY > 24);
  watch.observe(hero); scrolled();
  addEventListener('scroll', scrolled, { passive: true });
  teardown.push(() => { watch.disconnect(); removeEventListener('scroll', scrolled); document.body.classList.remove('over-hero', 'is-scrolled'); });
}
