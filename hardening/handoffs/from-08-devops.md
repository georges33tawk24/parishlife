# Handoffs from Agent 08 (DevOps and SRE)

Each entry gives To, File, Requested change, Reason and Priority. No secret value appears here.

## 1. Tag telemetry with the release (patch ready)
- **To:** integrator (the file is 08's by the ownership table, but this run's agents may not edit `ParishLife.Api/**`)
- **File:** `ParishLife.Api/Extensions/TelemetryExtensions.cs`, new `ParishLife.UnitTests/TelemetryReleaseTests.cs`; patch `hardening/handoffs/patches/08-telemetry-release-tag.patch`
- **Requested change:** `git apply hardening/handoffs/patches/08-telemetry-release-tag.patch`.
  - It adds `service.version` = the assembly's informational version (`1.0.0+<commit>`) to the OpenTelemetry resource, so Application Insights shows the deploy in `application_Version`.
  - The role name is unchanged.
  - The new unit test reads the attribute from the tracer provider. It passed with the change and failed without it (checked on 22 November). It sends nothing anywhere: the OTLP endpoint is a closed local port.
- **Reason:** item 7 ("releases tagged"). Without it, an error in Application Insights cannot be tied to the deploy that brought it.
- **Priority:** Medium

## 2. Register the service worker from the portal once CI's browser tests are green (reply to 05 #2)
- **To:** 05 (or the integrator in a sweep), after 09's certificate fix
- **File:** `frontend/src/portal/main.jsx`
- **Requested change:**
  - CI side is done: `.github/workflows/ci.yml` has an "End-to-end browser tests" job (Linux, `E2E_CHANNEL=chromium`, `dotnet dev-certs https`, Playwright Chromium with system dependencies).
  - Once that job passes on GitHub with 09's fix, add the one-line registration (as in `src/public/main.jsx`) and keep the job green.
  - Then the owner adds the job to the required checks (`docs/operations/deployment-and-rollback.md`, setup step 4) and to the deploy jobs' `needs`.
- **Reason:** 05 #2 (offline page for people who never opened the public site).
- **Priority:** Medium

## 3. Browser tests on a Linux runner
- **To:** 09
- **File:** `frontend/playwright.config.mjs`, `frontend/scripts/e2e.mjs`, `ParishLife.EndToEnd/**` (yours); `.github/workflows/ci.yml` (mine)
- **Requested change:**
  - Make the certificate fix work on GitHub's `ubuntu-24.04` runner, where `dotnet dev-certs https` creates a certificate that nothing trusts, and where `--trust` cannot reach Chromium's own certificate store.
  - Tell me (or the integrator) if the job needs another step, for example installing a certificate into the runner's NSS database before Playwright starts. I will add it.
  - The workflow sets `RestoreLockedMode=true`, so `dotnet run --project ParishLife.EndToEnd` restores from the lock files only.
- **Reason:** the end-to-end job is the only CI job not yet required. Locally 17 of 18 pass, and the one failure is the certificate.
- **Priority:** Medium

## 4. Privacy page: what the technical logs keep (reply to 06 #3)
- **To:** 06 (or the integrator)
- **File:** `frontend/privacy.html` (both languages), `hardening/legal-drafts/privacy-policy.md`
- **Requested change:** the facts are recorded in `docs/operations/monitoring-and-alerts.md` ("Logs: what they keep"). For the policy:
  - **(a)** Application Insights tables keep data 90 days by default (Microsoft's pricing page). The owner must confirm the live setting.
  - **(b)** IP masking is Azure's default; the owner must confirm it is not switched off. The **security events** (failed sign-ins, rate limits, refused permissions, password resets, closures) deliberately keep the client IP address, the account id and the path for the same retention, to detect attacks. The policy should say so.
  - **(c)** Query strings: the OpenTelemetry instrumentation stores `Redacted` in place of query values by default, so the directory search text should not be kept. The owner confirms with one log query.
  - **(d)** Backups: unchanged, still to be confirmed by the owner.
  - **(e)** Operator snapshots are not scheduled and have no custodian or retention yet (U15). Recommendation in `docs/operations/data-snapshot-and-recovery.md`: an encrypted disk, monthly, kept 3 months.
- **Reason:** the policy states (a) and (d) as facts; (b) and (c) are missing.
- **Priority:** Medium

## 5. The privacy address can receive mail now (reply to 06 #10)
- **To:** 06
- **File:** `hardening/reports/06-legal.md` (Needs your action 2), `frontend/src/landing/**` (no change)
- **Requested change:** none in code.
  - Later on 22 November 2026, public DNS showed Cloudflare Email Routing's MX records, an apex SPF, a DMARC record at `p=none` with Cloudflare reporting, and Resend's DKIM and return-path records. The table is in `docs/operations/email-delivery.md`.
  - Your owner step 2 is now "confirm the `privacy@` routing rule and send a test message", not "enable Email Routing".
  - `hello@parishlife.app` on the product page is unchanged and still yours.
- **Reason:** keep the owner's list current.
- **Priority:** Low

## 6. Project map corrections
- **To:** 01 (or the integrator)
- **File:** `hardening/PROJECT_MAP.md`
- **Requested change:**
  - Section 11, "CI/CD: None": now `.github/workflows/ci.yml` (checks on every push and pull request; gated deploys from `main`, not yet switched on), `.githooks/commit-msg` and `.github/pull_request_template.md`.
  - Section 16, row 1: the README is rewritten.
  - Section 15, item 6: CI exists now.
  - Section 2, `tools/`: `tools/tests/commit-msg.Tests.sh` and `infra/monitoring.bicep` are new.
- **Reason:** the map is the shared inventory.
- **Priority:** Low
