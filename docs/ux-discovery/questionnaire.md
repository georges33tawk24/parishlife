# ParishLife — complete UI/UX discovery questionnaire

Prepared 27 October 2026. Read with [the project review](project-review.md) and record answers in [the decision register](decision-register.md).

**Coverage: 436 numbered questions in 32 sections, followed by 30 cross-role scenario walkthroughs.**

The questions cover existing features, unresolved choices, exceptions and potential missing workflows. A question does not mean that its proposed feature must be built. Answer **keep**, **change**, **later**, **remove**, or **not applicable**, with the desired behavior. Existing behavior still needs confirmation. No answer has been assumed.

This is a comprehensive first-pass question bank grounded in this checkout. Follow-up questions will be needed where answers conflict or introduce new requirements; no finite list can honestly cover every future situation.

## How to use the bank

Answer by ID, in rounds. Start with S01; later sections depend on those decisions. Give the actual parish procedure when one exists. Use a fictional example for complex cases. Name the person who must approve ecclesiastical, financial, privacy or safeguarding rules. If a section is excluded from release, still answer its visibility, historical-data and in-progress-work questions.

### Complete this workflow card for every retained journey

Use it for signup/recovery, parish and ministry membership, profile correction, each request type, each sacrament, certificate/release, event registration/refund/check-in/pickup, reservation/maintenance/loan, giving/expense/reconciliation, publication/message, concern review, administrative appointment and custom workflow.

| Decision | Answer required for that journey |
| --- | --- |
| Entry and trigger | Who starts it, from which screen, and under what eligibility conditions? |
| Data | What is entered, prefilled, required, verified, attached or obtained later? |
| Lifecycle | List every state in order, including draft, waiting, returned, declined, cancelled, expired and complete where applicable. |
| Transitions | For every state change: actor, permitted scope, action label, prerequisite, confirmation and resulting state. |
| Visibility | What can applicant, office, priest, bishop, leader, guardian, reviewer and other roles see at each stage? |
| Ownership and time | Who is responsible now; deadline; reminder; escalation; absence/delegation procedure? |
| Corrections and exceptions | Edit, resubmit, duplicate, withdraw, cancel, reopen, undo, wrong parish, changed access, failed save and conflicting edits. |
| Communication | Trigger, recipient, text, language, channel, privacy, timing and delivery-failure behavior. |
| End result | What proves completion, which related records change, and what remains visible/printable/exportable? |
| Acceptance | One normal case, one refusal/cancellation, one correction, one permission boundary and one interruption case. |

### Complete this field card for each retained form

For each field specify: label in English/Arabic; purpose; source/prefill; required/optional/conditional; allowed values; examples; unknown/not-applicable handling; validation/error text; who can view/edit; whether it becomes locked; where changes are audited; and whether it appears in search, notifications, print or export. Cover signup, person, household, membership, each request/sacrament, certificate, booking, registration, payment, consent, incident, concern, financial transaction, publication and appointment forms.

### Approve one notification row per meaningful transition

`Trigger → recipient(s) → sender identity → subject/body → language → channel → action/deep link → send time → preference/mandatory rule → private data allowed → duplicate/failure handling`.

## S01 — Purpose, release scope and decision owners

**Current basis:** the repository already contains public, community, office, finance and diocesan workflows. Their presence does not establish that all belong in the first release.

- **S01.01** What is the first operating scope: one parish, one archdiocese with several parishes, or several independent dioceses? Name the intended first setting.
- **S01.02** Which three problems must the first release solve well enough that parishes will use it regularly?
- **S01.03** Who is the primary daily user, and what are that person's five most frequent tasks today?
- **S01.04** Which other users must be served at launch, and how often will each use the system?
- **S01.05** For every module in the project-review inventory, choose first release, later, or remove. Which existing modules are essential to keep exactly as they operate now?
- **S01.06** Which real procedures must remain on paper or happen in person, even when the system records their progress?
- **S01.07** Which church rites, ecclesiastical structures and sacramental practices must launch support? Which visible options should be excluded?
- **S01.08** Where and on what devices will people work: parish-office computers, shared desktops, personal phones, tablets at events, or elsewhere?
- **S01.09** What languages must be complete at launch for the interface, user content and official documents separately?
- **S01.10** Who has final authority to approve product design, parish-office workflow, clergy rules, financial controls and sensitive-data access? Assign each area an owner.
- **S01.11** What operating scale must the design accommodate: parishes, people per parish, staff, active requests, simultaneous event check-ins and historic records?
- **S01.12** What concrete outcomes will establish that the UI/UX is ready for implementation, and which representative users will validate them?

## S02 — Organizational structure, roles and authority

**Current basis:** scoped grants distinguish Super Admin, bishop, Archdiocese Admin, priest, Parish Admin, secretary, treasurer, leader and finance viewer. Reviewer and clergy-assignment capabilities can be separately granted.

- **S02.01** Are those role names and their English/Arabic labels correct for your actual organization? Define any missing role by its duties rather than its title alone.
- **S02.02** Who establishes a diocese and appoints its first bishop in the intended onboarding process? The current appointment policy does not expose bishop appointment as an ordinary assign-access option.
- **S02.03** What information and approvals are required to create a parish, and when should it become publicly visible and operational?
- **S02.04** Can a parish have multiple priests, secretaries, treasurers and administrators, and does each group need a designated lead?
- **S02.05** When one account has several roles in one parish, should permissions combine automatically, or should the user explicitly enter a role/workspace?
- **S02.06** When roles differ between parishes, what must the header and action confirmations show to make the active authority unmistakable?
- **S02.07** Approve a matrix for viewing, creating, editing, approving, signing, releasing, exporting and archiving each record type. Where must administrative authority stop short of clergy authority?
- **S02.08** Which exact office duties may Parish Admins and higher administrators perform when there is no secretary? Guest document controls need to agree with this policy.
- **S02.09** Which duties may a priest delegate, to whom, for what period and with what visible notice? Which actions must remain personal to that priest?
- **S02.10** When someone is absent, transferred, retired, suspended or deceased, who handles their pending approvals and assigned work?
- **S02.11** What should happen to open forms and pending actions when access is revoked during a session? What explanation and safe destination should the user receive?
- **S02.12** Should appointments have start/end dates, invitation acceptance or periodic review? What should upcoming expiry look like to the appointee and administrator?
- **S02.13** Which administrative changes need a reason, a second approver or current-password confirmation, and how should the confirmation describe its exact effect?
- **S02.14** How should a user request missing access or challenge an incorrect appointment without seeing unauthorized records or other people's account details?

## S03 — Navigation, dashboard, search and work queues

**Current basis:** role-specific desktop/mobile navigation, Dashboard, My parish life, member Home, My account and My profile coexist. Requests counts are calculated in more than one place.

- **S03.01** What should be the first screen after login for each role, including an account with no parish, a follower without membership and an unassigned priest?
- **S03.02** Should staff enter their work tools and personal parish life through one switch, separate destinations, or one combined home? Confirm the current exclusion of secretary personal member routes.
- **S03.03** Which sections should appear in each role's main navigation, and which should be reachable only from a related record or a More menu?
- **S03.04** Which labels need changing to match users' language: People/Parishioners, Groups/Ministries, Member portal/Website content, Eparchy/Archdiocese, Services & Activities, or others?
- **S03.05** What should the parish selector show: assigned parishes, followed parishes, all accessible parishes, primary parish and/or a combined view?
- **S03.06** What should persist after switching parish or workspace: current page, filters, selected date, open draft and last-used view? What must reset?
- **S03.07** For each dashboard, choose the information and actions that deserve the first visible screen. Which numbers need definitions, date periods and drill-down destinations?
- **S03.08** Should actionable work appear in one personal queue across request types, or in separate role/module queues? Distinguish “needs me,” “needs office,” and “waiting on applicant.”
- **S03.09** What exactly should each navigation badge count? Resolve whether it includes guest requests, membership, corrections, waitlists, bishop review and work someone else must perform.
- **S03.10** What should global search find for each role, and which fields may results expose? Include names in either script, phone, household, request reference, register number and pages/actions.
- **S03.11** What should selecting a search result open: a page, drawer or relevant tab? How should users return to the same result position and filters?
- **S03.12** Which tables need saved filters, sort, column choices, page-size choices, bulk actions and selected-versus-all-matching selection?
- **S03.13** On a phone, which actions and fields must remain immediately visible when desktop tables become cards or hide columns? Which tasks need a dedicated full-screen flow?
- **S03.14** When a direct link points to a moved, archived, removed or unauthorized record, what should the user see and where should they be able to go next?

## S04 — Public directory, parish pages and visitor discovery

**Current basis:** the public site has a bilingual directory, filters, nearby search, illustrative images, map preview, parish pages and separate request/calendar views.

