/* Real flows behind every button. Each one opens a designed surface, and on
   confirm changes the in-memory parish, re-renders and says what happened.
   Reversible changes carry Undo, as sheet 04 asks. */
import { t, isAr, num, usd, fmtDate, fmtLong, matches } from './i18n.js';
import { S, bus, go, me } from './store.js';
import { icon, esc, toast, openDrawer, openModal, closeOverlays, avatar, who, status, pill,
         openMenu, closeMenu } from './ui.js';
import * as C from './components.js';
import * as D from './data.js';
import { download } from './actions.js';

const L = (en, ar) => t(en, ar);
const refresh = () => bus.refresh();
const ok = (title, body = '', opts) => toast(title, body, 'success', opts);
const nameOf = p => p ? (isAr() ? p.ar : p.lat) : '';
const val = (el, sel) => el.querySelector(sel)?.value?.trim() || '';
/* Inline validation as sheet 03 draws it: the field turns red, the message sits under
   it and focus moves there; it clears as soon as the person types. */
export function need(el, sel, msg, ok = v => !!v) {
  const inp = el.querySelector(sel);
  if (!inp || ok(inp.value.trim())) return true;
  const row = inp.closest('.formrow') || inp.parentElement;
  let h = row.querySelector('[data-need]');
  if (!h) { h = Object.assign(document.createElement('span'), { className: 'help help-error' }); h.dataset.need = '1'; row.append(h); }
  h.textContent = msg; inp.setAttribute('aria-invalid', 'true'); inp.focus();
  inp.addEventListener('input', () => { inp.removeAttribute('aria-invalid'); h.remove(); }, { once: true });
  return false;
}
const today = '2026-10-04';
/** The group whose page is open (its flows act on it, not on the choir). */
const curGroup = () => (S.route === 'groups' && S.params[0]) || 'g1';
const gd = () => D.groupInfo(curGroup());

/* ═════════════ messaging ═════════════ */
const AUDIENCES = {
  all:      ['All households', 'كل العائلات', 412],
  choir:    ['Saint Elias Choir', 'جوقة مار الياس', 24],
  parents:  ['Catechism parents', 'أهالي التعليم المسيحي', 198],
  rota:     ['Volunteers on this Sunday’s rota', 'متطوّعو مناوبة هذا الأحد', 14],
  group:    ['Saint Elias Choir', 'جوقة مار الياس', 24],
  guardians:['Guardians of children checked in', 'أولياء أمور الأطفال المسجّلين', 26]
};

export function compose(audience = 'all', { subject = '', body = '', bodyAr = '', title } = {}) {
  const person = D.person(audience);
  const [aen, aar, reach] = person ? [person.lat, person.ar, 1] : (AUDIENCES[audience] || AUDIENCES.all);
  openDrawer({
    large: true,
    title: title || L('New message', 'رسالة جديدة'),
    sub: L('Recipients are filtered by what you are allowed to see.', 'يُرشَّح المستلمون بحسب ما يحقّ لك الاطّلاع عليه.'),
    body: `<div class="formrow"><label class="label">${L('Send to', 'إرسال إلى')}</label>
        <div class="chipfield" style="cursor:default"><span class="tag">${person ? avatar(person, 'avatar-sm') : icon('groups', 14)}
          ${esc(L(aen, aar))}</span><span class="t-caption dim" style="margin-inline-start:auto">${num(reach)}
          ${reach === 1 ? L('person', 'شخص') : L('people', 'شخصاً')}</span></div></div>
      <div class="formgrid">
        <div class="formrow"><label class="label">${L('Channel', 'القناة')}</label>
          <select class="select" id="mchan"><option>${L('Follow each person’s preference', 'اتّبع تفضيل كل شخص')}</option>
            <option>${L('In-app only', 'داخل التطبيق فقط')}</option><option>WhatsApp</option><option>SMS</option>
            <option>${L('Email', 'بريد إلكتروني')}</option></select></div>
        ${C.field({ label: L('When', 'الموعد'), type: 'datetime-local', value: '2026-10-04T19:30', id: 'mwhen' })}
      </div>
      ${C.field({ label: L('Subject', 'الموضوع'), value: subject, id: 'msubj', req: true })}
      ${C.textarea({ label: L('Message — English', 'الرسالة — إنكليزي'), id: 'msgen', max: 480, value: body })}
      ${C.textarea({ label: L('Message — Arabic', 'الرسالة — عربي'), id: 'msgar', max: 480, ar: true, value: bodyAr,
        help: L('Each person receives the version matching their recorded language.', 'يتلقّى كل شخص النسخة الموافقة للغته.') })}
      ${reach > 50 ? C.inlineAlert('info', L('A parish-wide send needs approval', 'الإرسال العام يحتاج موافقة'),
        L('It waits for the priest before it leaves. Opt-outs and quiet hours are respected.', 'ينتظر الكاهن قبل مغادرته. وتُحترم طلبات الإيقاف وساعات الهدوء.')) : ''}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-secondary" id="mdraft">${L('Save draft', 'حفظ مسوّدة')}</button>
      <button class="btn btn-primary" id="msend" style="margin-inline-start:auto">${icon('msg', 16)}
        ${reach > 50 ? L('Request approval', 'طلب الموافقة') : L('Send', 'إرسال')}</button>`,
    onMount(el) {
      C.wire(el);
      const push = st => {
        const subj = val(el, '#msubj') || L('Parish message', 'رسالة رعوية');
        D.MESSAGES.unshift({ id: 'mg' + Date.now(), subject: subj, subjectAr: subj, audience: aen, audienceAr: aar,
          channel: 'whatsapp', status: st, when: st === 'draft' ? '—' : '2026-10-04 19:30', reach });
        closeOverlays(); refresh();
        return D.MESSAGES[0];
      };
      el.querySelector('#msend').addEventListener('click', () => {
        const m = push(reach > 50 ? 'scheduled' : 'sent');
        ok(reach > 50 ? L('Sent for approval', 'أُرسلت للموافقة') : L('Message sent', 'أُرسلت الرسالة'),
           `${L(aen, aar)} · ${num(reach)}`,
           { action: { label: L('Undo', 'تراجع'), fn: () => { D.MESSAGES.splice(D.MESSAGES.indexOf(m), 1); refresh(); } } });
      });
      el.querySelector('#mdraft').addEventListener('click', () => { push('draft'); ok(L('Draft saved', 'حُفظت المسوّدة')); });
    }
  });
}

export function remind(context = 'rota') {
  const [aen, aar, reach] = AUDIENCES[context] || AUDIENCES.rota;
  openModal({
    title: L('Send a reminder', 'إرسال تذكير'),
    sub: `${esc(L(aen, aar))} · ${num(reach)} ${L('people', 'شخصاً')}`,
    body: `<div class="card card-flat" style="font:400 14px/22px var(--sans)">
        ${L('A reminder for Sunday 4 October, 10:30 at the Upper Church. Reply 1 to confirm or 2 if you cannot come.',
            'تذكير بيوم الأحد ٤ تشرين الأول، الساعة ١٠:٣٠ في الكنيسة العليا. ردّ ١ للتأكيد أو ٢ إذا تعذّر حضورك.')}</div>
      <div class="stack" style="gap:10px;margin-top:16px">
        ${C.checkRow(L('Skip people who already confirmed', 'تجاوز من أكّد'), { checked: true })}
        ${C.checkRow(L('Respect quiet hours (21:00–07:00)', 'احترام ساعات الهدوء (٢١:٠٠–٠٧:٠٠)'), { checked: true })}</div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="rgo" style="margin-inline-start:auto">${icon('bell', 16)}${L('Send reminder', 'إرسال التذكير')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#rgo').addEventListener('click', () => {
        D.MESSAGES.unshift({ id: 'mg' + Date.now(), subject: 'Reminder', subjectAr: 'تذكير', audience: aen, audienceAr: aar,
          channel: 'whatsapp', status: 'sent', when: '2026-10-04 19:30', reach });
        closeOverlays(); refresh();
        ok(L('Reminder sent', 'أُرسل التذكير'), `${num(reach)} ${L('people', 'شخصاً')} · WhatsApp`);
      });
    }
  });
}

export function broadcast() {
  openModal({
    title: L('Emergency broadcast', 'بثّ طارئ'),
    sub: L('Reaches every guardian of a child checked in right now, on every channel, ignoring quiet hours.',
           'يصل إلى كل وليّ أمر لطفل مسجَّل الآن، على كل القنوات، متجاوزاً ساعات الهدوء.'),
    body: `${C.textarea({ label: L('Message', 'الرسالة'), id: 'bmsg', max: 300,
        value: L('Please come to the church courtyard now to collect your child. Everyone is safe.',
                 'يُرجى الحضور إلى ساحة الكنيسة الآن لاستلام أولادكم. الجميع بخير.') })}
      <div class="formrow"><label class="label">${L('Type', 'اكتب')} <b class="mono">SEND</b> ${L('to confirm', 'للتأكيد')}</label>
        <input class="input mono" id="btyped" autocomplete="off" dir="ltr"></div>
      ${C.inlineAlert('warning', L('A second person must approve', 'يجب أن يوافق شخص ثانٍ'),
        L('Rita Nassar will be asked to confirm on her phone before anything leaves.', 'ستُطلب موافقة ريتا نصّار على هاتفها قبل أي إرسال.'))}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-danger" id="bgo" disabled style="margin-inline-start:auto">${icon('bell', 16)}${L('Send broadcast', 'إرسال البثّ')}</button>`,
    onMount(el) {
      C.wire(el);
      const go2 = el.querySelector('#bgo');
      el.querySelector('#btyped').addEventListener('input', e => { go2.disabled = e.target.value.trim().toUpperCase() !== 'SEND'; });
      go2.addEventListener('click', () => {
        D.MESSAGES.unshift({ id: 'mg' + Date.now(), subject: 'Emergency broadcast', subjectAr: 'بثّ طارئ',
          audience: 'Guardians', audienceAr: 'أولياء الأمور', channel: 'sms', status: 'pending', when: '2026-10-04 19:30', reach: 26 });
        closeOverlays(); refresh();
        toast(L('Waiting for the second approver', 'بانتظار الموافِق الثاني'),
              L('Rita Nassar has been asked to confirm. It sends the moment she does.', 'طُلب من ريتا نصّار التأكيد. يُرسَل فور موافقتها.'), 'warning');
      });
    }
  });
}

/** A person picker in a drawer — invitations, new members, substitutes. */
export function pickPerson({ title, sub = '', cta, onPick, exclude = [] }) {
  const list = D.PEOPLE.filter(p => !exclude.includes(p.id) && p.status !== 'clergy');
  openDrawer({
    title, sub,
    body: `${C.searchClear(L('Type a name in either script', 'اكتب الاسم بأي حرف'), 'ppq')}
      <div class="stack" id="pplist" style="margin-top:12px">${list.map(p => `<label class="listrow" style="padding-inline:4px;cursor:pointer"
          data-name="${esc(`${p.lat} ${p.ar} ${p.phone}`)}">
        <input type="radio" name="pp" value="${p.id}" style="accent-color:var(--primary)">
        ${who(p)}<span class="grow"></span><span class="t-caption dim">${esc(L(p.town, p.townAr))}</span></label>`).join('')}</div>
      <p class="dim" id="ppnone" hidden style="padding:18px 4px">${L('Nobody by that name. Try the other script, or part of the name.', 'لا أحد بهذا الاسم. جرّب الحرف الآخر أو جزءاً من الاسم.')}</p>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="ppgo" disabled style="margin-inline-start:auto">${esc(cta)}</button>`,
    onMount(el) {
      C.wire(el);
      const q = el.querySelector('#ppq'), goBtn = el.querySelector('#ppgo');
      q.addEventListener('input', () => {
        const rows = [...el.querySelectorAll('#pplist [data-name]')];
        rows.forEach(r => { r.hidden = !matches(r.dataset.name, q.value); });
        el.querySelector('#ppnone').hidden = rows.some(r => !r.hidden);
      });
      el.querySelectorAll('input[name=pp]').forEach(r => r.addEventListener('change', () => { goBtn.disabled = false; }));
      goBtn.addEventListener('click', () => {
        const id = el.querySelector('input[name=pp]:checked')?.value;
        if (!id) return;
        closeOverlays(); onPick(D.person(id));
      });
    }
  });
}

