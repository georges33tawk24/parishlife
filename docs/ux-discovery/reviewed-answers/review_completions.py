from build_pack import *

# One observable, question-specific check per canonical question, in section order.
CRITERIA={
'S01':'''Initial organization list distinguishes one diocese, two intended parishes and exact identities still awaiting approval.
Calendar, reservations and ministries are visibly the three priorities without deleting other modules.
Priest and optional-secretary task lists each contain five concrete daily task groups.
Every retained role has a launch destination and stated expected usage frequency without an always-online promise.
Every project-review module remains in the release inventory; unfinished integrations have honest availability states.
Each religious workflow distinguishes actual in-person/original-document/signature requirements from online entry.
No rite is inferred from parish names; unsupported routes cannot reach official output.
Primary laptop work and essential phone/tablet/shared-device tasks have explicit layout/recovery coverage.
EN/FR/AR readiness includes errors, help, notifications, content and official templates, not menus alone.
Product, clergy, office, finance, sensitive-access and language approval responsibilities are distinguishable.
Known initial counts are stated separately from the explicitly requested missing numerical capacity inputs.
Final developer release review requires domain evidence and prototype findings; writing answers is not user validation.''',
'S02':'''Each role’s duties and grant scope differ from account/person/roster identity; translations await named review.
First privileged setup and bishop appointment work before any parish exists and do not use public self-promotion.
Valid creation activates/publicizes once; incomplete setup stays private; closure never cascades through official history.
Multiple appointees work with one actual designated lead and an explicit vacancy/handover route.
Role switching preserves login but consequential actions identify eligible acting capacity and one target parish.
Header/confirmation show real role/parish; official print names priest while internal history retains recorder.
Secretary records actual prior priest instruction effectively once; no automatic signature/bishop/admin extension occurs.
No-secretary office work completes through eligible priest/admin without fake secretary account or inherited signature.
Delegation names duty, scope, people and period and cannot exceed giver’s authority.
Handover transfers future eligible work while preserving authorship and private-case/notebook boundaries.
Revoked open session fails next protected action, accurately checks prior commit and offers safe permitted destination.
Accepted/effective appointment dates control authority; expiry/review reminders never silently extend a grant.
Reason, reauthentication and independent approval are separately enforced for each listed high-impact change.
Own access request routes to eligible authority without showing unrelated accounts, records or confidential cases.''',
'S03':'''One available role enters directly; multiple roles require choice; no-parish/follower/unassigned-priest states remain useful.
Staff and permitted personal content share one combined home without exposing personal content to office colleagues.
Every authorized retained module has a destination; hiding a menu never substitutes for action checks.
Terminology dictionary disambiguates People, ministries, official records, account and public content in three languages.
Combined view labels each parish/relationship and every mutation retains one authorized parish target.
Preferences remain scoped; switching clears unsafe selections and revoked grants remove stale records/counts.
Each role’s first-screen cards link to real work and each displayed number has a defined period/unit.
My work distinguishes needs-me, team work and waiting without duplicate linked intake/office cases.
Badge and filtered queue use the same deduplicated case unit and exclude inaccessible confidential cases.
Search returns only permitted fields/records across supplied scripts, never private-note/concern leakage.
Result opens stable relevant detail and Back restores authorized query, filter, page and position.
Select-page and select-all-matching/export outcomes are explicit with item-level partial failures.
Phone cards retain parish/reference/state/next actor/date and currency while complex actions remain usable.
Unavailable/unauthorized links reveal no private existence and offer safe navigation or reviewed recovery.''',
'S04':'''Homepage action order prioritizes parish discovery, published times and correct-parish contact before marketing.
Time search uses actual structured occurrences/exceptions; absent schedule is not no services.
Cards disambiguate locality/diocese and show only genuinely published contact/time/distance claims.
Denied location/unconfigured map leaves manual directory usable and never invents coordinates or pins.
Parish profile order supports visiting, contact and requests before optional history/gallery.
Minimum correct core setup aligns with immediate valid activation; optional empty sections never block it.
Named parish pages use verified photos or neutral/labeled illustration, never unrelated authentic-looking church image.
Public clergy/leader names and contact destinations have actual publication approval; login contacts stay private.
Internal sacramental family names do not appear in public titles/feeds without separate naming permission.
Supported guest request types state their true next step; inquiry/submission never implies approval or booking.
Urgent contact shows actual maintained hours/route and never promises continuous online response.
Stable public URLs preserve safe language/filter state without tracking tokens or precise visitor coordinates.''',
'S05':'''Editor and publisher permissions are separate and domain facts still require their competent authority.
One website area uses authoritative contact/schedule sources without merging field ownership.
Saving a new draft leaves current approved public version online until explicit publication/unpublish.
Publication state changes name actual actor/time and scheduled execution is never claimed without runner.
Missing required translation blocks replacement publication while approved trilingual live content remains.
Preview uses exact pending version/audience across phone/desktop and EN/FR/AR.
Media has source/rights/descriptions and private evidence cannot become public media automatically.
Dated schedule exceptions override recurrence consistently in directory, calendar and profile.
Pinned/scheduled/expired announcements retain exact audience/version and actual execution status.
Shared public layout remains coherent while account dashboard palettes stay personal.
Concurrent edit/publish detects stale revision and preserves permitted draft for comparison.
Private accidental publication can be withdrawn with restricted review and no impossible external-copy recall.''',
'S06':'''Proposed age rule and guardian/assisted routes are labeled unapproved policy rather than national legal fact.
Signup completes without parish/profile translations/address and creates no office person automatically.
Unified identifier input preserves legacy usernames and resolves ambiguity without account enumeration.
Shared household contact cannot ambiguously log into multiple accounts or expose matching office people.
Contact stays unverified until real challenge succeeds; manual identity review is accurately labeled.
Unavailable providers are absent from primary login; proposed privileged MFA gap remains an explicit dependency.
New-password proposal is consistently 16–200 with paste/password-manager support and explicit legacy migration.
Member recovery cannot reset staff; privileged recovery requires actual eligible identity-reviewed procedure.
Invitation creation versus manual/real delivery is distinguishable and no staff/ministry grant is bundled.
Seven-day single-use expiry, revoked/wrong-person and repeated-successful claim paths avoid duplicate links.
Contact/session changes verify replacement and preserve a real recovery route with other-session revocation.
Expiry/rate-limit/shared-device feedback protects secrets and resumes only permitted drafts without blind resubmit.''',
'S07':'''Follower gets published activity and request capability but no internal roster/person/staff access.
Multiple parish memberships remain separately office-reviewed; primary parish changes only personal defaults.
Office records minimal actual identity-verification method/date and refuses ambiguous surname-only links.
Create-person inline preserves membership context and duplicate/archive checks without half-linked records.
Existing link conflict blocks ordinary reassignment and wrong-link review previews/access-corrects dependencies.
Decline gives applicant-safe useful reason and corrected reapplication preserves prior history.
Unfollow/primary/departure/role resignation have separate effects on open work, optional contact and history.
Invited claimant confirms intended account/person and any conflicting/stale link returns to review.
Profile correction cannot directly alter register/signature/login identity or another adult’s facts.
Per-field decisions preserve original/proposed/applied values; staff counterproposal is not falsely applicant-authored.
Pending withdrawal/replacement and concurrent staff field changes never overwrite newer values silently.
Account, personal display, official parish facts and issued-document snapshots explain their separate effects.''',
'S08':'''Person categories/lifecycle/membership remain separate and external witnesses do not become members automatically.
Provisional person saves with actual supplied distinguishing name and explicit unknown dates/scripts/contact.
Supplied name structure/source supports official output without automatic transliteration or Preferred Name.
International contacts and date precision survive validation/export without invented dates or local-only rejection.
Unlisted/foreign locality remains reviewable submitted text rather than forced wrong town.
Skills/occupation purpose and restricted declared medical facts have distinct audiences/search/export rules.
Profile tabs/related actions follow field-level permission; opening People does not expose Giving/Notes.
Person-form group addition follows actual ministry decision workflow rather than immediate unchecked roster change.
Identity/official locks and evidence requirements preserve historical snapshots when current profile changes.
Optional photo failure/removal preserves rest of form and public-image permission remains separate.
Directory/publicity/contact/event/representation choices have separate scope/version/giver and withdrawal consequences.
Contextual request/invite/certificate/message/note actions recheck their own prerequisites and target scope.''',
'S09':'''Household contact/residence grouping does not confer guardianship, shared finances or private-record access.
One primary household plus reviewed external relationships avoids duplicate people for shared custody/overseas residence.
Household contact label has no automatic adult account, giving or certificate authority.
Sensitive family relations remain hidden from ordinary directories/exports while explicit unknowns are supported.
Specific related-person selection rejects circular parentage and offers accessible list alternative to diagram.
Changing contact preserves person-to-person relations and previews communication/default changes separately.
Shared address move updates only inherited fields and leaves individual/login contacts unchanged.
Another competent adult’s sensitive request/release requires explicit reviewed representation.
Guardian view is purpose-scoped and later autonomy/assisted authority transition requires approved policy.
Split/merge/leave preserve old giving/consent/official links and original open-case requester identities.
Optional manual envelope identifier has parish/date uniqueness and history preventing unsafe reassignment.
Directory output uses individual exact opt-in while operational export follows separate scope/field permission.''',
'S10':'''Real source owners/formats/volumes are requested explicitly and historical transcription remains distinct.
Mapping/whole-file preview precedes commit; valid-row-only import is a deliberate recorded exception.
Missing scripts/localities/dates/contact/consent remain unknown or unverified rather than invented.
Duplicate suggestions explain multiple matching signals and support different-person/need-information outcomes.
Merge preview resolves fields/account/household/official/finance dependencies with preserved source IDs.
Unmerge reviews later dependencies and never promises destructive one-click rollback after official use.
Inactive, deceased, archive, account closure and appointment revocation have separate consequence reviews.
Archived candidates appear in authorized matching/restore without public identity disclosure.
Move to new parish creates reviewed local membership/source references, not automatic private-record transfer.
Historical/external sources preserve original facts/numbers and actual later entry audit timestamps.
Legacy unlinked event forms cannot accept new activity while authorized historical reading remains.
Source/result row totals, currency balances and official identity comparisons reconcile with domain sign-offs.''',
'S11':'''Every retained request type has structured essentials plus general route with honest acceptance meaning.
Guest/member versions share core service facts and missing later information stays in same case.
Unlinked authenticated applicant can submit without logout but cannot select hidden household/official records.
Requester/subject/relationship/authority remain separate for adults, children, deceased and overseas cases.
Office telephone/paper entry records actual origin/requester/entry actor without fake digital consent.
Review-before-submit shows correct parish/type/details/fees/physical follow-up and real privacy/review expectations.
One stable case reference/timeline/thread links downstream identifiers without duplicate actionable counts.
Triage shows urgency/date/current owner/missing items/next action and unassigned office work remains visible.
Needs information requests exact change/item without declining whole case or exposing internal notes.
Received, accepted, clergy-approved, dated, registered and ready have distinct fact-based meanings.
Unhandled applicant edits/withdrawal stop when accepted dependencies need reviewed cancellation/reschedule.
Applicant-visible reasons and internal staff note inputs are separate with audience preview.
Duplicate/wrong-parish/incorrect acceptance preserve references/history and review real downstream effects.
Lost/leaked guest link recovery verifies identity and office-approved account association grants no membership.
Named owner/escalation handles overdue work without invented applicant SLA or unattended fake reminders.''',
'S12':'''Each sacrament has exact proposed stages plus return/decline/cancel; priest direct path preserves skipped optional review.
Acceptance starts preparation but does not verify all evidence, reserve time or prove celebration.
Requirement versions identify due-stage, verifier and competent waiver with nonwaivable gates protected.
Preference/hold/confirmed date are distinguishable and mandatory due-stage checks block only correct final action.
Clergy/venue/setup conflicts recheck at commit; impossible double-use has no generic override.
Shared celebration keeps individual readiness, actual participant confirmation and official numbers.
No-show/changed celebrant/actual time are recorded before official submission with no future false celebration.
Priest can return proposed entry for correction and compares actual identity/celebration/source before approval.
Number scope/allocation/gaps/history remain an explicit clergy policy dependency, never inferred from sample numbers.
Approved error uses authorized amendment preserving original and linked certificate consequences.
Pre-celebration cancel differs from post-celebration/registered correction; completed official history cannot be erased.
Timeline shows actual completed/current/planned timestamps, waiting duration, next role and audience-safe detail.
Proposed dedicated official-register search and full authorized export have defined book/page/year/number filters.''',
'S13':'''Baptism card separates intake, preparation and official-output facts and unresolved approved checklist inputs.
Unregistered child matching searches archived records and verifies guardian/household before creation/link.
Adult/unknown-parent baptism avoids impossible parental required fields while maintaining actual eligibility review.
Communion prior-record/formation evidence can be externally verified without creating another local celebration.
Only approved rite route exposes confirmation/chrismation terminology and linked-versus-separate records.
Marriage captures both partners and permitted outside references without forcing local membership.
Special review routes to actual competent authority and never decides religious eligibility automatically.
Funeral urgent handling uses maintained contact/approved service checklist without unrelated formation barriers.
Funeral completion only suggests reviewed deceased-status update and separately reviews future duties/contact.
Mass intention, blessing, sick visit and appointment have separate data/access/calendar/task outcomes.
External sacrament reference remains verified source evidence with no invented local number/celebration.
Jurisdiction-approved versioned variations cannot silently change existing official facts or common authority rules.
Actual approved fee/offering/waiver wording is separate from acceptance and no sample amount is charged.''',
'S14':'''Actual document types/wording/seals/signature examples remain required competent-authority inputs.
Subject/guardian/representative authorization is checked independently from household membership.
New bishop-review default is explicitly proposed pending competent policy and legacy handling remains separate.
Issued/ready/released/collected reflect distinct real gates and exact final snapshot.
Bishop queue exposes exact signed version/waiting/resubmission facts only to eligible reviewers.
Returned material revision invalidates affected signature and retains restricted reason plus neutral applicant status.
Absence replacement has actual eligible religious appointment; office/admin cannot forge signature/episcopal action.
Waiting certificate links exact approved source after celebration; cancellation/ambiguous source is reviewed.
Approved EN/FR/AR template/name spellings and chosen layout are previewed without automatic transliteration.
Unsigned preview format/QR does not make official certificate; actual authority determines signed-paper/digital validity.
Reprint versus replacement/reissue/revocation preserves version and no universal validity period is invented.
Legacy issued retains actual provenance without fabricated retrospective bishop acceptance.
Verified actual recipient/representative and receipt time distinguish release availability from collection.
Quantity/fee/delivery choices keep outstanding balance/collection follow-up separate from clergy approval.''',
'S15':'''Every approved requirement lists supplier, due stage, verifier and missing actual domain checklist input.
Applicant later uploads and office paper route share same checklist without losing intake on upload inability.
Uploaded/paper received/verified/rejected/expired/waived are separate with actual responsible reviewer.
Published proposed file/size/count/page limits apply consistently with reviewed large-file office exception.
Optional capture/rotate/crop/preview does not destroy original evidence or imply authenticity.
Per-file progress/failure/retry distinguishes local selection from saved receipt and preserves other form data.
File-level view/replace/remove/download rules retain versions and lock approved/closed evidence.
Reuse rechecks subject/purpose/validity/audience and does not disclose source case’s other files.
Release preview compares subject/requester/recipient/source/final version and blocks mismatches.
Withdrawal stops future access, preserves history and admits downloaded copies cannot be recalled.
Tracking bearer is not sufficient sensitive-download identity; missing challenge uses reviewed account/collection route.
Restricted upload/view/release/download audit and approved retention/hold rules survive cancellation/archive.''',
'S16':'''Every event type has meaningful label/default audience and required parish/time/resource fields.
Create/edit/publish/invite authority differs by source type and assigned ministry/resource scope.
Private occupied interval blocks resource without public title/subject/contact leakage.
Occurrence/forward/eligible-series changes preview dependencies and preserve completed history.
Exclusive room/clergy/stock conflicts block; only permitted preference warnings allow reasoned exception.
One canonical occurrence links source workflows and source owns consequential date/status edits.
Month/Week/List defaults, filters, week start and early/late visibility are explicitly stated.
Parish-local zone is authoritative and cross-midnight/DST/viewer equivalents are unambiguous.
Thirty-minute shortcuts never silently round actual times or prohibit approved early/late/all-day use.
Schedule print/export contains only permitted audience fields and actual period/zone.
Liturgical calendar source/rite/year/version needs competent approval; no sample feast becomes authoritative.
Anniversary date precision/deceased/private audience rules prevent false or inappropriate outreach.
Material event change updates linked work and requires applicable reconfirmation distinct from delivery.''',
'S17':'''Event occurrence, operational plan, sacramental case and meeting remain linked but distinct records.
Plan coordinator/contributor/religious approver scopes protect private instructions and other parishes.
Final live plan checks actual event/owner/roles while reusable draft template can omit future people/date.
Relative timing recalculates, fixed starts constrain, and no plan silently extends confirmed booking.
Overtime/unassigned role/conflict visibly blocks finalization or creates reviewed correction task.
Explicit Save and draft/approved/completed states preserve unsaved and concurrent-change recovery.
Template copy requires actual date/people/resources review and never mutates earlier saved plans.
Clergy/team/participant/music outputs omit audience-inappropriate instructions.
Music owner and metadata/search filters have defined actual rights/source review.
Lyric/chord/version change does not mutate pinned past plan version.
Print/download/projection require actual rights basis and attribution, not upload possession.
All retained planning/music remains in scope; any future deferral requires explicit owner decision/fallback.''',
'S18':'''Group type distinguishes ministry/choir/class/committee/team without changing record permissions by label.
Creation/leader appointment/eligibility/public listing have separate actual authorities.
Applicant sees real purpose/schedule/eligibility/capacity/commitment before choosing apply.
Follower/unlinked applicant gets inquiry or verified-link next step, not hidden roster access.
Leader review then priest final approval/direct priest route preserves actual extra trial/guardian requirements.
Staff addition follows same consent/eligibility/priest decision or reviewed historic-roster provenance.
Conflicted/unavailable leader uses eligible reviewer/priest and applicant appeal/reapply remains traceable.
Private departure stays priest/applicant only; optional participation/contact may stop while administrative review waits.
Leader sees neutral end/effective date and future work consequence, never private reason.
Pre-review withdrawal completes directly; post-leader request cannot later approve from terminal state.
Leadership/group handover maps tasks/files/applications and preserves historic attendance/authority.
Role-specific group tabs keep secretary operational subset and require separate attendance/publishing/loan grants.''',
'S19':'''Group meeting owns one linked occurrence and date editing cannot produce conflicting independent calendars.
Current/trial/new member materials follow actual group audience without automatic historical-private access.
RSVP supports Yes/No/Undecided and stated deadline; optional reason restricted, never actual attendance.
Not recorded, Not expected and factual absence remain distinct in grid and reports.
Recorder/month-close correction authority preserves reason/history before and after locking.
Expected roster snapshots include real join/end dates and guests separate from member denominator.
Attendance import previews exact person/date/status mapping, errors, duplicates and reversal consequences.
Member/leader/clergy reports show permitted scope, expected denominator and unknown coverage.
Formation milestones use approved program/evidence/qualified sign-off, not attendance-only automatic eligibility.
Digital learning material and physical belongings have different metadata/access/loan interfaces.
Outstanding loans remain limited recovery work after departure while member-only digital access ends.
Collaborative group notes/tasks never inherit private member or pastoral notebook contents.''',
'S20':'''Volunteer is approved service participation, not a separate volunteer-only authentication role.
Visitors/minors require opportunity-specific approved eligibility/consent/screening rather than blanket inclusion.
Team/position/date/skills/capacity configuration has an actual coordinator and published expectations.
Availability, offer/invitation and coordinator confirmation are separate actual response steps.
Invited/offered/confirmed/cancelled/completed states identify actual next actor and timestamps.
Overlap/prerequisite checks block unsafe assignment while cross-parish busy details remain private.
Late cancellation/swap leaves real vacancy until eligible replacement independently accepts/confirmed.
Assign/change dialog and keyboard/touch path enforce same rules as drag-and-drop.
Actual hours require independent source review and are never invented from scheduled duration.
Public opportunity sheet omits volunteer private identity/contact and closed opportunity remains historically permitted.''',
'S21':'''Eligible non-Mass event/program and primary capacity pool/session structure are explicit.
Form/event/room creation preserves proper publication and resource approval rather than hidden confirmed booking.
Guest/member/guardian/office entry verifies subject authority without automatic person/member creation.
Builder field conditions, preview, visibility and attachments match enumerated form dictionary.
Atomic capacity includes Reserved/Confirmed and distinguishes mere submission from actual hold.
Staff-reviewed waitlist order/invitation deadline/expiry is explicit and never silently assumes delivered invitation.
Reserved may await consent; Confirmed/check-in require real applicable consent, payment separate approved policy.
Consent pins event/version/giver and unknown age/material wording change triggers review/reconsent.
Transport selection/seat/route/fees remain separately allocated when schedule or paid option changes.
Fee basis/snapshot/discount/waiver/installment policy has actual eligible approver and no invented rates.
Only actual receipt method/proof generates paid status; claimed bank/OMT transfer remains pending verification.
Different-currency/split/overpayment allocations retain original amount/rate/date/source and unapplied balance.
Receipt correction/refund uses original canonical reference and attributed reversal, not deletion/double Finance posting.
Cancellation separately resolves place/transport/fee/refund approval and actual refunded payment.
Participant-bearing event/currency locks require reviewed amendment/replacement, never silent reassignment.
Legacy unlinked/closed/duplicate/unpaid/undelivered states show exact next action and no fabricated confirmation.''',
'S22':'''Check-in is exact registered event/occurrence operation on assigned devices/users, never individual Mass attendance.
Name/reference/code identifies candidate only and protected roster fallback preserves minimum disclosure.
Walk-in completes same capacity/consent/age eligibility before check-in, never bypasses full event.
Care/pickup alerts are visible only to assigned operators away from bystanders.
Duplicate arrival/wrong event/checkout/reentry create correct history without overwriting actual times.
Collectors/restrictions have reusable authority plus event-specific confirmation and actual identity check.
Code creation/delivery/loss replacement is real and code alone never authorizes pickup.
Unauthorized collector has no ordinary release; named safeguarding lead and verified guardian route must exist.
Independent departure needs explicit approved permission and actual exit evidence, not missing collector configuration.
Incident links actual known event/person/location without invented legacy links or broad office disclosure.
Restricted report records actual response/handler/closure/amendment rather than claiming help was automatically sent.
Emergency roster states active event participants and refresh time, explicitly excluding whole-building coverage.
Offline paper arrival/pickup follows approved procedure and reconciles original event times versus later entry.
Training labels true functions/manual contacts and unconfigured broadcast delivery honestly.''',
'S23':'''Resource identity/properties/combinations/capacity/operating hours and serviceability affect actual availability.
Public/member/leader/renter request rights remain separate from confirmed-booking authority.
Public free/busy omits private titles/contacts/payments; staff details follow actual grant.
Submission is not hold; explicit 24-hour proposed hold has owner/expiry and real availability evaluation.
Winning booking prompts reviewed competitor alternatives rather than silent automatic refusal.
Default priest confirmation/direct path and explicit routine delegated booking scope are distinguishable.
Setup/cleanup/recurrence/operating hours/shared partitions are included in resource conflict computation.
Reservation owns consequential date and deliberately linked calendar/plan/form never creates copies.
Actual responsible adult/purpose/access/agreements are collected only when genuinely required.
Pricing/deposit/waiver/refund terms pin approved version and link actual money once.
Applicant reschedule/cancel request preserves original until approved alternative/resources/financial consequences resolved.
Maintenance previews existing bookings and distinguishes routine relocation plan from urgent unsafe restriction.
Atomic room-plus-equipment reservation and quantity/condition/return history cannot overcommit stock.
Qualified repair clearance and evidence/cost/notifications are actual, not reporter’s unverified all-clear.
External renter is not parish member; reviewed identity link never merges customer histories by name alone.
Utilization/overdue/decision-time figures disclose source period/denominator and insufficient data.''',
'S24':'''Anonymous/person/household/restricted/campaign giving retains exact attribution purpose without hidden identity.
Donor identity/amount fields require separate finance scope, not leader/office rank.
Envelope lookup uses dated parish assignment and unknown/duplicate stays unattributed pending review.
Actual amount/currency/date/fund/method/origin/anonymous facts are captured before genuine receipt posting.
LBP entry stays actual LBP and any USD equivalent is separately labeled dated calculation.
Count source/date/currency/method and counter roles separate cash from bank receipts.
Independent second real person confirms exact reviewed revision; no static sample-success action.
Variance stays open with recount evidence and absence of second counter never becomes verified.
Close checks actual totals/revision and posts canonical movements once before locking.
Closed donor/fund reclassification changes allocation only while amount/currency/payment error uses real reversal.
Pledges/standing expectations never auto-charge or increase cash without actual receipt.
Campaign public totals use eligible net receipts and approved restricted/excess-fund handling.
Receipts/annual statements are versioned reviewed financial documents without unsupported tax/legal status.
Member/household giving view checks actual donor/statement-recipient authority, not family membership.''',
'S25':'''Administrative ledger versus actual external accounting authority/exchange is explicitly approved, not assumed certified replacement.
View/enter/approve/pay/reverse/reconcile/export rights are distinct and no person self-second-approves.
Actual fund/restriction/budget/period/account setup has competent finance approval and versioned changes.
Expense draft/approved/paid/reimbursed states represent distinct facts without sample threshold policy.
Supplier invoice, receipt and reimbursement claim are distinguishable with reviewed missing-evidence exception.
Original currency and applied conversion direction/date/source/result survive any later reporting-rate change.
Separate actual currency balances and labeled rounded equivalents cannot be mistaken for mixed cash.
Bank import/match previews split/combined/fees/duplicates/unmatched before actual reconciliation.
Independent close review/undo/reopen preserves statement coverage, balance and original close history.
Event/rental/giving/refund screens reference one canonical movement and allocations sum correctly.
Office allowance is internal transfer; purchases count once in consolidated expense without duplicated Finance entry.
Opening balance is entered once/currency and future carry-forward/correction never adds another initial balance.
Unreviewed ledger edits preserve audit; monthly-closed changes use attributed reversal/adjustment.
Internal vouchers/financial summaries have correct language/currency/source/signature approval status.
Diocesan aggregates versus itemized/donor identity require explicitly separate scope/field permission.
Finance viewer cannot mutate through stale route and unknown/sample metrics become honest unavailable states.''',
'S26':'''Private Inbox/request threads, audience communications and public/group posts have distinct destinations/permissions.
Purposeful recipient selection prevents national stranger/minor/private-contact enumeration.
Recipient sees actual sender/capacity and shared-office replies retain individual actor accounts.
Conversation participant changes cannot silently disclose earlier private history; household does not autojoin.
Sent correction is follow-up; own read/archive does not delete others’ message/attachment history.
Request timeline and Inbox resolve same canonical conversation without duplicate work/unread counts.
Notice audience/version/translation/pin/expiry follows actual publishing and membership access checks.
Prayer default is private and public anonymous/named wording needs exact approved permission/review.
In-app/manual baseline and each unavailable external channel have clear actual fallback.
Draft/scheduled/in-app/provider/delivered/read/failed states require their corresponding real evidence.
Rule records without runner are planning/manual worklists with actual trigger/owner/stop condition.
Every defined transition has explicit recipient/channel/message/privacy/timing/failure row or deliberate no-send.
Optional updates versus mandatory own-case/security availability honor actual language/channel/quiet-hour rules.
Account notification center filters parishes/read state and stale links recheck authorization.
Per-recipient/channel deduplication retries only failed still-eligible delivery with manual escalation.
Unwanted contact and exact-message exceptional review are restricted, reasoned and never browse-all access.''',
'S27':'''Concerns & complaints scope differs from ordinary requests, feedback and incident reporting.
Unlinked/minor eligible submitter has confidential policy-approved route without inherited guardian disclosure.
Actual category/sensitivity/urgency configuration requires qualified independent owner before live use.
Submission explains reviewer confidentiality/anonymity technical limits and real immediate-contact availability.
Submitter sees eligible independent reviewer descriptions, not private staff directory.
All-conflicted/senior-cleric allegation routes to real independent authority rather than implicated hierarchy.
Unselected administrators see neither contents nor counts; Review/ViewSensitive/ViewIdentity are distinct.
Assignment acceptance/reassignment checks conflict/scope without broadening case audience.
Actual owner/status/response targets and reopen/closure do not invent a universal service deadline.
Reviewer-only note and submitter reply are fixed visibly different audiences before send.
Later identity disclosure/hiding is informed and cannot undo prior authorized knowledge.
Evidence/export/redaction has exact purpose/reviewer/audit rather than ordinary general export.
Shared-device notifications contain no allegation/category/name or unrelated case existence.
Parish departure/account/reviewer changes preserve permitted tracking and independent case continuity.''',
'S28':'''Personal, pastoral, group and office task labels each show actual audience before saving.
Successor/bishop/admin cannot inherit private pastoral note; departed-author archive remains proposed restricted own snapshot.
Current-priests sharing warns about future appointees and withdrawal only stops future access.
Task cannot be assigned to someone unable to see it; share confirmation covers that task only.
Task dates/recurrence/reminders do not claim timed execution without actual service.
Complete/reopen/archive/delete has privacy-appropriate preserved history and approved retention dependency.
Actual builder examples cover event proposal, repair and purchase without weakening hard-coded approvals.
Template definition/publish/start/step/answer access require separate scoped eligible roles.
Conditional/parallel step validation prevents unreachable task or unauthorized religious/financial power.
Runs pin published version and pause-new versus safety-stop effects are explicit.
Detail shows real completed actors/times/current owner and final step closes only after real result commit.
Cancel/undo/reopen/transfer reviews dependencies and never erases committed official/money effects.''',
'S29':'''Management system/diocese/parish scope is visibly distinct from operational working parish filter.
Staff invitation uses individual controlled credentials and normal account can receive actual scoped appointment.
Exact audited username lookup/invitation avoids global email/name enumeration.
Account identity/local person/clergy title/appointment panels remain distinct and effective dates visible.
Several or no secretaries works; removal previews pending work and does not delete accounts.
Appointment/parish/global deactivation have explicit different scope/impact/recovery and no private work inheritance.
Title change checks real clergy authority and active incompatible priest assignments before demotion.
Administration versus local settings is authoritative once; legacy security/permission toggles cannot contradict policy.
Presence/Office/Community/Complete map exact real module families and public/member gates with no invented record limits.
Sponsored change follows actual diocesan approver; parish priest authority cannot silently alter sponsor arrangement.
Manual bundle baseline invents no prices/trials/invoices/renewals/automatic charges.
Downgrade retains permitted history/export and eligible existing completion while blocking defined new work.
Unavailable new public/member forms show real office route but existing tracking remains permitted.
Bishop overview has actual period/coverage/drill permission and no simplistic unjustified parish ranking.
Each report supports actual decision with explicit formula/status/source/denominator and no double counting.
Export states selected/all-matching scope, language/date/currency/format and does not silently limit page.
General/admin/restricted audit scopes retain actual actor/reason and exclude secrets/private message/case bodies.
Integration/API/webhook/AI settings show genuine configured/unavailable/error state and no credential/data disclosure by decorative toggle.''',
'S30':'''Named crowded/confusing screens are linked to concrete redesign decisions while useful existing identity remains.
Public welcoming/practical and staff calm/dense designs share consistent identity/language/controls.
Real logos/seals/typography approvals remain required and no guessed official seal appears.
Comfortable/compact/larger-text density preserves meaning and no critical mobile field disappears.
Personal palette/dark choices preserve readable text/focus/status and offer safe reset.
Full-page complex records versus short-edit drawer versus focused confirmation choice is consistent.
One outcome-named primary action with visible Save/Cancel/Back prevents accidental approval.
Consequential confirmation previews exact scope/effect; Undo applies only genuinely reversible low-impact actions.
Required/optional/conditional fields and progress preserve values through validation and language switch.
Linked field errors plus summary/focus and persistent actual success/partial-failure history are accessible.
Language change preserves target/draft/files/filter state and supplied original names remain unchanged.
Screens/print/interchange define digit/date/time/USD-LBP conventions without ambiguous conversion.
Arabic mixed-direction identifiers/contacts/amounts are isolated and meaningful navigation mirrors appropriately.
Named ordinary/domain language reviewers approve glossary/help/errors and missing translations remain explicit.
French remains required launch scope with actual unfinished coverage identified rather than silently deferred.
Every essential task has keyboard/screen-reader and nonvisual/non-drag alternative.
Actual prototype/device contrast/zoom/focus/touch/reduced-motion validation remains explicit unperformed work.
Phone cards preserve reference/parish/status/actor/date/money while matrices offer list alternatives.
Official EN/FR/AR/mixed-script print handles long names/page breaks/optional blanks under approved template.
Every main screen has loading/empty/no-match/denied/unconfigured/conflict/failure/success and meaningful next action.''',
'S31':'''Save-now, autosave-draft and explicit Save are consistently assigned without autosubmitting draft approvals.
Unsaved/saving/saved/failed/conflict feedback reflects actual persistence and unresolved error stays visible.
Only permitted server drafts resume across devices; sensitive shared-device local recovery is session-limited.
Back/Close/switch/logout offers only genuinely supported Save draft/Discard/Stay with safe destination.
Offline baseline permits only marked already-loaded reference/nonsensitive draft, no authoritative transactional write.
Connection-required message distinguishes unconfirmed from failed and gives status-check/manual recovery.
Future offline-write extension remains unapproved and would require full current permission/duplicate/availability revalidation.
Concurrency compares original/submitted/current while preserving permitted draft and immutable official facts.
Lost successful response retry queries stable operation and cannot duplicate money/request/arrival/approval.
Saved record with failed file/notice retries failed component alone and retains persistent partial result.
Revoked role/module/archived person during edit rechecks current action and preserves no unauthorized recovery copy.
Timeout/error/maintenance feedback gives safe next action/nonsecret support reference, never stack/private data.
Changed queues/availability/check-in/balances refresh without overwriting active form and final action rechecks.
Bulk preview/progress/item outcomes distinguish successful versus retriable and cancellation affects only unprocessed work.
Undo/trash proposals exclude issued disclosures/official/posted facts and explain formal correction limits.
Browser Data snapshot remains distinct from actual operator-controlled backup with restore evidence.''',
'S32':'''Every record class has competent retention approver and unknown real durations/holds remain explicit dependency.
Own-data access/correction/closure/deletion verifies requester and explains retained official/third-party records.
Deletion/deactivation review previews linked minors/household/work/finance/message/shared-record consequences.
Export purpose/field/scope/recipient preview excludes unrelated private data and explains handling.
Member/guest/office/admin help routes to real responsible role with sanitized support evidence.
First-use setup covers minimum activation plus actual requirements/public info/resources/finance/migration readiness.
Role-specific EN/FR/AR task help uses fictional examples and links actual procedure explanation.
Readiness shows unconfigured services/missing translations/legacy review without fabricated all-green launch.
Actual named role reviewers from both parishes are requested and no fictional test approval is recorded.
Uncoached task targets and zero-tolerance authority/privacy/pickup/money blockers are explicit proposals.
Small-phone/laptop/tablet/Arabic/keyboard/screen-reader/actual printer validation remains required evidence.
Developers retain product release authority while competent domain owners resolve rules and critical blockers.
Deferred choices need actual owner/date/milestone/fallback and cannot silently remove retained modules.
Workflow change versions all affected specs/prototypes/permissions/messages/prints before approved implementation.'''
}

