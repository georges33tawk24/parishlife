# Membership and profile corrections operations

Updated 10 November 2026. Source basis: S03.05, S07.03–S07.11 (proposed answers). Personal routes need an ordinary personal session (no acting appointment, no recovery session); office routes need people.write, current MFA and the office module.

## Following and primary parish

- `POST` / `DELETE /api/parishes/{parish}/follow` and `PUT /api/parishes/{parish}/primary` are personal preferences stored with the account. `GET /api/me/parishes` lists followed parishes with `Member` (active verified person link) or `Following`, primary first.
- Unfollowing never ends an approved membership, staff appointment, ministry role or open request. Leaving an approved membership is a separate reviewed process and is not implemented.

## Membership requests

- `POST /api/parishes/{parish}/membership-requests` submits names, birth date, optional contact, locality and note, and follows the parish. One waiting request (Submitted or NeedsInformation) per applicant; an already linked account cannot apply again. `GET .../mine` and `POST .../{request}/withdraw` serve the applicant, who never sees internal reviewer identities or the matched person id.
- `GET .../membership-requests` is the office queue. `POST .../{request}/decision` takes the current version and one action:
  - `link` an existing person with an identity-review evidence reference (the verification note, not a copy of identity documents);
  - `create-person` creates the official Person inside the review. A non-archived person with the same names and birth date blocks this unless the reviewer sets `AllowPossibleDuplicate`;
  - `return` (NeedsInformation) or `decline` with an applicant-visible reason.
- The applicant cannot decide their own request, and the existing link/claim rules still block reassigning an account or person already linked elsewhere. A retry after the link committed but the request did not finishes the request instead of creating another person. Each decision leaves one required in-app notification for the applicant.

## Profile corrections

- A linked member proposes corrections to GivenName, FamilyName, BirthDate (yyyy-MM-dd) or Contact with `POST /api/parishes/{parish}/profile-corrections`; names and birth date need an evidence note. One pending correction per person; withdraw it to propose something else. Sacramental facts, register numbers and another adult's details are never editable here.
- The office lists pending items with `GET .../profile-corrections` and reviews with `POST .../{correction}/review`, deciding every field once; a declined field needs a reason. Approved fields change the Person in the same transaction, and the correction keeps the old and new value of every field. If the official value changed after the proposal, approval is refused so it cannot be silently overwritten.
- `GET .../profile-corrections/mine` shows the member each field's decision and reason; the review leaves one required notification.

## Person invitations (A11)

- `POST /api/parishes/{parish}/people/{person}/invitations` (office) issues a single-use invitation for an unlinked person, valid for seven days. The token is returned once and marked `NotSent`: no delivery channel is configured, so the office hands it over itself. Issuing again revokes every earlier open invitation for that person without changing the target. `GET .../person-invitations` (optionally `personId`) and `POST .../person-invitations/{id}/revoke` manage them.
- The recipient signs in with their own verified account and sends the token in the `X-ParishLife-Invitation` header to `GET .../person-invitations/{id}/preview` (parish, person name, purpose and expiry while it is usable; only the status otherwise) and `POST .../accept`. Accepting creates the person link and claim; it grants no ministry membership or staff authority. Retrying a successful accept returns the existing association.
- If the account or the person is already linked elsewhere, the invitation stops in `NeedsReview` without revealing the other record and the issuing office user gets a required notification. Expired, used and revoked invitations cannot be accepted.

Not implemented: combined personal activity across parishes (A09), reviewed leaving of a membership, wrong-link dispute/correction, staff counterproposals the applicant confirms, applicant replacement of a pending proposal, and frontend.
