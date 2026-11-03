/* Every screen of the portal, the module it belongs to, and who may open it. */
import { useLayoutEffect } from 'react';
import { num } from '../../lib/i18n.js';
import * as D from '../model/data.js';
import { S, canSee } from '../model/store.js';
import { session } from '../model/api.js';

// Records
import { dashboard } from '../features/dashboard/dashboard.jsx';
import { people } from '../features/records/people.jsx';
import { personView } from '../features/records/person.jsx';
import { households, householdView } from '../features/records/households.jsx';
import { sacraments } from '../features/records/sacraments.jsx';
import { requests } from '../features/records/requests.jsx';
import { certificate } from '../features/records/certificate.jsx';
import { MembershipReviews } from '../features/records/membership-reviews.jsx';
import { ProfileReviews } from '../features/records/profile-reviews.jsx';
import { GuestRequests } from '../features/records/guest-requests.jsx';
import { notes } from '../features/records/notes.jsx';
// Parish life
import { calendar } from '../features/parish-life/calendar.jsx';
import { services } from '../features/parish-life/services.jsx';
import { groups } from '../features/parish-life/groups.jsx';
import { ministryAttendance } from '../features/parish-life/attendance.jsx';
import { MinistryRequests } from '../features/parish-life/ministry-requests.jsx';
import { volunteers } from '../features/parish-life/volunteers.jsx';
import { registrations } from '../features/parish-life/registrations.jsx';
import { checkin } from '../features/parish-life/checkin.jsx';
// Spaces
import { facilities } from '../features/spaces/facilities.jsx';
import { reservations } from '../features/spaces/reservations.jsx';
// Communicate
import { messaging } from '../features/communicate/messaging.jsx';
import { InboxPage } from '../features/communicate/inbox.jsx';
import { notices } from '../features/communicate/notices.jsx';
import { music } from '../features/communicate/music.jsx';
import { portal } from '../features/communicate/website.jsx';
// Money
import { giving } from '../features/money/giving.jsx';
import { finance } from '../features/money/finance.jsx';
import { officeExpenses } from '../features/money/office-expenses.jsx';
// Administration
import { forms } from '../features/administration/forms.jsx';
import { reports } from '../features/administration/reports.jsx';
import { audit } from '../features/administration/audit.jsx';
import { settings } from '../features/administration/settings.jsx';
import { eparchy } from '../features/administration/eparchy.jsx';
import { styleguide } from '../features/administration/styleguide.jsx';
import { WorkspacePage } from '../features/administration/workspace.jsx';
import { InsightsPage } from '../features/administration/insights.jsx';
// The bishop's oversight
import { Oversight, Eparchy as BishopEparchy, MapView } from '../features/oversight/oversight.jsx';
// A member's own pages, and everyone's account
import {
  attendancePage as memberAttendance,
  calendar as memberCalendar,
  commitments as memberCommitments,
  concerns as memberConcerns,
  feed as memberFeed,
  formation as memberFormation,
  home as memberHome,
  hub as memberHub,
  meetings as memberMeetings,
  ministries as memberMinistries,
  notes as memberNotes,
  notificationsPage as memberNotifications,
  profile as memberProfile,
  resources as memberResources
} from '../features/member/pages.jsx';
import { requestsPage } from '../features/member/requests.jsx';
import { ActivityPage } from '../features/member/activity.jsx';
import { AccountPage } from '../features/account/account.jsx';

/* A screen draws from the parish data and the route's parameters; what it wires once drawn (its
   own forms and lists) runs after it is on the page. */
