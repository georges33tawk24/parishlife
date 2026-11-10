# Current ParishLife continuation state

Updated **10 November 2026**, owner timezone Asia/Beirut. Read this file before acting on **continue**. Verify live Git state; this is a checkpoint, not an immutable claim about future remote HEADs.

## Repository and preserved work

- Working folder: `C:\Users\User\source\repos\ParishLife`.
- Requested incoming repository: `https://github.com/georges33tawk24/parishlife.git`, branch `backend`, remote `upstream`.
- Pulled baseline: `a4cb405899bb6fde0e9c186dde1f4bb1ee1be24f` — Add remaining backend slices with tests and runbooks. Local `backend` was fast-forwarded to it.
- `origin` still points to `https://github.com/ColinSleiman/ParishLife.git`; its observed backend was `1a550c0`. No remote URL was replaced and no changes were pushed during this handover.
- Earlier local WIP is preserved on `dev/colin-following`, commit `c81a30de2431933c2efe7dfad016f622325d24c5`: eleven unwired following DTO/model files. The pulled implementation already has following/membership behavior; compare rather than blindly merging WIP.
- Current local continuation branch: `dev/colin/claude-handover-20261110`. It includes local fix `9ea24732c50693a9125738aaab4fb56e285163f0` plus these handover documents. This branch is **not pushed**; a fresh clone of Georges's backend alone does not include the local fix/documents.

## Verified state

- Incoming change from `1a550c0`: one commit, 446 files changed, 24,203 insertions / 678 deletions.
- Feature register: **149 cards — 124 partial, 25 not started, zero fully accepted**. Eighty cards advanced from not_started to partial. No claim of 124 completed cards or a product completion percentage.
- Locked restore and full five-project Release build on .NET SDK **10.0.403** passed; zero build warnings/errors, including Aspire AppHost compilation.
- First full run of the unmodified incoming baseline: 40 unit passed; integration 237 passed / 1 failed. The failure exposed an MFA duplicate-enrollment replay race.
- Deterministic regression failed before the fix. The fix reloads the saved enrollment after observing a committed receipt; all ID/account/status/security-stamp/expiry checks remain.
- After that local fix: **279 tests passed — 40 unit / 239 integration, zero failures/skips**. Focused MFA regression: 16 passed.
- API-only publish passed: 61 top-level / 71 recursive files; no tests, AppHost, maintenance executable or local-data components.
- Source audit: 790 C# files with summaries; 349 DTO and 178 model/enum files, no convention violations, zero API ProjectReferences, zero default development business JSON documents.
- Azure CLI still requested `az login` during the fresh state check. No successful live Azure acceptance, live write, infrastructure change, deployment or bootstrap is claimed.
- Aspire was built, not relaunched. Earlier health/startup evidence in runbooks is historical. Incoming documentation's 220/278-test reports reflect its author's earlier runs; the fresh observations above supersede them for this local checkout.

## Immediate next work

**Start with request-file data integrity, not another broad feature-count claim.** See the detailed source findings and links in [REVIEW-2026-11-10.md](REVIEW-2026-11-10.md).

1. Reproduce and fix `EvidenceService.UploadAsync` pairing an old request payload with a newly fetched ETag. A concurrent close/triage must not be overwritten. Preserve original version, current authorization and transactional fences; add deterministic failure/race tests.
2. Fix upload operation/content binding and staged-blob integrity. Same operation/metadata/length with changed bytes must not produce new metadata pointing to an older blob. Pin/check the actual digest and verify immutable staged content; test failure between blob and metadata commits.
3. Review applicant file status/entitlement gates, distinguishing prohibited new writes from any explicitly permitted historical reading/cleanup. Add suspension/closure/lapse tests from actual policy, without inventing a blanket retention rule.
4. Revalidate registration event kind/source/visibility throughout its lifecycle; require the form version actually answered; add safe versioned door/cashier projections so narrow roles can work without registrations.manage.
5. Replace best-effort required notifications with a durable source outbox/retry and honest delivery state. Simulate interruption between source and recipient commits; retries must repair the missing notice without duplication or sensitive previews.
6. Then continue the remaining backend requirements and acceptance gaps from coverage, workflows and actual source evidence. Frontend work stays deferred.

The file/registration/notification items are **source-review findings awaiting regression and repair**, not a comprehensive runtime audit. The MFA race is the one reproduced and fixed during this handover. Do not mark the other findings resolved without evidence.

## Read next

1. [MASTER-PROMPT.md](MASTER-PROMPT.md): owner constraints and work loop.
2. [SOURCES.md](SOURCES.md): governing instructions, actual external requirements and historical distinctions.
3. [REVIEW-2026-11-10.md](REVIEW-2026-11-10.md): pull review, verification provenance and concrete findings.
4. [CARDS-2026-11-10.md](CARDS-2026-11-10.md): all 149 snapshot cards; canonical mutable register is `docs/features/coverage.json`.

Update this file after meaningful verified work: branch/base/commits; current task; files changed; exact commands and results; local versus published state; blockers; next executable action. Preserve older verification as historical, not current success.
