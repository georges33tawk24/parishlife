# Member module

Connects the member portal to ParishLife.Api: the combined home, my parishes, membership, my record, my parish life, my calendar, my concerns, notifications, consents, my data, and notes and tasks.

- Data layer: `frontend/src/portal/model/member-data.js` (the member view model `M`, `loadMember`, `memberAction`, `loadActivity`, `activityAction`) and `frontend/src/portal/model/modules/member.js` (keys `NOTES`, the linked person, the clergy's Notes & Tasks).
- Screens: `features/member/*` (not `requests*`) and `features/records/notes.jsx`.
- Check: `frontend/scripts/checks/member.mjs`.

## How it works

- **Person link.** `GET /api/parishes/{id}/person-account-links/mine` sets the account's person in the open parish (`session.user.person_id`). It opens the member pages. A member without a link lands on **My parish life**, where they follow parishes and ask for membership.
- **Member pages** read `M`, which `loadMember()` fills when a member page opens. Every change goes through `memberAction(op, values)`, which makes the API calls and then reloads `M`. An op with no route throws the "not connected" message, and the page shows it.
- **Fields of `M` owned by the requests module** (`requests`, `requestOptions`) are left alone.
- **Notes & Tasks** (`notes`, priest only) is the clergy's pastoral notes and follow-ups, so it uses the Care routes through the shared view model (`NOTES`, `save`). The account-private **My Notes** page (`mynotes`) uses the personal workspace.

## Routes used

All under `/api/`. `{p}` is `parishes/{parishId}`.

| Page / area | Routes |
| --- | --- |
| Person link | `GET {p}/person-account-links/mine` |
| Home | `GET me/home`, `GET me/parishes`, `GET {p}/announcements/mine` |
| My parishes (activity) | `GET me/parishes`, `POST {p}/follow`, `DELETE {p}/follow`, `PUT {p}/primary`, `GET public/parishes` (to pick a parish to follow) |
| Membership | `GET {p}/membership-requests/mine`, `POST {p}/membership-requests`, `POST {p}/membership-requests/{id}/withdraw` |
| My record and corrections (myprofile) | `GET {p}/me/data`, `GET {p}/profile-corrections/mine`, `POST {p}/profile-corrections`, `POST {p}/profile-corrections/{id}/withdraw` |
| My ministries | `GET public/parishes/{id}/ministries`, then `GET {p}/ministries/{id}/membership/mine` for each |
| Meetings, RSVP, attendance | `GET {p}/ministries/{id}/meetings?start&end` (31-day windows: the last 31 days and the next 62), `GET .../meetings/{id}/rsvp`, `PUT .../meetings/{id}/rsvp`, `GET .../meetings/{id}/attendance/mine` |
| Formation | `GET {p}/ministries/{id}/formation/enrollments/mine` |
| Commitments | `GET {p}/ministries/{id}/volunteering/opportunities/open`, `.../assignments/mine`, `POST .../opportunities/{id}/assignments`, `POST .../assignments/{id}/actions` |
| Announcements (myfeed) | `GET {p}/announcements/mine` |
| My calendar | `GET me/schedule?from&to` (next 90 days: registrations, volunteering, sacraments), plus the meetings above |
| Concerns | `GET {p}/concerns/mine`, `GET {p}/concerns/{id}/entries`, `GET {p}/concerns/reviewers`, `POST {p}/concerns`, `POST {p}/concerns/{id}/entries`; reviewers (memberhub): `GET {p}/concerns/assigned`, `POST {p}/concerns/{id}/actions`, `POST .../entries` |
| Notifications | `GET notifications`, `POST notifications/{id}/state` |
| Consents | `GET {p}/me/consents`, `POST {p}/me/consents/{id}/withdraw` |
| My data | `GET {p}/me/data`, `GET {p}/me/data-closure-requests`, `POST {p}/me/data-closure-requests` |
| My Notes and tasks (mynotes) | `GET me/personal-workspace`, `POST me/personal-workspace`, `PUT me/personal-workspace/{id}`, `POST me/personal-workspace/{id}/actions` |
| Notes & Tasks (notes, priest) | `GET {p}/pastoral-notes`, `POST {p}/pastoral-notes`, `PUT {p}/pastoral-notes/{id}`, `POST {p}/pastoral-notes/{id}/actions`, `GET {p}/pastoral-notes/{id}` |

## Fields with no API equivalent (left empty or removed)

- **My Notes:** pin, reminder date, link to a meeting (a note has no due date in the API; only a task has one). Removed from the note form. A task's body is its title.
- **Meeting RSVP:** the absence reason. The meeting's organizer, and resources attached to a meeting.
- **My Resources** (`myresources`): the API has ministry stock and loans, not shared documents. Not listed in this module's routes, so the page shows the "not connected" notice.
- **Messages and group conversations** (`messages()`, `data-member-compose`, discussions): belong to the communications module. Their actions say "not connected".
- **Notification preferences:** the API has muted topics, a language and a digest switch (`GET/PUT notifications/preferences`), not the portal's five switches. The card now says so and links to the account page. Read/unread comes from `GET notifications`; the API has no body text for a notification, so only the title shows.
- **Changing the password:** moved to the account page (account module). The old form is gone.
- **Concerns:** the attachment, the preferred follow-up channel, and the related ministry and event. "People involved" and "when" are appended to the details as text (the API's implicated people are accounts). Concern categories are the four the API accepts (Operational, Interpersonal, Safeguarding, Other). A category cannot be added or hidden.
- **Concern review (memberhub):** shows only the cases assigned to the signed-in reviewer. Assigning reviewers is an archdiocese action (`POST archdioceses/{id}/concern-reviewers`) and is not in this module. The leader's "complaints received", volunteer responses and profile-update review cards were removed: they belong to the ministries and people modules.
- **Leader position** in a ministry is blank (the member routes do not return it).
- **Volunteering:** "I'm interested" has no API equivalent; "Volunteer" signs up (the coordinator confirms), "Withdraw" declines or asks to cancel.
- **Notes & Tasks (priest):** pin, Arabic text and the clergy assignee picker. The API's assignee is an account, not a person. A change to those is undone and reported as not saved. A note's title is derived from its first line; a title written elsewhere is kept.
- **Profile record:** phone, email and address come from the person's single contact and from person facts (town and address detail). Status shows "member" only when the account's parish relationship is Member.

## Known limits

- **No "my ministries" route.** `loadMember` finds a member's ministries by listing the parish's *publicly listed* ministries and asking `membership/mine` for each. A ministry that is not public does not show.
- **Meetings** load for about three months around today, and attendance only for the last 40 past meetings. Attendance appears only after a ministry closes the meeting's sheet.
- **Event schedule** (`me/schedule`) holds only the member's own registrations, volunteering and scheduled sacraments, not the parish calendar.

## Open decisions for the owner

1. **Notes & Tasks.** The task brief asked for the account-private personal workspace. The screen (`records/notes.jsx`) is the clergy's pastoral notes with a person, assignee and visibility, which is the Care pastoral-notes API, so that is what it uses; the personal workspace feeds My Notes. Confirm, or say if the priest page should be the personal workspace.
2. **Giving a consent.** `POST {p}/me/consents` needs a `policyVersion` and `purpose`. The API has no source for the current policy text or version, so the portal lists and withdraws consents but does not offer to give one.
3. **A "my ministries" route** (or listing for members) so non-public ministries appear, and a leader/position in it.
4. **Notification preferences.** Which portal switches map to which muted topics.
5. **Attachments on concerns** and **documents shared with a ministry** (My Resources) have no member route.

## Checks

`frontend/scripts/checks/member.mjs` runs `loadMember`, `memberAction`, the My parish life calls and the clergy's `NOTES` save against a stand-in for these routes. Not verified against a live API: a verified account and a linked person are needed, which locally only the operator commands create.
