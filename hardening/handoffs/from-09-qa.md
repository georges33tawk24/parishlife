# Handoffs from Agent 09 (QA)

Each bug gives To, File, Bug, Steps to reproduce, Expected vs. actual and Priority. Every one has a test that proves it: xUnit tests marked `[KnownFailureFact]` are reported as skipped and run for real with `QA_KNOWN_FAILURES=1`; Playwright tests marked `test.fail(...)` run every time and pass while the bug is there (they turn red the day it is fixed, so the marker must then be removed). No secret value appears here.

## 1. Sign-in timing tells which email addresses have accounts
- **To:** 03
- **File:** `ParishLife.Api/Controllers/Accounts/AccountsController.cs` (`Login`, the `user is null || !user.Active` branch)
- **Bug:** an unknown or inactive address is answered before any password hashing; a real address with a wrong password runs the PBKDF2 check first. The difference is about 50 ms, easy to measure from outside, so an attacker can test which addresses have accounts (attack technique 14). The same answer body hides nothing when the time differs.
- **Steps to reproduce:** `QA_KNOWN_FAILURES=1 dotnet test ParishLife.IntegrationTests --filter Sign_in_takes_as_long_for_an_unknown_address_as_for_a_wrong_password`
- **Expected vs. actual:** expected the two medians within 15 ms; actual "wrong password for a real account: median 50.4 ms; unknown address: median 0.9 ms".
- **Suggested fix:** on the unknown/inactive branch, verify the given password against one fixed dummy hash (made once at startup with the same `IPasswordHasher<ParishUser>`) before answering 401. Registration and the reset request already answer neutrally; the same idea applies if their timing is ever measured.
- **Priority:** Medium

