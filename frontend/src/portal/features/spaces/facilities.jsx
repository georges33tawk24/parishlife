/* Facilities and resources: rooms and spaces, each room's buffered availability, taking a room out of
   service, equipment and its loans, facility issues and external renters. Everything shown comes from
   ParishLife.Api (model/modules/facilities.js); each action is one API call followed by a reload.
   Main functions: facilities (the page and its tabs), availabilityDrawer, facilityForm, equipmentForm,
   loansDrawer, issueForm, issueDrawer, rentalForm, renterForm. */
import { css, paint } from '../../ui/html.js';
import { t, fmtDate, fmtLong, month, dayShort } from '../../../lib/i18n.js';
import { S } from '../../model/store.js';
import { Icon, PageHead, Pill, Table, Empty, openDrawer, toast, TabBar, Paged, Status } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { VENUES, EQUIPMENT, RESERVATIONS, MAINTENANCE, ISSUES, RENTALS, venue } from '../../model/data.js';
import * as API from '../../model/modules/facilities.js';
import { ask, failure, money, Notice } from './forms.jsx';
import { requestRoomForm } from './reservations.jsx';

const L = (en, ar) => t(en, ar);

const FTABS = () => [
  ['', 'Rooms', 'القاعات'],
  ['equipment', 'Equipment', 'التجهيزات'],
  ['maintenance', 'Out of service', 'خارج الخدمة'],
  ['issues', 'Issues', 'الأعطال', ISSUES.length],
  ['rentals', 'External renters', 'الإيجار الخارجي', RENTALS.length]
];

const KINDS = () => [
  ['Room', L('Room', 'غرفة')],
  ['Space', L('Space (hall, church, outdoor)', 'مساحة (قاعة، كنيسة، خارجي)')]
];

const nameOf = id => {
  const v = venue(id);
  if (v) return L(v.name, v.ar);
  const e = EQUIPMENT.find(x => x.id === id);
  return e ? L(e.name, e.ar) : '—';
};

/* ---------------- rooms: add, edit, take out of service ---------------- */
function facilityForm(v) {
  ask({
    title: v ? L('Edit room', 'تعديل القاعة') : L('Add a room or space', 'إضافة قاعة أو مساحة'),
    sub: L(
      'Changing capacity, set-up or clean-up time, or what excludes what, is refused while a room has current or future reservations.',
      'يُرفض تغيير السعة أو وقت التجهيز أو التنظيف أو التعارضات ما دامت للقاعة حجوزات حالية أو مقبلة.'
    ),
    fields: [
      { id: 'name', label: L('Name', 'الاسم'), req: true, value: v?.name, max: 500 },
      { id: 'kind', label: L('Kind', 'النوع'), type: 'select', value: v?.kind || 'Room', options: KINDS() },
      { id: 'capacity', label: L('Seats', 'السعة'), type: 'number', min: 1, req: true, value: v?.cap ?? 40 },
      {
        id: 'setupMinutes',
        label: L('Set-up time before (minutes)', 'وقت التجهيز قبل (دقائق)'),
        type: 'number',
        min: 0,
        max: 1440,
        value: v?.setup ?? 0
      },
      {
        id: 'cleanupMinutes',
        label: L('Clean-up time after (minutes)', 'وقت التنظيف بعد (دقائق)'),
        type: 'number',
        min: 0,
        max: 1440,
        value: v?.cleanup ?? 0
      },
      {
        id: 'publicDescription',
        label: L('Public description', 'الوصف العام'),
        type: 'textarea',
        max: 500,
        value: v?.desc
      },
      {
        id: 'exclusionResourceIds',
        label: L('Cannot be used at the same time as', 'لا تُستعمل في الوقت نفسه مع'),
        type: 'checks',
        value: v?.exclusions || [],
        options: VENUES.filter(x => x.id !== v?.id).map(x => [x.id, L(x.name, x.ar)])
      }
    ],
    confirm: v ? L('Save', 'حفظ') : L('Add', 'إضافة'),
    run: f =>
      API.saveFacility(
        v?.id,
        { ...f, capacity: f.capacity || 0, setupMinutes: f.setupMinutes || 0, cleanupMinutes: f.cleanupMinutes || 0 },
        v?.version
      ),
    success: (r, f) => [v ? L('Room saved', 'حُفظت القاعة') : L('Room added', 'أُضيفت القاعة'), f.name]
  });
}

/* The API takes a room out of service or back in, with a reason, and no dates. */
function serviceForm(v, back) {
  ask({
    title: back
      ? L(`Return ${v.name} to service`, `إعادة ${v.ar} إلى الخدمة`)
      : L(`Take ${v.name} out of service`, `إخراج ${v.ar} من الخدمة`),
    sub: back
      ? L('Reservations can be requested for it again.', 'يمكن طلب الحجز فيها من جديد.')
      : L(
          'It is refused while the room has current or future reservations: cancel or move them first. The reason is recorded with the change.',
          'يُرفض ذلك ما دامت للقاعة حجوزات حالية أو مقبلة: ألغها أو انقلها أولاً. يُسجَّل السبب مع التغيير.'
        ),
    fields: [{ id: 'reason', label: L('Reason', 'السبب'), type: 'textarea', req: true, max: 2000, value: '' }],
    confirm: back ? L('Return to service', 'إعادة إلى الخدمة') : L('Take out of service', 'إخراج من الخدمة'),
    tone: back ? 'primary' : 'danger',
    run: f => API.setFacilityStatus(v.id, back ? 'Serviceable' : 'OutOfService', f.reason, v.version),
    success: () => [back ? L('Back in service', 'عادت إلى الخدمة') : L('Out of service', 'خرجت من الخدمة'), v.name]
  });
}

/* ---------------- equipment ---------------- */
function equipmentForm(e) {
  ask({
    title: e ? L('Edit equipment', 'تعديل التجهيز') : L('New equipment', 'تجهيز جديد'),
    sub: L(
      'The count cannot drop below what active bookings hold.',
      'لا يمكن أن ينقص العدد عمّا تحجزه الحجوزات الفعّالة.'
    ),
    fields: [
      { id: 'name', label: L('Name', 'الاسم'), req: true, value: e?.name, max: 300 },
      { id: 'quantity', label: L('How many', 'العدد'), type: 'number', min: 0, req: true, value: e?.qty ?? 1 },
      { id: 'storage', label: L('Where it is kept', 'مكان الحفظ'), opt: true, value: e?.storage, max: 300 },
      { id: 'condition', label: L('Condition note', 'ملاحظة عن الحالة'), opt: true, value: e?.note, max: 500 },
      {
        id: 'status',
        label: L('Status', 'الحالة'),
        type: 'select',
        value: e?.status || 'Serviceable',
        options: [
          ['Serviceable', L('Serviceable', 'صالح')],
          ['OutOfService', L('Out of service', 'خارج الخدمة')],
          ['Retired', L('Retired', 'متقاعد')]
        ]
      }
    ],
    confirm: e ? L('Save', 'حفظ') : L('Add', 'إضافة'),
    run: f => API.saveEquipment(e?.id, { ...f, quantity: f.quantity ?? 0 }, e?.version),
    success: (r, f) => [e ? L('Equipment saved', 'حُفظ التجهيز') : L('Equipment added', 'أُضيف التجهيز'), f.name]
  });
}

