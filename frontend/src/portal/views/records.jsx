import { Select } from "../ui/components.jsx";
import { paint, markup } from "../ui/html.js";
/* Module 7 — sacrament requests, preparation, register entries and certificates. */
import { t, isAr, fmtDate, fmtDateIn, num } from "../../lib/i18n.js";
import { is, bus, S, save } from "../model/store.js";
import { session, api } from "../model/api.js";
import { RequestDocuments } from "../flows/request-documents.jsx";
import { Icon, PageHead, Panel, Who, Status, statusLabel, Pill, Table, Empty, openDrawer, openModal, openMenu, closeOverlays, toast, Stat, TabBar } from "../ui/ui.jsx";
import * as C from "../ui/components.jsx";
import * as CR from "../flows/crud.jsx";
import { download } from "../actions.jsx";
import { need } from "../flows/flows.jsx";
import { workflow as serverWorkflow, hydrate } from "../model/persist.js";
import { sign } from "../model/signing.js";
import { Drawing } from "../ui/signature.jsx";
import { passkeyMessage } from "../model/passkeys.js";
import { printSheet, saveBlob, svgToPng, fileName } from "../flows/print.js";
import { SACRAMENTS, anniversaryItems, PARISH, PREP_REQUIREMENTS, PEOPLE, person, RESERVATIONS, SERVICE_REQUESTS, PORTAL_REQUESTS, REQUEST_HISTORY, REGISTRATIONS, venue } from "../model/data.js";
import { onlineItems, openOnlineRequest, onlineMark, sharedNote } from "./online-requests.jsx";
import { certificateName, languageName, occasionText } from "../model/sacrament-requests.js";
const L = (en, ar) => t(en, ar);
const KIND = {
  baptism: ['Baptism', 'معمودية'],
  communion: ['First Communion', 'المناولة الأولى'],
  confirmation: ['Confirmation (Chrismation)', 'الميرون'],
  marriage: ['Marriage', 'إكليل'],
  funeral: ['Funeral', 'جنّاز'],
  certificate: ['Certificate request', 'طلب شهادة']
};
const kindLabel = k => L(...(KIND[k] || [k, k]));
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const official = s => s && s.kind !== 'certificate' && ['registered', 'issued'].includes(s.status);
const eligibleSources = personId => SACRAMENTS.filter(s => official(s) && (!personId || s.person === personId));
const pendingSacraments = personId => SACRAMENTS.filter(s => s.kind !== 'certificate' && ['requested', 'office-reviewed', 'preparing', 'draft', 'scheduled', 'awaiting-signature'].includes(s.status) && (!personId || s.person === personId));
const sourceFor = s => SACRAMENTS.find(x => x.id === s.sourceRecordId);
const sacramentStatus = s => s.kind === 'certificate' && !sourceFor(s) && !['cancelled', 'rejected'].includes(s.status) ? <Pill label={L('Waiting for official entry', 'بانتظار قيد رسمي')} tone='warning' /> : s.status === 'draft' ? <Pill label={s.kind === 'certificate' ? L('Request received', 'استُلم الطلب') : L('Celebrated · not submitted', 'تمّ الاحتفال · لم يُرسل')} tone='info' /> : <Status k={s.status} />;
/* What happens next and who does it, in the words the office uses. */
const OFFICE = () => L('Parish office', 'مكتب الرعية'),
  PRIEST = () => L('Priest', 'الكاهن');
const nameIn = p => p ? L(p.lat || '', p.ar || p.lat || '') : '';
const nextStep = s => s.status === 'cancelled' ? [L('Nothing more to do — the request was cancelled', 'لا شيء آخر — أُلغي الطلب'), ''] : s.status === 'rejected' ? [L('Nothing more to do — the request was declined', 'لا شيء آخر — رُفض الطلب'), ''] : s.kind === 'certificate' && !s.sourceRecordId ? [s.requestedSacramentId ? L('Wait until the sacrament is celebrated and approved', 'انتظار الاحتفال بالسرّ واعتماده') : eligibleSources(s.person).length ? L('Link the approved register entry', 'ربط القيد المعتمد') : L('Record the sacrament first — there is no approved entry yet', 'سجّل السرّ أولاً — لا قيد معتمد بعد'), OFFICE()] : {
  requested: [L('Accept or decline the request', 'قبول الطلب أو رفضه'), L('Priest or parish office', 'الكاهن أو مكتب الرعية')],
  'office-reviewed': [L('Accept or decline the request', 'قبول الطلب أو رفضه'), PRIEST()],
  preparing: [L('Finish the preparation checklist and set the date', 'إكمال لائحة التحضير وتحديد الموعد'), OFFICE()],
  draft: [s.kind === 'certificate' ? L('Send the request to the priest', 'إرسال الطلب إلى الكاهن') : L('Send the celebrated sacrament to the priest for approval', 'إرسال السرّ المحتفل به إلى الكاهن للاعتماد'), OFFICE()],
  scheduled: [s.date > today() ? L(`Wait for the celebration on ${celebrationText(s)}`, `انتظار الاحتفال في ${celebrationText(s)}`) : L('Confirm it was celebrated and send it for approval', 'تأكيد الاحتفال وإرساله للاعتماد'), OFFICE()],
  'awaiting-signature': [s.kind === 'certificate' ? L('Check the request and approve it', 'مراجعة الطلب واعتماده') : L('Check against the register book and approve', 'المطابقة مع دفتر السجل والاعتماد'), PRIEST()],
  approved: [L('Sign and issue the certificate', 'توقيع الشهادة وإصدارها'), PRIEST()],
  registered: [L('Done — request a certificate whenever one is needed', 'منجز — اطلب شهادة متى احتجت إليها'), ''],
  issued: [L('Done — the certificate was issued', 'منجز — صدرت الشهادة'), '']
}[s.status] || [L('Review the record', 'مراجعة القيد'), OFFICE()];
/* Official entries are reached from the person's record and from Requests; there is no separate register page. */
const STABS = () => [['', 'Preparation', 'التحضير'], ['anniversaries', 'Anniversaries', 'الذكريات', anniversaryItems().length]];
const prepProgress = s => {
  const requirements = PREP_REQUIREMENTS[s.kind] || [];
  const required = requirements.map((item, index) => item[2] ? index : -1).filter(index => index >= 0);
  const complete = Array.isArray(s.preparation) ? required.filter(index => s.preparation[index]).length : 0;
  return required.length ? `${complete} / ${required.length} ${L('required', 'مطلوب')}` : L('No required checklist', 'لا متطلبات إلزامية');
};

