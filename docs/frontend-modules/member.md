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
| Private RSVP reason | `GET .../meetings/{id}/rsvp-private-reason` (upcoming meetings with a recorded reply), `PUT .../meetings/{id}/rsvp-private-reason` (set, replace or `clear`) |
| My resources (myresources) | `GET {p}/me/ministry-resources` (new, member area) |
| Notification preferences (myprofile card) | `GET me/notification-topics` (new, member area), `GET notifications/preferences`, `PUT notifications/preferences` |
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

## Connected in the member area round (fullstack2-member)

- **My Notes: pin, reminder date, linked meeting.** `SavePersonalItemDto`/`PersonalItemDto` gained `Pinned`, `ReminderAt` and `MeetingParishId`/`MeetingMinistryId`/`MeetingId` (all three or none). They are stored inside the account-private protected content, like the text, and never appear in audit, receipts or on disk in clear. A new or changed link must be a meeting the account can read at that moment (`MinistryMeetingService.GetAsync`); an unchanged link survives leaving the ministry. The reminder is a private date shown on the notes calendar: **nothing is sent** (no notification, email or job). Records saved earlier read back unpinned, with no reminder or link. The note drawer has a pin switch, a reminder date and a meeting picker (meetings on the member's list; a stored link to a meeting no longer listed is kept and labelled so).
- **RSVP reason.** The API already had the confidential reason (`rsvp-private-reason`, readable only by its author and a designated reader, editable until the RSVP cutoff). The meeting drawer now shows an optional "private reason" box; the reply is saved first, then the reason is set, replaced, or cleared when emptied. An unchanged reason is not re-sent.
- **My resources.** New `GET {p}/me/ministry-resources` (`MemberMinistryResourceService`, a read only): the member's own person link, their current ministry memberships (any ministry, not only publicly listed ones) whose ministry is Active, and each one's Active stock, with the same member rule as the per-ministry `stock/available` route. Storage location and account ids are not returned. Bounded to 50 ministries and 500 items (`truncated` says when the bound cut the list). Personal capacity only: an appointment header, a recovery session or an unlinked account is refused (404). The page lists item, ministry, and available of total.
- **Notification preferences.** New `GET me/notification-topics` (`NotificationTopicCatalog`): the optional topics a mute affects (`parish.broadcast`, `reports`) and the required topics staged through `StageRequired`, which no preference suppresses (`docs/operations/required-notification-outbox.md`). A test scans the API source so the catalog fails when a producer adds a topic it does not list. The profile card shows one switch per optional topic and saves `PUT notifications/preferences` with mutes for those topics only; a mute on a required topic is dropped, other existing mutes, the language and the digest flag are kept as they were. The card states that required updates cannot be turned off and that email/text delivery is not connected.

## Fields with no API equivalent (left empty or removed)

- **My Notes:** a task's body is its title.
- **Meeting RSVP:** the meeting's organizer, and resources attached to a meeting.
- **My Resources:** shared *documents* (files) for a ministry. The API has no ministry document record, so the page lists ministry stock only; there is no download and no borrowing button here (loans stay with the ministries module).
- **Messages and group conversations** (`messages()`, `data-member-compose`, discussions): belong to the communications module. Their actions say "not connected".
- **Notification preferences:** the old portal's email, in-system and meetings switches, quiet hours and the language/digest values. Email delivery is not connected, meeting notices are not an optional topic in the API, and nothing reads `Language` or `DigestOptional`, so they are not shown. Read/unread comes from `GET notifications`; the API has no body text for a notification, so only the title shows.
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
4. **Notification preferences.** Only the two optional topics are switches now. Should meeting notices, announcements or ministry messages become optional topics, should there be quiet hours or a digest (nothing delivers either today), and should email/SMS delivery be added? None is invented here.
5. **Attachments on concerns** and **documents shared with a ministry** have no member route. "My resources" shows ministry stock; a document-sharing model (upload, Blob storage, who may share) would be a ministries-area decision.
6. **Note reminders.** The reminder date is private and shows only on the notes calendar. Should a reminder ever send an in-app notice? That would need a scheduled job and an optional topic.
7. **"My resources" scope.** It lists stock of every Active ministry the member currently belongs to, without requiring the parish's ministries module (the same as the existing per-ministry `stock/available` route). Confirm, or say if a disabled module should hide it.

## Checks

`frontend/scripts/checks/member.mjs` runs `loadMember`, `memberAction` (including note pin/reminder/link, the RSVP reason set/clear/unchanged, resources and preference mutes), the My parish life calls and the clergy's `NOTES` save against a stand-in for these routes. Backend: `ParishLife.IntegrationTests/MemberPortalTests.cs` (service and HTTP) plus the existing `PersonalWorkspaceTests` and `MinistryRsvpPrivacyTests`. Not verified against a live API: a verified account and a linked person are needed, which locally only the operator commands create.
