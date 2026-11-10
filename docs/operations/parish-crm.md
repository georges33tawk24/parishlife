# Parish CRM and adoption follow-up (X07)

Private, **manual** platform adoption tracking. It is not pastoral care, is never shown to parish users and sends nothing automatically. Stage names, the worklist and note rules come from the *proposed* X07 contract in the feature matrix; they are not owner-approved policy.

## Access
Only a current, verified, MFA platform operator acting as themselves (no selected appointment, no recovery session) may use any route. Unknown or malformed parish ids look like missing resources.

## Routes
- `GET|PUT /api/administration/parishes/{parishId}/crm` — read / save the single record. Save needs the current `Version` (omitted version on an existing record is `version_required`; a stale one is `write_conflict`).
- `POST .../crm/notes` — add a sanitized note (needs current version; it cannot claim a future occurrence).
- `GET .../crm/history`, `.../crm/history/{entryId}` — immutable entries with previous/current snapshots; reasons and notes are stored protected.
- `GET .../crm/due-follow-up` — the record only when its follow-up time has passed.
- `GET /api/administration/parish-crm/worklist?stage=&dueOnly=&size=&cursor=` — all tracked parishes, due items first.

## Rules
- Stage is exactly `Onboarding`, `Active`, `Attention` or `Paused`.
- A dated follow-up needs an explicit next action; an assigned owner must be a currently eligible platform operator.
- Exact retries (same operation id) replay without a second history entry.

## Limits
The worklist scans the platform partitions across the Catalog container (the only non-runtime type allowed in `ScanWorkAsync`), then filters in memory, so a page can hold fewer rows than requested; follow the continuation token. Local tests do not prove live Cosmos cross-partition behavior or cost.