## 2. Uploaded photos keep their location metadata
- **To:** 03 (needs the owner's decision C3 in `hardening/reports/03-security.md`: an image library such as SkiaSharp)
- **File:** `ParishLife.Api/Services/Publishing/ParishProfileService.cs` (`UploadPhotoAsync`), `Services/Files/EvidenceService.cs`
- **Bug:** a phone JPEG's EXIF block (GPS position, device, time) is stored and served byte for byte, also to the public for published parish photos.
- **Steps to reproduce:** `QA_KNOWN_FAILURES=1 dotnet test ParishLife.IntegrationTests --filter A_published_photo_is_served_without_its_location_metadata`
- **Expected vs. actual:** expected the served bytes without the `Exif` APP1 segment; actual the segment, GPS pointer included, is served unchanged.
- **Priority:** Medium (already "Needs your action" C3 in 03's report; this test is the proof to turn green)

## 3. No daily cap on code emails to one address
- **To:** 03 (the number is the owner's decision)
- **File:** `ParishLife.Api/Services/Accounts/ContactVerificationService.cs` (`RequestAsync`, `RequestPasswordResetAsync`, `BeginEmailChangeAsync`)
- **Bug:** one code a minute per address and purpose is the only limit, so anyone can make the app send a person 60 emails an hour (1,440 a day) through Resend, from many addresses past the per-client limit. Inbox flooding and a growing Resend bill.
- **Steps to reproduce:** `QA_KNOWN_FAILURES=1 dotnet test ParishLife.IntegrationTests --filter Code_emails_to_one_address_stop_at_a_daily_cap`
- **Expected vs. actual:** expected at most 10 code emails to one address per 24 hours (placeholder number); actual 30 in 31 minutes.
- **Suggested fix:** count sends per normalized address and purpose in the existing `contactVerification` document (a day stamp plus a counter) and answer neutrally once the cap is reached.
- **Priority:** Low while email is off in production; Medium once Resend is configured

## 4. Public pages have no content without JavaScript
- **To:** 05 (build) and 06 (search); the decision to prerender is the owner's (06 report B16)
- **File:** `frontend/public.html`, `frontend/landing.html`, `frontend/vite.config.js`
- **Bug:** the HTML has the head (title, description, canonical, JSON-LD; parish pages get theirs from the server) but an empty body; React draws everything. Crawlers and link previews that do not run JavaScript see no text.
- **Steps to reproduce:** `E2E_CHANNEL=chromium npm run e2e -- --grep "without JavaScript"` (marked `test.fail`).
- **Expected vs. actual:** expected more than 200 characters of body text with JavaScript off; actual an empty body on `/public.html` and `/landing.html`.
- **Priority:** Low (the server-side parish head already covers titles and descriptions)

## 5. Wrong-password and wrong-code messages are English only
- **To:** 05
- **File:** `frontend/src/portal/model/api.js` (the two 401 messages for `auth/login` and `auth/login/mfa`, lines ~89–93)
- **Bug:** both strings are plain English, not `t(english, arabic)`, so the Arabic sign-in page shows "That email or username and password do not match…" in English.
- **Steps to reproduce:** `E2E_CHANNEL=chromium npm run e2e -- --grep "in Arabic on the Arabic page"` (marked `test.fail`).
- **Expected vs. actual:** expected an Arabic message on the Arabic page; actual English.
- **Priority:** Low (Arabic wording to be checked by 06)

## 6. A request that never answers leaves the button busy for ever
- **To:** 05
- **File:** `frontend/src/portal/model/api.js` (`send`: `fetch` without a time-out)
- **Bug:** on a dead mobile connection a request can hang; the sign-in (or any save) button then stays busy with no message until the browser gives up minutes later.
- **Steps to reproduce:** `E2E_CHANNEL=chromium npm run e2e -- --grep "never answers"` (marked `test.fail`; the test holds the sign-in request unanswered for 35 s).
- **Expected vs. actual:** expected a plain "could not reach ParishLife, try again" message and a usable button within about 30 s; actual the button stays busy and nothing is said.
- **Suggested fix:** `AbortSignal.timeout(30000)` on the fetch in `send`, mapped to the existing `connectionMessage()` (writes keep their operation id, so a retry cannot duplicate).
- **Priority:** Low

## 7. The directory page has no canonical link
- **To:** 03 (server head, `Middleware/PublicPages.cs`), with 06 (search)
- **File:** `ParishLife.Api/Middleware/PublicPages.cs`; `frontend/public.html` (06's head)
- **Bug:** `public.html` carries no `<link rel="canonical">`, so `public.html?lang=ar`, `?view=bundles` and other variants of the directory compete in search results. A static canonical in `public.html` is not the fix, because the server rewrites the head for parish pages and two canonical links would conflict.
- **Steps to reproduce:** `E2E_CHANNEL=chromium npm run e2e -- --grep "names its canonical address"` (marked `test.fail`), or `curl -sk https://localhost:7311/public.html?lang=ar | grep canonical` against the test host.
- **Expected vs. actual:** expected `<link rel="canonical" href="https://parish-life.org/public.html">` on the directory page when no parish is named; actual none.
- **Suggested fix:** in `PublicPages`, when `public.html` is served without `parish=`, insert the directory's canonical link before `</head>`, as the parish branch already does.
- **Priority:** Low

## Smoke test command for Agent 08 (item 2)
- **To:** 08
- **File:** `frontend/e2e/smoke.spec.mjs`
- **Requested change:** run after every deploy: `cd frontend && npm ci && SMOKE_URL=https://parish-life.org npx playwright test e2e/smoke.spec.mjs --reporter=list`. About 35 read-only GETs, no browser and no sign-in. It fails on any down page, a missing script or style, a failing health or public read, a protected read that does not answer 401, a missing robots or sitemap file, a 404 that leaks a stack trace, or a public OpenAPI document. Against production it also needs a valid certificate and HSTS of one year. In CI before a deploy, it runs inside `E2E_CHANNEL=chromium npm run e2e` against the local test host.
- **CI notes:** the e2e suite now needs no internet and no trusted certificate (the runner pins the test host's key by hash). It needs Playwright's Chromium and a development HTTPS certificate for Kestrel (`dotnet dev-certs https`, untrusted is fine). `E2E_PORT` moves it off port 7311.
- **Priority:** Medium
