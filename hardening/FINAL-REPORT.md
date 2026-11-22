# ParishLife hardening: final audit report

Agent 10 (independent auditor), branch `hardening/10-audit`, at `fullstack-hardening` tip `70959fd`, 23 November 2026.

- **What I did:** read every report, handoff and the project map; re-ran every suite, scan and audit myself on this commit; re-tested the 20 attack techniques (the test suite plus my own requests to a local test host); reviewed the code where two agents' work meets.
- **What I did not do:** change any code, test or config. This file is the only thing I wrote. Nothing was deployed. Azure was never touched (`az` was never run).
- **Production:** I sent 3 read-only requests to `https://parish-life.org` (HEAD `/`, HEAD `/robots.txt`, HEAD `/openapi/v1.json`) and public DNS lookups. Production still runs pre-hardening code (`Server: Kestrel`, HSTS 30 days, Google Fonts in its CSP, `robots.txt` 404). So live headers say nothing about this branch; they are evidence only that **none of this work is live yet**.
- **"Verified"** means I saw the evidence myself (code read, test run, command output or request) on `70959fd`. **"Claimed, not verified"** means it rests on another agent's report or on an Azure or third-party fact nobody here can check.
- Scratch output is in the session scratchpad (`10/`), never in the repository.

---

## A. Executive summary

**Overall risk before the run: High.** Real gaps in the code:
- stored rich text was sanitized only in the browser;
- an authenticator code could be replayed;
- OpenAPI was open to any signed-in account;
- there was no password reset, no account closure and no data copy, though the privacy page promised them;
- nothing logged security events;
- there was no CI, no alerting, no uptime check and no tested restore;
- the public homepage made 151 API requests for 20 parishes (enough to hit the 200-a-minute rate limit);
- the portal script (1.67 MB) was served uncompressed;
- the privacy contact address had no mail server.

**Overall risk after the run: Medium.**
- **Application code: Low to Medium.** Every code-level finding from the agents is fixed or waits on an owner decision. My own review found no High or Critical issue. It found 8 Low ones (section C).
- **Operations and legal: still High** until the owner steps in section D are done. None of the work is deployed. Backups, alerts, uptime checks, staging and the deploy pipeline exist only as code and runbooks.

**Top 5 remaining risks:**
1. **None of this is live, and the first deploy has new failure modes.** Production runs the pre-hardening build. The new build refuses to start if the Turnstile, Email or external sign-in settings are half set (intended). The CI deploy path has never run. (D1, D8)
2. **Recovery and detection are unproven in Azure.** No restore has ever been tested against Cosmos or Blob. No alert rule, uptime test or budget exists in Azure. `infra/monitoring.bicep` was never compiled or deployed. (D3, D4)
3. **Production access is broad.** People hold standing data and Key Vault roles, Cosmos key auth is on, and AI coding sessions have deployed with the owner's `az login` (Agent 08, from docs; I could not check Azure). (D2)
4. **Published parish photos keep their EXIF location data** (QA bug 2, proven by a failing test). Combined with the missing daily cap on code emails (QA bug 3), these are the two open privacy and abuse bugs in the code. (D6, D7)
5. **Legal basics are missing:**
   - no operator identity on any page;
   - a possible Law 81/2018 declaration and health-data licence;
   - legal Arabic text written by an AI and not yet reviewed;
   - product-page prices with no subscription terms, and a contact address on an unverified domain.
   (D9 to D13)

**Counts per status (all 195 master-checklist rows in section B):**

| Status | Count |
|---|---|
| Fixed | 64 |
| Already OK | 59 |
| Needs your action | 41 |
| Not applicable | 28 |
| Could not verify | 2 |
| Failed | 1 |
| **Total** | **195** |

Verified by me: 174 rows. Claimed, not verified: 21 rows (almost all Azure, Cloudflare, Google or legal facts).

---

## B. Findings and fixes, one row per master-checklist item

Columns: Item | Status | Verified by auditor? | Severity | What was found | What was changed (files) | Evidence | Owning agent.

Abbreviations:
- **Test files:** ATT `AttackTechniqueTests`, SHT `SecurityHardeningHttpTests`, SST `SecuritySweepTests`, EAS `EndpointAccessSweepTests`, QRT `QaRegressionTests`, CRT `CoreRulesTests` (unit), SUT `SecurityHardeningTests` (unit).
- **"Suite"** means my run of `dotnet test ParishLife.slnx` on `70959fd`: unit 99/99, integration 532 passed, 2 skipped, 0 failed.
- **"e2e"** means my run of `E2E_CHANNEL=chromium npm run e2e`: 42 passed in 5.9 min, one of them the expected failure (`test.fail`) for QA bug 4.
- **"Host"** means my requests with `curl` to a local `ParishLife.EndToEnd` host on port 7411 (Development environment, local storage).

### B1. Security: the 20 attack techniques

| Item | Status | Verified by auditor? | Severity | What was found | What was changed (files) | Evidence | Owning agent |
|---|---|---|---|---|---|---|---|
| HTTP/2 Rapid Reset | Already OK | Claimed, not verified | Low | The apex is HTTP/1.1 through App Service's front end. Kestrel is patched .NET 10.0.x (CVE-2023-44487). There is no WAF or CDN on the apex. | None | Live HEAD today answered `HTTP/1.1`. The platform patch level is an Azure fact (D1). | 03, 08 |
| 52-character username (bcrypt truncation) | Already OK | Verified | Low | No bcrypt. Identity uses PBKDF2-HMAC-SHA512 over the whole password. Passwords are 16–200 characters; identifiers are ≤ 254. | None | Suite: ATT `Passwords_that_share_their_first_72_characters_are_different_passwords` passed. `AccountsController.Login` length guard read. | 03, 09 |
| SAML bypass | Not applicable | Verified | — | There is no SAML library or endpoint. | None | ATT `Graphql_saml_and_websocket_endpoints_do_not_exist` passed. | 03 |
| nOAuth email spoof | Already OK | Verified | High (if it were open) | Sign-in matches only provider + `sub` (hashed). Provider sign-up never merges into an existing account. | None | Suite: `ExternalSignUpTests`, `ExternalIdentityClaimsTests` passed. | 03 |
| GraphQL aliases | Not applicable | Verified | — | There is no GraphQL. | None | ATT absent-surfaces test passed. | 03 |
| 2FA code replay | Fixed | Verified | Medium | A TOTP code could sign in twice inside its window. | `CosmosIdentityStore.ClaimAuthenticatorCodeAsync`, `Models/AuthenticatorCodeUse.cs`, `AccountsController`. The reset also spends the code (03 sweep A2). | Suite: SHT `An_authenticator_code_signs_in_once…`, SST `An_authenticator_code_spent_on_a_reset_cannot_sign_in…` passed. Code read (`CompleteMfa`). | 03 |
| ReDoS regex | Already OK | Verified | Low | Regexes are anchored or bounded. The sanitizer uses `NonBacktracking`. | `Services/Publishing/RichText.cs` | Suite: CRT `Rich_text_sanitizer_stays_linear_on_hostile_input` passed. | 03, 09 |
| JWT algorithm confusion | Fixed | Verified | Medium | No JWT sessions. The Microsoft `id_token` comes over TLS from a fixed endpoint. `nbf` and `azp` checks were missing. | `Identity/ExternalIdentityClaims.cs` | Suite: SUT `Microsoft_id_token_refuses_not_yet_valid_tokens_and_foreign_authorized_parties` passed. | 03 |
| Request smuggling | Already OK | Verified | Low | Kestrel refuses CL+TE and malformed framing. | None | Suite: ATT `Ambiguous_request_framing_is_refused_and_the_hidden_request_never_runs` passed. | 03, 09 |
| Cache poisoning | Already OK | Verified | Low | The public server cache is keyed on path + query only. No header is read. Host filtering is on. | None (04 added the cache, 03 reviewed it) | Suite: ATT `Forwarded_or_foreign_host_headers_cannot_poison_public_answers` passed. Host: `Host: evil.example` gets 400, and `X-Forwarded-Host` changed no canonical link. `PublicCacheAttribute` read (section C, seam 1). | 03, 04 |
| Spoofed IP header | Fixed | Verified | High | Rate limits used `RemoteIpAddress` with an implicit forwarded-header policy. | `Program.cs`: one trusted hop, right-most entry, never runs twice. | Suite: SHT `Spoofed_forwarded_addresses_share_the_real_clients_sign_in_limit` passed. Code read. Whether App Service sets `ASPNETCORE_FORWARDEDHEADERS_ENABLED` is unverified (D1). | 03 |
| Views bypassing RLS | Not applicable | Verified | — | Cosmos DB has no views or RLS. Tenant isolation is the partition plus service checks. | None | Suite: EAS (599 cross-tenant calls, only reviewed self-scoped reads succeed) passed. | 03, 09 |
| Math.random tokens | Already OK | Verified | Low | Server tokens and codes use `RandomNumberGenerator`. The fake display "API key" was removed (05). | `shell/actions.jsx` (05) | Suite: CRT `No_security_code_draws_on_System_Random` passed. My grep of `RandomNumberGenerator`: 11 call sites, all secret-bearing. | 03, 05 |
| Timing attacks | Fixed | Verified | Medium | QA bug 1: an unknown address answered about 50× faster than a wrong password. **Residual (new finding N3, Low):** unverified and locked accounts still answer before any hashing. | `AccountsController.Login` dummy hash (`70959fd`) | Suite: ATT `Sign_in_takes_as_long_for_an_unknown_address_as_for_a_wrong_password` now passes as a normal test. `FixedTimeEquals` used for codes. | 03 (integrator fix) |
| Padding oracle | Already OK | Verified | Low | Data Protection is encrypt-then-MAC. Failures get a generic answer. | None | Suite: ATT `Tampered_session_cookies_get_the_same_answer_as_no_cookie` passed. | 03 |
| Prototype pollution | Not applicable | Verified | Low | The server deserializes into typed C# DTOs. The frontend has no deep merge of untrusted keys. | None | Suite: ATT `Prototype_and_privilege_keys_in_json_are_ignored` passed. | 03, 09 |
| Template injection | Already OK | Verified | Medium | Certificates use a fixed placeholder list with HTML encoding. No `eval`. | None | Suite: `CertificateTests.Certificate_sheets_use_only_bishop_approved_wording…` passed. Note: a related substitution bug exists in the parish page head (N1, Low, not template injection). | 03 |
| XXE file read | Not applicable | Verified | — | No user XML is parsed. Uploads are checked by magic bytes. | None | Suite: ATT `Xml_svg_html_and_heic_uploads_are_refused_by_their_bytes` passed. | 03 |
| WebSocket hijacking | Not applicable | Verified | — | There are no WebSockets, SignalR or SSE. | None | ATT absent-surfaces test passed. | 03 |
| Unicode canonicalization (Spotify bug) | Already OK | Verified | Medium | One idempotent normalizer. Look-alike characters stay distinct accounts. | None | Suite: SHT `Email_lookup_ignores_case_but_compatibility_lookalikes_do_not_reach_the_account` passed. | 03 |

### B2. Security: hardening

