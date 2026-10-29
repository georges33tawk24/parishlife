# ParishLife — complete reviewed answer pack

Prepared 28 October 2026. **All 436 canonical questions across S01–S32 have direct answers; all 30 A scenarios have separate walkthroughs.** Your two Desktop S01–S04 answer files are incorporated question by question, preserving their recorded owner-direction/proposed/input distinctions. Later S03 combined-home directions and printed-priest-name clarification are applied consistently.

Start with [the complete answers](answers.md), or open one section below. This is a detailed proposed product/UX specification. It does not claim that policy owners have approved new recommendations, translations are professionally reviewed, the prototype has been tested, or the application already implements the proposals.

## Questions by section

| Section | Questions | Subject |
| --- | --- | --- |
| [S01](sections/S01.md) | 12 | Purpose, release scope and decision owners |
| [S02](sections/S02.md) | 14 | Organizational structure, roles and authority |
| [S03](sections/S03.md) | 14 | Navigation, dashboard, search and work queues |
| [S04](sections/S04.md) | 12 | Public directory, parish pages and visitor discovery |
| [S05](sections/S05.md) | 12 | Website content, announcements and publishing |
| [S06](sections/S06.md) | 12 | Sign-up, sign-in, invitations and recovery |
| [S07](sections/S07.md) | 12 | Following, parish membership and profile corrections |
| [S08](sections/S08.md) | 12 | People records and individual profiles |
| [S09](sections/S09.md) | 12 | Households, family relationships and representation |
| [S10](sections/S10.md) | 12 | Import, duplicate review, archive and historical records |
| [S11](sections/S11.md) | 15 | Request intake, office queues and guest tracking |
| [S12](sections/S12.md) | 13 | Sacramental lifecycle and official register approval |
| [S13](sections/S13.md) | 13 | Details and exceptions for each sacrament and service |
| [S14](sections/S14.md) | 14 | Certificates, bishop review and collection |
| [S15](sections/S15.md) | 12 | Documents, evidence, attachments and file release |
| [S16](sections/S16.md) | 13 | Calendar, Mass times, clergy schedules and anniversaries |
| [S17](sections/S17.md) | 12 | Service/activity planning and music library |
| [S18](sections/S18.md) | 12 | Ministries, leadership and membership applications |
| [S19](sections/S19.md) | 12 | Meetings, attendance, formation and group resources |
| [S20](sections/S20.md) | 10 | Volunteers, commitments, rota and hours |
| [S21](sections/S21.md) | 16 | Event registrations, consent, transport, fees and refunds |
| [S22](sections/S22.md) | 14 | Check-in, child pickup, incidents and emergency rosters |
| [S23](sections/S23.md) | 16 | Facilities, reservations, equipment, maintenance and renters |
| [S24](sections/S24.md) | 14 | Giving, envelopes, counting, pledges and receipts |
| [S25](sections/S25.md) | 16 | Finance, approvals, reconciliation and Office Expenses |
| [S26](sections/S26.md) | 16 | Inbox, staff messaging, notices, prayers and notifications |
| [S27](sections/S27.md) | 14 | Concerns, complaints, reviewer independence and privacy |
| [S28](sections/S28.md) | 12 | Private notes, pastoral tasks and forms/workflows |
| [S29](sections/S29.md) | 18 | Administration, bundles, oversight, reports and settings |
| [S30](sections/S30.md) | 20 | Visual design, English/Arabic, accessibility and mobile use |
| [S31](sections/S31.md) | 16 | Saving, drafts, connection loss, concurrency and recovery |
| [S32](sections/S32.md) | 14 | Retention, support, onboarding and design acceptance |

## Supporting deliverables

| File | Purpose |
| --- | --- |
| [Decision register](decision-register.md) | Recorded directions, per-section ownership, dependencies and change control |
| [65 workflow cards](workflow-specifications.md) | Ten required card rows plus explicit normal/return/cancel/reopen transition tables and acceptance paths |
| [Permission matrix](permission-matrix.md) | Per-record actions, scoped roles, priest-instruction/signature/release distinctions, independent finance/case access |
| [Field dictionary](field-dictionary.md) | 389 definitions, EN/AR/FR labels and resolved error copy; 878 bindings across 65 forms with required/conditional, source, validation, privacy/locking/output/audit rules |
| [Notification matrix](notification-matrix.md) | Every defined transition, deliberate no-send rules, exact proposed EN/FR/AR message catalog, timing/channel/privacy/failure rules |
| [Navigation and 38 screens](navigation-and-screen-inventory.md) | Combined Home, role entry/navigation, page/drawer choices, responsive/accessibility/language and state annotations |
| [Documents, reports and money examples](document-and-report-specifications.md) | Official-output requirements, 15 metric definitions and worked fictional no-double-counting examples |
| [30 scenario walkthroughs](scenario-walkthroughs.md) | Actors/screens/steps/messages/data/audit/recovery and expected end conditions for every A01–A30 scenario |
| [Open inputs, conflicts and defaults](open-inputs-and-conflicts.md) | 15 real-input/approval groups, source conflicts/supersession and concrete interim behaviors/milestones |
| [Coverage and quality report](coverage-and-quality-report.md) | Reproducible checks, editorial review findings and every questionnaire completion-gate status |

## What is confirmed, proposed and still needed

Recorded owner directions remain distinguishable from new detail: initial Beirut/two-parish setting, all existing modules, three priorities and languages, optional secretaries, individual scoped roles, priest decisions with effective case-specific secretary recording, priest name on official print, one combined Home/explicit multirole choice and combined authorized parish view. Proposed detail does not become Agreed merely by appearing here.

Actual ecclesiastical requirements/numbering, official specimen wording/signatures/bishop policy, real names/contacts/schedules, financial terms and opening data, guardian/safeguarding/independent concern routing, retention rules and named validation reviewers must be supplied by their competent owners. U01–U15 state exactly what is needed, who owns it, when it matters and the safe interim behavior. These are factual limits, not skipped questions.

The unrelated barbershop instructions in the earlier consolidated draft were excluded. The original questionnaire, both supplied Desktop files and previous drafts/register/prompt remain unchanged; source-manifest.json records hashes. No application code, account, database, deployment or Git setting was changed by this work.

## Verification and reproducibility

Run the bundled Python interpreter (or another suitable Python 3) against `check_pack.py` in this directory. It checks exact IDs/order/question wording, scenario wording/mapping, required metadata, specific acceptance criteria, all workflow/form/transition bindings, local Markdown links/anchors and preserved original hashes. [Machine-readable results](check-results.json). These checks establish documentation integrity; they cannot prove human policy approval, runtime correctness or usability.

Authoring/rebuild order: `build_pack.py`, `render_specs.py`, `render_fields.py`, `render_governance.py`, `render_experience.py`, `scenario_data.py`, `review_completions.py`, `finalize_pack.py`, then `check_pack.py`. Inputs/data are contained in the adjacent authoring modules and JSON inventories. The final review_completions step applies deliberate supersession/refinements after source consolidation; do not rebuild only build_pack.py and omit it.

No interactive prototype or live operational validation was performed. Next human review should prioritize U04 priest-instruction stage scope, U05 certificates, U06 financial controls and U07 safeguarding/independent routing, then qualified EN/FR/AR and representative-user validation. Developers retain recorded final product/design release authority.
