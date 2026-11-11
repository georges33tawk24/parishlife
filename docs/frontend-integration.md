# Frontend integration status

Branch `fullstack` combines the `backend` branch (ParishLife.Api, .NET 10, merged at `331135e`) with the React frontend from `frontend-new2`, in `frontend/`. Updated **11 November 2026**.

## Why this is more than changing URLs

The frontend was written for the earlier Python server. It loads a whole parish as one document (`GET parishes/{id}/state`, about 90 collections) and saves it back the same way. ParishLife.Api has more than 400 separate routes with their own data shapes, permission checks, versions (ETags) and operation ids. Each module's screens therefore need their data layer rewritten against that module's routes, and some screens show or edit fields the API does not have.

**How unconnected parts behave:** a page the API does not feed yet shows a notice saying it is not connected. An edit the API cannot save is undone on screen with the message "This part of ParishLife isn't connected to the new backend yet, so nothing was saved." A call to a route that does not exist says the same. No demo record from `data.js` is shown once you are signed in.

## Connected

| Area | What works | API routes |
| --- | --- | --- |
| Transport | Same-origin requests through the Vite proxy; anti-forgery token on every write, fetched again after sign-in and sign-out and retried once on `csrf_invalid`; ProblemDetails shown as readable messages | `GET /api/auth/csrf` |
| Sign-in | Email or username and password; authenticator-code step when the account has two-factor | `POST /api/auth/login`, `POST /api/auth/login/mfa` |
| Sign-up | Name, email and a password of at least 16 characters (the API's rule) | `POST /api/auth/register` |
| Bot check | When the API has Turnstile on, the widget shows on sign-in and sign-up and its token goes in `X-Turnstile-Token` | `GET /api/auth/capabilities` |
| Session | Account, parishes followed or joined, and a role per parish from the account's capacities; sign-out | `GET /api/auth/me`, `GET /api/me/parishes`, `GET /api/me/capacities`, `POST /api/auth/logout` |
| People | List (all pages), add (form and CSV import), archive, archived list | `GET/POST /api/parishes/{id}/people`, `POST .../people/{personId}/archive` |

**Roles from capacities:**

| Capacity | Portal role |
| --- | --- |
| `Priest` | priest of that parish |
| `ParishGrant` with `people.write`, `requests.manage` or `sacraments.record` | secretary |
| `ParishGrant` with only `finance.*` | treasurer |
| `MinistryLeader` | leader |
| `Bishop` | bishop |
| `ArchdioceseAdmin` | diocesan admin |
| `PlatformOperator` | super admin |

Finance is visible to the priest and to grants with `finance.read`. People are loaded for the priest and for grants with `people.read`.

**Verified:**
- `npm run build`, `npm run format:check` and `npm run check` pass. `npm run check` runs the data layer against an in-memory stand-in for these routes. It covers:
  - the session and the role mapping
  - paging, with archived people kept apart
  - create with an operation id, and archive
  - a stale token retried once
  - unsupported edits undone and reported
- The merged API was built in Release (0 warnings) and run locally (`Backend__UseAzure=false`). Through the Vite proxy these all worked: `GET /api/auth/capabilities`, the CSRF token, `POST /api/auth/register` (202) and the sign-in request.
- Sign-in returned 401 because a new account must be verified first. That is the API's rule, and the message says so (see `frontend/README.md`).

**Not yet verified:** a signed-in session and the People screens against the live API. Both need a verified account and a priest appointment, which locally only the interactive operator commands can create.

## In the API, not yet in the frontend

| Feature | API | Frontend today |
| --- | --- | --- |
| Email verification and email change | `POST /api/auth/contact-verification`, `.../confirm`, `email-change` | No code-entry step yet; codes need a delivery provider (`contactVerificationDelivery`) |
| Passkeys | `POST /api/auth/login/passkey/options`, `login/passkey`, `passkeys/registration` | Passkey sign-in is hidden; `model/passkeys.js` still calls the old routes |
| External sign-in | `/api/auth/external/{provider}/...` (Google, Microsoft when configured) | Not shown |
| Public parish directory | `GET /api/public/parishes` (paged, optional distance) | The public site still asks `GET /api/public/overview` and says the directory is not connected |
| Combined home | `GET /api/me/home` | Members get an empty view with the notice |

## Not connected

| Module | Frontend calls today (old server) | ParishLife.Api | Next step |
| --- | --- | --- | --- |
| People, the rest | Edit a person, restore from archive, households, duplicates, Arabic name, town, rite, phone, status, envelope | Person facts, households, relationships, duplicates, directory search and export | Map person facts to the portal's fields; owner decision on fields with no API equivalent |
| Sacraments and certificates | Sacrament records, signatures, certificate requests | Certificates, sacrament records, document signatures and public verification | Rewrite the sacrament list, signing and certificate flow |
| Calendar, services, reservations | Events, rota, services, rooms, bookings | Scheduling, liturgical calendars | Largest module after ministries |
| Groups and ministries | Groups, meetings, attendance, formation, volunteers | Ministries | Map groups to ministries |
| Giving and finance | Counting sessions, funds, expenses, exchange rate | Finance | The exchange rate shows 0 until connected |
| Messages and notices | Inbox, notices, templates | Communications, broadcasts and templates | |
| Requests | Member and guest requests, documents, files | Requests, Files | Guest tracking links have new rules (A13) |
| Member portal | My parish life, my record, corrections | Combined home, membership, personal workspace, person data | |
| Administration and oversight | Workspace, parishes, accounts, plans, bishop oversight | Organizations, Administration, Billing, bishop overview and map | |

## Decisions for the owner

1. **Role mapping.** Confirm the table above, in particular that a grant with records work is the secretary's view and a finance-only grant the treasurer's.
2. **Person fields.** Where should the Arabic name, town hierarchy, rite, member/visitor status and envelope number live: person facts, or new fields?
3. **Production hosting.** The pages and the API must share one HTTPS host, for example the API serving `frontend/dist`, or a front door routing `/api` to the API. The API's `CLAUDE.md` currently says to deploy only the API publish output, so this changes deployment.
4. **SDK.** The repository pins .NET SDK 10.0.401. This work used 10.0.105, building from outside the repository so `global.json` stayed unchanged; re-run on a 10.0.4xx SDK before relying on it.
