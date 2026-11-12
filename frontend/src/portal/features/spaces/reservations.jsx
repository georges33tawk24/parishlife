/* Reservations: room requests for calendar events, their state, clashes, and the decision on each
   (confirm, decline, cancel). Everything comes from ParishLife.Api (model/modules/facilities.js).
   Main functions: reservations (the list), resDrawer (one request and its decisions), requestRoomForm
   (ask for a room for a draft calendar event).

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
      {
        id: 'terms',
        label: L('Terms agreed (for an outside renter)', 'الشروط المتفق عليها (لمستأجر خارجي)'),
        type: 'textarea',
        max: 10000,
        value: ''
      }
    ],
    confirm: L('Request', 'طلب'),
    run: f => API.requestRoom({ event: events.find(e => e.id === f.event), venue: f.room, terms: f.terms }),
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
  ]
};

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
                : L('Another booking holds the room at that time.', 'حجز آخر يشغل القاعة في ذلك الوقت.')) +
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
        </dl>{' '}
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
        ) : null}
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>
        <span className="row" style={{ gap: '6px', marginInlineStart: 'auto' }}>
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
      el.querySelector('#res-confirm')?.addEventListener('click', () => decide(r, 'confirm'));
      el.querySelector('#res-decline')?.addEventListener('click', () => decide(r, 'decline'));
      el.querySelector('#res-cancel')?.addEventListener('click', () => decide(r, 'cancel'));
    }
  });
}
