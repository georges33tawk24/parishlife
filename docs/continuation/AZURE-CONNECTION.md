# Azure connection progress and remaining steps (11 November 2026)

Working handover for finishing the connection of `backend` to the existing Azure resources in `rg-parishlife` (subscription `32797b77-a6e7-4d52-981f-cd92da8d44ae`, France Central). Run from the owner's own computer: the Cosmos/Storage firewalls only admit the App Service subnet and the owner's IP. Never print, paste or commit secrets, tokens, connection strings or passwords.

## Done (verified 2026-11-11)

- `az login --tenant abfbf22a-4501-410d-99f1-cc1a921afad5` (MFA required by the tenant). In each new PowerShell window set `$env:AZURE_TOKEN_CREDENTIALS = "AzureCliCredential"` so the operator tool uses the CLI login, not Visual Studio's.
- Cosmos firewall: owner IP `82.112.167.141` added (the portal's "Add my current IP" adds the browser's route, `147.243.x`, which differs from PowerShell's). Storage firewall: `82.112.167.141` added; App Service subnet `snet-app-parishlife` already allowed on both.
- Cosmos data roles for the owner (`549167b7-735c-4ec8-a07e-a6d81349d73d`): Data Contributor on `/dbs/ParishLife`, Data Reader on `/` (account metadata for the readiness check). Managed identity (`cc0278ec-f74d-40b9-8e8b-0544e438a49b`) already had Data Contributor on `/dbs/ParishLife`.
- Storage: owner granted Storage Blob Data Contributor on container `data-protection`; managed identity granted Storage Blob Data Contributor on `evidence` (closes the Q11 RBAC gap; it already had `data-protection`).
- Key Vault (RBAC mode, public network allowed): owner has Key Vault Crypto Officer; managed identity has Crypto Service Encryption User on key `parishlife-data-protection`.
- `dotnet run --project tools/ParishLife.Maintenance -- check-infrastructure` returns `Ready: True` at `30f6132` (Cosmos Strong consistency, five containers, partition/TTL, required index paths; both private Blob containers; enabled Key Vault key). Metadata only: write and wrap/unwrap are not yet proven.
- `30f6132`: the local provider now refuses filters on paths outside the index contract; `containers.json` and `CosmosIndexContract` include every path the code queries.
- `Initialize-Cosmos.ps1 ... -Apply -WhatIf`: would update the index policy of all five containers to the manifest; nothing is created, deleted or seeded.

## Remaining, in order (each change needs the owner's explicit yes)

1. Read the live policy: `az cosmosdb sql container show -g rg-parishlife -a cosmos-parishlife -d ParishLife -n TenantControl --query "resource.indexingPolicy"`. If it is the default `/*`, the owner decides whether to narrow it to the manifest (recommended while empty): `.\tools\Initialize-Cosmos.ps1 -ResourceGroup 'rg-parishlife' -AccountName 'cosmos-parishlife' -SubscriptionId '32797b77-a6e7-4d52-981f-cd92da8d44ae' -Apply`, then rerun `check-infrastructure`.
2. App Service `app-parishlife` (read-only first): `az webapp show` (state, httpsOnly, `virtualNetworkSubnetId` = `snet-app-parishlife`, user-assigned identity `id-parishlife` attached), `az webapp config show` (.NET 10 stack, alwaysOn, minTls 1.2), `az webapp config appsettings list --query "[].name"` (names only).
3. App settings to ensure (values from `docs/azure-manual-setup/production.md`; never print the Application Insights connection string): `ASPNETCORE_ENVIRONMENT=Production`, `Storage__Provider=Cosmos`, `Cosmos__Endpoint`, `Cosmos__Database`, `Azure__ManagedIdentityClientId=09700a6a-f406-498d-aee6-9011f2029654`, `BlobStorage__ServiceUri`, `BlobStorage__EvidenceContainer=evidence`, `DataProtection__BlobUri`, `DataProtection__KeyIdentifier`, `DataProtection__ApplicationName=ParishLife.Production`, `APPLICATIONINSIGHTS_CONNECTION_STRING` (reference the existing `insights-parishlife`). Most are already in `appsettings.json`; App Service settings override them. `AllowedHosts` already lists the App Service host. Leave `BackgroundJobs__Enabled` true only once the app is verified.
4. Publish and deploy only the API: `dotnet publish ParishLife.Api/ParishLife.Api.csproj -c Release -p:UseAppHost=false -o artifacts/api`, zip the folder contents, `az webapp deploy -g rg-parishlife -n app-parishlife --src-path <zip> --type zip`. Do not deploy tests, AppHost or tools.
5. Verify: `/health/live`, `/health/ready`, `GET /api/auth/capabilities`; restart the app and confirm readiness again (key ring persisted in Blob, wrapped by Key Vault). Set the App Service health check path to `/health/ready` after it passes.
6. Bootstrap in the owner's own terminal only: `dotnet run --project tools/ParishLife.Maintenance -- bootstrap-superadmins` for `colinsleiman` and `georgestawk`; passwords and authenticator secrets are typed privately, never shared. This is the first real write and wrap/unwrap proof.
7. Then sign in through the deployed API with password + MFA, and confirm the session survives an app restart.
8. Cleanup: remove the owner IP from the Cosmos/Storage firewalls when maintenance is done (and stale `82.112.167.216`, `147.243.x` entries if not recognised). Consider restricting Key Vault networking.

## Not authorized/decided here

Production-only database (owner decision: no separate test database), so there are no live write tests beyond bootstrap and real use. External providers (email, OAuth, Turnstile) stay unconfigured. Frontend connection is Georges's work.
