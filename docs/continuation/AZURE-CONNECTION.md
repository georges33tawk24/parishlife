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

## Read-only re-check (11 November 2026, evening, at `190b2c2`)

- `check-infrastructure`: `Ready: True` again. Cosmos DocumentCount metric: **0 documents in all five containers**. `data-protection` container is empty (no key ring yet; the first API start creates it).
- Live index policies: `Accounts` and `LoginAliases` already match the manifest; `TenantControl`, `Billing`, `Catalog` are still the default `/*`. `Initialize-Cosmos.ps1 -Apply -WhatIf` now plans updates for those three only.
- App Service `app-parishlife`: Running, `httpsOnly` true, Linux `DOTNETCORE|10.0`, plan `plan-parishlife` B1 (1 worker), minTls 1.2, FTPS-only, no startup command (single `ParishLife.Api.runtimeconfig.json`, auto-detected), VNet-integrated with `snet-app-parishlife`, `outboundVnetRouting.applicationTraffic` true, user-assigned `id-parishlife` (client ID `09700a6a-…2029654`) attached. **No app settings at all**, `alwaysOn` false, no health check path.
- Subnet `snet-app-parishlife`: service endpoints `Microsoft.AzureCosmosDB`, `Microsoft.Storage`; delegated to `Microsoft.Web/serverfarms`.
- Cosmos firewall: subnet + `82.112.167.141` (current owner IP) + stale `147.243.53.175`, `147.243.236.242` + Azure portal IPs `4.210.172.107`, `13.88.56.148`, `13.91.105.215`, `40.91.218.243`. Local auth not disabled. Storage: default Deny, subnet + `82.112.167.141` + stale `82.112.167.216`, shared key disabled, public blob access disabled. Key Vault: RBAC, public, default Allow, soft delete + purge protection.
- Application Insights `insights-parishlife` connection string is readable via `az resource show ... --query properties.ConnectionString` (shape verified, value never printed). `az monitor app-insights` needs a CLI extension; avoid it.
- API-only publish built locally on SDK 10.0.403 (`global.json` 10.0.401 + `latestPatch`): `artifacts/api-190b2c2` (61 top-level / 71 recursive files; no tests/AppHost/tools/keys/data; `appsettings.Development.json` is published but holds no secrets and is ignored under Production) and `artifacts/api-190b2c2.zip`. Working-tree changes in `launchSettings.json`/AppHost are not part of the API publish.
- **Index policy applied (owner yes, 11 November 2026 ~18:37 UTC):** `Initialize-Cosmos.ps1 -Apply` updated `TenantControl`, `Billing`, `Catalog`; a follow-up `-WhatIf` reports all five containers "already matches", and `check-infrastructure` is still `Ready: True`. Nothing created, deleted or seeded.
- **App settings applied (owner yes, 11 November 2026):** the 12 settings below are present (names verified; App Insights value checked for shape only, never printed), `BackgroundJobs__Enabled=false`, `alwaysOn` true.
- **Deployed `190b2c2` API-only (owner "do everything", 11 November 2026 18:55 UTC).** First attempt with a `Compress-Archive` zip failed: Windows PowerShell 5.1 writes backslash entry paths (`runtimes\win-x64\...`), Kudu's rsync on the Linux share rejects them (exit 23) and the OneDeploy record `91302a2c-…` stays stuck in "Building" (superseded, harmless). Redeployed `artifacts/api-190b2c2-fixed.zip` built with `tar.exe -a -c -f` (71 entries, no backslashes) using `--clean true`: deployment `3cc893d3-…` `RuntimeSuccessful`, 1/1 instance.
- **Verified after deploy:** `/health/live` 200 `Alive`; `/health/ready` 200 `Healthy`; `GET /api/auth/capabilities` 200 (password sign-in, registration, passkeys on; Google/Microsoft unavailable, Turnstile off, contact delivery `NotConfigured`, manual identity review on). First start created `data-protection/keyring.xml` (1 key, 18:55:12): `encryptedSecret` with `AzureKeyVaultXmlDecryptor` naming `parishlife-data-protection`, no plaintext master key (checked in memory, never saved/printed) → **managed-identity Blob write and Key Vault wrap proven**.
- **Restart verified:** `az webapp restart`; new container `Site started` 18:58:21; `/health/ready` Healthy; key ring unchanged (same blob, 1 key) → existing key reused. Unwrap is only exercised when a cookie/protected payload is read; the sign-in-survives-restart check (step 7) is the unwrap proof.
- **Telemetry verified:** Application Insights receives requests/traces/exceptions with role `app-parishlife`. The 2 exceptions are `TaskCanceledException`s at old-container shutdown (18:55:35, 18:56:38). Startup traces show the expected first-run Blob 404 and Key Vault 401 bearer challenge.
- **Finding:** the platform warm-up probe `GET /robots933456.txt` arrives with host `169.254.130.x` and gets **400 from host filtering** (`AllowedHosts` lists only localhost/127.0.0.1/the public host). Startup tolerates it. App Service health-check pings may arrive the same way; after setting the health check path, confirm in App Insights that `/health/ready` probes return 200, otherwise allow the internal probe host (code/config change, needs its own decision).
- **Health check + background jobs (owner yes, 19:06 UTC):** `healthCheckPath=/health/ready`, `BackgroundJobs__Enabled=true`. After the resulting restart (19:07:55): App Service health-check pings arrive with the public host and get **200** (so host filtering does not affect them; only the warm-up probe gets the harmless 400). `GET /` 404s are Always On pings.
- **Key Vault unwrap proven:** after the 18:58 restart the app read the stored key ring and called `CryptographyClient.UnwrapKey` (Key Vault `POST …/unwrapkey` 200) through the managed identity. Wrap (18:55) + unwrap = full Data Protection round trip.
- **Live Cosmos queries proven:** background jobs run queries (`POST …/docs` 200) on Accounts, Billing, TenantControl with the narrowed index policies (containers still empty, so no result-set behavior is proven).
- **Known noise:** each container start, the Cosmos SDK probes Azure VM metadata `169.254.169.254` (unavailable on App Service); it times out after ~65 s and logs one `TaskCanceledException` (18:55:33→18:56:38, 19:07:56→19:09:01). Harmless. Optional fix: app setting `COSMOS_DISABLE_IMDS_ACCESS=true` (not applied).

