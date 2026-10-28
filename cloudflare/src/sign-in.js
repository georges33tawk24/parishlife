/* Sign-in protections, the same as backend/sign_in.py: a pause after repeated wrong passwords,
   a check that a new password is not a common or leaked one, the Cloudflare Turnstile check
   when the platform has keys for it, and passkeys (WebAuthn) to sign in without a password. */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { Problem, need, sha256hex, tokenHex, tokenUrlsafe, NOW } from './py.js';
import { loginName } from './accounts.js';
import common from '../../backend/common-passwords.json' with { type: 'json' };

/* ---------- repeated wrong passwords ---------- */
const WINDOW = 15 * 60 * 1000, ACCOUNT_LIMIT = 10, ADDRESS_LIMIT = 60;
const failureKeys = (q, address) => ['account:' + sha256hex(loginName(q.username).toLowerCase()), 'address:' + sha256hex(String(address || ''))];

export async function loginGuard(c, q, address) {
  const since = new Date(Date.now() - WINDOW).toISOString(), count = 'SELECT COUNT(*) AS n FROM pl_login_failures WHERE key=? AND created_at>?';
  const [account, place] = failureKeys(q, address), [[a], [b]] = await c.reads([[count, [account, since]], [count, [place, since]]]);
  need(a.n < ACCOUNT_LIMIT && b.n < ADDRESS_LIMIT, 'Too many attempts to sign in. Wait 15 minutes and try again, or ask your parish office to reset your password.', 429);
}
/* Recorded and committed before the error is answered, since an error rolls the request back. */
export async function loginFailed(c, q, address) {
  const stamp = new Date().toISOString();
  c.run('DELETE FROM pl_login_failures WHERE created_at<?', new Date(Date.now() - 86400000).toISOString());
  for (const key of failureKeys(q, address)) c.run('INSERT INTO pl_login_failures VALUES(?,?)', key, stamp);
  await c.commit();
}
export const loginSucceeded = (c, q) => c.run('DELETE FROM pl_login_failures WHERE key=?', failureKeys(q, '')[0]);

/* ---------- new passwords ---------- */
const COMMON = new Set(common);
export const WEAK_PASSWORD = 'This password is too common or has appeared in a data breach. Choose another; a short sentence is easy to remember and hard to guess.';

/* Pwned Passwords is asked about the first five characters of the password's SHA-1 only. When it
   cannot be reached the password is accepted, so an outage never blocks sign-up. */
async function breached(password) {
  const hash = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  try {
    const response = await fetch('https://api.pwnedpasswords.com/range/' + hash.slice(0, 5), { headers: { 'Add-Padding': 'true', 'User-Agent': 'ParishLife' }, signal: AbortSignal.timeout(2000) });
    if (!response.ok) return false;
    const suffix = hash.slice(5);
    return (await response.text()).split('\n').some(line => { const [tail, count] = line.trim().split(':'); return tail === suffix && Number(count) > 0; });
  } catch { return false; }
}
export async function passwordProblem(password, contacts = []) {
  const lower = password.toLowerCase();
  if (contacts.some(v => v && v.length >= 4 && lower.includes(v.toLowerCase().replace(/^\+/, ''))))
    return 'Choose a password that does not contain your email address or phone number.';
  if (COMMON.has(lower) || lower.includes('parishlife') || /^(.)\1*$/.test(password) || await breached(password)) return WEAK_PASSWORD;
  return '';
}

/* ---------- Turnstile ---------- */
/* Only when the platform has a Turnstile secret; the page then shows the widget (see auth-options). */
export async function humanCheck(env, q, address) {
  if (!env.TURNSTILE_SECRET) return;
  let ok = false;
  const token = String(q.turnstile || '');
  if (token) try {
    const body = new FormData();
    body.append('secret', env.TURNSTILE_SECRET); body.append('response', token);
    if (address) body.append('remoteip', address);
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    ok = (await response.json()).success === true;
  } catch { ok = false; }
  need(ok, 'The security check did not finish. Wait a moment for it, then try again.', 403);
}

/* ---------- passkeys ---------- */
const FAILED = 'The passkey could not be checked. Try again, or sign in with your password.';
const EXPIRED = 'The passkey request expired. Try again.';
const b64u = bytes => Buffer.from(bytes).toString('base64url');
const unb64u = text => new Uint8Array(Buffer.from(String(text || ''), 'base64url'));
const sha256 = bytes => new Uint8Array(createHash('sha256').update(bytes).digest());
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

