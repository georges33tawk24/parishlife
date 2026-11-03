/* Reservations: room requests through their approval chain, clashes, and each request's history. */
import { css } from '../../ui/html.js';
import { t, isAr, fmtDate } from '../../../lib/i18n.js';
import { is, S } from '../../model/store.js';
import { Icon, PageHead, Who, Status, Table, Empty, Stat, SearchField, openDrawer } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as CR from '../../shared/record-editor.jsx';
import { RESERVATIONS, person, venue, group, resClash, resStatus } from '../../model/data.js';
import { onlineMark } from '../records/online-requests.jsx';
import { occasionText, phoneShow } from '../../model/sacrament-requests.js';

const L = (en, ar) => t(en, ar);

const STAGES = [
  ['Requested', 'الطلب'],
  ['Secretary review', 'مراجعة أمانة السرّ'],
  ['Priest approval', 'موافقة الكاهن'],
  ['Approved', 'موافَق عليه']
];

/* ---------------- reservations ---------------- */
export function reservations() {
  const pending = RESERVATIONS.filter(r => r.status === 'pending');
  const clashing = pending.filter(resClash);
  const f = S.ui.resFilter || 'all';
  const shown = RESERVATIONS.filter(
    r =>
      f === 'all' ||
      (f === 'mine'
        ? r.status === 'pending' && (is('priest') ? r.stage === 'priest' : r.stage === 'secretary')
        : r.status === f)
  );
  const rows = shown.map(r => {
    const v = venue(r.venue),
      by = person(r.by),
      g = r.group ? group(r.group) : null;
    return {
      cls: 'clickable',
      attrs: `data-res="${r.id}" tabindex="0" data-find-item`,
      cells: [
        <span className="mono" dir="ltr">
          {r.ref}
        </span>,
        <>
          <b style={{ font: '500 14px/20px var(--sans)' }}>
            {r.memberRequestId ? occasionText(r.title) : L(r.title, r.titleAr)}
          </b>
          {onlineMark(r)}{' '}
          {g ? (
            <small className="t-caption dim" style={{ display: 'block' }}>
              {L(g.name, g.ar)}
            </small>
          ) : (
            ''
          )}
        </>,
        <span className="dim">{v ? L(v.name, v.ar) : '—'}</span>,
        <span className="dim">
          {fmtDate(r.date)}{' '}
          <span className="mono" dir="ltr">
            {r.from}–{r.to}
          </span>
        </span>,
        <Who p={by} />,
        <Status k={resStatus(r)} />,
        CR.recBtn('reservation', r.id)
      ]
    };
  });
  return (
    <>
      <PageHead
        crumbs={[{ label: L('Spaces', 'المرافق') }, { label: L('Reservations', 'الحجوزات') }]}
        title={L('Reservations', 'الحجوزات')}
        sub={L(
          'Requests move through a configurable approval chain. A pending request holds the slot until the hold expires or the priest decides.',
          'تمرّ الطلبات في سلسلة موافقات قابلة للضبط. والطلب المعلّق يحجز الوقت حتى تنتهي المهلة أو يقرّر الكاهن.'
        )}
        actions={
          <>
            <button className="btn btn-secondary" data-go="facilities">
              <Icon name="events" size={17} />
              {L('Availability', 'التوفّر')}
            </button>{' '}
            <button className="btn btn-primary" data-act="rec-new:reservation">
              <Icon name="plus" size={17} />
              {L('Request a room', 'طلب قاعة')}
            </button>
          </>
        }
      />{' '}
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
          k={L('Approved this month', 'مُوافق عليه هذا الشهر')}
          v={RESERVATIONS.filter(r => r.status === 'approved').length}
          d={L(
            `${new Set(RESERVATIONS.filter(r => r.status === 'approved').map(r => r.venue)).size} rooms in use`,
            `${new Set(RESERVATIONS.filter(r => r.status === 'approved').map(r => r.venue)).size} قاعات مستعملة`
          )}
        />{' '}
        <Stat
          k={L('Hall utilisation', 'استخدام القاعة')}
          v="68%"
          d={<span className="up">{L('+9 on September', '+٩ عن أيلول')}</span>}
        />{' '}
        <Stat
          k={L('Average decision time', 'متوسط زمن القرار')}
          v={L('1 day', 'يوم واحد')}
          d={L('target: 2 days', 'الهدف: يومان')}
        />
      </div>{' '}
      {clashing.slice(0, 1).map(r => {
        const o = resClash(r),
          v = venue(r.venue);
        return (
          <C.InlineAlert
            tone="warning"
            title={L(`${r.ref} clashes with ${o.ref}`, `تعارض بين ${r.ref} و${o.ref}`)}
            body={L(
              `Both want ${v ? `the ${v.name}` : 'the same room'} on ${fmtDate(r.date)}, counting their set-up time. Approving one refuses the other — each request sees the clash, not the other one’s private details.`,
              `كلاهما يطلب ${v ? v.ar : 'القاعة نفسها'} في ${fmtDate(r.date)}، مع وقت التحضير. الموافقة على أحدهما ترفض الآخر — ويرى كل طلب التعارض لا تفاصيل الآخر الخاصة.`
            )}
          />
        );
      })}{' '}
      <div className="toolbar" style={{ margin: '20px 0 16px' }}>
        <span className="seg" role="group" aria-label={L('Show', 'عرض')}>
          {[
            ['all', 'All', 'الكل'],
            ['mine', 'Awaiting me', 'بانتظاري'],
            ['approved', 'Approved', 'موافَق'],
            ['rejected', 'Rejected', 'مرفوض']
          ].map(([k, en, ar]) => (
            <button aria-pressed={f === k} data-act={`res-filter:${k}`}>
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
          { label: L('Requested by', 'مقدَّم من'), cls: 'hide-md' },
          { label: L('Status', 'الحالة'), cls: 'shrink' },
          { label: '', cls: 'shrink' }
        ]}
        rows={rows}
        empty={
          <Empty
            glyph="attend"
            title={L('Nothing here', 'لا شيء هنا')}
            body={
              f === 'all'
                ? L('No room requests yet.', 'لا طلبات قاعات بعد.')
                : L('No request matches this filter.', 'لا طلب يطابق هذا المرشّح.')
            }
          />
        }
      />{' '}
      <div className="find-empty" hidden>
        <Empty
          glyph="search"
          title={L('No request matches', 'لا طلب مطابق')}
          body={L('Try the reference number or part of the title.', 'جرّب رقم الطلب أو جزءاً من العنوان.')}
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
  if (first) {
    S.params = [];
    history.replaceState(null, '', '#/reservations');
    resDrawer(first);
  }
};

/* What happened to a booking, as recorded on it */
const RES_STEPS = {
  'request submitted': ['Requested', 'طُلب'],
  'office review completed': ['Checked by the parish office', 'راجعه مكتب الرعية'],
  approve: ['Confirmed', 'تأكّد'],
  reject: ['Refused', 'رُفض']
};

const resHistory = r =>
  r.history.map((h, i) => (
    <div className={`tl-item${i === r.history.length - 1 ? ' accent' : ''}`}>
      <div className="when">
        {L(...(RES_STEPS[h.action] || [h.action, h.action]))}
        {h.at ? ` · ${fmtDate(h.at)}` : ''}
      </div>{' '}
      <div className="what">
        {h.by || ''}
        {h.via === 'portal' ? ` · ${L('online', 'إلكترونياً')}` : ''}
        {h.reason ? (
          <small className="dim" style={{ display: 'block' }}>
            {h.reason}
          </small>
        ) : (
          ''
        )}
      </div>
    </div>
  ));

function stageBar(current) {
  const idx = { secretary: 1, priest: 2, done: 3 }[current] ?? 0;
  return (
    <div style={{ display: 'flex', margin: '4px 0 20px' }}>
      {STAGES.map(([en, ar], i) => (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={css(
              `height:4px;border-radius:99px;background:${i <= idx ? 'var(--primary)' : 'var(--border)'};margin-inline-end:${i === 3 ? 0 : '4px'}`
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

function resDrawer(id) {
  const r = RESERVATIONS.find(x => x.id === id);
  if (!r) return;
  const v = venue(r.venue) || { name: '—', ar: '—', cap: 0 },
    by = person(r.by) || { lat: '—', ar: '—' },
    g = r.group ? group(r.group) : null;
  const clash = resClash(r),
    online = !!r.memberRequestId;
  const canDecide = r.status === 'pending' && (is('priest') || (is('secretary') && r.stage === 'secretary'));
  const canCancel = r.status === 'approved' && is('priest');
  const phone = r.contactPhone || (by.phone && by.phone !== '—' ? by.phone : '');
  openDrawer({
    large: true,
    title: online ? occasionText(r.title) : L(r.title, r.titleAr),
    sub: (
      <>
        <span className="mono">{r.ref}</span> · {L(v.name, v.ar)} · {fmtDate(r.date)}
      </>
    ),
    body: (
      <>
        {stageBar(r.stage)}{' '}
        {clash && r.status === 'pending' ? (
          <C.InlineAlert
            tone="warning"
            title={L('Clashes with an existing booking', 'يتعارض مع حجز قائم')}
            body={L(
              `The ${v.name} is already held on ${fmtDate(clash.date)} from ${clash.from}, including a ${clash.setup || 0}-minute set-up buffer. Approving this request refuses the other one.`,
              `${v.ar} محجوزة في ${fmtDate(clash.date)} من ${clash.from}، مع ${clash.setup || 0} دقيقة تحضير. الموافقة على هذا الطلب ترفض الآخر.`
            )}
          />
        ) : (
          ''
        )}{' '}
        {online ? (
          <C.InlineAlert
            tone="info"
            title={L('Booked online by the parishioner. ', 'حجزه المؤمن إلكترونياً. ')}
            body={L(
              `Request ${r.memberReference}. They are told when it is confirmed or refused, with your reason.`,
              `الطلب ${r.memberReference}. يُبلَّغ عند تأكيده أو رفضه، مع السبب.`
            )}
          />
        ) : (
          ''
        )}{' '}
        <dl className="dl">
          <dt>{L('Room', 'القاعة')}</dt>
          <dd>
            {L(v.name, v.ar)} · {L('seats', 'يتّسع لـ')} {v.cap}
          </dd>
          <dt>{L('When', 'الموعد')}</dt>
          <dd className="mono" dir="ltr">
            {fmtDate(r.date)} · {r.from}–{r.to}
          </dd>
          <dt>{L('Setup buffer', 'وقت التحضير')}</dt>
          <dd>
            {r.setup} {L('minutes before and after', 'دقيقة قبل وبعد')}
          </dd>
          <dt>{L('Requested by', 'مقدَّم من')}</dt>
          <dd>
            {r.by && person(r.by) ? (
              <a href={`#/person/${r.by}`}>{isAr() ? by.ar || by.lat : by.lat}</a>
            ) : isAr() ? (
              by.ar
            ) : (
              by.lat
            )}
          </dd>
          {phone ? (
            <>
              <dt>{L('Phone', 'الهاتف')}</dt>
              <dd>
                <a href={`tel:${String(phone).replace(/[^\d+]/g, '')}`}>
                  <bdi dir="ltr">{phoneShow(phone)}</bdi>
                </a>
              </dd>
            </>
          ) : (
            ''
          )}
          {r.guests ? (
            <>
              <dt>{L('People expected', 'عدد الأشخاص')}</dt>
              <dd>{String(r.guests)}</dd>
            </>
          ) : (
            ''
          )}
          {g ? (
            <>
              <dt>{L('Group', 'المجموعة')}</dt>
              <dd>{L(g.name, g.ar)}</dd>
            </>
          ) : (
            ''
          )}
          {online ? (
            ''
          ) : (
            <>
              <dt>{L('Hold expires', 'ينتهي الحجز المؤقت')}</dt>
              <dd className="mono">{fmtDate('2026-10-07')}</dd>
            </>
          )}
          <dt>{L('Status', 'الحالة')}</dt>
          <dd>
            <Status k={resStatus(r)} />
          </dd>
        </dl>{' '}
        {r.notes ? (
          <blockquote className="or-quote">
            <span>{L('Message from the parishioner', 'رسالة من المؤمن')}</span>
            <p>
              <bdi>{r.notes}</bdi>
            </p>
          </blockquote>
        ) : (
          ''
        )}{' '}
        <div className="divider" />{' '}
        <h4 className="t-ui" style={{ marginBottom: '12px' }}>
          {L('Opening and closing checklist', 'لائحة الفتح والإقفال')}
        </h4>{' '}
        <div className="stack" style={{ gap: '8px' }}>
          {[
            L('Keys handed to the named responsible person', 'تسليم المفاتيح إلى المسؤول المسمّى'),
            L('Chairs and tables returned to the store', 'إعادة الكراسي والطاولات إلى المستودع'),
            L('Lights and generator switched off', 'إطفاء الإنارة والمولّد'),
            L('Kitchen left clean', 'ترك المطبخ نظيفاً')
          ].map(x => (
            <C.CheckRow label={x} />
          ))}
        </div>{' '}
        <div className="divider" />{' '}
        <h4 className="t-ui" style={{ marginBottom: '10px' }}>
          {L('Decision history', 'سجل القرارات')}
        </h4>{' '}
        <div className="timeline">
          {r.history?.length ? (
            resHistory(r)
          ) : (
            <>
              <div className="tl-item accent">
                <div className="when">{L('Submitted', 'قُدّم')}</div>{' '}
                <div className="what">{L(`By ${by.lat}`, `من ${by.ar}`)}</div>
              </div>{' '}
              {r.stage !== 'secretary' ? (
                <div className="tl-item">
                  <div className="when">{L('Reviewed', 'رُوجع')}</div>{' '}
                  <div className="what">
                    {L('By Rita Nassar and forwarded to the priest', 'من ريتا نصّار وأُحيل إلى الكاهن')}
                  </div>
                </div>
              ) : (
                ''
              )}{' '}
              {r.status === 'approved' || r.status === 'rejected' ? (
                <div className="tl-item">
                  <div className="when">{L('Decided', 'قُرّر')}</div>{' '}
                  <div className="what">
                    <Status k={r.status} />
                  </div>
                </div>
              ) : (
                ''
              )}
            </>
          )}
        </div>
      </>
    ),
    foot: canDecide ? (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>{' '}
        <button className="btn btn-danger-quiet" data-act={`res-reject:${r.id}`}>
          {L('Reject', 'رفض')}
        </button>{' '}
        <button className="btn btn-primary" data-act={`res-approve:${r.id}`} style={{ marginInlineStart: 'auto' }}>
          {is('secretary') ? L('Forward to the priest', 'إحالة إلى الكاهن') : L('Approve', 'موافقة')}
        </button>
      </>
    ) : canCancel ? (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>{' '}
        <button className="btn btn-danger-quiet" data-act={`res-reject:${r.id}`} style={{ marginInlineStart: 'auto' }}>
          {L('Cancel booking…', 'إلغاء الحجز…')}
        </button>
      </>
    ) : r.status !== 'pending' ? (
      <button className="btn btn-secondary" data-close="">
        {L('Close', 'إغلاق')}
      </button>
    ) : (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>{' '}
        <span className="t-caption dim" style={{ marginInlineStart: 'auto' }}>
          {L('Your role can view this request but not decide it.', 'دورك يتيح الاطّلاع لا القرار.')}
        </span>
      </>
    ),
    onMount(el) {}
  });
}
