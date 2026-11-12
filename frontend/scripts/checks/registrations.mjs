/* Purpose: checks the Registrations module (src/portal/model/modules/registrations.js) against an in-memory
   stand-in for the event registration routes: what load() fills for an office account and for a door-only
   account, no demo text left over, cursor paging, that every action sends the body the API's DTOs expect
   (operation id, version, form version), that a local edit is undone and reported, and the member's own
   registration calls. */
import assert from 'node:assert/strict';
import { mockApi, json, signedIn } from '../mock-api.mjs';

const E1 = '11111111-1111-4111-8111-111111111111',
  E2 = '22222222-2222-4222-8222-222222222222',
  F1 = '33333333-3333-4333-8333-333333333333',
  R1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  R2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  REF = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const base = `parishes/P/calendar/events/${E1}`;
const ev = (id, kind = 'ParishActivity', status = 'Confirmed') => ({
  value: {
    id,
    kind,
    status,
    title: `Event ${id.slice(0, 2)}`,
    startsAt: '2026-12-05T15:00:00Z',
    endsAt: '2026-12-05T18:00:00Z',
    timeZone: 'Asia/Beirut',
    redacted: false
  },
  version: 'ev'
});
const policy = status => ({
  value: {
    id: E1,
    eventId: E1,
    formVersionId: F1,
    status,
    capacity: 2,
    transportCapacity: 1,
    fee: 20,
    currency: 'USD',
    precision: 2,
    waitlistAllowed: true,
    minimumAge: null,
    maximumAge: 17,
    childAgeThreshold: 12,
    consentRequired: true,
    consentText: 'I consent.',
    doorAccountIds: ['door']
  },
  version: 'pv1'
});
const reg = (id, status, extra = {}) => ({
  value: {
    id,
    eventId: E1,
    personId: 'p-' + id.slice(0, 2),
    formVersionId: F1,
    origin: 'Office',
    status,
    transport: false,
    answers: { diet: 'none' },
    consentEvidence: null,
    guardianAuthorityEvidence: null,
    collectors: [{ id: 'k1', name: 'Nada', authorityEvidence: 'ID seen' }],
    independentDeparture: false,
    fee: 20,
    currency: 'USD',
    received: 0,
    refunded: 0,
    createdAt: '2026-11-01T10:00:00Z',
    offerUntil: null,
    presence: 'NotArrived',
    lastPresenceAt: null,
    ...extra
  },
  version: 'rv-' + id.slice(0, 2)
});
const regs = [
  reg(R1, 'Confirmed', { received: 20, presence: 'Present', lastPresenceAt: '2026-12-05T15:05:00Z' }),
  reg(R2, 'Waitlisted')
];
const door = r => ({
  value: {
    id: r.value.id,
    eventId: E1,
    displayName: r.value.id === R1 ? 'Georges Haddad' : 'Maya Haddad',
    status: r.value.status,
    presence: r.value.presence,
    lastPresenceAt: r.value.lastPresenceAt,
    independentDeparture: false,
    collectors: [{ id: 'k1', name: 'Nada' }]
  },
  version: r.version
});
const form = {
  id: F1,
  eventId: E1,
  fields: [
    {
      key: 'diet',
      label: 'Dietary needs',
      type: 'Text',
      required: false,
      options: [],
      visibleWhenField: null,
      visibleWhenValue: null
    }
  ],
  createdAt: '2026-11-01T10:00:00Z'
};

let denyDoorFor = null,
  policyStatus = 'Open';
