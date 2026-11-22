# Deploying, staging and rolling back

Written 22 November 2026 (hardening run, Agent 08). The pipeline is `.github/workflows/ci.yml`. Until the owner finishes the setup steps below, **nothing deploys from GitHub**: the deploy jobs are switched off by two repository variables, and GitHub holds no Azure credential. The manual path in [frontend-hosting.md](frontend-hosting.md) ("Deploying") keeps working unchanged.

## What runs, and when

| Job | Runs on | What it does | Blocks a merge |
|---|---|---|---|
| Secret scan | every push and pull request | gitleaks 8.30.1 over every commit, findings redacted | yes |
| Backend build and tests | every push and pull request | locked restore, known-vulnerable NuGet packages (direct and transitive), Release build with warnings as errors, all unit and integration tests | yes |
| Frontend checks and build | every push and pull request | `npm ci`, Prettier check, module checks, route check, build, `npm audit --audit-level=high` | yes |
| Commit messages | every push and pull request | the hook's own tests; on a pull request, every commit must say what changed and why (`.githooks/commit-msg`) | yes |
| Deploy package | every push and pull request | `tools/Publish-ParishLife.ps1`: API plus the built frontend, refuses tests, AppHost, tools and key files; kept 90 days for pushes to `main` | yes |
| End-to-end browser tests | every push and pull request | the test-only host and Playwright Chromium (`E2E_CHANNEL=chromium`) | not yet (see below) |
| Deploy to staging | pushes to `main` only, when the repository variable `STAGING_ENABLED` is `true` | deploys the package, then waits for `/health/ready` | — |
| Deploy to production | pushes to `main` only, when `PRODUCTION_DEPLOY_ENABLED` is `true`, after staging passed or was skipped | waits in the `production` environment for a required reviewer, deploys the same package, waits for `/health/ready` | — |

A push to any other branch (for example `fullstack-hardening`) and every pull request run the checks only. Deploys need a push to `main`, the variable, the environment's approval, and the Azure federated credential, which trusts only jobs running in that GitHub environment.

The end-to-end job is not a required check yet. On this machine 1 of 18 tests fails for a known reason: the local development certificate is not trusted, so Chromium refuses the service-worker script. A Linux runner has the same problem. Agent 09 owns the test harness and is fixing it there. Once the job passes on GitHub, add it to the required checks (step 4 below) and to the `needs` of the deploy jobs.

### The same commands on your machine

Each step was run in the worktree on 22 November 2026 before it went into the workflow:

| Step | Command | Result |
|---|---|---|
| Secret scan | `gitleaks git --redact --no-banner --log-opts="--all" .` | 326 commits, no leaks |
| Locked restore | `dotnet restore ParishLife.slnx --locked-mode` | OK |
| Vulnerable packages | `dotnet list ParishLife.slnx package --vulnerable --include-transitive` | all 6 projects: no vulnerable packages |
| Build | `dotnet build ParishLife.slnx -c Release --no-restore -p:AspireUseCliBundle=false` | 0 errors, 1 warning (ASPIRE010, the switch itself) |
| Tests | `dotnet test ParishLife.slnx -c Release --no-build` | see the hardening report 08 for the final count |
| Frontend | `cd frontend && npm ci && npm run format:check && npm run check && npm run check:routes && npm run build` | all pass (route check: 634 matched, 2 known gaps, 0 new) |
| npm audit | `npm audit --audit-level=high` | 0 vulnerabilities |
| Package | `pwsh tools/Publish-ParishLife.ps1 -OutputRoot <folder>` | 229 files, 26.6 MB zip, no backslash entries, no forbidden files |
| Commit messages | `sh tools/tests/commit-msg.Tests.sh` | 14 of 14 cases |

Why `-p:AspireUseCliBundle=false`: building the local-only Aspire AppHost normally downloads the Aspire CLI bundle, which timed out on this machine (error ASPIRE009 after 120 s). The switch still compiles the AppHost, so a broken AppHost still fails CI, but without the download. The AppHost is never deployed.

Turn on the local hooks once per clone: `git config core.hooksPath .githooks`. That runs the gitleaks pre-commit hook and the commit-message hook.

## One-time setup (owner)

The repository is public, so environments with required reviewers and branch protection are free on GitHub's Free plan. The Azure deploy identity below is also free.

