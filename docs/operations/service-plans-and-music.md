# Service plans and music library operations

Updated 10 November 2026. Source basis: S17.01–S17.12 (proposed). A calendar event is the scheduled occurrence; a service plan is its operational running order and never changes the event's booked times or resources. Routes are under `/api/parishes/{parish}`. The earlier stub service (save/publish only, no reads, MFA or review) was replaced.

## Plans and templates (schedule.manage; reads schedule.read)

- `POST /plans`, `PUT /plans/{plan}` save a Draft plan linked to an existing uncancelled event (`EventId`) or, without an event, a reusable template. A plan has a title, type (Liturgy or Activity), an active verified coordinator, an optional celebrant and up to 80 items (key, title, minutes or a fixed start, responsible role, required flag, assignee, instructions with an audience of Clergy/Team/Everyone, and a pinned music version). Templates carry structure only: no assignees, celebrant or fixed times.
- With `TemplateId` and no items, an approved template's structure, durations, instructions and music references are copied; people and times are left for review. Later template changes never alter saved plans.
- Responses compute each item's start and end from the event start (items follow each other; a fixed start is a constraint) and list blocking issues: `Overtime`, `FixedStartConflict:{item}`, `UnassignedRole:{item}`, `CelebrantRequired` (a Liturgy needs a current parish priest), `MusicUnavailable:{item}` and `EventUnavailable`.
- `POST /plans/{plan}/actions`: `submit` (Draft/Returned → ReadyForReview, no blocking issues), `return` with a reason and `approve` (both by a current parish priest), `complete` (after the event ends) and `cancel` with a reason. Approved plans are not edited; a change needs a new plan.
- `GET /plans?eventId=` lists an event's plans; without `eventId` it lists templates.
- `GET /plans/{plan}/outputs/{clergy|team|musicians|participants}` produces an audience-specific sheet from an approved plan: clergy see all instructions, team sees Team/Everyone instructions and assignees, participants see Everyone instructions without people, and musicians get a setlist whose lyrics/chords appear only when that version allows printing, with its attribution.

## Music library (music.manage; reads schedule.read)

- `POST /music` publishes a version with title, alternate titles, language, rite, season, composer, key, instrumentation, category, lyrics, chords, notes, HTTPS media links, a required rights basis, attribution and separate download/print/projection permissions. With `SupersedesId` it revises the active version of the same work (same `WorkId`), marking the old one Superseded in the same transaction.
- Versions are immutable, so a plan that pins one never changes. `POST /music/{id}/withdraw` (with a reason) removes a version's materials and permissions; plans that use it show `MusicUnavailable`.
- `GET /music?text=&language=&season=&rite=&includeInactive=&offset=` searches title, alternate titles and composer. The search filters up to 2,000 versions per parish in memory; a larger library needs indexed or full-text search.

Not implemented: diocesan music custodians and shared libraries, file uploads (media are links), projection/download delivery, multilingual program text, resource/clergy conflict checks across other events, and print/PDF rendering.
