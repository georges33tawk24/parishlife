# Calendar, facilities and reservations

Implemented slice, 8 November 2026. This is backend work in the single API project. Frontend integration remains deferred. Startup creates no churches, calendar entries, facilities, prices, plans, accounts or reservations. Operator bootstrap still permits only `colinsleiman` and `georgestawk` with their privately supplied credentials.

## Access and actual state

Operational priest requests select one accepted appointment using `X-ParishLife-Appointment`. Its explicit duties, dates, current account/MFA and parish jurisdiction are checked; permissions do not combine with ordinary grants. Existing explicit grant-based work remains available without that header. Paid coverage is a separate requirement: calendar creation/confirmation/publication needs `core`, and new room requests/configuration/allocation needs `facilities`. Coverage must come from the actual paid-invoice procedure, never a seed or a client assertion.

`schedule.read`, `schedule.manage`, `schedule.publish` and `facilities.manage` remain distinct duties. Existing calendar detail and reservation reads, cancellation and unpublication remain available for authorized cleanup without an active module purchase. This does not restore an expired/revoked role or permit new allocations. Cancelled/declined bookings and old authorship are retained. A confirmed booking that has started requires reviewed correction rather than rewriting historical facts through ordinary cancellation.

Calendar confirmation and room confirmation are separate states. A calendar entry does not itself reserve a room. A reservation request is `Requested`; an accepted office decision queues `Allocating`, with HTTP 202. Only completed allocation work makes it `Confirmed`. Cancellation of allocated work stays `Cancelling` until its resource releases finish. Clients must read the current record instead of treating submission or HTTP 202 as confirmation. A replay reports the current state.

## API routes

All protected routes below begin with `/api/parishes/{parishId}`. Use real UUIDs, explicit UTC instants, the relevant current `Version`, and a new `OperationId` for each new command. Reuse the same operation UUID and unchanged input only when checking/retrying that command's outcome.

| Route | Purpose |
| --- | --- |
| `POST /calendar/events`, `PUT /calendar/events/{id}` | Create or edit a manual draft with `SaveEventDto` |
| `GET /calendar/events/{id}` | Read the authorized detail/current version |
| `GET /calendar/events?start=...&end=...&size=25&cursor=...` | Read a bounded, paged calendar window |
| `POST /calendar/events/{id}/actions` | `confirm`, `publish`, `unpublish` or `cancel` with `EventActionDto` |
| `POST /calendar/series` | Create bounded local-wall-time recurring drafts with `CreateSeriesDto` |
| `POST /facilities`, `PUT /facilities/{id}` | Create/edit actual room or space metadata with `SaveFacilityDto` |
| `GET /facilities`, `GET /facilities/{id}` | Read scoped facilities and versions |
| `POST /facilities/{id}/status` | Set `Serviceable` or `OutOfService` with version and actual reason |
| `GET /facilities/{id}/availability?start=...&end=...` | Read only busy/unavailable intervals |
| `POST /reservations` | Request the exact future period of a manual draft event with `ReserveDto` |
| `GET /reservations/{id}`, `GET /reservations?start=...&end=...` | Read actual booking state and paged windows |
| `POST /reservations/{id}/actions` | `confirm`, `decline` or `cancel` with `ReservationActionDto` |

The anonymous route is `GET /api/public/parishes/{parishId}/calendar?start=...&end=...`. It exposes only explicitly published manual public parish activities in a verified parish. Drafts, private/group entries, unreviewed legacy source records and account/customer identifiers are excluded. Public cancellation remains visible with `Status: Cancelled` until explicit unpublication. This JSON endpoint is not a completed parish-profile, directory, ICS feed or frontend integration.

## Drafts, recurrence and privacy

Manual kinds are `ParishActivity`, `Appointment` and `ResourceBlock`. Choose `Public`, `Parish` or `Private` explicitly; appointments/resource blocks require `Private`. Generic calendar input cannot forge a sacramental record, ministry/source link or clergy duty. Those require their owning reviewed workflows. Ministry membership audiences and official liturgical calendars remain further work; no feasts, rites or approved official names are inferred.

Edits require a draft and no unresolved linked reservations. Confirmation waits for linked reservations to be confirmed, cancelled or declined. Cancellation waits for their releases. Confirmed/started/source-owned amendments require their reviewed workflow. Public publication and unpublication need the separate publishing permission. A publish action makes the supported JSON projection available; it does not send messages or imply delivery.

