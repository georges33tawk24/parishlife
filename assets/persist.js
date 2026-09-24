/* The parish is kept in this browser — there is no server.
   Every change the interface makes goes through the arrays and objects in
   data.js. After each change the whole set is written to localStorage, and on
   start it is read back into those same objects before anything renders, so a
   record you add, edit or delete is still there after a reload. */
import * as D from './data.js';

const KEY = 'pl-data';
const VERSION = 1;   // bump only if data.js changes shape so much that an old save cannot be read
const REV = 3;       // bump when data.js gains fields that an existing save should pick up (see migrate)
/* sample values that were wrong in an earlier REV: [collection, id, field, wrong, right] — only replaced if still wrong */
const FIXES = [['MUSIC', 'm6', 'title', 'Salamun Lak\u0650', 'Salamun Laki']];
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/;
const revive = (k, v) => typeof v === 'string' && ISO.test(v) ? new Date(v) : v;
const KEYS = Object.keys(D).filter(k => k !== 'TODAY' && D[k] && typeof D[k] === 'object' && !(D[k] instanceof Date));

/** Copy a saved parish into the live objects, in place, so every module that imported them sees it. */
function apply(saved) {
  for (const k of KEYS) {
    if (!(k in saved.d)) continue;                    // a collection added since the save keeps its defaults
    const cur = D[k], val = saved.d[k];
    if (Array.isArray(cur)) cur.splice(0, cur.length, ...val);
    else { Object.keys(cur).forEach(x => delete cur[x]); Object.assign(cur, val); }
  }
}

/* Once per REV: records the save shares with the sample data (same id) take any field the sample
   has and the save lacks — a new relationship, a new flag — without touching what the user changed. */
function migrate(saved) {
  const fill = (to, from) => { for (const k of Object.keys(from)) if (!(k in to)) to[k] = structuredClone(from[k]); };
  for (const k of KEYS) {
    const seed = D[k], was = saved.d[k];
    if (!was) continue;
    if (Array.isArray(seed) && Array.isArray(was)) {
      const byId = new Map(seed.filter(x => x && typeof x === 'object' && x.id).map(x => [x.id, x]));
      was.forEach(x => { if (x && typeof x === 'object' && byId.has(x.id)) fill(x, byId.get(x.id)); });
    } else if (!Array.isArray(seed) && typeof was === 'object') fill(was, seed);
  }
  for (const [k, id, f, wrong, right] of FIXES) { const x = saved.d[k]?.find?.(r => r.id === id); if (x?.[f] === wrong) x[f] = right; }
  saved.rev = REV;
}

export function hydrate() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY), revive);
    if (saved?.v === VERSION && saved.d) { if (saved.rev !== REV) migrate(saved); apply(saved); return true; }
  } catch { /* storage blocked or unreadable: start from the sample parish */ }
  return false;
}

const snapshot = () => ({ v: VERSION, rev: REV, at: new Date().toISOString(), d: Object.fromEntries(KEYS.map(k => [k, D[k]])) });

export let saveFailed = false;
let frozen = false;   // set just before a reload that must not write the old parish back (reset, restore)
export function persist() {
  if (frozen) return true;
  try { localStorage.setItem(KEY, JSON.stringify(snapshot())); saveFailed = false; }
  catch { saveFailed = true; }                        // private mode or quota: the session still works in memory
  return !saveFailed;
}

export function savedAt() {
  try { return JSON.parse(localStorage.getItem(KEY))?.at || null; } catch { return null; }
}

/** A backup file is the same snapshot, so it can be read back with restoreBackup. */
export const backupJSON = () => JSON.stringify(snapshot(), null, 1);

export function restoreBackup(text) {
  const saved = JSON.parse(text, revive);
  if (saved?.v !== VERSION || !saved.d || typeof saved.d !== 'object' || !Array.isArray(saved.d.PEOPLE)) throw new Error('not a ParishLife backup');
  frozen = true;
  localStorage.setItem(KEY, JSON.stringify(saved));
}

export function resetData() {
  frozen = true;
  try { localStorage.removeItem(KEY); } catch { /* nothing saved */ }
}

export const savedSize = () => { try { return (localStorage.getItem(KEY) || '').length; } catch { return 0; } };