| Item | Status | Verified by auditor? | Severity | What was found | What was changed (files) | Evidence | Owning agent |
|---|---|---|---|---|---|---|---|
| Authentication | Needs your action | Verified | Medium | Passwords are 16–200 characters. Lockout is 5 failures for 15 minutes. Sessions are 8 h absolute, server-backed and revoked on change. MFA is required for operators, staff and clergy. Breached-password screening is missing (an owner decision). | Reset, closure and age check added (03) | Code read: `Program.cs`, `AccountsController`. Suite: `AccountPasswordTests`, SHT. | 03 → owner D19 |
| Hide API keys | Already OK | Verified | — | The frontend reads no environment variables. Only the public Turnstile site key reaches the browser. No source maps. | None | My grep of `frontend/dist` for `import.meta.env` and secret formats: none. gitleaks `dir`: no leaks. | 02 |
| Secure database | Already OK | Claimed, not verified | Low | Managed identity, partition isolation, encryption at rest. Network, RBAC and key auth are Azure facts. Cosmos key auth is still on (08). | None | Code read: `ServiceCollectionExtensions` uses `TokenCredential`. Azure side: D2. | 03, 08 |
| Enforce HTTPS | Fixed | Verified (code); live still old | Medium | HSTS was 30 days without subdomains. It is now 1 year with `includeSubDomains` (outside Development). | `Program.cs` | Code read; SHT headers test passed. Live HEAD still `max-age=2592000` (pre-hardening deploy). | 03 |
| Hash passwords | Already OK | Verified | Low | Identity v3 PBKDF2. Passwords stay out of logs, receipts and audit (tests scan storage). | None | Suite: `AccountPasswordTests` secret scan passed. | 03 |
| Server-side form validation | Already OK | Verified | Medium | DTO attributes plus `Guard` on every write. Typed DTOs ignore unknown fields. | New DTOs carry limits | Suite: overposting tests passed. EAS: writes sent with `{}` stop at 400, 403 or 404. | 03 |
| XSS protection | Fixed | Verified | High | Rich text was sanitized only in the browser, and the editor sink not at all. | `RichText.Sanitize` on save (announcements, website sections); `components.jsx` uses `safeRichText`. | Suite: SHT `Announcement_markup_is_sanitized_when_saved`, QRT `Website_section_markup_is_sanitized_when_saved` passed. CSP: `script-src 'self'` plus hashes (Host). | 03 |
| Log and monitor suspicious activity | Needs your action | Verified (code) | Medium | Security events are logged without secrets. Alert rules exist only in `infra/monitoring.bicep`, which was never deployed or compiled. | `Authorization/SecurityEvents.cs` (03); `infra/monitoring.bicep` (08) | Suite: SHT test checks the logs hold no password or email. Bicep: no CLI here (D4). | 03, 08 |
| Lock down admin routes | Already OK | Verified | Medium | `/api/administration/*` needs an operator with TOTP and an `amr=mfa` session, checked in the service. IP allowlisting was declined (decision). | None | Host: `/api/administration/accounts` gives 401 anonymously. Suite: `Http_routes_enforce_operator_mfa_csrf…`, sweeps. | 03 → D20 |
| Parameterized queries | Already OK | Verified | Medium | No SQL. Cosmos queries are built with parameters and an allow-listed path regex. | None | Code read: `StorageQuery`. Suite: ATT NoSQL-looking search text. | 03 |
| Environment variables checked | Fixed | Verified | Medium | Half-set Turnstile, Email and OAuth settings, or unresolved Key Vault references, used to fail silently. | `.env.example`, `ConfigurationProblem()` checks, wired in `RegisterAuthenticationCapabilities` | Suite: `ConfigurationProblemTests`, SHT `Half_configured_secret_settings_stop_startup…` passed. | 02, 03 |
| Rate limiting | Already OK | Verified | Medium | 200 requests a minute per address globally, and 20 a minute on the authentication policy, keyed on the trusted address. Generated pages are rate-limited too. | New routes are under `authentication` | Code read: `Program.cs`, `FrontendHostingExtensions`. Suite: QRT limit tests (the 21st request gets 429). | 03 |
| CORS restricted | Already OK | Verified | Low | No CORS middleware. | None | Host: an `OPTIONS` preflight from `https://evil.example` got 405 with no `Access-Control-*` header. | 03 |
| Security headers | Fixed | Verified | Medium | `X-Frame-Options`, COOP and `Permissions-Policy` were missing, and the `Server` header was sent. | `Program.cs` | Host: `/` has XFO DENY, COOP, Permissions-Policy, CSP, `Referrer-Policy`, and no `Server` header. | 03 |
| Secure session cookies | Already OK | Verified | Low | `__Host-` cookies, HttpOnly, Secure, SameSite=Strict, 8 h, not sliding, validated against the server session on every request. | None | Code read: `Program.cs`. Host: the CSRF cookie set-cookie flags. | 03 |
| CSRF protection | Already OK | Verified | Medium | A global filter covers every unsafe method, anonymous ones included. | `security.csrf_rejected` event | Host: a POST to `/api/auth/login` without the token gets 400. Suite: QRT and ATT CSRF sweep over every unsafe endpoint passed. | 03 |
| Password reset links expire | Fixed | Verified | High | No reset existed. Now an emailed 8-digit code: 15 minutes, 5 attempts, one request a minute, POST only, ends every session. Production needs Resend (D5). | `ContactVerificationService`, controller, DTOs, `Auth.jsx` | Suite: SHT reset tests, QRT `Reset_and_verification_codes_expire_after_15_minutes` passed. e2e `account.spec.mjs` passed. | 03 |
| File upload type and size restrictions | Already OK | Verified | Medium | Magic-byte allow-list; size checked before the body is read; private Blob. EXIF is not stripped (QA bug 2). | None | Suite: ATT bytes test; QRT 50 MB refused after 1 KB. | 03 |
| Prices and payments verified server-side | Not applicable | Verified | — | No online payments or payment provider. Offline receipts are numbered concurrency-safely. The product page shows prices with no checkout (a legal item, D11). | None | Suite: `Concurrent_receipts_take_distinct_consecutive_numbers` passed. My grep: no payment SDK. | 03 |
| Production debug mode disabled | Already OK | Verified | Low | `UseExceptionHandler` answers with a trace id only. No developer exception page. No source maps. No `console.log` in the bundle. | None | Code read: `Program.cs`. `grep console.log frontend/src`: 0. | 02 |
| Vulnerable dependencies updated | Already OK | Verified | Low | 15 patch and minor upgrades (02). There are no known-vulnerable packages. | lock files (02) | Mine: `npm audit` 0 vulnerabilities; `dotnet list package --vulnerable --include-transitive`: none in 6 projects. | 02 |
| Unused packages and logic removed | Needs your action | Verified | Low | 4 unreferenced types were deleted (03). Fictional demo records in `portal/model/data.js` (2,606 lines) still ship in the portal, styleguide and product-page bundles (N7). | 03 deletions | Mine: `grep` of `dist/assets/app` finds the demo parish, priest and phone in 3 bundles. | 02, 04/05 → D13 |
| Exposed files checked | Already OK | Verified (local), Claimed (prod) | Low | `dist` holds only pages, `sw.js`, the manifest, robots and assets. The publish script refuses tests and keys. On production, 02 got 404 for `.env`, `.git` and `appsettings.json`. | None | My `ls dist`; e2e smoke "search files, unknown addresses and what must stay private" passed. | 02, 09 |
| Git history scanned for leaked secrets | Already OK | Verified | — | No leaks on any ref. | None | Mine: gitleaks 8.30.1 `git --log-opts=--all`: 345 commits, no leaks; merges first-parent: 43 commits, no leaks; `dir` of the worktree: no leaks. | 02 |
| Compromised keys revoked and replaced | Not applicable | Verified | — | Nothing leaked, so nothing to rotate. A rotation runbook exists (02 D6). | None | The scans above. | 02 |
| Secrets kept out of the repo | Fixed | Verified | Medium | `.gitignore` gaps closed; a gitleaks pre-commit hook added (not enabled in clones: D8). | `.gitignore`, `.githooks/pre-commit` | gitleaks results above. `git config core.hooksPath` is unset here (expected). | 02 |
| Auth checked on every endpoint | Fixed | Verified | High | Every protected endpoint answers 401 anonymously. The anonymous set equals the reviewed list. A signed-in stranger with MFA gets nothing from another parish. | `EndpointAuthorizationSweepTests` (03), EAS (09) | Suite: both sweeps and EAS passed. Host: 5 protected paths give 401. | 03, 09 |
| Dependency audit run | Already OK | Verified | — | Run by 02 and 08, and by CI on every push. | `.github/workflows/ci.yml` | My audits above. | 02, 08 |
| Thorough security review | Fixed | Verified | Medium | 03 broad review; 09 attack and sweep tests; my seam review found 8 Low items (section C) and nothing High. | — | Section C. | 03, 09, 10 |
| Protections tested | Fixed | Verified | — | 35 security integration tests plus unit and e2e tests. | Test projects | Suite and e2e results (section H). | 03, 09 |

### B3. Performance

| Item | Status | Verified by auditor? | Severity | What was found | What was changed (files) | Evidence | Owning agent |
|---|---|---|---|---|---|---|---|
| Every N+1 query fixed | Needs your action | Verified (partly) | Medium | Client N+1 fixed (homepage 151 → 71, parish page 156 → 35 requests). Directory batched (1 read + 3 queries). Repeated account and parish reads per signed-in request, and per-row reads in 7 list endpoints, are deferred (03 C-S1). | `public/api-data.js`, `persist.js`, `PartitionDocuments.ByParishAsync`, `PublicDirectoryService` | Suite: `RequestCostTests` passed. The request counts are 04's Playwright numbers (not re-measured). | 04, 03 → D23 |
| Indexes on searched columns | Already OK | Verified (local) | Low | The local store refuses any filter outside `docs/cosmos/containers.json`, and the suite passes. Real Cosmos query plans could not be read. | None | Suite passed under the index contract. | 04 |
| Rarely-changing data cached | Fixed | Verified | High | A server cache of 10 anonymous `[PublicCache]` reads, cleared on any TenantControl or published-homepage commit, bounded to 1,000 entries and 32 MB. | `PublicReadCache.cs`, `PublicCacheAttribute.cs`, `DocumentDatabase.cs` | Code read (seam 1, section C). Suite: `RequestCostTests`, SST withdrawn-announcement test, CRT cache tests passed. | 04, 03 |
| Images below the fold lazy loaded | Already OK | Claimed, not verified | Low | `loading="lazy"`, `decoding="async"`, and `fetchPriority` on the hero. | None | 04's and 05's Lighthouse runs; my Lighthouse CLS below. | 04 |
| Optimistic UI (screen first, server later, with rollback) | Fixed | Verified | High | Edits change the view model, then save; on failure the stored state is reloaded and a toast shown. Delete waits for the server. Double-click data loss fixed at the root. **New (N2, Low):** after the new 30 s time-out, a manual retry carries a new operation id, so a slow write can be duplicated. | `persist.js`, `ui.jsx` busy handler, 4 delete handlers | e2e `ui-states` "a double click on Delete removes one meeting, not two"; regressions "a failed save…" (2) passed. | 04, 05 |
| Images optimized | Fixed | Verified | Low | WebP throughout; a 540 px window image for phones; WebP fallback photo. | `Sanctuary.jsx`, `site.jsx`, CSS (05) | Files read; build passed. | 05 |
| Caching set up | Fixed | Verified | High | Assets are immutable for a year; pages `no-cache`; `/api` `no-store` except public reads; photos 15 minutes; Brotli and gzip for static files only. No CDN (decision). | `Program.cs` compression; cache headers | Host: the portal script is served `br` and `immutable`; `/api/auth/csrf` has no `Content-Encoding` and is `no-store`. QRT `Static_pages_are_compressed_and_api_answers_are_not` passed. | 03, 04 → D18 |

### B4. Legal, privacy and content

