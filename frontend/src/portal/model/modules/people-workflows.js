/* Purpose: the People module's direct calls to ParishLife.Api for work that is a workflow rather than an edit
   of a list: a person's facts, medical declaration, consents and relationships; duplicate decisions and
   merges; people search and CSV export; the membership-request queue and profile corrections; household
   history. The screens call these, then hydrate() so they show what the API stored.
   Main members: state (what the module has loaded: facts, details, households, directory consents),
   openPerson, saveFacts, recordConsent, withdrawConsent, directoryFields, directoryConsents, saveMedical, addRelationship, endRelationship, searchPeople,
   previewExport, exportPeople, duplicateDecision, previewMerge, mergePeople, unmerge, listMerges,
   membershipQueue, decideMembership, correctionQueue, reviewCorrection, householdHistory.

   Every create carries an operation id and every change to an existing record sends the version the API
   returned with it. Routes and fields are the ones in ParishLife.Api/Controllers/People and DTOs/People. */
import { api, parishAPI, newOperationId } from '../api.js';

export const state = {
  parishId: '',
  facts: new Map(), // personId → { version, value: PersonFactsDto }
  details: new Map(), // personId → { consents, medical, relationships, loaded }
  households: new Map(), // householdId → { version, value: HouseholdDto with members }
  directory: null // personId → the fields their given Directory consents disclose; null until loaded
};

/* The caches belong to one parish: switching parish starts them again. */
export function forParish(id) {
  if (state.parishId === id) return;
  state.parishId = id;
  state.facts.clear();
  state.details.clear();
  state.households.clear();
  state.directory = null;
}

const enc = encodeURIComponent;
const soft = (promise, fallback) => promise.catch(e => ([403, 404].includes(e.status) ? fallback : Promise.reject(e)));
export const detail = id => state.details.get(id) || null;

/* ---------- person facts ---------- */
export async function fetchFacts(id) {
  const row = await parishAPI(`people/${enc(id)}/facts`);
  const entry = { version: row?.version || '', value: row?.value || { personId: id, skills: [] } };
  state.facts.set(id, entry);
  return entry;
}

/* Everything the API holds about one person that the list does not carry. Each part a role may not see
   (medical needs people.medical.manage) stays empty rather than failing the page. Returns true when the
   facts are new to the caches, so the caller reloads the lists. */
export async function openPerson(id) {
  const first = !state.facts.has(id);
  const [facts, consents, medical, relationships] = await Promise.all([
    soft(fetchFacts(id), null),
    soft(parishAPI(`people/${enc(id)}/consents`), []),
    soft(parishAPI(`people/${enc(id)}/medical`), null),
    soft(parishAPI(`people/${enc(id)}/relationships?size=100`), { items: [] })
  ]);
  state.details.set(id, {
    consents: consents || [],
    medical: medical || null,
    relationships: relationships?.items || [],
    loaded: true
  });
  return first && !!facts;
}

/* The API replaces the whole facts record, so a change starts from what is stored. */
export async function saveFacts(id, patch) {
  const current = state.facts.get(id) || (await fetchFacts(id));
  const f = { ...current.value, ...patch };
  await parishAPI(`people/${enc(id)}/facts`, 'PUT', {
    operationId: newOperationId(),
    version: current.version || undefined,
    country: f.country || null,
    region: f.region || null,
    district: f.district || null,
    town: f.town || null,
    townAr: f.townAr || null,
    addressDetail: f.addressDetail || null,
    localityNotListed: f.town || f.townAr ? null : f.localityNotListed || null,
    occupation: f.occupation || null,
    skills: f.skills || [],
    preferredLanguage: f.preferredLanguage || null,
    deceasedOn: f.deceasedOn || null,
    deceasedPrecision: f.deceasedPrecision || null,
    deceasedEvidence: f.deceasedEvidence || null
  });
  return fetchFacts(id); // the API answers without the new version
}

/* ---------- medical declaration and consents ---------- */
export async function saveMedical(id, form) {
  const current = detail(id)?.medical;
  const saved = await parishAPI(`people/${enc(id)}/medical`, 'PUT', {
    operationId: newOperationId(),
    version: current?.version || undefined,
    allergies: form.allergies || null,
    conditions: form.conditions || null,
    bloodType: form.bloodType || null,
    notes: form.notes || null,
    source: form.source || null,
    purpose: form.purpose
  });
  return saved;
}

export const recordConsent = (id, form) =>
  parishAPI(`people/${enc(id)}/consents`, 'POST', {
    operationId: newOperationId(),
    kind: form.kind,
    purpose: form.purpose,
    policyVersion: form.policyVersion,
    fields: form.kind === 'Directory' ? form.fields || [] : [],
    givenBy: form.givenBy
  });

export const withdrawConsent = (row, reason) =>
  parishAPI(`consents/${enc(row.value.id)}/withdraw`, 'POST', {
    operationId: newOperationId(),
    version: row.version,
    reason: reason || null
  });

