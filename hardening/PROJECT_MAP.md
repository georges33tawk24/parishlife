# ParishLife project map

Written by Agent 01 (recon) on 21 November 2026 from branch `hardening/01-recon` at `abf17e3` (cut from `fullstack-hardening`). Read-only: no code was changed, built or run, except read-only `grep`/parsing and four HEAD requests to public production URLs.

How to read this map:
- Every statement points to a file. Where the code and the docs disagree, the code wins and the mismatch is listed in section 16.
- **Unverified** means the repository cannot prove it (usually an Azure setting); the note says what was checked.
- Paths are relative to the repository root. `Api/` is short for `ParishLife.Api/`.

---

## 1. Stack

| Part | What is used | Where it is set |
|---|---|---|
| Language and runtime (backend) | C# on .NET 10 (`net10.0`, nullable on, warnings as errors, `AnalysisLevel` latest). SDK pinned to 10.0.401 with `rollForward: latestPatch`. | `global.json`, `Directory.Build.props` |
| Framework (backend) | ASP.NET Core 10 with attribute-routed MVC controllers (`[ApiController]`), plus three minimal endpoints for health and OpenAPI. One production project. | `Api/Program.cs`, `Api/ParishLife.Api.csproj` |
| Language and framework (frontend) | Plain JavaScript (no TypeScript) with React 19.2.0 and React DOM 19.2.0, GSAP 3.15.0 and Lenis 1.3.26 (scroll motion), built by Vite 7.3.7 with `@vitejs/plugin-react` 5.2.0. Five HTML entries: `index.html` (sign-in and portal), `public.html` (public site), `landing.html` (product page), `privacy.html`, `terms.html`. | `frontend/package.json`, `frontend/vite.config.js` |
| Package managers | NuGet with lock files (`RestorePackagesWithLockFile`, `packages.lock.json` in each project); npm with `frontend/package-lock.json`. No Node version pin (no `engines`, no `.nvmrc`). | `Directory.Build.props`, `*/packages.lock.json`, `frontend/package-lock.json` |
| Backend packages | `Microsoft.AspNetCore.OpenApi` 10.0.14, `Microsoft.EntityFrameworkCore.Cosmos` 10.0.14 (plan catalogue only), `Microsoft.Azure.Cosmos` 3.63.2, `Azure.Identity` 1.21.0, `Azure.Storage.Blobs` 12.30.1, `Azure.Extensions.AspNetCore.DataProtection.Blobs` 1.5.3, `Azure.Extensions.AspNetCore.DataProtection.Keys` 1.6.3, `Microsoft.OpenTelemetry` 1.2.0, `System.Security.Cryptography.Pkcs` 10.0.14 (pin). | `Api/ParishLife.Api.csproj` |
| Hosting | Azure App Service `app-parishlife`, Linux, `DOTNETCORE\|10.0`, plan `plan-parishlife` B1 with 1 instance, France Central, resource group `rg-parishlife`, VNet-integrated, `httpsOnly`, min TLS 1.2, FTPS-only, Always On, health-check path `/health/ready`. The API serves the built frontend from `wwwroot` on the same origin. | Docs only: `docs/continuation/AZURE-CONNECTION.md` lines 20–32, `docs/operations/frontend-hosting.md`. Code side: `Api/Extensions/FrontendHostingExtensions.cs`. **Unverified** in Azure (no access). |
| Domain and CDN | `parish-life.org`. Cloudflare DNS. The apex `A` record points straight at App Service and is **DNS only** (not proxied). `www` is proxied by Cloudflare only to 301-redirect to the apex. No CDN in front of the app. | `docs/operations/frontend-hosting.md` ("Custom domain"). Confirmed by HEAD requests on 21 November 2026: apex answers `Server: Kestrel` over HTTP/1.1; `www` answers `server: cloudflare` 301 over HTTP/2. |
| Database | Azure Cosmos DB for NoSQL, serverless, database `ParishLife`, Strong consistency, five containers partitioned on `/partitionKey`. Accessed with the Cosmos SDK (`CosmosDocumentDatabase`) and, for the plan catalogue only, EF Core Cosmos (`PlanDbContext`). Local development uses JSON files under `.parishlife-data/`. | `docs/cosmos/containers.json`, `Api/Configuration/CosmosOptions.cs`, `Api/Data/Cosmos/*`, `Api/Data/Local/*`, `Api/Extensions/ServiceCollectionExtensions.cs` |
| Query layer | Own document layer: `PartitionDocuments` (ETag-checked reads/writes, `TransactionalBatch` per partition), `RecordTransactions` (scoped records, operation receipts, audit), repositories in `Api/Repositories/*`. No ORM except the EF Core plan catalogue. | `Api/Data/Cosmos/PartitionDocuments.cs`, `Api/Repositories/Common/RecordTransactions.cs` |
| Auth | App's own accounts: ASP.NET Core Identity core (`AddIdentityCore`) with a custom Cosmos user store, password hasher (PBKDF2, framework default), lockout after 5 failures for 15 min, passwords of 16+ characters, confirmed account required. Cookie session `__Host-ParishLife` (8 h, not sliding) backed by a server-side session record checked on every request. TOTP authenticator, one-use recovery codes, restricted recovery sessions, passkeys (WebAuthn, user verification required), Google and Microsoft OAuth with PKCE (live since 20–21 November per docs). | `Api/Program.cs`, `Api/Extensions/ServiceCollectionExtensions.cs` (`RegisterIdentity`, `RegisterAuthenticationCapabilities`), `Api/Identity/*`, `Api/Services/Accounts/*` |
| Authorization | No ASP.NET policies or roles. Every controller requires a signed-in user unless `[AllowAnonymous]`. Permissions are checked inside services: parish grants or one selected staff appointment (`X-ParishLife-Appointment` header) against `Models/Permissions.cs`, platform operator plus MFA, bishop appointment, clergy authority, ministry roles, paid module coverage. | `Api/Authorization/*`, `Api/Identity/AccountAccess.cs`, `Api/Models/Permissions.cs` |
| Bot check | Cloudflare Turnstile on 7 anonymous actions, enforced only when `Turnstile:SiteKey` and `Turnstile:SecretKey` are set (switched on in production on 19 November per docs). | `Api/Authorization/TurnstileProtectedAttribute.cs`, `Api/Services/Accounts/TurnstileVerifier.cs`, `frontend/src/lib/turnstile.js` |
| Payment provider | **None.** Finance records offline gifts and receipts in LBP and USD; platform plans, invoices and cash receipts are recorded by operators. `CapabilityService` reports online payments "Not configured". | `Api/Services/Operations/CapabilityService.cs`, `Api/Services/Billing/*`, `Api/Services/Finance/*` |
| File storage | Private Azure Blob Storage `storageparishlife`, container `evidence` (request files, parish profile photos, clergy signature images); container `data-protection` holds `keyring.xml`. Local development: `.parishlife-data/evidence`. | `Api/Data/Blob/BlobEvidenceStore.cs`, `Api/appsettings.json`, `Api/Services/Files/EvidenceService.cs`, `Api/Services/Publishing/ParishProfileService.cs`, `Api/Services/Sacraments/ClergySignatureImageService.cs` |
| Key management | Data Protection key ring in Blob, wrapped by Key Vault key `parishlife-data-protection` (`keyvault-parishlife`). User-assigned managed identity in Azure; `DefaultAzureCredential` (managed identity excluded) for developers. | `Api/Extensions/ServiceCollectionExtensions.cs` (`ConfigureDataProtection`) |
| Email provider | Resend (`POST https://api.resend.com/emails`), only for one-use account codes (sign-up email confirmation, email change). Off unless `Email:Provider`, `Email:ResendApiKey` and `Email:From` are all set. The docs say no email had been sent through the real Resend yet. | `Api/Services/Accounts/ResendContactCodeDelivery.cs`, `Api/Configuration/EmailOptions.cs`, `docs/operations/email-delivery.md` |
| SMS, push, WhatsApp | None. Broadcast channels Email/SMS/Push are always reported "NotConfigured"; only in-app delivery exists. | `Api/Services/Communications/BroadcastService.cs` lines 28, 265–266 |
| Analytics | No third-party analytics. The public site posts anonymous daily counts (4 kinds, language, parish) to the API; skipped when Do Not Track or Global Privacy Control is on. | `frontend/src/lib/beacon.js`, `Api/Controllers/Reporting/SiteMetricsController.cs`, `Api/Repositories/Reporting/SiteMetricStore.cs` |
| Error tracking and monitoring | Azure Monitor (Application Insights) through `Microsoft.OpenTelemetry`, only when `APPLICATIONINSIGHTS_CONNECTION_STRING` is set; OTLP to the Aspire dashboard locally. No browser-side error tracking. Unhandled exceptions logged with type and trace ID only. | `Api/Extensions/TelemetryExtensions.cs`, `Api/Middleware/ApiExceptionHandler.cs` |
| AI/LLM provider | **None.** No model calls anywhere (searched backend, frontend, tools, package manifests and lock files for OpenAI, Anthropic, Gemini, Azure AI, Semantic Kernel, LLM, GPT, Mistral, Ollama, Hugging Face, LangChain, Bedrock). The only match is `Microsoft.Extensions.AI.Abstractions`, a transitive dependency of the local-only Aspire AppHost (`ParishLife.AppHost/packages.lock.json`), never deployed or called. | see section 12 |
| Local orchestration | .NET Aspire 13.6.5 AppHost (local only; not deployed). | `ParishLife.AppHost/*` |
| Other third parties | Google Fonts (portal, product page, print views), Google and Microsoft identity platforms, Cloudflare (DNS, Turnstile, `www` redirect, Email Routing for `privacy@`), Microsoft Azure. Outbound links only (no embeds): Google Maps, Google Calendar, WhatsApp share, OpenStreetMap, Unsplash credit, Lebanese government PDFs. | sections 7 and 12 |

## 2. Folder structure

| Folder or file | What it contains |
|---|---|
| `ParishLife.Api/` | The only production project. |
| `Api/Program.cs` | Host setup: Kestrel 64 KB body limit, controllers with global CSRF filter, Identity cookies, anti-forgery cookie, rate limiter, security headers, frontend static hosting, health and OpenAPI endpoints. |
| `Api/Controllers/<Area>/` | 106 controller files (112 controller classes; six files hold two classes) in 18 area folders; 636 actions (section 3). |
| `Api/Services/<Area>/` | 128 files of business logic and permission checks; also `Services/Operations` (capabilities, readiness, data snapshot). |
| `Api/Authorization/` | Parish, staff-appointment, clergy and archdiocese authority; `CurrentActor`; CSRF filter; `AllowRecoverySession` and `TurnstileProtected` attributes. |
| `Api/Identity/` | `ParishUser` and session records, Cosmos Identity store, session and cookie services, external OAuth handler and claims, operator check (`AccountAccess.cs`), bootstrap service for the two allowed accounts. |
| `Api/Middleware/` | Problem-details exception handler, recovery-session gate, `PublicCache` attribute. |
| `Api/Extensions/` | `ServiceCollectionExtensions` (all DI, options validation, storage, identity, data protection, OAuth), `FrontendHostingExtensions` (static pages, cache headers, CSP), `TelemetryExtensions`. |
| `Api/Configuration/` | Options classes (Cosmos, Azure, Blob, Data Protection, Storage, Email, Turnstile, external sign-in, public app manifest), Cosmos index contract, GUID JSON converter. |
| `Api/Data/Cosmos`, `Data/Blob`, `Data/Local` | Document database adapters (Cosmos and local files), Blob and local evidence stores, EF Core plan catalogue context. |
| `Api/Repositories/<Area>/` | Repositories for parishes, people, billing, plans, site metrics, platform directory, staff appointments, resource allocation, record transactions. |
| `Api/Interfaces/` | Repository and service interfaces. |
| `Api/DTOs/<Feature>/` | 552 request/response DTO files; input DTOs carry validation attributes. |
| `Api/Models/`, `Api/Models/Enums/` | 255 stored-document model files, 5 enums, `Permissions.cs`. |
| `Api/Validation/` | `NotEmptyGuidAttribute`. |
| `Api/BackgroundJobs/` | Five hosted workers (section 3.4). |
| `Api/appsettings*.json`, `Api/Properties/launchSettings.json`, `Api/ParishLife.Api.http` | Non-secret configuration, local launch profiles, a sample request file. |
| `ParishLife.AppHost/` | Aspire local dashboard; starts the API with `Backend:UseAzure` and `Backend:RunBackgroundJobs` switches. |
| `ParishLife.UnitTests/` | 8 files, 40 test attributes (index contract, evidence stores, identity bootstrap, external claims, workflows). |
| `ParishLife.IntegrationTests/` | 117 files, 445 test attributes: HTTP tests through `WebApplicationFactory` on isolated local storage; `Support/` holds fixtures. |
| `ParishLife.EndToEnd/` | Test-only host: real API on Kestrel HTTPS with temporary storage, the built frontend and fixture accounts; used by `npm run e2e`. Not publishable. |
| `tools/ParishLife.Maintenance/` | Private operator console: `check-infrastructure`, `bootstrap-superadmins`, `verify-identity`, `snapshot-export`, `snapshot-restore`. |
| `tools/Publish-ParishLife.ps1`, `tools/Initialize-Cosmos.ps1`, `tools/tests/` | Packaging script (frontend + API zip, prints the deploy command), Cosmos container/index plan-and-apply script, its Pester test. |
| `frontend/index.html`, `public.html`, `landing.html`, `privacy.html`, `terms.html` | Page entries; each has one inline start-up script (language and reading preferences). |
| `frontend/src/portal/` | Members portal: `shell/` (frame, auth screen, route table, actions), `model/` (API client, session, view model, per-module loaders in `model/modules/`), `features/<group>/` (screens and dialogs), `ui/` (design-system components), `shared/` (dialogs, record editor, print). |
| `frontend/src/public/` | Public site: `App.jsx` (query-string routing), `pages/`, `components/`, `api-data.js`. |
| `frontend/src/landing/` | Product page. |
| `frontend/src/lib/` | Shared: i18n, liturgical calendar, search, theme, rich-text sanitizer, Turnstile loader, visit beacon, home defaults, Lebanon map data. |
| `frontend/src/reading/`, `frontend/src/styles/` | Easier-reading control; all CSS. |
| `frontend/public/` | Static files copied as-is: fonts (self-hosted, OFL), images, app icons, `site.webmanifest`, `sw.js`. |
| `frontend/scripts/` | `npm run check` harness (`check-api.mjs`, `checks/*.mjs`, `mock-api.mjs`), route check (`check-routes.mjs`, `route-gaps.json`), e2e runner. |
| `frontend/e2e/`, `frontend/playwright.config.mjs` | Signed-in browser tests (Playwright). |
| `docs/` | Architecture, Azure setup, continuation notes and owner questions, Cosmos manifest, feature register, frontend module docs, operations runbooks, verification records. |
| `hardening/` | This run: context, prompts, handoffs, reports. |
| Root files | `README.md`, `HANDOVER.md`, `CLAUDE.md`, `AGENTS.md`, `.gitignore`, `.editorconfig`, `Directory.Build.props`, `global.json`, `ParishLife.slnx`. |

## 3. Routes and endpoints

### 3.1 How every API route is protected (applies to the whole table)

| Control | Fact | Source |
|---|---|---|
| Authentication | `app.MapControllers().RequireAuthorization()`: every controller action needs a signed-in cookie unless it has `[AllowAnonymous]` (39 actions). 401/403 instead of redirects. | `Api/Program.cs` lines 39–57, 101 |
| Session validity | Each request re-checks the server-side session (`sid`, security stamp, method) in `OnValidatePrincipal`. | `Api/Program.cs` lines 58–63, `Api/Identity/AccountSessionService.cs` |
| Roles and permissions | Not attributes. Checked in services, see the "Checks found" column. Parish permissions come from an `AccessGrant` or the one appointment named in `X-ParishLife-Appointment` (never combined). Hidden resources answer 404. | `Api/Authorization/ParishAccess.cs`, `Api/Authorization/CurrentActor.cs`, `Api/Authorization/StaffAppointmentAccess.cs` |
| Platform operator | `RequireOperatorAsync`: active, verified account with `PlatformOperator`, TOTP enabled and an `amr=mfa` session, and no selected appointment. | `Api/Identity/AccountAccess.cs` lines 21–31 |
| Recovery sessions | A cookie with `amr=recovery` gets 403 everywhere except `[AllowAnonymous]` actions and the 10 actions marked `[AllowRecoverySession]`. | `Api/Middleware/RecoverySessionMiddleware.cs` |
| CSRF | Global MVC filter: every POST/PUT/PATCH/DELETE controller action (including anonymous ones) needs header `X-CSRF-TOKEN` matching cookie `__Host-ParishLife.Csrf`; token from `GET /api/auth/csrf`. Not applied to the OAuth callback (middleware) or the minimal health/OpenAPI endpoints (GET only). | `Api/Authorization/ValidateCsrfFilter.cs`, `Api/Program.cs` lines 19, 29–37 |
| Rate limits | Global fixed window: 200 requests per minute per `RemoteIpAddress` (`g200`). Policy `authentication`: 20 per minute per IP (`auth20`, 45 actions). Static pages are served before the limiter. Partition key is `Connection.RemoteIpAddress`; no forwarded-headers middleware in code (whether App Service passes the client address is **Unverified**). | `Api/Program.cs` lines 70–75, 89–90 |
| Turnstile | `[TurnstileProtected]` on 7 actions (`TS` column); header `X-Turnstile-Token` or form field; 400 on failure, 503 when Cloudflare is unreachable; no-op when unconfigured. | `Api/Authorization/TurnstileProtectedAttribute.cs` |
| Body size | Kestrel limit 64 KB for every request. Raised only on 4 upload actions with `[RequestSizeLimit]`: request files 10 MB + 64 KB (staff and guest), profile photos 5 MB + 64 KB, clergy signature image 1 MB + 64 KB. | `Api/Program.cs` line 18, `Api/Controllers/Files/*`, `Api/Controllers/Publishing/ParishProfileController.cs`, `Api/Controllers/Sacraments/ClergySignatureImagesController.cs` |
| Caching | All `/api` responses `Cache-Control: no-store`, except 7 anonymous GETs with `[PublicCache]` (`public, max-age`, ETag, 304). | `Api/Program.cs` lines 81–88, `Api/Middleware/PublicCacheAttribute.cs` |
| Headers | `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin` on every response; HSTS outside Development (framework default 30 days, seen live as `max-age=2592000`); CSP only on `.html` files; `Server: Kestrel` is sent (seen live). | `Api/Program.cs` lines 79–88, `Api/Extensions/FrontendHostingExtensions.cs` |
| Host filtering | `AllowedHosts` = `parish-life.org`, the azurewebsites host, `localhost`, `127.0.0.1`. | `Api/appsettings.json` |
| Errors | `DomainException` kinds map to 400/404/403/409/503 problem details; anything else is 500 `unexpected_failure` with a trace ID. | `Api/Middleware/ApiExceptionHandler.cs` |

### 3.2 Endpoints outside the controllers

| Method | Path | File | Auth | Notes |
|---|---|---|---|---|
| GET | `/health/live` | `Api/Program.cs` line 94 | anonymous | `{status:"Alive"}`; rate-limited (global). |
| GET | `/health/ready` | `Api/Program.cs` line 95 | anonymous | Runs the `ready` health check (`Api/Services/Operations/BackendReadinessHealthCheck.cs`: Cosmos, Blob, Key Vault metadata); 200 or 503 with status only. App Service health-check path (docs). |
| GET | `/openapi/v1.json` | `Api/Program.cs` line 100 (`MapOpenApi().RequireAuthorization()`) | any signed-in user (not recovery sessions) | Full OpenAPI document of all 636 actions. |
| GET | `/api/auth/external/callback/google`, `/api/auth/external/callback/microsoft` | OAuth handler, `Api/Extensions/ServiceCollectionExtensions.cs` line 363, `Api/Identity/ExternalOAuthHandler.cs` | anonymous (OAuth state and PKCE) | Exists only for configured providers. Signs into the Identity external cookie, then redirects to `GET /api/auth/external/complete`. |
| GET | `/`, `/index.html`, `/public.html`, `/landing.html`, `/privacy.html`, `/terms.html`, `/assets/**`, `/sw.js`, `/site.webmanifest` | `Api/Extensions/FrontendHostingExtensions.cs` | anonymous | Served from `wwwroot` only when the publish included the frontend. `/` serves `index.html` (the sign-in page). `/assets/app/*` cached 1 year `immutable`; everything else `no-cache`; HTML gets the CSP. No `robots.txt` or `sitemap.xml` (404 live). |

### 3.3 Frontend pages

Static entries (all client-rendered React; nothing is server-rendered):

| Page | Entry script | Who | What it reads/writes |
|---|---|---|---|
| `/` and `/index.html` | `frontend/src/portal/main.jsx` | anyone (sign-in), then signed-in users | All portal API calls (section 3.6). |
| `/public.html` | `frontend/src/public/main.jsx` | anonymous | `/api/public/*`, `/api/auth/csrf`, `/api/auth/capabilities`; registers `sw.js`. |
| `/landing.html` | `frontend/src/landing/main.jsx` | anonymous | No API call (static marketing, WhatsApp contact link). |
| `/privacy.html`, `/terms.html` | inline language script only | anonymous | None. |

Public site views (`frontend/src/public/App.jsx`, chosen by the query string or hash):

| Address | Page file | Data |
|---|---|---|
| `public.html` | `pages/Home.jsx` | directory, homepage content, liturgy, nearby search (browser geolocation, sent to `POST /api/public/parishes/nearby`). |
| `public.html?parish=<id>` | `pages/ParishPage.jsx` | profile, website sections (rich text), calendar, ministries, announcements, intentions, photos. |
| `?parish=<id>&view=calendar` | `pages/CalendarPage.jsx` | public calendar, `.ics` feed link, Google Calendar link. |
| `?parish=<id>&event=<id>` | `pages/EventPage.jsx` | public event. |
| `?parish=<id>&request=<kind>` | `pages/RequestPage.jsx` | guest request form (Turnstile); "closed" view when the parish has no public requests. |
| `public.html#track=<token>` | `pages/TrackingPage.jsx` | guest request tracking: status, messages, files, actions (token sent as header `X-ParishLife-Tracking`). |
| `?verify=<code>` or `?view=verify` | `pages/VerifyPage.jsx` | `GET /api/public/document-verifications/{code}`. |
| `?view=bundles` | `pages/BundlesPage.jsx` | plans catalogue (`GET /api/plans`). |
| anything unknown | `pages/LostPage.jsx` | none (client-side "not found"; the HTTP status is still 200). |

Portal screens (`frontend/src/portal/shell/routes.jsx`, hash routes `#/<id>`). Visibility per role comes from `nav` lists in `frontend/src/portal/model/store.js` (`ROLES`) and `allowed()`; it is display only, the API enforces access.

| Role in the portal (`store.js`) | Screens in its navigation |
|---|---|
| `super_admin` (platform operator) | workspace, people, households, calendar, groups, finance, settings |
| `diocesan_admin`, `parish_admin` | workspace, people, households, calendar, groups, settings |
| `bishop` | oversight, bishopeparchy, bishopmap |
| `priest` | dashboard, people, households, sacraments, requests, notes, calendar, services, groups, volunteers, registrations, checkin, facilities, reservations, messaging, notices, music, portal (website), memberhub, giving, finance, officeexpenses, forms, reports, audit, settings, styleguide |
| `secretary` | dashboard, people, households, sacraments, requests, calendar, services, groups, volunteers, registrations, checkin, facilities, reservations, officeexpenses |
| `treasurer` | dashboard, giving, finance, people, households, reports, settings |
| `leader` (ministry) | dashboard, groups, attendance, volunteers, checkin, music, calendar, services, messaging, memberhub |
| `finance_view` | giving, finance |
| `member` | memberhome, myrequests, myministries, mymeetings, mycalendar, myattendance, mymessages, myfeed, myresources, mycommitments, mynotes, myprofile, myconcerns, membernotifications |
| everyone | account; detail screens (person, household, certificate, assignments, membershipreviews, profilereviews, guestrequests) ride on their parent's visibility; personal `my*` screens for anyone with a linked person except bishop and secretary. Other routes: activity, ministryrequests, inbox, insights, eparchy. |

Admin pages: portal `workspace` (`features/administration/workspace.jsx`), `insights`, `settings`, `audit`, `eparchy`, `assignments`, and the bishop's `oversight` screens. Their API counterparts are `/api/administration/*` (platform operator + MFA), `/api/archdioceses/*` and `/api/parishes/{id}/audit`.

### 3.4 Background jobs (the "cron jobs")

All five are `BackgroundService` workers in the web host, registered in `Api/Extensions/ServiceCollectionExtensions.cs` lines 211–218. Each runs only when `BackgroundJobs:Enabled` is true (default: true outside Development; `appsettings.json` sets true; production app setting set to `true` on 11 November per `docs/continuation/AZURE-CONNECTION.md` line 32, **Unverified** now). One App Service instance, so no distributed lock exists.

| Worker | Interval | Does |
|---|---|---|
| `BackgroundJobs/BillingActivationWorker.cs` | 15 s | Activates paid coverage from recorded billing work. |
| `BackgroundJobs/ReservationWorker.cs` | 15 s | Confirms or compensates pending room/equipment reservations. |
| `BackgroundJobs/NotificationWorker.cs` | 15 s | Delivers durable in-app notifications. |
| `BackgroundJobs/ReportScheduleWorker.cs` | 1 min | Runs due report schedules (in-app delivery; per-schedule time zone). |
| `BackgroundJobs/BroadcastScheduleWorker.cs` | 1 min | Sends due scheduled broadcasts and automations (in-app only). |

### 3.5 Not present

