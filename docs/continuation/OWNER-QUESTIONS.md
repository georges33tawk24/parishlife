# Owner questions blocking backend completion and frontend connection (11 November 2026)

Answer by number. "Default" is what the backend does today or what is recommended; answering "default" accepts it. Nothing here is treated as approved until the owner answers.

## Decided by the owner, 21–23 November 2026 (approved policy)

| Question | Decision | Code today |
| --- | --- | --- |
| 4. First archdiocese / rite | **Maronite; the Maronite Archeparchy of Beirut** (named 23 November). It is entered through the app by its authorized people, never seeded. | Rite is free text; nothing to change. |
| 5. Electronic signatures (U05) | **The paper copy, wet-signed and sealed, is the official one.** The digital copy is for reference and verification. | Matches: signed letters stay "reference only". |
| 6. Who signs request letters | **The priest only.** | Matches. |
| 7. Who prepares liturgical calendars | **The bishop, or a delegate he approves.** The delegate prepares; the bishop approves before it applies. | **Done (23 November):** the bishop names delegates (`PUT …/liturgical-calendars/delegates`) who prepare drafts; approving stays with the bishop. No portal screen yet for bishop calendar editing. |
| 17. Money: currencies | **LBP and USD both.** Each amount keeps its own currency, totals stay separate, no automatic conversion. | Matches (no converted figures shown). |
| Finance 2. Receipt numbers | **Year + number per parish**, e.g. `2026-0001`, restarting each year. | **Done (23 November):** `2026-0001`, restarting each 1 January in Beirut time; earlier receipts keep their plain number. |
| 18. Minors | **Accounts from age 13. Children are recorded and registered by the parish office only**; parents do not act for them in the app. | **Checked (23 November):** self-service routes act only on the person's own linked record, and household registration needs the office's permission. A parent may still *ask* the office for something for a child (e.g. a baptism); the office matches the child's record and reviews the parent's authority. |
| Requests 4. Guest files | **Yes, with the built limits** (10 MB each, 20 per request, office-only access). | Matches. |
| People 2. Member vs Visitor | **Members only for event registrations, joining ministries and sacrament requests.** Visitors contact the office for those. | **Done (23 November):** registering yourself, applying to join a ministry and asking for a sacrament online need RegisterStatus Member (`members_only` otherwise); office staff acting for someone are not limited. People the office has not recorded as Members count as not yet members. |
| 19 / Admin 10. Bishop's view | **Totals only:** counts and summaries, no individual names or records. | Matches today's aggregates; keep it so. |
| Sacraments 9. Preparation requirements | **The archdiocese sets one checklist per sacrament for all its parishes.** | **Done (23 November):** the bishop sets the list (`PUT api/archdioceses/{id}/sacrament-requirements`); its parishes use it and cannot save their own for that sacrament; without one, a parish's own list applies. |
| 8. Custom workflows | **The parish priest always may manage the parish's workflows** (decided 23 November). | **Done (23 November):** the parish priest manages workflows without a grant, unless a grant explicitly denies `workflows.manage`. Restricted answers stay with explicit grants. |
| 9. Archdiocese billing representative | **A named representative account**, separate from whoever registered the archdiocese. | **Done (23 November):** the bishop names the representative (`PUT api/archdioceses/{id}/billing-representative`, a verified account with two-factor); payer transfers use it. Until one is named, the registering account stays representative. No portal screen yet. |
| 10. Parish control (replaces "contested ownership", 23 November) | **Only ParishLife administrators, the bishop or someone he appointed register a church. The appointed parish priest controls the parish; the bishop and his administrators run it but never see personal records. Nobody else can claim a parish.** A church may have no archdiocese; a ParishLife administrator then hands its control over. | **Done (23 November):** registration refused to anyone else (`church_authority_required`); a church registered under its archdiocese is verified at once and its bishop/administrator registrar holds only parish details, settings, publishing, schedule, facilities and billing; `POST api/parishes/{id}/control` hands control to a priest appointed to that parish, ending the previous controller's access. Ownership claims and the read-only freeze were removed. Not built: the bishop changing details of a parish he did not register. |
| 11. Exact-message review (N02) | **Keep:** operators only, a second approver, access for 5 minutes to 24 hours. | Matches. |
| 13. Sign-in before email is verified | **No: confirm the emailed code first.** | Matches. |
| 14. Small-count hiding | **Counts of 1–4 in bishop totals show as "fewer than 5".** | **Done (23 November):** requests, certificates and membership requests of 1–4 show as "fewer than 5" in rows and totals; priest, staff and event counts stay exact. |
| 15. Retention | **Parish records and audit are kept permanently; read notifications are deleted after 1 year; anonymous site counts after 2 years.** | **Done (23 November):** a background job deletes notices read or archived over a year ago and site counts over two years old; unread notices stay. The privacy page says the same. |
| 16. Backups (U15) | **Database point-in-time restore for 30 days (up from 7), and a restore test every 3 months.** Deleted files stay recoverable for 30 days. | **Done (23 November):** Cosmos `Continuous30Days`; blob and container soft delete were already 30 days; privacy page says 30 days. The quarterly restore test is not scheduled yet. |
| 26. Test database | **Yes: a separate, small Cosmos test database** for live tests, never holding real data. | **Done (23 November):** `ParishLifeTest` created with the manifest containers (empty; the app identity cannot reach it). **Live tests (23 November):** `ParishLife.IntegrationTests/Live` runs only against `ParishLifeTest` (any other name is refused), skipped unless opted in; see `docs/operations/live-tests.md`. Not run yet: the Cosmos firewall is closed. |

