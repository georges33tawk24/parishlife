/* The printed schedules: the priest's schedule and the week sheet. */
import { Select } from '../../ui/components.jsx';
import { nodesOr, paint } from '../../ui/html.js';
import { t, fmtDate, fmtLong } from '../../../lib/i18n.js';
import { S, me } from '../../model/store.js';
import { openModal, toast } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { printSheet } from '../../shared/print.js';
import { EVENTS, EVENT_DETAIL, RESERVATIONS, ROTA, FEASTS, PARISH, TODAY, person, venue } from '../../model/data.js';

const L = (en, ar) => t(en, ar);

const pad = n => String(n).padStart(2, '0');

const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const nameOf = p => (p ? L(p.lat, p.ar || p.lat) : '');

const placeOf = id => {
  const v = venue(id);
  return v ? L(v.name, v.ar || v.name) : '';
};

const weekOf = offset =>
  addDays(TODAY, -TODAY.getDay() + offset * 7); /* weeks run Sunday to Saturday, like the calendar */

const span = (a, b) =>
  a.getMonth() === b.getMonth()
    ? L(`${a.getDate()} – ${b.getDate()} ${fmtDate(b).split(' ').slice(1).join(' ')}`, `${a.getDate()} – ${fmtDate(b)}`)
    : `${fmtDate(a)} – ${fmtDate(b)}`;

const priestsOf = e => (EVENT_DETAIL[e.id]?.priestIds || []).map(person).filter(Boolean);

const KIND = () => ({
  mass: L('Mass', 'قدّاس'),
  sacr: L('Sacrament', 'سرّ'),
  event: L('Event', 'حدث'),
  group: L('Group', 'مجموعة'),
  room: L('Room', 'قاعة'),
  rota: L('Volunteers', 'متطوّعون')
});

/* the A4 look shared by both sheets */
const SHEET_CSS = `
.ps-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;padding-bottom:10px;margin-bottom:14px;border-bottom:2px solid #233B32}
.ps-over{font:600 9.5px/14px Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#607068}
.ps-head h1{margin:2px 0 0;font:600 21px/28px Inter,'IBM Plex Sans Arabic',sans-serif;color:#233B32}
.ps-meta{text-align:end;font-size:10px;line-height:15px;color:#607068}
.ps-day{break-inside:avoid;margin:0 0 12px}
.ps-day h2{display:flex;justify-content:space-between;gap:12px;margin:0 0 2px;padding:5px 9px;border-radius:5px;background:#F7F7F2;
  font:600 12px/17px Inter,'IBM Plex Sans Arabic',sans-serif;color:#233B32}
.ps-day h2 small{font-weight:500;color:#607068}
table{width:100%;border-collapse:collapse}
td,th{padding:5px 9px;border-bottom:1px solid #EDF0E8;vertical-align:top;text-align:start}
th{font:600 9px/13px Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#607068;border-bottom:1.5px solid #9BAC9F}
td.tm{width:78px;white-space:nowrap;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10.5px}
td.wh{width:26%;color:#607068}
td b{font-weight:600}
td small{display:block;color:#607068;font-size:9.5px;line-height:14px;margin-top:1px}
.k{display:inline-block;min-width:58px;padding:0 6px;margin-inline-end:6px;border-radius:999px;border:1px solid #9BAC9F;
  font:600 8.5px/15px Inter,sans-serif;letter-spacing:.04em;text-transform:uppercase;text-align:center;color:#233B32;background:#FFF}
.k-mass{background:#233B32;border-color:#233B32;color:#FFF}.k-sacr{background:#607068;border-color:#607068;color:#FFF}
.k-rota{background:#F7F7F2;border-color:#D6E1D0}.k-room{background:#EDF0E8;border-color:#DCE2DB}
.none{padding:5px 9px;color:#607068;font-size:10.5px}
.warn{color:#607068;font-weight:700}
.ps-foot{display:flex;justify-content:space-between;gap:12px;margin-top:14px;padding-top:6px;border-top:1px solid #EDF0E8;font-size:9px;color:#607068}`;

/* ---------------- Print my schedule ---------------- */
const WEEK_OPTS = () => [
  ['masses', L('Masses and sacraments', 'القداديس والأسرار'), true],
  ['events', L('Parish events', 'أحداث الرعية'), true],
  ['rooms', L('Room bookings', 'حجوزات القاعات'), true],
  ['volunteers', L('Volunteers on duty', 'المتطوّعون في الخدمة'), true],
  ['groups', L('Group meetings, private ones included', 'اجتماعات المجموعات، والخاصة منها'), false]
];