| Item | Status | Verified by auditor? | Severity | What was found | What was changed (files) | Evidence | Owning agent |
|---|---|---|---|---|---|---|---|
| Privacy policy | Needs your action | Verified (text) | High | Published in English and Arabic. Effective date 23 November 2026 since the integrator added what security events keep. Operator identity, legal bases and response time are missing. Not reviewed by a lawyer. | `frontend/privacy.html`, `hardening/legal-drafts/privacy-policy.md` | My diff of `226b61a`. e2e `legal-seo.spec.mjs` passed. | 06 → D9, D10 |
| Terms and conditions | Needs your action | Verified (text) | Medium | Published; effective 22 November. The contracting party, IP, dispute forum and language precedence are missing; liability is an owner decision. | `terms.html`, `terms-of-use.md` | File read; e2e passed. | 06 → D10, D14 |
| Cookie policy | Fixed | Verified | Low | A new page in both languages. | `frontend/public/cookies.html` | e2e `legal-seo` test 1 passed. | 06 |
| Cookie consent | Not applicable | Verified | Low | Only strictly necessary cookies (`__Host-ParishLife`, `__Host-ParishLife.Csrf`) and user-set preferences. No analytics or tracking, so no banner is needed. | None (decision) | e2e `public-site` test 1 (only the CSRF cookie across 10 pages) passed. | 06, 09 |
| Refund policy | Needs your action | Verified | Medium | Nothing is sold online, but the product page shows $19 and $49 a month. The terms say there is nothing to refund through ParishLife. | `terms.html` "Payments and refunds"; `refund-policy.md` (not for publication) | `Landing.jsx` read. | 06 → D11 |
| Form consent | Fixed | Verified | Medium | Sign-up states acceptance with links and now records `TermsVersion` and `TermsAcceptedAt`. The request form has a privacy note. **New (N5, Low):** the recorded version is `2026-11-22`, but privacy is now 23 November. | `AccountService.TermsVersion`, `RequestPage.jsx` | Suite: SST `Sign_up_records_the_accepted_terms_version_and_time` passed. My grep of the dates. | 03, 05, 06 → D15 |
| Only necessary data | Needs your action | Claimed, not verified | Medium | No field to remove. Retention periods are not set (owner question 15), so nothing is purged. | None | 06's review; PROJECT_MAP §6. | 06 → D14 |
| Analytics tracking (consent-aware) | Already OK | Verified | Low | No analytics tool. Anonymous server-side daily counts, skipped on DNT and GPC. | None | Code read: `lib/beacon.js`. | 06 |
| Analytics created for key events | Not applicable | Verified | Low | No analytics tool by owner choice. Security events cover sign-ups, resets and closures for operations. | None | `SecurityEvents.cs`. | 06, 08 |
| Third-party embeds | Fixed | Verified | Medium | Google Fonts removed (self-hosted, OFL), print sheets included. Turnstile is necessary and disclosed. No embeds. | `public/assets/fonts`, `print.js`, CSP | Host: the CSP has no Google hosts. My grep of `fonts.googleapis` in the frontend: 0. e2e `legal-seo` "no Google requests" passed. | 06, 05, 03 |
| Fake reviews removed | Already OK | Verified | Low | No testimonials, ratings or logo walls. | None | `Landing.jsx` read. | 06 |
| Unsupported claims | Needs your action | Verified | Medium | Five claims were corrected. Still to confirm: the prices and rate, "Set your parish up in one afternoon", and the product-page demo naming a priest at a real town (N7). | `Landing.jsx`, `public.html` | Bundle grep (N7). | 06 → D11, D13 |
| Business details | Needs your action | Verified | High | No legal name, address or registration anywhere. The product page shows "Beirut, Lebanon", `hello@parishlife.app` (no MX record, still true today) and a WhatsApp number of unknown owner. | Placeholder comments (06) | My `dig MX parishlife.app`: empty. | 06 → D9, D11 |
| Image copyright | Needs your action | Claimed, not verified | Medium | 33 photos and 4 icons have no recorded source or licence; one Unsplash credit. | None | 06's byte scan. | 06 → D13 |
| Applicable local laws | Needs your action | Claimed, not verified | High | Law 81/2018 (declaration and health-data licence), Consumer Protection 659/2005 once sold; GDPR only if diaspora parishes join. | None | 06's register (section F). | 06 → D10, D16 |
| Every other legal risk flagged | Needs your action | Verified (register read) | Medium | Register re-checked and updated (section F): MX now exists, but routing is unconfirmed; demo names added. | — | Section F. | 06, 10 |
| Users can delete their account and data | Fixed | Verified | High | Self-service data copy and closure, refused while responsibilities are held. **New (N4, Low):** ministry leader appointments are not checked. | `AccountClosureService`, `AccountClosureController`, `account-closure.jsx` | Suite: SHT closure tests, SST closure guard passed. e2e `account.spec.mjs` (closure) passed. Code read. | 03 |
| AI disclosures (if AI is used) | Not applicable | Verified | — | No AI. The privacy page states it. | `privacy.html` | My grep of API, frontend and lock files for model SDKs: none (one false positive, `geMini` in a variable name). | 06 |
| Lawyer review recommended | Needs your action | Verified | High | Every legal page and draft is a draft for a Lebanese lawyer. | — | — | 06 → D10 |

### B5. Accessibility and UI

