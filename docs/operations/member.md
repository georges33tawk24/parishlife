# Member portal additions (fullstack2-member)

Backend boundary for the member area round. Local tests only; nothing here was run against Azure.

## Routes

| Route | Service | Who | Writes |
| --- | --- | --- | --- |
| `GET /api/parishes/{parishId}/me/ministry-resources` | `MemberMinistryResourceService` | the signed-in account in its personal capacity, with an active claimed link to an unarchived person in the parish | none |
| `GET /api/me/notification-topics` | `NotificationTopicCatalog` | any signed-in account | none |
| `POST/PUT /api/me/personal-workspace` (existing) | `PersonalWorkspaceService` | the account itself | new fields only |

## Private notes: pin, reminder, meeting link

- `Pinned`, `ReminderAt` (explicit UTC) and the linked meeting (`MeetingParishId`, `MeetingMinistryId`, `MeetingId`: all three or none) live in `PersonalWorkspaceContent`, inside the account-bound protected payload. Audit, receipts and the private command record carry no plain value.
- Linking checks `MinistryMeetingService.GetAsync` as the current account when the link is new or changed, so a stranger cannot reference a meeting they cannot read. An unchanged link is kept after the member leaves the ministry.
- A reminder sends nothing. There is no job, notice or external delivery behind it.
- `PersonalWorkspaceService` now takes `MinistryMeetingService` as a dependency (read only). No ministry model changed.

## My resources

- Reads `ministryMembership` by `personId` (already indexed in `TenantControl`), keeps periods that are current now and pass `MinistryAccess.IsCurrentMemberAsync`, requires the ministry to be `Active`, then pages `ministryStock` by `ministryId` and `status = Active` (both already indexed). No `containers.json` change.
- Projection: id, ministry id and name, item name, total, on loan, available, updated time. `Storage` and `UpdatedBy` are not returned.
- Bounds: 50 ministries, 500 items; `Truncated` reports a cut.
- Refusals (404): appointment header, recovery session, locked account, unverified parish, no active link.

## Notification topics

- Optional (a mute has effect): `parish.broadcast` (`BroadcastService.Topic`), `reports` (`ReportScheduleProcessor.Topic`).
- Required (never suppressed; `StageRequired` ignores preferences): certificate, concern, inbox, incident, letter, membership, parish ownership and status, person invitation, profile correction, registration and request updates.
- `MemberPortalTests.Topic_catalog_matches_every_required_and_preference_checked_topic_in_the_api_source` reads `ParishLife.Api/Services` and fails when a `StageRequired` topic or a `MutedTopics.Contains(Topic` check is added without updating the catalog. After merging an area that adds topics (communications), update `NotificationTopicCatalog`.
- `PUT notifications/preferences` is unchanged (communications area). The member screen only sends mutes for optional topics.

## Shared files touched

- `ParishLife.Api/Extensions/ServiceCollectionExtensions.cs`: two lines after `PersonalWorkspaceService` (`MemberMinistryResourceService` scoped, `NotificationTopicCatalog` singleton).
- No change to `docs/cosmos/containers.json`, `frontend/src/portal/model/modules/index.js`, `frontend/scripts/check-api.mjs` or `frontend/scripts/route-gaps.json`.
