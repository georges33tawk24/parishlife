/* Administration: dioceses, parishes, staff appointments and permissions, clergy titles and
   assignments, and access. Every list and every action is limited by the server to the
   account's own authority; the screen only offers what that authority allows. */
import { api, session } from '../api.js';
import { t, fmtDate } from '../i18n.js';
import { S, bus, ROLES } from '../store.js';
import { pageHead, tabBar, panel, table, esc, empty, pill, openDrawer, openModal, closeOverlays, toast, stat } from '../ui.js';
import { icon } from '../icons.js';
import * as C from '../components.js';

const L = (en, ar) => t(en, ar);
const state = { data: null, loading: false, error: '', loadedAt: 0 };
async function load(force = false) {
  if (state.loading || (!force && state.data && Date.now() - state.loadedAt < 30_000)) return;
  state.loading = true;
  try { state.data = await api('admin'); state.error = ''; }
  catch (e) { state.error = e.message; }
  finally { state.loading = false; state.loadedAt = Date.now(); bus.refresh(); }
}
async function act(body, success) {
  const result = await api('admin', 'POST', body);
  await load(true);
  if (success) toast(success, '', 'success');
  return result;
}

/* ---------- names ---------- */
const D = () => state.data;
const userName = id => D().users[id]?.name || L('Unknown account', 'حساب غير معروف');
const userLine = id => id ? `<b>${esc(userName(id))}</b><small class="dim" style="display:block" dir="ltr">${esc(D().users[id]?.username || '')}</small>` : '—';
const dioceseName = id => { const d = D().dioceses.find(x => x.id === id); return d ? L(d.name, d.nameAr || d.name) : id; };
const parishName = id => { const p = D().parishes.find(x => x.id === id); return p ? L(p.name, p.nameAr || p.name) : id; };
const roleName = code => { const r = D().catalog.roles[code]; return r ? L(r[0], r[1]) : code; };
const placeName = (scope, id) => scope === 'system' ? L('All of ParishLife', 'كامل ParishLife') : scope === 'diocese' ? dioceseName(id) : parishName(id);
const permName = code => { const p = D().catalog.permissions.find(x => x.code === code); return p ? L(p.en, p.ar) : code; };
const when = at => at ? fmtDate(String(at).slice(0, 10)) : '—';
const has = (list, perm) => (list || []).includes(perm);

/* Where this account may do what (the server checks again). */
const may = {
  createDiocese: () => has(D().system, 'dioceses.manage'),
  parishDioceses: () => D().dioceses.filter(d => has(d.perms, 'parishes.create')),
  clergyDioceses: () => D().dioceses.filter(d => has(d.perms, 'clergy.assign')),
  staffParishes: () => D().parishes.filter(p => has(p.perms, 'staff.manage')),
  staffDioceses: () => D().dioceses.filter(d => has(d.perms, 'diocese.staff') && (has(D().system, 'dioceses.manage') || session.authority?.dioceses?.some(x => x.id === d.id && x.role === 'bishop'))),
  accessParishes: () => D().parishes.filter(p => has(p.perms, 'access.manage')),
  accessDioceses: () => D().dioceses.filter(d => has(d.perms, 'access.manage') && (has(D().system, 'dioceses.manage') || session.authority?.dioceses?.some(x => x.id === d.id))),
  global: () => has(D().system, 'accounts.global'),
  titles: did => has(D().dioceses.find(d => d.id === did)?.perms, 'clergy.title')
};
const scopePerms = (scope, id) => scope === 'parish' ? D().parishes.find(p => p.id === id)?.perms || []
  : scope === 'diocese' ? D().dioceses.find(d => d.id === id)?.perms || [] : D().system;

function tabs() {
  const d = D();
  return [['', 'Overview', 'نظرة عامة'],
    ...(may.createDiocese() || d.dioceses.length ? [['dioceses', 'Dioceses', 'الأبرشيات', d.dioceses.length]] : []),
    ...(d.parishes.length || may.parishDioceses().length ? [['parishes', 'Parishes', 'الرعايا', d.parishes.length]] : []),
    ['staff', 'Staff & permissions', 'العاملون والصلاحيات', d.assignments.filter(a => a.status === 'active').length],
    ...(d.clergy.length || may.clergyDioceses().length ? [['clergy', 'Clergy', 'الإكليروس', d.clergy.length]] : []),
    ['access', 'Access', 'الوصول', d.blocks.filter(b => !b.liftedAt).length]];
}

export function administration(tab = '') {
  const head = pageHead({
    crumbs: [{ label: L('Administration', 'الإدارة') }],
    title: L('Administration', 'الإدارة'),
    sub: L('Dioceses, parishes, appointments, clergy and access — only within your own authority.',
           'الأبرشيات والرعايا والتعيينات والإكليروس والوصول — ضمن صلاحيتك فقط.')
  });
  if (!D()) return head + (state.error ? `<p class="alert alert-danger" role="alert">${esc(state.error)}</p>` : `<p role="status" class="dim" style="margin-top:18px">${L('Loading administration…', 'جارٍ تحميل الإدارة…')}</p>`);
  const items = tabs();
  if (!items.some(x => x[0] === tab)) tab = '';
  const body = { '': overview, dioceses, parishes, staff, clergy, access }[tab]();
  return head + tabBar('administration', items, tab) + `<div class="tabbody admin-console">${body}</div>`;
}

