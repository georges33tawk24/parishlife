# ParishLife UI/UX decision register

Unanswered items remain **Open**. Agreed decisions are recorded below. No current behavior, suggested option or default in the questionnaire is approved merely because it appears in the repository.

## Answer format

Copy one entry per question or tightly related decision:

```text
Question ID(s):
Decision status: Open / Proposed / Agreed / Deferred / Not applicable
Desired behavior:
Who it applies to (roles, parish/diocese scope, audience):
Who can perform each action:
Required data / documents:
Default and alternative path:
Failure / cancellation / correction / exception path:
What each participant sees and is told:
Release: First release / Later / Removed
Reason and dependencies:
Decision owner:
Operational approver:
Example using fictional data:
Prototype / screen references:
Acceptance criteria:
Date agreed:
Supersedes:
```

For a deferred feature, specify the experience users receive at launch: hidden, unavailable with explanation, read-only, or handled by the office. “Later” alone does not resolve the UI.

## Index

| Decision ID | Question IDs | Decision summary | Status | Owner / approver | Release | Affected screens | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D001 | S01.01–S01.12 | Release and operating context | Owner responses recorded; refined details proposed in D006 | Developers, head priests, bishop and relevant finance/policy owners | All modules retained; readiness details open | All | D006 |
| D002 | S02.01–S02.14 | Authority and approval matrix | Owner responses recorded; refined details proposed in D007 | Relevant appointing/clergy authorities | All existing roles retained; detailed matrix open | Role-based workspaces | D001, D005, D007 |
| D003 | S03.01–S03.14 | Navigation, dashboards and work queues | Owner directions S03.01–S03.06 recorded in D010; S03.07 open; remaining recommendations proposed | Product owners / representative role users | All retained roles | Combined home, shell and entry screens | D001, D002, D008, D010 |
| D004 | S02.07 | Earlier priest-only preparation/management interpretation | Superseded by D005 | Product owner | To decide | Sacramental workflows | D005 |
| D005 | S02.07 | Priest, Parish Admin and secretary may prepare; priest decides; secretary may record prior priest approval on his behalf with attribution and priest visibility | Agreed principle; remaining matrix open | Product owner / ecclesiastical approver to identify | To decide | Sacramental requests, preparation, approval, priest activity and related access | D002; S11–S15; supersedes D004 |
| D006 | S01.01–S01.12 | Beirut two-parish launch within nationwide structure; all modules retained; English/French/Arabic launch support; refined scope/ownership/validation draft | Owner direction recorded; additions proposed | Product owners / domain reviewers to name | Launch scope confirmed in principle | All surfaces, languages and organizations | D001; refined answer document |
| D007 | S02.01–S02.14 | Scoped roles, optional staffing, explicit workspaces and refined appointment/delegation/revocation/governance draft | Owner direction recorded; additions proposed | Product owners / bishop / head priests | Detailed rules for review | Account, administration, office, clergy and permissions UX | D002, D005, D006; refined answer document |
| D008 | S03.01–S03.14 | Earlier navigation proposal plus remaining queue/search/collection recommendations | Separate-home and remembered-role proposals superseded by D010; other unconfirmed details remain proposed | Product owners / representative role users | Design scope for all retained roles | Shell, dashboards, search and collections | D005–D007, D010; S03/S04 answer document |
| D009 | S04.01–S04.12 | Public discovery priorities, time search, profile/content readiness, imagery/contact privacy, guests and sharing | Proposed; public facts/configuration still required | Product owners / priests / diocesan and language reviewers | Trilingual participating-parish discovery | Directory, parish pages, public calendar/request/contact | D006–D008; S03/S04 proposed answer document |
| D010 | S03.01–S03.06 | Owner answers: single-role direct entry, multi-role choice, one combined home, permission-driven sections, all-label review, combined parish view and removal of former-role access | Owner direction recorded; additional refinements proposed; S03.07 unanswered | Product owner | All retained roles/parish relationships | Home, login role choice, navigation, parish filters and access changes | Replaces conflicting D008 proposals and clarifies D007 home interpretation |
| D011 | S01.01–S32.14, all 436 questions | Consolidated complete answer draft preserving owner decisions and proposing answers for all remaining questions | Drafted 28 October 2026; new recommendations not automatically approved | Product owners and relevant domain reviewers | All retained modules and three languages | Complete system UX/workflow design | D005–D010; complete-questionnaire-answers.md |

