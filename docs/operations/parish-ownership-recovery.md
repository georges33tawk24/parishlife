# Contested parish ownership and administration recovery (SUB12)

A restricted review for duplicate registrations, departed administrators or wrong church matches. Source: SUB12 in the updated workflow register (`ParishLife-workflows-review-updated.md`). The owner decided on 23 November 2026 (OWNER-QUESTIONS, question 10): a ParishLife operator decides only after the archdiocese/bishop confirms, and the parish is read-only while contested. The evidence rules below are still implementation choices.

## Who acts
- **Claimant:** any active verified account with MFA, personal capacity, not the current owner. One open claim per claimant per parish.
- **Current owner:** receives a generic in-app notice (no claimant identity or evidence), sees only the claim's existence/status, and may respond.
- **Church:** the current bishop of the parish's confirmed archdiocese, not a party to the claim, sees the full claim and answers "confirms" or "disputes" with a note. A later answer replaces an earlier one while the claim is open.
- **Reviewer:** one current MFA platform operator, independent of the claimant and the current owner, who records a decision reason and an evidence reference. Recovery needs the church's "Confirmed"; rejection does not.

## Routes
`/api/parishes/{parishId}/ownership-claims`: `POST` (open: `statement`, `evidenceReference`), `GET` (owner, reviewer or bishop), `GET /{id}` (claimant, owner, reviewer or bishop — each a different projection), `POST /{id}/response` (owner), `POST /{id}/withdraw` (claimant), `POST /{id}/church-confirmation` (bishop: `version`, required `confirmed`, `note`), `POST /{id}/decision` (reviewer: `version`, required `recover`, `reason`, `evidenceReference`).

## Rules
- Opening a claim grants nothing; rejected or withdrawn claims expose no parish records.
- **Read-only while contested:** opening a claim sets the parish's `ownershipContested` in the same commit. While any claim is open, parish access refuses every permission that does not end in `.read` (`parish_contested`), for grants and selected appointments alike, including the owner's. Parishioners' own self-service is unaffected, and so are the priest's own clergy actions (signing certificates and letters), which come from the archdiocese appointment rather than parish control. The mark clears when the last open claim is withdrawn, rejected or recovered.
- **Known effect:** any verified account with two-factor can make a parish read-only by opening a claim, until an operator rejects it or the claimant withdraws. Operators should review new claims promptly.
- **No confirmed archdiocese:** a parish without one has no church to confirm, so it cannot be recovered here (rejection still works).
- Recovery (one parish transaction, fenced on the parish document): owner becomes the claimant; the prior owner's local grant is revoked (kept, not deleted); the claimant receives the ordinary setup-owner grant, which contains no clergy approval or signing authority; a pending payer transfer and pending association proposals made under the old control are withdrawn and listed in `reconciledRecords`. Staff grants, appointments, coverage, invoices, receipts and all records stay.
- A claim opened against a different owner than the current one is refused (`owner_changed`), so competing claims cannot install two owners. Closed parishes are not recovered here.
- Exact retries replay; stale versions conflict; recovery sessions and selected appointments are refused.

## Not delivered
Approved evidence/verification policy, a second reviewer or appeal, out-of-band contact of representatives, a cross-parish reviewer worklist, notifications to the bishop or of the outcome, and exceptional record access for support. Local tests do not prove live Cosmos behavior.
