# Implementation checklist

Baseline: `4ec733bfe56f690b645e0c388c4c5f87e48bbd37` from `origin/main`; branch `codex/reviewed-requirements`.

**Incomplete.** This checklist accounts for all 436 questions and all 30 acceptance scenarios. A checked focal test is not completion of its entire question. The reviewed source pack and its historical passing checks do not establish application correctness. [Verification](verification.md) and [scenario review](scenario-review.md) define the actual evidence and limits.

## S01

Implemented portion: Main-based architecture inspection, retained requirements inventory, truthful readiness states and demonstration labeling.

Code: [src/ParishLive.Web/Pages/Readiness](../../src/ParishLive.Web/Pages/Readiness), [src/ParishLive.Web/Program.cs](../../src/ParishLive.Web/Program.cs)

Remaining software: Full retained module implementation, production capacity measurements and named domain/device acceptance.

Real-world inputs: U01, U11, U14 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S01.01** — Initial organization list distinguishes one diocese, two intended parishes and exact identities still awaiting approval. (WF01, WF40; incomplete / full criterion not verified).
- [ ] **S01.02** — Calendar, reservations and ministries are visibly the three priorities without deleting other modules. (WF01, WF40; incomplete / full criterion not verified).
- [ ] **S01.03** — Priest and optional-secretary task lists each contain five concrete daily task groups. (WF01, WF40; incomplete / full criterion not verified).
- [ ] **S01.04** — Every retained role has a launch destination and stated expected usage frequency without an always-online promise. (WF01, WF40; incomplete / full criterion not verified).
- [ ] **S01.05** — Every project-review module remains in the release inventory; unfinished integrations have honest availability states. (WF01, WF40; incomplete / full criterion not verified).
- [ ] **S01.06** — Each religious workflow distinguishes actual in-person/original-document/signature requirements from online entry. (WF01, WF40; incomplete / full criterion not verified).
- [ ] **S01.07** — No rite is inferred from parish names; unsupported routes cannot reach official output. (WF01, WF40; incomplete / full criterion not verified).
- [ ] **S01.08** — Primary laptop work and essential phone/tablet/shared-device tasks have explicit layout/recovery coverage. (WF01, WF40; incomplete / full criterion not verified).
- [ ] **S01.09** — EN/FR/AR readiness includes errors, help, notifications, content and official templates, not menus alone. (WF01, WF40; incomplete / full criterion not verified).
- [ ] **S01.10** — Product, clergy, office, finance, sensitive-access and language approval responsibilities are distinguishable. (WF01, WF40; incomplete / full criterion not verified).
- [ ] **S01.11** — Known initial counts are stated separately from the explicitly requested missing numerical capacity inputs. (WF01, WF40; incomplete / full criterion not verified).
- [ ] **S01.12** — Final developer release review requires domain evidence and prototype findings; writing answers is not user validation. (WF01, WF40; incomplete / full criterion not verified).

## S02

Implemented portion: Individual dated invitations, explicit acting assignment, live revocation, optional secretary, case-specific prior priest instruction, internal dual attribution, separate signature and bishop actions.

Code: [src/ParishLive.Infrastructure/Operations/AdministrationService.cs](../../src/ParishLive.Infrastructure/Operations/AdministrationService.cs), [src/ParishLive.Infrastructure/Operations/ParishCaseService.cs](../../src/ParishLive.Infrastructure/Operations/ParishCaseService.cs), [src/ParishLive.Infrastructure/Operations/DocumentService.cs](../../src/ParishLive.Infrastructure/Operations/DocumentService.cs), [src/ParishLive.Web/Tenancy](../../src/ParishLive.Web/Tenancy)

Remaining software: Full handover impact preview, all protected change/recovery classes, reminders and appointment-vacancy workflows.

Real-world inputs: U04, U10, U13 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S02.01** — Each role’s duties and grant scope differ from account/person/roster identity; translations await named review. (WF38, WF39; incomplete / full criterion not verified).
- [ ] **S02.02** — First privileged setup and bishop appointment work before any parish exists and do not use public self-promotion. (WF38, WF39; incomplete / full criterion not verified).
- [ ] **S02.03** — Valid creation activates/publicizes once; incomplete setup stays private; closure never cascades through official history. (WF38, WF39; incomplete / full criterion not verified).
- [ ] **S02.04** — Multiple appointees work with one actual designated lead and an explicit vacancy/handover route. (WF38, WF39; incomplete / full criterion not verified).
- [ ] **S02.05** — Role switching preserves login but consequential actions identify eligible acting capacity and one target parish. (WF38, WF39; incomplete / full criterion not verified).
- [ ] **S02.06** — Header/confirmation show real role/parish; official print names priest while internal history retains recorder. (WF38, WF39; incomplete / full criterion not verified).
- [ ] **S02.07** — Secretary records actual prior priest instruction effectively once; no automatic signature/bishop/admin extension occurs. (WF38, WF39; focal boundary tested; complete question open).
  Focal evidence: `ReviewedRequirementsTests.Secretary_records_genuine_prior_instruction_effectively_once_with_both_identities`.
- [ ] **S02.08** — No-secretary office work completes through eligible priest/admin without fake secretary account or inherited signature. (WF38, WF39; incomplete / full criterion not verified).
- [ ] **S02.09** — Delegation names duty, scope, people and period and cannot exceed giver’s authority. (WF38, WF39; incomplete / full criterion not verified).
- [ ] **S02.10** — Handover transfers future eligible work while preserving authorship and private-case/notebook boundaries. (WF38, WF39; incomplete / full criterion not verified).
- [ ] **S02.11** — Revoked open session fails next protected action, accurately checks prior commit and offers safe permitted destination. (WF38, WF39; incomplete / full criterion not verified).
- [ ] **S02.12** — Accepted/effective appointment dates control authority; expiry/review reminders never silently extend a grant. (WF38, WF39; incomplete / full criterion not verified).
- [ ] **S02.13** — Reason, reauthentication and independent approval are separately enforced for each listed high-impact change. (WF38, WF39; incomplete / full criterion not verified).
- [ ] **S02.14** — Own access request routes to eligible authority without showing unrelated accounts, records or confidential cases. (WF38, WF39; incomplete / full criterion not verified).

## S03

Implemented portion: Combined Home, personal follows/cases, assignment choice, tab-specific action scope and restricted record reads.

Code: [src/ParishLive.Web/Pages/Index.cshtml.cs](../../src/ParishLive.Web/Pages/Index.cshtml.cs), [src/ParishLive.Web/Pages/Context](../../src/ParishLive.Web/Pages/Context), [src/ParishLive.Web/TagHelpers/ActingContextTagHelper.cs](../../src/ParishLive.Web/TagHelpers/ActingContextTagHelper.cs)

Remaining software: All module destinations, comprehensive queues/search, pagination, bulk operations, restoring filters/position and complete role-specific dashboard metrics.

Real-world inputs: U14 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S03.01** — One available role enters directly; multiple roles require choice; no-parish/follower/unassigned-priest states remain useful. (WF52, WF11; incomplete / full criterion not verified).
- [ ] **S03.02** — Staff and permitted personal content share one combined home without exposing personal content to office colleagues. (WF52, WF11; incomplete / full criterion not verified).
- [ ] **S03.03** — Every authorized retained module has a destination; hiding a menu never substitutes for action checks. (WF52, WF11; incomplete / full criterion not verified).
- [ ] **S03.04** — Terminology dictionary disambiguates People, ministries, official records, account and public content in three languages. (WF52, WF11; incomplete / full criterion not verified).
- [ ] **S03.05** — Combined view labels each parish/relationship and every mutation retains one authorized parish target. (WF52, WF11; incomplete / full criterion not verified).
- [ ] **S03.06** — Preferences remain scoped; switching clears unsafe selections and revoked grants remove stale records/counts. (WF52, WF11; incomplete / full criterion not verified).
- [ ] **S03.07** — Each role’s first-screen cards link to real work and each displayed number has a defined period/unit. (WF52, WF11; incomplete / full criterion not verified).
- [ ] **S03.08** — My work distinguishes needs-me, team work and waiting without duplicate linked intake/office cases. (WF52, WF11; incomplete / full criterion not verified).
- [ ] **S03.09** — Badge and filtered queue use the same deduplicated case unit and exclude inaccessible confidential cases. (WF52, WF11; incomplete / full criterion not verified).
- [ ] **S03.10** — Search returns only permitted fields/records across supplied scripts, never private-note/concern leakage. (WF52, WF11; incomplete / full criterion not verified).
- [ ] **S03.11** — Result opens stable relevant detail and Back restores authorized query, filter, page and position. (WF52, WF11; incomplete / full criterion not verified).
- [ ] **S03.12** — Select-page and select-all-matching/export outcomes are explicit with item-level partial failures. (WF52, WF11; incomplete / full criterion not verified).
- [ ] **S03.13** — Phone cards retain parish/reference/state/next actor/date and currency while complex actions remain usable. (WF52, WF11; incomplete / full criterion not verified).
- [ ] **S03.14** — Unavailable/unauthorized links reveal no private existence and offer safe navigation or reviewed recovery. (WF52, WF11; incomplete / full criterion not verified).

## S04

Implemented portion: Approved-public parish directory, manual search, public core information, guest-intake opt-in and truthful absent-schedule state.

Code: [src/ParishLive.Web/Pages/Public](../../src/ParishLive.Web/Pages/Public), [src/ParishLive.Infrastructure/Operations/GuestIntakeService.cs](../../src/ParishLive.Infrastructure/Operations/GuestIntakeService.cs)

Remaining software: Structured published recurring services/exceptions, approved photos, maps and maintained urgent-contact hours.

Real-world inputs: U01, U09, U10 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S04.01** — Homepage action order prioritizes parish discovery, published times and correct-parish contact before marketing. (WF51, WF11; incomplete / full criterion not verified).
- [ ] **S04.02** — Time search uses actual structured occurrences/exceptions; absent schedule is not no services. (WF51, WF11; incomplete / full criterion not verified).
- [ ] **S04.03** — Cards disambiguate locality/diocese and show only genuinely published contact/time/distance claims. (WF51, WF11; incomplete / full criterion not verified).
- [ ] **S04.04** — Denied location/unconfigured map leaves manual directory usable and never invents coordinates or pins. (WF51, WF11; incomplete / full criterion not verified).
- [ ] **S04.05** — Parish profile order supports visiting, contact and requests before optional history/gallery. (WF51, WF11; incomplete / full criterion not verified).
- [ ] **S04.06** — Minimum correct core setup aligns with immediate valid activation; optional empty sections never block it. (WF51, WF11; incomplete / full criterion not verified).
- [ ] **S04.07** — Named parish pages use verified photos or neutral/labeled illustration, never unrelated authentic-looking church image. (WF51, WF11; incomplete / full criterion not verified).
- [ ] **S04.08** — Public clergy/leader names and contact destinations have actual publication approval; login contacts stay private. (WF51, WF11; incomplete / full criterion not verified).
- [ ] **S04.09** — Internal sacramental family names do not appear in public titles/feeds without separate naming permission. (WF51, WF11; incomplete / full criterion not verified).
- [ ] **S04.10** — Supported guest request types state their true next step; inquiry/submission never implies approval or booking. (WF51, WF11; incomplete / full criterion not verified).
- [ ] **S04.11** — Urgent contact shows actual maintained hours/route and never promises continuous online response. (WF51, WF11; incomplete / full criterion not verified).
- [ ] **S04.12** — Stable public URLs preserve safe language/filter state without tracking tokens or precise visitor coordinates. (WF51, WF11; incomplete / full criterion not verified).

## S05

Implemented portion: Separate draft/live trilingual content, priest publication and stale revision checks; baseline notice audience checks.

Code: [src/ParishLive.Infrastructure/Operations/CommunityService.cs](../../src/ParishLive.Infrastructure/Operations/CommunityService.cs), [src/ParishLive.Web/Pages/Publishing](../../src/ParishLive.Web/Pages/Publishing), [src/ParishLive.Infrastructure/Notices/NoticeService.cs](../../src/ParishLive.Infrastructure/Notices/NoticeService.cs)

Remaining software: Full media rights, content preview/withdrawal, scheduled publication, authoritative schedule/contact editing and trilingual legacy announcement publishing.