/* ---------- overview ---------- */
function overview() {
  const d = D(), a = session.authority || {};
  const roles = [
    ...(a.superadmin ? [[L('Super admin', 'المدير العام'), L('All of ParishLife', 'كامل ParishLife')]] : []),
    ...(a.dioceses || []).map(x => [roleName(x.role), L(x.name, x.nameAr || x.name)]),
    ...session.parishes.filter(p => !['member', 'follower', 'bishop'].includes(p.roleCode)).map(p => [L(p.role, p.roleAr), L(p.name, p.ar)])
  ];
  return `<div class="stats" style="margin:4px 0 20px">
      ${stat(L('Dioceses', 'الأبرشيات'), d.dioceses.length)}${stat(L('Parishes', 'الرعايا'), d.parishes.length)}
      ${stat(L('Active appointments', 'تعيينات قائمة'), d.assignments.filter(x => x.status === 'active').length)}
      ${stat(L('Access deactivated', 'وصول موقوف'), d.blocks.filter(b => !b.liftedAt).length)}</div>
    <div class="grid g2">
      ${panel(L('Your authority', 'صلاحيتك'), roles.length ? `<ul class="admin-list">${roles.map(([r, place]) => `<li>${icon('shield', 16, 'dimmer')}<span><b>${esc(r)}</b><small>${esc(place)}</small></span></li>`).join('')}</ul>`
        : `<p class="dim">${L('No administrative role.', 'لا دور إداري.')}</p>`)}
      ${panel(L('Rules no permission can change', 'قواعد لا تغيّرها أي صلاحية'), `<ul class="admin-list">
        ${[[L('Only a priest signs official sacramental documents.', 'وحده الكاهن يوقّع وثائق الأسرار الرسمية.'), 'sacr'],
           [L('Only the bishop changes a clergy title.', 'وحده المطران يغيّر لقب أحد الإكليروس.'), 'shield'],
           [L('Pastoral notes stay with their author unless the author shares them with the parish priests.', 'تبقى الملاحظات الرعوية لكاتبها ما لم يشاركها مع كهنة الرعية.'), 'notes'],
           [L('Complaints reach only the people their author chose.', 'لا تصل الشكاوى إلا إلى من اختارهم مقدّمها.'), 'lock'],
           [L('Private messages stay with their participants; an emergency review is recorded with its reason.', 'تبقى الرسائل الخاصة لأطرافها؛ وتُسجَّل المراجعة الطارئة مع سببها.'), 'msg'],
           [L('No one hands on a permission they do not hold, or appoints someone at or above their own role.', 'لا أحد يمنح صلاحية لا يملكها، ولا يعيّن أحداً في مستوى دوره أو أعلى.'), 'people']]
          .map(([x, i]) => `<li>${icon(i, 16, 'dimmer')}<span>${esc(x)}</span></li>`).join('')}</ul>`)}
    </div>`;
}

/* ---------- dioceses ---------- */
function dioceses() {
  const d = D();
  const rows = d.dioceses.map(x => ({ cells: [
    `<b>${esc(x.name)}</b>${x.nameAr ? `<small class="dim" style="display:block" dir="rtl">${esc(x.nameAr)}</small>` : ''}`,
    x.bishops.length ? x.bishops.map(userLine).join('') : `<span class="dim">${L('No bishop yet', 'لا مطران بعد')}</span>`,
    String(d.parishes.filter(p => p.diocese === x.id).length),
    may.createDiocese() && !x.bishops.length ? `<button class="btn btn-secondary btn-dense" data-provision="${esc(x.id)}">${icon('plus', 15)}${L('Provision first bishop', 'تجهيز حساب المطران الأول')}</button>` : ''] }));
  return `${may.createDiocese() ? `<div class="toolbar" style="margin-bottom:16px"><button class="btn btn-primary" id="adm-new-diocese">${icon('plus', 16)}${L('New diocese', 'أبرشية جديدة')}</button></div>` : ''}
    ${table({ id: 'adm-dioceses', cols: [{ label: L('Diocese', 'الأبرشية') }, { label: L('Bishop', 'المطران') }, { label: L('Parishes', 'الرعايا'), cls: 'shrink' }, { label: '', cls: 'shrink' }], rows,
      empty: empty('portal', L('No dioceses yet', 'لا أبرشيات بعد'), L('The super admin creates each diocese, then provisions its first bishop account.', 'ينشئ المدير العام كل أبرشية، ثم يجهّز حساب مطرانها الأول.')) })}`;
}

/* ---------- parishes ---------- */
function parishes() {
  const d = D();
  const rows = d.parishes.map(p => ({ cells: [
    `<b>${esc(p.name)}</b>${p.nameAr ? `<small class="dim" style="display:block" dir="rtl">${esc(p.nameAr)}</small>` : ''}`,
    esc(L(p.town, p.townAr || p.town)), esc(dioceseName(p.diocese)),
    `<span class="row" style="gap:4px;flex-wrap:wrap">${['staff.manage', 'access.manage', 'finance.view', 'settings.manage'].filter(x => has(p.perms, x)).map(x => `<span class="chip">${esc(permName(x))}</span>`).join('')}</span>`] }));
  return `${may.parishDioceses().length ? `<div class="toolbar" style="margin-bottom:16px"><button class="btn btn-primary" id="adm-new-parish">${icon('plus', 16)}${L('New parish', 'رعية جديدة')}</button></div>` : ''}
    ${table({ id: 'adm-parishes', cols: [{ label: L('Parish', 'الرعية') }, { label: L('Town', 'البلدة') }, { label: L('Diocese', 'الأبرشية') }, { label: L('Your authority here', 'صلاحيتك هنا'), cls: 'hide-sm' }], rows })}`;
}

