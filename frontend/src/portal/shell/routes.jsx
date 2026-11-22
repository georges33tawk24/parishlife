/* Every screen of the portal, the module it belongs to, and who may open it. Each screen's module is
   loaded the first time it is opened (its own file in the build), so signing in downloads the shell and
   the first screen instead of every screen. */
import { lazy, Suspense, useLayoutEffect } from 'react';
import { num } from '../../lib/i18n.js';
import { PageSkeleton } from '../ui/ui.jsx';
import * as D from '../model/data.js';
import { S, canSee } from '../model/store.js';
import { session } from '../model/api.js';

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
/* A screen loaded on first use: `load` imports its module, `pick` names the screen in it. A render
   function goes through screen(); a screen written as a component (`component`) is used as it is. */
function later(load, pick, component = false) {
  const Lazy = lazy(() => load().then(m => ({ default: component ? pick(m) : screen(pick(m)) })));
  function Later(props) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <Lazy {...props} />
      </Suspense>
    );
  }
  return Later;
}
const page = (load, pick) => later(load, pick);
const part = (load, pick) => later(load, pick, true);

const records = {
  dashboard: page(
    () => import('../features/dashboard/dashboard.jsx'),
    m => m.dashboard
  ),
  people: page(
    () => import('../features/records/people.jsx'),
    m => m.people
  ),
  person: page(
    () => import('../features/records/person.jsx'),
    m => m.personView
  ),
  households: page(
    () => import('../features/records/households.jsx'),
    m => m.households
  ),
  household: page(
    () => import('../features/records/households.jsx'),
    m => m.householdView
  ),
  sacraments: page(
    () => import('../features/records/sacraments.jsx'),
    m => m.sacraments
  ),
  requests: page(
    () => import('../features/records/requests.jsx'),
    m => m.requests
  ),
  certificate: page(
    () => import('../features/records/certificate.jsx'),
    m => m.certificate
  ),
  membershipreviews: part(
    () => import('../features/records/membership-reviews.jsx'),
    m => m.MembershipReviews
  ),
  profilereviews: part(
    () => import('../features/records/profile-reviews.jsx'),
    m => m.ProfileReviews
  ),
  guestrequests: part(
    () => import('../features/records/guest-requests.jsx'),
    m => m.GuestRequests
  ),
  notes: page(
    () => import('../features/records/notes.jsx'),
    m => m.notes
  )
};
const parishLife = {
  calendar: page(
    () => import('../features/parish-life/calendar.jsx'),
    m => m.calendar
  ),
  services: page(
    () => import('../features/parish-life/services.jsx'),
    m => m.services
  ),
  groups: page(
    () => import('../features/parish-life/groups.jsx'),
    m => m.groups
  ),
  attendance: page(
    () => import('../features/parish-life/attendance.jsx'),
    m => m.ministryAttendance
  ),
  ministryrequests: part(
    () => import('../features/parish-life/ministry-requests.jsx'),
    m => m.MinistryRequests
  ),
  volunteers: page(
    () => import('../features/parish-life/volunteers.jsx'),
    m => m.volunteers
  ),
  registrations: page(
    () => import('../features/parish-life/registrations.jsx'),
    m => m.registrations
  ),
  checkin: page(
    () => import('../features/parish-life/checkin.jsx'),
    m => m.checkin
  ),
  facilities: page(
    () => import('../features/spaces/facilities.jsx'),
    m => m.facilities
  ),
  reservations: page(
    () => import('../features/spaces/reservations.jsx'),
    m => m.reservations
  )
};
const communicate = {
  messaging: page(
    () => import('../features/communicate/messaging.jsx'),
    m => m.messaging
  ),
  inbox: part(
    () => import('../features/communicate/inbox.jsx'),
    m => m.InboxPage
  ),
  notices: page(
    () => import('../features/communicate/notices.jsx'),
    m => m.notices
  ),
  music: page(
    () => import('../features/communicate/music.jsx'),
    m => m.music
  ),
  portal: page(
    () => import('../features/communicate/website.jsx'),
    m => m.portal
  )
};
const office = {
  giving: page(
    () => import('../features/money/giving.jsx'),
    m => m.giving
  ),
  finance: page(
    () => import('../features/money/finance.jsx'),
    m => m.finance
  ),
  officeexpenses: page(
    () => import('../features/money/office-expenses.jsx'),
    m => m.officeExpenses
  ),
  forms: page(
    () => import('../features/administration/forms.jsx'),
    m => m.forms
  ),
  reports: page(
    () => import('../features/administration/reports.jsx'),
    m => m.reports
  ),
  audit: page(
    () => import('../features/administration/audit.jsx'),
    m => m.audit
  ),
  settings: page(
    () => import('../features/administration/settings.jsx'),
    m => m.settings
  ),
  eparchy: page(
    () => import('../features/administration/eparchy.jsx'),
    m => m.eparchy
  ),
  styleguide: page(
    () => import('../features/administration/styleguide.jsx'),
    m => m.styleguide
  ),
  workspace: part(
    () => import('../features/administration/workspace.jsx'),
    m => m.WorkspacePage
  ),
  insights: part(
    () => import('../features/administration/insights.jsx'),
    m => m.InsightsPage
  ),
  oversight: part(
    () => import('../features/oversight/oversight.jsx'),
    m => m.Oversight
  ),
  bishopeparchy: part(
    () => import('../features/oversight/oversight.jsx'),
    m => m.Eparchy
  ),
  bishopmap: part(
    () => import('../features/oversight/oversight.jsx'),
    m => m.MapView
  )
};
const memberPages = () => import('../features/member/pages.jsx');
const mine = {
  memberhome: page(memberPages, m => m.home),
  myministries: page(memberPages, m => m.ministries),
  mymeetings: page(memberPages, m => m.meetings),
  mycalendar: page(memberPages, m => m.calendar),
  myattendance: page(memberPages, m => m.attendancePage),
  myfeed: page(memberPages, m => m.feed),
  myresources: page(memberPages, m => m.resources),
  myformation: page(memberPages, m => m.formation),
  mycommitments: page(memberPages, m => m.commitments),
  mynotes: page(memberPages, m => m.notes),
  myprofile: page(memberPages, m => m.profile),
  myconcerns: page(memberPages, m => m.concerns),
  membernotifications: page(memberPages, m => m.notificationsPage),
  memberhub: page(memberPages, m => m.hub),
  myrequests: page(
    () => import('../features/member/requests.jsx'),
    m => m.requestsPage
  ),
  activity: part(
    () => import('../features/member/activity.jsx'),
    m => m.ActivityPage
  ),
  account: part(
    () => import('../features/account/account.jsx'),
    m => m.AccountPage
  )
};
const V = { ...records, ...parishLife, ...communicate, ...office, ...mine };
const R = (ico, en, ar, view, more = {}) => ({ ico, en, ar, view, ...more });

