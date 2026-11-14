/* Purpose: checks the Member module against an in-memory stand-in for the routes it calls: the linked
   person, the member view model (ministries, meetings, RSVP, attendance, formation, volunteering,
   announcements, schedule, notifications, concerns, corrections, consents, own data, personal notes and
   tasks with pin, reminder and meeting link, the private RSVP reason, My resources and notification
   mutes), each action's request, the cross-parish "My parish life" calls, and the clergy's Notes & Tasks.
   Run with `npm run check` from frontend/. */
import assert from 'node:assert/strict';
import { json, mockApi, signedIn } from '../mock-api.mjs';

const dto = (value, version = 'v1') => ({ value, version });
const meetingStart = new Date(Date.now() + 3 * 86400000).toISOString();
const pastStart = new Date(Date.now() - 5 * 86400000).toISOString();
let noteVersion = 'n1';

const { sent } = mockApi((method, path, body) => {
  const [route, query = ''] = path.split('?');
  const get = r => method === 'GET' && route === r;
  if (get('parishes/P/person-account-links/mine'))
    return json(200, dto({ parishId: 'P', personId: 'person-1', accountId: 'u', active: true }));
  if (get('parishes/P/me/data'))
    return json(200, {
      personId: 'person-1',
      givenName: 'Nada',
      familyName: 'Haddad',
      birthDate: '1990-02-03',
      contact: '03 421 887',
      facts: { town: 'Hadath', addressDetail: 'Rue 4' },
      consents: [],
      records: { People: 1, Sacraments: 2 }
    });
  if (get('me/home'))
    return json(200, {
      homeState: 'Personal',
      unreadNotifications: 2,
      parishes: [
        {
          parishId: 'P',
          name: 'Saint Test',
          locality: 'Hadath',
          following: true,
          member: true,
          primary: true,
          unreadNotifications: 2
        }
      ]
    });
  if (get('me/parishes'))
    return json(200, [{ parishId: 'P', name: 'Saint Test', relationship: 'Member', primary: true }]);
  if (get('notifications'))
    return json(200, {
      items: [
        {
          id: 'no1',
          topic: 'concern.update',
          title: 'There is an update to your confidential case.',
          status: 'Unread',
          createdAt: '2026-11-01T10:00:00Z'
        },
        {
          id: 'no2',
          topic: 'ministry.meeting',
          title: 'Meeting moved',
          status: 'Read',
          createdAt: '2026-10-30T10:00:00Z'
        },
        { id: 'no3', topic: 'x', title: 'Old', status: 'Archived', createdAt: '2026-10-01T10:00:00Z' }
      ],
      continuationToken: null
    });
  if (get('parishes/P/me/consents'))
    return json(200, [
      dto(
        {
          id: 'c1',
          personId: 'person-1',
          kind: 'Photo',
          purpose: 'Bulletin',
          policyVersion: '1',
          status: 'Active',
          givenAt: '2026-10-01T00:00:00Z'
        },
        'cv1'
      )
    ]);
  if (get('parishes/P/me/data-closure-requests')) return json(200, []);
  if (get('parishes/P/membership-requests/mine')) return json(200, []);
  if (get('parishes/P/profile-corrections/mine'))
    return json(200, [
      dto(
        { id: 'pc1', personId: 'person-1', status: 'Pending', fields: [{ field: 'Contact', newValue: '03 111 222' }] },
        'pv1'
      )
    ]);
  if (get('parishes/P/announcements/mine'))
    return json(200, [
      {
        id: 'an1',
        title: 'Feast day',
        body: 'All welcome',
        ministryId: null,
        pinned: true,
        publishedAt: '2026-11-02T08:00:00Z'
      }
    ]);
  if (get('public/parishes/P/ministries'))
    return json(200, {
      items: [
        { id: 'G1', name: 'Choir', kind: 'Choir' },
        { id: 'G2', name: 'Youth', kind: 'Team' }
      ]
    });
  if (get('parishes/P/ministries/G1/membership/mine'))
    return json(200, { ministryId: 'G1', current: true, joinedAt: '2026-01-01T00:00:00Z' });
  if (get('parishes/P/ministries/G2/membership/mine')) return json(404);
  if (get('parishes/P/ministries/G1/meetings')) {
    const from = new URLSearchParams(query).get('start');
    const inPast = Date.parse(from) < Date.now() - 86400000;
    const inNext = !inPast && Date.parse(from) < Date.now() + 86400000;
    return json(200, {
      items: inPast
        ? [
            {
              id: 'm0',
              ministryId: 'G1',
              title: 'Rehearsal',
              startsAt: pastStart,
              timeZone: 'Asia/Beirut',
              status: 'Confirmed',
              rsvpOpen: false
            }
          ]
        : inNext
          ? [
              {
                id: 'm1',
                ministryId: 'G1',
                title: 'Planning',
                startsAt: meetingStart,
                timeZone: 'Asia/Beirut',
                locationDescription: 'Hall',
                agenda: 'Feast',
                status: 'Confirmed',
                rsvpOpen: true
              }
            ]
          : [],
      continuationToken: null
    });
  }
  if (get('parishes/P/ministries/G1/meetings/m0/attendance/mine'))
    return json(200, { meetingId: 'm0', status: 'Present' });
  if (get('parishes/P/ministries/G1/meetings/m1/rsvp'))
    return json(200, dto({ meetingId: 'm1', recorded: true, response: 'No', canChange: true }, 'rv1'));
  if (get('parishes/P/ministries/G1/meetings/m1/rsvp-private-reason'))
    return json(
      200,
      dto({ meetingId: 'm1', personId: 'person-1', reason: 'Travelling', cleared: false, canEdit: true }, 'rr1')
    );
  if (method === 'PUT' && route === 'parishes/P/ministries/G1/meetings/m1/rsvp-private-reason')
    return json(200, { meetingId: 'm1', reason: body.reason || null, cleared: !!body.clear });
  if (get('parishes/P/me/ministry-resources'))
    return json(200, {
      items: [
        {
          id: 'st1',
          ministryId: 'G9',
          ministryName: 'Hidden group',
          name: 'Hymnals',
          total: 4,
          onLoan: 1,
          available: 3,
          updatedAt: '2026-11-01T00:00:00Z'
        }
      ],
      truncated: false
    });
  if (get('notifications/preferences'))
    return json(200, { mutedTopics: ['community.news', 'request.update'], language: 'ar', digestOptional: true });
  if (method === 'PUT' && route === 'notifications/preferences') return json(200, body);
  if (get('me/notification-topics'))
    return json(200, [
      { topic: 'parish.broadcast', required: false, mutable: true },
      { topic: 'reports', required: false, mutable: true },
      { topic: 'request.update', required: true, mutable: false }
    ]);
  if (method === 'PUT' && route === 'parishes/P/ministries/G1/meetings/m1/rsvp')
    return json(200, { response: body.response });
  if (get('parishes/P/ministries/G1/formation/enrollments/mine'))
    return json(200, {
      items: [dto({ id: 'e1', programTitle: 'Altar servers', status: 'Active', completedAt: null })],
      continuationToken: null
    });
  if (get('parishes/P/ministries/G1/volunteering/opportunities/open'))
    return json(200, {
      items: [dto({ id: 'o1', title: 'Feast stall', position: 'Cook', startsAt: meetingStart, selfSignup: true })],
      continuationToken: null
    });
  if (get('parishes/P/ministries/G1/volunteering/assignments/mine'))
    return json(200, {
      items: [dto({ id: 'as1', opportunityId: 'o2', status: 'Confirmed' }, 'av1')],
      continuationToken: null
    });
  if (route.endsWith('/volunteering/opportunities/o1/assignments') && method === 'POST')
    return json(200, { id: 'as2' });
  if (route.endsWith('/volunteering/assignments/as1/actions') && method === 'POST') return json(200, { id: 'as1' });
  if (get('me/schedule'))
    return json(200, [
      {
        parishId: 'P',
        parishName: 'Saint Test',
        kind: 'Sacrament',
        sourceId: 's1',
        title: 'Baptism',
        startsAt: meetingStart,
        timeZone: 'Asia/Beirut',
        location: 'Church',
        status: 'Scheduled'
      }
    ]);
  if (get('me/personal-workspace'))
    return json(200, {
      items: [
        dto(
          {
            id: 'pn1',
            kind: 'Note',
            status: 'Saved',
            title: 'Retreat',
            body: 'Bring a book',
            category: 'Spiritual',
            tags: ['a'],
            pinned: true,
            reminderAt: '2026-12-24T00:00:00Z',
            meetingParishId: 'P',
            meetingMinistryId: 'G1',
            meetingId: 'mGone',
            updatedAt: '2026-11-01T00:00:00Z'
          },
          'pv1'
        ),
        dto(
          {
            id: 'pt1',
            kind: 'Task',
            status: 'Open',
            title: 'Call Mona',
            body: 'Call Mona',
            dueAt: '2026-11-20T00:00:00Z'
          },
          'tv1'
        ),
        dto({ id: 'pa1', kind: 'Note', status: 'Archived', title: 'Old', body: 'x', tags: [] }, 'av')
      ],
      continuationToken: null
    });
  if (method === 'POST' && route === 'me/personal-workspace') return json(200, dto({ id: 'new' }));
  if (method === 'PUT' && route.startsWith('me/personal-workspace/')) return json(200, dto({ id: 'pn1' }));
  if (method === 'POST' && route.startsWith('me/personal-workspace/') && route.endsWith('/actions'))
    return json(200, dto({ id: 'x' }));
  if (get('parishes/P/concerns/mine'))
    return json(200, [
      dto(
        {
          id: 'cn12345678',
          category: 'Other',
          urgency: 'Normal',
          summary: 'Noise',
          details: 'Loud',
          anonymous: true,
          status: 'Accepted',
          createdAt: '2026-11-01T00:00:00Z'
        },
        'cv1'
      )
    ]);
  if (get('parishes/P/concerns/cn12345678/entries'))
    return json(200, [
      { id: 'en1', kind: 'MessageToSubmitter', body: 'We are looking', fromReviewer: true, at: '2026-11-02T00:00:00Z' }
    ]);
  if (get('parishes/P/concerns/reviewers'))
    return json(200, [{ id: 'rv1', description: 'Independent reviewer', categories: ['Other'] }]);
  if (get('parishes/P/concerns/assigned'))
    return json(403, { title: 'forbidden', detail: 'Verify with a second factor.' });
  if (method === 'POST' && route === 'parishes/P/concerns') return json(200, { id: 'cn2' });
  if (method === 'POST' && route === 'parishes/P/concerns/cn12345678/entries') return json(200, { id: 'en2' });
  if (method === 'POST' && route === 'notifications/no1/state') return json(200, { id: 'no1' });
  if (method === 'POST' && route === 'parishes/P/profile-corrections') return json(200, { id: 'pc2' });
  if (method === 'POST' && route === 'parishes/P/profile-corrections/pc1/withdraw') return json(200, { id: 'pc1' });
  if (method === 'POST' && route === 'parishes/P/me/consents/c1/withdraw') return json(200, { id: 'c1' });
  if (method === 'POST' && route === 'parishes/P/me/data-closure-requests') return json(200, { id: 'dc1' });
  if (method === 'POST' && route === 'parishes/Q/follow') return json(200, []);
  if (method === 'DELETE' && route === 'parishes/Q/follow') return json(200, []);
  if (method === 'PUT' && route === 'parishes/Q/primary') return json(200, []);
  if (method === 'POST' && route === 'parishes/Q/membership-requests') return json(200, { id: 'mr1' });
  if (method === 'POST' && route === 'parishes/Q/membership-requests/mr1/withdraw') return json(200, { id: 'mr1' });
  if (get('public/parishes'))
    return json(200, { items: [{ parishId: 'Q', name: 'Saint Other' }], distanceUnavailable: [] });
  // the priest's pastoral notes (Notes & Tasks)
  if (get('parishes/P/pastoral-notes'))
    return json(200, [
      dto(
        {
          id: 'k1',
          kind: 'Note',
          title: 'Visit',
          body: 'Visited after hospital',
          personId: 'person-1',
          visibility: 'Author',
          authorAccountId: 'u',
          status: 'Active',
          createdAt: '2026-10-01T10:00:00Z'
        },
        noteVersion
      ),
      dto(
        {
          id: 'k2',
          kind: 'Task',
          title: 'Call',
          body: 'Call the family',
          visibility: 'ParishPriests',
          authorAccountId: 'u',
          status: 'Open',
          priority: 'High',
          dueAt: '2026-11-30T00:00:00Z',
          createdAt: '2026-10-02T10:00:00Z'
        },
        'kv2'
      ),
      dto(
        {
          id: 'k3',
          kind: 'Note',
          title: 'Gone',
          body: 'x',
          visibility: 'Author',
          authorAccountId: 'u',
          status: 'Archived',
          createdAt: '2026-09-01T10:00:00Z'
        },
        'kv3'
      )
    ]);
  if (get('parishes/P/pastoral-notes/k2')) return json(200, dto({ id: 'k2' }, 'kv3'));
  if (route.startsWith('parishes/P/pastoral-notes') && method !== 'GET') return json(200, { id: 'k' });
});

