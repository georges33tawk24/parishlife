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
  return session;
}
export const parishAPI = (path, method, body) => {
  if (!session.parishId) throw new Error('No parish is assigned to this account.');
  return api(`parishes/${encodeURIComponent(session.parishId)}/${path}`, method, body);
};
