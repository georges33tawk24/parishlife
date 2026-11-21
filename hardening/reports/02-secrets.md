# Agent 02: Secrets and dependencies report

Part A (history scan and key rotation) was done on 21 November 2026 from `fullstack-hardening` at `abf17e3`. Part B (Wave 1) was done the same day from `5473d36`. Both are on branch `hardening/02-secrets`. No secret value appears anywhere in this report.

## A. Summary

- I scanned every commit reachable from every ref with gitleaks 8.30.1. That is 281 commits on 72 refs: 9 local branches and 63 `refs/remotes/origin/*` branches. There are no tags and no `refs/remotes/upstream/*`. Commit dates run from 24 July to 21 November 2026.
- I also scanned the current tree and the main checkout, including its ignored build output.
- Then I searched by hand for what gitleaks can miss: config files, key files, key rings, `.env`, connection strings, SAS tokens, OAuth, Turnstile and Resend secrets, cookies and tokens, and committed bundles.
- **No real secret was ever committed, on any branch.** Every hit was a published test key, a stand-in, a test password, a public identifier, or prose.
- Because nothing leaked, no key has to be rotated. Rewriting history is not worth doing.
- Six Part A owner actions remain. They are housekeeping and confirmation, not emergency rotation (section D, items 1 to 6).
- **Part B: dependencies.** Neither npm nor NuGet reports a known vulnerability. I upgraded 15 packages (5 npm, 10 NuGet) to their latest patch or minor version:
  - frontend: React, React DOM, Vite, GSAP and Lenis;
  - backend: the ASP.NET Core, EF Core and cryptography packages from 10.0.14 to 10.0.15 (the November .NET security release), plus the Azure SDK packages and the test SDK.
  - The lock files were regenerated, and `--locked-mode` restore passes.
- **Part B: configuration.** I added `.env.example`, configuration checks that stop a half-configured or unresolved Key Vault secret from failing silently (03 wires them in), stricter `.gitignore` rules, and a gitleaks pre-commit hook.
- **Part B: production.** Read-only checks of production found no exposed files and no source maps. Every direct dependency is a real, long-lived package from its official publisher.
- **Part B: decisions for you.** Major upgrades, Playwright and Prettier are recorded as decisions (section D, items 7 to 11). Problems in other agents' files went out as handoffs (section E).

## B. Item table

