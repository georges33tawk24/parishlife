# Registrations module

Connects event registration and door check-in to ParishLife.Api. Code: `frontend/src/portal/model/modules/registrations.js`; screens `features/parish-life/registrations*` and `checkin*` (pages `registrations`, `checkin`); check `frontend/scripts/checks/registrations.mjs`. API reference: `docs/operations/event-registrations.md`.

Collections owned: `REGISTRATIONS` (one per event policy; the id is the event id), `REG_FORM`, `REGISTRANTS`, `REFUNDS`, `PICKUP` (by registration id), `CHECKIN` (`sessions[eventId]`), `EVACUATION`.

## How it works

The API has no list of policies. `load` reads the parish's calendar activities (`kind = ParishActivity`, not cancelled, 31-day windows from 30 days back to 120 ahead), asks each for its policy (404 means none, so the event is offered in "New form"), then reads the registrations the account may see. A 403 only leaves that part empty. Screens never edit the collections: every change calls an exported action (`configureRegistration`, `setRegistrationOpen`, `reviseRegistrationForm`, `registerParticipant`, `decideRegistration`, `amendRegistration`, `recordReceipt`, `requestRefund`, `decideRefund`, `recordPresence`, `reviseTerms`, `applyDiscount`, `registerHousehold`, `pickupCode`, `startEvacuation`, `evacuationAction`, `recordIncident`) through `act()`, which reloads. `save()` undoes and reports any local edit. The member's own-registration calls (`applicantForm`, `ownRegistration`, `registerOwn`, `cancelOwn`) are exported for the member module's screens; no screen here uses them.

## Routes used (all under `/api/parishes/{parish}`)

- `GET calendar/events?start&end&size&cursor`
- `calendar/events/{event}/`: `GET|POST registration`, `POST registration/actions`, `POST registration/forms`, `GET registration/forms/{form}`, `GET registration/applicant-form`
- `.../registrations`: `GET` (cursor paging), `POST`, `GET cashier`, `GET door`, `GET mine`, `POST mine`, `POST mine/cancel`
- `.../registrations/{id}/`: `POST actions`, `POST amend`, `POST receipts`, `GET movements`, `GET|POST refunds`, `POST refunds/{refund}/actions`, `POST presence`
- `GET calendar/events/{event}/present`
- Added (fullstack2-registrations): `POST registration/terms`, `POST registrations/household`, `POST registrations/{id}/discount`, `POST registrations/{id}/pickup-code`, `GET|POST evacuations`, `GET evacuations/{id}`, `POST evacuations/{id}/actions`; and the existing `POST incidents`, `GET incidents?eventId=` (restricted incidents area).

Registration lists page with `size` and `cursor` (not People's `pageSize`/`continuation`), so the module has its own pager.

Permissions: `registrations.manage` (policy, list, decisions, amend), `finance.enter` (cashier list, receipts, refund request, record), `finance.approve` (approve/reject), `finance.read` (movements, refunds), `registrations.checkin` plus the event's door assignment (door list, presence, present, evacuation roll calls), `incidents.record` (report an incident), `incidents.manage` (list the event's incidents). The priest is treated as holding all; the API decides.

## Now connected (fullstack2-registrations)

- **Deadline**: policy `closesAt` (before the event); shown as "Closes"; office, household and self submissions after it get `registration_deadline_passed`.
- **Editing terms after creation**: "Edit terms" on the form panel (capacity, transport, fee, currency, ages, guardian age, consent, door operators, deadline, discounts, instalments, methods, muster point, with a reason). The API refuses capacity below held seats and a currency/precision change once anyone is registered; existing registrations keep their submitted fee.
- **Discounts**: named fixed amounts (with Arabic name) on the policy; "Discount" in the registrant drawer applies or removes one with a reason. Balance and receipts use the discounted amount due; a discount below money already received is refused.
- **Instalments**: dated amounts that add up to the fee; the cashier view returns "due by today" (never above the discounted amount due). Display only: nothing is enforced on late payment.
- **Payment methods**: the policy lists accepted methods (Cash, BankTransfer, MoneyTransfer, Cheque, Other; none listed means Cash); the receipt dialog records the method. It records money received; nothing is charged and no online provider exists.
- **Household registration**: "Register household" registers chosen current members of one household together (one transaction); the screen applies the same answers and arrangements to every chosen member, and each can be amended afterwards.
- **Pickup codes**: "Issue pickup code" in the drawer shows an 8-character code once; only a salted hash is stored (never in receipts, audit or fingerprints). The door sees "Pickup code required" and checkout asks for the code in addition to the authorised collector and identity check. Revoke is available.
- **Evacuation**: the Evacuation tab shows the muster point and runs roll calls (drill or emergency) from the participants recorded present; operators mark each accounted for and close it.
- **Incidents**: the Incidents tab records a restricted report linked to the event (`incidents.record`); the event's incidents list only for `incidents.manage`.

## Still not connected (and why)

- Bus/transport fee, online payment providers, refunds by method: not built; no charging exists by design.
- Arabic event titles and venue: belong to the calendar event (calendar area).
- Do-not-release entries, name tags, awaiting-guardian counts, emergency messages: child-safety and communications decisions not made; nothing invented.
- Per-member answers in the household dialog (the API accepts them; the screen sends one shared set).
- A registrant's name for an account without people access comes from the door or cashier view; otherwise it shows "—".
- Paper-entry for late arrivals is available on checkout and re-entry only; arrival is recorded as "now".

## Open owner decisions

1. Door operators are account ids typed or "me"; there is no staff/account picker in the API for this screen.
2. Should the calendar activity be created from the registration screen (it was before), or only in Calendar? Now only in Calendar.
3. Guest/public registration, guardian registration for linked children, transport rosters, exports and expiry notices are not in the API.
4. The 150-day event window and one policy probe per event cost requests on every reload (negative results are cached for five minutes); a policy-list route would remove this.
5. Member self-registration screens belong to the member module.
6. Does the deadline also bind the office (late office entries are now refused like self-registration)?
7. Should a fee change apply to existing registrations? Now they keep the fee copied at submission.
8. Discount rules (who qualifies, percentage discounts, stacking): now one fixed-amount discount per registration chosen by the office.
9. Instalments: consequences of missing one (none enforced), and whether the schedule should follow a discount differently (now the amount due by a date is capped at the discounted total).
10. Pickup codes: should a code replace the identity check rather than add to it (now it adds)? Should wrong attempts be limited (none counted now)? Should guardians see the code in their own view?
11. Household registration by a linked guardian for their children needs a representation model (guardian authority) that does not exist; office only.
12. Evacuation: who besides assigned door operators may run a roll call, and whether emergency messages should be sent.

## Edits to shared files

This branch: `ParishLife.Api/Extensions/ServiceCollectionExtensions.cs` (two lines: `RegistrationTermsService`, `EvacuationService`). No change to `containers.json` (queries use the indexed `eventId`), `index.js`, `check-api.mjs` or `route-gaps.json`. Earlier: `model/event-workflows.js` (`linkedEvent` falls back to the event read from the API; `ensureCheckinSession` removed), `shell/actions.jsx` (removed the old check-in actions and their imports), `model/modules/index.js`.

## Verification

`npm run format:check`, `npm run check` (registrations check extended for every new field and call), `npm run check:routes` and `npm run build` pass. Backend: `RegistrationOptionsTests` (6) plus the existing registration tests. Not tried against a live API or in a browser (no verified account locally).