Real-world inputs: U09, U10, U14 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S05.01** — Editor and publisher permissions are separate and domain facts still require their competent authority. (WF32; incomplete / full criterion not verified).
- [ ] **S05.02** — One website area uses authoritative contact/schedule sources without merging field ownership. (WF32; incomplete / full criterion not verified).
- [ ] **S05.03** — Saving a new draft leaves current approved public version online until explicit publication/unpublish. (WF32; focal boundary tested; complete question open).
  Focal evidence: `ReviewedRequirementsTests.Missing_translation_and_stale_draft_do_not_unpublish_live_revision`.
- [ ] **S05.04** — Publication state changes name actual actor/time and scheduled execution is never claimed without runner. (WF32; incomplete / full criterion not verified).
- [ ] **S05.05** — Missing required translation blocks replacement publication while approved trilingual live content remains. (WF32; focal boundary tested; complete question open).
  Focal evidence: `ReviewedRequirementsTests.Missing_translation_and_stale_draft_do_not_unpublish_live_revision`.
- [ ] **S05.06** — Preview uses exact pending version/audience across phone/desktop and EN/FR/AR. (WF32; incomplete / full criterion not verified).
- [ ] **S05.07** — Media has source/rights/descriptions and private evidence cannot become public media automatically. (WF32; incomplete / full criterion not verified).
- [ ] **S05.08** — Dated schedule exceptions override recurrence consistently in directory, calendar and profile. (WF32; incomplete / full criterion not verified).
- [ ] **S05.09** — Pinned/scheduled/expired announcements retain exact audience/version and actual execution status. (WF32; incomplete / full criterion not verified).
- [ ] **S05.10** — Shared public layout remains coherent while account dashboard palettes stay personal. (WF32; incomplete / full criterion not verified).
- [ ] **S05.11** — Concurrent edit/publish detects stale revision and preserves permitted draft for comparison. (WF32; incomplete / full criterion not verified).
- [ ] **S05.12** — Private accidental publication can be withdrawn with restricted review and no impossible external-copy recall. (WF32; incomplete / full criterion not verified).

## S06

Implemented portion: Localized login/signup/manual recovery, account-only registration gated by actual age approval, ambiguous-contact rejection, new-password bounds, lockout and actual authenticator use for protected appointment approval.

Code: [src/ParishLive.Web/Areas/Identity](../../src/ParishLive.Web/Areas/Identity), [src/ParishLive.Web/Identity](../../src/ParishLive.Web/Identity), [src/ParishLive.Web/Program.cs](../../src/ParishLive.Web/Program.cs)

Remaining software: Full guardian/assisted signup, invitation claim lifecycle beyond staff appointment acceptance, staff recovery, contact verification/change and complete localization of built-in Identity Manage pages; comprehensive compromised-password source and privileged MFA enforcement.

Real-world inputs: U03, U10, U14 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S06.01** — Proposed age rule and guardian/assisted routes are labeled unapproved policy rather than national legal fact. (WF01, WF02, WF03; incomplete / full criterion not verified).
- [ ] **S06.02** — Signup completes without parish/profile translations/address and creates no office person automatically. (WF01, WF02, WF03; incomplete / full criterion not verified).
- [ ] **S06.03** — Unified identifier input preserves legacy usernames and resolves ambiguity without account enumeration. (WF01, WF02, WF03; incomplete / full criterion not verified).
- [ ] **S06.04** — Shared household contact cannot ambiguously log into multiple accounts or expose matching office people. (WF01, WF02, WF03; incomplete / full criterion not verified).
- [ ] **S06.05** — Contact stays unverified until real challenge succeeds; manual identity review is accurately labeled. (WF01, WF02, WF03; incomplete / full criterion not verified).
- [ ] **S06.06** — Unavailable providers are absent from primary login; proposed privileged MFA gap remains an explicit dependency. (WF01, WF02, WF03; incomplete / full criterion not verified).
- [ ] **S06.07** — New-password proposal is consistently 16–200 with paste/password-manager support and explicit legacy migration. (WF01, WF02, WF03; incomplete / full criterion not verified).
- [ ] **S06.08** — Member recovery cannot reset staff; privileged recovery requires actual eligible identity-reviewed procedure. (WF01, WF02, WF03; incomplete / full criterion not verified).
- [ ] **S06.09** — Invitation creation versus manual/real delivery is distinguishable and no staff/ministry grant is bundled. (WF01, WF02, WF03; incomplete / full criterion not verified).
- [ ] **S06.10** — Seven-day single-use expiry, revoked/wrong-person and repeated-successful claim paths avoid duplicate links. (WF01, WF02, WF03; incomplete / full criterion not verified).
- [ ] **S06.11** — Contact/session changes verify replacement and preserve a real recovery route with other-session revocation. (WF01, WF02, WF03; incomplete / full criterion not verified).
- [ ] **S06.12** — Expiry/rate-limit/shared-device feedback protects secrets and resumes only permitted drafts without blind resubmit. (WF01, WF02, WF03; incomplete / full criterion not verified).

## S07

Implemented portion: Multiple follows with one primary preference, office identity-link review service and no link hijacking.

Code: [src/ParishLive.Infrastructure/Operations/FollowingService.cs](../../src/ParishLive.Infrastructure/Operations/FollowingService.cs), [src/ParishLive.Infrastructure/Operations/PeopleService.cs](../../src/ParishLive.Infrastructure/Operations/PeopleService.cs), [src/ParishLive.Infrastructure/Operations/CommunityService.cs](../../src/ParishLive.Infrastructure/Operations/CommunityService.cs)

Remaining software: Membership review/request UI, wrong-link dispute resolution, detailed comparison, profile correction proposals/counterproposals and invitation association.

Real-world inputs: U03, U08 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S07.01** — Follower gets published activity and request capability but no internal roster/person/staff access. (WF04, WF05; incomplete / full criterion not verified).
- [ ] **S07.02** — Multiple parish memberships remain separately office-reviewed; primary parish changes only personal defaults. (WF04, WF05; incomplete / full criterion not verified).
- [ ] **S07.03** — Office records minimal actual identity-verification method/date and refuses ambiguous surname-only links. (WF04, WF05; incomplete / full criterion not verified).
- [ ] **S07.04** — Create-person inline preserves membership context and duplicate/archive checks without half-linked records. (WF04, WF05; incomplete / full criterion not verified).
- [ ] **S07.05** — Existing link conflict blocks ordinary reassignment and wrong-link review previews/access-corrects dependencies. (WF04, WF05; incomplete / full criterion not verified).
- [ ] **S07.06** — Decline gives applicant-safe useful reason and corrected reapplication preserves prior history. (WF04, WF05; incomplete / full criterion not verified).
- [ ] **S07.07** — Unfollow/primary/departure/role resignation have separate effects on open work, optional contact and history. (WF04, WF05; incomplete / full criterion not verified).
- [ ] **S07.08** — Invited claimant confirms intended account/person and any conflicting/stale link returns to review. (WF04, WF05; incomplete / full criterion not verified).
- [ ] **S07.09** — Profile correction cannot directly alter register/signature/login identity or another adult’s facts. (WF04, WF05; incomplete / full criterion not verified).
- [ ] **S07.10** — Per-field decisions preserve original/proposed/applied values; staff counterproposal is not falsely applicant-authored. (WF04, WF05; incomplete / full criterion not verified).
- [ ] **S07.11** — Pending withdrawal/replacement and concurrent staff field changes never overwrite newer values silently. (WF04, WF05; incomplete / full criterion not verified).
- [ ] **S07.12** — Account, personal display, official parish facts and issued-document snapshots explain their separate effects. (WF04, WF05; incomplete / full criterion not verified).

## S08

Implemented portion: Provisional people with supplied names, unknown scripts/date precision, actual source, basic duplicate suggestions and office-only access.

Code: [src/ParishLive.Infrastructure/Operations/PeopleService.cs](../../src/ParishLive.Infrastructure/Operations/PeopleService.cs), [src/ParishLive.Web/Pages/People](../../src/ParishLive.Web/Pages/People)

Remaining software: Full field dictionary, categorized people/profiles, contact/locality fields, medical/occupation/photos, consent versions, contextual official actions and reviewed lifecycle changes.

Real-world inputs: U01, U03, U08 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S08.01** — Person categories/lifecycle/membership remain separate and external witnesses do not become members automatically. (WF06, WF07; incomplete / full criterion not verified).
- [ ] **S08.02** — Provisional person saves with actual supplied distinguishing name and explicit unknown dates/scripts/contact. (WF06, WF07; incomplete / full criterion not verified).
- [ ] **S08.03** — Supplied name structure/source supports official output without automatic transliteration or Preferred Name. (WF06, WF07; incomplete / full criterion not verified).
- [ ] **S08.04** — International contacts and date precision survive validation/export without invented dates or local-only rejection. (WF06, WF07; incomplete / full criterion not verified).
- [ ] **S08.05** — Unlisted/foreign locality remains reviewable submitted text rather than forced wrong town. (WF06, WF07; incomplete / full criterion not verified).
- [ ] **S08.06** — Skills/occupation purpose and restricted declared medical facts have distinct audiences/search/export rules. (WF06, WF07; incomplete / full criterion not verified).
- [ ] **S08.07** — Profile tabs/related actions follow field-level permission; opening People does not expose Giving/Notes. (WF06, WF07; incomplete / full criterion not verified).
- [ ] **S08.08** — Person-form group addition follows actual ministry decision workflow rather than immediate unchecked roster change. (WF06, WF07; incomplete / full criterion not verified).
- [ ] **S08.09** — Identity/official locks and evidence requirements preserve historical snapshots when current profile changes. (WF06, WF07; incomplete / full criterion not verified).
- [ ] **S08.10** — Optional photo failure/removal preserves rest of form and public-image permission remains separate. (WF06, WF07; incomplete / full criterion not verified).
- [ ] **S08.11** — Directory/publicity/contact/event/representation choices have separate scope/version/giver and withdrawal consequences. (WF06, WF07; incomplete / full criterion not verified).
- [ ] **S08.12** — Contextual request/invite/certificate/message/note actions recheck their own prerequisites and target scope. (WF06, WF07; incomplete / full criterion not verified).

## S09

Implemented portion: Household and representation storage; event reservation checks a live purpose-specific representation grant.

Code: [src/ParishLive.Domain/Entities/ParishOperations.cs](../../src/ParishLive.Domain/Entities/ParishOperations.cs), [src/ParishLive.Infrastructure/Operations/EventAdmissionService.cs](../../src/ParishLive.Infrastructure/Operations/EventAdmissionService.cs)

Remaining software: Household/relationship editing, guardian verification UI, envelope assignments, directory opt-ins, split/merge/address inheritance and adult representative workflows.

Real-world inputs: U03, U06, U08 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S09.01** — Household contact/residence grouping does not confer guardianship, shared finances or private-record access. (WF08; incomplete / full criterion not verified).
- [ ] **S09.02** — One primary household plus reviewed external relationships avoids duplicate people for shared custody/overseas residence. (WF08; incomplete / full criterion not verified).
- [ ] **S09.03** — Household contact label has no automatic adult account, giving or certificate authority. (WF08; incomplete / full criterion not verified).
- [ ] **S09.04** — Sensitive family relations remain hidden from ordinary directories/exports while explicit unknowns are supported. (WF08; incomplete / full criterion not verified).
- [ ] **S09.05** — Specific related-person selection rejects circular parentage and offers accessible list alternative to diagram. (WF08; incomplete / full criterion not verified).
- [ ] **S09.06** — Changing contact preserves person-to-person relations and previews communication/default changes separately. (WF08; incomplete / full criterion not verified).
- [ ] **S09.07** — Shared address move updates only inherited fields and leaves individual/login contacts unchanged. (WF08; incomplete / full criterion not verified).
- [ ] **S09.08** — Another competent adult’s sensitive request/release requires explicit reviewed representation. (WF08; incomplete / full criterion not verified).
- [ ] **S09.09** — Guardian view is purpose-scoped and later autonomy/assisted authority transition requires approved policy. (WF08; incomplete / full criterion not verified).
- [ ] **S09.10** — Split/merge/leave preserve old giving/consent/official links and original open-case requester identities. (WF08; incomplete / full criterion not verified).
- [ ] **S09.11** — Optional manual envelope identifier has parish/date uniqueness and history preventing unsafe reassignment. (WF08; incomplete / full criterion not verified).
- [ ] **S09.12** — Directory output uses individual exact opt-in while operational export follows separate scope/field permission. (WF08; incomplete / full criterion not verified).

