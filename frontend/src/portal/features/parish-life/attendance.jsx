/* Group attendance: the meeting-by-member grid, marking and reviewing a meeting, and exporting,
   printing and importing attendance. */
import { Select } from '../../ui/components.jsx';
import { paint, markup } from '../../ui/html.js';
import { t, isAr, fmtDate } from '../../../lib/i18n.js';
import { S, bus } from '../../model/store.js';
import {
  Icon,
  PageHead,
  Empty,
  openDrawer,
  openModal,
  closeOverlays,
  toast,
  Stat,
  openMenu,
  Paged
} from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import { download } from '../../shell/actions.jsx';
import { parishAPI } from '../../model/api.js';
import { persist } from '../../model/persist.js';
import { meetingId, attendanceCounts, attendanceValue } from '../../model/planning.js';
import { GROUPS, groupInfo, TODAY, person, group } from '../../model/data.js';
import {
  ATTENDANCE_OPTIONS,
  attendanceTag,
  byTime,
  groupCards,
  iso,
  meetingAttendance
} from './parish-life-shared.jsx';

/* Display only: an empty twin falls back to the other language (never when saving). */
const L = (en, ar) => t(en || ar, ar || en);

export function chooseAttendance(anchor, meeting, pid, afterSave = () => {}) {
  openMenu(
    anchor,
    ATTENDANCE_OPTIONS.map(([value, en, ar]) => ({
      label: L(en, ar),
      tone: value || 'unrecorded',
      fn: () => {
        meeting.attendance ||= {};
        if (value) meeting.attendance[pid] = value;
        else delete meeting.attendance[pid];
        if (value) meeting.done = true;
        bus.refresh();
        afterSave();
      }
    })),
    { width: 190 }
  );
}

export function ministryAttendance() {
  return (
    <>
      <PageHead
        crumbs={[{ label: L('My ministry', 'خدمتي') }, { label: L('Attendance', 'الحضور') }]}
        title={L('Attendance', 'الحضور')}
        sub={L('Open the attendance register for each group you lead.', 'افتح سجل الحضور لكل مجموعة تقودها.')}
      />
      <Paged className="gridcards">{groupCards(GROUPS, 'attendance')}</Paged>
    </>
  );
}

