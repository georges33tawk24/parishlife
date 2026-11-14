/* The member's own pages: home, ministries, meetings, attendance, calendar, announcements,
   resources, formation, commitments, notes, profile, concerns and notifications. */
import { Fragment } from 'react';
import { Select } from '../../ui/components.jsx';
import { nodesOr } from '../../ui/html.js';
import { CalendarView } from '../../ui/collection.jsx';
import { t, isAr } from '../../../lib/i18n.js';
import { M } from '../../model/member-data.js';
import { session } from '../../model/api.js';
import { S } from '../../model/store.js';
import { Paged } from '../../ui/ui.jsx';
import { safeRichText } from '../../../lib/rich-text.js';
import { homeCard } from './requests.jsx';
import { noticeText, phoneShow } from '../../model/sacrament-requests.js';
import {
  blank,
  date,
  eventTitle,
  groupName,
  itemBody,
  itemTitle,
  memberItem,
  scheduleState,
  todayKey,
  txt
} from './member-shared.jsx';
import { mount } from './member-drawers.jsx';

const L = (en, ar) => t(en, ar);

const title = (name, sub = '') => (
  <header className="member-head">
    <h1>{txt(name)}</h1>
    {sub ? <p>{txt(sub)}</p> : ''}
  </header>
);

const card = (body, cls = '', props = {}) => (
  <section className={`member-card ${cls}`} {...props}>
    {body}
  </section>
);

const link = (route, label) => (
  <a className="btn btn-secondary btn-dense" href={`#/${route}`}>
    {txt(label)}
  </a>
);

const sorted = rows =>
  [...rows].sort((a, b) => (a.date || a.d || a.at || '').localeCompare(b.date || b.d || b.at || ''));

const upcoming = () => M.meetings.filter(m => m.date >= todayKey());

const attendance = () => {
  const past = M.meetings.filter(m => m.date < todayKey() && !['upcoming', 'unrecorded'].includes(m.attendance));
  const attended = past.filter(m => ['present', 'attended', 'late'].includes(m.attendance)).length;
  const counted = past.filter(m => m.attendance !== 'excused');
  return { past, attended, percent: counted.length ? Math.round((attended / counted.length) * 100) : null };
};

const status = value => <span className="member-badge">{txt(value)}</span>;

/* Names for the optional notification topics the API reports (GET me/notification-topics). */
const TOPIC_LABELS = {
  'parish.broadcast': ['Parish broadcasts', 'رسائل الرعية العامة'],
  reports: ['Scheduled reports', 'التقارير المجدولة']
};
const topicLabel = topic => (TOPIC_LABELS[topic] ? L(...TOPIC_LABELS[topic]) : topic);

const contentRows = (kind, filter = () => true) => M.content.filter(x => x.kind === kind && filter(x));

const scheduleItems = new Map();

const schedule = (key, items, emptyMessage) => {
  const filters = S.ui.memberFilters?.[S.route] || {};
  const rows = items.filter(
    x => x.date && (!filters.group || x.groupId === filters.group) && (!filters.source || x.source === filters.source)
  );
  scheduleItems.set(key, rows);
  const open = id => {
    const row = scheduleItems.get(key)?.find(x => x.type + ':' + x.id === id);
    if (row) memberItem(row.type, row.id);
  };
  return (
    <div data-shared-schedule={key}>
      <CalendarView
        events={rows.map(x => ({ ...x, id: x.type + ':' + x.id }))}
        state={scheduleState(key)}
        onOpen={open}
      />
    </div>
  );
};

