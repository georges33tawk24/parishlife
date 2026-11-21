# Handoffs from Agent 03 (Application security and authentication)

Each entry gives To, File, Requested change, Reason and Priority. No secret value appears here.

## 1. Alert on the new security events
- **To:** 08
- **File:** Application Insights / Log Analytics alert rules (none in the repository); source `ParishLife.Api/Authorization/SecurityEvents.cs`
- **Requested change:** alert on spikes of these structured warnings (logger category `ParishLife.Security`, message template `Security event {SecurityEvent} account {AccountId} client {ClientAddress} path {Path} detail {Detail}`):
  - `security.sign_in_failed` (detail `unknown_or_inactive`, `password` or `locked_out`), `security.mfa_failed`
  - `security.rate_limited`, `security.turnstile_failed`, `security.csrf_rejected`
  - `security.permission_denied` (detail is the error code, for example `mfa_required`, `credentials_invalid`)
  - `security.password_reset_requested`, `security.password_reset_completed`, `security.account_closed`
  Suggested starting thresholds: more than 50 `sign_in_failed` or 20 `rate_limited` from one `ClientAddress` in 10 minutes; any `locked_out` for an operator account id; more than 10 `password_reset_requested` in 10 minutes.
- **Reason:** Part B 7. The events never contain a password, code, token, email or body (tested).
- **Priority:** Medium

## 2. Client address behind App Service, and what changes if Cloudflare proxies the apex
- **To:** 08
- **File:** `ParishLife.Api/Program.cs` (forwarded headers block); App Service setting `ASPNETCORE_FORWARDEDHEADERS_ENABLED` (read-only check)
- **Requested change:**
  - (a) Confirm in Azure whether `ASPNETCORE_FORWARDEDHEADERS_ENABLED` is set. The live site sends HSTS on HTTPS, which the HSTS middleware only does when it sees the request as HTTPS, so forwarded headers are almost certainly already processed by the platform. The code now handles both cases and never runs the middleware twice.
  - (b) If the apex is ever proxied through Cloudflare (orange cloud, for WAF and HTTP/2 protection), the right-most `X-Forwarded-For` entry becomes a Cloudflare edge address and every visitor would share one rate-limit bucket. Then: restrict App Service inbound traffic to Cloudflare's published ranges, and change the trust to two hops (`ForwardLimit = 2` with Cloudflare's ranges as known networks) or read `CF-Connecting-IP`. Ask Agent 03's successor or me to make the code change in the same deploy.
- **Reason:** attack vector 11; rate limits, Turnstile and security events all use the client address.
- **Priority:** High (only when the Cloudflare proxy decision is made)

## 3. HTTP/2 Rapid Reset and a WAF in front of the app
- **To:** 08
- **File:** infrastructure (Cloudflare, App Service)
- **Requested change:** the app itself is on patched .NET 10 and the apex is served over HTTP/1.1 by App Service's front end, so CVE-2023-44487 is not reachable through Kestrel. If HTTP/2 is turned on in App Service, or the apex goes through Cloudflare, keep the platform's defaults (both are patched) and see handoff 2 for the address change.
- **Reason:** attack vector 1.
- **Priority:** Low

## 4. Portal UI added by Agent 03 (please restyle and review)
- **To:** 05
- **Files:** `frontend/src/portal/shell/Auth.jsx`, `frontend/src/portal/features/account/account-closure.jsx` (new), `frontend/src/portal/features/account/account.jsx`, `frontend/src/portal/ui/components.jsx`
- **Requested change:**
  - The sign-up "I am 13 or older" checkbox uses a class `af-check` that has no style yet; give it the form's checkbox style.
  - The forgotten-password form (email, send code, code, new password, optional authenticator code) and the "Your data" section (download, close account drawer with the word CLOSE) use existing classes only; review layout, focus order and error states.
  - The forgot panel still says the parish office "can reset it for you and give you a new password". No office reset route exists (`member-data.js` `accountReset` always throws). Now that self-service reset exists (when email delivery is configured), change or remove that sentence with Agent 06.
  - `components.jsx` `RichText`: I changed `innerHTML = body` to `innerHTML = safeRichText(body)` (security fix, one line).
  - Part C 1: keep every submit button disabled while its request is pending (the reset and closure forms already do).
  - `features/parish-life/groups.jsx` line ~758 and `features/member/pages.jsx` line ~587 render `safeRichText(...)` output as a text child, so readers see literal tags. It is not a security problem; render the plain text instead or use the published-body pattern from `public/pages/ParishPage.jsx`.
  - `shell/actions.jsx` line ~750 makes a display "API key" with `Math.random()`. No such key exists in the API; remove the fake key screen or use `crypto.getRandomValues` if a real key is ever added.
