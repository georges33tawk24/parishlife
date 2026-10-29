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
  finance_view: { en:'Finance viewer',ar:'مشاهد المالية',who:null,nav:[L('giving'),L('finance')] },
  super_admin: { en:'Super Admin',ar:'المشرف العام',who:null,nav:[L('workspace'),L('people'),L('households'),L('calendar'),L('groups'),L('finance'),L('settings')] },
  diocesan_admin: { en:'Archdiocese Admin',ar:'مدير الأبرشية',who:null,nav:[L('workspace'),L('people'),L('households'),L('calendar'),L('groups'),L('settings')] },
  parish_admin: { en:'Parish Admin',ar:'مدير الرعية',who:null,nav:[L('workspace'),L('people'),L('households'),L('calendar'),L('groups'),L('settings')] },
  member: {
    en:'User', ar:'مستخدم', who:null,
    noteEn:'Your ministries, meetings and personal parish life.',
    noteAr:'خدماتك واجتماعاتك وحياتك الرعوية.',
    nav:[L('memberhome'), L('myrequests'), L('myministries'), L('mymeetings'), L('mycalendar'), L('myattendance'),
      L('mymessages'), L('myfeed'), L('myresources'), L('mycommitments'), L('mynotes'),
      L('myprofile'), L('myconcerns'), L('membernotifications')]
  },
  bishop: {
    en:'Bishop', ar:'المطران', who:null,
    noteEn:'Manage the parishes and appointments in your diocese.',
    noteAr:'إدارة رعايا أبرشيتك وتعييناتها.',
    nav:[L('oversight'), H('Eparchy','الأبرشية'), L('bishopeparchy'), L('bishopmap')]
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
      H('Money','المال'), L('giving'), L('finance'), L('officeexpenses'),
      H('Administration','الإدارة'), L('forms'), L('reports'), L('audit'), L('settings'), L('styleguide')]
  },
  secretary: {
    en:'Secretary', ar:'أمينة السرّ', who:'p4',
    noteEn:'Parish records, activities, members and office expenses.',
    noteAr:'سجلات الرعية والأنشطة والأعضاء ومصاريف المكتب.',
    nav:[L('dashboard'),
      H('Records','السجلات'), L('people'), L('households'), L('sacraments'), L('requests'),
      H('Parish life','حياة الرعية'), L('calendar'), L('services'), L('groups'), L('volunteers'), L('registrations'), L('checkin'),
      H('Spaces','المرافق'), L('facilities'), L('reservations'),
      H('Office','المكتب'), L('officeexpenses')]
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
  super_admin: ['workspace','dashboard','people','calendar','settings'],
  diocesan_admin: ['workspace','dashboard','people','calendar','settings'],
  parish_admin: ['workspace','dashboard','people','calendar','settings'],
  member:    ['memberhome','myrequests','mymessages','mycalendar','myprofile'],
  bishop: ['oversight','bishopmap','bishopeparchy'],
  priest:    ['dashboard','people','calendar','giving'],
  secretary: ['dashboard','people','calendar','officeexpenses'],
  treasurer: ['dashboard','giving','finance','reports'],
  leader:    ['dashboard','groups','calendar','messaging']
};

export const role = () => {
  const base=ROLES[S.role]||{en:'Administrator',ar:'مدير',who:null,nav:[]};
  let nav=[...base.nav];
  if(['super_admin','diocesan_admin','parish_admin'].includes(S.role))nav=[L('workspace'),...ROLES.priest.nav.filter(n=>n[0]==='l'&&!['notes','styleguide','workspace','memberhub'].includes(n[1]))];
  // Insights and the parish CRM belong to the platform's Super Admin, whichever parish is open.
  if((S.role==='super_admin'||session.accountUser?.role==='super_admin')&&!nav.some(n=>n[1]==='insights'))nav.unshift(L('insights'));
  if(S.role==='bishop')nav.push(L('activity'),L('sacraments'),L('people'),L('households'),L('requests'),L('calendar'),L('groups'),L('giving'),L('finance'));
  if(S.role==='member'){
    if(!session.user?.person_id)nav=[];
    else{
      if(M.formation.length)nav.push(L('myformation'));
      if(M.complaintPermissions.some(x=>['Review','ManageCategories'].includes(x)))nav.push(L('memberhub'));
    }
  }
  if(S.role==='member')nav.unshift(L('activity'));
  if(['bishop','priest'].includes(S.role)||(session.user?.platformRole==='diocesan_admin'))nav.push(L('workspace'));
  if(S.role!=='member'||!session.user?.person_id)nav.push(L('inbox'));
  if(['member','leader','priest'].includes(S.role))nav.push(L('ministryrequests'));
  if(session.user?.canViewFinance)for(const id of ['giving','finance'])if(!nav.some(n=>n[0]==='l'&&n[1]===id))nav.push(L(id));
  if((session.user?.roles||[]).includes('priest')&&!nav.some(item=>item[0]==='l'&&item[1]==='notes'))nav.push(L('notes'));
  if((session.user?.roles||[]).includes('treasurer')&&!nav.some(item=>item[0]==='l'&&item[1]==='settings'))nav.push(L('settings'));
  nav.push(L('account'));
  if(!session.parishId)nav=nav.filter(item=>item[0]==='l'&&['workspace','activity','inbox','account'].includes(item[1]));
  return {...base,nav};
};
export const me = () => person(session.user?.person_id) || { id: session.user?.id, lat: session.user?.name || 'User', ar: session.user?.name || 'User', tags: [] };
export const is = (...roles) => roles.includes(S.role)
  || roles.includes('priest') && (session.user?.roles||[]).includes('priest')
  || roles.includes('treasurer') && (session.user?.roles||[]).includes('treasurer')
  || roles.includes('priest') && roles.includes('secretary') && ['super_admin','bishop','diocesan_admin','parish_admin'].includes(S.role);
export const canSee = id => role().nav.some(n => n[0] === 'l' && n[1] === id);
export const go = h => { location.hash = h.startsWith('#') ? h : '#/' + h; };

/* Set by app.js once the router exists. Actions call bus.refresh() after they
   mutate the parish, so a workflow shows its own result immediately. */
export const bus = { refresh: () => {} };
