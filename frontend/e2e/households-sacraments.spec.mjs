/* Purpose: browser checks of the owner's households and group sacrament requests (27 November 2026), signed in as the
   secretary against the real API, in English and Arabic.
   Main checks: the New household drawer is wide, refuses digits in the name, finds members with the server search (two
   characters, chips) and keeps Create unpressable until a contact is chosen; a member's role is set on the household page and
   stored on the membership; first communion and confirmation take several candidates in one request and report each person,
   while baptism keeps a single person. The people they need are created through the API here (no seed data). */
import { expect } from '@playwright/test';
import { client, manifest, settle, signIn, test, watch } from './support.mjs';

const M = manifest();

/* A family name of letters only (household names refuse digits), different for every run. */
const family = () =>
  'Zq' + Array.from({ length: 6 }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]).join('');

/* One API call from the signed-in page, with the CSRF token. */
const call = (page, path, method = 'GET', body = undefined) =>
  page.evaluate(
    async ([path, method, body]) => {
      const { token } = await (await fetch('/api/auth/csrf')).json();
      const response = await fetch('/api/' + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token },
        body: body ? JSON.stringify(body) : undefined
      });
      return response.status === 204 ? null : response.json();
    },
    [path, method, body]
  );

const person = (page, given, familyName) =>
  call(page, `parishes/${M.parishId}/people`, 'POST', {
    operationId: crypto.randomUUID(),
    givenName: given,
    familyName,
    birthDate: '2015-04-02',
    contact: null
  });

async function open(page, state, hash) {
  await page.evaluate(h => (location.hash = h), hash);
  await settle(page, state);
}

async function start(page, n) {
  await client(page, n);
  const state = watch(page);
  // English first; arabic() switches later, so the first load alone sets the language
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-lang')) {
      sessionStorage.setItem('e2e-lang', '1');
      localStorage.setItem('pl-lang', 'en');
    }
  });
  await page.goto(M.baseUrl + '/index.html');
  await signIn(page, state, M.accounts.secretary, M.totpSecret, M.password, M.turnstile);
  return state;
}

async function arabic(page, state) {
  await page.evaluate(() => localStorage.setItem('pl-lang', 'ar'));
  await page.reload();
  await page.locator('nav.rail-nav').waitFor();
  await settle(page, state);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
}

/* An enhanced dropdown: its button opens the list, then the option is chosen by its text. */
async function choose(page, id, text) {
  await page.locator(`#${id}-dd`).click();
  await page.getByRole('option', { name: text, exact: true }).click();
}

test('households: wide drawer, digit-free name, server member search, contact before Create, member roles', async ({
  page
}) => {
  const state = await start(page, 130);
  const name = family();
  const rana = await person(page, 'Rana', name);
  const elie = await person(page, 'Elie', name);
  await page.reload();
  await page.locator('nav.rail-nav').waitFor();
  await open(page, state, '#/households');

  await page.locator('[data-act="household-new"]').first().click();
  await expect(page.locator('.drawer.open.drawer-lg')).toBeVisible();
  await page.locator('#cf_name').pressSequentially(name + '7');
  await expect(page.locator('#cf_name')).toHaveValue(name);
  await expect(page.getByText('A household name cannot contain digits.')).toBeVisible();

  const search = page.locator('#cf_members-q');
  await search.fill('Z');
  await expect(page.getByText('Type at least 2 letters to search.')).toBeVisible();
  await expect(page.locator('[data-candidate]')).toHaveCount(0);
  await search.fill(name);
  await expect(page.locator('[data-candidate]')).toHaveCount(2);
  await page.locator(`[data-candidate="${rana.id}"]`).click();
  await page.locator(`[data-candidate="${elie.id}"]`).click();
  await expect(page.locator('#cf_members [data-chosen]')).toHaveCount(2);
  await expect(page.locator('#cf_save')).toBeDisabled();
  await choose(page, 'cf_town', 'Hadath');
  await choose(page, 'cf_head', `Rana ${name}`);
  await expect(page.locator('#cf_save')).toBeEnabled();
  await page.locator('#cf_save').click();
  await expect(page.getByText('Household created')).toBeVisible();
  await settle(page, state);

  const list = await call(page, `parishes/${M.parishId}/households?size=100`);
  const made = list.items.map(row => row.value).find(h => h.name === name);
  expect(made.contactPersonId).toBe(rana.id);
  expect(made.members.map(m => m.personId).sort()).toEqual([rana.id, elie.id].sort());

  await open(page, state, `#/household/${made.id}`);
  await choose(page, `hh-role-${elie.id}`, 'Spouse');
  await expect(page.getByText('Role saved')).toBeVisible();
  await settle(page, state);
  const stored = await call(page, `parishes/${M.parishId}/households/${made.id}`);
  expect(stored.value.members.find(m => m.personId === elie.id).role).toBe('Spouse');
  const record = await call(page, `parishes/${M.parishId}/people/${elie.id}`);
  expect(JSON.stringify(record).toLowerCase()).not.toContain('"role"');

  await arabic(page, state);
  await open(page, state, `#/household/${made.id}`);
  await expect(page.locator(`#hh-role-${elie.id}-dd`)).toHaveText('زوج/زوجة');
  await open(page, state, '#/households');
  await page.locator('[data-act="household-new"]').first().click();
  await expect(page.locator('.drawer.open.drawer-lg')).toBeVisible();
  await page.locator('#cf_members-q').fill('Z');
  await expect(page.getByText('اكتب 2 أحرف على الأقل للبحث.')).toBeVisible();
  await page.locator('#cf_members-q').fill(name);
  await expect(page.locator('[data-candidate]')).toHaveCount(2);
  await expect(page.locator('[data-candidate]').first()).toBeDisabled(); // already in a household
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});

