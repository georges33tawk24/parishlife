/* Reservations: room requests for calendar events, their state, clashes, and the decision on each
   (confirm, decline, cancel). Everything comes from ParishLife.Api (model/modules/facilities.js).
   Main functions: reservations (the list), resDrawer (one request, its details, checklist and decision history),
   detailsForm (edit purpose, attendance, contact, notes and checklist), requestRoomForm (ask for a room for a
   draft calendar event).

   The API has one decision step, by someone with facility permission, not a secretary-then-priest chain.
   Confirming queues the allocation: the room is held once the API has allocated it (Confirmed), or the
   request becomes a Conflict. A request waiting for a decision does not hold the room. */
import { css } from '../../ui/html.js';
import { t, fmtDate } from '../../../lib/i18n.js';
import { S } from '../../model/store.js';
import { Icon, PageHead, Status, Pill, Table, Empty, Stat, SearchField, openDrawer, toast } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { RESERVATIONS, venue, resClash, resStatus } from '../../model/data.js';
import * as API from '../../model/modules/facilities.js';
import { ask, failure, Notice } from './forms.jsx';
import { nameOf as accountName } from '../../model/names.js';
import { session } from '../../model/api.js';

const L = (en, ar) => t(en, ar);

const STEPS = [
  ['Requested', 'الطلب'],
  ['Being confirmed', 'قيد التأكيد'],
  ['Confirmed', 'مؤكَّد']
];

const waiting = r => r.api === 'Requested' || r.api === 'Conflict';

/* The state of one request, as a pill. */
function State({ r }) {
  if (r.api === 'Allocating') return <Pill label={L('Being confirmed', 'قيد التأكيد')} tone="info" />;
  if (r.api === 'Cancelling') return <Pill label={L('Cancelling', 'قيد الإلغاء')} tone="info" />;
  if (r.api === 'Conflict') return <Status k="conflict" />;
  return (
    <Status
      k={
        r.api === 'Confirmed'
          ? 'approved'
          : r.api === 'Declined'
            ? 'declined'
            : r.api === 'Cancelled'
              ? 'cancelled'
              : resStatus(r)
      }
    />
  );
}

/* A person named by account id; "system" is the allocation step. */
const person = id =>
  id === 'system' ? L('Allocation', 'التخصيص') : id ? accountName(session.parishId, id) || '—' : '—';

const roomName = id => {
  const v = venue(id);
  return v ? L(v.name, v.ar) : '—';
};
const title = r =>
  r.title ||
  (r.redacted
    ? L('Busy (details are private)', 'مشغولة (التفاصيل خاصة)')
    : L('Event title not available', 'عنوان الحدث غير متاح'));

