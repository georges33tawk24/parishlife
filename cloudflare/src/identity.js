/* Accounts: registration, sign-in methods, verification, two-step, providers. Ported from server.py.
   An account belongs to a person, not to a parish; parishes are joined or followed afterwards.
   It signs in with an email address or phone number it registered, or its username, and a password,
   or with a linked Google, Apple or Microsoft identity once that provider is configured. A code is
   only reported as sent when a delivery service accepted it; nothing is ever marked verified that
   was not checked.

   `ctx` is { env, dev }: the Worker's environment, and whether codes may be printed to the log
   instead of sent (PARISHLIFE_DEV_OUTBOX=1 on a local `wrangler dev` only). */
import { createHmac, randomInt } from 'node:crypto';
import { Buffer } from 'node:buffer';
import {
  Problem, need, get, isStr, len, str, strip, or, truthy, NOW, localToday, time, tokenHex, tokenUrlsafe, sha256hex,
  compareDigest, passwordHash, passwordMatches, quote
} from './py.js';
import { Tx, Conflict } from './db.js';
import { audit } from './app.js';
import { loginAllowed, clean, contactKind } from './authority.js';
import { loginName } from './accounts.js';
import { ROUNDS } from './member.js';

const EMAIL_ADDRESS = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_KEY = /^\+[0-9]{8,15}$/;
export const SIGNUPS_PER_HOUR = 30;
export const MINIMUM_AGE = 13;
const CONTACT_KINDS = ['email', 'phone'];
const CHANNEL = { email: 'email', phone: 'sms' };
const KIND_OF = { email: 'email', sms: 'phone' };
const DELIVERY_ENV = { email: 'PARISHLIFE_EMAIL_WEBHOOK', sms: 'PARISHLIFE_SMS_WEBHOOK' };
const CODE_TTL = 900;
const LOGIN_ATTEMPTS = 10, LOGIN_WINDOW = 900;
const sha = text => sha256hex(String(text));
const squash = value => str(or(value, '')).replace(/\s/g, '');

/* datetime.fromtimestamp(seconds, timezone.utc).isoformat() */
function isoFromEpoch(seconds) {
  const micros = Math.round(seconds * 1e6), fraction = micros % 1000000;
  return new Date(Math.floor(micros / 1000)).toISOString().slice(0, 19) + (fraction ? '.' + String(fraction).padStart(6, '0') : '') + '+00:00';
}
/* NOW() an hour ago, for comparing with audit.at */
function hourAgo() {
  const micros = (Date.now() - 3600 * 1000) * 1000, fraction = micros % 1000000;
  return new Date(Math.floor(micros / 1000)).toISOString().slice(0, 19) + (fraction ? '.' + String(fraction).padStart(6, '0') : '') + '+00:00';
}

/* An email address in lower case, or a phone number in international form. */
function contactValue(kind, raw) {
  const text = strip(str(or(raw, '')));
  if (kind === 'email') {
    const value = text.toLowerCase();
    need(len(value) <= 120 && EMAIL_ADDRESS.test(value), 'Enter a valid email address.');
    return value;
  }
  const value = loginName(text);
  need(len(text) <= 40 && PHONE_KEY.test(value), 'Enter a valid phone number.');
  return value;
}

/* The account already using this email address or phone number, as a contact or as its username. */
async function contactOwner(c, kind, value) {
  const [contact, user] = await c.reads([
    ['SELECT user_id FROM user_contacts WHERE kind=? AND value=?', [kind, value]],
    ['SELECT id FROM users WHERE username=?', [value]]
  ]);
  return contact[0]?.user_id ?? user[0]?.id ?? null;
}

async function verifiedContact(c, userId, kind) {
  const row = await c.first('SELECT value FROM user_contacts WHERE user_id=? AND kind=? AND verified_at IS NOT NULL ORDER BY verified_at', userId, kind);
  return row ? row.value : null;
}

function masked(kind, value) {
  if (kind === 'email') {
    const at = value.indexOf('@');
    return at < 0 ? value.slice(0, 1) + '•••@' : value.slice(0, 1) + '•••@' + value.slice(at + 1);
  }
  return value.slice(0, 4) + ' ••• ' + value.slice(-3);
}

/* How codes reach people from this deployment: 'service' (a configured delivery webhook), 'console'
   (local development only: written to the log, never sent) or 'none'. */
export function deliveryMode(ctx, channel) {
  const url = str(or(ctx.env[DELIVERY_ENV[channel]], ''));
  if (url.startsWith('https://') || url.startsWith('http://')) return 'service';
  return ctx.dev ? 'console' : 'none';
}

const codeHash = (cid, code) => sha(`${cid}:${code}`);

/* A six-digit code for `target`, valid 15 minutes, queued in `outbox` to be sent after the commit.
   Without a delivery service nothing is stored or sent, and the caller is told so. */