- **S04.01** What is the public homepage's main job: finding a parish, finding Mass times, making a request, or explaining ParishLife? Rank the primary actions.
- **S04.02** Which directory filters and sort choices are essential, and should visitors find Masses by day, time and language across parishes rather than only opening parish profiles?
- **S04.03** Which details must a parish card show before a visitor opens it, including office availability or whether online requests are accepted?
- **S04.04** Is the map preview useful at launch, or should it be hidden until a live map is available? What must happen when location access is refused or coordinates are missing?
- **S04.05** What must every parish profile contain, and in what order should story, visiting information, times, clergy, ministries, events, requests, updates and contacts appear?
- **S04.06** Should missing parish information be hidden, shown as awaiting publication, or replaced with a specific contact action? Which missing fields should prevent publication?
- **S04.07** Should illustrative photographs remain on named parish pages until verified parish images exist? Approve the wording and placement of the illustration label.
- **S04.08** Which clergy/leader names and contact details may be public, and who confirms their publication? Should contact always route through the parish office?
- **S04.09** Should public calendar titles include family names for baptisms, weddings and funerals? Define default visibility and who authorizes exceptions.
- **S04.10** Which guest request types should be discoverable from parish pages? The public form also contains appointment and ministry options beyond the main request cards.
- **S04.11** Should urgent needs such as a funeral or sick visit offer a clearly visible office/emergency contact route alongside online submission? Who maintains that contact and its availability?
- **S04.12** What should shareable parish/event URLs, visitor language choice and return-to-results behavior preserve? Should the separate landing/marketing page remain part of the product?

## S05 — Website content, announcements and publishing

**Current basis:** Website content and public parish profile editing are separate. Existing documentation says saving a section as draft removes that section from the public page.

- **S05.01** Who may edit public content, who may publish it, and should clergy or another reviewer approve particular types before publication?
- **S05.02** Should public profile details and website sections be managed together, or should their different ownership remain visible as separate editors?
- **S05.03** When editing published content, should Save draft retain the currently published version? Confirm or replace the current behavior that unpublishes a section.
- **S05.04** Which publishing states are needed: draft, awaiting approval, scheduled, published, expired, returned and archived? Who moves between them?
- **S05.05** Is publishing allowed with only one language complete? If so, what should visitors and editors see when the other translation is missing?
- **S05.06** Must editors preview the exact public page on phone and desktop before publishing, including language fallback and private/public visibility?
- **S05.07** Which content should support rich text, links, files, galleries and captions? Who provides image descriptions and confirms permission to use photographs of people?
- **S05.08** Should Mass/confession/office times be structured schedules with exceptions or free text? Who keeps holiday changes consistent with the calendar?
- **S05.09** Do announcements need pinning, expiry, categories, audiences, attachments and scheduled publication? Which should appear on both public and member pages?
- **S05.10** Should each parish be allowed to change public branding/layout, or should the current shared public theme remain uniform while dashboard colors stay personal?
- **S05.11** What should happen when two editors change the same section: compare versions, keep a recoverable draft, request refresh, or assign an editor lock?
- **S05.12** Who can see publication history, revert a mistake and remove an accidentally published private item? What should be retained in the audit record?

## S06 — Sign-up, sign-in, invitations and recovery

**Current basis:** sign-up is available at age 13+, uses first/last name and email and/or phone, and does not create a parish person. Sign-in selects Username/Email/Phone. Provider login and verification are unavailable.

- **S06.01** Confirm who may create their own account and the minimum age. What is the intended account model for younger children and adults who cannot manage their own login?
- **S06.02** Which signup fields are essential immediately, and should Arabic name, address, parish and other profile details remain for later?
- **S06.03** Should new users sign in primarily with email, phone or username? Is selecting the identifier type desirable, or should one field recognize it with clear errors?
- **S06.04** How should signup explain a phone/email already in use, shared family contacts and possible existing office records without exposing another person's account?
- **S06.05** Must a contact be verified before login, submitting a request, linking a parish record or holding a staff role? What happens when verification is unavailable or a code does not arrive?
- **S06.06** Which external sign-in providers and MFA, if any, belong in launch? Until then should unavailable provider buttons be hidden or visibly disabled with an explanation?
- **S06.07** What password guidance, visibility toggle, password-manager behavior and validation feedback should members and staff receive? Should the experience differ by privilege?
- **S06.08** What should Forgot password do for a member, a privileged staff account and an account with no usable verified contact? Define identity review and who may help.
- **S06.09** Should office-created people receive invitations, through which real channel, and what should the recipient see before accepting the person link?
- **S06.10** Confirm the invitation expiry and one-use rule. What should expired, already-used, revoked and wrong-person invitations offer as a recovery action?
- **S06.11** How may a user change or remove a login email/phone, recover a lost device, sign out other devices and detect an unfamiliar session?
- **S06.12** What should login rate limiting, disabled accounts, session expiry and shared-computer sign-out communicate? What draft work should survive reauthentication?

## S07 — Following, parish membership and profile corrections

**Current basis:** follow, primary parish, office-approved parish membership and ministry membership are separate. Account contact/profile information does not automatically edit official parish records.

- **S07.01** What can a follower see/do before parish membership is approved, and what should explain the benefit and meaning of formal membership?
- **S07.02** Can someone be a full member of several parishes simultaneously, and does primary parish affect eligibility, notifications, records or only defaults?
- **S07.03** What evidence must the office check to approve a membership link, and how should it document verification without keeping unnecessary private evidence?
- **S07.04** When no matching person exists, should membership review allow creating one inside the review flow rather than leaving the queue and returning later?
- **S07.05** How should the office compare several possible person matches, detect an existing account link and correct a link made to the wrong person?
- **S07.06** When membership is declined, should a reason be required and visible to the applicant? Can they correct information and reapply?
- **S07.07** How can a member leave a parish, unfollow it or change primary parish, and what happens to active requests, group roles and historic records?
- **S07.08** Should existing person invitations bypass any membership steps, or must the office approve every claim? What does an already signed-in recipient experience?
- **S07.09** Which official fields may a person propose correcting, and which require office-only handling or documentary proof?
- **S07.10** Should a correction be approved as one proposal or field by field? Can the office modify the proposed value, and must the applicant accept that change?
- **S07.11** While a correction waits, may the applicant withdraw or replace it? How should a staff edit to the same field be compared and resolved?
- **S07.12** How should My account, My profile and My parish records explain which information controls login, personal display, office contact and official certificates?

## S08 — People records and individual profiles

**Current basis:** the new-person drawer requires English and Arabic names and offers rite, phone, birth date, work, address, blood type, groups, photo and communication/directory choices.

- **S08.01** Which categories of person belong in People: parishioners, visitors, children, nonmembers, non-Catholic spouses, clergy, deceased people and outside witnesses? Define their statuses.
- **S08.02** What is the minimum information needed to save a person? Should a record be allowed when the Arabic/English name, birth date, phone or address is unknown?
- **S08.03** What name structure is needed for daily work and official documents: given/family names, parents' names, birth surname and title? Confirm that automatic transliteration and Preferred Name remain excluded.
- **S08.04** How should approximate/unknown dates, people without phones and international contacts be entered? Should Lebanese phone formatting ever reject an overseas person?
- **S08.05** Which address choices must be selectable, and what is the path for a town, sector or foreign address absent from the verified list?
- **S08.06** Is collecting blood type, medical/allergy information, skills and occupation necessary? For each, specify the purpose, permitted viewers and visibility in ordinary profiles.
- **S08.07** What must appear in the profile header and default tab, and which of Family, Groups, Sacraments, Attendance, Giving, Activity, Notes, Files and Consent should each role receive?
- **S08.08** When staff add someone to a group from a person form/profile, should this take immediate effect or go through leader/priest approval? Reconcile this with member-initiated applications.
- **S08.09** Which edits need a reason, supporting document or approval, and which fields become locked after use in an official entry?
- **S08.10** What photo capture/crop/replace/remove experience is required, including consent, missing images and a recognizable fallback?
- **S08.11** Which contact and directory consent choices are needed, what exact information do they cover, and who may record or withdraw consent on another person's behalf?
- **S08.12** When opening a profile, which related actions should be available directly: message, invitation, new request, certificate, registration, household edit or private note? Specify role restrictions.

## S09 — Households, family relationships and representation

**Current basis:** a person belongs to at most one household; existing people can be grouped, shared address/contact recorded, and a relationship diagram generated. Historic family/branch concepts and inter-parish transfers are not editable workflows.

