# id, fictional setup, actors/screens, numbered steps, recovery, expected evidence, workflows
CASES=[
('A01','Adult Maya, 29, has no account/person link. Test parishes A and B publish different public activities.','Maya; SC01–SC05; no office identity rights.',[
'Maya creates her individual account with own contact, language and required notices. Actual save creates account only; no person, household or ministry is fabricated.',
'Her single-role login opens the combined Home directly. She chooses Follow for A and B, then A as primary; each relationship is labeled Following.',
'She skips optional profile completion and views only approved public activity from both parishes. A membership call-to-action explains the separate verified person link.',
'She returns later, authenticates and sees her saved follows/primary choice and incomplete-profile prompt without repeating signup. Creating a request confirms one target parish.'],
'A failed follow save stays visibly pending/failed; retry same preference operation. Denied optional location uses manual locality search. No unverified contact is marked verified.',
'One account; two follows; one primary preference; zero inferred person/staff/roster links. Language/context persist; no other user data exposed.','WF01 WF04 WF51 WF52'),
('A02','Applicant Joseph matches two office people, EX-P01 and EX-P02; EX-P02 already links another account.','Joseph own application; office identity reviewer; SC06/SC07/SC09.',[
'Office opens the membership application and sees only permitted comparison fields: supplied scripts, date precision, household/contact, source and link/archive status.',
'Reviewer records Need information instead of choosing by surname. Applicant receives M02 and a secure request for distinguishing evidence, not names of other account holders.',
'Existing link on EX-P02 blocks ordinary reassignment. Evidence that it may be wrong opens a restricted link dispute and previews affected access and own-case links.',
'A distinct authorized identity review chooses EX-P01 only after evidence supports it, records verification method/date and applies one membership association. Prior candidate rejection remains traceable.'],
'If source changed since comparison, refresh/reconcile. Never unmerge/move sacramental history to force a match. If still uncertain keep pending with assigned reviewer.',
'No link to another person, no account enumeration to applicant, no duplicate account/person link, exact decision evidence and own outcome notice.','WF04 WF06 WF07'),
('A03','Verified guardian Lina requests baptism for infant Sami; Arabic spelling is not supplied; archived EX-P03 resembles the child.','Lina own guardian scope; office matcher; priest; SC11/SC12/SC07.',[
'Lina supplies actual known birth/parent facts and marks missing Arabic name Not supplied. Intake accepts a provisional case with no fake transliteration/date.',
'Office searches active and archived candidates before creating a child. It compares EX-P03 identity and guardian source; ambiguous match remains Needs information.',
'If evidence proves the same child, authorized restore keeps EX-P03 ID and reviews household/guardian links; if demonstrably different, creation records that decision and source.',
'Priest acceptance starts preparation; missing approved official name/script becomes a final-output task according to supplied checklist. No certificate/official approval bypasses that requirement.'],
'If archive/access changes during review, stop stale save and retain only permitted draft. Applicant sees own missing-name task, never unrelated archived child details.',
'One correctly matched or created child; unknown script preserved at intake; final readiness gate and representation evidence; no automatic restored consent/role.','WF11 WF14 WF06 WF08'),
('A04','Guest Nadine submits baptism case EX-R04, loses the tracking link, then creates account EX-A04.','Nadine; office identity/link reviewer; SC04/SC11/SC05/SC14.',[
'Guest success shows actual saved reference, private tracking warning and clear next step. It does not create parish membership.',
'Lost-link recovery asks for verified contact or reviewed office identity. A claimed name/reference alone does not generate a new secret link.',
'After Nadine authenticates, office reviews association between account EX-A04 and actual requester. If old link unavailable, recovery and association share evidence but remain separate audited decisions.',
'Approved link exposes only her own case/timeline and explicitly released files through authenticated projection; original guest reference/origin remains. Rotate leaked/lost token when appropriate.'],
'No contact-delivery service means reviewed office handoff/association, never a fake challenge. A rejected association gives a neutral reason without another requester’s details.',
'One canonical case and account association; old revoked link fails future access; no automatic person, ministry or staff membership.','WF11 WF03 WF04 WF21'),
('A05','Baptism EX-R05 has two missing requirements. A priest accepts before secretary review; supplied PDF is illegible.','Applicant; secretary; priest; evidence verifier; SC10–SC14.',[
'Secretary’s optional precheck remains not performed when priest accepts directly. History names the actual priest decision; acceptance does not verify documents.',
'Case enters Preparation with exact missing items and each item’s required stage/owner. Applicant gets secure M02 specifying the requested item.',
'Verifier marks uploaded PDF Rejected/Illegible with useful applicant-safe replacement instruction; does not decline the entire request or mark paper originals verified.',
'Applicant replaces the one item; prior file/version and rejection remain restricted. A successful upload with lost response is checked by operation/file ID before retry. Final preparation gate advances only after actual verification/allowed waiver.'],
'If secretary is instead recording prior priest instruction, require case/stage/priest/attestation, effective once with M03 to priest; no extra approval wait. Upload failure leaves saved case and other files intact.',
'Direct acceptance preserved, document incompleteness separate, one replacement/version chain, no duplicate case or simulated verification.','WF14 WF22 WF11'),
('A06','Marriage EX-R06 includes local Maya, outside-parish Adam and an external celebrant. Desired room and priest time conflict.','Each partner; office; assigned priest; competent outside authority; scheduler; SC11/SC12/SC15/SC25.',[
'Office records both partners separately, using a reviewed external participant reference rather than mandatory local membership for Adam.',
'Assigned priest identifies actual special/external authorization required from approved policy. Permission evidence/date/scope is a real gate, not automated eligibility judgment.',
'Scheduler checks room/setup/cleanup, priest and equipment against canonical commitments. Private conflicting event displays only permitted busy information.',
'Office offers alternative time/room/eligible celebrant; confirms applicant choice and actual external authority, then confirms preparation/scheduling under the correct source. Public wedding title stays generic unless separately approved.'],
'An override cannot authorize impossible exclusive double-booking. A stale alternative rechecks atomically; no fee payment or secretary entry substitutes for external permission.',
'One conflict-free occurrence, separately authorized outside celebrant/partner facts, private partner data, no duplicate local sacrament or member account.','WF17 WF23 WF13'),
('A07','Planned celebration EX-E07 has waiting certificate EX-C07. Three branches: postponed, cancelled, or no-show.','Applicant; scheduler; priest; certificate preparer; SC12/SC13/SC15.',[
'Postponement retains case and source link, records old/new proposed date and rechecks resources. Applicant acknowledges material change; certificate remains Waiting for official entry.',
'Pre-celebration cancellation records competent reason, releases only appropriate future reservations, reviews fee/refund and updates the dependent certificate with useful explanation.',
'No-show records actual nonoccurrence, not Celebrated. Offer reviewed rescheduling/cancellation; no register number or official certificate is generated from scheduled date.',
'If an alternative already-approved official source exists, preparer proposes exact identity/source link for clergy review rather than silently assigning it.'],
'Lost save response queries actual occurrence/case state before another cancel/rebook. Past genuine official entry cannot be deleted by these branches.',
'No scheduled or cancelled ceremony becomes a fictitious celebration; certificate gate remains correct, linked payments/resources have explicit outcomes.','WF14 WF15 WF16 WF17 WF18 WF20 WF23'),
('A08','Office transcribes actual celebration EX-R08 with wrong family spelling. Priest returns it; after final registration further evidence requires amendment.','Office preparer; priest; official custodian; SC12/SC13.',[
'Entry submission pins actual celebration and identity source. Priest compares and returns the spelling with reason without rejecting the original service need.',
'Office revises proposed entry, retains old proposal/source, and resubmits. Priest approves only verified actual facts; official number follows supplied numbering policy.',
'After registration another correction request opens WF19 against the locked snapshot. Competent reviewer verifies evidence and records approved amendment with original and corrected reading.',
'Affected certificate versions are listed for reissue/revocation review. Historical signed output is not recomposed from a newly edited profile.'],
'Two reviewers editing same proposed field compare source/current/submitted. A secretary’s instructed register approval, only if U04 allows that stage, records both identities and no fake personal click.',
'Returned draft and immutable approved original preserved; authorized amendment and document consequences fully traceable.','WF14 WF19 WF20 WF05'),
('A09','Certificate EX-C09 is actually signed, returned by bishop, corrected, accepted, then collected by nominated representative.','Office; actual priest signer; actual bishop; verified representative; SC13/SC14.',[
'Signing pins version 1 and sends actual applicable bishop review; applicant sees neutral processing rather than ready-to-collect.',
'Bishop returns with restricted reason. Version 2 highlights corrected material, invalidates signature on changed content and requires new actual priest signing and bishop review.',
'After actual acceptance and issuance, releaser checks recipient authorization, subject, source, version/language and complete file preview before releasing.',
'Counter staff verify nominated representative identity/authority at physical handover and record actual recipient/time/method. Printed authority names priest; internal history retains preparation/secretary attribution.'],
'Unassigned substitute/admin cannot sign or accept by rank. Uncollected/failed delivery remains follow-up; availability is not collection.',
'Exact accepted/resigned version delivered to authorized representative; original return/revision survives; no pre-gate ready/collected claim.','WF20 WF21 WF22'),
('A10','Guest EX-R10 has private prepared certificate file; another person’s file is accidentally selected for release.','Authorized preparer/releaser; guest; privacy incident reviewer; SC14/SC24.',[
'Prepared private file is visible only to office; guest tracking lists no download until actual release gates are met.',
'Release preview shows subject/requester/recipient/file version/language and source certificate. Mismatch blocks commit; record safe correction, never attach the other person’s output to pass validation.',
'If wrong release already happened, withdraw future access immediately, preserve exact released file/recipient/access history and route restricted disclosure review.',
'Issue corrected authorized release only after repeated identity/gate checks. Guest sees safe withdrawal/contact explanation; downloaded copies cannot honestly be recalled.'],
'Lost release response queries release operation/file/version. Failed notification retries only message, never another document release. Leaked link rotated after identity review.',
'Before-commit mismatch has zero disclosure; after-commit response limits future exposure and retains real incident evidence and corrected version history.','WF20 WF21 WF22 WF35'),
('A11','Nour applies to ministry EX-G11, leader approves, Nour asks withdrawal, later reapplies and eventually privately departs.','Nour; assigned leader; priest; SC18/SC19/SC31.',[
'Application is Pending until priest final approval; leader review alone does not add roster membership.',
'Withdrawal after leader approval becomes a tracked priest review, retaining prior decisions. Priest approves withdrawal; terminal request cannot later add a roster row.',
'Reapplication is a new linked application with fresh eligibility/capacity review. Only real priest final approval creates one active membership.',
'Private departure reason is visible to Nour and eligible parish priests only. Nour can mute optional messages/stop volunteering while review waits; approved departure tells leader only neutral end date and future handover needs.'],
'Duplicate reapplication while one pending is prevented. Former attendance remains historic; departure reason never appears in leader export/message.',
'Correct withdrawal/reapply/active/departed chronology, one active roster row at a time, private departure reason and retained history.','WF26 WF27 WF28 WF46'),
('A12','Leader Hadi leaves group EX-G12 with open applications, group-owned files/tasks and attendance correction.','Appointing authority; old/new leader; priest; SC18–SC20/SC35.',[
'Authority reviews handover list, appoints eligible replacement with exact ministry scope and revokes old leadership on effective action.',
'Pending applications/tasks move to eligible new owner or priest; old decisions/authorship remain attributed. No general new leader access to private departure/concern/pastoral contents.',
'Group-owned permitted resources keep group identity/version. Old leader’s personal notes/files do not silently become group resources.',
'Attendance correction uses exact historical meeting/roster revision and pre/post-close rule. Old open tab fails next protected leadership request; ordinary member access can remain.'],
'No replacement yet routes operational queue to priest/eligible appointee, never unrelated leader. Concurrent revocation/correction queries commit status and preserves valid earlier authorship.',
'No lost pending work, no unauthorized old-leader action, scoped custody/task transfer and immutable historical attribution.','WF38 WF26 WF28 WF29 WF49'),
('A13','Volunteer Rami is confirmed for parish A 10:00–12:00, offers parish B 11:00–13:00, then cancels a later nonconflicting duty shortly before start.','Rami; B coordinator; actual replacement; SC21/SC15.',[
'Assignment checks actual confirmed overlap across authorized busy information. B coordinator sees conflict interval only, no private title/participant data from A.',
'Coordinator offers nonoverlapping 13:00–14:00; Rami accepts and eligibility/training/capacity are rechecked before Confirmed.',
'Rami later requests late cancellation; slot remains visibly unfilled/at risk until coordinator resolves it. A proposed replacement is not confirmation.',
'Replacement independently accepts and passes checks; coordinator confirms exact duty and notices actual affected actors. Actual served hours need later independent review.'],
'No available replacement leaves a real gap/escalation. Retry cannot assign two people beyond position capacity; drag and non-drag paths enforce same rules.',
'No physically overlapping confirmation, no cross-parish privacy leak, real late vacancy and independently accepted replacement; no fabricated hours.','WF30 WF23 WF46'),
('A14','Event EX-E14 has one seat left. Two families submit; child A has unknown birth date/consent, child B has USD 20 fee payment plus USD 5 transport payment.','Guardians; registration/capacity service; consent reviewer; cashier; SC22/SC23.',[
'Atomic seat action gives at most one Reserved place; the other applicant becomes Waitlisted, never both silently confirmed.',
'Unknown exact age triggers approved consent/eligibility review. Reserved can await consent but consumes place; missing required consent blocks Confirmed/Check-in.',
'Actual fee/transport payments keep distinct allocations to one or more canonical receipt IDs and actual original currency; balances show charged/paid/outstanding clearly.',
'Waitlist offer has exact stated deadline and eligibility checks; released place promotes via real reviewed process. Payment cannot automatically displace another family or waive child checks.'],
'Lost capacity response checks reservation ID before retry. Partial upload/payment proof does not lose place facts or claim verified receipt. Unavailable timed runner means assigned manual invitation worklist.',
'Capacity never exceeded, correct unknown-age barrier, independently stated consent/payment/transport status and no duplicate money.','WF31 WF33 WF34'),
('A15','Paid event EX-E15 moves from one day/room to another; transport and consent wording materially change.','Event lead; scheduler; guardians/participants; finance refund approver; SC22/SC15/SC28.',[
'Lead opens material amendment preview listing every linked room, clergy/volunteer duty, participant, transport capacity, fee allocation and consent version.',
'New occurrence/resources recheck availability; locked form event/currency not silently repointed. Use linked approved amendment/replacement identity while preserving existing registrations and receipts.',
'Affected participants receive M07 with secure old/new details, reconfirm/reconsent deadline and real cancellation/refund options. Message delivery is not acknowledgment/consent.',
'Refund requester gets policy-reviewed amount allocated to original fee/transport receipts. Independent approval then actual payment creates one refund movement; seat/transport release follows explicit outcome.'],
'Nonresponse remains flagged with owner rather than fake accepted consent. Failed refund payment remains unpaid, and old bank/cash receipts remain unchanged.',
'Versioned schedule/consent/fee history; no reassigned event/currency shortcut; actual independently approved refunds and consistent resource availability.','WF23 WF31 WF13 WF57 WF33'),
('A16','Child Mira is expected at EX-E16. Connection fails during arrival; an unlisted collector later presents a code.','Trained door/pickup staff; named safeguarding lead; verified guardian; SC23.',[
'Operator clearly selects exact event/site/occurrence, checks permitted consent/restrictions, and marks network failure rather than successful online check-in.',
'Under approved procedure staff use protected dated roster and paper arrival log with actual local time/operator; old data age is visible and any unknown required authority resolved by trained lead.',
'Collector’s code is supporting evidence only. Unlisted/restricted identity cannot use ordinary Release; staff follow real safeguarding lead/verified guardian procedure without exposing child details publicly.',
'After reconnection an eligible reviewer reconciles paper arrival/exit by participant/event and original times. System entry time remains actual later time; duplicate arrival/checkout avoided.'],
'If guardian authority cannot be verified, do not release through ordinary flow. If no approved offline procedure/lead exists, readiness is blocked, not replaced with an invented emergency override.',
'No unauthorized pickup, no false online success, explicit paper provenance and one active event-session history after reconciliation.','WF34 WF58 WF35'),
('A17','An incident at event EX-E17 involves checked-in child and another person not on event roster.','Reporter; assigned restricted handler; event lead; SC24/SC23.',[
'Reporter creates factual event/location-linked restricted report, records actual immediate response and involved references without distributing allegations to general office.',
'Handler assignment/conflict checks and appropriate guardian disclosure are recorded separately; third-party evidence remains restricted.',
'Lead prints event emergency roster with exact event/site, active checked-in participants and last-update time. It explicitly excludes checked-out/unregistered people and says it is not everyone in building.',
'Unregistered person in incident does not get invented event check-in or parish membership. A need for whole-building coverage requires a separately approved attendance process.'],
'Offline roster must state stale time and use approved manual process; no “broadcast delivered” label without actual connected service.',
'Restricted incident with actual follow-up, truthful event-only roster, no general incident/concern count leakage.','WF35 WF34 WF58'),
('A18','Two room requests overlap; first needs 30-minute setup and has a deposit. Maintenance later affects the confirmed booking.','Requesters; resource manager; priest/delegated approver; maintenance lead; finance; SC25/SC26.',[
'Availability includes actual setup/cleanup occupation. Submission alone holds neither slot; explicit hold has owner and real expiry.',
'Approver reviews competing requests and confirms one eligible reservation after atomic recheck. Other becomes Alternative needed with useful options, not silent automatic refusal.',
'Actual deposit receipt references the same canonical movement in booking/Finance; approval of room remains a separate authority decision.',
'Maintenance impact preview lists confirmed booking and proposes relocation/new time. Routine maintenance waits for reviewed plan; urgent unsafe block records actual immediate restriction and assigned applicant follow-up/refund.'],
'Expired hold evaluated on protected availability check even if push reminder absent. Lost approval response checks actual reservation; no double booking or duplicate deposit.',
'One exclusive confirmed interval including setup; real competing-applicant outcome, deposit balance and maintenance-driven resolution.','WF13 WF36 WF33 WF57'),
('A19','External renter EX-X19 reserves two speakers, returns one damaged; a later booking needs both.','Custodian; renter; resource lead; qualified repair reviewer; finance; SC25/SC26/SC28.',[
'Renter/contact/terms remain separate from parish membership. Room-plus-two-speaker request commits stock and room together after eligibility/availability.',
'Issue/return record actual quantities/serials/condition. Damaged unit becomes unavailable; retained deposit is not automatically treated as damage income.',
'New shortage flags the later booking for explicit alternatives; custodian does not mark broken unit available to preserve a green calendar.',
'Repair process records qualified evidence/clearance; any damage deduction/refund uses published terms, independent financial approval and actual transaction.'],
'Partial return leaves loan outstanding. Disputed damage preserves evidence and appropriate held/unresolved balance; no silent renter merge or donation attribution.',
'Stock quantities reconcile; unsafe equipment excluded, later customer receives real resolution, deposit/refund not duplicated.','WF37 WF36 WF13 WF33 WF57'),
('A20','Count contains USD 100 and LBP 9,000,000; independent reviewer initially sees USD 95. Later USD 20 was allocated to wrong fund/household.','Two distinct counters; treasurer; independent adjustment approver; SC27/SC30.',[
'Record actual currencies and cash/bank methods separately; no LBP input reinterpreted as USD equivalent. Counter 2 enters actual independent observation of exact batch revision.',
'USD 5 variance leaves session open and assigned recount; both observations remain. Document correction/recount to genuine agreement, then authorized close posts once.',
'Closed batch original locks. Finance proposes USD 20 reclassification with original movement reference and correct household/fund evidence; distinct approver reviews.',
'Post allocation correction only: cash remains USD 100 plus LBP 9,000,000. Review/correct affected donor statement with new issue reference; household adults do not all gain donor access.'],
'No second counter means Unverified, not fixed sample success. Lost close response queries operation to avoid second posting.',
'Independent actual review, variance history, currency balances unchanged by attribution correction and linked corrected statement.','WF41 WF42 WF08 WF61'),
('A21','Event/rental receipt USD 25 and parish-to-office allowance USD 100 are recorded; office pays USD 30 purchase.','Cashier; office custodian; finance reconciler; SC22/SC25/SC28/SC29.',[
'Canonical receipt TX-21 USD 25 is allocated to source registration/rental obligations. Source screens and Finance reference TX-21, not a second cash movement.',
'Allowance TR-21 has matching transfer-out from parish bank and transfer-in to office cash; parish-wide expense is zero for transfer itself.',
'Actual office purchase TX-22 USD 30 is one expense, linked to receipt/voucher; Office Expenses projection in consolidated reporting does not create another Finance expense.',
'Reconcile actual balances independently per currency. Example bank 1000→900, office 0→100→70, combined 1000→970; adding actual external receipt gives 995 total if received into same counted scope.'],
'An invoice alone does not count as payment. Duplicate statement import/source retry reuses canonical ID; refunds reverse actual allocation once.',
'External USD 25 counted once, internal USD 100 transfer cancels consolidated, USD 30 purchase counted once with reproducible equations.','WF33 WF13 WF31 WF45 WF44'),
('A22','Reviewer-anonymous case EX-C22 alleges conduct of a senior cleric; originally selected reviewers become conflicted.','Submitter; eligible conflict-free independent routing authority; selected reviewers; SC32.',[
'Before submission screen explains reviewer anonymity and infrastructure correlation limits; no guaranteed untraceability claim.',
'Conflict checks exclude implicated/ineligible reviewers and prevent sending to ordinary office or accused cleric. All-conflicted state invokes actual preappointed independent authority/contact.',
'Reassignment records minimal reason and exact new eligible reviewers without broadening case audience. ViewSensitive and ViewIdentity remain separate; no identity is invented for anonymous case.',
'Unrelated admin/priest/bishop searches Home, My work, general audit and reports: receives no title, count, status, notification or export evidence of case existence. Submitter gets only neutral M05.'],
'If no real independent escalation authority exists, keep restricted submission safely pending with truthful contact/availability and mark launch readiness blocked; never invent a superior.',
'Independent eligible routing, no administrator aggregate leak, actual anonymity limits and restricted reassignment history.','WF47 WF38 WF46'),
('A23','Priest author saves private note N23 and explicitly shares task T23 with eligible priest; later author loses parish appointment.','Author; named eligible assignee; appointing authority; SC33/SC35.',[
'N23 remains author-private. T23 assignment warns and shares that task only; it does not expose the notebook or make all office staff readers.',
'If author selects current-priests audience, preview explains later appointed priests can read while share active. A narrower named-priest share avoids that expansion.',
'On appointment loss, current parish access and underlying person lookups stop on protected request. Pending shared task moves only to eligible assigned person; private note never transfers to successor/bishop/admin.',
'Proposed departed-author archive contains only retained authored snapshot, no live former-parish people data; requires U13 approval. Sharing can end future access but cannot erase already-read knowledge.'],
'Open stale tab cannot save as old priest. If policy for own archive unresolved, preserve private stored content with restricted reviewed access rather than grant unrestricted parish export.',
'Task-specific share and authorship preserved; private N23 inaccessible to successors; no live cross-parish data after revocation.','WF48 WF38 WF63'),
('A24','Editor A modifies live EN/FR/AR page revision 5; editor B publishes revision 6; A’s French translation is missing.','Two editors; publisher/language reviewer; SC04/SC31/SC36.',[
'Save draft leaves public revision 5 online. Preview clearly identifies draft, audience and each language readiness.',
'B publishes actual reviewed revision 6. A’s stale save/publish detects revision conflict, preserves permitted draft and compares changed fields/languages; no last-write-wins.',
'Missing French prevents A’s replacement being labeled trilingual/published under proposed policy. Existing complete revision 6 stays live; reviewer completes/approves needed translation.',
'Reconciled revision 7 rechecks all languages, rights, links and actual public phone/desktop rendering before authorized publication. Public content never picks up private internal metadata.'],
'Accidental private publication uses explicit immediate unpublish/restore prior approved version and restricted review; downloaded external copies cannot be recalled.',
'Live revision preserved during draft/conflict/missing translation; no hidden unpublish or fabricated language readiness.','WF32 WF52'),
('A25','Bishop-authorized Archdiocese Admin creates first test parish without secretary and assigns routine office work.','Diocesan administrator; bishop; priest/Parish Admin; SC02/SC35.',[
'No-parish administrative Home exposes setup and management scope without requiring a nonexistent working parish.',
'Admin prepares verified trilingual identity/core contact/head-priest/adoption facts; actual bishop approves ecclesiastical participation/appointment under recorded policy.',
'Valid Create and activate publishes approved core profile and makes parish usable immediately, optional secretary blank; gallery/legacy import not hidden prerequisite.',
'Authorized Parish Admin/higher office authority handles ordinary intake, people, calendar, evidence and release within explicit scope. Priest decision/signature still requires actual qualified priest; admin does not inherit secretary-only prior-instruction route.'],
'Missing minimum real identity/contact stays private setup draft. No fake secretary/shared account workaround. Exact active scope and real role visible on confirmations.',
'Operational no-secretary parish, attributable actual bishop/priest authority and intact signing boundary.','WF39 WF38 WF11 WF20 WF21'),
('A26','Diocese-sponsored parish requests downgrade with open sacramental cases, unpaid registrations and documents awaiting release.','Priest requester; authorized diocesan sponsor; office/finance/release owners; SC36/SC10/SC22/SC14.',[
'Impact preview lists exact affected modules/new entry points and all in-flight cases/balances/output releases; no invented billing charge.',
'Sponsored change waits actual sponsor approval; pending status retains current effective availability until actual decision/effective time.',
'At effect, unavailable new submissions show real office route; historic permitted read/export and existing applicant tracking stay available.',
'Assigned authorized owners complete already-open approved flows, collect/reconcile balances and release final documents under unchanged signature/identity gates. Archive/history not hidden because bundle changed.'],
'Lost update response queries actual plan state. Work cannot be abandoned, auto-approved or auto-cancelled merely to fit a bundle. Reactivation restores feature availability, not revoked permissions.',
'Sponsor authority, protected history/tracking, no lost financial/output obligations and no authorization bypass.','WF40 WF14 WF31 WF20 WF21 WF33'),
('A27','One account is treasurer in A and leader in B; two tabs open. User changes context mid-edit then loses A grant.','Account holder; appointer; SC02/SC21/SC28/SC35.',[
'Multiple-role login requires explicit choice. Combined Home labels each permitted parish/item; actions name one exact parish and eligible acting capacity.',
'Unsaved A edit offers supported Save draft/Discard/Stay before UI context change; selected rows/confirmations cleared. B role does not acquire A finance access.',
'Each tab retains its own immutable target context; B switch cannot redirect A pending write to B. Removing A grant invalidates next protected A read/write/download.',
'Revoked tab shows actual access-change failure and safe permitted Home/role choice. Keep only draft material account still entitled to retain; no hidden restricted recovery copy.'],
'If prior action committed before revocation preserve actual actor/time and query outcome; if not committed, do not claim saved. No retry under newly selected unrelated role.',
'No cross-parish save or old-authority continuation; unrelated B/member access preserved, counts/search refreshed.','WF52 WF38 WF43'),
('A28','Finance viewer EX-V28 has permitted fund totals/export subset and an old transaction-edit bookmark.','Viewer; scope finance grant; SC28/SC37.',[
'Search returns only permitted financial records/fields; donor identities absent without separate grant. Scope/date/currency/coverage visible.',
'Print/export preview states allowed columns, selected versus all matching count and stable filters. Export includes all authorized matching records when chosen, not silently one page.',
'Old edit bookmark resolves access safely; Save/Approve/Reverse/Pay cannot execute. Viewer receives neutral permission explanation and nonrevealing access request route.',
'Revocation before download blocks retrieval even if file generation started; audit records sanitized export event/purpose.'],
'Unknown/failed metric never displays fabricated zero; service timeout offers retry without exposing raw query or private record title.',
'Accurate permitted reports, no mutation or donor leak through URLs/export/search, traceable exact scope.','WF64 WF33 WF38'),
('A29','Arabic-speaking applicant uses phone and keyboard/screen reader for long marriage/request form, changes language then session expires.','Applicant; SC01/SC11/SC12/SC14; own authorized draft only.',[
'Arabic layout exposes logical headings, labels, required/conditional text and linked error summary. Phone/email/reference fragments isolated left-to-right; no drag/hover-only operation.',
'User enters supplied names and dates, saves authorized draft, changes interface to French/English; original input/script, target parish/type and progress persist without transliteration.',
'Session warning offers actual supported save; on expiry protect private content and sign in/return through role choice where relevant. Password values are never retained.',
'After reauthentication recheck grant/source revision and operation ID; restore only still-permitted draft. If prior submission succeeded, show actual case instead of blind resubmission.'],
'Network failure distinguishes saved versus temporary/pending fields and files. Shared-device logout removes sensitive local recovery. Actual assistive-device validation remains U14, not claimed executed.',
'No lost permitted facts or duplicate case, accessible recovery/error path, unchanged supplied names and safe session boundaries.','WF01 WF11 WF17 WF22 WF52'),
('A30','Verified deceased/archived person EX-P30 has household envelope, future volunteer duties, account, old certificate and optional reminders.','Office data owner; priest; finance; appointer; relevant family representative; SC07/SC08/SC21/SC30/SC13.',[
'Death confirmation is reviewed separately from funeral/archiving. Impact preview identifies own account/roles, guardian duties, open requests, future commitments, gifts and reminders.',
'Stop inappropriate future invitations/anniversary outreach and review duties/rosters; do not silently cancel paid registrations or erase open concerns. Staff appointments end through actual authority.',
'Household/envelope history and old contributions stay on historical household/date attribution; remaining members do not become donors or gain document access automatically.',
'Certificates/official entries retain approved snapshots and permitted custodian/representative access; account closure/retention handled with correct independent domains and holds. Archive search prevents duplicate recreation.'],
'Uncertain death/identity stays Reported/Needs review, not irreversible account-wide deletion. Restore does not automatically reactivate prior grants/consent or relaunch stale notifications.',
'Institutional/financial history preserved, future contact/duties purpose-reviewed, no false inheritance of account/private record rights.','WF06 WF08 WF20 WF30 WF41 WF50')]