Webhooks (inbound): none. WebSockets, SignalR, server-sent events: none. GraphQL: none. Server actions: not applicable (no Next.js-style framework). Admin pages outside the portal: none.

### 3.6 Outbound calls made by the server

| Target | When | File |
|---|---|---|
| `https://challenges.cloudflare.com/turnstile/v0/siteverify` | each Turnstile-protected request; sends the token and the client IP | `Api/Services/Accounts/TurnstileVerifier.cs` |
| `https://api.resend.com/emails` | each account code email | `Api/Services/Accounts/ResendContactCodeDelivery.cs` |
| Google `accounts.google.com`, `oauth2.googleapis.com`, `openidconnect.googleapis.com`; Microsoft `login.microsoftonline.com`, `graph.microsoft.com/oidc/userinfo` | external sign-in, sign-up and linking | `Api/Configuration/ExternalProviderOptions.cs`, `Api/Identity/ExternalOAuthHandler.cs` |
| Cosmos DB, Blob Storage, Key Vault, managed-identity token endpoint | every request / startup | `Api/Extensions/ServiceCollectionExtensions.cs` |
| Azure Monitor ingestion | when the connection string is set | `Api/Extensions/TelemetryExtensions.cs` |

### 3.7 Every controller action (636)

Generated by parsing the attributes of `Api/Controllers/**` (method, path, class/action attributes) and following each action into the service method it calls (two levels of private helpers) to list the authorization checks found. Columns:
- **Auth**: `anon` = `[AllowAnonymous]`; `user` = any signed-in account at the HTTP layer.
- **Rec**: `[AllowRecoverySession]`.
- **Rate**: `g200` global limiter only; `auth20` = `authentication` policy (and the global one).
- **TS**: `[TurnstileProtected]`. **CSRF**: anti-forgery token required (every non-GET). **Cache**: `[PublicCache]` max-age.
- **Service call**: what the action calls; GET reads, other methods write (each write also stores an operation receipt and an audit entry in the same partition).
- **Checks found (heuristic)**: names from `Models/Permissions.cs` (for example `PeopleRead` = `people.read`) checked through `ParishAccess`; `mod:x` = paid module coverage required; `operator+MFA` = platform operator; `bishop`, `clergy`, `priest`; `min:*` = ministry role checks; `appt:*` = own staff appointment; `MFA` = MFA session required; `self` = scoped to the caller's own account; `verified` = verified account; `member` = current parish member; `tracking-token` = guest token header. "not detected" means the check lives in a class the parser did not follow (account, password, MFA flows and ministry access helpers). **This column is a starting point for Agent 03, not a proof**: a listed check may guard only one branch, and helper classes outside the service file were not followed.

#### Accounts (46)

| Method | Path | Controller | Auth | Rec | Rate | TS | CSRF | Cache | Service call | Checks found (heuristic) |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/auth/profile` | AccountProfile | user |  | g200 |  |  |  | AccountProfileService.Get | MFA |
| PUT | `/api/auth/profile` | AccountProfile | user |  | g200 |  | yes |  | AccountProfileService.Update | MFA |
| POST | `/api/auth/profile/appearance/preview` | AccountProfile | user |  | g200 |  | yes |  | AccountProfileService.Preview | MFA |
| POST | `/api/auth/profile/appearance/reset` | AccountProfile | user |  | g200 |  | yes |  | AccountProfileService.ResetAppearance | MFA |
| GET | `/api/account/records` | AccountRecords | user |  | g200 |  |  |  | AccountRecordsService.Records | self |
| GET | `/api/account/signature` | AccountSignature | user |  | g200 |  |  |  | AccountSignatureService.Get | MFA |
| POST | `/api/account/signature` | AccountSignature | user |  | g200 |  | yes |  | AccountSignatureService.Save | MFA |
| POST | `/api/account/signature/remove` | AccountSignature | user |  | g200 |  | yes |  | AccountSignatureService.Remove | MFA |
| GET | `/api/auth/csrf` | Accounts | anon |  | g200 |  |  |  | IAntiforgery.GetAndStoreTokens | not detected |
| POST | `/api/auth/login` | Accounts | anon |  | auth20 | yes | yes |  | AccountCookieService.Issue, AccountSessionService.Create, AccountSessionService.CreateChallenge | not detected |
| POST | `/api/auth/login/mfa` | Accounts | anon |  | auth20 |  | yes |  | AccountCookieService.Issue, AccountSessionService.Create, AccountSessionService.GetChallenge, TimeProvider.GetUtcNow | not detected |
| POST | `/api/auth/logout` | Accounts | user | yes | auth20 |  | yes |  | AccountSessionService.Revoke | not detected |
| GET | `/api/auth/me` | Accounts | user | yes | g200 |  |  |  | (inline) | not detected |
| POST | `/api/auth/password` | Accounts | user |  | auth20 |  | yes |  | AccountPasswordService.Change | MFA |
| POST | `/api/auth/password/add` | Accounts | user |  | auth20 |  | yes |  | AccountPasswordService.Add | MFA |
| POST | `/api/auth/register` | Accounts | anon |  | auth20 | yes | yes |  | AccountService.Register | not detected |
| GET | `/api/auth/sessions` | Accounts | user | yes | auth20 |  |  |  | AccountSessionService.List, TimeProvider.GetUtcNow | not detected |
| POST | `/api/auth/sessions/{sessionId}/revoke` | Accounts | user | yes | auth20 |  | yes |  | AccountSessionService.Revoke | not detected |
| GET | `/api/auth/capabilities` | AuthenticationCapabilities | anon |  | g200 |  |  |  | ExternalSignInService.Available | not detected |
| POST | `/api/auth/contact-verification` | ContactVerification | anon |  | auth20 | yes | yes |  | ContactVerificationService.Request | not detected |
| POST | `/api/auth/contact-verification/confirm` | ContactVerification | anon |  | auth20 |  | yes |  | ContactVerificationService.Confirm | not detected |
| POST | `/api/auth/email-change` | ContactVerification | user |  | auth20 |  | yes |  | ContactVerificationService.BeginEmailChange | not detected |
| POST | `/api/auth/email-change/confirm` | ContactVerification | user |  | auth20 |  | yes |  | ContactVerificationService.ConfirmEmailChange | not detected |
| GET | `/api/auth/external` | ExternalSignIn | user |  | auth20 |  |  |  | ExternalSignInService.List | MFA |
| GET | `/api/auth/external/complete` | ExternalSignIn | anon |  | auth20 |  |  |  | AccountCookieService.Issue, ExternalSignInService.Complete, ExternalSignInService.HoldPendingChallenge | not detected |
| POST | `/api/auth/external/pending-challenge` | ExternalSignIn | anon |  | auth20 |  | yes |  | ExternalSignInService.TakePendingChallenge | not detected |
| POST | `/api/auth/external/{provider}/link` | ExternalSignIn | user |  | auth20 |  | yes |  | ExternalSignInService.LinkProperties | not detected |
| POST | `/api/auth/external/{provider}/link/redirect` | ExternalSignIn | user |  | auth20 |  | yes |  | ExternalSignInService.LinkFromTicket | MFA |
| POST | `/api/auth/external/{provider}/link/ticket` | ExternalSignIn | user |  | auth20 |  | yes |  | ExternalSignInService.LinkTicket | not detected |
| POST | `/api/auth/external/{provider}/sign-in` | ExternalSignIn | anon |  | auth20 | yes | yes |  | ExternalSignInService.SignInProperties | not detected |
| POST | `/api/auth/external/{provider}/sign-up` | ExternalSignIn | anon |  | auth20 | yes | yes |  | ExternalSignInService.SignUpProperties | not detected |
| POST | `/api/auth/external/{provider}/unlink` | ExternalSignIn | user |  | auth20 |  | yes |  | ExternalSignInService.Unlink | not detected |
| POST | `/api/auth/mfa/enrollment` | MfaSecurity | user | yes | auth20 |  | yes |  | MfaSecurityService.Begin | not detected |
| POST | `/api/auth/mfa/enrollment/complete` | MfaSecurity | user | yes | auth20 |  | yes |  | MfaSecurityService.Complete | not detected |
| POST | `/api/auth/mfa/recovery-codes` | MfaSecurity | user | yes | auth20 |  | yes |  | MfaSecurityService.Regenerate | not detected |
| POST | `/api/auth/mfa/recovery-requests` | MfaSecurity | user | yes | auth20 |  | yes |  | MfaRecoveryService.Request | not detected |
| GET | `/api/auth/mfa/recovery-requests/{requestId}` | MfaSecurity | user | yes | auth20 |  |  |  | MfaRecoveryService.GetOwn | not detected |
| GET | `/api/auth/mfa/status` | MfaSecurity | user | yes | auth20 |  |  |  | MfaSecurityService.Status | not detected |
| POST | `/api/auth/login/passkey` | Passkeys | anon |  | auth20 |  | yes |  | AccountCookieService.Issue, PasskeyService.CompleteLogin | not detected |
| POST | `/api/auth/login/passkey/options` | Passkeys | anon |  | auth20 | yes | yes |  | PasskeyService.BeginLogin | not detected |
| GET | `/api/auth/passkeys` | Passkeys | user |  | auth20 |  |  |  | PasskeyService.List | MFA |
| POST | `/api/auth/passkeys/registration` | Passkeys | user |  | auth20 |  | yes |  | PasskeyService.CompleteRegistration | MFA |
| POST | `/api/auth/passkeys/registration/options` | Passkeys | user |  | auth20 |  | yes |  | PasskeyService.BeginRegistration | not detected |
| POST | `/api/auth/passkeys/{credentialId}/remove` | Passkeys | user |  | auth20 |  | yes |  | PasskeyService.Remove | not detected |
| POST | `/api/auth/login/mfa/recovery` | RecoveryLogin | anon |  | auth20 |  | yes |  | AccountCookieService.Issue, MfaSecurityService.RecoverLogin | not detected |
| GET | `/api/auth/staff-appointments` | StaffAppointmentDirectory | user |  | g200 |  |  |  | StaffAppointmentService.Own | self, verified |

#### Administration (27)

| Method | Path | Controller | Auth | Rec | Rate | TS | CSRF | Cache | Service call | Checks found (heuristic) |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/administration/archdiocese-verifications/{organizationId}` | Administration | user |  | g200 |  |  |  | ParishService.InspectArchdioceseVerification | operator+MFA |
| GET | `/api/administration/parish-verifications/{parishId}` | Administration | user |  | g200 |  |  |  | ParishService.InspectVerification | operator+MFA |
| GET | `/api/administration/parishes/{parishId}/invoices/{invoiceId}` | Administration | user |  | g200 |  |  |  | BillingService.InspectForOperator | operator+MFA |
| GET | `/api/administration/readiness` | Administration | user |  | g200 |  |  |  | IPlatformAccess.RequireOperator, InfrastructureReadiness.Check | operator+MFA |
| GET | `/api/capabilities` | Administration | user |  | g200 |  |  |  | CapabilityService.List | not detected |
| PUT | `/api/administration/accounts/{accountId}/clergy-title` | ClergyTitles | user |  | g200 |  | yes |  | ClergyTitleService.Assign | MFA, operator+MFA, self |
| GET | `/api/clergy-titles` | ClergyTitles | user |  | g200 |  |  |  | ClergyTitleService.List | not detected |
| POST | `/api/clergy-titles` | ClergyTitles | user |  | g200 |  | yes |  | ClergyTitleService.Create | MFA, operator+MFA, self |
| GET | `/api/clergy-titles/accounts/{accountId}` | ClergyTitles | user |  | g200 |  |  |  | ClergyTitleService.Assignment | not detected |
| PUT | `/api/clergy-titles/{titleId}` | ClergyTitles | user |  | g200 |  | yes |  | ClergyTitleService.Update | MFA, operator+MFA, self |
| GET | `/api/administration/accounts/{accountId}/mfa-recovery-requests/{requestId}` | MfaRecoveryAdministration | user |  | g200 |  |  |  | MfaRecoveryService.GetForOperator | operator+MFA |
| POST | `/api/administration/accounts/{accountId}/mfa-recovery-requests/{requestId}/review` | MfaRecoveryAdministration | user |  | g200 |  | yes |  | MfaRecoveryService.Review | operator+MFA |
| GET | `/api/parishes/{parishId}/audit` | ParishAudit | user |  | g200 |  |  |  | ParishAuditService.Page | AuditRead |
| GET | `/api/administration/parish-crm/worklist` | ParishCrm | user |  | g200 |  |  |  | ParishCrmService.Worklist | MFA, operator+MFA |
| GET | `/api/administration/parishes/{parishId}/crm` | ParishCrm | user |  | g200 |  |  |  | ParishCrmService.Get | MFA, operator+MFA |
| PUT | `/api/administration/parishes/{parishId}/crm` | ParishCrm | user |  | g200 |  | yes |  | ParishCrmService.Save | MFA, operator+MFA, self |
| GET | `/api/administration/parishes/{parishId}/crm/due-follow-up` | ParishCrm | user |  | g200 |  |  |  | ParishCrmService.Due | MFA, operator+MFA |
| GET | `/api/administration/parishes/{parishId}/crm/history` | ParishCrm | user |  | g200 |  |  |  | ParishCrmService.History | MFA, operator+MFA |
| GET | `/api/administration/parishes/{parishId}/crm/history/{entryId}` | ParishCrm | user |  | g200 |  |  |  | ParishCrmService.Entry | MFA, operator+MFA |
| POST | `/api/administration/parishes/{parishId}/crm/notes` | ParishCrm | user |  | g200 |  | yes |  | ParishCrmService.AddNote | MFA, operator+MFA, self |
| GET | `/api/administration/accounts` | PlatformDirectory | user |  | g200 |  |  |  | PlatformDirectoryService.Accounts | MFA, operator+MFA, self |
| GET | `/api/administration/accounts/{accountId}` | PlatformDirectory | user |  | g200 |  |  |  | PlatformDirectoryService.Account | MFA, operator+MFA, self |
| POST | `/api/administration/accounts/{accountId}/reinstate` | PlatformDirectory | user |  | g200 |  | yes |  | AccountStatusService.Reinstate | MFA, operator+MFA, self |
| GET | `/api/administration/accounts/{accountId}/status-history` | PlatformDirectory | user |  | g200 |  |  |  | AccountStatusService.History | MFA, operator+MFA |
| POST | `/api/administration/accounts/{accountId}/suspend` | PlatformDirectory | user |  | g200 |  | yes |  | AccountStatusService.Suspend | MFA, operator+MFA, self |
| GET | `/api/administration/archdioceses` | PlatformDirectory | user |  | g200 |  |  |  | PlatformDirectoryService.Archdioceses | MFA, operator+MFA, self |
| GET | `/api/administration/parishes` | PlatformDirectory | user |  | g200 |  |  |  | PlatformDirectoryService.Parishes | MFA, operator+MFA, self |

#### Billing (17)

| Method | Path | Controller | Auth | Rec | Rate | TS | CSRF | Cache | Service call | Checks found (heuristic) |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/parishes/{parishId}/billing/coverage` | Billing | user |  | g200 |  |  |  | BillingService.GetCoverage | BillingRead |
| POST | `/api/parishes/{parishId}/billing/invoices` | Billing | user |  | g200 |  | yes |  | BillingService.CreateInvoice | BillingManage, self |
| GET | `/api/parishes/{parishId}/billing/invoices/{invoiceId}` | Billing | user |  | g200 |  |  |  | BillingService.Get | BillingRead |
| POST | `/api/parishes/{parishId}/billing/invoices/{invoiceId}/cash-receipts` | Billing | user |  | g200 |  | yes |  | BillingService.RecordCash | operator+MFA, self |
| GET | `/api/administration/archdioceses/{archdioceseId}/invoices/{invoiceId}` | PayerTransfers | user |  | g200 |  |  |  | BillingService.InspectForOperator | operator+MFA |
| GET | `/api/archdioceses/{archdioceseId}/billing/invoices/{invoiceId}` | PayerTransfers | user |  | g200 |  |  |  | PayerTransferService.GetSponsoredInvoice | MFA, self |
| POST | `/api/archdioceses/{archdioceseId}/billing/invoices/{invoiceId}/cash-receipts` | PayerTransfers | user |  | g200 |  | yes |  | BillingService.RecordCash | operator+MFA, self |
| POST | `/api/archdioceses/{archdioceseId}/billing/parishes/{parishId}/invoices` | PayerTransfers | user |  | g200 |  | yes |  | PayerTransferService.CreateSponsoredInvoice | MFA, self |
| POST | `/api/archdioceses/{archdioceseId}/payer-transfers/parishes/{parishId}` | PayerTransfers | user |  | g200 |  | yes |  | PayerTransferService.ProposeForArchdiocese | MFA, self |
| GET | `/api/parishes/{parishId}/payer-schedule` | PayerTransfers | user |  | g200 |  |  |  | PayerTransferService.Schedule | BillingRead |
| GET | `/api/parishes/{parishId}/payer-transfers` | PayerTransfers | user |  | g200 |  |  |  | PayerTransferService.List | BillingRead |
| POST | `/api/parishes/{parishId}/payer-transfers/archdioceses/{archdioceseId}` | PayerTransfers | user |  | g200 |  | yes |  | PayerTransferService.ProposeForParish | BillingManage, MFA, self |
| GET | `/api/parishes/{parishId}/payer-transfers/{transferId}` | PayerTransfers | user |  | g200 |  |  |  | PayerTransferService.Get | BillingRead, self |
| POST | `/api/parishes/{parishId}/payer-transfers/{transferId}/cancel` | PayerTransfers | user |  | g200 |  | yes |  | PayerTransferService.Cancel | BillingManage, MFA, self |
| POST | `/api/parishes/{parishId}/payer-transfers/{transferId}/decision` | PayerTransfers | user |  | g200 |  | yes |  | PayerTransferService.Decide | BillingManage, MFA, self |
| GET | `/api/plans` | Plans | anon |  | g200 |  |  |  | BillingService.ListPlans | not detected |
| POST | `/api/plans` | Plans | user |  | g200 |  | yes |  | BillingService.PublishPlan | operator+MFA |

#### Care (22)

| Method | Path | Controller | Auth | Rec | Rate | TS | CSRF | Cache | Service call | Checks found (heuristic) |
|---|---|---|---|---|---|---|---|---|---|---|
| POST | `/api/archdioceses/{archdioceseId}/concern-reviewers` | Care | user |  | g200 |  | yes |  | ConcernService.AppointReviewer | MFA, bishop, self, verified |
| POST | `/api/archdioceses/{archdioceseId}/concern-reviewers/{reviewerId}/end` | Care | user |  | g200 |  | yes |  | ConcernService.EndReviewer | MFA, bishop |
| POST | `/api/parishes/{parishId}/concerns` | Care | user |  | g200 |  | yes |  | ConcernService.Submit | self |
| GET | `/api/parishes/{parishId}/concerns/assigned` | Care | user |  | g200 |  |  |  | ConcernService.Assigned | MFA, self |
| GET | `/api/parishes/{parishId}/concerns/mine` | Care | user |  | g200 |  |  |  | ConcernService.Own | self |
| GET | `/api/parishes/{parishId}/concerns/reviewers` | Care | user |  | g200 |  |  |  | ConcernService.ReviewerOptions | not detected |
| GET | `/api/parishes/{parishId}/concerns/{concernId}` | Care | user |  | g200 |  |  |  | ConcernService.Get | MFA, self |
| POST | `/api/parishes/{parishId}/concerns/{concernId}/actions` | Care | user |  | g200 |  | yes |  | ConcernService.Act | MFA, self |
| GET | `/api/parishes/{parishId}/concerns/{concernId}/entries` | Care | user |  | g200 |  |  |  | ConcernService.Entries | MFA, self |
| POST | `/api/parishes/{parishId}/concerns/{concernId}/entries` | Care | user |  | g200 |  | yes |  | ConcernService.PostEntry | MFA, self |
| GET | `/api/parishes/{parishId}/concerns/{concernId}/entries/{entryId}/notification-outcome` | Care | user |  | g200 |  |  |  | ConcernService.EntryNotificationOutcome | MFA, self |
| GET | `/api/parishes/{parishId}/concerns/{concernId}/notification-outcome` | Care | user |  | g200 |  |  |  | ConcernService.NotificationOutcome | MFA, self |
| GET | `/api/parishes/{parishId}/pastoral-notes` | Care | user |  | g200 |  |  |  | PastoralNoteService.List | MFA, clergy, self |
| POST | `/api/parishes/{parishId}/pastoral-notes` | Care | user |  | g200 |  | yes |  | PastoralNoteService.Save | MFA, clergy, self |
| GET | `/api/parishes/{parishId}/pastoral-notes/{noteId}` | Care | user |  | g200 |  |  |  | PastoralNoteService.Get | MFA, clergy, self |
| PUT | `/api/parishes/{parishId}/pastoral-notes/{noteId}` | Care | user |  | g200 |  | yes |  | PastoralNoteService.Save | MFA, clergy, self |
| POST | `/api/parishes/{parishId}/pastoral-notes/{noteId}/actions` | Care | user |  | g200 |  | yes |  | PastoralNoteService.Act | MFA, clergy, self |
| GET | `/api/parishes/{parishId}/incidents` | Incidents | user |  | g200 |  |  |  | IncidentService.List | IncidentsManage, MFA, mod:office |
| POST | `/api/parishes/{parishId}/incidents` | Incidents | user |  | g200 |  | yes |  | IncidentService.Record | IncidentsRecord, MFA, mod:office, self |
| GET | `/api/parishes/{parishId}/incidents/{incidentId}` | Incidents | user |  | g200 |  |  |  | IncidentService.Get | IncidentsManage, MFA, mod:office |
| POST | `/api/parishes/{parishId}/incidents/{incidentId}/actions` | Incidents | user |  | g200 |  | yes |  | IncidentService.Act | IncidentsManage, MFA, mod:office, self |
| GET | `/api/parishes/{parishId}/incidents/{incidentId}/notification-outcome` | Incidents | user |  | g200 |  |  |  | IncidentService.NotificationOutcome | IncidentsManage, MFA, mod:office |

#### Communications (45)

| Method | Path | Controller | Auth | Rec | Rate | TS | CSRF | Cache | Service call | Checks found (heuristic) |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/parishes/{parishId}/broadcast-automations` | BroadcastAutomations | user |  | g200 |  |  |  | BroadcastAutomationService.List | not detected |
| POST | `/api/parishes/{parishId}/broadcast-automations` | BroadcastAutomations | user |  | g200 |  | yes |  | BroadcastAutomationService.Save | self |
| PUT | `/api/parishes/{parishId}/broadcast-automations/{automationId}` | BroadcastAutomations | user |  | g200 |  | yes |  | BroadcastAutomationService.Save | self |
| POST | `/api/parishes/{parishId}/broadcast-automations/{automationId}/actions` | BroadcastAutomations | user |  | g200 |  | yes |  | BroadcastAutomationService.Action | self |
| GET | `/api/parishes/{parishId}/broadcast-templates` | Broadcasts | user |  | g200 |  |  |  | BroadcastService.Templates | CommunicationsManage, MFA, mod:core |
| POST | `/api/parishes/{parishId}/broadcast-templates` | Broadcasts | user |  | g200 |  | yes |  | BroadcastService.SaveTemplate | CommunicationsManage, MFA, mod:core, self |
| PUT | `/api/parishes/{parishId}/broadcast-templates/{templateId}` | Broadcasts | user |  | g200 |  | yes |  | BroadcastService.SaveTemplate | CommunicationsManage, MFA, mod:core, self |
| POST | `/api/parishes/{parishId}/broadcast-templates/{templateId}/actions` | Broadcasts | user |  | g200 |  | yes |  | BroadcastService.TemplateAction | CommunicationsManage, MFA, mod:core, self |
| GET | `/api/parishes/{parishId}/broadcasts` | Broadcasts | user |  | g200 |  |  |  | BroadcastService.List | CommunicationsManage, MFA, mod:core |
| POST | `/api/parishes/{parishId}/broadcasts` | Broadcasts | user |  | g200 |  | yes |  | BroadcastService.Save | CommunicationsManage, MFA, mod:core, self |
| GET | `/api/parishes/{parishId}/broadcasts/mine` | Broadcasts | user |  | g200 |  |  |  | BroadcastService.Mine | self |
| PUT | `/api/parishes/{parishId}/broadcasts/{broadcastId}` | Broadcasts | user |  | g200 |  | yes |  | BroadcastService.Save | CommunicationsManage, MFA, mod:core, self |
| POST | `/api/parishes/{parishId}/broadcasts/{broadcastId}/actions` | Broadcasts | user |  | g200 |  | yes |  | BroadcastService.Action | CommunicationsManage, MFA, mod:core, self |
| GET | `/api/parishes/{parishId}/broadcasts/{broadcastId}/audience-preview` | Broadcasts | user |  | g200 |  |  |  | BroadcastService.Preview | CommunicationsManage, MFA, mod:core |
| GET | `/api/parishes/{parishId}/announcements` | Communications | user |  | g200 |  |  |  | CommunicationsService.StaffAnnouncements | CommunicationsManage, MFA, mod:core |
| POST | `/api/parishes/{parishId}/announcements` | Communications | user |  | g200 |  | yes |  | CommunicationsService.SaveAnnouncement | CommunicationsManage, MFA, mod:core, self |
| GET | `/api/parishes/{parishId}/announcements/mine` | Communications | user |  | g200 |  |  |  | CommunicationsService.MemberAnnouncements | not detected |
| PUT | `/api/parishes/{parishId}/announcements/{announcementId}` | Communications | user |  | g200 |  | yes |  | CommunicationsService.SaveAnnouncement | CommunicationsManage, MFA, mod:core, self |
| POST | `/api/parishes/{parishId}/announcements/{announcementId}/actions` | Communications | user |  | g200 |  | yes |  | CommunicationsService.AnnouncementAction | CommunicationsManage, MFA, PublishingManage, mod:core, self |
| GET | `/api/parishes/{parishId}/prayer-intentions` | Communications | user |  | g200 |  |  |  | CommunicationsService.PriestIntentions | MFA, clergy, self |
| POST | `/api/parishes/{parishId}/prayer-intentions` | Communications | user |  | g200 |  | yes |  | CommunicationsService.SubmitIntention | self |
| GET | `/api/parishes/{parishId}/prayer-intentions/mine` | Communications | user |  | g200 |  |  |  | CommunicationsService.OwnIntentions | self |
| POST | `/api/parishes/{parishId}/prayer-intentions/{intentionId}/decision` | Communications | user |  | g200 |  | yes |  | CommunicationsService.DecideIntention | MFA, clergy, self |
| GET | `/api/public/parishes/{parishId}/announcements` | Communications | anon |  | g200 |  |  |  | CommunicationsService.PublicAnnouncements | not detected |
| GET | `/api/public/parishes/{parishId}/prayer-intentions` | Communications | anon |  | g200 |  |  |  | CommunicationsService.PublicIntentions | not detected |
| GET | `/api/notifications` | Inbox | user |  | g200 |  |  |  | NotificationService.List | self |
| GET | `/api/notifications/preferences` | Inbox | user |  | g200 |  |  |  | NotificationService.Preferences | self |
| PUT | `/api/notifications/preferences` | Inbox | user |  | g200 |  | yes |  | NotificationService.SavePreferences | self |
| POST | `/api/notifications/{notificationId}/state` | Inbox | user |  | g200 |  | yes |  | NotificationService.SetState | self |
| GET | `/api/parishes/{parishId}/inbox` | Inbox | user |  | g200 |  |  |  | InboxService.List | CommunicationsManage, MFA, self |
| POST | `/api/parishes/{parishId}/inbox` | Inbox | user |  | g200 |  | yes |  | InboxService.Start | CommunicationsManage, MFA, PeopleRead, mod:office, self |
| GET | `/api/parishes/{parishId}/inbox/{conversationId}` | Inbox | user |  | g200 |  |  |  | InboxService.Messages | CommunicationsManage, MFA, self |
| POST | `/api/parishes/{parishId}/inbox/{conversationId}/archive` | Inbox | user |  | g200 |  | yes |  | InboxService.Archive | CommunicationsManage, MFA, self |
| POST | `/api/parishes/{parishId}/inbox/{conversationId}/messages` | Inbox | user |  | g200 |  | yes |  | InboxService.Post | CommunicationsManage, MFA, self |
| GET | `/api/parishes/{parishId}/inbox/{conversationId}/messages/{messageId}/notification-outcome` | Inbox | user |  | g200 |  |  |  | InboxService.MessageNotificationOutcome | CommunicationsManage, MFA, self |
| GET | `/api/parishes/{parishId}/inbox/{conversationId}/notification-outcome` | Inbox | user |  | g200 |  |  |  | InboxService.NotificationOutcome | CommunicationsManage, MFA, self |
| GET | `/api/parishes/{parishId}/inbox/reports/mine` | MessageReview | user |  | g200 |  |  |  | MessageReviewService.OwnReports | self |
| POST | `/api/parishes/{parishId}/inbox/{conversationId}/messages/{messageId}/reports` | MessageReview | user |  | g200 |  | yes |  | MessageReviewService.Report | self |
| GET | `/api/parishes/{parishId}/message-reports` | MessageReview | user |  | g200 |  |  |  | MessageReviewService.Reports | MFA, operator+MFA, self |
| POST | `/api/parishes/{parishId}/message-reports/{reportId}/close` | MessageReview | user |  | g200 |  | yes |  | MessageReviewService.CloseReport | MFA, operator+MFA, self |
| GET | `/api/parishes/{parishId}/message-reviews` | MessageReview | user |  | g200 |  |  |  | MessageReviewService.List | MFA, operator+MFA |
| POST | `/api/parishes/{parishId}/message-reviews` | MessageReview | user |  | g200 |  | yes |  | MessageReviewService.Request | MFA, operator+MFA, self |
| POST | `/api/parishes/{parishId}/message-reviews/{reviewId}/close` | MessageReview | user |  | g200 |  | yes |  | MessageReviewService.Close | MFA, operator+MFA, self |
| POST | `/api/parishes/{parishId}/message-reviews/{reviewId}/decision` | MessageReview | user |  | g200 |  | yes |  | MessageReviewService.Decide | MFA, operator+MFA, self |
| GET | `/api/parishes/{parishId}/message-reviews/{reviewId}/message` | MessageReview | user |  | g200 |  |  |  | MessageReviewService.ReadMessage | MFA, operator+MFA, self |