/* The approved register as a spreadsheet: one row per official entry, both names, Western digits. */
function exportRegister() {
  const cell = v => /[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? '');
  const head = ['Register entry', 'Sacrament', 'Name', 'Arabic name', 'Date', 'Celebrant', 'Book', 'Page', 'Godparents / witnesses', 'Status'];
  const rows = SACRAMENTS.filter(official).map(s => {
    const p = person(s.person),
      c = person(s.celebrant);
    return [s.reg, KIND[s.kind]?.[0] || s.kind, p?.lat, p?.ar, String(s.date || '').slice(0, 10), c?.lat || '', s.book, s.page, s.godparents, s.status];
  });
  download(`register-${fileName(PARISH.name)}-${today()}.csv`, [head, ...rows].map(r => r.map(cell).join(',')).join('\n'));
  toast(L('Register exported', 'صُدّر السجل'), L(`${rows.length} approved entries`, `${rows.length} قيود معتمدة`), 'success');
}
/* below: anything drawn under the page heading (the Requests page's other queues). */
export function sacraments(tab = '', below = null) {
  if (['preparation', 'corrections', 'registers'].includes(tab)) tab = '';
  const head = <><PageHead crumbs={[{
      label: L('Records', 'السجلات')
    }, {
      label: tab === 'requests' ? L('Requests', 'الطلبات') : L('Sacraments', 'الأسرار')
    }]} title={tab === 'requests' ? L('Parish requests', 'طلبات الرعية') : tab === 'anniversaries' ? L('Sacrament anniversaries', 'ذكريات الأسرار') : L('Sacrament preparation', 'التحضير للأسرار')} sub={tab === 'requests' ? L('Everything waiting on the parish office or the priest — certificates, sacraments, room bookings, services and portal requests — and what is already done.', 'كل ما ينتظر مكتب الرعية أو الكاهن — الشهادات والأسرار وحجوزات القاعات والخدم وطلبات البوابة — وما أُنجز.') : tab === 'anniversaries' ? L('Baptism, chrismation, first Communion and marriage anniversaries, taken from approved entries.', 'ذكريات المعمودية والميرون والمناولة الأولى والإكليل، مأخوذة من القيود المعتمدة.') : L('Accepted sacrament requests: set the celebration date and work through what each sacrament needs beforehand.', 'طلبات الأسرار المقبولة: حدّد موعد الاحتفال وأنجز ما يحتاج إليه كل سرّ مسبقاً.')} actions={tab === 'requests' ? <><button className="btn btn-secondary" id="newcertreq"><Icon name='plus' size={17} />{L('Certificate request', 'طلب شهادة')}</button><button className="btn btn-primary" id="newsacreq"><Icon name='plus' size={17} />{L('Sacrament request', 'طلب سرّ')}</button></> : <button className="btn btn-secondary" id="sacexport"><Icon name='export' size={17} />{L('Export register (CSV)', 'تصدير السجل (CSV)')}</button>} />{tab === 'requests' ? '' : <TabBar base='sacraments' items={STABS()} active={tab} />}{below}</>;
  if (tab === 'requests') {
    const items = [...onlineItems(), ...SACRAMENTS.filter(s => s.kind === 'certificate').map(s => ({
      category: 'certificate',
      mark: onlineMark(s),
      title: `${kindLabel(s.kind)} · ${s.reg}`,
      who: person(s.person),
      state: s.status,
      waitingSource: !sourceFor(s) && !['cancelled', 'rejected'].includes(s.status),
      open: !['issued', 'rejected', 'cancelled'].includes(s.status),
      date: s.date,
      priority: s.priority || '',
      owner: nextStep(s)[1],
      next: nextStep(s)[0],
      href: `#/certificate/${s.id}`,
      ref: s.reg
    })), ...SACRAMENTS.filter(s => s.kind !== 'certificate' && (['requested', 'office-reviewed', 'awaiting-signature', 'rejected', 'cancelled'].includes(s.status) || s.requestApprovedAt)).map(s => ({
      category: 'sacrament',
      mark: onlineMark(s),
      title: `${kindLabel(s.kind)} · ${s.requestReference || s.reg}`,
      who: person(s.person),
      state: s.requestApprovedAt && !['awaiting-signature', 'rejected', 'cancelled'].includes(s.status) ? 'approved' : s.status,
      open: ['requested', 'office-reviewed', 'awaiting-signature'].includes(s.status),
      date: s.requestedAt || s.date,
      priority: '',
      owner: nextStep(s)[1],
      next: s.requestApprovedAt && !['awaiting-signature', 'rejected', 'cancelled'].includes(s.status) ? s.status === 'registered' ? L('Official record available', 'القيد الرسمي متاح') : L('Continue in Preparation', 'تابع التحضير') : nextStep(s)[0],
      href: `#/certificate/${s.id}`,
      ref: s.requestReference || s.reg
    })), ...RESERVATIONS.map(r => ({
      category: 'facility',
      mark: onlineMark(r),
      title: r.memberRequestId ? `${occasionText(r.title)} · ${L(venue(r.venue)?.name || '', venue(r.venue)?.ar || '')}` : L(r.title, r.titleAr),
      who: person(r.by),
      state: r.status,
      open: r.status === 'pending',
      date: r.date || r.at,
      priority: r.priority || '',
      owner: r.stage === 'priest' ? L('Priest', 'الكاهن') : L('Parish office', 'مكتب الرعية'),
      next: r.status === 'pending' ? r.stage === 'priest' ? L('Confirm or refuse the booking', 'تأكيد الحجز أو رفضه') : L('Review reservation', 'مراجعة الحجز') : L('Completed', 'مكتمل'),
      href: `#/reservations/${r.id}`,
      ref: r.ref || r.id
    })), ...SERVICE_REQUESTS.map(r => ({
      category: 'service',
      title: `${L(r.kind, r.kindAr)} · ${fmtDate(r.date)}`,
      who: person(r.by),
      state: r.status,
      open: !['celebrated', 'rejected'].includes(r.status),
      date: r.date,
      priority: r.priority || '',
      owner: L('Priest or service team', 'الكاهن أو فريق الخدمة'),
      next: r.prep === 'documents missing' ? L('Collect missing documents', 'استكمال المستندات الناقصة') : L('Review service request', 'مراجعة طلب الخدمة'),
      href: '#/services/requests/' + encodeURIComponent(r.id),
      ref: r.ref || r.id
    })), ...PORTAL_REQUESTS.map(r => ({
      category: 'portal',
      portalId: r.id,
      title: L(r.what, r.whatAr),
      who: person(r.by),
      state: 'pending',
      open: true,
      date: r.at,
      priority: r.priority || '',
      owner: L('Parish office', 'مكتب الرعية'),
      next: L('Accept or decline', 'قبول أو رفض'),
      href: '#/requests',
      ref: r.ref || ''
    })), ...REQUEST_HISTORY.map(r => ({
      category: 'portal',
      historyId: r.id,
      title: L(r.title, r.titleAr),
      who: person(r.by),
      state: r.status,
      open: false,
      date: r.at,
      priority: '',
      owner: L('Parish office', 'مكتب الرعية'),
      next: L('Completed', 'مكتمل'),
      href: '#/requests',
      ref: r.ref || ''
    })), ...REGISTRATIONS.filter(r => r.waiting > 0).map(r => ({
      category: 'registration',
      title: `${L(r.event, r.eventAr)} · ${r.waiting} ${L('on waitlist', 'على لائحة الانتظار')}`,
      who: null,
      state: 'pending',
      open: true,
      date: r.date,
      priority: '',
      owner: L('Registration team', 'فريق التسجيل'),
      next: L('Review waitlist', 'مراجعة لائحة الانتظار'),
      href: '#/registrations',
      ref: ''
    }))];
    const f = S.ui.requestFilter === 'open' ? 'action' : S.ui.requestFilter || 'action',
      cat = S.ui.requestCategory || '',
      owner = S.ui.requestOwner || '',
      date = S.ui.requestDate || '',
      priority = S.ui.requestPriority || '',
      state = S.ui.requestStatus || '';
    const needsAction = x => x.open && !x.waitingSource && !(x.category === 'certificate' && x.state === 'draft');
    const shown = items.filter(x => (f === 'all' || f === 'action' && needsAction(x) || f === 'waiting' && x.open && !needsAction(x) || f === 'completed' && !x.open) && (!cat || x.category === cat) && (!state || x.state === state) && (!owner || x.owner === owner) && (!date || String(x.date || '').slice(0, 10) >= date) && (!priority || x.priority === priority));
    const categories = [['online', 'Online requests', 'الطلبات الإلكترونية'], ['certificate', 'Certificates', 'الشهادات'], ['sacrament', 'Sacrament requests', 'طلبات الأسرار'], ['facility', 'Facilities', 'المرافق'], ['service', 'Services', 'الخدمات'], ['portal', 'Portal', 'البوابة'], ['registration', 'Registrations', 'التسجيل']].filter(([k]) => items.some(x => x.category === k));
    return <>{head}<div className="tabbody"><div className="stats" style={{
          margin: "0 0 16px"
        }}><Stat k={L('Needs action', 'تحتاج إجراءً')} v={items.filter(needsAction).length} d={L('a decision or a step from the office or the priest', 'قرار أو خطوة من المكتب أو الكاهن')} /><Stat k={L('Waiting', 'بانتظار')} v={items.filter(x => x.open && !needsAction(x)).length} d={L('on a date, a document or another record', 'على موعد أو مستند أو قيد آخر')} /><Stat k={L('Completed', 'مكتملة')} v={items.filter(x => !x.open).length} d={L('approved, issued, declined or cancelled', 'معتمدة أو صادرة أو مرفوضة أو ملغاة')} /></div>{" "}<div className="toolbar" style={{
          marginBottom: "10px",
          flexWrap: "wrap"
        }}><span className="seg" role="group">{[['action', 'Needs action', 'تحتاج إجراءً'], ['waiting', 'Waiting', 'بانتظار'], ['completed', 'Completed', 'مكتملة'], ['all', 'All', 'الكل']].map(([v, en, ar]) => <button aria-pressed={f === v} data-act={`request-filter:${v}`}>{L(en, ar)}</button>)}</span>{" "}<div className="grow" style={{
            minWidth: "190px",
            maxWidth: "290px"
          }}><C.SearchClear ph={L('Name or reference', 'الاسم أو المرجع')} id='requestsearch' data-find="" /></div>{" "}<Select id="reqcategory" aria-label={L('Request category', 'فئة الطلب')} style={{
            width: "auto"
          }}><option value="">{L('All categories', 'كل الفئات')}</option>{categories.map(([v, en, ar]) => <option value={v} selected={!!(cat === v)}>{L(en, ar)}</option>)}</Select>{" "}<Select id="reqstatus" aria-label={L('Request status', 'حالة الطلب')} style={{
            width: "auto"
          }}><option value="">{L('Any status', 'كل الحالات')}</option>{[...new Set(items.map(x => x.state))].sort().map(v => <option value={v} selected={!!(state === v)}>{statusLabel(v)}</option>)}</Select>{" "}<Select id="reqowner" aria-label={L('Responsible role', 'الدور المسؤول')} style={{
            width: "auto"
          }}><option value="">{L('All responsible roles', 'كل المسؤولين')}</option>{[...new Set(items.map(x => x.owner).filter(Boolean))].map(v => <option value={v} selected={!!(owner === v)}>{v}</option>)}</Select></div>{" "}<div className="toolbar" style={{
          marginBottom: "14px",
          flexWrap: "wrap"
        }}><label className="t-caption dim" htmlFor="reqdate">{L('Date since', 'التاريخ منذ')}</label><input className="input" id="reqdate" type="date" defaultValue={date} style={{
            width: "auto"
          }} />{items.some(x => x.priority) ? <Select id="reqpriority" aria-label={L('Priority', 'الأولوية')} style={{
            width: "auto"
          }}><option value="">{L('Any priority', 'أي أولوية')}</option>{[...new Set(items.map(x => x.priority).filter(Boolean))].map(v => <option value={v} selected={!!(priority === v)}>{v}</option>)}</Select> : ''}<span className="t-caption dim">{shown.length}{" "}{L('shown', 'معروض')}</span>{cat || state || owner || date || priority ? <button className="btn btn-ghost btn-dense" id="reqclear">{L('Clear filters', 'مسح المرشّحات')}</button> : ''}</div>{" "}<Table cols={[{
          label: L('Type / reference', 'النوع / المرجع')
        }, {
          label: L('Person / subject', 'الشخص / الموضوع')
        }, {
          label: L('Submitted / date', 'التقديم / التاريخ'),
          cls: 'hide-md'
        }, {
          label: L('Status', 'الحالة')
        }, {
          label: L('Next action', 'الخطوة التالية')
        }, {
          label: L('Responsible', 'المسؤول'),
          cls: 'hide-md'
        }, {
          label: '',
          cls: 'shrink'
        }]} rows={shown.map(x => ({
          attrs: 'data-find-item',
          cells: [<><b>{x.title}</b>{x.online ? <span className="or-mark"><Icon name='globe' size={12} />{L('Online', 'إلكتروني')}</span> : x.mark || ''}{x.ref ? <small className="t-caption dim mono" style={{
              display: "block"
            }} dir="ltr">{x.ref}</small> : ''}</>, x.who ? <Who p={x.who} /> : '—', fmtDate(x.date || ''), x.waitingSource ? <Pill label={L('Waiting for official entry', 'بانتظار قيد رسمي')} tone='warning' /> : x.state === 'draft' && x.category === 'certificate' ? <Pill label={L('Request received', 'استُلم الطلب')} tone='info' /> : x.state === 'legacy' ? <Pill label={L('Needs linked record', 'يحتاج قيداً مرتبطاً')} tone='warning' /> : <Status k={x.state} />, <b>{x.next}</b>, x.owner, <span className="row" style={{
            gap: "6px"
          }}>{x.portalId ? <button className="btn btn-secondary btn-dense" data-act={`portal-compare:${x.portalId}`}>{L('Review', 'مراجعة')}</button> : x.historyId ? <button className="btn btn-secondary btn-dense" data-request-history={x.historyId}>{L('View', 'عرض')}</button> : x.state === 'legacy' ? <span className="t-caption dim">{L('Legacy record', 'قيد قديم')}</span> : <a className="btn btn-secondary btn-dense" href={x.href}>{L('View', 'عرض')}</a>}</span>]
        }))} empty={<Empty glyph='check' title={L('No requests match', 'لا طلبات مطابقة')} body={L('Clear a filter or create a request.', 'امسح مرشّحاً أو أنشئ طلباً.')} />} />{" "}<div className="find-empty" hidden><Empty glyph='search' title={L('No matching request', 'لا طلب مطابق')} body={L('Try a parishioner name or reference number.', 'جرّب اسم الشخص أو رقم المرجع.')} /></div></div></>;
  }
  if (tab === 'anniversaries') {
    const key = `pl-anniversaries-${session.user?.id || 'user'}`;
    let layout = S.ui.anniversaryLayoutUser === session.user?.id ? S.ui.anniversaryLayout : null;
    if (!layout) {
      try {
        layout = localStorage.getItem(key);
      } catch {}
    }
    layout = layout === 'grouped' ? 'grouped' : 'combined';
    const items = anniversaryItems().map((a, index) => ({
      ...a,
      index
    }));
    const renderTable = rows => <Table cols={[{
      label: L('Person or couple', 'الشخص أو الزوجان')
    }, {
      label: L('Sacrament', 'السرّ')
    }, {
      label: L('Years', 'السنوات'),
      cls: 'num'
    }, {
      label: L('Date', 'التاريخ')
    }, {
      label: '',
      cls: 'shrink'
    }]} rows={rows.map(a => ({
      cells: [<b>{isAr() ? a.ar : a.couple}</b>, <span>{kindLabel(a.kind)}{a.source === 'legacy' ? <small className="dim">{L('legacy', 'قديم')}</small> : ''}</span>, <span className="num">{a.years}</span>, <span className="mono dim">{fmtDate(a.on)}</span>, <button className="btn btn-secondary btn-dense" data-act={`greet:${a.index}`}><Icon name='msg' size={15} />{L('Send greeting', 'إرسال تهنئة')}</button>]
    }))} empty={<Empty glyph='sacr' title={L('No anniversaries', 'لا ذكريات')} body={L('Anniversaries appear when register entries are available.', 'تظهر الذكريات عند توفّر قيود السجل.')} />} />;
    return <>{head}<div className="tabbody"><div className="toolbar anniversary-toolbar"><span className="t-ui">{L('Display anniversaries', 'عرض الذكريات')}</span><div className="seg" role="group" aria-label={L('Anniversary layout', 'طريقة عرض الذكريات')}><button data-anniversary-layout="combined" aria-pressed={layout === 'combined'}>{L('Combined table', 'جدول موحّد')}</button><button data-anniversary-layout="grouped" aria-pressed={layout === 'grouped'}>{L('By sacrament', 'بحسب السرّ')}</button></div></div>{" "}{layout === 'combined' || !items.length ? renderTable(items) : [...new Set(items.map(a => a.kind))].map(kind => <Panel title={kindLabel(kind)} tight={true}>{renderTable(items.filter(a => a.kind === kind))}</Panel>)}{" "}<p className="t-caption dim" style={{
          marginTop: "16px"
        }}>{L('Baptism, chrismation, first Communion, and marriage anniversaries are derived from their registers. Earlier marriage reminders are labeled as legacy entries until linked to a register.', 'تُستخرج ذكريات المعمودية والميرون والمناولة الأولى والإكليل من سجلاتها. وتبقى ذكريات الإكليل السابقة قيوداً قديمة حتى ربطها بسجل.')}</p></div></>;
  }
  const entries = SACRAMENTS.filter(s => s.kind !== 'certificate' && ['preparing', 'scheduled', 'draft'].includes(s.status));
  return <>{head}<div className="tabbody"><C.InlineAlert tone='info' title={L('Preparation follows priest approval', 'يبدأ التحضير بعد موافقة الكاهن')} body={L('Start with a sacrament request. The priest may accept it directly; then the parish office completes preparation before the celebration.', 'ابدأ بطلب سرّ. يمكن للكاهن قبوله مباشرة، ثم يُكمل مكتب الرعية التحضير قبل الاحتفال.')} />{" "}<div className="toolbar" style={{
        margin: "16px 0"
      }}><button className="btn btn-primary" id="newsacreq"><Icon name='plus' size={16} />{L('New sacrament request', 'طلب سرّ جديد')}</button></div>{" "}<Table cols={[{
        label: L('Person', 'الشخص')
      }, {
        label: L('Sacrament', 'السرّ')
      }, {
        label: L('Celebration date', 'تاريخ الاحتفال')
      }, {
        label: L('Preparation', 'التحضير')
      }, {
        label: L('Status', 'الحالة')
      }, {
        label: '',
        cls: 'shrink'
      }]} rows={entries.map(s => ({
        attrs: 'data-find-item',
        cells: [<Who p={person(s.person)} />, kindLabel(s.kind), s.date ? celebrationText(s) : L('Set date', 'حدّد التاريخ'), prepProgress(s), <Status k={s.status} />, <span className="row" style={{
          gap: "6px"
        }}><a className="btn btn-secondary btn-dense" href={`#/certificate/${s.id}`}>{L('View', 'عرض')}</a>{s.status === 'draft' ? '' : <><button className="btn btn-secondary btn-dense" data-prep-edit={s.id}>{L('Edit', 'تعديل')}</button><button className="btn btn-ghost btn-dense" data-prep-cancel={s.id}>{L('Cancel', 'إلغاء')}</button></>}</span>]
      }))} empty={<Empty glyph='sacr' title={L('No active preparations', 'لا تحضيرات جارية')} body={L('Approved sacrament requests will appear here.', 'ستظهر هنا طلبات الأسرار المعتمدة.')} />} />{" "}<details style={{
        marginTop: "20px"
      }}><summary>{L('Preparation requirements by sacrament', 'متطلبات التحضير بحسب السرّ')}</summary><div className="grid g2" style={{
          marginTop: "16px"
        }}>{Object.entries(PREP_REQUIREMENTS).map(([k, reqs]) => <Panel title={kindLabel(k)}>{reqs.map(([en, ar]) => <div className="listrow"><Icon name='check' size={15} />{L(en, ar)}</div>)}</Panel>)}</div></details></div></>;
}
sacraments.mount = host => {
  host.querySelectorAll('[data-anniversary-layout]').forEach(button => button.addEventListener('click', () => {
    S.ui.anniversaryLayout = button.dataset.anniversaryLayout;
    S.ui.anniversaryLayoutUser = session.user?.id;
    save(`pl-anniversaries-${session.user?.id || 'user'}`, S.ui.anniversaryLayout);
    bus.refresh();
  }));
  for (const [selector, key] of [['#reqcategory', 'requestCategory'], ['#reqstatus', 'requestStatus'], ['#reqowner', 'requestOwner'], ['#reqdate', 'requestDate'], ['#reqpriority', 'requestPriority']]) host.querySelector(selector)?.addEventListener('change', e => {
    S.ui[key] = e.target.value;
    bus.refresh();
  });
  host.querySelector('#reqclear')?.addEventListener('click', () => {
    for (const key of ['requestCategory', 'requestStatus', 'requestOwner', 'requestDate', 'requestPriority']) S.ui[key] = '';
    bus.refresh();
  });
  host.querySelector('#sacexport')?.addEventListener('click', exportRegister);
  host.querySelectorAll('[data-request-history]').forEach(button => button.addEventListener('click', () => {
    const item = REQUEST_HISTORY.find(r => r.id === button.dataset.requestHistory);
    if (!item) return;
    openModal({
      title: L(item.title, item.titleAr),
      body: <><p><Status k={item.status} /> · {fmtDate(item.at)}</p><p>{nameIn(person(item.by))}</p></>,
      foot: <button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>
    });
  }));
  host.querySelector('#newcertreq')?.addEventListener('click', () => {
    const sources = eligibleSources(),
      pending = pendingSacraments();
    const selected = S.ui.newCertificateSource || '';
    S.ui.newCertificateSource = '';
    const initial = sources.find(s => s.id === selected) || null;
    openDrawer({
      title: L('New certificate request', 'طلب شهادة جديد'),
      sub: L('Choose a person and, if available, an existing entry. A future sacrament may be requested now; the certificate waits for an approved register.', 'اختر الشخص وقيداً قائماً إن توفر. يمكن الطلب قبل موعد السرّ، وتنتظر الشهادة اعتماد السجل.'),
      body: <><div className="formrow"><label className="label" htmlFor="req_person">{L('Parishioner', 'صاحب الطلب')}<span className="req">*</span></label><Select id="req_person">{PEOPLE.map(p => <option value={p.id} selected={!!(initial?.person === p.id)}>{isAr() ? p.ar : p.lat}</option>)}</Select></div>{" "}<div className="formrow"><label className="label" htmlFor="req_source">{L('Related sacrament', 'السرّ المرتبط')}</label><Select id="req_source"><option value="">{L('No entry yet — request will wait', 'لا قيد بعد — الطلب سينتظر')}</option>{sources.map(s => <option value={`official:${s.id}`} selected={!!(selected === s.id)}>{s.reg} · {nameIn(person(s.person))} · {kindLabel(s.kind)} ({L('official', 'رسمي')})</option>)}{pending.map(s => <option value={`pending:${s.id}`}>{s.reg} · {nameIn(person(s.person))} · {kindLabel(s.kind)} ({L('pending', 'قيد الانتظار')})</option>)}</Select><span className="help" id="req_source_help">{L('An official entry can be reviewed immediately. A future or pending entry links automatically after registration.', 'يمكن مراجعة القيد الرسمي فوراً. يرتبط القيد المقبل أو المعلّق آلياً بعد اعتماده.')}</span></div>{" "}<C.Field label={L('Purpose of request', 'غاية الطلب')} id='req_purpose' req={true} /></>,
      foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="req_save">{initial ? L('Create and submit', 'إنشاء وإرسال') : L('Create request', 'إنشاء الطلب')}</button></>,
      onMount(el) {
        const related = el.querySelector('#req_source'),
          personSelect = el.querySelector('#req_person');
        const refreshAction = () => {
          el.querySelector('#req_save').textContent = related.value.startsWith('official:') ? L('Create and submit', 'إنشاء وإرسال') : L('Create request', 'إنشاء الطلب');
        };
        related.addEventListener('change', () => {
          const selectedRecord = SACRAMENTS.find(s => s.id === related.value.split(':')[1]);
          if (selectedRecord) personSelect.value = selectedRecord.person;
          refreshAction();
        });
        personSelect.addEventListener('change', () => {
          const selectedRecord = SACRAMENTS.find(s => s.id === related.value.split(':')[1]);
          if (selectedRecord && selectedRecord.person !== personSelect.value) related.value = '';
          refreshAction();
        });
        el.querySelector('#req_save')?.addEventListener('click', async () => {
          if (!need(el, '#req_purpose', L('Enter the purpose', 'أدخل غاية الطلب'))) return;
          const saveButton = el.querySelector('#req_save');
          saveButton.disabled = true;
          const [recordType, recordId] = related.value.split(':');
          const id = 'sc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
          try {
            await serverWorkflow('create-certificate-request', id, {
              requestId: id,
              person: personSelect.value,
              purpose: el.querySelector('#req_purpose').value.trim(),
              sourceRecordId: recordType === 'official' ? recordId : null,
              requestedSacramentId: recordType === 'pending' ? recordId : null
            });
            closeOverlays();
            location.hash = `#/certificate/${id}`;
            bus.refresh();
            toast(L('Request created', 'أُنشئ الطلب'), recordType === 'official' ? L('Submitted for clergy review.', 'أُرسل لمراجعة الإكليروس.') : L('It will wait for an official register entry before approval.', 'سينتظر قيداً رسمياً قبل الاعتماد.'), 'success');
          } catch (e) {
            saveButton.disabled = false;
            toast(L('Could not create request', 'تعذّر إنشاء الطلب'), e.message, 'danger');
          }
        });
      }
    });
  });
  if (S.ui.newCertificateSource && host.querySelector('#newcertreq')) host.querySelector('#newcertreq').click();
  host.querySelector('#newsacreq')?.addEventListener('click', () => openDrawer({
    title: L('New sacrament request', 'طلب سرّ جديد'),
    sub: L('Record the family request. The secretary may review it, or the priest may decide directly. Preparation begins only after priest approval.', 'سجّل طلب العائلة. يمكن للأمينة مراجعته، أو للكاهن اتخاذ القرار مباشرة. يبدأ التحضير فقط بعد موافقته.'),
    body: <><div className="formrow"><label className="label" htmlFor="srq_kind">{L('Sacrament', 'السرّ')}</label><Select id="srq_kind">{Object.entries(KIND).filter(([k]) => k !== 'certificate').map(([k, v]) => <option value={k}>{L(v[0], v[1])}</option>)}</Select></div>{" "}<div className="formrow" id="srq-existing"><label className="label" htmlFor="srq_person">{L('Person receiving the sacrament', 'الشخص الذي سيقبل السرّ')}</label><Select id="srq_person"><option value="">{L('Choose a person', 'اختر شخصاً')}</option>{PEOPLE.map(p => <option value={p.id}>{isAr() ? p.ar : p.lat}</option>)}</Select></div>{" "}<label className="check" id="srq-child-choice"><input type="checkbox" id="srq-new-child" /><span>{L('Baptism for a child not yet in People', 'معمودية لطفل غير مسجّل بعد في المؤمنين')}</span></label>{" "}<div id="srq-child-fields" hidden className="stack" style={{
        gap: "12px",
        margin: "14px 0"
      }}><C.Field label={L('Child’s full name (English)', 'اسم الطفل الكامل (إنكليزي)')} id='srq-child-lat' req={true} />{" "}<C.Field label={L('Child’s full name (Arabic)', 'اسم الطفل الكامل (عربي)')} id='srq-child-ar' req={true} />{" "}<C.Field label={L('Child’s birth date', 'تاريخ ميلاد الطفل')} id='srq-child-born' type='date' req={true} />{" "}<div className="formgrid"><C.Field label={L('Father’s name (optional)', 'اسم الأب (اختياري)')} id='srq-child-father' /><C.Field label={L('Mother’s name (optional)', 'اسم الأم (اختياري)')} id='srq-child-mother' /></div>{" "}<p className="help">{L('Submitting creates a linked child record without a login account. If the child is already listed, select that person instead.', 'يُنشئ التقديم سجل طفل مرتبطاً دون حساب دخول. إذا كان الطفل مسجّلاً، اختر سجله بدلاً من ذلك.')}</p></div>{" "}<C.Field label={L('Preferred date (optional)', 'التاريخ المفضّل (اختياري)')} id='srq_date' type='date' />{" "}<C.Textarea label={L('Family request / notes', 'طلب العائلة / ملاحظات')} id='srq_notes' max={500} /></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="srq_save">{L('Submit request', 'تقديم الطلب')}</button></>,
    onMount(el) {
      const mode = () => {
        const baptism = el.querySelector('#srq_kind').value === 'baptism';
        el.querySelector('#srq-child-choice').hidden = !baptism;
        if (!baptism) el.querySelector('#srq-new-child').checked = false;
        const manual = baptism && el.querySelector('#srq-new-child').checked;
        el.querySelector('#srq-child-fields').hidden = !manual;
        el.querySelector('#srq-existing').hidden = manual;
      };
      el.querySelector('#srq_kind').addEventListener('change', mode);
      el.querySelector('#srq-new-child').addEventListener('change', mode);
      mode();
      el.querySelector('#srq_save').addEventListener('click', async () => {
        const manual = el.querySelector('#srq-new-child').checked,
          personId = el.querySelector('#srq_person').value;
        if (!manual && !personId) return toast(L('Choose a person', 'اختر شخصاً'), '', 'warning');
        const child = manual ? {
          lat: el.querySelector('#srq-child-lat').value.trim(),
          ar: el.querySelector('#srq-child-ar').value.trim(),
          born: el.querySelector('#srq-child-born').value,
          father: el.querySelector('#srq-child-father').value.trim(),
          mother: el.querySelector('#srq-child-mother').value.trim()
        } : null;
        if (manual && (!child.lat || !child.ar || !child.born)) return toast(L('Complete the child’s names and birth date', 'أكمل اسمَي الطفل وتاريخ ميلاده'), '', 'warning');
        const id = 'sc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const btn = el.querySelector('#srq_save');
        btn.disabled = true;
        try {
          await serverWorkflow('create-sacrament-request', id, {
            kind: el.querySelector('#srq_kind').value,
            person: manual ? undefined : personId,
            child: child || undefined,
            date: el.querySelector('#srq_date').value,
            notes: el.querySelector('#srq_notes').value.trim()
          });
          closeOverlays();
          location.hash = '#/requests';
          bus.refresh();
          toast(L('Request submitted', 'قُدّم الطلب'), L('It is ready for office review or a direct priest decision.', 'الطلب جاهز لمراجعة المكتب أو لقرار الكاهن المباشر.'), 'success');
        } catch (e) {
          btn.disabled = false;
          toast(L('Could not submit request', 'تعذّر تقديم الطلب'), e.message, 'danger');
        }
      });
    }
  }));
  host.querySelectorAll('[data-prep-edit]').forEach(btn => btn.addEventListener('click', () => {
    const record = SACRAMENTS.find(s => s.id === btn.dataset.prepEdit);
    if (!record) return;
    const requirements = PREP_REQUIREMENTS[record.kind] || [];
    openDrawer({
      title: L('Edit preparation', 'تعديل التحضير'),
      sub: L('Record the planned date and requirements. Complete preparation before celebration.', 'سجّل الموعد والمتطلبات. أكمل التحضير قبل الاحتفال.'),
      body: <><p className="t-caption dim">{(isAr() ? person(record.person)?.ar : person(record.person)?.lat) || ''} · {kindLabel(record.kind)}</p><div className="formgrid"><C.Field label={L('Celebration date', 'تاريخ الاحتفال')} id='prep_date' type='date' value={record.date || ''} />{timeSelect('prep_time', record.time || '')}</div><div className="stack" style={{
          gap: "10px",
          marginTop: "16px"
        }}>{requirements.map(([en, ar, required], i) => <label className="check"><input type="checkbox" data-prep-item={i} defaultChecked={!!(Array.isArray(record.preparation) && record.preparation[i])} /><span>{L(en, ar)}{required ? '' : <small className="dim">({L('optional', 'اختياري')})</small>}</span></label>)}</div></>,
      foot: <><button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button><button className="btn btn-primary" id="prep_save">{L('Save preparation', 'حفظ التحضير')}</button>{record.status === 'preparing' ? <button className="btn btn-secondary" id="prep_complete">{L('Complete preparation', 'إكمال التحضير')}</button> : ''}</>,
      onMount(el) {
        const save = async () => {
          await serverWorkflow('update-preparation', record.id, {
            date: el.querySelector('#prep_date').value,
            time: el.querySelector('#prep_date').value ? el.querySelector('#prep_time').value : '',
            checklist: [...el.querySelectorAll('[data-prep-item]')].map(x => x.checked)
          });
        };
        el.querySelector('#prep_save').addEventListener('click', async () => {
          try {
            await save();
            closeOverlays();
            bus.refresh();
            toast(L('Preparation saved', 'حُفظ التحضير'), '', 'success');
          } catch (e) {
            toast(L('Could not save preparation', 'تعذّر حفظ التحضير'), e.message, 'danger');
          }
        });
        el.querySelector('#prep_complete')?.addEventListener('click', async () => {
          try {
            await save();
            await serverWorkflow('complete-preparation', record.id);
            closeOverlays();
            bus.refresh();
            toast(L('Preparation completed', 'اكتمل التحضير'), L('Record the celebration on or after its date.', 'سجّل الاحتفال في موعده أو بعده.'), 'success');
          } catch (e) {
            toast(L('Could not complete preparation', 'تعذّر إكمال التحضير'), e.message, 'danger');
          }
        });
      }
    });
  }));
  host.querySelectorAll('[data-prep-cancel]').forEach(btn => btn.addEventListener('click', () => openModal({
    title: L('Cancel this preparation?', 'إلغاء هذا التحضير؟'),
    sub: L('The request and its history remain available.', 'يبقى الطلب وسجله متاحين.'),
    body: <><C.Textarea label={L('Reason', 'السبب')} id='prep_reason' max={500} />{sharedNote(SACRAMENTS.find(s => s.id === btn.dataset.prepCancel))}</>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Keep', 'إبقاء')}</button><button className="btn btn-primary" id="prep_cancel_confirm">{L('Cancel preparation', 'إلغاء التحضير')}</button></>,
    onMount(el) {
      el.querySelector('#prep_cancel_confirm').addEventListener('click', async () => {
        if (!need(el, '#prep_reason', L('Enter a reason', 'أدخل السبب'))) return;
        try {
          await serverWorkflow('cancel-preparation', btn.dataset.prepCancel, {
            reason: el.querySelector('#prep_reason').value.trim()
          });
          closeOverlays();
          bus.refresh();
        } catch (e) {
          toast(L('Could not cancel preparation', 'تعذّر إلغاء التحضير'), e.message, 'danger');
        }
      });
    }
  })));
};
export const requests = () => sacraments('requests', <div className="account-actions request-queues"><a className="btn btn-secondary" href="#/membershipreviews">{L('Parish memberships', 'عضويات الرعية')}{" "}<span data-queue-count="membershipreviews" /></a><a className="btn btn-secondary" href="#/guestrequests">{L('Guest requests · no account', 'طلبات الزوّار · دون حساب')}{" "}<span data-queue-count="guestrequests" /></a><a className="btn btn-secondary" href="#/profilereviews">{t('Profile corrections', 'تصحيحات الملفات')}{" "}<span data-queue-count="profilereviews" /></a></div>);
/* #/requests/online/<id> opens that online request over the list; the address then settles back on Requests. */
requests.mount = (host, first, second) => {
  api('workspace/request-counts?parish=' + encodeURIComponent(session.parishId)).then(counts => {
    if (host.isConnected) host.querySelectorAll('[data-queue-count]').forEach(el => {
      el.textContent = counts[el.dataset.queueCount] ? String(counts[el.dataset.queueCount]) : '';
    });
  }).catch(() => {});
  sacraments.mount(host);
  if (first === 'online' && second) {
    S.params = [];
    history.replaceState(null, '', '#/requests');
    openOnlineRequest(second);
  }
};