/* ---------------- reservations ---------------- */
export function reservations() {
  const pending = RESERVATIONS.filter(waiting);
  const clashing = pending.filter(r => r.api === 'Conflict' || resClash(r));
  const f = S.ui.resFilter || 'all';
  const shown = RESERVATIONS.filter(
    r =>
      f === 'all' ||
      (f === 'mine' ? waiting(r) : f === 'approved' ? r.api === 'Confirmed' : ['Declined', 'Cancelled'].includes(r.api))
  );
  const rows = shown.map(r => ({
    cls: 'clickable',
    attrs: `data-res="${r.id}" tabindex="0" data-find-item`,
    cells: [
      <span className="mono" dir="ltr">
        {r.ref}
      </span>,
      <b style={{ font: '500 14px/20px var(--sans)' }}>{title(r)}</b>,
      <span className="dim">{roomName(r.venue)}</span>,
      <span className="dim">
        {fmtDate(r.date)}{' '}
        <span className="mono" dir="ltr">
          {r.from}–{r.to}
        </span>
      </span>,
      <State r={r} />
    ]
  }));
  return (
    <>
      <PageHead
        crumbs={[{ label: L('Spaces', 'المرافق') }, { label: L('Reservations', 'الحجوزات') }]}
        title={L('Reservations', 'الحجوزات')}
        sub={L(
          'A request names a room and a calendar event. Confirming it holds the room, with its set-up and clean-up time, once the API has allocated it; until then the room is not held. Shown: the 31 days before and after today.',
          'يسمّي الطلب قاعة وحدثاً في الرزنامة. تأكيده يحجز القاعة مع وقت التجهيز والتنظيف بعد أن تخصّصها الواجهة البرمجية؛ وقبل ذلك لا تكون القاعة محجوزة. المعروض: ٣١ يوماً قبل اليوم وبعده.'
        )}
        actions={
          <>
            <button className="btn btn-secondary" data-go="facilities">
              <Icon name="events" size={17} />
              {L('Availability', 'التوفّر')}
            </button>{' '}
            <button className="btn btn-primary" id="newres">
              <Icon name="plus" size={17} />
              {L('Request a room', 'طلب قاعة')}
            </button>
          </>
        }
      />{' '}
      <Notice area="reservations" />
      <div className="stats" style={{ marginBottom: '24px' }}>
        <Stat
          k={L('Awaiting a decision', 'بانتظار قرار')}
          v={pending.length}
          d={
            clashing.length ? (
              <span className="down">{L(`${clashing.length} with a clash`, `${clashing.length} فيها تعارض`)}</span>
            ) : (
              L('no clashes', 'بلا تعارض')
            )
          }
        />{' '}
        <Stat
          k={L('Confirmed', 'مؤكَّد')}
          v={RESERVATIONS.filter(r => r.api === 'Confirmed').length}
          d={L(
            `${new Set(RESERVATIONS.filter(r => r.api === 'Confirmed').map(r => r.venue)).size} rooms in use`,
            `${new Set(RESERVATIONS.filter(r => r.api === 'Confirmed').map(r => r.venue)).size} قاعات مستعملة`
          )}
        />{' '}
        <Stat
          k={L('Being confirmed', 'قيد التأكيد')}
          v={RESERVATIONS.filter(r => r.api === 'Allocating' || r.api === 'Cancelling').length}
          d={L('queued with the API', 'في قائمة الواجهة البرمجية')}
        />
      </div>{' '}
      {clashing.slice(0, 1).map((r, i) => {
        const o = resClash(r);
        return (
          <C.InlineAlert
            key={i}
            tone="warning"
            title={
              r.api === 'Conflict'
                ? L(`${r.ref} could not be allocated`, `تعذّر تخصيص ${r.ref}`)
                : L(`${r.ref} overlaps ${o.ref}`, `تداخل بين ${r.ref} و${o.ref}`)
            }
            body={
              r.api === 'Conflict'
                ? L(
                    ' The room was taken, or its set-up or clean-up time overlapped another booking, when the API tried to allocate it. Decline it, or ask for another room.',
                    ' كانت القاعة محجوزة، أو تداخل وقت التجهيز أو التنظيف مع حجز آخر، عندما حاولت الواجهة البرمجية تخصيصها. ارفضه أو اطلب قاعة أخرى.'
                  )
                : L(
                    ' Both want the same room at overlapping times, counting set-up and clean-up. If both are confirmed, the second will come back as a conflict.',
                    ' كلاهما يطلب القاعة نفسها في أوقات متداخلة مع التجهيز والتنظيف. إذا أُكِّد الاثنان فسيعود الثاني كتعارض.'
                  )
            }
          />
        );
      })}{' '}
      <div className="toolbar" style={{ margin: '20px 0 16px' }}>
        <span className="seg" role="group" aria-label={L('Show', 'عرض')}>
          {[
            ['all', 'All', 'الكل'],
            ['mine', 'Awaiting a decision', 'بانتظار قرار'],
            ['approved', 'Confirmed', 'مؤكَّد'],
            ['rejected', 'Declined or cancelled', 'مرفوض أو ملغى']
          ].map(([k, en, ar], i) => (
            <button key={i} aria-pressed={f === k} data-act={`res-filter:${k}`}>
              {L(en, ar)}
            </button>
          ))}
        </span>{' '}
        <div className="grow" style={{ maxWidth: '260px', marginInlineStart: 'auto' }}>
          <SearchField ph={L('Reference or title', 'الرقم أو العنوان')} data-find="" />
        </div>
      </div>{' '}
      <Table
        cols={[
          { label: L('Reference', 'الرقم'), cls: 'shrink' },
          { label: L('Request', 'الطلب'), sort: true, cls: 'wide' },
          { label: L('Room', 'القاعة'), cls: 'hide-sm' },
          { label: L('When', 'الموعد'), cls: 'shrink hide-sm', sort: true },
          { label: L('Status', 'الحالة'), cls: 'shrink' }
        ]}
        rows={rows}
        empty={
          <Empty
            glyph="attend"
            title={L('Nothing here', 'لا شيء هنا')}
            body={
              f === 'all'
                ? L('No room requests in this period.', 'لا طلبات قاعات في هذه الفترة.')
                : L('No request matches this filter.', 'لا طلب يطابق هذا المرشّح.')
            }
          />
        }
      />{' '}
      <div className="find-empty" hidden>
        <Empty
          glyph="search"
          title={L('No request matches', 'لا طلب مطابق')}
          body={L('Try the reference or part of the title.', 'جرّب الرقم أو جزءاً من العنوان.')}
        />
      </div>
    </>
  );
}

