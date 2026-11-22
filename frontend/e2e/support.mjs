/* Purpose: shared helpers for the signed-in end-to-end tests.
   Main functions: manifest (the fixture accounts the test-only host wrote), totp (the current authenticator
   code for a Base32 key), watch (collects page errors, failing API calls and "not connected" screens),
   settle (waits until no request is in flight), turnstileToken (waits for the bot check), signIn (the check
   when Turnstile is on, the password, then the authenticator code when asked), test (Playwright's test with every request to
   another host answered locally: the suite never needs the internet), outbox (the codes the test host "emailed").
   Offline stand-ins: Cloudflare's widget script is replaced by one that behaves like its dummy site key (the dummy token, which the
   test host's offline siteverify accepts), accounts.google.com answers a blank page, and any other outside request is refused. The
   page policy still applies to each of them, because the browser checks it before a request is routed. */
import { createHmac } from 'node:crypto';
import { test as base, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

export const NOT_CONNECTED = "isn't connected to the new backend yet";

export function manifest() {
  const file = process.env.E2E_MANIFEST;
  if (!file) throw new Error('E2E_MANIFEST is not set: run the tests with `npm run e2e`.');
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function totp(secret, at = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.replace(/=+$/, '')) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map(b => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigInt64BE(BigInt(Math.floor(at / 30000)));
  const hash = createHmac('sha1', key).update(counter).digest();
  const offset = hash[hash.length - 1] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}

/* Everything a screen does wrong, labelled with the screen it happened on. */
export function watch(page) {
  const state = { where: 'start', problems: [], notes: [], inflight: 0, last: Date.now() };
  const label = text => `[${state.where}] ${text}`;
  page.on('pageerror', error => state.problems.push(label('page error: ' + error.message)));
  page.on('console', message => {
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text()))
      state.problems.push(label('console error: ' + message.text().slice(0, 400)));
  });
  page.on('request', () => {
    state.inflight++;
    state.last = Date.now();
  });
  const done = () => {
    state.inflight = Math.max(0, state.inflight - 1);
    state.last = Date.now();
  };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  page.on('response', response => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith('/api/')) return;
    const line = `${response.request().method()} ${url.pathname} → ${response.status()}`;
    // 429: a single person's normal use hit a rate limit (each test is its own client)
    if (response.status() >= 500 || response.status() === 400 || response.status() === 429)
      state.problems.push(label(line));
    else if (response.status() >= 403 && response.status() !== 409) state.notes.push(label(line));
  });
  return state;
}

export async function settle(page, state, quiet = 400, max = 6000) {
  const start = Date.now();
  while (Date.now() - start < max) {
    if (state.inflight === 0 && Date.now() - state.last >= quiet) return;
    await page.waitForTimeout(100);
  }
}

/* The 30-second authenticator step each account last signed in with: a second sign-in by the same
   account (the sign-out test) waits for a fresh code instead of replaying one. */
const usedStep = new Map();

/* With Turnstile on, the widget's token must be there before the form is sent, as for a person. */
export async function turnstileToken(page) {
  await expect(page.locator('[data-turnstile] input[name="cf-turnstile-response"]')).not.toHaveValue('', {
    timeout: 30000
  });
}

export async function signIn(page, state, account, secret, password, turnstile = false) {
  state.where = 'sign-in ' + account.username;
  await page.locator('input[name="username"]').fill(account.username);
  await page.locator('input[name="password"]').fill(password);
  if (turnstile) await turnstileToken(page);
  await page.locator('button.auth-submit').click();
  const code = page.locator('input[name="code"]');
  const shell = page.locator('nav.rail-nav');
  await code.or(shell).first().waitFor({ timeout: 30000 });
  if (await code.isVisible()) {
    while (usedStep.get(account.username) === Math.floor(Date.now() / 30000)) await page.waitForTimeout(1000);
    usedStep.set(account.username, Math.floor(Date.now() / 30000));
    await code.fill(totp(secret));
    await page.locator('button.auth-submit').click();
  }
  await shell.waitFor({ timeout: 30000 });
  await settle(page, state);
}

const WIDGET = `(() => {
  const boxes = [];
  window.turnstile = {
    render(box, options) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'cf-turnstile-response';
      box.append(input);
      boxes.push({ input, options });
      window.turnstile.reset(boxes.length - 1);
      return boxes.length - 1;
    },
    reset(id) {
      const box = boxes[id];
      if (!box) return;
      box.input.value = '';
      setTimeout(() => {
        box.input.value = 'XXXX.DUMMY.TOKEN.XXXX';
        box.options.callback?.(box.input.value);
      }, 50);
    },
    getResponse: id => boxes[id]?.input.value,
    remove() {}
  };
})();`;

/* Requests to any host but the test host never leave the machine. */
export async function offline(context, baseUrl) {
  await context.route(
    url => url.protocol.startsWith('http') && url.origin !== baseUrl,
    route => {
      const url = new URL(route.request().url());
      if (url.host === 'challenges.cloudflare.com' && url.pathname === '/turnstile/v0/api.js')
        return route.fulfill({ contentType: 'text/javascript', body: WIDGET });
      if (url.host === 'accounts.google.com')
        return route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><title>Google (offline stand-in)</title>'
        });
      return route.abort('internetdisconnected');
    }
  );
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await offline(context, manifest().baseUrl);
    await use(context);
  }
});

/* The newest code the test host "emailed" to an address for a purpose (ConfirmEmail, ResetPassword, ChangeEmail). */
export async function outbox(email, purpose, after = 0) {
  const file = manifest().outbox;
  for (let i = 0; i < 100; i++) {
    const lines = existsSync(file)
      ? readFileSync(file, 'utf8')
          .trim()
          .split('\n')
          .filter(Boolean)
          .map(l => JSON.parse(l))
      : [];
    const found = lines.slice(after).filter(m => m.email === email && m.purpose === purpose);
    if (found.length) return found.at(-1).code;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`no ${purpose} code reached the test inbox for ${email}`);
}

/* How many messages the test inbox holds now (to look only at newer ones). */
export const outboxSize = () => {
  const file = manifest().outbox;
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).length : 0;
};