export function invite(context = 'rota', at = '') {
  pickPerson({
    title: L('Invite someone', 'دعوة شخص'),
    sub: L('They are asked on WhatsApp and have until Monday to reply.', 'يُسأل عبر واتساب ولديه مهلة حتى الإثنين.'),
    cta: L('Send invitation', 'إرسال الدعوة'),
    onPick: p => {
      if (context === 'rota') {
        const slot = at ? rotaSlot(at) : D.ROTA.teams.flatMap(tm => tm.filled).find(f => !f.p);
        if (slot) Object.assign(slot, { p: p.id, s: 'pending', swap: undefined });
      } else if (context.startsWith('sheet')) {
        const ref = context.split('|')[1];
        const s = ref ? D.SIGNUP_SHEETS.find(x => x.id === ref) : D.SIGNUP_SHEETS.find(x => x.taken < x.slots);
        if (!s || s.taken >= s.slots) return toast(L('That sheet is full', 'هذه اللائحة ممتلئة'), L('Add places to it first.', 'أضف مراكز إليها أولاً.'), 'warning');
        s.taken += 1;
      }
      refresh();
      ok(L('Invitation sent', 'أُرسلت الدعوة'), `${nameOf(p)} · WhatsApp`);
    }
  });
}

/* ═════════════ portal requests ═════════════ */
function portalApply(r) {
  if (r.kind === 'address') {
    const h = D.HOUSEHOLDS.find(x => x.id === r.hh); if (!h) return () => {};
    const was = { address: h.address, addressAr: h.addressAr };
    Object.assign(h, { address: r.to, addressAr: r.toAr });
    return () => Object.assign(h, was);
  }
  const h = { id: 'h' + Date.now().toString(36), name: r.name, ar: r.nameAr, head: null, members: [], town: r.town, townAr: r.townAr,
    envelope: String(300 + D.HOUSEHOLDS.length).padStart(4, '0'), address: '', addressAr: '' };
  D.HOUSEHOLDS.unshift(h);
  return () => { const i = D.HOUSEHOLDS.indexOf(h); if (i > -1) D.HOUSEHOLDS.splice(i, 1); };
}

export function portalDecide(id, accept) {
  const i = D.PORTAL_REQUESTS.findIndex(x => x.id === id); if (i < 0) return;
  const [r] = D.PORTAL_REQUESTS.splice(i, 1);
  const undoApply = accept ? portalApply(r) : () => {};
  closeOverlays(); refresh();
  toast(accept ? L('Change accepted', 'اعتُمد التعديل') : L('Change declined', 'رُفض التعديل'),
    accept ? L(`${r.what} — the record is updated and the family has been told.`, `${r.whatAr} — حُدّث السجل وأُبلغت العائلة.`)
           : L('The family is told the change was not applied.', 'تُبلَّغ العائلة بأن التعديل لم يُطبَّق.'),
    accept ? 'success' : '',
    { action: { label: L('Undo', 'تراجع'), fn: () => { undoApply(); D.PORTAL_REQUESTS.splice(i, 0, r); refresh(); } } });
}

export function portalCompare(id) {
  const r = D.PORTAL_REQUESTS.find(x => x.id === id); if (!r) return;
  const col = (label, text) => `<div class="card card-flat"><div class="overline">${label}</div>
    <p style="font:400 14px/22px var(--sans);margin-top:6px">${text ? esc(text) : `<span class="dim">${L('Nothing on record yet', 'لا شيء في السجل بعد')}</span>`}</p></div>`;
  openModal({
    title: L(r.what, r.whatAr), sub: `${L('Submitted from the member portal', 'مُرسل من بوّابة المؤمنين')} · ${fmtDate(r.at)}`,
    body: `<div class="grid g2" style="gap:12px">${col(L('On record', 'في السجل'), L(r.now, r.nowAr))}${col(L('Submitted', 'المُرسَل'), L(r.to, r.toAr))}</div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
      <button class="btn btn-danger-quiet" id="pq_no" style="margin-inline-start:auto">${L('Decline', 'رفض')}</button>
      <button class="btn btn-primary" id="pq_yes">${L('Accept', 'قبول')}</button>`,
    onMount(el) {
      el.querySelector('#pq_no').addEventListener('click', () => portalDecide(id, false));
      el.querySelector('#pq_yes').addEventListener('click', () => portalDecide(id, true));
    }
  });
}

/* ═════════════ archive ═════════════
   Archiving takes people out of every list, picker and message; the record is
   kept, and restoring puts it back exactly where it was. */
export function archivePeople(ids) {
  const moved = ids.map(id => D.PEOPLE.find(x => x.id === id)).filter(Boolean).map(p => [D.PEOPLE.indexOf(p), p]);
  if (!moved.length) return;
  moved.forEach(([, p]) => { D.PEOPLE.splice(D.PEOPLE.indexOf(p), 1); Object.assign(p, { archived: today, archivedBy: me()?.id || 'p17' }); D.ARCHIVED.unshift(p); });
  refresh();
  toast(moved.length === 1 ? L(`${moved[0][1].lat} archived`, `أُرشف ${moved[0][1].ar}`) : L(`${moved.length} records archived`, `أُرشف ${moved.length} سجلات`),
    L('Out of every list and message. The record is kept and can be restored.', 'خارج كل اللوائح والرسائل. والسجل محفوظ ويمكن استرجاعه.'), '',
    { action: { label: L('Undo', 'تراجع'), fn: () => {
      moved.sort((a, b) => a[0] - b[0]).forEach(([i, p]) => { D.ARCHIVED.splice(D.ARCHIVED.indexOf(p), 1); delete p.archived; delete p.archivedBy; delete p.deletionRequested; D.PEOPLE.splice(i, 0, p); });
      refresh(); } } });
}

export function restorePerson(id) {
  const p = D.ARCHIVED.find(x => x.id === id); if (!p) return;
  const i = D.ARCHIVED.indexOf(p), was = { archived: p.archived, archivedBy: p.archivedBy, deletionRequested: p.deletionRequested };
  D.ARCHIVED.splice(i, 1); delete p.archived; delete p.archivedBy; delete p.deletionRequested; D.PEOPLE.unshift(p);
  refresh();
  ok(L('Record restored', 'استُرجع السجل'), L(`${p.lat} is back in the parish lists.`, `عاد ${p.ar} إلى لوائح الرعية.`),
     { action: { label: L('Undo', 'تراجع'), fn: () => { D.PEOPLE.splice(D.PEOPLE.indexOf(p), 1); Object.assign(p, was); D.ARCHIVED.splice(i, 0, p); refresh(); } } });
}

/* ═════════════ rota board ═════════════
   A place is addressed as "team|slot" on D.ROTA.teams. Every change keeps a
   snapshot so the toast can offer Undo. */
const rotaSlot = at => { const [ti, si] = at.split('|').map(Number); return D.ROTA.teams[ti]?.filled[si]; };
const rotaTeam = at => D.ROTA.teams[+at.split('|')[0]];
const rotaSnap = () => { const snap = D.ROTA.teams.map(tm => tm.filled.map(f => ({ ...f })));
  return () => { D.ROTA.teams.forEach((tm, i) => { tm.filled = snap[i]; }); refresh(); }; };
const undo = fn => ({ action: { label: L('Undo', 'تراجع'), fn } });

/** from: { p } — a volunteer from the tray — or { at } — a card already on the board. */
export function rotaDrop(from, at) {
  const dst = rotaSlot(at), team = rotaTeam(at), restore = rotaSnap();
  if (!dst || from.at === at) return;
  const free = !dst.p || dst.s === 'declined';
  const who = from.p || rotaSlot(from.at).p;
  if (!(from.at && rotaTeam(from.at) === team) && team.filled.some(f => f !== dst && f.p === who && f.s !== 'declined'))
    return toast(L(`Already on ${team.team}`, `موجود في ${team.teamAr}`), nameOf(D.person(who)), 'warning');
  if (from.p) {
    Object.assign(dst, { p: from.p, s: 'pending', swap: undefined });
    refresh();
    return ok(L('Invitation sent', 'أُرسلت الدعوة'), `${nameOf(D.person(from.p))} · ${L(team.team, team.teamAr)} · WhatsApp`, undo(restore));
  }
  const src = rotaSlot(from.at), moved = { ...src };
  Object.assign(src, free ? { p: null, s: 'open', swap: undefined } : { p: dst.p, s: dst.s, swap: dst.swap });
  Object.assign(dst, moved);
  refresh();
  ok(free ? L(`Moved to ${team.team}`, `نُقل إلى ${team.teamAr}`) : L('Places swapped', 'تبادلا المركزين'),
     free ? nameOf(D.person(moved.p)) : `${nameOf(D.person(moved.p))} ⇄ ${nameOf(D.person(src.p))}`, undo(restore));
}

export function rotaSwap(anchor, at) {
  const f = rotaSlot(at), team = rotaTeam(at), by = D.person(f.p), to = D.person(f.swap);
  openMenu(anchor, [
    { head: L(`${nameOf(by)} asks to swap with ${nameOf(to)}`, `${nameOf(by)} يطلب التبديل مع ${nameOf(to)}`) },
    { label: L(`Approve — ${nameOf(to)} serves`, `موافقة — يخدم ${nameOf(to)}`), icon: 'check', fn: () => {
      const restore = rotaSnap();
      Object.assign(f, { p: f.swap, s: 'accepted', swap: undefined }); refresh();
      ok(L('Swap approved', 'تمّت الموافقة على التبديل'), `${nameOf(to)} · ${L(team.team, team.teamAr)}`, undo(restore)); } },
    { label: L(`Decline — ${nameOf(by)} stays on`, `رفض — يبقى ${nameOf(by)}`), icon: 'close', fn: () => {
      const restore = rotaSnap();
      f.swap = undefined; refresh();
      toast(L('Swap declined', 'رُفض التبديل'), L(`${nameOf(by)} is told on WhatsApp.`, `يُبلَّغ ${nameOf(by)} عبر واتساب.`), '', undo(restore)); } }
  ], { width: 280 });
}

/* ═════════════ sharing & documents ═════════════ */
export function share({ title, url = location.href, text = '' }) {
  const wa = `https://wa.me/?text=${encodeURIComponent((text ? text + ' ' : '') + url)}`;
  openModal({
    title: L('Share', 'مشاركة'), sub: esc(title),
    body: `<div class="formrow"><label class="label">${L('Link', 'الرابط')}</label>
        <div class="field"><input class="value" id="shurl" readonly value="${esc(url)}" dir="ltr"
          style="border:0;background:none;width:100%;font:400 13px/1 var(--mono)">
          <button class="btn btn-ghost btn-dense" id="shcopy" style="border-radius:0">${L('Copy', 'نسخ')}</button></div></div>
      <div class="grid g3" style="gap:10px">
        <a class="card card-flat" href="${wa}" target="_blank" rel="noopener" style="text-align:center;padding:16px 10px">
          <span style="color:var(--success)">${icon('msg', 22)}</span><b style="display:block;font:500 13px/18px var(--sans);margin-top:6px">WhatsApp</b></a>
        <a class="card card-flat" href="mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}" style="text-align:center;padding:16px 10px">
          <span style="color:var(--primary)">${icon('msg', 22)}</span><b style="display:block;font:500 13px/18px var(--sans);margin-top:6px">${L('Email', 'بريد')}</b></a>
        <button class="card card-flat" id="shprint" style="text-align:center;padding:16px 10px;cursor:pointer">
          <span style="color:var(--text-2)">${icon('print', 22)}</span><b style="display:block;font:500 13px/18px var(--sans);margin-top:6px">${L('Print', 'طباعة')}</b></button>
      </div>`,
    onMount(el) {
      el.querySelector('#shcopy').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(url); } catch { el.querySelector('#shurl').select(); document.execCommand('copy'); }
        ok(L('Link copied', 'نُسخ الرابط'));
      });
      el.querySelector('#shprint').addEventListener('click', () => { closeOverlays(); setTimeout(() => window.print(), 250); });
    }
  });
}

const docShell = (title, inner) => `<!doctype html><html lang="${isAr() ? 'ar' : 'en'}" dir="${isAr() ? 'rtl' : 'ltr'}"><head>
  <meta charset="utf-8"><title>${esc(title)}</title>
  <style>body{font:14px/1.6 Inter,system-ui,sans-serif;color:#1B263B;background:#F4F1DE;margin:0;padding:32px}
  .page{max-width:720px;margin:0 auto 24px;background:#fff;border:1px solid #DDD8C2;padding:40px;page-break-after:always}
  h1{font-size:20px;margin:0 0 4px} .muted{color:#5A6672} table{width:100%;border-collapse:collapse;margin-top:16px}
  th,td{padding:8px 10px;border-bottom:1px solid #DDD8C2;text-align:start} th{background:#EAE6D2;font-size:11px;
  text-transform:uppercase;letter-spacing:.06em} .num{text-align:end;font-family:ui-monospace,monospace}
  .rule{border-top:2px solid #7E6435;margin:14px 0} @media print{body{background:#fff;padding:0}.page{border:0}}</style>
  </head><body>${inner}</body></html>`;

