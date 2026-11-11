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
  return json(404); // a route the API does not have
};

const { session, api, notConnected } = await import('../src/portal/model/api.js');
const D = await import('../src/portal/model/data.js');
const { hydrate, persist } = await import('../src/portal/model/persist.js');
Object.assign(session, {
  parishes: [{ id: 'P', name: 'Saint Test' }],
  parishId: 'P',
  user: { id: 'u', role: 'priest' }
});

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

console.log('check-api: all assertions passed');
