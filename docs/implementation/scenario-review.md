# Review of all 30 acceptance scenarios

**No complete A01–A30 scenario is certified passed.** Tests exercise specific software paths. Actual domain approvals, named users, signatures, safeguarding procedures, translations and physical printing remain separate. Software gaps below are implementation work, not external-service dependencies. [Source scenarios](../ux-discovery/reviewed-answers/scenario-walkthroughs.md).

## A01

A new adult signs up, follows two parishes, chooses a primary parish, skips profile completion and returns later.

Status: **partial checks only; full acceptance open**.

Checked: Following_two_parishes_and_primary_is_independent_of_membership_and_person_links; combined Home browser smoke.

Still required: Configured-age signup end-to-end, profile prompt and approved activity aggregation; human adult onboarding.

Mapped workflows: WF01, WF04, WF51, WF52. Actual domain and representative-user validation remains U14.

## A02

The office cannot confidently match a membership applicant to two similar person records; one is already linked to another account.

Status: **partial checks only; full acceptance open**.

Checked: Membership service refuses already-linked/archived person; code reviewed, no complete automated scenario.

Still required: Comparison/review UI, wrong-link dispute and distinct verified outcome acceptance test.

Mapped workflows: WF04, WF06, WF07. Actual domain and representative-user validation remains U14.

## A03

A parent requests baptism for an unregistered child; a similar archived record exists and the Arabic name is not yet known.

Status: **partial checks only; full acceptance open**.

Checked: Provisional-name/unknown-script service reviewed; unlinked request and evidence test.

Still required: Archived-child/guardian workflow, child-specific baptism form and ministry/household link consequence tests.

Mapped workflows: WF11, WF14, WF06, WF08. Actual domain and representative-user validation remains U14.

## A04

A guest submits the same baptism need, loses the tracking link, then creates an account and asks to associate the request.

Status: **partial checks only; full acceptance open**.

Checked: Guest_retry_association_and_revocation_preserve_one_original_request_without_membership.

Still required: Full browser lost-link office procedure and real requester identity validation.

Mapped workflows: WF11, WF03, WF04, WF21. Actual domain and representative-user validation remains U14.

## A05

A secretary reviews a request with missing documents; a priest accepts directly; the applicant supplies an illegible file that must be replaced.

Status: **partial checks only; full acceptance open**.

Checked: Secretary_records_genuine_prior_instruction_effectively_once_with_both_identities; Priest_direct_acceptance_does_not_fabricate_office_review_or_verify_missing_evidence; Unlinked_applicant_can_resume_own_draft_and_replace_rejected_evidence_without_other_case_access.

Still required: Full checklist/paper route and human legibility/domain checklist review.

Mapped workflows: WF14, WF22, WF11. Actual domain and representative-user validation remains U14.

## A06

A marriage involves a partner from another parish and an external celebrant; the planned room/priest is already busy.

Status: **partial checks only; full acceptance open**.

Checked: Reservation venue conflict checks in code; no full scenario executed.

Still required: Separate partner/external-authority forms and atomic shared clergy/venue/equipment scheduling.

Mapped workflows: WF17, WF23, WF13. Actual domain and representative-user validation remains U14.

## A07

A scheduled celebration is postponed, cancelled or never takes place; a certificate request was waiting on it.

Status: **partial checks only; full acceptance open**.

Checked: Source/state gates reject certificate preparation before registered actual source; postponement/cancel code reviewed.

Still required: No-show and waiting certificate UI, linked resource/refund/material change recovery tests.

Mapped workflows: WF14, WF15, WF16, WF17, WF18, WF20, WF23. Actual domain and representative-user validation remains U14.

## A08

The office submits a celebrated sacrament with a name error; the priest returns it; after approval another official correction is needed.

Status: **partial checks only; full acceptance open**.

Checked: Approved source immutable guard and stale case decision tests.

Still required: Full correction/resubmission test and official amendment/reissue implementation.

Mapped workflows: WF19, WF14, WF20, WF05. Actual domain and representative-user validation remains U14.

## A09

A priest signs a certificate; the bishop returns it; it is corrected, accepted and released to a verified representative.

Status: **partial checks only; full acceptance open**.

Checked: Bishop_return_invalidates_signature_file_and_release_requires_exact_recipient_then_can_be_withdrawn; configured secretary certificate approval cannot sign.

Still required: Full browser collection and actual signature/bishop/representative policy validation; approved print specimens.

Mapped workflows: WF20, WF21, WF22. Actual domain and representative-user validation remains U14.

## A10

A guest's certificate file is prepared but not released; a wrong-file release is caught or must be withdrawn after release.

Status: **partial checks only; full acceptance open**.

