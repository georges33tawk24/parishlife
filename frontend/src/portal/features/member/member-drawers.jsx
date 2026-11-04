/* What the member pages open: meeting, note and to-do drawers, profile and password, messages,
   concerns, publishing and reviews, and the search and filters that wire them once drawn. */
import { Select } from '../../ui/components.jsx';
import { nodesOr } from '../../ui/html.js';
import { t } from '../../../lib/i18n.js';
import { M, memberAction } from '../../model/member-data.js';
import { session } from '../../model/api.js';
import { bus, S } from '../../model/store.js';
import { openDrawer, openModal, closeOverlays, toast, Paged } from '../../ui/ui.jsx';
import {
  area,
  blank,
  date,
  field,
  footer,
  groupName,
  memberItem,
  noteDrawer,
  run,
  scheduleState,
  todoDrawer,
  txt,
  val
} from './member-shared.jsx';

const L = (en, ar) => t(en, ar);

async function attachment(el) {
  const file = el.querySelector('input[type=file]')?.files?.[0];
  if (!file) return null;
  if (file.size > 1_000_000)
    throw new Error(L('Attachment must be under 1 MB.', 'يجب أن يكون المرفق أصغر من ١ ميغابايت.'));
  if (!['application/pdf', 'image/png', 'image/jpeg', 'text/plain'].includes(file.type))
    throw new Error(L('Choose a PDF, image or text file.', 'اختر ملف PDF أو صورة أو نصاً.'));
  return {
    name: file.name,
    mime: file.type,
    data: await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })
  };
}

function profileDrawer() {
  openDrawer({
    title: L('Request information update', 'طلب تحديث المعلومات'),
    sub: L(
      'The parish office will review changes to your official record.',
      'يراجع مكتب الرعية التغييرات على سجلك الرسمي.'
    ),
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="profile-field">
            {L('Information to update', 'المعلومة المطلوب تحديثها')}
          </label>
          <Select id="profile-field">
            {[
              'name',
              'phone',
              'email',
              'address',
              'emergency contact',
              'date of birth',
              'ministry memberships',
              'profile picture'
            ].map((x, i) => (
              <option key={i} value={x}>
                {x}
              </option>
            ))}
          </Select>
        </div>
        {area(L('Requested information', 'المعلومة المطلوبة'), 'profile-value')}
      </>
    ),
    foot: footer(L('Send request', 'إرسال الطلب')),
    onMount(el) {
      el.querySelector('#member-save').addEventListener('click', () => {
        if (!val(el, 'profile-value')) {
          el.querySelector('#profile-value').focus();
          return;
        }
        run('profileRequest', { field: val(el, 'profile-field'), value: val(el, 'profile-value') });
      });
    }
  });
}

