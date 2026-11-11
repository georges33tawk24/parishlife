# Owner questions blocking backend completion and frontend connection (11 November 2026)

Answer by number. "Default" is what the backend does today or what is recommended; answering "default" accepts it. Nothing here is treated as approved until the owner answers.

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
21. Sign-in providers: Google, Microsoft, Apple? Their app registrations.
22. Turnstile: on or off? Cloudflare keys.
23. Online payments: any provider, or cash/bank only for now? Default: none.
24. Map tiles/directions provider for the public map, if any.

## F. Azure connection

25. Authorize me to (a) run read-only checks against the existing Azure resources with a developer login, (b) run the Cosmos container initialization script, (c) set App Service configuration, (d) grant the managed identity access to the evidence container (Q11 RBAC), (e) run live write acceptance tests in a non-production database, (f) deploy the API? Or will you perform them from `docs/azure-manual-setup/production.md`? Each needs its own explicit yes.
26. Is there a separate test/staging Cosmos database for live tests, or only production?
27. Bootstrap: when should the two allowed accounts (`colinsleiman`, `georgestawk`) be created through the private operator procedure, and by whom?