- **S09.01** What defines a household for your parish: shared residence, family relationship, shared finances or another rule? How should extended families at different addresses be represented?
- **S09.02** Is one current household per person sufficient for separated parents, shared custody, students away from home and members living abroad?
- **S09.03** Is “household head” the right label, or should the interface use household contact? What authority, if any, does that designation confer?
- **S09.04** Which relationships must be represented, including step/adoptive parents, guardians, deceased relatives, siblings and unrelated residents? Which should remain private?
- **S09.05** How should users enter a relationship to a specific person and resolve missing, conflicting or circular relationships in the family diagram?
- **S09.06** When changing the household head/contact, should all relationships remain as currently documented, and what comparison should be shown before saving?
- **S09.07** Which address/contact fields are shared, and how should individual overrides and a household move affect each member's record?
- **S09.08** Can any household adult request a sacrament or certificate for another adult, or is explicit authorization needed? Household membership alone may not establish permission.
- **S09.09** What must a guardian see/manage for a child, and when should the child's own account take over those responsibilities?
- **S09.10** How should joining, splitting, merging or leaving households preserve previous relationships, consent, giving and open requests?
- **S09.11** Confirm the optional household envelope identifier: who assigns it, how uniqueness is checked, and what happens when the household splits or the identifier changes?
- **S09.12** What should household cards, the diagram, printed directory and selected/filtered exports include? Should restricted relationships or nonconsenting members be omitted from each?

## S10 — Import, duplicate review, archive and historical records

**Current basis:** People has Import and Duplicates; archives and legacy records exist. The project deliberately avoids automatic surname-based merging and has no inter-parish transfer interface.

- **S10.01** Which records must be brought in before launch, from which real formats and with what approximate volume? Include paper registers and previous spreadsheets if applicable.
- **S10.02** Who maps source columns, previews data, confirms import and resolves invalid rows? Should a partially valid file be imported in parts or rejected as a whole?
- **S10.03** How should import handle missing translations, unsupported localities, inconsistent dates, phone formats and consent that is absent or undocumented?
- **S10.04** What identifies a likely duplicate, and which facts should reviewers compare before concluding two records represent the same person?
- **S10.05** Who may merge records, and how should the UI resolve conflicting fields, household/group links, account links, sacramental entries and financial history?
- **S10.06** Must an incorrect merge be reversible? What should the pre-merge impact summary and subsequent history contain?
- **S10.07** Which person statuses require archiving rather than ordinary editing, and what should happen to accounts, rosters, pending requests and scheduled reminders?
- **S10.08** How can a permitted user find and restore archived people while avoiding duplicate recreation during signup, membership or child-request review?
- **S10.09** What should happen when someone relocates to another parish, given that the transfer workflow was removed? Confirm the intended office procedure and record visibility.
- **S10.10** How should historical sacraments entered after the fact differ from newly celebrated ones, including source evidence, original dates, celebrants and register numbering?
- **S10.11** Which legacy items need a visible “requires review/linking” state before use, such as unlinked event forms or older certificates? Who completes that work?
- **S10.12** What migration preview, reconciliation totals and approval are required before staff trust imported/historical data as official?

## S11 — Request intake, office queues and guest tracking

**Current basis:** member online requests can create office sacrament/certificate/reservation records. Guest requests use a separate form and queue. Membership and profile corrections have separate review screens.

- **S11.01** Which request types should exist at launch, and which should be structured forms versus a general “Ask the parish” request? Include appointments, ministry inquiries, Mass intentions and visits.
- **S11.02** Should guests and linked members provide the same core information for the same service? If guest intake stays simpler, who obtains the missing details and where are they entered?
- **S11.03** Can an unlinked account submit through its account rather than returning to the public guest form? What advantages or restrictions should that account receive?
- **S11.04** Who may submit for someone else, and how should relationship/authorization be confirmed? Include children outside the household, another adult, a deceased relative and an overseas requester.
- **S11.05** Should office staff enter telephone/in-person requests into the same intake flow, identifying their origin and requester, or create the office record directly?
- **S11.06** What should submission show before the final action: parish, subject, required documents, expected review time, fees, privacy and a reviewable summary?
- **S11.07** Should all request types share one reference, timeline and conversation from intake to completion, including guest-to-office conversion, or should linked references remain visible?
- **S11.08** What office triage information is needed: urgency, deadline, assigned person, missing information, last contact and current next action? Who may change each?
- **S11.09** How should the office request more information without declining the request? Can applicants edit fields, add documents or reply while it waits?
- **S11.10** What distinguishes received, accepted for processing, clergy-approved, scheduled, completed and ready for collection in the applicant's language?
- **S11.11** Until which stage can applicants edit or withdraw a request? After acceptance, should they request cancellation/rescheduling, contact the office, or perform a direct action?
- **S11.12** Which decisions require applicant-visible reasons, and how should internal staff notes be visually separated so they cannot be accidentally sent?
- **S11.13** How should duplicate submissions, wrong-parish requests and an office acceptance made in error be handled without losing the request history?
- **S11.14** What should the guest success/tracking page show, and how can a guest recover a lost link, revoke a leaked link, receive updates and later link the request to an account?
- **S11.15** Who owns overdue or unattended requests, what review times can the interface honestly promise, and how should applicants and staff escalate a delay?

## S12 — Sacramental lifecycle and official register approval

**Current basis:** optional office review precedes priest acceptance, preparation, celebration and official entry approval. The priest can accept directly. Official register approval and certificate issuance are separate actions.

- **S12.01** Confirm the exact lifecycle for each sacrament, including whether office review is optional and whether a priest can bypass it without a separate explanation.
- **S12.02** What should priest acceptance mean operationally: permission to start preparation, eligibility confirmed, date reserved, or a different commitment?
- **S12.03** Which preparation requirements are mandatory, which are optional, and who may configure or waive them? What should a waiver record and display?
- **S12.04** Must all required preparation be complete before selecting a date, before marking Scheduled, or only before celebration? Distinguish a tentative date from a confirmed date.
- **S12.05** Should date, time, church/room, celebrant and relevant family availability be checked together against calendar and clergy conflicts? Who can authorize an exception?
- **S12.06** How should a group celebration containing several people be entered, prepared and approved while preserving separate individual official entries?
- **S12.07** Who confirms that a celebration occurred, what facts must be checked, and what should happen for a no-show, changed celebrant or changed celebration time?
- **S12.08** What must a priest compare before approving an official entry, and can they return it for correction instead of rejecting the underlying request?
- **S12.09** Define official numbering: scope by parish/sacrament/year/book, when allocated, treatment of gaps, historical numbering and whether it may ever be changed.
- **S12.10** If an approved official entry contains an error, what is the authorized correction process? Confirm whether an in-app correction flow should return or remain an office procedure outside the current UI.
- **S12.11** How should cancellation, rejection and reopening work at each stage, especially after celebration or official registration? Which actions must be impossible?
- **S12.12** Approve the numbered progress timeline: finished/current/future steps, timestamps, waiting duration, planned date, responsible person/role and what each audience may see.
- **S12.13** Should Requests remain the main way to find official entries, or is a dedicated searchable register needed? Decide how book/page/year searches and complete register exports should work.

## S13 — Details and exceptions for each sacrament and service

**Current basis:** baptism, First Communion, confirmation/chrismation, marriage and funeral requests exist; requirements and rite handling need domain approval. These questions seek your procedure, not an assumed church policy.

- **S13.01** For baptism, which child/adult, birth, parent, guardian, godparent, address and eligibility details are required at intake, preparation and official entry respectively?
- **S13.02** When a baptism concerns an unregistered child, who may create/match their person record and choose the household? What should happen if an archived or ambiguous match exists?
- **S13.03** For adult baptism or a person with incomplete parental information, which fields and preparation differ, and how should the form avoid impossible required fields?
- **S13.04** For First Communion, what prior records, age/formation evidence and group preparation must be checked? Can applicants provide evidence from another parish?
- **S13.05** How should confirmation/chrismation vary by rite and its relationship to baptism? Which terminology, separate records and request options should be shown?
- **S13.06** For marriage, what information is required for both partners, their parishes, witnesses, prior records and preparation? Can one partner be outside the local people database?
- **S13.07** Which marriage cases need a different approval route or outside authorization, and how should the UI identify that need without making the decision itself?
- **S13.08** For funerals, what deceased-person, family-contact, celebrant, location and timing information is essential, and which steps must support urgent handling?
- **S13.09** Should completing a funeral automatically mark a person deceased, or require a separate reviewed update? What should stop future invitations, commitments and inappropriate reminders?
- **S13.10** For Mass intentions, blessings, sick visits and appointments, which details should be structured, who receives them and what event/task should acceptance create?
- **S13.11** How should sacramental records from another parish or country be referenced and verified without treating an uploaded document as a new local celebration?
- **S13.12** Which requirements and official labels may vary by parish/diocese/rite, and who approves those variations before they affect forms or documents?
- **S13.13** Which fees, suggested offerings, exemptions or collection instructions apply to these requests, if any? Where should users see them without implying that payment establishes approval?

## S14 — Certificates, bishop review and collection

**Current basis:** certificates reference an official entry; priest signing now initiates bishop acceptance. Returned certificates retain a reason and can be resubmitted. Older issued certificates without bishop-review data remain usable.