/* #/reservations/<id> opens that booking over the list; the address then settles back on Reservations. */
reservations.mount = (host, first) => {
  host.querySelectorAll('[data-res]').forEach(tr => {
    const open = () => resDrawer(tr.dataset.res);
    tr.addEventListener('click', e => {
      if (!e.target.closest('button, a, input, label')) open();
    });
    tr.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target === tr) open();
    });
  });
  host.querySelector('#newres')?.addEventListener('click', () => requestRoomForm({}));
  if (first) {
    S.params = [];
    history.replaceState(null, '', '#/reservations');
    resDrawer(first);
  }
};

/* ---------------- ask for a room ---------------- */
/* A room is requested for the exact period of a draft calendar event. */
export async function requestRoomForm({ venue: room }) {
  const { VENUES } = await import('../../model/data.js');
  let events;
  try {
    events = await API.requestableEvents(
      RESERVATIONS.filter(r => !['Declined', 'Cancelled'].includes(r.api)).map(r => r.eventId)
    );
  } catch (e) {
    return failure(L('Could not load events', 'تعذّر تحميل الأحداث'), e);
  }
  const rooms = VENUES.filter(v => v.status === 'Serviceable');
  if (!events.length || !rooms.length)
    return toast(
      !rooms.length
        ? L('No room in service', 'لا قاعة في الخدمة')
        : L('No draft event to request a room for', 'لا حدث مسوّدة لطلب قاعة له'),
      !rooms.length
        ? L('Add a room, or return one to service.', 'أضف قاعة أو أعدها إلى الخدمة.')
        : L(
            'A room is requested for a draft event in the next 62 days that has none yet. Add the event in the calendar first.',
            'تُطلب القاعة لحدث مسوّدة خلال ٦٢ يوماً مقبلة لا قاعة له. أضف الحدث في الرزنامة أولاً.'
          ),
      'warning'
    );
  ask({
    title: L('Request a room', 'طلب قاعة'),
    sub: L(
      'The request covers the exact period of the event. Someone with facility permission then confirms or declines it.',
      'يشمل الطلب فترة الحدث بالضبط. ثم يؤكّده أو يرفضه من له صلاحية المرافق.'
    ),
    fields: [
      {
        id: 'event',
        label: L('Event', 'الحدث'),
        type: 'select',
        req: true,
        options: events.map(e => {
          const a = API.clock(e.startsAt, e.timeZone),
            b = API.clock(e.endsAt, e.timeZone);
          return [e.id, `${e.title} · ${a.date} ${a.time}–${b.time}`];
        })
      },
      {
        id: 'room',
        label: L('Room', 'القاعة'),
        type: 'select',
        req: true,
        value: room || rooms[0]?.id,
        options: rooms.map(v => [v.id, L(v.name, v.ar)])
      },
      { id: 'purpose', label: L('Purpose', 'الغاية'), opt: true, max: 500 },
      { id: 'purposeAr', label: L('Purpose in Arabic', 'الغاية بالعربية'), opt: true, max: 500 },
      { id: 'people', label: L('People expected', 'العدد المتوقّع'), type: 'number', min: 0 },
      { id: 'phone', label: L('Contact phone', 'هاتف التواصل'), opt: true, max: 50 },
      {
        id: 'terms',
        label: L('Terms agreed (for an outside renter)', 'الشروط المتفق عليها (لمستأجر خارجي)'),
        type: 'textarea',
        max: 10000,
        value: ''
      }
    ],
    confirm: L('Request', 'طلب'),
    run: f =>
      API.requestRoom({
        event: events.find(e => e.id === f.event),
        venue: f.room,
        terms: f.terms,
        purpose: f.purpose,
        purposeAr: f.purposeAr,
        people: f.people,
        phone: f.phone
      }),
    success: () => [L('Room requested', 'طُلبت القاعة'), L('It waits for a decision.', 'بانتظار القرار.')]
  });
}

