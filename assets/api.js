/* Same-origin authenticated API. Roles and parish access are server-owned. */
export const session = { user: null, parishes: [], parishId: null, csrf: '', revision: 0, authority: null };
const STAFF = ['priest', 'parishadmin', 'secretary', 'treasurer', 'leader'];
/* The role of the workspace that is open: the account's role in the chosen parish, or its
   administrative role when no parish is open. Roles belong to places, not to the account. */
export function currentRole() {
  const p = session.parishes.find(x => x.id === session.parishId);
  if (p) return p.roleCode || session.user?.role;
  const a = session.authority || {};
  if (a.superadmin) return 'superadmin';
  if ((a.dioceses || []).some(d => d.role === 'bishop')) return 'bishop';
  if ((a.dioceses || []).some(d => d.role === 'diocesanadmin')) return 'diocesanadmin';
  return 'user';
}
/* Permissions in the open parish (the server checks them again on every change). */
export const currentPerms = () => new Set(session.parishes.find(x => x.id === session.parishId)?.perms || []);
export const can = perm => currentPerms().has(perm);
export async function api(path, method = 'GET', body) {
  const connectionError = 'ParishLife is not connected to its application server. Start server.py, then open http://127.0.0.1:4399/ and try again.';
  let response;
  try {
    response = await fetch('/api/' + path, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  } catch { throw new Error(connectionError); }
  if (!(response.headers.get('Content-Type') || '').toLowerCase().includes('application/json'))
    throw new Error(connectionError);
  let result;
  try { result = await response.json(); }
  catch { throw new Error('The ParishLife server returned an invalid response. Restart server.py and try again.'); }
  if (!response.ok) {
    const error = new Error(result.error || 'The request failed.'); error.status = response.status;
    if (response.status === 401 && path !== 'login') session.user = null;
    throw error;
  }
  return result;
}
export async function loadSession() {
  const data = await api('session'); Object.assign(session, data);
  if (!session.parishes.some(p => p.id === session.parishId)) {
    /* open the parish where the account works, else its primary parish, else the first it belongs to */
    const staff = session.parishes.find(p => STAFF.includes(p.roleCode));
    const primary = session.parishes.find(p => p.primary);
    session.parishId = (staff || primary || session.parishes[0])?.id || null;
  }
  return session;
}
export const parishAPI = (path, method, body) => {
  if (!session.parishId) throw new Error('No parish is assigned to this account.');
  return api(`parishes/${encodeURIComponent(session.parishId)}/${path}`, method, body);
};
