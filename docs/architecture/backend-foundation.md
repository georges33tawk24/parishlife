# Backend foundation and remaining work

The owner authorized implementation on 8 November 2026, replacing the earlier investigation-only boundary. Subsequent instructions defer all frontend integration and explicitly request an Aspire AppHost.

## Structure

`ParishLife.Api` contains the production backend. Controllers call services; services apply rules and authorization and call feature repositories. Repository and integration contracts live in `Interfaces`. Models, DTOs, Cosmos mechanics, Identity, configuration, and background work are folders in that API assembly.

`ParishLife.AppHost` launches the API and dashboard locally. It references the API for orchestration, does not contain business rules, and does not create Azure services. Configured Azure endpoints appear as reference links on the API resource. They are not modelled as synthetic healthy services; API readiness checks actual dependency metadata access.

The two existing test projects remain verification tools. The private maintenance executable shares the API's implementations but is not deployed into the public API artifact. The API references none of these tools.

The former Application/Domain/Infrastructure project directories and original source were preserved outside this repository before consolidation. `consolidation-map.json` records the source mapping. No existing Azure resources or production data were replaced.

## Configuration and actual checks

The API is configured for the supplied Cosmos account/database, storage account, Key Vault key, and user-assigned identity. Configuration is validated before required clients are used. Production rejects the local document provider and emulator credentials.

The private `data-protection/keyring.xml` location is derived from the supplied setup contract and must match the actual container/blob path. Data Protection uses the versionless Key Vault key and a stable production application name. Development keys use a separate application name and local key directory; do not mix development and production authentication material.

The read-only readiness probe checks Cosmos consistency and the five existing container partition/TTL contracts, private Blob container metadata, and enabled Key Vault key metadata. Results are cached for 30 seconds and each check sequence is bounded. It does not create containers, write/delete probe records, prove Blob write access or key wrap/unwrap, or prove telemetry ingestion. Those capabilities need separate controlled verification.

The monitoring exporter activates when `APPLICATIONINSIGHTS_CONNECTION_STRING` is set. Aspire injects the OTLP destination for local traces/metrics/logs. Do not put provider credentials or real parish records into telemetry.

## Initial state

API and AppHost startup create no users, organizations, churches, plans, subscriptions, or other business records. The explicit operator command supports exactly `colinsleiman` and `georgestawk`. Their passwords and authenticator secrets are entered privately by their owners; the command does not invent email addresses or print secrets.

The bootstrap is resumable/idempotent and validates the exact usernames and deterministic bootstrap identities. MFA is verified before Super Admin privilege is granted. Existing unexpected data/accounts are not automatically deleted or demoted.

## Acceptance boundaries

This is the backend/Azure/Aspire foundation. The original business services were preserved and compilation errors corrected. Their existence is not full acceptance of every ministry, registration, sacramental, financial, or other workflow. Keep the existing coverage register and supplied questionnaire as the complete backlog; update each feature only with evidence of the actual implementation and verification.

Frontend adapters, React components, and the frontend branch have not been changed. There is no claim of frontend integration or browser acceptance. The next product slices remain the required organization/appointment foundations followed by calendar/reservations and ministries, with all other retained features tracked through completion.

## Later implementation updates

DTOs/models follow the inspected MiniDevOps class/file layout; see dto-model-conventions.md. The first-bishop slice uses the existing TenantControl archdiocese partition; see ../operations/first-bishop-appointment.md for behavior, policy assumptions and remaining dependencies. Test-host document/key-ring configuration resolves final settings and asserts temporary paths. The full product remains incomplete.

The account MFA slice now adds staged enrollment/rotation, protected recovery codes, restricted sessions, fresh-proof independent reset approval, session invalidation, and typed OpenAPI. See ../operations/account-mfa.md for the exact flow and incomplete recovery cases.

The organization slice now adds factual jurisdiction independent of commercial association, bishop-authorized Archdiocese Admin/priest invitations, personal discovery and acceptance, dated duties, explicit acting-capacity authorization, suspension/revocation/review history, and head periods with conditional parish fences. See ../operations/staff-appointments.md for exact behavior and remaining succession, official-profile, handover and live-service boundaries. Every new appointment document uses the existing TenantControl container; no new Azure infrastructure was provisioned.

The calendar/reservation slice now uses separate CalendarService, FacilityService, ReservationService and ReservationProcessor classes in that same API. Resource partitions use the existing TenantControl container, not an unprovisioned ResourceCalendars container. Manual/source boundaries, redaction, real queued states, role-bound worker rechecks, exclusive-room conflicts, conditional resource guards and compensation are implemented; see ../operations/calendar-and-reservations.md. Query index paths are a reviewed source contract, not a live Azure update. Broader calendar, clergy, ministry, rental, messaging and other retained workflows are not declared complete.
