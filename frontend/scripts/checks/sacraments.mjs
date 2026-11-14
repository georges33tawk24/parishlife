/* Purpose: checks the Sacraments module (src/portal/model/modules/sacraments.js) against an in-memory stand-in
   for the sacrament, certificate and anniversary routes: what load fills (statuses, dates, anniversaries from
   registered dates only), what each action sends (operation id, version, UTC instants), the two-step
   certificate send, and that direct edits of the lists are undone and reported. Also: Arabic twins, book and
   page, the office review, the parish's requirement lists and a case's checklist, request amendments, request
   dates, actor names (account-names mocked), and the priest's signature image (metadata, multipart upload,
   removal, and the copy attached to a signed certificate as a data URL).
   Run with `npm run check` from frontend/. */
import assert from 'node:assert/strict';
import { mockApi, json, signedIn } from '../mock-api.mjs';

const PERSON = 'a'.repeat(32),
  CASE = 'b'.repeat(32),
  REG = 'c'.repeat(32),
  CERT = 'd'.repeat(32),
  REVIEWED = 'e'.repeat(32),
  PREP = 'f'.repeat(32),
  PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const png = () => new Response(PNG, { status: 200, headers: { 'Content-Type': 'image/png' } });
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
    celebrantNameAr: 'الأب أ',
    place: 'Saint Test',
    placeAr: 'مار تست',
    witnessesAr: 'العرّاب',
    bookReference: 'Book 4',
    registerPage: '12',
    createdAt: '2016-05-01T08:00:00Z',
    createdBy: 'acc1',
    timeline: [{ action: 'open', at: '2016-05-01T08:00:00Z', actorAccountId: 'acc1' }]
  }),
  record(REVIEWED, 'Confirmation', 'Received', {
    officeReviewedAt: '2026-11-02T08:00:00Z',
    officeReviewedBy: 'acc1',
    officeReviewNote: 'Papers seen'
  }),
  record(PREP, 'FirstCommunion', 'Preparation', {
    requirements: [
      { key: 'k1', label: 'Class', labelAr: null, met: true, recordedBy: 'acc1', recordedAt: '2026-11-03T08:00:00Z' },
      { key: 'k2', label: null, labelAr: 'اعتراف', met: false }
    ],
    requirementsBlockScheduling: true,
    requestAmendments: [
      {
        id: 'am',
        status: 'Pending',
        tentativeDate: '2026-12-27',
        facts: { requestNotes: 'Later' },
        reason: 'Family travel',
        proposedBy: 'acc1',
        proposedAt: '2026-11-04T08:00:00Z'
      }
    ]
  })
];
let certs = [certificate('Received')];
let signature = { hasImage: false, version: null };
const lastKind = [];
const { sent, events } = mockApi((method, path, body) => {
  let m;
  if (path.startsWith('parishes/P/account-names?ids='))
    return json(200, path.includes('acc1') ? [{ accountId: 'acc1', displayName: 'Rita Office' }] : []);
  if (path === 'parishes/P/sacraments/requirements' && method === 'GET')
    return json(200, [
      {
        sacrament: 'Baptism',
        version: 'rv1',
        items: [{ key: 'k1', label: 'Class', labelAr: null }],
        blockSchedulingUntilMet: true
      }
    ]);
  if (path === 'parishes/P/sacraments/requirements' && method === 'PUT')
    return json(200, { sacrament: body.sacrament, version: 'rv2', items: body.items });
  if (path === 'parishes/P/clergy-signature-image' && method === 'GET') return json(200, signature);
  if (path === 'parishes/P/clergy-signature-image/content') return png();
  if (path === 'parishes/P/clergy-signature-image/remove' && method === 'POST') {
    signature = { hasImage: false, version: 'sv2' };
    return json(200, signature);
  }
  if (path === `parishes/P/certificates/${CERT}/signature-image`) return png();
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

// the multipart upload carries FormData, which the shared stand-in does not parse; it is answered here
const uploads = [];
const answer = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  if (String(url) === '/api/parishes/P/clergy-signature-image' && options.method === 'POST') {
    uploads.push({ form: options.body, csrf: options.headers?.['X-CSRF-TOKEN'] });
    signature = { hasImage: true, id: 'img', version: 'sv1', contentType: 'image/png' };
    return json(200, signature);
  }
  return answer(url, options);
};

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
  ['registered', 'B/2016/9', 'Book 4', 'Fr. A']
);
// Arabic twins come only from their own fields, book and page apart, the request date and who made it
assert.deepEqual(
  [baptism.celebrantNameAr, baptism.placeAr, baptism.godparentsAr, baptism.page, baptism.fatherAr],
  ['الأب أ', 'مار تست', 'العرّاب', '12', '']
);
assert.deepEqual([baptism.requestedAt, baptism.requestedBy], ['2016-05-01T08:00:00Z', 'Rita Office']);
assert.equal(baptism.history[0].by, 'Rita Office', 'actor names come from the account-names lookup');
assert.equal(D.SACRAMENTS.find(s => s.id === CASE).requestedBy, '', 'an id the lookup does not reveal stays empty');
// the office review shows as its own status while the API status stays Received
const reviewed = D.SACRAMENTS.find(s => s.id === REVIEWED);
assert.deepEqual(
  [reviewed.status, reviewed.apiStatus, reviewed.officeReviewedBy, reviewed.officeReviewNote],
  ['office-reviewed', 'Received', 'Rita Office', 'Papers seen']
);
// the checklist and the change awaiting the priest
const prep = D.SACRAMENTS.find(s => s.id === PREP);
assert.deepEqual(
  prep.requirements.map(r => [r.key, r.label, r.labelAr, r.met, r.recordedBy]),
  [
    ['k1', 'Class', '', true, 'Rita Office'],
    ['k2', '', 'اعتراف', false, '']
  ]
);
assert.equal(prep.requirementsBlockScheduling, true);
assert.deepEqual(
  [
    prep.pendingAmendment.date,
    prep.pendingAmendment.notes,
    prep.pendingAmendment.reason,
    prep.pendingAmendment.proposedBy
  ],
  ['2026-12-27', 'Later', 'Family travel', 'Rita Office']
);
// the parish's own lists; a sacrament without one has none
assert.deepEqual(S.requirementSetFor('baptism').items, [{ key: 'k1', label: 'Class', labelAr: '' }]);
assert.equal(S.requirementSetFor('marriage'), null);
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