test('sacraments: several confirmation candidates in one request with per-person results; baptism stays single', async ({
  page
}) => {
  const state = await start(page, 131);
  const name = family();
  const people = [];
  for (const given of ['Maya', 'Joe', 'Lea']) people.push(await person(page, given, name));
  await call(page, `parishes/${M.parishId}/sacraments`, 'POST', {
    operationId: crypto.randomUUID(),
    sacrament: 'Confirmation',
    subjectPersonId: people[2].id,
    facts: {}
  });
  await page.reload();
  await page.locator('nav.rail-nav').waitFor();
  await open(page, state, '#/requests');

  await page.locator('#newsacreq').first().click();
  await expect(page.locator('#srq-existing')).toBeVisible();
  await choose(page, 'srq_kind', 'Confirmation (Chrismation)');
  await expect(page.locator('#srq-group')).toBeVisible();
  await expect(page.locator('#srq-existing')).toBeHidden();
  await page.locator('#srq_people-q').fill(name);
  await expect(page.locator('[data-candidate]')).toHaveCount(3);
  for (const p of people) await page.locator(`[data-candidate="${p.id}"]`).click();
  await page.locator('#srq_celebrant').fill('Fr. Isolated');
  await page.locator('#srq_place').fill('Isolated church');
  await page.locator('#srq_save').click();
  await expect(page.locator('#srq-results')).toBeVisible();
  await expect(page.locator('[data-batch-result="created"]')).toHaveCount(2);
  await expect(page.locator('[data-batch-result="failed"]')).toHaveCount(1);
  await expect(page.locator('#srq-results')).toContainText(
    'Already has an open or registered request for this sacrament.'
  );
  await settle(page, state);

  const found = await call(page, `parishes/${M.parishId}/sacraments?sacrament=Confirmation&size=100`);
  const opened = found.items
    .map(row => row.value)
    .filter(r => people.slice(0, 2).some(p => p.id === r.subjectPersonId));
  expect(opened).toHaveLength(2);
  expect(new Set(opened.map(r => r.batchId)).size).toBe(1);
  expect(opened[0].facts.requestedCelebrant).toBe('Fr. Isolated');

  await page.keyboard.press('Escape');
  await arabic(page, state);
  await open(page, state, '#/requests');
  await page.locator('#newsacreq').first().click();
  await choose(page, 'srq_kind', 'المناولة الأولى');
  await expect(page.locator('#srq-group')).toBeVisible();
  await expect(page.locator('#srq-group')).toContainText('المرشّحون');
  await choose(page, 'srq_kind', 'معمودية');
  await expect(page.locator('#srq-group')).toBeHidden();
  await expect(page.locator('#srq-existing')).toBeVisible();
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});
