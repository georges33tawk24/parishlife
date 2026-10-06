/* Session state and role metadata. Kept out of app.js so views can read the
   current role without importing the router back (and creating a cycle). */
import { person } from './data.js';
import { session } from './api.js';
import { M } from './member-data.js';

const load = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
export const save = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export const S = {
  role: 'priest',
  collapsed: load('pl-rail', '0') === '1',
  offline: false,
  route: 'dashboard',
  params: [],
  ui: { peoplePage: 0, calOffset: 0, reorder: false, player: null }
};

const H = (en, ar) => ['h', en, ar];
const L = id => ['l', id];

export const ROLES = {
  member: {
    en:'Ministry member', ar:'عضو خدمة', who:null,
    noteEn:'Your ministries, meetings and personal parish life.',
    noteAr:'خدماتك واجتماعاتك وحياتك الرعوية.',
    nav:[L('memberhome'), L('myministries'), L('mymeetings'), L('mycalendar'), L('myattendance'),
      L('mymessages'), L('myfeed'), L('myresources'), L('mycommitments'), L('mynotes'),
      L('myprofile'), L('myconcerns'), L('membernotifications')]
  },
  bishop: {
    en:'Bishop', ar:'المطران', who:null,
    noteEn:'Read-only oversight of parishes and their activities.',
    noteAr:'إشراف للقراءة فقط على الرعايا وأنشطتها.',
    nav:[L('oversight'), H('Eparchy','الأبرشية'), L('bishopeparchy'), L('bishopmap'), L('assignments')]
  },
  priest: {
    en:'Parish priest', ar:'كاهن الرعية', who:'p17',
    noteEn:'Access to assigned parishes, including pastoral notes and certificate approval.',
    noteAr:'صلاحية للرعايا المعيّنة، بما فيها الملاحظات الرعوية واعتماد الشهادات.',
    nav:[L('dashboard'),
      H('Records','السجلات'), L('people'), L('households'), L('sacraments'), L('requests'), L('notes'),
      H('Parish life','حياة الرعية'), L('calendar'), L('services'), L('groups'), L('volunteers'), L('registrations'), L('checkin'),
      H('Spaces','المرافق'), L('facilities'), L('reservations'),
      H('Communicate','التواصل'), L('messaging'), L('notices'), L('music'), L('portal'), L('memberhub'),
      H('Money','المال'), L('giving'), L('finance'),
      H('Administration','الإدارة'), L('forms'), L('reports'), L('audit'), L('settings'), L('styleguide')]
  },
  secretary: {
    en:'Secretary', ar:'أمينة السرّ', who:'p4',
    noteEn:'People, records, events and messaging. Giving and finance do not appear in the rail.',
    noteAr:'المؤمنون والسجلات والأحداث والمراسلة. التقدمات والمالية غائبة كلياً عن الشريط — الإخفاء أفضل من الإطفاء.',
    nav:[L('dashboard'),
      H('Records','السجلات'), L('people'), L('households'), L('sacraments'), L('requests'),
      H('Parish life','حياة الرعية'), L('calendar'), L('services'), L('groups'), L('volunteers'), L('registrations'), L('checkin'),
      H('Spaces','المرافق'), L('facilities'), L('reservations'),
      H('Communicate','التواصل'), L('messaging'), L('notices'), L('portal'), L('memberhub'),
      H('Administration','الإدارة'), L('forms'), L('reports')]
  },
  treasurer: {
    en:'Treasurer', ar:'أمين الصندوق', who:'p15',
    noteEn:'Money only. Sees amounts and envelope numbers but never pastoral notes, and is the one who edits the parish rate.',
    noteAr:'المال فقط. يرى المبالغ وأرقام المظاريف لا الملاحظات الرعوية، وهو من يعدّل سعر الرعية.',
    nav:[L('dashboard'),
      H('Money','المال'), L('giving'), L('finance'),
      H('Records','السجلات'), L('people'), L('households'),
      H('Administration','الإدارة'), L('reports'), L('settings')]
  },
  leader: {
    en:'Ministry leader', ar:'مسؤولة خدمة', who:'p3',
    noteEn:'Scoped to the groups she leads. Every list opens already filtered to her people — the parish list, giving and other groups are not in the rail.',
    noteAr:'محصورة بالمجموعات التي تقودها. كل لائحة تفتح مرشّحة على أفرادها — لائحة الرعية والتقدمات والمجموعات الأخرى ليست في الشريط.',
    nav:[L('dashboard'),
      H('My ministry','خدمتي'), L('groups'), L('attendance'), L('volunteers'), L('checkin'), L('music'),
      H('Parish life','حياة الرعية'), L('calendar'), L('services'),
      H('Communicate','التواصل'), L('messaging'), L('memberhub')]
  }
};

export const MOBILE_NAV = {
  member:    ['memberhome','mymeetings','mymessages','mycalendar','myprofile'],
  bishop: ['oversight','bishopmap','bishopeparchy'],
  priest:    ['dashboard','people','calendar','giving'],
  secretary: ['dashboard','people','calendar','messaging'],
  treasurer: ['dashboard','giving','finance','reports'],
  leader:    ['dashboard','groups','calendar','messaging']
};

export const role = () => S.role === 'member'
  ? { ...ROLES.member, nav:[...ROLES.member.nav,
      ...(M.formation.length ? [L('myformation')] : []),
      ...(M.complaintPermissions.some(x=>['Review','ManageCategories'].includes(x)) ? [L('memberhub')] : [])] }
  : ROLES[S.role] || ROLES.priest;
export const me = () => person(session.user?.person_id || role().who) || { id: session.user?.id, lat: session.user?.name || 'User', ar: session.user?.name || 'User', tags: [] };
export const is = (...roles) => roles.includes(S.role);
export const canSee = id => role().nav.some(n => n[0] === 'l' && n[1] === id);
export const go = h => { location.hash = h.startsWith('#') ? h : '#/' + h; };

/* Set by app.js once the router exists. Actions call bus.refresh() after they
   mutate the parish, so a workflow shows its own result immediately. */
export const bus = { refresh: () => {} };
