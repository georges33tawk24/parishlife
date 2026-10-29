# ParishLife — refined S01 and S02 answers for nationwide use

This document expands the product owner's submitted answers into a coherent proposed product and UX specification. The initial rollout is Beirut Archdiocese and two parishes; the organizational model supports subsequent expansion across Lebanon.

Read alongside [the original questions](questionnaire.md), [the decision register](decision-register.md) and [the source-based project review](project-review.md).

**Status:** Owner directions recorded; proposed completion for review. This is a design document, not an implementation or a claim that current code supports these rules.

**How to read status labels:**

- **Owner direction:** Explicitly supplied by the owner, including the corrected sacramental preparation/on-behalf approval rule.
- **Proposed completion:** A concrete rule supplied to resolve ambiguity, an unanswered question or an inconsistency. It is a recommendation for approval, not an already approved owner decision.
- **Input required:** A real-world identity, volume, ecclesiastical policy or other fact that cannot responsibly be invented.

Where an answer contains both owner direction and proposed completion, the detailed additional rules have proposed status. In particular, the active-workspace enforcement model, translation publication rules, sensitive-data boundaries, parish deletion rules and administrative safeguards below need explicit agreement before they become requirements.

The terms **organization** and **diocese** below include the relevant archdiocese/eparchy terminology. Labels follow each organization's approved names. One account can have several independently scoped assignments; this is not one shared national staff role.

## S01 — Purpose, release scope and decision owners

### S01.01 — First operating scope and nationwide structure

**Owner direction:** Launch with Beirut Archdiocese and the following two parishes:

1. Saint Abda and Foucas Church.
2. Saint Georges Church.

There will initially be two individual Super Admin accounts for the developers, a bishop account, an Archdiocese Admin account for the administrator working with the bishop, and an assigned priest for each parish. Additional parish roles are appointed under the parish priest's authority. The two developers are the two Super Admins; the bishop, diocesan administrator and parish priests are separate roles and do not automatically become Super Admins.

**Proposed completion:** The two-parish rollout uses the same structure intended for national expansion. Additional dioceses, parishes, staff and members are added through controlled onboarding without redesigning account identities or weakening parish boundaries. A bishop and Archdiocese Admin operate within their assigned diocese. Parish roles operate only in explicitly assigned parishes; ministry leaders operate only in their assigned ministries. A person can hold different roles in different places through one account.

Each parish has one designated head priest for accountability, with additional priests allowed. The initial count of two Super Admins is an operating decision, not a permanent application-wide maximum.

**Input required:** The exact official identity/jurisdiction and approved English, French and Arabic names for the archdiocese and both churches, including towns/locations. Similar church names must not be treated as the same parish merely because their display names match.

### S01.02 — The three main problems to solve

**Owner direction:** Calendar, reservations and ministry management are the three primary priorities.

**Refined answer:**

1. **Calendar:** Give the priest and office one reliable view of parish activities, relevant clergy duties and resource availability. Define which events are public, member/group-only or office-only. Changes should remain consistent across calendar, service plans, ministry meetings, registrations and bookings where those items are linked.
2. **Reservations:** Let authorized users request available facilities, let the office prepare/review requests, and let the correct authority decide. Show actual availability, setup/cleanup time, maintenance conflicts, current status and the next responsible person. A request must never look confirmed merely because it was submitted.
3. **Ministry management:** Give each ministry accurate leadership, membership, meetings, attendance, resources and commitments, with an understandable application and departure process. Leaders must receive the information relevant to their ministry without receiving unrelated parish or private records.

**Proposed completion:** These are usability and validation priorities, not permission to remove the other modules. Success is demonstrated through completed, consistent workflows rather than feature counts or sample dashboard figures. Exact booking-hold and conflict-resolution policies remain for S23; this answer does not silently choose automatic refusal or timed holds.

### S01.03 — Primary daily users and tasks

**Owner direction:** The parish priest and secretary are the main daily users. A secretary is optional.

**Refined answer:** The priest's five main daily task groups are:

1. Review incoming requests and forms, see missing information and identify items requiring his own decision.
2. Accept, return, decline or approve matters within his authority, including sacramental decisions.
3. Review parish calendar, reservations and upcoming clergy responsibilities.
4. Oversee ministries, staff assignments, events and unresolved operational issues.
5. Review parish summaries, delegated actions, secretary-recorded priest approvals and work requiring follow-up.

The secretary's five main daily task groups are:

1. Maintain calendar information and prepare activity schedules.
2. Receive/review reservation requests, check information and prepare decisions for the appropriate authority.
3. Handle event forms, registrations, documents and applicant follow-up.
4. Support ministry records, meeting schedules and permitted member/contact administration.
5. Receive requests, prepare sacramental paperwork and record a priest's already-given approval on his behalf under the agreed rule.

**Proposed completion:** Each home screen should distinguish **Needs my decision**, **Needs preparation**, **Waiting for information**, **Upcoming** and **Recorded on my behalf**. Those labels should link to actual work. The absence of a secretary must not leave a parish unable to operate.

### S01.04 — Other launch users and frequency

**Owner direction:** Super Admins, bishop, Archdiocese Admin and priests will use the system regularly. Secretaries are optional. Normal users and the remaining existing roles remain part of the product.

**Proposed completion:** All existing role experiences are within launch scope, with different patterns of use:

| Audience | Intended use |
| --- | --- |
| Super Admins | Regular platform/organization administration, access support, rollout oversight and exceptions requiring platform authority |
| Bishop | Regular diocesan oversight, parish and clergy appointments, diocesan decisions and escalations |
| Archdiocese Admin | Regular diocesan operational coordination and authorized office/administrative support |
| Head/other assigned priests | Daily parish operations and priest decisions within their assignments |
| Parish Admin | Daily or frequent office and staff coordination where appointed |
| Secretary | Daily office work where appointed |
| Treasurer/finance viewer | Finance operations/review according to actual duties; daily, weekly or periodic rather than an assumed constant session |
| Ministry leader | Frequent ministry coordination, with heavier use around meetings/events |
| Normal user/member | Personal parish activity, requests, membership, commitments, messages and permitted records as needed |
| Guest | Public browsing and request/tracking use without an account |
| Selected concern reviewer | Case-specific work independent of ordinary rank |

