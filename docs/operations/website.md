# Parish website operations

Updated 10 November 2026. Source basis: S05.01, S05.03–S05.05 (proposed). Editor routes are under `/api/parishes/{parish}/website/sections` and need publishing.manage, current MFA and the core module; return, publish and unpublish also need an acting priest appointment.

- `PUT /{key}/draft` saves the one working revision of a section (keys are short lowercase slugs such as `about` or `visiting-hours`). Languages may be partial while drafting. Saving a draft never changes the live revision. A revision waiting for review cannot be edited until it is returned.
- `POST /{key}/revisions/{revision}/actions` with the revision's current version:
  - `submit` needs English, French and Arabic.
  - `return` (priest) needs a reason that the editor sees.
  - `publish` (a priest other than the author) makes the revision live and marks the previous live one Superseded.
  - `unpublish` (priest) takes the live revision down, with a reason.
- `GET /` lists sections with their live and pending revisions, missing languages and versions.
- `GET /api/public/parishes/{parish}/website?lang=en|fr|ar` (anonymous) returns only published sections of a verified parish in that language. Text is plain and must be rendered escaped.

Not implemented: scheduled publication and expiry (no scheduler runs them; publish manually), structured Mass/confession schedules, the gallery and images (no file storage yet), phone/desktop previews, clergy- and diocese-owned fact fields, and frontend.
