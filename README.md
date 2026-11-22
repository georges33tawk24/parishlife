# ParishLife

ParishLife is a parish management platform for Maronite parishes in Lebanon, in English and Arabic (right to left). It has three faces:
- a **public site** with a parish directory, each parish's page, calendar, events and a form for guest requests;
- a **members' portal** for parishioners: their requests, ministries, meetings, calendar and messages;
- **workspaces** for parish offices, priests, ministry leaders, treasurers, the bishop and the platform operators. They cover people and households, sacraments and certificates, calendar and services, rooms and equipment, ministries and attendance, event registrations, finance records and numbered receipts, communications, requests and letters, and administration.

It runs at `https://parish-life.org`. The pilot is a few parishes. Nothing is sold or charged online: donations and receipts are recorded by the parish office.

## How it is put together

One ASP.NET Core application on .NET 10 (`ParishLife.Api`) answers the API and also serves the React pages, from one Azure App Service. Data is in Azure Cosmos DB (serverless) and private Blob Storage. A Key Vault key protects the encryption keys. The app reaches all three with its own managed identity, so it holds no passwords.

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains each part, how a request travels through the system, where data lives and why the main decisions were made.
- [hardening/PROJECT_MAP.md](hardening/PROJECT_MAP.md) is the full inventory: every route, stored document type, setting, cookie and third party, and who owns which file.
- [frontend/ARCHITECTURE.md](frontend/ARCHITECTURE.md) explains the frontend.

The other projects in the solution are never deployed:
- `ParishLife.UnitTests` and `ParishLife.IntegrationTests`: the backend tests;
- `ParishLife.EndToEnd`: a test-only host for the browser tests;
- `ParishLife.AppHost`: an Aspire dashboard for local runs;
- `tools/ParishLife.Maintenance`: a private operator console.

## Running it on your computer

You need:
- the .NET SDK 10.0.4xx (`global.json` pins 10.0.401 and accepts later patches);
- Node 26 LTS (Node 20 or later works);
- nothing from Azure. Development uses local files under `.parishlife-data/`, which Git ignores.

1. Trust the development certificate once: `dotnet dev-certs https --trust`.
2. Start the API with local storage: `dotnet run --project ParishLife.Api --launch-profile https`. It listens on `https://localhost:7243`. Do not use the `Azure` profile for everyday work: it talks to the real database.
3. Start the frontend: `cd frontend && npm ci && npm run dev`, then open `https://localhost:5173/index.html`.
4. To sign in locally, create the two operator accounts with the private interactive command `dotnet run --project tools/ParishLife.Maintenance -- bootstrap-superadmins --local`. Details, including how to verify an ordinary account, are in [frontend/README.md](frontend/README.md).

The Aspire dashboard (`dotnet run --project ParishLife.AppHost`) is optional. It needs the Aspire CLI.

No business data is ever created at startup. The only accounts a command creates are the two operators, `colinsleiman` and `georgestawk`.

## Settings

ASP.NET Core reads settings from `appsettings*.json`, from environment variables (`Section__Key`) and, in production, from App Service settings. Secrets live only in Key Vault; App Service holds a Key Vault reference. [.env.example](.env.example) lists every name with placeholders. The full table with the file that reads each one is in the project map, section 5.