No parish is required to appoint every optional role. Frequency describes the intended design, not a promise that every person is always online or available for immediate approval.

### S01.05 — Modules retained at launch

**Owner direction:** All existing modules stay in scope.

**Refined answer:** Retain public directory/parish pages, account/member portal, administration and oversight, people and households, requests, sacramental preparation/records/certificates, calendar, Services & Activities, ministries, volunteers, registrations/payments, check-in/pickup/incidents, facilities/reservations/equipment, giving/Finance/Office Expenses, messaging/notices/resources/prayers, music, notes/tasks, forms/workflows, reports, audit, settings and bundle management.

**Proposed completion:** Retention does not mean every current implementation or screen promise is approved unchanged. Each module must follow the agreed role, language, privacy and workflow rules. All modules remain in the product and release design inventory; changes in release availability require an explicit recorded decision rather than silent omission.

An external provider, payment mechanism, scheduled runner, map or verification service must only be presented as operational when it actually exists and is configured. Retaining its module does not justify displaying a fabricated successful payment, verification, delivery or reminder. Where an integration is required for launch, resolving it is a launch dependency; where a manual procedure is accepted, the UI must clearly describe that procedure. Feature availability must not be mistaken for record-access permission.

### S01.06 — Paper and in-person sacramental procedures

**Owner direction:** Sacramental processes currently retain paper/in-person steps.

**Refined answer:** ParishLife coordinates requests, preparation, documents, dates, priest decisions and status history while preserving the actual paper and in-person requirements approved by the parish/diocese. Online submission is not the celebration of a sacrament, verification of an original document or application of a priest's signature.

**Proposed completion:** Each sacramental workflow identifies which steps can be completed online and which require office attendance, original documents, a paper register, signature/seal or collection. The system records who checked or received an item and when, distinguishing **Uploaded**, **Paper received** and **Verified**.

A priest may give an instruction outside the application; a secretary may record that approval under S02.07. The instruction/decision date, if known, is separate from the actual time the secretary entered it. Recording historical facts must not falsify the activity timestamps. If the physical procedure and the entered record disagree, the record is flagged for authorized review rather than silently advanced.

**Input required:** Which originals, registers, signatures/seals and collection steps each supported sacrament/certificate actually requires. The answers belong with the priest and bishop; none are inferred from the existence of a form.

### S01.07 — Rites and ecclesiastical variation

**Owner response:** “Irrelevant question.”

**Proposed replacement:** National expansion must not be designed around the assumption that every organization has identical rites, terminology, preparation requirements, calendars and certificate wording. The first rollout uses the practices approved by its actual ecclesiastical authority. The system should allow additional organizations to adopt approved configurations without imposing one parish's procedure nationwide.

At launch, users should see only the rites and document/workflow options that are genuinely supported and approved for their organization. Unsupported options must not appear as usable choices. Parish names, location in Beirut or current sample data are insufficient evidence for selecting a rite.

This is a scope and configuration requirement, not an instruction to invent doctrine or implement every rite immediately. It also prevents existing unsupported selectors from creating false expectations.

**Input required:** Confirm the first archdiocese's exact jurisdiction, rite and approving authority. Until that is known, this question remains open rather than being marked not applicable.

### S01.08 — Devices and operating conditions

**Owner direction:** Primarily a web application used on laptops.

**Proposed completion:** Optimize daily staff work for laptops/desktops using tables, efficient filters, clear detail pages and deliberate approval actions. The essential public/member journeys must still work on common phone sizes; staff may need basic access away from the office. Event check-in should remain usable on a tablet or laptop.

The design must handle Arabic direction, enlarged text, keyboard operation and long forms without hiding mandatory information or trapping actions outside the viewport. A smaller screen must not remove essential status/authority information. A public request must be usable without a hover-only control or desktop-only upload interaction.

Shared computers use individual accounts, clear active user/parish/workspace indicators and reliable sign-out. Network interruptions must produce visible pending/failed-save states. Offline operation is not implied by being web-based and must be specified separately in S31. No native mobile application is required by this answer.

### S01.09 — Complete English, French and Arabic support

**Owner direction:** English, French and Arabic must be complete at launch for the interface, user content and official documents.

**Refined answer:** All navigation, forms, instructions, status labels, validation, errors, notifications, confirmations, help, print controls and official document templates must support the three languages. Arabic requires full right-to-left behavior, including mixed-direction names, numbers, phones, references and currency values. Each account chooses its interface language without changing the data or language of other users.

Public and reusable translatable content must support English/French/Arabic fields with an editor showing readiness by language. Published public pages, standard event/form descriptions, reusable notices and standard communication templates must have reviewed versions in all required languages before being represented as fully trilingual.

**Proposed clarification:** Personal names and private user-entered messages, evidence and confidential notes retain their original wording. They should not require an ordinary sender to produce three translations before saving or submitting. Where a translation is needed, preserve the original and identify the translation/reviewer. Unreviewed translation must not silently become official wording. This interpretation of “user content in three languages” needs confirmation; requiring every private note/message in three languages is a materially different workflow.

Official documents must be available in approved English, French and Arabic versions; a combined trilingual sheet is offered only where its layout and wording are approved. Available-in-three-languages does not by itself require three copies or all three languages on every page. Missing translations block the relevant final publication/official output rather than being hidden by an unexplained fallback.