/* ---------------- record page: progress, the document, details ---------------- */
/* When a step happened, from the record's own history (the newest matching entry). */
const stepAt = (s, ...actions) => [...(s.history || [])].reverse().find(h => actions.includes(h.action))?.at || '';
const workflowStages = s => s.kind === 'certificate' ? [[L('Requested', 'طُلبت'), true, s.requestedAt || s.history?.[0]?.at || ''], [L('Register entry linked', 'رُبط القيد'), !!sourceFor(s), stepAt(s, 'source linked')], [L('Approved by the priest', 'اعتمدها الكاهن'), ['approved', 'issued'].includes(s.status), s.approvedAt || stepAt(s, 'approve')], [L('Issued', 'صدرت'), s.status === 'issued', s.issuedAt || stepAt(s, 'issue')]] : [[L('Requested', 'طُلب'), true, s.requestedAt || stepAt(s, 'sacrament requested', 'request submitted')], [L('Accepted by the priest', 'قبله الكاهن'), !!s.requestApprovedAt || ['preparing', 'scheduled', 'draft', 'awaiting-signature', 'registered', 'issued'].includes(s.status) && !String(s.reg).startsWith('SRQ/'), s.requestApprovedAt || stepAt(s, 'request accepted for preparation')], [L('Prepared', 'اكتمل التحضير'), ['scheduled', 'draft', 'awaiting-signature', 'registered', 'issued'].includes(s.status), stepAt(s, 'preparation completed')], [L('Celebrated', 'احتُفل به'), ['draft', 'awaiting-signature', 'registered', 'issued'].includes(s.status), '', 'celebration'], [L('Entered in the register', 'دُوّن في السجل'), ['registered', 'issued'].includes(s.status), s.approvedAt || stepAt(s, 'approve')]];

