/* Registrations and payments: the registration policy and form for each parish event, the registrants and
   their seat decisions, cash received and refunds, all read from and written to ParishLife.Api. */
import { Select } from '../../ui/components.jsx';
import { css } from '../../ui/html.js';
import { t, fmtDate } from '../../../lib/i18n.js';
import { go, bus } from '../../model/store.js';
import { Icon, PageHead, Panel, Who, Pill, Table, Empty, Stat, TabBar } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import {
  fieldTypeLabel,
  registrationMoney,
  registrantName,
  registrantDrawer,
  consentPill,
  paymentPill,
  statusPill,
  registrationNext,
  receiptDialog,
  refundDialog,
  ask
} from './registration-forms.jsx';
import { registerParticipant, toggleOpen } from './registrations-dialogs.jsx';
import {
  selectedRegistration,
  selectRegistration,
  registrantsFor,
  linkedEvent,
  selectCheckinEvent,
  eventVenue
} from '../../model/event-workflows.js';
import { REGISTRATIONS, REGISTRANTS, REFUNDS } from '../../model/data.js';
import { act, decideRefund } from '../../model/modules/registrations.js';
import { toast } from '../../ui/ui.jsx';

const L = (en, ar) => t(en, ar);

const RTABS = () => [
  ['', 'Forms', 'الاستمارات'],
  ['builder', 'Form', 'الاستمارة'],
  ['registrants', 'Registrants', 'المسجّلون', REGISTRANTS.length],
  ['payments', 'Payments', 'الدفعات'],
  ['refunds', 'Refunds', 'الاسترجاعات', REFUNDS.length]
];

const policyPill = form =>
  !form.known ? (
    <span className="dimmer">—</span>
  ) : form.policyStatus === 'Open' ? (
    <Pill label={L('Open', 'مفتوح')} tone="success" />
  ) : form.policyStatus === 'Closed' ? (
    <Pill label={L('Closed', 'مغلق')} />
  ) : (
    <Pill label={L('Draft', 'مسودة')} tone="warning" />
  );

const REFUND_TONE = { Requested: 'warning', Approved: 'info', Rejected: '', Recorded: 'success' };
const refundLabel = s =>
  ({
    Requested: L('Requested', 'مطلوب'),
    Approved: L('Approved', 'موافَق عليه'),
    Rejected: L('Rejected', 'مرفوض'),
    Recorded: L('Repaid', 'مدفوع')
  })[s] || s;

