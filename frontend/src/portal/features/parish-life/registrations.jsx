/* Registrations and payments: the forms for parish events, registrants, payments and refunds. */
import { Select } from '../../ui/components.jsx';
import { css } from '../../ui/html.js';
import { t, usd, fmtDate } from '../../../lib/i18n.js';
import { go, bus } from '../../model/store.js';
import { Icon, PageHead, Panel, Who, Status, Pill, Table, Empty, openModal, Stat, TabBar } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as CR from '../../shared/record-editor.jsx';
import {
  participantForm,
  consentInfo,
  consentPill,
  registrationDue,
  registrationMoney,
  paymentPill,
  placeLabel,
  transportLabel
} from './registration-forms.jsx';
import { registerParticipant } from './registrations-dialogs.jsx';
import {
  selectedRegistration,
  selectRegistration,
  registrantsFor,
  linkedEvent,
  selectCheckinEvent,
  eventVenue
} from '../../model/event-workflows.js';
import { REGISTRATIONS, REGISTRANTS, REFUNDS, person } from '../../model/data.js';

const L = (en, ar) => t(en, ar);

const RTABS = () => [
  ['', 'Forms', 'الاستمارات'],
  ['builder', 'Form', 'الاستمارة'],
  ['registrants', 'Registrants', 'المسجّلون', REGISTRANTS.length],
  ['payments', 'Payments', 'الدفعات'],
  ['refunds', 'Refunds', 'الاسترجاعات', REFUNDS.length]
];

