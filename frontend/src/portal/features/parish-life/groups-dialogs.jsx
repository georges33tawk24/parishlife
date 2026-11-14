/* Group dialogs: adding members, meetings, posts, tasks and milestones, handing over leadership,
   and a member's menu. */
import { Select } from '../../ui/components.jsx';
import { t, fmtDate } from '../../../lib/i18n.js';
import { S, go, me, is } from '../../model/store.js';
import { toast, openDrawer, openModal, closeOverlays, Who, openMenu } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as D from '../../model/data.js';
import { persist, hydrate } from '../../model/persist.js';
import { session } from '../../model/api.js';
import { ministryAction, applicationAction } from '../../model/modules/ministries.js';
import { safeRichText } from '../../../lib/rich-text.js';
import { curGroup, nameOf, ok, refresh, val } from '../../shared/dialog-helpers.jsx';
import { need } from '../../shared/dialogs.jsx';
import { compose } from '../communicate/messaging-dialogs.jsx';

/* Display only: an empty twin falls back to the other language (never when saving). */
const L = (en, ar) => t(en || ar, ar || en);

const gd = () => D.groupInfo(curGroup());

export function memberAdd(gid = curGroup()) {
  const d = D.groupInfo(gid);
  const candidates = D.PEOPLE.filter(p => !d.roster.some(r => r.p === p.id));
  openDrawer({
    title: L('Add existing people', 'إضافة أشخاص مسجّلين'),
    sub: L(
      'Search and select several people. Existing members are excluded.',
      'ابحث واختر عدة أشخاص. الأعضاء الحاليون مستبعدون.'
    ),
    body: (
      <>
        <input
          className="input"
          type="search"
          id="group-member-search"
          placeholder={L('Search names', 'البحث عن أسماء')}
        />{' '}
        <div className="choice-grid" style={{ marginTop: '12px' }} id="group-member-choices">
          {candidates.map((p, i) => (
            <label key={i} className="row" data-member-name={(p.lat + ' ' + p.ar).toLowerCase()}>
              <input type="checkbox" defaultValue={p.id} data-member-choice="" />
              <span>
                {p.lat} · {p.ar}
              </span>
            </label>
          ))}
        </div>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="group-members-add">
          {L('Add selected people', 'إضافة المحدّدين')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#group-member-search').addEventListener('input', e => {
        const q = e.target.value.trim().toLowerCase();
        el.querySelectorAll('[data-member-name]').forEach(row => (row.hidden = !row.dataset.memberName.includes(q)));
      });
      el.querySelector('#group-members-add').addEventListener('click', async () => {
        const selected = [...el.querySelectorAll('[data-member-choice]:checked')].map(c => c.value);
        if (!selected.length)
          return toast(L('Select at least one person', 'اختر شخصاً واحداً على الأقل'), '', 'warning');
        for (const pid of selected)
          if (!d.roster.some(r => r.p === pid))
            d.roster.push({
              p: pid,
              role: 'Member',
              roleAr: 'عضو',
              joined: new Date().getFullYear().toString(),
              att: 0
            });
        const g = D.group(gid);
        if (g && S.role !== 'leader') g.members = (Number(g.members) || 0) + selected.length;
        if (!(await persist())) return;
        closeOverlays();
        refresh();
        ok(L('Members added', 'أُضيف الأعضاء'), `${selected.length}`);
      });
    }
  });
}