function scheduleDays(start, end, o) {
  const length = Math.floor((end - start) / 86400000) + 1;
  return Array.from({ length: Math.max(0, Math.min(length, 31)) }, (_, i) => addDays(start, i)).map(d => {
    const key = iso(d),
      items = [];
    for (const e of EVENTS.filter(x => x.d === key)) {
      if (e.kind === 'pending') continue; /* a pending booking is listed with the rooms */
      if (
        ((e.kind === 'mass' || e.kind === 'sacr') && !o.masses) ||
        (e.kind === 'event' && !o.events) ||
        (e.kind === 'group' && !o.groups)
      )
        continue;
      const pr = priestsOf(e);
      items.push({
        t: e.t,
        to: e.to,
        kind: e.kind,
        what: L(e.title, e.titleAr || e.title),
        where: placeOf(e.venue),
        note:
          e.kind === 'mass' ? (
            pr.length ? (
              pr.map(nameOf).join(', ')
            ) : (
              <span className="warn">{L('Priest not assigned', 'لم يُعيَّن كاهن')}</span>
            )
          ) : (
            ''
          )
      });
    }
    if (o.rooms)
      for (const r of RESERVATIONS.filter(x => x.date === key && x.status !== 'rejected'))
        items.push({
          t: r.from,
          to: r.to,
          kind: 'room',
          what: L(r.title, r.titleAr || r.title),
          where: placeOf(r.venue),
          note:
            r.status === 'pending'
              ? L('Waiting for approval — holds the room', 'بانتظار الموافقة — تحجز القاعة')
              : L('Booked', 'محجوز')
        });
    if (o.volunteers && ROTA.date === key && ROTA.teams?.length) {
      const at = /(\d{1,2}:\d{2})/.exec(ROTA.service || '')?.[1] || '';
      items.push({
        t: at,
        kind: 'rota',
        what: L(`On duty for ${ROTA.service}`, `في الخدمة: ${ROTA.serviceAr || ROTA.service}`),
        where: '',
        note: ROTA.teams
          .map(
            tm =>
              `${L(tm.team, tm.teamAr || tm.team)}: ${
                tm.filled
                  .filter(f => f.p && f.s !== 'declined')
                  .map(f => nameOf(person(f.p)))
                  .join(', ') || '—'
              }`
          )
          .join(' · '),
        raw: true
      });
    }
    return { d, key, items: items.sort((a, b) => (a.t || '').localeCompare(b.t || '')) };
  });
}

function scheduleSheet(start, end, o, layout = 'detailed') {
  const days = scheduleDays(start, end, o),
    K = KIND();
  return (
    <>
      <header className="ps-head">
        <div>
          <div className="ps-over">
            {L(PARISH.name, PARISH.nameAr)} — {L(PARISH.town, PARISH.townAr)}
          </div>{' '}
          <h1>
            {L('My schedule', 'جدولي')} · {span(start, end)}
          </h1>
        </div>{' '}
        <div className="ps-meta">
          {L('Prepared for', 'أُعدّ لـ')} {nameOf(me())}
          <br />
          {L('Printed', 'طُبع في')} {fmtDate(new Date())}
        </div>
      </header>{' '}
      {days
        .filter(day => day.items.length || layout === 'detailed')
        .map(({ d, key, items }) => (
          <section className="ps-day">
            <h2>
              <span>{fmtLong(d)}</span>
              {FEASTS[key] ? <small>{L(...FEASTS[key])}</small> : ''}
            </h2>{' '}
            {items.length ? (
              <table>
                {items.map(x => (
                  <tr>
                    <td className="tm">
                      {x.t || ''}
                      {x.to ? `–${x.to}` : ''}
                    </td>
                    <td>
                      <span className={`k k-${x.kind}`}>{K[x.kind] || x.kind}</span>
                      <b>{x.what}</b>
                      {layout === 'detailed' && x.note ? (
                        <small>{x.raw || x.note.startsWith('<span') ? x.note : x.note}</small>
                      ) : (
                        ''
                      )}
                    </td>
                    {layout === 'detailed' ? <td className="wh">{x.where}</td> : ''}
                  </tr>
                ))}
              </table>
            ) : (
              <div className="none">{L('Nothing scheduled', 'لا شيء مجدول')}</div>
            )}
          </section>
        ))}{' '}
      <footer className="ps-foot">
        <span>ParishLife</span>
        <span>
          {WEEK_OPTS()
            .filter(([k]) => o[k])
            .map(([, lab]) => lab)
            .join(' · ')}
        </span>
      </footer>
    </>
  );
}

