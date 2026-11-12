# Calendar module

Module file: `frontend/src/portal/model/modules/calendar.js`. Check: `frontend/scripts/checks/calendar.mjs`. Pages: `calendar`, `services`, `music`. Screens: `parish-life/calendar*`, `services*`, `schedules*`, `communicate/music*`.

Owns: `EVENTS`, `EVENT_DETAIL`, `EVENT_TEMPLATES`, `FEASTS`, `SERVICE`, `SERVICE_PLANS`, `SERVICE_TEMPLATES`, `ROTA`, `MUSIC`, `MUSIC_DETAIL`, `SETLISTS`. `PRAYERS` is not owned: prayer intentions are Communications (website, `actions.jsx`).

## Routes used

Everything under `/api/parishes/{id}` unless stated. List routes page with `size` and `cursor`.

| Screen | Route |
| --- | --- |
| Calendar list | `GET calendar/events?start&end` (at most 31 days, so one request per month; the loaded months are the previous month to three ahead, widened when the calendar moves) |
| Event create / edit draft | `POST calendar/events`, `PUT calendar/events/{id}` (with `version`) |
| Recurring event | `POST calendar/series` (count 1–52, every 1–366 days) |
| Confirm, publish, unpublish, cancel | `POST calendar/events/{id}/actions` (`version`; a reason for unpublish and cancel) |
| Feasts | `GET /api/public/parishes/{id}/liturgical-calendar?from&to&lang=en|ar` (anonymous; approved calendar plus the parish's own exceptions, which replace the day) |
| Plans, per event | `GET plans?eventId=` for the 40 nearest events (−7 to +60 days) |
| Plan templates | `GET plans` (no event) |
| Plan save | `POST plans`, `PUT plans/{id}` (with `version`; a new plan with a template and no items is copied from the template by the API) |
| Plan steps | `POST plans/{id}/actions`: submit, approve, return, complete, cancel (return and cancel ask for a reason) |
| Music library | `GET music?size&offset`, `POST music` (new, or a revision with `supersedesId`), `GET music/{id}`, `POST music/{id}/withdraw` |
| My schedule | `GET /api/me/schedule?from&to[&format=ics]` |
| Priest schedule | `GET clergy/schedule?from&to[&format=ics]` (needs a priest appointment and an authenticator sign-in) |

Setlists are derived: the hymns a plan's items name, in order. Plans and music need the authenticator session; without it they load empty (403).

## Mapping decisions

- Times are shown and entered on the event's own time zone (`localParts`, `zonedInstant`); the API stores UTC instants plus a zone id.
- Event kind `ParishActivity` is the only manual kind that can be published; `Appointment` is private. Audience: Public / Parish / Private. Others see private events only as "Busy" (`redacted`), which cannot be opened or edited.
- Only a draft can be edited. Cancelling keeps the event, marked cancelled; nothing is deleted.
- A hymn: occasion = API `season`, part = `category`, key = `musicalKey`, Arabic title = an Arabic `alternateTitles` entry, links sorted by host. Lyrics are stored one line per verse as `Syriac | Arabic | English`; notes as `Instrument: text`. Editing a hymn publishes a revision that supersedes it, so its id changes. "Delete" withdraws the version.
- A new hymn needs a **Rights** statement (the API requires `rightsBasis`); the hymn editor has the field.
- Plan item keys are generated (`item-N`) for new items. Item `start` times are computed by the API from the durations; they are not edited.

## No API equivalent (left empty or not saved)

- Rooms on events, capacity, RSVP counts, tasks, required items, linked groups, assigned priests, wedding participants (event drawer shows only what the API stores).
- Event templates (`EVENT_TEMPLATES` stays empty; the Templates tab says so).
- The volunteer rota and swaps (`ROTA` is blank; edits are undone and reported).
- Setlists as their own records (read-only, derived from plans).
- Personal annotations on hymns, and the history of a hymn's versions.
- Names of the celebrant, coordinator and item assignees: the API uses accounts, the portal people. Plans show "Celebrant: chosen / not chosen". New plans use the signed-in account as coordinator and no celebrant, so a Liturgy plan reports "A celebrant is needed" until one is set (there is no screen for it yet).
- Language and venue of a plan or template.
- Liturgical calendar and exception **management** (the bishop's draft and approval, a priest's exception) has routes but no screen; the portal only reads the result.
- A subscription link for the parish calendar: the API offers one-off downloads of the member's own schedule only.
- Events and plans outside the loaded months / nearest 40 events; reports, notices, facilities and the dashboard read `EVENTS` and `ROTA` too and see the same data.

## Open owner decisions

1. **Parish time zone.** The API has none; new events use the zone of the parish's existing events, else the browser's, shown in the drawer for correction.
2. **Person for an account.** Plans name accounts. Choosing a celebrant, coordinator or assignee needs a way to list accounts or map people to accounts.
3. **Event templates and a rota API** (and swaps): confirm they are wanted, then the backend needs routes.
4. **Event categories.** Mass, sacrament and ministry events come from owning workflows, not manual drafts. Decide whether clergy may create Mass events directly.
5. **Calendar feed.** Is a revocable subscription feed wanted (the API says it is not offered until operational)?
