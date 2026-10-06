/* Module 7 — sacrament requests, preparation, register entries and certificates. */
import { t, isAr, fmtDate, fmtDateIn, num } from '../i18n.js';
import { is, bus, S } from '../store.js';
import { icon, pageHead, sectionH, panel, who, status, statusLabel, pill, esc, table, wireTables, empty,
         searchField, openDrawer, openModal, openMenu, closeOverlays, toast, stat, tabBar, avatar } from '../ui.js';
import * as C from '../components.js';
import * as CR from '../crud.js';
import { download } from '../actions.js';
import { need } from '../flows.js';
import { workflow as serverWorkflow } from '../persist.js';
import { printSheet, saveBlob, svgToPng, fileName } from '../print.js';
import { SACRAMENTS, anniversaryItems, PARISH, PREP_REQUIREMENTS, PEOPLE, person, RESERVATIONS, SERVICE_REQUESTS, PORTAL_REQUESTS, REQUEST_HISTORY, REGISTRATIONS } from '../data.js';

const L = (en, ar) => t(en, ar);
const KIND = { baptism:['Baptism','معمودية'], communion:['First Communion','المناولة الأولى'],
  confirmation:['Confirmation (Chrismation)','الميرون'], marriage:['Marriage','إكليل'],
  funeral:['Funeral','جنّاز'], certificate:['Certificate request','طلب شهادة'] };
const kindLabel = k => L(...(KIND[k] || [k, k]));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const official = s => s && s.kind !== 'certificate' && ['registered', 'issued'].includes(s.status);
const eligibleSources = personId => SACRAMENTS.filter(s => official(s) && (!personId || s.person === personId));
const pendingSacraments = personId => SACRAMENTS.filter(s => s.kind !== 'certificate' &&
  ['requested', 'office-reviewed', 'preparing', 'draft', 'scheduled', 'awaiting-signature'].includes(s.status) && (!personId || s.person === personId));
const sourceFor = s => SACRAMENTS.find(x => x.id === s.sourceRecordId);
const sacramentStatus = s => s.kind === 'certificate' && !sourceFor(s) && !['cancelled','rejected'].includes(s.status)
  ? pill(L('Waiting for official entry','بانتظار قيد رسمي'),'warning')
  : s.status === 'draft'
  ? pill(s.kind === 'certificate' ? L('Request received','استُلم الطلب') : L('Celebrated · not submitted','تمّ الاحتفال · لم يُرسل'), 'info')
  : status(s.status);
/* What happens next and who does it, in the words the office uses. */
const OFFICE = () => L('Parish office', 'مكتب الرعية'), PRIEST = () => L('Priest', 'الكاهن');
const nameIn = p => p ? L(p.lat || '', p.ar || p.lat || '') : '';
const nextStep = s => s.status === 'cancelled'
  ? [L('Nothing more to do — the request was cancelled', 'لا شيء آخر — أُلغي الطلب'), '']
  : s.status === 'rejected'
  ? [L('Nothing more to do — the request was declined', 'لا شيء آخر — رُفض الطلب'), '']
  : s.kind === 'certificate' && !s.sourceRecordId
  ? [s.requestedSacramentId ? L('Wait until the sacrament is celebrated and approved', 'انتظار الاحتفال بالسرّ واعتماده')
      : eligibleSources(s.person).length ? L('Link the approved register entry', 'ربط القيد المعتمد')
      : L('Record the sacrament first — there is no approved entry yet', 'سجّل السرّ أولاً — لا قيد معتمد بعد'), OFFICE()]
  : ({
  requested: [L('Accept or decline the request', 'قبول الطلب أو رفضه'), L('Priest or parish office', 'الكاهن أو مكتب الرعية')],
  'office-reviewed': [L('Accept or decline the request', 'قبول الطلب أو رفضه'), PRIEST()],
  preparing: [L('Finish the preparation checklist and set the date', 'إكمال لائحة التحضير وتحديد الموعد'), OFFICE()],
  draft: [s.kind === 'certificate' ? L('Send the request to the priest', 'إرسال الطلب إلى الكاهن') : L('Send the celebrated sacrament to the priest for approval', 'إرسال السرّ المحتفل به إلى الكاهن للاعتماد'), OFFICE()],
  scheduled: [s.date > today() ? L(`Wait for the celebration on ${fmtDate(s.date)}`, `انتظار الاحتفال في ${fmtDate(s.date)}`) : L('Confirm it was celebrated and send it for approval', 'تأكيد الاحتفال وإرساله للاعتماد'), OFFICE()],
  'awaiting-signature': [s.kind === 'certificate' ? L('Check the request and approve it', 'مراجعة الطلب واعتماده') : L('Check against the register book and approve', 'المطابقة مع دفتر السجل والاعتماد'), PRIEST()],
  approved: [L('Sign and issue the certificate', 'توقيع الشهادة وإصدارها'), PRIEST()],
  registered: [L('Done — request a certificate whenever one is needed', 'منجز — اطلب شهادة متى احتجت إليها'), ''],
  issued: [L('Done — the certificate was issued', 'منجز — صدرت الشهادة'), '']
})[s.status] || [L('Review the record', 'مراجعة القيد'), OFFICE()];
/* Official entries are reached from the person's record and from Requests; there is no separate register page. */
const STABS = () => [['', 'Preparation', 'التحضير'], ['anniversaries', 'Anniversaries', 'الذكريات', anniversaryItems().length]];
const prepProgress = s => {
  const requirements = PREP_REQUIREMENTS[s.kind] || [];
  const required = requirements.map((item, index) => item[2] ? index : -1).filter(index => index >= 0);
  const complete = Array.isArray(s.preparation) ? required.filter(index => s.preparation[index]).length : 0;
  return required.length ? `${complete} / ${required.length} ${L('required','مطلوب')}` : L('No required checklist','لا متطلبات إلزامية');
};

/* The approved register as a spreadsheet: one row per official entry, both names, Western digits. */
function exportRegister() {
  const cell = v => /[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? '');
  const head = ['Register entry', 'Sacrament', 'Name', 'Arabic name', 'Date', 'Celebrant', 'Book', 'Page', 'Godparents / witnesses', 'Status'];
  const rows = SACRAMENTS.filter(official).map(s => { const p = person(s.person), c = person(s.celebrant);
    return [s.reg, KIND[s.kind]?.[0] || s.kind, p?.lat, p?.ar, String(s.date || '').slice(0, 10), c?.lat || '', s.book, s.page, s.godparents, s.status]; });
  download(`register-${fileName(PARISH.name)}-${today()}.csv`, [head, ...rows].map(r => r.map(cell).join(',')).join('\n'));
  toast(L('Register exported', 'صُدّر السجل'), L(`${rows.length} approved entries`, `${rows.length} قيود معتمدة`), 'success');
}

