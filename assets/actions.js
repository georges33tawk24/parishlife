/* Real behaviour for every control.
   Nothing here talks to a server — it mutates the in-memory parish and asks the
   current view to re-render, so a workflow can actually be walked end to end. */
import { t, isAr, num, usd } from './i18n.js';
import { bus, S } from './store.js';
import { toast, closeOverlays, esc } from './ui.js';
import * as D from './data.js';
import * as F from './flows.js';
import * as CR from './crud.js';
import { backupJSON, restoreBackup, resetData } from './persist.js';

const L = (en, ar) => t(en, ar);
const refresh = () => bus.refresh();

/* ---------- a genuine client-side CSV export ---------- */
function tableToRows(wrap) {
  const table = wrap?.querySelector('table.tbl');
  if (!table) return null;
  const cell = td => td.innerText.replace(/\s+/g, ' ').trim();
  const head = [...table.querySelectorAll('thead th')].map(cell).filter((_, i, a) => a.length);
  const body = [...table.querySelectorAll('tbody tr:not(.detail)')].map(tr => [...tr.children].map(cell));
  return [head, ...body];
}
const csv = rows => rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');

export function download(name, text, type = 'text/csv;charset=utf-8') {
  /* Excel needs a BOM to read Arabic in a CSV; calendars and SVG must not carry one. */
  const body = type.startsWith('text/csv') ? '\uFEFF' + text : text;
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportNearest(btn) {
  const host = document.getElementById('view');
  const wrap = btn.closest('.panel, .wellpad')?.querySelector('.tablewrap') || host.querySelector('.tablewrap');
  let rows = tableToRows(wrap);
  if (!rows) {
    const bars = [...host.querySelectorAll('.barchart .row')].map(r =>
      [r.querySelector('.top span')?.innerText.trim() || '', r.querySelector('.top .v')?.innerText.trim() || '']);
    const kpis = [...host.querySelectorAll('.kpi, .stat')].map(k =>
      [k.querySelector('.k')?.innerText.trim() || '', k.querySelector('.v')?.innerText.trim() || '']);
    if (bars.length || kpis.length) rows = [['Measure', 'Value'], ...kpis, ...bars];
  }
  if (!rows) {
    toast(L('Nothing to export on this screen', 'لا شيء للتصدير في هذه الشاشة'),
          L('Open a list first.', 'افتح لائحة أولاً.'), 'warning');
    return;
  }
  const name = `parishlife-${S.route.replace(/\//g, '-')}-2026-10-04.csv`;
  download(name, csv(rows));
  toast(L('Exported', 'تمّ التصدير'), `${name} · ${rows.length - 1} ${L('rows', 'صفاً')}`, 'success');
}

/* ---------- helpers ---------- */
const picked = () => [...document.querySelectorAll('#view [data-row]:checked')]
  .map(c => c.closest('tr')?.dataset.riP).filter(Boolean);
const find = (arr, id) => arr.find(x => x.id === id);
const ok = (title, body = '', opts) => toast(title, body, 'success', opts);

/* ---------- the verbs ---------- */
export const VERBS = {

  print: () => window.print(),
  export: exportNearest,

  'export-json': () => {
    download('parishlife-parish.json', JSON.stringify({
      parish: D.PARISH, rate: D.RATE, people: D.PEOPLE.length, households: D.HOUSEHOLDS.length
    }, null, 2), 'application/json');
    ok(L('Exported', 'تمّ التصدير'), 'parishlife-parish.json');
  },

  /* reservations ------------------------------------------------ */
  'res-approve': (btn, id) => {
    const r = find(D.RESERVATIONS, id); if (!r) return;
    if (S.role === 'secretary') { r.stage = 'priest';
      ok(L('Forwarded to the priest', 'أُحيل إلى الكاهن'), L(`${r.ref} is now waiting on Fr. Antoine.`, `${r.ref} بانتظار الأب أنطوان.`)); }
    else {
      const other = D.resClash(r);                          // approving one of two clashing requests refuses the other
      const was = { r: { status: r.status, stage: r.stage }, o: other && { status: other.status, stage: other.stage } };
      r.status = 'approved'; r.stage = 'done';
      if (other) { other.status = 'rejected'; other.stage = 'done'; }
      ok(L('Reservation approved', 'تمّت الموافقة على الحجز'),
         other ? L(`${r.ref} holds the room; ${other.ref} was refused and its requester told.`, `${r.ref} يحجز القاعة؛ ورُفض ${other.ref} وأُبلغ صاحبه.`)
               : L(`${r.ref} now holds the room.`, `${r.ref} يحجز القاعة الآن.`),
         { action: { label: L('Undo', 'تراجع'), fn: () => { Object.assign(r, was.r); if (other) Object.assign(other, was.o); refresh(); } } });
    }
    closeOverlays(); refresh();
  },
  'res-reject': (btn, id) => {
    const r = find(D.RESERVATIONS, id); if (!r) return;
    r.status = 'rejected'; r.stage = 'done';
    closeOverlays(); refresh();
    toast(L('Reservation rejected', 'رُفض الحجز'), L('The slot is free again and the requester has been told.', 'تحرّر الوقت وأُبلغ مقدّم الطلب.'), 'warning');
  },

  /* sacraments -------------------------------------------------- */
  'sacr-sign': (btn, id) => {
    const s = find(D.SACRAMENTS, id); if (!s) return;
    s.status = 'registered';
    closeOverlays(); refresh();
    ok(L('Signed and issued', 'وُقّعت وصدرت'), L(`${s.reg} is now in the issuance history.`, `${s.reg} في سجل الإصدار الآن.`));
  },
  'corr-approve': (btn, id) => {
    const c = find(D.CORRECTIONS, id); if (!c) return;
    c.status = 'approved'; refresh();
    ok(L('Correction approved', 'اعتُمد التصحيح'), L('The original entry is preserved beside it.', 'القيد الأصلي محفوظ إلى جانبه.'));
  },

  /* giving & finance -------------------------------------------- */
  'env-add': () => {
    const el = document.querySelector('.drawer');
    const envNo = el?.querySelector('#envno')?.value?.trim() || String(140 + D.BATCH.lines.length).padStart(4, '0');
    const amt = parseFloat((el?.querySelector('#giveamt')?.value || '50').replace(/,/g, '')) || 50;
    const lira = el?.querySelector('#aslira')?.checked;
    D.BATCH.lines.push(lira ? { env: envNo, p: null, lbp: Math.round(amt * D.RATE.value), fund: 'general',
        note: 'Given in lira', noteAr: 'أُعطي بالليرة' }
      : { env: envNo, p: null, usd: amt, fund: 'general' });
    closeOverlays(); refresh();
    ok(L('Envelope added', 'أُضيف المظروف'), `${envNo} · ${lira ? 'L.L ' + num(Math.round(amt * D.RATE.value)) : usd(amt)}`);
  },
  'batch-close': () => {
    D.BATCH.status = 'closed';
    closeOverlays(); refresh();
    ok(L('Counting session 214 closed', 'أُقفلت جلسة العدّ ٢١٤'),
       L('Posted to the fund balances. Corrections now need a reversing entry.', 'قُيّدت في أرصدة الصناديق. والتصحيح يحتاج قيداً عكسياً.'));
  },
  'exp-approve': (btn, id) => {
    const x = find(D.EXPENSES, id); if (!x) return;
    x.status = 'approved'; refresh();
    ok(L('Expense approved', 'اعتُمد المصروف'), `${esc(L(x.what, x.whatAr))} · ${usd(x.usd)}`);
  },
  'exp-add': () => CR.create('expense'),
  'bank-match': (btn, id) => {
    const b = find(D.BANKLINES, id); if (!b) return;
    b.matched = 'cs214'; refresh();
    ok(L('Matched', 'تمّت المطابقة'), L('Reconciled against counting session 214.', 'طوبقت مع جلسة العدّ ٢١٤.'));
  },

  /* people ------------------------------------------------------ */
  'person-add': () => {
    const el = document.querySelector('.drawer');
    const ar = el?.querySelector('#arname')?.value?.trim();
    const lat = el?.querySelector('#latname')?.value?.trim();
    if (!ar || !lat) { toast(L('Both names are required', 'الاسمان مطلوبان'),
      L('The Arabic name is what a certificate prints; the Latin one is the search key.',
        'الاسم العربي هو ما تطبعه الشهادة، واللاتيني مفتاح البحث.'), 'warning'); return; }
    const id = 'p' + Date.now().toString(36);
    D.PEOPLE.unshift({ id, lat, ar, town: 'Hadath', townAr: 'الحدث', rite: 'Maronite',
      status: 'member', phone: el?.querySelector('#newphone')?.value?.trim() || '—',
      born: el?.querySelector('input[type=date]')?.value || '1990-01-01', hh: null, tags: [] });
    if (D.PHOTOS.new) { D.PHOTOS[id] = D.PHOTOS.new; delete D.PHOTOS.new; }
    closeOverlays(); refresh();
    document.querySelector(`#view tr[data-ri-p="${id}"]`)?.classList.add('flash');
    ok(L('Parishioner added', 'أُضيف المؤمن'), `${lat} · ${ar}`);
  },
  'dup-merge': (btn, i) => {
    const [d] = D.DUPLICATES.splice(+i, 1); if (!d) return; refresh();
    ok(L('Records merged', 'دُمج السجلّان'), L('The kept record now carries both envelope histories.', 'السجل المحتفَظ به يحمل تاريخ المظروفين.'),
       { action: { label: L('Undo', 'تراجع'), fn: () => { D.DUPLICATES.splice(+i, 0, d); refresh(); } } });
  },
  'dup-dismiss': (btn, i) => {
    const [d] = D.DUPLICATES.splice(+i, 1); if (!d) return; refresh();
    ok(L('Marked as not a duplicate', 'عُلّم كغير مكرّر'), L('They will not be suggested again.', 'لن يُقترحا مجدداً.'),
       { action: { label: L('Undo', 'تراجع'), fn: () => { D.DUPLICATES.splice(+i, 0, d); refresh(); } } });
  },
  'transfer-approve': (btn, id) => {
    const tr = find(D.TRANSFERS, id); if (!tr) return;
    tr.status = 'approved'; refresh();
    ok(L('Transfer approved', 'اعتُمد الانتقال'), L('The historical link to the old parish is kept.', 'الرابط التاريخي بالرعية السابقة محفوظ.'));
  },
  restore: (btn, id) => F.restorePerson(id),


  /* groups ------------------------------------------------------ */
  'join-approve': (btn, pid) => {
    const gid = (S.route === 'groups' && S.params[0]) || 'g1', g = D.groupInfo(gid); g.requests = g.requests.filter(r => r.p !== pid);
    if (!g.roster.some(r => r.p === pid)) { g.roster.push({ p: pid, role: 'Member', roleAr: 'عضو', joined: '2026', att: 0 }); const grp = D.group(gid); if (grp) grp.members += 1; }
    refresh(); ok(L('Added to the group', 'أُضيف إلى المجموعة'), L('They are on the roster and will be messaged.', 'أصبح على اللائحة وستصله الرسائل.'));
  },
  'join-decline': (btn, pid) => {
    const g = D.groupInfo((S.route === 'groups' && S.params[0]) || 'g1'); g.requests = g.requests.filter(r => r.p !== pid);
    refresh(); toast(L('Request declined', 'رُفض الطلب'), L('Nothing is sent to them automatically.', 'لا يُرسَل إليه شيء تلقائياً.'), 'warning');
  },
  'task-toggle': (btn, i) => {
    const tk = D.groupInfo((S.route === 'groups' && S.params[0]) || 'g1').tasks[+i]; if (!tk) return;
    tk.done = !tk.done; refresh();
    ok(tk.done ? L('Task done', 'أُنجزت المهمة') : L('Task reopened', 'أُعيد فتح المهمة'), L(tk.what, tk.whatAr));
  },

  /* volunteers -------------------------------------------------- */
  'sub-invite': (btn, pid) => {
    for (const tm of D.ROTA.teams) {
      const slot = tm.filled.find(f => !f.p || f.s === 'declined');
      if (slot) { slot.p = pid; slot.s = 'pending'; break; }
    }
    closeOverlays(); refresh();
    ok(L('Invitation sent', 'أُرسلت الدعوة'), L('They have until Monday to reply.', 'لديه مهلة حتى الإثنين للردّ.'));
  },
  'vol-add': () => CR.create('volunteer'),

  /* check-in ---------------------------------------------------- */
  checkout: (btn, pid) => {
    const p = D.person(pid);
    D.CHECKIN.rows = D.CHECKIN.rows.filter(r => r.p !== pid);
    D.CHECKIN.present -= 1;
    refresh();
    ok(L('Checked out', 'سُجّل الخروج'), L(`${p ? p.lat : ''} released to their guardian, and it is in the log.`,
      `${p ? p.ar : ''} سُلّم إلى وليّ أمره، وسُجّل ذلك.`));
  },

  /* communication ----------------------------------------------- */
  'msg-send': () => {
    const el = document.querySelector('.drawer');
    const subject = el?.querySelector('#msgen')?.value?.trim() || L('Parish announcement', 'إعلان رعوي');
    D.MESSAGES.unshift({ id: 'mg' + Date.now(), subject, subjectAr: subject,
      audience: 'All households', audienceAr: 'كل العائلات', channel: 'whatsapp',
      status: 'scheduled', when: '2026-10-12 15:00', reach: 412 });
    closeOverlays(); refresh();
    ok(L('Sent for approval', 'أُرسلت للموافقة'), L('The priest approves a parish-wide send before it leaves.', 'يوافق الكاهن على الإرسال العام قبل مغادرته.'));
  },
  'msg-retry': (btn, id) => {
    const m = find(D.MESSAGES, id); if (!m) return;
    m.status = 'sent'; refresh();
    ok(L('Retried on SMS', 'أُعيدت عبر SMS'), L('14 of the 18 went through.', 'نجحت ١٤ من ١٨.'));
  },
  'notice-add': () => CR.create('notice'),
  'prayer-publish': (btn, id) => {
    const p = find(D.PRAYERS, id); if (!p) return;
    p.status = 'approved'; refresh();
    ok(L('Published to the parish list', 'نُشرت في لائحة الرعية'), L('Moderated, as the policy requires.', 'مُراجَعة كما تقتضي السياسة.'));
  },
  'portal-accept': (b, id) => F.portalDecide(id, true),
  'portal-compare':(b, id) => F.portalCompare(id),


  /* workflows --------------------------------------------------- */
  'run-step': (btn, id) => {
    const r = find(D.RUNS, id); if (!r) return;
    if (r.step < r.total) r.step += 1;
    closeOverlays(); refresh();
    ok(L('Step completed', 'أُنجزت الخطوة'), `${r.step} / ${r.total}`);
  },
  'issue-assign': (btn, id) => {
    const i = find(D.ISSUES, id); if (!i) return;
    i.status = 'approved'; refresh();
    ok(L('Assigned', 'أُسند'), L('The responsible person has been notified.', 'أُبلغ المسؤول.'));
  },


  /* create, edit and delete any record kind registered in crud.js ------ */
  'hh-view':      (b, v) => { S.ui.hhView = v; refresh(); },
  'wh-toggle':    (b, i) => { const w = D.WEBHOOKS[+i]; if (!w) return; w.active = b.checked; refresh();
                    ok(w.active ? L('Webhook on', 'الخطّاف مفعّل') : L('Webhook paused', 'الخطّاف متوقّف'), w.url); },
  'auto-toggle':  (b, i) => { const a = D.AUTOMATIONS[+i]; if (!a) return; a.active = b.checked; refresh();
                    ok(a.active ? L('Automation on', 'الأتمتة مفعّلة') : L('Automation paused', 'الأتمتة متوقّفة'), L(a.what || a.name || '', a.whatAr || a.ar || '')); },
  /* the parish lives in this browser: a backup file moves it, reset starts again ---- */
  'data-export':  () => { download(`parishlife-backup-${new Date().toISOString().slice(0, 10)}.json`, backupJSON(), 'application/json');
                    ok(L('Backup downloaded', 'نُزّلت النسخة الاحتياطية'), L('Keep it somewhere safe; it holds the whole parish.', 'احفظها في مكان آمن؛ فيها الرعية كلها.')); },
  'data-import':  () => { const inp = Object.assign(document.createElement('input'), { type: 'file', accept: 'application/json,.json' });
                    inp.addEventListener('change', async () => {
                      const f = inp.files[0]; if (!f) return;
                      try { restoreBackup(await f.text()); } catch { return toast(L('That file is not a ParishLife backup', 'هذا الملف ليس نسخة احتياطية من «حياة الرعية»'), L('Choose a file downloaded from this page.', 'اختر ملفاً نُزّل من هذه الصفحة.'), 'danger'); }
                      ok(L('Backup restored', 'استُرجعت النسخة'), L('Loading it now…', 'جارٍ تحميلها…')); setTimeout(() => location.reload(), 700);
                    });
                    inp.click(); },
  'data-reset':   () => F.confirmAction({ title: L('Reset to the sample parish?', 'العودة إلى الرعية النموذجية؟'), danger: true, cta: L('Reset', 'إعادة الضبط'),
                    body: L('Everything added, edited or deleted in this browser is replaced by the original sample data. Download a backup first if you want to keep it.',
                            'كل ما أُضيف أو عُدّل أو حُذف في هذا المتصفّح يُستبدل بالبيانات النموذجية الأصلية. نزّل نسخة احتياطية أولاً إن أردت الاحتفاظ بها.'),
                    then: () => { resetData(); location.reload(); } }),
  'rec-new':      (b, kind) => CR.create(kind),
  'book-room':    (b, vid) => CR.create('reservation', { venue: vid }),
  'res-filter':   (b, f) => { S.ui.resFilter = f; refresh(); },
  'rec-edit':     (b, a) => { const [k, id] = a.split('|'); CR.edit(k, id); },
  'rec-del':      (b, a) => { const [k, id] = a.split('|'); CR.remove(k, id); },
  'rec-menu':     (b, a) => { const [k, id] = a.split('|'); CR.menu(b, k, id); },

  /* flows: every one opens a designed surface and completes for real */
  compose:        (b, a) => F.compose(a || 'all'),
  greet:          (b, i) => { const x = D.ANNIVERSARIES[+i] || D.ANNIVERSARIES[0];
                    F.compose('all', { title: L('Anniversary greeting', 'تهنئة بالذكرى'),
                      subject: `${x.years} years — ${x.couple}`,
                      body: `Dear ${x.couple}, the parish of Saint Elias celebrates ${x.years} years of your marriage with you.`,
                      bodyAr: `الأعزّاء ${x.ar}، تحتفل رعية مار الياس معكم بمرور ${x.years} سنة على زواجكم.` }); },
  remind:         (b, a) => F.remind(a || 'rota'),
  broadcast:      () => F.broadcast(),
  invite:         (b, a) => F.invite(a || 'rota'),
  'rota-fill':    (b, a) => F.invite('rota', a),
  'rota-swap':    (b, a) => F.rotaSwap(b, a),
  share:          (b, a) => F.share({ title: a || document.title }),
  'share-cert':   () => F.share({ title: L('Certificate', 'شهادة'), text: L('Your certificate from Saint Elias', 'شهادتك من مار الياس') }),
  doc:            (b, a) => F.previewDoc(a || 'Document'),
  ics:            () => F.downloadICS(),
  receipt:        (b, a) => { const [no, pid, amt] = (a || 'R-2026-0884|p1|50').split('|'); F.receipt(no, pid, +amt); },
  statement:      (b, a) => F.statement(a || 'p1'),
  'statements-all': () => F.statementsAll(),
  slides:         () => F.slides(),
  design:         (b, a) => F.designTemplate(a || 0),
  'record-new':   () => F.recordChooser(),
  'person-edit':  (b, a) => F.personEdit(a),
  'household-new':() => CR.create('household'),
  'relation-edit':(b, a) => F.relationEdit(a),
  'family-add':   (b, hid) => F.familyAdd(hid),
  'family-link':  (b, pid) => F.familyAdd(null, pid),
  'note-new':     (b, a) => F.noteNew(a),
  'note-edit':    (b, a) => F.noteEdit(a),
  'group-new':    () => CR.create('group'),
  'member-add':   (b, a) => F.memberAdd(a || 'g1'),
  'meeting-new':  () => F.meetingNew(),
  'post-add':     b => F.postAdd(b),
  'task-add':     () => F.taskAdd(),
  milestone:      (b, a) => F.milestoneRecord(a),
  handover:       () => F.handover(),
  'cal-prev':     () => F.calShift(-1),
  'cal-next':     () => F.calShift(1),
  'cal-today':    () => F.calShift(0),
  'cal-day':      (b, a) => F.calDay(+a),
  view:           (b, a) => { const [k, v] = a.split('|'); S.ui[k] = +v; refresh(); },
  'people-env':   () => { S.ui.peopleEnv = !S.ui.peopleEnv; S.ui.peoplePage = 0; refresh(); },
  'sac-clear':    () => { S.ui.sacKind = S.ui.sacYear = ''; refresh(); },
  'music-clear':  () => { S.ui.music = {}; refresh(); },
  transpose:      (b, a) => { const [id, n] = a.split('|'); S.ui.transpose = { ...S.ui.transpose, [id]: +n }; refresh(); },
  'cal-kind':     (b, k) => { const off = S.ui.calOff || []; S.ui.calOff = off.includes(k) ? off.filter(x => x !== k) : [...off, k]; refresh(); },
  'event-dup':    (b, a) => F.eventDuplicate(a),
  'event-cancel': (b, a) => F.eventCancel(a),
  'svc-add':      () => F.svcItemAdd(),
  'svc-item':     (b, a) => F.svcItemMenu(b, a),
  'svc-reorder':  () => { S.ui.reorder = !S.ui.reorder; refresh(); },
  'svc-tpl':      (b, a) => F.svcTemplateUse(a),
  'to-service':   (b, a) => F.addToService(a),
  play:           (b, a) => F.play(a),
  'hymn-new':     () => CR.create('hymn'),
  'setlist-new':  () => CR.create('setlist'),
  'setlist-open': (b, a) => F.setlistOpen(a),
  'sheet-open':   (b, a) => F.sheetOpen(a),
  'vol-edit':     (b, a) => CR.edit('volunteer', a),
  'form-new':     () => F.formNew(),
  'field-add':    () => F.fieldAdd(),
  'field-menu':   (b, a) => F.fieldMenu(b, a),
  scan:           () => F.scan(),
  'checkin-manual': () => F.checkinManual(),
  'pickup-add':   (b, a) => F.pickupAdd(a),
  'pickup-remove':(b, a) => { const [pid, i] = a.split('|'); F.pickupRemove(pid, i); },
  'incident-new': () => F.incidentNew(),
  'incident-open':(b, a) => F.incidentOpen(a),
  'venue-new':    () => CR.create('venue'),
  'issue-new':    () => CR.create('issue'),
  'content-edit': (b, a) => F.contentEdit(a),
  'portal-open':  () => window.open('landing.html', '_blank', 'noopener'),
  'line-edit':    (b, a) => F.lineEdit(a),
  'line-reverse': (b, a) => F.lineReverse(a),
  'svc-request':  (b, a) => F.svcRequestOpen(a),
  'svc-request-new': (b, a) => F.svcRequestNew(a),
  'svc-move':     (b, a) => { const [i, d] = a.split('|').map(Number); const o = D.SERVICE.order, j = i + d;
                    if (j >= 0 && j < o.length) { [o[i], o[j]] = [o[j], o[i]]; refresh(); } },
  'notice-edit':  (b, a) => CR.edit('notice', a),
  'hymn-restore': (b, a) => { const [mid, i] = a.split('|'); F.hymnRestore(mid, i); },
  'hymn-text':    (b, a) => { const [mid, what] = a.split('|'); F.hymnText(mid, what); },
  'inst-edit':    (b, a) => { const [mid, i] = a.split('|'), n = D.MUSIC_DETAIL[mid]?.notes[+i]; if (!n) return;
                    F.textEdit({ title: L('Instrument note', 'ملاحظة الآلة'), label: L(n[0], n[1]), value: L(n[2], n[3]),
                      onSave: v => { n[2] = v; n[3] = v; } }); },
  'member-menu':  (b, a) => F.memberMenu(b, a),
  'person-menu':  (b, pid) => import('./views/people.js').then(m => m.personMenu(b, pid)),
  'compose-person': () => F.composeToPerson(),
  'evtask-toggle':(b, a) => { const [eid, ti] = a.split('|'); const ev = D.EVENTS.find(x => x.id === eid); if (!ev) return; const tk = D.eventInfo(ev).tasks[+ti]; if (!tk) return;
                    tk[4] = !tk[4]; refresh();
                    const row = b.closest('.listrow');                    // the task sits in an open drawer: update it where it is
                    row?.classList.toggle('is-done', tk[4]); b.setAttribute('aria-pressed', tk[4]);
                    const sm = row?.querySelector('small'); if (sm) sm.textContent = tk[4] ? L('done', 'أُنجزت') : `${L('due', 'حتى')} ${tk[3]}`;
                    ok(tk[4] ? L('Task done', 'أُنجزت المهمة') : L('Task reopened', 'أُعيد فتح المهمة'), L(tk[0], tk[1])); },
  'archive-specimen': () => toast(L('Georges Haddad was archived', 'أُرشف جورج حدّاد'),
                    L('Removed from lists and messaging. Records kept.', 'أُزيل من اللوائح والمراسلة. والسجلات محفوظة.'), '',
                    { action: { label: L('Undo', 'تراجع'), fn: () => ok(L('Restored', 'استُرجع')) } }),
  'note-save':    (b, pid) => { const ta = document.getElementById('pnote'); const body = ta?.value.trim();
                    if (!body) { toast(L('Write the note first', 'اكتب الملاحظة أولاً'), '', 'warning'); return; }
                    D.NOTES.unshift({ id: 'nt' + Date.now(), p: pid, at: '4 Oct 2026', body, bodyAr: body });
                    refresh(); ok(L('Note saved', 'حُفظت الملاحظة'), L('Priest only.', 'للكاهن فقط.')); },
  page:           (b, a) => { S.ui.peoplePage = Math.max(0, S.ui.peoplePage + (a === 'next' ? 1 : -1)); refresh(); },
  'pdf':          () => { toast(L('Choose “Save as PDF” in the print dialog', 'اختر «حفظ كـPDF» في نافذة الطباعة'), '', 'success'); setTimeout(() => window.print(), 400); },

  /* bulk actions work on whatever rows are ticked in the table ---- */
  'bulk-message': () => { const ids = picked(); F.compose(ids.length === 1 ? ids[0] : 'all',
                    { title: ids.length === 1 ? L('Message 1 person', 'مراسلة شخص واحد') : L(`Message ${ids.length || 14} people`, `مراسلة ${ids.length || 14} أشخاص`) }); },
  'bulk-group':   b => F.bulkGroup(b, picked()),
  'bulk-export':  () => { const ids = picked();
                    const rows = [['Latin name', 'Arabic name', 'Town', 'Phone', 'Status'],
                      ...(ids.length ? ids : D.PEOPLE.slice(0, 14).map(p => p.id)).map(D.person).filter(Boolean)
                        .map(x => [x.lat, x.ar, x.town, x.phone, x.status])];
                    download(`parishlife-selected-${rows.length - 1}.csv`, csv(rows));
                    ok(L('Exported', 'تمّ التصدير'), rows.length === 2 ? L('1 row', 'صفّ واحد') : `${rows.length - 1} ${L('rows', 'صفوف')}`); },
  'bulk-archive': () => { const ids = picked(); if (!ids.length) return toast(L('Tick the people to archive first', 'حدّد الأشخاص أولاً'), '', 'warning'); F.archivePeople(ids); },

  /* eparchy, workflows, reports, settings ------------------------- */
  'eparchy-msg':  () => F.compose('eparchy', { title: L('Eparchy announcement', 'إعلان أبرشي') }),
  'parish-switch':(b, id) => F.parishSwitch(id),
  'wf-new':       () => CR.create('workflow'),
  'wf-pause':     () => { const w = D.WORKFLOWS[0]; if (!w) return; w.paused = !w.paused; refresh();
                    toast(w.paused ? L('Workflow paused', 'أُوقف المسار مؤقتاً') : L('Workflow resumed', 'استُؤنف المسار'),
                      w.paused ? L('Nothing new starts until you resume. Runs in progress wait.', 'لا يبدأ شيء جديد حتى الاستئناف. والجاري ينتظر.') : '',
                      w.paused ? 'warning' : 'success'); },
  'wf-retry':     () => { D.RUN_LOG.unshift(['2026-10-04 19:32', 'Retry 2 of 3 — WhatsApp gateway answered', 'محاولة ٢ من ٣ — استجابت بوابة واتساب', 'ok']);
                    refresh(); ok(L('Failed steps retried', 'أُعيدت الخطوات الفاشلة'), L('The message went through on the second attempt.', 'نجحت الرسالة في المحاولة الثانية.')); },
  'wf-cancel':    () => F.confirmAction({ title: L('Cancel this run?', 'إلغاء هذا التنفيذ؟'),
                    body: L('Steps already done stay done. Nothing further is sent.', 'الخطوات المنجزة تبقى. ولا يُرسل شيء بعدها.'),
                    cta: L('Cancel run', 'إلغاء التنفيذ'), danger: true,
                    then: () => { D.RUN_LOG.unshift(['2026-10-04 19:33', 'Run cancelled by Fr. Antoine', 'ألغى الأب أنطوان التنفيذ', 'err']); refresh();
                      toast(L('Run cancelled', 'أُلغي التنفيذ'), '', 'warning'); } }),
  'dom-add-field':() => CR.create('field'),
  'dom-add-rule': () => F.ruleAdd(),
  'rule-del':     (b, id) => { const i = D.FORM_RULES.findIndex(r => r.id === id); if (i < 0) return; const [r] = D.FORM_RULES.splice(i, 1); refresh();
                    ok(L('Rule removed', 'أُزيلت القاعدة'), '', { action: { label: L('Undo', 'تراجع'), fn: () => { D.FORM_RULES.splice(i, 0, r); refresh(); } } }); },
  'exception-del':(b, id) => { const i = D.EXCEPTIONS.findIndex(x => x.id === id); if (i < 0) return; const [x] = D.EXCEPTIONS.splice(i, 1); refresh();
                    ok(L('Exception removed', 'أُزيل الاستثناء'), `${x.effect} ${x.action}`, { action: { label: L('Undo', 'تراجع'), fn: () => { D.EXCEPTIONS.splice(i, 0, x); refresh(); } } }); },
  'report-schedule': () => { closeOverlays(); ok(L('Report scheduled', 'جُدول التقرير'), L('First delivery on 1 November, 07:00.', 'أول إرسال في ١ تشرين الثاني، ٠٧:٠٠.')); },
  'settings-save':() => ok(L('Settings saved', 'حُفظت الإعدادات'), L('Every role sees the change immediately.', 'يرى كل دور التغيير فوراً.')),
  'perm-exception': () => F.permException(),
  'session-revoke': (b, i) => { const [x] = D.SESSIONS.splice(+i, 1); if (!x) return; refresh();
                    ok(L('Session ended', 'أُنهيت الجلسة'), L('That device has been signed out.', 'سُجّل خروج ذلك الجهاز.'),
                      { action: { label: L('Undo', 'تراجع'), fn: () => { D.SESSIONS.splice(+i, 0, x); refresh(); } } }); },
  'webhook-add':  () => F.webhookAdd(),
  'key-rotate':   () => F.confirmAction({ title: D.PARISH.apiKeyRevoked ? L('Issue a new key?', 'إصدار مفتاح جديد؟') : L('Rotate the key?', 'تدوير المفتاح؟'),
                    body: L('The old key stops working in 24 hours. The eparchy will need the new one.', 'يتوقّف المفتاح القديم خلال ٢٤ ساعة. وستحتاج الأبرشية الجديد.'),
                    cta: L('Issue key', 'إصدار المفتاح'), then: () => { D.PARISH.apiKey = Math.random().toString(16).slice(2, 6); delete D.PARISH.apiKeyRevoked; refresh();
                      ok(L('New key issued', 'صدر مفتاح جديد'), L('Copy the new key into the eparchy system.', 'انسخ المفتاح الجديد إلى نظام الأبرشية.')); } }),
  'key-revoke':   () => F.confirmAction({ title: L('Revoke this key?', 'إلغاء هذا المفتاح؟'),
                    body: L('The eparchy reporting link stops immediately.', 'يتوقّف ربط تقارير الأبرشية فوراً.'), cta: L('Revoke', 'إلغاء'), danger: true,
                    then: () => { D.PARISH.apiKeyRevoked = true; refresh(); toast(L('Key revoked', 'أُلغي المفتاح'), '', 'warning',
                      { action: { label: L('Undo', 'تراجع'), fn: () => { delete D.PARISH.apiKeyRevoked; refresh(); } } }); } }),
  'avatar-upload':(b, key) => F.avatarPick(b, key),
  'avatar-remove':(b, key) => F.avatarRemove(b, key),

  /* design-system specimens behave like the real thing ----------- */
  'spec-save':    () => ok(L('Record saved', 'حُفظ السجل'), L('Every mutation toasts.', 'كل تعديل يُنبّه.')),
  'spec-cancel':  () => toast(L('Changes discarded', 'أُلغيت التعديلات')),
  'spec-delete':  () => F.deleteSpecimen(),
  'spec-clear':   () => { S.ui.peopleStatus = null; ok(L('All filters cleared', 'مُسحت كل المرشّحات')); },
  'spec-retry':   b => { b.innerHTML = `<span class="spin"></span>${L('Trying…', 'جارٍ المحاولة…')}`; b.disabled = true;
                    setTimeout(() => { b.textContent = L('Loaded', 'تمّ التحميل'); ok(L('The list loaded', 'تحمّلت اللائحة')); }, 900); },
  'tag-add':      b => F.tagAdd(b),

  'filter-clear': b => { b.closest('.menu')?.querySelectorAll('input[type=checkbox]').forEach(c => { c.checked = false; }); },
  'filter-apply': b => { const n = b.closest('.menu')?.querySelectorAll('input[type=checkbox]:checked').length || 0;
                    ok(L('Filter applied', 'طُبّق المرشّح'), L(`${n} statuses selected`, `${n} حالات محدّدة`)); },

  /* generic, still real ----------------------------------------- */
  save: () => { closeOverlays(); ok(L('Saved', 'حُفظ'), L('Your changes are kept on this device.', 'تعديلاتك محفوظة على هذا الجهاز.')); },
  'qr-revoke':    () => { const d = D.groupInfo((S.route === 'groups' && S.params[0]) || 'g1'); d.qrRevoked = true; closeOverlays(); refresh();
                    toast(L('Join code revoked', 'أُلغي رمز الانتساب'), L('The printed poster no longer works; print a new code when you need one.', 'الملصق المطبوع لم يعد يعمل؛ اطبع رمزاً جديداً عند الحاجة.'), 'warning',
                      { action: { label: L('Undo', 'تراجع'), fn: () => { delete d.qrRevoked; refresh(); } } }); },

  'block-cancel': (b, i) => {
    const m = D.MAINTENANCE[+i]; if (!m) return;
    D.MAINTENANCE.splice(+i, 1); refresh();
    const v = D.venue(m.venue);
    ok(L('Block cancelled', 'أُلغي الإغلاق'), L(`${v.name} takes bookings again`, `${v.ar} تقبل الحجوزات مجدداً`),
       { action: { label: L('Undo', 'تراجع'), fn: () => { D.MAINTENANCE.splice(+i, 0, m); refresh(); } } });
  },
  'recurring-toggle': (b, i) => {
    const r = D.RECURRING[+i]; if (!r) return;
    r.paused = !r.paused; refresh();
    ok(r.paused ? L('Standing gift paused', 'أُوقف العطاء الدائم') : L('Standing gift resumed', 'استُؤنف العطاء الدائم'),
       `${isAr() ? D.person(r.p).ar : D.person(r.p).lat} · ${usd(r.amount)}`,
       { action: { label: L('Undo', 'تراجع'), fn: () => { r.paused = !r.paused; refresh(); } } });
  },
  'rate-open': () => { document.getElementById('userbtn')?.click(); }
};

/** Wire every [data-act] in a host. Value is "verb" or "verb:arg". */
export function wireActions(host) {
  host.querySelectorAll('[data-act]').forEach(el => {
    if (el.dataset.actWired) return;
    el.dataset.actWired = '1';
    const [verb, ...rest] = el.dataset.act.split(':');
    const arg = rest.join(':');
    const fn = VERBS[verb];
    el.addEventListener('click', e => {
      e.preventDefault();
      if (fn) fn(el, arg);
      else console.warn('ParishLife: no verb for', el.dataset.act);   // never a fake success
    });
  });
}
