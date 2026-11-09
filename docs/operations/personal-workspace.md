# Account-private notes and personal tasks

This backend slice implements H01 in the single API. Its reviewed discovery sources are S28.01, S28.05–06, WF63/FM63, permission row P25 and S31.03 in the reviewed-answers pack. Those detailed specifications explicitly carry **Proposed recommendation** status. This implementation does not turn them into recorded owner policy approvals. S28 distinguishes My notes from private pastoral notes, group collaboration and office workflows; the latter features are separate.

## Personal access and storage

`/api/me/personal-workspace` always derives ownership from the current authenticated account. It has no account/parish selector or administrator, priest, leader, guardian or household fallback. Normal verified active accounts may use it without parish membership or an organizational subscription. Recovery sessions, selected staff capacities and locked/deactivated/unverified accounts are rejected. Each protected request checks current eligibility; mutations fence the exact account version in the same account-partition transaction.

Title, original body, optional category/tags and task priority/reason/due date are encrypted together using account/item/revision-bound Data Protection. Previous full snapshots remain protected in account-only revision history. API results label the audience **Only you** and send `Cache-Control: no-store`. No content enters People, parish/group search, public output or general audit/receipts. Safe operation fingerprints contain command identity only; an encrypted private command record verifies exact retries, including a concurrent duplicate with different text.

## API and lifecycle

| Endpoint | Behavior |
| --- | --- |
| `GET /api/me/personal-workspace` | Bounded page; `size` 1–100, optional `kind` Note/Task, optional exact `status`, protected query/account-bound cursor. No content search or unbounded export. |
| `POST /api/me/personal-workspace` | Create a personal note/task. `OperationId` is also its new item UUID. |
| `GET /api/me/personal-workspace/{item}` | Current owner-only content and Version. |
| `PUT /api/me/personal-workspace/{item}` | Edit using Version and a new OperationId. Kind remains fixed. |
| `POST /api/me/personal-workspace/{item}/actions` | Explicit conditional lifecycle action using OperationId, Version and Action. |
| `GET /api/me/personal-workspace/{item}/history` | Bounded, owner-only attributed snapshots including original text and completion dates. |

`SavePersonalItemDto` has Kind, SaveAsDraft, optional Title/Category/Tags, Body and optional task Priority/PriorityReason/DueAt. The technical limits are title 500, body 20000, category 100, up to 20 distinct tags of 60 characters and priority reason 2000 characters. Body stays in its authored language and preserves whitespace; saved items require nonblank body. Empty unfinished drafts can be saved and resumed after authentication. There is no inferred approval for the proposed 30-day draft expiry, so no expiry or automatic deletion runs.

Notes move Draft → Saved and can archive/restore. They cannot be marked Completed. Tasks move Draft → Open, then use `start` (InProgress), `wait` (Waiting), `complete`, `reopen` or `cancel`. Unfinished task drafts can archive/restore but cannot complete/cancel into a published state. Completed/cancelled tasks must reopen before content editing. `archive` preserves the prior lifecycle state; `restore` returns to that state. Completion uses the actual server UTC time. Reopening preserves earlier full completion events and LastCompletedAt while clearing the current CompletedAt. Optional due dates are explicit UTC instants; past dates remain valid for overdue personal work. Priority is Routine, TimeSensitive or High, with a reason required for High.

Every change atomically commits the account fence, item, immutable protected revision, encrypted retry record, safe audit and receipt. Stale item/account versions roll everything back. An exact retry returns the current authorized projection rather than restoring an old value. Reusing an operation for different private input fails with idempotency_conflict. Frontend drafts must retain their own authorized entered values after conflicts; no frontend implementation or shared-device cache is included here.

## Verification and remaining work

Eight isolated integration/HTTP tests cover original text and protected storage/history, task completion/reopening/archive state, stale rollback and concurrent account revocation, lost-response/concurrent mismatched retry behavior, administrator/other-account/cursor isolation, restricted/locked authentication, ciphertext substitution, cookies/CSRF/no-store and safe OpenAPI contracts. The focused eight-case run passed on .NET 10.0.14 on 9 November 2026 before the final task-draft transition assertion was added; final integrating verification records the latest result. These tests do not prove live Cosmos or hosted cryptographic access.

The final [personal/guest checkpoint](../verification/backend-2026-11-09-personal-and-guests.md) includes those final assertions: all 23 new-feature integration cases and the complete 196-test suite pass.

H01 remains partial for the complete retained product scope. Attachments and authorized downloads, optional permission-checked links to records, reminders/recurrence delivery, approved trash/erase/retention, frontend audience preview/drafts/accessibility/languages, approved exceptional data recovery/export and live Cosmos/hosted acceptance remain. There are no shared/pastoral tasks, assignment fields or share actions in this account-only slice. Due dates do not schedule or claim reminders, and no retention/deletion policy is invented.

DI requires `AddScoped<PersonalWorkspaceService>()`. New document types in the existing Accounts account partition are personalWorkspaceItem, personalWorkspaceRevision and personalWorkspaceCommand. Bounded queries use existing type filtering plus `data.kind`, `data.status` and `data.itemId`; the storage contract/read-only readiness review must include those paths. Protected content requires no indexing. No Azure resources/policies are mutated by this implementation.
