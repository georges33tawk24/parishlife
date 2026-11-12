/* Purpose: a runnable check of the frontend's ParishLife.Api layer without a browser or a running API.
   Main parts: a small in-memory stand-in for the .NET routes it uses (auth/csrf, people list, create,
   archive), then assertions on what hydrate() loads and what persist() sends, undoes and reports.
   Run with `npm run check` from frontend/. */
import assert from 'node:assert/strict';

const sent = [],
  events = [];
let csrfCalls = 0,
  rejectNextWrite = false;
const people = [
  {
    id: 'a1',
    parishId: 'P',
    givenName: 'Georges',
    familyName: 'Haddad',
    birthDate: '1968-03-14',
    contact: '03 421 887',
    archived: false
  },
  { id: 'a2', parishId: 'P', givenName: 'Nada', familyName: 'Haddad', birthDate: null, contact: null, archived: true }
];
const json = (status, body) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' }
  });

globalThis.document = { dispatchEvent: e => events.push(e) };
globalThis.fetch = async (url, options = {}) => {
  const method = options.method || 'GET',
    path = url.replace(/^\/api\//, ''),
    body = options.body ? JSON.parse(options.body) : undefined;
  if (path === 'auth/csrf') return json(200, { token: `t${++csrfCalls}`, header: 'X-CSRF-TOKEN' });
  if (method !== 'GET') {
    assert.equal(options.headers['X-CSRF-TOKEN'], `t${csrfCalls}`, 'every write carries the current token');
    if (rejectNextWrite) {
      rejectNextWrite = false;
      return json(400, { status: 400, title: 'csrf_invalid', detail: 'Obtain a current antiforgery token.' });
    }
    sent.push([method, path, body]);
  }
  const list = path.match(/^parishes\/P\/people\?pageSize=200&?(?:continuation=(\w+))?$/);
  if (list && method === 'GET')
    return list[1] // two pages: the first ends with a continuation token
      ? json(200, { items: people.slice(1), continuationToken: null })
      : json(200, { items: people.slice(0, 1), continuationToken: 'next' });
  if (path === 'parishes/P/people' && method === 'POST') {
    const p = { id: `a${people.length + 1}`, parishId: 'P', archived: false, ...body };
    delete p.operationId;
    people.push(p);
    return json(200, p);
  }
  const archive = path.match(/^parishes\/P\/people\/(\w+)\/archive$/);
  if (archive && method === 'POST') {
    people.find(p => p.id === archive[1]).archived = true;
    return json(200, {});
  }
  if (path === 'auth/me') return json(200, { id: 'u', displayName: 'Test Account', accountVerified: true });
  if (path === 'me/parishes')
    return json(200, [{ parishId: 'P', name: 'Saint Test', relationship: 'Member', primary: true }]);
  if (path === 'me/capacities')
    return json(200, [
      { kind: 'Priest', parishId: 'P', scopeName: 'Saint Test', capabilities: [] },
      { kind: 'ParishGrant', parishId: 'Q', scopeName: 'Saint Q', capabilities: ['finance.read', 'finance.enter'] },
      { kind: 'Bishop', archdioceseId: 'A', scopeName: 'Archeparchy', capabilities: [] }
    ]);
  // the anonymous public routes the public site reads
  if (path === 'public/parishes')
    return json(200, {
      items: [
        {
          parishId: 'X',
          name: 'Saint Elias',
          locality: 'Hadath',
          dioceseName: 'Beirut',
          latitude: 33.83,
          longitude: 35.53
        }
      ],
      distanceUnavailable: [],
      total: 1
    });
  if (path === 'public/parishes/X/website')
    return json(200, [
      { key: 'mass-times', language: 'en', title: 'Mass times', body: 'Sunday 9:00' },
      { key: 'mass-times', language: 'ar', title: 'القداديس', body: 'الأحد ٩:٠٠' },
      { key: 'parking', language: 'en', title: 'Parking', body: 'Behind the hall' }
    ]);
  if (path.startsWith('public/parishes/X/calendar?'))
    return json(200, {
      items: [
        {
          id: 'e1',
          title: 'Sunday Mass',
          kind: 'Mass',
          status: 'Confirmed',
          startsAt: '2026-11-15T07:00:00Z',
          timeZone: 'Asia/Beirut'
        },
        {
          id: 'e2',
          title: 'Cancelled vigil',
          kind: 'Event',
          status: 'Cancelled',
          startsAt: '2026-11-16T16:00:00Z',
          timeZone: 'Asia/Beirut'
        }
      ]
    });
  if (path.startsWith('public/parishes/X/ministries?'))
    return json(200, {
      items: [{ id: 'm1', name: 'Choir', purpose: 'Sings at Sunday Mass', publicInformation: null }]
    });
  // the finance lists (checked in checks/finance.mjs): empty for this parish
  if (
    method === 'GET' &&
    /^parishes\/P\/(finance\/(funds|balances|campaigns|pledges|contributions|expenses|bank\/lines|bank\/reconciliations)|office-ledger\/entries)$/.test(
      path
    )
  )
    return json(200, []);
  if (path === 'parishes/P/office-ledger/balances') return json(200, { period: '2026-11', totals: {} });
  return json(404); // a route the API does not have
};

const { session, api, notConnected, loadSession, selectParish } = await import('../src/portal/model/api.js');
const D = await import('../src/portal/model/data.js');
const { hydrate, persist } = await import('../src/portal/model/persist.js');

// the session: a role per parish from the account's capacities, and the account's own role
await loadSession();
assert.deepEqual(
  session.parishes.map(p => [p.id, p.effectiveRole, p.canViewFinance]),
  [
    ['P', 'priest', true],
    ['Q', 'treasurer', true]
  ]
);
assert.equal(session.user.role, 'priest', 'the primary parish is selected first');
selectParish('Q');
assert.equal(session.user.role, 'treasurer');
assert.equal(session.accountUser.role, 'bishop');
selectParish('P');

// loading: both pages, archived people apart, and no demo record left anywhere
await hydrate();
assert.deepEqual(
  D.PEOPLE.map(p => [p.id, p.lat, p.phone, p.born]),
  [['a1', 'Georges Haddad', '03 421 887', '1968-03-14']]
);
assert.deepEqual(
  D.ARCHIVED.map(p => p.id),
  ['a2']
);
assert.equal(D.SACRAMENTS.length, 0);
assert.equal(D.RATE.value, 0);
assert.equal(D.PARISH.name, 'Saint Test');

// a new person is created through the API, with a fresh operation id, then reloaded from it
D.PEOPLE.unshift({ id: 'draft', lat: 'Maya Abou Jaoude', phone: '76 220 415', born: '1990-05-01', tags: [] });
assert.equal(await persist(), true);
const [method, path, body] = sent.at(-1);
assert.equal(`${method} ${path}`, 'POST parishes/P/people');
assert.match(body.operationId, /^[0-9a-f-]{36}$/);
assert.deepEqual(
  { givenName: body.givenName, familyName: body.familyName, birthDate: body.birthDate, contact: body.contact },
  { givenName: 'Maya', familyName: 'Abou Jaoude', birthDate: '1990-05-01', contact: '76 220 415' }
);
assert.ok(
  D.PEOPLE.some(p => p.id === 'a3' && p.lat === 'Maya Abou Jaoude'),
  'the screen shows the stored record'
);
assert.ok(!D.PEOPLE.some(p => p.id === 'draft'));

// archiving goes to the archive route; a stale token is fetched again and the write retried once
rejectNextWrite = true;
const georges = D.PEOPLE.find(p => p.id === 'a1');
D.PEOPLE.splice(D.PEOPLE.indexOf(georges), 1);
D.ARCHIVED.unshift(georges);
assert.equal(await persist(), true);
assert.equal(sent.at(-1).slice(0, 2).join(' '), 'POST parishes/P/people/a1/archive');
assert.ok(D.ARCHIVED.some(p => p.id === 'a1'));

// what the API cannot save yet is undone on screen and reported, never left looking saved
const writes = sent.length;
D.PEOPLE.find(p => p.id === 'a3').lat = 'Someone Else';
D.SACRAMENTS.push({ id: 's1', kind: 'baptism' });
assert.equal(await persist(), false);
assert.equal(sent.length, writes, 'nothing was sent for unsupported changes');
assert.equal(D.PEOPLE.find(p => p.id === 'a3').lat, 'Maya Abou Jaoude');
assert.equal(D.SACRAMENTS.length, 0);
assert.equal(events.at(-1).detail, notConnected);

// a route the API does not have says so plainly
await assert.rejects(api('workspace/plan'), { message: notConnected });

// the public site: the directory and a parish's pages, from the anonymous routes
const { loadDirectory, loadParish } = await import('../src/public/api-data.js');
const { directory, details } = await loadDirectory();
assert.deepEqual(directory, [
  {
    id: 'X',
    name: 'Saint Elias',
    ar: '',
    town: 'Hadath',
    townAr: '',
    diocese: 'Beirut',
    latitude: 33.83,
    longitude: 35.53
  }
]);
const x = details.get('X');
assert.deepEqual(x.content, { massTimes: { en: 'Sunday 9:00', ar: 'الأحد ٩:٠٠' } }, 'known sections only, by language');
assert.deepEqual(
  x.events.map(e => [e.id, e.d, e.t, e.kind]),
  [['e1', '2026-11-15', '09:00', 'mass']],
  "on the parish's own clock, without cancelled events"
);
assert.equal(x.publicRequests, false, 'no request buttons until the request form is connected');
assert.deepEqual(x.ministries, [], "ministries load with a parish's own page");
assert.deepEqual(
  (await loadParish(directory[0])).ministries.map(m => [m.name, m.description]),
  [['Choir', 'Sings at Sunday Mass']]
);

console.log('check-api: all assertions passed');