export function home() {
  const next = upcoming()[0],
    stats = attendance();
  const unread = M.home.unreadNotifications;
  const commitments = Object.values(M.commitments).filter(x => ['confirmed', 'volunteer'].includes(x.status)).length;
  const nextBody = next ? (
    <>
      <strong>{txt(next.title)}</strong>
      <p>
        {txt(next.group)} · {date(next.date)} · {txt(next.time)} · {txt(next.location || 'Location to be confirmed')}
      </p>
      {link('mymeetings', L('View meeting', 'عرض الاجتماع'))}
    </>
  ) : (
    blank(
      L('No upcoming ministry meetings yet.', 'لا اجتماعات خدمة مقبلة حالياً.'),
      link('mycalendar', L('View calendar', 'عرض الرزنامة'))
    )
  );
  return (
    <div className="member-page">
      {title(
        L('Welcome,', 'أهلاً،') + ' ' + (M.person.lat || '').split(' ')[0],
        L('Here is what is happening in your parish life.', 'إليك ما يجري في حياتك الرعوية.')
      )}{' '}
      {homeCard()}{' '}
      {M.site?.welcome
        ? card(
            <>
              <p className="member-site-welcome">{txt(t(M.site.welcome.en, M.site.welcome.ar))}</p>
              <a
                className="btn btn-secondary btn-dense"
                href={`public.html?parish=${encodeURIComponent(M.parish.id || '')}`}
                target="_blank"
                rel="noopener"
              >
                {L('Visit parish page', 'زيارة صفحة الرعية')}
              </a>
            </>
          )
        : ''}{' '}
      <Paged className="member-grid member-home-highlights">
        {card(
          <>
            <h2>{L('My attendance', 'حضوري')}</h2>
            <strong>{stats.percent === null ? '—' : stats.percent + '%'}</strong>
            <p>
              {stats.attended} {L('attended', 'حضور')} · {stats.past.filter(x => x.attendance === 'excused').length}{' '}
              {L('excused', 'غياب معذور')}
            </p>
            {link('myattendance', L('View history', 'عرض السجل'))}
          </>
        )}{' '}
        {card(
          <>
            <h2>{L('Messages & commitments', 'الرسائل والالتزامات')}</h2>
            <p>
              {unread} {L('unread notifications', 'إشعارات غير مقروءة')} · {commitments}{' '}
              {L('active commitments', 'التزامات حالية')}
            </p>
            {link('membernotifications', L('Notifications', 'الإشعارات'))}{' '}
            {link('mycommitments', L('Commitments', 'الالتزامات'))}
          </>
        )}{' '}
        {card(
          <>
            <h2>{L('My ministries', 'خدماتي')}</h2>
            {M.groups.length
              ? M.groups.map((g, i) => (
                  <div key={i} className="member-simple-row">
                    <b>{txt(g.name)}</b>
                    {status(g.position || L('Member', 'عضو'))}
                  </div>
                ))
              : blank(L('You are not currently in a ministry.', 'لست منضمّاً إلى خدمة حالياً.'))}
            {link('myministries', L('View ministries', 'عرض الخدمات'))}
          </>
        )}
      </Paged>
      <Paged className="member-grid member-home-main">
        {card(
          <>
            <h2>{L('Next meeting', 'الاجتماع المقبل')}</h2>
            {nextBody}
          </>
        )}{' '}
        {card(
          <>
            <h2>{L('Upcoming', 'القادم')}</h2>
            {nodesOr(
              sorted([...upcoming(), ...M.events.filter(e => e.d >= todayKey())])
                .slice(0, 4)
                .map((e, i) => (
                  <div key={i} className="member-simple-row">
                    <span>{txt(eventTitle(e))}</span>
                    <small>{date(e.date || e.d)}</small>
                  </div>
                )),
              blank(L('Nothing on your calendar yet.', 'لا مواعيد في رزنامتك حالياً.'))
            )}
            {link('mycalendar', L('Open calendar', 'فتح الرزنامة'))}
          </>
        )}{' '}
        {card(
          <>
            <h2>{L('Announcements', 'الإعلانات')}</h2>
            {nodesOr(
              M.content
                .filter(x => ['announcement', 'post'].includes(x.kind))
                .slice(0, 2)
                .map((x, i) => (
                  <p key={i}>
                    <b>{txt(itemTitle(x))}</b>
                    <br />
                    <small>{txt(groupName(x.groupId))}</small>
                  </p>
                )),
              blank(L('No new announcements.', 'لا إعلانات جديدة.'))
            )}
            {link('myfeed', L('Read updates', 'قراءة المستجدات'))}
          </>
        )}
      </Paged>
      {card(
        <>
          <h2>{L('My parishes', 'رعاياي')}</h2>
          {nodesOr(
            M.home.parishes.map((p, i) => (
              <div key={i} className="member-simple-row">
                <span>
                  <b>{txt(p.name)}</b>
                  {p.locality ? <small> · {txt(p.locality)}</small> : ''}
                </span>
                <span>
                  {p.primary ? status(L('Primary', 'الأساسية')) : ''}{' '}
                  {status(
                    p.member
                      ? L('Member', 'عضو')
                      : p.membershipPending
                        ? L('Membership requested', 'طلب العضوية قيد المراجعة')
                        : L('Following', 'متابَعة')
                  )}{' '}
                  {p.unreadNotifications ? status(`${p.unreadNotifications} ${L('new', 'جديد')}`) : ''}
                </span>
              </div>
            )),
            blank(L('You are not following a parish yet.', 'لا تتابع رعية بعد.'))
          )}
          {link('activity', L('Manage my parishes', 'إدارة رعاياي'))}
        </>
      )}{' '}
      <div className="member-actions">
        {link('myrequests', L('My requests', 'طلباتي'))}
        {link('mynotes', L('My Notes', 'ملاحظاتي'))}
        {link('myresources', L('Resources', 'الموارد'))}
        {link('membernotifications', L('Notifications', 'الإشعارات'))}
        {link('myconcerns', L('Submit a Concern', 'تقديم ملاحظة أو قلق'))}
        {link('myprofile', L('Update my information', 'تحديث معلوماتي'))}
      </div>
    </div>
  );
}

export function ministries() {
  return (
    <div className="member-page">
      {title(
        L('My ministries', 'خدماتي'),
        L('Your membership is separate from a leadership position.', 'عضويتك منفصلة عن أي منصب قيادي.')
      )}{' '}
      <Paged className="member-grid">
        {nodesOr(
          M.groups.map((g, i) => (
            <Fragment key={i}>
              {card(
                <>
                  <h2>{txt(g.name)}</h2>
                  <p>{txt(g.category)}</p>
                  <p>{status(g.position || L('Member', 'عضو'))}</p>
                  <div className="member-actions">
                    {link('mymeetings', L('Meetings', 'الاجتماعات'))}
                    {link('myresources', L('Resources', 'الموارد'))}
                  </div>
                </>
              )}
            </Fragment>
          )),
          blank(L('No ministry membership is recorded for your account.', 'لا توجد عضوية خدمة مسجّلة لحسابك.'))
        )}
      </Paged>
    </div>
  );
}

