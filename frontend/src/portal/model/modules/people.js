/* Purpose: the People module's connection to ParishLife.Api: loading the parish's people and turning
   new and archived people into API calls.
   Main members: keys (the view-model collections this module owns), routes (the portal pages it
   feeds), load (fills those collections from the API), save (sends what changed).

   The API keeps one given and one family name, a birth date and one contact per person. The portal's
   Arabic name, town, rite, household and status come from other API resources (person facts,
   households) or have no API field yet; until they are connected they stay empty, and editing an
   existing person is reported as not saved. */
import { allPages, parishAPI, newOperationId } from '../api.js';

export const keys = ['PEOPLE', 'ARCHIVED', 'PERSON_EXTRA'];
export const routes = ['people', 'person'];

/* PersonDto → the portal's person */
const toPerson = p => {
  const name = `${p.givenName || ''} ${p.familyName || ''}`.trim();
  return {
    id: p.id,
    lat: name,
    ar: name,
    given: p.givenName,
    family: p.familyName,
    town: '',
    townAr: '',
    rite: '',
    status: '',
    phone: p.contact || '—',
    born: p.birthDate || '',
    hh: null,
    tags: [],
    createdAt: p.createdAt
  };
};

export async function load(parish, d) {
  if (!parish.roles?.includes('priest') && !parish.capabilities?.includes('people.read')) return;
  const people = (
    await allPages(`parishes/${encodeURIComponent(parish.id)}/people?pageSize=200`).catch(e =>
      e.status === 403 ? [] : Promise.reject(e)
    )
  ).map(p => [p, toPerson(p)]);
  d.PEOPLE = people.filter(([p]) => !p.archived).map(([, x]) => x);
  d.ARCHIVED = people.filter(([p]) => p.archived).map(([, x]) => ({ ...x, archived: '' }));
  d.PARISH.people = d.PEOPLE.length;
}

/* A new person: the portal keeps one display name, the API a given and a family name. */
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

/* before and now are snapshots of the whole view model. Returns { unsupported } when something
   changed that this module cannot send to the API yet. */
export async function save(before, now) {
  const ids = list => new Map((list || []).map(x => [x.id, x]));
  const was = ids(before.PEOPLE),
    wasArchived = ids(before.ARCHIVED),
    is = ids(now.PEOPLE),
    isArchived = ids(now.ARCHIVED);
  const create = [...is.values()].filter(p => !was.has(p.id) && !wasArchived.has(p.id));
  const archive = [...was.keys()].filter(id => isArchived.has(id));
  const unsupported =
    [...wasArchived.keys()].some(id => is.has(id)) || // restoring is not in the API
    [...was.keys()].some(id => !is.has(id) && !isArchived.has(id)) || // nor is deleting
    [...is.values()].some(p => was.has(p.id) && JSON.stringify(p) !== JSON.stringify(was.get(p.id))); // nor editing yet
  for (const p of create) await parishAPI('people', 'POST', createBody(p));
  for (const id of archive) await parishAPI(`people/${encodeURIComponent(id)}/archive`, 'POST');
  return { unsupported, saved: create.length + archive.length > 0 };
}