1. **Deploy identity in Azure.** It is separate from the app's own identity `id-parishlife` and may only deploy the web app. Run these in your own terminal after `az login`:
   ```powershell
   az identity create -g rg-parishlife -n id-parishlife-github-deploy -l francecentral
   $principal = az identity show -g rg-parishlife -n id-parishlife-github-deploy --query principalId -o tsv
   $site = az webapp show -g rg-parishlife -n app-parishlife --query id -o tsv
   az role assignment create --assignee-object-id $principal --assignee-principal-type ServicePrincipal --role "Website Contributor" --scope $site
   az identity federated-credential create -g rg-parishlife --identity-name id-parishlife-github-deploy -n github-production `
     --issuer https://token.actions.githubusercontent.com --subject "repo:georges33tawk24/parishlife:environment:production" --audiences api://AzureADTokenExchange
   az identity show -g rg-parishlife -n id-parishlife-github-deploy --query clientId -o tsv   # for AZURE_CLIENT_ID
   ```
   Only a job inside the GitHub environment `production` of this repository can exchange its token for this identity. It holds no password or secret.
2. **GitHub environment `production`** (repository **Settings → Environments → New environment**):
   - **Required reviewers:** you and Colin. Tick "Prevent self-review" if you want a second person to approve.
   - **Deployment branches and tags:** "Selected branches and tags", add `main`.
   - **Environment secrets:** `AZURE_CLIENT_ID` (step 1), `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.
   - **Environment variables:** `AZURE_RESOURCE_GROUP` = `rg-parishlife`, `AZURE_WEBAPP_NAME` = `app-parishlife`, `PUBLIC_URL` = `https://parish-life.org`.
3. **Repository variable** (**Settings → Secrets and variables → Actions → Variables**): `PRODUCTION_DEPLOY_ENABLED` = `true`. Set it **last**, after step 2 shows the required reviewers. Leave `STAGING_ENABLED` unset until staging exists.
4. **Protect `main`** (**Settings → Rules → Rulesets → New branch ruleset**, target `main`):
   - Require a pull request before merging, with one approval.
   - Require status checks to pass, and the branch to be up to date: `Secret scan`, `Backend build and tests`, `Frontend checks and build`, `Commit messages`, `Deploy package`. They appear in the list after the workflow has run once.
   - Block force pushes and deletions.
   - Do not add a bypass list, so administrators follow the same rules.
5. **Secret scanning and push protection** (**Settings → Code security**): turn both on. Free for public repositories.
6. **Optional hardening:** turn off basic-auth publishing credentials on the app, so no publish profile can ever deploy (Azure portal → `app-parishlife` → **Configuration → General settings → SCM Basic Auth Publishing Credentials** and **FTP Basic Auth Publishing Credentials** → Off). Both `az webapp deploy` with `az login` and the GitHub job use Entra sign-in, so neither is affected.

### First push: what to check (the pipeline has never run)

The workflow could not be run during the hardening run (no pushes allowed, no GitHub CLI). On the first push, open **Actions → CI** and check:
1. **Secret scan:** the gitleaks download and checksum line pass, and the scan reports "no leaks found".
2. **Backend:** `setup-dotnet` installs a 10.0.4xx SDK, the locked restore passes, and the test step shows the same counts as locally (unit and integration both green). Look for test failures that only happen on Linux (time zones, paths, file locking).
3. **Frontend:** Node 26 is installed and every step passes. The local run used Node 25.
4. **Package:** the step prints `Package: …/api-<commit>.zip (229 files …)`.
5. **End-to-end:** expect the "public pages load signed out" failure until Agent 09's certificate fix lands. Any other failure is new.
6. **Deploy jobs:** on a push to a branch other than `main`, both show "skipped". On `main` before step 3, both are skipped too.
7. The first time production runs, the job waits for approval, then deploys. `/health/ready` must answer 200 within about 2.5 minutes. Then open the site and sign in.

## Staging (not created yet)

There is no staging environment. Everything below is ready for you to create it. The cheapest setup that mirrors production adds almost nothing to the bill:

| Part | Production | Staging (recommended) | Extra cost |
|---|---|---|---|
| Web app | `app-parishlife` on `plan-parishlife` (B1) | `app-parishlife-staging` on the **same** plan, using the same VNet integration subnet | no extra compute: apps on one plan share it. Staging load slows production, so stop staging when you are not testing (`az webapp stop`). |
| Identity | `id-parishlife` | `id-parishlife-staging` | free |
| Database | Cosmos serverless `cosmos-parishlife`, database `ParishLife` | same account, database `ParishLifeStaging`; the staging identity gets data access to that database only | serverless: pay per request and stored GB, so close to nothing when idle |
| Files | `storageparishlife`, containers `evidence` and `data-protection` | same account, containers `staging-evidence` and `staging-data-protection`; staging identity on those two only | close to nothing |
| Key ring key | Key Vault key `parishlife-data-protection` | key `parishlife-staging-data-protection`; staging identity on that key only | a few cents of key operations |
| Bot check | the real Turnstile widget | Cloudflare's published test keys, or a second widget limited to the staging host | free |
| Google and Microsoft sign-in | live clients | off (no `ExternalSignIn__*` settings) | free |
| Email | Resend | off (no `Email__*` settings), or a separate Resend key | free |
| Payments | none | none ("test mode" is not applicable) | — |
| Data | real | **never** a copy of production. Accounts are created by hand in staging. | — |

Steps (owner, in your own terminal after `az login`; each one is an Azure change):
1. `az identity create -g rg-parishlife -n id-parishlife-staging -l francecentral`.
2. Create the app on the existing plan, attach the identity, turn on HTTPS only and Always On, and join the subnet:
   `az webapp create -g rg-parishlife -p plan-parishlife -n app-parishlife-staging --runtime "DOTNETCORE:10.0"`, then
   `az webapp identity assign -g rg-parishlife -n app-parishlife-staging --identities <id-parishlife-staging resource id>`,
   `az webapp update -g rg-parishlife -n app-parishlife-staging --https-only true`,
   `az webapp vnet-integration add -g rg-parishlife -n app-parishlife-staging --vnet <vnet> --subnet snet-app-parishlife`.