/** Preview a document the parish holds, with print and download. */
export function previewDoc(name, kind = 'file') {
  openDrawer({
    large: true, title: name,
    sub: L('Restricted documents open here, and opening one is logged.', 'المستندات المقيّدة تُفتح هنا، وفتحها يُسجَّل.'),
    body: `<div class="a4frame"><div class="a4bar">${pill(kind === 'pdf' ? 'PDF' : L('Document', 'مستند'))}
        <span class="zoom">A4 · 100%</span></div>
      <div style="display:flex;justify-content:center"><div class="a4" style="max-width:420px;align-items:stretch;text-align:start">
        <div class="ttl" style="text-align:center">${esc(L(D.PARISH.name, D.PARISH.nameAr))}</div>
        <div class="t-caption dim" style="text-align:center">${esc(name)}</div>
        <div style="margin-top:22px;display:flex;flex-direction:column;gap:9px">
          ${[92, 78, 88, 64, 95, 71, 83, 58, 90, 45].map(w => `<span style="height:7px;border-radius:4px;background:var(--muted);width:${w}%"></span>`).join('')}
        </div>
        <div class="sig"><div>${L('Recorded by the office', 'سجّلها المكتب')}</div><div>${fmtDate(today)}</div></div>
      </div></div></div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
      <button class="btn btn-secondary" id="dpprint">${icon('print', 16)}${L('Print', 'طباعة')}</button>
      <button class="btn btn-primary" id="dpdl" style="margin-inline-start:auto">${icon('export', 16)}${L('Download', 'تنزيل')}</button>`,
    onMount(el) {
      el.querySelector('#dpprint').addEventListener('click', () => { closeOverlays(); setTimeout(() => window.print(), 250); });
      el.querySelector('#dpdl').addEventListener('click', () => {
        download(name.replace(/\.\w+$/, '') + '.html', docShell(name, `<div class="page"><h1>${esc(name)}</h1>
          <p class="muted">${esc(L(D.PARISH.name, D.PARISH.nameAr))} · ${fmtDate(today)}</p><div class="rule"></div>
          <p>${L('Copy held in the parish file store.', 'نسخة محفوظة في مخزن ملفات الرعية.')}</p></div>`), 'text/html');
        ok(L('Downloaded', 'تمّ التنزيل'), name);
      });
    }
  });
}

/* ═════════════ real file generators ═════════════ */
const ics = s => s.replace(/[,;\\]/g, m => '\\' + m);
export function downloadICS() {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ParishLife//Saint Elias//EN', 'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${ics(D.PARISH.name)} — ParishLife`, 'X-WR-TIMEZONE:Asia/Beirut'];
  D.EVENTS.forEach(e => {
    const [h, m] = e.t.split(':').map(Number);
    const d = e.d.replace(/-/g, ''), start = `${d}T${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}00`;
    const end = `${d}T${String(h + 1).padStart(2, '0')}${String(m).padStart(2, '0')}00`;
    const v = D.venue(e.venue);
    lines.push('BEGIN:VEVENT', `UID:${e.id}@saint-elias.parishlife`, `DTSTAMP:20261004T190000Z`,
      `DTSTART;TZID=Asia/Beirut:${start}`, `DTEND;TZID=Asia/Beirut:${end}`,
      `SUMMARY:${ics(L(e.title, e.titleAr))}`, `LOCATION:${ics(v ? v.name : '')}, Saint Elias, Hadath`, 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  download('saint-elias-calendar.ics', lines.join('\r\n'), 'text/calendar;charset=utf-8');
  ok(L('Calendar downloaded', 'نُزّلت الرزنامة'),
     L(`${D.EVENTS.length} events · open the file to add them to Google, Outlook or Apple Calendar.`,
       `${D.EVENTS.length} حدثاً · افتح الملف لإضافتها إلى غوغل أو أوتلوك أو آبل.`));
}

function receiptHTML(no, p, amount, at) {
  return `<div class="page"><h1>${esc(L('Receipt', 'إيصال'))} ${esc(no)}</h1>
    <p class="muted">${esc(L(D.PARISH.name, D.PARISH.nameAr))} · ${esc(L(D.PARISH.eparchy, D.PARISH.eparchyAr))}</p><div class="rule"></div>
    <table><tr><th>${L('Received from', 'استُلم من')}</th><td>${esc(p ? p.ar + ' · ' + p.lat : L('Anonymous', 'مجهول'))}</td></tr>
      <tr><th>${L('Date', 'التاريخ')}</th><td>${fmtDate(at)}</td></tr>
      <tr><th>USD</th><td class="num">${usd(amount)}</td></tr>
      <tr><th>L.L</th><td class="num">${num(amount * D.RATE.value)} ${L('at', 'على سعر')} ${num(D.RATE.value)}</td></tr></table>
    <p class="muted" style="margin-top:18px;font-size:12px">${L('A record of a gift to the parish. Not a tax document.', 'سجلّ تقدمة للرعية. ليس مستنداً ضريبياً.')}</p></div>`;
}

export function receipt(no, pid, amount, at = today) {
  const p = D.person(pid);
  openDrawer({
    title: L('Receipt', 'إيصال') + ' ' + no,
    sub: `${esc(nameOf(p) || L('Anonymous', 'مجهول'))} · ${usd(amount)}`,
    body: `<div class="a4frame"><div style="display:flex;justify-content:center"><div class="a4" style="aspect-ratio:auto;max-width:380px;padding:28px;align-items:stretch;text-align:start">
        <div class="row" style="gap:10px"><span class="seal-lg" style="width:36px;height:36px;font-size:14px;margin:0">✚</span>
          <div><b style="font:600 14px/18px var(--sans)">${esc(L(D.PARISH.name, D.PARISH.nameAr))}</b>
          <div class="t-caption dim">${L('Receipt', 'إيصال')} <span class="mono">${esc(no)}</span></div></div></div>
        <div class="divider"></div>
        <dl class="dl" style="font-size:13px">
          <dt>${L('Received from', 'استُلم من')}</dt><dd>${esc(nameOf(p) || L('Anonymous', 'مجهول'))}</dd>
          <dt>${L('Date', 'التاريخ')}</dt><dd class="mono">${fmtDate(at)}</dd></dl>
        <div class="divider"></div>
        ${C.ratePopover ? `<div class="amount" dir="ltr"><span class="usd">${usd(amount)}</span>
          <span class="lbp">L.L ${num(amount * D.RATE.value)}</span>
          <span class="rate">at ${num(D.RATE.value)} · ${fmtDate(D.RATE.setOn)}</span></div>` : ''}
        <p class="t-caption dim" style="margin-top:16px">${L('A record of a gift to the parish. Not a tax document.', 'سجلّ تقدمة للرعية. ليس مستنداً ضريبياً.')}</p>
      </div></div></div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
      <button class="btn btn-secondary" id="rcshare">${icon('msg', 16)}${L('Send', 'إرسال')}</button>
      <button class="btn btn-secondary" id="rcprint">${icon('print', 16)}${L('Print', 'طباعة')}</button>
      <button class="btn btn-primary" id="rcdl" style="margin-inline-start:auto">${icon('export', 16)}${L('Download', 'تنزيل')}</button>`,
    onMount(el) {
      el.querySelector('#rcprint').addEventListener('click', () => { closeOverlays(); setTimeout(() => window.print(), 250); });
      el.querySelector('#rcdl').addEventListener('click', () => {
        download(`receipt-${no}.html`, docShell('Receipt ' + no, receiptHTML(no, p, amount, at)), 'text/html');
        ok(L('Receipt downloaded', 'نُزّل الإيصال'), `receipt-${no}.html`);
      });
      el.querySelector('#rcshare').addEventListener('click', () => { closeOverlays();
        share({ title: L('Receipt', 'إيصال') + ' ' + no, text: L('Your receipt from Saint Elias', 'إيصالك من مار الياس') }); });
    }
  });
}

function statementRows(pid) {
  const lines = D.BATCH.lines.filter(l => l.p === pid);
  const base = lines.length ? lines : [{ usd: 50, fund: 'general' }];
  return [...base, { usd: 50, fund: 'general' }, { usd: 300, fund: 'building' }];
}
function statementHTML(pid) {
  const p = D.person(pid), rows = statementRows(pid), total = rows.reduce((a, r) => a + (r.usd || 0), 0);
  return `<div class="page"><h1>${L('Giving statement 2026', 'كشف التقدمات ٢٠٢٦')}</h1>
    <p class="muted">${esc(p ? p.ar + ' · ' + p.lat : '')} · ${esc(L(D.PARISH.name, D.PARISH.nameAr))}</p><div class="rule"></div>
    <table><thead><tr><th>${L('Fund', 'الصندوق')}</th><th class="num">USD</th><th class="num">L.L</th></tr></thead><tbody>
    ${rows.map(r => { const f = D.FUNDS.find(x => x.id === r.fund);
      return `<tr><td>${esc(f ? L(f.name, f.ar) : r.fund)}</td><td class="num">${usd(r.usd || 0)}</td><td class="num">${num((r.usd || 0) * D.RATE.value)}</td></tr>`; }).join('')}
    <tr><th>${L('Total', 'المجموع')}</th><th class="num">${usd(total)}</th><th class="num">${num(total * D.RATE.value)}</th></tr></tbody></table>
    <p class="muted" style="margin-top:18px;font-size:12px">${L('Each gift is shown at the rate that applied on its day. Not a tax document.',
      'تظهر كل تقدمة بسعر يومها. ليس مستنداً ضريبياً.')}</p></div>`;
}

export function statement(pid) {
  const p = D.person(pid);
  download(`statement-2026-${(p?.lat || 'household').toLowerCase().replace(/\s+/g, '-')}.html`,
    docShell('Statement', statementHTML(pid)), 'text/html');
  ok(L('Statement downloaded', 'نُزّل الكشف'), `${nameOf(p)} · 2026`);
}

export function statementsAll() {
  const heads = D.HOUSEHOLDS.map(h => h.head);
  let n = 0;
  openModal({
    title: L('Generating statements', 'إصدار الكشوفات'),
    sub: L('One page per household, both currencies, at the rate that applied to each gift.', 'صفحة لكل عائلة، بالعملتين، وبسعر كل تقدمة.'),
    body: `<div class="row" style="gap:10px"><span class="spinner"></span><span class="t-ui" id="sgtext">0 / ${heads.length}</span></div>
      <span class="progress" style="margin-top:12px"><i id="sgbar" style="width:0%"></i></span>`,
    onMount(el) {
      const text = el.querySelector('#sgtext'), bar = el.querySelector('#sgbar');
      const tick = setInterval(() => {
        /* closing the dialog cancels the run — nothing half-generated is downloaded */
        if (!text.isConnected) return clearInterval(tick);
        n += 1;
        text.textContent = `${n} / ${heads.length}`;
        bar.style.width = `${Math.round(n / heads.length * 100)}%`;
        if (n >= heads.length) {
          clearInterval(tick);
          download('statements-2026-saint-elias.html', docShell('Statements 2026', heads.map(statementHTML).join('')), 'text/html');
          closeOverlays();
          ok(L('Statements ready', 'الكشوفات جاهزة'), `${heads.length} ${L('households', 'عائلات')} · statements-2026-saint-elias.html`);
        }
      }, 260);
    }
  });
}

export function slides() {
  const deck = D.SERVICE.order.map((o, i) => `<section class="s"><div class="k">${i + 1} / ${D.SERVICE.order.length}</div>
    <h2>${esc(o.t)}</h2><p class="ar">${esc(o.ar)}</p></section>`).join('');
  download('sunday-mass-10-30-slides.html', `<!doctype html><html><head><meta charset="utf-8"><title>Slides</title>
    <style>body{margin:0;font-family:Inter,system-ui,sans-serif;background:#0D1B2A}
    .s{height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;
      color:#F4F1DE;border-bottom:1px solid #1B263B;page-break-after:always;padding:0 8vw}
    .k{color:#D4C4A8;font:500 14px ui-monospace,monospace;letter-spacing:.1em}
    h2{font-size:5vw;margin:.4em 0 .2em;font-weight:600}.ar{font-size:4vw;color:#D4C4A8;margin:0}</style></head>
    <body><section class="s"><div class="k">${esc(D.PARISH.name.toUpperCase())}</div><h2>${esc(L(D.SERVICE.title, D.SERVICE.titleAr))}</h2>
    <p class="ar">${esc(D.PARISH.nameAr)}</p></section>${deck}</body></html>`, 'text/html');
  closeOverlays();
  ok(L('Slides generated', 'تمّ توليد الشرائح'), `sunday-mass-10-30-slides.html · ${D.SERVICE.order.length + 1} ${L('slides', 'شريحة')}`);
}

/** Ready-made parish design: fill date and place, see it live, download a real SVG. */
export function designTemplate(i) {
  const tp = D.TEMPLATES[+i] || D.TEMPLATES[0];
  const svg = (date, place) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
    <rect width="600" height="800" fill="#0D1B2A"/><rect x="28" y="28" width="544" height="744" fill="none" stroke="#D4C4A8" stroke-opacity=".45"/>
    <text x="300" y="130" fill="#D4C4A8" font-family="Inter,Arial" font-size="18" letter-spacing="4" text-anchor="middle">${esc(D.PARISH.name.toUpperCase())}</text>
    <text x="300" y="170" fill="#D4C4A8" fill-opacity=".7" font-family="Arial" font-size="22" text-anchor="middle">${esc(D.PARISH.nameAr)}</text>
    <text x="300" y="380" fill="#F4F1DE" font-family="Inter,Arial" font-size="52" font-weight="600" text-anchor="middle">${esc(tp.name)}</text>
    <text x="300" y="440" fill="#F4F1DE" fill-opacity=".8" font-family="Arial" font-size="34" text-anchor="middle">${esc(tp.ar)}</text>
    <line x1="220" y1="500" x2="380" y2="500" stroke="#D4C4A8"/>
    <text x="300" y="560" fill="#F4F1DE" font-family="Inter,Arial" font-size="26" text-anchor="middle">${esc(date)}</text>
    <text x="300" y="600" fill="#F4F1DE" fill-opacity=".75" font-family="Inter,Arial" font-size="20" text-anchor="middle">${esc(place)}</text>
    <text x="300" y="720" fill="#D4C4A8" fill-opacity=".6" font-family="Inter,Arial" font-size="14" text-anchor="middle">Hadath · Maronite</text></svg>`;
  openDrawer({
    large: true, title: L(tp.name, tp.ar),
    sub: L('The parish name and logo are already on it. Fill the rest and download.', 'اسم الرعية وشعارها عليه. املأ الباقي ونزّله.'),
    body: `<div class="grid g2" style="gap:20px;align-items:start">
        <div>${C.field({ label: L('Date and time', 'التاريخ والوقت'), value: L('Thursday 24 December, 23:00', 'الخميس ٢٤ كانون الأول، ٢٣:٠٠'), id: 'dgdate' })}
          ${C.field({ label: L('Place', 'المكان'), value: L('Upper Church, Saint Elias', 'الكنيسة العليا، مار الياس'), id: 'dgplace' })}
          ${C.inlineAlert('info', L('Print or share', 'اطبع أو شارك'), L('The file is a vector, so it prints sharp at A4 or A3.', 'الملف متّجهي، فيُطبع واضحاً على A4 أو A3.'))}</div>
        <div id="dgprev" style="border-radius:var(--r-card);overflow:hidden;box-shadow:var(--e2)"></div>
      </div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
      <button class="btn btn-primary" id="dgdl" style="margin-inline-start:auto">${icon('export', 16)}${L('Download', 'تنزيل')}</button>`,
    onMount(el) {
      const prev = el.querySelector('#dgprev');
      const draw = () => { prev.innerHTML = svg(val(el, '#dgdate'), val(el, '#dgplace')).replace('width="600" height="800"', 'width="100%"'); };
      el.querySelectorAll('#dgdate,#dgplace').forEach(i2 => i2.addEventListener('input', draw)); draw();
      el.querySelector('#dgdl').addEventListener('click', () => {
        const fname = `${tp.name.toLowerCase().replace(/\s+/g, '-')}.svg`;
        download(fname, svg(val(el, '#dgdate'), val(el, '#dgplace')), 'image/svg+xml');
        ok(L('Design downloaded', 'نُزّل التصميم'), fname);
      });
    }
  });
}

/* ═════════════ people & records ═════════════ */
export function recordChooser() {
  openModal({
    title: L('New record', 'سجل جديد'),
    sub: L('What are you adding?', 'ماذا تضيف؟'),
    body: `<div class="grid g2" style="gap:10px">
      ${[['people', L('Parishioner', 'مؤمن'), 'people', 'newperson'], ['family', L('Household', 'عائلة'), 'households', 'hhnew'],
         ['sacr', L('Register entry', 'قيد في السجل'), 'sacraments', 'newrec'], ['events', L('Event', 'حدث'), 'calendar', 'evnew'],
         ['rooms', L('Room request', 'طلب قاعة'), 'reservations', 'newres'], ['give', L('Counting session', 'جلسة عدّ'), 'giving', 'addenv']]
        .map(([ic, lab, route, trigger]) => `<button class="card card-flat" data-choose="${route}|${trigger}"
          style="cursor:pointer;text-align:start;padding:16px;display:flex;gap:12px;align-items:center">
          <span class="avatar">${icon(ic, 17)}</span><b style="font:500 14px/20px var(--sans)">${esc(lab)}</b></button>`).join('')}</div>`,
    onMount(el) {
      el.querySelectorAll('[data-choose]').forEach(b => b.addEventListener('click', () => {
        const [route, trigger] = b.dataset.choose.split('|');
        closeOverlays(); go(route);
        setTimeout(() => (document.getElementById(trigger) || document.querySelector(`[data-act="${trigger}"],[data-split]`))?.click(), 260);
      }));
    }
  });
}

export function personEdit(id) {
  const p = D.person(id); if (!p) return;
  openDrawer({
    large: true, title: L('Edit record', 'تعديل السجل'), sub: esc(p.ar + ' · ' + p.lat),
    body: `<div class="formgrid">
        ${C.field({ label: L('Arabic name', 'الاسم العربي'), req: true, value: p.ar, dir: 'rtl', ar: true, id: 'e_ar' })}
        ${C.field({ label: L('Transliteration', 'الحرف اللاتيني'), req: true, value: p.lat, dir: 'ltr', id: 'e_lat' })}
        ${C.field({ label: L('Date of birth', 'تاريخ الولادة'), type: 'date', value: p.born, id: 'e_born' })}
        <div class="formrow"><label class="label">${L('Status', 'الحالة')}</label>
          <select class="select" id="e_st">${[['member', 'Member', 'منتسب'], ['visitor', 'Visitor', 'زائر'], ['clergy', 'Clergy', 'إكليروس']]
            .map(([v, en, ar]) => `<option value="${v}" ${p.status === v ? 'selected' : ''}>${esc(L(en, ar))}</option>`).join('')}</select></div>
      </div>
      ${C.phoneField({ value: p.phone === '—' ? '' : p.phone, id: 'e_ph' })}
      <div class="formrow"><label class="label">${L('Photo', 'الصورة')}</label>${C.avatarUpload(p.id)}</div>
      ${C.riteSelect()}
      ${C.addressCascade()}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="e_save" style="margin-inline-start:auto">${L('Save changes', 'حفظ التعديلات')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#e_save').addEventListener('click', () => {
        const before = { ...p };
        p.ar = val(el, '#e_ar') || p.ar; p.lat = val(el, '#e_lat') || p.lat;
        p.born = val(el, '#e_born') || p.born; p.status = el.querySelector('#e_st').value;
        p.phone = val(el, '#e_ph') || p.phone;
        closeOverlays(); refresh();
        ok(L('Record saved', 'حُفظ السجل'), `${p.lat} · ${p.ar}`,
           { action: { label: L('Undo', 'تراجع'), fn: () => { Object.assign(p, before); refresh(); } } });
      });
    }
  });
}

