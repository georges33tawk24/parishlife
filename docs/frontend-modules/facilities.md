# Facilities module

Pages `facilities` (tabs: Rooms, Equipment, Out of service, Issues, External renters) and `reservations`.
Code: `frontend/src/portal/model/modules/facilities.js`, `frontend/src/portal/features/spaces/*`
(`facilities.jsx`, `reservations.jsx`, and `forms.jsx`, the shared form dialog). Check:
`frontend/scripts/checks/facilities.mjs`.

Collections owned: `VENUES`, `EQUIPMENT`, `RESERVATIONS`, `MAINTENANCE`, `ISSUES`, `RENTALS`.

Every write is one API call from an action, followed by `hydrate()`. Nothing changes the view model
directly, so an on-screen edit of these collections that reaches `persist()` is undone and reported.
The old record editor (`rec-new`, `rec-edit`, `res-approve`, `res-reject`, `block-cancel`, `issue-assign`
in `shell/actions.jsx` and `shared/record-editor.jsx`) is no longer used by these pages and is untouched.

## Routes used (all under `/api/parishes/{id}/`)

| Screen | Route |
| --- | --- |
| Rooms list | `GET facilities` (size/cursor paging, 100 a page) |
| Add / edit room | `POST facilities`, `PUT facilities/{id}` (`version`) |
| Out of service / back | `POST facilities/{id}/status` (`Serviceable`/`OutOfService`, reason required, `version`) |
| Availability drawer | `GET facilities/{id}/availability?start&end` (busy intervals, set-up and clean-up included; `Unavailable` when out of service) |
| Reservations list | `GET reservations?start&end` (31-day windows: the 31 days before and after today) |
| Titles and clocks | `GET calendar/events?start&end` (read only, for the title and time zone) |
| Request a room | `POST reservations` (exact period of a draft event), draft events from `GET calendar/events` |
| Decide | `POST reservations/{id}/actions` (`confirm`, `decline`, `cancel`; reason required; `version`) |
| Equipment | `GET/POST equipment`, `PUT equipment/{id}`, `GET equipment/{id}/bookings` |
| Loans | `POST equipment/{id}/bookings`, `POST equipment-bookings/{id}/actions` (`issue`, `return`, `cancel`) |
| Issues | `GET facility-issues`, `POST facility-issues`, `POST facility-issues/{id}/actions` (`triage`, `start-repair`, `resolve`, `dismiss`) |
| Rentals | `GET renters`, `POST renters`, `GET reservations/{id}/rental` (404 = none), `PUT reservations/{id}/rental` |

Equipment, issues and rentals need an authenticator sign-in and `facilities.manage`; a 403 leaves the area
empty and the page says so. The rest needs `schedule.read` / `facilities.manage`.

## How the API differs from the old screens

- **One decision step.** The API has no secretary-then-priest chain. Anyone with `facilities.manage`
  confirms, declines or cancels, with a required reason. Confirming is queued (`Allocating`, 202): the room
  is held once the API has allocated it (`Confirmed`), or the request becomes `Conflict`. A request waiting
  for a decision does **not** hold the room. The stage bar is now Requested → Being confirmed → Confirmed.
- **A reservation needs a draft calendar event** with the exact same period. "Request a room" lists draft
  events from the next 62 days; creating the event is the calendar module's job.
- **Maintenance blocks have no dates.** The API only takes a room out of service (with a reason it records
  but does not return) until someone returns it. `MaintenanceDto` exists but no route uses it. The tab is
  now "Out of service" with no From/To/Reason.
- **Loans** are bookings against a calendar event, then issued and returned; "on loan" is the units on
  `Issued` bookings (one read per item).
- **Rentals** exist per reservation. The list reads each current reservation's agreement (one read each,
  404 where none). Approval, acceptance, deposits and refunds belong to finance (`finance.approve`/`post`)
  and have no UI here yet.

## Fields with no API equivalent (left empty or removed, never invented)

- Room: Arabic name (shown as the one name), step-free access, photos, usage policy.
- Reservation: group, requester as a person (the API gives an account id), phone, people expected, hold
  expiry, opening/closing checklist, decision history (only the last reason), the old "hall utilisation"
  and "average decision time" figures.
- Maintenance block: dates, reason, staff in charge.
- Issue: who reported it (account id, not a person), photos (only a text evidence note), assignee picker
  (an account id is needed).
- Equipment: Arabic name, a condition scale (the API has a free-text note and a status).
- Reference numbers are `RES-` plus the first 8 characters of the id.

## Not in the UI (routes exist)

- Additional rooms on a reservation (`additionalResourceIds`) and linking a customer person.
- Rental approval, acceptance and payments (`rental/actions`).
- Reservations beyond ±31 days of today, and events not in the next 62 days for requests.

## Open decisions for the owner

1. The parish has no time zone in the API. Times show on the clock of the reservation's calendar event
   (the viewer's clock if the event cannot be read). Should the parish carry a time zone?
2. Should the API return the out-of-service reason and a date range, or have a maintenance-window route
   (`MaintenanceDto` is unused)?
3. Should reservation DTOs carry the event title, requester as a person, and a conflict detail?
4. Should the secretary/priest two-step approval exist as policy, or is `facilities.manage` enough?
5. Step-free access, photos and usage policy for rooms: new fields?

## Verified

`npm run check` (`checks/facilities.mjs`) covers load (rooms, blocks, reservations with titles and set-up
buffers, equipment on loan, issues, rentals incl. 404), a refused area staying empty, paging with `size`,
the exact body of each write, and an on-screen edit being undone. Not run: the screens in a browser, or
against a live API (needs a verified account with an appointment).
