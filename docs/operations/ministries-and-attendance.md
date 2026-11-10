# Ministries and attendance operations

Updated 9 November 2026. These are implemented backend slices, not full S18–S20 product acceptance. The single production API uses the existing TenantControl container and parish partitions. Nothing in this runbook provisions resources, creates initial parish data or connects the frontend.

## Authorities and safe projections

Ordinary administration, assigned ministry leadership, actual selected parish-priest office, membership and personal identity links are distinct. Every protected path rechecks the current account/scope/dates/denials. Office/leader endpoints do not make a technical Super Admin into a priest.

- `GET /api/public/parishes/{parish}/ministries` returns explicitly approved, published descriptions only. It excludes rosters, account/person identities, internal eligibility references and private files. Intake availability also reflects current coverage.
- `GET /api/parishes/{parish}/ministries/{ministry}/member-info` returns a safe approved group overview to a currently linked, current member, including unlisted groups. It exposes no roster/internal policy references. Ordinary setup/detail routes remain separately protected.
- An `X-ParishLife-Appointment` selects one current office. Personal applications/replies/security changes reject an organizational selection; a selected office does not fall back to unrelated grants.
- Ministry leaders require current verified MFA accounts and their exact dated appointment. Generic ministries.manage is not an attendance or confidential-reason permission.

## Setup and public listing

Use POST `/api/parishes/{parish}/ministries` to create a draft and PUT `/{ministry}` to edit only a draft, with the current Version/ETag. Supported operational kinds are Ministry, Choir, Class, Committee and Team; the label changes no authority.

POST `/{ministry}/actions` accepts separate approve, publish, unpublish, archive, restore, open-applications and close-applications commands. Approval, publication and intake are distinct. Approval/publication/opening requires actual selected priest authority; publication also requires publishing.manage. Opening intake requires the real recorded policy reference, without inventing age/guardian/religious criteria. Archive stops public listing and new intake; restore returns to Draft. Cleanup and authorized historical reading remain available after module lapse. Active content revision/merge/split and the broader public-content process remain further work.

Every consequential command needs its own nonempty OperationId and current Version when replacing a record. Replay is reauthorized and returns current safe state. Stale conditional writes roll back the related records, receipt and audit together.

## Identity matching and membership

POST `/api/parishes/{parish}/person-account-links` records an independently reviewed account/person match. The authorized MFA office operator needs people.write and office coverage, real evidence, a current verified account and actual non-archived Person. A person may not be claimed by two accounts, and an operator cannot approve their own identity match. Relinking/reactivation requires a separate reviewed correction; it is not silent reassignment. `/mine` returns only the authenticated person's safe link.

POST `/{ministry}/applications` submits Join or Leave. Self-service requires a reviewed own link. An explicitly authorized office/leader with people.write may prepare Join with actual representation/instruction evidence; it does not bypass final priest review. Assisted Leave is rejected to preserve the confidential applicant/priest process.

Applications have separate detail, own list, Join queue, priest-only Leave queue, action, safe history and priest-only evidence routes. A Join is Submitted, optionally recommended by an independent assigned leader, and approved/declined by an independent actual parish priest. Direct priest approval is supported without inventing a leader recommendation. Approval requires an actual eligibility/consent review reference against the current ministry policy revision.

A return for information saves the actual resume stage. Applicant/preparer resubmission resumes AwaitingPriest when its reviewed policy remains current; a changed policy returns it to Submitted for fresh applicable review. Withdrawal before a recommendation completes directly; after consequential review it becomes WithdrawalRequested, and approval/denial preserves the precise saved stage. A repeated request cannot overwrite that stage. Final/withdrawn records cannot become active by an ordinary retry.

Private Leave keeps administrative membership active until its real decision. Only the applicant and qualified selected priests can read its application/reason. The reason uses purpose-bound Data Protection in the existing parish partition; plaintext is excluded from public DTOs, general audit and operation receipts. Approval ends the membership and linked leadership atomically, preserving neutral dates and history. Archiving a person after their valid request does not trap that departure cleanup.

Each approved Join creates a distinct `ministryMembershipPeriod` with the actual JoinedAt, approving actor and application. Leave closes that interval; rejoin creates a new one. Older intervals are retained, so later roster changes cannot rewrite who was a member at an earlier occurrence. Legacy/mismatched periods fail closed for explicit evidenced review rather than fabricating past membership. No automatic data backfill or startup seed runs.

