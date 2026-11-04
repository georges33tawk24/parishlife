/* Sacrament preparation and the parish's requests list: what each request needs next, preparation
   progress, anniversaries and the register export. */
import { Select } from '../../ui/components.jsx';
import { t, isAr, fmtDate } from '../../../lib/i18n.js';
import { bus, S, save } from '../../model/store.js';
import { session } from '../../model/api.js';
import {
  Icon,
  PageHead,
  Panel,
  Who,
  Status,
  statusLabel,
  Pill,
  Table,
  Empty,
  openDrawer,
  openModal,
  closeOverlays,
  toast,
  Stat,
  TabBar
} from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { download } from '../../shell/actions.jsx';
import { need, needAll } from '../../shared/dialogs.jsx';
import { workflow as serverWorkflow } from '../../model/persist.js';
import { fileName } from '../../shared/print.js';
import {
  SACRAMENTS,
  anniversaryItems,
  PARISH,
  PREP_REQUIREMENTS,
  PEOPLE,
  person,
  RESERVATIONS,
  SERVICE_REQUESTS,
  PORTAL_REQUESTS,
  REQUEST_HISTORY,
  REGISTRATIONS,
  venue
} from '../../model/data.js';
import { onlineItems, onlineMark, sharedNote } from './online-requests.jsx';
import { occasionText } from '../../model/sacrament-requests.js';
import {
  KIND,
  celebrationText,
  eligibleSources,
  kindLabel,
  nameIn,
  nextStep,
  official,
  sourceFor,
  timeSelect,
  today
} from './records-shared.jsx';

const L = (en, ar) => t(en, ar);

const pendingSacraments = personId =>
  SACRAMENTS.filter(
    s =>
      s.kind !== 'certificate' &&
      ['requested', 'office-reviewed', 'preparing', 'draft', 'scheduled', 'awaiting-signature'].includes(s.status) &&
      (!personId || s.person === personId)
  );

/* Official entries are reached from the person's record and from Requests; there is no separate register page. */
const STABS = () => [
  ['', 'Preparation', 'التحضير'],
  ['anniversaries', 'Anniversaries', 'الذكريات', anniversaryItems().length]
];

const prepProgress = s => {
  const requirements = PREP_REQUIREMENTS[s.kind] || [];
  const required = requirements.map((item, index) => (item[2] ? index : -1)).filter(index => index >= 0);
  const complete = Array.isArray(s.preparation) ? required.filter(index => s.preparation[index]).length : 0;
  return required.length
    ? `${complete} / ${required.length} ${L('required', 'مطلوب')}`
    : L('No required checklist', 'لا متطلبات إلزامية');
};

/* The approved register as a spreadsheet: one row per official entry, both names, Western digits. */
function exportRegister() {
  const cell = v => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
  const head = [
    'Register entry',
    'Sacrament',
    'Name',
    'Arabic name',
    'Date',
    'Celebrant',
    'Book',
    'Page',
    'Godparents / witnesses',
    'Status'
  ];
  const rows = SACRAMENTS.filter(official).map(s => {
    const p = person(s.person),
      c = person(s.celebrant);
    return [
      s.reg,
      KIND[s.kind]?.[0] || s.kind,
      p?.lat,
      p?.ar,
      String(s.date || '').slice(0, 10),
      c?.lat || '',
      s.book,
      s.page,
      s.godparents,
      s.status
    ];
  });
  download(
    `register-${fileName(PARISH.name)}-${today()}.csv`,
    [head, ...rows].map(r => r.map(cell).join(',')).join('\n')
  );
  toast(
    L('Register exported', 'صُدّر السجل'),
    L(`${rows.length} approved entries`, `${rows.length} قيود معتمدة`),
    'success'
  );
}