function registrationNext(row, form) {
  if (row.status === 'awaiting-approval') return L('Review application', 'راجع الطلب');
  if (row.status !== 'registered') return L('Review place', 'مراجعة المقعد');
  if (consentInfo(form, row.p).required && !row.consent) return L('Consent pending', 'الموافقة معلّقة');
  if (Number(row.paid || 0) < registrationDue(row, form)) return L('Record payment', 'سجّل دفعة');
  return L('View / edit', 'عرض / تعديل');
}

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
          'Registration signs a participant up for a selected event. Check-in records their arrival at that same event.',
          'التسجيل يضيف مشتركاً إلى حدث محدّد. التسجيل عند الباب يثبت وصوله إلى الحدث نفسه.'
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
              {REGISTRATIONS.map((f, i) => (
                <option key={i} value={f.id}>
                  {L(f.event, f.eventAr)}
                </option>
              ))}
            </Select>
          </div>{' '}
          {chosenEvent ? (
            <div className="card card-flat" style={{ padding: '12px', marginBottom: '18px' }}>
              <b>{L(chosenEvent.title, chosenEvent.titleAr)}</b> · {fmtDate(chosenEvent.d)} {chosenEvent.t} ·{' '}
              {L(eventVenue(chosenEvent)?.name || '', eventVenue(chosenEvent)?.ar || '')}
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
  if (tab && !chosenEvent)
    return (
      <>
        {head}
        <div className="tabbody">
          <C.InlineAlert
            tone="warning"
            title={L('This legacy form is not linked to an event', 'هذه الاستمارة القديمة غير مرتبطة بحدث')}
            body={L(
              'Review it and link an eligible event before editing fields or checking in participants. Existing registrations are preserved.',
              'راجعها واربطها بحدث صالح قبل تعديل الحقول أو تسجيل وصول المشتركين. تبقى التسجيلات القديمة محفوظة.'
            )}
          />{' '}
          <button
            className="btn btn-secondary"
            data-act={`rec-edit:registration|${selected.id}`}
            style={{ marginTop: '12px' }}
          >
            {L('Link event', 'ربط حدث')}
          </button>
        </div>
      </>
    );
  if (tab === 'builder')
    return (
      <>
        {head}
        <div style={{ marginTop: '20px' }} className="splitview">
          <div>
            <Panel title={L(selected.event, selected.eventAr)} tight={false}>
              {selected.fields.map(([en, ar, type, req, he, ha], fi) => (
                <div key={fi} className="listrow" style={{ paddingInline: 0, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--text-3)', marginTop: '2px' }}>
                    <Icon
                      name={
                        type === 'file'
                          ? 'doc'
                          : type === 'person'
                            ? 'people'
                            : type === 'date'
                              ? 'events'
                              : type === 'restricted'
                                ? 'shield'
                                : 'forms'
                      }
                      size={17}
                    />
                  </span>{' '}
                  <span className="grow">
                    <b>
                      {L(en, ar)}
                      {req ? <span style={{ color: 'var(--danger)' }}>*</span> : ''}
                    </b>{' '}
                    {he ? <small style={{ whiteSpace: 'normal' }}>{L(he, ha || he)}</small> : ''}
                  </span>{' '}
                  <span className="chip">{type}</span>
                  <C.IconBtn ico="dots" label={L('Field options', 'خيارات الحقل')} data-act={`field-menu:${fi}`} />
                </div>
              ))}
              <button className="btn btn-secondary btn-dense" style={{ marginTop: '14px' }} data-act="field-add">
                <Icon name="plus" size={15} />
                {L('Add field', 'إضافة حقل')}
              </button>
            </Panel>{' '}
            <p className="t-caption dim" style={{ marginTop: '12px' }}>
              {L(
                'Fixed field types first. A drag-and-drop designer comes once real forms have been tested on real registrations.',
                'أنواع حقول ثابتة أولاً. ومصمّم السحب والإفلات يأتي بعد اختبار استمارات حقيقية على تسجيلات حقيقية.'
              )}
            </p>
          </div>{' '}
          <div className="sidecol">
            <Panel title={L('Fee and discounts', 'الرسم والحسومات')}>
              <div className="amount" dir="ltr">
                <span className="usd">{registrationMoney(selected.fee, selected)}</span>
              </div>{' '}
              <div className="divider" />{' '}
              {(selected.discounts || []).map(([en, ar, v], i) => (
                <div key={i} className="listrow" style={{ paddingInline: 0 }}>
                  <span className="grow">{L(en, ar)}</span>
                  <b className="mono">{v}</b>
                </div>
              ))}{' '}
              <div className="ac-group" style={{ paddingInline: 0 }}>
                {L('Instalments', 'أقساط')}
              </div>{' '}
              {(selected.installments || []).map(([en, ar, v], i) => (
                <div key={i} className="listrow" style={{ paddingInline: 0 }}>
                  <span className="grow">{L(en, ar)}</span>
                  <b className="mono">{registrationMoney(v, selected)}</b>
                </div>
              ))}
            </Panel>{' '}
            <Panel title={L('Registration confirmation', 'تأكيد التسجيل')}>
              <p className="t-body dim">
                {L(
                  'A saved participant appears under Registrants for this event. Automated confirmation delivery is not connected.',
                  'يظهر المشترك المحفوظ في قائمة المسجّلين لهذا الحدث. إرسال التأكيد تلقائياً غير موصول.'
                )}
              </p>
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
            <button
              className="btn btn-primary"
              data-register-participant=""
              disabled={!!(!selected.open || selected.taken >= selected.cap)}
            >
              <Icon name="plus" size={16} />
              {L('Register participant', 'تسجيل مشترك')}
            </button>{' '}
            <button className="btn btn-secondary" data-select-checkin={chosenEvent.id}>
              {L('Open event check-in', 'فتح تسجيل الوصول للحدث')}
            </button>
          </div>
          <Table
            pick={true}
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
                <Who p={person(r.p)} />,
                consentPill(r, selected),
                <span className="dim">{transportLabel(r, selected)}</span>,
                <>
                  <span className="num">{registrationMoney(r.paid, selected)}</span>
                  {paymentPill(r, selected)}
                </>,
                <Pill label={placeLabel(r)} tone={r.status === 'registered' ? 'success' : 'warning'} />,
                <button className="btn btn-secondary btn-dense" data-registration-review={r.id}>
                  {registrationNext(r, selected)}
                </button>
              ]
            }))}
            empty={
              <Empty
                glyph="registr"
                title={L('No participants registered yet', 'لا مشتركون مسجّلون بعد')}
                body={L(
                  'Choose Register participant above to reserve the first place for this event.',
                  'اختر تسجيل مشترك أعلاه لحجز المقعد الأول لهذا الحدث.'
                )}
              />
            }
          />{' '}
          {!selected.open ? (
            <C.InlineAlert
              tone="info"
              title={L('Registration is closed', 'التسجيل مغلق')}
              body={L('Open the form before adding participants.', 'افتح الاستمارة قبل إضافة المشتركين.')}
            />
          ) : selected.taken >= selected.cap ? (
            <C.InlineAlert
              tone="warning"
              title={L('Event capacity reached', 'بلغ الحدث سعته')}
              body={L(
                'Increase the reviewed capacity before adding participants.',
                'زد السعة بعد مراجعتها قبل إضافة مشتركين.'
              )}
            />
          ) : (
            ''
          )}{' '}
          <p className="t-caption dim" style={{ marginTop: '16px' }}>
            {L(
              'Use the participant reference in this event’s check-in session. A registration records a place; check-in records arrival.',
              'استعمل مرجع المشترك في جلسة الوصول الخاصة بهذا الحدث. يثبت التسجيل المقعد، ويثبت تسجيل الوصول الحضور.'
            )}
          </p>
        </div>
      </>
    );
  if (tab === 'payments') {
    const paymentRows = selectedRows.map(r => {
      const form = REGISTRATIONS.find(f => f.id === r.registrationId),
        due = registrationDue(r, form),
        payments = r.payments || [];
      const methods = payments
        .map(
          payment =>
            ({ cash: L('Cash', 'نقداً'), bank: L('Bank transfer', 'تحويل مصرفي'), omt: 'OMT' })[payment.method] ||
            payment.method
        )
        .join(', ');
      return {
        cells: [
          <Who p={person(r.p)} />,
          methods ? methods : <span className="dim">{L('Not recorded', 'غير مسجّلة')}</span>,
          <span className="num">{registrationMoney(r.paid || 0, form)}</span>,
          paymentPill(r, form)
        ]
      };
    });
    return (
      <>
        {head}
        <div style={{ marginTop: '20px' }} className="splitview">
          <Panel title={L('Payment tracking', 'متابعة الدفعات')} tight={true}>
            <Table
              cols={[
                { label: L('Participant', 'المشترك') },
                { label: L('Method', 'الطريقة'), cls: 'hide-sm' },
                { label: L('Amount', 'المبلغ'), cls: 'num' },
                { label: L('Status', 'الحالة'), cls: 'shrink' }
              ]}
              rows={paymentRows}
            />
          </Panel>{' '}
          <div className="sidecol">
            <Panel title={L('Providers', 'مزوّدو الدفع')}>
              <p className="t-body dim" style={{ fontSize: '14px' }}>
                {L(
                  'Cash and bank transfers are recorded by hand with the currency they were paid in. An online provider is added only after supported countries, fees and refund behaviour have been confirmed.',
                  'النقد والتحاويل تُسجَّل يدوياً بعملة الدفع. ولا يُضاف مزوّد إلكتروني إلا بعد تثبيت الدول المدعومة والرسوم وسلوك الاسترجاع.'
                )}
              </p>{' '}
              <div className="row" style={{ gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                <span className="chip chip-on">{L('Cash', 'نقداً')}</span>{' '}
                <span className="chip chip-on">{L('Bank transfer', 'تحويل')}</span>
                <span className="chip">OMT</span>{' '}
                <span className="chip">{L('Card — not connected', 'بطاقة — غير موصولة')}</span>
              </div>
            </Panel>
          </div>
        </div>
      </>
    );
  }
  if (tab === 'refunds')
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
              { label: L('Date', 'التاريخ'), cls: 'hide-sm' }
            ]}
            rows={REFUNDS.map(r => ({
              cells: [
                <Who p={person(r.p)} />,
                <span className="dim">{L(r.why, r.whyAr)}</span>,
                <span className="num">{usd(r.amount)}</span>,
                <Status k={r.status} />,
                <span className="mono dim">{fmtDate(r.at)}</span>
              ]
            }))}
          />{' '}
          <p className="t-caption dim" style={{ marginTop: '16px' }}>
            {L(
              'A refund reverses the contribution rather than deleting it, so the counting session it belonged to still balances.',
              'الاسترجاع يعكس المساهمة ولا يحذفها، فتبقى جلسة العدّ التي تنتمي إليها متوازنة.'
            )}
          </p>
        </div>
      </>
    );
  const rows = REGISTRATIONS.map(r => {
    const pct = r.cap ? Math.min(100, Math.round((r.taken / r.cap) * 100)) : 0;
    const linked = !!linkedEvent(r),
      next = !linked
        ? '—'
        : !r.open
          ? L('Open the form to accept people', 'افتح الاستمارة لقبول الأشخاص')
          : r.taken >= r.cap
            ? L('At capacity; review participants', 'بلغت السعة؛ راجع المشتركين')
            : L('Register or review participants', 'سجّل المشتركين أو راجعهم');
    return {
      cells: [
        <>
          <b>{L(r.event, r.eventAr)}</b>
          {!linkedEvent(r) ? (
            <small className="dim" style={{ display: 'block' }}>
              {L('Legacy form · link an event before use', 'استمارة قديمة · اربطها بحدث قبل الاستخدام')}
            </small>
          ) : (
            ''
          )}
        </>,
        <span style={{ display: 'block', minWidth: '150px' }}>
          <span className="t-caption dim tnum">
            {r.taken} / {r.cap}
          </span>{' '}
          <span className="meter" style={{ marginTop: '6px' }}>
            <i style={css(`width:${pct}%`)} />
          </span>
        </span>,
        r.waiting ? (
          <Pill label={`${r.waiting} ${L('waiting', 'بالانتظار')}`} tone="warning" />
        ) : (
          <span className="dimmer">—</span>
        ),
        r.fee ? (
          <span className="num">{registrationMoney(r.fee, r)}</span>
        ) : (
          <span className="dim">{L('Free', 'مجاني')}</span>
        ),
        <span className="dim" style={{ whiteSpace: 'nowrap' }}>
          {fmtDate(r.deadline)}
        </span>,
        r.open ? <Status k="open" /> : <Status k="draft" />,
        <span className="t-caption dim">{next}</span>,
        <span className="row" style={{ gap: '6px', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-dense" data-open-registration={r.id}>
            {linked ? L('Participants', 'المشتركون') : L('Link event', 'ربط الحدث')}
          </button>
          {CR.recBtn('registration', r.id)}
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
            v={REGISTRATIONS.filter(form => form.open && linkedEvent(form)).length}
            d={L('accepting participants', 'تقبل المشتركين')}
          />{' '}
          <Stat
            k={L('Participants', 'المشتركون')}
            v={REGISTRANTS.length}
            d={L('across linked forms', 'في الاستمارات المرتبطة')}
          />
        </div>
        <Table
          cols={[
            { label: L('Event', 'الحدث'), sort: true, cls: 'wide' },
            { label: L('Capacity', 'السعة') },
            { label: L('Waiting', 'الانتظار'), cls: 'hide-sm' },
            { label: L('Fee', 'الرسم'), cls: 'num hide-sm' },
            { label: L('Closes', 'يقفل'), cls: 'hide-md' },
            { label: L('Status', 'الحالة'), cls: 'shrink' },
            { label: L('Next step', 'الخطوة التالية'), cls: 'hide-sm' },
            { label: '', cls: 'shrink' }
          ]}
          rows={rows}
          empty={
            <Empty
              glyph="registr"
              title={L('No registration forms', 'لا استمارات تسجيل')}
              body={L(
                'Create one for a retreat, a lunch or a catechism year.',
                'أنشئ واحدة لخلوة أو غداء أو سنة تعليم.'
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

function registrationReview(id) {
  const row = REGISTRANTS.find(item => item.id === id),
    form = row && REGISTRATIONS.find(item => item.id === row.registrationId);
  if (row && form) participantForm(form, row);
}

registrations.mount = host => {
  host.querySelector('[data-register-participant]')?.addEventListener('click', () => registerParticipant());
  host
    .querySelectorAll('[data-registration-review]')
    .forEach(button => button.addEventListener('click', () => registrationReview(button.dataset.registrationReview)));
  host.querySelector('#registration-select')?.addEventListener('change', e => {
    selectRegistration(e.target.value);
    bus.refresh();
  });
  host.querySelectorAll('[data-open-registration]').forEach(b =>
    b.addEventListener('click', () => {
      const form = REGISTRATIONS.find(r => r.id === b.dataset.openRegistration);
      if (!linkedEvent(form)) return CR.edit('registration', form?.id);
      selectRegistration(form.id);
      go('registrations/registrants');
    })
  );
  host.querySelectorAll('[data-select-checkin]').forEach(b =>
    b.addEventListener('click', () => {
      selectCheckinEvent(b.dataset.selectCheckin);
      go('checkin');
    })
  );
  host.querySelector('#regqr')?.addEventListener('click', () =>
    openModal({
      title: L('Registration code', 'رمز التسجيل'),
      sub: L(
        'Opens the form, and the reference it issues connects the attendee to the right check-in session.',
        'يفتح الاستمارة، والرقم الذي يصدره يربط المشترك بجلسة التسجيل الصحيحة.'
      ),
      body: (
        <div style={{ display: 'grid', placeItems: 'center', padding: '8px 0' }}>
          <div
            style={{
              width: '150px',
              height: '150px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-card)',
              display: 'grid',
              placeItems: 'center',
              background: 'var(--muted)',
              color: 'var(--text-3)'
            }}
          >
            <Icon name="qr" size={64} />
          </div>
        </div>
      )
    })
  );
};
