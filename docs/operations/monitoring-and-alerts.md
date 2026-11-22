# Monitoring, alerts, logs and costs

Written 22 November 2026 (hardening run, Agent 08). The alert rules, uptime tests and budget are defined in `infra/monitoring.bicep`. **None of them exists in Azure yet**: the owner deploys the file (steps below). Nothing here was checked against the live Azure resources, because the hardening run may not touch Azure.

## What exists today

- **Application Insights** `insights-parishlife` receives requests, dependency calls, log traces and exceptions from the API through OpenTelemetry (`ParishLife.Api/Extensions/TelemetryExtensions.cs`), but only when `APPLICATIONINSIGHTS_CONNECTION_STRING` is set. Ingestion was confirmed on 11 November 2026 (`docs/continuation/AZURE-CONNECTION.md`).
- **App Service health check** on `/health/ready` (every minute, from inside Azure). It takes an unhealthy instance out of rotation. It alerts nobody on its own.
- **Operator readiness** `GET /api/administration/readiness` and `dotnet run --project tools/ParishLife.Maintenance -- check-infrastructure`.
- **No alert rules, uptime tests or budgets** are recorded anywhere (project map, open question 9).

## Deploying the monitoring (owner)

1. In your own terminal: `az login`, then preview:
   `az deployment group what-if -g rg-parishlife -f infra/monitoring.bicep -p alertEmail=<your address> monthlyBudget=<amount>`
   The file was written without a Bicep compiler at hand, so the preview is its first check. If Azure refuses to create the free classic ping tests, add `useFreePingTests=false` (paid standard tests, see costs).
2. Run the same command with `create` instead of `what-if`.
3. **Test each channel once:** Azure portal → Monitor → Alerts → **Action groups** → `ag-parishlife-owner` → **Test** → "Resource health alert" → confirm the email arrives. Record the date in this file.
4. Optional second channel: install the Azure mobile app and add a "Push" receiver to the action group, or add an SMS receiver (prices per country on the Azure Monitor pricing page).

## Alerts

| Alert (`infra/monitoring.bicep`) | Fires when | Severity | Kind |
|---|---|---|---|
| `parishlife-ready-down` | the availability test of `https://parish-life.org/health/ready` fails from 2 of 3 regions (France Central, West Europe, North Europe; every 5 minutes) | 1 | metric |
| `parishlife-signin-page-down` | the same for `https://parish-life.org/` (the sign-in page, which proves the frontend is served) | 1 | metric |
| `parishlife-health-check` | App Service's own health check average is below 100 % for 5 minutes | 1 | metric |
| `parishlife-server-errors` | more than 3 HTTP 5xx answers in 15 minutes | 2 | metric |
| `parishlife-slow-responses` | average response time above 1.5 s for 15 minutes | 3 | metric |
| `parishlife-plan-cpu`, `parishlife-plan-memory` | the B1 plan above 85 % CPU or memory for 15 minutes | 3 | metric |
| `parishlife-cosmos-throttled` | more than 10 Cosmos requests answered 429 in 15 minutes | 3 | metric |
| `parishlife-security-events` | from one client address in 15 minutes: more than 50 `security.sign_in_failed`, 20 `security.rate_limited`, or 30 of `security.mfa_failed`, `csrf_rejected`, `turnstile_failed` or `permission_denied`; **any** lockout (`sign_in_failed` with detail `locked_out`); more than 10 `security.password_reset_requested` in total | 2 | log search, every 15 minutes |
| `parishlife-background-work-failing` | a background worker logged "requires retry" 10 or more times in 15 minutes | 2 | log search, every 15 minutes |

**Not applicable:** failed payments (no online payments) and webhook signature failures (no inbound webhooks).

Where the security events come from: `ParishLife.Api/Authorization/SecurityEvents.cs` writes one warning per event (category `ParishLife.Security`) with the event name, account id, client address, path and a short detail code. It never writes a password, code, token, email or request body (Agent 03 tested this). The client address is the one trusted forwarded hop (see `Program.cs`).

Thresholds are starting points for a pilot of a few parishes. If an alert fires for normal use, raise its threshold in the Bicep file and deploy again. Do not turn it off.

### Looking into an alert (Application Insights → Logs)

