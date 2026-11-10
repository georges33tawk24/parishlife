# Required in-app notification recovery

Updated 10 November 2026. Source basis: S26 notification behavior and S31.09–S31.11 interruption/recovery requirements (proposed). This runbook describes the implemented backend boundary; it does not approve external delivery, retention or other outstanding product policy.

## Source commit and recipient storage

The integrated producers call `NotificationService.StageRequired` while preparing their own parish transaction. The source change, a `notificationWork` record, the operation receipt and audit commit together in the same parish partition. A rejected source transaction creates no notification obligation. For a newly staged obligation, a crash after the source commit and before dispatch leaves the obligation recorded; it does not lose that obligation between the two calls.

After the source commit, `DispatchAsync` attempts to store the notice in the recipient's account partition. It confirms the current notification row and its matching notification-operation receipt before acknowledging the parish work. Recipient storage and the parish acknowledgment are separate commits. They are not a cross-partition transaction.

The two work states mean:

| State | Meaning |
| --- | --- |
| `Pending` | Recipient storage has not been acknowledged. A recipient notice **may already exist**, for example after account storage succeeds but acknowledgment fails, or eligibility changes before acknowledgment. Do not treat this state as proof that nothing reached the account. |
| `Stored` | The dispatcher confirmed a matching in-app recipient notice and its receipt, rechecked the audience, and committed the acknowledgment. New acknowledgments record its actual `RecipientNotificationId`, which may differ from the work ID when reusing or recovering a legacy identity. It does not mean emailed, delivered to a device or read. |

Known storage/configuration failures leave work pending and log only the failure type. They do not change an already effective business action into a failed action. Missing permissions or incompatible storage may require operator repair; another worker tick is not proof those problems will resolve themselves. Caller cancellation propagates, with the already committed obligation retained.

## Integrated producers and audiences

Seven services stage the following nine audience types. Work contains neutral notice wording and the exact source identifier, without private request details, concern categories, invitation tokens or incident report text.

| Producer | Audience | Current recipient check |
| --- | --- | --- |
| `RequestService` | `RequestApplicant` | The exact request's current `ApplicantAccountId`. Applicant-visible acceptance, return, decline, cancellation, priest approval, confirmed date and completion changes stage notices. |
| `RequestService` | `RequestAssociation` | The source transaction captures the reviewed claimant before clearing it. A generic outcome with no link can reach that historical claimant after a declined claim. An outcome carrying a case link requires that account to remain the request's current applicant. |
| `MembershipService` | `MembershipApplicant` | The exact membership request's applicant, including its historical own-request tracking. |
| `MembershipService` | `CorrectionApplicant` | The exact profile correction's applicant. |
| `ConcernService` | `ConcernApplicant` | The exact concern's submitter. The neutral own-case notice does not require a current person link or an operating parish. |
| `InboxService` | `InboxParticipant` | A current named participant in the exact conversation. The initiating office account in a Direct conversation additionally needs current `communications.manage` authority. No new shared-office recipients are invented. |
| `IncidentService` | `IncidentHandler` | The exact incident's current handler, with current `incidents.manage` authority and office coverage. An old assignment does not notify a different or departed handler. |
| `PersonInvitationService` | `InvitationIssuer` | The exact invitation's issuer, with current `people.write` authority and office coverage. |
| `ParishStatusService` | `ParishOwner` | The parish's current owner, including when the notice records suspension or closure. |

Every recipient must still be an active, verified account. Own-case/history audiences follow the typed source relationship; the dispatcher does not add a blanket parish-status or current-person-link restriction to routes that permit historical tracking.

Staff checks use stored account facts: enabled MFA, current account eligibility and lockout state, explicit parish denials, and any required module coverage. A current explicit grant can authorize the one required permission. Alternatively, one accepted and effective priest appointment must independently permit it, belong to that account and parish, match the current factual jurisdiction, and have a verified archdiocese. Duties from several appointments are not combined. No browser identity, selected role or MFA session claim is fabricated by the worker.

Eligibility is checked before recipient storage and again before acknowledgment. These checks span source and account reads; **eligibility changes and recipient storage are not atomic across partitions**. A concurrent revocation can occur between a check and a write. The notice is neutral, its link still enforces the destination endpoint's authorization, and work is not acknowledged when the later check finds the recipient ineligible. A notice already stored is not recalled by this mechanism.

Inactive accounts, revoked staff, changed handlers and other currently ineligible audiences leave their work `Pending`. This implementation does not discard that work, silently substitute another recipient or introduce a `Suppressed` state.

## Worker and storage

`NotificationWorker` follows the reservation worker's `BackgroundJobs:Enabled` gate. An explicit value wins; when absent, jobs are disabled in Development and enabled outside Development. Hosted workers are not registered for the private operator-workstation mode.