Add decisions as answers arrive. D001/D002 index submitted answers and their proposed refinement; D003 indexes the latest navigation status. D005 is the agreed sacramental authority principle; D004 is superseded history. D010 records the owner's S03.01–S03.06 directions and takes precedence over conflicting earlier home/role-entry proposals. D008's remaining recommendations and all D009/S04 proposals are not automatically approved.

## D004 — Sacramental authority

**Question:** S02.07. **Status:** Superseded by D005. The wording below is historical and must not be used as the current requirement.

**Owner's instruction:** “I do not want normal people being able to handle sacramental stuff, it always goes back to the priest.”

**Answer wording:** Sacramental work must remain under the responsibility and control of an authorized priest assigned to the parish. Non-clergy roles, including secretaries, ministry leaders, treasurers and administrators, must not manage sacramental preparation, change official sacramental entries, approve or reject sacramental matters, sign certificates, or authorize their issuance or release. Administrative privileges alone never grant sacramental authority. A person holding both an administrative role and an authorized priest appointment acts through their priest appointment for these actions.

Members and guests may request a sacrament or certificate and provide the information/documents needed for their own request; that applicant interaction does not grant access to internal sacramental management. Exact applicant visibility and any limited office intake assistance remain to be specified in the detailed workflow questions.

This decision changes the intended boundary from existing secretary/administrator office-management behavior; application code has not been changed. It does not resolve the separate bishop-acceptance/oversight policy, signature delegation or the permission matrix for non-sacramental records. Those decisions remain open and must agree with this priest-control principle.

**Design implications:** Route sacramental decisions and internal management to authorized priests. Review role navigation, request queues, preparation controls, person-profile sacrament tabs, certificates, document release, notifications, print/export and backend permissions against the final matrix. An unassigned priest or an administrative title alone must not confer parish sacramental authority.

## D005 — Sacramental preparation and approval recorded on a priest's behalf

**Question:** S02.07. **Status:** Agreed principle; the full record/action permission matrix remains open. **Supersedes:** D004.

**Owner's clarification:** Priests, Parish Admins and secretaries may prepare sacramental paperwork. Acceptance and approval remain the priest's decision. If the priest has already instructed the secretary to approve a case outside the system, the secretary may perform the approval in the system on his behalf. The action must be logged on the priest's side so he sees it.

**Current answer wording:**

- An authorized parish priest, Parish Admin or secretary may prepare sacramental paperwork, enter supporting information and assemble the documents needed for priest review. This does not by itself grant authority to make the sacramental acceptance or approval decision.
- The authorized parish priest makes the acceptance and approval decisions and can record them directly in the system.
- A secretary may record acceptance/approval on the priest's behalf when that priest has already given the instruction for the case, including verbally or outside the application. The secretary must use their own account and identify the authorizing priest; the system must preserve both identities.
- This route must be explicitly labeled, for example, **Record priest's approval**, with the outcome **Approved on behalf of Fr. [Name] by [Secretary]**. It must not suggest that the secretary independently made the clergy decision or that the priest personally clicked the button.
- The audit must retain the request/record, action, secretary who entered it, authorizing priest, timestamp and a brief record of the instruction. The action must appear in the priest's activity/review area with a notification so it is visible to him.
- Recording a prior instruction must not require the priest to log in, approve a digital delegation first or approve the same decision again before it takes effect. It is an effective approval made on his instruction, with subsequent visibility rather than an additional pending-approval stage.
- Parish Admin preparation access does not automatically include this secretary-on-behalf approval route. Other administrative roles gain no sacramental decision authority merely from their rank.

**Still open:** Exact preparation fields/stages, any permitted Parish Admin on-behalf route, how a priest disputes/corrects a wrongly recorded instruction, signature/issuance/release permissions and bishop review. Recording approval on behalf does not automatically delegate use of a priest's signature.

**Design implications:** Include preparation tools for the three stated parish roles; distinguish direct priest approval from secretary-recorded priest approval; show the responsible priest and actual acting account in history; provide priest-side activity/notification visibility. Apply this distinction consistently in request timelines, permissions, print/export descriptions and later implementation. No application code has been changed by this decision update.