### S01.10 — Decision owners and approval responsibilities

**Owner direction:** Developers/Super Admins approve product design; parish priests own office workflows; the bishop owns clergy rules; priest and finance person own financial controls; Super Admins and the parish priest oversee sensitive-data access.

**Proposed completion:**

| Area | Accountable owner and validation |
| --- | --- |
| Product structure, shared UX, technical behavior and release | Developer/product owners acting as Super Admins |
| Parish office workflows and local operational choices | Head parish priest, with the staff who perform the work validating usability |
| Clergy appointments, ecclesiastical authority, sacramental policy and official document wording | Relevant bishop/competent ecclesiastical authority; priest implements within that policy |
| Financial controls and local operating rules | Head priest and designated treasurer/finance lead; diocesan rules apply where established |
| Sensitive-access policy and permission enforcement | Super Admins govern platform controls; priests govern permitted parish access within agreed privacy/case rules |
| Language quality and translated ecclesiastical wording | Named English/French/Arabic reviewers; ecclesiastical reviewer for official content |

Policy governance and the right to read a private record are different permissions. Proposed default: technical rank or priestly seniority does not automatically reveal personal notes, private conversations or independent concern cases. Case-specific restrictions and conflicts still apply. A Super Admin may administer an organization without browsing all its sensitive contents. Any exceptional access needs a defined purpose, permitted scope and audit.

Local configuration cannot override the common identity, attribution, scope and audit rules. If a local operational preference conflicts with a diocesan clergy rule, route it to the bishop; if a privacy exception affects platform-wide protection, route it to the designated policy owners. “The developers approve design” does not mean developers decide ecclesiastical facts.

### S01.11 — Scale, capacity and national growth

**Owner response:** “All stated.” This confirms the dimensions that matter, but supplies no quantities beyond the initial organizational scope.

**Refined answer:** The product must support multiple independent dioceses, multiple parishes per diocese, one account with several scoped memberships/appointments, large people/household directories, historical registers, parallel office work and event-day peaks. No screen or permission rule should assume there will always be only two parishes or one priest/secretary.

**Proposed design requirements:** Use understandable parish/diocese selection, search, paginated collections, date/type/status filters, resumable administrative work, controlled bulk review/export, and summaries that explain their actual scope. Handle repeated names and localities without confusing records. Dashboards must not require reading an entire nation's individual records to show an appropriate scoped summary.

**Input required before capacity sign-off:**

| Measure | Known or required input |
| --- | --- |
| Initial dioceses / parishes / Super Admins | 1 / 2 / 2 |
| Initial priests and staff | At least an assigned priest per parish; actual additional staff count required |
| Initial people / households per parish | Required from each parish |
| Ministry count / largest roster | Required from each parish |
| Historical records and years to import | Required from each parish |
| Requests, reservations and messages in a normal/peak period | Required from offices |
| Peak simultaneous staff/member sessions and event check-ins | Required planning estimate |
| Attachments per record, typical size and historical total | Required planning estimate |
| National expansion horizon and expected participating organizations | Required from product owners |

No national volume or performance result is invented here. Numerical targets and representative large-data prototype cases must be agreed before claiming capacity validation. Qualitative readiness for growth is distinct from tested national deployment capacity.

### S01.12 — UI/UX completion and validation

**Owner direction:** The developers validate the result and make the release decision.

**Proposed completion:** Developer approval is based on a complete design pack containing:

1. Release/module inventory and each module's configured/unavailable states.
2. Role, organization and workspace navigation for all retained roles.
3. Record/action permission matrix, including confidential access and on-behalf approvals.
4. Workflow states, responsible roles, transitions, prerequisites and exceptions.
5. Field dictionaries and reviewed English/French/Arabic wording.
6. Annotated pages, drawers/dialogs, tables, mobile layouts and all loading/error/empty/conflict states.
7. Official document/print/export layouts and approval/release rules.
8. Notification and action-history rules.
9. A clickable prototype covering normal work, refusal, cancellation, correction, changed access and interrupted work.
10. Validation findings, resolutions and any explicitly accepted remaining limitations.

Priests, secretaries where available, bishop/diocesan staff, finance and ministry users validate the tasks they actually perform. Developers keep final product/design sign-off; domain owners confirm their rules and official wording so technical review does not substitute for operational validation.

The first two parishes should both participate, including a complete no-secretary scenario. No unresolved authority, sacramental attribution, confidential visibility, financial-state or essential-language contradiction should be labeled approved. S01/S02 completion establishes the foundation; S03 onward must still resolve the detailed screens and workflows.

## S02 — Organizational structure, roles and authority

### S02.01 — Roles and normal users

**Owner direction:** Existing role names are correct. Include the normal user with one account linked to one or more parishes.

**Proposed completion:** Distinguish account identity, parish person record, parish membership, ministry membership, clergy office and operational appointment. A person's presence in a parish directory or group roster does not automatically create a staff role.

| Role or relationship | Intended responsibility and boundary |
| --- | --- |
| Super Admin | Platform and organization administration across the system; not automatic clergy decision/signature authority or unrestricted confidential content access |
| Bishop | Ecclesiastical oversight, clergy authority and authorized administrative actions within appointed diocesan scope |
| Archdiocese Admin | Diocesan operational/administrative work and explicitly delegated duties; no inherited priest/bishop decisions |
| Head parish priest | Parish accountability, local appointments and priest decisions within the parish |
| Other assigned parish priest | Same kind of priest capabilities within an authorized assignment; head-priest accountability remains separately identified |
| Parish Admin | Parish office administration, permitted staff management, preparation and assigned operational duties |
| Secretary | Parish office intake, records/preparation, scheduling and allowed operational actions; may record prior priest approval under S02.07 |
| Treasurer | Finance operations according to the agreed financial controls |
| Finance viewer | Permitted finance viewing/reporting/export; no transaction editing or approval merely from that role |
| Ministry leader | Management of explicitly assigned ministries, not the whole parish or other ministries |
| Normal user/member | Their own account, separately approved parish links, personal requests and permitted community activity |
| Guest | Public information and allowed request/tracking functions without a staff account |
| Selected reviewer/delegate | Exact case or capability assigned through a separate scoped authorization; not a blanket new rank |