export function printWeekDialog() {
  const now = new Date(),
    initial = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = initial,
    end = addDays(initial, 6),
    layout = 'detailed';
  const o = Object.fromEntries(WEEK_OPTS().map(([k, , on]) => [k, on]));
  const count = () => scheduleDays(start, end, o).reduce((n, d) => n + d.items.length, 0);
  const valid = () => end >= start && end - start < 31 * 86400000;
  openModal({
    wide: true,
    title: L('Print my schedule', 'اطبع جدولي'),
    sub: L(
      'Choose a day through one month, preview the entries, then print in a compact or detailed layout.',
      'اختر من يوم إلى شهر واحد، عاين البنود ثم اطبع بتنسيق مختصر أو مفصّل.'
    ),
    body: (
      <>
        <div className="formgrid">
          <div className="formrow">
            <label className="label" htmlFor="pw_start">
              {L('From', 'من')}
            </label>
            <input className="input" type="date" id="pw_start" defaultValue={iso(start)} />
          </div>{' '}
          <div className="formrow">
            <label className="label" htmlFor="pw_end">
              {L('Through', 'حتى')}
            </label>
            <input className="input" type="date" id="pw_end" defaultValue={iso(end)} />
          </div>
        </div>{' '}
        <div className="seg" role="group" aria-label={L('Quick ranges', 'فترات سريعة')} style={{ marginTop: '12px' }}>
          {[
            ['day', L('Today', 'اليوم')],
            ['week', L('This week', 'هذا الأسبوع')],
            ['month', L('This month', 'هذا الشهر')]
          ].map(([key, name]) => (
            <button type="button" data-pw-range={key}>
              {name}
            </button>
          ))}
        </div>{' '}
        <div className="formrow" style={{ marginTop: '16px' }}>
          <label className="label" htmlFor="pw_layout">
            {L('Print layout', 'تنسيق الطباعة')}
          </label>
          <Select id="pw_layout">
            <option value="detailed">{L('Detailed, with places and notes', 'مفصّل مع الأماكن والملاحظات')}</option>
            <option value="compact">{L('Compact, scheduled days only', 'مختصر، أيام المواعيد فقط')}</option>
          </Select>
        </div>{' '}
        <div className="overline" style={{ margin: '18px 0 10px' }}>
          {L('Include', 'تضمين')}
        </div>{' '}
        <div className="stack" style={{ gap: '10px' }}>
          {WEEK_OPTS().map(([k, lab, on]) => (
            <C.CheckRow label={lab} checked={on} id={'pw_' + k} />
          ))}
        </div>{' '}
        <p className="t-caption dim" id="pw_count" style={{ marginTop: '16px' }} />
        <div id="pw_preview" className="panel" style={{ marginTop: '12px', maxHeight: '280px', overflow: 'auto' }} />
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="pw_print" style={{ marginInlineStart: 'auto' }}>
          {L('Print', 'طباعة')}
        </button>
      </>
    ),
    onMount(el) {
      const sync = () => {
        el.querySelector('#pw_print').disabled = !valid();
        if (!valid()) {
          el.querySelector('#pw_count').textContent = L(
            'Choose an end date no earlier than the start, within 31 days.',
            'اختر تاريخ نهاية لا يسبق البداية وضمن ٣١ يوماً.'
          );
          paint(el.querySelector('#pw_preview'), null);
          return;
        }
        const n = count();
        el.querySelector('#pw_count').textContent = n
          ? L(`${n} item${n === 1 ? '' : 's'} in the selected range`, `${n} بنداً في الفترة المختارة`)
          : L('No entries in this range.', 'لا بنود في هذه الفترة.');
        paint(
          el.querySelector('#pw_preview'),
          <div className="panel-b">
            <b>
              {L('Preview', 'معاينة')} · {span(start, end)}
            </b>
            {nodesOr(
              scheduleDays(start, end, o)
                .filter(d => d.items.length || layout === 'detailed')
                .map(d => (
                  <div className="listrow" style={{ paddingInline: 0 }}>
                    <span className="mono">{iso(d.d)}</span>
                    <span className="grow">
                      {d.items.length
                        ? d.items.map(x => `${x.t} ${x.what}`).join(<br />)
                        : L('Nothing scheduled', 'لا شيء مجدول')}
                    </span>
                  </div>
                )),
              <p>{L('No entries', 'لا بنود')}</p>
            )}
          </div>
        );
      };
      for (const [id, set] of [
        ['pw_start', d => (start = d)],
        ['pw_end', d => (end = d)]
      ])
        el.querySelector('#' + id).addEventListener('change', e => {
          set(new Date(e.target.value + 'T12:00:00'));
          sync();
        });
      el.querySelectorAll('[data-pw-range]').forEach(button =>
        button.addEventListener('click', () => {
          const type = button.dataset.pwRange;
          start =
            type === 'month'
              ? new Date(initial.getFullYear(), initial.getMonth(), 1)
              : type === 'week'
                ? addDays(initial, -initial.getDay())
                : initial;
          end =
            type === 'month'
              ? new Date(initial.getFullYear(), initial.getMonth() + 1, 0)
              : type === 'week'
                ? addDays(start, 6)
                : initial;
          el.querySelector('#pw_start').value = iso(start);
          el.querySelector('#pw_end').value = iso(end);
          sync();
        })
      );
      el.querySelector('#pw_layout').addEventListener('change', e => {
        layout = e.target.value;
        sync();
      });
      WEEK_OPTS().forEach(([k]) =>
        el.querySelector('#pw_' + k).addEventListener('change', e => {
          o[k] = e.target.checked;
          sync();
        })
      );
      el.querySelector('#pw_print').addEventListener('click', () => {
        if (valid())
          printSheet({
            title: `${L('My schedule', 'جدولي')} ${span(start, end)}`,
            body: scheduleSheet(start, end, o, layout),
            css: SHEET_CSS,
            margin: '12mm'
          });
      });
      sync();
    }
  });
}