const BOOKING_STATE = () => ({
  Booked: [L('Booked', 'محجوز'), 'info'],
  Issued: [L('Out on loan', 'معار'), 'warning'],
  Returned: [L('Returned', 'أُعيد'), 'success'],
  Cancelled: [L('Cancelled', 'ملغى'), 'danger']
});

/* An item's bookings: the API lends equipment against a calendar event (book, issue, return, cancel). */
function loansDrawer(eq) {
  openDrawer({
    large: true,
    title: L(`Loans — ${eq.name}`, `الإعارة — ${eq.ar}`),
    sub: L(`${eq.qty} in total, ${eq.out} out on loan`, `${eq.qty} في المجموع، ${eq.out} معارة`),
    body: <div id="loans">{L('Loading…', 'جارٍ التحميل…')}</div>,
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>{' '}
        <button className="btn btn-primary" id="book-eq" style={{ marginInlineStart: 'auto' }}>
          <Icon name="plus" size={16} />
          {L('Book for an event', 'حجز لحدث')}
        </button>
      </>
    ),
    onMount(el) {
      const act = (booking, title, fields, body, ok) =>
        ask({
          title,
          fields,
          confirm: title,
          run: f => API.equipmentBookingAction(booking, body(f)),
          success: () => [ok, eq.name]
        });
      el.querySelector('#book-eq').addEventListener('click', async () => {
        let events;
        try {
          events = await API.upcomingEvents();
        } catch (e) {
          return failure(L('Could not load events', 'تعذّر تحميل الأحداث'), e);
        }
        if (!events.length)
          return toast(
            L('No upcoming events', 'لا أحداث مقبلة'),
            L(
              'Equipment is booked for a calendar event. Add the event in the calendar first.',
              'يُحجز التجهيز لحدث في الرزنامة. أضف الحدث في الرزنامة أولاً.'
            ),
            'warning'
          );
        ask({
          title: L('Book for an event', 'حجز لحدث'),
          sub: L(`${eq.name} — ${eq.qty - eq.out} not out on loan`, `${eq.ar} — ${eq.qty - eq.out} غير معارة`),
          fields: [
            {
              id: 'eventId',
              label: L('Event', 'الحدث'),
              type: 'select',
              req: true,
              options: events.map(e => [e.id, `${e.title} · ${fmtDate(e.startsAt.slice(0, 10))}`])
            },
            { id: 'quantity', label: L('How many', 'العدد'), type: 'number', min: 1, req: true, value: 1 }
          ],
          confirm: L('Book', 'حجز'),
          run: f => API.bookEquipment(eq.id, f.eventId, f.quantity),
          success: () => [L('Booked', 'تم الحجز'), eq.name]
        });
      });
      API.equipmentBookings(eq.id).then(
        rows => {
          const list = rows
            .map(r => ({ ...r.value, version: r.version }))
            .sort((a, b) => (a.startsAt < b.startsAt ? 1 : -1));
          paint(
            el.querySelector('#loans'),
            list.length ? (
              <ol className="avail-list">
                {list.map(b => {
                  const [label, tone] = BOOKING_STATE()[b.status] || [b.status, ''];
                  return (
                    <li key={b.id} className="held">
                      <span className="tm mono">{fmtDate(b.startsAt.slice(0, 10))}</span>
                      <span className="grow">
                        <b>
                          {b.quantity} × {eq.name}
                        </b>
                        <small>
                          {b.issuedTo ? L(`Issued to ${b.issuedTo}`, `سُلّمت إلى ${b.issuedTo}`) : ''}
                          {b.status === 'Returned'
                            ? ` ${L(`${b.returnedQuantity} back, ${b.returnCondition}`, `${b.returnedQuantity} عادت، ${b.returnCondition}`)}`
                            : ''}
                          {b.reason ? ` ${b.reason}` : ''}
                        </small>
                        <span className="avail-state">
                          <Pill label={label} tone={tone} />
                        </span>
                        <span className="row" style={{ gap: '6px', marginTop: '6px' }}>
                          {b.status === 'Booked' ? (
                            <>
                              <button className="btn btn-secondary btn-dense" data-bk-issue={b.id}>
                                {L('Issue', 'تسليم')}
                              </button>
                              <button className="btn btn-ghost btn-dense" data-bk-cancel={b.id}>
                                {L('Cancel', 'إلغاء')}
                              </button>
                            </>
                          ) : b.status === 'Issued' ? (
                            <button className="btn btn-secondary btn-dense" data-bk-return={b.id}>
                              {L('Record return', 'تسجيل الإعادة')}
                            </button>
                          ) : (
                            ''
                          )}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <Empty
                glyph="rooms"
                title={L('No bookings', 'لا حجوزات')}
                body={L('Nothing is booked or out on loan.', 'لا شيء محجوز أو معار.')}
              />
            )
          );
          const byId = id => list.find(b => b.id === id);
          el.querySelectorAll('[data-bk-issue]').forEach(btn =>
            btn.addEventListener('click', () =>
              act(
                byId(btn.dataset.bkIssue),
                L('Issue', 'تسليم'),
                [{ id: 'to', label: L('Taken by', 'المستلم'), req: true, max: 300 }],
                f => ({ action: 'issue', issuedTo: f.to }),
                L('Issued', 'سُلّم')
              )
            )
          );
          el.querySelectorAll('[data-bk-cancel]').forEach(btn =>
            btn.addEventListener('click', () =>
              act(
                byId(btn.dataset.bkCancel),
                L('Cancel booking', 'إلغاء الحجز'),
                [{ id: 'reason', label: L('Why', 'السبب'), type: 'textarea', req: true }],
                f => ({ action: 'cancel', reason: f.reason }),
                L('Booking cancelled', 'أُلغي الحجز')
              )
            )
          );
          el.querySelectorAll('[data-bk-return]').forEach(btn =>
            btn.addEventListener('click', () => {
              const b = byId(btn.dataset.bkReturn);
              act(
                b,
                L('Record return', 'تسجيل الإعادة'),
                [
                  {
                    id: 'back',
                    label: L('Units returned', 'الوحدات المُعادة'),
                    type: 'number',
                    min: 0,
                    req: true,
                    value: b.quantity
                  },
                  {
                    id: 'condition',
                    label: L('Condition', 'الحالة'),
                    type: 'select',
                    value: 'Good',
                    options: [
                      ['Good', L('Good', 'جيدة')],
                      ['Damaged', L('Damaged', 'متضررة')]
                    ]
                  },
                  {
                    id: 'evidence',
                    label: L(
                      'Evidence (needed if units are missing or damaged)',
                      'إثبات (مطلوب عند فقدان أو تضرر وحدات)'
                    ),
                    opt: true,
                    max: 1000
                  }
                ],
                f => ({
                  action: 'return',
                  returnedQuantity: f.back ?? 0,
                  condition: f.condition,
                  evidence: f.evidence || null
                }),
                L('Return recorded', 'سُجّلت الإعادة')
              );
            })
          );
        },
        e =>
          paint(
            el.querySelector('#loans'),
            <C.InlineAlert tone="warning" title={L('Could not load', 'تعذّر التحميل')} body={e.message} />
          )
      );
    }
  });
}

/* ---------------- issues ---------------- */
const URGENCY = () => ({
  Low: [L('Low', 'منخفضة'), ''],
  Normal: [L('Normal', 'عادية'), 'info'],
  Urgent: [L('Urgent', 'عاجلة'), 'warning'],
  Hazard: [L('Hazard', 'خطر'), 'danger']
});
const ISSUE_STATE = () => ({
  Reported: [L('Reported', 'مبلَّغ عنه'), 'warning'],
  Triaged: [L('Triaged', 'تم الفرز'), 'info'],
  InRepair: [L('In repair', 'قيد الإصلاح'), 'info'],
  Resolved: [L('Fixed', 'أُصلح'), 'success'],
  Dismissed: [L('Dismissed', 'مُهمَل'), '']
});

function issueForm() {
  const places = [
    ...VENUES.map(v => [`Facility|${v.id}`, L(v.name, v.ar)]),
    ...EQUIPMENT.map(e => [`Equipment|${e.id}`, L(`${e.name} (equipment)`, `${e.ar} (تجهيز)`)])
  ];
  ask({
    title: L('Report an issue', 'الإبلاغ عن عطل'),
    fields: [
      { id: 'where', label: L('Where', 'أين'), type: 'select', req: true, options: places },
      { id: 'description', label: L('What is wrong', 'ما العطل'), type: 'textarea', req: true, max: 4000 },
      {
        id: 'urgency',
        label: L('How urgent', 'مدى الاستعجال'),
        type: 'select',
        value: 'Normal',
        options: Object.entries(URGENCY()).map(([k, [label]]) => [k, label])
      },
      { id: 'evidence', label: L('Photo link or note', 'رابط صورة أو ملاحظة'), opt: true, max: 1000 }
    ],
    confirm: L('Report', 'إبلاغ'),
    run: f => {
      const [resourceKind, resourceId] = f.where.split('|');
      return API.reportIssue({
        resourceKind,
        resourceId,
        description: f.description,
        urgency: f.urgency,
        evidence: f.evidence || null
      });
    },
    success: () => [L('Issue reported', 'تم الإبلاغ'), '']
  });
}

function issueDrawer(i) {
  const [label, tone] = ISSUE_STATE()[i.status] || [i.status, ''];
  const step = (title, action, fields, body, ok, tn = 'primary') =>
    ask({
      title,
      fields,
      confirm: title,
      tone: tn,
      run: f => API.issueAction(i, { action, ...body(f) }),
      success: () => [ok, nameOf(i.venue)]
    });
  const open = ['Reported', 'Triaged', 'InRepair'].includes(i.status);
  openDrawer({
    title: i.what,
    sub: <>{nameOf(i.venue)}</>,
    body: (
      <>
        <dl className="dl">
          <dt>{L('Status', 'الحالة')}</dt>
          <dd>
            <Pill label={label} tone={tone} />
          </dd>
          <dt>{L('Urgency', 'الاستعجال')}</dt>
          <dd>{(URGENCY()[i.urgency] || [i.urgency])[0]}</dd>
          <dt>{L('Reported', 'تاريخ الإبلاغ')}</dt>
          <dd className="mono">{i.at ? fmtDate(i.at) : '—'}</dd>
          {i.evidence ? (
            <>
              <dt>{L('Evidence', 'إثبات')}</dt>
              <dd>{i.evidence}</dd>
            </>
          ) : null}
          {i.triageNote ? (
            <>
              <dt>{L('Note', 'ملاحظة')}</dt>
              <dd>{i.triageNote}</dd>
            </>
          ) : null}
          {i.resolutionEvidence ? (
            <>
              <dt>{L('Fixed — evidence', 'الإصلاح — الإثبات')}</dt>
              <dd>{i.resolutionEvidence}</dd>
            </>
          ) : null}
          {i.costNote ? (
            <>
              <dt>{L('Cost', 'الكلفة')}</dt>
              <dd>{i.costNote}</dd>
            </>
          ) : null}
        </dl>
        {i.urgency === 'Urgent' || i.urgency === 'Hazard' ? (
          <C.InlineAlert
            tone="info"
            title={L('Cleared by someone else', 'يُغلقه شخص آخر')}
            body={L(
              ' An urgent issue or hazard is fixed or dismissed by someone other than the person who reported it.',
              ' يُصلح العطل العاجل أو الخطر أو يُهمل بواسطة شخص غير من أبلغ عنه.'
            )}
          />
        ) : null}
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>
        {open ? (
          <span className="row" style={{ gap: '6px', marginInlineStart: 'auto' }}>
            {i.status !== 'InRepair' ? (
              <button className="btn btn-danger-quiet" id="is-dismiss">
                {L('Dismiss', 'إهمال')}
              </button>
            ) : null}
            {i.status === 'Reported' ? (
              <button className="btn btn-primary" id="is-triage">
                {L('Triage', 'فرز')}
              </button>
            ) : null}
            {i.status === 'Triaged' ? (
              <button className="btn btn-secondary" id="is-start">
                {L('Start repair', 'بدء الإصلاح')}
              </button>
            ) : null}
            {i.status !== 'Reported' ? (
              <button className="btn btn-primary" id="is-resolve">
                {L('Mark fixed', 'تم الإصلاح')}
              </button>
            ) : null}
          </span>
        ) : null}
      </>
    ),
    onMount(el) {
      const on = (sel, fn) => el.querySelector(sel)?.addEventListener('click', fn);
      on('#is-triage', () =>
        step(
          L('Triage', 'فرز'),
          'triage',
          [{ id: 'note', label: L('Note', 'ملاحظة'), type: 'textarea', max: 2000 }],
          f => ({ note: f.note || null }),
          L('Triaged', 'تم الفرز')
        )
      );
      on('#is-start', () =>
        step(L('Start repair', 'بدء الإصلاح'), 'start-repair', [], () => ({}), L('Repair started', 'بدأ الإصلاح'))
      );
      on('#is-resolve', () =>
        step(
          L('Mark fixed', 'تم الإصلاح'),
          'resolve',
          [
            { id: 'evidence', label: L('What was done (evidence)', 'ما تم (إثبات)'), req: true, max: 1000 },
            { id: 'cost', label: L('Cost note', 'ملاحظة عن الكلفة'), opt: true, max: 500 }
          ],
          f => ({ evidence: f.evidence, costNote: f.cost || null }),
          L('Marked fixed', 'تم الإصلاح')
        )
      );
      on('#is-dismiss', () =>
        step(
          L('Dismiss', 'إهمال'),
          'dismiss',
          [{ id: 'note', label: L('Why', 'السبب'), type: 'textarea', req: true, max: 2000 }],
          f => ({ note: f.note }),
          L('Dismissed', 'أُهمل'),
          'danger'
        )
      );
    }
  });
}

/* ---------------- external renters ---------------- */
function renterForm() {
  ask({
    title: L('Add an external renter', 'إضافة مستأجر خارجي'),
    sub: L('A renter is kept apart from parish membership.', 'يُحفظ المستأجر منفصلاً عن عضوية الرعية.'),
    fields: [
      { id: 'name', label: L('Name', 'الاسم'), req: true, max: 200 },
      { id: 'organization', label: L('Organisation', 'الجهة'), opt: true, max: 200 },
      {
        id: 'responsibleContact',
        label: L('Responsible contact (phone or email)', 'جهة الاتصال المسؤولة'),
        req: true,
        max: 320
      },
      { id: 'verificationReference', label: L('Identity or reference checked', 'مرجع التحقق'), opt: true, max: 300 }
    ],
    confirm: L('Add renter', 'إضافة مستأجر'),
    run: f =>
      API.createRenter({
        ...f,
        organization: f.organization || null,
        verificationReference: f.verificationReference || null
      }),
    success: (r, f) => [L('Renter added', 'أُضيف المستأجر'), f.name]
  });
}

async function rentalForm() {
  let renters;
  try {
    renters = (await API.rentalRenters()) || [];
  } catch (e) {
    return failure(L('Could not load renters', 'تعذّر تحميل المستأجرين'), e);
  }
  const free = RESERVATIONS.filter(r => r.status !== 'rejected' && !r.redacted && !RENTALS.some(x => x.id === r.id));
  if (!free.length || !renters.length)
    return toast(
      !renters.length
        ? L('Add a renter first', 'أضف مستأجراً أولاً')
        : L('No reservation without terms', 'لا حجز بلا شروط'),
      !renters.length
        ? L('Terms are proposed for a renter and a reservation.', 'تُقترح الشروط لمستأجر ولحجز.')
        : L('Every current reservation already has rental terms.', 'لكل حجز حالي شروط إيجار.'),
      'warning'
    );
  ask({
    title: L('Propose rental terms', 'اقتراح شروط الإيجار'),
    sub: L(
      'A finance approver other than you approves the terms before the renter accepts. Nothing is charged or received here.',
      'يوافق على الشروط معتمد مالي غيرك قبل قبول المستأجر. لا يُحتسب أو يُستلم أي مبلغ هنا.'
    ),
    fields: [
      {
        id: 'reservation',
        label: L('Reservation', 'الحجز'),
        type: 'select',
        req: true,
        options: free.map(r => [r.id, `${r.title || r.ref} · ${nameOf(r.venue)} · ${fmtDate(r.date)}`])
      },
      {
        id: 'renterId',
        label: L('Renter', 'المستأجر'),
        type: 'select',
        req: true,
        options: renters.map(r => [r.id, r.name])
      },
      { id: 'fee', label: L('Fee', 'البدل'), type: 'number', min: 0, value: 0 },
      { id: 'deposit', label: L('Deposit', 'العربون'), type: 'number', min: 0, value: 0 },
      { id: 'currency', label: L('Currency (3 letters)', 'العملة (3 أحرف)'), req: true, value: 'USD', max: 3 },
      { id: 'terms', label: L('Terms', 'الشروط'), type: 'textarea', req: true, max: 4000 }
    ],
    confirm: L('Propose', 'اقتراح'),
    run: f =>
      API.proposeRental(f.reservation, {
        renterId: f.renterId,
        fee: f.fee ?? 0,
        deposit: f.deposit ?? 0,
        currency: f.currency.toUpperCase(),
        terms: f.terms
      }),
    success: () => [L('Terms proposed', 'اقتُرحت الشروط'), '']
  });
}

/* ---------------- the page ---------------- */
export function facilities(tab = '') {
  const head = (
    <>
      <PageHead
        crumbs={[{ label: L('Spaces', 'المرافق') }, { label: L('Facilities', 'المرافق') }]}
        title={L('Facilities and resources', 'المرافق والموارد')}
        sub={L(
          'Rooms and spaces with capacity, set-up time and what excludes what; equipment, issues and external renters.',
          'قاعات ومساحات مع السعة ووقت التجهيز والتعارضات؛ والتجهيزات والأعطال والمستأجرون الخارجيون.'
        )}
        actions={
          <button className="btn btn-primary" id="newvenue">
            <Icon name="plus" size={17} />
            {L('Add facility', 'إضافة مرفق')}
          </button>
        }
      />
      <TabBar base="facilities" items={FTABS()} active={tab} />
    </>
  );
  if (tab === 'equipment') {
    /* narrow the list by name, and by whether it can go out today, is out, or needs attention */
    const f = S.ui.eqFilter || 'all',
      attention = e => e.status !== 'Serviceable';
    const FILTERS = [
      ['all', L('All', 'الكل'), () => true],
      ['available', L('Available now', 'متاح الآن'), e => e.qty - e.out > 0],
      ['loan', L('On loan', 'معار'), e => e.out > 0],
      ['service', L('Needs attention', 'يحتاج عناية'), attention]
    ];
    const keep = (FILTERS.find(([k]) => k === f) || FILTERS[0])[2];
    return (
      <>
        {head}
        <div className="tabbody">
          <Notice area="equipment" />
          <div className="toolbar eqbar" style={{ marginBottom: '14px' }}>
            <div className="grow">
              <C.SearchClear ph={L('Search equipment', 'ابحث في التجهيزات')} id="eqsearch" data-find="" />
            </div>{' '}
            <span className="seg" role="group" aria-label={L('Show', 'عرض')}>
              {FILTERS.map(([k, lab, test], i) => (
                <button key={i} type="button" aria-pressed={f === k} data-act={`eq-filter:${k}`}>
                  {lab}
                  <span className="segn">{EQUIPMENT.filter(test).length}</span>
                </button>
              ))}
            </span>
          </div>{' '}
          <Table
            cols={[
              { label: L('Item', 'الصنف'), sort: true },
              { label: L('Total', 'الإجمالي'), cls: 'num hide-sm' },
              { label: L('On loan', 'معار'), cls: 'num hide-sm' },
              { label: L('Available', 'متاح'), cls: 'num' },
              { label: L('Custody', 'العهدة'), cls: 'hide-md' },
              { label: L('Condition', 'الحالة'), cls: 'shrink' },
              { label: '', cls: 'shrink' }
            ]}
            rows={EQUIPMENT.filter(keep).map(e => ({
              attrs: 'data-find-item',
              cells: [
                <b>{L(e.name, e.ar)}</b>,
                <span className="num">{e.qty}</span>,
                <span className="num">{e.out}</span>,
                <span className="num">{e.qty - e.out}</span>,
                <span className="dim">
                  {e.custody.length
                    ? e.custody
                        .map(c => `${c.to || '—'} · ${L('until', 'حتى')} ${fmtDate(String(c.until).slice(0, 10))}`)
                        .join('; ')
                    : e.storage || '—'}
                </span>,
                <>
                  {e.status === 'OutOfService' ? (
                    <Pill label={L('Out of service', 'خارج الخدمة')} tone="warning" />
                  ) : e.status === 'Retired' ? (
                    <Pill label={L('Retired', 'متقاعد')} />
                  ) : (
                    <Pill label={L('Serviceable', 'صالح')} tone="success" />
                  )}
                  {e.note ? (
                    <small className="t-caption dim" style={{ display: 'block' }}>
                      {e.note}
                    </small>
                  ) : null}
                </>,
                <span className="row" style={{ gap: '6px', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary btn-dense" data-loans={e.id}>
                    {L('Loans', 'الإعارة')}
                  </button>
                  <button className="btn btn-secondary btn-dense" data-eq-edit={e.id}>
                    {L('Edit', 'تعديل')}
                  </button>
                </span>
              ]
            }))}
            empty={
              EQUIPMENT.length ? (
                <Empty
                  glyph="filter"
                  title={L('Nothing in this view', 'لا شيء في هذا العرض')}
                  body={L(
                    'Choose another filter to see the rest of the equipment.',
                    'اختر مرشّحاً آخر لرؤية بقية التجهيزات.'
                  )}
                  action={
                    <button className="btn btn-secondary btn-dense" data-act="eq-filter:all">
                      {L('Show all equipment', 'عرض كل التجهيزات')}
                    </button>
                  }
                />
              ) : (
                <Empty
                  glyph="rooms"
                  title={L('No equipment recorded', 'لا تجهيزات مسجّلة')}
                  body={L(
                    'Add what the parish lends out — microphones, projectors, chairs.',
                    'أضف ما تعيره الرعية — مايكروفونات، أجهزة عرض، كراسي.'
                  )}
                />
              )
            }
          />{' '}
          <div className="find-empty" hidden>
            <Empty
              glyph="search"
              title={L('No equipment matches', 'لا تجهيزات مطابقة')}
              body={L('Try another name.', 'جرّب اسماً آخر.')}
            />
          </div>{' '}
          <button className="btn btn-secondary" style={{ marginTop: '16px' }} id="neweq">
            <Icon name="plus" size={17} />
            {L('Add equipment', 'إضافة تجهيز')}
          </button>
        </div>
      </>
    );
  }
  if (tab === 'maintenance')
    return (
      <>
        {head}
        <div className="tabbody">
          <Notice area="facilities" />
          <Table
            cols={[
              { label: L('Room', 'القاعة') },
              { label: L('Status', 'الحالة'), cls: 'shrink' },
              { label: '', cls: 'shrink' }
            ]}
            rows={MAINTENANCE.map(m => ({
              cells: [
                <b>{nameOf(m.venue)}</b>,
                <Pill label={L('Out of service', 'خارج الخدمة')} tone="danger" />,
                <button className="btn btn-secondary btn-dense" data-return={m.venue}>
                  {L('Return to service', 'إعادة إلى الخدمة')}
                </button>
              ]
            }))}
            empty={
              <Empty
                glyph="rooms"
                title={L('Every room is in service', 'كل القاعات في الخدمة')}
                body={L(
                  'Take a room out of service with the button on its card in Rooms.',
                  'أخرج قاعة من الخدمة بالزرّ على بطاقتها في القاعات.'
                )}
              />
            }
          />{' '}
          <C.InlineAlert
            tone="info"
            title={L('Out of service has no dates', 'الإخراج من الخدمة بلا تواريخ')}
            body={L(
              ' A room is either in service or not, until someone returns it. The reason is recorded with the change but the API does not return it, so it is not shown here. A room with current or future reservations cannot be taken out of service.',
              ' القاعة إما في الخدمة أو لا، حتى يعيدها أحد. يُسجَّل السبب مع التغيير لكن الواجهة البرمجية لا تعيده فلا يظهر هنا. لا يمكن إخراج قاعة لها حجوزات حالية أو مقبلة.'
            )}
          />
        </div>
      </>
    );
  if (tab === 'issues')
    return (
      <>
        {head}
        <div className="tabbody">
          <Notice area="issues" />
          <Table
            cols={[
              { label: L('Where', 'أين') },
              { label: L('Reported', 'العطل') },
              { label: L('Urgency', 'الاستعجال'), cls: 'hide-sm' },
              { label: L('When', 'متى'), cls: 'hide-md' },
              { label: L('Status', 'الحالة'), cls: 'shrink' },
              { label: '', cls: 'shrink' }
            ]}
            rows={ISSUES.map(i => ({
              cells: [
                <b>{nameOf(i.venue)}</b>,
                i.what,
                <Pill label={(URGENCY()[i.urgency] || [i.urgency])[0]} tone={(URGENCY()[i.urgency] || [])[1]} />,
                <span className="mono dim">{i.at ? fmtDate(i.at) : '—'}</span>,
                <Pill label={(ISSUE_STATE()[i.status] || [i.status])[0]} tone={(ISSUE_STATE()[i.status] || [])[1]} />,
                <button className="btn btn-secondary btn-dense" data-issue={i.id}>
                  {L('Open', 'فتح')}
                </button>
              ]
            }))}
            empty={
              <Empty
                glyph="check"
                title={L('Nothing reported', 'لا أعطال مبلَّغ عنها')}
                body={L('Anything broken in a room can be reported here.', 'أيّ عطل في قاعة يُبلَّغ عنه هنا.')}
              />
            }
          />{' '}
          <button className="btn btn-secondary" style={{ marginTop: '16px' }} id="newissue">
            <Icon name="plus" size={17} />
            {L('Report an issue', 'الإبلاغ عن عطل')}
          </button>
        </div>
      </>
    );
  if (tab === 'rentals')
    return (
      <>
        {head}
        <div className="tabbody">
          <Notice area="rentals" />
          <Table
            cols={[
              { label: L('Renter', 'المستأجر') },
              { label: L('Room', 'القاعة'), cls: 'hide-sm' },
              { label: L('Date', 'التاريخ') },
              { label: L('Deposit', 'العربون'), cls: 'num' },
              { label: L('Charge', 'البدل'), cls: 'num' },
              { label: L('Status', 'الحالة'), cls: 'shrink' },
              { label: '', cls: 'shrink' }
            ]}
            rows={RENTALS.map(r => ({
              cells: [
                <b>{r.who || '—'}</b>,
                <span className="dim">{nameOf(r.venue)}</span>,
                <span className="mono dim">{r.date ? fmtDate(r.date) : '—'}</span>,
                <span className="num">{money(r.deposit, r.currency)}</span>,
                <span className="num">{money(r.charge, r.currency)}</span>,
                <Pill
                  label={
                    {
                      Proposed: L('Proposed', 'مقترح'),
                      Approved: L('Approved', 'موافَق عليه'),
                      Accepted: L('Accepted', 'مقبول')
                    }[r.status] || r.status
                  }
                  tone={r.status === 'Accepted' ? 'success' : 'warning'}
                />,
                <a className="btn btn-secondary btn-dense" href="#/finance">
                  {L('In Finance', 'في المالية')}
                </a>
              ]
            }))}
            empty={
              <Empty
                glyph="rooms"
                title={L('No rental agreements', 'لا اتفاقات إيجار')}
                body={L(
                  'Propose terms for a reservation made by an outside renter.',
                  'اقترح شروطاً لحجز قدّمه مستأجر من خارج الرعية.'
                )}
              />
            }
          />{' '}
          <div className="row" style={{ gap: '8px', marginTop: '16px' }}>
            <button className="btn btn-secondary" id="newrental">
              <Icon name="plus" size={17} />
              {L('Propose rental terms', 'اقتراح شروط إيجار')}
            </button>
            <button className="btn btn-secondary" id="newrenter">
              <Icon name="plus" size={17} />
              {L('Add renter', 'إضافة مستأجر')}
            </button>
          </div>
          <p className="t-caption dim" style={{ marginTop: '16px' }}>
            {L(
              'Approving terms, the renter’s acceptance, deposits, fees and refunds are recorded by finance staff; the hall never keeps its own cash book.',
              'يسجّل موظفو المالية الموافقة على الشروط وقبول المستأجر والعرابين والبدلات والاسترجاعات، فلا تحتفظ القاعة بدفتر نقد خاص بها.'
            )}
          </p>
        </div>
      </>
    );
  const cards = VENUES.map((v, i) => {
    const blocked = v.status !== 'Serviceable';
    return (
      <section key={i} className="panel">
        <div className="panel-b">
          <div
            style={{
              height: '96px',
              margin: '-24px -24px 16px',
              background: 'linear-gradient(135deg,var(--primary-subtle),var(--muted))',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--primary)'
            }}
          >
            <Icon name="rooms" size={30} />
          </div>{' '}
          <div className="row" style={{ gap: '10px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block', font: '600 16px/22px var(--sans)' }}>{L(v.name, v.ar)}</b>{' '}
              <small className="t-caption dim">
                {L(v.kind, v.kindAr)} · {L('seats', 'يتّسع لـ')} <span className="tnum">{v.cap}</span>
              </small>
            </div>
            <button className="btn btn-ghost btn-dense" data-edit={v.id}>
              {L('Edit', 'تعديل')}
            </button>
          </div>{' '}
          <div className="row" style={{ gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
            {blocked ? <Pill label={L('Out of service', 'خارج الخدمة')} tone="danger" /> : null}
            {v.setup ? <Pill label={L(`${v.setup} min set-up`, `${v.setup} د تجهيز`)} /> : null}
            {v.cleanup ? <Pill label={L(`${v.cleanup} min clean-up`, `${v.cleanup} د تنظيف`)} /> : null}
          </div>
          {v.desc ? (
            <p className="t-caption dim" style={{ marginTop: '10px' }}>
              {v.desc}
            </p>
          ) : null}{' '}
          <div className="divider" />{' '}
          <div className="row" style={{ gap: '6px' }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, minHeight: '34px', fontSize: '13px' }}
              data-avail={v.id}
            >
              <Icon name="events" size={15} />
              {L('Availability', 'التوفّر')}
            </button>{' '}
            <button
              className="btn btn-secondary"
              style={{ flex: 1, minHeight: '34px', fontSize: '13px' }}
              data-request={v.id}
              disabled={blocked}
            >
              <Icon name="plus" size={15} />
              {L('Request', 'طلب')}
            </button>
          </div>{' '}
          <button className="btn btn-ghost roomblock" data-block={v.id}>
            <Icon name="warn" size={15} />
            {blocked ? L('Return to service', 'إعادة إلى الخدمة') : L('Take out of service', 'إخراج من الخدمة')}
          </button>
        </div>
      </section>
    );
  });
  return (
    <>
      {head}
      <Notice area="facilities" />
      <Paged style={{ marginTop: '20px' }} className="gridcards">
        {cards.length ? (
          cards
        ) : (
          <Empty
            glyph="rooms"
            title={L('No rooms yet', 'لا قاعات بعد')}
            body={L(
              'Add the church, the hall and every room people can book.',
              'أضف الكنيسة والقاعة وكل مكان يمكن حجزه.'
            )}
          />
        )}
      </Paged>{' '}
      <p className="t-caption dim" style={{ marginTop: '16px' }}>
        {L(
          'Each room carries its capacity, set-up and clean-up time and what it excludes. Step-free access, photos and usage policy are not kept by the API yet.',
          'تحمل كل قاعة سعتها ووقت التجهيز والتنظيف وما تستبعده. إمكانية الوصول والصور وقواعد الاستعمال لا تحفظها الواجهة البرمجية بعد.'
        )}
      </p>
    </>
  );
}

/* ---------- availability: pick any day, see what is busy (set-up and clean-up included) ---------- */
const hhmm = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const isoD = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const OPEN = [7 * 60, 23 * 60]; /* the parish day the timeline shows */
const DAY = 86400000;

const length = n =>
  n >= 60
    ? L(
        `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60} min` : ''}`,
        `${Math.floor(n / 60)} س${n % 60 ? ` ${n % 60} د` : ''}`
      )
    : L(`${n} min`, `${n} د`);

/* The busy stretches of one calendar day, on the clock the reservations use. */
function busyOn(busy, day, zone) {
  const out = [];
  for (const b of busy) {
    const a = API.clock(b.startsAt, zone),
      z = API.clock(b.endsAt, zone);
    if (a.date > day || z.date < day) continue;
    out.push({
      from: a.date < day ? 0 : a.minutes,
      to: z.date > day ? 1440 : z.minutes,
      unavailable: b.status === 'Unavailable'
    });
  }
  return out.filter(x => x.to > x.from).sort((x, y) => x.from - y.from);
}

function freeGaps(items) {
  const gaps = [];
  let at = OPEN[0];
  for (const it of items) {
    if (it.from - at >= 30) gaps.push([at, it.from]);
    at = Math.max(at, it.to);
  }
  if (OPEN[1] - at >= 30) gaps.push([at, OPEN[1]]);
  return gaps;
}

function availabilityDrawer(vid) {
  const v = venue(vid);
  if (!v) return;
  const zone = RESERVATIONS.find(r => r.zone)?.zone || '';
  const now = new Date();
  let day = S.ui.availDay || isoD(now);
  let shown = new Date(+day.slice(0, 4), +day.slice(5, 7) - 1, 1);
  let busy = [],
    loading = true,
    failed = '';
  /* what holds this room, from the reservations loaded: confirmed or being confirmed; requests hold nothing yet */
  const holders = day =>
    RESERVATIONS.filter(
      r => (r.venue === vid || r.rooms.includes(vid)) && ['Confirmed', 'Allocating'].includes(r.api) && r.date === day
    );
  const waiting = day =>
    RESERVATIONS.filter(
      r => (r.venue === vid || r.rooms.includes(vid)) && ['Requested', 'Conflict'].includes(r.api) && r.date === day
    );
  const render = () => {
    const y = shown.getFullYear(),
      m = shown.getMonth(),
      first = new Date(y, m, 1),
      n = new Date(y, m + 1, 0).getDate();
    const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: n }, (_, i) => new Date(y, m, i + 1))];
    const items = busyOn(busy, day, zone),
      out = items.some(i => i.unavailable),
      gaps = out ? [] : freeGaps(items),
      past = day < isoD(now);
    const pct = x =>
      `${(((Math.min(Math.max(x, OPEN[0]), OPEN[1]) - OPEN[0]) / (OPEN[1] - OPEN[0])) * 100).toFixed(2)}%`;
    const width = (a, b) =>
      `${(((Math.min(b, OPEN[1]) - Math.max(a, OPEN[0])) / (OPEN[1] - OPEN[0])) * 100).toFixed(2)}%`;
    const rows = out
      ? []
      : [...items.map(it => ({ at: it.from, it })), ...gaps.map(g => ({ at: g[0], g }))].sort((p, q) => p.at - q.at);
    const named = holders(day),
      asking = waiting(day);
    return (
      <div className="avail">
        <div className="avail-cal">
          <div className="avail-cal-h">
            <C.IconBtn ico="chevL" label={L('Previous month', 'الشهر السابق')} data-avm="-1" />
            <b>
              {month(m)} {y}
            </b>
            <C.IconBtn ico="chevR" label={L('Next month', 'الشهر التالي')} data-avm="1" />
          </div>{' '}
          <div className="avail-grid" role="grid">
            {[0, 1, 2, 3, 4, 5, 6].map((i, k) => (
              <span key={k} className="dh">
                {dayShort(i)}
              </span>
            ))}{' '}
            {cells.map((d, i) => {
              if (!d) return <span key={i} />;
              const k = isoD(d),
                list = busyOn(busy, k, zone),
                bl = list.some(x => x.unavailable),
                held = !bl && list.length;
              return (
                <button
                  key={i}
                  type="button"
                  className={`ad${k === day ? ' on' : ''}${k === isoD(now) ? ' today' : ''}${k < isoD(now) ? ' past' : ''}${bl ? ' blocked' : ''}`}
                  data-avday={k}
                  aria-pressed={k === day}
                  aria-label={`${fmtLong(d)}${bl ? ' · ' + L('out of service', 'خارج الخدمة') : held ? ' · ' + L('busy', 'مشغولة') : ''}`}
                >
                  {d.getDate()}
                  {held ? <i /> : ''}
                </button>
              );
            })}
          </div>{' '}
          <div className="avail-legend">
            <span>
              <i className="lg busy" />
              {L('busy', 'مشغولة')}
            </span>
            <span>
              <i className="lg blocked" />
              {L('out of service', 'خارج الخدمة')}
            </span>
          </div>{' '}
          <label className="avail-jump">
            <span className="t-caption dim">{L('Or go straight to a date', 'أو اذهب إلى تاريخ')}</span>
            <input className="input" type="date" id="av_date" defaultValue={day} />
          </label>
        </div>{' '}
        <div className="avail-day">
          <div className="avail-day-h">
            <div>
              <span className="overline">
                {day === isoD(now) ? L('Today', 'اليوم') : L('Selected day', 'اليوم المحدّد')}
              </span>
              <h4>
                {fmtLong(day)} {day.slice(0, 4)}
              </h4>
            </div>{' '}
            <span className="row" style={{ gap: '6px' }}>
              <C.IconBtn ico="chevL" label={L('Previous day', 'اليوم السابق')} data-avd="-1" />
              <button type="button" className="btn btn-secondary btn-dense" data-avd="0">
                {L('Today', 'اليوم')}
              </button>
              <C.IconBtn ico="chevR" label={L('Next day', 'اليوم التالي')} data-avd="1" />
            </span>
          </div>{' '}
          {failed ? (
            <C.InlineAlert
              tone="warning"
              title={L('Could not load availability', 'تعذّر تحميل التوفّر')}
              body={failed}
            />
          ) : loading ? (
            <p className="t-caption dim">{L('Loading…', 'جارٍ التحميل…')}</p>
          ) : out ? (
            <C.InlineAlert
              tone="warning"
              title={L('Out of service', 'خارج الخدمة')}
              body={L(
                ' No reservations can be made for this room until it is returned to service.',
                ' لا يمكن الحجز في هذه القاعة قبل إعادتها إلى الخدمة.'
              )}
            />
          ) : (
            <>
              <div className="avail-strip" aria-hidden="true">
                {items.map((it, i) => (
                  <span
                    key={i}
                    className="seg approved"
                    style={css(`inset-inline-start:${pct(it.from)};width:${width(it.from, it.to)}`)}
                  />
                ))}
              </div>{' '}
              <div className="avail-scale" aria-hidden="true">
                {[7, 11, 15, 19, 23].map((h, i) => (
                  <span key={i}>{String(h).padStart(2, '0')}:00</span>
                ))}
              </div>{' '}
              <p className="t-caption dim" style={{ margin: '10px 0 8px' }}>
                {items.length
                  ? L(
                      `${items.length} busy stretch${items.length === 1 ? '' : 'es'} · ${gaps.length} free slot${gaps.length === 1 ? '' : 's'} between 07:00 and 23:00. Busy includes the room’s ${v.setup} min set-up and ${v.cleanup} min clean-up.`,
                      `${items.length} فترات مشغولة · ${gaps.length} أوقات متاحة بين 07:00 و23:00. تشمل المشغولة ${v.setup} د تجهيز و${v.cleanup} د تنظيف.`
                    )
                  : L('Free all day, 07:00 – 23:00.', 'متاحة طوال اليوم، 07:00 – 23:00.')}
              </p>{' '}
              <ol className="avail-list">
                {rows.map(({ it, g }, i) =>
                  it ? (
                    <li key={i} className="held">
                      <span className="tm mono">
                        {hhmm(it.from)}–{hhmm(it.to)}
                      </span>
                      <span className="grow">
                        <b>{L('Busy', 'مشغولة')}</b>
                        <span className="avail-state">
                          <Pill label={L('Held', 'محجوزة')} tone="success" />
                        </span>
                      </span>
                    </li>
                  ) : (
                    <li key={i} className="free">
                      <span className="tm mono">
                        {hhmm(g[0])}–{hhmm(g[1])}
                      </span>
                      <span className="grow">
                        <b>{L('Free', 'متاحة')}</b>
                        <small>{length(g[1] - g[0])}</small>
                      </span>
                    </li>
                  )
                )}
              </ol>
              {named.length ? (
                <>
                  <h4 className="t-ui" style={{ margin: '14px 0 6px' }}>
                    {L('Reservations holding the room', 'الحجوزات التي تحجز القاعة')}
                  </h4>
                  <ul className="blocklist">
                    {named.map(r => (
                      <li key={r.id}>
                        <span className="mono dim">
                          {r.from}–{r.to}
                        </span>
                        <b>{r.title || r.ref}</b>
                        <Status k={r.api === 'Confirmed' ? 'approved' : 'pending'} />
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {asking.length ? (
                <>
                  <h4 className="t-ui" style={{ margin: '14px 0 6px' }}>
                    {L('Requests waiting (they do not hold the room yet)', 'طلبات بانتظار القرار (لا تحجز القاعة بعد)')}
                  </h4>
                  <ul className="blocklist">
                    {asking.map(r => (
                      <li key={r.id}>
                        <span className="mono dim">
                          {r.from}–{r.to}
                        </span>
                        <b>{r.title || r.ref}</b>
                        <Status k={r.api === 'Conflict' ? 'conflict' : 'pending'} />
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {past ? (
                <p className="t-caption dim" style={{ margin: '10px 0 0' }}>
                  <Icon name="info" size={14} />{' '}
                  {L('This day has passed — it is shown for reference.', 'مضى هذا اليوم — يُعرض للاطّلاع.')}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    );
  };
  openDrawer({
    large: true,
    title: L(`Availability — ${v.name}`, `التوفّر — ${v.ar || v.name}`),
    sub: `${L(v.kind, v.kindAr || v.kind)} · ${L('seats', 'يتّسع لـ')} ${v.cap}`,
    body: <div id="avbody">{render()}</div>,
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>{' '}
        <button className="btn btn-primary" id="av_book" style={{ marginInlineStart: 'auto' }}>
          <Icon name="plus" size={16} />
          {L('Request this room', 'طلب هذه القاعة')}
        </button>
      </>
    ),
    onMount(el) {
      /* two reads cover the month on any clock: the API lists at most 31 days at a time */
      const fetchMonth = async () => {
        const start = new Date(Date.UTC(shown.getFullYear(), shown.getMonth(), 1) - 14 * 3600000);
        loading = true;
        failed = '';
        redraw();
        try {
          const a = await API.availability(vid, start, new Date(+start + 31 * DAY));
          const b = await API.availability(vid, new Date(+start + 31 * DAY), new Date(+start + 62 * DAY));
          busy = [...a, ...b];
        } catch (e) {
          busy = [];
          failed = e.message;
        }
        loading = false;
        redraw();
      };
      const redraw = () => {
        paint(el.querySelector('#avbody'), render());
        const go = d => {
          const month = d.slice(0, 7) !== `${shown.getFullYear()}-${String(shown.getMonth() + 1).padStart(2, '0')}`;
          day = d;
          shown = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, 1);
          S.ui.availDay = d;
          if (month) fetchMonth();
          else redraw();
        };
        el.querySelectorAll('[data-avday]').forEach(b => b.addEventListener('click', () => go(b.dataset.avday)));
        el.querySelectorAll('[data-avm]').forEach(b =>
          b.addEventListener('click', () => {
            shown = new Date(shown.getFullYear(), shown.getMonth() + +b.dataset.avm, 1);
            fetchMonth();
          })
        );
        el.querySelectorAll('[data-avd]').forEach(b =>
          b.addEventListener('click', () => {
            const n = +b.dataset.avd,
              d = new Date(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + n);
            go(n ? isoD(d) : isoD(new Date()));
          })
        );
        el.querySelector('#av_date')?.addEventListener('change', e => {
          if (e.target.value) go(e.target.value);
        });
      };
      el.querySelector('#av_book').addEventListener('click', () => requestRoomForm({ venue: vid }));
      fetchMonth();
    }
  });
}

facilities.mount = host => {
  const byId = (list, id) => list.find(x => x.id === id);
  host
    .querySelectorAll('[data-avail]')
    .forEach(b => b.addEventListener('click', () => availabilityDrawer(b.dataset.avail)));
  host
    .querySelectorAll('[data-edit]')
    .forEach(b => b.addEventListener('click', () => facilityForm(byId(VENUES, b.dataset.edit))));
  host
    .querySelectorAll('[data-request]')
    .forEach(b => b.addEventListener('click', () => requestRoomForm({ venue: b.dataset.request })));
  host
    .querySelectorAll('[data-block]')
    .forEach(b =>
      b.addEventListener('click', () =>
        serviceForm(byId(VENUES, b.dataset.block), byId(VENUES, b.dataset.block)?.status !== 'Serviceable')
      )
    );
  host
    .querySelectorAll('[data-return]')
    .forEach(b => b.addEventListener('click', () => serviceForm(byId(VENUES, b.dataset.return), true)));
  host.querySelector('#newvenue')?.addEventListener('click', () => facilityForm(null));
  host.querySelector('#neweq')?.addEventListener('click', () => equipmentForm(null));
  host
    .querySelectorAll('[data-eq-edit]')
    .forEach(b => b.addEventListener('click', () => equipmentForm(byId(EQUIPMENT, b.dataset.eqEdit))));
  host
    .querySelectorAll('[data-loans]')
    .forEach(b => b.addEventListener('click', () => loansDrawer(byId(EQUIPMENT, b.dataset.loans))));
  host.querySelector('#newissue')?.addEventListener('click', issueForm);
  host
    .querySelectorAll('[data-issue]')
    .forEach(b => b.addEventListener('click', () => issueDrawer(byId(ISSUES, b.dataset.issue))));
  host.querySelector('#newrental')?.addEventListener('click', rentalForm);
  host.querySelector('#newrenter')?.addEventListener('click', renterForm);
};