/* How someone sits in a household: the tree draws parents above the head's row, children and
   grandchildren below, and guardians and other relatives beside it. */
export const RELS = [['parent', 'Parent', 'والد/والدة'], ['head', 'Head of household', 'ربّ العائلة'], ['spouse', 'Spouse', 'زوج/زوجة'],
                     ['sibling', 'Brother or sister', 'أخ/أخت'], ['child', 'Child', 'ابن/ابنة'], ['grandchild', 'Grandchild', 'حفيد/حفيدة'],
                     ['guardian', 'Guardian', 'وصيّ'], ['relative', 'Other relative', 'قريب آخر']];
export const relOf = (p, h) => p.rel || (h?.head === p.id ? 'head' : 'relative');
const relSelect = (id, cur) => `<select class="select" id="${id}">${RELS.map(([v, en, ar]) =>
  `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(L(en, ar))}</option>`).join('')}</select>`;

/* Put a person in a household (taking them out of any other one) and return how to undo it. */
function joinHousehold(p, h, rel, emergency) {
  const prev = D.HOUSEHOLDS.find(x => x.members.includes(p.id));
  const before = { p: { hh: p.hh, rel: p.rel, emergency: p.emergency }, prev: prev && { members: prev.members.slice(), head: prev.head },
                   h: { members: h.members.slice(), head: h.head } };
  if (prev && prev !== h) { prev.members = prev.members.filter(m => m !== p.id); if (prev.head === p.id) prev.head = prev.members[0] || null; }
  if (!h.members.includes(p.id)) h.members.push(p.id);
  Object.assign(p, { hh: h.id, rel, emergency });
  if (rel === 'head') h.head = p.id; else if (h.head === p.id) h.head = h.members.find(m => m !== p.id) || null;
  return () => { Object.assign(p, before.p); if (prev) Object.assign(prev, before.prev); Object.assign(h, before.h); };
}

export function relationEdit(pid) {
  const p = D.person(pid); if (!p) return;
  const h = D.HOUSEHOLDS.find(x => x.id === p.hh);
  openModal({
    title: L('Relationship', 'صلة القرابة'), sub: esc(nameOf(p)) + (h ? ` · ${esc(L(h.name, h.ar))}` : ''),
    body: `<div class="formrow"><label class="label" for="relsel">${L('Role in the household', 'الدور في العائلة')}</label>${relSelect('relsel', relOf(p, h))}</div>
      <div class="stack" style="gap:10px">${C.checkRow(L('Emergency contact', 'جهة اتصال في الطوارئ'), { checked: !!p.emergency, id: 'rel_em' })}
      ${C.checkRow(L('May collect children', 'مفوَّض باستلام الأطفال'), { checked: !!p.canCollect, id: 'rel_cc' })}</div>`,
    foot: `${h ? `<button class="btn btn-danger-quiet" id="relout">${L('Remove from household', 'إخراج من العائلة')}</button>` : ''}
      <button class="btn btn-secondary" data-close style="margin-inline-start:auto">${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="relok">${L('Save', 'حفظ')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#relok').addEventListener('click', () => {
        const canCollect = p.canCollect;
        const undo = h ? joinHousehold(p, h, el.querySelector('#relsel').value, el.querySelector('#rel_em').checked)
                       : (() => { const b = { rel: p.rel, emergency: p.emergency }; p.rel = el.querySelector('#relsel').value; p.emergency = el.querySelector('#rel_em').checked; return () => Object.assign(p, b); })();
        p.canCollect = el.querySelector('#rel_cc').checked;
        closeOverlays(); refresh();
        ok(L('Relationship saved', 'حُفظت الصلة'), `${nameOf(p)} · ${L(...RELS.find(r => r[0] === p.rel).slice(1))}`,
           { action: { label: L('Undo', 'تراجع'), fn: () => { undo(); p.canCollect = canCollect; refresh(); } } });
      });
      el.querySelector('#relout')?.addEventListener('click', () => {
        const before = { members: h.members.slice(), head: h.head, p: { hh: p.hh, rel: p.rel, emergency: p.emergency } };
        h.members = h.members.filter(m => m !== p.id); if (h.head === p.id) h.head = h.members[0] || null;
        Object.assign(p, { hh: null }); delete p.rel; delete p.emergency;
        closeOverlays(); refresh();
        ok(L('Removed from the household', 'أُخرج من العائلة'), L(`${nameOf(p)} is recorded on their own now.`, `${nameOf(p)} مسجّل بمفرده الآن.`),
           { action: { label: L('Undo', 'تراجع'), fn: () => { Object.assign(h, { members: before.members, head: before.head }); Object.assign(p, before.p); refresh(); } } });
      });
    }
  });
}

/** From a household: bring someone in. From a person (hid omitted): choose their household. */
export function familyAdd(hid, pid) {
  const fixedH = hid && D.HOUSEHOLDS.find(x => x.id === hid), fixedP = pid && D.person(pid);
  const pickP = !fixedP, pickH = !fixedH;
  openModal({
    title: fixedH ? L('Add a family member', 'إضافة فرد إلى العائلة') : L('Link to a household', 'ربط بعائلة'),
    sub: fixedH ? esc(L(fixedH.name, fixedH.ar)) : esc(nameOf(fixedP)),
    body: `${pickP ? `<div class="formrow"><label class="label" for="fa_p">${L('Person', 'الشخص')}</label><select class="select" id="fa_p">
        ${D.PEOPLE.filter(x => !fixedH || !fixedH.members.includes(x.id)).map(x => { const h2 = D.HOUSEHOLDS.find(y => y.members.includes(x.id));
          return `<option value="${x.id}">${esc(nameOf(x))}${h2 ? ` — ${esc(L(`now in ${h2.name}`, `حالياً في ${h2.ar}`))}` : ''}</option>`; }).join('')}</select></div>` : ''}
      ${pickH ? `<div class="formrow"><label class="label" for="fa_h">${L('Household', 'العائلة')}</label><select class="select" id="fa_h">
        ${D.HOUSEHOLDS.map(x => `<option value="${x.id}">${esc(L(x.name, x.ar))} · ${esc(L(x.town, x.townAr))}</option>`).join('')}</select></div>` : ''}
      <div class="formrow"><label class="label" for="fa_rel">${L('Relationship', 'الصلة')}</label>${relSelect('fa_rel', 'child')}</div>
      ${C.checkRow(L('Emergency contact', 'جهة اتصال في الطوارئ'), { id: 'fa_em' })}
      <p class="help" style="margin-top:10px">${L('Someone who is in another household is moved here; their record and history move with them.', 'من هو في عائلة أخرى يُنقل إلى هنا؛ ويرافقه سجلّه وتاريخه.')}</p>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="fa_go" style="margin-inline-start:auto">${fixedH ? L('Add to household', 'إضافة إلى العائلة') : L('Link', 'ربط')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#fa_go').addEventListener('click', () => {
        const p = fixedP || D.person(el.querySelector('#fa_p')?.value), h = fixedH || D.HOUSEHOLDS.find(x => x.id === el.querySelector('#fa_h')?.value);
        if (!p || !h) return toast(L('Choose who and where', 'اختر الشخص والعائلة'), '', 'warning');
        const undo = joinHousehold(p, h, el.querySelector('#fa_rel').value, el.querySelector('#fa_em').checked);
        closeOverlays(); refresh();
        ok(L('Family updated', 'حُدّثت العائلة'), `${nameOf(p)} · ${L(h.name, h.ar)}`, { action: { label: L('Undo', 'تراجع'), fn: () => { undo(); refresh(); } } });
      });
    }
  });
}