#### Documents (19)

| Method | Path | Controller | Auth | Rec | Rate | TS | CSRF | Cache | Service call | Checks found (heuristic) |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/archdioceses/{archdioceseId}/signature-arrangement` | DocumentSignatures | user |  | g200 |  |  |  | DocumentSignatureService.Arrangement | MFA, bishop |
| PUT | `/api/archdioceses/{archdioceseId}/signature-arrangement` | DocumentSignatures | user |  | g200 |  | yes |  | DocumentSignatureService.SetArrangement | MFA, bishop, self |
| GET | `/api/me/signer-profile` | DocumentSignatures | user |  | g200 |  |  |  | DocumentSignatureService.Profile | MFA, self |
| PUT | `/api/me/signer-profile` | DocumentSignatures | user |  | g200 |  | yes |  | DocumentSignatureService.SaveProfile | MFA, self |
| POST | `/api/parishes/{parishId}/certificates/{certificateId}/authorization` | DocumentSignatures | user |  | g200 |  | yes |  | CertificateService.Authorize | MFA, clergy, self |
| GET | `/api/parishes/{parishId}/certificates/{certificateId}/authorization-preview` | DocumentSignatures | user |  | g200 |  |  |  | CertificateService.AuthorizationPreview | MFA, SacramentsRecord, bishop, clergy, self |
| GET | `/api/parishes/{parishId}/document-signatures/{code}` | DocumentSignatures | user |  | g200 |  |  |  | DocumentSignatureService.Get | DocumentsRelease, MFA, bishop, clergy, self |
| POST | `/api/parishes/{parishId}/document-signatures/{code}/revoke` | DocumentSignatures | user |  | g200 |  | yes |  | DocumentSignatureService.Revoke | MFA, bishop, clergy, self |
| GET | `/api/public/document-verifications/{code}` | DocumentSignatures | anon |  | auth20 |  |  |  | DocumentSignatureService.Verify | not detected |
| PUT | `/api/parishes/{parishId}/letters/{letterId}` | RequestLetters | user |  | g200 |  | yes |  | RequestLetterService.Revise | MFA, RequestsManage, mod:requests |
| POST | `/api/parishes/{parishId}/letters/{letterId}/authorization` | RequestLetters | user |  | g200 |  | yes |  | RequestLetterService.Sign | MFA, clergy, mod:requests, self |
| GET | `/api/parishes/{parishId}/letters/{letterId}/authorization-preview` | RequestLetters | user |  | g200 |  |  |  | RequestLetterService.Preview | DocumentsRelease, MFA, RequestsManage, clergy, mod:requests, self |
| GET | `/api/parishes/{parishId}/letters/{letterId}/notification-outcome` | RequestLetters | user |  | g200 |  |  |  | RequestLetterService.NotificationOutcome | DocumentsRelease, MFA, RequestsManage, clergy, mod:requests, self |
| POST | `/api/parishes/{parishId}/letters/{letterId}/release` | RequestLetters | user |  | g200 |  | yes |  | RequestLetterService.Release | DocumentsRelease, MFA, mod:requests, self |
| POST | `/api/parishes/{parishId}/letters/{letterId}/withdraw` | RequestLetters | user |  | g200 |  | yes |  | RequestLetterService.Withdraw | DocumentsRelease, MFA, mod:requests, self |
| GET | `/api/parishes/{parishId}/requests/{requestId}/letters` | RequestLetters | user |  | g200 |  |  |  | RequestLetterService.List | DocumentsRelease, MFA, RequestsManage, clergy, mod:requests, self |
| POST | `/api/parishes/{parishId}/requests/{requestId}/letters` | RequestLetters | user |  | g200 |  | yes |  | RequestLetterService.Create | MFA, RequestsManage, mod:requests, self |
| GET | `/api/parishes/{parishId}/requests/{requestId}/letters/mine` | RequestLetters | user |  | g200 |  |  |  | RequestLetterService.Mine | self |
| GET | `/api/public/parishes/{parishId}/requests/{requestId}/letters` | RequestLetters | anon |  | auth20 |  |  |  | RequestLetterService.Guest | tracking-token |

#### Files (6)

| Method | Path | Controller | Auth | Rec | Rate | TS | CSRF | Cache | Service call | Checks found (heuristic) |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/parishes/{parishId}/requests/{requestId}/files` | Evidence | user |  | g200 |  |  |  | EvidenceService.List | MFA, RequestsManage, mod:requests, self |
| POST | `/api/parishes/{parishId}/requests/{requestId}/files` | Evidence | user |  | g200 |  | yes |  | EvidenceService.Upload | MFA, RequestsManage, mod:requests, self |
| GET | `/api/parishes/{parishId}/requests/{requestId}/files/{fileId}` | Evidence | user |  | g200 |  |  |  | EvidenceService.Download | MFA, RequestsManage, mod:requests, self |
| POST | `/api/parishes/{parishId}/requests/{requestId}/files/{fileId}/remove` | Evidence | user |  | g200 |  | yes |  | EvidenceService.Remove | MFA, RequestsManage, mod:requests, self |
| GET | `/api/public/parishes/{parishId}/requests/{requestId}/files` | GuestEvidence | anon |  | auth20 |  |  |  | EvidenceService.GuestList | mod:requests, tracking-token |
| POST | `/api/public/parishes/{parishId}/requests/{requestId}/files` | GuestEvidence | anon |  | auth20 |  | yes |  | EvidenceService.GuestUpload | mod:requests, tracking-token |

#### Finance (51)

| Method | Path | Controller | Auth | Rec | Rate | TS | CSRF | Cache | Service call | Checks found (heuristic) |
|---|---|---|---|---|---|---|---|---|---|---|
| POST | `/api/parishes/{parishId}/finance/bank/imports` | Bank | user |  | g200 |  | yes |  | BankReconciliationService.Import | FinanceEnter, self |
| GET | `/api/parishes/{parishId}/finance/bank/lines` | Bank | user |  | g200 |  |  |  | BankReconciliationService.Lines | FinanceRead |
| POST | `/api/parishes/{parishId}/finance/bank/lines/{lineId}/actions` | Bank | user |  | g200 |  | yes |  | BankReconciliationService.Act | FinanceApprove, FinancePost, self |
| GET | `/api/parishes/{parishId}/finance/bank/reconciliations` | Bank | user |  | g200 |  |  |  | BankReconciliationService.Reconciliations | FinanceRead |
| POST | `/api/parishes/{parishId}/finance/bank/reconciliations` | Bank | user |  | g200 |  | yes |  | BankReconciliationService.Reconcile | FinanceApprove, self |
| POST | `/api/parishes/{parishId}/finance/bank/reconciliations/reopen` | Bank | user |  | g200 |  | yes |  | BankReconciliationService.Reopen | FinanceApprove, self |
| GET | `/api/parishes/{parishId}/finance/balances` | Finance | user |  | g200 |  |  |  | ExpenseService.Balances | not detected |
| GET | `/api/parishes/{parishId}/finance/campaigns` | Finance | user |  | g200 |  |  |  | GivingService.Campaigns | FinanceRead, MFA, mod:finance |
| POST | `/api/parishes/{parishId}/finance/campaigns` | Finance | user |  | g200 |  | yes |  | GivingService.CreateCampaign | FinanceApprove, MFA, mod:finance, self |
| PUT | `/api/parishes/{parishId}/finance/campaigns/{campaignId}` | Finance | user |  | g200 |  | yes |  | GivingService.UpdateCampaign | FinanceApprove, MFA, mod:finance |
| GET | `/api/parishes/{parishId}/finance/contributions` | Finance | user |  | g200 |  |  |  | GivingService.Contributions | FinanceRead, MFA, mod:finance |
| POST | `/api/parishes/{parishId}/finance/contributions/{contributionId}/corrections` | Finance | user |  | g200 |  | yes |  | GivingService.Correct | FinanceApprove, MFA, mod:finance, self |
| GET | `/api/parishes/{parishId}/finance/expenses` | Finance | user |  | g200 |  |  |  | ExpenseService.List | FinanceRead |
| POST | `/api/parishes/{parishId}/finance/expenses` | Finance | user |  | g200 |  | yes |  | ExpenseService.Save | FinanceEnter, self |
| PUT | `/api/parishes/{parishId}/finance/expenses/{expenseId}` | Finance | user |  | g200 |  | yes |  | ExpenseService.Save | FinanceEnter, self |
| POST | `/api/parishes/{parishId}/finance/expenses/{expenseId}/actions` | Finance | user |  | g200 |  | yes |  | ExpenseService.Act | FinanceApprove, FinanceEnter, FinancePost, self |
| GET | `/api/parishes/{parishId}/finance/funds` | Finance | user |  | g200 |  |  |  | GivingService.Funds | FinanceRead, MFA, mod:finance |
| POST | `/api/parishes/{parishId}/finance/funds` | Finance | user |  | g200 |  | yes |  | GivingService.CreateFund | FinanceApprove, MFA, mod:finance, self |
| PUT | `/api/parishes/{parishId}/finance/funds/{fundId}` | Finance | user |  | g200 |  | yes |  | GivingService.UpdateFund | FinanceApprove, MFA, mod:finance |
| GET | `/api/parishes/{parishId}/finance/giving/mine` | Finance | user |  | g200 |  |  |  | GivingService.OwnGiving | not detected |
| GET | `/api/parishes/{parishId}/finance/pledges` | Finance | user |  | g200 |  |  |  | GivingService.Pledges | FinanceRead, MFA, mod:finance |
| POST | `/api/parishes/{parishId}/finance/pledges` | Finance | user |  | g200 |  | yes |  | GivingService.CreatePledge | FinanceEnter, MFA, mod:finance, self |
| POST | `/api/parishes/{parishId}/finance/pledges/{pledgeId}/allocations` | Finance | user |  | g200 |  | yes |  | GivingService.Allocate | FinanceEnter, MFA, mod:finance, self |
| GET | `/api/parishes/{parishId}/finance/sessions` | Finance | user |  | g200 |  |  |  | GivingService.Sessions | FinanceRead, MFA, mod:finance |
| POST | `/api/parishes/{parishId}/finance/sessions` | Finance | user |  | g200 |  | yes |  | GivingService.OpenSession | FinanceEnter, MFA, mod:finance, self |
| GET | `/api/parishes/{parishId}/finance/sessions/{sessionId}` | Finance | user |  | g200 |  |  |  | GivingService.Session | FinanceRead, MFA, mod:finance |
| PUT | `/api/parishes/{parishId}/finance/sessions/{sessionId}/lines` | Finance | user |  | g200 |  | yes |  | GivingService.SaveLines | FinanceEnter, MFA, mod:finance, self |
| POST | `/api/parishes/{parishId}/finance/sessions/{sessionId}/post` | Finance | user |  | g200 |  | yes |  | GivingService.Post | FinancePost, MFA, mod:finance, self |
| POST | `/api/parishes/{parishId}/finance/sessions/{sessionId}/verify` | Finance | user |  | g200 |  | yes |  | GivingService.Verify | FinanceEnter, MFA, mod:finance, self |
| GET | `/api/parishes/{parishId}/finance/statements` | Finance | user |  | g200 |  |  |  | GivingService.Statement | FinanceRead, MFA, mod:finance |
| GET | `/api/parishes/{parishId}/finance/budgets` | FinanceRecords | user |  | g200 |  |  |  | FundBudgetService.List | FinanceRead |
| PUT | `/api/parishes/{parishId}/finance/budgets` | FinanceRecords | user |  | g200 |  | yes |  | FundBudgetService.Save | FinanceApprove, self |
| GET | `/api/parishes/{parishId}/finance/exchange-rates` | FinanceRecords | user |  | g200 |  |  |  | ExchangeRateService.List | FinanceRead |
| POST | `/api/parishes/{parishId}/finance/exchange-rates` | FinanceRecords | user |  | g200 |  | yes |  | ExchangeRateService.Record | FinanceApprove, self |
| GET | `/api/parishes/{parishId}/finance/exchange-rates/current` | FinanceRecords | user |  | g200 |  |  |  | ExchangeRateService.Current | FinanceRead |
| GET | `/api/parishes/{parishId}/finance/receipts` | FinanceRecords | user |  | g200 |  |  |  | GiftReceiptService.List | FinanceRead |
| POST | `/api/parishes/{parishId}/finance/receipts` | FinanceRecords | user |  | g200 |  | yes |  | GiftReceiptService.Issue | FinancePost, self |
| POST | `/api/parishes/{parishId}/finance/receipts/{receiptId}/void` | FinanceRecords | user |  | g200 |  | yes |  | GiftReceiptService.Void | FinanceApprove, self |
| GET | `/api/parishes/{parishId}/finance/recurring-gifts` | FinanceRecords | user |  | g200 |  |  |  | RecurringGiftService.List | FinanceRead |
| POST | `/api/parishes/{parishId}/finance/recurring-gifts` | FinanceRecords | user |  | g200 |  | yes |  | RecurringGiftService.Save | FinanceEnter, self |
| PUT | `/api/parishes/{parishId}/finance/recurring-gifts/{giftId}` | FinanceRecords | user |  | g200 |  | yes |  | RecurringGiftService.Save | FinanceEnter, self |
| POST | `/api/parishes/{parishId}/finance/recurring-gifts/{giftId}/actions` | FinanceRecords | user |  | g200 |  | yes |  | RecurringGiftService.Act | FinanceEnter, self |
| GET | `/api/parishes/{parishId}/office-ledger/balances` | OfficeLedger | user |  | g200 |  |  |  | OfficeLedgerService.Balances | FinanceRead |
| GET | `/api/parishes/{parishId}/office-ledger/entries` | OfficeLedger | user |  | g200 |  |  |  | OfficeLedgerService.Entries | FinanceRead |
| POST | `/api/parishes/{parishId}/office-ledger/entries` | OfficeLedger | user |  | g200 |  | yes |  | OfficeLedgerService.Save | FinanceEnter, self |
| PUT | `/api/parishes/{parishId}/office-ledger/entries/{entryId}` | OfficeLedger | user |  | g200 |  | yes |  | OfficeLedgerService.Save | FinanceEnter, self |
| POST | `/api/parishes/{parishId}/office-ledger/entries/{entryId}/actions` | OfficeLedger | user |  | g200 |  | yes |  | OfficeLedgerService.Act | FinanceEnter, self |
| GET | `/api/parishes/{parishId}/office-ledger/months` | OfficeLedger | user |  | g200 |  |  |  | OfficeLedgerService.Months | FinanceRead |
| POST | `/api/parishes/{parishId}/office-ledger/months` | OfficeLedger | user |  | g200 |  | yes |  | OfficeLedgerService.CloseMonth | FinanceApprove, self |
| GET | `/api/parishes/{parishId}/office-ledger/openings` | OfficeLedger | user |  | g200 |  |  |  | OfficeLedgerService.Openings | FinanceRead |
| POST | `/api/parishes/{parishId}/office-ledger/openings` | OfficeLedger | user |  | g200 |  | yes |  | OfficeLedgerService.Open | FinanceApprove, self |

#### Ministries (86)