const calls = [];
const handler = (method, path, body) => {
  calls.push(`${method} ${path}`);
  const [route, query = ''] = path.split('?');
  if (route === 'parishes/P/people') return json(200, { items: [], continuationToken: null }); // the People module loads too
  if (route === 'parishes/P/calendar/events')
    return json(200, {
      items: [
        ev(E1),
        ev(E2),
        ev('44444444-4444-4444-8444-444444444444', 'Mass'),
        ev('55555555-5555-4555-8555-555555555555', 'ParishActivity', 'Cancelled')
      ],
      continuationToken: null
    });
  if (route === `${base}/registration`)
    return method === 'GET' ? json(200, policy(policyStatus)) : json(200, policy('Draft').value);
  if (method === 'GET' && route.startsWith(`parishes/P/calendar/events/${E2}/`))
    return json(404, {
      status: 404,
      title: 'registration_resource_unavailable',
      detail: 'The requested event registration resource is unavailable.'
    });
  if (route === `${base}/registration/forms/${F1}`) return json(200, form);
  if (route === `${base}/registrations` && method === 'GET')
    // two pages, paged by cursor
    return query.includes('cursor=next')
      ? json(200, { items: [regs[1]], continuationToken: null })
      : json(200, { items: [regs[0]], continuationToken: 'next' });
  if (route === `${base}/registrations/cashier`)
    return json(403, { status: 403, title: 'forbidden', detail: 'No finance permission.' });
  if (route === `${base}/registrations/door`)
    return denyDoorFor
      ? json(403, {
          status: 403,
          title: 'event_assignment_required',
          detail: 'An explicit assignment to this event is required.'
        })
      : json(200, { items: regs.filter(r => r.value.status === 'Confirmed').map(door), continuationToken: null });
  if (route === `${base}/present`)
    return json(200, {
      eventId: E1,
      asOf: '2026-12-05T15:30:00Z',
      coverage: 'Recorded present participants for this event only.',
      entries: [
        {
          registrationId: R1,
          personId: 'p-aa',
          displayName: 'Georges Haddad',
          presence: 'Present',
          lastPresenceAt: '2026-12-05T15:05:00Z'
        }
      ]
    });
  if (route === `${base}/registrations/${R1}/movements`)
    return json(200, {
      items: [
        {
          value: {
            id: 'm1',
            registrationId: R1,
            kind: 'CashReceived',
            amount: 20,
            currency: 'USD',
            evidenceReference: 'receipt 7',
            occurredAt: '2026-11-02T09:00:00Z',
            recordedAt: '2026-11-02T09:01:00Z',
            recordedBy: 'u'
          },
          version: 'mv'
        }
      ],
      continuationToken: null
    });
  if (route === `${base}/registrations/${R1}/refunds` && method === 'GET')
    return json(200, {
      items: [
        {
          value: {
            id: REF,
            registrationId: R1,
            amount: 5,
            currency: 'USD',
            status: 'Requested',
            reason: 'Could not attend',
            requestedBy: 'u',
            requestedAt: '2026-11-03T09:00:00Z',
            approvedBy: null,
            recordedBy: null
          },
          version: 'fv'
        }
      ],
      continuationToken: null
    });
  if (method !== 'GET') return json(200, { ok: true });
  if (route.includes('/registrations/') && route.endsWith('/refunds'))
    return json(200, { items: [], continuationToken: null });
  if (route.endsWith('/movements')) return json(200, { items: [], continuationToken: null });
  if (route === `${base}/registration/applicant-form`) return json(200, { eventId: E1, formVersionId: F1, fields: [] });
  if (route === `${base}/registrations/mine`) return json(200, regs[1]);
  return undefined;
};

const { sent, events } = mockApi(handler);
const { session } = await import('../../src/portal/model/api.js');
const D = await import('../../src/portal/model/data.js');
const { hydrate, persist } = await import('../../src/portal/model/persist.js');
const M = await import('../../src/portal/model/modules/registrations.js');

/* ---- an office account (the priest) ---- */
signedIn(session, { roles: ['priest'] });
await hydrate();
assert.equal(D.REGISTRATIONS.length, 1, 'only the event with a policy is a form');
const f = D.REGISTRATIONS[0];
assert.deepEqual(
  [f.id, f.eventId, f.event, f.d, f.t, f.open, f.cap, f.fee, f.currency, f.known],
  [E1, E1, 'Event 11', '2026-12-05', '17:00', true, 2, 20, 'USD', true],
  'the policy, on the event’s own clock'
);
assert.equal(f.taken, 1, 'one confirmed seat');
assert.equal(f.waiting, 1, 'one waiting');
assert.equal(f.fields[0].key, 'diet', 'the pinned form’s questions');
assert.equal(f.deadline, '', 'the API has no deadline, so none is shown');
assert.deepEqual(
  M.availableEvents.map(e => e.id),
  [E2],
  'the event with no policy can be configured; Masses and cancelled events are left out'
);
assert.equal(D.REGISTRANTS.length, 2, 'both pages of registrations are read (paged by cursor)');
const r1 = D.REGISTRANTS.find(r => r.id === R1);
assert.deepEqual(
  [r1.status, r1.paid, r1.outstanding, r1.presence, r1.version],
  ['Confirmed', 20, 0, 'Present', 'rv-aa'],
  'seat, money, presence and version'
);
assert.equal(r1.name, 'Georges Haddad', 'the door view supplies the name');
assert.equal(r1.payments[0].reference, 'receipt 7', 'receipts come from the movements');
assert.equal(D.REFUNDS.length, 1, 'refund requests are listed');
assert.deepEqual([D.REFUNDS[0].status, D.REFUNDS[0].why, D.REFUNDS[0].formId], ['Requested', 'Could not attend', E1]);
assert.equal(D.CHECKIN.sessions[E1].present, 1, 'the present roster');
assert.equal(D.CHECKIN.sessions[E1].expected, 1, 'confirmed participants are the expected ones');
assert.equal(D.CHECKIN.sessions[E1].rows[0].in, '17:05', 'arrival on the event’s clock');
assert.deepEqual(D.PICKUP[R1].approved, [{ id: 'k1', name: 'Nada', evidence: 'ID seen' }], 'collectors');
assert.deepEqual(D.PICKUP[R1].restricted, [], 'the API has no do-not-release entries');
for (const [k, v] of [
  [D.REG_FORM.title, ''],
  [D.CHECKIN.session, ''],
  [D.EVACUATION.muster, '']
])
  assert.equal(v, k, 'no demo text is left over');
