# ParishLife on Cloudflare

This folder runs ParishLife on Cloudflare Workers. The pages and assets are the same
files `server.py` serves; the API in `src/` is a line-by-line port of `server.py` to
JavaScript, and the SQLite database lives in Cloudflare D1. Nothing in the browser code
changes: it calls the same `/api/...` endpoints and gets the same answers.

`server.py` still works locally exactly as before (see the main README).

## How it fits together

| Piece | Where |
| --- | --- |
| Worker configuration | `wrangler.jsonc` (repository root) |
| Published files | `.assetsignore` limits the upload to `index.html`, `landing.html`, `public.html` and, under `assets/`, scripts, styles, images and fonts — the files `server.py` serves. `_headers` adds the same security headers. The site's address (`/`) serves `public.html`, the public homepage, in both servers; the system itself is `index.html`. |
| API | `src/worker.js` (routing, sessions, files), `src/app.js` (parish records, oversight, sacrament workflow), `src/member.js` (member portal and concerns), `src/state.js` (`migrate_state`, `validate`), `src/xlsx.js` (attendance import), `src/py.js` (Python semantics the port relies on) |
| Database | D1 database `parishlife`; the Worker creates the tables and the sample parishes on first use, as `init_db()` does |

Differences from `server.py`, all invisible to the browser:

- **Transactions.** D1 has no open transactions. Each request reads directly, queues its
  writes and commits them in one atomic batch, guarded by a counter (`cf_meta.seq`); if
  another request committed in between, the request runs again. The result is the same
  one-at-a-time order the Python server's write lock gives (`src/db.js`).
- **Relationship tables** (`people`, `households`, `group_members`, …) end up with the same
  rows, but only changed rows are written, to stay within D1's daily write allowance.
- **Uploaded files** are stored in `cf_file_chunks` as base64 text (a D1 row holds at most
  2 MB); `uploaded_files` keeps the same metadata.
- **Dates.** `server.py` used the computer's local date; the Worker uses
  `PARISH_TIMEZONE` (`Asia/Beirut`) from `wrangler.jsonc`.
- **Passwords.** New accounts, password changes and resets use PBKDF2-SHA256 with
  600,000 iterations, matching Python. Legacy stored formats remain readable.
  Configure sufficient Worker CPU capacity for authentication. Use the dedicated
  [secure Super Admin provisioning workflow](../docs/administration.md#cloudflare-installation)
  for developer access; it never prints a plaintext privileged password.
- **Account workspace.** The shared additive `backend/workspace-schema.json` supplies account preferences, scoped grants, affiliations, private request links and review history. Worker-specific service modules mirror the Python implementation. Normal startup does not seed a known super administrator password. OAuth, verification, messaging delivery and live Google Maps remain unconfigured.
- **Homepage content.** `src/site-content.js` mirrors `backend/site_content.py`: the public `GET /api/public/site` and the Super Admin `GET`/`PUT /api/workspace/site-content`, stored in the shared `pl_site_content` table. See [homepage design](../docs/homepage-design.md).
- **Public site.** `src/public-site.js` mirrors `backend/public_site.py`: the homepage overview, each parish's calendar feed, and the preview tags of shared parish and event links. Those previews need the Worker to answer `/public.html` itself, which `run_worker_first` in `wrangler.jsonc` arranges.
- **Sign-in protections.** `src/sign-in.js` mirrors `backend/sign_in.py`: the pause after repeated wrong passwords, the common and leaked password check, passkeys, and Turnstile. Optional Worker settings (dashboard → Workers & Pages → parishlife → Settings → Variables and Secrets): `TURNSTILE_SITE_KEY` (a variable) with `TURNSTILE_SECRET` (a secret) from a Turnstile widget for the site's hostname, and `CF_ANALYTICS_TOKEN` from Cloudflare Web Analytics. Without them the forms and pages work as before.
- **Insights and signatures.** `src/analytics.js` mirrors `backend/analytics.py` (the Super Admin Insights and parish CRM, and `POST /api/public/hit`, which the Worker records after answering, with `ctx.waitUntil`). `src/signatures.js` mirrors `backend/signatures.py` (personal signatures kept with a passkey, signed certificates and letters, and `GET /api/public/verify/<code>`). Their tables come from the shared schema; nothing needs configuring.
- **Schema additions.** The Worker adds the `member_requests.log` column on its first
  request if the database predates it (`addRequestLog` in `src/app.js`), as `server.py`
  does at start-up.
- A few indexes (`cf_*`) keep D1's daily row-read allowance for the lists read most often.

## Deploying

The Worker `parishlife` is connected to this GitHub repository (Workers Builds). A push to
the Worker's **production branch** runs `npx wrangler deploy`; pushes to other branches
upload a preview version. To make this branch the live site:

1. Cloudflare dashboard → **Workers & Pages** → **parishlife** → **Settings** → **Build** →
   **Branch control** → choose the branch you intend to publish (`colin` for this requested source update). Inspect the configured build rules before deploying.
2. Push to the branch (or retry its latest build) to deploy.

Older branches keep their static-only deploy, so switching the production branch back
restores the previous site. The D1 data is independent of deploys.

## Accounts

Public sign-up creates an unlinked user account. Authorized staff can create and manage scoped accounts through Administration. The operator tool remains available for existing deployments:

```sh
node cloudflare/tools/accounts.mjs create-user rita --role secretary --name "Rita Nassar" --person-id p4 --parish p-elias
npx wrangler d1 execute parishlife --remote --command "<the SQL it printed>"
```

The tool prints the generated password. `set-password`, `assign-user` and
`grant-complaints` work the same way. The SQL can also be pasted into the D1 console in
the dashboard (**Storage & Databases** → **D1** → **parishlife** → **Console**).

## Backups

D1 keeps point-in-time history (Time Travel). To restore, use
`npx wrangler d1 time-travel restore parishlife --timestamp <time>`, or export a copy with
`npx wrangler d1 export parishlife --remote --output backup.sql`.

## Limits on the Workers Free plan

- About 10 ms of CPU per request. Ordinary requests use 1–6 ms. Uploading a file of
  several megabytes needs more and may be refused; Workers Paid ($5/month) lifts this.
- D1: 5 million rows read and 100,000 rows written per day, 500 MB per database (uploaded
  files count towards it).

## Testing

```sh
# server.py's own tests, run against this port (they import a stand-in "server")
python3 cloudflare/test/run_backend_tests.py
# the same API scenario against server.py and the Worker, every response compared
WRANGLER=/path/to/wrangler cloudflare/test/run_differential.sh
```

`wrangler dev` runs the Worker locally with a local D1 database.

The scoped administration update has 49 shared HTTP tests passing against both Python and the Worker, plus explicit D1 concurrency checks. See [administration verification](../docs/administration.md#verification) for commands, browser workflows and existing broader-suite failures. No production deployment or remote D1 migration was performed.
