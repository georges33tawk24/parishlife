/* Purpose: checks the Facilities module (rooms, reservations, equipment, issues, rentals) against an
   in-memory stand-in for ParishLife.Api's Scheduling routes.
   Main parts: the stand-in routes, then assertions on what load fills (and leaves empty when the account
   may not read) and on exactly what each write sends. Run with `npm run check`. */
import assert from 'node:assert/strict';
import { json, mockApi, signedIn } from '../mock-api.mjs';

const F1 = '11111111-1111-4111-8111-111111111111',
  F2 = '22222222-2222-4222-8222-222222222222',
  R1 = 'aaaaaaaa-0000-4000-8000-000000000001',
  R2 = 'aaaaaaaa-0000-4000-8000-000000000002',
  EV1 = 'eeeeeeee-0000-4000-8000-000000000001',
  EV2 = 'eeeeeeee-0000-4000-8000-000000000002',
  EV3 = 'eeeeeeee-0000-4000-8000-000000000003',
  E1 = 'bbbbbbbb-0000-4000-8000-000000000001',
  I1 = 'cccccccc-0000-4000-8000-000000000001';

const soon = n => new Date(Date.now() + n * 86400000).toISOString();
const state = { denyEquipment: false, pagesSeen: [] };

const facility = (id, name, status = 'Serviceable') => ({
  value: {
    id,
    parishId: 'P',
    name,
    kind: 'Room',
    capacity: 40,
    setupMinutes: 30,
    cleanupMinutes: 15,
    status,
    exclusionResourceIds: [],
    publicDescription: null
  },
  version: `v-${id.slice(0, 2)}`
});
const reservation = (id, resourceId, eventId, status, days) => ({
  value: {
    id,
    parishId: 'P',
    resourceId,
    eventId,
    requestedBy: 'acct1',
    startsAt: soon(days),
    endsAt: soon(days + 0.1),
    status,
    allocationResourceIds: [resourceId],
    redacted: false
  },
  version: `rv-${id.slice(-1)}`
});
const events = [
  {
    value: {
      id: EV3,
      title: 'Parish lunch',
      status: 'Published',
      startsAt: soon(20),
      endsAt: soon(20.1),
      timeZone: 'Asia/Beirut'
    },
    version: 'ev3'
  },
  {
    value: {
      id: EV1,
      title: 'Choir rehearsal',
      status: 'Draft',
      startsAt: soon(3),
      endsAt: soon(3.1),
      timeZone: 'Asia/Beirut'
    },
    version: 'ev1'
  },
  {
    value: {
      id: EV2,
      title: 'Bake sale',
      status: 'Draft',
      startsAt: soon(40),
      endsAt: soon(40.1),
      timeZone: 'Asia/Beirut'
    },
    version: 'ev2'
  }
];