## Firewall cleanup (13 November 2026, owner request)

- Owner's terminal public IP is now `77.246.79.196`; the portal's "Add your current IP" shows the browser's different route (`69.15.5.38`/`69.15.5.42`) and must not be used for operator commands.
- Cosmos IP list set to exactly `77.246.79.196` (`az cosmosdb update --ip-range-filter`); removed `82.112.167.141`, `147.243.53.175`, `147.243.236.242` and the four Azure portal middleware IPs (only needed for portal Data Explorer; re-add with the portal checkbox if ever wanted). Storage IP list set to exactly `77.246.79.196`; removed `82.112.167.216`, `82.112.167.141`. Both keep the `snet-app-parishlife` VNet rule (the App Service path); Storage keeps default Deny + `AzureServices` bypass.
- `check-infrastructure` from the owner's terminal: `Ready: True` (10:10 UTC); live `/health/ready` Healthy.
- The local SDK 10.0.403 is no longer installed (now 10.0.102/11.0.100), so `dotnet run` fails the `global.json` 10.0.401 pin. The check used the existing Debug build of the tool at `190b2c2` (`dotnet tools/ParishLife.Maintenance/bin/Debug/net10.0/ParishLife.Maintenance.dll`, runtime 10.0.15). Install a .NET 10.0.4xx SDK before the next build/publish.
- After bootstrap and sign-in verification, remove `77.246.79.196` from both lists.

## Bootstrap and sign-in verified (13 November 2026)

- `bootstrap-superadmins` completed cleanly for both accounts from the owner's terminal: `colinsleiman` (password + MFA set earlier that morning; this run only re-verified existing credentials and a current code, changing nothing) and `georgestawk` (password set earlier; MFA finished in this run — Georges added a freshly generated Base32 secret to his own phone's Microsoft Authenticator, then the current code was verified). Cosmos confirms both: `platformOperator: true`, `twoFactorEnabled: true`, `authenticatorKey` set for each; passwords/secrets were never displayed, logged, or seen by the assistant.
- **Live sign-in proven end to end, from the owner's own terminal, never through the assistant:** `GET /api/auth/csrf` → `POST /api/auth/login` (password) → `POST /api/auth/login/mfa` (TOTP code) → `GET /api/auth/me` all succeeded for `colinsleiman` against the deployed API.
- **Session survives a restart:** with the signed-in cookie session kept open, `az webapp restart` was run, the app came back `Healthy`, and the *same* cookie's `GET /api/auth/me` immediately succeeded again (same PowerShell session, not a new sign-in). This is the full Data Protection round trip under real use, not just the key-ring write/unwrap probe from the first deploy.
- Note for next time: a `.ps1` script's variables (including `-SessionVariable`) do not persist into the parent shell when run normally; dot-source it (`. script.ps1`) to keep `$session` usable for a follow-up check in the same window.

## Owner commands for the three production changes (run in your own PowerShell after `az login`)

