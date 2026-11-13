/* Purpose: the People module's connection to ParishLife.Api: loading the parish's people, their facts,
   households and duplicate suggestions, and turning what changed on screen into API calls.
   Main members: keys (the view-model collections this module owns), routes (the portal pages it feeds),
   load (fills those collections from the API), save (sends what changed), createdId (the API's id for a
   person or household that was added on screen).

   What the API holds, and so what the screens show:
   - PEOPLE / ARCHIVED: given and family name with their optional Arabic twins, birth date, one contact,
     rite and register status (Member or Visitor) (GET people). The office edits them with PUT people/{id}.
   - Person facts (country, region, district, town and its Arabic twin, address detail, occupation, skills,
     preferred language, death) load for the whole parish with GET people/facts, and again for one person
     when opened; the portal's town, address cascade, occupation, skills and language come from them.
   - The directory flag comes from the parish's given Directory consents (GET consents?kind=Directory).
   - HOUSEHOLDS: name and Arabic name, address, town and its Arabic twin, phone, envelope number, contact
     person and members (the list carries members); a person's hh is the household they belong to.
   - DUPLICATES: the API's suggestions with their signals and differences. There is no similarity score.
   Everything the API does not have (tags, relationship labels, a clergy status, the notification channel)
   stays empty or is undone and reported; see docs/frontend-modules/people.md. */
import { allPages, api, parishAPI, newOperationId } from '../api.js';
import { state, forParish, detail, saveFacts, directoryFields } from './people-workflows.js';

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
/* Optional lists (facts, directory consents) also stay empty on a server that does not have them yet. */
const optional = (promise, fallback) =>
  promise.catch(e => ([403, 404].includes(e.status) ? fallback : Promise.reject(e)));

/* A list the API pages with size and cursor (households, facts, consents, relationships, history). */
async function cursorPages(path, limit = 5000) {
  const items = [];
  let cursor = '';
  const join = path.includes('?') ? '&' : '?';
  do {
    const page = await api(`${path}${join}size=100${cursor ? `&cursor=${enc(cursor)}` : ''}`);
    items.push(...(page?.items || []));
    cursor = page?.continuationToken || '';
  } while (cursor && items.length < limit);
  return items;
}

