/* Purpose: checks the Requests module against an in-memory stand-in for ParishLife.Api: the office queue
   and the person's own requests load (paged with size and cursor, guests kept apart), the actions send the
   right routes and bodies (versions, operation ids), the form's answers become the API's request, files
   upload as multipart with the token, and the public guest routes carry the tracking token in a header. */
process.env.TZ = 'UTC';
import assert from 'node:assert/strict';
import { mockApi, json, signedIn } from '../mock-api.mjs';

const dto = (id, patch = {}) => ({
  id,
  reference: 'R-' + id,
  kind: 'General',
  summary: 'Request',
  details: {},
  preferredDates: null,
  origin: 'Online',
  applicantAccountId: null,
  claimantAccountId: null,
  requesterName: null,
  requesterContact: null,
  subjectPersonId: null,
  subjectDescription: null,
  relationship: 'Self',
  authorityBasis: null,
  authorityReviewed: false,
  status: 'Received',
  statusMeaning: 'Received: saved for review.',
  acceptedAt: null,
  clergyApprovedAt: null,
  confirmedDate: null,
  completedAt: null,
  applicantExplanation: null,
  urgency: null,
  checklist: [],
  links: [],
  receivedAt: '2026-11-02T09:00:00Z',
  updatedAt: '2026-11-02T09:00:00Z',
  ...patch
});
const queue = [
  {
    value: dto('q1', {
      kind: 'Certificate',
      summary: 'Certificate',
      details: { certificateOf: 'baptism', purpose: 'Marriage file' }
    }),
    version: 'v1'
  },
  {
    value: dto('q2', {
      origin: 'Guest',
      requesterName: 'Visitor',
      requesterContact: 'v@example.org',
      details: { description: 'Hello' }
    }),
    version: 'v2'
  }
];
const mine = [
  {
    value: dto('m1', {
      kind: 'SacramentInquiry',
      details: { sacrament: 'baptism', childLat: 'Maya', childAr: 'مايا', childBorn: '2026-09-01' },
      relationship: 'Parent',
      subjectDescription: 'Maya',
      status: 'AcceptedForProcessing',
      acceptedAt: '2026-11-03T10:00:00Z',
      confirmedDate: '2026-12-06T09:30:00Z'
    }),
    version: 'w1'
  }
];
const file = {
  id: 'f1',
  version: 'fv1',
  fileName: 'id.pdf',
  contentType: 'application/pdf',
  size: 10,
  status: 'Active',
  uploaderRole: 'Office',
  uploadedAt: '2026-11-04T10:00:00Z'
};
const uploads = [];
const { sent } = mockApi((method, path, body, options) => {
  if (method === 'GET' && path.startsWith('parishes/P/requests/mine?'))
    return json(200, { items: mine, continuationToken: null });
  if (method === 'GET' && path === 'parishes/P/requests?size=100')
    return json(200, { items: [queue[0]], continuationToken: 'next' });
  if (method === 'GET' && path === 'parishes/P/requests?size=100&cursor=next')
    return json(200, { items: [queue[1]], continuationToken: null });
  if (method === 'GET' && path === 'parishes/P/requests/q1') return json(200, queue[0]);
  if (path.startsWith('parishes/P/requests/q1/actions'))
    return json(200, dto('q1', { status: 'AcceptedForProcessing' }));
  if (path === 'parishes/P/requests' && method === 'POST') return json(200, dto('new1'));
  if (path === 'parishes/P/requests/q1/checklist') return json(200, dto('q1'));
  if (path === 'parishes/P/requests/q1/messages' && method === 'POST') return json(200, { id: 'x' });
  if (path === 'parishes/P/requests/q1/files' && method === 'GET') return json(200, [file]);
  if (path === 'parishes/P/requests/q1/files/f1/remove') return json(200, { ...file, status: 'Removed' });
  if (path === 'parishes/P/requests/q2/rotate-tracking')
    return json(200, { reference: 'R-q2', requestId: 'q2', trackingToken: 'NEWTOKENNEWTOKENNEWTOKEN' });
  if (path === 'parishes/P/requests/q2/association') return json(200, dto('q2'));
  if (path.startsWith('parishes/G1/requests/G2/claim')) {
    assert.equal(options.headers['X-ParishLife-Tracking'], 'TOKENTOKENTOKENTOKEN');
    return json(200, dto('q2'));
  }
  if (path === 'public/parishes/G1/requests' && method === 'POST') {
    assert.equal(options.headers['X-Turnstile-Token'], 'bot-ok');
    return json(200, { reference: 'R-X', requestId: 'G2', trackingToken: 'TOKENTOKENTOKENTOKEN' });
  }
  if (path === 'public/parishes/G1/requests/G2' && method === 'GET') {
    assert.equal(options.headers['X-ParishLife-Tracking'], 'TOKENTOKENTOKENTOKEN');
    return json(200, dto('G2', { status: 'NeedsInformation', applicantExplanation: 'Send the form' }));
  }
  if (path === 'public/parishes/G1/requests/G2/messages' && method === 'POST') return json(200, { id: 'gm' });
});
// the shared stand-in parses every body as JSON, so a multipart upload is answered here
const jsonFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  if (options.body instanceof FormData) {
    uploads.push([options.headers, options.body]);
    return json(200, file);
  }
  return jsonFetch(url, options);
};
const { session } = await import('../../src/portal/model/api.js');
signedIn(session, { roles: ['secretary'], capabilities: ['requests.manage'] });
session.user.name = 'Test Account';
session.accountUser = { id: 'acct' };
globalThis.location = new URL('https://example.org/portal/index.html');
const D = await import('../../src/portal/model/data.js');
const R = await import('../../src/portal/model/modules/requests.js');
const G = await import('../../src/portal/model/guest-requests.js');

