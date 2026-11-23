/* Purpose: the portal's shared view model, the collections the screens read and change in place.
   Main members: one export per collection (PEOPLE, GROUPS, EVENTS, SACRAMENTS, FUNDS, …), the empty shapes
   persist.js copies for a parish with no records (SERVICE, ROTA, CHECKIN, BATCH, REG_FORM, EVACUATION,
   PREP_REQUIREMENTS), and the lookups (person, venue, group, groupInfo, eventInfo, musicInfo, resClash).
   Every collection starts empty: persist.hydrate() fills it from ParishLife.Api (model/modules/) before
   any screen draws, and replaces it on every reload. Nothing here is demo data. */

export const TODAY = new Date(2026, 9, 4); // Sunday 4 October 2026
export const RATE = { value: 0, setOn: null, setBy: '' };
export const PARISH = { name: '', nameAr: '', town: '', townAr: '', rite: '', riteAr: '' };
export const PEOPLE = [];
export const ARCHIVED = [];
export const HOUSEHOLDS = [];
export const GROUPS = [];
export const VENUES = [];
export const EQUIPMENT = [];
export const RESERVATIONS = [];
/* Two requests clash when they want the same room on the same day and their times overlap,
   counting each one's set-up buffer. A pending request that clashes shows as a conflict. */
const mins = hm => {
  const [h, m] = String(hm).split(':').map(Number);
  return h * 60 + m;
};
export const resClash = r =>
  r.status === 'rejected'
    ? null
    : RESERVATIONS.find(
        o =>
          o !== r &&
          o.status !== 'rejected' &&
          o.venue === r.venue &&
          o.date === r.date &&
          mins(o.from) - (o.setup || 0) < mins(r.to) &&
          mins(r.from) - (r.setup || 0) < mins(o.to)
      );
export const resStatus = r => (r.status === 'pending' && resClash(r) ? 'conflict' : r.status);
export const EVENTS = [];
export const FEASTS = {};
export const SERVICE = {
  id: 's1',
  title: 'Sunday Mass 10:30',
  titleAr: 'قدّاس الأحد ١٠:٣٠',
  date: '2026-10-04',
  time: '10:30',
  venue: null,
  celebrant: null,
  coordinator: null,
  language: 'Arabic & Syriac',
  languageAr: 'عربي وسرياني',
  status: 'ready',
  order: []
};
export const SERVICE_PLANS = [];
export const SACRAMENTS = [];
export const ANNIVERSARIES = [];
export function anniversaryItems() {
  return [...ANNIVERSARIES].sort((a, b) => a.on.localeCompare(b.on));
}
export const ROTA = { date: '2026-10-04', service: 'Mass 10:30', serviceAr: 'قدّاس ١٠:٣٠', teams: [] };
export const CHECKIN = {
  session: 'Catechism — Sunday 09:15',
  sessionAr: 'التعليم المسيحي — الأحد ٠٩:١٥',
  room: null,
  present: 0,
  expected: 0,
  awaitingGuardian: 0,
  rows: [],
  sessions: {}
};
export const REGISTRATIONS = [];
export const BATCH = {
  id: 'cs214',
  ref: 'Counting session 214',
  refAr: 'جلسة العدّ ٢١٤',
  date: '2026-10-04',
  status: 'open',
  counters: [],
  lines: []
};
export const FUNDS = [];
export const EXPENSES = [];
export const PLEDGES = [];
export const MUSIC = [];
export const MESSAGES = [];
export const TEMPLATES = [];
export const WORKFLOWS = [];
export const AUDIT = [];
export const NOTICES = [];
export const byId = (arr, id) => arr.find(x => x.id === id);
export const person = id => PEOPLE.find(p => p.id === id) || ARCHIVED.find(p => p.id === id);
export const venue = id => VENUES.find(v => v.id === id);
export const group = id => GROUPS.find(g => g.id === id);
export const initials = p =>
  !p
    ? '·'
    : p.lat
        .split(/[\s-]+/)
        .filter(Boolean)
        .slice(-2)
        .map(s => s[0])
        .join('')
        .toUpperCase();