/* ---------------- one request ---------------- */
function stageBar(r) {
  const idx = r.api === 'Confirmed' ? 2 : r.api === 'Allocating' ? 1 : 0;
  return (
    <div style={{ display: 'flex', margin: '4px 0 20px' }}>
      {STEPS.map(([en, ar], i) => (
        <div key={i} style={{ flex: 1, minWidth: 0 }}>
          <div
            style={css(
              `height:4px;border-radius:99px;background:${i <= idx ? 'var(--primary)' : 'var(--border)'};margin-inline-end:${i === 2 ? 0 : '4px'}`
            )}
          />{' '}
          <div
            className="t-caption"
            style={css(
              `margin-top:8px;color:${i <= idx ? 'var(--text)' : 'var(--text-3)'};font-weight:${i === idx ? 500 : 400}`
            )}
          >
            {L(en, ar)}
          </div>
        </div>
      ))}
    </div>
  );
}

const ERRORS = {
  facility_unavailable: [
    'A room was out of service when allocation was tried.',
    'كانت قاعة خارج الخدمة عند محاولة التخصيص.'
  ],
  resource_conflict: [
    'Another booking or a planned maintenance block holds the room at that time.',
    'حجز آخر أو صيانة مقرّرة تشغل القاعة في ذلك الوقت.'
  ]
};

const DECISION = {
  request: ['Requested', 'طُلب'],
  confirm: ['Confirm asked', 'طُلب التأكيد'],
  decline: ['Declined', 'رُفض'],
  cancel: ['Cancel asked', 'طُلب الإلغاء'],
  confirmed: ['Room allocated', 'خُصّصت القاعة'],
  conflict: ['Could not be allocated', 'تعذّر التخصيص'],
  cancelled: ['Room released', 'حُرّرت القاعة']
};

/* The checklist is edited as lines, "English | Arabic" (the Arabic part optional); ticks are kept by step. */
const toLines = (r, phase) =>
  r.checklist
    .filter(c => c.phase === phase)
    .map(c => (c.labelAr ? `${c.label} | ${c.labelAr}` : c.label))
    .join('\n');
const fromLines = (text, phase, done) =>
  String(text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [label, labelAr] = line.split(' | ').map(s => s.trim());
      return { phase, label, labelAr: labelAr || null, done: done.includes(`${phase}|${label}`) };
    });

function detailsForm(r) {
  ask({
    title: L('Reservation details', 'تفاصيل الحجز'),
    sub: `${r.ref} · ${roomName(r.venue)} · ${fmtDate(r.date)}`,
    fields: [
      { id: 'purpose', label: L('Purpose', 'الغاية'), opt: true, max: 500, value: r.purpose },
      { id: 'purposeAr', label: L('Purpose in Arabic', 'الغاية بالعربية'), opt: true, max: 500, value: r.purposeAr },
      { id: 'people', label: L('People expected', 'العدد المتوقّع'), type: 'number', min: 0, value: r.people ?? '' },
      { id: 'phone', label: L('Contact phone', 'هاتف التواصل'), opt: true, max: 50, value: r.phone },
      { id: 'notes', label: L('Notes', 'ملاحظات'), type: 'textarea', max: 2000, value: r.notes },
      {
        id: 'opening',
        label: L('Opening checklist', 'قائمة الفتح'),
        type: 'textarea',
        value: toLines(r, 'Opening'),
        help: L(
          'One step per line; add " | " and the Arabic if wanted.',
          'خطوة في كل سطر؛ أضف " | " ثم النص العربي إن شئت.'
        )
      },
      { id: 'closing', label: L('Closing checklist', 'قائمة الإغلاق'), type: 'textarea', value: toLines(r, 'Closing') },
      {
        id: 'done',
        label: L('Done', 'أُنجز'),
        type: 'checks',
        value: r.checklist.filter(c => c.done).map(c => `${c.phase}|${c.label}`),
        options: r.checklist.map(c => [`${c.phase}|${c.label}`, L(c.label, c.labelAr || c.label)])
      }
    ],
    confirm: L('Save', 'حفظ'),
    run: f =>
      API.saveReservationDetails(r, {
        ...f,
        checklist: [...fromLines(f.opening, 'Opening', f.done), ...fromLines(f.closing, 'Closing', f.done)]
      }),
    success: () => [L('Details saved', 'حُفظت التفاصيل'), r.ref]
  });
}

