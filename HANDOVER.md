# Handover: where the full-stack work stands (14 November 2026, night, Beirut)

Georges, this is the exact state, so you can continue without asking Colin. Everything below is pushed to your repository, `georges33tawk24/parishlife`. In your checkout that remote is probably `origin`; on Colin's machine it is `upstream`.

## In one paragraph

Your `fullstack2-*` cloud sessions never ran, so Colin had the 13 areas from `docs/REMAINING-WORK.md` built on his machine by parallel Claude workers, one branch per area, following your `docs/frontend-modules/CONVENTIONS.md`. **All 13 areas are finished and merged** into `fullstack-integration`, together with the shared account-name lookup and the route check. The whole solution builds with 0 warnings and **533 tests pass**. Only 2 known route gaps remain. What is still open is listed under "What is still open" below. The signed-in end-to-end tests (the 15th item of your list) are not started.

## The branches

| Branch | What it is |
| --- | --- |
| **`fullstack-integration`** | **Start here.** Your `fullstack` (`520cdb8`) plus the latest `backend` (Colin's Azure-connection commits up to `b2aaf92`), plus the work listed below. Every area gets merged into this branch. |
| `fullstack2-<area>` (13 branches) | One per area, cut from `fullstack-integration`. **All merged.** Kept for history; each area doc is on it too. |
| `wip/*/<area>` | Snapshots of uncommitted edits taken while usage limits stopped the workers. **All superseded**: everything is committed on the area branches and merged. Safe to delete. |
| `wip/20261114-1224/azure-connection-main-folder` | **Not superseded.** Colin's *other* session (the Azure connection), saved on top of `backend` `b2aaf92`. Its uncommitted edits: the Aspire 13.6.5 bump (also applied here), an "Azure" launch profile, request-letter changes, `coverage.json` and docs. Not tested. That session owns it. |
| `wip/20261114-0623/*`, `wip/20261114-1158/*` | Older snapshots, also superseded. Safe to delete. |
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
11. **Communications** (`fullstack2-communications`, `8c2e1fb`):
    - Broadcast scheduling (`schedule`/`unschedule`). A background job stores the broadcast at its time only if the scheduler still has access; otherwise it goes back to Approved with a note.
    - Automations (`broadcast-automations`): each due time makes one draft from an approved template. The draft still needs a different staff member's approval. Bounded: 1–52 runs, at most 20 active per parish.
    - Arabic versions of broadcasts, templates and notices.
    - Notice priority (Normal/Urgent; urgent sends nothing).
    - Direct messages to a person (exactly one linked account in the parish), and sender names via the lookup.
    - No external delivery: channels stay NotConfigured. Owner questions 5–9 are in `docs/frontend-modules/communications.md`.
12. **Requests** (`fullstack2-requests`, `5570793`):
    - Opening the record from an accepted request (`requests/{r}/records`). It opens a sacramental case or certificate through the existing services, with their own authority still required, and is idempotent.
    - Files tied to checklist items.
    - Guest uploads with the tracking code (metadata only, never downloads).
    - Pending claims (`me/request-claims`).
    - Letters on the office case view (draft, priest signature with authenticator code, release), with the U05 "reference only" wording.
    - The generic upload component and letter signing now use the API; `model/signing.js` is gone. Person and group files still have no store, so they say "not connected".
    - Owner questions are in `docs/frontend-modules/requests.md`.
13. **Ministries** (`fullstack2-ministries`, `f67c8e2`):
    - Arabic twins across ministries, meetings, stock, loans, opportunities and formation.
    - Meeting times (`ministries/{id}/meeting-times`).
    - Priest-only roster removal with a protected reason.
    - Person-to-account lookup for appointing leaders.
    - Formation draft editing.
    - Screens for leaders, roster, loans and formation.
    - Still open: Arabic names on already-approved groups (the API only edits drafts). Owner questions 6–9 are in `docs/frontend-modules/ministries.md`.
14. **Registrations** (`fullstack2-registrations`, `a87d8b0`):
    - Editing the registration terms after creation (capacity, fee, ages, deadline, discounts, instalments, payment methods, muster point).
    - Named discounts.
    - Household registration (1–12 members in one transaction).
    - Pickup codes: shown once, salted hash stored, never in audit or receipts, required at checkout.
    - Evacuation roll calls.
    - Deadline enforcement.
    - Payment method on receipts (nothing is charged).
    - Owner questions 6–12 are in `docs/frontend-modules/registrations.md`.
15. **Tooling:**
   - `npm run check:routes` matches every frontend API call against the real controller routes. Known gaps are listed in `frontend/scripts/route-gaps.json`.
   - `frontend/.gitattributes` keeps the frontend LF, so `format:check` passes on Windows.
   - Aspire AppHost was bumped 13.6.4 → 13.6.5 for advisory GHSA-f7vh-h5g3-7jrh, so `dotnet test ParishLife.slnx` runs again.
   - Two test fixes found while merging:
     - The topic-catalog test now also sees the mute check that communications moved into `BroadcastAudience`.
     - The exchange-rate correction test advances the frozen fixture clock, so the "current" rate no longer depends on a random id.

**Checks with all 13 areas merged** (SDK 10.0.401, Windows):
- `dotnet restore --locked-mode` OK; Release build 0 warnings.
- **57 unit + 476 integration tests passed (533), 0 failed.**
- Frontend: `format:check`, `check` (all modules) and `build` pass.
- `check:routes`: 635 routes, 627 requests, **2 known gaps** (the deliberate `workspace/plan` check, and the attendance import `parishes/{id}/attendance-preview`), 0 new.

All of this ran on local storage only, which is not Cosmos acceptance.

## What is still open

All 13 areas are merged. Every area doc lists what it could not finish and why; the larger items are:

- **API gaps the screens still hit:**
  - the attendance import preview (`parishes/{id}/attendance-preview`);
  - person and group file stores (their drop areas say "not connected");
  - shared ministry documents (My resources shows stock only);
  - a staff list for assigning facility issues;
  - external delivery for email, SMS and WhatsApp (no provider configured).
- **Small screen gaps:**
  - an Arabic title input in the meeting dialogs;
  - a link/unlink panel for external sign-in;
  - a QR code;
  - a rank/season Arabic input in the liturgical calendar editor;
  - reservations from booking requests;
  - per-member answers when registering a household.
- **Owner questions:** each `docs/frontend-modules/<module>.md`, plus `docs/continuation/OWNER-QUESTIONS.md`. The workers recorded these instead of guessing. Examples: which rites exist, member vs visitor eligibility, receipt numbering, electronic-signature validity (U05), and whether publishing needs a priest's review.
- **Not proven yet:** everything ran on local storage. Cosmos behaviour is unverified, in particular the receipt counter and the new index paths. No screen has been used signed in against a running API.

## How to continue

**Setup:**
- .NET SDK **10.0.401** exactly, as `global.json` requires. If missing: `dotnet-install.ps1 -Version 10.0.401`.
- Node 20+.

```bash
git fetch origin
git switch -c fullstack-integration origin/fullstack-integration
dotnet test ParishLife.slnx -c Release                    # must stay 0 failures and 0 new warnings
cd frontend && npm ci && npm run format:check && npm run check && npm run check:routes && npm run build
```

When you add a route that the frontend already calls, remove its entry from `frontend/scripts/route-gaps.json`. `check:routes` tells you when a gap is closed.

**Conflicts that came up while merging** (useful if you merge more branches):
- `frontend/scripts/route-gaps.json`: each branch removed its own closed gaps; keep all the removals.
- `people.jsx`: people renamed `consentsOf` to `directoryConsents`; administration added `accountStatus`.
- `account.jsx`: kept the account area's `saveSignature(version, …)` plus requests' `SignerProfilePanel`.
- `ServiceCollectionExtensions.cs`: one registration line per service merged cleanly.

**Rules every worker followed** (keep them): `docs/frontend-modules/CONVENTIONS.md`, `CLAUDE.md`, `AGENTS.md`, and the worker brief in `docs/frontend-modules/AREA-WORKER-BRIEF.md`. In short:
- no seed or invented data;
- owner decisions recorded, not guessed;
- one public type per file, with a purpose comment;
- operation ids, versions and ETags kept;
- credentials never in audit or fingerprints;
- recovery-session restrictions kept;
- tests for every route.

## Next steps

1. **Signed-in end-to-end tests** (the last item of the 15) in a test-only host with accounts for every role (the "e2e" item of `REMAINING-WORK.md`). Not started. Locally, signing in needs the interactive `bootstrap-superadmins --local` / `verify-identity` commands.
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