assert.equal(D.EVACUATION.rooms.length, 0, 'no rooms');
assert.ok(
  !calls.some(c => c.includes('/55555555') || c.includes('/44444444')),
  'a Mass and a cancelled event are not asked for a policy'
);

/* ---- writes ---- */
const lastWrite = () => sent[sent.length - 1];
await M.configureRegistration(E2, {
  capacity: 10,
  currency: 'USD',
  precision: 2,
  childAgeThreshold: 12,
  doorAccountIds: ['door'],
  fields: []
});
let [m, p, b] = lastWrite();
assert.deepEqual([m, p], ['POST', `parishes/P/calendar/events/${E2}/registration`]);
assert.ok(
  b.operationId && b.capacity === 10 && b.childAgeThreshold === 12 && Array.isArray(b.fields),
  'configure body'
);
await M.setRegistrationOpen(f, false);
[, p, b] = lastWrite();
assert.deepEqual([p.endsWith('/registration/actions'), b.action, b.version], [true, 'close', 'pv1']);
await M.reviseRegistrationForm(f, [
  ...f.fields,
  { key: 'size', label: 'Shirt size', type: 'Choice', required: true, options: ['S', 'M'] }
]);
[, p, b] = lastWrite();
assert.ok(
  p.endsWith('/registration/forms') && b.version === 'pv1' && b.fields.length === 2 && b.fields[1].options.length === 2,
  'revise form'
);
await M.registerParticipant(f, {
  personId: 'p-new',
  answers: { diet: 'none' },
  collectors: [{ id: 'c1', name: 'A', authorityEvidence: 'x' }]
});
[, p, b] = lastWrite();
assert.ok(
  p.endsWith('/registrations') && b.personId === 'p-new' && b.formVersionId === F1 && b.operationId,
  'register sends the viewed form version'
);
await M.decideRegistration(
  D.REGISTRANTS.find(r => r.id === R2),
  'offer',
  'A place opened',
  '2026-12-01T10:00:00.000Z'
);
[, p, b] = lastWrite();
assert.deepEqual(
  [p.endsWith(`/registrations/${R2}/actions`), b.action, b.version, b.offerUntil, b.reason],
  [true, 'offer', 'rv-bb', '2026-12-01T10:00:00.000Z', 'A place opened']
);
await M.decideRegistration(
  D.REGISTRANTS.find(r => r.id === R2),
  'confirm',
  'ok'
);
assert.equal(lastWrite()[2].offerUntil, null, 'only an offer carries a deadline');
await M.amendRegistration(r1, { ...r1, reason: 'Collector changed' });
[, p, b] = lastWrite();
assert.ok(
  p.endsWith(`/registrations/${R1}/amend`) &&
    b.reason === 'Collector changed' &&
    b.collectors.length === 1 &&
    b.version === 'rv-aa',
  'amend'
);
await M.recordReceipt(r1, { amount: 5, evidenceReference: 'receipt 8', occurredAt: '2026-11-10T00:00:00.000Z' });
[, p, b] = lastWrite();
assert.deepEqual([p.endsWith('/receipts'), b.amount, b.currency, b.evidenceReference], [true, 5, 'USD', 'receipt 8']);
await M.requestRefund(r1, { amount: 5, reason: 'Cancelled' });
assert.ok(lastWrite()[1].endsWith('/refunds') && lastWrite()[2].amount === 5, 'request refund');
await M.decideRefund(D.REFUNDS[0], r1, 'approve', { reason: 'Fine' });
[, p, b] = lastWrite();
assert.deepEqual(
  [p.endsWith(`/refunds/${REF}/actions`), b.action, b.version, b.evidenceReference, b.occurredAt],
  [true, 'approve', 'fv', null, null],
  'approval carries no payment fields'
);
await M.decideRefund(D.REFUNDS[0], r1, 'record', {
  reason: 'Repaid',
  evidenceReference: 'cash 3',
  occurredAt: '2026-11-11T08:00:00.000Z'
});
assert.deepEqual(
  [lastWrite()[2].action, lastWrite()[2].evidenceReference, lastWrite()[2].occurredAt],
  ['record', 'cash 3', '2026-11-11T08:00:00.000Z']
);
await M.recordPresence(
  D.REGISTRANTS.find(r => r.id === R1),
  'checkout',
  { collectorId: 'k1', verificationEvidence: 'Checked ID' }
);
[, p, b] = lastWrite();
assert.deepEqual(
  [p.endsWith('/presence'), b.action, b.collectorId, b.verificationEvidence, typeof b.occurredAt],
  [true, 'checkout', 'k1', 'Checked ID', 'string']
);
assert.ok(
  sent.every(([, , body]) => body.operationId),
  'every write has an operation id'
);
const ids = new Set(sent.map(([, , body]) => body.operationId));
assert.equal(ids.size, sent.length, 'and each is new');