Head priest is a designation on a priest's parish appointment, not a second identity or a Super Admin role. Preferred public role names and the corresponding Arabic/French translations need approval, but national support must not depend on English-only labels.

### S02.02 — First accounts, diocese initialization and bishop appointment

**Owner direction:** A Super Admin establishes the first diocese and appoints the first bishop. The first account is a Super Admin account from which the system is initialized.

**Proposed completion:**

1. Establish the first developer's individual Super Admin account through a controlled initial setup. Public signup must never offer self-selection of Super Admin or bishop.
2. Establish the second developer's separately controlled Super Admin account. Do not share one developer login between two people.
3. Create the actual archdiocese with approved names, jurisdiction, responsible contacts and initial operating settings.
4. Link/appoint the verified bishop account to that archdiocese, with an effective start date and clear scope. This records a real ecclesiastical appointment; the software does not confer religious office by itself.
5. The bishop appoints the Archdiocese Admin and establishes parish/priest appointments within his authority.
6. Onboard and activate the two participating parishes under S02.03.

Repeatable organization onboarding must work for additional dioceses. Existing accounts are reused where identity is already established; another diocese does not require a duplicate login for the same individual. Each appointment is separately scoped and historical appointments are retained.

The initial Super Admin dashboard must work before a diocese or parish exists. It shows initialization tasks and account/organization controls rather than empty parish forms that cannot operate. Initial setup, additional privileged appointments and recovery must be attributable; a fixed publicly known privileged password or hidden untracked promotion is not an acceptable setup experience.

### S02.03 — Parish creation, activation, deactivation and deletion

**Owner direction:** The bishop initially creates/approves a parish using its name, assigned priest. The parish becomes public and operational when created. Deactivation/deletion controls are desired.

**Proposed completion:** Creation should collect the information necessary to identify and operate the parish: official English/French/Arabic names, diocese, locality/address, approved jurisdiction/rite, designated head priest and effective appointment, parish office contact, adoption confirmation by the authorized parish representative, and public-profile language readiness. Optional secretaries can be added now or later. Personal staff contacts must not silently become public office contacts.

The bishop owns ecclesiastical approval for parish participation and priest appointment. An Archdiocese Admin may prepare/create the organization only when explicitly authorized by the bishop; a Super Admin may assist with platform setup while recording the relevant authority. Neither role silently substitutes its technical rank for the bishop's decision.

Preserve **immediate activation on valid creation**: once the required information, adoption and appointments are confirmed, **Create and activate parish** makes it usable and publishes its approved public profile in one final action. No additional hidden waiting period is introduced. Incomplete preparation may be saved as a private setup draft; that is not yet an active/public parish. Activation itself should not require filling every optional website section or importing every historical record. Continue Parish Profile setup should be available.

Recommended lifecycle actions:

- **Deactivate temporarily:** Stop new public submissions and ordinary new operational work; show a clear status/contact fallback. Preserve historical records and authorized tracking/read access. Resolve or explicitly hand over in-flight workflows; do not silently approve or cancel them.
- **Reactivate:** Require the relevant organizational authority, reason and review of appointments, public information and outstanding work. A lower authority cannot override a higher authority's suspension.
- **Close/archive permanently:** Preserve the parish's historical identity, official records, financial history and audit. Identify any successor/custodian where applicable. This is different from deleting it.
- **Delete unused setup:** Restrict deletion to reviewed unused drafts/test/duplicate setups after demonstrating that no operational or official records depend on them. For an active parish with records, offer closure/archive rather than a destructive cascade.

Bishop/authorized diocesan staff manage diocesan parish status within scope. System-wide intervention belongs to Super Admins, with a reason and audit. Proposed deletion restrictions require approval because the owner requested deletion but did not define what it may destroy.

### S02.04 — Multiple appointees and designated leads

**Owner direction:** A parish may have several priests, secretaries, treasurers and administrators. A designated lead is necessary. One priest is the head of the parish even when other priests have comparable operational capabilities.

**Proposed completion:** Each parish has exactly one current designated head priest, except for an explicitly recorded vacancy/interim arrangement. The bishop appoints/changes that designation. Other priests can perform the priest duties authorized for their parish appointment; the head priest retains overall accountability and the right to set the permitted local work allocation.

Where more than one secretary, administrator or treasurer is appointed, identify an operational lead for that team when needed. Leadership makes ownership/escalation clear; it does not automatically grant an additional financial approval or access to confidential cases.

Each workflow shows its preparing person/team, current action owner and final authority. The head priest can assign routine priest reviews to another qualified, assigned priest where policy allows. The head-priest designation should not force every ordinary task to wait for the same individual when another priest is authorized to decide it. If a specific class of decision must always return to the head priest, name it explicitly in the workflow.

Lead changes have effective dates and a visible handover list. Former leads retain their authorship/history but lose current authority when their appointment ends. A second head designation cannot silently coexist with the first.

### S02.05 — Several roles and explicit workspace switching

**Owner direction:** Users can see their roles for a parish and explicitly switch workspaces, without signing in again. The submitted answer also refers to combining authorized permissions, which needs a precise interpretation.

**Proposed resolution:** The account retains all its valid assignments, but the user deliberately chooses the parish and the workspace in which they are acting. Workspace selection controls the visible tools and the capacity used for an action. The system must never grant a role the account does not actually hold.

