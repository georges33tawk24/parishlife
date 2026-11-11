/* Purpose: keeps the portal's shared view model (model/data.js) in step with ParishLife.Api.
   Main functions: hydrate (load what the API provides into the view model), persist (send supported
   changes to the API and undo the rest), applyData, workflow, savedAt, savedSize, backupJSON.

   The screens still change plain objects in place and then call persist(). The .NET API has no
   whole-parish save, so persist() compares the view model with what was last loaded and turns the
   changes it understands into API calls: adding people, and archiving them. Everything else is undone
   on screen and reported, so nothing looks saved that was not. hydrate() then reloads from the API,
   so the screens always show what is actually stored. */
import * as D from './data.js';
import { session, parishAPI, allPages, newOperationId, notConnected } from './api.js';

const KEYS = Object.keys(D).filter(k => k !== 'TODAY' && D[k] && typeof D[k] === 'object' && !(D[k] instanceof Date));
const snapshot = () => JSON.parse(JSON.stringify(Object.fromEntries(KEYS.map(k => [k, D[k]]))));
const demo = snapshot(); // the demo records' shapes, taken before anything replaces them
let baseline = {},
  running = null,
  again = false,
  lastSaved = null;
export let saveFailed = false;

function applyKey(k, value) {
  if (Array.isArray(D[k])) {
    const existing = new Map(D[k].filter(x => x && typeof x === 'object' && x.id != null).map(x => [x.id, x]));
    D[k].splice(
      0,
      D[k].length,
      ...value.map(x => {
        const old = x && typeof x === 'object' ? existing.get(x.id) : null;
        if (!old || old === x) return x; // the same object on both sides: clearing it would erase it
        Object.keys(old).forEach(field => delete old[field]);
        Object.assign(old, x);
        return old;
      })
    );
  } else {
    Object.keys(D[k]).forEach(x => delete D[k][x]);
    Object.assign(D[k], value);
  }
}
export function applyData(data) {
  for (const k of KEYS) applyKey(k, data[k] ?? (Array.isArray(D[k]) ? [] : {}));
  if (typeof D.RATE.setOn === 'string') D.RATE.setOn = new Date(D.RATE.setOn);
}

/* An empty parish with the structure the views expect (the same defaults the old server gave a new
   parish). No demo record survives: a collection the API does not provide yet is simply empty. */
function emptyParish(parish) {
  const d = Object.fromEntries(KEYS.map(k => [k, Array.isArray(demo[k]) ? [] : {}]));
  for (const k of ['SERVICE', 'ROTA', 'CHECKIN', 'BATCH', 'REG_FORM', 'EVACUATION', 'PREP_REQUIREMENTS'])
    if (demo[k] && !Array.isArray(demo[k])) d[k] = JSON.parse(JSON.stringify(demo[k]));
  Object.assign(d.SERVICE, { order: [], celebrant: null, coordinator: null, venue: null });
  if (d.ROTA) d.ROTA.teams = [];
  Object.assign(d.CHECKIN, { rows: [], sessions: {}, present: 0, expected: 0, awaitingGuardian: 0, room: null });
  Object.assign(d.BATCH, { lines: [], counters: [] });
  if (d.REG_FORM) Object.assign(d.REG_FORM, { fields: [], discounts: [], installments: [] });
  if (d.EVACUATION) d.EVACUATION.rooms = [];
  d.RATE = { value: 0, setOn: null, setBy: '' }; // the API's exchange rate is not connected yet
  d.PARISH = {
    name: parish?.name || 'ParishLife',
    nameAr: parish?.nameAr || parish?.name || 'حياة الرعية',
    town: '',
    townAr: '',
    rite: '',
    riteAr: ''
  };
  d.PARISHES = session.parishes;
  return d;
}

/* PersonDto → the portal's person. The API keeps one given and one family name, a birth date and one
   contact; the portal's Arabic name, town, rite, household and status have no API field yet. */
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