## Leadership and explicit sensitive duties

The `/leadership` routes appoint, list, read, end and show authorized history. Appointments support Leader/Assistant, actual effective dates and evidence. Co-leaders are permitted. Immediate handover conditionally ends the outgoing appointment and creates the incoming one in one parish transaction; no history is deleted. Ending leadership remains a separate fact from being a roster member.

`POST /leadership/{account}/duties` changes explicit duties without changing the existing appointment identity/dates. It requires actual independent priest authority, the leader's current Version, actual review evidence/reason, and the delegator's corresponding capability for new grants. New privileges require active ministry coverage; removal remains cleanup. Historical snapshots preserve the change.

| Leader duty | Selected-priest permission | Purpose |
| --- | --- | --- |
| attendance.record | ministries.attendance.record | Build/record actual occurrence attendance. |
| attendance.review | ministries.attendance.review | Reporting closure and attributed closed-sheet correction. |
| rsvp.private.read | ministries.rsvp.private.read | Purpose-specific confidential planning-reason reading. |
| formation.record | ministries.formation.record | Formation coordinator/instructor: draft programs, enroll members, record progress and evidence. |
| formation.review | ministries.formation.review | Qualified formation reviewer: review, return and complete milestones. |
| resources.custody | ministries.resources.manage | Custodian of physical group belongings: stock and loans. |
| volunteers.coordinate | ministries.volunteers.manage | Volunteer coordinator: opportunities, confirmations, releases and hours review. |

Default duty lists are empty. Record/review duties do not reveal confidential RSVP reasons or private ministry-departure reasons. Review-only attendance authority can read necessary attendance rows without gaining ordinary record authority. Explicit denials remain effective. A selected priest also needs its actual ministries.manage scope; ordinary setup-owner grants do not confer these duties.

## Meetings calendar ownership RSVP and rooms

The meeting routes are `/api/parishes/{parish}/ministries/{ministry}/meetings`: POST create draft, PUT `/{meeting}` edit a future draft, GET/list, POST `/{meeting}/actions` confirm/cancel, and personal RSVP/read routes. A meeting owns exactly one matching CalendarEvent in the same partition. Meeting and calendar dates/status/version fences commit together. Generic calendar APIs cannot forge or edit those source fields. General calendar/facility readers receive a busy-only projection; public calendar output excludes these private ministry occurrences.

Current eligible members may read future confirmed/cancelled meeting content; assigned operators retain authorized history. New members do not receive historical private material merely by joining. RSVP Optional/Required/NotRequested and actual cutoff are explicit; Required needs the actual supplied policy reference. Missing reply is distinct from Yes/No/Undecided. A reply never creates attendance.

Private RSVP planning reasons use separate endpoints/model/protector and an explicit reader duty. Only the original personal author may set/clear their reason within the actual reply window, with current link/membership/recorded reply and conditional fences. Original-author history remains private after departure/cutoff; clearing is an attributed tombstone/revision rather than erasing history. Ordinary reply lists, meeting content, attendance, public output and general audit/receipts exclude the text. This purpose is separate from private departure reasons.

Use PUT `/{meeting}/rsvp-private-reason` with `SaveRsvpReasonDto` to set a reason or explicitly Clear an existing one. GET that path returns the original author's value and Version; replacing/clearing requires that version. GET `/{meeting}/rsvp-private-reason/{person}` is a separately authorized exact-reader operation and returns no writable version. A completed operation retry rechecks the actor and returns the current reason/clear state; it cannot resurrect older text or restore an ended edit window.

Room requests use the existing reservation endpoints, facilities permission/coverage and allocator. A source-aware adapter also verifies the exact meeting and ministry authority. Requested/Allocating remain pending; actual Confirmed follows worker success for every resource. Meeting confirmation waits for resolved reservations. Edit/cancel waits for actual release. Current group/role/account authority is rechecked by durable work; closure/revocation compensates an unfinished allocation. Source guards are preserved globally. See [calendar-and-reservations.md](calendar-and-reservations.md).

## Attendance snapshot observation and reporting

Attendance endpoints are beneath `/meetings/{meeting}/attendance`. A source must be an actual completed, confirmed ministry occurrence; future/cancelled/wrong-source activities cannot become attendance. Individual liturgical tracking is not introduced.

