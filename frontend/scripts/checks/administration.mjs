/* Purpose: checks the Administration module against an in-memory stand-in for the routes it calls:
   what load puts in the workflow, task, activity and parish collections (and that a 403 leaves them
   empty), that edits to collections with no API are undone and reported, paging with size and cursor,
   and the exact routes and bodies the workspace, bishop, reporting, workflow and homepage calls send;
   the general audit trail (with audit.read) replacing the partial one, with actor names from the
   account-names lookup; and the platform lists, account suspension and clergy-title calls. */
import assert from 'node:assert/strict';
import { mockApi, json, signedIn } from '../mock-api.mjs';

const P = '11111111-1111-4111-8111-111111111111',
  A = '22222222-2222-4222-8222-222222222222',
  W = '33333333-3333-4333-8333-333333333333',
  R = '44444444-4444-4444-8444-444444444444';
const U = '55555555-5555-4555-8555-555555555555';
let forbidWorkflows = false,
  auditTrail = false;
const steps = [
  {
    key: 'review',
    title: 'Review',
    permission: 'requests.manage',
    whenField: null,
    whenValue: null,
    viewsRestricted: false
  },
  { key: 'sign', title: 'Sign', permission: 'documents.sign', whenField: null, whenValue: null, viewsRestricted: false }
];
const definition = {
  id: W,
  title: 'Certificate request',
  publishedVersionId: 'v1',
  publishedNumber: 1,
  mode: 'Open',
  modeReason: null,
  updatedAt: '2026-11-01T00:00:00Z',
  draft: {
    startPermission: 'requests.manage',
    fields: [{ key: 'who', label: 'Who', type: 'Text', required: true, options: [] }],
    restrictedFieldKeys: [],
    steps
  }
};
const run = {
  id: R,
  definitionId: W,
  versionId: 'v1',
  versionNumber: 1,
  title: 'Certificate request',
  status: 'InProgress',
  cycle: 1,
  currentStepKey: 'sign',
  answers: { who: 'A' },
  redactedFieldKeys: [],
  steps: [
    { key: 'review', title: 'Review', permission: 'requests.manage', status: 'Completed' },
    { key: 'sign', title: 'Sign', permission: 'documents.sign', status: 'Pending' }
  ],
  startedAt: '2026-11-02T10:00:00Z'
};
const gets = [];
const { sent } = mockApi((method, path, body) => {
  if (method === 'GET') gets.push(path);
  if (path === `parishes/${P}`)
    return json(200, {
      value: {
        id: P,
        name: 'Saint Test',
        locality: 'Hadath',
        contact: 'a@b.c',
        declaredArchdiocese: 'Beirut',
        status: 'Verified'
      },
      version: 'e1'
    });
  if (path.startsWith(`parishes/${P}/workflows?`)) {
    if (forbidWorkflows) return json(403, { status: 403, title: 'forbidden', detail: 'No.' });
    return path.includes('cursor=c2')
      ? json(200, { items: [], continuationToken: null })
      : json(200, { items: [{ value: definition, version: 'd1' }], continuationToken: 'c2' });
  }
  if (path.startsWith(`parishes/${P}/workflow-runs?`))
    return forbidWorkflows
      ? json(403, { status: 403, title: 'forbidden', detail: 'No.' })
      : json(200, { items: [{ value: run, version: 'r1' }], continuationToken: null });
  if (path.startsWith(`parishes/${P}/workflow-runs/worklist`))
    return json(403, { status: 403, title: 'forbidden', detail: 'No.' });
  if (path.startsWith(`parishes/${P}/workflow-runs/${R}/history`))
    return json(200, {
      items: [
        { id: 'h1', runId: R, action: 'Started', toStatus: 'InProgress', cycle: 1, by: 'x', at: '2026-11-02T10:00:00Z' }
      ],
      continuationToken: null
    });
  if (path === `parishes/${P}/status/history`)
    return json(200, [
      {
        id: 's1',
        action: 'suspend',
        from: 'Verified',
        to: 'Suspended',
        reason: 'Audit',
        by: 'x',
        at: '2026-11-03T08:00:00Z'
      }
    ]);
  if (path.startsWith(`parishes/${P}/audit?`))
    return auditTrail
      ? json(200, {
          items: [
            { operationId: 'o1', actorId: U, action: 'grant.create', resourceId: 'g1', at: '2026-11-04T09:00:00Z' },
            { operationId: 'o2', actorId: 'hidden', action: 'workflow.started', resourceId: R, at: '2026-11-05T09:00:00Z' }
          ],
          continuationToken: null
        })
      : json(403, { status: 403, title: 'forbidden', detail: 'No.' });
  if (path.startsWith(`parishes/${P}/account-names?`)) return json(200, [{ accountId: U, displayName: 'Office Writer' }]);
  if (path.startsWith('administration/accounts?'))
    return json(200, {
      items: [{ value: { accountId: U, userName: 'writer', status: 'Active', platformOperator: false }, version: 'a1' }],
      continuationToken: null
    });
  if (path.startsWith('administration/parishes?'))
    return path.includes('cursor=100')
      ? json(200, { items: [{ id: 'p2', name: 'Second' }], continuationToken: null })
      : json(200, { items: [{ id: P, name: 'Saint Test' }], continuationToken: '100' });
  if (path.startsWith(`parishes/${P}/people?`)) return json(200, { items: [], continuationToken: null });
  if (path === 'me/capacities')
    return json(200, [
      { kind: 'Bishop', archdioceseId: A, scopeName: 'Beirut', capabilities: [] },
      { kind: 'PlatformOperator', scopeName: 'Platform', capabilities: [] }
    ]);
  if (path.startsWith(`archdioceses/${A}/overview?`))
    return json(200, { archdioceseId: A, parishes: [], totals: {}, measures: [], excluded: [], from: '', to: '' });
  if (method === 'POST' || method === 'PUT') return json(200, { id: 'new', version: 'n1', value: {} });
  return undefined;
});

