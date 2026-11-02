/* Every screen of the portal, the module it belongs to, and who may open it. */
import { useLayoutEffect } from 'react';
import { num } from '../../lib/i18n.js';
import * as D from '../model/data.js';
import { S, canSee } from '../model/store.js';
import { session } from '../model/api.js';

import { MembershipReviews } from '../views/membership-reviews.jsx';
import { ProfileReviews } from '../views/profile-reviews.jsx';
import { GuestRequests } from '../views/guest-requests.jsx';
import { ActivityPage } from '../views/activity.jsx';
import * as Dashboard from '../views/dashboard.jsx';
import * as People from '../views/people.jsx';
import * as Records from '../views/records.jsx';
import * as Pastoral from '../views/notes.jsx';
import * as Parish from '../views/parish.jsx';
import * as Spaces from '../views/spaces.jsx';
import * as Money from '../views/money.jsx';
import { officeExpenses } from '../views/office-expenses.jsx';
import * as Comms from '../views/comms.jsx';
import * as Admin from '../views/admin.jsx';
import * as Oversight from '../views/oversight.jsx';
import * as Member from '../views/member.jsx';
import { requestsPage } from '../views/member-requests.jsx';
import { AccountPage } from '../views/account.jsx';
import { MinistryRequests } from '../views/ministry-requests.jsx';
import { InboxPage } from '../views/inbox.jsx';
import { WorkspacePage } from '../views/workspace.jsx';
import { InsightsPage } from '../views/insights.jsx';

/* A screen draws from the parish data and the route's parameters; what it wires once drawn (its
   own forms and lists) runs after it is on the page. */
const screens = new Map();
function screen(render) {
  if (screens.has(render)) return screens.get(render);
  function Screen({ params }) {
    useLayoutEffect(() => {
      if (!render.mount) return;
      const host = document.getElementById('view');
      queueMicrotask(() => { if (host?.isConnected) render.mount(host, ...params); });   // once React has finished drawing it
    }, []);
    return render(...params);
  }
  Screen.displayName = render.name || 'Screen';
  screens.set(render, Screen);
  return Screen;
}
/* A screen written as a component is used as it is (named here: a built file renames functions). */
const COMPONENTS = new Set([MembershipReviews, ProfileReviews, GuestRequests, ActivityPage, MinistryRequests, InboxPage, WorkspacePage, InsightsPage, AccountPage,
  Oversight.Oversight, Oversight.Eparchy, Oversight.MapView]);
const R = (ico, en, ar, view, more = {}) => ({ ico, en, ar, view: COMPONENTS.has(view) ? view : screen(view), ...more });

