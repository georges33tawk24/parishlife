# ParishLife backend

C#/.NET 10 backend with one production API project, organized into understandable folders. The current stage covers the backend/Azure foundation, local Aspire monitoring, MiniDevOps-style DTO/model classes, account security, first bishop, factual jurisdiction, selected staff capacities, calendar/facility/reservations, and ministry membership/meetings/attendance. Frontend integration is deferred. The full product is still under implementation; see `docs/architecture/backend-foundation.md` and the feature coverage register.

## Projects

- `ParishLife.Api`: controllers, services, repositories, interfaces, models, DTOs, Identity, authorization, Cosmos, Azure configuration, and background jobs.
- `ParishLife.AppHost`: local Aspire dashboard/orchestration. It starts the API, monitors its dependency readiness, and links to the configured Azure endpoints; it does not provision them.
- `ParishLife.UnitTests`: isolated rule/persistence checks.
- `ParishLife.IntegrationTests`: HTTP, real local authentication, and configuration checks. Local tests do not establish Cosmos service guarantees.
- `tools/ParishLife.Maintenance`: explicit private operator commands; not part of the public API deployment.

Each created/rewritten code file starts with its purpose and main functions. `AGENTS.md` preserves that convention for future work.

Account security now includes staged authenticator enrollment, protected one-use recovery codes, restricted recovery sign-in, and independently reviewed lost-device reset. See `docs/operations/account-mfa.md` for endpoints, proof requirements, expiry, and the still-incomplete all-factors-lost/password-recovery cases.

DTOs use one `*Dto` class per file under feature folders, with ordinary properties and input validation. Models use one class per file directly under `Models`, with separate `Models/Enums`. See `docs/architecture/dto-model-conventions.md`. The first-bishop API and its remaining governance dependencies are documented in `docs/operations/first-bishop-appointment.md`.

The bishop can invite Archdiocese Admins and parish priests through dated, accepted, explicitly scoped appointments. Head designation has independent periods/history and cannot overlap another reserved head period. Factual parish jurisdiction is separate from commercial association. Operational priest requests select one appointment using `X-ParishLife-Appointment`; permissions do not combine across capacities. See `docs/operations/staff-appointments.md` for routes, proofs, limits and remaining governance work.

Manual calendar drafts/publication, privacy-safe busy views, local-time recurring drafts, room/space configuration, buffered availability and durable office bookings are now integrated. Reservations remain pending until the worker confirms every resource; conflicts/cancellation use recoverable compensation. See `docs/operations/calendar-and-reservations.md`, including the required query-index review and remaining clergy/source/rental/notification work.

Ministry lifecycle and safe public/member projections, reviewed identity links and join/private-departure decisions, dated leadership/duties, source-owned meetings/RSVP, protected private planning reasons and occurrence-date attendance are now wired. Attendance snapshots are resumable and do not infer absence from missing data. See [ministries and attendance](docs/operations/ministries-and-attendance.md) for routes, permissions, storage and remaining acceptance.

Ministry formation (S19.09/WF65) now has priest-approved program revisions with prerequisite milestones, pinned member enrollments, recorded evidence, independent qualified review, clergy sign-off where a milestone requires it, returned information, reopening and append-only history. Completion is never derived from attendance and is not a sacramental certificate. Ministries also have counted belongings with loans and stock reconciliation, and volunteering with coordinator-confirmed assignments, overlap/capacity checks and independently reviewed hours. See [ministries and attendance](docs/operations/ministries-and-attendance.md).

Event registration (policy/forms, office and member self-registration, capacity/waitlist/offers, receipts and independently decided refunds, assigned door arrival and authorized pickup) is wired and tested. See [event registrations](docs/operations/event-registrations.md). The [10 November verification record](docs/verification/backend-2026-11-10.md) lists the current 220-test result.

Personal account display/language/appearance now has safe preview/reset and conditional saves, separately from sign-in and official Person facts. [Account-private notes/tasks](docs/operations/personal-workspace.md) provide protected own drafts/history and task lifecycle without administrator fallback; [profile operations](docs/operations/account-profile.md) describe the personal settings contract. Reviewed guest attendance remains separate from member denominators and grants no ministry membership.

