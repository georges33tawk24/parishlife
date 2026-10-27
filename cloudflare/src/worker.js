import { accountGuestFile } from './guest-links.js';
import { accountSecurity } from './account-security.js';
import { recordFailure, sensitiveEndpoints } from './administration.js';
import { publicGuestFile } from './guest-delivery.js';
import { requestDocuments } from './office.js';
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
import { member_view, member_action } from './member.js';
import { loginName, signup } from './accounts.js';
import { xlsx_preview } from './xlsx.js';
import { initializeWorkspace, workspaceHandle, workspaceSignup, loginUser, sessionData, suspended, publicProfile, parishContext, isOffice } from './workspace.js';

// Accounts created by the parishlife-v2 line carry the role "user"; they sign in as members.
const SIGN_IN_ROLES = new Set([...ROLES, 'user']);
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

/* http.cookies.SimpleCookie(header).get('pl_session') */
function sessionCookie(header) {
  let value = null;
  for (const part of (header || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== 'pl_session') continue;
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

async function storedFile(c, row) {
  const chunks = await c.all('SELECT data FROM cf_file_chunks WHERE file_id=? ORDER BY seq', row.id);
  return Buffer.from(chunks.map(chunk => chunk.data).join(''), 'base64');
}

/* One attempt at server.py's api(): every database read and write of the request
   runs in `c`, committed together unless a Problem or error is raised first. */
async function handle(c, env, request, url, q, secureCookie) {
  q={...q};
  delete q._recentAuthentication;
  const method = request.method;
  const path = url.pathname;
  if(path.startsWith('/api/public/guest-files/')&&method==='GET'){
    const parts=pathParts(path);need(parts.length===5,'Document not found.',404);
    const file=await publicGuestFile(c,parts[3],parts[4]),data=await storedFile(c,file);
    return new Response(data,{headers:{...HEADERS,'Referrer-Policy':'no-referrer','Content-Type':file.mime,'Content-Disposition':"attachment; filename*=UTF-8''"+quote(file.name)}});
  }
  if(path.startsWith('/api/public/')){
    const result=await workspaceHandle(c,null,path,method,q);
    if(result!==null){await c.commit();return reply(200,result);}
  }
  if (path === '/api/public/parishes' && method === 'GET') {
    const rows = await c.all('SELECT p.id,p.metadata,d.name AS diocese FROM parishes p JOIN dioceses d ON d.id=p.diocese');
    return reply(200, { parishes: rows.map(row => {
      const meta = JSON.parse(row.metadata);
      return { id: row.id, diocese:row.diocese, name: get(meta, 'name', ''), ar: get(meta, 'ar', ''), town: get(meta, 'town', ''), townAr: get(meta, 'townAr', '') };
    }) });
  }
  if (path.startsWith('/api/public/parishes/') && method === 'GET') {
    const publicId = path.slice(path.lastIndexOf('/') + 1);
    const row = await c.first('SELECT data FROM states WHERE parish_id=?', publicId);
    need(row !== null, 'Parish not found.', 404);
    const publicState = JSON.parse(row.data);
    const parish = K(publicState, 'PARISH');
    const content = {};
    for (const [key, item] of items(get(publicState, 'CONTENT', {}))) {
      if (isObject(item) && truthy(get(item, 'published', true))) content[key] = { en: get(item, 'en', ''), ar: get(item, 'ar', '') };
    }
    const events = [];
    for (const event of iter(get(publicState, 'EVENTS', []))) {
      const detail = get(get(publicState, 'EVENT_DETAIL', {}), get(event, 'id'), {});
      if (eq(get(event, 'kind'), 'pending') || (!eq(get(detail, 'visibility'), 'public') &&
        !(!truthy(detail) && has(new Set(['mass', 'event']), get(event, 'kind'))))) continue;
      const item = {};
      for (const key of ['id', 'd', 't', 'title', 'titleAr', 'kind']) item[key] = get(event, key, '');
      events.push(item);
    }
    const postRows = await c.all("SELECT title,body,created_at FROM member_content WHERE parish_id=? AND group_id IS NULL AND kind IN ('post','announcement') ORDER BY created_at DESC LIMIT 8", publicId);
    const posts = postRows.map(item => ({ title: item.title, body: item.body, at: item.created_at }));
    for (const n of iter(get(publicState, 'NOTICES', []))) {
      if (eq(get(n, 'audience'), 'Parish') && !truthy(get(n, 'groupId'))) posts.push({ title: get(n, 'title', ''), body: get(n, 'ar', ''), at: get(n, 'at', '') });
    }
    const orderedPosts = sorted(posts, item => item.at, true);
    const publicParish = {};
    for (const key of ['name', 'nameAr', 'town', 'townAr', 'rite', 'riteAr', 'address', 'addressAr', 'phone']) publicParish[key] = get(parish, key, '');
    publicParish.theme = parish_theme(parish);
    if (!truthy(get(content, 'contact'))) Object.assign(publicParish, { address: '', addressAr: '', phone: '' });
    return reply(200, { parish: publicParish, content, events, posts: orderedPosts, ...await publicProfile(c,publicId,publicState) });
  }
  const startSession = async userId => {
    const token = tokenUrlsafe(32), csrf = tokenUrlsafe(32);
    c.run('DELETE FROM sessions WHERE expires<?', time());
    c.run('INSERT INTO sessions VALUES(?,?,?,?)', sha256hex(token), userId, csrf, time() + 28800);
    await c.commit();
    return reply(200, { ok: true }, `pl_session=${token}; HttpOnly; SameSite=Strict; Path=/${secureCookie}`);
  };
  if (path === '/api/login' && method === 'POST') {
    const u = await loginUser(c,q);
    need(u !== null && SIGN_IN_ROLES.has(u.role) && passwordMatches(u.password, str(get(q, 'password', ''))), 'Incorrect username or password.', 401);
    return startSession(u.id);
  }
  if (path === '/api/signup' && method === 'POST') return startSession(await workspaceSignup(c, q));
  const token = sessionCookie(request.headers.get('Cookie'));
  const [sessions, users] = await c.reads([
    ['SELECT * FROM sessions WHERE token=? AND expires>?', [sha256hex(token ?? ''), time()]],
    ['SELECT * FROM users WHERE id=(SELECT user_id FROM sessions WHERE token=? AND expires>?)', [sha256hex(token ?? ''), time()]]
  ]);
  const session = sessions[0] ?? null;
  need(session !== null, 'Sign in to continue.', 401);
  let u = users[0] ?? null;
  need(u !== null && SIGN_IN_ROLES.has(u.role), 'Sign in to continue.', 401);
  need(!await suspended(c,u.id),'This account is inactive.',403);
  if (method !== 'GET') need(compareDigest(request.headers.get('X-CSRF-Token') ?? '', session.csrf), 'Invalid request token.', 403);
  if (path === '/api/session' && method === 'GET') {
    const user = {};
    for (const k of ['id', 'username', 'name', 'role', 'person_id']) user[k] = u[k];
    const details=await sessionData(c,u);
    user.role=details.platformRole;
    return reply(200, { user, csrf: session.csrf, parishes: await parishes(c, u), ...details });
  }
  if (path === '/api/logout' && method === 'POST') {
    c.run('DELETE FROM sessions WHERE token=?', session.token);
    await c.commit();
    return reply(200, { ok: true }, `pl_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/${secureCookie}`);
  }
  if(path.startsWith('/api/account/guest-files/')&&method==='GET'){
    const parts=path.slice(1).split('/');need(parts.length===5,'File not found.',404);
    const file=await accountGuestFile(c,u,parts[3],parts[4]),data=await storedFile(c,file);
    return new Response(data,{headers:{...HEADERS,'Referrer-Policy':'no-referrer','Content-Type':file.mime,'Content-Disposition':"attachment; filename*=UTF-8''"+quote(file.name)}});
  }
  if (method === 'POST' && (path === '/api/workspace/grants' && q.role === 'super_admin' || path === '/api/workspace/suspension' && q.scope === 'global')) {
    need(passwordMatches(u.password, String(q.currentPassword || '')), 'Your current password is not correct.', 403);
    q._recentAuthentication = true;
  }
  const securityResult=await accountSecurity(c,u,path,method,q,session.token);
  if(securityResult!==null){await c.commit();return reply(200,securityResult);}
  const workspaceResult=await workspaceHandle(c,u,path,method,method==='GET'?Object.fromEntries(url.searchParams):q);
  if(workspaceResult!==null){await c.commit();return reply(200,workspaceResult);}
  if (path === '/api/oversight' && method === 'GET') return reply(200, { parishes: await oversight(c, u) });
  if (path === '/api/assignments') {
    need(u.role === 'bishop', 'Archdiocese administration is restricted to the bishop.', 403);
    need(method === 'GET', 'Bishop oversight is read-only.', 403);
    const priests = await c.all("SELECT * FROM users WHERE role='priest' AND diocese=?", u.diocese);
    const assigned = priests.length ? await c.reads(priests.map(x => ['SELECT parish_id FROM assignments WHERE user_id=?', [x.id]])) : [];
    return reply(200, { priests: priests.map((x, i) => ({ id: x.id, name: x.name, parishes: assigned[i].map(r => r.parish_id) })), parishes: await parishes(c, u) });
  }
  const parts = pathParts(path);
  if(parts.length>=3 && parts[0]==='api' && parts[1]==='parishes'){
    const context=await parishContext(c,u,parts[2]);
    need(context,'This parish is not assigned to your account or is inactive.',403);u=context;
  }
  if (parts.length === 5 && parts[0] === 'api' && parts[1] === 'parishes' && parts[3] === 'files') {
    const [, , pid, , fileId] = parts;
    await access(c, u, pid);
    const row = await c.first('SELECT id,parish_id,scope,owner_id,name,mime,size,uploaded_by,created_at,requirement FROM uploaded_files WHERE parish_id=? AND id=?', pid, fileId);
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
      if(['service-request','sacrament-request'].includes(row.scope))await requestDocuments(c,u,pid,{scope:row.scope,id:row.owner_id,requirement:row.requirement,revision:q.revision},{removed:fileId});
      audit(c, u, pid, 'File deleted', { file: fileId, scope: row.scope, owner: row.owner_id });
      await c.commit();
      return reply(200, { ok: true });
    }
    throw new Problem(405, 'Method not allowed.');
  }
  need(parts.length === 4 && parts[0] === 'api' && parts[1] === 'parishes', 'Endpoint not found.', 404);
  const [, , pid, endpoint] = parts;
  await access(c, u, pid);
  if(endpoint==='request-documents'&&method==='POST'){await requestDocuments(c,u,pid,q);await c.commit();return reply(200,{ok:true});}
  if (endpoint === 'files') {
    if (method === 'GET') {
      const scope = url.searchParams.get('scope') ?? '', ownerId = url.searchParams.get('id') ?? '';
      await file_access(c, u, pid, scope, ownerId);
      const rows = await c.all('SELECT id,name,mime,size,created_at,requirement FROM uploaded_files WHERE parish_id=? AND scope=? AND owner_id=? ORDER BY created_at DESC', pid, scope, ownerId);
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
      const requirement=q.requirement??'',replaced=q.replaceId;
      need(typeof requirement==='string'&&requirement.length<=120,'Invalid document requirement.');
      if(replaced){
        const old=await c.first('SELECT * FROM uploaded_files WHERE id=? AND parish_id=?',replaced,pid);
        need(old&&old.scope===scope&&old.owner_id===ownerId&&old.requirement===requirement,'The replacement must belong to the same record and requirement.');
        c.run('DELETE FROM cf_file_chunks WHERE file_id=?',replaced);c.run('DELETE FROM uploaded_files WHERE id=?',replaced);
      }
      c.run("INSERT INTO uploaded_files(id,parish_id,scope,owner_id,name,mime,size,data,uploaded_by,created_at,requirement) VALUES(?,?,?,?,?,?,?,X'',?,?,?)", fileId, pid, scope, ownerId, filename, mime, size, u.id, NOW(),requirement);
      if(['service-request','sacrament-request'].includes(scope))await requestDocuments(c,u,pid,{scope,id:ownerId,requirement,revision:q.revision},{added:true,removed:replaced});
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

async function auditAdministrativeFailure(request,env,url,query,status,requestId){
  if(request.method==='GET'||!url.pathname.startsWith('/api/workspace/')||!sensitiveEndpoints.includes(url.pathname.split('/').at(-1)))return;
  const cookie=sessionCookie(request.headers.get('Cookie'));
  if(!cookie)return;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const transaction=new Tx(env.DB);
      const actor=await transaction.first('SELECT u.*,s.csrf FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?',sha256hex(cookie),time());
      if(!actor||!compareDigest(request.headers.get('X-CSRF-Token')||'',actor.csrf))return;
      await recordFailure(transaction,actor,url.pathname,query,status,requestId);
      await transaction.commit();
      return;
    }catch(error){
      if(error instanceof Conflict)continue;
      console.error('An administrative rejection could not be audited. Request '+requestId);
      return;
    }
  }
  console.error('Administrative rejection audit remained busy. Request '+requestId);
}

async function api(request, env, url,requestId) {
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
    await initializeWorkspace(env.DB);
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
      const rejectionStatus=error instanceof Problem?error.status:String(error?.message||error).includes('last-active-super-admin')||String(error?.message||error).includes('invalid-administrative-assignment')?409:null;
      if(rejectionStatus)await auditAdministrativeFailure(request,env,url,parsed,rejectionStatus,requestId);
      return failure(error);
    }
  }
}
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

async function tracedApi(request,env,url){
  const requestId=tokenUrlsafe(12);
  const response=await api(request,env,url,requestId);
  const headers=new Headers(response.headers);
  headers.set('X-Request-ID',requestId);
  return new Response(response.body,{status:response.status,headers});
}

function failure(error) {
  if (String(error?.message||error).includes('last-active-super-admin')) return reply(409,{error:'The last active Super Admin cannot be removed or deactivated.'});
      if (String(error?.message||error).includes('invalid-administrative-assignment')) return reply(409,{error:'This change conflicts with existing records or an invalid assignment.'});
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
    if (method === 'GET' && url.pathname.startsWith('/api/')) return tracedApi(request, env, url);
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') return tracedApi(request, env, url);
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