## D006 — Submitted S01 answers and nationwide refinement

**Status:** Owner direction recorded; proposed additions not yet approved. **Question IDs:** S01.01–S01.12.

The owner confirmed an initial Beirut Archdiocese rollout with Saint Abda and Foucas Church and Saint Georges Church; two individual developer Super Admins; a bishop and diocesan administrator; and parish priests distributing local roles. Calendar, reservations and ministries are the three principal priorities. Priest/secretary are the main daily users, with secretaries optional. All existing modules remain in scope. Sacramental processes currently retain physical/paper steps. Laptops/web are primary devices. English, French and Arabic are required across the interface, user content and official documents. Developers validate design; the stated clergy/office/finance/policy owners govern their respective areas.

The owner requested refinement for a nationwide product. [Refined S01/S02 answers](S01-S02-refined-answers.md) provide a proposed organizational model and detailed wording. They do not invent the exact rite/jurisdiction, official three-language names or operating volumes. The interpretation of trilingual private free text, confidential-access governance and domain validation is explicitly proposed for review. The brief original answer to capacity does not establish any numerical national readiness target.

## D007 — Submitted S02 answers and governance refinement

**Status:** Owner direction recorded; proposed additions not yet approved. **Question IDs:** S02.01–S02.14.

The owner confirmed existing role names plus the normal multi-parish user; Super Admin initialization and first bishop appointment; bishop-owned parish creation with immediate operational/public activation; multiple role holders with a designated head priest; visible parish-specific roles and explicit workspace switching without another login; D005 sacramental preparation and recorded-priest-approval behavior; office fallback for administrators when no secretary exists; priest-directed delegation; and appointment dates/acceptance/review in principle.

The role-switching answer mixed combined permissions with explicit workspaces, so [the refined document](S01-S02-refined-answers.md) proposes deliberate acting-capacity enforcement and identifies that choice for confirmation. It also proposes detailed handover and revocation behavior, parish closure/deletion boundaries, delegation limits, appointment states/default intervals, administrative safeguards and access-request routing. S02.11 requested a recommendation; S02.13 supplied no substantive answer; S02.14 was unanswered. Those detailed proposals must not be labeled owner-approved. D005 remains authoritative for the already-agreed secretary route; no automatic expansion to signatures or administrator proxy approval is recorded.

## D008 — Proposed S03 answers

**Status:** Proposed; owner review pending. **Question IDs:** S03.01–S03.14.

**Subsequent owner update:** D010 supersedes the separate personal/work home and automatic last-role-entry proposals. S03.01–S03.06 now contain owner directions; S03.07 was left blank. Other D008 recommendations remain proposals. Read the updated answer document rather than applying this original draft summary as a current decision.

At the owner's request, the earlier S03/S04 draft supplied role starting screens, workspace/personal switching, grouped navigation, labels, parish selection, remembered state, dashboard definitions, unified triage, deduplicated badges, scoped search, detail/return navigation, collection controls, phone behavior and unavailable-link handling. [The current consolidated answers](complete-questionnaire-answers.md#s03) preserve the later owner corrections and replace conflicting separate-home proposals.

The draft preserves D005: a secretary-recorded prior priest approval advances the case and appears as attributed priest-side activity; it is not another pending priest approval. New proposals include an eligible secretary's separate personal workspace, deliberate acting-capacity enforcement, broad-search privacy boundaries and canonical counting. They do not change current code or grant permissions by being written.

## D009 — Proposed S04 answers

**Status:** Proposed; owner review pending. **Question IDs:** S04.01–S04.12.