// loading: every page of the queue (size and cursor), guests kept by origin, own requests as the applicant sees them
const d = { MEMBER_REQUESTS: [], MY_REQUESTS: [] };
await R.load(session.parishes[0], d);
assert.deepEqual(
  d.MEMBER_REQUESTS.map(r => [r.id, r.kind, r.status, r.origin]),
  [
    ['q1', 'certificate', 'submitted', 'Online'],
    ['q2', 'custom', 'submitted', 'Guest']
  ]
);
assert.equal(d.MEMBER_REQUESTS[0].details.certificateOf, 'baptism');
const m = d.MY_REQUESTS[0];
assert.deepEqual(
  [m.kind, m.status, m.progress.stage, m.progress.plannedDate, m.progress.plannedTime],
  ['baptism', 'accepted', 'scheduled', '2026-12-06', '09:30']
);
assert.deepEqual(m.details.child, { lat: 'Maya', ar: 'مايا', born: '2026-09-01', father: '', mother: '' });
assert.deepEqual(
  m.progress.events.map(e => e.key),
  ['submitted', 'accepted'],
  'only moments the API recorded'
);
assert.equal(m.subject.new, true);
assert.equal(m.api.version, 'w1');
// a member without office access gets no queue (and a 403 would leave it empty)
const member = { id: 'P', roles: ['member'], capabilities: [] };
const e = { MEMBER_REQUESTS: [], MY_REQUESTS: [] };
await R.load(member, e);
assert.equal(e.MEMBER_REQUESTS.length, 0);
assert.equal(e.MY_REQUESTS.length, 1);
// both collections are read-only on screen
assert.equal((await R.save({ MY_REQUESTS: [] }, { MY_REQUESTS: [{ id: 'x' }] })).unsupported, true);
assert.equal((await R.save({ MY_REQUESTS: [] }, { MY_REQUESTS: [] })).unsupported, false);

// an office action sends the version and a fresh operation id; empty fields are left out
await R.act('q1', 'v1', 'return', { explanation: 'Please send the form', assignedTo: '' });
let [method, path, body] = sent.at(-1);
assert.equal(`${method} ${path}`, 'POST parishes/P/requests/q1/actions');
assert.match(body.operationId, /^[0-9a-f-]{36}$/);
assert.deepEqual(
  { ...body, operationId: 0 },
  { operationId: 0, version: 'v1', action: 'return', explanation: 'Please send the form' }
);

// the checklist goes whole, message audiences are explicit
await R.setChecklist('q1', 'v1', [
  { key: 'id', label: 'ID', required: true, status: 'Received', paperReference: 'p. 3', extra: 1 }
]);
body = sent.at(-1)[2];
assert.deepEqual(body.items, [{ key: 'id', label: 'ID', required: true, status: 'Received', paperReference: 'p. 3' }]);
await R.postMessage('q1', 'Internal', 'note');
assert.deepEqual([sent.at(-1)[2].audience, sent.at(-1)[2].body], ['Internal', 'note']);

