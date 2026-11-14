# Administration module

Files: `frontend/src/portal/model/modules/administration.js` (the module contract), `administration-api.js` (one function per route), `features/administration/*`, `features/oversight/oversight.jsx`, and `features/communicate/homepage-editor.jsx` (the platform homepage editor, taken over from the old `workspace/site-content` route). Check: `frontend/scripts/checks/administration.mjs`.

Updated 14 November 2026 (branch `fullstack2-administration`).

## What is connected

| Page | What it does now | Routes |
| --- | --- | --- |
| `workspace` | Organizations tab: register archdiocese/parish, verify (operator), operating status (suspend/reinstate/close, jurisdiction bishop), location, association and jurisdiction proposals and decisions, ownership claims (open, respond, withdraw, decide), status history, platform homepage, MFA recovery review. Appointments tab: archdiocese staff and parish priests (invite, answer, suspend/resume/revoke/review), head priest designation and end, bishop appointments (propose, operator review, nominee answer). Access and billing tab: office coverage, grant and revoke, plans, coverage, invoices and cash receipts, payer schedule and transfers (propose from either side, answer, cancel), publish a plan (operator) | `GET /api/me/capacities`, `GET/POST /api/archdioceses[/{id}[/verify]]`, `GET/POST /api/parishes[/{id}[/verify]]`, `GET /api/administration/{parish,archdiocese}-verifications/{id}`, `POST .../parishes/{id}/status`, `GET .../status/history`, `GET .../office/coverage`, `GET/PUT .../location`, `.../association-requests`, `.../jurisdiction-proposals`, `.../ownership-claims`, `PUT .../grants`, `POST .../grants/revoke`, `/api/archdioceses/{id}/staff-appointments`, `.../parishes/{id}/priest-appointments` (+ `/head-designation`), `.../bishop-appointments`, `GET/POST /api/plans`, `.../billing/{coverage,invoices}`, `.../payer-schedule`, `.../payer-transfers`, `GET /api/administration/accounts/{id}/mfa-recovery-requests/{id}` and `/review` |
| `workspace` Platform tab (operators only) | Every parish and archdiocese (search, status filter, open into Organizations), every account (search, status filter, safe view), suspend and reinstate an account with reason and history, clergy titles (add, change, retire) and an account's title | `GET /api/administration/{parishes,archdioceses,accounts}`, `GET /api/administration/accounts/{id}`, `POST .../accounts/{id}/{suspend,reinstate}`, `GET .../accounts/{id}/status-history`, `GET/POST /api/clergy-titles`, `PUT /api/clergy-titles/{id}`, `GET /api/clergy-titles/accounts/{id}`, `PUT /api/administration/accounts/{id}/clergy-title` |
| `people` list menu (operators) | Suspend or reinstate the person's account (replaces the old `POST workspace/suspension`) | as above |
| `assignments` | The Appointments tab | as above |
| `workspace` homepage button | Draft, save, publish with per-language readiness (en, fr, ar) | `GET/PUT /api/administration/homepage/draft`, `POST .../publish` (`GET .../revisions` is wrapped, not shown) |
| `insights` | Visits by day, kind and language; parishes by status and jurisdiction; the parish follow-up worklist (stage, next action, follow-up, notes, history) | `GET /api/administration/insights`, `GET /api/administration/parish-crm/worklist`, `GET/PUT .../parishes/{id}/crm`, `.../crm/notes`, `.../crm/history` |
| `oversight`, `bishopeparchy`, `eparchy` | Per-parish counts for a period, measure definitions, parish list | `GET /api/archdioceses/{id}/overview` |
| `bishopmap` | Parishes with recorded coordinates, and those without | `GET /api/archdioceses/{id}/overview/map` |
| `forms` | Workflows (create, edit fields, visible-when rules and steps, save draft, publish, run mode), start a run, open tasks (record step, pause, resume, cancel), activity log | `/api/parishes/{id}/workflows`, `.../workflow-runs` (`/steps`, `/actions`, `/history`) |
| `reports` | Work overview counts; report schedules (create, pause, resume, cancel) and deliveries | `GET /api/parishes/{id}/work-overview`, `/api/report-schedules`, `/api/report-deliveries` |
| `audit` | With `audit.read`: the parish's general audit trail (action, resource, who by name, when; no reasons). Otherwise status changes and open-run history | `GET /api/parishes/{id}/audit`, `GET .../account-names`, `GET .../status/history`, `.../workflow-runs/{id}/history` |
| `settings` | Parish profile (read-only) and modules on or off, read from billing coverage | `GET /api/parishes/{id}`, `.../location`, `.../billing/coverage` |

