# Cross-role scenario walkthroughs

All names, identifiers, dates, amounts and events below are fictional. These are proposed textual screen/state walkthroughs for every canonical A01–A30 prompt. They are not executed tests, actual parish procedures, interactive prototypes or user approvals. Each case must later be performed by named representative users under U14; safety/authority/finance rules require their actual domain approvals.

## A01

**Canonical scenario:** A new adult signs up, follows two parishes, chooses a primary parish, skips profile completion and returns later.

**Canonical question mapping:** S03, S06, S07.

**Fictional starting data:** Adult Maya, 29, has no account/person link. Test parishes A and B publish different public activities.

**Permitted actors / screens:** Maya; SC01–SC05; no office identity rights. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Maya creates her individual account with own contact, language and required notices. Actual save creates account only; no person, household or ministry is fabricated. |
| 2 | Her single-role login opens the combined Home directly. She chooses Follow for A and B, then A as primary; each relationship is labeled Following. |
| 3 | She skips optional profile completion and views only approved public activity from both parishes. A membership call-to-action explains the separate verified person link. |
| 4 | She returns later, authenticates and sees her saved follows/primary choice and incomplete-profile prompt without repeating signup. Creating a request confirms one target parish. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF01](workflow-specifications.md#wf01) / [FM01](field-dictionary.md#fm01) / [WF01 notices](notification-matrix.md#wf01), [WF04](workflow-specifications.md#wf04) / [FM04](field-dictionary.md#fm04) / [WF04 notices](notification-matrix.md#wf04), [WF51](workflow-specifications.md#wf51) / [FM51](field-dictionary.md#fm51) / [WF51 notices](notification-matrix.md#wf51), [WF52](workflow-specifications.md#wf52) / [FM52](field-dictionary.md#fm52) / [WF52 notices](notification-matrix.md#wf52).

**Failure / cancellation / recovery:** A failed follow save stays visibly pending/failed; retry same preference operation. Denied optional location uses manual locality search. No unverified contact is marked verified.

**Expected end state and data/audit evidence:** One account; two follows; one primary preference; zero inferred person/staff/roster links. Language/context persist; no other user data exposed. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A02

**Canonical scenario:** The office cannot confidently match a membership applicant to two similar person records; one is already linked to another account.

**Canonical question mapping:** S07, S08, S10.

**Fictional starting data:** Applicant Joseph matches two office people, EX-P01 and EX-P02; EX-P02 already links another account.

**Permitted actors / screens:** Joseph own application; office identity reviewer; SC06/SC07/SC09. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Office opens the membership application and sees only permitted comparison fields: supplied scripts, date precision, household/contact, source and link/archive status. |
| 2 | Reviewer records Need information instead of choosing by surname. Applicant receives M02 and a secure request for distinguishing evidence, not names of other account holders. |
| 3 | Existing link on EX-P02 blocks ordinary reassignment. Evidence that it may be wrong opens a restricted link dispute and previews affected access and own-case links. |
| 4 | A distinct authorized identity review chooses EX-P01 only after evidence supports it, records verification method/date and applies one membership association. Prior candidate rejection remains traceable. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF04](workflow-specifications.md#wf04) / [FM04](field-dictionary.md#fm04) / [WF04 notices](notification-matrix.md#wf04), [WF06](workflow-specifications.md#wf06) / [FM06](field-dictionary.md#fm06) / [WF06 notices](notification-matrix.md#wf06), [WF07](workflow-specifications.md#wf07) / [FM07](field-dictionary.md#fm07) / [WF07 notices](notification-matrix.md#wf07).

**Failure / cancellation / recovery:** If source changed since comparison, refresh/reconcile. Never unmerge/move sacramental history to force a match. If still uncertain keep pending with assigned reviewer.

**Expected end state and data/audit evidence:** No link to another person, no account enumeration to applicant, no duplicate account/person link, exact decision evidence and own outcome notice. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A03

**Canonical scenario:** A parent requests baptism for an unregistered child; a similar archived record exists and the Arabic name is not yet known.

**Canonical question mapping:** S08–S13.

**Fictional starting data:** Verified guardian Lina requests baptism for infant Sami; Arabic spelling is not supplied; archived EX-P03 resembles the child.

**Permitted actors / screens:** Lina own guardian scope; office matcher; priest; SC11/SC12/SC07. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Lina supplies actual known birth/parent facts and marks missing Arabic name Not supplied. Intake accepts a provisional case with no fake transliteration/date. |
| 2 | Office searches active and archived candidates before creating a child. It compares EX-P03 identity and guardian source; ambiguous match remains Needs information. |
| 3 | If evidence proves the same child, authorized restore keeps EX-P03 ID and reviews household/guardian links; if demonstrably different, creation records that decision and source. |
| 4 | Priest acceptance starts preparation; missing approved official name/script becomes a final-output task according to supplied checklist. No certificate/official approval bypasses that requirement. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF11](workflow-specifications.md#wf11) / [FM11](field-dictionary.md#fm11) / [WF11 notices](notification-matrix.md#wf11), [WF14](workflow-specifications.md#wf14) / [FM14](field-dictionary.md#fm14) / [WF14 notices](notification-matrix.md#wf14), [WF06](workflow-specifications.md#wf06) / [FM06](field-dictionary.md#fm06) / [WF06 notices](notification-matrix.md#wf06), [WF08](workflow-specifications.md#wf08) / [FM08](field-dictionary.md#fm08) / [WF08 notices](notification-matrix.md#wf08).

**Failure / cancellation / recovery:** If archive/access changes during review, stop stale save and retain only permitted draft. Applicant sees own missing-name task, never unrelated archived child details.

**Expected end state and data/audit evidence:** One correctly matched or created child; unknown script preserved at intake; final readiness gate and representation evidence; no automatic restored consent/role. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A04

**Canonical scenario:** A guest submits the same baptism need, loses the tracking link, then creates an account and asks to associate the request.

**Canonical question mapping:** S06, S07, S11, S15.

**Fictional starting data:** Guest Nadine submits baptism case EX-R04, loses the tracking link, then creates account EX-A04.

**Permitted actors / screens:** Nadine; office identity/link reviewer; SC04/SC11/SC05/SC14. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Guest success shows actual saved reference, private tracking warning and clear next step. It does not create parish membership. |
| 2 | Lost-link recovery asks for verified contact or reviewed office identity. A claimed name/reference alone does not generate a new secret link. |
| 3 | After Nadine authenticates, office reviews association between account EX-A04 and actual requester. If old link unavailable, recovery and association share evidence but remain separate audited decisions. |
| 4 | Approved link exposes only her own case/timeline and explicitly released files through authenticated projection; original guest reference/origin remains. Rotate leaked/lost token when appropriate. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF11](workflow-specifications.md#wf11) / [FM11](field-dictionary.md#fm11) / [WF11 notices](notification-matrix.md#wf11), [WF03](workflow-specifications.md#wf03) / [FM03](field-dictionary.md#fm03) / [WF03 notices](notification-matrix.md#wf03), [WF04](workflow-specifications.md#wf04) / [FM04](field-dictionary.md#fm04) / [WF04 notices](notification-matrix.md#wf04), [WF21](workflow-specifications.md#wf21) / [FM21](field-dictionary.md#fm21) / [WF21 notices](notification-matrix.md#wf21).

**Failure / cancellation / recovery:** No contact-delivery service means reviewed office handoff/association, never a fake challenge. A rejected association gives a neutral reason without another requester’s details.

**Expected end state and data/audit evidence:** One canonical case and account association; old revoked link fails future access; no automatic person, ministry or staff membership. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A05

**Canonical scenario:** A secretary reviews a request with missing documents; a priest accepts directly; the applicant supplies an illegible file that must be replaced.

**Canonical question mapping:** S11–S15.

**Fictional starting data:** Baptism EX-R05 has two missing requirements. A priest accepts before secretary review; supplied PDF is illegible.

**Permitted actors / screens:** Applicant; secretary; priest; evidence verifier; SC10–SC14. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Secretary’s optional precheck remains not performed when priest accepts directly. History names the actual priest decision; acceptance does not verify documents. |
| 2 | Case enters Preparation with exact missing items and each item’s required stage/owner. Applicant gets secure M02 specifying the requested item. |
| 3 | Verifier marks uploaded PDF Rejected/Illegible with useful applicant-safe replacement instruction; does not decline the entire request or mark paper originals verified. |
| 4 | Applicant replaces the one item; prior file/version and rejection remain restricted. A successful upload with lost response is checked by operation/file ID before retry. Final preparation gate advances only after actual verification/allowed waiver. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF14](workflow-specifications.md#wf14) / [FM14](field-dictionary.md#fm14) / [WF14 notices](notification-matrix.md#wf14), [WF22](workflow-specifications.md#wf22) / [FM22](field-dictionary.md#fm22) / [WF22 notices](notification-matrix.md#wf22), [WF11](workflow-specifications.md#wf11) / [FM11](field-dictionary.md#fm11) / [WF11 notices](notification-matrix.md#wf11).

**Failure / cancellation / recovery:** If secretary is instead recording prior priest instruction, require case/stage/priest/attestation, effective once with M03 to priest; no extra approval wait. Upload failure leaves saved case and other files intact.

**Expected end state and data/audit evidence:** Direct acceptance preserved, document incompleteness separate, one replacement/version chain, no duplicate case or simulated verification. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A06

**Canonical scenario:** A marriage involves a partner from another parish and an external celebrant; the planned room/priest is already busy.

**Canonical question mapping:** S12, S13, S16, S23.

**Fictional starting data:** Marriage EX-R06 includes local Maya, outside-parish Adam and an external celebrant. Desired room and priest time conflict.

**Permitted actors / screens:** Each partner; office; assigned priest; competent outside authority; scheduler; SC11/SC12/SC15/SC25. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Office records both partners separately, using a reviewed external participant reference rather than mandatory local membership for Adam. |
| 2 | Assigned priest identifies actual special/external authorization required from approved policy. Permission evidence/date/scope is a real gate, not automated eligibility judgment. |
| 3 | Scheduler checks room/setup/cleanup, priest and equipment against canonical commitments. Private conflicting event displays only permitted busy information. |
| 4 | Office offers alternative time/room/eligible celebrant; confirms applicant choice and actual external authority, then confirms preparation/scheduling under the correct source. Public wedding title stays generic unless separately approved. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF17](workflow-specifications.md#wf17) / [FM17](field-dictionary.md#fm17) / [WF17 notices](notification-matrix.md#wf17), [WF23](workflow-specifications.md#wf23) / [FM23](field-dictionary.md#fm23) / [WF23 notices](notification-matrix.md#wf23), [WF13](workflow-specifications.md#wf13) / [FM13](field-dictionary.md#fm13) / [WF13 notices](notification-matrix.md#wf13).

**Failure / cancellation / recovery:** An override cannot authorize impossible exclusive double-booking. A stale alternative rechecks atomically; no fee payment or secretary entry substitutes for external permission.

**Expected end state and data/audit evidence:** One conflict-free occurrence, separately authorized outside celebrant/partner facts, private partner data, no duplicate local sacrament or member account. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A07

**Canonical scenario:** A scheduled celebration is postponed, cancelled or never takes place; a certificate request was waiting on it.

**Canonical question mapping:** S11–S16.

**Fictional starting data:** Planned celebration EX-E07 has waiting certificate EX-C07. Three branches: postponed, cancelled, or no-show.

**Permitted actors / screens:** Applicant; scheduler; priest; certificate preparer; SC12/SC13/SC15. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Postponement retains case and source link, records old/new proposed date and rechecks resources. Applicant acknowledges material change; certificate remains Waiting for official entry. |
| 2 | Pre-celebration cancellation records competent reason, releases only appropriate future reservations, reviews fee/refund and updates the dependent certificate with useful explanation. |
| 3 | No-show records actual nonoccurrence, not Celebrated. Offer reviewed rescheduling/cancellation; no register number or official certificate is generated from scheduled date. |
| 4 | If an alternative already-approved official source exists, preparer proposes exact identity/source link for clergy review rather than silently assigning it. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF14](workflow-specifications.md#wf14) / [FM14](field-dictionary.md#fm14) / [WF14 notices](notification-matrix.md#wf14), [WF15](workflow-specifications.md#wf15) / [FM15](field-dictionary.md#fm15) / [WF15 notices](notification-matrix.md#wf15), [WF16](workflow-specifications.md#wf16) / [FM16](field-dictionary.md#fm16) / [WF16 notices](notification-matrix.md#wf16), [WF17](workflow-specifications.md#wf17) / [FM17](field-dictionary.md#fm17) / [WF17 notices](notification-matrix.md#wf17), [WF18](workflow-specifications.md#wf18) / [FM18](field-dictionary.md#fm18) / [WF18 notices](notification-matrix.md#wf18), [WF20](workflow-specifications.md#wf20) / [FM20](field-dictionary.md#fm20) / [WF20 notices](notification-matrix.md#wf20), [WF23](workflow-specifications.md#wf23) / [FM23](field-dictionary.md#fm23) / [WF23 notices](notification-matrix.md#wf23).

**Failure / cancellation / recovery:** Lost save response queries actual occurrence/case state before another cancel/rebook. Past genuine official entry cannot be deleted by these branches.

**Expected end state and data/audit evidence:** No scheduled or cancelled ceremony becomes a fictitious celebration; certificate gate remains correct, linked payments/resources have explicit outcomes. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A08

**Canonical scenario:** The office submits a celebrated sacrament with a name error; the priest returns it; after approval another official correction is needed.

**Canonical question mapping:** S08, S12, S14.

**Fictional starting data:** Office transcribes actual celebration EX-R08 with wrong family spelling. Priest returns it; after final registration further evidence requires amendment.

**Permitted actors / screens:** Office preparer; priest; official custodian; SC12/SC13. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Entry submission pins actual celebration and identity source. Priest compares and returns the spelling with reason without rejecting the original service need. |
| 2 | Office revises proposed entry, retains old proposal/source, and resubmits. Priest approves only verified actual facts; official number follows supplied numbering policy. |
| 3 | After registration another correction request opens WF19 against the locked snapshot. Competent reviewer verifies evidence and records approved amendment with original and corrected reading. |
| 4 | Affected certificate versions are listed for reissue/revocation review. Historical signed output is not recomposed from a newly edited profile. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF14](workflow-specifications.md#wf14) / [FM14](field-dictionary.md#fm14) / [WF14 notices](notification-matrix.md#wf14), [WF19](workflow-specifications.md#wf19) / [FM19](field-dictionary.md#fm19) / [WF19 notices](notification-matrix.md#wf19), [WF20](workflow-specifications.md#wf20) / [FM20](field-dictionary.md#fm20) / [WF20 notices](notification-matrix.md#wf20), [WF05](workflow-specifications.md#wf05) / [FM05](field-dictionary.md#fm05) / [WF05 notices](notification-matrix.md#wf05).

**Failure / cancellation / recovery:** Two reviewers editing same proposed field compare source/current/submitted. A secretary’s instructed register approval, only if U04 allows that stage, records both identities and no fake personal click.

**Expected end state and data/audit evidence:** Returned draft and immutable approved original preserved; authorized amendment and document consequences fully traceable. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A09

**Canonical scenario:** A priest signs a certificate; the bishop returns it; it is corrected, accepted and released to a verified representative.

**Canonical question mapping:** S02, S14, S15.

**Fictional starting data:** Certificate EX-C09 is actually signed, returned by bishop, corrected, accepted, then collected by nominated representative.

**Permitted actors / screens:** Office; actual priest signer; actual bishop; verified representative; SC13/SC14. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Signing pins version 1 and sends actual applicable bishop review; applicant sees neutral processing rather than ready-to-collect. |
| 2 | Bishop returns with restricted reason. Version 2 highlights corrected material, invalidates signature on changed content and requires new actual priest signing and bishop review. |
| 3 | After actual acceptance and issuance, releaser checks recipient authorization, subject, source, version/language and complete file preview before releasing. |
| 4 | Counter staff verify nominated representative identity/authority at physical handover and record actual recipient/time/method. Printed authority names priest; internal history retains preparation/secretary attribution. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF20](workflow-specifications.md#wf20) / [FM20](field-dictionary.md#fm20) / [WF20 notices](notification-matrix.md#wf20), [WF21](workflow-specifications.md#wf21) / [FM21](field-dictionary.md#fm21) / [WF21 notices](notification-matrix.md#wf21), [WF22](workflow-specifications.md#wf22) / [FM22](field-dictionary.md#fm22) / [WF22 notices](notification-matrix.md#wf22).

**Failure / cancellation / recovery:** Unassigned substitute/admin cannot sign or accept by rank. Uncollected/failed delivery remains follow-up; availability is not collection.

**Expected end state and data/audit evidence:** Exact accepted/resigned version delivered to authorized representative; original return/revision survives; no pre-gate ready/collected claim. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A10

**Canonical scenario:** A guest's certificate file is prepared but not released; a wrong-file release is caught or must be withdrawn after release.

**Canonical question mapping:** S14, S15, S31.

**Fictional starting data:** Guest EX-R10 has private prepared certificate file; another person’s file is accidentally selected for release.

**Permitted actors / screens:** Authorized preparer/releaser; guest; privacy incident reviewer; SC14/SC24. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Prepared private file is visible only to office; guest tracking lists no download until actual release gates are met. |
| 2 | Release preview shows subject/requester/recipient/file version/language and source certificate. Mismatch blocks commit; record safe correction, never attach the other person’s output to pass validation. |
| 3 | If wrong release already happened, withdraw future access immediately, preserve exact released file/recipient/access history and route restricted disclosure review. |
| 4 | Issue corrected authorized release only after repeated identity/gate checks. Guest sees safe withdrawal/contact explanation; downloaded copies cannot honestly be recalled. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF20](workflow-specifications.md#wf20) / [FM20](field-dictionary.md#fm20) / [WF20 notices](notification-matrix.md#wf20), [WF21](workflow-specifications.md#wf21) / [FM21](field-dictionary.md#fm21) / [WF21 notices](notification-matrix.md#wf21), [WF22](workflow-specifications.md#wf22) / [FM22](field-dictionary.md#fm22) / [WF22 notices](notification-matrix.md#wf22), [WF35](workflow-specifications.md#wf35) / [FM35](field-dictionary.md#fm35) / [WF35 notices](notification-matrix.md#wf35).

**Failure / cancellation / recovery:** Lost release response queries release operation/file/version. Failed notification retries only message, never another document release. Leaked link rotated after identity review.

**Expected end state and data/audit evidence:** Before-commit mismatch has zero disclosure; after-commit response limits future exposure and retains real incident evidence and corrected version history. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A11

**Canonical scenario:** A person joins a ministry, withdraws after leader review, reapplies, then later requests a private departure.

**Canonical question mapping:** S18, S19, S26.

**Fictional starting data:** Nour applies to ministry EX-G11, leader approves, Nour asks withdrawal, later reapplies and eventually privately departs.

**Permitted actors / screens:** Nour; assigned leader; priest; SC18/SC19/SC31. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Application is Pending until priest final approval; leader review alone does not add roster membership. |
| 2 | Withdrawal after leader approval becomes a tracked priest review, retaining prior decisions. Priest approves withdrawal; terminal request cannot later add a roster row. |
| 3 | Reapplication is a new linked application with fresh eligibility/capacity review. Only real priest final approval creates one active membership. |
| 4 | Private departure reason is visible to Nour and eligible parish priests only. Nour can mute optional messages/stop volunteering while review waits; approved departure tells leader only neutral end date and future handover needs. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF26](workflow-specifications.md#wf26) / [FM26](field-dictionary.md#fm26) / [WF26 notices](notification-matrix.md#wf26), [WF27](workflow-specifications.md#wf27) / [FM27](field-dictionary.md#fm27) / [WF27 notices](notification-matrix.md#wf27), [WF28](workflow-specifications.md#wf28) / [FM28](field-dictionary.md#fm28) / [WF28 notices](notification-matrix.md#wf28), [WF46](workflow-specifications.md#wf46) / [FM46](field-dictionary.md#fm46) / [WF46 notices](notification-matrix.md#wf46).

**Failure / cancellation / recovery:** Duplicate reapplication while one pending is prevented. Former attendance remains historic; departure reason never appears in leader export/message.

**Expected end state and data/audit evidence:** Correct withdrawal/reapply/active/departed chronology, one active roster row at a time, private departure reason and retained history. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A12

**Canonical scenario:** A leader changes; the former leader has open tasks, group files, attendance corrections and a pending application.

**Canonical question mapping:** S02, S18, S19, S28.

**Fictional starting data:** Leader Hadi leaves group EX-G12 with open applications, group-owned files/tasks and attendance correction.

**Permitted actors / screens:** Appointing authority; old/new leader; priest; SC18–SC20/SC35. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Authority reviews handover list, appoints eligible replacement with exact ministry scope and revokes old leadership on effective action. |
| 2 | Pending applications/tasks move to eligible new owner or priest; old decisions/authorship remain attributed. No general new leader access to private departure/concern/pastoral contents. |
| 3 | Group-owned permitted resources keep group identity/version. Old leader’s personal notes/files do not silently become group resources. |
| 4 | Attendance correction uses exact historical meeting/roster revision and pre/post-close rule. Old open tab fails next protected leadership request; ordinary member access can remain. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF38](workflow-specifications.md#wf38) / [FM38](field-dictionary.md#fm38) / [WF38 notices](notification-matrix.md#wf38), [WF26](workflow-specifications.md#wf26) / [FM26](field-dictionary.md#fm26) / [WF26 notices](notification-matrix.md#wf26), [WF28](workflow-specifications.md#wf28) / [FM28](field-dictionary.md#fm28) / [WF28 notices](notification-matrix.md#wf28), [WF29](workflow-specifications.md#wf29) / [FM29](field-dictionary.md#fm29) / [WF29 notices](notification-matrix.md#wf29), [WF49](workflow-specifications.md#wf49) / [FM49](field-dictionary.md#fm49) / [WF49 notices](notification-matrix.md#wf49).

**Failure / cancellation / recovery:** No replacement yet routes operational queue to priest/eligible appointee, never unrelated leader. Concurrent revocation/correction queries commit status and preserves valid earlier authorship.

**Expected end state and data/audit evidence:** No lost pending work, no unauthorized old-leader action, scoped custody/task transfer and immutable historical attribution. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A13

**Canonical scenario:** A volunteer is already assigned in another parish, accepts a new duty, then cancels shortly before the event.

**Canonical question mapping:** S16, S20, S26.

**Fictional starting data:** Volunteer Rami is confirmed for parish A 10:00–12:00, offers parish B 11:00–13:00, then cancels a later nonconflicting duty shortly before start.

**Permitted actors / screens:** Rami; B coordinator; actual replacement; SC21/SC15. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Assignment checks actual confirmed overlap across authorized busy information. B coordinator sees conflict interval only, no private title/participant data from A. |
| 2 | Coordinator offers nonoverlapping 13:00–14:00; Rami accepts and eligibility/training/capacity are rechecked before Confirmed. |
| 3 | Rami later requests late cancellation; slot remains visibly unfilled/at risk until coordinator resolves it. A proposed replacement is not confirmation. |
| 4 | Replacement independently accepts and passes checks; coordinator confirms exact duty and notices actual affected actors. Actual served hours need later independent review. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF30](workflow-specifications.md#wf30) / [FM30](field-dictionary.md#fm30) / [WF30 notices](notification-matrix.md#wf30), [WF23](workflow-specifications.md#wf23) / [FM23](field-dictionary.md#fm23) / [WF23 notices](notification-matrix.md#wf23), [WF46](workflow-specifications.md#wf46) / [FM46](field-dictionary.md#fm46) / [WF46 notices](notification-matrix.md#wf46).

**Failure / cancellation / recovery:** No available replacement leaves a real gap/escalation. Retry cannot assign two people beyond position capacity; drag and non-drag paths enforce same rules.

**Expected end state and data/audit evidence:** No physically overlapping confirmation, no cross-parish privacy leak, real late vacancy and independently accepted replacement; no fabricated hours. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A14

**Canonical scenario:** An event fills while two families register; one child lacks a birth date/consent and another has a partial fee plus paid transport.

**Canonical question mapping:** S21, S22, S31.

**Fictional starting data:** Event EX-E14 has one seat left. Two families submit; child A has unknown birth date/consent, child B has USD 20 fee payment plus USD 5 transport payment.

**Permitted actors / screens:** Guardians; registration/capacity service; consent reviewer; cashier; SC22/SC23. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Atomic seat action gives at most one Reserved place; the other applicant becomes Waitlisted, never both silently confirmed. |
| 2 | Unknown exact age triggers approved consent/eligibility review. Reserved can await consent but consumes place; missing required consent blocks Confirmed/Check-in. |
| 3 | Actual fee/transport payments keep distinct allocations to one or more canonical receipt IDs and actual original currency; balances show charged/paid/outstanding clearly. |
| 4 | Waitlist offer has exact stated deadline and eligibility checks; released place promotes via real reviewed process. Payment cannot automatically displace another family or waive child checks. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF31](workflow-specifications.md#wf31) / [FM31](field-dictionary.md#fm31) / [WF31 notices](notification-matrix.md#wf31), [WF33](workflow-specifications.md#wf33) / [FM33](field-dictionary.md#fm33) / [WF33 notices](notification-matrix.md#wf33), [WF34](workflow-specifications.md#wf34) / [FM34](field-dictionary.md#fm34) / [WF34 notices](notification-matrix.md#wf34).

**Failure / cancellation / recovery:** Lost capacity response checks reservation ID before retry. Partial upload/payment proof does not lose place facts or claim verified receipt. Unavailable timed runner means assigned manual invitation worklist.

**Expected end state and data/audit evidence:** Capacity never exceeded, correct unknown-age barrier, independently stated consent/payment/transport status and no duplicate money. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A15

**Canonical scenario:** An event moves date/room after participants pay; consent/transport changes and some participants request refunds.

**Canonical question mapping:** S16, S21, S23, S25.

**Fictional starting data:** Paid event EX-E15 moves from one day/room to another; transport and consent wording materially change.

**Permitted actors / screens:** Event lead; scheduler; guardians/participants; finance refund approver; SC22/SC15/SC28. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Lead opens material amendment preview listing every linked room, clergy/volunteer duty, participant, transport capacity, fee allocation and consent version. |
| 2 | New occurrence/resources recheck availability; locked form event/currency not silently repointed. Use linked approved amendment/replacement identity while preserving existing registrations and receipts. |
| 3 | Affected participants receive M07 with secure old/new details, reconfirm/reconsent deadline and real cancellation/refund options. Message delivery is not acknowledgment/consent. |
| 4 | Refund requester gets policy-reviewed amount allocated to original fee/transport receipts. Independent approval then actual payment creates one refund movement; seat/transport release follows explicit outcome. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF23](workflow-specifications.md#wf23) / [FM23](field-dictionary.md#fm23) / [WF23 notices](notification-matrix.md#wf23), [WF31](workflow-specifications.md#wf31) / [FM31](field-dictionary.md#fm31) / [WF31 notices](notification-matrix.md#wf31), [WF13](workflow-specifications.md#wf13) / [FM13](field-dictionary.md#fm13) / [WF13 notices](notification-matrix.md#wf13), [WF57](workflow-specifications.md#wf57) / [FM57](field-dictionary.md#fm57) / [WF57 notices](notification-matrix.md#wf57), [WF33](workflow-specifications.md#wf33) / [FM33](field-dictionary.md#fm33) / [WF33 notices](notification-matrix.md#wf33).

**Failure / cancellation / recovery:** Nonresponse remains flagged with owner rather than fake accepted consent. Failed refund payment remains unpaid, and old bank/cash receipts remain unchanged.

**Expected end state and data/audit evidence:** Versioned schedule/consent/fee history; no reassigned event/currency shortcut; actual independently approved refunds and consistent resource availability. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A16

**Canonical scenario:** A child arrives, the connection fails and an unauthorized collector later asks for pickup; paper fallback is used and reconciled.

**Canonical question mapping:** S22, S31.

**Fictional starting data:** Child Mira is expected at EX-E16. Connection fails during arrival; an unlisted collector later presents a code.

**Permitted actors / screens:** Trained door/pickup staff; named safeguarding lead; verified guardian; SC23. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Operator clearly selects exact event/site/occurrence, checks permitted consent/restrictions, and marks network failure rather than successful online check-in. |
| 2 | Under approved procedure staff use protected dated roster and paper arrival log with actual local time/operator; old data age is visible and any unknown required authority resolved by trained lead. |
| 3 | Collector’s code is supporting evidence only. Unlisted/restricted identity cannot use ordinary Release; staff follow real safeguarding lead/verified guardian procedure without exposing child details publicly. |
| 4 | After reconnection an eligible reviewer reconciles paper arrival/exit by participant/event and original times. System entry time remains actual later time; duplicate arrival/checkout avoided. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF34](workflow-specifications.md#wf34) / [FM34](field-dictionary.md#fm34) / [WF34 notices](notification-matrix.md#wf34), [WF58](workflow-specifications.md#wf58) / [FM58](field-dictionary.md#fm58) / [WF58 notices](notification-matrix.md#wf58), [WF35](workflow-specifications.md#wf35) / [FM35](field-dictionary.md#fm35) / [WF35 notices](notification-matrix.md#wf35).

**Failure / cancellation / recovery:** If guardian authority cannot be verified, do not release through ordinary flow. If no approved offline procedure/lead exists, readiness is blocked, not replaced with an invented emergency override.

**Expected end state and data/audit evidence:** No unauthorized pickup, no false online success, explicit paper provenance and one active event-session history after reconciliation. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A17

**Canonical scenario:** An incident occurs during one event; a restricted report is created and an emergency roster is printed without implying whole-building coverage.

**Canonical question mapping:** S22, S27.

**Fictional starting data:** An incident at event EX-E17 involves checked-in child and another person not on event roster.

**Permitted actors / screens:** Reporter; assigned restricted handler; event lead; SC24/SC23. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Reporter creates factual event/location-linked restricted report, records actual immediate response and involved references without distributing allegations to general office. |
| 2 | Handler assignment/conflict checks and appropriate guardian disclosure are recorded separately; third-party evidence remains restricted. |
| 3 | Lead prints event emergency roster with exact event/site, active checked-in participants and last-update time. It explicitly excludes checked-out/unregistered people and says it is not everyone in building. |
| 4 | Unregistered person in incident does not get invented event check-in or parish membership. A need for whole-building coverage requires a separately approved attendance process. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF35](workflow-specifications.md#wf35) / [FM35](field-dictionary.md#fm35) / [WF35 notices](notification-matrix.md#wf35), [WF34](workflow-specifications.md#wf34) / [FM34](field-dictionary.md#fm34) / [WF34 notices](notification-matrix.md#wf34), [WF58](workflow-specifications.md#wf58) / [FM58](field-dictionary.md#fm58) / [WF58 notices](notification-matrix.md#wf58).

**Failure / cancellation / recovery:** Offline roster must state stale time and use approved manual process; no “broadcast delivered” label without actual connected service.

**Expected end state and data/audit evidence:** Restricted incident with actual follow-up, truthful event-only roster, no general incident/concern count leakage. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A18

**Canonical scenario:** Two room requests compete, one has setup time, a deposit is involved and maintenance later blocks the confirmed booking.

**Canonical question mapping:** S23, S25, S26.

**Fictional starting data:** Two room requests overlap; first needs 30-minute setup and has a deposit. Maintenance later affects the confirmed booking.

**Permitted actors / screens:** Requesters; resource manager; priest/delegated approver; maintenance lead; finance; SC25/SC26. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Availability includes actual setup/cleanup occupation. Submission alone holds neither slot; explicit hold has owner and real expiry. |
| 2 | Approver reviews competing requests and confirms one eligible reservation after atomic recheck. Other becomes Alternative needed with useful options, not silent automatic refusal. |
| 3 | Actual deposit receipt references the same canonical movement in booking/Finance; approval of room remains a separate authority decision. |
| 4 | Maintenance impact preview lists confirmed booking and proposes relocation/new time. Routine maintenance waits for reviewed plan; urgent unsafe block records actual immediate restriction and assigned applicant follow-up/refund. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF13](workflow-specifications.md#wf13) / [FM13](field-dictionary.md#fm13) / [WF13 notices](notification-matrix.md#wf13), [WF36](workflow-specifications.md#wf36) / [FM36](field-dictionary.md#fm36) / [WF36 notices](notification-matrix.md#wf36), [WF33](workflow-specifications.md#wf33) / [FM33](field-dictionary.md#fm33) / [WF33 notices](notification-matrix.md#wf33), [WF57](workflow-specifications.md#wf57) / [FM57](field-dictionary.md#fm57) / [WF57 notices](notification-matrix.md#wf57).

**Failure / cancellation / recovery:** Expired hold evaluated on protected availability check even if push reminder absent. Lost approval response checks actual reservation; no double booking or duplicate deposit.

**Expected end state and data/audit evidence:** One exclusive confirmed interval including setup; real competing-applicant outcome, deposit balance and maintenance-driven resolution. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A19

**Canonical scenario:** Equipment reserved for a paid external renter is returned damaged and becomes unavailable for another booking.

**Canonical question mapping:** S23, S25.

**Fictional starting data:** External renter EX-X19 reserves two speakers, returns one damaged; a later booking needs both.

**Permitted actors / screens:** Custodian; renter; resource lead; qualified repair reviewer; finance; SC25/SC26/SC28. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Renter/contact/terms remain separate from parish membership. Room-plus-two-speaker request commits stock and room together after eligibility/availability. |
| 2 | Issue/return record actual quantities/serials/condition. Damaged unit becomes unavailable; retained deposit is not automatically treated as damage income. |
| 3 | New shortage flags the later booking for explicit alternatives; custodian does not mark broken unit available to preserve a green calendar. |
| 4 | Repair process records qualified evidence/clearance; any damage deduction/refund uses published terms, independent financial approval and actual transaction. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF37](workflow-specifications.md#wf37) / [FM37](field-dictionary.md#fm37) / [WF37 notices](notification-matrix.md#wf37), [WF36](workflow-specifications.md#wf36) / [FM36](field-dictionary.md#fm36) / [WF36 notices](notification-matrix.md#wf36), [WF13](workflow-specifications.md#wf13) / [FM13](field-dictionary.md#fm13) / [WF13 notices](notification-matrix.md#wf13), [WF33](workflow-specifications.md#wf33) / [FM33](field-dictionary.md#fm33) / [WF33 notices](notification-matrix.md#wf33), [WF57](workflow-specifications.md#wf57) / [FM57](field-dictionary.md#fm57) / [WF57 notices](notification-matrix.md#wf57).

**Failure / cancellation / recovery:** Partial return leaves loan outstanding. Disputed damage preserves evidence and appropriate held/unresolved balance; no silent renter merge or donation attribution.

**Expected end state and data/audit evidence:** Stock quantities reconcile; unsafe equipment excluded, later customer receives real resolution, deposit/refund not duplicated. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A20

**Canonical scenario:** Counters record actual USD and LBP gifts, disagree, resolve the count, close it and later correct the wrong fund/household attribution.

**Canonical question mapping:** S09, S24, S25.

**Fictional starting data:** Count contains USD 100 and LBP 9,000,000; independent reviewer initially sees USD 95. Later USD 20 was allocated to wrong fund/household.

**Permitted actors / screens:** Two distinct counters; treasurer; independent adjustment approver; SC27/SC30. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Record actual currencies and cash/bank methods separately; no LBP input reinterpreted as USD equivalent. Counter 2 enters actual independent observation of exact batch revision. |
| 2 | USD 5 variance leaves session open and assigned recount; both observations remain. Document correction/recount to genuine agreement, then authorized close posts once. |
| 3 | Closed batch original locks. Finance proposes USD 20 reclassification with original movement reference and correct household/fund evidence; distinct approver reviews. |
| 4 | Post allocation correction only: cash remains USD 100 plus LBP 9,000,000. Review/correct affected donor statement with new issue reference; household adults do not all gain donor access. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF41](workflow-specifications.md#wf41) / [FM41](field-dictionary.md#fm41) / [WF41 notices](notification-matrix.md#wf41), [WF42](workflow-specifications.md#wf42) / [FM42](field-dictionary.md#fm42) / [WF42 notices](notification-matrix.md#wf42), [WF08](workflow-specifications.md#wf08) / [FM08](field-dictionary.md#fm08) / [WF08 notices](notification-matrix.md#wf08), [WF61](workflow-specifications.md#wf61) / [FM61](field-dictionary.md#fm61) / [WF61 notices](notification-matrix.md#wf61).

**Failure / cancellation / recovery:** No second counter means Unverified, not fixed sample success. Lost close response queries operation to avoid second posting.

**Expected end state and data/audit evidence:** Independent actual review, variance history, currency balances unchanged by attribution correction and linked corrected statement. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A21

**Canonical scenario:** A registration/rental payment reaches Finance while an office allowance is recorded; reporting must count each movement correctly once.

**Canonical question mapping:** S21, S23–S25.

**Fictional starting data:** Event/rental receipt USD 25 and parish-to-office allowance USD 100 are recorded; office pays USD 30 purchase.

**Permitted actors / screens:** Cashier; office custodian; finance reconciler; SC22/SC25/SC28/SC29. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Canonical receipt TX-21 USD 25 is allocated to source registration/rental obligations. Source screens and Finance reference TX-21, not a second cash movement. |
| 2 | Allowance TR-21 has matching transfer-out from parish bank and transfer-in to office cash; parish-wide expense is zero for transfer itself. |
| 3 | Actual office purchase TX-22 USD 30 is one expense, linked to receipt/voucher; Office Expenses projection in consolidated reporting does not create another Finance expense. |
| 4 | Reconcile actual balances independently per currency. Example bank 1000→900, office 0→100→70, combined 1000→970; adding actual external receipt gives 995 total if received into same counted scope. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF33](workflow-specifications.md#wf33) / [FM33](field-dictionary.md#fm33) / [WF33 notices](notification-matrix.md#wf33), [WF13](workflow-specifications.md#wf13) / [FM13](field-dictionary.md#fm13) / [WF13 notices](notification-matrix.md#wf13), [WF31](workflow-specifications.md#wf31) / [FM31](field-dictionary.md#fm31) / [WF31 notices](notification-matrix.md#wf31), [WF45](workflow-specifications.md#wf45) / [FM45](field-dictionary.md#fm45) / [WF45 notices](notification-matrix.md#wf45), [WF44](workflow-specifications.md#wf44) / [FM44](field-dictionary.md#fm44) / [WF44 notices](notification-matrix.md#wf44).

**Failure / cancellation / recovery:** An invoice alone does not count as payment. Duplicate statement import/source retry reuses canonical ID; refunds reverse actual allocation once.

**Expected end state and data/audit evidence:** External USD 25 counted once, internal USD 100 transfer cancels consolidated, USD 30 purchase counted once with reproducible equations. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A22

**Canonical scenario:** An anonymous concern names a senior cleric, selected reviewers become conflicted, and ordinary administrators must see neither the case nor its count.

**Canonical question mapping:** S02, S27.

**Fictional starting data:** Reviewer-anonymous case EX-C22 alleges conduct of a senior cleric; originally selected reviewers become conflicted.

**Permitted actors / screens:** Submitter; eligible conflict-free independent routing authority; selected reviewers; SC32. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Before submission screen explains reviewer anonymity and infrastructure correlation limits; no guaranteed untraceability claim. |
| 2 | Conflict checks exclude implicated/ineligible reviewers and prevent sending to ordinary office or accused cleric. All-conflicted state invokes actual preappointed independent authority/contact. |
| 3 | Reassignment records minimal reason and exact new eligible reviewers without broadening case audience. ViewSensitive and ViewIdentity remain separate; no identity is invented for anonymous case. |
| 4 | Unrelated admin/priest/bishop searches Home, My work, general audit and reports: receives no title, count, status, notification or export evidence of case existence. Submitter gets only neutral M05. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF47](workflow-specifications.md#wf47) / [FM47](field-dictionary.md#fm47) / [WF47 notices](notification-matrix.md#wf47), [WF38](workflow-specifications.md#wf38) / [FM38](field-dictionary.md#fm38) / [WF38 notices](notification-matrix.md#wf38), [WF46](workflow-specifications.md#wf46) / [FM46](field-dictionary.md#fm46) / [WF46 notices](notification-matrix.md#wf46).

**Failure / cancellation / recovery:** If no real independent escalation authority exists, keep restricted submission safely pending with truthful contact/availability and mark launch readiness blocked; never invent a superior.

**Expected end state and data/audit evidence:** Independent eligible routing, no administrator aggregate leak, actual anonymity limits and restricted reassignment history. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A23

**Canonical scenario:** A priest shares one pastoral task but keeps another note private, then leaves the parish and loses the parish appointment.

**Canonical question mapping:** S02, S28.

**Fictional starting data:** Priest author saves private note N23 and explicitly shares task T23 with eligible priest; later author loses parish appointment.

**Permitted actors / screens:** Author; named eligible assignee; appointing authority; SC33/SC35. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | N23 remains author-private. T23 assignment warns and shares that task only; it does not expose the notebook or make all office staff readers. |
| 2 | If author selects current-priests audience, preview explains later appointed priests can read while share active. A narrower named-priest share avoids that expansion. |
| 3 | On appointment loss, current parish access and underlying person lookups stop on protected request. Pending shared task moves only to eligible assigned person; private note never transfers to successor/bishop/admin. |
| 4 | Proposed departed-author archive contains only retained authored snapshot, no live former-parish people data; requires U13 approval. Sharing can end future access but cannot erase already-read knowledge. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF48](workflow-specifications.md#wf48) / [FM48](field-dictionary.md#fm48) / [WF48 notices](notification-matrix.md#wf48), [WF38](workflow-specifications.md#wf38) / [FM38](field-dictionary.md#fm38) / [WF38 notices](notification-matrix.md#wf38), [WF63](workflow-specifications.md#wf63) / [FM63](field-dictionary.md#fm63) / [WF63 notices](notification-matrix.md#wf63).

**Failure / cancellation / recovery:** Open stale tab cannot save as old priest. If policy for own archive unresolved, preserve private stored content with restricted reviewed access rather than grant unrestricted parish export.

**Expected end state and data/audit evidence:** Task-specific share and authorship preserved; private N23 inaccessible to successors; no live cross-parish data after revocation. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A24

**Canonical scenario:** An editor changes a published bilingual page in draft, another editor publishes a concurrent change and one translation is missing.

**Canonical question mapping:** S05, S30, S31.

**Fictional starting data:** Editor A modifies live EN/FR/AR page revision 5; editor B publishes revision 6; A’s French translation is missing.

**Permitted actors / screens:** Two editors; publisher/language reviewer; SC04/SC31/SC36. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Save draft leaves public revision 5 online. Preview clearly identifies draft, audience and each language readiness. |
| 2 | B publishes actual reviewed revision 6. A’s stale save/publish detects revision conflict, preserves permitted draft and compares changed fields/languages; no last-write-wins. |
| 3 | Missing French prevents A’s replacement being labeled trilingual/published under proposed policy. Existing complete revision 6 stays live; reviewer completes/approves needed translation. |
| 4 | Reconciled revision 7 rechecks all languages, rights, links and actual public phone/desktop rendering before authorized publication. Public content never picks up private internal metadata. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF32](workflow-specifications.md#wf32) / [FM32](field-dictionary.md#fm32) / [WF32 notices](notification-matrix.md#wf32), [WF52](workflow-specifications.md#wf52) / [FM52](field-dictionary.md#fm52) / [WF52 notices](notification-matrix.md#wf52).

**Failure / cancellation / recovery:** Accidental private publication uses explicit immediate unpublish/restore prior approved version and restricted review; downloaded external copies cannot be recalled.

**Expected end state and data/audit evidence:** Live revision preserved during draft/conflict/missing translation; no hidden unpublish or fabricated language readiness. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A25

**Canonical scenario:** An Archdiocese Admin creates its first parish without a secretary and delegates routine office work without granting priest signature authority.

**Canonical question mapping:** S02, S29.

**Fictional starting data:** Bishop-authorized Archdiocese Admin creates first test parish without secretary and assigns routine office work.

**Permitted actors / screens:** Diocesan administrator; bishop; priest/Parish Admin; SC02/SC35. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | No-parish administrative Home exposes setup and management scope without requiring a nonexistent working parish. |
| 2 | Admin prepares verified trilingual identity/core contact/head-priest/adoption facts; actual bishop approves ecclesiastical participation/appointment under recorded policy. |
| 3 | Valid Create and activate publishes approved core profile and makes parish usable immediately, optional secretary blank; gallery/legacy import not hidden prerequisite. |
| 4 | Authorized Parish Admin/higher office authority handles ordinary intake, people, calendar, evidence and release within explicit scope. Priest decision/signature still requires actual qualified priest; admin does not inherit secretary-only prior-instruction route. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF39](workflow-specifications.md#wf39) / [FM39](field-dictionary.md#fm39) / [WF39 notices](notification-matrix.md#wf39), [WF38](workflow-specifications.md#wf38) / [FM38](field-dictionary.md#fm38) / [WF38 notices](notification-matrix.md#wf38), [WF11](workflow-specifications.md#wf11) / [FM11](field-dictionary.md#fm11) / [WF11 notices](notification-matrix.md#wf11), [WF20](workflow-specifications.md#wf20) / [FM20](field-dictionary.md#fm20) / [WF20 notices](notification-matrix.md#wf20), [WF21](workflow-specifications.md#wf21) / [FM21](field-dictionary.md#fm21) / [WF21 notices](notification-matrix.md#wf21).

**Failure / cancellation / recovery:** Missing minimum real identity/contact stays private setup draft. No fake secretary/shared account workaround. Exact active scope and real role visible on confirmations.

**Expected end state and data/audit evidence:** Operational no-secretary parish, attributable actual bishop/priest authority and intact signing boundary. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A26

**Canonical scenario:** A diocese-sponsored parish downgrades its bundle with open sacrament requests, unpaid registrations and documents awaiting release.

**Canonical question mapping:** S11–S15, S21, S29.

**Fictional starting data:** Diocese-sponsored parish requests downgrade with open sacramental cases, unpaid registrations and documents awaiting release.

**Permitted actors / screens:** Priest requester; authorized diocesan sponsor; office/finance/release owners; SC36/SC10/SC22/SC14. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Impact preview lists exact affected modules/new entry points and all in-flight cases/balances/output releases; no invented billing charge. |
| 2 | Sponsored change waits actual sponsor approval; pending status retains current effective availability until actual decision/effective time. |
| 3 | At effect, unavailable new submissions show real office route; historic permitted read/export and existing applicant tracking stay available. |
| 4 | Assigned authorized owners complete already-open approved flows, collect/reconcile balances and release final documents under unchanged signature/identity gates. Archive/history not hidden because bundle changed. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF40](workflow-specifications.md#wf40) / [FM40](field-dictionary.md#fm40) / [WF40 notices](notification-matrix.md#wf40), [WF14](workflow-specifications.md#wf14) / [FM14](field-dictionary.md#fm14) / [WF14 notices](notification-matrix.md#wf14), [WF31](workflow-specifications.md#wf31) / [FM31](field-dictionary.md#fm31) / [WF31 notices](notification-matrix.md#wf31), [WF20](workflow-specifications.md#wf20) / [FM20](field-dictionary.md#fm20) / [WF20 notices](notification-matrix.md#wf20), [WF21](workflow-specifications.md#wf21) / [FM21](field-dictionary.md#fm21) / [WF21 notices](notification-matrix.md#wf21), [WF33](workflow-specifications.md#wf33) / [FM33](field-dictionary.md#fm33) / [WF33 notices](notification-matrix.md#wf33).

**Failure / cancellation / recovery:** Lost update response queries actual plan state. Work cannot be abandoned, auto-approved or auto-cancelled merely to fit a bundle. Reactivation restores feature availability, not revoked permissions.

**Expected end state and data/audit evidence:** Sponsor authority, protected history/tracking, no lost financial/output obligations and no authorization bypass. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A27

**Canonical scenario:** A user has different roles in two parishes, switches parish mid-task and receives a revocation while another tab remains open.

**Canonical question mapping:** S02, S03, S31.

**Fictional starting data:** One account is treasurer in A and leader in B; two tabs open. User changes context mid-edit then loses A grant.

**Permitted actors / screens:** Account holder; appointer; SC02/SC21/SC28/SC35. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Multiple-role login requires explicit choice. Combined Home labels each permitted parish/item; actions name one exact parish and eligible acting capacity. |
| 2 | Unsaved A edit offers supported Save draft/Discard/Stay before UI context change; selected rows/confirmations cleared. B role does not acquire A finance access. |
| 3 | Each tab retains its own immutable target context; B switch cannot redirect A pending write to B. Removing A grant invalidates next protected A read/write/download. |
| 4 | Revoked tab shows actual access-change failure and safe permitted Home/role choice. Keep only draft material account still entitled to retain; no hidden restricted recovery copy. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF52](workflow-specifications.md#wf52) / [FM52](field-dictionary.md#fm52) / [WF52 notices](notification-matrix.md#wf52), [WF38](workflow-specifications.md#wf38) / [FM38](field-dictionary.md#fm38) / [WF38 notices](notification-matrix.md#wf38), [WF43](workflow-specifications.md#wf43) / [FM43](field-dictionary.md#fm43) / [WF43 notices](notification-matrix.md#wf43).

**Failure / cancellation / recovery:** If prior action committed before revocation preserve actual actor/time and query outcome; if not committed, do not claim saved. No retry under newly selected unrelated role.

**Expected end state and data/audit evidence:** No cross-parish save or old-authority continuation; unrelated B/member access preserved, counts/search refreshed. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A28

**Canonical scenario:** A financial viewer searches, prints and exports permitted records while trying an editing link from an old bookmark.

**Canonical question mapping:** S02, S03, S24, S25.

**Fictional starting data:** Finance viewer EX-V28 has permitted fund totals/export subset and an old transaction-edit bookmark.

**Permitted actors / screens:** Viewer; scope finance grant; SC28/SC37. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Search returns only permitted financial records/fields; donor identities absent without separate grant. Scope/date/currency/coverage visible. |
| 2 | Print/export preview states allowed columns, selected versus all matching count and stable filters. Export includes all authorized matching records when chosen, not silently one page. |
| 3 | Old edit bookmark resolves access safely; Save/Approve/Reverse/Pay cannot execute. Viewer receives neutral permission explanation and nonrevealing access request route. |
| 4 | Revocation before download blocks retrieval even if file generation started; audit records sanitized export event/purpose. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF64](workflow-specifications.md#wf64) / [FM64](field-dictionary.md#fm64) / [WF64 notices](notification-matrix.md#wf64), [WF33](workflow-specifications.md#wf33) / [FM33](field-dictionary.md#fm33) / [WF33 notices](notification-matrix.md#wf33), [WF38](workflow-specifications.md#wf38) / [FM38](field-dictionary.md#fm38) / [WF38 notices](notification-matrix.md#wf38).

**Failure / cancellation / recovery:** Unknown/failed metric never displays fabricated zero; service timeout offers retry without exposing raw query or private record title.

**Expected end state and data/audit evidence:** Accurate permitted reports, no mutation or donor leak through URLs/export/search, traceable exact scope. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A29

**Canonical scenario:** A user completes a long Arabic form using a phone or keyboard/screen reader, changes language, loses their session and resumes safely.

**Canonical question mapping:** S06, S30, S31.

**Fictional starting data:** Arabic-speaking applicant uses phone and keyboard/screen reader for long marriage/request form, changes language then session expires.

**Permitted actors / screens:** Applicant; SC01/SC11/SC12/SC14; own authorized draft only. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Arabic layout exposes logical headings, labels, required/conditional text and linked error summary. Phone/email/reference fragments isolated left-to-right; no drag/hover-only operation. |
| 2 | User enters supplied names and dates, saves authorized draft, changes interface to French/English; original input/script, target parish/type and progress persist without transliteration. |
| 3 | Session warning offers actual supported save; on expiry protect private content and sign in/return through role choice where relevant. Password values are never retained. |
| 4 | After reauthentication recheck grant/source revision and operation ID; restore only still-permitted draft. If prior submission succeeded, show actual case instead of blind resubmission. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF01](workflow-specifications.md#wf01) / [FM01](field-dictionary.md#fm01) / [WF01 notices](notification-matrix.md#wf01), [WF11](workflow-specifications.md#wf11) / [FM11](field-dictionary.md#fm11) / [WF11 notices](notification-matrix.md#wf11), [WF17](workflow-specifications.md#wf17) / [FM17](field-dictionary.md#fm17) / [WF17 notices](notification-matrix.md#wf17), [WF22](workflow-specifications.md#wf22) / [FM22](field-dictionary.md#fm22) / [WF22 notices](notification-matrix.md#wf22), [WF52](workflow-specifications.md#wf52) / [FM52](field-dictionary.md#fm52) / [WF52 notices](notification-matrix.md#wf52).

**Failure / cancellation / recovery:** Network failure distinguishes saved versus temporary/pending fields and files. Shared-device logout removes sensitive local recovery. Actual assistive-device validation remains U14, not claimed executed.

**Expected end state and data/audit evidence:** No lost permitted facts or duplicate case, accessible recovery/error path, unchanged supplied names and safe session boundaries. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.

## A30

**Canonical scenario:** A deceased/archived person has a household envelope, future commitments, an account, certificates and notification preferences.

**Canonical question mapping:** S08–S10, S13, S20, S24, S32.

**Fictional starting data:** Verified deceased/archived person EX-P30 has household envelope, future volunteer duties, account, old certificate and optional reminders.

**Permitted actors / screens:** Office data owner; priest; finance; appointer; relevant family representative; SC07/SC08/SC21/SC30/SC13. Screen IDs resolve in [screen inventory](navigation-and-screen-inventory.md); action/field grants resolve in [permission matrix](permission-matrix.md).

| Step | Actor, screen, required data, decision and resulting state |
| --- | --- |
| 1 | Death confirmation is reviewed separately from funeral/archiving. Impact preview identifies own account/roles, guardian duties, open requests, future commitments, gifts and reminders. |
| 2 | Stop inappropriate future invitations/anniversary outreach and review duties/rosters; do not silently cancel paid registrations or erase open concerns. Staff appointments end through actual authority. |
| 3 | Household/envelope history and old contributions stay on historical household/date attribution; remaining members do not become donors or gain document access automatically. |
| 4 | Certificates/official entries retain approved snapshots and permitted custodian/representative access; account closure/retention handled with correct independent domains and holds. Archive search prevents duplicate recreation. |

**Messages and notices:** Use the exact named transition rows and reviewed EN/FR/AR message catalog; secure screen displays actual next state/owner and only permitted data. No external delivery or participant acknowledgment inferred from stored notice. [WF06](workflow-specifications.md#wf06) / [FM06](field-dictionary.md#fm06) / [WF06 notices](notification-matrix.md#wf06), [WF08](workflow-specifications.md#wf08) / [FM08](field-dictionary.md#fm08) / [WF08 notices](notification-matrix.md#wf08), [WF20](workflow-specifications.md#wf20) / [FM20](field-dictionary.md#fm20) / [WF20 notices](notification-matrix.md#wf20), [WF30](workflow-specifications.md#wf30) / [FM30](field-dictionary.md#fm30) / [WF30 notices](notification-matrix.md#wf30), [WF41](workflow-specifications.md#wf41) / [FM41](field-dictionary.md#fm41) / [WF41 notices](notification-matrix.md#wf41), [WF50](workflow-specifications.md#wf50) / [FM50](field-dictionary.md#fm50) / [WF50 notices](notification-matrix.md#wf50).

**Failure / cancellation / recovery:** Uncertain death/identity stays Reported/Needs review, not irreversible account-wide deletion. Restore does not automatically reactivate prior grants/consent or relaunch stale notifications.

**Expected end state and data/audit evidence:** Institutional/financial history preserved, future contact/duties purpose-reviewed, no false inheritance of account/private record rights. Preserve actual actor, authority, parent record, source/destination state, revision/operation ID and actual event versus entry timestamps in appropriate restricted history. General audit excludes secrets/private case contents.

**Acceptance decision:** Pass only if every stated observable result and permission boundary holds; fail on any wrong-person access/release, unauthorized pickup, invented approval, duplicate movement or hidden unresolved state. Execution/reviewer/date: not yet performed; responsible role per workflow, actual named reviewers U14.