Example: a user assigned Ministry leader and Treasurer in Saint Georges chooses **Saint Georges → Ministry leader** for ministry work and **Saint Georges → Treasurer** for finance work. Both assignments remain attached to the account. Switching is immediate and does not require logout or a second account. A personal workspace remains available for ordinary member activity where eligible.

Recommend enforcing the chosen acting capacity for consequential actions: a finance approval should be performed in the finance-authorized workspace or after an explicit switch offered by the UI. Merely holding another role should not invisibly enable unrelated approvals inside the current task. This is the proposed clarification of the mixed “combined permissions / explicit workspace” answer; a pure focus-only switch over combined permissions would be a different model and should not be left ambiguous.

When a page can be accessed through several roles, display the selected capacity and apply the appropriate record scope. An explicit deny, case restriction or inability to approve one's own work must not be bypassed by selecting another workspace. Changing roles is not a second person's approval.

Before switching with unsaved work, offer Save draft, Discard or Stay. Never move a draft or selected person into another parish simply because the context changed.

### S02.06 — Visible parish and acting role

**Owner direction:** Show the person's role in the active parish.

**Proposed completion:** The persistent header identifies the signed-in account, active diocese/parish, active workspace/role and any temporary delegated capacity. The account page lists all appointments, their scopes, lead designation, dates and status. Another parish's role must not look active here.

Before an important approval, release, appointment or organizational change, the confirmation identifies the record/person, target organization and acting capacity. For example: **Saint Georges Church — Secretary — Record approval on behalf of Fr. [Name]**. A system- or diocese-level administrator must see **System** or the relevant diocese as the management scope, not a parish label that disguises a wider action. please note something, when the paper is printed the priests name will show not the recorded approval from the secratry, that will only show inside the system.

Links and notifications open in the correct permitted context, with a clear context-change notice where needed. Each tab/draft keeps its own record/organization context; switching parish in another tab must not redirect a pending save into the wrong parish. Historical entries identify the scope and capacity at the time of action even after appointments change.

### S02.07 — Preparation, decisions, signatures and record/action permissions

**Owner direction:** Priest, Parish Admin and secretary can prepare sacramental paperwork. The priest decides acceptance/approval. The secretary may record the priest's prior approval given outside the system; it takes effect without waiting for the priest to log in and must be logged and visible to him. This preserves decision D005.

**Sacramental workflow rules:**

1. Assigned priests, Parish Admins and secretaries can enter/precheck request information, collect supporting documents and prepare paperwork within their permitted parish scope. Draft preparation does not itself establish sacramental acceptance or an approved register entry.
2. A qualified, assigned priest makes the relevant ecclesiastical decision and may enter it directly.
3. A secretary acting on a specific priest's already-given instruction can use **Record priest's approval** for the authorized decision on that case. No prior digital instruction/delegation or repeat online approval is required to make this offline instruction usable.
4. The secretary uses their own account and selects the authorizing priest from eligible appointments. Record the case, exact decision/stage, secretary, priest, actual entry timestamp and brief instruction note. Capture when/how the instruction was received where known; never invent a date or rewrite entry history to make it look like the priest clicked.
5. Require an explicit statement such as **The named priest has already instructed me to record this decision for this request.** This confirms an actual case instruction, not an independent secretary decision or open-ended permission to approve all cases.
6. History states **Approved on behalf of Fr. [Name] by [Secretary]**. Priest-side activity and a notification identify the action and link to the record. Applicant-facing status can say **Approved by the parish priest** without exposing internal instruction notes.
7. The approval is effective when recorded. The priest's later reading/acknowledgment is visibility and oversight, not a second pending approval gate. An unread notification does not invalidate the approval.
8. The priest can flag an action recorded without authority or with incorrect details. Proposed correction uses a visible review/correction entry and appropriate suspension of any uncompleted dependent work; it does not erase history or silently undo a completed official record, signature or release. Exact dispute/correction rules need the detailed sacramental workflow specification.
9. Parish Admins and higher administrators do not automatically gain secretary-on-behalf approval through preparation access. Extending that capability needs an explicit separate decision. A bishop decision is not implied by a priest's instruction.
10. Approval, official-register approval, signing, issuance and release are distinct. The current user decision does not authorize secretaries to apply a priest's signature or bypass any later ecclesiastical review. Define which decision stages support on-behalf recording in S12–S14 before finalizing those controls.

**Proposed action meanings and boundaries:**

| Action | Required meaning in the permission matrix |
| --- | --- |
| View | Read the permitted record/fields at its actual scope; search, counters and previews obey the same privacy limits |
| Create | Start a draft/request, without implicitly approving it or creating authority |
| Edit | Change permitted fields at that stage; locked official facts use a correction workflow |
| Approve | Make or explicitly record a permitted decision with prerequisites, actor and responsible authority |
| Sign | Apply a signature under an independently defined signing permission; not inherited from data entry or proxy approval |
| Release | Give the intended recipient access to an already authorized final document; not another way to sign/approve it |
| Export/print | Take an authorized scope and field subset outside the screen; view permission alone need not imply bulk export |
| Archive | End active operational use while preserving required records and links; never a hidden synonym for permanent deletion |

**Proposed starting matrix for non-sacramental records and remaining actions:** The table completes the missing breadth of S02.07 but is not yet the owner's approved detailed matrix. “Office staff” below means the priest/Parish Admin/secretary or explicitly authorized scoped office administrator, not every staff account.

