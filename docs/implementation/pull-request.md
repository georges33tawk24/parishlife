Main currently provides a small Razor Pages reservation/events/people/notices app. This change adds reviewed core operations to that architecture: scoped individual authority, effective recorded priest instructions, combined Home, account/guest intake and drafts, evidence and certificate gates, ministry applications, confidential concerns/notes, canonical finance and giving counts, and EN/FR/AR content/UI paths.

**Draft: the full 436-question requirements scope is incomplete. No complete A01–A30 scenario is certified passed.** The checklist and scenario report explicitly retain software gaps as well as real-world policy/service dependencies. This PR must not be treated as release acceptance.

- Based directly on fetched `main` at `4ec733bfe56f690b645e0c388c4c5f87e48bbd37`; no colin application code imported. Original local work is preserved in its original checkout.
- Case-specific secretary recording takes effect once and retains actual recorder plus priest authority internally. Personal signature, bishop acceptance, independent finance review and verified recipient release remain separate gates.
- Actions recheck current scope and revision. Actor/operation/payload receipts commit with primary facts; retries do not duplicate results. Sensitive concerns/notes have separate access filters, including counts.
- Financial movement uses integer original-currency units, independent review, immutable posting, exact count revision and no duplicate consolidated allowance expense.
- Migrations include a populated-main regression fix preserving existing appointments/venues without inventing policy/consent approval. Non-development startup requires explicit reviewed migration application.

Validation: **64 integration tests passed** in Release; no pending model changes; EN/FR/AR literal resource check; all 436 question criteria and 30 scenario entries mapped; original documentation checker PASS; NuGet reported no known vulnerable packages at check time. Three unused-constructor-parameter compiler warnings remain. Browser verification covered saved Arabic facts through English/Arabic/French switching and phone/desktop layout. The added GitHub Actions workflow has its own status.

See [the implementation checklist](docs/implementation/checklist.md), [all scenario reviews](docs/implementation/scenario-review.md), and [verification/limitations](docs/implementation/verification.md). Major remaining software includes full sacrament/people forms, official amendments, scheduling/planning/music, volunteers, equipment/maintenance, transport/fees, finance reconciliation, Inbox, bundle downgrade and retention workflows. Competent owners must also provide actual templates, rules, finances, safeguarding routes, service credentials and named human validation.

No merge, deployment or production data migration is authorized by this PR. Obtain explicit user approval before merging or deploying.