/* The celebration as people say it: 25 Oct 2026 · 10:30 */
export const celebrationText = s => s?.date ? `${fmtDate(s.date)}${s.time ? ` · ${s.time}` : ''}` : '';
/* Half-hour steps for the celebration time: a list is easier than a clock to set on any phone. */
const CELEBRATION_TIMES = Array.from({
  length: 32
}, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const timeSelect = (id, value = '') => <div className="formrow"><label className="label" htmlFor={id}>{L('Celebration time', 'وقت الاحتفال')}</label>{" "}<Select id={id} dir="ltr"><option value="">{L('Not set yet', 'لم يُحدَّد بعد')}</option>{[...new Set([...CELEBRATION_TIMES, ...(value ? [value] : [])])].sort().map(x => <option value={x} selected={!!(x === value)}>{x}</option>)}</Select></div>;

/* What each step says under its name: when it happened, how long the current one has waited, or when the celebration is planned. */
function stepWhen(s, stages, i, now) {
  const [, done, at, kind] = stages[i];
  if (kind === 'celebration') {
    if (!s.date) return '';
    return done ? celebrationText(s) : `${L('Planned for', 'مقرّر في')} ${celebrationText(s)}`;
  }
  if (done) return at ? when(at) : '';
  if (i !== now) return '';
  const since = [...stages.slice(0, i)].reverse().find(([, ok, stamp]) => ok && stamp)?.[2];
  return since ? `${L('Waiting since', 'بانتظار منذ')} ${when(since)}` : '';
}

/* Where the request stands, one numbered step at a time, and the single next thing to do. */
const progressPanel = s => {
  const stages = workflowStages(s),
    closed = ['cancelled', 'rejected'].includes(s.status);
  const now = closed ? -1 : stages.findIndex(([, done]) => !done);
  const [next, owner] = nextStep(s);
  return <section className="panel progresspanel"><div className="panel-b"><div className="progress-top"><h3>{s.kind === 'certificate' ? L('Request progress', 'مراحل الطلب') : L('Progress', 'المراحل')}</h3>{sacramentStatus(s)}</div>{" "}<p className="nextstep"><span className="lbl">{now < 0 ? L('Status', 'الحالة') : L('Next step', 'الخطوة التالية')}</span>{" "}<b>{next}</b>{owner ? <span className="owner"><Icon name='people' size={14} />{owner}</span> : ''}</p>{" "}<ol className={`steps${closed ? ' closed' : ''}`}>{stages.map(([label, done], i) => {
          const at = stepWhen(s, stages, i, now);
          return <li className={done ? 'done' : i === now ? 'now' : ''}><span className="dot" aria-hidden="true">{done ? <Icon name='check' size={13} /> : i + 1}</span><span className="step-text"><span className="lbl">{label}</span>{at ? <span className="when">{at}</span> : ''}</span>{" "}<span className="sr-only">{done ? L('done', 'منجز') : i === now ? L('current step', 'الخطوة الحالية') : L('not yet', 'لم يحن بعد')}</span></li>;
        })}</ol>{" "}{s.kind === 'certificate' && (s.purpose || s.godparents) ? <p className="t-caption dim" style={{
        marginTop: "12px"
      }}>{L('Purpose of the request', 'غاية الطلب')}: {s.purpose || s.godparents}</p> : ''}</div></section>;
};

/* ---------- the document itself: one A4 vector sheet ----------
   The same drawing is the thumbnail, the full-size view, the printed page and the PNG and SVG
   downloads, so they can never disagree. Units are millimetres on an A4 page. */
const INK = '#233B32',
  SECONDARY = '#607068',
  RULE = '#DCE2DB';
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
  const source = s.kind === 'certificate' ? sourceFor(s) : s,
    record = source || s;
  const p = person(record.person) || {
      lat: '',
      ar: ''
    },
    cel = person(record.celebrant);
  const ar = lang !== 'english',
    en = lang !== 'arabic',
    both = ar && en;
  const dl = lang === 'arabic' ? 'ar' : lang === 'english' ? 'en' : '';
  const tx = (x, y, str, o = {}) => str ? <text x={x} y={y} fontFamily={o.font || EN_FONT} fontSize={o.size || 4.6} fontWeight={o.weight || 400} fill={o.fill || INK} textAnchor={o.anchor || 'middle'} direction={o.rtl ? "rtl" : undefined} letterSpacing={o.spacing ? o.spacing : undefined} opacity={o.opacity ? o.opacity : undefined}>{o.upper ? String(str).toUpperCase() : str}</text> : '';
  const arT = (x, y, str, o = {}) => tx(x, y, str, {
    font: AR_FONT,
    rtl: true,
    ...o
  });
  let y = 0;
  const out = [];
  /* frame, corner marks and the seal */
  out.push(<><rect width="210" height="297" fill="#FFFFFF" />{" "}<rect x="8" y="8" width="194" height="281" fill="none" stroke={SECONDARY} strokeWidth=".6" />{" "}<rect x="11" y="11" width="188" height="275" fill="none" stroke={SECONDARY} strokeWidth=".25" opacity=".55" />{" "}{[[11, 11], [199, 11], [11, 286], [199, 286]].map(([cx, cy]) => <rect x={cx - 1.4} y={cy - 1.4} width="2.8" height="2.8" fill={SECONDARY} opacity=".7" transform={`rotate(45 ${cx} ${cy})`} />)}{" "}<circle cx="105" cy="33" r="10" fill="none" stroke={SECONDARY} strokeWidth=".7" />{" "}<path d="M105 26.5v13M98.5 33h13" stroke={SECONDARY} strokeWidth="1.5" strokeLinecap="round" /></>);
  /* who issues it */
  y = 55;
  if (ar) {
    out.push(arT(105, y, PARISH.eparchyAr, {
      size: 7.2,
      weight: 600,
      fill: SECONDARY
    }), arT(105, y + 8.5, `${PARISH.nameAr} — ${PARISH.townAr}`, {
      size: 4.8,
      fill: SECONDARY
    }));
    y += 20;
  }
  if (en) {
    out.push(tx(105, y, PARISH.eparchy, {
      size: 5.4,
      weight: 600,
      spacing: .5,
      upper: true
    }), tx(105, y + 6.5, `${PARISH.name} — ${PARISH.town}`, {
      size: 3.9,
      fill: SECONDARY
    }));
    y += 15;
  }
  out.push(<><path d={`M80 ${y} H101 M109 ${y} H130`} stroke={SECONDARY} strokeWidth=".3" /><rect x="103.3" y={y - 1.7} width="3.4" height="3.4" fill="none" stroke={SECONDARY} strokeWidth=".3" transform={`rotate(45 105 ${y})`} /></>);
  /* what it certifies, and for whom */
  y += 15;
  if (ar) {
    out.push(arT(105, y, KIND[record.kind]?.[1] || '', {
      size: 8,
      weight: 600
    }));
    y += 8.5;
  }
  if (en) {
    out.push(tx(105, y, KIND[record.kind]?.[0] || '', {
      size: 4.4,
      spacing: 1.1,
      upper: true,
      fill: SECONDARY
    }));
    y += 6;
  }
  y += 6;
  if (both) out.push(tx(26, y, 'This certifies that', {
    size: 3.6,
    anchor: 'start',
    fill: SECONDARY
  }), arT(184, y, 'نشهد بأنّ', {
    size: 4,
    anchor: 'start',
    fill: SECONDARY
  }));else out.push(ar ? arT(105, y, 'نشهد بأنّ', {
    size: 4,
    fill: SECONDARY
  }) : tx(105, y, 'This certifies that', {
    size: 3.6,
    fill: SECONDARY
  }));
  y += 15;
  if (ar) {
    out.push(arT(105, y, p.ar, {
      size: 11,
      weight: 600
    }));
    y += 10;
  }
  if (en) {
    out.push(tx(105, y, p.lat, {
      size: 5.6,
      spacing: .25,
      fill: SECONDARY
    }));
    y += 6;
  }
  /* the facts, each on a ruled line: English label, value, Arabic label */
  const rows = [[record.date > today() ? 'Scheduled for' : 'Celebrated on', record.date > today() ? 'مجدول في' : 'تاريخ الاحتفال', fmtDateIn(record.date, dl)], ['Celebrant', 'المحتفل', (lang === 'arabic' ? cel?.ar : cel?.lat) || '—'], ...[['godparents', 'Godparents / witnesses', 'الإشبين / الشهود'], ['father', 'Father', 'الأب'], ['mother', 'Mother', 'الأم'], ['place', 'Place', 'المكان']].filter(([k]) => record[k]).map(([k, enL, arL]) => [enL, arL, record[k]])];
  const step = rows.length > 4 ? 9 : 10.5;
  y += 10;
  for (const [enL, arL, val] of rows) {
    const vo = {
      size: 4.6,
      weight: 600,
      font: ANY_FONT,
      rtl: hasArabic(val)
    };
    if (both) out.push(tx(26, y, enL, {
      size: 3.9,
      anchor: 'start',
      fill: SECONDARY
    }), tx(105, y, val, vo), arT(184, y, arL, {
      size: 4.3,
      anchor: 'start',
      fill: SECONDARY
    }));else if (en) out.push(tx(26, y, enL, {
      size: 4,
      anchor: 'start',
      fill: SECONDARY
    }), tx(184, y, val, {
      ...vo,
      anchor: hasArabic(val) ? 'start' : 'end'
    }));else out.push(arT(184, y, arL, {
      size: 4.5,
      anchor: 'start',
      fill: SECONDARY
    }), tx(26, y, val, {
      ...vo,
      anchor: hasArabic(val) ? 'end' : 'start'
    }));
    out.push(<path d={`M26 ${y + 2.6} H184`} stroke={RULE} strokeWidth=".25" strokeDasharray=".8 1.2" />);
    y += step;
  }
  /* where it is written: book, page and entry */
  const boxY = Math.max(y + 6, 214);
  const cap = (enL, arL) => lang === 'arabic' ? arL : lang === 'english' ? enL.toUpperCase() : `${enL.toUpperCase()} · ${arL}`;
  [[57, 26, cap('Book', 'الدفتر'), record.book || '—'], [88, 26, cap('Page', 'الصفحة'), record.page || '—'], [119, 34, cap('Entry', 'القيد'), record.reg]].forEach(([x, w, lbl, val]) => {
    out.push(<rect x={x} y={boxY} width={w} height="15" rx="1.2" fill="none" stroke={RULE} strokeWidth=".4" />, tx(x + w / 2, boxY + 5, lbl, {
      size: lang === 'arabic' ? 3.2 : 2.5,
      spacing: lang === 'arabic' ? 0 : .3,
      fill: SECONDARY,
      font: ANY_FONT,
      rtl: lang === 'arabic'
    }), tx(x + w / 2, boxY + 11.6, val, {
      size: 4.4,
      weight: 600,
      font: MONO_FONT
    }));
  });
  /* signature and seal */
  const sigY = 260;
  out.push(<><path d={`M26 ${sigY} H86`} stroke={INK} strokeWidth=".3" />{" "}<circle cx="160" cy={sigY - 5} r="11.5" fill="none" stroke={SECONDARY} strokeWidth=".35" strokeDasharray="1.2 1.2" opacity=".8" /></>);
  /* A signed certificate carries the priest's own handwritten signature above the line, the
     printed name under it, and the code that checks it (backend/signatures.py). */
  const signed = docIssued(s) && s.signature?.drawing ? s.signature : null;
  if (signed) out.push(<g transform={`translate(26 ${sigY - 22}) scale(.15)`}><path d={String(signed.drawing).replace(/[^MLQCZmlqcz0-9 .,-]/g, '')} fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></g>);else if (docIssued(s) && s.issuedBy) out.push(tx(56, sigY - 3, s.issuedBy, {
    size: 4,
    font: ANY_FONT
  }));
  const roleY = signed ? sigY + 9.5 : sigY + 5;
  if (signed) out.push(tx(56, sigY + 4.5, s.issuedBy || signed.name, {
    size: 3.6,
    font: ANY_FONT
  }));
  if (en) out.push(tx(56, roleY, 'Parish priest', {
    size: 3.4,
    fill: SECONDARY
  }));
  if (ar) out.push(arT(56, roleY + (en ? 5 : 0), 'كاهن الرعية', {
    size: 3.8,
    fill: SECONDARY
  }));
  if (signed?.code) out.push(tx(105, 283.4, `${en ? 'Digitally signed · check code' : 'موقّعة رقمياً · رمز التحقّق'} ${signed.code} · ${location.host}/public.html?verify=${signed.code}`, {
    size: 2.7,
    fill: SECONDARY,
    font: ANY_FONT,
    rtl: !en
  }));
  out.push(tx(160, sigY - 4, ar && !en ? 'الختم' : 'SEAL', {
    size: ar && !en ? 3.6 : 2.8,
    spacing: ar && !en ? 0 : .4,
    fill: SECONDARY,
    font: ANY_FONT,
    opacity: .85,
    rtl: ar && !en
  }));
  if (docIssued(s)) out.push(tx(105, signed?.code ? 278.6 : 283, `${en ? 'Issued' : 'صدرت في'} ${fmtDateIn(zoned(s.issuedAt) || String(s.issuedAt || '').slice(0, 10), dl)}`, {
    size: 3,
    fill: SECONDARY,
    font: ANY_FONT,
    rtl: !en
  }));else out.push(<g transform="rotate(-28 105 150)" opacity=".1">{en ? tx(105, ar ? 146 : 154, 'UNISSUED PREVIEW', {
      size: 13,
      weight: 700,
      spacing: 2,
      fill: SECONDARY
    }) : ''}{ar ? arT(105, en ? 162 : 154, 'معاينة غير صادرة', {
      size: 12,
      weight: 700,
      fill: SECONDARY
    }) : ''}</g>);
  const label = `${KIND[record.kind]?.[0] || ''} — ${p.lat}`;
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 297" width="210mm" height="297mm" role="img" aria-label={label}>{out}</svg>;
}

