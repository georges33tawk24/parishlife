/* What the member pages open: meeting, note and to-do drawers, profile and password, messages,
   concerns, publishing and reviews, and the search and filters that wire them once drawn. */
import { Select } from '../../ui/components.jsx';
import { nodesOr } from '../../ui/html.js';
import { t } from '../../../lib/i18n.js';
import { M } from '../../model/member-data.js';
import { session } from '../../model/api.js';
import { bus, S } from '../../model/store.js';
import { openDrawer, openModal, closeOverlays, toast, Paged } from '../../ui/ui.jsx';
import {
  area,
  blank,
  date,
  field,
  eventTitle,
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
              ['GivenName', 'Given name', 'الاسم الأول'],
              ['FamilyName', 'Family name', 'اسم العائلة'],
              ['BirthDate', 'Date of birth (YYYY-MM-DD)', 'تاريخ الميلاد (سنة-شهر-يوم)'],
              ['Contact', 'Phone or email', 'الهاتف أو البريد الإلكتروني']
            ].map(([value, en, ar], i) => (
              <option key={i} value={value}>
                {L(en, ar)}
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
        {field(L('Subject', 'الموضوع'), 'concern-subject')}
        {area(L('Description', 'الوصف'), 'concern-description')}{' '}
        {field(L('When did this happen? (optional)', 'متى حصل هذا؟ (اختياري)'), 'concern-when', '', 'datetime-local')}
        {field(L('People involved (optional)', 'الأشخاص المعنيون (اختياري)'), 'concern-people')}{' '}
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
        </fieldset>
        <p className="help">
          {L(
            'If you choose no one, every eligible independent reviewer for this category receives it.',
            'إذا لم تختر أحداً، يصل الطلب إلى كل مراجع مستقل مؤهل لهذه الفئة.'
          )}
        </p>{' '}
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
            subject: val(el, 'concern-subject'),
            description: val(el, 'concern-description'),
            happenedAt: val(el, 'concern-when'),
            peopleInvolved: val(el, 'concern-people'),
            reviewers: [...el.querySelectorAll('[data-concern-reviewer]:checked')].map(x => x.value),
            anonymous: el.querySelector('#concern-anonymous').checked
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

/* What a reviewer can do next, by the case's status (the API's rules in ConcernService). */
const NEXT = {
  Submitted: [['accept', 'Accept the case', 'قبول الحالة']],
  Reopened: [['accept', 'Accept the case', 'قبول الحالة']],
  Accepted: [
    ['start-review', 'Start review', 'بدء المراجعة'],
    ['respond', 'Provide a response', 'تقديم رد']
  ],
  NeedsInformation: [['start-review', 'Resume review', 'استئناف المراجعة']],
  UnderReview: [['respond', 'Provide a response', 'تقديم رد']],
  ResponseProvided: []
};

function reviewDrawer(x) {
  const actions = [
    ...(NEXT[x.status] || []),
    ...(x.status === 'Closed' ? [] : [['close', 'Close the case', 'إغلاق الحالة']])
  ];
  openDrawer({
    title: x.reference,
    sub: `${x.status} · ${x.category} · ${x.urgency}`,
    body: (
      <>
        <h3>{txt(x.subject)}</h3>
        <p>{txt(x.description)}</p>
        <p>
          {x.anonymous
            ? L('The submitter chose to stay anonymous.', 'اختار صاحب الطلب أن يبقى مجهول الهوية.')
            : L('The submitter is identified to reviewers.', 'صاحب الطلب معرّف للمراجعين.')}
        </p>{' '}
        {x.updates.map((y, i) => (
          <p key={i}>
            {date(y.at)} · {txt(y.status)} · {txt(y.text)}
          </p>
        ))}{' '}
        {x.status !== 'Closed' ? (
          <>
            <div className="formrow">
              <label className="label" htmlFor="review-action">
                {L('Next step', 'الخطوة التالية')}
              </label>
              <Select id="review-action">
                <option value="">{L('No change of status', 'دون تغيير الحالة')}</option>
                {actions.map(([id, en, ar], i) => (
                  <option key={i} value={id}>
                    {L(en, ar)}
                  </option>
                ))}
              </Select>
            </div>
            {area(L('Ask the submitter for information', 'طلب معلومات من صاحب الطلب'), 'review-info')}
            {area(L('Message to the submitter', 'رسالة إلى صاحب الطلب'), 'review-public')}
            {area(L('Internal note (reviewers only)', 'ملاحظة داخلية (للمراجعين فقط)'), 'review-internal')}
          </>
        ) : (
          ''
        )}
      </>
    ),
    foot:
      x.status !== 'Closed' ? (
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
          action: val(el, 'review-action'),
          infoRequest: val(el, 'review-info'),
          publicText: val(el, 'review-public'),
          internalText: val(el, 'review-internal')
        })
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

function closureDrawer() {
  openDrawer({
    title: L('Ask the parish to close my data', 'طلب إغلاق بياناتي لدى الرعية'),
    sub: L(
      'The parish office reviews the request. Records the parish must keep are not deleted.',
      'يراجع مكتب الرعية الطلب. السجلات التي يجب على الرعية الاحتفاظ بها لا تُحذف.'
    ),
    body: area(L('Anything the office should know (optional)', 'ما يجب أن يعرفه المكتب (اختياري)'), 'closure-details'),
    foot: footer(L('Send request', 'إرسال الطلب')),
    onMount(el) {
      el.querySelector('#member-save').addEventListener('click', () =>
        run('closureRequest', { details: val(el, 'closure-details') })
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
  host.querySelector('[data-member-compose]')?.addEventListener('click', messageDrawer);
  host.querySelector('[data-concern-new]')?.addEventListener('click', concernDrawer);
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
  host.querySelectorAll('[data-review-concern]').forEach(b =>
    b.addEventListener('click', () => {
      const x = M.review.find(x => x.id === b.dataset.reviewConcern);
      if (x) reviewDrawer(x);
    })
  );
  host
    .querySelectorAll('[data-correction-withdraw]')
    .forEach(b => b.addEventListener('click', () => run('profileWithdraw', { id: b.dataset.correctionWithdraw })));
  host.querySelectorAll('[data-consent-withdraw]').forEach(b =>
    b.addEventListener('click', () => {
      if (confirm(L('Withdraw this consent?', 'سحب هذه الموافقة؟')))
        run('consentWithdraw', { id: b.dataset.consentWithdraw });
    })
  );
  host.querySelector('[data-closure-request]')?.addEventListener('click', closureDrawer);
  /* A checked switch means "show it": the unchecked optional topics are the ones muted. */
  host
    .querySelector('[data-preferences-save]')
    ?.addEventListener('click', () =>
      run('preferences', {
        muted: [...host.querySelectorAll('[data-preference-topic]')]
          .filter(x => !x.checked)
          .map(x => x.dataset.preferenceTopic)
      })
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
