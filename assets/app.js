/* ParishLife application shell. Views render HTML strings into the content well;
   the server owns authentication, parish access, and authoritative records. */
import { icon } from './icons.js';
import { t, isAr, lang, setLang, num, fmtLong, matches } from './i18n.js';
import { PARISH, PARISHES, RATE, TODAY, PEOPLE, PHOTOS, person, initials } from './data.js';
import * as D from './data.js';
import { closeOverlays, toast, openModal, openDrawer, esc, avatar, catchAll, openPopover, closeMenu, paginateLists } from './ui.js';
import { S, ROLES, MOBILE_NAV, role, me, canSee, inRole, moduleOn, go, save, bus } from './store.js';
import { wireActions } from './actions.js';
import { hydrate, persist, saveFailed } from './persist.js';
import { api, loadSession, session, currentRole } from './api.js';
import { enhanceSelects, closeDropdown } from './components.js';
import { confirmPlanNavigation, planDirty } from './planning.js';

import * as Dashboard from './views/dashboard.js';
import * as People    from './views/people.js';
import * as Records   from './views/records.js';
import * as Pastoral  from './views/notes.js';
import * as Parish    from './views/parish.js';
import * as Spaces    from './views/spaces.js';
import * as Money     from './views/money.js';
import * as Comms     from './views/comms.js';
import * as Admin     from './views/admin.js';
import * as Oversight from './views/oversight.js';
import * as Administration from './views/administration.js';
import * as Member from './views/member.js';
import * as Account from './views/account.js';
import * as Home from './views/home.js';
import * as Inbox from './views/inbox.js';
import { requestsPage } from './views/member-requests.js';
import { M, loadMember } from './member-data.js';
import { applyTheme } from './theme.js';

/* ---------------- routes ---------------- */
export const ROUTES = {
  memberhome: { ico:'dash', en:'Home', ar:'الرئيسية', view:Member.home },
  myrequests: { ico:'sacr', en:'My requests', ar:'طلباتي', mEn:'Requests', mAr:'طلباتي', view:requestsPage },
  myministries: { ico:'groups', en:'My Ministries', ar:'خدماتي', view:Member.ministries },
  mymeetings: { ico:'events', en:'Meetings', ar:'الاجتماعات', view:Member.meetings },
  mycalendar: { ico:'events', en:'Calendar', ar:'الرزنامة', view:Member.calendar },
  myattendance: { ico:'attend', en:'Attendance', ar:'الحضور', view:Member.attendancePage },
  mymessages: { ico:'msg', en:'Parish messages', ar:'رسائل الرعية', view:Member.messages },
  myfeed: { ico:'bell', en:'Announcements & Posts', ar:'الإعلانات والمنشورات', view:Member.feed },
  myresources: { ico:'doc', en:'Resources', ar:'الموارد', view:Member.resources },
  myformation: { ico:'doc', en:'Formation', ar:'التنشئة', view:Member.formation },
  mycommitments: { ico:'vol', en:'My Commitments', ar:'التزاماتي', view:Member.commitments },
  mynotes: { ico:'notes', en:'My Notes', ar:'ملاحظاتي', view:Member.notes },
  myprofile: { ico:'people', en:'My Profile', ar:'ملفي', view:Member.profile },
  myconcerns: { ico:'shield', en:'Submit a Concern', ar:'تقديم ملاحظة', view:Member.concerns },
  membernotifications: { ico:'bell', en:'Notifications', ar:'الإشعارات', view:Member.notificationsPage },
  memberhub: { ico:'msg', en:'Member communication', ar:'التواصل مع الأعضاء', view:Member.hub },
  oversight:    { ico:'portal', en:'Parish oversight', ar:'الإشراف على الرعايا', view:Oversight.oversight },
  bishopeparchy:{ ico:'portal', en:'Eparchy', ar:'الأبرشية', view:Oversight.eparchy },
  bishopmap:    { ico:'events', en:'Parish map', ar:'خريطة الرعايا', view:Oversight.mapView },
  dashboard:    { ico:'dash',     en:'Dashboard',        ar:'لوحة القيادة',        view:Dashboard.dashboard },
  people:       { ico:'people',   en:'People',           ar:'المؤمنون',            view:People.people,      badge:() => num(D.PEOPLE.length) },
  person:       { ico:'people',   en:'Person',           ar:'سجلّ شخص',            view:People.personView,  hidden:true },
  households:   { ico:'family',   en:'Households',       ar:'العائلات',            view:People.households,  badge:() => D.HOUSEHOLDS.length },
  sacraments:   { ico:'sacr',     en:'Sacraments',       ar:'الأسرار',             view:Records.sacraments, badge:() => D.SACRAMENTS.filter(x => x.kind !== 'certificate' && ['preparing','scheduled','draft'].includes(x.status)).length },
  requests:     { ico:'doc',      en:'Requests',         ar:'الطلبات',             view:Records.requests, badge:() => D.SACRAMENTS.filter(x => x.kind === 'certificate'
      ? ['draft','awaiting-signature','approved'].includes(x.status)
      : ['requested','office-reviewed','awaiting-signature'].includes(x.status)).length
      + D.RESERVATIONS.filter(x => x.status === 'pending').length
      + D.SERVICE_REQUESTS.filter(x => ['pending','awaiting-approval'].includes(x.status)).length
      + D.PORTAL_REQUESTS.length + D.REGISTRATIONS.filter(x => x.waiting > 0).length
      + D.MEMBER_REQUESTS.filter(x => x.status === 'submitted').length },
  certificate:  { ico:'doc',      en:'Record',           ar:'قيد',                 view:Records.certificate, hidden:true },
  notes:        { ico:'notes',    en:'Pastoral notes',   ar:'ملاحظات رعوية',       view:Pastoral.notes },

  calendar:     { ico:'events',   en:'Calendar',         ar:'الرزنامة',            view:Parish.calendar },
  services:     { ico:'service',  en:'Service planning', ar:'تخطيط الخدم',         view:Parish.services },
  groups:       { ico:'groups',   en:'Groups',           ar:'المجموعات',           view:Parish.groups,      badge:() => D.GROUPS.length },
  attendance:   { ico:'attend',   en:'Attendance',       ar:'الحضور',              view:Parish.ministryAttendance },
  volunteers:   { ico:'vol',      en:'Volunteers',       ar:'المتطوّعون',           view:Parish.volunteers,
    badge:() => S.role==='leader' ? new Set(D.GROUPS.flatMap(g=>D.groupInfo(g.id).roster.map(r=>r.p))).size :
      D.ROTA.teams.flatMap(t => t.filled).filter(f => !f.p || f.s === 'declined').length },
  registrations:{ ico:'registr',  en:'Registrations',    ar:'التسجيلات',           view:Parish.registrations },
  checkin:      { ico:'checkin',  en:'Check-in',         ar:'التسجيل عند الباب',   view:Parish.checkin },

  facilities:   { ico:'rooms',    en:'Facilities',       ar:'المرافق',             view:Spaces.facilities },
  reservations: { ico:'attend',   en:'Reservations',     ar:'الحجوزات',            view:Spaces.reservations, badge:() => D.RESERVATIONS.filter(r => r.status === 'pending').length },

  messaging:    { ico:'msg',      en:'Messaging',        ar:'المراسلة',            view:Comms.messaging,    badge:() => D.MESSAGES.filter(m => m.status === 'failed').length },
  notices:      { ico:'bell',     en:'Notices',          ar:'الإعلانات',           view:Comms.notices },
  music:        { ico:'music',    en:'Music library',    ar:'مكتبة الألحان',       view:Comms.music },
  portal:       { ico:'portal',   en:'Member portal',    ar:'بوّابة المؤمنين',      view:Comms.portal },

  giving:       { ico:'give',     en:'Giving',           ar:'التقدمات',            view:Money.giving,       badge:() => D.BATCH.status === 'open' ? 1 : 0 },
  finance:      { ico:'fin',      en:'Finance',          ar:'المالية',             view:Money.finance },

  forms:        { ico:'forms',    en:'Forms & workflows',ar:'الاستمارات والمسارات', view:Admin.forms },
  reports:      { ico:'reports',  en:'Reports',          ar:'التقارير',            view:Admin.reports },
  audit:        { ico:'shield',   en:'Audit trail',      ar:'سجل التدقيق',         view:Admin.audit },
  settings:     { ico:'settings', en:'Settings',         ar:'الإعدادات',           view:Admin.settings },
  eparchy:      { ico:'portal',   en:'Eparchy',          ar:'الأبرشية',            view:Admin.eparchy },
  assignments:  { ico:'shield',   en:'Priest assignments', ar:'تعيينات الكهنة', view:Admin.assignments },
  household:    { ico:'family',   en:'Household',         ar:'العائلة',             view:People.householdView, hidden:true },
  styleguide:   { ico:'doc',      en:'Design system',    ar:'نظام التصميم',        view:Admin.styleguide },
  administration: { ico:'shield', en:'Administration',   ar:'الإدارة',             view:Administration.administration },
  account:      { ico:'people',   en:'My account',       ar:'حسابي',               view:Account.account },
  home:         { ico:'portal',   en:'My parishes',      ar:'رعاياي',              view:Home.home },
  inbox:        { ico:'mail',     en:'Private messages', ar:'الرسائل الخاصة',      view:Inbox.inbox, badge:() => Inbox.inboxUnread() }
};

export { S as state, ROLES, me, go };
/* Detail views (a person, a certificate, the design system) are reachable from
   whatever module linked to them, so they ride on their parent's permission. */
const DETAIL_PARENT = { person: 'people', household: 'households', certificate: 'sacraments' };
const PERSONAL_ROUTES = new Set(['memberhome','myrequests','myministries','mymeetings','mycalendar','myattendance',
  'mymessages','myfeed','myresources','myformation','mycommitments','mynotes','myprofile',
  'myconcerns','membernotifications']);
const MEMBER_ROUTES = new Set([...PERSONAL_ROUTES, 'memberhub']);
export const allowed = id => id === 'account' || id === 'home' || id === 'inbox' || inRole(id) || !!(DETAIL_PARENT[id] && inRole(DETAIL_PARENT[id])) ||
  (PERSONAL_ROUTES.has(id) && S.role !== 'bishop' && !!session.user?.person_id);