| Record type | View/create/edit | Decision or reserved action | Export/archive boundary |
| --- | --- | --- | --- |
| Public parish profile/content | Authorized office editors; public sees published approved fields only | Authorized publisher; bishop/diocese controls organizational facts and appointments | Public output only; drafts/history stay restricted |
| Diocese/parish organization | Super Admin and scoped bishop/admin according to appointment | Organizational approval/activation under S02.02–S02.03; clergy office stays with ecclesiastical authority | Scoped administrative exports; active record-bearing parish closes/archives rather than cascades to deletion |
| Accounts and appointments | Own account details or permitted administrator functions; people cannot grant their own rank | Appointing authority per scope; protected changes under S02.13 | No credential export; revocation retains appointment history |
| People/households | Permitted office staff; own official record visible through member projection; finance/leader views only need their permitted subsets | Office identity/link/correction review; no self-approval of official correction | Scoped, field-limited exports; archive preserves linked official records |
| Parish membership/profile corrections | Applicant submits own proposal; office reviews evidence and proposed link/fields | Permitted office reviewer; requester cannot approve their own proposal | Avoid global account exposure; retain decision history |
| Sacramental request/preparation | Applicant's own projection plus authorized preparation staff | Priest decision or specific secretary-recorded priest decision above | Applicant sees own results; official bulk export needs explicit authority |
| Official register entry/correction | Permitted preparation and clergy views; approved facts protected | Assigned priest approves official entry; correction authority/process must be specified | No ordinary delete; corrections and historical entries remain attributable |
| Certificate/signature | Permitted preparation staff and clergy; applicant sees permitted own status/output | Priest approval/signature; bishop review where separately required | Final file release only after applicable approval/signature/identity gates; no signature delegation assumed |
| Ministry/roster | Assigned leader and permitted office/clergy; member gets permitted own/group information | Join/departure rules in S18; confidential departure reason restricted | Scoped roster/attendance exports; departure keeps history |
| Calendar/service plans | Authorized office/clergy/leader within audience and event scope | Required publication or clergy/room approvals remain distinct from drafting | Export excludes private titles/details not permitted to viewer |
| Registrations/check-in | Assigned event/office users and own applicant data; medical/guardian fields restricted | Confirmation, consent, check-in, pickup and refunds have separate rules | Restrict participant exports; retain attendance/payment/incident history under policy |
| Reservations/equipment | Authorized requester and resource/office staff; other users see only permitted availability | Resource-specific confirmation/fees/cancellation authority | Do not export private applicant details through public availability |
| Giving/finance | Treasurer/authorized finance users; viewer read/report only; ordinary secretary has Office Expenses access rather than automatic full Finance | Named financial approver and separation of duties in S25; no self-second-approval | Financial close/correction rules; no silent deletion of approved history |
| Office Expenses | Permitted office staff and explicitly authorized finance roles | Approved allowance/expense/review rules; preparation role does not imply every financial approval | Scoped voucher/monthly export; correction/deletion rule to be agreed in S25 |
| Notes/messages/concerns/incidents | Author, recipients or explicitly assigned reviewers/handlers according to record type | No rank-based browse-all; reviewer conflicts and identity restrictions apply | No general export/archive right inherited from administrative rank |
| Audit | Scoped authorized reviewers with appropriate event visibility | Read-only history; corrections add events rather than edit the past | Audit export itself requires permission and must exclude secrets/private case content |

This matrix is a foundation for the full per-role/per-record view/create/edit/approve/sign/release/export/archive specification. Later sections must supply exact field, money, retention and stage rules; agreement to “all modules stay” is not approval of all current role permissions.

### S02.08 — A parish without a secretary

**Owner direction:** Parish Admins and higher administrators can perform secretary duties when no secretary exists.

**Proposed completion:** No-secretary operation is a supported normal configuration. The assigned priest can perform office preparation; an appointed Parish Admin or an authorized diocesan/system office administrator can perform intake, ordinary person/household work, membership/correction reviews, calendar and facility administration, event forms, registration support, document collection and other explicitly permitted secretary duties within scope.

Do not require a fake secretary account or a secretary appointment just to enable these functions. Role labels continue to show the person's actual role; support is not performed by impersonating a secretary. Requests route to the assigned office team or priest when the secretary list is empty, and one person holding several roles receives one relevant notification rather than duplicates.

Office fallback does not itself grant priest decisions, signatures, private pastoral access, concern access or full finance authority. Under the currently agreed rule, only an authorized secretary records a prior priest approval on his behalf; an administrator who must do that would need an explicit decision granting that capability or a genuine secretary appointment. The priest can instead record the approval directly. This separates the owner's broad office fallback from the specifically authorized on-behalf exception.

The UI should show who currently owns office work and allow explicit reassignment. Absence of a secretary must never silently change who signed or made a clergy decision.

### S02.09 — Priest delegation and its limits

**Owner direction:** Delegation follows the priest's decision.

**Proposed completion:** The priest chooses eligible staff and task distribution within parish policy, but delegation must name the person, parish, duty, scope, effective period and any restrictions. The user sees a clear acting-on-behalf label where appropriate; an account password is never shared as a delegation method.

| Delegation type | Proposed handling |
| --- | --- |
| Routine preparation/office work | Assigned to eligible office staff within their standing role or explicit scoped task authorization |
| A specific approval already given by the priest outside the system | Secretary records the prior decision under S02.07; no required prior online delegation or second online approval |
| Temporary ongoing operational coverage | Explicit duties, start/end, responsible priest and review/revocation; never blanket all-parish/all-role power |
| Priest duties assigned to another priest | Qualified active priest appointment and the required ecclesiastical authorization; duty allocation recorded |
| Signature, independent sacramental decision, bishop decision, confidential-case access | No automatic inheritance from administrative delegation; separate permitted authority required |

A delegation cannot exceed the giver's authority or cross into an unassigned parish, unrelated ministry or private case. It ends when expired, revoked or incompatible with loss/suspension of the underlying appointment. History retains both the acting account and the relevant responsible authority.

The scope of the specific offline instruction may be one request or a clearly enumerated set; it is not permission to decide future cases. Emergency/absence rules must identify an eligible substitute rather than treating unavailable clergy as an excuse for unqualified independent approval.

