# Scheduled report delivery (W04)

Updated 10 November 2026. Source basis: S26.10–S26.15, S29.16, S29.18 and the W04 contract in the feature matrix (proposed, not owner-approved).

## What works (local tests only)

- `POST /api/report-schedules` — a current MFA account in personal capacity (no selected appointment, no recovery session) schedules the **parish work overview** for itself: `Daily` or `Weekly` (with `dayOfWeek`), a local hour 0–23 and an IANA time zone. Creating it requires that the account currently sees at least one queue of that report. Idempotent by operation ID.
- `GET /api/report-schedules`, `GET /api/report-schedules/{id}`, `POST /api/report-schedules/{id}/actions` (`pause`, `resume`, `cancel` with the current version). Resuming rechecks current access and computes the next run from now.
- Runner: `ReportScheduleWorker` (only when `BackgroundJobs:Enabled`) scans active schedules each minute. For a due schedule it re-authorizes the recipient (active verified MFA account, parish not suspended/closed, current direct grant per queue) and commits in one account-partition transaction, keyed to the schedule and due time: the delivery snapshot, an in-app notice (topic `reports`, optional and mutable) and the advanced schedule. Replays never create a second delivery. Missed runs are not backfilled.
- If the recipient has lost access the run is stored as `NotAuthorized` with no contents, the schedule is paused and a required notice says so.
- `GET /api/report-deliveries` lists delivery metadata; `GET /api/report-deliveries/{id}` shows the snapshot counts only for queues the reader can **still** see now; with none left it is not found.
- Email: a schedule may request an email copy; each delivery records `Email: NotConfigured`. Nothing is sent and no external delivery is claimed.

## Limits and not delivered

- Only the parish work overview can be scheduled; bishop overview and other reports are not schedulable yet.
- The runner evaluates direct parish grants only, so schedules cannot be created under a selected staff appointment.
- Not delivered: email/SMS providers, quiet hours/digests, retry/escalation for failed external sends, shared audiences, attachments/exports and the frontend. Live Cosmos acceptance not performed.
