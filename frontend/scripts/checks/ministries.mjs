/* Purpose: checks the Ministries module (src/portal/model/modules/ministries.js) against an in-memory
   stand-in for the Ministries routes: what load puts in GROUPS, GROUP_DETAIL, SIGNUP_SHEETS, VOLUNTEERS
   and ATTENDANCE_SERIES, and what save and the direct workflows send (paging with size and cursor,
   operation ids, versions, the meeting and attendance flow, join decisions, ministry requests).
   Run with `npm run check` from frontend/. */
import assert from 'node:assert/strict';
import { mockApi, json, signedIn } from '../mock-api.mjs';

const M1 = 'aaaaaaaa-0000-0000-0000-000000000001',
  M2 = 'aaaaaaaa-0000-0000-0000-000000000002',
  PERSON_A = 'bbbbbbbb-0000-0000-0000-00000000000a',
  PERSON_B = 'bbbbbbbb-0000-0000-0000-00000000000b',
  ACCOUNT = 'cccccccc-0000-0000-0000-000000000001',
  MEETING = 'dddddddd-0000-0000-0000-000000000001',
  OPP = 'eeeeeeee-0000-0000-0000-000000000001';
const soon = new Date(Date.now() + 5 * 86400000),
  past = new Date(Date.now() - 3 * 86400000);
