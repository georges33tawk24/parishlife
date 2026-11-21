/* Purpose: the frontend's one client for ParishLife.Api (.NET): same-origin JSON requests that carry the
   anti-forgery token, readable errors from the API's ProblemDetails, and the signed-in account's session
   (account, parishes, role in each parish), and the bot-check token when the API asks for one.
   Main functions: api, parishAPI, loadSession, selectParish, signIn, completeTwoFactor, signOut, register,
   requestPasswordReset, confirmPasswordReset, closeAccount, forgetAccountStorage, newOperationId.

   The API's cookies are __Host-, Secure and SameSite=Strict and it has no CORS, so these requests only work
   when the page and /api share one HTTPS origin (the Vite proxy in development; one host in production).
   Every unsafe request carries X-CSRF-TOKEN. The token belongs to whoever is signed in, so it is fetched
   again after signing in or out, and once more when the API answers csrf_invalid. */
export const session = { user: null, parishes: [], parishId: null, accountUser: null };

const connectionError =
  'ParishLife cannot reach its API. Start ParishLife.Api and the frontend dev server (frontend/README.md), then try again.';
/* A route this frontend still calls but the .NET API does not have yet answers 404 or 405 with no body. */
export const notConnected = "This part of ParishLife isn't connected to the new backend yet, so nothing was saved.";
let csrf = '';

const readable = (status, problem) => {
  const errors = problem?.errors && Object.values(problem.errors).flat().filter(Boolean);
  if (errors?.length) return errors.join(' ');
  if (problem?.detail) return problem.detail;
  if (status === 401) return 'Sign in again to continue.';
  if (status === 403) return 'This account is not allowed to do that here.';
  if ((status === 404 || status === 405) && !problem) return notConnected;
  if (status === 404) return 'That record no longer exists.';
  if (status === 409 || status === 412) return 'Someone else changed this first. Reload and try again.';
  if (status === 429) return 'Too many attempts. Wait a minute and try again.';
  if (status >= 502) return connectionError;
  return problem?.title && !/^[a-z_]+$/.test(problem.title) ? problem.title : 'The request failed.';
};

async function send(path, method, body, extra = {}) {
  if (method !== 'GET' && !csrf) csrf = (await send('auth/csrf', 'GET')).token;
  let response;
  try {
    response = await fetch('/api/' + path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(method === 'GET' ? {} : { 'X-CSRF-TOKEN': csrf }),
        ...extra
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  } catch {
    throw new Error(connectionError);
  }
  const json = (response.headers.get('Content-Type') || '').toLowerCase().includes('json');
  const data = json ? await response.json().catch(() => null) : null;
  if (response.ok) return data;
  const error = new Error(
    response.status === 401 && path === 'auth/login'
      ? 'That email or username and password do not match, or the account is not verified yet.'
      : response.status === 401 && path === 'auth/login/mfa'
        ? 'That code did not work. Enter the code your authenticator shows now.'
        : readable(response.status, data)
  );
  error.status = response.status;
  error.code = data?.title;
  if (response.status === 401 && !path.startsWith('auth/login')) session.user = null;
  throw error;
}

export async function api(path, method = 'GET', body, headers) {
  try {
    return await send(path, method, body, headers);
  } catch (error) {
    if (error.code !== 'csrf_invalid') throw error;
    csrf = '';
    return send(path, method, body, headers);
  }
}

export const parishAPI = (path, method, body) => {
  if (!session.parishId) throw new Error('No parish is assigned to this account.');
  return api(`parishes/${encodeURIComponent(session.parishId)}/${path}`, method, body);
};

/* Creates carry a fresh operation id, which the API uses to make a retried request safe. */
export const newOperationId = () => crypto.randomUUID();

/* Every page of a paged list ({ items, continuationToken }), up to a limit. */
export async function allPages(path, limit = 5000) {
  const items = [];
  let token = '';
  do {
    const page = await api(
      path + (path.includes('?') ? '&' : '?') + (token ? `continuation=${encodeURIComponent(token)}` : '')
    );
    items.push(...(page?.items || []));
    token = page?.continuationToken || '';
  } while (token && items.length < limit);
  return items;
}

/* Sign-in: a password alone, or a password and then an authenticator code. */
/* When the bot check is on (GET /api/auth/capabilities), sign-in and registration carry its token. */
const checked = turnstile => (turnstile ? { 'X-Turnstile-Token': turnstile } : {});
export async function signIn(identifier, password, turnstile) {
  const id = String(identifier || '').trim();
  const result = await api(
    'auth/login',
    'POST',
    id.includes('@') ? { email: id, password } : { username: id, password },
    checked(turnstile)
  );
  csrf = '';
  return result?.requiresTwoFactor ? { twoFactor: result.challenge } : { account: result };
}
export async function completeTwoFactor(challenge, code) {
  const account = await api('auth/login/mfa', 'POST', {
    accountId: challenge.accountId,
    challenge: challenge.challenge,
    code: String(code || '').replace(/\s+/g, '')
  });
  csrf = '';
  return account;
}
export async function signOut() {
  try {
    await api('auth/logout', 'POST');
  } finally {
    csrf = '';
    Object.assign(session, { user: null, parishes: [], parishId: null, accountUser: null });
    forgetAccountStorage();
  }
}
/* Browser storage that names an account or a parish's finance work is removed at sign-out, so a shared computer
   does not show who used it (language, text size and the sidebar choice stay). */
export function forgetAccountStorage() {
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith('pl-anniversaries-') || key.startsWith('pl-finance-session:')) localStorage.removeItem(key);
    sessionStorage.removeItem('pl-admin-opened');
  } catch {}
}
/* ageConfirmed: the person ticked "I am 13 or older" (accounts are for 13 and over); the API refuses sign-up without it. */
export const register = ({ email, password, displayName, ageConfirmed, turnstile }) =>
  api(
    'auth/register',
    'POST',
    { operationId: newOperationId(), email, password, displayName, ageConfirmed: !!ageConfirmed },
    checked(turnstile)
  );