| Item | Status | Verified by auditor? | Severity | What was found | What was changed (files) | Evidence | Owning agent |
|---|---|---|---|---|---|---|---|
| Accessibility (WCAG 2.2 AA) | Fixed | Verified | High | axe went from 10/230 clean page states to 230/230. Lighthouse accessibility is 100 on the sign-in page and public pages. | Many frontend files (05) | My axe-core 4.14.1 run (09's script, local host): **230 of 230 page states clean**. My Lighthouse: accessibility 100 on 6 pages, 96 on the product page (animated demo row). | 05 |
| Alt text | Already OK | Verified | Low | Informative images have alt text; decorative ones `alt=""`. | Verse made readable (05) | axe `image-alt` clean in my run. | 05 |
| Color contrast | Fixed | Verified | High | Field edges were 1.32:1; the dark-mode white panels and danger button failed. | Tokens in `styles/*.css`, `lib/theme.js` | axe `color-contrast` in my run: 0 violations in 230 states (dark mode included). | 05 |
| Keyboard-friendly forms | Fixed | Verified | High | The authenticator step reused the username field. Fixed; the drawer traps Tab. | `Auth.jsx` | e2e regressions "authenticator step…" passed. | 05 |
| Clear button labels | Fixed | Verified | Medium | 384 label-in-name mismatches went to 0. | `Portal.jsx`, `Chrome.jsx`, others | axe in my run. | 05 |
| Real 404, 500, empty and loading states | Fixed | Verified | High | Screen error boundary, skeletons, bilingual errors with a trace id. Real HTTP 404 for unknown parishes and paths. | `ui.jsx`, `routes.jsx`, `PublicPages.cs` | Host: an unknown parish gives 404. e2e smoke (unknown addresses 404) and portal "opens every screen" passed. | 05, 03 |
| OG images | Fixed | Verified | Low | Absolute `og:image` and `twitter:image` on the home and product pages. | `public.html`, `landing.html`, `og-landing.jpg` | File read. | 05 |
| Favicon | Fixed | Verified | Low | `favicon.ico` and touch icons on every page. | `public/favicon.ico`, heads | `ls dist/favicon.ico`. | 05 |
| Tested on multiple devices | Could not verify | Verified (what ran) | Medium | Chromium desktop, Firefox desktop, and Pixel 7, iPhone 14 and iPad emulation in Chromium all pass. Safari, iOS Safari and real phones were not tested: WebKit crashes at launch on this macOS. | None | e2e `devices.spec.mjs` (4) passed in my run. | 05, 09 → D25 |

### B6. Design fine-tuning

| Item | Status | Verified by auditor? | Severity | What was found | What was changed (files) | Evidence | Owning agent |
|---|---|---|---|---|---|---|---|
| Nested radius = outer radius minus padding | Fixed | Verified | Low | Menu, dropdown and segmented-button radii were adjusted. | `styles/parishlife.css` | `grep "calc(var(--r-card)"` in the CSS. | 05 |
| Alpha borders instead of solid hex | Fixed | Verified | Medium | Dividers use alpha tints; field edges are solid ≥ 3:1 (contrast). | CSS tokens | CSS read. | 05 |
| OKLCH instead of HSL | Already OK | Verified | Low | No HSL. Derived palettes are computed in OKLCH. | None | `grep hsl(` over `src`: 0; `lib/theme.js` read. | 05 |
| Gradients interpolated in OKLCH | Fixed | Verified | Low | The colour wheel uses `in oklch`. | `styles/app.css` | grep. | 05 |
| Icon stroke matches text weight | Fixed | Verified | Low | Non-scaling 1.5 and 1.75 px strokes. | `icons.jsx`, CSS | Code read. | 05 |
| Carousels faded with a mask | Fixed | Verified | Low | Scroll-driven edge masks, RTL mirrored. | `app.css`, `site.css` | CSS read. | 05 |
| Blur transition when swapping icons | Fixed | Claimed, not verified | Low | The copy-link icon swap. | `parish-parts.jsx`, `site.css` | Not exercised by me. | 05 |
| Lighter surfaces for depth in dark mode | Fixed | Verified | Medium | `--surface-raised` for floating layers. | `lib/theme.js`, CSS | axe dark pass in my run. | 05 |
| dvh instead of 100vh on mobile | Fixed | Verified | Medium | `100dvh` after a `100vh` fallback. | CSS, `ui.jsx` | grep. Real Safari not tested. | 05 |
| White-background product shots blended into the page | Not applicable | Verified | — | No product photographs. | None | Asset list. | 05 |

### B7. SEO and AEO

| Item | Status | Verified by auditor? | Severity | What was found | What was changed (files) | Evidence | Owning agent |
|---|---|---|---|---|---|---|---|
| sitemap.xml | Fixed | Verified | Medium | Generated by the server: 5 static pages plus published parishes. | `Middleware/PublicPages.cs` | Host: `/sitemap.xml` gives 200. SST sitemap test and e2e `legal-seo` passed. | 03, 06 |
| robots.txt | Fixed | Verified | Low | Public pages open; `/api/` disallowed except `/api/public/`; points to the sitemap. | `public/robots.txt` | File read; e2e passed. Live still 404 (old deploy). | 06 |
| Structured data | Fixed | Verified | Medium | JSON-LD WebSite and Organization (public), SoftwareApplication and FAQPage (landing), Church per parish (server). | heads, `PublicPages.cs` | e2e `legal-seo` JSON-LD parse; SST encoding test. Google Rich Results not run (offline). | 06, 03 |
| Titles, meta descriptions and canonical URLs | Fixed | Verified | Medium | Unique titles and descriptions; canonicals on every page; the directory canonical (QA bug 7) fixed. **New (N1, Low):** `$` in parish text is read as a regex substitution when the head is rewritten. | heads, `PublicPages.cs` (`70959fd`) | Host: `public.html?lang=ar` has exactly 1 canonical. e2e "names its canonical address" passed. `dotnet fsi` repro for N1. | 06, 03 |
| Content answer engines can understand | Needs your action | Verified | Low | Heads, JSON-LD and FAQ are present, but the body is empty without JavaScript (QA bug 4, a prerender decision). | — | e2e "public pages show their content without JavaScript" still fails as expected. | 06, 05 → D27 |

### B8. Testing

| Item | Status | Verified by auditor? | Severity | What was found | What was changed (files) | Evidence | Owning agent |
|---|---|---|---|---|---|---|---|
| Unit tests | Fixed | Verified | — | 99 unit tests. | `ParishLife.UnitTests` (CRT, SUT, telemetry, config) | Mine: `Passed! Failed: 0, Passed: 99`. | 09, 03, 08 |
| Smoke tests | Fixed | Verified | — | 3 read-only smoke tests; the command is documented for after each deploy. | `frontend/e2e/smoke.spec.mjs` | e2e: 3/3 passed. | 09 |
| Regression tests | Fixed | Verified | — | Every fix in reports 02–06 maps to a named test (09's map, spot-checked). | QRT, CRT, `regressions.spec.mjs` | Suite and e2e passed. | 09 |
| Tested on slow networks | Fixed | Verified | Low | Slow 3G and 4G, offline, and a hung request (now a 30 s time-out). | `network.spec.mjs` | e2e `network.spec.mjs` (5) passed, including "never answers" (no longer `test.fail`). | 09, integrator |
| Tested on multiple devices | Could not verify | Verified (what ran) | Medium | Emulation only; no Safari or real phones. | `devices.spec.mjs` | e2e passed. | 09 → D25 |
| Password reset works | Fixed | Verified | — | End to end in the browser with the test inbox, a second device and the first session ended. | `account.spec.mjs` | e2e passed. | 09, 03 |
| Email verification works | Fixed | Verified | — | Sign-up, then the emailed code, then sign-in. | `account.spec.mjs`, QRT | e2e and suite passed. | 09 |
| Account deletion works | Fixed | Verified | — | Closure in the browser; the old credentials fail; the data copy has no hashes. | `account.spec.mjs` | e2e passed. | 09 |
| Cookie consent behavior tested | Fixed | Verified | — | No optional cookies exist; tested that only the CSRF cookie is set. | `public-site.spec.mjs` | e2e passed. | 09 |

### B9. AI/LLM (if the product uses a model)

| Item | Status | Verified by auditor? | Severity | What was found | What was changed (files) | Evidence | Owning agent |
|---|---|---|---|---|---|---|---|
| Evals written | Not applicable | Verified | — | No model calls anywhere; Agent 07 did not run. | None | My grep (B4, AI disclosures). `Microsoft.Extensions.AI` appears only in the local-only AppHost lock file (transitive, never deployed). | 01, 10 |
| Prompt injection tested | Not applicable | Verified | — | No model. | None | Same. | 10 |
| Fallback when the model API goes down | Not applicable | Verified | — | No model. | None | Same. | 10 |
| Token limits and context overflow handled | Not applicable | Verified | — | No model. | None | Same. | 10 |
| In-app spend limits | Not applicable | Verified | — | No model. | None | Same. | 10 |

### B10. Operations

| Item | Status | Verified by auditor? | Severity | What was found | What was changed (files) | Evidence | Owning agent |
|---|---|---|---|---|---|---|---|
| CI/CD | Needs your action | Verified (file); never run | High | The pipeline has never run on GitHub. Deploys are gated on a push to `main`, a repository variable, environment reviewers and an OIDC credential. **New (N6, Low):** the runbook's "second federated credential on the same identity" option for staging lets the reviewer-free staging job hold production rights. **New (N8, Low):** actions are pinned by tag, not SHA. | `.github/workflows/ci.yml`, runbook | Workflow read (section C, seam 8). Every gate condition checked. | 08 → D8 |
| Staging environment | Needs your action | Verified (none exists) | Medium | None. The cheapest mirror is documented. | `docs/operations/deployment-and-rollback.md` | Runbook read. | 08 → D17 |
| Alerting | Needs your action | Claimed, not verified | High | Defined in Bicep, never compiled (no Bicep CLI) or deployed. | `infra/monitoring.bicep` | File present; not compiled. | 08 → D4 |
| Performance monitoring | Needs your action | Claimed, not verified | Medium | Application Insights request telemetry when the connection string is set; latency alert in Bicep; no real-user vitals. | `TelemetryExtensions.cs` | Code read. | 08 → D4, D21 |
| Analytics | Already OK | Verified | Low | Anonymous server counts only, by design. | None | `beacon.js`, `SiteMetricsController`. | 06 |
| Error tracking | Needs your action | Verified (code) | Medium | Backend 500s carry type and trace id; releases are now tagged (`service.version`). No frontend error tracking (decision). | `TelemetryExtensions.cs`, `TelemetryReleaseTests.cs` (`a7c93eb`) | Suite: `TelemetryReleaseTests` passed (in 99/99). | 08 → D21 |
| Logging | Needs your action | Verified (code) | Medium | Structured logs with a trace id and no secrets. Retention, IP masking and query redaction are Azure facts to confirm. | — | SHT log test. Azure: D4. | 08, 03 |
| Uptime monitoring | Needs your action | Claimed, not verified | High | Two ping tests are defined in Bicep, not deployed. | `infra/monitoring.bicep` | — | 08 → D4 |
| Spend caps and billing alerts | Needs your action | Claimed, not verified | Medium | A budget is defined in Bicep; caps for other vendors are documented. | `infra/monitoring.bicep`, monitoring runbook | — | 08 → D4 |
| Database backups | Needs your action | Claimed, not verified | High | Cosmos continuous 7 days and Blob soft delete 30 days are claimed in docs only. The snapshot policy is undecided. | `data-snapshot-and-recovery.md` | — | 08 → D3 |
| Restore actually tested | Needs your action | Claimed, not verified | High | Only a local drill (148 records, exact match), by 08. I did not repeat it. No Azure point-in-time restore yet. | `tools/ParishLife.Maintenance/Program.cs` fix (`--local` start) | 08 report §C. | 08 → D3 |
| Rollback plan for bad deploys | Needs your action | Verified (plan read) | Medium | One click (re-run a `main` run) or one `az webapp deploy` of the previous package. Never rehearsed. | runbook | Section I. | 08 → D17 |
| Custom domain and SSL | Already OK | Claimed, not verified | Low | Managed certificate valid to 18 May 2027; HTTP and `www` go to the apex with 301. | Dated note (08) | Live HEAD today: HTTP/1.1 200 over HTTPS. Certificate details are 08's `openssl` run. | 08 |
| Email authentication (SPF/DKIM/DMARC) | Needs your action | Verified (DNS) | Medium | MX goes to Cloudflare routing. SPF `include:_spf.mx.cloudflare.net ~all`. DMARC `p=none`. Resend DKIM present. The routing rule and Resend verification are unconfirmed. | `docs/operations/email-delivery.md` | My `dig` via 1.1.1.1 today: 3 MX, SPF, DMARC `p=none`, `resend._domainkey`. | 08 → D5 |
| HTTP/2 and proxy patching | Already OK | Claimed, not verified | Low | Platform front end and patched Kestrel; no WAF (decision). | None | Live HTTP/1.1. | 08, 03 → D18 |
| README | Fixed | Verified | Medium | Rewritten for people. | `README.md`, `HANDOVER.md`, `frontend/README.md` | File read. | 08 |
| Commit messages and branch protection | Needs your action | Verified (hook) | Medium | Hook, PR template and CI check exist. Branch protection is an owner step; hooks are not enabled in clones. | `.githooks/commit-msg`, `tools/tests/commit-msg.Tests.sh` | Mine: `sh tools/tests/commit-msg.Tests.sh`: all 14 cases passed. | 08 → D8 |
| Architecture explained (ARCHITECTURE.md) | Fixed | Verified | Medium | Written. | `docs/ARCHITECTURE.md` | File present and read in part. | 08 |
| No AI tool or laptop with production database access | Needs your action | Claimed, not verified | High | AI sessions deployed with the owner's `az login`; people hold standing data roles; Cosmos key auth is on. | `docs/operations/production-access.md` | From docs (no Azure access). | 08 → D2 |

### B11. Everyday users (owner's checklist)

| Item | Status | Verified by auditor? | Severity | What was found | What was changed (files) | Evidence | Owning agent |
|---|---|---|---|---|---|---|---|
| Double-tapped pay is idempotent | Already OK | Verified | Medium | No online pay. Every create carries an `OperationId` enforced in the same batch; the busy-button handler blocks a second press. Residual: N2 (retry after time-out). | `persist.js`, `ui.jsx` (05) | Suite: QRT double-tap (4 posts, 1 record); `Concurrent_duplicate_save_has_one_receipt…`. e2e double-click Delete. | 03, 05, 09 |
| Email capital letters handled | Already OK | Verified | Low | One normalizer. | None | Suite: QRT capitalized email; SHT lookup test. | 03, 09 |
| Apostrophes and Arabic in names | Already OK | Verified | Low | Names are stored as typed. | None | Suite: SHT `Real_names_with_apostrophes…`; e2e "Rita Al-Khoury O'Neil" sign-up. | 03, 09 |
| iPhone HEIC photo upload | Needs your action | Verified | Medium | HEIC is refused with a clear message, not converted. EXIF is kept (QA bug 2). | None | Suite: ATT HEIC refused; QRT EXIF test fails with `QA_KNOWN_FAILURES=1` (my run). | 03 → D7 |
| Password reset email arrives and survives link scanners | Needs your action | Verified (local) | Medium | Codes, not links; a GET spends nothing. In production, email is off until Resend is configured. | — | Suite: QRT scanner GET test passed; e2e reset via test inbox. | 03 → D5 |
| Another time zone | Already OK | Verified | Low | UTC instants and IANA zones; DST handled. Browser display in two zones is not automated. | None | Suite: `Recurrence_preserves_local_wall_time_across_daylight_saving…` passed. | 03 |
| Lost signal after paying | Not applicable | Verified | — | Nothing is paid online. On lost signal, writes now time out after 30 s (see N2). | — | — | 03 |
| A delete-account button | Fixed | Verified | High | "Close my account" in My account. | `account-closure.jsx` | e2e `account.spec.mjs` passed. | 03, 05 |
| Apple Hide My Email relay addresses | Already OK | Verified | Low | Accepted as typed. | None | Suite: QRT Apple relay test passed. | 03, 09 |
| 10,000 at once (pooling, caching, load test) | Fixed | Verified | High | Singleton clients, server cache, k6 script. | `tools/load/parishlife.k6.js`, `PublicReadCache.cs` | My k6 (local Debug host, hold 1 min): pilot 7,313 requests, 0 errors, p95 visitors 86 ms, staff 164 ms. 10×: 58,107 requests (469/s), **0 errors**, visitors p95 541 ms (threshold 1 s met), **staff p95 1.83 s, crossing the 1.5 s threshold** (k6 exit 99). 04 also crossed it at 10× (1.63 s); 09 met it on a Release build (1.36 s). The cause is the repeated signed-in reads (D23) on one shared parish partition. | 04, 09 |

### B12. Abuse and bill shock (owner's checklist)

| Item | Status | Verified by auditor? | Severity | What was found | What was changed (files) | Evidence | Owning agent |
|---|---|---|---|---|---|---|---|
| AI in a loop all night | Not applicable | Verified | — | No AI. | — | — | 10 |
| Whole book pasted into the chat | Not applicable | Verified | — | No AI chat. Kestrel's 64 KB body limit and `Guard.Text` limits apply to messages anyway. | — | `Program.cs` read. | 10 |
| Free trial every day | Not applicable | Verified | — | No trials or promotions. | — | — | 03 |
| 10,000 fake accounts | Needs your action | Verified | Medium | Turnstile, 20 a minute per address, email confirmation before sign-in, age box. Disposable-domain blocking is a decision (recommended no). | Age box (03) | Suite: QRT sign-up limit (the 21st gets 429). | 03 → D20 |
| 5 GB profile picture | Already OK | Verified | Low | 64 KB default; uploads 10/5/1 MB enforced before the body is read. | None | Suite: QRT 50 MB refused after 1 KB. | 03, 09 |
| Generate x100 at once | Already OK | Claimed, not verified | Low | Exports are paged; imports 64 KB; one report worker per minute; no per-organization concurrency cap. | None | 03's code review. | 03 |
| Invite spam x10,000 | Already OK | Verified | Low | In-app only; broadcasts capped at 2,000 recipients, staff-only; invitations single-use. | None | `BroadcastService.MaximumRecipients` read. | 03 |
| Demo video x1,000,000 (bandwidth) | Needs your action | Verified | Medium | No video. Biggest egress: static assets with no CDN (compression now on), photos with a 15-minute cache. | Compression, photo cache headers | Host: Brotli on static files. | 04 → D18 |
| Your AI used as someone else's proxy | Not applicable | Verified | — | No AI. Server-side outbound calls go to fixed hosts only (no SSRF surface found). | — | `ResendContactCodeDelivery`, `TurnstileVerifier`, OAuth endpoints are constants. | 03, 10 |
| Login codes x10,000 (per phone and per IP) | Failed | Verified | Medium | One code a minute per address and purpose, 20 a minute per IP, but **no daily cap per address** (QA bug 3). Low while email is off; Medium once Resend is on. | None | My run with `QA_KNOWN_FAILURES=1`: `Code_emails_to_one_address_stop_at_a_daily_cap` **fails**. | 03 → D6 |

### B13. Code quality (owner's checklist)

| Item | Status | Verified by auditor? | Severity | What was found | What was changed (files) | Evidence | Owning agent |
|---|---|---|---|---|---|---|---|
| Packages that don't exist | Already OK | Claimed, not verified | — | Every direct dependency is a real, long-lived package from its official publisher. | — | 02's registry checks. | 02 |
| Outdated framework/runtime | Needs your action | Verified | Medium | .NET 10.0.15 packages (security release); the majors are decisions; Node is not pinned (CI uses 26). | lock files | `dotnet list package` (no vulnerable); `ci.yml` `NODE_VERSION: "26"`. | 02 → D28 |
| Empty catch blocks | Fixed | Verified | Low | 8 broad catches narrowed or logged; frontend silent catches toasted or commented. | Services (03), frontend (05) | My regex for empty C# `catch {}`: 0 hits. | 03, 05 |
| "Something went wrong" messages | Fixed | Verified | Medium | Bilingual messages saying what to do next, with the trace id as a reference. | `model/api.js` | `api.js` read (`readable`). | 05 |
| Debug and emoji console.log | Already OK | Verified | Low | 0 `console.log` or `console.debug`; one deliberate `console.warn` and one `console.error` (error boundary). | — | My grep. | 02 |
| A comment on every line | Already OK | Verified (spot check) | Low | Purpose comments per file, as the project rules require; no restating comments found in what I read. | — | Files read during review. | 02 |
| 2,000-line components | Needs your action | Verified | Low | Largest component `record-editor.jsx` 1,637 lines (`certificate.jsx` was split). `model/data.js` is 2,606 lines of demo data (N7). | `certificate.jsx` split (05) | My `wc -l`. | 05 → D13 |
| useEffect for everything | Already OK | Verified (count) | Low | 112 `useEffect` uses across the portal and public site; 05 found no props-into-state copies. | — | My grep count; 05's review. | 05 |
| key = index | Needs your action | Verified (count) | Low | 311 `key={i|index|idx}`; 05 says almost all are static lists; meetings fixed. No owner decision strictly needed, but it is a cleanup backlog. | meetings keyed by id | My grep. | 05 |
| The same function four times | Fixed | Verified | Low | 65 private scope and condition copies replaced by shared factories. | `RecordScopes`, `RecordConditions`, Services (`f604c3c`) | grep: services use `RecordScopes.Parish`. | 04, 03 |
| Dead code | Needs your action | Verified | Low | 4 types deleted. Demo records still ship (N7). | 03 | Bundle grep. | 04/05 → D13 |
| Zero tests | Already OK | Verified | — | 99 unit, 534 integration, 42 e2e. | — | My runs. | 09 |
| Paywall hidden with CSS | Already OK | Verified | High | Module coverage is checked in services (`RequireModuleAsync`); the portal's visibility is display only. | — | `MinistryAccess.LeaderAsync` → `ModuleAsync` read; module-lapse tests in the suite. | 03 |
| Login checked in the browser | Already OK | Verified | High | Every action needs a cookie validated on the server. | — | Sweeps; Host 401s. | 03 |
| Signup left open by mistake | Already OK | Verified | Medium | Four account-creation paths, all intended; the test host is not publishable. | — | 03's inventory; publish script refuses the EndToEnd project (08). | 03 |
| Emails in every API response | Already OK | Verified | Medium | Explicit response DTOs; public contracts exclude persistence models. | — | Suite: `…public_contracts_exclude_persistence_models`; EAS. | 03 |
| Anyone can delete data | Already OK | Verified | Medium | Per-object authorization; archive rather than delete; closure needs fresh proof. | — | EAS (no foreign write succeeds). | 03, 09 |
| .env on GitHub | Already OK | Verified | — | Never committed; `.gitignore` covers it; `.env.example` only. | `.gitignore` | gitleaks history, my run. | 02 |

### B14. Search extras (owner's checklist)

| Item | Status | Verified by auditor? | Severity | What was found | What was changed (files) | Evidence | Owning agent |
|---|---|---|---|---|---|---|---|
| Server-rendered public pages | Needs your action | Verified | Low | The server writes parish heads; bodies are client-rendered (QA bug 4). | `PublicPages.cs` | e2e expected failure. | 03, 06 → D27 |
| Real links | Fixed | Verified | Low | The phone bar uses `<a href>`; the rail already did. | `Portal.jsx`, `Landing.jsx` | Code read. | 05 |
| Search Console | Needs your action | Verified (none) | Low | Not set up. | — | — | 06 → D24 |
| Stray noindex | Fixed | Verified | Low | `noindex` only on the portal; `X-Robots-Tag` on `/api` and `?track`. | `index.html`, `Program.cs` | Host: `/api/auth/csrf` and `public.html?track=abc` carry `X-Robots-Tag: noindex, nofollow`. | 06, 03 |
| Real 404 status | Fixed | Verified | Low | Unknown paths and unknown parishes give 404. | `PublicPages.cs` | Host: unknown parish 404. | 03 |
| One URL per page | Fixed | Verified | Low | Canonicals everywhere; the directory canonical added (`70959fd`); `www` and `http` go to the apex with 301. | heads | Host: 1 canonical on `public.html?lang=ar`. | 06, 03 |
| Same content on mobile | Already OK | Verified | Low | Same pages and links. | — | e2e devices passed. | 05 |
| Core Web Vitals | Needs your action | Verified (lab) | Medium | Lab mobile LCP is still above 2.5 s on the main pages; CLS passes. | Compression, splitting, preload | My Lighthouse mobile LCP: sign-in 4.80 s, public 3.79 s, parish 3.69 s, landing 4.35 s; legal pages 1.68 s; CLS ≤ 0.097 everywhere; TBT ≤ 199 ms. | 04 → D18 |
| AI content fact-checked | Needs your action | Claimed, not verified | Medium | Unknown which texts were AI-written; the legal Arabic and UI Arabic were written by agents. | — | — | 06 → D13 |
| Google Business Profile | Not applicable | Verified | — | ParishLife has no public address; each parish may claim its own. | — | — | 06 |

### B15. Legal extras (owner's checklist)

| Item | Status | Verified by auditor? | Severity | What was found | What was changed (files) | Evidence | Owning agent |
|---|---|---|---|---|---|---|---|
| Marketing only with consent | Not applicable | Verified | — | No marketing email, SMS or WhatsApp. | — | `ResendContactCodeDelivery` sends codes only. | 06 |
| DMCA agent and takedown process | Already OK | Verified | Low | A reporting section is published; a DMCA agent is not needed without US users. | `terms.html` | File read. | 06 |
| Data encrypted | Already OK | Claimed, not verified | Medium | TLS; Azure encryption at rest; Data Protection field encryption for sensitive text. Hosted settings unverified. | — | `CosmosIdentityStore`, `PersonalWorkspaceService` read by 03. | 03 |
| AI use policy | Not applicable | Verified | — | No AI. | — | — | 06 |
| FaceID/biometric consent | Already OK | Verified | Low | Passkeys only; no biometric data reaches the server. | `privacy.html` sentence | `PasskeyService` stores the credential id and public key. | 03, 06 |
| Tracking pixels only after consent | Not applicable | Verified | — | No pixels. | — | e2e: no third-party requests besides Turnstile. | 06 |
| Age gate | Fixed | Verified | Medium | The 13+ box is enforced on the server (form and providers). | `AccountService`, `ExternalSignInController`, `Auth.jsx` | Suite: SHT `Sign_up_requires_the_13_or_older_confirmation`; e2e age box. | 03 |
| One-click unsubscribe | Not applicable | Verified | — | Transactional codes only. | — | — | 06 |
| Proof for AI claims | Not applicable | Verified | — | No AI claims (06 grep, EN and AR). | — | — | 06 |

### B16. Feels finished (owner's checklist)

| Item | Status | Verified by auditor? | Severity | What was found | What was changed (files) | Evidence | Owning agent |
|---|---|---|---|---|---|---|---|
| Buttons show a pending state | Fixed | Verified | High | Spinner plus `aria-disabled` while `persist()` saves; `useSubmit` and `run` helpers have their own busy state. Limit: the global handler only catches presses whose handler calls `persist()` in the same click task (section C, seam 4). | `ui.jsx`, `persist.js` | e2e `network` "double press sends one sign-in"; `ui-states` double-click. | 05 |
| No blank loading screens | Fixed | Verified | Medium | Skeletons and an error boundary. | `ui.jsx`, `routes.jsx` | e2e slow-network skeleton. | 05 |
| No empty first screens | Already OK | Verified | Low | Every screen explains when it is empty. | — | e2e: every role opens every screen of the empty fixture parish. | 05 |
| Tap animations | Fixed | Claimed, not verified | Low | An `:active` dip on tappable controls. | CSS | Not automated. | 05 |
| Offline support | Fixed | Verified | Medium | Portal offline banner; the service worker's offline page and offline directory. The portal does not register the worker itself (waits for a real-Firefox check). | `sw.js`, `Portal.jsx` | e2e offline tests passed; `sw.js` read (seam 3). | 05 → D25 |

---

## C. New findings from my independent review

No High or Critical finding. Eight Low findings, then the seam-by-seam review that produced them.

| # | Finding | Severity | Location | Reproduction | Who should fix |
|---|---|---|---|---|---|
| N1 | **Parish text is read as a regex substitution pattern when the parish page head is written.** `Regex.Replace(html, replacement)` treats `$&`, `$0`, `` $` ``, `$'` and `$_` in the replacement as references to the matched or surrounding template text. The replacement holds the parish name, rite and Mass times, HTML-encoded, but `$` is not encoded (and `'` becomes `&#39;`, so a typed `$'` turns into `$&`). A parish editor's text can therefore splice template HTML into the `<meta content="…">` attribute, which breaks out of the attribute and duplicates parts of the page head and body. Every inserted fragment is trusted template text and the parish text stays encoded, so it is **not** script injection. It is a malformed head and garbled search and preview text. | Low | `ParishLife.Api/Middleware/PublicPages.cs`, `ParishPageAsync` (the `Title()` and `Meta(...)` `.Replace(html, …, 1)` calls) | With the same regex and `WebUtility.HtmlEncode`, a description containing `Sun 9:00 $'` produced `content="St Elias. Mass times: Sun 9:00 <meta name="description" content="Find parishes">#39; "` (`dotnet fsi`, scratchpad `10/rx.fsx`). In the app: set a published parish profile's Mass times to `9:00 $_`, publish, and `GET /public.html?parish=<id>`. | 03. Fix: pass a `MatchEvaluator` (`_ => replacement`) or replace `$` with `$$`; add `$` cases to the SST encoding test. |
| N2 | **A write that times out at 30 s can be duplicated on retry.** `70959fd` aborts `fetch` after 30 s, and its comment says "its retry carries the same operation id". It does not: every module function calls `newOperationId()` per call (for example `postMessage`, `startConversation`, people and household creates). If the server commits after the client gave up, a second press creates a second record. Before `70959fd` the button hung instead. | Low | `frontend/src/portal/model/api.js` (`send`, `ANSWER_TIMEOUT_MS`); `model/modules/*.js` | Delay a create past 30 s (for example a Playwright route that holds the request, then lets it through), see the connection message, press Save again: two records. | 05 (integrator commit). Fix: keep the operation id of a failed save for its retry, or reload before allowing a retry; correct the comment. |
| N3 | **Sign-in timing still distinguishes unverified and locked accounts.** The dummy-hash fix covers unknown and inactive addresses. `CheckPasswordSignInAsync` runs Identity's pre-sign-in check (confirmed account via `VerifiedAccountConfirmation`, lockout) before hashing, so those answers return in about 1 ms against about 50 ms. | Low | `AccountsController.Login`; `Extensions/ServiceCollectionExtensions.cs` line 311 (`RequireConfirmedAccount`) | Register an address without confirming it, then time a wrong-password sign-in for it against an unknown address (the ATT timing test with an unconfirmed account). | 03. Fix: verify the password against the dummy hash before returning on `NotAllowed` or `IsLockedOut`. |
| N4 | **Account closure ignores ministry leader appointments.** The guard checks parish ownership, grants, archdiocese representation, staff or clergy appointments and bishop appointments. A `ministryLeader:<ministry>:<account>` document (Leader or Assistant) gives leader rights without a grant (`MinistryAccess.LeaderAsync`), and it is not checked, so a ministry's only leader can close and leave a dangling appointment. The parish office can still manage the ministry, so nothing is orphaned. | Low | `Services/Accounts/AccountClosureService.cs` `RequireNothingHeldAsync` | Appoint a member as a ministry Leader without any grant, then close that account: 200 instead of `closure_responsibilities_held`. | 03 |
| N5 | **The recorded policy version no longer matches the policy.** `AccountService.TermsVersion = "2026-11-22"`, but `privacy.html` became effective on 23 November (`226b61a`). New sign-ups record a version that does not name the privacy text they accepted. | Low | `Services/Accounts/AccountService.cs` line 16; `frontend/privacy.html` | `grep -n 'Effective date' frontend/*.html frontend/public/cookies.html`. | Integrator or 03 (bump the constant with each policy change, or record per-document versions); 06 for the policy. |
| N6 | **Staging deploy could carry production rights.** The runbook (step 7) offers "a second federated credential on the same identity" for staging. That identity is Website Contributor on `app-parishlife`, and the `staging` environment has no reviewers. If `AZURE_WEBAPP_NAME` is missing from the staging environment, GitHub falls back to a repository-level variable of the same name, and a push to `main` deploys to production without approval. | Low | `docs/operations/deployment-and-rollback.md` line 110; `.github/workflows/ci.yml` `deploy-staging` | Configuration review. | 08: drop the "same identity" option and require a staging-only identity. |
| N7 | **Fictional records ship in the production bundles.** `frontend/src/portal/model/data.js` (2,606 lines) still holds the old demo parish: "Saint Elias, Hadath", a named priest, and a phone number `+961 5 461 220`. It is bundled into `portal-*.js`, `styleguide-*.js` and `landing-*.js`. The portal replaces the data on load, but the product page's demo shows the priest's name and a real town. The project rules forbid invented church or person data, and the phone number may belong to someone. | Low | `frontend/src/portal/model/data.js`, product-page demo | `grep -o 'Antoine Khoury\|Hadath\|461 220' frontend/dist/assets/app/*.js`. | 05 (code), 06 (claims). The map's ownership row gives `data.js` to 04 to propose. |
| N8 | **CI actions are pinned by tag, not commit SHA** (`actions/checkout@v4`, `azure/login@v2`, …). A moved tag in a compromised action would run in the deploy jobs that hold the OIDC token. | Low | `.github/workflows/ci.yml` | Workflow read. | 08 |

### Seam-by-seam review

1. **Public read cache (04) versus authenticated or tenant data: OK.**
   - All 10 `[PublicCache]` actions are on `[AllowAnonymous]` `api/public/*` controllers. None of their service methods reads `ICurrentActor`, a cookie or a header; I read `WebsiteService.PublicAsync`, `HomepageService.PublicAsync`, `ParishProfileService.PublicAsync`, `LiturgicalCalendarService.PublicAsync`, `PublicDirectoryService.BrowseAsync`, and the calendar, ministries and announcements actions.
   - The key is path + query, and host filtering is on.
   - Every write goes through `DocumentBatch.ExecuteAsync`, which calls `Changed`. Parish and archdiocese records both live in TenantControl, so approving a liturgical calendar clears the cache too.
   - Only 200 GET `ObjectResult`s are stored. The generation check keeps answers computed across a commit out.
   - Residual, by design: an account's display name (the clergy list) can be 60 s stale.
2. **Response compression (03) versus secrets: OK.**
   - Compression is applied only outside `/api`.
   - Outside `/api`, no response body carries a secret next to text the caller chose: pages are static or hold published parish data, the sitemap is public, the CSRF token travels in a cookie header, and OpenAPI is off in production.
   - Host: `/api/auth/csrf` with `Accept-Encoding: br, gzip` had no `Content-Encoding`.
3. **Service worker cache versus private data: OK.**
   - `sw.js` stores API answers only for routes on the API's own offline list, which is generated from the `[PublicCache]` attributes, so anonymous reads only.
   - The portal page is never kept. Parish photos and document checks are not on the list.
   - Minor: lazily loaded portal code chunks other than `portal-*.js` are kept. They hold code, not data.
4. **Busy-button capture handler versus every form: mostly OK.**
   - The capture handler blocks presses only on buttons whose click handler calls `persist()` in the same task.
   - Forms using `useSubmit` (`ui/forms.jsx`) and the `run` helpers I read (`requests-case.jsx`, `request-follow.jsx`) keep their own busy state.
   - Direct `api()` calls outside those helpers rely on the component; I did not audit all of them.
   - No double-send found in what I read. The e2e double-click test passes.
5. **30 s answer time-out versus slow writes:** N2.
   - Uploads, exports and the data copy use their own `fetch` without the time-out, so large uploads on slow links are not cut off.
6. **Generated parish page head and canonical stripping versus encoding:** N1.
   - Values are HTML-encoded, and the JSON-LD is JSON-encoded and inserted without a regex.
   - Canonical stripping removes the static canonical before the parish's own is inserted. Host: one canonical on the directory page.
   - The `Origin` is built from the `Host` header, which `AllowedHosts` bounds.
7. **Account closure guard versus every responsibility type:** N4.
   - Billing payers are parish or archdiocese ids (`PayerSchedule` defaults to the parish id), so they cannot block.
   - Operators are refused.
8. **CI workflow versus accidental deploys from non-main pushes: OK in the workflow.**
   - Both deploy jobs need `github.event_name == 'push' && github.ref == 'refs/heads/main'` plus a repository variable.
   - `pull_request` from forks gets no secrets.
   - `workflow_dispatch` never deploys.
   - Global permissions are `contents: read`, and `id-token: write` is granted only in the deploy jobs.
   - Residual: N6 (runbook) and N8.

Other areas I checked for what the agents' scopes could have missed:
- **Open redirects:** only fixed `PortalPage` redirects.
- **Link schemes:** homepage and profile links are https-only and site paths refuse `//`; rich-text links are http(s) only.
- **SSRF:** outbound hosts are constants.
- **Mass assignment:** typed DTOs; ATT privilege keys ignored.
- **Insecure deserialization:** System.Text.Json only.
- **Path traversal:** evidence keys are regex-checked.
- **Command injection:** none.
- **Clickjacking:** `frame-ancestors 'none'` and `X-Frame-Options: DENY`.
- **Races in payments or coupons:** no online payments. Discounts are staff-applied fixed amounts with no codes. Seats, bookings, receipts and invitations have concurrency tests that pass.
- **Cross-tenant access:** EAS passes.
- **CSP versus analytics:** no analytics; Google hosts were removed from the CSP only after printing moved to self-hosted fonts.
- **Optimistic UI versus server validation:** a failed save reloads the stored state; e2e regressions pass.

---

## D. Needs your action

Everything only the owner can do, merged from reports 01–09 and my review, de-duplicated, most urgent first. Agent references in brackets.

**Before or at the next deploy**

1. **Prepare the App Service settings, then deploy the hardened build.**
   1. In App Service → Environment variables, make each group either complete or empty: `Turnstile__SiteKey` and `Turnstile__SecretKey`; `Email__Provider`, `Email__ResendApiKey` and `Email__From`; and each `ExternalSignIn__<provider>__*`. The new build refuses to start otherwise (intended).
   2. Check that every Key Vault reference shows **Resolved**.
   3. Note whether `ASPNETCORE_FORWARDEDHEADERS_ENABLED` is set (read-only; the code handles both cases).
   4. Confirm the .NET runtime is 10.0.15 or later (Kudu: `dotnet --list-runtimes`).
   5. After the deploy, `curl -sI https://parish-life.org/` must show `max-age=31536000; includeSubDomains` and no `Server` header.
   6. Run the smoke test: `cd frontend && npm ci && SMOKE_URL=https://parish-life.org npx playwright test e2e/smoke.spec.mjs`.
   7. If the deploy happens after 23 November, change the effective dates (both languages) in `privacy.html`, `terms.html` and `cookies.html` (see 15).
   [03 C8, 02 B2/D8, 03 #2a, 08 E16/E17, 09 smoke, 06 E10]
2. **Tighten production access.**
   - Close any `az login` session on a machine where an AI tool runs.
   - Use a separate admin account with MFA.
   - Remove standing Cosmos data and Key Vault roles from people.
   - Set `disableLocalAuth` on Cosmos and turn storage-key access off (or at least rotate both keys).
   - Turn basic-auth publishing off.
   - Review role assignments, Colin's included.
   - Turn on Cosmos and Key Vault audit logs.
   - Turn on MFA on Cloudflare, Google, GitHub and Resend.
   - Delete any client secret left on the Entra app; keep only the `id-parishlife` federated credential.
   [08 E18, `docs/operations/production-access.md`; 02 D4, D6g]
3. **Prove backups.**
   1. Confirm Cosmos "Continuous (7 days)" and Blob plus container soft delete of 30 days.
   2. Run one point-in-time restore into `cosmos-parishlife-restoretest`, compare counts, record the time, then delete it.
   3. Decide the snapshot policy (U15). Recommended: monthly, encrypted disk, kept 3 months, with a quarterly drill.
   [08 E6, 01 Q8, 06 #3d/e]
4. **Deploy monitoring and caps.**
   1. `az deployment group what-if`, then `create`, with `infra/monitoring.bicep` (`alertEmail`, and `monthlyBudget` at about 1.5× last month's cost).
   2. Send a test alert from the action group.
   3. Check the logs: retention 90 days, IP masking not disabled, query strings `Redacted`.
   4. Set a daily ingestion cap of 0.15 GB.
   5. Caps elsewhere: Resend Free, Cloudflare Free, Google Cloud with no billing account (or a $1 budget), domain auto-renew on, a $0 Actions budget if the repository goes private.
   [08 E8–E11, 06 #3a–c, 01 Q7/Q9]
5. **Email.**
   1. Confirm the Cloudflare Email Routing rule for `privacy@parish-life.org` and send a test message. The MX, SPF and DMARC records exist (my `dig` today).
   2. Confirm the Resend domain shows Verified and send one live code.
   3. Then set the three `Email__*` settings so password reset appears.
   4. After 2–4 clean weeks, move DMARC to `p=quarantine`, then `p=reject`.
   [08 E12, 06 E2, 03 C4]
6. **Set the daily cap for code emails before turning Resend on** (QA bug 3). Recommendation: 10 per address per day. The failing test is ready to turn green. [09 G2, 09 #3]
7. **Decide photo metadata** (QA bug 2: published photos keep their GPS location). Recommendation: approve SkiaSharp (MIT) to re-encode uploads, which strips metadata and applies orientation. HEIC stays refused. [03 C3, 09 G3]
8. **Switch on CI/CD and protect `main`.**
   1. Create the deploy identity (role: Website Contributor on `app-parishlife` only). For staging, use a **separate** staging-only identity, not a second credential on the production one (N6).
   2. Create the GitHub environment `production` with required reviewers (you and Colin), branch `main`, the 3 secrets and 3 variables.
   3. Add a ruleset on `main`: pull request with one approval, the 5 named required checks, no force push or deletion.
   4. Turn on secret scanning and push protection.
   5. Set `PRODUCTION_DEPLOY_ENABLED=true` last.
   6. Follow the first-push checklist.
   7. In each clone, run `git config core.hooksPath .githooks` (needs gitleaks).
   8. Optionally, pin the actions to commit SHAs (N8).
   [08 E1–E5, E19, 02 D2 step 3, D9]

**Legal and content (needed for the pilot)**

9. **Give the operator's identity:** legal name, registered address, registration number and register. Fill the placeholder comments in privacy ("Who runs ParishLife") and terms ("About these terms") in both languages, and confirm or replace "Beirut, Lebanon". [06 E1, PROJECT_CONTEXT]
10. **Lawyer review** (licensed in Lebanon) of the published pages and `hardening/legal-drafts/*`. Cover:
    - whether a Law 81/2018 declaration and a health-data licence are needed (keep medical notes off until then if so);
    - minors aged 13–17;
    - liability (T8, your decision);
    - the withdrawal right for subscriptions;
    - religious-affiliation data.
    [06 E5]
11. **Product page.**
    - Confirm that you own `parishlife.app`. `hello@parishlife.app` still has no MX record (checked today); replace it with a `parish-life.org` address.
    - Confirm whose WhatsApp number +961 3 421 887 is.
    - Confirm the $19 and $49 monthly prices and the fixed 89,500 LBP rate, and write the subscription and refund terms (`refund-policy.md` part 2), or remove the prices until then.
    [06 E3, E4]
12. **Vendor data processing terms:** accept or download the DPA from Microsoft (Azure and Entra), Cloudflare, Resend and Google, and record the dates in `docs/operations/legal-pages.md`. [06 E6]
13. **Content to confirm.**
    - A native-speaker check of every Arabic sentence written by agents: the legal pages (06), the UI copy (05: errors, offline page, banners), and the integrator's sign-in messages.
    - Which texts, translations and images were made with AI.
    - The source and licence of each image in `frontend/public/assets/images/`.
    - Matthew 5:16: add the NRSV notice or use another translation.
    - The Maronite calendar dates in `src/lib/liturgy.js`.
    - Whether the demo parish, priest and phone number in `portal/model/data.js` and on the product page may stay (N7). Recommendation: replace them with obviously fictional ones, and delete the data no screen needs.
    - Whether the unused `church-light.jpg` and `church-interior.jpg` may be deleted.
    [06 E8, 05 #6, 05 E4, 01 Q1/Q2]
14. **Fill the draft placeholders:**
    - P5 operator countries;
    - P6 retention and operator snapshots;
    - P7 response time;
    - P12 and T11 notice period;
    - T6 abuse contact;
    - T12 settlement period and court;
    - T13 prevailing language;
    - retention per record type (owner question 15).
    [06 E7]
15. **Keep the policy version in step:** when the pages are published, set `AccountService.TermsVersion` to the effective date of the newest of privacy and terms. Today it records `2026-11-22` against a 23 November privacy page (N5). [06 E10, 10]
16. **Diaspora parishes:** confirm whether parishes in the EU, UK, US or Australia will use ParishLife. If yes: GDPR changes (privacy draft C2), an EU representative, a DPA with each parish, possibly a DMCA agent. [06 E11, 01 Q11]

**Decisions that can follow the pilot launch**

17. **Staging:** recommended yes, in the cheapest form. Then rehearse the rollback once and record the time. [08 E7, 08 #3 rollback]
18. **Edge and caching.**
    - Cloudflare proxy or WAF for the apex: recommendation is DNS-only for the pilot. If proxied, change the client-address trust in the same deploy (03 handoff 2), restrict App Service to Cloudflare's ranges and keep a reachable certificate.
    - A CDN for static files is the main lever on lab LCP.
    - HSTS preload: wait 1–2 weeks on the new header, then set `Preload = true` and submit.
    [03 C1/C7, 04 D2, 08 E15]
19. **Breached-password screening:** recommendation is yes, through the Have I Been Pwned range API (fails open; mention it in the privacy page). [03 C2]
20. **Disposable-email blocking** (recommended no) and an **admin IP allowlist** (recommended no). [03 C5, C6]
21. **Error tracking and real-user vitals:** recommendation is backend only for the pilot. Add Cosmos diagnostics (`DataPlaneRequests`, `QueryRuntimeStatistics`) when you want RU per request. [08 E13/E14, 04 D4]
22. **Pilot peak figure** (the load test assumes 40 visitors and 10 staff). Note the per-instance cache if you scale out. [04 D3/D5, 09 G5]
23. **Signed-in read cost** (repeated account and parish reads, per-row reads in 7 lists): defer until more parishes join. [03 C-S1, 04 #4/#5]
24. **Google Search Console and Bing:** add the domain property, submit the sitemap, and run the Rich Results Test on `landing.html` and `public.html`. [06 E9]
25. **Real browsers and devices.**
    1. Check Safari, iOS Safari and real phones (light and dark, EN and AR, dialogs above the toolbar).
    2. In real Firefox, open `public.html`, sign in, then reload the portal.
    3. If it does not hang, register the service worker from `portal/main.jsx` (05 #2, 08 #2).
    [05 E2/E3, 09 G4]
26. **Test tooling:** approve `@axe-core/playwright` as a dev dependency for CI (it turns today's 230/230 scratchpad result into a guard). Get the e2e job green on GitHub's Linux runner (certificate step), then make it a required check. [09 G1, 05 #4, 08 #3]
27. **Prerender the public and product page bodies** for crawlers and link previews that do not run JavaScript (QA bug 4). [06 B16, 09 #4]
28. **Upgrades:**
    - .NET 11, Aspire 17, Vite 8 and React 19.3 as planned tasks;
    - Prettier 3.10.1 as one format-only commit;
    - Playwright 1.65 with its browsers;
    - pin Node 26 LTS (`engines` and `.nvmrc`).
    [02 D7, D9, D11]
29. **Repository housekeeping:**
    - Do not rewrite history.
    - Fetch and scan every remote and Colin's repository with gitleaks.
    - Retire the old Cloudflare Worker and D1 database.
    - Never reuse a fixture password.
    - Keep only `parish-life.org` in the Turnstile widget's hostnames.
    [02 D1, D2, D3, D5, D10]
30. **UI choices:** one icon set or three; whether new accounts follow the device's dark-mode setting; review the darker field edges and alpha dividers. [05 E4–E6]

---

## E. Leaked secrets

No real secret was ever committed, on any branch. Re-checked today:
- `gitleaks git --redact --log-opts=--all`: 345 commits, no leaks;
- merge commits (first parent): 43 commits, no leaks;
- `gitleaks dir` of the worktree: no leaks.

There are 388 commits on 79 refs. 02's table of non-secret hits stands:

| # | Type | Name | File | Commit | Verdict | Rotation status |
|---|---|---|---|---|---|---|
| 1 | PEM key (localhost dev certificate) | — | `frontend/.cert/localhost.key` | never committed (ignored) | local dev artifact | not needed |
| 2 | Turnstile site and secret key | `TestSiteKey`, `TestSecretKey` | `ParishLife.EndToEnd/EndToEndFactory.cs` | present at HEAD | Cloudflare's published dummy keys | not needed |
| 3 | Google client id and secret | `ExternalSignIn:google:*` | same file | present at HEAD | self-describing stand-ins | not needed |
| 4 | Google OAuth client id (production) | — | `docs/operations/frontend-hosting.md` | present at HEAD | public identifier | not needed |
| 5 | Azure resource identifiers | `Cosmos:Endpoint` etc. | `ParishLife.Api/appsettings.json` | present at HEAD | not secrets (RBAC needed) | not needed |
| 6 | Test passwords | `FixturePassword` etc. | test projects | present at HEAD | throw-away local fixtures | never reuse (D29) |
| 7 | Demo password (old prototype) | `DemoPassword` | `src/ParishLive.Infrastructure/Data/SeedIds.cs` | `4ec733b`, `776991f` (old branches only) | demo fixture | not needed unless reused |
| 8 | Test passwords (old prototype) | `password` etc. | `backend/test_accounts.py`, `…browser.mjs` | Oct 2026 prototype branches | fixtures | not needed |
| 9 | Cloudflare D1 id | `database_id` | `wrangler.jsonc` | old branches | identifier | retire the Worker (D29) |
| 10 | Dummy subscription id | — | `tools/tests/Initialize-Cosmos.Tests.ps1` | present at HEAD | all 1s, mocked | not needed |
| 11 | Pattern hits | — | prose and test names | various | false positives | not needed |

Live secrets, all held in Key Vault only and never committed: `turnstile-secret-key`, `google-client-secret`, `resend-api-key`, the Data Protection key ring and the Application Insights connection string. The rotation runbook is in 02's report §D6. Cosmos and storage account keys are unused by the app; rotate or disable them (D2).

---

## F. Legal risk register (from Agent 06, re-checked)

| Risk | Law or reason | Likelihood / impact | Status today (my check) | Action |
|---|---|---|---|---|
| Privacy contact unreachable | Law 81/2018 rights need a working channel | was High / High | **Lowered:** MX, SPF and DMARC exist (my `dig`); the routing rule is unconfirmed | D5 |
| No declaration or licence (health data) | Law 81/2018 | Medium / High | open | D10 |
| Prices with no subscription or refund terms or seller | Consumer Protection 659/2005 | Medium / Medium | open; prices still in `Landing.jsx` | D11 |
| Operator not identified | Law 81/2018, contract law | High / Medium | open; placeholders only | D9 |
| Product-page contact on an unverified domain | misdirected personal data | Medium / Medium | open; `parishlife.app` has no MX today | D11 |
| Religious affiliation and children's records at scale | Law 81 sensitive categories; GDPR Art. 8/9 if EU | Low now / High | open (diaspora question) | D16 |
| No vendor DPAs | Azure, Cloudflare, Resend, Google, Microsoft | Medium / Medium | open | D12 |
| Image licences unknown | Law 75/1999, Unsplash licence | Medium / Medium | open | D13 |
| NRSV quotation without notice | NCC terms | Low / Low | open | D13 |
| Brand use on sign-in buttons | provider guidelines | Low / Low | open | 05 styling |
| Open-source obligations | MIT, ISC, OFL, GSAP licence | Low / Low | OK; licence files ship | — |
| User-generated content | liability | Low / Medium | reporting process published | — |
| Minors 13–17 accept terms | capacity to contract `[COUNSEL]` | Medium / Low | open; the 13+ box is enforced on the server | D10 |
| **New:** invented names and phone number in shipped bundles and on the product page | project rule; misleading or personal data | Low / Low | open (N7) | D13 |
| **New:** the recorded policy version does not match the current privacy text | consent records | Low / Low | open (N5) | D15 |
| **New:** AI-written Arabic legal and UI text unreviewed | accuracy of notices | Medium / Medium | open | D13 |

---

## G. Performance (from Agent 04, re-measured where I could)

| Measure | 04 before | 04/09 after | My measurement (`70959fd`, local Debug host, Turnstile off) |
|---|---|---|---|
| Portal entry script | 1,674.55 KB min (486 KB gzip), uncompressed on the wire | 616 KB min (196 KB gzip), Brotli on the wire | `npm run build`: `portal-BII8aKyi.js` 615.04 KB (195.69 KB gzip); Host: served `Content-Encoding: br` |
| Homepage / parish page API requests (20 parishes) | 151 / 156 | 71 / 35 | not re-measured (needs 04's 20-parish script) |
| Directory read cost | 3+1 (1 parish), 23+1 (11) | 1+3 first read, 0 when cached | Suite: `RequestCostTests` passed |
| Lighthouse | see 04 §C | see 09 §E | Mobile P/A/BP/SEO (LCP, CLS, TBT); desktop P/A/BP/SEO: sign-in 74/100/79/63 (4.80 s, 0.000, 140 ms), 99/100/78/63; public 82/100/79/100 (3.79 s, 0.000, 199 ms), 99/100/78/100; parish page (fixture parish, nothing published) 85/100/79/100 (3.69 s, 0.000, 104 ms), 100/100/78/100; landing 79/96/100/100 (4.35 s, 0.000, 22 ms), 99/96/100/100; privacy 99/100/100/100 (1.68 s), 100 all; terms 99/100/100/100 (1.68 s), 100 all; cookies 96/100/100/100 (1.68 s, CLS 0.097), 98/100/100/100. Within noise of 09's run. SEO 63 on sign-in is the deliberate noindex; BP 78–79 is the fixture's 401/404 console messages. |
| k6 pilot / 10× | p95 109 / 661 ms, 0 errors | 09: p95 147 / 930 ms, 0 errors | pilot: 61 req/s, 0 errors, p95 131 ms (visitors 86, staff 164); 10×: 469 req/s, 0 errors of 58,107, p95 1.21 s (visitors 541 ms; **staff 1.83 s, threshold 1.5 s crossed**; Debug build, same machine as k6) |

Lab mobile LCP still misses 2.5 s on the sign-in, public and product pages (no CDN; client rendering). CLS passes. Field Core Web Vitals need real-user monitoring (D21).

---

## H. Test results (all run by me on `70959fd`)

| Check | Command | Result |
|---|---|---|
| Backend build and tests | `dotnet test ParishLife.slnx` | exit 0. `ParishLife.UnitTests` **99 passed, 0 failed**. `ParishLife.IntegrationTests` **532 passed, 2 skipped, 0 failed of 534** (2 m 2 s). The AppHost built. |
| Known-failure tests run for real | `QA_KNOWN_FAILURES=1 dotnet test ParishLife.IntegrationTests --filter …` | `A_published_photo_is_served_without_its_location_metadata` **failed** (bug 2 open); `Code_emails_to_one_address_stop_at_a_daily_cap` **failed** (bug 3 open); `Sign_in_takes_as_long…` **passed** (bug 1 fixed) |
| Frontend | `npm ci`, `format:check`, `check`, `check:routes`, `build` | all exit 0. Routes: 642 API routes, 634 matched, 2 known gaps, 0 new |
| End-to-end | `E2E_PORT=7410 E2E_CHANNEL=chromium npm run e2e -- --no-build` | **42 passed (5.9 min)**, including the expected failure of "public pages show their content without JavaScript" (bug 4) |
| npm audit | `npm audit` | 0 vulnerabilities |
| NuGet audit | `dotnet list ParishLife.slnx package --vulnerable --include-transitive` | no vulnerable packages in 6 projects |
| Secret scan | gitleaks 8.30.1 (`git --all`; merges first-parent; `dir`) | 345 + 43 commits, worktree: no leaks |
| Commit-message hook tests | `sh tools/tests/commit-msg.Tests.sh` | 14/14 |
| axe-core 4.14.1 (from the npm cache) | 09's `a11y-scan.mjs` on the local host | **230 of 230 page states clean** (public pages EN/AR, every screen of 8 roles, priest also in dark mode) |
| Lighthouse 12.8.2 (`npx --offline`) | 09's `lh.sh`, 7 pages × mobile/desktop | see section G (mobile performance 74–99, accessibility 96–100, SEO 63 only on the noindex sign-in page) |
| k6 2.4.0 | `tools/load/parishlife.k6.js`, local host | pilot: all thresholds met, 0 of 7,313 failed. 10×: 0 of 58,107 failed, visitors met, **staff p95 1.83 s failed the 1.5 s threshold** (exit 99) |
| Attack and header requests | curl to the local host | security headers present and no `Server` header; `/api` uncompressed and `no-store`; foreign `Host` → 400; CORS preflight gets no allow header; 5 protected paths → 401; POST without CSRF → 400; unknown parish → 404; sitemap 200; `?track` → `X-Robots-Tag` |
| Production (read-only) | 3 HEAD requests | pre-hardening build still live (`Server: Kestrel`, HSTS 30 days, Google Fonts in CSP, robots 404) |

**Browsers, devices and networks:**
- Chromium desktop: e2e and axe.
- Chromium emulation of Pixel 7, iPhone 14 and iPad Mini: e2e `devices.spec.mjs`.
- Slow 3G and 4G, offline, and a hung request: e2e `network.spec.mjs`.

**Not tested, and why:**
- **Safari and iOS Safari:** Playwright's WebKit crashes at launch on this macOS, so they do not count as tested.
- **Firefox:** I did not re-run it (05's layout script used it).
- **Real phones:** none available.
- **Real Cosmos, Blob or Key Vault behaviour:** local storage only, by rule.
- **The GitHub pipeline:** never pushed.
- **Bicep:** no CLI.
- **Google Rich Results:** offline.
- **The 20-parish request counts:** not re-measured.
- **08's local restore drill:** I did not repeat it.

---

## I. Rollback plan and backup-restore result (from Agent 08, confirmed as written)

**Rollback** (`docs/operations/deployment-and-rollback.md`; I read it; it has never been rehearsed):
1. Find the last good `main` commit.
2. Either: Actions → CI → that run → **Re-run all jobs** → approve "Deploy to production".
3. Or: `az webapp deploy -g rg-parishlife -n app-parishlife --src-path parishlife-<commit>.zip --type zip --clean true`, using the run's package artifact (kept 90 days).
4. Check `/health/ready`, sign in once, and look at Application Insights failures.
5. For a bad setting, remove it and restart.
6. Data needs no step under the expand-then-contract rules. Never replace the key ring.
7. Rehearse on staging (D17).

Until CI is switched on (D8), the manual `tools/Publish-ParishLife.ps1` path remains. Keep the previous zip from every deploy.

**Backup restore:**
- **Local drill only** (08, 22 November 2026): 148 records exported, verified, dry-run and restored into an empty local store, with identical counts and SHA-256 per container. Catalog had exactly one added restore-audit row, as designed.
- Not exercised: evidence files, Cosmos and Blob. I did not repeat the drill.
- The Azure point-in-time restore has **never been tested** (D3).

---

## J. Unhandled handoffs between agents

Each handoff with its status as I found it in the code on `70959fd`.

| From → to | Item | Status |
|---|---|---|
| 02 → 03 | #1 config checks, #2 silent catches, #4 unreferenced types | Done (verified: tests and code) |
| 02 → 05/03 | #3 frontend silent catches | Done |
| 02 → 04/03 | #5 duplicated helpers | Done for scopes and conditions (`f604c3c`). **Open:** `Guard.OptionalText`, shared `NotFound`, the single token-hash helper (optional, Low) |
| 02 → 08 | #6 CI audit and scan | Done (`ci.yml`) |
| 02 → 01 | #7 map correction | Done |
| 03 → 08 | #1 alerts | Done in Bicep, **not deployed** (owner, D4) |
| 03 → 08 | #2 client address, #3 HTTP/2 and WAF | Owner steps (D1, D18) |
| 03 → 05 | #4 UI review, #8 silent catches | Done |
| 03 → 06 | #5 wording | Done |
| 03 → 09 | #6 tests, S4 | Done |
| 03 → 04 | #7 document type | Done |
| 03 → 05 | S1 print fonts, S2 static sitemap, S3 FYI | Done (verified: `print.js`, no `public/sitemap.xml`) |
| 04 → 03 | #1 compression, #3 batched directory, #6 cache headers and `[PublicCache]` | Done (verified) |
| 04 → 03 | **#4 repeated reads, #5 N+1 lists** | **Deferred** by decision (03 C-S1; D23) |
| 04 → 03 | #7 Cosmos option | Not applicable (optional) |
| 04 → 03 | #11 shared helpers | Done (see 02 #5) |
| 04 → 05 | #2 route splitting, #8 double-click delete, #9 images and heads | Done (verified) |
| 04 → 09 | #10 load test | Done |
| 05 → integrator | #1 merge | Done (05 is merged; `legal-seo` passes) |
| 05 → 08 / owner | **#2 portal service-worker registration** | **Open, deliberately:** waits for a real-Firefox check (D25). 08 #2 is the same item. |
| 05 → 03 | #3 keep `og:image` on parish pages | Done in effect: the head rewrite leaves the `og:image` tags untouched |
| 05 → 09 | #4 tests | Done (kept). axe in CI is an owner decision (D26) |
| 05 → 04 | **#5 re-measure LCP on the merged state** | Done by 09's Lighthouse run; mine in G |
| 05 → 06 | **#6 review the copy and the Arabic written by 05** | **Not handled** by 06 (06 ran before 05). Owner native-speaker check (D13) |
| 06 → 03 | #1, #2, #5–#8 | Done (verified) |
| 06 → 08 | #3 log facts | Done as docs; Azure facts are owner steps (D4); the policy sentence was added by the integrator (`226b61a`) |
| 06 → 05 | #4 print fonts, #9 copy | Done |
| 06 → 08 | #10 DNS facts | Done |
| 06 → 09 | #11 tests | Done |
| 08 → integrator | #1 release tag | Done (`a7c93eb`; `TelemetryReleaseTests` passes) |
| 08 → 05 | #2 service worker | Open (same as 05 #2) |
| 08 → 09 | **#3 e2e on the Linux runner** | **Not verified:** 09 made the suite offline with a key-pinned certificate (which should work on Linux), but the GitHub job has never run (D26) |
| 08 → 06 | #4 log wording | Done by the integrator (`226b61a`) |
| 08 → 06 | #5 MX FYI | Done |
| 08 → 01 | #6 map | Done (`226b61a`) |
| 09 → 03 | #1 timing | Done (`70959fd`); residual N3 |
| 09 → 03 | **#2 EXIF, #3 daily code cap** | **Open:** owner decisions (D6, D7); tests still fail for real |
| 09 → 05/06 | **#4 no body without JavaScript** | **Open:** prerender decision (D27) |
| 09 → 05 | #5 Arabic sign-in errors, #6 time-out | Done (`70959fd`); residual N2 for #6 |
| 09 → 03 | #7 directory canonical | Done (`70959fd`; e2e passes); residual N1 in the same file |
| 09 → 08 | smoke command | Recorded in 09's report; not yet in a runbook step. Included in D1.6 |
| 10 (new) | N1–N8 | Sent back to the agents named in section C |

---

## K. Integrator addendum (after the audit, 23 November 2026)

The audit above was written on `70959fd`. The integrator then fixed the new findings where the fix sat inside the repository, in `81e4de4`. Each fix has a test that fails on the old code and passes on the new.

| Finding | Now | Evidence |
|---|---|---|
| N1 regex substitution in the parish page head | Fixed: match evaluators | `SecuritySweepTests` publishes Mass times containing `$_ $' $&` and finds them encoded and verbatim in the description |
| N2 a timed-out write can be repeated | Mitigated: a timed-out write now says it may already be saved and asks for a reload before retrying; the wrong comment is corrected. Residual: a retry still sends a new operation id. Reusing it would mean changing every module's save path. | `frontend/src/portal/model/api.js` |
| N3 timing for locked or unconfirmed accounts | Fixed: they pay the dummy-hash cost too | `Sign_in_takes_as_long_for_an_unknown_address_as_for_a_wrong_password` now also times a locked account and compares fastest runs with a 25 ms margin. It passed 3 of 3 under parallel load and fails on the old code (49.0 ms vs 0.4 ms). |
| N4 closure ignores ministry leaders | Fixed: a current or future leader appointment blocks closure | `Closure_is_refused_while_the_account_leads_a_ministry` (fails without the fix) |
| N5 terms version behind the privacy page | Fixed: `2026-11-23`. D15 is done for now, and still applies to future policy changes. | `AccountService.TermsVersion` |
| N6 staging could share the production deploy identity | Fixed in the runbook: staging-only identity; environment-scoped names only | `docs/operations/deployment-and-rollback.md`, staging step 7 |
| N7 demo records in the bundles | Partly fixed: the real-looking phone number is removed and no built bundle contains it. The demo parish, the priest's name and the town stay; that is a content decision (added to D11 and D13). | `grep "461 220" frontend/dist/assets/app/*.js`: no match |
| N8 CI actions pinned by tag | Fixed: all 18 `uses:` lines are pinned to the commit behind their tag on 23 November 2026 | `.github/workflows/ci.yml` |

Still open on purpose, all already in section D:
- QA bugs 2 (D7), 3 (D6) and 4 (D27).
- 04 #4/#5 (D23).
- Registering the service worker from the portal (section J). Agent 05 saw headless Firefox hang on a portal reload with the public worker active. Do a real-Firefox check first (D25), then add the one line in `frontend/src/portal/main.jsx`.

Checks on `81e4de4`, run by the integrator:
- **Backend** (`dotnet test ParishLife.slnx`): unit 99/99; integration 533 passed, 2 skipped (the `[KnownFailureFact]` tests for QA bugs 2 and 3), 0 failed.
- **Frontend:** `format:check`, `check`, `check:routes` (634 matched, 0 new gaps) and `build` pass.
- **e2e** (`E2E_CHANNEL=chromium npm run e2e`): 42 passed in 6.0 min, including the expected failure for QA bug 4.