| Method | Path | Controller | Auth | Rec | Rate | TS | CSRF | Cache | Service call | Checks found (heuristic) |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/parishes/{parishId}/ministries` | Ministries | user |  | g200 |  |  |  | MinistryService.List | not detected |
| POST | `/api/parishes/{parishId}/ministries` | Ministries | user |  | g200 |  | yes |  | MinistryService.Save | self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}` | Ministries | user |  | g200 |  |  |  | MinistryService.Get | not detected |
| PUT | `/api/parishes/{parishId}/ministries/{ministryId}` | Ministries | user |  | g200 |  | yes |  | MinistryService.Save | self |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/actions` | Ministries | user |  | g200 |  | yes |  | MinistryService.Act | PublishingManage, self |
| PUT | `/api/parishes/{parishId}/ministries/{ministryId}/meeting-times` | Ministries | user |  | g200 |  | yes |  | MinistryService.SaveMeetingTimes | self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/member-info` | Ministries | user |  | g200 |  |  |  | MinistryService.MemberInfo | not detected |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/applications` | MinistryApplications | user |  | g200 |  |  |  | MinistryApplicationService.List | not detected |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/applications` | MinistryApplications | user |  | g200 |  | yes |  | MinistryApplicationService.Apply | PeopleWrite, self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/applications/mine` | MinistryApplications | user |  | g200 |  |  |  | MinistryApplicationService.Own | self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/applications/{applicationId}` | MinistryApplications | user |  | g200 |  |  |  | MinistryApplicationService.Get | PeopleWrite, self |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/applications/{applicationId}/actions` | MinistryApplications | user |  | g200 |  | yes |  | MinistryApplicationService.Act | PeopleWrite, self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/applications/{applicationId}/evidence` | MinistryApplications | user |  | g200 |  |  |  | MinistryApplicationService.Evidence | PeopleWrite, self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/applications/{applicationId}/history` | MinistryApplications | user |  | g200 |  |  |  | MinistryApplicationService.History | PeopleWrite, self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/membership/mine` | MinistryApplications | user |  | g200 |  |  |  | MinistryApplicationService.OwnMembership | not detected |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/roster` | MinistryApplications | user |  | g200 |  |  |  | MinistryApplicationService.Roster | not detected |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/roster/{personId}/end` | MinistryApplications | user |  | g200 |  | yes |  | MinistryApplicationService.EndMembership | self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}/attendance` | MinistryAttendance | user |  | g200 |  |  |  | MinistryAttendanceService.Get | appt:Reader, min:Attendance |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}/attendance` | MinistryAttendance | user |  | g200 |  | yes |  | MinistryAttendanceService.Open | appt:Reader, min:Attendance, self |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}/attendance/close` | MinistryAttendance | user |  | g200 |  | yes |  | MinistryAttendanceService.Close | min:Attendance, self |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}/attendance/corrections` | MinistryAttendance | user |  | g200 |  | yes |  | MinistryAttendanceService.Correct | min:Attendance, self |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}/attendance/guests` | MinistryAttendance | user |  | g200 |  | yes |  | MinistryAttendanceService.AddGuest | min:Attendance, self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}/attendance/history` | MinistryAttendance | user |  | g200 |  |  |  | MinistryAttendanceService.History | min:Attendance |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}/attendance/mine` | MinistryAttendance | user |  | g200 |  |  |  | MinistryAttendanceService.Own | not detected |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}/attendance/records` | MinistryAttendance | user |  | g200 |  | yes |  | MinistryAttendanceService.Record | appt:Reader, min:Attendance, self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}/attendance/rows` | MinistryAttendance | user |  | g200 |  |  |  | MinistryAttendanceService.Grid | appt:Reader, min:Attendance |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}/attendance/snapshot` | MinistryAttendance | user |  | g200 |  | yes |  | MinistryAttendanceService.AdvanceSnapshot | appt:Reader, min:Attendance, self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/applications/{applicationId}/private-reason` | MinistryDepartures | user |  | g200 |  |  |  | MinistryDepartureService.Get | not detected |
| PUT | `/api/parishes/{parishId}/ministries/{ministryId}/applications/{applicationId}/private-reason` | MinistryDepartures | user |  | g200 |  | yes |  | MinistryDepartureService.Save | self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/formation/enrollments` | MinistryFormation | user |  | g200 |  |  |  | MinistryFormationService.ListEnrollments | min:Formation |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/formation/enrollments/mine` | MinistryFormation | user |  | g200 |  |  |  | MinistryFormationService.OwnEnrollments | not detected |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/formation/enrollments/{enrollmentId}` | MinistryFormation | user |  | g200 |  |  |  | MinistryFormationService.GetEnrollment | min:Formation |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/formation/enrollments/{enrollmentId}/actions` | MinistryFormation | user |  | g200 |  | yes |  | MinistryFormationService.EnrollmentAction | member, min:Formation, self |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/formation/enrollments/{enrollmentId}/milestones` | MinistryFormation | user |  | g200 |  | yes |  | MinistryFormationService.Progress | member, min:Formation, self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/formation/people/{personId}/history` | MinistryFormation | user |  | g200 |  |  |  | MinistryFormationService.History | min:Formation |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/formation/programs` | MinistryFormation | user |  | g200 |  |  |  | MinistryFormationService.ListPrograms | min:Formation |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/formation/programs` | MinistryFormation | user |  | g200 |  | yes |  | MinistryFormationService.CreateProgram | min:Formation, self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/formation/programs/{programId}` | MinistryFormation | user |  | g200 |  |  |  | MinistryFormationService.GetProgram | min:Formation |
| PUT | `/api/parishes/{parishId}/ministries/{ministryId}/formation/programs/{programId}` | MinistryFormation | user |  | g200 |  | yes |  | MinistryFormationService.UpdateProgram | min:Formation |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/formation/programs/{programId}/actions` | MinistryFormation | user |  | g200 |  | yes |  | MinistryFormationService.ActProgram | self |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/formation/programs/{programId}/enrollments` | MinistryFormation | user |  | g200 |  | yes |  | MinistryFormationService.Enroll | member, min:Formation, self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/leadership` | MinistryLeadership | user |  | g200 |  |  |  | MinistryLeadershipService.List | MFA, MinistriesManage, appt:Reader, self |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/leadership` | MinistryLeadership | user |  | g200 |  | yes |  | MinistryLeadershipService.Appoint | MFA, MinistriesAttendanceRecord, MinistriesAttendanceReview, MinistriesFormationRecord, MinistriesFormationReview, MinistriesManage, MinistriesResourcesManage, MinistriesRsvpPrivateRead, MinistriesVolunteersManage, clergy, mod:ministries, priest, self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/leadership/{accountId}` | MinistryLeadership | user |  | g200 |  |  |  | MinistryLeadershipService.Get | MFA, MinistriesManage, appt:Reader, self |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/leadership/{accountId}/duties` | MinistryLeadership | user |  | g200 |  | yes |  | MinistryLeadershipService.ChangeDuties | MFA, MinistriesAttendanceRecord, MinistriesAttendanceReview, MinistriesFormationRecord, MinistriesFormationReview, MinistriesManage, MinistriesResourcesManage, MinistriesRsvpPrivateRead, MinistriesVolunteersManage, clergy, mod:ministries, priest, self |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/leadership/{accountId}/end` | MinistryLeadership | user |  | g200 |  | yes |  | MinistryLeadershipService.End | MFA, MinistriesManage, clergy, priest, self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/leadership/{accountId}/history` | MinistryLeadership | user |  | g200 |  |  |  | MinistryLeadershipService.History | MFA, MinistriesManage |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/meetings` | MinistryMeetings | user |  | g200 |  |  |  | MinistryMeetingService.List | not detected |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/meetings` | MinistryMeetings | user |  | g200 |  | yes |  | MinistryMeetingService.Save | self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}` | MinistryMeetings | user |  | g200 |  |  |  | MinistryMeetingService.Get | not detected |
| PUT | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}` | MinistryMeetings | user |  | g200 |  | yes |  | MinistryMeetingService.Save | self |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}/actions` | MinistryMeetings | user |  | g200 |  | yes |  | MinistryMeetingService.Act | not detected |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}/history` | MinistryMeetings | user |  | g200 |  |  |  | MinistryMeetingService.History | not detected |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}/rsvp` | MinistryMeetings | user |  | g200 |  |  |  | MinistryMeetingService.OwnRsvp | self |
| PUT | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}/rsvp` | MinistryMeetings | user |  | g200 |  | yes |  | MinistryMeetingService.Rsvp | self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}/rsvps` | MinistryMeetings | user |  | g200 |  |  |  | MinistryMeetingService.Rsvps | not detected |
| POST | `/api/parishes/{parishId}/person-account-links` | MinistryPersonLinks | user |  | g200 |  | yes |  | MinistryPersonLinkService.Link | MFA, PeopleWrite, mod:office, self |
| GET | `/api/parishes/{parishId}/person-account-links/by-person/{personId}` | MinistryPersonLinks | user |  | g200 |  |  |  | MinistryPersonLinkService.GetByPerson | MFA, PeopleWrite |
| GET | `/api/parishes/{parishId}/person-account-links/mine` | MinistryPersonLinks | user |  | g200 |  |  |  | MinistryPersonLinkService.GetOwn | not detected |
| GET | `/api/parishes/{parishId}/person-account-links/{accountId}` | MinistryPersonLinks | user |  | g200 |  |  |  | MinistryPersonLinkService.Get | MFA, PeopleWrite |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/loans` | MinistryResources | user |  | g200 |  |  |  | MinistryResourceService.List | min:Custody |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/loans` | MinistryResources | user |  | g200 |  | yes |  | MinistryResourceService.Request | member, min:Custody, self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/loans/mine` | MinistryResources | user |  | g200 |  |  |  | MinistryResourceService.Own | not detected |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/loans/{loanId}` | MinistryResources | user |  | g200 |  |  |  | MinistryResourceService.Get | min:Custody |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/loans/{loanId}/actions` | MinistryResources | user |  | g200 |  | yes |  | MinistryResourceService.Act | member, min:Custody, self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/people/{personId}/loan-history` | MinistryResources | user |  | g200 |  |  |  | MinistryResourceService.History | min:Custody |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/stock` | MinistryResources | user |  | g200 |  |  |  | MinistryResourceService.ListStock | min:Custody |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/stock` | MinistryResources | user |  | g200 |  | yes |  | MinistryResourceService.SaveStock | min:Custody, self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/stock/available` | MinistryResources | user |  | g200 |  |  |  | MinistryResourceService.AvailableStock | member |
| PUT | `/api/parishes/{parishId}/ministries/{ministryId}/stock/{stockId}` | MinistryResources | user |  | g200 |  | yes |  | MinistryResourceService.SaveStock | min:Custody, self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}/rsvp-private-reason` | MinistryRsvpPrivacy | user |  | g200 |  |  |  | MinistryRsvpPrivacyService.GetOwn | self |
| PUT | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}/rsvp-private-reason` | MinistryRsvpPrivacy | user |  | g200 |  | yes |  | MinistryRsvpPrivacyService.Save | self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/meetings/{meetingId}/rsvp-private-reason/{personId}` | MinistryRsvpPrivacy | user |  | g200 |  |  |  | MinistryRsvpPrivacyService.Get | min:RsvpReasonReader |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/volunteering/assignments/mine` | MinistryVolunteers | user |  | g200 |  |  |  | MinistryVolunteerService.OwnAssignments | not detected |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/volunteering/assignments/{assignmentId}/actions` | MinistryVolunteers | user |  | g200 |  | yes |  | MinistryVolunteerService.Act | member, min:Coordinator, self |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/volunteering/assignments/{assignmentId}/hours` | MinistryVolunteers | user |  | g200 |  | yes |  | MinistryVolunteerService.SubmitHours | min:Coordinator, self |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/volunteering/assignments/{assignmentId}/hours/actions` | MinistryVolunteers | user |  | g200 |  | yes |  | MinistryVolunteerService.HoursAction | min:Coordinator, self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/volunteering/hours/mine` | MinistryVolunteers | user |  | g200 |  |  |  | MinistryVolunteerService.OwnHours | not detected |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/volunteering/opportunities` | MinistryVolunteers | user |  | g200 |  |  |  | MinistryVolunteerService.ListOpportunities | min:Coordinator |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/volunteering/opportunities` | MinistryVolunteers | user |  | g200 |  | yes |  | MinistryVolunteerService.CreateOpportunity | min:Coordinator, self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/volunteering/opportunities/open` | MinistryVolunteers | user |  | g200 |  |  |  | MinistryVolunteerService.OpenOpportunities | member |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/volunteering/opportunities/{opportunityId}/actions` | MinistryVolunteers | user |  | g200 |  | yes |  | MinistryVolunteerService.OpportunityAction | min:Coordinator |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/volunteering/opportunities/{opportunityId}/assignments` | MinistryVolunteers | user |  | g200 |  |  |  | MinistryVolunteerService.Team | min:Coordinator |
| POST | `/api/parishes/{parishId}/ministries/{ministryId}/volunteering/opportunities/{opportunityId}/assignments` | MinistryVolunteers | user |  | g200 |  | yes |  | MinistryVolunteerService.Invite | member, min:Coordinator, self |
| GET | `/api/parishes/{parishId}/ministries/{ministryId}/volunteering/people/{personId}/hours` | MinistryVolunteers | user |  | g200 |  |  |  | MinistryVolunteerService.Hours | min:Coordinator |
| GET | `/api/public/parishes/{parishId}/ministries` | PublicMinistries | anon |  | g200 |  |  |  | MinistryService.Public | not detected |

#### Organizations (47)

| Method | Path | Controller | Auth | Rec | Rate | TS | CSRF | Cache | Service call | Checks found (heuristic) |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/archdioceses/{archdioceseId}/staff-appointments` | ArchdioceseStaffAppointments | user |  | g200 |  |  |  | StaffAppointmentService.List | appt:Reader |
| POST | `/api/archdioceses/{archdioceseId}/staff-appointments` | ArchdioceseStaffAppointments | user |  | g200 |  | yes |  | StaffAppointmentService.Invite | MFA, bishop, self, verified |
| GET | `/api/archdioceses/{archdioceseId}/staff-appointments/scope` | ArchdioceseStaffAppointments | user |  | g200 |  |  |  | StaffAppointmentService.Scope | bishop |
| GET | `/api/archdioceses/{archdioceseId}/staff-appointments/{appointmentId}` | ArchdioceseStaffAppointments | user |  | g200 |  |  |  | StaffAppointmentService.Get | appt:Reader, self, verified |
| POST | `/api/archdioceses/{archdioceseId}/staff-appointments/{appointmentId}/actions` | ArchdioceseStaffAppointments | user |  | g200 |  | yes |  | StaffAppointmentService.Act | MFA, bishop, self |
| POST | `/api/archdioceses/{archdioceseId}/staff-appointments/{appointmentId}/response` | ArchdioceseStaffAppointments | user |  | g200 |  | yes |  | StaffAppointmentService.Decide | MFA, self |
| GET | `/api/archdioceses/{archdioceseId}/staff-appointments/{appointmentId}/workspace` | ArchdioceseStaffAppointments | user |  | g200 |  |  |  | StaffAppointmentService.Workspace | appt:Own, self |
| POST | `/api/archdioceses` | Archdioceses | user |  | g200 |  | yes |  | ParishService.RegisterArchdiocese | operator+MFA, self |
| GET | `/api/archdioceses/{organizationId}` | Archdioceses | user |  | g200 |  |  |  | ParishService.GetArchdiocese | self |
| POST | `/api/archdioceses/{organizationId}/verify` | Archdioceses | user |  | g200 |  | yes |  | ParishService.VerifyArchdiocese | operator+MFA |
| POST | `/api/archdioceses/{archdioceseId}/bishop-appointments` | BishopAppointments | user |  | g200 |  | yes |  | BishopAppointmentService.Propose, TimeProvider.GetUtcNow | operator+MFA, self, verified |
| GET | `/api/archdioceses/{archdioceseId}/bishop-appointments/{appointmentId}` | BishopAppointments | user |  | g200 |  |  |  | BishopAppointmentService.Get | operator+MFA, self, verified |
| POST | `/api/archdioceses/{archdioceseId}/bishop-appointments/{appointmentId}/response` | BishopAppointments | user |  | g200 |  | yes |  | BishopAppointmentService.Decide, TimeProvider.GetUtcNow | self, verified |
| POST | `/api/archdioceses/{archdioceseId}/bishop-appointments/{appointmentId}/review` | BishopAppointments | user |  | g200 |  | yes |  | BishopAppointmentService.Review, TimeProvider.GetUtcNow | operator+MFA, self, verified |
| GET | `/api/parishes/{parishId}/ownership-claims` | OwnershipClaims | user |  | g200 |  |  |  | OwnershipRecoveryService.List | MFA, operator+MFA, self |
| POST | `/api/parishes/{parishId}/ownership-claims` | OwnershipClaims | user |  | g200 |  | yes |  | OwnershipRecoveryService.Open | MFA, self |
| GET | `/api/parishes/{parishId}/ownership-claims/{claimId}` | OwnershipClaims | user |  | g200 |  |  |  | OwnershipRecoveryService.Get | MFA, operator+MFA, self |
| POST | `/api/parishes/{parishId}/ownership-claims/{claimId}/decision` | OwnershipClaims | user |  | g200 |  | yes |  | OwnershipRecoveryService.Decide | MFA, SetupOwner, operator+MFA, self |
| POST | `/api/parishes/{parishId}/ownership-claims/{claimId}/response` | OwnershipClaims | user |  | g200 |  | yes |  | OwnershipRecoveryService.Respond | MFA, self |
| POST | `/api/parishes/{parishId}/ownership-claims/{claimId}/withdraw` | OwnershipClaims | user |  | g200 |  | yes |  | OwnershipRecoveryService.Withdraw | MFA, self |
| POST | `/api/parishes/{parishId}/jurisdiction-proposals` | ParishJurisdiction | user |  | g200 |  | yes |  | ParishJurisdictionService.Propose | MFA, self |
| GET | `/api/parishes/{parishId}/jurisdiction-proposals/{proposalId}` | ParishJurisdiction | user |  | g200 |  |  |  | ParishJurisdictionService.Get | MFA, bishop, self |
| POST | `/api/parishes/{parishId}/jurisdiction-proposals/{proposalId}/decision` | ParishJurisdiction | user |  | g200 |  | yes |  | ParishJurisdictionService.Decide | MFA, bishop, self |
| GET | `/api/parishes/{parishId}/location` | ParishLocation | user |  | g200 |  |  |  | ParishLocationService.Get | MFA, ParishManage |
| PUT | `/api/parishes/{parishId}/location` | ParishLocation | user |  | g200 |  | yes |  | ParishLocationService.Set | MFA, ParishManage, self |
| GET | `/api/archdioceses/{archdioceseId}/parishes/{parishId}/priest-appointments` | ParishPriestAppointments | user |  | g200 |  |  |  | StaffAppointmentService.List | appt:Reader |
| POST | `/api/archdioceses/{archdioceseId}/parishes/{parishId}/priest-appointments` | ParishPriestAppointments | user |  | g200 |  | yes |  | StaffAppointmentService.Invite | MFA, bishop, self, verified |
| GET | `/api/archdioceses/{archdioceseId}/parishes/{parishId}/priest-appointments/scope` | ParishPriestAppointments | user |  | g200 |  |  |  | StaffAppointmentService.Scope | bishop |
| GET | `/api/archdioceses/{archdioceseId}/parishes/{parishId}/priest-appointments/{appointmentId}` | ParishPriestAppointments | user |  | g200 |  |  |  | StaffAppointmentService.Get | appt:Reader, self, verified |
| POST | `/api/archdioceses/{archdioceseId}/parishes/{parishId}/priest-appointments/{appointmentId}/actions` | ParishPriestAppointments | user |  | g200 |  | yes |  | StaffAppointmentService.Act | MFA, bishop, self |
| PUT | `/api/archdioceses/{archdioceseId}/parishes/{parishId}/priest-appointments/{appointmentId}/head-designation` | ParishPriestAppointments | user |  | g200 |  | yes |  | StaffAppointmentService.DesignateHead | MFA, bishop, self |
| POST | `/api/archdioceses/{archdioceseId}/parishes/{parishId}/priest-appointments/{appointmentId}/head-designation/end` | ParishPriestAppointments | user |  | g200 |  | yes |  | StaffAppointmentService.EndHead | MFA, bishop, self |
| POST | `/api/archdioceses/{archdioceseId}/parishes/{parishId}/priest-appointments/{appointmentId}/response` | ParishPriestAppointments | user |  | g200 |  | yes |  | StaffAppointmentService.Decide | MFA, self |
| GET | `/api/archdioceses/{archdioceseId}/parishes/{parishId}/priest-appointments/{appointmentId}/workspace` | ParishPriestAppointments | user |  | g200 |  |  |  | StaffAppointmentService.Workspace | appt:Own, self |
| GET | `/api/parishes/{parishId}/office/coverage` | ParishStatus | user |  | g200 |  |  |  | OfficeCoverageService.Coverage | AccessManage, MFA |
| POST | `/api/parishes/{parishId}/status` | ParishStatus | user |  | g200 |  | yes |  | ParishStatusService.Change | MFA, bishop, self |
| GET | `/api/parishes/{parishId}/status/history` | ParishStatus | user |  | g200 |  |  |  | ParishStatusService.History | MFA, bishop |
| GET | `/api/parishes/{parishId}/status/history/{changeId}/notification-outcome` | ParishStatus | user |  | g200 |  |  |  | ParishStatusService.NotificationOutcome | MFA, bishop |
| POST | `/api/parishes` | Parishes | user |  | g200 |  | yes |  | ParishService.Register | SetupOwner, self |
| GET | `/api/parishes/{parishId}` | Parishes | user |  | g200 |  |  |  | ParishService.Get | BillingRead |
| POST | `/api/parishes/{parishId}/association-requests` | Parishes | user |  | g200 |  | yes |  | ParishService.ProposeAssociation | ParishManage |
| GET | `/api/parishes/{parishId}/association-requests/{requestId}` | Parishes | user |  | g200 |  |  |  | ParishService.GetAssociation | ParishManage, self |
| POST | `/api/parishes/{parishId}/association-requests/{requestId}/decision` | Parishes | user |  | g200 |  | yes |  | ParishService.DecideAssociation | self |
| POST | `/api/parishes/{parishId}/association/end` | Parishes | user |  | g200 |  | yes |  | ParishService.EndAssociation | ParishManage |
| PUT | `/api/parishes/{parishId}/grants` | Parishes | user |  | g200 |  | yes |  | ParishService.Grant | AccessManage, All, self, verified |
| POST | `/api/parishes/{parishId}/grants/revoke` | Parishes | user |  | g200 |  | yes |  | ParishService.Revoke | AccessManage, self |
| POST | `/api/parishes/{parishId}/verify` | Parishes | user |  | g200 |  | yes |  | ParishService.Verify | operator+MFA |

#### People (67)

| Method | Path | Controller | Auth | Rec | Rate | TS | CSRF | Cache | Service call | Checks found (heuristic) |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/parishes/{parishId}/account-names` | AccountNames | user |  | g200 |  |  |  | AccountNamesService.List | PeopleRead, mod:office, self |
| GET | `/api/parishes/{parishId}/people/duplicates` | Duplicates | user |  | g200 |  |  |  | DuplicateService.Suggest | MFA, PeopleRead, mod:office |
| POST | `/api/parishes/{parishId}/people/duplicates/decisions` | Duplicates | user |  | g200 |  | yes |  | DuplicateService.Decide | MFA, PeopleWrite, mod:office, self |
| GET | `/api/parishes/{parishId}/people/merges` | Duplicates | user |  | g200 |  |  |  | DuplicateService.Merges | MFA, PeopleRead, mod:office |
| POST | `/api/parishes/{parishId}/people/merges` | Duplicates | user |  | g200 |  | yes |  | DuplicateService.Merge | MFA, PeopleWrite, clergy, mod:office, self |
| GET | `/api/parishes/{parishId}/people/merges/preview` | Duplicates | user |  | g200 |  |  |  | DuplicateService.PreviewMerge | MFA, PeopleRead, mod:office |
| POST | `/api/parishes/{parishId}/people/merges/{mergeId}/unmerge` | Duplicates | user |  | g200 |  | yes |  | DuplicateService.Unmerge | MFA, PeopleWrite, mod:office, self |
| GET | `/api/parishes/{parishId}/households` | Households | user |  | g200 |  |  |  | HouseholdService.List | MFA, PeopleRead, mod:office |
| POST | `/api/parishes/{parishId}/households` | Households | user |  | g200 |  | yes |  | HouseholdService.Save | MFA, PeopleWrite, mod:office, self |
| GET | `/api/parishes/{parishId}/households/{householdId}` | Households | user |  | g200 |  |  |  | HouseholdService.Get | MFA, PeopleRead, mod:office |
| PUT | `/api/parishes/{parishId}/households/{householdId}` | Households | user |  | g200 |  | yes |  | HouseholdService.Save | MFA, PeopleWrite, mod:office, self |
| GET | `/api/parishes/{parishId}/households/{householdId}/history` | Households | user |  | g200 |  |  |  | HouseholdService.History | MFA, PeopleRead, mod:office |
| POST | `/api/parishes/{parishId}/households/{householdId}/members` | Households | user |  | g200 |  | yes |  | HouseholdService.Member | MFA, PeopleWrite, mod:office, self |
| GET | `/api/parishes/{parishId}/people/{personId}/relationships` | Households | user |  | g200 |  |  |  | HouseholdService.Relationships | MFA, PeopleRead, mod:office |
| POST | `/api/parishes/{parishId}/people/{personId}/relationships` | Households | user |  | g200 |  | yes |  | HouseholdService.AddRelationship | MFA, PeopleWrite, mod:office, self |
| POST | `/api/parishes/{parishId}/people/{personId}/relationships/{relationshipId}/end` | Households | user |  | g200 |  | yes |  | HouseholdService.EndRelationship | MFA, PeopleWrite, mod:office |
| GET | `/api/me/parishes` | Membership | user |  | g200 |  |  |  | MembershipService.MyParishes | self |
| DELETE | `/api/parishes/{parishId}/follow` | Membership | user |  | g200 |  | yes |  | MembershipService.Unfollow | self |
| POST | `/api/parishes/{parishId}/follow` | Membership | user |  | g200 |  | yes |  | MembershipService.Follow | self |
| GET | `/api/parishes/{parishId}/membership-requests` | Membership | user |  | g200 |  |  |  | MembershipService.Queue | MFA, PeopleWrite, mod:office |
| POST | `/api/parishes/{parishId}/membership-requests` | Membership | user |  | g200 |  | yes |  | MembershipService.Request | self |
| GET | `/api/parishes/{parishId}/membership-requests/mine` | Membership | user |  | g200 |  |  |  | MembershipService.OwnRequests | self |
| POST | `/api/parishes/{parishId}/membership-requests/{requestId}/decision` | Membership | user |  | g200 |  | yes |  | MembershipService.Decide | MFA, PeopleWrite, mod:office, self |
| GET | `/api/parishes/{parishId}/membership-requests/{requestId}/notification-outcome` | Membership | user |  | g200 |  |  |  | MembershipService.MembershipNotificationOutcome | MFA, PeopleWrite, mod:office, self |
| POST | `/api/parishes/{parishId}/membership-requests/{requestId}/withdraw` | Membership | user |  | g200 |  | yes |  | MembershipService.WithdrawRequest | self |
| PUT | `/api/parishes/{parishId}/primary` | Membership | user |  | g200 |  | yes |  | MembershipService.SetPrimary | self |
| GET | `/api/parishes/{parishId}/profile-corrections` | Membership | user |  | g200 |  |  |  | MembershipService.Corrections | MFA, PeopleWrite, mod:office |
| POST | `/api/parishes/{parishId}/profile-corrections` | Membership | user |  | g200 |  | yes |  | MembershipService.ProposeCorrection | self |
| GET | `/api/parishes/{parishId}/profile-corrections/mine` | Membership | user |  | g200 |  |  |  | MembershipService.Corrections | MFA, PeopleWrite, mod:office |
| GET | `/api/parishes/{parishId}/profile-corrections/{correctionId}/notification-outcome` | Membership | user |  | g200 |  |  |  | MembershipService.CorrectionNotificationOutcome | MFA, PeopleWrite, mod:office, self |
| POST | `/api/parishes/{parishId}/profile-corrections/{correctionId}/review` | Membership | user |  | g200 |  | yes |  | MembershipService.ReviewCorrection | MFA, PeopleWrite, mod:office, self |
| POST | `/api/parishes/{parishId}/profile-corrections/{correctionId}/withdraw` | Membership | user |  | g200 |  | yes |  | MembershipService.WithdrawCorrection | self |
| GET | `/api/parishes/{parishId}/people` | People | user |  | g200 |  |  |  | PeopleService.List | PeopleRead, mod:office |
| POST | `/api/parishes/{parishId}/people` | People | user |  | g200 |  | yes |  | PeopleService.Create | PeopleWrite, mod:office, self |
| GET | `/api/parishes/{parishId}/people/{personId}` | People | user |  | g200 |  |  |  | PeopleService.Get | PeopleRead, mod:office |
| PUT | `/api/parishes/{parishId}/people/{personId}` | People | user |  | g200 |  | yes |  | PeopleService.Update | MFA, PeopleWrite, mod:office, self |
| POST | `/api/parishes/{parishId}/people/{personId}/archive` | People | user |  | g200 |  | yes |  | PeopleService.SetArchive | PeopleWrite, mod:office |
| POST | `/api/parishes/{parishId}/people/export` | PeopleDirectory | user |  | g200 |  | yes |  | PeopleDirectoryService.Export | ExportsManage, MFA, PeopleRead, mod:office, self |
| GET | `/api/parishes/{parishId}/people/export/preview` | PeopleDirectory | user |  | g200 |  |  |  | PeopleDirectoryService.PreviewExport | ExportsManage, MFA, PeopleRead, mod:office |
| GET | `/api/parishes/{parishId}/people/search` | PeopleDirectory | user |  | g200 |  |  |  | PeopleDirectoryService.Search | MFA, PeopleRead, mod:office |
| POST | `/api/parishes/{parishId}/people/imports` | PeopleImports | user |  | g200 |  | yes |  | PeopleImportService.Stage | ImportsManage, MFA, PeopleWrite, mod:office, self |
| GET | `/api/parishes/{parishId}/people/imports/{importId}` | PeopleImports | user |  | g200 |  |  |  | PeopleImportService.Get | ImportsManage, MFA, PeopleWrite, mod:office |
| POST | `/api/parishes/{parishId}/people/imports/{importId}/commit` | PeopleImports | user |  | g200 |  | yes |  | PeopleImportService.Commit | ImportsManage, MFA, PeopleWrite, mod:office, self |
| GET | `/api/parishes/{parishId}/data-closure-requests` | PersonData | user |  | g200 |  |  |  | PersonDataService.Queue | MFA, PeopleWrite, mod:office |
| POST | `/api/parishes/{parishId}/data-closure-requests/{requestId}/decision` | PersonData | user |  | g200 |  | yes |  | PersonDataService.Decide | MFA, PeopleWrite, mod:office, self |
| GET | `/api/parishes/{parishId}/data-closure-requests/{requestId}/preview` | PersonData | user |  | g200 |  |  |  | PersonDataService.Preview | MFA, PeopleWrite, mod:office |
| GET | `/api/parishes/{parishId}/me/data` | PersonData | user |  | g200 |  |  |  | PersonDataService.OwnData | not detected |
| GET | `/api/parishes/{parishId}/me/data-closure-requests` | PersonData | user |  | g200 |  |  |  | PersonDataService.OwnRequests | self |
| POST | `/api/parishes/{parishId}/me/data-closure-requests` | PersonData | user |  | g200 |  | yes |  | PersonDataService.Request | self |
| GET | `/api/parishes/{parishId}/consents` | PersonFacts | user |  | g200 |  |  |  | PersonFactsService.ParishConsents | MFA, PeopleRead, mod:office |
| POST | `/api/parishes/{parishId}/consents/{consentId}/withdraw` | PersonFacts | user |  | g200 |  | yes |  | PersonFactsService.WithdrawConsent | MFA, PeopleWrite, mod:office |
| GET | `/api/parishes/{parishId}/me/consents` | PersonFacts | user |  | g200 |  |  |  | PersonFactsService.OwnConsents | not detected |
| POST | `/api/parishes/{parishId}/me/consents` | PersonFacts | user |  | g200 |  | yes |  | PersonFactsService.RecordOwnConsent | self |
| POST | `/api/parishes/{parishId}/me/consents/{consentId}/withdraw` | PersonFacts | user |  | g200 |  | yes |  | PersonFactsService.WithdrawOwnConsent | not detected |
| GET | `/api/parishes/{parishId}/people/facts` | PersonFacts | user |  | g200 |  |  |  | PersonFactsService.ListFacts | MFA, PeopleRead, mod:office |
| GET | `/api/parishes/{parishId}/people/{personId}/consents` | PersonFacts | user |  | g200 |  |  |  | PersonFactsService.Consents | MFA, PeopleRead, mod:office |
| POST | `/api/parishes/{parishId}/people/{personId}/consents` | PersonFacts | user |  | g200 |  | yes |  | PersonFactsService.RecordConsent | MFA, PeopleWrite, mod:office, self |
| GET | `/api/parishes/{parishId}/people/{personId}/facts` | PersonFacts | user |  | g200 |  |  |  | PersonFactsService.GetFacts | MFA, PeopleRead, mod:office |
| PUT | `/api/parishes/{parishId}/people/{personId}/facts` | PersonFacts | user |  | g200 |  | yes |  | PersonFactsService.SaveFacts | MFA, PeopleWrite, mod:office, self |
| GET | `/api/parishes/{parishId}/people/{personId}/medical` | PersonFacts | user |  | g200 |  |  |  | PersonFactsService.GetMedical | MFA, PeopleMedicalManage, mod:office |
| PUT | `/api/parishes/{parishId}/people/{personId}/medical` | PersonFacts | user |  | g200 |  | yes |  | PersonFactsService.SaveMedical | MFA, PeopleMedicalManage, mod:office, self |
| POST | `/api/parishes/{parishId}/people/{personId}/invitations` | PersonInvitations | user |  | g200 |  | yes |  | PersonInvitationService.Create | MFA, PeopleWrite, mod:office, self |
| GET | `/api/parishes/{parishId}/person-invitations` | PersonInvitations | user |  | g200 |  |  |  | PersonInvitationService.List | MFA, PeopleWrite, mod:office |
| POST | `/api/parishes/{parishId}/person-invitations/{invitationId}/accept` | PersonInvitations | user |  | g200 |  | yes |  | PersonInvitationService.Accept | self, tracking-token |
| GET | `/api/parishes/{parishId}/person-invitations/{invitationId}/notification-outcome` | PersonInvitations | user |  | g200 |  |  |  | PersonInvitationService.NotificationOutcome | MFA, PeopleWrite, mod:office |
| GET | `/api/parishes/{parishId}/person-invitations/{invitationId}/preview` | PersonInvitations | user |  | g200 |  |  |  | PersonInvitationService.Preview | tracking-token |
| POST | `/api/parishes/{parishId}/person-invitations/{invitationId}/revoke` | PersonInvitations | user |  | g200 |  | yes |  | PersonInvitationService.Revoke | MFA, PeopleWrite, mod:office |

#### PersonalWorkspace (10)

| Method | Path | Controller | Auth | Rec | Rate | TS | CSRF | Cache | Service call | Checks found (heuristic) |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/me/capacities` | CombinedHome | user |  | g200 |  |  |  | CombinedHomeService.Capacities | MinistriesManage, self, verified |
| GET | `/api/me/home` | CombinedHome | user |  | g200 |  |  |  | CombinedHomeService.Home | MFA, MinistriesManage, self, verified |
| GET | `/api/me/notification-topics` | MemberResources | user |  | g200 |  |  |  | NotificationTopicCatalog.List | not detected |
| GET | `/api/parishes/{parishId}/me/ministry-resources` | MemberResources | user |  | g200 |  |  |  | MemberMinistryResourceService.List | member |
| GET | `/api/me/personal-workspace` | PersonalWorkspace | user |  | g200 |  |  |  | PersonalWorkspaceService.List | not detected |
| POST | `/api/me/personal-workspace` | PersonalWorkspace | user |  | g200 |  | yes |  | PersonalWorkspaceService.Save | self |
| GET | `/api/me/personal-workspace/{itemId}` | PersonalWorkspace | user |  | g200 |  |  |  | PersonalWorkspaceService.Get | not detected |
| PUT | `/api/me/personal-workspace/{itemId}` | PersonalWorkspace | user |  | g200 |  | yes |  | PersonalWorkspaceService.Save | self |
| POST | `/api/me/personal-workspace/{itemId}/actions` | PersonalWorkspace | user |  | g200 |  | yes |  | PersonalWorkspaceService.Act | self |
| GET | `/api/me/personal-workspace/{itemId}/history` | PersonalWorkspace | user |  | g200 |  |  |  | PersonalWorkspaceService.History | not detected |