/* below: anything drawn under the page heading (the Requests page's other queues). */
export function sacraments(tab = '', below = null) {
  if (['preparation', 'corrections', 'registers'].includes(tab)) tab = '';
  const head = (
    <>
      <PageHead
        crumbs={[
          { label: L('Records', 'السجلات') },
          { label: tab === 'requests' ? L('Requests', 'الطلبات') : L('Sacraments', 'الأسرار') }
        ]}
        title={
          tab === 'requests'
            ? L('Parish requests', 'طلبات الرعية')
            : tab === 'anniversaries'
              ? L('Sacrament anniversaries', 'ذكريات الأسرار')
              : L('Sacrament preparation', 'التحضير للأسرار')
        }
        sub={
          tab === 'requests'
            ? L(
                'Everything waiting on the parish office or the priest — certificates, sacraments, room bookings, services and portal requests — and what is already done.',
                'كل ما ينتظر مكتب الرعية أو الكاهن — الشهادات والأسرار وحجوزات القاعات والخدم وطلبات البوابة — وما أُنجز.'
              )
            : tab === 'anniversaries'
              ? L(
                  'Baptism, chrismation, first Communion and marriage anniversaries, taken from approved entries.',
                  'ذكريات المعمودية والميرون والمناولة الأولى والإكليل، مأخوذة من القيود المعتمدة.'
                )
              : L(
                  'Accepted sacrament requests: set the celebration date and work through what each sacrament needs beforehand.',
                  'طلبات الأسرار المقبولة: حدّد موعد الاحتفال وأنجز ما يحتاج إليه كل سرّ مسبقاً.'
                )
        }
        actions={
          tab === 'requests' ? (
            <>
              <button className="btn btn-secondary" id="newcertreq">
                <Icon name="plus" size={17} />
                {L('Certificate request', 'طلب شهادة')}
              </button>
              <button className="btn btn-primary" id="newsacreq">
                <Icon name="plus" size={17} />
                {L('Sacrament request', 'طلب سرّ')}
              </button>
            </>
          ) : (
            <button className="btn btn-secondary" id="sacexport">
              <Icon name="export" size={17} />
              {L('Export register (CSV)', 'تصدير السجل (CSV)')}
            </button>
          )
        }
      />
      {tab === 'requests' ? '' : <TabBar base="sacraments" items={STABS()} active={tab} />}
      {below}
    </>
  );
  if (tab === 'requests') {
    const items = [
      ...onlineItems(),
      ...SACRAMENTS.filter(s => s.kind === 'certificate').map(s => ({
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
      })),
      ...SACRAMENTS.filter(
        s =>
          s.kind !== 'certificate' &&
          (['requested', 'office-reviewed', 'awaiting-signature', 'rejected', 'cancelled'].includes(s.status) ||
            s.requestApprovedAt)
      ).map(s => ({
        category: 'sacrament',
        mark: onlineMark(s),
        title: `${kindLabel(s.kind)} · ${s.requestReference || s.reg}`,
        who: person(s.person),
        state:
          s.requestApprovedAt && !['awaiting-signature', 'rejected', 'cancelled'].includes(s.status)
            ? 'approved'
            : s.status,
        open: ['requested', 'office-reviewed', 'awaiting-signature'].includes(s.status),
        date: s.requestedAt || s.date,
        priority: '',
        owner: nextStep(s)[1],
        next:
          s.requestApprovedAt && !['awaiting-signature', 'rejected', 'cancelled'].includes(s.status)
            ? s.status === 'registered'
              ? L('Official record available', 'القيد الرسمي متاح')
              : L('Continue in Preparation', 'تابع التحضير')
            : nextStep(s)[0],
        href: `#/certificate/${s.id}`,
        ref: s.requestReference || s.reg
      })),
      ...RESERVATIONS.map(r => ({
        category: 'facility',
        mark: onlineMark(r),
        title: r.memberRequestId
          ? `${occasionText(r.title)} · ${L(venue(r.venue)?.name || '', venue(r.venue)?.ar || '')}`
          : L(r.title, r.titleAr),
        who: person(r.by),
        state: r.status,
        open: r.status === 'pending',
        date: r.date || r.at,
        priority: r.priority || '',
        owner: r.stage === 'priest' ? L('Priest', 'الكاهن') : L('Parish office', 'مكتب الرعية'),
        next:
          r.status === 'pending'
            ? r.stage === 'priest'
              ? L('Confirm or refuse the booking', 'تأكيد الحجز أو رفضه')
              : L('Review reservation', 'مراجعة الحجز')
            : L('Completed', 'مكتمل'),
        href: `#/reservations/${r.id}`,
        ref: r.ref || r.id
      })),
      ...SERVICE_REQUESTS.map(r => ({
        category: 'service',
        title: `${L(r.kind, r.kindAr)} · ${fmtDate(r.date)}`,
        who: person(r.by),
        state: r.status,
        open: !['celebrated', 'rejected'].includes(r.status),
        date: r.date,
        priority: r.priority || '',
        owner: L('Priest or service team', 'الكاهن أو فريق الخدمة'),
        next:
          r.prep === 'documents missing'
            ? L('Collect missing documents', 'استكمال المستندات الناقصة')
            : L('Review service request', 'مراجعة طلب الخدمة'),
        href: '#/services/requests/' + encodeURIComponent(r.id),
        ref: r.ref || r.id
      })),
      ...PORTAL_REQUESTS.map(r => ({
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
      })),
      ...REQUEST_HISTORY.map(r => ({
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
      })),
      ...REGISTRATIONS.filter(r => r.waiting > 0).map(r => ({
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
      }))
    ];
    const f = S.ui.requestFilter === 'open' ? 'action' : S.ui.requestFilter || 'action',
      cat = S.ui.requestCategory || '',
      owner = S.ui.requestOwner || '',
      date = S.ui.requestDate || '',
      priority = S.ui.requestPriority || '',
      state = S.ui.requestStatus || '';
    const needsAction = x => x.open && !x.waitingSource && !(x.category === 'certificate' && x.state === 'draft');
    const shown = items.filter(
      x =>
        (f === 'all' ||
          (f === 'action' && needsAction(x)) ||
          (f === 'waiting' && x.open && !needsAction(x)) ||
          (f === 'completed' && !x.open)) &&
        (!cat || x.category === cat) &&
        (!state || x.state === state) &&
        (!owner || x.owner === owner) &&
        (!date || String(x.date || '').slice(0, 10) >= date) &&
        (!priority || x.priority === priority)
    );
    const categories = [
      ['online', 'Online requests', 'الطلبات الإلكترونية'],
      ['certificate', 'Certificates', 'الشهادات'],
      ['sacrament', 'Sacrament requests', 'طلبات الأسرار'],
      ['facility', 'Facilities', 'المرافق'],
      ['service', 'Services', 'الخدمات'],
      ['portal', 'Portal', 'البوابة'],
      ['registration', 'Registrations', 'التسجيل']
    ].filter(([k]) => items.some(x => x.category === k));
    return (
      <>
        {head}
        <div className="tabbody">
          <div className="stats" style={{ margin: '0 0 16px' }}>
            <Stat
              k={L('Needs action', 'تحتاج إجراءً')}
              v={items.filter(needsAction).length}
              d={L('a decision or a step from the office or the priest', 'قرار أو خطوة من المكتب أو الكاهن')}
            />
            <Stat
              k={L('Waiting', 'بانتظار')}
              v={items.filter(x => x.open && !needsAction(x)).length}
              d={L('on a date, a document or another record', 'على موعد أو مستند أو قيد آخر')}
            />
            <Stat
              k={L('Completed', 'مكتملة')}
              v={items.filter(x => !x.open).length}
              d={L('approved, issued, declined or cancelled', 'معتمدة أو صادرة أو مرفوضة أو ملغاة')}
            />
          </div>{' '}
          <div className="toolbar" style={{ marginBottom: '10px', flexWrap: 'wrap' }}>
            <span className="seg" role="group">
              {[
                ['action', 'Needs action', 'تحتاج إجراءً'],
                ['waiting', 'Waiting', 'بانتظار'],
                ['completed', 'Completed', 'مكتملة'],
                ['all', 'All', 'الكل']
              ].map(([v, en, ar], i) => (
                <button key={i} aria-pressed={f === v} data-act={`request-filter:${v}`}>
                  {L(en, ar)}
                </button>
              ))}
            </span>{' '}
            <div className="grow" style={{ minWidth: '190px', maxWidth: '290px' }}>
              <C.SearchClear ph={L('Name or reference', 'الاسم أو المرجع')} id="requestsearch" data-find="" />
            </div>{' '}
            <Select
              defaultValue={cat}
              id="reqcategory"
              aria-label={L('Request category', 'فئة الطلب')}
              style={{ width: 'auto' }}
            >
              <option value="">{L('All categories', 'كل الفئات')}</option>
              {categories.map(([v, en, ar], i) => (
                <option key={i} value={v}>
                  {L(en, ar)}
                </option>
              ))}
            </Select>{' '}
            <Select
              defaultValue={state}
              id="reqstatus"
              aria-label={L('Request status', 'حالة الطلب')}
              style={{ width: 'auto' }}
            >
              <option value="">{L('Any status', 'كل الحالات')}</option>
              {[...new Set(items.map(x => x.state))].sort().map((v, i) => (
                <option key={i} value={v}>
                  {statusLabel(v)}
                </option>
              ))}
            </Select>{' '}
            <Select
              defaultValue={owner}
              id="reqowner"
              aria-label={L('Responsible role', 'الدور المسؤول')}
              style={{ width: 'auto' }}
            >
              <option value="">{L('All responsible roles', 'كل المسؤولين')}</option>
              {[...new Set(items.map(x => x.owner).filter(Boolean))].map((v, i) => (
                <option key={i} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </div>{' '}
          <div className="toolbar" style={{ marginBottom: '14px', flexWrap: 'wrap' }}>
            <label className="t-caption dim" htmlFor="reqdate">
              {L('Date since', 'التاريخ منذ')}
            </label>
            <input className="input" id="reqdate" type="date" defaultValue={date} style={{ width: 'auto' }} />
            {items.some(x => x.priority) ? (
              <Select
                defaultValue={priority}
                id="reqpriority"
                aria-label={L('Priority', 'الأولوية')}
                style={{ width: 'auto' }}
              >
                <option value="">{L('Any priority', 'أي أولوية')}</option>
                {[...new Set(items.map(x => x.priority).filter(Boolean))].map((v, i) => (
                  <option key={i} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            ) : (
              ''
            )}
            <span className="t-caption dim">
              {shown.length} {L('shown', 'معروض')}
            </span>
            {cat || state || owner || date || priority ? (
              <button className="btn btn-ghost btn-dense" id="reqclear">
                {L('Clear filters', 'مسح المرشّحات')}
              </button>
            ) : (
              ''
            )}
          </div>{' '}
          <Table
            cols={[
              { label: L('Type / reference', 'النوع / المرجع') },
              { label: L('Person / subject', 'الشخص / الموضوع') },
              { label: L('Submitted / date', 'التقديم / التاريخ'), cls: 'hide-md' },
              { label: L('Status', 'الحالة') },
              { label: L('Next action', 'الخطوة التالية') },
              { label: L('Responsible', 'المسؤول'), cls: 'hide-md' },
              { label: '', cls: 'shrink' }
            ]}
            rows={shown.map(x => ({
              attrs: 'data-find-item',
              cells: [
                <>
                  <b>{x.title}</b>
                  {x.online ? (
                    <span className="or-mark">
                      <Icon name="globe" size={12} />
                      {L('Online', 'إلكتروني')}
                    </span>
                  ) : (
                    x.mark || ''
                  )}
                  {x.ref ? (
                    <small className="t-caption dim mono" style={{ display: 'block' }} dir="ltr">
                      {x.ref}
                    </small>
                  ) : (
                    ''
                  )}
                </>,
                x.who ? <Who p={x.who} /> : '—',
                fmtDate(x.date || ''),
                x.waitingSource ? (
                  <Pill label={L('Waiting for official entry', 'بانتظار قيد رسمي')} tone="warning" />
                ) : x.state === 'draft' && x.category === 'certificate' ? (
                  <Pill label={L('Request received', 'استُلم الطلب')} tone="info" />
                ) : x.state === 'legacy' ? (
                  <Pill label={L('Needs linked record', 'يحتاج قيداً مرتبطاً')} tone="warning" />
                ) : (
                  <Status k={x.state} />
                ),
                <b>{x.next}</b>,
                x.owner,
                <span className="row" style={{ gap: '6px' }}>
                  {x.portalId ? (
                    <button className="btn btn-secondary btn-dense" data-act={`portal-compare:${x.portalId}`}>
                      {L('Review', 'مراجعة')}
                    </button>
                  ) : x.historyId ? (
                    <button className="btn btn-secondary btn-dense" data-request-history={x.historyId}>
                      {L('View', 'عرض')}
                    </button>
                  ) : x.state === 'legacy' ? (
                    <span className="t-caption dim">{L('Legacy record', 'قيد قديم')}</span>
                  ) : (
                    <a className="btn btn-secondary btn-dense" href={x.href}>
                      {L('View', 'عرض')}
                    </a>
                  )}
                </span>
              ]
            }))}
            empty={
              <Empty
                glyph="check"
                title={L('No requests match', 'لا طلبات مطابقة')}
                body={L('Clear a filter or create a request.', 'امسح مرشّحاً أو أنشئ طلباً.')}
              />
            }
          />{' '}
          <div className="find-empty" hidden>
            <Empty
              glyph="search"
              title={L('No matching request', 'لا طلب مطابق')}
              body={L('Try a parishioner name or reference number.', 'جرّب اسم الشخص أو رقم المرجع.')}
            />
          </div>
        </div>
      </>
    );
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
    const items = anniversaryItems().map((a, index) => ({ ...a, index }));
    const renderTable = rows => (
      <Table
        cols={[
          { label: L('Person or couple', 'الشخص أو الزوجان') },
          { label: L('Sacrament', 'السرّ') },
          { label: L('Years', 'السنوات'), cls: 'num' },
          { label: L('Date', 'التاريخ') },
          { label: '', cls: 'shrink' }
        ]}
        rows={rows.map(a => ({
          cells: [
            <b>{isAr() ? a.ar : a.couple}</b>,
            <span>
              {kindLabel(a.kind)}
              {a.source === 'legacy' ? <small className="dim">{L('legacy', 'قديم')}</small> : ''}
            </span>,
            <span className="num">{a.years}</span>,
            <span className="mono dim">{fmtDate(a.on)}</span>,
            <button className="btn btn-secondary btn-dense" data-act={`greet:${a.index}`}>
              <Icon name="msg" size={15} />
              {L('Send greeting', 'إرسال تهنئة')}
            </button>
          ]
        }))}
        empty={
          <Empty
            glyph="sacr"
            title={L('No anniversaries', 'لا ذكريات')}
            body={L('Anniversaries appear when register entries are available.', 'تظهر الذكريات عند توفّر قيود السجل.')}
          />
        }
      />
    );
    return (
      <>
        {head}
        <div className="tabbody">
          <div className="toolbar anniversary-toolbar">
            <span className="t-ui">{L('Display anniversaries', 'عرض الذكريات')}</span>
            <div className="seg" role="group" aria-label={L('Anniversary layout', 'طريقة عرض الذكريات')}>
              <button data-anniversary-layout="combined" aria-pressed={layout === 'combined'}>
                {L('Combined table', 'جدول موحّد')}
              </button>
              <button data-anniversary-layout="grouped" aria-pressed={layout === 'grouped'}>
                {L('By sacrament', 'بحسب السرّ')}
              </button>
            </div>
          </div>{' '}
          {layout === 'combined' || !items.length
            ? renderTable(items)
            : [...new Set(items.map(a => a.kind))].map((kind, i) => (
                <Panel key={i} title={kindLabel(kind)} tight={true}>
                  {renderTable(items.filter(a => a.kind === kind))}
                </Panel>
              ))}{' '}
          <p className="t-caption dim" style={{ marginTop: '16px' }}>
            {L(
              'Baptism, chrismation, first Communion, and marriage anniversaries are derived from their registers. Earlier marriage reminders are labeled as legacy entries until linked to a register.',
              'تُستخرج ذكريات المعمودية والميرون والمناولة الأولى والإكليل من سجلاتها. وتبقى ذكريات الإكليل السابقة قيوداً قديمة حتى ربطها بسجل.'
            )}
          </p>
        </div>
      </>
    );
  }
  const entries = SACRAMENTS.filter(
    s => s.kind !== 'certificate' && ['preparing', 'scheduled', 'draft'].includes(s.status)
  );
  return (
    <>
      {head}
      <div className="tabbody">
        <C.InlineAlert
          tone="info"
          title={L('Preparation follows priest approval', 'يبدأ التحضير بعد موافقة الكاهن')}
          body={L(
            'Start with a sacrament request. The priest may accept it directly; then the parish office completes preparation before the celebration.',
            'ابدأ بطلب سرّ. يمكن للكاهن قبوله مباشرة، ثم يُكمل مكتب الرعية التحضير قبل الاحتفال.'
          )}
        />{' '}
        <div className="toolbar" style={{ margin: '16px 0' }}>
          <button className="btn btn-primary" id="newsacreq">
            <Icon name="plus" size={16} />
            {L('New sacrament request', 'طلب سرّ جديد')}
          </button>
        </div>{' '}
        <Table
          cols={[
            { label: L('Person', 'الشخص') },
            { label: L('Sacrament', 'السرّ') },
            { label: L('Celebration date', 'تاريخ الاحتفال') },
            { label: L('Preparation', 'التحضير') },
            { label: L('Status', 'الحالة') },
            { label: '', cls: 'shrink' }
          ]}
          rows={entries.map(s => ({
            attrs: 'data-find-item',
            cells: [
              <Who p={person(s.person)} />,
              kindLabel(s.kind),
              s.date ? celebrationText(s) : L('Set date', 'حدّد التاريخ'),
              prepProgress(s),
              <Status k={s.status} />,
              <span className="row" style={{ gap: '6px' }}>
                <a className="btn btn-secondary btn-dense" href={`#/certificate/${s.id}`}>
                  {L('View', 'عرض')}
                </a>
                {s.status === 'draft' ? (
                  ''
                ) : (
                  <>
                    <button className="btn btn-secondary btn-dense" data-prep-edit={s.id}>
                      {L('Edit', 'تعديل')}
                    </button>
                    <button className="btn btn-ghost btn-dense" data-prep-cancel={s.id}>
                      {L('Cancel', 'إلغاء')}
                    </button>
                  </>
                )}
              </span>
            ]
          }))}
          empty={
            <Empty
              glyph="sacr"
              title={L('No active preparations', 'لا تحضيرات جارية')}
              body={L('Approved sacrament requests will appear here.', 'ستظهر هنا طلبات الأسرار المعتمدة.')}
            />
          }
        />{' '}
        <details style={{ marginTop: '20px' }}>
          <summary>{L('Preparation requirements by sacrament', 'متطلبات التحضير بحسب السرّ')}</summary>
          <div className="grid g2" style={{ marginTop: '16px' }}>
            {Object.entries(PREP_REQUIREMENTS).map(([k, reqs], i) => (
              <Panel key={i} title={kindLabel(k)}>
                {reqs.map(([en, ar], i) => (
                  <div key={i} className="listrow">
                    <Icon name="check" size={15} />
                    {L(en, ar)}
                  </div>
                ))}
              </Panel>
            ))}
          </div>
        </details>
      </div>
    </>
  );
}

sacraments.mount = host => {
  host.querySelectorAll('[data-anniversary-layout]').forEach(button =>
    button.addEventListener('click', () => {
      S.ui.anniversaryLayout = button.dataset.anniversaryLayout;
      S.ui.anniversaryLayoutUser = session.user?.id;
      save(`pl-anniversaries-${session.user?.id || 'user'}`, S.ui.anniversaryLayout);
      bus.refresh();
    })
  );
  for (const [selector, key] of [
    ['#reqcategory', 'requestCategory'],
    ['#reqstatus', 'requestStatus'],
    ['#reqowner', 'requestOwner'],
    ['#reqdate', 'requestDate'],
    ['#reqpriority', 'requestPriority']
  ])
    host.querySelector(selector)?.addEventListener('change', e => {
      S.ui[key] = e.target.value;
      bus.refresh();
    });
  host.querySelector('#reqclear')?.addEventListener('click', () => {
    for (const key of ['requestCategory', 'requestStatus', 'requestOwner', 'requestDate', 'requestPriority'])
      S.ui[key] = '';
    bus.refresh();
  });
  host.querySelector('#sacexport')?.addEventListener('click', exportRegister);
  host.querySelectorAll('[data-request-history]').forEach(button =>
    button.addEventListener('click', () => {
      const item = REQUEST_HISTORY.find(r => r.id === button.dataset.requestHistory);
      if (!item) return;
      openModal({
        title: L(item.title, item.titleAr),
        body: (
          <>
            <p>
              <Status k={item.status} /> · {fmtDate(item.at)}
            </p>
            <p>{nameIn(person(item.by))}</p>
          </>
        ),
        foot: (
          <button className="btn btn-secondary" data-close="">
            {L('Close', 'إغلاق')}
          </button>
        )
      });
    })
  );
  host.querySelector('#newcertreq')?.addEventListener('click', () => {
    const sources = eligibleSources(),
      pending = pendingSacraments();
    const selected = S.ui.newCertificateSource || '';
    S.ui.newCertificateSource = '';
    const initial = sources.find(s => s.id === selected) || null;
    openDrawer({
      title: L('New certificate request', 'طلب شهادة جديد'),
      sub: L(
        'Choose a person and, if available, an existing entry. A future sacrament may be requested now; the certificate waits for an approved register.',
        'اختر الشخص وقيداً قائماً إن توفر. يمكن الطلب قبل موعد السرّ، وتنتظر الشهادة اعتماد السجل.'
      ),
      body: (
        <>
          <div className="formrow">
            <label className="label" htmlFor="req_person">
              {L('Parishioner', 'صاحب الطلب')}
              <span className="req">*</span>
            </label>
            <Select defaultValue={initial?.person} id="req_person">
              {PEOPLE.map((p, i) => (
                <option key={i} value={p.id}>
                  {isAr() ? p.ar : p.lat}
                </option>
              ))}
            </Select>
          </div>{' '}
          <div className="formrow">
            <label className="label" htmlFor="req_source">
              {L('Related sacrament', 'السرّ المرتبط')}
            </label>
            <Select defaultValue={selected} id="req_source">
              <option value="">{L('No entry yet — request will wait', 'لا قيد بعد — الطلب سينتظر')}</option>
              {sources.map((s, i) => (
                <option key={i} value={`official:${s.id}`}>
                  {s.reg} · {nameIn(person(s.person))} · {kindLabel(s.kind)} ({L('official', 'رسمي')})
                </option>
              ))}
              {pending.map((s, i) => (
                <option key={i} value={`pending:${s.id}`}>
                  {s.reg} · {nameIn(person(s.person))} · {kindLabel(s.kind)} ({L('pending', 'قيد الانتظار')})
                </option>
              ))}
            </Select>
            <span className="help" id="req_source_help">
              {L(
                'An official entry can be reviewed immediately. A future or pending entry links automatically after registration.',
                'يمكن مراجعة القيد الرسمي فوراً. يرتبط القيد المقبل أو المعلّق آلياً بعد اعتماده.'
              )}
            </span>
          </div>{' '}
          <C.Field label={L('Purpose of request', 'غاية الطلب')} id="req_purpose" req={true} />
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>
          <button className="btn btn-primary" id="req_save">
            {initial ? L('Create and submit', 'إنشاء وإرسال') : L('Create request', 'إنشاء الطلب')}
          </button>
        </>
      ),
      onMount(el) {
        const related = el.querySelector('#req_source'),
          personSelect = el.querySelector('#req_person');
        const refreshAction = () => {
          el.querySelector('#req_save').textContent = related.value.startsWith('official:')
            ? L('Create and submit', 'إنشاء وإرسال')
            : L('Create request', 'إنشاء الطلب');
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
            toast(
              L('Request created', 'أُنشئ الطلب'),
              recordType === 'official'
                ? L('Submitted for clergy review.', 'أُرسل لمراجعة الإكليروس.')
                : L(
                    'It will wait for an official register entry before approval.',
                    'سينتظر قيداً رسمياً قبل الاعتماد.'
                  ),
              'success'
            );
          } catch (e) {
            saveButton.disabled = false;
            toast(L('Could not create request', 'تعذّر إنشاء الطلب'), e.message, 'danger');
          }
        });
      }
    });
  });
  if (S.ui.newCertificateSource && host.querySelector('#newcertreq')) host.querySelector('#newcertreq').click();
  host.querySelector('#newsacreq')?.addEventListener('click', () =>
    openDrawer({
      title: L('New sacrament request', 'طلب سرّ جديد'),
      sub: L(
        'Record the family request. The secretary may review it, or the priest may decide directly. Preparation begins only after priest approval.',
        'سجّل طلب العائلة. يمكن للأمينة مراجعته، أو للكاهن اتخاذ القرار مباشرة. يبدأ التحضير فقط بعد موافقته.'
      ),
      body: (
        <>
          <div className="formrow">
            <label className="label" htmlFor="srq_kind">
              {L('Sacrament', 'السرّ')}
            </label>
            <Select id="srq_kind">
              {Object.entries(KIND)
                .filter(([k]) => k !== 'certificate')
                .map(([k, v], i) => (
                  <option key={i} value={k}>
                    {L(v[0], v[1])}
                  </option>
                ))}
            </Select>
          </div>{' '}
          <div className="formrow" id="srq-existing">
            <label className="label" htmlFor="srq_person">
              {L('Person receiving the sacrament', 'الشخص الذي سيقبل السرّ')}
            </label>
            <Select id="srq_person">
              <option value="">{L('Choose a person', 'اختر شخصاً')}</option>
              {PEOPLE.map((p, i) => (
                <option key={i} value={p.id}>
                  {isAr() ? p.ar : p.lat}
                </option>
              ))}
            </Select>
          </div>{' '}
          <label className="check" id="srq-child-choice">
            <input type="checkbox" id="srq-new-child" />
            <span>{L('Baptism for a child not yet in People', 'معمودية لطفل غير مسجّل بعد في المؤمنين')}</span>
          </label>{' '}
          <div id="srq-child-fields" hidden className="stack" style={{ gap: '12px', margin: '14px 0' }}>
            <C.Field
              label={L('Child’s full name (English)', 'اسم الطفل الكامل (إنكليزي)')}
              id="srq-child-lat"
              req={true}
            />{' '}
            <C.Field label={L('Child’s full name (Arabic)', 'اسم الطفل الكامل (عربي)')} id="srq-child-ar" req={true} />{' '}
            <C.Field label={L('Child’s birth date', 'تاريخ ميلاد الطفل')} id="srq-child-born" type="date" req={true} />{' '}
            <div className="formgrid">
              <C.Field label={L('Father’s name (optional)', 'اسم الأب (اختياري)')} id="srq-child-father" />
              <C.Field label={L('Mother’s name (optional)', 'اسم الأم (اختياري)')} id="srq-child-mother" />
            </div>{' '}
            <p className="help">
              {L(
                'Submitting creates a linked child record without a login account. If the child is already listed, select that person instead.',
                'يُنشئ التقديم سجل طفل مرتبطاً دون حساب دخول. إذا كان الطفل مسجّلاً، اختر سجله بدلاً من ذلك.'
              )}
            </p>
          </div>{' '}
          <C.Field label={L('Preferred date (optional)', 'التاريخ المفضّل (اختياري)')} id="srq_date" type="date" />{' '}
          <C.Textarea label={L('Family request / notes', 'طلب العائلة / ملاحظات')} id="srq_notes" max={500} />
        </>
      ),
      foot: (
        <>
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>
          <button className="btn btn-primary" id="srq_save">
            {L('Submit request', 'تقديم الطلب')}
          </button>
        </>
      ),
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
          if (!manual && !need(el, '#srq_person', L('Choose who receives the sacrament', 'اختر من سيقبل السرّ')))
            return;
          const child = manual
            ? {
                lat: el.querySelector('#srq-child-lat').value.trim(),
                ar: el.querySelector('#srq-child-ar').value.trim(),
                born: el.querySelector('#srq-child-born').value,
                father: el.querySelector('#srq-child-father').value.trim(),
                mother: el.querySelector('#srq-child-mother').value.trim()
              }
            : null;
          if (
            manual &&
            !needAll(el, [
              ['#srq-child-lat', L('Enter the child’s English name', 'أدخل اسم الطفل بالإنكليزية')],
              ['#srq-child-ar', L('Enter the child’s Arabic name', 'أدخل اسم الطفل بالعربية')],
              ['#srq-child-born', L('Enter the birth date', 'أدخل تاريخ الولادة')]
            ])
          )
            return;
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
            toast(
              L('Request submitted', 'قُدّم الطلب'),
              L(
                'It is ready for office review or a direct priest decision.',
                'الطلب جاهز لمراجعة المكتب أو لقرار الكاهن المباشر.'
              ),
              'success'
            );
          } catch (e) {
            btn.disabled = false;
            toast(L('Could not submit request', 'تعذّر تقديم الطلب'), e.message, 'danger');
          }
        });
      }
    })
  );
  host.querySelectorAll('[data-prep-edit]').forEach(btn =>
    btn.addEventListener('click', () => {
      const record = SACRAMENTS.find(s => s.id === btn.dataset.prepEdit);
      if (!record) return;
      const requirements = PREP_REQUIREMENTS[record.kind] || [];
      openDrawer({
        title: L('Edit preparation', 'تعديل التحضير'),
        sub: L(
          'Record the planned date and requirements. Complete preparation before celebration.',
          'سجّل الموعد والمتطلبات. أكمل التحضير قبل الاحتفال.'
        ),
        body: (
          <>
            <p className="t-caption dim">
              {(isAr() ? person(record.person)?.ar : person(record.person)?.lat) || ''} · {kindLabel(record.kind)}
            </p>
            <div className="formgrid">
              <C.Field
                label={L('Celebration date', 'تاريخ الاحتفال')}
                id="prep_date"
                type="date"
                value={record.date || ''}
              />
              {timeSelect('prep_time', record.time || '')}
            </div>
            <div className="stack" style={{ gap: '10px', marginTop: '16px' }}>
              {requirements.map(([en, ar, required], i) => (
                <label key={i} className="check">
                  <input
                    type="checkbox"
                    data-prep-item={i}
                    defaultChecked={!!(Array.isArray(record.preparation) && record.preparation[i])}
                  />
                  <span>
                    {L(en, ar)}
                    {required ? '' : <small className="dim">({L('optional', 'اختياري')})</small>}
                  </span>
                </label>
              ))}
            </div>
          </>
        ),
        foot: (
          <>
            <button className="btn btn-secondary" data-close="">
              {L('Close', 'إغلاق')}
            </button>
            <button className="btn btn-primary" id="prep_save">
              {L('Save preparation', 'حفظ التحضير')}
            </button>
            {record.status === 'preparing' ? (
              <button className="btn btn-secondary" id="prep_complete">
                {L('Complete preparation', 'إكمال التحضير')}
              </button>
            ) : (
              ''
            )}
          </>
        ),
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
              toast(
                L('Preparation completed', 'اكتمل التحضير'),
                L('Record the celebration on or after its date.', 'سجّل الاحتفال في موعده أو بعده.'),
                'success'
              );
            } catch (e) {
              toast(L('Could not complete preparation', 'تعذّر إكمال التحضير'), e.message, 'danger');
            }
          });
        }
      });
    })
  );
  host.querySelectorAll('[data-prep-cancel]').forEach(btn =>
    btn.addEventListener('click', () =>
      openModal({
        title: L('Cancel this preparation?', 'إلغاء هذا التحضير؟'),
        sub: L('The request and its history remain available.', 'يبقى الطلب وسجله متاحين.'),
        body: (
          <>
            <C.Textarea label={L('Reason', 'السبب')} id="prep_reason" max={500} />
            {sharedNote(SACRAMENTS.find(s => s.id === btn.dataset.prepCancel))}
          </>
        ),
        foot: (
          <>
            <button className="btn btn-secondary" data-close="">
              {L('Keep', 'إبقاء')}
            </button>
            <button className="btn btn-primary" id="prep_cancel_confirm">
              {L('Cancel preparation', 'إلغاء التحضير')}
            </button>
          </>
        ),
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
      })
    )
  );
};
