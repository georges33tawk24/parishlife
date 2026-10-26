/* Same-origin authenticated API. Roles and parish access are server-owned. */
export const session = { user: null, parishes: [], parishId: null, csrf: '', revision: 0 };
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
  if (!session.parishes.some(p => p.id === session.parishId)) session.parishId = session.parishes[0]?.id || null;
  session.accountUser={...data.user,role:data.platformRole||data.user.role};
  selectParish(session.parishId);
  return session;
}
export function selectParish(id) {
  session.parishId=id;
  const base=session.accountUser||session.user,p=session.parishes.find(p=>p.id===id);
  if(base)session.user={...base,platformRole:base.role,role:p?.effectiveRole||base.role,canViewFinance:!!p?.canViewFinance,roles:p?.roles||[],person_id:p?p.personId:base.person_id};
}
export const parishAPI = (path, method, body) => {
  if (!session.parishId) throw new Error('No parish is assigned to this account.');
  return api(`parishes/${encodeURIComponent(session.parishId)}/${path}`, method, body);
};