- **S14.01** Which certificate types are required, and who will provide approved examples of their exact wording, layout, seal, signatures and required fields?
- **S14.02** Who may request each certificate and for what purposes? What authorization is needed when requester and subject differ?
- **S14.03** Confirm whether every newly signed certificate needs bishop acceptance, or only specified types/parishes/cases. Who has authority to approve that policy?
- **S14.04** Approve the visible statuses before and after priest signature, bishop review, return, resubmission, acceptance, release and collection. At what point may the UI say “issued” or “ready”?
- **S14.05** Where should a bishop find the review queue, what information/document preview must it contain, and are individual or bulk decisions permitted?
- **S14.06** When the bishop returns a certificate, who sees the reason, what can the priest edit, and what must a resubmission explain? Should the applicant see this loop or only a neutral progress message?
- **S14.07** How should the process continue during bishop/priest absence or reassignment? Are delegated signatures or acceptance ever allowed?
- **S14.08** Can a certificate request wait on a planned sacrament, and how should automatic source linking, cancellation of the sacrament and several possible source entries be explained?
- **S14.09** Which languages and name spellings may the requester choose, and who verifies translations? Resolve the current trilingual option against actual supported document templates.
- **S14.10** What makes a downloaded or printed certificate official: wet signature, electronic signature, seal, serial, verification URL/QR, or an explicitly nonofficial copy? Which launch formats should be available?
- **S14.11** Are certificates valid indefinitely or time-limited, and can copies be reprinted, replaced, revoked or corrected? What should distinguish a replacement from a new issuance?
- **S14.12** How should preexisting issued certificates be labeled and used when they lack the new bishop-review metadata? Is any retrospective review required?
- **S14.13** What must be verified at physical collection or secure download, including a representative collecting on someone's behalf? Who records receipt and when is the request complete?
- **S14.14** Should certificate requests support copy quantities, fees, payment status and delivery choice? What happens when payment or pickup remains outstanding after acceptance?

## S15 — Documents, evidence, attachments and file release

**Current basis:** office requirements accept uploads or paper/in-person receipt; closed requests retain read-only attachments. Guest release is separate and requires identity confirmation. Member and office file limits differ.

- **S15.01** For every request/preparation type, list required documents, optional evidence, who supplies each and the stage at which it becomes mandatory.
- **S15.02** Should applicants upload documents during submission, later from tracking, or only through the office? What should a guest who cannot upload be told to bring?
- **S15.03** What should distinguish file attached, paper received, verified, rejected/illegible, expired and waived? Is a receipt checkbox sufficient, or is verification a separate action?
- **S15.04** Which file types, size limits, number of files and page counts are appropriate for each surface? Confirm or change the current 1 MB member versus 10 MB office difference.
- **S15.05** Should phone users be able to photograph, rotate, crop, combine or compress documents? What preview must they see before sending?
- **S15.06** How should uploads show progress, cancellation, retry, unsupported type, oversized file and an interrupted connection without losing the rest of the form?
- **S15.07** Who may view, replace, download or remove a file, and must replacement retain the old version and a reason? What happens once a record is approved or closed?
- **S15.08** Should a document be reusable across related requests, or copied/linked only after review? How should staff tell whether a reused document is still valid?
- **S15.09** What must the release confirmation show to prevent sending the wrong person's document? Must it compare applicant, subject, certificate, file preview and intended access method?
- **S15.10** Can a released file be withdrawn, replaced or given an expiry? What should existing guest links and previously downloaded copies mean after withdrawal?
- **S15.11** What should the private tracking link itself reveal, should download require an additional verification step, and how should a leaked link be replaced?
- **S15.12** What file-view/release/download activity should be visible to staff and applicants, and what retention/deletion behavior applies when the parent request is cancelled or archived?

## S16 — Calendar, Mass times, clergy schedules and anniversaries

**Current basis:** calendar visibility distinguishes public, selected groups and office/clergy; Masses can have priest assignments. Public/member/bishop calendars use shared controls, while staff also have planning/template views.

- **S16.01** Which calendar event types exist, and which fields, icons, colors and default audiences distinguish Mass, sacrament, group meeting, parish activity and facility block?
- **S16.02** Which role may create/edit each event type, and who may publish an event publicly or invite a group?
- **S16.03** What should each audience see about a private event occupying a shared room/time: hidden entirely, busy interval, or limited title/location?
- **S16.04** Should recurring events support exceptions, cancellations and edits to one occurrence versus the series? How should changes affect bookings, registrations and volunteer assignments?
- **S16.05** What should happen when a room, priest, leader or required equipment is double-booked? Which conflicts block saving and which require a reason to override?
- **S16.06** When a sacrament, group meeting or service plan is dated elsewhere, should its calendar entry be created automatically? Which screen becomes the authoritative editor?
- **S16.07** Which calendar views and filters are needed for each audience, and what should the default view, week start and displayed hours be on phone versus desktop?
- **S16.08** Should parish times always display in the parish's time zone for overseas users, with an optional local equivalent? How should daylight-saving changes and cross-midnight events be labeled?
- **S16.09** Are 30-minute increments and the current facility hours sufficient, or do offices need precise, early, late or all-day scheduling?
- **S16.10** What must Print my schedule and Priest schedule include, omit and distinguish? May users export calendars or subscribe from their calendar app?
- **S16.11** Which feasts/liturgical calendars are supported, who approves their source and corrections, and should parish exceptions be possible?
- **S16.12** Which anniversaries should be shown to whom, how far ahead, and with what outreach action? What should happen for deceased people, private records and incomplete historic dates?
- **S16.13** When an event is changed or cancelled, which connected workflows must be updated and which participants need to explicitly acknowledge the change?

## S17 — Service/activity planning and music library

**Current basis:** service plans have explicit Save, timed items, total duration and templates; music has lyrics/chords/instrument notes/versions/rights and setlist-related use.

- **S17.01** What is a “service” versus a calendar event, sacrament request and ministry meeting in your users' vocabulary? Which should share one detail page?
- **S17.02** Who creates a plan, who edits it, who approves it and who may see it during the activity? Can different teams collaborate on one plan?
- **S17.03** Which plan information is mandatory: linked event, start/end, celebrant, room, team, participants, notes, readings and music?
- **S17.04** How should an order-of-service item specify start time, duration, person responsible and instructions? Should later times recalculate when an item changes?
- **S17.05** What should users see when the plan exceeds available time, has an unassigned role or conflicts with a related event?
- **S17.06** Which draft, saved, approved and completed states are needed, and what should happen when someone navigates away with an unsaved plan?
- **S17.07** Which parts of a template are copied, and which dates/people/rooms must be reviewed before reuse? Who can change a template already used by saved plans?
- **S17.08** Which outputs are required: clergy running sheet, volunteer assignments, printable program, musician setlist and participant version? Define private instructions excluded from each.
- **S17.09** Who owns the music library, and which metadata and search filters are needed for language, rite, season, key, instrumentation and usage rights?
- **S17.10** How should lyrics, chords, instrument notes, audio/video links and versions be reviewed, corrected and linked to a plan without altering past plans unexpectedly?
- **S17.11** Which music files or text may be downloaded, printed or projected, and who records the necessary permissions and attribution?
- **S17.12** If music/planning is deferred, which existing plans and resources must remain readable and what should replace their navigation/actions at launch?

## S18 — Ministries, leadership and membership applications

**Current basis:** group roster membership and leader access are separate. Join applications go through leader/priest review; priests may approve directly. Departure reasons are private to the applicant and priests.

- **S18.01** Are Groups and Ministries interchangeable in your parish, or do you need types such as committee, catechism class, choir and temporary event team?
- **S18.02** Who creates a group, assigns its leader/co-leaders, configures eligibility and approves its public listing?
- **S18.03** What must a prospective member see before applying: purpose, age range, schedule, location, leader contact, capacity, prerequisites and commitment expectations?
- **S18.04** Can followers apply before formal parish membership, or must they first be linked to a person? What should the blocked application offer as a next step?
- **S18.05** Confirm leader review followed by priest approval and the priest's direct-approval option. Are interviews, trial membership, guardian approval or group capacity decisions required?
- **S18.06** Can staff add a person directly to a roster, and under which authority? Must that person consent or receive an invitation before being treated as active?
- **S18.07** What should happen when a leader declines, is unavailable or has a conflict of interest? Who sees the reason, and can the applicant appeal or reapply?
- **S18.08** Confirm the private leave process. Does membership remain active while departure waits, and can the member stop attendance/notifications immediately?
- **S18.09** After a departure is approved, what neutral information may leaders see, and how are future meetings, assignments, resources and attendance access affected?
- **S18.10** What is the withdrawal rule before versus after leader approval, and what should the applicant see while withdrawal itself awaits approval?
- **S18.11** How should leadership handover, group merge/split and group closure preserve members, pending applications, files, tasks and history?
- **S18.12** What should each role see on a group page? Confirm the secretary's smaller Members & contacts / Meetings / Resources workspace and any needed additions.

## S19 — Meetings, attendance, formation and group resources

**Current basis:** group meeting attendance is a per-person/per-meeting matrix with former-member history. RSVP, formation, posts/files, resources/loans and group tasks also exist. Individual Mass attendance is excluded.