const { session } = await import('../../src/portal/model/api.js');
signedIn(session, { roles: ['priest'] });
session.parishId = P;
session.parishes[0].id = P;
const D = await import('../../src/portal/model/data.js');
const { hydrate, persist } = await import('../../src/portal/model/persist.js');
const X = await import('../../src/portal/model/modules/administration-api.js');

await hydrate();
assert.deepEqual(
  D.WORKFLOWS.map(w => [w.id, w.name, w.open, w.steps, w.paused]),
  [[W, 'Certificate request', 1, ['Review', 'Sign'], false]],
  'workflows, with both pages read and the open count'
);
assert.deepEqual(
  D.RUNS.map(r => [r.id, r.wf, r.step, r.total, r.status]),
  [[R, W, 1, 2, 'InProgress']]
);
assert.equal(D.RUNS[0].due, '', 'a run has no due date in the API');
assert.equal(D.RUN_LOG.length, 1);
assert.deepEqual(
  D.AUDIT.map(a => a.kind),
  ['settings', 'create'],
  'status change and run start, newest first'
);
assert.equal(D.PARISH.town, 'Hadath');
assert.equal(D.PARISH.eparchy, 'Beirut');
assert.equal(D.EPARCHY_NEWS.length, 0, 'no demo eparchy news');
assert.equal(D.WEBHOOKS.length, 0);

// a 403 means "not allowed here": the collections stay empty and the load does not fail
forbidWorkflows = true;
await hydrate();
assert.equal(D.WORKFLOWS.length, 0);
assert.equal(D.RUNS.length, 0);
forbidWorkflows = false;
await hydrate();

// collections with no API are undone and reported
const writes = sent.length;
D.WEBHOOKS.push({ id: 'w', url: 'https://x' });
assert.equal(await persist(), false);
assert.equal(sent.length, writes);
assert.equal(D.WEBHOOKS.length, 0);

