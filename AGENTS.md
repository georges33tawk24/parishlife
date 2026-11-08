# ParishLife working instructions

- Follow the owner's current chat instructions. Backend implementation and an Aspire AppHost are authorized; frontend integration is deferred.
- Keep production business code in `ParishLife.Api`, with controllers, services, repositories, interfaces, DTOs, models, configuration, and Azure adapters in folders. Do not recreate Application/Domain/Infrastructure projects.
- Follow the inspected MiniDevOps DTO/model convention: ordinary public classes, explicit get/set properties, safe defaults, one public type per file, and validation attributes on input DTOs. Put named `*Dto` classes under `DTOs/<Feature>`, models directly under `Models`, and model enums under `Models/Enums`. Do not introduce positional records or grouped Contracts.cs/Models.cs files there. Keep Cosmos IDs/partitions and UTC times rather than relational navigation graphs.
- Start every code file created or rewritten with a brief comment describing its purpose and its main functions/members. Use valid syntax for C#, PowerShell, and XML; explain strict JSON configuration in the accompanying documentation rather than inserting invalid comments.
- Aspire is for local orchestration/observation. Do not provision or replace the existing Azure resources through AppHost startup.
- Use the configured Cosmos DB, private Blob Storage, Key Vault key, and user-assigned managed identity. Keep developer credentials separate from hosted managed identity.
- No initial business data or sample organizations. The only bootstrap accounts are `colinsleiman` and `georgestawk`, through the explicit private operator command with secure credentials and MFA. Never seed at API startup.
- Preserve tests in source; publish only the API and its runtime dependencies. Test fixtures must remain isolated from production.
- Do not claim that local storage tests prove Cosmos transaction/query behavior, that metadata reads prove write/crypto access, or that the whole product is complete after the foundation.
- Do not change Azure RBAC/networking, provision infrastructure, run live write tests, or deploy without the corresponding explicit task. Read-only Azure inspection is allowed.
- Record feature completion and verification honestly; preserve the full requested scope and the current frontend work.
- API-hosting tests must assert their temporary storage path. Resolve storage and development key-ring settings from final host configuration; do not capture the default directory before test overrides apply.
- MFA credential changes must preserve the staged-proof and single-account transaction boundaries. Never pass credential DTOs to Operation.Create: fingerprints/receipts/audit must exclude passwords, authenticator responses, recovery proofs, and plain returned secrets. Issue codes only from the committed generation.
- Recovery authentication is explicitly restricted. New protected actions must remain unavailable to recovery cookies unless intentionally marked AllowRecoverySession and independently checked for their required proofs. Never upgrade recovery authentication into an MFA claim.