export function sacraments(tab = '') {
  if (['preparation', 'corrections', 'registers'].includes(tab)) tab = '';
  const head = pageHead({
    crumbs: [{ label: L('Records', 'السجلات') }, { label: tab === 'requests' ? L('Requests', 'الطلبات') : L('Sacraments', 'الأسرار') }],
    title: tab === 'requests' ? L('Parish requests', 'طلبات الرعية') : tab === 'anniversaries' ? L('Sacrament anniversaries', 'ذكريات الأسرار') : L('Sacrament preparation', 'التحضير للأسرار'),
    sub: tab === 'requests' ? L('Everything waiting on the parish office or the priest — certificates, sacraments, room bookings, services and portal requests — and what is already done.', 'كل ما ينتظر مكتب الرعية أو الكاهن — الشهادات والأسرار وحجوزات القاعات والخدم وطلبات البوابة — وما أُنجز.')
      : tab === 'anniversaries' ? L('Baptism, chrismation, first Communion and marriage anniversaries, taken from approved entries.', 'ذكريات المعمودية والميرون والمناولة الأولى والإكليل، مأخوذة من القيود المعتمدة.')
      : L('Accepted sacrament requests: set the celebration date and work through what each sacrament needs beforehand.', 'طلبات الأسرار المقبولة: حدّد موعد الاحتفال وأنجز ما يحتاج إليه كل سرّ مسبقاً.'),
    actions: tab === 'requests' ? `<button class="btn btn-secondary" id="newcertreq">${icon('plus', 17)}${L('Certificate request', 'طلب شهادة')}</button><button class="btn btn-primary" id="newsacreq">${icon('plus', 17)}${L('Sacrament request', 'طلب سرّ')}</button>`
      : `<button class="btn btn-secondary" id="sacexport">${icon('export', 17)}${L('Export register (CSV)', 'تصدير السجل (CSV)')}</button>`
  }) + (tab === 'requests' ? '' : tabBar('sacraments', STABS(), tab));

  if (tab === 'requests') {
    const items = [
      ...SACRAMENTS.filter(s => s.kind === 'certificate').map(s => ({ category:'certificate', title:`${kindLabel(s.kind)} · ${s.reg}`, who:person(s.person), state:s.status, waitingSource:!sourceFor(s)&&!['cancelled','rejected'].includes(s.status), open:!['issued','rejected','cancelled'].includes(s.status), date:s.date, priority:s.priority || '', owner:nextStep(s)[1], next:nextStep(s)[0], href:`#/certificate/${s.id}`, ref:s.reg })),
      ...SACRAMENTS.filter(s => s.kind !== 'certificate' && (['requested','office-reviewed','awaiting-signature','rejected','cancelled'].includes(s.status) || s.requestApprovedAt)).map(s => ({ category:'sacrament', title:`${kindLabel(s.kind)} · ${s.requestReference||s.reg}`, who:person(s.person), state:s.requestApprovedAt && !['awaiting-signature','rejected','cancelled'].includes(s.status) ? 'approved' : s.status, open:['requested','office-reviewed','awaiting-signature'].includes(s.status), date:s.requestedAt || s.date, priority:'', owner:nextStep(s)[1], next:s.requestApprovedAt && !['awaiting-signature','rejected','cancelled'].includes(s.status) ? s.status==='registered' ? L('Official record available','القيد الرسمي متاح') : L('Continue in Preparation','تابع التحضير') : nextStep(s)[0], href:`#/certificate/${s.id}`, ref:s.requestReference||s.reg })),
      ...RESERVATIONS.map(r => ({ category:'facility', title:L(r.title, r.titleAr), who:person(r.by), state:r.status, open:r.status === 'pending', date:r.date || r.at, priority:r.priority || '', owner:r.stage==='priest'?L('Priest','الكاهن'):L('Parish office','مكتب الرعية'), next:r.status === 'pending' ? L('Review reservation','مراجعة الحجز') : L('Completed','مكتمل'), href:'#/reservations', ref:r.ref||r.id })),
      ...SERVICE_REQUESTS.map(r => ({ category:'service', title:`${L(r.kind, r.kindAr)} · ${fmtDate(r.date)}`, who:person(r.by), state:r.status, open:['pending','awaiting-approval'].includes(r.status), date:r.date, priority:r.priority || '', owner:L('Priest or service team','الكاهن أو فريق الخدمة'), next:r.prep === 'documents missing' ? L('Collect missing documents','استكمال المستندات الناقصة') : L('Review service request','مراجعة طلب الخدمة'), href:'#/services/requests', ref:r.ref||'' })),
      ...PORTAL_REQUESTS.map(r => ({ category:'portal', title:L(r.what, r.whatAr), who:person(r.by), state:'pending', open:true, date:r.at, priority:r.priority || '', owner:L('Parish office','مكتب الرعية'), next:L('Accept or decline','قبول أو رفض'), href:'#/portal', ref:r.ref||'' })),
      ...REQUEST_HISTORY.map(r => ({ category:'portal', title:L(r.title, r.titleAr), who:person(r.by), state:r.status, open:false, date:r.at, priority:'', owner:L('Parish office','مكتب الرعية'), next:L('Completed','مكتمل'), href:'#/portal', ref:r.ref||'' })),
      ...REGISTRATIONS.filter(r => r.waiting > 0).map(r => ({ category:'registration', title:`${L(r.event, r.eventAr)} · ${r.waiting} ${L('on waitlist','على لائحة الانتظار')}`, who:null, state:'pending', open:true, date:r.date, priority:'', owner:L('Registration team','فريق التسجيل'), next:L('Review waitlist','مراجعة لائحة الانتظار'), href:'#/registrations', ref:'' }))
    ];
    const f = S.ui.requestFilter === 'open' ? 'action' : S.ui.requestFilter || 'action', cat = S.ui.requestCategory || '', owner = S.ui.requestOwner || '', date = S.ui.requestDate || '', priority = S.ui.requestPriority || '', state = S.ui.requestStatus || '';
    const needsAction = x => x.open && !x.waitingSource && !(x.category === 'certificate' && x.state === 'draft');
    const shown = items.filter(x => (f === 'all' || f === 'action' && needsAction(x) || f === 'waiting' && x.open && !needsAction(x) || f === 'completed' && !x.open) && (!cat || x.category === cat) && (!state || x.state === state) && (!owner || x.owner === owner) && (!date || String(x.date || '').slice(0,10) >= date) && (!priority || x.priority === priority));
    const categories = [['certificate','Certificates','الشهادات'],['sacrament','Sacrament requests','طلبات الأسرار'],['facility','Facilities','المرافق'],['service','Services','الخدمات'],['portal','Portal','البوابة'],['registration','Registrations','التسجيل']].filter(([k]) => items.some(x => x.category === k));
    return head + `<div class="tabbody">
      <div class="stats" style="margin:0 0 16px">${stat(L('Needs action','تحتاج إجراءً'),items.filter(needsAction).length,L('a decision or a step from the office or the priest','قرار أو خطوة من المكتب أو الكاهن'))}${stat(L('Waiting','بانتظار'),items.filter(x=>x.open&&!needsAction(x)).length,L('on a date, a document or another record','على موعد أو مستند أو قيد آخر'))}${stat(L('Completed','مكتملة'),items.filter(x=>!x.open).length,L('approved, issued, declined or cancelled','معتمدة أو صادرة أو مرفوضة أو ملغاة'))}</div>
      <div class="toolbar" style="margin-bottom:10px;flex-wrap:wrap">
        <span class="seg" role="group">${[['action','Needs action','تحتاج إجراءً'],['waiting','Waiting','بانتظار'],['completed','Completed','مكتملة'],['all','All','الكل']].map(([v,en,ar])=>`<button aria-pressed="${f===v}" data-act="request-filter:${v}">${L(en,ar)}</button>`).join('')}</span>
        <div class="grow" style="min-width:190px;max-width:290px">${C.searchClear(L('Name or reference','الاسم أو المرجع'),'requestsearch','data-find')}</div>
        <select class="select" id="reqcategory" aria-label="${L('Request category','فئة الطلب')}" style="width:auto"><option value="">${L('All categories','كل الفئات')}</option>${categories.map(([v,en,ar])=>`<option value="${v}" ${cat===v?'selected':''}>${L(en,ar)}</option>`).join('')}</select>
        <select class="select" id="reqstatus" aria-label="${L('Request status','حالة الطلب')}" style="width:auto"><option value="">${L('Any status','كل الحالات')}</option>${[...new Set(items.map(x=>x.state))].sort().map(v=>`<option value="${esc(v)}" ${state===v?'selected':''}>${esc(statusLabel(v))}</option>`).join('')}</select>
        <select class="select" id="reqowner" aria-label="${L('Responsible role','الدور المسؤول')}" style="width:auto"><option value="">${L('All responsible roles','كل المسؤولين')}</option>${[...new Set(items.map(x=>x.owner).filter(Boolean))].map(v=>`<option value="${esc(v)}" ${owner===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
      </div>
      <div class="toolbar" style="margin-bottom:14px;flex-wrap:wrap"><label class="t-caption dim" for="reqdate">${L('Date since','التاريخ منذ')}</label><input class="input" id="reqdate" type="date" value="${esc(date)}" style="width:auto">${items.some(x=>x.priority)?`<select class="select" id="reqpriority" aria-label="${L('Priority','الأولوية')}" style="width:auto"><option value="">${L('Any priority','أي أولوية')}</option>${[...new Set(items.map(x=>x.priority).filter(Boolean))].map(v=>`<option value="${esc(v)}" ${priority===v?'selected':''}>${esc(v)}</option>`).join('')}</select>`:''}<span class="t-caption dim">${shown.length} ${L('shown','معروض')}</span>${cat||state||owner||date||priority?`<button class="btn btn-ghost btn-dense" id="reqclear">${L('Clear filters','مسح المرشّحات')}</button>`:''}</div>
      ${table({cols:[{label:L('Type / reference','النوع / المرجع')},{label:L('Person / subject','الشخص / الموضوع')},{label:L('Submitted / date','التقديم / التاريخ'),cls:'hide-md'},{label:L('Status','الحالة')},{label:L('Next action','الخطوة التالية')},{label:L('Responsible','المسؤول'),cls:'hide-md'},{label:'',cls:'shrink'}],rows:shown.map(x=>({attrs:'data-find-item',cells:[`<b>${esc(x.title)}</b>${x.ref?`<small class="t-caption dim mono" style="display:block" dir="ltr">${esc(x.ref)}</small>`:''}`,x.who?who(x.who):'—',esc(fmtDate(x.date||'')),x.waitingSource?pill(L('Waiting for official entry','بانتظار قيد رسمي'),'warning'):x.state==='draft'&&x.category==='certificate'?pill(L('Request received','استُلم الطلب'),'info'):x.state==='legacy'?pill(L('Needs linked record','يحتاج قيداً مرتبطاً'),'warning'):status(x.state),`<b>${esc(x.next)}</b>`,esc(x.owner),`<span class="row" style="gap:6px">${x.state==='legacy'?`<span class="t-caption dim">${L('Legacy record','قيد قديم')}</span>`:`<a class="btn btn-secondary btn-dense" href="${x.href}">${L('View','عرض')}</a>`}</span>`]})),empty:empty('check',L('No requests match','لا طلبات مطابقة'),L('Clear a filter or create a request.','امسح مرشّحاً أو أنشئ طلباً.'))})}
      <div class="find-empty" hidden>${empty('search',L('No matching request','لا طلب مطابق'),L('Try a parishioner name or reference number.','جرّب اسم الشخص أو رقم المرجع.'))}</div>
    </div>`;
  }

  if (tab === 'anniversaries') return head + `<div class="tabbody">${table({
      cols: [{ label: L('Person or couple', 'الشخص أو الزوجان') }, { label: L('Sacrament', 'السرّ') }, { label: L('Years', 'السنوات'), cls: 'num' },
             { label: L('Date', 'التاريخ') }, { label: '', cls: 'shrink' }],
      rows: anniversaryItems().map((a, ai) => ({ cells: [
        `<b>${esc(isAr() ? a.ar : a.couple)}</b>`,
        `<span>${esc(kindLabel(a.kind))}${a.source === 'legacy' ? ` <small class="dim">${L('legacy', 'قديم')}</small>` : ''}</span>`,
        `<span class="num">${a.years}</span>`, `<span class="mono dim">${fmtDate(a.on)}</span>`,
        `<button class="btn btn-secondary btn-dense" data-act="greet:${ai}">${icon('msg', 15)}${L('Send greeting', 'إرسال تهنئة')}</button>`]}))
    })}
    <p class="t-caption dim" style="margin-top:16px">${L(
      'Baptism, chrismation, first Communion, and marriage anniversaries are derived from their registers. Earlier marriage reminders are labeled as legacy entries until linked to a register.',
      'تُستخرج ذكريات المعمودية والميرون والمناولة الأولى والإكليل من سجلاتها. وتبقى ذكريات الإكليل السابقة قيوداً قديمة حتى ربطها بسجل.')}</p></div>`;

  const entries = SACRAMENTS.filter(s => s.kind !== 'certificate' && ['preparing','scheduled','draft'].includes(s.status));
  return head + `<div class="tabbody">
      ${C.inlineAlert('info', L('Preparation follows priest approval', 'يبدأ التحضير بعد موافقة الكاهن'), L('Start with a sacrament request. The priest may accept it directly; then the parish office completes preparation before the celebration.', 'ابدأ بطلب سرّ. يمكن للكاهن قبوله مباشرة، ثم يُكمل مكتب الرعية التحضير قبل الاحتفال.'))}
      <div class="toolbar" style="margin:16px 0"><button class="btn btn-primary" id="newsacreq">${icon('plus',16)}${L('New sacrament request','طلب سرّ جديد')}</button></div>
      ${table({cols:[{label:L('Person','الشخص')},{label:L('Sacrament','السرّ')},{label:L('Celebration date','تاريخ الاحتفال')},{label:L('Preparation','التحضير')},{label:L('Status','الحالة')},{label:'',cls:'shrink'}],rows:entries.map(s=>({attrs:'data-find-item',cells:[who(person(s.person)),esc(kindLabel(s.kind)),s.date?esc(fmtDate(s.date)):L('Set date','حدّد التاريخ'),esc(prepProgress(s)),status(s.status),`<span class="row" style="gap:6px"><a class="btn btn-secondary btn-dense" href="#/certificate/${esc(s.id)}">${L('View','عرض')}</a>${s.status==='draft'?'':`<button class="btn btn-secondary btn-dense" data-prep-edit="${esc(s.id)}">${L('Edit','تعديل')}</button><button class="btn btn-ghost btn-dense" data-prep-cancel="${esc(s.id)}">${L('Cancel','إلغاء')}</button>`}</span>`]})),empty:empty('sacr',L('No active preparations','لا تحضيرات جارية'),L('Approved sacrament requests will appear here.','ستظهر هنا طلبات الأسرار المعتمدة.'))})}
      <details style="margin-top:20px"><summary>${L('Preparation requirements by sacrament','متطلبات التحضير بحسب السرّ')}</summary><div class="grid g2" style="margin-top:16px">${Object.entries(PREP_REQUIREMENTS).map(([k,reqs])=>panel(kindLabel(k),reqs.map(([en,ar])=>`<div class="listrow">${icon('check',15)}${esc(L(en,ar))}</div>`).join(''))).join('')}</div></details>
    </div>`;
}

sacraments.mount = host => {
  C.wire(host); wireTables(host);
  for (const [selector, key] of [['#reqcategory','requestCategory'],['#reqstatus','requestStatus'],['#reqowner','requestOwner'],['#reqdate','requestDate'],['#reqpriority','requestPriority']])
    host.querySelector(selector)?.addEventListener('change', e => { S.ui[key] = e.target.value; bus.refresh(); });
  host.querySelector('#reqclear')?.addEventListener('click', () => { for (const key of ['requestCategory','requestStatus','requestOwner','requestDate','requestPriority']) S.ui[key] = ''; bus.refresh(); });
  host.querySelector('#sacexport')?.addEventListener('click', exportRegister);
  host.querySelector('#newcertreq')?.addEventListener('click', () => {
    const sources = eligibleSources(), pending = pendingSacraments();
    const selected = S.ui.newCertificateSource || '';
    S.ui.newCertificateSource = '';
    const initial = sources.find(s => s.id === selected) || null;
    openDrawer({
      title: L('New certificate request', 'طلب شهادة جديد'),
      sub: L('Choose a person and, if available, an existing entry. A future sacrament may be requested now; the certificate waits for an approved register.', 'اختر الشخص وقيداً قائماً إن توفر. يمكن الطلب قبل موعد السرّ، وتنتظر الشهادة اعتماد السجل.'),
      body: `<div class="formrow"><label class="label" for="req_person">${L('Parishioner', 'صاحب الطلب')}<span class="req">*</span></label><select class="select" id="req_person">${PEOPLE.map(p=>`<option value="${esc(p.id)}" ${initial?.person===p.id?'selected':''}>${esc(isAr()?p.ar:p.lat)}</option>`).join('')}</select></div>
        <div class="formrow"><label class="label" for="req_source">${L('Related sacrament', 'السرّ المرتبط')}</label><select class="select" id="req_source"><option value="">${L('No entry yet — request will wait', 'لا قيد بعد — الطلب سينتظر')}</option>${sources.map(s=>`<option value="official:${esc(s.id)}" ${selected===s.id?'selected':''}>${esc(s.reg)} · ${esc(nameIn(person(s.person)))} · ${esc(kindLabel(s.kind))} (${L('official','رسمي')})</option>`).join('')}${pending.map(s=>`<option value="pending:${esc(s.id)}">${esc(s.reg)} · ${esc(nameIn(person(s.person)))} · ${esc(kindLabel(s.kind))} (${L('pending','قيد الانتظار')})</option>`).join('')}</select><span class="help" id="req_source_help">${L('An official entry can be reviewed immediately. A future or pending entry links automatically after registration.', 'يمكن مراجعة القيد الرسمي فوراً. يرتبط القيد المقبل أو المعلّق آلياً بعد اعتماده.')}</span></div>
        ${C.field({ label: L('Purpose of request', 'غاية الطلب'), id: 'req_purpose', req: true })}`,
      foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" id="req_save">${initial?L('Create and submit','إنشاء وإرسال'):L('Create request', 'إنشاء الطلب')}</button>`,
      onMount(el) {
        C.wire(el);
        const related = el.querySelector('#req_source'), personSelect = el.querySelector('#req_person');
        const refreshAction = () => { el.querySelector('#req_save').textContent = related.value.startsWith('official:') ? L('Create and submit','إنشاء وإرسال') : L('Create request','إنشاء الطلب'); };
        related.addEventListener('change', () => { const selectedRecord = SACRAMENTS.find(s=>s.id===related.value.split(':')[1]); if (selectedRecord) personSelect.value = selectedRecord.person; refreshAction(); });
        personSelect.addEventListener('change', () => { const selectedRecord = SACRAMENTS.find(s=>s.id===related.value.split(':')[1]); if (selectedRecord && selectedRecord.person!==personSelect.value) related.value=''; refreshAction(); });
        el.querySelector('#req_save')?.addEventListener('click', async () => {
          if (!need(el, '#req_purpose', L('Enter the purpose', 'أدخل غاية الطلب'))) return;
          const saveButton = el.querySelector('#req_save');
          saveButton.disabled = true;
          const [recordType,recordId] = related.value.split(':');
          const id = 'sc' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
          try {
            await serverWorkflow('create-certificate-request', id, { requestId:id, person:personSelect.value, purpose:el.querySelector('#req_purpose').value.trim(),
              sourceRecordId:recordType==='official'?recordId:null, requestedSacramentId:recordType==='pending'?recordId:null });
            closeOverlays(); location.hash = `#/certificate/${id}`; bus.refresh();
            toast(L('Request created', 'أُنشئ الطلب'), recordType==='official' ? L('Submitted for clergy review.', 'أُرسل لمراجعة الإكليروس.') : L('It will wait for an official register entry before approval.', 'سينتظر قيداً رسمياً قبل الاعتماد.'), 'success');
          } catch(e) { saveButton.disabled = false; toast(L('Could not create request', 'تعذّر إنشاء الطلب'), e.message, 'danger'); }
        });
      }
    });
  });
  if (S.ui.newCertificateSource && host.querySelector('#newcertreq')) host.querySelector('#newcertreq').click();
  host.querySelector('#newsacreq')?.addEventListener('click', () => openDrawer({
    title:L('New sacrament request','طلب سرّ جديد'),
    sub:L('Record the family request. The secretary may review it, or the priest may decide directly. Preparation begins only after priest approval.','سجّل طلب العائلة. يمكن للأمينة مراجعته، أو للكاهن اتخاذ القرار مباشرة. يبدأ التحضير فقط بعد موافقته.'),
    body:`<div class="formrow"><label class="label" for="srq_kind">${L('Sacrament','السرّ')}</label><select class="select" id="srq_kind">${Object.entries(KIND).filter(([k])=>k!=='certificate').map(([k,v])=>`<option value="${k}">${esc(L(v[0],v[1]))}</option>`).join('')}</select></div>
      <div class="formrow" id="srq-existing"><label class="label" for="srq_person">${L('Person receiving the sacrament','الشخص الذي سيقبل السرّ')}</label><select class="select" id="srq_person"><option value="">${L('Choose a person','اختر شخصاً')}</option>${PEOPLE.map(p=>`<option value="${esc(p.id)}">${esc(isAr()?p.ar:p.lat)}</option>`).join('')}</select></div>
      <label class="check" id="srq-child-choice"><input type="checkbox" id="srq-new-child"><span>${L('Baptism for a child not yet in People','معمودية لطفل غير مسجّل بعد في المؤمنين')}</span></label>
      <div id="srq-child-fields" hidden class="stack" style="gap:12px;margin:14px 0">${C.field({label:L('Child’s full name (English)','اسم الطفل الكامل (إنكليزي)'),id:'srq-child-lat',req:true})}
        ${C.field({label:L('Child’s full name (Arabic)','اسم الطفل الكامل (عربي)'),id:'srq-child-ar',req:true})}
        ${C.field({label:L('Child’s birth date','تاريخ ميلاد الطفل'),id:'srq-child-born',type:'date',req:true})}
        <div class="formgrid">${C.field({label:L('Father’s name (optional)','اسم الأب (اختياري)'),id:'srq-child-father'})}${C.field({label:L('Mother’s name (optional)','اسم الأم (اختياري)'),id:'srq-child-mother'})}</div>
        <p class="help">${L('Submitting creates a linked child record without a login account. If the child is already listed, select that person instead.','يُنشئ التقديم سجل طفل مرتبطاً دون حساب دخول. إذا كان الطفل مسجّلاً، اختر سجله بدلاً من ذلك.')}</p></div>
      ${C.field({label:L('Preferred date (optional)','التاريخ المفضّل (اختياري)'),id:'srq_date',type:'date'})}
      ${C.textarea({label:L('Family request / notes','طلب العائلة / ملاحظات'),id:'srq_notes',max:500})}`,
    foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-primary" id="srq_save">${L('Submit request','تقديم الطلب')}</button>`,
    onMount(el) { C.wire(el);
      const mode=()=>{const baptism=el.querySelector('#srq_kind').value==='baptism';el.querySelector('#srq-child-choice').hidden=!baptism;if(!baptism)el.querySelector('#srq-new-child').checked=false;
        const manual=baptism&&el.querySelector('#srq-new-child').checked;el.querySelector('#srq-child-fields').hidden=!manual;el.querySelector('#srq-existing').hidden=manual;};
      el.querySelector('#srq_kind').addEventListener('change',mode);el.querySelector('#srq-new-child').addEventListener('change',mode);mode();
      el.querySelector('#srq_save').addEventListener('click',async()=>{
      const manual=el.querySelector('#srq-new-child').checked,personId=el.querySelector('#srq_person').value;
      if(!manual&&!personId)return toast(L('Choose a person','اختر شخصاً'),'','warning');
      const child=manual?{lat:el.querySelector('#srq-child-lat').value.trim(),ar:el.querySelector('#srq-child-ar').value.trim(),
        born:el.querySelector('#srq-child-born').value,father:el.querySelector('#srq-child-father').value.trim(),mother:el.querySelector('#srq-child-mother').value.trim()}:null;
      if(manual&&(!child.lat||!child.ar||!child.born))return toast(L('Complete the child’s names and birth date','أكمل اسمَي الطفل وتاريخ ميلاده'),'','warning');
      const id='sc'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
      const btn=el.querySelector('#srq_save'); btn.disabled=true;
      try { await serverWorkflow('create-sacrament-request',id,{kind:el.querySelector('#srq_kind').value,person:manual?undefined:personId,child:child||undefined,date:el.querySelector('#srq_date').value,notes:el.querySelector('#srq_notes').value.trim()}); closeOverlays(); location.hash='#/requests'; bus.refresh(); toast(L('Request submitted','قُدّم الطلب'),L('It is ready for office review or a direct priest decision.','الطلب جاهز لمراجعة المكتب أو لقرار الكاهن المباشر.'),'success'); }
      catch(e) { btn.disabled=false; toast(L('Could not submit request','تعذّر تقديم الطلب'),e.message,'danger'); }
    }); }
  }));
  host.querySelectorAll('[data-prep-edit]').forEach(btn=>btn.addEventListener('click',()=>{
    const record=SACRAMENTS.find(s=>s.id===btn.dataset.prepEdit); if(!record)return;
    const requirements=PREP_REQUIREMENTS[record.kind]||[];
    openDrawer({title:L('Edit preparation','تعديل التحضير'),sub:L('Record the planned date and requirements. Complete preparation before celebration.','سجّل الموعد والمتطلبات. أكمل التحضير قبل الاحتفال.'),
      body:`<p class="t-caption dim">${esc((isAr()?person(record.person)?.ar:person(record.person)?.lat)||'')} · ${esc(kindLabel(record.kind))}</p>${C.field({label:L('Celebration date','تاريخ الاحتفال'),id:'prep_date',type:'date',value:record.date||''})}<div class="stack" style="gap:10px;margin-top:16px">${requirements.map(([en,ar,required],i)=>`<label class="check"><input type="checkbox" data-prep-item="${i}" ${Array.isArray(record.preparation)&&record.preparation[i]?'checked':''}><span>${esc(L(en,ar))}${required?'':` <small class="dim">(${L('optional','اختياري')})</small>`}</span></label>`).join('')}</div>`,
      foot:`<button class="btn btn-secondary" data-close>${L('Close','إغلاق')}</button><button class="btn btn-primary" id="prep_save">${L('Save preparation','حفظ التحضير')}</button>${record.status==='preparing'?`<button class="btn btn-secondary" id="prep_complete">${L('Complete preparation','إكمال التحضير')}</button>`:''}`,
      onMount(el){C.wire(el);const save=async()=>{await serverWorkflow('update-preparation',record.id,{date:el.querySelector('#prep_date').value,checklist:[...el.querySelectorAll('[data-prep-item]')].map(x=>x.checked)});};
        el.querySelector('#prep_save').addEventListener('click',async()=>{try{await save();closeOverlays();bus.refresh();toast(L('Preparation saved','حُفظ التحضير'),'','success')}catch(e){toast(L('Could not save preparation','تعذّر حفظ التحضير'),e.message,'danger')}});
        el.querySelector('#prep_complete')?.addEventListener('click',async()=>{try{await save();await serverWorkflow('complete-preparation',record.id);closeOverlays();bus.refresh();toast(L('Preparation completed','اكتمل التحضير'),L('Record the celebration on or after its date.','سجّل الاحتفال في موعده أو بعده.'),'success')}catch(e){toast(L('Could not complete preparation','تعذّر إكمال التحضير'),e.message,'danger')}});
      }});
  }));
  host.querySelectorAll('[data-prep-cancel]').forEach(btn=>btn.addEventListener('click',()=>openModal({title:L('Cancel this preparation?','إلغاء هذا التحضير؟'),sub:L('The request and its history remain available.','يبقى الطلب وسجله متاحين.'),body:C.textarea({label:L('Reason','السبب'),id:'prep_reason',max:500}),foot:`<button class="btn btn-secondary" data-close>${L('Keep','إبقاء')}</button><button class="btn btn-primary" id="prep_cancel_confirm">${L('Cancel preparation','إلغاء التحضير')}</button>`,onMount(el){C.wire(el);el.querySelector('#prep_cancel_confirm').addEventListener('click',async()=>{if(!need(el,'#prep_reason',L('Enter a reason','أدخل السبب')))return;try{await serverWorkflow('cancel-preparation',btn.dataset.prepCancel,{reason:el.querySelector('#prep_reason').value.trim()});closeOverlays();bus.refresh()}catch(e){toast(L('Could not cancel preparation','تعذّر إلغاء التحضير'),e.message,'danger')}})}})));

};