```kusto
// Security events of the last day, by kind and address
traces | where timestamp > ago(1d) and isnotempty(customDimensions.SecurityEvent)
| summarize n = count() by event = tostring(customDimensions.SecurityEvent), address = tostring(customDimensions.ClientAddress), detail = tostring(customDimensions.Detail)
| order by n desc

// Slowest routes (p95, last hour), ignoring health probes
requests | where timestamp > ago(1h) and name !startswith "GET /health"
| summarize p95 = percentile(duration, 95), n = count() by name | where n >= 5 | order by p95 desc

// Server errors with their trace id (the "reference" users see on the error page)
requests | where timestamp > ago(1d) and toint(resultCode) >= 500 | project timestamp, name, resultCode, operation_Id

// Background workers retrying
traces | where timestamp > ago(1d) and message has "requires retry" | summarize n = count() by bin(timestamp, 15m), message
```

## Uptime

The two availability tests above check from three regions every 5 minutes and alert when two regions fail.
- **Main site:** the sign-in page `/`.
- **API:** `/health/ready`, which also checks Cosmos, Blob and Key Vault.
- **Login flow:** a synthetic sign-in is not set up. It would need a real account's password and authenticator in the monitor, and Turnstile is built to refuse robots. The readiness test covers the services sign-in needs. A human sign-in after each deploy covers the rest.
- **Checkout:** not applicable (nothing is sold online).

Classic URL ping tests are free and stay available until 30 September 2028, according to Microsoft's availability-test page (read on 22 November 2026). Before then, switch to standard tests with `useFreePingTests=false`.

## Logs: what they keep and for how long (answers Agent 06's handoff 3)

**From the code** (verified in the repository):
- **Requests:** method, route and path, status, duration, and the response size. The OpenTelemetry ASP.NET Core instrumentation (1.19.0, in `ParishLife.Api/packages.lock.json`) replaces query-string values with `Redacted` by default, so `GET /api/public/parishes?q=…` should not store the search text. Never set `OTEL_DOTNET_EXPERIMENTAL_ASPNETCORE_DISABLE_URL_QUERY_REDACTION`.
- **Dependency calls:** Cosmos, Blob, Key Vault, Turnstile, Resend, Google and Microsoft. The same redaction applies to outgoing query strings.
- **Log traces:** Information and above for the app; Warning and above for `Microsoft.AspNetCore` and `Azure` (`appsettings.json`). What the app writes:
  - unhandled failures as exception type and trace id only (`ApiExceptionHandler`);
  - worker retries as exception type only;
  - Resend and Turnstile failures as HTTP status only;
  - security events as event name, account id, **client IP address**, path and a short code.