export function noteNew(pid) {
  openDrawer({
    title: L('New pastoral note', 'ملاحظة رعوية جديدة'),
    sub: L('Visible to the parish priest only. Confession content is never recorded.', 'للكاهن وحده. ولا يُسجَّل مضمون الاعتراف أبداً.'),
    body: `${pid ? `<div class="formrow"><label class="label">${L('About', 'بشأن')}</label>${who(D.person(pid))}</div>`
                 : C.personPicker(L('About', 'بشأن'), 'npp')}
      ${C.textarea({ label: L('Note', 'الملاحظة'), id: 'ntbody', max: 500 })}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="ntgo" style="margin-inline-start:auto">${L('Save note', 'حفظ الملاحظة')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#ntgo').addEventListener('click', () => {
        if (!need(el, '#ntbody', L('Write the note first', 'اكتب الملاحظة أولاً'))) return;
        const body = val(el, '#ntbody');
        const typed = val(el, '#npp').toLowerCase();
        const who2 = pid || (D.PEOPLE.find(x => typed && (x.lat.toLowerCase().includes(typed) || x.ar.includes(typed)))?.id) || 'p1';
        D.NOTES.unshift({ id: 'nt' + Date.now(), p: who2, at: '4 Oct 2026', body, bodyAr: body });
        closeOverlays(); refresh(); ok(L('Note saved', 'حُفظت الملاحظة'), L('Priest only.', 'للكاهن فقط.'));
      });
    }
  });
}

export function noteEdit(id) {
  const n = D.NOTES.find(x => x.id === id); if (!n) return;
  openDrawer({
    title: L('Edit note', 'تعديل الملاحظة'), sub: esc(nameOf(D.person(n.p))) + ' · ' + n.at,
    body: C.textarea({ label: L('Note', 'الملاحظة'), id: 'nebody', max: 500, value: L(n.body, n.bodyAr) }),
    foot: `<button class="btn btn-danger-quiet" id="nedel">${icon('trash', 16)}${L('Delete', 'حذف')}</button>
      <button class="btn btn-secondary" data-close style="margin-inline-start:auto">${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="nesave">${L('Save', 'حفظ')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#nesave').addEventListener('click', () => {
        n.body = n.bodyAr = val(el, '#nebody'); closeOverlays(); refresh(); ok(L('Note updated', 'حُدّثت الملاحظة'));
      });
      el.querySelector('#nedel').addEventListener('click', () => {
        const i = D.NOTES.indexOf(n); D.NOTES.splice(i, 1); closeOverlays(); refresh();
        ok(L('Note deleted', 'حُذفت الملاحظة'), '', { action: { label: L('Undo', 'تراجع'), fn: () => { D.NOTES.splice(i, 0, n); refresh(); } } });
      });
    }
  });
}

/* ═════════════ groups ═════════════ */
export function memberAdd(gid = curGroup()) {
  const d = D.groupInfo(gid);
  pickPerson({
    title: L('Add a member', 'إضافة عضو'), sub: esc(L(D.group(gid)?.name || '', D.group(gid)?.ar || '')),
    cta: L('Add to group', 'إضافة إلى المجموعة'), exclude: d.roster.map(r => r.p),
    onPick: p => {
      d.roster.push({ p: p.id, role: 'Member', roleAr: 'عضو', joined: '2026', att: 0 });
      const g = D.group(gid); if (g) g.members += 1;
      refresh();
      ok(L('Added to the group', 'أُضيف إلى المجموعة'), nameOf(p),
         { action: { label: L('Undo', 'تراجع'), fn: () => { d.roster.pop(); if (g) g.members -= 1; refresh(); } } });
    }
  });
}

export function meetingNew() {
  openDrawer({
    title: L('Schedule a meeting', 'جدولة اجتماع'),
    body: `<div class="formgrid">${C.field({ label: L('Date', 'التاريخ'), type: 'date', value: '2026-10-16', id: 'm_d' })}
        ${C.field({ label: L('Time', 'الوقت'), type: 'time', value: '19:00', id: 'm_t' })}</div>
      <div class="formrow"><label class="label">${L('Repeats', 'التكرار')}</label><select class="select">
        <option>${L('Every week', 'كل أسبوع')}</option><option>${L('Every two weeks', 'كل أسبوعين')}</option><option>${L('Once', 'مرّة')}</option></select></div>
      <div class="stack" style="gap:10px">${C.checkRow(L('Ask members to RSVP', 'طلب تأكيد الحضور'), { checked: true })}
        ${C.checkRow(L('Remind them 24 hours before', 'تذكير قبل ٢٤ ساعة'), { checked: true })}</div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="m_go" style="margin-inline-start:auto">${L('Schedule', 'جدولة')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#m_go').addEventListener('click', () => {
        gd().meetings.unshift({ d: val(el, '#m_d'), t: val(el, '#m_t'), rsvp: { yes: 0, no: 0, none: 24 }, done: false });
        closeOverlays(); refresh(); ok(L('Meeting scheduled', 'جُدول الاجتماع'), `${fmtDate(val(el, '#m_d'))} · ${val(el, '#m_t')}`);
      });
    }
  });
}

export function postAdd(btn) {
  const body = btn.closest('.panel')?.querySelector('.rte-body')?.innerText.trim();
  if (!body) return toast(L('Write something first', 'اكتب شيئاً أولاً'), '', 'warning');
  gd().posts.unshift({ by: 'p3', at: today, body, bodyAr: body });
  refresh(); ok(L('Posted to the group', 'نُشر في المجموعة'), L('Members are notified in the app.', 'يُبلَّغ الأعضاء داخل التطبيق.'));
}

export function taskAdd() {
  openModal({
    title: L('Add a task', 'إضافة مهمة'),
    body: `${C.field({ label: L('Task', 'المهمة'), req: true, id: 'tk_w' })}
      <div class="formgrid">${C.personPicker(L('Owner', 'المسؤول'), 'tk_o')}
        ${C.field({ label: L('Due', 'المهلة'), type: 'date', value: '2026-10-18', id: 'tk_d' })}</div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="tk_go" style="margin-inline-start:auto">${L('Add task', 'إضافة المهمة')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#tk_go').addEventListener('click', () => {
        if (!need(el, '#tk_w', L('Name the task', 'سمّ المهمة'))) return; const w = val(el, '#tk_w');
        gd().tasks.unshift({ what: w, whatAr: w, who: 'p3', due: val(el, '#tk_d'), done: false });
        closeOverlays(); refresh(); ok(L('Task added', 'أُضيفت المهمة'), w);
      });
    }
  });
}

export function milestoneRecord(i) {
  const m = gd().milestones[+i]; if (!m) return;
  pickPerson({
    title: L('Record completion', 'تسجيل إنجاز'), sub: esc(L(m[0], m[1])),
    cta: L('Record', 'تسجيل'),
    onPick: p => { m[2] += 1; refresh(); ok(L('Milestone recorded', 'سُجّلت المحطة'), `${nameOf(p)} · ${L(m[0], m[1])}`); }
  });
}

export function handover() {
  openDrawer({
    title: L('Leadership handover', 'تسليم المسؤولية'),
    sub: L('The role moves; open tasks follow it; permissions are reviewed automatically.', 'ينتقل الدور؛ وتتبعه المهام؛ وتُراجَع الصلاحيات تلقائياً.'),
    body: `<div class="formrow"><label class="label">${L('From', 'من')}</label>${who(D.person('p3'))}</div>
      ${C.personPicker(L('To', 'إلى'), 'ho_to')}
      ${C.field({ label: L('Effective from', 'اعتباراً من'), type: 'date', value: '2026-11-01', id: 'ho_d' })}
      ${C.inlineAlert('info', L(`${gd().tasks.filter(x => !x.done).length} open tasks move with the role`, `${gd().tasks.filter(x => !x.done).length} مهام مفتوحة تنتقل مع الدور`),
        L('Nothing stays attached to the outgoing leader by accident.', 'لا يبقى شيء عالقاً بالمسؤول السابق.'))}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="ho_go" style="margin-inline-start:auto">${L('Start handover', 'بدء التسليم')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#ho_go').addEventListener('click', () => {
        const to = val(el, '#ho_to') || L('the new leader', 'المسؤول الجديد');
        gd().history.unshift([`Handover to ${to} scheduled`, `جُدول التسليم إلى ${to}`, val(el, '#ho_d')]);
        closeOverlays(); refresh(); ok(L('Handover scheduled', 'جُدول التسليم'), `${to} · ${fmtDate(val(el, '#ho_d'))}`);
      });
    }
  });
}

/* ═════════════ calendar & services ═════════════ */
export function calShift(n) { S.ui.calOffset = n === 0 ? 0 : S.ui.calOffset + n; refresh(); }
export function calDay(n) {
  const [y, m, d] = (S.ui.calDay || '2026-10-04').split('-').map(Number);
  const x = n ? new Date(y, m - 1, d + n) : new Date(D.TODAY);
  S.ui.calDay = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  refresh();
}

export function eventDuplicate(id) {
  const e = D.EVENTS.find(x => x.id === id) || D.EVENTS[9];
  const d = new Date(e.d); d.setDate(d.getDate() + 7);
  const copy = { ...e, id: 'ev' + Date.now(), d: d.toISOString().slice(0, 10) };
  D.EVENTS.push(copy);
  closeOverlays(); refresh();
  ok(L('Event duplicated', 'نُسخ الحدث'), `${L(e.title, e.titleAr)} · ${fmtDate(copy.d)}`,
     { action: { label: L('Undo', 'تراجع'), fn: () => { D.EVENTS.splice(D.EVENTS.indexOf(copy), 1); refresh(); } } });
}

export function eventCancel(id) {
  const i = D.EVENTS.findIndex(x => x.id === id); if (i < 0) return;
  const [e] = D.EVENTS.splice(i, 1);
  closeOverlays(); refresh();
  ok(L('Event cancelled', 'أُلغي الحدث'), L('Everyone who said yes has been told.', 'أُبلغ كل من أكّد حضوره.'),
     { action: { label: L('Undo', 'تراجع'), fn: () => { D.EVENTS.splice(i, 0, e); refresh(); } } });
}

export function svcItemAdd() {
  openDrawer({
    title: L('Add to the order of service', 'إضافة إلى ترتيب الخدمة'),
    body: `<div class="formgrid">${C.field({ label: L('Item (English)', 'البند (إنكليزي)'), req: true, id: 'si_en' })}
        ${C.field({ label: L('Item (Arabic)', 'البند (عربي)'), dir: 'rtl', ar: true, id: 'si_ar' })}</div>
      <div class="formgrid">${C.stepper({ label: L('Minutes', 'الدقائق'), value: 3, id: 'si_min' })}
        <div class="formrow"><label class="label">${L('Led by', 'يقوده')}</label><select class="select" id="si_who">
          <option value="p17">Fr. Antoine Khoury</option><option value="g1">${L('Saint Elias Choir', 'جوقة مار الياس')}</option>
          <option value="p6">Carla Abou Jaoude</option></select></div></div>
      ${C.field({ label: L('Instructions', 'تعليمات'), id: 'si_note' })}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="si_go" style="margin-inline-start:auto">${L('Add item', 'إضافة البند')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#si_go').addEventListener('click', () => {
        if (!need(el, '#si_en', L('Name the item', 'سمّ البند'))) return; const en = val(el, '#si_en');
        D.SERVICE.order.push({ dur: val(el, '#si_min') || '3', t: en, ar: val(el, '#si_ar') || en,
          note: val(el, '#si_note'), noteAr: val(el, '#si_note'), who: el.querySelector('#si_who').value });
        closeOverlays(); refresh(); ok(L('Added to the order', 'أُضيف إلى الترتيب'), en);
      });
    }
  });
}