export function meetings() {
  const rows = M.meetings.map(m => ({
    ...m,
    type: 'meeting',
    subtitle: `${m.group} · ${m.location || L('Location to be confirmed', 'المكان يحدّد لاحقاً')}`,
    badge: m.attendance
  }));
  return (
    <div className="member-page">
      {title(
        L('Meetings', 'الاجتماعات'),
        L('Meetings for the ministries you belong to.', 'اجتماعات الخدمات التي تنتمي إليها.')
      )}{' '}
      <div className="member-toolbar">
        <Select data-filter="group" aria-label={L('Ministry', 'الخدمة')}>
          <option value="">{L('All ministries', 'كل الخدمات')}</option>
          {M.groups.map((g, i) => (
            <option key={i} value={txt(g.id)}>
              {txt(g.name)}
            </option>
          ))}
        </Select>
      </div>{' '}
      {schedule('meetings', rows, L('No meetings are recorded for your ministries.', 'لا اجتماعات مسجّلة لخدماتك.'))}
    </div>
  );
}

export function attendancePage() {
  const stats = attendance();
  const items = M.meetings.map(m => ({
    ...m,
    type: 'meeting',
    subtitle: m.group,
    badge: m.attendance,
    source: m.attendance
  }));
  return (
    <div className="member-page">
      {title(
        L('My attendance', 'حضوري'),
        L('A personal record to help you stay informed.', 'سجل شخصي لمساعدتك على المتابعة.')
      )}{' '}
      <Paged className="member-grid">
        {card(
          <>
            <h2>{L('Attendance', 'الحضور')}</h2>
            <strong>{stats.percent === null ? '—' : stats.percent + '%'}</strong>
            <p>
              {stats.attended} {L('attended', 'حضور')} · {stats.past.filter(m => m.attendance === 'absent').length}{' '}
              {L('absent', 'غياب')} · {stats.past.filter(m => m.attendance === 'excused').length}{' '}
              {L('excused', 'غياب معذور')} · {stats.past.filter(m => m.attendance === 'late').length}{' '}
              {L('late', 'تأخير')}
            </p>
          </>
        )}
      </Paged>{' '}
      <div className="member-toolbar">
        <Select data-filter="group">
          <option value="">{L('All ministries', 'كل الخدمات')}</option>
          {M.groups.map((g, i) => (
            <option key={i} value={txt(g.id)}>
              {txt(g.name)}
            </option>
          ))}
        </Select>
        <Select data-filter="source">
          <option value="">{L('All statuses', 'كل الحالات')}</option>
          {['present', 'absent', 'excused', 'late', 'unrecorded', 'upcoming'].map((x, i) => (
            <option key={i}>{x}</option>
          ))}
        </Select>
      </div>{' '}
      {schedule(
        'attendance',
        items,
        L('Attendance will appear after your first ministry meeting.', 'يظهر سجل الحضور بعد أول اجتماع لخدمتك.')
      )}
    </div>
  );
}

export function calendar() {
  const items = [
    ...M.events.map(e => ({
      ...e,
      title: eventTitle(e),
      date: e.d,
      time: e.t,
      type: 'event',
      source: e.source,
      subtitle: e.location
    })),
    ...M.meetings.map(m => ({ ...m, type: 'meeting', source: 'Meetings', subtitle: `${m.group} · ${m.location}` })),
    ...M.notes
      .filter(n => n.reminder)
      .map(n => ({ id: n.id, title: n.title, date: n.reminder, type: 'note', source: 'Reminder' })),
    ...M.todos
      .filter(x => x.due)
      .map(x => ({
        id: x.id,
        title: x.title,
        date: x.due,
        type: 'todo',
        source: 'Tasks',
        badge: x.done ? L('Done', 'تم') : L('To do', 'مهمة')
      })),
    ...M.formation
      .filter(x => x.completion?.date)
      .map(x => ({
        id: x.id,
        title: x.name,
        date: x.completion.date,
        type: 'formation',
        source: 'Formation',
        subtitle: groupName(x.groupId)
      }))
  ];
  return (
    <div className="member-page">
      {title(
        L('My calendar', 'رزنامتي'),
        L(
          'Ministry meetings, your registrations, volunteering and sacraments, and your tasks.',
          'اجتماعات الخدمة وتسجيلاتك وتطوعك وأسرارك ومهامك.'
        )
      )}{' '}
      <div className="member-toolbar">
        <Select data-filter="source" aria-label={L('Activity type', 'نوع النشاط')}>
          <option value="">{L('All activities', 'كل الأنشطة')}</option>
          {[
            ['Meetings', 'Meetings', 'الاجتماعات'],
            ['Registration', 'Event registrations', 'تسجيلات المناسبات'],
            ['Volunteering', 'Volunteering', 'التطوع'],
            ['Sacrament', 'Sacraments', 'الأسرار'],
            ['Reminder', 'Reminders', 'التذكيرات'],
            ['Tasks', 'Tasks', 'المهام'],
            ['Formation', 'Formation', 'التنشئة']
          ].map(([value, en, ar], i) => (
            <option key={i} value={value}>
              {L(en, ar)}
            </option>
          ))}
        </Select>
      </div>{' '}
      {schedule('calendar', items, L('No activities in this view.', 'لا أنشطة في هذا العرض.'))}
    </div>
  );
}

