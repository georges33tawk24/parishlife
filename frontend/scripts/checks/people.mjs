/* Purpose: checks the People module (model/modules/people.js and people-workflows.js) against an in-memory
   stand-in for ParishLife.Api's People routes: what load fills (people, facts, households, duplicates),
   what save sends for each kind of change (and what it refuses), and the direct workflow calls
   (consents, medical, relationships, duplicates and merges, search, export, the office queues).
   Run with `npm run check` from frontend/. */
import assert from 'node:assert/strict';
import { json, mockApi, signedIn } from '../mock-api.mjs';

const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [A, B, C, D1, H1, H2] = [uid(1), uid(2), uid(3), uid(4), uid(11), uid(12)];
const people = [
  {
    id: A,
    parishId: 'P',
    givenName: 'Georges',
    familyName: 'Haddad',
    birthDate: '1968-03-14',
    contact: '03 421 887',
    archived: false
  },
  { id: B, parishId: 'P', givenName: 'Nada', familyName: 'Haddad', birthDate: null, contact: null, archived: false },
  { id: C, parishId: 'P', givenName: 'Fouad', familyName: 'Karam', birthDate: null, contact: null, archived: true },
  {
    id: D1,
    parishId: 'P',
    givenName: 'Georges',
    familyName: 'Hadad',
    birthDate: '1968-03-14',
    contact: '03 421 887',
    archived: false
  }
];
const facts = {
  [A]: {
    version: 'f1',
    value: {
      personId: A,
      country: 'Lebanon',
      region: 'Mount Lebanon',
      district: 'Baabda',
      town: 'Hadath',
      addressDetail: 'Behind the municipality',
      occupation: 'Accountant',
      skills: ['Driving'],
      preferredLanguage: 'ar',
      localityStatus: 'Listed',
      deceased: false
    }
  }
};
const households = {
  [H1]: {
    version: 'h1-1',
    value: {
      id: H1,
      name: 'Haddad',
      address: 'Imm. Sfeir',
      phone: null,
      contactPersonId: A,
      envelopeId: '0142',
      status: 'Active',
      members: [
        { personId: A, displayName: 'Georges Haddad' },
        { personId: B, displayName: 'Nada Haddad' }
      ]
    }
  }
};
let consents = [];
const relationships = [];
let membership = [
  {
    version: 'm1',
    value: {
      id: uid(21),
      givenName: 'Maya',
      familyName: 'Abou Jaoude',
      birthDate: '1990-05-01',
      contact: '76 220 415',
      locality: 'Hadath',
      note: 'Daughter of Georges',
      status: 'Submitted',
      personId: null,
      submittedAt: '2026-11-01T10:00:00Z'
    }
  }
];
let corrections = [
  {
    version: 'c1',
    value: {
      id: uid(31),
      personId: A,
      status: 'Pending',
      submittedAt: '2026-11-02T10:00:00Z',
      fields: [
        { field: 'Contact', newValue: '03 111 222', oldValue: '03 421 887' },
        { field: 'FamilyName', newValue: 'Hadad', oldValue: 'Haddad' }
      ]
    }
  }
];
let version = 100;
const detailCalls = [];
let denyHouseholds = false;