Later 10 November slices, each with a runbook: [service plans and music](docs/operations/service-plans-and-music.md), [households and relationships](docs/operations/households-and-relationships.md), [equipment and facility issues](docs/operations/equipment-and-facility-issues.md), [requests and guest association](docs/operations/requests.md), [sacraments, certificates and anniversaries](docs/operations/sacraments.md), [pastoral care, concerns and incidents](docs/operations/pastoral-care.md), [communications](docs/operations/communications.md), [finance](docs/operations/finance.md), [membership, corrections and invitations](docs/operations/membership-and-profile-corrections.md), [schedules and rentals](docs/operations/calendar-and-reservations.md), [people search, export, duplicates and import](docs/operations/people-search-and-export.md), [person facts, consents and data closure](docs/operations/person-facts-and-consents.md), [website](docs/operations/website.md), [office coverage and parish status](docs/operations/staff-appointments.md) and [work overview and capabilities](docs/operations/work-overview.md). See the [verification record](docs/verification/backend-2026-11-10.md); 124 of 149 cards are partial and 25 not started.

## Build and verify

From this directory, using a serviced .NET 10 SDK/runtime:

```powershell
dotnet restore ParishLife.slnx --locked-mode
dotnet build ParishLife.slnx -c Release --no-restore
dotnet test ParishLife.slnx -c Release --no-build --no-restore
```

The [latest 9 November verification record](docs/verification/backend-2026-11-09-personal-and-guests.md) records 196 passing local tests, a clean Release build, API-only publish checks and live Azure checks still outstanding. The [169-test record](docs/verification/backend-2026-11-09.md) is the earlier checkpoint. These results do not establish whole-product completion.

## Run with Aspire

```powershell
dotnet run --project ParishLife.AppHost
```

The launcher prints a private dashboard login URL. Keep its token private. The AppHost uses the Aspire CLI bundle; the supported CLI must be installed. No Docker database, Azure emulator, frontend, or new Azure resource is started.

By default AppHost selects the configured Azure Cosmos service using your developer credentials and disables background jobs. `/health/live` reports the HTTP process; `/health/ready` reports required dependency metadata access. Azure access failures must remain visible as unhealthy, not be described as successful integration. Azure endpoint links are configuration references; the API readiness probe reports actual dependency access rather than inventing healthy Azure resources.

For deliberate local runner testing, set `Backend__RunBackgroundJobs=true` before launching AppHost, then clear it afterwards. Queued reservations remain pending while the runner is disabled. The API worker checks final configuration; AppHost startup still creates no business records. Queries use reviewed `TenantControl` and personal-workspace `Accounts` metadata index paths; readiness checks these policies as well as partition/TTL metadata. No Azure index changes are applied at startup.

For isolated local development only, you can set `Backend__UseAzure=false` before launching AppHost, then clear that variable afterwards. This uses local documents and separate development Data Protection keys. It is not the production provider or proof of Azure connectivity. Never point automated write tests at production.

## Existing Azure resources

The configuration targets `cosmos-parishlife`, database `ParishLife`, `storageparishlife`, the versionless `parishlife-data-protection` key in `keyvault-parishlife`, and the supplied user-assigned identity. Details are in `docs/azure-manual-setup/production.md`.

Local Azure checks use your signed-in developer/operator credentials. App Service uses the configured user-assigned managed identity. An `az login` on your machine does not test App Service's identity. No database/container creation, schema initializer, or administrator seed runs at API startup.

```powershell
dotnet run --project tools/ParishLife.Maintenance -- check-infrastructure
```

This checks existing metadata without writing business data. It does not prove writes, key wrap/unwrap, authentication across a deployed restart, or monitoring ingestion.

## Only two initial accounts

The only allowed bootstrap usernames are `colinsleiman` and `georgestawk`. No email, church, diocese, clergy, member, plan, subscription, or financial record is fabricated.

```powershell
dotnet run --project tools/ParishLife.Maintenance -- bootstrap-superadmins
```

Run this only as the authorized operator against the intended environment. It requires private interactive password/MFA input and explicit confirmation. See `docs/operations/initial-setup.md`. The command has not been run automatically.

## Publishing

Keep tests in the repository after launch. Publish only the API and deploy only that output:

```powershell
dotnet publish ParishLife.Api/ParishLife.Api.csproj -c Release -p:UseAppHost=false -o artifacts/api
```

Do not deploy the whole repository, AppHost, test projects, fixtures, private maintenance executable, or local data. Publishing creates local artifacts; it does not deploy to Azure. Live deployment is a separate step after the appropriate verification.
