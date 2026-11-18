# Hosting the frontend with the API (single origin)

**Owner decision (17 November 2026):** the API on App Service `app-parishlife` serves the frontend from its own origin (option 1 of the three discussed). The alternatives were separate static hosting behind Front Door, or not hosting the pages yet.

The API's cookies (`__Host-ParishLife`, `__Host-ParishLife.Csrf`) are `Secure` and `SameSite=Strict`, and the API has no CORS. So the pages and `/api` must come from the same HTTPS origin.

## How it works

- **Package:**
  - `tools/Publish-ParishLife.ps1` runs `npm ci` and `npm run build`, then `dotnet publish -p:IncludeFrontend=true`, which copies `frontend/dist` into `wwwroot`.
  - It checks the package: no tests, AppHost, tools, end-to-end host or key files.
  - It zips the package with the Windows `tar.exe`, which writes forward-slash paths.
  - It prints the deploy command and makes no Azure calls.
  - `-IncludeFrontend:$false` builds the old API-only package.
- **Serving:** `UseParishLifeFrontend` (`ParishLife.Api/Extensions/FrontendHostingExtensions.cs`) serves `wwwroot` only when `wwwroot/index.html` exists, so an API-only package behaves exactly as before. It sits before the rate limiter, so loading pages and assets does not use up a client's API budget.
- **Caching:**
  - Hashed build files under `/assets/app/` are cached for a year (`immutable`).
  - Pages, `sw.js` and the manifest are revalidated on every visit (`no-cache`).
  - `/api` stays `no-store`.
- **Content-Security-Policy (pages only):**
  - Scripts come only from this origin, from Cloudflare Turnstile (`challenges.cloudflare.com`), and from the exact inline start-up script of each page. Those scripts are allowed by SHA-256 hashes computed from the published HTML when the API starts, so editing them needs no policy change.
  - Styles come from this origin and Google Fonts. Inline styles are allowed, which the print views need.
  - Fonts come from `fonts.gstatic.com`.
  - Images: this origin, `data:`, `blob:`, and any HTTPS address (parish photos).
  - Connections: this origin and Turnstile only.
  - Frames: Turnstile only.
  - No plugins. The pages may not be framed (`frame-ancestors 'none'`). `base-uri` and `form-action` are limited to this origin.
  - If a new external service is added (maps, embedded video…), add its origin in `ContentSecurityPolicy`; the browser tests fail on any blocked resource.
- **Unchanged:** routing, authentication, CSRF and the security headers. `/api/*` and `/health/*` behave as before.

## Verification (17 November 2026)

- **Publish:** the API files are identical with and without the frontend. The frontend adds the 74 files of `frontend/dist` under `wwwroot`. `Publish-ParishLife.ps1` produced a 147-file zip with no backslash entries.
- **Local run:** the published `ParishLife.Api.dll`, run in Development with local storage, answered:
  - `/`, `/index.html` and `/public.html`: 200 (`no-cache`)
  - a hashed asset: 200 (`immutable`)
  - `/api/auth/csrf`: 200 (`no-store`)
  - `/health/live`: 200
- **`FrontendHostingTests`:** pages are served with caching and the hashed policy, assets and `/api` carry no page policy, and without a web root no pages are served.
- **Browser tests:** the end-to-end host now serves the pages through this same code (web root = `frontend/dist`). `npm run e2e` passes 9/9 with the policy enforced, with no blocked resource in any screen for any role, in English or Arabic.
- **Not exercised:** Turnstile, which is not configured locally, and the deployed App Service.

## Deploying (each deployment still needs the owner's go-ahead)

1. From a clean checkout of the commit to deploy, run `powershell -File tools/Publish-ParishLife.ps1` (it needs .NET SDK 10.0.4xx and Node).
2. In the Azure session, after `az login`, run the command it prints: `az webapp deploy -g rg-parishlife -n app-parishlife --src-path <zip> --type zip --clean true`.
3. Check:
   - `https://<host>/` shows the sign-in page.
   - `/health/ready` reports Healthy.
   - A sign-in completes in the browser.
   - In Application Insights, no CSP or `/api` errors.

Before each deploy, preview the Cosmos index with `tools/Initialize-Cosmos.ps1` (without `-Apply`) and apply only if it plans a change. The queries filter on the paths in `docs/cosmos/containers.json`, and the local store refuses queries on unindexed paths to catch a missing one.

## Deployment log

- **18 November 2026, `a156ae3`** (Azure session, owner's go-ahead):
  - Packaged with `Publish-ParishLife.ps1 -OutputRoot …`: 145 files, no backslash entries.
  - Deployed to `app-parishlife` at 14:54 UTC.
  - Cosmos index already matched the manifest, so nothing was applied.
  - `/health/ready` Healthy. `/` and `/public.html` carry the policy, and hashed assets are `immutable`. `/api` unchanged.
  - The existing Key Vault-wrapped key ring was reused.
  - Owner browser sign-in (password and authenticator) at 15:08 UTC. Application Insights afterwards showed no exceptions, failed dependencies or error traces. The only 404s were `api/public/homepage` and `api/public/app/manifest`: nothing is published yet, and the pages fall back as designed.
  - Afterwards the script was fixed to work without `-OutputRoot` under Windows PowerShell 5.1.
- **18 November 2026, `094f9d5`** (Azure session, owner's go-ahead):
  - Packaged with `Publish-ParishLife.ps1` without `-OutputRoot`: 145 files, no backslash entries. Only `ParishLife.Api.dll`/`.pdb` differ from the `a156ae3` package.
  - Cosmos index matched the manifest, so nothing was applied.
  - Deployed 15:52–15:54 UTC; the app started at 15:53:51.
  - `/health/ready` Healthy. Pages carry the policy, and hashed assets are `immutable`. `/api` unchanged.
  - The existing key ring was reused (unwrapped with key version `426eb917…`, no new key).
  - **Sign-in limit (option A) confirmed live:** 30 rapid `auth/csrf` calls returned 200 and 30 rapid `auth/me` calls returned 401, with no 429s. There were no 429s at all after the deploy.
  - Owner visit at 15:56 UTC: `auth/me`, `me/parishes` and `me/capacities` returned 200. No exceptions besides the start-up cancel, no failed dependencies, no error traces.
  - **Known issue found:** "Sign out" in the portal's user menu froze the tab and never sent `auth/logout`. In `Portal.jsx` the shell's own `signOut` handler shadowed the imported API `signOut` and called itself forever. The same bug was in `a156ae3`. Fixed in the next commit, which adds browser tests that sign out and check the session is gone.

## Notes

- **Address routing:** the portal routes with `#/…` hashes, so no server-side fallback is needed. A future path-based route would need `MapFallbackToFile`.
- **Custom domain:** if one is added, add it to `AllowedHosts` in `appsettings.json`.
