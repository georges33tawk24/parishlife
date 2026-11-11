# Contested parish ownership and administration recovery (SUB12)

A restricted review for duplicate registrations, departed administrators or wrong church matches. Source: SUB12 in the updated workflow register (`ParishLife-workflows-review-updated.md`), a *proposed* workflow; its "verification/appeal policy remains an input". The reviewer and evidence rules below are implementation choices, not owner-approved policy.

## Who acts
- **Claimant:** any active verified account with MFA, personal capacity, not the current owner. One open claim per claimant per parish.
- **Current owner:** receives a generic in-app notice (no claimant identity or evidence), sees only the claim's existence/status, and may respond.
- **Reviewer (proposed):** one current MFA platform operator, independent of the claimant and the current owner, who records a decision reason and an evidence reference. No second reviewer, appeal or church-authority confirmation is implemented; archdiocese registration is not required.

## Routes
`/api/parishes/{parishId}/ownership-claims`: `POST` (open: `statement`, `evidenceReference`), `GET` (owner or reviewer), `GET /{id}` (claimant, owner or reviewer — each a different projection), `POST /{id}/response` (owner), `POST /{id}/withdraw` (claimant), `POST /{id}/decision` (reviewer: `version`, required `recover`, `reason`, `evidenceReference`).

## Rules
- Opening a claim grants nothing; rejected or withdrawn claims expose no parish records.
- Recovery (one parish transaction, fenced on the parish document): owner becomes the claimant; the prior owner's local grant is revoked (kept, not deleted); the claimant receives the ordinary setup-owner grant, which contains no clergy approval or signing authority; a pending payer transfer and pending association proposals made under the old control are withdrawn and listed in `reconciledRecords`. Staff grants, appointments, coverage, invoices, receipts and all records stay.
- A claim opened against a different owner than the current one is refused (`owner_changed`), so competing claims cannot install two owners. Closed parishes are not recovered here.
- Nothing is frozen while a claim is open: the sources do not ask for it, and freezing would let any claimant block a parish.
- Exact retries replay; stale versions conflict; recovery sessions and selected appointments are refused.

## Not delivered
Approved evidence/verification policy, a second reviewer or appeal, out-of-band contact of representatives, a cross-parish reviewer worklist, notifications of the outcome, exceptional record access for support, and the frontend. Local tests do not prove live Cosmos behavior.