1. POST opens a sheet as **Building** using the actual meeting Version. No incomplete roster is presented as a ready grid.
2. POST `/snapshot` advances a stored bounded cursor, with the current sheet Version. MembershipValidation checks current period bindings; PeriodSnapshot reads at most 40 candidate intervals per step and includes only actual membership at the occurrence start. Later departures/rejoins do not replace historical eligibility. Conflicting/legacy intervals require explicit review. Resume until **Ready**; no 5000-row truncation or giant embedded roster is used.
3. GET `/rows` returns a bounded page plus coherent versioned counters. POST `/records` changes at most 25 explicit rows, with sheet and row versions. A stale cell rolls back the entire batch and counters. Initial rows are **NotRecorded**, never automatic absences.
4. Explicit states are Present, Late, Absent, Excused, NotExpected and NotRecorded. Metrics label the expected-member denominator, missing coverage and present-plus-late formula; NotExpected/cancelled occurrences are excluded appropriately. Reviewed guest/additional rows have separate counters; they never inflate member coverage or absence denominators.
5. POST `/close` requires explicit review duty and actual reporting reference/reason. Unknown rows remain unknown on closure. POST `/corrections` makes an attributed, protected old/new adjustment to a closed sheet; ordinary record writes cannot rewrite a closed result.
6. `/mine` returns only the authenticated linked person's actual row, including permitted historical membership. It does not expose the grid. Review history/evidence requires explicit review scope; private reasons do not accompany broad grids or percentages.

Opening/new recording requires coverage. Authorized in-flight snapshot completion, history, closure and reviewed closed correction may continue after lapse. No background task invents participation or marks reminders delivered.

## Formation programs, enrollment and milestones — 10 November 2026

Source basis: S19.09, WF65/FM65, permission row P16 and scenarios A11/A12. The detailed workflow is a **proposed** recommendation; roles below are role ownership, not a named clergy approval. Routes are under `/api/parishes/{parish}/ministries/{ministry}/formation`.

- `POST /programs` (formation.record) creates a Draft program: title plus 1–30 ordered milestones with unique keys, prerequisites that must name earlier milestones (so programs are acyclic) and an optional `ClergyApproval` flag. `SupersedesProgramId` drafts revision N+1 of the current approved revision.
- `POST /programs/{program}/actions` is priest-only: `approve` needs an actual approval reference; approving a revision marks the old one Superseded. `retire` needs a reason and stops new enrollments only; existing enrollments continue. Approved revisions are never edited; enrollments pin the exact revision, so a program change never rewrites existing progress. Reviewed migration of an enrollment onto a newer revision is not implemented.
- `POST /programs/{program}/enrollments` (formation.record) enrolls a current, unarchived ministry member in the current approved revision, with the program Version. A claim document makes duplicate enrollment of the same person/revision fail atomically; a withdrawn enrollment is reopened rather than duplicated.
- `POST /enrollments/{enrollment}/milestones` takes `MilestoneKey`, `Action` and the enrollment Version:

| Action | From → to | Actor |
| --- | --- | --- |
| start | Enrolled → InProgress | The learner on their own enrollment, or formation.record |
| submit-evidence | InProgress → EvidenceSubmitted (Enrolled → EvidenceSubmitted for ExternalPriorLearning) | formation.record; needs evidence reference, actual AchievedOn date (not in the future) and, for external learning, provenance |
| review | EvidenceSubmitted → Reviewed | formation.review, different from the evidence recorder; needs a private review reference |
| complete | Reviewed → Completed | formation.review, different from the evidence recorder; a current priest when the milestone has ClergyApproval |
| return | EvidenceSubmitted/Reviewed → NeedsInformation (resume EvidenceSubmitted) | formation.review; needs an applicant-visible explanation |
| resubmit | NeedsInformation → saved resume stage | formation.record; replaces the evidence |
| reopen | Completed → EvidenceSubmitted | Priest only; needs a reason; never restores the earlier approval |

Start and evidence steps check prerequisites; completion rechecks them. New learning work (enroll, start, submit, resubmit, enrollment reopen) needs current membership; review of evidence already submitted does not. When every milestone is Completed the enrollment becomes Completed; reopening a milestone returns it to Active. Reopening a prerequisite does not rewrite later completed milestones; their history shows the order of events.