const { sent, events } = mockApi(async (method, path, body, options) => {
  const m = re => path.match(re);
  // people
  let x;
  if (path === 'parishes/P/people/duplicates')
    return json(200, [
      {
        personA: A,
        personB: D1,
        nameA: 'Georges Haddad',
        nameB: 'Georges Hadad',
        signals: ['Same family name', 'Same birth date'],
        differences: ['FamilyName'],
        linkedA: false,
        linkedB: false,
        decision: null
      }
    ]);
  if (path === 'parishes/P/people/merges' && method === 'GET') return json(200, []);
  if (path.startsWith('parishes/P/people/merges/preview'))
    return json(200, {
      conflicts: ['FamilyName'],
      dependents: {},
      sourceLinked: false,
      survivorLinked: false,
      needsPriest: false
    });
  if (path === 'parishes/P/people/merges' && method === 'POST')
    return json(200, {
      id: uid(41),
      version: 'mg1',
      survivorId: body.survivorId,
      sourceId: body.sourceId,
      status: 'Merged'
    });
  if (path === 'parishes/P/people/duplicates/decisions') return json(204);
  if ((x = m(/^parishes\/P\/people\/merges\/(\w[\w-]*)\/unmerge$/))) return json(200, { id: x[1], status: 'Unmerged' });
  if (path.startsWith('parishes/P/people/search?'))
    return json(200, [{ id: A, givenName: 'Georges', familyName: 'Haddad', birthDate: '1968-03-14', archived: false }]);
  if (path.startsWith('parishes/P/people/export/preview?'))
    return json(200, {
      count: 3,
      columns: ['GivenName'],
      includeArchived: false,
      excluded: ['credentials and tokens']
    });
  if (path === 'parishes/P/people/export' && method === 'POST')
    return new Response('GivenName\r\nGeorges\r\n', { status: 200, headers: { 'Content-Type': 'text/csv' } });
  if ((x = m(/^parishes\/P\/people\?pageSize=100&?(?:continuation=(\w+))?$/)) && method === 'GET')
    return x[1]
      ? json(200, { items: people.slice(2), continuationToken: null })
      : json(200, { items: people.slice(0, 2), continuationToken: 'next' });
  if (path === 'parishes/P/people' && method === 'POST') {
    const p = {
      id: uid(50 + people.length),
      parishId: 'P',
      archived: false,
      givenName: body.givenName,
      familyName: body.familyName,
      birthDate: body.birthDate,
      contact: body.contact
    };
    people.push(p);
    return json(200, p);
  }
  if ((x = m(/^parishes\/P\/people\/([\w-]+)\/archive$/))) {
    const p = people.find(q => q.id === x[1]);
    assert.equal(body.version, `v-${p.id}`);
    p.archived = body.archived;
    return json(200, p);
  }
  if ((x = m(/^parishes\/P\/people\/([\w-]+)$/)) && method === 'GET')
    return json(200, { value: people.find(q => q.id === x[1]), version: `v-${x[1]}` });
  // facts
  if ((x = m(/^parishes\/P\/people\/([\w-]+)\/facts$/))) {
    if (method === 'GET') {
      detailCalls.push(path);
      return json(
        200,
        facts[x[1]]
          ? { version: facts[x[1]].version, value: facts[x[1]].value }
          : { version: '', value: { personId: x[1], skills: [], localityStatus: 'NotRecorded' } }
      );
    }
    const old = facts[x[1]];
    assert.equal(body.version, old?.version, 'facts carry the stored version (none for the first save)');
    facts[x[1]] = {
      version: `f${++version}`,
      value: {
        personId: x[1],
        ...body,
        preferredLanguage: body.preferredLanguage,
        localityStatus: body.town ? 'Listed' : 'NotRecorded',
        deceased: false
      }
    };
    return json(200, facts[x[1]].value);
  }
  if ((x = m(/^parishes\/P\/people\/([\w-]+)\/medical$/))) {
    if (method === 'GET')
      return x[1] === A
        ? json(200, {
            version: 'md1',
            value: { personId: A, bloodType: 'O+', allergies: 'Penicillin', purpose: 'Camp safety', verified: false }
          })
        : json(404, { title: 'resource_not_found', detail: 'unavailable' });
    return json(200, { personId: x[1], ...body });
  }
  if ((x = m(/^parishes\/P\/people\/([\w-]+)\/consents$/))) {
    if (method === 'GET')
      return json(
        200,
        consents.filter(c => c.value.personId === x[1])
      );
    const c = {
      version: `cv${++version}`,
      value: {
        id: uid(60 + consents.length),
        personId: x[1],
        kind: body.kind,
        purpose: body.purpose,
        policyVersion: body.policyVersion,
        fields: body.fields,
        source: 'PaperReceived',
        status: 'Given',
        givenAt: '2026-11-03T09:00:00Z'
      }
    };
    consents.push(c);
    return json(200, c.value);
  }
  if ((x = m(/^parishes\/P\/consents\/([\w-]+)\/withdraw$/))) {
    const c = consents.find(q => q.value.id === x[1]);
    assert.equal(body.version, c.version);
    c.value.status = 'Withdrawn';
    return json(200, c.value);
  }
  if ((x = m(/^parishes\/P\/people\/([\w-]+)\/relationships(\?.*)?$/))) {
    if (method === 'GET')
      return json(200, { items: relationships.filter(r => r.value.personId === x[1]), continuationToken: null });
    const r = {
      version: 'r1',
      value: {
        id: uid(70),
        personId: x[1],
        relatedPersonId: body.relatedPersonId,
        relatedName: 'Nada Haddad',
        kind: body.kind,
        status: 'Active'
      }
    };
    relationships.push(r);
    return json(200, r.value);
  }
  if ((x = m(/^parishes\/P\/people\/([\w-]+)\/relationships\/([\w-]+)\/end$/)))
    return json(200, { id: x[2], status: 'Ended' });
  // households
  if (path.startsWith('parishes/P/households') && denyHouseholds)
    return json(403, { title: 'mfa_required', detail: 'Sign in with your authenticator.' });
  if ((x = m(/^parishes\/P\/households\?size=100(?:&cursor=(\w+))?$/)))
    return json(200, {
      items: Object.values(households).map(h => ({ version: h.version, value: { ...h.value, members: [] } })),
      continuationToken: null
    });
  if (path === 'parishes/P/households' && method === 'POST') {
    const h = {
      version: `h${++version}`,
      value: {
        id: uid(80 + Object.keys(households).length),
        name: body.name,
        address: body.address,
        phone: body.phone,
        contactPersonId: null,
        envelopeId: body.envelopeId,
        status: 'Active',
        members: []
      }
    };
    households[h.value.id] = h;
    return json(200, h.value);
  }
  if ((x = m(/^parishes\/P\/households\/([\w-]+)\/members$/))) {
    const h = households[x[1]];
    assert.equal(body.version, h.version, 'a member action carries the current household version');
    if (body.action === 'add') h.value.members.push({ personId: body.personId });
    if (body.action === 'remove') h.value.members = h.value.members.filter(q => q.personId !== body.personId);
    if (body.action === 'set-contact') h.value.contactPersonId = body.personId;
    h.version = `h${++version}`;
    return json(200, h.value);
  }
  if ((x = m(/^parishes\/P\/households\/([\w-]+)\/history\?size=100$/)))
    return json(200, {
      items: [
        {
          id: 'x:add',
          householdId: x[1],
          personId: B,
          action: 'add',
          previous: null,
          recordedBy: 'u',
          recordedAt: '2026-11-01T00:00:00Z'
        }
      ],
      continuationToken: null
    });
  if ((x = m(/^parishes\/P\/households\/([\w-]+)$/))) {
    const h = households[x[1]];
    if (method === 'GET') return json(200, { version: h.version, value: h.value });
    assert.equal(body.version, h.version);
    Object.assign(h.value, { name: body.name, address: body.address, phone: body.phone, envelopeId: body.envelopeId });
    h.version = `h${++version}`;
    return json(200, h.value);
  }
  // office queues
  if (path === 'parishes/P/membership-requests') return json(200, membership);
  if ((x = m(/^parishes\/P\/membership-requests\/([\w-]+)\/decision$/))) {
    const r = membership.find(q => q.value.id === x[1]);
    assert.equal(body.version, r.version);
    r.value.status = body.action === 'link' ? 'Linked' : body.action === 'decline' ? 'Declined' : 'NeedsInformation';
    return json(200, r.value);
  }
  if (path === 'parishes/P/profile-corrections')
    return json(
      200,
      corrections.filter(c => c.value.status === 'Pending')
    );
  if ((x = m(/^parishes\/P\/profile-corrections\/([\w-]+)\/review$/))) {
    const c = corrections.find(q => q.value.id === x[1]);
    assert.equal(body.version, c.version);
    c.value.status = 'Reviewed';
    return json(200, c.value);
  }
});

