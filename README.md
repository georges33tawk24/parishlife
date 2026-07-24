# ParishLive

A multi-tenant management platform for a Catholic **archdiocese and its parishes** — members, groups and committees, facility reservations with an approval workflow, events, notices, and an audit trail. Built for a Levantine/Maronite context (e.g. the Archdiocese of Beirut) and **fully bilingual in English and Arabic, with right-to-left (RTL) support**.

Final-year project. ASP.NET Core (Razor Pages) on .NET 10, clean architecture, and a bespoke design system.

---

## Table of contents

- [Highlights](#highlights)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Multi-tenancy & security](#multi-tenancy--security)
- [Feature modules](#feature-modules)
- [Design system — "Sacristy Ledger"](#design-system--sacristy-ledger)
- [Internationalisation (EN / AR / RTL)](#internationalisation-en--ar--rtl)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Demo accounts](#demo-accounts)
- [Testing](#testing)
- [Database](#database)
- [Roadmap](#roadmap)

---

## Highlights

- **Multi-tenant by design** — one archdiocese, many parishes. A parish user sees only their parish; an archdiocese admin sees across the organisation. Isolation is enforced at the data layer, not just the UI.
- **Configurable approval workflow** — reservations move through a database-driven state machine (submit → secretary review → forward to priest → approve/reject). Approval steps are *data*, so a parish can add levels without code changes.
- **Configurable role-based access control (RBAC)** — permissions map to roles in the database. A secretary can *review* a reservation but not *approve* it — enforced by data, not hard-coded rules.
- **Audit trail** — important actions (reservation decisions, notice publications) are recorded with who/what/when, viewable only by authorised roles.
- **Bilingual & RTL** — every user-facing string is localised; the whole interface mirrors correctly for Arabic.
- **Tested** — an integration test suite covers tenant isolation, the workflow engine, RBAC enforcement, and each feature module.

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | .NET 10 |
| Web | ASP.NET Core **Razor Pages** |
| Data access | Entity Framework Core |
| Database | **SQLite** (development & tests); portable to PostgreSQL for production |
| Identity | ASP.NET Core Identity |
| Localisation | `.resx` resources + `IStringLocalizer` |
| Testing | xUnit + `WebApplicationFactory` |
| Styling | Hand-authored CSS design system (no UI framework) |

## Architecture

The solution follows a **clean, layered architecture** with dependencies pointing inward:

```
ParishLive.Web            ← Razor Pages, layout, CSS, i18n, DI, auth pipeline
   └── ParishLive.Infrastructure   ← EF Core DbContext, services, migrations, Identity, seeding
          └── ParishLive.Application   ← use-case interfaces + DTOs (no framework dependencies)
                 └── ParishLive.Domain    ← entities, enums, value rules (the core, dependency-free)
```

- **Domain** — encapsulated DDD-style entities: private setters, private constructors, static `Create()` factories, `Guard` validation, and behaviour methods (e.g. `Reservation.ApplyTransition`). No entity can be constructed into an invalid state.
- **Application** — the use-case contracts (`IReservationService`, `IEventService`, `INoticeService`, `IAuditService`, `IPermissionService`) and the DTOs they exchange. Framework-agnostic.
- **Infrastructure** — EF Core `AppDbContext` (where tenant isolation lives), the concrete service implementations, database migrations, the demo data seeder, and ASP.NET Core Identity storage.
- **Web** — Razor Pages, the app shell and design system, the localisation setup, dependency injection, and the claims/tenant authentication pipeline.

## Multi-tenancy & security

Tenant isolation is enforced at the data layer as a **security backstop**, so a bug in a page can't leak another parish's data:

1. **EF Core global query filters** — every tenant-scoped entity is automatically filtered to the signed-in user's parish(es) (or the whole organisation for an archdiocese admin) on *reads*.
2. **A `SaveChanges` guard** (the "WITH CHECK" equivalent) — on *writes*, it stamps the correct `OrgId`/`ParishId` on new rows and **refuses any insert or update into a parish the user does not belong to**. A client-supplied parish id is never trusted.

The tenant context is resolved per request from the signed-in user's claims. A claims-transformation step enriches the principal with organisation, parish, role, and display-name claims derived from the user's memberships; a `ClaimsTenantContext` reads those claims to drive the filters and guard above.

## Feature modules

- **Identity & memberships** — sign in, and a user's memberships determine their organisation, parish(es), and system role (priest, secretary, member, archdiocese admin).
- **People** — a parish member directory and a contextual profile showing a person's current *and* past group/committee roles (with term dates).
- **Groups & committees** — parish groups (youth, choir, fundraising, …) with bilingual committee roles and membership terms.
- **Reservations** — facility booking requests that flow through the configurable approval workflow; a live approval screen surfaces exactly the actions the current user is permitted to take, enforces required notes, and shows the full decision history.
- **Events & calendar** — an events list with registration (capacity-aware and idempotent) and a server-rendered month calendar.
- **Notices** — parish announcements with priority and audience; publishing requires the `notices.publish` permission.
- **Audit log** — a tenant-scoped ledger of important actions, readable only with the `audit.view` permission.

## Design system — "Sacristy Ledger"

A bespoke visual identity, deliberately warm and church-grounded rather than generic corporate SaaS:

- A deep **sacristy-green "ledger spine"** navigation sidebar (dark in both themes).
- Warm limestone "stone page" surfaces with register-style hairline rules.
- A single brass accent — the **octagonal baptismal star** — used with restraint.
- Full **light and dark themes**, switched via a token system (`data-theme` + `prefers-color-scheme`).
- Built with CSS custom properties and logical properties (so it mirrors cleanly for RTL). No UI framework — the whole system lives in one stylesheet.

## Internationalisation (EN / AR / RTL)

- Every visible string flows through `IStringLocalizer` backed by `.resx` resource files (English + Arabic).
- The document `dir` and `lang` follow the active culture; layout uses CSS logical properties so the entire interface — including the navigation spine and data tables — mirrors correctly in Arabic.
- A language toggle switches culture via a cookie and returns the user to the same page.

## Project structure

```
ParishLive.slnx
├── src/
│   ├── ParishLive.Domain/          # entities, enums, constants, base types (Guard, TenantEntity, …)
│   ├── ParishLive.Application/     # use-case interfaces + DTOs, authorization contracts
│   ├── ParishLive.Infrastructure/  # AppDbContext (tenancy), services, migrations, seeder, Identity
│   └── ParishLive.Web/             # Razor Pages, _Layout, wwwroot/css design system, Resources (i18n)
└── tests/
    └── ParishLive.IntegrationTests/ # xUnit + WebApplicationFactory integration tests
```

## Getting started

**Prerequisites:** the [.NET 10 SDK](https://dotnet.microsoft.com/download).

```bash
# from the repository root
dotnet run --project src/ParishLive.Web
```

On first run the app **applies migrations and seeds demo data automatically**, then prints the local URL to the console. Open it in a browser and sign in with one of the [demo accounts](#demo-accounts).

To re-seed from scratch, stop the app and delete the SQLite database file it created (`parishlive.db`) in the run directory; it will be recreated on the next start.

## Demo accounts

All seeded users share the password **`Passw0rd!`**.

| Email | Role | Notes |
|---|---|---|
| `priest.a@parishlive.test` | Priest (St. George Parish) | Full parish control; can approve reservations, view the audit log |
| `secretary.a@parishlive.test` | Secretary (St. George Parish) | Can review & forward reservations and publish notices, but **cannot approve** |
| `rita.khoury@parishlive.test` | Member (St. George Parish) | Holds several current group roles plus one past committee term |
| `priest.b@parishlive.test` | Priest (St. Elias Parish) | A second parish — demonstrates tenant isolation |

## Testing

```bash
dotnet test
```

The integration suite runs the real application against an in-memory SQLite database (via `WebApplicationFactory`) and covers, among other things:

- **Tenant isolation** — Parish A cannot see Parish B's data (verified at both the data and HTTP levels).
- **The workflow engine** — reservations transition only along defined, permitted paths; required notes are enforced.
- **RBAC** — a secretary is blocked from approving; a member is blocked from publishing notices or viewing the audit log.
- **Each feature module** — groups/profiles, events, notices, reservations, and the audit trail.

## Database

- **Development & tests** use **SQLite** (`Data Source=parishlive.db`), created and migrated automatically on startup.
- The code is written to be portable to **PostgreSQL** for production (e.g. ordering is performed in a database-agnostic way to avoid SQLite-specific limitations).

## Roadmap

Planned / in-progress work:

- Complete create/edit (CRUD) flows for members, groups, venues, and events.
- Documents & file storage.
- Reports and exports.
- Messaging / bulk email.
- A public-facing visitor site.
- Production hardening: wire up PostgreSQL per environment, structured logging, health checks, and notifications.
