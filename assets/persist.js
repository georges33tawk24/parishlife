/* Shared objects remain the view model; SQLite is the authoritative store. */
import * as D from './data.js';
import { session, parishAPI } from './api.js';
import { loadMember } from './member-data.js';
const KEYS = Object.keys(D).filter(k => k !== 'TODAY' && D[k] && typeof D[k] === 'object' && !(D[k] instanceof Date));
const snapshot = () => JSON.parse(JSON.stringify(Object.fromEntries(KEYS.map(k => [k, D[k]]))));
let baseline = {}, running = null, again = false, lastSaved = null, recovery = null;
export let saveFailed = false;
function applyKey(k, value) {
  if (Array.isArray(D[k])) {
    const existing = new Map(D[k].filter(x => x && typeof x === 'object' && x.id != null).map(x => [x.id, x]));
    D[k].splice(0, D[k].length, ...value.map(x => {
      const old = x && typeof x === 'object' ? existing.get(x.id) : null;
      if (!old) return x;
      Object.keys(old).forEach(field => delete old[field]); Object.assign(old, x); return old;
    }));
  } else { Object.keys(D[k]).forEach(x => delete D[k][x]); Object.assign(D[k], value); }
}
export function applyData(data) {
  for (const k of KEYS) {
    const value = data[k] ?? (Array.isArray(D[k]) ? [] : {});
    applyKey(k, value);
  }
  if (typeof D.RATE.setOn === 'string') D.RATE.setOn = new Date(D.RATE.setOn);
}
export async function hydrate() {
  if (session.user?.role === 'member') {
    const data = await loadMember();
    applyData({ PARISH: data.parish, PEOPLE: [data.person] });
    baseline = snapshot(); saveFailed = false; return true;
  }
  if (session.user?.role === 'bishop') {
    applyData({ PARISHES: session.parishes, PARISH: { name: 'Archdiocese oversight', nameAr: 'إشراف الأبرشية', town: 'Read-only', townAr: 'للقراءة فقط', rite: '', riteAr: '' } });
    baseline = snapshot(); saveFailed = false; return true;
  }
  const data = await parishAPI('state');
  applyData(data.d); session.revision = data.revision;
  baseline = snapshot(); saveFailed = false;
  return true;
}
export function persist() {
  if (session.user?.role === 'bishop' || session.user?.role === 'member') return Promise.resolve(true);
  if (!session.user || !session.parishId) return Promise.resolve(false);
  again = true;
  if (running) return running;
  running = Promise.resolve().then(async () => {
    try {
      while (again) {
        again = false;
        const current = snapshot();
        const changes = Object.fromEntries(KEYS.filter(k => JSON.stringify(current[k]) !== JSON.stringify(baseline[k])).map(k => [k, current[k]]));
        if (!Object.keys(changes).length) continue;
        const data = await parishAPI('state', 'PUT', { revision: session.revision, changes });
        session.revision = data.revision;
        const changedDuringSave = JSON.stringify(snapshot()) !== JSON.stringify(current);
        baseline = JSON.parse(JSON.stringify(data.d));
        if (!changedDuringSave) {
          for (const k of KEYS) if (JSON.stringify(current[k]) !== JSON.stringify(data.d[k])) applyKey(k, data.d[k]);
        }
        else again = true;
        lastSaved = new Date().toISOString();
      }
      saveFailed = false; return true;
    } catch (error) {
      saveFailed = true; again = false; recovery = snapshot();
      try { await hydrate(); } catch { applyData(baseline); }
      saveFailed = true;
      document.dispatchEvent(new CustomEvent('parish-save-error', { detail: error.message }));
      return false;
    } finally { running = null; }
  });
  return running;
}
export const recoveryJSON = () => JSON.stringify({ v: 2, parish: session.parishId, d: recovery }, null, 2);
export const savedAt = () => lastSaved;
export const savedSize = () => JSON.stringify(baseline).length;
export const backupJSON = () => JSON.stringify({ v: 2, parish: session.parishId, at: new Date().toISOString(), d: snapshot() }, null, 2);
export function restoreBackup() { throw new Error('Restore requires an administrator-reviewed database migration. Browser backups cannot replace approved records.'); }
export function resetData() { throw new Error('Server records cannot be reset from the browser.'); }
export async function workflow(action, id, extra = {}) {
  if (!await persist()) throw new Error('Resolve the pending save before continuing.');
  await parishAPI('workflow', 'POST', { action, id, revision: session.revision, ...extra });
  await hydrate();
}