| Appointments by a super admin (23 November) | **A ParishLife super admin may appoint priests and ministry leaders too, not only the bishop (and the priest for leaders).** | **Done (23 November):** a super admin can invite and manage priest and archdiocese-staff appointments, decide a church's jurisdiction, and name ministry leaders. A priest still needs the church under a verified archdiocese. |

Still open (to answer next):
- the remaining per-area items in `docs/frontend-modules/*.md`;
- the proposals in `docs/REMAINING-WORK.md`.

## A. Frontend connection

1. **Which branch is the frontend to connect?** `frontend` (4 Nov) or `frontend-new2` (Georges, 9 Nov)? Default: `frontend-new2`.
2. **Hosting.** The React frontend currently talks to its own Python/SQLite (`server.py`) or Cloudflare Workers/D1 backend using a whole-parish "state" download and collection save. Connecting it to the .NET API means replacing that data layer and dropping `server.py`/D1 as the backend. Serve the built React files from where: Azure (App Service/Static Web Apps) or Cloudflare Pages? Same domain as the API (simplest for cookies, CSRF and passkeys) or separate? Default: same domain.
3. **Who does the frontend integration:** me on a new branch, Georges, or both split by module? Default: I start on a new branch from `frontend-new2`, module by module, starting with sign-in and the members home.

## B. Church facts and authority (real inputs; never invented)

4. First archdiocese: exact jurisdiction, **rite**, approving authority, and the **liturgical calendar source** (U02, S01.07, S16.11).
5. **Electronic signatures (U05):** is a digital signature official, or is wet-signed/sealed paper the only official copy? Default: paper official, digital "reference only".
6. **Who signs request letters:** priest only, or may a secretary/office signer be granted it? Default: priest only.
7. **Who prepares liturgical calendars:** bishop only, or a delegated preparer with bishop approval? Default: bishop only.
8. **Can a priest appointment own/manage custom workflows** (`workflows.manage`)? Default: no; explicit parish grant only.

## C. Governance and trust

9. **Archdiocese billing representative** for payer transfers: today it is the account that registered the archdiocese (usually a platform operator). Use a named representative account instead? Default: named representative.
10. **Contested parish ownership:** one platform operator decides today. Require a second reviewer, church-authority confirmation, or an appeal? Freeze the parish while contested? Default: one operator, no freeze.
11. **Exact-message review (N02):** platform operators with a second approver, window 5 minutes to 24 hours. Different reviewer audience or limits? Default: keep.
12. **Passkeys:** count only as a password replacement (MFA accounts still need the authenticator), or as full MFA? Default: password replacement only.
13. **Sign in before email is verified** (proposed S06.05)? Default: no.

