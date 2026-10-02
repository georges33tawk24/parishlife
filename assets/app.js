/* ParishLife application shell. Views render HTML strings into the content well;
   the server owns authentication, parish access, and authoritative records. */
import { icon } from './icons.js';
import { t, isAr, lang, setLang, num, fmtLong, matches } from './i18n.js';
import { PARISH, PARISHES, RATE, TODAY, PEOPLE, PHOTOS, person, initials } from './data.js';
import * as D from './data.js';
import { closeOverlays, toast, openModal, openDrawer, esc, avatar, catchAll, openPopover, closeMenu } from './ui.js';
import { S, ROLES, MOBILE_NAV, role, me, canSee, go, save, bus } from './store.js';
import { wireActions } from './actions.js';
import { hydrate, persist, saveFailed } from './persist.js';
import { api, loadSession, session } from './api.js';
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

/* ---------------- routes ---------------- */
export const ROUTES = {
  oversight:    { ico:'portal', en:'Parish oversight', ar:'الإشراف على الرعايا', view:Oversight.oversight },
  dashboard:    { ico:'dash',     en:'Dashboard',        ar:'لوحة القيادة',        view:Dashboard.dashboard },
  people:       { ico:'people',   en:'People',           ar:'المؤمنون',            view:People.people,      badge:() => num(D.PEOPLE.length) },
  person:       { ico:'people',   en:'Person',           ar:'سجلّ شخص',            view:People.personView,  hidden:true },
  households:   { ico:'family',   en:'Households',       ar:'العائلات',            view:People.households,  badge:() => D.HOUSEHOLDS.length },
  sacraments:   { ico:'sacr',     en:'Sacraments',       ar:'الأسرار',             view:Records.sacraments, badge:() => D.SACRAMENTS.filter(x => x.status === 'awaiting-signature').length },
  requests:     { ico:'doc',      en:'Requests',         ar:'الطلبات',             view:Records.requests, badge:() => D.SACRAMENTS.filter(x => x.kind === 'certificate'
      ? ['draft','awaiting-signature','approved'].includes(x.status)
      : ['draft','completed','awaiting-signature'].includes(x.status)).length
      + D.CORRECTIONS.filter(x => x.status === 'awaiting-approval').length
      + D.RESERVATIONS.filter(x => x.status === 'pending').length
      + D.SERVICE_REQUESTS.filter(x => ['pending','awaiting-approval'].includes(x.status)).length
      + D.PORTAL_REQUESTS.length + D.REGISTRATIONS.filter(x => x.waiting > 0).length },
  certificate:  { ico:'doc',      en:'Certificate',      ar:'شهادة',               view:Records.certificate, hidden:true },
  notes:        { ico:'notes',    en:'Pastoral notes',   ar:'ملاحظات رعوية',       view:Pastoral.notes },

  calendar:     { ico:'events',   en:'Calendar',         ar:'الرزنامة',            view:Parish.calendar },
  services:     { ico:'service',  en:'Service planning', ar:'تخطيط الخدم',         view:Parish.services },
  groups:       { ico:'groups',   en:'Groups',           ar:'المجموعات',           view:Parish.groups,      badge:() => D.GROUPS.length },
  volunteers:   { ico:'vol',      en:'Volunteers',       ar:'المتطوّعون',           view:Parish.volunteers,  badge:() => D.ROTA.teams.flatMap(t => t.filled).filter(f => !f.p || f.s === 'declined').length },
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
  children:     { ico:'family',   en:'Participants checked in', ar:'المشتركون الحاضرون',    view:Parish.checkin,
                  badge:() => Object.values(D.CHECKIN.sessions||{}).reduce((n, session) => n + (session.rows?.length||0), 0) },
  eparchy:      { ico:'portal',   en:'Eparchy',          ar:'الأبرشية',            view:Admin.eparchy },
  assignments:  { ico:'shield',   en:'Priest assignments', ar:'تعيينات الكهنة', view:Admin.assignments },
  household:    { ico:'family',   en:'Household',         ar:'العائلة',             view:People.householdView, hidden:true },
  styleguide:   { ico:'doc',      en:'Design system',    ar:'نظام التصميم',        view:Admin.styleguide }
};