signedIn((await import('../../src/portal/model/api.js')).session, {
  roles: ['priest'],
  capabilities: ['people.read', 'people.write']
});
const D = await import('../../src/portal/model/data.js');
const { hydrate, persist } = await import('../../src/portal/model/persist.js');
const W = await import('../../src/portal/model/modules/people-workflows.js');
const lastWrite = () => sent.at(-1);
const fresh = () => D.PEOPLE.find(p => p.id === A);

// ---------- load ----------
await hydrate();
assert.deepEqual(
  D.PEOPLE.map(p => p.id),
  [A, B, D1],
  'both pages; archived people apart'
);
assert.deepEqual(
  D.ARCHIVED.map(p => p.id),
  [C]
);
assert.equal(fresh().town, '', 'facts are not read in bulk, so a person nobody opened has no town');
assert.equal(D.PERSON_EXTRA[A], undefined);
assert.deepEqual(
  D.HOUSEHOLDS.map(h => [h.id, h.name, h.head, h.members, h.envelope, h.address]),
  [[H1, 'Haddad', A, [A, B], '0142', 'Imm. Sfeir']]
);
assert.equal(fresh().hh, H1, "a person's household comes from the household's members");
assert.equal(D.PEOPLE.find(p => p.id === D1).hh, null);
assert.deepEqual(
  D.DUPLICATES.map(d => [d.a.id, d.b.id, d.signals.length, d.differences, d.a.born]),
  [[A, D1, 2, ['FamilyName'], '1968-03-14']]
);
assert.equal(D.DUPLICATES[0].score, undefined, 'no similarity score is invented');
assert.equal(D.RATE.value, 0);

