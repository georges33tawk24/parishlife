/* Purpose: runs the signed-in end-to-end tests in one command: builds the frontend, starts the test-only
   host (ParishLife.EndToEnd: the real API on https://localhost with isolated temporary storage, the built
   pages and fixture accounts for every role), runs Playwright, then stops the host, which deletes its
   temporary data.
   Main steps: build (skip with --no-build), start the host and wait for "E2E READY", run the tests with
   E2E_MANIFEST set, close the host's stdin. Turnstile runs with Cloudflare's test keys unless E2E_TURNSTILE=0. Extra arguments go to Playwright (for example --grep priest).
   The host's certificate (the untrusted local development certificate) is accepted by its public-key hash only (E2E_CERT_SPKI):
   Chromium then fetches the service-worker script from the test host, and nothing else is trusted; no system setting changes. */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { connect } from 'node:tls';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = fileURLToPath(new URL('..', import.meta.url));
const repo = join(frontend, '..');
const args = process.argv.slice(2);
const build = !args.includes('--no-build');
const extra = args.filter(a => a !== '--no-build');
const port = process.env.E2E_PORT || '7311';
const shell = process.platform === 'win32';

if (build) {
  const built = spawnSync('npm', ['run', 'build'], { cwd: frontend, stdio: 'inherit', shell });
  if (built.status !== 0) process.exit(built.status ?? 1);
}

const work = mkdtempSync(join(tmpdir(), 'parishlife-e2e-run-'));
const manifest = join(work, 'manifest.json');
const host = spawn(
  'dotnet',
  [
    'run',
    '--project',
    join(repo, 'ParishLife.EndToEnd'),
    '--',
    '--manifest',
    manifest,
    '--port',
    port,
    // Cloudflare's Turnstile test keys: every sign-in goes through the real widget and siteverify (E2E_TURNSTILE=0 to skip)
    ...(process.env.E2E_TURNSTILE === '0' ? [] : ['--turnstile-test-keys'])
  ],
  { cwd: repo, stdio: ['pipe', 'pipe', 'inherit'] }
);

let log = '';
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('The end-to-end host did not start within 4 minutes.')), 240_000);
  host.stdout.on('data', chunk => {
    log = (log + chunk).slice(-8000); // drained for the whole run, kept short
    if (log.includes('E2E READY')) {
      clearTimeout(timer);
      resolve();
    }
  });
  host.on('exit', code => {
    clearTimeout(timer);
    reject(new Error('The end-to-end host stopped (exit ' + code + ') before it was ready.\n' + log.slice(-4000)));
  });
});

let status = 1;
try {
  await ready;
  const spki = await new Promise((resolve, reject) => {
    const socket = connect(
      { host: 'localhost', port: Number(port), servername: 'localhost', rejectUnauthorized: false },
      () => {
        resolve(createHash('sha256').update(socket.getPeerCertificate().pubkey).digest('base64'));
        socket.end();
      }
    );
    socket.on('error', reject);
  });
  // Asynchronous on purpose: a blocking spawnSync would stop this process from draining the host's
  // output, and a host whose output pipe is full stops answering requests.
  const run = spawn('npx', ['playwright', 'test', ...extra], {
    cwd: frontend,
    stdio: 'inherit',
    shell,
    env: { ...process.env, E2E_MANIFEST: manifest, E2E_CERT_SPKI: spki }
  });
  status = await new Promise(resolve => run.on('exit', code => resolve(code ?? 1)));
} catch (error) {
  console.error(error.message);
} finally {
  host.stdin.end(); // the host stops and deletes its isolated data
  await new Promise(resolve => (host.exitCode !== null ? resolve() : host.on('exit', resolve)));
  rmSync(work, { recursive: true, force: true });
}
process.exit(status);
