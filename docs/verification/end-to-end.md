# Signed-in end-to-end tests

Real browsers sign in to the real API and open every screen each role can reach, in English and in Arabic.

## What runs

| Part | Where | What it does |
| --- | --- | --- |
| Test-only host | `ParishLife.EndToEnd/` | Starts `ParishLife.Api` on Kestrel at `https://localhost:7311` (the .NET development certificate). Local storage goes in a new `%TEMP%/ParishLife-E2E-<id>` folder that is deleted when the host stops. It serves `frontend/dist` from the same origin, as the `__Host-` cookies require. Never published. |
| Fixture | `ParishLife.EndToEnd/EndToEndFixture.cs` | Creates isolated test accounts through the real services: bootstrap of the two operator usernames, archdiocese, bishop (propose → independent review → accept), parish with jurisdiction, paid module coverage, a head priest appointment, office grants (secretary, treasurer), followers, a member linked through a membership request, and a ministry with an appointed leader. Fixture password and authenticator key are test values written only to the run's manifest. This is not an application seed: the API never runs it. |
| Runner | `frontend/scripts/e2e.mjs` | Builds the frontend, starts the host, waits for `E2E READY`, runs Playwright, then stops the host. |
| Tests | `frontend/e2e/*.spec.mjs` | Public pages signed out. For each role (operator, bishop, priest, secretary, treasurer, leader, member, visitor): sign in through the real form (password, then the authenticator code when asked); check the expected menu entries; open every menu screen in English, then in Arabic (`dir="rtl"`). |

A test fails on:
- a page error or console error
- an API answer of 400, 429 or 5xx
- a screen that shows the "not connected" message

403 and 404 answers are attached to the report but don't fail the test, because the API answers 404 for records a role may not see.

## How to run

```bash
cd frontend
npm run e2e                 # build, host, all tests
npm run e2e -- --no-build   # reuse frontend/dist
npm run e2e -- --grep priest
```

Requirements:
- .NET SDK 10.0.4xx (`global.json`)
- Node
- A trusted .NET development certificate (`dotnet dev-certs https --trust`)
- Microsoft Edge, or Chrome with `E2E_CHANNEL=chrome`

No browser is downloaded. Results are written to `frontend/e2e-report/` (HTML) and `frontend/test-results/` (screenshots and traces of failures), both ignored by Git.

## Differences from production

- **Rate limits:** each test sends `X-E2E-Client`, and the test host turns it into the client address (`ClientAddressFilter`), so each role is limited like a separate device. The sign-in limit (20 `/api/auth` calls a minute per address) stays as in production. The general limit (200 API calls a minute per address) is lifted, because a crawl opens screens far faster than a person.
- **Hosting:** none. The host sets the API's web root to `frontend/dist`, so the pages are served by the production code (`UseParishLifeFrontend`, with caching and the Content-Security-Policy), as a deployed `-p:IncludeFrontend=true` package serves them from `wwwroot`. See `docs/operations/frontend-hosting.md`. The public-pages test asserts the policy and cache headers, and a blocked resource on any screen fails the run.
- **Not proven here:**
  - Cosmos DB, Blob Storage and Key Vault: storage is local.
  - Email or SMS delivery.
  - Browsers other than Edge and Chrome.
  - Whether the Arabic reads well to a native reader.

## Result (17 November 2026)

All 9 tests pass in about 1.6 minutes:
- the public pages signed out
- each of the 8 roles, signed in through the real form, opening every screen in its menu in English and then in Arabic

## Findings

- **Public calendar:** the public parish page asked for 127 days of events in one request, and the API allows at most 31 days. Fixed in `frontend/src/public/api-data.js`, which now asks in 31-day pieces taken from one instant and drops duplicates.
- **Bishop's menu:** a bishop follows no parish, and with no parish selected the menu kept only Administration, My parish life, Inbox and My account. This hid the bishop's oversight, eparchy and map screens. Fixed in `frontend/src/portal/model/store.js`.
- **"My resources":** the page is wired to `GET me/ministry-resources`, but it was missing from the member module's list of connected screens. So it showed the "not connected" banner over real data. Fixed in `frontend/src/portal/model/modules/member.js`.
- **Runner (test tooling only):** a blocking Playwright launch stopped the runner from reading the host's output. Once the output pipe filled, the host stopped answering requests. The runner now launches Playwright asynchronously, and the host logs warnings only.
- **Sign-in rate limit (decided 18 November: option A):** every `/api/auth` route shared the 20-a-minute limit per client address, including `GET /api/auth/me` and `/api/auth/csrf`, which the portal calls each time it loads. People on one shared connection (a parish office or hall) could see "Too many attempts".
  - **Change:** the owner chose to exempt `me` and `csrf` from that policy. They still count toward the general per-address limit.
  - **Unchanged:** register, login, login/mfa, logout, sessions and password keep the 20-a-minute limit (`AccountsController`).
  - **Test:** `AuthenticationRateLimitTests` checks both sides.
