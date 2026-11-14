# Equipment and facility issue operations

Updated 10 November 2026. Source basis: S23.01, S23.13 and S23.14 (proposed). Routes are under `/api/parishes/{parish}`; all paths need current MFA, facilities.manage (reporting also accepts schedule.read) and the facilities module.

## Equipment

- `POST /equipment`, `PUT /equipment/{equipment}` and `GET /equipment` keep counted equipment with storage, condition and Serviceable/OutOfService/Retired status. The quantity cannot be reduced below the peak held by overlapping active bookings.
- `POST /equipment/{equipment}/bookings` holds a quantity for an existing, uncancelled, future calendar event, using that event's times. Only serviceable equipment is bookable, and the sum of active bookings that overlap the event may not exceed the quantity (a conservative check that never overcommits). Each booking replaces the equipment record conditionally, so concurrent bookings of the same item cannot both commit.
- `POST /equipment-bookings/{booking}/actions`: `issue` (to a named recipient), `return` (returned quantity and Good/Damaged) and `cancel` (before issue, with a reason). A return with missing units reduces the equipment quantity explicitly; missing or damaged returns need evidence and open a facility issue in the same transaction. Nothing is silently deleted or charged.

## Facility issues

- `POST /facility-issues` reports a problem with a facility or equipment item: description, urgency (Low, Normal, Urgent, Hazard) and evidence.
- `POST /facility-issues/{issue}/actions`: `triage` (optional assignee and note), `start-repair`, `resolve` (resolution evidence and an optional cost note that posts nothing to finance) and `dismiss` (with a reason). Urgent issues and hazards are resolved or dismissed only by someone other than their reporter.
- `GET /facility-issues?status=` and `/facility-issues/{issue}` are facility-manager reads.
- Taking a room out of service remains the existing facility status/maintenance action, which resolves affected bookings; an issue records the decision but does not change serviceability by itself.

Not implemented: booking a room and equipment in one combined transaction (rooms use the queued reservation worker; equipment bookings are separate), serial-numbered units, member/borrower equipment requests, notifications and repair-cost finance posting.

## Arabic names, condition grade and maintenance blocks (fullstack2-facilities, November 2026)

- Equipment takes an optional `nameAr` and `conditionGrade` (`Good`, `Fair` or `NeedsService`; null when ungraded) beside the free-text condition note. Issues take an optional `descriptionAr`; renters `nameAr` and `organizationAr`; rooms `nameAr` and `publicDescriptionAr`. Twins are trimmed, never translated, and older records return null.
- `POST /maintenance-blocks` (facilities.manage, facilities module) schedules a dated block (at most 31 days, ending in the future) on one room with a reason, optional `reasonAr` and who is in charge. The block is recorded as `Allocating`, then holds and confirms the room's guard and its exclusion-pair guards through the reservation allocator, and becomes `Active`. A held period is refused with 409 `maintenance_conflict` and the attempt is kept as `Conflict` after releasing every guard. A temporary failure leaves `Allocating`; replaying the same `OperationId` resumes it.
- `POST /maintenance-blocks/{id}/actions` with `cancel`, a reason and the current version records the cancellation, then releases every guard (a replay re-runs the idempotent releases). `GET /maintenance-blocks?start&end` and `GET /maintenance-blocks/{id}` need schedule.read.
- A reservation confirmed for a blocked period ends in `Conflict` (`resource_conflict`) through the existing allocation worker. A room's exclusions cannot change while a current or future block holds one of the affected rooms.

Not implemented: recurring maintenance, linking a block to a facility issue, notifications, and an atomic cross-partition guarantee (the block's guards are separate resource partitions, as for reservations).