def render_scenarios():
    from render_specs import write,table,SCENARIOS
    lines=['# Cross-role scenario walkthroughs','',
    'All names, identifiers, dates, amounts and events below are fictional. These are proposed textual screen/state walkthroughs for every canonical A01–A30 prompt. They are not executed tests, actual parish procedures, interactive prototypes or user approvals. Each case must later be performed by named representative users under U14; safety/authority/finance rules require their actual domain approvals.', '']
    for cid,setup,actors,steps,recovery,evidence,wfs in CASES:
        canon=next(a for a in SCENARIOS if a['id']==cid)
        links=', '.join(f'[{w}](workflow-specifications.md#{w.lower()}) / [FM{int(w[2:]):02}](field-dictionary.md#fm{int(w[2:]):02}) / [{w} notices](notification-matrix.md#{w.lower()})' for w in wfs.split())
        lines += [f'## {cid}','',f"**Canonical scenario:** {canon['question']}",'',f"**Canonical question mapping:** {canon['mapping']}.",'',f'**Fictional starting data:** {setup}','',f'**Permitted actors / screens:** {actors} Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).','',table(['Step','Actor, screen, required data, decision and resulting state'],[(str(i+1),t) for i,t in enumerate(steps)]),'',f'**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. {links}.','',f'**Failure / cancellation / recovery:** {recovery}','',f'**Expected end state and data/audit evidence:** {evidence} Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.','',f'**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.','']
    write('scenario-walkthroughs.md','\n'.join(lines))

if __name__=='__main__':render_scenarios();print(f'{len(CASES)} separate scenario walkthroughs rendered.')