const { session } = await import('../../src/portal/model/api.js');
const { M, loadMember, memberAction, loadActivity, directory, activityAction } =
  await import('../../src/portal/model/member-data.js');
const member = await import('../../src/portal/model/modules/member.js');
signedIn(session, { roles: ['priest'] });

// the linked person opens the member pages; the priest's notes load
const d = {};
await member.load(session.parishes[0], d);
assert.equal(session.user.person_id, 'person-1');
assert.equal(session.parishes[0].personId, 'person-1');
assert.equal(d.NOTES.length, 2, 'archived notes stay out');
assert.deepEqual(
  [d.NOTES[0].kind, d.NOTES[0].p, d.NOTES[0].at, d.NOTES[0].visibility, d.NOTES[0].priority],
  ['note', 'person-1', '2026-10-01', 'personal', 'ordinary']
);
assert.deepEqual(
  [d.NOTES[1].kind, d.NOTES[1].priority, d.NOTES[1].due, d.NOTES[1].visibility],
  ['task', 'urgent', '2026-11-30', 'parish-priests']
);

// the member view model
await loadMember();
assert.equal(M.person.lat, 'Nada Haddad');
assert.equal(M.person.phone, '03 421 887');
assert.equal(M.person.address, 'Rue 4, Hadath');
assert.deepEqual(
  M.groups.map(g => g.name),
  ['Choir'],
  'only ministries the member belongs to'
);
assert.deepEqual(
  M.meetings.map(m => [m.id, m.attendance]),
  [
    ['m0', 'present'],
    ['m1', 'upcoming']
  ]
);
const next = M.meetings[1];
assert.ok(next.rsvpEnabled && next.rsvp.version === 'rv1' && next.location === 'Hall' && /^\d\d:\d\d$/.test(next.time));
assert.equal(M.events[0].source, 'Sacrament');
assert.equal(M.formation[0].name, 'Altar servers');
assert.deepEqual(
  M.content.filter(x => x.kind === 'opportunity').map(x => x.id),
  ['o1']
);
assert.equal(M.content.find(x => x.kind === 'announcement').title, 'Feast day');
assert.equal(M.commitments.o2.status, 'confirmed');
assert.deepEqual(
  M.notes.map(n => [n.id, n.tags]),
  [['pn1', ['a']]],
  'archived notes are hidden'
);
assert.deepEqual(
  M.todos.map(t => [t.id, t.due, t.done]),
  [['pt1', '2026-11-20', false]]
);
assert.equal(M.concerns[0].subject, 'Noise');
assert.equal(M.concerns[0].updates[0].text, 'We are looking');
assert.deepEqual(M.reviewers, [{ id: 'rv1', name: 'Independent reviewer', categories: ['Other'] }]);
assert.deepEqual(
  M.categories.map(c => c.name),
  ['Operational', 'Interpersonal', 'Safeguarding', 'Other']
);
assert.deepEqual(M.complaintPermissions, [], 'a refused reviewer list leaves review closed');
assert.equal(M.notifications.length, 2);
assert.deepEqual(
  M.profileRequests.map(x => [x.field, x.requested_value, x.status]),
  [['Contact', '03 111 222', 'Pending']]
);
assert.equal(M.consents[0].kind, 'Photo');
assert.equal(M.home.unreadNotifications, 2);
assert.equal(M.ownData.records.Sacraments, 2);
assert.deepEqual(M.requests, [], 'the requests module owns M.requests');
assert.equal(M.preferences.email, undefined, 'no preference is invented');
assert.deepEqual([M.notes[0].pinned, M.notes[0].reminder, M.notes[0].meetingId], [true, '2026-12-24', 'mGone']);
assert.deepEqual([next.rsvp.status, next.rsvp.reason, next.rsvp.reasonVersion], ['No', 'Travelling', 'rr1']);
const resource = M.content.find(x => x.kind === 'resource');
assert.deepEqual(
  [resource.title, resource.groupId, resource.groupName, resource.available, resource.total],
  ['Hymnals', 'G9', 'Hidden group', 3, 4],
  'resources of a ministry the parish does not list publicly still show'
);
assert.deepEqual(
  [M.preferences.loaded, M.preferences.muted, M.preferences.topics.length],
  [true, ['community.news', 'request.update'], 3]
);

