# Current ParishLife continuation state

Updated **11 November 2026**, owner timezone Asia/Beirut. Read this before acting on **continue**, then verify actual Git state. The owner currently wants implementation to continue here; a Claude switch is deferred.

## Frontend integration (branch `fullstack`, 11 November 2026)

At the owner's request, branch `fullstack` adds the React frontend from `frontend-new2` in `frontend/` and connects its foundation to this API: CSRF, sign-in with the authenticator step and the optional Turnstile token, sign-up, session with roles from `GET /api/me/capacities`, and People list, add and archive. Every other module is marked "not connected" on screen. Status, gaps and owner decisions: `docs/frontend-integration.md`. No backend code changed on that branch.

### Front/back continuation checkpoint (13 November 2026, owner's Windows machine)

The overall to-do list is `docs/REMAINING-WORK.md` (Georges, 12 November). This checkpoint is on local branch `fullstack-integration`, cut from `upstream/fullstack` at `520cdb8`, in the separate worktree `C:\Users\User\source\repos\ParishLife-fullstack` so the Azure-connection session's uncommitted edits in the main folder stay untouched. Not pushed: pushing to Georges's repository is authorized only for `backend`.

- **Pinned SDK:** this PC's `Program Files\dotnet\sdk\10.0.401` was an empty stub. With the owner's approval, SDK 10.0.401 was installed user-locally in `%LOCALAPPDATA%\Microsoft\dotnet` (Program Files untouched). Use it with `DOTNET_ROOT` and `PATH` pointing there.
- **Backend on `fullstack` (520cdb8), SDK 10.0.401:** `restore --locked-mode` OK; **454 tests passed (57 unit / 397 integration), 0 failed.** The AppHost project fails restore with NU1903 (warning as error): advisory GHSA-f7vh-h5g3-7jrh against Aspire 13.6.4. The Azure session's uncommitted change bumps it to 13.6.5; it is not duplicated here.
- **Frontend:** `npm ci`, `npm run check` (all 15 checks) and `npm run build` pass. `format:check` failed on Windows (190 files) only because `core.autocrlf=true` checks out CRLF; `frontend/.gitattributes` now keeps the sources LF, and it passes.
- **New `npm run check:routes`:** records every request the checks send and the literal `api()`/`parishAPI()`/`allPages()` paths in `src/`, and matches them against the 546 routes in `ParishLife.Api/Controllers`. 502 distinct requests, 487 matched, 15 unmatched, all listed with a reason in `frontend/scripts/route-gaps.json`: `parishes/{id}/account-names` (not built yet), the deliberate `workspace/plan` negative check, and the old-server screens (`account/signature`, `account/records`, `workspace/public-profile`, `workspace/suspension`, `attendance-preview`, `sign/options`, `parishes/{id}/files`).
- **Local smoke test against the real API** (Release, local documents in a scratch folder, Vite proxy): public directory 200, offline policy 200, manifest/homepage 404 (nothing published, as documented), site metrics 202, CSRF 200, `POST /api/auth/register` 202, and sign-in of the unverified account 401 with a readable message. Signed-in screens were not exercised: that needs the interactive `verify-identity` operator command.
- **Georges's `fullstack2-*` sessions never ran** (owner, 13 November). The areas are being built here instead, by parallel workers on this machine, each in its own worktree `C:\Users\User\source\repos\PL-areas\<area>` on branch `fullstack2-<area>`, following `docs/frontend-modules/CONVENTIONS.md`. The owner asked for a push at every checkpoint: `fullstack-integration` and each `fullstack2-<area>` are pushed to `upstream` (Georges's repository) as their own branches; `fullstack` and `backend` are not touched.
- **Done:** the shared account-name lookup, `GET /api/parishes/{id}/account-names` (`AccountNamesService`, `AccountNamesTests` 2/2 passed; rules and limits in `docs/operations/account-names.md`).
- **Merged into `fullstack-integration` (14 November):** `fullstack2-people` (`a7ff8c7`: Arabic names, rite, member/visitor status, office edit `PUT people/{id}`, parish-wide facts and consent lists, household twins; owner questions in `docs/frontend-modules/people.md`) and `fullstack2-calendar` (`6b4201b`: Arabic twins for events, plans, items and music, event templates, celebrant choices; open items in `docs/frontend-modules/calendar.md`). Aspire AppHost bumped to 13.6.5 (advisory GHSA-f7vh-h5g3-7jrh), so `dotnet test ParishLife.slnx` runs again. **Checks at `bb881a4`, SDK 10.0.401:** restore `--locked-mode` OK, Release build 0 warnings, **467 tests passed (57 unit / 410 integration)**; frontend format, check (all modules), build pass; `check:routes` 556 routes, 521 requests, 13 known gaps, 0 new. Local storage only.
- **All 13 areas merged (14 November, night):** after people and calendar came sacraments, member, facilities, account, public, administration, finance, communications, requests, ministries and registrations, merged one at a time with the full checks after each. Two flaky or brittle tests were fixed: the topic-catalog source scan, and the exchange-rate correction under the frozen fixture clock. **Final checks, SDK 10.0.401:** restore `--locked-mode` OK, Release build 0 warnings, **533 tests passed (57 unit / 476 integration)**; frontend format, check (all modules), build pass; `check:routes` 635 routes, 627 requests, 2 known gaps (the deliberate `workspace/plan`, and `attendance-preview`), 0 new. Local storage only. **For the full picture and what is still open, read `HANDOVER.md` at the repository root.**
- **Signed-in end-to-end tests (17 November):**
  - **Test host:** the test-only `ParishLife.EndToEnd`, with the real API on Kestrel HTTPS and temporary local storage. Its fixture accounts are created through the real services: operators, bishop, head priest, secretary and treasurer grants, ministry leader, linked member and follower.
  - **Browser tests:** Playwright (`frontend/e2e`, installed Edge). Each role opens every screen in its menu in English and Arabic.
  - **Result:** `npm run e2e` passes 9/9.
  - **Fixed:** the public calendar window (31-day pieces), the bishop's menu with no parish, and the "My resources" banner.
  - **Opt-in frontend hosting:** `-p:IncludeFrontend=true` plus `UseParishLifeFrontend`, off by default. The API-only publish is verified unchanged.
  - **Owner decision, hosting (17 November):** the API serves the frontend. `tools/Publish-ParishLife.ps1` builds the package and zip without deploying. The pages get caching and a hash-based Content-Security-Policy, and the e2e host uses this same production hosting path. Checks: 535 backend tests (57 unit / 478 integration, including `FrontendHostingTests`), e2e 9/9 with the policy enforced. Not deployed: the deploy and the new Cosmos index paths need the Azure session and an explicit go-ahead.
  - **Sign-in limit, decided (option A, 18 November):** `auth/csrf` and `auth/me` no longer use the 20-a-minute `authentication` budget, but still count toward the general per-address limit. All other sign-in, session and password actions keep it. `AuthenticationRateLimitTests` covers both sides.
- **Deployed to Azure (18 November 2026), by the Azure session at the owner's go-ahead:**
  - `a156ae3`, built with `tools/Publish-ParishLife.ps1` (145 files, no backslash entries), was deployed to `app-parishlife` at 14:54 UTC.
  - `/health/ready` is Healthy.
  - `/` and `/public.html` serve the portal with the Content-Security-Policy, hashed assets are `immutable`, and `/api` is unchanged.
  - The existing Key Vault-wrapped key ring was reused.
  - The Cosmos index already matched the `a156ae3` manifest (unchanged since `30f6132`), so nothing was applied.
  - The owner signed in with password and authenticator in the browser at 15:08 UTC.
  - Application Insights after that visit showed no exceptions, failed dependencies or error traces. The only 404s were `api/public/homepage` and `api/public/app/manifest`, which have nothing published yet; the pages fall back as designed.
  - Found during the deploy: under Windows PowerShell 5.1 `$PSScriptRoot` is empty in the script's `param()` defaults, so `-OutputRoot` had to be passed. Fixed afterwards (default computed in the script body).
- **Backend merged (18 November):** `upstream/backend` at `ae0a367`, the request-letter notification outcome read (X04 slice) from the backend attempt below. Its `RequestLetterTests` now run here on SDK 10.0.401.
- **Deployed `094f9d5` (18 November, 15:52–15:54 UTC), by the Azure session at the owner's go-ahead:**
  - Packaged with `Publish-ParishLife.ps1` without `-OutputRoot`: 145 files, no backslash entries.
  - Index unchanged.
  - Healthy, with the policy and caching as before.
  - The key ring was reused (key version `426eb917…`).
  - The sign-in limit change is confirmed live: 30 rapid `auth/csrf` and 30 rapid `auth/me` calls, no 429s.
  - Owner visit at 15:56 UTC with clean Application Insights.
  - Details: the deployment log in `docs/operations/frontend-hosting.md`.