export function messages() {
  const rows = M.content.filter(x => ['message', 'announcement', 'discussion'].includes(x.kind));
  const filter = S.ui.memberMessageFilter || 'inbox';
  const selected = rows.filter(x =>
    filter === 'archived'
      ? x.archived
      : !x.archived &&
        (filter === 'all' ||
          (filter === 'sent' && x.authorId === session.user?.id) ||
          (filter === 'announcements' && x.kind === 'announcement') ||
          (filter === 'inbox' && x.authorId !== session.user?.id))
  );
  return (
    <div className="member-page">
      {title(
        L('Messages', 'الرسائل'),
        L(
          'Announcements are one-way; conversations can receive replies.',
          'الإعلانات باتجاه واحد، ويمكن الرد على المحادثات.'
        )
      )}{' '}
      {M.groups.length ? (
        <div className="member-actions">
          <button className="btn btn-primary" data-member-compose="">
            {L('Message my ministry', 'مراسلة خدمتي')}
          </button>
        </div>
      ) : (
        ''
      )}{' '}
      <div className="member-toolbar">
        <div className="seg" role="group">
          {[
            ['inbox', 'Inbox', 'الوارد'],
            ['sent', 'Sent', 'المرسل'],
            ['announcements', 'Announcements', 'الإعلانات'],
            ['archived', 'Archived', 'الأرشيف'],
            ['all', 'All', 'الكل']
          ].map(([id, en, ar], i) => (
            <button key={i} data-message-filter={id} aria-pressed={filter === id}>
              {L(en, ar)}
            </button>
          ))}
        </div>
        <input
          className="input"
          type="search"
          data-member-search=""
          placeholder={L('Search communications', 'البحث في الرسائل')}
        />
      </div>{' '}
      <Paged className="member-list">
        {nodesOr(
          selected.map((x, i) => (
            <div key={i} className="member-card member-search-row" data-search={txt(x.title + ' ' + x.body)}>
              <div className="member-row">
                <div>
                  <h2>
                    {txt(itemTitle(x))} {!x.read ? status(L('Unread', 'غير مقروء')) : ''}
                  </h2>
                  <p>
                    {txt(groupName(x.groupId))} · {date(x.at)}
                  </p>
                </div>
                {status(
                  x.kind === 'announcement'
                    ? L('Announcement', 'إعلان')
                    : x.kind === 'discussion'
                      ? L('Group conversation', 'محادثة جماعية')
                      : L('Message', 'رسالة')
                )}
              </div>
              <p>{txt(itemBody(x))}</p>
              {x.attachment ? (
                <a
                  className="btn btn-secondary btn-dense"
                  download={txt(x.attachment.name)}
                  href={txt(x.attachment.data)}
                >
                  {L('Download attachment', 'تنزيل المرفق')}
                </a>
              ) : (
                ''
              )}
              <div className="member-actions">
                {x.kind === 'discussion' ? (
                  <button className="btn btn-primary btn-dense" data-discussion={txt(x.id)}>
                    {L('Open conversation', 'فتح المحادثة')}
                  </button>
                ) : (
                  ''
                )}
                {x.read ? (
                  ''
                ) : (
                  <button className="btn btn-secondary btn-dense" data-member-read={txt(x.id)}>
                    {L('Mark read', 'تعليم كمقروء')}
                  </button>
                )}
                <button
                  className="btn btn-secondary btn-dense"
                  data-member-archive={txt(x.id)}
                  data-archive-op={x.archived ? 'unarchive' : 'archive'}
                >
                  {x.archived ? L('Restore', 'استعادة') : L('Archive', 'أرشفة')}
                </button>
              </div>
            </div>
          )),
          blank(L('No communications in this view.', 'لا رسائل في هذا العرض.'))
        )}
      </Paged>
    </div>
  );
}

export function feed() {
  const rows = M.content
    .filter(x => ['post', 'announcement'].includes(x.kind))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at.localeCompare(a.at));
  return (
    <div className="member-page">
      {title(
        L('Ministry updates', 'مستجدات الخدمة'),
        L('Posts and announcements from your ministries and parish.', 'منشورات وإعلانات خدماتك والرعية.')
      )}
      <div className="member-toolbar">
        <input
          className="input"
          type="search"
          data-member-search=""
          placeholder={L('Search updates', 'البحث في المستجدات')}
          aria-label={L('Search updates', 'البحث في المستجدات')}
        />
      </div>
      <Paged className="member-list">
        {nodesOr(
          rows.map((x, i) => (
            <Fragment key={i}>
              {card(
                <>
                  <h2>
                    {txt(itemTitle(x))} {x.pinned ? status(L('Pinned', 'مثبّت')) : ''}
                  </h2>
                  <p className="dim">
                    {txt(groupName(x.groupId))} · {date(x.at)} · {txt(x.category)}
                  </p>
                  <div>{x.html ? safeRichText(x.html) : txt(itemBody(x))}</div>
                  {x.attachment ? (
                    <a
                      className="btn btn-secondary btn-dense"
                      download={txt(x.attachment.name)}
                      href={txt(x.attachment.data)}
                    >
                      {L('Download attachment', 'تنزيل المرفق')}
                    </a>
                  ) : (
                    ''
                  )}
                </>,
                'member-search-row',
                { 'data-search': txt(x.title + ' ' + x.body) }
              )}
            </Fragment>
          )),
          blank(L('No updates have been published yet.', 'لم تُنشر مستجدات بعد.'))
        )}
      </Paged>
    </div>
  );
}