- **Secrets and personal data:**
  - No password, code, token, key ring, connection string, email address or request body is logged (Agent 03's tests).
  - Every log line carries the request's trace id, which joins it to its request (`operation_Id`).
- **Client IP addresses:**
  - Application Insights masks the caller's IP address on requests unless IP masking is turned off on the resource.
  - The security events deliberately keep the client address in `customDimensions.ClientAddress`, because alerting per address needs it. Masking does not touch that field.
  - The privacy page should say this (handoff to Agent 06).

**Needs the owner (Azure settings, not in the repository):**
- **(a) Retention.** Microsoft's pricing and retention pages (read 22 November 2026) say Application Insights tables keep data **90 days** at no extra cost, and other Log Analytics tables 30 or 31 days. Check: Application Insights → **Usage and estimated costs → Data retention**, or the workspace → **Tables**. Confirm 90 days, which is what the privacy page says.
- **(b) IP masking.** Check that IP masking is on: Application Insights → **Properties**, or `az resource show -g rg-parishlife -n insights-parishlife --resource-type Microsoft.Insights/components --query properties.DisableIpMasking` must not be `true`.
- **(c) Query strings.** Logs → `requests | where url has "?" | take 20 | project url`. Values must show `Redacted`.
- **(d) Backups.** See [data-snapshot-and-recovery.md](data-snapshot-and-recovery.md).
- **(e) Operator snapshots.** Same file, "Where snapshots are kept".

## Error tracking

- **Backend:**
  - Unhandled failures reach Application Insights as a request with status 500, a warning with the exception type, and the trace id the user sees.
  - The stack trace is not logged, by design (it can hold personal data in messages).
  - Each request is tied to the deploy only after the release-tag patch: `hardening/handoffs/patches/08-telemetry-release-tag.patch` sets `service.version` (shown as `application_Version`) to `1.0.0+<commit>`. It is waiting for the integrator, because the hardening run's agents may not edit application code.
- **Frontend:**
  - Nothing captures browser errors.
  - Vite builds without source maps, so none is served publicly (checked live on 21 November by Agent 02).
  - Adding browser error tracking is an owner decision (Needs your action in the hardening report 08). Options:
    - the Application Insights JavaScript SDK: Microsoft, the same processor, but it sets cookies and needs a policy change;
    - Sentry: a new processor, with a free tier.
  - Either one needs a privacy page update, a page-policy change, and source maps uploaded privately (never deployed).

## Performance monitoring

- **API latency:** `requests` duration in Application Insights (query above) and the `HttpResponseTime` metric with its alert.
- **Baseline:** Agent 04 measured locally, not in production. At the pilot load (40 visitors and 10 staff), p95 was 43 ms for visitors and 195 ms for staff. At ten times that, p95 was 124 ms and 1.63 s. Mobile Lighthouse LCP was 6.4 s on `/` with the compression and route-splitting patches; those patches are now merged (hardening report 04, section C).
- **Slow database queries:**
  - There is no SQL.
  - For Cosmos, turn on the account's diagnostic setting `DataPlaneRequests` and `QueryRuntimeStatistics` to the Application Insights workspace (Agent 04, D4). It costs log ingestion, so watch the daily cap below.
  - The Cosmos 429 alert above catches throttling.
- **Resource usage:** the plan CPU and memory alerts. The App Service **Diagnose and solve problems** blade shows the same graphs for free.
- **Real-user Core Web Vitals:** not collected. Every option adds a browser script, which needs the owner's decision and a privacy and page-policy update:
  - the Application Insights JavaScript SDK;
  - Cloudflare Web Analytics, which is free and cookieless, but needs a beacon script or the apex proxied through Cloudflare.

## Spend caps and billing alerts

Azure pay-as-you-go subscriptions have **no hard spending cap**. Budgets only send email. The table gives the cheapest safe setting for a pilot. Prices change, so check them on each provider's pricing page; Azure's page did not show figures to the automated reader on 22 November 2026.

| Service | What can grow | Recommended cap or alert |
|---|---|---|
| Azure resource group `rg-parishlife` (App Service B1, Cosmos serverless, Storage, Key Vault, Application Insights) | Cosmos requests and storage, log ingestion, Blob egress if a page goes viral | Budget `parishlife-monthly` in the Bicep file. Set `monthlyBudget` to about 1.5 times last month's actual cost (Cost Management → Cost analysis). Emails at 50, 80 and 100 % actual and 100 % forecast. |
| Log Analytics / Application Insights ingestion | logs and traces | **Daily cap** (a real cap): the workspace → **Usage and estimated costs → Daily cap** → 0.15 GB/day. That keeps a month under the 5 GB/month free allowance per billing account. When the cap is hit, logging stops until the next day, so treat that email as an incident. |
| Cosmos DB serverless | request units and stored GB | No cap exists for serverless. The budget and the 429 alert cover it. Keep the API's rate limits (200/min per address). |
| Alerts and uptime | rule count | 7 metric time series: inside the 10 free a month. 2 log search rules at the cheapest 15-minute frequency, each priced per rule per month. Classic ping tests are free. 1,000 alert emails a month are free. |
| Cloudflare (DNS, Turnstile, Email Routing, `www` redirect) | nothing on the Free plan | Stay on Free. Check the dashboard's Billing page shows no paid add-on. |
| Resend (account code email) | emails sent | Stay on the Free plan, which cannot bill and has a monthly and daily sending limit (see resend.com/pricing). The API sends one code per request and is rate-limited. |
| GitHub Actions | runner minutes | Free for public repositories on standard runners. If the repository is ever made private, set **Settings → Billing → Budgets** for Actions to $0 with "Stop usage". |
| Google Cloud (OAuth client) | nothing (no billing account needed for OAuth) | Do not attach a billing account to the "ParishLife" project. If one is attached, add a budget of 1 USD with alerts. |
| Microsoft Entra (app registration, managed identities) | free | — |
| Domain `parish-life.org` (Cloudflare Registrar) | yearly renewal | Keep auto-renew on and a valid card. Set a calendar reminder a month before expiry. |
| AI/model APIs, SMS, CDN, paid monitoring | not used | Not applicable |
