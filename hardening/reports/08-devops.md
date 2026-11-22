# 08 DevOps and SRE

Agent 08, branch `hardening/08-devops`, cut from `fullstack-hardening` at `7b91f64`, 22 November 2026. Nothing was deployed, and nothing touched Azure, Cloudflare, DNS or GitHub settings (`az` was never run). Production received five read-only requests: three `curl -I` (apex, the http redirect, `www`) and two `openssl s_client` handshakes. Public DNS was read with `dig`. One read-only GET to `api.github.com` confirmed the repository is public.

## A. Summary

- **Before:** no CI, no staging, manual deploys, no alert rules, uptime tests or budgets in the repository, and a README that described a backend-only project with 331 tests.
- **Now in the repository:**
  - a GitHub Actions pipeline: secret scan, both dependency audits, backend build and the 591 tests, frontend checks and build, commit-message check, deploy package, end-to-end job;
  - deploys only from `main`, through OpenID Connect, with production behind required reviewers; switched off until the owner sets two variables;
  - a commit-message hook and a pull request template;
  - monitoring as code (`infra/monitoring.bicep`);
  - runbooks for deploys, rollback, staging, backups, monitoring, email DNS and production access;
  - a README for people, and `docs/ARCHITECTURE.md`.
- **Found and fixed:**
  - Every `--local` command of the maintenance tool crashed at startup. That blocked the documented local restore and local bootstrap.
  - The publish script worked only on Windows.
- **Proven locally:** every CI step's command, and a local restore drill: 148 records restored and matching the source exactly. **Not proven:** a real pipeline run, any Azure-side backup, alert or restore (all owner steps).
- **Outdated finding corrected:** Agent 06 saw no MX record on 22 November. Later that day, DNS showed Cloudflare Email Routing, SPF, DMARC at `p=none` and Resend DKIM.

## B. Item table

Status counts: Fixed 4, Already OK 1, Needs your action 12, Could not verify 1, Not applicable 0. Total 18. Sub-parts that do not apply: failed-payment and webhook-signature alerts, the payment test mode in staging, AI evals in CI, and the checkout uptime check. ParishLife has no online payments, no inbound webhooks and no AI calls.