const { sent } = mockApi((method, path, body) => {
  const [route, search = ''] = path.split('?');
  if (route === 'parishes/P/people') return json(200, { items: [], continuationToken: null }); // the People module loads too
  if (route === 'parishes/P/facilities' && method === 'GET')
    return json(200, {
      items: [facility(F1, 'Parish Hall'), facility(F2, 'Crypt', 'OutOfService')],
      continuationToken: null
    });
  if (route === 'parishes/P/reservations' && method === 'GET') {
    state.pagesSeen.push(search);
    return json(200, {
      items: search.includes('cursor=')
        ? []
        : [reservation(R1, F1, EV1, 'Requested', 3), reservation(R2, F1, EV3, 'Confirmed', 20)].filter(r => {
            const [, start, end] = search.match(/start=([^&]+)&end=([^&]+)/);
            return r.value.startsAt >= decodeURIComponent(start) && r.value.startsAt < decodeURIComponent(end);
          }),
      continuationToken: null
    });
  }
  if (route === 'parishes/P/calendar/events' && method === 'GET') {
    const [, start, end] = search.match(/start=([^&]+)&end=([^&]+)/);
    return json(200, {
      items: events.filter(
        e => e.value.startsAt >= decodeURIComponent(start) && e.value.startsAt < decodeURIComponent(end)
      ),
      continuationToken: null
    });
  }
  if (route === 'parishes/P/equipment' && method === 'GET')
    return state.denyEquipment
      ? json(403, {
          status: 403,
          title: 'mfa_required',
          detail: 'Sign in with your authenticator before performing this action.'
        })
      : json(200, {
          items: [
            {
              value: {
                id: E1,
                name: 'Microphones',
                quantity: 6,
                storage: 'Sacristy',
                condition: 'fair',
                status: 'Serviceable',
                updatedAt: soon(-1)
              },
              version: 'eq1'
            }
          ],
          continuationToken: null
        });
  if (route === `parishes/P/equipment/${E1}/bookings` && method === 'GET')
    return json(200, {
      items: [
        {
          value: { id: 'bk1', equipmentId: E1, quantity: 2, status: 'Issued', issuedTo: 'Choir', endsAt: soon(3) },
          version: 'b1'
        },
        { value: { id: 'bk2', equipmentId: E1, quantity: 1, status: 'Returned', endsAt: soon(-3) }, version: 'b2' }
      ],
      continuationToken: null
    });
  if (route === 'parishes/P/facility-issues' && method === 'GET')
    return json(200, {
      items: [
        {
          value: {
            id: I1,
            resourceId: F1,
            resourceKind: 'Facility',
            description: 'Two lights out',
            urgency: 'Normal',
            status: 'Reported',
            reportedBy: 'acct1',
            reportedAt: soon(-2)
          },
          version: 'is1'
        }
      ],
      continuationToken: null
    });
  if (route === 'parishes/P/renters' && method === 'GET')
    return json(200, [
      { id: 'rt1', name: 'Gemayel family', organization: null, responsibleContact: 'x', createdAt: soon(-9) }
    ]);
  if (route === `parishes/P/reservations/${R1}/rental` && method === 'GET')
    return json(200, {
      reservationId: R1,
      version: 'rn1',
      renterId: 'rt1',
      fee: 450,
      deposit: 200,
      currency: 'USD',
      terms: 'Clean up',
      status: 'Proposed',
      depositState: 'Due',
      depositHeld: 0,
      feeOutstanding: 450,
      payments: []
    });
  if (route.match(/\/rental$/) && method === 'GET')
    return json(404, {
      status: 404,
      title: 'resource_not_found',
      detail: 'The requested rental record is unavailable.'
    });
  if (method === 'POST' && route === 'parishes/P/reservations/' + R1 + '/actions')
    return json(202, { id: R1, status: 'Allocating' });
  if (method !== 'GET') return json(200, { id: 'new', ...body });
  return undefined;
});

const { session } = await import('../../src/portal/model/api.js');
const D = await import('../../src/portal/model/data.js');
const { hydrate, persist } = await import('../../src/portal/model/persist.js');
const M = await import('../../src/portal/model/modules/facilities.js');
signedIn(session, { roles: ['priest'] });

/* ---- load ---- */
await hydrate();
assert.deepEqual(
  D.VENUES.map(v => [v.id, v.name, v.cap, v.setup, v.cleanup, v.status]),
  [
    [F1, 'Parish Hall', 40, 30, 15, 'Serviceable'],
    [F2, 'Crypt', 40, 30, 15, 'OutOfService']
  ],
  'rooms come from GET facilities'
);
assert.equal(D.VENUES[0].access, undefined, 'step-free access has no API field, so it is not claimed');
assert.deepEqual(
  D.MAINTENANCE.map(m => m.venue),
  [F2],
  'a room out of service is a blocked room'
);
assert.equal(D.MAINTENANCE[0].from, '', 'a block has no dates in the API');
assert.equal(D.RESERVATIONS.length, 2, 'reservations from both 31-day windows');
const first = D.RESERVATIONS.find(r => r.id === R1);
assert.equal(first.title, 'Choir rehearsal', 'the title is the calendar event title');
assert.equal(first.status, 'pending');
assert.equal(first.api, 'Requested');
assert.match(first.from, /^\d\d:\d\d$/);
assert.equal(first.setup, 30, 'the set-up buffer is the room’s');
assert.equal(D.RESERVATIONS.find(r => r.id === R2).status, 'approved', 'Confirmed is approved');
assert.equal(D.EQUIPMENT[0].out, 2, 'on loan = units on issued bookings');
assert.equal(D.EQUIPMENT[0].custody[0].to, 'Choir');
assert.equal(D.ISSUES[0].what, 'Two lights out');
assert.equal(D.ISSUES[0].by, null, 'the reporter is an account, not a person');
assert.deepEqual(
  D.RENTALS.map(r => [r.id, r.who, r.charge, r.deposit, r.currency, r.status]),
  [[R1, 'Gemayel family', 450, 200, 'USD', 'Proposed']],
  'only a reservation with an agreement is a rental (404 elsewhere)'
);
assert.equal(M.denied.size, 0);
assert.ok(
  state.pagesSeen.every(s => /size=100/.test(s)),
  'lists page with size, not pageSize'
);