Checked: Wrong-source final file rejected; unreleased/other-recipient/withdrawn download blocked in A09 tests; guest status contains no files.

Still required: Restricted release/download audit and mistaken-disclosure incident/reissue workflow.

Mapped workflows: WF20, WF21, WF22, WF35. Actual domain and representative-user validation remains U14.

## A11

A person joins a ministry, withdraws after leader review, reapplies, then later requests a private departure.

Status: **partial checks only; full acceptance open**.

Checked: Ministry state/private-departure services and filters reviewed; no full scenario executed.

Still required: Automated join/recommend/withdraw/reapply/departure sequence and human approval procedure.

Mapped workflows: WF26, WF27, WF28, WF46. Actual domain and representative-user validation remains U14.

## A12

A leader changes; the former leader has open tasks, group files, attendance corrections and a pending application.

Status: **partial checks only; full acceptance open**.

Checked: Exact ministry scope and live assignment revocation checks; no full scenario executed.

Still required: Leadership handover for tasks/files/attendance, historic-versus-current access and full dependency preview.

Mapped workflows: WF38, WF26, WF28, WF29, WF49. Actual domain and representative-user validation remains U14.

## A13

A volunteer is already assigned in another parish, accepts a new duty, then cancels shortly before the event.

Status: **not implemented / not executed**.

Checked: Not executed; volunteer service is not implemented.

Still required: Volunteer opportunity/commitment/conflict/acceptance/cancellation/vacancy implementation and validation.

Mapped workflows: WF30, WF23, WF46. Actual domain and representative-user validation remains U14.

## A14

An event fills while two families register; one child lacks a birth date/consent and another has a partial fee plus paid transport.

Status: **partial checks only; full acceptance open**.

Checked: Independent_connections_competing_for_the_final_place_cannot_overbook; unknown age cannot confirm; original-currency allocation validation.

Still required: Families/transport/partial fee workflow and consent reconfirmation integration.

Mapped workflows: WF31, WF33, WF34. Actual domain and representative-user validation remains U14.

## A15

An event moves date/room after participants pay; consent/transport changes and some participants request refunds.

Status: **partial checks only; full acceptance open**.

Checked: Not executed as a complete scenario.

Still required: Material event amendment, transport/consent reconfirmation, participant refund requests and actual refund UI.

Mapped workflows: WF23, WF31, WF13, WF57, WF33. Actual domain and representative-user validation remains U14.

## A16

A child arrives, the connection fails and an unauthorized collector later asks for pickup; paper fallback is used and reconciled.

Status: **partial checks only; full acceptance open**.

Checked: Unknown_age_blocks_confirmation_and_unauthorized_collector_never_creates_an_exit; actual paper arrival history.

Still required: Browser disconnected-device drill, paper pickup reconciliation and real safeguarding/collector procedure review.

Mapped workflows: WF34, WF58, WF35. Actual domain and representative-user validation remains U14.

## A17

An incident occurs during one event; a restricted report is created and an emergency roster is printed without implying whole-building coverage.

Status: **partial checks only; full acceptance open**.

Checked: Event-only active roster implementation reviewed; anonymous concern privacy tests do not establish incident reporting.

Still required: Dedicated restricted incident records, response/closure/amendment and actual emergency roster drill.

Mapped workflows: WF35, WF34, WF58. Actual domain and representative-user validation remains U14.

## A18

Two room requests compete, one has setup time, a deposit is involved and maintenance later blocks the confirmed booking.

Status: **partial checks only; full acceptance open**.

Checked: Reservation workflow integration suite; setup/cleanup/serviceability conflict code reviewed.

Still required: Simultaneous competing-booking test, deposit linkage, maintenance impact/relocation workflow.

Mapped workflows: WF13, WF36, WF33, WF57. Actual domain and representative-user validation remains U14.

## A19

Equipment reserved for a paid external renter is returned damaged and becomes unavailable for another booking.

Status: **not implemented / not executed**.

Checked: Not executed; equipment damage/return workflow is not implemented.

Still required: Atomic stock reservation, external renter history, damage/repair/return and later-booking recovery.

Mapped workflows: WF37, WF36, WF13, WF33, WF57. Actual domain and representative-user validation remains U14.

## A20

Counters record actual USD and LBP gifts, disagree, resolve the count, close it and later correct the wrong fund/household attribution.

Status: **partial checks only; full acceptance open**.

Checked: Actual independent count variance, exact verified revision, duplicate close and closed-line lock tests.

Still required: Household/envelope/fund attribution, approved post-close reclassification/reversal workflow and actual finance validation.

Mapped workflows: WF41, WF42, WF08, WF61. Actual domain and representative-user validation remains U14.

## A21

A registration/rental payment reaches Finance while an office allowance is recorded; reporting must count each movement correctly once.

