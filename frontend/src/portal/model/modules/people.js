/* Purpose: the People module's connection to ParishLife.Api: loading the parish's people, their facts,
   households and duplicate suggestions, and turning what changed on screen into API calls.
   Main members: keys (the view-model collections this module owns), routes (the portal pages it feeds),
   load (fills those collections from the API), save (sends what changed), createdId (the API's id for a
   person or household that was added on screen).

   What the API holds, and so what the screens show:
   - PEOPLE / ARCHIVED: one given and one family name, a birth date and one contact (GET people).
   - Person facts (GET people/{id}/facts: country, region, district, town, address detail, occupation,
     skills, preferred language, death) load when a person is opened and are kept for the session; the
     portal's town, address cascade, occupation, skills and language come from them. The API has no bulk
     read, so a person nobody has opened shows no town.
   - HOUSEHOLDS: name, address, phone, envelope number, contact person and members; a person's hh is the
     household they belong to.
   - DUPLICATES: the API's suggestions with their signals and differences. There is no similarity score.
   Everything the API does not have (Arabic names, rite, status, tags, relationship labels, a household's
   town) stays empty. A change to a person's name, birth date or contact has no API route and is undone and
   reported; see docs/frontend-modules/people.md. */
import { allPages, api, parishAPI, newOperationId } from '../api.js';
import { state, forParish, detail, saveFacts } from './people-workflows.js';

export const keys = ['PEOPLE', 'ARCHIVED', 'PERSON_EXTRA', 'HOUSEHOLDS', 'DUPLICATES'];
export const routes = ['people', 'person', 'households', 'household', 'membershipreviews', 'profilereviews'];

const enc = encodeURIComponent;
const created = new Map(); // the id a person or household had on screen → the API's id
export const createdId = draft => created.get(draft) || draft;

const canRead = parish =>
  parish.roles?.includes('priest') ||
  parish.capabilities?.includes('people.read') ||
  parish.capabilities?.includes('people.write');
/* 403 means "not allowed here" (a missing role, or no authenticator session): leave the part empty. */
const soft = (promise, fallback) => promise.catch(e => (e.status === 403 ? fallback : Promise.reject(e)));

/* A list the API pages with size and cursor (households, relationships, history). */
async function cursorPages(path, limit = 5000) {
  const items = [];
  let cursor = '';
  do {
    const page = await api(`${path}?size=100${cursor ? `&cursor=${enc(cursor)}` : ''}`);
    items.push(...(page?.items || []));
    cursor = page?.continuationToken || '';
  } while (cursor && items.length < limit);
  return items;
}

/* Run work over a list a few at a time. */
async function each(list, width, work) {
  const queue = [...list];
  await Promise.all(
    Array.from({ length: Math.min(width, queue.length) }, async () => {
      while (queue.length) await work(queue.shift());
    })
  );
}

/* PersonDto → the portal's person. Facts, when loaded, give the town. */
function toPerson(p, facts) {
  const name = `${p.givenName || ''} ${p.familyName || ''}`.trim();
  const town = facts?.town || facts?.localityNotListed || '';
  return {
    id: p.id,
    lat: name,
    ar: name,
    given: p.givenName,
    family: p.familyName,
    town,
    townAr: town,
    rite: '',
    status: '',
    phone: p.contact || '—',
    born: p.birthDate || '',
    hh: null,
    tags: [],
    createdAt: p.createdAt
  };
}