async function issueCode(c, ctx, userId, purpose, kind, target, outbox) {
  const channel = CHANNEL[kind], mode = deliveryMode(ctx, channel);
  if (mode === 'none') return 'not-configured';
  const now = time();
  const [last, daily] = await c.reads([
    ['SELECT MAX(created) AS m FROM verification_codes WHERE target=? AND purpose=?', [target, purpose]],
    ['SELECT COUNT(*) AS n FROM verification_codes WHERE target=? AND created>?', [target, now - 86400]]
  ]);
  need(last[0].m === null || now - last[0].m >= 60, 'A code was sent a moment ago. Wait a minute before asking for another.', 429);
  need(daily[0].n < 10, 'Too many codes were asked for today. Try again tomorrow.', 429);
  c.run("UPDATE verification_codes SET used_at='replaced' WHERE target=? AND purpose=? AND used_at IS NULL", target, purpose);
  const cid = tokenHex(12), code = String(randomInt(0, 1000000)).padStart(6, '0');
  const status = mode === 'service' ? 'sending' : 'console';
  c.run('INSERT INTO verification_codes VALUES(?,?,?,?,?,?,?,?,?,?,?)', cid, userId, purpose, channel, target, codeHash(cid, code), now, now + CODE_TTL, 0, status, null);
  outbox.push({ id: cid, channel, target, code, mode, status });
  return status;
}

/* Written after the request's own commit, in a transaction of its own. */
async function recordDelivery(db, id, status) {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const c = new Tx(db);
    try {
      await c.reads([]);
      c.run('UPDATE verification_codes SET delivery=? WHERE id=?', status, id);
      await c.commit();
      return;
    } catch (error) {
      if (!(error instanceof Conflict)) throw error;
    }
  }
}

/* After the commit: hand each code to the delivery service and record whether it accepted it. */
export async function sendOutbox(ctx, outbox) {
  for (const item of outbox) {
    const text = `Your ParishLife code is ${item.code}. It expires in 15 minutes. If you did not ask for it, ignore this message.\n` +
      `رمز ParishLife الخاص بك هو ${item.code}. تنتهي صلاحيته بعد ١٥ دقيقة.`;
    if (item.mode === 'console') {
      console.log(`[dev outbox, NOT SENT] ${item.channel} to ${item.target}: ParishLife code ${item.code}`);
      continue;
    }
    const headers = { 'Content-Type': 'application/json' };
    if (ctx.env.PARISHLIFE_DELIVERY_TOKEN) headers.Authorization = 'Bearer ' + ctx.env.PARISHLIFE_DELIVERY_TOKEN;
    try {
      const response = await fetch(ctx.env[DELIVERY_ENV[item.channel]], {
        method: 'POST', headers, signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ channel: item.channel, to: item.target, subject: 'Your ParishLife code', text })
      });
      item.status = response.ok ? 'sent' : 'failed';
    } catch {
      item.status = 'failed';
    }
    await recordDelivery(ctx.env.DB, item.id, item.status);
  }
  return outbox.map(item => ({ channel: item.channel, to: item.target, delivery: item.status }));
}

/* What happened to each code once the delivery service answered. */
export function settle(delivery, outbox) {
  const status = new Map(outbox.map(item => [item.target, item.status]));
  return delivery.map(item => ({ ...item, delivery: status.get(item.value) ?? item.delivery }));
}

/* Uses up the latest code sent to `target`; a wrong one counts against it (five tries). */
async function consumeCode(c, userId, purpose, target, code) {
  const row = await c.first('SELECT * FROM verification_codes WHERE target=? AND purpose=? AND user_id=? AND used_at IS NULL ORDER BY created DESC LIMIT 1', target, purpose, userId);
  need(row !== null && row.expires > time(), 'This code has expired or was replaced. Ask for a new one.');
  need(row.attempts < 5, 'Too many wrong codes. Ask for a new one.', 429);
  if (!compareDigest(row.code_hash, codeHash(row.id, squash(code)))) {
    c.run('UPDATE verification_codes SET attempts=attempts+1 WHERE id=?', row.id);
    await c.commit();
    throw new Problem(400, 'That code is not right. Check it and try again.');
  }
  c.run('UPDATE verification_codes SET used_at=? WHERE id=?', NOW(), row.id);
}

