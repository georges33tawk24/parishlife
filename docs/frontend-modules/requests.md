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

## How the old screens map

- Kinds: baptism, communion, confirmation, marriage, funeral → `SacramentInquiry` (the sacrament in `details.sacrament`); certificate → `Certificate`; booking → `Facility`; a general request's topic → `Blessing`, `MassIntention`, `Visit`, `PriestAppointment` or `General`. The public form adds `PriestAppointment` and `MinistryInquiry`.
- The portal's `details` object is stored in the API's string dictionary (a child's fields become `childLat`, `childAr`, …); `guests` is stored as text.
- Status: Received, NeedsInformation, AcceptedForProcessing, CancellationRequested, Completed, Declined, Withdrawn, Cancelled. The member's steps use only moments the API recorded.
- The tracking link is `public.html#track=<parishId>.<requestId>.<token>`: the API needs the parish and request as well as the token, and the fragment never reaches a server.
- `request.start` visits: already counted by `lib/beacon.js` when the request page is shown (no change needed). `publicRequests` is now `true`.

## Fields and features with no API equivalent

- **Accepting no longer creates anything.** The old accept made a sacrament entry or a booking; the API only records the case (and `link` actions to record ids). The office enters the sacrament or booking in its own page. The case view lists links but offers no UI to add one (needs a record picker).
- Matching a child to People, choosing the register entry for a certificate, room availability and capacity, the list of rooms, and "who in my household" for members: none are in the Requests API. Members describe the place and any other person in words; the office matches the person (`match-subject`).
- Files are not tied to a checklist item; a received item carries a typed paper or file reference.
- **Guest files and signed letters:** a guest sees status, the office's message and messages only. Releasing a document to the tracking link and signed letters on the tracking page were removed. Documents on sacrament entries, service requests and office expenses have no file route; their uploads say "not connected".
- Delivery choice ("secure download") on the public form was removed, since nothing delivers files to guests.
- The account page cannot list pending claims (no route), so it shows only the result of the claim just sent.
- Names shown for assignee and authors: the API returns account ids only, so the case view says "You" or "Another office member".
- The portal's phone for a parish, prefilled `M.person.phone` and the member nav gate on `person_id` belong to the member module.

## Open owner decisions

1. **Guests cannot withdraw or answer.** `RequestActionDto.Version` is required, but `GET /api/public/parishes/{p}/requests/{id}` returns no version or ETag. Guests can only message the office. The API should return the version (or accept guest actions without it).
2. **Guest file delivery.** Should an office-reviewed document reach a guest's tracking link, and how? Signed letters likewise.
3. **Accept side effects.** Should accepting a booking or a sacrament request create the reservation or entry (as the old server did), or stay a manual step with a link?
4. **Turnstile.** The anonymous request routes are rate-limited but not `[TurnstileProtected]`; the form sends the token when Turnstile is on, and blocks the send until the check is solved.
5. **Member nav.** The member menu is empty without `person_id`, which hides `myrequests` for accounts not linked to a person, although the API allows them to ask.

## Verified

`npm ci`, `npm run format:check`, `npm run check` (incl. `scripts/checks/requests.mjs`) and `npm run build` pass. Not verified against a live API: it needs a verified account with `requests.manage` and MFA. Screens were not rendered in a browser here.
