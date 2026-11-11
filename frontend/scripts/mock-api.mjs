/* Purpose: a small in-memory stand-in for ParishLife.Api, for the module checks in scripts/checks/.
   Main functions: mockApi (installs fetch and a document stub, answers auth/csrf, sends every other
   request to your handler and records the writes), json (a JSON response), signedIn (a test account
   in parish P with the given roles and capabilities, as loadSession would set it).

   Use: const { sent, events } = mockApi((method, path, body) => ... return json(200, {...}) or nothing);
   a handler that returns nothing gives 404 with no body, which the client reports as not connected.
   Import this before anything from src/. */
export const json = (status, body) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' }
  });

export function mockApi(handler) {
  const sent = [],
    events = [];
  let tokens = 0;
  globalThis.document = { dispatchEvent: e => events.push(e) };
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET',
      path = String(url).replace(/^\/api\//, ''),
      body = options.body ? JSON.parse(options.body) : undefined;
    if (path === 'auth/csrf') return json(200, { token: `t${++tokens}`, header: 'X-CSRF-TOKEN' });
    if (method !== 'GET') sent.push([method, path, body]);
    return (await handler(method, path, body, options)) || json(404);
  };
  return { sent, events };
}

export function signedIn(session, { roles = ['priest'], capabilities = [] } = {}) {
  const role = roles[0] || 'member';
  Object.assign(session, {
    parishes: [{ id: 'P', name: 'Saint Test', nameAr: 'Saint Test', roles, capabilities, effectiveRole: role }],
    parishId: 'P',
    user: { id: 'u', name: 'Test Account', role, roles, person_id: null }
  });
}
