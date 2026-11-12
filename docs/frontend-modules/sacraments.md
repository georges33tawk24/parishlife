# Sacraments module

Files: `frontend/src/portal/model/modules/sacraments.js`, `features/records/sacraments*.jsx`, `certificate*.jsx`, `records-shared.jsx`. Check: `frontend/scripts/checks/sacraments.mjs`. Owns `SACRAMENTS` and `ANNIVERSARIES`; pages `sacraments`, `certificate`.

`SACRAMENTS` stays one list so people, requests and the dashboard keep working: a sacrament case has `kind: 'baptism' | 'communion' | …`, a certificate request has `kind: 'certificate'` and `certificateOf`. Each record keeps the API status in `apiStatus` and the ETag in `version`. Edits are made through the module's `actions`, each followed by `hydrate()`; any direct edit of the lists is undone and reported.

## Routes used (`/api/parishes/{id}/…`)

| Purpose | Route |
| --- | --- |
| Register, per sacrament (7 searches, `cursor` paging) | `GET sacraments?sacrament=&size=100` |
| New case | `POST sacraments` |
| accept, decline, cancel, schedule, reschedule, record-celebration, amend-facts, return-entry, register | `POST sacraments/{id}/actions` |
| Corrections to a registered entry | `GET sacraments/corrections`, `POST sacraments/{id}/corrections`, `POST sacraments/corrections/{id}/decision` |
| Anniversaries (next 92 days, registered dates only) | `GET sacraments/anniversaries?from=&days=92` |
| Certificates | `GET certificates`, `GET certificates/{id}`, `POST certificates` |
| link-source, prepare, submit, sign, accept, return, issue, release, withdraw, cancel | `POST certificates/{id}/actions` |
| Electronic authorization | `GET certificates/{id}/authorization-preview`, `POST certificates/{id}/authorization` |
| Parish sheet (approved wording) | `GET certificates/{id}/sheet` |
| Child not yet in People | `POST people` (People's route) |

Loaded for the priest and for grants with `sacraments.record`; a 403 (or 404 for a switched-off module) leaves the lists empty.

## Status reading

Sacrament: Received → requested · Preparation → preparing · Scheduled → scheduled · Celebrated → awaiting-signature (draft once returned) · Registered → registered · Declined → rejected · Cancelled → cancelled. Certificate: WaitingForSource/Received/Prepared/Returned → draft · AwaitingSignature → awaiting-signature · AwaitingBishop → awaiting-approval · AuthorizedForIssuance → approved · Issued/Released → issued · Withdrawn → withdrawn.

## Printing

The certificate is drawn from its frozen snapshot (`docRecord`), so a later register change never alters a prepared certificate. The electronic code and the API's copy statement are printed when present. The download menu adds the API's parish sheet (HTML, bishop-approved wording).

## Fields with no API equivalent (left empty or removed)

- Office review step (`office-reviewed`): button removed; the priest decides directly.
- Preparation checklist and per-sacrament requirements: removed (no demo requirements are shown).
- Request amendment proposed/approved/rejected after acceptance: removed. Registered entries use the API's priest-approved corrections instead (new).
- Arabic spelling of a name, celebrant as a person record (the API holds a name text or account), separate book and page (one `bookReference`), godparents as their own field (stored as `witnesses`/fact `godparents`).
- Actor names: the API returns account ids, so history shows what and when, not who.
- Request date of a certificate: not returned.
- Handwritten signature drawing: none; the priest signs the paper. `account/signature` and passkey signing are not used.
- Bishop resubmit panel: a return now sends the certificate back to the office to prepare again.
- Planned-sacrament link on a certificate request: the API only links an entry that is registered.
- `SRQ/xxxxxxxx` is a display handle from the record id for an open case, not an official number.

## Open decisions for the owner

1. The API has no parish time zone; dates and times use the office browser's clock, sent as UTC.
2. No screen yet sets the numbering scheme (`PUT sacraments/numbering`), the bishop-approved wording (`PUT/POST document-templates`) or the certificate policy and signature arrangement; registering or authorizing fails with the API's message until they exist.
3. Secretaries cannot accept/decline without a recorded instruction from a priest (`instructingPriestAccountId`); no form for it exists, so those buttons are priest-only.
4. Sacrament and certificate writes need two-factor proof on the session; without it the lists load empty.
5. Names of people not in People (accounts without `people.read`) show empty; the API's record carries only the person id.
6. Bishop acceptance needs a bishop in a parish context; the session maps a bishop to no parish today.
7. Public verification page wording (`GET /api/public/document-verifications/{code}`) belongs to the public module.