## S10

Implemented portion: Archived/linked identity safeguards and basic duplicate checks.

Code: [src/ParishLive.Infrastructure/Operations/PeopleService.cs](../../src/ParishLive.Infrastructure/Operations/PeopleService.cs), [src/ParishLive.Infrastructure/Operations/CommunityService.cs](../../src/ParishLive.Infrastructure/Operations/CommunityService.cs)

Remaining software: Import preview/commit/reconciliation, merge/unmerge, lifecycle consequence review, historical/external records and reviewed restore/move workflows.

Real-world inputs: U08, U11 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S10.01** — Real source owners/formats/volumes are requested explicitly and historical transcription remains distinct. (WF07, WF09, WF10; incomplete / full criterion not verified).
- [ ] **S10.02** — Mapping/whole-file preview precedes commit; valid-row-only import is a deliberate recorded exception. (WF07, WF09, WF10; incomplete / full criterion not verified).
- [ ] **S10.03** — Missing scripts/localities/dates/contact/consent remain unknown or unverified rather than invented. (WF07, WF09, WF10; incomplete / full criterion not verified).
- [ ] **S10.04** — Duplicate suggestions explain multiple matching signals and support different-person/need-information outcomes. (WF07, WF09, WF10; incomplete / full criterion not verified).
- [ ] **S10.05** — Merge preview resolves fields/account/household/official/finance dependencies with preserved source IDs. (WF07, WF09, WF10; incomplete / full criterion not verified).
- [ ] **S10.06** — Unmerge reviews later dependencies and never promises destructive one-click rollback after official use. (WF07, WF09, WF10; incomplete / full criterion not verified).
- [ ] **S10.07** — Inactive, deceased, archive, account closure and appointment revocation have separate consequence reviews. (WF07, WF09, WF10; incomplete / full criterion not verified).
- [ ] **S10.08** — Archived candidates appear in authorized matching/restore without public identity disclosure. (WF07, WF09, WF10; incomplete / full criterion not verified).
- [ ] **S10.09** — Move to new parish creates reviewed local membership/source references, not automatic private-record transfer. (WF07, WF09, WF10; incomplete / full criterion not verified).
- [ ] **S10.10** — Historical/external sources preserve original facts/numbers and actual later entry audit timestamps. (WF07, WF09, WF10; incomplete / full criterion not verified).
- [ ] **S10.11** — Legacy unlinked event forms cannot accept new activity while authorized historical reading remains. (WF07, WF09, WF10; incomplete / full criterion not verified).
- [ ] **S10.12** — Source/result row totals, currency balances and official identity comparisons reconcile with domain sign-offs. (WF07, WF09, WF10; incomplete / full criterion not verified).

## S11

Implemented portion: Stable authenticated/guest cases, own-case drafts/tracking, office decisions, separate applicant/internal messages, reviewed guest association and original reference preservation.

Code: [src/ParishLive.Infrastructure/Operations/ParishCaseService.cs](../../src/ParishLive.Infrastructure/Operations/ParishCaseService.cs), [src/ParishLive.Infrastructure/Operations/GuestIntakeService.cs](../../src/ParishLive.Infrastructure/Operations/GuestIntakeService.cs), [src/ParishLive.Web/Pages/Requests](../../src/ParishLive.Web/Pages/Requests)

Remaining software: Complete type-specific intake, office-origin requester/subject/representation, assignment/escalation, canonical Inbox thread, duplicate/wrong-parish review and full downstream dependency previews.

Real-world inputs: U02, U03, U04 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S11.01** — Every retained request type has structured essentials plus general route with honest acceptance meaning. (WF11, WF12, WF13; incomplete / full criterion not verified).
- [ ] **S11.02** — Guest/member versions share core service facts and missing later information stays in same case. (WF11, WF12, WF13; incomplete / full criterion not verified).
- [ ] **S11.03** — Unlinked authenticated applicant can submit without logout but cannot select hidden household/official records. (WF11, WF12, WF13; focal boundary tested; complete question open).
  Focal evidence: `AccessAndRecoveryTests.Unlinked_applicant_can_resume_own_draft_and_replace_rejected_evidence_without_other_case_access`.
- [ ] **S11.04** — Requester/subject/relationship/authority remain separate for adults, children, deceased and overseas cases. (WF11, WF12, WF13; incomplete / full criterion not verified).
- [ ] **S11.05** — Office telephone/paper entry records actual origin/requester/entry actor without fake digital consent. (WF11, WF12, WF13; incomplete / full criterion not verified).
- [ ] **S11.06** — Review-before-submit shows correct parish/type/details/fees/physical follow-up and real privacy/review expectations. (WF11, WF12, WF13; incomplete / full criterion not verified).
- [ ] **S11.07** — One stable case reference/timeline/thread links downstream identifiers without duplicate actionable counts. (WF11, WF12, WF13; incomplete / full criterion not verified).
- [ ] **S11.08** — Triage shows urgency/date/current owner/missing items/next action and unassigned office work remains visible. (WF11, WF12, WF13; incomplete / full criterion not verified).
- [ ] **S11.09** — Needs information requests exact change/item without declining whole case or exposing internal notes. (WF11, WF12, WF13; incomplete / full criterion not verified).
- [ ] **S11.10** — Received, accepted, clergy-approved, dated, registered and ready have distinct fact-based meanings. (WF11, WF12, WF13; incomplete / full criterion not verified).
- [ ] **S11.11** — Unhandled applicant edits/withdrawal stop when accepted dependencies need reviewed cancellation/reschedule. (WF11, WF12, WF13; incomplete / full criterion not verified).
- [ ] **S11.12** — Applicant-visible reasons and internal staff note inputs are separate with audience preview. (WF11, WF12, WF13; incomplete / full criterion not verified).
- [ ] **S11.13** — Duplicate/wrong-parish/incorrect acceptance preserve references/history and review real downstream effects. (WF11, WF12, WF13; incomplete / full criterion not verified).
- [ ] **S11.14** — Lost/leaked guest link recovery verifies identity and office-approved account association grants no membership. (WF11, WF12, WF13; focal boundary tested; complete question open).
  Focal evidence: `AccessAndRecoveryTests.Guest_retry_association_and_revocation_preserve_one_original_request_without_membership`.
- [ ] **S11.15** — Named owner/escalation handles overdue work without invented applicant SLA or unattended fake reminders. (WF11, WF12, WF13; incomplete / full criterion not verified).

## S12

Implemented portion: Preparation/schedule/actual celebration/entry review/register states, priest authority, requirements snapshots, direct priest path, pre-celebration postponement/cancel and locked approved facts.

Code: [src/ParishLive.Infrastructure/Operations/ParishCaseService.cs](../../src/ParishLive.Infrastructure/Operations/ParishCaseService.cs), [src/ParishLive.Domain/Entities/ParishOperations.cs](../../src/ParishLive.Domain/Entities/ParishOperations.cs)

Remaining software: Atomic clergy/room/stock scheduling, shared celebrations, requirement due stages/waivers, no-show UI, official amendment service and register search/export.

Real-world inputs: U02, U04, U05 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S12.01** — Each sacrament has exact proposed stages plus return/decline/cancel; priest direct path preserves skipped optional review. (WF14, WF15, WF16, WF17, WF18, WF19; incomplete / full criterion not verified).
- [ ] **S12.02** — Acceptance starts preparation but does not verify all evidence, reserve time or prove celebration. (WF14, WF15, WF16, WF17, WF18, WF19; focal boundary tested; complete question open).
  Focal evidence: `ReviewedRequirementsTests.Priest_direct_acceptance_does_not_fabricate_office_review_or_verify_missing_evidence`.
- [ ] **S12.03** — Requirement versions identify due-stage, verifier and competent waiver with nonwaivable gates protected. (WF14, WF15, WF16, WF17, WF18, WF19; incomplete / full criterion not verified).
- [ ] **S12.04** — Preference/hold/confirmed date are distinguishable and mandatory due-stage checks block only correct final action. (WF14, WF15, WF16, WF17, WF18, WF19; incomplete / full criterion not verified).
- [ ] **S12.05** — Clergy/venue/setup conflicts recheck at commit; impossible double-use has no generic override. (WF14, WF15, WF16, WF17, WF18, WF19; incomplete / full criterion not verified).
- [ ] **S12.06** — Shared celebration keeps individual readiness, actual participant confirmation and official numbers. (WF14, WF15, WF16, WF17, WF18, WF19; incomplete / full criterion not verified).
- [ ] **S12.07** — No-show/changed celebrant/actual time are recorded before official submission with no future false celebration. (WF14, WF15, WF16, WF17, WF18, WF19; incomplete / full criterion not verified).
- [ ] **S12.08** — Priest can return proposed entry for correction and compares actual identity/celebration/source before approval. (WF14, WF15, WF16, WF17, WF18, WF19; incomplete / full criterion not verified).
- [ ] **S12.09** — Number scope/allocation/gaps/history remain an explicit clergy policy dependency, never inferred from sample numbers. (WF14, WF15, WF16, WF17, WF18, WF19; incomplete / full criterion not verified).
- [ ] **S12.10** — Approved error uses authorized amendment preserving original and linked certificate consequences. (WF14, WF15, WF16, WF17, WF18, WF19; incomplete / full criterion not verified).
- [ ] **S12.11** — Pre-celebration cancel differs from post-celebration/registered correction; completed official history cannot be erased. (WF14, WF15, WF16, WF17, WF18, WF19; incomplete / full criterion not verified).
- [ ] **S12.12** — Timeline shows actual completed/current/planned timestamps, waiting duration, next role and audience-safe detail. (WF14, WF15, WF16, WF17, WF18, WF19; incomplete / full criterion not verified).
- [ ] **S12.13** — Proposed dedicated official-register search and full authorized export have defined book/page/year/number filters. (WF14, WF15, WF16, WF17, WF18, WF19; incomplete / full criterion not verified).

## S13

Implemented portion: Separate service kinds and restricted sick-visit facts.

Code: [src/ParishLive.Infrastructure/Operations/ParishCaseService.cs](../../src/ParishLive.Infrastructure/Operations/ParishCaseService.cs), [src/ParishLive.Web/Pages/Requests/Edit.cshtml](../../src/ParishLive.Web/Pages/Requests/Edit.cshtml)

Remaining software: Full sacrament/service-specific forms and eligibility routes, partners/parents/external celebrant authority, external records, rite variations, actual fee/offering configuration and funeral/deceased consequences.

Real-world inputs: U02, U03, U05, U06 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S13.01** — Baptism card separates intake, preparation and official-output facts and unresolved approved checklist inputs. (WF14, WF15, WF16, WF17, WF18, WF53, WF54, WF55, WF56; incomplete / full criterion not verified).
- [ ] **S13.02** — Unregistered child matching searches archived records and verifies guardian/household before creation/link. (WF14, WF15, WF16, WF17, WF18, WF53, WF54, WF55, WF56; incomplete / full criterion not verified).
- [ ] **S13.03** — Adult/unknown-parent baptism avoids impossible parental required fields while maintaining actual eligibility review. (WF14, WF15, WF16, WF17, WF18, WF53, WF54, WF55, WF56; incomplete / full criterion not verified).
- [ ] **S13.04** — Communion prior-record/formation evidence can be externally verified without creating another local celebration. (WF14, WF15, WF16, WF17, WF18, WF53, WF54, WF55, WF56; incomplete / full criterion not verified).
- [ ] **S13.05** — Only approved rite route exposes confirmation/chrismation terminology and linked-versus-separate records. (WF14, WF15, WF16, WF17, WF18, WF53, WF54, WF55, WF56; incomplete / full criterion not verified).
- [ ] **S13.06** — Marriage captures both partners and permitted outside references without forcing local membership. (WF14, WF15, WF16, WF17, WF18, WF53, WF54, WF55, WF56; incomplete / full criterion not verified).
- [ ] **S13.07** — Special review routes to actual competent authority and never decides religious eligibility automatically. (WF14, WF15, WF16, WF17, WF18, WF53, WF54, WF55, WF56; incomplete / full criterion not verified).
- [ ] **S13.08** — Funeral urgent handling uses maintained contact/approved service checklist without unrelated formation barriers. (WF14, WF15, WF16, WF17, WF18, WF53, WF54, WF55, WF56; incomplete / full criterion not verified).
- [ ] **S13.09** — Funeral completion only suggests reviewed deceased-status update and separately reviews future duties/contact. (WF14, WF15, WF16, WF17, WF18, WF53, WF54, WF55, WF56; incomplete / full criterion not verified).
- [ ] **S13.10** — Mass intention, blessing, sick visit and appointment have separate data/access/calendar/task outcomes. (WF14, WF15, WF16, WF17, WF18, WF53, WF54, WF55, WF56; incomplete / full criterion not verified).
- [ ] **S13.11** — External sacrament reference remains verified source evidence with no invented local number/celebration. (WF14, WF15, WF16, WF17, WF18, WF53, WF54, WF55, WF56; incomplete / full criterion not verified).
- [ ] **S13.12** — Jurisdiction-approved versioned variations cannot silently change existing official facts or common authority rules. (WF14, WF15, WF16, WF17, WF18, WF53, WF54, WF55, WF56; incomplete / full criterion not verified).
- [ ] **S13.13** — Actual approved fee/offering/waiver wording is separate from acceptance and no sample amount is charged. (WF14, WF15, WF16, WF17, WF18, WF53, WF54, WF55, WF56; incomplete / full criterion not verified).