export async function hydrate() {
  const parish = session.parishes.find(p => p.id === session.parishId);
  const d = emptyParish(parish);
  if (parish && session.user?.role === 'priest') {
    const people = (await allPages(`parishes/${encodeURIComponent(parish.id)}/people?pageSize=200`)).map(p => [
      p,
      toPerson(p)
    ]);
    d.PEOPLE = people.filter(([p]) => !p.archived).map(([, x]) => x);
    d.ARCHIVED = people.filter(([p]) => p.archived).map(([, x]) => ({ ...x, archived: '' }));
    d.PARISH.people = d.PEOPLE.length;
  }
  applyData(d);
  baseline = snapshot();
  saveFailed = false;
  return true;
}

/* A new person: the portal keeps one display name, the API a given and a family name. */
function createBody(p) {
  const given =
    (p.given || '').trim() ||
    String(p.lat || '')
      .trim()
      .split(/\s+/)[0] ||
    '';
  const family =
    (p.family || '').trim() ||
    String(p.lat || '')
      .trim()
      .split(/\s+/)
      .slice(1)
      .join(' ');
  const contact = p.phone && p.phone !== '—' ? String(p.phone).trim() : null;
  return {
    operationId: newOperationId(),
    givenName: given,
    familyName: family,
    birthDate: /^\d{4}-\d{2}-\d{2}$/.test(p.born || '') ? p.born : null,
    contact
  };
}

/* What changed since the last load: the people supported by the API, and everything else. */
function changes() {
  const now = snapshot(),
    ids = list => new Map((list || []).map(x => [x.id, x]));
  const was = ids(baseline.PEOPLE),
    wasArchived = ids(baseline.ARCHIVED),
    is = ids(now.PEOPLE),
    isArchived = ids(now.ARCHIVED);
  const create = [...is.values()].filter(p => !was.has(p.id) && !wasArchived.has(p.id));
  const archive = [...was.keys()].filter(id => isArchived.has(id));
  const peopleOther =
    [...wasArchived.keys()].some(id => is.has(id)) || // restoring is not in the API
    [...was.keys()].some(id => !is.has(id) && !isArchived.has(id)) || // nor is deleting
    [...is.values()].some(p => was.has(p.id) && JSON.stringify(p) !== JSON.stringify(was.get(p.id))); // nor editing
  const other = KEYS.filter(
    k =>
      !['PEOPLE', 'ARCHIVED', 'PERSON_EXTRA', 'PARISH'].includes(k) &&
      JSON.stringify(now[k]) !== JSON.stringify(baseline[k])
  );
  return {
    create,
    archive,
    unsupported: peopleOther || other.length > 0,
    any: create.length || archive.length || peopleOther || other.length
  };
}

export function persist() {
  if (!session.user) return Promise.resolve(false);
  again = true;
  if (running) return running;
  running = Promise.resolve().then(async () => {
    let ok = true;
    try {
      while (again) {
        again = false;
        const c = changes();
        if (!c.any) continue;
        for (const p of c.create) await parishAPI('people', 'POST', createBody(p));
        for (const id of c.archive) await parishAPI(`people/${encodeURIComponent(id)}/archive`, 'POST');
        if (c.unsupported) {
          ok = false;
          document.dispatchEvent(new CustomEvent('parish-save-error', { detail: notConnected }));
        }
        await hydrate();
        if (c.create.length || c.archive.length) lastSaved = new Date().toISOString();
      }
      saveFailed = !ok;
      return ok;
    } catch (error) {
      again = false;
      saveFailed = true;
      await hydrate().catch(() => applyData(baseline));
      document.dispatchEvent(new CustomEvent('parish-save-error', { detail: error.message }));
      return false;
    } finally {
      running = null;
    }
  });
  return running;
}
export const savedAt = () => lastSaved;
export const savedSize = () => JSON.stringify(baseline).length;
export const backupJSON = () =>
  JSON.stringify({ v: 2, parish: session.parishId, at: new Date().toISOString(), d: snapshot() }, null, 2);
/* The old server's record workflow (sign, issue, approve) has no single API equivalent: each module's
   own routes replace it as that module is connected. */
export async function workflow() {
  throw new Error(notConnected);
}