export { S as state, ROLES, me, go };
/* Detail views (a person, a certificate, the design system) are reachable from
   whatever module linked to them, so they ride on their parent's permission. */
const DETAIL_PARENT = { person: 'people', household: 'households', certificate: 'sacraments', children: 'checkin' };
export const allowed = id => canSee(id) || !!(DETAIL_PARENT[id] && canSee(DETAIL_PARENT[id]));

/* ---------------- shell ---------------- */
function railHTML() {
  const r = role();
  const items = r.nav.map(n => {
    if (n[0] === 'h') return `<div class="navgroup">${esc(t(n[1], n[2]))}</div>`;
    const rt = ROUTES[n[1]];
    if (!rt) return '';
    const on = S.route === n[1];
    return `<a class="navitem ${on ? 'on' : ''}" href="#/${n[1]}" ${on ? 'aria-current="page"' : ''}>
      ${icon(rt.ico, 18)}<span class="nl">${esc(t(rt.en, rt.ar))}</span>
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
      ${S.role === 'bishop' ? '' : `<button class="iconbtn" id="bellbtn" aria-label="${t('Notifications', 'الإشعارات')}">
        ${icon('bell', 19)}<span class="dotmark"></span></button>`}
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
  const ids = MOBILE_NAV[S.role] || [];
  return `<nav class="mobilebar" aria-label="${t('Sections', 'الأقسام')}">${ids.map(id => {
    const rt = ROUTES[id]; if (!rt) return '';
    const on = S.route === id;
    return `<button data-go="${id}" ${on ? 'aria-current="page"' : ''}>${icon(rt.ico, 20)}
      <span>${esc(t(rt.en, rt.ar))}</span></button>`;
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

function loginScreen(error = '') {
  app.className = 'signin';
  app.innerHTML = `<div class="signin-art"><div class="brandrow"><span class="seal">P</span><span>ParishLife</span></div>
    <div><h1>${t('Parish administration for your community.', 'إدارة الرعية لخدمة جماعتكم.')}</h1><p style="font-family:var(--arabic)">حياة الرعية</p></div>
    <div class="swatches"><i style="background:#3D4161;border:1px solid #DCEEFF"></i><i style="background:#DCEEFF"></i><i style="background:#FFFFFF"></i><i style="background:var(--yellow)"></i><i style="background:var(--brown)"></i></div></div>
    <div class="signin-form"><form id="signform" novalidate><h2>${t('Sign in', 'تسجيل الدخول')}</h2>
      <p class="dim" style="margin:6px 0 24px">${t('Use the account created by your administrator.', 'استخدم الحساب الذي أنشأه المسؤول.')}</p>
      ${error ? `<div class="alert alert-danger" role="alert">${esc(error)}</div>` : ''}
      <div class="formrow"><label class="label" for="si_u">${t('Username', 'اسم المستخدم')}</label><input class="input" id="si_u" required autocomplete="username"></div>
      <div class="formrow"><label class="label" for="si_p">${t('Password', 'كلمة المرور')}</label><input class="input" id="si_p" type="password" required autocomplete="current-password"></div>
      <button class="btn btn-primary btn-touch" style="width:100%" type="submit">${t('Sign in', 'تسجيل الدخول')}</button>
      <div class="langswap" role="group" style="margin:20px auto 0;width:max-content"><button type="button" data-login-lang="en">EN</button><button type="button" data-login-lang="ar">ع</button></div>
    </form></div>`;
  app.querySelectorAll('[data-login-lang]').forEach(b => b.addEventListener('click', () => { setLang(b.dataset.loginLang); loginScreen(); }));
  app.querySelector('#signform').addEventListener('submit', async e => {
    e.preventDefault(); const button = e.target.querySelector('[type=submit]'); button.disabled = true;
    try {
      await api('login', 'POST', { username: e.target.querySelector('#si_u').value.trim(), password: e.target.querySelector('#si_p').value });
      await loadSession();
      S.role = session.user.role; await hydrate(); S.route = S.role === 'bishop' ? 'oversight' : (ROLES[S.role]?.nav.find(n => n[0] === 'l')?.[1] || 'dashboard');
      location.hash = '#/' + S.route; renderAll();
    } catch (error) { loginScreen(error.message); }
  });
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
  const host = document.getElementById('view');
  const well = document.getElementById('well'), y = well?.scrollTop || 0;
  host.innerHTML = rt.view(...S.params) || '';
  (rt.mount || rt.view.mount)?.(host, ...S.params);
  host.querySelectorAll('[data-go]').forEach(el =>
    el.addEventListener('click', e => { e.preventDefault(); go(el.dataset.go); }));
  wireActions(host);
  catchAll(host);
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
  ['Print my week', 'اطبع أسبوعي', 'print', '#/calendar'],
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
  const acts = S.role === 'bishop' ? [] : ACTIONS.filter(a => matches(a[0] + ' ' + a[1], q));
  const ppl = (q ? PEOPLE.filter(p => matches(`${p.lat} ${p.ar} ${p.phone}`, q)) : PEOPLE.slice(0, 3)).slice(0, 5);
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
    (!acts.length && !pages.length && !ppl.length ? `<div class="ac-none">${t('Nothing matches.', 'لا نتيجة.')}</div>` : '');

  res.querySelector('.ac-opt')?.setAttribute('aria-selected', 'true');
  res.querySelectorAll('[data-href]').forEach(b => b.addEventListener('click', () => {
    closePalette(); location.hash = b.dataset.href;
  }));
}

/* ---------------- notifications ---------------- */
const NOTES = D.NOTIFICATIONS;
function notifications(e) {
  openPopover(e.currentTarget, `
    <div class="pop-h"><b>${t('Notifications', 'الإشعارات')}</b>
      <button class="btn btn-ghost btn-dense" id="markread" style="margin-inline-start:auto">${t('Mark all read', 'تعليم الكل كمقروء')}</button></div>
    <div class="pop-b">${NOTES.map(([ic, txt, when, href, unread], i) => `<button class="notif ${unread ? 'unread' : ''}" data-n="${i}">
      <span class="nico">${icon(ic, 17)}</span>
      <span class="ntxt"><span>${esc(t(...txt))}</span><small class="mono">${esc(t(...when))}</small></span>
      ${unread ? '<span class="ndot"></span>' : ''}</button>`).join('')}</div>
    <a class="pop-f" href="#/audit">${t('See all activity', 'كل النشاط')}</a>`,
  { width: 360, onMount(el) {
      el.querySelector('#markread').addEventListener('click', () => {
        NOTES.forEach(n => { n[4] = false; }); persist();
        el.querySelectorAll('.notif').forEach(n => n.classList.remove('unread'));
        el.querySelectorAll('.ndot').forEach(d => d.remove());
        document.querySelector('.topbar-right .dotmark')?.remove();
        toast(t('All marked read', 'عُلّم الكل كمقروء'), '', 'success');
      });
      el.querySelectorAll('[data-n]').forEach(b => b.addEventListener('click', () => {
        const n = NOTES[+b.dataset.n]; n[4] = false; persist(); closeMenu();
        if (n[3] === 'rate') rateDialog(); else location.hash = n[3];
      }));
      el.querySelector('.pop-f').addEventListener('click', () => closeMenu());
  } });
}

/* ---------------- user menu ---------------- */
function userMenu(e) {
  const r = role(), p = me();
  openPopover(e.currentTarget, `
    <div class="pop-user">${avatar(p, 'avatar-lg')}
      <span><b>${esc(isAr() ? p.ar : p.lat)}</b><small>${esc(t(r.en, r.ar))} · ${esc(t(PARISH.name, PARISH.nameAr))}, ${esc(t(PARISH.town, PARISH.townAr))}</small></span></div>
    <div class="pop-b">
      <button class="mi" data-u="account">${icon('people', 17)}<span>${t('My account', 'حسابي')}</span></button>
      <button class="mi" data-u="lang">${icon('msg', 17)}<span>${t('Language', 'اللغة')}</span>
        <span class="mhint">${lang === 'ar' ? 'العربية' : 'English'}</span></button>
      ${S.role === 'bishop' ? '' : `<button class="mi" data-u="rate">${icon('give', 17)}<span>${t('Exchange rate', 'سعر الصرف')}</span>
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
        else if (u === 'account') accountDrawer();
        else if (u === 'signout') signOut();
      }));
  } });
}

function accountDrawer() {
  const p = me(), r = role();
  openDrawer({
    title: t('My account', 'حسابي'), sub: `${esc(isAr() ? p.ar : p.lat)} · ${esc(t(r.en, r.ar))}`,
    body: `<div class="row" style="gap:14px;margin-bottom:18px">${avatar(p, 'avatar-xl')}
        <div><b style="font:600 17px/24px var(--sans)">${esc(p.lat)}</b><div style="font:400 15px/24px var(--arabic);color:var(--text-2)">${esc(p.ar)}</div></div></div>
      <div class="ac-group" style="padding-inline:0">${t('Language', 'اللغة')}</div>
      <div class="langswap" role="group">
        <button data-lang="en" aria-pressed="${lang === 'en'}">English</button>
        <button data-lang="ar" aria-pressed="${lang === 'ar'}" lang="ar">العربية</button></div>`,
    foot: `<button class="btn btn-secondary" data-close>${t('Close', 'إغلاق')}</button>`,
    onMount(el) {
      el.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => { setLang(b.dataset.lang); closeOverlays(); renderAll(); }));
    }
  });
}

