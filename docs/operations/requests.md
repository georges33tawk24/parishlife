# Request case operations

Updated 10 November 2026. Source basis: S11.01–S11.15 and the intake parts of S12–S14 (proposed). One case, with one stable reference (`R-…`), timeline and message thread, runs from intake to closure. Member and office routes are under `/api/parishes/{parish}/requests`; guest routes are under `/api/public/parishes/{parish}/requests`. The parish must be verified and the requests module covered.

## Intake

- **Members** (`POST /requests` with no `Origin`): any signed-in personal account, linked or not, can submit. Kinds are SacramentInquiry, Certificate, Facility, PriestAppointment, MassIntention, Blessing, Visit, MinistryInquiry and General, each with up to 30 detail fields and preferred dates. A linked member asking for themselves gets their own Person as the subject; applicants never select parish records.
- **Office** (`POST /requests` with `Origin` Telephone, Paper or InPerson; requests.manage): records the real requester name/contact, origin and entering account. It is not the applicant's own digital submission or consent.
- **Guests** (`POST /api/public/.../requests`, rate-limited, CSRF still required): name, contact, subject description and relationship. The response returns a reference and a private tracking token once; only its SHA-256 is stored. The token is sent in the `X-ParishLife-Tracking` header (never the URL) to read the case, read applicant-visible messages, reply, respond to a request for information or withdraw.
- Requester, subject, relationship and authority basis are separate. A request for anyone else needs an authority basis at intake, and the office must `review-authority` before accepting it.

## Office handling (`POST /requests/{id}/actions`, requests.manage)

| Action | Meaning |
| --- | --- |
| triage | Assignee, urgency (Urgent needs a reason), deadline and next action |
| accept | Received → AcceptedForProcessing |
| return | → NeedsInformation with an applicant-visible explanation; the applicant's response resumes the saved stage |
| decline / cancel | With an applicant-visible explanation |
| clergy-approve | A current parish priest records approval; it is a separate fact from acceptance |
| confirm-date | Needs every required checklist item received (or not applicable) and, for sacramental inquiries, priest approval |
| complete | After any confirmed date |
| match-subject / review-authority | Office identity matching and authority review, with evidence |
| link | Links a reservation, event, registration, sacramental record or certificate without changing the reference |

`StatusMeaning` keeps Received, Accepted for processing, Approved by priest, Date confirmed and Completed distinct. `PUT /requests/{id}/checklist` records required/optional paper evidence (Received needs a paper reference; the verifier and time are kept).

## Applicants

`edit` and `withdraw` work only while the case is unhandled; after acceptance, `request-cancel` asks the office instead. `respond` answers a request for information. `GET /requests/mine`, `/requests/{id}` and `/requests/{id}/messages` show the applicant projection: no triage data, internal notes, authority review text, paper references or staff identities. `POST /requests/{id}/messages` posts applicant-visible messages; the office may also post Internal notes, which applicants and guests never receive. `GET /requests/{id}/history` (office) keeps the case before every change.

## Guest case association and leaked links (A13)

- A signed-in account that holds the guest tracking token calls `POST /requests/{id}/claim` with the `X-ParishLife-Tracking` header. The case stays a guest case: the claimant cannot read it through the account yet, and a second account cannot claim while one waits.
- `POST /requests/{id}/association` (requests.manage, by a reviewer other than the claimant) with the current version approves with an identity-review evidence note or declines with a reason; both are kept as internal notes. Approval makes the claimant the applicant and switches the bearer tracking link off; the claimant gets one required notification either way.
- `POST /requests/{id}/rotate-tracking` with a reason replaces a leaked link after identity review, clears any waiting claim and returns the new token once for the office to pass on.

Not implemented: file uploads (Q11), document release/collection (Q13), duplicate detection/merge, verified-contact challenges for guest downloads, fees/offerings and the downstream sacramental register workflow (S cards).

## Case files (Q11)

Source basis: S15.04–S15.07, S31.10 (proposed). Routes under `/api/parishes/{parish}/requests/{request}/files`. The case's signed-in applicant uses them personally; office staff need requests.manage, current MFA and the requests module. Nobody else sees that the files exist.

- `POST` (multipart form: `file`, `operationId`, optional `replacesId` and `reason`) accepts PDF, JPEG and PNG files of up to 10 MB, with up to 20 active files per case. The type is decided by the file's actual content; a name or declared type that does not match is refused. The supplied name (Arabic and French included) is kept but never used in the storage path, and a SHA-256 is recorded. A retry with the same operation id returns the same file.
- Replacing a file needs a reason and keeps the earlier version as `Replaced`, linked to its successor. Applicants can replace only their own uploads.
- `GET` lists files: office staff see all of them, applicants only their own uploads. `GET /{file}` downloads with the original name.
- `POST /{file}/remove` (office) needs a reason. Content is never deleted here; physical deletion follows the retention rules.
- Closed cases (completed, declined, withdrawn, cancelled) are read-only.
- Storage: the local storage provider writes under its own folder. Azure uses the existing private `evidence` container, writing each blob once (no overwrite) with the managed identity. **Before use in Azure,** that identity needs data write and read access on the `evidence` container. That RBAC change was not made here.

Not implemented: malware scanning, PDF page-count warnings, image processing/derivatives, files on other record types (registrations, expenses, sacramental cases, gallery), evidence reuse across cases, guest-token uploads and frontend.
