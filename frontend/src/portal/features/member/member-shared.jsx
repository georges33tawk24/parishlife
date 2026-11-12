/* What the member pages and drawers share: dates, status labels, cards, and the schedule built
   from meetings and notes. */
import { Select } from '../../ui/components.jsx';
import { t, isAr, fmtDate } from '../../../lib/i18n.js';
import { M, memberAction, loadMember } from '../../model/member-data.js';
import { bus, S } from '../../model/store.js';
import { openDrawer, closeOverlays, toast } from '../../ui/ui.jsx';

const L = (en, ar) => t(en, ar);

export const date = value => (value ? fmtDate(value) : '—');

/* What the server sends members, in the reader's language. An event carries titleAr. A parish notice
   arrives with its English title as the title and its Arabic title as the body: the reader's
   language comes first, the other below it. Anything else shows as its author wrote it. */
export const eventTitle = e => (isAr() ? e.titleAr || e.title : e.title);
const notice = x => x?.kind === 'announcement' && String(x.id || '').startsWith('notice-') && !!x.body;
export const itemTitle = x => (notice(x) && isAr() ? x.body : x.title);
export const itemBody = x => (notice(x) && isAr() ? x.title : x.body);

export const txt = value => String(value ?? '');

export const blank = (message, action = '') => (
  <div className="member-empty">
    <p>{txt(message)}</p>
    {action}
  </div>
);

export const groupName = id => M.groups.find(g => g.id === id)?.name || M.parish.name || '';

const dayKey = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const todayKey = () => dayKey(new Date());

export const scheduleState = key => ((S.ui.memberSchedules ||= {})[key] ||= { mode: 'month', offset: 0 });

export async function run(op, values, success = L('Saved', 'حُفظ')) {
  try {
    const result = await memberAction(op, values);
    await loadMember();
    closeOverlays();
    bus.refresh();
    if (success) toast(success, '', 'success');
    return result;
  } catch (error) {
    toast(L('Could not save', 'تعذّر الحفظ'), error.message, 'danger');
    return null;
  }
}

export const field = (label, id, value = '', type = 'text') => (
  <div className="formrow">
    <label className="label" htmlFor={id}>
      {txt(label)}
    </label>
    <input className="input" id={id} type={type} defaultValue={txt(value)} />
  </div>
);

export const area = (label, id, value = '') => (
  <div className="formrow">
    <label className="label" htmlFor={id}>
      {txt(label)}
    </label>
    <textarea className="textarea" id={id} rows="5" defaultValue={txt(value)} />
  </div>
);

export const val = (el, id) => el.querySelector('#' + id)?.value.trim() || '';

export const footer = label => (
  <>
    <button className="btn btn-secondary" data-close="">
      {L('Cancel', 'إلغاء')}
    </button>
    <button className="btn btn-primary" type="button" id="member-save">
      {txt(label)}
    </button>
  </>
);

function meetingDrawer(m) {
  openDrawer({
    title: m.title,
    sub: `${m.group} · ${date(m.date)} · ${m.time}`,
    body: (
      <>
        <p>{txt(m.description || L('No additional details yet.', 'لا تفاصيل إضافية حالياً.'))}</p>{' '}
        <dl className="member-profile">
          <dt>{L('Location', 'المكان')}</dt>
          <dd>{txt(m.location || '—')}</dd>
          <dt>{L('Organizer', 'المنظّم')}</dt>
          <dd>{txt(m.organizer || '—')}</dd>
          <dt>{L('Attendance', 'الحضور')}</dt>
          <dd>{txt(m.attendance)}</dd>
          <dt>{L('My reply', 'ردّي')}</dt>
          <dd>{txt(m.rsvp?.status || '—')}</dd>
        </dl>{' '}
        {m.resources?.length ? (
          <>
            <h3>{L('Meeting resources', 'موارد الاجتماع')}</h3>
            {m.resources.map((r, i) => (
              <p key={i}>
                {txt(r.title)}{' '}
                {r.attachment ? (
                  <a download={txt(r.attachment.name)} href={txt(r.attachment.data)}>
                    {L('Download', 'تنزيل')}
                  </a>
                ) : (
                  ''
                )}
              </p>
            ))}
          </>
        ) : (
          ''
        )}{' '}
        {m.rsvpEnabled && m.date >= todayKey() ? (
          <>
            <div className="member-actions">
              <button className="btn btn-primary" data-rsvp="yes">
                {L('I will attend', 'سأحضر')}
              </button>
              <button className="btn btn-secondary" data-rsvp="no">
                {L('Cannot attend', 'لا أستطيع الحضور')}
              </button>
            </div>
          </>
        ) : (
          ''
        )}
      </>
    ),
    foot: (
      <button className="btn btn-secondary" data-close="">
        {L('Close', 'إغلاق')}
      </button>
    ),
    onMount(el) {
      el.querySelectorAll('[data-rsvp]').forEach(b =>
        b.addEventListener('click', () => run('rsvp', { meetingId: m.id, status: b.dataset.rsvp }))
      );
    }
  });
}