/* ---------------- shell ---------------- */
function railHTML() {
  const r = role();
  const items = r.nav.map(n => {
    if (n[0] === 'h') return `<div class="navgroup">${esc(t(n[1], n[2]))}</div>`;
    const rt = ROUTES[n[1]];
    if (!rt) return '';
    const on = S.route === n[1];
    return `<a class="navitem ${on ? 'on' : ''}" href="#/${n[1]}" ${on ? 'aria-current="page"' : ''}>
      ${icon(rt.ico, 18)}<span class="nl">${esc(S.role==='leader'&&n[1]==='services'?t('Ministry planning','تخطيط الخدمة'):t(rt.en, rt.ar))}</span>
      <span class="nb" ${rt.badge?.() ? '' : 'hidden'}>${esc(String(rt.badge?.() || ''))}</span></a>`;
  }).join('');

  const sync = saveFailed
    ? `<div class="syncline offline"><span class="dot"></span><span>${t('Save failed', 'تعذّر الحفظ')}</span></div>`
    : `<div class="syncline"><span class="dot"></span><span>${t('Connected to parish records', 'متصل بسجلات الرعية')}</span></div>`;

  return `<aside class="rail" id="rail">
    <button class="rail-parish" id="parishbtn" style="width:100%;border:0;background:none;cursor:pointer;text-align:start">
      ${PHOTOS.parish ? `<span class="seal has-photo" style="background-image:url(${PHOTOS.parish})"></span>` : '<span class="seal">P</span>'}
      <span class="txt"><b>${esc(t(PARISH.name, PARISH.nameAr))}</b>
        <small>${esc(t(PARISH.town, PARISH.townAr))} · ${esc(t(PARISH.rite, PARISH.riteAr))}</small></span>
      <span class="chev dimmer">${icon('chevD', 16)}</span>
    </button>
    <nav class="rail-nav" aria-label="${t('Modules', 'الوحدات')}">${items}</nav>
    <div class="rail-foot">
      ${sync}
      <button class="railtoggle" id="railtoggle">${icon('chevL', 17)}<span>${t('Collapse rail', 'طيّ الشريط')}</span></button>
    </div>
  </aside>`;
}

function topbarHTML() {
  const r = role(), p = me();
  return `<header class="topbar-app">
    <button class="iconbtn" id="menubtn" aria-label="${t('Open menu', 'فتح القائمة')}">${icon('dash', 19)}</button>
    <div class="gsearch">
      <div class="search">${icon('search', 17)}
        <input class="input" type="search" id="gsearch"
          placeholder="${t('Search people, records, pages', 'ابحث عن شخص أو سجل أو صفحة')}"
          aria-label="${t('Search', 'بحث')}" readonly>
        <span class="kbdslot"><span class="kbd">⌘K</span></span>
      </div>
    </div>
    <div class="topbar-right">
      <button class="iconbtn" id="bellbtn" aria-label="${t('Notifications', 'الإشعارات')}">
        ${icon('bell', 19)}${(S.role === 'member' ? M.notifications.some(n => !n.read) : OFFICE_BELL.includes(S.role) && NOTES.some(n => n[4])) || ACCOUNT_NOTES.list.some(n => !n.read) ? '<span class="dotmark"></span>' : ''}</button>
      <button class="userbtn" id="userbtn" aria-label="${t('Account', 'الحساب')}">
        ${avatar(p)}
        <span class="txt"><span class="un">${esc(isAr() ? p.ar : p.lat)}</span>
          <span class="ur">${esc(t(r.en, r.ar))}</span></span>
        ${icon('chevD', 15, 'dimmer')}
      </button>
    </div>
  </header>`;
}

function mobileHTML() {
  const ids = (MOBILE_NAV[S.role] || []).filter(moduleOn);
  return `<nav class="mobilebar" aria-label="${t('Sections', 'الأقسام')}">${ids.map(id => {
    const rt = ROUTES[id]; if (!rt) return '';
    const on = S.route === id;
    return `<button data-go="${id}" ${on ? 'aria-current="page"' : ''}>${icon(rt.ico, 20)}
      <span>${esc(rt.mEn ? t(rt.mEn, rt.mAr) : t(rt.en, rt.ar))}</span></button>`;
  }).join('')}</nav>`;
}

/* ---------------- render ---------------- */
const app = document.getElementById('app');

function renderShell() {
  app.className = `app${S.collapsed ? ' collapsed' : ''}`;
  app.innerHTML = `${railHTML()}<div class="railscrim" id="railscrim"></div>
    <div class="main">${topbarHTML()}
      <main class="well" id="well" tabindex="-1"><div class="wellpad" id="view"></div></main>
    </div>${mobileHTML()}`;
  wireShell();
}

function wireShell() {
  document.getElementById('railtoggle')?.addEventListener('click', () => {
    S.collapsed = !S.collapsed; save('pl-rail', S.collapsed ? '1' : '0');
    app.classList.toggle('collapsed', S.collapsed);
  });
  document.getElementById('menubtn')?.addEventListener('click', () => app.classList.add('railopen'));
  document.getElementById('railscrim')?.addEventListener('click', () => app.classList.remove('railopen'));
  app.querySelectorAll('.rail .navitem').forEach(a =>
    a.addEventListener('click', () => app.classList.remove('railopen')));
  app.querySelectorAll('.mobilebar [data-go]').forEach(b =>
    b.addEventListener('click', () => go(b.dataset.go)));
  document.getElementById('userbtn')?.addEventListener('click', userMenu);
  document.getElementById('bellbtn')?.addEventListener('click', notifications);
  document.getElementById('parishbtn')?.addEventListener('click', parishSwitcher);
  document.getElementById('gsearch')?.addEventListener('click', openPalette);
}

export function renderAll() {
  if (!session.user) return loginScreen();
  renderShell();
  renderView();
}

/* A link from a parish's public page names the parish; open the account there when it can. */
function pickParish() {
  const wanted = new URLSearchParams(location.search).get('parish');
  if (!wanted) return;
  if (session.parishes.some(p => p.id === wanted)) session.parishId = wanted;
  history.replaceState(null, '', location.pathname + location.hash);
}
const requestLink = () => /^#\/?myrequests/.test(location.hash);
/* The way back from the sign-in screen: the parish page someone came from, or the homepage. */
const siteLink = () => {
  const parish = new URLSearchParams(location.search).get('parish');
  return parish ? `./?parish=${encodeURIComponent(parish)}${requestLink() ? '#sacraments' : ''}` : './';
};

/* ---------------- sign in, or open an account ---------------- */
/* What the sign-in screen remembers while it is redrawn (a language switch, a failed attempt). */
const SI = { tab: '', via: '', values: {}, config: null, challenge: null, ticket: null, provider: null };
const EASTERN_DIGITS = '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹';
/* A phone number read the way the server reads it (login_name): any spacing, 00 or +, Arabic
   digits; Lebanon unless another country code is given. '' when it is not a phone number. */
function phoneKey(value) {
  const digits = [...String(value || '').trim()].map(ch => { const i = EASTERN_DIGITS.indexOf(ch); return i < 0 ? ch : String(i % 10); })
    .join('').replace(/[\s\-().]/g, '');
  if (!/^(\+|00)?[0-9]{6,15}$/.test(digits)) return '';
  const full = digits.startsWith('00') ? '+' + digits.slice(2) : digits.startsWith('+') ? digits
    : digits.startsWith('961') && digits.length >= 10 ? '+' + digits : '+961' + digits.replace(/^0+/, '');
  return /^\+[0-9]{8,15}$/.test(full) ? full : '';
}
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const passwordField = (id, label, autocomplete, help = '') => `<div class="formrow"><label class="label" for="${id}">${label}</label>
  <div class="pw-field"><input class="input" id="${id}" type="password" autocomplete="${autocomplete}" maxlength="200" aria-describedby="${help ? `${id}-help ` : ''}${id}-error">
    <button type="button" class="pw-toggle" data-pw="${id}" aria-controls="${id}" aria-pressed="false">${icon('eye', 18)}<span>${t('Show', 'إظهار')}</span></button></div>
  ${help ? `<span class="help" id="${id}-help">${help}</span>` : ''}<span class="si-error" id="${id}-error" hidden></span></div>`;
const siField = (id, label, attrs, help = '') => `<div class="formrow"><label class="label" for="${id}">${label}</label>
  <input class="input" id="${id}" ${attrs} aria-describedby="${help ? `${id}-help ` : ''}${id}-error">
  ${help ? `<span class="help" id="${id}-help">${help}</span>` : ''}<span class="si-error" id="${id}-error" hidden></span></div>`;
/* Words for the outcomes a sign-in provider can send back. */
const AUTH_ERRORS = {
  unavailable: () => t('That sign-in provider is not set up on this server yet. Use your email address, phone number or username instead.', 'مزوّد تسجيل الدخول هذا غير مُعدّ على هذا الخادم بعد. استخدم بريدك الإلكتروني أو رقم هاتفك أو اسم المستخدم.'),
  expired: () => t('The sign-in took too long, or was started in another browser. Please try again.', 'استغرق تسجيل الدخول وقتاً طويلاً أو بدأ في متصفّح آخر. يُرجى المحاولة مجدداً.'),
  cancelled: () => t('Sign-in was cancelled.', 'أُلغي تسجيل الدخول.'),
  failed: () => t('The provider’s sign-in could not be completed. Try again, or use your password.', 'تعذّر إكمال تسجيل الدخول عبر المزوّد. حاول مجدداً أو استخدم كلمة المرور.'),
  blocked: () => t('This account cannot sign in. Contact your parish office.', 'لا يمكن لهذا الحساب تسجيل الدخول. اتصل بمكتب رعيتك.'),
  'email-in-use': p => t(`An account already uses the email address from ${p}. Sign in with your password, then link ${p} from My account. Accounts are never joined automatically.`,
    `يوجد حساب يستخدم البريد الإلكتروني الوارد من ${p}. سجّل الدخول بكلمة المرور، ثم اربط ${p} من «حسابي». لا تُدمج الحسابات تلقائياً.`),
  'linked-elsewhere': p => t(`That ${p} account is already linked to a different ParishLife account.`, `حساب ${p} هذا مرتبط بحساب ParishLife آخر.`)
};
const PROVIDER_NAMES = { google: 'Google', apple: 'Apple', microsoft: 'Microsoft' };
/* What a provider sent back in the address; read once, then removed from it. */
function takeAuthParams() {
  const params = new URLSearchParams(location.search), out = {};
  for (const key of ['auth_error', 'provider', 'provider_signup', 'mfa', 'linked', 'invite']) if (params.has(key)) { out[key] = params.get(key); params.delete(key); }
  /* a parish's public page links here with its ID: remember it, so the new account can connect to that parish */
  if (params.get('parish')) try { localStorage.setItem('pl-parish-hint', params.get('parish')); } catch { /* private mode */ }
  if (Object.keys(out).length) history.replaceState(null, '', location.pathname + (params.size ? '?' + params : '') + location.hash);
  return out;
}
const AUTH = takeAuthParams();

/* An invitation link from a parish office: once signed in (or registered), it becomes a membership
   request for the office to confirm against the record it was sent for. */
async function acceptInvite() {
  const token = AUTH.invite;
  if (!token) return;
  delete AUTH.invite; SI.invite = null;
  try {
    await api('connections', 'POST', { op: 'acceptInvite', token });
    await loadSession(); Home.reloadHome();
    toast(t('Invitation accepted', 'قُبلت الدعوة'), t('Your request is with the parish office. They will confirm it and link your account to your parish record.', 'طلبك لدى مكتب الرعية. سيؤكّده ويربط حسابك بسجلّك في الرعية.'), 'success');
  } catch (error) { toast(t('Invitation not used', 'لم تُستعمل الدعوة'), error.message, 'danger'); }
}
function inviteBanner() {
  if (!AUTH.invite) return '';
  if (SI.invite === undefined || SI.invite === null) {
    SI.invite = false;
    api('invitations/info', 'POST', { token: AUTH.invite }).then(info => { SI.invite = info; if (!session.user) { rememberLogin(); loginScreen(); } })
      .catch(error => { SI.invite = { error: error.message }; if (!session.user) { rememberLogin(); loginScreen(); } });
  }
  if (!SI.invite) return '';
  if (SI.invite.error) return `<div class="alert alert-warning signin-context">${icon('warn', 18)}<span>${esc(SI.invite.error)}</span></div>`;
  const p = SI.invite.parish;
  return `<div class="alert alert-info signin-context">${icon('mail', 18)}<span><b>${esc(t(`${p.name} invited you${SI.invite.firstName ? ', ' + SI.invite.firstName : ''}`, `دعتك ${p.ar || p.name}${SI.invite.firstName ? '، ' + SI.invite.firstName : ''}`))}</b>
    ${t('Sign in, or create an account if you have none. The parish office then confirms it is you and links your account to your parish record.',
      'سجّل الدخول، أو أنشئ حساباً إن لم يكن لديك. ثم يؤكّد مكتب الرعية هويتك ويربط حسابك بسجلّك في الرعية.')}</span></div>`;
}

