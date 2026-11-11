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
   Backend__UseAzure=false dotnet run --project ParishLife.Api --launch-profile https
   ```

   It listens on `https://localhost:7243`. To use another address, set `PARISHLIFE_API` before starting Vite.

4. **Start the frontend:**

   ```bash
   cd frontend && npm ci && npm run dev
   ```

   Open `https://localhost:5173/index.html`.

### Signing in locally

The API only lets a **verified** account sign in: a confirmed email or a recorded identity review. Email delivery is not built yet, so locally:

- Create the two operator accounts with the private, interactive command `dotnet run --project tools/ParishLife.Maintenance -- bootstrap-superadmins --local` (see `docs/operations/initial-setup.md`). They sign in with a password and an authenticator code; the sign-in page asks for the code.
- Verify an ordinary account you registered through the sign-up page with `dotnet run --project tools/ParishLife.Maintenance -- verify-identity <accountId> --local`.

Both commands need a real terminal on purpose: they refuse piped input.

## Checks

```bash
npm run format:check   # Prettier, two-space style (.prettierrc.json, .editorconfig)
npm run check          # the API layer against an in-memory stand-in for the routes it uses
npm run build          # writes frontend/dist
```
