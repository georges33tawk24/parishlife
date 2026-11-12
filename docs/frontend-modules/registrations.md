# Registrations module

Connects event registration and door check-in to ParishLife.Api. Code: `frontend/src/portal/model/modules/registrations.js`; screens `features/parish-life/registrations*` and `checkin*` (pages `registrations`, `checkin`); check `frontend/scripts/checks/registrations.mjs`. API reference: `docs/operations/event-registrations.md`.

Collections owned: `REGISTRATIONS` (one per event policy; the id is the event id), `REG_FORM`, `REGISTRANTS`, `REFUNDS`, `PICKUP` (by registration id), `CHECKIN` (`sessions[eventId]`), `EVACUATION`.

## How it works

The API has no list of policies. `load` reads the parish's calendar activities (`kind = ParishActivity`, not cancelled, 31-day windows from 30 days back to 120 ahead), asks each for its policy (404 means none, so the event is offered in "New form"), then reads the registrations the account may see. A 403 only leaves that part empty. Screens never edit the collections: every change calls an exported action (`configureRegistration`, `setRegistrationOpen`, `reviseRegistrationForm`, `registerParticipant`, `decideRegistration`, `amendRegistration`, `recordReceipt`, `requestRefund`, `decideRefund`, `recordPresence`) through `act()`, which reloads. `save()` undoes and reports any local edit. The member's own-registration calls (`applicantForm`, `ownRegistration`, `registerOwn`, `cancelOwn`) are exported for the member module's screens; no screen here uses them.

## Routes used (all under `/api/parishes/{parish}`)

- `GET calendar/events?start&end&size&cursor`
- `calendar/events/{event}/`: `GET|POST registration`, `POST registration/actions`, `POST registration/forms`, `GET registration/forms/{form}`, `GET registration/applicant-form`
- `.../registrations`: `GET` (cursor paging), `POST`, `GET cashier`, `GET door`, `GET mine`, `POST mine`, `POST mine/cancel`
- `.../registrations/{id}/`: `POST actions`, `POST amend`, `POST receipts`, `GET movements`, `GET|POST refunds`, `POST refunds/{refund}/actions`, `POST presence`
- `GET calendar/events/{event}/present`

Registration lists page with `size` and `cursor` (not People's `pageSize`/`continuation`), so the module has its own pager.

Permissions: `registrations.manage` (policy, list, decisions, amend), `finance.enter` (cashier list, receipts, refund request, record), `finance.approve` (approve/reject), `finance.read` (movements, refunds), `registrations.checkin` plus the event's door assignment (door list, presence, present). The priest is treated as holding all; the API decides.

## Fields with no API equivalent (left empty or removed)

- Registration deadline ("Closes"), discounts, instalments, bus fee, household registration, payment method (cash/bank/OMT) and online providers.
- Arabic event titles (shown as the one title), venue (the calendar event has none), muster point, evacuation rooms.
- Pickup reference codes, "enter reference", name tags, awaiting-guardian counts, do-not-release entries.
- Incident reports (the Incidents tab says not connected; no module owns the Care area).
- A registrant's name for an account without people access comes from the door or cashier view; otherwise it shows "—".
- A policy is created once: capacity, fee, ages, consent and door operators cannot be edited afterwards; only the questions (new version) and open/closed change.
- Paper-entry for late arrivals is available on checkout and re-entry only; arrival is recorded as "now".

## Open owner decisions

1. Door operators are account ids typed or "me"; there is no staff/account picker in the API for this screen.
2. Should the calendar activity be created from the registration screen (it was before), or only in Calendar? Now only in Calendar.
3. Guest/public registration, guardian registration for linked children, transport rosters, exports and expiry notices are not in the API.
4. The 150-day event window and one policy probe per event cost requests on every reload (negative results are cached for five minutes); a policy-list route would remove this.
5. Member self-registration screens belong to the member module.

## Edits to shared files

`model/event-workflows.js` (`linkedEvent` falls back to the event read from the API; `ensureCheckinSession` removed), `shell/actions.jsx` (removed the old check-in actions and their imports), `model/modules/index.js`.

## Verification

`npm ci`, `npm run format:check`, `npm run check` and `npm run build` pass. Not tried against a live API or in a browser (no verified account locally).
