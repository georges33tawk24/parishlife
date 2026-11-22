# How ParishLife is built

This page explains the parts of ParishLife, how a request travels through them, where the data lives, and why the main decisions were made. It is written so that you can explain and change the system without help. Facts come from the code as of 22 November 2026. Where something is unknown, the page says so.

More detail lives in:
- [docs/architecture/backend-foundation.md](architecture/backend-foundation.md): the original backend structure and its limits.
- [docs/architecture/dto-model-conventions.md](architecture/dto-model-conventions.md): how request, response and stored classes are written.
- [frontend/ARCHITECTURE.md](../frontend/ARCHITECTURE.md): the frontend folders, how a portal screen works, and where to change things.
- [hardening/PROJECT_MAP.md](../hardening/PROJECT_MAP.md): the full inventory of every route (636 controller actions), every stored document type, every setting and every cookie.

## The parts

**One web application** (`ParishLife.Api`, ASP.NET Core on .NET 10) does everything on the server:
- it answers the JSON API under `/api`;
- it serves the built pages from its `wwwroot` folder;
- it runs five small background workers.

It is hosted on one Azure App Service (`app-parishlife`, Linux, plan B1, one instance, France Central). There is no separate frontend host, function app or queue.

**The frontend** (`frontend/`, React 19 built by Vite 7, plain JavaScript) is a set of static pages:
- `index.html`: sign-in and the members' portal, with screens chosen by `#/…` hash routes;
- `public.html`: the public parish directory and parish pages, chosen by the query string;
- `landing.html`: the product page;
- `privacy.html`, `terms.html` and `cookies.html`.

Everything is drawn in the browser. One exception: for `public.html?parish=<id>` and `/sitemap.xml`, the server writes the page head itself, so search engines see the parish name (`Middleware/PublicPages.cs`).

**Data** lives in Azure:
- Cosmos DB for NoSQL, serverless, database `ParishLife`, five containers;
- private Blob Storage `storageparishlife`: uploaded files, and the Data Protection key ring;
- Key Vault `keyvault-parishlife`: the key that wraps the key ring, and the secrets that App Service settings refer to.

The app reaches all three with its user-assigned managed identity `id-parishlife`, so there are no passwords or keys in its settings. The Cosmos and Storage firewalls admit only the app's subnet.

**Outside services**, each optional and off unless its settings are present:
- Cloudflare Turnstile: the bot check on sign-in, sign-up and public forms;
- Resend: account code emails;
- Google and Microsoft: sign-in;
- Application Insights: telemetry.

There is no payment provider, no SMS, no AI model and no third-party analytics.

**Tools that are not deployed:**
- `ParishLife.AppHost`: an Aspire dashboard for local runs.
- `tools/ParishLife.Maintenance`: a private operator console for the two bootstrap accounts, readiness checks and data snapshots.
- `tools/Publish-ParishLife.ps1`: builds the deploy package.
- `tools/Initialize-Cosmos.ps1`: creates containers and index policies from `docs/cosmos/containers.json`.
- The test projects: `ParishLife.UnitTests`, `ParishLife.IntegrationTests`, and `ParishLife.EndToEnd` (the test-only host for the browser tests).

## The API's folders

| Folder | What lives there | Why it is separate |
|---|---|---|
| `Controllers/<Area>/` | thin HTTP endpoints, one class per resource, grouped in 18 areas (Accounts, People, Sacraments, Scheduling, Finance…) | They only translate HTTP to a service call; no rules live here |
| `Services/<Area>/` | the business rules **and the permission checks** for each area | One place to read what a parish office may do, and to test it |
| `Authorization/` | `ParishAccess` (parish grants and the one selected staff appointment), clergy and archdiocese authority, `CurrentActor`, the CSRF filter, the Turnstile and recovery-session attributes, `SecurityEvents` | Shared checks that every service calls |
| `Identity/` | accounts, sessions, the Cosmos user store, Google/Microsoft OAuth, operator rules, the bootstrap of the two operators | Sign-in is its own world, with its own storage partition |
| `Repositories/`, `Interfaces/Repositories/` | reading and writing records: `RecordTransactions` (scoped records, operation receipts, audit), plus per-area repositories | Keeps storage details out of the rules |
| `Data/Cosmos`, `Data/Local`, `Data/Blob` | the document database and file store, in two versions: Azure, and local files for development and tests | Development and every test run without Azure |
| `Models/`, `DTOs/<Feature>/` | stored classes (one per file) and request/response classes with validation attributes | The project's conventions (`AGENTS.md`) |
| `Middleware/` | problem-details error handler, recovery-session gate, public cache, server-written public pages | Cross-cutting behaviour around every request |
| `BackgroundJobs/` | five workers (below) | Work that must happen after the request returns |
| `Extensions/` | service registration and configuration checks, frontend hosting with its page policy (CSP), telemetry | Startup in one readable place |