- **S19.01** Does creating/editing a group meeting also create/update the calendar event, or should meetings and calendar events remain separate with an explicit link?
- **S19.02** Which meeting information and materials should members receive, and when should it become visible to new or trial members?
- **S19.03** Are RSVPs required, optional or inappropriate for some groups? Who can see absence reasons, and what is the deadline for changing a reply?
- **S19.04** Which attendance states are needed: present, late, absent, excused, unknown and not expected? Should unrecorded attendance ever count as absence?
- **S19.05** Who records/corrects attendance, for how long after a meeting, and what evidence/reason/history is needed for changes?
- **S19.06** How should guests, newcomers, a participant joining midterm and former members appear in attendance sheets and summary calculations?
- **S19.07** What is the required attendance-import flow, including template, matching, date mapping, preview, invalid rows, duplicates and reversal of a wrong import?
- **S19.08** Which attendance figures should members, leaders, priests and bishops see, and what date range/denominator must each percentage explain?
- **S19.09** What does Formation mean for each group: courses, milestones, eligibility, completion or certificates? Who records evidence and signs off completion?
- **S19.10** Which resources are digital learning materials versus physical group belongings, and should the two use different labels and screens?
- **S19.11** How should resource access, loans, returns, missing items and ownership transfer behave when a member leaves or a leader changes?
- **S19.12** Which group tasks/notes are collaborative, which are private, and how should they remain distinct from personal member notes and confidential pastoral notes?

## S20 — Volunteers, commitments, rota and hours

**Current basis:** volunteer rota, sign-up sheets, volunteer records, workload/hours and member commitments exist. A volunteer uses a member account; the former volunteer-only login role is disabled.

- **S20.01** What makes someone a volunteer in this system: a roster flag, approved commitment, event assignment or separate reviewed volunteer record?
- **S20.02** Can nonmembers, visitors or minors volunteer, and what consent, training or screening must be recorded before assignment?
- **S20.03** Who defines teams, required positions, skills, dates, recurring slots and capacity for an opportunity?
- **S20.04** Should volunteers offer availability themselves, receive assignments, sign up for open places, or use all three? Which responses need leader confirmation?
- **S20.05** What should distinguish invited, offered, awaiting confirmation, confirmed, declined, cancelled and completed commitments in member and leader views?
- **S20.06** Which conflicts should block assignment: overlapping duties, unavailable times, missing prerequisites, excessive workload or duties in another parish?
- **S20.07** How should a volunteer decline, cancel late, request a swap or find a replacement? Who approves a replacement and receives notice?
- **S20.08** How should drag-and-drop assignments be performed on touch screens and by keyboard, with a clear non-drag alternative?
- **S20.09** Who records and approves actual hours, corrections and no-shows, and what purpose do the reports serve?
- **S20.10** How should sign-up sheets be shared publicly or privately, how much volunteer identity/contact information may they reveal, and what should remain available after an opportunity ends?

## S21 — Event registrations, consent, transport, fees and refunds

**Current basis:** forms must link to eligible non-Mass events. Place status, consent, transport choice and received payment are separate facts. Existing participants lock the form's event and currency.

- **S21.01** Which activities use registration, and is one form per event sufficient? Do programs spanning several dates need session-by-session registration or one enrollment?
- **S21.02** Who may build/open/close a form, and can creating the form also create its calendar event and reserve the room?
- **S21.03** Should guests and members register themselves or family members online, or is registration initially office-managed? How is an unrecorded participant added safely?
- **S21.04** What fields may the form builder offer, including conditional fields and attachments, and what should its applicant preview and validation show?
- **S21.05** What should count toward capacity: reserved places, confirmed participants, pending approvals or a temporarily held checkout? Can staff override capacity with a reason?
- **S21.06** What should a waitlist do when a place opens: automatic promotion, timed invitation or staff review? Who decides priority and how is expiry explained?
- **S21.07** Confirm that reserved places may wait for consent, while final confirmation/check-in require applicable consent. Does payment ever become a separate prerequisite for confirmation?
- **S21.08** Which consent is event-specific versus reusable, whose signature/confirmation is required, and how are missing birth date, changing age and withdrawn consent handled?
- **S21.09** What transport options, seats, routes, pickup points, fees and deadlines are needed? What should happen when transport changes after money has been recorded?
- **S21.10** Are fees per person, household, event or selection? Define discounts, scholarships, waived fees, installment payments and who may approve adjustments.
- **S21.11** Which real payment methods are accepted at launch, who records receipt, and what proof/receipt should the payer receive? Keep recorded bank/OMT/cash separate from a future payment gateway.
- **S21.12** Can payment be received in a different currency, exceed the balance, cover several participants or be recorded by someone other than the participant? Define the allocation and review experience.
- **S21.13** How should payments be corrected or reversed while preserving history, and what links should exist to Finance without recording the same money twice?
- **S21.14** What happens when a participant/event is cancelled: place release, waitlist action, transport adjustment, fee policy, refund approval and applicant-visible explanation?
- **S21.15** Which form details may change after registrations begin, and how should event moves, currency changes or revised consent wording be handled when the current form is locked?
- **S21.16** What should staff and applicants see for legacy unlinked forms, duplicate participants, closed registration, unpaid balances and registration confirmation that has not actually been delivered?

## S22 — Check-in, child pickup, incidents and emergency rosters

**Current basis:** check-in uses the selected linked event, not individual Mass attendance. Pickup restrictions and codes exist. Incident records are currently parish-wide; evacuation lists cover checked-in participants only.

- **S22.01** Which events and participants require check-in, and who will operate it on which devices at the door?
- **S22.02** What identifies a participant: name search, registration reference, QR/code, household lookup or printed list? Which fallback is required?
- **S22.03** Can a walk-in register and check in immediately, and how should staff resolve full capacity, missing consent, unknown age and unpaid fees?
- **S22.04** Which alerts must appear before check-in, and who may see medical, allergy, guardian or pickup restrictions without exposing them to bystanders?
- **S22.05** How should duplicate arrival, wrong-event selection, checkout/reentry and corrections to an arrival time be handled?
- **S22.06** Who defines authorized collectors, verifies their identity and records pickup restrictions? Is the authorization global, event-specific or both?
- **S22.07** How is a pickup code issued, delivered, replaced if lost and checked? Is a matching code alone sufficient, or must staff also verify the collector?
- **S22.08** What must happen when an unauthorized or restricted person arrives, a guardian cannot be reached, or staff need to record an exception? Name the real decision owner and escalation route.
- **S22.09** When a participant can leave independently, who records that permission and what checkout evidence is needed?
- **S22.10** Should incident reports link to event, person and location while remaining accessible only to authorized staff? Which information should guardians or other participants receive?
- **S22.11** What incident lifecycle is required: initial record, immediate response, assigned reviewer, follow-up, notifications, resolution and restricted amendments?
- **S22.12** What should an emergency roster include and explicitly exclude? If you need everyone in a building, what additional attendance process would provide that information?
- **S22.13** During a connection failure, what exact check-in/pickup fallback should staff follow, and how should paper/offline records be reconciled later?
- **S22.14** What wording and training must make clear which emergency functions actually work at launch, especially since emergency broadcast delivery is not connected?

## S23 — Facilities, reservations, equipment, maintenance and renters

**Current basis:** room availability combines bookings/setup and maintenance; reservations have office/priest stages. Equipment, issues and external renters have separate tabs.

- **S23.01** Which bookable resources exist: rooms, halls, outdoor areas, entire buildings, equipment or combinations? Which properties affect availability and eligibility?
- **S23.02** Who can see availability and request each resource: public guests, members, group leaders, staff and external organizations?
- **S23.03** What should a free/busy view reveal about other reservations, and should public users see different detail from staff?
- **S23.04** When does a request hold a slot: submission, office acceptance, priest confirmation or deposit? Define hold duration and what actually ends an expired hold.
- **S23.05** If two requests compete, should accepting one automatically refuse the other, move it to a waitlist, or ask staff to propose alternatives? Confirm the message and consent before this side effect.
- **S23.06** What are the approval stages by resource/requester/purpose, and can office administrators confirm routine bookings without a priest?
- **S23.07** How should setup, cleanup, opening hours, multi-day bookings, recurring use and partial-room combinations affect conflicts?
- **S23.08** Should creating a reservation also create a calendar event, service plan or registration form? Which record owns date/time changes?
- **S23.09** What booking details and documents are required, including purpose, guests, responsible adult, equipment, access arrangements, insurance/agreements if your parish requires them?
- **S23.10** How should pricing, deposits, waivers, balance due and refunds work, and where should these payments appear without duplication in Finance?
- **S23.11** Can applicants reschedule or cancel confirmed bookings, and how should fees, competing holds, room staff and linked events be updated?
- **S23.12** When maintenance blocks a room with existing bookings, must the system prevent it, require a relocation plan, or notify affected applicants after a reviewed decision?
- **S23.13** How should equipment quantity, condition, storage, reservations, check-out, due date, return and damage/loss be recorded? Can a room booking reserve equipment atomically?
- **S23.14** Who can report/triage an issue, assign repair, mark a resource unusable and restore it? What evidence, costs and notification close the issue?
- **S23.15** What information should external renter records contain, who may view it, and how do a guest requester and an external renter become the same recognized customer if appropriate?
- **S23.16** Which availability/reservation metrics are actually useful, how are they calculated and what should display when there is not enough recorded data for a reliable figure?

