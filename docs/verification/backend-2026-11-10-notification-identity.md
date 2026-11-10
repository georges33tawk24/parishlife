# ParishLife backend progress — 10 November 2026

The latest verified local backend code is **`18fc9c6d20d3e8018d1c3caccc1f7b4951816a17`** on `dev/colin/backend-reliability-20261110`. The full solution builds with **zero warnings/errors**, all **331 tests pass (56 unit / 275 integration, zero failed/skipped)**, and API-only publish passes. The changes are committed locally and **not pushed**; cloning Georges's backend alone does not include this continuation.

This extends the [324-test reliability checkpoint](backend-2026-11-10-reliability.md), preserving its evidence-file and registration fixes and completing the next scoped-notification identity work. The source register remains **149 cards: 124 partial, 25 not started, zero fully accepted**. These counts retain outstanding product acceptance, frontend deferral and policy/live-service requirements.

## Newly verified behavior

- New required-notice obligations use `IdentityVersion = 2`, with a domain-separated identity over account, parish and deduplication key. The same account and operation key can now produce independent notices for two parishes, without overwriting either or confusing their acknowledgments.
- The worker processes the exact saved work ID/version. An old serialized obligation without the new field is still version 1; unknown versions stay pending for a compatible reader.
- A matching existing legacy notice is reused only after verifying its original receipt and identity. Its timestamp, historical wording and read/archive state remain unchanged. A foreign parish's legacy notice does not reserve the new scoped identity.
- An existing, valid pending version 1 obligation with a proven cross-parish collision can recover to a scoped recipient notice. Its original work ID/version remain intact; the acknowledgment records the actual `RecipientNotificationId`. No missing historical source event or additional obligation is manufactured.
- Same-parish target/payload conflicts, invalid identities and recipient rows without matching receipts remain pending. The dispatcher neither overwrites them nor falsely acknowledges successful storage.

Seven new regressions cover independent same-key parishes, foreign legacy coexistence, old serialized work, narrow legacy collision recovery, missing receipt proof, changed target refusal and unsupported versions. The existing legacy receipt/read-state regression was extended to verify the actual reused recipient ID. The focused notification/related-workflow run passed **34 tests**; the final full suite passed **331**.

The previous work remains covered: original case/parish version fences and content-bound immutable evidence retries; correct current file access; lifecycle registration eligibility; exact viewed form versions; and limited versioned door/cashier HTTP workflows. All current required-notice producers still stage in their source transaction and recover through the bounded actorless relay. See [requests](../operations/requests.md#case-files-q11), [registrations](../operations/event-registrations.md) and the [current outbox runbook](../operations/required-notification-outbox.md).

## Verification

| Check | Fresh observed result |
| --- | --- |
| Five-project Release build, including Aspire | Passed; 0 warnings/errors |
| Full tests | 56 unit + 275 integration = **331 passed**, no failures/skips |
| API-only publish (`UseAppHost=false`) | 61 top-level / 71 recursive files; no tests, AppHost, maintenance or local-data components |
| Source convention audit | 803 C# files with purpose/main-function summaries; 353 DTO / 179 model/enum files; no convention violations |
| API project references / default development business documents | 0 / 0 |
| Dependencies | Unchanged; .NET SDK 10.0.403, locked restore retained from earlier verification |
| Azure CLI | Still requires local `az login`; no live acceptance established |

Commands used from the repository root:

```powershell
dotnet build ParishLife.slnx -c Release --no-restore
dotnet test ParishLife.slnx -c Release --no-build --no-restore
dotnet publish ParishLife.Api/ParishLife.Api.csproj -c Release --no-build --no-restore -p:UseAppHost=false -o <fresh-private-publish-directory>
```

The [sanitized result summary](backend-2026-11-10-notification-identity-results.json) records exact counts and the code commit. Raw test logs/fixtures stay outside the repository. The source-file count is unchanged because this step modifies existing files only. The previous 324-test report is historical; its next-work item about scoped keys is addressed by this checkpoint.

## Scope and remaining work

The solution keeps one production `ParishLife.Api`, ordinary MiniDevOps-style DTO/model classes and top-of-code summaries. No frontend integration, production business seeds, Azure provisioning/RBAC/index changes, deployment or live write tests occurred. Aspire compiled; no new dashboard launch is claimed. Local store/SDK-double tests do not prove live Cosmos, Blob, Key Vault or hosted-identity behavior.

The source transaction and recipient-account transaction are separate. Eligibility rechecks do not make concurrent revocation and recipient storage atomic. A pending acknowledgment may already have a recipient notice. The relay preserves optional-topic muting semantics and never calls in-app storage external delivery.

Normal source-operation replay does not create a duplicate version 2 obligation for a committed older event. Operators must still coordinate older/newer workers and avoid manually duplicating a single event as both legacy and scoped work: both recipient namespaces are not atomically reserved together. No automated backfill of notices missed before durable work existed, no invented retention/deletion period and no arbitrary repair of corrupt/missing receipts is implemented.

Next backend work is source-scoped visibility of pending/stored component outcomes, with no private-case recipient/count leakage, followed by remaining acceptance criteria and unimplemented cards in [coverage](../features/coverage.json). Actual source status and proposed-policy distinctions remain in [SOURCES](../continuation/SOURCES.md); [STATUS](../continuation/STATUS.md) records the next executable step. Live Azure acceptance still needs authorized local access.
