/* Bilingual helper.
   t(en, ar) returns the right side for the current language. Pairs live at the
   call site on purpose: a translator can read both halves without hunting for a
   key, and a missing Arabic string falls back to English instead of showing
   "nav.dashboard" to a parish secretary.
   Adding French later means a third argument and one more case here. */

const STORE = 'pl-lang';
export const LANGS = { en: { label: 'EN', dir: 'ltr', name: 'English' },
                       ar: { label: 'ع',  dir: 'rtl', name: 'العربية' } };

export let lang = (() => {
  try { return LANGS[localStorage.getItem(STORE)] ? localStorage.getItem(STORE) : 'en'; }
  catch { return 'en'; }
})();

export const isAr = () => lang === 'ar';
export const t = (en, ar) => (lang === 'ar' && ar != null ? ar : en);

export function setLang(next) {
  if (!LANGS[next]) return;
  lang = next;
  try { localStorage.setItem(STORE, next); } catch { /* private mode */ }
  document.documentElement.lang = next;
  document.documentElement.dir = LANGS[next].dir;
}

/* Western digits throughout — Lebanese parish books use them — so numbers are
   formatted with en-US grouping in both languages and kept LTR in RTL runs. */
const NF = new Intl.NumberFormat('en-US');
export const num = n => NF.format(n);
export const usd = n => '$' + NF.format(Number(n).toFixed(2));
export const lbp = n => 'L.L ' + NF.format(Math.round(n));

const MONTHS = [['January','كانون الثاني'],['February','شباط'],['March','آذار'],['April','نيسان'],
  ['May','أيار'],['June','حزيران'],['July','تموز'],['August','آب'],['September','أيلول'],
  ['October','تشرين الأول'],['November','تشرين الثاني'],['December','كانون الأول']];
const DAYS = [['Sunday','الأحد'],['Monday','الإثنين'],['Tuesday','الثلاثاء'],['Wednesday','الأربعاء'],
  ['Thursday','الخميس'],['Friday','الجمعة'],['Saturday','السبت']];

export const month = i => t(...MONTHS[i]);
export const day = i => t(...DAYS[i]);
export const monthShort = i => t(MONTHS[i][0].slice(0, 3), MONTHS[i][1]);
export const dayShort = i => t(DAYS[i][0].slice(0, 3), DAYS[i][1].replace('ال', ''));

/** 4 Oct 2026 / ٤ تشرين الأول ٢٠٢٦ — digits stay Western either way. */
export function fmtDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getDate()} ${monthShort(x.getMonth())} ${x.getFullYear()}`;
}
export function fmtLong(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${day(x.getDay())} ${x.getDate()} ${month(x.getMonth())}`;
}
export const fmtTime = s => s;   // stored already as "10:30"

/* Search compares folded text: case, Latin accents (Rahmé → rahme), Arabic hamza seats, tashkeel,
   tatweel, ة/ه, ى/ي and Arabic-Indic digits all fold away, so either spelling finds the record.
   A query that is a phone number matches the digits whatever the spacing or the leading 0 / +961. */
export const fold = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, '')
  .replace(/ٱ/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x660)
  .toLowerCase().replace(/\s+/g, ' ').trim();
export function matches(text, q) {
  const f = fold(q);
  if (!f) return true;
  const hay = fold(text);
  if (hay.includes(f)) return true;
  const d = f.replace(/[\s+().-]/g, '');
  return /^\d{3,}$/.test(d) && hay.replace(/\D/g, '').includes(d.replace(/^0+/, ''));
}