/* A new password, after the current one; the parish office resets a forgotten one. */
function passwordModal() {
  const field = (id, label, autocomplete, help = '') => (
    <div className="formrow">
      <label className="label" htmlFor={id}>
        {label}
      </label>{' '}
      <input
        className="input"
        id={id}
        type="password"
        autoComplete={autocomplete}
        maxLength="200"
        aria-describedby={`${help ? `${id}-help ` : ''}${id}-error`}
      />{' '}
      {help ? (
        <span className="help" id={`${id}-help`}>
          {help}
        </span>
      ) : (
        ''
      )}
      <span className="help help-error" id={`${id}-error`} hidden />
    </div>
  );
  openModal({
    title: L('Change my password', 'تغيير كلمة المرور'),
    body: (
      <>
        {field('pw-current', L('Current password', 'كلمة المرور الحالية'), 'current-password')}{' '}
        {field(
          'pw-new',
          L('New password', 'كلمة المرور الجديدة'),
          'new-password',
          L(
            'At least 8 characters. Write it down and keep it somewhere safe.',
            '٨ أحرف على الأقل. دوّنها واحفظها في مكان آمن.'
          )
        )}{' '}
        <label className="member-toggle pw-show">
          <span>{L('Show the passwords', 'إظهار كلمات المرور')}</span>
          <input type="checkbox" id="pw-show" />
        </label>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="pw-save">
          {L('Change password', 'تغيير كلمة المرور')}
        </button>
      </>
    ),
    onMount(el) {
      const say = (id, message) => {
        const e = el.querySelector(`#${id}-error`),
          f = el.querySelector('#' + id);
        e.textContent = message;
        e.hidden = !message;
        message ? f.setAttribute('aria-invalid', 'true') : f.removeAttribute('aria-invalid');
      };
      el.querySelector('#pw-show').addEventListener('change', e =>
        el.querySelectorAll('#pw-current,#pw-new').forEach(f => {
          f.type = e.target.checked ? 'text' : 'password';
        })
      );
      const save = el.querySelector('#pw-save');
      save.addEventListener('click', async () => {
        const current = el.querySelector('#pw-current').value,
          password = el.querySelector('#pw-new').value;
        say('pw-current', current ? '' : L('Enter your current password.', 'أدخل كلمة المرور الحالية.'));
        say(
          'pw-new',
          password.length >= 8
            ? ''
            : L('Choose a password of at least 8 characters.', 'اختر كلمة مرور من ٨ أحرف على الأقل.')
        );
        if (!current || password.length < 8) return el.querySelector('[aria-invalid=true]').focus();
        save.disabled = true;
        save.setAttribute('aria-busy', 'true');
        try {
          await memberAction('changePassword', { current, password });
          closeOverlays();
          toast(
            L('Password changed', 'تغيّرت كلمة المرور'),
            L(
              'Use your new password next time you sign in.',
              'استخدم كلمة المرور الجديدة عند تسجيل الدخول في المرّة المقبلة.'
            ),
            'success'
          );
        } catch (error) {
          save.disabled = false;
          save.removeAttribute('aria-busy');
          if (/current password/.test(error.message)) {
            say('pw-current', L('Your current password is not correct.', 'كلمة المرور الحالية غير صحيحة.'));
            el.querySelector('#pw-current').select();
          } else toast(L('The password was not changed', 'لم تتغيّر كلمة المرور'), error.message, 'danger');
        }
      });
    }
  });
}

function messageDrawer() {
  openDrawer({
    title: L('Message my ministry', 'مراسلة خدمتي'),
    sub: L(
      'Your message goes to the ministry leader if they have a linked account.',
      'تصل رسالتك إلى مسؤول الخدمة إذا كان له حساب مرتبط.'
    ),
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="message-group">
            {L('Ministry', 'الخدمة')}
          </label>
          <Select id="message-group">
            {M.groups.map((g, i) => (
              <option key={i} value={txt(g.id)}>
                {txt(g.name)}
              </option>
            ))}
          </Select>
        </div>
        {area(L('Message', 'الرسالة'), 'message-body')}
      </>
    ),
    foot: footer(L('Send message', 'إرسال الرسالة')),
    onMount(el) {
      el.querySelector('#member-save').addEventListener('click', () => {
        if (!val(el, 'message-body')) {
          el.querySelector('#message-body').focus();
          return;
        }
        run('message', { groupId: val(el, 'message-group'), body: val(el, 'message-body') });
      });
    }
  });
}

