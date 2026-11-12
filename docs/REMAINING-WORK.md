# What is left before ParishLife is fully done

State on **12 November 2026**, branch `fullstack` at `235e436`, in `georges33tawk24/parishlife`.

## Where things stand

| Branch | What it is |
| --- | --- |
| `fullstack` | The .NET backend plus the React frontend. All 13 frontend modules are connected to the API, and the latest `backend` (`190b2c2`) is merged. Every frontend check and the build pass. |
| `backend` | Colin's .NET API on its own (`190b2c2`), untouched. |
| `frontend-new2` | The redesigned frontend for the old Python server (`8f3513f`), untouched. |
| `fullstack-<module>` (13 branches) | The first connection round. All are already merged into `fullstack`. |
| `fullstack2-<area>` (15 branches, **not pushed yet**) | Cloud sessions still running. They add the missing backend support and wire it in. See step 1. |

## 1. Finish and merge the running sessions

Fifteen cloud sessions were started from `fullstack` at `235e436`. Each pushes `fullstack2-<area>` when done. None had pushed at the time of writing, and none is merged.

| Area | What it adds |
| --- | --- |
| people | Arabic given and family names, rite, member/visitor status, office editing of name, birth date and contact, town in lists, household members, town and Arabic name, directory consent |
| names | `GET /api/parishes/{id}/account-names`, so screens show people's names instead of account ids |
| sacraments | Arabic spellings, celebrant, book and page, office review, preparation requirements, request date, amendments, the priest's signature image |
| calendar | Arabic titles for events, templates, plans and hymns, and the remaining calendar, services and music gaps |
| facilities | Arabic room and equipment names, reservation details, maintenance blocks, issues, equipment condition |
| ministries | Arabic names, meeting times, roster editing, leadership handover, formation editing, resource loans |
| registrations | Deadline, discounts, instalments, payment methods, household registration, pickup codes, evacuation, incidents |
| finance | Exchange rate, budgets, recurring gifts, numbered receipts, Arabic names, ledger details |
| communications | Direct messages, sender names, scheduling, bilingual broadcasts, automations, notice priority and author |
| requests | Accepting creates the record, file checklists, guest documents and letters, pending claims, the old file routes replaced |
| member | Notes, RSVP reasons, "My resources", notification preferences |
| administration | Lists of parishes and accounts, account status, clergy titles, audit trail, parish settings, eparchy, bishop view |
| account | Profile fields, the membership request form, external sign-in, a QR code, earlier requests |
| public | The parish profile (Arabic name, rite, contacts, clergy, photos, news, WhatsApp, livestream), the calendar feed, liturgical Arabic text |
| e2e | Signed-in end-to-end tests in a test-only host with test accounts for every role, in English and Arabic |

**To merge:**
1. `git fetch origin '+refs/heads/fullstack2-*:refs/remotes/origin/fullstack2-*'`
2. Merge the branches one at a time into `fullstack`. The rules every session followed are in `docs/frontend-modules/CONVENTIONS.md`. Expect conflicts in these places:
   - `frontend/src/portal/model/modules/index.js` (union of the module list)
   - `frontend/scripts/check-api.mjs` (keep both sides)
   - `ParishLife.Api/Extensions/ServiceCollectionExtensions.cs` (union of registrations)
   - `docs/cosmos/containers.json` (union of index paths)
3. After each merge, run `npm run format:check && npm run check && npm run build` in `frontend/`.
4. After all merges, run `dotnet test ParishLife.slnx` on SDK 10.0.4xx (`global.json`), then the end-to-end tests from the e2e branch.
5. Fix what fails, and update `docs/continuation/STATUS.md`, `docs/features/coverage.json` and `docs/features/implementation-status.md`, which the sessions were told to leave to this step.

## 2. Issues still open in `fullstack` today

These are listed in each `docs/frontend-modules/<module>.md`. Most are what the running sessions are closing.

**Data the API does not have yet:**
- Arabic names and rite are missing across people, rooms, funds, groups, events and the parish.
- There is no member/visitor status.
- Many records name their actor by account id, so names show as "—", "You" or "Parish office".

