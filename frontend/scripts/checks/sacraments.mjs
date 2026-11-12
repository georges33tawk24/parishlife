/* Purpose: checks the Sacraments module (src/portal/model/modules/sacraments.js) against an in-memory stand-in
   for the sacrament, certificate and anniversary routes: what load fills (statuses, dates, anniversaries from
   registered dates only), what each action sends (operation id, version, UTC instants), the two-step
   certificate send, and that direct edits of the lists are undone and reported.
   Run with `npm run check` from frontend/. */
import assert from 'node:assert/strict';
import { mockApi, json, signedIn } from '../mock-api.mjs';

const PERSON = 'a'.repeat(32),
  CASE = 'b'.repeat(32),
  REG = 'c'.repeat(32),
  CERT = 'd'.repeat(32);
const record = (id, sacrament, status, extra = {}) => ({
  version: `v-${id}`,
  value: {
    id,
    sacrament,
    subjectPersonId: PERSON,
    requestId: null,
    facts: { father: 'Elie', requestNotes: 'Please' },
    currentFacts: { father: 'Elie' },
    status,
    tentativeDate: '2026-12-20',
    timeline: [{ action: 'open', at: '2026-11-01T08:00:00Z' }],
    amendments: [],
    ...extra
  }
});
const certificate = (status, extra = {}) => ({
  version: 'cv1',
  value: {
    id: CERT,
    reference: 'CERT-DDDDDDDDDD',
    version: 1,
    subjectPersonId: PERSON,
    sacrament: 'Baptism',
    sourceRecordId: REG,
    language: 'en',
    quantity: 1,
    purpose: 'School',
    status,
    snapshot: { place: 'Saint Test', celebrantName: 'Fr. A', celebratedAt: '2016-06-12T09:00:00Z', father: 'Elie' },
    officialNumber: 'B/2016/9',
    authorizationCodes: [],
    ...extra
  }
});
let cases = [
  record(CASE, 'Marriage', 'Received'),
  record(REG, 'Baptism', 'Registered', {
    officialNumber: 'B/2016/9',
    celebratedAt: '2016-06-12T09:00:00Z',
    celebrantName: 'Fr. A',
    place: 'Saint Test',
    bookReference: 'Book 4, p. 12'
  })
];
let certs = [certificate('Received')];
const lastKind = [];
const { sent, events } = mockApi((method, path, body) => {
  let m;
  if ((m = path.match(/^parishes\/P\/sacraments\?sacrament=(\w+)&size=100(?:&cursor=(.+))?$/))) {
    lastKind.push(m[1]);
    const rows = cases.filter(c => c.value.sacrament === m[1]);
    return json(200, { items: rows, continuationToken: null });
  }
  if (path === 'parishes/P/certificates' && method === 'GET') return json(200, certs);
  if (path === 'parishes/P/sacraments/corrections')
    return json(200, [
      {
        version: 'k1',
        value: {
          id: 'k',
          recordId: REG,
          field: 'place',
          newValue: 'Saint Elias',
          reason: 'typo',
          evidence: 'book',
          proposedAt: '2026-11-02T10:00:00Z'
        }
      }
    ]);
  if (path.startsWith('parishes/P/sacraments/anniversaries?'))
    return json(200, [
      {
        recordId: REG,
        sacrament: 'Baptism',
        personId: PERSON,
        personName: 'Maya Haddad',
        celebratedOn: '2016-06-12',
        nextOn: '2026-12-01',
        years: 10
      }
    ]);
  if ((m = path.match(/^parishes\/P\/sacraments\/(\w+)\/actions$/)) && method === 'POST') {
    const c = cases.find(x => x.value.id === m[1]);
    c.value.status = { accept: 'Preparation', schedule: 'Scheduled' }[body.action] || c.value.status;
    c.version += '+';
    return json(200, c.value);
  }
  if (path === 'parishes/P/certificates' && method === 'POST') return json(200, { id: CERT, status: 'Received' });
  if (path === `parishes/P/certificates/${CERT}` && method === 'GET') return json(200, { ...certs[0], version: 'cv2' });
  if (path === `parishes/P/certificates/${CERT}/actions` && method === 'POST') {
    certs[0].value.status = { prepare: 'Prepared', submit: 'AwaitingSignature' }[body.action];
    certs[0].version = body.action === 'prepare' ? 'cv2' : 'cv3';
    return json(200, certs[0].value);
  }
  if (path === `parishes/P/certificates/${CERT}/authorization-preview`)
    return json(200, { contentHash: 'AB'.repeat(32), content: {}, statement: 'Not official.' });
  if (path === `parishes/P/certificates/${CERT}/authorization` && method === 'POST') return json(200, certs[0].value);
  if (path === 'parishes/P/people' && method === 'POST') return json(200, { id: 'newchild' });
  if (path === 'parishes/P/sacraments' && method === 'POST') return json(200, { id: 'newcase' });
});

const { session } = await import('../../src/portal/model/api.js');
const D = await import('../../src/portal/model/data.js');
const { hydrate, persist } = await import('../../src/portal/model/persist.js');
const S = await import('../../src/portal/model/modules/sacraments.js');

// not allowed without records permission: nothing is asked and the lists stay empty
signedIn(session, { roles: ['leader'], capabilities: [] });
await hydrate();
assert.equal(D.SACRAMENTS.length, 0);
assert.equal(lastKind.length, 0);