## S24 — Giving, envelopes, counting, pledges and receipts

**Current basis:** the UI has counting sessions, contributions, pledges, standing gifts, campaigns and receipts/statements. Household envelope numbers are optional. Some second-count/session language is sample-specific.

- **S24.01** Which kinds of giving must be recorded, and which are anonymous, household-attributed, person-attributed, restricted or linked to an appeal?
- **S24.02** Who may see donor identity and amounts in lists, profiles, reports and exports? Should priests, administrators, leaders and financial viewers see different detail?
- **S24.03** How should an envelope number find a household, and what should happen for unknown, changed, duplicated or blank envelope identifiers?
- **S24.04** What information must a contribution capture: actual currency/amount, received date, fund, campaign, donor/household, method, reference and anonymity choice?
- **S24.05** Confirm that a gift received in LBP is entered and retained as its actual LBP amount. How should a user distinguish that from a displayed USD equivalent?
- **S24.06** Who opens a counting session, what identifies its source/date and how are cash, bank and other payment totals kept separate?
- **S24.07** What does a genuine second count involve: independent totals, line-by-line review, a second person's authenticated approval, or another procedure?
- **S24.08** What should happen when counts disagree or a second counter is unavailable? Which exceptional actions are allowed, by whom, with what evidence?
- **S24.09** When closing a session, which balances/records are posted, what becomes locked, and what confirmation proves completion rather than showing fixed sample success text?
- **S24.10** How should errors after closure be reversed/corrected, including wrong donor, wrong fund, incorrect currency and cancelled bank payment?
- **S24.11** What do pledges and standing gifts promise operationally: expected payments, reminders, allocations or actual automatic collection? Confirm launch behavior where no payment processor exists.
- **S24.12** Who creates/ends campaigns, what should be public about progress and donors, and how should restricted or excess funds be handled in the interface?
- **S24.13** Which contribution receipts and annual household statements are required, who reviews them and how are corrections/reissues recorded? What wording confirms their actual status and purpose?
- **S24.14** Should members see their giving history or download statements, and how does household attribution affect what one household member may see?

## S25 — Finance, approvals, reconciliation and Office Expenses

**Current basis:** Finance has funds/budget, expenses and bank reconciliation. Office Expenses separately records allowances, opening balances and purchases with independent USD/LBP balances. Finance view/edit permissions differ.

- **S25.01** Is ParishLife intended as the authoritative parish accounting system or an administrative ledger alongside another accounting process? What information must be exchanged with that process?
- **S25.02** Which roles may view, enter, approve, pay, reverse, reconcile and export each financial record? Can the person submitting a payment/expense approve it?
- **S25.03** What funds, restrictions, budgets and reporting periods are required, and who can create/change them or move money between them?
- **S25.04** What makes an expense draft, submitted, approved, paid, rejected or reimbursed? Confirm whether amount thresholds such as those shown in current UI should actually determine approval authority.
- **S25.05** What expense evidence is mandatory, how are missing receipts handled, and what should distinguish a supplier invoice, actual payment and a reimbursement claim?
- **S25.06** For each transaction, which original currency, rate/date/source and converted amount must be stored and displayed? Who may override a rate and what reason must appear?
- **S25.07** Which screens need separate currency balances versus a reporting equivalent? Define rounding and the presentation of mixed-currency totals so users cannot mistake them for actual cash.
- **S25.08** How should bank lines enter the system, and what matching choices are needed for split/combined payments, fees, duplicates and unmatched differences?
- **S25.09** What review confirms reconciliation, who may undo a match and what should be locked when a month/year is closed?
- **S25.10** Should event fees, room rentals, refunds and contributions share Finance transaction references? Define the source of truth so money is counted once.
- **S25.11** Confirm the intended separation of Office Expenses from Finance. How is an allowance transferred into the office ledger represented in overall reporting without double-counting it?
- **S25.12** Who may enter an office opening balance, and how should duplicate/incorrect opening balances, negative balances and corrections to previous months be handled?
- **S25.13** Should office transactions allow edit/delete as now, require reversals, or use different rules before and after monthly review? What should happen to their receipts?
- **S25.14** Which printed vouchers, receipts, monthly summaries and exports are required, in which language/currency, and which need signatures or named approval?
- **S25.15** Which financial reports and donor details should bishops/diocesan administrators receive: aggregates, itemized transactions, individual identities or explicitly granted subsets?
- **S25.16** What should a finance viewer encounter when an action requires editing authority, and how should all sample/static financial claims be replaced with meaningful empty or incomplete-data states?

## S26 — Inbox, staff messaging, notices, prayers and notifications

**Current basis:** private Inbox, staff Messaging, Notices, member posts/resources and in-system notifications coexist. External email/SMS/WhatsApp and emergency delivery are not connected; automation/rule records have no timed runner.

- **S26.01** Which communications should be private conversations, audience announcements, public notices or group posts? Should users compose them from one entry point or different clearly named tools?
- **S26.02** Who can message whom, including strangers in the same parish, guests, minors, leaders and people in other parishes? Which recipient details should be searchable?
- **S26.03** What identity should a recipient see: individual sender, parish office, ministry or priest? Can staff reply on behalf of a shared office without sharing a login?
- **S26.04** Are conversations one-to-one or may they include households, staff teams and groups? Who may join later and read earlier messages?
- **S26.05** What are the rules for attachments, reply threads, unread state, archive, retention and recipient notification? Confirm whether sent messages remain uneditable/undeletable.
- **S26.06** Should request discussions happen on the request timeline or in Inbox, and how should both point to the same conversation without duplicate work?
- **S26.07** Which notices/posts need approval, pinning, expiry, translation and public/member/group audiences? How does changing a person's membership affect access to earlier content?
- **S26.08** Who may submit prayer intentions, what should be anonymous/private/public, who approves publication and how can a person withdraw a sensitive intention?
- **S26.09** Which real external channels are essential at launch? For each unavailable channel, should controls be hidden, disabled, or offer a clearly labeled manual handoff?
- **S26.10** What should draft, scheduled, sent to in-app recipient, delivered externally, read, failed and cancelled mean? Which of those states can launch actually verify?
- **S26.11** Which automated reminders or message rules are required, what triggers them and who owns the content? Should nonrunning automation records be visible as planning-only configurations?
- **S26.12** Complete a notification row for every important transition across membership, requests, certificates, events, volunteers, payments, concerns and appointments. Which roles receive each update?
- **S26.13** Which notifications are optional versus required operational notices, and how should channel choices, quiet hours, digests and language preferences work?
- **S26.14** Where should notifications be read across multiple parishes, and should opening their linked record mark them read? Define badge counts, stale links and dismissed/archived updates.
- **S26.15** How should failed delivery, duplicate recipients, changed contact details and reopened requests affect retries and status messages? Who needs to follow up manually?
- **S26.16** How should a user report unwanted contact or an inappropriate message, and when should the existing exceptional exact-message administrative review be available and audited?

## S27 — Concerns, complaints, reviewer independence and privacy

**Current basis:** identified or reviewer-anonymous cases have selected reviewers, conflict checks, permission-scoped sensitive/identity access, applicant follow-up and separate case/audit storage. Anonymity is not a promise of noncorrelation by infrastructure operators.

- **S27.01** What should the feature be called so users understand its purpose, and which matters belong here versus ordinary requests, feedback or incident reporting?
- **S27.02** Who may submit: linked members, unlinked accounts, minors and/or guests? What support route is available to someone who cannot use the portal?
- **S27.03** Which categories and urgency choices are needed, who maintains them and which require specially authorized reviewers?
- **S27.04** What must the submission screen say about confidentiality, anonymity to reviewers, technical limits and appropriate immediate-help routes before a person submits?
- **S27.05** Should the submitter select reviewers as now, choose an independent office, or use automatic routing? What understandable information helps them choose safely?
- **S27.06** What happens when every available reviewer has a conflict, the complaint involves the priest/bishop, or the selected reviewer becomes conflicted later?
- **S27.07** Who may see case contents, counts, status, evidence and identified submitter details? Confirm that unrelated administrators receive none of these simply because of their role.
- **S27.08** What does accepting a case assignment entail, and who may reassign/escalate it without exposing it to a broader staff queue?
- **S27.09** Define case statuses, response deadlines, review ownership, escalation and closure/reopening rules. Which steps should the submitter see?
- **S27.10** How should reviewer-only notes, applicant-visible replies and requests for more information be visually separated and confirmed before sending?
- **S27.11** May an anonymous submitter later identify themselves, or an identified submitter later hide identity? What should previously authorized readers and historic evidence retain?
- **S27.12** What evidence uploads, downloads, redactions, exports and case-history access are permitted, and which actions require an extra reason or review?
- **S27.13** How should follow-up and outcome notifications avoid sensitive case details on shared devices, email subjects or ordinary staff dashboards?
- **S27.14** What should happen when the submitter leaves the parish, a reviewer loses their appointment, the account closes, or a case predates automatic account tracking?

