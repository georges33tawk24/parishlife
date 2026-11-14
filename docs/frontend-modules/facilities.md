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
| Add / edit room | `POST facilities`, `PUT facilities/{id}` (`version`; `nameAr`, `publicDescriptionAr`) |
| Out of service / back | `POST facilities/{id}/status` (`Serviceable`/`OutOfService`, reason required, `version`) |
| Planned maintenance | `GET maintenance-blocks?start&end` (two 31-day windows around today), `POST maintenance-blocks`, `POST maintenance-blocks/{id}/actions` (`cancel`, reason, `version`) |
| Availability drawer | `GET facilities/{id}/availability?start&end` (busy intervals; set-up, clean-up and maintenance blocks included; `Unavailable` when out of service) |
| Reservations list | `GET reservations?start&end` (31-day windows: the 31 days before and after today) |
| Titles and clocks | `GET calendar/events?start&end` (read only, for the clock; the title also comes with the reservation as `eventTitle`) |
| Request a room | `POST reservations` (exact period of a draft event; optional purpose, `purposeAr`, people expected, contact phone) |
| Reservation details | `PUT reservations/{id}/details` (purpose, `purposeAr`, people expected, phone, notes, opening/closing checklist; `version`) |
| Decide | `POST reservations/{id}/actions` (`confirm`, `decline`, `cancel`; reason required; `version`) |
| Equipment | `GET/POST equipment`, `PUT equipment/{id}` (`nameAr`, `conditionGrade`), `GET equipment/{id}/bookings` |
| Loans | `POST equipment/{id}/bookings`, `POST equipment-bookings/{id}/actions` (`issue`, `return`, `cancel`) |
| Issues | `GET facility-issues`, `POST facility-issues` (`descriptionAr`), `POST facility-issues/{id}/actions` (`triage`, `start-repair`, `resolve`, `dismiss`) |
| Rentals | `GET renters`, `POST renters` (`nameAr`, `organizationAr`), `GET reservations/{id}/rental` (404 = none), `PUT reservations/{id}/rental` |
| People's names | `GET account-names?ids=` through `model/names.js`: requesters, deciders, checklist ticks, issue reporters and assignees, block authors |

Equipment, issues and rentals need an authenticator sign-in and `facilities.manage`; a 403 leaves the area
empty and the page says so. Rooms, availability and maintenance-block reads need `schedule.read`;
reservations and every room or block write need `facilities.manage`.

## What is connected now (fullstack2-facilities)

- **Arabic names.** Rooms (`nameAr`, `publicDescriptionAr`), equipment (`nameAr`), issues (`descriptionAr`),
  renters (`nameAr`, `organizationAr`), reservation purpose (`purposeAr`), checklist steps (`labelAr`) and
  maintenance reasons (`reasonAr`) are optional API twins. Forms show both fields and send each as typed;
  display falls back to the other language only when the twin is empty. Older records return `null`.
- **Maintenance blocks with dates.** A block (room, from, to, reason, Arabic reason, who is in charge) takes
  the same room and exclusion-pair resource guards as a reservation, through the allocator. It is refused
  (409 `maintenance_conflict`) while a confirmed or allocating reservation holds the room, and a reservation
  confirmed for a blocked period ends in `Conflict` (`resource_conflict`). Cancelling releases the room.
  Blocks last at most 31 days and have no set-up or clean-up of their own; a room that excludes the blocked
  room is blocked too. A failed attempt stays listed as `Conflict` (the screen hides it).
- **Reservation details.** Purpose in both languages, people expected, contact phone, notes, a typed opening
  and closing checklist that records who ticked each step and when, the requester's name, the group
  (`ministryId` of a ministry-meeting event) and a decision history (the request, each decision with its
  reason, and the allocation outcome shown as "Allocation"). All of these are hidden on a redacted booking.
- **Equipment condition.** An optional grade `Good`, `Fair` or `NeedsService` beside the free-text note.
- **Issues.** Reporter and assignee shown by name, and an Arabic description.

## How the API differs from the old screens

- **One decision step.** The API has no secretary-then-priest chain. Anyone with `facilities.manage`
  confirms, declines or cancels, with a required reason. Confirming is queued (`Allocating`, 202): the room
  is held once the API has allocated it (`Confirmed`), or the request becomes `Conflict`. A request waiting
  for a decision does **not** hold the room. The stage bar is Requested → Being confirmed → Confirmed.
- **A reservation needs a draft calendar event** with the exact same period. "Request a room" lists draft
  events from the next 62 days; creating the event is the calendar module's job.
- **Out of service** stays separate from planned maintenance: it has no dates, and its reason is recorded
  but not returned.
- **Loans** are bookings against a calendar event, then issued and returned; "on loan" is the units on
  `Issued` bookings (one read per item).
- **Rentals** exist per reservation. Approval, acceptance, deposits and refunds belong to finance
  (`finance.approve`/`post`) and have no UI here yet.

## Still not connected, and why

- Room step-free access, photos and usage policy: no API fields (owner decision 4).
- Reservation hold expiry: holds are managed by the allocation worker only.
- Issue photos (a text evidence note only) and an assignee picker: the API needs an account id and no route
  lists assignable staff, so the triage form does not assign.
- Additional rooms on a reservation (`additionalResourceIds`) and linking a customer person (routes exist).
- Rental approval, acceptance and payments (`rental/actions`), and any rental fee rules.
- Reservations and blocks beyond ±31 days of today, and events outside the next 62 days for requests.
- The checklist is edited as lines (`English | Arabic`) in a plain form; there is no checklist template.

## Open decisions for the owner

1. The parish has no time zone in the API. Reservation times show on the clock of the reservation's calendar
   event, and maintenance blocks on the viewer's clock. Should the parish carry a time zone?
2. Should each room have a default opening/closing checklist? The API stores only what the office types.
3. Should the secretary/priest two-step approval exist as policy, or is `facilities.manage` enough?
4. Step-free access, photos and usage policy for rooms: new fields?
5. Rental fees, deposits and cancellation charges: the API records agreed amounts and actual payments only;
   no rate card or fee rule is implemented (neutral mechanism).
6. Equipment condition scale: `Good`/`Fair`/`NeedsService` follows the old screens. Confirm or replace it.
7. Should out-of-service reasons be returned to readers, and who may see reservation contact phones
   (currently `facilities.manage` only)?

## Verified

`npm run check` (`checks/facilities.mjs`) covers load (rooms with Arabic twins and fallback, dated blocks in
two windows plus rooms out of service, reservations with purpose, checklist and history, names through
account-names, the equipment grade, Arabic issue text, rentals including 404), a refused area staying empty,
paging with `size`, the exact body of each write (including maintenance, details and Arabic fields), and an
on-screen edit being undone. Backend: `FacilitiesCompletionTests` (5 integration tests, including HTTP).
Not run: the screens in a browser, or against a live API.
