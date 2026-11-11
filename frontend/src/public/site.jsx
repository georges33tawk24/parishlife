/* What every public page reads: the visitor's language, the parishes and what they publish, and
   the small helpers that turn them into words. One object (the page's "c"), shared through
   SiteContext so a section can ask for it wherever it sits. */
import { createContext, useContext } from 'react';

export const SiteContext = createContext(null);
export const useSite = () => useContext(SiteContext);

export const REQUESTS = [
  ['baptism', 'water', ['Baptism', 'المعمودية'], ['For a child or an adult', 'لطفل أو لشخص بالغ']],
  [
    'communion',
    'chalice',
    ['First Communion', 'المناولة الأولى'],
    ['For a child getting ready to receive', 'لطفل يستعدّ للمناولة']
  ],
  [
    'confirmation',
    'flame',
    ['Confirmation', 'الميرون'],
    ['Chrismation, the seal of the Holy Spirit', 'مسحة الميرون، ختم الروح القدس']
  ],
  [
    'marriage',
    'rings',
    ['Marriage', 'الإكليل'],
    ['Open your marriage file with the parish', 'افتح ملف الزواج مع الرعية']
  ],
  ['funeral', 'candle', ['Funeral', 'الجنّاز'], ['For a family member who has died', 'لأحد أفراد العائلة المتوفّين']],
  [
    'certificate',
    'cert',
    ['Certificate', 'شهادة'],
    ['A copy of an entry in the parish register', 'إفادة عن قيد في سجلّ الرعية']
  ]
];
export const OTHER_REQUESTS = [
  [
    'booking',
    'hall',
    ['Book a hall or room', 'حجز قاعة أو مكان'],
    [
      'For a reception, a family gathering or a meeting — see when it is free',
      'لاستقبال أو لقاء عائلي أو اجتماع — واطّلع على الأوقات المتاحة'
    ]
  ],
  [
    'custom',
    'message',
    ['Something else', 'طلب آخر'],
    ['A house blessing, a Mass intention, a visit to someone who is sick…', 'تبريك منزل، نيّة قدّاس، زيارة مريض…']
  ]
];

/* The photographs a parish publishes: its own picture first, then its gallery. Only addresses
   the site can show safely. */
export const DEFAULT_PHOTOS = ['assets/images/church-light.jpg', 'assets/images/church-interior.jpg'];
export const parishPhotos = d =>
  [d?.parishPhoto, ...(Array.isArray(d?.gallery) ? d.gallery : [])].filter(
    src => typeof src === 'string' && /^(https:\/\/|\/?assets\/images\/|data:image\/(png|jpeg|webp);base64,)/i.test(src)
  );

export const localToday = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};
export const normalize = value =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ًͯ-ٰٟ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLowerCase();

/* Text the parish typed, with its line breaks kept. */
export function Lines({ text }) {
  const lines = String(text ?? '').split('\n');
  return lines.map((line, i) => (i ? [<br key={i} />, line] : line));
}

