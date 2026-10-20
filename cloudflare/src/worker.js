/* ParishLife on Cloudflare: the same-origin application server from server.py.
   Static files are served by Workers Static Assets (see .assetsignore and _headers);
   this Worker answers /api/*, the site root, and anything else (404), in the same
   order and with the same messages as server.py's Handler. */
import { Buffer } from 'node:buffer';
import { Tx, Conflict } from './db.js';
import {
  Problem, PyError, need, truthy, eq, has, set, get, K, iter, items, sorted, str, strip, len, setTimeZone, time,
  sha256hex, tokenUrlsafe, compareDigest, passwordMatches, b64length, quote, NOW
} from './py.js';
import {
  ROLES, ensureDatabase, access, file_access, parishes, oversight, visible, save_patch, workflow, audit
} from './app.js';
import { parish_theme } from './state.js';
import { authority, parishUser, sessionAuthority, loginAllowed, adminView, adminAction } from './authority.js';
import { member_view, member_action } from './member.js';
import {
  authConfig, signIn, mfaTurnedOn, mfaChallenge, challengeInfo, mfaSend, mfaVerify, register, providerTicket, providerComplete,
  accountView, accountAction, sendOutbox, settle, providerSettings, oauthStart, oauthFinish
} from './identity.js';
import { xlsx_preview } from './xlsx.js';
import { publicParish, invitationInfo, connectionsView, connectionsAction, officeConnectionAction, publicDirectory, publicConfig, publicImage } from './connections.js';
import { ministryInquiry, ministryAction, accountNotificationsView, accountNotificationsAction } from './ministries.js';
import { guestRequestCreate, guestRequestRow, guestRequestView, guestDocument, guestRequestAction, dioceseDocuments, dioceseDocumentAction } from './documents.js';
import { messagesList, messagesAction } from './privacy.js';
import { plansPublic, plansView, plansAction } from './plans.js';

function fileReply(row, data) {
  const headers = new Headers({ 'Content-Type': row.mime, 'Content-Length': String(row.size), 'Content-Disposition': "inline; filename*=UTF-8''" + quote(row.name) });
  for (const [k, v] of Object.entries(HEADERS)) headers.set(k, v);
  return new Response(data, { status: 200, headers });
}

const HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY'
};
const FILE_CHUNK = 1000000; // base64 characters per stored chunk (a D1 row holds at most 2 MB)

class Reply {
  constructor(response) {
    this.response = response;
  }
}

function reply(status, obj, cookie = null) {
  const body = JSON.stringify(obj);
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  if (cookie) headers.set('Set-Cookie', cookie);
  for (const [k, v] of Object.entries(HEADERS)) headers.set(k, v);
  return new Response(body, { status, headers });
}

function errorPage(status, message, explanation, head = false) {
  const body = `<!DOCTYPE HTML>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <title>Error response</title>
    </head>
    <body>
        <h1>Error response</h1>
        <p>Error code: ${status}</p>
        <p>Message: ${message}.</p>
        <p>Error code explanation: ${status} - ${explanation}.</p>
    </body>
</html>
`;
  const headers = new Headers({ 'Content-Type': 'text/html;charset=utf-8', 'Content-Length': String(new TextEncoder().encode(body).length) });
  for (const [k, v] of Object.entries(HEADERS)) headers.set(k, v);
  return new Response(head ? null : body, { status, headers });
}

/* http.cookies.SimpleCookie(header).get(name) */
function sessionCookie(header, name = 'pl_session') {
  let value = null;
  for (const part of (header || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    let v = part.slice(eq + 1).trim();
    if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    value = v;
  }
  return value;
}

/* email.message.Message.get_content_type() for the Content-Type header */
function contentType(header) {
  const main = (header || '').split(';')[0].trim().toLowerCase();
  return /^[^/\s]+\/[^/\s]+$/.test(main) ? main : 'text/plain';
}

function pathParts(path) {
  return path.replace(/^\/+|\/+$/g, '').split('/');
}

function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, 'Content-Length': '0' });
  for (const [k, v] of Object.entries(HEADERS)) headers.set(k, v);
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}