## S14

Implemented portion: Official-source certificate preparation, exact snapshot, personal priest approval/signature evidence, bishop return/acceptance, final-file review, issue/release/collection and actual-recipient download checks.

Code: [src/ParishLive.Infrastructure/Operations/DocumentService.cs](../../src/ParishLive.Infrastructure/Operations/DocumentService.cs), [src/ParishLive.Web/Pages/Documents](../../src/ParishLive.Web/Pages/Documents)

Remaining software: Complete bishop queue, waiting certificates, approved template rendering, official correction/reissue/revocation, legacy provenance and fee/delivery options.

Real-world inputs: U04, U05, U06 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S14.01** — Actual document types/wording/seals/signature examples remain required competent-authority inputs. (WF20, WF21; incomplete / full criterion not verified).
- [ ] **S14.02** — Subject/guardian/representative authorization is checked independently from household membership. (WF20, WF21; incomplete / full criterion not verified).
- [ ] **S14.03** — New bishop-review default is explicitly proposed pending competent policy and legacy handling remains separate. (WF20, WF21; incomplete / full criterion not verified).
- [ ] **S14.04** — Issued/ready/released/collected reflect distinct real gates and exact final snapshot. (WF20, WF21; incomplete / full criterion not verified).
- [ ] **S14.05** — Bishop queue exposes exact signed version/waiting/resubmission facts only to eligible reviewers. (WF20, WF21; incomplete / full criterion not verified).
- [ ] **S14.06** — Returned material revision invalidates affected signature and retains restricted reason plus neutral applicant status. (WF20, WF21; focal boundary tested; complete question open).
  Focal evidence: `AccessAndRecoveryTests.Bishop_return_invalidates_signature_file_and_release_requires_exact_recipient_then_can_be_withdrawn`.
- [ ] **S14.07** — Absence replacement has actual eligible religious appointment; office/admin cannot forge signature/episcopal action. (WF20, WF21; incomplete / full criterion not verified).
- [ ] **S14.08** — Waiting certificate links exact approved source after celebration; cancellation/ambiguous source is reviewed. (WF20, WF21; incomplete / full criterion not verified).
- [ ] **S14.09** — Approved EN/FR/AR template/name spellings and chosen layout are previewed without automatic transliteration. (WF20, WF21; incomplete / full criterion not verified).
- [ ] **S14.10** — Unsigned preview format/QR does not make official certificate; actual authority determines signed-paper/digital validity. (WF20, WF21; incomplete / full criterion not verified).
- [ ] **S14.11** — Reprint versus replacement/reissue/revocation preserves version and no universal validity period is invented. (WF20, WF21; incomplete / full criterion not verified).
- [ ] **S14.12** — Legacy issued retains actual provenance without fabricated retrospective bishop acceptance. (WF20, WF21; incomplete / full criterion not verified).
- [ ] **S14.13** — Verified actual recipient/representative and receipt time distinguish release availability from collection. (WF20, WF21; incomplete / full criterion not verified).
- [ ] **S14.14** — Quantity/fee/delivery choices keep outstanding balance/collection follow-up separate from clergy approval. (WF20, WF21; incomplete / full criterion not verified).

## S15

Implemented portion: PDF/JPEG/PNG signature/type/size/count validation, rejected-file replacement, own/office file retrieval, final subject/source comparison, release withdrawal and bearer-independent sensitive access.

Code: [src/ParishLive.Infrastructure/Operations/DocumentService.cs](../../src/ParishLive.Infrastructure/Operations/DocumentService.cs), [src/ParishLive.Web/Pages/Requests/Detail.cshtml.cs](../../src/ParishLive.Web/Pages/Requests/Detail.cshtml.cs)

Remaining software: PDF page limits, capture/rotate/preview, full file access audit, safe reuse, office paper evidence entry/waivers, retention holds and production malware/object-storage controls.

Real-world inputs: U02, U05, U08, U10 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S15.01** — Every approved requirement lists supplier, due stage, verifier and missing actual domain checklist input. (WF22, WF21; incomplete / full criterion not verified).
- [ ] **S15.02** — Applicant later uploads and office paper route share same checklist without losing intake on upload inability. (WF22, WF21; incomplete / full criterion not verified).
- [ ] **S15.03** — Uploaded/paper received/verified/rejected/expired/waived are separate with actual responsible reviewer. (WF22, WF21; incomplete / full criterion not verified).
- [ ] **S15.04** — Published proposed file/size/count/page limits apply consistently with reviewed large-file office exception. (WF22, WF21; incomplete / full criterion not verified).
- [ ] **S15.05** — Optional capture/rotate/crop/preview does not destroy original evidence or imply authenticity. (WF22, WF21; incomplete / full criterion not verified).
- [ ] **S15.06** — Per-file progress/failure/retry distinguishes local selection from saved receipt and preserves other form data. (WF22, WF21; incomplete / full criterion not verified).
- [ ] **S15.07** — File-level view/replace/remove/download rules retain versions and lock approved/closed evidence. (WF22, WF21; incomplete / full criterion not verified).
- [ ] **S15.08** — Reuse rechecks subject/purpose/validity/audience and does not disclose source case’s other files. (WF22, WF21; incomplete / full criterion not verified).
- [ ] **S15.09** — Release preview compares subject/requester/recipient/source/final version and blocks mismatches. (WF22, WF21; incomplete / full criterion not verified).
- [ ] **S15.10** — Withdrawal stops future access, preserves history and admits downloaded copies cannot be recalled. (WF22, WF21; incomplete / full criterion not verified).
- [ ] **S15.11** — Tracking bearer is not sufficient sensitive-download identity; missing challenge uses reviewed account/collection route. (WF22, WF21; focal boundary tested; complete question open).
  Focal evidence: `AccessAndRecoveryTests.Bishop_return_invalidates_signature_file_and_release_requires_exact_recipient_then_can_be_withdrawn`.
- [ ] **S15.12** — Restricted upload/view/release/download audit and approved retention/hold rules survive cancellation/archive. (WF22, WF21; incomplete / full criterion not verified).

## S16

Implemented portion: Existing month calendar, audience-filtered event reads and parish-local reservation entry with DST rejection.

Code: [src/ParishLive.Infrastructure/Events/EventService.cs](../../src/ParishLive.Infrastructure/Events/EventService.cs), [src/ParishLive.Web/Pages/Events/Calendar.cshtml](../../src/ParishLive.Web/Pages/Events/Calendar.cshtml), [src/ParishLive.Web/Pages/Reservations/New.cshtml.cs](../../src/ParishLive.Web/Pages/Reservations/New.cshtml.cs)

Remaining software: Event create/edit/publication UI, recurrence/exceptions, Week/List views, clergy commitments, source-owned consequential dates, local-zone calendar rendering, liturgical inputs and anniversaries.

Real-world inputs: U02, U09 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S16.01** — Every event type has meaningful label/default audience and required parish/time/resource fields. (WF23; incomplete / full criterion not verified).
- [ ] **S16.02** — Create/edit/publish/invite authority differs by source type and assigned ministry/resource scope. (WF23; incomplete / full criterion not verified).
- [ ] **S16.03** — Private occupied interval blocks resource without public title/subject/contact leakage. (WF23; incomplete / full criterion not verified).
- [ ] **S16.04** — Occurrence/forward/eligible-series changes preview dependencies and preserve completed history. (WF23; incomplete / full criterion not verified).
- [ ] **S16.05** — Exclusive room/clergy/stock conflicts block; only permitted preference warnings allow reasoned exception. (WF23; incomplete / full criterion not verified).
- [ ] **S16.06** — One canonical occurrence links source workflows and source owns consequential date/status edits. (WF23; incomplete / full criterion not verified).
- [ ] **S16.07** — Month/Week/List defaults, filters, week start and early/late visibility are explicitly stated. (WF23; incomplete / full criterion not verified).
- [ ] **S16.08** — Parish-local zone is authoritative and cross-midnight/DST/viewer equivalents are unambiguous. (WF23; incomplete / full criterion not verified).
- [ ] **S16.09** — Thirty-minute shortcuts never silently round actual times or prohibit approved early/late/all-day use. (WF23; incomplete / full criterion not verified).
- [ ] **S16.10** — Schedule print/export contains only permitted audience fields and actual period/zone. (WF23; incomplete / full criterion not verified).
- [ ] **S16.11** — Liturgical calendar source/rite/year/version needs competent approval; no sample feast becomes authoritative. (WF23; incomplete / full criterion not verified).
- [ ] **S16.12** — Anniversary date precision/deceased/private audience rules prevent false or inappropriate outreach. (WF23; incomplete / full criterion not verified).
- [ ] **S16.13** — Material event change updates linked work and requires applicable reconfirmation distinct from delivery. (WF23; incomplete / full criterion not verified).

## S17

Implemented portion: Requirements retained; no running-plan/music application implementation.

Code: No workflow implementation.

Remaining software: Operational service plans, relative/fixed timing, templates, role finalization, rights-aware versioned music library and audience-specific outputs.

Real-world inputs: U02, U08 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S17.01** — Event occurrence, operational plan, sacramental case and meeting remain linked but distinct records. (WF24, WF25; workflow not implemented).
- [ ] **S17.02** — Plan coordinator/contributor/religious approver scopes protect private instructions and other parishes. (WF24, WF25; workflow not implemented).
- [ ] **S17.03** — Final live plan checks actual event/owner/roles while reusable draft template can omit future people/date. (WF24, WF25; workflow not implemented).
- [ ] **S17.04** — Relative timing recalculates, fixed starts constrain, and no plan silently extends confirmed booking. (WF24, WF25; workflow not implemented).
- [ ] **S17.05** — Overtime/unassigned role/conflict visibly blocks finalization or creates reviewed correction task. (WF24, WF25; workflow not implemented).
- [ ] **S17.06** — Explicit Save and draft/approved/completed states preserve unsaved and concurrent-change recovery. (WF24, WF25; workflow not implemented).
- [ ] **S17.07** — Template copy requires actual date/people/resources review and never mutates earlier saved plans. (WF24, WF25; workflow not implemented).
- [ ] **S17.08** — Clergy/team/participant/music outputs omit audience-inappropriate instructions. (WF24, WF25; workflow not implemented).
- [ ] **S17.09** — Music owner and metadata/search filters have defined actual rights/source review. (WF24, WF25; workflow not implemented).
- [ ] **S17.10** — Lyric/chord/version change does not mutate pinned past plan version. (WF24, WF25; workflow not implemented).
- [ ] **S17.11** — Print/download/projection require actual rights basis and attribution, not upload possession. (WF24, WF25; workflow not implemented).
- [ ] **S17.12** — All retained planning/music remains in scope; any future deferral requires explicit owner decision/fallback. (WF24, WF25; workflow not implemented).

## S18

Implemented portion: Verified-person ministry applications, leader recommendation, priest final/direct decision, withdrawal after review and private departure boundaries.