Private details are available only to the permitted creator in this slice. Other scoped readers see a redacted interval: no subject, actual category, author, source/group link, description, decision reason or writable version. Redacted draft status is `Tentative`, confirmed status is `Busy`, and cancelled status remains `Cancelled`; a cancellation never masquerades as an occupied period. Private booking views also omit customer, terms, event link and work details. Availability exposes only intervals/status, including configured buffers. Free-form event/reservation decision reasons remain on their protected records, outside the general audit entry and anonymous projection.

Series preserve the chosen local start/end wall times in the supplied recognized time zone. A weekly event therefore shifts its UTC offset across a normal daylight-saving transition while keeping its local time. A generated missing/ambiguous local time fails the whole series and requires explicitly timed occurrences; the service does not guess a fold/offset. All drafts and their receipt/audit commit atomically. Limits are 52 occurrences, a 1–366 day interval, 31-day event/query windows, and 1–100 paged rows. Transaction byte limits also apply. These are current technical bounds, not official church policy. Templates and reviewed forward/whole-series amendments remain unimplemented.

## Real room conflicts and recoverable work

Rooms/spaces are exclusive resources. `Capacity` describes occupants; it does not permit that many simultaneous bookings or implement equipment inventory. Booking times must match the linked occurrence; setup/cleanup extend resource occupancy. Up to 25 actual selected facilities are supported, with a bounded exclusion graph.

Exclusions use a separate lock for each excluded pair. If rooms A and B each conflict with combined space C, A and B can still be booked together; booking C conflicts with either. Exclusion direction is respected from both configured sides. No override permits impossible concurrent use. Configuration/serviceability changes check affected current/future bookings, including cleanup, and fail for unresolved dependencies. Display-name changes do not rewrite existing allocation periods. Planned maintenance can use a private resource-block event and the normal booking flow; full repair/maintenance work orders remain further work.