export function meetingNew(gid = curGroup()) {
  const detail = D.groupInfo(gid);
  const now = new Date(),
    todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  openDrawer({
    title: L('Schedule a meeting', 'جدولة اجتماع'),
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="m_kind">
            {L('Meeting for', 'الاجتماع لـ')}
          </label>
          <Select id="m_kind">
            <option value="group">{L('All group members', 'جميع أعضاء المجموعة')}</option>
            <option value="committee">{L('Committee / people in charge', 'اللجنة / المسؤولون')}</option>
          </Select>
        </div>{' '}
        <C.Field
          label={L('Meeting title', 'عنوان الاجتماع')}
          id="m_title"
          value={L('Ministry meeting', 'اجتماع الخدمة')}
          req={true}
        />{' '}
        <C.Textarea label={L('Description or agenda', 'الوصف أو جدول الأعمال')} id="m_description" max={500} />{' '}
        <div className="formgrid">
          <C.Field label={L('First date', 'التاريخ الأول')} type="date" value={todayKey} id="m_d" />{' '}
          <C.Field label={L('Starts at', 'يبدأ عند')} type="time" value="19:00" id="m_t" />
        </div>{' '}
        <div className="formgrid">
          <C.Field label={L('Ends at', 'ينتهي عند')} type="time" value="20:00" id="m_end" />{' '}
          <C.Field label={L('Place (optional)', 'المكان (اختياري)')} id="m_place" />
        </div>{' '}
        <div className="formgrid">
          <div className="formrow">
            <label className="label" htmlFor="m_repeat">
              {L('Repeats', 'التكرار')}
            </label>
            <Select id="m_repeat">
              <option value="0">{L('Once', 'مرّة')}</option>
              <option value="7">{L('Every week', 'كل أسبوع')}</option>
              <option value="14">{L('Every two weeks', 'كل أسبوعين')}</option>
            </Select>
          </div>{' '}
          <C.Stepper label={L('Total number of meetings', 'إجمالي عدد الاجتماعات')} value={4} id="m_count" />
        </div>{' '}
        <fieldset className="repeat-days" id="m_days" hidden>
          <legend>{L('Repeat on', 'يتكرّر في')}</legend>{' '}
          <div className="repeat-day-list">
            {[
              [0, 'S', 'الأحد'],
              [1, 'M', 'الإثنين'],
              [2, 'T', 'الثلاثاء'],
              [3, 'W', 'الأربعاء'],
              [4, 'TH', 'الخميس'],
              [5, 'F', 'الجمعة'],
              [6, 'SA', 'السبت']
            ].map(([day, en, ar], i) => (
              <label key={i} className="repeat-day">
                <input
                  type="checkbox"
                  defaultValue={day}
                  aria-label={L(
                    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day],
                    ar
                  )}
                />
                <span>{L(en, ar)}</span>
              </label>
            ))}
          </div>{' '}
          <p className="help">
            {L(
              'The count is the total number of meetings. Choose no more weekdays than meetings.',
              'العدد هو إجمالي الاجتماعات. اختر أياماً لا تتجاوز عدد الاجتماعات.'
            )}
          </p>
        </fieldset>{' '}
        <label className="check" style={{ marginTop: '16px' }}>
          <input type="checkbox" id="m_specific" />
          <span>{L('Invite specific group members', 'دعوة أعضاء محدّدين من المجموعة')}</span>
        </label>{' '}
        <fieldset className="formrow" id="m_people" hidden>
          <legend className="label">{L('Participants', 'المشاركون')}</legend>
          <div className="choice-grid">
            {detail.roster.map((r, i) => (
              <label key={i} className="check">
                <input type="checkbox" defaultValue={r.p} />
                <span>{L(D.person(r.p)?.lat || r.p, D.person(r.p)?.ar || r.p)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="m_go" style={{ marginInlineStart: 'auto' }}>
          {L('Schedule', 'جدولة')}
        </button>
      </>
    ),
    onMount(el) {
      const count = el.querySelector('#m_count');
      count.closest('.formrow').hidden = true;
      const days = el.querySelector('#m_days');
      const selectStartDay = () => {
        if (days.querySelector('input:checked')) return;
        const raw = val(el, '#m_d');
        if (!raw) return;
        const d = new Date(`${raw}T12:00:00`);
        if (!Number.isNaN(d.getTime())) days.querySelector(`input[value="${d.getDay()}"]`).checked = true;
      };
      el.querySelector('#m_repeat').addEventListener('change', () => {
        const repeating = el.querySelector('#m_repeat').value !== '0';
        count.closest('.formrow').hidden = !repeating;
        days.hidden = !repeating;
        if (repeating) selectStartDay();
      });
      el.querySelector('#m_specific').addEventListener('change', e => {
        el.querySelector('#m_people').hidden = !e.target.checked;
      });
      days.querySelectorAll('input').forEach(box =>
        box.addEventListener('change', () => {
          const total = Math.max(1, Number(count.value) || 1);
          if ([...days.querySelectorAll('input:checked')].length > total) {
            box.checked = false;
            toast(
              L('Too many weekdays', 'أيام كثيرة'),
              L(
                'The number of weekdays cannot exceed the total meeting count.',
                'لا يجوز أن يتجاوز عدد الأيام إجمالي الاجتماعات.'
              ),
              'warning'
            );
          }
        })
      );
      el.querySelector('#m_d').addEventListener('change', () => {
        if (!days.hidden) {
          days.querySelectorAll('input').forEach(box => (box.checked = false));
          selectStartDay();
        }
      });
      el.querySelector('#m_go').addEventListener('click', async () => {
        if (
          !need(el, '#m_title', L('Name the meeting', 'سمّ الاجتماع')) ||
          !need(el, '#m_d', L('Choose a date', 'اختر التاريخ')) ||
          !need(el, '#m_t', L('Choose a time', 'اختر الوقت'))
        )
          return;
        const date = val(el, '#m_d'),
          time = val(el, '#m_t'),
          end = val(el, '#m_end'),
          interval = Number(val(el, '#m_repeat')),
          count = interval ? Math.min(52, Math.max(1, Number(val(el, '#m_count')) || 4)) : 1;
        if (end && end <= time)
          return toast(L('End time must follow start time', 'يجب أن يكون وقت النهاية بعد البداية'), '', 'warning');
        const selected = new Set([...days.querySelectorAll('input:checked')].map(box => Number(box.value)));
        if (interval && !selected.size)
          return toast(L('Choose at least one weekday', 'اختر يوماً واحداً على الأقل'), '', 'warning');
        if (interval && selected.size > count)
          return toast(
            L('Too many weekdays', 'أيام كثيرة'),
            L('Choose no more weekdays than meetings.', 'اختر أياماً لا تتجاوز عدد الاجتماعات.'),
            'warning'
          );
        const participants = el.querySelector('#m_specific').checked
          ? [...el.querySelectorAll('#m_people input:checked')].map(input => input.value)
          : [];
        if (el.querySelector('#m_specific').checked && !participants.length)
          return toast(L('Choose at least one participant', 'اختر مشاركاً واحداً على الأقل'), '', 'warning');
        const starts = new Date(`${date}T12:00:00`),
          weekStart = new Date(starts),
          added = [];
        weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
        for (let i = 0; added.length < count && i < 730; i++) {
          const next = new Date(starts);
          next.setDate(starts.getDate() + i);
          const d = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
          const weeks = Math.floor(
            (Date.UTC(next.getFullYear(), next.getMonth(), next.getDate()) -
              Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate())) /
              604800000
          );
          if (interval && (!selected.has(next.getDay()) || weeks % (interval / 7) !== 0)) continue;
          if (detail.meetings.some(m => m.d === d && m.t === time)) continue;
          const meeting = {
            id: `mt${Date.now().toString(36)}-${i}`,
            d,
            t: time,
            end,
            title: val(el, '#m_title'),
            kind: val(el, '#m_kind'),
            description: val(el, '#m_description'),
            place: val(el, '#m_place'),
            participants: [...participants],
            rsvp: { yes: 0, no: 0, none: participants.length || detail.roster.length },
            done: false,
            attendance: {}
          };
          detail.meetings.push(meeting);
          added.push(meeting);
          if (!interval) break;
        }
        if (!added.length)
          return toast(
            L('Meeting already exists', 'الاجتماع موجود'),
            L('Choose another date or time.', 'اختر تاريخاً أو وقتاً آخر.'),
            'warning'
          );
        S.ui.attendancePeriod = date.slice(0, 7);
        if (!(await persist())) return;
        closeOverlays();
        refresh();
        ok(
          L(
            added.length === 1 ? 'Meeting scheduled' : `${added.length} meetings scheduled`,
            added.length === 1 ? 'جُدول الاجتماع' : `جُدولت ${added.length} اجتماعات`
          ),
          `${fmtDate(date)} · ${time}`
        );
      });
    }
  });
}

export function meetingEdit(id) {
  const meeting = gd().meetings.find(m => (m.id || `mt-${m.d}-${m.t}`) === id);
  if (!meeting) return;
  openDrawer({
    title: L('Edit meeting', 'تعديل الاجتماع'),
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="me_kind">
            {L('Meeting for', 'الاجتماع لـ')}
          </label>
          <Select id="me_kind" defaultValue={meeting.kind === 'committee' ? 'committee' : 'group'}>
            <option value="group">{L('All group members', 'جميع أعضاء المجموعة')}</option>
            <option value="committee">{L('Committee / people in charge', 'اللجنة / المسؤولون')}</option>
          </Select>
        </div>{' '}
        <C.Field
          label={L('Meeting title', 'عنوان الاجتماع')}
          id="me_title"
          value={meeting.title || L('Ministry meeting', 'اجتماع الخدمة')}
          req={true}
        />{' '}
        <C.Textarea
          label={L('Description or agenda', 'الوصف أو جدول الأعمال')}
          id="me_description"
          value={meeting.description || ''}
          max={500}
        />{' '}
        <div className="formgrid">
          <C.Field label={L('Date', 'التاريخ')} type="date" id="me_date" value={meeting.d} />{' '}
          <C.Field label={L('Starts at', 'يبدأ عند')} type="time" id="me_time" value={meeting.t} />
        </div>{' '}
        <div className="formgrid">
          <C.Field label={L('Ends at', 'ينتهي عند')} type="time" id="me_end" value={meeting.end || ''} />{' '}
          <C.Field label={L('Place (optional)', 'المكان (اختياري)')} id="me_place" value={meeting.place || ''} />
        </div>{' '}
        <label className="check" style={{ marginTop: '16px' }}>
          <input type="checkbox" id="me_specific" defaultChecked={!!meeting.participants?.length} />
          <span>{L('Invite specific group members', 'دعوة أعضاء محدّدين من المجموعة')}</span>
        </label>{' '}
        <fieldset className="formrow" id="me_people" hidden={!meeting.participants?.length}>
          <legend className="label">{L('Participants', 'المشاركون')}</legend>
          <div className="choice-grid">
            {gd().roster.map((r, i) => (
              <label key={i} className="check">
                <input type="checkbox" defaultValue={r.p} defaultChecked={!!meeting.participants?.includes(r.p)} />
                <span>{L(D.person(r.p)?.lat || r.p, D.person(r.p)?.ar || r.p)}</span>
              </label>
            ))}
          </div>
        </fieldset>{' '}
        <p className="t-caption dim">
          {is('secretary')
            ? L('Update the meeting date, place and invited members.', 'عدّل موعد الاجتماع ومكانه والأعضاء المدعوين.')
            : L(
                'Changing this date keeps its attendance linked to the meeting.',
                'تغيير التاريخ يبقي الحضور مرتبطاً بالاجتماع.'
              )}
        </p>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-danger-quiet" id="me_delete">
          {L('Delete meeting', 'حذف الاجتماع')}
        </button>{' '}
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="me_save">
          {L('Save', 'حفظ')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#me_specific').addEventListener('change', e => {
        el.querySelector('#me_people').hidden = !e.target.checked;
      });
      el.querySelector('#me_save').addEventListener('click', async () => {
        const d = val(el, '#me_date'),
          t = val(el, '#me_time'),
          end = val(el, '#me_end');
        if (!need(el, '#me_title', L('Name the meeting', 'سمّ الاجتماع')) || !d || !t)
          return toast(L('Choose a title, date and time', 'اختر عنواناً وتاريخاً ووقتاً'), '', 'warning');
        if (end && end <= t)
          return toast(L('End time must follow start time', 'يجب أن يكون وقت النهاية بعد البداية'), '', 'warning');
        if (gd().meetings.some(x => x !== meeting && x.d === d && x.t === t))
          return toast(L('Meeting already exists', 'الاجتماع موجود'), '', 'warning');
        const participants = el.querySelector('#me_specific').checked
          ? [...el.querySelectorAll('#me_people input:checked')].map(x => x.value)
          : [];
        if (el.querySelector('#me_specific').checked && !participants.length)
          return toast(L('Choose at least one participant', 'اختر مشاركاً واحداً على الأقل'), '', 'warning');
        Object.assign(meeting, {
          d,
          t,
          end,
          kind: val(el, '#me_kind'),
          title: val(el, '#me_title'),
          description: val(el, '#me_description'),
          place: val(el, '#me_place'),
          participants
        });
        if (!(await persist())) return;
        S.ui.attendancePeriod = d.slice(0, 7);
        closeOverlays();
        refresh();
        ok(L('Meeting updated', 'حُدّث الاجتماع'));
      });
      el.querySelector('#me_delete').addEventListener('click', () => {
        closeOverlays();
        openModal({
          title: L('Delete meeting and attendance?', 'حذف الاجتماع والحضور؟'),
          body: (
            <>
              <p>
                {fmtDate(meeting.d)} · {meeting.t}
              </p>
              <p className="t-caption dim">
                {L(
                  'Recorded attendance for this date will also be deleted.',
                  'سيُحذف أيضاً الحضور المسجّل لهذا التاريخ.'
                )}
              </p>
            </>
          ),
          foot: (
            <>
              <button className="btn btn-secondary" data-close="">
                {L('Keep meeting', 'إبقاء الاجتماع')}
              </button>
              <button className="btn btn-danger" id="me_confirm">
                {L('Delete', 'حذف')}
              </button>
            </>
          ),
          onMount(mod) {
            mod.querySelector('#me_confirm').addEventListener('click', async () => {
              gd().meetings.splice(gd().meetings.indexOf(meeting), 1);
              if (!(await persist())) return;
              closeOverlays();
              refresh();
              ok(L('Meeting deleted', 'حُذف الاجتماع'));
            });
          }
        });
      });
    }
  });
}