**Screens still calling the old server**, which show "not connected":
- On My account: `account/signature`, "My parish records" (`account/records`) and requests made before signing in.
- `workspace/public-profile`, the parish public-profile editor.
- `workspace/suspension`, suspending an account from the people list.
- `attendance-preview`, the attendance import.
- `sign/options`, signing letters.
- The generic file-upload component (`parishes/{id}/files`).

**Pages with no API equivalent:**
- "My resources", the shared ministry documents for members.

**Not in the API:**
- Exchange rate, fund budgets, recurring gifts, numbered receipts.
- Lists of all parishes and accounts.
- A general audit trail.
- A public calendar feed (`.ics`).
- Public parish contact details, clergy and photos.

**Read-only on screen:**
- Formation editing, ministry rosters, resource loans.
- Editing a registration policy after it is created.

**No lists for the public site:**
- The homepage content and the app manifest return 404 until something is published.

## 3. Never tested yet

**Signed-in use against a real API.** All checks so far use a stand-in for the API. A local sign-in needs a verified account, which only the interactive operator commands create:
- `dotnet run --project tools/ParishLife.Maintenance -- bootstrap-superadmins --local`
- `verify-identity <accountId> --local`

The e2e branch (step 1) is meant to close this.

**The exact SDK.** Everything here ran on .NET SDK 10.0.105, but the repository pins 10.0.401. Re-run on 10.0.4xx.

**Browsers other than Chrome.**

**Arabic, with a native reader.**

## 4. Needed before going live

**Hosting:**
- The pages and the API must share one HTTPS host, because the API's cookies are `__Host-`, Secure and SameSite=Strict, with no CORS. Choose either the API serving `frontend/dist`, or a front door routing `/api` to the API.
- `CLAUDE.md` currently says to deploy only the API output, so this changes deployment.

**Azure** (see `docs/continuation/OWNER-QUESTIONS.md` and `docs/azure-manual-setup/`):
- Deploy the API to a staging environment.
- Grant the app's managed identity access to Cosmos, Blob storage and the Key Vault key.
- Apply the index paths in `docs/cosmos/containers.json`.
- Run the main flows on staging.

**External services:** configure them, with keys in Key Vault and never in Git:
- email and SMS delivery for contact verification and messages
- WhatsApp, if it is wanted
- Turnstile site and secret keys
- Google and Microsoft sign-in, if wanted
- backups

**First accounts:** run the bootstrap for `colinsleiman` and `georgestawk` on the real environment, with real passwords and an authenticator.

**Real data:** the parishes, archdiocese, clergy appointments and people. The system has no seed data, by design.

**Production dev setup:** each developer trusts the .NET development certificate (`dotnet dev-certs https --trust`). See `frontend/README.md`.

## 5. Owner decisions still open

From `docs/continuation/OWNER-QUESTIONS.md`, `docs/frontend-integration.md` and the module docs:
- **Requirement proposals:** 399 proposed answers in the requirements were never confirmed. Approve them as pilot defaults, or list the changes.
- **Open inputs U01–U15:** rite and eligibility rules, age and guardian rules, certificate wording and specimens, fees and refunds, safeguarding contacts, retention and holds, subscription policy, and what happens to pastoral notes when their author leaves.
- **Conflicts C01–C11:** for example, whether a new parish is public at once, and password rules.
- **Role mapping:** office grants map to the secretary's and treasurer's views, and ministry leaders to the leader's view. Confirm.
- **Which GitHub repository is the main one:** the docs name `ColinSleiman/ParishLife`, but the work is in `georges33tawk24/parishlife`.

## 6. Backend completeness

The backend's own register tracks 149 feature cards. At the last count most are partly built and none is fully accepted. See `docs/features/implementation-status.md`. The running sessions add many of the missing parts, but each card still needs its acceptance criteria checked after the merge.

## Order to finish fast

1. Merge the 15 `fullstack2-*` branches (step 1) and run the backend tests and the end-to-end tests.
2. Fix what fails, then deploy to Azure staging (step 4).
3. Hold one decision meeting for step 5.
4. Do a pilot with one real parish, then fix and go live.