/* ---------------- the priests' Mass schedule (clergy only) ---------------- */
const RANGES = () => [
  ['week', L('This week', 'هذا الأسبوع')],
  ['month', L('This month', 'هذا الشهر')],
  ['next', L('Next 4 weeks', '4 أسابيع مقبلة')]
];

function rangeOf(r) {
  if (r === 'week') {
    const a = weekOf(0);
    return [a, addDays(a, 6), span(a, addDays(a, 6))];
  }
  if (r === 'next') return [TODAY, addDays(TODAY, 27), span(TODAY, addDays(TODAY, 27))];
  const m = new Date(2026, 9 + (S.ui.calOffset || 0), 1),
    last = new Date(m.getFullYear(), m.getMonth() + 1, 0);
  return [m, last, fmtDate(m).split(' ').slice(1).join(' ')];
}

const massesIn = r => {
  const [a, b] = rangeOf(r);
  return EVENTS.filter(e => e.kind === 'mass' && e.d >= iso(a) && e.d <= iso(b)).sort((x, y) =>
    (x.d + x.t).localeCompare(y.d + y.t)
  );
};

function priestRows(list, forPrint) {
  const byDay = list.reduce((m, e) => ((m[e.d] = [...(m[e.d] || []), e]), m), {});
  return Object.entries(byDay).map(([d, es]) =>
    forPrint ? (
      <section className="ps-day">
        <h2>
          <span>{fmtLong(d)}</span>
          {FEASTS[d] ? <small>{L(...FEASTS[d])}</small> : ''}
        </h2>
        <table>
          {es.map(e => {
            const pr = priestsOf(e);
            return (
              <tr>
                <td className="tm">
                  {e.t}
                  {e.to ? `–${e.to}` : ''}
                </td>
                <td>
                  <b>{L(e.title, e.titleAr || e.title)}</b>
                </td>
                <td className="wh">{placeOf(e.venue)}</td>
                <td style={{ width: '30%' }}>
                  {pr.length ? (
                    pr.map(nameOf).join(', ')
                  ) : (
                    <span className="warn">{L('Not assigned', 'لم يُعيَّن')}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </table>
      </section>
    ) : (
      es.map(e => {
        const pr = priestsOf(e);
        return (
          <tr>
            <td className="ps-when">
              <span className="mono">{fmtDate(d)}</span>
              <small>
                {e.t}
                {e.to ? `–${e.to}` : ''}
              </small>
            </td>
            <td>
              <b>{L(e.title, e.titleAr || e.title)}</b>
            </td>
            <td className="dim hide-sm">{placeOf(e.venue)}</td>
            <td>
              {pr.length ? (
                pr.map(nameOf).join(', ')
              ) : (
                <span className="pill pill-warning">
                  <span className="dot" />
                  {L('Not assigned', 'لم يُعيَّن')}
                </span>
              )}
            </td>
          </tr>
        );
      })
    )
  );
}

export function priestScheduleDialog() {
  let r = 'month';
  const body = () => {
    const list = massesIn(r),
      open = list.filter(e => !priestsOf(e).length).length;
    return (
      <>
        <p className="t-caption dim" style={{ margin: '0 0 10px' }}>
          {list.length
            ? L(
                `${list.length} Mass${list.length === 1 ? '' : 'es'}${open ? ` · ${open} without a priest` : ' · every one has a priest'}`,
                `${list.length} قداديس${open ? ` · ${open} بلا كاهن` : ' · لكلّ منها كاهن'}`
              )
            : ''}
        </p>{' '}
        {list.length ? (
          <div className="tablewrap">
            <div className="tablescroll">
              <table className="tbl ps-table">
                <thead>
                  <tr>
                    <th>{L('When', 'الموعد')}</th>
                    <th>{L('Mass', 'القدّاس')}</th>
                    <th className="hide-sm">{L('Where', 'المكان')}</th>
                    <th>{L('Priest', 'الكاهن')}</th>
                  </tr>
                </thead>
                <tbody>{priestRows(list, false)}</tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="t-caption dim">{L('No Masses in this period.', 'لا قداديس في هذه الفترة.')}</p>
        )}
      </>
    );
  };
  openModal({
    wide: true,
    title: L('Priest schedule', 'جدول الكهنة'),
    sub: L(
      'Each Mass and the priest assigned to it. For clergy only — not for the notice board.',
      'كل قدّاس والكاهن المعيّن له. للإكليروس فقط — لا للوحة الإعلانات.'
    ),
    body: (
      <>
        <div className="toolbar" style={{ marginBottom: '12px' }}>
          <span className="seg" role="group" aria-label={L('Period', 'الفترة')}>
            {RANGES().map(([k, lab]) => (
              <button type="button" data-range={k} aria-pressed={k === r}>
                {lab}
              </button>
            ))}
          </span>
          <b id="ps_span" className="t-caption" />
        </div>{' '}
        <div id="ps_body" />
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>{' '}
        <button className="btn btn-primary" id="ps_print" style={{ marginInlineStart: 'auto' }}>
          {L('Print', 'طباعة')}
        </button>
      </>
    ),
    onMount(el) {
      const sync = () => {
        paint(el.querySelector('#ps_body'), body());
        el.querySelector('#ps_span').textContent = rangeOf(r)[2];
        el.querySelector('#ps_print').disabled = !massesIn(r).length;
      };
      el.querySelectorAll('[data-range]').forEach(b =>
        b.addEventListener('click', () => {
          r = b.dataset.range;
          el.querySelectorAll('[data-range]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
          sync();
        })
      );
      el.querySelector('#ps_print').addEventListener('click', () => {
        const list = massesIn(r),
          [, , period] = rangeOf(r);
        if (!list.length)
          return toast(
            L('Nothing to print', 'لا شيء للطباعة'),
            L('There are no Masses in this period.', 'لا قداديس في هذه الفترة.')
          );
        printSheet({
          title: `${L('Priest schedule', 'جدول الكهنة')} — ${period}`,
          css: SHEET_CSS,
          margin: '12mm',
          body: (
            <>
              <header className="ps-head">
                <div>
                  <div className="ps-over">
                    {L(PARISH.name, PARISH.nameAr)} — {L(PARISH.town, PARISH.townAr)}
                  </div>{' '}
                  <h1>
                    {L('Priest schedule', 'جدول الكهنة')} · {period}
                  </h1>
                </div>{' '}
                <div className="ps-meta">
                  {L('Clergy only', 'للإكليروس فقط')}
                  <br />
                  {L('Printed', 'طُبع في')} {fmtDate(new Date())}
                </div>
              </header>{' '}
              {priestRows(list, true)}{' '}
              <footer className="ps-foot">
                <span>ParishLife</span>
                <span>{L('Not for public posting', 'لا يُعلَّق للعموم')}</span>
              </footer>
            </>
          )
        });
      });
      sync();
    }
  });
}
