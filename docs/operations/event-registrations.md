# Event registrations operations

Updated 10 November 2026. Source basis: S21 (registration, capacity, consent, fees, waitlists) and S22 (arrival, pickup, present roster). The detailed policies there are **proposed**; ages, consent wording, fees and refund rules are inputs supplied per event by the parish, never invented defaults. This is an implemented backend slice, not full S21–S22 acceptance.

The registration service existed in the repository without routes, registration or tests. It is now wired, with these corrections: it accepts the calendar's actual manual `ParishActivity` events (parish or public visibility only; source-owned meetings use RSVP), every staff path requires current MFA, every write fences the parish root as other modules do, and responses are DTOs rather than stored records. Event kind, audience and source ownership are rechecked when opening intake, submitting, making seat decisions, amending a participant and recording arrival/reentry. Configuring a policy on an eligible draft does not authorize registration after that draft becomes a private appointment or resource block.

Routes are under `/api/parishes/{parish}/calendar/events/{event}`.

## Policy and forms (registrations.manage)

- `POST /registration` configures a draft policy for one event: capacity, transport capacity, fee/currency/precision, waitlist, age range, child age threshold, consent requirement and wording, explicit door operator accounts and a form of up to 40 typed fields (Text, Choice, Boolean, Number, Date, with conditional visibility).
- `POST /registration/actions` opens (only an eligible confirmed future event) or closes intake. `POST /registration/forms` adds a new form version; existing registrations keep the version they answered. `GET /registration` and `/registration/forms/{form}` read them.

## Participants

- `POST /registrations` (office) registers an existing, unarchived parish person with the viewed `FormVersionId`, form answers, consent/guardian evidence and authorized collectors. Each person has at most one registration per event.
- `POST /registrations/mine`, `GET /registrations/mine` and `POST /registrations/mine/cancel` let a member with a reviewed person link register themselves, see their own projection (answers, status, balance, presence; no staff evidence, collectors or recorder) and cancel before arrival. Self-registration only submits; the office path still applies capacity, eligibility, guardian arrangements and confirmation. `Origin` records Office or Self; `CreatedBy` records the requester.
- `GET /registration/applicant-form` lets that linked member read the current open event's questions, supplied fee/age terms, consent wording and `FormVersionId`, without staff assignments or recorder details. Both office and self submissions must include the version actually viewed. A changed form returns `registration_form_changed` (409) so the questions can be reviewed again; the server does not silently attach old answers to new labels. Responses include the pinned `FormVersionId`.
- `POST /registrations/{id}/actions`: `reserve` and `offer` (with an explicit future deadline before the event), `confirm`, `cancel` and `reinstate`. When capacity or transport capacity is full, confirmation becomes Waitlisted (if the policy allows) and earlier waiting participants are offered first. Expired offers stop holding seats. `POST /{id}/amend` changes answers, transport and arrangements with a reason, rechecking capacity.
- Confirmation checks the person's birth date against the event's local date and the policy ages, the consent evidence when required, and, below the child threshold, guardian authority plus at least one authorized collector or an explicit independent-departure arrangement.

Every registration change replaces the event policy record conditionally, so two concurrent seat decisions cannot both commit (the loser gets `write_conflict` and retries with fresh state).

## Money (finance module)

- `GET /registrations/cashier` and `/registrations/{id}/cashier` (finance.enter) return paged or individual versioned cashier projections: participant display name, registration status and exact fee/receipt/refund balances. Use that registration version for receipts and refund requests. These reads exclude answers, consent/guardian evidence, collector arrangements and presence details; no registration-management grant is needed.
- `POST /registrations/{id}/receipts` (finance.enter) records actual cash received, in the fee currency, never above the outstanding balance or in the future.
- `POST /registrations/{id}/refunds` (finance.enter) requests a refund within actual unrefunded receipts, counting pending requests. `.../refunds/{refund}/actions`: `approve`/`reject` by finance.approve from a different person than the requester; `record` (finance.enter) by a different person than the approver, with the actual date and evidence. `GET .../movements` and `.../refunds` need finance.read.
- Cancelling a registration never refunds money; refunds are always this separate reviewed flow. Amounts and currencies are stored exactly; no exchange rates or automatic charging.

## Door (registrations.checkin)

- `GET /registrations/door` and `/registrations/{id}/door` require check-in permission plus the event's explicit operator assignment. They return versioned confirmed participants, their display names/presence, independent-departure flag and authorized collector names/IDs. They exclude form answers, private authority/consent evidence and financial information. Use the returned registration version for presence writes and refresh it after each change; no registration-management grant is needed.
- `POST /registrations/{id}/presence` records `arrive`, `checkout` and `reenter` for confirmed participants, by an account that holds check-in permission **and** is listed as a door operator for this event. Times must be actual, ordered and within four hours of the event; entries more than 15 minutes late need a paper-entry reason.
- Checkout of a participant without independent departure requires one of the registration's authorized collectors plus a real-world verification note. There is no administrator override.
- `GET /present` returns recorded present participants with an explicit coverage note: it is not a census of everyone in the building.

## Verification and remaining work

Isolated service/HTTP tests cover capacity, waitlist, offers, reinstatement and stale-policy rollback; event eligibility and guardian arrangements; separated receipt/refund duties and balances; door assignment, arrival, collector-only checkout and reentry; member self-registration, own projection and cancellation; and real cookies/MFA/CSRF. Registration integrity regressions also exercise a configured draft changing kind/audience, stale office/self form submissions, pinned historical forms, and actual HTTP arrival/checkout, receipts and refund requests through check-in-only/cashier-only accounts. These HTTP workflows obtain versions through their permitted projections and assert that private registration fields remain absent.

Not implemented: guest/public registration without an account and its provisional identity review, guardian registration for linked children (no representation model exists yet), transport rosters, registration exports/prints, registration-specific notifications and multilingual forms. Restricted incident records are a separate implemented slice; see their runbook and E07's retained acceptance gaps. Registration queries use the existing `eventId` index path. Refund/movement lists filter on `registrationId`, now added to the reviewed TenantControl index contract and `docs/cosmos/containers.json`; readiness reports a mismatch until the live policy covers it. Inspect the live policy first (a broad policy may already cover it); no index change is applied at startup.

Compatibility note: new office/self submission requests must include the form version actually viewed. This intentionally tightens the input contract. Previously successful submissions remain stored with their original form; no historical registration is relabeled or migrated. Old client payloads need updating before new submissions or retries that use this required contract; do not claim legacy registration receipt compatibility as established by the evidence-file retry checks.
