# Current ParishLife continuation state

Updated **10 November 2026**, owner timezone Asia/Beirut. Read this before acting on **continue**, then verify actual Git state. The owner currently wants implementation to continue here; a Claude switch is deferred.

## Repository and preserved work

- Working folder: `C:\Users\User\source\repos\ParishLife`.
- Incoming repository: `https://github.com/georges33tawk24/parishlife.git`, branch `backend`, remote `upstream`; pulled baseline/local backend and observed remote-tracking HEAD `a4cb405899bb6fde0e9c186dde1f4bb1ee1be24f`.
- Active development branch: **`backend`**, tracking **`upstream/backend`** in Georges's repository. The owner explicitly authorized ongoing verified pushes there. The 331-test checkpoint, including code `18fc9c6d20d3e8018d1c3caccc1f7b4951816a17`, was pushed and remotely confirmed at **`7b3d28510fa28f6d0802d42d92ce2dcd09b47632`**. The prior development branch is preserved.
- Local fixes: `9ea2473` MFA replay; `ba843cf` request-file/registration integrity; `7bed477` durable required notices; `18fc9c6` parish-scoped identities and proven legacy-pending recovery. Documentation commits may follow without changing that tested code.
- `origin` remains Colin's different repository (`https://github.com/ColinSleiman/ParishLife.git`). The latest owner instruction explicitly selects Georges's remote and backend branch; do not publish to `origin` by assumption.
- Earlier continuation branch `dev/colin/claude-handover-20261110` and `dev/colin-following` WIP at `c81a30de2431933c2efe7dfad016f622325d24c5` remain preserved. The latter's eleven unwired following DTO/models must not overwrite the newer membership implementation.

## Verified checkpoint

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

**Current batch is in progress:** A10/A11/A12/A13/Q01/Q13/E02/E04/N01/N04 — source-authorized notification outcomes plus missing registration/document notices, with shared reader and privacy/failure regressions. Additional previously not-started X07 (manual parish CRM) and X08 (authored platform homepage content) are being implemented independently. Their code/tests are not yet fully verified; the 25 not-started / 124 partial count remains the last accepted register until evidence is recorded. Finish and verify this work before selecting another batch, then push to Georges's backend without force.

1. **N04 component outcome visibility:** read proposed S31.10 and the current outbox runbook. Trace each source command's permitted response/read projection before exposing Pending/Stored component outcomes. Design source-scoped status access without a general private-case recipient/count feed; test unauthorized, unrelated and recovery actors. Pending is not proof that a notice is absent, and Stored is not proof of reading/external delivery.
2. Scoped identity and narrow existing-pending legacy collision recovery are implemented/tested in `18fc9c6`; do not redo them or backfill missing historical events. Remaining invalid same-parish/receipt/version conflicts need authoritative operator evidence. Preserve rollout coordination and no automatic retention/deletion policy.
3. Continue remaining backend criteria in the canonical [coverage register](../features/coverage.json), following actual workflow/permission/field/acceptance references in [SOURCES](SOURCES.md). Preserve all 25 not-started cards, frontend deferral and unresolved policy/factual inputs. Do not count partial cards as finished.

Keep `AGENTS.md` and the [master brief](MASTER-PROMPT.md) conventions: single production API, MiniDevOps class/file layout, top-of-code summaries, existing Azure only, no business seeds, explicit two-account operator bootstrap, isolated meaningful tests and no frontend integration. Live Azure acceptance requires authorized access; CLI authentication is currently missing, not evidence that infrastructure is absent.

Update this checkpoint after verified work. No process is promised to continue after a turn ends; the next **continue** resumes from these actual files.
