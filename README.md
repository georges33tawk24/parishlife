# ParishLife

ParishLife is an ASP.NET Core .NET 10 Razor Pages application with EF Core, SQLite and ASP.NET Core Identity. Project/namespace names retain `ParishLive` for compatibility.

This branch implements core reviewed workflows on GitHub main. **The complete requirements pack is not yet implemented and this is not a release-ready application.** Missing software is tracked separately from missing parish facts, credentials, domain approvals and human validation.

- [Implementation checklist: all 436 question IDs](docs/implementation/checklist.md)
- [All 30 scenario reviews](docs/implementation/scenario-review.md)
- [Executed checks and limitations](docs/implementation/verification.md)
- [Reviewed document index](docs/ux-discovery/reviewed-answers/README.md)
- [Open factual inputs and competent approvals](docs/ux-discovery/reviewed-answers/open-inputs-and-conflicts.md)

The reviewed README is the source-document index. Its coverage report describes historical documentation checks, not runtime implementation. Earlier source drafts are retained as provenance; embedded authoring prompts and unrelated material are not implementation instructions.

## Implemented core

The app has a combined Home, explicit acting assignment and tab-specific scope, live role refresh/revocation, individual dated staff appointments, optional secretaries, parish setup, authenticated/guest request intake, server drafts, evidence review, basic sacramental state transitions, official-source certificate review/release, ministry applications, confidential concerns, private notes, finance/counting and trilingual public content drafts.

A secretary's genuine prior case-specific priest instruction takes effect immediately at allowed stages. Restricted history stores the actual recorder and priest authority separately. Personal priest signing, bishop review, financial review and verified recipient release remain distinct. A household, follow, roster membership or administrative rank does not imply these permissions.

Transactions bind the operation ID, actor, payload and saved result. Retry the same operation after an uncertain response; use Recovery to check the committed result. Approved official facts and posted ledger/history records cannot be silently overwritten. USD cents and whole LBP remain separate original currencies. No online payment, email/SMS delivery, map, official signature, bank integration or backup success is simulated.

## Run locally

Install the .NET 10 SDK, then run from the repository root:

```powershell
dotnet restore ParishLive.slnx
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --project src/ParishLive.Web --no-launch-profile --urls http://127.0.0.1:5209
```

Development and integration tests apply migrations and seed fictional demonstration data. New demo accounts use the passphrase `Demonstration only passphrase!`. Existing development databases keep their existing credentials. Demo usernames are `priest.a@parishlive.test`, `priest.b@parishlive.test`, `secretary.a@parishlive.test` and `rita.khoury@parishlive.test`. Demo clergy/parish names are examples, not verified launch facts. Production does not seed demo accounts.

The SQLite connection defaults to `Data Source=parishlive.db` relative to the web content root. Override `ConnectionStrings__Default` for another database. Keep database files and credentials outside Git. Migrations preserve main's existing appointments and resource availability; existing parishes stay private until actual public setup is approved. Existing event consent is labeled unreviewed.

In other environments, pending migrations stop startup unless `Database__ApplyMigrations=true` is explicitly configured. Review the migration and take an operator-controlled backup/restore-tested recovery point before any approved deployment. No production migration or deployment has been performed by this work.

## Actual configuration and first administrator

Public signup remains unavailable until `Signup__MinimumAge` and `Signup__AgePolicyApprovalReference` contain the competent owner's actual approved rule. There is no inferred legal or guardian policy. New passwords are 16–200 characters, with a small local common-password denylist; this is not a complete compromised-credential service. Legacy sign-in remains possible with the existing password.

For a new empty installation, the one-time `Bootstrap__Run=true` path requires `Bootstrap__Email`, `Bootstrap__DisplayName`, `Bootstrap__AuthorityReference` and a private `PARISHLIFE_BOOTSTRAP_PASSWORD` environment value. It creates one individually controlled Super Admin and exits. Apply reviewed migrations explicitly in non-development environments. Clear the bootstrap values before starting normally. The process refuses a second initial bootstrap. No fixed production identity or credential is supplied.

Administration offers appointments that the individual must accept; they expire after the reviewed proposed seven-day invitation window and become effective only within their appointment dates. The first administrator can establish a second individual Super Admin; later protected appointments require a distinct Super Admin's review, password reauthentication and an actually configured Identity authenticator. Full privileged MFA and recovery coverage remain open release work.

Readiness records actual religious requirements/register series, official-template approval, finance approval, safeguarding lead and guest-intake permissions through their eligible role paths. A stored approval reference must correspond to a real competent decision; it is not itself manufactured approval. Unknown official wording, fees, identities, contacts, safety routes and retention rules remain unavailable/manual dependencies.

## Verification

```powershell
dotnet test ParishLive.slnx --configuration Release
node tools/update-resources.mjs
node tools/check-localization.mjs
node tools/build-implementation-checklist.mjs
node tools/check-implementation.mjs
```

The integration suite covers tenant/role boundaries, state changes, actual financial movements, independent counting, operation retries, two independent SQLite connections competing for one place, main-data migration, guest association, document return/recipient access, confidential access and EN/FR/AR document direction. These checks do not certify complete A01–A30 acceptance.

Resources include English, French and Arabic with RTL. Literal UI/error-key coverage and selected browser flows were checked; full Identity Manage localization, language/domain review, keyboard/screen-reader/device/physical-print validation remain open. Screenshots and exact evidence are in the verification report.

## Architecture and remaining scope

Domain entities are in `src/ParishLive.Domain`; use-case contracts in `src/ParishLive.Application`; EF/Identity/operation services in `src/ParishLive.Infrastructure`; Razor Pages, localized resources and UI behavior in `src/ParishLive.Web`. Existing main functionality is adapted in place. No colin application code is imported.

Significant remaining software includes full people/household/import/merge workflows, official amendments and complete sacrament forms, shared clergy/resource scheduling, plans/music, meeting attendance and loans, volunteer rotas, transport/fees/material event changes, equipment/maintenance, giving reclassification/statements, reconciliation/period close, Inbox/prayers, complete independent concern escalation, workflow builder, bundle/sponsorship changes and retention/data-request workflows. The checklist retains these requirements; an unavailable-state message is not counted as their implementation.

Changes are prepared on `codex/reviewed-requirements` for a draft pull request targeting `main`. Merge and deployment require explicit user approval.