export function resources() {
  const rows = contentRows('resource');
  /* Resources come from every ministry the member currently belongs to, including ones the parish does
     not list publicly, so the filter is built from the rows as well as the known ministries. */
  const ministries = new Map(M.groups.map(g => [g.id, g.name]));
  for (const x of rows) if (!ministries.has(x.groupId)) ministries.set(x.groupId, x.groupName || '');
  return (
    <div className="member-page">
      {title(
        L('Resources', 'الموارد'),
        L(
          'Belongings your ministries keep for their members, with what is available now.',
          'ما تحتفظ به خدماتك لأعضائها، مع المتاح حالياً.'
        )
      )}
      <div className="member-toolbar">
        <Select data-filter="group">
          <option value="">{L('All ministries', 'كل الخدمات')}</option>
          {[...ministries].map(([id, name], i) => (
            <option key={i} value={txt(id)}>
              {txt(name)}
            </option>
          ))}
        </Select>
        <input
          className="input"
          type="search"
          data-member-search=""
          placeholder={L('Search resources', 'البحث في الموارد')}
          aria-label={L('Search resources', 'البحث في الموارد')}
        />
      </div>
      <Paged className="member-list">
        {nodesOr(
          rows.map((x, i) => (
            <div
              key={i}
              className="member-card member-filter-row member-search-row"
              data-group={txt(x.groupId)}
              data-search={txt(x.title + ' ' + (x.groupName || groupName(x.groupId)))}
            >
              <h2>{txt(x.title)}</h2>
              <p>
                {txt(x.groupName || groupName(x.groupId))} · {L('Updated', 'آخر تحديث')} {date(x.at)}
              </p>
              <p>
                {L('Available', 'متاح')}: {txt(x.available)} / {txt(x.total)}
              </p>
            </div>
          )),
          blank(L('No resources have been shared yet.', 'لا موارد مشتركة حالياً.'))
        )}
      </Paged>
      {M.resourcesTruncated ? (
        <p className="help">
          {L(
            'The list is long, so not every item is shown. Ask your ministry for the full list.',
            'القائمة طويلة، لذا لا تظهر كل المواد. اطلب القائمة الكاملة من خدمتك.'
          )}
        </p>
      ) : (
        ''
      )}
    </div>
  );
}

export function formation() {
  return (
    <div className="member-page">
      {title(
        L('Formation', 'التنشئة'),
        L('Training and faith-development materials from your ministries.', 'مواد التدريب والتنشئة من خدماتك.')
      )}{' '}
      <Paged className="member-list">
        {nodesOr(
          M.formation.map((x, i) => (
            <Fragment key={i}>
              {card(
                <>
                  <div>
                    <h2>{txt(x.name)}</h2>
                    <p>{txt(groupName(x.groupId))}</p>
                    {x.description ? <p>{txt(x.description)}</p> : ''}
                  </div>
                  {status(
                    x.completion?.date
                      ? L('Completed', 'مكتمل') + ' · ' + date(x.completion.date)
                      : L('Available', 'متاح')
                  )}
                </>,
                'member-formation-card'
              )}
            </Fragment>
          )),
          blank(L('No formation material is assigned to your ministries.', 'لا مواد تنشئة مخصصة لخدماتك حالياً.'))
        )}
      </Paged>
    </div>
  );
}

export function commitments() {
  const rows = contentRows('opportunity');
  return (
    <div className="member-page">
      {title(
        L('Volunteer opportunities', 'فرص التطوع'),
        L(
          'Offer to help; the ministry coordinator confirms the assignment.',
          'اعرض مساعدتك، ثم يؤكد منسّق الخدمة المهمة.'
        )
      )}
      <Paged className="member-list">
        {nodesOr(
          rows.map((x, i) => (
            <div key={i} className="member-card">
              <h2>{txt(x.title)}</h2>
              <p>
                {txt(groupName(x.groupId))} · {txt(x.category)}
              </p>
              <p>{txt(x.body)}</p>
              <p>{status(M.commitments[x.id]?.status || L('Open', 'متاحة'))}</p>
              <div className="member-actions">
                <button className="btn btn-primary btn-dense" data-volunteer={txt(x.id)} data-status="volunteer">
                  {L('Volunteer', 'أتطوّع')}
                </button>
                {M.commitments[x.id] ? (
                  <button className="btn btn-secondary btn-dense" data-volunteer={txt(x.id)} data-status="withdrawn">
                    {L('Withdraw', 'انسحاب')}
                  </button>
                ) : (
                  ''
                )}
              </div>
            </div>
          )),
          blank(L('No volunteer opportunities are open yet.', 'لا فرص تطوع متاحة حالياً.'))
        )}
      </Paged>
    </div>
  );
}