export async function postAdd(btn) {
  const editor = btn.closest('.panel')?.querySelector('.rte-body');
  const body = editor?.innerText.trim();
  if (!body) return toast(L('Write something first', 'اكتب شيئاً أولاً'), '', 'warning');
  if (body.length > 12000)
    return toast(
      L('Post is too long', 'المنشور طويل جداً'),
      L('Keep it under 12,000 characters.', 'اجعله أقل من ١٢٬٠٠٠ حرف.'),
      'warning'
    );
  gd().posts.unshift({
    by: me()?.id || 'p3',
    at: new Date().toISOString().slice(0, 10),
    body,
    bodyAr: body,
    html: safeRichText(editor.innerHTML)
  });
  if (!(await persist())) return;
  refresh();
  ok(L('Posted to the group', 'نُشر في المجموعة'));
}

export function handover() {
  const group = D.GROUPS.find(x => x.id === curGroup()),
    detail = group && D.groupInfo(group.id);
  if (!group || !detail || is('leader')) return;
  const outgoing = group.leader,
    people = detail.roster
      .filter(row => row.p !== outgoing)
      .map(row => D.person(row.p))
      .filter(Boolean);
  if (!people.length) return toast(L('Add another member first', 'أضف عضواً آخر أولاً'), '', 'warning');
  const due = new Date().toLocaleDateString('sv-SE');
  openDrawer({
    title: L('Leadership handover', 'تسليم المسؤولية'),
    sub: L(group.name, group.ar),
    body: (
      <>
        <div className="formrow">
          <label className="label">{L('Current leader', 'المسؤول الحالي')}</label>
          <Who p={D.person(outgoing)} />
        </div>{' '}
        <div className="formrow">
          <label className="label" htmlFor="ho_to">
            {L('New leader', 'المسؤول الجديد')}
          </label>
          <Select id="ho_to">
            <option value="">{L('Choose an existing member', 'اختر عضواً موجوداً')}</option>
            {people.map((p, i) => (
              <option key={i} value={p.id}>
                {L(p.lat, p.ar)}
              </option>
            ))}
          </Select>
        </div>{' '}
        <p className="help">{L('This change takes effect immediately.', 'يسري هذا التغيير فوراً.')}</p>{' '}
        <C.InlineAlert
          tone="info"
          title={L(
            `${detail.tasks.filter(x => !x.done && x.who === outgoing).length} open tasks will move`,
            `${detail.tasks.filter(x => !x.done && x.who === outgoing).length} مهام مفتوحة ستنتقل`
          )}
          body={L(
            'The member record and attendance history stay with each person.',
            'يبقى سجل العضوية والحضور مرتبطاً بكل شخص.'
          )}
        />
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="ho_go" style={{ marginInlineStart: 'auto' }}>
          {L('Start handover', 'بدء التسليم')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#ho_go').addEventListener('click', async () => {
        const to = val(el, '#ho_to'),
          next = D.person(to);
        if (!next || !detail.roster.some(row => row.p === to))
          return toast(L('Choose a group member', 'اختر عضواً في المجموعة'), '', 'warning');
        group.leader = to;
        if (group.assistant === to) {
          group.assistant = null;
          detail.assistant = null;
        }
        for (const row of detail.roster) {
          if (row.p === outgoing && row.role === 'Leader') {
            row.role = 'Member';
            row.roleAr = 'عضو';
          }
          if (row.p === to) {
            row.role = 'Leader';
            row.roleAr = 'مسؤول';
          }
        }
        detail.roles = detail.roles.filter(([pid, role]) => pid !== to && !(pid === outgoing && role === 'Leader'));
        detail.roles.unshift([to, 'Leader', 'مسؤول']);
        for (const task of detail.tasks) if (!task.done && task.who === outgoing) task.who = to;
        detail.history.unshift([
          `Leadership transferred from ${D.person(outgoing)?.lat || outgoing} to ${next.lat}`,
          `انتقلت المسؤولية من ${D.person(outgoing)?.ar || outgoing} إلى ${next.ar || next.lat}`,
          due
        ]);
        if (!(await persist())) return;
        closeOverlays();
        refresh();
        ok(L('Handover completed', 'اكتمل التسليم'), nameOf(next));
      });
    }
  });
}

