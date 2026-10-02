/* Module 7 — sacramental registers, preparation, certificates, corrections. */
import { t, isAr, fmtDate, num } from '../i18n.js';
import { is, bus, S } from '../store.js';
import { icon, pageHead, sectionH, panel, who, status, statusLabel, pill, esc, table, wireTables, empty,
         searchField, openDrawer, openModal, closeOverlays, toast, stat, tabBar, avatar } from '../ui.js';
import * as C from '../components.js';
import * as CR from '../crud.js';
import { VERBS } from '../actions.js';
import { need } from '../flows.js';
import { workflow as serverWorkflow } from '../persist.js';
import { SACRAMENTS, anniversaryItems, PARISH, PREP_REQUIREMENTS, CORRECTIONS, PEOPLE, person, RESERVATIONS, SERVICE_REQUESTS, PORTAL_REQUESTS, REQUEST_HISTORY, REGISTRATIONS } from '../data.js';

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
const nextStep = s => ['cancelled','rejected'].includes(s.status)
  ? [L('Closed — review activity history', 'مغلق — راجع سجل النشاط'), L('Parish office', 'مكتب الرعية')]
  : s.kind === 'certificate' && !s.sourceRecordId
  ? [s.requestedSacramentId ? L('Complete and approve the planned sacrament', 'إتمام السرّ المخطّط له واعتماده') : eligibleSources(s.person).length ? L('Link the official register entry', 'ربط القيد الرسمي') : L('Create or complete the sacrament record', 'أنشئ أو أكمل قيد السرّ'), L('Parish office', 'مكتب الرعية')]
  : ({
  requested: [L('Office review or direct priest decision', 'مراجعة المكتب أو قرار الكاهن مباشرة'), L('Parish office or priest', 'مكتب الرعية أو الكاهن')],
  'office-reviewed': [L('Priest accepts or declines', 'الكاهن يقبل أو يرفض'), L('Assigned parish priest', 'كاهن الرعية المعيّن')],
  preparing: [L('Complete the preparation checklist', 'أكمل لائحة التحضير'), L('Parish office', 'مكتب الرعية')],
  draft: [s.kind === 'certificate' ? L('Submit the certificate request for review', 'إرسال طلب الشهادة للمراجعة') : L('Celebrated — submit for review', 'تمّ الاحتفال — أرسل للمراجعة'), L('Parish office', 'مكتب الرعية')],
  scheduled: [s.date > today() ? L('Wait for the celebration date', 'انتظر موعد الاحتفال') : L('Record celebration and submit for review', 'سجّل الاحتفال وأرسل للمراجعة'), L('Parish office', 'مكتب الرعية')],
  'awaiting-signature': [L('Check the register and approve', 'مراجعة السجل واعتماده'), L('Assigned parish priest', 'كاهن الرعية المعيّن')],
  approved: [L('Sign and issue certificate', 'التوقيع وإصدار الشهادة'), L('Assigned parish priest', 'كاهن الرعية المعيّن')],
  registered: [L('Issue a certificate if requested', 'إصدار شهادة عند الطلب'), L('Assigned parish priest', 'كاهن الرعية المعيّن')],
  issued: [L('Completed', 'مكتمل'), L('Parish office', 'مكتب الرعية')],
  cancelled: [L('Request closed', 'أُغلق الطلب'), L('Parish office', 'مكتب الرعية')],
  rejected: [L('Review rejection', 'مراجعة الرفض'), L('Parish office', 'مكتب الرعية')]
})[s.status] || [L('Review record', 'مراجعة القيد'), L('Parish office', 'مكتب الرعية')];
const STABS = () => [['', 'Registers', 'السجلات'], ['preparation', 'Preparation', 'التحضير'],
               ['anniversaries', 'Anniversaries', 'الذكريات', anniversaryItems().length]];
const prepProgress = s => {
  const requirements = PREP_REQUIREMENTS[s.kind] || [];
  const required = requirements.map((item, index) => item[2] ? index : -1).filter(index => index >= 0);
  const complete = Array.isArray(s.preparation) ? required.filter(index => s.preparation[index]).length : 0;
  return required.length ? `${complete} / ${required.length} ${L('required','مطلوب')}` : L('No required checklist','لا متطلبات إلزامية');
};

