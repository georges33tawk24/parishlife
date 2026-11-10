# Connect the existing Azure infrastructure

The resources are already configured by the owner. This runbook describes application wiring and verification, not resource creation.

| Setting | Existing target |
| --- | --- |
| Resource group | `rg-parishlife` |
| App Service host | `app-parishlife-gxcjhmgqagd7hhg0.francecentral-01.azurewebsites.net` |
| `Cosmos__Endpoint` | `https://cosmos-parishlife.documents.azure.com:443/` |
| `Cosmos__Database` | `ParishLife` |
| `Azure__ManagedIdentityClientId` | `09700a6a-f406-498d-aee6-9011f2029654` |
| Managed identity principal/object ID | `cc0278ec-f74d-40b9-8e8b-0544e438a49b` — for role assignment, not client selection |
| `BlobStorage__ServiceUri` | `https://storageparishlife.blob.core.windows.net/` |
| `BlobStorage__EvidenceContainer` | `evidence` |
| `DataProtection__BlobUri` | `https://storageparishlife.blob.core.windows.net/data-protection/keyring.xml` — derived from the supplied setup contract; verify the actual path |
| `DataProtection__KeyIdentifier` | `https://keyvault-parishlife.vault.azure.net/keys/parishlife-data-protection` |
| `DataProtection__ApplicationName` | `ParishLife.Production` |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `Storage__Provider` | `Cosmos` |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Actual existing Application Insights connection configuration; do not invent or print a value |

The initial containers are `Accounts`, `LoginAliases`, `TenantControl`, `Billing`, and `Catalog`, partitioned by `/partitionKey`. The current identity/security contract expects Strong consistency and no container TTL. Read the existing manifest and actual resource settings before evolving mappings/indexes. No production startup path provisions these containers or creates user data.

The calendar/reservation slice also stores isolated resource partitions in TenantControl and requires its date/event/status/publication index paths. See [the calendar runbook](../operations/calendar-and-reservations.md). Readiness accepts a compatible broad policy or explicit includes, honoring more precise exclusions. Compare deployed metadata first; preserve other required paths and prepare an additive update if needed. No index update was applied by implementation or startup. Completed transformation and actual Cosmos query/race behavior still need controlled verification.

Personal notes/tasks add bounded Accounts queries on `/data/kind/?`, `/data/status/?` and `/data/itemId/?`; reviewed guest attendance adds TenantControl `/data/participantKind/?`; event refund/movement lists add TenantControl `/data/registrationId/?`; volunteer team sheets add `/data/opportunityId/?`; household member lists add `/data/householdId/?`; equipment bookings add `/data/equipmentId/?`; request messages/history add `/data/requestId/?`; inbox messages and membership add `/data/conversationId/?`. The local [container contract](../cosmos/containers.json) and read-only readiness now include these requirements. Content/retry snapshots stay protected and require no plaintext content index. Existing broader policies may already be compatible; do not replace a deployed policy wholesale or claim a source change applied it. These workflows reuse the current containers, credentials and Data Protection provider without provisioning new resources.

## Authentication and Data Protection

App Service uses an explicitly selected user-assigned managed identity. Local development/operator tools use signed-in developer credentials with managed-identity probing excluded. Azure RBAC, Cosmos data-plane roles, and network reachability are independent of parish application permissions.

The private Blob key ring is protected with the versionless Key Vault key. Preserve older wrapping-key versions needed to decrypt stored key-ring material. Never use development keys/application names for production authentication, and never publish a local key directory.

## Verification order

1. Build and run the isolated tests; publish only `ParishLife.Api`.
2. Use the read-only operator probe to verify the exact existing container/private-storage/key metadata contracts. Diagnose failures before proposing any role/network change.
3. Verify write and wrap/unwrap capabilities through an explicitly controlled operation in the intended environment; metadata success alone is insufficient. No such write probe runs by default.
4. Verify App Service's runtime identity and networking independently from local operator access.
5. After a separately authorized deployment, verify HTTPS/proxy behavior, health, authentication/session/MFA persistence across restarts, and actual telemetry ingestion. Configure App Service health monitoring to `/health/ready` only after its network/access path is correct.
6. Bootstrap the exact two administrators through the private operator command using their own credentials. Create no business data as part of bootstrap.

Aspire is local observation/orchestration. It does not replace App Service or deploy additional cloud services. No frontend integration is included in the current work.