/* ---- authenticator apps (RFC 6238: HMAC-SHA1, 30-second steps, six digits) ---- */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(text) {
  let bits = 0, value = 0;
  const out = [];
  for (const ch of text.replace(/=+$/, '')) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Problem(400, 'Invalid secret.');
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function totpCode(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}
/* The time step (now, or 30 seconds either side) a code belongs to, if that step has not been used yet. */
function totpStep(secret, code, lastStep) {
  code = squash(code);
  if (!/^[0-9]{6}$/.test(code)) return null;
  const now = Math.floor(time() / 30);
  for (const step of [now - 1, now, now + 1]) if (step > lastStep && compareDigest(totpCode(secret, step), code)) return step;
  return null;
}

function newRecoveryCodes(c, userId) {
  const codes = Array.from({ length: 10 }, () => `${tokenHex(3)}-${tokenHex(3)}`);
  c.run('INSERT INTO user_mfa VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,method) DO UPDATE SET recovery=excluded.recovery,enabled_at=excluded.enabled_at',
    userId, 'recovery', '', NOW(), 0, JSON.stringify(codes.map(code => sha(code.replace('-', '')))));
  return codes;
}

async function mfaRows(c, userId) {
  const rows = {};
  for (const r of await c.all('SELECT * FROM user_mfa WHERE user_id=?', userId)) rows[r.method] = r;
  return rows;
}

/* The second steps this account turned on that this deployment can still carry out, and whether any is on. */
async function loginMethods(c, ctx, userId) {
  const all = await mfaRows(c, userId);
  const turnedOn = ['totp', 'email', 'sms'].filter(m => all[m]?.enabled_at);
  const usable = [];
  for (const m of turnedOn) {
    if (m === 'totp' || (deliveryMode(ctx, m) !== 'none' && await verifiedContact(c, userId, KIND_OF[m]))) usable.push(m);
  }
  if (turnedOn.length && all.recovery?.enabled_at && JSON.parse(all.recovery.recovery).length) usable.push('recovery');
  return [usable, turnedOn.length > 0];
}
export const mfaTurnedOn = async (c, ctx, userId) => (await loginMethods(c, ctx, userId))[1];

/* Whether `code` completes the second step by `method`; a used code or time step cannot be used again. */
async function mfaCheck(c, userId, method, code) {
  const rows = await mfaRows(c, userId);
  if (method === 'totp' && rows.totp?.enabled_at) {
    const step = totpStep(rows.totp.secret, code, rows.totp.last_step);
    if (step === null) return false;
    c.run("UPDATE user_mfa SET last_step=? WHERE user_id=? AND method='totp'", step, userId);
    return true;
  }
  if (method === 'recovery' && rows.recovery) {
    const hashes = JSON.parse(rows.recovery.recovery), given = sha(str(or(code, '')).toLowerCase().replace(/[^0-9a-f]/g, ''));
    const at = hashes.indexOf(given);
    if (at < 0) return false;
    hashes.splice(at, 1);
    c.run("UPDATE user_mfa SET recovery=? WHERE user_id=? AND method='recovery'", JSON.stringify(hashes), userId);
    return true;
  }
  if (method === 'email' || method === 'sms') {
    await consumeCode(c, userId, 'login', (await verifiedContact(c, userId, KIND_OF[method])) ?? '', code);
    return true;
  }
  return false;
}

/* After the password: a short-lived ticket for the second step, instead of a session. */
export async function mfaChallenge(c, ctx, userId) {
  const [methods] = await loginMethods(c, ctx, userId);
  need(methods.length, 'Two-step verification is on for this account, but none of its methods can be used on this server ' +
    'right now. Contact your parish office or the ParishLife administrator.', 403);
  const token = tokenUrlsafe(32);
  c.run('DELETE FROM login_challenges WHERE expires<?', time());
  c.run('INSERT INTO login_challenges VALUES(?,?,?,?,?)', sha(token), userId, JSON.stringify(methods), time() + 600, 0);
  return token;
}

/* Read after the challenge's commit: a write in this transaction is not visible before it. */
export async function challengeInfo(c, token) {
  const row = await c.first('SELECT * FROM login_challenges WHERE token=? AND expires>?', sha(str(or(token, ''))), time());
  need(row !== null, 'This sign-in has expired. Sign in again.', 401);
  const methods = JSON.parse(row.methods), hints = {};
  for (const m of methods) if (KIND_OF[m]) hints[m] = masked(KIND_OF[m], (await verifiedContact(c, row.user_id, KIND_OF[m])) ?? '');
  return [row, { mfa: 'required', challenge: token, methods, hints }];
}

export async function mfaSend(c, ctx, q, outbox) {
  const [row] = await challengeInfo(c, get(q, 'challenge'));
  const method = get(q, 'method');
  need((method === 'email' || method === 'sms') && JSON.parse(row.methods).includes(method), 'Choose how to receive the code.');
  return { delivery: await issueCode(c, ctx, row.user_id, 'login', KIND_OF[method], await verifiedContact(c, row.user_id, KIND_OF[method]), outbox) };
}

/* The second step; returns the account to sign in. */
export async function mfaVerify(c, q) {
  const [row] = await challengeInfo(c, get(q, 'challenge'));
  need(row.attempts < 5, 'Too many wrong codes. Sign in again.', 429);
  const method = get(q, 'method');
  need(isStr(method) && JSON.parse(row.methods).includes(method), 'Choose a way to confirm it is you.');
  if (!(await mfaCheck(c, row.user_id, method, get(q, 'code')))) {
    c.run('UPDATE login_challenges SET attempts=attempts+1 WHERE token=?', row.token);
    await c.commit();
    throw new Problem(401, 'That code is not right. Check it and try again.');
  }
  c.run('DELETE FROM login_challenges WHERE token=?', row.token);
  const u = await c.first('SELECT * FROM users WHERE id=?', row.user_id);
  need(await loginAllowed(c, u), 'Sign in to continue.', 401);
  return u;
}

const SIGN_IN_ERRORS = { email: 'Incorrect email address or password.', phone: 'Incorrect phone number or password.' };

/* Email and Phone look in the account's registered contacts (and, for accounts made by the operator tools,
   a username that is that address or number); Username looks in usernames. Requests without a method
   (older pages) accept any of them. */
async function findAccount(c, method, identifier) {
  const key = loginName(identifier), kind = contactKind(key);
  if ((method === 'email' || method === 'phone') && method !== kind) return null;
  if (kind && method !== 'username') {
    const row = await c.first('SELECT u.* FROM user_contacts k JOIN users u ON u.id=k.user_id WHERE k.kind=? AND k.value=?', kind, key);
    if (row) return row;
  }
  return c.first('SELECT * FROM users WHERE username=?', key);
}

export async function signIn(c, q) {
  const method = get(q, 'method');
  need(method === null || ['email', 'phone', 'username'].includes(method), 'Choose how you sign in.');
  const identifier = get(q, 'identifier', get(q, 'username'));
  const key = sha(loginName(identifier)), now = time();
  const failures = await c.first('SELECT * FROM login_failures WHERE key=? AND since>?', key, now - LOGIN_WINDOW);
  need(failures === null || failures.count < LOGIN_ATTEMPTS, 'Too many attempts to sign in to this account. Wait 15 minutes, then try again.', 429);
  const u = await findAccount(c, method, identifier);
  const ok = await loginAllowed(c, u) && truthy(u.password) && passwordMatches(u.password, str(get(q, 'password', '')));
  if (!ok) {   // counted per name typed, so guessing one account's password is slowed down
    c.run('INSERT INTO login_failures VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET ' +
      'count=CASE WHEN since>? THEN count+1 ELSE 1 END, since=CASE WHEN since>? THEN since ELSE excluded.since END',
      key, now, now - LOGIN_WINDOW, now - LOGIN_WINDOW);
    await c.commit();
    throw new Problem(401, SIGN_IN_ERRORS[method] ?? 'Incorrect username or password.');
  }
  c.run('DELETE FROM login_failures WHERE key=?', key);
  return u;
}

function birthDate(value) {
  const text = str(or(value, ''));
  need(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(text), 'Enter your date of birth.');
  const [y, m, d] = text.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  need(date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d, 'Enter your date of birth.');
  const today = localToday();
  need(text >= '1900-01-01' && text <= today, 'Enter your date of birth.');
  const [ty, tm, td] = today.split('-').map(Number);
  const age = ty - y - ((tm < m || (tm === m && td < d)) ? 1 : 0);
  need(age >= MINIMUM_AGE, `You need to be ${MINIMUM_AGE} or older to open an account. A parent or guardian can make requests for you.`);
  return text;
}

function newPassword(q) {
  const password = get(q, 'password');
  need(isStr(password) && len(password) >= 8 && len(password) <= 200, 'Choose a password of at least 8 characters.');
  need(password === get(q, 'confirm'), 'The two passwords do not match.');
  return password;
}

/* The account, its profile and its contacts; a code goes to each contact not already verified. */
async function createAccount(c, ctx, first, last, born, contacts, password, outbox, verified = new Set()) {
  for (const [kind, value] of contacts) {
    need(await contactOwner(c, kind, value) === null,
      (kind === 'email' ? 'This email address' : 'This phone number') + ' already has an account. Sign in instead.', 409);
  }
  const recent = await c.first("SELECT COUNT(*) AS n FROM audit WHERE action='account.signup' AND at>?", hourAgo());
  need(recent.n < SIGNUPS_PER_HOUR, 'Many accounts were opened in the last hour. Please try again later.', 429);
  const userId = 'u-' + tokenHex(8), at = NOW();
  c.run('INSERT INTO users VALUES(?,?,?,?,?,?,?)', userId, contacts[0][1], `${first} ${last}`, 'user', '', null,
    password ? passwordHash(password, tokenHex(16), ROUNDS) : '');
  c.run('INSERT INTO user_profiles VALUES(?,?,?,?,?,?)', userId, first, last, born, '{}', at);
  const delivery = [];
  for (const [kind, value] of contacts) {
    const done = verified.has(`${kind}:${value}`);
    c.run('INSERT INTO user_contacts VALUES(?,?,?,?,?)', userId, kind, value, done ? at : null, at);
    delivery.push({ kind, value, delivery: done ? 'verified' : await issueCode(c, ctx, userId, 'verify', kind, value, outbox) });
  }
  audit(c, { id: userId }, null, 'account.signup', { via: contacts.map(([kind]) => kind) });
  return [userId, delivery];
}

/* Anyone 13 or older opens an account: a first and last name, an email address and/or a phone number,
   a password. No parish is chosen here. */
export async function register(c, ctx, q, outbox) {
  need(!truthy(get(q, 'website')), 'The account could not be created.');  // a field only robots fill in
  const first = clean(get(q, 'firstName'), 60, 'Enter your first name.');
  const last = clean(get(q, 'lastName'), 60, 'Enter your last name.');
  const contacts = CONTACT_KINDS.filter(kind => strip(str(or(get(q, kind), '')))).map(kind => [kind, contactValue(kind, get(q, kind))]);
  need(contacts.length, 'Enter an email address, a phone number, or both.');
  const born = birthDate(get(q, 'birthDate'));
  return createAccount(c, ctx, first, last, born, contacts, newPassword(q), outbox);
}

/* ---- sign-in providers: each is unavailable until its client ID and secret and the site's public address are set ---- */
export const PROVIDERS = {
  google: { name: 'Google', authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile', pkce: true, issuers: ['https://accounts.google.com', 'accounts.google.com'] },
  microsoft: { name: 'Microsoft', authorize: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize',
    token: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token', scope: 'openid email profile', pkce: true, issuers: [] },
  apple: { name: 'Apple', authorize: 'https://appleid.apple.com/auth/authorize', token: 'https://appleid.apple.com/auth/token',
    scope: 'openid email name', pkce: false, issuers: ['https://appleid.apple.com'] }
};

export function providerSettings(env, name) {
  if (!Object.prototype.hasOwnProperty.call(PROVIDERS, name)) return null;
  const key = name.toUpperCase(), base = str(or(env.PARISHLIFE_PUBLIC_URL, '')).replace(/\/+$/, '');
  const cid = env[`PARISHLIFE_${key}_CLIENT_ID`], secret = env[`PARISHLIFE_${key}_CLIENT_SECRET`];
  if (!(cid && secret && /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:|$))/.test(base))) return null;
  const tenant = env.PARISHLIFE_MICROSOFT_TENANT || 'common', p = PROVIDERS[name];
  return { ...p, client_id: cid, secret, tenant, redirect: `${base}/api/auth/${name}/callback`,
    authorize: p.authorize.replace('{tenant}', tenant), token: p.token.replace('{tenant}', tenant) };
}

/* What the sign-in page may offer on this deployment. */
export function authConfig(ctx) {
  const providers = {};
  for (const [n, p] of Object.entries(PROVIDERS)) providers[n] = { name: p.name, configured: providerSettings(ctx.env, n) !== null };
  return { providers, delivery: { email: deliveryMode(ctx, 'email'), sms: deliveryMode(ctx, 'sms') }, minimumAge: MINIMUM_AGE };
}

const b64url = buffer => Buffer.from(buffer).toString('base64url');

export function oauthStart(c, env, provider, intent, userId) {
  const p = providerSettings(env, provider);
  const state = tokenUrlsafe(24), verifier = tokenUrlsafe(48), nonce = tokenUrlsafe(24);
  c.run('DELETE FROM oauth_states WHERE created<?', time() - 1800);
  c.run('INSERT INTO oauth_states VALUES(?,?,?,?,?,?,?,?)', sha(state), provider, intent, userId, verifier, nonce, '{}', time());
  const params = new URLSearchParams({ client_id: p.client_id, redirect_uri: p.redirect, response_type: 'code', scope: p.scope, state, nonce });
  if (p.pkce) {
    params.set('code_challenge', b64url(Buffer.from(sha256hex(verifier), 'hex')));
    params.set('code_challenge_method', 'S256');
  }
  if (provider === 'apple') params.set('response_mode', 'form_post');
  if (provider === 'google') params.set('prompt', 'select_account');
  return [`${p.authorize}?${params}`, state];
}

/* The ID token came straight from the provider's token endpoint over TLS, so (as OpenID Connect allows)
   its signature is not re-checked here; issuer, audience, expiry and nonce are. */
function checkedClaims(p, provider, claims, nonce) {
  const aud = claims.aud;
  if (!(Array.isArray(aud) ? aud : [aud]).includes(p.client_id)) return null;
  if (typeof claims.exp !== 'number' || claims.exp < time() - 60) return null;
  if (!compareDigest(str(or(claims.nonce, '')), nonce)) return null;
  const iss = str(or(claims.iss, ''));
  if (provider === 'microsoft') {
    const tid = str(or(claims.tid, ''));
    if (!tid || iss !== `https://login.microsoftonline.com/${tid}/v2.0` || !['common', 'organizations', 'consumers', tid].includes(p.tenant)) return null;
  } else if (!p.issuers.includes(iss)) return null;
  const sub = str(or(claims.sub, ''));
  if (!sub || sub.length > 255) return null;
  let email = strip(str(or(claims.email, ''))).toLowerCase();
  if (!(len(email) <= 120 && EMAIL_ADDRESS.test(email))) email = '';
  /* Microsoft does not say whether an address was checked, so it is never treated as verified. */
  const verified = Boolean(email) && (provider === 'google' || provider === 'apple') && (claims.email_verified === true || claims.email_verified === 'true');
  const name = v => str(or(v, '')).split(/\s+/).filter(Boolean).join(' ').slice(0, 60);
  return { sub, email, verified, firstName: name(claims.given_name), lastName: name(claims.family_name) };
}

async function oauthExchange(p, provider, code, verifier, nonce) {
  const form = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: p.redirect, client_id: p.client_id, client_secret: p.secret });
  if (p.pkce) form.set('code_verifier', verifier);
  let claims;
  try {
    const response = await fetch(p.token, { method: 'POST', body: form, signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } });
    if (!response.ok) return null;
    const token = await response.json();
    claims = JSON.parse(Buffer.from(token.id_token.split('.')[1], 'base64url').toString('utf8'));
    if (claims === null || typeof claims !== 'object' || Array.isArray(claims)) return null;
  } catch {
    return null;
  }
  return checkedClaims(p, provider, claims, nonce);
}