// office review, checklist, sync and request amendments are one action each, with the record's version
await S.officeReview(CASE, 'Seen');
body = sent.at(-1)[2];
assert.deepEqual([body.action, body.reason], ['office-review', 'Seen']);
await S.setRequirement(PREP, 'k2', false);
body = sent.at(-1)[2];
assert.deepEqual(
  [body.action, body.requirementKey, body.requirementMet, body.version],
  ['requirement', 'k2', false, `v-${PREP}`]
);
await S.syncRequirements(PREP);
assert.equal(sent.at(-1)[2].action, 'sync-requirements');
await S.proposeAmendment(PREP, { date: '', facts: { requestNotes: '' }, reason: 'Clear the notes' });
body = sent.at(-1)[2];
assert.deepEqual(
  [body.action, body.tentativeDate, body.facts, body.reason],
  ['propose-amendment', undefined, { requestNotes: '' }, 'Clear the notes'],
  'an empty value asks the priest to remove that detail'
);
await S.decideAmendment(PREP, true);
assert.deepEqual([sent.at(-1)[2].action, sent.at(-1)[2].reason], ['approve-amendment', undefined]);
await S.decideAmendment(PREP, false, 'No');
assert.deepEqual([sent.at(-1)[2].action, sent.at(-1)[2].reason], ['reject-amendment', 'No']);
// Arabic spellings and the page are sent as typed, never copied from the Latin fields
await S.sacramentAction(CASE, 'register', { bookReference: 'Book 5', registerPage: '7' });
body = sent.at(-1)[2];
assert.deepEqual([body.bookReference, body.registerPage], ['Book 5', '7']);
await S.sacramentAction(CASE, 'record-celebration', { placeAr: 'الكنيسة', place: '', celebrantNameAr: 'الأب' });
body = sent.at(-1)[2];
assert.deepEqual([body.placeAr, 'place' in body, body.celebrantNameAr], ['الكنيسة', false, 'الأب']);

// the priest saves the parish's own list with its current version
await S.saveRequirementSet('baptism', [{ key: 'k1', label: 'Class', labelAr: 'صف' }], false);
[method, path, body] = sent.at(-1);
assert.equal(`${method} ${path}`, 'PUT parishes/P/sacraments/requirements');
assert.deepEqual(
  [body.sacrament, body.version, body.items, body.blockSchedulingUntilMet],
  ['Baptism', 'rv1', [{ key: 'k1', label: 'Class', labelAr: 'صف' }], false]
);

// the signature image: metadata, a multipart upload with a CSRF token, removal by version, never JSON bytes
assert.equal((await S.mySignatureImage()).hasImage, false);
const saved = await S.uploadSignatureImage(new File([PNG], 'sig.png', { type: 'image/png' }));
assert.equal(saved.hasImage, true);
assert.match(uploads[0].csrf, /^t\d+$/);
assert.match(uploads[0].form.get('operationId'), /^[0-9a-f-]{36}$/);
assert.equal(uploads[0].form.get('file').type, 'image/png');
assert.match(await S.mySignatureImageData(), /^data:image\/png;base64,/);
await S.removeSignatureImage('sv1');
[method, path, body] = sent.at(-1);
assert.equal(`${method} ${path}`, 'POST parishes/P/clergy-signature-image/remove');
assert.equal(body.version, 'sv1');
// a signed certificate's attached image is fetched once and kept for printing
const signedCert = { id: CERT, hasSignatureImage: true, signedAt: '2026-11-05T08:00:00Z' };
assert.equal(S.certificateImage(signedCert), '');
assert.match(await S.loadCertificateImage(signedCert), /^data:image\/png;base64,iVBORw0KGgo/);
assert.equal(S.certificateImage(signedCert), await S.loadCertificateImage(signedCert));
assert.equal(await S.loadCertificateImage({ id: CERT, hasSignatureImage: false }), '');

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
