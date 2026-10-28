/* The public homepage. Every line comes from the dashboard: the Homepage editor
   (Administration → Homepage), each parish's Website content and public profile,
   and the events and announcements parishes publish. Empty sections say what a
   parish office can publish, rather than filling the page with placeholders. */
import { sanctuaryMarkup, mountSanctuary, roseOutline } from './home-sanctuary.js';
import { mapMarkup, locate, mountMap, projection } from './home-map.js';
import { animateHome, stopHomeMotion, scrollToTarget } from './home-motion.js';
import { icsHref, icsName, kindName, beirutNow, ADD_ICON } from './public-calendar.js';
import { find } from './search.js';
import { trackAction } from './beacon.js';
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
/* A bell in its belfry, for Mass times: it rings when the section arrives and under the pointer. */
const BELL = `<svg class="bell" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true" focusable="false"><g class="bell-body"><path d="M13.5 5.5a2.5 2.5 0 0 1 5 0"/><path d="M16 6.5c-4.6 0-6 3.6-6 7.6 0 3.8-1.4 5.9-3.2 7.4h18.4c-1.8-1.5-3.2-3.6-3.2-7.4 0-4-1.4-7.6-6-7.6Z"/><path d="M10.6 17.8h10.8" opacity=".5"/></g><circle class="bell-clapper" cx="16" cy="24.6" r="2" fill="currentColor" stroke="none"/></svg>`;
/* The cross of the Maronites, each arm ending in three small circles. */
const CROSS = `<svg viewBox="0 0 22 30" fill="currentColor" aria-hidden="true" focusable="false"><path d="M9.6 4h2.8v24H9.6zM2.5 11.6h17v2.8h-17z"/>${[[11, 3], [11, 27.6], [2.4, 13], [19.6, 13]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.1"/>`).join('')}${[[8.4, 4.4], [13.6, 4.4], [3.8, 10.4], [3.8, 15.6], [18.2, 10.4], [18.2, 15.6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.5"/>`).join('')}</svg>`;

/* Bilingual CMS text: the visitor's language, else the built-in wording in that language. */
/* Arabic counts agree with the number: one, two, three to ten, eleven and more. */
const PLURAL_AR = new Intl.PluralRules('ar');
const FORMS = {
  parish: { en: ['parish', 'parishes'], ar: { one: 'رعية', two: 'رعيتان', few: 'رعايا', many: 'رعية', other: 'رعية', zero: 'رعية' } },
  diocese: { en: ['diocese', 'dioceses'], ar: { one: 'أبرشية', two: 'أبرشيتان', few: 'أبرشيات', many: 'أبرشية', other: 'أبرشية', zero: 'أبرشية' } },
  celebration: { en: ['celebration this week', 'celebrations this week'], ar: { one: 'احتفال هذا الأسبوع', two: 'احتفالان هذا الأسبوع', few: 'احتفالات هذا الأسبوع', many: 'احتفالاً هذا الأسبوع', other: 'احتفال هذا الأسبوع', zero: 'احتفال هذا الأسبوع' } },
  town: { en: ['town or village', 'towns and villages'], ar: { one: 'بلدة', two: 'بلدتان', few: 'بلدات وقرى', many: 'بلدة وقرية', other: 'بلدة وقرية', zero: 'بلدة' } }
};
export const noun = (c, n, key) => c.lang === 'ar' ? FORMS[key].ar[PLURAL_AR.select(n)] : FORMS[key].en[n === 1 ? 0 : 1];
/* "3 parishes" as a phrase: Arabic says "رعية واحدة", "رعيتان", "٣ رعايا". */
export function counted(c, n, key) {
  if (c.lang !== 'ar') return `${c.number(n)} ${noun(c, n, key)}`;
  const form = PLURAL_AR.select(n);
  if (form === 'one') return key === 'parish' ? 'رعية واحدة' : `${noun(c, n, key)} واحدة`;
  if (form === 'two') return noun(c, n, key);
  return `${c.number(n)} ${noun(c, n, key)}`;
}
export const digits = (c, text) => c.lang === 'ar' ? String(text).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]) : String(text);
/* Diocese names are stored in English; the common forms read in Arabic. */
const SEES = { beirut: 'بيروت', byblos: 'جبيل', jbeil: 'جبيل', batroun: 'البترون', tripoli: 'طرابلس', zahle: 'زحلة', 'zahlé': 'زحلة', sidon: 'صيدا', saida: 'صيدا',
  tyre: 'صور', sour: 'صور', baalbek: 'بعلبك', jounieh: 'جونية', 'mount lebanon': 'جبل لبنان', 'the mountain': 'الجبل', akkar: 'عكار', jezzine: 'جزين', marjayoun: 'مرجعيون' };
export function dioceseName(c, name) {
  if (c.lang !== 'ar' || !name) return name || '';
  const m = String(name).match(/^(?:(?:maronite|melkite|greek orthodox|syriac|armenian|latin)\s+)?(arch)?(?:eparchy|diocese|archdiocese)\s+of\s+(.+?)(?:\s+of the\s+(maronites|melkites))?$/i);
  if (!m) return name;
  const sees = m[2].split(/\s+and\s+/i).map(x => SEES[x.trim().toLowerCase()]);
  return sees.every(Boolean) ? 'أبرشية ' + sees.join(' و') : name;
}
const words = (c, value, fallback) => value?.[c.lang]?.trim() || fallback?.[c.lang] || '';
/* CMS text without a default: the visitor's language, else the other one, marked as such. */
function either(c, value) {
  const own = value?.[c.lang]?.trim();
  if (own) return { text: own, attrs: '' };
  const alt = value?.[other(c.lang)]?.trim(), l = other(c.lang);
  return alt ? { text: alt, attrs: ` lang="${l}" dir="${l === 'ar' ? 'rtl' : 'ltr'}"` } : null;
}
export const paragraphs = (c, text) => String(text || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => `<p>${c.htmlText(p)}</p>`).join('');
const plain = html => String(html || '').replace(/<(br|\/p|\/li|\/h\d)\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const clip = (text, n) => text.length > n ? text.slice(0, n).replace(/\s+\S*$/, '') + '…' : text;
const hash = value => [...String(value)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

/* A parish or story without a photograph gets a monogram in a stone arch: honest, never a borrowed picture. */
const PREFIX = /^(saint|st\.?|sts\.?|our lady of|notre[- ]dame( de)?|mar|mart|سيدة|القديس(ة)?|مار|مارت)\s+/i;
export function monogram(name) {
  // the article goes (المخلّص → م), but not from names that begin with it (الياس → ا)
  const clean = String(name || '').trim().replace(PREFIX, '').replace(/^ال(?!ي)/, '');
  const ch = [...clean][0] || [...String(name || '·')][0];
  return `<span class="monogram" aria-hidden="true"><b>${ch.replace(/[&<>"']/g, '')}</b></span>`;
}

export function homeView(c) {
  const { L, safe, site } = c, on = key => site?.sections?.[key] !== false;
  const sections = [hero(c), on('week') ? week(c) : '', on('map') ? directory(c) : '', on('requests') ? requests(c) : '',
    on('times') ? times(c) : '', on('news') ? news(c) : '', on('stories') ? stories(c) : '', on('verse') ? verse(c) : '', on('about') ? about(c) : '', on('join') ? join(c) : ''];
  return `<div class="home" data-home>
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
  const stat = (n, key) => `<li><b data-count="${n}">${c.number(n)}</b><span>${noun(c, n, key)}</span></li>`;
  return `<section class="hero hero-sanctuary" id="top" data-hero aria-labelledby="hero-title">
    <div class="hero-art" data-scene>${sanctuaryMarkup({ inscription: L('Gloria in excelsis Deo', 'المجد لله في العُلى') })}</div><div class="hero-shade" aria-hidden="true"></div>
    <div class="site-wrap hero-inner">
      ${announcement}
      <p class="hero-mark" data-hero-rise>${CROSS}<span>${L('The parishes of Lebanon', 'رعايا لبنان')}</span></p>
      <h1 class="hero-title" id="hero-title">${safe(words(c, site?.hero?.title, HOME_DEFAULTS.hero.title))}</h1>
      <p class="hero-lede" data-hero-rise>${safe(words(c, site?.hero?.subtitle, HOME_DEFAULTS.hero.subtitle))}</p>
      <div class="hero-row"><form class="hero-search" role="search" data-hero-search data-hero-rise>
        <label class="sr-only" for="hero-q">${L('Parish, town or village', 'رعية أو بلدة أو قرية')}</label>
        <div class="hero-field">${SEARCH}<input id="hero-q" type="search" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="hero-suggest" placeholder="${safe(L('Parish, town or village', 'رعية أو بلدة أو قرية'))}">
          <button type="submit">${L('Search', 'ابحث')}</button></div>
        <ul class="hero-suggest" id="hero-suggest" role="listbox" aria-label="${safe(L('Suggestions', 'اقتراحات'))}" hidden></ul>
      </form>
      <ul class="hero-facts" data-hero-rise aria-label="${safe(L('ParishLife in numbers', 'ParishLife بالأرقام'))}">
        ${stat(f.parishes, 'parish')}${stat(f.dioceses, 'diocese')}${f.week ? stat(f.week, 'celebration') : stat(f.towns, 'town')}
      </ul></div>
    </div>
    <p class="hero-tip" data-hero-tip role="status" hidden></p>
    <a class="scroll-cue" href="#week" data-scroll-cue aria-label="${safe(L('Scroll to this week', 'انتقل إلى هذا الأسبوع'))}"><span aria-hidden="true"></span></a>
  </section>`;
}

/* ---------- this week ---------- */
/* The seven days as a ribbon (a red lamp marks today, dots mark what is published), and the
   week's celebrations as cards beneath; choosing a day narrows the cards to it. */
function week(c) {
  const { L, safe } = c, { days, all, inWeek } = weekEvents(c), loc = c.lang === 'ar' ? 'ar-LB' : 'en-GB';
  const kind = e => kindName(L, e.kind);
  const date = d => new Date(d + 'T12:00:00');
  const head = `<header class="sec-head" data-reveal><h2 id="week-title">${L('This week', 'هذا الأسبوع')}</h2><p>${L('Masses and celebrations the parishes have published for the next seven days.', 'القداديس والاحتفالات التي نشرتها الرعايا للأيام السبعة المقبلة.')}</p></header>`;
  const card = (e, later = false) => {
    const title = c.pair(e, 'title', 'titleAr') || kind(e), d = date(e.d), place = [c.parishName(e.parish), c.townName(e.parish)].filter(Boolean).join(L(', ', '، '));
    return `<li class="wk-ev k-${safe(e.kind || 'event')}" data-day="${safe(e.d)}" data-parish="${safe(e.parish.id)}" data-reveal-item>
      <a class="wk-ev-link" href="${safe(e.id ? c.eventURL(e.parish.id, e.id) : c.calendarURL(e.parish.id))}">
        <span class="wk-date" aria-hidden="true"><small>${safe(new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(d))}</small><b>${safe(digits(c, d.getDate()))}</b><small>${safe(new Intl.DateTimeFormat(loc, { month: 'short' }).format(d))}</small></span>
        <span class="wk-body">${later ? `<span class="wk-later">${L('Coming later', 'لاحقاً')}</span>` : ''}
          <span class="wk-meta">${e.t ? `<time>${safe(digits(c, e.t))}</time>` : ''}<span class="wk-kind">${safe(kind(e))}</span></span>
          <strong dir="auto">${safe(title)}</strong>
          <span class="wk-where">${PIN}${safe(place)}</span>
          <span class="sr-only">${safe(new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(d))}</span></span></a>
      <a class="wk-add" href="${icsHref(e, title, place, e.id ? c.shareURL(c.eventURL(e.parish.id, e.id)) : '')}" download="${safe(icsName(title))}" aria-label="${safe(L(`Add ${title} to my calendar`, `أضف «${title}» إلى رزنامتي`))}" title="${safe(L('Add to my calendar', 'أضف إلى رزنامتي'))}">${ADD_ICON}</a></li>`;
  };
  const tag = inWeek.length ? 'button' : 'span';    // with nothing to filter, the ribbon is only a picture of the week
  const ribbon = `<ol class="wk-days" aria-label="${safe(L('The next seven days', 'الأيام السبعة المقبلة'))}">${days.map((d, i) => {
    const n = inWeek.filter(e => e.d === d).length;
    return `<li><${tag} ${tag === 'button' ? 'type="button" aria-pressed="false" ' : ''}class="wk-day${i === 0 ? ' is-today' : ''}${date(d).getDay() === 0 ? ' is-sunday' : ''}${n ? '' : ' is-quiet'}" data-wk-day="${d}">
      <span class="wk-dow">${safe(new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(date(d)))}</span><b>${safe(digits(c, date(d).getDate()))}</b>
      <span class="wk-dots" aria-hidden="true">${i === 0 ? '<span class="lamp"></span>' : ''}${'<i></i>'.repeat(Math.min(n, 3))}</span>
      <span class="sr-only">${safe(i === 0 ? L('Today, ', 'اليوم، ') : '')}${n ? safe(L(`${n} published`, `منشور: ${c.number(n)}`)) : safe(L('nothing published', 'لا شيء منشور'))}</span></${tag}></li>`;
  }).join('')}</ol>`;
  if (!inWeek.length) {
    const next = all.find(e => e.d > days[6]);
    return `<section class="week" id="week" aria-labelledby="week-title"><div class="site-wrap">${head}${tonight(c, all)}
      <div class="wk" data-reveal>${ribbon}
        <div class="wk-quiet"><span class="lamp is-unlit" aria-hidden="true"></span><p>${L('No celebrations have been published for the next seven days yet.', 'لم تُنشر احتفالات للأيام السبعة المقبلة بعد.')}${next ? '' : ` ${L('Parish offices add public Masses and events from their parish calendar in ParishLife.', 'تضيف مكاتب الرعايا القداديس والأحداث العامة من رزنامة الرعية في ParishLife.')}`}</p></div>
        ${next ? `<ul class="wk-list">${card(next, true)}</ul>` : ''}</div></div></section>`;
  }
  return `<section class="week" id="week" aria-labelledby="week-title"><div class="site-wrap">${head}${tonight(c, all)}
    <div class="wk" data-wk>${ribbon}
      <ul class="wk-list" data-wk-list>${inWeek.map(e => card(e)).join('')}</ul>
      <p class="wk-none" data-wk-none hidden></p></div></div></section>`;
}

/* Still to come today, across every parish: the Masses and celebrations that have not started
   yet by the clock in Beirut, soonest first. Nothing is shown once the day's last one has begun. */
function tonight(c, all) {
  const { L, safe } = c, now = beirutNow();
  const left = all.filter(e => e.d === now.d && /^\d{2}:\d{2}$/.test(e.t || '') && e.t >= now.t).slice(0, 8);
  if (!left.length) return '';
  return `<div class="wk-tonight" data-reveal><h3><span class="lamp" aria-hidden="true"></span>${L('Still to come today', 'لاحقاً اليوم')}</h3>
    <ul>${left.map(e => `<li><a href="${safe(e.id ? c.eventURL(e.parish.id, e.id) : c.calendarURL(e.parish.id))}"><time>${safe(digits(c, e.t))}</time>
      <span><b dir="auto">${safe(c.pair(e, 'title', 'titleAr') || kindName(L, e.kind))}</b><small>${safe([c.parishName(e.parish), c.townName(e.parish)].filter(Boolean).join(L(', ', '، ')))}</small></span></a></li>`).join('')}</ul></div>`;
}

/* ---------- directory ---------- */
function choices(c, key, label, values, current, show = v => v) {
  return `<label class="dir-select"><span class="sr-only">${label}</span><select data-filter="${key}"><option value="">${label}</option>${values.map(v => `<option value="${c.safe(v)}" ${current === v ? 'selected' : ''}>${c.safe(show(v))}</option>`).join('')}</select></label>`;
}
function directory(c) {
  const { L, safe, filters } = c, uniq = list => [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b, c.lang));
  return `<section class="directory" id="directory" aria-labelledby="directory-title"><div class="site-wrap dir-grid">
    <header class="sec-head dir-head" data-reveal><h2 id="directory-title">${L('Find a parish', 'ابحث عن رعية')}</h2><p>${L('Every parish on ParishLife, on the map of Lebanon. Choose a light, or search by name or town.', 'جميع الرعايا المسجّلة في ParishLife على خريطة لبنان. اختر نوراً، أو ابحث باسم الرعية أو البلدة.')}</p></header>
    <div class="dir-map" data-reveal>${mapMarkup(L)}</div>
    <div class="dir-list">
      <form class="dir-filters" role="search" data-dir-form data-reveal>
        <label class="dir-search">${SEARCH}<span class="sr-only">${L('Search parish or town', 'ابحث عن رعية أو بلدة')}</span><input id="directory-filter" type="search" value="${safe(filters.q)}" placeholder="${safe(L('Parish, town or village', 'رعية أو بلدة أو قرية'))}"></label>
        <div class="dir-row">
          ${choices(c, 'town', L('All towns', 'كل البلدات'), uniq(c.directory.map(p => p.town)), filters.town)}
          ${choices(c, 'diocese', L('All dioceses', 'كل الأبرشيات'), uniq(c.directory.map(p => p.diocese)), filters.diocese, v => dioceseName(c, v))}
          ${choices(c, 'rite', L('All rites', 'كل الطقوس'), uniq(c.directory.map(p => c.details.get(p.id)?.parish?.rite)), filters.rite)}
        </div>
        <div class="dir-row dir-tools">
          <button type="button" class="chip" data-near aria-pressed="${filters.location ? 'true' : 'false'}">${NEAR}${L('Near me', 'بالقرب مني')}</button>
          <label class="dir-sort">${L('Sort by', 'ترتيب حسب')} <select data-filter="sort"><option value="name" ${filters.sort === 'name' ? 'selected' : ''}>${L('Name', 'الاسم')}</option><option value="town" ${filters.sort === 'town' ? 'selected' : ''}>${L('Town', 'البلدة')}</option></select></label>
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
  const { filters } = c;
  const chosen = c.directory.filter(p => (!filters.town || p.town === filters.town) && (!filters.diocese || p.diocese === filters.diocese)
      && (!filters.rite || c.details.get(p.id)?.parish?.rite === filters.rite));
  return find(filters.q, chosen, p => [p.name, p.ar, p.town, p.townAr, p.diocese].join(' '), c.normalize)
    .map(p => ({ p, d: km(c, places.get(p.id)) }))
    .sort((a, b) => filters.location ? (a.d ?? Infinity) - (b.d ?? Infinity) || c.parishName(a.p).localeCompare(c.parishName(b.p), c.lang)
      : (filters.sort === 'town' ? c.townName(a.p).localeCompare(c.townName(b.p), c.lang) : 0) || c.parishName(a.p).localeCompare(c.parishName(b.p), c.lang));
}
function thumb(c, p) {
  const photo = c.parishPhotos(c.details.get(p.id))[0];
  return `<span class="arch-thumb">${photo ? `<img src="${c.safe(photo)}" alt="" loading="lazy" decoding="async">` : monogram(c.parishName(p))}</span>`;
}
function listItems(c, rows, places) {
  const { L, safe } = c;
  if (!rows.length) return `<li class="list-empty"><p>${L('No parish matches this search.', 'لا رعية تطابق هذا البحث.')}</p><button type="button" class="text-button" data-dir-clear>${L('Show every parish', 'عرض كل الرعايا')}</button></li>`;
  return rows.map(({ p, d }) => {
    const rite = c.details.get(p.id)?.parish, riteName = c.pair(rite, 'rite', 'riteAr'), placed = places.get(p.id);
    return `<li class="parish-item" data-parish="${safe(p.id)}" data-reveal-item><a href="${safe(c.profileURL(p.id))}">${thumb(c, p)}
      <span class="pi-text"><strong>${safe(c.parishName(p))}</strong><span class="pi-town">${PIN}${safe(c.townName(p) || L('Town not published', 'البلدة غير منشورة'))}</span><small>${[dioceseName(c, p.diocese), riteName].filter(Boolean).map(safe).join(L(', ', '، '))}</small></span>
      ${d !== null ? `<span class="pi-km">${c.number(Math.round(d * 10) / 10)} ${L('km', 'كم')}</span>` : placed ? '' : `<span class="pi-km is-off">${L('Not on the map yet', 'ليست على الخريطة بعد')}</span>`}</a></li>`;
  }).join('');
}

/* ---------- requests ---------- */
function requests(c) {
  const { L, safe } = c, open = c.directory.filter(p => c.details.get(p.id)?.publicRequests !== false);
  if (!open.length) return '';
  const href = kind => open.length === 1 ? c.requestURL(open[0].id, kind) : '#requests';
  const arch = ([kind, art, title, sub]) => `<li data-reveal-item><a class="arch" href="${safe(href(kind))}" data-request="${kind}" data-tilt><span class="arch-icon">${c.icon(art)}</span><strong>${L(...title)}</strong><small>${L(...sub)}</small></a></li>`;
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
  const head = `<header class="sec-head" data-reveal><span class="times-mark" aria-hidden="true">${BELL}</span><h2 id="times-title">${L('Mass times', 'مواعيد القداديس')}</h2><p>${L('As published by each parish office. On feast days, check the parish page for changes.', 'كما ينشرها مكتب كل رعية. في الأعياد، راجع صفحة الرعية لمعرفة أي تغيير.')}</p></header>`;
  const body = rows.length ? `<div class="times-board">${rows.map((p, i) => `<article class="times-entry" data-reveal-item ${i >= 6 ? 'data-extra hidden' : ''}>
      <h3><a href="${safe(c.profileURL(p.id, '#times'))}">${safe(c.parishName(p))}</a></h3><p class="times-town">${safe(c.townName(p))}</p>
      <div class="times-text" dir="auto">${c.htmlText(c.content(c.details.get(p.id), 'massTimes'))}</div></article>`).join('')}</div>
      ${rows.length > 6 ? `<button type="button" class="text-button times-all" data-times-all>${L(`Show all ${rows.length} parishes`, `عرض جميع الرعايا (${c.number(rows.length)})`)}</button>` : ''}`
    : '';
  /* Until a parish publishes its times, the section is a slim band rather than a page of white. */
  if (!rows.length) return `<section class="times is-empty" id="times" aria-labelledby="times-title"><div class="site-wrap times-slim" data-reveal>
      <span class="times-mark" aria-hidden="true">${BELL}</span>
      <div><h2 id="times-title">${L('Mass times', 'مواعيد القداديس')}</h2><p>${L('No parish has published its Mass times yet. Parish offices add them under Website content in ParishLife, and they appear here and on the parish’s page.', 'لم تنشر أي رعية مواعيد قداديسها بعد. تضيفها مكاتب الرعايا ضمن محتوى الموقع في ParishLife، فتظهر هنا وفي صفحة الرعية.')}</p></div>
      <a class="btn btn-ink-line btn-small" href="#directory" data-jump>${L('Find a parish', 'ابحث عن رعية')}</a></div></section>`;
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
      <figure class="story-arch">${s.image ? `<img src="${safe(s.image)}" alt="" loading="lazy" decoding="async">` : `<img src="assets/images/valley/crest-dawn.webp" alt="" loading="lazy" decoding="async">`}</figure>
      <h3${s.t.attrs}>${safe(s.t.text)}</h3>${s.b ? `<p${s.b.attrs}>${safe(s.b.text)}</p>` : ''}
      ${s.link ? `<a class="story-link" href="${safe(s.link)}">${L('Read more', 'اقرأ المزيد')}<span class="sr-only">: ${safe(s.t.text)}</span></a>` : ''}</article>`).join('')}</div></section>`;
}

/* ---------- the verse: every parish is one of these lights ---------- */
function verse(c) {
  const { L } = c;
  return `<section class="verse" id="verse" aria-labelledby="verse-text"><div class="site-wrap verse-inner">
    <div class="verse-rose" aria-hidden="true">${roseOutline()}</div>
    <span class="verse-cross" aria-hidden="true">${CROSS}</span>
    <blockquote class="verse-quote" data-lit><p id="verse-text">${L('Let your <em>light</em> shine before others, so that they may see your good works and give glory to your Father in heaven.', 'فَلْيُضِئْ <em>نُورُكُمْ</em> هكَذَا قُدَّامَ النَّاسِ، لِكَيْ يَرَوْا أَعْمَالَكُمُ الْحَسَنَةَ، وَيُمَجِّدُوا أَبَاكُمُ الَّذِي فِي السَّمَاوَاتِ.')}</p>
      <footer><cite>${L('Matthew 5:16', 'متّى ٥: ١٦')}</cite></footer></blockquote>
    <p class="verse-note" data-reveal>${L('Every parish on ParishLife is one of those lights.', 'وكلّ رعية على ParishLife نورٌ من هذه الأنوار.')}</p>
  </div></section>`;
}

/* ---------- about and join ---------- */
/* A village church of the mountain, as the valley wakes: a stone front with its bell-cote, the
   bell, the cross, and the lamps lit inside. */
const CHAPEL = `<svg class="about-chapel" viewBox="0 0 240 150" aria-hidden="true" focusable="false">
  <defs><radialGradient id="chapel-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFD98C" stop-opacity=".34"/><stop offset=".6" stop-color="#FFD98C" stop-opacity=".08"/><stop offset="1" stop-color="#FFD98C" stop-opacity="0"/></radialGradient>
    <linearGradient id="chapel-stone" x1="0" x2="1"><stop offset="0" stop-color="#1B2135"/><stop offset=".7" stop-color="#232A40"/><stop offset="1" stop-color="#3A3542"/></linearGradient>
    <clipPath id="chapel-front"><path d="M92 121V84l32-22 32 22v37Z"/></clipPath></defs>
  <circle cx="124" cy="100" r="46" fill="url(#chapel-glow)"/>
  <path d="M0 150V126c40-9 78-12 112-10s66 6 92 2c16-2 28-5 36-7v39Z" fill="#141A2C"/>
  <g fill="url(#chapel-stone)"><path d="M92 121V84l32-22 32 22v37Z"/><path d="M116 63V47h16v16Z"/><path d="M114.5 48c0-8 4.5-12 9.5-12s9.5 4 9.5 12Z"/></g>
  <g clip-path="url(#chapel-front)" stroke="#5B5566" stroke-width=".5" opacity=".55"><path d="M90 92H158M90 100H158M90 108H158M90 116H158M90 84H158M90 76H158"/><path d="M104 84v8M118 92v8M132 84v8M146 92v8M110 100v8M138 100v8M100 108v8M124 108v8M148 108v8"/></g>
  <path d="M92 84l32-22 32 22" fill="none" stroke="#6E6372" stroke-width="1.2" opacity=".8"/>
  <path d="M124 36V25M120 28.5h8" stroke="#232A40" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M119.5 47v-4.5a4.5 4.5 0 0 1 9 0V47Z" fill="#2E2A3A"/><g class="chapel-bell"><path d="M121.6 41.5c0-1.6.9-2.6 2.4-2.6s2.4 1 2.4 2.6v3h-4.8Z" fill="#D9B060"/><circle cx="124" cy="45.4" r=".8" fill="#D9B060"/></g>
  <path d="M118.5 121v-13a5.5 5.5 0 0 1 11 0v13Z" fill="#F4C978"/><circle cx="124" cy="82" r="5" fill="#F4C978"/><path d="M124 77.6v8.8M119.6 82h8.8" stroke="#9A6A22" stroke-width=".9"/>
  <path d="M102 104v-5.5a3 3 0 0 1 6 0v5.5ZM140 104v-5.5a3 3 0 0 1 6 0v5.5Z" fill="#E9B85E"/>
</svg>`;
/* The first letter of the About text as an illuminated initial, as in a liturgical book. The
   letter stays in the paragraph for reading aloud; the painted one beside it is decoration. */
function illuminated(c, html) {
  const first = html.match(/^<p>([A-Za-z])/);
  if (c.lang === 'ar' || !first) return html;
  return `<span class="about-initial" aria-hidden="true">${first[1]}</span>` + html.replace('<p>', '<p class="has-initial">');
}
function about(c) {
  if (c.site && !c.site.about) return '';
  const { L, safe } = c, a = c.site?.about, f = facts(c);
  return `<section class="about" id="about" aria-labelledby="about-title"><div class="site-wrap about-grid">
    <figure class="about-mark" data-reveal><img src="assets/images/valley/crest-dawn.webp" alt="" loading="lazy" decoding="async" data-parallax="-8">${CHAPEL}</figure>
    <div class="about-copy" data-reveal data-lit><h2 id="about-title">${safe(words(c, a?.title, HOME_DEFAULTS.about.title))}</h2>${illuminated(c, paragraphs(c, words(c, a?.body, HOME_DEFAULTS.about.body)))}
      <dl class="about-facts">${[[f.parishes, 'parish'], [f.dioceses, 'diocese'], [f.towns, 'town']]
        .map(([n, key]) => `<div><dt>${noun(c, n, key).replace(/^./, ch => ch.toUpperCase())}</dt><dd data-count="${n}">${c.number(n)}</dd></div>`).join('')}</dl></div>
  </div></section>`;
}
function join(c) {
  if (c.site && !c.site.join) return '';
  const { L, safe } = c, j = c.site?.join;
  return `<section class="join" id="join" aria-labelledby="join-title"><div class="join-art" aria-hidden="true">${['sky', 'far', 'near'].map(part => `<img src="assets/images/valley/valley-wide-dusk-${part}.webp" alt="" loading="lazy" decoding="async">`).join('')}</div><div class="site-wrap join-inner" data-reveal>
    <h2 id="join-title">${safe(words(c, j?.title, HOME_DEFAULTS.join.title))}</h2>${paragraphs(c, words(c, j?.body, HOME_DEFAULTS.join.body))}
    <div class="join-actions"><a class="btn btn-gilt" href="index.html">${L('Open the members portal', 'ادخل إلى بوّابة المؤمنين')}</a><a class="btn btn-line" href="index.html?signup=1">${L('Create an account', 'أنشئ حساباً')}</a><a class="text-button" href="public.html?view=bundles">${L('ParishLife bundles', 'باقات ParishLife')}</a></div>
  </div></section>`;
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
  weekMount(home, c);
  headerMount(home);
  home.querySelectorAll('[data-jump]').forEach(a => a.addEventListener('click', e => { const t = home.querySelector(a.getAttribute('href')); if (t) { e.preventDefault(); scrollToTarget(t); } }));
  const cue = home.querySelector('[data-scroll-cue]');
  cue?.addEventListener('click', e => { e.preventDefault(); scrollToTarget(cue.closest('section').nextElementSibling); });
  animateHome(home);
}
export function unmountHome() { stopHomeMotion(); teardown.forEach(fn => fn()); teardown = []; }

function sceneMount(home, c) {
  const host = home.querySelector('[data-scene]'), tip = home.querySelector('[data-hero-tip]');
  if (!host) return;
  const places = c.directory.map(p => ({ id: p.id, name: c.parishName(p), town: c.townName(p) }));
  const words = { light: c.L('Light a candle', 'أضئ شمعة'), lit: c.L('A candle lit for your intention', 'شمعة مضاءة على نيّتك') };
  const scene = mountSanctuary(host, places, { tip, words, onPick: id => { location.href = c.profileURL(id); } });
  teardown.push(() => scene.destroy());
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
    status.textContent = rows.length === c.directory.length ? counted(c, rows.length, 'parish') : L(`${rows.length} of ${c.directory.length} parishes`, `${c.number(rows.length)} من أصل ${counted(c, c.directory.length, 'parish')}`);
    map.filter(rows.map(r => r.p.id));
    const off = c.directory.filter(p => !places.has(p.id)).length;
    note.textContent = off ? L(`${off} ${off === 1 ? 'parish is' : 'parishes are'} not on the map yet. A parish office places its parish by adding coordinates to its public parish profile.`, `عدد الرعايا التي لا تظهر على الخريطة بعد: ${c.number(off)}. يضع مكتب الرعية رعيته على الخريطة بإضافة الإحداثيات إلى صفحة الرعية العامة.`) : '';
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
  let typed = 0;   // a search counts once the visitor stops typing
  input.addEventListener('input', () => { c.filters.q = input.value; paint(true); clearTimeout(typed); typed = setTimeout(() => input.value.trim().length >= 3 && trackAction('search', '', input.value), 1500); });
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
    if (!c.normalize(input.value.trim())) return close();
    const parishes = find(input.value, c.directory, p => [p.name, p.ar, p.town, p.townAr].join(' '), c.normalize).slice(0, 5)
      .map(p => ({ kind: 'parish', id: p.id, label: c.parishName(p), sub: c.townName(p) }));
    const places = find(input.value, towns, p => [p.town, p.townAr].join(' '), c.normalize).slice(0, 3)
      .map(p => ({ kind: 'town', town: p.town, label: c.townName(p), sub: L('Town', 'بلدة') }));
    options = [...parishes, ...places];
    box.innerHTML = options.length ? options.map((o, i) => `<li role="option" id="hero-opt-${i}" data-index="${i}" aria-selected="false">${o.kind === 'parish' ? '<span class="lamp" aria-hidden="true"></span>' : PIN}<span><b>${safe(o.label)}</b><small>${safe(o.sub)}</small></span></li>`).join('')
      : `<li class="no-match" role="option" aria-disabled="true">${L('No parish or town matches. Press Search to look through the directory.', 'لا رعية أو بلدة مطابقة. اضغط «ابحث» للبحث في الدليل.')}</li>`;
    box.hidden = false; input.setAttribute('aria-expanded', 'true'); active = -1;
  };
  const pick = o => {
    if (!o) return;
    trackAction('search', o.kind === 'parish' ? o.id : '', input.value);
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
    scrollToTarget(dir.section);
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
  form.addEventListener('submit', e => { e.preventDefault(); trackAction('search', '', input.value); Object.assign(c.filters, { q: input.value.trim(), town: '' }); go(); });
}

function pickerMount(home, c) {
  const dialog = home.querySelector('[data-picker]');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const { L, safe } = c, open = c.directory.filter(p => c.details.get(p.id)?.publicRequests !== false);
  if (open.length < 2) return;
  const list = dialog.querySelector('[data-picker-list]'), filter = dialog.querySelector('[data-picker-filter]'), title = dialog.querySelector('#picker-title');
  let kind = '';
  const paint = () => {
    const rows = find(filter.value, open, p => [p.name, p.ar, p.town, p.townAr].join(' '), c.normalize).sort((a, b) => c.parishName(a).localeCompare(c.parishName(b), c.lang));
    list.innerHTML = rows.map(p => `<li><a href="${safe(c.requestURL(p.id, kind))}">${thumb(c, p)}<span><b>${safe(c.parishName(p))}</b><small>${safe(c.townName(p))}</small></span></a></li>`).join('') || `<li class="no-match">${L('No parish matches.', 'لا رعية مطابقة.')}</li>`;
  };
  home.querySelectorAll('[data-request]').forEach(link => link.addEventListener('click', e => {
    e.preventDefault();
    kind = link.dataset.request;
    const label = [...c.REQUESTS, ...c.OTHER_REQUESTS].find(r => r[0] === kind);
    title.textContent = L(`${label ? label[2][0] : 'Request'}: which parish?`, `${label ? label[2][1] : 'طلب'}: في أي رعية؟`);
    filter.value = ''; paint(); dialog.showModal(); filter.focus();
  }));
  filter.addEventListener('input', paint);
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
}

function weekMount(home, c) {
  const box = home.querySelector('[data-wk]');
  if (!box) return;
  const cards = [...box.querySelectorAll('.wk-ev')], none = box.querySelector('[data-wk-none]'), loc = c.lang === 'ar' ? 'ar-LB' : 'en-GB';
  box.querySelectorAll('[data-wk-day]').forEach(button => button.addEventListener('click', () => {
    const day = button.getAttribute('aria-pressed') === 'true' ? '' : button.dataset.wkDay;
    box.querySelectorAll('[data-wk-day]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.wkDay === day)));
    let shown = 0;
    cards.forEach(card => { const on = !day || card.dataset.day === day; card.hidden = !on; if (on) { shown++; card.animate?.([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.16,1,.3,1)' }); } });
    none.hidden = shown > 0;
    if (!shown) none.textContent = c.L(`Nothing has been published for ${new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(day + 'T12:00:00'))}.`, `لم يُنشر شيء ليوم ${new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(day + 'T12:00:00'))}.`);
  }));
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

function headerMount(home) { teardown.push(watchHero(home.querySelector('[data-hero]'))); }
/* The header sits clear over a dark hero, and turns solid once the hero is behind it. */
export function watchHero(hero) {
  document.body.classList.toggle('over-hero', !!hero);
  if (!hero || !('IntersectionObserver' in window)) return () => {};
  const watch = new IntersectionObserver(([entry]) => document.body.classList.toggle('over-hero', entry.isIntersecting), { rootMargin: '-76px 0px 0px 0px', threshold: 0 });
  const scrolled = () => document.body.classList.toggle('is-scrolled', scrollY > 24);
  watch.observe(hero); scrolled();
  addEventListener('scroll', scrolled, { passive: true });
  return () => { watch.disconnect(); removeEventListener('scroll', scrolled); document.body.classList.remove('over-hero', 'is-scrolled'); };
}
