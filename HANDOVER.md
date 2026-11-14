# Handover: where the full-stack work stopped (14 November 2026, 12:00 Beirut)

Georges, this is the exact state, so you can continue without asking Colin. Everything below is pushed to your repository, `georges33tawk24/parishlife`. In your checkout that remote is probably `origin`; on Colin's machine it is `upstream`.

## In one paragraph

Your `fullstack2-*` cloud sessions never ran, so Colin had the 13 areas from `docs/REMAINING-WORK.md` built on his machine by parallel Claude workers, one branch per area, following your `docs/frontend-modules/CONVENTIONS.md`. **People, calendar, sacraments, member, facilities, account, public, administration and finance are finished and merged** into `fullstack-integration`, where the whole solution builds with 0 warnings and **508 tests pass**. The **other 4 areas are partly done**. Their branches are pushed, and any edits that were not committed yet are saved on `wip/20261114-1224/<area>` branches. Usage limits kept stopping the workers mid-edit, which is why most areas end with uncommitted frontend work.

## The branches

| Branch | What it is |
| --- | --- |
| **`fullstack-integration`** | **Start here.** Your `fullstack` (`520cdb8`) plus the latest `backend` (Colin's Azure-connection commits up to `b2aaf92`), plus the work listed below. Every area gets merged into this branch. |
| `fullstack2-<area>` (13 branches) | One per area, all cut from `fullstack-integration`: people, sacraments, calendar and finance from `9c1c291`; communications and requests from `f5a9a0a`; the other 7 from `6951bcd`. Committed work only. |
| `wip/20261114-1224/<area>` | **Snapshots of uncommitted edits**, each a single commit on top of that area's `fullstack2-<area>` head. Not reviewed, not tested; they may not even build. Three areas still need one: requests, ministries, registrations (the finance and communications snapshots are now committed on their branches). |
| `wip/20261114-1224/azure-connection-main-folder` | Colin's *other* session (the Azure connection), saved on top of `backend` `b2aaf92`. Its uncommitted edits: the Aspire 13.6.5 bump, an "Azure" launch profile, request-letter changes, `coverage.json`, docs. Not tested. That session owns it; it is not part of the area work. |
| `wip/20261114-0623/*`, `wip/20261114-1158/*` | Earlier snapshots. **Superseded** by `20261114-1224`; ignore them, or delete them once you are happy. |
| `fullstack`, `backend`, `frontend-new2`, `fullstack-<module>` | Untouched by this work. |

## What is merged and verified (`fullstack-integration`)

1. **The account-name lookup**, `GET /api/parishes/{id}/account-names?ids=a,b`. Screens show people's names instead of account ids.
   - Current priests, office holders and ministry leaders are named to members, followers and capacity holders of the parish.
   - Other accounts are named only to `people.read` office callers, and only when linked to a person of the parish.
   - Strangers get nothing, and inactive accounts are never named.
   - See `docs/operations/account-names.md`.
2. **People** (`fullstack2-people`, `a7ff8c7`):
   - Arabic given and family names, rite (free text), and a Member/Visitor status.
   - Office editing (`PUT people/{id}`, which needs MFA, a version and an operation id).
   - Parish-wide facts (town in lists) and consent lists (the directory print shows only consented fields).
   - Household Arabic name and town.
   - An invented CSV-import default ("Maronite"/"member") was removed.
3. **Calendar** (`fullstack2-calendar`, `6b4201b`):
   - Arabic twins on events, plans, plan items and music.
   - Event templates (create, edit, use, archive).
   - A celebrant picker that lists only current priests.
   - Hymn version restore.
4. **Sacraments** (`fullstack2-sacraments`, `64f32db`):
   - New case actions: office review (informative only), preparation requirements, and request amendments that take effect only when a priest approves.
   - The parish's own requirement lists (`GET/PUT sacraments/requirements`; no built-in list).
   - Arabic twins for celebrant, place and witnesses; celebrant person; register book and page.
   - The priest's own signature image (`clergy-signature-image`): private, versioned, MFA, attached to the certificate he signs. It is not an electronic signature (U05 is still open).
   - Owner questions 8–12 are in `docs/frontend-modules/sacraments.md`.
5. **Member** (`fullstack2-member`, `5427453`):
   - Notes gain pin, a reminder date and a meeting link, all inside the encrypted personal content. Reminders show on the calendar only; nothing is sent.
   - RSVP private reasons wired.
   - `GET parishes/{id}/me/ministry-resources` ("My resources"): stock of the member's current ministries. There is no record for shared documents yet.
   - `GET me/notification-topics`: only `parish.broadcast` and `reports` can be muted; required topics never. Merge note: if communications adds topics, update `NotificationTopicCatalog`, or its test fails.
6. **Facilities** (`fullstack2-facilities`, `346209b`):
   - Arabic twins for rooms, equipment, issues and renters; an equipment condition grade.
   - Dated maintenance blocks (`maintenance-blocks`) that take part in reservation conflict checks.
   - Reservation details: purpose, people expected, contact, notes, a checklist, and a decision history (`PUT reservations/{id}/details`).
   - Names come through the account-name lookup.
   - Still open: an assignee picker for issues (no staff list route), photos and access fields. See `docs/frontend-modules/facilities.md`.
7. **Account** (`fullstack2-account`, `51a74b0`):
   - Private profile details with Arabic twins.
   - The holder's own signature image (`account/signature`, image only, signs nothing).
   - My parish records (`account/records`: only the account's own linked person; corrections go through the existing review).
   - A membership request form.
   - External sign-in and linking that finish in the portal (still `external_provider_unavailable` until providers are configured).
   - Still open: a link/unlink panel, a QR code, and a list of earlier-request claims. See `docs/frontend-modules/account.md`.
8. **Public** (`fullstack2-public`, `08b4120`):
   - The parish public profile, as a draft with publish/unpublish (`parishes/{id}/profile`), editable in both languages.
   - Private photo uploads with an explicit publish step.
   - Clergy only from current priest appointments, and only when the parish chooses to show them.
   - The public copy (`public/parishes/{id}/profile`) and an `.ics` feed (`public/parishes/{id}/calendar.ics`, public events only, bounded, rate-limited).
   - Arabic rank and season on liturgical entries.
   - Owner questions are in `docs/operations/public.md`.
9. **Administration** (`fullstack2-administration`, `8eb36c2`):
   - Platform lists for operators only (MFA, each read audited): `administration/parishes`, `archdioceses` and `accounts`, plus a safe account view.
   - Account suspend and reinstate with a reason and a status history. Suspending ends every session; no data is deleted. Operators cannot suspend themselves or another operator.
   - Clergy titles (`clergy-titles`): the list starts empty, with nothing seeded.
   - A read-only parish audit trail (`parishes/{id}/audit`, needs `audit.read`, 100 per page).
   - A Platform tab in the workspace. The people-list suspend item replaces the old `workspace/suspension` route; it shows only once the people module fills `ACCOUNTS[personId]`, which nothing does yet.
   - Owner questions (parish settings, eparchy/bishop view, which clergy titles exist) are in `docs/frontend-modules/administration.md`.
10. **Finance** (`fullstack2-finance`, `29098d7`):
    - Exchange rates (`finance/exchange-rates`): recorded by an office with `finance.approve`, with date and source. Append-only, never fetched, never used to convert amounts.
    - Fund budgets (`finance/budgets`, compared with paid expenses).
    - Recurring gifts (`finance/recurring-gifts`): stored schedules only; nothing is charged.
    - Numbered receipts (`finance/receipts`, void keeps the number): one counter per parish, saved in the same transaction as the receipt. Gap-free and unique on the local store (5 concurrent receipts gave 1–5); **not verified on Cosmos**.
    - Arabic names for funds, campaigns, expenses and office entries; fund and campaign name corrections; lists of counting sessions and opening balances.
    - Owner questions (converted amounts, receipt number format and yearly reset, fees and refunds) are in `docs/frontend-modules/finance.md`.
11. **Tooling:**
   - `npm run check:routes` matches every frontend API call against the real controller routes. Known gaps are listed in `frontend/scripts/route-gaps.json`.
   - `frontend/.gitattributes` keeps the frontend LF, so `format:check` passes on Windows.
   - Aspire AppHost was bumped 13.6.4 → 13.6.5 for advisory GHSA-f7vh-h5g3-7jrh, so `dotnet test ParishLife.slnx` runs again.

**Checks after merging finance** (SDK 10.0.401, Windows):
- `dotnet restore --locked-mode` OK; Release build 0 warnings.
- **57 unit + 451 integration tests passed, 0 failed.**
- Frontend: `format:check`, `check` (all modules) and `build` pass.
- `check:routes`: 615 routes, 591 requests, 6 known gaps (the deliberate `workspace/plan` check, attendance import, letter signing, generic file upload), 0 new.

All of this ran on local storage only, which is not Cosmos acceptance.

## The 4 unfinished areas

Each worker wrote its owner questions and remaining gaps into `docs/frontend-modules/<module>.md` and `docs/operations/<area>.md` on its own branch.

| Area | Committed on `fullstack2-<area>` | Uncommitted, saved in `wip/20261114-1224/<area>` | Where it stopped |
| --- | --- | --- | --- |
| communications | `8c2e1fb`: scheduling, automations, Arabic versions, notice priority, direct messages by person (backend + tests), then the inbox and module wiring | none | Final test run and report; check new notification topics against `NotificationTopicCatalog` |
| requests | `4bc6603`: open records from accepted requests, checklist-bound files, guest uploads, claim list (backend; 37 targeted tests passed) | 17 frontend/doc files, including replacing the old `parishes/{id}/files` and `sign/options` calls | Extending `checks/requests.mjs` |
| ministries | `5ef42d5`: Arabic twins, meeting times, roster removal, person lookup, formation drafts (backend + tests) | 7 frontend files (groups, volunteers, attendance, resources) | Rewriting the module's load |
| registrations | `346e3fd`: model fields only (deadline, discount, instalments, payment methods, pickup code) | 6 backend files (services, options controller, evacuation, terms, `RegistrationOptionsTests`) | Fixing two tests (AsyncLocal actor context set inside helpers) |

## How to continue

**Setup:**
- .NET SDK **10.0.401** exactly, as `global.json` requires. If missing: `dotnet-install.ps1 -Version 10.0.401`.
- Node 20+.

**To finish an area:**

```bash
git fetch origin
git switch fullstack2-<area>                     # or: git switch -c fullstack2-<area> origin/fullstack2-<area>
git merge --ff-only origin/wip/20261114-1224/<area>   # only for the areas that have a snapshot; it is a fast-forward
```

Then finish what the table says.
- **Backend:** `dotnet test ParishLife.IntegrationTests -c Release --filter "FullyQualifiedName~<Area>"`.
- **Frontend**, in `frontend/`: `npm ci && npm run format:check && npm run check && npm run check:routes && npm run build`.

**Then merge it into `fullstack-integration`, one area at a time:**

```bash
git switch fullstack-integration
git merge fullstack2-<area>
dotnet test ParishLife.slnx -c Release        # full solution, must stay 0 failures and 0 new warnings
cd frontend && npm run format:check && npm run check && npm run check:routes && npm run build
git push origin fullstack-integration
```

**Expected conflicts** (take the union): `ParishLife.Api/Extensions/ServiceCollectionExtensions.cs` (one registration line per service), `docs/cosmos/containers.json` (index paths), `frontend/src/portal/model/modules/index.js`, `frontend/scripts/check-api.mjs`, `frontend/scripts/route-gaps.json` (remove a gap once its route exists).

**Overlaps to watch while merging:**
- `PublicCalendarEventDto`/`CalendarService.PublicAsync`: calendar and public both touched them; both are merged now, with no conflict.
- `record-editor.jsx`: finance and ministries.
- The request-letter code: requests and the Azure session's snapshot.
- Finance areas started before the names route existed, so they may still show account ids where `loadNames`/`nameOf` would now work.

**Rules every worker followed** (keep them): `docs/frontend-modules/CONVENTIONS.md`, `CLAUDE.md`, `AGENTS.md`, and the worker brief in `docs/frontend-modules/AREA-WORKER-BRIEF.md`. In short:
- no seed or invented data;
- owner decisions recorded, not guessed;
- one public type per file, with a purpose comment;
- operation ids, versions and ETags kept;
- credentials never in audit or fingerprints;
- recovery-session restrictions kept;
- tests for every route.

## After the 4 areas

1. **Signed-in end-to-end tests** in a test-only host with accounts for every role (the "e2e" item of `REMAINING-WORK.md`). Not started. Locally, signing in needs the interactive `bootstrap-superadmins --local` / `verify-identity` commands.
2. Update `docs/features/coverage.json`, `docs/features/implementation-status.md` and `docs/continuation/STATUS.md`.
3. **Hosting decision (owner):** the pages and the API must share one HTTPS host (`__Host-` cookies, no CORS). The recommendation is that the API on `app-parishlife` serves `frontend/dist`. That changes the "deploy only the API" rule, so Colin has to agree.
4. **Azure (Colin's Azure session):**
   - deploy `fullstack-integration` instead of `backend`;
   - apply the new index paths in `docs/cosmos/containers.json`;
   - commit or reconcile its own snapshot (the `azure-connection-main-folder` branch).
5. Owner questions: each `docs/frontend-modules/<module>.md`, plus `docs/continuation/OWNER-QUESTIONS.md`.

## Where the details are

- Worker brief used for every area: `docs/frontend-modules/AREA-WORKER-BRIEF.md`.
- Running log and checks: `docs/continuation/STATUS.md`, the top section "Front/back continuation checkpoint".
- The original to-do list: `docs/REMAINING-WORK.md`.
- Area notes: `docs/operations/<area>.md` and `docs/frontend-modules/<module>.md`, on each area's branch.