function newSession(c, userId, secureCookie) {
  const token = tokenUrlsafe(32), csrf = tokenUrlsafe(32);
  c.run('DELETE FROM sessions WHERE expires<?', time());
  c.run('INSERT INTO sessions VALUES(?,?,?,?)', sha256hex(token), userId, csrf, time() + 28800);
  return `pl_session=${token}; HttpOnly; SameSite=Strict; Path=/${secureCookie}`;
}

/* Codes may be written to the log instead of sent only on a local `wrangler dev`. */
const deliveryContext = (env, url) => ({ env, dev: env.PARISHLIFE_DEV_OUTBOX === '1' && ['localhost', '127.0.0.1'].includes(url.hostname) });

async function storedFile(c, row) {
  const chunks = await c.all('SELECT data FROM cf_file_chunks WHERE file_id=? ORDER BY seq', row.id);
  return Buffer.from(chunks.map(chunk => chunk.data).join(''), 'base64');
}

/* One attempt at server.py's api(): every database read and write of the request
   runs in `c`, committed together unless a Problem or error is raised first. */
async function handle(c, env, request, url, q, secureCookie) {
  const method = request.method;
  const path = url.pathname;
  if (path === '/api/public/plans' && method === 'GET') return reply(200, await plansPublic(c));
  if (path === '/api/public/parishes' && method === 'GET') return reply(200, { parishes: await publicDirectory(c) });
  if (path === '/api/public/config' && method === 'GET') return reply(200, publicConfig(env));
  if (/^\/api\/public\/parishes\/[^/]+\/images\/[^/]+$/.test(path) && method === 'GET') {
    const parts = path.split('/');
    const row = await publicImage(c, parts[4], parts[6]);
    return fileReply(row, await storedFile(c, row));
  }
  if (path.startsWith('/api/public/parishes/') && method === 'GET') return reply(200, await publicParish(c, path.slice(path.lastIndexOf('/') + 1)));
  if (path.startsWith('/api/public/parishes/') && path.endsWith('/inquiries') && method === 'POST') {
    const result = await ministryInquiry(c, path.split('/')[4], q);
    await c.commit();
    return reply(200, result);
  }
  if (path.startsWith('/api/public/parishes/') && path.endsWith('/document-requests') && method === 'POST') {
    const outbox = [], ctx = deliveryContext(env, url);
    const result = await guestRequestCreate(c, ctx, path.split('/')[4], q, outbox, String(env.PARISHLIFE_PUBLIC_URL || '').replace(/\/+$/, '') || url.origin);
    await c.commit();
    if (outbox.length) {
      await sendOutbox(ctx, outbox);
      result.linkDelivery = outbox[0].status;
    }
    return reply(200, result);
  }
  if (path === '/api/public/requests/track' && method === 'POST') return reply(200, await guestRequestView(c, await guestRequestRow(c, get(q, 'token'))));
  if (path === '/api/public/requests/document' && method === 'POST') {
    const row = await guestDocument(c, get(q, 'token'));
    const data = await storedFile(c, row);
    await c.commit();
    return fileReply(row, data);
  }
  if (path === '/api/invitations/info' && method === 'POST') return reply(200, await invitationInfo(c, get(q, 'token')));
  const ctx = deliveryContext(env, url);
  /* Codes are handed to the delivery service only after the commit, so a retried request never sends twice. */
  const startSession = async (userId, outbox = [], delivery = null) => {
    const cookie = newSession(c, userId, secureCookie);
    await c.commit();
    const body = { ok: true };
    if (delivery !== null) {
      await sendOutbox(ctx, outbox);
      body.delivery = settle(delivery, outbox);
    }
    return reply(200, body, cookie);
  };
  if (path === '/api/auth/config' && method === 'GET') return reply(200, authConfig(ctx));
  if (path === '/api/login' && method === 'POST') {
    const u = await signIn(c, q);
    if (await mfaTurnedOn(c, ctx, u.id)) {   // two-step verification: a challenge instead of a session
      const token = await mfaChallenge(c, ctx, u.id);
      await c.commit();
      return reply(200, (await challengeInfo(c, token))[1]);
    }
    return startSession(u.id);
  }
  if (path === '/api/login/challenge' && method === 'POST') return reply(200, (await challengeInfo(c, get(q, 'challenge')))[1]);
  if (path === '/api/login/send' && method === 'POST') {
    const outbox = [], result = await mfaSend(c, ctx, q, outbox);
    await c.commit();
    await sendOutbox(ctx, outbox);
    return reply(200, { ...result, delivery: outbox.length ? outbox[0].status : result.delivery });
  }
  if (path === '/api/login/verify' && method === 'POST') return startSession((await mfaVerify(c, q)).id);
  if (path === '/api/signup' && method === 'POST') {
    const outbox = [], [userId, delivery] = await register(c, ctx, q, outbox);
    return startSession(userId, outbox, delivery);
  }
  if (path === '/api/auth/ticket' && method === 'POST') return reply(200, (await providerTicket(c, get(q, 'ticket')))[2]);
  if (path === '/api/auth/complete' && method === 'POST') {
    const outbox = [], [userId, delivery] = await providerComplete(c, ctx, q, outbox);
    return startSession(userId, outbox, delivery);
  }
  const token = sessionCookie(request.headers.get('Cookie'));
  const [sessions, users] = await c.reads([
    ['SELECT * FROM sessions WHERE token=? AND expires>?', [sha256hex(token ?? ''), time()]],
    ['SELECT * FROM users WHERE id=(SELECT user_id FROM sessions WHERE token=? AND expires>?)', [sha256hex(token ?? ''), time()]]
  ]);
  const session = sessions[0] ?? null;
  need(session !== null, 'Sign in to continue.', 401);
  let u = users[0] ?? null;
  need(await loginAllowed(c, u), 'Sign in to continue.', 401);
  if (method !== 'GET') need(compareDigest(request.headers.get('X-CSRF-Token') ?? '', session.csrf), 'Invalid request token.', 403);
  if (path === '/api/session' && method === 'GET') {
    const user = {};
    for (const k of ['id', 'username', 'name', 'role', 'person_id']) user[k] = u[k];
    const auth = await authority(c, u);
    return reply(200, { user, csrf: session.csrf, parishes: await parishes(c, u, {}, auth), authority: await sessionAuthority(c, u, auth) });
  }
  if (path === '/api/logout' && method === 'POST') {
    c.run('DELETE FROM sessions WHERE token=?', session.token);
    await c.commit();
    return reply(200, { ok: true }, `pl_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/${secureCookie}`);
  }
  if (path === '/api/account') {
    if (method === 'GET') return reply(200, await accountView(c, ctx, u));
    if (method === 'POST') {
      const outbox = [], result = await accountAction(c, ctx, u, session, q, outbox);
      await c.commit();
      if (outbox.length) {
        await sendOutbox(ctx, outbox);
        result.delivery = outbox[outbox.length - 1].status;
      }
      return reply(200, result);
    }
    throw new Problem(405, 'Method not allowed.');
  }
  if (path === '/api/diocese/documents') {
    if (method === 'GET') return reply(200, await dioceseDocuments(c, u));
    if (method === 'POST') {
      const result = await dioceseDocumentAction(c, u, q);
      await c.commit();
      return reply(200, result);
    }
    throw new Problem(405, 'Method not allowed.');
  }
  if (path === '/api/plans') {
    if (method === 'GET') return reply(200, await plansView(c, u));
    if (method === 'POST') {
      const result = await plansAction(c, u, q);
      await c.commit();
      return reply(200, result);
    }
    throw new Problem(405, 'Method not allowed.');
  }
  if (path === '/api/messages') {
    if (method === 'GET') return reply(200, await messagesList(c, u, {}));
    if (method === 'POST') {
      const result = await messagesAction(c, u, q);
      await c.commit();
      return reply(200, result);
    }
    throw new Problem(405, 'Method not allowed.');
  }
  if (path === '/api/notifications') {
    if (method === 'GET') return reply(200, await accountNotificationsView(c, u));
    if (method === 'POST') {
      const result = accountNotificationsAction(c, u, q);
      await c.commit();
      return reply(200, result);
    }
    throw new Problem(405, 'Method not allowed.');
  }
  if (path === '/api/connections') {
    if (method === 'GET') return reply(200, await connectionsView(c, u));
    if (method === 'POST') {
      const result = await connectionsAction(c, u, q);
      await c.commit();
      return reply(200, result);
    }
    throw new Problem(405, 'Method not allowed.');
  }
  if (path === '/api/oversight' && method === 'GET') return reply(200, { parishes: await oversight(c, u) });
  if (path === '/api/admin') {
    if (method === 'GET') return reply(200, await adminView(c, u));
    if (method === 'POST') {
      const result = await adminAction(c, u, q);
      await c.commit();
      return reply(200, result);
    }
    throw new Problem(405, 'Method not allowed.');
  }
  if (path === '/api/assignments') {
    need(method === 'GET', 'Method not allowed.', 405);
    const auth = await authority(c, u);
    const dioceses = auth.assignments.filter(a => a.role === 'bishop' && a.scope === 'diocese').map(a => a.scope_id);
    need(dioceses.length, 'Archdiocese administration is restricted to the bishop.', 403);
    const inDiocese = new Set((await c.all(`SELECT id FROM parishes WHERE diocese IN (${dioceses.map(() => '?').join(',')})`, ...dioceses)).map(r => r.id));
    const priests = new Map();
    for (const a of await c.all("SELECT r.user_id,r.scope_id,u.name FROM role_assignments r JOIN users u ON u.id=r.user_id WHERE r.role='priest' AND r.scope='parish' AND r.status='active' ORDER BY u.name,r.scope_id")) {
      if (!inDiocese.has(a.scope_id)) continue;
      if (!priests.has(a.user_id)) priests.set(a.user_id, { id: a.user_id, name: a.name, parishes: [] });
      priests.get(a.user_id).parishes.push(a.scope_id);
    }
    return reply(200, { priests: [...priests.values()], parishes: await parishes(c, u, {}, auth) });
  }
  const parts = pathParts(path);
  if (parts.length === 5 && parts[0] === 'api' && parts[1] === 'parishes' && parts[3] === 'files') {
    const [, , pid, , fileId] = parts;
    u = await parishUser(c, u, pid);
    const row = await c.first('SELECT id,parish_id,scope,owner_id,name,mime,size,uploaded_by,created_at FROM uploaded_files WHERE parish_id=? AND id=?', pid, fileId);
    need(row !== null, 'File not found.', 404);
    await file_access(c, u, pid, row.scope, row.owner_id, method === 'DELETE');
    if (method === 'GET') {
      const data = await storedFile(c, row);
      audit(c, u, pid, 'File opened', { file: fileId });
      await c.commit();
      const headers = new Headers({ 'Content-Type': row.mime, 'Content-Length': String(row.size),
        'Content-Disposition': "inline; filename*=UTF-8''" + quote(row.name) });
      for (const [k, v] of Object.entries(HEADERS)) headers.set(k, v);
      return new Response(data, { status: 200, headers });
    }
    if (method === 'DELETE') {
      c.run('DELETE FROM cf_file_chunks WHERE file_id=?', fileId);
      c.run('DELETE FROM uploaded_files WHERE id=? AND parish_id=?', fileId, pid);
      audit(c, u, pid, 'File deleted', { file: fileId, scope: row.scope, owner: row.owner_id });
      await c.commit();
      return reply(200, { ok: true });
    }
    throw new Problem(405, 'Method not allowed.');
  }
  need(parts.length === 4 && parts[0] === 'api' && parts[1] === 'parishes', 'Endpoint not found.', 404);
  const [, , pid, endpoint] = parts;
  u = await parishUser(c, u, pid);
  need(u.role !== 'bishop' || (endpoint === 'oversight' && method === 'GET'), 'Bishop oversight of a parish is read-only.', 403);
  if (endpoint === 'files') {
    if (method === 'GET') {
      const scope = url.searchParams.get('scope') ?? '', ownerId = url.searchParams.get('id') ?? '';
      await file_access(c, u, pid, scope, ownerId);
      const rows = await c.all('SELECT id,name,mime,size,created_at FROM uploaded_files WHERE parish_id=? AND scope=? AND owner_id=? ORDER BY created_at DESC', pid, scope, ownerId);
      return reply(200, { files: rows });
    }
    if (method === 'POST') {
      const scope = get(q, 'scope'), ownerId = get(q, 'id');
      await file_access(c, u, pid, scope, ownerId, true);
      const filename = strip(str(get(q, 'name', '')).replaceAll('\\', '/').split('/').pop());
      need(truthy(filename) && len(filename) <= 180 && ![...filename].some(ch => ch.codePointAt(0) < 32), 'Invalid filename.');
      const extension = filename.includes('.') ? filename.slice(filename.lastIndexOf('.') + 1).toLowerCase() : filename.toLowerCase();
      const mime = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }[extension] ?? null;
      need(mime !== null, 'Only PDF, JPG, and PNG files are supported.');
      need(!['gallery', 'clergy'].includes(scope) || mime.startsWith('image/'), 'Use a JPG or PNG picture.');
      const encoded = get(q, 'data');
      need(typeof encoded === 'string' && len(encoded) <= 13500000, 'File is too large.', 413);
      if (/[^\x00-\x7f]/.test(encoded)) throw new PyError('string argument should contain only ASCII characters');
      /* Validate without decoding the whole file; the bytes are stored as received. */
      let characters;
      try { characters = b64length(encoded); } catch (error) {
        if (error instanceof PyError) throw new Problem(400, 'Invalid file data.');
        throw error;
      }
      const size = Math.floor(characters * 3 / 4);
      need(size > 0 && size <= 10000000, 'File is too large.', 413);
      const head = Buffer.from(encoded.slice(0, 12), 'base64');
      const starts = prefix => size >= prefix.length && prefix.every((byte, i) => head[i] === byte);
      const valid = mime === 'application/pdf' ? starts([0x25, 0x50, 0x44, 0x46, 0x2d])
        : mime === 'image/jpeg' ? starts([0xff, 0xd8, 0xff]) : starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      need(valid, 'File contents do not match the filename.');
      const fileId = tokenUrlsafe(18);
      c.run("INSERT INTO uploaded_files VALUES(?,?,?,?,?,?,?,X'',?,?)", fileId, pid, scope, ownerId, filename, mime, size, u.id, NOW());
      const text = encoded.slice(0, characters);
      for (let i = 0, seq = 0; i < text.length; i += FILE_CHUNK, seq++) c.run('INSERT INTO cf_file_chunks VALUES(?,?,?)', fileId, seq, text.slice(i, i + FILE_CHUNK));
      audit(c, u, pid, 'File uploaded', { file: fileId, scope, owner: ownerId });
      await c.commit();
      return reply(200, { id: fileId, name: filename });
    }
    throw new Problem(405, 'Method not allowed.');
  }
  if (endpoint === 'attendance-preview' && method === 'POST') {
    need(['priest', 'secretary', 'leader'].includes(u.role), 'Group access required.', 403);
    const row = await c.first('SELECT data FROM states WHERE parish_id=?', pid);
    const state = JSON.parse(row.data);
    const gid = get(q, 'groupId');
    const group = iter(K(state, 'GROUPS')).find(item => eq(K(item, 'id'), gid)) ?? null;
    need(group !== null, 'Group not found.', 404);
    if (u.role === 'leader') need(has(set([get(group, 'leader'), get(group, 'assistant')]), u.person_id), 'Group is outside your ministry.', 403);
    return reply(200, { rows: xlsx_preview(get(q, 'data')) });
  }
  if (endpoint === 'oversight' && method === 'GET') return reply(200, await oversight(c, u, pid));
  if (endpoint === 'guest-requests' && method === 'POST') {
    const result = await guestRequestAction(c, u, pid, q);
    await c.commit();
    return reply(200, result);
  }
  if (endpoint === 'ministries' && method === 'POST') {
    const result = await ministryAction(c, u, pid, q);
    await c.commit();
    return reply(200, result);
  }
  if (endpoint === 'connections' && method === 'POST') {
    const outbox = [], base = String(env.PARISHLIFE_PUBLIC_URL || '').replace(/\/+$/, '') || url.origin;
    const result = await officeConnectionAction(c, ctx, u, pid, q, outbox, base);
    await c.commit();
    if (outbox.length) {
      await sendOutbox(ctx, outbox);
      result.delivery = outbox[0].status;
    }
    return reply(200, result);
  }
  if (endpoint === 'member') {
    if (method === 'GET') {
      const view = await member_view(c, u, pid);
      await c.commit();
      return reply(200, view);
    }
    if (method === 'POST') {
      const result = await member_action(c, u, pid, q);
      await c.commit();
      return reply(200, result);
    }
    throw new Problem(405, 'Method not allowed.');
  }
  if (endpoint === 'state' && method === 'GET') {
    const row = await c.first('SELECT * FROM states WHERE parish_id=?', pid);
    return reply(200, { revision: row.revision, d: await visible(c, u, pid, JSON.parse(row.data), { fresh: true, stored: true }) });
  }
  if (endpoint === 'state' && method === 'PUT') {
    const revision = await save_patch(c, u, pid, q);
    await c.commit();
    const row = await c.first('SELECT data FROM states WHERE parish_id=?', pid);
    return reply(200, { revision, d: await visible(c, u, pid, JSON.parse(row.data), { fresh: true, stored: true }) });
  }
  if (endpoint === 'workflow' && method === 'POST') {
    await workflow(c, u, pid, q);
    await c.commit();
    return reply(200, { ok: true });
  }
  throw new Problem(405, 'Method not allowed.');
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
/* Concurrent writers are retried (see db.js); server.py made them wait for its lock. */
const ATTEMPTS = 40;