REFINEMENTS={
'S01.07':'Your response that the question was irrelevant is preserved as the submitted view. The remaining jurisdiction/rite input is not treated as permission to invent a rite. Religious variation stays a configuration/authority dependency U02; this is a proposed resolution of that scope conflict, not an already approved doctrinal rule.',
'S02.05':'Later S03 directions determine Home/login behavior. Propose enforcing selected acting capacity for consequential actions; a focus-only switch over combined powers is a different unresolved model. No role switch counts as another person for finance/administrative dual review.',
'S02.07':'Proposed stage allow-list is acceptance, verified official-entry approval and certificate-preparation approval, each with a separate actual case instruction; competent clergy must approve the exact stage scope under U04. Actual signature, episcopal decision and recipient/file release remain independent rights. A disputed instruction suspends uncompleted dependencies, appends a correction and routes any already-issued/registered outcome through formal amendment; it does not erase history.',
'S03.07':'The recommended first-screen cards are a completion of your blank item, not an inferred approval. Quantities and filters resolve through MT01–MT15 in document-and-report-specifications.md; initial slots are My action, Today/upcoming, Reservations, Ministries and actual recorded-on-my-behalf activity for priest. Keep optional personal activity below the role-critical work in the same Home.',
'S03.09':'Badge definitions are MT01–MT03. Unread Inbox counts messages, not conversations; notifications count their own unread notice IDs. Waitlist operational badge counts event waitlists needing a decision and labels participant count separately. Server result unknown/error never becomes zero.',
'S05.09':'Proposed public pin limit: three current pinned announcements per parish/audience, ordered manually by permitted publisher, then newest publish time; a fourth requires unpinning one in preview. Each item pins audience/version/publish/expiry and all required language readiness. This proposed limit is not a recorded owner choice.',
'S06.05':'New account may authenticate with legitimate existing/current credentials while contact remains Unverified; no self-service verified-contact recovery or sensitive association follows from mere contact entry. Staff appointment requires actual appointing identity review; a truly mandatory verification/MFA launch requirement remains U10 until implemented or explicitly revised. Do not relabel manual identity review as email/SMS verification.',
'S06.07':'This reviewed proposal supersedes the earlier unapproved 12-character ordinary-password recommendation: use 16–200 for newly set passwords across accounts, with deliberate existing-credential migration. Use actual compromised/common-password checking, allow paste/password managers/spaces and avoid arbitrary character-composition or calendar-only forced changes. The product/security owner approves final controls; NIST context and limits are cited in document-and-report-specifications.md.',
'S06.12':'Proposed staff/sensitive inactivity timeout is 15 minutes with warning at 13; ordinary sessions 30 minutes. Show true save state before reauthentication, preserve only still-authorized drafts and clear secrets/local sensitive recovery on explicit shared-device logout. These are product defaults, not already implemented or statutory periods.',
'S08.06':'Remove blood type from the ordinary default person form/display unless the parish supplies a documented purpose and permitted reader group. A retained field is explicitly declared/unverified and restricted; the system must never present it as medically reliable. Event-specific relevant care alert is separately purpose-limited. Optional occupation/skills need no medical access grant.',
'S10.01':'Proposed first migration order: organizational identity/appointments and approved service templates; people/households and dated envelope links; active ministry/event/booking work; reconciled opening balances; reviewed historical official entries and evidence. Actual formats/volumes remain U11; XLSX support is a desired reviewed importer, not a claim of current code support.',
'S11.11':'Unhandled means no office acceptance/decision or resource/financial dependency has committed. At that boundary allow applicant withdrawal; after it, cancellation/reschedule is a request reviewed by current domain owner. A missing-information state alone does not unlock previously approved official fields.',
'S11.13':'Default wrong-parish handling is return with accurate contact guidance, not automatic transfer of private records. Cross-parish reassignment requires both eligible receiving ownership and informed applicant authorization, with retained origin and limited necessary evidence; it never resurrects removed person-transfer functionality.',
'S11.15':'Internal proposed worklist/escalation defaults are daily review, follow-up at three working days and lead/priest escalation at five, all clearly internal until the actual parish commits a type-specific public target. Urgent pastoral request uses actual maintained contact/hours; it does not wait for or pretend to have a timed notification runner.',
'S12.09':'The software should support a clergy-approved scope tuple parish + approved register series/sacrament + book/year policy, but no particular tuple or gap/number reuse rule is a church fact until U02. Allocate only at actual official approval under the selected policy; preserve historical original reference separately, and record voided allocations rather than silently reusing numbers. Preview policy before first live number is issued.',
'S12.13':'Recommend a dedicated Official register collection alongside Requests, with person/source link, sacrament/service type, actual date/year, book/page/number and approved/amended status filters. Requests remains intake/work history. Export register explicitly includes every authorized matching approved entry under selected scope, not current page; identify amended originals and historical/external references correctly.',
'S13.01':'Minimum intake: requester/contact/authority, supplied child/adult name, known birth facts/precision and proposed parish/service. Preparation adds verified guardian/parent/godparent facts and domain-approved evidence. Official entry needs actual approved identity spellings, actual celebration/celebrant/place and mandatory jurisdiction fields. Unknown parent or script cannot block legitimate adult/provisional intake, while final required official facts remain genuine gates.',
'S13.04':'The priest supplies actual prior-record, age/formation and group-preparation requirements under U02. Do not hard-code an age or sacrament prerequisite from assumptions. Approved external prior evidence is a source reference; individual formation/readiness is reviewed even in group celebration.',
'S13.08':'Describe funeral as a pastoral/service workflow rather than asserting it is a sacrament. Any actual funeral register or extract is jurisdiction-approved; no universal document is fabricated. Urgent arrangements can start from reported facts, but death/account/publicity changes each need their own reviewed basis.',
'S14.03':'Current implementation has a new-certificate bishop acceptance stage. Retain that as the proposed default pending actual bishop confirmation; do not describe it as universal church law. If no competent policy or substitute is available, issue no invented acceptance and keep the case visibly waiting with real office contact.',
'S14.10':'Official digital validity remains a factual U05 dependency; a printed/downloaded image, QR or serial is not proof. Proposed baseline preserves approved wet-signed/sealed paper and labels digital preview/copy honestly. Every allowed file format uses the same draft/final/version/recipient gates.',
'S15.04':'Use PDF/JPEG/PNG for official evidence, proposed 10 MB/file and 20 files/case; over-20-page PDF gets reviewed office route rather than truncation. Nonofficial resources/messages may permit text under their separate declared safe policy. Actual capacity/security validation and any larger exception require named owner; these are proposed product limits.',
'S15.11':'Current source permits released guest file lookup by tracking token/file/status. The stronger proposed authenticated association or real challenge at sensitive download time is a design change still needing implementation. When challenge is unavailable, use verified collection or reviewed account association; do not assert that release-time identity confirmation protects every later bearer of a leaked link.',
'S16.07':'Proposed defaults: laptop staff Week, phone/public List, Monday week start, initial visible 07:00–23:00 with clear expand-to-24-hours control. These are view preferences, not limits on actual approved early/late/all-day events. Per-account/role/parish memory restores only still-authorized filters.',
'S19.03':'Default RSVP is optional for ordinary ministry meetings, required only when the published event/group policy actually needs planning counts. Deadline defaults to meeting start; coordinator may set earlier exact cutoff before publishing. Absence reason optional/private; RSVP No is not recorded absence.',
'S19.04':'Proposed metric uses Present + Late numerator; denominator is actual expected roster opportunities excluding Not expected, with Excused reported separately but retained in baseline denominator. Always display unrecorded count/coverage; a different approved group calculation must be versioned and labeled rather than silently changing old percentages.',
'S21.05':'Do not create silent checkout holds in the launch baseline. Confirmed and actually Reserved places count; mere Submitted does not unless the form clearly issues a real reservation. Capacity and transport seats recheck atomically; no ordinary capacity override beyond physical/approved constraints.',
'S21.06':'Proposed priority is eligible application order, with transparent policy exceptions only if approved before offers. Staff invites the next eligible applicant for 48 hours by default; 2–72-hour event-specific window must be stated before offering and evaluate actual expiry even without push worker. No automated promotion is claimed from a stored automation setting.',
'S21.11':'The document names cash, bank and OMT as recordable methods only where a parish actually accepts them. Claim/proof of transfer remains pending until verified. It never implies an OMT API or card/payment gateway integration.',
'S22.08':'This specification does not invent a child-protection emergency procedure. Ordinary pickup by unauthorized/restricted person is blocked. Actual named trained lead, supervision arrangements, guardian verification and escalation contacts/policy under U07 are mandatory before operating; lacking them is a live-use blocker, not a request to bypass the restriction.',
'S24.08':'Default without second counter: keep batch unverified/open and arrange an actual distinct-person review. No exceptional single-counter closing is enabled by this proposal; if finance owners later adopt an exception, it needs a separate versioned rule, explicit approver/evidence and visible Unverified/exception status.',
'S25.02':'Baseline uses independent approval for financial commitments, refunds, posted corrections and period close; no unapproved sample monetary thresholds. A small parish with one operator must arrange an eligible independent reviewer rather than count the same person’s role switch as dual control. Ordinary entry itself need not wait for a second person.',
'S25.07':'Proposed accounting display/rounding: USD cents, LBP whole units, half-up at allocation boundary; retain original currency, exact applied rate up to eight decimal places and explicit residual allocation. These precision/rounding choices need finance approval and are not claims about statutory accounting rules.',
'S25.11':'The source draft’s “Owner direction applied” heading is interpreted here as applying the retained module structure, not new proof of financial approval. Separate Office Expenses is source-documented; actual consolidated mapping and competent financial policy still require U06.',
'S26.04':'Default adding a new participant does not reveal earlier private thread. Start a new conversation or explicitly forward selected messages after confirming all affected participants/authority and excluding restricted attachments. Shared office handling uses actual individual accounts and visible sender capacity.',
'S26.12':'The full transition-by-transition source is notification-matrix.md, replacing the older draft’s Appendix C reference. Each retained workflow has explicit rows including meaningful return/cancel/reopen and deliberate local no-send cases. Priest-instruction notifications are oversight only, never duplicate approval requests.',
'S26.13':'Proposed optional quiet window is 21:00–08:00 parish time with optional daily 08:00 digest, effective only with actual runner. Necessary own-case/security events remain available in-app without permission to send arbitrary external messages. User channel preferences cannot invent provider delivery or override case privacy.',
'S26.14':'Choose unread-message unit, not conversations, for Inbox; notification badge counts own unread notification IDs separately. Opening a linked record does not mark notice read unless user explicitly opens/marks that notice; viewing the notification can mark it read after successful authorized load.',
'S27.09':'Propose internal first-review worklist within one working day and independent lead escalation after two unassigned working days, subject to actual independent service approval. Do not publish these as response guarantees or route delayed allegations to implicated clergy. Missing real conflict-free escalation owner is U07 launch blocker.',
'S28.07':'Three fully specified builder examples are event proposal (details → resource check → priest decision → publication), equipment repair (report → triage → repair → qualified clearance), and purchase request (evidence → independent approval → actual payment/receipt). Builder may coordinate but not replace mandatory hard-coded clergy/finance permissions; pin each published template version.',
'S29.09':'Inspected current source matrix: Presence has no optional module flags; Office enables office/requests/sacraments; Community enables office/requests/ministries/facilities; Complete enables all six plus finance. Community is not an Office superset because it lacks sacraments. No record limits/prices are evidenced; propose no artificial record cap, bounded pagination/file limits and explicit capacity validation. All retained modules remain design scope, configured parish plan controls new work only.',
'S29.15':'Use MT01–MT15 in document-and-report-specifications.md, replacing Appendix B. Each report states included record types/statuses, dates, scope, numerator/denominator, missingness and currency basis; sum canonical movement allocations only under their defined view.',
'S29.18':'Do not represent unimplemented AI/API/webhook actions as active features. AI processing of private clergy/health/concern/financial data requires a separately approved purpose, actual integration and disclosure/access policy; baseline keeps such automated sharing disabled while configuration module remains in scope.',
'S30.12':'Use supplied Latin digits for operational IDs/phone/amounts, localized month-name screen dates and ISO dates for interchange; parish-local 24-hour operational print. Arabic flow isolates phone/email/URL/reference and currency fragments without reversing their value. USD/LBP original balances separate; a reporting equivalent always states direction/date/source.',
'S30.17':'Adopt WCAG 2.2 AA as a proposed verification target, not a certification or asserted local legal duty. Validate normal-text 4.5:1 and large-text 3:1 contrast, keyboard/focus, 200% resize/reflow and alternatives to dragging with intended users; all actual prototype evidence remains U14. Authoritative W3C source is linked in the screen inventory.',
'S31.05':'Do not authorize offline authoritative payments, registration capacity confirmation, arrival/pickup app writes, approvals, signatures or reservations in baseline. Offline event operation is a separately approved trained paper procedure with later reviewed entry, not a hidden pending digital write queue.',
'S31.09':'Use stable operation identity scoped to actor/target/action/payload and authoritative result lookup. Reusing same key with conflicting payload is refused; retry of known commit returns original result. Unknown status never becomes automatic second payment/approval/registration.',
'S31.15':'Accessible Undo covers only reversible draft/list action (proposed 10 seconds), not already-sent disclosure, issued signature, final official entry, bank outflow or child pickup. Reviewed formal correction/reversal/incident procedures handle those consequences. Proposed 30-day personal trash requires retention approval; no statutory period inferred.',
'S32.01':'For each record class, approve retention trigger, duration, custodian, permitted anonymization/deletion, holds and minimal disposal evidence. U08 identifies competent role owners; no default statutory time is made up. Interim no-purge/restricted access is temporary pending real policy, not indefinite retention approval.',
'S32.10':'Proposed uncoached targets and tasks appear in screen inventory: discovery 2 minutes; ordinary request/registration 6; evidence correction 3; priest instruction recording 2; booking conflict 5; eligible single-person check-in 30 seconds. These are usability targets excluding external waiting, not measured results. Authority/privacy/pickup/financial-integrity errors have zero tolerance.',
'S32.13':'U01–U15 replace the earlier Appendix D input reference. Each has exact evidence, responsible role, proposed milestone, interim behavior and launch implication. No calendar date is fabricated; owner must assign actual date before recording an agreed deferral. All modules remain in scope and critical unknowns remain blockers.',
}