export function meetingReview(mid) {
  const g = group(S.params[0]),
    d = groupInfo(S.params[0]);
  const meeting = d.meetings.find(m => meetingId(m) === mid);
  if (!g || !meeting) return;
  const rosterIds = d.roster
    .map(r => r.p)
    .filter(pid => !meeting.participants?.length || meeting.participants.includes(pid));
  const peopleIds = [...rosterIds, ...Object.keys(meeting.attendance || {}).filter(pid => !rosterIds.includes(pid))];
  const categories = [
    ['present', L('Came', 'حضروا')],
    ['excused', L('Excused', 'معذورون')],
    ['absent', L('Did not come', 'لم يحضروا')],
    ['', L('No answer', 'بلا جواب')]
  ];
  openModal({
    wide: true,
    title: L('Meeting attendance', 'حضور الاجتماع'),
    sub: `${L(g.name, g.ar)} · ${fmtDate(meeting.d)} · ${meeting.t}`,
    body: (
      <>
        {meeting.present && !Object.values(meeting.attendance || {}).includes('present') ? (
          <C.InlineAlert
            tone="info"
            title={L('Historical total without names', 'مجموع سابق من دون أسماء')}
            body={L(
              `${meeting.present} people were recorded as present in the old summary. Their names were not stored, so they are not assigned to a column.`,
              `سُجّل حضور ${meeting.present} أشخاص في الملخّص السابق من دون حفظ أسمائهم، لذلك لم يُوزّعوا على الأعمدة.`
            )}
          />
        ) : (
          ''
        )}{' '}
        <div className="meeting-review-grid">
          {categories.map(([value, label], i) => {
            const ids = peopleIds.filter(pid => attendanceValue(meeting, pid) === value);
            return (
              <section key={i} className={`meeting-review-column attendance-${value || 'unrecorded'}`}>
                <h3>
                  {label} <span>{ids.length}</span>
                </h3>{' '}
                <div className="meeting-review-list">
                  {ids.length ? (
                    ids.map((pid, i) => (
                      <button key={i} type="button" data-review-person={pid}>
                        {L(person(pid)?.lat || pid, person(pid)?.ar || pid)}
                        <Icon name="chevD" size={14} />
                      </button>
                    ))
                  ) : (
                    <p>{L('No people here', 'لا أشخاص هنا')}</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>{' '}
        <p className="t-caption dim" style={{ marginTop: '14px' }}>
          {L(
            'Select a person to change their attendance. Changes save immediately.',
            'اختر شخصاً لتغيير حالة حضوره. تُحفظ التغييرات فوراً.'
          )}
        </p>
      </>
    ),
    foot: (
      <button className="btn btn-secondary" data-close="">
        {L('Close', 'إغلاق')}
      </button>
    ),
    onMount(el) {
      el.querySelectorAll('[data-review-person]').forEach(button =>
        button.addEventListener('click', () =>
          chooseAttendance(button, meeting, button.dataset.reviewPerson, () => meetingReview(mid))
        )
      );
    }
  });
}

export function attendanceMatrix(g, d) {
  if (S.ui.attendanceGroup !== g.id) {
    S.ui.attendanceGroup = g.id;
    S.ui.attendancePeriod = null;
  }
  const latest =
    d.meetings
      .slice()
      .sort((a, b) => b.d.localeCompare(a.d))[0]
      ?.d?.slice(0, 7) || iso(TODAY).slice(0, 7);
  const period = S.ui.attendancePeriod || latest;
  const meetings = d.meetings
    .filter(m => m.d.startsWith(period))
    .sort((a, b) => (S.ui.attendanceReverse ? -1 : 1) * byTime(a, b));
  const rosterIds = new Set(d.roster.map(r => r.p));
  const formerIds = [
    ...new Set(meetings.flatMap(m => Object.keys(m.attendance || {})).filter(pid => !rosterIds.has(pid)))
  ];
  const visibleRoster = [...d.roster, ...formerIds.map(p => ({ p, former: true }))];
  const counts = attendanceCounts(meetings, d.roster);
  for (const meeting of meetings)
    for (const pid of formerIds) {
      const value = attendanceValue(meeting, pid);
      if (value) counts[value]++;
    }
  const recorded = counts.present + counts.excused + counts.absent;
  const [year, mo] = period.split('-').map(Number);
  const periodLabel = new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-US', { month: 'long', year: 'numeric' }).format(
    new Date(year, mo - 1, 1)
  );
  const held = d.meetings.filter(m => m.done);
  const overall = held.reduce(
    (total, m) => {
      const count = meetingAttendance(m);
      for (const key of ['present', 'excused', 'absent']) total[key] += count[key];
      return total;
    },
    { present: 0, excused: 0, absent: 0 }
  );
  const known = overall.present + overall.excused + overall.absent;
  return (
    <>
      <div className="stats attendance-stats" style={{ margin: '20px 0 12px' }}>
        <Stat
          k={L('Meetings held', 'اجتماعات أُقيمت')}
          v={held.length}
          d={L('all recorded meetings', 'كل الاجتماعات المسجّلة')}
        />{' '}
        <div className="stat">
          <span className="k">{L('Attendance breakdown', 'تفصيل الحضور')}</span>
          <div className="attendance-breakdown">
            {[
              ['present', 'Present', 'حاضر'],
              ['excused', 'Excused', 'معذور'],
              ['absent', 'Absent', 'غائب']
            ].map(([key, en, ar], i) => (
              <div key={i}>
                <span>{L(en, ar)}</span>
                <b>{overall[key]}</b>
                <small>{known ? Math.round((overall[key] / known) * 100) : 0}%</small>
              </div>
            ))}
          </div>
        </div>{' '}
        <Stat
          k={L('Attendance rate', 'نسبة الحضور')}
          v={known ? `${Math.round((overall.present / known) * 100)}%` : '—'}
          d={L('of known responses', 'من الردود المعروفة')}
        />
      </div>
      <div className="toolbar" style={{ margin: '16px 0', gap: '8px', flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: '6px' }}>
          <C.IconBtn ico="chevL" label={L('Previous month', 'الشهر السابق')} data-attendance-shift="-1" />{' '}
          <b style={{ minWidth: '130px', textAlign: 'center' }}>{periodLabel}</b>{' '}
          <C.IconBtn ico="chevR" label={L('Next month', 'الشهر التالي')} data-attendance-shift="1" />
        </div>{' '}
        <input
          className="input"
          type="search"
          data-attendance-search=""
          placeholder={L('Find a member', 'ابحث عن عضو')}
          aria-label={L('Find a member', 'ابحث عن عضو')}
          style={{ maxWidth: '230px' }}
        />{' '}
        <button
          className="btn btn-secondary btn-dense"
          data-attendance-order=""
          aria-label={L('Reverse meeting date order', 'عكس ترتيب تواريخ الاجتماعات')}
          title={L('Reverse meeting date order', 'عكس ترتيب تواريخ الاجتماعات')}
        >
          <Icon name="sort" size={15} />
          {L(
            S.ui.attendanceReverse ? 'Newest first' : 'Oldest first',
            S.ui.attendanceReverse ? 'الأحدث أولاً' : 'الأقدم أولاً'
          )}
        </button>{' '}
        <span className="t-caption dim">
          {recorded}/
          {meetings.reduce(
            (n, m) => n + d.roster.filter(r => !m.participants?.length || m.participants.includes(r.p)).length,
            0
          ) + formerIds.reduce((n, pid) => n + meetings.filter(m => attendanceValue(m, pid)).length, 0)}{' '}
          {L('recorded', 'مسجّل')}
        </span>{' '}
        <span className="attendance-legend">
          {attendanceTag('present', counts.present)}
          {attendanceTag('excused', counts.excused)}
          {attendanceTag('absent', counts.absent)}
        </span>{' '}
        <button className="btn btn-secondary btn-dense" data-attendance-import="">
          {L('Import Excel', 'استيراد Excel')}
        </button>{' '}
        <button className="btn btn-secondary btn-dense" data-attendance-export="">
          {L('Export', 'تصدير')}
        </button>{' '}
        <button className="btn btn-secondary btn-dense" data-attendance-print="">
          <Icon name="print" size={15} />
          {L('Print', 'طباعة')}
        </button>{' '}
        <button className="btn btn-primary btn-dense" data-act="meeting-new">
          <Icon name="plus" size={15} />
          {L('Add meeting', 'إضافة اجتماع')}
        </button>
      </div>{' '}
      {!meetings.length ? (
        <Empty
          glyph="events"
          title={L('No meetings this month', 'لا اجتماعات هذا الشهر')}
          body={L('Add a meeting or choose another month.', 'أضف اجتماعاً أو اختر شهراً آخر.')}
        />
      ) : !visibleRoster.length ? (
        <Empty
          glyph="groups"
          title={L('No group members yet', 'لا أعضاء في المجموعة بعد')}
          body={L('Add members to start attendance.', 'أضف أعضاء لبدء تسجيل الحضور.')}
        />
      ) : (
        <div
          className="attendance-scroll"
          style={{
            overflow: 'auto',
            maxWidth: '100%',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-card)'
          }}
        >
          <table
            className="attendance-table"
            style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 'max-content' }}
          >
            <caption className="sr">
              {L(g.name, g.ar)} — {periodLabel} {L('attendance', 'الحضور')}
            </caption>
            <thead>
              <tr>
                <th
                  className="attendance-name"
                  style={{
                    position: 'sticky',
                    insetInlineStart: 0,
                    top: 0,
                    zIndex: 3,
                    background: 'var(--muted)',
                    padding: '10px',
                    textAlign: 'start',
                    minWidth: '200px'
                  }}
                >
                  {L('Member', 'العضو')}
                </th>
                {meetings.map((m, i) => (
                  <th
                    key={i}
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 2,
                      background: 'var(--muted)',
                      padding: '8px',
                      minWidth: '138px',
                      textAlign: 'center'
                    }}
                  >
                    <span className="mono">{fmtDate(m.d)}</span>
                    <br />
                    <small className="dim">{m.t}</small>{' '}
                    <C.IconBtn
                      ico="edit"
                      label={L('Edit meeting', 'تعديل الاجتماع')}
                      data-meeting-edit={meetingId(m)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRoster.map((r, i) => {
                const p = person(r.p);
                return (
                  <tr key={i} data-attendance-member={`${p?.lat || ''} ${p?.ar || ''}`.toLowerCase()}>
                    <th
                      className="attendance-name"
                      scope="row"
                      style={{
                        position: 'sticky',
                        insetInlineStart: 0,
                        zIndex: 1,
                        background: 'var(--surface)',
                        padding: '9px 10px',
                        textAlign: 'start',
                        borderTop: '1px solid var(--border)'
                      }}
                    >
                      <button
                        className="btn btn-ghost btn-dense"
                        data-attendance-history={r.p}
                        style={{ textAlign: 'start' }}
                      >
                        {L(p?.lat || r.p, p?.ar || r.p)}
                      </button>{' '}
                      {r.former ? (
                        <small className="dim" style={{ display: 'block' }}>
                          {L('Former member', 'عضو سابق')}
                        </small>
                      ) : (
                        ''
                      )}
                    </th>
                    {meetings.map((m, i) => {
                      const value = attendanceValue(m, r.p),
                        invited = !m.participants?.length || m.participants.includes(r.p);
                      return (
                        <td
                          key={i}
                          style={{ padding: '6px', borderTop: '1px solid var(--border)', textAlign: 'center' }}
                        >
                          {!invited && !value ? (
                            <span className="dim" title={L('Not invited', 'غير مدعو')}>
                              —
                            </span>
                          ) : (
                            <button
                              type="button"
                              className={`attendance-choice attendance-${value || 'unrecorded'}`}
                              data-attendance={`${meetingId(m)}|${r.p}`}
                              disabled={!!(r.former || !invited)}
                              aria-label={`${L(p?.lat || r.p, p?.ar || r.p)} — ${fmtDate(m.d)}: ${L(...(ATTENDANCE_OPTIONS.find(x => x[0] === value) || ATTENDANCE_OPTIONS[0]).slice(1))}`}
                            >
                              {attendanceTag(value)}
                              <Icon name="chevD" size={14} />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}{' '}
      <p className="t-caption dim" style={{ marginTop: '10px' }}>
        {L(
          'Each cell belongs to a group member and meeting. Changes save as you select a status.',
          'كل خانة مرتبطة بعضو واجتماع. تُحفظ التغييرات عند اختيار الحالة.'
        )}
      </p>
    </>
  );
}

function attendanceRows(gid) {
  const d = groupInfo(gid),
    period =
      S.ui.attendancePeriod ||
      d.meetings
        .slice()
        .sort((a, b) => b.d.localeCompare(a.d))[0]
        ?.d?.slice(0, 7) ||
      '';
  const meetings = d.meetings.filter(m => m.d.startsWith(period)).sort(byTime);
  return {
    period,
    rows: meetings.flatMap(m =>
      d.roster
        .filter(r => !m.participants?.length || m.participants.includes(r.p))
        .map(r => [
          m.d,
          m.t,
          m.title || '',
          r.p,
          person(r.p)?.lat || '',
          person(r.p)?.ar || '',
          attendanceValue(m, r.p) || 'unrecorded'
        ])
    )
  };
}

export function attendanceExport(gid) {
  const { period, rows } = attendanceRows(gid),
    fields = [['Date', 'Time', 'Meeting', 'Person ID', 'Name', 'Arabic name', 'Attendance'], ...rows];
  const safe = value => {
    const str = String(value ?? '');
    return `"${(/^[=+@-]/.test(str) ? "'" : '') + str.replace(/"/g, '""')}"`;
  };
  download(`attendance-${gid}-${period}.csv`, fields.map(row => row.map(safe).join(',')).join('\r\n'));
}

export function attendancePrint(gid) {
  const g = group(gid),
    { period, rows } = attendanceRows(gid);
  const popup = window.open('', '_blank');
  if (!popup) return toast(L('Allow the print window', 'اسمح بنافذة الطباعة'), '', 'warning');
  /* the sheet is written into the new window as a page of its own; React draws the table */
  const table = (
    <table>
      <thead>
        <tr>
          {[
            L('Date', 'التاريخ'),
            L('Time', 'الوقت'),
            L('Meeting', 'الاجتماع'),
            L('Member', 'العضو'),
            L('Status', 'الحالة')
          ].map((x, i) => (
            <th key={i}>{x}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {[row[0], row[1], row[2], L(row[4], row[5]), row[6]].map((x, j) => (
              <td key={j}>{x}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
  popup.document
    .write(`<!doctype html><html lang="${isAr() ? 'ar' : 'en'}" dir="${isAr() ? 'rtl' : 'ltr'}"><meta charset="utf-8"><title>${markup(
    <>
      {L(g.name, g.ar)} — {period}
    </>
  )}</title>
    <style>body{font:14px Arial,sans-serif;padding:24px;color:#233B32}h1{font-size:22px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #DCE2DB;padding:8px;text-align:start}th{background:#EDF0E8}@page{size:landscape;margin:15mm}</style>
    ${markup(
      <h1>
        {L(g.name, g.ar)} — {period} {L('attendance', 'الحضور')}
      </h1>
    )}${markup(table)}</html>`);
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 150);
}

export function attendanceImport(gid) {
  const d = groupInfo(gid);
  let workbook = [],
    mapped = [];
  const roster = d.roster.map(r => person(r.p)).filter(Boolean);
  const normalize = s =>
    String(s || '')
      .trim()
      .toLocaleLowerCase()
      .replace(/\s+/g, ' ');
  const labels = [
    ['present', 'Present', 'حاضر'],
    ['excused', 'Excused', 'معذور'],
    ['absent', 'Absent', 'غائب']
  ];
  openDrawer({
    large: true,
    title: L('Import attendance from Excel', 'استيراد الحضور من Excel'),
    sub: L(
      'Choose a workbook, map its name and status columns, review every match, then apply to one meeting. No file is stored.',
      'اختر ملف Excel وحدّد عمودي الاسم والحالة وراجع كل مطابقة ثم طبّقها على اجتماع واحد. لا يُحفظ الملف.'
    ),
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="ai_meeting">
            {L('Meeting', 'الاجتماع')}
          </label>
          <Select id="ai_meeting">
            <option value="">{L('Choose a meeting', 'اختر اجتماعاً')}</option>
            {d.meetings
              .slice()
              .sort((a, b) => b.d.localeCompare(a.d))
              .map((m, i) => (
                <option key={i} value={meetingId(m)}>
                  {m.title || L('Meeting', 'اجتماع')} · {fmtDate(m.d)}
                </option>
              ))}
          </Select>
        </div>{' '}
        <div className="formrow">
          <label className="label" htmlFor="ai_file">
            {L('Excel workbook (.xlsx)', 'ملف Excel (.xlsx)')}
          </label>
          <input
            className="input"
            id="ai_file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          />
        </div>{' '}
        <div id="ai_map" aria-live="polite" />
        <div id="ai_review" aria-live="polite" />
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="ai_apply" disabled>
          {L('Apply reviewed records', 'تطبيق السجلات المراجَعة')}
        </button>
      </>
    ),
    onMount(el) {
      const mapping = el.querySelector('#ai_map'),
        review = el.querySelector('#ai_review'),
        apply = el.querySelector('#ai_apply');
      const update = () => {
        mapped = [];
        apply.disabled = true;
        const mid = el.querySelector('#ai_meeting').value,
          meeting = d.meetings.find(m => meetingId(m) === mid);
        if (!workbook.length || !meeting) {
          paint(review, null);
          return;
        }
        const ni = Number(el.querySelector('#ai_name')?.value),
          si = Number(el.querySelector('#ai_status')?.value),
          seen = new Set();
        const results = workbook
          .slice(1)
          .filter(row => row.some(cell => String(cell || '').trim()))
          .map((row, index) => {
            const source = normalize(row[ni]),
              matches = roster.filter(p => [p.id, p.lat, p.ar].some(v => normalize(v) === source));
            const p = matches.length === 1 ? matches[0] : null,
              raw = normalize(row[si]);
            const value = labels.find(([key, en, ar]) => [key, normalize(en), normalize(ar)].includes(raw))?.[0] || '';
            const error = !source
              ? L('Name missing', 'الاسم ناقص')
              : matches.length !== 1
                ? L(
                    matches.length ? 'Ambiguous name' : 'Person not in roster',
                    matches.length ? 'الاسم ملتبس' : 'ليس في لائحة الأعضاء'
                  )
                : meeting.participants?.length && !meeting.participants.includes(p.id)
                  ? L('Not invited', 'غير مدعو')
                  : seen.has(p.id)
                    ? L('Duplicate person', 'شخص مكرّر')
                    : !value
                      ? L('Unrecognized status', 'حالة غير معروفة')
                      : '';
            if (p && !error) seen.add(p.id);
            return {
              line: index + 2,
              p,
              value,
              error,
              current: p ? attendanceValue(meeting, p.id) : '',
              source: row[ni],
              raw: row[si]
            };
          });
        mapped = results.filter(row => !row.error);
        const errors = results.filter(row => row.error);
        paint(
          review,
          <>
            <div className="divider" />
            <p className="t-caption">
              {mapped.length} {L('ready', 'جاهز')} · {errors.length} {L('errors', 'أخطاء')}
            </p>{' '}
            {errors.length ? (
              <C.InlineAlert
                tone="warning"
                title={L('Fix the workbook before applying', 'صحّح الملف قبل التطبيق')}
                body={L('Rows with errors will not be applied.', 'الصفوف التي فيها أخطاء لن تُطبّق.')}
              />
            ) : (
              ''
            )}{' '}
            <div className="tablewrap">
              <table className="table">
                <thead>
                  <tr>
                    {[
                      L('Row', 'الصف'),
                      L('Workbook name', 'الاسم في الملف'),
                      L('Matched member', 'العضو المطابق'),
                      L('Status', 'الحالة'),
                      L('Current', 'الحالي'),
                      L('Review', 'المراجعة')
                    ].map((label, i) => (
                      <th key={i}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 100).map((row, i) => (
                    <tr key={i}>
                      <td>{row.line}</td>
                      <td>{row.source || '—'}</td>
                      <td>{row.p ? L(row.p.lat, row.p.ar) : '—'}</td>
                      <td>{row.raw || '—'}</td>
                      <td>{row.current || '—'}</td>
                      <td>{row.error ? <span className="help-error">{row.error}</span> : L('Ready', 'جاهز')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {results.length > 100 ? (
              <p className="help">
                {L(
                  'Only the first 100 rows are shown; all rows are checked.',
                  'تظهر أول ١٠٠ صف فقط، وتُفحص كل الصفوف.'
                )}
              </p>
            ) : (
              ''
            )}
          </>
        );
        apply.disabled = !mapped.length || !!errors.length;
      };
      el.querySelector('#ai_file').addEventListener('change', async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!/\.xlsx$/i.test(file.name) || file.size > 2_000_000) {
          toast(L('Choose an .xlsx file under 2 MB', 'اختر ملف .xlsx أصغر من ٢ ميغابايت'), '', 'warning');
          return;
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        try {
          workbook = (await parishAPI('attendance-preview', 'POST', { groupId: gid, data: btoa(binary) })).rows;
        } catch (error) {
          toast(L('Could not read workbook', 'تعذّرت قراءة الملف'), error.message, 'danger');
          return;
        }
        const headings = workbook[0] || [],
          options = headings.map((heading, index) => (
            <option key={index} value={index}>
              {heading || `Column ${index + 1}`}
            </option>
          ));
        paint(
          mapping,
          <>
            <div className="formgrid">
              <div className="formrow">
                <label className="label" htmlFor="ai_name">
                  {L('Person column', 'عمود الشخص')}
                </label>
                <Select id="ai_name">{options}</Select>
              </div>{' '}
              <div className="formrow">
                <label className="label" htmlFor="ai_status">
                  {L('Attendance column', 'عمود الحضور')}
                </label>
                <Select id="ai_status">{options}</Select>
              </div>
            </div>{' '}
            <p className="help">
              {L(
                'Accepted statuses: Present, Excused, Absent (or Arabic equivalents).',
                'الحالات المقبولة: حاضر، معذور، غائب (أو ما يقابلها بالإنكليزية).'
              )}
            </p>
          </>
        );
        const nameIndex = headings.findIndex(v => /person|member|name|الاسم|الشخص/i.test(v)),
          statusIndex = headings.findIndex(v => /status|attendance|الحضور|الحالة/i.test(v));
        el.querySelector('#ai_name').value = String(Math.max(0, nameIndex));
        el.querySelector('#ai_status').value = String(Math.max(0, statusIndex));
        el.querySelectorAll('#ai_name,#ai_status').forEach(sel => sel.addEventListener('change', update));
        update();
      });
      el.querySelector('#ai_meeting').addEventListener('change', update);
      apply.addEventListener('click', async () => {
        const meeting = d.meetings.find(m => meetingId(m) === el.querySelector('#ai_meeting').value);
        if (!meeting || !mapped.length || apply.disabled) return;
        meeting.attendance ||= {};
        for (const row of mapped) meeting.attendance[row.p.id] = row.value;
        meeting.done = true;
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
        toast(L('Attendance imported', 'استُورد الحضور'), `${mapped.length} ${L('records', 'سجلات')}`, 'success');
      });
    }
  });
}
