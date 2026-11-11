# Liturgical calendars (X12)

Updated 11 November 2026. Source basis: S16.11, S01.07, S30.17, all *proposed*. The competent authority, rite and calendar source for the first archdiocese are still owner/diocese inputs (U02); nothing is built in. No feast, season or Easter date is computed or seeded.

## Authority calendars
Routes under `/api/archdioceses/{archdiocese}/liturgical-calendars`; every call needs the **current accepted bishop** of that archdiocese with MFA (proposed reading of "competent authority").
- `PUT /{calendarId}` saves a draft entered from the authority's source: `Rite`, `Year`, `Source`, `VersionLabel`, `ValidFrom`/`ValidTo`, `AllowsParishExceptions` (required true/false), and up to 1000 `Entries` (date inside the period, titles in en/fr/ar, optional authority-supplied `Rank`, `Season` and `DisplayColor` `#RRGGBB`). Create omits `Version`; edits need the current one (`version_required` / `write_conflict`). Only drafts are editable.
- `POST /{calendarId}/actions` with the current version: `approve` (needs at least one entry) or `withdraw` (reason required). Only one approved version per archdiocese, rite and year is current (a conditional seat document serialises approvals). A changed approved calendar is corrected by a new draft with `CorrectsCalendarId` and `CorrectionReason`; approving it marks the old version `Superseded`. Approved versions are never edited, so earlier celebrations keep the calendar that applied.
- `GET /` and `GET /{calendarId}` show drafts, history and approval facts to the bishop.

## Parish exceptions
`/api/parishes/{parish}/liturgical-exceptions`: an appointed priest acting in an appointment with `schedule.publish` and MFA records a local observance (`CalendarId`, `EffectiveFrom`, optional `EffectiveTo` ≤ 31 days, titles, reason) under an approved calendar of the parish's own jurisdiction that **allows** parish exceptions, inside its period; `POST /{id}/withdraw` with version and reason. Recovery sessions and other duties are refused.

## Public read and decoration
`GET /api/public/parishes/{parish}/liturgical-calendar?from&to&lang` (anonymous, cacheable, range ≤ 366 days, default 31 days from today) returns approved entries of the parish's verified archdiocese and active exceptions, each attributed to rite, source and version; exceptions are flagged `ParishException` and their reasons and editors are never shown. A missing title language falls back to English or the first supplied language and says which. `Status: NotPublished` means no approved calendar exists, never "no observances". `DisplayColor` is the authority's value; the frontend must still meet the proposed contrast targets (S30.17) when using it for decoration.

## Not delivered
A separate preparer role (e.g. a delegated archdiocese liturgy office) and second reviewer, file upload/import of calendars, cross-jurisdiction combined views, linking service plans/events to the calendar applied at their date, contrast checking of display colors, and the frontend. Local tests do not prove live Cosmos behaviour.