Code: [src/ParishLive.Infrastructure/Operations/CommunityService.cs](../../src/ParishLive.Infrastructure/Operations/CommunityService.cs), [src/ParishLive.Web/Pages/Community](../../src/ParishLive.Web/Pages/Community)

Remaining software: Group administration, full published eligibility/trial/guardian conditions, consented staff additions, handover mapping and dedicated group tabs/files/loans.

Real-world inputs: U03, U08 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S18.01** — Group type distinguishes ministry/choir/class/committee/team without changing record permissions by label. (WF26, WF27; incomplete / full criterion not verified).
- [ ] **S18.02** — Creation/leader appointment/eligibility/public listing have separate actual authorities. (WF26, WF27; incomplete / full criterion not verified).
- [ ] **S18.03** — Applicant sees real purpose/schedule/eligibility/capacity/commitment before choosing apply. (WF26, WF27; incomplete / full criterion not verified).
- [ ] **S18.04** — Follower/unlinked applicant gets inquiry or verified-link next step, not hidden roster access. (WF26, WF27; incomplete / full criterion not verified).
- [ ] **S18.05** — Leader review then priest final approval/direct priest route preserves actual extra trial/guardian requirements. (WF26, WF27; incomplete / full criterion not verified).
- [ ] **S18.06** — Staff addition follows same consent/eligibility/priest decision or reviewed historic-roster provenance. (WF26, WF27; incomplete / full criterion not verified).
- [ ] **S18.07** — Conflicted/unavailable leader uses eligible reviewer/priest and applicant appeal/reapply remains traceable. (WF26, WF27; incomplete / full criterion not verified).
- [ ] **S18.08** — Private departure stays priest/applicant only; optional participation/contact may stop while administrative review waits. (WF26, WF27; incomplete / full criterion not verified).
- [ ] **S18.09** — Leader sees neutral end/effective date and future work consequence, never private reason. (WF26, WF27; incomplete / full criterion not verified).
- [ ] **S18.10** — Pre-review withdrawal completes directly; post-leader request cannot later approve from terminal state. (WF26, WF27; incomplete / full criterion not verified).
- [ ] **S18.11** — Leadership/group handover maps tasks/files/applications and preserves historic attendance/authority. (WF26, WF27; incomplete / full criterion not verified).
- [ ] **S18.12** — Role-specific group tabs keep secretary operational subset and require separate attendance/publishing/loan grants. (WF26, WF27; incomplete / full criterion not verified).

## S19

Implemented portion: Meeting-attendance storage only; existing historic group terms retained.

Code: [src/ParishLive.Domain/Entities/ParishOperations.cs](../../src/ParishLive.Domain/Entities/ParishOperations.cs)

Remaining software: Meeting/RSVP workflows, expected roster snapshots, attendance recording/correction/month close, imports/reports, formation sign-off and resource loans.

Real-world inputs: U02, U03, U11 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S19.01** — Group meeting owns one linked occurrence and date editing cannot produce conflicting independent calendars. (WF28, WF29, WF65; workflow not implemented).
- [ ] **S19.02** — Current/trial/new member materials follow actual group audience without automatic historical-private access. (WF28, WF29, WF65; workflow not implemented).
- [ ] **S19.03** — RSVP supports Yes/No/Undecided and stated deadline; optional reason restricted, never actual attendance. (WF28, WF29, WF65; workflow not implemented).
- [ ] **S19.04** — Not recorded, Not expected and factual absence remain distinct in grid and reports. (WF28, WF29, WF65; workflow not implemented).
- [ ] **S19.05** — Recorder/month-close correction authority preserves reason/history before and after locking. (WF28, WF29, WF65; workflow not implemented).
- [ ] **S19.06** — Expected roster snapshots include real join/end dates and guests separate from member denominator. (WF28, WF29, WF65; workflow not implemented).
- [ ] **S19.07** — Attendance import previews exact person/date/status mapping, errors, duplicates and reversal consequences. (WF28, WF29, WF65; workflow not implemented).
- [ ] **S19.08** — Member/leader/clergy reports show permitted scope, expected denominator and unknown coverage. (WF28, WF29, WF65; workflow not implemented).
- [ ] **S19.09** — Formation milestones use approved program/evidence/qualified sign-off, not attendance-only automatic eligibility. (WF28, WF29, WF65; workflow not implemented).
- [ ] **S19.10** — Digital learning material and physical belongings have different metadata/access/loan interfaces. (WF28, WF29, WF65; workflow not implemented).
- [ ] **S19.11** — Outstanding loans remain limited recovery work after departure while member-only digital access ends. (WF28, WF29, WF65; workflow not implemented).
- [ ] **S19.12** — Collaborative group notes/tasks never inherit private member or pastoral notebook contents. (WF28, WF29, WF65; workflow not implemented).

## S20

Implemented portion: Requirements retained; no volunteer rota implementation.

Code: No workflow implementation.

Remaining software: Opportunities, eligibility, offers, independent acceptance/confirmation, cross-parish conflicts, cancellation/replacement, reviewed hours and privacy-safe outputs.

Real-world inputs: U03, U07 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S20.01** — Volunteer is approved service participation, not a separate volunteer-only authentication role. (WF30; workflow not implemented).
- [ ] **S20.02** — Visitors/minors require opportunity-specific approved eligibility/consent/screening rather than blanket inclusion. (WF30; workflow not implemented).
- [ ] **S20.03** — Team/position/date/skills/capacity configuration has an actual coordinator and published expectations. (WF30; workflow not implemented).
- [ ] **S20.04** — Availability, offer/invitation and coordinator confirmation are separate actual response steps. (WF30; workflow not implemented).
- [ ] **S20.05** — Invited/offered/confirmed/cancelled/completed states identify actual next actor and timestamps. (WF30; workflow not implemented).
- [ ] **S20.06** — Overlap/prerequisite checks block unsafe assignment while cross-parish busy details remain private. (WF30; workflow not implemented).
- [ ] **S20.07** — Late cancellation/swap leaves real vacancy until eligible replacement independently accepts/confirmed. (WF30; workflow not implemented).
- [ ] **S20.08** — Assign/change dialog and keyboard/touch path enforce same rules as drag-and-drop. (WF30; workflow not implemented).
- [ ] **S20.09** — Actual hours require independent source review and are never invented from scheduled duration. (WF30; workflow not implemented).
- [ ] **S20.10** — Public opportunity sheet omits volunteer private identity/contact and closed opportunity remains historically permitted. (WF30; workflow not implemented).

## S21

Implemented portion: Atomic Reserved/Waitlisted capacity, legacy deduplication, reviewed age/consent version and separate Confirmed state; restricted-event/representation checks.

Code: [src/ParishLive.Infrastructure/Operations/EventAdmissionService.cs](../../src/ParishLive.Infrastructure/Operations/EventAdmissionService.cs), [src/ParishLive.Web/Pages/Events](../../src/ParishLive.Web/Pages/Events)

Remaining software: Form builder, expiry/promotion/cancellation, transport/seats, fee/discount/waiver/installment policies, linked receipt allocations, refund UI and material event-change reconfirmation workflow.

Real-world inputs: U03, U06, U07 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S21.01** — Eligible non-Mass event/program and primary capacity pool/session structure are explicit. (WF31, WF33, WF57; incomplete / full criterion not verified).
- [ ] **S21.02** — Form/event/room creation preserves proper publication and resource approval rather than hidden confirmed booking. (WF31, WF33, WF57; incomplete / full criterion not verified).
- [ ] **S21.03** — Guest/member/guardian/office entry verifies subject authority without automatic person/member creation. (WF31, WF33, WF57; incomplete / full criterion not verified).
- [ ] **S21.04** — Builder field conditions, preview, visibility and attachments match enumerated form dictionary. (WF31, WF33, WF57; incomplete / full criterion not verified).
- [ ] **S21.05** — Atomic capacity includes Reserved/Confirmed and distinguishes mere submission from actual hold. (WF31, WF33, WF57; focal boundary tested; complete question open).
  Focal evidence: `ConcurrentAdmissionTests.Independent_connections_competing_for_the_final_place_cannot_overbook`.
- [ ] **S21.06** — Staff-reviewed waitlist order/invitation deadline/expiry is explicit and never silently assumes delivered invitation. (WF31, WF33, WF57; incomplete / full criterion not verified).
- [ ] **S21.07** — Reserved may await consent; Confirmed/check-in require real applicable consent, payment separate approved policy. (WF31, WF33, WF57; incomplete / full criterion not verified).
- [ ] **S21.08** — Consent pins event/version/giver and unknown age/material wording change triggers review/reconsent. (WF31, WF33, WF57; incomplete / full criterion not verified).
- [ ] **S21.09** — Transport selection/seat/route/fees remain separately allocated when schedule or paid option changes. (WF31, WF33, WF57; incomplete / full criterion not verified).
- [ ] **S21.10** — Fee basis/snapshot/discount/waiver/installment policy has actual eligible approver and no invented rates. (WF31, WF33, WF57; incomplete / full criterion not verified).
- [ ] **S21.11** — Only actual receipt method/proof generates paid status; claimed bank/OMT transfer remains pending verification. (WF31, WF33, WF57; incomplete / full criterion not verified).
- [ ] **S21.12** — Different-currency/split/overpayment allocations retain original amount/rate/date/source and unapplied balance. (WF31, WF33, WF57; incomplete / full criterion not verified).
- [ ] **S21.13** — Receipt correction/refund uses original canonical reference and attributed reversal, not deletion/double Finance posting. (WF31, WF33, WF57; incomplete / full criterion not verified).
- [ ] **S21.14** — Cancellation separately resolves place/transport/fee/refund approval and actual refunded payment. (WF31, WF33, WF57; incomplete / full criterion not verified).
- [ ] **S21.15** — Participant-bearing event/currency locks require reviewed amendment/replacement, never silent reassignment. (WF31, WF33, WF57; incomplete / full criterion not verified).
- [ ] **S21.16** — Legacy unlinked/closed/duplicate/unpaid/undelivered states show exact next action and no fabricated confirmation. (WF31, WF33, WF57; incomplete / full criterion not verified).

## S22

Implemented portion: Configured safeguarding-lead-only check-in, approved collector plus identity check, independent-exit gate, actual event movements, paper reconciliation and event-only present roster.

Code: [src/ParishLive.Infrastructure/Operations/EventAdmissionService.cs](../../src/ParishLive.Infrastructure/Operations/EventAdmissionService.cs), [src/ParishLive.Web/Pages/Events/Admissions.cshtml.cs](../../src/ParishLive.Web/Pages/Events/Admissions.cshtml.cs)

Remaining software: Exact trained operator/device appointment UI, candidate code lifecycle, incident response/reporting, reusable guardian restrictions and maintained emergency contact routing.

Real-world inputs: U03, U07, U10, U14 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S22.01** — Check-in is exact registered event/occurrence operation on assigned devices/users, never individual Mass attendance. (WF34, WF58, WF35; incomplete / full criterion not verified).
- [ ] **S22.02** — Name/reference/code identifies candidate only and protected roster fallback preserves minimum disclosure. (WF34, WF58, WF35; incomplete / full criterion not verified).
- [ ] **S22.03** — Walk-in completes same capacity/consent/age eligibility before check-in, never bypasses full event. (WF34, WF58, WF35; incomplete / full criterion not verified).
- [ ] **S22.04** — Care/pickup alerts are visible only to assigned operators away from bystanders. (WF34, WF58, WF35; incomplete / full criterion not verified).
- [ ] **S22.05** — Duplicate arrival/wrong event/checkout/reentry create correct history without overwriting actual times. (WF34, WF58, WF35; incomplete / full criterion not verified).
- [ ] **S22.06** — Collectors/restrictions have reusable authority plus event-specific confirmation and actual identity check. (WF34, WF58, WF35; incomplete / full criterion not verified).
- [ ] **S22.07** — Code creation/delivery/loss replacement is real and code alone never authorizes pickup. (WF34, WF58, WF35; incomplete / full criterion not verified).
- [ ] **S22.08** — Unauthorized collector has no ordinary release; named safeguarding lead and verified guardian route must exist. (WF34, WF58, WF35; focal boundary tested; complete question open).
  Focal evidence: `AccessAndRecoveryTests.Unknown_age_blocks_confirmation_and_unauthorized_collector_never_creates_an_exit`.
