# ParishLife frontend

The React frontend (Vite 7, React 19), connected to `ParishLife.Api` in this repository. Three pages:

- `public.html`: the public site (parish directory and pages)
- `index.html`: sign-in and the portal
- `landing.html`: the product page

What is connected so far, and what is not, is in [`docs/frontend-integration.md`](../docs/frontend-integration.md). The design system is in [`DESIGN.md`](DESIGN.md).

## How it reaches the API

The API's cookies are `__Host-` cookies, `Secure` and `SameSite=Strict`, and the API has no CORS. The browser must load the pages and call `/api` from **one HTTPS origin**:

- **Development:** Vite serves the pages and forwards `/api` and `/health` to the API (`vite.config.js`).
- **Production:** the built pages (`frontend/dist`) and the API must be served behind one host. That hosting is not set up yet (see the integration doc).

Every unsafe request carries the anti-forgery token from `GET /api/auth/csrf` in `X-CSRF-TOKEN`. `src/portal/model/api.js` handles this, including fetching a new token after sign-in and sign-out.

## Run it locally

You need Node 20 or later and the .NET SDK pinned in `../global.json`.

1. **Trust the .NET development certificate** (once per computer; this changes your keychain):

   ```bash
   dotnet dev-certs https --trust
   ```

2. **Export it for Vite** (once; `frontend/.cert/` is git-ignored):

   ```bash
   dotnet dev-certs https --export-path frontend/.cert/localhost.pem --format PEM --no-password
   ```

   Without these files Vite serves plain HTTP on `http://localhost:5173`. Chrome and Firefox accept the API's secure cookies there because they treat localhost as secure; Safari does not.

3. **Start the API with local documents** (from the repository root; the data goes to `.parishlife-data/`, which is git-ignored):

   ```bash
   dotnet run --project ParishLife.Api --launch-profile https
   ```

   The `https` profile runs in Development, whose settings (`appsettings.Development.json`) select `Storage:Provider=Local`. `Backend__UseAzure` is read only by the Aspire AppHost, not by the API. Do not use a profile that sets `Storage__Provider=Cosmos` for frontend work: it talks to the real Azure database.

   It listens on `https://localhost:7243`. To use another address, set `PARISHLIFE_API` before starting Vite.

4. **Start the frontend:**

   ```bash
   cd frontend && npm ci && npm run dev
   ```

   Open `https://localhost:5173/index.html`.

### Signing in locally

The API only lets a **verified** account sign in: a confirmed email or a recorded identity review. The API can confirm an email by code (`/api/auth/contact-verification`), but only with a delivery provider configured, and the sign-in page has no code step for it yet. So locally:

- Create the two operator accounts with the private, interactive command `dotnet run --project tools/ParishLife.Maintenance -- bootstrap-superadmins --local` (see `docs/operations/initial-setup.md`). They sign in with a password and an authenticator code; the sign-in page asks for the code.
- Verify an ordinary account you registered through the sign-up page with `dotnet run --project tools/ParishLife.Maintenance -- verify-identity <accountId> --local`.

Both commands need a real terminal on purpose: they refuse piped input.

## Checks

```bash
npm run format:check   # Prettier, two-space style (.prettierrc.json, .editorconfig)
npm run check          # the API layer against an in-memory stand-in for the routes it uses
npm run check:routes   # every route the frontend calls exists in ParishLife.Api (see below)
npm run build          # writes frontend/dist
```

`npm run check:routes` keeps the stand-ins honest. It reruns the checks while recording each request, adds the literal paths passed to `api()`, `parishAPI()` and `allPages()` in `src/`, and matches them by method and path against the `[Route]`/`[Http*]` attributes in `ParishLife.Api/Controllers`. A request no route answers fails the check unless `scripts/route-gaps.json` lists it with the reason it is still open. When a route is added to the API, the check says which gap is closed so it can be removed from that list. It reads the C# source; it does not prove request or response shapes.

On Windows, `frontend/.gitattributes` keeps these files LF so `format:check` passes even with `core.autocrlf=true`.