const screens = new Map();
function screen(render) {
  if (screens.has(render)) return screens.get(render);
  function Screen({ params }) {
    useLayoutEffect(() => {
      if (!render.mount) return;
      const host = document.getElementById('view');
      queueMicrotask(() => {
        if (host?.isConnected) render.mount(host, ...params);
      }); // once React has finished drawing it
    }, []);
    return render(...params);
  }
  Screen.displayName = render.name || 'Screen';
  screens.set(render, Screen);
  return Screen;
}
/* A screen written as a component is used as it is (named here: a built file renames functions). */
const COMPONENTS = new Set([
  MembershipReviews,
  ProfileReviews,
  GuestRequests,
  ActivityPage,
  MinistryRequests,
  InboxPage,
  WorkspacePage,
  InsightsPage,
  AccountPage,
  Oversight,
  BishopEparchy,
  MapView
]);
const R = (ico, en, ar, view, more = {}) => ({
  ico,
  en,
  ar,
  view: COMPONENTS.has(view) ? view : screen(view),
  ...more
});

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
  memberhome: R('dash', 'Home', 'الرئيسية', memberHome),
  myrequests: R('sacr', 'My requests', 'طلباتي', requestsPage, { mEn: 'Requests', mAr: 'طلباتي' }),
  myministries: R('groups', 'My Ministries', 'خدماتي', memberMinistries),
  mymeetings: R('events', 'Meetings', 'الاجتماعات', memberMeetings),
  mycalendar: R('events', 'Calendar', 'الرزنامة', memberCalendar),
  myattendance: R('attend', 'Attendance', 'الحضور', memberAttendance),
  mymessages: R('msg', 'Messages', 'الرسائل', InboxPage),
  myfeed: R('bell', 'Announcements & Posts', 'الإعلانات والمنشورات', memberFeed),
  myresources: R('doc', 'Resources', 'الموارد', memberResources),
  myformation: R('doc', 'Formation', 'التنشئة', memberFormation),
  mycommitments: R('vol', 'My Commitments', 'التزاماتي', memberCommitments),
  mynotes: R('notes', 'My Notes', 'ملاحظاتي', memberNotes),
  myprofile: R('people', 'My Profile', 'ملفي', memberProfile),
  myconcerns: R('shield', 'Submit a Concern', 'تقديم ملاحظة', memberConcerns),
  membernotifications: R('bell', 'Notifications', 'الإشعارات', memberNotifications),
  memberhub: R('msg', 'Member communication', 'التواصل مع الأعضاء', memberHub),
  oversight: R('portal', 'Parish oversight', 'الإشراف على الرعايا', Oversight),
  bishopeparchy: R('portal', 'Eparchy', 'الأبرشية', BishopEparchy),
  bishopmap: R('events', 'Parish map', 'خريطة الرعايا', MapView),
  dashboard: R('dash', 'Dashboard', 'لوحة القيادة', dashboard),
  people: R('people', 'People', 'المؤمنون', people, { badge: () => num(D.PEOPLE.length) }),
  person: R('people', 'Person', 'سجلّ شخص', personView, { hidden: true }),
  households: R('family', 'Households', 'العائلات', households, { badge: () => D.HOUSEHOLDS.length }),
  sacraments: R('sacr', 'Sacraments', 'الأسرار', sacraments, {
    badge: () =>
      D.SACRAMENTS.filter(x => x.kind !== 'certificate' && ['preparing', 'scheduled', 'draft'].includes(x.status))
        .length
  }),
  requests: R('doc', 'Requests', 'الطلبات', requests, {
    badge: () =>
      D.SACRAMENTS.filter(x =>
        x.kind === 'certificate'
          ? ['draft', 'awaiting-signature', 'approved'].includes(x.status)
          : ['requested', 'office-reviewed', 'awaiting-signature'].includes(x.status)
      ).length +
      D.RESERVATIONS.filter(x => x.status === 'pending').length +
      D.SERVICE_REQUESTS.filter(x => ['pending', 'awaiting-approval'].includes(x.status)).length +
      D.PORTAL_REQUESTS.length +
      D.REGISTRATIONS.filter(x => x.waiting > 0).length +
      D.MEMBER_REQUESTS.filter(x => x.status === 'submitted').length
  }),
  certificate: R('doc', 'Record', 'قيد', certificate, { hidden: true }),
  notes: R('notes', 'Notes & Tasks', 'الملاحظات والمهام', notes),

  calendar: R('events', 'Calendar', 'الرزنامة', calendar),
  services: R('service', 'Services & Activities', 'الخدمات والأنشطة', services),
  groups: R('groups', 'Groups', 'المجموعات', groups, { badge: () => D.GROUPS.length }),
  attendance: R('attend', 'Attendance', 'الحضور', ministryAttendance),
  volunteers: R('vol', 'Volunteers', 'المتطوّعون', volunteers, {
    badge: () =>
      S.role === 'leader'
        ? new Set(D.GROUPS.flatMap(g => D.groupInfo(g.id).roster.map(r => r.p))).size
        : D.ROTA.teams.flatMap(x => x.filled).filter(f => !f.p || f.s === 'declined').length
  }),
  registrations: R('registr', 'Registrations & Payments', 'التسجيلات والدفعات', registrations),
  checkin: R('checkin', 'Check-in', 'التسجيل عند الباب', checkin),

  facilities: R('rooms', 'Facilities', 'المرافق', facilities),
  reservations: R('attend', 'Reservations', 'الحجوزات', reservations, {
    badge: () => D.RESERVATIONS.filter(r => r.status === 'pending').length
  }),

  messaging: R('msg', 'Messaging', 'المراسلة', messaging, {
    badge: () => D.MESSAGES.filter(m => m.status === 'failed').length
  }),
  notices: R('bell', 'Notices', 'الإعلانات', notices),
  music: R('music', 'Music library', 'مكتبة الألحان', music),
  portal: R('portal', 'Member portal', 'بوّابة المؤمنين', portal),

  giving: R('give', 'Giving', 'التقدمات', giving, { badge: () => (D.BATCH.status === 'open' ? 1 : 0) }),
  finance: R('fin', 'Finance', 'المالية', finance),
  officeexpenses: R('fin', 'Office Expenses', 'مصاريف المكتب', officeExpenses),

  forms: R('forms', 'Forms & workflows', 'الاستمارات والمسارات', forms),
  reports: R('reports', 'Reports', 'التقارير', reports),
  audit: R('shield', 'Audit trail', 'سجل التدقيق', audit),
  settings: R('settings', 'Settings', 'الإعدادات', settings),
  eparchy: R('portal', 'Eparchy', 'الأبرشية', eparchy),
  assignments: R('shield', 'Priest assignments', 'تعيينات الكهنة', WorkspacePage),
  household: R('family', 'Household', 'العائلة', householdView, { hidden: true }),
  styleguide: R('doc', 'Design system', 'نظام التصميم', styleguide)
};

/* Detail views (a person, a certificate, the design system) are reachable from whatever module
   linked to them, so they ride on their parent's permission. */
const DETAIL_PARENT = {
  assignments: 'workspace',
  membershipreviews: 'requests',
  profilereviews: 'requests',
  guestrequests: 'requests',
  person: 'people',
  household: 'households',
  certificate: 'sacraments'
};
const PERSONAL_ROUTES = new Set([
  'memberhome',
  'myrequests',
  'myministries',
  'mymeetings',
  'mycalendar',
  'myattendance',
  'mymessages',
  'myfeed',
  'myresources',
  'myformation',
  'mycommitments',
  'mynotes',
  'myprofile',
  'myconcerns',
  'membernotifications'
]);
export const MEMBER_ROUTES = new Set([...PERSONAL_ROUTES, 'memberhub']);
export const allowed = id =>
  id === 'account' ||
  canSee(id) ||
  !!(DETAIL_PARENT[id] && canSee(DETAIL_PARENT[id])) ||
  (PERSONAL_ROUTES.has(id) && !['bishop', 'secretary'].includes(S.role) && !!session.user?.person_id);