export function registrations(tab = '') {
  const selected = selectedRegistration(),
    chosenEvent = linkedEvent(selected),
    selectedRows = registrantsFor(selected);
  const head = (
    <>
      <PageHead
        crumbs={[{ label: L('Parish life', 'حياة الرعية') }, { label: L('Registrations', 'التسجيلات') }]}
        title={L('Registration and payments', 'التسجيل والدفع')}
        sub={L(
          'Registration signs a participant up for a parish event. Check-in records their arrival at that same event.',
          'التسجيل يضيف مشتركاً إلى حدث رعوي. التسجيل عند الباب يثبت وصوله إلى الحدث نفسه.'
        )}
        actions={
          <button className="btn btn-primary" data-act="form-new">
            <Icon name="plus" size={17} />
            {L('New form', 'استمارة جديدة')}
          </button>
        }
      />
      <TabBar base="registrations" items={RTABS()} active={tab} />
      {tab ? (
        <>
          <div className="toolbar" style={{ margin: '18px 0' }}>
            <label className="label" htmlFor="registration-select">
              {L('Registration form', 'استمارة التسجيل')}
            </label>{' '}
            <Select defaultValue={selected?.id} id="registration-select" style={{ maxWidth: '360px' }}>
              <option value="">{L('Select a form', 'اختر استمارة')}</option>
              {REGISTRATIONS.map(f => (
                <option key={f.id} value={f.id}>
                  {f.event} · {f.d}
                </option>
              ))}
            </Select>
          </div>{' '}
          {chosenEvent ? (
            <div className="card card-flat" style={{ padding: '12px', marginBottom: '18px' }}>
              <b>{chosenEvent.title}</b> · {fmtDate(chosenEvent.d)} {chosenEvent.t}
              {eventVenue(chosenEvent) ? ` · ${L(eventVenue(chosenEvent).name, eventVenue(chosenEvent).ar)}` : ''}
            </div>
          ) : (
            ''
          )}
        </>
      ) : (
        ''
      )}
    </>
  );
  if (tab && !selected)
    return (
      <>
        {head}
        <div className="tabbody">
          <Empty
            glyph="registr"
            title={L('Select a registration form', 'اختر استمارة تسجيل')}
            body={L(
              'Choose the event form above. No default event is selected.',
              'اختر استمارة الحدث أعلاه. لا يُحدّد حدث افتراضياً.'
            )}
          />
        </div>
      </>
    );
  if (tab && !selected.known)
    return (
      <>
        {head}
        <div className="tabbody">
          <C.InlineAlert
            tone="info"
            title={L('This account cannot manage this form', 'لا يستطيع هذا الحساب إدارة هذه الاستمارة')}
            body={L(
              'Its terms and registrants need the registrations permission. Door arrival is on the Check-in page.',
              'شروطها وقائمة المسجّلين تحتاج إلى صلاحية التسجيلات. تسجيل الوصول في صفحة التسجيل عند الباب.'
            )}
          />
        </div>
      </>
    );
  if (tab === 'builder')
    return (
      <>
        {head}
        <div style={{ marginTop: '20px' }} className="splitview">
          <div>
            <Panel title={selected.event} tight={false}>
              {selected.fields.map((f, fi) => (
                <div key={f.key} className="listrow" style={{ paddingInline: 0, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--text-3)', marginTop: '2px' }}>
                    <Icon name={f.type === 'Date' ? 'events' : 'forms'} size={17} />
                  </span>{' '}
                  <span className="grow">
                    <b>
                      {f.label}
                      {f.required ? <span style={{ color: 'var(--danger)' }}>*</span> : ''}
                    </b>{' '}
                    {f.type === 'Choice' ? <small style={{ whiteSpace: 'normal' }}>{f.options.join(' / ')}</small> : ''}
                    {f.visibleWhenField ? (
                      <small style={{ whiteSpace: 'normal' }}>
                        {L('Asked when', 'يُسأل عندما')} “{f.visibleWhenField}” = {f.visibleWhenValue}
                      </small>
                    ) : (
                      ''
                    )}
                  </span>{' '}
                  <span className="chip">{fieldTypeLabel(f.type)}</span>
                  <C.IconBtn ico="dots" label={L('Question options', 'خيارات السؤال')} data-act={`field-menu:${fi}`} />
                </div>
              ))}
              {selected.fields.length ? (
                ''
              ) : (
                <p className="help">
                  {L('No questions yet. Registration works without any.', 'لا أسئلة بعد. يعمل التسجيل بدونها.')}
                </p>
              )}
              <button className="btn btn-secondary btn-dense" style={{ marginTop: '14px' }} data-act="field-add">
                <Icon name="plus" size={15} />
                {L('Add question', 'إضافة سؤال')}
              </button>
            </Panel>{' '}
            <p className="t-caption dim" style={{ marginTop: '12px' }}>
              {L(
                'Each change saves a new form version. People who already registered keep the version they answered.',
                'كل تعديل يحفظ نسخة جديدة من الاستمارة. ويحتفظ من سجّل مسبقاً بالنسخة التي أجاب عنها.'
              )}
            </p>
          </div>{' '}
          <div className="sidecol">
            <Panel title={L('Terms', 'الشروط')}>
              <div className="amount" dir="ltr">
                <span className="usd">
                  {selected.fee ? registrationMoney(selected.fee, selected) : L('Free', 'مجاني')}
                </span>
              </div>{' '}
              <div className="divider" />
              {[
                [L('Capacity', 'السعة'), selected.cap],
                [L('Transport seats', 'مقاعد النقل'), selected.transportCap],
                [L('Waiting list', 'لائحة الانتظار'), selected.waitlistAllowed ? L('Yes', 'نعم') : L('No', 'لا')],
                [
                  L('Ages', 'الأعمار'),
                  selected.minAge === null && selected.maxAge === null
                    ? L('Any', 'أي عمر')
                    : `${selected.minAge ?? '…'} – ${selected.maxAge ?? '…'}`
                ],
                [L('Guardian needed below', 'يلزم وليّ دون'), selected.childAgeThreshold],
                [L('Door operators', 'مشغّلو الباب'), selected.doorAccountIds.length]
              ].map(([k, v]) => (
                <div key={k} className="listrow" style={{ paddingInline: 0 }}>
                  <span className="grow">{k}</span>
                  <b className="mono">{v}</b>
                </div>
              ))}
              {selected.consentRequired ? (
                <>
                  <div className="ac-group" style={{ paddingInline: 0 }}>
                    {L('Consent wording', 'نص الموافقة')}
                  </div>
                  <p className="t-body dim" style={{ fontSize: '14px' }}>
                    {selected.consentText}
                  </p>
                </>
              ) : (
                ''
              )}
            </Panel>{' '}
            <Panel title={L('Registration', 'التسجيل')}>
              <p className="t-body dim">
                {L(
                  'The terms were set when the form was created and cannot be edited. Confirmation messages to participants are not connected.',
                  'ضُبطت الشروط عند إنشاء الاستمارة ولا يمكن تعديلها. رسائل التأكيد للمشتركين غير موصولة.'
                )}
              </p>
              <button className="btn btn-secondary btn-dense" data-toggle-open={selected.id}>
                {selected.open ? L('Close registration', 'إغلاق التسجيل') : L('Open registration', 'فتح التسجيل')}
              </button>
            </Panel>
          </div>
        </div>
      </>
    );
  if (tab === 'registrants')
    return (
      <>
        {head}
        <div className="tabbody">
          <div className="toolbar" style={{ marginBottom: '14px', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" data-register-participant="" disabled={!selected.open}>
              <Icon name="plus" size={16} />
              {L('Register participant', 'تسجيل مشترك')}
            </button>{' '}
            <button className="btn btn-secondary" data-select-checkin={chosenEvent?.id}>
              {L('Open event check-in', 'فتح تسجيل الوصول للحدث')}
            </button>
          </div>
          <Table
            cols={[
              { label: L('Participant', 'المشترك'), sort: true },
              { label: L('Consent', 'الموافقة'), cls: 'shrink' },
              { label: L('Transport', 'النقل'), cls: 'hide-sm' },
              { label: L('Paid', 'المدفوع'), cls: 'num' },
              { label: L('Status', 'الحالة'), cls: 'shrink' },
              { label: L('Next action', 'الخطوة التالية'), cls: 'shrink' }
            ]}
            rows={selectedRows.map(r => ({
              cells: [
                <Who p={registrantName(r)} />,
                consentPill(r, selected),
                <span className="dim">
                  {r.full ? (r.transport ? L('Parish transport', 'نقل الرعية') : L('Own', 'خاص')) : '—'}
                </span>,
                <>
                  <span className="num">{registrationMoney(r.received, r)}</span>
                  {paymentPill(r)}
                </>,
                statusPill(r.status),
                <button className="btn btn-secondary btn-dense" data-registration-review={r.id}>
                  {registrationNext(r)}
                </button>
              ]
            }))}
            empty={
              <Empty
                glyph="registr"
                title={L('No participants registered yet', 'لا مشتركون مسجّلون بعد')}
                body={L(
                  'Open registration, then choose Register participant to add the first.',
                  'افتح التسجيل ثم اختر تسجيل مشترك لإضافة الأول.'
                )}
              />
            }
          />{' '}
          {!selected.open ? (
            <C.InlineAlert
              tone="info"
              title={L('Registration is not open', 'التسجيل غير مفتوح')}
              body={L(
                'Open the form (Form tab) before adding participants.',
                'افتح الاستمارة (تبويب الاستمارة) قبل إضافة المشتركين.'
              )}
            />
          ) : selected.taken >= selected.cap ? (
            <C.InlineAlert
              tone="warning"
              title={L('Event capacity reached', 'بلغ الحدث سعته')}
              body={
                selected.waitlistAllowed
                  ? L('New confirmations join the waiting list.', 'التأكيدات الجديدة تنضم إلى لائحة الانتظار.')
                  : L('No more places can be confirmed.', 'لا يمكن تثبيت مقاعد إضافية.')
              }
            />
          ) : (
            ''
          )}
        </div>
      </>
    );
  if (tab === 'payments') {
    const withMoney = selectedRows.filter(r => r.received > 0 || r.refunded > 0 || r.fee > 0);
    return (
      <>
        {head}
        <div style={{ marginTop: '20px' }} className="splitview">
          <Panel title={L('Payment tracking', 'متابعة الدفعات')} tight={true}>
            <Table
              cols={[
                { label: L('Participant', 'المشترك') },
                { label: L('Fee', 'الرسم'), cls: 'num hide-sm' },
                { label: L('Received', 'المستلم'), cls: 'num' },
                { label: L('Refunded', 'المسترجع'), cls: 'num hide-sm' },
                { label: L('Status', 'الحالة'), cls: 'shrink' },
                { label: '', cls: 'shrink' }
              ]}
              rows={withMoney.map(r => ({
                cells: [
                  <Who p={registrantName(r)} />,
                  <span className="num">{registrationMoney(r.fee, r)}</span>,
                  <span className="num">{registrationMoney(r.received, r)}</span>,
                  <span className="num">{registrationMoney(r.refunded, r)}</span>,
                  paymentPill(r),
                  r.outstanding > 0 && r.status !== 'Cancelled' ? (
                    <button className="btn btn-secondary btn-dense" data-receipt={r.id}>
                      {L('Record payment', 'سجّل دفعة')}
                    </button>
                  ) : r.received - r.refunded > 0 ? (
                    <button className="btn btn-secondary btn-dense" data-refund-request={r.id}>
                      {L('Request refund', 'اطلب استرجاعاً')}
                    </button>
                  ) : (
                    ''
                  )
                ]
              }))}
              empty={<Empty glyph="registr" title={L('No fees or payments', 'لا رسوم ولا دفعات')} body="" />}
            />
          </Panel>{' '}
          <div className="sidecol">
            <Panel title={L('Receipts', 'الإيصالات')}>
              {selectedRows.flatMap(r => r.payments.map(m => ({ r, m }))).length ? (
                selectedRows.flatMap(r =>
                  r.payments.map(m => (
                    <div key={m.id} className="listrow" style={{ paddingInline: 0 }}>
                      <span className="grow">
                        {registrantName(r)?.lat || ''}
                        <small>
                          {m.kind === 'CashReceived' ? L('Cash received', 'نقد مستلم') : L('Refunded', 'مسترجع')} ·{' '}
                          {fmtDate(String(m.at).slice(0, 10))} · {m.reference}
                        </small>
                      </span>
                      <b className="mono">{registrationMoney(m.amount, r)}</b>
                    </div>
                  ))
                )
              ) : (
                <p className="t-body dim" style={{ fontSize: '14px' }}>
                  {L(
                    'Only cash actually received is recorded, in the event’s currency. No online provider is connected.',
                    'يُسجَّل النقد المستلم فعلاً فقط بعملة الحدث. لا مزوّد إلكتروني موصول.'
                  )}
                </p>
              )}
            </Panel>
          </div>
        </div>
      </>
    );
  }
  if (tab === 'refunds') {
    const mine = REFUNDS.filter(r => r.formId === selected.id);
    return (
      <>
        {head}
        <div className="tabbody">
          <Table
            cols={[
              { label: L('Participant', 'المشترك') },
              { label: L('Reason', 'السبب') },
              { label: L('Amount', 'المبلغ'), cls: 'num' },
              { label: L('Status', 'الحالة'), cls: 'shrink' },
              { label: L('Requested', 'تاريخ الطلب'), cls: 'hide-sm' },
              { label: '', cls: 'shrink' }
            ]}
            rows={mine.map(r => ({
              cells: [
                <Who p={registrantName(REGISTRANTS.find(x => x.id === r.registrationId) || r)} />,
                <span className="dim">{r.why}</span>,
                <span className="num">{registrationMoney(r.amount, r)}</span>,
                <Pill label={refundLabel(r.status)} tone={REFUND_TONE[r.status] || ''} />,
                <span className="mono dim">{fmtDate(String(r.at).slice(0, 10))}</span>,
                r.status === 'Requested' ? (
                  <span className="row" style={{ gap: '6px' }}>
                    <button className="btn btn-secondary btn-dense" data-refund={`${r.id}|approve`}>
                      {L('Approve', 'وافق')}
                    </button>
                    <button className="btn btn-secondary btn-dense" data-refund={`${r.id}|reject`}>
                      {L('Reject', 'ارفض')}
                    </button>
                  </span>
                ) : r.status === 'Approved' ? (
                  <button className="btn btn-secondary btn-dense" data-refund={`${r.id}|record`}>
                    {L('Record repayment', 'سجّل الدفع')}
                  </button>
                ) : (
                  ''
                )
              ]
            }))}
            empty={<Empty glyph="registr" title={L('No refund requests', 'لا طلبات استرجاع')} body="" />}
          />{' '}
          <p className="t-caption dim" style={{ marginTop: '16px' }}>
            {L(
              'A refund is decided in three separate steps by different people: requested, approved by someone else, and recorded as actually repaid by a third person. Cancelling a registration never refunds money.',
              'يُقرَّر الاسترجاع في ثلاث خطوات منفصلة بأشخاص مختلفين: الطلب، ثم موافقة شخص آخر، ثم تسجيل الدفع الفعلي بشخص ثالث. إلغاء التسجيل لا يسترجع المال.'
            )}
          </p>
        </div>
      </>
    );
  }
  const rows = REGISTRATIONS.map(r => {
    const pct = r.cap ? Math.min(100, Math.round((r.taken / r.cap) * 100)) : 0;
    return {
      cells: [
        <>
          <b>{r.event}</b>
          <small className="dim" style={{ display: 'block' }}>
            {fmtDate(r.d)} {r.t}
          </small>
        </>,
        r.known ? (
          <span style={{ display: 'block', minWidth: '150px' }}>
            <span className="t-caption dim tnum">
              {r.taken} / {r.cap}
            </span>{' '}
            <span className="meter" style={{ marginTop: '6px' }}>
              <i style={css(`width:${pct}%`)} />
            </span>
          </span>
        ) : (
          <span className="dimmer">—</span>
        ),
        r.waiting ? (
          <Pill label={`${r.waiting} ${L('waiting', 'بالانتظار')}`} tone="warning" />
        ) : (
          <span className="dimmer">—</span>
        ),
        r.known ? (
          r.fee ? (
            <span className="num">{registrationMoney(r.fee, r)}</span>
          ) : (
            <span className="dim">{L('Free', 'مجاني')}</span>
          )
        ) : (
          <span className="dimmer">—</span>
        ),
        policyPill(r),
        <span className="row" style={{ gap: '6px', justifyContent: 'flex-end' }}>
          {r.known ? (
            <button className="btn btn-secondary btn-dense" data-toggle-open={r.id}>
              {r.open ? L('Close', 'أغلق') : L('Open', 'افتح')}
            </button>
          ) : (
            ''
          )}
          <button className="btn btn-secondary btn-dense" data-open-registration={r.id}>
            {L('Participants', 'المشتركون')}
          </button>
        </span>
      ]
    };
  });
  return (
    <>
      {head}
      <div className="tabbody">
        <div className="stats" style={{ marginBottom: '16px' }}>
          <Stat k={L('Forms', 'الاستمارات')} v={REGISTRATIONS.length} d={L('for parish events', 'لأحداث الرعية')} />{' '}
          <Stat
            k={L('Open forms', 'استمارات مفتوحة')}
            v={REGISTRATIONS.filter(form => form.open).length}
            d={L('accepting participants', 'تقبل المشتركين')}
          />{' '}
          <Stat
            k={L('Participants', 'المشتركون')}
            v={REGISTRANTS.length}
            d={L('across these forms', 'في هذه الاستمارات')}
          />
        </div>
        <Table
          cols={[
            { label: L('Event', 'الحدث'), sort: true, cls: 'wide' },
            { label: L('Capacity', 'السعة') },
            { label: L('Waiting', 'الانتظار'), cls: 'hide-sm' },
            { label: L('Fee', 'الرسم'), cls: 'num hide-sm' },
            { label: L('Status', 'الحالة'), cls: 'shrink' },
            { label: '', cls: 'shrink' }
          ]}
          rows={rows}
          empty={
            <Empty
              glyph="registr"
              title={L('No registration forms', 'لا استمارات تسجيل')}
              body={L(
                'Create one for a retreat, a lunch or a catechism year. The activity must exist in the Calendar first.',
                'أنشئ واحدة لخلوة أو غداء أو سنة تعليم. يجب أن يكون النشاط في الرزنامة أولاً.'
              )}
              action={
                <button className="btn btn-primary btn-dense" data-act="form-new">
                  {L('New form', 'استمارة جديدة')}
                </button>
              }
            />
          }
        />
      </div>
    </>
  );
}

/* a refund decision: approve and reject need a reason; recording needs the actual date and evidence */
function refundDecision(id, action) {
  const refund = REFUNDS.find(r => r.id === id),
    reg = refund && REGISTRANTS.find(r => r.id === refund.registrationId);
  if (!refund || !reg) return;
  const today = new Date().toLocaleDateString('sv-SE');
  ask({
    title: {
      approve: L('Approve refund', 'الموافقة على الاسترجاع'),
      reject: L('Reject refund', 'رفض الاسترجاع'),
      record: L('Record repayment', 'تسجيل الدفع')
    }[action],
    sub: registrationMoney(refund.amount, refund),
    cta: L('Save', 'احفظ'),
    rows: [
      <C.Textarea key="r" label={L('Reason', 'السبب')} id="rd-why" max={2000} />,
      action === 'record' ? (
        <C.Field key="e" label={L('Evidence reference', 'مرجع الإثبات')} id="rd-ref" max={500} />
      ) : null,
      action === 'record' ? (
        <C.Field key="d" label={L('Date repaid', 'تاريخ الدفع')} id="rd-date" type="date" value={today} max={today} />
      ) : null
    ],
    async onGo(el) {
      const why = el.querySelector('#rd-why').value.trim(),
        ref = el.querySelector('#rd-ref')?.value.trim(),
        date = el.querySelector('#rd-date')?.value;
      if (!why || (action === 'record' && !ref))
        return (toast(L('Fill in the reason and evidence', 'أكمل السبب والإثبات'), '', 'warning'), false);
      return act(() =>
        decideRefund(refund, reg, action, {
          reason: why,
          evidenceReference: ref,
          occurredAt: date === today ? new Date().toISOString() : new Date(`${date}T12:00:00Z`).toISOString()
        })
      );
    }
  });
}

registrations.mount = host => {
  const row = id => REGISTRANTS.find(r => r.id === id);
  host.querySelector('[data-register-participant]')?.addEventListener('click', () => registerParticipant());
  host.querySelectorAll('[data-registration-review]').forEach(button =>
    button.addEventListener('click', () => {
      const r = row(button.dataset.registrationReview);
      if (r) registrantDrawer(r, selectedRegistration());
    })
  );
  host
    .querySelectorAll('[data-receipt]')
    .forEach(b => b.addEventListener('click', () => receiptDialog(row(b.dataset.receipt), selectedRegistration())));
  host
    .querySelectorAll('[data-refund-request]')
    .forEach(b => b.addEventListener('click', () => refundDialog(row(b.dataset.refundRequest))));
  host
    .querySelectorAll('[data-refund]')
    .forEach(b => b.addEventListener('click', () => refundDecision(...b.dataset.refund.split('|'))));
  host
    .querySelectorAll('[data-toggle-open]')
    .forEach(b =>
      b.addEventListener('click', () => toggleOpen(REGISTRATIONS.find(f => f.id === b.dataset.toggleOpen)))
    );
  host.querySelector('#registration-select')?.addEventListener('change', e => {
    selectRegistration(e.target.value);
    bus.refresh();
  });
  host.querySelectorAll('[data-open-registration]').forEach(b =>
    b.addEventListener('click', () => {
      selectRegistration(b.dataset.openRegistration);
      go('registrations/registrants');
    })
  );
  host.querySelectorAll('[data-select-checkin]').forEach(b =>
    b.addEventListener('click', () => {
      selectCheckinEvent(b.dataset.selectCheckin);
      go('checkin');
    })
  );
};