export function svcItemMenu(btn, i) {
  i = +i; const o = D.SERVICE.order;
  const move = d => { const j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; refresh(); };
  openMenu(btn, [
    { label: L('Move up', 'نقل للأعلى'), icon: 'chevL', fn: () => move(-1) },
    { label: L('Move down', 'نقل للأسفل'), icon: 'chevR', fn: () => move(1) },
    { sep: true },
    { label: L('Remove', 'إزالة'), icon: 'trash', danger: true, fn: () => {
      const [it] = o.splice(i, 1); refresh();
      ok(L('Removed from the order', 'أُزيل من الترتيب'), it.t, { action: { label: L('Undo', 'تراجع'), fn: () => { o.splice(i, 0, it); refresh(); } } });
    } }
  ]);
}

export function svcTemplateUse(i) {
  const tpl = D.SERVICE_TEMPLATES[+i];
  go('services');
  setTimeout(() => ok(L('Template applied', 'طُبّق القالب'), tpl ? L(tpl[0], tpl[1]) : ''), 200);
}

export function addToService(mid) {
  const m = D.MUSIC.find(x => x.id === mid); if (!m) return;
  const item = { dur: '4', t: `Hymn — ${m.title}`, ar: `لحن — ${m.ar}`, note: `Key: ${m.key}`, noteAr: `المقام: ${m.key}`, who: 'g1' };
  D.SERVICE.order.splice(D.SERVICE.order.length - 1, 0, item);
  ok(L('Added to Sunday Mass 10:30', 'أُضيف إلى قدّاس الأحد ١٠:٣٠'), `${m.title} · ${m.key}`,
     { action: { label: L('Open plan', 'فتح الخطة'), fn: () => go('services') } });
}

/* ═════════════ music ═════════════ */
let playTimer;
export function play(mid) {
  const m = D.MUSIC.find(x => x.id === mid) || D.MUSIC[0];
  document.querySelector('.player')?.remove(); clearInterval(playTimer);
  const el = document.createElement('div');
  el.className = 'player';
  el.innerHTML = `<button class="iconbtn" data-pp aria-label="${L('Pause', 'إيقاف')}">${icon('pause', 18)}</button>
    <span class="pmeta"><b>${esc(m.title)}</b><small style="font-family:var(--arabic)">${esc(m.ar)} · ${esc(m.key)}</small></span>
    <span class="ptrack"><i></i></span><span class="ptime mono">0:00 / 3:12</span>
    <button class="iconbtn" data-px aria-label="${L('Close', 'إغلاق')}">${icon('close', 16)}</button>`;
  document.body.append(el);
  let s = 0, playing = true; const total = 192;
  const tick = () => {
    if (!playing) return;
    s = Math.min(total, s + 1);
    el.querySelector('.ptrack i').style.width = `${s / total * 100}%`;
    el.querySelector('.ptime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} / 3:12`;
    if (s >= total) clearInterval(playTimer);
  };
  playTimer = setInterval(tick, 1000);
  el.querySelector('[data-pp]').addEventListener('click', e => {
    playing = !playing;
    e.currentTarget.innerHTML = icon(playing ? 'pause' : 'play', 18);
  });
  el.querySelector('[data-px]').addEventListener('click', () => { clearInterval(playTimer); el.remove(); });
}

export function setlistOpen(id) {
  const s = D.SETLISTS.find(x => x.id === id) || D.SETLISTS[0];
  openDrawer({
    title: L(s.name, s.ar), sub: s.service ? L('Linked to Sunday Mass 10:30', 'مرتبطة بقدّاس الأحد ١٠:٣٠') : L('Not linked to a service yet', 'غير مرتبطة بخدمة بعد'),
    body: s.items.map((mid, i) => { const m = D.MUSIC.find(x => x.id === mid); return m ? `<div class="listrow" style="padding-inline:0">
      <span class="mono dim" style="width:22px">${i + 1}</span><span class="grow"><b>${esc(m.title)}</b>
      <small style="font-family:var(--arabic)">${esc(m.ar)} · ${esc(m.key)}</small></span>
      <button class="iconbtn" data-play="${m.id}" aria-label="${L('Play', 'استماع')}">${icon('play', 16)}</button></div>` : ''; }).join(''),
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
      <button class="btn btn-primary" id="sl_print" style="margin-inline-start:auto">${icon('print', 16)}${L('Print choir folder', 'طباعة ملف الجوقة')}</button>`,
    onMount(el) {
      el.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => play(b.dataset.play)));
      el.querySelector('#sl_print').addEventListener('click', () => { closeOverlays(); setTimeout(() => window.print(), 250); });
    }
  });
}

/* ═════════════ volunteers ═════════════ */
export function sheetOpen(id) {
  const s = D.SIGNUP_SHEETS.find(x => x.id === id) || D.SIGNUP_SHEETS[0];
  const names = ['p6', 'p8', 'p14', 'p5', 'p16', 'p9', 'p12', 'p11', 'p4', 'p7', 'p2', 'p3'].slice(0, s.taken);
  openDrawer({
    title: L(s.what, s.whatAr), sub: `${s.taken} / ${s.slots} · ${L('closes', 'يقفل')} ${fmtDate(s.deadline)}`,
    body: `<div class="stack">${Array.from({ length: s.slots }, (_, i) => {
      const p = D.person(names[i]);
      return `<div class="listrow" style="padding-inline:0"><span class="mono dim" style="width:26px">${i + 1}</span>
        ${p ? who(p) : `<span class="dim">${L('Open place', 'مركز شاغر')}</span>`}<span class="grow"></span>
        ${p ? pill(L('Signed up', 'مسجَّل'), 'success') : `<button class="btn btn-secondary btn-dense" data-slot="${i}">${L('Sign someone up', 'سجّل شخصاً')}</button>`}</div>`;
    }).join('')}</div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
      <button class="btn btn-primary" id="sh_share" style="margin-inline-start:auto">${icon('link', 16)}${L('Share sign-up link', 'مشاركة رابط التسجيل')}</button>`,
    onMount(el) {
      el.querySelectorAll('[data-slot]').forEach(b => b.addEventListener('click', () => {
        closeOverlays();
        pickPerson({ title: L('Sign someone up', 'تسجيل شخص'), cta: L('Sign up', 'تسجيل'),
          onPick: p => { s.taken = Math.min(s.slots, s.taken + 1); refresh(); ok(L('Signed up', 'سُجّل'), nameOf(p)); } });
      }));
      el.querySelector('#sh_share').addEventListener('click', () => { closeOverlays();
        share({ title: L(s.what, s.whatAr), url: `${location.origin}${location.pathname}#/volunteers/sheets` }); });
    }
  });
}

/* ═════════════ registration ═════════════ */
export function formNew() {
  openDrawer({
    title: L('New registration form', 'استمارة تسجيل جديدة'),
    body: `${C.field({ label: L('Event', 'الحدث'), req: true, id: 'rf_e', ph: L('Christmas concert', 'حفل الميلاد') })}
      <div class="formgrid">${C.stepper({ label: L('Capacity', 'السعة'), value: 60, id: 'rf_cap' })}
        ${C.field({ label: L('Closes', 'يقفل'), type: 'date', value: '2026-11-30', id: 'rf_dl' })}</div>
      ${C.currencyField({ label: L('Fee', 'الرسم'), value: '0.00', id: 'rf_fee' })}
      <div class="stack" style="gap:10px">${C.checkRow(L('Household registration', 'تسجيل عائلي'), { checked: true })}
        ${C.checkRow(L('Waiting list once full', 'لائحة انتظار عند الامتلاء'), { checked: true })}
        ${C.checkRow(L('Parental consent for under-18s', 'موافقة الأهل لمن دون ١٨'), { checked: true })}</div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="rf_go" style="margin-inline-start:auto">${L('Create form', 'إنشاء الاستمارة')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#rf_go').addEventListener('click', () => {
        if (!need(el, '#rf_e', L('Name the event', 'سمّ الحدث'))) return; const e = val(el, '#rf_e');
        D.REGISTRATIONS.unshift({ id: 'rg' + Date.now(), event: e, eventAr: e, open: true, cap: +val(el, '#rf_cap') || 60,
          taken: 0, fee: parseFloat(val(el, '#rf_fee')) || 0, deadline: val(el, '#rf_dl'), waiting: 0 });
        closeOverlays(); refresh(); ok(L('Form created and open', 'أُنشئت الاستمارة وفُتحت'), e);
      });
    }
  });
}

export function fieldAdd() {
  openModal({
    title: L('Add a field', 'إضافة حقل'),
    body: `<div class="formgrid">${C.field({ label: L('Label (English)', 'التسمية (إنكليزي)'), req: true, id: 'ff_en' })}
        ${C.field({ label: L('Label (Arabic)', 'التسمية (عربي)'), dir: 'rtl', ar: true, id: 'ff_ar' })}</div>
      <div class="formrow"><label class="label">${L('Type', 'النوع')}</label><select class="select" id="ff_t">
        <option value="text">${L('Short text', 'نصّ قصير')}</option><option value="choice">${L('Choice', 'اختيار')}</option>
        <option value="date">${L('Date', 'تاريخ')}</option><option value="file">${L('File', 'ملف')}</option>
        <option value="consent">${L('Consent', 'موافقة')}</option><option value="restricted">${L('Restricted (medical)', 'مقيّد (طبي)')}</option></select></div>
      ${C.checkRow(L('Required', 'إلزامي'))}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="ff_go" style="margin-inline-start:auto">${L('Add field', 'إضافة الحقل')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#ff_go').addEventListener('click', () => {
        if (!need(el, '#ff_en', L('Give it a label', 'أعطه تسمية'))) return; const en = val(el, '#ff_en');
        D.REG_FORM.fields.push([en, val(el, '#ff_ar') || en, el.querySelector('#ff_t').value,
          el.querySelector('.check input').checked, '', '']);
        closeOverlays(); refresh(); ok(L('Field added', 'أُضيف الحقل'), en);
      });
    }
  });
}

export function fieldMenu(btn, i) {
  const f = D.REG_FORM.fields; i = +i;
  openMenu(btn, [
    { label: L('Make required', 'اجعله إلزامياً'), icon: 'check', fn: () => { f[i][3] = true; refresh(); ok(L('Now required', 'صار إلزامياً')); } },
    { label: L('Move up', 'نقل للأعلى'), icon: 'chevL', fn: () => { if (i > 0) { [f[i - 1], f[i]] = [f[i], f[i - 1]]; refresh(); } } },
    { sep: true },
    { label: L('Remove field', 'إزالة الحقل'), icon: 'trash', danger: true, fn: () => {
      const [x] = f.splice(i, 1); refresh();
      ok(L('Field removed', 'أُزيل الحقل'), L(x[0], x[1]), { action: { label: L('Undo', 'تراجع'), fn: () => { f.splice(i, 0, x); refresh(); } } });
    } }
  ]);
}

/* ═════════════ check-in ═════════════ */
export function scan() {
  openModal({
    title: L('Scan a code', 'مسح رمز'),
    sub: L('Point the camera at a registration QR or a family card.', 'وجّه الكاميرا إلى رمز التسجيل أو بطاقة العائلة.'),
    body: `<div class="scanner"><div class="vf"><span></span><span></span><span></span><span></span><i class="beam"></i></div></div>
      <div class="formrow" style="margin-top:16px"><label class="label">${L('…or type the reference', '…أو اكتب الرقم')}</label>
        <input class="input mono" id="sc_code" value="RG-2026-0419" dir="ltr"></div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="sc_go" style="margin-inline-start:auto">${L('Check in', 'تسجيل الدخول')}</button>`,
    onMount(el) {
      const found = () => {
        const kid = D.person('p19');
        if (!D.CHECKIN.rows.find(r => r.p === 'p19')) {
          D.CHECKIN.rows.push({ p: 'p19', in: '19:31', out: null, guardian: 'Nada Haddad', code: '4471', alert: '' });
          D.CHECKIN.present += 1;
        }
        closeOverlays(); refresh();
        ok(L('Checked in', 'سُجّل الدخول'), `${nameOf(kid)} · ${L('Catechism Room A', 'صف التعليم أ')} · ${L('guardian code', 'رمز وليّ الأمر')} 4471`);
      };
      const t0 = setTimeout(found, 2600);
      el.querySelector('#sc_go').addEventListener('click', () => { clearTimeout(t0); found(); });
      el.querySelector('[data-close]')?.addEventListener('click', () => clearTimeout(t0));
    }
  });
}

export function checkinManual() {
  pickPerson({
    title: L('Manual check-in', 'تسجيل يدوي'),
    sub: L('A guardian code is generated and printed on the tag.', 'يُولَّد رمز لوليّ الأمر ويُطبع على البطاقة.'),
    cta: L('Check in', 'تسجيل الدخول'), exclude: D.CHECKIN.rows.map(r => r.p),
    onPick: p => {
      const code = String(1000 + Math.floor(Math.random() * 9000));
      D.CHECKIN.rows.push({ p: p.id, in: '19:31', out: null, guardian: '—', code, alert: '' });
      D.CHECKIN.present += 1; refresh();
      ok(L('Checked in', 'سُجّل الدخول'), `${nameOf(p)} · ${L('code', 'الرمز')} ${code}`);
    }
  });
}