- **Reason:** Part B 6, B 15, B 20, Part C 1, attack vector 13.
- **Priority:** Medium

## 5. Wording for closure, data copy, password reset and the age check
- **To:** 06
- **Files:** `frontend/privacy.html`, `frontend/terms.html`, `ParishLife.Api/Services/Accounts/AccountClosureService.cs` (`Removed`, `Kept`), `ParishLife.Api/Services/Accounts/ResendContactCodeDelivery.cs` (reset email), `frontend/src/portal/features/account/account-closure.jsx`
- **Requested change:** the facts for your wording (reply to your handoff 1):
  - **Self-service now:** My account, "Your data": "Download my data" (JSON file: account, sign-in methods without secrets, personal profile, personal notes and tasks, and for each parish where the account is linked to its own person: that person record, profile corrections, optional facts, consents and counts of kept records) and "Close my account".
  - **Closing deletes or anonymizes:** sign-in email and username (the address can be used again), password, authenticator key, recovery codes, passkeys, Google/Microsoft links, every session (ends at once), personal profile and appearance, drawn signature, personal notes and tasks with their history.
  - **Closing keeps:** a closed-account marker (account number, "Closed account", closing time; no name, email or credential) so audit and parish history stay readable; security receipts and audit rows (they never held credentials); passkey credential-id indexes (no personal data); and everything parishes hold: person record, sacraments and certificates, gifts and receipts, registrations, ministry, attendance and safeguarding history, under each parish's retention. No retention periods are approved yet (owner question 15), so say "under the parish's retention" without a period. The person can still ask a parish office to close optional parish data (existing data-closure request, `me/data-closure-requests`) before closing the account.
  - **Not deleted elsewhere:** no third parties hold account data except Resend (delivery logs of code emails) and Application Insights (technical logs); there is no payment customer, mailing list or analytics profile to delete.
  - **Password reset:** an 8-digit code by email, valid 15 minutes, 5 attempts, one request a minute; the email says it expires and can be ignored; accounts with an authenticator also give their authenticator code; every session ends afterwards.
  - **Age:** sign-up (form and Google/Microsoft) needs the "I am 13 or older" box; no birth date is collected.
  - The privacy and terms pages can now say closure and the copy are self-service in My account, as well as by request.
- **Reason:** Part B 20; your handoff 1.
- **Priority:** High

## 6. Existing tests I changed, and end-to-end coverage to add
- **To:** 09
- **Files:** `ParishLife.IntegrationTests/AccountContactTests.cs`, `ResendEmailTests.cs`, `ExternalSignUpTests.cs` (send the new age confirmation); `Support/TestAuthenticator.cs` (optional `step`), `Support/AuthHttp.cs` (`PostMfaAsync` picks an unspent code), `AccountPasswordTests.cs`, `ExternalSignInPortalTests.cs` (second sign-in of one account uses a neighbouring step's code, because each code now signs in once); `frontend/e2e/portal.spec.mjs` (Google sign-up ticks the age box).
- **Requested change:** review these edits; add end-to-end tests for: password reset with a captured code, "Download my data", "Close my account", and the sign-up age box refusing a press without it.
- **Reason:** the edits follow new server rules (age, one-use codes); nothing was weakened.
- **Priority:** Medium

## 7. New document type in the accounts container
- **To:** 04
- **File:** `ParishLife.Api/Identity/CosmosIdentityStore.cs` (`ClaimAuthenticatorCodeAsync`), `ParishLife.Api/Models/AuthenticatorCodeUse.cs`
- **Requested change:** none required: one small `authenticatorCodeUse` document per account partition in `Accounts`, read and written by point operations only (no index needed). Note it for your container inventory.
- **Reason:** attack vector 6.
- **Priority:** Low

## 8. Agent 02 handoff 3 (frontend silent catches) is yours
- **To:** 05
- **File:** see `hardening/handoffs/from-02-secrets.md` item 3
- **Requested change:** I handled the only one in my files (`frontend/src/lib/rich-text.js`, now commented). The rest are in `portal/shell`, `portal/features` and `public/main.jsx`.
- **Reason:** ownership.
- **Priority:** Low