export function sacraments(tab = '') {
  if (tab === 'corrections') tab = '';
  const head = pageHead({
    crumbs: [{ label: L('Records', 'السجلات') }, { label: tab === 'requests' ? L('Requests', 'الطلبات') : L('Sacraments', 'الأسرار') }],
    title: tab === 'requests' ? L('Parish requests', 'طلبات الرعية') : tab === 'preparation' ? L('Sacrament preparation', 'التحضير للأسرار') : L('Sacramental registers', 'سجلات الأسرار'),
    sub: tab === 'requests' ? L('See open and completed requests from the parish’s existing workflows.', 'اعرض الطلبات المفتوحة والمكتملة من مسارات الرعية القائمة.')
      : tab === 'preparation' ? L('Prepare accepted requests, record the celebration date, and complete the requirements.', 'حضّر الطلبات المقبولة، وحدّد موعد الاحتفال، وأكمل المتطلبات.')
      : L('Baptism, chrismation, communion, marriage and funeral — kept separately from event scheduling, with controlled corrections and a preserved original entry.',
           'معمودية وميرون ومناولة وإكليل وجنّاز — محفوظة بمعزل عن جدولة الأحداث، بتصحيحات مضبوطة وحفظ القيد الأصلي.'),
    actions: tab === 'requests' ? `<button class="btn btn-secondary" id="newcertreq">${icon('plus', 17)}${L('Certificate request', 'طلب شهادة')}</button><button class="btn btn-primary" id="newsacreq">${icon('plus', 17)}${L('Sacrament request', 'طلب سرّ')}</button>` : tab === 'preparation' ? '' : `<button class="btn btn-secondary" data-act="export">${icon('export', 17)}${L('Export register', 'تصدير السجل')}</button>`
  }) + (tab === 'requests' ? '' : tabBar('sacraments', STABS(), tab)) + (tab === '' ? '<button id="newcorrection" hidden></button>' : '');

  if (tab === 'requests') {
    const items = [
      ...SACRAMENTS.filter(s => s.kind === 'certificate').map(s => ({ category:'certificate', title:`${kindLabel(s.kind)} · ${s.reg}`, who:person(s.person), state:s.status, waitingSource:!sourceFor(s)&&!['cancelled','rejected'].includes(s.status), open:!['issued','rejected','cancelled'].includes(s.status), date:s.date, priority:s.priority || '', owner:nextStep(s)[1], next:nextStep(s)[0], href:`#/certificate/${s.id}`, ref:s.reg })),
      ...SACRAMENTS.filter(s => s.kind !== 'certificate' && (['requested','office-reviewed','awaiting-signature','rejected','cancelled'].includes(s.status) || s.requestApprovedAt)).map(s => ({ category:'sacrament', title:`${kindLabel(s.kind)} · ${s.requestReference||s.reg}`, who:person(s.person), state:s.requestApprovedAt && !['awaiting-signature','rejected','cancelled'].includes(s.status) ? 'approved' : s.status, open:['requested','office-reviewed','awaiting-signature'].includes(s.status), date:s.requestedAt || s.date, priority:'', owner:nextStep(s)[1], next:s.requestApprovedAt && !['awaiting-signature','rejected','cancelled'].includes(s.status) ? s.status==='registered' ? L('Official record available','القيد الرسمي متاح') : L('Continue in Preparation','تابع التحضير') : nextStep(s)[0], href:`#/certificate/${s.id}`, ref:s.requestReference||s.reg })),
      ...CORRECTIONS.map(c => ({ category:'correction', title:`${L('Register correction','تصحيح قيد')} · ${c.reg}`, who:person(c.by), state:c.sacrament?c.status:'legacy', open:c.status === 'awaiting-approval', date:c.at, priority:'', owner:L('Assigned parish priest','كاهن الرعية المعيّن'), next:!c.sacrament ? L('Legacy entry needs a linked correction request','قيد قديم يحتاج طلب تصحيح مرتبط') : c.status === 'awaiting-approval' ? L('Review correction','مراجعة التصحيح') : L('Completed','مكتمل'), href:c.sacrament?`#/certificate/${c.sacrament}`:'#/sacraments', ref:c.reg, correctionId:c.sacrament?c.id:null })),
      ...RESERVATIONS.map(r => ({ category:'facility', title:L(r.title, r.titleAr), who:person(r.by), state:r.status, open:r.status === 'pending', date:r.date || r.at, priority:r.priority || '', owner:r.stage==='priest'?L('Priest','الكاهن'):L('Parish office','مكتب الرعية'), next:r.status === 'pending' ? L('Review reservation','مراجعة الحجز') : L('Completed','مكتمل'), href:'#/reservations', ref:r.ref||r.id })),
      ...SERVICE_REQUESTS.map(r => ({ category:'service', title:`${L(r.kind, r.kindAr)} · ${fmtDate(r.date)}`, who:person(r.by), state:r.status, open:['pending','awaiting-approval'].includes(r.status), date:r.date, priority:r.priority || '', owner:L('Priest or service team','الكاهن أو فريق الخدمة'), next:r.prep === 'documents missing' ? L('Collect missing documents','استكمال المستندات الناقصة') : L('Review service request','مراجعة طلب الخدمة'), href:'#/services/requests', ref:r.id })),
      ...PORTAL_REQUESTS.map(r => ({ category:'portal', title:L(r.what, r.whatAr), who:person(r.by), state:'pending', open:true, date:r.at, priority:r.priority || '', owner:L('Parish office','مكتب الرعية'), next:L('Accept or decline','قبول أو رفض'), href:'#/portal', ref:r.id })),
      ...REQUEST_HISTORY.map(r => ({ category:'portal', title:L(r.title, r.titleAr), who:person(r.by), state:r.status, open:false, date:r.at, priority:'', owner:L('Parish office','مكتب الرعية'), next:L('Completed','مكتمل'), href:'#/portal', ref:r.id })),
      ...REGISTRATIONS.filter(r => r.waiting > 0).map(r => ({ category:'registration', title:`${L(r.event, r.eventAr)} · ${r.waiting} ${L('on waitlist','على لائحة الانتظار')}`, who:null, state:'pending', open:true, date:r.date, priority:'', owner:L('Registration team','فريق التسجيل'), next:L('Review waitlist','مراجعة لائحة الانتظار'), href:'#/registrations', ref:r.id }))
    ];
    const f = S.ui.requestFilter === 'open' ? 'action' : S.ui.requestFilter || 'action', cat = S.ui.requestCategory || '', owner = S.ui.requestOwner || '', date = S.ui.requestDate || '', priority = S.ui.requestPriority || '', state = S.ui.requestStatus || '';
    const needsAction = x => x.open && !x.waitingSource && !(x.category === 'certificate' && x.state === 'draft') && !(x.category === 'correction' && !x.correctionId);
    const shown = items.filter(x => (f === 'all' || f === 'action' && needsAction(x) || f === 'waiting' && x.open && !needsAction(x) || f === 'completed' && !x.open) && (!cat || x.category === cat) && (!state || x.state === state) && (!owner || x.owner === owner) && (!date || String(x.date || '').slice(0,10) >= date) && (!priority || x.priority === priority));
    const categories = [['certificate','Certificates','الشهادات'],['sacrament','Sacramental review','مراجعة الأسرار'],['correction','Corrections','التصحيحات'],['facility','Facilities','المرافق'],['service','Services','الخدمات'],['portal','Portal','البوابة'],['registration','Registrations','التسجيل']].filter(([k]) => items.some(x => x.category === k));
    return head + `<div class="tabbody">
      <div class="stats" style="margin:0 0 16px">${stat(L('Needs action','تحتاج إجراءً'),items.filter(needsAction).length)}${stat(L('Waiting','بانتظار خطوة'),items.filter(x=>x.open&&!needsAction(x)).length)}${stat(L('Completed','مكتملة'),items.filter(x=>!x.open).length)}</div>
      <div class="toolbar" style="margin-bottom:10px;flex-wrap:wrap">
        <span class="seg" role="group">${[['action','Needs action','تحتاج إجراءً'],['waiting','Waiting','بانتظار'],['completed','Completed','مكتملة'],['all','All','الكل']].map(([v,en,ar])=>`<button aria-pressed="${f===v}" data-act="request-filter:${v}">${L(en,ar)}</button>`).join('')}</span>
        <div class="grow" style="min-width:190px;max-width:290px">${C.searchClear(L('Name or reference','الاسم أو المرجع'),'requestsearch','data-find')}</div>
        <select class="select" id="reqcategory" aria-label="${L('Request category','فئة الطلب')}" style="width:auto"><option value="">${L('All categories','كل الفئات')}</option>${categories.map(([v,en,ar])=>`<option value="${v}" ${cat===v?'selected':''}>${L(en,ar)}</option>`).join('')}</select>
        <select class="select" id="reqstatus" aria-label="${L('Request status','حالة الطلب')}" style="width:auto"><option value="">${L('Any status','كل الحالات')}</option>${[...new Set(items.map(x=>x.state))].sort().map(v=>`<option value="${esc(v)}" ${state===v?'selected':''}>${esc(statusLabel(v))}</option>`).join('')}</select>
        <select class="select" id="reqowner" aria-label="${L('Responsible role','الدور المسؤول')}" style="width:auto"><option value="">${L('All responsible roles','كل المسؤولين')}</option>${[...new Set(items.map(x=>x.owner))].map(v=>`<option value="${esc(v)}" ${owner===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
      </div>
      <div class="toolbar" style="margin-bottom:14px;flex-wrap:wrap"><label class="t-caption dim" for="reqdate">${L('Date since','التاريخ منذ')}</label><input class="input" id="reqdate" type="date" value="${esc(date)}" style="width:auto">${items.some(x=>x.priority)?`<select class="select" id="reqpriority" aria-label="${L('Priority','الأولوية')}" style="width:auto"><option value="">${L('Any priority','أي أولوية')}</option>${[...new Set(items.map(x=>x.priority).filter(Boolean))].map(v=>`<option value="${esc(v)}" ${priority===v?'selected':''}>${esc(v)}</option>`).join('')}</select>`:''}<span class="t-caption dim">${shown.length} ${L('shown','معروض')}</span>${cat||state||owner||date||priority?`<button class="btn btn-ghost btn-dense" id="reqclear">${L('Clear filters','مسح المرشّحات')}</button>`:''}</div>
      ${table({cols:[{label:L('Type / reference','النوع / المرجع')},{label:L('Person / subject','الشخص / الموضوع')},{label:L('Submitted / date','التقديم / التاريخ'),cls:'hide-md'},{label:L('Status','الحالة')},{label:L('Next action','الخطوة التالية')},{label:L('Responsible','المسؤول'),cls:'hide-md'},{label:'',cls:'shrink'}],rows:shown.map(x=>({attrs:'data-find-item',cells:[`<b>${esc(x.title)}</b><small class="t-caption dim" style="display:block">${esc(x.ref)}</small>`,x.who?who(x.who):'—',esc(fmtDate(x.date||'')),x.waitingSource?pill(L('Waiting for official entry','بانتظار قيد رسمي'),'warning'):x.state==='draft'&&x.category==='certificate'?pill(L('Request received','استُلم الطلب'),'info'):x.state==='legacy'?pill(L('Needs linked record','يحتاج قيداً مرتبطاً'),'warning'):status(x.state),`<b>${esc(x.next)}</b>`,esc(x.owner),`<span class="row" style="gap:6px">${x.state==='legacy'?`<span class="t-caption dim">${L('Legacy record','قيد قديم')}</span>`:`<a class="btn btn-secondary btn-dense" href="${x.href}">${L('View','عرض')}</a>`}${x.correctionId && x.open && is('priest')?`<button class="btn btn-primary btn-dense" data-act="corr-approve:${x.correctionId}">${L('Approve','موافقة')}</button><button class="btn btn-secondary btn-dense" data-act="corr-reject:${x.correctionId}">${L('Reject','رفض')}</button>`:''}</span>`]})),empty:empty('check',L('No requests match','لا طلبات مطابقة'),L('Clear a filter or create a request.','امسح مرشّحاً أو أنشئ طلباً.'))})}
      <div class="find-empty" hidden>${empty('search',L('No matching request','لا طلب مطابق'),L('Try a parishioner name or reference number.','جرّب اسم الشخص أو رقم المرجع.'))}</div>
    </div>`;
  }

  if (tab === 'preparation') {
    const entries = SACRAMENTS.filter(s => s.kind !== 'certificate' && ['preparing','scheduled','draft'].includes(s.status));
    return head + `<div class="tabbody">
      ${C.inlineAlert('info', L('Preparation follows priest approval', 'يبدأ التحضير بعد موافقة الكاهن'), L('Start with a sacrament request. The priest may accept it directly; then the parish office completes preparation before the celebration.', 'ابدأ بطلب سرّ. يمكن للكاهن قبوله مباشرة، ثم يُكمل مكتب الرعية التحضير قبل الاحتفال.'))}
      <div class="toolbar" style="margin:16px 0"><a class="btn btn-primary" href="#/requests">${icon('plus',16)}${L('New sacrament request','طلب سرّ جديد')}</a></div>
      ${table({cols:[{label:L('Person','الشخص')},{label:L('Sacrament','السرّ')},{label:L('Celebration date','تاريخ الاحتفال')},{label:L('Preparation','التحضير')},{label:L('Status','الحالة')},{label:'',cls:'shrink'}],rows:entries.map(s=>({attrs:'data-find-item',cells:[who(person(s.person)),esc(kindLabel(s.kind)),s.date?esc(fmtDate(s.date)):L('Set date','حدّد التاريخ'),esc(prepProgress(s)),status(s.status),`<span class="row" style="gap:6px"><a class="btn btn-secondary btn-dense" href="#/certificate/${esc(s.id)}">${L('View','عرض')}</a>${s.status==='draft'?'':`<button class="btn btn-secondary btn-dense" data-prep-edit="${esc(s.id)}">${L('Edit','تعديل')}</button><button class="btn btn-ghost btn-dense" data-prep-cancel="${esc(s.id)}">${L('Cancel','إلغاء')}</button>`}</span>`]})),empty:empty('sacr',L('No active preparations','لا تحضيرات جارية'),L('Approved sacrament requests will appear here.','ستظهر هنا طلبات الأسرار المعتمدة.'))})}
      <details style="margin-top:20px"><summary>${L('Preparation requirements by sacrament','متطلبات التحضير بحسب السرّ')}</summary><div class="grid g2" style="margin-top:16px">${Object.entries(PREP_REQUIREMENTS).map(([k,reqs])=>panel(kindLabel(k),reqs.map(([en,ar])=>`<div class="listrow">${icon('check',15)}${esc(L(en,ar))}</div>`).join(''))).join('')}</div></details>
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

  const fk = S.ui.sacKind || '', fy = S.ui.sacYear || '';
  const currentYear = String(new Date().getFullYear());
  const nextScheduled = SACRAMENTS.filter(s => s.status === 'scheduled').map(s => s.date).sort()[0];
  const year = d => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 4);
  const officialRecords = SACRAMENTS.filter(official);
  const years = [...new Set(officialRecords.map(s => year(s.date)))].sort().reverse();
  const rows = officialRecords.filter(s => (!fk || s.kind === fk) && (!fy || year(s.date) === fy)).map(s => ({ attrs: `data-sac="${s.id}" data-find-item`, cells: [
    `<span class="mono" dir="ltr">${s.reg}</span>`,
    `<b style="font:500 14px/20px var(--sans)">${esc(kindLabel(s.kind))}</b>`,
    who(person(s.person)),
    `<span class="dim">${fmtDate(s.date)}</span>`,
    `<span class="dim">${esc((isAr() ? person(s.celebrant)?.ar : person(s.celebrant)?.lat) || '—')}</span>`,
    sacramentStatus(s),
    `<span><b>${nextStep(s)[0]}</b><small class="dim" style="display:block">${nextStep(s)[1]}</small></span>`,
    `<span class="row" style="gap:6px"><a class="btn btn-secondary btn-dense" href="#/certificate/${s.id}">${icon('doc', 15)}${L('View record', 'عرض القيد')}</a><button class="btn btn-secondary btn-dense" data-correct="${esc(s.id)}">${L('Request correction','طلب تصحيح')}</button></span>`
  ]}));

  return head + `<div class="stats" style="margin:20px 0 24px">
      ${stat(L('Official entries', 'القيود الرسمية'), officialRecords.length, L('approved sacramental records', 'القيود السرّية المعتمدة'))}
      ${stat(L('Registered this year', 'مسجَّل هذه السنة'), SACRAMENTS.filter(s => s.date?.startsWith(currentYear) && s.kind !== 'certificate' && ['registered','issued'].includes(s.status)).length, L('from this parish register', 'من سجل هذه الرعية'))}
      ${stat(L('Active preparations', 'تحضيرات جارية'), SACRAMENTS.filter(s => ['preparing','scheduled','draft'].includes(s.status)).length, nextScheduled ? `${L('next', 'التالي')}: ${fmtDate(nextScheduled)}` : L('See Preparation tab', 'راجع صفحة التحضير'))}
      ${stat(L('Corrections this year', 'تصحيحات هذه السنة'), CORRECTIONS.filter(c => String(c.at || '').startsWith(currentYear)).length, L('approved and pending are shown separately', 'تُعرض الموافَق عليها والمنتظرة منفصلة'))}
    </div>
    <div class="toolbar" style="margin-bottom:16px">
      <div class="grow" style="max-width:320px">${C.searchClear(L('Name or register number', 'الاسم أو رقم القيد'), 'sacsearch', 'data-find')}</div>
      <select class="select" style="width:auto" id="sackind" aria-label="${L('Sacrament', 'السرّ')}"><option value="">${L('All sacraments', 'كل الأسرار')}</option>
        ${Object.keys(KIND).map(k => `<option value="${k}" ${fk === k ? 'selected' : ''}>${esc(kindLabel(k))}</option>`).join('')}</select>
      <select class="select" style="width:auto" id="sacyear" aria-label="${L('Year', 'السنة')}"><option value="">${L('All years', 'كل السنوات')}</option>
        ${years.map(y => `<option ${fy === y ? 'selected' : ''}>${y}</option>`).join('')}</select>
      ${fk || fy ? `<button class="btn btn-ghost btn-dense" data-act="sac-clear">${L('Clear filters', 'مسح المرشّحات')}</button>` : ''}
    </div>
    ${table({
      cols: [{ label: L('Register', 'القيد'), cls: 'shrink', sort: true }, { label: L('Sacrament', 'السرّ'), sort: true },
             { label: L('Person', 'الشخص') }, { label: L('Date', 'التاريخ'), cls: 'hide-sm', sort: true },
             { label: L('Celebrant', 'المحتفل'), cls: 'hide-md' }, { label: L('Status', 'الحالة'), cls: 'shrink' }, { label: L('Next step / owner', 'الخطوة والمسؤول') }, { label: '', cls: 'shrink' }],
      rows,
      empty: empty('sacr', L('No entry matches', 'لا قيد يطابق'), L('Try another sacrament or year.', 'جرّب سرّاً أو سنة أخرى.'),
        `<button class="btn btn-secondary btn-dense" data-act="sac-clear">${L('Clear filters', 'مسح المرشّحات')}</button>`)
    })}
    <div class="find-empty" hidden>${empty('search', L('No entry matches', 'لا قيد يطابق'), L('Try the family name, or the register number.', 'جرّب اسم العائلة أو رقم القيد.'))}</div>`;
}

sacraments.mount = host => {
  C.wire(host); wireTables(host);
  const correctable = SACRAMENTS.filter(s => s.kind !== 'certificate' && ['approved','registered','issued'].includes(s.status));
  for (const [selector, key] of [['#reqcategory','requestCategory'],['#reqstatus','requestStatus'],['#reqowner','requestOwner'],['#reqdate','requestDate'],['#reqpriority','requestPriority']])
    host.querySelector(selector)?.addEventListener('change', e => { S.ui[key] = e.target.value; bus.refresh(); });
  host.querySelector('#reqclear')?.addEventListener('click', () => { for (const key of ['requestCategory','requestStatus','requestOwner','requestDate','requestPriority']) S.ui[key] = ''; bus.refresh(); });
  host.querySelector('#sackind')?.addEventListener('change', e => { S.ui.sacKind = e.target.value; bus.refresh(); });
  host.querySelector('#sacyear')?.addEventListener('change', e => { S.ui.sacYear = e.target.value; bus.refresh(); });
  host.querySelector('#newcertreq')?.addEventListener('click', () => {
    const sources = eligibleSources(), pending = pendingSacraments();
    const selected = S.ui.newCertificateSource || '';
    S.ui.newCertificateSource = '';
    const initial = sources.find(s => s.id === selected) || null;
    openDrawer({
      title: L('New certificate request', 'طلب شهادة جديد'),
      sub: L('Choose a person and, if available, an existing entry. A future sacrament may be requested now; the certificate waits for an approved register.', 'اختر الشخص وقيداً قائماً إن توفر. يمكن الطلب قبل موعد السرّ، وتنتظر الشهادة اعتماد السجل.'),
      body: `<div class="formrow"><label class="label" for="req_person">${L('Parishioner', 'صاحب الطلب')}<span class="req">*</span></label><select class="select" id="req_person">${PEOPLE.map(p=>`<option value="${esc(p.id)}" ${initial?.person===p.id?'selected':''}>${esc(isAr()?p.ar:p.lat)}</option>`).join('')}</select></div>
        <div class="formrow"><label class="label" for="req_source">${L('Related sacrament', 'السرّ المرتبط')}</label><select class="select" id="req_source"><option value="">${L('No entry yet — request will wait', 'لا قيد بعد — الطلب سينتظر')}</option>${sources.map(s=>`<option value="official:${esc(s.id)}" ${selected===s.id?'selected':''}>${esc(s.reg)} · ${esc(person(s.person)?.lat||'')} · ${esc(kindLabel(s.kind))} (${L('official','رسمي')})</option>`).join('')}${pending.map(s=>`<option value="pending:${esc(s.id)}">${esc(s.reg)} · ${esc(person(s.person)?.lat||'')} · ${esc(kindLabel(s.kind))} (${L('pending','قيد الانتظار')})</option>`).join('')}</select><span class="help" id="req_source_help">${L('An official entry can be reviewed immediately. A future or pending entry links automatically after registration.', 'يمكن مراجعة القيد الرسمي فوراً. يرتبط القيد المقبل أو المعلّق آلياً بعد اعتماده.')}</span></div>
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
  host.querySelector('#newcorrection')?.addEventListener('click', () => openDrawer({
    title: L('Request a register correction', 'طلب تصحيح قيد'),
    sub: L('Name the existing entry, its field, the correct value, and why it needs amendment. A priest must approve it.', 'حدّد القيد والحقل والقيمة الصحيحة وسبب التعديل. يتطلّب موافقة الكاهن.'),
    body: `<div class="formrow"><label class="label" for="cor_record">${L('Approved register entry', 'القيد المعتمد')}</label><select class="select" id="cor_record">${correctable.map(s => `<option value="${esc(s.id)}" ${S.ui.correctionRecord===s.id?'selected':''}>${esc(s.reg)} · ${esc(person(s.person)?.lat || '')}</option>`).join('')}</select></div>
      <div class="formrow"><label class="label" for="cor_field">${L('Field to correct', 'الحقل المطلوب تصحيحه')}</label><select class="select" id="cor_field">${[['date','Date','التاريخ'],['godparents','Godparents / witnesses','الإشبين / الشهود'],['book','Book','الدفتر'],['page','Page','الصفحة'],['father','Father','الأب'],['mother','Mother','الأم'],['place','Place','المكان'],['externalParish','External parish','الرعية الخارجية'],['externalReference','External document reference','مرجع المستند الخارجي']].map(([v,en,ar]) => `<option value="${v}">${L(en,ar)}</option>`).join('')}</select></div>
      ${C.field({ label: L('Correct value', 'القيمة الصحيحة'), id: 'cor_value', req: true })}
      ${C.textarea({ label: L('Reason and supporting source', 'السبب والمستند الداعم'), id: 'cor_reason', max: 500 })}
      ${!correctable.length ? C.inlineAlert('warning', L('No approved entries', 'لا قيود معتمدة'), L('Approve a register entry before requesting a correction.', 'اعتمد قيداً قبل طلب تصحيحه.')) : ''}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" id="cor_save" ${correctable.length ? '' : 'disabled'}>${L('Submit for approval', 'إرسال للموافقة')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#cor_save').addEventListener('click', async () => {
        if (![need(el, '#cor_value', L('Enter the correct value', 'أدخل القيمة الصحيحة')), need(el, '#cor_reason', L('Explain the correction', 'اشرح التصحيح'))].every(Boolean)) return;
        try { await serverWorkflow('correction-request', el.querySelector('#cor_record').value, { field: el.querySelector('#cor_field').value, value: el.querySelector('#cor_value').value.trim(), reason: el.querySelector('#cor_reason').value.trim() });
          closeOverlays(); bus.refresh(); toast(L('Correction submitted', 'أُرسل التصحيح'), L('The original entry is retained pending priest approval.', 'يبقى القيد الأصلي محفوظاً بانتظار موافقة الكاهن.'), 'success');
        } catch (e) { toast(L('Could not submit correction', 'تعذّر إرسال التصحيح'), e.message, 'danger'); }
      });
    }
  }));
  host.querySelector('#newsacreq')?.addEventListener('click', () => openDrawer({
    title:L('New sacrament request','طلب سرّ جديد'),
    sub:L('Record the family request. The secretary may review it, or the priest may decide directly. Preparation begins only after priest approval.','سجّل طلب العائلة. يمكن للأمينة مراجعته، أو للكاهن اتخاذ القرار مباشرة. يبدأ التحضير فقط بعد موافقته.'),
    body:`<div class="formrow"><label class="label" for="srq_kind">${L('Sacrament','السرّ')}</label><select class="select" id="srq_kind">${Object.entries(KIND).filter(([k])=>k!=='certificate').map(([k,v])=>`<option value="${k}">${esc(L(v[0],v[1]))}</option>`).join('')}</select></div>
      <div class="formrow"><label class="label" for="srq_person">${L('Person receiving the sacrament','الشخص الذي سيقبل السرّ')}</label><select class="select" id="srq_person">${PEOPLE.map(p=>`<option value="${esc(p.id)}">${esc(isAr()?p.ar:p.lat)}</option>`).join('')}</select></div>
      ${C.field({label:L('Preferred date (optional)','التاريخ المفضّل (اختياري)'),id:'srq_date',type:'date'})}
      ${C.textarea({label:L('Family request / notes','طلب العائلة / ملاحظات'),id:'srq_notes',max:500})}`,
    foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-primary" id="srq_save">${L('Submit request','تقديم الطلب')}</button>`,
    onMount(el) { C.wire(el); el.querySelector('#srq_save').addEventListener('click',async()=>{
      const id='sc'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
      const btn=el.querySelector('#srq_save'); btn.disabled=true;
      try { await serverWorkflow('create-sacrament-request',id,{kind:el.querySelector('#srq_kind').value,person:el.querySelector('#srq_person').value,date:el.querySelector('#srq_date').value,notes:el.querySelector('#srq_notes').value.trim()}); closeOverlays(); location.hash='#/requests'; bus.refresh(); toast(L('Request submitted','قُدّم الطلب'),L('It is ready for office review or a direct priest decision.','الطلب جاهز لمراجعة المكتب أو لقرار الكاهن المباشر.'),'success'); }
      catch(e) { btn.disabled=false; toast(L('Could not submit request','تعذّر تقديم الطلب'),e.message,'danger'); }
    }); }
  }));
  if (S.ui.correctionRecord && host.querySelector('#newcorrection')) host.querySelector('#newcorrection').click();
  S.ui.correctionRecord = null;
  host.querySelectorAll('[data-correct]').forEach(btn=>btn.addEventListener('click',()=>{S.ui.correctionRecord=btn.dataset.correct;host.querySelector('#newcorrection')?.click();}));
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