```powershell
# 1. Index policy (TenantControl, Billing, Catalog; all empty)
.\tools\Initialize-Cosmos.ps1 -ResourceGroup 'rg-parishlife' -AccountName 'cosmos-parishlife' -SubscriptionId '32797b77-a6e7-4d52-981f-cd92da8d44ae' -Apply
$env:AZURE_TOKEN_CREDENTIALS = "AzureCliCredential"; dotnet run --project tools/ParishLife.Maintenance -- check-infrastructure

# 2. App settings (-o none: the set command otherwise echoes every value, including the connection string)
$ai = az resource show -g rg-parishlife -n insights-parishlife --resource-type Microsoft.Insights/components --query properties.ConnectionString -o tsv
az webapp config appsettings set -g rg-parishlife -n app-parishlife -o none --settings ASPNETCORE_ENVIRONMENT=Production Storage__Provider=Cosmos Cosmos__Endpoint=https://cosmos-parishlife.documents.azure.com:443/ Cosmos__Database=ParishLife Azure__ManagedIdentityClientId=09700a6a-f406-498d-aee6-9011f2029654 BlobStorage__ServiceUri=https://storageparishlife.blob.core.windows.net/ BlobStorage__EvidenceContainer=evidence DataProtection__BlobUri=https://storageparishlife.blob.core.windows.net/data-protection/keyring.xml DataProtection__KeyIdentifier=https://keyvault-parishlife.vault.azure.net/keys/parishlife-data-protection DataProtection__ApplicationName=ParishLife.Production BackgroundJobs__Enabled=false "APPLICATIONINSIGHTS_CONNECTION_STRING=$ai"
Remove-Variable ai
az webapp config set -g rg-parishlife -n app-parishlife --always-on true -o none
az webapp config appsettings list -g rg-parishlife -n app-parishlife --query "[].name"

# 3. Deploy the API only
az webapp deploy -g rg-parishlife -n app-parishlife --src-path artifacts/api-190b2c2-fixed.zip --type zip --clean true
```

(Done 11 November 2026; kept for redeploys. `artifacts/api-190b2c2.zip` is the broken backslash-path zip; do not use it.)

`BackgroundJobs__Enabled=false` keeps workers off until step 5 passes; then set it to `true` (another change).

## Remaining, in order (each change needs the owner's explicit yes)

1. Read the live policy: `az cosmosdb sql container show -g rg-parishlife -a cosmos-parishlife -d ParishLife -n TenantControl --query "resource.indexingPolicy"`. If it is the default `/*`, the owner decides whether to narrow it to the manifest (recommended while empty): `.\tools\Initialize-Cosmos.ps1 -ResourceGroup 'rg-parishlife' -AccountName 'cosmos-parishlife' -SubscriptionId '32797b77-a6e7-4d52-981f-cd92da8d44ae' -Apply`, then rerun `check-infrastructure`.
2. App Service `app-parishlife` (read-only first): `az webapp show` (state, httpsOnly, `virtualNetworkSubnetId` = `snet-app-parishlife`, user-assigned identity `id-parishlife` attached), `az webapp config show` (.NET 10 stack, alwaysOn, minTls 1.2), `az webapp config appsettings list --query "[].name"` (names only).
3. App settings to ensure (values from `docs/azure-manual-setup/production.md`; never print the Application Insights connection string): `ASPNETCORE_ENVIRONMENT=Production`, `Storage__Provider=Cosmos`, `Cosmos__Endpoint`, `Cosmos__Database`, `Azure__ManagedIdentityClientId=09700a6a-f406-498d-aee6-9011f2029654`, `BlobStorage__ServiceUri`, `BlobStorage__EvidenceContainer=evidence`, `DataProtection__BlobUri`, `DataProtection__KeyIdentifier`, `DataProtection__ApplicationName=ParishLife.Production`, `APPLICATIONINSIGHTS_CONNECTION_STRING` (reference the existing `insights-parishlife`). Most are already in `appsettings.json`; App Service settings override them. `AllowedHosts` already lists the App Service host. Leave `BackgroundJobs__Enabled` true only once the app is verified.
4. Publish and deploy only the API: `dotnet publish ParishLife.Api/ParishLife.Api.csproj -c Release -p:UseAppHost=false -o artifacts/api`, zip the folder contents **with `tar.exe -a -c -f <zip> *` from inside the folder (not `Compress-Archive`, which writes backslash paths that break Linux deployment)**, `az webapp deploy -g rg-parishlife -n app-parishlife --src-path <zip> --type zip --clean true`. Do not deploy tests, AppHost or tools.
5. Verify: `/health/live`, `/health/ready`, `GET /api/auth/capabilities`; restart the app and confirm readiness again (key ring persisted in Blob, wrapped by Key Vault). Set the App Service health check path to `/health/ready` after it passes.
6. Bootstrap in the owner's own terminal only: `dotnet run --project tools/ParishLife.Maintenance -- bootstrap-superadmins` for `colinsleiman` and `georgestawk`; passwords and authenticator secrets are typed privately, never shared. This is the first real write and wrap/unwrap proof.
7. Then sign in through the deployed API with password + MFA, and confirm the session survives an app restart.
8. Cleanup: remove the owner IP from the Cosmos/Storage firewalls when maintenance is done (and stale `82.112.167.216`, `147.243.x` entries if not recognised). Consider restricting Key Vault networking.

## Not authorized/decided here

Production-only database (owner decision: no separate test database), so there are no live write tests beyond bootstrap and real use. External providers (email, OAuth, Turnstile) stay unconfigured. Frontend connection is Georges's work.
