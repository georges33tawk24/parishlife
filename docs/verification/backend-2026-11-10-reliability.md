# Backend reliability verification — 10 November 2026

This checkpoint verifies local backend commit **`7bed477618d27f5f4fe06a24bf343af2289db919`** on `dev/colin/backend-reliability-20261110`, after pulled baseline `a4cb405899bb6fde0e9c186dde1f4bb1ee1be24f`. The owner requested continued implementation here; the earlier Claude handover is historical. These code changes are committed locally and **not pushed**. A fresh clone of Georges's backend does not include them.

The retained feature register remains **149 cards: 124 partial, 25 not started, zero fully accepted**. This checkpoint advances Q11, E01, E02, E05 and N04 acceptance work without promoting any card or claiming full-product completion.

## Implemented and checked

- Request evidence upload/removal preserve the original case/parish versions. Deterministic interleavings prove that concurrent closure or triage is not overwritten. Current account/parish/module authority is checked again after content I/O, and competing uploads cannot exceed 20 active files. Replacement at the limit still works.
- Legacy `evidence:v1` receipt inputs remain unchanged; replay checks the committed digest, length, type and audience. Interrupted staged uploads recover only with identical content. Local content is published completely under a process lock; Blob collisions verify existing bytes/type without overwrite. Downloads refuse content whose size/hash differs from metadata.
- Registration opening, submission, seat decisions, amendment and admission recheck manual event kind, source ownership and audience; writes fence the event. Office/self submissions require the form version actually viewed, with a stale-form conflict. Applicant form reads and versioned door/cashier views support actual limited-role HTTP workflows without private answers or broader registration permissions.
- All current required-notice producers in seven services stage their obligation with the source transaction. The bounded relay confirms the recipient row/receipt, rechecks its typed audience and acknowledges separately. Failure between source/account commits or account/acknowledgment commits is recoverable without duplicate notices or resetting read state. A real enabled local hosted-worker test drains queued work without a browser principal.
- New request previews are neutral. Legacy notification receipt identity, title wording, timestamp and read state are preserved. A mismatched recipient/parish identity cannot be overwritten or falsely acknowledged.

Behavior and limits are detailed in [request operations](../operations/requests.md#case-files-q11), [registration operations](../operations/event-registrations.md) and [required-notification recovery](../operations/required-notification-outbox.md). DTO/model conventions remain the inspected MiniDevOps ordinary-class layout in the single production API.

## Fresh evidence

| Check | Observed result |
| --- | --- |
| Full five-project Release build, including Aspire | Passed, **0 warnings / 0 errors** |
| Full unit suite | **56 passed** |
| Full integration suite | **268 passed** |
| Total | **324 passed, 0 failed, 0 skipped** |
| API-only publish with `UseAppHost=false` | Passed; 61 top-level / 71 recursive files; no tests, Aspire AppHost, maintenance or local-data components |
| Source audit | **803 C# files** with purpose/main-member summaries; 353 DTO and 179 model/enum files; zero convention violations |
| API project references / default development business documents | **0 / 0** |
| Azure CLI read-only state check | Requested `az login`; unauthenticated |
| Live Azure writes, provisioning, deployment, bootstrap, frontend integration | Not performed |

The earlier local MFA checkpoint passed 279 tests. The evidence/registration checkpoint (`ba843cf`) passed 314 (56 unit / 258 integration); ten notification-recovery cases bring this run to 324. The initial evidence regressions exposed ten failures on the old service; three additional failures in that first combined run were corrected fixture-principal postcondition reads. A Windows concurrent-read storage regression and a fixture lockout-clock assumption were corrected before the final runs. The notification-focused run passed 26 tests before the final legacy-compatibility case was added and included in the full suite. Failed/intermediate runs are not presented as successful current verification.

Reproduction from an authorized local checkout:

```powershell
dotnet build ParishLife.slnx -c Release --no-restore
dotnet test ParishLife.slnx -c Release --no-build --no-restore
dotnet publish ParishLife.Api/ParishLife.Api.csproj -c Release --no-build --no-restore -p:UseAppHost=false -o <fresh-private-publish-directory>
```

Locked restore was verified at the preceding checkpoint; dependencies/lockfiles were unchanged by these fixes. Restore with `--locked-mode` on a fresh clone before building. Tests assert isolated storage, and the hosted-worker test uses that same isolated configuration. The machine-readable [sanitized result summary](backend-2026-11-10-reliability-results.json) contains no raw logs, credentials or operational records. Raw local TRX/build output was retained outside the repository.

## Acceptance boundaries and next work

Local document-store tests and Blob SDK doubles do not prove live Cosmos concurrency/query/index behavior, managed-identity data access or Key Vault cryptography. Aspire compiled; it was not relaunched for this checkpoint. The hosted-worker check ran the actual API test host, not an Aspire dashboard session. Existing containers/index contracts were reused and no Azure settings changed.

The source outbox and recipient acknowledgment are deliberately separate partition commits; current-eligibility rechecks do not make revocation and recipient storage atomic. `Pending` may already have an in-app notice after an acknowledgment failure. Historical pre-outbox missing notices are not reconstructed. The legacy account-plus-dedup hash can collide across parishes; such a mismatch remains Pending for review rather than overwriting/acknowledging another parish's notice. A versioned, parish-scoped identity and evidence-based legacy reconciliation remain concrete N04 work. There is no approved automatic pending-work retention/deletion rule.

The new registration form-version input tightens the client contract; existing saved forms/registrations are not migrated. Do not infer legacy registration-receipt compatibility from the separately tested evidence and notification contracts. Malware scanning, wider evidence use, remaining broad-card criteria and the 25 not-started cards remain in [coverage](../features/coverage.json). Frontend work remains deferred; missing policy/factual inputs remain explicit.

The original/reviewed source status is retained in [SOURCES](../continuation/SOURCES.md). Detailed workflow additions are proposed unless recorded owner decisions approve them. No actual churches, archdioceses, people or commercial plans were seeded; only isolated test fixtures were used. Backend startup/bootstrap behavior was not changed.
