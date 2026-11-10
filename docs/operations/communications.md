# Communications operations

Updated 10 November 2026. Source basis: S26.01–S26.16 (proposed). In-app storage is the baseline: "sent in-app" means stored for the intended recipient. No email, SMS or other external channel is implemented, so no delivery, receipt or reading is ever reported beyond what is recorded.

## Announcements (`/api/parishes/{parish}/announcements`)

- communications.manage creates and edits **drafts** with an explicit audience: Public, Members (linked parishioners) or Ministry (current members of one ministry), plus category, language (en/fr/ar), pin and expiry. Translations are separate announcements; none is generated.
- `POST /announcements/{id}/actions` publishes or withdraws (with a reason). Public announcements also need publishing.manage. Published announcements are never edited in place: withdraw and publish a new one.
- `GET /announcements/mine` gives a linked member public, member and current-ministry announcements; `GET /api/public/parishes/{parish}/announcements` gives anonymous readers public ones only. Expired, draft and withdrawn items are excluded, pinned items come first, and audience readers never see the publisher's account.

## Prayer intentions (`/api/parishes/{parish}/prayer-intentions`)

Any signed-in personal account submits an intention with the most public use it allows: ClergyPrivate (default), AnonymousPublic or IdentifiedPublic (with the name to show). Only current parish priests read the list and decide: publish anonymously or with the name, keep private or decline, never beyond the submitter's limit. Office staff without priest authority cannot read clergy-private intentions. `GET /api/public/parishes/{parish}/prayer-intentions` shows published text, with a name only for identified publication.

## Notifications (`/api/notifications`)

- Seven integrated services now stage required notice work in the same parish transaction as the source change, then store the recipient notice and acknowledge the work separately. New staged obligations use parish-scoped version 2 identities; confirmed legacy notices can be reused without resetting their state. A failed or interrupted dispatch leaves obligations pending for recovery; pending work may already have a recipient notice if acknowledgment failed. Request updates use neutral wording; concern updates reveal no category, subject or identity; inbox notices go to the current permitted participants. The [required notification runbook](required-notification-outbox.md) lists all nine audiences, worker bounds, current-access checks, exact legacy-work recovery and rollout limits. It does not backfill notices missed before staging existed or claim external delivery.
- `GET /api/notifications?status=`, `POST /api/notifications/{id}/state` (Read/Unread/Archived) and `GET/PUT /api/notifications/preferences` (muted optional topics, language, digest). Required own-case and security notices cannot be muted.

## Inbox (`/api/parishes/{parish}/inbox`)

- Members start conversations only with the parish office; there is no searchable person directory. Office staff (communications.manage) share the office inbox, each acting under their own account, and replies are attributed with capacity Office. Staff may also start a direct conversation with a linked parishioner of the parish.
- Sent messages cannot be edited or deleted. Read and archive state is per participant and never removes the other side's record.

## Broadcasts and templates (N05, `/api/parishes/{parish}/broadcasts`, `/broadcast-templates`)

Proposed basis: S26.09–S26.15, WF46 and permission row P26 ("separate publisher/permission review"); none of this is owner-approved policy.

- Staff with `communications.manage`, MFA and the core module draft templates and broadcasts. A template or broadcast is approved only by a **different** staff account than its last editor, against the exact current version (`POST .../actions` with `approve`). Approved templates are immutable (`retire` to withdraw); approved broadcasts cannot be edited, only sent or cancelled (cancel needs a reason).
- Audiences: `Members` (active parish person-account links) or `Ministry` (current members of one ministry who have an active link). The audience is **resolved at send time**: active verified accounts only, and accounts that muted the optional topic `parish.broadcast` are skipped and counted. `GET .../audience-preview` returns counts only; no list of people is exposed.
- `send` stores the broadcast once with its internal recipient list in the parish partition, in the same transaction as the status change: that stored record is each recipient's in-app copy ("sent in-app" = stored for the intended recipient). Staff projections show `RecipientCount`, `SkippedByPreferenceCount` and per-channel state: `InApp` `Stored`/`NotSent`; `Email`, `Sms`, `Push` always `NotConfigured` because no provider exists. Nothing reports external sending, delivery or reading.
- `GET .../broadcasts/mine` returns only the caller's own copies (title, body, language, sent time) without other recipients or the sending account; recovery sessions are refused.
- Limits (ponytail): at most 2000 recipients per broadcast (technical document bound, not policy); in-memory recipient filtering over 500 sent broadcasts; no bell notification is added for broadcasts; no scheduling, quiet hours, digests, translation linking, per-recipient read state, retries or external providers; ministry leaders cannot author broadcasts yet.

## Message reports and exceptional exact-message review (N02)

Proposed basis: S26.16, S02.13 (reason, independent approval and audit are separate controls) and P26 ("exceptional exact-message review by eligible Super Admin with reason/audit"; "no broad inbox dump").

- A conversation participant (personal member or office staff under the normal inbox gate) reports one exact message someone else sent: `POST /inbox/{conversation}/messages/{message}/reports` with an explanation (protected at rest). `GET /inbox/reports/mine` shows the reporter's own reports with only the neutral outcome chosen for them.
- Platform operators (MFA, no selected appointment) see open reports at `GET /message-reports` (with explanation and reporter account), excluding any conversation in which they are a participant, creator or message author. `POST /message-reports/{id}/close` records a neutral reporter outcome.
- `POST /message-reviews` requests review of **one exact message** with a required reason (optionally citing an open report about that message). A **different** operator decides at `POST /message-reviews/{id}/decision` (`Approve` required; approval needs `AccessMinutes` 5–1440, a technical bound pending owner policy). Conflicted operators cannot request, decide, read or close. Rank alone grants nothing.
- Only the requester reads `GET /message-reviews/{id}/message`, only while Approved and before `AccessUntil`. It returns that single message (author account, capacity, body, time), never the subject, other messages or participants. Every read is a separate audited write that increments `ReadCount`; reasons are stored in the audit `reason`. An approved review past its window reads as `Expired`.
- `POST /message-reviews/{id}/close` (requester or approver) ends it with a note and, when it came from a report, closes the report with the required neutral reporter outcome in the same transaction.
- Not implemented: blocking unwanted contact, a parish-level (non-platform) report handler, escalation routing beyond platform operators, notifications to reporters/reviewers, and retention of reports. Live Cosmos behavior is not verified.

Not implemented: external channels (email/SMS/WhatsApp) and their delivery evidence, scheduled reminder rules, group posts/discussions, leader-scoped announcements/broadcasts, attachments, quiet hours and digests beyond stored preferences.