async function api(request, env, url) {
  const method = request.method;
  let body = null, parsed = {};
  try {
    if (method !== 'GET') {
      const origin = request.headers.get('Origin');
      if (origin) {
        let netloc = '';
        try { netloc = new URL(origin).host; } catch { netloc = ''; }
        need(netloc === request.headers.get('Host'), 'Cross-origin write rejected.', 403);
      }
      need(contentType(request.headers.get('Content-Type')) === 'application/json', 'JSON required.', 415);
      const limit = url.pathname.endsWith('/files') ? 14000000 : 8000000;
      const declared = request.headers.get('Content-Length');
      if (declared !== null && !/^\s*\d+\s*$/.test(declared)) throw new PyError('invalid literal for int()');
      need(declared === null || (Number(declared) > 0 && Number(declared) <= limit), 'Request too large or empty.', 413);
      const bytes = new Uint8Array(await request.arrayBuffer());
      need(bytes.length > 0 && bytes.length <= limit, 'Request too large or empty.', 413);
      body = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      parsed = JSON.parse(body);
      need(isObject(parsed), 'Expected an object.');
    }
  } catch (error) {
    return failure(error);
  }
  try {
    await ensureDatabase(env.DB);
  } catch (error) {
    return failure(error);
  }
  const secureCookie = url.protocol === 'https:' || env.PARISHLIFE_SECURE_COOKIE === '1' ? '; Secure' : '';
  for (let attempt = 1; ; attempt++) {
    const c = new Tx(env.DB);
    try {
      /* The handlers may change the request object, so a retry starts from a fresh copy. */
      return await handle(c, env, request, url, attempt === 1 ? parsed : JSON.parse(body ?? '{}'), secureCookie);
    } catch (error) {
      if (error instanceof Conflict) {
        if (attempt < ATTEMPTS) {
          await delay(Math.random() * Math.min(250, 4 * 2 ** Math.min(attempt, 6)));
          continue;
        }
        return reply(503, { error: 'ParishLife is busy saving other changes. Try again.' });
      }
      if (error instanceof Problem || error instanceof PyError || error instanceof TypeError || error instanceof SyntaxError) {
        /* Before answering an error, make sure it was not caused by a concurrent commit. */
        if (!c.committed && c.seq !== null && attempt < ATTEMPTS) {
          try { await c.reads([]); } catch (check) {
            if (check instanceof Conflict) continue;
          }
        }
      }
      return failure(error);
    }
  }
}
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/* A piece of work in a transaction of its own, run again from the start if another request committed first. */
async function inTransaction(db, work) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work(new Tx(db));
    } catch (error) {
      if (!(error instanceof Conflict) || attempt >= ATTEMPTS) throw error;
      await delay(Math.random() * Math.min(250, 4 * 2 ** Math.min(attempt, 6)));
    }
  }
}