// calls: exact routes and bodies
const last = () => sent.at(-1);
await X.startRun(P, W, { versionId: 'v1', answers: { who: 'A' } });
assert.equal(`${last()[0]} ${last()[1]}`, `POST parishes/${P}/workflows/${W}/runs`);
assert.match(last()[2].operationId, /^[0-9a-f-]{36}$/);
await X.recordRunStep(P, R, { version: 'r1', stepKey: 'sign', result: 'Completed', note: null });
assert.equal(last()[1], `parishes/${P}/workflow-runs/${R}/steps`);
await X.grantAccess(P, {
  version: 'e1',
  accountId: 'u',
  allows: ['people.read'],
  denies: [],
  startsAt: '2026-11-01T00:00:00Z',
  endsAt: null
});
assert.equal(`${last()[0]} ${last()[1]}`, `PUT parishes/${P}/grants`);
await X.verifyParish(P, 'e1', 'ref-1');
assert.deepEqual([last()[1], last()[2].version, last()[2].evidenceReference], [`parishes/${P}/verify`, 'e1', 'ref-1']);
await X.changeParishStatus(P, 'e1', 'suspend', 'why');
assert.equal(last()[1], `parishes/${P}/status`);
await X.inviteAppointment(A, P, { role: 'Priest' });
assert.equal(last()[1], `archdioceses/${A}/parishes/${P}/priest-appointments`);
await X.inviteAppointment(A, null, { role: 'ArchdioceseAdmin' });
assert.equal(last()[1], `archdioceses/${A}/staff-appointments`);
await X.publishHomepage({ version: 'h', reason: null });
assert.equal(last()[1], 'administration/homepage/publish');
await X.createReportSchedule({
  report: 'work-overview',
  parishId: P,
  frequency: 'Daily',
  dayOfWeek: null,
  localHour: 8,
  timeZone: 'UTC',
  email: false
});
assert.equal(last()[1], 'report-schedules');
await X.proposeTransferToArchdiocese(P, A, { direction: 'ParishToArchdiocese' });
assert.equal(last()[1], `parishes/${P}/payer-transfers/archdioceses/${A}`);

// the bishop's scope comes from capacities, and the overview carries the period
const scopes = await X.myScopes();
assert.deepEqual([scopes.operator, scopes.bishop, scopes.archdioceses.map(a => a.id)], [true, true, [A]]);
assert.equal((await X.bishopOverview(A, '2026-10-01T00:00:00Z', '2026-11-01T23:59:59Z')).archdioceseId, A);

// with audit.read the general trail replaces the partial one; visible actors are named, others show '—'
auditTrail = true;
await hydrate();
assert.deepEqual(
  D.AUDIT.map(a => [a.actorName, a.kind]),
  [
    ['—', 'create'],
    ['Office Writer', 'create']
  ],
  'general audit trail, newest first, with names'
);
assert.ok(gets.some(p => p.startsWith(`parishes/${P}/account-names?ids=`)));
assert.ok(!JSON.stringify(D.AUDIT).includes('reason'), 'the trail carries no reasons');
auditTrail = false;

// platform lists (operators): every page is read; filters go in the query
const parishes = await X.platformParishes({ q: 'saint', status: 'Verified' });
assert.deepEqual(
  parishes.map(p => p.id),
  [P, 'p2']
);
assert.ok(gets.some(p => p.startsWith('administration/parishes?q=saint&status=Verified&size=100')));
assert.equal((await X.platformAccounts({ status: 'Active' }))[0].value.accountId, U);

// account status and clergy titles: exact routes and bodies, with no credential sent
await X.suspendAccount(U, 'a1', 'Isolated reason');
assert.equal(`${last()[0]} ${last()[1]}`, `POST administration/accounts/${U}/suspend`);
assert.deepEqual([last()[2].version, last()[2].reason], ['a1', 'Isolated reason']);
assert.match(last()[2].operationId, /^[0-9a-f-]{36}$/);
assert.ok(!('currentPassword' in last()[2]));
await X.reinstateAccount(U, 'a2', 'Back');
assert.equal(last()[1], `administration/accounts/${U}/reinstate`);
await X.createClergyTitle({ title: null, titleAr: 'لقب', retired: false });
assert.deepEqual([last()[0], last()[1], last()[2].titleAr, last()[2].title], ['POST', 'clergy-titles', 'لقب', null]);
await X.assignClergyTitle(U, '', 't1');
assert.deepEqual(
  [last()[0], last()[1], last()[2].version, last()[2].clergyTitleId],
  ['PUT', `administration/accounts/${U}/clergy-title`, null, 't1']
);

console.log('administration: ok');