export const requests = () => sacraments('requests');
requests.mount = sacraments.mount;

/* ---------------- record page: progress, the document, details ---------------- */
const workflowStages = s => s.kind === 'certificate'
  ? [[L('Requested','طُلبت'), true], [L('Register entry linked','رُبط القيد'), !!sourceFor(s)],
     [L('Approved by the priest','اعتمدها الكاهن'), ['approved','issued'].includes(s.status)], [L('Issued','صدرت'), s.status === 'issued']]
  : [[L('Requested','طُلب'), true],
     [L('Accepted by the priest','قبله الكاهن'), !!s.requestApprovedAt || ['preparing','scheduled','draft','awaiting-signature','registered','issued'].includes(s.status) && !String(s.reg).startsWith('SRQ/')],
     [L('Prepared','اكتمل التحضير'), ['scheduled','draft','awaiting-signature','registered','issued'].includes(s.status)],
     [L('Celebrated','احتُفل به'), ['draft','awaiting-signature','registered','issued'].includes(s.status)],
     [L('Entered in the register','دُوّن في السجل'), ['registered','issued'].includes(s.status)]];

/* Where the request stands, one numbered step at a time, and the single next thing to do. */
const progressPanel = s => {
  const stages = workflowStages(s), closed = ['cancelled','rejected'].includes(s.status);
  const now = closed ? -1 : stages.findIndex(([, done]) => !done);
  const [next, owner] = nextStep(s);
  return `<section class="panel progresspanel"><div class="panel-b">
    <div class="progress-top"><h3>${s.kind === 'certificate' ? L('Request progress', 'مراحل الطلب') : L('Progress', 'المراحل')}</h3>${sacramentStatus(s)}</div>
    <p class="nextstep"><span class="lbl">${now < 0 ? L('Status', 'الحالة') : L('Next step', 'الخطوة التالية')}</span>
      <b>${esc(next)}</b>${owner ? `<span class="owner">${icon('people', 14)}${esc(owner)}</span>` : ''}</p>
    <ol class="steps${closed ? ' closed' : ''}">${stages.map(([label, done], i) => `<li class="${done ? 'done' : i === now ? 'now' : ''}">
      <span class="dot" aria-hidden="true">${done ? icon('check', 13) : i + 1}</span><span class="lbl">${esc(label)}</span>
      <span class="sr-only">${done ? L('done', 'منجز') : i === now ? L('current step', 'الخطوة الحالية') : L('not yet', 'لم يحن بعد')}</span></li>`).join('')}</ol>
    ${s.kind === 'certificate' && (s.purpose || s.godparents) ? `<p class="t-caption dim" style="margin-top:12px">${L('Purpose of the request', 'غاية الطلب')}: ${esc(s.purpose || s.godparents)}</p>` : ''}
  </div></section>`;
};