const SIGNIN_VIA = [
  ['email', 'Email', 'البريد الإلكتروني'], ['phone', 'Phone number', 'رقم الهاتف'], ['username', 'Username', 'اسم المستخدم']];
const viaField = via => via === 'email'
  ? siField('si_u', t('Email address', 'البريد الإلكتروني'), `type="email" inputmode="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" dir="ltr" maxlength="120" value="${esc(SI.values.si_email || '')}"`)
  : via === 'phone'
  ? siField('si_u', t('Phone number', 'رقم الهاتف'), `type="tel" inputmode="tel" autocomplete="username" dir="ltr" maxlength="40" placeholder="03 123 456" value="${esc(SI.values.si_phone || '')}"`,
      t('Lebanese numbers need no country code. Others start with + and the country code.', 'الأرقام اللبنانية لا تحتاج رمز البلد. غيرها يبدأ بـ + ورمز البلد.'))
  : siField('si_u', t('Username', 'اسم المستخدم'), `autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" dir="ltr" maxlength="120" value="${esc(SI.values.si_username || '')}"`,
      t('Accounts made by a parish or diocese office have a username.', 'الحسابات التي أنشأها مكتب رعية أو أبرشية لها اسم مستخدم.'));

/* Google, Apple and Microsoft: offered everywhere, usable only once this server is configured for them. */
function providerButtons(intent) {
  const cfg = SI.config?.providers || {};
  const ready = Object.values(cfg).some(p => p.configured);
  return `<div data-providers="${intent}"><div class="signin-or"><span>${t('or', 'أو')}</span></div>
    <div class="signin-providers">${['google', 'apple', 'microsoft'].map(id => {
      const p = cfg[id], on = !!p?.configured, name = PROVIDER_NAMES[id];
      const label = intent === 'signup' ? t(`Sign up with ${name}`, `أنشئ حساباً عبر ${name}`) : t(`Continue with ${name}`, `المتابعة عبر ${name}`);
      return on ? `<a class="btn btn-secondary signin-provider" href="/api/auth/${id}/start?intent=${intent}">${esc(label)}</a>`
        : `<button type="button" class="btn btn-secondary signin-provider" disabled aria-describedby="si-providers-note-${intent}">${esc(label)}</button>`;
    }).join('')}</div>
    ${ready ? '' : `<p class="signin-fine" id="si-providers-note-${intent}">${SI.config ? t('Not set up yet: this server has no Google, Apple or Microsoft sign-in configured.', 'غير مُعدّ بعد: لا تسجيل دخول عبر Google أو Apple أو Microsoft على هذا الخادم.')
      : t('Checking which sign-in providers this server offers…', 'جارٍ التحقّق من مزوّدي تسجيل الدخول المتاحين…')}</p>`}</div>`;
}

function loginScreen(error = '') {
  S.themeDraft = null; applyTheme(null);   // the sign-in page is ParishLife's own, before any parish is chosen
  const params = new URLSearchParams(location.search);
  if (AUTH.provider_signup && !SI.ticket) { SI.ticket = AUTH.provider_signup; SI.tab = 'provider'; }
  if (AUTH.mfa && !SI.challenge) { SI.challenge = { challenge: AUTH.mfa }; SI.tab = 'mfa'; }
  if (AUTH.auth_error && !error) { error = (AUTH_ERRORS[AUTH.auth_error] || AUTH_ERRORS.failed)(PROVIDER_NAMES[AUTH.provider] || t('the provider', 'المزوّد')); delete AUTH.auth_error; SI.tab ||= 'in'; }
  SI.tab ||= params.get('signup') ? 'up' : 'in';
  SI.via ||= 'email';
  /* only the provider buttons change once the server says which providers it offers; what is being typed stays */
  if (!SI.config) api('auth/config').then(c => {
    SI.config = c;
    app.querySelectorAll('.signin [data-providers]').forEach(el => { el.outerHTML = providerButtons(el.dataset.providers); });
  }).catch(() => {});
  app.className = 'signin';
  app.innerHTML = `<div class="signin-art"><div class="brandrow"><span class="seal">P</span><span>ParishLife</span></div>
    <div><h1>${t('A little closer to your parish.', 'أقرب قليلاً إلى رعيتك.')}</h1><p>${t('Ask for a sacrament, a certificate or the parish hall, and follow every step.', 'اطلب سرّاً أو شهادة أو قاعة الرعية، وتابع كل خطوة.')}</p></div>
    <div class="swatches"><i style="background:#233B32;border:1px solid #EDF0E8"></i><i style="background:#EDF0E8"></i><i style="background:#FFFFFF"></i><i style="background:var(--selection)"></i><i style="background:var(--text-2)"></i></div></div>
    <div class="signin-form"><div class="signin-box">
      <a class="signin-back" href="${esc(siteLink())}">${icon('chevL', 16)}${siteLink() === './' ? t('Back to the website', 'العودة إلى الموقع') : t('Back to the parish page', 'العودة إلى صفحة الرعية')}</a>
      ${SI.tab === 'mfa' ? mfaPanel(error) : SI.tab === 'provider' ? providerPanel(error) : signInPanels(error)}
      <div class="langswap" role="group" aria-label="${t('Language', 'اللغة')}"><button type="button" data-login-lang="en" aria-pressed="${!isAr()}">English</button><button type="button" data-login-lang="ar" aria-pressed="${isAr()}">العربية</button></div>
    </div></div>`;
  app.querySelectorAll('[data-login-lang]').forEach(b => b.addEventListener('click', () => { rememberLogin(); setLang(b.dataset.loginLang); loginScreen(); }));
  if (SI.tab === 'mfa') wireMfa(); else if (SI.tab === 'provider') wireProvider(); else wireLogin();
}

function signInPanels(error) {
  const up = SI.tab === 'up', v = SI.values, wantsRequest = requestLink();
  const alert = show => `<div class="alert alert-danger signin-alert" role="alert" ${error && show ? '' : 'hidden'}>${icon('warn', 18)}<span>${esc(error && show ? error : '')}</span></div>`;
  return `<h2 id="si-title">${up ? t('Create your account', 'أنشئ حسابك') : t('Welcome', 'أهلاً بك')}</h2>
      <p class="signin-lead" id="si-lead">${up ? t('Your account is yours, not a parish’s. After creating it you can follow parishes or ask to become a member.', 'حسابك ملكك لا ملك رعية. بعد إنشائه يمكنك متابعة الرعايا أو طلب الانتساب إليها.')
        : t('Sign in with your email address, phone number or username.', 'سجّل الدخول ببريدك الإلكتروني أو رقم هاتفك أو اسم المستخدم.')}</p>
      ${inviteBanner()}
      ${wantsRequest ? `<div class="alert alert-info signin-context">${icon('info', 18)}<span><b>${t('Sign in to send your request', 'سجّل الدخول لإرسال طلبك')}</b>${t('If you do not have an account yet, create one first. It is free and takes a minute.', 'إذا لم يكن لديك حساب بعد، أنشئ حساباً أولاً. إنه مجاني ويستغرق دقيقة.')}</span></div>` : ''}
      <div class="signin-tabs" role="tablist" aria-label="${t('Sign in or create an account', 'تسجيل الدخول أو إنشاء حساب')}">
        <button type="button" role="tab" id="si-tab-in" aria-controls="si-in" aria-selected="${!up}" tabindex="${up ? -1 : 0}" data-si-tab="in">${t('Sign in', 'تسجيل الدخول')}</button>
        <button type="button" role="tab" id="si-tab-up" aria-controls="si-up" aria-selected="${up}" tabindex="${up ? 0 : -1}" data-si-tab="up">${t('Create an account', 'إنشاء حساب')}</button>
      </div>
      <div id="si-in" role="tabpanel" aria-labelledby="si-tab-in" ${up ? 'hidden' : ''}><form novalidate>
        ${alert(!up)}
        <div class="signin-via" role="tablist" aria-label="${t('Sign in with', 'تسجيل الدخول بواسطة')}">${SIGNIN_VIA.map(([id, en, ar]) =>
          `<button type="button" role="tab" id="si-via-${id}" aria-selected="${SI.via === id}" tabindex="${SI.via === id ? 0 : -1}" data-si-via="${id}" aria-controls="si-via-panel">${t(en, ar)}</button>`).join('')}</div>
        <div id="si-via-panel" role="tabpanel" aria-labelledby="si-via-${SI.via}">${viaField(SI.via)}</div>
        ${passwordField('si_p', t('Password', 'كلمة المرور'), 'current-password')}
        <button class="btn btn-primary btn-touch signin-submit" type="submit">${t('Sign in', 'تسجيل الدخول')}</button>
        <details class="signin-forgot"><summary>${t('Forgot your password?', 'نسيت كلمة المرور؟')}</summary>
          <p>${t('Call your parish office. They will give you a new password over the phone.', 'اتصل بمكتب رعيتك، وسيعطونك كلمة مرور جديدة عبر الهاتف.')}</p></details>
        ${providerButtons('signin')}
        <p class="signin-switch">${t('New here?', 'جديد هنا؟')} <button type="button" class="linkbtn" data-si-tab="up">${t('Create an account', 'أنشئ حساباً')}</button></p>
      </form></div>
      <div id="si-up" role="tabpanel" aria-labelledby="si-tab-up" ${up ? '' : 'hidden'}><form novalidate>
        ${alert(up)}
        <div class="signin-pair">
          ${siField('su_first', t('First name', 'الاسم'), `autocomplete="given-name" maxlength="60" value="${esc(v.su_first || '')}"`)}
          ${siField('su_last', t('Last name', 'الشهرة'), `autocomplete="family-name" maxlength="60" value="${esc(v.su_last || '')}"`)}
        </div>
        <fieldset class="signin-method" aria-describedby="su-contact-help"><legend class="label">${t('How can we reach you?', 'كيف نتواصل معك؟')}</legend>
          <p class="help" id="su-contact-help">${t('Give an email address, a phone number, or both. You can sign in with either.', 'أدخل بريداً إلكترونياً أو رقم هاتف أو كليهما. يمكنك تسجيل الدخول بأيّ منهما.')}</p>
          <span class="si-error" id="su_contact-error" hidden></span>
          ${siField('su_email', t('Email address', 'البريد الإلكتروني'), `type="email" inputmode="email" autocomplete="email" autocapitalize="none" autocorrect="off" spellcheck="false" dir="ltr" maxlength="120" value="${esc(v.su_email || '')}"`)}
          ${siField('su_phone', t('Mobile phone number', 'رقم الهاتف الخلوي'), `type="tel" inputmode="tel" autocomplete="tel" dir="ltr" maxlength="40" placeholder="03 123 456" value="${esc(v.su_phone || '')}"`)}
        </fieldset>
        ${siField('su_born', t('Date of birth', 'تاريخ الولادة'), `type="date" autocomplete="bday" max="${esc(new Date().toISOString().slice(0, 10))}" value="${esc(v.su_born || '')}"`,
          t('You need to be 13 or older to have an account.', 'يجب أن يكون عمرك ١٣ سنة أو أكثر لفتح حساب.'))}
        ${passwordField('su_p', t('Choose a password', 'اختر كلمة مرور'), 'new-password', t('At least 8 characters. Write it down and keep it somewhere safe.', '٨ أحرف على الأقل. دوّنها واحفظها في مكان آمن.'))}
        ${passwordField('su_p2', t('Confirm the password', 'أكّد كلمة المرور'), 'new-password')}
        <div class="signin-hp" aria-hidden="true"><label for="su_website">Website</label><input id="su_website" name="website" tabindex="-1" autocomplete="off"></div>
        <button class="btn btn-primary btn-touch signin-submit" type="submit">${t('Create my account', 'إنشاء حسابي')}</button>
        <p class="signin-fine">${t('We then try to send a code to check each address and number. If this server cannot send codes yet, you will see that, and your details stay unverified until it can.',
          'نحاول بعدها إرسال رمز للتحقّق من كل عنوان ورقم. إن لم يكن الخادم قادراً على إرسال الرموز بعد، سترى ذلك، وتبقى بياناتك غير مُتحقَّق منها حتى يصبح قادراً.')}</p>
        ${providerButtons('signup')}
        <p class="signin-switch">${t('Already have an account?', 'لديك حساب مسبقاً؟')} <button type="button" class="linkbtn" data-si-tab="in">${t('Sign in', 'سجّل الدخول')}</button></p>
      </form></div>`;
}