// ---------- opening a person loads facts, consents, medical, relationships ----------
assert.equal(await W.openPerson(A), true, 'the first open tells the caller to reload the lists');
assert.equal(W.detail(A).medical.value.bloodType, 'O+');
assert.equal(await W.openPerson(A), false);
await W.openPerson(B); // no facts, no medical (404), still fine
assert.equal(W.detail(B).medical, null);
await hydrate();
assert.equal(fresh().town, 'Hadath');
assert.deepEqual(
  {
    occupation: D.PERSON_EXTRA[A].occupation,
    skills: D.PERSON_EXTRA[A].skills,
    lang: D.PERSON_EXTRA[A].lang,
    blood: D.PERSON_EXTRA[A].blood,
    address: D.PERSON_EXTRA[A].address,
    directory: D.PERSON_EXTRA[A].directory
  },
  {
    occupation: 'Accountant',
    skills: ['Driving'],
    lang: 'ar',
    blood: 'O+',
    address: { governorate: 'Mount Lebanon', district: 'Baabda', town: 'Hadath', sector: '' },
    directory: false
  }
);

// ---------- facts: only what changed is sent, the rest of the stored record is kept ----------
D.PERSON_EXTRA[A].occupation = 'Retired accountant';
assert.equal(await persist(), true);
let [method, path, body] = lastWrite();
assert.equal(`${method} ${path}`, `PUT parishes/P/people/${A}/facts`);
assert.equal(body.version, 'f1');
assert.match(body.operationId, /^[0-9a-f-]{36}$/);
assert.deepEqual(
  {
    occupation: body.occupation,
    skills: body.skills,
    town: body.town,
    country: body.country,
    addressDetail: body.addressDetail,
    preferredLanguage: body.preferredLanguage
  },
  {
    occupation: 'Retired accountant',
    skills: ['Driving'],
    town: 'Hadath',
    country: 'Lebanon',
    addressDetail: 'Behind the municipality',
    preferredLanguage: 'ar'
  }
);
assert.equal(D.PERSON_EXTRA[A].occupation, 'Retired accountant', 'the screen shows what was stored');

// the first facts of someone with none: no version; the address cascade maps to region, district and town
D.PEOPLE.find(p => p.id === B).town = 'Baabda';
D.PERSON_EXTRA[B].address = { governorate: 'Mount Lebanon', district: 'Baabda', town: 'Baabda', sector: '' };
assert.equal(await persist(), true);
[method, path, body] = lastWrite();
assert.equal(path, `parishes/P/people/${B}/facts`);
assert.equal(body.version, undefined);
assert.deepEqual([body.region, body.district, body.town, body.skills], ['Mount Lebanon', 'Baabda', 'Baabda', []]);
assert.equal(D.PEOPLE.find(p => p.id === B).town, 'Baabda');

// ---------- what has no route is undone and reported, nothing is sent ----------
let writes = sent.length;
fresh().lat = 'Someone Else';
assert.equal(await persist(), false);
assert.equal(sent.length, writes);
assert.equal(fresh().lat, 'Georges Haddad');
fresh().born = '1970-01-01';
assert.equal(await persist(), false);
assert.equal(fresh().born, '1968-03-14', 'the birth date has no update route');
D.PERSON_EXTRA[A].blood = 'A+';
assert.equal(await persist(), false);
D.PEOPLE.splice(
  D.PEOPLE.findIndex(p => p.id === D1),
  1
);
assert.equal(await persist(), false, 'deleting a person has no route');
assert.ok(D.PEOPLE.some(p => p.id === D1));
assert.equal(sent.length, writes);