/* The provider sent the browser back. Returns [where to send it next, the account to sign in or null].
   An identity signs in only the account it was linked to; a matching email address is never merged.
   The state is used up in its own transaction before the provider's token endpoint is asked. */
export async function oauthFinish(env, provider, params, cookieState, run) {
  const state = str(or(params.state, ''));
  const row = await run(async c => {
    const found = state ? await c.first('SELECT * FROM oauth_states WHERE state=? AND provider=? AND created>? AND intent<>?',
      sha(state), provider, time() - 600, 'complete') : null;
    if (found) c.run('DELETE FROM oauth_states WHERE state=?', found.state);
    await c.commit();
    return found;
  });
  const back = row && row.intent === 'link' ? '#/account' : '';
  if (row === null || !compareDigest(str(or(cookieState, '')), state)) return ['/index.html?auth_error=expired', null];
  if (params.error) return [`/index.html?auth_error=cancelled${back}`, null];
  const p = providerSettings(env, provider);
  if (p === null) return ['/index.html?auth_error=unavailable', null];
  const claims = await oauthExchange(p, provider, str(or(params.code, '')), row.verifier, row.nonce);
  if (claims === null) return [`/index.html?auth_error=failed${back}`, null];
  if (provider === 'apple' && params.user) {   // Apple sends the name once, beside the token
    try {
      const name = JSON.parse(params.user).name || {};
      const tidy = v => str(or(v, '')).split(/\s+/).filter(Boolean).join(' ').slice(0, 60);
      claims.firstName ||= tidy(name.firstName);
      claims.lastName ||= tidy(name.lastName);
    } catch { /* the name is only a suggestion */ }
  }
  return run(async c => {
    const identity = await c.first('SELECT * FROM user_identities WHERE provider=? AND subject=?', provider, claims.sub);
    if (row.intent === 'link') {
      const owner = await c.first('SELECT * FROM users WHERE id=?', row.user_id);
      if (!(await loginAllowed(c, owner))) return ['/index.html?auth_error=expired', null];
      if (identity && identity.user_id !== owner.id) return ['/index.html?auth_error=linked-elsewhere#/account', null];
      if (!identity) {
        c.run('INSERT INTO user_identities VALUES(?,?,?,?,?)', provider, claims.sub, owner.id, claims.email, NOW());
        if (claims.verified) {   // the provider checked this address, so the same address on this account is verified too
          c.run('UPDATE user_contacts SET verified_at=? WHERE user_id=? AND kind=? AND value=? AND verified_at IS NULL', NOW(), owner.id, 'email', claims.email);
        }
        audit(c, owner, null, 'account.provider-linked', { provider });
        await c.commit();
      }
      return [`/index.html?linked=${provider}#/account`, null];
    }
    if (identity) return ['/index.html', identity.user_id];
    if (claims.email && await contactOwner(c, 'email', claims.email)) return [`/index.html?auth_error=email-in-use&provider=${provider}`, null];
    const ticket = tokenUrlsafe(24);
    c.run('INSERT INTO oauth_states VALUES(?,?,?,?,?,?,?,?)', sha(ticket), provider, 'complete', null, '', '', JSON.stringify(claims), time());
    await c.commit();
    return [`/index.html?provider_signup=${ticket}&provider=${provider}`, null];
  });
}

