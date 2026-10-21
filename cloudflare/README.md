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
- **Passwords.** `server.py` stores PBKDF2-SHA256 with 600,000 iterations (`salt:hex`). On
  the Workers Free plan a request may use only about 10 ms of CPU, so accounts made with
  `tools/accounts.mjs` use `pbkdf2_sha256$10000$salt$hex` with long random passwords. The
  Worker accepts both formats, and so does `server.py`. Accounts parishioners open
  themselves (`/api/signup`) and passwords changed or reset in the portal use the same
  10,000-iteration format on the Worker.
- **Schema additions.** The Worker adds the `member_requests.log` column on its first
  request if the database predates it (`addRequestLog` in `src/app.js`), as `server.py`
  does at start-up. The version 2 tables (`src/authority.js`) and the one-time data
  migrations (`migrateV2Roles`, which loads `src/privacy.js` and `src/plans.js`) also run on
  the first request after a deploy; they only add tables, rows and fields, and each is
  recorded in `schema_migrations`.
- A few indexes (`cf_*`) keep D1's daily row-read allowance for the lists read most often.

## Deploying

The Worker `parishlife` is connected to this GitHub repository (Workers Builds). A push to
the Worker's **production branch** runs `npx wrangler deploy`; pushes to other branches
upload a preview version. To make this branch the live site:

1. Cloudflare dashboard → **Workers & Pages** → **parishlife** → **Settings** → **Build** →
   **Branch control** → set **Production branch** to `cloudflare-server`.
2. Push to the branch (or retry its latest build) to deploy.

Older branches keep their static-only deploy, so switching the production branch back
restores the previous site. The D1 data is independent of deploys.

Check **Branch control** before pushing work in progress: the builds for the
`parishlife-v2` pushes reported "Deployment successful", which suggests they ran the
production deploy. If so, each push changed the live Worker, and its first request ran the
additive version 2 migrations against the live D1 database. Set the production branch to
the branch that should be live and turn on non-production branch builds as previews if
other branches should not deploy.

### Settings for integrations

Integrations stay unavailable until configured. Set them as Worker variables, or as
secrets for anything private (`npx wrangler secret put PARISHLIFE_SMS_WEBHOOK`): the
delivery webhooks `PARISHLIFE_EMAIL_WEBHOOK` / `PARISHLIFE_SMS_WEBHOOK` (and optional
`PARISHLIFE_DELIVERY_TOKEN`), `PARISHLIFE_PUBLIC_URL`, the provider sign-in pairs
`PARISHLIFE_<GOOGLE|APPLE|MICROSOFT>_CLIENT_ID` / `_CLIENT_SECRET` (and
`PARISHLIFE_MICROSOFT_TENANT`), `PARISHLIFE_GOOGLE_MAPS_KEY` for the directory map, and
`PARISHLIFE_SECURE_COOKIE=1`. See **Configuration** in the main README for what each does.
`PARISHLIFE_DEV_OUTBOX=1` shows verification codes on screen instead of sending them, and
only on a local `wrangler dev` (localhost); never set it on the deployed Worker.

## Accounts

Anyone can register from the sign-in screen (see the main README). Staff and operator
accounts are created with the tool, as with `server.py`:

```sh
node cloudflare/tools/accounts.mjs create-user rita --role secretary --name "Rita Nassar" --person-id p4 --parish p-elias
npx wrangler d1 execute parishlife --remote --command "<the SQL it printed>"
```

The tool prints the generated password. `set-password`, `assign-user` and
`grant-complaints` work the same way.

The first super admin of a production database is created with
`node cloudflare/tools/accounts.mjs create-super-admin <username> --name "…"`, after the
version 2 Worker has been deployed and has answered one request (that creates the role
tables). It generates a strong password (or takes `--password` of 12+ characters) and
refuses the public demonstration password. The Worker never creates a demonstration super
admin; `server.py --demo-super-admin` is for a local demonstration only. The super admin
then creates dioceses and provisions their bishops in Administration. The SQL can also be pasted into the D1 console in
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

The version 2 changes were checked statically only (syntax, import resolution and a
review of the source); these suites were not run for them.
