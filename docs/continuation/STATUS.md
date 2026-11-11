# Current ParishLife continuation state

Updated **11 November 2026**, owner timezone Asia/Beirut. Read this before acting on **continue**, then verify actual Git state. The owner currently wants implementation to continue here; a Claude switch is deferred.

## Frontend integration (branch `fullstack`, 11 November 2026)

At the owner's request, branch `fullstack` adds the React frontend from `frontend-new2` in `frontend/` and connects its foundation to this API: CSRF, sign-in with the authenticator step, sign-up, session and roles, and People list, add and archive. Every other module is marked "not connected" on screen. Status, gaps and owner decisions: `docs/frontend-integration.md`. No backend code changed on that branch.

## Repository and preserved work

- Working folder: `C:\Users\User\source\repos\ParishLife`.
- Incoming repository: `https://github.com/georges33tawk24/parishlife.git`, branch `backend`, remote `upstream`; pulled baseline/local backend and observed remote-tracking HEAD `a4cb405899bb6fde0e9c186dde1f4bb1ee1be24f`.
- Active development branch: **`backend`**, tracking **`upstream/backend`** in Georges's repository. The owner explicitly authorized ongoing verified pushes there. The 331-test checkpoint, including code `18fc9c6d20d3e8018d1c3caccc1f7b4951816a17`, was pushed and remotely confirmed at **`7b3d28510fa28f6d0802d42d92ce2dcd09b47632`**. The prior development branch is preserved.
- Local fixes: `9ea2473` MFA replay; `ba843cf` request-file/registration integrity; `7bed477` durable required notices; `18fc9c6` parish-scoped identities and proven legacy-pending recovery. Documentation commits may follow without changing that tested code.
- `origin` remains Colin's different repository (`https://github.com/ColinSleiman/ParishLife.git`). The latest owner instruction explicitly selects Georges's remote and backend branch; do not publish to `origin` by assumption.
- Earlier continuation branch `dev/colin/claude-handover-20261110` and `dev/colin-following` WIP at `c81a30de2431933c2efe7dfad016f622325d24c5` remain preserved. The latter's eleven unwired following DTO/models must not overwrite the newer membership implementation.

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