export function cookieValue(header, name) {
  for (const part of (header || '').split(';')) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return '';
}
/* The challenge travels in a short-lived cookie for the API only, so nothing is stored for it. */
export const passkeyContext = (request, url, secure) => ({
  rpId: url.hostname, origin: url.origin, challenge: cookieValue(request.headers.get('Cookie'), 'pl_passkey'),
  cookie: value => `pl_passkey=${value}; HttpOnly; SameSite=Strict; Path=/api/; Max-Age=${value ? 300 : 0}${secure}`
});

/* The parts of CBOR that WebAuthn uses: integers, byte and text strings, arrays and maps. */
function cbor(bytes, start = 0) {
  let at = start;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const read = () => {
    const first = bytes[at++], major = first >> 5, info = first & 31;
    let n = info;
    if (info === 24) n = view.getUint8(at++);
    else if (info === 25) { n = view.getUint16(at); at += 2; }
    else if (info === 26) { n = view.getUint32(at); at += 4; }
    else if (info === 27) { n = Number(view.getBigUint64(at)); at += 8; }
    else if (info > 27) throw new Error('CBOR');
    if (major === 0) return n;
    if (major === 1) return -1 - n;
    if (major === 2 || major === 3) {
      need(at + n <= bytes.length, FAILED);
      const chunk = bytes.slice(at, at + n); at += n;
      return major === 2 ? chunk : new TextDecoder().decode(chunk);
    }
    if (major === 4) return Array.from({ length: n }, () => read());
    if (major === 5) { const map = new Map(); for (let i = 0; i < n; i++) { const key = read(); map.set(key, read()); } return map; }
    if (major === 7) return info === 20 ? false : info === 21 ? true : null;
    throw new Error('CBOR');
  };
  return read();
}

function authenticatorData(bytes) {
  need(bytes.length >= 37, FAILED);
  const flags = bytes[32], out = { rpIdHash: bytes.slice(0, 32), flags, count: new DataView(bytes.buffer, bytes.byteOffset).getUint32(33) };
  if (flags & 0x40) {
    need(bytes.length >= 55, FAILED);
    const length = (bytes[53] << 8) | bytes[54];
    out.credentialId = bytes.slice(55, 55 + length);
    try { out.key = cbor(bytes, 55 + length); } catch { throw new Problem(400, FAILED); }
  }
  return out;
}

function clientData(encoded, type, ctx) {
  let data = null;
  try { data = JSON.parse(new TextDecoder().decode(unb64u(encoded))); } catch { data = null; }
  need(ctx.challenge, EXPIRED);
  need(data && data.type === type && data.challenge === ctx.challenge && data.origin === ctx.origin, FAILED);
}

/* ES256 (P-256) and RS256 public keys, kept as JWK fields. */
function coseKey(map) {
  need(map instanceof Map, FAILED);
  const kty = map.get(1), alg = map.get(3);
  if (kty === 2 && alg === -7 && map.get(-1) === 1) return { alg, kty: 'EC', x: b64u(map.get(-2)), y: b64u(map.get(-3)) };
  if (kty === 3 && alg === -257) return { alg, kty: 'RSA', n: b64u(map.get(-1)), e: b64u(map.get(-2)) };
  throw new Problem(400, 'This passkey uses a kind of key ParishLife does not accept yet.');
}
/* WebAuthn signs ECDSA as DER; WebCrypto verifies r and s side by side. */
function derToRaw(der) {
  let at = 2;
  const part = () => {
    if (der[at] !== 2) throw new Error('DER');
    const length = der[at + 1];
    let value = der.slice(at + 2, at + 2 + length);
    at += 2 + length;
    while (value.length > 32 && value[0] === 0) value = value.slice(1);
    const out = new Uint8Array(32); out.set(value, 32 - value.length); return out;
  };
  if (der[0] !== 0x30) throw new Error('DER');
  const raw = new Uint8Array(64); raw.set(part()); raw.set(part(), 32);
  return raw;
}
async function signatureValid(key, signature, data) {
  try {
    if (key.kty === 'EC') {
      const k = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: key.x, y: key.y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, derToRaw(signature), data);
    }
    const k = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: key.n, e: key.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', k, signature, data);
  } catch { return false; }
}
const record = (c, u, action, detail) => c.run('INSERT INTO pl_history VALUES(?,?,?,?,?,?)', tokenHex(16), u.id, '*', action, JSON.stringify(detail), NOW());

