/* Purpose: the frontend's one client for ParishLife.Api (.NET): same-origin JSON requests that carry the
   anti-forgery token, readable errors from the API's ProblemDetails, and the signed-in account's session
   (account, parishes, role in each parish), and the bot-check token when the API asks for one.
   Main functions: api, parishAPI, loadSession, selectParish, signIn, completeTwoFactor, signOut, register,
   requestPasswordReset, confirmPasswordReset, closeAccount, forgetAccountStorage, newOperationId.

   The API's cookies are __Host-, Secure and SameSite=Strict and it has no CORS, so these requests only work
   when the page and /api share one HTTPS origin (the Vite proxy in development; one host in production).
   Every unsafe request carries X-CSRF-TOKEN. The token belongs to whoever is signed in, so it is fetched
   again after signing in or out, and once more when the API answers csrf_invalid. */
import { t } from '../../lib/i18n.js';

export const session = { user: null, parishes: [], parishId: null, accountUser: null };

/* What a person sees when a request fails: what happened and what to do next, in their language, never
   an internal detail. An unexpected server failure carries the API's trace id as a reference to quote. */
export const connectionMessage = () =>
  t(
    'ParishLife cannot be reached. Check your internet connection and try again; what you typed is still here.',
    'تعذّر الوصول إلى ParishLife. تحقّق من اتصالك بالإنترنت وحاول مجدداً؛ ما كتبته ما زال هنا.'
  );
/* A route this frontend still calls but the .NET API does not have yet answers 404 or 405 with no body. */
export const notConnected = "This part of ParishLife isn't connected to the new backend yet, so nothing was saved.";
let csrf = '';

const readable = (status, problem) => {
  const errors = problem?.errors && Object.values(problem.errors).flat().filter(Boolean);
  if (errors?.length) return errors.join(' ');
  if (status >= 500 && status !== 503) {
    const reference = problem?.traceId ? ' ' + t('Reference: ', 'المرجع: ') + problem.traceId : '';
    return (
      t(
        'ParishLife could not finish this. Check whether it was saved before trying again; if it keeps happening, tell your parish office.',
        'تعذّر على ParishLife إتمام ذلك. تحقّق ممّا إذا كان قد حُفظ قبل المحاولة مجدداً، وإن تكرّر ذلك فأخبر مكتب الرعية.'
      ) + reference
    );
  }
  if (problem?.detail) return problem.detail;
  if (status === 401) return t('Sign in again to continue.', 'ادخل من جديد للمتابعة.');
  if (status === 403) return t('This account is not allowed to do that here.', 'لا يُسمح لهذا الحساب بذلك هنا.');
  if ((status === 404 || status === 405) && !problem) return notConnected;
  if (status === 404) return t('That record no longer exists.', 'لم يعد هذا السجل موجوداً.');
  if (status === 409 || status === 412)
    return t(
      'Someone else changed this first. Reload and try again.',
      'غيّر شخص آخر هذا أولاً. أعد التحميل وحاول مجدداً.'
    );
  if (status === 429)
    return t('Too many attempts. Wait a minute and try again.', 'محاولات كثيرة. انتظر دقيقة وحاول مجدداً.');
  if (status >= 502) return connectionMessage();
  return problem?.title && !/^[a-z_]+$/.test(problem.title)
    ? problem.title
    : t('That did not work. Try again in a moment.', 'لم ينجح ذلك. حاول مجدداً بعد قليل.');
};

/* The shell shows a banner while the API cannot be reached (portal/shell/Portal.jsx). */
let unreachable = false;
const reached = ok => {
  if (unreachable === !ok) return;
  unreachable = !ok;
  // a page signal only: the module checks run without a window
  if (typeof window !== 'undefined') document.dispatchEvent(new CustomEvent('parish-connection', { detail: ok }));
};

/* A request that gets no answer within this time (a dead mobile connection) ends with a message instead of a button that
   stays busy (QA bug 6). Only the wait for the answer is timed, never the reading of a large one. A write that timed out may
   still have been saved, and a second press sends a new operation id, so its message says to reload and check first (audit N2). */
const ANSWER_TIMEOUT_MS = 30000;

async function send(path, method, body, extra = {}) {
  if (method !== 'GET' && !csrf) csrf = (await send('auth/csrf', 'GET')).token;
  let response;
  const waiting = new AbortController();
  const timer = setTimeout(() => waiting.abort(), ANSWER_TIMEOUT_MS);
  try {
    response = await fetch('/api/' + path, {
      method,
      signal: waiting.signal,
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
    reached(false);
    if (waiting.signal.aborted && method !== 'GET' && !path.startsWith('auth/'))
      throw new Error(
        t(
          'ParishLife did not answer in time. Your change may still have been saved: reload the page and check before trying again.',
          'لم يُجب ParishLife في الوقت المحدّد. ربما حُفظ تغييرك: أعد تحميل الصفحة وتحقّق قبل المحاولة مجدداً.'
        )
      );
    throw new Error(connectionMessage());
  } finally {
    clearTimeout(timer);
  }
  reached(true);
  const json = (response.headers.get('Content-Type') || '').toLowerCase().includes('json');
  const data = json ? await response.json().catch(() => null) : null;
  if (response.ok) return data;
  const error = new Error(
    response.status === 401 && path === 'auth/login'
      ? t(
          'That email or username and password do not match, or the account is not verified yet.',
          'البريد أو اسم المستخدم وكلمة المرور غير متطابقة، أو أنّ الحساب لم يُتحقَّق منه بعد.'
        )
      : response.status === 401 && path === 'auth/login/mfa'
        ? t(
            'That code did not work. Enter the code your authenticator shows now.',
            'لم ينجح هذا الرمز. أدخل الرمز الذي يعرضه تطبيق المصادقة الآن.'
          )
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