export async function providerTicket(c, ticket) {
  const row = await c.first("SELECT * FROM oauth_states WHERE state=? AND intent='complete' AND created>?", sha(str(or(ticket, ''))), time() - 1800);
  need(row !== null, 'This sign-up has expired. Start again with the same button.');
  const claims = JSON.parse(row.data);
  return [row, claims, { provider: row.provider, providerName: PROVIDERS[row.provider].name, email: claims.email,
    emailVerified: claims.verified, firstName: claims.firstName, lastName: claims.lastName }];
}

/* Finishes an account opened with a provider: the same name, age and contact rules; no password needed. */
export async function providerComplete(c, ctx, q, outbox) {
  const [row, claims] = await providerTicket(c, get(q, 'ticket'));
  need(!truthy(get(q, 'website')), 'The account could not be created.');
  const first = clean(get(q, 'firstName'), 60, 'Enter your first name.');
  const last = clean(get(q, 'lastName'), 60, 'Enter your last name.');
  const born = birthDate(get(q, 'birthDate'));
  const contacts = [...(claims.email ? [['email', claims.email]] : []),
    ...(strip(str(or(get(q, 'phone'), ''))) ? [['phone', contactValue('phone', get(q, 'phone'))]] : [])];
  need(contacts.length, 'Enter a phone number. Your provider did not share an email address.');
  need(!(await c.first('SELECT 1 AS x FROM user_identities WHERE provider=? AND subject=?', row.provider, claims.sub)), 'This account is already linked. Sign in instead.', 409);
  const [userId, delivery] = await createAccount(c, ctx, first, last, born, contacts, null, outbox,
    new Set(claims.verified ? [`email:${claims.email}`] : []));
  c.run('INSERT INTO user_identities VALUES(?,?,?,?,?)', row.provider, claims.sub, userId, claims.email, NOW());
  c.run('DELETE FROM oauth_states WHERE state=?', row.state);
  return [userId, delivery];
}