#### Publishing (22)

| Method | Path | Controller | Auth | Rec | Rate | TS | CSRF | Cache | Service call | Checks found (heuristic) |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/administration/homepage/draft` | Homepage | user |  | g200 |  |  |  | HomepageService.GetDraft | MFA, operator+MFA |
| PUT | `/api/administration/homepage/draft` | Homepage | user |  | g200 |  | yes |  | HomepageService.SaveDraft | MFA, operator+MFA, self |
| POST | `/api/administration/homepage/publish` | Homepage | user |  | g200 |  | yes |  | HomepageService.Publish | MFA, operator+MFA, self |
| GET | `/api/administration/homepage/revisions` | Homepage | user |  | g200 |  |  |  | HomepageService.History | MFA, operator+MFA |
| GET | `/api/public/homepage` | Homepage | anon |  | g200 |  |  | 300s | HomepageService.Public | not detected |
| GET | `/api/parishes/{parishId}/profile` | ParishProfile | user |  | g200 |  |  |  | ParishProfileService.Get | MFA, PublishingManage, mod:core |
| PUT | `/api/parishes/{parishId}/profile` | ParishProfile | user |  | g200 |  | yes |  | ParishProfileService.Save | MFA, PublishingManage, mod:core, self |
| POST | `/api/parishes/{parishId}/profile/actions` | ParishProfile | user |  | g200 |  | yes |  | ParishProfileService.Act | MFA, PublishingManage, mod:core, self |
| POST | `/api/parishes/{parishId}/profile/photos` | ParishProfile | user |  | g200 |  | yes |  | ParishProfileService.UploadPhoto | MFA, PublishingManage, mod:core, self |
| GET | `/api/parishes/{parishId}/profile/photos/{photoId}` | ParishProfile | user |  | g200 |  |  |  | ParishProfileService.DownloadPhoto | MFA, PublishingManage, mod:core |
| POST | `/api/parishes/{parishId}/profile/photos/{photoId}/actions` | ParishProfile | user |  | g200 |  | yes |  | ParishProfileService.PhotoAct | MFA, PublishingManage, mod:core, self |
| GET | `/api/public/app/manifest` | PublicApp | anon |  | g200 |  |  | 3600s | PublicAppService.Manifest | not detected |
| GET | `/api/public/app/offline-policy` | PublicApp | anon |  | g200 |  |  | 3600s | PublicAppService.OfflinePolicy | not detected |
| GET | `/api/public/parishes/{parishId}/calendar.ics` | PublicCalendarFeed | anon |  | auth20 |  |  |  | ParishCalendarFeedService.Feed | not detected |
| GET | `/api/public/parishes` | PublicDirectory | anon |  | g200 |  |  | 300s | PublicDirectoryService.Browse | not detected |
| POST | `/api/public/parishes/nearby` | PublicDirectory | anon |  | g200 |  | yes |  | PublicDirectoryService.Nearby | not detected |
| GET | `/api/public/parishes/{parishId}/profile` | PublicParishProfile | anon |  | g200 |  |  | 300s | ParishProfileService.Public | not detected |
| GET | `/api/public/parishes/{parishId}/profile/photos/{photoId}` | PublicParishProfile | anon |  | g200 |  |  |  | ParishProfileService.PublicPhoto | not detected |
| GET | `/api/parishes/{parishId}/website/sections` | Website | user |  | g200 |  |  |  | WebsiteService.Sections | MFA, PublishingManage, mod:core |
| PUT | `/api/parishes/{parishId}/website/sections/{key}/draft` | Website | user |  | g200 |  | yes |  | WebsiteService.SaveDraft | MFA, PublishingManage, mod:core, self |
| POST | `/api/parishes/{parishId}/website/sections/{key}/revisions/{revisionId}/actions` | Website | user |  | g200 |  | yes |  | WebsiteService.Act | MFA, PublishingManage, clergy, mod:core, self |
| GET | `/api/public/parishes/{parishId}/website` | Website | anon |  | g200 |  |  | 300s | WebsiteService.Public | not detected |

#### Reporting (11)

| Method | Path | Controller | Auth | Rec | Rate | TS | CSRF | Cache | Service call | Checks found (heuristic) |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/archdioceses/{archdioceseId}/overview` | BishopOverview | user |  | g200 |  |  |  | BishopOverviewService.Overview | bishop |
| GET | `/api/archdioceses/{archdioceseId}/overview/map` | BishopOverview | user |  | g200 |  |  |  | BishopOverviewService.Map | bishop |
| GET | `/api/administration/insights` | Insights | user |  | g200 |  |  |  | SiteInsightsService.Insights | MFA, operator+MFA |
| GET | `/api/report-deliveries` | ReportSchedules | user |  | g200 |  |  |  | ReportScheduleService.Deliveries | MFA |
| GET | `/api/report-deliveries/{id}` | ReportSchedules | user |  | g200 |  |  |  | ReportScheduleService.Delivery | MFA, self |
| GET | `/api/report-schedules` | ReportSchedules | user |  | g200 |  |  |  | ReportScheduleService.List | MFA |
| POST | `/api/report-schedules` | ReportSchedules | user |  | g200 |  | yes |  | ReportScheduleService.Create | MFA, self |
| GET | `/api/report-schedules/{id}` | ReportSchedules | user |  | g200 |  |  |  | ReportScheduleService.Get | MFA, self |
| POST | `/api/report-schedules/{id}/actions` | ReportSchedules | user |  | g200 |  | yes |  | ReportScheduleService.Act | MFA, self |
| POST | `/api/public/site-metrics` | SiteMetrics | anon |  | auth20 |  | yes |  | SiteInsightsService.Record | not detected |
| GET | `/api/parishes/{parishId}/work-overview` | WorkOverview | user |  | g200 |  |  |  | WorkOverviewService.Overview | MFA |

#### Requests (21)

| Method | Path | Controller | Auth | Rec | Rate | TS | CSRF | Cache | Service call | Checks found (heuristic) |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/me/request-claims` | RequestClaims | user |  | g200 |  |  |  | RequestClaimService.List | self |
| POST | `/api/parishes/{parishId}/requests/{requestId}/records` | RequestRecords | user |  | g200 |  | yes |  | RequestRecordService.Open | MFA, RequestsManage, mod:requests |
| GET | `/api/parishes/{parishId}/requests` | Requests | user |  | g200 |  |  |  | RequestService.Queue | MFA, RequestsManage, mod:requests |
| POST | `/api/parishes/{parishId}/requests` | Requests | user |  | g200 |  | yes |  | RequestService.Submit | MFA, RequestsManage, mod:requests, self |
| POST | `/api/parishes/{parishId}/requests/handover` | Requests | user |  | g200 |  | yes |  | RequestService.Handover | AccessManage, MFA, RequestsManage, self |
| GET | `/api/parishes/{parishId}/requests/mine` | Requests | user |  | g200 |  |  |  | RequestService.Own | self |
| GET | `/api/parishes/{parishId}/requests/{requestId}` | Requests | user |  | g200 |  |  |  | RequestService.Get | MFA, RequestsManage, mod:requests, self |
| POST | `/api/parishes/{parishId}/requests/{requestId}/actions` | Requests | user |  | g200 |  | yes |  | RequestService.Act | MFA, RequestsManage, clergy, mod:requests, self, verified |
| POST | `/api/parishes/{parishId}/requests/{requestId}/association` | Requests | user |  | g200 |  | yes |  | RequestService.DecideAssociation | MFA, RequestsManage, mod:requests, self |
| PUT | `/api/parishes/{parishId}/requests/{requestId}/checklist` | Requests | user |  | g200 |  | yes |  | RequestService.SetChecklist | MFA, RequestsManage, mod:requests, self |
| POST | `/api/parishes/{parishId}/requests/{requestId}/claim` | Requests | user |  | g200 |  | yes |  | RequestService.ClaimGuest | self, tracking-token |
| GET | `/api/parishes/{parishId}/requests/{requestId}/history` | Requests | user |  | g200 |  |  |  | RequestService.History | MFA, RequestsManage, mod:requests |
| GET | `/api/parishes/{parishId}/requests/{requestId}/messages` | Requests | user |  | g200 |  |  |  | RequestService.Messages | MFA, RequestsManage, mod:requests, self |
| POST | `/api/parishes/{parishId}/requests/{requestId}/messages` | Requests | user |  | g200 |  | yes |  | RequestService.PostMessage | MFA, RequestsManage, mod:requests, self |
| GET | `/api/parishes/{parishId}/requests/{requestId}/notification-outcome` | Requests | user |  | g200 |  |  |  | RequestService.NotificationOutcome | self |
| POST | `/api/parishes/{parishId}/requests/{requestId}/rotate-tracking` | Requests | user |  | g200 |  | yes |  | RequestService.RotateTracking | MFA, RequestsManage, mod:requests, self |
| POST | `/api/public/parishes/{parishId}/requests` | Requests | anon |  | auth20 | yes | yes |  | RequestService.GuestSubmit | mod:requests |
| GET | `/api/public/parishes/{parishId}/requests/{requestId}` | Requests | anon |  | auth20 |  |  |  | RequestService.GuestGet | tracking-token |
| POST | `/api/public/parishes/{parishId}/requests/{requestId}/actions` | Requests | anon |  | auth20 |  | yes |  | RequestService.GuestAct | self, tracking-token |
| GET | `/api/public/parishes/{parishId}/requests/{requestId}/messages` | Requests | anon |  | auth20 |  |  |  | RequestService.Messages | MFA, RequestsManage, mod:requests, self, tracking-token |
| POST | `/api/public/parishes/{parishId}/requests/{requestId}/messages` | Requests | anon |  | auth20 |  | yes |  | RequestService.GuestMessage | tracking-token |

#### Sacraments (27)

| Method | Path | Controller | Auth | Rec | Rate | TS | CSRF | Cache | Service call | Checks found (heuristic) |
|---|---|---|---|---|---|---|---|---|---|---|
| PUT | `/api/archdioceses/{archdioceseId}/certificate-policy` | Certificates | user |  | g200 |  | yes |  | CertificateService.SetPolicy | MFA, bishop, self |
| GET | `/api/parishes/{parishId}/certificates` | Certificates | user |  | g200 |  |  |  | CertificateService.List | MFA, SacramentsRecord, bishop, clergy, self |
| POST | `/api/parishes/{parishId}/certificates` | Certificates | user |  | g200 |  | yes |  | CertificateService.Create | MFA, SacramentsRecord, mod:sacraments, self |
| GET | `/api/parishes/{parishId}/certificates/{certificateId}` | Certificates | user |  | g200 |  |  |  | CertificateService.Get | MFA, SacramentsRecord, bishop, clergy, self |
| POST | `/api/parishes/{parishId}/certificates/{certificateId}/actions` | Certificates | user |  | g200 |  | yes |  | CertificateService.Act | DocumentsRelease, MFA, SacramentsRecord, bishop, clergy, mod:sacraments, self |
| GET | `/api/parishes/{parishId}/certificates/{certificateId}/notification-outcome` | Certificates | user |  | g200 |  |  |  | CertificateService.NotificationOutcome | MFA, SacramentsRecord, bishop, clergy, self |
| GET | `/api/parishes/{parishId}/certificates/{certificateId}/signature-image` | Certificates | user |  | g200 |  |  |  | CertificateService.SignatureImage | MFA, SacramentsRecord, bishop, clergy, self |
| GET | `/api/parishes/{parishId}/clergy-signature-image` | ClergySignatureImages | user |  | g200 |  |  |  | ClergySignatureImageService.Mine | MFA, clergy, mod:sacraments, self |
| POST | `/api/parishes/{parishId}/clergy-signature-image` | ClergySignatureImages | user |  | g200 |  | yes |  | ClergySignatureImageService.Upload | MFA, clergy, mod:sacraments, self |
| GET | `/api/parishes/{parishId}/clergy-signature-image/content` | ClergySignatureImages | user |  | g200 |  |  |  | ClergySignatureImageService.MyContent | MFA, clergy, mod:sacraments, self |
| POST | `/api/parishes/{parishId}/clergy-signature-image/remove` | ClergySignatureImages | user |  | g200 |  | yes |  | ClergySignatureImageService.Remove | MFA, clergy, mod:sacraments, self |
| GET | `/api/parishes/{parishId}/certificates/{certificateId}/sheet` | DocumentSheets | user |  | g200 |  |  |  | DocumentSheetService.Render | not detected |
| GET | `/api/parishes/{parishId}/document-templates` | DocumentSheets | user |  | g200 |  |  |  | DocumentSheetService.Templates | MFA, clergy, self |
| PUT | `/api/parishes/{parishId}/document-templates` | DocumentSheets | user |  | g200 |  | yes |  | DocumentSheetService.Propose | MFA, clergy, self |
| POST | `/api/parishes/{parishId}/document-templates/{kind}/{language}/approve` | DocumentSheets | user |  | g200 |  | yes |  | DocumentSheetService.Approve | MFA, bishop, self |
| GET | `/api/parishes/{parishId}/sacraments` | Sacraments | user |  | g200 |  |  |  | SacramentService.Search | MFA, SacramentsRecord, clergy, mod:sacraments, self |
| POST | `/api/parishes/{parishId}/sacraments` | Sacraments | user |  | g200 |  | yes |  | SacramentService.Create | MFA, SacramentsRecord, mod:sacraments, self |
| GET | `/api/parishes/{parishId}/sacraments/anniversaries` | Sacraments | user |  | g200 |  |  |  | SacramentService.Anniversaries | MFA, SacramentsRecord, clergy, mod:sacraments, self |
| GET | `/api/parishes/{parishId}/sacraments/anniversaries/mine` | Sacraments | user |  | g200 |  |  |  | SacramentService.MyAnniversaries | not detected |
| GET | `/api/parishes/{parishId}/sacraments/corrections` | Sacraments | user |  | g200 |  |  |  | SacramentService.PendingCorrections | MFA, SacramentsRecord, clergy, mod:sacraments, self |
| POST | `/api/parishes/{parishId}/sacraments/corrections/{correctionId}/decision` | Sacraments | user |  | g200 |  | yes |  | SacramentService.DecideCorrection | MFA, clergy, mod:sacraments, self |
| PUT | `/api/parishes/{parishId}/sacraments/numbering` | Sacraments | user |  | g200 |  | yes |  | SacramentService.SetPolicy | MFA, clergy, mod:sacraments, self |
| GET | `/api/parishes/{parishId}/sacraments/requirements` | Sacraments | user |  | g200 |  |  |  | SacramentService.RequirementSets | MFA, SacramentsRecord, clergy, mod:sacraments, self |
| PUT | `/api/parishes/{parishId}/sacraments/requirements` | Sacraments | user |  | g200 |  | yes |  | SacramentService.SaveRequirementSet | MFA, clergy, mod:sacraments, self |
| GET | `/api/parishes/{parishId}/sacraments/{recordId}` | Sacraments | user |  | g200 |  |  |  | SacramentService.Get | MFA, SacramentsRecord, clergy, mod:sacraments, self |
| POST | `/api/parishes/{parishId}/sacraments/{recordId}/actions` | Sacraments | user |  | g200 |  | yes |  | SacramentService.Act | MFA, SacramentsRecord, clergy, mod:sacraments, self, verified |
| POST | `/api/parishes/{parishId}/sacraments/{recordId}/corrections` | Sacraments | user |  | g200 |  | yes |  | SacramentService.ProposeCorrection | MFA, SacramentsRecord, mod:sacraments, self |

#### Scheduling (98)

| Method | Path | Controller | Auth | Rec | Rate | TS | CSRF | Cache | Service call | Checks found (heuristic) |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/parishes/{parishId}/calendar/events` | Calendar | user |  | g200 |  |  |  | CalendarService.List | ScheduleRead, mod:core, self |
| POST | `/api/parishes/{parishId}/calendar/events` | Calendar | user |  | g200 |  | yes |  | CalendarService.Save | ScheduleManage, mod:core, self |
| GET | `/api/parishes/{parishId}/calendar/events/{eventId}` | Calendar | user |  | g200 |  |  |  | CalendarService.Get | ScheduleRead, mod:core, self |
| PUT | `/api/parishes/{parishId}/calendar/events/{eventId}` | Calendar | user |  | g200 |  | yes |  | CalendarService.Save | ScheduleManage, mod:core, self |
| POST | `/api/parishes/{parishId}/calendar/events/{eventId}/actions` | Calendar | user |  | g200 |  | yes |  | CalendarService.Act | ScheduleManage, SchedulePublish, mod:core, self |
| POST | `/api/parishes/{parishId}/calendar/series` | Calendar | user |  | g200 |  | yes |  | CalendarService.CreateSeries | ScheduleManage, mod:core, self |
| GET | `/api/parishes/{parishId}/equipment` | Equipment | user |  | g200 |  |  |  | EquipmentService.List | FacilitiesManage, MFA, mod:facilities |
| POST | `/api/parishes/{parishId}/equipment` | Equipment | user |  | g200 |  | yes |  | EquipmentService.Save | FacilitiesManage, MFA, mod:facilities, self |
| POST | `/api/parishes/{parishId}/equipment-bookings/{bookingId}/actions` | Equipment | user |  | g200 |  | yes |  | EquipmentService.Act | FacilitiesManage, MFA, mod:facilities, self |
| PUT | `/api/parishes/{parishId}/equipment/{equipmentId}` | Equipment | user |  | g200 |  | yes |  | EquipmentService.Save | FacilitiesManage, MFA, mod:facilities, self |
| GET | `/api/parishes/{parishId}/equipment/{equipmentId}/bookings` | Equipment | user |  | g200 |  |  |  | EquipmentService.Bookings | FacilitiesManage, MFA, mod:facilities |
| POST | `/api/parishes/{parishId}/equipment/{equipmentId}/bookings` | Equipment | user |  | g200 |  | yes |  | EquipmentService.Book | FacilitiesManage, MFA, mod:facilities, self |
| GET | `/api/parishes/{parishId}/facility-issues` | Equipment | user |  | g200 |  |  |  | FacilityIssueService.List | FacilitiesManage, MFA, mod:facilities |
| POST | `/api/parishes/{parishId}/facility-issues` | Equipment | user |  | g200 |  | yes |  | FacilityIssueService.Report | FacilitiesManage, MFA, ScheduleRead, mod:facilities, self |
| GET | `/api/parishes/{parishId}/facility-issues/{issueId}` | Equipment | user |  | g200 |  |  |  | FacilityIssueService.Get | FacilitiesManage, MFA, mod:facilities |
| POST | `/api/parishes/{parishId}/facility-issues/{issueId}/actions` | Equipment | user |  | g200 |  | yes |  | FacilityIssueService.Act | FacilitiesManage, MFA, mod:facilities, self, verified |
| GET | `/api/parishes/{parishId}/calendar/events/{eventId}/evacuations` | EventRegistrationOptions | user |  | g200 |  |  |  | EvacuationService.List | not detected |
| POST | `/api/parishes/{parishId}/calendar/events/{eventId}/evacuations` | EventRegistrationOptions | user |  | g200 |  | yes |  | EvacuationService.Start | self |
| GET | `/api/parishes/{parishId}/calendar/events/{eventId}/evacuations/{evacuationId}` | EventRegistrationOptions | user |  | g200 |  |  |  | EvacuationService.Get | not detected |
| POST | `/api/parishes/{parishId}/calendar/events/{eventId}/evacuations/{evacuationId}/actions` | EventRegistrationOptions | user |  | g200 |  | yes |  | EvacuationService.Act | self |
| POST | `/api/parishes/{parishId}/calendar/events/{eventId}/registration/terms` | EventRegistrationOptions | user |  | g200 |  | yes |  | RegistrationTermsService.ReviseTerms | RegistrationsManage, self, verified |
| POST | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/household` | EventRegistrationOptions | user |  | g200 |  | yes |  | RegistrationTermsService.RegisterHousehold | RegistrationsManage, self |
| POST | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/{registrationId}/discount` | EventRegistrationOptions | user |  | g200 |  | yes |  | RegistrationService.StaffView, RegistrationTermsService.ApplyDiscount | RegistrationsManage |
| POST | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/{registrationId}/pickup-code` | EventRegistrationOptions | user |  | g200 |  | yes |  | RegistrationTermsService.PickupCode | RegistrationsManage |
| GET | `/api/parishes/{parishId}/calendar/events/{eventId}/present` | EventRegistrations | user |  | g200 |  |  |  | RegistrationService.Present | CheckIn, MFA, mod:core, self |
| GET | `/api/parishes/{parishId}/calendar/events/{eventId}/registration` | EventRegistrations | user |  | g200 |  |  |  | RegistrationService.Policy | MFA, RegistrationsManage, mod:core |
| POST | `/api/parishes/{parishId}/calendar/events/{eventId}/registration` | EventRegistrations | user |  | g200 |  | yes |  | RegistrationService.Configure | MFA, RegistrationsManage, mod:core, self, verified |
| POST | `/api/parishes/{parishId}/calendar/events/{eventId}/registration/actions` | EventRegistrations | user |  | g200 |  | yes |  | RegistrationService.PolicyAction | MFA, RegistrationsManage, mod:core |
| GET | `/api/parishes/{parishId}/calendar/events/{eventId}/registration/applicant-form` | EventRegistrations | user |  | g200 |  |  |  | RegistrationService.ApplicantForm | mod:core |
| POST | `/api/parishes/{parishId}/calendar/events/{eventId}/registration/forms` | EventRegistrations | user |  | g200 |  | yes |  | RegistrationService.ReviseForm | MFA, RegistrationsManage, mod:core, self |
| GET | `/api/parishes/{parishId}/calendar/events/{eventId}/registration/forms/{formId}` | EventRegistrations | user |  | g200 |  |  |  | RegistrationService.Form | MFA, RegistrationsManage, mod:core |
| GET | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations` | EventRegistrations | user |  | g200 |  |  |  | RegistrationService.List, RegistrationService.StaffView | MFA, RegistrationsManage, mod:core |
| POST | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations` | EventRegistrations | user |  | g200 |  | yes |  | RegistrationService.Register, RegistrationService.StaffView | MFA, RegistrationsManage, mod:core, self |
| GET | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/cashier` | EventRegistrations | user |  | g200 |  |  |  | RegistrationService.CashierList | FinanceEnter, MFA, mod:core, mod:finance |
| GET | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/door` | EventRegistrations | user |  | g200 |  |  |  | RegistrationService.DoorList | CheckIn, MFA, mod:core, self |
| GET | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/mine` | EventRegistrations | user |  | g200 |  |  |  | RegistrationService.Own | not detected |
| POST | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/mine` | EventRegistrations | user |  | g200 |  | yes |  | RegistrationService.RegisterOwn | mod:core, self |
| POST | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/mine/cancel` | EventRegistrations | user |  | g200 |  | yes |  | RegistrationService.CancelOwn | not detected |
| GET | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/mine/notification-outcome` | EventRegistrations | user |  | g200 |  |  |  | RegistrationService.Own | not detected |
| GET | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/{registrationId}` | EventRegistrations | user |  | g200 |  |  |  | RegistrationService.Get, RegistrationService.StaffView | MFA, RegistrationsManage, mod:core |
| POST | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/{registrationId}/actions` | EventRegistrations | user |  | g200 |  | yes |  | RegistrationService.Act, RegistrationService.StaffView | MFA, RegistrationsManage, mod:core |
| POST | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/{registrationId}/amend` | EventRegistrations | user |  | g200 |  | yes |  | RegistrationService.Amend, RegistrationService.StaffView | MFA, RegistrationsManage, mod:core |
| GET | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/{registrationId}/cashier` | EventRegistrations | user |  | g200 |  |  |  | RegistrationService.CashierRegistration | FinanceEnter, MFA, mod:core, mod:finance |
| GET | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/{registrationId}/door` | EventRegistrations | user |  | g200 |  |  |  | RegistrationService.DoorRegistration | CheckIn, MFA, mod:core, self |
| GET | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/{registrationId}/movements` | EventRegistrations | user |  | g200 |  |  |  | RegistrationService.Movements | FinanceRead, MFA, mod:core, mod:finance |
| GET | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/{registrationId}/notification-outcome` | EventRegistrations | user |  | g200 |  |  |  | RegistrationService.NotificationOutcome | MFA, RegistrationsManage, mod:core |
| POST | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/{registrationId}/presence` | EventRegistrations | user |  | g200 |  | yes |  | RegistrationService.Presence | CheckIn, MFA, mod:core, self |
| POST | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/{registrationId}/receipts` | EventRegistrations | user |  | g200 |  | yes |  | RegistrationService.Receipt | FinanceEnter, MFA, mod:core, mod:finance, self |
| GET | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/{registrationId}/refunds` | EventRegistrations | user |  | g200 |  |  |  | RegistrationService.Refunds | FinanceRead, MFA, mod:core, mod:finance |
| POST | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/{registrationId}/refunds` | EventRegistrations | user |  | g200 |  | yes |  | RegistrationService.RequestRefund | FinanceEnter, MFA, mod:core, mod:finance, self |
| POST | `/api/parishes/{parishId}/calendar/events/{eventId}/registrations/{registrationId}/refunds/{refundId}/actions` | EventRegistrations | user |  | g200 |  | yes |  | RegistrationService.RefundAction | FinanceApprove, FinanceEnter, MFA, mod:core, mod:finance, self |
| GET | `/api/parishes/{parishId}/calendar/templates` | EventTemplates | user |  | g200 |  |  |  | EventTemplateService.List | ScheduleRead, mod:core |
| POST | `/api/parishes/{parishId}/calendar/templates` | EventTemplates | user |  | g200 |  | yes |  | EventTemplateService.Save | ScheduleManage, ScheduleRead, mod:core, self |
| GET | `/api/parishes/{parishId}/calendar/templates/{templateId}` | EventTemplates | user |  | g200 |  |  |  | EventTemplateService.Get | ScheduleRead, mod:core |
| PUT | `/api/parishes/{parishId}/calendar/templates/{templateId}` | EventTemplates | user |  | g200 |  | yes |  | EventTemplateService.Save | ScheduleManage, ScheduleRead, mod:core, self |
| POST | `/api/parishes/{parishId}/calendar/templates/{templateId}/actions` | EventTemplates | user |  | g200 |  | yes |  | EventTemplateService.Act | ScheduleManage, ScheduleRead, mod:core, self |
| GET | `/api/parishes/{parishId}/facilities` | Facilities | user |  | g200 |  |  |  | FacilityService.List | ScheduleRead, mod:facilities |
| POST | `/api/parishes/{parishId}/facilities` | Facilities | user |  | g200 |  | yes |  | FacilityService.Save | FacilitiesManage, mod:facilities |
| GET | `/api/parishes/{parishId}/facilities/{facilityId}` | Facilities | user |  | g200 |  |  |  | FacilityService.Get | ScheduleRead, mod:facilities |
| PUT | `/api/parishes/{parishId}/facilities/{facilityId}` | Facilities | user |  | g200 |  | yes |  | FacilityService.Save | FacilitiesManage, mod:facilities |
| GET | `/api/parishes/{parishId}/facilities/{facilityId}/availability` | Facilities | user |  | g200 |  |  |  | FacilityService.Availability | ScheduleRead, mod:facilities |
| POST | `/api/parishes/{parishId}/facilities/{facilityId}/status` | Facilities | user |  | g200 |  | yes |  | FacilityService.SetStatus | FacilitiesManage, mod:facilities |
| GET | `/api/archdioceses/{archdioceseId}/liturgical-calendars` | LiturgicalCalendar | user |  | g200 |  |  |  | LiturgicalCalendarService.List | bishop |
| GET | `/api/archdioceses/{archdioceseId}/liturgical-calendars/{calendarId}` | LiturgicalCalendar | user |  | g200 |  |  |  | LiturgicalCalendarService.Get | bishop |
| PUT | `/api/archdioceses/{archdioceseId}/liturgical-calendars/{calendarId}` | LiturgicalCalendar | user |  | g200 |  | yes |  | LiturgicalCalendarService.Save | bishop, self |
| POST | `/api/archdioceses/{archdioceseId}/liturgical-calendars/{calendarId}/actions` | LiturgicalCalendar | user |  | g200 |  | yes |  | LiturgicalCalendarService.Act | bishop, self |
| GET | `/api/parishes/{parishId}/liturgical-exceptions` | LiturgicalExceptions | user |  | g200 |  |  |  | LiturgicalCalendarService.Exceptions | MFA, SchedulePublish, clergy, self |
| POST | `/api/parishes/{parishId}/liturgical-exceptions` | LiturgicalExceptions | user |  | g200 |  | yes |  | LiturgicalCalendarService.RecordException | MFA, SchedulePublish, clergy, self |
| POST | `/api/parishes/{parishId}/liturgical-exceptions/{exceptionId}/withdraw` | LiturgicalExceptions | user |  | g200 |  | yes |  | LiturgicalCalendarService.WithdrawException | MFA, SchedulePublish, clergy, self |
| GET | `/api/parishes/{parishId}/maintenance-blocks` | Maintenance | user |  | g200 |  |  |  | MaintenanceService.List | ScheduleRead, mod:facilities |
| POST | `/api/parishes/{parishId}/maintenance-blocks` | Maintenance | user |  | g200 |  | yes |  | MaintenanceService.Schedule | FacilitiesManage, mod:facilities, self |
| GET | `/api/parishes/{parishId}/maintenance-blocks/{blockId}` | Maintenance | user |  | g200 |  |  |  | MaintenanceService.Get | ScheduleRead, mod:facilities |
| POST | `/api/parishes/{parishId}/maintenance-blocks/{blockId}/actions` | Maintenance | user |  | g200 |  | yes |  | MaintenanceService.Act | FacilitiesManage, mod:facilities, self |
| GET | `/api/public/parishes/{parishId}/calendar` | PublicCalendar | anon |  | g200 |  |  |  | CalendarService.Public | not detected |
| GET | `/api/public/parishes/{parishId}/liturgical-calendar` | PublicLiturgicalCalendar | anon |  | g200 |  |  | 300s | LiturgicalCalendarService.Public | not detected |
| GET | `/api/parishes/{parishId}/renters` | Rentals | user |  | g200 |  |  |  | RentalService.Renters | FacilitiesManage, MFA, mod:facilities |
| POST | `/api/parishes/{parishId}/renters` | Rentals | user |  | g200 |  | yes |  | RentalService.CreateRenter | FacilitiesManage, MFA, mod:facilities, self |
| GET | `/api/parishes/{parishId}/reservations/{reservationId}/rental` | Rentals | user |  | g200 |  |  |  | RentalService.Get | FacilitiesManage, MFA, mod:facilities |
| PUT | `/api/parishes/{parishId}/reservations/{reservationId}/rental` | Rentals | user |  | g200 |  | yes |  | RentalService.Propose | FacilitiesManage, MFA, mod:facilities, self |
| POST | `/api/parishes/{parishId}/reservations/{reservationId}/rental/actions` | Rentals | user |  | g200 |  | yes |  | RentalService.Act | FacilitiesManage, FinanceApprove, FinancePost, MFA, mod:facilities, self |
| GET | `/api/parishes/{parishId}/reservations` | Reservations | user |  | g200 |  |  |  | ReservationService.List | FacilitiesManage, mod:facilities, self |
| POST | `/api/parishes/{parishId}/reservations` | Reservations | user |  | g200 |  | yes |  | ReservationService.Request | FacilitiesManage, mod:facilities, self |
| GET | `/api/parishes/{parishId}/reservations/{reservationId}` | Reservations | user |  | g200 |  |  |  | ReservationService.Get | FacilitiesManage, mod:facilities, self |
| POST | `/api/parishes/{parishId}/reservations/{reservationId}/actions` | Reservations | user |  | g200 |  | yes |  | ReservationService.Act | FacilitiesManage, mod:facilities, self |
| PUT | `/api/parishes/{parishId}/reservations/{reservationId}/details` | Reservations | user |  | g200 |  | yes |  | ReservationService.Details | FacilitiesManage, mod:facilities, self |
| GET | `/api/me/schedule` | Schedules | user |  | g200 |  |  |  | ScheduleService.Mine | self |
| GET | `/api/parishes/{parishId}/clergy/schedule` | Schedules | user |  | g200 |  |  |  | ScheduleService.Priest, ScheduleService.ToICalendar | MFA, clergy, self |
| GET | `/api/parishes/{parishId}/music` | ServicePlans | user |  | g200 |  |  |  | MusicLibraryService.Search | MFA, ScheduleRead, mod:core |
| POST | `/api/parishes/{parishId}/music` | ServicePlans | user |  | g200 |  | yes |  | MusicLibraryService.Publish | MFA, MusicManage, mod:core, self |
| GET | `/api/parishes/{parishId}/music/{musicId}` | ServicePlans | user |  | g200 |  |  |  | MusicLibraryService.Get | MFA, ScheduleRead, mod:core |
| POST | `/api/parishes/{parishId}/music/{musicId}/withdraw` | ServicePlans | user |  | g200 |  | yes |  | MusicLibraryService.Withdraw | MFA, MusicManage, mod:core |
| GET | `/api/parishes/{parishId}/plans` | ServicePlans | user |  | g200 |  |  |  | ServicePlanService.List | MFA, ScheduleRead, clergy, mod:core |
| POST | `/api/parishes/{parishId}/plans` | ServicePlans | user |  | g200 |  | yes |  | ServicePlanService.Save | MFA, ScheduleManage, ScheduleRead, mod:core, self, verified |
| GET | `/api/parishes/{parishId}/plans/celebrants` | ServicePlans | user |  | g200 |  |  |  | ServicePlanService.Celebrants | MFA, ScheduleManage, clergy, mod:core |
| GET | `/api/parishes/{parishId}/plans/{planId}` | ServicePlans | user |  | g200 |  |  |  | ServicePlanService.Get | MFA, ScheduleRead, clergy, mod:core |
| PUT | `/api/parishes/{parishId}/plans/{planId}` | ServicePlans | user |  | g200 |  | yes |  | ServicePlanService.Save | MFA, ScheduleManage, ScheduleRead, mod:core, self, verified |
| POST | `/api/parishes/{parishId}/plans/{planId}/actions` | ServicePlans | user |  | g200 |  | yes |  | ServicePlanService.Act | MFA, ScheduleManage, ScheduleRead, clergy, mod:core, self |
| GET | `/api/parishes/{parishId}/plans/{planId}/outputs/{audience}` | ServicePlans | user |  | g200 |  |  |  | ServicePlanService.Output | MFA, ScheduleRead, mod:core |

