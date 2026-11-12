/* Purpose: people's names for the account ids that API records carry (who sent, recorded, approved or
   requested something), through one shared lookup.
   Main functions: loadNames (fetch the names not yet known), nameOf (a known name, or '').

   Route: GET /api/parishes/{parishId}/account-names?ids=a,b (at most 100 ids), which returns
   [{ accountId, displayName }] for the accounts the signed-in account may see; the others are left out.
   See docs/frontend-modules/CONVENTIONS.md. A failure (the route not deployed yet, a refusal) leaves the
   names empty and never fails a module's load. */
import { api } from './api.js';

const known = new Map(); // `${parishId}:${accountId}` → display name ('' when not revealed)
const key = (parishId, accountId) => `${parishId}:${accountId}`;

export async function loadNames(parishId, ids) {
  const missing = [...new Set((ids || []).filter(Boolean))].filter(id => !known.has(key(parishId, id)));
  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100);
    try {
      const rows = await api(
        `parishes/${encodeURIComponent(parishId)}/account-names?ids=${chunk.map(encodeURIComponent).join(',')}`
      );
      for (const row of rows || []) known.set(key(parishId, row.accountId), row.displayName || '');
    } catch {
      /* names are a courtesy: a screen without them still works */
    }
    for (const id of chunk) if (!known.has(key(parishId, id))) known.set(key(parishId, id), '');
  }
}

export const nameOf = (parishId, accountId) => (accountId ? known.get(key(parishId, accountId)) || '' : '');

/* For checks: forget what was loaded. */
export const forgetNames = () => known.clear();