export function pickupAdd(pid) {
  openModal({
    title: L('Add an authorised person', 'إضافة شخص مفوَّض'), sub: esc(nameOf(D.person(pid))),
    body: `<div class="formgrid">${C.field({ label: L('Name (Latin)', 'الاسم (لاتيني)'), req: true, id: 'pk_en' })}
        ${C.field({ label: L('Name (Arabic)', 'الاسم (عربي)'), dir: 'rtl', ar: true, id: 'pk_ar' })}</div>
      <div class="formrow"><label class="label">${L('Relationship', 'الصلة')}</label><select class="select" id="pk_r">
        <option>grandparent</option><option>aunt</option><option>uncle</option><option>family friend</option></select></div>
      ${C.checkRow(L('ID checked by a member of staff', 'تحقّق موظّف من الهوية'), { checked: true })}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="pk_go" style="margin-inline-start:auto">${L('Authorise', 'تفويض')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#pk_go').addEventListener('click', () => {
        if (!need(el, '#pk_en', L('Enter a name', 'أدخل اسماً'))) return; const en = val(el, '#pk_en');
        D.PICKUP[pid].approved.push([en, val(el, '#pk_ar') || en, el.querySelector('#pk_r').value]);
        closeOverlays(); refresh(); ok(L('Authorised to collect', 'مفوَّض بالاستلام'), en);
      });
    }
  });
}

export function pickupRemove(pid, i) {
  const list = D.PICKUP[pid].approved; const [x] = list.splice(+i, 1); refresh();
  ok(L('No longer authorised', 'لم يعد مفوَّضاً'), L(x[0], x[1]),
     { action: { label: L('Undo', 'تراجع'), fn: () => { list.splice(+i, 0, x); refresh(); } } });
}

export function incidentNew() {
  openDrawer({
    title: L('Record an incident', 'تسجيل حادث'),
    sub: L('Restricted to the priest and the safeguarding lead. Opening it is logged.', 'مقيّد للكاهن ومسؤول الحماية. وفتحه يُسجَّل.'),
    body: `${C.personPicker(L('Child involved', 'الطفل المعني'), 'in_p')}
      <div class="formrow"><label class="label">${L('Where', 'أين')}</label><select class="select" id="in_room">
        ${D.VENUES.map(v => `<option value="${v.id}">${esc(L(v.name, v.ar))}</option>`).join('')}</select></div>
      ${C.textarea({ label: L('What happened', 'ما حدث'), id: 'in_what', max: 600 })}
      ${C.checkRow(L('Guardian informed', 'أُبلغ وليّ الأمر'), { checked: true })}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="in_go" style="margin-inline-start:auto">${L('Save report', 'حفظ التقرير')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#in_go').addEventListener('click', () => {
        if (!need(el, '#in_what', L('Describe what happened', 'صف ما حدث'))) return; const w = val(el, '#in_what');
        D.INCIDENTS.unshift({ id: 'in' + Date.now(), at: '2026-10-04 19:31', room: el.querySelector('#in_room').value,
          what: w, whatAr: w, by: 'p16', restricted: true });
        closeOverlays(); refresh(); ok(L('Report saved', 'حُفظ التقرير'), L('Restricted and logged.', 'مقيّد ومسجَّل.'));
      });
    }
  });
}

export function incidentOpen(id) {
  const i = D.INCIDENTS.find(x => x.id === id) || D.INCIDENTS[0];
  openDrawer({
    title: L('Incident report', 'تقرير حادث'), sub: `<span class="mono">${esc(i.at)}</span> · ${esc(L(D.venue(i.room).name, D.venue(i.room).ar))}`,
    body: `${C.inlineAlert('warning', L('Restricted record', 'سجل مقيّد'), L('Your access to this report has been logged.', 'سُجّل وصولك إلى هذا التقرير.'))}
      <dl class="dl" style="margin-top:16px"><dt>${L('Recorded by', 'سجّله')}</dt><dd>${esc(nameOf(D.person(i.by)))}</dd>
        <dt>${L('When', 'متى')}</dt><dd class="mono">${esc(i.at)}</dd></dl>
      <p class="t-body" style="margin-top:14px;font-size:14px">${esc(L(i.what, i.whatAr))}</p>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
      <button class="btn btn-secondary" id="io_print" style="margin-inline-start:auto">${icon('print', 16)}${L('Print', 'طباعة')}</button>`,
    onMount(el) { el.querySelector('#io_print').addEventListener('click', () => { closeOverlays(); setTimeout(() => window.print(), 250); }); }
  });
}

/* ═════════════ facilities ═════════════ */
/* ═════════════ portal ═════════════ */
export function contentEdit(key = 'history') {
  const c = D.CONTENT[key] || D.CONTENT.history;
  openDrawer({
    large: true, title: L('Edit parish content', 'تعديل محتوى الرعية'),
    sub: L('What families see when they open the parish link.', 'ما تراه العائلات عند فتح رابط الرعية.'),
    body: `<div class="formrow"><label class="label">${L('Parish history and the patron saint', 'تاريخ الرعية والشفيع')}</label>
      ${C.richText(esc(L(c.en, c.ar)))}</div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-secondary" id="ce_prev">${L('Preview', 'معاينة')}</button>
      <button class="btn btn-primary" id="ce_go" style="margin-inline-start:auto">${L('Publish', 'نشر')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#ce_go').addEventListener('click', () => {
        const txt = el.querySelector('.rte-body').innerText.trim();
        if (isAr()) c.ar = txt; else c.en = txt;
        closeOverlays(); refresh(); ok(L('Published', 'نُشر'), L('Live on the parish page now.', 'منشور على صفحة الرعية الآن.'));
      });
      el.querySelector('#ce_prev').addEventListener('click', () => window.open('landing.html', '_blank', 'noopener'));
    }
  });
}

/* ═════════════ giving ═════════════ */
export function lineEdit(i) {
  const l = D.BATCH.lines[+i]; if (!l) return;
  openModal({
    title: L('Edit envelope', 'تعديل المظروف'), sub: l.env ? `<span class="mono">${l.env}</span>` : L('Unattributed', 'غير مسمّى'),
    body: C.currencyField({ label: L('Amount', 'المبلغ'), value: (l.usd || (l.lbp / D.RATE.value)).toFixed(2), id: 'le_amt' }),
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="le_go" style="margin-inline-start:auto">${L('Save', 'حفظ')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#le_go').addEventListener('click', () => {
        const before = { ...l }, v = parseFloat(val(el, '#le_amt').replace(/,/g, '')) || 0;
        if (l.usd != null) l.usd = v; else l.lbp = Math.round(v * D.RATE.value);
        closeOverlays(); refresh();
        ok(L('Envelope corrected', 'صُحّح المظروف'), usd(v), { action: { label: L('Undo', 'تراجع'), fn: () => { Object.assign(l, before); refresh(); } } });
      });
    }
  });
}

export function lineReverse(i) {
  const lines = D.BATCH.lines; const [l] = lines.splice(+i, 1); refresh();
  toast(L('Line reversed', 'عُكس البند'), L('A reversing entry stays in the history.', 'يبقى القيد العكسي في السجل.'), 'warning',
    { action: { label: L('Undo', 'تراجع'), fn: () => { lines.splice(+i, 0, l); refresh(); } } });
}

/* ═════════════ services: requests ═════════════ */
export function svcRequestOpen(id) {
  const r = D.SERVICE_REQUESTS.find(x => x.id === id); if (!r) return;
  const reqs = D.PREP_REQUIREMENTS[r.kind.toLowerCase()] || D.PREP_REQUIREMENTS.baptism;
  openDrawer({
    title: L(r.kind, r.kindAr), sub: `${esc(nameOf(D.person(r.by)))} · ${fmtDate(r.date)}`,
    body: `<dl class="dl"><dt>${L('Status', 'الحالة')}</dt><dd>${status(r.status)}</dd>
        <dt>${L('Requested by', 'مقدَّم من')}</dt><dd>${esc(nameOf(D.person(r.by)))}</dd>
        <dt>${L('Date', 'التاريخ')}</dt><dd class="mono">${fmtDate(r.date)}</dd></dl>
      <div class="divider"></div><h4 class="t-ui" style="margin-bottom:10px">${L('Preparation', 'التحضير')}</h4>
      <div class="stack" style="gap:10px">${reqs.map(([en, ar, done]) => C.checkRow(L(en, ar), { checked: done })).join('')}</div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
      ${r.status === 'pending' ? `<button class="btn btn-primary" id="srok" style="margin-inline-start:auto">${L('Approve and schedule', 'الموافقة والجدولة')}</button>` : ''}`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#srok')?.addEventListener('click', () => {
        r.status = 'approved'; r.prep = 'complete'; closeOverlays(); refresh();
        ok(L('Approved and scheduled', 'اعتُمد وجُدول'), `${L(r.kind, r.kindAr)} · ${fmtDate(r.date)}`);
      });
    }
  });
}

export function svcRequestNew(kind = 'Mass|قدّاس') {
  const [en, ar] = kind.split('|');
  openDrawer({
    title: L(`Request — ${en}`, `طلب — ${ar}`),
    body: `${C.personPicker(L('Requested by', 'مقدَّم من'), 'sq_p')}
      <div class="formgrid">${C.field({ label: L('Preferred date', 'التاريخ المفضّل'), type: 'date', value: '2026-11-07', id: 'sq_d' })}
        ${C.field({ label: L('Time', 'الوقت'), type: 'time', value: '11:00', id: 'sq_t' })}</div>
      <div class="formrow"><label class="label">${L('Language', 'اللغة')}</label><select class="select">
        <option>${L('Arabic', 'عربي')}</option><option>${L('Arabic & Syriac', 'عربي وسرياني')}</option><option>${L('Bilingual', 'ثنائي')}</option></select></div>
      ${C.textarea({ label: L('Notes for the office', 'ملاحظات للمكتب'), id: 'sq_n', max: 400 })}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="sq_go" style="margin-inline-start:auto">${L('Send request', 'إرسال الطلب')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#sq_go').addEventListener('click', () => {
        D.SERVICE_REQUESTS.unshift({ id: 'sr' + Date.now(), kind: en, kindAr: ar, by: 'p4', date: val(el, '#sq_d'),
          prep: 'documents missing', prepAr: 'مستندات ناقصة', status: 'pending' });
        closeOverlays(); refresh(); ok(L('Request sent', 'أُرسل الطلب'), L(`${en} · with the office for review`, `${ar} · لدى المكتب للمراجعة`));
      });
    }
  });
}

