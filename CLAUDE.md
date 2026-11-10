# ParishLife continuation instructions

@AGENTS.md

Read `docs/continuation/STATUS.md` at the beginning of a session and whenever the owner says **continue**. Read `docs/continuation/MASTER-PROMPT.md` for the complete working brief and `docs/continuation/SOURCES.md` for actual requirements and their authority.

## Continue means execute

- Resume the existing backend objective and highest-priority unfinished task. Inspect the current branch, diff, latest checkpoint and relevant requirements before editing.
- Implement and verify real behavior. Do not answer with a plan alone, restart from scratch, stop after one method/card, or ask whether to proceed with already-authorized routine development.
- After a coherent change passes its meaningful checks, update the durable state and continue to the next unblocked task within the available run.
- If missing access or a factual/policy decision blocks one task, record it and continue independent work. Ask only for a genuinely necessary input or authorization; explain why.
- Before a context/session/tool/usage limit forces a stop, save the exact state, commands/results, unpublished changes, next action and blockers in `docs/continuation/STATUS.md`. Never claim work continues after the session stops.

## Non-negotiable project boundaries

- C#/.NET 10; one production `ParishLife.Api`, organized by clear folders. Preserve MiniDevOps-style ordinary DTO/model classes, explicit properties/defaults, input validation, one public type per file, and a brief purpose/main-functions comment at the top of every created or rewritten code file.
- Aspire is local observation. Frontend integration is deferred. Existing Azure resources and developer-versus-managed-identity configuration must be preserved.
- No invented church/official/person data or startup seeds. Only `colinsleiman` and `georgestawk` are allowed bootstrap usernames, through the private explicit password/MFA operator procedure.
- Keep account identity, Person facts, parish membership, following/primary preferences, ministry membership, ecclesiastical office and subscriptions separate. Preserve exact selected capacity, current authorization, explicit denials and restricted recovery-session rules.
- Preserve transaction/ETag/idempotency/privacy boundaries. Credentials never enter fingerprints, receipts or audit. A stored event, approval, payment, notification or signature is not proof of an unperformed external action.
- Local tests are not live Cosmos/Blob/Key Vault/managed-identity acceptance. Do not provision, deploy, alter Azure RBAC/network/index policy, run live write tests or bootstrap live accounts without the corresponding explicit authorization.
- Keep tests in source; deploy only the API publish output. Do not expose credentials, key rings, operational data or private logs.

## Git and collaboration

- The requested incoming source is `https://github.com/georges33tawk24/parishlife.git`, branch `backend`; it is remote `upstream` in this checkout. `origin` points to Colin's different repository. Verify URLs before any pull/push.
- Preserve `dev/colin-following` at `c81a30d` (unwired earlier DTO/model WIP). Do not cherry-pick it blindly over the newer membership implementation.
- Work on an isolated continuation/feature branch. Preserve others' commits and local changes; no force push, hard reset or destructive cleanup.
- Fetch and inspect upstream changes before integrating. A pull authorization for Georges's repository is not automatically a push authorization there. Honor an existing push authorization only for its actual remote/branch.
- Subagents are authorized when available. Assign independent scopes, coordinate shared files and builds, and have one integrator verify the combined result.

## Verification and reporting

Run appropriate targeted regression tests, then the required full checks for consequential changes. Respect `global.json`; do not bypass it to claim compatibility. Preserve meaningful failure/authorization/race/privacy coverage, including isolated test storage paths.

Report actual changes, exact checks, material limits and the next task. Never count a partial card as complete or turn a proposed requirement into owner-approved policy. The current card inventory includes deferred frontend work; report that distinction explicitly.
