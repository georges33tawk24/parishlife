# 11 Owner follow-ups (frontend)

Agent 11, branch `hardening/11-owner-frontend`, cut from `fullstack-hardening` at `f802bdf`, 23–24 November 2026. It covers the six recommendations the owner accepted: T3, T15, T16, T17, T6 and N2.

Only files under `frontend/` changed, plus this report. No backend, test-project, CI or legal-text file changed. In `frontend/privacy.html`, only the inline SVG icon line in `<head>` was removed. Nothing was deployed.

## A. Results

| Item | Status | What changed | Proof |
|---|---|---|---|
| T3 demo names | Done | See section B. | `grep -i 'antoine khoury\|saint elias\|imm. khoury' frontend/dist/assets/app/*.js`: no match (exit 1). Full e2e: see section E. |
| T3 unused demo data | Done | `portal/model/data.js` went from 2,606 to 269 lines. Portal entry bundle went from 615.02 to 567.05 KB (gzip 195.69 to 179.71 KB). See section C. | `npm run check` (all 16 checks), `check:routes`, the full e2e run (every role opens every screen in English and Arabic). |
| T15 unused images | Done | Deleted `public/assets/images/church-light.jpg` and `church-interior.jpg` (1.6 MB). The `.webp` files stay. | No reference anywhere: html, css, js, `sw.js`, `site.webmanifest`, `<picture>`/`<source>` (none exist), server code (`FrontendHostingExtensions.cs`, `PublicPages.cs`, read only), docs and tools. The only mentions are in the hardening reports. |
| T16 one tab icon | Done | Removed the inline SVG `rel="icon"` from all six pages: `index.html`, `public.html`, `landing.html`, `privacy.html` (that line only), `terms.html` and `public/cookies.html`. Each page keeps `/favicon.ico` (16/32/48, cut from the arch app icon) and the apple-touch icon. The manifest stays where it was: sign-in, public and product pages. | Browsers preferred the SVG, so each surface showed a different icon. Now every page shows `favicon.ico`, which matches the touch icon and the manifest icons. No code sets an icon at run time. |
| T17 dark mode follows the device | Done | `model/account.js` `themeOf(appearance, saved)` gives mode `'system'` when the profile's `isConfigured` is false. `lib/theme.js` adds `modeOf()`, paints the device's `prefers-color-scheme` for `'system'`, and repaints on a `change` event. A saved light or dark still wins. The account form's Mode list shows the mode in effect. `persist.hydrate()` now also loads the account module, which has no parish keys, for an account without a parish, so new sign-ups follow the device too. | Module check: an unconfigured profile gives `'system'`. e2e `ui-states.spec.mjs` "with no saved appearance the portal follows the device": dark at sign-in, light after a live change, light after a reload, dark again. It fails on the old code (`data-mode` stays light). |
| T6 axe in CI | Done | Dev dependency `@axe-core/playwright` **4.14.0**, exact (published 15 Oct 2026, MPL-2.0). `overrides` pins `axe-core` to **4.14.0** (5 Oct); without it, `~4.14.0` resolved to 4.14.1, published 16 Nov, only 7 days earlier. New spec `e2e/accessibility.spec.mjs` uses tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22a and wcag22aa. | 0 violations: 16 public page states, 15 member screens, and 33 priest screens × 3 (English, dark, Arabic), 130 scans in all. It adds about 1.9 min (17.7 s public, 1.6 min portal). `npm audit --audit-level=high`: 0 vulnerabilities. CI's `e2e` job (`.github/workflows/ci.yml` lines 160–195) runs `npm ci` and `npm run e2e`, which runs every `e2e/*.spec.mjs`, so the workflow needs no change. |
| N2 repeated save after a time-out | Done | Fixed once, in `send()` in `model/api.js`. See section D. | e2e "Send pressed again after a time-out stores the message once": on the old `api.js`, **2 conversations** (output below). With the fix, 1. A node check in `check-api.mjs` fails on the old code ("the repeated write reuses the unanswered operation id") and passes now. |

## B. New demo names (for a native speaker to check the Arabic)

