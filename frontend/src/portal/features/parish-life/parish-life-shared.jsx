/* What the parish-life screens share: dates, times, meeting kinds and ministry roles. */
import { t } from '../../../lib/i18n.js';
import { is } from '../../model/store.js';
import { Icon, Who, Pill } from '../../ui/ui.jsx';
import * as CR from '../../shared/record-editor.jsx';
import { attendanceValue } from '../../model/planning.js';
import { person } from '../../model/data.js';

export const iso = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const L = (en, ar) => t(en, ar);

export const byTime = (a, b) => (a.d + a.t).localeCompare(b.d + b.t);

export const meetingKind = m =>
  m.kind === 'committee' ? L('Committee / people in charge', 'اللجنة / المسؤولون') : L('Whole group', 'المجموعة كاملة');

export const addMin = (hm, m) => {
  const [h, mi] = hm.split(':').map(Number),
    x = h * 60 + mi + m;
  return `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

export function groupCards(items, tab = '') {
  return items.map((g, i) => {
    const leader = person(g.leader);
    const visTone = g.vis === 'confidential' ? 'danger' : g.vis === 'private' ? 'warning' : '';
    const visLabel =
      g.vis === 'confidential'
        ? L('Confidential', 'سرّي')
        : g.vis === 'private'
          ? L('Private', 'خاص')
          : L('Public', 'عام');
    return (
      <section key={i} className="panel card-link" data-find-item="">
        <div className="panel-b">
          <div className="row" style={{ gap: '10px', alignItems: 'flex-start' }}>
            <span className="avatar avatar-lg">
              <Icon name="groups" size={20} />
            </span>{' '}
            <div style={{ flex: 1, minWidth: 0 }}>
              <a className="stretch" href={`#/groups/${g.id}${tab ? `/${tab}` : ''}`}>
                <b style={{ display: 'block', font: '600 16px/22px var(--sans)' }}>{L(g.name, g.ar || g.name)}</b>
              </a>{' '}
              <small className="t-caption dim">
                {L(g.cat, g.catAr)}
                {g.meets ? ` · ${L(g.meets, g.meetsAr)}` : ''}
              </small>
            </div>{' '}
            {!is('leader') ? CR.recBtn('group', g.id) : ''}
          </div>{' '}
          <div className="divider" />{' '}
          <div className="row" style={{ gap: '10px' }}>
            <Who p={leader} />
            <span className="row" style={{ gap: '8px', marginInlineStart: 'auto' }}>
              <Pill label={visLabel} tone={visTone} mark={g.vis === 'public' ? true : 'lock'} />{' '}
              <span className="badge badge-quiet" title={L('members', 'أعضاء')}>
                {g.members}
              </span>
            </span>
          </div>
        </div>
      </section>
    );
  });
}

export function meetingAttendance(m) {
  const values = Object.values(m.attendance || {});
  if (values.length)
    return {
      present: Math.max(m.present || 0, values.filter(value => value === 'present').length),
      excused:
        values.filter(value => value === 'excused').length +
        (m.absent || []).filter(([pid]) => !(pid in (m.attendance || {}))).length,
      absent: values.filter(value => value === 'absent').length
    };
  return { present: m.present || 0, excused: (m.absent || []).length, absent: 0 };
}

export const ATTENDANCE_OPTIONS = [
  ['', 'Not recorded', 'غير مسجّل'],
  ['present', 'Present', 'حاضر'],
  ['excused', 'Excused', 'معذور'],
  ['absent', 'Absent', 'غائب']
];

export const attendanceTag = (value, count) => {
  const option = ATTENDANCE_OPTIONS.find(([key]) => key === value) || ATTENDANCE_OPTIONS[0];
  return (
    <span className={`attendance-tag attendance-${value || 'unrecorded'}`}>
      <span className="attendance-dot" />
      {count == null ? '' : <b>{count}</b>}
      {L(option[1], option[2])}
    </span>
  );
};

export function memberAttendancePct(meetings, pid) {
  const values = meetings.map(m => attendanceValue(m, pid)).filter(Boolean);
  return values.length ? `${Math.round((values.filter(x => x === 'present').length / values.length) * 100)}%` : '—';
}
