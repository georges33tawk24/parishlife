# Future subscription payer transfer (SUB09)

Moves who pays for a parish's **future** subscription coverage between the parish itself and a registered, verified archdiocese, in either direction. Source: SUB09 in the updated workflow register (`ParishLife-workflows-review-updated.md`), which is a *proposed* workflow; the authority rules below are implementation choices recorded as proposals, not owner-approved policy (the register lists "who can authorize a payer transfer" as an open input).

## Who acts (proposed)
- **Parish side:** the parish's controlling owner, holding `billing.manage`, acting in personal capacity (no selected appointment) with MFA, on an open verified parish.
- **Archdiocese side:** the verified archdiocese's registered representative (its owner account), personal capacity, MFA. No bishop or clergy office is implied or required.
- Either side proposes (its own approval is recorded); the **other** side accepts or declines the exact version. The proposer cannot approve for the other side. Only the proposing side can cancel; the other side declines.
- At acceptance the proposing approval must still come from that side's *current* representative (after an ownership recovery it does not: `approval_stale`).

## Routes
- `POST /api/parishes/{parishId}/payer-transfers/archdioceses/{archdioceseId}` — parish proposes. `POST /api/archdioceses/{archdioceseId}/payer-transfers/parishes/{parishId}` — archdiocese proposes. Body: `direction` (`ToArchdiocese`|`ToParish`), `effectiveFrom`, `acceptBy`, `reason`.
- `GET /api/parishes/{parishId}/payer-transfers[/{id}]`, `POST .../{id}/decision` (`version`, required `accept`), `POST .../{id}/cancel`, `GET /api/parishes/{parishId}/payer-schedule`.
- Sponsored invoices: `POST /api/archdioceses/{id}/billing/parishes/{parishId}/invoices`, `GET /api/archdioceses/{id}/billing/invoices/{invoiceId}` (representative); `POST .../invoices/{invoiceId}/cash-receipts` and `GET /api/administration/archdioceses/{id}/invoices/{invoiceId}` (platform operator).

## Rules
- Lifecycle: `AwaitingParish`/`AwaitingArchdiocese` → `Accepted` | `Declined` | `Cancelled`; a pending proposal past `acceptBy` reads as `Expired`, cannot be accepted, and is stored as `Expired` when the next proposal is made. One proposal may be pending per parish.
- Never retroactive: `acceptBy` is in the future and no later than `effectiveFrom`; `effectiveFrom` follows the last scheduled change. Acceptance is refused while paid coverage (`paid_coverage_after_effective_date`) or money already recorded on the former payer's invoice (`paid_invoice_after_effective_date`) runs past the effective date. No credit, proration or refund policy is invented.
- Acceptance only appends a dated period to the parish's payer schedule, fenced on the parish document like every coverage writer. Paid periods, invoices, receipts, data, users, grants and association are untouched.
- Enforcement: a parish invoice is refused for periods another payer covers (`payer_not_parish`); an archdiocese invoices only whole periods its schedule assigns to it (`payer_not_archdiocese`); cash is refused on an invoice whose period changed payer (`payer_changed`); paid activation whose billing account does not match the schedule goes to `NeedsReview`, never to coverage.
- Exact retries replay; stale versions conflict; strangers get not-found.

## Not delivered
Notifications to billing contacts, an archdiocese worklist of its sponsored parishes/transfers, multi-parish central contracts (SUB06), voiding stale invoices, credits/refunds, real payment providers, the frontend. Local tests do not prove live Cosmos behavior; the cross-container invoice check before acceptance is a read, backed by the cash-time and activation-time schedule checks.