/* Google, Apple and Microsoft send the browser here; every outcome is a redirect back to the sign-in page. */
async function oauth(request, env, url) {
  const [, , , provider, step] = url.pathname.split('/');
  const clear = 'pl_oauth=; Max-Age=0; HttpOnly; Secure; SameSite=None; Path=/api/auth/';
  const ctx = deliveryContext(env, url);
  const secureCookie = url.protocol === 'https:' || env.PARISHLIFE_SECURE_COOKIE === '1' ? '; Secure' : '';
  try {
    await ensureDatabase(env.DB);
    if (step === 'start') {
      need(request.method === 'GET', 'Method not allowed.', 405);
      const intent = url.searchParams.get('intent') ?? 'signin';
      if (providerSettings(env, provider) === null || !['signin', 'signup', 'link'].includes(intent)) return redirect('/index.html?auth_error=unavailable');
      return await inTransaction(env.DB, async c => {
        let userId = null;
        if (intent === 'link') {
          const token = sessionCookie(request.headers.get('Cookie'));
          const u = await c.first('SELECT * FROM users WHERE id=(SELECT user_id FROM sessions WHERE token=? AND expires>?)', sha256hex(token ?? ''), time());
          if (!(await loginAllowed(c, u))) return redirect('/index.html?auth_error=expired');
          userId = u.id;
        }
        const [target, state] = oauthStart(c, env, provider, intent, userId);
        await c.commit();
        return redirect(target, [`pl_oauth=${state}; Max-Age=600; HttpOnly; Secure; SameSite=None; Path=/api/auth/`]);
      });
    }
    let params;
    if (request.method === 'POST') {   // Apple posts its answer as a form
      need(provider === 'apple' && contentType(request.headers.get('Content-Type')) === 'application/x-www-form-urlencoded', 'Method not allowed.', 405);
      const text = await request.text();
      need(text.length > 0 && text.length <= 20000, 'Request too large or empty.', 413);
      params = Object.fromEntries(new URLSearchParams(text));
    } else {
      need(request.method === 'GET', 'Method not allowed.', 405);
      params = Object.fromEntries(url.searchParams);
    }
    const [location, userId] = await oauthFinish(env, provider, params, sessionCookie(request.headers.get('Cookie'), 'pl_oauth'), work => inTransaction(env.DB, work));
    if (userId === null) return redirect(location, [clear]);
    return await inTransaction(env.DB, async c => {
      const u = await c.first('SELECT * FROM users WHERE id=?', userId);
      if (!(await loginAllowed(c, u))) return redirect('/index.html?auth_error=blocked', [clear]);
      if (await mfaTurnedOn(c, ctx, userId)) {
        const token = await mfaChallenge(c, ctx, userId);
        await c.commit();
        return redirect('/index.html?mfa=' + token, [clear]);
      }
      const cookie = newSession(c, userId, secureCookie);
      await c.commit();
      return redirect(location, [clear, cookie]);
    });
  } catch (error) {
    if (!(error instanceof Problem || error instanceof PyError || error instanceof TypeError || error instanceof SyntaxError)) console.error(error);
    return redirect('/index.html?auth_error=failed', [clear]);
  }
}

