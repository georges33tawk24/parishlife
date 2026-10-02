# ParishLife

ParishLife is a bilingual parish administration application served by a small Python 3.11+ HTTP server. The browser uses ES modules without a build step. SQLite is the authoritative store; the browser holds only the current view model. Start the application with `server.py`, not the older static `.claude/serve.py` script.

## Start locally

```powershell
cd 'C:\Users\User\Downloads\parishlife-master\parishlife-master'
$parishPython = 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $parishPython server.py 4399
```

Open `http://127.0.0.1:4399` and sign in with an existing account. If port 4399 is already occupied by an older run, stop that terminal with Ctrl+C and start it again so the updated server code loads. On this machine, `python` and `py -3` do not resolve to an installed interpreter; the bundled executable above works. On a machine with Python 3.11+ installed, `python server.py 4399` is equivalent.

To create an additional account, run `& $parishPython server.py --create-user bishop --role bishop --name "Bishop"`, or use `--role priest|secretary|treasurer|leader|volunteer --parish p-elias` as appropriate. Each account command prompts for a password of at least 12 characters. A bishop account opens a separate, read-only oversight screen with parish filters and drill-downs. Parish assignment is an operator action on the local machine, for example `& $parishPython server.py --assign-user fr-antoine --parish p-elias`; it is never editable from the bishop screen. An unassigned priest cannot open parish records. Use `--person-id` when the account corresponds to a person in the parish. The server binds to localhost.

The first start creates `var/parishlife.sqlite3` from `backend/seed.json`. Saint Elias contains sample data; the other sample parishes start with independent empty records. The `var/` directory is ignored by Git. Back up the database file with the server stopped or with SQLite's backup facility. The browser's Data snapshot export is a review artifact, not a database restore path.

## Architecture

- `server.py`: same-origin HTTP API, password-authenticated sessions, CSRF token, parish assignment checks, collection write permissions, SQLite schema, migrations, register workflow, and audit trail.
- `backend/seed.json`: initial sample state.
- `assets/api.js`: authenticated session and parish API client.
- `assets/persist.js`: hydrates the browser view model from SQLite and saves changed collections with an optimistic revision check.
- `assets/data.js`: shape and initial values of the frontend view model.
- `assets/app.js`, `assets/store.js`: shell, router, signed-in role, parish selection, and navigation.
- `assets/views/`: screens. `assets/views/people.js` covers people and households; `assets/views/oversight.js` is the separate bishop view; `assets/views/records.js` covers registers, requests, corrections, certificates, and anniversaries; `assets/views/notes.js` covers private pastoral notes and tasks; `assets/views/parish.js` covers calendar, service planning, groups, registration, and check-in.
- `assets/planning.js`: selects and copies service plans and templates without sharing their order-of-service arrays.
- `assets/crud.js`, `assets/flows.js`, `assets/actions.js`: shared record forms and user actions.
- `assets/parishlife.css`, `assets/app.css`, `assets/components.js`, `assets/ui.js`: design system and controls.

The API never trusts the selected parish or role from the browser. A bishop receives a read-only oversight projection of parishes in their archdiocese and cannot load or mutate parish working state. Every other account is limited to explicit assignments. Pastoral notes are sent only to clergy; giving data is limited to clergy and treasurers. Register approval, issuance, and correction approval are handled through dedicated API actions rather than ordinary record saves.

## Main workflows

People belong to a parish and may be members of one household. New households reuse several existing people in one selection, record a shared address once, and can designate a household contact. Surname matches are suggestions to review; records are never merged automatically. Historic family/branch relationships remain in storage but are not editable concepts in the household interface. Group membership changes from a person's profile require review and confirmation. The printed people directory includes only people who explicitly opt in; it shows English and Arabic names, household, town, and phone. The offering-envelope identifier is optional and belongs to a household, not each member; it connects counted gifts to that household without marking every member as a donor. It is not auto-generated. The inter-parish person transfer workflow has been removed. Names are entered as supplied, with English first, without automatic transliteration or a Preferred Name field.

A family begins a sacrament by asking the parish office to enter a request. The secretary may review it, while the priest can accept or decline it directly without waiting for that review. Accepted requests move to Preparation, where the office records the date and checks the requirements. Only completed preparation can move to the scheduled celebration. After the celebration, the office submits the entry for priest review; priest approval assigns its official register number and places it in Registers. The request reference and full history remain linked to the same record. Requests is the searchable action queue and completed request history; Registers lists official sacramental entries only. Certificate requests can be linked to a planned sacrament and wait for its official entry, or go directly to clergy review when one already exists. Certificate issuance is a separate clergy action. Corrections start from an official register row, are reviewed in Requests, and preserve the prior entry and revision history. Cancelling preparation or declining a request keeps its history.

Pastoral notes are reference information; tasks have actionable status, assignee, and due date. They remain clergy-only. Calendar events can be public, visible to selected groups, or restricted to parish office and clergy. Masses can have assigned priests and a clergy-only printable schedule. Service plans use an explicit Save action, chronological item times, and a total duration. Group attendance is recorded per member and meeting in a matrix, with retained former-member history; individual Mass attendance is not collected. Formation means the group's training or faith-development milestones. Registration forms link to explicit eligible events; check-in is a separate arrival record for registrants of the selected event. Existing unlinked forms and check-in records are preserved but must be linked or migrated before use in the new event-based flow. Consent fields stay in person data. Anniversaries derive from registered baptism, chrismation, first Communion, and marriage entries, with earlier marriage reminders labelled legacy.

## Database migration and operating limits

`init_db()` creates or updates the SQLite schema on startup. Existing stored parish state is migrated to preserve historic household relationships, add pastoral task fields, reusable event and service templates, event visibility and priest assignments, event-linked registration/check-in containers, service plans, meeting attendance maps, and register history/revision metadata. The normalized relationship tables are rebuilt with parish-scoped foreign keys. The old transfer collection and Preferred Name field are removed from migrated state. Back up an existing database before starting a newer version.

This is a local application baseline. Official register numbering, certificate templates, retention rules, and external parish verification need archdiocese approval before live administrative use. UI exports and communication controls do not constitute delivery integrations. Functional and syntax checks are appropriate for changes here; a penetration test was not requested or performed.