/* ---------------- certificate ---------------- */
const workflowStages = s => s.kind === 'certificate'
  ? [[L('Requested','طُلب'), true], [L('Official entry','القيد الرسمي'), !!sourceFor(s)], [L('Clergy review','مراجعة الإكليروس'), ['approved','issued'].includes(s.status)], [L('Issued','صدر'), s.status==='issued']]
  : [[L('Requested','طُلب'), true], [L('Priest accepted','قبله الكاهن'), !!s.requestApprovedAt || ['preparing','scheduled','draft','awaiting-signature','registered','issued'].includes(s.status) && !s.reg.startsWith('SRQ/')], [L('Prepared','حُضّر'), ['scheduled','draft','awaiting-signature','registered','issued'].includes(s.status)], [L('Celebrated','احتُفل به'), ['draft','awaiting-signature','registered','issued'].includes(s.status)], [L('Registered','سُجّل'), ['registered','issued'].includes(s.status)]];
const workflowStrip = s => `<section class="panel" style="margin:16px 0"><div class="panel-b" style="padding:14px 18px">
  <div class="row" style="justify-content:space-between;gap:12px;flex-wrap:wrap"><div><b>${L('Workflow','مسار العمل')}</b> ${sacramentStatus(s)}<small class="dim" style="display:block;margin-top:4px">${esc(nextStep(s)[0])} · ${esc(nextStep(s)[1])}</small></div>${s.kind==='certificate' && s.purpose?`<span class="t-caption dim">${esc(s.purpose)}</span>`:''}</div>
  <ol style="display:flex;gap:8px;flex-wrap:wrap;list-style:none;margin:12px 0 0;padding:0">${workflowStages(s).map(([label,done],i)=>`<li class="pill ${done?'pill-success':'pill-quiet'}" aria-label="${esc(label)}: ${done?L('complete','مكتمل'):L('pending','معلّق')}">${done?icon('check',13):`${i+1}.`}${esc(label)}</li>`).join('')}</ol>
  </div></section>`;