/* the thumbnail card: small paper, click to see it full size, download in three forms */
function docCard(s, lang) {
  const record = s.kind === 'certificate' ? sourceFor(s) : s,
    p = person(record.person) || {};
  return <section className="panel doccard"><div className="panel-h"><h3>{docTitle(s)}</h3>{" "}<span className="seg doclang" role="group" aria-label={L('Document language', 'لغة الوثيقة')}>{DOC_LANGS().map(([k, lab]) => <button type="button" aria-pressed={lang === k} data-go={`certificate/${s.id}/${k}`}>{lab}</button>)}</span></div>{" "}<div className="panel-b doccard-b"><button type="button" className="docthumb" data-docview="" title={L('Click to view full size', 'انقر للعرض بالحجم الكامل')}>{certificateSVG(s, lang)}<span className="docthumb-hint"><Icon name='search' size={14} />{L('View', 'عرض')}</span></button>{" "}<div className="docmeta"><b>{kindLabel(record.kind)} · {nameIn(p)}</b>{" "}<span className="t-caption dim">A4 · {docLangLabel(lang)} · <span className="mono" dir="ltr">{record.reg}</span></span>{" "}<p className={`docstate${docIssued(s) ? ' ok' : ''}`}><Icon name={docIssued(s) ? 'check' : 'info'} size={15} />{docIssued(s) ? L('Signed and issued — ready to print or send.', 'موقّعة وصادرة — جاهزة للطباعة أو الإرسال.') : s.kind === 'certificate' ? L('Preview only — the certificate is not signed or issued yet.', 'معاينة فقط — لم تُوقَّع الشهادة ولم تصدر بعد.') : L('Preview of the register entry — not a certificate.', 'معاينة لقيد السجل — ليست شهادة.')}</p>{" "}<div className="docacts"><button type="button" className="btn btn-primary btn-dense" data-docview=""><Icon name='doc' size={16} />{L('View full size', 'عرض بالحجم الكامل')}</button>{" "}<button type="button" className="btn btn-secondary btn-dense" data-docdl="" aria-haspopup="menu" aria-expanded="false"><Icon name='export' size={16} />{L('Download', 'تنزيل')}<Icon name='chevD' size={14} /></button>{" "}<button type="button" className="btn btn-secondary btn-dense" data-docprint=""><Icon name='print' size={16} />{L('Print', 'طباعة')}</button>{" "}{docIssued(s) ? <button type="button" className="btn btn-ghost btn-dense" data-act="share-cert"><Icon name='msg' size={16} />{L('Send on WhatsApp', 'إرسال على واتساب')}</button> : ''}</div></div></div></section>;
}
const docFile = (s, lang, ext) => {
  const record = s.kind === 'certificate' ? sourceFor(s) : s;
  return `${fileName(s.kind === 'certificate' ? 'certificate' : 'register-extract', KIND[record.kind]?.[0].split(' ')[0], person(record.person)?.lat, record.reg.replace(/\//g, '-'), lang)}.${ext}`;
};
function printDoc(s, lang, pdf = false) {
  if (pdf) toast(L('Saving as PDF', 'الحفظ كـPDF'), L('In the print window, choose “Save as PDF” as the printer.', 'في نافذة الطباعة، اختر «حفظ كـPDF» بدل الطابعة.'), 'success');
  printSheet({
    title: docFile(s, lang, 'pdf').replace(/\.pdf$/, ''),
    margin: '0',
    body: certificateSVG(s, lang),
    css: 'html,body{width:210mm;height:297mm;overflow:hidden}svg{display:block;width:210mm;height:297mm}'
  });
}
function downloadMenu(anchor, s, lang) {
  openMenu(anchor, [{
    label: L('PDF — print or save', 'PDF — طباعة أو حفظ'),
    icon: 'doc',
    fn: () => printDoc(s, lang(), true)
  }, {
    label: L('Image (PNG)', 'صورة (PNG)'),
    icon: 'export',
    hint: '1240×1754',
    fn: async () => {
      try {
        saveBlob(docFile(s, lang(), 'png'), await svgToPng(certificateSVG(s, lang()), 1240, 1754));
        toast(L('Image saved', 'حُفظت الصورة'), docFile(s, lang(), 'png'), 'success');
      } catch {
        toast(L('The image could not be made', 'تعذّر إنشاء الصورة'), L('Try the PDF instead.', 'جرّب PDF بدلاً منها.'), 'danger');
      }
    }
  }, {
    label: L('Vector file (SVG)', 'ملف متّجه (SVG)'),
    icon: 'export',
    fn: () => {
      saveBlob(docFile(s, lang(), 'svg'), new Blob([markup(certificateSVG(s, lang()))], {
        type: 'image/svg+xml'
      }));
      toast(L('File saved', 'حُفظ الملف'), docFile(s, lang(), 'svg'), 'success');
    }
  }], {
    width: 250
  });
}
/* full size, with its own language switch so the reader can compare without leaving */
function viewDoc(s, lang) {
  let cur = lang;
  const record = s.kind === 'certificate' ? sourceFor(s) : s;
  openModal({
    wide: true,
    title: `${docTitle(s)} — ${nameIn(person(record.person))}`,
    sub: <>A4 · <span className="mono" dir="ltr">{record.reg}</span> · {docIssued(s) ? L('issued', 'صادرة') : L('preview, not issued', 'معاينة، غير صادرة')}</>,
    body: <><div className="docview-bar"><span className="seg" role="group" aria-label={L('Document language', 'لغة الوثيقة')}>{DOC_LANGS().map(([k, lab]) => <button type="button" aria-pressed={cur === k} data-vlang={k}>{lab}</button>)}</span></div>{" "}<div className="docviewer" id="docviewer">{certificateSVG(s, cur)}</div></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Close', 'إغلاق')}</button>{" "}<button className="btn btn-secondary" id="dv_dl" aria-haspopup="menu" style={{
        marginInlineStart: "auto"
      }}><Icon name='export' size={16} />{L('Download', 'تنزيل')}<Icon name='chevD' size={14} /></button>{" "}<button className="btn btn-primary" id="dv_print"><Icon name='print' size={16} />{L('Print', 'طباعة')}</button></>,
    onMount(el) {
      el.querySelectorAll('[data-vlang]').forEach(b => b.addEventListener('click', () => {
        cur = b.dataset.vlang;
        el.querySelectorAll('[data-vlang]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        paint(el.querySelector('#docviewer'), certificateSVG(s, cur));
      }));
      el.querySelector('#dv_dl').addEventListener('click', e => downloadMenu(e.currentTarget, s, () => cur));
      el.querySelector('#dv_print').addEventListener('click', () => printDoc(s, cur));
    }
  });
}
const HIST = {
  'sacrament requested': ['Request received', 'استُلم الطلب'],
  'request submitted': ['Request received', 'استُلم الطلب'],
  'office review completed': ['Reviewed by the office', 'راجعه المكتب'],
  'request accepted for preparation': ['Accepted by the priest', 'قبله الكاهن'],
  'request declined': ['Declined', 'رُفض'],
  'preparation updated': ['Preparation updated', 'حُدّث التحضير'],
  'preparation completed': ['Preparation completed', 'اكتمل التحضير'],
  'preparation cancelled': ['Preparation cancelled', 'أُلغي التحضير'],
  'details updated': ['Details updated', 'حُدّثت التفاصيل'],
  'request amendment proposed': ['Request amendment proposed', 'اقتُرح تعديل الطلب'],
  'request amendment approved': ['Request amendment approved', 'اعتُمد تعديل الطلب'],
  'request amendment rejected': ['Request amendment rejected', 'رُفض تعديل الطلب'],
  'submitted for clergy review': ['Sent to the priest', 'أُرسل إلى الكاهن'],
  submit: ['Sent to the priest for approval', 'أُرسل إلى الكاهن للاعتماد'],
  'sacrament celebrated': ['Celebrated', 'احتُفل به'],
  approve: ['Approved', 'اعتُمد'],
  issue: ['Signed and issued', 'وُقّع وصدر'],
  reject: ['Rejected', 'رُفض'],
  cancelled: ['Cancelled', 'أُلغي'],
  'source linked': ['Register entry linked', 'رُبط القيد'],
  correction: ['Corrected', 'صُحّح']
};
const histLabel = a => HIST[a] ? L(...HIST[a]) : String(a || '').charAt(0).toUpperCase() + String(a || '').slice(1);
const zoned = at => {
  const v = String(at || '');
  if (!/T.*(Z|[+-]\d\d:?\d\d)$/.test(v)) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const when = at => {
  if (!at) return '';
  const d = zoned(at),
    v = String(at);
  return d ? `${fmtDate(d)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : `${fmtDate(v.slice(0, 10))}${v.length > 10 ? ` · ${v.slice(11, 16)}` : ''}`;
};

/* The document opens in the language the parishioner asked for, when they asked online. */
const docLang = (s, lang) => DOC_LANGS().some(([k]) => k === lang) ? lang : DOC_LANGS().some(([k]) => k === s?.language) ? s.language : 'bilingual';
const telLink = v => <a href={`tel:${String(v).replace(/[^\d+]/g, '')}`}><bdi dir="ltr">{v}</bdi></a>;
export function certificate(id, lang = '') {
  const s = SACRAMENTS.find(x => x.id === id);
  if (!s) return <Empty glyph='doc' title={L('Record not found', 'لم يُعثر على القيد')} body={L('Open a record from Requests or from a person’s Sacraments tab.', 'افتح قيداً من الطلبات أو من تبويب الأسرار في سجل الشخص.')} />;
  lang = docLang(s, lang);
  const source = s.kind === 'certificate' ? SACRAMENTS.find(x => x.id === s.sourceRecordId) : s;
  const record = source || s;
  const p = person(record.person) || {
      lat: '',
      ar: ''
    },
    cel = person(record.celebrant);
  const asRequest = s.kind === 'certificate' || ['requested', 'office-reviewed', 'rejected', 'cancelled'].includes(s.status);
  const hasDoc = !!source && (s.kind === 'certificate' || official(s));
  const proposed = s.kind !== 'certificate' && !hasDoc && !!s.date && ['preparing', 'scheduled', 'draft', 'awaiting-signature'].includes(s.status);
  const purpose = s.kind === 'certificate' ? s.purpose || s.godparents : '';
  const planned = s.kind === 'certificate' && s.requestedSacramentId ? SACRAMENTS.find(x => x.id === s.requestedSacramentId) : null;
  const dlRows = s.kind === 'certificate' ? [[L('Person', 'الشخص'), <><a href={`#/person/${p.id || ''}`}>{p.lat}</a><small className="dim" style={{
      display: "block",
      fontFamily: "var(--arabic)"
    }}>{p.ar}</small></>], [L('Certificate of', 'شهادة'), source ? kindLabel(source.kind) : planned ? <>{kindLabel(planned.kind)}{" "}<small className="dim">· {L('not celebrated yet', 'لم يُحتفل به بعد')}</small></> : s.certificateOf ? <>{certificateName(s.certificateOf)}{" "}<small className="dim">· {L('not linked to an entry yet', 'لم تُربط بقيد بعد')}</small></> : <span className="dim">{L('Not linked to an entry yet', 'لم تُربط بقيد بعد')}</span>], [L('Requested on', 'تاريخ الطلب'), fmtDate(s.date)], purpose ? [L('Purpose', 'الغاية'), purpose] : null, s.language ? [L('Language asked for', 'اللغة المطلوبة'), languageName(s.language)] : null, [L('Request reference', 'مرجع الطلب'), <span className="mono" dir="ltr">{s.reg}</span>], source ? [L('Register entry', 'القيد'), <a className="mono" dir="ltr" href={`#/certificate/${source.id}`}>{source.reg}</a>] : planned ? [L('Planned sacrament', 'السرّ المخطّط'), <a className="mono" dir="ltr" href={`#/certificate/${planned.id}`}>{planned.reg}</a>] : null] : [[L('Person', 'الشخص'), <><a href={`#/person/${p.id || ''}`}>{p.lat}</a><small className="dim" style={{
      display: "block",
      fontFamily: "var(--arabic)"
    }}>{p.ar}</small></>], [L('Sacrament', 'السرّ'), kindLabel(record.kind)], [record.date > today() ? L('Planned for', 'الموعد المقرّر') : L('Date', 'التاريخ'), record.date ? celebrationText(record) : L('Not set yet', 'لم يُحدَّد بعد')], [L('Celebrant', 'المحتفل'), nameIn(cel) || L('To be assigned', 'يُحدَّد لاحقاً')], record.godparents ? [L('Godparents / witnesses', 'الإشبين / الشهود'), record.godparents] : null, [L('Book / page', 'الدفتر / الصفحة'), `${record.book || '—'} / ${record.page || '—'}`], [official(s) ? L('Register entry', 'رقم القيد') : L('Reference', 'المرجع'), <span className="mono" dir="ltr">{s.reg}</span>], s.requestReference && s.requestReference !== s.reg ? [L('Request reference', 'مرجع الطلب'), <span className="mono" dir="ltr">{s.requestReference}</span>] : null, record.externalParish ? [L('Other parish', 'رعية أخرى'), record.externalParish] : null, record.externalReference ? [L('Their reference', 'مرجعها'), record.externalReference] : null, s.partner ? [L('Future spouse', 'الشريك'), <>{s.partner}{s.partnerParish ? <small className="dim">· {s.partnerParish}</small> : ''}</>] : null];
  if (s.memberReference) dlRows.push([L('Sent online', 'أُرسل إلكترونياً'), <><span className="mono" dir="ltr">{s.memberReference}</span>{" "}<small className="dim">· {L('member portal', 'بوّابة المؤمنين')}</small></>], s.contactPhone ? [L('Phone for this request', 'هاتف هذا الطلب'), telLink(s.contactPhone)] : null);
  if (s.bishopReview) dlRows.push([L('Bishop acceptance', 'قبول المطران'), s.bishopReview === 'pending' ? L('Awaiting bishop', 'بانتظار المطران') : s.bishopReview === 'accepted' ? L('Accepted', 'مقبولة') : L('Returned to priest', 'أُعيدت للكاهن')]);
  const details = <Panel title={L('Details', 'التفاصيل')}><dl className="dl">{dlRows.filter(Boolean).map(([k, v]) => <><dt>{k}</dt><dd>{v}</dd></>)}</dl>{" "}{s.requestNotes ? <p className="t-caption" style={{
      marginTop: "14px"
    }}><b>{L('From the family', 'من العائلة')}:</b>{" "}{s.requestNotes}</p> : ''}{" "}{s.pendingAmendment ? <div className="alert alert-warning" style={{
      marginTop: "14px"
    }}><b>{L('Amendment awaiting priest decision', 'تعديل بانتظار قرار الكاهن')}</b><br />{s.pendingAmendment.reason}<br />{L('Requested date', 'التاريخ المطلوب')}: {s.pendingAmendment.date || '—'} · {L('Notes', 'ملاحظات')}: {s.pendingAmendment.notes || '—'}</div> : ''}</Panel>;
  const people = [[L('Request accepted by', 'قبل الطلب'), s.requestApprovedBy, s.requestApprovedAt], [L('Approved by', 'اعتمده'), s.approvedBy, s.approvedAt], [L('Issued by', 'أصدره'), s.issuedBy, s.issuedAt]].filter(([, by]) => by);
  const activity = <Panel title={L('Activity', 'النشاط')}>{<>{people.length ? <dl className="dl" style={{
        marginBottom: "14px"
      }}>{people.map(([k, by, at]) => <><dt>{k}</dt><dd>{by}<small className="dim" style={{
              display: "block"
            }}>{when(at)}</small></dd></>)}</dl> : ''}{" "}{(s.history || []).length ? <div className="timeline">{s.history.slice().reverse().map(h => <div className="tl-item"><div className="when">{when(h.at)}</div>{" "}<div className="what">{histLabel(h.action)}{h.by ? ` · ${h.by}` : ''}{h.via === 'portal' ? ` · ${L('online', 'إلكترونياً')}` : ''}{h.source ? <> · <span className="mono" dir="ltr">{h.source}</span></> : ''}{h.reason ? <small className="dim" style={{
              display: "block"
            }}>{h.reason}</small> : ''}{h.before && h.after ? <small className="dim" style={{
              display: "block"
            }}>{L('Date', 'التاريخ')}: {h.before.date || '—'} → {h.after.date || '—'} · {L('Notes', 'ملاحظات')}: {h.before.notes || '—'} → {h.after.notes || '—'}</small> : ''}</div></div>)}</div> : <p className="t-caption dim">{L('Nothing recorded yet.', 'لا شيء مسجَّل بعد.')}</p>}</>}</Panel>;
  return <><PageHead crumbs={[{
      label: L('Records', 'السجلات')
    }, {
      label: asRequest ? L('Requests', 'الطلبات') : L('Sacraments', 'الأسرار'),
      href: asRequest ? '#/requests' : '#/sacraments'
    }, {
      label: s.reg
    }]} title={kindLabel(s.kind)} sub={<><bdi>{nameIn(p)}</bdi> · <bdi className="mono" dir="ltr">{s.reg}</bdi>{s.date ? <> · <bdi>{s.kind === 'certificate' ? fmtDate(s.date) : celebrationText(s)}</bdi></> : ''}{onlineMark(s)}</>} actions={<>{s.kind !== 'certificate' && ['requested', 'office-reviewed'].includes(s.status) && is('priest') ? <><button className="btn btn-primary" id="acceptrequest"><Icon name='check' size={17} />{L('Accept request', 'قبول الطلب')}</button><button className="btn btn-secondary" id="declinerequest">{L('Decline', 'رفض')}</button></> : s.kind !== 'certificate' && s.status === 'requested' && is('secretary', 'super_admin', 'bishop', 'diocesan_admin', 'parish_admin') ? <button className="btn btn-primary" id="officereview"><Icon name='check' size={17} />{L('Mark as reviewed by the office', 'تعليم كمراجَع من المكتب')}</button> : s.kind !== 'certificate' && s.status === 'preparing' ? <a className="btn btn-primary" href="#/sacraments">{L('Continue preparation', 'متابعة التحضير')}</a> : s.kind === 'certificate' && !source && s.requestedSacramentId && ['draft', 'awaiting-signature'].includes(s.status) ? <a className="btn btn-primary" href={`#/certificate/${s.requestedSacramentId}`}><Icon name='sacr' size={17} />{L('Open the planned sacrament', 'افتح السرّ المخطّط له')}</a> : s.kind === 'certificate' && !source && ['draft', 'awaiting-signature'].includes(s.status) && eligibleSources(s.person).length && is('priest', 'secretary') ? <button className="btn btn-primary" id="linksource"><Icon name='link' size={17} />{L('Link register entry', 'ربط القيد')}</button> : s.kind === 'certificate' && !source && ['draft', 'awaiting-signature'].includes(s.status) && is('priest', 'secretary') ? <a className="btn btn-secondary" href={`#/person/${s.person}/sacraments`}><Icon name='sacr' size={17} />{L('See this person’s sacraments', 'عرض أسرار هذا الشخص')}</a> : is('priest') && s.status === 'awaiting-signature' && (s.kind === 'certificate' ? !!source : s.date <= today()) ? <button className="btn btn-primary" id="approve"><Icon name='check' size={17} />{s.kind === 'certificate' ? L('Approve request', 'اعتماد الطلب') : L('Approve entry', 'اعتماد القيد')}</button> : is('priest') && s.kind === 'certificate' && s.status === 'approved' ? <button className="btn btn-primary" id="sign"><Icon name='check' size={17} />{L('Sign and issue', 'التوقيع والإصدار')}</button> : s.kind !== 'certificate' && s.status === 'registered' ? <button className="btn btn-secondary" id="startcertreq"><Icon name='doc' size={17} />{L('Request a certificate', 'طلب شهادة')}</button> : is('secretary', 'priest') && ['draft', 'scheduled'].includes(s.status) && (s.kind === 'certificate' ? !!source : s.date <= today()) ? <button className="btn btn-primary" id="submit"><Icon name='send' size={17} />{s.status === 'scheduled' ? L('Confirm celebrated and send for approval', 'تأكيد الاحتفال وإرساله للاعتماد') : L('Send to the priest', 'إرسال إلى الكاهن')}</button> : ''}{" "}{s.kind !== 'certificate' && ['draft', 'scheduled'].includes(s.status) && is('secretary', 'priest') ? <button className="btn btn-secondary" id="editentry"><Icon name='edit' size={17} />{L('Edit details', 'تعديل التفاصيل')}</button> : ''}{" "}{s.kind !== 'certificate' && s.requestApprovedAt && ['preparing', 'scheduled', 'draft', 'awaiting-signature'].includes(s.status) && is('secretary', 'priest') && !s.pendingAmendment ? <button className="btn btn-secondary" id="amendrequest">{L('Propose request amendment', 'اقتراح تعديل الطلب')}</button> : ''}{" "}{s.pendingAmendment && is('priest') ? <><button className="btn btn-primary" id="approveamend">{L('Approve amendment', 'اعتماد التعديل')}</button><button className="btn btn-secondary" id="rejectamend">{L('Reject amendment', 'رفض التعديل')}</button></> : ''}{" "}{s.status === 'awaiting-signature' && is('priest') ? <button className="btn btn-secondary" id="reject">{L('Reject', 'رفض')}</button> : ''}{" "}{s.kind === 'certificate' && ['draft', 'awaiting-signature'].includes(s.status) && is('secretary', 'priest') ? <button className="btn btn-ghost" id="cancelrequest">{L('Cancel request', 'إلغاء الطلب')}</button> : ''}</>} />{" "}{s.bishopReview === 'returned' ? <div className="alert alert-warning"><b>{L('Returned by the bishop', 'أعادها المطران')}</b><p>{s.bishopReviewNote || ''}</p>{is('priest') ? <button className="btn btn-primary" id="resubmit-bishop">{L('Review and resubmit', 'مراجعة وإعادة تقديم')}</button> : ''}</div> : ''}{" "}{progressPanel(s)}{" "}{s.kind !== 'certificate' && s.status === 'scheduled' && s.date > today() ? <C.InlineAlert tone='info' title={L('Scheduled, not celebrated yet', 'مجدول ولم يُحتفل به بعد')} body={L(`On or after ${fmtDate(s.date)}, confirm it was celebrated and send it to the priest for approval.`, `في ${fmtDate(s.date)} أو بعده، أكّد الاحتفال وأرسله إلى الكاهن للاعتماد.`)} /> : ''}{" "}<div className="recordview"><div className="recordmain">{hasDoc ? docCard(s, lang) : proposed ? <Panel title={L('Proposed register preview · not official', 'معاينة القيد المقترح · غير رسمي')}><div className="doccard-b"><div className="docthumb" aria-label={L('Proposed register entry', 'القيد المقترح')}>{certificateSVG(s, lang)}</div><div className="docmeta"><p className="alert alert-warning">{L('For checking details before celebration only. This is not an official register entry or certificate. The priest must approve the celebrated sacrament before it becomes official.', 'لمراجعة التفاصيل قبل الاحتفال فقط. هذا ليس قيداً رسمياً أو شهادة. يجب أن يعتمد الكاهن السر المحتفل به ليصبح رسمياً.')}</p></div></div></Panel> : <Panel title={s.kind === 'certificate' ? L('Certificate', 'الشهادة') : L('Register entry', 'قيد السجل')}><div className="docempty"><Icon name='doc' size={22} /><p>{s.kind === 'certificate' && ['cancelled', 'rejected'].includes(s.status) ? L('This request was closed, so no certificate was made.', 'أُغلق هذا الطلب، فلم تُنشأ شهادة.') : s.kind === 'certificate' ? s.requestedSacramentId ? L('This certificate is for a sacrament that has not been celebrated and approved yet. It links itself as soon as the priest approves that entry; the certificate can then be previewed here.', 'هذه الشهادة لسرّ لم يُحتفل به ولم يُعتمد بعد. ترتبط به تلقائياً حين يعتمد الكاهن قيده، ثم يمكن معاينتها هنا.') : eligibleSources(s.person).length ? L('Link the approved entry this certificate is taken from; it can then be previewed here and the priest can approve it.', 'اربط القيد المعتمد الذي تؤخذ منه هذه الشهادة؛ ثم يمكن معاينتها هنا ويعتمدها الكاهن.') : L('There is no approved entry for this person yet. Record the sacrament and have it approved first; the certificate is then linked to it and can be previewed here.', 'لا قيد معتمداً لهذا الشخص بعد. سجّل السرّ واعتمده أولاً، ثم تُربط الشهادة به ويمكن معاينتها هنا.') : ['cancelled', 'rejected'].includes(s.status) ? L('This request was closed, so there is no register entry.', 'أُغلق هذا الطلب، فلا قيد له.') : L('The register entry can be previewed once the sacrament is celebrated and approved by the priest.', 'يمكن معاينة القيد بعد الاحتفال بالسرّ واعتماد الكاهن له.')}</p></div></Panel>}{" "}{details}{" "}<RequestDocuments record={s} scope="sacrament-request" onChange={() => bus.refresh()} /></div>{" "}<aside className="sidecol">{activity}</aside></div></>;
}
certificate.mount = (host, id, lang = '') => {
  const doc = SACRAMENTS.find(x => x.id === id);
  lang = docLang(doc, lang);
  host.querySelectorAll('[data-docview]').forEach(b => b.addEventListener('click', () => viewDoc(doc, lang)));
  host.querySelector('[data-docdl]')?.addEventListener('click', e => downloadMenu(e.currentTarget, doc, () => lang));
  host.querySelector('[data-docprint]')?.addEventListener('click', () => printDoc(doc, lang));
  host.querySelector('#amendrequest')?.addEventListener('click', () => openDrawer({
    title: L('Propose a request amendment', 'اقتراح تعديل الطلب'),
    sub: L('The accepted request stays unchanged until a priest approves this amendment. The reason and decision remain in its history.', 'يبقى الطلب المقبول بلا تغيير حتى يعتمد الكاهن التعديل. يبقى السبب والقرار في السجل.'),
    body: <>{<C.Field label={L('Requested date', 'التاريخ المطلوب')} id='amend_date' type='date' value={doc.requestedDate || ''} />}{" "}{<C.Textarea label={L('Family request / notes', 'طلب العائلة / ملاحظات')} id='amend_notes' value={doc.requestNotes || ''} max={500} />}{" "}{<C.Textarea label={L('Reason for amendment', 'سبب التعديل')} id='amend_reason' max={500} />}</>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="amend_save">{L('Send for priest decision', 'إرسال لقرار الكاهن')}</button></>,
    onMount(el) {
      el.querySelector('#amend_save').addEventListener('click', async () => {
        if (!need(el, '#amend_reason', L('Enter a reason', 'أدخل السبب'))) return;
        try {
          await serverWorkflow('propose-request-amendment', id, {
            date: el.querySelector('#amend_date').value,
            notes: el.querySelector('#amend_notes').value.trim(),
            reason: el.querySelector('#amend_reason').value.trim()
          });
          closeOverlays();
          bus.refresh();
          toast(L('Amendment proposed', 'اقتُرح التعديل'), '', 'success');
        } catch (e) {
          toast(L('Could not propose amendment', 'تعذّر اقتراح التعديل'), e.message, 'danger');
        }
      });
    }
  }));
  host.querySelector('#approveamend')?.addEventListener('click', async () => {
    try {
      await serverWorkflow('approve-request-amendment', id);
      bus.refresh();
      toast(L('Amendment approved', 'اعتُمد التعديل'), '', 'success');
    } catch (e) {
      toast(L('Could not approve amendment', 'تعذّر اعتماد التعديل'), e.message, 'danger');
    }
  });
  host.querySelector('#rejectamend')?.addEventListener('click', () => openModal({
    title: L('Reject request amendment?', 'رفض تعديل الطلب؟'),
    body: <C.Textarea label={L('Reason (optional)', 'السبب (اختياري)')} id='amend_reject_reason' max={500} />,
    foot: <><button className="btn btn-secondary" data-close="">{L('Keep pending', 'إبقاء معلقاً')}</button><button className="btn btn-primary" id="amend_reject_confirm">{L('Reject amendment', 'رفض التعديل')}</button></>,
    onMount(el) {
      el.querySelector('#amend_reject_confirm').addEventListener('click', async () => {
        try {
          await serverWorkflow('reject-request-amendment', id, {
            reason: el.querySelector('#amend_reject_reason').value.trim()
          });
          closeOverlays();
          bus.refresh();
        } catch (e) {
          toast(L('Could not reject amendment', 'تعذّر رفض التعديل'), e.message, 'danger');
        }
      });
    }
  }));
  host.querySelector('#officereview')?.addEventListener('click', async () => {
    try {
      await serverWorkflow('review-sacrament-request', id);
      bus.refresh();
      toast(L('Office review completed', 'اكتملت مراجعة المكتب'), L('The priest can now decide.', 'يمكن للكاهن اتخاذ القرار الآن.'), 'success');
    } catch (e) {
      toast(L('Review could not be saved', 'تعذّر حفظ المراجعة'), e.message, 'danger');
    }
  });
  host.querySelector('#acceptrequest')?.addEventListener('click', () => openModal({
    title: L('Accept this sacrament request?', 'قبول طلب السرّ؟'),
    sub: L('The request will move to Preparation. The priest may accept it without a secretary review.', 'سينتقل الطلب إلى التحضير. يمكن للكاهن قبوله من دون مراجعة الأمينة.'),
    body: <><p>{L('Confirm the person and sacrament before accepting.', 'تأكّد من الشخص والسرّ قبل القبول.')}</p>{doc?.memberRequestId ? <p className="or-shared"><Icon name='info' size={15} /><span>{L('The parishioner sent this request online and will be notified.', 'أرسل المؤمن هذا الطلب إلكترونياً وسيُبلَّغ بالقرار.')}</span></p> : ''}</>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Back', 'رجوع')}</button><button className="btn btn-primary" id="accept_confirm">{L('Accept request', 'قبول الطلب')}</button></>,
    onMount(el) {
      el.querySelector('#accept_confirm').addEventListener('click', async () => {
        try {
          await serverWorkflow('approve-sacrament-request', id);
          closeOverlays();
          bus.refresh();
          toast(L('Request accepted', 'قُبل الطلب'), L('Preparation can begin.', 'يمكن بدء التحضير.'), 'success');
        } catch (e) {
          toast(L('Could not accept request', 'تعذّر قبول الطلب'), e.message, 'danger');
        }
      });
    }
  }));
  host.querySelector('#declinerequest')?.addEventListener('click', () => openModal({
    title: L('Decline this sacrament request?', 'رفض طلب السرّ؟'),
    sub: L('The declined request stays in the completed history.', 'يبقى الطلب المرفوض في سجل الطلبات المكتملة.'),
    body: <><C.Textarea label={L('Reason', 'السبب')} id='decline_reason' max={500} />{sharedNote(doc)}</>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Back', 'رجوع')}</button><button className="btn btn-primary" id="decline_confirm">{L('Decline request', 'رفض الطلب')}</button></>,
    onMount(el) {
      el.querySelector('#decline_confirm').addEventListener('click', async () => {
        if (!need(el, '#decline_reason', L('Enter a reason', 'أدخل السبب'))) return;
        try {
          await serverWorkflow('decline-sacrament-request', id, {
            reason: el.querySelector('#decline_reason').value.trim()
          });
          closeOverlays();
          bus.refresh();
        } catch (e) {
          toast(L('Could not decline request', 'تعذّر رفض الطلب'), e.message, 'danger');
        }
      });
    }
  }));
  host.querySelector('#startcertreq')?.addEventListener('click', () => {
    S.ui.newCertificateSource = id;
    location.hash = '#/requests';
  });
  host.querySelector('#editentry')?.addEventListener('click', () => {
    const record = SACRAMENTS.find(s => s.id === id);
    if (!record || !['draft', 'scheduled'].includes(record.status)) return;
    openDrawer({
      title: L('Edit sacrament details', 'تعديل تفاصيل السرّ'),
      sub: L('Changes are kept in the record’s history. Once the priest approves the entry it can no longer be edited here.', 'تُحفظ التعديلات في سجل القيد. بعد أن يعتمد الكاهن القيد لا يمكن تعديله من هنا.'),
      body: <><div className="formgrid"><C.Field label={L('Celebration date', 'تاريخ الاحتفال')} id='edit_date' type='date' value={record.date} req={true} />{timeSelect('edit_time', record.time || '')}</div><div className="formgrid"><div className="formrow"><label className="label" htmlFor="edit_celebrant">{L('Celebrant', 'المحتفل')}</label><Select id="edit_celebrant"><option value="">{L('To be assigned', 'يُحدّد لاحقاً')}</option>{PEOPLE.filter(p => p.status === 'clergy' || p.id === record.celebrant).map(p => <option value={p.id} selected={!!(p.id === record.celebrant)}>{isAr() ? p.ar : p.lat}</option>)}</Select></div></div>{" "}<div className="formgrid"><C.Field label={L('Book', 'الدفتر')} id='edit_book' value={record.book || ''} /><C.Field label={L('Page', 'الصفحة')} id='edit_page' value={record.page || ''} /></div>{" "}<C.Field label={L('Godparents / witnesses', 'الإشبين / الشهود')} id='edit_godparents' value={record.godparents || ''} />{" "}<div className="formgrid"><C.Field label={L('Father', 'الأب')} id='edit_father' value={record.father || ''} /><C.Field label={L('Mother', 'الأم')} id='edit_mother' value={record.mother || ''} /></div>{" "}<C.Field label={L('Place', 'المكان')} id='edit_place' value={record.place || ''} />{" "}<div className="formgrid"><C.Field label={L('External parish', 'الرعية الخارجية')} id='edit_externalParish' value={record.externalParish || ''} /><C.Field label={L('External reference', 'المرجع الخارجي')} id='edit_externalReference' value={record.externalReference || ''} /></div></>,
      foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="edit_save">{L('Save changes', 'حفظ التعديلات')}</button></>,
      onMount(el) {
        el.querySelector('#edit_save').addEventListener('click', async () => {
          if (!need(el, '#edit_date', L('Enter a date', 'أدخل التاريخ'))) return;
          const fields = Object.fromEntries(['date', 'time', 'celebrant', 'book', 'page', 'godparents', 'father', 'mother', 'place', 'externalParish', 'externalReference'].map(k => [k, el.querySelector('#edit_' + k).value.trim()]));
          try {
            await serverWorkflow('update-entry', id, {
              fields
            });
            closeOverlays();
            bus.refresh();
            toast(L('Details updated', 'حُدّثت التفاصيل'), L('The workflow and activity history were updated.', 'حُدّث المسار وسجل النشاط.'), 'success');
          } catch (e) {
            toast(L('Could not update entry', 'تعذّر تعديل القيد'), e.message, 'danger');
          }
        });
      }
    });
  });
  host.querySelector('#linksource')?.addEventListener('click', () => {
    const request = SACRAMENTS.find(s => s.id === id);
    const sources = SACRAMENTS.filter(s => s.person === request?.person && s.kind !== 'certificate' && ['registered', 'issued'].includes(s.status));
    openDrawer({
      title: L('Link the register entry', 'ربط القيد'),
      sub: L('Choose the approved entry this certificate is taken from. The link is kept in the request’s history.', 'اختر القيد المعتمد الذي تؤخذ منه هذه الشهادة. يُحفظ الربط في سجل الطلب.'),
      body: sources.length ? <div className="formrow"><label className="label" htmlFor="link_source">{L('Approved entry', 'القيد المعتمد')}</label><Select id="link_source">{sources.map(s => <option value={s.id}>{s.reg} · {kindLabel(s.kind)}</option>)}</Select></div> : <C.InlineAlert tone='warning' title={L('No eligible register entry', 'لا قيد مؤهّل')} body={L('Register and approve the sacrament before linking this request.', 'سجّل السرّ واعتمده قبل ربط هذا الطلب.')} />,
      foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button><button className="btn btn-primary" id="link_save" disabled={!sources.length}>{L('Link entry', 'ربط القيد')}</button></>,
      onMount(el) {
        el.querySelector('#link_save')?.addEventListener('click', async () => {
          try {
            await serverWorkflow('link-source', id, {
              sourceRecordId: el.querySelector('#link_source').value
            });
            closeOverlays();
            bus.refresh();
            toast(L('Entry linked', 'رُبط القيد'), L('The certificate can now be previewed and sent to the priest.', 'يمكن الآن معاينة الشهادة وإرسالها إلى الكاهن.'), 'success');
          } catch (e) {
            toast(L('Could not link source', 'تعذّر ربط المصدر'), e.message, 'danger');
          }
        });
      }
    });
  });
  const confirm = (button, action) => button?.addEventListener('click', () => openModal({
    title: action === 'approve' ? SACRAMENTS.find(s => s.id === id)?.kind === 'certificate' ? L('Approve this certificate request?', 'اعتماد طلب الشهادة؟') : L('Approve this register entry?', 'اعتماد هذا القيد؟') : L('Sign and issue this certificate?', 'توقيع هذه الشهادة وإصدارها؟'),
    sub: L('This action is recorded with your account and the time. Check the original register before confirming.', 'يُسجّل هذا الإجراء باسم حسابك ووقته. راجع السجل الأصلي قبل التأكيد.'),
    body: <>{action === 'issue' ? '<div class="sig-issue" data-sig-issue><p class="help">' + L('Loading your signature…', 'جارٍ تحميل توقيعك…') + '</p></div>' : ''}<label className="check"><input type="checkbox" id="ack" />{" "}<span>{L('I have checked the register entry against the bound book.', 'راجعتُ القيد مقابل الدفتر الأصلي.')}</span></label></>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Cancel', 'إلغاء')}</button>{" "}<button className="btn btn-primary" id="confirm" disabled>{action === 'approve' ? SACRAMENTS.find(s => s.id === id)?.kind === 'certificate' ? L('Approve request', 'اعتماد الطلب') : L('Approve entry', 'اعتماد القيد') : L('Sign and issue', 'التوقيع والإصدار')}</button></>,
    onMount(el) {
      const ack = el.querySelector('#ack'),
        ok = el.querySelector('#confirm');
      let ready = action !== 'issue';
      ack.addEventListener('change', () => {
        ok.disabled = !ack.checked || !ready;
      });
      /* Issuing is signing: the priest's own signature, unlocked with their passkey over this certificate. */
      if (action === 'issue') api('account/signature').then(data => {
        const box = el.querySelector('[data-sig-issue]');
        if (!box) return;
        ready = !!data.signer;
        paint(box, data.signer ? <><figure className="sig-card is-small"><Drawing path={data.signer.drawing} /><figcaption><b>{session.user.name}</b>{data.signer.title ? <span>{data.signer.title}</span> : ''}</figcaption></figure>{" "}<p className="help"><Icon name='lock' size={15} />{L('You will be asked for your face, fingerprint or PIN. The certificate then carries your signature and a code anyone can check.', 'سيُطلب وجهك أو بصمتك أو رمزك. ثم تحمل الشهادة توقيعك ورمزاً يمكن لأي شخص التحقّق منه.')}</p></> : <C.InlineAlert tone='warning' title={L('Set up your signature first', 'أعدّ توقيعك أولاً')} body={<>{L('Certificates are signed with your own signature, kept with your passkey. Set it up under My account, then come back.', 'تُوقَّع الشهادات بتوقيعك الخاص المحفوظ مع مفتاح المرور. أعدّه في «حسابي» ثم عُد.')}<a href="#/account">{L('Open My account', 'فتح حسابي')}</a></>} />);
        ok.disabled = !ack.checked || !ready;
      }).catch(() => {});
      ok.addEventListener('click', async () => {
        try {
          const signature = action === 'issue' ? await sign({
            type: 'certificate',
            parish: session.parishId,
            id
          }) : null;
          await serverWorkflow(action, id, {
            verified: true,
            ...(signature ? {
              signature
            } : {})
          });
          closeOverlays();
          bus.refresh();
          const cert = SACRAMENTS.find(s => s.id === id)?.kind === 'certificate';
          toast(action === 'issue' ? L('Certificate issued', 'صدرت الشهادة') : cert ? L('Request approved', 'اعتُمد الطلب') : L('Entry approved', 'اعتُمد القيد'), action === 'issue' ? L('It is signed and has been sent for bishop acceptance before release.', 'تم توقيعها وإرسالها لقبول المطران قبل تسليمها.') : cert ? L('Next: sign and issue the certificate.', 'التالي: توقيع الشهادة وإصدارها.') : L('It now has its official register number.', 'صار له رقم القيد الرسمي.'), 'success');
        } catch (e) {
          toast(L('Action could not be completed', 'تعذّر إتمام الإجراء'), action === 'issue' ? passkeyMessage(e, L) : e.message, 'danger');
        }
      });
    }
  }));
  host.querySelector('#resubmit-bishop')?.addEventListener('click', () => openDrawer({
    title: L('Resubmit to the bishop', 'إعادة تقديم للمطران'),
    body: <form><label className="formrow"><span className="label">{L('How was the bishop’s note addressed?', 'كيف تمت معالجة ملاحظة المطران؟')}</span><textarea className="textarea" name="note" required minLength="3" maxLength="1000" /></label><label className="check"><input type="checkbox" required name="verified" />{L('I reviewed the certificate and its source register entry.', 'راجعت الشهادة وقيدها الأصلي.')}</label><p role="alert" className="help-error" /><button className="btn btn-primary">{L('Resubmit', 'إعادة تقديم')}</button></form>,
    onMount(el) {
      const f = el.querySelector('form');
      f.onsubmit = async e => {
        e.preventDefault();
        const b = f.querySelector('button');
        b.disabled = true;
        try {
          await api('workspace/certificate-resubmit', 'POST', {
            parish: session.parishId,
            id,
            revision: session.revision,
            note: f.elements.note.value,
            verified: f.elements.verified.checked
          });
          await hydrate();
          closeOverlays();
          bus.refresh();
        } catch (err) {
          f.querySelector('[role=alert]').textContent = err.message;
          b.disabled = false;
        }
      };
    }
  }));
  confirm(host.querySelector('#approve'), 'approve');
  confirm(host.querySelector('#sign'), 'issue');
  const decision = (selector, action) => host.querySelector(selector)?.addEventListener('click', () => openModal({
    title: action === 'reject' ? L('Reject this request or entry?', 'رفض هذا الطلب أو القيد؟') : L('Cancel this certificate request?', 'إلغاء طلب الشهادة؟'),
    sub: L('The decision and reason will remain in the activity history.', 'سيبقى القرار وسببه في سجل النشاط.'),
    body: <><C.Textarea label={L('Reason', 'السبب')} id='decision_reason' max={500} />{sharedNote(doc)}</>,
    foot: <><button className="btn btn-secondary" data-close="">{L('Keep open', 'إبقاؤه مفتوحاً')}</button><button className="btn btn-primary" id="decision_confirm">{action === 'reject' ? L('Reject', 'رفض') : L('Cancel request', 'إلغاء الطلب')}</button></>,
    onMount(el) {
      el.querySelector('#decision_confirm').addEventListener('click', async () => {
        if (!need(el, '#decision_reason', L('Enter a reason', 'أدخل السبب'))) return;
        try {
          await serverWorkflow(action, id, {
            verified: action === 'reject',
            reason: el.querySelector('#decision_reason').value.trim()
          });
          closeOverlays();
          bus.refresh();
          toast(L('Decision saved', 'حُفظ القرار'), L('The activity history was updated.', 'حُدّث سجل النشاط.'), 'success');
        } catch (e) {
          toast(L('Decision could not be saved', 'تعذّر حفظ القرار'), e.message, 'danger');
        }
      });
    }
  }));
  decision('#reject', 'reject');
  decision('#cancelrequest', 'cancel');
  host.querySelector('#submit')?.addEventListener('click', async () => {
    try {
      await serverWorkflow('submit', id);
      bus.refresh();
    } catch (e) {
      toast(L('Could not submit entry', 'تعذّر إرسال القيد'), e.message, 'danger');
    }
  });
};