| What | Before | English now | Arabic now |
|---|---|---|---|
| Parish (product page demo, design-system page, check fixtures) | Saint Elias / مار الياس | Demo Parish | الرعية التجريبية |
| Town chip (product page demo) | Hadath · Maronite / الحدث · ماروني | Demo Town · Maronite | البلدة التجريبية · ماروني |
| Town in design-system samples | Hadath / الحدث | Demo Town | البلدة التجريبية |
| Priest (product page) | Fr. Antoine Khoury / الأب أنطوان خوري, initials AK | Fr. John Doe, initials JD | الأب فلان الفلاني |
| Priest's greeting | Good evening, Fr. Antoine / مساء الخير يا أبونا أنطوان | Good evening, Father | مساء الخير يا أبونا |
| Address (product page) | Imm. Khoury, 3rd floor — behind the municipality / بناية خوري… | Demo Building, 3rd floor — behind the municipality | البناية التجريبية، الطابق الثالث — خلف البلدية |
| Choir (check fixture) | Saint Elias Choir / جوقة مار الياس | Demo Parish Choir | جوقة الرعية التجريبية |
| Reservation forwarded (portal toast) | …waiting on Fr. Antoine / بانتظار الأب أنطوان | …waiting on the parish priest | بانتظار كاهن الرعية |
| Design-system empty state | Ask Fr. Antoine if you need access. | Ask the parish priest if you need access. | (Arabic had no name, so unchanged) |
| LBP rate note (portal) | Set by Fr. Antoine on 4 Oct 2026. / ضبطه الأب أنطوان في ٤ تشرين الأول ٢٠٢٦. | Set by {who set the rate, or "the parish office"}. | ضبطه {…، أو «مكتب الرعية»}. |
| Shared certificate text | Your certificate from Saint Elias / شهادتك من مار الياس | Your certificate from {the parish's name} | شهادتك من {اسم الرعية} |
| Quick-add person's default town | Hadath / الحدث | empty (unknown) | empty |
| Time-out message (N2) | …reload the page and check before trying again. | ParishLife did not answer in time, so your change may already be saved. Saving the same again is safe: it is never recorded twice. | لم يُجب ParishLife في الوقت المحدّد، فربما حُفظ تغييرك. حفظه كما هو مجدداً آمن: لا يُسجَّل مرّتين أبداً. |

**Left alone on purpose**

- **Real geography:**
  - `lib/data/lebanon-map.js` and `portal/ui/geography.jsx`;
  - the town list in `shared/record-editor.jsx`;
  - the public search placeholder "For example: Hadath";
  - the product page's address-picker chain Mount Lebanon → Baabda → Hadath. It shows what the real picker offers. Only the address line under it was demo text.
- **Other demo first names on the product page:** Rita Nassar, Nabil Saade, Maya Haddad, and the donors in `CountingDemo.jsx`. They are common names, no longer tied to a parish, priest or town. Say if you want them made obviously fictional too.
- **Fixture towns:** in `scripts/checks/*.mjs`, "Hadath" stays as a town, because those checks test real geography. Only the parish name changed there.

**Existing checks changed because a demo name changed (nothing weakened):**
- `scripts/check-api.mjs`, `scripts/checks/ministries.mjs` and `scripts/checks/sacraments.mjs`: the fixture text "Saint Elias" is now "Demo Parish", and "جوقة مار الياس" is now "جوقة الرعية التجريبية".
- The same value goes in and is asserted out. Each assertion compares exactly as before.

## C. How the deleted demo data was proved unused

1. **Every export was searched** by name in `src/`, `scripts/` and `e2e/`, including `D.X` through `import * as D`. The only dynamic access (`D[k]`) is in `persist.js`. Six exports had no reader at all, so they were removed: `RATE_AGE_DAYS`, `FAMILIES`, `BRANCHES`, `IMPORT_PREVIEW`, `CORRECTIONS` and `INCIDENTS`. Their private helpers (`P`, `serviceRows`, `serviceTemplate`) went with them.
2. **`persist.js` replaces every collection before any screen draws.** `hydrate()` builds `emptyParish()`, where every array key is `[]` and every object key is `{}`. Seven shapes are the exception: SERVICE, ROTA, CHECKIN, BATCH, REG_FORM, EVACUATION and PREP_REQUIREMENTS. Each module then fills its own keys, and `applyData()` overwrites every key. `Portal.jsx` awaits `hydrate()` after sign-in, before the first `renderAll()`. The sign-in screen reads no view-model data. No module reads a view-model value at import time; every top-level use is inside a function.
3. **What was emptied:** every array, now `[]`, and every object that is not a shape, now `{}`. RATE and PARISH were set to the same empty values `emptyParish` gives them.
   - In the seven shapes, only the fields `emptyParish` clears were emptied: `order`, `teams`, `rows`, `lines`, `counters`, `fields`, `discounts`, `installments`, `rooms` and the people ids.
   - The fields that survive were kept. Examples: SERVICE's "Sunday Mass 10:30", CHECKIN's session name, REG_FORM's "Youth retreat — Annaya", and the muster point.
   - PREP_REQUIREMENTS (the sacrament document checklist) was kept whole.
4. **Proof run:**
   - `npm run check`: all 16 checks pass. They import `data.js` directly.
   - `check:routes`: 0 new gaps.
   - Full e2e: every role opens every screen in English and Arabic, plus the axe scans.

## D. N2: the fix, and the server fingerprint check

**How it works**

- `send()` looks at each non-GET request whose body has a string `operationId`, except `auth/` paths. It builds the key `METHOD path JSON(body without operationId)`.
- When the request gets no server answer (time-out abort or network error), the key is stored in a `Map` with the operation id.
- The next request with the same key goes out with that stored id.
- Any server answer, error statuses included, deletes the entry. Sign-out clears the map.
- A changed body makes a different key, so it is a new write with its own id.
- **`auth/` is excluded** (marked `ponytail:` in the code). Those bodies can hold passwords, which should not sit in memory. Those writes are also versioned or one-off.

**Server fingerprint check (read only)**

- `Operation.Create` hashes the actor, the contract type, the scope, `JsonSerializer.Serialize(request)` and the acting appointment. `At` (the clock) is not part of the hash.
- I read all 65 `Operation.Create` calls. The ones that take a client id hash either the request DTO itself, `OperationId` included, or a context object built only from request fields and route ids (`Version` always comes from the request). None hashes a time, a random value or a stored value.
- So an identical retry with the same id gets the same fingerprint, and the API replays the first result. Calls with `Guid.NewGuid()` are server-side operations whose routes take no client id, so they are not affected.
- Credential DTOs hash only `Kind`, so a reused id with a different password would replay. The client never reuses an id when the body differs, and never keeps `auth/` bodies at all.

**The proving test**

- The test is `e2e/ui-states.spec.mjs`, run as the member.
- A Playwright route holds the first `POST /api/parishes/{id}/inbox` until the portal has shown the time-out message, which takes 30 s. Then it sends the request with `route.fetch`, so the server stores it late.
- The member presses Send again, and the test counts the stored conversations with that subject.
- Old code:

  ```
  ✘ Send pressed again after a time-out stores the message once (audit N2) (35.7s)
    Expected length: 1
    Received length: 2   (two conversations "Time-out check 1795472027006", ids 3720c508… and b9e72d8a…)
  ```
- New code: `✓ … (36.3s)`.

**Why a message and not a note or meeting:**
- The fixture priest cannot create pastoral notes. The API answers 404 "The requested note is unavailable" even to a direct call, which looks like a fixture gap.
- The meeting dialog cannot be retried. Its drawer keeps the group detail object from before the failed save, so a second press only says "Meeting already exists" and sends nothing. That is existing behaviour, not a duplicate risk, and left as it was.
- The member's message form calls the API on every press, the way a user would retry.

## E. Checks run (final branch state)

| Check | Result |
|---|---|
| `npm run format:check` | All matched files use Prettier code style |
| `npm run check` | exit 0, all 16 checks pass (check-api, account, administration, calendar, communications, facilities, finance, member, ministries, names, people, public, registrations, registry, requests, sacraments) |
| `npm run check:routes` | 642 API routes, 634 matched, 2 known gaps, 0 new |
| `npm run build` | succeeds |
| Bundle grep (done-when for T3) | `grep -i 'antoine khoury\|saint elias\|imm. khoury' frontend/dist/assets/app/*.js`: no match |
| `npm audit --audit-level=high` | found 0 vulnerabilities |
| e2e `E2E_CHANNEL=chromium npm run e2e` | 46 tests: 46 as expected, 0 unexpected, 0 flaky, 7.5 min. This was a full run with traces and screenshots off, using a scratch config. The one ✘ is `public-site.spec.mjs` "without JavaScript", which was already marked `test.fail()` (from-09-qa #4). |
| `gitleaks git --redact --log-opts="f802bdf..HEAD"` | 7 commits scanned, no leaks found |

**Disk incidents (this machine's disk is shared, with under 1 GB free):**
- During the first full run, after T3, the disk filled up (ENOSPC). The only failure, "leader: signs in…", timed out writing to the full disk, and it passed on rerun.
- Later, Playwright's in-progress traces reached about 600 MB in `frontend/test-results`. The cause was mostly the axe test: each scan injects axe's whole source, and the public half alone made a 26 MB trace. The coordinator deleted them.
- What changed:
  - `accessibility.spec.mjs` now sets `test.use({ trace: 'off' })`. A failure there already lists the page, the rule, the elements and the colours measured.
  - The final run used a scratch config outside the repository, with traces and screenshots off.
  - `test-results` was deleted after every run.
  - The committed `playwright.config.mjs` is unchanged.

## F. Not done, or limits

1. **"No saved appearance" means a profile was never saved.** The API has no "follow the device" value. Two things therefore count as a saved choice, and the account then stays light:
   - saving only the display name, because the API requires an appearance on every profile save;
   - "Reset appearance", which stores the default light.

   A real "Same as device" option needs a `system` mode in `AccountAppearanceDto` and the profile model. That is a backend change and your decision. Restricted or recovery sessions, which cannot read the profile, stay light as before.
2. **The N2 retry memory lives only in the open page.** After a reload, a repeated create gets a new id. By then the reload shows the record if it was stored.
3. **Some kept view-model fields are still demo text.** They show in an empty parish only when its module fails to load, for example REG_FORM "Youth retreat — Annaya". Deleting them changes what a screen shows, so they were kept under the "only what is proved unused" rule. Replacing them with the modules' own blank shapes is a small follow-up if you want it.
4. **`theme-color` still differs by page.** That is the browser bar colour, not an icon, and was left alone.