/* The person's own account: name, sign-in methods and their verification, two-step verification, providers. */
export async function accountView(c, ctx, u) {
  const [profiles, contactRows, codes, identityRows] = await c.reads([
    ['SELECT * FROM user_profiles WHERE user_id=?', [u.id]],
    ['SELECT * FROM user_contacts WHERE user_id=? ORDER BY kind,created_at', [u.id]],
    ["SELECT target,delivery,created,expires,used_at FROM verification_codes WHERE user_id=? AND purpose='verify' ORDER BY created DESC", [u.id]],
    ['SELECT * FROM user_identities WHERE user_id=? ORDER BY linked_at', [u.id]]
  ]);
  const profile = profiles[0] ?? null, names = u.name.split(' '), now = time();
  const contacts = contactRows.map(k => {
    const code = k.verified_at ? null : codes.find(r => r.target === k.value) ?? null;
    return { kind: k.kind, value: k.value, verified: Boolean(k.verified_at), verifiedAt: k.verified_at || '', username: k.value === u.username,
      code: code ? { delivery: code.delivery, sentAt: isoFromEpoch(code.created), open: code.used_at === null && code.expires > now } : null };
  });
  const rows = await mfaRows(c, u.id);
  const on = m => Boolean(rows[m]?.enabled_at);
  const mfa = { totp: { enabled: on('totp'), pending: Boolean(rows.totp) && !on('totp') },
    recoveryLeft: on('recovery') ? JSON.parse(rows.recovery.recovery).length : 0 };
  for (const m of ['email', 'sms']) mfa[m] = { enabled: on(m), delivery: deliveryMode(ctx, m), contact: Boolean(await verifiedContact(c, u.id, KIND_OF[m])) };
  const identities = identityRows.map(r => ({ provider: r.provider, name: PROVIDERS[r.provider]?.name ?? r.provider, email: r.email, linkedAt: r.linked_at }));
  return { username: u.username, name: u.name, firstName: profile ? profile.first_name : names[0],
    lastName: profile ? profile.last_name : names.slice(1).join(' '), birthDate: profile ? profile.birth_date : '',
    hasPassword: truthy(u.password), contacts, mfa, identities, config: authConfig(ctx) };
}