// the form's answers become the API's request: kind, details dictionary, relationship
await R.submitOwn({
  kind: 'baptism',
  notes: 'Soon',
  phone: '03 111 222',
  date: '2027-01-10',
  relationship: 'Parent',
  authorityBasis: 'Her mother',
  subjectDescription: 'Maya',
  child: { lat: 'Maya', ar: 'مايا', born: '2026-09-01', father: '', mother: '' }
});
body = sent.at(-1)[2];
assert.equal(body.kind, 'SacramentInquiry');
assert.deepEqual(body.details, {
  notes: 'Soon',
  phone: '03 111 222',
  date: '2027-01-10',
  childLat: 'Maya',
  childAr: 'مايا',
  childBorn: '2026-09-01',
  sacrament: 'baptism'
});
assert.deepEqual([body.relationship, body.authorityBasis, body.preferredDates], ['Parent', 'Her mother', '2027-01-10']);
await R.submitOwn({ kind: 'custom', subject: 'House blessing', message: 'Please', date: '', phone: '' });
body = sent.at(-1)[2];
assert.deepEqual([body.kind, body.relationship, body.subjectDescription], ['Blessing', 'Self', null]);
await R.submitOwn({
  kind: 'booking',
  venue: 'Parish hall',
  date: '2027-02-01',
  from: '10:00',
  to: '12:00',
  guests: 40
});
body = sent.at(-1)[2];
assert.deepEqual([body.kind, body.details.guests, body.preferredDates], ['Facility', '40', '2027-02-01 10:00-12:00']);

// files: listed, uploaded as multipart with the anti-forgery token, removed with the file's version and a reason
assert.equal((await R.listFiles('q1'))[0].fileName, 'id.pdf');
await R.uploadFile('q1', new Blob(['%PDF-1.4'], { type: 'application/pdf' }), {});
assert.ok(uploads[0][1] instanceof FormData && uploads[0][0]['X-CSRF-TOKEN']);
assert.match(uploads[0][1].get('operationId'), /^[0-9a-f-]{36}$/);
await R.removeFile('q1', 'f1', 'fv1', 'wrong person');
body = sent.at(-1)[2];
assert.deepEqual([body.version, body.reason], ['fv1', 'wrong person']);

// A13: replacing a leaked link shows the new token once, in a link that carries parish, request and token
const receipt = await R.rotateTracking('q2', 'v2', 'Leaked on social media');
assert.equal(sent.at(-1)[2].reason, 'Leaked on social media');
const link = G.trackingLink(receipt, '00000000-0000-4000-8000-000000000001');
assert.equal(
  link,
  'https://example.org/portal/public.html#track=00000000-0000-4000-8000-000000000001.q2.NEWTOKENNEWTOKENNEWTOKEN'
);
await R.decideAssociation('q2', 'v2', true, 'Seen ID');
assert.deepEqual([sent.at(-1)[2].approve, sent.at(-1)[2].evidenceReference], [true, 'Seen ID']);
await R.decideAssociation('q2', 'v2', false, 'Not them');
assert.equal(sent.at(-1)[2].reason, 'Not them');

// guests: the link round-trips, the token travels in a header, the bot check in its own header
const P = '00000000-0000-4000-8000-000000000001',
  Q = '00000000-0000-4000-8000-000000000002';
const parsed = G.parseTracking(`https://x/public.html#track=${P}.${Q}.TOKENTOKENTOKENTOKEN`);
assert.deepEqual(parsed, { parishId: P, requestId: Q, token: 'TOKENTOKENTOKENTOKEN' });
assert.equal(G.parseTracking('TOKENTOKENTOKENTOKEN'), null);
assert.deepEqual(G.publicKind('marriage'), ['SacramentInquiry', 'Marriage']);
assert.equal(G.publicKind('ministry')[0], 'MinistryInquiry');
await assert.rejects(G.guestSubmit('bad', {}), /./); // unknown route is reported, not swallowed
const g = await G.guestSubmit(
  'G1',
  {
    kind: 'General',
    summary: 's',
    details: { description: 'd' },
    requesterName: 'n',
    requesterContact: 'c',
    subjectDescription: 'n',
    relationship: 'Self'
  },
  'bot-ok'
);
assert.deepEqual([g.requestId, g.trackingToken], ['G2', 'TOKENTOKENTOKENTOKEN']);
assert.match(sent.find(x => x[1] === 'public/parishes/G1/requests')[2].operationId, /^[0-9a-f-]{36}$/);
const shown = await G.guestCase({ parishId: 'G1', requestId: 'G2', token: 'TOKENTOKENTOKENTOKEN' });
assert.equal(shown.applicantExplanation, 'Send the form');
await G.guestPostMessage({ parishId: 'G1', requestId: 'G2', token: 'TOKENTOKENTOKENTOKEN' }, 'Here it is');
assert.deepEqual([sent.at(-1)[2].audience, sent.at(-1)[2].body], ['Applicant', 'Here it is']);
// a signed-in account presents the token to claim the case; the office decides afterwards
await R.claimGuest({ parishId: 'G1', requestId: 'G2', token: 'TOKENTOKENTOKENTOKEN' });
assert.equal(sent.at(-1)[1], 'parishes/G1/requests/G2/claim');
void D;
console.log('requests: all assertions passed');