function decide(r, action) {
  const text = {
    confirm: [L('Confirm', 'تأكيد'), L('Reservation being confirmed', 'الحجز قيد التأكيد')],
    decline: [L('Decline', 'رفض'), L('Reservation declined', 'رُفض الحجز')],
    cancel: [L('Cancel booking', 'إلغاء الحجز'), L('Cancellation queued', 'طُلب الإلغاء')]
  }[action];
  ask({
    title: text[0],
    sub: `${r.ref} · ${roomName(r.venue)} · ${fmtDate(r.date)}`,
    fields: [
      {
        id: 'reason',
        label: L('Reason, kept with the decision', 'السبب، يُحفظ مع القرار'),
        type: 'textarea',
        req: true,
        max: 2000,
        value: ''
      }
    ],
    confirm: text[0],
    tone: action === 'confirm' ? 'primary' : 'danger',
    run: f => API.decideReservation(r, action, f.reason),
    success: res => [
      text[1],
      res?.status === 'Allocating' || res?.status === 'Cancelling'
        ? L(
            'The API allocates the room in the background. This list shows Confirmed, or Conflict, once it has.',
            'تخصّص الواجهة البرمجية القاعة في الخلفية. تعرض القائمة «مؤكَّد» أو «تعارض» عند انتهائها.'
          )
        : ''
    ]
  });
}