export function certificate(id, lang = 'bilingual') {
  const s = SACRAMENTS.find(x => x.id === id);
  if (!s) return empty('doc', L('Register entry not found', 'لم يُعثر على القيد'), L('Open a record from this parish’s register.', 'افتح قيداً من سجل هذه الرعية.'));
  const source = s.kind === 'certificate' ? SACRAMENTS.find(x => x.id === s.sourceRecordId) : s;
  const record = source || s;
  const p = person(record.person), cel = person(record.celebrant);
  const issued = s.status === 'issued';
  const showAr = lang !== 'english', showEn = lang !== 'arabic';
  const docText = (en, ar) => lang === 'arabic' ? ar : lang === 'english' ? en : `${ar} / ${en}`;

  return `${pageHead({
      crumbs: [{ label: L('Records', 'السجلات') }, { label: s.kind==='certificate'||['requested','office-reviewed','rejected'].includes(s.status) ? L('Requests','الطلبات') : L('Sacraments','الأسرار'), href: s.kind==='certificate'||['requested','office-reviewed','rejected'].includes(s.status) ? '#/requests' : '#/sacraments' }, { label: s.reg }],
      title: kindLabel(s.kind),
      sub: `${esc(isAr() ? p.ar : p.lat)} · <span class="mono">${esc(s.reg)}</span> · ${fmtDate(s.date)}`,
      actions: `${s.kind !== 'certificate' && ['requested','office-reviewed'].includes(s.status) && is('priest')
        ? `<button class="btn btn-primary" id="acceptrequest">${icon('check',17)}${L('Accept request','قبول الطلب')}</button><button class="btn btn-secondary" id="declinerequest">${L('Decline request','رفض الطلب')}</button>`
        : s.kind !== 'certificate' && s.status==='requested' && is('secretary')
        ? `<button class="btn btn-primary" id="officereview">${L('Complete office review','إكمال مراجعة المكتب')}</button>`
        : s.kind !== 'certificate' && s.status==='preparing'
        ? `<a class="btn btn-primary" href="#/sacraments/preparation">${L('Open preparation','افتح التحضير')}</a>`
        : s.kind === 'certificate' && !source && s.requestedSacramentId && ['draft','awaiting-signature'].includes(s.status)
        ? `<a class="btn btn-primary" href="#/certificate/${esc(s.requestedSacramentId)}">${icon('sacr',17)}${L('Open planned sacrament','افتح السرّ المخطّط له')}</a>`
        : s.kind === 'certificate' && !source && ['draft','awaiting-signature'].includes(s.status) && eligibleSources(s.person).length && is('priest','secretary')
        ? `<button class="btn btn-primary" id="linksource">${icon('doc', 17)}${L('Link source register', 'ربط القيد المرجعي')}</button>`
        : s.kind === 'certificate' && !source && ['draft','awaiting-signature'].includes(s.status) && is('priest','secretary')
        ? `<a class="btn btn-primary" href="#/sacraments">${icon('sacr',17)}${L('Open sacramental registers','افتح سجلات الأسرار')}</a>`
        : is('priest') && s.status === 'awaiting-signature' && (s.kind==='certificate' ? !!source : s.date<=today())
        ? `<button class="btn btn-primary" id="approve">${icon('check', 17)}${s.kind === 'certificate' ? L('Approve certificate request', 'اعتماد طلب الشهادة') : L('Approve register entry', 'اعتماد القيد')}</button>`
        : is('priest') && s.kind === 'certificate' && s.status === 'approved'
          ? `<button class="btn btn-primary" id="sign">${icon('check', 17)}${L('Sign and issue', 'التوقيع والإصدار')}</button>`
          : s.kind !== 'certificate' && s.status === 'registered'
            ? `<button class="btn btn-secondary" id="startcertreq">${icon('doc', 17)}${L('Request a certificate', 'طلب شهادة')}</button>`
          : is('secretary','priest') && ['draft','scheduled'].includes(s.status) && (s.kind==='certificate' ? !!source : s.date<=today())
            ? `<button class="btn btn-primary" id="submit">${icon('send', 17)}${s.status==='scheduled'?L('Record celebration and submit','سجّل الاحتفال وأرسل'):L('Submit for clergy review','إرسال لمراجعة الإكليروس')}</button>`
            : ''}
        ${s.kind!=='certificate' && ['draft','scheduled'].includes(s.status) && is('secretary','priest')?`<button class="btn btn-secondary" id="editentry">${icon('edit',17)}${L('Edit details','تعديل التفاصيل')}</button>`:''}
        ${s.kind!=='certificate' && ['registered','issued'].includes(s.status) && is('secretary','priest')?`<button class="btn btn-secondary" id="detailcorrection">${L('Request correction','طلب تصحيح')}</button>`:''}
        ${s.status==='awaiting-signature' && is('priest')?`<button class="btn btn-secondary" id="reject">${L('Reject','رفض')}</button>`:''}
        ${s.kind==='certificate' && ['draft','awaiting-signature'].includes(s.status) && is('secretary','priest')?`<button class="btn btn-ghost" id="cancelrequest">${L('Cancel request','إلغاء الطلب')}</button>`:''}
        ${issued && s.kind==='certificate' ? `<button class="btn btn-secondary" data-act="print">${icon('print', 17)}${L('Print', 'طباعة')}</button>
        <button class="btn btn-secondary" data-act="pdf">${icon('export', 17)}${L('Download PDF', 'تنزيل PDF')}</button>
        <button class="btn btn-secondary" data-act="share-cert">${icon('msg', 17)}${L('Send on WhatsApp', 'إرسال على واتساب')}</button>` : ''}`
    })}
    ${workflowStrip(s)}
    ${s.kind !== 'certificate' && s.status==='scheduled' && s.date>today() ? C.inlineAlert('info', L('Scheduled, not yet celebrated','مجدول ولم يُحتفل به بعد'), L(`Return on or after ${fmtDate(s.date)} to record the celebration and submit for register review.`, `عُد في ${fmtDate(s.date)} أو بعده لتسجيل الاحتفال وإرسال القيد للمراجعة.`)) : ''}
    ${s.kind === 'certificate' && !source && !['cancelled','rejected'].includes(s.status) ? C.inlineAlert('warning', L('Waiting for an official register entry', 'بانتظار قيد رسمي'), s.requestedSacramentId ? L('The linked sacrament will become the source after it is celebrated and approved. Open that sacrament to see its next action.', 'سيصبح السرّ المرتبط مرجع الشهادة بعد الاحتفال به واعتماده. افتح السرّ لمعرفة الخطوة التالية.') : L('Link an approved register entry for this person. If the sacrament has not happened yet, complete its register workflow first.', 'اربط قيداً معتمداً لهذا الشخص. وإن لم يقع السرّ بعد، أكمل مسار سجله أولاً.')) : ''}
    <div class="splitview">
      ${source && (s.kind === 'certificate' || official(s)) ? `
      <div class="a4frame">
        <div class="a4bar">
          <b class="t-ui">${s.kind==='certificate'?L('Certificate preview','معاينة الشهادة'):L('Record preview','معاينة القيد')}</b>
          <span class="bgroup" role="group">${[['arabic', L('Arabic', 'عربي')], ['english', L('English', 'إنكليزي')], ['bilingual', L('Bilingual', 'ثنائي اللغة')]]
            .map(([k, lab]) => `<button aria-pressed="${lang === k}" data-go="certificate/${s.id}/${k}">${esc(lab)}</button>`).join('')}</span>
          <span class="zoom">A4 210×297 · 100%</span>
        </div>
        ${!issued || s.kind!=='certificate' ? `<p class="t-caption" style="margin:0 0 10px;color:var(--danger-ink)">${L('Preview only — not approved, signed, or issued.','معاينة فقط — غير معتمدة أو موقّعة أو صادرة.')}</p>` : ''}
        <div style="display:flex;justify-content:center">
        <div class="a4">
          ${!issued || s.kind!=='certificate'?`<div style="position:absolute;inset:30% 8% auto;transform:rotate(-24deg);font:700 28px/1.2 var(--sans);letter-spacing:.14em;color:var(--danger-ink);opacity:.13;pointer-events:none;text-transform:uppercase">${L('Unissued preview','معاينة غير صادرة')}</div>`:''}
          <div class="seal-lg">✚</div>
          ${showAr ? `<div class="ttl-ar">${esc(PARISH.eparchyAr)}</div>
            <div class="ttl-ar" style="font-size:16px">${esc(PARISH.nameAr)} — ${esc(PARISH.townAr)}</div>` : ''}
          ${showEn ? `<div class="ttl" style="margin-top:6px">${esc(PARISH.eparchy)}</div>
            <div class="t-caption dim">${esc(PARISH.name)} — ${esc(PARISH.town)}</div>` : ''}
          <div style="margin-top:16px">
            ${showAr ? `<div style="font:600 19px/28px var(--arabic)">${esc(KIND[record.kind]?.[1] || '')}</div>` : ''}
            ${showEn ? `<div style="font:600 13px/20px var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--text-2)">
              ${esc(KIND[record.kind]?.[0] || '')}</div>` : ''}
          </div>
          ${showAr ? `<div class="nm">${esc(p.ar)}</div>` : ''}
          ${showEn ? `<div class="nm-lat">${esc(p.lat)}</div>` : ''}
          <div class="lines">
            ${record.date>today() ? docText('Scheduled for','مجدول في') : docText('Celebrated on', 'احتُفل به في')} <b>${fmtDate(record.date)}</b><br>
            ${docText('Celebrant', 'المحتفل')} <b>${esc((showAr&&!showEn?cel?.ar:cel?.lat) || '—')}</b>
            ${record.godparents ? `<br>${esc(record.godparents)}` : ''}
            ${source ? `<br>${docText('Source register', 'القيد المرجعي')}: <b>${esc(source.reg)}</b>` : ''}
          </div>
          <div class="regbox">
            <div><div class="lbl">${docText('Book No.', 'دفتر رقم')}</div><div class="val">${esc(record.book || '—')}</div></div>
            <div><div class="lbl">${docText('Page No.', 'صفحة رقم')}</div><div class="val">${esc(record.page || '—')}</div></div>
          </div>
          <div class="sig">
            <div>${docText('Parish priest', 'كاهن الرعية')}</div>
            <div style="border:0;display:grid;place-items:center"><span class="sealbox">${docText('Seal & signature', 'ختم وتوقيع')}</span></div>
          </div>
        </div></div>
      </div>` : panel(s.kind === 'certificate' ? L('Certificate preview unavailable','معاينة الشهادة غير متاحة') : L('Request and preparation','الطلب والتحضير'), `<p class="t-caption dim">${s.kind === 'certificate' ? L('The official document will be available after the source register entry is approved and linked.','ستتاح الوثيقة الرسمية بعد اعتماد القيد المرجعي وربطه.') : L('The official register preview appears after celebration and priest approval.','تظهر معاينة القيد الرسمي بعد الاحتفال وموافقة الكاهن.')}</p>${s.requestNotes?`<p style="margin-top:10px">${esc(s.requestNotes)}</p>`:''}`, {tight:true})}
      <div class="sidecol">
        ${panel(L('Next action', 'الخطوة التالية'), `<b>${esc(nextStep(s)[0])}</b><p class="t-caption dim" style="margin:5px 0 0">${L('Responsible:', 'المسؤول:')} ${esc(nextStep(s)[1])}</p>${s.kind==='certificate' && s.requestedSacramentId && !source?`<a class="btn btn-secondary btn-dense" style="margin-top:10px" href="#/certificate/${esc(s.requestedSacramentId)}">${L('Open planned sacrament','افتح السرّ المخطّط له')}</a>`:''}`, {tight:true})}
        ${panel(L('Record details', 'تفاصيل القيد'), `<dl class="dl"><dt>${L('Person','الشخص')}</dt><dd>${esc(isAr()?p.ar:p.lat)}</dd><dt>${L('Date','التاريخ')}</dt><dd>${fmtDate(record.date)}</dd><dt>${L('Celebrant','المحتفل')}</dt><dd>${esc(cel?.lat||'—')}</dd>${s.purpose?`<dt>${L('Purpose','الغاية')}</dt><dd>${esc(s.purpose)}</dd>`:''}<dt>${L('Book / page','الدفتر / الصفحة')}</dt><dd>${esc(record.book||'—')} / ${esc(record.page||'—')}</dd></dl>`, {tight:true})}
        ${panel(official(s)||s.kind==='certificate'?L('Register provenance', 'مرجع القيد'):L('Request reference','مرجع الطلب'), `<p class="t-caption">${L('Reference','المرجع')}: <b>${esc(s.requestReference||s.reg)}</b></p>${record.externalParish?`<p class="t-caption">${L('External parish','الرعية الخارجية')}: ${esc(record.externalParish)}</p>`:''}${record.externalReference?`<p class="t-caption">${L('External document reference','مرجع المستند الخارجي')}: ${esc(record.externalReference)}</p>`:''}`, {tight:true})}
        ${s.kind !== 'certificate' && CORRECTIONS.some(c=>c.sacrament===s.id)?panel(L('Corrections','التصحيحات'),CORRECTIONS.filter(c=>c.sacrament===s.id).map(c=>`<div class="listrow"><span class="grow"><b>${esc(c.field)}</b><small>${esc(c.from||'—')} → ${esc(c.to)}</small></span>${status(c.status)}</div>`).join(''),{tight:true}):''}
        ${panel(L('Approval and activity', 'الاعتماد والنشاط'), `<p class="t-caption">${L('Status','الحالة')}: ${sacramentStatus(s)}</p>${s.requestApprovedBy?`<p class="t-caption">${L('Request accepted by','قبل الطلب')}: ${esc(s.requestApprovedBy)} · ${esc(s.requestApprovedAt||'')}</p>`:''}${s.approvedBy?`<p class="t-caption">${L('Approved by','اعتمده')}: ${esc(s.approvedBy)} · ${esc(s.approvedAt||'')}</p>`:''}${s.issuedBy?`<p class="t-caption">${L('Issued by','أصدره')}: ${esc(s.issuedBy)} · ${esc(s.issuedAt||'')}</p>`:''}<details><summary>${L('Full activity history','سجل النشاط الكامل')} (${(s.history||[]).length})</summary>${(s.history||[]).length?`<div class="timeline" style="margin-top:12px">${s.history.map(h=>`<div class="tl-item"><div class="when">${esc(h.at||'')}</div><div class="what">${esc(h.action)} · ${esc(h.by||'')}${h.source?` · ${esc(h.source)}`:''}${h.reason?` · ${esc(h.reason)}`:''}</div></div>`).join('')}</div>`:`<p class="t-caption dim">${L('No activity recorded yet.','لا نشاط مسجلاً بعد.')}</p>`}</details>`, {tight:true})}
      </div></div>`;
}