## D. Policy numbers

14. **Small-count hiding** in bishop aggregates (e.g. show "<5")? Default: none.
15. **Retention periods:** site metrics, notifications, audit, deleted/archived records, backups. Default: none set, nothing purged automatically.
16. **Backups (U15):** schedule, retention, RPO/RTO, who keeps snapshots and the key ring, restore-test frequency.
17. **Money:** currencies (LBP/USD dual reporting?), refund/cancellation rules for registrations and rentals, fee rules, finance approval limits.
18. **Minors and guardians:** age threshold for self-service, guardian consent scope, who may register/act for a child.
19. **Bishop overview measures:** approve definitions for finance/giving, attendance, participation and membership-change measures, or leave them out.

## E. External services (to configure; keys go to Key Vault, never chat or Git)

20. Email (and SMS?) provider, e.g. Azure Communication Services or SendGrid.
    **Decided by the owner (21 November 2026):**
    - **Resend**, from `ParishLife <no-reply@parish-life.org>`: account codes, personal notices, scheduled-report notices and parish broadcasts.
    - **WhatsApp** through Meta's WhatsApp Cloud API.
    - **Web push** to phones and browsers.
    - **No SMS.**

    Setup: `docs/operations/notification-delivery.md`.
21. Sign-in providers: Google, Microsoft, Apple? Their app registrations.
    **Decided by the owner, 19 November 2026 (approved policy):** (a) signing up with Google or Microsoft creates an account with no password; one can be added later in My account, and the last usable sign-in method cannot be removed (S06.11). (b) A provider-verified email counts as a confirmed email, so these accounts sign in without an email code; never merge: if any account already holds that email, nothing is created (`email-in-use`), and the subject stays the stable `sub`, stored hashed. (c) Google and Microsoft now; Apple deferred (paid developer program, `form_post` callback). Microsoft should use the managed identity instead of a secret where Microsoft accepts it. Built on `fullstack-integration`; see `docs/operations/account-sign-in-methods.md`. The app registrations are made in the Azure session.
21a. **Privacy policy and terms of use: decided by the owner, 21 November 2026.** Operator "ParishLife"; contact `privacy@parish-life.org`; Lebanese law; accounts from age 13; effective 21 November 2026; draft banner removed. Details: `docs/operations/legal-pages.md`.
22. Turnstile: on or off? Cloudflare keys.
23. Online payments: any provider, or cash/bank only for now? Default: none.
    **Decided by the owner (21 November 2026): not now.** Cash and bank transfers only, recorded by the office.
24. Map tiles/directions provider for the public map, if any.
    **Decided by the owner (21 November 2026): Google Maps, integrated by the owner.** "Get directions" already opens Google Maps through a plain link (no key). An embedded Google map will also need:
    - a browser API key restricted to `parish-life.org`. A browser key is public by nature, so it goes in App Service settings, not Key Vault;
    - the page Content-Security-Policy to allow Google's map domains (`FrontendHostingExtensions`);
    - a privacy-page line: Google receives the visitor's address when a map loads.

    The Maps Embed API (an iframe) has no usage charge; the JavaScript API is billed beyond Google's free allowance.

## F. Azure connection

25. Authorize me to (a) run read-only checks against the existing Azure resources with a developer login, (b) run the Cosmos container initialization script, (c) set App Service configuration, (d) grant the managed identity access to the evidence container (Q11 RBAC), (e) run live write acceptance tests in a non-production database, (f) deploy the API? Or will you perform them from `docs/azure-manual-setup/production.md`? Each needs its own explicit yes.
26. Is there a separate test/staging Cosmos database for live tests, or only production?
27. Bootstrap: when should the two allowed accounts (`colinsleiman`, `georgestawk`) be created through the private operator procedure, and by whom?