/* PersonFactsDto (and what else was opened) → the portal's PERSON_EXTRA entry. */
function toExtra(id) {
  const facts = state.facts.get(id)?.value;
  if (!facts) return null;
  const more = detail(id);
  const directory = more?.consents.some(r => r.value.kind === 'Directory' && r.value.status === 'Given');
  return {
    occupation: facts.occupation || '',
    skills: facts.skills || [],
    lang: facts.preferredLanguage || '',
    address: {
      governorate: facts.region || '',
      district: facts.district || '',
      town: facts.town || facts.localityNotListed || '',
      sector: ''
    },
    country: facts.country || '',
    addressDetail: facts.addressDetail || '',
    localityStatus: facts.localityStatus || '',
    deceased: !!facts.deceased,
    deceasedOn: facts.deceasedOn || '',
    deceasedPrecision: facts.deceasedPrecision || '',
    deceasedEvidence: facts.deceasedEvidence || '',
    blood: more?.medical?.value?.bloodType || '',
    ...(more?.loaded ? { directory: !!directory } : {})
  };
}

/* HouseholdDto → the portal's household. The API has one name, one address and no town. */
const toHousehold = (h, version) => ({
  id: h.id,
  name: h.name,
  ar: h.name,
  head: h.contactPersonId || null,
  members: (h.members || []).map(m => m.personId),
  town: '',
  townAr: '',
  envelope: h.envelopeId || '',
  address: h.address || '',
  addressAr: h.address || '',
  phone: h.phone || '',
  status: h.status,
  version,
  family: null,
  branch: null
});

async function loadHouseholds(parish, d) {
  const list = await soft(cursorPages(`parishes/${enc(parish.id)}/households`), []);
  const seen = new Set();
  // The list has no members; a household's version changes with its members, so only changed ones are read again.
  await each(list, 6, async row => {
    seen.add(row.value.id);
    const known = state.households.get(row.value.id);
    if (known?.version === row.version) return;
    const full = await parishAPI(`households/${enc(row.value.id)}`);
    state.households.set(row.value.id, { version: full.version, value: full.value });
  });
  for (const id of [...state.households.keys()]) if (!seen.has(id)) state.households.delete(id);
  d.HOUSEHOLDS = list.map(row =>
    toHousehold(state.households.get(row.value.id).value, state.households.get(row.value.id).version)
  );
  const home = new Map(d.HOUSEHOLDS.flatMap(h => h.members.map(m => [m, h.id])));
  for (const p of d.PEOPLE) p.hh = home.get(p.id) || null;
}

async function loadDuplicates(parish, d) {
  const found = await soft(parishAPI('people/duplicates'), []);
  const by = new Map(d.PEOPLE.map(p => [p.id, p]));
  const side = (id, name, linked) => {
    const p = by.get(id);
    return { id, lat: name, ar: name, town: p?.town || '', env: '—', born: p?.born || '', linked };
  };
  d.DUPLICATES = found.map(x => ({
    a: side(x.personA, x.nameA, x.linkedA),
    b: side(x.personB, x.nameB, x.linkedB),
    signals: x.signals || [],
    differences: x.differences || [],
    decision: x.decision || ''
  }));
}

export async function load(parish, d) {
  if (!canRead(parish)) return;
  forParish(parish.id);
  const people = (
    await allPages(`parishes/${enc(parish.id)}/people?pageSize=100`).catch(e =>
      e.status === 403 ? [] : Promise.reject(e)
    )
  ).map(p => [p, toPerson(p, state.facts.get(p.id)?.value)]);
  d.PEOPLE = people.filter(([p]) => !p.archived).map(([, x]) => x);
  d.ARCHIVED = people.filter(([p]) => p.archived).map(([, x]) => ({ ...x, archived: '' }));
  d.PARISH.people = d.PEOPLE.length;
  for (const p of [...d.PEOPLE, ...d.ARCHIVED]) {
    const extra = toExtra(p.id);
    if (extra) d.PERSON_EXTRA[p.id] = extra;
  }
  await loadHouseholds(parish, d);
  await loadDuplicates(parish, d);
}

/* ---------- save ---------- */

const byId = list => new Map((list || []).map(x => [x.id, x]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const omit = (o, ks) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !ks.includes(k)));

/* Fields of a person that other parts of the save own: town and the address come from facts, hh from the
   households. The relationship labels and emergency flag are portal-only. */