## How a request travels

Take a parish secretary saving a new calendar event:

1. **Browser.** The portal (`frontend/src/portal/model/api.js`) sends `POST /api/parishes/{id}/calendar/events` with:
   - the session cookie `__Host-ParishLife`;
   - the anti-forgery header `X-CSRF-TOKEN`, from `GET /api/auth/csrf`;
   - the chosen staff appointment in `X-ParishLife-Appointment`;
   - an `OperationId`, which makes a retried save harmless.
2. **App Service front end.** It ends TLS, appends the caller's address to `X-Forwarded-For`, and passes the request to Kestrel over HTTP/1.1.
3. **Middleware**, in the order of `Program.cs`:
   - The forwarded-headers step trusts only the one front-end hop, so a client cannot fake its address.
   - The error handler turns failures into problem details with a trace id.
   - HSTS and HTTPS redirection.
   - Security headers on every answer (`nosniff`, `DENY` framing, referrer and permissions policies), and `Cache-Control: no-store` on `/api`.
   - Compression, for pages and assets only, never for `/api`.
   - The static pages, which are answered here and never count against the API limits.
   - The rate limiter: 200 requests a minute per address, and 20 a minute on sign-in and other account actions.
   - Cookie authentication, which **checks the server-side session on every request**: a sign-out, a password change or a suspension ends the session at once.
   - The recovery-session gate: a restricted recovery sign-in reaches only the few actions marked `[AllowRecoverySession]`.
4. **Controller.** Every action needs a signed-in user unless it is marked anonymous (43 are). The global CSRF filter checks the anti-forgery header on every write. Input classes are validated by their attributes.
5. **Service.** It loads the caller (`CurrentActor`) and asks `ParishAccess` whether this account, through this one appointment, holds the needed permission (`Models/Permissions.cs`) in this parish. Permissions from two appointments never add up. Something the caller may not see answers 404, not 403. Then the rules run: dates, capacity, conflicts, versions.
6. **Write.** The change, an **operation receipt** (who, which request fingerprint, the result) and an **audit row** (who, what, why, through which appointment) are written together in one Cosmos transactional batch inside the parish's partition, conditional on the record's ETag:
   - Two people saving at once cannot overwrite each other: the second gets 409.
   - A retried request with the same operation id gets the first answer back.
   - Credentials never enter receipts or audit rows.
7. **Answer.** JSON with the new version. A save that changes public content also clears the in-memory public read cache.
8. **Telemetry.** When Application Insights is configured, the request, its Cosmos calls and any warning are recorded under one trace id. That is the reference a user sees on an error message.

Anonymous public reads (the directory, a parish profile, its website, the liturgical calendar, the homepage, the app manifest, the offline policy) take a shorter path. They are cached in memory and by browsers (`[PublicCache]`, `Data/Cosmos/PublicReadCache.cs`), and any public write clears the cache at once.

## Where data lives

| Container | Partition key values | What is in it |
|---|---|---|
| `Accounts` | `account:<id>` | Sign-in accounts, sessions, MFA, passkeys, personal profile, personal notes and tasks |
| `LoginAliases` | `email:<hash>`, `username:<hash>` | Email and username lookups (SHA-256 of the normalized value), so sign-in finds the account without a scan |
| `TenantControl` | `parish:<id>`, `archdiocese:<id>`, `resource:<id>` | Everything a parish holds: people, households, sacraments and certificates, calendar, facilities, ministries, registrations, finance records, requests, communications, plus each partition's receipts and audit rows. Archdiocese partitions hold bishop and staff appointments; resource partitions hold booking locks. |
| `Billing` | `billing:<id>`, `activation:…`, `invoice:…`, `cash:…` | Platform plans, invoices and recorded cash receipts. Nothing is charged online. |
| `Catalog` | `plans`, `platform:<owner>` | The plan catalogue, the published homepage, clergy titles, daily visit counts, platform operations audit |