- [ ] **S22.09** — Independent departure needs explicit approved permission and actual exit evidence, not missing collector configuration. (WF34, WF58, WF35; incomplete / full criterion not verified).
- [ ] **S22.10** — Incident links actual known event/person/location without invented legacy links or broad office disclosure. (WF34, WF58, WF35; incomplete / full criterion not verified).
- [ ] **S22.11** — Restricted report records actual response/handler/closure/amendment rather than claiming help was automatically sent. (WF34, WF58, WF35; incomplete / full criterion not verified).
- [ ] **S22.12** — Emergency roster states active event participants and refresh time, explicitly excluding whole-building coverage. (WF34, WF58, WF35; incomplete / full criterion not verified).
- [ ] **S22.13** — Offline paper arrival/pickup follows approved procedure and reconciles original event times versus later entry. (WF34, WF58, WF35; incomplete / full criterion not verified).
- [ ] **S22.14** — Training labels true functions/manual contacts and unconfigured broadcast delivery honestly. (WF34, WF58, WF35; incomplete / full criterion not verified).

## S23

Implemented portion: Optional ministry on renter/request, priest direct approval, serviceable capacity, setup/cleanup conflict checks, optimistic resource lock and state history.

Code: [src/ParishLive.Infrastructure/Reservations/ReservationService.cs](../../src/ParishLive.Infrastructure/Reservations/ReservationService.cs), [src/ParishLive.Web/Pages/Reservations](../../src/ParishLive.Web/Pages/Reservations)

Remaining software: Public free/busy, explicit hold UI/expiry workflow, recurrence/operating hours/partitions, competitor alternatives, reschedule/refund dependencies, stock/maintenance/damage/repair/renter agreement workflows.

Real-world inputs: U06, U07, U09 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S23.01** — Resource identity/properties/combinations/capacity/operating hours and serviceability affect actual availability. (WF13, WF36, WF37; incomplete / full criterion not verified).
- [ ] **S23.02** — Public/member/leader/renter request rights remain separate from confirmed-booking authority. (WF13, WF36, WF37; incomplete / full criterion not verified).
- [ ] **S23.03** — Public free/busy omits private titles/contacts/payments; staff details follow actual grant. (WF13, WF36, WF37; incomplete / full criterion not verified).
- [ ] **S23.04** — Submission is not hold; explicit 24-hour proposed hold has owner/expiry and real availability evaluation. (WF13, WF36, WF37; incomplete / full criterion not verified).
- [ ] **S23.05** — Winning booking prompts reviewed competitor alternatives rather than silent automatic refusal. (WF13, WF36, WF37; incomplete / full criterion not verified).
- [ ] **S23.06** — Default priest confirmation/direct path and explicit routine delegated booking scope are distinguishable. (WF13, WF36, WF37; incomplete / full criterion not verified).
- [ ] **S23.07** — Setup/cleanup/recurrence/operating hours/shared partitions are included in resource conflict computation. (WF13, WF36, WF37; incomplete / full criterion not verified).
- [ ] **S23.08** — Reservation owns consequential date and deliberately linked calendar/plan/form never creates copies. (WF13, WF36, WF37; incomplete / full criterion not verified).
- [ ] **S23.09** — Actual responsible adult/purpose/access/agreements are collected only when genuinely required. (WF13, WF36, WF37; incomplete / full criterion not verified).
- [ ] **S23.10** — Pricing/deposit/waiver/refund terms pin approved version and link actual money once. (WF13, WF36, WF37; incomplete / full criterion not verified).
- [ ] **S23.11** — Applicant reschedule/cancel request preserves original until approved alternative/resources/financial consequences resolved. (WF13, WF36, WF37; incomplete / full criterion not verified).
- [ ] **S23.12** — Maintenance previews existing bookings and distinguishes routine relocation plan from urgent unsafe restriction. (WF13, WF36, WF37; incomplete / full criterion not verified).
- [ ] **S23.13** — Atomic room-plus-equipment reservation and quantity/condition/return history cannot overcommit stock. (WF13, WF36, WF37; incomplete / full criterion not verified).
- [ ] **S23.14** — Qualified repair clearance and evidence/cost/notifications are actual, not reporter’s unverified all-clear. (WF13, WF36, WF37; incomplete / full criterion not verified).
- [ ] **S23.15** — External renter is not parish member; reviewed identity link never merges customer histories by name alone. (WF13, WF36, WF37; incomplete / full criterion not verified).
- [ ] **S23.16** — Utilization/overdue/decision-time figures disclose source period/denominator and insufficient data. (WF13, WF36, WF37; incomplete / full criterion not verified).

## S24

Implemented portion: Actual original-currency cash count lines, independent observed totals, variance, revision verification and exactly-once close/post; no pledge auto-cash.

Code: [src/ParishLive.Infrastructure/Operations/FinanceService.cs](../../src/ParishLive.Infrastructure/Operations/FinanceService.cs), [src/ParishLive.Web/Pages/Finance/Giving.cshtml](../../src/ParishLive.Web/Pages/Finance/Giving.cshtml)

Remaining software: Person/household/envelope attribution, fund reclassification after close, real reversals, pledges/campaigns and reviewed receipt/annual statement documents.

Real-world inputs: U06, U08 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S24.01** — Anonymous/person/household/restricted/campaign giving retains exact attribution purpose without hidden identity. (WF41, WF42, WF59, WF60, WF61; incomplete / full criterion not verified).
- [ ] **S24.02** — Donor identity/amount fields require separate finance scope, not leader/office rank. (WF41, WF42, WF59, WF60, WF61; incomplete / full criterion not verified).
- [ ] **S24.03** — Envelope lookup uses dated parish assignment and unknown/duplicate stays unattributed pending review. (WF41, WF42, WF59, WF60, WF61; incomplete / full criterion not verified).
- [ ] **S24.04** — Actual amount/currency/date/fund/method/origin/anonymous facts are captured before genuine receipt posting. (WF41, WF42, WF59, WF60, WF61; incomplete / full criterion not verified).
- [ ] **S24.05** — LBP entry stays actual LBP and any USD equivalent is separately labeled dated calculation. (WF41, WF42, WF59, WF60, WF61; incomplete / full criterion not verified).
- [ ] **S24.06** — Count source/date/currency/method and counter roles separate cash from bank receipts. (WF41, WF42, WF59, WF60, WF61; incomplete / full criterion not verified).
- [ ] **S24.07** — Independent second real person confirms exact reviewed revision; no static sample-success action. (WF41, WF42, WF59, WF60, WF61; focal boundary tested; complete question open).
  Focal evidence: `ReviewedRequirementsTests.Closed_giving_needs_actual_distinct_review_and_posts_once`.
- [ ] **S24.08** — Variance stays open with recount evidence and absence of second counter never becomes verified. (WF41, WF42, WF59, WF60, WF61; focal boundary tested; complete question open).
  Focal evidence: `ReviewedRequirementsTests.Closed_giving_needs_actual_distinct_review_and_posts_once`.
- [ ] **S24.09** — Close checks actual totals/revision and posts canonical movements once before locking. (WF41, WF42, WF59, WF60, WF61; focal boundary tested; complete question open).
  Focal evidence: `ReviewedRequirementsTests.Closed_giving_needs_actual_distinct_review_and_posts_once`.
- [ ] **S24.10** — Closed donor/fund reclassification changes allocation only while amount/currency/payment error uses real reversal. (WF41, WF42, WF59, WF60, WF61; incomplete / full criterion not verified).
- [ ] **S24.11** — Pledges/standing expectations never auto-charge or increase cash without actual receipt. (WF41, WF42, WF59, WF60, WF61; incomplete / full criterion not verified).
- [ ] **S24.12** — Campaign public totals use eligible net receipts and approved restricted/excess-fund handling. (WF41, WF42, WF59, WF60, WF61; incomplete / full criterion not verified).
- [ ] **S24.13** — Receipts/annual statements are versioned reviewed financial documents without unsupported tax/legal status. (WF41, WF42, WF59, WF60, WF61; incomplete / full criterion not verified).
- [ ] **S24.14** — Member/household giving view checks actual donor/statement-recipient authority, not family membership. (WF41, WF42, WF59, WF60, WF61; incomplete / full criterion not verified).

## S25

Implemented portion: Independent submit/approve/actual-pay, immutable canonical original-currency movements, allocations, bounded refunds service, internal OfficeCash transfer, one opening per account/currency and read-only formula-safe CSV.

Code: [src/ParishLive.Infrastructure/Operations/FinanceService.cs](../../src/ParishLive.Infrastructure/Operations/FinanceService.cs), [src/ParishLive.Web/Pages/Finance](../../src/ParishLive.Web/Pages/Finance), [src/ParishLive.Infrastructure/Data/OperationRunner.cs](../../src/ParishLive.Infrastructure/Data/OperationRunner.cs)

Remaining software: Fine-grained finance duties, versioned accounts/funds/budgets, invoices/reimbursements, conversion metadata, reconciliation, period close/reopen, reversal/correction UI, vouchers and separately scoped diocesan aggregation.

Real-world inputs: U06, U11, U14 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S25.01** — Administrative ledger versus actual external accounting authority/exchange is explicitly approved, not assumed certified replacement. (WF33, WF43, WF44, WF45; incomplete / full criterion not verified).
- [ ] **S25.02** — View/enter/approve/pay/reverse/reconcile/export rights are distinct and no person self-second-approves. (WF33, WF43, WF44, WF45; incomplete / full criterion not verified).
- [ ] **S25.03** — Actual fund/restriction/budget/period/account setup has competent finance approval and versioned changes. (WF33, WF43, WF44, WF45; incomplete / full criterion not verified).
- [ ] **S25.04** — Expense draft/approved/paid/reimbursed states represent distinct facts without sample threshold policy. (WF33, WF43, WF44, WF45; incomplete / full criterion not verified).
- [ ] **S25.05** — Supplier invoice, receipt and reimbursement claim are distinguishable with reviewed missing-evidence exception. (WF33, WF43, WF44, WF45; incomplete / full criterion not verified).
- [ ] **S25.06** — Original currency and applied conversion direction/date/source/result survive any later reporting-rate change. (WF33, WF43, WF44, WF45; incomplete / full criterion not verified).
- [ ] **S25.07** — Separate actual currency balances and labeled rounded equivalents cannot be mistaken for mixed cash. (WF33, WF43, WF44, WF45; incomplete / full criterion not verified).
- [ ] **S25.08** — Bank import/match previews split/combined/fees/duplicates/unmatched before actual reconciliation. (WF33, WF43, WF44, WF45; incomplete / full criterion not verified).
- [ ] **S25.09** — Independent close review/undo/reopen preserves statement coverage, balance and original close history. (WF33, WF43, WF44, WF45; incomplete / full criterion not verified).
- [ ] **S25.10** — Event/rental/giving/refund screens reference one canonical movement and allocations sum correctly. (WF33, WF43, WF44, WF45; incomplete / full criterion not verified).
- [ ] **S25.11** — Office allowance is internal transfer; purchases count once in consolidated expense without duplicated Finance entry. (WF33, WF43, WF44, WF45; focal boundary tested; complete question open).
  Focal evidence: `ReviewedRequirementsTests.Office_allowance_transfer_is_not_an_expense_and_original_currency_is_preserved`.
- [ ] **S25.12** — Opening balance is entered once/currency and future carry-forward/correction never adds another initial balance. (WF33, WF43, WF44, WF45; incomplete / full criterion not verified).
- [ ] **S25.13** — Unreviewed ledger edits preserve audit; monthly-closed changes use attributed reversal/adjustment. (WF33, WF43, WF44, WF45; incomplete / full criterion not verified).
- [ ] **S25.14** — Internal vouchers/financial summaries have correct language/currency/source/signature approval status. (WF33, WF43, WF44, WF45; incomplete / full criterion not verified).
- [ ] **S25.15** — Diocesan aggregates versus itemized/donor identity require explicitly separate scope/field permission. (WF33, WF43, WF44, WF45; incomplete / full criterion not verified).
- [ ] **S25.16** — Finance viewer cannot mutate through stale route and unknown/sample metrics become honest unavailable states. (WF33, WF43, WF44, WF45; focal boundary tested; complete question open).
  Focal evidence: `AccessAndRecoveryTests.Financial_viewer_export_is_scope_limited_and_escapes_spreadsheet_formulas`.

