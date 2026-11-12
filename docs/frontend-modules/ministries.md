# Ministries module

Groups and ministries, members, join applications, leadership, meetings, attendance, formation, belongings, volunteer sign-up sheets and the member's ministry requests. Code: `frontend/src/portal/model/modules/ministries.js`. Check: `frontend/scripts/checks/ministries.mjs`. Pages: `groups`, `ministryrequests`, `attendance`, `volunteers`. API: `ParishLife.Api/Controllers/Ministries`.

## How it loads

Collections it owns: `GROUPS`, `GROUP_DETAIL`, `VOLUNTEERS`, `SIGNUP_SHEETS`, `ATTENDANCE_SERIES`.

The API pages with `?size=&cursor=` (not `continuation`), and answers **404** (not 403) when an account lacks the duty for a read. Every per-ministry read is therefore optional: a refused read leaves that part empty.

- **Which ministries:** the priest, or a grant with `ministries.manage`, lists all (`GET ministries`); archived ones are left out. A leader has no list route, so the ministry ids and duties come from `GET /api/me/capacities` (`MinistryLeader` entries) and each is read with `GET ministries/{id}`.
- **Meetings** are read in 30-day windows (the API's limit): six months back, three ahead. Cancelled meetings are left out.
- **Attendance** is read for confirmed meetings that started in the last 90 days, when the account has an attendance duty.

## Routes used

| Area | Routes |
| --- | --- |
| Lifecycle | `GET/POST ministries`, `GET/PUT ministries/{id}`, `POST ministries/{id}/actions` (approve, publish, unpublish, open/close-applications, archive) |
| Public catalogue | `GET /api/public/parishes/{id}/ministries` |
| Roster, leadership | `GET .../roster`, `GET .../leadership`, `GET person-account-links/{accountId}` (leader account → person) |
| Applications | `GET .../applications?kind=Join\|Leave`, `GET .../applications/mine`, `POST .../applications`, `POST .../applications/{id}/actions`, `GET .../membership/mine`, `PUT .../applications/{id}/private-reason` |
| Meetings | `GET/POST .../meetings`, `GET/PUT .../meetings/{id}`, `POST .../meetings/{id}/actions` (confirm, cancel), `GET .../meetings/{id}/rsvps` |
| Attendance | `GET/POST .../attendance`, `POST .../attendance/snapshot`, `GET .../attendance/rows`, `POST .../attendance/records` |
| Formation (read) | `GET .../formation/programs`, `GET .../formation/enrollments` |
| Belongings | `GET/POST/PUT .../stock`, `GET .../loans` |
| Volunteers | `GET .../volunteering/opportunities`, `.../opportunities/{id}/assignments`, `.../people/{personId}/hours`, `POST .../opportunities/{id}/actions` (cancel) |

## What works

- **Groups:** create (saved as a **draft**), edit (drafts only, the API refuses the rest and the message shows), archive (the delete button). Status panel on the group: approve (priest), publish/unpublish, open/close applications.
- **Join requests** on a group's overview: a priest approves (needs the eligibility review reference) or declines (reason); a leader recommends or returns the request with a reason.
- **Meetings:** create (future drafts), edit (drafts), **Confirm meeting** button (draft → confirmed), delete (cancels). Time zone: the group's other meetings', else the browser's. No end time means one hour.
- **Attendance:** marking a status opens the sheet if needed, builds its expected roster, then records the change. Sheets are left open; closing needs a reporting reference and reason the screens do not collect.
- **Belongings** create, edit, delete (retires) as stock.
- **Ministry requests page:** the published ministries of each followed parish, own applications (withdraw), applications to review in the open parish (leaders: joins; priests: also departures), ask to join or leave. A leaving note goes to the private-reason route.
- **Sign-up sheets:** loaded from volunteer opportunities; deleting one cancels it.

## Fields with no API equivalent (left empty or not saved)

- Group: Arabic name (copied from the name), "meets" text, visibility (shown as public when published, else private), budget, posts, files, tasks, history, automations and messaging rules, signup QR.
- Roster: adding or removing a member, assigning roles, leadership handover and assistants from the screens. Membership comes only from approved applications; leaders are appointed with `POST .../leadership` (priest, with evidence reference and eligibility), not wired.
- Leaders appear by person only when the account is linked to a person you may read (`people.write`); otherwise the role row shows a dash.
- Meetings for chosen people or "committee only" (no participant field); Late attendance shows as present; attendance import from a workbook (old route); guests (need an identity review reference).
- Formation is **read-only**: milestones and completions load from the approved program and enrollments. Creating programs, enrolling and recording progress need review references the screens do not ask for.
- Resource loans are read-only (the API's request → approve → issue → return flow differs from the screen's free-text borrower).
- Volunteers: skills, availability, training, safeguarding clearance (shown as "not recorded here") and the rota. Hours are the verified hours the API holds. Creating or editing a sign-up sheet (needs a ministry and a position).
- Hours review, RSVP replies and the private RSVP reason, other attendance corrections.

## Open decisions for the owner

1. **Parish time zone:** the API has none, so new meetings use the group's existing meetings' zone or the browser's. Expose a parish time zone?
2. **New groups are drafts:** should a priest creating a group approve it at once?
3. **Attendance closing:** which reporting reference and reason should the screen collect to close a sheet?
4. **Leader list route:** leaders cannot list ministries; their ministries come from capacities. A "my ministries" route would be simpler.
5. **Sign-up sheets and volunteers:** which ministry and position a sheet belongs to; whether volunteer skills and clearance belong in ParishLife.

## Not verified live

Only the mock check was run (a local API needs a verified account and a priest appointment). Routes and fields were taken from the C# controllers and DTOs.