- **Envelope:** every item is `{ id, partitionKey, type, data, schemaVersion, _etag }`.
- **No joins:** records point to each other by id strings.
- **Tenant isolation** is the partition key plus the service checks. Cosmos has no row-level security, and the app's identity can reach every partition, so the service checks are the boundary that matters.
- **Indexes:** each container indexes only the paths listed in `docs/cosmos/containers.json`. The local store refuses a query on any other path, so a missing index fails in tests, not in production. The readiness check refuses a live policy that lacks a needed path.
- **Files:** uploads go to the Blob container `evidence`: request files (PDF, JPEG, PNG; up to 10 MB), parish photos and signature images. Each is checked by its first bytes, not its name.
- **Encrypted fields:** the most sensitive free text (pastoral notes, concerns, incidents, person facts, MFA keys and recovery codes) is encrypted with ASP.NET Core Data Protection before it is stored. The key ring is in Blob, wrapped by the Key Vault key, so a database copy alone cannot read those fields.
- **Nothing is deleted automatically.** No retention periods are approved yet. Account closure removes the person's account data and keeps parish records.
- **Backups:** Azure's own (Cosmos continuous backup, Blob soft delete; not confirmed in Azure), plus operator snapshots ([data-snapshot-and-recovery.md](operations/data-snapshot-and-recovery.md)).

## Background workers

They run inside the web app, only when `BackgroundJobs:Enabled` is true. There is one instance, so no lock is needed.

| Worker | Every | Does |
|---|---|---|
| `BillingActivationWorker` | 15 s | turns recorded billing work into active module coverage |
| `ReservationWorker` | 15 s | confirms or rolls back pending room and equipment bookings |
| `NotificationWorker` | 15 s | delivers in-app notifications from their durable outbox |
| `ReportScheduleWorker` | 1 min | runs due report schedules (in-app) |
| `BroadcastScheduleWorker` | 1 min | sends due scheduled broadcasts and automations (in-app) |

A failed pass logs "… requires retry" with the failure type and tries again on the next tick. The alert `parishlife-background-work-failing` watches for that.

## Key decisions and why

- **One app serves the pages and the API (owner decision, 17 November 2026).** The cookies are `__Host-`, `Secure` and `SameSite=Strict`, and there is no CORS. Pages and API on one origin make that work with no cross-site setup, at no extra hosting cost.
- **Cookie sessions checked on the server, not tokens.** A stolen cookie dies when the session is ended. Sign-out, a password change and a suspension take effect at once.
- **Permissions in services, not attributes.** Parish permissions depend on the parish, the one selected appointment, ministry roles and paid modules. Only the service knows all of these. The sweep test checks that every protected route answers 401 to an anonymous caller.
- **One selected staff appointment per request.** A priest who is also a treasurer acts as one or the other, so a mistake cannot use the sum of both.
- **ETag-checked batches with receipts and audit in the same partition.** Saves are safe to retry and never overwrite someone else's work, and the history cannot drift from the data.
- **Cosmos serverless.** A pilot of a few parishes pays only for what it uses, with no minimum throughput.
- **Managed identity and Key Vault references.** No connection string, account key or client secret lives in settings or code. Microsoft sign-in even uses the identity instead of a client secret.
- **A local file store with the same interface.** Every test and every developer runs without Azure. The local store enforces the same index contract, so it catches missing indexes early.
- **No seed data.** The only accounts created by a command are the two operators, `colinsleiman` and `georgestawk`, by a private interactive command with MFA. Nothing invents a parish or a person.
- **Telemetry records types, not contents.** Logs keep exception types, status codes and security event codes, never passwords, codes, tokens, emails or bodies.

## What is not known or not proven

- **Cosmos behaviour under real concurrency** (for example the receipt counter) is proven only on the local store.
- **Azure settings that are not in the repository:** backup mode, log retention, IP masking, alert rules, and who holds which role. See [operations/production-access.md](operations/production-access.md) and [operations/monitoring-and-alerts.md](operations/monitoring-and-alerts.md).
- **The pipeline in `.github/workflows/ci.yml`** has not run on GitHub yet.
