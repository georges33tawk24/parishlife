/* The member's own schedule and the priest's duty schedule, as the API builds them (GET /api/me/schedule and
   GET /api/parishes/{id}/clergy/schedule): volunteering, registrations and scheduled sacraments for the
   member; scheduled sacraments and assigned requests with a confirmed date for the priest. The priest's
   schedule needs the authenticator session. Both can be printed or saved as an .ics file. */
import { Select } from '../../ui/components.jsx';
import { nodesOr, paint } from '../../ui/html.js';
import { t, fmtDate, fmtLong } from '../../../lib/i18n.js';
import { me } from '../../model/store.js';
import { openModal, toast } from '../../ui/ui.jsx';
import { printSheet } from '../../shared/print.js';
import { download } from '../../shell/actions.jsx';
import { PARISH, FEASTS } from '../../model/data.js';
import { defaultZone, downloadSchedule, loadSchedule, localParts } from '../../model/modules/calendar.js';

const L = (en, ar) => t(en, ar);

const pad = n => String(n).padStart(2, '0');

const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const nameOf = p => (p ? L(p.lat, p.ar || p.lat) : '');

const span = (a, b) =>
  a.getMonth() === b.getMonth()
    ? L(`${a.getDate()} – ${b.getDate()} ${fmtDate(b).split(' ').slice(1).join(' ')}`, `${a.getDate()} – ${fmtDate(b)}`)
    : `${fmtDate(a)} – ${fmtDate(b)}`;

const KIND = () => ({
  Volunteering: L('Volunteering', 'تطوّع'),
  Registration: L('Registration', 'تسجيل'),
  Sacrament: L('Sacrament', 'سرّ'),
  Request: L('Request', 'طلب')
});

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