export function memberMenu(btn, pid) {
  const d = gd(),
    i = d.roster.findIndex(r => r.p === pid),
    r = d.roster[i];
  const g = D.group(curGroup());
  if (!r) return;
  openMenu(btn, [
    ...(S.role !== 'leader' ? [{ label: L('Message', 'مراسلة'), icon: 'msg', fn: () => compose(pid) }] : []),
    { label: L('Open record', 'فتح السجل'), icon: 'people', fn: () => go('person/' + pid) },
    ...(!is('leader') && pid !== g?.leader
      ? [
          {
            label: L('Make assistant', 'تعيين مساعداً'),
            icon: 'check',
            fn: async () => {
              if (g.assistant && g.assistant !== pid) {
                const previous = d.roster.find(row => row.p === g.assistant);
                if (previous) {
                  previous.role = 'Member';
                  previous.roleAr = 'عضو';
                }
              }
              g.assistant = pid;
              d.assistant = pid;
              r.role = 'Assistant';
              r.roleAr = 'مساعد';
              d.roles = d.roles.filter(([personId, role]) => personId !== pid && role !== 'Assistant');
              d.roles.push([pid, 'Assistant', 'مساعد']);
              if (!(await persist())) return;
              refresh();
              ok(L('Assistant updated', 'حُدّث المساعد'), nameOf(D.person(pid)));
            }
          }
        ]
      : []),
    { sep: true },
    {
      label: L('Remove from group', 'إزالة من المجموعة'),
      icon: 'trash',
      danger: true,
      fn: async () => {
        if (pid === g?.leader) return toast(L('Hand over leadership first', 'سلّم المسؤولية أولاً'), '', 'warning');
        if (pid === g?.assistant && is('leader'))
          return toast(
            L('Ask the parish office to change the assistant', 'اطلب من مكتب الرعية تغيير المساعد'),
            '',
            'warning'
          );
        d.roster.splice(i, 1);
        if (g && S.role !== 'leader') g.members = Math.max(0, Number(g.members || 0) - 1);
        if (pid === g?.assistant) {
          g.assistant = null;
          d.assistant = null;
          d.roles = d.roles.filter(([personId]) => personId !== pid);
        }
        if (!(await persist())) return;
        refresh();
        ok(L('Removed from the group', 'أُزيل من المجموعة'), nameOf(D.person(pid)));
      }
    }
  ]);
}