- **Sign-out fixed (18 November):**
  - **Cause:** the user menu's "Sign out" froze the tab and never sent `auth/logout`. The shell's `signOut` handler in `Portal.jsx` shadowed the imported API function and called itself. It was live in `a156ae3` and `094f9d5`.
  - **Fix:** the import is now `signOut as endSession`.
  - **New browser tests:** the visitor (member menu) and the priest (staff menu) sign out. The tests check that `auth/logout` returns 204, the sign-in screen returns, `auth/me` is 401 and a reload stays signed out. With the bug put back, both tests fail.
- **Deployed `63aa347` (18 November, 16:20–16:22 UTC), by the Azure session at the owner's go-ahead:**
  - Packaged with `Publish-ParishLife.ps1`: 145 files, no backslash entries. Only the rebuilt frontend chunks, the two pages and the commit-stamped `ParishLife.Api.dll`/`.pdb` differ from `094f9d5`; no backend source changed.
  - Index unchanged.
  - Healthy, with the policy and caching as before.
  - The key ring was reused (key version `426eb917…`).
  - **Sign-out works live:** `auth/logout` 204, then a reload stays signed out (`auth/me` 401), confirmed by the owner's browser visits at 16:23 and 20:26 UTC.
  - Application Insights is clean: no 429s, exceptions, failed dependencies or error traces.
  - Details: the deployment log in `docs/operations/frontend-hosting.md`.
- **Custom domain `parish-life.org` (18 November, 21:34–21:44 UTC), by the Azure session at the owner's go-ahead:**
  - **Cloudflare:** A `@` → `20.43.43.43` (DNS only), TXT `asuid` (DNS only), CNAME `www` → `parish-life.org` (Proxied), and a redirect rule `http*://www.parish-life.org/*` → `https://parish-life.org/${2}` (301).
  - **App Service:** `parish-life.org` bound, with a free managed certificate (GeoTrust, valid until 19 May 2027, auto-renewed) bound with SNI. The `AllowedHosts` setting is `parish-life.org;app-parishlife-gxcjhmgqagd7hhg0.francecentral-01.azurewebsites.net;localhost;127.0.0.1`. `www` is not bound: Cloudflare redirects it.
  - **Code matches:** `ParishLife.Api/appsettings.json` has the same `AllowedHosts` value (front/back chat, 18 November). The App Service setting still takes precedence.
  - **Verified:** portal, CSP, health and CSRF on the new name; http→https and www→root redirects; the old address still works. The owner signed in and out with MFA on `parish-life.org`. Application Insights is clean after the restart.
  - **Unverified:** plain `http://www` from the owner's network (it looks intercepted locally).
  - Keep the bare domain DNS only: certificate renewal and per-visitor rate limits depend on it.
  - Details: "Custom domain" in `docs/operations/frontend-hosting.md`.
- **Turnstile code (`b451301`):**
  - The API already enforced Turnstile on sign-in, sign-up, email codes, passkeys and external sign-in once both keys are set. Now the anonymous guest request form is protected too: the public request page sent the token, but the API ignored it.
  - **Sign-in screen:** a fresh check after every attempt (also after the password step), and "Complete the check first." instead of a refused request.
  - **Browser tests:** they run with Cloudflare's published test keys through the real widget and siteverify. 11/11 pass; 536 backend tests pass.
  - **Setup steps** (Cloudflare widget, Key Vault secret, identity access, two app settings, checks, rollback): `docs/operations/account-sign-in-methods.md`.
- **`b451301` deployed (18 November, 22:13 UTC), by the Azure session at the owner's go-ahead:**
  - 145 files; 6 differ from `63aa347`, all explained. The Cosmos index matched, and the key ring was reused.
  - Healthy, with the policy and caching as before.
  - The owner signed in and out on `parish-life.org` at 22:17–22:18 UTC.
- **Turnstile live (19 November, 10:50 UTC), by the Azure session at the owner's go-ahead (owner decision: Turnstile on):**
  - Widget: created by the owner with Cloudflare's "Set up with Spin" flow, for `parish-life.org` and the azurewebsites address. Site key `0x4AAAAAAGIg3JWtHyFPWxXW`.
  - Secret: stored by the owner in Key Vault `turnstile-secret-key`. The session never handled it.
  - RBAC changes:
    - the owner's account got "Key Vault Secrets Officer" on the vault;
    - `id-parishlife` got "Key Vault Secrets User" on that one secret.
  - `keyVaultReferenceIdentity` was set to `id-parishlife`, and the two `Turnstile__*` app settings were added.
  - **Verified:**
    - the Key Vault reference is `Resolved`;
    - capabilities report Turnstile on;
    - a sign-in without a token, or with a forged one, gets 400 `turnstile_failed`;
    - the owner's real sign-in through the widget passed siteverify, then MFA (10:57–10:58 UTC);
    - Application Insights is clean.
  - Widget hostnames confirmed by the owner: exactly these two, with no `localhost` or `127.0.0.1`.
  - **Open:** the public request page's widget was not exercised live, because nothing is published yet.
  - Details: "Turnstile switched on" in `docs/operations/frontend-hosting.md`.