/* ---------- the document itself: one A4 vector sheet ----------
   The same drawing is the thumbnail, the full-size view, the printed page and the PNG and SVG
   downloads, so they can never disagree. Units are millimetres on an A4 page. */
const INK = '#233B32', SECONDARY = '#607068', RULE = '#DCE2DB';
const EN_FONT = "Inter,'Helvetica Neue','Segoe UI',Arial,sans-serif";
const AR_FONT = "'IBM Plex Sans Arabic','Geeza Pro','Segoe UI',Tahoma,Arial,sans-serif";
const ANY_FONT = "Inter,'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif";
const MONO_FONT = "'IBM Plex Mono',Menlo,Consolas,monospace";
const hasArabic = v => /[؀-ۿ]/.test(String(v || ''));
const DOC_LANGS = () => [['arabic', L('Arabic', 'عربي')], ['english', L('English', 'إنكليزي')], ['bilingual', L('Bilingual', 'ثنائي اللغة')]];
const docTitle = s => s.kind === 'certificate' ? L('Certificate', 'الشهادة') : L('Register extract', 'خلاصة القيد');
const docIssued = s => s.kind === 'certificate' && s.status === 'issued';
const docLangLabel = lang => (DOC_LANGS().find(([k]) => k === lang) || DOC_LANGS()[2])[1];