const at = (date, hour) => {
  const d = new Date(date);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

const ministry = (id, name, extra = {}) => ({
  id,
  parishId: 'P',
  name,
  kind: 'Choir',
  purpose: 'Sings at Mass',
  publicInformation: null,
  applicationsOpen: false,
  status: 'Active',
  publicListed: true,
  eligibilityPolicyReference: null,
  policyRevision: 1,
  ...extra
});
const meeting = (id, startsAt, status, extra = {}) => ({
  id,
  ministryId: M1,
  eventId: id,
  title: 'Rehearsal',
  startsAt,
  endsAt: new Date(Date.parse(startsAt) + 3600000).toISOString(),
  timeZone: 'Asia/Beirut',
  agenda: 'Hymns',
  locationDescription: 'Hall',
  status,
  rsvpMode: 'Optional',
  rsvpOpen: status === 'Confirmed',
  ...extra
});
let sheetStatuses = { [PERSON_A]: 'Present', [PERSON_B]: 'NotRecorded' };
let snapshotCalls = 0;
const sheet = (snapshotComplete = true) => ({
  meetingId: MEETING,
  ministryId: M1,
  status: snapshotComplete ? 'Ready' : 'Building',
  snapshotComplete,
  presentCount: Object.values(sheetStatuses).filter(s => s === 'Present').length,
  lateCount: 0
});
let sheetOpen = true;
let capacities = null;
const requested = [];
let rsvpList = [{ response: 'Yes' }, { response: 'No' }, { response: 'Undecided' }];

const page = (items, token = null) => json(200, { items, continuationToken: token });
const v = (value, version = 'v1') => ({ value, version });

const { sent } = mockApi((method, path, body) => {
  const url = new URL('http://x/' + path);
  const route = url.pathname.slice(1);
  const q = url.searchParams;
  if (route === 'parishes/P/people') return page([]); // the People module loads too
  requested.push(route);
  if (route === 'me/capacities')
    return json(
      200,
      capacities || [
        { kind: 'Priest', parishId: 'P', capabilities: [] },
        {
          kind: 'MinistryLeader',
          parishId: 'P',
          ministryId: M1,
          capabilities: ['attendance.record', 'volunteers.coordinate']
        }
      ]
    );
  if (route === 'parishes/P/ministries' && method === 'GET')
    return q.get('cursor') // two pages: the first ends with a cursor
      ? page([v(ministry(M2, 'Archived choir', { status: 'Archived' }), 'v9')])
      : page([v(ministry(M1, 'Saint Elias Choir'), 'm1v')], 'next');
  if (route === `parishes/P/ministries/${M1}` && method === 'GET')
    return json(200, v(ministry(M1, 'Saint Elias Choir'), 'm1v'));
  if (route === `parishes/P/ministries/${M1}/leadership`)
    return page([
      v(
        {
          id: 'l1',
          ministryId: M1,
          accountId: ACCOUNT,
          role: 'Leader',
          duties: ['attendance.record'],
          effective: true
        },
        'lv'
      )
    ]);
  if (route === `parishes/P/person-account-links/${ACCOUNT}`)
    return json(200, v({ personId: PERSON_A, accountId: ACCOUNT, active: true }));
  if (route === `parishes/P/ministries/${M1}/roster`)
    return page([
      { ministryId: M1, personId: PERSON_A, joinedAt: '2023-05-01T00:00:00Z', current: true },
      { ministryId: M1, personId: PERSON_B, joinedAt: '2024-02-01T00:00:00Z', current: true },
      {
        ministryId: M1,
        personId: 'gone',
        joinedAt: '2020-01-01T00:00:00Z',
        leftAt: '2021-01-01T00:00:00Z',
        current: false
      }
    ]);
  if (route === `parishes/P/ministries/${M1}/applications` && q.get('kind') === 'Join')
    return page([
      v(
        {
          id: 'ap1',
          ministryId: M1,
          personId: 'bbbbbbbb-0000-0000-0000-0000000000cc',
          kind: 'Join',
          status: 'Submitted',
          submittedAt: '2026-10-02T08:00:00Z'
        },
        'av1'
      ),
      v(
        {
          id: 'ap0',
          ministryId: M1,
          personId: 'x',
          kind: 'Join',
          status: 'Approved',
          submittedAt: '2026-01-01T00:00:00Z'
        },
        'av0'
      )
    ]);
  if (route === `parishes/P/ministries/${M1}/meetings` && method === 'GET') {
    const from = Date.parse(q.get('start')),
      to = Date.parse(q.get('end'));
    assert.ok(to - from <= 31 * 86400000, 'a meeting window is at most 31 days');
    return page(
      [
        meeting(MEETING, at(past, 17), 'Confirmed'),
        meeting('dddddddd-0000-0000-0000-000000000002', at(soon, 17), 'Draft', { title: 'Next week' }),
        meeting('dddddddd-0000-0000-0000-000000000003', at(soon, 18), 'Cancelled')
      ].filter(m => Date.parse(m.startsAt) >= from && Date.parse(m.startsAt) < to)
    );
  }
  if (route === `parishes/P/ministries/${M1}/meetings/${MEETING}/rsvps`) return page(rsvpList);
  if (route.startsWith(`parishes/P/ministries/${M1}/meetings/`) && route.endsWith('/rsvps')) return page([]);
  const attendance = `parishes/P/ministries/${M1}/meetings/${MEETING}/attendance`;
  if (route === attendance && method === 'GET') return sheetOpen ? json(200, v(sheet(), 'sv0')) : json(404);
  if (route === attendance && method === 'POST') {
    sheetOpen = true;
    return json(202, v(sheet(false), 'sv1'));
  }
  if (route === `${attendance}/snapshot`) {
    snapshotCalls += 1;
    return json(snapshotCalls < 2 ? 202 : 200, v(sheet(snapshotCalls >= 2), `sv${snapshotCalls + 1}`));
  }
  if (route === `${attendance}/rows`)
    return json(200, {
      sheet: v(sheet()),
      items: Object.entries(sheetStatuses).map(([personId, status]) =>
        v(
          {
            meetingId: MEETING,
            personId,
            status,
            recordedAt: status === 'NotRecorded' ? null : '2026-11-01T10:00:00Z'
          },
          `r-${personId.slice(-1)}`
        )
      ),
      continuationToken: null
    });
  if (route === `${attendance}/records`) return json(200, v(sheet(), 'sv-after'));
  if (
    route.startsWith(`parishes/P/ministries/${M1}/meetings/`) &&
    method === 'GET' &&
    !route.includes('/', 40 + M1.length + 10)
  )
    return json(200, v(meeting(route.split('/').pop(), at(soon, 17), 'Draft'), 'mv'));
  if (route.startsWith(`parishes/P/ministries/${M1}/meetings`) && method !== 'GET')
    return json(200, meeting('new', at(soon, 17), 'Draft'));
  if (route === `parishes/P/ministries/${M1}/formation/programs`)
    return page([
      v({
        id: 'pg1',
        ministryId: M1,
        title: 'Liturgical singing',
        status: 'Approved',
        milestones: [{ key: 'level-1', title: 'Level 1' }]
      }),
      v({ id: 'pg0', ministryId: M1, title: 'Old', status: 'Retired', milestones: [{ key: 'old', title: 'Old' }] })
    ]);
  if (route === `parishes/P/ministries/${M1}/formation/enrollments`)
    return page([
      v({
        id: 'en1',
        programId: 'pg1',
        personId: PERSON_A,
        status: 'Completed',
        milestones: [
          { key: 'level-1', status: 'Completed', achievedOn: '2025-06-01', completedAt: '2025-06-02T00:00:00Z' }
        ]
      }),
      v({
        id: 'en2',
        programId: 'pg1',
        personId: PERSON_B,
        status: 'Active',
        milestones: [{ key: 'level-1', status: 'InProgress' }]
      })
    ]);
  if (route === `parishes/P/ministries/${M1}/stock`)
    return page([
      v(
        {
          id: 's1',
          ministryId: M1,
          name: 'Choir folders',
          storage: 'Sacristy',
          total: 30,
          onLoan: 2,
          available: 28,
          status: 'Active'
        },
        'sv'
      ),
      v({ id: 's0', ministryId: M1, name: 'Old stand', storage: null, total: 1, status: 'Retired' })
    ]);
  if (route === `parishes/P/ministries/${M1}/loans`)
    return page([
      v({
        id: 'ln1',
        stockId: 's1',
        personId: PERSON_B,
        quantity: 2,
        status: 'Issued',
        issuedAt: '2026-10-01T09:00:00Z',
        dueAt: '2026-12-01T09:00:00Z'
      })
    ]);
  if (route === `parishes/P/ministries/${M1}/volunteering/opportunities`)
    return page([
      v(
        {
          id: OPP,
          ministryId: M1,
          title: 'Christmas readers',
          position: 'Reader',
          capacity: 9,
          remaining: 4,
          startsAt: '2026-12-20T10:00:00Z',
          status: 'Open',
          selfSignup: true
        },
        'ov'
      ),
      v({
        id: 'o0',
        ministryId: M1,
        title: 'Called off',
        position: 'x',
        capacity: 1,
        remaining: 1,
        startsAt: '2026-12-20T10:00:00Z',
        status: 'Cancelled'
      })
    ]);
  if (route === `parishes/P/ministries/${M1}/volunteering/opportunities/${OPP}/assignments`)
    return page([
      v({ id: 'as1', opportunityId: OPP, personId: PERSON_A, status: 'Confirmed' }),
      v({ id: 'as2', opportunityId: OPP, personId: PERSON_B, status: 'Declined' })
    ]);
  if (route === `parishes/P/ministries/${M1}/volunteering/people/${PERSON_A}/hours`)
    return page([v({ id: 'h1', status: 'Verified', minutes: 90 }), v({ id: 'h2', status: 'Submitted', minutes: 600 })]);
  // ministry requests: the published catalogue, the account's own applications, membership
  if (route === 'public/parishes/P/ministries')
    return page([
      {
        id: M1,
        name: 'Saint Elias Choir',
        purpose: 'Sings at Mass',
        publicInformation: 'Fridays 19:00',
        applicationsOpen: true
      }
    ]);
  if (route === `parishes/P/ministries/${M1}/membership/mine`) return json(404);
  if (route === `parishes/P/ministries/${M1}/applications/mine`)
    return page([
      v(
        {
          id: 'mine1',
          ministryId: M1,
          personId: PERSON_A,
          kind: 'Join',
          status: 'Submitted',
          submittedAt: '2026-11-01T00:00:00Z'
        },
        'mv1'
      )
    ]);
  if (route === `parishes/P/ministries/${M1}/applications` && q.get('kind') === 'Leave')
    return page([
      v(
        {
          id: 'lv1',
          ministryId: M1,
          personId: PERSON_B,
          kind: 'Leave',
          status: 'AwaitingPriest',
          submittedAt: '2026-11-02T00:00:00Z'
        },
        'lvv'
      )
    ]);
  if (route === `parishes/P/ministries/${M1}/applications` && method === 'POST')
    return json(200, { id: 'new-app', ministryId: M1, kind: body.kind });
  // writes
  if (route === 'parishes/P/ministries' && method === 'POST')
    return json(200, ministry('new', body.name, { status: 'Draft' }));
  if (route.startsWith(`parishes/P/ministries/${M1}`) && method !== 'GET') return json(200, {});
  return undefined;
});

const { session } = await import('../../src/portal/model/api.js');
signedIn(session, { roles: ['priest'] });
const D = await import('../../src/portal/model/data.js');
const { hydrate, persist } = await import('../../src/portal/model/persist.js');
const ministries = await import('../../src/portal/model/modules/ministries.js');

await hydrate();

// groups: both pages are read, an archived ministry is left out, nothing demo remains
assert.deepEqual(
  D.GROUPS.map(g => [g.id, g.name, g.cat, g.members, g.vis, g.leader]),
  [[M1, 'Saint Elias Choir', 'Choir', 2, 'public', PERSON_A]]
);
assert.equal(D.GROUPS[0].version, 'm1v');
const detail = D.GROUP_DETAIL[M1];
assert.deepEqual(
  detail.roster.map(r => [r.p, r.role, r.joined]),
  [
    [PERSON_A, 'Leader', '2023'],
    [PERSON_B, 'Member', '2024']
  ],
  'former members are not on the roster; the leader account shows as its person'
);
assert.deepEqual(detail.roles, [[PERSON_A, 'Leader', 'مسؤول']]);
assert.deepEqual(
  detail.requests.map(r => [r.id, r.status]),
  [['ap1', 'Submitted']],
  'only open join applications'
);
// meetings: the cancelled one is left out; local time on the meeting's clock; drafts keep their status
const beirut = iso =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Beirut',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(new Date(iso));
assert.deepEqual(
  detail.meetings.map(m => [m.title, m.status, m.t]),
  [
    ['Rehearsal', 'Confirmed', beirut(at(past, 17))],
    ['Next week', 'Draft', beirut(at(soon, 17))]
  ]
);
const held = detail.meetings.find(m => m.title === 'Rehearsal');
assert.equal(held.timeZone, 'Asia/Beirut');
assert.deepEqual(held.rsvp, { yes: 1, no: 1, none: 0 }, 'replies counted for a confirmed meeting');
assert.deepEqual(held.attendance, { [PERSON_A]: 'present' }, 'recorded statuses only; not recorded stays empty');
assert.equal(held.done, true);
assert.equal(
  detail.meetings.some(m => m.sheet || m.startsAt),
  false,
  'no scratch fields leak into the view model'
);
assert.deepEqual(D.ATTENDANCE_SERIES, [1]);
// formation, belongings, loans
assert.deepEqual(
  detail.milestones.map(m => [m.name, m.completions]),
  [['Level 1', { [PERSON_A]: '2025-06-01' }]]
);
assert.deepEqual(
  detail.belongings.map(b => [b.id, b.name, b.qty, b.location]),
  [['s1', 'Choir folders', 30, 'Sacristy']]
);
assert.deepEqual(
  detail.resourceLoans.map(l => [l.resourceId, l.qty, l.due, l.returnedAt]),
  [['s1', 2, '2026-12-01', '']]
);
// nothing the API does not hold is invented
assert.deepEqual([detail.posts, detail.files, detail.tasks, detail.history], [[], [], [], []]);
// sign-up sheets and volunteers
assert.deepEqual(
  D.SIGNUP_SHEETS.map(s => [s.id, s.what, s.slots, s.taken, s.deadline]),
  [[OPP, 'Christmas readers', 9, 5, '2026-12-20']]
);
assert.deepEqual(
  D.VOLUNTEERS.map(x => [x.p, x.assignments, x.hours, x.clearance, x.skills]),
  [[PERSON_A, 1, 1.5, '', []]],
  'a declined assignment is not a volunteer; only verified hours count; clearance is not invented'
);

// an account with no office role and no leader capacity asks the API for nothing
{
  capacities = [];
  signedIn(session, { roles: [] });
  const before = requested.length,
    empty = { GROUPS: [], GROUP_DETAIL: {}, VOLUNTEERS: [], SIGNUP_SHEETS: [], ATTENDANCE_SERIES: [] };
  await ministries.load(session.parishes[0], empty);
  assert.deepEqual([empty.GROUPS, empty.VOLUNTEERS], [[], []]);
  assert.deepEqual(requested.slice(before), ['me/capacities']);
  capacities = null;
  signedIn(session, { roles: ['priest'] });
}

// saving
const writes = () => sent.splice(0);
{
  // a group is created as a draft with an operation id
  D.GROUPS.push({
    id: 'g-temp',
    name: 'Youth',
    ar: '',
    cat: 'Team',
    catAr: '',
    purpose: 'Fellowship',
    publicInformation: '',
    eligibilityPolicyReference: '',
    members: 0,
    vis: 'private',
    meets: '',
    meetsAr: ''
  });
  assert.equal(await persist(), true);
  const [[method, path, body]] = writes();
  assert.deepEqual([method, path], ['POST', 'parishes/P/ministries']);
  assert.match(body.operationId, /^[0-9a-f-]{36}$/);
  assert.deepEqual(
    [body.name, body.kind, body.purpose, body.publicInformation, body.eligibilityPolicyReference],
    ['Youth', 'Team', 'Fellowship', null, null]
  );
}
{
  // editing sends the version the API returned, read fresh
  D.GROUPS[0].purpose = 'Sings at every Mass';
  assert.equal(await persist(), true);
  const [[method, path, body]] = writes();
  assert.deepEqual(
    [method, path, body.version, body.purpose],
    ['PUT', `parishes/P/ministries/${M1}`, 'm1v', 'Sings at every Mass']
  );
}
{
  // a new meeting: a future draft on the group's time zone, one hour long when no end is given
  const day = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
  D.groupInfo(M1).meetings.push({
    id: 'mt-temp',
    d: day,
    t: '19:30',
    end: '',
    title: '',
    place: 'Hall',
    description: 'Hymns',
    kind: 'group',
    participants: [],
    rsvp: { yes: 0, no: 0, none: 0 },
    done: false,
    attendance: {}
  });
  assert.equal(await persist(), true);
  const [[method, path, body]] = writes();
  assert.deepEqual([method, path], ['POST', `parishes/P/ministries/${M1}/meetings`]);
  assert.equal(body.title, 'Group meeting');
  assert.equal(body.timeZone, 'Asia/Beirut');
  assert.equal(Date.parse(body.endsAt) - Date.parse(body.startsAt), 3600000);
  assert.equal(body.agenda, 'Hymns');
  assert.equal(body.rsvpMode, 'Optional');
  const shown = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Beirut',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(new Date(body.startsAt));
  assert.equal(shown, '19:30', 'the wall-clock time is the meeting zone’s');
}
{
  // a meeting for chosen people has no API field: reported, nothing sent
  const day = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
  D.groupInfo(M1).meetings.push({
    id: 'mt-temp2',
    d: day,
    t: '19:30',
    end: '20:30',
    title: 'Leads',
    kind: 'committee',
    participants: [PERSON_A],
    rsvp: { yes: 0, no: 0, none: 0 },
    done: false,
    attendance: {}
  });
  assert.equal(await persist(), false, 'unsupported changes are reported');
  assert.deepEqual(writes(), []);
}
{
  // confirming a draft meeting sends the confirm action with the meeting's current version
  const draft = D.groupInfo(M1).meetings.find(m => m.status === 'Draft' && m.title === 'Next week');
  draft.status = 'Confirmed';
  assert.equal(await persist(), true);
  const [[method, path, body]] = writes();
  assert.deepEqual(
    [method, path, body.action, body.version],
    ['POST', `parishes/P/ministries/${M1}/meetings/${draft.id}/actions`, 'confirm', 'mv']
  );
}
{
  // deleting a meeting cancels it
  const draft = D.groupInfo(M1).meetings.find(m => m.title === 'Next week');
  D.groupInfo(M1).meetings.splice(D.groupInfo(M1).meetings.indexOf(draft), 1);
  assert.equal(await persist(), true);
  const [[, path, body]] = writes();
  assert.match(path, /\/actions$/);
  assert.equal(body.action, 'cancel');
  assert.ok(body.reason);
}
{
  // attendance: the sheet exists, so the change is one conditional record with the row's version
  D.groupInfo(M1).meetings.find(m => m.id === MEETING).attendance[PERSON_B] = 'excused';
  assert.equal(await persist(), true);
  const [[method, path, body]] = writes();
  assert.deepEqual([method, path], ['POST', `parishes/P/ministries/${M1}/meetings/${MEETING}/attendance/records`]);
  assert.equal(body.version, 'sv0');
  assert.deepEqual(body.entries, [{ personId: PERSON_B, version: 'r-b', status: 'Excused', correctionReason: null }]);
}
{
  // no sheet yet: it is opened with the meeting's version and its roster built before anything is recorded
  sheetOpen = false;
  sheetStatuses = { [PERSON_A]: 'NotRecorded', [PERSON_B]: 'NotRecorded' };
  D.groupInfo(M1).meetings.find(m => m.id === MEETING).attendance[PERSON_A] = 'absent';
  assert.equal(await persist(), true);
  const calls = writes().map(([m, p]) => `${m} ${p.split('/attendance')[1] || '(open)'}`);
  assert.deepEqual(calls, ['POST (open)', 'POST /snapshot', 'POST /snapshot', 'POST /records']);
}
{
  // removing a group archives it
  D.GROUPS.splice(0, D.GROUPS.length);
  assert.equal(await persist(), true);
  const archives = writes().filter(([, p]) => p.endsWith('/actions'));
  assert.equal(archives[0][2].action, 'archive');
  assert.equal(archives[0][2].version, 'm1v');
}
await hydrate();
{
  // changes with no API equivalent are undone and reported
  D.groupInfo(M1).posts.push({ by: PERSON_A, at: '2026-11-01', body: 'Hello' });
  assert.equal(await persist(), false);
  assert.deepEqual(writes(), []);
  assert.deepEqual(D.groupInfo(M1).posts, []);
}

// workflows called from the screens
{
  await ministries.ministryAction(M1, 'publish', 'Ready for visitors');
  const [[, path, body]] = writes();
  assert.deepEqual(
    [path, body.action, body.version, body.reason],
    [`parishes/P/ministries/${M1}/actions`, 'publish', 'm1v', 'Ready for visitors']
  );
  // a priest approves; a leader recommends
  await ministries.applicationAction(M1, { id: 'ap1', status: 'Submitted', version: 'av1' }, 'approve', {
    reference: 'Reviewed 2 Oct'
  });
  let [[, p1, b1]] = writes();
  assert.deepEqual(
    [p1.endsWith('/applications/ap1/actions'), b1.action, b1.version, b1.eligibilityReviewReference],
    [true, 'approve', 'av1', 'Reviewed 2 Oct']
  );
  signedIn(session, { roles: ['leader'] });
  await ministries.applicationAction(M1, { id: 'ap1', status: 'Submitted', version: 'av1' }, 'decline', {
    reason: 'Needs consent form'
  });
  [[, p1, b1]] = writes();
  assert.deepEqual([b1.action, b1.reason], ['return', 'Needs consent form']);
  signedIn(session, { roles: ['priest'] });
}

// ministry requests: the published catalogue, own applications, and what the account may review
{
  session.user.name = 'Test Account';
  const { requests, ministries: catalogue } = await ministries.ministryRequests({ [PERSON_B]: 'Nada Haddad' });
  assert.deepEqual(
    catalogue.map(m => [m.id, m.parish, m.name, m.member, m.description]),
    [[M1, 'P', 'Saint Elias Choir', false, 'Fridays 19:00']]
  );
  assert.deepEqual(
    requests.map(r => [r.id, r.own, r.status, r.kind, r.canReview, r.name]).sort(),
    [
      ['ap1', false, 'requested', 'join', true, ''],
      ['lv1', false, 'leave-requested', 'leave', true, 'Nada Haddad'],
      ['mine1', true, 'requested', 'join', false, 'Test Account']
    ].sort()
  );
  const mine = requests.find(r => r.id === 'mine1');
  await ministries.requestDecision(mine, 'withdraw');
  let [[, path, body]] = writes();
  assert.deepEqual(
    [path, body.action, body.version],
    [`parishes/P/ministries/${M1}/applications/mine1/actions`, 'withdraw', 'mv1']
  );
  const departure = requests.find(r => r.id === 'lv1');
  await ministries.requestDecision(departure, 'approve');
  [[, path, body]] = writes();
  assert.deepEqual([body.action, body.eligibilityReviewReference], ['approve', null]);
  // joining sends only the kind; leaving also keeps the applicant's note apart from the application
  await ministries.requestMembership({ id: M1, parish: 'P', member: false }, { reason: 'ignored for a join' });
  assert.deepEqual(
    writes().map(([m, p, b]) => [m, p, b.kind]),
    [['POST', `parishes/P/ministries/${M1}/applications`, 'Join']]
  );
  await ministries.requestMembership({ id: M1, parish: 'P', member: true }, { reason: 'Moving away' });
  assert.deepEqual(
    writes().map(([m, p, b]) => [m, p.split(`${M1}/`)[1], b.kind || b.reason]),
    [
      ['POST', 'applications', 'Leave'],
      ['PUT', 'applications/new-app/private-reason', 'Moving away']
    ]
  );
}
console.log('ministries: load, save and workflows ok');