## S28 — Private notes, pastoral tasks and forms/workflows

**Current basis:** member notes are private to the account. Pastoral notes/tasks are author-private unless shared with current parish priests. A separate Forms & workflows area contains workflow definitions, runs, form builder and logs.

- **S28.01** What belongs in personal member notes, confidential pastoral notes, group notes/tasks and office workflow tasks? Approve labels and boundaries that prevent accidental sharing.
- **S28.02** Confirm whether private pastoral notes remain inaccessible to successor priests, bishops and administrators, including after the author leaves. What access should the author retain then?
- **S28.03** When an author shares with parish priests, does that include priests appointed later? Can sharing be withdrawn, and what should prior readers and copies mean?
- **S28.04** Can a pastoral task be assigned while its content is still author-private? What should the UI explain before assignment, and who may actually complete or edit it?
- **S28.05** Which notes/tasks need linked people, meetings, categories, priority, due dates, recurrence, reminders and attachments? Avoid implying a reminder runs if no scheduler exists.
- **S28.06** How should completion, reopening, deletion and archiving work for each note/task type, including what is retained in a privacy-appropriate history?
- **S28.07** Which real office processes need the separate workflow builder beyond the hard-coded sacrament/request processes? Give a completed example for each.
- **S28.08** Who may define a workflow, publish a form, start a run, assign a step and view its submitted answers? Should templates vary by parish or diocese?
- **S28.09** Which workflow features are essential: sequential steps, conditional branches, parallel approvals, attachments, deadlines, return/rejection and escalation?
- **S28.10** When a workflow definition changes, should running tasks keep the old version? What does pausing a workflow do to new submissions and existing tasks?
- **S28.11** What should a task detail show about completed steps, timestamps, next owner and final result? When should the last step automatically close it?
- **S28.12** How should cancelling, undoing, reopening and transferring workflow runs behave, and which notification/audit evidence must accompany those actions?

## S29 — Administration, bundles, oversight, reports and settings

**Current basis:** Administration handles scoped accounts/appointments, parish creation, public profile, certificate acceptance and bundles. Settings also contains older permission/module/security/integration surfaces. Bishop oversight and general reports have separate screens.

- **S29.01** What should the administrator's main screen prioritize at system, diocese and parish scope, and how should changing management scope differ visually from changing working parish?
- **S29.02** Should staff accounts be created by administrators with a temporary password, or invited to establish their own credentials? How should an existing ordinary account receive an appointment?
- **S29.03** Is the current exact-username lookup suitable for appointing someone outside the visible account list? What should an administrator do when they know only the person's name or email?
- **S29.04** How should account identity, linked parish person, clergy title and active appointments be presented separately so changing one does not imply changing the others?
- **S29.05** Confirm the process for appointing/revoking secretaries, including several secretaries and none. What pending responsibilities should be shown before removing the last one?
- **S29.06** How should administrators review the consequences of deactivating a parish, a parish-specific account access or a global account? Which connected users/workflows need notices and recovery routes?
- **S29.07** What should clergy title changes and cross-parish appointments require, including the current restriction on demoting a priest to Deacon while priest assignments remain?
- **S29.08** Which actions belong only in Administration and which in Parish settings? Should the older Roles & permissions, module toggles and security/integration screens be removed, read-only or reconciled with the actual policy?
- **S29.09** For Presence, Office, Community and Complete, specify the actual feature matrix, record limits if any, public/member access and launch availability. Are the bundle names understandable to parish decision-makers?
- **S29.10** Who can activate/change a parish-managed bundle, and what approval process applies when the diocese sponsors it? What should a pending plan-change request show?
- **S29.11** Are prices, invoices, renewal dates, trials and subscriptions part of launch, or is bundle administration entirely manual? What should the public bundles page promise?
- **S29.12** When a module is disabled or a bundle downgraded, exactly which historical records remain readable/exportable, which pending approvals can finish and which new submissions are blocked?
- **S29.13** What should members/guests see when their parish stops accepting online requests or a feature is unavailable under its bundle? Which office fallback and tracking access remain?
- **S29.14** What should a bishop's overview show across parishes, with what date filters, drill-down permissions and explanations of incomplete data? Is comparison/ranking between parishes appropriate?
- **S29.15** For each existing report—attendance, membership, group participation, volunteer workload, facilities, giving, budget and registration versus attendance—what real decision does it support and how must each measure be calculated?
- **S29.16** Which report filters, languages, date ranges, print layouts and export formats are needed, and should exports contain all matching records or only the visible page?
- **S29.17** Who may see general versus administrative audit history, which events/fields must be included or excluded, and how should users find the reason/actor for a disputed change?
- **S29.18** Are API credentials, webhooks, external reporting and AI assistance actual launch features? For each retained integration, who configures it and what honest configured/unavailable/error experience is required?

## S30 — Visual design, English/Arabic, accessibility and mobile use

**Current basis:** a design system, warm green public site, personal dashboard palettes and light/dark mode exist. English/Arabic layout direction changes; public content may fall back between languages.

- **S30.01** Which parts of the current visual design should be retained, and which concrete screens feel crowded, confusing, too formal, too plain or inconsistent? Give examples by screen name.
- **S30.02** What visual character should the public site and staff workspace convey, and are their different current styles intentional?
- **S30.03** Which logo, parish seal, colors, typography and icon conventions are final assets? Who approves them and can local parishes vary any of them?
- **S30.04** Should staff screens optimize for dense office work or larger, guided interactions, and should users be able to choose a compact/comfortable density or larger text?
- **S30.05** Which personal palette/dark-mode choices should remain, and how should custom colors be constrained so status, focus, text and errors remain readable?
- **S30.06** When should a record open in a page, side drawer or dialog? Which complex flows need a dedicated full page, especially on phones?
- **S30.07** Which actions deserve a primary button, which should be secondary, and which belong in a More menu? Approve a consistent placement for Save, Cancel, Back and destructive actions.
- **S30.08** What confirmation is appropriate for approval, public publication, document release, merge, removal and cancellation? Which reversible actions should use Undo instead of interrupting dialogs?
- **S30.09** How should forms indicate required/optional/conditional fields, explain unfamiliar terms, show progress and preserve values after validation errors?
- **S30.10** Should errors appear beside fields, in a summary, or both, and what should receive focus? Which success messages need a persistent record/timeline rather than a temporary toast?
- **S30.11** What should English/Arabic switching preserve: route, form draft, selected filters and scroll? Which values should display both scripts regardless of interface language?
- **S30.12** Choose conventions for Arabic/Western digits, names, date order, month names, time format and USD/LBP formatting in screens, documents and exports separately.
- **S30.13** Which mixed-direction fields must remain left-to-right inside Arabic screens, including phone, email, URLs, identifiers and currency? Which navigation/icons need mirroring?
- **S30.14** Who approves bilingual terminology and error/help text? What should the interface do when a field or published content has only one translation?
- **S30.15** Is French required at launch, later or excluded? Which currently visible unsupported language options and trilingual claims should be removed or disabled accordingly?
- **S30.16** Which tasks must work fully by keyboard and screen reader, including calendars, family diagrams, tables, selection, drawers, uploads and volunteer scheduling? What nonvisual alternatives are needed?
- **S30.17** What text-size/zoom, touch-target, color/contrast, reduced-motion and focus behavior must be validated with the actual intended users, especially older staff and parishioners?
- **S30.18** For long tables and calendars on phones, which information becomes cards, expandable details or horizontally scrollable content, and what must never disappear?
- **S30.19** Which print/download designs must work in Arabic, English and bilingual form with long names, multiple pages, missing optional data and office printers?
- **S30.20** What should loading, first use, no records, no search results, denied access, unavailable feature and service failure look like on each main surface? Approve the next action in every state.

## S31 — Saving, drafts, connection loss, concurrency and recovery

**Current basis:** server-backed persistence uses revision checks, recovers after failed saves and can retain recovery data. Service plans explicitly save. Offline-tolerant wording needs a precise product definition.