export function notes() {
  const query = S.ui.memberNoteQuery || '';
  const rows = [...M.notes].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)
  );
  const todos = [...M.todos].sort(
    (a, b) => Number(a.done) - Number(b.done) || (a.due || '9999').localeCompare(b.due || '9999')
  );
  const view = S.ui.memberNotesView || 'list';
  return (
    <div className="member-page">
      {title(
        L('My Notes', 'ملاحظاتي'),
        L('Private notes and tasks for your parish life.', 'ملاحظات ومهام خاصة بحياتك الرعوية.')
      )}{' '}
      <div className="member-toolbar">
        <div className="seg" role="group" aria-label={L('Notes view', 'عرض الملاحظات')}>
          <button data-notes-view="list" aria-pressed={view === 'list'}>
            {L('List', 'قائمة')}
          </button>
          <button data-notes-view="calendar" aria-pressed={view === 'calendar'}>
            {L('Calendar', 'رزنامة')}
          </button>
        </div>
        {view === 'calendar' ? (
          <>
            <button className="btn btn-primary btn-dense" data-todo-new="">
              {L('Add task', 'إضافة مهمة')}
            </button>
            <button className="btn btn-secondary btn-dense" data-note-new="">
              {L('New note', 'ملاحظة جديدة')}
            </button>
          </>
        ) : (
          ''
        )}
      </div>{' '}
      {view === 'calendar' ? (
        schedule(
          'notes',
          [
            ...M.notes
              .filter(x => x.reminder)
              .map(x => ({ id: x.id, title: x.title, date: x.reminder, type: 'note', source: 'Reminder' })),
            ...todos
              .filter(x => x.due)
              .map(x => ({
                id: x.id,
                title: x.title,
                date: x.due,
                type: 'todo',
                source: 'Tasks',
                badge: x.done ? L('Done', 'تم') : L('To do', 'مهمة')
              }))
          ],
          L('Add a reminder or due date to see it here.', 'أضف تذكيراً أو تاريخ استحقاق ليظهر هنا.')
        )
      ) : (
        <>
          <div className="member-section-head">
            <h2>{L('To-do list', 'قائمة المهام')}</h2>
            <button className="btn btn-primary btn-dense" data-todo-new="">
              {L('Add task', 'إضافة مهمة')}
            </button>
          </div>{' '}
          <div className="member-todos">
            {nodesOr(
              todos.map((x, i) => (
                <div key={i} className={`member-todo ${x.done ? 'done' : ''}`}>
                  <label>
                    <input type="checkbox" data-todo-toggle={txt(x.id)} defaultChecked={!!x.done} />
                    <span>{txt(x.title)}</span>
                  </label>
                  {x.due ? <small>{date(x.due)}</small> : ''}
                  <button className="btn btn-secondary btn-dense" data-todo-edit={txt(x.id)}>
                    {L('Edit', 'تعديل')}
                  </button>
                  <button className="btn btn-secondary btn-dense" data-todo-delete={txt(x.id)}>
                    {L('Delete', 'حذف')}
                  </button>
                </div>
              )),
              blank(L('No tasks yet. Add one above.', 'لا مهام بعد. أضف مهمة أعلاه.'))
            )}
          </div>{' '}
          <div className="member-section-head">
            <h2>{L('Private notes', 'ملاحظات خاصة')}</h2>
            <button className="btn btn-primary btn-dense" data-note-new="">
              {L('New note', 'ملاحظة جديدة')}
            </button>
          </div>{' '}
          <div className="member-toolbar">
            <input
              className="input"
              type="search"
              data-note-search=""
              defaultValue={txt(query)}
              placeholder={L('Search notes', 'البحث في الملاحظات')}
              aria-label={L('Search notes', 'البحث في الملاحظات')}
            />
            <Select data-filter="category">
              <option value="">{L('All categories', 'كل الفئات')}</option>
              {[...new Set(rows.map(n => n.category).filter(Boolean))].map((x, i) => (
                <option key={i}>{txt(x)}</option>
              ))}
            </Select>
          </div>{' '}
          <Paged className="member-list">
            {nodesOr(
              rows.map((n, i) => (
                <div
                  key={i}
                  className="member-card member-filter-row member-search-row"
                  data-category={txt(n.category)}
                  data-search={txt(n.title + ' ' + n.body + ' ' + n.tags.join(' '))}
                >
                  <div className="member-row">
                    <h2>
                      {txt(n.title)} {n.pinned ? status(L('Pinned', 'مثبّتة')) : ''}
                    </h2>
                    <small>{date(n.updatedAt)}</small>
                  </div>
                  <p>{txt(n.body)}</p>
                  <p className="dim">
                    {txt(n.category)} {n.tags.map(tag => `#${txt(tag)}`).join(' ')}{' '}
                    {n.reminder ? '· ' + date(n.reminder) : ''}
                  </p>
                  {n.meetingId ? (
                    <p className="dim">
                      {L('Meeting', 'الاجتماع')}:{' '}
                      {(() => {
                        const m = M.meetings.find(x => x.id === n.meetingId);
                        return m
                          ? txt(`${m.title} · ${date(m.date)}`)
                          : L('no longer on your list', 'لم يعد في قائمتك');
                      })()}
                    </p>
                  ) : (
                    ''
                  )}
                  <button className="btn btn-secondary btn-dense" data-note-edit={txt(n.id)}>
                    {L('Edit', 'تعديل')}
                  </button>
                  <button className="btn btn-secondary btn-dense" data-note-delete={txt(n.id)}>
                    {L('Delete', 'حذف')}
                  </button>
                </div>
              )),
              blank(L('Your private notes will appear here.', 'تظهر ملاحظاتك الخاصة هنا.'))
            )}
          </Paged>
        </>
      )}
    </div>
  );
}

const MEMBERSHIP = {
  member: ['Parishioner', 'من أبناء الرعية'],
  visitor: ['Visitor', 'زائر'],
  inactive: ['Inactive', 'غير ناشط']
};