// actions
const last = () => sent[sent.length - 1];
await memberAction('rsvp', { meetingId: 'm1', status: 'yes' });
assert.deepEqual(last().slice(0, 2), ['PUT', 'parishes/P/ministries/G1/meetings/m1/rsvp']);
assert.equal(last()[2].response, 'Yes');
assert.equal(last()[2].version, 'rv1');
assert.ok(last()[2].operationId);
await memberAction('rsvp', { meetingId: 'm1', status: 'no', reason: '  Away for work  ' });
assert.deepEqual(
  sent.slice(-2).map(s => [s[0], s[1]]),
  [
    ['PUT', 'parishes/P/ministries/G1/meetings/m1/rsvp'],
    ['PUT', 'parishes/P/ministries/G1/meetings/m1/rsvp-private-reason']
  ]
);
assert.deepEqual([last()[2].reason, last()[2].version, !!last()[2].operationId], ['Away for work', 'rr1', true]);
await memberAction('rsvp', { meetingId: 'm1', status: 'yes', reason: '' });
assert.deepEqual(
  [last()[1].endsWith('rsvp-private-reason'), last()[2].clear, last()[2].reason],
  [true, true, undefined]
);
let count = sent.length;
await memberAction('rsvp', { meetingId: 'm1', status: 'no', reason: 'Travelling' });
assert.equal(sent.length - count, 1, 'an unchanged reason is not sent again');
await memberAction('preferences', { muted: ['reports', 'request.update'] });
assert.deepEqual(last().slice(0, 2), ['PUT', 'notifications/preferences']);
assert.deepEqual(
  last()[2],
  { mutedTopics: ['community.news', 'reports'], language: 'ar', digestOptional: true },
  'only optional topics are muted; a mute on a required topic is dropped; others are kept'
);
await memberAction('note', { title: 'T', body: 'B', category: 'Ideas', tags: ['x'] });
assert.deepEqual(last().slice(0, 2), ['POST', 'me/personal-workspace']);
assert.equal(last()[2].kind, 'Note');
assert.deepEqual(
  [last()[2].pinned, last()[2].reminderAt, last()[2].meetingId, last()[2].meetingMinistryId],
  [false, null, null, null]
);
await memberAction('note', { title: 'T', body: 'B', tags: [], pinned: true, reminder: '2026-12-01', meetingId: 'm1' });
assert.deepEqual(
  [last()[2].pinned, last()[2].reminderAt, last()[2].meetingParishId, last()[2].meetingMinistryId, last()[2].meetingId],
  [true, '2026-12-01T00:00:00Z', 'P', 'G1', 'm1']
);
await assert.rejects(
  memberAction('note', { title: 'T', body: 'B', tags: [], meetingId: 'nope' }),
  /no longer on your list/
);
await memberAction('note', { id: 'pn1', title: 'T', body: 'B', tags: [], pinned: true, meetingId: 'mGone' });
assert.deepEqual(
  [last()[2].meetingParishId, last()[2].meetingMinistryId, last()[2].meetingId],
  ['P', 'G1', 'mGone'],
  'an unchanged link keeps its stored ids'
);
await memberAction('note', { id: 'pn1', title: 'T2', body: 'B2', category: '', tags: [] });
assert.deepEqual(last().slice(0, 2), ['PUT', 'me/personal-workspace/pn1']);
assert.equal(last()[2].version, 'pv1');
await memberAction('note', { id: 'pn1', delete: true });
assert.equal(last()[1], 'me/personal-workspace/pn1/actions');
assert.equal(last()[2].action, 'archive');
await memberAction('todo', { title: 'Pray', due: '2026-12-01' });
assert.equal(last()[2].kind, 'Task');
assert.equal(last()[2].dueAt, '2026-12-01T00:00:00Z');
await memberAction('todo', { id: 'pt1', done: true });
assert.equal(last()[2].action, 'complete');
await memberAction('todo', { id: 'pt1', done: false });
assert.equal(last()[2].action, 'reopen');
await memberAction('volunteer', { id: 'o1', status: 'volunteer' });
assert.equal(last()[1], 'parishes/P/ministries/G1/volunteering/opportunities/o1/assignments');
await memberAction('volunteer', { id: 'o2', status: 'withdrawn' });
assert.equal(last()[1], 'parishes/P/ministries/G1/volunteering/assignments/as1/actions');
assert.equal(last()[2].action, 'request-cancel');
await memberAction('profileRequest', { field: 'Contact', value: '03 999 000' });
assert.deepEqual(last()[2].fields, [{ field: 'Contact', newValue: '03 999 000' }]);
await assert.rejects(memberAction('profileRequest', { field: 'address', value: 'x' }), /isn't connected/);
await memberAction('profileWithdraw', { id: 'pc1' });
assert.equal(last()[1], 'parishes/P/profile-corrections/pc1/withdraw');
await memberAction('concern', {
  category: 'Other',
  subject: 'Noise',
  description: 'Loud',
  peopleInvolved: 'A',
  anonymous: true,
  reviewers: ['rv1']
});
assert.equal(last()[1], 'parishes/P/concerns');
assert.deepEqual(
  [last()[2].summary, last()[2].anonymous, last()[2].reviewerIds, last()[2].implicatedAccountIds],
  ['Noise', true, ['rv1'], []]
);
assert.match(last()[2].details, /Loud\n\nPeople involved: A/);
await memberAction('concernFollowUp', { id: 'cn12345678', message: 'More' });
assert.deepEqual(
  [last()[1], last()[2].kind, last()[2].body],
  ['parishes/P/concerns/cn12345678/entries', 'SubmitterMessage', 'More']
);
await memberAction('notificationRead', { id: 'no1' });
assert.deepEqual([last()[1], last()[2]], ['notifications/no1/state', { status: 'Read' }]);
const before = sent.length;
await memberAction('notificationReadAll');
assert.equal(sent.length - before, 1, 'only unread notifications are marked');
await memberAction('consentWithdraw', { id: 'c1' });
assert.equal(last()[2].version, 'cv1');
await memberAction('closureRequest', { details: 'Please' });
assert.equal(last()[1], 'parishes/P/me/data-closure-requests');
for (const op of ['preference', 'changePassword', 'publish', 'categoryManage', 'message'])
  await assert.rejects(memberAction(op, {}), /isn't connected/, `${op} has no route`);

// My parish life, across parishes
const activity = await loadActivity();
assert.equal(activity.parishes.length, 1);
assert.equal(activity.events[0].parishName, 'Saint Test');
assert.equal(activity.notifications.length, 2);
assert.deepEqual(
  (await directory()).map(p => p.parishId),
  ['Q']
);
await activityAction('follow', { parishId: 'Q' });
await activityAction('primary', { parishId: 'Q' });
await activityAction('apply', { parishId: 'Q', givenName: 'Nada', familyName: 'Haddad', birthDate: '' });
assert.deepEqual(last()[2].birthDate, null);
await activityAction('withdraw', { parishId: 'Q', id: 'mr1' });
await activityAction('unfollow', { parishId: 'Q' });
assert.deepEqual(
  sent.slice(-5).map(s => [s[0], s[1]]),
  [
    ['POST', 'parishes/Q/follow'],
    ['PUT', 'parishes/Q/primary'],
    ['POST', 'parishes/Q/membership-requests'],
    ['POST', 'parishes/Q/membership-requests/mr1/withdraw'],
    ['DELETE', 'parishes/Q/follow']
  ]
);

// Notes & Tasks (the priest's pastoral notes)
const snap = () => JSON.parse(JSON.stringify({ NOTES: d.NOTES }));
const was = snap();
let now = snap();
now.NOTES.push({
  id: 'new1',
  kind: 'task',
  p: null,
  body: 'Order candles',
  bodyAr: 'Order candles',
  priority: 'attention',
  due: '2026-12-05',
  done: false,
  assignee: null,
  pinned: false,
  visibility: 'personal'
});
now.NOTES.find(n => n.id === 'k2').done = true;
now.NOTES = now.NOTES.filter(n => n.id !== 'k1');
sent.length = 0;
const result = await member.save(was, now);
assert.deepEqual(result, { unsupported: false, saved: true });
assert.deepEqual(
  sent.map(s => [s[0], s[1], s[2].action || s[2].kind]),
  [
    ['POST', 'parishes/P/pastoral-notes/k2/actions', 'complete'],
    ['POST', 'parishes/P/pastoral-notes', 'Task'],
    ['POST', 'parishes/P/pastoral-notes/k1/actions', 'archive']
  ]
);
assert.equal(sent[1][2].priority, 'Normal');
assert.equal(sent[1][2].dueAt, '2026-12-05T00:00:00Z');
assert.equal(sent[1][2].visibility, 'Author');
assert.equal(sent[0][2].version, 'kv2');
sent.length = 0;
now = snap();
now.NOTES[0].body = 'Visited again';
assert.deepEqual(await member.save(was, now), { unsupported: false, saved: true });
assert.deepEqual(
  sent.map(s => [s[0], s[1]]),
  [['PUT', 'parishes/P/pastoral-notes/k1']]
);
assert.equal(sent[0][2].version, noteVersion);
assert.equal(sent[0][2].personId, 'person-1');
assert.equal(sent[0][2].title, 'Visit', 'a title written elsewhere is kept');
now = snap();
now.NOTES[0].pinned = true;
sent.length = 0;
assert.equal((await member.save(was, now)).unsupported, true, 'the API has no pin');
console.log('member: ok');