/* A ministry's lifecycle: a priest approves a draft, then it can be published and open to applications. */
const LIFECYCLE = {
  approve: ['Approve this group', 'اعتماد هذه المجموعة', 'The group becomes active. Only a priest can approve.'],
  publish: [
    'Publish on the public site',
    'نشر على الموقع العام',
    'Its name, purpose and public information become visible to visitors.'
  ],
  unpublish: ['Remove from the public site', 'إزالة من الموقع العام', 'Visitors will no longer see this group.'],
  'open-applications': [
    'Open to applications',
    'فتح باب الانتساب',
    'Needs the eligibility policy reference recorded on the group.'
  ],
  'close-applications': ['Close applications', 'إغلاق باب الانتساب', 'People can no longer apply to join.']
};
export function lifecycleStep(gid, action) {
  const [en, ar, note] = LIFECYCLE[action];
  openDrawer({
    title: L(en, ar),
    body: (
      <>
        <p className="t-caption dim">{note}</p>
        <div className="formrow">
          <label className="label" htmlFor="lc_reason">
            {L('Reason (kept in the group’s history)', 'السبب (يُحفظ في سجل المجموعة)')}
          </label>
          <textarea className="textarea" id="lc_reason" rows="3" maxLength="2000" />
        </div>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="lc_go">
          {L('Confirm', 'تأكيد')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#lc_go').addEventListener('click', async () => {
        try {
          await ministryAction(gid, action, val(el, '#lc_reason'));
        } catch (error) {
          return toast(L('Not done', 'لم يتم'), error.message, 'danger');
        }
        await hydrate();
        closeOverlays();
        refresh();
        ok(L('Done', 'تمّ'));
      });
    }
  });
}