| Settings | Purpose |
|---|---|
| `ASPNETCORE_ENVIRONMENT`, `AllowedHosts` | Development or Production; the host names the app answers to |
| `Storage__Provider`, `Storage__LocalPath` | `Cosmos` in production; `Local` (development and tests only) and its folder |
| `Cosmos__Endpoint`, `Cosmos__Database`, `Azure__ManagedIdentityClientId` | which Cosmos database, and which managed identity the app uses |
| `BlobStorage__ServiceUri`, `BlobStorage__EvidenceContainer` | where uploaded files go |
| `DataProtection__ApplicationName`, `DataProtection__BlobUri`, `DataProtection__KeyIdentifier` | the encryption key ring and the Key Vault key that wraps it |
| `BackgroundJobs__Enabled` | runs the five background workers (on in production) |
| `Passkeys__ServerDomain` | optional passkey domain |
| `Turnstile__SiteKey`, `Turnstile__SecretKey` (secret), `Turnstile__ExpectedHostname` | the Cloudflare bot check: both keys or neither |
| `Email__Provider`, `Email__ResendApiKey` (secret), `Email__From` | account code emails through Resend: all three or none |
| `ExternalSignIn__google__*`, `ExternalSignIn__microsoft__*` | Google and Microsoft sign-in. Google's secret is in Key Vault; Microsoft uses the managed identity instead of a secret. |
| `PublicApp__*` | the installable-app manifest for the public site |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` (treat as secret), `OTEL_EXPORTER_OTLP_ENDPOINT` | telemetry to Application Insights, or to the Aspire dashboard locally |
| `ForwardedHeaders__Enabled`, `OpenApi__Enabled` | optional overrides: trust of the App Service front end (on outside Development), and the API description (Development only) |
| `PARISHLIFE_API`, `E2E_*` | frontend development proxy and browser-test options; never put into the built pages |

Startup refuses a half-configured feature (one Turnstile key without the other, for example) and an unresolved Key Vault reference, so a mistake shows up at once instead of breaking sign-in later.

## Tests and checks

| What | Command | Last result (22 November 2026) |
|---|---|---|
| Backend unit and integration tests | `dotnet test ParishLife.slnx` | see `hardening/reports/08-devops.md` for the final count (baseline 591 of 591) |
| Frontend format, module checks, route check, build | `cd frontend && npm run format:check && npm run check && npm run check:routes && npm run build` | all pass |
| Browser tests (every role, English and Arabic, against the real API on temporary storage) | `cd frontend && E2E_CHANNEL=chromium npm run e2e` | 17 of 18 pass; "public pages load signed out" fails on machines that do not trust the local development certificate |
| Load test (local hosts only) | see the header of `tools/load/parishlife.k6.js` | hardening report 04 |
| Secret scan and dependency audits | `gitleaks git --redact --log-opts="--all" .`, `dotnet list ParishLife.slnx package --vulnerable --include-transitive`, `npm audit --audit-level=high` | no leaks, no vulnerable packages |

There are no AI evaluations: ParishLife makes no AI model calls.

All of these run on GitHub for every push and pull request (`.github/workflows/ci.yml`). Turn on the local hooks once per clone with `git config core.hooksPath .githooks`: one refuses a commit that contains a secret, the other a commit message that does not say what changed and why.

The tests run on local storage. They do not prove Cosmos behaviour under real load or concurrency.

## Deploying

Every deploy needs the owner's go-ahead.
- **Through GitHub (prepared, not switched on yet).** A push to `main` builds and checks the package. It deploys to staging if staging exists, then waits for a reviewer to approve production. The sign-in to Azure uses OpenID Connect, so GitHub holds no password. The one-time setup is in [docs/operations/deployment-and-rollback.md](docs/operations/deployment-and-rollback.md).
- **By hand (today).** Run `pwsh tools/Publish-ParishLife.ps1` to build the package, then run the `az webapp deploy` command it prints, after `az login`. The deploy log and the checks after each deploy are in [docs/operations/frontend-hosting.md](docs/operations/frontend-hosting.md).
- **Before a deploy that adds a queried field:** preview the Cosmos index with `tools/Initialize-Cosmos.ps1` and apply it first.

There is **no staging environment yet**. The cheapest one that mirrors production (same plan, its own database, containers, key and identity) is described step by step in the same runbook.

## Rolling back

App Service B1 has no deployment slots, so a rollback deploys the previous package again:
- with one click: re-run the last good `main` run in GitHub Actions;
- with one command: `az webapp deploy … --src-path <previous package> --type zip --clean true`.

Stored data stays readable by the previous version because changes only add optional fields. The rules are in [docs/operations/deployment-and-rollback.md](docs/operations/deployment-and-rollback.md).

## Backups and restore

- **Azure's own backups:** Cosmos continuous backup and Blob soft delete. The legal pages say 7 and 30 days; the owner still has to confirm them in Azure.
- **Operator snapshots:** `tools/ParishLife.Maintenance` exports a verifiable snapshot and restores it only into an empty, separate target.

A local restore drill on 22 November 2026 restored 148 records in under a second and matched the source exactly. How to export, verify, restore and run an Azure point-in-time restore test: [docs/operations/data-snapshot-and-recovery.md](docs/operations/data-snapshot-and-recovery.md).

## Monitoring, logs, alerts and errors

- **Telemetry:** Application Insights `insights-parishlife` holds requests, dependency calls, warnings and failures, joined by the trace id users see on error messages. Search it in the Azure portal under **Logs**.
- **Health:** `/health/live` and `/health/ready`.
- **Alerts, uptime tests and the budget** are defined in `infra/monitoring.bicep`. They are not deployed yet. The runbook, with what the logs keep, how long, and the spend caps per service: [docs/operations/monitoring-and-alerts.md](docs/operations/monitoring-and-alerts.md).
- **Browser errors and real-user page speed** are not collected (an owner decision; the runbook gives the options).

## Security decisions

- **Sessions** are `__Host-` cookies (`Secure`, `SameSite=Strict`) backed by a server-side session checked on every request. Every write needs an anti-forgery token.
- **Sign-in** uses passwords of 16 or more characters, an authenticator app with recovery codes, passkeys, and Google or Microsoft. Operators and staff must use MFA. A recovery sign-in is restricted.
- **Permissions** are checked in the services, for one selected staff appointment at a time. Hidden records answer 404.
- **Abuse:** rate limits per client address, the Cloudflare Turnstile bot check on anonymous forms, and security events logged for alerting.
- **Encryption:** sensitive free text is encrypted with a key ring wrapped by Key Vault. There are no secrets in the repository, and its whole history was scanned.
- **Production access:** who and what can reach production today, and what to remove, is in [docs/operations/production-access.md](docs/operations/production-access.md).

The hardening run of 21 and 22 November 2026 reviewed secrets, security, performance, UI, legal pages, operations and tests. Each agent's report, with its findings, changes and the steps left for the owner, is in [hardening/reports/](hardening/reports/). Requests between agents are in [hardening/handoffs/](hardening/handoffs/).

## More documents

- `docs/operations/`: one runbook per area (accounts, sacraments, finance, requests, hosting, email…).
- `docs/frontend-modules/`: what each portal module shows and which API it uses.
- `docs/continuation/`: the project's working state, owner decisions and open owner questions (`OWNER-QUESTIONS.md`).
- `docs/verification/`: earlier verification records.
- `HANDOVER.md`: the state of the full-stack work on 17 November 2026.