export function textEdit({ title, label, value, onSave, max = 400, help = '', ph = '' }) {
  openModal({
    title, body: C.textarea({ label, id: 'txe', max, value, help, ph }),
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="txok" style="margin-inline-start:auto">${L('Save', 'حفظ')}</button>`,
    onMount(el) { C.wire(el); el.querySelector('#txok').addEventListener('click', () => { onSave(val(el, '#txe')); closeOverlays(); refresh(); ok(L('Saved', 'حُفظ')); }); }
  });
}

/** Lyrics are typed one verse per line, the three scripts split by "|"; the chord chart is plain text. */
export function hymnText(mid, what) {
  const d = D.musicInfo(D.MUSIC.find(m => m.id === mid) || { id: mid });
  if (what === 'chords') return textEdit({ title: L('Chord chart', 'جدول الأوتار'), label: L('Chords above the words', 'الأوتار فوق الكلمات'),
    value: d.chords, max: 3000, ph: 'Dm      Gm     A7     Dm', onSave: v => { d.chords = v; },
    help: L('A line of chords alone transposes; lines of words are left as they are.', 'سطر الأوتار وحده يُنقَل؛ أسطر الكلمات تبقى كما هي.') });
  textEdit({ title: L('Lyrics', 'الكلمات'), label: L('One verse per line', 'بيت في كل سطر'),
    value: d.lyrics.map(r => r.join(' | ')).join('\n'), max: 4000, ph: 'Syriac | عربي | English',
    help: L('Separate the Syriac, Arabic and English with a vertical bar: |', 'افصل السرياني والعربي والإنكليزي بخطّ عمودي: |'),
    onSave: v => { d.lyrics = v.split('\n').map(x => x.trim()).filter(Boolean).map(x => { const c = x.split('|').map(y => y.trim()); return [c[0] || '', c[1] || '', c[2] || '']; }); } });
}

/** Restoring an old version adds it as the new current one, so the history is never rewritten. */
export function hymnRestore(mid, i) {
  const d = D.musicInfo(D.MUSIC.find(m => m.id === mid) || { id: mid }), v = d.versions[+i];
  if (!v) return;
  d.versions.unshift([`Restored — ${v[0]}`, `استرجاع — ${v[1]}`, D.TODAY.toISOString().slice(0, 10), me()?.id || v[3]]);
  refresh();
  ok(L('Version restored', 'استُرجع الإصدار'), L(v[0], v[1]), { action: { label: L('Undo', 'تراجع'), fn: () => { d.versions.shift(); refresh(); } } });
}

export function memberMenu(btn, pid) {
  const d = gd(), i = d.roster.findIndex(r => r.p === pid), r = d.roster[i];
  openMenu(btn, [
    { label: L('Message', 'مراسلة'), icon: 'msg', fn: () => compose(pid) },
    { label: L('Open record', 'فتح السجل'), icon: 'people', fn: () => go('person/' + pid) },
    { label: L('Make assistant', 'تعيين مساعداً'), icon: 'check', fn: () => {
      r.role = 'Assistant'; r.roleAr = 'مساعد'; refresh(); ok(L('Role updated', 'حُدّث الدور'), nameOf(D.person(pid))); } },
    { sep: true },
    { label: L('Remove from group', 'إزالة من المجموعة'), icon: 'trash', danger: true, fn: () => {
      d.roster.splice(i, 1); refresh();
      ok(L('Removed from the group', 'أُزيل من المجموعة'), nameOf(D.person(pid)),
         { action: { label: L('Undo', 'تراجع'), fn: () => { d.roster.splice(i, 0, r); refresh(); } } });
    } }
  ]);
}

/** A row's own menu — edit, duplicate, and a destructive action kept last and apart. */
export function composeToPerson() {
  pickPerson({ title: L('Message a person', 'مراسلة شخص'), cta: L('Continue', 'متابعة'), onPick: p => compose(p.id) });
}

/* ═════════════ admin, eparchy, settings ═════════════ */
AUDIENCES.eparchy = ['All parishes in the eparchy', 'كل رعايا الأبرشية', 3];

export function confirmAction({ title, body, cta, danger = false, then }) {
  openModal({
    title, body: `<p class="t-body dim" style="font-size:14px;line-height:22px">${esc(body)}</p>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="cf_go" style="margin-inline-start:auto">${esc(cta)}</button>`,
    onMount(el) { el.querySelector('#cf_go').addEventListener('click', () => { closeOverlays(); then(); }); }
  });
}

export function parishSwitch(id) {
  const x = D.PARISHES.find(q => q.id === id); if (!x) return;
  Object.assign(D.PARISH, { name: x.name, nameAr: x.ar, town: x.town, townAr: x.townAr, people: x.people, households: x.households });
  bus.renderAll?.();
  ok(L(`Now working in ${x.name}`, `تعمل الآن في ${x.ar}`), L(`Your role here: ${x.role}`, `دورك هنا: ${x.roleAr}`));
}

export function bulkGroup(anchor, ids) {
  openMenu(anchor, D.GROUPS.slice(0, 6).map(g => ({ label: L(g.name, g.ar), icon: 'groups', fn: () => {
    g.members += ids.length || 14;
    ok(L('Added to the group', 'أُضيفوا إلى المجموعة'), `${ids.length || 14} · ${L(g.name, g.ar)}`);
  } })), { width: 250 });
}

export function ruleAdd() {
  const opts = D.FORM_FIELDS.map(f => `<option value="${f.id}">${esc(L(f.label, f.labelAr))}</option>`).join('');
  openModal({
    title: L('Add a rule', 'إضافة قاعدة'),
    body: `<div class="formgrid"><div class="formrow"><label class="label" for="ru_a">${L('Show', 'أظهر')}</label>
        <select class="select" id="ru_a">${opts}</select></div>
      <div class="formrow"><label class="label" for="ru_b">${L('When', 'حين')}</label><select class="select" id="ru_b">${opts}</select></div>
      <div class="formrow"><label class="label" for="ru_op">${L('Is', 'يكون')}</label><select class="select" id="ru_op">
        <option value="=">${L('equal to', 'مساوياً لـ')}</option><option value="≠">${L('not equal to', 'غير مساوٍ لـ')}</option></select></div>
      ${C.field({ label: L('Value', 'القيمة'), req: true, id: 'ru_v', ph: L('the person signed in', 'الشخص المسجَّل') })}</div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="ru_go" style="margin-inline-start:auto">${L('Add rule', 'إضافة القاعدة')}</button>`,
    onMount(el) {
      el.querySelector('#ru_go').addEventListener('click', () => {
        if (!need(el, '#ru_v', L('Give the value', 'أدخل القيمة'))) return;
        if (!need(el, '#ru_b', L('A field cannot depend on itself', 'لا يعتمد الحقل على نفسه'), v => v !== val(el, '#ru_a'))) return;
        const r = { id: 'fr' + Date.now().toString(36), show: val(el, '#ru_a'), when: val(el, '#ru_b'), op: val(el, '#ru_op'), value: val(el, '#ru_v'), valueAr: val(el, '#ru_v') };
        D.FORM_RULES.push(r); closeOverlays(); refresh();
        ok(L('Rule added', 'أُضيفت القاعدة'), '', { action: { label: L('Undo', 'تراجع'), fn: () => { D.FORM_RULES.splice(D.FORM_RULES.indexOf(r), 1); refresh(); } } });
      });
    }
  });
}

export function permException() {
  openModal({
    title: L('Add an exception', 'إضافة استثناء'),
    sub: L('An explicit deny always beats a role grant. Every exception needs a reason and a review date.',
           'المنع الصريح يتقدّم دائماً على منح الدور. ولكل استثناء سبب وتاريخ مراجعة.'),
    body: `${C.personPicker(L('Person', 'الشخص'), 'px_p')}
      <div class="formgrid"><div class="formrow"><label class="label">${L('Action', 'الإجراء')}</label><select class="select" id="px_a">
        ${D.PERMISSIONS.map(p => `<option value="${p[0]}">${esc(L(p[1], p[2]))}</option>`).join('')}</select></div>
      <div class="formrow"><label class="label">${L('Effect', 'الأثر')}</label><select class="select" id="px_e">
        <option value="+">${L('Allow', 'سماح')}</option><option value="−">${L('Deny', 'منع')}</option></select></div></div>
      ${C.field({ label: L('Reason', 'السبب'), req: true, id: 'px_r' })}
      ${C.field({ label: L('Review on', 'المراجعة في'), type: 'date', value: '2027-01-31', id: 'px_d' })}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="px_go" style="margin-inline-start:auto">${L('Add exception', 'إضافة الاستثناء')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#px_go').addEventListener('click', () => {
        if (!need(el, '#px_r', L('Give a reason', 'اذكر السبب'))) return;
        const typed = val(el, '#px_p').toLowerCase();
        const p = D.PEOPLE.find(x => typed && (x.lat.toLowerCase().includes(typed) || x.ar.includes(typed)));
        if (!need(el, '#px_p', L('Choose the person from the list', 'اختر الشخص من اللائحة'), () => !!p)) return;
        const x = { id: 'ex' + Date.now().toString(36), p: p.id, action: val(el, '#px_a'), effect: val(el, '#px_e'), reason: val(el, '#px_r'), review: val(el, '#px_d') };
        D.EXCEPTIONS.push(x);
        closeOverlays(); refresh();
        ok(L('Exception added', 'أُضيف الاستثناء'), `${el.querySelector('#px_e').value} ${el.querySelector('#px_a').value} · ${L('review', 'مراجعة')} ${fmtDate(val(el, '#px_d'))}`);
      });
    }
  });
}

export function webhookAdd() {
  openModal({
    title: L('Add a webhook', 'إضافة خطّاف'),
    body: `${C.field({ label: L('Endpoint', 'الوجهة'), req: true, id: 'wh_u', dir: 'ltr', ph: 'https://' })}
      <div class="ac-group" style="padding-inline:0">${L('Events', 'الأحداث')}</div>
      <div class="stack" style="gap:8px">${['sacrament.registered', 'report.published', 'message.failed', 'reservation.approved']
        .map(ev => `<label class="check"><input type="checkbox" value="${ev}"><span class="mono" style="font-size:13px">${ev}</span></label>`).join('')}</div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="wh_go" style="margin-inline-start:auto">${L('Add webhook', 'إضافة الخطّاف')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#wh_go').addEventListener('click', () => {
        if (!need(el, '#wh_u', L('Use an https:// address', 'استعمل عنواناً يبدأ بـ https://'), v => /^https:\/\/\S+\.\S+/.test(v))) return;
        const url = val(el, '#wh_u');
        const events = [...el.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value);
        D.WEBHOOKS.push({ url, events: events.length ? events : ['report.published'], scope: 'read', active: true });
        closeOverlays(); refresh(); ok(L('Webhook added', 'أُضيف الخطّاف'), url);
      });
    }
  });
}

/* A photo is cropped to a square and scaled to 192px before it is kept, so a phone
   picture becomes a few kilobytes rather than megabytes in this browser's storage. */
export function avatarPick(btn, key = 'specimen') {
  const inp = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/png,image/jpeg,image/webp' });
  inp.addEventListener('change', () => {
    const f = inp.files[0]; if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return toast(L('That file is not a photo', 'هذا الملف ليس صورة'), L('Use a JPG, PNG or WebP image.', 'استعمل صورة JPG أو PNG أو WebP.'), 'danger');
    if (f.size > 10 * 1024 * 1024) return toast(L('That photo is too large', 'الصورة كبيرة جداً'), L('Up to 10 MB.', 'حتى ١٠ ميغابايت.'), 'danger');
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => {
      const side = Math.min(img.width, img.height), c = Object.assign(document.createElement('canvas'), { width: 192, height: 192 });
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 192, 192);
      URL.revokeObjectURL(url);
      const before = D.PHOTOS[key];
      D.PHOTOS[key] = c.toDataURL('image/jpeg', 0.84);
      photoShown(btn, key);
      ok(L('Photo updated', 'حُدّثت الصورة'), f.name, { action: { label: L('Undo', 'تراجع'), fn: () => {
        if (before) D.PHOTOS[key] = before; else delete D.PHOTOS[key]; photoShown(btn, key); } } });
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast(L('That photo could not be read', 'تعذّرت قراءة الصورة'), '', 'danger'); };
    img.src = url;
  });
  inp.click();
}

export function avatarRemove(btn, key) {
  const before = D.PHOTOS[key]; if (!before) return;
  delete D.PHOTOS[key]; photoShown(btn, key);
  ok(L('Photo removed', 'أُزيلت الصورة'), L('Initials are shown instead.', 'تظهر الأحرف الأولى بدلاً منها.'),
     { action: { label: L('Undo', 'تراجع'), fn: () => { D.PHOTOS[key] = before; photoShown(btn, key); } } });
}

/* Redraw the upload control where it sits (often inside a drawer), then the page and the rail behind it. */
function photoShown(btn, key) {
  const host = document.querySelector(`[data-photo="${key}"]`);
  if (host) { host.outerHTML = C.avatarUpload(key); document.querySelector(`[data-photo="${key}"]`) && wireIn(document.querySelector(`[data-photo="${key}"]`)); }
  if (key === 'parish' || key === me()?.id) bus.renderAll(); else refresh();
}
async function wireIn(el) { const { wireActions } = await import('./actions.js'); wireActions(el); }

export function deleteSpecimen() {
  openModal({
    title: L('Permanently delete this record?', 'حذف هذا السجل نهائياً؟'),
    sub: L('This cannot be undone.', 'لا يمكن التراجع.'),
    body: `<div class="formrow"><label class="label">${L('Type', 'اكتب')} <b>Georges Haddad</b> ${L('to confirm', 'للتأكيد')}</label>
      <input class="input" id="ds_in" autocomplete="off"></div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Keep record', 'الاحتفاظ بالسجل')}</button>
      <button class="btn btn-danger" id="ds_go" disabled style="margin-inline-start:auto">${L('Delete permanently', 'حذف نهائي')}</button>`,
    onMount(el) {
      const b = el.querySelector('#ds_go');
      el.querySelector('#ds_in').addEventListener('input', e => { b.disabled = e.target.value.trim() !== 'Georges Haddad'; });
      b.addEventListener('click', () => { closeOverlays(); toast(L('Deleted', 'حُذف'), L('Specimen only — no record was touched.', 'نموذج فقط — لم يُمسّ أي سجل.'), 'danger'); });
    }
  });
}

export function tagAdd(btn) {
  const inp = document.createElement('input');
  inp.className = 'input'; inp.style.cssText = 'width:140px;min-height:30px;font-size:13px';
  inp.placeholder = L('New tag', 'وسم جديد');
  btn.replaceWith(inp); inp.focus();
  const done = () => {
    const v = inp.value.trim();
    if (v) inp.insertAdjacentHTML('beforebegin', `<span class="chip">${esc(v)}</span>`);
    inp.replaceWith(btn);
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(); if (e.key === 'Escape') inp.replaceWith(btn); });
  inp.addEventListener('blur', done);
}