- **Google and Microsoft sign-up (19 November; deployed 20 November, and Google is live, see below):**
  - **Owner decisions (approved policy, OWNER-QUESTIONS #21):**
    - sign-up creates an account with no password, which can be added later;
    - a provider-verified email counts as confirmed, and is never used to merge (`email-in-use`);
    - Google and Microsoft now, Apple later.
  - **API:**
    - `POST /api/auth/external/{provider}/sign-up` (Turnstile, rate-limited).
    - Which emails count: Google needs `email_verified`. Microsoft needs a personal-account `tid` or `xms_edov` in the ID token (`Identity/ExternalIdentityClaims.cs`).
    - `POST /api/auth/password/add`, proven by a provider sign-in of the same session within 10 minutes.
    - The S06.11 last-method guard is checked before any proof is asked for.
    - `auth/me` reports `hasPassword`. Scopes are now `openid email profile`.
  - **Microsoft without a secret:** `ExternalSignIn:microsoft:UseManagedIdentityAssertion=true` redeems the code with a managed-identity client assertion (`Identity/ExternalOAuthHandler.cs`).
    - **Verified live on 21 November:** Microsoft accepts it for a personal account at `common`. The Key Vault secret fallback isn't needed.
  - **Portal:**
    - "Sign up with Google/Microsoft" on the sign-up tab;
    - the `signed-up`, `email-in-use` and `not-verified` messages;
    - a Google and Microsoft panel in My account (link, unlink);
    - "Add a password" for accounts without one.
  - **Checks, SDK 10.0.401:**
    - **547 backend tests passed** (64 unit / 483 integration), including `ExternalSignUpTests` 4 and `ExternalIdentityClaimsTests` 7;
    - frontend format, lint, check and build pass;
    - `check:routes` 638 routes, 2 known gaps, 0 new;
    - `npm run e2e` 11/11.
  - **Not exercised:** a real provider, or the new buttons in a browser (the e2e host has no provider configured).
  - **Next, in the Azure session with the owner's go-ahead:**
    - the app registrations;
    - Google's secret in Key Vault;
    - Microsoft's federated credential and optional claims;
    - the App Service settings and the deploy.
  - Rules: `docs/operations/account-sign-in-methods.md`.
- **Privacy policy and terms of use (19 November), drafts pending owner approval:**
  - `frontend/privacy.html` and `frontend/terms.html` are static bilingual pages served at `/privacy.html` and `/terms.html`, each with a visible "Draft — pending owner approval" banner.
  - They are linked from the public footer and the sign-in/sign-up screen.
  - The text describes only what the code does; each statement's source is in `docs/operations/legal-pages.md`.
  - **Open placeholders** (OWNER-QUESTIONS 21a): operator, contact email, governing law, minimum age, effective date, retention periods, liability.
  - **Checks:** the e2e public-pages test opens both pages in both languages under the page policy.
  - Deployed on 20 November (see "Google sign-up live" below). Google's Branding page and the Microsoft app registration still need the URLs once the text is final.
- **Google and Microsoft sign-up live (20–21 November), by the Azure session at the owner's go-ahead:**
  - `ea2e388` deployed (12:01–12:03 UTC). The privacy and terms pages are live with the draft banner.
  - Google settings added (12:03 UTC); the Key Vault reference shows `Resolved`.
  - **Bug fixed live:** the page policy's `form-action 'self'` blocked the redirect to Google, so one click did nothing and a second gave 400 `turnstile_failed`. `form-action` now allows the providers' authorization origins. Test added; 547 backend tests pass. Deployed 17:32–17:34 UTC.
  - **Verified:** the owner signed up with Google at 17:34:45–17:35:08 UTC and was signed in to the portal.
  - **Microsoft, with no secret:**
    - Federated credential for `id-parishlife` on app registration `3fb431a8-…`, plus `ClientId` and `UseManagedIdentityAssertion=true` (20 November, 18:05 UTC).
    - **Verified:** the owner signed up with a personal Microsoft account (21 November, 14:30 UTC). The token endpoint accepted the managed-identity assertion at `common`.
  - **Open:**
    - Google: **In production since 22 November** (see below).
    - The Microsoft consent screen shows "unverified". Publisher verification comes later; the privacy/terms URLs are on the app registration since 21 November.
    - The double-click guard and the portal redirect on a failed check: deployed 21 November (below).
  - Details: "Google and Microsoft sign-in configuration" in `docs/operations/frontend-hosting.md`.
- **Double-click fix, Resend email, final privacy and terms (21 November): `39e5df6` deployed 15:15–15:17 UTC by the Azure session (owner's go-ahead):**
  - **Double click:**
    - one press per provider trip (`postToProvider` guard plus disabled buttons, reset when Back restores the page);
    - a failed or unavailable check on a portal form post now redirects to `/index.html?external=check-failed` / `check-unavailable` with a plain message, instead of a JSON page.
    - Tests:
      - `ExternalSignInPortalTests` covers sign-in and sign-up, failed and unavailable.
      - New e2e test "Google sign-up: a double press posts once and reaches Google", with a stand-in Google client in the e2e host. It also guards the `form-action` fix. Proven to fail with the guard removed (2 posts).
  - **Email through Resend** (owner decision): `ResendContactCodeDelivery`, from `ParishLife <no-reply@parish-life.org>`, for sign-up and email-change codes; `ResendEmailTests` (3).
    - Off until `Email__Provider`, `Email__ResendApiKey` (Key Vault) and `Email__From` are set.
    - Setup steps (Resend account and DNS, key in Key Vault, RBAC, settings): `docs/operations/notification-delivery.md`.
  - **Privacy and terms final** (owner answers): operator ParishLife, contact `privacy@parish-life.org`, Lebanese law, age 13+, effective 21 November 2026, draft banner removed, Resend named.
    - "Technical logs deleted after 90 days": confirmed (see below).
    - `privacy@`: Cloudflare Email Routing is on and forwarding, tested 22 November.
  - **Checks, SDK 10.0.401:**
    - **550 backend tests passed** (64 unit / 486 integration);
    - frontend format, lint, check and build pass;
    - `check:routes` 0 new gaps;
    - `npm run e2e` 13/13.
  - **Verified live:**
    - the pages serve with the page policy, and the privacy and terms pages have no banner or placeholders;
    - a forged check on a portal form post redirects to `check-failed`;
    - capabilities show Google and Microsoft available and email NotConfigured (Resend not set up yet).
    - The privacy text "logs deleted after 90 days" is correct: the App* tables in Application Insights keep 90 days.
    - The Microsoft app registration now has the home, terms and privacy URLs. Publisher verification needs an MPN ID.
  - **Resend live** (21 November, Azure session, owner's go-ahead):
    - the domain is verified in Ireland, and the key is in Key Vault `resend-api-key` (stored by the owner);
    - the `Email__` settings were added at 15:44 UTC;
    - DMARC `p=none` with Cloudflare reports.
    - **Verified:** the owner registered, received the code (in Junk, before DMARC), confirmed it and signed in.
    - The owner keeps the `no-reply` sender. privacy@ forwarding is on and tested.
    - Details: "Email: live setup" in `docs/operations/notification-delivery.md`.
  - **Google sign-in open to everyone (22 November, done by the owner):** Branding filled in (home page `public.html`, privacy and terms links, authorized domain `parish-life.org`, no logo), scopes `openid`/email/profile only, then "Publish app" to In production. No Google review was needed for these scopes. **Verified:** the owner signed up with a Google account that was not a test user, from a private window.
- **Outside delivery: email, web push and WhatsApp (21 November; `cb5a630`, deployed as `7ecde63` on 22 November 18:33–18:35 UTC by the Azure session, owner's go-ahead):**
  - **Owner decisions:**
    - Resend also emails personal notices, report notices and broadcasts;
    - WhatsApp through the Meta Cloud API;
    - web push;
    - no SMS, no online payments.
  - **Design:**
    - a `deliveryWork` row is written in the same transaction as the stored notice (account partition) or the sent broadcast (parish partition);
    - `DeliveryWorker` sends it on each person's chosen channels: email to a confirmed address only, push to allowed devices, WhatsApp to a proven number.
    - Notices carry only their neutral title and a sign-in link; broadcasts carry their text, in the recipient's language.
    - Broadcast channel status `Queued` (never "sent"). The "Sms" channel became "WhatsApp".
  - **Code:**
    - `EmailDeliveryChannel`, and `ResendEmailSender` (now shared with the account codes);
    - `WebPushSender`: RFC 8291/8292 with platform crypto only, and only known push services allowed;
    - `WhatsAppSender` (templates `parishlife_notice`, `parishlife_code`);
    - `NotificationChannelService` and routes `api/notifications/channels|push-devices|whatsapp`;
    - My account → "How ParishLife reaches you";
    - service-worker push and click handlers;
    - `tools/New-VapidKeys.ps1`;
    - the privacy page names the push services and Meta.
  - **Tests:** `DeliveryTests` (4), `WebPushSenderTests` (12, including RFC 8291 Appendix A byte for byte), and account check assertions.
  - **Setup** (Resend; VAPID keys; Meta business, number, templates, token; RBAC; settings): `docs/operations/notification-delivery.md`.
  - **Checks, SDK 10.0.401:**
    - Release build: 0 warnings;
    - **566 backend tests passed** (76 unit / 490 integration);
    - frontend format, lint, check and build pass;
    - `check:routes` 644 routes, 0 new gaps;
    - `npm run e2e` 13/13.
  - **Live (22 November):**
    - web push switched on: VAPID keys from `tools/New-VapidKeys.ps1`, the private key in Key Vault `webpush-private-key` (Secrets User for `id-parishlife` on that secret only), and the `WebPush__` settings at 18:36 UTC, reference `Resolved`;
    - the owner's iPhone (Home Screen app) registered for push at 18:42 UTC.
    - WhatsApp is not set up yet (Meta business, number, templates and token are the owner's).
    - No push had been sent: nothing could send one before the test button below.
  - **Owner decision, maps (Q24):** Google Maps, integrated by the owner. That will need a browser key, the page policy and a privacy line (OWNER-QUESTIONS 24).
- **"Send a test notification" (22 November, owner's request; `d8ca9d1`, deployed 21:37–21:39 UTC by the Azure session, owner's go-ahead):**
  - `POST /api/notifications/test` (`NotificationTestService`) sends one fixed, neutral message to the caller alone: their own push devices, their own confirmed email (if email is on) and their own proven WhatsApp number (if on). It takes no input.
  - **Access:** a personal sign-in only. No recovery sign-in (middleware and service) and no appointment capacity; an account with two-factor needs its authenticator session. Members without two-factor may test their own devices.
  - **Limits:** one a minute and five a day per account, counted before sending, plus the per-address sign-in limit.
  - **Results:** per channel, `sent` (only when the service accepted it), `no-device` / `no-address` / `no-number`, `not-enabled` or `failed`, plus the tests left today. Gone push devices are removed as in normal delivery.
  - Receipts and audit hold no endpoint or key; the log holds outcomes and the device count only.
  - **UI:** My account → How ParishLife reaches you → "Send a test notification", with the result shown inline.
  - **Tests** (2 new in `DeliveryTests`, 6 in all):
    - anonymous is refused;
    - only the caller's own device and address are used;
    - the one-a-minute and five-a-day limits;
    - outcome mapping;
    - gone-device cleanup;
    - no endpoint or key in receipts or audit;
    - recovery, appointment and authenticator-less sessions are refused.
  - **Checks, SDK 10.0.401:**
    - Release build: 0 warnings;
    - **568 backend tests passed** (76 unit / 492 integration);
    - frontend format, lint, check and build pass;
    - `check:routes` 645 routes, 0 new gaps;
    - `npm run e2e` 13/13.
  - **Deployed:**
    - built with `tools/Publish-ParishLife.ps1` from a clean worktree (147 files). Compared with live `7ecde63`, only `ParishLife.Api.dll`/`.pdb`, `wwwroot/index.html` and the portal chunk changed.
    - **Verified live:** `/health/live` and `/health/ready` 200; the pages serve the new portal chunk; anonymous `POST /api/notifications/test` gets 401. Application Insights shows only the usual start-up TaskCanceledException and no 5xx.
    - **Verified by the owner (22 November):** they pressed "Send a test notification" on the iPhone Home Screen app and the push notification arrived. This is the first real push end to end: VAPID signing, RFC 8291 encryption, Apple's push service and the service worker. Members without two-factor may still test their own devices; the owner asked for no change.
- **Google sign-in published to everyone (22 November):** recorded above; the owner verified it with a non-test account.
- **Owner answers and four decision changes (23 November), code only, not deployed:**
  - **Answers** (OWNER-QUESTIONS, decided table):
    - Archeparchy of Beirut;
    - the priest always manages parish workflows;
    - a named archdiocese billing representative;
    - contested ownership decided by an operator only after church confirmation, parish read-only meanwhile;
    - message review kept;
    - no sign-in before email confirmation;
    - counts under 5 hidden in bishop totals;
    - records and audit permanent, read notifications 1 year, site counts 2 years;
    - backups 30 days with a quarterly restore test;
    - a separate test database.
  - **The four changes, done:**
    - yearly receipt numbers `2026-0001` (Beirut time; older receipts keep plain numbers);
    - Members only for registering yourself, joining a ministry and asking for a sacrament online (`members_only`; office staff not limited);
    - calendar delegates named by the bishop prepare drafts and only the bishop approves (`…/liturgical-calendars/delegates`);
    - archdiocese-wide sacrament checklists set by the bishop (`api/archdioceses/{id}/sacrament-requirements`), replacing parish lists for that sacrament.
  - **Checked:** no self-service route lets a parent act for a child.
  - **Tests:**
    - `Receipt_numbers_restart_each_year_at_midnight_in_Beirut`;
    - Members-only tests for registrations, requests and ministries;
    - `A_delegate_named_by_the_bishop_prepares_drafts_and_only_the_bishop_approves`;
    - `The_archdiocese_checklist_replaces_parish_lists_for_its_sacrament_and_only_the_bishop_sets_it`.

    Existing test people who act as members are now recorded as Members.
  - **Checks, SDK 10.0.401:**
    - Release build: 0 warnings;
    - **574 backend tests passed** (76 unit / 498 integration);
    - frontend format, lint, check and build pass;
    - `check:routes` 649 routes, 0 new gaps;
    - `npm run e2e` 13/13.
  - **Screens:** the finance screens show the new receipt numbers. Not built (no portal screens yet): the bishop's calendar editor and delegate list, and the archdiocese checklist editor.
  - **The five further changes (23 November), code only, not deployed:**
    - **Q8:** the parish priest manages workflows without a grant unless a grant denies `workflows.manage`; restricted answers stay with explicit grants (`The_parish_priest_manages_workflows_without_a_grant_unless_a_grant_denies_it`).
    - **Q9:** the bishop names the archdiocese billing representative (`GET/PUT api/archdioceses/{id}/billing-representative`, verified account with two-factor); payer transfers use it, the registering account until one is named. Two tests in `PayerTransferTests`. No portal screen yet.
    - **Q10 (superseded the same day, see "Parish control" below):** the bishop of the parish's confirmed archdiocese confirms or disputes an ownership claim (`POST …/ownership-claims/{id}/church-confirmation`); recovery needs "Confirmed"; rejection does not. While any claim is open the parish is `OwnershipContested`: `ParishAccess` and selected-appointment access refuse every permission not ending in `.read` (`parish_contested`); priest-only clergy actions are not frozen. The admin screen shows "Under ownership review · read-only" and an "Archdiocese answer" button. `OwnershipRecoveryTests` updated plus `Only_an_independent_archdiocese_bishop_confirms_and_a_disputed_claim_cannot_recover`.
    - **Q14:** bishop overview counts of requests, certificates and membership requests 1–4 return `null` ("fewer than 5" on screen), totals too; `SmallCountTests`.
    - **Q15:** `RetentionWorker` (every 6 hours when background jobs run) deletes notices read or archived over a year ago and site counts over two years; the capability list reads real configuration; privacy page and `legal-pages.md` updated; `RetentionTests`.
    - **Done by the Azure session on 23 November (see "Backups and test database" below):** backups to 30 days (Q16), the test database (Q26), and the deploy. The quarterly restore test is still open.
    - **Checks, SDK 10.0.401:** Release build 0 warnings; **586 backend tests passed** (81 unit / 505 integration); frontend format, lint, check and build pass; `check:routes` 652 routes, 0 new gaps; `npm run e2e` 13/13. Local storage only.
- **Parish control (owner decision, 23 November), code only, not deployed:** replaces ownership claims.
  - Only a ParishLife operator, the bishop or his archdiocese administrator (acting in that appointment) registers a church (`ChurchAdministrationAuthority`); others get `church_authority_required`. Registered under an archdiocese, the church is verified and placed under it at once; a bishop/administrator registrar holds only `Permissions.ChurchAdministration` (details, settings, publishing, schedule, facilities, billing; no people, sacraments or finance). A church may have no archdiocese (operator only).
  - `POST api/parishes/{id}/control` (`ParishControlService`) hands control to a priest currently appointed to that parish (bishop, administrator or operator), or for a parish without an archdiocese to any verified account with an authenticator (operator). The previous controller's grant is revoked; pending payer transfers and association proposals are withdrawn.
  - Removed: ownership claims (routes, service, model, DTOs, tests, admin drawer) and the read-only freeze.
  - Admin screen: an archdiocese choice when registering, and "Hand control to the priest".
  - Tests: `ParishControlTests` (3); `IndependentParishScenario` now registers as an operator and hands control to its test owner; HTTP tests register as an operator.
  - Not built: the bishop editing a parish he did not register (he appoints priests and hands control). Parishes already on the live site keep their registrant (test data, owner confirmed).
  - The topic `parish.ownership_claim` left the notification catalog. Adding `ArchdioceseId` changes the fingerprint of new registration requests (a registration retried across the deploy would conflict; the test now pins the new form).
  - **Checks, SDK 10.0.401:** Release build 0 warnings; **585 backend tests passed** (81 unit / 504 integration; the two failures of the first run fixed and rerun); frontend format, lint, check and build pass; `check:routes` 646 routes, 0 new gaps; `npm run e2e` 13/13. Local storage only.
- **Backups and test database (owner's go-ahead, 23 November; done live by the Azure session):**
  - **Q16, database:** Cosmos `cosmos-parishlife` continuous backup changed from `Continuous7Days` to `Continuous30Days`, completed 11:13 UTC. (`az cosmosdb update --continuous-tier` silently kept 7 days on CLI 2.83.0; the change was applied with an ARM PATCH of `backupPolicy`, api-version 2024-11-15.) The 30-day tier adds a small backup-storage charge.
  - **Q16, files:** already 30 days, unchanged. `storageparishlife` has blob soft delete 30 days, container soft delete 30 days and blob versioning on.
  - **Q16, quarterly restore test:** not scheduled yet. Next: restore to a point in time into a new account or database, check it, then delete it.
  - **Privacy page:** "the last 7 days" became "the last 30 days" (English and Arabic). The effective date is now 23 November 2026, and `legal-pages.md` is updated.
  - **Q26, test database:** `ParishLifeTest` created 11:14–11:17 UTC in the same serverless account, with the five manifest containers and index policies. It was made with `tools/Initialize-Cosmos.ps1 -ManifestPath <copy with database ParishLifeTest> -Apply`; a `-WhatIf` re-run shows all five "already matches". It is empty and must never hold real data.
  - **Access:** the app's managed identity `id-parishlife` has Cosmos data access scoped to `dbs/ParishLife` only, so the live app cannot reach the test database. The owner's developer account has account-wide data access.
  - **Live tests (code, 23 November):** `ParishLife.IntegrationTests/Live` (`LiveCosmosTests`): commit/read/replay, stale-version conflict, failed batch keeps nothing, filtered page, through `RecordTransactions` on `CosmosDocumentDatabase`. They skip unless `PARISHLIFE_LIVE_COSMOS_DATABASE` is set, accept only `ParishLifeTest` (`ParishLife` was checked to be refused before any connection), and sign in with the developer account (managed identity excluded). How to run: `docs/operations/live-tests.md`. **Not run against Azure yet:** the Cosmos firewall is closed to zero IP exceptions; opening it for a run needs the owner's go-ahead in the Azure session. Checks: Release build 0 warnings; the guard test passes, the three live tests skip by default.
  - The production `ParishLife` containers already match the manifest at `e8df0fa` (`-WhatIf`: all "already matches"). The `___Cosmos` database in the account was not created or touched by this work.
  - **Deployed (owner's go-ahead, 23 November):** `180b546` (`e8df0fa` plus this privacy wording), 11:27:32–11:29:57 UTC, `RuntimeSuccessful`.
    - Built with `tools/Publish-ParishLife.ps1` from a clean detached worktree: 147 files. Compared with live `d8ca9d1`, only `ParishLife.Api.dll`/`.pdb`, `wwwroot/index.html`, `wwwroot/privacy.html` and the portal chunk changed (`portal-C2zn7TId.js`).
    - Before deploying: **585 backend tests passed** (81 unit / 504 integration); frontend format and build pass.
    - After: `/health/live` and `/health/ready` 200; index/public/privacy/terms 200; the privacy page serves "last 30 days" in both languages with effective date 23 November; anonymous `POST api/notifications/test` 401. No exceptions, error traces or 5xx in App Insights for the first minutes.
    - The live push test of `d8ca9d1` (22 November) succeeded on the owner's iPhone.
- **Free coverage (owner decision, 23 November: "a free option whether I choose to give a parish"), code only, not deployed:**
  - `POST api/parishes/{id}/billing/free-coverage` (operator only, `BillingService.GrantFreeCoverageAsync`): chosen modules plus core, a start, an optional end (none = 9999-12-31) and a reason. Stored as `Coverage.Complimentary` with `GrantedBy` and `GrantReason`; no invoice, receipt or payment; audit `subscription.grant_free` carries the reason. Same verified-parish, no-overlap and parish-revision rules as paid coverage; `RequireModuleAsync` treats it the same.
  - Screen: Access and billing → Plans and coverage → "Grant free coverage" (operators; every module ticked by default). Modules in force shows "Free (granted by a ParishLife administrator)" and "no end".
  - Test: `FreeCoverageTests` (non-operator refused, chosen modules unlocked and others not, no invoice, replay, overlap refused).
  - Not built: ending free coverage early (choose an end date when granting).
  - **Deployed (owner's go-ahead "Yes, deploy", 23 November), by the Azure session:** `a5e32a1`, built with `tools/Publish-ParishLife.ps1` from a clean detached worktree (147 files; compared with live `180b546` only `ParishLife.Api.dll`/`.pdb`, `wwwroot/index.html` and the portal chunk `portal--nrzyEV_.js` changed). `az webapp deploy --clean` 12:22:17–12:24:00 UTC, RuntimeSuccessful. After: `/health/live` and `/health/ready` 200; index, public and privacy 200; anonymous `POST …/billing/free-coverage` 401; Application Insights only the usual start-up TaskCanceledException, no 5xx. The owner has not granted free coverage on the live church yet.
  - **Checks, SDK 10.0.401:** Release build 0 warnings; **587 backend tests passed** (81 unit / 506 integration; 3 live Cosmos tests skipped by design); frontend format, lint, check and build pass; `check:routes` 647 routes, 0 new gaps; `npm run e2e` 13/13. Local storage only.
- **Owner fix list, first batch (23 November), code only, not deployed:**
  - (8) Office access by username or email (`GrantAccessDto`/`RevokeAccessDto.Account`, `IAccountDirectory.FindIdAsync`), with grouped permission checkboxes (`permission-picker.jsx`; an area ticks all its permissions, opened areas allow unticking; denials under "Advanced").
  - (2, 3) A registered church appears in Organizations at once and opens a "Set up this church" checklist (modules, location, details and Mass times in Parish settings, office access, priest and hand-over, ministries, parishioners); each church row has the button.
  - (4) Clearer archdiocese fields; (6) coordinates source is a dropdown and latitude/longitude accept decimals (`step=any`); (7) the payer shows by name.
  - (9) The site root serves `public.html`; the portal stays at `/index.html`; the Home Screen app now starts at `/index.html?source=app` (`FrontendHostingTests` asserts both).
  - (12) `styles/admin-workspace.css`: one bordered card per record, spaced sections and headings, grouped open-by-reference box, form labels apart from fields (logical properties for Arabic).
  - Removed the leftover ownership-review label from the admin screen.
  - Demo steps for every role: `docs/operations/demo-setup.md` (the priest and ministry leader need the archdiocese, its bishop, and a second operator to review the bishop).
  - Test: `The_controller_grants_office_access_by_email_and_an_unknown_name_is_refused`.
  - **Checks, SDK 10.0.401:** Release build 0 warnings; **588 backend tests passed** (81 unit / 507 integration; 3 live skipped by design); frontend format, lint, check and build pass; `check:routes` 0 new gaps; `npm run e2e` 13/13. Not checked by eye in a browser.
  - **Deployed (owner's go-ahead "Yes, deploy", 23 November), by the Azure session:** `0d35ee3`, built with `tools/Publish-ParishLife.ps1` from a clean detached worktree (147 files; compared with live `a5e32a1` only `ParishLife.Api.dll`/`.pdb`, `wwwroot/index.html`, `wwwroot/site.webmanifest` and the portal chunks `portal-7II5N9rA.js`/`portal-DxrgOLKk.css` changed). `az webapp deploy --clean` 13:02:01–13:04:02 UTC, RuntimeSuccessful. After: `/` serves the public page with its Content-Security-Policy; `/health/live` and `/health/ready` 200; index, public and privacy 200; manifest `start_url` `/index.html?source=app`; Application Insights no exceptions, error traces or 5xx. Not checked by eye in a browser yet.
  - **Still open from the list:** (5) country-code picker for the contact; (10) signing in straight after the sign-up email code; (11) the browser passkey prompt showing the username; the parish switcher refreshing right after registering (it shows the church after a reload).
- **Parish switcher fix (23 November), code only, not deployed:** the owner could not choose their church. Capacities found office grants only in parishes the account follows or serves; now `IParishRepository.GrantParishIdsAsync` (a bounded cross-partition query of unrevoked grant rows by `accountId`, already indexed) adds those parishes, and the grant itself is still checked. A super admin now starts in Administration and the switcher has a "ParishLife administration" entry to return from a church. Test: the controller and a secretary who follow nothing find the parish (`ParishControlTests`). Checks: Release build 0 warnings; full backend run 587 passed with one failure, `RegistrationIntegrityTests.Assigned_checkin_and_cashier_only_accounts…`, which passed 5/5 on rerun (flaky timing, not this change); frontend format, lint, check, build pass; `check:routes` 0 new gaps; `npm run e2e` 13/13 (the operator test first failed because the operator opened in the church; fixed by the Administration default).
  - **Deployed (owner's go-ahead "Yes, deploy", 23 November), by the Azure session:** `fa17394` (147 files; only the API dll/pdb, `index.html`, `public.html` and the portal/public/api-data chunks changed). The full run there passed 588 (the flaky registration test passed). The query paths (`/type`, `/data/accountId`, `/data/revoked`) are in the unchanged TenantControl manifest. `az webapp deploy --clean` 13:52:19–13:54:06 UTC, RuntimeSuccessful. During the file swap three sign-ins and one `auth/me` returned 500 (`BadImageFormatException`, half-replaced assembly); since 13:54 everything answers normally. This is the deploy window, not a code defect (runbook note in `frontend-hosting.md`). The owner has not checked the switcher by eye yet.
- **27 November: combined deploy, Firefox check, upgrades.**
  - **Deployed (owner's go-ahead):** `f688990` = my prerendering (cf9d39d, c6880c5) + Georges's A3 public site (6b7e984), Giving spacing (1006746), Inbox mail/chat layout (f688990) + monitoring (3c61a49). Combined checks here first: 686 backend passed (3 live skipped), frontend checks and build with prerender, e2e 46/46. The Azure session deployed it 22:49–22:51 UTC, RuntimeSuccessful; production smoke 3/3, no 5xx. public.html carries the prerendered intro; its parish list is empty until a church publishes its profile (expected). Rollback worktree kept: deploy-f6d150a.
  - **Firefox check (a5d8d0e):** `e2e/firefox-portal.spec.mjs` runs the public page → sign in → reload portal journey in Playwright's Firefox. On this PC Firefox is installed but Windows build 26300 refuses to start it ("side-by-side configuration is incorrect"), so the test skips with that reason; the owner said to skip Firefox if it does not work. The portal still does **not** register the service worker (Georges's condition).
  - **Upgrades (one commit each):** Prettier 3.10.1 with a format-only reformat (6325fcc), Playwright 1.65.1 (bf8b6e7), React 19.3.1 (67493f7), Vite 8.4.0 with plugin-react 6.3.0 (cac7008), Node pinned: frontend/.nvmrc 26 (as CI) and engines >=22.12 (5dedea1). Not .NET 11 or Aspire 17 (CLAUDE.md: .NET 10).
  - **Upgrades deployed (owner's yes):** `bc5c7eb`, 27 November 06:45–06:47 UTC, RuntimeSuccessful; built with Node 23.6.1 (meets engines); 0 warnings, 395 files (Vite 8 adds small chunks; every page keeps its script tags); production smoke 3/3, no 5xx. The Azure session looked at the A3 public site and the landing page by eye: they render. Console shows 404s for content not configured yet (install name, homepage text, the unpublished church profile). The landing page now honours ?lang (next commit).
  - **Owner list of 27 November** is being built by four helpers on branches `agent/superadmin-messaging`, `agent/speed-spacing`, `agent/people-fixes`, `agent/households-sacraments` (worktrees under `ParishLife/.claude/worktrees`); they paused at the usage limit and were resumed. This session merges them, tests them together, pushes and asks for the deploy.
  - **Still open:** by-eye checks of the A3 public site, the Inbox, the phone picker and signing in after the code; the portal service worker (needs Firefox to pass somewhere); owner items: Cloudflare rule for contact@, WhatsApp, Google Maps, legal texts, publishing Saints Abda & Foucas's profile (so the directory lists it).
- **Owner open items, 26 November (pushed; first batch deployed):** product page number/email/price wording (8757dfa), honest sign-up wording and sign-in straight after the code (ecbb843, e2e f6d150a), unlink removes the invitation role (ba3209f), 400 ms refusal floor for sign-in timing (773f76b), switcher refresh after registering (5a5e5b2), country-code phone picker (3a2169e). **Deployed** by the Azure session at the owner's yes: `f6d150a`, 15:56–15:59 UTC, RuntimeSuccessful, production smoke 3/3, no 5xx. Item 7 (passkey prompt): no code change; it is Edge's password manager. Not checked by eye: the phone picker and the sign-in after the code. contact@ needs the owner's Cloudflare routing rule.
  - **Prerendering (90e051e, pushed, not deployed):** landing.html rendered at build time and hydrated; public.html gets the directory list or the parish text from the server. Full checks: 686 backend passed (3 live skipped), e2e 46 passed. Demo address on the product page changed to parish-life.org / demo-parish.
  - **In progress, NOT committed (worktree only):** `frontend/src/portal/main.jsx` registers the service worker and `frontend/e2e/firefox-portal.spec.mjs` checks public.html → sign in → reload the portal in Playwright's Firefox (installed 26 November, owner approved the download). The first run failed because the spec was picked up mid-run before a build with the registration; rerun it with `npm run e2e -- e2e/firefox-portal.spec.mjs` after `npm run build`, format both files, and commit the registration only if it passes.
  - **Next:** upgrades approved by the owner (downloads OK): Prettier, Playwright, React 19.3, Vite 8, pin Node; one commit each with full checks. Not .NET 11 or Aspire 17.
- **Invitation accepted by the wrong account (owner report, 24 November), code only, not deployed:** the owner's super-admin account became linked to the person record "Elie Bou Khalil" in Saints Abda & Foucas, so inside that church the portal showed "Elie Bou Khalil · Super Admin" (the linked record's name with the account's real role; no privilege was given to anyone: only the bootstrap command sets the super-admin flag). Cause: opening an invitation link while signed in accepted it at once, without asking; the sessionStorage hand-over added on 23 November made that more likely. Fixes: the portal now shows "Is this you? This invitation is for <name> · <parish>" and accepts only on "Yes, this is me"; the server refuses acceptance by the invitation's issuer (`issuer_cannot_accept`); a new office action, People → person → "Unlink account" (`POST …/people/{id}/account-link/remove`, reason audited as `person.account_unlinked`), removes a wrong link so a new invitation can be issued. Test: `The_issuer_cannot_accept_its_own_invitation_and_the_office_can_undo_a_wrong_link`. Checks: Release build 0 warnings; **593 backend tests passed** (81 unit / 512 integration; 3 live skipped); frontend format, lint, check and build pass; `check:routes` 0 new gaps; `npm run e2e` 13/13. **Data repair after the deploy:** the owner unlinks Elie's record (reason: accepted by the wrong account) and sends Elie a new invitation. **Also reported:** Elie received no sign-up code; the code request answers neutrally, so the cause (no account created, already confirmed, the one-minute resend limit, or a Resend failure) needs the live logs.
  - **Deployed (owner's go-ahead, 24 November), by the Azure session:** `ae683e4` (147 files; only the API dll/pdb, `index.html` and the portal chunk changed). 593 tests passed before deploying. `az webapp deploy --clean` 22:48:25–22:50:28 UTC, RuntimeSuccessful; after it, pages and health 200 and Application Insights showed no errors. Still to do by the owner: unlink Elie's record and send him a new invitation.
  - **Why Elie got no code (read-only Application Insights, 23 November UTC):** the invitation was accepted at 22:01 from the owner's own browser (the bug above). Elie's sign-up at 22:03 was accepted (202), but his email already belonged to a confirmed ParishLife account, so registration took the neutral duplicate path and created nothing, and the code requests skip confirmed accounts. No Resend call was made and there were no Resend failures. He then confirmed and signed in with that existing account; the invitation answered 409 because it was already used. The neutral reply works as designed, but the screen leaves the person waiting.
  - **Open follow-ups:** (1) after a sign-up or code request, say "If this email is new, a code is on its way. Already have an account? Sign in, or reset your password", without revealing whether the email exists; (2) `UnlinkAccountAsync` removes the link and claim but not a role an invitation applied (`RoleApplied`): unlinking should also revoke that grant, or warn the office.
- **Super admin acts in the bishop's place for appointments (owner, 23 November: "the priest can be appointed by the super admin as well, and the ministry leaders too"), code only, not deployed:** `StaffAppointmentService` accepts the bishop or a current super admin (both with password and authenticator) for invite, suspend/resume/revoke/review and head designation; a super admin's appointment records `platform-operator:<account>` as its authority, and acceptance checks that account is still an active super admin. `ParishJurisdictionService.DecideAsync`/`GetAsync` accept a super admin, and `MinistryLeadershipService` lets a super admin name and manage leaders (personal capacity, verified parish). A priest still needs the church under a verified archdiocese (no bishop needed). The Appointments tab offers inviting to super admins. Two older tests now refuse an ordinary account instead of a super admin; new `SuperAdminAppointmentTests` (2). Checks: Release build 0 warnings; **592 backend tests passed** (81 unit / 511 integration; 3 live skipped); frontend format, lint, check and build pass; `check:routes` 0 new gaps; `npm run e2e` 13/13.
  - **Deployed (owner's go-ahead "Yes, deploy", 23 November), by the Azure session:** `187cdc8` (includes `33ac272`; 147 files, only the API dll/pdb, `index.html` and the portal chunk changed). The Azure session reviewed the super-admin fallbacks: each calls `RequireOperatorAsync` (active, verified operator, 2FA and an mfa claim); a non-operator gets `operator_required`, so the priest path still works; acceptance re-checks the issuing super admin. 592 tests passed before deploying. `az webapp deploy --clean` 15:39:44–15:41:46 UTC, RuntimeSuccessful; after it, pages and health 200 and Application Insights showed no errors. Unlike bishop appointments, a super admin's priest appointment has no second-person review; the owner was told and may ask for one. Not checked by eye in a browser.
- **Invite with a role (owner, 23 November), code only, not deployed:** People → a person → "Invite to complete account" now asks for a role: Parishioner (none), Secretary, Treasurer or chosen permissions. Only the parish's controller may attach one (`owner_authority_required`), only permissions it holds, never `access.manage` (`delegation_forbidden`). Stored as `PersonInvitation.RoleAllows`; when the person accepts with their own account, the role merges into their local grant in the same commit, if the issuer still controls the parish (`RoleApplied`). The preview shows the role. Each person chooses their own password; priests are appointed by the bishop and ministry leaders by the priest. The invitation link now survives a Google/Microsoft sign-up round trip (kept in sessionStorage for the tab) and shows a confirmation. Test: `The_controller_invites_a_person_with_a_role_that_applies_when_they_accept`. Checks: Release build 0 warnings; **589 backend tests passed** (81 unit / 508 integration; 3 live skipped by design); frontend format, lint, check and build pass; `check:routes` 0 new gaps; `npm run e2e` 13/13. Not checked by eye in a browser.
  - **Deployed (owner's go-ahead "Yes, deploy", 23 November), by the Azure session:** `3cff48c` (147 files; only the API dll/pdb, `index.html` and the portal chunk changed). The Azure session reviewed it: role only from the controller and only held permissions, never `access.manage`, applied only if the issuer still controls the parish, and no `AllowRecoverySession` on the invitation routes. 589 tests passed before deploying. `az webapp deploy --clean` 15:07:36–15:09:30 UTC, RuntimeSuccessful; after it, pages and health 200 and Application Insights showed no errors. Not checked by eye in a browser.
  - **Follow-up (code, not deployed):** on acceptance only the permissions the issuer still holds are given (`access.manage` never). New test `An_invitation_role_is_not_applied_when_its_issuer_lost_control_before_acceptance`. Checks: Release build 0 warnings; **590 backend tests passed** (81 unit / 509 integration; 3 live skipped).
- **Opening a church without an archdiocese (23 November), frontend only, not deployed:** choosing Saints Abda & Foucas failed with "Only a parish under an archdiocese's jurisdiction is handled here": the audit loader read the bishop-only operating-status history, which answers 409 for a church with no archdiocese; it now shows no history there. The switcher also closes when a parish fails to open. Roles: the controller's grant (it alone holds `access.manage`) now maps to the Parish administrator view instead of Secretary, and a super admin keeps the full administrator view inside any parish. Checks: frontend format, lint, check and build pass; `check:routes` 0 new gaps; `npm run e2e` 13/13. The browser tests use a church under an archdiocese, so opening a church without one is not covered by them; check it by eye after the deploy.
  - **Deployed (owner's go-ahead "Yes, deploy", 23 November), by the Azure session:** `7f40159` (147 files; API dll/pdb build stamp only, `index.html`, `public.html` and the portal/public/api-data chunks). Frontend check, lint and `FrontendHostingTests` passed there. `az webapp deploy --clean` 14:48:51–14:50:48 UTC, RuntimeSuccessful; the owner was told not to sign in during the swap. After: `/` and `/index.html` 200, health 200, `auth/me` 401, `auth/csrf` 200; Application Insights only the usual start-up TaskCanceledException. The owner has not yet confirmed opening Saints Abda & Foucas.
- **Owner fix list after registering the first real church (23 November, via the Azure session), original list:** (2) a "Set up this church" checklist opened right after registering, and the parish switcher showing the new parish; (3) a new church in Organizations at once; (4) one archdiocese field when registering; (5) a country-code picker for the contact; (6) a dropdown for the coordinates source and decimal latitude/longitude; (7) the payer's name, not its reference; (8) office access by name, username or email with grouped permission checkboxes; (9) parish-life.org opening the public home page; (10) sign-up signing the person straight in after the email code (two-factor and recovery boundaries kept); (11) the browser passkey prompt showing the username unasked on sign-in; (12) bordered cards and consistent spacing in the administration tabs, in English and Arabic.
- **npm audit (build tools only):** 4 "high" ReDoS advisories in `picomatch` (GHSA-fc5q-39xc-vjpf) via Vite's `fdir` and `tinyglobby`. The advisory covers every published `picomatch` version, and 4.0.7, the latest, is installed. npm's only "fix" is downgrading Vite to 6.2.7, a breaking older major, so nothing was changed. Production dependencies: 0 vulnerabilities, and these packages are not in the deployed package. Re-check when `picomatch` publishes a fixed version.
- **Resuming after a stop:** workers do not survive a session or usage-limit stop, but their edits stay on disk. For each `PL-areas/<area>`, check `git status` and `git log fullstack-integration..HEAD`, then continue that area from its uncommitted diff and its module doc (`docs/frontend-modules/<module>.md`); do not restart it from scratch.
- **Next:** merge each finished `fullstack2-<area>` into `fullstack-integration` one at a time (expected conflicts: `ServiceCollectionExtensions.cs`, `docs/cosmos/containers.json`, `frontend/src/portal/model/modules/index.js`, `frontend/scripts/check-api.mjs`, `route-gaps.json`); after each, run `npm run format:check && npm run check && npm run check:routes && npm run build` and `dotnet test ParishLife.slnx -c Release` on SDK 10.0.401; push. At the end update `docs/features/coverage.json` and `implementation-status.md`.

## Backend continuation attempt (13 November 2026; merged into `fullstack-integration` on 18 November)

- Actual checkout remains `backend` tracking `upstream/backend` (`https://github.com/georges33tawk24/parishlife.git`), HEAD `b2aaf92` (`Record Cosmos/Storage firewalls closed back to zero IP exceptions`). No fetch, merge, commit or push was performed in this attempt.
- The user's pre-existing unrelated working changes were present in `ParishLife.Api/Properties/launchSettings.json`, `ParishLife.AppHost/ParishLife.AppHost.csproj`, and `ParishLife.AppHost/packages.lock.json`; they were preserved untouched.
- Implemented an X04 backend slice: `GET /api/parishes/{parishId}/letters/{letterId}/notification-outcome` uses the existing MFA staff/priest reader gate, validates the exact letter and owning request, and returns only the safe notification outcome projection. Added a regression for a verified-account release returning `Stored` and applicant denial. Updated the document-signature runbook and X04 `remaining` entry. Files: `ParishLife.Api/Controllers/Documents/RequestLettersController.cs`, `ParishLife.Api/Services/Documents/RequestLetterService.cs`, `ParishLife.IntegrationTests/RequestLetterTests.cs`, `docs/operations/document-signatures.md`, and `docs/features/coverage.json`.
- Verification attempted: `dotnet test ParishLife.IntegrationTests/ParishLife.IntegrationTests.csproj -c Release --filter FullyQualifiedName~RequestLetterTests --no-restore` — did not start because `global.json` requires SDK `10.0.401`, absent here; installed SDKs are `8.0.403`, `9.0.300`, `10.0.102`, and `11.0.100`. Do not bypass the repository pin. `git diff --check` passed. Test/build status remains unverified.
- Work remains uncommitted and unpublished. Next executable step: run the focused `RequestLetterTests` and then the full required build/test set under SDK 10.0.401; fix any failures, then continue with workflow transition notifications/return-for-information or broadcast notification integration. The external reviewed requirements archive referenced in `SOURCES.md` was not present at its indexed path on this machine; continue to distinguish runbook proposals from owner-approved policy.

## Repository and preserved work

- Working folder: `C:\Users\User\source\repos\ParishLife`.
- Incoming repository: `https://github.com/georges33tawk24/parishlife.git`, branch `backend`, remote `upstream`; pulled baseline/local backend and observed remote-tracking HEAD `a4cb405899bb6fde0e9c186dde1f4bb1ee1be24f`.
- Active development branch: **`backend`**, tracking **`upstream/backend`** in Georges's repository. The owner explicitly authorized ongoing verified pushes there. The 331-test checkpoint, including code `18fc9c6d20d3e8018d1c3caccc1f7b4951816a17`, was pushed and remotely confirmed at **`7b3d28510fa28f6d0802d42d92ce2dcd09b47632`**. The prior development branch is preserved.
- Local fixes: `9ea2473` MFA replay; `ba843cf` request-file/registration integrity; `7bed477` durable required notices; `18fc9c6` parish-scoped identities and proven legacy-pending recovery. Documentation commits may follow without changing that tested code.
- `origin` remains Colin's different repository (`https://github.com/ColinSleiman/ParishLife.git`). The latest owner instruction explicitly selects Georges's remote and backend branch; do not publish to `origin` by assumption.
- Earlier continuation branch `dev/colin/claude-handover-20261110` and `dev/colin-following` WIP at `c81a30de2431933c2efe7dfad016f622325d24c5` remain preserved. The latter's eleven unwired following DTO/models must not overwrite the newer membership implementation.

## Azure connection checkpoint (11/11 evening, owner's Windows machine)

- With the owner's approval: Cosmos index policy aligned to the manifest (all five containers match; all were empty); App Service settings set (12 names, `BackgroundJobs__Enabled=false`), Always On on; **API `190b2c2` deployed** to `app-parishlife`.
- Verified live: `/health/live` and `/health/ready` 200, `/api/auth/capabilities` 200; Key Vault-wrapped key ring written to private Blob by the managed identity and **unwrapped after restart** (Key Vault `UnwrapKey` 200); Application Insights ingestion; App Service health check `/health/ready` 200; background jobs on and querying Cosmos successfully.
- **Bootstrap, sign-in and restart-persistence are all verified (13 November 2026):** both `colinsleiman` and `georgestawk` are configured Super Admins with working password + MFA; a live sign-in through the deployed API survived an app restart using the same session cookie. Firewall cleanup (removing the owner's maintenance IP) follows immediately after. Details and exact commands: [AZURE-CONNECTION.md](AZURE-CONNECTION.md).

## Verified checkpoint (11/11, Linux cloud session, ponytail working style)

- `backend` pushed to Georges's repo (in the cloud checkout the remote is `origin` = `georges33tawk24/parishlife`), fast-forward only, no force. Work was done by parallel card agents on isolated worktrees and integrated/verified here one card group at a time.
- **All 20 previously not-started backend cards now have a verified backend slice, each recorded `partial`** (requirements are *proposed* unless the runbook says otherwise):
  - W01/W02 custom forms + workflow runs (`custom-workflows.md`).
  - O08 bishop overview/map, X06 site metrics + Insights, W04 scheduled in-app report delivery (`bishop-overview.md`, `site-insights.md`, `scheduled-reports.md`).
  - N04 source-scoped outcome reads (parish status/incidents/concerns), N02 exact-message review, N05 broadcasts/templates (`communications.md`, `required-notification-outbox.md`).
  - X03-X05 exact document authorization, priest-signed request letters, public verification/revocation (`document-signatures.md`).
  - SUB09 future payer transfer, SUB12 contested ownership recovery (`subscription-payer-transfer.md`, `parish-ownership-recovery.md`).
  - X01 passkeys, A06 contact verification/email change/external sign-in, X13 optional Turnstile + capability endpoint (`account-sign-in-methods.md`).
  - X09 public directory/nearby, X11 install manifest + offline cache policy, X12 authority-approved liturgical calendars, D01 combined home/capacities (`public-directory-and-offline.md`, `liturgical-calendars.md`, `combined-home.md`).
  - W07 private operator snapshot export/verify/restore-into-empty-target (`data-snapshot-and-recovery.md`, maintenance tool only).
- Final checks on SDK 10.0.401 after integrating W07: `dotnet restore --locked-mode` OK; Release build **0 warnings/errors**; **453 tests passed (56 unit / 397 integration), 0 failed**; API-only publish 63 top-level / 73 recursive files, no test/AppHost/maintenance components. Local storage only; no live Azure, no deployment, no bootstrap.
- Register: **146 partial / 3 not started (U01, U02, U04 — frontend-only, deferred) / 0 accepted** of 149. Partial is not complete.

### Owner/authority decisions surfaced (not decided here)

- Workflows: priest appointments cannot hold `workflows.manage`; process ownership needs an explicit parish grant.
- Signatures: electronic-signature validity (U05) unsupplied — digital copies state "reference only"; letters are priest-signed because `documents.sign` is not grantable; signing uses a TOTP code (reusable within its 30 s window; one-time challenge/passkey is the upgrade).
- Reporting: no small-count suppression threshold supplied for bishop aggregates; jurisdiction filter is in-memory (bounded) pending an index path that needs separate authorization; site-metric retention (S32.01) unset.
- Communications: N02 review window (5-1440 min) and platform-operator reviewer audience, and N05 2,000-recipient bound, are implementation choices.
- Subscriptions: archdiocese representative = the registering account (today a platform operator) — a named representative is probably wanted; ownership claims decided by one operator, no second reviewer/appeal/church confirmation; no freeze while contested.
- Accounts: passkey treated as a first factor, not MFA; S06.05 "sign in while unverified" not adopted; email provider, Google/Microsoft app registrations and Turnstile keys not configured (features report unavailable/NotConfigured).
- Calendars: actual rite/authority/calendar source (U02) unsupplied; bishop-only preparation is a proposed reading.
- Backup: U15 retention/schedule/RPO/RTO/custodian/storage location unset; snapshots contain personal data and must be stored privately.

## Earlier verified checkpoint (11/10 evening, Linux cloud session)

- Commit `eb95cd5` (notification outcomes + X07 CRM) was independently built and tested on SDK 10.0.401 (exact `global.json` pin): initial run **363/365** — two failures, both fixed here: (1) `InboxService.ListAsync` hid office-staff conversations after they were opened (read-state row existed but staff are not participants, and the office branch skipped already-seen ids) — now only genuinely listed ids are skipped; (2) `Wrong_or_rematched_request_subjects...` test omitted the required `AuthorityEvidence` on `match-subject`, so it never reached the commit conflict it asserts (test-only fix).
- Result after fixes: **365 tests passed (56 unit / 309 integration), 0 failed/skipped; Release build 0 warnings/errors.** Not a live Azure acceptance.

## Earlier verified checkpoint

- **331 tests passed: 56 unit / 275 integration; 0 failures/skips.** Full five-project Release build, including Aspire: 0 warnings/errors. API-only publish: 61 top-level / 71 recursive files, no test/AppHost/maintenance/local-data components.
- Evidence/registration fixes first passed 314 tests; notification recovery reached 324, and seven scoped-identity regressions now bring the suite to 331. The earlier MFA 279-test and incoming author's 278/220-test reports are historical.
- Source audit: 803 C# files with summaries; 353 DTO / 179 model/enum files; no convention violations, API project references or default development business documents.
- Azure CLI still requested `az login`. No live Azure acceptance/write, resource or RBAC/index changes, deployment or bootstrap. Aspire was built, not relaunched; actual hosted-worker verification used the isolated API test host.
- Feature register remains **149 cards: 124 partial / 25 not started / 0 fully accepted**. Q11/E01/E02/E05/N04 have stronger verified behavior; those broad cards still have acceptance gaps.
- [Detailed verification, commands and limitations](../verification/backend-2026-11-10-notification-identity.md); [sanitized counts](../verification/backend-2026-11-10-notification-identity-results.json).

## Addressed review findings

The seven findings in the original [pull review](REVIEW-2026-11-10.md) now have local implementation/regressions: original request/parish ETag fencing; content-bound immutable file retries; current applicant file gates; lifecycle event eligibility; versioned limited door/cashier reads; viewed-form pinning; and durable required-notice staging/recovery. This is focused verification, not a full audit or product acceptance.

See [requests](../operations/requests.md#case-files-q11), [registrations](../operations/event-registrations.md) and [notification recovery](../operations/required-notification-outbox.md). The file gate requires verified parish/requests coverage for both file audiences; it does not invent retention exemptions. Ordinary unlinked applicants remain supported without MFA. Notification history audiences preserve their actual own-case relationship, including confidential submitter tracking after leaving a parish.

## Immediate next executable work

No card is not-started on the backend side; the remaining work is acceptance depth inside the 146 partial cards. In priority order:

1. Get owner/authority answers for the decisions listed above; they unblock several cards' remaining criteria.
2. Work through `remaining` in `docs/features/coverage.json`, in dependency order: notification transitions for workflows/letters/broadcasts, workflow return-for-information/parallel approvals/deadlines, combined notification center/reminders/quiet hours (N04), account-side index for legacy grants/ministry leadership (D01), streaming snapshot export (W07).
3. With explicit authorization only: live Cosmos/Blob/Key Vault/managed-identity acceptance, index path additions (e.g. `/data/jurisdictionArchdioceseId`), provider configuration (email, OAuth, Turnstile), deployment.
4. Frontend integration (U01/U02/U04 and the frontend parts of partial cards) remains deferred.

Keep `AGENTS.md` and the [master brief](MASTER-PROMPT.md) conventions: single production API, MiniDevOps class/file layout, top-of-code summaries, existing Azure only, no business seeds, explicit two-account operator bootstrap, isolated meaningful tests and no frontend integration. Live Azure acceptance requires authorized access; CLI authentication is currently missing, not evidence that infrastructure is absent.

Update this checkpoint after verified work. No process is promised to continue after a turn ends; the next **continue** resumes from these actual files.
