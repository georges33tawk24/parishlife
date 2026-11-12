/* Purpose: keeps the portal's shared view model (model/data.js) in step with ParishLife.Api.
   Main functions: hydrate (each connected module loads its collections), persist (each module sends
   its changes; changes no module can save are undone and reported), applyData, workflow, savedAt,
   savedSize, backupJSON. The modules are in model/modules/.

   The screens still change plain objects in place and then call persist(). The .NET API has no
   whole-parish save, so persist() compares the view model with what was last loaded and gives each
   connected module (model/modules/) the changes to its own collections to send. Everything else is
   undone on screen and reported, so nothing looks saved that was not. hydrate() then reloads from the API,
   so the screens always show what is actually stored. */
import * as D from './data.js';
import { session, notConnected } from './api.js';
import { MODULES } from './modules/index.js';

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

/* A module whose data cannot load (an error, a route not deployed yet) leaves its own pages empty with
   the reason, instead of stopping the whole portal. An ended session (401) still stops it. */
export const loadFailures = new Map(); // portal page → why its module did not load

export async function hydrate() {
  const parish = session.parishes.find(p => p.id === session.parishId);
  const d = emptyParish(parish);
  loadFailures.clear();
  if (parish)
    for (const m of MODULES) {
      try {
        await m.load(parish, d);
      } catch (error) {
        if (error.status === 401) throw error;
        const fresh = emptyParish(parish);
        for (const k of m.keys) d[k] = fresh[k];
        for (const r of m.routes) loadFailures.set(r, error.message);
      }
    }
  applyData(d);
  baseline = snapshot();
  saveFailed = false;
  return true;
}

/* Collections a module may change in passing (counts on the parish record) without that being a save. */
const DERIVED = ['PARISH', 'PARISHES'];
const owned = () => new Set([...MODULES.flatMap(m => m.keys), ...DERIVED]);

export function persist() {
  if (!session.user) return Promise.resolve(false);
  again = true;
  if (running) return running;
  running = Promise.resolve().then(async () => {
    let ok = true;
    try {
      while (again) {
        again = false;
        const now = snapshot(),
          changed = KEYS.filter(k => JSON.stringify(now[k]) !== JSON.stringify(baseline[k]));
        if (!changed.length) continue;
        const parish = session.parishes.find(p => p.id === session.parishId);
        let unsupported = changed.some(k => !owned().has(k)),
          saved = false;
        for (const m of MODULES.filter(m => m.keys.some(k => changed.includes(k)))) {
          const result = (await m.save(baseline, now, parish)) || {};
          unsupported ||= !!result.unsupported;
          saved ||= !!result.saved;
        }
        if (unsupported) {
          ok = false;
          document.dispatchEvent(new CustomEvent('parish-save-error', { detail: notConnected }));
        }
        await hydrate(); // the screens show what the API stored, and nothing it did not
        if (saved) lastSaved = new Date().toISOString();
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
