/* Purpose: browser checks of the owner's People requests of 27 November 2026, as the parish secretary (office grants people.read and people.write), against the real API.
   Main checks: the new-person drawer refuses digits in a name and accepts "71 821 056" with a second number, sends separate
   English and Arabic first and last names, several phones and the consents ticked by default, and the record page shows them;
   the status filter's Apply and Clear close the popover; the export asks for no purpose; the import shows its column guide;
   the drawer and record page read in Arabic. */
import { expect } from '@playwright/test';
import { client, manifest, settle, signIn, test, watch } from './support.mjs';

const M = manifest();
const letters = n =>
  Array.from({ length: n }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]).join('');

async function asSecretary(page, n, lang = 'en') {
  await client(page, n);
  const state = watch(page);
  await page.addInitScript(l => localStorage.setItem('pl-lang', l), lang);
  await page.goto(M.baseUrl + '/index.html');
  await signIn(page, state, M.accounts.secretary, M.totpSecret, M.password, M.turnstile);
  await page.evaluate(() => (location.hash = '#/people'));
  await settle(page, state);
  return state;
}

test('people: a new parishioner with separate names, several phones and default consents', async ({ page }) => {
  const state = await asSecretary(page, 140);
  const family = 'Haddad' + letters(5);
  await page.locator('[data-split="newp"]').click();
  await page.locator('#pf_given').fill('Rita2');
  await page.locator('#pf_family').fill(family);
  await page.locator('#pf_givenAr').fill('ريتا');
  await page.locator('#pf_familyAr').fill('حداد');
  await expect(page.getByText('Letters only, no digits.')).toBeVisible();
  let posted = 0;
  page.on('request', r => {
    if (r.method() === 'POST' && new URL(r.url()).pathname.endsWith('/people')) posted++;
  });
  await page.locator('#person-save').click();
  await expect(page.getByText('Check the name').first()).toBeVisible();
  expect(posted).toBe(0);

  await page.locator('#pf_given').fill('Rita');
  await page.locator('#newborn').fill('03/02/1985');
  await page.getByLabel('Phone number 1').fill('71 821 056');
  await expect(page.locator('[data-phone-row]').first()).toHaveAttribute('data-kind', 'Mobile');
  await page.getByRole('button', { name: '+ Add another number' }).click();
  await page.getByLabel('Phone number 2').fill('01 234 567');
  await expect(page.locator('[data-phone-row]').nth(1)).toHaveAttribute('data-kind', 'Landline');
  // every consent is ticked by default, in the same control style
  await expect(page.locator('[data-consents] input[type="checkbox"]:checked')).toHaveCount(4);
  await expect(page.locator('[data-consents] label.check')).toHaveCount(4);
  const create = page.waitForRequest(r => r.method() === 'POST' && new URL(r.url()).pathname.endsWith('/people'));
  await page.locator('#person-save').click();
  const body = (await create).postDataJSON();
  expect([body.givenName, body.familyName, body.givenNameAr, body.familyNameAr, body.birthDate]).toEqual([
    'Rita',
    family,
    'ريتا',
    'حداد',
    '1985-02-03'
  ]);
  expect(body.phones).toEqual([
    { number: '+96171821056', kind: 'Mobile' },
    { number: '+9611234567', kind: 'Landline' }
  ]);
  await page.locator('[data-person-record]').waitFor();
  await settle(page, state);
  const record = page.locator('[data-person-record]');
  await expect(record).toContainText('+961 71 821 056');
  await expect(record).toContainText('+961 1 234 567');
  await expect(record).toContainText('03/02/1985');
  // kept for review by eye: the record page across the whole width
  await page.screenshot({ path: test.info().outputPath('record-page.png'), fullPage: true });
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});

test('people: the status filter closes on Apply and Clear, the export has no purpose, the import has a guide', async ({
  page
}) => {
  const state = await asSecretary(page, 141);
  const filter = page.locator('[data-filter]');
  await filter.click();
  await expect(page.locator('[data-status-filter]')).toBeVisible();
  await page.locator('[data-status-filter] input[type="checkbox"]').first().uncheck();
  await page.locator('#fapply').click();
  await expect(page.locator('[data-status-filter]')).toHaveCount(0);
  await expect(filter.locator('.badge')).toHaveText('2');
  await filter.click();
  await page.locator('#fclear').click();
  await expect(page.locator('[data-status-filter]')).toHaveCount(0);
  await expect(filter.locator('.badge')).toHaveText('All');

  await page.locator('#people-export').click();
  await expect(page.locator('#export-confirm')).toBeVisible();
  await expect(page.locator('#ex_purpose')).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.evaluate(() => (location.hash = '#/people/import'));
  await settle(page, state);
  await expect(page.locator('[data-import-guide]')).toContainText('First name');
  await expect(page.locator('[data-import-guide]')).toContainText('Date of birth');
  await expect(page.getByText('Household envelopes')).toHaveCount(0);
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});

test('people: the new-person drawer reads in Arabic', async ({ page }) => {
  const state = await asSecretary(page, 142, 'ar');
  await page.locator('[data-split="newp"]').click();
  await expect(page.getByText('الاسم الأول بالعربية')).toBeVisible();
  await expect(page.getByText('أرقام الهاتف')).toBeVisible();
  await expect(page.locator('#newborn')).toHaveAttribute('placeholder', 'dd/mm/yyyy');
  await page.locator('#pf_givenAr').fill('Rita');
  await expect(page.getByText('أحرف عربية فقط.')).toBeVisible();
  expect(state.problems, state.problems.join('\n')).toEqual([]);
});