export function profile() {
  const p = M.person,
    other = isAr() ? p.lat : p.ar;
  return (
    <div className="member-page">
      {title(
        L('My profile', 'ملفي'),
        L('Your official record is maintained by the parish office.', 'يحتفظ مكتب الرعية بسجلك الرسمي.')
      )}
      {card(
        <>
          <h2>{txt(isAr() ? p.ar || p.lat : p.lat)}</h2>
          {other && other !== (isAr() ? p.ar || p.lat : p.lat) ? <p>{txt(other)}</p> : ''}
          <dl className="member-profile">
            <dt>{L('Parish membership', 'العضوية الرعوية')}</dt>
            <dd>{txt(MEMBERSHIP[p.status] ? L(...MEMBERSHIP[p.status]) : p.status)}</dd>
            <dt>{L('Phone', 'الهاتف')}</dt>
            <dd>
              <bdi dir="ltr">{txt(phoneShow(p.phone))}</bdi>
            </dd>
            <dt>{L('Email', 'البريد الإلكتروني')}</dt>
            <dd>{txt(p.email || '—')}</dd>
            <dt>{L('Address', 'العنوان')}</dt>
            <dd>{txt(p.address || '—')}</dd>
            <dt>{L('Date of birth', 'تاريخ الميلاد')}</dt>
            <dd>{date(p.born)}</dd>
            <dt>{L('Ministries', 'الخدمات')}</dt>
            <dd>{M.groups.map(g => txt(g.name)).join(', ') || '—'}</dd>
          </dl>
          <button className="btn btn-primary" data-profile-request="">
            {L('Request information update', 'طلب تحديث المعلومات')}
          </button>
        </>
      )}{' '}
      {card(
        <>
          <h2>{L('Notification preferences', 'تفضيلات الإشعارات')}</h2>
          {M.preferences.loaded && M.preferences.topics.some(x => x.mutable && !x.required) ? (
            <>
              {M.preferences.topics
                .filter(x => x.mutable && !x.required)
                .map((x, i) => (
                  <label key={i} className="member-toggle">
                    <span>{topicLabel(x.topic)}</span>
                    <input
                      type="checkbox"
                      data-preference-topic={txt(x.topic)}
                      defaultChecked={!M.preferences.muted.includes(x.topic)}
                    />
                  </label>
                ))}
              <button className="btn btn-secondary btn-dense" data-preferences-save="">
                {L('Save preferences', 'حفظ التفضيلات')}
              </button>
            </>
          ) : (
            <p className="help">{L('Your preferences could not be loaded.', 'تعذّر تحميل تفضيلاتك.')}</p>
          )}
          <p className="help">
            {L(
              'Updates about your own requests, cases, registrations, certificates, membership and messages always appear here and cannot be turned off. Notices appear in the portal only; email and text delivery are not connected.',
              'تظهر دائماً هنا مستجدات طلباتك وحالاتك وتسجيلاتك وشهاداتك وعضويتك ورسائلك ولا يمكن إيقافها. تظهر الإشعارات داخل البوابة فقط؛ الإرسال بالبريد والرسائل النصية غير موصول.'
            )}
          </p>
          <h2>{L('Signing in', 'تسجيل الدخول')}</h2>
          <p className="help">
            {L(
              'Your password, two-step sign-in and sessions are in your account.',
              'كلمة المرور والدخول بخطوتين والجلسات في حسابك.'
            )}
          </p>
          {link('account', L('Open my account', 'فتح حسابي'))}
        </>
      )}{' '}
      {M.profileRequests.length
        ? card(
            <>
              <h2>{L('Update requests', 'طلبات التحديث')}</h2>
              {M.profileRequests.map((x, i) => (
                <div key={i} className="member-simple-row">
                  <span>
                    {txt(x.field)} · {txt(x.requested_value)}
                  </span>
                  <span>
                    {status(x.status)}{' '}
                    {x.status === 'Pending' ? (
                      <button className="btn btn-secondary btn-dense" data-correction-withdraw={txt(x.id)}>
                        {L('Withdraw', 'سحب')}
                      </button>
                    ) : (
                      ''
                    )}
                  </span>
                </div>
              ))}
            </>
          )
        : ''}{' '}
      {card(
        <>
          <h2>{L('My consents', 'موافقاتي')}</h2>
          {nodesOr(
            M.consents.map((c, i) => (
              <div key={i} className="member-simple-row">
                <span>
                  <b>{txt(c.kind)}</b> · {txt(c.purpose)}
                  <small style={{ display: 'block' }}>
                    {date(c.givenAt)} · {txt(c.policyVersion)}
                    {c.withdrawnAt ? ` · ${L('withdrawn', 'سُحبت')} ${date(c.withdrawnAt)}` : ''}
                  </small>
                </span>
                <span>
                  {status(c.status)}{' '}
                  {c.status === 'Active' ? (
                    <button className="btn btn-secondary btn-dense" data-consent-withdraw={txt(c.id)}>
                      {L('Withdraw', 'سحب')}
                    </button>
                  ) : (
                    ''
                  )}
                </span>
              </div>
            )),
            blank(L('No consent is recorded for you in this parish.', 'لا موافقات مسجّلة لك في هذه الرعية.'))
          )}
        </>
      )}{' '}
      {card(
        <>
          <h2>{L('My data', 'بياناتي')}</h2>
          {M.ownData ? (
            <>
              <dl className="member-profile">
                {Object.entries(M.ownData.records || {}).map(([kind, count], i) => (
                  <Fragment key={i}>
                    <dt>{txt(kind)}</dt>
                    <dd>{txt(count)}</dd>
                  </Fragment>
                ))}
              </dl>
              {M.closureRequests.map((x, i) => (
                <div key={i} className="member-simple-row">
                  <span>
                    {L('Closure request', 'طلب إغلاق')} · {date(x.submittedAt)}
                    {x.reason ? ` · ${txt(x.reason)}` : ''}
                  </span>
                  {status(x.status)}
                </div>
              ))}
              {M.closureRequests.some(x => x.status === 'Pending') ? (
                ''
              ) : (
                <button className="btn btn-secondary" data-closure-request="">
                  {L('Ask the parish to close my data', 'طلب إغلاق بياناتي لدى الرعية')}
                </button>
              )}
            </>
          ) : (
            blank(
              L(
                'Your data view is available once your account is linked to your record.',
                'يظهر عرض بياناتك بعد ربط حسابك بسجلك.'
              )
            )
          )}
        </>
      )}
    </div>
  );
}

