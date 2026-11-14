# Requests module

Connects the office queue, the member's own requests, requests without an account, guest tracking, the A13 account link and request documents to `ParishLife.Api` (`RequestsController`, `GuestRequestsController`, `EvidenceController`).

Files: `frontend/src/portal/model/modules/requests.js` (load and every call), `model/guest-requests.js` (anonymous calls and the tracking link), `features/records/{requests,requests-case,online-requests,guest-requests,request-documents}.jsx`, `features/member/{requests,requests-shared,request-form,request-form-checks,request-detail,request-follow}.jsx`, `features/account/guest-links.jsx` (the account-link panel, requests-only, edited in the account folder), `public/pages/{RequestPage,TrackingPage}.jsx`. Check: `frontend/scripts/checks/requests.mjs`.

## Collections and pages

- `MEMBER_REQUESTS`: the office queue (every case, guests included, told apart by `origin`). Loaded for a priest or a grant with `requests.manage`.
- `MY_REQUESTS` (new in `data.js`): the signed-in person's own cases (`GET .../requests/mine`), in the shape the member screens read.
- Pages: `requests`, `guestrequests`, `myrequests`. Both collections are read-only on screen; every change is an API action followed by a reload.
- Not claimed: `PORTAL_REQUESTS` and `REQUEST_HISTORY` (address-change and new-family requests): they have no Requests API equivalent. They belong with People (membership requests and corrections) and stay empty.

## Routes used

| Purpose | Route |
| --- | --- |
| Office queue (paged with `size` ≤ 100 and `cursor`) | `GET /api/parishes/{p}/requests` |
| Own requests | `GET .../requests/mine`, `POST .../requests` |
| One case with its version | `GET .../requests/{id}` |
| Office decisions: `triage`, `accept`, `return`, `decline`, `cancel`, `clergy-approve`, `confirm-date`, `complete`, `match-subject`, `review-authority`; applicant: `withdraw`, `respond`, `request-cancel` | `POST .../requests/{id}/actions` (version and operation id) |
| Checklist | `PUT .../requests/{id}/checklist` |
| Messages (Applicant or Internal), history | `GET/POST .../requests/{id}/messages`, `GET .../history` |
| Private files: list, multipart upload/replace, download, remove | `.../requests/{id}/files`, `.../files/{fileId}`, `.../files/{fileId}/remove` |
| A13: claim, decide, replace a leaked link | `POST .../requests/{id}/claim` (header `X-ParishLife-Tracking`), `.../association`, `.../rotate-tracking` |
| Guest: send, follow, message | `POST /api/public/parishes/{p}/requests`, `GET .../requests/{id}`, `GET/POST .../requests/{id}/messages` (header `X-ParishLife-Tracking`; `X-Turnstile-Token` on submit when set) |
| Open the record an accepted case needs (sacramental case or certificate) | `POST .../requests/{id}/records` (operation id, version, record kind, sacrament; certificate language, copies, purpose) |
| Files named for a checklist item; a received item names a case file | multipart field `checklistKey`; checklist item `evidenceFileId` |
| Letters: draft, revise, preview, priest signature, release, withdraw; the applicant's released letters | `GET/POST .../requests/{id}/letters`, `PUT .../letters/{l}`, `GET .../letters/{l}/authorization-preview`, `POST .../letters/{l}/authorization`, `.../release`, `.../withdraw`, `GET .../requests/{id}/letters/mine` |
| Printed name for electronic authorization | `GET/PUT /api/me/signer-profile` (GET now returns the version a replacement sends) |
| The account's guest-request claims | `GET /api/me/request-claims` |
| Guest: letters (title and status only), own files and uploads | `GET /api/public/parishes/{p}/requests/{id}/letters`, `GET/POST .../requests/{id}/files` (header `X-ParishLife-Tracking`, CSRF on upload) |
| Names of assignee, message authors and history actors | `GET /api/parishes/{p}/account-names` through `model/names.js` |

## How the old screens map