signedIn(session, { roles: ['secretary'], capabilities: ['sacraments.record'] });
await hydrate();
assert.equal(lastKind.length, 7, 'one search per register');
const marriage = D.SACRAMENTS.find(s => s.id === CASE);
assert.deepEqual(
  [marriage.kind, marriage.status, marriage.apiStatus, marriage.date, marriage.father],
  ['marriage', 'requested', 'Received', '2026-12-20', 'Elie']
);
assert.match(marriage.reg, /^SRQ\/BBBBBBBB$/, 'an open case has no official number');
const baptism = D.SACRAMENTS.find(s => s.id === REG);
assert.deepEqual(
  [baptism.status, baptism.reg, baptism.book, baptism.celebrantName],
  ['registered', 'B/2016/9', 'Book 4, p. 12', 'Fr. A']
);
assert.equal(baptism.pendingCorrections[0].to, 'Saint Elias');
const cert = D.SACRAMENTS.find(s => s.id === CERT);
assert.deepEqual(
  [cert.kind, cert.certificateOf, cert.status, cert.apiStatus, cert.date],
  ['certificate', 'baptism', 'draft', 'Received', '']
);
assert.deepEqual(
  D.anniversaryItems().map(a => [a.couple, a.years, a.on, a.kind, a.source]),
  [['Maya Haddad', 10, '2026-12-01', 'baptism', 'register']],
  'anniversaries come only from the API'
);
// the certificate prints from its frozen snapshot
assert.deepEqual(
  [S.docRecord(cert).place, S.docRecord(cert).reg, S.docRecord(cert).date],
  ['Saint Test', 'B/2016/9', '2016-06-12']
);

// a sacrament action carries the record's version and a fresh operation id, then reloads
await S.sacramentAction(CASE, 'accept');
let [method, path, body] = sent.at(-1);
assert.equal(`${method} ${path}`, `POST parishes/P/sacraments/${CASE}/actions`);
assert.deepEqual([body.action, body.version], ['accept', `v-${CASE}`]);
assert.match(body.operationId, /^[0-9a-f-]{36}$/);
assert.equal(D.SACRAMENTS.find(s => s.id === CASE).status, 'preparing', 'the screen shows what the API stored');

// scheduling sends an explicit UTC instant
await S.sacramentAction(CASE, 'schedule', { scheduledAt: S.toUtc('2030-05-01', '10:30'), celebrantName: 'Fr. A' });
body = sent.at(-1)[2];
assert.match(body.scheduledAt, /Z$/);
assert.equal(new Date(body.scheduledAt).getTime(), new Date('2030-05-01T10:30:00').getTime());
assert.match(S.toUtc('2030-05-01'), /T\d\d:\d\d:00\.000Z$/);

// creating a case and a certificate
await S.createSacrament({
  kind: 'communion',
  person: PERSON,
  requestedDate: '2026-12-01',
  facts: { requestNotes: 'x', father: '' }
});
[, path, body] = sent.at(-1);
assert.equal(path, 'parishes/P/sacraments');
assert.deepEqual(
  [body.sacrament, body.subjectPersonId, body.tentativeDate, body.facts],
  ['FirstCommunion', PERSON, '2026-12-01', { requestNotes: 'x' }]
);
await S.createChildAndSacrament({
  given: 'Lea',
  family: 'Khoury',
  born: '2025-01-02',
  father: 'Joe',
  mother: '',
  requestedDate: '',
  requestNotes: ''
});
assert.deepEqual(sent.at(-2).slice(0, 2), ['POST', 'parishes/P/people']);
assert.equal(sent.at(-1)[2].subjectPersonId, 'newchild');
await S.createCertificate({
  kind: 'baptism',
  person: PERSON,
  sourceRecordId: REG,
  language: 'fr',
  quantity: 2,
  purpose: 'School'
});
body = sent.at(-1)[2];
assert.deepEqual([body.sacrament, body.sourceRecordId, body.language, body.quantity], ['Baptism', REG, 'fr', 2]);

// "send to the priest" prepares, then submits with the version the first step produced
const before = sent.length;
await S.sendCertificate(CERT);
const steps = sent.slice(before).map(([, , b]) => [b.action, b.version]);
assert.deepEqual(steps, [
  ['prepare', 'cv1'],
  ['submit', 'cv2']
]);
assert.equal(D.SACRAMENTS.find(s => s.id === CERT).status, 'awaiting-signature');

// electronic authorization is bound to the previewed content hash and never sends the code twice
await S.authorizeCertificate(CERT, '123 456');
body = sent.at(-1)[2];
assert.deepEqual([body.expectedContentHash, body.authenticatorCode, body.version], ['AB'.repeat(32), '123456', 'cv3']);

// a refusal from the API is shown as its own words
await assert.rejects(S.sacramentAction('missing', 'accept'), /no longer in the list/);

// direct edits of the lists are undone and reported, never left looking saved
const writes = sent.length;
D.SACRAMENTS.push({ id: 'x', kind: 'baptism' });
D.ANNIVERSARIES.length = 0;
assert.equal(await persist(), false);
assert.equal(sent.length, writes);
assert.ok(!D.SACRAMENTS.some(s => s.id === 'x'));
assert.equal(D.ANNIVERSARIES.length, 1);
assert.ok(events.at(-1));

console.log('sacraments: all assertions passed');