const PERSON_OWNED = ['town', 'townAr', 'hh', 'rel', 'relativeTo', 'emergency'];
/* What a PERSON_EXTRA entry sends to the API as facts. */
const factsOf = (p, x) => ({
  region: x?.address?.governorate || '',
  district: x?.address?.district || '',
  town: p?.town || x?.address?.town || '',
  addressDetail: x?.addressDetail || '',
  occupation: x?.occupation || '',
  skills: x?.skills || [],
  preferredLanguage: x?.lang || ''
});
const EXTRA_OWNED = ['occupation', 'skills', 'lang', 'address', 'addressDetail'];
/* Only the facts that changed are sent; the rest of the stored record is kept as it is. */
const changedFacts = (a, b) => Object.fromEntries(Object.entries(b).filter(([k, v]) => !same(a?.[k], v)));

/* A rite, status, Arabic name or relationship label on something being created cannot be kept. */
function dropped(p, x) {
  const out = [];
  if (p.ar && p.ar !== p.lat) out.push('the Arabic name');
  if (p.rite) out.push('the rite');
  if (p.status) out.push('the status');
  if (x?.blood) out.push('the blood type');
  if (p.rel && !['relative', 'head'].includes(p.rel)) out.push('the relationship label');
  return out;
}

function createBody(p) {
  const words = String(p.lat || '')
    .trim()
    .split(/\s+/);
  const contact = p.phone && p.phone !== '—' ? String(p.phone).trim() : null;
  return {
    operationId: newOperationId(),
    givenName: (p.given || '').trim() || words[0] || '',
    familyName: (p.family || '').trim() || words.slice(1).join(' '),
    birthDate: /^\d{4}-\d{2}-\d{2}$/.test(p.born || '') ? p.born : null,
    contact
  };
}

async function setArchived(id, archived) {
  const row = await parishAPI(`people/${enc(id)}`); // { value, version }
  await parishAPI(`people/${enc(id)}/archive`, 'POST', {
    operationId: newOperationId(),
    version: row.version,
    archived
  });
}

/* One household action; the household's version moves with every one, so it is read again after. */
async function householdStep(id, body) {
  const known = state.households.get(id);
  await parishAPI(`households/${enc(id)}/members`, 'POST', {
    operationId: newOperationId(),
    version: known.version,
    inheritsAddress: true,
    ...body
  });
  await refreshHousehold(id);
}
async function refreshHousehold(id) {
  const full = await parishAPI(`households/${enc(id)}`);
  state.households.set(id, { version: full.version, value: full.value });
}

const householdBody = h => ({
  name: (h.name || '').trim(),
  address: (h.address || '').trim() || null,
  phone: (h.phone || '').trim() || null,
  envelopeId: (h.envelope || '').trim() || null
});