function rememberLogin() {
  const box = app.querySelector('.signin-box');
  if (!box) return;
  for (const id of ['su_first', 'su_last', 'su_phone', 'su_email', 'su_born', 'pv_first', 'pv_last', 'pv_born', 'pv_phone']) {
    const field = box.querySelector('#' + id);
    if (field) SI.values[id] = field.value;
  }
  const typed = box.querySelector('#si_u');
  if (typed) SI.values['si_' + SI.via] = typed.value;
}

/* Shared by every sign-in form: per-field messages that go as soon as the field is corrected. */
function formHelpers(forms) {
  const fieldError = (form, id, message) => {
    const error = form.querySelector(`#${id}-error`), field = form.querySelector('#' + id);
    if (!error) return;
    if (message) { error.innerHTML = `${icon('warn', 14)}<span>${esc(message)}</span>`; error.hidden = false; field?.setAttribute('aria-invalid', 'true'); }
    else { error.hidden = true; error.textContent = ''; field?.removeAttribute('aria-invalid'); }
  };
  const alertOf = (form, message, action = '') => {
    const alert = form.querySelector('.signin-alert');
    alert.hidden = !message;
    alert.innerHTML = message ? `${icon('warn', 18)}<span>${esc(message)}${action}</span>` : '';
  };
  const clearAll = form => { form.querySelectorAll('.si-error').forEach(e => fieldError(form, e.id.replace(/-error$/, ''), '')); alertOf(form, ''); };
  const showErrors = (form, errors) => {
    errors.forEach(([id, message]) => fieldError(form, id, message));
    form.querySelector('#' + errors[0][0])?.focus();
  };
  forms.forEach(form => form.addEventListener('input', e => {
    if (e.target.id && form.querySelector(`#${e.target.id}-error:not([hidden])`)) fieldError(form, e.target.id, '');
    if (['su_email', 'su_phone'].includes(e.target.id)) fieldError(form, 'su_contact', '');
  }));
  const busy = (button, on) => { button.disabled = on; on ? button.setAttribute('aria-busy', 'true') : button.removeAttribute('aria-busy'); };
  app.querySelectorAll('[data-pw]').forEach(b => b.addEventListener('click', () => {
    const field = app.querySelector('#' + b.dataset.pw), show = field.type === 'password';
    field.type = show ? 'text' : 'password';
    b.setAttribute('aria-pressed', show);
    b.innerHTML = `${icon(show ? 'eyeOff' : 'eye', 18)}<span>${show ? t('Hide', 'إخفاء') : t('Show', 'إظهار')}</span>`;
  }));
  return { fieldError, alertOf, clearAll, showErrors, busy };
}

const ageOn = born => {
  const [y, m, d] = String(born || '').split('-').map(Number), now = new Date();
  if (!y || !m || !d) return -1;
  return now.getFullYear() - y - ((now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) ? 1 : 0);
};
const bornError = born => !/^\d{4}-\d{2}-\d{2}$/.test(born || '') ? t('Enter your date of birth.', 'أدخل تاريخ ولادتك.')
  : ageOn(born) < 0 || born > new Date().toISOString().slice(0, 10) ? t('Enter your date of birth.', 'أدخل تاريخ ولادتك.')
  : ageOn(born) < 13 ? t('You need to be 13 or older to have an account. A parent or guardian can make requests for you.', 'يجب أن يكون عمرك ١٣ سنة أو أكثر. يمكن لأحد الوالدين أو الوصي تقديم الطلبات عنك.') : '';
const phoneError = raw => raw.trim() && !phoneKey(raw) ? t('This does not look like a phone number. Check the digits, for example 03 123 456.', 'لا يبدو هذا رقم هاتف. تحقّق من الأرقام، مثلاً ٠٣ ١٢٣ ٤٥٦.') : '';

/* After an account is opened: what happened to each verification code, said plainly. */
function deliveryToast(delivery = []) {
  const lines = delivery.map(d => {
    const what = d.kind === 'email' ? t('email', 'البريد') : t('phone', 'الهاتف');
    return ({ sent: t(`A code was sent to your ${what}.`, `أُرسل رمز إلى ${what}.`),
      verified: t(`Your ${what} is verified.`, `${what} مُتحقَّق منه.`),
      failed: t(`The code to your ${what} could not be sent.`, `تعذّر إرسال الرمز إلى ${what}.`),
      console: t(`Development server: the ${what} code is in the server console, not sent.`, `خادم تطوير: رمز ${what} في نافذة الخادم ولم يُرسل.`),
      'not-configured': t(`No code was sent to your ${what}: this server cannot send them yet.`, `لم يُرسل رمز إلى ${what}: الخادم لا يستطيع إرسالها بعد.`) })[d.delivery]
      || t(`The code to your ${what} is on its way.`, `الرمز إلى ${what} قيد الإرسال.`);
  });
  return lines.join(' ');
}