### S02.10 — Absence, handover, retirement, suspension and death

**Owner direction:** Priest, Super Admin or secretary handles pending work, depending on the situation.

**Proposed completion:** Responsibility is transferred according to the kind of work, not merely to whoever is available:

- Office preparation and coordination can move to another authorized secretary/Parish Admin, eligible office administrator or priest.
- Ministry operations can move to a newly appointed/acting leader; unrelated leaders do not gain automatic access.
- Financial work moves to a permitted finance operator/approver, preserving independent-review rules.
- A decision requiring a priest moves to another qualified appointed priest. A secretary may record a prior genuine instruction under S02.07 but does not acquire the absent priest's independent judgment or signature.
- Head-priest/clergy vacancies and episcopal escalations go to the bishop or competent ecclesiastical authority. A temporary acting priest designation must be explicit.
- Super Admins coordinate technical access and reassignment under the proper authority; they do not become the replacement religious or financial decision-maker by being developers.

Before planned departure, show a handover list of open requests, approvals, events, reservations, assigned tasks, financial work and expiring delegations. Retain prior authorship and decisions; transfer only future responsibility/access. Unplanned suspension/death immediately removes applicable authority and routes unattended work to the proper authority for reassignment.

Private pastoral notes, private conversations and concern cases do not transfer with an ordinary work queue. Their own sharing/case rules apply. A former staff member may retain an ordinary member account if otherwise eligible. An instruction allegedly given before an appointment ended but entered later must be handled as a reviewed historical situation; it must not be used to exercise an expired appointment as current authority.

### S02.11 — Access revoked during a session

**Owner response:** Recommendation requested.

**Recommended answer:** Revocation takes effect for the next protected read or write, including sessions already open. The affected appointment stops authorizing actions immediately; do not wait until the next login or show a success result for a rejected save.

The user receives a plain-language message such as **Your access to this parish or role has changed. Your last action was not completed.** The message identifies their own affected context and an appropriate contact without exposing confidential reasons or another person's account details.

Close/restrict unauthorized detail screens, refresh available workspaces and navigate to an allowed workspace, My account or sign-in as appropriate. Removing one parish assignment does not remove other parish appointments or the account's unrelated member access. Global deactivation ends all access.

For unsaved forms, do not complete a submission using revoked authority or upload a hidden recovery copy of restricted data. Preserve only a draft that the account is still permitted to retain; otherwise explain the failure and route recovery through an authorized colleague/support process. Sensitive information already delivered to a device cannot be assumed to have been unseen; the interface must stop further authorized access and remove it from ordinary active views.

If the operation committed before the revocation, preserve its original actor/time and show it as completed only after checking its actual state. If it did not commit, it remains incomplete. A failed response must not be interpreted as proof either way. The same rule applies when a delegation, case assignment, appointment expiry or parish deactivation changes access.

### S02.12 — Appointment dates, acceptance and review

**Owner direction:** Appointments should have dates, acceptance and review features.

**Proposed completion:** Every assignment records role, organization/ministry scope, appointing authority, start date/time, status, lead designation where relevant and history. End date is optional for ongoing appointments and required for temporary cover. Distinguish a scheduled end from an earlier manual revocation.

Recommended statuses: **Invited/Pending acceptance**, **Scheduled**, **Active**, **Suspended**, **Expired**, **Declined** and **Revoked/Ended** as appropriate. The effective date and acceptance requirements must both be met before an ordinary invited assignment becomes usable. A first privileged-account setup or an officially recorded existing appointment may need an explicit controlled activation path; it must not be mislabeled as a privately accepted invitation.

An invitation explains the role, parish/diocese, duties and dates. The person can accept, decline or request correction using their own identity. Membership invitation, ministry membership and staff appointment are different processes.

**Proposed defaults:** Notify the appointee and appointing authority 30 days and 7 days before expiry, with a clear period/recipient configuration for short appointments. Review active staff/administrative appointments annually and when leadership changes. These intervals are proposed product defaults, not claimed church requirements. Any configured reminders must actually be deliverable through the chosen in-system/scheduled mechanism.

Renewal requires an explicit authorized action; expiry never silently extends itself. Display the exact end time and parish time zone. Review reminders should not terminate an indefinite assignment unless an explicit expiry/revocation rule says so. Provide an escalation path for a head-priest vacancy or inaccessible last administrator so continuity is not solved through invented credentials.

### S02.13 — Reasons, reauthentication and second approval

**Owner response:** No substantive answer supplied.

**Proposed answer:** Use safeguards appropriate to the effect of the action. A reason, current-password confirmation and a second person's approval are three different controls; requiring one does not satisfy the others.

| Change | Proposed safeguard |
| --- | --- |
| Ordinary clerical correction/draft change | Standard permitted save and history; extra reasons only where the record/workflow requires them |
| Staff role grant/revocation, temporary delegation, lead change | Explicit target/scope/effective-date confirmation and recorded reason; appointing authority must be eligible |
| Super Admin grant/revocation or global account deactivation | Current-password confirmation, reason and confirmation by another active Super Admin; a request to remove access cannot leave the platform without a controlled active administrator |
| Initial first Super Admin / exceptional recovery | Distinct controlled setup/recovery process with audit; no impossible requirement for a second account before the first exists |
| First bishop appointment or diocesan reassignment | Verified real authority, reason, effective scope/date and review by another eligible platform administrator for the administrative action; this does not confer religious office |
| Parish creation/activation or change of responsible clergy | Relevant bishop approval/appointment and clear parish/lead-priest summary; local staff cannot self-promote into clergy |
| Parish closure, removal of an unused setup or organizational ownership change | Impact preview, reason, reauthentication and independent authorized review; record-bearing parishes do not use ordinary hard deletion |
| Password recovery for privileged account | Verify target identity, current-password confirmation for the acting authorized administrator, reason and revoke the recovered account's old sessions; never disclose the password in an activity log |
| Exceptional confidential access or private export | Purpose, precise permitted records, appropriate independent authorization and audit; no permanent browse-all capability created as a shortcut |