// ---------- create (with facts), archive and restore ----------
D.PEOPLE.unshift({
  id: 'draft',
  lat: 'Maya Abou Jaoude',
  ar: 'مايا أبو جودة',
  rite: 'Maronite',
  status: 'member',
  phone: '76 220 415',
  born: '1990-05-01',
  town: 'Hadath',
  hh: null,
  tags: []
});
D.PERSON_EXTRA.draft = {
  address: { governorate: 'Mount Lebanon', district: 'Baabda', town: 'Hadath' },
  occupation: 'Nurse',
  skills: [],
  lang: 'fr'
};
events.length = 0;
assert.equal(await persist(), true);
const post = sent.find(([mth, p]) => mth === 'POST' && p === 'parishes/P/people');
assert.deepEqual(
  [post[2].givenName, post[2].familyName, post[2].birthDate, post[2].contact],
  ['Maya', 'Abou Jaoude', '1990-05-01', '76 220 415']
);
const maya = people.find(p => p.givenName === 'Maya');
[method, path, body] = sent.find(([mth, p]) => mth === 'PUT' && p === `parishes/P/people/${maya.id}/facts`);
assert.deepEqual([body.occupation, body.town, body.preferredLanguage], ['Nurse', 'Hadath', 'fr']);
assert.ok(D.PEOPLE.some(p => p.id === maya.id && p.town === 'Hadath'));
assert.match(events.at(-1).detail, /Arabic name.*rite.*status|rite.*Arabic/s, 'what could not be kept is named');
const { createdId } = await import('../../src/portal/model/modules/people.js');
assert.equal(createdId('draft'), maya.id);

const b = D.PEOPLE.find(p => p.id === B);
D.PEOPLE.splice(D.PEOPLE.indexOf(b), 1);
D.ARCHIVED.unshift({ ...b, archived: '' });
assert.equal(await persist(), true);
[method, path, body] = sent.findLast(([, p]) => p.endsWith('/archive'));
assert.deepEqual([path, body.version, body.archived], [`parishes/P/people/${B}/archive`, `v-${B}`, true]);
const back = D.ARCHIVED.find(p => p.id === B);
D.ARCHIVED.splice(D.ARCHIVED.indexOf(back), 1);
D.PEOPLE.unshift(back);
assert.equal(await persist(), true);
assert.equal(sent.at(-1)[2].archived, false, 'restoring is the archive route with archived=false');

// ---------- households ----------
D.HOUSEHOLDS[0].envelope = '0150';
D.HOUSEHOLDS[0].address = 'Imm. Sfeir, 3rd floor';
assert.equal(await persist(), true);
[method, path, body] = lastWrite();
assert.equal(`${method} ${path}`, `PUT parishes/P/households/${H1}`);
assert.deepEqual([body.name, body.envelopeId, body.address], ['Haddad', '0150', 'Imm. Sfeir, 3rd floor']);

D.HOUSEHOLDS.unshift({
  id: 'hnew',
  name: 'Karam',
  ar: 'كرم',
  head: D1,
  members: [D1, maya.id],
  town: 'Hadath',
  envelope: '',
  address: 'Hadath',
  addressAr: 'الحدث',
  family: null,
  branch: null
});
events.length = 0;
assert.equal(await persist(), true);
const newHousehold = Object.values(households).find(h => h.value.name === 'Karam').value;
assert.deepEqual(newHousehold.members.map(q => q.personId).sort(), [D1, maya.id].sort());
assert.equal(newHousehold.contactPersonId, D1, 'the head becomes the household contact');
assert.match(events.at(-1).detail, /Arabic household name/);
assert.equal(D.PEOPLE.find(p => p.id === D1).hh, newHousehold.id);

// move a member: leave first, then join
const mover = D.HOUSEHOLDS.find(h => h.id === newHousehold.id);
mover.members = mover.members.filter(id => id !== maya.id);
D.HOUSEHOLDS.find(h => h.id === H1).members.push(maya.id);
assert.equal(await persist(), true);
const moves = sent.slice(-2).map(([, p, bd]) => [p.split('/')[3] === newHousehold.id ? 'old' : 'new', bd.action]);
assert.deepEqual(moves, [
  ['old', 'remove'],
  ['new', 'add']
]);
assert.equal(D.PEOPLE.find(p => p.id === maya.id).hh, H1);

// a different contact; deleting a household has no route
D.HOUSEHOLDS.find(h => h.id === H1).head = B;
assert.equal(await persist(), true);
assert.deepEqual([sent.at(-1)[2].action, sent.at(-1)[2].personId], ['set-contact', B]);
writes = sent.length;
D.HOUSEHOLDS.splice(0, 1);
assert.equal(await persist(), false);
assert.equal(sent.length, writes);
assert.equal((await W.householdHistory(H1))[0].action, 'add');

