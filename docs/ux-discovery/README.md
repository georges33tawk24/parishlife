# ParishLife UI/UX discovery

Prepared 27 October 2026 from this repository and a disposable local preview.

This is a decision pack for the product owner, parish staff, clergy and other affected users. It does not change application behavior. Existing behavior is a starting point to confirm, not an assumed final requirement.

The pack contains **436 numbered questions across 32 areas**, **30 scenario walkthroughs**, a source-based project review and a decision-register template. Question IDs were checked for uniqueness and sequential numbering; document links were checked locally.

**Complete answer draft:** [All S01–S32 answers](complete-questionnaire-answers.md), prepared 28 October 2026, consolidates every original question and a detailed answer in one file. It preserves confirmed owner directions, labels new proposals, and includes workflow, metric, notification, real-input and validation appendices. This is the current consolidated draft; it takes precedence over conflicting earlier proposals, without treating unapproved recommendations as agreed.

The owner's first S01/S02 responses have been expanded into [refined nationwide answers](S01-S02-refined-answers.md). That document distinguishes owner directions, proposed completions and inputs still required. Proposed details are not approved merely because they have been drafted.

[S03 owner answers and S04 proposals](complete-questionnaire-answers.md#s03) are included in the consolidated file. S03.01–S03.06 preserve direct entry for one role, role choice for multiple roles, one combined home, permission-driven sections, label standardization, combined parish view and removal of old access on role change. S03.07 and later sections now have proposed answers rather than blank responses; those recommendations still require owner approval.

## Read and answer

1. Read [Project review](project-review.md) to see what the project contains and where decisions are most urgent.
2. Answer [the complete questionnaire](questionnaire.md) in section order. Every question has a stable ID. Work in manageable rounds; the whole bank is available now.
3. Record agreed answers in [the decision register](decision-register.md). An unanswered question stays open. “Later” needs an agreed first-release behavior; “not applicable” needs a reason.
4. Apply the common workflow and field templates in the questionnaire to every retained workflow. These capture details that a feature-level answer cannot resolve.
5. Walk through the acceptance scenarios with representative users, then approve the resulting screens, text and interaction states before implementation.

An answer can be short: `S01.01 — One archdiocese initially; design for several independent dioceses.` If an answer is uncertain, use `Open — owner: [person]; evidence needed: [example]`. Do not supply real passwords, identity documents, private pastoral cases or parishioner data; fictional examples are enough.

## What “finished” means

Discovery is complete when the release scope, role permissions, information architecture, fields, lifecycle transitions, exception paths, bilingual wording, responsive layouts and acceptance criteria have named approvals. Answers should produce a screen inventory, permission matrix, workflow diagrams, field dictionary and annotated prototype. A questionnaire alone does not establish that those artifacts are complete or that the implementation is a particular percentage finished.

No coding decisions are required to answer this pack. Choose the desired experience and parish operating policy first. Technical feasibility, integrations and estimates follow those decisions.
