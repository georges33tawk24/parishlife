/* Personal signatures for parish staff; the same as backend/signatures.py.

   A person's handwritten signature is kept with one of their own passkeys. Nothing is signed
   unless that person unlocks that passkey (face, fingerprint or PIN) over a fingerprint of the
   exact content being signed, so a signature cannot be made by anyone else, nor moved to another
   document. The proof (the passkey's signature and its public key) is kept with each signature,
   which anyone can check at public.html?verify=CODE: who signed, when, and whether the document
   still matches what was signed. */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { need, tokenHex, tokenUrlsafe, NOW } from './py.js';
import { parishContext, isOffice, hasClergy, isSuperAdmin, history } from './workspace.js';
import { assertion, signatureValid } from './sign-in.js';

const PATH = /^[MLQCZmlqcz0-9 .,-]{8,30000}$/;
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';   // no 0/O, 1/I/L or U to misread
const b64u = bytes => Buffer.from(bytes).toString('base64url');
const unb64u = text => new Uint8Array(Buffer.from(String(text || ''), 'base64url'));

/* JSON with sorted keys and no spaces, exactly as Python's json.dumps(sort_keys=True, separators=(',',':')). */
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',')}}` : JSON.stringify(value);
export const fingerprint = payload => createHash('sha256').update(canonical(payload), 'utf8').digest('hex');
export const challenge = (digest, nonce) => b64u(createHash('sha256').update(`${digest}|${nonce}`, 'utf8').digest());
/* A random letter of ALPHABET, without the bias of a plain remainder (240 is 8 × 30). */
const letter = () => { const b = new Uint8Array(1); do crypto.getRandomValues(b); while (b[0] >= 240); return ALPHABET[b[0] % ALPHABET.length]; };
const newCode = () => Array.from({ length: 3 }, () => Array.from({ length: 4 }, letter).join('')).join('-');
const context = (ctx, digest) => ({ ...ctx, challenge: ctx.nonce ? challenge(digest, ctx.nonce) : '' });

/* ---------- what is signed ---------- */
export function certificatePayload(pid, d, s) {
  const source = (d.SACRAMENTS || []).find(x => x.id === s.sourceRecordId) || {};
  const person = (d.PEOPLE || []).find(p => p.id === (source.person || s.person)) || {};
  const str = v => String(v ?? '');
  return { v: 1, type: 'certificate', parish: pid, id: str(s.id), reg: str(s.reg), kind: str(source.kind), source: str(source.reg), date: str(source.date),
    book: str(source.book), page: str(source.page), person: str(person.lat), personAr: str(person.ar) };
}
const letterPayload = (pid, request, title, body, signer, date) => ({ v: 1, type: 'letter', parish: pid, request, title, body, signer, date });
const signerPayload = (user, drawing) => ({ v: 1, type: 'signer', user, drawing: createHash('sha256').update(drawing, 'utf8').digest('hex') });

/* ---------- who may sign ---------- */
async function officeContext(c, user, pid) {
  const ctx = await parishContext(c, user, pid);
  return ctx && (isOffice(ctx) || hasClergy(ctx)) ? ctx : null;
}
async function eligible(c, user) {
  for (const row of await c.all('SELECT id FROM parishes')) if (await officeContext(c, user, row.id)) return true;
  return false;
}
async function signer(c, user) {
  const row = await c.first('SELECT * FROM pl_signers WHERE user_id=?', user.id);
  // When the passkey it was kept with is removed, the signature must be set up again.
  return row && await c.first('SELECT 1 FROM pl_passkeys WHERE id=? AND user_id=?', row.credential_id, user.id) ? row : null;
}
// The drawing is kept as it was when signing, so changing one's signature later leaves past documents as signed.
const proof = (row, q, nonce, drawing) => ({ id: row.id, publicKey: JSON.parse(row.public_key), nonce, drawing,
  ...Object.fromEntries(['clientDataJSON', 'authenticatorData', 'signature'].map(k => [k, String(q[k] || '')])) });

function record(c, user, pid, kind, docId, title, digest, me, evidence) {
  const code = newCode();
  c.run('INSERT INTO pl_signatures VALUES(?,?,?,?,?,?,?,?,?,?,?,?,NULL)', code, pid, kind, docId, title.slice(0, 200), digest, user.id, user.name, me.title || '', me.credential_id, JSON.stringify(evidence), NOW());
  history(c, user, pid, 'signature.made', { code, document: kind, id: docId });
  return code;
}
/* What a signed document shows: the drawing, the name and title, the time and the code. */
const stamp = (code, user, me, at) => ({ code, name: user.name, role: me.title || '', drawing: me.drawing, signedAt: at });

/* Called by the priest's issue step with the passkey's answer: signs exactly this certificate. */
export async function signCertificate(c, user, pid, d, s, q) {
  const me = await signer(c, user);
  need(me, 'Set up your signature in My account before signing.', 403);
  const digest = fingerprint(certificatePayload(pid, d, s)), ctx = context(q._signContext || {}, digest);
  const row = await assertion(c, q.signature || {}, ctx, { userId: user.id, credential: me.credential_id, verified: true });
  const at = NOW(), code = record(c, user, pid, 'certificate', String(s.id), String(s.reg ?? ''), digest, me, proof(row, q.signature || {}, ctx.nonce, me.drawing));
  s.signature = stamp(code, user, me, at);
  return code;
}

export async function letters(c, requestId) {
  const rows = await c.all('SELECT l.*,s.signer_name,s.signer_role,s.signed_at,s.proof,p.metadata FROM pl_letters l JOIN pl_signatures s ON s.code=l.signature_code JOIN parishes p ON p.id=l.parish_id WHERE l.request_id=? ORDER BY l.created_at', requestId);
  return rows.map(row => {
    const meta = JSON.parse(row.metadata);
    return { title: row.title, body: row.body, createdAt: row.created_at, parish: Object.fromEntries(['name', 'ar', 'town'].map(k => [k, String(meta[k] || '')])),
      code: row.signature_code, name: row.signer_name, role: row.signer_role, drawing: JSON.parse(row.proof).drawing || '', signedAt: row.signed_at };
  });
}

export async function verify(c, raw) {
  const plain = String(raw).toUpperCase().replace(/[^0-9A-Z]/g, ''), code = plain.match(/.{1,4}/g)?.join('-') || '';
  const row = await c.first('SELECT * FROM pl_signatures WHERE code=?', code);
  if (!row) return { found: false };
  const meta = JSON.parse((await c.first('SELECT metadata FROM parishes WHERE id=?', row.parish_id)).metadata);
  const evidence = JSON.parse(row.proof), data = unb64u(evidence.authenticatorData), client = unb64u(evidence.clientDataJSON);
  let said = null;
  try { said = JSON.parse(new TextDecoder().decode(client)).challenge; } catch { said = null; }
  const signed = said === challenge(row.digest, evidence.nonce || '') && await signatureValid(evidence.publicKey || {}, unb64u(evidence.signature),
    new Uint8Array([...data, ...createHash('sha256').update(client).digest()]));
  let matches = null, reference = '', subject = '';
  if (row.document_type === 'certificate') {
    const state = await c.first('SELECT data FROM states WHERE parish_id=?', row.parish_id), d = state ? JSON.parse(state.data) : {};
    const s = (d.SACRAMENTS || []).find(x => String(x.id) === row.document_id);
    if (s) {
      const payload = certificatePayload(row.parish_id, d, s);
      matches = fingerprint(payload) === row.digest;
      reference = payload.source || payload.reg;
      subject = payload.person.split(/\s+/).filter(Boolean).map(part => part[0] + '.').join(' ');
    }
  } else if (row.document_type === 'letter') {
    const letter = await c.first('SELECT * FROM pl_letters WHERE signature_code=?', code);
    if (letter) matches = fingerprint(letterPayload(row.parish_id, letter.request_id, letter.title, letter.body, row.signer_id, letter.created_at.slice(0, 10))) === row.digest;
  }
  return { found: true, code, type: row.document_type, title: row.title, reference, subject, parish: { name: meta.name ?? '', ar: meta.ar ?? '', town: meta.town ?? '' },
    signer: row.signer_name, role: row.signer_role, signedAt: row.signed_at, revokedAt: row.revoked_at || '',
    fingerprint: (row.digest.slice(0, 24).match(/.{4}/g) || []).join(' ').toUpperCase(), signatureValid: !!signed, contentMatches: matches };
}

function letterText(q) {
  const title = String(q.title || '').trim(), body = String(q.body || '').trim();
  need(title.length >= 3 && title.length <= 160, 'Give the letter a title (3–160 characters).');
  need(body.length >= 10 && body.length <= 6000, 'Write the letter (10–6,000 characters).');
  return [title, body];
}

/* WebAuthn options for signing one thing; the challenge is the thing's fingerprint. */
export async function signOptions(c, user, q, ctx) {
  let digest, allow;
  if (q.type === 'setup') {
    const drawing = String(q.drawing || '');
    need(PATH.test(drawing), 'Draw your signature first.');
    digest = fingerprint(signerPayload(user.id, drawing));
    allow = (await c.all('SELECT id FROM pl_passkeys WHERE user_id=?', user.id)).map(row => row.id);
    need(allow.length, 'Add a passkey on this device first: your signature is kept with it.', 403);
  } else {
    const me = await signer(c, user);
    need(me, 'Set up your signature in My account before signing.', 403);
    const pid = String(q.parish || ''), office = await officeContext(c, user, pid);
    need(office, 'Only the parish office can sign for this parish.', 403);
    if (q.type === 'certificate') {
      const row = await c.first('SELECT data FROM states WHERE parish_id=?', pid);
      need(row, 'Parish not found.', 404);
      const d = JSON.parse(row.data), s = d.SACRAMENTS.find(x => x.id === q.id);
      need(s && s.kind === 'certificate' && s.status === 'approved', 'Approve the certificate before signing it.');
      need(hasClergy(office), 'Only the parish priest signs certificates.', 403);
      digest = fingerprint(certificatePayload(pid, d, s));
    } else if (q.type === 'letter') digest = fingerprint(letterPayload(pid, String(q.request || ''), ...letterText(q), user.id, NOW().slice(0, 10)));
    else need(false, 'Choose what to sign.');
    allow = [me.credential_id];
  }
  const nonce = tokenUrlsafe(24);
  return [{ challenge: challenge(digest, nonce), rpId: ctx.rpId, timeout: 120000, userVerification: 'required', allowCredentials: allow.map(id => ({ type: 'public-key', id })), fingerprint: digest.slice(0, 24).toUpperCase() }, nonce];
}

export async function signatureHandle(c, user, path, method, q, ctx) {
  if (path === '/api/account/signature' && method === 'GET') {
    const me = await signer(c, user), key = me ? await c.first('SELECT name FROM pl_passkeys WHERE id=?', me.credential_id) : null;
    return { eligible: await eligible(c, user), passkeys: (await c.first('SELECT COUNT(*) AS n FROM pl_passkeys WHERE user_id=?', user.id)).n,
      signer: me ? { drawing: me.drawing, title: me.title, passkey: key?.name || '', updatedAt: me.updated_at } : null };
  }
  if (path === '/api/account/signature' && method === 'POST') {
    need(await eligible(c, user), 'Signatures are for parish staff.', 403);
    const drawing = String(q.drawing || ''), title = String(q.title || '').trim().slice(0, 80);
    need(PATH.test(drawing), 'Draw your signature first.');
    const row = await assertion(c, q.signature || {}, context(ctx, fingerprint(signerPayload(user.id, drawing))), { userId: user.id, verified: true });
    const at = NOW();
    c.run('INSERT INTO pl_signers VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET drawing=excluded.drawing,title=excluded.title,credential_id=excluded.credential_id,updated_at=excluded.updated_at', user.id, drawing, title, row.id, at, at);
    history(c, user, '*', 'signature.set-up', { passkey: row.name });
    return { ok: true };
  }
  if (path === '/api/account/signature/remove' && method === 'POST') {
    c.run('DELETE FROM pl_signers WHERE user_id=?', user.id);
    history(c, user, '*', 'signature.removed', {});
    return { ok: true };
  }
  if (path === '/api/sign/letter' && method === 'POST') {
    const pid = String(q.parish || ''), requestId = String(q.request || '');
    need(await officeContext(c, user, pid), 'Only the parish office can sign for this parish.', 403);
    need(await c.first('SELECT 1 FROM pl_guest_requests WHERE id=? AND parish_id=?', requestId, pid), 'Request not found.', 404);
    const me = await signer(c, user);
    need(me, 'Set up your signature in My account before signing.', 403);
    const [title, body] = letterText(q), at = NOW(), digest = fingerprint(letterPayload(pid, requestId, title, body, user.id, at.slice(0, 10))), signCtx = context(ctx, digest);
    const row = await assertion(c, q.signature || {}, signCtx, { userId: user.id, credential: me.credential_id, verified: true });
    const code = record(c, user, pid, 'letter', requestId, title, digest, me, proof(row, q.signature || {}, signCtx.nonce, me.drawing));
    c.run('INSERT INTO pl_letters VALUES(?,?,?,?,?,?,?)', tokenHex(12), pid, requestId, title, body, code, at);
    c.run("UPDATE pl_guest_requests SET status=CASE WHEN status IN ('closed') THEN status ELSE 'ready-for-download' END,updated_at=? WHERE id=?", at, requestId);
    return { ok: true, code };
  }
  if (path === '/api/sign/revoke' && method === 'POST') {
    const row = await c.first('SELECT * FROM pl_signatures WHERE code=?', String(q.code || ''));
    need(row, 'Signature not found.', 404);
    need(row.signer_id === user.id || await isSuperAdmin(c, user), 'Only the person who signed can withdraw a signature.', 403);
    const reason = String(q.reason || '').trim();
    need(reason.length >= 3 && reason.length <= 500, 'Say why the signature is withdrawn (3–500 characters).');
    c.run('UPDATE pl_signatures SET revoked_at=? WHERE code=? AND revoked_at IS NULL', NOW(), row.code);
    history(c, user, row.parish_id, 'signature.revoked', { code: row.code, reason });
    return { ok: true };
  }
  return null;
}