[The consolidated S04 answers](complete-questionnaire-answers.md#s04) supply public purpose/action order, directory/time filters, card contents, map/location behavior, profile section order, missing-data/readiness rules, image policy, public clergy/contact boundaries, event-family-name privacy, guest-request discovery, maintained urgent pastoral contact and public-link/language/marketing behavior.

Material proposals include structured schedules for cross-parish time search; hiding the nonfunctional map preview until a real integration exists; neutral imagery until parish imagery is verified; generic public sacramental titles unless separately authorized; and core trilingual/contact readiness aligned with creation/activation. Official names, jurisdiction, locations, contacts/hours, schedules, approved translations and supported request types remain real inputs to obtain. No numbers, names, hours or ecclesiastical policies are invented by these proposed answers.

## D010 — Owner's first S03 answers

**Status:** Owner directions recorded; detailed completion remains proposed. **Question IDs:** S03.01–S03.06. **S03.07:** Open; no answer supplied.

The owner specified:

1. One available role opens its dashboard directly; several available roles require the user to choose the role to enter. Accounts without a parish discover parishes and published events. Followers see published church information. An unassigned priest receives a pending-assignment UI.
2. One combined home, avoiding an additional personal/work home switch.
3. Navigation sections follow the permissions granted to roles and individuals.
4. All ambiguous labels in S03.04 need review/standardization. Final replacement wording was not selected merely by answering “All of them.”
5. A combined parish view.
6. Changed roles remove access that the former role no longer authorizes.

[Updated consolidated S03 answers](complete-questionnaire-answers.md#s03) express those directions and keep scope/visibility refinements explicit: following exposes public information; a combined view does not merge parish authority; each mutation targets its own parish; and role choice is distinct from adding an extra home-selection step. These refinements and the precise view-memory behavior remain proposed where the owner did not specify them.

The earlier separate personal-workspace/home proposal and automatic remembered-role entry are superseded. S03.07's recommended dashboard cards/metrics remain unapproved because the owner left that item blank. S03.08–S03.14 and S04 are unchanged recommendations. No application code was modified.

## D011 — Complete S01–S32 answer draft

**Status:** Draft prepared 28 October 2026 at the owner's request. All 436 original questions have answers; owner-confirmed directions remain distinguished from new recommendations. Completing this draft is not blanket approval of its proposed policies or implementation.

[The complete Markdown file](complete-questionnaire-answers.md) retains the original IDs, exact question wording and section order. It consolidates prior S01/S02 material with the latest S03 corrections and adds proposed answers through S32, workflow/permission rules, reporting definitions, notification transitions, actual domain-input requirements, operational defaults and acceptance/handoff cases.

The consolidated file preserves the owner's source-file clarification that printed sacramental paperwork shows the priest's name, while secretary recording attribution stays inside the system. It does not extend proxy approval automatically to signatures, other administrators or bishop decisions. It replaces obsolete separate personal/work home suggestions with the confirmed combined home and deliberate multi-role choice.

Official church identities/translations, templates, jurisdiction-specific requirements, real schedules/contacts, fees, volumes, retention and qualified safeguarding/financial rules remain factual inputs or proposals for the responsible owners. No application code, production data, live accounts or deployment was changed. The earlier standalone S03/S04 draft is not present in this checkout; its references now point to the relevant consolidated sections instead of a missing file.

## Required design outputs

| Output | What must be explicit | Status |
| --- | --- | --- |
| Release inventory | Every existing module: retain, change, defer or remove; first-release fallback | Open |
| Role/permission matrix | View, create, edit, approve, sign, release, export, archive and administer by scope | Open |
| Navigation map | Every role, account without membership, multiple roles/parishes, public and guest routes | Open |
| Workflow specifications | Entry, states, owners, allowed transitions, timing, exceptions and communication | Open |
| Field dictionary | Required/optional/conditional fields, validation, visibility, editability and translations | Open |
| Content model | Public/private/group content, publishing states, translations and ownership | Open |
| Screen inventory | Full pages, drawers/dialogs, mobile variants and all state variations | Open |
| Interaction rules | Save/draft, back/close, bulk actions, conflicts, upload, errors, loading and empty states | Open |
| Document specification | Register/certificate/receipt/voucher layouts, official wording, signatures and release | Open |
| Notification matrix | Trigger, audience, text, channel, timing, privacy, preferences and failure | Open |
| Annotated prototype | Critical journeys across roles with actual proposed wording and representative data | Open |
| Validation record | Scenario results, named reviewers, unresolved issues and approval date | Open |

## Change control after approval

Keep the old decision and record a replacement decision with its reason. Mark affected screens, workflows, notifications, documents and acceptance cases. A change to authority, public visibility, money or official records must be reflected everywhere it appears; changing one screen label is insufficient.