/* before and now are snapshots of the whole view model. Returns { unsupported, saved }. */
export async function save(before, now, parish) {
  const was = byId(before.PEOPLE),
    wasArchived = byId(before.ARCHIVED),
    is = byId(now.PEOPLE),
    isArchived = byId(now.ARCHIVED);
  const makes = [...is.values()].filter(p => !was.has(p.id) && !wasArchived.has(p.id));
  const archive = [...was.keys()].filter(id => isArchived.has(id));
  const restore = [...wasArchived.keys()].filter(id => is.has(id));
  const removed = [...was.keys(), ...wasArchived.keys()].some(id => !is.has(id) && !isArchived.has(id));

  // Edits to people who stay: facts the API keeps are sent; a changed name, birth date or contact is not.
  const edits = [];
  let unsupported = removed; // deleting a person has no route
  for (const [id, p] of is) {
    const old = was.get(id);
    if (!old) continue;
    if (!same(omit(old, PERSON_OWNED), omit(p, PERSON_OWNED))) unsupported = true;
    const x = now.PERSON_EXTRA[id],
      ox = before.PERSON_EXTRA[id];
    if (!same(omit(ox, EXTRA_OWNED), omit(x, EXTRA_OWNED))) unsupported = true;
    const patch = changedFacts(factsOf(old, ox), factsOf(p, x));
    if (Object.keys(patch).length) edits.push([id, patch]);
  }

  // Households.
  const hWas = byId(before.HOUSEHOLDS),
    hIs = byId(now.HOUSEHOLDS);
  if ([...hWas.keys()].some(id => !hIs.has(id))) unsupported = true; // deleting a household has no route
  const hMakes = [...hIs.values()].filter(h => !hWas.has(h.id));
  const hEdits = [...hIs.values()].filter(
    h => hWas.has(h.id) && !same(householdBody(hWas.get(h.id)), householdBody(h))
  );
  for (const h of hIs.values()) {
    const old = hWas.get(h.id);
    if (old && (old.ar !== h.ar ? old.name === h.name : false)) unsupported = true; // an Arabic name alone
    if (old && old.town !== h.town) unsupported = true; // the API's household has no town
  }
  if (unsupported) return { unsupported: true, saved: false };

  const notes = new Set();
  const real = id => created.get(id) || id;
  // People first, so a household can name them.
  for (const p of makes) {
    const made = await parishAPI('people', 'POST', createBody(p));
    created.set(p.id, made.id);
    const x = now.PERSON_EXTRA[p.id];
    const given = Object.fromEntries(
      Object.entries(factsOf(p, x)).filter(([, v]) => (Array.isArray(v) ? v.length : v))
    );
    if (Object.keys(given).length) await saveFacts(made.id, given);
    dropped(p, x).forEach(n => notes.add(n));
  }
  for (const id of archive) await setArchived(id, true);
  for (const id of restore) await setArchived(id, false);
  for (const [id, patch] of edits) await saveFacts(id, patch);

  // Households: create, change, then people leave before others join, so a move works.
  for (const h of hMakes) {
    const made = await parishAPI('households', 'POST', { operationId: newOperationId(), ...householdBody(h) });
    created.set(h.id, made.id);
    await refreshHousehold(made.id);
    if (h.ar && h.ar !== h.name) notes.add('the Arabic household name');
    if (h.town) notes.add("the household's town");
  }
  for (const h of hEdits) {
    const known = state.households.get(h.id);
    await parishAPI(`households/${enc(h.id)}`, 'PUT', {
      operationId: newOperationId(),
      version: known.version,
      ...householdBody(h)
    });
    await refreshHousehold(h.id);
  }
  const members = h => (h?.members || []).map(real);
  const apply = [];
  for (const h of hIs.values()) {
    const id = real(h.id),
      old = hWas.get(h.id);
    for (const m of members(old)) if (!members(h).includes(m)) apply.push(['remove', id, m]);
  }
  for (const h of hIs.values()) {
    const id = real(h.id),
      old = hWas.get(h.id);
    for (const m of members(h)) if (!members(old).includes(m)) apply.push(['add', id, m]);
  }
  for (const [action, id, person] of apply.sort((a, b) => (a[0] === 'remove' ? -1 : 1) - (b[0] === 'remove' ? -1 : 1)))
    await householdStep(id, { action, personId: person });
  for (const h of hIs.values()) {
    const id = real(h.id),
      old = hWas.get(h.id),
      head = h.head ? real(h.head) : null;
    if (head && head !== (old?.head ? real(old.head) : null) && members(h).includes(head))
      await householdStep(id, { action: 'set-contact', personId: head });
  }

  if (notes.size)
    document.dispatchEvent(
      new CustomEvent('parish-save-error', {
        detail: `Saved. The new backend does not keep ${[...notes].join(', ')} yet, so ${notes.size > 1 ? 'they are' : 'it is'} left out.`
      })
    );
  const saved =
    makes.length + archive.length + restore.length + edits.length + hMakes.length + hEdits.length + apply.length > 0;
  return { unsupported: false, saved };
}