function wireLogin() {
  const box = app.querySelector('.signin-box'), signIn = box.querySelector('#si-in form'), signUp = box.querySelector('#si-up form');
  const { fieldError, alertOf, clearAll, showErrors, busy } = formHelpers([signIn, signUp]);
  const showTab = (tab, focus = true) => {
    rememberLogin(); SI.tab = tab;
    const up = tab === 'up';
    box.querySelectorAll('[data-si-tab][role=tab]').forEach(b => { const on = b.dataset.siTab === tab; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    box.querySelector('#si-in').hidden = up; box.querySelector('#si-up').hidden = !up;
    box.querySelector('#si-title').textContent = up ? t('Create your account', 'أنشئ حسابك') : t('Welcome', 'أهلاً بك');
    box.querySelector('#si-lead').textContent = up ? t('Your account is yours, not a parish’s. After creating it you can follow parishes or ask to become a member.', 'حسابك ملكك لا ملك رعية. بعد إنشائه يمكنك متابعة الرعايا أو طلب الانتساب إليها.')
      : t('Sign in with your email address, phone number or username.', 'سجّل الدخول ببريدك الإلكتروني أو رقم هاتفك أو اسم المستخدم.');
    if (focus) box.querySelector(up ? '#su_first' : '#si_u').focus();
  };
  box.querySelectorAll('[data-si-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.siTab, b.getAttribute('role') !== 'tab')));
  /* Arrow keys move along a tab list, as in any tab list */
  const arrows = (list, ids, current, choose) => list.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = ids.indexOf(current()), step = (e.key === 'ArrowRight') !== isAr() ? 1 : -1;
    choose(e.key === 'Home' ? ids[0] : e.key === 'End' ? ids[ids.length - 1] : ids[(i + step + ids.length) % ids.length]);
  });
  arrows(box.querySelector('.signin-tabs'), ['in', 'up'], () => SI.tab, next => { showTab(next, false); box.querySelector(`#si-tab-${next}`).focus(); });
  const chooseVia = (via, focusTab) => {
    rememberLogin(); SI.via = via;
    box.querySelectorAll('[data-si-via]').forEach(b => { const on = b.dataset.siVia === via; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    const panel = box.querySelector('#si-via-panel');
    panel.setAttribute('aria-labelledby', `si-via-${via}`);
    panel.innerHTML = viaField(via); clearAll(signIn);
    (focusTab ? box.querySelector(`#si-via-${via}`) : panel.querySelector('#si_u')).focus();
  };
  box.querySelectorAll('[data-si-via]').forEach(b => b.addEventListener('click', () => chooseVia(b.dataset.siVia, false)));
  arrows(box.querySelector('.signin-via'), SIGNIN_VIA.map(v => v[0]), () => SI.via, via => chooseVia(via, true));

  signIn.addEventListener('submit', async e => {
    e.preventDefault(); clearAll(signIn); rememberLogin();
    const identifier = signIn.querySelector('#si_u').value.trim(), password = signIn.querySelector('#si_p').value, via = SI.via;
    const errors = [];
    if (!identifier) errors.push(['si_u', via === 'email' ? t('Enter your email address.', 'أدخل بريدك الإلكتروني.') : via === 'phone' ? t('Enter your phone number.', 'أدخل رقم هاتفك.') : t('Enter your username.', 'أدخل اسم المستخدم.')]);
    else if (via === 'email' && !EMAIL.test(identifier)) errors.push(['si_u', t('This does not look like an email address. Check it, for example name@example.com.', 'لا يبدو هذا عنوان بريد إلكتروني. تحقّق منه، مثلاً name@example.com.')]);
    else if (via === 'phone' && !phoneKey(identifier)) errors.push(['si_u', phoneError(identifier) || t('Enter your phone number.', 'أدخل رقم هاتفك.')]);
    if (!password) errors.push(['si_p', t('Enter your password.', 'أدخل كلمة المرور.')]);
    if (errors.length) return showErrors(signIn, errors);
    const button = signIn.querySelector('[type=submit]'); busy(button, true);
    try {
      const result = await api('login', 'POST', { method: via, identifier, password });
      if (result.mfa) { SI.challenge = result; SI.tab = 'mfa'; return loginScreen(); }
      SI.values = {}; SI.tab = '';
      await enter();
    } catch (error) {
      busy(button, false);
      alertOf(signIn, error.status === 401 ? (via === 'email' ? t('The email address or password is not right. Please check them and try again.', 'البريد الإلكتروني أو كلمة المرور غير صحيح. يُرجى التحقّق والمحاولة مجدداً.')
        : via === 'phone' ? t('The phone number or password is not right. Please check them and try again.', 'رقم الهاتف أو كلمة المرور غير صحيح. يُرجى التحقّق والمحاولة مجدداً.')
        : t('The username or password is not right. Please check them and try again.', 'اسم المستخدم أو كلمة المرور غير صحيح. يُرجى التحقّق والمحاولة مجدداً.')) : error.message);
      signIn.querySelector('#si_p').select();
    }
  });

  signUp.addEventListener('submit', async e => {
    e.preventDefault(); clearAll(signUp); rememberLogin();
    const v = SI.values, password = signUp.querySelector('#su_p').value, confirm = signUp.querySelector('#su_p2').value;
    const first = (v.su_first || '').trim(), last = (v.su_last || '').trim(), email = (v.su_email || '').trim(), phone = (v.su_phone || '').trim();
    const errors = [];
    if (!first) errors.push(['su_first', t('Enter your first name.', 'أدخل اسمك.')]);
    if (!last) errors.push(['su_last', t('Enter your last name.', 'أدخل شهرتك.')]);
    if (!email && !phone) errors.push(['su_contact', t('Enter an email address, a phone number, or both.', 'أدخل بريداً إلكترونياً أو رقم هاتف أو كليهما.')]);
    if (email && !EMAIL.test(email)) errors.push(['su_email', t('This does not look like an email address. Check it, for example name@example.com.', 'لا يبدو هذا عنوان بريد إلكتروني. تحقّق منه، مثلاً name@example.com.')]);
    if (phoneError(phone)) errors.push(['su_phone', phoneError(phone)]);
    if (bornError(v.su_born)) errors.push(['su_born', bornError(v.su_born)]);
    if (password.length < 8) errors.push(['su_p', t('Choose a password of at least 8 characters.', 'اختر كلمة مرور من ٨ أحرف على الأقل.')]);
    else if (password !== confirm) errors.push(['su_p2', t('The two passwords do not match.', 'كلمتا المرور غير متطابقتين.')]);
    if (errors.length) {
      const contact = errors.find(x => x[0] === 'su_contact'), fields = errors.filter(x => x[0] !== 'su_contact');
      if (contact) fieldError(signUp, 'su_contact', contact[1]);
      if (fields.length) showErrors(signUp, fields); else signUp.querySelector('#su_email').focus();
      return;
    }
    const button = signUp.querySelector('[type=submit]'); busy(button, true);
    try {
      const result = await api('signup', 'POST', { firstName: first, lastName: last, email, phone, birthDate: v.su_born,
        password, confirm, website: signUp.querySelector('#su_website').value });
      SI.values = {}; SI.tab = '';
      await enter('', { welcome: first, delivery: result.delivery });
    } catch (error) {
      busy(button, false);
      if (error.status === 409) {
        const field = /phone/i.test(error.message) ? 'su_phone' : 'su_email';
        fieldError(signUp, field, field === 'su_phone' ? t('This phone number already has an account.', 'لهذا الرقم حساب مسبقاً.') : t('This email address already has an account.', 'لهذا البريد الإلكتروني حساب مسبقاً.'));
        alertOf(signUp, field === 'su_phone' ? t('This phone number already has an account. ', 'لهذا الرقم حساب مسبقاً. ') : t('This email address already has an account. ', 'لهذا البريد الإلكتروني حساب مسبقاً. '),
          `<button type="button" class="linkbtn" data-si-existing>${t('Sign in instead', 'سجّل الدخول بدلاً من ذلك')}</button>`);
        signUp.querySelector('[data-si-existing]').addEventListener('click', () => {
          SI.via = field === 'su_phone' ? 'phone' : 'email';
          SI.values['si_' + SI.via] = field === 'su_phone' ? phone : email;
          SI.tab = 'in'; loginScreen(); app.querySelector('#si_p')?.focus();
        });
      } else if (error.status === 429) alertOf(signUp, t('Many accounts were opened in the last hour. Please try again later.', 'فُتحت حسابات كثيرة خلال الساعة الأخيرة. يُرجى المحاولة لاحقاً.'));
      else alertOf(signUp, error.message);
    }
  });
}

/* The second step of signing in: an authenticator code, an emailed or texted code, or a recovery code. */
const MFA_LABELS = {
  totp: ['Authenticator app', 'تطبيق المصادقة'], email: ['Email code', 'رمز بالبريد'], sms: ['Text message code', 'رمز برسالة نصية'], recovery: ['Recovery code', 'رمز استرداد']
};
function mfaPanel(error) {
  const c = SI.challenge || {}, methods = c.methods || [];
  SI.mfaMethod = methods.includes(SI.mfaMethod) ? SI.mfaMethod : methods[0];
  const m = SI.mfaMethod, hint = c.hints?.[m];
  const lead = !methods.length ? t('Loading…', 'جارٍ التحميل…')
    : m === 'totp' ? t('Open your authenticator app and enter the six-digit code it shows for ParishLife.', 'افتح تطبيق المصادقة وأدخل الرمز المكوّن من ستة أرقام لـ ParishLife.')
    : m === 'recovery' ? t('Enter one of the recovery codes you saved. Each works once.', 'أدخل أحد رموز الاسترداد التي حفظتها. كل رمز يعمل مرة واحدة.')
    : t(`We can send a code to ${hint || 'your verified contact'}.`, `يمكننا إرسال رمز إلى ${hint || 'جهة الاتصال المُتحقَّق منها'}.`);
  return `<h2>${t('Confirm it’s you', 'تأكيد هويتك')}</h2>
    <p class="signin-lead">${t('Two-step verification is on for this account.', 'التحقّق بخطوتين مفعّل لهذا الحساب.')}</p>
    <form id="mfa-form" novalidate>
      <div class="alert alert-danger signin-alert" role="alert" ${error ? '' : 'hidden'}>${icon('warn', 18)}<span>${esc(error)}</span></div>
      ${methods.length > 1 ? `<fieldset class="signin-method"><legend class="label">${t('Use', 'استخدم')}</legend><div class="signin-methods">${methods.map(x =>
        `<label class="signin-way"><input type="radio" name="mfa-method" value="${x}" ${x === m ? 'checked' : ''}><span>${esc(t(...MFA_LABELS[x]))}</span></label>`).join('')}</div></fieldset>` : ''}
      <p class="signin-lead" id="mfa-lead">${esc(lead)}</p>
      ${['email', 'sms'].includes(m) ? `<p><button type="button" class="btn btn-secondary" id="mfa-send">${t('Send the code', 'أرسل الرمز')}</button></p>
        <p class="signin-fine" id="mfa-sent" role="status">${esc(SI.mfaSent?.[m] || '')}</p>` : ''}
      ${siField('mfa_code', m === 'recovery' ? t('Recovery code', 'رمز الاسترداد') : t('Code', 'الرمز'),
        `${m === 'recovery' ? 'autocapitalize="none" spellcheck="false"' : 'inputmode="numeric"'} autocomplete="one-time-code" dir="ltr" maxlength="${m === 'recovery' ? 20 : 8}"`)}
      <button class="btn btn-primary btn-touch signin-submit" type="submit">${t('Continue', 'متابعة')}</button>
      <p class="signin-switch"><button type="button" class="linkbtn" data-mfa-back>${t('Back to sign in', 'العودة إلى تسجيل الدخول')}</button></p>
    </form>`;
}
function wireMfa() {
  const form = app.querySelector('#mfa-form'), c = SI.challenge;
  const { alertOf, showErrors, busy } = formHelpers([form]);
  const back = () => { SI.challenge = null; SI.mfaSent = null; SI.tab = 'in'; loginScreen(); };
  form.querySelector('[data-mfa-back]').addEventListener('click', back);
  if (!c.methods) {   // arrived from a provider: ask what this challenge allows
    api('login/challenge', 'POST', { challenge: c.challenge }).then(info => { SI.challenge = info; loginScreen(); })
      .catch(error => { SI.challenge = null; SI.tab = 'in'; loginScreen(error.message); });
    return;
  }
  form.querySelectorAll('input[name="mfa-method"]').forEach(r => r.addEventListener('change', () => { SI.mfaMethod = r.value; loginScreen(); }));
  form.querySelector('#mfa-send')?.addEventListener('click', async e => {
    busy(e.currentTarget, true);
    try {
      const result = await api('login/send', 'POST', { challenge: c.challenge, method: SI.mfaMethod });
      const kind = SI.mfaMethod === 'email' ? 'email' : 'phone';
      const { deliveryWords } = await import('./views/account.js');
      SI.mfaSent = { ...SI.mfaSent, [SI.mfaMethod]: deliveryWords(result.delivery, kind) };
      form.querySelector('#mfa-sent').textContent = SI.mfaSent[SI.mfaMethod];
    } catch (error) { alertOf(form, error.message); }
    finally { busy(e.currentTarget, false); }
  });
  form.querySelector('#mfa_code').focus();
  form.addEventListener('submit', async e => {
    e.preventDefault(); alertOf(form, '');
    const code = form.querySelector('#mfa_code').value.trim();
    if (!code) return showErrors(form, [['mfa_code', t('Enter the code.', 'أدخل الرمز.')]]);
    const button = form.querySelector('[type=submit]'); busy(button, true);
    try {
      await api('login/verify', 'POST', { challenge: c.challenge, method: SI.mfaMethod, code });
      SI.challenge = null; SI.mfaSent = null; SI.values = {}; SI.tab = '';
      await enter();
    } catch (error) {
      busy(button, false);
      if (error.status === 401 && /expired/i.test(error.message)) return back();
      alertOf(form, error.message); form.querySelector('#mfa_code').select();
    }
  });
}

/* Finishing an account opened with Google, Apple or Microsoft: the same name, age and contact rules. */
function providerPanel(error) {
  const p = SI.provider, v = SI.values;
  if (!p) return `<h2>${t('Finish creating your account', 'أكمل إنشاء حسابك')}</h2><p class="signin-lead">${t('Loading…', 'جارٍ التحميل…')}</p>`;
  return `<h2>${t('Finish creating your account', 'أكمل إنشاء حسابك')}</h2>
    <p class="signin-lead">${p.email ? esc(t(`You signed in with ${p.providerName} as ${p.email}.`, `سجّلت الدخول عبر ${p.providerName} بالعنوان ${p.email}.`)) + ' ' +
      (p.emailVerified ? t(`${p.providerName} has verified this address.`, `تحقّق ${p.providerName} من هذا العنوان.`) : t('This address is not verified yet.', 'هذا العنوان غير مُتحقَّق منه بعد.'))
      : esc(t(`You signed in with ${p.providerName}. It did not share an email address, so add a phone number.`, `سجّلت الدخول عبر ${p.providerName}. لم يشارك بريداً إلكترونياً، فأضف رقم هاتف.`))}</p>
    <form id="pv-form" novalidate>
      <div class="alert alert-danger signin-alert" role="alert" ${error ? '' : 'hidden'}>${icon('warn', 18)}<span>${esc(error)}</span></div>
      <div class="signin-pair">
        ${siField('pv_first', t('First name', 'الاسم'), `autocomplete="given-name" maxlength="60" value="${esc(v.pv_first ?? p.firstName ?? '')}"`)}
        ${siField('pv_last', t('Last name', 'الشهرة'), `autocomplete="family-name" maxlength="60" value="${esc(v.pv_last ?? p.lastName ?? '')}"`)}
      </div>
      ${siField('pv_born', t('Date of birth', 'تاريخ الولادة'), `type="date" autocomplete="bday" max="${esc(new Date().toISOString().slice(0, 10))}" value="${esc(v.pv_born || '')}"`,
        t('You need to be 13 or older to have an account.', 'يجب أن يكون عمرك ١٣ سنة أو أكثر لفتح حساب.'))}
      ${siField('pv_phone', p.email ? t('Mobile phone number (optional)', 'رقم الهاتف الخلوي (اختياري)') : t('Mobile phone number', 'رقم الهاتف الخلوي'),
        `type="tel" inputmode="tel" autocomplete="tel" dir="ltr" maxlength="40" placeholder="03 123 456" value="${esc(v.pv_phone || '')}"`)}
      <div class="signin-hp" aria-hidden="true"><label for="pv_website">Website</label><input id="pv_website" name="website" tabindex="-1" autocomplete="off"></div>
      <button class="btn btn-primary btn-touch signin-submit" type="submit">${t('Create my account', 'إنشاء حسابي')}</button>
      <p class="signin-switch"><button type="button" class="linkbtn" data-pv-cancel>${t('Cancel', 'إلغاء')}</button></p>
    </form>`;
}
function wireProvider() {
  const form = app.querySelector('#pv-form');
  if (!SI.provider) {
    api('auth/ticket', 'POST', { ticket: SI.ticket }).then(info => { SI.provider = info; loginScreen(); })
      .catch(error => { SI.ticket = null; SI.tab = 'in'; loginScreen(error.message); });
    return;
  }
  const { alertOf, showErrors, busy } = formHelpers([form]);
  form.querySelector('[data-pv-cancel]').addEventListener('click', () => { SI.ticket = null; SI.provider = null; SI.tab = 'in'; loginScreen(); });
  form.addEventListener('submit', async e => {
    e.preventDefault(); alertOf(form, ''); rememberLogin();
    const v = SI.values, errors = [];
    if (!(v.pv_first || '').trim()) errors.push(['pv_first', t('Enter your first name.', 'أدخل اسمك.')]);
    if (!(v.pv_last || '').trim()) errors.push(['pv_last', t('Enter your last name.', 'أدخل شهرتك.')]);
    if (bornError(v.pv_born)) errors.push(['pv_born', bornError(v.pv_born)]);
    if (phoneError(v.pv_phone || '')) errors.push(['pv_phone', phoneError(v.pv_phone)]);
    else if (!SI.provider.email && !(v.pv_phone || '').trim()) errors.push(['pv_phone', t('Enter your mobile phone number.', 'أدخل رقم هاتفك الخلوي.')]);
    if (errors.length) return showErrors(form, errors);
    const button = form.querySelector('[type=submit]'); busy(button, true);
    try {
      const result = await api('auth/complete', 'POST', { ticket: SI.ticket, firstName: v.pv_first, lastName: v.pv_last, birthDate: v.pv_born,
        phone: v.pv_phone || '', website: form.querySelector('#pv_website').value });
      const first = v.pv_first.trim();
      SI.values = {}; SI.tab = ''; SI.ticket = null; SI.provider = null;
      await enter('', { welcome: first, delivery: result.delivery });
    } catch (error) { busy(button, false); alertOf(form, error.message); }
  });
}

/* Into the portal after signing in or opening an account: the page that was asked for, or the role's first page. */
async function enter(parishId = '', { welcome = '', delivery = null } = {}) {
  await loadSession(); pickParish();
  if (AUTH.invite) await acceptInvite();
  if (parishId && session.parishes.some(p => p.id === parishId)) session.parishId = parishId;
  S.role = currentRole(); await hydrate(); S.route = ROLES[S.role]?.nav.find(n => n[0] === 'l')?.[1] || 'account';
  /* Signing in from a link (a request form, a notification) continues to that page; a new account starts at My account. */
  const wanted = welcome ? 'home' : location.hash.replace(/^#\/?/, '').split('/')[0];
  if (wanted && ROUTES[wanted] && allowed(wanted)) { if (welcome) location.hash = '#/home'; route(); }
  else { location.hash = '#/' + S.route; renderAll(); }
  if (welcome) toast(t(`Welcome, ${welcome}`, `أهلاً بك، ${welcome}`), t('Your account is ready. ', 'حسابك جاهز. ') + deliveryToast(delivery || []), 'success');
}

/* Navigation must not rebuild the rail — rebuilding it throws away the rail's
   own scroll position, which is why clicking a low entry used to jump to the top. */
/* Rail counts come from the data, so adding or approving something moves them straight away. */
function updateBadges() {
  document.querySelectorAll('.rail .navitem').forEach(a => {
    const n = ROUTES[a.getAttribute('href').slice(2)]?.badge?.(), nb = a.querySelector('.nb');
    if (!nb) return;
    nb.textContent = n ? String(n) : ''; nb.hidden = !n;
  });
}

function updateRail() {
  document.querySelectorAll('.rail .navitem').forEach(a => {
    const on = a.getAttribute('href') === '#/' + S.route;
    a.classList.toggle('on', on);
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
  updateBadges();
  document.querySelectorAll('.mobilebar [data-go]').forEach(b => {
    b.dataset.go === S.route ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
  });
}

/* A new screen starts at the top; an action re-rendering the same screen keeps
   the reader exactly where they were. The rail never moves either way. */
function renderView({ keepScroll = false } = {}) {
  const rt = ROUTES[S.route] || ROUTES.dashboard;
  /* the account's own colours and mode; a preview in My account → Appearance lasts only while that page is open */
  if (S.route !== 'account') S.themeDraft = null;
  applyTheme(S.themeDraft || session.user?.theme);
  const host = document.getElementById('view');
  const well = document.getElementById('well'), y = well?.scrollTop || 0;
  if (MEMBER_ROUTES.has(S.route) && M.loadedFor !== `${session.user?.id}:${session.parishId}`) {
    host.innerHTML = `<div class="member-page member-empty"><p>${t('Loading your parish life…', 'جارٍ تحميل حياتك الرعوية…')}</p></div>`;
    document.title = `${t(rt.en, rt.ar)} · ParishLife`;
    const key = `${session.user?.id}:${session.parishId}`;
    if (M.loadingFor !== key) {
      M.loadingFor = key;
      loadMember().then(() => { M.loadingFor = null; if (MEMBER_ROUTES.has(S.route)) renderView(); })
        .catch(error => { M.loadingFor = null; toast(t('Could not load member data', 'تعذّر تحميل بيانات الأعضاء'), error.message, 'danger'); });
    }
    return;
  }
  /* A module the parish's plan switched off: its records are kept, and can still be opened to finish what is waiting. */
  if (!moduleOn(S.route) && !(S.ui.planOpen ||= {})[S.route]) {
    host.innerHTML = `<div class="empty-state plan-off" role="status"><h1>${esc(t(rt.en, rt.ar))}</h1>
      <p>${t('This module is not in the parish’s current plan. Nothing in it was deleted: its records, bookings and waiting requests are kept as they were.', 'هذه الوحدة ليست ضمن خطة الرعية الحالية. لم يُحذف منها شيء: سجلّاتها وحجوزاتها وطلباتها المنتظرة محفوظة كما هي.')}</p>
      <p class="dim">${t('The parish priest can change the plan in Administration → Plans.', 'يمكن لكاهن الرعية تغيير الخطة من الإدارة ← الخطط.')}</p>
      <button class="btn btn-secondary" data-plan-open>${t('Open the records to finish what is waiting', 'فتح السجلّات لإنهاء ما ينتظر')}</button></div>`;
    host.querySelector('[data-plan-open]').addEventListener('click', () => { S.ui.planOpen[S.route] = true; renderView(); });
    document.title = `${t(rt.en, rt.ar)} · ParishLife`;
    return;
  }
  host.innerHTML = rt.view(...S.params) || '';
  (rt.mount || rt.view.mount)?.(host, ...S.params);
  host.querySelectorAll('[data-go]').forEach(el =>
    el.addEventListener('click', e => { e.preventDefault(); go(el.dataset.go); }));
  wireActions(host);
  catchAll(host);
  paginateLists(host, S.route + '/' + S.params.join('/'));
  closeDropdown(); enhanceSelects(host);
  document.title = `${t(rt.en, rt.ar)} · ParishLife`;
  if (well) well.scrollTop = keepScroll ? y : 0;
  if (!keepScroll) { host.classList.remove('view-in'); void host.offsetWidth; host.classList.add('view-in'); }   // a new page eases in; a re-render after an edit does not
}

/* ---------------- dialogs ---------------- */
function rateDialog() {
  const canEdit = S.role === 'priest' || S.role === 'treasurer';
  openModal({
    title: t('Parish exchange rate', 'سعر صرف الرعية'),
    sub: t('Every amount recorded from now on carries this rate. Past records keep the rate that produced them.',
           'كل مبلغ يُسجَّل من الآن يحمل هذا السعر. السجلات السابقة تحتفظ بالسعر الذي أنتجها.'),
    body: `<label class="label" for="rateinput">${t('Lira to the dollar', 'الليرة مقابل الدولار')}</label>
      <div class="field"><span class="prefix">L.L / $</span>
        <input class="value" id="rateinput" value="${num(RATE.value)}" ${canEdit ? '' : 'disabled'} dir="ltr"
          style="border:0;background:none;width:100%" inputmode="numeric"></div>
      <p class="help" id="ratehelp">${canEdit
        ? t(`Last set by ${RATE.setBy || 'parish office'}.`, `ضُبط أخيراً من ${RATE.setBy || 'مكتب الرعية'}.`)
        : t('Only clergy and the treasurer may change the rate.', 'الإكليروس وأمين الصندوق وحدهم يغيّرون السعر.')}</p>`,
    foot: `<button class="btn btn-secondary" data-close>${t('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="saverate" ${canEdit ? '' : 'disabled'} style="margin-inline-start:auto">${t('Save rate', 'حفظ السعر')}</button>`,
    onMount(el) {
      const inp = el.querySelector('#rateinput'), help = el.querySelector('#ratehelp');
      inp.addEventListener('input', () => {
        const v = parseInt(inp.value.replace(/\D/g, ''), 10);
        const okk = v >= 10000 && v <= 500000;
        help.classList.toggle('help-error', !okk);
        help.textContent = okk ? t(`$50 becomes L.L ${num(v * 50)}.`, `50$ تصبح ${num(v * 50)} ل.ل.`)
                               : t('Enter a rate between 10,000 and 500,000.', 'أدخل سعراً بين 10,000 و500,000.');
      });
      el.querySelector('#saverate')?.addEventListener('click', () => {
        const v = parseInt(inp.value.replace(/\D/g, ''), 10);
        if (!(v >= 10000 && v <= 500000)) return inp.focus();
        const before = RATE.value; RATE.value = v; RATE.setOn = new Date(); RATE.setBy = session.user?.name || '';
        closeOverlays(); renderView({ keepScroll: true });
        toast(t('Rate saved', 'حُفظ السعر'), `${num(v)} L.L / $`, 'success',
          { action: { label: t('Undo', 'تراجع'), fn: () => { RATE.value = before; renderView({ keepScroll: true }); } } });
      });
    }
  });
}

/* ---------------- command palette (⌘K) ---------------- */
const ACTIONS = [
  ['Start a counting session', 'فتح جلسة عدّ', 'give', '#/giving'],
  ['New parishioner', 'مؤمن جديد', 'people', '#/people'],
  ['Request a room', 'طلب قاعة', 'rooms', '#/reservations'],
  ['Take attendance', 'تسجيل الحضور', 'attend', '#/checkin'],
  ['Build this week\u2019s bulletin', 'بناء نشرة الأسبوع', 'doc', '#/notices'],
  ['Print my schedule', 'اطبع جدولي', 'print', '#/calendar'],
  ['Open the audit trail', 'فتح سجل التدقيق', 'shield', '#/audit']
];

let paletteEl;
function openPalette() {
  if (!paletteEl) {
    paletteEl = document.createElement('div');
    paletteEl.className = 'cmdk';
    paletteEl.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-label="${t('Command palette', 'لوحة الأوامر')}">
      <div class="q">${icon('search', 19)}<input id="cmdq" autocomplete="off"
        placeholder="${t('Search people, records, pages and actions', 'ابحث عن شخص أو سجل أو صفحة أو إجراء')}">
        <span class="kbd">esc</span></div>
      <div class="results" id="cmdres"></div></div>`;
    document.body.append(paletteEl);
    paletteEl.addEventListener('click', e => { if (e.target === paletteEl) closePalette(); });
  }
  paletteEl.classList.add('open');
  const q = paletteEl.querySelector('#cmdq');
  q.value = ''; renderPalette(''); q.focus();
  q.oninput = () => renderPalette(q.value);
  q.onkeydown = e => {
    const opts = [...paletteEl.querySelectorAll('.ac-opt')];
    const i = opts.findIndex(o => o.getAttribute('aria-selected') === 'true');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = e.key === 'ArrowDown' ? Math.min(opts.length - 1, i + 1) : Math.max(0, i - 1);
      opts.forEach(o => o.setAttribute('aria-selected', 'false'));
      opts[n]?.setAttribute('aria-selected', 'true'); opts[n]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') { opts[Math.max(0, i)]?.click(); }
  };
}
const closePalette = () => paletteEl?.classList.remove('open');

function renderPalette(q) {
  const res = paletteEl.querySelector('#cmdres');
  const acts = ['bishop','member'].includes(S.role) ? [] : ACTIONS.filter(a => matches(a[0] + ' ' + a[1], q));
  const ppl = S.role === 'member' ? [] : (q ? PEOPLE.filter(p => matches(`${p.lat} ${p.ar} ${p.phone}`, q)) : PEOPLE.slice(0, 3)).slice(0, 5);
  const households = q && canSee('households') ? D.HOUSEHOLDS.filter(h => matches(`${h.name} ${h.ar} ${h.town||''} ${h.envelope||''}`,q)).slice(0,5) : [];
  const records = q && canSee('sacraments') ? D.SACRAMENTS.filter(r => matches(`${r.reg||''} ${r.kind||''} ${D.person(r.person)?.lat||''}`,q)).slice(0,5) : [];
  const pages = Object.entries(ROUTES).filter(([id, r]) => !r.hidden && allowed(id) && matches(r.en + ' ' + r.ar, q)).slice(0, 5);

  const mark = (s2) => q ? esc(s2).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>') : esc(s2);

  res.innerHTML =
    (acts.length ? `<div class="ac-group">${t('Actions', 'إجراءات')}</div>` + acts.map(a =>
      `<button class="ac-opt" data-href="${a[3]}">${icon(a[2], 17)}<span><b>${mark(t(a[0], a[1]))}</b></span>
        <span class="kbd" style="margin-inline-start:auto">↵</span></button>`).join('') : '') +
    (pages.length ? `<div class="ac-group">${t('Pages', 'الصفحات')}</div>` + pages.map(([id, r]) =>
      `<button class="ac-opt" data-href="#/${id}">${icon(r.ico, 17)}<span><b>${mark(t(r.en, r.ar))}</b></span></button>`).join('') : '') +
    (ppl.length ? `<div class="ac-group">${q ? t('People', 'المؤمنون') : t('Recent', 'الأخيرة')}</div>` + ppl.map(p =>
      `<button class="ac-opt" data-href="#/person/${p.id}">${avatar(p, 'avatar-sm')}
        <span><b>${mark(isAr() ? p.ar : p.lat)}</b><small>${esc(isAr() ? p.lat : p.ar)} · ${t('Parishioner', 'مؤمن')}</small></span></button>`).join('') : '') +
    (households.length ? `<div class="ac-group">${t('Households','العائلات')}</div>` + households.map(h=>
      `<button class="ac-opt" data-href="#/household/${esc(h.id)}">${icon('family',17)}<span><b>${mark(isAr()?h.ar:h.name)}</b><small>${t('Household','عائلة')} · ${esc(h.town||'')}</small></span></button>`).join('') : '') +
    (records.length ? `<div class="ac-group">${t('Sacrament records','سجلات الأسرار')}</div>` + records.map(r=>
      `<button class="ac-opt" data-href="#/certificate/${esc(r.id)}">${icon('sacr',17)}<span><b>${mark(r.reg||r.kind)}</b><small>${t('Record','قيد')} · ${esc(D.person(r.person)?.lat||'')}</small></span></button>`).join('') : '') +
    (!acts.length && !pages.length && !ppl.length && !households.length && !records.length ? `<div class="ac-none">${t('Nothing matches.', 'لا نتيجة.')}</div>` : '');

  res.querySelector('.ac-opt')?.setAttribute('aria-selected', 'true');
  res.querySelectorAll('[data-href]').forEach(b => b.addEventListener('click', () => {
    closePalette(); location.hash = b.dataset.href;
  }));
}

/* ---------------- notifications ---------------- */
const NOTES = D.NOTIFICATIONS;
const OFFICE_BELL = ['priest', 'parishadmin', 'secretary', 'treasurer', 'leader'];
/* Notifications addressed to this account (ministry applications, departures, membership changes), across parishes. */
const ACCOUNT_NOTES = { list: [] };
async function loadAccountNotes() {
  try { ACCOUNT_NOTES.list = (await api('notifications')).notifications; } catch { ACCOUNT_NOTES.list = []; }
  const bell = document.getElementById('bellbtn');
  if (bell && ACCOUNT_NOTES.list.some(n => !n.read) && !bell.querySelector('.dotmark')) bell.insertAdjacentHTML('beforeend', '<span class="dotmark"></span>');
}
async function openAccountNote(n) {
  closeMenu();
  if (!n.read) { n.read = true; api('notifications', 'POST', { op: 'read', id: n.id }).catch(() => {}); }
  /* a private message belongs to the account, not to a parish workspace */
  if (n.parish && !String(n.route || '').startsWith('inbox') && n.parish !== session.parishId && session.parishes.some(p => p.id === n.parish)) { if (!await switchParish(n.parish)) return; }
  if (n.route) location.hash = '#/' + n.route;
}
async function notifications(e) {
  if (S.role === 'member' && !ACCOUNT_NOTES.list.some(n => !n.read)) { go('membernotifications'); return; }
  const anchor = e.currentTarget;
  await loadAccountNotes();
  const office = OFFICE_BELL.includes(S.role), mine = ACCOUNT_NOTES.list.slice(0, 12);
  openPopover(anchor, `
    <div class="pop-h"><b>${t('Notifications', 'الإشعارات')}</b>
      <button class="btn btn-ghost btn-dense" id="markread" style="margin-inline-start:auto">${t('Mark all read', 'تعليم الكل كمقروء')}</button></div>
    <div class="pop-b">${mine.length ? `<div class="ac-group">${t('For you', 'لك')}</div>` + mine.map((n, i) => `<button class="notif ${n.read ? '' : 'unread'}" data-an="${i}">
      <span class="nico">${icon(n.kind === 'message' ? 'mail' : n.kind.startsWith('ministry') ? 'groups' : 'bell', 17)}</span>
      <span class="ntxt"><span>${esc(n.title)}</span>${n.body ? `<small>${esc(n.body)}</small>` : ''}<small class="mono">${esc(fmtLong(n.at))}</small></span>
      ${n.read ? '' : '<span class="ndot"></span>'}</button>`).join('') : ''}
    ${office ? `${mine.length ? `<div class="ac-group">${t('This parish', 'هذه الرعية')}</div>` : ''}${NOTES.map(([ic, txt, when, href, unread], i) => `<button class="notif ${unread ? 'unread' : ''}" data-n="${i}">
      <span class="nico">${icon(ic, 17)}</span>
      <span class="ntxt"><span>${esc(t(...txt))}</span><small class="mono">${esc(t(...when))}</small></span>
      ${unread ? '<span class="ndot"></span>' : ''}</button>`).join('')}` : ''}
    ${!mine.length && !office ? `<p class="dim" style="padding:12px 16px">${t('Nothing new.', 'لا جديد.')}</p>` : ''}</div>
    ${S.role === 'member' ? `<a class="pop-f" href="#/membernotifications">${t('Parish notifications', 'إشعارات الرعية')}</a>` : office && canSee('audit') ? `<a class="pop-f" href="#/audit">${t('See all activity', 'كل النشاط')}</a>` : ''}`,
  { width: 360, onMount(el) {
      el.querySelectorAll('[data-an]').forEach(b => b.addEventListener('click', () => openAccountNote(mine[+b.dataset.an])));
      el.querySelector('#markread').addEventListener('click', () => {
        if (ACCOUNT_NOTES.list.some(n => !n.read)) { ACCOUNT_NOTES.list.forEach(n => { n.read = true; }); api('notifications', 'POST', { op: 'readAll' }).catch(() => {}); }
        if (office) { NOTES.forEach(n => { n[4] = false; }); persist(); }
        el.querySelectorAll('.notif').forEach(n => n.classList.remove('unread'));
        el.querySelectorAll('.ndot').forEach(d => d.remove());
        document.querySelector('.topbar-right .dotmark')?.remove();
        toast(t('All marked read', 'عُلّم الكل كمقروء'), '', 'success');
      });
      el.querySelectorAll('[data-n]').forEach(b => b.addEventListener('click', () => {
        const n = NOTES[+b.dataset.n]; n[4] = false; persist(); closeMenu();
        if (n[3] === 'rate') rateDialog(); else location.hash = n[3];
      }));
      el.querySelector('.pop-f')?.addEventListener('click', () => closeMenu());
  } });
}

/* ---------------- user menu ---------------- */
function userMenu(e) {
  const r = role(), p = me();
  if (S.role === 'member') {
    openPopover(e.currentTarget, `<div class="pop-user">${avatar(p, 'avatar-lg')}<span><b>${esc(isAr() ? p.ar || p.lat : p.lat)}</b><small>${session.user?.username ? `<bdi dir="ltr">${esc(session.user.username)}</bdi>` : t('Parishioner', 'من أبناء الرعية')}</small></span></div><div class="pop-b">
      <button class="mi" data-u="profile">${icon('people',17)}<span>${t('My profile', 'ملفي')}</span></button>
      <button class="mi" data-u="account">${icon('lock',17)}<span>${t('Account and sign-in', 'الحساب وتسجيل الدخول')}</span></button>
      <button class="mi" data-u="lang">${icon('globe',17)}<span>${t('Language', 'اللغة')}</span><span class="mhint">${lang === 'ar' ? 'English' : 'العربية'}</span></button>
      <button class="mi danger" data-u="signout">${icon('arrowR',17)}<span>${t('Sign out', 'تسجيل الخروج')}</span></button></div>`,
      { width:290, onMount(el) { el.querySelectorAll('[data-u]').forEach(b => b.addEventListener('click', () => {
        closeMenu(); if (b.dataset.u === 'profile') go('myprofile');
        else if (b.dataset.u === 'account') go('account');
        else if (b.dataset.u === 'lang') { setLang(lang === 'ar' ? 'en' : 'ar'); renderAll(); }
        else signOut();
      })); } });
    return;
  }
  openPopover(e.currentTarget, `
    <div class="pop-user">${avatar(p, 'avatar-lg')}
      <span><b>${esc(isAr() ? p.ar : p.lat)}</b><small>${esc(t(r.en, r.ar))} · ${esc(t(PARISH.name, PARISH.nameAr))}, ${esc(t(PARISH.town, PARISH.townAr))}</small></span></div>
    <div class="pop-b">
      <button class="mi" data-u="account">${icon('people', 17)}<span>${t('My account', 'حسابي')}</span></button>
      ${session.user?.person_id ? `<button class="mi" data-u="member">${icon('groups', 17)}<span>${t('My parish life', 'حياتي الرعوية')}</span></button>` : ''}
      <button class="mi" data-u="lang">${icon('msg', 17)}<span>${t('Language', 'اللغة')}</span>
        <span class="mhint">${lang === 'ar' ? 'العربية' : 'English'}</span></button>
      ${!['priest','parishadmin','secretary','treasurer','leader'].includes(S.role) ? '' : `<button class="mi" data-u="rate">${icon('give', 17)}<span>${t('Exchange rate', 'سعر الصرف')}</span>
        <span class="mhint mono">${num(RATE.value)}</span></button>
      <button class="mi" data-u="settings">${icon('settings', 17)}<span>${t('Parish settings', 'إعدادات الرعية')}</span></button>`}
      <div class="msep"></div>
      <div class="syncline" style="padding:8px 12px">${saveFailed
        ? `<span class="dot" style="background:var(--danger)"></span>${t('Save failed', 'تعذّر الحفظ')}`
        : `<span class="dot"></span>${t('Connected to parish records', 'متصل بسجلات الرعية')}`}</div>
      <div class="msep"></div>
      <button class="mi danger" data-u="signout">${icon('arrowR', 17)}<span>${t('Sign out', 'تسجيل الخروج')}</span></button>
    </div>`,
  { width: 290, onMount(el) {
      el.querySelectorAll('[data-u]').forEach(b => b.addEventListener('click', () => {
        const u = b.dataset.u; closeMenu();
        if (u === 'lang') { setLang(lang === 'ar' ? 'en' : 'ar'); renderAll(); }
        else if (u === 'rate') rateDialog();
        else if (u === 'assignments') location.hash = '#/assignments';
        else if (u === 'settings') location.hash = '#/settings';
        else if (u === 'account') go('account');
        else if (u === 'member') go('memberhome');
        else if (u === 'signout') signOut();
      }));
  } });
}

/* Signing out lands on the sign-in screen — a new surface, drawn to the same rules. */
async function signOut() {
  if (!confirmPlanNavigation()) return;
  if (!await persist()) return toast(t('Changes were not saved', 'لم تُحفظ التغييرات'), t('Resolve the save error before signing out.', 'عالِج خطأ الحفظ قبل تسجيل الخروج.'), 'danger');
  closeOverlays(); await api('logout', 'POST', {}).catch(() => {});   // an empty JSON object: both servers refuse a bodiless write
  session.user = null; session.parishes = []; session.parishId = null; session.csrf = '';
  loginScreen();
}

/* ---------------- parish / archdiocese switcher ---------------- */
async function switchParish(id) {
  const x = session.parishes.find(q => q.id === id);
  if (!x || x.id === session.parishId) return false;
  if (!confirmPlanNavigation()) return false;
  if (!await persist()) {
    toast(t('Changes were not saved', 'لم تُحفظ التغييرات'), t('Resolve the save error before switching parishes.', 'عالِج خطأ الحفظ قبل تبديل الرعية.'), 'danger');
    return false;
  }
  const previous = session.parishId, previousRole = S.role;
  session.parishId = x.id;
  try {
    S.role = currentRole();
    await hydrate(); closeOverlays();
    if (!allowed(S.route)) { S.route = ROLES[S.role]?.nav.find(n => n[0] === 'l')?.[1] || 'account'; S.params = []; history.replaceState(null, '', '#/' + S.route); }
    renderAll();
    toast(t(`Now working in ${x.name}`, `تعمل الآن في ${x.ar}`), t(`Your role here: ${x.role}`, `دورك هنا: ${x.roleAr}`), 'success');
    return true;
  } catch (e) {
    session.parishId = previous; S.role = previousRole; await hydrate().catch(() => {});
    toast(t('Parish could not be opened', 'تعذّر فتح الرعية'), e.message, 'danger');
    return false;
  }
}
bus.switchParish = switchParish;
/* After the account's parish connections change: read the session again; the open workspace stays unless it is gone. */
bus.reloadSession = async () => {
  const before = session.parishId, role = S.role;
  await loadSession();
  if (!before) session.parishId = session.parishes.find(p => p.id === before)?.id || null;
  S.role = currentRole();
  if (S.role !== role || session.parishId !== before) { await hydrate(); renderAll(); }
};

/* An account may work in several places: each parish it serves or belongs to, and administration
   that is not tied to one parish (the super admin, a diocesan admin). */
async function openAdministrationOnly() {
  if (!confirmPlanNavigation() || !await persist()) return;
  session.parishId = null; S.role = currentRole();
  await hydrate(); closeOverlays(); S.route = 'administration'; S.params = [];
  history.replaceState(null, '', '#/administration'); renderAll();
}
function parishSwitcher() {
  const adminOnly = session.authority?.superadmin || (session.authority?.dioceses || []).some(d => d.role === 'diocesanadmin');
  if (S.role === 'bishop' && !adminOnly && session.parishes.every(x => x.roleCode === 'bishop')) { location.hash = '#/oversight'; return; }
  openDrawer({
    title: t('Switch workspace', 'تبديل مساحة العمل'),
    sub: t('Your role depends on the place. Records never cross between parishes.',
           'دورك يتبع المكان. ولا تعبر السجلات بين الرعايا أبداً.'),
    body: `${adminOnly ? `<button class="ac-opt" data-admin-only>
        <span class="avatar">${icon('shield', 16)}</span>
        <span><b>${t('Administration', 'الإدارة')}</b><small>${esc(session.authority?.superadmin ? t('Super admin', 'المدير العام') : t('Diocesan admin', 'إداري الأبرشية'))}</small></span>
        ${!session.parishId ? `<span style="margin-inline-start:auto;color:var(--primary)">${icon('check', 16)}</span>` : ''}</button>` : ''}
      ${session.parishes.length ? `<div class="ac-group" style="padding-inline:0">${t('Parishes', 'الرعايا')}</div>` : ''}
      ${session.parishes.map(x => `<button class="ac-opt" data-parish="${x.id}">
        <span class="avatar">${esc(t(x.name, x.ar).slice(0, 1))}</span>
        <span><b>${esc(t(x.name, x.ar))}</b><small>${esc(t(x.town, x.townAr))} · ${esc(t(x.role, x.roleAr))}</small></span>
        ${x.id === session.parishId ? `<span style="margin-inline-start:auto;color:var(--primary)">${icon('check', 16)}</span>` : ''}</button>`).join('')}
      <div class="divider"></div>
      ${S.role === 'bishop' ? `<a class="listrow" href="#/bishopeparchy" style="padding-inline:0">${icon('portal', 17, 'dimmer')}
        <span class="grow"><b>${t('Eparchy view', 'عرض الأبرشية')}</b>
          <small>${t('All parishes in this archdiocese', 'كل رعايا هذه الأبرشية')}</small></span>${icon('chevR', 15)}</a>` : ''}`,
    foot: `<button class="btn btn-secondary" data-close>${t('Close', 'إغلاق')}</button>`,
    onMount(el) {
      el.querySelectorAll('[data-parish]').forEach(b => b.addEventListener('click', () => switchParish(b.dataset.parish)));
      el.querySelector('[data-admin-only]')?.addEventListener('click', openAdministrationOnly);
    }
  });
}

/* ---------------- router ---------------- */
function route() {
  const raw = location.hash.replace(/^#\/?/, '');
  const current = [S.route,...S.params].filter(Boolean).join('/');
  if (current && raw !== current && planDirty() && !confirmPlanNavigation()) {
    location.hash = '#/' + current; return;
  }
  const [id, ...params] = raw.split('/').filter(Boolean);
  const target = ROUTES[id] ? id : ROLES[S.role].nav.find(n => n[0] === 'l')[1];

  if (!allowed(target)) {
    S.route = ROLES[S.role].nav.find(n => n[0] === 'l')[1]; S.params = [];
    /* "home" simply means this role's first page; anything else was a real attempt, so say where they landed */
    if (target !== 'dashboard') toast(t('Not part of your role', 'ليس ضمن دورك'),
      t(`You have been taken to ${ROUTES[S.route].en}.`, `نُقلت إلى ${ROUTES[S.route].ar}.`), 'warning');
  } else { S.route = target; S.params = params; }
  closeOverlays();
  if (document.querySelector('.rail')) { updateRail(); renderView(); }
  else renderAll();
}

document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
  if (e.key === 'Escape') closePalette();
});
/* Every change re-renders through the bus, so that is where the parish is saved. */
bus.refresh = () => { renderView({ keepScroll: true }); updateBadges(); persist(); };
bus.renderAll = () => { renderAll(); persist(); };
addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
window.addEventListener('hashchange', route);
document.addEventListener('parish-save-error', e => toast(t('Changes were not saved', 'لم تُحفظ التغييرات'), e.detail, 'danger'));
setLang(lang);
(async () => {
  try {
    await loadSession(); pickParish(); S.role = currentRole(); await hydrate(); if (S.role === 'bishop') S.route = 'oversight'; renderAll(); route();
    if (AUTH.invite) acceptInvite().then(() => { if (S.route === 'home') renderAll(); else location.hash = '#/home'; });
    if (AUTH.linked) toast(t(`${PROVIDER_NAMES[AUTH.linked] || AUTH.linked} is now linked`, `أصبح ${PROVIDER_NAMES[AUTH.linked] || AUTH.linked} مرتبطاً`), t('You can sign in with it from now on.', 'يمكنك تسجيل الدخول به من الآن.'), 'success');
    if (AUTH.auth_error) toast(t('Not linked', 'لم يتمّ الربط'), (AUTH_ERRORS[AUTH.auth_error] || AUTH_ERRORS.failed)(PROVIDER_NAMES[AUTH.provider] || t('the provider', 'المزوّد')), 'danger');
  }
  catch (error) { session.user = null; loginScreen(error.status === 401 ? '' : error.message); }
})();