/* ---- act(): reloads after success; shows the API’s message and does not reload after a failure ---- */
const before = calls.length;
assert.equal(await M.act(() => M.setRegistrationOpen(f, true)), true);
assert.ok(calls.length > before + 3, 'a successful action reloads');
const after = calls.length;
assert.equal(await M.act(() => Promise.reject(new Error('Registration is full.'))), false);
assert.equal(events.at(-1).detail, 'Registration is full.', 'the message reaches the portal banner');
assert.equal(calls.length, after, 'no reload after a failure');

/* ---- a local edit is undone and reported, nothing sent ---- */
const writes = sent.length;
D.REGISTRANTS[0].status = 'Cancelled';
assert.equal(await persist(), false);
assert.equal(sent.length, writes, 'no write for a local edit');
assert.equal(D.REGISTRANTS.find(r => r.id === R1).status, 'Confirmed', 'the screen shows what the API holds');

/* ---- a member's own registration ---- */
await M.applicantForm(E1);
assert.ok(calls.at(-1).endsWith(`${E1}/registration/applicant-form`));
await M.registerOwn(E1, { formVersionId: F1, answers: {}, transport: true });
[, p, b] = lastWrite();
assert.ok(
  p.endsWith('/registrations/mine') && b.formVersionId === F1 && b.transport === true && b.operationId,
  'self-registration'
);
await M.cancelOwn(E1, 'rv-bb', 'Cannot come');
[, p, b] = lastWrite();
assert.deepEqual([p.endsWith('/registrations/mine/cancel'), b.version, b.reason], [true, 'rv-bb', 'Cannot come']);

/* ---- a door-only account: no policy read, only an assigned event, its door list and present roster ---- */
signedIn(session, { roles: [], capabilities: ['registrations.checkin', 'schedule.read'] });
calls.length = 0;
await hydrate();
assert.ok(!calls.some(c => c.endsWith('/registration')), 'no policy is asked for without registrations.manage');
assert.equal(D.REGISTRATIONS.length, 1, 'only the event this door operator is assigned to');
assert.equal(D.REGISTRATIONS[0].known, false, 'its terms are unknown to this account');
assert.deepEqual(
  D.REGISTRANTS.map(r => [r.name, r.presence]),
  [['Georges Haddad', 'Present']],
  'door list: confirmed participants only'
);
assert.equal(D.CHECKIN.sessions[E1].present, 1);
assert.equal(D.PICKUP[R1].canEdit, false, 'collectors are read-only at the door');
denyDoorFor = E1;
await hydrate();
assert.equal(D.REGISTRATIONS.length, 0, 'not assigned: nothing to show');
assert.equal(Object.keys(D.CHECKIN.sessions).length, 0);

/* ---- an account with no registration permission reads nothing ---- */
signedIn(session, { roles: [], capabilities: ['people.read'] });
calls.length = 0;
await hydrate();
assert.equal(
  calls.filter(c => c.includes('calendar')).length,
  0,
  'no calendar request without a registration permission'
);
assert.equal(D.REGISTRATIONS.length, 0);

console.log('registrations: ok');
