/* Purpose: a runnable check of the frontend's ParishLife.Api layer without a browser or a running API.
   Main parts: a small in-memory stand-in for the .NET routes it uses (auth/csrf, people list, create,
   archive), then assertions on what hydrate() loads and what persist() sends, undoes and reports.
   Run with `npm run check` from frontend/. */
import assert from 'node:assert/strict';

const sent = [],
  events = [],
  heard = []; // [method, path, X-ParishLife-Appointment or null] of every request
let csrfCalls = 0,
  rejectNextWrite = false,
  dropNextWrite = false,
  operatorCapacities = false;
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
  const appointment = options.headers?.['X-ParishLife-Appointment'] ?? null;
  heard.push([method, path, appointment]);
  // a route the appointment does not cover: refused with it, answered by the grant path without it
  if (path === 'parishes/P/clergy-signature-image') return appointment ? json(403) : json(200, { id: 'img' });
  if (method !== 'GET') {
    assert.equal(options.headers['X-CSRF-TOKEN'], `t${csrfCalls}`, 'every write carries the current token');
    if (dropNextWrite) {
      dropNextWrite = false; // the request left, the answer never came back
      sent.push([method, path, body]);
      throw new TypeError('Failed to fetch');
    }
    if (rejectNextWrite) {
      rejectNextWrite = false;
      return json(400, { status: 400, title: 'csrf_invalid', detail: 'Obtain a current antiforgery token.' });
    }
    sent.push([method, path, body]);
  }
  const list = path.match(/^parishes\/P\/people\?pageSize=100&?(?:continuation=(\w+))?$/);
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
  if (path === 'parishes/P/people/duplicates') return json(200, []);
  const one = path.match(/^parishes\/P\/people\/(\w+)$/);
  if (one && method === 'GET') return json(200, { value: people.find(p => p.id === one[1]), version: `v-${one[1]}` });
  const archive = path.match(/^parishes\/P\/people\/(\w+)\/archive$/);
  if (archive && method === 'POST') {
    assert.equal(body.version, `v-${archive[1]}`, 'archive sends the version the API returned');
    assert.equal(body.archived, true);
    assert.match(body.operationId, /^[0-9a-f-]{36}$/);
    people.find(p => p.id === archive[1]).archived = true;
    return json(200, {});
  }
  if (path.startsWith('parishes/P/households')) return json(200, { items: [], continuationToken: null });
  if (path === 'auth/me') return json(200, { id: 'u', displayName: 'Test Account', accountVerified: true });
  if (path === 'me/parishes')
    return json(200, [{ parishId: 'P', name: 'Saint Test', relationship: 'Member', primary: true }]);
  if (path === 'me/capacities')
    return json(200, [
      { kind: 'Priest', appointmentId: 'AP', parishId: 'P', scopeName: 'Saint Test', capabilities: [] },
      { kind: 'ParishGrant', parishId: 'Q', scopeName: 'Saint Q', capabilities: ['finance.read', 'finance.enter'] },
      { kind: 'Bishop', archdioceseId: 'A', scopeName: 'Archeparchy', capabilities: [] },
      ...(operatorCapacities
        ? [
            { kind: 'PlatformOperator', scopeName: 'Platform', capabilities: [] },
            ...['P', 'Q', 'R'].map(id => ({
              // every verified parish, as the API lists them
              kind: 'PlatformOperator',
              parishId: id,
              scopeName: 'Saint ' + id,
              capabilities: ['finance.read', 'people.read', 'people.write']
            }))
          ]
        : [])
    ]);
  // the anonymous public routes the public site reads
  if (path === 'public/parishes')
    return json(200, {
      items: [
        {
          parishId: 'X',
          name: 'Demo Parish',
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
  // the Calendar module's lists (its own check, checks/calendar.mjs, covers them): nothing scheduled
  if (/^parishes\/P\/(calendar\/events|plans|music)\?/.test(path))
    return json(200, { items: [], continuationToken: null });
  if (path.startsWith('public/parishes/P/liturgical-calendar?')) return json(200, { status: 'NotPublished', days: [] });
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
const { hydrate, persist, loadFailures } = await import('../src/portal/model/persist.js');

// the session: a role per parish from the account's capacities, and the account's own role
await loadSession();
assert.deepEqual(
  session.parishes.map(p => [p.id, p.effectiveRole, p.canViewFinance]),
  [
    ['P', 'priest', false], // an appointment carries no finance duty
    ['Q', 'treasurer', true]
  ]
);
assert.equal(session.user.role, 'priest', 'the primary parish is selected first');
selectParish('Q');
assert.equal(session.user.role, 'treasurer');
assert.equal(session.accountUser.role, 'bishop');
selectParish('P');

// a priest's appointment is named on parish requests (an archdiocese administrator's on archdiocese requests); a refusal
// is asked again without it; the inbox and "…/mine" lists are personal and never carry it
session.archAppointments = { A: 'AA' }; // as loadSession keeps an ArchdioceseAdmin capacity's appointment
heard.length = 0;
await api('parishes/P/people/duplicates').catch(() => {});
await api('me/parishes');
await api('parishes/P/inbox').catch(() => {});
await api('parishes/P/requests/mine').catch(() => {});
await api('archdioceses/A/staff-appointments').catch(() => {});
assert.deepEqual(await api('parishes/P/clergy-signature-image'), { id: 'img' });
assert.deepEqual(
  heard.map(h => h.join(' ')),
  [
    'GET parishes/P/people/duplicates AP', // answered: no second try
    'GET me/parishes ',
    'GET parishes/P/inbox ',
    'GET parishes/P/requests/mine ',
    'GET archdioceses/A/staff-appointments AA',
    'GET archdioceses/A/staff-appointments ',
    'GET parishes/P/clergy-signature-image AP',
    'GET parishes/P/clergy-signature-image '
  ]
);
session.archAppointments = {};

// the menu offers an appointment-only priest no page the appointment cannot open (money, notices, audit, settings)
{
  const { S, role } = await import('../src/portal/model/store.js');
  S.role = 'priest';
  const pages = () => role().nav.map(n => (n[0] === 'l' ? n[1] : '#' + n[1]));
  const gated = ['giving', 'finance', 'officeexpenses', 'messaging', 'notices', 'audit', 'settings'];
  for (const id of gated) assert.ok(!pages().includes(id), id + ' is hidden from an appointment-only priest');
  assert.ok(['people', 'sacraments', 'requests', 'calendar'].every(id => pages().includes(id)));
  const P = session.parishes.find(p => p.id === 'P'),
    duties = P.capabilities;
  P.capabilities = ['finance.read', 'communications.manage', 'audit.read', 'billing.read'];
  for (const id of gated) assert.ok(pages().includes(id), id + ' is offered with the grant');
  P.capabilities = duties;
}

// loading: both pages, archived people apart, and no demo record left anywhere
await hydrate();
// a module whose routes this stand-in does not serve fails alone: its pages say why, People still loads
assert.ok(!loadFailures.has('people'));
assert.ok(
  loadFailures.size === 0 || [...loadFailures.values()].every(m => m === notConnected),
  'another module failing to load leaves its own pages with the reason'
);
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
D.PEOPLE.find(p => p.id === 'a3').tags = ['choir']; // tags have no API field (names now have an edit route)
D.SACRAMENTS.push({ id: 's1', kind: 'baptism' });
assert.equal(await persist(), false);
assert.equal(sent.length, writes, 'nothing was sent for unsupported changes');
assert.deepEqual(D.PEOPLE.find(p => p.id === 'a3').tags, []);
assert.equal(D.SACRAMENTS.length, 0);
assert.equal(events.at(-1).detail, notConnected);

// a route the API does not have says so plainly
await assert.rejects(api('workspace/plan'), { message: notConnected });

// a write that got no answer may have been saved: the same write again carries the same operation id, so the API
// replays it instead of saving twice; once the server answers it is forgotten, and a changed write is a new one (audit N2)
const ids = () => sent.slice(-1)[0][2].operationId;
dropNextWrite = true;
await assert.rejects(api('parishes/P/people', 'POST', { operationId: 'o1', givenName: 'A' }));
await api('parishes/P/people', 'POST', { operationId: 'o2', givenName: 'A' });
assert.equal(ids(), 'o1', 'the repeated write reuses the unanswered operation id');
await api('parishes/P/people', 'POST', { operationId: 'o3', givenName: 'A' });
assert.equal(ids(), 'o3', 'an answered write is forgotten');
dropNextWrite = true;
await assert.rejects(api('parishes/P/people', 'POST', { operationId: 'o4', givenName: 'A' }));
await api('parishes/P/people', 'POST', { operationId: 'o5', givenName: 'B' });
assert.equal(ids(), 'o5', 'a changed write is a new write');

// the public site: the directory and a parish's pages, from the anonymous routes
const { loadDirectory, loadParish } = await import('../src/public/api-data.js');
const { directory, details } = await loadDirectory();
assert.deepEqual(directory, [
  {
    id: 'X',
    name: 'Demo Parish',
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
assert.equal(x.publicRequests, true, "the request buttons are on: the form posts to the API's request route");
assert.deepEqual(x.ministries, [], "ministries load with a parish's own page");
assert.deepEqual(
  (await loadParish(directory[0])).ministries.map(m => [m.name, m.description]),
  [['Choir', 'Sings at Sunday Mass']]
);

// a platform operator: every verified parish, with every permission, in the switcher (owner, 27 November 2026);
// the parishes the account belongs to come first and stay its "own"
operatorCapacities = true;
await loadSession();
assert.equal(session.accountUser.role, 'super_admin');
assert.deepEqual(
  session.parishes.map(p => [p.id, p.own, p.effectiveRole, p.canViewFinance]),
  [
    ['P', true, 'priest', true],
    ['Q', true, 'parish_admin', true],
    ['R', false, 'parish_admin', true]
  ]
);
assert.ok(session.parishes.find(p => p.id === 'R').capabilities.includes('people.write'));
selectParish('R');
assert.equal(session.user.role, 'super_admin', 'the administrator keeps the full view inside any parish');
operatorCapacities = false;

console.log('check-api: all assertions passed');