/* Signing out lands on the sign-in screen — a new surface, drawn to the same rules. */
async function signOut() {
  if (!confirmPlanNavigation()) return;
  if (!await persist()) return toast(t('Changes were not saved', 'لم تُحفظ التغييرات'), t('Resolve the save error before signing out.', 'عالِج خطأ الحفظ قبل تسجيل الخروج.'), 'danger');
  closeOverlays(); await api('logout', 'POST').catch(() => {});
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
  const previous = session.parishId;
  session.parishId = x.id;
  try {
    await hydrate(); closeOverlays(); renderAll();
    toast(t(`Now working in ${x.name}`, `تعمل الآن في ${x.ar}`), t(`Your role here: ${x.role}`, `دورك هنا: ${x.roleAr}`), 'success');
    return true;
  } catch (e) {
    session.parishId = previous; await hydrate().catch(() => {});
    toast(t('Parish could not be opened', 'تعذّر فتح الرعية'), e.message, 'danger');
    return false;
  }
}
bus.switchParish = switchParish;

function parishSwitcher() {
  if (S.role === 'bishop') { location.hash = '#/oversight'; return; }
  openDrawer({
    title: t('Switch parish', 'تبديل الرعية'),
    sub: t('You hold a role in more than one parish. Records never cross between them.',
           'لديك دور في أكثر من رعية. ولا تعبر السجلات بينها أبداً.'),
    body: `<div class="ac-group" style="padding-inline:0">${t(PARISH.eparchy, PARISH.eparchyAr)}</div>
      ${PARISHES.map(x => `<button class="ac-opt" data-parish="${x.id}">
        <span class="avatar">${esc(t(x.name, x.ar).slice(0, 1))}</span>
        <span><b>${esc(t(x.name, x.ar))}</b><small>${esc(t(x.town, x.townAr))} · ${esc(t(x.role, x.roleAr))}</small></span>
        ${x.name === PARISH.name ? `<span style="margin-inline-start:auto;color:var(--primary)">${icon('check', 16)}</span>` : ''}</button>`).join('')}
      <div class="divider"></div>
      ${S.role === 'bishop' ? `<a class="listrow" href="#/eparchy" style="padding-inline:0">${icon('portal', 17, 'dimmer')}
        <span class="grow"><b>${t('Eparchy view', 'عرض الأبرشية')}</b>
          <small>${t('All parishes in this archdiocese', 'كل رعايا هذه الأبرشية')}</small></span>${icon('chevR', 15)}</a>` : ''}`,
    foot: `<button class="btn btn-secondary" data-close>${t('Close', 'إغلاق')}</button>`,
    onMount(el) {
      el.querySelectorAll('[data-parish]').forEach(b => b.addEventListener('click', () => switchParish(b.dataset.parish)));
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
  try { await loadSession(); S.role = session.user.role; await hydrate(); if (S.role === 'bishop') S.route = 'oversight'; renderAll(); route(); }
  catch (error) { session.user = null; loginScreen(error.status === 401 ? '' : error.message); }
})();