/* Options for the browser: to sign in (any passkey of this site), or to add one to the account. */
export async function passkeyOptions(c, u, ctx) {
  const challenge = tokenUrlsafe(32);
  if (!u) return { challenge, rpId: ctx.rpId, timeout: 120000, userVerification: 'preferred' };
  const existing = await c.all('SELECT id FROM pl_passkeys WHERE user_id=?', u.id);
  return { challenge, rp: { name: 'ParishLife', id: ctx.rpId }, user: { id: b64u(Buffer.from(u.id)), name: u.username, displayName: u.name || u.username },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], timeout: 120000, attestation: 'none',
    authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'preferred' },
    excludeCredentials: existing.map(row => ({ type: 'public-key', id: row.id })) };
}

export async function passkeyAdd(c, u, q, ctx) {
  clientData(q.clientDataJSON, 'webauthn.create', ctx);
  let attestation = null;
  try { attestation = cbor(unb64u(q.attestationObject)); } catch { attestation = null; }
  need(attestation instanceof Map && attestation.get('authData') instanceof Uint8Array, FAILED);
  const parsed = authenticatorData(attestation.get('authData'));
  need(same(parsed.rpIdHash, sha256(ctx.rpId)) && parsed.flags & 1 && parsed.credentialId?.length, FAILED);
  const id = b64u(parsed.credentialId), key = coseKey(parsed.key);
  need(id.length <= 1400, FAILED);
  need(!await c.first('SELECT 1 FROM pl_passkeys WHERE id=?', id), 'This passkey is already on an account.', 409);
  need((await c.first('SELECT COUNT(*) AS n FROM pl_passkeys WHERE user_id=?', u.id)).n < 10, 'An account can have up to ten passkeys.');
  const name = String(q.name || '').trim().slice(0, 60) || 'Passkey';
  c.run('INSERT INTO pl_passkeys VALUES(?,?,?,?,?,?,?,NULL)', id, u.id, JSON.stringify(key), key.alg, parsed.count, name, NOW());
  record(c, u, 'account.passkey.added', { name });
  return { ok: true };
}

/* The account a passkey signs in to, or an error. */
export async function passkeyUser(c, q, ctx) {
  clientData(q.clientDataJSON, 'webauthn.get', ctx);
  const row = await c.first('SELECT * FROM pl_passkeys WHERE id=?', String(q.id || ''));
  need(row, 'This passkey is not on a ParishLife account. Sign in with your password, then add it in My account.', 401);
  const data = unb64u(q.authenticatorData), parsed = authenticatorData(data);
  need(same(parsed.rpIdHash, sha256(ctx.rpId)) && parsed.flags & 1, FAILED, 401);
  if (q.userHandle) need(new TextDecoder().decode(unb64u(q.userHandle)) === row.user_id, FAILED, 401);
  const signed = new Uint8Array([...data, ...sha256(unb64u(q.clientDataJSON))]);
  need(await signatureValid(JSON.parse(row.public_key), unb64u(q.signature), signed), FAILED, 401);
  // A counter that goes backwards means a copied authenticator.
  need(!(parsed.count && row.sign_count && parsed.count <= row.sign_count), FAILED, 401);
  c.run('UPDATE pl_passkeys SET sign_count=?,last_used_at=? WHERE id=?', parsed.count, NOW(), row.id);
  return row.user_id;
}

export async function accountPasskeys(c, u, path, method, q, ctx) {
  if (path === '/api/account/passkeys' && method === 'GET')
    return { passkeys: await c.all('SELECT id,name,created_at,last_used_at FROM pl_passkeys WHERE user_id=? ORDER BY created_at', u.id) };
  if (path === '/api/account/passkeys' && method === 'POST') return passkeyAdd(c, u, q, ctx);
  if (path === '/api/account/passkeys/remove' && method === 'POST') {
    const row = await c.first('SELECT name FROM pl_passkeys WHERE id=? AND user_id=?', String(q.id || ''), u.id);
    need(row, 'Passkey not found.', 404);
    c.run('DELETE FROM pl_passkeys WHERE id=? AND user_id=?', q.id, u.id);
    record(c, u, 'account.passkey.removed', { name: row.name });
    return { ok: true };
  }
  return null;
}