/* The page's "c": everything a section needs to speak the visitor's language. */
export function makeSite({
  lang,
  directory = [],
  details = new Map(),
  site = null,
  liturgy = null,
  filters,
  setFilters
}) {
  const L = (en, ar) => (lang === 'ar' ? ar : en);
  const pair = (obj, en = 'en', ar = 'ar') => obj?.[lang === 'ar' ? ar : en] || obj?.[en] || obj?.[ar] || '';
  const content = (d, key) => pair(d?.content?.[key]);
  const profileURL = (id, hash = '') => 'public.html?parish=' + encodeURIComponent(id) + hash;
  const eventURL = (id, eventId) =>
    'public.html?parish=' + encodeURIComponent(id) + '&event=' + encodeURIComponent(eventId);
  return {
    lang,
    L,
    pair,
    directory,
    details,
    site,
    liturgy,
    filters,
    setFilters,
    parishName: p => pair(p, 'name', 'ar'),
    townName: p => pair(p, 'town', 'townAr'),
    number: value => new Intl.NumberFormat(lang === 'ar' ? 'ar-LB' : 'en').format(value),
    normalize,
    localToday,
    content,
    profileURL,
    eventURL,
    /* Visitors can request without an account; the office owns subsequent processing. */
    requestURL: (id, kind) => 'public.html?parish=' + encodeURIComponent(id) + '&request=' + encodeURIComponent(kind),
    calendarURL: id => 'public.html?parish=' + encodeURIComponent(id) + '&view=calendar',
    /* The calendar feed of a parish, for calendars to subscribe to. ParishLife.Api has no public
       calendar feed (.ics) yet, so there is no address and the parish page leaves the offer out. */
    feedURL: () => '',
    /* A link to share: absolute, and in the language the visitor is reading. */
    shareURL: path =>
      new URL(path + (lang === 'ar' ? (path.includes('?') ? '&' : '?') + 'lang=ar' : ''), location.href).href,
    REQUESTS,
    OTHER_REQUESTS,
    parishPhotos,
    publishedDate(value) {
      const date = new Date(value?.length === 10 ? value + 'T12:00:00' : value);
      return Number.isNaN(date.valueOf())
        ? ''
        : new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB' : 'en', { dateStyle: 'medium' }).format(date);
    }
  };
}

/* Arabic counts agree with the number: one, two, three to ten, eleven and more. */
const PLURAL_AR = new Intl.PluralRules('ar');
const FORMS = {
  parish: {
    en: ['parish', 'parishes'],
    ar: { one: 'رعية', two: 'رعيتان', few: 'رعايا', many: 'رعية', other: 'رعية', zero: 'رعية' }
  },
  diocese: {
    en: ['diocese', 'dioceses'],
    ar: { one: 'أبرشية', two: 'أبرشيتان', few: 'أبرشيات', many: 'أبرشية', other: 'أبرشية', zero: 'أبرشية' }
  },
  celebration: {
    en: ['celebration this week', 'celebrations this week'],
    ar: {
      one: 'احتفال هذا الأسبوع',
      two: 'احتفالان هذا الأسبوع',
      few: 'احتفالات هذا الأسبوع',
      many: 'احتفالاً هذا الأسبوع',
      other: 'احتفال هذا الأسبوع',
      zero: 'احتفال هذا الأسبوع'
    }
  },
  town: {
    en: ['town or village', 'towns and villages'],
    ar: { one: 'بلدة', two: 'بلدتان', few: 'بلدات وقرى', many: 'بلدة وقرية', other: 'بلدة وقرية', zero: 'بلدة' }
  },
  upcoming: {
    en: ['event coming up', 'events coming up'],
    ar: {
      one: 'حدث قادم',
      two: 'حدثان قادمان',
      few: 'أحداث قادمة',
      many: 'حدثاً قادماً',
      other: 'حدث قادم',
      zero: 'حدث قادم'
    }
  },
  ministry: {
    en: ['ministry', 'ministries'],
    ar: { one: 'خدمة', two: 'خدمتان', few: 'خدمات', many: 'خدمة', other: 'خدمة', zero: 'خدمة' }
  },
  post: {
    en: ['announcement', 'announcements'],
    ar: { one: 'إعلان', two: 'إعلانان', few: 'إعلانات', many: 'إعلاناً', other: 'إعلان', zero: 'إعلان' }
  }
};
export const noun = (c, n, key) =>
  c.lang === 'ar' ? FORMS[key].ar[PLURAL_AR.select(n)] : FORMS[key].en[n === 1 ? 0 : 1];
/* "3 parishes" as a phrase: Arabic says "رعية واحدة", "رعيتان", "٣ رعايا". */
export function counted(c, n, key) {
  if (c.lang !== 'ar') return `${c.number(n)} ${noun(c, n, key)}`;
  const form = PLURAL_AR.select(n);
  if (form === 'one') return key === 'parish' ? 'رعية واحدة' : `${noun(c, n, key)} واحدة`;
  if (form === 'two') return noun(c, n, key);
  return `${c.number(n)} ${noun(c, n, key)}`;
}
export const digits = (c, text) =>
  c.lang === 'ar' ? String(text).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]) : String(text);