#### Workflows (14)

| Method | Path | Controller | Auth | Rec | Rate | TS | CSRF | Cache | Service call | Checks found (heuristic) |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/parishes/{parishId}/workflows` | WorkflowDefinitions | user |  | g200 |  |  |  | WorkflowDefinitionService.List | WorkflowsManage |
| POST | `/api/parishes/{parishId}/workflows` | WorkflowDefinitions | user |  | g200 |  | yes |  | WorkflowDefinitionService.Create | WorkflowsManage, self |
| GET | `/api/parishes/{parishId}/workflows/{definitionId}` | WorkflowDefinitions | user |  | g200 |  |  |  | WorkflowDefinitionService.Get | WorkflowsManage |
| PUT | `/api/parishes/{parishId}/workflows/{definitionId}` | WorkflowDefinitions | user |  | g200 |  | yes |  | WorkflowDefinitionService.SaveDraft | WorkflowsManage, self |
| POST | `/api/parishes/{parishId}/workflows/{definitionId}/mode` | WorkflowDefinitions | user |  | g200 |  | yes |  | WorkflowDefinitionService.SetMode | WorkflowsManage, self |
| POST | `/api/parishes/{parishId}/workflows/{definitionId}/publish` | WorkflowDefinitions | user |  | g200 |  | yes |  | WorkflowDefinitionService.Publish | WorkflowsManage, self |
| GET | `/api/parishes/{parishId}/workflows/{definitionId}/versions/{versionId}` | WorkflowDefinitions | user |  | g200 |  |  |  | WorkflowDefinitionService.Version | WorkflowsManage, appt:Any |
| GET | `/api/parishes/{parishId}/workflow-runs` | WorkflowRuns | user |  | g200 |  |  |  | WorkflowRunService.List | WorkflowsManage |
| GET | `/api/parishes/{parishId}/workflow-runs/worklist` | WorkflowRuns | user |  | g200 |  |  |  | WorkflowRunService.Worklist | MFA, mod:ct |
| GET | `/api/parishes/{parishId}/workflow-runs/{runId}` | WorkflowRuns | user |  | g200 |  |  |  | WorkflowRunService.Get | WorkflowsManage, appt:Any, self |
| POST | `/api/parishes/{parishId}/workflow-runs/{runId}/actions` | WorkflowRuns | user |  | g200 |  | yes |  | WorkflowRunService.Act | WorkflowsManage, appt:Any, self |
| GET | `/api/parishes/{parishId}/workflow-runs/{runId}/history` | WorkflowRuns | user |  | g200 |  |  |  | WorkflowRunService.History | WorkflowsManage, appt:Any, self |
| POST | `/api/parishes/{parishId}/workflow-runs/{runId}/steps` | WorkflowRuns | user |  | g200 |  | yes |  | WorkflowRunService.Step | WorkflowsManage, appt:Any, self |
| POST | `/api/parishes/{parishId}/workflows/{definitionId}/runs` | WorkflowRuns | user |  | g200 |  | yes |  | WorkflowRunService.Start | WorkflowsManage, appt:Any, self |

## 4. Database (Cosmos DB and Blob Storage)

### 4.1 Model

- One database `ParishLife` (serverless, Strong consistency). Five containers, all partitioned on `/partitionKey`, no TTL, no unique-key policies, explicit index include-lists with everything else excluded (`docs/cosmos/containers.json`, validated at readiness by `Api/Configuration/CosmosIndexContract.cs`). The API never creates containers or changes indexes; `tools/Initialize-Cosmos.ps1` does, by an operator.
- Every stored item is an envelope `{ id, partitionKey, type, data, schemaVersion, _etag }` (`Api/Data/Cosmos/Documents.cs`). "Tables" are therefore document **types** inside a partition. Writes are ETag-conditional `TransactionalBatch`es within one partition (`Api/Data/Cosmos/DocumentDatabase.cs` line 114). Each write also stores `operation:<id>` (actor, request fingerprint, result) and `audit:<id>` (actor, action, resource, reason, appointment) in the same partition.
- Relationships are by ID strings (`ParishId`, `PersonId`, `AccountId`, `HouseholdId`, `EventId`, `MinistryId`, `RequestId`), never joins.
- Tenant isolation is the partition key (`parish:<id>`, `account:<id>`) plus the service-layer checks; there is no database-level row security.

### 4.2 Containers, partitions and document types

The type list was extracted from `RecordChange.*`, `Row(...)` and query calls; types written through constants (`accountProfile`, `accountSignature`, `publicProfile`) were added by hand. A few types may still be missing.

| Container | Partition key values | Document types | Indexed paths (besides `/partitionKey`, `/type`) |
|---|---|---|---|
| `Accounts` | `account:<accountId>` | `account` (ParishUser), `session`, `mfa:*` (`mfaChallenge`), `ceremony:*` (`ceremonyNonce`, passkeys), `contactVerification`, `mfaEnrollment`, `mfaRecoveryRequest`, `accountStatusChange`, `accountProfile`, `accountSignature`, `personalWorkspaceItem`/`Revision`/`Command`, `notification`, `notificationPreferences`, `notificationWork`, `reportSchedule`, `reportDelivery`, account-side pointers (`parishFollow`, `primaryParish`, `membershipRequest`, `profileCorrection`, `requestClaimPointer`), `documentSignature`/`signerProfile`/`signatureArrangement` (account scope), `operation`, `audit` | `/data/kind`, `/data/status`, `/data/itemId` |
| `LoginAliases` | `email:<SHA-256 of normalized email>`, `username:<SHA-256>` | `alias` (account ID, normalized email, active, kind) | none |
| `TenantControl` | `parish:<parishId>` | Organization: `parish`, `association`, `grant` (AccessGrant), `coverage`, `parishStatusChange`, `jurisdictionProposal`, `ownershipClaim`(`Open`), `payerTransfer`(`Pending`), `payerSchedule`, `parishLocation`, `parishProfile`, `parishProfilePhoto`, `publicProfile`, `websiteSection`, `websiteRevision`, `staffAppointment`, `staffAppointmentReview`, `headDesignationChange`, `workflowDefinition`/`Version`/`Run`/`RunEntry`. People: `person`, `personFacts`, `personMedical`, `personConsent`, `personRelationship`, `personInvitation`, `personAccountLink`, `personAccountClaim`, `personMerge`, `duplicateDecision`, `household`, `householdMember`, `householdChange`, `householdEnvelope`, `peopleImport`, `personImportSource`, `exportLog`, `dataClosure`, `membershipRequest`, `profileCorrection`, `parishFollow`, `primaryParish`. Sacraments: `sacramentRecord`, `sacramentPolicy`, `sacramentRequirements`, `sacramentCounter`, `sacramentCorrection`, `certificate`, `certificatePolicy`, `documentTemplate`, `clergySignature`, `signatureImage`, `documentSignature`, `documentVerification`, `signerProfile`, `signatureArrangement`. Requests: `parishRequest`, `requestChange`, `requestMessage`, `requestLetter`, `evidenceFile`. Care: `pastoralNote`, `concern`, `concernEntry`, `concernReviewer`, `incident`. Communications: `announcement`, `prayerIntention`, `conversation`, `conversationMember`, `inboxMessage`, `messageReport`, `messageReview`, `broadcast`, `broadcastTemplate`, `broadcastAutomation`, `broadcastWork`, `notification*`. Scheduling: `event`, `eventTemplate`, `facility`, `equipment`, `equipmentBooking`, `facilityIssue`, `maintenanceBlock`, `reservation`, `reservationWork`, `renter`, `rentalAgreement`, `servicePlan`, `music`, `liturgicalCalendar`, `liturgicalException`. Registrations: `registration`, `registrationForm`, `registrationPolicy`, `registrationMovement`, `registrationRefund`, `presence`, `evacuation`, `evacuationOpen`. Ministries: `ministry`, `ministryApplication`(`Guard`/`History`), `ministryMembership`(`Period`/`History`/`Removal`), `ministryLeader`, `ministryLeadershipChange`, `ministryLifecycleHistory`, `ministryMeeting`(`History`), `meetingRsvp`, `ministryRsvpReason`(`Owner`/`Revision`), `ministryPrivateReason`, `attendanceSheet`, `attendanceRow`, `attendanceChange`, `formationProgram`, `formationEnrollment`(`Claim`), `formationChange`, `ministryLoan`(`Change`), `ministryStock`, `volunteerOpportunity`, `volunteerAssignment`, `volunteerHours`. Finance: `fund`, `fundBudget`, `campaign`, `countSession`, `contribution`, `pledge`, `pledgeAllocation`, `recurringGift`, `giftReceipt`, `giftReceiptClaim`, `giftReceiptCounter`, `expense`, `exchangeRate`, `bankLine`, `bankReconciliation`, `officeEntry`, `officeMonth`, `officeOpening`. Plus `operation`, `audit`. | 28 data paths, including `/data/accountId`, `/data/status`, `/data/startsAt`, `/data/endsAt`, `/data/eventId`, `/data/personId`, `/data/householdId`, `/data/requestId`, `/data/ministryId`, `/data/meetingId`, `/data/registrationId`, `/data/kind`, `/data/published`, `/data/visibility`, `/data/definitionId`, `/data/runId`, `/data/reporterAccountId` (full list in `docs/cosmos/containers.json`) |
| `TenantControl` | `archdiocese:<id>` | `organization` (Archdiocese), `bishopAppointment`, `bishopSeat`, `staffAppointment`, `liturgicalCalendar`(`Seat`), `liturgicalException`, `certificatePolicy`, `concern*` (archdiocese route), `documentSignature*` | as above |
| `TenantControl` | `resource:<id>` | `allocation`, `resourceGuard` (facility/equipment booking locks) | as above |
| `Billing` | `billing:<id>`, `activation:*`, `invoice:*`, `cash:*` | `invoice`, `activation`, `cashReceipt` (payer name), `cashReference` | `/data/invoiceId`, `/data/status`, `/data/leaseUntil` |
| `Catalog` | `plans`; `platform:<owner>` (for example `platform:site-content`, `platform:site-metrics-<yyyyMMdd>`, `platform:directory-reads:<accountId>`) | `plan` (EF Core `PlanDocument`), `homepageDraft`/`Published`/`Revision`, `clergyTitle`, `clergyTitleAssignment`, `parishCrmRecord`, `parishCrmEntry`, `siteMetric`, `operation`, `audit` | none |

Containers referenced in code but not in the manifest: `RecordTransactions.Location` maps `RecordArea.Finance` to container `Finance`, `PrivateCase` to `RestrictedCases` and `Public` to `Publishing` (`Api/Repositories/Common/RecordTransactions.cs` lines 28–32). No caller uses those three areas (searched `RecordArea.Finance|PrivateCase|Public`), so nothing is written there today; finance data lives in `TenantControl`.

### 4.3 Personal data by document type

| Type (model file) | Personal fields | Protection |
|---|---|---|
| `account` (`Identity/ParishUser.cs`, extends `IdentityUser`) | user name, email, normalized email, phone number field (Identity), display name, password hash, security stamp, authenticator key, recovery codes, passkeys (credential ID, public key, name, sign count, transports, backup flags), external logins (provider, hashed subject), platform-operator and identity-verified flags, created date | authenticator key and recovery codes protected with Data Protection (`ParishLife.Identity.Authenticator.v1`, `.RecoveryCodes.v1`); password hashed |
| `alias` (`LoginAlias`) | normalized email | partition key is a hash; the value is in clear |
| `session`, `mfaChallenge` | account ID, created/expiry, method | no IP or device stored |
| `contactVerification` | target email, code hash, attempts | code hashed |
| `accountProfile` (`AccountProfile.cs`) | given/family names (EN/AR), town, address, occupation, about, language, colours | clear |
| `accountSignature` | handwritten signature drawing (SVG path), title | clear |
| `personalWorkspace*` | private notes and tasks | content protected (`ParishLife.PersonalWorkspace.*`) |
| `person` (`Person.cs`) | given/family names (EN/AR), birth date, contact, rite, register status | clear |
| `personFacts` | country, region, district, town, address detail, occupation, skills, language, date and evidence of death | clear |
| `personMedical` (`PersonMedicalContent.cs`) | allergies, conditions, blood type, notes | protected (`ParishLife.PersonMedical.v1`) |
| `personConsent` | consent kind, purpose, fields, given by, withdrawal reason | clear |
| `household`, `householdMember` | household name, address, phone, contact person, member addresses | clear |
| `personRelationship`, `personInvitation`, `personAccountLink`, `personMerge` | links between people and accounts | clear |
| `peopleImport` (`PeopleImportRow.cs`) | staged CSV rows: names, birth date, contact | clear, until committed |
| `membershipRequest`, `profileCorrection` | names, birth date, contact, locality, note, requested changes | clear |
| `sacramentRecord` (`SacramentRecord.cs`) | person, sacrament kind, facts dictionary (for example parents, godparents), celebrant, place, witnesses, official number, register book/page | clear |
| `certificate`, `requestLetter`, `documentSignature` | recipient/addressee name, signer name, verification code | clear |
| `clergySignature` / `signatureImage` | handwritten signature images (Blob) | private Blob; hash checked |
| `parishRequest` (`ParishRequest.cs`) | requester name and contact (guests), subject description, relationship, authority basis, free-text details, preferred dates, guest token hash | clear (token hashed) |
| `requestMessage`, `inboxMessage`, `conversation` | message bodies, participants | clear |
| `evidenceFile` | file name, uploader; file content in Blob (PDF/JPEG/PNG ≤ 10 MB) | private Blob |
| `pastoralNote` | pastoral note content, person, assignee | protected (`ParishLife.PastoralNotes.v1`) |
| `concern` | concern content, applicant (or anonymous), implicated accounts | protected (`ParishLife.Concerns.v1`) |
| `incident` (`Incident.cs`, `IncidentReport.cs`) | location, people involved, description, actions, witnesses | report protected (`ParishLife.Incidents.v1`) |
| `messageReport`, `parishCrmEntry`, ministry reasons (`ministryApplication`, `ministryPrivateReason`, `ministryRsvpReason`, `attendanceChange`) | free-text reasons | protected (`MessageReports`, `ParishCrm`, `MinistryApplication`, `MinistryDeparture`, `MinistryRsvpReason`, `MinistryAttendance`) |
| `registration` (`EventRegistration.cs`) | participant (often a child), form answers, consent evidence, guardian authority evidence, authorized collectors (names), independent departure, fee, presence, pickup code hash and salt | pickup code hashed; rest clear |
| `evacuation` | roll call of people present | clear |
| `contribution`, `pledge`, `recurringGift`, `giftReceipt` | donor person/household, amounts, method, anonymous flag | clear |
| `bankLine`, `bankReconciliation` | bank account label, amounts | clear |
| `cashReceipt` (Billing) | payer name | clear |
| `reservation`, `renter`, `rentalAgreement` | contact phone, notes, renter name and responsible contact | clear |
| `prayerIntention`, `announcement` | applicant, display name | clear |
| `parishProfile`, `parishLocation` | parish address, email, phone, clergy names, coordinates, photos | public by design |
| `audit`, `operation` | actor account ID, action, resource ID, reason, request fingerprint and result | credentials excluded by rule (`AGENTS.md`) |
| `siteMetric` | day, kind, language, parish, count | no personal data |
| `workflowRun` answers | answers to custom forms | protected (`ParishLife.WorkflowAnswers.v1`) |

Special-category note for Agent 06: membership of a parish, sacraments and pastoral records reveal religious belief; `personMedical` is health data; registrations, incidents and pickup codes concern children.

### 4.4 Blob Storage

| Container / path | Contents | Written by |
|---|---|---|
| `evidence/<parish>/<fileId>` request files | PDF, JPEG, PNG (magic-byte checked), ≤ 10 MB, ≤ 20 active per request | `Api/Services/Files/EvidenceService.cs` |
| `evidence/profile-photos/<parish>/<id>` | JPEG, PNG, WebP, ≤ 5 MB, ≤ 12 per parish | `Api/Services/Publishing/ParishProfileService.cs` |
| `evidence/<parish>/signature-images/<id>` | PNG, JPEG, ≤ 1 MB | `Api/Services/Sacraments/ClergySignatureImageService.cs` |
| `data-protection/keyring.xml` | Data Protection key ring (wrapped by Key Vault) | framework |

Container names and paths come from `appsettings.json`; public blob access is disabled and shared keys are off per `docs/continuation/AZURE-CONNECTION.md` line 22 (**Unverified** in Azure).

### 4.5 Row Level Security, views, SECURITY DEFINER, stored procedures

**Not applicable.** The database is Cosmos DB for NoSQL, which has no row-level security, views or `SECURITY DEFINER` functions. No Cosmos stored procedures, triggers, user-defined functions or change feed are used (searched `StoredProcedure`, `Scripts.`, `UserDefinedFunction`, `Trigger`, `ChangeFeed`). Access control is entirely in the API: partition keys plus the service checks in section 3. The API reaches Cosmos with one managed identity that has data-plane access to the whole account, so any API bug can reach any partition.

## 5. Environment variables and configuration keys

ASP.NET Core reads configuration from `appsettings*.json`, environment variables (`Section__Key`) and App Service settings. Names only; no values are printed. No `.env` or `.env.example` file exists (`.gitignore` allows `.env.example`, but there is none); the settings are documented in `docs/azure-manual-setup/production.md` and the operations runbooks named below. Nothing reaches the frontend bundle through the environment: the frontend has no `import.meta.env` or `VITE_*` use. The Turnstile site key reaches browsers at run time through `GET /api/auth/capabilities`.

| Name | Read in | Secret | Reaches the browser | Documented |
|---|---|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | framework; decides Development behaviour throughout `ServiceCollectionExtensions.cs` | no | no | `docs/azure-manual-setup/production.md` |
| `AllowedHosts` | framework; `Api/appsettings.json` | no | no | `docs/operations/frontend-hosting.md` |
| `Storage__Provider`, `Storage__LocalPath` | `ServiceCollectionExtensions.cs` (`ReadStorage`), `Configuration/StorageOptions.cs`, `tools/ParishLife.Maintenance/Program.cs` | no | no | production.md, README |
| `Cosmos__Endpoint`, `Cosmos__Database` | `Configuration/CosmosOptions.cs` via `ServiceCollectionExtensions.cs` line 68 | no | no | production.md |
| `Cosmos__EmulatorKey` | same; allowed only in Development | yes | no | not documented |
| `Azure__ManagedIdentityClientId` | `ServiceCollectionExtensions.cs` lines 69–76 | no (identifier) | no | production.md |
| `BlobStorage__ServiceUri`, `BlobStorage__EvidenceContainer` | `Configuration/BlobStorageOptions.cs` | no | no | production.md |
| `DataProtection__ApplicationName`, `DataProtection__BlobUri`, `DataProtection__KeyIdentifier` | `Configuration/CosmosOptions.cs` (`DataProtectionOptions`), `ConfigureDataProtection` | no (locations) | no | production.md |
| `BackgroundJobs__Enabled` | the five workers, `Services/Operations/CapabilityService.cs` | no | no | README, AZURE-CONNECTION.md |
| `Passkeys__ServerDomain` | `ServiceCollectionExtensions.cs` line 332 | no | no | `docs/operations/account-sign-in-methods.md` |
| `Turnstile__SiteKey` | `Configuration/TurnstileOptions.cs` | no (public) | yes, via `/api/auth/capabilities` | `docs/operations/frontend-hosting.md`, `account-sign-in-methods.md` |
| `Turnstile__SecretKey` | same | **yes** (Key Vault reference) | no | same |
| `Turnstile__ExpectedHostname`, `Turnstile__VerifyEndpoint` | same | no | no | frontend-hosting.md (ExpectedHostname only) |
| `Email__Provider`, `Email__From` | `Configuration/EmailOptions.cs` | no | no | `docs/operations/email-delivery.md` |
| `Email__ResendApiKey` | same | **yes** (Key Vault reference) | no | email-delivery.md |
| `ExternalSignIn__google__ClientId`, `ExternalSignIn__microsoft__ClientId` | `Configuration/ExternalProviderOptions.cs`, `ServiceCollectionExtensions.cs` lines 349–383 | no (public IDs) | no | frontend-hosting.md |
| `ExternalSignIn__google__ClientSecret`, `ExternalSignIn__microsoft__ClientSecret` | same | **yes** (Google's is a Key Vault reference; Microsoft has none) | no | frontend-hosting.md |
| `ExternalSignIn__microsoft__UseManagedIdentityAssertion` (also readable for google, ignored) | same | no | no | frontend-hosting.md |
| `PublicApp__Name`, `__ShortName`, `__Description`, `__StartUrl`, `__Display`, `__ThemeColor`, `__BackgroundColor`, `__Icons__<n>__Src/Sizes/Type/Purpose` | `Services/Publishing/PublicAppService.cs` | no | yes (served as the API manifest) | `docs/operations/public-directory-and-offline.md` |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | `Extensions/TelemetryExtensions.cs`, `Services/Operations/InfrastructureReadiness.cs` | treat as secret | no | production.md |
| `OTEL_EXPORTER_OTLP_ENDPOINT` (and other `OTEL_*` read by the SDK, set by Aspire) | `Extensions/TelemetryExtensions.cs` | no | no | README (Aspire) |
| `Logging__LogLevel__*` | framework; `appsettings*.json` | no | no | — |
| `Backend__UseAzure`, `Backend__RunBackgroundJobs` | `ParishLife.AppHost/AppHost.cs` (local only) | no | no | README |
| `PARISHLIFE_API` | `frontend/vite.config.js` (dev proxy target) | no | no (build-time only, not injected) | `frontend/README.md` |
| `E2E_PORT`, `E2E_TURNSTILE`, `E2E_MANIFEST`, `E2E_CHANNEL` | `frontend/scripts/e2e.mjs`, `frontend/e2e/support.mjs`, `frontend/playwright.config.mjs` | no | no | script headers |
| `PARISHLIFE_ROUTE_LOG` | `frontend/scripts/route-recorder.mjs` | no | no | script header |
| `TZ` | set by `frontend/scripts/checks/requests.mjs` | no | no | — |

Validation: options are validated at startup (`ValidateOnStart`) for Cosmos, Azure, Blob and Data Protection (`ServiceCollectionExtensions.cs` lines 68–71); Local storage is refused outside Development (lines 241–249). Turnstile, Email, ExternalSignIn and PublicApp are not validated beyond "all set or off".

## 6. Data inventory (personal data the product collects)

Retention, everywhere: nothing is deleted automatically (`CapabilityService`: "No retention classes are approved"); account deletion is refused by `CosmosIdentityStore.DeleteAsync`; data closure removes optional personal data only. Backups: Cosmos continuous backup 7 days and Blob soft delete 30 days per `docs/operations/legal-pages.md` (**Unverified**: recorded by an Azure session, not in code). All stored data is processed by Microsoft Azure in France Central.

| Data | Collected by (form or source) | Stored in | Purpose | Third parties that receive it | Kept |
|---|---|---|---|---|---|
| Email, password, display name | sign-up (`POST /api/auth/register`, `portal/shell/Auth.jsx`) | `Accounts` (`account`), `LoginAliases` | sign-in | Resend (email + code) when configured; Cloudflare Turnstile (IP, token) | until deletion by request |
| Email confirmation / email change codes | `contact-verification`, `email-change` | `contactVerification` (hash) | prove the address | Resend | 15 min validity; record kept |
| Authenticator secret, recovery codes, passkeys | My account security screens | `account` | MFA and passwordless sign-in | none (passkey biometrics stay on the device) | until removed |
| Google/Microsoft identity (subject, verified email, name) | external sign-up/sign-in/link | `account.ExternalLogins` (hashed subject), email/name at sign-up | sign-in | Google or Microsoft (the person chooses) | until unlinked |
| Sessions (start, expiry, method) | every sign-in | `session` | session validation | none | not purged (**Unverified** cleanup) |
| Profile: names EN/AR, town, address, occupation, about, language, colours | My account (`PUT /api/auth/profile`) | `accountProfile` | display | none | until changed |
| Handwritten signature drawing | My account signature | `accountSignature` | future signing (owner decision U05 open) | none | until removed |
| Personal notes and tasks | My notes | `personalWorkspace*` (protected) | own use | none | until deleted |
| Parish person record: names, birth date, contact, rite, facts, address, occupation, skills, death | office people screens, CSV import, membership requests, profile corrections | `person`, `personFacts`, `household*`, `peopleImport` | parish register | none | indefinite |
| Medical: allergies, conditions, blood type, notes | office person screen (`people.medical.manage`) | `personMedical` (protected) | event safety | none | indefinite |
| Consents | office and member consent screens | `personConsent` | record consent | none | indefinite |
| Sacrament records and certificates (names, parents/godparents, witnesses, celebrant, place, numbers) | sacrament screens, member requests | `sacramentRecord`, `certificate`, `documentSignature` | church register, certificates | none (verification code shown publicly on check) | indefinite |
| Guest request: name, contact, subject, relationship, authority basis, details, files | public request form (`RequestPage.jsx` → `POST /api/public/parishes/{id}/requests`), tracking page | `parishRequest`, `requestMessage`, `evidenceFile`, Blob | handle the request | Cloudflare Turnstile (IP) | indefinite |
| Member requests and messages | member portal | `parishRequest`, `requestMessage`, `inboxMessage` | parish communication | none | indefinite |
| Pastoral notes, concerns, incidents | clergy/office screens, member "Submit a concern" | protected types | pastoral care, safeguarding | none | indefinite |
| Event registrations (often children): answers, guardian evidence, authorized collectors, pickup code, presence, fees | office registration screens, member self-registration | `registration`, `presence`, `evacuation` | event admin and child safety | none | indefinite |
| Ministry participation: memberships, RSVPs and private reasons, attendance, formation evidence, volunteering hours, loans | ministry screens | ministry types | ministry admin | none | indefinite |
| Giving: donor, amount, method, receipts; bank lines | finance screens | finance types | parish accounts, receipts | none | indefinite |
| Reservations and rentals: contact phone, renter name, responsible contact | facilities screens | `reservation`, `renter`, `rentalAgreement` | bookings | none | indefinite |
| Parish public profile: address, phone, email, clergy names, photos, coordinates | parish profile and website screens | `parishProfile`, Blob | public directory | public | indefinite |
| Visitor location (latitude/longitude) | "Near me" on the public homepage (browser geolocation prompt) | not stored (sent to `POST /api/public/parishes/nearby` only; no write found in `PublicDirectoryService`) | distances | none | request only |
| Visit counts (kind, language, parish) | `lib/beacon.js` | `siteMetric` | Insights | none | indefinite (retention open, owner question 15) |
| IP address | every request | rate limiter memory only; not stored by the app | rate limiting | Cloudflare (Turnstile), Azure (App Service, Application Insights) | Application Insights: "90 days" per legal pages (**Unverified**) |
| Request telemetry (URLs, status, timings, trace IDs) | OpenTelemetry | Application Insights | operations | Microsoft | **Unverified** |
| Font requests (IP, user agent, referrer) | loading `index.html`, `landing.html`, print views | — | fonts | Google Fonts | Google's policy |
| Audit records (actor, action, resource, reason) | every write | `audit` | accountability | none | indefinite |
| Platform CRM notes on parishes | operator screens | `parishCrm*` (protected) | sales/support | none | indefinite |
| Operator snapshot exports | `tools/ParishLife.Maintenance snapshot-export` | operator's disk | backup | wherever the operator stores it | owner question 16 |

## 7. Third-party scripts, embeds and external resources

There is no cookie consent banner (searched `frontend/src`); everything below loads without consent.

| Resource | Where it loads | When | Before consent | Note |
|---|---|---|---|---|
| Google Fonts CSS and font files (`fonts.googleapis.com`, `fonts.gstatic.com`: Inter, IBM Plex Mono, IBM Plex Sans Arabic) | `frontend/index.html` line 12, `frontend/landing.html` line 11, `frontend/src/portal/shared/print.js` line 13 | page load (portal, product page); print views | yes (no banner) | `public.html`, `privacy.html`, `terms.html` use self-hosted fonts only. CSP allows these origins. |
| Cloudflare Turnstile script and iframe (`challenges.cloudflare.com/turnstile/v0/api.js`) | `frontend/src/lib/turnstile.js` | when the sign-in/sign-up screen or the guest request form shows and Turnstile is on | yes | Sends the visitor's IP and browser signals to Cloudflare. |
| Service worker `sw.js` and Cache Storage | `frontend/src/public/main.jsx` line 37, `frontend/public/sw.js` | public site load over HTTPS | yes | First-party; caches public pages and the API's listed anonymous reads. |
| Visit beacon | `frontend/src/lib/beacon.js` | public page views | yes | First-party; skipped on DNT/GPC. |
| React, GSAP, Lenis | bundled from npm | — | — | No CDN. |
| Outbound links only (no embed, nothing loads until clicked): Google Maps search, Google Calendar, WhatsApp share and a WhatsApp contact number on the product page, OpenStreetMap, Unsplash profile credit, `dglac.gov.lb` and `ppa.gov.lb` PDFs | `public/pages/parish-parts.jsx`, `public/components/ParishCalendar.jsx`, `public/pages/ParishPage.jsx`, `landing/Landing.jsx`, `portal/shared/dialogs.jsx`, `portal/features/oversight/oversight.jsx`, `public/components/Chrome.jsx`, `portal/ui/geography.jsx` | on click | n/a | — |
| Iframes | `portal/shared/print.js` creates a same-origin print iframe; Turnstile iframe | — | — | CSP `frame-src` allows Turnstile only; pages cannot be framed (`frame-ancestors 'none'`). |
| Pixels, chat widgets, video embeds, maps SDKs | none | — | — | — |

## 8. Cookies and browser storage

Cookies:

| Name | Set by | Attributes | Purpose |
|---|---|---|---|
| `__Host-ParishLife` | Identity application cookie, `Api/Program.cs` lines 39–64 | HttpOnly, Secure, SameSite=Strict, Path=/, session cookie with 8 h server expiry, not sliding | signed-in session |
| `__Host-ParishLife.Csrf` | anti-forgery, `Api/Program.cs` lines 29–37; issued by `GET /api/auth/csrf` (also called by the public beacon) | HttpOnly, Secure, SameSite=Strict | CSRF protection |
| `__Host-ParishLife.ExternalMfa` | `Api/Services/Accounts/ExternalSignInService.cs` lines 32, 110–123 | HttpOnly, Secure, SameSite=Strict, ≤ 10 min, Data Protection-encrypted | holds a pending MFA challenge after a provider round trip |
| Identity external cookie (framework default name, `.AspNetCore.Identity.External`) | `IdentityConstants.ExternalScheme`, used by the OAuth handlers | framework defaults | between the provider callback and `/api/auth/external/complete` (**Unverified** exact name and attributes; framework default) |
| OAuth correlation and PKCE cookies (`.AspNetCore.Correlation.*`) | ASP.NET Core OAuth handler | framework defaults | OAuth state (**Unverified**: framework default) |
| Cloudflare Turnstile cookies, if any | Cloudflare | third party | bot check (**Unverified**) |

Browser storage (all first-party):

| Key | Storage | Set in | Purpose |
|---|---|---|---|
| `pl-lang` | localStorage | `lib/i18n.js`, `public/App.jsx`, `landing/Landing.jsx`; read by every page's inline script | language |
| `pl-text`, `pl-simple` | localStorage | `reading/EasyReading.jsx`; read by inline scripts | text size, simple view |
| `pl-rail` | localStorage | `portal/model/store.js` | sidebar collapsed |
| `pl-finance-session:<parishId>` | localStorage | `portal/model/modules/finance.js` | last counting session |
| `pl-anniversaries-<accountId>` | localStorage | `portal/features/records/sacraments.jsx` line 514 | anniversary list layout |
| `pl-notice` | sessionStorage | `portal/features/account/account-security.jsx`, `portal/shell/Auth.jsx` | one-time message after a security change |
| `pl-welcome` | sessionStorage | `portal/features/account/account.jsx` | one-time welcome |
| `pl-admin-opened` | sessionStorage | `portal/features/administration/workspace.jsx` | which parishes/archdioceses the operator opened |
| Cache Storage `parishlife-public-v2` | Cache API | `public/sw.js` | offline copy of public pages, assets and listed anonymous API reads |

## 9. Assets

| Asset | Where | Used by | Licence information found |
|---|---|---|---|
| Fonts: Amiri, Marcellus, Noto Sans, Noto Sans Arabic, Source Sans 3 (`.woff2`) | `frontend/public/assets/fonts/` | public site, legal pages | OFL text files beside them (`*-OFL.txt`). |
| Fonts: Inter, IBM Plex Mono, IBM Plex Sans Arabic | Google Fonts (remote) | portal, product page, print | Not in repo (Google Fonts, OFL). |
| Photos: `church-interior.jpg/.webp` (887 KB jpg), `church-light.jpg/.webp`, `votives.webp`, `gilt.webp`, `og-home.jpg` (Open Graph), `sanctuary/*.webp` (14), `valley/*.webp` (17) | `frontend/public/assets/images/` | public site, auth screen, product page, CSS backgrounds | Footer credit "Illustrative photographs from Unsplash" linking one photographer (`public/components/Chrome.jsx` lines 20–21, 185). Which files are Unsplash photos and which are generated or drawn is **Unverified**; no per-file credit or licence file. |
| `lebanon-relief.webp`, Lebanon map data | `frontend/public/assets/images/`, `frontend/src/lib/data/lebanon-map.js` | public home map | "Natural Earth 1:10m (public domain)" in the data file; credit in the footer. The generator it names (`docs/tools/build_lebanon_map.py`, `docs/homepage-design.md`) is not in the repo. |
| App icons: `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | `frontend/public/assets/images/icons/` | `site.webmanifest`, `public.html` | none (own artwork assumed, **Unverified**) |
| Favicons | inline SVG data URLs in each HTML head | all pages | own |
| Icon sets | `frontend/src/portal/ui/icons.jsx`, `frontend/src/public/components/icons.jsx` (inline SVG paths) | portal, public site | comments say drawn for the design system; no licence |
| Video, audio | none | — | — |

Total size: images 4.1 MB, fonts 0.9 MB.

## 10. Forms

Server-side validation applies to every form: `[ApiController]` returns 400 for DTO attribute failures (286 of 552 DTO files carry attributes; the rest are output DTOs), and services re-check with `Guard` and `DomainException`.

Public and sign-in forms:

| Form | File | Fields | Submits to | Server-side checks |
|---|---|---|---|---|
| Sign-in | `frontend/src/portal/shell/Auth.jsx` | email or user name, password, Turnstile | `POST /api/auth/login` | DTO validation, Turnstile, lockout (5 / 15 min), `auth20` |
| Second step | same | authenticator code or recovery code | `POST /api/auth/login/mfa`, `POST /api/auth/login/mfa/recovery` | challenge expiry, code length ≤ 12, `auth20` |
| Passkey sign-in | `Auth.jsx`, `portal/model/passkeys.js` | WebAuthn assertion | `/api/auth/login/passkey/options`, `/api/auth/login/passkey` | Turnstile on options, `auth20` |
| Sign-up | `Auth.jsx` | email, password (16+), display name, Turnstile; "By creating an account you accept the terms and privacy policy" | `POST /api/auth/register` | DTO validation (`RegisterAccountDto`: OperationId, Email, Password, DisplayName), Turnstile, `auth20`. **No age question or check** (terms say 13+). |
| Email code | `Auth.jsx`, account screens | email, code | `/api/auth/contact-verification`, `/confirm`, `/api/auth/email-change`, `/confirm` | Turnstile on request, attempts counted |
| Google / Microsoft | `Auth.jsx` (browser form post) | Turnstile token, `returnTo` | `POST /api/auth/external/{provider}/sign-in` or `/sign-up` (form-urlencoded, CSRF token as form field) | Turnstile, CSRF |
| Guest request to a parish | `frontend/src/public/pages/RequestPage.jsx` | kind, summary, details, preferred dates, requester name, contact, subject description, relationship (Self/Parent/Guardian/...), authority basis, Turnstile | `POST /api/public/parishes/{id}/requests` | `GuestRequestDto` attributes, Turnstile, `auth20`, module coverage |
| Request tracking | `frontend/src/public/pages/TrackingPage.jsx` | message text, file (PDF/PNG/JPEG), actions | `/api/public/parishes/{id}/requests/{rid}/messages`, `/files`, `/actions` (token header) | token hash check, file type by magic bytes, size, `auth20` |
| Document check | `frontend/src/public/pages/VerifyPage.jsx` | verification code | `GET /api/public/document-verifications/{code}` | `auth20` |
| Parish search and "Near me" | `frontend/src/public/pages/Home.jsx` | text, town, sort; geolocation | client filter; `POST /api/public/parishes/nearby` | `NearbyParishesDto` |

Signed-in forms: every portal screen edits records through dialogs and the generic record editor (`portal/shared/record-editor.jsx`), and `persist()` sends changes per module (`portal/model/modules/*.js`). The screens, fields and API routes of each module are listed in `docs/frontend-modules/<module>.md` (people, sacraments, calendar, facilities, ministries, registrations, finance, communications, requests, member, administration, account, public); the API side is the table in section 3.7. `npm run check:routes` confirms each frontend call has an API route; two known gaps are listed in `frontend/scripts/route-gaps.json` (the attendance `.xlsx` import preview `POST /api/parishes/{id}/attendance-preview`, and a deliberate old route). File inputs: people CSV import (`records/people.jsx`), attendance `.xlsx` (gap), request documents, profile photos (JPEG/PNG/WebP), clergy signature image (PNG/JPEG). Rich text: parish website sections and some notices use `portal/ui/components.jsx` `RichText` (contenteditable) and are rendered on the public site through `lib/rich-text.js` `safeRichText` (client-side allow-list); the server stores the text as given (no server-side HTML sanitizing found in `Services/Publishing/WebsiteService.cs`). The office "make a new password" dialog in `features/records/person.jsx` calls `memberAction('accountReset')`, which always throws "not connected" (`model/member-data.js` lines 706–707).

## 11. Existing quality and operations

| Area | What exists | Where |
|---|---|---|
| Backend tests | xUnit 2.9.3. Unit: 40 attributes in 8 files. Integration: 445 attributes in 117 files, real HTTP through `WebApplicationFactory` with isolated local storage. Docs report 547 passing tests on 20 November (64 unit, 483 integration). Run: `dotnet test ParishLife.slnx`. | `ParishLife.UnitTests/`, `ParishLife.IntegrationTests/`, `docs/operations/frontend-hosting.md` |
| Frontend checks | `npm run check` (module checks against an in-memory API stand-in: `scripts/check-api.mjs`, 15 files in `scripts/checks/`), `npm run check:routes` (frontend calls vs API routes), `npm run format:check` (Prettier 3.9.10), `npm run build`. | `frontend/package.json`, `frontend/scripts/` |
| End-to-end | `npm run e2e`: builds the frontend, starts `ParishLife.EndToEnd` (real API, temporary storage, fixture accounts for every role), runs Playwright (`frontend/e2e/portal.spec.mjs`, 5 `test()` blocks; docs say 9 runs), Turnstile test keys by default. Browser channel `msedge` by default (`E2E_CHANNEL`). | `frontend/scripts/e2e.mjs`, `frontend/playwright.config.mjs`, `ParishLife.EndToEnd/` |
| Script tests | Pester test for `Initialize-Cosmos.ps1`. | `tools/tests/Initialize-Cosmos.Tests.ps1` |
| CI/CD | **None.** No `.github/`, Azure Pipelines or other workflow files. No pre-commit hooks, no secret-scanning config. | repository root (searched) |
| Linting and type checking | C#: compiler with nullable reference types, `TreatWarningsAsErrors`, `AnalysisLevel` latest. Frontend: Prettier only; plain JavaScript, no type checker, no ESLint. `.editorconfig` at root and in `frontend/`. | `Directory.Build.props`, `frontend/.prettierrc.json` |
| Monitoring | Application Insights through OpenTelemetry when configured; App Service health check on `/health/ready` (docs); `GET /api/administration/readiness` for operators. No alert rules or uptime tests found in the repo (**Unverified** in Azure). | `Api/Extensions/TelemetryExtensions.cs`, `docs/continuation/AZURE-CONNECTION.md` |
| Logging | `ILogger` with very few messages: unhandled-failure type and trace ID, worker retry types, Resend and Turnstile failures. No security-event log lines (sign-in failures, lockouts); security history lives in Cosmos `audit` documents. | `Api/Middleware/ApiExceptionHandler.cs`, `Api/BackgroundJobs/*`, `Api/Services/Accounts/*` |
| Backups | Azure-native: Cosmos continuous backup 7 days and Blob soft delete 30 days per the legal pages doc (**Unverified**). Operator snapshot export/verify/restore in `tools/ParishLife.Maintenance`. Schedule, RPO/RTO and custody are open (owner question 16, U15). | `docs/operations/data-snapshot-and-recovery.md`, `docs/operations/legal-pages.md` |
| Staging | **None.** One production environment; local runs use local storage. Owner question 26. | `hardening/PROJECT_CONTEXT.md` |
| Deploy process | Manual. `tools/Publish-ParishLife.ps1` builds the frontend, publishes the API with `-p:IncludeFrontend=true`, checks the package, zips it with `tar.exe` and prints `az webapp deploy ... --type zip --clean true`. Each deploy needs the owner's go-ahead; the log of deploys is in `docs/operations/frontend-hosting.md`. | `tools/Publish-ParishLife.ps1`, `Api/ParishLife.Api.csproj` (`PublishFrontend` target) |
| Domain and TLS | Cloudflare DNS; apex `A` DNS-only to App Service; `www` proxied and 301-redirected to the apex. Free App Service managed certificate (valid to 19 May 2027, auto-renewed), SNI. `httpsOnly` on, min TLS 1.2. HSTS from the app, 30 days, no `includeSubDomains`. HTTP/2 is not offered on the apex (live HEAD answered HTTP/1.1 while the same client used HTTP/2 with Cloudflare). | `docs/operations/frontend-hosting.md`, live HEAD checks |
| Database tooling | `tools/Initialize-Cosmos.ps1` plans (and with `-Apply` applies) containers and index policies from `docs/cosmos/containers.json`; readiness rejects incompatible live policies. | `tools/Initialize-Cosmos.ps1`, `Api/Services/Operations/InfrastructureReadiness.cs` |

## 12. Applicability list

| Question | Answer | Evidence |
|---|---|---|
| HTTP/2 server or proxy in use | **No** for the app (apex served over HTTP/1.1 by App Service; Kestrel defaults). **Yes** only for Cloudflare's `www` redirect. | live HEAD checks; `docs/operations/frontend-hosting.md` |
| bcrypt used anywhere | **No.** Passwords use the ASP.NET Core Identity hasher (PBKDF2). Other hashes: SHA-256 for login-alias keys, guest tracking tokens, codes; salted SHA-256 for pickup codes; Data Protection for secrets. | `Api/Identity/ParishUserManager.cs`, `Api/Services/Accounts/AccountPasswordService.cs` line 125, `Api/Identity/CosmosIdentityStore.cs` line 34, `Api/Models/EventRegistration.cs` |
| SAML | **No.** | searched backend and frontend |
| OAuth / social login | **Yes**: Google and Microsoft (personal and work accounts via `common`), PKCE, sign-in/sign-up/link/unlink. Microsoft authenticates the client with a managed-identity token instead of a secret. | `Api/Configuration/ExternalProviderOptions.cs`, `Api/Identity/ExternalOAuthHandler.cs`, `Api/Controllers/Accounts/ExternalSignInController.cs` |
| GraphQL | **No.** | searched |
| TOTP 2FA | **Yes** (authenticator app, recovery codes, independently reviewed lost-device reset). Required for platform operators, staff appointments and clergy authority. | `Api/Services/Accounts/MfaSecurityService.cs`, `Api/Controllers/Accounts/MfaSecurityController.cs`, `Api/Identity/AccountAccess.cs` |
| SMS 2FA | **No.** | `CapabilityService` |
| JWTs | **Partly**: no JWT sessions or API tokens (cookie sessions). JWTs appear only in OAuth: the Microsoft `id_token` is decoded **without signature validation** (relying on the direct TLS token response, OIDC Core 3.1.3.7), and a managed-identity JWT is sent as the Microsoft client assertion. | `Api/Identity/ExternalIdentityClaims.cs` lines 58–62, `Api/Identity/ExternalOAuthHandler.cs` line 40 |
| Reverse proxy or CDN in front of the app | **Yes, App Service's own front end** (TLS termination). **No CDN**: Cloudflare proxies only `www` for the redirect. No forwarded-headers middleware in code. | `docs/operations/frontend-hosting.md`, `Api/Program.cs` |
| HTTP caching of dynamic responses | **Yes, limited**: 7 anonymous GETs with `[PublicCache]` (`public, max-age` 300 s or 3600 s, ETag); everything else under `/api` is `no-store`; the service worker caches the API's listed anonymous reads. | `Api/Middleware/PublicCacheAttribute.cs`, `Api/Controllers/Publishing/*`, `frontend/public/sw.js` |
| Postgres/Supabase with RLS | **No** (Cosmos DB for NoSQL). | section 4.5 |
| Database views | **No.** | section 4.5 |
| XML parsing (including SVG, DOCX, XLSX uploads) | **No user XML is parsed on the server.** Uploads are limited by magic bytes to PDF/JPEG/PNG/WebP. The Data Protection key ring XML is framework-read from the private Blob. Account signatures are SVG path strings stored as text (rendered by the frontend). The attendance `.xlsx` import posts base64 to a route that does not exist. | `Api/Services/Files/EvidenceService.cs` lines 205–210, `Api/Services/Publishing/ParishProfileService.cs` lines 280–284, `Api/Services/Accounts/AccountSignatureService.cs`, `frontend/scripts/route-gaps.json` |
| WebSockets | **No.** | searched `UseWebSockets`, SignalR, `WebSocket`, `EventSource` |
| File uploads | **Yes**: 4 multipart endpoints (staff and guest request files, profile photos, clergy signature image); CSV people import as JSON text (≤ 64 KB body). | section 3.1 "Body size", `Api/Services/People/PeopleImportService.cs` |
| Payments | **No online payments.** Offline gifts, receipts, refunds and platform invoices are recorded only. | `CapabilityService`, `Api/Services/Finance/*`, `Api/Services/Billing/*` |
| User-generated HTML or markdown | **Yes, HTML**: parish website sections (EN/FR/AR) and other rich-text fields are edited in a contenteditable box and rendered on the public site with `dangerouslySetInnerHTML` after the client-side `safeRichText` allow-list (B, STRONG, U, I, EM, UL, OL, LI, P, DIV, BR, A). No server-side sanitizing. | `frontend/src/lib/rich-text.js`, `frontend/src/public/pages/ParishPage.jsx` line 896, `frontend/src/portal/ui/components.jsx` line 926, `Api/Services/Publishing/WebsiteService.cs` |
| Server-side templates | **Yes, one**: certificates rendered as printable HTML built with `StringBuilder` and HTML encoding; no Razor. | `Api/Services/Sacraments/DocumentSheetService.cs` (header comment: "escaped") |
| AI/LLM model calls | **No.** Agent 07 has nothing to run. | section 1 (search terms and files) |
| Email sending | **Yes, account codes only**, through Resend when configured. No newsletters, notifications or report emails (`ReportSchedule.EmailRequested` is stored but nothing sends it). | `Api/Services/Accounts/ResendContactCodeDelivery.cs`, `docs/operations/email-delivery.md` |
| Admin area | **Yes**: portal workspace/insights/settings/audit and `/api/administration/*` (platform operator + MFA); bishop oversight; parish settings. | `Api/Controllers/Administration/*`, `frontend/src/portal/features/administration/*` |
| User accounts | **Yes.** Sign-up open to anyone (email/password or Google/Microsoft). | `Api/Controllers/Accounts/AccountsController.cs` |
| Reviews or testimonials on the site | **No** (searched landing and home pages; the only `blockquote` is a scripture verse on the public home). | `frontend/src/public/pages/Home.jsx` line 1378 |
| SMS or one-time codes by phone | **No.** One-time codes are emailed only. | `CapabilityService` |
| Sign in with Apple or relay-email providers | **No Apple.** Google and Microsoft give real verified emails; sign-up never merges into an existing account by email. | `Api/Configuration/ExternalProviderOptions.cs`, `docs/operations/account-sign-in-methods.md` |
| HEIC image uploads from phones | **Not accepted.** Evidence accepts PDF/JPEG/PNG, photos JPEG/PNG/WebP, signatures PNG/JPEG, all by magic bytes; HEIC is rejected with a 400. File pickers: `accept=".pdf,.png,.jpg,.jpeg"` and `image/jpeg,image/png,image/webp`. | services above; `frontend/src/public/pages/TrackingPage.jsx` line 311, `portal/features/communicate/public-profile.jsx` line 252 |
| Dates, deadlines or reminders that depend on a time zone | **Yes.** Calendar events, ministry meetings, attendance sheets and report schedules store an IANA `TimeZone`; recurrence is in local time; registration age is computed on the event's local date; liturgical dates are civil dates. | `Api/Models/CalendarEvent.cs`, `MinistryMeeting.cs`, `ReportSchedule.cs`, `Api/Services/Reporting/ReportScheduleService.cs` lines 148–165, `Api/Services/Registrations/RegistrationService.cs` line 583, `frontend/src/lib/liturgy.js` |
| Invitations, bulk messages or broadcasts to other people | **Yes, in-app only**: person invitations (single use, 7 days), staff and bishop appointment invitations, broadcasts and automations to parish audiences (capped by `BroadcastService.MaximumRecipients`), notifications. No external delivery. | `Api/Services/People/PersonInvitationService.cs`, `Api/Services/Communications/BroadcastService.cs`, `BroadcastAudience.cs` |
| Free trials or promotions | **No** trial or coupon logic in billing (searched trial, promo, coupon). Registration discounts exist for parish events. | `Api/Services/Billing/*`, `Api/Models/RegistrationDiscount.cs` |
| Public pages meant to rank in search | **Yes**: `public.html` (directory and parish pages) and `landing.html`. **Client-only**: React renders everything; parish pages are `public.html?parish=<id>` query strings; no `robots.txt`, `sitemap.xml`, canonical tags or structured data; unknown addresses return 200 with a client "lost" page. `index.html` is at `/`. | `frontend/*.html`, `frontend/src/public/App.jsx`, live HEAD checks |
| Large media served to the public | **No video or large downloads.** Largest files are photos up to 887 KB; parish photos up to 5 MB each are served by the API from Blob. | `frontend/public/assets/images/`, `Api/Services/Publishing/ParishProfileService.cs` |
| Biometrics (FaceID/TouchID/passkeys) | **Passkeys (WebAuthn)** with user verification required. Biometric data never leaves the device; the server stores the credential ID and public key. | `Api/Services/Accounts/PasskeyService.cs`, `Api/Identity/ParishUser.cs` (`AccountPasskey`), `frontend/src/portal/model/passkeys.js` |
| Content written or translated with AI | **Unverified.** No marker in the code or docs says any page text, Arabic translation or image was AI-made. The owner must answer (open question). | searched docs and frontend |

## 13. File ownership

One owner per path. "Handoff" means another agent that needs a change there sends a handoff to the owner in `hardening/handoffs/` instead of editing.

| Path | Owner | Handoffs expected from |
|---|---|---|
| `.gitignore`, `global.json`, `Directory.Build.props` | 02 | 08 |
| `Api/Configuration/*Options.cs`, `Api/Configuration/AzureConfiguration.cs` (configuration and environment validation) | 02 | 03 (Turnstile, Email, ExternalSignIn), 08 |
| Removing unreferenced code anywhere (for example the unused `Finance`/`RestrictedCases`/`Publishing` mappings, fictional records in `frontend/src/portal/model/data.js`) | 02 proposes; the path owner applies | — |
| `Api/Program.cs` | 03 | 04 (Kestrel/limits), 06 (headers affecting third parties), 08 (forwarded headers, telemetry) |
| `Api/Extensions/ServiceCollectionExtensions.cs` | 03 | 02 (options validation), 04 (Cosmos client options), 08 |
| `Api/Extensions/FrontendHostingExtensions.cs` (CSP, static headers) | 03 | 04 (static caching), 06 (third-party origins) |
| `Api/Authorization/**`, `Api/Identity/**`, `Api/Middleware/ApiExceptionHandler.cs`, `Api/Middleware/RecoverySessionMiddleware.cs` | 03 | — |
| `Api/Middleware/PublicCacheAttribute.cs` | 04 | 03 |
| `Api/Controllers/**` | 03 | 04 (paging), 07 n/a |
| `Api/Services/**` except the three below | 03 | 04 (query shape, after 03 merges), 06 (copy in notifications/certificates) |
| `Api/Services/Operations/InfrastructureReadiness.cs`, `Api/Services/Operations/DataSnapshotService.cs` | 08 | 03 |
| `Api/Services/Operations/CapabilityService.cs` | 03 | 06 (claims) |
| `Api/DTOs/**`, `Api/Validation/**` | 03 | — |
| `Api/Models/**` | 03 | 04 |
| `Api/Interfaces/Services/**` | 03 | — |
| `Api/Interfaces/Repositories/**`, `Api/Repositories/**`, `Api/Data/**`, `Api/Configuration/CosmosIndexContract.cs` | 04 | 03 |
| `Api/BackgroundJobs/**` | 04 | 03, 08 |
| `Api/Extensions/TelemetryExtensions.cs` | 08 | — |
| `Api/appsettings.json`, `Api/appsettings.Development.json`, `Api/Properties/launchSettings.json` | 08 | 02, 03 (`AllowedHosts`) |
| `Api/ParishLife.Api.http` | 09 | — |
| `ParishLife.AppHost/**`, `ParishLife.slnx` | 08 | — |
| `ParishLife.UnitTests/**`, `ParishLife.IntegrationTests/**`, `ParishLife.EndToEnd/**` | 09 | Any agent may add **new** test files for its own fixes; editing an existing test needs a handoff to 09. |
| `tools/Publish-ParishLife.ps1`, `tools/Initialize-Cosmos.ps1`, `tools/tests/**`, `tools/ParishLife.Maintenance/**` | 08 | 03 (bootstrap security), 04 (index changes) |
| `frontend/src/portal/model/api.js`, `frontend/src/portal/model/passkeys.js`, `frontend/src/lib/turnstile.js`, `frontend/src/lib/rich-text.js` | 03 | 05 |
| `frontend/src/portal/model/persist.js`, `store.js`, `data.js`, `member-data.js`, other `model/*.js`, `model/modules/**`, `frontend/src/public/api-data.js` | 04 | 03, 05 |
| `frontend/src/portal/shell/**`, `frontend/src/portal/ui/**`, `frontend/src/portal/shared/**`, `frontend/src/portal/features/**` | 05 | 03 (security-relevant UI, for example `Auth.jsx`), 04 (optimistic UI), 06 (copy, consent) |
| `frontend/src/public/**` except `api-data.js`; `frontend/src/reading/**`, `frontend/src/styles/**`, `frontend/src/lib/i18n.js`, `theme.js`, `search.js`, `liturgy.js`, `data/**` | 05 | 06 (copy, credits in `components/Chrome.jsx`, page titles) |
| `frontend/src/landing/**`, `frontend/src/lib/site-defaults.js`, `frontend/src/lib/beacon.js` | 06 | 05 (markup/styles) |
| `frontend/index.html`, `frontend/public.html`, `frontend/landing.html` (head: titles, meta, OG, fonts loading) | 06 | 03 (inline script/CSP), 05 (favicon) |
| `frontend/privacy.html`, `frontend/terms.html`, new `frontend/public/robots.txt`, `sitemap.xml`, `hardening/legal-drafts/**` | 06 | — |
| `frontend/public/assets/**`, `frontend/public/site.webmanifest`, `frontend/public/sw.js`, `frontend/DESIGN.md` | 05 | 04 (`sw.js` caching), 06 (licences) |
| `frontend/vite.config.js` | 04 | 08 |
| `frontend/scripts/**`, `frontend/e2e/**`, `frontend/playwright.config.mjs` | 09 | — |
| `frontend/.prettierrc.json`, `.prettierignore`, `.editorconfig`, `.gitattributes`, `.gitignore` (frontend) | 08 (`.gitignore`: 02) | — |
| `README.md`, `HANDOVER.md`, `frontend/README.md`, `frontend/ARCHITECTURE.md`, `docs/architecture/**`, `docs/azure-manual-setup/**`, `docs/operations/**` except below, `docs/REMAINING-WORK.md`, `docs/frontend-integration.md` | 08 | everyone (facts about their area) |
| `docs/operations/legal-pages.md`, `person-facts-and-consents.md`, `site-insights.md` | 06 | — |
| `docs/operations/account-*.md` | 03 | — |
| `docs/frontend-modules/**` | 05 | — |
| `docs/verification/**` | 09 | — |
| `docs/features/**`, `docs/continuation/**`, `CLAUDE.md`, `AGENTS.md` | integrator only (owner decisions are fixed) | everyone |
| `hardening/PROJECT_MAP.md` | 01 | everyone (send corrections as handoffs) |
| `hardening/reports/NN-*.md` | agent NN | — |
| `hardening/handoffs/**` | shared-additive | — |
| **Shared-additive** (add lines, never remove or rewrite others'): `Api/ParishLife.Api.csproj`, all `packages.lock.json`, `frontend/package.json`, `frontend/package-lock.json`, `docs/cosmos/containers.json` (the schema/index file; 04 owns index decisions), `.env.example` if one is created | — | 02 owns removals and upgrades of packages |
| AI/LLM files | 07 | none exist |

## 14. Open questions for the owner

1. **AI-made content.** Were any page texts, Arabic translations, photos (for example the `sanctuary/` and `valley/` images) or icons produced with AI? The repo does not say. (12, 06.21, 06.22)
2. **Photo licences.** Which images are Unsplash photos, which photographer(s), and which are your own or generated? Only one Unsplash profile is credited. (9)
3. **Age gate.** The terms say accounts are for 13 and over, but sign-up asks nothing about age. Do you want a "I am 13 or older" confirmation, a birth year, or nothing? (10, 06.25)
4. **Guest requests by a parent or guardian.** The public request form offers "Parent" and "Guardian" as the relationship. Is that compatible with your decision that parents do not act for children in the app? (10, decision 18)
5. **Google Fonts.** The portal and product page load fonts from Google before any consent, while the public site self-hosts. Self-host them everywhere? (7)
6. **Search visibility.** Should parish pages rank in Google? Today they are client-rendered `public.html?parish=<id>` pages with no sitemap or robots file, and `/` is the sign-in page. (12)
7. **Application Insights retention.** The privacy page says technical logs are deleted after 90 days. Please confirm the setting in Azure. (6)
8. **Backups.** Please confirm Cosmos continuous backup (7 days) and Blob soft delete (30 days) are on, and answer question 16 (schedule, RPO/RTO, custody). (11)
9. **Monitoring alerts.** Are there any Azure alert rules or availability tests? None are recorded. (11)
10. **Business identity.** Legal business name, registered country, address and registration numbers are still "Not provided"; the product page has a WhatsApp contact number. Whose number is it, and should it be on the site? (7, PROJECT_CONTEXT)
11. **Diaspora users.** Will parishes outside Lebanon (EU, US, Australia) use it? This decides GDPR/CCPA scope for the legal agent.
12. **Forgotten password.** There is no "forgot password" flow (only change and add password, and lost-authenticator review). Is that intended for the pilot? (12, 03 B15)
13. **Staging.** Question 26 is still open; without a staging database, live checks can only be read-only.

## 15. Urgent observations

One line each, no fixes. Owner agent in brackets.

1. Microsoft `id_token` is decoded without signature validation (TLS-only trust per OIDC 3.1.3.7); confirm this is acceptable (`Api/Identity/ExternalIdentityClaims.cs` lines 58–62). [03]
2. Rate limiting keys on `Connection.RemoteIpAddress` with no forwarded-headers handling in code; if App Service passes its front-end address, every visitor shares one bucket. [03, 08]
3. User-generated website HTML is sanitized only in the browser (`lib/rich-text.js`); the API stores raw HTML. [03]
4. Any signed-in account can read the full OpenAPI document at `/openapi/v1.json`. [03]
5. `Server: Kestrel` header and HSTS of only 30 days without `includeSubDomains` (seen live). [03]
6. No CI at all: nothing runs the 547 tests or the frontend checks before a deploy. [08]
7. `GET /api/capabilities` hard-codes External sign-in and Bot check as "Not configured" although both are live (`Api/Services/Operations/CapabilityService.cs`). [03, 06]
8. No `robots.txt`/`sitemap.xml`; unknown public addresses return 200. [06]
9. Google Fonts load before consent on the portal and product page, while the privacy page lists Google Fonts. [06]
10. No secret was found by `gitleaks git` over the full history (21 November). Public identifiers in docs (client IDs, managed identity IDs, tenant ID, Turnstile site key, App Service host) are not secrets but are worth a look. [02]

## 16. Docs and code that disagree (code wins)

| Doc says | Code says | Owner to fix the doc |
|---|---|---|
| `CLAUDE.md`, `AGENTS.md`, `README.md`: "Frontend integration is deferred"; README titled "ParishLife backend", "331 tests", publish "only the API". | The frontend is integrated, served from `wwwroot` (`FrontendHostingExtensions.cs`, `PublishFrontend` target); about 547 tests. | 08 (README); `CLAUDE.md`/`AGENTS.md` are owner files |
| `HANDOVER.md` summary: signed-in end-to-end tests "not started". | `frontend/e2e/portal.spec.mjs` and `ParishLife.EndToEnd` exist (the same file later says they run since 17 November). | 08 |
| `docs/cosmos/containers.json` lists 5 containers. | `RecordTransactions` also maps areas to `Finance`, `RestrictedCases`, `Publishing` (unused). | 02/04 |
| `docs/operations/legal-pages.md` and the privacy page: "Technical logs deleted after 90 days", "Backups 7 days point-in-time, deleted files 30 days". | Not in code; Azure settings, **Unverified**. | 06/08 |
| `AGENTS.md`: one public type per file. | Six controller files hold two controller classes (`Requests/RequestsController.cs`, `Publishing/WebsiteController.cs`, `Publishing/HomepageController.cs`, `Documents/RequestLettersController.cs`, `Documents/DocumentSignaturesController.cs`, `Communications/CommunicationsController.cs`); `Identity/ParishUser.cs`, `Data/Cosmos/DocumentDatabase.cs`, `Data/Cosmos/Documents.cs`, `Configuration/CosmosOptions.cs` hold several types. | 02 (report only; moving types is a refactor) |
| `docs/frontend-modules/README.md`: "Never show a demo record". | `frontend/src/portal/model/data.js` ships fictional people and a fictional parish in the bundle as view-model shapes; `persist.js` empties them before showing API data. | 02/04 |
| `frontend/src/lib/data/lebanon-map.js` names `docs/tools/build_lebanon_map.py` and `docs/homepage-design.md`. | Neither file exists. | 05 |
| `CapabilityService` capability list. | Says External sign-in and Bot check are not configured; both are live. | 03 |
| `PROJECT_CONTEXT.md`: SDK pinned to 10.0.401. | Correct; `rollForward: latestPatch`, so 10.0.404 satisfies it. | — |