| Item | Status | Severity | What I found | What I changed (files) | How I verified it |
|---|---|---|---|---|---|
| 1. CI/CD | Could not verify (no push possible) | High | No `.github/`; nothing ran tests, audits or the scan before a deploy; deploys by hand | `.github/workflows/ci.yml`. Every push and pull request runs: gitleaks (full history, redacted); locked restore plus vulnerable-package check; Release build plus all tests; Prettier, module checks, route check, build, `npm audit --audit-level=high`; commit messages; the deploy package; e2e as its own job. Deploy jobs need a push to `main`, a repository variable, and (production) the `production` environment's reviewers. Azure sign-in through `azure/login` OIDC. A push of `fullstack-hardening` runs checks only. | Each command run locally (section D of `docs/operations/deployment-and-rollback.md`): gitleaks no leaks (326 commits); restore OK; 6 projects no vulnerable packages; build 0 errors (1 ASPIRE010 warning, explained); 591/591 tests; frontend all pass; npm audit 0; package 229 files. `RestoreLockedMode` env proven (NU1004 with it, silent rewrite without). YAML parsed; branch and event gating reviewed. The GitHub run itself: first-push checklist in the runbook. |
| 2. Staging | Needs your action | Medium | None exists (owner question 26) | Cheapest mirror documented: same B1 plan (no extra compute), its own database `ParishLifeStaging`, containers, Key Vault key and identity, Turnstile test keys, no real data. Pipeline job `deploy-staging` ready (`STAGING_ENABLED`). | Not verifiable without Azure |
| 3. Rollback | Needs your action | Medium | B1 has no slots; no documented rollback | One click (re-run the last good `main` run) and one command (`az webapp deploy` of the previous package); expand-then-contract rules for Cosmos documents and indexes (`docs/operations/deployment-and-rollback.md`) | Not tested: there is no staging. Owner step E7. |
| 4. Backups | Needs your action | High | Cosmos continuous 7 days and Blob soft delete 30 days are claimed in docs only; snapshot schedule, custody and retention undecided (U15) | Backup checks, an Azure point-in-time restore test, a recommended pilot policy, and the local drill record (`docs/operations/data-snapshot-and-recovery.md`). Fixed the maintenance tool's `--local` start (`tools/ParishLife.Maintenance/Program.cs`). | Local restore drill (section C) |
| 5. Alerting | Needs your action | High | No alert rules in the repository; Agent 03's security events had no consumer | `infra/monitoring.bicep`: email action group; metric alerts for downtime (2 tests from 3 regions), App Service health check, 5xx, slow responses, CPU, memory, Cosmos 429; log alerts for 03's security events (03's thresholds plus any lockout) and for failing background workers; runbook with investigation queries (`docs/operations/monitoring-and-alerts.md`) | Not compiled (no Bicep CLI here); `what-if` is step 1. No test alert could be sent (owner step E9). |
| 6. Performance monitoring | Needs your action | Medium | Application Insights request and dependency telemetry exists; no real-user vitals; Cosmos query metrics off | Latency alert and queries; 04's local baseline recorded; options and costs for real-user vitals and Cosmos diagnostics | Read the code and 04's report |
| 7. Error tracking | Needs your action | Medium | Backend: 500s with type and trace id, no stack (by design); releases not tagged; frontend: nothing; no public source maps (02) | Release-tag patch for the integrator (`hardening/handoffs/patches/08-telemetry-release-tag.patch`, with a unit test); frontend options documented | Patch test passed with the change and failed without it; patch applies cleanly |
| 8. Logging | Needs your action | Medium | Structured ILogger through OpenTelemetry, levels in `appsettings.json`, trace id on every line, no secrets (03 tested); query values redacted by the instrumentation's default; retention and IP masking are Azure settings | What the logs keep and for how long, recorded for 06 #3 (`docs/operations/monitoring-and-alerts.md`); daily cap step | Code and lock file read; Azure facts are owner step E10 |
| 9. Uptime | Needs your action | High | None | Two free classic ping tests (`/health/ready`, `/`), from France Central, West Europe and North Europe, every 5 minutes; alert when 2 regions fail; App Service health-check alert. Login: the readiness test covers its services; a synthetic sign-in would need real credentials past Turnstile. | Bicep not deployed |
| 10. Spend caps | Needs your action | Medium | No budgets; Azure pay-as-you-go has no hard cap | Budget with 50/80/100 % actual and 100 % forecast in the Bicep file; per-service table with the recommended cap (`docs/operations/monitoring-and-alerts.md`) | — |
| 11. Domain and SSL | Already OK | Low | Certificate chain valid (GeoTrust TLS RSA CA G1 to DigiCert Global Root G2, 18 Nov 2026 to 18 May 2027, auto-renewed managed certificate); http goes to https (301); `www` goes to the apex (301, Cloudflare); one canonical host. Live HSTS is still 30 days and `Server: Kestrel` is still sent: production runs pre-hardening code; 03's one-year `includeSubDomains` header ships with the next deploy. | Dated check in `docs/operations/frontend-hosting.md` | `openssl s_client` (verify 0, TLS 1.3); three `curl -I` |
| 12. Email authentication | Needs your action | Medium | Seen on 22 Nov: MX Cloudflare routing; apex SPF `include:_spf.mx.cloudflare.net ~all`; DMARC `p=none` with Cloudflare reports; Resend DKIM `resend._domainkey`; return path `send` CNAME | Records and the DMARC path to quarantine and then reject (`docs/operations/email-delivery.md`) | `dig` via 1.1.1.1 and 8.8.8.8 |
| 13. Infrastructure security | Needs your action (WAF decision) | Low | Apex on HTTP/1.1 through App Service's front end; platform-patched Kestrel; Kestrel refuses CL+TE smuggling; no WAF or CDN on the apex | Documented with 03's handoffs 2 and 3; proxy decision in E | Live HEAD (HTTP/1.1); 03's report |
| 14. Secrets in CI | Fixed | High | No CI before | Secret scan on every push (redacted); Azure through OIDC, so no password, publish profile or client secret exists; the IDs as environment secrets, named only; no `echo` of any secret; deploy identity scoped to the web app | Local gitleaks; workflow review; can only be seen in a real run (item 1) |
| 15. README | Fixed | Medium | Out of date (331 tests, "frontend deferred", "publish only the API") | `README.md` rewritten for people; outdated lines fixed in `frontend/README.md` and `HANDOVER.md` | Every fact checked against code, docs and today's runs |
| 16. Commit messages and branch protection | Fixed (hook, template, CI); branch protection is E4 | Medium | Messages like "fix" possible; no protection | `.githooks/commit-msg` (subject 10–72 characters, no lone vague word, a reason line), `tools/tests/commit-msg.Tests.sh` (14 cases, run in CI), CI job over every pull-request commit, `.github/pull_request_template.md`; ruleset steps (required checks named) | Hook tests 14/14; the scissors case proven to fail without its fix; my own commit messages pass it |
| 17. ARCHITECTURE | Fixed | Medium | Only partial docs (`docs/architecture/backend-foundation.md`) | `docs/ARCHITECTURE.md`: parts, folders, the life of one request, data and partitions, workers, decisions and why, what is unknown; links the existing docs | Facts checked against code and the project map |
| 18. Production access | Needs your action | High | The app identity has data access to every partition; the owner account holds standing data and Key Vault roles; AI coding sessions deployed and changed settings with the owner's `az login`; Cosmos key auth on; publishing basic auth unknown | Inventory and 8 tightening steps (`docs/operations/production-access.md`) | From docs only (no Azure access) |

## C. Backup restore test (local only)

- **Date:** 22 November 2026, 18:26 UTC.
- **Source:** a copy of the test-only end-to-end host's fixture store (`ParishLife.EndToEnd`: fixture accounts for every role, isolated temporary local storage). Not production, not Cosmos.
- **Target:** a new, empty local directory.
- **Tool:** `tools/ParishLife.Maintenance --local`, Release build.
- **Duration:**
  - export under 1 s (148 records in 5 containers, 0 evidence files);
  - verify against the recorded manifest SHA-256 under 1 s;
  - dry run about 1 s (`DryRunReady`, 29 batches);
  - apply 0.44 s (`Restored`, 148 of 148 read back equal).
- **Data check:** a fresh export of the restored target compared with the original manifest.
  - Accounts 61, Billing 8, LoginAliases 16 and TenantControl 60 have identical counts, partitions and SHA-256.
  - Catalog has the original 3 records plus exactly the restore's own `operations.snapshot_restore` audit row, as designed.
- **Not exercised:** evidence files (none in the fixture), and Cosmos or Blob. The Azure point-in-time restore test is owner step E6.
- **Found on the way:** every `--local` command crashed (`AggregateException` from Development's build-time validation of web-only registrations). Fixed in `2c4fa7f`.

## D. Rollback plan (exact steps)

1. Find the last good commit on `main`: Actions → CI history, or the deploy log in `docs/operations/frontend-hosting.md`.
2. **One click:** Actions → CI → that run → **Re-run all jobs** → approve "Deploy to production". It rebuilds and redeploys that commit.
3. **Or one command**, after `az login`, with that run's `parishlife-package` artifact (kept 90 days) or your own `artifacts/api-<commit>.zip`:
   `az webapp deploy -g rg-parishlife -n app-parishlife --src-path parishlife-<commit>.zip --type zip --clean true`
4. Check `https://parish-life.org/health/ready` (Healthy), sign in once, and look at Application Insights failures.
5. For a settings change, remove the setting (for example the `Turnstile__*` or `ExternalSignIn__<provider>__*` settings) and restart.
6. Data needs no step if changes followed expand-then-contract (runbook). Never replace the key ring.
7. Rehearse once on staging and record the time (E7).

## E. Needs your action

Costs: GitHub features are free for a public repository. Azure figures could not be read from Microsoft's pricing page (it showed "$-" to the automated reader), so check the prices there. The free allowances quoted come from that page.

1. **GitHub deploy identity** (free): run the `az identity create` / role / federated-credential commands in `docs/operations/deployment-and-rollback.md`, setup step 1. The role is Website Contributor on `app-parishlife` only.
2. **GitHub environment `production`** (free): required reviewers (you and Colin), branch `main`; secrets `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`; variables `AZURE_RESOURCE_GROUP`, `AZURE_WEBAPP_NAME`, `PUBLIC_URL`.
3. **Repository variable** `PRODUCTION_DEPLOY_ENABLED=true`, last.
4. **Ruleset on `main`:** pull request with one approval; required checks `Secret scan`, `Backend build and tests`, `Frontend checks and build`, `Commit messages`, `Deploy package`; up to date; no force push or deletion; no bypass. Add `End-to-end browser tests` once it is green.
5. **First push:** follow the checklist in the runbook ("First push: what to check"). Turn on secret scanning and push protection (free).
6. **Backups:**
   - Confirm Cosmos "Continuous (7 days)", and Blob plus container soft delete 30 days.
   - Run one point-in-time restore into `cosmos-parishlife-restoretest`, compare counts, record the time, delete it. Cost: that account's storage while it exists.
   - Decide U15. Recommended: a monthly operator snapshot kept 3 months on an encrypted disk, and a quarterly drill.
7. **Staging:** recommended yes, in the cheapest form (no extra compute; serverless requests and storage). Steps 1–8 in the runbook, then `STAGING_ENABLED=true`. Then rehearse the rollback once and record it.
8. **Monitoring:** `az deployment group what-if`, then `create`, with `infra/monitoring.bicep`, `alertEmail` and `monthlyBudget`. Use about 1.5 times last month's actual cost from Cost analysis; if unsure, start at 25 in your billing currency.
   - Costs: 8 metric time series fall within the 10 free a month; 2 log alerts at the cheapest 15-minute rate; classic ping tests are free until 30 September 2028; 1,000 alert emails a month are free.
9. **Test alert:** Monitor → Action groups → `ag-parishlife-owner` → Test. Confirm the email arrives and note the date in the monitoring runbook.
10. **Logs (read-only checks):** retention of the App* tables is 90 days; IP masking is not disabled; `requests | where url has "?"` shows `Redacted`. Then set the workspace daily cap to 0.15 GB/day. That keeps a month under the 5 GB/month free allowance.
11. **Spend caps elsewhere:**
    - Resend: stay on Free.
    - Cloudflare: Free.
    - Google Cloud: no billing account on the "ParishLife" project, or a 1 USD budget.
    - Domain: keep auto-renew on.
    - GitHub Actions: free while the repository is public; if made private, add a $0 Actions budget with stop-usage.
12. **Email:**
    - Confirm the `privacy@` routing rule and send a test message.
    - Confirm Resend shows the domain Verified, then do one live code email.
    - DMARC after 2–4 clean weeks: `v=DMARC1; p=quarantine; rua=mailto:<current Cloudflare address>`.
    - Two weeks later: `v=DMARC1; p=reject; rua=mailto:<same>`.
13. **Error tracking and real-user vitals (decision):** recommendation for the pilot is backend telemetry only. Add the Application Insights JavaScript SDK later, together with a privacy-page update and a page-policy change. Sentry is the alternative: a new processor with a free tier.
14. **Cosmos diagnostics** (`DataPlaneRequests`, `QueryRuntimeStatistics`) to the workspace, when you want RU per request. Costs ingestion, within the daily cap.
15. **Cloudflare proxy or WAF for the apex (decision):** recommendation is to keep it DNS only for the pilot. Proxying needs three things in the same change:
    - a certificate Cloudflare can reach: the App Service managed certificate renews only while the apex points straight at Azure;
    - App Service access restricted to Cloudflare's ranges;
    - Agent 03's two-hop client-address change.
    The free plan gives a basic managed WAF ruleset and CDN caching (04's D2).
16. **`ASPNETCORE_FORWARDEDHEADERS_ENABLED`** (03 #2a, read-only): App Service → Environment variables. Note whether it is set; the code handles both cases.
17. **HSTS after the next deploy:** `curl -sI https://parish-life.org/` should show `max-age=31536000; includeSubDomains` and no `Server` header. Preload stays 03's decision.
18. **Production access** (all in `docs/operations/production-access.md`):
    - no production `az login` open where an AI tool runs;
    - a separate admin account with MFA;
    - remove standing data and Key Vault roles from people;
    - `disableLocalAuth` on Cosmos;
    - basic-auth publishing off;
    - review role assignments, including Colin's;
    - Cosmos and Key Vault audit logs;
    - MFA on Cloudflare, Google, GitHub and Resend.
19. **Local hooks:** `git config core.hooksPath .githooks` in each clone (needs gitleaks).
20. **Integrator:** apply `hardening/handoffs/patches/08-telemetry-release-tag.patch` (handoff 1).

## F. Handoffs

**Sent** (`hardening/handoffs/from-08-devops.md`):
1. integrator, Medium: release-tag patch.
2. 05, Medium: portal service-worker registration after CI's e2e is green.
3. 09, Medium: e2e certificate on the Linux runner.
4. 06, Medium: log facts for the privacy page (security events keep the IP address).
5. 06, Low: MX now exists.
6. 01, Low: project map corrections.

**Received and handled:**
- **02 #6 (CI audit and secret scan): HANDLED.** All three commands are in CI, as 02 gave them. The gitleaks scan covers the full history on every run. The `npm outdated` / `--outdated` report-only option was skipped (02 owns upgrades).
- **03 #1 (security event alerts): HANDLED in code, not deployed.** The log alert uses 03's event names and thresholds, plus any lockout (operator account ids are unknown, so every lockout alerts). The query keys on `customDimensions.SecurityEvent`.
- **03 #2 (client address): HANDLED as owner steps.** (a) is E16, read-only. (b) is in E15 and `docs/operations/frontend-hosting.md`; no code change while the apex is DNS only.
- **03 #3 (HTTP/2 and WAF): HANDLED.** Recorded as Already OK for HTTP/2 and smuggling (item 13); the WAF is E15.
- **05 #2 (service worker, CI side): HANDLED.** The e2e job exists; the app change waits for 09 (handoff 2).
- **06 #3 (what the logs keep): HANDLED from code and docs.** The Azure facts are E10; policy wording is handoff 4.
- **06 #10 (email and DNS facts): HANDLED.** Rechecked with `dig`; records documented; the earlier "no MX" is outdated (handoff 5).

## G. New packages, services and environment variables

- **Packages:** none.
- **New services (defined, none created):**
  - GitHub Actions workflow;
  - deploy identity `id-parishlife-github-deploy`;
  - action group `ag-parishlife-owner`;
  - 8 metric alerts, 2 log alerts and 2 availability tests;
  - budget `parishlife-monthly`;
  - optional staging resources (runbook).
- **GitHub names:**
  - secrets `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`;
  - environment variables `AZURE_RESOURCE_GROUP`, `AZURE_WEBAPP_NAME`, `PUBLIC_URL`;
  - repository variables `PRODUCTION_DEPLOY_ENABLED`, `STAGING_ENABLED`.
- **Environment variables in CI only:** `RestoreLockedMode=true`, `E2E_CHANNEL=chromium`. No new application settings.
- **Files:**
  - `.github/workflows/ci.yml`, `.github/pull_request_template.md`, `.githooks/commit-msg`, `tools/tests/commit-msg.Tests.sh`, `infra/monitoring.bicep`;
  - `docs/ARCHITECTURE.md`, `docs/operations/deployment-and-rollback.md`, `docs/operations/monitoring-and-alerts.md`, `docs/operations/production-access.md`;
  - `hardening/handoffs/from-08-devops.md`, `hardening/handoffs/patches/08-telemetry-release-tag.patch`.
- **Changed:**
  - `tools/ParishLife.Maintenance/Program.cs`, `tools/Publish-ParishLife.ps1`;
  - `README.md`, `HANDOVER.md`, `frontend/README.md`;
  - `docs/operations/data-snapshot-and-recovery.md`, `email-delivery.md`, `frontend-hosting.md`.

## Checks run (final)

- `dotnet restore ParishLife.slnx --locked-mode`: exit 0.
- `dotnet build ParishLife.slnx -c Release --no-restore -p:AspireUseCliBundle=false`: exit 0, 0 errors, 1 warning (ASPIRE010). Without the switch, the AppHost fails here with ASPIRE009 (Aspire CLI download timeout), as Agent 02 also saw.
- `dotnet test ParishLife.slnx -c Release --no-build`: exit 0; unit 80/80, integration 511/511 (591/591, the baseline), 2 min 21 s.
- `cd frontend && npm ci && npm run format:check && npm run check && npm run check:routes && npm run build`: all exit 0 (route check: 634 matched, 2 known gaps, 0 new). `npm audit --audit-level=high`: 0 vulnerabilities. No frontend source changed.
- `dotnet list ParishLife.slnx package --vulnerable --include-transitive`: none in 6 projects.
- `gitleaks git --redact --log-opts="--all"`: 326 commits, no leaks. The branch range is rechecked before the final commit (see the reply).
- `sh tools/tests/commit-msg.Tests.sh`: 14/14.
- `pwsh tools/Publish-ParishLife.ps1` on macOS: 229 files, 26.6 MB, no backslash entries or forbidden files.
- End-to-end tests were not rerun. No frontend or API code changed; the CI job is new and has not run.