function failure(error) {
  if (error instanceof Problem) return reply(error.status, { error: error.message });
  if (error instanceof PyError || error instanceof TypeError || error instanceof SyntaxError) {
    if (error instanceof TypeError) console.error(error);
    return reply(400, { error: 'Invalid request data.' });
  }
  console.error(error);
  return reply(500, { error: 'The ParishLife server could not complete this request.' });
}

export default {
  async fetch(request, env) {
    setTimeZone(env.PARISH_TIMEZONE || 'Asia/Beirut');
    const url = new URL(request.url);
    const method = request.method;
    if (/^\/api\/auth\/[a-z]+\/(start|callback)$/.test(url.pathname)) return oauth(request, env, url);
    if (method === 'GET' && url.pathname.startsWith('/api/')) return api(request, env, url);
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') return api(request, env, url);
    if (method === 'GET' || method === 'HEAD') {
      /* The site's address opens the public homepage; the system itself is index.html. */
      if (url.pathname === '/') {
        const asset = await env.ASSETS.fetch(new Request(new URL('/public.html', url), { method }));
        if (asset.ok) {
          const headers = new Headers(asset.headers);
          for (const [k, v] of Object.entries(HEADERS)) headers.set(k, v);
          return new Response(method === 'HEAD' ? null : asset.body, { status: 200, headers });
        }
      }
      return errorPage(404, 'File not found', 'Nothing matches the given URI', method === 'HEAD');
    }
    return errorPage(501, `Unsupported method ('${method}')`, 'Server does not support this operation');
  }
};
