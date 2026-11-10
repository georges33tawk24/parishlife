# Public-site metrics and Super Admin Insights (X06)

Updated 10 November 2026. Source basis: S29.14–S29.17, S32.01 and the X06 contract in the feature matrix (proposed, not owner-approved).

## What works (local tests only)

- `POST /api/public/site-metrics` (anonymous, rate limited by the existing per-connection policy; the address is never stored) with `{ kind, language?, parishId? }`. Kinds are allowlisted: `home.view`, `directory.view` (no parish), `parish.view`, `request.start` (verified parish required). Language is `en`, `fr`, `ar` or recorded as `unknown`. Always answers 202.
- Storage: anonymous counters in the Catalog container, one partition per UTC day (`platform:site-metrics-yyyyMMdd`), spread over four shards. No IP, visitor key, device, referrer, search text or location is stored, and no receipt or audit row is written for an untrusted beacon. An increment that keeps conflicting is dropped, so counts are a lower bound and never inflated.
- `GET /api/administration/insights?from=yyyy-MM-dd&to=yyyy-MM-dd` — current MFA platform operator in personal capacity (bishops, parish staff, recovery sessions and selected appointments are refused). Returns daily counts per kind/language/parish (shards summed), parish counts by status and with/without recorded jurisdiction, and notes explaining the limits. At most 93 days per read (technical bound).
- Insights contain no parish names, clergy, person, case or finance data and grant no access to any record.

## Limits and not delivered

- Bots and blocked scripts are not distinguished; there is no bot check (not configured).
- No retention period is approved (S32.01): aggregates are not purged. The legacy 95-day behaviour is not a retention approval.
- Not delivered: funnels, referrer/device aggregates and daily visitor hashes from the legacy system (deliberately not stored), completeness/health scores, scoped viewers beyond the platform operator, exports and the frontend beacon/dashboards. Live Cosmos acceptance not performed.