function certificateSVG(s, lang = 'bilingual') {
  const source = s.kind === 'certificate' ? sourceFor(s) : s, record = source || s;
  const p = person(record.person) || { lat: '', ar: '' }, cel = person(record.celebrant);
  const ar = lang !== 'english', en = lang !== 'arabic', both = ar && en;
  const dl = lang === 'arabic' ? 'ar' : lang === 'english' ? 'en' : '';
  const tx = (x, y, str, o = {}) => str ? `<text x="${x}" y="${y}" font-family="${o.font || EN_FONT}" font-size="${o.size || 4.6}" font-weight="${o.weight || 400}" fill="${o.fill || INK}" text-anchor="${o.anchor || 'middle'}"${o.rtl ? ' direction="rtl"' : ''}${o.spacing ? ` letter-spacing="${o.spacing}"` : ''}${o.opacity ? ` opacity="${o.opacity}"` : ''}>${esc(o.upper ? String(str).toUpperCase() : str)}</text>` : '';
  const arT = (x, y, str, o = {}) => tx(x, y, str, { font: AR_FONT, rtl: true, ...o });
  let y = 0;
  const out = [];
  /* frame, corner marks and the seal */
  out.push(`<rect width="210" height="297" fill="#FFFFFF"/>
    <rect x="8" y="8" width="194" height="281" fill="none" stroke="${SECONDARY}" stroke-width=".6"/>
    <rect x="11" y="11" width="188" height="275" fill="none" stroke="${SECONDARY}" stroke-width=".25" opacity=".55"/>
    ${[[11, 11], [199, 11], [11, 286], [199, 286]].map(([cx, cy]) => `<rect x="${cx - 1.4}" y="${cy - 1.4}" width="2.8" height="2.8" fill="${SECONDARY}" opacity=".7" transform="rotate(45 ${cx} ${cy})"/>`).join('')}
    <circle cx="105" cy="33" r="10" fill="none" stroke="${SECONDARY}" stroke-width=".7"/>
    <path d="M105 26.5v13M98.5 33h13" stroke="${SECONDARY}" stroke-width="1.5" stroke-linecap="round"/>`);
  /* who issues it */
  y = 55;
  if (ar) { out.push(arT(105, y, PARISH.eparchyAr, { size: 7.2, weight: 600, fill: SECONDARY }), arT(105, y + 8.5, `${PARISH.nameAr} — ${PARISH.townAr}`, { size: 4.8, fill: SECONDARY })); y += 20; }
  if (en) { out.push(tx(105, y, PARISH.eparchy, { size: 5.4, weight: 600, spacing: .5, upper: true }), tx(105, y + 6.5, `${PARISH.name} — ${PARISH.town}`, { size: 3.9, fill: SECONDARY })); y += 15; }
  out.push(`<path d="M80 ${y} H101 M109 ${y} H130" stroke="${SECONDARY}" stroke-width=".3"/><rect x="103.3" y="${y - 1.7}" width="3.4" height="3.4" fill="none" stroke="${SECONDARY}" stroke-width=".3" transform="rotate(45 105 ${y})"/>`);
  /* what it certifies, and for whom */
  y += 15;
  if (ar) { out.push(arT(105, y, KIND[record.kind]?.[1] || '', { size: 8, weight: 600 })); y += 8.5; }
  if (en) { out.push(tx(105, y, KIND[record.kind]?.[0] || '', { size: 4.4, spacing: 1.1, upper: true, fill: SECONDARY })); y += 6; }
  y += 6;
  if (both) out.push(tx(26, y, 'This certifies that', { size: 3.6, anchor: 'start', fill: SECONDARY }), arT(184, y, 'نشهد بأنّ', { size: 4, anchor: 'start', fill: SECONDARY }));
  else out.push(ar ? arT(105, y, 'نشهد بأنّ', { size: 4, fill: SECONDARY }) : tx(105, y, 'This certifies that', { size: 3.6, fill: SECONDARY }));
  y += 15;
  if (ar) { out.push(arT(105, y, p.ar, { size: 11, weight: 600 })); y += 10; }
  if (en) { out.push(tx(105, y, p.lat, { size: 5.6, spacing: .25, fill: SECONDARY })); y += 6; }
  /* the facts, each on a ruled line: English label, value, Arabic label */
  const rows = [
    [record.date > today() ? 'Scheduled for' : 'Celebrated on', record.date > today() ? 'مجدول في' : 'تاريخ الاحتفال', fmtDateIn(record.date, dl)],
    ['Celebrant', 'المحتفل', (lang === 'arabic' ? cel?.ar : cel?.lat) || '—'],
    ...[['godparents', 'Godparents / witnesses', 'الإشبين / الشهود'], ['father', 'Father', 'الأب'], ['mother', 'Mother', 'الأم'], ['place', 'Place', 'المكان']]
      .filter(([k]) => record[k]).map(([k, enL, arL]) => [enL, arL, record[k]])];
  const step = rows.length > 4 ? 9 : 10.5;
  y += 10;
  for (const [enL, arL, val] of rows) {
    const vo = { size: 4.6, weight: 600, font: ANY_FONT, rtl: hasArabic(val) };
    if (both) out.push(tx(26, y, enL, { size: 3.9, anchor: 'start', fill: SECONDARY }), tx(105, y, val, vo), arT(184, y, arL, { size: 4.3, anchor: 'start', fill: SECONDARY }));
    else if (en) out.push(tx(26, y, enL, { size: 4, anchor: 'start', fill: SECONDARY }), tx(184, y, val, { ...vo, anchor: hasArabic(val) ? 'start' : 'end' }));
    else out.push(arT(184, y, arL, { size: 4.5, anchor: 'start', fill: SECONDARY }), tx(26, y, val, { ...vo, anchor: hasArabic(val) ? 'end' : 'start' }));
    out.push(`<path d="M26 ${y + 2.6} H184" stroke="${RULE}" stroke-width=".25" stroke-dasharray=".8 1.2"/>`);
    y += step;
  }
  /* where it is written: book, page and entry */
  const boxY = Math.max(y + 6, 214);
  const cap = (enL, arL) => lang === 'arabic' ? arL : lang === 'english' ? enL.toUpperCase() : `${enL.toUpperCase()} · ${arL}`;
  [[57, 26, cap('Book', 'الدفتر'), record.book || '—'], [88, 26, cap('Page', 'الصفحة'), record.page || '—'], [119, 34, cap('Entry', 'القيد'), record.reg]].forEach(([x, w, lbl, val]) => {
    out.push(`<rect x="${x}" y="${boxY}" width="${w}" height="15" rx="1.2" fill="none" stroke="${RULE}" stroke-width=".4"/>`,
      tx(x + w / 2, boxY + 5, lbl, { size: lang === 'arabic' ? 3.2 : 2.5, spacing: lang === 'arabic' ? 0 : .3, fill: SECONDARY, font: ANY_FONT, rtl: lang === 'arabic' }), tx(x + w / 2, boxY + 11.6, val, { size: 4.4, weight: 600, font: MONO_FONT }));
  });
  /* signature and seal */
  const sigY = 260;
  out.push(`<path d="M26 ${sigY} H86" stroke="${INK}" stroke-width=".3"/>
    <circle cx="160" cy="${sigY - 5}" r="11.5" fill="none" stroke="${SECONDARY}" stroke-width=".35" stroke-dasharray="1.2 1.2" opacity=".8"/>`);
  if (docIssued(s) && s.issuedBy) out.push(tx(56, sigY - 3, s.issuedBy, { size: 4, font: ANY_FONT }));
  if (en) out.push(tx(56, sigY + 5, 'Parish priest', { size: 3.4, fill: SECONDARY }));
  if (ar) out.push(arT(56, sigY + (en ? 10 : 5), 'كاهن الرعية', { size: 3.8, fill: SECONDARY }));
  out.push(tx(160, sigY - 4, ar && !en ? 'الختم' : 'SEAL', { size: ar && !en ? 3.6 : 2.8, spacing: ar && !en ? 0 : .4, fill: SECONDARY, font: ANY_FONT, opacity: .85, rtl: ar && !en }));
  if (docIssued(s)) out.push(tx(105, 283, `${en ? 'Issued' : 'صدرت في'} ${fmtDateIn(zoned(s.issuedAt) || String(s.issuedAt || '').slice(0, 10), dl)}`, { size: 3, fill: SECONDARY, font: ANY_FONT, rtl: !en }));
  else out.push(`<g transform="rotate(-28 105 150)" opacity=".1">${en ? tx(105, ar ? 146 : 154, 'UNISSUED PREVIEW', { size: 13, weight: 700, spacing: 2, fill: SECONDARY }) : ''}${ar ? arT(105, en ? 162 : 154, 'معاينة غير صادرة', { size: 12, weight: 700, fill: SECONDARY }) : ''}</g>`);
  const label = `${KIND[record.kind]?.[0] || ''} — ${p.lat}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 297" width="210mm" height="297mm" role="img" aria-label="${esc(label)}">${out.join('')}</svg>`;
}

/* the thumbnail card: small paper, click to see it full size, download in three forms */
function docCard(s, lang) {
  const record = s.kind === 'certificate' ? sourceFor(s) : s, p = person(record.person) || {};
  return `<section class="panel doccard">
    <div class="panel-h"><h3>${docTitle(s)}</h3>
      <span class="seg doclang" role="group" aria-label="${L('Document language', 'لغة الوثيقة')}">${DOC_LANGS().map(([k, lab]) =>
        `<button type="button" aria-pressed="${lang === k}" data-go="certificate/${s.id}/${k}">${esc(lab)}</button>`).join('')}</span></div>
    <div class="panel-b doccard-b">
      <button type="button" class="docthumb" data-docview title="${L('Click to view full size', 'انقر للعرض بالحجم الكامل')}">
        ${certificateSVG(s, lang)}<span class="docthumb-hint">${icon('search', 14)}${L('View', 'عرض')}</span></button>
      <div class="docmeta">
        <b>${esc(kindLabel(record.kind))} · ${esc(nameIn(p))}</b>
        <span class="t-caption dim">A4 · ${esc(docLangLabel(lang))} · <span class="mono" dir="ltr">${esc(record.reg)}</span></span>
        <p class="docstate${docIssued(s) ? ' ok' : ''}">${icon(docIssued(s) ? 'check' : 'info', 15)}${docIssued(s)
          ? L('Signed and issued — ready to print or send.', 'موقّعة وصادرة — جاهزة للطباعة أو الإرسال.')
          : s.kind === 'certificate' ? L('Preview only — the certificate is not signed or issued yet.', 'معاينة فقط — لم تُوقَّع الشهادة ولم تصدر بعد.')
          : L('Preview of the register entry — not a certificate.', 'معاينة لقيد السجل — ليست شهادة.')}</p>
        <div class="docacts">
          <button type="button" class="btn btn-primary btn-dense" data-docview>${icon('doc', 16)}${L('View full size', 'عرض بالحجم الكامل')}</button>
          <button type="button" class="btn btn-secondary btn-dense" data-docdl aria-haspopup="menu" aria-expanded="false">${icon('export', 16)}${L('Download', 'تنزيل')}${icon('chevD', 14)}</button>
          <button type="button" class="btn btn-secondary btn-dense" data-docprint>${icon('print', 16)}${L('Print', 'طباعة')}</button>
          ${docIssued(s) ? `<button type="button" class="btn btn-ghost btn-dense" data-act="share-cert">${icon('msg', 16)}${L('Send on WhatsApp', 'إرسال على واتساب')}</button>` : ''}
        </div>
      </div>
    </div></section>`;
}