3. Database and containers: copy `docs/cosmos/containers.json` to a scratch file, change `"database"` to `"ParishLifeStaging"`, then run `tools/Initialize-Cosmos.ps1 -ResourceGroup rg-parishlife -AccountName cosmos-parishlife -ManifestPath <scratch file>` (preview), then add `-Apply`.
4. Data access: give the staging identity's principal "Cosmos DB Built-in Data Contributor" scoped to `/dbs/ParishLifeStaging` (`az cosmosdb sql role assignment create … --scope "/dbs/ParishLifeStaging"`), "Cosmos DB Built-in Data Reader" on `/` (the readiness check reads account metadata), "Storage Blob Data Contributor" on each of the two staging containers, and "Key Vault Crypto Service Encryption User" on the new key only.
5. App settings: the same names as production ([production.md](../azure-manual-setup/production.md)) with `Cosmos__Database=ParishLifeStaging`, `Azure__ManagedIdentityClientId=<staging client id>`, `BlobStorage__EvidenceContainer=staging-evidence`, `DataProtection__BlobUri=…/staging-data-protection/keyring.xml`, `DataProtection__KeyIdentifier=…/keys/parishlife-staging-data-protection`, `DataProtection__ApplicationName=ParishLife.Staging`, and `AllowedHosts=<staging azurewebsites host>`. Leave out the Google, Microsoft and Resend settings. `APPLICATIONINSIGHTS_CONNECTION_STRING` may point at the same Application Insights resource; the role name tells the two apps apart.
6. Health check path `/health/ready`.
7. Deploy identity for staging: repeat setup step 1 to create a **separate, staging-only** identity, with the subject `repo:georges33tawk24/parishlife:environment:staging` and the role on `app-parishlife-staging` only. Never add the staging subject to the production deploy identity: the `staging` environment has no reviewers, so that identity must not be able to touch `app-parishlife`. Create the GitHub environment `staging` (branch `main`, no reviewers) and set **all** of its secrets and variables there, including `AZURE_WEBAPP_NAME=app-parishlife-staging`. Keep `AZURE_WEBAPP_NAME`, `AZURE_CLIENT_ID` and the other deploy names out of the repository-level variables and secrets, so a missing staging value fails the job instead of falling back to production's (audit N6). Then set `STAGING_ENABLED=true`.
8. Create the two operator accounts in staging with the bootstrap command against staging settings. Never reuse production passwords there.

## Rollback

App Service B1 has no deployment slots (they start at Standard), so rolling back means deploying the previous package again. Both ways below were written from the workflow and the existing manual command. Neither has been tried yet, because there is no staging.

**One click (once the pipeline is set up):** Actions → CI → open the run of the last good commit on `main` → **Re-run all jobs** → approve the production job. It rebuilds that exact commit, checks it, and deploys it.

**One command (works today, from your terminal after `az login`):** download the `parishlife-package` artifact of the last good run (or keep your last good `artifacts/api-<commit>.zip` from `Publish-ParishLife.ps1`), then:
```powershell
az webapp deploy -g rg-parishlife -n app-parishlife --src-path parishlife-<commit>.zip --type zip --clean true
```
Then check `https://parish-life.org/health/ready` (Healthy), sign in once, and look at Application Insights failures for the new release.

**Test it once** on staging when it exists: deploy commit B, roll back to commit A by both methods, and write the time it took and the result into the deployment log in [frontend-hosting.md](frontend-hosting.md).

**Settings rollbacks** (no code): each feature switch has its own rollback in [frontend-hosting.md](frontend-hosting.md): remove the `Turnstile__*` or `ExternalSignIn__<provider>__*` settings and restart.

### Stored data must stay readable by the previous version (expand, then contract)

Cosmos has no schema migrations, so a rollback never needs a database step, as long as each change follows these rules:
- **Add, never rename or remove, in one release.** A new property is optional with a safe default. The previous version ignores properties it does not know (System.Text.Json skips unknown members), and the new version treats a missing one as the default.
- **Contract later.** Stop writing an old property in one release. Remove the code that reads it only in a later release, once a rollback past that point is no longer possible.
- **Never change a property's type or meaning in place.** Add a new property, write both for a release, then switch readers.
- **Index changes are additive.** Add new paths to `docs/cosmos/containers.json` and apply them with `tools/Initialize-Cosmos.ps1` **before** deploying code that queries them. An extra indexed path costs the previous version nothing. The readiness check refuses a live policy that lacks a path the code needs.
- **Document types** carry `schemaVersion` in their envelope (`Api/Data/Cosmos/Documents.cs`). A new version reads old ones; bump it only with a reader for both.
- **The key ring** must never be replaced on a rollback. Every version reads the same `data-protection/keyring.xml` wrapped by the Key Vault key.