function resDrawer(id) {
  const r = RESERVATIONS.find(x => x.id === id);
  if (!r) return;
  const v = venue(r.venue) || { name: '—', ar: '—', cap: 0 };
  const clash = r.api === 'Requested' ? resClash(r) : null;
  const canDecline = r.api === 'Requested',
    canConfirm = waiting(r),
    canCancel = ['Requested', 'Conflict', 'Allocating', 'Confirmed'].includes(r.api) && !r.redacted;
  const others = r.rooms.filter(x => x !== r.venue);
  openDrawer({
    large: true,
    title: title(r),
    sub: (
      <>
        <span className="mono">{r.ref}</span> · {L(v.name, v.ar)} · {fmtDate(r.date)}
      </>
    ),
    body: (
      <>
        {stageBar(r)}{' '}
        {r.api === 'Conflict' ? (
          <C.InlineAlert
            tone="warning"
            title={L('Could not be allocated', 'تعذّر التخصيص')}
            body={
              ' ' +
              (ERRORS[r.errorCode]
                ? L(...ERRORS[r.errorCode])
                : L(
                    'Another booking or a planned maintenance block holds the room at that time.',
                    'حجز آخر أو صيانة مقرّرة تشغل القاعة في ذلك الوقت.'
                  )) +
              ' ' +
              L('Decline it, or ask for another room.', 'ارفضه أو اطلب قاعة أخرى.')
            }
          />
        ) : clash ? (
          <C.InlineAlert
            tone="warning"
            title={L('Overlaps another request', 'يتداخل مع طلب آخر')}
            body={L(
              ` ${clash.ref} wants the same room on ${fmtDate(clash.date)} at an overlapping time, counting set-up and clean-up. If both are confirmed, the second will come back as a conflict.`,
              ` ${clash.ref} يطلب القاعة نفسها في ${fmtDate(clash.date)} بوقت متداخل مع التجهيز والتنظيف. إذا أُكِّد الاثنان فسيعود الثاني كتعارض.`
            )}
          />
        ) : null}{' '}
        {r.redacted ? (
          <C.InlineAlert
            tone="info"
            title={L('Details are private', 'التفاصيل خاصة')}
            body={L(
              ' The event is private or belongs to a ministry you do not lead, so only the time and room are shown.',
              ' الحدث خاص أو يخص خدمة لا تقودها، فيُعرض الوقت والقاعة فقط.'
            )}
          />
        ) : null}{' '}
        <dl className="dl">
          <dt>{L('Room', 'القاعة')}</dt>
          <dd>
            {L(v.name, v.ar)}
            {v.cap ? ` · ${L('seats', 'يتّسع لـ')} ${v.cap}` : ''}
          </dd>
          {others.length ? (
            <>
              <dt>{L('Also held', 'مع')}</dt>
              <dd>{others.map(roomName).join('، ')}</dd>
            </>
          ) : null}
          <dt>{L('When', 'الموعد')}</dt>
          <dd className="mono" dir="ltr">
            {fmtDate(r.date)} · {r.from}–{r.to}
            {r.endDate && r.endDate !== r.date ? ` → ${fmtDate(r.endDate)}` : ''}
          </dd>
          <dt>{L('Set-up and clean-up', 'التجهيز والتنظيف')}</dt>
          <dd>{L(`${r.setup} min before, ${r.cleanup} min after`, `${r.setup} د قبل، ${r.cleanup} د بعد`)}</dd>
          <dt>{L('Status', 'الحالة')}</dt>
          <dd>
            <State r={r} />
          </dd>
          {!r.redacted ? (
            <>
              <dt>{L('Requested by', 'طلبه')}</dt>
              <dd>{person(r.requestedBy)}</dd>
            </>
          ) : null}
          {r.purpose || r.purposeAr ? (
            <>
              <dt>{L('Purpose', 'الغاية')}</dt>
              <dd>{L(r.purpose || r.purposeAr, r.purposeAr || r.purpose)}</dd>
            </>
          ) : null}
          {r.people != null ? (
            <>
              <dt>{L('People expected', 'العدد المتوقّع')}</dt>
              <dd className="tnum">{r.people}</dd>
            </>
          ) : null}
          {r.phone ? (
            <>
              <dt>{L('Contact phone', 'هاتف التواصل')}</dt>
              <dd dir="ltr">{r.phone}</dd>
            </>
          ) : null}
          {r.notes ? (
            <>
              <dt>{L('Notes', 'ملاحظات')}</dt>
              <dd>
                <bdi>{r.notes}</bdi>
              </dd>
            </>
          ) : null}
        </dl>{' '}
        {r.checklist.length ? (
          <>
            <div className="divider" />
            <h4 className="t-ui" style={{ marginBottom: '10px' }}>
              {L('Checklist', 'قائمة التحقق')}
            </h4>
            <ul className="blocklist">
              {r.checklist.map((c, i) => (
                <li key={i}>
                  {c.done ? '✓ ' : '○ '}
                  {c.phase === 'Opening' ? L('Opening: ', 'الفتح: ') : L('Closing: ', 'الإغلاق: ')}
                  {L(c.label, c.labelAr || c.label)}
                  {c.done ? (
                    <small className="t-caption dim">
                      {' '}
                      · {person(c.doneBy)} · {fmtDate(c.doneAt)}
                    </small>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}{' '}
        {r.terms ? (
          <blockquote className="or-quote">
            <span>{L('Terms agreed', 'الشروط المتفق عليها')}</span>
            <p>
              <bdi>{r.terms}</bdi>
            </p>
          </blockquote>
        ) : null}{' '}
        {r.reason ? (
          <>
            <div className="divider" />
            <h4 className="t-ui" style={{ marginBottom: '10px' }}>
              {L('Last decision', 'آخر قرار')}
            </h4>
            <p>
              <bdi>{r.reason}</bdi>
            </p>
          </>
        ) : null}{' '}
        {r.decisions.length ? (
          <>
            <div className="divider" />
            <h4 className="t-ui" style={{ marginBottom: '10px' }}>
              {L('History', 'السجلّ')}
            </h4>
            <ul className="blocklist">
              {r.decisions.map((x, i) => (
                <li key={i}>
                  <b>{DECISION[x.action] ? L(...DECISION[x.action]) : x.action}</b> · {person(x.actorId)} ·{' '}
                  <span className="mono dim">{fmtDate(x.at)}</span>
                  {x.reason ? (
                    <small className="t-caption dim" style={{ display: 'block' }}>
                      <bdi>{x.reason}</bdi>
                    </small>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>
        <span className="row" style={{ gap: '6px', marginInlineStart: 'auto' }}>
          {!r.redacted && !['Declined', 'Cancelled'].includes(r.api) ? (
            <button className="btn btn-secondary" id="res-details">
              {L('Details…', 'التفاصيل…')}
            </button>
          ) : null}
          {canDecline ? (
            <button className="btn btn-danger-quiet" id="res-decline">
              {L('Decline', 'رفض')}
            </button>
          ) : null}
          {canCancel && !canDecline ? (
            <button className="btn btn-danger-quiet" id="res-cancel">
              {L('Cancel booking…', 'إلغاء الحجز…')}
            </button>
          ) : null}
          {canConfirm ? (
            <button className="btn btn-primary" id="res-confirm">
              {L('Confirm', 'تأكيد')}
            </button>
          ) : null}
        </span>
      </>
    ),
    onMount(el) {
      el.querySelector('#res-details')?.addEventListener('click', () => detailsForm(r));
      el.querySelector('#res-confirm')?.addEventListener('click', () => decide(r, 'confirm'));
      el.querySelector('#res-decline')?.addEventListener('click', () => decide(r, 'decline'));
      el.querySelector('#res-cancel')?.addEventListener('click', () => decide(r, 'cancel'));
    }
  });
}
