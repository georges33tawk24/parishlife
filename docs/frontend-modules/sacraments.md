# Sacraments module

Files: `frontend/src/portal/model/modules/sacraments.js`, `features/records/sacraments*.jsx`, `certificate*.jsx`, `records-shared.jsx`, `sacrament-settings.jsx`. Check: `frontend/scripts/checks/sacraments.mjs`. Owns `SACRAMENTS` and `ANNIVERSARIES`; pages `sacraments`, `certificate`.

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
| office-review, requirement, sync-requirements, propose-amendment, approve-amendment, reject-amendment | `POST sacraments/{id}/actions` |
| The parish's preparation requirement lists | `GET sacraments/requirements`, `PUT sacraments/requirements` (priest) |
| The priest's own signature image | `GET clergy-signature-image`, `GET clergy-signature-image/content`, `POST clergy-signature-image` (multipart), `POST clergy-signature-image/remove` |
| The image attached to a signed certificate | `GET certificates/{id}/signature-image` |
| Actor names | `GET account-names?ids=` (shared lookup, `names.js`) |

Loaded for the priest and for grants with `sacraments.record`; a 403 (or 404 for a switched-off module) leaves the lists empty.

## Status reading

Sacrament: Received → requested · Preparation → preparing · Scheduled → scheduled · Celebrated → awaiting-signature (draft once returned) · Registered → registered · Declined → rejected · Cancelled → cancelled. Certificate: WaitingForSource/Received/Prepared/Returned → draft · AwaitingSignature → awaiting-signature · AwaitingBishop → awaiting-approval · AuthorizedForIssuance → approved · Issued/Released → issued · Withdrawn → withdrawn.

## Printing

The certificate is drawn from its frozen snapshot (`docRecord`), so a later register change never alters a prepared certificate. The electronic code and the API's copy statement are printed when present. The download menu adds the API's parish sheet (HTML, bishop-approved wording).

## Connected in the fullstack2-sacraments round

- **Office review**: a secretary marks a received request "reviewed by the office" with an optional note (`office-review`). The API status stays `Received`; the portal shows `office-reviewed`. It is informative only: the priest may accept or decline with or without it, and a review is recorded once.
- **Preparation requirements**: a priest saves the parish's own list per sacrament (labels typed in English and/or Arabic; there is no built-in list), and chooses whether a date may be confirmed only once every item is met. An accepted case gets a copy as its checklist; the office ticks items (who and when are kept) and can update an open case to the current list, keeping what was recorded for unchanged items. Screen: "Preparation requirements" on the Sacraments preparation tab; the checklist panel on the record page; a count in the preparation list.
- **Request amendments**: after acceptance the office proposes a new requested date and/or changed details (notes) with a reason; the request changes only when a priest approves, and a rejection needs a reason. All proposals and decisions are kept on the case.
- **Arabic spellings**: celebrant, place and witnesses have Arabic twins (`celebrantNameAr`, `placeAr`, `witnessesAr`; father and mother as facts `fatherAr`/`motherAr`). Each is saved as typed; either spelling satisfies "name the celebrant" and "record the place"; nothing is copied across. They reach the certificate snapshot and are correctable after registration like the other register facts. The printed sheet uses the document language's spelling (the other when only one was typed; both on the bilingual sheet).
- **Celebrant**: optionally linked to a person record of the parish (`celebrantPersonId`), beside the typed names and the existing account link.
- **Book and page**: `bookReference` is the book; `registerPage` is the page. Entries registered before keep whatever `bookReference` held.
- **Request date**: `createdAt`/`createdBy` on cases and certificates; shown as "Requested".
- **Actor names**: the module calls `loadNames` for every actor id it shows (timeline, review, checklist, amendments, certificate gates); a name the lookup does not reveal stays empty.
- **The priest's signature image**: a priest draws or uploads (PNG/JPEG, up to 1 MB, checked by content) his own image, kept in the private evidence store; replaced and removed versions are kept. When he approves (signs) a certificate, the image current at that moment is attached by id and hash; a later replacement never changes it, and a return clears it. Only the certificate's readers (office, priests, bishop, all with MFA) can read the attached image, and only he can read his own. It is printed on the signature line of the paper. It is **not an electronic signature**: it is not part of the electronic authorization content and proves nothing on its own (U05). `account/signature` (the account area) is untouched.

## Still not connected (and why)

- Godparents stay `witnesses`/fact `godparents` (no separate godparent model was asked for).
- Bishop resubmit panel: a return sends the certificate back to the office to prepare again.
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
8. **Signature image on paper (U05)**: may a printed image of the priest's signature appear on a certificate at all, and does a printed image replace or accompany his wet signature? Today it is printed on the signature line when he chose to keep one; the copy statement still says the wet-signed, sealed paper is official. Electronic-signature validity remains open and the image is never treated as one.
9. **Preparation rules**: which requirements each sacrament has, and whether a date waits for all of them, are the priest's/parish's choice; no list or default exists. Whether the office may tick items alone or a priest must confirm some of them is not decided (today the office ticks).
10. **Certificate wording**: nothing about the signature image, Arabic spellings or the page was added to the bishop-approved wording or the parish sheet (`certificates/{id}/sheet`); the HTML sheet does not embed the image.
11. **Office review**: whether a review should be required before a priest decides is not decided; it is informative today.
12. **Request amendments** change only the requested date and request details (facts). Whether other things (the sacrament, the person) may change after acceptance is not decided; today that needs cancelling and a new request.