function concernDrawer() {
  openDrawer({
    title: L('Submit a Concern', 'تقديم ملاحظة أو قلق'),
    sub: L(
      'Your concern is visible only to explicitly authorized reviewers.',
      'تُعرض ملاحظتك فقط على المراجعين المخوّلين صراحةً.'
    ),
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="concern-category">
            {L('Category', 'الفئة')}
          </label>
          <Select id="concern-category">
            {M.categories
              .filter(x => x.active)
              .map((x, i) => (
                <option key={i}>{txt(x.name)}</option>
              ))}
          </Select>
        </div>{' '}
        <div className="formrow">
          <label className="label" htmlFor="concern-group">
            {L('Related ministry (optional)', 'الخدمة المرتبطة (اختياري)')}
          </label>
          <Select id="concern-group">
            <option value="">—</option>
            {M.groups.map((g, i) => (
              <option key={i} value={txt(g.id)}>
                {txt(g.name)}
              </option>
            ))}
          </Select>
        </div>{' '}
        <div className="formrow">
          <label className="label" htmlFor="concern-event">
            {L('Related event or meeting (optional)', 'المناسبة أو الاجتماع المرتبط (اختياري)')}
          </label>
          <Select id="concern-event">
            <option value="">—</option>
            {[...M.events, ...M.meetings].map((x, i) => (
              <option key={i} value={txt(x.id)}>
                {txt(x.title)}
              </option>
            ))}
          </Select>
        </div>{' '}
        {field(L('Subject', 'الموضوع'), 'concern-subject')}
        {area(L('Description', 'الوصف'), 'concern-description')}{' '}
        {field(L('When did this happen? (optional)', 'متى حصل هذا؟ (اختياري)'), 'concern-when', '', 'datetime-local')}
        {field(L('People involved (optional)', 'الأشخاص المعنيون (اختياري)'), 'concern-people')}{' '}
        <div className="formrow">
          <label className="label" htmlFor="concern-attachment">
            {L('Attachment (optional, max 1 MB)', 'مرفق (اختياري، بحد أقصى ١ ميغابايت)')}
          </label>
          <input className="input" id="concern-attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" />
        </div>{' '}
        <fieldset>
          <legend>{L('Choose who may review this concern', 'اختر من يمكنه مراجعة هذه الشكوى')}</legend>
          {M.reviewers
            .filter(r => r.id !== session.user.id)
            .map((r, i) => (
              <label key={i} className="member-toggle">
                <span>{txt(r.name)}</span>
                <input type="checkbox" data-concern-reviewer="" defaultValue={txt(r.id)} />
              </label>
            ))}
        </fieldset>{' '}
        <label className="member-toggle">
          <span>{L('Submit anonymously', 'إرسال دون إظهار الهوية')}</span>
          <input type="checkbox" id="concern-anonymous" />
        </label>{' '}
        <p className="help">
          {L(
            'Reviewers will not see your account identity. You can follow the status here after submitting.',
            'لن يرى المراجعون هوية حسابك. يمكنك متابعة الحالة هنا بعد الإرسال.'
          )}
        </p>{' '}
        <div className="formrow">
          <label className="label" htmlFor="concern-follow">
            {L('Preferred follow-up (identified submissions)', 'طريقة المتابعة للطلبات المعرّفة')}
          </label>
          <Select id="concern-follow">
            <option value="system">{L('In-system message', 'رسالة في النظام')}</option>
            <option value="email">{L('Email', 'البريد الإلكتروني')}</option>
            <option value="phone">{L('Phone', 'الهاتف')}</option>
            <option value="none">{L('No response required', 'لا حاجة للرد')}</option>
          </Select>
        </div>
      </>
    ),
    foot: footer(L('Submit concern', 'إرسال الملاحظة')),
    onMount(el) {
      el.querySelector('#member-save').addEventListener('click', async () => {
        if (!val(el, 'concern-subject') || !val(el, 'concern-description')) {
          el.querySelector(!val(el, 'concern-subject') ? '#concern-subject' : '#concern-description').focus();
          return;
        }
        try {
          const values = {
            category: val(el, 'concern-category'),
            groupId: val(el, 'concern-group') || null,
            eventId: val(el, 'concern-event') || null,
            subject: val(el, 'concern-subject'),
            description: val(el, 'concern-description'),
            happenedAt: val(el, 'concern-when'),
            peopleInvolved: val(el, 'concern-people'),
            reviewers: [...el.querySelectorAll('[data-concern-reviewer]:checked')].map(x => x.value),
            anonymous: el.querySelector('#concern-anonymous').checked,
            followUp: val(el, 'concern-follow'),
            attachment: await attachment(el)
          };
          const result = await run('concern', values, '');
          if (result?.id)
            openDrawer({
              title: L('Concern received', 'تم استلام الملاحظة'),
              body: (
                <p>
                  {L(
                    'You can follow its status any time on this page.',
                    'يمكنك متابعة حالتها في هذه الصفحة في أي وقت.'
                  )}
                </p>
              ),
              foot: (
                <button className="btn btn-primary" data-close="">
                  {L('Done', 'تم')}
                </button>
              )
            });
        } catch (error) {
          toast(L('Could not submit', 'تعذّر الإرسال'), error.message, 'danger');
        }
      });
    }
  });
}

