# Administration module

Files: `frontend/src/portal/model/modules/administration.js` (the module contract), `administration-api.js` (one function per route), `features/administration/*`, `features/oversight/oversight.jsx`, and `features/communicate/homepage-editor.jsx` (the platform homepage editor, taken over from the old `workspace/site-content` route). Check: `frontend/scripts/checks/administration.mjs`.

Updated 12 November 2026.

## What is connected

| Page | What it does now | Routes |
| --- | --- | --- |
| `workspace` | Organizations tab: register archdiocese/parish, verify (operator), operating status (suspend/reinstate/close, jurisdiction bishop), location, association and jurisdiction proposals and decisions, ownership claims (open, respond, withdraw, decide), status history, platform homepage, MFA recovery review. Appointments tab: archdiocese staff and parish priests (invite, answer, suspend/resume/revoke/review), head priest designation and end, bishop appointments (propose, operator review, nominee answer). Access and billing tab: office coverage, grant and revoke, plans, coverage, invoices and cash receipts, payer schedule and transfers (propose from either side, answer, cancel), publish a plan (operator) | `GET /api/me/capacities`, `GET/POST /api/archdioceses[/{id}[/verify]]`, `GET/POST /api/parishes[/{id}[/verify]]`, `GET /api/administration/{parish,archdiocese}-verifications/{id}`, `POST .../parishes/{id}/status`, `GET .../status/history`, `GET .../office/coverage`, `GET/PUT .../location`, `.../association-requests`, `.../jurisdiction-proposals`, `.../ownership-claims`, `PUT .../grants`, `POST .../grants/revoke`, `/api/archdioceses/{id}/staff-appointments`, `.../parishes/{id}/priest-appointments` (+ `/head-designation`), `.../bishop-appointments`, `GET/POST /api/plans`, `.../billing/{coverage,invoices}`, `.../payer-schedule`, `.../payer-transfers`, `GET /api/administration/accounts/{id}/mfa-recovery-requests/{id}` and `/review` |
| `assignments` | The Appointments tab | as above |
| `workspace` homepage button | Draft, save, publish with per-language readiness (en, fr, ar) | `GET/PUT /api/administration/homepage/draft`, `POST .../publish` (`GET .../revisions` is wrapped, not shown) |
| `insights` | Visits by day, kind and language; parishes by status and jurisdiction; the parish follow-up worklist (stage, next action, follow-up, notes, history) | `GET /api/administration/insights`, `GET /api/administration/parish-crm/worklist`, `GET/PUT .../parishes/{id}/crm`, `.../crm/notes`, `.../crm/history` |
| `oversight`, `bishopeparchy`, `eparchy` | Per-parish counts for a period, measure definitions, parish list | `GET /api/archdioceses/{id}/overview` |
| `bishopmap` | Parishes with recorded coordinates, and those without | `GET /api/archdioceses/{id}/overview/map` |
| `forms` | Workflows (create, edit fields, visible-when rules and steps, save draft, publish, run mode), start a run, open tasks (record step, pause, resume, cancel), activity log | `/api/parishes/{id}/workflows`, `.../workflow-runs` (`/steps`, `/actions`, `/history`) |
| `reports` | Work overview counts; report schedules (create, pause, resume, cancel) and deliveries | `GET /api/parishes/{id}/work-overview`, `/api/report-schedules`, `/api/report-deliveries` |
| `audit` | Parish status changes and the history of open workflow runs | `GET .../status/history`, `.../workflow-runs/{id}/history` |
| `settings` | Parish profile (read-only) and modules on or off, read from billing coverage | `GET /api/parishes/{id}`, `.../location`, `.../billing/coverage` |

Collections filled by `load` (when the account may read them; a 403 leaves them empty): `WORKFLOWS`, `RUNS`, `RUN_LOG`, `AUDIT`, and `PARISH` (name, town, contact, eparchy, status). Collections owned but always empty because the API has nothing for them: `FORM_FIELDS`, `FORM_RULES` (the form builder reads each workflow's template instead), `PERMISSIONS`, `SECURITY_ALERTS`, `RETENTION`, `WEBHOOKS`, `EXCEPTIONS`, `EPARCHY_NEWS`. Left to other modules: `ACCOUNTS` (people), `SESSIONS` (account), `AUTOMATIONS` (communications), `INCIDENTS` (check-in).

## Fields and features with no API equivalent (shown empty or not at all)

- **No list of all parishes, archdioceses or accounts.** The workspace shows what the account reaches through its capacities and anything opened by reference (kept for the browser session). A platform operator with no capacity in a parish must paste a parish or archdiocese reference. Bishop appointments, jurisdiction proposals, invoices and MFA recovery requests can only be read one at a time, so they are opened by the reference the create call returned.
- Creating accounts, passwords, clergy titles, suspending an account, a parish secretary on creation, guest-request review, membership review and bishop certificate acceptance (all in the old workspace) are not in these controllers; membership, requests and certificates belong to other modules.
- A general audit trail. Permissions `audit.read` and `settings.manage` exist but no route reads them.
- Parish profile edit (Arabic name, rite, phone, address, patron saint), colours, currency, languages, role permissions and exceptions, sessions and security alerts, retention, API keys and webhooks. The settings "Other settings" tab says so.
- Eparchy announcements and people or sacrament aggregates; a bishop's view of a parish's people, records, calendar and groups (the API gives counts only).
- A run's due date, owner and subject, and a workflow's average duration; automatic steps.
- The old Reports (attendance, giving, funds, volunteers) read other modules' collections and were replaced by the work overview and schedules.
- Email delivery of a report is recorded as requested and not sent.
- Per-site insight detail the old Python server gave (referrers, devices, funnels): the API records visits by day, kind (home, directory, parish page, request started) and language only.

## Open decisions for the owner

1. A **list route** for parishes, archdioceses and accounts for platform operators and archdiocese admins, and for bishop appointments, jurisdiction proposals and invoices. Without one, administrators work by reference.
2. Whether an **audit read route** should exist for `audit.read`.
3. Whether `settings.manage` should get **parish profile and module routes** (Arabic name, rite, phone, address, photos). Today modules follow billing coverage only.
4. The workflow **permission list** in the builder is typed in the frontend (`forms.jsx`); an API listing of `Permissions.All` would replace it.
5. The old role names `parish_admin` and `finance_view` have no capacity in the API; they never appear.
6. Appointment actions that need a password and authenticator code ask for both in the form; the API refuses them from a recovery sign-in.
7. The homepage editor is edited by the administration module although it lives in `communicate/`; communications should leave it alone.

## Checks

`frontend/scripts/checks/administration.mjs` (run by `npm run check`) covers load (workflows read across two pages, runs, activity, audit, parish profile, a 403 leaving them empty), unsupported edits undone and reported, and the routes and bodies of run, step, grant, verify, status, appointment, homepage, report-schedule and payer-transfer calls, and the capacity scopes.
Not exercised against a live API: it needs a verified account with capacities, which locally only the operator commands can create.