const docFile = (s, lang, ext) => {
  const record = s.kind === 'certificate' ? sourceFor(s) : s;
  return `${fileName(s.kind === 'certificate' ? 'certificate' : 'register-extract', KIND[record.kind]?.[0].split(' ')[0], person(record.person)?.lat, record.reg.replace(/\//g, '-'), lang)}.${ext}`;
};
function printDoc(s, lang, pdf = false) {
  if (pdf) toast(L('Saving as PDF', 'الحفظ كـPDF'), L('In the print window, choose “Save as PDF” as the printer.', 'في نافذة الطباعة، اختر «حفظ كـPDF» بدل الطابعة.'), 'success');
  printSheet({ title: docFile(s, lang, 'pdf').replace(/\.pdf$/, ''), margin: '0',
    body: certificateSVG(s, lang), css: 'html,body{width:210mm;height:297mm;overflow:hidden}svg{display:block;width:210mm;height:297mm}' });
}
function downloadMenu(anchor, s, lang) {
  openMenu(anchor, [
    { label: L('PDF — print or save', 'PDF — طباعة أو حفظ'), icon: 'doc', fn: () => printDoc(s, lang(), true) },
    { label: L('Image (PNG)', 'صورة (PNG)'), icon: 'export', hint: '1240×1754', fn: async () => {
      try { saveBlob(docFile(s, lang(), 'png'), await svgToPng(certificateSVG(s, lang()), 1240, 1754)); toast(L('Image saved', 'حُفظت الصورة'), docFile(s, lang(), 'png'), 'success'); }
      catch { toast(L('The image could not be made', 'تعذّر إنشاء الصورة'), L('Try the PDF instead.', 'جرّب PDF بدلاً منها.'), 'danger'); } } },
    { label: L('Vector file (SVG)', 'ملف متّجه (SVG)'), icon: 'export', fn: () => {
      saveBlob(docFile(s, lang(), 'svg'), new Blob([certificateSVG(s, lang())], { type: 'image/svg+xml' })); toast(L('File saved', 'حُفظ الملف'), docFile(s, lang(), 'svg'), 'success'); } }
  ], { width: 250 });
}
/* full size, with its own language switch so the reader can compare without leaving */
function viewDoc(s, lang) {
  let cur = lang;
  const record = s.kind === 'certificate' ? sourceFor(s) : s;
  openModal({ wide: true,
    title: `${docTitle(s)} — ${nameIn(person(record.person))}`,
    sub: `A4 · <span class="mono" dir="ltr">${esc(record.reg)}</span> · ${docIssued(s) ? L('issued', 'صادرة') : L('preview, not issued', 'معاينة، غير صادرة')}`,
    body: `<div class="docview-bar"><span class="seg" role="group" aria-label="${L('Document language', 'لغة الوثيقة')}">${DOC_LANGS().map(([k, lab]) =>
        `<button type="button" aria-pressed="${cur === k}" data-vlang="${k}">${esc(lab)}</button>`).join('')}</span></div>
      <div class="docviewer" id="docviewer">${certificateSVG(s, cur)}</div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
      <button class="btn btn-secondary" id="dv_dl" aria-haspopup="menu" style="margin-inline-start:auto">${icon('export', 16)}${L('Download', 'تنزيل')}${icon('chevD', 14)}</button>
      <button class="btn btn-primary" id="dv_print">${icon('print', 16)}${L('Print', 'طباعة')}</button>`,
    onMount(el) {
      el.querySelectorAll('[data-vlang]').forEach(b => b.addEventListener('click', () => {
        cur = b.dataset.vlang;
        el.querySelectorAll('[data-vlang]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        el.querySelector('#docviewer').innerHTML = certificateSVG(s, cur);
      }));
      el.querySelector('#dv_dl').addEventListener('click', e => downloadMenu(e.currentTarget, s, () => cur));
      el.querySelector('#dv_print').addEventListener('click', () => printDoc(s, cur));
    } });
}

const HIST = { 'sacrament requested': ['Request received', 'استُلم الطلب'], 'request submitted': ['Request received', 'استُلم الطلب'],
  'office review completed': ['Reviewed by the office', 'راجعه المكتب'], 'request accepted for preparation': ['Accepted by the priest', 'قبله الكاهن'],
  'request declined': ['Declined', 'رُفض'], 'preparation updated': ['Preparation updated', 'حُدّث التحضير'], 'preparation completed': ['Preparation completed', 'اكتمل التحضير'],
  'preparation cancelled': ['Preparation cancelled', 'أُلغي التحضير'], 'details updated': ['Details updated', 'حُدّثت التفاصيل'],
  'request amendment proposed': ['Request amendment proposed', 'اقتُرح تعديل الطلب'],
  'request amendment approved': ['Request amendment approved', 'اعتُمد تعديل الطلب'],
  'request amendment rejected': ['Request amendment rejected', 'رُفض تعديل الطلب'],
  'submitted for clergy review': ['Sent to the priest', 'أُرسل إلى الكاهن'], submit: ['Sent to the priest for approval', 'أُرسل إلى الكاهن للاعتماد'],
  'sacrament celebrated': ['Celebrated', 'احتُفل به'], approve: ['Approved', 'اعتُمد'], issue: ['Signed and issued', 'وُقّع وصدر'], reject: ['Rejected', 'رُفض'],
  cancelled: ['Cancelled', 'أُلغي'], 'source linked': ['Register entry linked', 'رُبط القيد'], correction: ['Corrected', 'صُحّح'] };
const histLabel = a => HIST[a] ? L(...HIST[a]) : String(a || '').charAt(0).toUpperCase() + String(a || '').slice(1);
const zoned = at => { const v = String(at || ''); if (!/T.*(Z|[+-]\d\d:?\d\d)$/.test(v)) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
const when = at => { if (!at) return ''; const d = zoned(at), v = String(at);
  return d ? `${fmtDate(d)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : `${fmtDate(v.slice(0, 10))}${v.length > 10 ? ` · ${v.slice(11, 16)}` : ''}`; };

export function certificate(id, lang = 'bilingual') {
  const s = SACRAMENTS.find(x => x.id === id);
  if (!s) return empty('doc', L('Record not found', 'لم يُعثر على القيد'), L('Open a record from Requests or from a person’s Sacraments tab.', 'افتح قيداً من الطلبات أو من تبويب الأسرار في سجل الشخص.'));
  if (!DOC_LANGS().some(([k]) => k === lang)) lang = 'bilingual';
  const source = s.kind === 'certificate' ? SACRAMENTS.find(x => x.id === s.sourceRecordId) : s;
  const record = source || s;
  const p = person(record.person) || { lat: '', ar: '' }, cel = person(record.celebrant);
  const asRequest = s.kind === 'certificate' || ['requested','office-reviewed','rejected','cancelled'].includes(s.status);
  const hasDoc = !!source && (s.kind === 'certificate' || official(s));
  const proposed = s.kind !== 'certificate' && !hasDoc && !!s.date && ['preparing','scheduled','draft','awaiting-signature'].includes(s.status);

  const purpose = s.kind === 'certificate' ? s.purpose || s.godparents : '';
  const planned = s.kind === 'certificate' && s.requestedSacramentId ? SACRAMENTS.find(x => x.id === s.requestedSacramentId) : null;
  const dlRows = s.kind === 'certificate' ? [
      [L('Person', 'الشخص'), `<a href="#/person/${esc(p.id || '')}">${esc(p.lat)}</a><small class="dim" style="display:block;font-family:var(--arabic)">${esc(p.ar)}</small>`],
      [L('Certificate of', 'شهادة'), source ? esc(kindLabel(source.kind)) : planned ? `${esc(kindLabel(planned.kind))} <small class="dim">· ${L('not celebrated yet', 'لم يُحتفل به بعد')}</small>` : `<span class="dim">${L('Not linked to an entry yet', 'لم تُربط بقيد بعد')}</span>`],
      [L('Requested on', 'تاريخ الطلب'), fmtDate(s.date)],
      purpose ? [L('Purpose', 'الغاية'), esc(purpose)] : null,
      [L('Request reference', 'مرجع الطلب'), `<span class="mono" dir="ltr">${esc(s.reg)}</span>`],
      source ? [L('Register entry', 'القيد'), `<a class="mono" dir="ltr" href="#/certificate/${esc(source.id)}">${esc(source.reg)}</a>`]
        : planned ? [L('Planned sacrament', 'السرّ المخطّط'), `<a class="mono" dir="ltr" href="#/certificate/${esc(planned.id)}">${esc(planned.reg)}</a>`] : null
    ] : [
      [L('Person', 'الشخص'), `<a href="#/person/${esc(p.id || '')}">${esc(p.lat)}</a><small class="dim" style="display:block;font-family:var(--arabic)">${esc(p.ar)}</small>`],
      [L('Sacrament', 'السرّ'), esc(kindLabel(record.kind))],
      [record.date > today() ? L('Planned for', 'الموعد المقرّر') : L('Date', 'التاريخ'), record.date ? fmtDate(record.date) : L('Not set yet', 'لم يُحدَّد بعد')],
      [L('Celebrant', 'المحتفل'), esc(nameIn(cel) || L('To be assigned', 'يُحدَّد لاحقاً'))],
      record.godparents ? [L('Godparents / witnesses', 'الإشبين / الشهود'), esc(record.godparents)] : null,
      [L('Book / page', 'الدفتر / الصفحة'), `${esc(record.book || '—')} / ${esc(record.page || '—')}`],
      [official(s) ? L('Register entry', 'رقم القيد') : L('Reference', 'المرجع'), `<span class="mono" dir="ltr">${esc(s.reg)}</span>`],
      s.requestReference && s.requestReference !== s.reg ? [L('Request reference', 'مرجع الطلب'), `<span class="mono" dir="ltr">${esc(s.requestReference)}</span>`] : null,
      record.externalParish ? [L('Other parish', 'رعية أخرى'), esc(record.externalParish)] : null,
      record.externalReference ? [L('Their reference', 'مرجعها'), esc(record.externalReference)] : null
    ];
  const details = panel(L('Details', 'التفاصيل'), `<dl class="dl">${dlRows.filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    ${s.requestNotes ? `<p class="t-caption" style="margin-top:14px"><b>${L('From the family', 'من العائلة')}:</b> ${esc(s.requestNotes)}</p>` : ''}
    ${s.pendingAmendment?`<div class="alert alert-warning" style="margin-top:14px"><b>${L('Amendment awaiting priest decision','تعديل بانتظار قرار الكاهن')}</b><br>${esc(s.pendingAmendment.reason)}<br>${L('Requested date','التاريخ المطلوب')}: ${esc(s.pendingAmendment.date||'—')} · ${L('Notes','ملاحظات')}: ${esc(s.pendingAmendment.notes||'—')}</div>`:''}`);

  const people = [[L('Request accepted by', 'قبل الطلب'), s.requestApprovedBy, s.requestApprovedAt], [L('Approved by', 'اعتمده'), s.approvedBy, s.approvedAt], [L('Issued by', 'أصدره'), s.issuedBy, s.issuedAt]].filter(([, by]) => by);
  const activity = panel(L('Activity', 'النشاط'), `${people.length ? `<dl class="dl" style="margin-bottom:14px">${people.map(([k, by, at]) => `<dt>${k}</dt><dd>${esc(by)}<small class="dim" style="display:block">${esc(when(at))}</small></dd>`).join('')}</dl>` : ''}
    ${(s.history || []).length ? `<div class="timeline">${s.history.slice().reverse().map(h => `<div class="tl-item"><div class="when">${esc(when(h.at))}</div>
        <div class="what">${esc(histLabel(h.action))}${h.by ? ` · ${esc(h.by)}` : ''}${h.source ? ` · <span class="mono" dir="ltr">${esc(h.source)}</span>` : ''}${h.reason ? `<small class="dim" style="display:block">${esc(h.reason)}</small>` : ''}${h.before&&h.after?`<small class="dim" style="display:block">${L('Date','التاريخ')}: ${esc(h.before.date||'—')} → ${esc(h.after.date||'—')} · ${L('Notes','ملاحظات')}: ${esc(h.before.notes||'—')} → ${esc(h.after.notes||'—')}</small>`:''}</div></div>`).join('')}</div>`
      : `<p class="t-caption dim">${L('Nothing recorded yet.', 'لا شيء مسجَّل بعد.')}</p>`}`);

  return `${pageHead({
      crumbs: [{ label: L('Records', 'السجلات') }, { label: asRequest ? L('Requests', 'الطلبات') : L('Sacraments', 'الأسرار'), href: asRequest ? '#/requests' : '#/sacraments' }, { label: s.reg }],
      title: kindLabel(s.kind),
      sub: `<bdi>${esc(nameIn(p))}</bdi> · <bdi class="mono" dir="ltr">${esc(s.reg)}</bdi>${s.date ? ` · <bdi>${fmtDate(s.date)}</bdi>` : ''}`,
      actions: `${s.kind !== 'certificate' && ['requested','office-reviewed'].includes(s.status) && is('priest')
        ? `<button class="btn btn-primary" id="acceptrequest">${icon('check',17)}${L('Accept request','قبول الطلب')}</button><button class="btn btn-secondary" id="declinerequest">${L('Decline','رفض')}</button>`
        : s.kind !== 'certificate' && s.status === 'requested' && is('secretary')
        ? `<button class="btn btn-primary" id="officereview">${icon('check',17)}${L('Mark as reviewed by the office','تعليم كمراجَع من المكتب')}</button>`
        : s.kind !== 'certificate' && s.status === 'preparing'
        ? `<a class="btn btn-primary" href="#/sacraments">${L('Continue preparation','متابعة التحضير')}</a>`
        : s.kind === 'certificate' && !source && s.requestedSacramentId && ['draft','awaiting-signature'].includes(s.status)
        ? `<a class="btn btn-primary" href="#/certificate/${esc(s.requestedSacramentId)}">${icon('sacr',17)}${L('Open the planned sacrament','افتح السرّ المخطّط له')}</a>`
        : s.kind === 'certificate' && !source && ['draft','awaiting-signature'].includes(s.status) && eligibleSources(s.person).length && is('priest','secretary')
        ? `<button class="btn btn-primary" id="linksource">${icon('link', 17)}${L('Link register entry', 'ربط القيد')}</button>`
        : s.kind === 'certificate' && !source && ['draft','awaiting-signature'].includes(s.status) && is('priest','secretary')
        ? `<a class="btn btn-secondary" href="#/person/${esc(s.person)}/sacraments">${icon('sacr',17)}${L('See this person’s sacraments','عرض أسرار هذا الشخص')}</a>`
        : is('priest') && s.status === 'awaiting-signature' && (s.kind === 'certificate' ? !!source : s.date <= today())
        ? `<button class="btn btn-primary" id="approve">${icon('check', 17)}${s.kind === 'certificate' ? L('Approve request', 'اعتماد الطلب') : L('Approve entry', 'اعتماد القيد')}</button>`
        : is('priest') && s.kind === 'certificate' && s.status === 'approved'
          ? `<button class="btn btn-primary" id="sign">${icon('check', 17)}${L('Sign and issue', 'التوقيع والإصدار')}</button>`
          : s.kind !== 'certificate' && s.status === 'registered'
            ? `<button class="btn btn-secondary" id="startcertreq">${icon('doc', 17)}${L('Request a certificate', 'طلب شهادة')}</button>`
          : is('secretary','priest') && ['draft','scheduled'].includes(s.status) && (s.kind === 'certificate' ? !!source : s.date <= today())
            ? `<button class="btn btn-primary" id="submit">${icon('send', 17)}${s.status === 'scheduled' ? L('Confirm celebrated and send for approval','تأكيد الاحتفال وإرساله للاعتماد') : L('Send to the priest','إرسال إلى الكاهن')}</button>`
            : ''}
        ${s.kind !== 'certificate' && ['draft','scheduled'].includes(s.status) && is('secretary','priest') ? `<button class="btn btn-secondary" id="editentry">${icon('edit',17)}${L('Edit details','تعديل التفاصيل')}</button>` : ''}
        ${s.kind !== 'certificate' && s.requestApprovedAt && ['preparing','scheduled','draft','awaiting-signature'].includes(s.status) && is('secretary','priest') && !s.pendingAmendment ? `<button class="btn btn-secondary" id="amendrequest">${L('Propose request amendment','اقتراح تعديل الطلب')}</button>`:''}
        ${s.pendingAmendment && is('priest') ? `<button class="btn btn-primary" id="approveamend">${L('Approve amendment','اعتماد التعديل')}</button><button class="btn btn-secondary" id="rejectamend">${L('Reject amendment','رفض التعديل')}</button>`:''}
        ${s.status === 'awaiting-signature' && is('priest') ? `<button class="btn btn-secondary" id="reject">${L('Reject','رفض')}</button>` : ''}
        ${s.kind === 'certificate' && ['draft','awaiting-signature'].includes(s.status) && is('secretary','priest') ? `<button class="btn btn-ghost" id="cancelrequest">${L('Cancel request','إلغاء الطلب')}</button>` : ''}`
    })}
    ${progressPanel(s)}
    ${s.kind !== 'certificate' && s.status === 'scheduled' && s.date > today() ? C.inlineAlert('info', L('Scheduled, not celebrated yet', 'مجدول ولم يُحتفل به بعد'), L(`On or after ${fmtDate(s.date)}, confirm it was celebrated and send it to the priest for approval.`, `في ${fmtDate(s.date)} أو بعده، أكّد الاحتفال وأرسله إلى الكاهن للاعتماد.`)) : ''}
    <div class="recordview">
      <div class="recordmain">
        ${hasDoc ? docCard(s, lang) : proposed ? panel(L('Proposed register preview · not official','معاينة القيد المقترح · غير رسمي'),
          `<div class="doccard-b"><div class="docthumb" aria-label="${L('Proposed register entry','القيد المقترح')}">${certificateSVG(s,lang)}</div><div class="docmeta"><p class="alert alert-warning">${L('For checking details before celebration only. This is not an official register entry or certificate. The priest must approve the celebrated sacrament before it becomes official.','لمراجعة التفاصيل قبل الاحتفال فقط. هذا ليس قيداً رسمياً أو شهادة. يجب أن يعتمد الكاهن السر المحتفل به ليصبح رسمياً.')}</p></div></div>`) : panel(s.kind === 'certificate' ? L('Certificate', 'الشهادة') : L('Register entry', 'قيد السجل'),
          `<div class="docempty">${icon('doc', 22)}<p>${s.kind === 'certificate' && ['cancelled','rejected'].includes(s.status) ? L('This request was closed, so no certificate was made.', 'أُغلق هذا الطلب، فلم تُنشأ شهادة.')
            : s.kind === 'certificate' ? (s.requestedSacramentId ? L('This certificate is for a sacrament that has not been celebrated and approved yet. It links itself as soon as the priest approves that entry; the certificate can then be previewed here.', 'هذه الشهادة لسرّ لم يُحتفل به ولم يُعتمد بعد. ترتبط به تلقائياً حين يعتمد الكاهن قيده، ثم يمكن معاينتها هنا.')
              : eligibleSources(s.person).length ? L('Link the approved entry this certificate is taken from; it can then be previewed here and the priest can approve it.', 'اربط القيد المعتمد الذي تؤخذ منه هذه الشهادة؛ ثم يمكن معاينتها هنا ويعتمدها الكاهن.')
              : L('There is no approved entry for this person yet. Record the sacrament and have it approved first; the certificate is then linked to it and can be previewed here.', 'لا قيد معتمداً لهذا الشخص بعد. سجّل السرّ واعتمده أولاً، ثم تُربط الشهادة به ويمكن معاينتها هنا.'))
            : ['cancelled','rejected'].includes(s.status) ? L('This request was closed, so there is no register entry.', 'أُغلق هذا الطلب، فلا قيد له.')
            : L('The register entry can be previewed once the sacrament is celebrated and approved by the priest.', 'يمكن معاينة القيد بعد الاحتفال بالسرّ واعتماد الكاهن له.')}</p></div>`)}
        ${details}
      </div>
      <aside class="sidecol">${activity}</aside>
    </div>`;
}

certificate.mount = (host, id, lang = 'bilingual') => {
  C.wire(host);
  const doc = SACRAMENTS.find(x => x.id === id);
  if (!DOC_LANGS().some(([k]) => k === lang)) lang = 'bilingual';
  host.querySelectorAll('[data-docview]').forEach(b => b.addEventListener('click', () => viewDoc(doc, lang)));
  host.querySelector('[data-docdl]')?.addEventListener('click', e => downloadMenu(e.currentTarget, doc, () => lang));
  host.querySelector('[data-docprint]')?.addEventListener('click', () => printDoc(doc, lang));
  host.querySelector('#amendrequest')?.addEventListener('click',()=>openDrawer({
    title:L('Propose a request amendment','اقتراح تعديل الطلب'),
    sub:L('The accepted request stays unchanged until a priest approves this amendment. The reason and decision remain in its history.','يبقى الطلب المقبول بلا تغيير حتى يعتمد الكاهن التعديل. يبقى السبب والقرار في السجل.'),
    body:`${C.field({label:L('Requested date','التاريخ المطلوب'),id:'amend_date',type:'date',value:doc.requestedDate||''})}
      ${C.textarea({label:L('Family request / notes','طلب العائلة / ملاحظات'),id:'amend_notes',value:doc.requestNotes||'',max:500})}
      ${C.textarea({label:L('Reason for amendment','سبب التعديل'),id:'amend_reason',max:500})}`,
    foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-primary" id="amend_save">${L('Send for priest decision','إرسال لقرار الكاهن')}</button>`,
    onMount(el){C.wire(el);el.querySelector('#amend_save').addEventListener('click',async()=>{
      if(!need(el,'#amend_reason',L('Enter a reason','أدخل السبب')))return;
      try{await serverWorkflow('propose-request-amendment',id,{date:el.querySelector('#amend_date').value,
        notes:el.querySelector('#amend_notes').value.trim(),reason:el.querySelector('#amend_reason').value.trim()});closeOverlays();bus.refresh();
        toast(L('Amendment proposed','اقتُرح التعديل'),'','success');}catch(e){toast(L('Could not propose amendment','تعذّر اقتراح التعديل'),e.message,'danger');}
    });}
  }));
  host.querySelector('#approveamend')?.addEventListener('click',async()=>{try{await serverWorkflow('approve-request-amendment',id);bus.refresh();toast(L('Amendment approved','اعتُمد التعديل'),'','success');}catch(e){toast(L('Could not approve amendment','تعذّر اعتماد التعديل'),e.message,'danger');}});
  host.querySelector('#rejectamend')?.addEventListener('click',()=>openModal({title:L('Reject request amendment?','رفض تعديل الطلب؟'),
    body:C.textarea({label:L('Reason (optional)','السبب (اختياري)'),id:'amend_reject_reason',max:500}),
    foot:`<button class="btn btn-secondary" data-close>${L('Keep pending','إبقاء معلقاً')}</button><button class="btn btn-primary" id="amend_reject_confirm">${L('Reject amendment','رفض التعديل')}</button>`,
    onMount(el){C.wire(el);el.querySelector('#amend_reject_confirm').addEventListener('click',async()=>{try{await serverWorkflow('reject-request-amendment',id,{reason:el.querySelector('#amend_reject_reason').value.trim()});closeOverlays();bus.refresh();}catch(e){toast(L('Could not reject amendment','تعذّر رفض التعديل'),e.message,'danger');}});}}));
  host.querySelector('#officereview')?.addEventListener('click',async()=>{
    try { await serverWorkflow('review-sacrament-request',id); bus.refresh(); toast(L('Office review completed','اكتملت مراجعة المكتب'),L('The priest can now decide.','يمكن للكاهن اتخاذ القرار الآن.'),'success'); }
    catch(e) { toast(L('Review could not be saved','تعذّر حفظ المراجعة'),e.message,'danger'); }
  });
  host.querySelector('#acceptrequest')?.addEventListener('click',()=>openModal({
    title:L('Accept this sacrament request?','قبول طلب السرّ؟'),
    sub:L('The request will move to Preparation. The priest may accept it without a secretary review.','سينتقل الطلب إلى التحضير. يمكن للكاهن قبوله من دون مراجعة الأمينة.'),
    body:`<p>${L('Confirm the person and sacrament before accepting.','تأكّد من الشخص والسرّ قبل القبول.')}</p>`,
    foot:`<button class="btn btn-secondary" data-close>${L('Back','رجوع')}</button><button class="btn btn-primary" id="accept_confirm">${L('Accept request','قبول الطلب')}</button>`,
    onMount(el){el.querySelector('#accept_confirm').addEventListener('click',async()=>{try{await serverWorkflow('approve-sacrament-request',id);closeOverlays();bus.refresh();toast(L('Request accepted','قُبل الطلب'),L('Preparation can begin.','يمكن بدء التحضير.'),'success')}catch(e){toast(L('Could not accept request','تعذّر قبول الطلب'),e.message,'danger')}})}
  }));
  host.querySelector('#declinerequest')?.addEventListener('click',()=>openModal({
    title:L('Decline this sacrament request?','رفض طلب السرّ؟'),
    sub:L('The declined request stays in the completed history.','يبقى الطلب المرفوض في سجل الطلبات المكتملة.'),
    body:C.textarea({label:L('Reason','السبب'),id:'decline_reason',max:500}),
    foot:`<button class="btn btn-secondary" data-close>${L('Back','رجوع')}</button><button class="btn btn-primary" id="decline_confirm">${L('Decline request','رفض الطلب')}</button>`,
    onMount(el){C.wire(el);el.querySelector('#decline_confirm').addEventListener('click',async()=>{if(!need(el,'#decline_reason',L('Enter a reason','أدخل السبب')))return;try{await serverWorkflow('decline-sacrament-request',id,{reason:el.querySelector('#decline_reason').value.trim()});closeOverlays();bus.refresh()}catch(e){toast(L('Could not decline request','تعذّر رفض الطلب'),e.message,'danger')}})}
  }));
  host.querySelector('#startcertreq')?.addEventListener('click', () => { S.ui.newCertificateSource = id; location.hash = '#/requests'; });
  host.querySelector('#editentry')?.addEventListener('click', () => {
    const record = SACRAMENTS.find(s=>s.id===id);
    if (!record || !['draft','scheduled'].includes(record.status)) return;
    openDrawer({
      title:L('Edit sacrament details','تعديل تفاصيل السرّ'),
      sub:L('Changes are kept in the record’s history. Once the priest approves the entry it can no longer be edited here.','تُحفظ التعديلات في سجل القيد. بعد أن يعتمد الكاهن القيد لا يمكن تعديله من هنا.'),
      body:`<div class="formgrid">${C.field({label:L('Celebration date','تاريخ الاحتفال'),id:'edit_date',type:'date',value:record.date,req:true})}<div class="formrow"><label class="label" for="edit_celebrant">${L('Celebrant','المحتفل')}</label><select class="select" id="edit_celebrant"><option value="">${L('To be assigned','يُحدّد لاحقاً')}</option>${PEOPLE.filter(p=>p.status==='clergy'||p.id===record.celebrant).map(p=>`<option value="${esc(p.id)}" ${p.id===record.celebrant?'selected':''}>${esc(isAr()?p.ar:p.lat)}</option>`).join('')}</select></div></div>
        <div class="formgrid">${C.field({label:L('Book','الدفتر'),id:'edit_book',value:record.book||''})}${C.field({label:L('Page','الصفحة'),id:'edit_page',value:record.page||''})}</div>
        ${C.field({label:L('Godparents / witnesses','الإشبين / الشهود'),id:'edit_godparents',value:record.godparents||''})}
        <div class="formgrid">${C.field({label:L('Father','الأب'),id:'edit_father',value:record.father||''})}${C.field({label:L('Mother','الأم'),id:'edit_mother',value:record.mother||''})}</div>
        ${C.field({label:L('Place','المكان'),id:'edit_place',value:record.place||''})}
        <div class="formgrid">${C.field({label:L('External parish','الرعية الخارجية'),id:'edit_externalParish',value:record.externalParish||''})}${C.field({label:L('External reference','المرجع الخارجي'),id:'edit_externalReference',value:record.externalReference||''})}</div>`,
      foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-primary" id="edit_save">${L('Save changes','حفظ التعديلات')}</button>`,
      onMount(el) { C.wire(el); el.querySelector('#edit_save').addEventListener('click',async()=>{
        if (!need(el,'#edit_date',L('Enter a date','أدخل التاريخ'))) return;
        const fields = Object.fromEntries(['date','celebrant','book','page','godparents','father','mother','place','externalParish','externalReference'].map(k=>[k,el.querySelector('#edit_'+k).value.trim()]));
        try { await serverWorkflow('update-entry',id,{fields}); closeOverlays(); bus.refresh(); toast(L('Details updated','حُدّثت التفاصيل'),L('The workflow and activity history were updated.','حُدّث المسار وسجل النشاط.'),'success'); }
        catch(e) { toast(L('Could not update entry','تعذّر تعديل القيد'),e.message,'danger'); }
      }); }
    });
  });
  host.querySelector('#linksource')?.addEventListener('click', () => {
    const request = SACRAMENTS.find(s => s.id === id);
    const sources = SACRAMENTS.filter(s => s.person === request?.person && s.kind !== 'certificate' && ['registered','issued'].includes(s.status));
    openDrawer({
      title: L('Link the register entry', 'ربط القيد'),
      sub: L('Choose the approved entry this certificate is taken from. The link is kept in the request’s history.', 'اختر القيد المعتمد الذي تؤخذ منه هذه الشهادة. يُحفظ الربط في سجل الطلب.'),
      body: sources.length ? `<div class="formrow"><label class="label" for="link_source">${L('Approved entry', 'القيد المعتمد')}</label><select class="select" id="link_source">${sources.map(s => `<option value="${esc(s.id)}">${esc(s.reg)} · ${esc(kindLabel(s.kind))}</option>`).join('')}</select></div>`
        : C.inlineAlert('warning', L('No eligible register entry', 'لا قيد مؤهّل'), L('Register and approve the sacrament before linking this request.', 'سجّل السرّ واعتمده قبل ربط هذا الطلب.')),
      foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" id="link_save" ${sources.length ? '' : 'disabled'}>${L('Link entry', 'ربط القيد')}</button>`,
      onMount(el) {
        C.wire(el);
        el.querySelector('#link_save')?.addEventListener('click', async () => {
          try { await serverWorkflow('link-source', id, { sourceRecordId: el.querySelector('#link_source').value }); closeOverlays(); bus.refresh(); toast(L('Entry linked', 'رُبط القيد'), L('The certificate can now be previewed and sent to the priest.', 'يمكن الآن معاينة الشهادة وإرسالها إلى الكاهن.'), 'success'); }
          catch (e) { toast(L('Could not link source', 'تعذّر ربط المصدر'), e.message, 'danger'); }
        });
      }
    });
  });
  const confirm = (button, action) => button?.addEventListener('click', () => openModal({
    title: action === 'approve' ? (SACRAMENTS.find(s=>s.id===id)?.kind==='certificate' ? L('Approve this certificate request?','اعتماد طلب الشهادة؟') : L('Approve this register entry?', 'اعتماد هذا القيد؟')) : L('Sign and issue this certificate?', 'توقيع هذه الشهادة وإصدارها؟'),
    sub: L('This action is recorded with your account and the time. Check the original register before confirming.', 'يُسجّل هذا الإجراء باسم حسابك ووقته. راجع السجل الأصلي قبل التأكيد.'),
    body: `<label class="check"><input type="checkbox" id="ack">
      <span>${L('I have checked the register entry against the bound book.', 'راجعتُ القيد مقابل الدفتر الأصلي.')}</span></label>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="confirm" disabled>${action === 'approve' ? (SACRAMENTS.find(s=>s.id===id)?.kind==='certificate' ? L('Approve request', 'اعتماد الطلب') : L('Approve entry', 'اعتماد القيد')) : L('Sign and issue', 'التوقيع والإصدار')}</button>`,
    onMount(el) {
      const ack = el.querySelector('#ack'), ok = el.querySelector('#confirm');
      ack.addEventListener('change', () => { ok.disabled = !ack.checked; });
      ok.addEventListener('click', async () => {
        try { await serverWorkflow(action, id, { verified: true }); closeOverlays(); bus.refresh();
          const cert = SACRAMENTS.find(s=>s.id===id)?.kind === 'certificate';
          toast(action === 'issue' ? L('Certificate issued', 'صدرت الشهادة') : cert ? L('Request approved', 'اعتُمد الطلب') : L('Entry approved', 'اعتُمد القيد'),
            action === 'issue' ? L('It is signed and ready to print, download or send.', 'موقّعة وجاهزة للطباعة أو التنزيل أو الإرسال.')
              : cert ? L('Next: sign and issue the certificate.', 'التالي: توقيع الشهادة وإصدارها.') : L('It now has its official register number.', 'صار له رقم القيد الرسمي.'), 'success'); }
        catch (e) { toast(L('Action could not be completed', 'تعذّر إتمام الإجراء'), e.message, 'danger'); }
      });
    }
  }));
  confirm(host.querySelector('#approve'), 'approve'); confirm(host.querySelector('#sign'), 'issue');
  const decision = (selector, action) => host.querySelector(selector)?.addEventListener('click', () => openModal({
    title: action==='reject' ? L('Reject this request or entry?','رفض هذا الطلب أو القيد؟') : L('Cancel this certificate request?','إلغاء طلب الشهادة؟'),
    sub: L('The decision and reason will remain in the activity history.','سيبقى القرار وسببه في سجل النشاط.'),
    body: C.textarea({label:L('Reason','السبب'),id:'decision_reason',max:500}),
    foot:`<button class="btn btn-secondary" data-close>${L('Keep open','إبقاؤه مفتوحاً')}</button><button class="btn btn-primary" id="decision_confirm">${action==='reject'?L('Reject','رفض'):L('Cancel request','إلغاء الطلب')}</button>`,
    onMount(el) { C.wire(el); el.querySelector('#decision_confirm').addEventListener('click',async()=>{
      if (!need(el,'#decision_reason',L('Enter a reason','أدخل السبب'))) return;
      try { await serverWorkflow(action,id,{verified:action==='reject',reason:el.querySelector('#decision_reason').value.trim()}); closeOverlays(); bus.refresh(); toast(L('Decision saved','حُفظ القرار'),L('The activity history was updated.','حُدّث سجل النشاط.'),'success'); }
      catch(e) { toast(L('Decision could not be saved','تعذّر حفظ القرار'),e.message,'danger'); }
    }); }
  }));
  decision('#reject','reject'); decision('#cancelrequest','cancel');
  host.querySelector('#submit')?.addEventListener('click', async () => { try { await serverWorkflow('submit', id); bus.refresh(); } catch (e) { toast(L('Could not submit entry', 'تعذّر إرسال القيد'), e.message, 'danger'); } });
};

