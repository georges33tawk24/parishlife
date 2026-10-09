/* Runs the Worker's server logic for the Python test suite (see pyshim/server.py).
   One JSON request per line on stdin, one JSON reply per line on stdout. */
import { createInterface } from 'node:readline';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { LocalD1 } from './d1-sqlite.mjs';
import { Tx } from '../src/db.js';
import { Problem, PyError, setTimeZone, overrideToday } from '../src/py.js';
import { initialize, save_patch, workflow, visible, oversight, file_access, audit } from '../src/app.js';
import { member_view, member_action } from '../src/member.js';
import { xlsx_preview } from '../src/xlsx.js';
import { migrate_state, validate } from '../src/state.js';
import worker from '../src/worker.js';

setTimeZone(process.env.PARISH_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone);

/* The files Workers Static Assets would publish (see .assetsignore). */
const published = path => path === 'index.html' || path === 'landing.html' || path === 'public.html'
  || /^assets\/.+\.(js|css)$/.test(path) || /^assets\/images\/.+\.(jpg|jpeg|png|webp)$/.test(path)
  || /^assets\/fonts\/.+\.woff2$/.test(path);

async function inTx(dbPath, fn, commit = true) {
  const db = new LocalD1(dbPath);
  try {
    const c = new Tx(db);
    const result = await fn(c);
    if (commit) await c.commit();
    return result;
  } finally {
    db.close();
  }
}

const calls = {
  init_db: ({ db }) => { const d1 = new LocalD1(db); return initialize(d1, true).finally(() => d1.close()); },
  save_patch: ({ db, args: [u, pid, payload] }) => inTx(db, c => save_patch(c, u, pid, payload)),
  workflow: ({ db, args: [u, pid, q] }) => inTx(db, c => workflow(c, u, pid, q)),
  visible: ({ db, args: [u, pid, d] }) => inTx(db, c => visible(c, u, pid, d), false),
  oversight: ({ db, args: [u, pid] }) => inTx(db, c => oversight(c, u, pid ?? null), false),
  file_access: ({ db, args: [u, pid, scope, owner, write] }) => inTx(db, c => file_access(c, u, pid, scope, owner, write ?? false), false),
  member_view: ({ db, args: [u, pid] }) => inTx(db, c => member_view(c, u, pid)),
  member_action: ({ db, args: [u, pid, q] }) => inTx(db, c => member_action(c, u, pid, q)),
  xlsx_preview: ({ args: [encoded] }) => xlsx_preview(encoded),
  migrate_state: ({ args: [d] }) => migrate_state(d),
  validate: ({ args: [d] }) => { validate(d); return null; },
  http: async ({ db, root, args: [method, path, headers, body] }) => {
    const d1 = new LocalD1(db);
    const env = {
      DB: d1,
      PARISH_TIMEZONE: process.env.PARISH_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone,
      ASSETS: { fetch: async request => {
        const url = new URL(request.url);
        let relative;
        try { relative = decodeURIComponent(url.pathname).replace(/^\/+/, ''); } catch { return new Response('', { status: 404 }); }
        const clean = normalize(relative);
        const file = join(root, clean);
        if (clean !== relative || !published(clean) || !existsSync(file) || !statSync(file).isFile()) return new Response('', { status: 404 });
        return new Response(request.method === 'HEAD' ? null : readFileSync(file), { status: 200, headers: { 'Content-Type': 'application/octet-stream' } });
      } }
    };
    try {
      const url = 'http://' + (headers.Host || headers.host || '127.0.0.1') + path;
      const decodedPath = (() => { try { return decodeURIComponent(new URL(url).pathname).replace(/^\/+/, ''); } catch { return null; } })();
      let response;
      if ((method === 'GET' || method === 'HEAD') && decodedPath !== null && !path.startsWith('/api/') && path !== '/' && published(normalize(decodedPath)) && normalize(decodedPath) === decodedPath) {
        response = await env.ASSETS.fetch(new Request(url, { method }));
        if (response.status === 200) {
          const h = new Headers(response.headers);
          for (const [k, v] of Object.entries({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' })) h.set(k, v);
          response = new Response(response.body, { status: 200, headers: h });
        } else response = await worker.fetch(new Request(url, { method, headers }), env);
      } else {
        response = await worker.fetch(new Request(url, { method, headers, body: body === null ? undefined : body }), env);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      return { status: response.status, headers: Object.fromEntries(response.headers), body: bytes.toString('base64') };
    } finally {
      d1.close();
    }
  }
};

const out = message => process.stdout.write(JSON.stringify(message) + '\n');
const lines = createInterface({ input: process.stdin });
let queue = Promise.resolve();
lines.on('line', line => {
  queue = queue.then(async () => {
    const request = JSON.parse(line);
    overrideToday(request.today);
    try {
      out({ id: request.id, ok: (await calls[request.fn](request)) ?? null });
    } catch (error) {
      if (error instanceof Problem) out({ id: request.id, problem: [error.status, error.message] });
      else if (error instanceof PyError || error instanceof TypeError) out({ id: request.id, pyerror: String(error.stack || error) });
      else out({ id: request.id, error: String(error.stack || error) });
    }
  });
});
