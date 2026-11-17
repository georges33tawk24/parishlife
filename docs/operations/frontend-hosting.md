# Hosting the frontend with the API (single origin)

The API's cookies (`__Host-ParishLife`, `__Host-ParishLife.Csrf`) are `Secure` and `SameSite=Strict`, and the API has no CORS. So a browser must load the pages and call `/api` from the same HTTPS origin.

This repository supports that origin being the API itself: App Service `app-parishlife` serves `frontend/dist` from its `wwwroot`.

## How it works

- **Publish option:** `dotnet publish ParishLife.Api/ParishLife.Api.csproj -c Release -p:UseAppHost=false -p:IncludeFrontend=true -o artifacts/api` copies `frontend/dist` into `artifacts/api/wwwroot`. It stops with an error if the frontend was not built (`npm run build` in `frontend/`).
- **Default publish:** without the property the publish output is exactly the API-only output used today. No `wwwroot` is created, and nothing changes for the current deployment.
- **Serving:** `UseParishLifeFrontend` (`ParishLife.Api/Extensions/FrontendHostingExtensions.cs`) serves `wwwroot` only when `wwwroot/index.html` exists. It sits before the rate limiter, so loading pages and assets does not use up a client's API budget.
- **Caching:**
  - Hashed build files under `/assets/app/` are cached for a year (`immutable`).
  - Pages, `sw.js` and the manifest are revalidated on every visit (`no-cache`).
  - `/api` stays `no-store`.
- **Unchanged:** routing, authentication, CSRF and the security headers. `/api/*` and `/health/*` behave as before.

Verified locally (17 November 2026):
- Both publishes compared: the API files are identical, and the frontend publish adds the 74 files of `frontend/dist` under `wwwroot`.
- The published `ParishLife.Api.dll`, run in Development with local storage, answered:
  - `/`, `/index.html` and `/public.html`: 200 HTML (`no-cache`)
  - a hashed asset: 200 (`immutable`)
  - `/api/auth/csrf`: 200 JSON (`no-store`)
  - `/health/live`: 200

## Deploying it (needs the owner's explicit go-ahead)

`CLAUDE.md` and `AGENTS.md` currently say to deploy only the API publish output. With this option the frontend is part of that output, but it is still a deployment change and needs a decision.

1. In `frontend/`, run `npm ci`, then `npm run build`.
2. Publish with `-p:IncludeFrontend=true`.
3. Zip with `tar.exe -a -c -f <zip> *` from inside the folder, not `Compress-Archive` (see `docs/continuation/AZURE-CONNECTION.md`).
4. Deploy with `az webapp deploy ... --clean true`.
5. Check:
   - `https://<host>/` shows the sign-in page.
   - `/health/ready` reports Healthy.
   - A sign-in completes in the browser.

## Not covered yet

- **Content-Security-Policy:** there is none for the pages. The pages load Google Fonts, so a policy must allow `fonts.googleapis.com` and `fonts.gstatic.com`. Add one once the external origins are confirmed.
- **Address routing:** the portal routes with `#/…` hashes, so no server-side fallback is needed. Any future path-based route would need `MapFallbackToFile`.