certificate.mount = (host, id) => {
  C.wire(host);
  host.querySelector('#detailcorrection')?.addEventListener('click',()=>{S.ui.correctionRecord=id;location.hash='#/sacraments';});
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
      sub:L('Changes to a planned or unsubmitted record are tracked. Once approved, use a correction request.','تُسجّل تعديلات القيد المخطّط أو غير المرسَل. بعد الاعتماد، استخدم طلب تصحيح.'),
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
      title: L('Link source register', 'ربط القيد المرجعي'),
      sub: L('Select an official entry for the same person. This link is recorded in the approval history.', 'اختر قيداً رسمياً للشخص نفسه. يُسجّل الربط في سجل الاعتماد.'),
      body: sources.length ? `<div class="formrow"><label class="label" for="link_source">${L('Source entry', 'القيد المرجعي')}</label><select class="select" id="link_source">${sources.map(s => `<option value="${esc(s.id)}">${esc(s.reg)} · ${esc(kindLabel(s.kind))}</option>`).join('')}</select></div>`
        : C.inlineAlert('warning', L('No eligible register entry', 'لا قيد مؤهّل'), L('Register and approve the sacrament before linking this request.', 'سجّل السرّ واعتمده قبل ربط هذا الطلب.')),
      foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button><button class="btn btn-primary" id="link_save" ${sources.length ? '' : 'disabled'}>${L('Link entry', 'ربط القيد')}</button>`,
      onMount(el) {
        C.wire(el);
        el.querySelector('#link_save')?.addEventListener('click', async () => {
          try { await serverWorkflow('link-source', id, { sourceRecordId: el.querySelector('#link_source').value }); closeOverlays(); bus.refresh(); toast(L('Source linked', 'رُبط المصدر'), L('The request can now be reviewed.', 'يمكن مراجعة الطلب الآن.'), 'success'); }
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
      <button class="btn btn-primary" id="confirm" disabled>${action === 'approve' ? L('Approve entry', 'اعتماد القيد') : L('Sign and issue', 'التوقيع والإصدار')}</button>`,
    onMount(el) {
      const ack = el.querySelector('#ack'), ok = el.querySelector('#confirm');
      ack.addEventListener('change', () => { ok.disabled = !ack.checked; });
      ok.addEventListener('click', async () => {
        try { await serverWorkflow(action, id, { verified: true }); closeOverlays(); bus.refresh(); toast(L('Workflow updated', 'حُدّث المسار'), L('The approval history was saved.', 'حُفظ سجل الاعتماد.'), 'success'); }
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

