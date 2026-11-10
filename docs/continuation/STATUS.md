# Current ParishLife continuation state

Updated **10 November 2026**, owner timezone Asia/Beirut. Read this before acting on **continue**, then verify actual Git state. The owner currently wants implementation to continue here; a Claude switch is deferred.

## Repository and preserved work

- Working folder: `C:\Users\User\source\repos\ParishLife`.
- Incoming repository: `https://github.com/georges33tawk24/parishlife.git`, branch `backend`, remote `upstream`; pulled baseline/local backend and observed remote-tracking HEAD `a4cb405899bb6fde0e9c186dde1f4bb1ee1be24f`.
- Active development branch: **`dev/colin/backend-reliability-20261110`**. Relevant backend code commit: **`7bed477618d27f5f4fe06a24bf343af2289db919`**. No push was performed; a fresh remote clone lacks these local changes.
- Local fixes: `9ea2473` MFA replay; `ba843cf` request-file/registration integrity; `7bed477` durable required notices. Documentation commits may follow without changing that tested code.
- `origin` remains Colin's different repository (`https://github.com/ColinSleiman/ParishLife.git`). An earlier push instruction for it is not authorization to publish to Georges's remote.
- Earlier continuation branch `dev/colin/claude-handover-20261110` and `dev/colin-following` WIP at `c81a30de2431933c2efe7dfad016f622325d24c5` remain preserved. The latter's eleven unwired following DTO/models must not overwrite the newer membership implementation.

## Verified checkpoint

- **324 tests passed: 56 unit / 268 integration; 0 failures/skips.** Full five-project Release build, including Aspire: 0 warnings/errors. API-only publish: 61 top-level / 71 recursive files, no test/AppHost/maintenance/local-data components.
- Evidence/registration fixes first passed 314 tests; ten notification-recovery regressions extend that result. The earlier MFA 279-test and incoming author's 278/220-test reports are historical.
- Source audit: 803 C# files with summaries; 353 DTO / 179 model/enum files; no convention violations, API project references or default development business documents.
- Azure CLI still requested `az login`. No live Azure acceptance/write, resource or RBAC/index changes, deployment or bootstrap. Aspire was built, not relaunched; actual hosted-worker verification used the isolated API test host.
- Feature register remains **149 cards: 124 partial / 25 not started / 0 fully accepted**. Q11/E01/E02/E05/N04 have stronger verified behavior; those broad cards still have acceptance gaps.
- [Detailed verification, commands and limitations](../verification/backend-2026-11-10-reliability.md); [sanitized counts](../verification/backend-2026-11-10-reliability-results.json).

## Addressed review findings

The seven findings in the original [pull review](REVIEW-2026-11-10.md) now have local implementation/regressions: original request/parish ETag fencing; content-bound immutable file retries; current applicant file gates; lifecycle event eligibility; versioned limited door/cashier reads; viewed-form pinning; and durable required-notice staging/recovery. This is focused verification, not a full audit or product acceptance.

See [requests](../operations/requests.md#case-files-q11), [registrations](../operations/event-registrations.md) and [notification recovery](../operations/required-notification-outbox.md). The file gate requires verified parish/requests coverage for both file audiences; it does not invent retention exemptions. Ordinary unlinked applicants remain supported without MFA. Notification history audiences preserve their actual own-case relationship, including confidential submitter tracking after leaving a parish.

## Immediate next executable work

1. **N04 scoped notification identity:** read proposed S31.09–S31.11 and the new outbox runbook. Design a versioned parish-scoped recipient identity that preserves matching legacy records/receipts and read state. Prove two parishes using the same client operation key can each store their own required notice. Current mismatch is safely Pending, but it is not automatic resolution. Reconstruct older missing obligations only with authoritative event/recipient evidence; never manufacture history.
2. Review how authorized callers/operators see durable Pending/Stored component outcomes without private recipient/content leakage. The work records and worker exist; broader status UX/API, queue metrics and retention policy are not fully accepted.
3. Continue remaining backend criteria in the canonical [coverage register](../features/coverage.json), following actual workflow/permission/field/acceptance references in [SOURCES](SOURCES.md). Preserve all 25 not-started cards, frontend deferral and unresolved policy/factual inputs. Do not redo completed fixes or count partial cards as finished.

Keep `AGENTS.md` and the [master brief](MASTER-PROMPT.md) conventions: single production API, MiniDevOps class/file layout, top-of-code summaries, existing Azure only, no business seeds, explicit two-account operator bootstrap, isolated meaningful tests and no frontend integration. Live Azure acceptance requires authorized access; CLI authentication is currently missing, not evidence that infrastructure is absent.

Update this checkpoint after verified work. No process is promised to continue after a turn ends; the next **continue** resumes from these actual files.
