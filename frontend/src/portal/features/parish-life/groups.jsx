/* Groups and ministries: the list and one group's overview, roster, meetings, attendance, posts,
   tasks, milestones and resources. */
import { Fragment } from 'react';
import { Select } from '../../ui/components.jsx';
import { css, nodesOr } from '../../ui/html.js';
import { t, isAr, fmtDate, fmtLong } from '../../../lib/i18n.js';
import { is, S, bus } from '../../model/store.js';
import {
  Icon,
  PageHead,
  Panel,
  Who,
  Status,
  Pill,
  Table,
  Empty,
  openDrawer,
  openModal,
  closeOverlays,
  toast,
  Avatar,
  TabBar,
  Paged
} from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as CR from '../../shared/record-editor.jsx';
import { VERBS } from '../../shell/actions.jsx';
import { persist } from '../../model/persist.js';
import { safeRichText } from '../../../lib/rich-text.js';
import { meetingEdit, lifecycleStep, leaderEnd } from './groups-dialogs.jsx';
import { meetingId, attendanceCounts, attendanceValue } from '../../model/planning.js';
import { GROUPS, groupInfo, TODAY, MUSIC, person, group } from '../../model/data.js';
import {
  attendanceTag,
  byTime,
  groupCards,
  iso,
  meetingAttendance,
  meetingKind,
  memberAttendancePct
} from './parish-life-shared.jsx';
import {
  attendanceExport,
  attendanceImport,
  attendanceMatrix,
  attendancePrint,
  chooseAttendance,
  meetingReview
} from './attendance.jsx';
import {
  formationDelete,
  formationForm,
  formationRecord,
  resourceDelete,
  resourceForm,
  resourceLend,
  resourceLoanEdit,
  loanSteps,
  formationApprove,
  formationReview
} from './group-resources.jsx';

/* Display only: an empty twin falls back to the other language (never when saving). */
const L = (en, ar) => t(en || ar, ar || en);

export function groups(id, tab) {
  if (id) return groupDetail(id, tab || '');
  const cards = groupCards(GROUPS); // the API has already scoped leaders to their own groups

  return (
    <>
      <PageHead
        crumbs={[
          { label: is('leader') ? L('My ministry', 'خدمتي') : L('Parish life', 'حياة الرعية') },
          { label: L('Groups', 'المجموعات') }
        ]}
        title={is('leader') ? L('My groups', 'مجموعاتي') : L('Groups and ministries', 'المجموعات والخدم')}
        sub={
          is('leader')
            ? L('You see only the groups you lead.', 'ترين فقط المجموعات التي تقودينها.')
            : L(
                'Youth, choirs, brotherhoods, catechism classes and committees — each with its own leader, roster and visibility.',
                'شبيبة وجوقات وأخويّات وصفوف تعليم ولجان — لكلٍّ مسؤولها ولائحتها ومستوى ظهورها.'
              )
        }
        actions={
          <>
            {is('secretary') ? (
              ''
            ) : (
              <button className="btn btn-secondary" id="qr">
                <Icon name="qr" size={17} />
                {L('Signup QR', 'رمز التسجيل')}
              </button>
            )}{' '}
            {!is('leader') ? (
              <button className="btn btn-primary" data-act="group-new">
                <Icon name="plus" size={17} />
                {L('New group', 'مجموعة جديدة')}
              </button>
            ) : (
              ''
            )}
          </>
        }
      />{' '}
      <Paged className="gridcards">{cards}</Paged>{' '}
      <p className="t-caption dim" style={{ marginTop: '20px' }}>
        {is('secretary')
          ? L(
              'Open a group to find its members, roles, contact information, meetings and resources.',
              'افتح المجموعة للاطلاع على أعضائها وأدوارهم ومعلومات التواصل والاجتماعات والموارد.'
            )
          : L(
              'People are placed into roles, not roles into people. When a leader hands over, the ongoing tasks follow the role to whoever takes it.',
              'يوضع الأشخاص في الأدوار لا الأدوار في الأشخاص. وعند التسليم تنتقل المهام الجارية مع الدور إلى من يتسلّمه.'
            )}
      </p>
    </>
  );
}

const GTABS = () =>
  is('secretary')
    ? [
        ['roster', 'Members & contacts', 'الأعضاء والتواصل'],
        ['meetings', 'Meetings', 'الاجتماعات'],
        ['belongings', 'Resources', 'الموارد']
      ]
    : [
        ['', 'Overview', 'نظرة عامة'],
        ['roster', 'Roster', 'اللائحة'],
        ['attendance', 'Attendance', 'الحضور'],
        ['meetings', 'Meetings', 'الاجتماعات'],
        ['posts', 'Posts & files', 'المنشورات والملفات'],
        ['belongings', 'Resources', 'الموارد'],
        ['tasks', 'Tasks', 'المهام'],
        ['formation', 'Formation', 'التنشئة'],
        ['history', 'History', 'السجل']
      ];

function groupGone() {
  return (
    <>
      {
        <PageHead
          crumbs={[{ label: L('Groups', 'المجموعات'), href: '#/groups' }]}
          title={L('Group not found', 'المجموعة غير موجودة')}
        />
      }{' '}
      {
        <Empty
          glyph="groups"
          title={L('This group no longer exists', 'هذه المجموعة لم تعد موجودة')}
          body={L('It may have been deleted. Its members keep their records.', 'ربما حُذفت. ويحتفظ أعضاؤها بسجلاتهم.')}
          action={
            <a className="btn btn-primary btn-dense" href="#/groups">
              {L('All groups', 'كل المجموعات')}
            </a>
          }
        />
      }
    </>
  );
}