/* Diocese names are stored in English; the common forms read in Arabic. */
const SEES = {
  beirut: 'بيروت',
  byblos: 'جبيل',
  jbeil: 'جبيل',
  batroun: 'البترون',
  tripoli: 'طرابلس',
  zahle: 'زحلة',
  zahlé: 'زحلة',
  sidon: 'صيدا',
  saida: 'صيدا',
  tyre: 'صور',
  sour: 'صور',
  baalbek: 'بعلبك',
  jounieh: 'جونية',
  'mount lebanon': 'جبل لبنان',
  'the mountain': 'الجبل',
  akkar: 'عكار',
  jezzine: 'جزين',
  marjayoun: 'مرجعيون'
};
export function dioceseName(c, name) {
  if (c.lang !== 'ar' || !name) return name || '';
  const m = String(name).match(
    /^(?:(?:maronite|melkite|greek orthodox|syriac|armenian|latin)\s+)?(arch)?(?:eparchy|diocese|archdiocese)\s+of\s+(.+?)(?:\s+of the\s+(maronites|melkites))?$/i
  );
  if (!m) return name;
  const sees = m[2].split(/\s+and\s+/i).map(x => SEES[x.trim().toLowerCase()]);
  return sees.every(Boolean) ? 'أبرشية ' + sees.join(' و') : name;
}

/* The label for the liturgical year of the rite whose approved calendar was read. */
export function yearLabel(L, rite) {
  return /maronite|مارون/i.test(rite || '')
    ? L('In the Maronite year', 'في السنة الطقسية المارونية')
    : L('In the liturgical year', 'في السنة الطقسية');
}

/* Bilingual CMS text: the visitor's language, else the built-in wording in that language. */
export const words = (c, value, fallback) => value?.[c.lang]?.trim() || fallback?.[c.lang] || '';
/* CMS text without a default: the visitor's language, else the other one, marked as such. */
export function either(c, value) {
  const own = value?.[c.lang]?.trim();
  if (own) return { text: own, attrs: {} };
  const l = c.lang === 'ar' ? 'en' : 'ar',
    alt = value?.[l]?.trim();
  return alt ? { text: alt, attrs: { lang: l, dir: l === 'ar' ? 'rtl' : 'ltr' } } : null;
}
export const paragraphList = text =>
  String(text || '')
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);
export function Paragraphs({ text }) {
  return paragraphList(text).map((p, i) => (
    <p key={i}>
      <Lines text={p} />
    </p>
  ));
}
export const plain = html =>
  String(html || '')
    .replace(/<(br|\/p|\/li|\/h\d)\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
export const clip = (text, n) => (text.length > n ? text.slice(0, n).replace(/\s+\S*$/, '') + '…' : text);

/* A parish or story without a photograph gets a monogram in a stone arch: honest, never a borrowed picture. */
const PREFIX = /^(saint|st\.?|sts\.?|our lady of|notre[- ]dame( de)?|mar|mart|سيدة|القديس(ة)?|مار|مارت)\s+/i;
export function initialOf(name) {
  // the article goes (المخلّص → م), but not from names that begin with it (الياس → ا)
  const clean = String(name || '')
    .trim()
    .replace(PREFIX, '')
    .replace(/^ال(?!ي)/, '');
  return ([...clean][0] || [...String(name || '·')][0]).replace(/[&<>"']/g, '');
}
export function Monogram({ name }) {
  return (
    <span className="monogram" aria-hidden="true">
      <b>{initialOf(name)}</b>
    </span>
  );
}

/* With reduced motion (the system's, or Simple view) nothing glides. */
export const still = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.hasAttribute('data-simple');