def main():
    criteria={}
    for s,txt in CRITERIA.items():
        vals=txt.strip().splitlines();qids=[q['id'] for q in QS if q['section']==s]
        assert len(vals)==len(qids),(s,len(vals),len(qids))
        criteria.update(zip(qids,vals))
    assert set(criteria)=={q['id'] for q in QS}
    write('acceptance-criteria.json',json.dumps(criteria,ensure_ascii=False,indent=2))
    write('answer-refinements.json',json.dumps(REFINEMENTS,ensure_ascii=False,indent=2))
    # Remove superseded or unresolvable old appendix text, rather than leave contradictions.
    DATA['S06.07']['body']=DATA['S06.07']['body'].replace('Proposed minimums are 12 characters for ordinary new credentials and 16 for privileged accounts, with a generous maximum;', 'The reviewed proposal is 16–200 characters for all newly set credentials;')
    DATA['S26.12']['body']=DATA['S26.12']['body'].replace('the transition matrix in Appendix C','the [transition matrix](notification-matrix.md)')
    DATA['S29.15']['body']=DATA['S29.15']['body'].replace('Appendix B specifies shared metric rules.','[Document/report specifications](document-and-report-specifications.md) define MT01–MT15.')
    DATA['S32.13']['body']=DATA['S32.13']['body'].replace('Appendix D lists these inputs and who must supply them;','[Open inputs U01–U15](open-inputs-and-conflicts.md) list these facts and role owners;')
    DATA['S29.09']['body']=DATA['S29.09']['body'].replace('Community = office + requests + ministries + facilities;', 'Community = office + requests + ministries + facilities (no sacraments module);')
    # Fix incorrect blanket owner-attribution in earlier generated source, preserve actual proposal.
    DATA['S25.11']['body']=DATA['S25.11']['body'].replace('**Owner direction applied:**','**Source-documented module structure; financial mapping proposed:**')
    SPEC_MAP['S03']=['WF52','WF11'];SPEC_MAP['S04']=['WF51','WF11'];SPEC_MAP['S13']=['WF14','WF15','WF16','WF17','WF18','WF53','WF54','WF55','WF56'];SPEC_MAP['S19']=['WF28','WF29','WF65'];SPEC_MAP['S21']=['WF31','WF33','WF57'];SPEC_MAP['S22']=['WF34','WF58','WF35'];SPEC_MAP['S24']=['WF41','WF42','WF59','WF60','WF61'];SPEC_MAP['S26']=['WF46','WF32','WF62'];SPEC_MAP['S28']=['WF48','WF49','WF63'];SPEC_MAP['S31']=['WF22','WF34','WF64'];SPEC_MAP['S32']=['WF50','WF39','WF64']
    generate_answers()
    from render_governance import render_register
    # The imported register builder has original mappings; update its global shared map.
    render_register.__globals__['SPEC_MAP']=SPEC_MAP
    render_register()
    print(f'{len(criteria)} question-specific acceptance criteria; {len(REFINEMENTS)} substantive completions applied.')

if __name__=='__main__':main()