function meetingCard(g, m) {
  const date = new Date(`${m.d}T12:00:00`);
  const monthLabel = new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-US', { month: 'short' }).format(date);
  const upcoming = !m.done && m.d >= iso(new Date());
  const rsvp = m.rsvp || {};
  const counts = meetingAttendance(m);
  return (
    <section className="meeting-card">
      <div className="meeting-date">
        <strong>{new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-US', { day: 'numeric' }).format(date)}</strong>
        <span>{monthLabel}</span>
      </div>{' '}
      <div className="meeting-content">
        <div className="meeting-heading">
          <div>
            <p className="meeting-eyebrow">{fmtLong(date)}</p>{' '}
            <h3>{m.title || L('Group meeting', 'اجتماع المجموعة')}</h3>
            <p className="meeting-time">
              {meetingKind(m)} · <Icon name="events" size={15} />
              <span dir="ltr">
                {m.t || '—'}
                {m.end ? `–${m.end}` : ''}
              </span>
              {m.place ? ` · ${m.place}` : ''}
            </p>
          </div>{' '}
          <div className="meeting-heading-actions">
            {m.status === 'Draft' ? (
              <Pill label={L('Draft — not shown to members', 'مسودة — لا تظهر للأعضاء')} tone="warning" />
            ) : m.done ? (
              <Status k="closed" />
            ) : upcoming ? (
              <Status k="scheduled" />
            ) : (
              <Pill
                label={is('secretary') ? L('Past meeting', 'اجتماع سابق') : L('Attendance needed', 'الحضور مطلوب')}
                tone="warning"
              />
            )}{' '}
            <C.IconBtn ico="edit" label={L('Edit meeting', 'تعديل الاجتماع')} data-meeting-edit={meetingId(m)} />
          </div>
        </div>{' '}
        {is('secretary') ? (
          ''
        ) : (
          <div className="meeting-summary">
            {m.done ? (
              <>
                {attendanceTag('present', counts.present)}
                {attendanceTag('excused', counts.excused)}
                {attendanceTag('absent', counts.absent)}
              </>
            ) : upcoming ? (
              <>
                <span className="meeting-rsvp">
                  <b>{Number(rsvp.yes) || 0}</b>
                  {L('Going', 'سيحضرون')}
                </span>
                <span className="meeting-rsvp">
                  <b>{Number(rsvp.no) || 0}</b>
                  {L('Not going', 'لن يحضروا')}
                </span>
                <span className="meeting-rsvp">
                  <b>{Number(rsvp.none) || 0}</b>
                  {L('No reply', 'بلا ردّ')}
                </span>
              </>
            ) : (
              <span className="t-caption dim">
                {L('Record attendance to close this meeting.', 'سجّل الحضور لإقفال هذا الاجتماع.')}
              </span>
            )}
          </div>
        )}{' '}
        {m.description ? <p className="meeting-description">{m.description}</p> : ''}{' '}
        {m.hymns?.length ? (
          <p className="meeting-description">
            {L('Music', 'الموسيقى')}:{' '}
            {m.hymns
              .map(id => MUSIC.find(h => h.id === id))
              .filter(Boolean)
              .map(h => L(h.title, h.ar))
              .join(', ')}
          </p>
        ) : (
          ''
        )}{' '}
        {!is('secretary') && m.done && m.absent?.length ? (
          <details className="meeting-details">
            <summary>{L('Excused absence details', 'تفاصيل الغياب بعذر')}</summary>{' '}
            {m.absent.map(([pid, en, ar], i) => (
              <p key={i}>
                {L(person(pid)?.lat || pid, person(pid)?.ar || pid)} · {L(en, ar)}
              </p>
            ))}
          </details>
        ) : (
          ''
        )}{' '}
        <div className="meeting-actions">
          {m.status === 'Draft' && upcoming ? (
            <button className="btn btn-primary btn-dense" data-meeting-confirm={meetingId(m)}>
              {L('Confirm meeting', 'تثبيت الاجتماع')}
            </button>
          ) : (
            ''
          )}{' '}
          {upcoming ? (
            <button className="btn btn-secondary btn-dense" data-act="remind:group">
              {L('Send reminder', 'إرسال تذكير')}
            </button>
          ) : (
            ''
          )}{' '}
          {is('secretary') ? (
            ''
          ) : (
            <button className="btn btn-primary btn-dense" data-meeting-review={meetingId(m)}>
              {m.done ? L('Review attendance', 'مراجعة الحضور') : L('Take attendance', 'تسجيل الحضور')}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function groupDetail(id, tab) {
  const g = group(id);
  if (!g) return groupGone();
  const d = groupInfo(g.id);
  if (is('secretary') && !['roster', 'meetings', 'belongings'].includes(tab)) tab = 'roster';
  const head = (
    <>
      <div className="pagehead">
        <div className="entityhead" style={{ width: '100%' }}>
          <div className="id">
            <nav className="crumbs">
              <a href="#/groups">{L('Groups', 'المجموعات')}</a>
              <span className="sep">/</span>
              <span>{L(g.name, g.ar)}</span>
            </nav>{' '}
            <h1 style={{ font: '600 26px/34px var(--sans)', letterSpacing: '-.02em' }}>
              {L(g.name, g.ar)}{' '}
              <Pill
                label={L(
                  g.vis === 'private' ? 'Private' : g.vis === 'confidential' ? 'Confidential' : 'Public',
                  g.vis === 'private' ? 'خاص' : g.vis === 'confidential' ? 'سرّي' : 'عام'
                )}
                tone={g.vis === 'confidential' ? 'danger' : g.vis === 'private' ? 'warning' : ''}
                mark={g.vis === 'public' ? true : 'lock'}
              />
            </h1>{' '}
            <div className="meta">
              {L(g.cat, g.catAr)}
              {g.meets ? ` · ${L(g.meets, g.meetsAr)}` : ''} · {g.members} {L('members', 'عضواً')}
              {g.status && g.status !== 'Active' ? ` · ${g.status === 'Draft' ? L('Draft', 'مسودة') : g.status}` : ''}
            </div>
          </div>{' '}
          <div className="acts">
            {!is('leader') ? (
              <button className="btn btn-secondary" data-act="compose:group">
                <Icon name="msg" size={17} />
                {L('Message group', 'مراسلة المجموعة')}
              </button>
            ) : (
              ''
            )}{' '}
            {is('secretary') ? (
              ''
            ) : (
              <button className="btn btn-secondary" id="qr">
                <Icon name="qr" size={17} />
                {L('Signup QR', 'رمز التسجيل')}
              </button>
            )}{' '}
            <button className="btn btn-primary" data-act={`member-add:${g.id}`}>
              <Icon name="plus" size={17} />
              {L('Add member', 'إضافة عضو')}
            </button>{' '}
            {!is('leader') ? CR.recBtn('group', g.id, L('Group actions', 'إجراءات المجموعة')) : ''}
          </div>
        </div>
      </div>
      <TabBar base={'groups/' + g.id} items={GTABS()} active={tab} />
    </>
  );
  const T = {
    '': () => (
      <div className="splitview">
        <div className="stack" style={{ gap: '16px' }}>
          <Panel title={L('Leadership', 'المسؤوليات')} tight={true}>
            {(d.leaders || []).map((l, i) => (
              <div key={i} className="listrow">
                {person(l.personId) ? <Who p={person(l.personId)} /> : <b>{l.name || '—'}</b>}
                <span className="grow" />
                <span className="chip">{l.role === 'Leader' ? L('Leader', 'مسؤول') : L('Assistant', 'مساعد')}</span>
                {!is('leader') ? (
                  <button className="btn btn-secondary btn-dense" data-leader-end={l.accountId}>
                    {L('End', 'إنهاء')}
                  </button>
                ) : (
                  ''
                )}
              </div>
            ))}
          </Panel>{' '}
          <Panel title={L('Join requests', 'طلبات الانتساب')} tight={true}>
            {d.requests.length ? (
              d.requests.map((r, i) => (
                <div key={i} className="listrow">
                  <Who p={person(r.p)} />
                  <span className="grow">
                    <small className="mono">{fmtDate(r.at)}</small>
                  </span>{' '}
                  <button className="btn btn-secondary btn-dense" data-act={`join-decline:${r.p}`}>
                    {L('Decline', 'رفض')}
                  </button>{' '}
                  <button className="btn btn-primary btn-dense" data-act={`join-approve:${r.p}`}>
                    {L('Approve', 'قبول')}
                  </button>
                </div>
              ))
            ) : (
              <Empty
                glyph="groups"
                title={L('No requests', 'لا طلبات')}
                body={L('Nobody is waiting.', 'لا أحد ينتظر.')}
              />
            )}
          </Panel>
        </div>{' '}
        <div className="sidecol">
          {!is('leader') ? (
            <Panel title={L('Status', 'الحالة')}>
              <p className="t-caption dim">
                {g.status === 'Draft'
                  ? L(
                      'A draft: members cannot see it until a priest approves it.',
                      'مسودة: لا يراها الأعضاء قبل أن يعتمدها كاهن.'
                    )
                  : [
                      g.publicListed ? L('Public', 'عام') : L('Not on the public site', 'غير ظاهرة على الموقع العام'),
                      g.applicationsOpen
                        ? L('open to applications', 'باب الانتساب مفتوح')
                        : L('applications closed', 'باب الانتساب مغلق')
                    ].join(' · ')}
              </p>
              <div className="row" style={{ gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                {(g.status === 'Draft'
                  ? [['approve', 'Approve', 'اعتماد']]
                  : [
                      g.publicListed ? ['unpublish', 'Unpublish', 'إلغاء النشر'] : ['publish', 'Publish', 'نشر'],
                      g.applicationsOpen
                        ? ['close-applications', 'Close applications', 'إغلاق الانتساب']
                        : ['open-applications', 'Open applications', 'فتح الانتساب']
                    ]
                ).map(([action, en, ar]) => (
                  <button key={action} className="btn btn-secondary btn-dense" data-lifecycle={`${g.id}|${action}`}>
                    {L(en, ar)}
                  </button>
                ))}
              </div>
            </Panel>
          ) : (
            ''
          )}{' '}
          {!is('leader') ? (
            <Panel title={L('Leadership handover', 'تسليم المسؤولية')}>
              <p className="t-caption dim">
                {L(
                  'Transfer the group role and open tasks to an existing member. The person’s history stays intact.',
                  'انقل مسؤولية المجموعة ومهامها المفتوحة إلى عضو موجود. يبقى تاريخ الشخص محفوظاً.'
                )}
              </p>{' '}
              <button className="btn btn-secondary btn-dense" style={{ marginTop: '10px' }} data-act="handover">
                {L('Start handover', 'بدء التسليم')}
              </button>
            </Panel>
          ) : (
            ''
          )}{' '}
          <Panel title={L('Budget', 'الموازنة')}>
            <C.BarChart
              rows={[{ label: L('Youth & catechism', 'الشبيبة والتعليم'), v: d.budget.spent, max: d.budget.allocated }]}
            />{' '}
            <p className="t-caption dim" style={{ marginTop: '12px' }}>
              {L(
                'Income and expenses live in Finance; the group sees only its own allocation.',
                'المداخيل والمصاريف في المالية؛ وترى المجموعة مخصّصها فقط.'
              )}
            </p>{' '}
            <a className="btn btn-secondary btn-dense" style={{ marginTop: '10px' }} href="#/finance">
              {L('Open in Finance', 'فتح في المالية')}
            </a>
          </Panel>{' '}
          <Panel title={L('Attendance', 'الحضور')}>
            {(() => {
              const recent = d.meetings
                  .slice()
                  .sort((a, b) => b.d.localeCompare(a.d))
                  .slice(0, 4),
                counts = attendanceCounts(recent, d.roster),
                recorded = counts.present + counts.excused + counts.absent;
              return (
                <>
                  <div className="row" style={{ gap: '12px', alignItems: 'baseline' }}>
                    <b style={{ font: '600 24px/30px var(--sans)' }}>
                      {recorded ? Math.round((counts.present / recorded) * 100) + '%' : '—'}
                    </b>{' '}
                    <span className="t-caption dim">
                      {L('present among recorded statuses', 'حاضر من الحالات المسجّلة')}
                    </span>
                  </div>{' '}
                  <p className="t-caption dim">
                    {recorded} {L('statuses in the last four meetings', 'حالات في آخر أربعة اجتماعات')}
                  </p>{' '}
                  <a
                    className="btn btn-secondary btn-dense"
                    style={{ marginTop: '10px' }}
                    href={`#/groups/${g.id}/attendance`}
                  >
                    {L('Open attendance', 'فتح الحضور')}
                  </a>
                </>
              );
            })()}
          </Panel>
        </div>
      </div>
    ),
    roster: () => (
      <>
        <div className="toolbar" style={{ margin: '16px 0', gap: '8px', flexWrap: 'wrap' }}>
          <div className="search" style={{ maxWidth: '300px' }}>
            <Icon name="search" size={16} />
            <input
              className="input"
              type="search"
              data-roster-search=""
              placeholder={L('Search members', 'ابحث عن الأعضاء')}
              aria-label={L('Search members', 'البحث عن الأعضاء')}
            />
          </div>{' '}
          <Select data-roster-filter="" aria-label={L('Filter roster', 'تصفية اللائحة')} style={{ maxWidth: '230px' }}>
            <option value="all">{L('All roles', 'كل الأدوار')}</option>
            <option value="leaders">{L('People in charge', 'المسؤولون')}</option>
            <option value="members">{L('Members', 'الأعضاء')}</option>
          </Select>
        </div>{' '}
        <div data-roster-list="">
          <Table
            pick={true}
            cols={[
              { label: L('Member', 'العضو'), sort: true },
              { label: L('Role', 'الدور'), cls: 'hide-sm' },
              { label: L('Joined', 'انتسب'), cls: 'hide-md' },
              {
                label: is('secretary') ? L('Phone', 'الهاتف') : L('Attendance', 'الحضور'),
                cls: is('secretary') ? '' : 'num'
              },
              { label: '', cls: 'shrink' }
            ]}
            rows={d.roster
              .filter(r => {
                const q = (S.ui.rosterQuery || '').toLocaleLowerCase(),
                  p = person(r.p),
                  mode = S.ui.rosterFilter || 'all',
                  lead = r.role !== 'Member';
                return (
                  (!q || `${p?.lat || ''} ${p?.ar || ''} ${r.role || ''}`.toLocaleLowerCase().includes(q)) &&
                  (mode === 'all' || (mode === 'leaders') === lead)
                );
              })
              .map(r => ({
                cells: [
                  is('secretary') ? (
                    <a href={`#/person/${r.p}`}>{L(person(r.p)?.lat || r.p, person(r.p)?.ar || r.p)}</a>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-dense" data-attendance-history={r.p}>
                      {L(person(r.p)?.lat || r.p, person(r.p)?.ar || r.p)}
                    </button>
                  ),
                  <span className="dim">{L(r.role, r.roleAr)}</span>,
                  <span className="mono dim">{r.joined}</span>,
                  is('secretary') ? (
                    <span dir="ltr">{person(r.p)?.phone || '—'}</span>
                  ) : (
                    <span className="num">{memberAttendancePct(d.meetings, r.p)}</span>
                  ),
                  <span className="rowacts">
                    {is('secretary') ? (
                      ''
                    ) : (
                      <button className="btn btn-secondary btn-dense" data-roster-formation={r.p}>
                        {L('Formation', 'التنشئة')}
                      </button>
                    )}
                    {!is('leader') ? (
                      <C.IconBtn ico="msg" label={L('Message', 'مراسلة')} data-act={`compose:${r.p}`} />
                    ) : (
                      ''
                    )}
                    <C.IconBtn ico="dots" label={L('More', 'المزيد')} data-act={`member-menu:${r.p}`} />
                  </span>
                ]
              }))}
          />
        </div>
      </>
    ),
    attendance: () => attendanceMatrix(g, d),
    meetings: () => {
      const today = iso(new Date());
      const direction = S.ui.meetingReverse ? -1 : 1;
      const upcoming = d.meetings.filter(m => !m.done && m.d >= today).sort((a, b) => direction * byTime(a, b));
      const earlier = d.meetings.filter(m => m.done || m.d < today).sort((a, b) => direction * byTime(a, b));
      const calendar = S.ui.meetingView === 'calendar';
      const monthKey = S.ui.meetingMonth || today.slice(0, 7),
        [year, monthNumber] = monthKey.split('-').map(Number);
      const first = new Date(year, monthNumber - 1, 1),
        days = new Date(year, monthNumber, 0).getDate(),
        offset = first.getDay();
      const monthLabel = new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-US', { month: 'long', year: 'numeric' }).format(
        first
      );
      return (
        <>
          <div className="meeting-overview">
            <div>
              <h2>{L('Ministry meetings', 'اجتماعات الخدمة')}</h2>{' '}
              <p className="t-caption dim">
                {is('secretary')
                  ? L(
                      'View and arrange group meetings, dates and places.',
                      'اعرض ونظّم اجتماعات المجموعة ومواعيدها وأماكنها.'
                    )
                  : L(
                      'Plan meetings, follow replies, and record attendance in one place.',
                      'خطّط للاجتماعات وتابع الردود وسجّل الحضور في مكان واحد.'
                    )}
              </p>
            </div>{' '}
            <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary btn-dense"
                data-meeting-order=""
                title={L('Reverse meeting date order', 'عكس ترتيب الاجتماعات')}
              >
                <Icon name="sort" size={15} />
                {L(
                  S.ui.meetingReverse ? 'Newest first' : 'Oldest first',
                  S.ui.meetingReverse ? 'الأحدث أولاً' : 'الأقدم أولاً'
                )}
              </button>{' '}
              <div className="seg">
                <button data-meeting-view="list" aria-pressed={!calendar}>
                  {L('List', 'قائمة')}
                </button>
                <button data-meeting-view="calendar" aria-pressed={calendar}>
                  {L('Calendar', 'رزنامة')}
                </button>
              </div>{' '}
              <button className="btn btn-primary" data-act="meeting-new">
                <Icon name="plus" size={17} />
                {L('Add meeting', 'إضافة اجتماع')}
              </button>
            </div>
          </div>{' '}
          {!d.meetings.length ? (
            <Empty
              glyph="events"
              title={L('No meetings yet', 'لا اجتماعات بعد')}
              body={L('Add the first meeting for this ministry.', 'أضف أول اجتماع لهذه الخدمة.')}
            />
          ) : (
            ''
          )}{' '}
          {calendar ? (
            <>
              <div className="toolbar">
                <button
                  className="btn btn-secondary btn-dense"
                  data-meeting-month="-1"
                  aria-label={L('Previous month', 'الشهر السابق')}
                >
                  <Icon name="chevL" size={16} />
                </button>
                <b>{monthLabel}</b>
                <button
                  className="btn btn-secondary btn-dense"
                  data-meeting-month="1"
                  aria-label={L('Next month', 'الشهر التالي')}
                >
                  <Icon name="chevR" size={16} />
                </button>
              </div>{' '}
              <div className="ministry-calendar-scroll">
                <div className="cal ministry-calendar">
                  <div className="cal-head">
                    {Array.from({ length: 7 }, (_, i) => (
                      <div>
                        {new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-US', { weekday: 'short' }).format(
                          new Date(2026, 9, 4 + i)
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="cal-grid">
                    {Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => {
                      const day = new Date(year, monthNumber - 1, i - offset + 1),
                        date = iso(day),
                        outside = day.getMonth() !== monthNumber - 1;
                      const items = d.meetings.filter(m => m.d === date).sort(byTime);
                      return (
                        <div className={`cal-day${outside ? ' out' : ''}${date === today ? ' today' : ''}`}>
                          <span className="dn">{day.getDate()}</span>
                          {items.map((m, k) => (
                            <button
                              key={k}
                              className="cal-ev ministry-calendar-event"
                              data-meeting-edit={meetingId(m)}
                              title={m.title || L('Group meeting', 'اجتماع المجموعة')}
                            >
                              <span>{m.title || L('Group meeting', 'اجتماع المجموعة')}</span>
                              <small>
                                {m.t} · {meetingKind(m)}
                              </small>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {upcoming.length ? (
                <section className="meeting-section">
                  <div className="meeting-section-title">
                    <h3>{L('Upcoming', 'القادمة')}</h3>
                    <span className="badge badge-quiet">{upcoming.length}</span>
                  </div>
                  {upcoming.map((m, i) => (
                    <Fragment key={i}>{meetingCard(g, m)}</Fragment>
                  ))}
                </section>
              ) : (
                ''
              )}{' '}
              {earlier.length ? (
                <section className="meeting-section">
                  <div className="meeting-section-title">
                    <h3>{L('Earlier meetings', 'الاجتماعات السابقة')}</h3>
                    <span className="badge badge-quiet">{earlier.length}</span>
                  </div>
                  {earlier.map((m, i) => (
                    <Fragment key={i}>{meetingCard(g, m)}</Fragment>
                  ))}
                </section>
              ) : (
                ''
              )}
            </>
          )}
        </>
      );
    },
    posts: () => (
      <div className="splitview">
        <div className="stack" style={{ gap: '16px' }}>
          <Panel title={L('Announcements', 'الإعلانات')}>
            <C.RichText body="" />{' '}
            <button className="btn btn-primary btn-dense" style={{ margin: '12px 0' }} data-act="post-add">
              {L('Post', 'نشر')}
            </button>
            <div className="divider" />
            {d.posts.map((p, i) => (
              <div key={i} className="group-announcement">
                <div className="row" style={{ gap: '10px' }}>
                  <Avatar p={person(p.by)} cls="avatar-sm" />{' '}
                  <span>
                    <b style={{ font: '500 13px/18px var(--sans)' }}>{isAr() ? person(p.by).ar : person(p.by).lat}</b>{' '}
                    <small className="t-caption dim" style={{ display: 'block' }}>
                      {fmtDate(p.at)}
                    </small>
                  </span>
                </div>{' '}
                <div className="t-body" style={{ fontSize: '14px', marginTop: '10px' }}>
                  {p.html ? safeRichText(p.html) : L(p.body, p.bodyAr)}
                </div>
              </div>
            ))}
          </Panel>
        </div>{' '}
        <div className="sidecol">
          <Panel title={L('Files and learning resources', 'الملفات وموارد التنشئة')}>
            {d.files.map(([en, ar, size], i) => (
              <div key={i} className="listrow" style={{ paddingInline: 0 }}>
                <Icon name="doc" size={17} cls="dimmer" />{' '}
                <span className="grow">
                  <b>{isAr() ? ar : en}</b>
                  <small className="mono">
                    {size} · {L('Legacy reference; ask the office for the file', 'مرجع قديم؛ اطلب الملف من المكتب')}
                  </small>
                </span>
              </div>
            ))}
            <div className="divider" />
            <div className="group-upload">
              <C.Dropzone id="gfiles" scope="group" ownerId={g.id} />
            </div>
          </Panel>
        </div>
      </div>
    ),
    belongings: () => (
      <>
        <div className="toolbar">
          <p className="t-caption dim">
            {L('Track ministry-owned items and who has borrowed them.', 'تابع مقتنيات الخدمة ومن استعارها.')}
          </p>{' '}
          <button className="btn btn-primary btn-dense" data-resource-new="">
            <Icon name="plus" size={15} />
            {L('Add item', 'إضافة صنف')}
          </button>
        </div>{' '}
        <div className="toolbar ministry-filters">
          <input
            className="input"
            type="search"
            data-resource-search=""
            placeholder={L('Search items and locations', 'البحث في الأصناف والأماكن')}
            defaultValue={S.ui.resourceQuery || ''}
          />
          <button className="btn btn-secondary btn-dense" data-resource-search-button="">
            {L('Search', 'بحث')}
          </button>
          <Select data-resource-filter="" aria-label={L('Filter resources', 'تصفية الموارد')}>
            <option value="all">{L('All items', 'كل الأصناف')}</option>
            <option value="available">{L('Available', 'متاح')}</option>
            <option value="loaned">{L('On loan', 'مُعار')}</option>
          </Select>
        </div>{' '}
        <Paged className="gridcards resource-cards">
          {nodesOr(
            d.belongings
              .filter(r => {
                const q = (S.ui.resourceQuery || '').toLocaleLowerCase(),
                  lent = r.lent || 0,
                  filter = S.ui.resourceFilter || 'all';
                return (
                  `${r.name} ${r.ar} ${r.location} ${r.locationAr} ${r.code || ''} ${r.description || ''}`
                    .toLocaleLowerCase()
                    .includes(q) &&
                  (filter === 'all' || (filter === 'available' && r.qty > lent) || (filter === 'loaned' && lent > 0))
                );
              })
              .map((r, i) => {
                const lent = r.lent || 0;
                return (
                  <section key={i} className="panel">
                    <div className="panel-b">
                      <h3 className="resource-name">
                        <span>{r.name}</span>
                        <span className="dim" lang="ar" dir="rtl">
                          {r.ar || ''}
                        </span>
                      </h3>{' '}
                      <p>
                        <b>
                          {r.qty - lent} / {r.qty}
                        </b>{' '}
                        {L('available', 'متاح')} {r.condition ? `· ${r.condition}` : ''}
                      </p>
                      <p>
                        {L('Stored at', 'محفوظ في')}: <span>{r.location || '—'}</span>{' '}
                        <span className="dim" lang="ar" dir="rtl">
                          {r.locationAr || ''}
                        </span>
                      </p>{' '}
                      {r.code ? (
                        <p>
                          {L('Inventory code', 'رمز الجرد')}: <b>{r.code}</b>
                        </p>
                      ) : (
                        ''
                      )}
                      {r.description ? (
                        <p className="t-caption dim" style={{ margin: '8px 0' }}>
                          {r.description}
                        </p>
                      ) : (
                        ''
                      )}{' '}
                      <div className="row" style={{ gap: '6px', flexWrap: 'wrap' }}>
                        <C.IconBtn ico="edit" label={L('Edit', 'تعديل')} data-resource-edit={r.id} />
                        <C.IconBtn ico="trash" label={L('Delete', 'حذف')} data-resource-delete={r.id} />
                        <button
                          className="btn btn-secondary btn-dense"
                          data-resource-lend={r.id}
                          disabled={!!(r.qty - lent < 1)}
                        >
                          {L('Lend', 'إعارة')}
                        </button>
                      </div>
                    </div>
                  </section>
                );
              }),
            <p className="help">{L('No matching resources.', 'لا موارد مطابقة.')}</p>
          )}
        </Paged>{' '}
        <h3 style={{ margin: '24px 0 10px' }}>{L('Loans', 'الإعارات')}</h3>{' '}
        <Table
          cols={[
            { label: L('Item', 'الصنف') },
            { label: L('Borrower', 'المستعير') },
            { label: L('Quantity', 'العدد'), cls: 'num' },
            { label: L('Due date', 'تاريخ الإرجاع') },
            { label: L('Status', 'الحالة') },
            { label: '', cls: 'shrink' }
          ]}
          rows={d.resourceLoans
            .slice()
            .reverse()
            .map(l => ({
              cells: [
                L(
                  d.belongings.find(r => r.id === l.resourceId)?.name || '—',
                  d.belongings.find(r => r.id === l.resourceId)?.ar || '—'
                ),
                L(person(l.personId)?.lat || '—', person(l.personId)?.ar || person(l.personId)?.lat || '—'),
                String(l.qty),
                l.due ? fmtDate(l.due) : '—',
                <Pill
                  label={
                    l.overdue
                      ? L('Overdue', 'متأخر')
                      : L(LOAN_STATUS[l.status]?.[0] || l.status, LOAN_STATUS[l.status]?.[1] || l.status)
                  }
                  tone={l.overdue || l.followUp ? 'danger' : l.status === 'Issued' ? 'warning' : ''}
                />,
                <span className="row" style={{ gap: '6px' }}>
                  {loanSteps(l).map(([action, en, ar]) => (
                    <button key={action} className="btn btn-secondary btn-dense" data-loan-step={`${l.id}|${action}`}>
                      {L(en, ar)}
                    </button>
                  ))}
                </span>
              ]
            }))}
        />
      </>
    ),
    tasks: () => (
      <div className="ministry-tasks">
        <div className="toolbar ministry-section-heading">
          <h2>{L('Notes, tasks and follow-ups', 'الملاحظات والمهام والمتابعات')}</h2>
          <button className="btn btn-primary btn-dense" data-group-task-new="">
            <Icon name="plus" size={15} />
            {L('Add item', 'إضافة عنصر')}
          </button>
        </div>{' '}
        <div className="toolbar ministry-filters">
          <input
            className="input"
            type="search"
            data-group-task-search=""
            placeholder={L('Search notes and tasks', 'البحث في الملاحظات والمهام')}
            defaultValue={S.ui.groupTaskQuery || ''}
          />
          <Select data-group-task-filter="">
            <option value="all">{L('All', 'الكل')}</option>
            <option value="pinned">{L('Pinned', 'مثبّتة')}</option>
            <option value="pending">{L('Pending tasks', 'مهام معلّقة')}</option>
            <option value="done">{L('Completed', 'مكتملة')}</option>
          </Select>
        </div>{' '}
        <Panel title="" tight={true}>
          {nodesOr(
            d.tasks
              .map((tk, ki) => ({ ...tk, index: ki }))
              .filter(tk => {
                const q = (S.ui.groupTaskQuery || '').toLocaleLowerCase(),
                  filter = S.ui.groupTaskFilter || 'all';
                return (
                  `${tk.what} ${tk.whatAr || ''}`.toLocaleLowerCase().includes(q) &&
                  (filter === 'all' ||
                    (filter === 'pinned' && tk.pinned) ||
                    (filter === 'pending' && !tk.done && tk.kind !== 'note') ||
                    (filter === 'done' && tk.done))
                );
              })
              .sort(
                (a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (a.due || '9999').localeCompare(b.due || '9999')
              )
              .map((tk, i) => (
                <div key={i} className="listrow pastoral-row" style={{ paddingInline: 0 }}>
                  <button
                    className="btn-icon"
                    data-group-task-done={tk.index}
                    disabled={!!(tk.kind === 'note')}
                    aria-label={L('Toggle complete', 'تغيير حالة الإنجاز')}
                  >
                    <Icon name={tk.kind === 'note' ? 'notes' : 'check'} size={17} />
                  </button>
                  <span className="grow">
                    <b style={css(tk.done ? 'text-decoration:line-through' : '')}>{L(tk.what, tk.whatAr || tk.what)}</b>
                    <small>
                      {tk.kind === 'note' ? L('Note', 'ملاحظة') : L('Task', 'مهمة')}
                      {tk.due ? ` · ${L('Due', 'حتى')} ${fmtDate(tk.due)}` : ''}
                      {tk.who ? ` · ${person(tk.who)?.lat || ''}` : ''}
                    </small>
                  </span>
                  <button
                    className="btn-icon"
                    data-group-task-pin={tk.index}
                    aria-pressed={!!tk.pinned}
                    aria-label={L(tk.pinned ? 'Unpin' : 'Pin', tk.pinned ? 'إلغاء التثبيت' : 'تثبيت')}
                  >
                    <Icon name="pin" size={17} />
                  </button>
                  <button className="btn btn-secondary btn-dense" data-group-task-edit={tk.index}>
                    {L('Edit', 'تعديل')}
                  </button>
                  <button className="btn-icon" data-group-task-delete={tk.index} aria-label={L('Delete', 'حذف')}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              )),
            <p className="help">{L('No matching items.', 'لا عناصر مطابقة.')}</p>
          )}
        </Panel>
      </div>
    ),
    formation: () => (
      <>
        <C.InlineAlert
          tone="info"
          title={L('Formation records, not rankings', 'سجلات تنشئة، لا تصنيفات')}
          body={L(
            'Record each member’s completion date and notes. Earlier totals without names remain labelled as historical.',
            'سجّل تاريخ إنجاز كل عضو وملاحظاته. تبقى المجاميع القديمة غير المرتبطة بأسماء موسومة كتاريخية.'
          )}
        />{' '}
        {d.formation?.draft ? (
          <C.InlineAlert
            tone="warning"
            title={L('Draft program', 'مسودة برنامج')}
            body={L(
              'These milestones are a draft. New evidence uses the approved program until a priest approves the draft.',
              'هذه المحطات مسودة. يُستخدم البرنامج المعتمد للإثباتات الجديدة إلى أن يعتمد الكاهن المسودة.'
            )}
          />
        ) : (
          ''
        )}
        <div className="toolbar" style={{ margin: '16px 0' }}>
          <span className="t-caption dim">
            {d.milestones.length} {L('milestones', 'محطات')}
          </span>{' '}
          {d.formation?.draft && is('priest') ? (
            <button className="btn btn-secondary btn-dense" data-formation-approve="">
              {L('Approve program', 'اعتماد البرنامج')}
            </button>
          ) : (
            ''
          )}{' '}
          <button className="btn btn-primary btn-dense" data-formation-new="">
            <Icon name="plus" size={15} />
            {L('Add milestone', 'إضافة محطة')}
          </button>
        </div>{' '}
        {d.roster.length && d.milestones.length ? (
          <details className="panel formation-progress" style={{ margin: '12px 0' }}>
            <summary className="panel-h">
              <b>{L('Member progress', 'تقدّم الأعضاء')}</b>
              <span className="more">
                {L('View members', 'عرض الأعضاء')} <Icon name="chevD" size={14} />
              </span>
            </summary>
            <div className="panel-b">
              <Table
                cols={[
                  { label: L('Member', 'العضو') },
                  { label: L('Completed', 'المنجَز'), cls: 'num' },
                  { label: L('Still open', 'المتبقي'), cls: 'num' }
                ]}
                rows={d.roster.map(r => {
                  const active = d.milestones.filter(m => !m.archived),
                    count = active.filter(m => m.completions?.[r.p]).length;
                  return {
                    cells: [
                      L(person(r.p)?.lat || r.p, person(r.p)?.ar || r.p),
                      `${count} / ${active.length}`,
                      String(active.length - count)
                    ]
                  };
                })}
              />
            </div>
          </details>
        ) : (
          ''
        )}{' '}
        <Paged className="gridcards formation-cards">
          {nodesOr(
            d.milestones
              .filter(m => !m.archived)
              .map((m, i) => {
                const names = Object.entries(m.completions || {}).sort((a, b) => a[1].date.localeCompare(b[1].date));
                return (
                  <Panel
                    key={i}
                    title={L(m.name, m.ar)}
                    more={
                      <>
                        {
                          <C.IconBtn
                            ico="edit"
                            label={L('Edit milestone', 'تعديل المحطة')}
                            data-formation-edit={m.id}
                          />
                        }
                        {
                          <C.IconBtn
                            ico="trash"
                            label={L('Delete milestone', 'حذف المحطة')}
                            data-formation-delete={m.id}
                          />
                        }
                      </>
                    }
                  >
                    <p className="t-caption dim">{L(m.description, m.descriptionAr)}</p>{' '}
                    {Object.entries(m.progress || {})
                      .filter(([, x]) => ['EvidenceSubmitted', 'Reviewed', 'NeedsInformation'].includes(x.status))
                      .map(([pid, x], i) => (
                        <div key={'p' + i} className="listrow" style={{ paddingInline: 0 }}>
                          <span className="grow">
                            <b>{L(person(pid)?.lat || '—', person(pid)?.ar || person(pid)?.lat || '—')}</b>{' '}
                            <small>
                              {x.status === 'NeedsInformation'
                                ? L('Needs information', 'بحاجة إلى معلومات')
                                : L('Awaiting review', 'بانتظار المراجعة')}
                            </small>
                          </span>
                          {x.status !== 'NeedsInformation' ? (
                            <button className="btn btn-secondary btn-dense" data-formation-review={`${m.id}|${pid}`}>
                              {L('Review', 'مراجعة')}
                            </button>
                          ) : (
                            ''
                          )}
                        </div>
                      ))}
                    <div className="row" style={{ gap: '8px', flexWrap: 'wrap', margin: '10px 0' }}>
                      <Pill label={`${names.length} ${L('named completions', 'إنجازات بالأسماء')}`} tone="success" />{' '}
                      {m.legacyCount ? (
                        <Pill
                          label={`${m.legacyCount} ${L('historical, unassigned', 'تاريخية بلا أسماء')}`}
                          tone="warning"
                        />
                      ) : (
                        ''
                      )}
                    </div>{' '}
                    {names.length ? (
                      `<details><summary>${L('View completions', 'عرض الإنجازات')} · ${names.length}</summary>` +
                      names.map(([pid, record], i) => (
                        <div key={i} className="listrow" style={{ paddingInline: 0 }}>
                          <span className="grow">
                            <b>{L(person(pid)?.lat || pid, person(pid)?.ar || pid)}</b>{' '}
                            <small>
                              {fmtDate(record.date)}
                              {record.notes ? ` · ${record.notes}` : ''}
                            </small>
                          </span>{' '}
                          {is('priest') ? (
                            <C.IconBtn
                              ico="trash"
                              label={L('Reopen completion', 'إعادة فتح الإنجاز')}
                              data-formation-remove={`${m.id}|${pid}`}
                            />
                          ) : (
                            ''
                          )}
                        </div>
                      )) +
                      '</details>'
                    ) : (
                      <p className="t-caption dim">{L('No named completions yet.', 'لا إنجازات بأسماء بعد.')}</p>
                    )}{' '}
                    <div className="formation-card-actions">
                      <button className="btn btn-secondary btn-dense" data-formation-record={m.id}>
                        <Icon name="plus" size={15} />
                        {L('Record evidence', 'تسجيل إثبات')}
                      </button>
                    </div>
                  </Panel>
                );
              }),
            <Empty
              glyph="doc"
              title={L('No formation milestones', 'لا محطات تنشئة')}
              body={L('Add the first training milestone.', 'أضف أول محطة تدريب.')}
            />
          )}
        </Paged>
      </>
    ),
    history: () => (
      <div style={{ maxWidth: '720px' }}>
        <Panel title={L('Membership and leadership history', 'سجل العضوية والمسؤوليات')}>
          <div className="timeline">
            {d.history.map(([en, ar, when], i) => (
              <div key={i} className="tl-item">
                <div className="when">{fmtDate(when)}</div>
                <div className="what">{L(en, ar)}</div>
              </div>
            ))}
          </div>{' '}
          <div className="divider" />{' '}
          <p className="t-caption dim">
            {L(
              'A leadership handover moves the role, not the person’s history. Ongoing tasks follow the role to whoever takes it, and the permission review runs automatically.',
              'تسليم المسؤولية ينقل الدور لا تاريخ الشخص. والمهام الجارية تتبع الدور إلى من يتسلّمه، وتُراجَع الصلاحيات تلقائياً.'
            )}
          </p>
        </Panel>
      </div>
    )
  };
  return (
    <>
      {head}
      <div className="ministry-content">{(T[tab] || T[''])()}</div>
    </>
  );
}

groups.mount = host => {
  const bindFilter = (selector, key) => {
    const el = host.querySelector(selector);
    if (!el) return;
    el.value = S.ui[key] || el.value;
    el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => {
      const caret = el.tagName === 'INPUT' ? el.selectionStart : 0;
      S.ui[key] = el.value;
      bus.refresh();
      if (el.tagName === 'INPUT') {
        const next = host.querySelector(selector);
        next?.focus();
        next?.setSelectionRange(caret, caret);
      }
    });
  };
  bindFilter('[data-roster-search]', 'rosterQuery');
  bindFilter('[data-roster-filter]', 'rosterFilter');
  bindFilter('[data-resource-search]', 'resourceQuery');
  bindFilter('[data-resource-filter]', 'resourceFilter');
  host
    .querySelector('[data-resource-search-button]')
    ?.addEventListener('click', () => host.querySelector('[data-resource-search]')?.focus());
  bindFilter('[data-group-task-search]', 'groupTaskQuery');
  bindFilter('[data-group-task-filter]', 'groupTaskFilter');
  host.querySelector('[data-attendance-order]')?.addEventListener('click', () => {
    S.ui.attendanceReverse = !S.ui.attendanceReverse;
    bus.refresh();
  });
  host.querySelector('[data-meeting-order]')?.addEventListener('click', () => {
    S.ui.meetingReverse = !S.ui.meetingReverse;
    bus.refresh();
  });
  host.querySelectorAll('[data-meeting-view]').forEach(b =>
    b.addEventListener('click', () => {
      S.ui.meetingView = b.dataset.meetingView;
      bus.refresh();
    })
  );
  host.querySelectorAll('[data-meeting-month]').forEach(b =>
    b.addEventListener('click', () => {
      const [y, m] = (S.ui.meetingMonth || iso(new Date()).slice(0, 7)).split('-').map(Number),
        date = new Date(y, m - 1 + Number(b.dataset.meetingMonth), 1);
      S.ui.meetingMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      bus.refresh();
    })
  );
  host.querySelectorAll('[data-roster-formation]').forEach(b =>
    b.addEventListener('click', () => {
      const d = groupInfo(S.params[0]),
        pid = b.dataset.rosterFormation,
        p = person(pid);
      openDrawer({
        title: L(p?.lat || pid, p?.ar || pid),
        sub: L('Formation progress', 'تقدّم التنشئة'),
        body: nodesOr(
          d.milestones
            .filter(m => !m.archived)
            .map((m, i) => (
              <div key={i} className="listrow">
                <span className="grow">
                  <b>{L(m.name, m.ar)}</b>
                  <small>
                    {m.completions?.[pid]
                      ? `${L('Completed', 'مكتمل')} · ${fmtDate(m.completions[pid].date)}`
                      : L('Not completed', 'لم يكتمل')}
                  </small>
                </span>
              </div>
            )),
          <p>{L('No formation milestones yet.', 'لا محطات تنشئة بعد.')}</p>
        ),
        foot: (
          <button className="btn btn-secondary" data-close="">
            {L('Close', 'إغلاق')}
          </button>
        )
      });
    })
  );
  host.querySelector('[data-group-task-new]')?.addEventListener('click', () => groupTaskForm());
  host
    .querySelectorAll('[data-group-task-edit]')
    .forEach(b => b.addEventListener('click', () => groupTaskForm(Number(b.dataset.groupTaskEdit))));
  for (const [selector, field] of [
    ['[data-group-task-pin]', 'pinned'],
    ['[data-group-task-done]', 'done']
  ])
    host.querySelectorAll(selector).forEach(b =>
      b.addEventListener('click', async () => {
        const item = groupInfo(S.params[0]).tasks[Number(b.dataset.groupTaskPin ?? b.dataset.groupTaskDone)];
        if (item) {
          item[field] = !item[field];
          if (await persist()) bus.refresh();
        }
      })
    );
  host.querySelectorAll('[data-group-task-delete]').forEach(b =>
    b.addEventListener('click', () => {
      const d = groupInfo(S.params[0]),
        i = Number(b.dataset.groupTaskDelete),
        item = d.tasks[i];
      if (item)
        openModal({
          title: L('Delete item?', 'حذف العنصر؟'),
          body: <p>{L(item.what, item.whatAr || item.what)}</p>,
          foot: (
            <>
              <button className="btn btn-secondary" data-close="">
                {L('Cancel', 'إلغاء')}
              </button>
              <button className="btn btn-danger" id="group-task-confirm">
                {L('Delete', 'حذف')}
              </button>
            </>
          ),
          onMount(el) {
            el.querySelector('#group-task-confirm').addEventListener('click', async () => {
              d.tasks.splice(i, 1);
              if (!(await persist())) return;
              closeOverlays();
              bus.refresh();
            });
          }
        });
    })
  );
  host.querySelector('[data-resource-new]')?.addEventListener('click', () => resourceForm());
  host
    .querySelectorAll('[data-resource-edit]')
    .forEach(b => b.addEventListener('click', () => resourceForm(b.dataset.resourceEdit)));
  host
    .querySelectorAll('[data-resource-delete]')
    .forEach(b => b.addEventListener('click', () => resourceDelete(b.dataset.resourceDelete)));
  host
    .querySelectorAll('[data-resource-lend]')
    .forEach(b => b.addEventListener('click', () => resourceLend(b.dataset.resourceLend)));
  host
    .querySelectorAll('[data-resource-loan-edit]')
    .forEach(b => b.addEventListener('click', () => resourceLoanEdit(b.dataset.resourceLoanEdit)));
  host
    .querySelectorAll('[data-loan-step]')
    .forEach(b => b.addEventListener('click', () => resourceLoanEdit(...b.dataset.loanStep.split('|'))));
  host.querySelector('[data-formation-approve]')?.addEventListener('click', () => formationApprove());
  host
    .querySelectorAll('[data-formation-review]')
    .forEach(b => b.addEventListener('click', () => formationReview(...b.dataset.formationReview.split('|'))));
  host
    .querySelectorAll('[data-leader-end]')
    .forEach(b => b.addEventListener('click', () => leaderEnd(S.params[0], b.dataset.leaderEnd)));
  host.querySelector('[data-formation-new]')?.addEventListener('click', () => formationForm());
  host
    .querySelectorAll('[data-formation-edit]')
    .forEach(b => b.addEventListener('click', () => formationForm(b.dataset.formationEdit)));
  host
    .querySelectorAll('[data-formation-delete]')
    .forEach(b => b.addEventListener('click', () => formationDelete(b.dataset.formationDelete)));
  host.querySelectorAll('[data-formation-record]').forEach(b =>
    b.addEventListener('click', () => {
      const [mid, pid = ''] = b.dataset.formationRecord.split('|');
      formationRecord(mid, pid);
    })
  );
  host.querySelectorAll('[data-formation-remove]').forEach(b =>
    b.addEventListener('click', () => {
      const [mid, pid] = b.dataset.formationRemove.split('|');
      formationReview(mid, pid, true);
    })
  );
  host.querySelectorAll('[data-attendance-shift]').forEach(b =>
    b.addEventListener('click', () => {
      const d =
        groupInfo(S.params[0])
          .meetings.slice()
          .sort((a, b) => b.d.localeCompare(a.d))[0]
          ?.d?.slice(0, 7) || iso(TODAY).slice(0, 7);
      const [y, m] = (S.ui.attendancePeriod || d).split('-').map(Number),
        next = new Date(y, m - 1 + Number(b.dataset.attendanceShift), 1);
      S.ui.attendancePeriod = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
      bus.refresh();
    })
  );
  host.querySelector('[data-attendance-search]')?.addEventListener('input', e => {
    const query = e.target.value.trim().toLowerCase();
    host.querySelectorAll('[data-attendance-member]').forEach(row => {
      row.hidden = !row.dataset.attendanceMember.includes(query);
    });
  });
  host.querySelector('[data-attendance-import]')?.addEventListener('click', () => attendanceImport(S.params[0]));
  host.querySelector('[data-attendance-export]')?.addEventListener('click', () => attendanceExport(S.params[0]));
  host.querySelector('[data-attendance-print]')?.addEventListener('click', () => attendancePrint(S.params[0]));
  host.querySelectorAll('[data-attendance]').forEach(button =>
    button.addEventListener('click', () => {
      const [mid, pid] = button.dataset.attendance.split('|'),
        meeting = groupInfo(S.params[0]).meetings.find(m => meetingId(m) === mid);
      if (meeting) chooseAttendance(button, meeting, pid);
    })
  );
  host.querySelectorAll('[data-attendance-history]').forEach(b =>
    b.addEventListener('click', () => {
      const pid = b.dataset.attendanceHistory,
        p = person(pid),
        rows = groupInfo(S.params[0])
          .meetings.slice()
          .sort((a, c) => c.d.localeCompare(a.d));
      const values = rows.map(m => attendanceValue(m, pid)).filter(Boolean);
      const present = values.filter(v => v === 'present').length,
        excused = values.filter(v => v === 'excused').length,
        absent = values.filter(v => v === 'absent').length;
      openDrawer({
        title: L(p?.lat || pid, p?.ar || pid),
        sub: L('Individual attendance tracking', 'متابعة الحضور الفردي'),
        body: (
          <>
            <div className="attendance-person-stats">
              {attendanceTag('present', present)}
              {attendanceTag('excused', excused)}
              {attendanceTag('absent', absent)}{' '}
              <span className="t-caption dim">
                {values.length ? `${Math.round((present / values.length) * 100)}%` : '—'}{' '}
                {L('present among recorded meetings', 'حاضر من الاجتماعات المسجّلة')}
              </span>
            </div>
            {rows.map((m, i) => (
              <div key={i} className="listrow" style={{ paddingInline: 0 }}>
                <span className="grow">
                  {fmtDate(m.d)} · {m.t}
                </span>{' '}
                {attendanceTag(attendanceValue(m, pid))}
              </div>
            ))}
          </>
        ) || <p>{L('No meetings yet', 'لا اجتماعات بعد')}</p>,
        foot: (
          <button className="btn btn-secondary" data-close="">
            {L('Close', 'إغلاق')}
          </button>
        )
      });
    })
  );
  host
    .querySelectorAll('[data-meeting-review]')
    .forEach(b => b.addEventListener('click', () => meetingReview(b.dataset.meetingReview)));
  host
    .querySelectorAll('[data-meeting-edit]')
    .forEach(b => b.addEventListener('click', () => meetingEdit(b.dataset.meetingEdit)));
  host.querySelectorAll('[data-meeting-confirm]').forEach(b =>
    b.addEventListener('click', async () => {
      const meeting = groupInfo(S.params[0]).meetings.find(m => meetingId(m) === b.dataset.meetingConfirm);
      if (!meeting) return;
      meeting.status = 'Confirmed';
      if (await persist()) bus.refresh();
    })
  );
  host
    .querySelectorAll('[data-lifecycle]')
    .forEach(b => b.addEventListener('click', () => lifecycleStep(...b.dataset.lifecycle.split('|'))));
  host
    .querySelectorAll('[data-task]')
    .forEach(c => c.addEventListener('change', () => VERBS['task-toggle'](c, c.dataset.task)));
  host.querySelector('#qr')?.addEventListener('click', () =>
    openModal({
      title: L('Group signup code', 'رمز انتساب المجموعة'),
      sub: L(
        'A revocable link that opens a controlled registration flow. It is not a way into anyone’s record.',
        'رابط قابل للإلغاء يفتح مسار تسجيل مضبوطاً. وليس مدخلاً إلى سجل أحد.'
      ),
      body: (
        <>
          <div style={{ display: 'grid', placeItems: 'center', padding: '8px 0' }}>
            <div
              style={{
                width: '150px',
                height: '150px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-card)',
                display: 'grid',
                placeItems: 'center',
                background: 'var(--muted)',
                color: 'var(--text-3)'
              }}
            >
              <Icon name="qr" size={64} />
            </div>
          </div>{' '}
          <div className="formgrid" style={{ marginTop: '16px' }}>
            <div className="formrow">
              <label className="label" htmlFor="gq_expires">
                {L('Expires', 'ينتهي')}
              </label>{' '}
              <Select id="gq_expires">
                <option>{L('In 7 days', 'بعد ٧ أيام')}</option>
                <option>{L('In 30 days', 'بعد ٣٠ يوماً')}</option>
                <option>{L('Never', 'أبداً')}</option>
              </Select>
            </div>{' '}
            <C.Stepper label={L('Capacity', 'السعة')} value={30} id="qrcap" />
          </div>{' '}
          <C.CheckRow
            label={L('Require approval before someone joins', 'اشتراط الموافقة قبل الانتساب')}
            checked={true}
          />
        </>
      ),
      foot: (
        <>
          <button className="btn btn-danger-quiet" data-act="qr-revoke">
            {L('Revoke code', 'إلغاء الرمز')}
          </button>{' '}
          <button className="btn btn-primary" style={{ marginInlineStart: 'auto' }} data-act="print">
            {L('Print', 'طباعة')}
          </button>
        </>
      ),
      onMount(el) {}
    })
  );
};

const LOAN_STATUS = {
  Requested: ['Requested', 'مطلوب'],
  Approved: ['Approved', 'موافق عليه'],
  Declined: ['Declined', 'مرفوض'],
  Cancelled: ['Cancelled', 'ملغى'],
  Issued: ['On loan', 'مُعار'],
  Returned: ['Returned', 'أُعيد'],
  ConditionChecked: ['Checked', 'تم الفحص'],
  Closed: ['Closed', 'مغلق']
};

function groupTaskForm(index = -1) {
  const d = groupInfo(S.params[0]),
    item = d.tasks[index];
  openDrawer({
    title: item ? L('Edit item', 'تعديل العنصر') : L('Add note or task', 'إضافة ملاحظة أو مهمة'),
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="gt_kind">
            {L('Type', 'النوع')}
          </label>
          <Select id="gt_kind" defaultValue={item?.kind === 'note' ? 'note' : 'task'}>
            <option value="task">{L('Task', 'مهمة')}</option>
            <option value="note">{L('Note', 'ملاحظة')}</option>
          </Select>
        </div>
        <C.Field label={L('Text', 'النص')} id="gt_what" value={item?.what || ''} req={true} />
        <C.Field label={L('Arabic text', 'النص العربي')} id="gt_ar" value={item?.whatAr || ''} />
        <div className="formgrid">
          <div className="formrow">
            <label className="label" htmlFor="gt_who">
              {L('Owner', 'المسؤول')}
            </label>
            <Select defaultValue={item?.who} id="gt_who">
              <option value="">—</option>
              {d.roster.map((r, i) => (
                <option key={i} value={r.p}>
                  {L(person(r.p)?.lat || r.p, person(r.p)?.ar || r.p)}
                </option>
              ))}
            </Select>
          </div>
          <C.Field label={L('Due date', 'تاريخ الاستحقاق')} id="gt_due" type="date" value={item?.due || ''} />
        </div>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="gt_save">
          {L('Save', 'حفظ')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#gt_save').addEventListener('click', async () => {
        const what = el.querySelector('#gt_what').value.trim();
        if (!what) return toast(L('Enter text', 'أدخل النص'), '', 'warning');
        const target = item || { id: `task-${Date.now().toString(36)}` };
        Object.assign(target, {
          kind: el.querySelector('#gt_kind').value,
          what,
          whatAr: el.querySelector('#gt_ar').value.trim() || what,
          who: el.querySelector('#gt_who').value,
          due: el.querySelector('#gt_due').value,
          done: target.done || false,
          pinned: target.pinned || false
        });
        if (!item) d.tasks.unshift(target);
        if (!(await persist())) return;
        closeOverlays();
        bus.refresh();
      });
    }
  });
}