export function noteDrawer(n = null) {
  openDrawer({
    title: n ? L('Edit note', 'تعديل ملاحظة') : L('New private note', 'ملاحظة خاصة جديدة'),
    sub: L('Only you can read this note.', 'يمكنك أنت فقط قراءة هذه الملاحظة.'),
    body: (
      <>
        {field(L('Title', 'العنوان'), 'note-title', n?.title || '')}
        {area(L('Note', 'الملاحظة'), 'note-body', n?.body || '')}{' '}
        <div className="formrow">
          <label className="label" htmlFor="note-category">
            {L('Category', 'الفئة')}
          </label>
          <Select defaultValue={n?.category} id="note-category">
            {['Personal', 'Meeting Notes', 'Spiritual', 'Ministry', 'Tasks', 'Ideas'].map((x, i) => (
              <option key={i}>{x}</option>
            ))}
          </Select>
        </div>{' '}
        {field(L('Tags, comma separated', 'الوسوم، مفصولة بفواصل'), 'note-tags', n?.tags?.join(', ') || '')}{' '}
      </>
    ),
    foot: footer(L('Save note', 'حفظ الملاحظة')),
    onMount(el) {
      el.querySelector('#member-save').addEventListener('click', () => {
        const title = val(el, 'note-title');
        if (!title || !val(el, 'note-body')) {
          el.querySelector(!title ? '#note-title' : '#note-body').focus();
          return;
        }
        run('note', {
          id: n?.id,
          title,
          body: val(el, 'note-body'),
          category: val(el, 'note-category'),
          tags: val(el, 'note-tags')
            .split(',')
            .map(x => x.trim())
            .filter(Boolean)
        });
      });
    }
  });
}

export function todoDrawer(item = null) {
  openDrawer({
    title: item ? L('Edit task', 'تعديل المهمة') : L('New task', 'مهمة جديدة'),
    body: (
      <>
        {field(L('Task', 'المهمة'), 'todo-title', item?.title || '')}
        {field(L('Due date (optional)', 'تاريخ الاستحقاق (اختياري)'), 'todo-due', item?.due || '', 'date')}
      </>
    ),
    foot: footer(L('Save task', 'حفظ المهمة')),
    onMount(el) {
      el.querySelector('#member-save').addEventListener('click', () => {
        const title = val(el, 'todo-title');
        if (!title) {
          el.querySelector('#todo-title').focus();
          return;
        }
        run('todo', { id: item?.id, title, due: val(el, 'todo-due') });
      });
    }
  });
}

export function memberItem(type, id) {
  if (type === 'meeting') {
    const item = M.meetings.find(x => x.id === id);
    if (item) meetingDrawer(item);
    return;
  }
  if (type === 'note') {
    const item = M.notes.find(x => x.id === id);
    if (item) noteDrawer(item);
    return;
  }
  if (type === 'todo') {
    const item = M.todos.find(x => x.id === id);
    if (item) todoDrawer(item);
    return;
  }
  const item = type === 'event' ? M.events.find(x => x.id === id) : M.formation.find(x => x.id === id);
  if (!item) return;
  openDrawer({
    title: type === 'event' ? eventTitle(item) : item.title || item.name,
    sub: type === 'event' ? `${date(item.d)} · ${txt(item.t || '')}` : groupName(item.groupId),
    body: (
      <>
        <p>{txt(item.description || '')}</p>
        {type === 'event' ? (
          <p>
            {L('Location', 'المكان')}: {txt(item.location || '—')}
          </p>
        ) : (
          <p>
            {item.completion?.date
              ? L('Completed', 'مكتمل') + ' · ' + date(item.completion.date)
              : L('Available', 'متاح')}
          </p>
        )}
      </>
    ),
    foot: (
      <button className="btn btn-secondary" data-close="">
        {L('Close', 'إغلاق')}
      </button>
    )
  });
}