function publishDrawer() {
  openDrawer({
    title: L('Publish to members', 'النشر للأعضاء'),
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="publish-kind">
            {L('Type', 'النوع')}
          </label>
          <Select id="publish-kind">
            {[
              ['post', 'Post'],
              ['announcement', 'Announcement'],
              ['resource', 'Resource'],
              ['opportunity', 'Volunteer opportunity'],
              ['discussion', 'Group conversation']
            ].map(([id, name], i) => (
              <option key={i} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </div>{' '}
        <div className="formrow">
          <label className="label" htmlFor="publish-group">
            {L('Audience', 'الجمهور')}
          </label>
          <Select id="publish-group">
            {session.user?.role === 'priest' || session.user?.role === 'secretary' ? (
              <option value="">{L('Parish', 'الرعية')}</option>
            ) : (
              ''
            )}
            {M.groups
              .filter(g => M.managedGroups.includes(g.id))
              .map((g, i) => (
                <option key={i} value={txt(g.id)}>
                  {txt(g.name)}
                </option>
              ))}
          </Select>
        </div>{' '}
        <div className="formrow">
          <label className="label" htmlFor="publish-meeting">
            {L('Linked meeting (optional)', 'اجتماع مرتبط (اختياري)')}
          </label>
          <Select id="publish-meeting">
            <option value="">—</option>
            {M.meetings.map((m, i) => (
              <option key={i} value={txt(m.id)} data-group={txt(m.groupId)}>
                {txt(m.title)} · {date(m.date)}
              </option>
            ))}
          </Select>
        </div>{' '}
        {field(L('Title', 'العنوان'), 'publish-title')}
        {area(L('Content', 'المحتوى'), 'publish-body')}
        {field(L('Category or tags', 'الفئة أو الوسوم'), 'publish-category')}{' '}
        <div className="formrow">
          <label className="label" htmlFor="publish-attachment">
            {L('Attachment (optional, max 1 MB)', 'مرفق اختياري بحد ١ ميغابايت')}
          </label>
          <input className="input" id="publish-attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" />
        </div>
        <label className="member-toggle">
          <span>{L('Pin post', 'تثبيت المنشور')}</span>
          <input type="checkbox" id="publish-pinned" />
        </label>
      </>
    ),
    foot: footer(L('Publish', 'نشر')),
    onMount(el) {
      const group = el.querySelector('#publish-group'),
        meeting = el.querySelector('#publish-meeting');
      const sync = () => {
        meeting.value = '';
        meeting.querySelectorAll('option[data-group]').forEach(option => {
          option.hidden = option.dataset.group !== group.value;
        });
      };
      group.addEventListener('change', sync);
      sync();
      el.querySelector('#member-save').addEventListener('click', async () => {
        try {
          await run('publish', {
            kind: val(el, 'publish-kind'),
            groupId: val(el, 'publish-group') || null,
            title: val(el, 'publish-title'),
            body: val(el, 'publish-body'),
            category: val(el, 'publish-category'),
            eventId: val(el, 'publish-meeting') || null,
            pinned: el.querySelector('#publish-pinned').checked,
            attachment: await attachment(el)
          });
        } catch (error) {
          toast(L('Could not publish', 'تعذّر النشر'), error.message, 'danger');
        }
      });
    }
  });
}

function reviewDrawer(x) {
  const canResolve = M.complaintPermissions.includes('Resolve');
  const canRespond =
    (M.complaintPermissions.includes('Respond') || canResolve) &&
    (canResolve || !['Resolved', 'Closed'].includes(x.status));
  const statuses = [
    'Submitted',
    'Under Review',
    'Additional Information Requested',
    'Referred',
    ...(canResolve ? ['Resolved', 'Closed'] : [])
  ];
  openDrawer({
    title: x.reference,
    sub: `${x.status} · ${x.category}`,
    body: (
      <>
        <h3>{txt(x.subject)}</h3>
        <p>{txt(x.description)}</p>
        <p>
          {L('People involved', 'الأشخاص المعنيون')}: {txt(x.people_involved || '—')}
        </p>
        {x.identity ? (
          <p>
            {L('Identity', 'الهوية')}: {txt(x.identity.name)} · {txt(x.identity.phone)}
          </p>
        ) : (
          ''
        )}
        {x.attachment ? (
          <a className="btn btn-secondary" download={txt(x.attachment.name)} href={txt(x.attachment.data)}>
            {L('Download evidence', 'تنزيل المرفق')}
          </a>
        ) : (
          ''
        )}{' '}
        {x.updates.map((y, i) => (
          <p key={i}>
            {date(y.at)} · {txt(y.status)} · {txt(y.text)}
            {y.internal ? (
              <>
                <br />
                <small>
                  {L('Internal note', 'ملاحظة داخلية')}: {txt(y.internal)}
                </small>
              </>
            ) : (
              ''
            )}
          </p>
        ))}{' '}
        {M.complaintPermissions.includes('Assign') ? (
          <div className="formrow">
            <label className="label" htmlFor="review-assignee">
              {L('Assign to independent reviewer', 'تعيين مراجع مستقل')}
            </label>
            <Select defaultValue={x.assignedTo} id="review-assignee">
              <option value="">{L('Choose reviewer', 'اختر مراجعاً')}</option>
              {M.reviewers.map((r, i) => (
                <option key={i} value={txt(r.id)}>
                  {txt(r.name)}
                </option>
              ))}
            </Select>
            <button className="btn btn-secondary btn-dense" id="assign-reviewer">
              {L('Assign', 'تعيين')}
            </button>
          </div>
        ) : (
          ''
        )}{' '}
        {canRespond ? (
          <>
            <div className="formrow">
              <label className="label" htmlFor="review-status">
                {L('Public status', 'الحالة العامة')}
              </label>
              <Select defaultValue={x.status} id="review-status">
                {statuses.map((s, i) => (
                  <option key={i}>{s}</option>
                ))}
              </Select>
            </div>
            {area(L('Public response', 'الرد العام'), 'review-public')}
            {area(L('Internal note', 'ملاحظة داخلية'), 'review-internal')}
          </>
        ) : (
          ''
        )}
      </>
    ),
    foot: canRespond ? (
      footer(L('Save update', 'حفظ التحديث'))
    ) : (
      <button className="btn btn-secondary" data-close="">
        {L('Close', 'إغلاق')}
      </button>
    ),
    onMount(el) {
      el.querySelector('#member-save')?.addEventListener('click', () =>
        run('concernUpdate', {
          id: x.id,
          status: val(el, 'review-status'),
          publicText: val(el, 'review-public'),
          internalText: val(el, 'review-internal')
        })
      );
      el.querySelector('#assign-reviewer')?.addEventListener('click', () =>
        run('concernAssign', { id: x.id, reviewerId: val(el, 'review-assignee') })
      );
    }
  });
}

function discussionDrawer(x) {
  openDrawer({
    title: x.title,
    sub: groupName(x.groupId),
    body: (
      <>
        <p>{txt(x.body)}</p>{' '}
        <Paged className="member-list">
          {nodesOr(
            x.replies.map((r, i) => (
              <div key={i} className="member-card">
                <b>{txt(r.author)}</b>
                <small>· {date(r.at)}</small>
                <p>{txt(r.body)}</p>
              </div>
            )),
            blank(L('No replies yet.', 'لا ردود بعد.'))
          )}
        </Paged>
        {area(L('Your reply', 'ردّك'), 'discussion-body')}
      </>
    ),
    foot: footer(L('Reply', 'رد')),
    onMount(el) {
      el.querySelector('#member-save').addEventListener('click', () =>
        run('discussionReply', { id: x.id, body: val(el, 'discussion-body') })
      );
    }
  });
}

export function mount(host) {
  host
    .querySelectorAll('[data-member-item]')
    .forEach(b => b.addEventListener('click', () => memberItem(b.dataset.memberItem, b.dataset.itemId)));
  host
    .querySelectorAll('[data-meeting]')
    .forEach(b => b.addEventListener('click', () => memberItem('meeting', b.dataset.meeting)));
  host
    .querySelectorAll('[data-note-edit]')
    .forEach(b => b.addEventListener('click', () => noteDrawer(M.notes.find(x => x.id === b.dataset.noteEdit))));
  host.querySelector('[data-note-new]')?.addEventListener('click', () => noteDrawer());
  host.querySelectorAll('[data-note-delete]').forEach(b =>
    b.addEventListener('click', () => {
      if (confirm(L('Delete this private note?', 'حذف هذه الملاحظة الخاصة؟')))
        run('note', { id: b.dataset.noteDelete, delete: true });
    })
  );
  host.querySelector('[data-todo-new]')?.addEventListener('click', () => todoDrawer());
  host
    .querySelectorAll('[data-todo-edit]')
    .forEach(b => b.addEventListener('click', () => todoDrawer(M.todos.find(x => x.id === b.dataset.todoEdit))));
  host.querySelectorAll('[data-todo-delete]').forEach(b =>
    b.addEventListener('click', () => {
      if (confirm(L('Delete this task?', 'حذف هذه المهمة؟'))) run('todo', { id: b.dataset.todoDelete, delete: true });
    })
  );
  host
    .querySelectorAll('[data-todo-toggle]')
    .forEach(b => b.addEventListener('change', () => run('todo', { id: b.dataset.todoToggle, done: b.checked }, '')));
  host.querySelector('[data-profile-request]')?.addEventListener('click', profileDrawer);
  host.querySelector('[data-password-change]')?.addEventListener('click', passwordModal);
  host.querySelector('[data-member-compose]')?.addEventListener('click', messageDrawer);
  host.querySelector('[data-concern-new]')?.addEventListener('click', concernDrawer);
  host.querySelector('[data-publish]')?.addEventListener('click', publishDrawer);
  host.querySelectorAll('[data-preference]').forEach(b =>
    b.addEventListener('change', () => {
      const next = b.checked,
        label = b.closest('label')?.querySelector('span')?.textContent || '';
      b.checked = !next;
      openModal({
        title: L('Confirm preference change', 'تأكيد تغيير التفضيل'),
        body: (
          <p>
            {next ? L('Turn on', 'تفعيل') : L('Turn off', 'إيقاف')} <b>{txt(label)}</b>?
          </p>
        ),
        foot: (
          <>
            <button className="btn btn-secondary" data-close="">
              {L('Cancel', 'إلغاء')}
            </button>
            <button className="btn btn-primary" data-confirm-preference="">
              {L('Confirm', 'تأكيد')}
            </button>
          </>
        ),
        onMount(el) {
          el.querySelector('[data-confirm-preference]').addEventListener('click', () =>
            run('preference', { key: b.dataset.preference, value: next }, '')
          );
        }
      });
    })
  );
  host
    .querySelectorAll('[data-member-read]')
    .forEach(b => b.addEventListener('click', () => run('read', { id: b.dataset.memberRead }, '')));
  host
    .querySelectorAll('[data-member-archive]')
    .forEach(b => b.addEventListener('click', () => run(b.dataset.archiveOp, { id: b.dataset.memberArchive }, '')));
  host.querySelector('[data-member-read-all]')?.addEventListener('click', () => run('readAll', {}, ''));
  host
    .querySelector('[data-notification-read-all]')
    ?.addEventListener('click', () => run('notificationReadAll', {}, ''));
  host
    .querySelectorAll('[data-notification-read]')
    .forEach(b => b.addEventListener('click', () => run('notificationRead', { id: b.dataset.notificationRead }, '')));
  host
    .querySelectorAll('[data-volunteer]')
    .forEach(b =>
      b.addEventListener('click', () => run('volunteer', { id: b.dataset.volunteer, status: b.dataset.status }))
    );
  host
    .querySelectorAll('[data-confirm-volunteer]')
    .forEach(b =>
      b.addEventListener('click', () =>
        run('confirmVolunteer', { id: b.dataset.confirmVolunteer, userId: b.dataset.user, status: 'confirmed' })
      )
    );
  host
    .querySelectorAll('[data-profile-review]')
    .forEach(b =>
      b.addEventListener('click', () => run('profileReview', { id: b.dataset.profileReview, status: 'Reviewed' }))
    );
  host.querySelectorAll('[data-review-concern]').forEach(b =>
    b.addEventListener('click', () => {
      const x = M.review.find(x => x.id === b.dataset.reviewConcern);
      if (x) reviewDrawer(x);
    })
  );
  host.querySelector('[data-category-add]')?.addEventListener('click', () =>
    openDrawer({
      title: L('Add concern category', 'إضافة فئة للملاحظات'),
      body: field(L('Category name', 'اسم الفئة'), 'category-name'),
      foot: footer(L('Add category', 'إضافة فئة')),
      onMount(el) {
        el.querySelector('#member-save').addEventListener('click', () =>
          run('categoryManage', { name: val(el, 'category-name'), active: true })
        );
      }
    })
  );
  host
    .querySelectorAll('[data-category-toggle]')
    .forEach(b =>
      b.addEventListener('click', () =>
        run('categoryManage', { name: b.dataset.categoryToggle, active: b.dataset.active === 'true' })
      )
    );
  host.querySelectorAll('[data-reply-message]').forEach(b =>
    b.addEventListener('click', () => {
      const x = M.content.find(x => x.id === b.dataset.replyMessage);
      if (!x) return;
      openDrawer({
        title: L('Reply to member', 'الرد على العضو'),
        body: (
          <>
            <p>{txt(x.body)}</p>
            {area(L('Reply', 'الرد'), 'reply-body')}
          </>
        ),
        foot: footer(L('Send reply', 'إرسال الرد')),
        onMount(el) {
          el.querySelector('#member-save').addEventListener('click', () =>
            run('messageReply', { id: x.id, body: val(el, 'reply-body') })
          );
        }
      });
    })
  );
  host.querySelectorAll('[data-discussion]').forEach(b =>
    b.addEventListener('click', () => {
      const x = M.content.find(x => x.id === b.dataset.discussion);
      if (x) discussionDrawer(x);
    })
  );
  host.querySelectorAll('[data-concern-follow]').forEach(b =>
    b.addEventListener('click', () => {
      const x = M.concerns.find(item => item.id === b.dataset.concernFollow);
      if (!x) return;
      openDrawer({
        title: x.subject,
        sub: x.status,
        body: area(L('Provide additional information', 'إضافة معلومات'), 'concern-follow-message'),
        foot: footer(L('Send update', 'إرسال التحديث')),
        onMount(el) {
          el.querySelector('#member-save').addEventListener('click', () => {
            const message = val(el, 'concern-follow-message');
            if (message) run('concernFollowUp', { id: x.id, message });
          });
        }
      });
    })
  );
  host.querySelectorAll('[data-message-filter]').forEach(b =>
    b.addEventListener('click', () => {
      S.ui.memberMessageFilter = b.dataset.messageFilter;
      bus.refresh();
    })
  );
  host.querySelectorAll('[data-schedule-mode]').forEach(b =>
    b.addEventListener('click', () => {
      const state = scheduleState(b.dataset.scheduleKey);
      state.mode = b.dataset.scheduleMode;
      state.offset = 0;
      bus.refresh();
    })
  );
  host.querySelectorAll('[data-notes-view]').forEach(b =>
    b.addEventListener('click', () => {
      S.ui.memberNotesView = b.dataset.notesView;
      if (b.dataset.notesView === 'calendar') scheduleState('notes').mode = 'month';
      bus.refresh();
    })
  );
  host.querySelectorAll('[data-schedule-offset]').forEach(b =>
    b.addEventListener('click', () => {
      scheduleState(b.dataset.scheduleKey).offset += Number(b.dataset.scheduleOffset);
      bus.refresh();
    })
  );
  host.querySelectorAll('[data-schedule-today]').forEach(b =>
    b.addEventListener('click', () => {
      scheduleState(b.dataset.scheduleKey).offset = 0;
      bus.refresh();
    })
  );
  const filter = () => {
    const filters = Object.fromEntries(
      [...host.querySelectorAll('[data-filter]')].map(x => [x.dataset.filter, x.value])
    );
    const query = (host.querySelector('[data-member-search], [data-note-search]')?.value || '').toLowerCase();
    host.querySelectorAll('.member-filter-row, .member-search-row').forEach(row => {
      row.hidden = !!(
        (filters.group && row.dataset.group !== filters.group) ||
        (filters.status && row.dataset.status !== filters.status) ||
        (filters.category && row.dataset.category !== filters.category) ||
        (filters.source && row.dataset.source !== filters.source) ||
        (filters.from && row.dataset.date < filters.from) ||
        (filters.to && row.dataset.date > filters.to) ||
        (query && !row.dataset.search?.toLowerCase().includes(query))
      );
    });
  };
  const savedFilters = ((S.ui.memberFilters ||= {})[S.route] ||= {});
  host.querySelectorAll('[data-filter]').forEach(x => {
    x.value = savedFilters[x.dataset.filter] || '';
    x.addEventListener('change', () => {
      savedFilters[x.dataset.filter] = x.value;
      if (host.querySelector('[data-shared-schedule]')) bus.refresh();
      else filter();
    });
  });
  host.querySelectorAll('[data-member-search], [data-note-search]').forEach(x => x.addEventListener('input', filter));
  filter();
}