export const ROUTES = {
  membershipreviews: R('people', 'Parish membership requests', 'طلبات عضوية الرعية', V.membershipreviews),
  profilereviews: R('people', 'Profile corrections', 'تصحيحات الملفات', V.profilereviews),
  guestrequests: R('doc', 'Guest requests', 'طلبات الزوّار', V.guestrequests),
  activity: R('dash', 'My parish life', 'حياتي الرعوية', V.activity),
  ministryrequests: R('groups', 'Ministry membership', 'عضوية الخدمات', V.ministryrequests),
  inbox: R('msg', 'Inbox', 'البريد', V.inbox),
  workspace: R('shield', 'Administration', 'الإدارة', V.workspace),
  insights: R('reports', 'Insights', 'المؤشرات', V.insights),
  account: R('settings', 'My account', 'حسابي', V.account),
  memberhome: R('dash', 'Home', 'الرئيسية', V.memberhome),
  myrequests: R('sacr', 'My requests', 'طلباتي', V.myrequests, { mEn: 'Requests', mAr: 'طلباتي' }),
  myministries: R('groups', 'My Ministries', 'خدماتي', V.myministries),
  mymeetings: R('events', 'Meetings', 'الاجتماعات', V.mymeetings),
  mycalendar: R('events', 'Calendar', 'الرزنامة', V.mycalendar),
  myattendance: R('attend', 'Attendance', 'الحضور', V.myattendance),
  mymessages: R('msg', 'Messages', 'الرسائل', V.inbox),
  myfeed: R('bell', 'Announcements & Posts', 'الإعلانات والمنشورات', V.myfeed),
  myresources: R('doc', 'Resources', 'الموارد', V.myresources),
  myformation: R('doc', 'Formation', 'التنشئة', V.myformation),
  mycommitments: R('vol', 'My Commitments', 'التزاماتي', V.mycommitments),
  mynotes: R('notes', 'My Notes', 'ملاحظاتي', V.mynotes),
  myprofile: R('people', 'My Profile', 'ملفي', V.myprofile),
  myconcerns: R('shield', 'Submit a Concern', 'تقديم ملاحظة', V.myconcerns),
  membernotifications: R('bell', 'Notifications', 'الإشعارات', V.membernotifications),
  memberhub: R('msg', 'Member communication', 'التواصل مع الأعضاء', V.memberhub),
  oversight: R('portal', 'Parish oversight', 'الإشراف على الرعايا', V.oversight),
  bishopeparchy: R('portal', 'Eparchy', 'الأبرشية', V.bishopeparchy),
  bishopmap: R('pin', 'Parish map', 'خريطة الرعايا', V.bishopmap),
  dashboard: R('dash', 'Dashboard', 'لوحة القيادة', V.dashboard),
  people: R('people', 'People', 'المؤمنون', V.people, { badge: () => num(D.PEOPLE.length) }),
  person: R('people', 'Person', 'سجلّ شخص', V.person, { hidden: true }),
  households: R('family', 'Households', 'العائلات', V.households, { badge: () => D.HOUSEHOLDS.length }),
  sacraments: R('sacr', 'Sacraments', 'الأسرار', V.sacraments, {
    badge: () =>
      D.SACRAMENTS.filter(x => x.kind !== 'certificate' && ['preparing', 'scheduled', 'draft'].includes(x.status))
        .length
  }),
  requests: R('doc', 'Requests', 'الطلبات', V.requests, {
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
  certificate: R('doc', 'Record', 'قيد', V.certificate, { hidden: true }),
  notes: R('notes', 'Notes & Tasks', 'الملاحظات والمهام', V.notes),

  calendar: R('events', 'Calendar', 'الرزنامة', V.calendar),
  services: R('service', 'Services & Activities', 'الخدمات والأنشطة', V.services),
  groups: R('groups', 'Groups', 'المجموعات', V.groups, { badge: () => D.GROUPS.length }),
  attendance: R('attend', 'Attendance', 'الحضور', V.attendance),
  volunteers: R('vol', 'Volunteers', 'المتطوّعون', V.volunteers, {
    badge: () =>
      S.role === 'leader'
        ? new Set(D.GROUPS.flatMap(g => D.groupInfo(g.id).roster.map(r => r.p))).size
        : D.ROTA.teams.flatMap(x => x.filled).filter(f => !f.p || f.s === 'declined').length
  }),
  registrations: R('registr', 'Registrations & Payments', 'التسجيلات والدفعات', V.registrations),
  checkin: R('checkin', 'Check-in', 'التسجيل عند الباب', V.checkin),

  facilities: R('rooms', 'Facilities', 'المرافق', V.facilities),
  reservations: R('attend', 'Reservations', 'الحجوزات', V.reservations, {
    badge: () => D.RESERVATIONS.filter(r => r.status === 'pending').length
  }),

  messaging: R('msg', 'Messaging', 'المراسلة', V.messaging, {
    badge: () => D.MESSAGES.filter(m => m.status === 'failed').length
  }),
  notices: R('bell', 'Notices', 'الإعلانات', V.notices),
  music: R('music', 'Music library', 'مكتبة الألحان', V.music),
  portal: R('portal', 'Member portal', 'بوّابة المؤمنين', V.portal),

  giving: R('give', 'Giving', 'التقدمات', V.giving, { badge: () => (D.BATCH.status === 'open' ? 1 : 0) }),
  finance: R('fin', 'Finance', 'المالية', V.finance),
  officeexpenses: R('fin', 'Office Expenses', 'مصاريف المكتب', V.officeexpenses),

  forms: R('forms', 'Forms & workflows', 'الاستمارات والمسارات', V.forms),
  reports: R('reports', 'Reports', 'التقارير', V.reports),
  audit: R('shield', 'Audit trail', 'سجل التدقيق', V.audit),
  settings: R('settings', 'Settings', 'الإعدادات', V.settings),
  eparchy: R('portal', 'Eparchy', 'الأبرشية', V.eparchy),
  assignments: R('shield', 'Priest assignments', 'تعيينات الكهنة', V.workspace),
  household: R('family', 'Household', 'العائلة', V.household, { hidden: true }),
  styleguide: R('doc', 'Design system', 'نظام التصميم', V.styleguide)
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