export const PARISHES = [];
export const EPARCHY_NEWS = [];
export const PERSON_EXTRA = {};
export const DUPLICATES = [];
export const GROUP_DETAIL = {};
/** A group's working detail; a group created in the app starts with an empty one rather than borrowing another's. */
export const groupInfo = id => {
  const detail =
    GROUP_DETAIL[id] ||
    (GROUP_DETAIL[id] = {
      assistant: null,
      roles: [],
      requests: [],
      meetings: [],
      posts: [],
      files: [],
      belongings: [],
      resourceLoans: [],
      tasks: [],
      milestones: [],
      history: [],
      roster: [],
      budget: { fund: 'general', allocated: 0, spent: 0 }
    });
  detail.belongings = (detail.belongings || []).map((item, index) =>
    Array.isArray(item)
      ? {
          id: `resource-${id}-${index + 1}`,
          name: item[0],
          ar: item[1],
          qty: item[2],
          location: item[3],
          locationAr: item[4]
        }
      : item
  );
  detail.resourceLoans ||= [];
  detail.automations ||= [];
  detail.messagingRules ||= [];
  detail.milestones = (detail.milestones || []).map((item, index) =>
    Array.isArray(item)
      ? {
          id: `formation-${id}-${index + 1}`,
          name: item[0],
          ar: item[1],
          description: '',
          legacyCount: item[2],
          completions: {}
        }
      : item
  );
  detail.milestones.forEach(item => {
    item.completions ||= {};
    item.legacyCount ||= 0;
  });
  return detail;
};
export const EVENT_DETAIL = {};
/** An event's working detail; one created in the app gets its own, empty, instead of borrowing the parish lunch's. */
export const eventInfo = e =>
  EVENT_DETAIL[e.id] || {
    organizer: null,
    tz: 'Asia/Beirut',
    cat: '',
    catAr: '',
    tags: [],
    desc: '',
    descAr: '',
    bring: [],
    tasks: [],
    files: [],
    rsvp: { yes: 0, no: 0, maybe: 0, none: 0 },
    cap: 0,
    waiting: 0,
    repeat: 'none',
    invited: [],
    visibility: 'public',
    visibleGroupIds: [],
    priestIds: [],
    participants: [],
    subtype: ''
  };
export const EVENT_TEMPLATES = [];
export const MAINTENANCE = [];
export const ISSUES = [];
export const RENTALS = [];
export const SERVICE_REQUESTS = [];
export const SERVICE_TEMPLATES = [];
export const PREP_REQUIREMENTS = {
  baptism: [
    ['Parents’ marriage certificate', 'إفادة زواج الوالدين', true],
    ['Godparent baptism certificate', 'إفادة معمودية الإشبين', false],
    ['Preparation session attended', 'حضور لقاء التحضير', true]
  ],
  marriage: [
    ['Baptism certificates, both', 'إفادتا معمودية', true],
    ['Freedom-to-marry declaration', 'إفادة عزوبية', true],
    ['Pre-marriage course', 'دورة ما قبل الزواج', true],
    ['Civil file reference', 'رقم الملف المدني', false]
  ]
};
export const VOLUNTEERS = [];
export const SIGNUP_SHEETS = [];
export const REG_FORM = {
  id: 'rg1',
  title: 'Youth retreat — Annaya',
  titleAr: 'خلوة الشبيبة — عنّايا',
  fields: [],
  fee: 35,
  discounts: [],
  installments: []
};
export const REGISTRANTS = [];
export const REFUNDS = [];
export const PICKUP = {};
export const EVACUATION = { rooms: [], muster: 'Courtyard, by the gate', musterAr: 'الساحة، عند البوابة' };
export const AUTOMATIONS = [];
export const CAMPAIGNS = [];
export const RECURRING = [];
export const CONTRIBUTIONS = [];
export const RATES = [];
export const BUDGETS = [];
export const COUNT_SESSIONS = [];
export const RECEIPTS = [];
export const BANKLINES = [];
export const MUSIC_DETAIL = {};
/** A hymn's working detail; one added in the app starts empty rather than borrowing another hymn's words. */
export const musicInfo = m =>
  MUSIC_DETAIL[m.id] ||
  (MUSIC_DETAIL[m.id] = {
    composer: '',
    composerAr: '',
    copyright: 'Not recorded',
    copyrightAr: 'غير مسجَّل',
    uses: ['Project'],
    versions: [],
    lyrics: [],
    chords: '',
    notes: [],
    annotations: []
  });
export const SETLISTS = [];
export const PRAYERS = [];
export const RUNS = [];
export const RUN_LOG = [];
export const ATTENDANCE_SERIES = [];
export const GIVING_SERIES = [];
export const PAYMENT_MIX = [];
export const SESSIONS = [];
export const SECURITY_ALERTS = [];
export const RETENTION = [];
export const WEBHOOKS = [];
export const PERMISSIONS = [];
export const PORTAL_REQUESTS = [];
export const REQUEST_HISTORY = [];
export const MEMBER_REQUESTS = [];
export const MY_REQUESTS = [];
export const ACCOUNTS = {};
export const PHOTOS = {};
export const FORM_FIELDS = [];
export const FORM_RULES = [];
export const EXCEPTIONS = [];
export const NOTIFICATIONS = [];
export const PREFS = {};
export const NOTES = [];
export const CONTENT = {};
export const OFFICE_LEDGER = [];