The two developer accounts should remain separately usable for ordinary dual-control actions. Proposed operational policy is to maintain at least two active Super Admins; if a planned removal reduces that number, establish a replacement first. A genuine compromise/recovery procedure must still be able to contain a compromised account rather than being blocked by this operating target. Protection against losing all active privileged access remains mandatory.

The confirmation must show **who/what changes, exact scope, effect on access and pending work, effective date and reversibility**. A person cannot be the independent second approver by switching roles or accounts under their sole control. Temporary protective suspensions may need immediate effect with subsequent review, rather than waiting while compromised access remains usable; define that exception and its reviewers explicitly.

This proposal does not introduce a second online priest approval for the specific secretary-recorded instruction in S02.07.

### S02.14 — Requesting access and disputing appointments

**Owner response:** No answer supplied.

**Proposed answer:** Provide **Request access** and **Report incorrect appointment** from My account and appropriate denied-access screens. Requesting an appointment creates a review request; it never grants the requested role automatically.

Collect the requested organization, duty/role, reason, expected dates and the requester's own contact/account identity. Show only a public/authorized directory of target organizations and their own existing appointments; do not expose private staff lists, account matches, patient/person records or confidential case identifiers through an access request form.

Route parish staff requests to the head priest or eligible appointing authority, diocesan administrative requests to the bishop, and platform/bishop-onboarding issues to the Super Admin review process. Clergy appointment requests go through the ecclesiastical authority rather than ordinary office approval. Existing complaints about a conflicted authority follow an independent escalation route rather than being automatically disclosed to that same person.

Statuses should include **Submitted**, **Needs information**, **Approved/appointment offered**, **Declined**, **Withdrawn** and **Resolved** where applicable. A reviewer states scope/dates and an understandable outcome; the requester receives the result and a next action. Staff can decline their own pending invitation or report an incorrect active assignment without seeing anyone else's appointment details.

No reviewer approves their own request, appoints an unauthorized peer/superior or overrides independent-case restrictions. An escalation must go to an actually eligible authority. On approval, create the proper invitation/assignment and apply S02.12. Keep the access request and appointment history linked but distinct. General access appeals must not become a way to browse concern cases or private pastoral notes.

## Shared rules that keep these answers consistent

These are proposed cross-cutting requirements to carry into S03 onward, not a claim that all later questions have been answered:

1. **Authority has a scope:** Account identity, active workspace, diocese/parish/ministry and any case restriction determine what can be done.
2. **Actual actor and responsible authority are separate:** A secretary's entry of a priest decision preserves both people; nobody signs in as someone else.
3. **Preparation is not approval:** Submission, data entry, acceptance, final official approval, signature, release and collection are separate facts.
4. **Optional staffing must work:** A parish can operate without secretaries, administrators or other optional staff using eligible assigned people; missing staffing does not silently create clergy powers.
5. **Rank is not universal content access:** Appointment administration and confidential record visibility are separately governed.
6. **No loss of institutional history:** Revocation, departure, deactivation and closure preserve authorship and official/financial relationships.
7. **No misleading interface claims:** Delivery, verification, signature, capacity and successful save are shown only when the corresponding event is real.
8. **Three languages cover the whole experience:** Status, errors, notifications, help and documents count, not only menu labels.
9. **Authority changes affect current sessions:** An open page or previously valid button cannot preserve a revoked action.
10. **One nation, several independent jurisdictions:** Growth does not make records visible across dioceses without the corresponding authorized scope.

## Inputs and owner choices still needed before calling S01/S02 final

The document supplies concrete proposed behavior for unanswered design questions; the following cannot be represented as confirmed facts or choices:

| Item | Current status / required resolution | Related IDs |
| --- | --- | --- |
| Exact diocesan/church identities and three-language official names | Owner/diocese to supply; no denomination or locality inferred from names | S01.01, S01.07, S02.03 |
| Numerical operating volumes and growth horizon | Offices/product owners to supply; initial 1 diocese/2 parishes/2 Super Admins are the only fixed counts | S01.11 |
| Trilingual content policy | Confirm three-language public/reusable content and original-language private free text, versus literally requiring three versions of every private submission | S01.09 |
| Active-workspace action model | Confirm explicit acting-capacity enforcement as proposed, versus a focus-only switch over combined permissions | S02.05 |
| Sensitive-data governance versus visibility | Confirm restricted private/case access while Super Admin/priest govern policy | S01.10, S02.07 |
| Parish deletion | Confirm closure/archive for record-bearing parishes and deletion only of reviewed unused setups | S02.03 |
| On-behalf approval stages and eligible recorders | Secretary route is owner-confirmed; decide stages, whether admins may also record, and dispute/correction path | S02.07–S02.10 |
| Signatures, document issuance/release and bishop review | No broader delegation implied; domain owners must approve detailed rules | S02.07; S12–S15 |
| Appointment acceptance, expiry and review defaults | Dates/review accepted in principle; proposed states, invitation handling, 30/7-day reminders and annual review need approval | S02.12 |
| High-impact administrative safeguards | S02.13 was unanswered; all detailed safeguard choices above are proposed | S02.13 |
| Access requests and appeals | S02.14 was unanswered; proposed routing and states need approval | S02.14 |
| Final domain validation | Developers retain final design release; confirm named clergy/office/finance/language reviewers | S01.10, S01.12 |

These open items are not permission to start implementation with guessed answers. The developer can review and accept the proposed rules in batches while real parish inputs are collected. The 410 questionnaire questions outside S01/S02 and the detailed workflow/field cards remain part of the design process.