- `POST /enrollments/{enrollment}/actions` takes `withdraw` (formation.record, or the learner while every milestone is still Enrolled) or `reopen` (priest, for a Withdrawn enrollment), each with a reason.
- `GET /programs`, `/programs/{program}`, `/enrollments?status=`, `/enrollments/{enrollment}` and `/people/{person}/history` need either formation duty. `GET /enrollments/mine` returns the linked learner's own progress, AchievedOn dates and applicant explanations only: no evidence, provenance, review references, withdrawal reasons or staff identities.

Completion is never derived from attendance and is labeled as a ministry formation record, not a sacramental certificate or eligibility decision. Every change writes an append-only `formationChange` record with the milestone state before and after it, so a corrected or reopened entry keeps its prior version. Operation receipts and general audit carry no evidence or reasons. All formation documents live in the existing TenantControl parish partition and every write fences the parish root, so a concurrent authority change makes the write fail rather than commit on stale authority. Queries use only the existing reviewed index paths (type, ministryId, personId, status); no index change is needed.

Not implemented in this slice: evidence file uploads (evidence is a reference text), notification delivery, enrollment migration between revisions, multilingual program content, guardian/representative views, and aggregate formation reports/exports.

## Physical belongings and loans — 10 November 2026

Source basis: S19.10–S19.11 and WF29 (proposed). Routes are under `/api/parishes/{parish}/ministries/{ministry}`. Physical stock is separate from digital files: an upload is never a stock movement, and digital learning files are not implemented yet.

- `POST /stock`, `PUT /stock/{stock}` and `GET /stock` (resources.custody) keep a counted item with name, storage location, total and Active/Retired status. The total can never be set below the units currently on loan. `GET /stock/available` shows current members the active items and available quantity, without storage locations.
- `POST /loans` requests a loan: a current member for themselves, or a custodian for a current member (`PersonId`). `POST /loans/{loan}/actions` (custodian unless noted): `approve` (available stock rechecked), `decline` and `cancel` (the borrower may cancel their own unhandled request), `issue` (current membership, a future due date, condition at issue; stock OnLoan increases), `return` (condition at return; OnLoan decreases), `check` (Good, or Damaged with evidence), `report-missing` (evidence and explanation; OnLoan and Total both decrease as an explicit attributed loss), and `close` (a follow-up resolution is required after damage or loss).
- Issue, return and missing reports replace the stock record conditionally in the same transaction as the loan, so two loans cannot take the last unit. Damaged or missing items create a follow-up; nothing is silently deleted and no charge is implied.
- A member who leaves the ministry keeps `GET /loans/mine` and the custodian-recorded return route for outstanding loans, but can no longer see available stock or request new loans. Own loans omit custodian identities, condition notes, evidence and follow-up resolutions; `Overdue` is computed from the due date.
- `GET /loans?status=`, `/loans/{loan}` and `/people/{person}/loan-history` are custodian reads; history keeps the loan state before each change.

Not implemented: digital learning files and download rights, reminders/notifications for due and overdue loans, custody handover lists and loan exports.

## Volunteering — 10 November 2026

Source basis: S20.01–S20.10 (proposed). A volunteer is a parish person with an assignment record, never a separate account role. Routes are under `/api/parishes/{parish}/ministries/{ministry}/volunteering`.

- `POST /opportunities` and `/opportunities/{id}/actions` (volunteers.coordinate) create a dated position with title, requirements, location, real capacity and optional self-signup, then open, close or cancel it. An opportunity with confirmed people cannot be cancelled until each commitment is released.
- `GET /opportunities/open` is the member signup sheet: requirements and remaining places only, never other volunteers' identities. `GET /opportunities` and `/opportunities/{id}/assignments` (team sheet) are coordinator reads.
- `POST /opportunities/{id}/assignments` invites a current member (coordinator) or, with no PersonId, signs the caller up. One assignment exists per person and opportunity. States and the next actor: Invited (volunteer) → accept → AwaitingConfirmation (coordinator) → confirm → Confirmed; Declined; CancellationRequested (coordinator) → approve-cancel → Cancelled; coordinator `cancel` with a reason; `complete` after the slot ends. Response and confirmation times are kept.
- Confirmation is blocked when the opportunity is full or when the person already has an overlapping confirmed duty in any of this parish's ministries. Every write fences the parish root, so concurrent confirmations cannot overbook or double-book. A volunteer's cancellation request keeps the seat until a coordinator releases it, so a vacancy is never hidden; a replacement must be separately invited, accept and be confirmed.
- `POST /assignments/{id}/hours` records actual times, break and evidence for a started confirmed or completed duty (the volunteer, or a coordinator on their behalf); times must be ordered, not in the future and within twelve hours of the scheduled slot. `POST /assignments/{id}/hours/actions` verifies, corrects (keeping the submitted values) or rejects them, always by a coordinator other than the submitter. Scheduled duration is never counted as hours served. `GET /people/{person}/hours` and `/hours/mine` read them.

