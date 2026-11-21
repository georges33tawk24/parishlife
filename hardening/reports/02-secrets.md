# Agent 02: Secrets and dependencies report

Part A (history scan and key rotation) was done on 21 November 2026 on branch `hardening/02-secrets`, starting from `fullstack-hardening` at `abf17e3`. Part B has not been done yet; it runs in a later wave. No application code was changed. No secret value appears anywhere in this report.

## A. Summary

- I scanned every commit reachable from every ref with gitleaks 8.30.1. That is 281 commits on 72 refs: 9 local branches and 63 `refs/remotes/origin/*` branches. There are no tags and no `refs/remotes/upstream/*`. Commit dates run from 24 July to 21 November 2026.
- I also scanned the current tree and the main checkout, including its ignored build output.
- Then I searched by hand for what gitleaks can miss: config files, key files, key rings, `.env`, connection strings, SAS tokens, OAuth, Turnstile and Resend secrets, cookies and tokens, and committed bundles.
- **No real secret was ever committed, on any branch.** Every hit was a published test key, a stand-in, a test password, a public identifier, or prose.
- Because nothing leaked, no key has to be rotated. Rewriting history is not worth doing.
- Six owner actions remain. They are housekeeping and confirmation, not emergency rotation (section D).

## B. Item table

| Item | Status | Severity | What I found | What I changed (files) | How I verified it |
|---|---|---|---|---|---|
| A1. Scan all history, every branch and tag, plus the working tree, config, notebooks, logs, fixtures and build output | Already OK | — | gitleaks found no leaks: 0 findings in 250 non-merge commits, and 0 in the 31 merge commits (scanned against their first parent, because plain `git log -p` skips merge diffs). `gitleaks dir` found 0 in the worktree. In the main checkout, including ignored `bin/`, `obj/` and `frontend/dist/`, it found 1 local-only dev-certificate key (row 1 in C). The hand search covered every path that ever existed, 2,464 in all. No `.env`, `.pfx`, `.p12`, `.pem`, `.key`, `key-*.xml` key-ring file, `secrets.json`, `.publishsettings`, `.pubxml`, `bin/`, `obj/`, `dist/`, log, dump or notebook was ever committed. The only committed bundles are a prototype build in `assets/app/*.js` (branch `frontend-new2` only) and vendored libraries under `src/ParishLive.Web/wwwroot/lib`; both are clean. | `hardening/reports/02-secrets.md` (this report) | Commands and result files are listed under "How the scan was done" below |
| A2. For each finding: type, name, file, commit, still present, live or not | Already OK | Low | See C. None of them is a live secret. | — | Each hit was checked against its context, without printing any value |
| A3. Revoke and replace compromised keys | Not applicable (no compromised key). Rotation runbook given | — | Nothing that was ever committed needs rotating. Section D gives a runbook for the live secrets (Google client secret, Turnstile secret key, Resend API key, Data Protection key ring, Entra app) to use if exposure is ever suspected. | — | — |
| A4. History rewrite: worth it? what breaks? | Needs your action (decision; recommendation: do not rewrite) | Low | There is nothing to purge, so a rewrite would cost a lot and gain nothing. See D, item 1. | — | — |
| B1. Hide API keys from the client | Pending (Part B) | — | Seen in passing: the frontend source uses no `VITE_` variables, and the only Turnstile key that reaches the browser is the public site key. | — | — |
| B2. Environment variables: `.env.example`, startup validation, client prefixes | Pending (Part B) | — | — | — | — |
| B3. `.gitignore` and pre-commit scanner | Pending (Part B) | — | Seen in passing: `.gitignore` already covers `.env`, `.env.*`, `*.pfx`, `*.pem`, `*.key`, `*.p12`, `*.snk`, `.parishlife-data/`, `frontend/.cert/`, `frontend/dist/`, `bin/` and `obj/`. `ParishLife.Api/wwwroot/` is not ignored. Today the build copies the frontend only into the publish folder, so nothing lands there. | — | — |
| B4. Confirm replaced keys work | Pending (Part B) | — | No rotation is pending from this scan. | — | — |
| B5. Dependency audit | Pending (Part B) | — | — | — | — |
| B6. Remove unused packages and code | Pending (Part B) | — | — | — | — |
| B7. Exposed files check | Pending (Part B) | — | — | — | — |
| B8. Production debug mode | Pending (Part B) | — | — | — | — |
| B9. Packages that don't exist (typosquats) | Pending (Part B) | — | — | — | — |
| B10. Outdated framework and runtime | Pending (Part B) | — | — | — | — |
| B11. Code that hides bugs | Pending (Part B) | — | — | — | — |

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

## E. Handoffs

- **Sent:** none in Part A. Part A found nothing that another agent has to fix.
- **Received:** `hardening/handoffs/` was empty when the run started.

## F. Packages removed or upgraded, code deleted, environment variables added

None. Part A changes no application code.