Each resource has an exact `resource:<resource-key>` logical partition inside the existing `TenantControl` container. Guard/hold/receipt/audit writes use conditional ETags. Cosmos transactional batches apply within one partition; the multi-resource coordinator remains a durable sequence with compensation, not a cross-partition transaction. [Microsoft transactional batch documentation](https://learn.microsoft.com/en-us/azure/cosmos-db/transactional-batch).

The coordinator rechecks the stored initiator, security stamp, selected appointment or ordinary grant, explicit denials, jurisdiction and current paid coverage. It never manufactures a user principal or borrows another capacity. Losing authority before completion causes compensation and a visible conflict. Successful older commitments do not disappear when a staff appointment later changes.

Leases fence stale workers. A temporary service failure leaves a retryable pending state. Definitive failure releases all partial holds; cancellation creates release tombstones even for holds that have not arrived. A late attempt cannot resurrect a cancelled allocation. The worker reports success only after all holds confirm and the final parish transaction succeeds. Rechecks across account/archdiocese/resource partitions are not an atomic global revocation instant; live Cosmos race behavior still needs controlled verification.

## Run the actual worker and Aspire

The API runs bounded pages of durable reservation work when `BackgroundJobs:Enabled=true`. Production defaults to enabled; Development defaults to disabled. Both billing and reservation workers read the final host configuration at execution. They use fresh scopes and persist work between restarts. The API process must actually run for work to progress; App Service hosting/Always On or the approved runner must be verified before claiming reliable unattended production processing.

AppHost keeps jobs disabled by default. To enable the runner deliberately for local development:

```powershell
$env:Backend__RunBackgroundJobs = 'true'
dotnet run --project ParishLife.AppHost
Remove-Item Env:Backend__RunBackgroundJobs
```

AppHost still uses the configured Azure services by default and provisions none. `Backend__UseAzure=false` is available only for separate local development, with separate local documents/key material. Automated fixtures always use asserted temporary paths. Local storage results do not prove Azure connectivity or service guarantees. No privileged worker-control HTTP endpoint is exposed.

## Required Azure index review

The source contract now includes six additional `TenantControl` paths: `/data/startsAt/?`, `/data/endsAt/?`, `/data/eventId/?`, `/data/status/?`, `/data/published/?` and `/data/visibility/?`. The same container continues to serve parish/appointment records and isolated resource partitions; no new container, database, TTL or identity was created.

Readiness checks the required query index policy with include/exclude precedence. An existing broad policy may already cover these paths. Compare actual metadata before changing anything; preserve other required indexes and use a reviewed additive change when needed. The recorded selective contract is in `docs/cosmos/containers.json`. Readiness is metadata-only: it does not prove finished index transformation or live query results. The application does not enable scans to hide missing indexes. [Microsoft index policy documentation](https://learn.microsoft.com/en-us/cosmos-db/indexing-policies).

Only the explicit initializer's no-Azure preview was run. No policy was applied, no existing resources were replaced, and no live business writes or deployment occurred. Local Azure CLI authentication remains pending, so actual deployed indexing, queries, transactions, hosted identity, key-ring persistence and runner availability remain unverified.

## Verification and remaining scope

Tests cover actual local Identity/services/storage, cookie/MFA/CSRF HTTP, separate editing/publication rights, source forgery and legacy exclusion, private reasons/redaction, recurrence/DST rollback, conflicting concurrent bookings, buffers/exclusion pairs, partial compensation, delayed-hold tombstones, stale rollback, role/MFA/security-stamp withdrawal, service failure/lease resumption, protected facility changes and actual hosted-runner completion. These are isolated tests without church seeds or production access.

The full backend remains unfinished. Clergy/personal availability and cross-parish duties, official source amendments, recurrence templates/exceptions/forward edits, ministry audiences, public-profile gates/feeds, deposits/rental terms acceptance/payments, equipment stock, work orders, acknowledgments and actual notifications remain tracked. The preserved service-plan/music code was separated into `ActivityPlanningService` for its later reviewed integration, rather than exposed as an accepted feature.

## Personal and priest schedules (K04)

Source basis: S16.08, S16.10 (proposed). Periods are up to 92 days.

- `GET /api/me/schedule?from=&to=` lists, for each followed parish where the account is linked to a person, that person's event registrations (not cancelled or draft), confirmed or awaiting volunteer shifts and scheduled sacraments, each labelled with its parish.
- `GET /api/parishes/{parish}/clergy/schedule?from=&to=` (priest acting appointment, MFA) lists only the priest's own duties: scheduled sacraments where they are the celebrant and assigned requests with a confirmed date. No private notes or case details are included.
- Add `format=ics` to either for a one-off iCalendar download in UTC; items with a parish time zone note it. Revocable subscription feeds are not offered until operational.

Not implemented: print layouts in EN/FR/AR, filters by event type, revocable subscription feeds, public/member redacted calendar exports and clergy duties on calendar events (events carry no clergy assignments yet).

## External renters and rental agreements (F07)

Source basis: S23.09–S23.10, S23.15 (proposed). Routes under `/api/parishes/{parish}` need current MFA and the facilities module.

- `POST /renters` and `GET /renters` (facilities.manage) keep external renters (name, organization, responsible contact, verification reference) separate from parish membership. Public availability never shows them.
- `PUT /reservations/{reservation}/rental` (facilities.manage) proposes the agreement's terms snapshot: renter, fee, deposit, currency and cancellation text. Later rate changes never alter an existing agreement, and once approved it cannot be re-proposed.
- `POST /reservations/{reservation}/rental/actions` with the current version:
  - `approve` (finance.approve, a different person from the proposer).
  - `accept`, recording the renter's acceptance evidence.
  - `deposit-received` and `fee-received` (finance.post), recording actual receipts with a reference and date, never beyond the agreed amounts.
  - `refund-deposit`, `retain-deposit` and `waive-fee` (finance.approve), within what is held or outstanding and with a reason.
- `GET /reservations/{reservation}/rental` shows the deposit state (NotRequired, Due, PartlyReceived, Held, Settled), the deposit held and the fee outstanding, all derived only from recorded payments. Nothing simulates an electronic payment.

Not implemented: linking rental receipts into the Finance ledger and bank matching, rescheduling/cancellation fee rules, a renter-facing application and tracking page, insurance/permission evidence, renter-to-account association, and frontend.

## Reservation details and decision history (fullstack2-facilities, November 2026)

- `POST /reservations` also takes optional `Purpose`, `PurposeAr`, `ExpectedAttendance`, `ContactPhone` and `Notes`.
- `PUT /reservations/{id}/details` (facilities.manage, current version) replaces those details and a typed opening/closing checklist (at most 40 steps, each with an optional `labelAr`). A newly ticked step records the account and instant; a step that stays ticked keeps them. It never changes the period, rooms or allocation state, and is refused for declined or cancelled reservations and for private bookings the caller cannot see.
- Reservations now carry a decision history (newest 50): the request, each confirm/decline/cancel with its reason, and the allocation outcome (`confirmed`, `conflict`, `cancelled`) as actor `system`. Views also return `EventTitle` and `MinistryId`. Redacted views omit all of these.
- Dated maintenance blocks hold rooms through the same allocator; see `equipment-and-facility-issues.md`.
