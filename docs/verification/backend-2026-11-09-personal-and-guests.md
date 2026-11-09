# Personal workflows and guest attendance verification — 9 November 2026

This checkpoint extends the [previous 169-test checkpoint](backend-2026-11-09.md). It verifies local backend behavior, not full product or live Azure acceptance. All 149 retained feature cards remain tracked: 44 partial and 105 not started; none is fully accepted.

## Implemented behavior and source authority

- [Personal profile/appearance](../operations/account-profile.md): own display name, optional interface-language preference, constrained appearance preview/save/reset, conditional account/profile changes and safe current-state retries. Credentials, contacts, roles, official Person facts and session stamps are preserved.
- [Private workspace](../operations/personal-workspace.md): account-author-only protected notes/tasks, drafts, explicit task lifecycle, archive/restore, protected revisions, bounded private cursors and encrypted exact-input retry checks. No administrator or parish-role fallback is provided.
- [Guest attendance](../operations/ministries-and-attendance.md): reviewed existing-person additional rows, separate six-state guest counters, no automatic membership or group access, record/review separation, protected evidence, conditional rollback, legacy uncertainty and closed-row correction.

The linked runbooks identify actual discovery sections/workflows/fields and retain their **proposed** policy status. Backend implementation does not turn proposed details into an official owner/design/retention approval. No official church, organizational or personal facts were seeded. Frontend integration remains deferred.

## Observed checks

| Check | Result |
| --- | --- |
| Locked restore of the five solution projects | Passed |
| Full Release build | Passed; zero warnings/errors |
| Full unit suite | 34 passed; zero failures/skips |
| Full integration suite | 162 passed; zero failures/skips |
| Total | **196 passed** |
| Focused new feature integration cases | 23 passed: 8 guest / 8 private workspace / 7 profile |
| API-only Release publish | Passed; 61 top-level / 71 recursive files |
| Publish exclusions | No tests/test framework, AppHost, private maintenance executable or local-data components |
| API vulnerability query | No vulnerable package entries reported by the configured NuGet sources at check time |
| Source summaries | All 412 C# files have purpose/main-member summaries |
| DTO/model conventions | 146 DTO files / 98 model/enum files; no violations |
| API ProjectReference | Zero |
| Default development business JSON | Zero |
| Azure CLI authentication | Unavailable; state check requested az login |

The full suite includes previous password/MFA/governance/calendar/reservation/ministry regression coverage. New tests use actual isolated Identity, local records, HTTP cookies, CSRF and typed OpenAPI. Additional unit cases verify account metadata index requirements and include/exclude precedence. Independent source reviews examined private-workspace, profile and guest behavior; the guest review found and prompted the empty-nonterminal-page guard and explicit initial-recording permission check.

An empty service page cannot establish absence while its continuation token remains. The regression injects that result and verifies guest admission preserves null counters and creates no row/receipt; [Microsoft's pagination contract](https://learn.microsoft.com/en-us/cosmos-db/query/pagination) describes this service behavior. It is a simulated service-page regression, not a live Cosmos execution.

Core commands, from repository root:

```powershell
dotnet restore ParishLife.slnx --locked-mode
dotnet build ParishLife.slnx -c Release --no-restore
dotnet test ParishLife.slnx -c Release --no-build --no-restore --logger trx
dotnet publish ParishLife.Api/ParishLife.Api.csproj -c Release --no-build --no-restore -p:UseAppHost=false -o <private-local-publish-directory>
dotnet list ParishLife.Api/ParishLife.Api.csproj package --vulnerable --include-transitive --format json
```

## Infrastructure and remaining limits

No new project, package, container or Azure resource is required. The reviewed local source contract adds Accounts metadata indexes for kind/status/itemId and TenantControl participantKind. Read-only readiness validates the required paths and include/exclude precedence. Inspect existing Azure metadata before any separately authorized additive index update; a broad policy may already cover them. No startup initializer applies a live policy change, and metadata compatibility does not establish transformation completion or correct live query/race behavior.

Private workspace reuses the configured Data Protection provider/key ring. Live Cosmos writes/transactions, hosted managed identity, Blob writes, Key Vault crypto, restart/key-ring continuity and monitoring remain unverified. Aspire compiles in the full build; earlier startup/health results are historical and were not repeated here. No infrastructure/RBAC/network/index mutation, live business write, bootstrap, deployment or frontend integration occurred.

Retained gaps include broader personal profile fields and actual UI/language/accessibility acceptance; private attachments/record links/reminders/recurrence/approved deletion and retention; wider visitor/guardian/representation intake; closed-report missing guest admission, historical roster correction, monthly reporting and import/reversal. Other unimplemented catalogue modules remain in [coverage](../features/coverage.json). No simulated reminder, delivery, arrival, official eligibility or approval is reported as real.
