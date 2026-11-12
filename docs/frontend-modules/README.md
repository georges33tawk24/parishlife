# Connecting the frontend, module by module

For completing the stack (backend additions, Arabic names, people's names for account ids), read [`CONVENTIONS.md`](CONVENTIONS.md) first.

The portal's screens change plain objects in `frontend/src/portal/model/data.js` and call `persist()`. Each connected module is a file in `frontend/src/portal/model/modules/`, listed in `modules/index.js`:

| Export | Meaning |
| --- | --- |
| `keys` | The `data.js` collections the module owns. Two modules may not own the same collection (`scripts/checks/registry.mjs` fails). |
| `routes` | The portal pages it feeds. Pages no module lists show a "not connected" notice. |
| `load(parish, d)` | Fills its collections in `d` (they start empty) from ParishLife.Api. Check the signed-in role or capabilities first (`parish.roles`, `parish.capabilities`). A 403 means "not allowed here", so leave the collection empty rather than failing the load. |
| `save(before, now, parish)` | Sends what changed between two snapshots to the API and returns `{ unsupported, saved }`. An unsupported change is undone on screen and reported. After every save the portal reloads from the API. |

A workflow the diff cannot express (an approval, a signature, a state change) can call the API directly from its action and then `hydrate()`. Use `api()` and `parishAPI()` from `model/api.js`: they carry the anti-forgery token and turn ProblemDetails into readable messages. Creates need `operationId: newOperationId()`. Versioned writes send the `version` the API returned with the record.

Never show a demo record or invent a value the API does not return: leave it empty, and list it in your module's doc.

## Checks

`npm run check` runs `scripts/check-api.mjs` and every `scripts/checks/*.mjs`, each in its own process. Add `scripts/checks/<module>.mjs` using `scripts/mock-api.mjs`: a stand-in for the routes your module calls, with assertions on what `load` fills and what `save` sends. Also run `npm run format:check` and `npm run build`.

## Who owns what

One session or person per module. Change only your own files. Keep edits to shared files (`shell/actions.jsx`, `shell/routes.jsx`, `model/store.js`, `model/data.js`, `ui/`) small and local. Leave `features/dashboard/` to the integration step.

| Module | Feature files | Portal pages | API area |
| --- | --- | --- | --- |
| people | `records/people*`, `person*`, `households*`, `membership-reviews*`, `profile-reviews*`, `model/modules/people.js` | people, person, households, household, membershipreviews, profilereviews | People: person facts, households, relationships, duplicates and merges, search and export; membership requests and corrections |
| sacraments | `records/sacraments*`, `certificate*` | sacraments, certificate | Sacraments, certificates, document signatures |
| calendar | `parish-life/calendar*`, `services*`, `schedules*`, `communicate/music*` | calendar, services, music | Scheduling: calendar, liturgical calendars, service plans, music, rota |
| facilities | `spaces/*` | facilities, reservations | Scheduling: rooms, spaces, bookings, reservations |
| ministries | `parish-life/groups*`, `ministry-requests*`, `attendance*`, `volunteers*` | groups, ministryrequests, attendance, volunteers | Ministries |
| registrations | `parish-life/registrations*`, `checkin*` | registrations, checkin | Event registration, arrival, pickup |
| finance | `money/*` | giving, finance, officeexpenses | Finance, exchange rate |
| communications | `communicate/inbox*`, `messaging*`, `notices*`, `website*` | inbox, mymessages, messaging, notices, portal | Communications, broadcasts, templates, parish website |
| requests | `records/requests*`, `guest-requests*`, `online-requests*`, `request-documents*`, `member/requests*`, `public/pages/RequestPage.jsx`, `TrackingPage.jsx` | requests, guestrequests, myrequests | Requests, files, guest requests and tracking |
| member | `member/*` (not requests), `records/notes*`, `model/member-data.js` | activity, memberhome, my* pages, membernotifications, memberhub, notes | Combined home, membership, personal workspace, person data, consents |
| administration | `administration/*`, `oversight/*` | workspace, insights, forms, reports, audit, settings, eparchy, assignments, oversight, bishopeparchy, bishopmap | Organizations, administration, billing, workflows, bishop overview, insights |
| account | `account/*`, `shell/Auth.jsx`, `model/passkeys.js` | account | Account profile, password, MFA, passkeys, sessions, contact verification, external sign-in |
| public | `public/` (not RequestPage or TrackingPage), `public/api-data.js` | the public site | Public directory and nearby, homepage, document verification |

Each module records its routes used, fields with no API equivalent, and open decisions in `docs/frontend-modules/<module>.md`.