When enabled, the worker makes an initial pass, then processes on fifteen-second timer ticks. Each pass scans at most **25 pending obligations** and retains its continuation for the next pass. A large queue therefore spans several passes; reaching the end starts a new cursor cycle on the next pass, revisiting work still pending. This is a bound per pass, not a promise that every pending notice is retried or stored within fifteen seconds. Multiple hosts can examine the same work; the account deduplication receipt and conditional parish acknowledgment make those attempts safe without leases.

Parish work uses the existing `TenantControl` container and `parish:{id}` partition. Recipient notices use the existing `Accounts` container and account partition. Pending scans use the existing type/status index paths; staff lookups use the existing account-id path. No container, index policy, credential, RBAC rule or Azure resource is created or changed by this implementation or worker startup. These source contracts do not establish that the deployed Azure configuration has been verified.

## Versioned identities and legacy recovery

`NotificationWork.IdentityVersion` defaults to **1** when an existing serialized work record has no such field. `StageRequired` now creates version **2** work. Its ID is the first sixteen SHA-256 bytes, formatted as a GUID, of UTF-8 `ParishLife.Notification.v2\n` followed by the JSON string array `[account, parish, dedupKey]`. The domain prefix and array encoding distinguish the new contract and include the parish boundary. New staged obligations for one account with the same event key in different parishes therefore have independent identities.

Version 2 recipient writes use that scoped ID and a versioned `notification:v2:{parish}` receipt scope. The receipt fingerprint contains identity version, parish, topic and deduplication key; it contains no private message, request, concern or incident content. Direct `NotifyAsync`, including optional calls, deliberately retains its original account-plus-deduplication-key ID and original receipt fingerprint.

`DispatchAsync(parish, account, dedupKey)` resolves existing version 2 work first, then existing legacy work. The processor uses `DispatchWorkAsync(parish, id)` for the **exact saved work ID**, so a pending version 1 obligation is not accidentally skipped in favor of a newer identity. The saved version must agree with the derived work ID and parish; an unsupported version or malformed identity remains pending for review. Existing stored work is not rewritten or upgraded.

For version 2 work, an existing scoped recipient row is checked first and must have its matching scoped receipt. If absent, a matching legacy recipient row can be reused only with its original matching receipt. Checks include notification ID, account, parish, topic, kind and source link. Historical title wording, original timestamp and Read/Unread/Archived state remain untouched. A write conflict or a recipient row by itself does not prove successful storage. A matching row with a missing or incompatible receipt remains pending rather than creating another notice.

The legacy hash omitted the parish. An exact legacy ID/account row explicitly naming a different nonempty parish no longer blocks a new scoped notice for a proven obligation. The foreign notice is preserved, and the dispatcher creates or verifies the correctly scoped recipient notice instead. Same-parish topic/kind/link conflicts and malformed legacy ID/account values still remain pending; they are not treated as permission to create a second notice under another key.

This narrow recovery also applies to an **existing pending version 1 obligation** whose recipient ID collided with another parish. That durable work already records the source obligation and still must pass current typed-audience checks. The dispatcher prefers a matching existing scoped recipient, including one stored before a lost acknowledgment, or creates/verifies it when the exact legacy row belongs to another parish. It preserves the work's original ID and `IdentityVersion = 1`; it creates no new source obligation. The acknowledgment records the actual confirmed `RecipientNotificationId`, whether legacy or scoped. Older already-stored work can retain a null recipient-ID field and is left unchanged.

Unresolved identity/receipt conflicts remain pending for authorized operator review without overwriting a notice. The work record has no persisted failure-category field; logs contain failure types only. Unsupported or corrupt identities are not automatically migrated.

## Rollout and historical limits

The normal producer operation-receipt replay path returns before preparing another `StageRequired` change, and the source transaction also honors an existing committed receipt. A completed source operation is not replayed to manufacture a version 2 obligation. This change does not backfill notices missed before outbox staging existed or reconstruct missing historical source events.

Operators must coordinate old/new relay rollout and must not manually duplicate one event as both version 1 and version 2 work. Account commits deduplicate within the selected recipient identity; they do **not atomically reserve both legacy and scoped IDs together**. Independently duplicated obligations or overlapping older relay behavior can race before a matching recipient is visible. Reuse of a confirmed legacy notice is compatibility and narrow recovery, not a claim of atomic cross-version migration.

Optional direct `NotifyAsync` calls retain their existing mute behavior; required staged notices bypass optional-topic muting.

No email/SMS/push delivery, delivery receipts, quiet-hour/digest scheduler, retention period, automatic purge or evidence-deletion policy is added. Work acknowledgment is not a claim of whole-product or live-service acceptance. No Azure acceptance checks were performed for this change; current local verification is recorded separately by the repository's verification checkpoint.