/* A decision on a join application listed on the group's overview. */
export function joinDecision(gid, pid, action) {
  const request = D.groupInfo(gid).requests.find(r => r.p === pid);
  if (!request) return;
  const priest = !!session.parishes.find(p => p.id === session.parishId)?.roles?.includes('priest');
  const approve = action === 'approve';
  openDrawer({
    title: approve ? L('Approve this request', 'قبول هذا الطلب') : L('Decline this request', 'رفض هذا الطلب'),
    sub: D.person(pid)?.lat || '',
    body: (
      <>
        <p className="t-caption dim">
          {approve
            ? priest
              ? L(
                  'Record the eligibility and consent review you actually did. The person becomes a member.',
                  'سجّل مراجعة الأهلية والموافقة التي أجريتها فعلاً. يصبح الشخص عضواً.'
                )
              : L(
                  'Your recommendation goes to the priest, who makes the final decision.',
                  'تذهب توصيتك إلى الكاهن الذي يتخذ القرار.'
                )
            : priest
              ? L('The applicant is told the reason you give.', 'يُبلَّغ مقدّم الطلب بالسبب الذي تذكره.')
              : L(
                  'The request goes back to the applicant with what they need to add.',
                  'يعود الطلب إلى مقدّمه مع ما يحتاج إلى إضافته.'
                )}
        </p>
        {approve && priest ? (
          <C.Field
            label={L('Eligibility and consent review reference', 'مرجع مراجعة الأهلية والموافقة')}
            id="jd_ref"
            req={true}
          />
        ) : (
          <div className="formrow">
            <label className="label" htmlFor="jd_reason">
              {L('Reason', 'السبب')}
            </label>
            <textarea className="textarea" id="jd_reason" rows="3" maxLength="2000" />
          </div>
        )}
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="jd_go">
          {L('Confirm', 'تأكيد')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#jd_go').addEventListener('click', async () => {
        const reference = el.querySelector('#jd_ref')?.value || '',
          reason = el.querySelector('#jd_reason')?.value || '';
        if (approve && priest && !reference.trim())
          return toast(L('Enter the review reference', 'أدخل مرجع المراجعة'), '', 'warning');
        if (!approve && !reason.trim()) return toast(L('Give a reason', 'اذكر السبب'), '', 'warning');
        try {
          await applicationAction(gid, request, action, { reference, reason });
        } catch (error) {
          return toast(L('Not done', 'لم يتم'), error.message, 'danger');
        }
        await hydrate();
        closeOverlays();
        refresh();
        ok(L('Done', 'تمّ'));
      });
    }
  });
}