/* ScheduleItemDto[] → days with their rows, on the clock of the item's own time zone (else the parish's). */
function byDay(items) {
  const days = new Map();
  for (const item of items) {
    const at = localParts(item.startsAt, item.timeZone || defaultZone()),
      end = item.endsAt ? localParts(item.endsAt, item.timeZone || defaultZone()) : null;
    days.set(at.d, [
      ...(days.get(at.d) || []),
      {
        t: at.t,
        to: end && end.d === at.d ? end.t : '',
        kind: item.kind,
        what: item.title,
        where: item.location || '',
        parish: item.parishName,
        status: item.status
      }
    ]);
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function sheet(days, title, start, end, layout, note) {
  const K = KIND();
  return (
    <>
      <header className="ps-head">
        <div>
          <div className="ps-over">{PARISH.name}</div>{' '}
          <h1>
            {title} · {span(start, end)}
          </h1>
        </div>{' '}
        <div className="ps-meta">
          {note || `${L('Prepared for', 'أُعدّ لـ')} ${nameOf(me())}`}
          <br />
          {L('Printed', 'طُبع في')} {fmtDate(new Date())}
        </div>
      </header>{' '}
      {days.length ? (
        days.map(([key, rows], i) => (
          <section key={i} className="ps-day">
            <h2>
              <span>{fmtLong(key)}</span>
              {FEASTS[key] ? <small>{L(...FEASTS[key])}</small> : ''}
            </h2>{' '}
            <table>
              {rows.map((x, i) => (
                <tr key={i}>
                  <td className="tm">
                    {x.t}
                    {x.to ? `–${x.to}` : ''}
                  </td>
                  <td>
                    <span className="k">{K[x.kind] || x.kind}</span>
                    <b>{x.what}</b>
                    {layout === 'detailed' && x.status ? <small>{x.status}</small> : ''}
                  </td>
                  {layout === 'detailed' ? (
                    <td className="wh">{[x.where, x.parish].filter(Boolean).join(' · ')}</td>
                  ) : (
                    ''
                  )}
                </tr>
              ))}
            </table>
          </section>
        ))
      ) : (
        <div className="none">{L('Nothing scheduled', 'لا شيء مجدول')}</div>
      )}{' '}
      <footer className="ps-foot">
        <span>ParishLife</span>
        <span>{note ? L('Not for public posting', 'لا يُعلَّق للعموم') : ''}</span>
      </footer>
    </>
  );
}

/* One dialog for both schedules: the period, a layout, a preview from the API, then print or .ics. */
function scheduleDialog({ priest }) {
  const now = new Date(),
    initial = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = initial,
    end = addDays(initial, priest ? 27 : 6),
    layout = 'detailed',
    days = [],
    failed = '',
    loading = true,
    asked = 0;
  const range = () => [start, new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)];
  const valid = () => end >= start && end - start < 92 * 86400000;
  const title = priest ? L('Priest schedule', 'جدول الكهنة') : L('My schedule', 'جدولي');
  openModal({
    wide: true,
    title,
    sub: priest
      ? L(
          'Your scheduled sacraments and assigned requests with a confirmed date. For clergy only — not for the notice board.',
          'أسرارك المجدولة وطلباتك المعيّنة ذات الموعد المثبّت. للإكليروس فقط — لا للوحة الإعلانات.'
        )
      : L(
          'Your volunteering, registrations and scheduled sacraments across your parishes, for up to 92 days.',
          'تطوّعك وتسجيلاتك وأسرارك المجدولة في رعاياك، حتى ٩٢ يوماً.'
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
            ['month', L('This month', 'هذا الشهر')],
            ['next', L('Next 4 weeks', '٤ أسابيع مقبلة')]
          ].map(([key, name], i) => (
            <button key={i} type="button" data-pw-range={key}>
              {name}
            </button>
          ))}
        </div>{' '}
        <div className="formrow" style={{ marginTop: '16px' }}>
          <label className="label" htmlFor="pw_layout">
            {L('Print layout', 'تنسيق الطباعة')}
          </label>
          <Select id="pw_layout">
            <option value="detailed">{L('Detailed, with places and status', 'مفصّل مع الأماكن والحالة')}</option>
            <option value="compact">{L('Compact', 'مختصر')}</option>
          </Select>
        </div>{' '}
        <p className="t-caption dim" id="pw_count" style={{ marginTop: '16px' }} />
        <div id="pw_preview" className="panel" style={{ marginTop: '12px', maxHeight: '280px', overflow: 'auto' }} />
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>{' '}
        <button className="btn btn-secondary" id="pw_ics" style={{ marginInlineStart: 'auto' }}>
          {L('Download .ics', 'تنزيل .ics')}
        </button>{' '}
        <button className="btn btn-primary" id="pw_print">
          {L('Print', 'طباعة')}
        </button>
      </>
    ),
    onMount(el) {
      const draw = () => {
        const count = days.reduce((n, [, rows]) => n + rows.length, 0);
        el.querySelector('#pw_print').disabled = el.querySelector('#pw_ics').disabled = !valid() || loading || !!failed;
        el.querySelector('#pw_count').textContent = !valid()
          ? L(
              'Choose an end date no earlier than the start, within 92 days.',
              'اختر تاريخ نهاية لا يسبق البداية وضمن ٩٢ يوماً.'
            )
          : loading
            ? L('Loading…', 'جارٍ التحميل…')
            : failed ||
              (count
                ? L(`${count} item${count === 1 ? '' : 's'} in the selected range`, `${count} بنداً في الفترة المختارة`)
                : L('No entries in this range.', 'لا بنود في هذه الفترة.'));
        paint(
          el.querySelector('#pw_preview'),
          valid() && !failed && !loading ? (
            <div className="panel-b">
              <b>
                {L('Preview', 'معاينة')} · {span(start, end)}
              </b>
              {nodesOr(
                days.map(([key, rows], i) => (
                  <div key={i} className="listrow" style={{ paddingInline: 0 }}>
                    <span className="mono">{key}</span>
                    <span className="grow">{rows.map(x => `${x.t} ${x.what}`).join(' · ')}</span>
                  </div>
                )),
                <p>{L('No entries', 'لا بنود')}</p>
              )}
            </div>
          ) : null
        );
      };
      /* only the newest request may draw: a slow answer for an old period is dropped */
      const sync = async () => {
        const mine = ++asked;
        if (!valid()) return draw();
        loading = true;
        failed = '';
        draw();
        try {
          const items = await loadSchedule(...range(), { priest });
          if (mine !== asked) return;
          days = byDay(items);
        } catch (error) {
          if (mine !== asked) return;
          days = [];
          failed =
            error.status === 403 && priest
              ? L(
                  'The priest schedule needs a priest appointment here and an authenticator sign-in.',
                  'جدول الكهنة يحتاج تعييناً ككاهن هنا وتسجيل دخول بالمصادقة.'
                )
              : error.message;
        }
        loading = false;
        draw();
      };
      for (const [id, set] of [
        ['pw_start', d => (start = d)],
        ['pw_end', d => (end = d)]
      ])
        el.querySelector('#' + id).addEventListener('change', e => {
          if (!e.target.value) return;
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
                : type === 'next'
                  ? addDays(initial, 27)
                  : initial;
          el.querySelector('#pw_start').value = iso(start);
          el.querySelector('#pw_end').value = iso(end);
          sync();
        })
      );
      el.querySelector('#pw_layout').addEventListener('change', e => {
        layout = e.target.value;
      });
      el.querySelector('#pw_print').addEventListener('click', () => {
        if (valid() && !loading && !failed)
          printSheet({
            title: `${title} ${span(start, end)}`,
            body: sheet(days, title, start, end, layout, priest ? L('Clergy only', 'للإكليروس فقط') : ''),
            css: SHEET_CSS,
            margin: '12mm'
          });
      });
      el.querySelector('#pw_ics').addEventListener('click', async () => {
        try {
          download(
            priest ? 'priest-schedule.ics' : 'my-schedule.ics',
            await downloadSchedule(...range(), { priest }),
            'text/calendar;charset=utf-8'
          );
        } catch (error) {
          toast(L('The schedule could not be downloaded', 'تعذّر تنزيل الجدول'), error.message, 'warning');
        }
      });
      sync();
    }
  });
}

export const printWeekDialog = () => scheduleDialog({ priest: false });
export const priestScheduleDialog = () => scheduleDialog({ priest: true });
