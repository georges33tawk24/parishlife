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
- **18 November 2026, `63aa347`** (Azure session, owner's go-ahead):
  - Packaged with `Publish-ParishLife.ps1` without `-OutputRoot`: 145 files, no backslash entries.
  - Compared with the `094f9d5` package, 10 files differ, all explained:
    - the three rebuilt chunks (`portal-*`, `api-data-*`, `public-*`) and `index.html`/`public.html`, which point to them. The old bundle had dropped the API sign-out function entirely because nothing called it; the new portal chunk imports it, and the other two chunks change only by the minifier's renamed short identifiers.
    - `ParishLife.Api.dll`/`.pdb`: no backend source changed. The DLL embeds its build commit (`1.0.0+<commit>`), so a few hundred bytes differ at the same file size.
  - Cosmos index matched the manifest, so nothing was applied.
  - Deployed 16:20–16:22 UTC; the app started at 16:21:53.
  - `/health/ready` Healthy. `/` and `/public.html` carry the policy, and the new `portal-w_ZLSzE2.js` is served `immutable`. `/api` unchanged.
  - The existing key ring was reused (unwrapped with key version `426eb917…`, no new key).
  - **Sign-out confirmed live:**
    - 16:23 UTC: the owner signed out (`auth/logout` 204), then signed back in (`login` 202, `login/mfa` 200).
    - 20:25–20:26 UTC re-test: sign-in, then a reload while signed in (`auth/me` 200), then sign-out (`auth/logout` 204), then a reload, which stayed signed out (`auth/me` 401).
  - Application Insights after both visits: no 429s, no exceptions besides the start-up cancel, no failed dependencies, no error traces. The only other error-range response was App Service's start-up `robots933456.txt` probe (400).
- **18 November 2026, `b451301`** (Azure session, owner's go-ahead):
  - Packaged with `Publish-ParishLife.ps1`: 145 files, no backslash entries.
  - Compared with the `63aa347` package, 6 files differ, all explained:
    - `appsettings.json`: the new `AllowedHosts` value.
    - The rebuilt portal chunk `portal-CBbgmEAd.js`, which replaces `portal-w_ZLSzE2.js` (sign-in check guards), and `index.html`, which points to it.
    - `ParishLife.Api.dll`/`.pdb`: the guest request form is now `[TurnstileProtected]`.
  - Cosmos index matched the manifest, so nothing was applied.
  - Deployed 22:13:27–22:13:34 UTC; serving again at 22:14:36.
  - `/health/ready` Healthy. Pages carry the policy, and the new portal chunk is served `immutable`.
  - The existing key ring was reused (key version `426eb917…`).
  - Turnstile was still off, because no keys were set yet. Sign-in behaved as before.
  - Owner visit on `parish-life.org` at 22:17–22:18 UTC: `login` 202, `login/mfa` 200, `auth/me` 200, `logout` 204, then `auth/me` 401.

## Turnstile switched on (19 November 2026)

Configured by the Azure session with the owner's go-ahead. There was no code change and no deploy. The secret key never passed through the session: the owner created the widget and stored the secret in Key Vault directly.

- **Cloudflare widget** (account that holds `parish-life.org`):
  - Created by the owner with Cloudflare's "Set up with Spin" dashboard flow. Spin's agent prompt was not used, because the widget and siteverify code already exist.
  - Hostnames: `parish-life.org` and the azurewebsites address.
  - Spin also adds `localhost` and `127.0.0.1` automatically. Removing them from the live widget is recommended; whether they were removed was not checked.
  - Site key (public): `0x4AAAAAAGIg3JWtHyFPWxXW`.
  - An earlier widget was created by mistake during setup and deleted at once, so its keys are void.
- **Key Vault `keyvault-parishlife`:**
  - Secret `turnstile-secret-key`, stored by the owner in the portal at 10:46:40 UTC.
  - The owner's account was granted "Key Vault Secrets Officer" on the vault (RBAC change) so it could store the secret.
- **App's access to the secret:**
  - `id-parishlife` was granted "Key Vault Secrets User" scoped to that one secret only.
  - The App Service `keyVaultReferenceIdentity` was changed from `SystemAssigned` (the app has no system identity) to `id-parishlife`.
- **App settings** (10:50:52 UTC, 15 settings in total; the app was serving again at 10:52:39):
  - `Turnstile__SiteKey` = the site key.
  - `Turnstile__SecretKey` = `@Microsoft.KeyVault(SecretUri=https://keyvault-parishlife.vault.azure.net/secrets/turnstile-secret-key/)`.
  - `Turnstile__ExpectedHostname` left unset.
- **Checks:**
  - The Key Vault reference status is `Resolved` (identity UserAssigned).
  - `GET /api/auth/capabilities` returns `turnstile.enabled: true` with the site key. `/health/ready` is Healthy.
  - `POST /api/auth/login` without a token returns 400 `turnstile_failed`. With a forged token, the app reached siteverify (200), which refused it, giving 400 `turnstile_failed`.
  - **Live acceptance:** the owner signed in on `parish-life.org` through the widget at 10:57–10:58 UTC. Siteverify answered 200, then `login` 202, `login/mfa` 200, and `auth/me`, `me/parishes` and `me/capacities` 200. This proves that the stored secret matches the widget.
  - Application Insights: no `turnstile_unavailable` 503s and no exceptions besides the start-up cancel. The only other error-range responses were the session's own probes and the start-up `robots933456.txt` 400.
- **Rollback:** remove the two `Turnstile__*` settings. The role grants and the identity setting can stay.
- **Rotating the secret:**
  1. In Cloudflare, rotate the secret key in the widget settings.
  2. Store it as a new version of `turnstile-secret-key`.
  3. Restart the app. Key Vault references are otherwise re-read about every 24 hours.

## Custom domain: `parish-life.org` (18 November 2026)

Set up by the Azure session at the owner's go-ahead for each change; no code change or deploy. The domain is registered in Georges's Cloudflare account. The Cloudflare changes were made in the dashboard through the browser pane, signed in by the owner, so no API token was used.

**Hostnames:**
- Bound in App Service: **`parish-life.org`** only.
- **`www.parish-life.org`** never reaches the app. Cloudflare redirects it, so it is not bound and is not in `AllowedHosts`.
- `AllowedHosts` (App Service setting, overrides `appsettings.json`): `parish-life.org;app-parishlife-gxcjhmgqagd7hhg0.francecentral-01.azurewebsites.net;localhost;127.0.0.1`. `appsettings.json` has the same value.

**Cloudflare DNS (zone `parish-life.org`):**

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` | `20.43.43.43` (App Service inbound IP) | DNS only |
| TXT | `asuid` | App Service `customDomainVerificationId` | DNS only |
| CNAME | `www` | `parish-life.org` | Proxied |

- The bare domain must stay **DNS only**, for two reasons:
  - The Azure-managed certificate is issued and renewed only while the name points straight at Azure.
  - With the proxy on, every visitor would reach the API from Cloudflare's addresses and share the per-address rate limits. Turning the proxy on needs a forwarded-headers code change first.
- **Redirect rule** "Redirect from WWW to root": request URL `http*://www.parish-life.org/*` → `https://parish-life.org/${2}`, 301, query string preserved. Cloudflare's template only matched `https://www.*`. Cloudflare rejects a pattern starting with `*`, so `http*://` is used. Its "may not be proxying traffic for http" warning on deploy is a false positive, because `www` is proxied.
- Not used: "Always Online" (could serve stale pages of a signed-in app), and the proxy on the bare domain. App Service's `httpsOnly` already redirects `http://parish-life.org` to https.

**Azure:**
- `az webapp config hostname add` at 21:34 UTC.
- Free App Service managed certificate: GeoTrust TLS RSA CA G1, valid 18 November 2026 – 19 May 2027, auto-renewed by Azure. Bound with SNI at 21:37:51 UTC.
- `AllowedHosts` setting at 21:37:13 UTC; the app restarted at 21:38:44.

**Checks:**
- `https://parish-life.org/` and `/public.html`: 200, Content-Security-Policy present. The certificate is trusted by Windows.
- `/health/ready` Healthy, and `/api/auth/csrf` 200 on the new name.
- `http://parish-life.org/` → 301 `https://parish-life.org/`.
- `https://www.parish-life.org/public.html?lang=ar` → 301 `https://parish-life.org/public.html?lang=ar`.
- The old azurewebsites address still works.
- Owner browser visit on `parish-life.org` at 21:43–21:44 UTC: `login` 202, `login/mfa` 200, `auth/me` 200, `logout` 204.
- Application Insights: 0 429s, no failed dependencies besides Key Vault's normal 401 challenge, only the start-up cancel exception.
  - The 400s for `GET /` on `parish-life.org` all fall between adding the hostname (21:34) and the restart with the new `AllowedHosts` (21:38:44). They were Azure's validation probes against the old host list. None occurred after the restart.
  - The only 404s were `api/public/homepage` and `api/public/app/manifest` (nothing published).
- **Not verified:** plain `http://www.parish-life.org` returned a blank page with a `Refresh` header and no Cloudflare headers, even when sent to Cloudflare's address. This points to an HTTP interceptor on the owner's network rather than Cloudflare; `https://www` redirects correctly. Re-check from another network.

**Later:** an email sender can use this domain (outside-services step). Turnstile has used it since 19 November; see "Turnstile switched on" above. For a custom domain on another name, repeat: TXT `asuid.<name>`, a DNS-only record to the app, `hostname add`, `ssl create`, `ssl bind --ssl-type SNI`, and `AllowedHosts`.

## Notes

- **Address routing:** the portal routes with `#/…` hashes, so no server-side fallback is needed. A future path-based route would need `MapFallbackToFile`.
- **Another custom domain:** add it to `AllowedHosts` in both the App Service setting and `appsettings.json` (see "Custom domain" above).
