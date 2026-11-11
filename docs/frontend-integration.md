# Frontend integration status

Branch `fullstack` combines Colin's `backend` branch (ParishLife.Api, .NET 10) with the React frontend from `frontend-new2`, in `frontend/`. Updated **11 November 2026**.

## Why this is more than changing URLs

The frontend was written for the earlier Python server. It loads a whole parish as one document (`GET parishes/{id}/state`, about 90 collections) and saves it back the same way. ParishLife.Api has about 420 separate routes with their own data shapes, permission checks, versions (ETags) and operation ids. Each module's screens therefore need their data layer rewritten against that module's routes, and some screens show or edit fields the API does not have.

**How unconnected parts behave:** a page the API does not feed yet shows a notice saying it is not connected. An edit the API cannot save is undone on screen with the message "This part of ParishLife isn't connected to the new backend yet, so nothing was saved." A call to a route that does not exist says the same. No demo record from `data.js` is shown once you are signed in.

## Connected

| Area | What works | API routes |
| --- | --- | --- |
| Transport | Same-origin requests through the Vite proxy; anti-forgery token on every write, fetched again after sign-in and sign-out and retried once on `csrf_invalid`; ProblemDetails errors shown as readable messages | `GET /api/auth/csrf` |
| Sign-in | Email or username and password; authenticator-code step when the account has two-factor | `POST /api/auth/login`, `POST /api/auth/login/mfa` |
| Sign-up | Name, email and a password of at least 16 characters (the API's rule) | `POST /api/auth/register` |
| Session | Account, parishes followed or joined, staff appointments in effect, role per parish; sign-out | `GET /api/auth/me`, `GET /api/me/parishes`, `GET /api/auth/staff-appointments`, `POST /api/auth/logout` |
| People | List (all pages), add (form and CSV import), archive, archived list | `GET/POST /api/parishes/{id}/people`, `POST .../people/{personId}/archive` |

**Verified:**
- `npm run build`, `npm run format:check` and `npm run check` all pass. `npm run check` drives the data layer against an in-memory stand-in for these routes: paging, archived people kept apart, create with an operation id, archive, a stale token retried, unsupported edits undone and reported.
- Against the real API running locally (`Backend__UseAzure=false`), through the Vite proxy: the CSRF token, `POST /api/auth/register` (202), and the sign-in request.
- Sign-in returned 401 because new accounts must be verified first. That is the API's rule, not a frontend fault (see `frontend/README.md`).

**Not yet verified:** a signed-in session and the People screens against the live API. Both need a verified account and a priest appointment, which only the interactive operator commands can create.

## Not connected

| Module | Frontend calls today (old server) | ParishLife.Api | Next step |
| --- | --- | --- | --- |
| People, the rest | Edit a person, restore from archive, households, duplicates, Arabic name, town, rite, phone, status, envelope | Person facts, households, relationships, duplicates, directory search and export (about 60 routes) | Map person facts to the portal's fields; owner decision on fields with no API equivalent (Arabic name, town hierarchy, rite, envelope) |
| Sacraments and certificates | Sacrament records, signatures, certificate requests | `/api/parishes/{id}/certificates`, sacrament records (about 20 routes) | Rewrite the sacrament list, signing and certificate flow |
| Calendar, services, reservations | Events, rota, services, rooms, bookings | Scheduling (about 70 routes) | Largest module after ministries |
| Groups and ministries | Groups, meetings, attendance, formation, volunteers | Ministries (about 80 routes) | Map groups to ministries |
| Giving and finance | Counting sessions, funds, expenses, exchange rate | Finance (about 35 routes) | The exchange rate shows 0 until connected |
| Messages and notices | Inbox, notices, templates | Communications (about 20 routes) | External delivery (W04, N05) is not built in the API |
| Requests | Member and guest requests, documents, files | Requests (about 20), Files (4) | Guest tracking links have new rules (A13) |
| Member portal | My parish life, my record, corrections | Membership, personal workspace, person data | Members currently get an empty view with the notice |
| Administration and oversight | Workspace, parishes, accounts, plans, bishop oversight | Organizations, Administration, Billing | Bishop overview (O08) is blocked in the API |
| Public site | `GET /api/public/overview` (directory), parish pages, tracking, verification | One parish's website, calendar and ministries; the platform homepage | **The API has no public parish directory.** The front page shows that it is not connected |
| Passkeys, bot check | Passkey sign-in, Turnstile | Not in the API (cards X01, X13) | Passkey sign-in is hidden |

## Decisions for the owner

1. **Roles.** The API has two staff roles: Priest (one parish) and ArchdioceseAdmin. The portal's secretary, treasurer and ministry-leader views have no API role yet, so those people see the member view. Should they come from the API's ministry leader duties and office grants, or from new staff roles?
2. **Person fields.** Where should the Arabic name, town hierarchy, rite, member/visitor status and envelope number live: person facts, or new fields?
3. **Public directory.** The public site needs a list of published parishes. That is a new anonymous API route.
4. **Production hosting.** The pages and the API must share one HTTPS host, for example the API serving `frontend/dist`, or a front door routing `/api` to the API. The API's `CLAUDE.md` currently says to deploy only the API publish output, so this changes deployment.
5. **SDK.** The repository pins .NET SDK 10.0.401. This work was run on 10.0.105, using the already built API, without changing `global.json`.