## S26

Implemented portion: Actual in-app recipient notifications with operation deduplication, own read state, stale access checks and baseline notice audience filtering; no external delivery claim.

Code: [src/ParishLive.Web/Pages/Notifications](../../src/ParishLive.Web/Pages/Notifications), [src/ParishLive.Infrastructure/Notices/NoticeService.cs](../../src/ParishLive.Infrastructure/Notices/NoticeService.cs), [src/ParishLive.Infrastructure/Operations/ParishCaseService.cs](../../src/ParishLive.Infrastructure/Operations/ParishCaseService.cs)

Remaining software: Canonical Inbox/conversations, safe recipient selection, prayers, all 553 transition delivery/no-send rows, channel preferences, workers/retries/failure escalation and exceptional message review.

Real-world inputs: U07, U08, U10 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S26.01** — Private Inbox/request threads, audience communications and public/group posts have distinct destinations/permissions. (WF46, WF32, WF62; incomplete / full criterion not verified).
- [ ] **S26.02** — Purposeful recipient selection prevents national stranger/minor/private-contact enumeration. (WF46, WF32, WF62; incomplete / full criterion not verified).
- [ ] **S26.03** — Recipient sees actual sender/capacity and shared-office replies retain individual actor accounts. (WF46, WF32, WF62; incomplete / full criterion not verified).
- [ ] **S26.04** — Conversation participant changes cannot silently disclose earlier private history; household does not autojoin. (WF46, WF32, WF62; incomplete / full criterion not verified).
- [ ] **S26.05** — Sent correction is follow-up; own read/archive does not delete others’ message/attachment history. (WF46, WF32, WF62; incomplete / full criterion not verified).
- [ ] **S26.06** — Request timeline and Inbox resolve same canonical conversation without duplicate work/unread counts. (WF46, WF32, WF62; incomplete / full criterion not verified).
- [ ] **S26.07** — Notice audience/version/translation/pin/expiry follows actual publishing and membership access checks. (WF46, WF32, WF62; incomplete / full criterion not verified).
- [ ] **S26.08** — Prayer default is private and public anonymous/named wording needs exact approved permission/review. (WF46, WF32, WF62; incomplete / full criterion not verified).
- [ ] **S26.09** — In-app/manual baseline and each unavailable external channel have clear actual fallback. (WF46, WF32, WF62; incomplete / full criterion not verified).
- [ ] **S26.10** — Draft/scheduled/in-app/provider/delivered/read/failed states require their corresponding real evidence. (WF46, WF32, WF62; incomplete / full criterion not verified).
- [ ] **S26.11** — Rule records without runner are planning/manual worklists with actual trigger/owner/stop condition. (WF46, WF32, WF62; incomplete / full criterion not verified).
- [ ] **S26.12** — Every defined transition has explicit recipient/channel/message/privacy/timing/failure row or deliberate no-send. (WF46, WF32, WF62; incomplete / full criterion not verified).
- [ ] **S26.13** — Optional updates versus mandatory own-case/security availability honor actual language/channel/quiet-hour rules. (WF46, WF32, WF62; incomplete / full criterion not verified).
- [ ] **S26.14** — Account notification center filters parishes/read state and stale links recheck authorization. (WF46, WF32, WF62; incomplete / full criterion not verified).
- [ ] **S26.15** — Per-recipient/channel deduplication retries only failed still-eligible delivery with manual escalation. (WF46, WF32, WF62; incomplete / full criterion not verified).
- [ ] **S26.16** — Unwanted contact and exact-message exceptional review are restricted, reasoned and never browse-all access. (WF46, WF32, WF62; incomplete / full criterion not verified).

## S27

Implemented portion: Explicit qualified reviewer appointments, selected concern access, sensitive/identity separation, anonymous masking, no admin count, separate private logs, replies, closure/reopen and recusal.

Code: [src/ParishLive.Infrastructure/Operations/PrivateWorkService.cs](../../src/ParishLive.Infrastructure/Operations/PrivateWorkService.cs), [src/ParishLive.Web/Pages/Concerns](../../src/ParishLive.Web/Pages/Concerns), [src/ParishLive.Infrastructure/Data/AppDbContext.cs](../../src/ParishLive.Infrastructure/Data/AppDbContext.cs)

Remaining software: Unlinked/minor route, actual independent escalation contacts, conflict-safe reassignment/acceptance, evidence/export/redaction, later identity decisions and full departure continuity.

Real-world inputs: U03, U07, U08 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S27.01** — Concerns & complaints scope differs from ordinary requests, feedback and incident reporting. (WF47; incomplete / full criterion not verified).
- [ ] **S27.02** — Unlinked/minor eligible submitter has confidential policy-approved route without inherited guardian disclosure. (WF47; incomplete / full criterion not verified).
- [ ] **S27.03** — Actual category/sensitivity/urgency configuration requires qualified independent owner before live use. (WF47; incomplete / full criterion not verified).
- [ ] **S27.04** — Submission explains reviewer confidentiality/anonymity technical limits and real immediate-contact availability. (WF47; incomplete / full criterion not verified).
- [ ] **S27.05** — Submitter sees eligible independent reviewer descriptions, not private staff directory. (WF47; incomplete / full criterion not verified).
- [ ] **S27.06** — All-conflicted/senior-cleric allegation routes to real independent authority rather than implicated hierarchy. (WF47; incomplete / full criterion not verified).
- [ ] **S27.07** — Unselected administrators see neither contents nor counts; Review/ViewSensitive/ViewIdentity are distinct. (WF47; focal boundary tested; complete question open).
  Focal evidence: `AccessAndRecoveryTests.Anonymous_sensitive_concern_has_no_admin_count_and_confidential_identity_requires_separate_grant`.
- [ ] **S27.08** — Assignment acceptance/reassignment checks conflict/scope without broadening case audience. (WF47; incomplete / full criterion not verified).
- [ ] **S27.09** — Actual owner/status/response targets and reopen/closure do not invent a universal service deadline. (WF47; incomplete / full criterion not verified).
- [ ] **S27.10** — Reviewer-only note and submitter reply are fixed visibly different audiences before send. (WF47; incomplete / full criterion not verified).
- [ ] **S27.11** — Later identity disclosure/hiding is informed and cannot undo prior authorized knowledge. (WF47; incomplete / full criterion not verified).
- [ ] **S27.12** — Evidence/export/redaction has exact purpose/reviewer/audit rather than ordinary general export. (WF47; incomplete / full criterion not verified).
- [ ] **S27.13** — Shared-device notifications contain no allegation/category/name or unrelated case existence. (WF47; incomplete / full criterion not verified).
- [ ] **S27.14** — Parish departure/account/reviewer changes preserve permitted tracking and independent case continuity. (WF47; incomplete / full criterion not verified).

## S28

Implemented portion: Author-only notes UI; service-level explicit named/current-priests sharing with no administrative inheritance.

Code: [src/ParishLive.Infrastructure/Operations/PrivateWorkService.cs](../../src/ParishLive.Infrastructure/Operations/PrivateWorkService.cs), [src/ParishLive.Web/Pages/Private](../../src/ParishLive.Web/Pages/Private)

Remaining software: Task assignment/share UI, departure archive, dates/reminders/complete/reopen, group/office task scopes and versioned workflow builder/run engine.

Real-world inputs: U08, U10, U13 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S28.01** — Personal, pastoral, group and office task labels each show actual audience before saving. (WF48, WF49, WF63; incomplete / full criterion not verified).
- [ ] **S28.02** — Successor/bishop/admin cannot inherit private pastoral note; departed-author archive remains proposed restricted own snapshot. (WF48, WF49, WF63; incomplete / full criterion not verified).
- [ ] **S28.03** — Current-priests sharing warns about future appointees and withdrawal only stops future access. (WF48, WF49, WF63; incomplete / full criterion not verified).
- [ ] **S28.04** — Task cannot be assigned to someone unable to see it; share confirmation covers that task only. (WF48, WF49, WF63; incomplete / full criterion not verified).
- [ ] **S28.05** — Task dates/recurrence/reminders do not claim timed execution without actual service. (WF48, WF49, WF63; incomplete / full criterion not verified).
- [ ] **S28.06** — Complete/reopen/archive/delete has privacy-appropriate preserved history and approved retention dependency. (WF48, WF49, WF63; incomplete / full criterion not verified).
- [ ] **S28.07** — Actual builder examples cover event proposal, repair and purchase without weakening hard-coded approvals. (WF48, WF49, WF63; incomplete / full criterion not verified).
- [ ] **S28.08** — Template definition/publish/start/step/answer access require separate scoped eligible roles. (WF48, WF49, WF63; incomplete / full criterion not verified).
- [ ] **S28.09** — Conditional/parallel step validation prevents unreachable task or unauthorized religious/financial power. (WF48, WF49, WF63; incomplete / full criterion not verified).
- [ ] **S28.10** — Runs pin published version and pause-new versus safety-stop effects are explicit. (WF48, WF49, WF63; incomplete / full criterion not verified).
- [ ] **S28.11** — Detail shows real completed actors/times/current owner and final step closes only after real result commit. (WF48, WF49, WF63; incomplete / full criterion not verified).
- [ ] **S28.12** — Cancel/undo/reopen/transfer reviews dependencies and never erases committed official/money effects. (WF48, WF49, WF63; incomplete / full criterion not verified).

## S29

Implemented portion: System/diocese/parish administrative hierarchy, controlled initial administrator, exact account lookup, explicit grants, valid parish activation without secretary, status changes, protected appointment review and readiness.

Code: [src/ParishLive.Infrastructure/Operations/AdministrationService.cs](../../src/ParishLive.Infrastructure/Operations/AdministrationService.cs), [src/ParishLive.Web/Pages/Administration](../../src/ParishLive.Web/Pages/Administration), [src/ParishLive.Web/Pages/Readiness](../../src/ParishLive.Web/Pages/Readiness)

Remaining software: Complete high-impact change protection, title changes, module bundles/sponsorship/downgrade completion gates, operational settings, diocesan reports, complete exports and integration configuration.

Real-world inputs: U01, U10, U12, U15 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S29.01** — Management system/diocese/parish scope is visibly distinct from operational working parish filter. (WF38, WF39, WF40; incomplete / full criterion not verified).
- [ ] **S29.02** — Staff invitation uses individual controlled credentials and normal account can receive actual scoped appointment. (WF38, WF39, WF40; incomplete / full criterion not verified).
- [ ] **S29.03** — Exact audited username lookup/invitation avoids global email/name enumeration. (WF38, WF39, WF40; incomplete / full criterion not verified).
- [ ] **S29.04** — Account identity/local person/clergy title/appointment panels remain distinct and effective dates visible. (WF38, WF39, WF40; incomplete / full criterion not verified).
- [ ] **S29.05** — Several or no secretaries works; removal previews pending work and does not delete accounts. (WF38, WF39, WF40; incomplete / full criterion not verified).
- [ ] **S29.06** — Appointment/parish/global deactivation have explicit different scope/impact/recovery and no private work inheritance. (WF38, WF39, WF40; incomplete / full criterion not verified).
- [ ] **S29.07** — Title change checks real clergy authority and active incompatible priest assignments before demotion. (WF38, WF39, WF40; incomplete / full criterion not verified).
- [ ] **S29.08** — Administration versus local settings is authoritative once; legacy security/permission toggles cannot contradict policy. (WF38, WF39, WF40; incomplete / full criterion not verified).
- [ ] **S29.09** — Presence/Office/Community/Complete map exact real module families and public/member gates with no invented record limits. (WF38, WF39, WF40; incomplete / full criterion not verified).
- [ ] **S29.10** — Sponsored change follows actual diocesan approver; parish priest authority cannot silently alter sponsor arrangement. (WF38, WF39, WF40; incomplete / full criterion not verified).
- [ ] **S29.11** — Manual bundle baseline invents no prices/trials/invoices/renewals/automatic charges. (WF38, WF39, WF40; incomplete / full criterion not verified).
- [ ] **S29.12** — Downgrade retains permitted history/export and eligible existing completion while blocking defined new work. (WF38, WF39, WF40; incomplete / full criterion not verified).
- [ ] **S29.13** — Unavailable new public/member forms show real office route but existing tracking remains permitted. (WF38, WF39, WF40; incomplete / full criterion not verified).
- [ ] **S29.14** — Bishop overview has actual period/coverage/drill permission and no simplistic unjustified parish ranking. (WF38, WF39, WF40; incomplete / full criterion not verified).
- [ ] **S29.15** — Each report supports actual decision with explicit formula/status/source/denominator and no double counting. (WF38, WF39, WF40; incomplete / full criterion not verified).
- [ ] **S29.16** — Export states selected/all-matching scope, language/date/currency/format and does not silently limit page. (WF38, WF39, WF40; incomplete / full criterion not verified).
- [ ] **S29.17** — General/admin/restricted audit scopes retain actual actor/reason and exclude secrets/private message/case bodies. (WF38, WF39, WF40; incomplete / full criterion not verified).
- [ ] **S29.18** — Integration/API/webhook/AI settings show genuine configured/unavailable/error state and no credential/data disclosure by decorative toggle. (WF38, WF39, WF40; incomplete / full criterion not verified).