export function concerns() {
  return (
    <div className="member-page">
      {title(
        L('Submit a Concern', 'تقديم ملاحظة أو قلق'),
        L('Your submissions and their updates appear here automatically.', 'تظهر طلباتك وتحديثاتها هنا تلقائياً.')
      )}
      <div className="member-actions">
        <button className="btn btn-primary" data-concern-new="">
          {L('Submit a concern', 'تقديم ملاحظة')}
        </button>
      </div>{' '}
      <div className="member-section-head">
        <h2>{L('My concerns', 'ملاحظاتي المقدّمة')}</h2>
      </div>
      <Paged className="member-list">
        {nodesOr(
          M.concerns.map((x, k) => (
            <Fragment key={k}>
              {card(
                <>
                  <div className="member-row">
                    <h2>{txt(x.subject)}</h2>
                    {status(x.status)}
                  </div>
                  <p>
                    {date(x.created_at)} ·{' '}
                    {x.anonymous ? L('Anonymous to reviewers', 'مجهول الهوية للمراجعين') : L('Identified', 'معرّف')}
                  </p>
                  <div className="member-updates">
                    {x.updates.map((y, i) => (
                      <p key={i}>
                        <b>
                          {date(y.at)} · {txt(y.status)}
                        </b>
                        <br />
                        {txt(y.text)}
                      </p>
                    ))}
                  </div>
                  <button className="btn btn-secondary btn-dense" data-concern-follow={txt(x.id)}>
                    {L('Add information', 'إضافة معلومات')}
                  </button>
                </>
              )}
            </Fragment>
          )),
          blank(L('You have no submissions yet.', 'ليس لديك طلبات بعد.'))
        )}
      </Paged>
    </div>
  );
}

export function notificationsPage() {
  const rows = M.notifications;
  return (
    <div className="member-page">
      {title(L('Notifications', 'الإشعارات'), L('Recent updates that matter to you.', 'آخر المستجدات التي تهمك.'))}
      <div className="member-actions">
        {rows.some(x => !x.read) ? (
          <button className="btn btn-secondary" data-notification-read-all="">
            {L('Mark all as read', 'تعليم الكل كمقروء')}
          </button>
        ) : (
          ''
        )}
        {link('myprofile', L('Notification preferences', 'تفضيلات الإشعارات'))}
      </div>
      <Paged className="member-list">
        {nodesOr(
          rows
            .map(x => ({
              ...x,
              ...(x.kind?.startsWith('request-')
                ? noticeText(
                    x,
                    M.requests.find(r => x.route === 'myrequests/' + r.id)
                  )
                : {})
            }))
            .map((x, i) => (
              <Fragment key={i}>
                {card(
                  <>
                    <div className="member-row">
                      <h2>
                        {txt(x.title)} {!x.read ? status(L('New', 'جديد')) : ''}
                      </h2>
                      <small>{date(x.at)}</small>
                    </div>
                    {x.body ? <p>{txt(x.body)}</p> : ''}
                    <div className="member-actions">
                      {x.read ? (
                        ''
                      ) : (
                        <button className="btn btn-secondary btn-dense" data-notification-read={txt(x.id)}>
                          {L('Mark read', 'تعليم كمقروء')}
                        </button>
                      )}
                      {link(x.route, L('Open', 'فتح'))}
                    </div>
                  </>
                )}
              </Fragment>
            )),
          blank(L('You are all caught up.', 'لا إشعارات جديدة.'))
        )}
      </Paged>
    </div>
  );
}

export function hub() {
  return (
    <div className="member-page">
      {title(
        L('Member communication', 'التواصل مع الأعضاء'),
        L(
          'Cases assigned to you as an independent concern reviewer.',
          'الحالات المحالة إليك بصفتك مراجعاً مستقلاً للطلبات.'
        )
      )}
      {M.complaintPermissions.includes('Review')
        ? card(
            <>
              <h2>{L('Concern review', 'مراجعة الطلبات السرية')}</h2>
              <p>
                {L(
                  'Only explicitly appointed reviewers can see these cases.',
                  'هذه الحالات متاحة فقط للمراجعين المعيّنين صراحةً.'
                )}
              </p>
              {nodesOr(
                M.review.map((x, i) => (
                  <div key={i} className="member-simple-row">
                    <span>
                      {txt(x.reference)} · {txt(x.subject)} · {txt(x.status)}{' '}
                      {x.anonymous ? L('(anonymous)', '(مجهول)') : ''}
                    </span>
                    <button className="btn btn-secondary btn-dense" data-review-concern={txt(x.id)}>
                      {L('Review', 'مراجعة')}
                    </button>
                  </div>
                )),
                blank(L('No cases assigned to this parish.', 'لا حالات مسجّلة في هذه الرعية.'))
              )}
            </>
          )
        : blank(
            L(
              'Concern review appears here when you are an appointed independent reviewer. Publishing, volunteer responses and profile reviews are on their own pages.',
              'تظهر مراجعة الطلبات هنا عندما تكون مراجعاً مستقلاً معيّناً. النشر وردود المتطوعين ومراجعة الملفات في صفحاتها.'
            )
          )}
    </div>
  );
}

for (const view of [
  home,
  ministries,
  meetings,
  attendancePage,
  calendar,
  messages,
  feed,
  resources,
  formation,
  commitments,
  notes,
  profile,
  concerns,
  notificationsPage,
  hub
])
  view.mount = mount;