/* Before turning off a safeguard: the password, or for an account without one, a current authenticator code. */
async function confirmIdentity(c, u, q) {
  if (truthy(u.password)) {
    need(passwordMatches(u.password, str(or(get(q, 'password'), ''))), 'Your password is not right.', 403);
    return;
  }
  const totp = (await mfaRows(c, u.id)).totp;
  if (totp?.enabled_at) need(await mfaCheck(c, u.id, 'totp', get(q, 'code')), 'Enter a current code from your authenticator app.', 403);
}

export async function accountAction(c, ctx, u, session, q, outbox) {
  const op = get(q, 'op'), at = NOW();
  if (op === 'updateProfile') {
    const first = clean(get(q, 'firstName'), 60, 'Enter your first name.'), last = clean(get(q, 'lastName'), 60, 'Enter your last name.');
    c.run('INSERT INTO user_profiles(user_id,first_name,last_name,updated_at) VALUES(?,?,?,?) ' +
      'ON CONFLICT(user_id) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,updated_at=excluded.updated_at',
      u.id, first, last, at);
    c.run('UPDATE users SET name=? WHERE id=?', `${first} ${last}`, u.id);
    audit(c, u, null, 'account.name-changed', {});
    return {};
  }
  if (['addContact', 'sendCode', 'verifyContact', 'removeContact'].includes(op)) {
    const kind = get(q, 'kind');
    need(CONTACT_KINDS.includes(kind), 'Choose an email address or a phone number.');
    const value = contactValue(kind, get(q, 'value'));
    const row = await c.first('SELECT * FROM user_contacts WHERE user_id=? AND kind=? AND value=?', u.id, kind, value);
    const noun = kind === 'email' ? 'email address' : 'phone number';
    if (op === 'addContact') {
      need(row === null, `This ${noun} is already on your account.`, 409);
      need(await contactOwner(c, kind, value) === null, `This ${noun} belongs to another account.`, 409);
      const count = await c.first('SELECT COUNT(*) AS n FROM user_contacts WHERE user_id=? AND kind=?', u.id, kind);
      need(count.n < 3, 'An account can have up to three of each. Remove one first.');
      c.run('INSERT INTO user_contacts VALUES(?,?,?,?,?)', u.id, kind, value, null, at);
      audit(c, u, null, 'account.contact-added', { kind });
      return { delivery: await issueCode(c, ctx, u.id, 'verify', kind, value, outbox) };
    }
    need(row !== null, `This ${noun} is not on your account.`, 404);
    if (op === 'sendCode') {
      need(!row.verified_at, `This ${noun} is already verified.`);
      return { delivery: await issueCode(c, ctx, u.id, 'verify', kind, value, outbox) };
    }
    if (op === 'verifyContact') {
      need(!row.verified_at, `This ${noun} is already verified.`);
      await consumeCode(c, u.id, 'verify', value, get(q, 'code'));
      c.run('UPDATE user_contacts SET verified_at=? WHERE user_id=? AND kind=? AND value=?', at, u.id, kind, value);
      audit(c, u, null, 'account.contact-verified', { kind });
      return {};
    }
    need(value !== u.username, `This ${noun} is also your username, so it stays on your account.`);
    const method = CHANNEL[kind], rows = await mfaRows(c, u.id);
    if (rows[method]?.enabled_at && row.verified_at) {
      const others = await c.first('SELECT COUNT(*) AS n FROM user_contacts WHERE user_id=? AND kind=? AND verified_at IS NOT NULL AND value<>?', u.id, kind, value);
      need(others.n, `Two-step verification sends codes to this ${noun}. Turn that off first, or verify another one.`);
    }
    c.run('DELETE FROM user_contacts WHERE user_id=? AND kind=? AND value=?', u.id, kind, value);
    audit(c, u, null, 'account.contact-removed', { kind });
    return {};
  }
  if (op === 'changePassword') {
    if (truthy(u.password)) need(passwordMatches(u.password, str(or(get(q, 'current'), ''))), 'Your current password is not right.', 403);
    c.run('UPDATE users SET password=? WHERE id=?', passwordHash(newPassword(q), tokenHex(16), ROUNDS), u.id);
    c.run('DELETE FROM sessions WHERE user_id=? AND token<>?', u.id, session.token);   // signed out everywhere else
    audit(c, u, null, 'account.password-changed', {});
    return {};
  }
  if (op === 'totpBegin') {
    const rows = await mfaRows(c, u.id);
    need(!rows.totp?.enabled_at, 'The authenticator app is already set up.');
    const secret = base32Encode(Buffer.from(tokenHex(20), 'hex'));
    c.run('INSERT INTO user_mfa VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,method) DO UPDATE SET secret=excluded.secret,enabled_at=NULL,last_step=0',
      u.id, 'totp', secret, null, 0, '[]');
    const label = quote(`ParishLife:${u.username}`);
    return { secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=ParishLife&algorithm=SHA1&digits=6&period=30` };
  }
  if (op === 'totpConfirm') {
    const rows = await mfaRows(c, u.id), row = rows.totp;
    need(row && !row.enabled_at, 'Start the authenticator set-up again.');
    const step = totpStep(row.secret, get(q, 'code'), 0);
    need(step !== null, 'That code is not right. Check that the time on your phone is correct, then try the newest code.');
    c.run("UPDATE user_mfa SET enabled_at=?,last_step=? WHERE user_id=? AND method='totp'", at, step, u.id);
    const firstMethod = !['email', 'sms', 'recovery'].some(m => rows[m]?.enabled_at);
    audit(c, u, null, 'account.mfa-on', { method: 'totp' });
    return { recovery: firstMethod ? newRecoveryCodes(c, u.id) : null };
  }
  if (op === 'mfaEnable') {
    const method = get(q, 'method');
    need(method === 'email' || method === 'sms', 'Choose how to receive codes.');
    need(deliveryMode(ctx, method) !== 'none', (method === 'email' ? 'Email' : 'Text message') +
      ' codes are not available: this server has no delivery service set up for them yet.');
    need(await verifiedContact(c, u.id, KIND_OF[method]), 'Verify ' + (method === 'email' ? 'an email address' : 'a phone number') + ' first.');
    const rows = await mfaRows(c, u.id);
    const firstMethod = !['totp', 'email', 'sms', 'recovery'].some(m => rows[m]?.enabled_at);
    c.run('INSERT INTO user_mfa VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,method) DO UPDATE SET enabled_at=excluded.enabled_at', u.id, method, '', at, 0, '[]');
    audit(c, u, null, 'account.mfa-on', { method });
    return { recovery: firstMethod ? newRecoveryCodes(c, u.id) : null };
  }
  if (op === 'mfaDisable') {
    const method = get(q, 'method');
    need(['totp', 'email', 'sms'].includes(method), 'Choose a method.');
    await confirmIdentity(c, u, q);
    const rows = await mfaRows(c, u.id);
    c.run('DELETE FROM user_mfa WHERE user_id=? AND method=?', u.id, method);
    if (!['totp', 'email', 'sms'].some(m => m !== method && rows[m]?.enabled_at)) c.run("DELETE FROM user_mfa WHERE user_id=? AND method='recovery'", u.id);
    audit(c, u, null, 'account.mfa-off', { method });
    return {};
  }
  if (op === 'recoveryCodes') {
    need(await mfaTurnedOn(c, ctx, u.id), 'Turn on two-step verification first.');
    await confirmIdentity(c, u, q);
    audit(c, u, null, 'account.recovery-codes', {});
    return { recovery: newRecoveryCodes(c, u.id) };
  }
  if (op === 'unlinkProvider') {
    const provider = get(q, 'provider');
    const [row, others] = await c.reads([
      ['SELECT * FROM user_identities WHERE user_id=? AND provider=?', [u.id, provider]],
      ['SELECT COUNT(*) AS n FROM user_identities WHERE user_id=? AND provider<>?', [u.id, provider]]
    ]);
    need(row.length, 'This sign-in provider is not linked.', 404);
    need(truthy(u.password) || others[0].n, 'Set a password first, so you can still sign in afterwards.');
    c.run('DELETE FROM user_identities WHERE user_id=? AND provider=?', u.id, provider);
    audit(c, u, null, 'account.provider-unlinked', { provider });
    return {};
  }
  throw new Problem(400, 'Unknown account action.');
}