Not implemented: visitors, nonmembers and minors (they need approved safeguarding, consent and screening policy), skills/training prerequisites, declared unavailability and workload warnings, linked swaps, recurring rotas, reminders and exports.

## Storage verification and remaining acceptance

### Reviewed guest/additional-person rows — 9 November 2026

POST `/attendance/guests` accepts `AttendanceGuestDto` with the current sheet Version, new OperationId, an existing non-archived parish PersonId, actual IdentityReviewReference and Reason. This is an occurrence-specific reviewed identity admission, not a new Person, account, ministry membership, RSVP or right to group material. The source basis is S19.04/.06/.08 and their linked reviewed workflow/field specifications; their new detailed policy remains proposed rather than a fabricated owner approval.

The occurrence must be completed and confirmed, the roster snapshot complete, the sheet Ready and ministry coverage current. Admission requires explicit attendance.review duty. The default initial status is NotRecorded. Supplying any other initial status also requires attendance.record; review-only admission cannot become an ordinary recording shortcut. Later ordinary observations use the same record endpoint/duty as member rows. After closure, existing guest rows use attributed reviewed corrections; admitting a previously missing guest after closure remains deferred.

A person can have only one row for this occurrence. An expected-member row cannot be duplicated/reclassified as Guest; existing guest rows are edited through observations/corrections rather than admitted again. Guest identity/reason evidence is protected in reviewer-only history, absent from ordinary grids, operation receipts and general audit. Current row/person/sheet/scope/source versions fence the admission transaction. Own-row access still requires the actual reviewed personal link and confers no wider group access.

GuestCount and GuestCounts describe **recorded reviewed additional-person rows**, not proof that every possible guest has been captured or that every guest arrived. The six guest status counters are separate from all expected-member counts/percentages. New sheets establish an empty recorded-guest set. Older sheets retain unknown null counters until an actual empty guest query is established during admission; existing guest data or a nonterminal query page requires explicit reconciliation. An [empty Cosmos page can still have continuation](https://learn.microsoft.com/en-us/cosmos-db/query/pagination), so it is never treated as proof of zero. Historical null guest counters remain unknown; no automatic backfill/migration runs.

Eight isolated service/HTTP cases cover admission/counters/privacy, ordinary member separation, duplicate and authority denial, person-archive/stale rollback, legacy unknown/empty-nonterminal behavior, review-only initial-state isolation, closed correction and cookie/MFA/CSRF/OpenAPI contracts. Final integrated counts are in the verification record. Anonymous/ad-hoc visitor identity creation, representation/guardian rules, official historical roster corrections and wider reporting remain independent work.

All new ministry records use the existing TenantControl parish partition. The source query contract includes ministryId/kind/applicantAccountId/applicationId/publicListed, meetingId/joinedAt/personId and participantKind filters in addition to the earlier calendar paths. Inspect actual Azure policy first; broad indexing may already cover them. No source edit or startup applies a live policy transformation. The metadata readiness check is not actual Cosmos race/query acceptance.

Local tests exercise Identity/HTTP/CSRF/MFA, source/lifecycle/privacy, stale rollback/replay, concurrent decisions, authority withdrawal, resource compensation, dated rejoin intervals, bounded snapshot pages, attendance corrections and account boundaries. The current progress report records actual run counts and limits.

Remaining retained work includes approved historical member audiences/materials, recurring meeting exceptions, wider visitor identity/representation, monthly multi-meeting reporting closure, CSV/XLSX preview/import/reversal, the formation items listed above, digital/physical resources, volunteer duties and notifications with actual delivery. General religious/guardian/retention/official policy remains an actual factual input. This slice does not declare all M01–M11, S18–S20 or the whole backend complete.