Status: **partial checks only; full acceptance open**.

Checked: Internal transfer and purchase example: transfer does not add consolidated income/expense; receipt allocations bounded; LBP separate; viewer cannot write.

Still required: Registration/rental UI uses actual canonical receipt allocation, period reports and domain finance reconciliation.

Mapped workflows: WF33, WF13, WF31, WF45, WF44. Actual domain and representative-user validation remains U14.

## A22

An anonymous concern names a senior cleric, selected reviewers become conflicted, and ordinary administrators must see neither the case nor its count.

Status: **partial checks only; full acceptance open**.

Checked: Anonymous_sensitive_concern_has_no_admin_count_and_confidential_identity_requires_separate_grant; conflicted access removed.

Still required: Actual all-conflicted independent route, reassignment and senior-cleric scenario human validation.

Mapped workflows: WF47, WF38, WF46. Actual domain and representative-user validation remains U14.

## A23

A priest shares one pastoral task but keeps another note private, then leaves the parish and loses the parish appointment.

Status: **partial checks only; full acceptance open**.

Checked: Private_pastoral_note_does_not_pass_to_a_new_priest_or_an_administrator.

Still required: Shared task UI/handover and departed-author restricted archive under approved policy.

Mapped workflows: WF48, WF38, WF63. Actual domain and representative-user validation remains U14.

## A24

An editor changes a published bilingual page in draft, another editor publishes a concurrent change and one translation is missing.

Status: **partial checks only; full acceptance open**.

Checked: Trilingual publish tests: missing French rejected, stale publication blocked, prior live content preserved.

Still required: Full browser concurrent-editor comparison/withdrawal and approved content/language review.

Mapped workflows: WF32, WF52. Actual domain and representative-user validation remains U14.

## A25

An Archdiocese Admin creates its first parish without a secretary and delegates routine office work without granting priest signature authority.

Status: **partial checks only; full acceptance open**.

Checked: Delegated_diocesan_admin_can_activate_first_parish_without_secretary_then_head_priest_invites_and_revokes_one_scope.

Still required: Human real-data adoption/appointment validation, full routine office duty delegation and handover preview.

Mapped workflows: WF39, WF38, WF11, WF20, WF21. Actual domain and representative-user validation remains U14.

## A26

A diocese-sponsored parish downgrades its bundle with open sacrament requests, unpaid registrations and documents awaiting release.

Status: **not implemented / not executed**.

Checked: Not executed; sponsored bundle downgrade workflow is not implemented.

Still required: Bundle family entitlement map, sponsor approval and grandfathered completion/export/financial/document dependencies.

Mapped workflows: WF40, WF14, WF31, WF20, WF21, WF33. Actual domain and representative-user validation remains U14.

## A27

A user has different roles in two parishes, switches parish mid-task and receives a revocation while another tab remains open.

Status: **partial checks only; full acceptance open**.

Checked: Live_role_revocation_removes_old_tab_access_and_three_languages_have_correct_document_direction; scoped revocation leaves unrelated appointment effective.

Still required: Two-browser-tab in-flight context-switch/lost-response drill and full draft comparison recovery.

Mapped workflows: WF52, WF38, WF43. Actual domain and representative-user validation remains U14.

## A28

A financial viewer searches, prints and exports permitted records while trying an editing link from an old bookmark.

Status: **partial checks only; full acceptance open**.

Checked: Financial_viewer_export_is_scope_limited_and_escapes_spreadsheet_formulas; direct stale write denied.

Still required: Search/filter/period export preview, actual printer validation and broader field/diocesan finance export grants.

Mapped workflows: WF64, WF33, WF38. Actual domain and representative-user validation remains U14.

## A29

A user completes a long Arabic form using a phone or keyboard/screen reader, changes language, loses their session and resumes safely.

Status: **partial checks only; full acceptance open**.

Checked: Browser: English draft save during Arabic switch, persisted Arabic text after French switch; Arabic phone and desktop screenshots; EN/FR/AR direction HTTP tests.

Still required: Full field-dictionary long form, file preservation, session-expiry/browser recovery, keyboard-only/screen-reader/zoom and named EN/FR/AR reviewers.

Mapped workflows: WF01, WF11, WF17, WF22, WF52. Actual domain and representative-user validation remains U14.

## A30

A deceased/archived person has a household envelope, future commitments, an account, certificates and notification preferences.

Status: **partial checks only; full acceptance open**.

Checked: Archived/deceased person new-link/activity guards reviewed; no complete scenario executed.

Still required: Deceased/archive consequence review across households, envelopes, commitments, accounts, certificates and notification preferences.

Mapped workflows: WF06, WF08, WF20, WF30, WF41, WF50. Actual domain and representative-user validation remains U14.