/* Given Directory consents (rows of ConsentDto) → personId → the set of fields they disclose. */
export function directoryFields(rows) {
  const out = new Map();
  for (const { value } of rows) {
    if (value.kind !== 'Directory' || value.status !== 'Given') continue;
    const fields = out.get(value.personId) || new Set();
    (value.fields || []).forEach(f => fields.add(f));
    out.set(value.personId, fields);
  }
  return out;
}

/* Every given Directory consent of the parish, read now (the printed directory), as directoryFields. */
export async function directoryConsents() {
  const rows = [];
  let cursor = '';
  do {
    const page = await parishAPI(`consents?kind=Directory&size=100${cursor ? `&cursor=${enc(cursor)}` : ''}`);
    rows.push(...(page?.items || []));
    cursor = page?.continuationToken || '';
  } while (cursor && rows.length < 20000);
  return directoryFields(rows);
}

/* ---------- relationships ---------- */
export const addRelationship = (id, form) =>
  parishAPI(`people/${enc(id)}/relationships`, 'POST', {
    operationId: newOperationId(),
    relatedPersonId: form.relatedPersonId,
    kind: form.kind,
    source: form.source || null,
    evidenceReference: form.evidenceReference || null
  });

export const endRelationship = (id, row, reason) =>
  parishAPI(`people/${enc(id)}/relationships/${enc(row.value.id)}/end`, 'POST', {
    operationId: newOperationId(),
    version: row.version,
    reason
  });

/* ---------- households ---------- */
export async function householdHistory(id) {
  const items = [];
  let cursor = '';
  do {
    const page = await parishAPI(`households/${enc(id)}/history?size=100${cursor ? `&cursor=${enc(cursor)}` : ''}`);
    items.push(...(page?.items || []));
    cursor = page?.continuationToken || '';
  } while (cursor && items.length < 1000);
  return items;
}

/* ---------- search and export ---------- */
export const searchPeople = (q, includeArchived = false) =>
  parishAPI(`people/search?q=${enc(q)}&includeArchived=${!!includeArchived}&size=25`);

export const previewExport = (columns, includeArchived) =>
  parishAPI(
    `people/export/preview?${columns.map(c => `columns=${enc(c)}`).join('&')}${columns.length ? '&' : ''}includeArchived=${!!includeArchived}`
  );

/* The export answers with a CSV file, not JSON, so it is fetched here with the anti-forgery token. */
export async function exportPeople({ purpose, columns, includeArchived }) {
  const { token } = await api('auth/csrf');
  const response = await fetch(`/api/parishes/${enc(state.parishId)}/people/export`, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'text/csv', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token },
    body: JSON.stringify({ operationId: newOperationId(), purpose, columns, includeArchived: !!includeArchived })
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new Error(problem?.detail || 'The export could not be generated.');
  }
  return response.text();
}

/* ---------- duplicates and merges ---------- */
export const duplicateDecision = (a, b, decision, reason) =>
  parishAPI('people/duplicates/decisions', 'POST', {
    operationId: newOperationId(),
    personA: a,
    personB: b,
    decision,
    reason
  });

export const previewMerge = (survivorId, sourceId) =>
  parishAPI(`people/merges/preview?survivorId=${enc(survivorId)}&sourceId=${enc(sourceId)}`);

export const mergePeople = (survivorId, sourceId, choices, reason) =>
  parishAPI('people/merges', 'POST', { operationId: newOperationId(), survivorId, sourceId, choices, reason });

export const unmerge = (merge, reason) =>
  parishAPI(`people/merges/${enc(merge.id)}/unmerge`, 'POST', {
    operationId: newOperationId(),
    version: merge.version,
    reason
  });

export const listMerges = () => soft(parishAPI('people/merges'), []);

/* ---------- the office queues ---------- */
export const membershipQueue = () => parishAPI('membership-requests');

export const decideMembership = (row, form) =>
  parishAPI(`membership-requests/${enc(row.value.id)}/decision`, 'POST', {
    operationId: newOperationId(),
    version: row.version,
    action: form.action,
    personId: form.action === 'link' ? form.personId : null,
    evidenceReference: form.evidenceReference || null,
    reason: form.reason || null,
    allowPossibleDuplicate: !!form.allowPossibleDuplicate
  });

export const correctionQueue = () => parishAPI('profile-corrections');

/* decisions: [{ field, approve, reason }], one for every proposed field. */
export const reviewCorrection = (row, decisions) =>
  parishAPI(`profile-corrections/${enc(row.value.id)}/review`, 'POST', {
    operationId: newOperationId(),
    version: row.version,
    decisions: decisions.map(d => ({
      field: d.field,
      approve: !!d.approve,
      reason: d.approve ? null : d.reason || null
    }))
  });
