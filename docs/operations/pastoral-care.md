# Pastoral notes and confidential concerns operations

Updated 10 November 2026. Source basis: S27.01–S27.14 and S28.02–S28.06 (proposed). Content is protected at rest with the configured Data Protection key ring; operation receipts and audit never carry it. Neither area has an administrator, bishop, successor or office fallback.

## Pastoral notes (`/api/parishes/{parish}/pastoral-notes`)

- A current parish priest, acting through their selected appointment with current MFA, creates notes or tasks with a title, body, optional category and optional linked Person. The default audience is the author only.
- Explicit sharing: `ParishPriests` (current priests of the parish, including priests appointed later while the share stands) or `NamedPriest` (one other current priest). Shared readers must be current priests when they read. Authors keep reading their own notes after leaving office.
- Tasks can be assigned only to the author or to a priest who can already read them; assignment never widens the audience. The author or assignee completes/reopens tasks with actual times; authors archive/restore. Edits are author-only.

## Concerns (`/api/parishes/{parish}/concerns`)

- **Reviewers:** the bishop of the parish's jurisdiction appoints independent reviewers (`POST /api/archdioceses/{id}/concern-reviewers`) with a description, categories (Operational, Interpersonal, Safeguarding, Other) and a separate identity-visibility capability, and can end appointments. Submitters see reviewer descriptions only, never accounts or contact data. A parish without a jurisdiction or without eligible reviewers refuses submissions as not ready.
- **Submission:** any signed-in personal account can submit (membership not required) with category, urgency, summary, details, optional anonymity, chosen reviewers (or all eligible) and implicated accounts. Implicated people and the submitter are excluded before selection.
- **Access:** only the submitter and the selected, still-active, category-eligible, non-implicated reviewers can open a case; eligibility is rechecked on every request, so an ended appointment stops access immediately and nothing transfers to a successor. No other endpoint lists cases or counts.
- **Lifecycle:** Submitted → reviewer `accept` → Accepted → `start-review` → UnderReview → `respond` → ResponseProvided → `close`; the submitter or assigned reviewer can `reopen`. An `InformationRequest` entry moves the case to NeedsInformation and the submitter's reply returns it to review.
- **Entries have fixed audiences:** ReviewerNote (reviewers only), MessageToSubmitter, InformationRequest and SubmitterMessage. Submitters never receive reviewer notes or reviewer identities.
- **Identity:** reviewers see the submitter's account only when the case is identified and they hold identity capability. A submitter can later identify voluntarily; earlier anonymous history is kept.

Not implemented: a safe route for concerns implicating the bishop (it needs a preappointed authority outside the archdiocese), minors' confidential route policy, evidence uploads, privacy-safe notifications, independent handover of an ended reviewer's cases, and retention/deletion policy for notes.

## Incident records (E07)

Source basis: S22.10–S22.11 (proposed). Routes under `/api/parishes/{parish}/incidents` need current MFA and the office module. `incidents.record` and `incidents.manage` are separate, explicitly appointed priest/staff duties; they are not in the setup owner's default set, and event participation, ordinary leadership or office access grant nothing here.

- `POST /incidents` (incidents.record) stores when and where it happened, the linked event and people (each must exist; nothing is inferred), the factual description, immediate actions and witnesses, protected at rest. The recorder gets only a receipt and cannot read the record back. Marking it urgent does not contact anyone: follow the parish's approved escalation procedure.
- `POST /incidents/{incident}/actions` (incidents.manage) with the current version: `assign` a handler (Recorded → Assigned; the handler gets a neutral required notification), `follow-up` with required actions, `resolve` with the outcome, `close` with remaining restrictions, `reopen` with a reason. `amend` adds an attributed corrected text for Description, ImmediateActions or Witnesses while the original report stays; `note` is reviewer-only; `communication` records what a linked guardian or subject was told outside the system. Nothing is sent from here.
- `GET /incidents` (filter by `status` or `eventId`) and `GET /incidents/{incident}` show the original report and every attributed entry to handlers only.

Not implemented: approval of this process by the event's qualified safeguarding authority (required before operational use), deadlines and reminders, a guardian-facing message channel, restricted search beyond status/event filters, export and evidence uploads.