- **S31.01** Which interactions should save immediately, autosave a draft or require explicit Save? Define consistent rules for records, preferences, attendance grids, plans and long request forms.
- **S31.02** What should indicate unsaved, saving, saved, save failed and changed elsewhere, and which message must remain visible until the issue is resolved?
- **S31.03** Should users resume drafts across refresh, logout, device change or language switch? How long may sensitive drafts persist, especially on shared computers?
- **S31.04** When Back, Close, parish switch or sign-out would discard changes, what choices should be offered and which safe destination should follow each choice?
- **S31.05** Which exact tasks must work without a connection: viewing already loaded pages, drafting, attendance/check-in, payment entry or none? Define each permitted offline action explicitly.
- **S31.06** What should the user be told when an action requires a connection, and what manual fallback or recovery should be available?
- **S31.07** If offline writes are required, how should pending changes, changed permissions, duplicates, approvals and stale availability be reviewed before synchronization?
- **S31.08** When two users edit the same data, should the second compare field changes, refresh and reapply, or preserve a recoverable draft? Which conflicts require office review?
- **S31.09** If a save succeeds but its response is lost, how should retry avoid creating a duplicate request, payment, check-in or approval?
- **S31.10** If a record saves but its attachment or notification fails, what should the user see and how should they retry only the failed part?
- **S31.11** What should happen when the active role/parish is revoked, a module changes or a linked person is archived while the user is editing?
- **S31.12** What should timeout, unexpected server error and service maintenance messages show, including a useful reference for support without exposing internal or private data?
- **S31.13** How should stale pages refresh when another person changes request status, room availability, check-in or a financial balance? Which actions need a fresh confirmation?
- **S31.14** Which bulk operations need progress, preview, partial-failure results, cancellation and a downloadable outcome report? How should completed items be distinguished from retriable ones?
- **S31.15** What should users be able to recover after accidental removal, cancellation or incorrect approval, and how long should Undo/restore be available for each record type?
- **S31.16** What should the interface call a data snapshot versus an actual restorable backup, and who should receive the recovery/export controls for each?

## S32 — Retention, support, onboarding and design acceptance

**Current basis:** retention and reviewed deletion appear in Settings; a browser snapshot is not a database restore. Current tests/documentation contain known limitations, so design approval needs its own evidence.

- **S32.01** For people, accounts, official registers, certificates, requests, financial evidence, incidents, concerns, notes and messages, who approves retention rules and the actions available at expiry?
- **S32.02** How should a person request access to their information, a correction, account closure or deletion, and who reviews it when official/historical records must remain?
- **S32.03** What should a deactivation/deletion review show about linked households, minors, active requests, giving, messages and shared records before a decision is made?
- **S32.04** Who may export which data, how should scope/private fields be reviewed before export, and what explanation should accompany a download containing personal information?
- **S32.05** Who handles support for members, guests, office users and administrators? Where should Help appear and what fictional/sanitized information should a support request contain?
- **S32.06** What first-use setup should guide a new parish through identity, staff, approved requirements, public content, opening balances and legacy-data review before opening to applicants?
- **S32.07** Which role-specific guidance, checklists, examples and training materials are needed, and which screens should link to a plain-language explanation of the procedure?
- **S32.08** What should an administrator see before launch about unavailable integrations, incomplete translations, missing setup and legacy records that still require attention?
- **S32.09** Which people will test the prototype as guest, member, guardian, secretary, priest, leader, treasurer, bishop and administrator? Name a responsible reviewer for each retained role.
- **S32.10** Which real tasks will those reviewers perform without coaching, and what observable result, acceptable completion time and error tolerance determine success?
- **S32.11** Which layouts/languages/devices must be approved, including a small phone, office desktop, Arabic right-to-left and a printed official document?
- **S32.12** What findings block design approval, who resolves disagreements and who signs off the final prototype, permission matrix and workflow specifications?
- **S32.13** Which unanswered decisions may be deferred, with what launch fallback? Who owns each remaining decision and what is its resolution date?
- **S32.14** After approval, how should a changed workflow be documented, re-prototyped and reapproved before coding so screens, permissions, notifications and printed documents remain consistent?

## Scenario walkthroughs — evidence that the answers fit together

These are mandatory design-review prompts for retained features, not evidence that the application currently passes. Use fictional data. For each, annotate the prototype with every screen/state, permitted actor, required data, decision, message and recovery path. If a scenario is excluded, name the agreed office fallback.

| Case | Walk through this situation | Relevant questions |
| --- | --- | --- |
| A01 | A new adult signs up, follows two parishes, chooses a primary parish, skips profile completion and returns later. | S03, S06, S07 |
| A02 | The office cannot confidently match a membership applicant to two similar person records; one is already linked to another account. | S07, S08, S10 |
| A03 | A parent requests baptism for an unregistered child; a similar archived record exists and the Arabic name is not yet known. | S08–S13 |
| A04 | A guest submits the same baptism need, loses the tracking link, then creates an account and asks to associate the request. | S06, S07, S11, S15 |
| A05 | A secretary reviews a request with missing documents; a priest accepts directly; the applicant supplies an illegible file that must be replaced. | S11–S15 |
| A06 | A marriage involves a partner from another parish and an external celebrant; the planned room/priest is already busy. | S12, S13, S16, S23 |
| A07 | A scheduled celebration is postponed, cancelled or never takes place; a certificate request was waiting on it. | S11–S16 |
| A08 | The office submits a celebrated sacrament with a name error; the priest returns it; after approval another official correction is needed. | S08, S12, S14 |
| A09 | A priest signs a certificate; the bishop returns it; it is corrected, accepted and released to a verified representative. | S02, S14, S15 |
| A10 | A guest's certificate file is prepared but not released; a wrong-file release is caught or must be withdrawn after release. | S14, S15, S31 |
| A11 | A person joins a ministry, withdraws after leader review, reapplies, then later requests a private departure. | S18, S19, S26 |
| A12 | A leader changes; the former leader has open tasks, group files, attendance corrections and a pending application. | S02, S18, S19, S28 |
| A13 | A volunteer is already assigned in another parish, accepts a new duty, then cancels shortly before the event. | S16, S20, S26 |
| A14 | An event fills while two families register; one child lacks a birth date/consent and another has a partial fee plus paid transport. | S21, S22, S31 |
| A15 | An event moves date/room after participants pay; consent/transport changes and some participants request refunds. | S16, S21, S23, S25 |
| A16 | A child arrives, the connection fails and an unauthorized collector later asks for pickup; paper fallback is used and reconciled. | S22, S31 |
| A17 | An incident occurs during one event; a restricted report is created and an emergency roster is printed without implying whole-building coverage. | S22, S27 |
| A18 | Two room requests compete, one has setup time, a deposit is involved and maintenance later blocks the confirmed booking. | S23, S25, S26 |
| A19 | Equipment reserved for a paid external renter is returned damaged and becomes unavailable for another booking. | S23, S25 |
| A20 | Counters record actual USD and LBP gifts, disagree, resolve the count, close it and later correct the wrong fund/household attribution. | S09, S24, S25 |
| A21 | A registration/rental payment reaches Finance while an office allowance is recorded; reporting must count each movement correctly once. | S21, S23–S25 |
| A22 | An anonymous concern names a senior cleric, selected reviewers become conflicted, and ordinary administrators must see neither the case nor its count. | S02, S27 |
| A23 | A priest shares one pastoral task but keeps another note private, then leaves the parish and loses the parish appointment. | S02, S28 |
| A24 | An editor changes a published bilingual page in draft, another editor publishes a concurrent change and one translation is missing. | S05, S30, S31 |
| A25 | An Archdiocese Admin creates its first parish without a secretary and delegates routine office work without granting priest signature authority. | S02, S29 |
| A26 | A diocese-sponsored parish downgrades its bundle with open sacrament requests, unpaid registrations and documents awaiting release. | S11–S15, S21, S29 |
| A27 | A user has different roles in two parishes, switches parish mid-task and receives a revocation while another tab remains open. | S02, S03, S31 |
| A28 | A financial viewer searches, prints and exports permitted records while trying an editing link from an old bookmark. | S02, S03, S24, S25 |
| A29 | A user completes a long Arabic form using a phone or keyboard/screen reader, changes language, loses their session and resumes safely. | S06, S30, S31 |
| A30 | A deceased/archived person has a household envelope, future commitments, an account, certificates and notification preferences. | S08–S10, S13, S20, S24, S32 |

## Completion gate

Before implementation, verify that:

- Every retained module and workflow has an agreed owner, release scope and first-use/empty/unavailable behavior.
- Every user action has an allowed actor/scope, prerequisite, state change, audience and correction/cancellation path.
- Every form has an approved field dictionary, bilingual labels, validation and privacy rules.
- Every transition has a defined applicant/staff timeline and, where needed, a real notification/delivery rule.
- Every visible metric and success claim corresponds to a defined record/event; sample text is not treated as a final rule.
- Every critical journey has annotated screens for loading, empty, validation, denied access, conflict, connection failure and success.
- Documents and exports have approved content, language, authority, release and historical-version behavior.
- Representative users have completed the relevant scenario walkthroughs and approved the revised prototype.
- Remaining questions are explicitly resolved or deferred with an owner and a concrete launch fallback.

Until these are true, the design remains open. Completing the answers is a substantial step; it does not by itself prove that the project is 80% complete.