## S30

Implemented portion: EN/FR/AR shell/new screens/errors/messages, logical direction, mixed-script isolation, keyboard focus/skip link, responsive forms, personal theme and save/discard/stay language switching.

Code: [src/ParishLive.Web/Resources](../../src/ParishLive.Web/Resources), [src/ParishLive.Web/wwwroot/css/operations.css](../../src/ParishLive.Web/wwwroot/css/operations.css), [src/ParishLive.Web/wwwroot/js/operations.js](../../src/ParishLive.Web/wwwroot/js/operations.js)

Remaining software: Complete legacy Identity/content localization, dense-role screen redesign, full error association/comparison, zoom/contrast/reduced-motion/screen-reader and actual printer validation, approved template typography.

Real-world inputs: U05, U14 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S30.01** — Named crowded/confusing screens are linked to concrete redesign decisions while useful existing identity remains. (WF01, WF32; incomplete / full criterion not verified).
- [ ] **S30.02** — Public welcoming/practical and staff calm/dense designs share consistent identity/language/controls. (WF01, WF32; incomplete / full criterion not verified).
- [ ] **S30.03** — Real logos/seals/typography approvals remain required and no guessed official seal appears. (WF01, WF32; incomplete / full criterion not verified).
- [ ] **S30.04** — Comfortable/compact/larger-text density preserves meaning and no critical mobile field disappears. (WF01, WF32; incomplete / full criterion not verified).
- [ ] **S30.05** — Personal palette/dark choices preserve readable text/focus/status and offer safe reset. (WF01, WF32; incomplete / full criterion not verified).
- [ ] **S30.06** — Full-page complex records versus short-edit drawer versus focused confirmation choice is consistent. (WF01, WF32; incomplete / full criterion not verified).
- [ ] **S30.07** — One outcome-named primary action with visible Save/Cancel/Back prevents accidental approval. (WF01, WF32; incomplete / full criterion not verified).
- [ ] **S30.08** — Consequential confirmation previews exact scope/effect; Undo applies only genuinely reversible low-impact actions. (WF01, WF32; incomplete / full criterion not verified).
- [ ] **S30.09** — Required/optional/conditional fields and progress preserve values through validation and language switch. (WF01, WF32; incomplete / full criterion not verified).
- [ ] **S30.10** — Linked field errors plus summary/focus and persistent actual success/partial-failure history are accessible. (WF01, WF32; incomplete / full criterion not verified).
- [ ] **S30.11** — Language change preserves target/draft/files/filter state and supplied original names remain unchanged. (WF01, WF32; incomplete / full criterion not verified).
- [ ] **S30.12** — Screens/print/interchange define digit/date/time/USD-LBP conventions without ambiguous conversion. (WF01, WF32; incomplete / full criterion not verified).
- [ ] **S30.13** — Arabic mixed-direction identifiers/contacts/amounts are isolated and meaningful navigation mirrors appropriately. (WF01, WF32; incomplete / full criterion not verified).
- [ ] **S30.14** — Named ordinary/domain language reviewers approve glossary/help/errors and missing translations remain explicit. (WF01, WF32; incomplete / full criterion not verified).
- [ ] **S30.15** — French remains required launch scope with actual unfinished coverage identified rather than silently deferred. (WF01, WF32; incomplete / full criterion not verified).
- [ ] **S30.16** — Every essential task has keyboard/screen-reader and nonvisual/non-drag alternative. (WF01, WF32; incomplete / full criterion not verified).
- [ ] **S30.17** — Actual prototype/device contrast/zoom/focus/touch/reduced-motion validation remains explicit unperformed work. (WF01, WF32; incomplete / full criterion not verified).
- [ ] **S30.18** — Phone cards preserve reference/parish/status/actor/date/money while matrices offer list alternatives. (WF01, WF32; incomplete / full criterion not verified).
- [ ] **S30.19** — Official EN/FR/AR/mixed-script print handles long names/page breaks/optional blanks under approved template. (WF01, WF32; incomplete / full criterion not verified).
- [ ] **S30.20** — Every main screen has loading/empty/no-match/denied/unconfigured/conflict/failure/success and meaningful next action. (WF01, WF32; incomplete / full criterion not verified).

## S31

Implemented portion: Actor-bound operation receipts, payload mismatch rejection, transactional retries, version concurrency, immutable official/money facts, server draft resume, uncertain-save status and no private local form storage.

Code: [src/ParishLive.Infrastructure/Data/OperationRunner.cs](../../src/ParishLive.Infrastructure/Data/OperationRunner.cs), [src/ParishLive.Infrastructure/Data/AppDbContext.cs](../../src/ParishLive.Infrastructure/Data/AppDbContext.cs), [src/ParishLive.Web/Pages/Recovery](../../src/ParishLive.Web/Pages/Recovery), [src/ParishLive.Web/wwwroot/js/operations.js](../../src/ParishLive.Web/wwwroot/js/operations.js)

Remaining software: Full original/submitted/current comparisons, all workflow recovery states, non-language context-switch draft dialog, bulk partial outcomes, approved undo/trash and operator backup/restore evidence.

Real-world inputs: U08, U10, U15 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S31.01** — Save-now, autosave-draft and explicit Save are consistently assigned without autosubmitting draft approvals. (WF22, WF34, WF64; incomplete / full criterion not verified).
- [ ] **S31.02** — Unsaved/saving/saved/failed/conflict feedback reflects actual persistence and unresolved error stays visible. (WF22, WF34, WF64; incomplete / full criterion not verified).
- [ ] **S31.03** — Only permitted server drafts resume across devices; sensitive shared-device local recovery is session-limited. (WF22, WF34, WF64; incomplete / full criterion not verified).
- [ ] **S31.04** — Back/Close/switch/logout offers only genuinely supported Save draft/Discard/Stay with safe destination. (WF22, WF34, WF64; incomplete / full criterion not verified).
- [ ] **S31.05** — Offline baseline permits only marked already-loaded reference/nonsensitive draft, no authoritative transactional write. (WF22, WF34, WF64; incomplete / full criterion not verified).
- [ ] **S31.06** — Connection-required message distinguishes unconfirmed from failed and gives status-check/manual recovery. (WF22, WF34, WF64; incomplete / full criterion not verified).
- [ ] **S31.07** — Future offline-write extension remains unapproved and would require full current permission/duplicate/availability revalidation. (WF22, WF34, WF64; incomplete / full criterion not verified).
- [ ] **S31.08** — Concurrency compares original/submitted/current while preserving permitted draft and immutable official facts. (WF22, WF34, WF64; incomplete / full criterion not verified).
- [ ] **S31.09** — Lost successful response retry queries stable operation and cannot duplicate money/request/arrival/approval. (WF22, WF34, WF64; focal boundary tested; complete question open).
  Focal evidence: `ReviewedRequirementsTests.Reusing_operation_id_with_a_changed_payload_is_refused`.
- [ ] **S31.10** — Saved record with failed file/notice retries failed component alone and retains persistent partial result. (WF22, WF34, WF64; incomplete / full criterion not verified).
- [ ] **S31.11** — Revoked role/module/archived person during edit rechecks current action and preserves no unauthorized recovery copy. (WF22, WF34, WF64; incomplete / full criterion not verified).
- [ ] **S31.12** — Timeout/error/maintenance feedback gives safe next action/nonsecret support reference, never stack/private data. (WF22, WF34, WF64; incomplete / full criterion not verified).
- [ ] **S31.13** — Changed queues/availability/check-in/balances refresh without overwriting active form and final action rechecks. (WF22, WF34, WF64; incomplete / full criterion not verified).
- [ ] **S31.14** — Bulk preview/progress/item outcomes distinguish successful versus retriable and cancellation affects only unprocessed work. (WF22, WF34, WF64; incomplete / full criterion not verified).
- [ ] **S31.15** — Undo/trash proposals exclude issued disclosures/official/posted facts and explain formal correction limits. (WF22, WF34, WF64; incomplete / full criterion not verified).
- [ ] **S31.16** — Browser Data snapshot remains distinct from actual operator-controlled backup with restore evidence. (WF22, WF34, WF64; incomplete / full criterion not verified).

## S32

Implemented portion: Configuration gates, explicit unavailable providers/manual routes, nonsecret error reference, requirements inventory and honest test/scenario report.

Code: [src/ParishLive.Web/Pages/Readiness](../../src/ParishLive.Web/Pages/Readiness), [docs/implementation](../../docs/implementation)

Remaining software: Retention holds/policies, own-data request/closure workflows, role help/onboarding, named real-world reviewers, release acceptance and restore drill.

Real-world inputs: U08, U14, U15 — see [open inputs](../ux-discovery/reviewed-answers/open-inputs-and-conflicts.md).

- [ ] **S32.01** — Every record class has competent retention approver and unknown real durations/holds remain explicit dependency. (WF50, WF39, WF64; incomplete / full criterion not verified).
- [ ] **S32.02** — Own-data access/correction/closure/deletion verifies requester and explains retained official/third-party records. (WF50, WF39, WF64; incomplete / full criterion not verified).
- [ ] **S32.03** — Deletion/deactivation review previews linked minors/household/work/finance/message/shared-record consequences. (WF50, WF39, WF64; incomplete / full criterion not verified).
- [ ] **S32.04** — Export purpose/field/scope/recipient preview excludes unrelated private data and explains handling. (WF50, WF39, WF64; incomplete / full criterion not verified).
- [ ] **S32.05** — Member/guest/office/admin help routes to real responsible role with sanitized support evidence. (WF50, WF39, WF64; incomplete / full criterion not verified).
- [ ] **S32.06** — First-use setup covers minimum activation plus actual requirements/public info/resources/finance/migration readiness. (WF50, WF39, WF64; incomplete / full criterion not verified).
- [ ] **S32.07** — Role-specific EN/FR/AR task help uses fictional examples and links actual procedure explanation. (WF50, WF39, WF64; incomplete / full criterion not verified).
- [ ] **S32.08** — Readiness shows unconfigured services/missing translations/legacy review without fabricated all-green launch. (WF50, WF39, WF64; incomplete / full criterion not verified).
- [ ] **S32.09** — Actual named role reviewers from both parishes are requested and no fictional test approval is recorded. (WF50, WF39, WF64; incomplete / full criterion not verified).
- [ ] **S32.10** — Uncoached task targets and zero-tolerance authority/privacy/pickup/money blockers are explicit proposals. (WF50, WF39, WF64; incomplete / full criterion not verified).
- [ ] **S32.11** — Small-phone/laptop/tablet/Arabic/keyboard/screen-reader/actual printer validation remains required evidence. (WF50, WF39, WF64; incomplete / full criterion not verified).
- [ ] **S32.12** — Developers retain product release authority while competent domain owners resolve rules and critical blockers. (WF50, WF39, WF64; incomplete / full criterion not verified).
- [ ] **S32.13** — Deferred choices need actual owner/date/milestone/fallback and cannot silently remove retained modules. (WF50, WF39, WF64; incomplete / full criterion not verified).
- [ ] **S32.14** — Workflow change versions all affected specs/prototypes/permissions/messages/prints before approved implementation. (WF50, WF39, WF64; incomplete / full criterion not verified).
