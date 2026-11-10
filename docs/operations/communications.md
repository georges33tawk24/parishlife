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

Not implemented: external channels (email/SMS/WhatsApp) and their delivery evidence, scheduled reminder rules, broadcasts and templates (N05), group posts/discussions, leader-scoped announcements, exact-message review/reporting (N02), attachments, quiet hours and digests beyond stored preferences.
