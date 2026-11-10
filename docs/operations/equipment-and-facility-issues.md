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