/* ---- a refused area stays empty ---- */
state.denyEquipment = true;
await hydrate();
assert.deepEqual(D.EQUIPMENT, [], 'equipment needing the authenticator is left empty');
assert.ok(M.denied.has('equipment'));
assert.equal(D.VENUES.length, 2, 'the rest still loads');
state.denyEquipment = false;
await hydrate();

/* ---- writes send exactly what the API takes ---- */
await M.saveFacility(null, { name: 'Annex', kind: 'Space', capacity: 10, setupMinutes: 0, cleanupMinutes: 0 });
let [method, path, body] = sent.at(-1);
assert.deepEqual([method, path], ['POST', 'parishes/P/facilities']);
assert.match(body.operationId, /^[0-9a-f-]{36}$/);
assert.deepEqual(
  [body.name, body.kind, body.capacity, body.exclusionResourceIds, body.publicDescription],
  ['Annex', 'Space', 10, [], null]
);
assert.equal(body.version, undefined, 'a create has no version');

await M.saveFacility(F1, { name: 'Hall', kind: 'Room', capacity: 50, setupMinutes: 10, cleanupMinutes: 5 }, 'v-11');
[method, path, body] = sent.at(-1);
assert.deepEqual([method, path, body.version], ['PUT', `parishes/P/facilities/${F1}`, 'v-11']);

await M.setFacilityStatus(F1, 'OutOfService', 'Damp', 'v-11');
[method, path, body] = sent.at(-1);
assert.deepEqual(
  [method, path, body.status, body.reason, body.version],
  ['POST', `parishes/P/facilities/${F1}/status`, 'OutOfService', 'Damp', 'v-11']
);

await M.decideReservation(first, 'confirm', 'Hall is free');
[method, path, body] = sent.at(-1);
assert.deepEqual([method, path], ['POST', `parishes/P/reservations/${R1}/actions`]);
assert.deepEqual([body.action, body.reason, body.version], ['confirm', 'Hall is free', 'rv-1']);

const draft = await M.requestableEvents();
assert.deepEqual(
  draft.map(e => e.id),
  [EV1, EV2],
  'draft future events are what a room can be requested for'
);
await M.requestRoom({ event: draft[0], venue: F1 });
[method, path, body] = sent.at(-1);
assert.deepEqual(
  [method, path, body.resourceId, body.eventId, body.startsAt, body.endsAt],
  ['POST', 'parishes/P/reservations', F1, EV1, draft[0].startsAt, draft[0].endsAt]
);

await M.saveEquipment(E1, { name: 'Microphones', quantity: 5, status: 'Serviceable' }, 'eq1');
[method, path, body] = sent.at(-1);
assert.deepEqual(
  [method, path, body.version, body.quantity, body.storage],
  ['PUT', `parishes/P/equipment/${E1}`, 'eq1', 5, null]
);

await M.reportIssue({
  resourceId: F1,
  resourceKind: 'Facility',
  description: 'Leak',
  urgency: 'Urgent',
  evidence: null
});
[method, path, body] = sent.at(-1);
assert.deepEqual(
  [method, path, body.resourceKind, body.urgency],
  ['POST', 'parishes/P/facility-issues', 'Facility', 'Urgent']
);

await M.issueAction(D.ISSUES[0], { action: 'triage', note: 'Booked an electrician' });
[method, path, body] = sent.at(-1);
assert.deepEqual(
  [method, path, body.action, body.version],
  ['POST', `parishes/P/facility-issues/${I1}/actions`, 'triage', 'is1']
);

await M.proposeRental(R1, { renterId: 'rt1', fee: 450, deposit: 200, currency: 'USD', terms: 'Clean up' });
[method, path, body] = sent.at(-1);
assert.deepEqual([method, path, body.renterId], ['PUT', `parishes/P/reservations/${R1}/rental`, 'rt1']);

/* ---- a direct edit of these collections is undone and reported ---- */
const writes = sent.length;
D.VENUES[0].cap = 99;
const errors = [];
globalThis.CustomEvent = class {
  constructor(type, init) {
    Object.assign(this, { type, detail: init?.detail });
  }
};
globalThis.document.dispatchEvent = e => errors.push(e);
assert.equal(await persist(), false, 'an on-screen edit cannot be sent as a diff');
assert.equal(sent.length, writes, 'nothing was sent');
assert.equal(D.VENUES[0].cap, 40, 'and the screen shows what the API stored');
assert.ok(errors.some(e => e.type === 'parish-save-error'));

console.log('facilities: load, access, writes and unsupported edits ok');