// ---------- consents, medical, relationships ----------
await W.recordConsent(A, {
  kind: 'Directory',
  purpose: 'Printed directory',
  policyVersion: '2026-1',
  fields: ['Name', 'Phone'],
  givenBy: 'Georges Haddad'
});
assert.deepEqual(sent.at(-1)[2].fields, ['Name', 'Phone']);
await W.recordConsent(A, {
  kind: 'Photo',
  purpose: 'Parish media',
  policyVersion: '2026-1',
  fields: ['Name'],
  givenBy: 'Georges Haddad'
});
assert.deepEqual(sent.at(-1)[2].fields, [], 'only a directory consent names fields');
await W.openPerson(A);
assert.equal(W.detail(A).consents.length, 2);
await hydrate();
assert.equal(D.PERSON_EXTRA[A].directory, true, 'the directory flag comes from a given Directory consent');
await W.withdrawConsent(W.detail(A).consents[0], 'Asked to be removed');
assert.equal(sent.at(-1)[2].version, W.detail(A).consents[0].version);
assert.equal((await W.consentsOf([A, B])).get(A).length, 2);
await W.saveMedical(A, { bloodType: 'O+', allergies: 'Penicillin', purpose: 'Camp safety' });
assert.deepEqual([sent.at(-1)[2].version, sent.at(-1)[2].purpose], ['md1', 'Camp safety']);
await W.addRelationship(A, { relatedPersonId: B, kind: 'Spouse' });
assert.deepEqual(sent.at(-1)[2].kind, 'Spouse');
await W.endRelationship(A, relationships[0], 'Recorded in error');
assert.equal(sent.at(-1)[2].version, 'r1');

// ---------- duplicates, merges, search, export ----------
await W.duplicateDecision(A, D1, 'different', 'Father and son');
assert.deepEqual(sent.at(-1)[2], {
  operationId: sent.at(-1)[2].operationId,
  personA: A,
  personB: D1,
  decision: 'different',
  reason: 'Father and son'
});
assert.deepEqual((await W.previewMerge(A, D1)).conflicts, ['FamilyName']);
const merge = await W.mergePeople(A, D1, { FamilyName: 'survivor' }, 'Same person');
assert.deepEqual(sent.at(-1)[2].choices, { FamilyName: 'survivor' });
await W.unmerge(merge, 'Merged in error');
assert.equal(sent.at(-1)[2].version, 'mg1');
assert.deepEqual(await W.listMerges(), []);
assert.equal((await W.searchPeople('hadd'))[0].id, A);
assert.equal((await W.previewExport(['GivenName'], false)).count, 3);
assert.equal(
  await W.exportPeople({ purpose: 'Printing the directory', columns: ['GivenName'], includeArchived: false }),
  'GivenName\r\nGeorges\r\n'
);
assert.deepEqual(sent.at(-1)[2].columns, ['GivenName']);

// ---------- the office queues ----------
const queue = await W.membershipQueue();
assert.equal(queue[0].value.status, 'Submitted');
await W.decideMembership(queue[0], { action: 'link', personId: B, evidenceReference: 'Parish register p.14' });
assert.deepEqual([sent.at(-1)[2].action, sent.at(-1)[2].personId, sent.at(-1)[2].version], ['link', B, 'm1']);
await W.decideMembership(queue[0], { action: 'decline', personId: B, reason: 'Not known here' });
assert.equal(sent.at(-1)[2].personId, null, 'a person is named only when linking');
const pending = await W.correctionQueue();
assert.equal(pending[0].value.fields.length, 2);
await W.reviewCorrection(pending[0], [
  { field: 'Contact', approve: true },
  { field: 'FamilyName', approve: false, reason: 'Spelling is correct' }
]);
assert.deepEqual(sent.at(-1)[2].decisions, [
  { field: 'Contact', approve: true, reason: null },
  { field: 'FamilyName', approve: false, reason: 'Spelling is correct' }
]);
assert.deepEqual(await W.correctionQueue(), []);

// ---------- not allowed here: a role without an authenticator session sees empty lists ----------
denyHouseholds = true;
await hydrate();
assert.deepEqual(D.HOUSEHOLDS, []);
assert.ok(D.PEOPLE.length > 0, 'people still load');

console.log('people: all assertions passed');