| Item | Status | Severity | What I found | What I changed (files) | How I verified it |
|---|---|---|---|---|---|
| A1. Scan all history, every branch and tag, plus the working tree, config, notebooks, logs, fixtures and build output | Already OK | — | gitleaks found no leaks: 0 findings in 250 non-merge commits, and 0 in the 31 merge commits (scanned against their first parent, because plain `git log -p` skips merge diffs). `gitleaks dir` found 0 in the worktree. In the main checkout, including ignored `bin/`, `obj/` and `frontend/dist/`, it found 1 local-only dev-certificate key (row 1 in C). The hand search covered every path that ever existed, 2,464 in all. No `.env`, `.pfx`, `.p12`, `.pem`, `.key`, `key-*.xml` key-ring file, `secrets.json`, `.publishsettings`, `.pubxml`, `bin/`, `obj/`, `dist/`, log, dump or notebook was ever committed. The only committed bundles are a prototype build in `assets/app/*.js` (branch `frontend-new2` only) and vendored libraries under `src/ParishLive.Web/wwwroot/lib`; both are clean. | `hardening/reports/02-secrets.md` (this report) | Commands and result files are listed under "How the scan was done" below |
| A2. For each finding: type, name, file, commit, still present, live or not | Already OK | Low | See C. None of them is a live secret. | — | Each hit was checked against its context, without printing any value |
| A3. Revoke and replace compromised keys | Not applicable (no compromised key). Rotation runbook given | — | Nothing that was ever committed needs rotating. Section D gives a runbook for the live secrets (Google client secret, Turnstile secret key, Resend API key, Data Protection key ring, Entra app) to use if exposure is ever suspected. | — | — |
| A4. History rewrite: worth it? what breaks? | Needs your action (decision; recommendation: do not rewrite) | Low | There is nothing to purge, so a rewrite would cost a lot and gain nothing. See D, item 1. | — | — |
| B1. Hide API keys from the client | Already OK | — | The frontend reads no environment variables: no `import.meta.env`, no `VITE_`, `REACT_APP_` or similar prefix. Every third-party call that needs a secret is made by the server: Turnstile verification, Resend, the Google OAuth code exchange, and the Microsoft code exchange (which uses a managed-identity assertion). The only key the browser receives is the Turnstile **site key**, which is public by design. Cloudflare limits it to the hostnames listed in the widget (hostname check: see D, item 10). Mobile apps and public folders: Not applicable, because there is no mobile build; `frontend/public` holds only fonts, images, the manifest and `sw.js`. | — | `gitleaks dir frontend/dist`: no leaks. A grep of the built bundle for secret formats (Resend, Google, Turnstile secret, `AccountKey=`, SAS): 0 hits. `find dist -name '*.map'`: none. |
| B2. Environment variables: `.env.example`, startup validation, client prefixes | Fixed (validation wiring handed to 03) | Medium | No `.env.example` existed. The core settings (Cosmos, Azure identity, Blob, Data Protection) were already checked at startup with `ValidateOnStart`, and Local storage is refused outside Development. The optional secret-bearing features (Turnstile, Resend, external sign-in) had no check. Setting one Turnstile key without the other switched the bot check off silently. An unresolved App Service Key Vault reference arrives as the literal text `@Microsoft.KeyVault(...)`, which counted as "configured" and would break sign-in or email at run time. Secrets are read only on the server, and none uses a client prefix. Development and production use separate values: Development uses Local storage with no Azure settings, and production values exist only in App Service. There is no staging environment (owner question 26). | `.env.example` (new: every setting name, placeholders only, SECRET markers and Key Vault reference shape). `Api/Configuration/AzureConfiguration.cs` (`IsUnresolvedKeyVaultReference`). `TurnstileOptions.cs`, `EmailOptions.cs` and `ExternalProviderOptions.cs` (`ConfigurationProblem`: messages name the setting, never its value). New test `ParishLife.UnitTests/ConfigurationProblemTests.cs`. Handoff 1 asks 03 to call the checks at registration. | 4 new unit tests pass, including one proving that no message echoes a secret. The fail-fast behaviour starts once 03 applies handoff 1. |
| B3. `.gitignore` and pre-commit scanner | Fixed | Medium | `.gitignore` already covered `.env`, `.env.*` (with `.env.example` allowed), `*.pfx`, `*.pem`, `*.key`, `*.p12`, `*.snk`, `.parishlife-data/`, `frontend/.cert/`, `frontend/dist/`, `bin/` and `obj/`. It did not cover Data Protection key-ring files, publish profiles, a copied `secrets.json`, certificates, key stores, local databases, dumps, backups, `*.log`, HAR captures, or `ParishLife.Api/wwwroot/`. There was no pre-commit scanner. Section 16 of the project map says that `docs/REMAINING-WORK.md` and `docs/frontend-integration.md` are ignored, but no rule ignores them (handoff 7). No real secret is in the current tree (Part A). | `.gitignore` (new rules: `key-*.xml`, `*.publishsettings`, `*.pubxml`, `*.pubxml.user`, `secrets.json`, `*.cer`, `*.crt`, `*.der`, `*.jks`, `*.keystore`, `*.ppk`, `*.db`, `*.sqlite`, `*.sqlite3`, `*.bak`, `*.dump`, `*.log`, `*.har`, `ParishLife.Api/wwwroot/`). New `.githooks/pre-commit`, which runs `gitleaks git --pre-commit --staged --redact` and refuses the commit if gitleaks is missing. | `git ls-files -ci --exclude-standard`: no tracked file is newly ignored. `git check-ignore`: `.env.example` stays tracked. I tested the hook in a scratch repository: a clean commit exits 0, and generated fake keys exit 1 with 2 redacted findings. It is not switched on for this shared clone, because `core.hooksPath` would affect the other agents (D, item 9). |
| B4. Confirm replaced keys work | Not applicable | — | No key needed rotating (Part A), so there is nothing to confirm. There is no staging environment, and I may not sign in to production. If you ever rotate a key with the section D runbook, check `GET /api/auth/capabilities` and do one test sign-in. | — | — |
| B5. Dependency audit | Fixed | Low | `npm audit`: 0 vulnerabilities before and after. `dotnet list package --vulnerable --include-transitive`: no vulnerable packages in any of the 6 projects. Nothing was critical or high, so I only applied safe patch and minor upgrades (section F). .NET 10.0.15 (10 November 2026) is a security release with 16 CVEs. The runtime packages now match it. Production runs on App Service's runtime, so confirm it there (D, item 8). Abandoned packages: none (B9). | `frontend/package.json`, `frontend/package-lock.json`, `ParishLife.Api/ParishLife.Api.csproj`, the three test project files, and all five changed `packages.lock.json` files | `dotnet restore ParishLife.slnx --locked-mode`: OK. `npm audit`: 0. The backend suite and frontend checks pass (see "Checks run"). |
| B6. Remove unused packages and code | Needs your action (handoffs sent; nothing deleted by me) | Low | **Packages:** every npm dependency is imported (Prettier through its CLI), and every NuGet package is used. The direct `System.Security.Cryptography.Pkcs` and `.Xml` references are deliberate pins of serviced transitive packages. Nothing to remove. **Frontend files:** none unreferenced. **API types nothing refers to:** `Models/AttendanceCorrection.cs`, `Models/ClergyAppointment.cs`, `Models/MinistryRules.cs` and `DTOs/Ministries/AttendanceGridDto.cs`. They are 03's files, so the ownership table says 02 proposes and the owner deletes (handoff 4). The unused `Finance`/`RestrictedCases`/`Publishing` mappings and `frontend/src/portal/model/data.js` belong to 04, as already noted in the project map. No commented-out code that exposes internals was found. | — | A reference count over every C# type in the API against the API, tests, frontend and docs. Controllers and extension classes, which are found by reflection, are excluded. |
| B7. Exposed files check | Already OK | — | The build output `frontend/dist` holds only the 5 HTML pages, `sw.js`, `site.webmanifest` and assets. There are no source maps, test pages or admin pages. The publish script already refuses a package with tests, AppHost, tools or keys. On production, 7 read-only GETs returned: `/.env` 404, `/.git/HEAD` 404, `/appsettings.json` 404, `/ParishLife.Api.deps.json` 404, `/web.config` 404, `/assets/app/react.js.map` 404, and `/openapi/v1.json` 401 (the signed-in-only exposure is 03's item, urgent observation 4 in the map). | — | `curl` GETs on 21 November, all 0-byte responses |
| B8. Production debug mode | Already OK | — | `Program.cs` uses `UseExceptionHandler` with `ApiExceptionHandler`. Users get a fixed title or code and a trace ID, while the server log records the exception type only. There is no `UseDeveloperExceptionPage`, `EnableSensitiveDataLogging` or detailed-errors flag. HSTS is on outside Development. Vite builds without source maps. The frontend source has one `console.warn` (a deliberate developer warning) and the bundle has no `console.log`. The test host (`ParishLife.EndToEnd`) is not published. No accounts are seeded. | — | grep of the API and the built bundle, and the production checks in B7 |
| B9. Packages that don't exist (typosquats) | Already OK | — | Every direct dependency exists under the expected publisher, with long histories. **npm:** `react`, `react-dom` (fb, react-bot, 2011/2014), `vite`, `@vitejs/plugin-react` (yyx990803, vitebot), `gsap` (greensock, 2014), `lenis` (darkroomengineering, 2023, 122 versions), `@playwright/test` (Microsoft), `prettier` (2017). **NuGet:** all 15 packages are owned by Microsoft, `azure-sdk`, `aspnet`, `aspire`, `AppInsightsSdk` or `xunit`, and all carry the verified-owner badge. The least-downloaded is `Microsoft.OpenTelemetry` (about 0.4 million downloads, owners `AppInsightsSdk` and `Microsoft`, verified), which is the Azure Monitor distribution, as expected. None looked doubtful. | — | Read-only queries to `registry.npmjs.org` and `azuresearch-usnc.nuget.org` / `api.nuget.org` |
| B10. Outdated framework and runtime | Fixed (patch and minor); majors are decisions | Medium | See the version table below. I upgraded the patch and minor versions. The majors are recorded as decisions: .NET 11 packages, Aspire 17, Vite 8 with plugin-react 6, and React 19.3 (optional minor). The SDK pin `10.0.401` with `rollForward: latestPatch` already builds with 10.0.404. I left `global.json` alone so that machines with older 10.0.40x SDKs still build. The Node version that builds the frontend is not pinned, and this machine runs Node 25, a non-LTS line past its end of life. Building needs Node 26 LTS (D, item 11). No container images are used. | Same files as B5 | Builds and tests in "Checks run" |
| B11. Code that hides bugs | Needs your action (all in other agents' files; handoffs sent) | Low | **API:** 3 swallowed errors: `NotificationOutcomeReader.cs` line 35 (no log), `CertificateService.cs` line 348 and `ServicePlanService.cs` line 310 (unfiltered `catch (DomainException) {}`). The other `catch ... when (...) {}` blocks are deliberate control flow, and the bare `catch { release; throw; }` blocks rethrow. **Frontend:** 7 silent `.catch(() => {})` or `catch {}` (handoff 3). **Debug logs:** none in the API (`Console.Write` 0) or the bundle. **Duplicated helpers:** 20 groups, the largest being about 52 copies of the parish `RecordScope` literal (handoff 5). **Comments that restate the line below:** spot-checked only. The files I touched carry the purpose comments the project rules require, and I found no bulk restating comments to remove. My own files had no empty catch, debug log or duplicate. | — (handoffs 2, 3 and 5) | grep and a duplicate-expression scan over `ParishLife.Api` and `frontend/src` |

### Checks run for Part B (exact results)

- `dotnet restore ParishLife.slnx --locked-mode`: OK, with the regenerated lock files.
- `dotnet test ParishLife.slnx` gave **554 of 554 passed**: unit tests 68 of 68 (64 before plus my 4 new ones), integration tests 486 of 486.
  - `ParishLife.AppHost` did not build on this machine, with error ASPIRE009. The Aspire CLI bundle downloads itself during the build, and that download timed out after 120 s.
  - It is not caused by my change: neither the AppHost project nor its lock file changed. The baseline checkout has no AppHost build output either.
  - I did not install the Aspire CLI, because the run rules forbid installing tools.
- `cd frontend && npm ci && npm run format:check && npm run check && npm run build`: all pass. `npm audit`: 0 vulnerabilities.
- `E2E_CHANNEL=chromium npm run e2e`: **12 of 13 passed** (7.2 min), the same as the baseline. The only failure is "public pages load signed out", the known environment problem: this machine does not trust the local HTTPS certificate, so Chromium refuses to fetch the service-worker script.

### Version table (current to latest patched)

| Component | Before | Now | Latest | Action |
|---|---|---|---|---|
| .NET SDK (`global.json`) | 10.0.401, `latestPatch` | unchanged (10.0.404 used) | 10.0.404 | none; see B10 |
| .NET runtime packages (`Microsoft.AspNetCore.OpenApi`, `Microsoft.EntityFrameworkCore.Cosmos`, `System.Security.Cryptography.Pkcs/Xml`, `Microsoft.AspNetCore.Mvc.Testing`) | 10.0.14 | **10.0.15** (security release) | 11.0.0 | .NET 11 is a decision (D, item 7) |
| `Microsoft.Azure.Cosmos` | 3.63.2 | **3.64.0** | 3.64.0 | upgraded (minor) |
| `Azure.Storage.Blobs` | 12.30.1 | **12.30.2** | 12.30.2 | upgraded |
| `Azure.Extensions.AspNetCore.DataProtection.Blobs` / `.Keys` | 1.5.3 / 1.6.3 | **1.5.5 / 1.6.5** | same | upgraded |
| `Azure.Identity`, `Microsoft.OpenTelemetry`, `xunit`, `xunit.runner.visualstudio` | 1.21.0, 1.2.0, 2.9.3, 4.0.1 | unchanged | same | current |
| `Microsoft.NET.Test.Sdk` | 18.11.0 | **18.12.0** | 18.12.0 | upgraded (minor) |
| `Aspire.Hosting.AppHost` / SDK | 13.6.5 | unchanged | 17.0.0 | major: decision (D, item 7) |
| React / React DOM | 19.2.0 | **19.2.9** | 19.3.1 | 19.3 minor is optional (D, item 7) |
| Vite | 7.3.7 | **7.3.8** | 8.3.8 | Vite 8 major: decision |
| `@vitejs/plugin-react` | 5.2.0 | unchanged | 6.3.0 | major, goes with Vite 8 |
| GSAP / Lenis | 3.15.0 / 1.3.26 | **3.15.1 / 1.3.27** | same | upgraded |
| Prettier | 3.9.10 | unchanged | 3.10.1 | reformats 33 files: decision (D, item 9) |
| `@playwright/test` | 1.56.1 | unchanged | 1.65.1 | needs matching browsers: decision (D, item 9) |
| Node.js (build tool only) | not pinned; machine runs 25.6.0 | unchanged | 26.13.1 LTS | D, item 11 |
| Container base images | none | — | — | Not applicable |

### How the scan was done (reproducible; result files are in the session scratchpad, never in the repository)

Every command below was run with `--redact`, and each wrote a JSON report to the scratchpad folder `02-secrets/`.

- `gitleaks git --log-opts="--branches --remotes --tags" --redact .`
  - 250 commits, about 58 MB. Result: no leaks.
- `gitleaks git --log-opts="--branches --remotes --tags --merges --diff-merges=first-parent" --redact .`
  - 31 merge commits. Result: no leaks.
- `gitleaks dir --redact <worktree>`
  - Result: no leaks.
- `gitleaks dir --redact parishlife-fullstack`
  - The main checkout, including ignored build output.
  - Result: 1 finding, the local dev-certificate key (row 1 in C).
- Hand checks across all 281 commits, using `git grep -l` and `git log -p`. Every value was classified by shape (empty, placeholder, URL, GUID, high-entropy) by a script that prints only the key name.
  - **File types:** `appsettings*.json`, `launchSettings.json`, `wrangler.jsonc`, `.claude/launch.json` and `.github/workflows/verify.yml`. CI uses no `secrets.*`.
  - **Storage and Cosmos credentials:** `AccountKey=`, `SharedAccessSignature=`, `SharedAccessKey=`, `sig=` and `AccountEndpoint=…;AccountKey`.
  - **Application Insights:** `InstrumentationKey=`.
  - **Provider key formats:** Resend (`re_…`), Turnstile secrets (`0x4AAAAAAA…`), Google secrets (`GOCSPX-…`), Google API keys (`AIza…`) and Google client IDs.
  - **Keys and key rings:** PEM private keys, key-ring XML and `CfDJ8` Data Protection payloads.
  - **Tokens:** `__Host-ParishLife` cookie values, JWTs, Bearer tokens and `otpauth://` TOTP seeds.
  - **Azure identifiers:** subscription and tenant IDs.
  - **Code literals:** literal values assigned to identifiers named `*secret*`, `*key*`, `*token*`, `*password*`, `*salt*` or `*sig*`.
  - **Result:** no live secret.

## C. Leaked secrets table

No real secret was ever committed. Every hit from gitleaks and the hand search is listed here, with how I judged it.

| # | Type | Variable name | File | Commit (date) | Still in code at `fullstack-hardening` HEAD? | Branches | Verdict and how judged | Rotation status |
|---|---|---|---|---|---|---|---|---|
| 1 | Private key, PEM (localhost dev certificate) | — | `frontend/.cert/localhost.key` | Never committed (local file only, ignored by `frontend/.cert/`) | Not in Git; it exists only on this machine's disk | none | **Local dev artifact.** It is the exported HTTPS development certificate for localhost. It was never in any commit: the path appears in none of the 2,464 historical paths. | Not needed. Keep it ignored. Don't copy it anywhere. |
| 2 | Turnstile site key and secret key (Cloudflare **published test keys**) | `TestSiteKey`, `TestSecretKey` | `ParishLife.EndToEnd/EndToEndFactory.cs` | Present at `abf17e3` | Yes | `fullstack-hardening` and the fullstack line | **Test fixture.** Byte-for-byte equal to Cloudflare's public "always passes" dummy keys. They are not the production widget's keys, which live only in Key Vault `turnstile-secret-key`. | Not needed |
| 3 | Google OAuth client ID and secret (stand-ins) | `ExternalSignIn:google:ClientId` and `ExternalSignIn:google:ClientSecret` | `ParishLife.EndToEnd/EndToEndFactory.cs` | Present at `abf17e3` | Yes | fullstack line | **Placeholder.** It isn't in Google's format: no `.apps.googleusercontent.com` and no `GOCSPX-` prefix. The values are self-describing stand-ins, and the file header says "never a completed sign-in". | Not needed |
| 4 | Google OAuth client ID (production) | — | `docs/operations/frontend-hosting.md`, line 117 | Present at `abf17e3` | Yes | fullstack line | **Public identifier, not a secret.** Google sends the client ID to every browser in the sign-in redirect. The secret is in Key Vault `google-client-secret` and is in no commit. | Not needed |
| 5 | Azure resource identifiers | `Cosmos:Endpoint`, `BlobStorage:ServiceUri`, `DataProtection:BlobUri`, `DataProtection:KeyIdentifier`, `Azure:ManagedIdentityClientId`, `AllowedHosts` | `ParishLife.Api/appsettings.json` | 2 commits; present at HEAD | Yes | fullstack and backend lines | **Not secrets.** These are endpoints, a Key Vault key URI and a managed-identity client ID (a GUID). Access needs Entra RBAC, not anything in the file. There is no `AccountKey`, SAS or password in any version. | Not needed |
| 6 | Test passwords | `FixturePassword`, `CurrentPassword`, `NewPassword`, etc. | `ParishLife.UnitTests/IdentityBootstrapTests.cs`, many `ParishLife.IntegrationTests/*.cs` | Present at HEAD | Yes | fullstack and backend lines | **Test fixtures** for accounts created in throw-away local test storage. None is a bootstrap operator credential: the bootstrap credentials are private and outside the repo, per `AGENTS.md`. | Not needed. See D, item 5 (never reuse them). |
| 7 | Demo password (old ParishLive prototype) | `DemoPassword` | `src/ParishLive.Infrastructure/Data/SeedIds.cs`, used by `AppDbSeeder.cs` | `4ec733b` (24 Jul 2026), `776991f` (29 Oct 2026) | No | `origin/main`, `origin/codex/reviewed-requirements` only | **Demo fixture** of an earlier prototype that seeded demo accounts. I found no sign it was ever deployed: no host name or deploy configuration on those branches. | Not needed, unless a real account somewhere reuses it (D, item 5) |
| 8 | Test passwords (old Python and Cloudflare Worker prototype) | `password`, `ownPassword`, `recoveredPassword` | `backend/test_accounts.py`, `backend/test_administration_browser.mjs` | Prototype era, Oct 2026 | No | `frontend`, `frontend-new2`, `local/ui-polish`, `origin/frontend`, `origin/frontend-new2`, `origin/homepage-redesign`, `origin/master`, `origin/colin`, plus `origin/member-requests` and `origin/parishlife-v2` (`test_accounts.py` only) | **Test fixtures** posted to a local test server | Not needed (D, item 5) |
| 9 | Cloudflare D1 database ID | `database_id` | `wrangler.jsonc` | 2 commits, Oct 2026 | No | `frontend`, `frontend-new2`, `local/ui-polish`, `origin/cloudflare-server`, `origin/colin`, `origin/frontend`, `origin/frontend-new2`, `origin/homepage-redesign`, `origin/master`, `origin/member-requests`, `origin/parishlife-v2` | **Identifier, not a secret.** Using it needs a Cloudflare API token, and none was ever committed. The Worker read its OAuth client secret from `env` (`cloudflare/src/identity.js`), set as a Wrangler secret outside Git. | Not needed. See D, item 3 (decommission check). |
| 10 | Azure subscription ID in a test | — | `tools/tests/Initialize-Cosmos.Tests.ps1` | Present at HEAD | Yes | fullstack line | **Dummy value** (all `1`s) inside a mocked `az` response | Not needed |
| 11 | Pattern hits with no secret | — | `docs/continuation/AZURE-CONNECTION.md` (prose mentioning `encryptedSecret`); `ParishLife.IntegrationTests/DataSnapshotTests.cs` (asserts that `<encryptedSecret` is absent); `ParishLife.Api/Extensions/ServiceCollectionExtensions.cs` (reads `ClientSecret` from configuration); `re_…` matches inside test method names | Various | Yes | — | **False positives** | Not needed |

## D. Needs your action

The steps below are for the owner. Agents did none of them: no history rewrite, no Azure, Cloudflare or Google change, and no `git fetch`.

### 1. Decision: history rewrite. Recommendation: do not rewrite.

There is no secret to purge, so a rewrite gains nothing.

Even if a secret had leaked, a rewrite would not make it safe. Anyone who cloned or fetched before the rewrite still has it, and GitHub keeps unreachable commits reachable by SHA, in its caches and in pull-request refs, until GitHub Support purges them. Only rotation makes a leaked key safe.

A rewrite (`git filter-repo` or BFG) would also break a lot:
- It changes the SHA of every commit after the purged one, on all 72 refs: `backend`, `frontend`, `frontend-new2`, `fullstack`, `fullstack-integration`, the 13 `fullstack-*` and 13 `fullstack2-*` branches, and the `wip/*`, `colin` and `parishlife-v2` branches.
- It needs a force-push of each one.
- Colin's clones and every worktree on this machine (`parishlife-backend`, `parishlife-frontend`, `parishlife-fullstack` and the `hl-*` hardening worktrees) would have to re-clone or hard-reset. Any unpushed work there would have to be rebased by hand.
- Open pull requests would show broken diffs or close.
- SHAs recorded in docs and reports (`docs/continuation/STATUS.md`, `dev/colin-following` at `c81a30d`, the hardening base `abf17e3`) would stop resolving.
- It conflicts with the project rule "never force-push, never rewrite history".

If you ever do want one, these are the steps:
1. Rotate the key first.
2. Freeze pushes.
3. Run `git filter-repo --replace-text` on a fresh mirror clone.
4. Force-push every branch.
5. Ask GitHub Support to purge cached views.
6. Have every collaborator re-clone.

### 2. Confirm that the remote branches I scanned are current, and scan Colin's repository.

I scanned only what is present on this machine, without `git fetch`. Some gaps remain:
- The remote-tracking refs may be stale.
- This checkout has no `upstream` remote: `origin` here is `github.com/georges33tawk24/parishlife.git`, while `CLAUDE.md` says `origin` is Colin's repository.
- Colin's separate repository and clones were not scanned.
- The outer folder `/Users/user/parishlifedesign` is a separate Git repository with an untracked `ParishLife_Azure_Review.html`. It is outside this repository and was not scanned.

Steps:
1. In a clone of each repository, run `git fetch --all --prune`.
2. Then run `gitleaks git --log-opts="--all" --redact -r <outside-repo>/gl.json .`.
3. In GitHub, for each repository, turn on **Settings → Code security → Secret scanning** and **Push protection**. This is an account settings change, so only you can make it.

### 3. Old Cloudflare Worker prototype (`wrangler.jsonc`, `cloudflare/`, D1 `parishlife-v2`)

Confirm whether it still runs. If it does, retire it.

Steps:
1. In the Cloudflare dashboard, go to **Workers & Pages** and find the Worker named in `wrangler.jsonc`.
2. If you no longer need it, delete the Worker, including its secrets. Delete or export the D1 database as you decide.
3. If it used a Google or Microsoft OAuth client, delete that client's secret too:
   - Google: **Google Cloud console → APIs & Services → Credentials → that OAuth client → delete its secret** (or delete the client).
   - Microsoft: **Entra → App registrations → that app → Certificates & secrets → delete it**.

None of these secrets were in Git, so this is housekeeping, not an emergency.

### 4. Leftover secrets on the Microsoft Entra app

Production Microsoft sign-in has no client secret. It uses `ExternalSignIn__microsoft__UseManagedIdentityAssertion=true`, a managed-identity federated credential.

Steps:
1. Open **Microsoft Entra admin center → App registrations →** the ParishLife web app **→ Certificates & secrets → Client secrets**.
2. Delete any secret that is listed. The app does not use one.
3. Under **Federated credentials**, keep only the one for `id-parishlife`.

### 5. Fixture and demo passwords: never reuse them

Make sure the bootstrap accounts `colinsleiman` and `georgestawk`, and any real account on any system, never use a password that appears in the repository (C, rows 6 to 8). If one does, change it in the app (Account → Password) and turn on MFA.

### 6. Rotation runbook for the live secrets (not triggered by this scan)

None of these was ever committed. Use these steps only if one is ever exposed, for example pasted into chat, a ticket, a log or a screenshot. In every case:
- Update **only Key Vault** `keyvault-parishlife`, because the App Service settings are Key Vault references.
- Restart `app-parishlife` so the reference is re-read; otherwise App Service re-reads it about every 24 hours.
- Check that the reference shows **Resolved** under **App Service → Settings → Environment variables**.
- Local development uses `dotnet user-secrets` (`dotnet user-secrets set "<Key>" "<value>" --project ParishLife.Api`) or environment variables, never `appsettings*.json`.
- There is no CI secret to update: no workflow uses `secrets.*`.

**a. Turnstile secret key** (`Turnstile__SecretKey` → KV `turnstile-secret-key`)
1. Cloudflare dashboard → **Turnstile** → the ParishLife widget → **Settings** → **Rotate secret key**. Check the dashboard to see whether the old key stays valid for a while; if it doesn't, do steps 2 and 3 straight away.
2. Azure portal → Key Vault `keyvault-parishlife` → **Objects → Secrets → `turnstile-secret-key` → + New version** → paste the new key.
3. Restart `app-parishlife`.
4. Check `GET https://parish-life.org/api/auth/capabilities`: `turnstile.enabled` should be true.
5. Do a test sign-in.
6. Disable the old Key Vault version.
7. The site key is public and does not change.

**b. Google OAuth client secret** (`ExternalSignIn__google__ClientSecret` → KV `google-client-secret`)
1. Google Cloud console → **APIs & Services → Credentials** → the "ParishLife web" OAuth client → **Add secret**.
2. Key Vault → `google-client-secret` → **+ New version** → paste the new secret.
3. Restart `app-parishlife`.
4. Test "Sign in with Google".
5. In the Google console, **disable**, then **delete**, the old secret.
6. The client ID does not change.

**c. Resend API key** (`Email__ResendApiKey` → KV `resend-api-key`; only if email is switched on)
1. resend.com → **API Keys → Create API key**. Set the permission to "Sending access" and the domain to `parish-life.org`.
2. Key Vault → `resend-api-key` → **+ New version** → paste the new key.
3. Restart `app-parishlife`.
4. Send a sign-up code to a test address.
5. In Resend, **revoke** the old key.

**d. Microsoft sign-in**
- Nothing to rotate, because no secret is used.
- If the federated credential is ever suspect: **Entra → App registrations → app → Certificates & secrets → Federated credentials** → delete it and re-add it for `id-parishlife`.

**e. Data Protection key ring** (`DataProtection:BlobUri` blob `data-protection/keyring.xml`, wrapped by KV key `parishlife-data-protection`)
- Rotate only if the key-ring blob and the right to unwrap it are both exposed.
- Steps:
  1. **Key Vault → Keys → `parishlife-data-protection` → + New version.**
  2. Let the app create a new key-ring entry. The ring rotates on its own every 90 days.
- Every session cookie and anti-forgery token is invalidated, so everyone has to sign in again. Plan it for a quiet hour.

**f. Application Insights connection string** (`APPLICATIONINSIGHTS_CONNECTION_STRING`)
- This is write-only telemetry, so the risk is low.
- If abused: Azure portal → the Application Insights resource → **Configure → Properties**. The instrumentation key cannot be rotated in place, so create a new resource and update the App Service setting.

**g. Cosmos DB and Blob Storage**
- The app uses the managed identity `id-parishlife`, not keys.
- As a precaution, rotate the account keys anyway, because nothing uses them:
  - Cosmos: **Cosmos account → Settings → Keys → Regenerate primary key**, then the secondary key.
  - Storage: **Storage account → Security + networking → Access keys → Rotate key**.
- Better still, consider disabling key auth:
  - Cosmos: `disableLocalAuth`.
  - Storage: **Allow storage account key access = Disabled**.
- Disabling key auth is an Azure change, so it is your decision.

### 7. Decision: major upgrades (not done)

My recommendations, in order:
- **.NET 11** (`Microsoft.AspNetCore.*`, EF Core Cosmos and `System.Security.*` 11.0.0) needs `net11.0`, a new SDK in `global.json` and an App Service stack change. Plan it as its own task after the pilot. .NET 10 is LTS, so staying on 10.0.x with monthly patches is safe.
- **Aspire 17** affects local development only (AppHost). Upgrade it together with the Aspire CLI setup that the AppHost build now expects (the ASPIRE009 note in "Checks run").
- **Vite 8 with `@vitejs/plugin-react` 6** affects the build only. Test the five HTML entries and `sw.js` caching after upgrading.
- **React 19.3** is a minor release. It is safe to take with a full end-to-end run. I stayed on 19.2.9 to keep this wave patch-only.

### 8. Confirm the production .NET runtime patch

1. Azure portal → App Service `app-parishlife` → **Settings → Configuration → Stack settings** (read-only check).
2. Confirm .NET 10 is selected. App Service applies runtime patches itself.
3. To see the exact patch, open **Development Tools → SSH** (or Advanced Tools/Kudu console) and run `dotnet --list-runtimes`. It is read-only. Expect `Microsoft.AspNetCore.App 10.0.15` or later.

### 9. Turn on the pre-commit hook; schedule the Prettier and Playwright bumps

1. In each clone, run `git config core.hooksPath .githooks` (it needs gitleaks on PATH). I did not run this here: the clone is shared with the other agents' worktrees, and the setting would change their commits mid-run.
2. **Prettier 3.10.1** reformats 33 files owned by 05, 04 and 03. Do it as one format-only commit by 08 after this wave (`npm i -E prettier@3.10.1 && npm run format`).
3. **Playwright 1.65** needs matching browsers (`npx playwright install`). The run rules don't let me install browsers, so do it on a machine where installing is allowed.

### 10. Turnstile widget hostnames (public site key)

1. Cloudflare → **Turnstile** → the ParishLife widget → **Hostnames**.
2. Keep only `parish-life.org`, plus `www.parish-life.org` if you use it. The site key is public, and this list is what stops other sites from using it.

### 11. Node version for building the frontend

Build with **Node 26 LTS**. This machine has Node 25, which is past its end of life. A pin was not added, because it would only warn here. To make it explicit, add `"engines": { "node": ">=26" }` to `frontend/package.json` and a `.nvmrc` containing `26`, and have 08 use the same version in CI.

## E. Handoffs

- **Sent (Part B):** these are written in `hardening/handoffs/from-02-secrets.md`.
  1. 03, High: wire the new `ConfigurationProblem()` checks into startup.
  2. 03, Medium: 3 silent catch blocks in the API.
  3. 05 and 03, Low: 7 silent promise rejections in the frontend.
  4. 03, Low: delete 4 unreferenced types.
  5. 04 then 03, Low: merge duplicated scope, condition and guard helpers.
  6. 08, High: CI commands for the gitleaks scan, `dotnet list package --vulnerable` and `npm audit`.
  7. 01, Low: project-map correction (the `.gitignore` row in section 16).
- **Sent (Part A):** none.
- **Received:** `hardening/handoffs/from-06-legal.md` contains nothing addressed to 02. There were no other handoff files.

## F. Packages removed or upgraded, code deleted, environment variables added

- **Upgraded (npm):**
  - `react` and `react-dom`: 19.2.0 to 19.2.9
  - `vite`: 7.3.7 to 7.3.8
  - `gsap`: 3.15.0 to 3.15.1
  - `lenis`: 1.3.26 to 1.3.27
- **Upgraded (NuGet):**
  - `Microsoft.AspNetCore.OpenApi`, `Microsoft.EntityFrameworkCore.Cosmos`, `System.Security.Cryptography.Pkcs`, `System.Security.Cryptography.Xml` and `Microsoft.AspNetCore.Mvc.Testing`: 10.0.14 to 10.0.15
  - `Microsoft.Azure.Cosmos`: 3.63.2 to 3.64.0
  - `Azure.Storage.Blobs`: 12.30.1 to 12.30.2
  - `Azure.Extensions.AspNetCore.DataProtection.Blobs`: 1.5.3 to 1.5.5
  - `Azure.Extensions.AspNetCore.DataProtection.Keys`: 1.6.3 to 1.6.5
  - `Microsoft.NET.Test.Sdk`: 18.11.0 to 18.12.0
  - All `packages.lock.json` files and `frontend/package-lock.json` were regenerated to match.
- **Added packages:** none. **Removed packages:** none (all are used).
- **Code deleted:** none by me. 4 unreferenced types are proposed for deletion in handoff 4.
- **New files:**
  - `.env.example`
  - `.githooks/pre-commit`
  - `ParishLife.UnitTests/ConfigurationProblemTests.cs`
  - `hardening/handoffs/from-02-secrets.md`
- **New members:**
  - `AzureConfiguration.IsUnresolvedKeyVaultReference`
  - `TurnstileOptions.ConfigurationProblem()`
  - `EmailOptions.ConfigurationProblem()`
  - `ExternalProviderOptions.ConfigurationProblem(provider)`
- **Environment variable names added:** none new. `.env.example` documents the existing names from project map section 5.
