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

The later file and document/sacramental slices are described below and in their respective runbooks. Remaining intake work includes request duplicate detection/merge and verified-contact challenges for guest downloads; do not infer downstream workflow acceptance from the common case intake.

## Case files (Q11)

Source basis: S15.04–S15.07, S31.10 (proposed). Routes under `/api/parishes/{parish}/requests/{request}/files`. The case's signed-in applicant uses them personally, including an applicant without a parish Person link or MFA enrollment; office staff need requests.manage and current MFA. Both audiences require a currently verified parish and active requests coverage, including on reads and receipt replays. Nobody else sees that the files exist. These operational gates do not define a retention period or create a special historical-access exemption.

- `POST` (multipart form: `file`, `operationId`, optional `replacesId` and `reason`) accepts PDF, JPEG and PNG files of up to 10 MB, with up to 20 active files per case. The type is checked from the file signature; this is not malware scanning or a complete PDF/image parser. The supplied name (Arabic and French included) is kept but never used in the storage path, and a SHA-256 is recorded. A retry with the same operation id must supply identical bytes and metadata. Existing successful `evidence:v1` receipt fingerprints remain compatible; changed bytes on a committed retry return `operation_reused` (409), and a different staged object returns `evidence_content_conflict` (409).
- Replacing a file needs a reason and keeps the earlier version as `Replaced`, linked to its successor. Applicants can replace only their own uploads.
- `GET` lists files: office staff see all of them, applicants only their own uploads. `GET /{file}` downloads with the original name after checking the stored bytes against the committed size/SHA-256. Integrity failures return `evidence_integrity_unavailable` (503), without returning the incorrect content.
- `POST /{file}/remove` (office) needs a reason and the current file version. Content is never deleted here. An approved retention/deletion procedure remains a separate policy and operator task.
- Closed cases (completed, declined, withdrawn, cancelled) are read-only.
- Upload/removal atomically fence the original case and parish versions with the metadata/receipt. A concurrent closure, triage, parish change or competing capacity claim fails with `write_conflict`; callers reload before a new operation. Current authority is checked again after content I/O. Account changes outside the parish partition are rechecked, not claimed to be part of a cross-partition transaction.
- Storage: the local provider stages, flushes and publishes complete content under a per-path process lock; reads use the same lock. Its `.lock` files are coordination artifacts. Azure uses conditional creation in the existing private `evidence` container and verifies bytes/content type if another attempt already created the blob. Neither provider overwrites retained evidence. Failed metadata/authorization can leave unreferenced private staged content; there is no automatic deletion or invented retention policy. **Before use in Azure,** the managed identity needs data write/read access on the `evidence` container. That RBAC change was not made here; SDK-double tests do not prove live Azure behavior.

Not implemented: malware scanning, PDF page-count warnings, image processing/derivatives, files on other record types (registrations, expenses, sacramental cases, gallery), evidence reuse across cases, guest-token uploads and frontend.

## Opening records, file checklists, guest uploads and claim lists (fullstack2-requests)

Proposed mechanisms only; none is owner-approved policy.

- `POST /requests/{id}/records` (requests.manage, MFA; `OperationId`, `Version`, `RecordKind` SacramentalCase|Certificate, `Sacrament`, optional facts/tentative date or certificate source/language/copies/purpose). The case must be AcceptedForProcessing, of the matching kind (SacramentInquiry or Certificate) and matched to a person. The record is opened by `SacramentService.CreateAsync` or `CertificateService.CreateAsync`, so sacraments.record, MFA, sacraments coverage and their duplicate rules still apply; request access alone opens nothing and no register entry is made. Child operation ids are derived from the caller's operation id: a retry returns the same record and never adds a second link (the version is checked only before the first creation). The record and the link are two commits in the parish partition; a failure between them is completed by retrying the same operation.
- Uploads accept an optional `checklistKey` (an item of the case's checklist; a replacement keeps the earlier key). Uploads without a key keep the original `evidence:v1` fingerprint. `PUT /checklist` items may carry `EvidenceFileId`: a Received item needs a paper reference or an active file of the same case, which is fenced at its version in the checklist commit. Applicants and guests never see `EvidenceFileId` or paper references.
- Guests: `POST|GET /api/public/parishes/{p}/requests/{r}/files` with `X-ParishLife-Tracking` (rate limited, CSRF on upload). Same type/size/20-file/immutability rules, `UploaderRole` Guest, `UploadedBy` `guest:{request}`; guests list only their own uploads' metadata and never download. Once the case joins an account (token cleared) the link stops uploading. No malware scanning or retention rule is implied.
- `GET /api/me/request-claims`: each claim writes an account-partition pointer (`requestClaim:{request}`) before the parish claim commits; listing resolves the current case to Pending, Linked or NotPending (orphan pointers resolve to NotPending) and shows reference and verified parish name only.
- `GET /api/me/signer-profile` now returns `Version`, so the printed name can be replaced.