/* Forgotten password: a code goes to the account's confirmed email (the answer is the same for any address); the code,
   a new password and, for an account with an authenticator, its current code set the password. Nobody is signed in. */
export const requestPasswordReset = (email, turnstile) =>
  api('auth/password-reset', 'POST', { email }, checked(turnstile));
export const confirmPasswordReset = ({ email, code, newPassword, currentCode }) =>
  api('auth/password-reset/confirm', 'POST', { email, code, newPassword, currentCode: currentCode || null });
/* Closes the signed-in account (fresh proof and the word CLOSE); the API ends every session. */
export async function closeAccount({ currentPassword, currentCode, confirmation }) {
  const result = await api('auth/account/close', 'POST', {
    operationId: newOperationId(),
    currentPassword: currentPassword || null,
    currentCode: currentCode || null,
    confirmation
  });
  csrf = '';
  Object.assign(session, { user: null, parishes: [], parishId: null, accountUser: null });
  forgetAccountStorage();
  return result;
}

/* What each capacity means in the portal. An office grant (ParishGrant) carries capabilities: records
   work makes the secretary's view, finance alone the treasurer's. */
const officeRole = (capabilities = []) =>
  capabilities.some(c => ['people.write', 'requests.manage', 'sacraments.record'].includes(c))
    ? 'secretary'
    : capabilities.some(c => c.startsWith('finance.'))
      ? 'treasurer'
      : null;
const PARISH_ROLES = ['priest', 'secretary', 'treasurer', 'leader'];

/* The account, the parishes it follows or belongs to, and its capacities (GET /api/me/capacities):
   Priest, ParishGrant and MinistryLeader in a parish; Bishop, ArchdioceseAdmin and PlatformOperator
   across parishes. */
export async function loadSession() {
  const account = await api('auth/me'); // signed out: 401, and nothing else is asked
  const [mine, capacities] = await Promise.all([
    api('me/parishes').catch(() => []),
    api('me/capacities').catch(() => [])
  ]);
  const parishes = new Map(
    (mine || []).map(p => [
      p.parishId,
      {
        id: p.parishId,
        name: p.name,
        nameAr: p.name,
        primary: !!p.primary,
        relationship: p.relationship,
        roles: [],
        capabilities: []
      }
    ])
  );
  const across = new Set();
  for (const c of capacities || []) {
    if (c.kind === 'PlatformOperator') across.add('super_admin');
    if (c.kind === 'ArchdioceseAdmin') across.add('diocesan_admin');
    if (c.kind === 'Bishop') across.add('bishop');
    if (!c.parishId) continue;
    const p = parishes.get(c.parishId) || {
      id: c.parishId,
      name: c.scopeName,
      nameAr: c.scopeName,
      roles: [],
      capabilities: []
    };
    const role =
      c.kind === 'Priest'
        ? 'priest'
        : c.kind === 'MinistryLeader'
          ? 'leader'
          : c.kind === 'ParishGrant'
            ? officeRole(c.capabilities)
            : null;
    p.capabilities = [...new Set([...p.capabilities, ...(c.capabilities || [])])];
    if (role) p.roles = [...new Set([...p.roles, role])];
    parishes.set(c.parishId, p);
  }
  session.parishes = [...parishes.values()].map(p => ({
    ...p,
    effectiveRole: PARISH_ROLES.find(r => p.roles.includes(r)) || 'member',
    canViewFinance: p.roles.includes('priest') || p.capabilities.includes('finance.read'),
    personId: null
  }));
  session.parishes.sort((a, b) => Number(!!b.primary) - Number(!!a.primary));
  session.accountUser = {
    id: account.id,
    name: account.displayName,
    email: account.email,
    username: account.username,
    verified: !!account.accountVerified,
    role: ['super_admin', 'diocesan_admin', 'bishop'].find(r => across.has(r)) || 'member',
    person_id: null
  };
  if (!session.parishes.some(p => p.id === session.parishId)) session.parishId = session.parishes[0]?.id || null;
  selectParish(session.parishId);
  return session;
}
export function selectParish(id) {
  session.parishId = id;
  const base = session.accountUser || session.user,
    p = session.parishes.find(p => p.id === id);
  if (base)
    session.user = {
      ...base,
      platformRole: base.role,
      role: p && p.effectiveRole !== 'member' ? p.effectiveRole : base.role,
      canViewFinance: !!p?.canViewFinance,
      roles: p?.roles || [],
      person_id: p ? p.personId : base.person_id
    };
}