Collections filled by `load` (when the account may read them; a 403 leaves them empty): `WORKFLOWS`, `RUNS`, `RUN_LOG`, `AUDIT`, and `PARISH` (name, town, contact, eparchy, status). Collections owned but always empty because the API has nothing for them: `FORM_FIELDS`, `FORM_RULES` (the form builder reads each workflow's template instead), `PERMISSIONS`, `SECURITY_ALERTS`, `RETENTION`, `WEBHOOKS`, `EXCEPTIONS`, `EPARCHY_NEWS`. Left to other modules: `ACCOUNTS` (people), `SESSIONS` (account), `AUTOMATIONS` (communications), `INCIDENTS` (check-in).

## Fields and features with no API equivalent (shown empty or not at all)

- Lists of every parish, archdiocese and account exist for platform operators only (each read audited). Archdiocese admins and bishops still see what their capacities reach. Bishop appointments, jurisdiction proposals, invoices and MFA recovery requests can still only be read one at a time, by reference.
- Creating accounts, passwords, a parish secretary on creation, guest-request review, membership review and bishop certificate acceptance (all in the old workspace) are not in these controllers; membership, requests and certificates belong to other modules.
- The audit trail covers the parish's main partition only: finance and restricted-case audit rows, and free-text reasons, are not returned. Rows are paged by id, so the screen reads up to 200 and sorts them by time.
- `settings.manage` still has no route (see open decisions).
- The people-list suspend item appears only once the people module fills `ACCOUNTS[personId]` with the linked account id; today nothing fills it.
- Parish profile edit (Arabic name, rite, phone, address, patron saint), colours, currency, languages, role permissions and exceptions, sessions and security alerts, retention, API keys and webhooks. The settings "Other settings" tab says so.
- Eparchy announcements and people or sacrament aggregates; a bishop's view of a parish's people, records, calendar and groups (the API gives counts only).
- A run's due date, owner and subject, and a workflow's average duration; automatic steps.
- The old Reports (attendance, giving, funds, volunteers) read other modules' collections and were replaced by the work overview and schedules.
- Email delivery of a report is recorded as requested and not sent.
- Per-site insight detail the old Python server gave (referrers, devices, funnels): the API records visits by day, kind (home, directory, parish page, request started) and language only.

## Open decisions for the owner

1. List routes for **archdiocese admins** (their parishes) and for bishop appointments, jurisdiction proposals and invoices. Operators now have parish, archdiocese and account lists.
2. The audit trail is built and read-only for `audit.read`; whether it should include finance (with `finance.read`) and reasons is open.
3. Whether `settings.manage` should get **parish profile and module routes** (Arabic name, rite, phone, address, photos). Today modules follow billing coverage only.
4. The workflow **permission list** in the builder is typed in the frontend (`forms.jsx`); an API listing of `Permissions.All` would replace it.
5. The old role names `parish_admin` and `finance_view` have no capacity in the API; they never appear.
6. Appointment actions that need a password and authenticator code ask for both in the form; the API refuses them from a recovery sign-in.
7. The homepage editor is edited by the administration module although it lives in `communicate/`; communications should leave it alone.
8. **Account suspension** is platform-wide and operator-only. The old screen offered a parish-only "deactivate parish access"; whether a parish office may remove one parish's access (a people-area link change) is open. Operator accounts and your own cannot be suspended from the list; whether that stays is open.
9. **Clergy titles** are an empty, operator-kept list in English and Arabic; no title is seeded. Which titles exist, whether bishops or archdiocese admins may assign them, and whether a title should show beside names in other screens are owner decisions.
10. **Eparchy and bishop view**: no eparchy announcements, people or sacrament aggregates were added; what a bishop may see beyond counts needs an owner decision.
11. **Parish settings** (`settings.manage`): currency, languages and similar settings were not added; the parish profile belongs to the public area, and which settings exist is an owner decision.

## Checks

`frontend/scripts/checks/administration.mjs` (run by `npm run check`) covers load (workflows read across two pages, runs, activity, audit, parish profile, a 403 leaving them empty), unsupported edits undone and reported, and the routes and bodies of run, step, grant, verify, status, appointment, homepage, report-schedule and payer-transfer calls, and the capacity scopes.
It also covers the general audit trail with names, the platform lists and the suspend, reinstate and clergy-title calls. Not exercised against a live API: it needs a verified account with capacities, which locally only the operator commands can create.
