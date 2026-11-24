# Who and what can reach production

Written 22 November 2026 (hardening run, Agent 08, item 18). Every fact comes from the repository's records: `docs/continuation/AZURE-CONNECTION.md`, `docs/operations/frontend-hosting.md`, `docs/azure-manual-setup/production.md` and the code. Nothing was read from Azure, so roles granted outside those records are unknown. **Every removal or tightening below is for the owner**, because it changes Azure, Entra, Cloudflare or GitHub.

## Today

| Who or what | Can reach | How it signs in | Logged where | Source |
|---|---|---|---|---|
| The app's managed identity `id-parishlife` (client id ending `2029654`) | Cosmos data (Built-in Data Contributor on `/dbs/ParishLife`, all partitions); Blob containers `evidence` and `data-protection`; Key Vault key `parishlife-data-protection` (wrap and unwrap); Key Vault secrets `turnstile-secret-key` and `google-client-secret` (and `resend-api-key` once set); the Entra app's federated credential for Microsoft sign-in | Managed identity, from `snet-app-parishlife` only (firewalls) | App audit rows in Cosmos for every write; Azure diagnostics if turned on | AZURE-CONNECTION.md, frontend-hosting.md |
| The owner account that ran the Azure sessions (object id `549167b7-…`) | Cosmos Data Contributor on `/dbs/ParishLife` and Data Reader on `/`; Blob Data Contributor on `data-protection`; Key Vault Crypto Officer and Secrets Officer; the management roles that deployed, set app settings and granted roles (exact subscription role not recorded) | `az login` to the tenant, which requires MFA | Azure Activity Log (management actions, 90 days) | AZURE-CONNECTION.md, frontend-hosting.md |
| **AI coding sessions** ("the Azure session") on the owner's computer | Everything the owner's `az login` allowed while it was active: they deployed, changed app settings, granted roles and edited firewalls | They ran `az` with the owner's signed-in token. Passwords and secrets never passed through them (recorded). | Activity Log, under the owner's name | AZURE-CONNECTION.md, frontend-hosting.md |
| Operator console `tools/ParishLife.Maintenance` | Cosmos, Blob and Key Vault with the signed-in developer's credentials (`check-infrastructure`, `bootstrap-superadmins`, `verify-identity`, `snapshot-export`, `snapshot-restore`) | `DefaultAzureCredential` without managed identity, plus a firewall IP added for the session | The restore writes an audit row; Activity Log for firewall changes | `tools/ParishLife.Maintenance/Program.cs`, data-snapshot-and-recovery.md |
| Colin's Azure session | Unknown roles; it did the earlier deploys of `fullstack-integration` | `az login` | Activity Log | HANDOVER.md |
| Platform operators `colinsleiman` and `georgestawk` | The app's administration API (platform lists, suspend and reinstate), through the web app only | Password plus authenticator (MFA required for operators) | Cosmos audit rows; each administration read is audited | `Api/Identity/AccountAccess.cs`, HANDOVER.md |
| Cosmos account keys | All data, bypassing roles. Local (key) auth is **not** disabled; Storage shared keys are disabled. | The account key, from anyone with list-keys rights, but only from an allowed network | Not logged by the app | AZURE-CONNECTION.md |
| App Service publishing (SCM/Kudu, FTP) | Replacing the running code | FTPS-only is recorded; whether basic-auth publishing credentials are off is not | Activity Log, Kudu deployment log | AZURE-CONNECTION.md |
| GitHub Actions (new, not active) | Deploying the web app only (Website Contributor on `app-parishlife`) | OpenID Connect from the `production` environment, after a required reviewer approves | GitHub deployment history plus Activity Log | `.github/workflows/ci.yml`, deployment-and-rollback.md |
| Outside consoles | Cloudflare (DNS, Turnstile, Email Routing: Georges's account), Google Cloud project "ParishLife" (OAuth client), Entra app registration "ParishLife", Resend | Each provider's own sign-in | Each provider's audit log | frontend-hosting.md, notification-delivery.md |

**What does not reach production:**
- Developer machines in their normal setup run Development with local file storage and their own key ring, so they hold no production secrets.
- The repository holds no secret (Agent 02 scanned the whole history; `.env.example` has placeholders only).
- Tests and the end-to-end host use temporary local storage.
- There is no staging. When there is, it gets its own identity, database, containers and key (deployment-and-rollback.md).

## Needs your action (each is an Azure, Entra, Cloudflare or GitHub change)

1. **AI tools get no production login.** Never leave an `az login` with production rights open in a terminal an AI coding tool can use. Run production commands yourself, then `az logout`. Prefer the GitHub deploy (OpenID Connect plus a reviewer) to manual deploys. Cost: none.
2. **Separate everyday and admin accounts.** Use an account without Azure roles for development. Give production roles to a separate admin account with MFA, used only for production work. Microsoft's Entra Privileged Identity Management (just-in-time roles) needs an Entra ID P2 licence, a paid plan per user, so for a pilot the separate account is enough.
3. **Remove standing data roles from people.** Remove the owner account's Cosmos Data Contributor on `/dbs/ParishLife`, Blob Data Contributor on `data-protection` and Key Vault Crypto Officer and Secrets Officer, once the Azure work is done. Grant them again only for a maintenance window, with the firewall IP, then remove them. Keep "Reader" for looking around.
4. **Disable Cosmos key auth** (`disableLocalAuth=true`), so data access needs a role. The app and the operator tool already use roles. Check `check-infrastructure` and `/health/ready` afterwards.
5. **Turn off App Service basic-auth publishing** (SCM and FTP), so no publish profile can deploy (deployment-and-rollback.md, setup step 6).
6. **Review who holds roles:** Azure portal → `rg-parishlife` → **Access control (IAM) → Role assignments**. Remove anyone and anything you do not recognise. Do the same for Colin's access, as you decide.
7. **Log data access:** turn on Cosmos diagnostic settings (`DataPlaneRequests`) and Key Vault `AuditEvent` to the Application Insights workspace. It costs log ingestion; watch the daily cap in monitoring-and-alerts.md.
8. **Outside consoles:** turn on MFA for Cloudflare, Google, GitHub and Resend, and review their member lists.
