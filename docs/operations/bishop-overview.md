# Bishop overview, map and parish locations (O08)

Updated 10 November 2026. Source basis: S29.14–S29.16, S04 map answers, field dictionary latitude/longitude. All of this is **proposed** material, implemented as a mechanism; it is not owner-approved policy.

## What works (local tests only)

- `GET /api/archdioceses/{id}/overview?from=…&to=…` — a current accepted bishop of that archdiocese with MFA. If an appointment is selected it must be exactly that bishop appointment; recovery sessions, other archdioceses, platform operators and parish owners are refused. The period is explicit UTC, `from < to`, at most 366 days (a technical bound).
- Parishes in scope are those whose recorded, bishop-accepted jurisdiction is this archdiocese (declared or commercial association does not count). They are listed alphabetically and labelled with status and locality; nothing is ranked or scored.
- Measures (each returned with its definition and whether it is "now" or "period"): current priests (distinct accounts; the jurisdiction total counts a priest once), head priest designated, other current staff, open requests, requests received in the period, certificates awaiting the bishop, membership requests pending, confirmed published events starting in the period.
- Excluded on purpose: confidential concerns, pastoral notes, incidents, person/medical/household data; finance, giving, budget, attendance, participation and membership-change measures (MT05/06/10–12/14 definitions are not approved). Only counts are returned, never record contents, names of people or contacts.
- Oversight gives no drill-down permission: existing record endpoints keep their own rules (for example the bishop's certificate review).
- `GET /api/archdioceses/{id}/overview/map` — same authority. Each parish is `Recorded` (with the coordinates and their source) or `NotRecorded` (no position). Nothing is geocoded or guessed from names or localities.
- `GET|PUT /api/parishes/{id}/location` — current MFA holder of `parish.manage`: record verified latitude (−90..90) and longitude (−180..180) together with a source reference, correct them, or clear both. Versioned (ETag), idempotent by operation ID, audited.

## Limits and not delivered

- No small-count suppression threshold is applied: the sources give none, and the overview contains only operational counts (no personal or confidential categories). A threshold needs owner approval.
- Parish selection reads all parish roots and filters jurisdiction in memory (bounded at 2,000 parishes platform-wide and 200 per jurisdiction) because `/data/jurisdictionArchdioceseId` is not in the TenantControl index policy. Adding that path is a separately authorized index change.
- Counts read each parish partition synchronously; very large parishes fail with `operation_too_large` rather than returning partial numbers.
- Not delivered: finance/attendance/membership reports, exports (CSV/XLSX/PDF), EN/FR/AR report labels, diocesan readers other than the bishop, a map tile provider (frontend), and the frontend itself. Live Cosmos acceptance not performed.