const STATUS_IN = { Member: 'member', Visitor: 'visitor' };
const STATUS_OUT = { member: 'Member', visitor: 'Visitor' };
const words = s =>
  String(s || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

/* PersonDto → the portal's person. ar shows the Latin name when no Arabic one is stored (display only);
   arStored keeps what the API holds, so an untouched fallback is never saved as Arabic. Facts give the town. */
function toPerson(p, facts) {
  const name = `${p.givenName || ''} ${p.familyName || ''}`.trim();
  const arabic = [p.givenNameAr, p.familyNameAr].filter(Boolean).join(' ');
  const town = facts?.town || facts?.localityNotListed || '';
  return {
    id: p.id,
    lat: name,
    ar: arabic || name,
    arStored: arabic,
    given: p.givenName,
    family: p.familyName,
    givenAr: p.givenNameAr || '',
    familyAr: p.familyNameAr || '',
    town,
    townAr: facts?.townAr || town,
    rite: p.rite || '',
    status: STATUS_IN[p.registerStatus] || '',
    phone: p.contact || '—',
    born: p.birthDate || '',
    hh: null,
    tags: [],
    createdAt: p.createdAt
  };
}

/* PersonFactsDto (and what else was opened) → the portal's PERSON_EXTRA entry. The directory flag comes
   from the parish-wide Directory consents when they loaded, else from the person's own consents. */
function toExtra(id) {
  const more = detail(id);
  const directory = state.directory
    ? state.directory.has(id)
    : more?.loaded
      ? more.consents.some(r => r.value.kind === 'Directory' && r.value.status === 'Given')
      : undefined;
  const facts = state.facts.get(id)?.value;
  if (!facts) return directory === undefined ? null : { directory };
  return {
    occupation: facts.occupation || '',
    skills: facts.skills || [],
    lang: facts.preferredLanguage || '',
    address: {
      governorate: facts.region || '',
      district: facts.district || '',
      town: facts.town || facts.localityNotListed || '',
      townAr: facts.townAr || '',
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
    ...(directory === undefined ? {} : { directory })
  };
}

/* HouseholdDto → the portal's household. ar shows the Latin name when no Arabic one is stored (display
   only); arStored keeps what the API holds. */
const toHousehold = (h, version) => ({
  id: h.id,
  name: h.name,
  ar: h.nameAr || h.name,
  arStored: h.nameAr || '',
  head: h.contactPersonId || null,
  members: (h.members || []).map(m => m.personId),
  town: h.town || '',
  townAr: h.townAr || h.town || '',
  townArStored: h.townAr || '',
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
  // The list carries each household's members, so no household is read on its own.
  state.households.clear();
  for (const row of list) state.households.set(row.value.id, { version: row.version, value: row.value });
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

/* Every stored facts record and every given Directory consent of the parish, in pages. Both need an
   authenticator session; without one they stay as they were. */
async function loadParishWide(parish) {
  const facts = await optional(cursorPages(`parishes/${enc(parish.id)}/people/facts`, 20000), null);
  if (facts) for (const row of facts) state.facts.set(row.value.personId, { version: row.version, value: row.value });
  const consents = await optional(cursorPages(`parishes/${enc(parish.id)}/consents?kind=Directory`, 20000), null);
  state.directory = consents ? directoryFields(consents) : null;
}

export async function load(parish, d) {
  if (!canRead(parish)) return;
  forParish(parish.id);
  await loadParishWide(parish);
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
   households, and the core record (names, birth date, contact, rite, status) goes to PUT people/{id}. The
   relationship labels and emergency flag are portal-only. */
const PERSON_OWNED = ['town', 'townAr', 'hh', 'rel', 'relativeTo', 'emergency'];
const CORE = ['lat', 'ar', 'arStored', 'given', 'family', 'givenAr', 'familyAr', 'born', 'phone', 'rite', 'status'];
/* What a PERSON_EXTRA entry sends to the API as facts. */
const factsOf = (p, x) => ({
  region: x?.address?.governorate || '',
  district: x?.address?.district || '',
  town: p?.town || x?.address?.town || '',
  townAr: townArOf(p, x),
  addressDetail: x?.addressDetail || '',
  occupation: x?.occupation || '',
  skills: x?.skills || [],
  preferredLanguage: x?.lang || ''
});
const EXTRA_OWNED = ['occupation', 'skills', 'lang', 'address', 'addressDetail'];
/* Only the facts that changed are sent; the rest of the stored record is kept as it is. */
const changedFacts = (a, b) => Object.fromEntries(Object.entries(b).filter(([k, v]) => !same(a?.[k], v)));

/* The Arabic town to save: the one shown for the town, unless it is only the Latin town repeated. */
function townArOf(p, x) {
  const town = p?.town || x?.address?.town || '';
  const ar = p?.townAr || x?.address?.townAr || '';
  return ar && ar !== town ? ar : '';
}

/* What cannot be kept on a person being created: a clergy status (that comes from appointments), the
   blood type outside the medical declaration, a relationship label, or a directory choice (a Directory
   consent is recorded on the person's Consent tab, with who gave it and the policy version). */
function dropped(p, x) {
  const out = [];
  if (p.status && !STATUS_OUT[p.status]) out.push('the clergy status');
  if (x?.blood) out.push('the blood type');
  if (p.rel && !['relative', 'head'].includes(p.rel)) out.push('the relationship label');
  if (x?.directory) out.push('the directory choice (record it as a consent on the Consent tab)');
  return out;
}

/* Given and family name from one typed name: the first word and the rest. */
function nameParts(text) {
  const w = words(text);
  return { given: w[0] || '', family: w.slice(1).join(' ') };
}

/* The core record as the API takes it, on a create and on an office edit. */
function coreBody(p, old) {
  const latin =
    old && old.lat === p.lat ? { given: p.given || old.given, family: p.family || old.family } : nameParts(p.lat);
  // Arabic is sent only as typed: an untouched display fallback (the Latin name) is never saved as Arabic.
  const arTyped = old ? p.ar !== old.ar : !!p.ar && p.ar !== p.lat;
  const arabic = arTyped
    ? nameParts(p.ar)
    : { given: p.givenAr || old?.givenAr || '', family: p.familyAr || old?.familyAr || '' };
  const contact = p.phone && p.phone !== '—' ? String(p.phone).trim() : null;
  return {
    givenName: latin.given.trim(),
    familyName: latin.family.trim(),
    givenNameAr: arabic.given || null,
    familyNameAr: arabic.family || null,
    birthDate: /^\d{4}-\d{2}-\d{2}$/.test(p.born || '') ? p.born : null,
    contact,
    rite: (p.rite || '').trim() || null,
    registerStatus: STATUS_OUT[p.status] || null
  };
}

const createBody = p => ({ operationId: newOperationId(), ...coreBody(p, null) });

/* The office edit replaces the whole core record, so it starts from the current version. */
async function updatePerson(id, p, old) {
  const row = await parishAPI(`people/${enc(id)}`); // { value, version }
  await parishAPI(`people/${enc(id)}`, 'PUT', {
    operationId: newOperationId(),
    version: row.version,
    ...coreBody(p, old)
  });
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

/* The household as the API takes it. The Arabic name and town are sent only as typed: an untouched
   display fallback (the Latin text) stays unsaved. */
const householdBody = h => {
  const name = (h.name || '').trim(),
    town = (h.town || '').trim(),
    ar = (h.ar || '').trim(),
    townAr = (h.townAr || '').trim();
  return {
    name,
    nameAr: ar && (ar !== name || h.arStored) ? ar : null,
    address: (h.address || '').trim() || null,
    town: town || null,
    townAr: townAr && (townAr !== town || h.townArStored) ? townAr : null,
    phone: (h.phone || '').trim() || null,
    envelopeId: (h.envelope || '').trim() || null
  };
};

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

  // Edits to people who stay: the core record goes to PUT people/{id}, facts to PUT people/{id}/facts.
  const edits = [];
  const cores = [];
  let unsupported = removed; // deleting a person has no route
  for (const [id, p] of is) {
    const old = was.get(id);
    if (!old) continue;
    const owned = [...PERSON_OWNED, ...CORE];
    if (!same(omit(old, owned), omit(p, owned))) unsupported = true;
    if (p.status !== old.status && p.status && !STATUS_OUT[p.status]) unsupported = true; // clergy comes from appointments
    if (CORE.some(k => !same(old[k], p[k]))) {
      if (!(p.lat || '').trim() || words(p.lat).length < 2) unsupported = true; // the API needs a given and a family name
      cores.push([id, p, old]);
    }
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
  for (const [id, p, old] of cores) await updatePerson(id, p, old);
  for (const id of archive) await setArchived(id, true);
  for (const id of restore) await setArchived(id, false);
  for (const [id, patch] of edits) await saveFacts(id, patch);

  // Households: create, change, then people leave before others join, so a move works.
  for (const h of hMakes) {
    const made = await parishAPI('households', 'POST', { operationId: newOperationId(), ...householdBody(h) });
    created.set(h.id, made.id);
    await refreshHousehold(made.id);
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
        detail: `Saved. The backend does not keep ${[...notes].join(', ')} here, so ${notes.size > 1 ? 'they are' : 'it is'} left out.`
      })
    );
  const saved =
    makes.length +
      cores.length +
      archive.length +
      restore.length +
      edits.length +
      hMakes.length +
      hEdits.length +
      apply.length >
    0;
  return { unsupported: false, saved };
}
