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
- **In progress (11 areas):** sacraments, finance (from `9c1c291`); communications, requests (from `f5a9a0a`); ministries, registrations, facilities, member, administration, account, public (from `6951bcd`). Each worker follows the shared brief (CONVENTIONS.md plus: own worktree only, `-m:2` builds, commit and push `fullstack2-<area>` at each checkpoint, report at the end). Not started: the signed-in e2e host (after the merges).
- **Resuming after a stop:** workers do not survive a session or usage-limit stop, but their edits stay on disk. For each `PL-areas/<area>`, check `git status` and `git log fullstack-integration..HEAD`, then continue that area from its uncommitted diff and its module doc (`docs/frontend-modules/<module>.md`); do not restart it from scratch.
- **Next:** merge each finished `fullstack2-<area>` into `fullstack-integration` one at a time (expected conflicts: `ServiceCollectionExtensions.cs`, `docs/cosmos/containers.json`, `frontend/src/portal/model/modules/index.js`, `frontend/scripts/check-api.mjs`, `route-gaps.json`); after each, run `npm run format:check && npm run check && npm run check:routes && npm run build` and `dotnet test ParishLife.slnx -c Release` on SDK 10.0.401; push. At the end update `docs/features/coverage.json` and `implementation-status.md`.

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