export const ROUTES = {
  membershipreviews: R('people', 'Parish membership requests', 'طلبات عضوية الرعية', MembershipReviews),
  profilereviews: R('people', 'Profile corrections', 'تصحيحات الملفات', ProfileReviews),
  guestrequests: R('doc', 'Guest requests', 'طلبات الزوّار', GuestRequests),
  activity: R('home', 'My parish life', 'حياتي الرعوية', ActivityPage),
  ministryrequests: R('groups', 'Ministry membership', 'عضوية الخدمات', MinistryRequests),
  inbox: R('msg', 'Inbox', 'البريد', InboxPage),
  workspace: R('shield', 'Administration', 'الإدارة', WorkspacePage),
  insights: R('reports', 'Insights', 'المؤشرات', InsightsPage),
  account: R('settings', 'My account', 'حسابي', AccountPage),
  memberhome: R('dash', 'Home', 'الرئيسية', Member.home),
  myrequests: R('sacr', 'My requests', 'طلباتي', requestsPage, { mEn: 'Requests', mAr: 'طلباتي' }),
  myministries: R('groups', 'My Ministries', 'خدماتي', Member.ministries),
  mymeetings: R('events', 'Meetings', 'الاجتماعات', Member.meetings),
  mycalendar: R('events', 'Calendar', 'الرزنامة', Member.calendar),
  myattendance: R('attend', 'Attendance', 'الحضور', Member.attendancePage),
  mymessages: R('msg', 'Messages', 'الرسائل', InboxPage),
  myfeed: R('bell', 'Announcements & Posts', 'الإعلانات والمنشورات', Member.feed),
  myresources: R('doc', 'Resources', 'الموارد', Member.resources),
  myformation: R('doc', 'Formation', 'التنشئة', Member.formation),
  mycommitments: R('vol', 'My Commitments', 'التزاماتي', Member.commitments),
  mynotes: R('notes', 'My Notes', 'ملاحظاتي', Member.notes),
  myprofile: R('people', 'My Profile', 'ملفي', Member.profile),
  myconcerns: R('shield', 'Submit a Concern', 'تقديم ملاحظة', Member.concerns),
  membernotifications: R('bell', 'Notifications', 'الإشعارات', Member.notificationsPage),
  memberhub: R('msg', 'Member communication', 'التواصل مع الأعضاء', Member.hub),
  oversight: R('portal', 'Parish oversight', 'الإشراف على الرعايا', Oversight.Oversight),
  bishopeparchy: R('portal', 'Eparchy', 'الأبرشية', Oversight.Eparchy),
  bishopmap: R('events', 'Parish map', 'خريطة الرعايا', Oversight.MapView),
  dashboard: R('dash', 'Dashboard', 'لوحة القيادة', Dashboard.dashboard),
  people: R('people', 'People', 'المؤمنون', People.people, { badge: () => num(D.PEOPLE.length) }),
  person: R('people', 'Person', 'سجلّ شخص', People.personView, { hidden: true }),
  households: R('family', 'Households', 'العائلات', People.households, { badge: () => D.HOUSEHOLDS.length }),
  sacraments: R('sacr', 'Sacraments', 'الأسرار', Records.sacraments, { badge: () => D.SACRAMENTS.filter(x => x.kind !== 'certificate' && ['preparing', 'scheduled', 'draft'].includes(x.status)).length }),
  requests: R('doc', 'Requests', 'الطلبات', Records.requests, { badge: () => D.SACRAMENTS.filter(x => x.kind === 'certificate'
      ? ['draft', 'awaiting-signature', 'approved'].includes(x.status)
      : ['requested', 'office-reviewed', 'awaiting-signature'].includes(x.status)).length
      + D.RESERVATIONS.filter(x => x.status === 'pending').length
      + D.SERVICE_REQUESTS.filter(x => ['pending', 'awaiting-approval'].includes(x.status)).length
      + D.PORTAL_REQUESTS.length + D.REGISTRATIONS.filter(x => x.waiting > 0).length
      + D.MEMBER_REQUESTS.filter(x => x.status === 'submitted').length }),
  certificate: R('doc', 'Record', 'قيد', Records.certificate, { hidden: true }),
  notes: R('notes', 'Notes & Tasks', 'الملاحظات والمهام', Pastoral.notes),

  calendar: R('events', 'Calendar', 'الرزنامة', Parish.calendar),
  services: R('service', 'Services & Activities', 'الخدمات والأنشطة', Parish.services),
  groups: R('groups', 'Groups', 'المجموعات', Parish.groups, { badge: () => D.GROUPS.length }),
  attendance: R('attend', 'Attendance', 'الحضور', Parish.ministryAttendance),
  volunteers: R('vol', 'Volunteers', 'المتطوّعون', Parish.volunteers, { badge: () => S.role === 'leader'
      ? new Set(D.GROUPS.flatMap(g => D.groupInfo(g.id).roster.map(r => r.p))).size
      : D.ROTA.teams.flatMap(x => x.filled).filter(f => !f.p || f.s === 'declined').length }),
  registrations: R('registr', 'Registrations & Payments', 'التسجيلات والدفعات', Parish.registrations),
  checkin: R('checkin', 'Check-in', 'التسجيل عند الباب', Parish.checkin),

  facilities: R('rooms', 'Facilities', 'المرافق', Spaces.facilities),
  reservations: R('attend', 'Reservations', 'الحجوزات', Spaces.reservations, { badge: () => D.RESERVATIONS.filter(r => r.status === 'pending').length }),

  messaging: R('msg', 'Messaging', 'المراسلة', Comms.messaging, { badge: () => D.MESSAGES.filter(m => m.status === 'failed').length }),
  notices: R('bell', 'Notices', 'الإعلانات', Comms.notices),
  music: R('music', 'Music library', 'مكتبة الألحان', Comms.music),
  portal: R('portal', 'Member portal', 'بوّابة المؤمنين', Comms.portal),

  giving: R('give', 'Giving', 'التقدمات', Money.giving, { badge: () => D.BATCH.status === 'open' ? 1 : 0 }),
  finance: R('fin', 'Finance', 'المالية', Money.finance),
  officeexpenses: R('fin', 'Office Expenses', 'مصاريف المكتب', officeExpenses),

  forms: R('forms', 'Forms & workflows', 'الاستمارات والمسارات', Admin.forms),
  reports: R('reports', 'Reports', 'التقارير', Admin.reports),
  audit: R('shield', 'Audit trail', 'سجل التدقيق', Admin.audit),
  settings: R('settings', 'Settings', 'الإعدادات', Admin.settings),
  eparchy: R('portal', 'Eparchy', 'الأبرشية', Admin.eparchy),
  assignments: R('shield', 'Priest assignments', 'تعيينات الكهنة', WorkspacePage),
  household: R('family', 'Household', 'العائلة', People.householdView, { hidden: true }),
  styleguide: R('doc', 'Design system', 'نظام التصميم', Admin.styleguide)
};

/* Detail views (a person, a certificate, the design system) are reachable from whatever module
   linked to them, so they ride on their parent's permission. */
const DETAIL_PARENT = { assignments: 'workspace', membershipreviews: 'requests', profilereviews: 'requests', guestrequests: 'requests', person: 'people', household: 'households', certificate: 'sacraments' };
const PERSONAL_ROUTES = new Set(['memberhome', 'myrequests', 'myministries', 'mymeetings', 'mycalendar', 'myattendance',
  'mymessages', 'myfeed', 'myresources', 'myformation', 'mycommitments', 'mynotes', 'myprofile',
  'myconcerns', 'membernotifications']);
export const MEMBER_ROUTES = new Set([...PERSONAL_ROUTES, 'memberhub']);
export const allowed = id => id === 'account' || canSee(id) || !!(DETAIL_PARENT[id] && canSee(DETAIL_PARENT[id])) ||
  (PERSONAL_ROUTES.has(id) && !['bishop', 'secretary'].includes(S.role) && !!session.user?.person_id);