/* ---------- staff & permissions ---------- */
function staff() {
  const d = D(), filter = S.ui.admStaffPlace || '';
  const active = d.assignments.filter(a => a.status === 'active' && (!filter || `${a.scope}:${a.scopeId}` === filter));
  const places = [...new Map(d.assignments.filter(a => a.status === 'active').map(a => [`${a.scope}:${a.scopeId}`, placeName(a.scope, a.scopeId)])).entries()];
  const adjusted = a => a.grants.length || a.revokes.length;
  const rows = active.map(a => ({ attrs: `data-assignment="${esc(a.id)}"`, cells: [
    userLine(a.userId), `<b>${esc(roleName(a.role))}</b>`, esc(placeName(a.scope, a.scopeId)), when(a.createdAt),
    adjusted(a) ? pill(L(`${a.grants.length} added · ${a.revokes.length} removed`, `${a.grants.length} مضافة · ${a.revokes.length} مزالة`), 'info', false) : `<span class="dim">${L('Standard', 'قياسية')}</span>`,
    `<button class="btn btn-secondary btn-dense" data-open-assignment="${esc(a.id)}">${L('Open', 'فتح')}</button>`] }));
  const canAppoint = may.staffParishes().length || may.staffDioceses().length;
  return `<div class="toolbar" style="margin-bottom:16px;gap:10px;flex-wrap:wrap">
      ${canAppoint ? `<button class="btn btn-primary" id="adm-appoint">${icon('plus', 16)}${L('Appoint someone', 'تعيين شخص')}</button>` : ''}
      <label class="sr" for="adm-staff-place">${L('Place', 'المكان')}</label>
      <select class="select" id="adm-staff-place" style="max-width:320px"><option value="">${L('All places', 'كل الأماكن')}</option>
        ${places.map(([k, v]) => `<option value="${esc(k)}" ${k === filter ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
    ${table({ id: 'adm-staff', cols: [{ label: L('Person', 'الشخص') }, { label: L('Role', 'الدور') }, { label: L('Place', 'المكان') }, { label: L('Since', 'منذ'), cls: 'hide-sm' },
      { label: L('Permissions', 'الصلاحيات'), cls: 'hide-sm' }, { label: '', cls: 'shrink' }], rows,
      empty: empty('people', L('No appointments here', 'لا تعيينات هنا'), L('Appointments within your authority appear here.', 'تظهر هنا التعيينات ضمن صلاحيتك.')) })}
    <p class="help" style="margin-top:14px">${L('A priest’s access follows their clergy assignment (Clergy tab). A role starts with its standard permissions; adjust them from the appointment.',
      'صلاحية الكاهن تتبع تعيينه في الإكليروس (تبويب الإكليروس). يبدأ كل دور بصلاحياته القياسية، ويمكن تعديلها من التعيين.')}</p>`;
}

/* ---------- clergy ---------- */
function clergy() {
  const d = D();
  const current = x => x.services.filter(s => !s.endDate);
  const rows = d.clergy.map(x => ({ cells: [
    `<b>${esc(x.name)}</b>${x.nameAr ? `<small class="dim" style="display:block" dir="rtl">${esc(x.nameAr)}</small>` : ''}`,
    esc(x.title ? L(x.title, TITLE_AR[x.title] || x.title) : '—'), esc(dioceseName(x.diocese)),
    current(x).length ? current(x).map(s => `<span style="display:block">${esc(parishName(s.parishId))} · ${esc(officeName(s.office))}</span>`).join('') : `<span class="dim">${L('No current service', 'لا خدمة حالية')}</span>`,
    x.userId ? `<span class="dim">${esc(D().users[x.userId]?.username || '')}</span>` : `<span class="dim">${L('No account', 'بلا حساب')}</span>`,
    `<button class="btn btn-secondary btn-dense" data-clergy="${esc(x.id)}">${L('Open', 'فتح')}</button>`] }));
  return `${may.clergyDioceses().length ? `<div class="toolbar" style="margin-bottom:16px"><button class="btn btn-primary" id="adm-new-clergy">${icon('plus', 16)}${L('Register clergy', 'تسجيل أحد الإكليروس')}</button></div>` : ''}
    ${table({ id: 'adm-clergy', cols: [{ label: L('Name', 'الاسم') }, { label: L('Title', 'اللقب') }, { label: L('Diocese', 'الأبرشية'), cls: 'hide-sm' },
      { label: L('Current service', 'الخدمة الحالية') }, { label: L('Account', 'الحساب'), cls: 'hide-sm' }, { label: '', cls: 'shrink' }], rows })}
    <p class="help" style="margin-top:14px">${L('Titles keep their history. Only the bishop of the clergy member’s diocese changes a title; service assignments are made by those the bishop authorises.',
      'تحتفظ الألقاب بتاريخها. وحده مطران أبرشية الكاهن يغيّر لقبه؛ أما تعيينات الخدمة فيجريها من يفوّضهم المطران.')}</p>`;
}
const TITLE_AR = { Deacon: 'شمّاس', Priest: 'كاهن', Monsignor: 'مونسنيور', Archimandrite: 'أرشمندريت', Chorbishop: 'خوري أسقف', Bishop: 'مطران', Archbishop: 'رئيس أساقفة', Patriarch: 'بطريرك' };
const titleName = x => L(x, TITLE_AR[x] || x);
const officeName = code => { const o = D().catalog.offices[code]; return o ? L(o[0], o[1]) : code; };

/* ---------- access ---------- */
function access() {
  const d = D();
  const active = d.blocks.filter(b => !b.liftedAt), past = d.blocks.filter(b => b.liftedAt);
  const canLift = b => b.scope === 'global' ? may.global() : has(scopePerms(b.scope, b.scopeId), 'access.manage');
  const scopeLabel = b => b.scope === 'global' ? L('Everywhere (account suspended)', 'في كل مكان (الحساب موقوف)') : placeName(b.scope, b.scopeId);
  const rows = active.map(b => ({ cells: [userLine(b.userId), esc(scopeLabel(b)), esc(b.reason), `${esc(userName(b.createdBy))}<small class="dim" style="display:block">${when(b.createdAt)}</small>`,
    canLift(b) ? `<button class="btn btn-secondary btn-dense" data-unblock="${esc(b.id)}">${L('Reactivate', 'إعادة التفعيل')}</button>` : `<span class="dim">${L('Set at a wider level', 'مقرّر على مستوى أوسع')}</span>`] }));
  const canBlock = may.accessParishes().length || may.accessDioceses().length || may.global();
  return `${canBlock ? `<div class="toolbar" style="margin-bottom:16px"><button class="btn btn-primary" id="adm-block">${icon('lock', 16)}${L('Deactivate access', 'إيقاف الوصول')}</button></div>` : ''}
    ${table({ id: 'adm-blocks', cols: [{ label: L('Person', 'الشخص') }, { label: L('Where', 'أين') }, { label: L('Reason', 'السبب'), cls: 'hide-sm' }, { label: L('By', 'بواسطة'), cls: 'hide-sm' }, { label: '', cls: 'shrink' }], rows,
      empty: empty('check', L('No access is deactivated', 'لا وصول موقوف'), L('Deactivating keeps every record, request and history; it only stops access at the chosen level.', 'الإيقاف يحفظ كل سجل وطلب وتاريخ، ويوقف الوصول فقط على المستوى المختار.')) })}
    ${past.length ? `<details style="margin-top:20px"><summary>${L('Earlier deactivations', 'إيقافات سابقة')} (${past.length})</summary>
      ${table({ id: 'adm-blocks-past', cols: [{ label: L('Person', 'الشخص') }, { label: L('Where', 'أين') }, { label: L('Reason', 'السبب') }, { label: L('Reactivated', 'أعيد التفعيل') }],
        rows: past.map(b => ({ cells: [userLine(b.userId), esc(scopeLabel(b)), esc(b.reason), `${esc(userName(b.liftedBy))}<small class="dim" style="display:block">${when(b.liftedAt)}${b.liftNote ? ' · ' + esc(b.liftNote) : ''}</small>`] })) })}</details>` : ''}
    <p class="help" style="margin-top:14px">${L('A parish can only stop access to itself; the diocese, to its parishes; only the super admin suspends an account everywhere. A wider deactivation is not lifted by a narrower reactivation.',
      'لا تستطيع الرعية إلا إيقاف الوصول إليها؛ والأبرشية إلى رعاياها؛ ووحده المدير العام يوقف حساباً في كل مكان. ولا ترفع إعادةُ تفعيل محدودة إيقافاً أوسع.')}</p>`;
}

/* ---------- account finder (exact match only: no browsing other people's accounts) ---------- */
const finder = (id, label = L('Account', 'الحساب')) => `<div class="formrow"><label class="label" for="${id}">${esc(label)}</label>
  <div class="row" style="gap:8px"><input class="input" id="${id}" dir="ltr" autocomplete="off" placeholder="${L('Exact username, email or phone', 'اسم المستخدم أو البريد أو الهاتف بالضبط')}">
  <button class="btn btn-secondary" type="button" data-find="${id}">${L('Find', 'بحث')}</button></div>
  <div class="admin-found" id="${id}-found" aria-live="polite"></div></div>`;
function wireFinder(el, id, onFound) {
  const go = async () => {
    const out = el.querySelector(`#${id}-found`);
    try {
      const { user } = await api('admin', 'POST', { op: 'findUser', query: el.querySelector('#' + id).value });
      out.innerHTML = user ? `<div class="admin-person">${icon('people', 16)}<span><b>${esc(user.name)}</b><small dir="ltr">${esc(user.username)}</small></span></div>`
        : `<p class="help">${L('No account matches exactly. The person needs a ParishLife account first.', 'لا حساب يطابق تماماً. يحتاج الشخص إلى حساب في ParishLife أولاً.')}</p>`;
      onFound(user);
    } catch (e) { out.innerHTML = `<p class="help danger">${esc(e.message)}</p>`; onFound(null); }
  };
  el.querySelector(`[data-find="${id}"]`).addEventListener('click', go);
  el.querySelector('#' + id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
}
const failed = e => toast(L('Not saved', 'لم يُحفظ'), e.message, 'danger');

/* ---------- drawers and dialogs ---------- */
function newDiocese() {
  openModal({ title: L('New diocese', 'أبرشية جديدة'), sub: L('Then provision its first bishop account.', 'ثم جهّز حساب مطرانها الأول.'),
    body: `<div class="formgrid">${C.field({ label: L('Name', 'الاسم'), id: 'nd-name', req: true })}${C.field({ label: L('Name in Arabic', 'الاسم بالعربية'), id: 'nd-ar', dir: 'rtl', ar: true })}</div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" id="nd-save">${L('Create diocese', 'إنشاء الأبرشية')}</button>`,
    onMount(el) { el.querySelector('#nd-save').addEventListener('click', async () => {
      try { await act({ op: 'createDiocese', name: el.querySelector('#nd-name').value, nameAr: el.querySelector('#nd-ar').value }, L('Diocese created', 'أُنشئت الأبرشية')); closeOverlays(); }
      catch (e) { failed(e); } }); } });
}

function provisionBishop(did) {
  openModal({ title: L('Provision the first bishop account', 'تجهيز حساب المطران الأول'),
    sub: L(`For ${dioceseName(did)}. This records the title Bishop and the diocesan appointment. Later title changes are the bishop’s own.`, `لأبرشية ${dioceseName(did)}. يسجّل هذا لقب المطران وتعيينه في الأبرشية. وأي تغيير لاحق في الألقاب يعود إلى المطران نفسه.`),
    body: `<div class="formgrid">${C.field({ label: L('Name', 'الاسم'), id: 'pb-name', req: true })}${C.field({ label: L('Name in Arabic', 'الاسم بالعربية'), id: 'pb-ar', dir: 'rtl', ar: true })}</div>
      ${C.field({ label: L('Username', 'اسم المستخدم'), id: 'pb-user', req: true, dir: 'ltr', help: L('Lowercase letters, digits, dots or dashes.', 'أحرف لاتينية صغيرة وأرقام ونقاط وشرطات.') })}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" id="pb-save">${L('Provision account', 'تجهيز الحساب')}</button>`,
    onMount(el) { el.querySelector('#pb-save').addEventListener('click', async () => {
      try {
        const r = await act({ op: 'provisionBishop', diocese: did, name: el.querySelector('#pb-name').value, nameAr: el.querySelector('#pb-ar').value, username: el.querySelector('#pb-user').value });
        openModal({ title: L('Bishop account ready', 'حساب المطران جاهز'),
          body: `${C.inlineAlert('warning', L('Shown once', 'يظهر مرة واحدة'), L('Give this temporary password to the bishop in person. It is not stored anywhere you can see again.', 'سلّم كلمة المرور المؤقتة هذه إلى المطران شخصياً. لن تتمكن من رؤيتها مجدداً.'))}
            <dl class="dl" style="margin-top:14px"><dt>${L('Username', 'اسم المستخدم')}</dt><dd class="mono" dir="ltr">${esc(r.username)}</dd>
            <dt>${L('Temporary password', 'كلمة المرور المؤقتة')}</dt><dd class="mono" dir="ltr">${esc(r.temporaryPassword)}</dd></dl>`,
          foot: `<button class="btn btn-primary" data-close style="margin-inline-start:auto">${L('Done', 'تمّ')}</button>` });
      } catch (e) { failed(e); } }); } });
}

function newParish() {
  const opts = may.parishDioceses();
  openModal({ title: L('New parish', 'رعية جديدة'), sub: L('The parish starts with empty records. Its priest is assigned from the Clergy tab.', 'تبدأ الرعية بسجلات فارغة. ويُعيَّن كاهنها من تبويب الإكليروس.'),
    body: `<div class="formrow"><label class="label" for="np-dio">${L('Diocese', 'الأبرشية')}</label><select class="select" id="np-dio">${opts.map(d => `<option value="${esc(d.id)}">${esc(L(d.name, d.nameAr || d.name))}</option>`).join('')}</select></div>
      <div class="formgrid">${C.field({ label: L('Parish name', 'اسم الرعية'), id: 'np-name', req: true })}${C.field({ label: L('In Arabic', 'بالعربية'), id: 'np-ar', dir: 'rtl', ar: true })}</div>
      <div class="formgrid">${C.field({ label: L('Town', 'البلدة'), id: 'np-town', req: true })}${C.field({ label: L('Town in Arabic', 'البلدة بالعربية'), id: 'np-townar', dir: 'rtl', ar: true })}</div>
      <div class="formgrid">${C.field({ label: L('Rite', 'الطقس'), id: 'np-rite', ph: 'Maronite' })}${C.field({ label: L('Rite in Arabic', 'الطقس بالعربية'), id: 'np-ritear', dir: 'rtl', ar: true })}</div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" id="np-save">${L('Create parish', 'إنشاء الرعية')}</button>`,
    onMount(el) { el.querySelector('#np-save').addEventListener('click', async () => {
      const v = id => el.querySelector('#' + id).value;
      try { await act({ op: 'createParish', diocese: v('np-dio'), name: v('np-name'), nameAr: v('np-ar'), town: v('np-town'), townAr: v('np-townar'), rite: v('np-rite'), riteAr: v('np-ritear') }, L('Parish created', 'أُنشئت الرعية')); closeOverlays(); }
      catch (e) { failed(e); } }); } });
}

const PARISH_ROLES = ['parishadmin', 'secretary', 'treasurer', 'leader'];
function appoint() {
  let found = null;
  const places = [...may.staffParishes().map(p => [`parish:${p.id}`, L(p.name, p.nameAr || p.name)]), ...may.staffDioceses().map(d => [`diocese:${d.id}`, `${L('Diocese', 'الأبرشية')} — ${L(d.name, d.nameAr || d.name)}`])];
  const roleOptions = place => (place.startsWith('diocese:') ? ['diocesanadmin'] : PARISH_ROLES).map(r => `<option value="${r}">${esc(roleName(r))}</option>`).join('');
  openDrawer({ title: L('Appoint someone', 'تعيين شخص'), sub: L('The person needs a ParishLife account. You can appoint only below your own role, and only with permissions you hold.', 'يحتاج الشخص إلى حساب في ParishLife. لا يمكنك التعيين إلا دون دورك، وبالصلاحيات التي تملكها فقط.'),
    body: `${finder('ap-find')}
      <div class="formrow"><label class="label" for="ap-place">${L('Where', 'أين')}</label><select class="select" id="ap-place">${places.map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('')}</select></div>
      <div class="formrow"><label class="label" for="ap-role">${L('Role', 'الدور')}</label><select class="select" id="ap-role">${roleOptions(places[0]?.[0] || '')}</select></div>
      <div class="admin-template" id="ap-template"></div>
      ${C.field({ label: L('Note (optional)', 'ملاحظة (اختيارية)'), id: 'ap-note' })}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" id="ap-save" disabled>${L('Appoint', 'تعيين')}</button>`,
    onMount(el) {
      const showTemplate = () => { el.querySelector('#ap-template').innerHTML = `<p class="label">${L('Standard permissions', 'الصلاحيات القياسية')}</p>
        <ul class="perm-list">${(D().catalog.templates[el.querySelector('#ap-role').value] || []).map(p => `<li>${icon('check', 14)}${esc(permName(p))}</li>`).join('') || `<li class="dim">${L('Scoped to the ministries this person leads', 'محصورة بالخدمات التي يقودها الشخص')}</li>`}</ul>`; };
      el.querySelector('#ap-place').addEventListener('change', e => { el.querySelector('#ap-role').innerHTML = roleOptions(e.target.value); showTemplate(); });
      el.querySelector('#ap-role').addEventListener('change', showTemplate);
      showTemplate();
      wireFinder(el, 'ap-find', user => { found = user; el.querySelector('#ap-save').disabled = !user; });
      el.querySelector('#ap-save').addEventListener('click', async () => {
        const [scope, scopeId] = el.querySelector('#ap-place').value.split(':');
        try { await act({ op: 'assign', userId: found.id, role: el.querySelector('#ap-role').value, scope, scopeId, note: el.querySelector('#ap-note').value }, L('Appointment made', 'تمّ التعيين')); closeOverlays(); }
        catch (e) { failed(e); }
      });
    } });
}

function openAssignment(id) {
  const a = D().assignments.find(x => x.id === id); if (!a) return;
  const held = scopePerms(a.scope, a.scopeId), template = D().catalog.templates[a.role] || [];
  const levels = a.scope === 'diocese' ? ['diocese', 'parish'] : ['parish'];
  const perms = D().catalog.permissions.filter(p => levels.includes(p.level));
  const editable = a.role !== 'priest' && a.userId !== session.user?.id;
  const row = p => {
    const on = a.perms.includes(p.code), locked = !!p.fixed, mine = held.includes(p.code);
    const note = locked ? L(`Belongs to the ${roleName(p.fixed).toLowerCase()} alone`, `خاصة بدور ${roleName(p.fixed)} وحده`) : !mine ? L('Outside your own permissions', 'خارج صلاحياتك') : template.includes(p.code) ? L('Standard for this role', 'قياسية لهذا الدور') : '';
    return `<label class="perm-row${locked || !mine || !editable ? ' locked' : ''}"><input type="checkbox" data-perm="${esc(p.code)}" ${on ? 'checked' : ''} ${locked || !mine || !editable ? 'disabled' : ''}>
      <span><b>${esc(L(p.en, p.ar))}</b>${note ? `<small>${esc(note)}</small>` : ''}</span>${locked ? icon('lock', 14, 'dimmer') : ''}</label>`;
  };
  openDrawer({ title: `${userName(a.userId)} · ${roleName(a.role)}`, sub: `${placeName(a.scope, a.scopeId)} · ${L('since', 'منذ')} ${when(a.createdAt)}${a.note ? ' · ' + a.note : ''}`,
    body: `<p class="label">${L('Permissions', 'الصلاحيات')}</p><div class="perm-grid">${perms.map(row).join('')}</div>
      ${a.role === 'priest' ? `<p class="help" style="margin-top:12px">${L('A priest’s access follows the clergy assignment; it ends when that assignment ends.', 'صلاحية الكاهن تتبع تعيينه في الإكليروس، وتنتهي بانتهائه.')}</p>` : ''}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
      ${editable ? `<button class="btn btn-danger-quiet" id="as-end">${L('End appointment', 'إنهاء التعيين')}</button><button class="btn btn-primary" id="as-save" style="margin-inline-start:auto">${L('Save permissions', 'حفظ الصلاحيات')}</button>` : ''}`,
    onMount(el) {
      el.querySelector('#as-save')?.addEventListener('click', async () => {
        const checked = new Set([...el.querySelectorAll('[data-perm]')].filter(x => x.checked).map(x => x.dataset.perm));
        const grants = [...checked].filter(p => !template.includes(p)), revokes = template.filter(p => !checked.has(p) && !D().catalog.permissions.find(x => x.code === p)?.fixed);
        try { await act({ op: 'adjust', id, grants, revokes }, L('Permissions saved', 'حُفظت الصلاحيات')); closeOverlays(); } catch (e) { failed(e); }
      });
      el.querySelector('#as-end')?.addEventListener('click', () => confirmEnd(id));
    } });
}
function confirmEnd(id) {
  const a = D().assignments.find(x => x.id === id);
  openModal({ title: L('End this appointment?', 'إنهاء هذا التعيين؟'), sub: L(`${userName(a.userId)} stops acting as ${roleName(a.role)} in ${placeName(a.scope, a.scopeId)}. Their history stays.`, `يتوقف ${userName(a.userId)} عن العمل بصفة ${roleName(a.role)} في ${placeName(a.scope, a.scopeId)}. ويبقى تاريخه محفوظاً.`),
    foot: `<button class="btn btn-secondary" data-close>${L('Keep', 'إبقاء')}</button><button class="btn btn-danger" id="end-yes">${L('End appointment', 'إنهاء التعيين')}</button>`,
    onMount(el) { el.querySelector('#end-yes').addEventListener('click', async () => { try { await act({ op: 'endAssignment', id }, L('Appointment ended', 'انتهى التعيين')); closeOverlays(); } catch (e) { failed(e); } }); } });
}

function newClergy() {
  let found = null;
  const opts = may.clergyDioceses();
  openDrawer({ title: L('Register clergy', 'تسجيل أحد الإكليروس'), sub: L('The title recorded here starts the clergy member’s history. Later changes are made by the bishop.', 'اللقب المسجّل هنا يبدأ تاريخه. وأي تغيير لاحق يجريه المطران.'),
    body: `<div class="formrow"><label class="label" for="nc-dio">${L('Diocese', 'الأبرشية')}</label><select class="select" id="nc-dio">${opts.map(d => `<option value="${esc(d.id)}">${esc(L(d.name, d.nameAr || d.name))}</option>`).join('')}</select></div>
      <div class="formgrid">${C.field({ label: L('Name', 'الاسم'), id: 'nc-name', req: true })}${C.field({ label: L('Name in Arabic', 'الاسم بالعربية'), id: 'nc-ar', dir: 'rtl', ar: true })}</div>
      <div class="formgrid"><div class="formrow"><label class="label" for="nc-title">${L('Title', 'اللقب')}</label><select class="select" id="nc-title">${D().catalog.titles.map(x => `<option value="${x}" ${x === 'Priest' ? 'selected' : ''}>${esc(titleName(x))}</option>`).join('')}</select></div>
        ${C.field({ label: L('Since', 'منذ'), id: 'nc-since', type: 'date' })}</div>
      ${finder('nc-find', L('Account (optional)', 'الحساب (اختياري)'))}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" id="nc-save">${L('Register', 'تسجيل')}</button>`,
    onMount(el) {
      wireFinder(el, 'nc-find', user => { found = user; });
      el.querySelector('#nc-save').addEventListener('click', async () => {
        const v = id => el.querySelector('#' + id).value;
        try { await act({ op: 'addClergy', diocese: v('nc-dio'), name: v('nc-name'), nameAr: v('nc-ar'), title: v('nc-title'), effectiveFrom: v('nc-since'), userId: found?.id || '' }, L('Clergy registered', 'سُجّل')); closeOverlays(); }
        catch (e) { failed(e); }
      });
    } });
}

function openClergy(id) {
  const x = D().clergy.find(c => c.id === id); if (!x) return;
  const canTitle = may.titles(x.diocese);
  const assignable = D().parishes.filter(p => has(D().dioceses.find(d => d.id === p.diocese)?.perms, 'clergy.assign'));
  const kindLabel = k => ({ initial: L('Recorded at registration', 'سُجّل عند التسجيل'), change: L('Changed by the bishop', 'غيّره المطران'), recorded: L('Recorded when titles were introduced', 'سُجّل عند اعتماد الألقاب') })[k] || k;
  let found = null;
  openDrawer({ large: true, title: x.name, sub: `${x.title ? titleName(x.title) : ''} · ${dioceseName(x.diocese)}`,
    body: `<h3 class="t-ui" style="margin-bottom:8px">${L('Title history', 'تاريخ الألقاب')}</h3>
      <ol class="timeline">${x.titles.slice().reverse().map(ti => `<li class="tl-item"><div class="when">${ti.effectiveFrom ? fmtDate(ti.effectiveFrom) : L('Date not recorded', 'التاريخ غير مسجّل')}</div>
        <div class="what"><b>${esc(titleName(ti.title))}</b> · <span class="dim">${esc(kindLabel(ti.kind))}${ti.setBy ? ' · ' + esc(userName(ti.setBy)) : ''}</span>${ti.note ? `<small style="display:block">${esc(ti.note)}</small>` : ''}</div></li>`).join('')}</ol>
      ${canTitle ? `<div class="admin-inline-form"><div class="formgrid"><div class="formrow"><label class="label" for="ct-title">${L('New title', 'اللقب الجديد')}</label>
          <select class="select" id="ct-title">${D().catalog.titles.map(ti => `<option value="${ti}">${esc(titleName(ti))}</option>`).join('')}</select></div>${C.field({ label: L('Takes effect', 'يسري من'), id: 'ct-from', type: 'date' })}</div>
          ${C.field({ label: L('Note (optional)', 'ملاحظة (اختيارية)'), id: 'ct-note' })}<button class="btn btn-secondary" id="ct-save">${L('Change title', 'تغيير اللقب')}</button></div>`
        : `<p class="help">${L('Only the bishop of this diocese changes a clergy title.', 'وحده مطران هذه الأبرشية يغيّر لقب أحد الإكليروس.')}</p>`}
      <div class="divider"></div>
      <h3 class="t-ui" style="margin-bottom:8px">${L('Service', 'الخدمة')}</h3>
      ${x.services.length ? `<ul class="admin-list">${x.services.slice().reverse().map(s => `<li>${icon(s.endDate ? 'clock' : 'check', 16, 'dimmer')}<span><b>${esc(parishName(s.parishId))} · ${esc(officeName(s.office))}</b>
          <small>${s.startDate ? fmtDate(s.startDate) : L('Start not recorded', 'البداية غير مسجّلة')} → ${s.endDate ? fmtDate(s.endDate) : L('today', 'اليوم')}${s.exception ? ' · ' + L('Cross-diocese exception', 'استثناء بين الأبرشيات') + ': ' + esc(s.exception.reason) : ''}</small></span>
          ${!s.endDate && has(D().dioceses.find(d => d.id === D().parishes.find(p => p.id === s.parishId)?.diocese)?.perms, 'clergy.assign') ? `<button class="btn btn-secondary btn-dense" data-end-service="${esc(s.id)}">${L('End', 'إنهاء')}</button>` : ''}</li>`).join('')}</ul>`
        : `<p class="dim">${L('No service recorded.', 'لا خدمة مسجّلة.')}</p>`}
      ${assignable.length ? `<div class="admin-inline-form"><div class="formgrid"><div class="formrow"><label class="label" for="cs-parish">${L('Assign to parish', 'التعيين في رعية')}</label>
          <select class="select" id="cs-parish">${assignable.map(p => `<option value="${esc(p.id)}" data-diocese="${esc(p.diocese)}">${esc(L(p.name, p.nameAr || p.name))}</option>`).join('')}</select></div>
          <div class="formrow"><label class="label" for="cs-office">${L('Office', 'الوظيفة')}</label><select class="select" id="cs-office">${Object.keys(D().catalog.offices).map(o => `<option value="${o}">${esc(officeName(o))}</option>`).join('')}</select></div></div>
          ${C.field({ label: L('Start date', 'تاريخ البدء'), id: 'cs-start', type: 'date' })}
          <div id="cs-exception" hidden>${C.textarea({ label: L('Cross-diocese exception: reason', 'استثناء بين الأبرشيات: السبب'), id: 'cs-reason', max: 500 })}
            <p class="help">${L('Serving outside the home diocese is an exception: it is recorded with its reason and who authorised it.', 'الخدمة خارج الأبرشية الأم استثناء: يُسجَّل مع سببه ومن أذن به.')}</p></div>
          <button class="btn btn-secondary" id="cs-save">${L('Assign', 'تعيين')}</button></div>` : ''}
      ${!x.userId && may.clergyDioceses().some(d => d.id === x.diocese) ? `<div class="divider"></div>${finder('cl-find', L('Link an account', 'ربط حساب'))}<button class="btn btn-secondary" id="cl-link" disabled>${L('Link account', 'ربط الحساب')}</button>` : ''}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>`,
    onMount(el) {
      el.querySelector('#ct-save')?.addEventListener('click', async () => {
        try { await act({ op: 'setClergyTitle', clergyId: id, title: el.querySelector('#ct-title').value, effectiveFrom: el.querySelector('#ct-from').value, note: el.querySelector('#ct-note').value }, L('Title changed', 'تغيّر اللقب')); closeOverlays(); openClergy(id); }
        catch (e) { failed(e); }
      });
      const parishSel = el.querySelector('#cs-parish');
      const toggleException = () => { if (parishSel) el.querySelector('#cs-exception').hidden = parishSel.selectedOptions[0]?.dataset.diocese === x.diocese; };
      parishSel?.addEventListener('change', toggleException); toggleException();
      el.querySelector('#cs-save')?.addEventListener('click', async () => {
        try { await act({ op: 'assignClergy', clergyId: id, parishId: parishSel.value, office: el.querySelector('#cs-office').value, startDate: el.querySelector('#cs-start').value, exceptionReason: el.querySelector('#cs-reason')?.value || '' }, L('Assignment recorded', 'سُجّل التعيين')); closeOverlays(); openClergy(id); }
        catch (e) { failed(e); }
      });
      el.querySelectorAll('[data-end-service]').forEach(b => b.addEventListener('click', () => endService(id, b.dataset.endService)));
      if (el.querySelector('#cl-find')) {
        wireFinder(el, 'cl-find', user => { found = user; el.querySelector('#cl-link').disabled = !user; });
        el.querySelector('#cl-link').addEventListener('click', async () => {
          try { await act({ op: 'linkClergyAccount', clergyId: id, userId: found.id }, L('Account linked', 'رُبط الحساب')); closeOverlays(); openClergy(id); } catch (e) { failed(e); }
        });
      }
    } });
}
function endService(clergyId, sid) {
  openModal({ title: L('End this assignment?', 'إنهاء هذا التعيين؟'), sub: L('The assignment keeps its history. A priest’s access to the parish ends with it.', 'يحتفظ التعيين بتاريخه. وتنتهي صلاحية الكاهن في الرعية بانتهائه.'),
    body: C.field({ label: L('End date', 'تاريخ الانتهاء'), id: 'es-date', type: 'date' }),
    foot: `<button class="btn btn-secondary" data-close>${L('Keep', 'إبقاء')}</button><button class="btn btn-danger" id="es-yes">${L('End assignment', 'إنهاء التعيين')}</button>`,
    onMount(el) { el.querySelector('#es-yes').addEventListener('click', async () => {
      try { await act({ op: 'endClergyAssignment', id: sid, endDate: el.querySelector('#es-date').value }, L('Assignment ended', 'انتهى التعيين')); closeOverlays(); openClergy(clergyId); } catch (e) { failed(e); } }); } });
}

function block() {
  let found = null;
  const places = [...may.accessParishes().map(p => [`parish:${p.id}`, L(p.name, p.nameAr || p.name)]),
    ...may.accessDioceses().map(d => [`diocese:${d.id}`, `${L('Every parish in', 'كل رعايا')} ${L(d.name, d.nameAr || d.name)}`]),
    ...(may.global() ? [['global:', L('Everywhere — suspend the account', 'في كل مكان — إيقاف الحساب')]] : [])];
  openDrawer({ title: L('Deactivate access', 'إيقاف الوصول'), sub: L('Records, requests, payments, attendance and messages stay as they are. Only access stops, at the level you choose.', 'تبقى السجلات والطلبات والدفعات والحضور والرسائل كما هي. يتوقف الوصول فقط، على المستوى الذي تختاره.'),
    body: `${finder('bl-find')}
      <div class="formrow"><label class="label" for="bl-place">${L('Where', 'أين')}</label><select class="select" id="bl-place">${places.map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('')}</select></div>
      ${C.textarea({ label: L('Reason', 'السبب'), id: 'bl-reason', max: 500 })}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-danger" id="bl-save" disabled>${L('Deactivate', 'إيقاف')}</button>`,
    onMount(el) {
      wireFinder(el, 'bl-find', user => { found = user; el.querySelector('#bl-save').disabled = !user; });
      el.querySelector('#bl-save').addEventListener('click', async () => {
        const [scope, scopeId] = el.querySelector('#bl-place').value.split(':');
        try { await act({ op: 'block', userId: found.id, scope, scopeId, reason: el.querySelector('#bl-reason').value }, L('Access deactivated', 'أوقف الوصول')); closeOverlays(); }
        catch (e) { failed(e); }
      });
    } });
}
function unblock(id) {
  openModal({ title: L('Reactivate access?', 'إعادة تفعيل الوصول؟'), sub: L('This lifts only this deactivation. A wider one, if any, stays in force.', 'يرفع هذا هذا الإيقاف فقط. ويبقى أي إيقاف أوسع سارياً.'),
    body: C.field({ label: L('Note (optional)', 'ملاحظة (اختيارية)'), id: 'ub-note' }),
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" id="ub-yes">${L('Reactivate', 'إعادة التفعيل')}</button>`,
    onMount(el) { el.querySelector('#ub-yes').addEventListener('click', async () => {
      try { await act({ op: 'unblock', id, note: el.querySelector('#ub-note').value }, L('Access reactivated', 'أعيد تفعيل الوصول')); closeOverlays(); } catch (e) { failed(e); } }); } });
}

administration.mount = host => {
  C.wire(host);
  load();
  if (!D()) return;
  host.querySelector('#adm-new-diocese')?.addEventListener('click', newDiocese);
  host.querySelectorAll('[data-provision]').forEach(b => b.addEventListener('click', () => provisionBishop(b.dataset.provision)));
  host.querySelector('#adm-new-parish')?.addEventListener('click', newParish);
  host.querySelector('#adm-appoint')?.addEventListener('click', appoint);
  host.querySelector('#adm-staff-place')?.addEventListener('change', e => { S.ui.admStaffPlace = e.target.value; bus.refresh(); });
  host.querySelectorAll('[data-open-assignment]').forEach(b => b.addEventListener('click', () => openAssignment(b.dataset.openAssignment)));
  host.querySelector('#adm-new-clergy')?.addEventListener('click', newClergy);
  host.querySelectorAll('[data-clergy]').forEach(b => b.addEventListener('click', () => openClergy(b.dataset.clergy)));
  host.querySelector('#adm-block')?.addEventListener('click', block);
  host.querySelectorAll('[data-unblock]').forEach(b => b.addEventListener('click', () => unblock(b.dataset.unblock)));
};