- Kinds: baptism, communion, confirmation, marriage, funeral → `SacramentInquiry` (the sacrament in `details.sacrament`); certificate → `Certificate`; booking → `Facility`; a general request's topic → `Blessing`, `MassIntention`, `Visit`, `PriestAppointment` or `General`. The public form adds `PriestAppointment` and `MinistryInquiry`.
- The portal's `details` object is stored in the API's string dictionary (a child's fields become `childLat`, `childAr`, …); `guests` is stored as text.
- Status: Received, NeedsInformation, AcceptedForProcessing, CancellationRequested, Completed, Declined, Withdrawn, Cancelled. The member's steps use only moments the API recorded.
- The tracking link is `public.html#track=<parishId>.<requestId>.<token>`: the API needs the parish and request as well as the token, and the fragment never reaches a server.
- `request.start` visits: already counted by `lib/beacon.js` when the request page is shown (no change needed). `publicRequests` is now `true`.

## Now connected (fullstack2-requests)

- **Accepting, then opening the record.** Acceptance stays its own decision. On an accepted sacrament inquiry or certificate request, the case view (`features/records/request-record.jsx`) opens a sacramental case or a certificate through `SacramentService`/`CertificateService`, which keep their own rules: sacraments.record with MFA, sacraments coverage, a matched person (`match-subject` first), the once-only duplicate check. Request access alone opens nothing. A sacramental case starts at Received: nothing is written in the register until a priest registers it. A certificate without a chosen register entry waits for its source. The case links the record; the same operation id (kept on screen until success) never opens or links twice. Linked records are listed by kind.
- **File checklists.** An upload may name the checklist item it answers (applicant, office and guest); a replacement keeps its item. The office marks an item received with a paper reference, an active file of the case, or both; naming an item never marks it received. Applicants see the checklist (status only) and choose the item when uploading.
- **Guest documents.** On the tracking page a guest sees the checklist, sends PDF/JPEG/PNG files (up to 10 MB, the case's 20-file limit) naming an item, and sees the names of the files they sent. Nothing downloads through the bearer link (S15.11), and the office sees these files as "guest, through the tracking link". After the case joins an account the link stops uploading.
- **Letters.** The case view (`features/records/request-letters.jsx`) drafts, revises, replaces, signs (priest: preview hash and a fresh authenticator code, never kept), releases (re-entered reference and addressee, the signed hash; account or in person with identity evidence) and withdraws letters. Members see released letters on their request (`features/member/request-letters-mine.jsx`), with text, signer and code only when released to their account. Guests see title, reference, status and the API's statement, never the text or code. Every view shows the U05 statement: reference only unless the archdiocese approved an electronic-signature arrangement.
- **Signer setup.** `features/account/signer-profile.jsx` (on My account for priests, and inline before a first signature) saves the printed name. The old passkey signing (`model/signing.js`, `POST /api/sign/options`) is removed; the drawn-signature panel on My account (`account/signature`) still calls the old server and belongs with the sacraments/account work.
- **Pending claims.** My account lists the account's claims (reference, parish, waiting / linked / no longer waiting) from an account-partition pointer written when the claim is made.
- **The generic upload component** (`ui/components.jsx` `Dropzone`) no longer calls `parishes/{id}/files`: scope `request` stores private case files through the evidence routes. A person's or a group's files (`person.jsx`, `groups.jsx`) have no API file store; their drop area says "not connected" and sends nothing. Those stores belong to the people and ministries areas.
- Names: assignee, message authors and history actors use the shared lookup; ids it may not reveal show the previous neutral labels.

## Fields and features with no API equivalent

- Reservations from a booking request: a reservation needs an exact draft event and rooms (`ReservationService`), so the office still creates it in the calendar; the case's `link` action can record it, but there is no record picker on screen.
- Matching a child to People, choosing the register entry for a certificate on screen, room availability and capacity, the list of rooms, and "who in my household" for members: none are in the Requests API. Members describe the place and any other person in words; the office matches the person (`match-subject`).
- Documents on sacrament entries, service requests and office expenses, and person or group files, have no file route; their uploads say "not connected".
- Delivery choice ("secure download") on the public form stays removed: nothing delivers files to guests.
- The portal's phone for a parish, prefilled `M.person.phone` and the member nav gate on `person_id` belong to the member module.

## Open owner decisions

1. **Guests cannot withdraw or answer.** `RequestActionDto.Version` is required, but `GET /api/public/parishes/{p}/requests/{id}` returns no version or ETag. Guests can message the office and send files. The API should return the version (or accept guest actions without it).
2. **Guest file delivery.** Should an office-reviewed document or a signed letter reach a guest's tracking link, and how (S15.11 says a bearer link is not download identity; U10 contact challenges are not built)? Today guests collect in person or link an account.
3. **Accept side effects.** Opening the record is a separate, explicit office step after acceptance. Should acceptance open it automatically, and should a booking request create its reservation?
4. **Guest uploads.** Implemented as a neutral mechanism (token header, rate limit, CSRF, 10 MB, 20 active files per case, no download, no malware scanning). Confirm that guests may send files at all, and whether a retention period applies.
5. **Electronic signatures (U05).** Signed letters stay "reference only" until the archdiocese records an approved arrangement; the validity of electronic signatures is an owner question.
6. **Turnstile.** The anonymous request routes, guest uploads included, are rate-limited but not `[TurnstileProtected]`.
7. **Member nav.** The member menu is empty without `person_id`, which hides `myrequests` for accounts not linked to a person, although the API allows them to ask.

## Verified

`npm ci`, `npm run format:check`, `npm run check` (incl. `scripts/checks/requests.mjs`), `npm run check:routes` and `npm run build` pass; backend tests in `ParishLife.IntegrationTests/RequestCompletionTests.cs` cover the new routes and rules. Not verified against a live API: it needs a verified account with `requests.manage` and MFA. Screens were not rendered in a browser here.
