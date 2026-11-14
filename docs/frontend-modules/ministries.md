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
| Lifecycle | `GET/POST ministries`, `GET/PUT ministries/{id}`, `PUT ministries/{id}/meeting-times`, `POST ministries/{id}/actions` (approve, publish, unpublish, open/close-applications, archive) |
| Public catalogue | `GET /api/public/parishes/{id}/ministries` |
| Roster, leadership | `GET .../roster`, `POST .../roster/{personId}/end`, `GET/POST .../leadership`, `POST .../leadership/{accountId}/end`, `GET person-account-links/{accountId}` (leader account → person), `GET person-account-links/by-person/{personId}` (member → account, to appoint), `GET account-names` (leader names) |
| Applications | `GET .../applications?kind=Join\|Leave`, `GET .../applications/mine`, `POST .../applications`, `POST .../applications/{id}/actions`, `GET .../membership/mine`, `PUT .../applications/{id}/private-reason` |
| Meetings | `GET/POST .../meetings`, `GET/PUT .../meetings/{id}`, `POST .../meetings/{id}/actions` (confirm, cancel), `GET .../meetings/{id}/rsvps` |
| Attendance | `GET/POST .../attendance`, `POST .../attendance/snapshot`, `GET .../attendance/rows`, `POST .../attendance/records` |
| Formation | `GET/POST .../formation/programs`, `PUT .../formation/programs/{id}` (draft), `POST .../programs/{id}/actions` (approve), `POST .../programs/{id}/enrollments`, `GET .../formation/enrollments[/{id}]`, `POST .../enrollments/{id}/milestones` |
| Belongings | `GET/POST/PUT .../stock`, `GET/POST .../loans`, `GET .../loans/{id}`, `POST .../loans/{id}/actions` |
| Volunteers | `GET .../volunteering/opportunities`, `.../opportunities/{id}/assignments`, `.../people/{personId}/hours`, `POST .../opportunities/{id}/actions` (cancel) |

## What works

- **Groups:** create (saved as a **draft**), edit (drafts only, the API refuses the rest and the message shows), archive (the delete button). Status panel on the group: approve (priest), publish/unpublish, open/close applications.
- **Join requests** on a group's overview: a priest approves (needs the eligibility review reference) or declines (reason); a leader recommends or returns the request with a reason.
- **Meetings:** create (future drafts), edit (drafts), **Confirm meeting** button (draft → confirmed), delete (cancels). Time zone: the group's other meetings', else the browser's. No end time means one hour.
- **Attendance:** marking a status opens the sheet if needed, builds its expected roster, then records the change. Sheets are left open; closing needs a reporting reference and reason the screens do not collect.
- **Belongings** create, edit, delete (retires) as stock.
- **Ministry requests page:** the published ministries of each followed parish, own applications (withdraw), applications to review in the open parish (leaders: joins; priests: also departures), ask to join or leave. A leaving note goes to the private-reason route.
- **Sign-up sheets:** loaded from volunteer opportunities; deleting one cancels it.

## Added in fullstack2-ministries

Backend (all in `ParishLife.Api`, tests in `ParishLife.IntegrationTests/MinistryCompletionTests.cs`):
- **Arabic twins** (optional, saved as typed, `null` on older records, never copied): ministry `NameAr`, `PurposeAr`, `PublicInformationAr` (also in the public and member projections); meeting `TitleAr`; stock `NameAr`, `StorageAr` (storage stays hidden from members); loan `StockNameAr`; volunteer opportunity `TitleAr`; formation program `TitleAr`, milestone `TitleAr`, `Description`, `DescriptionAr`.
- **Meeting times:** `MeetingTimes`/`MeetingTimesAr` free text on the ministry, changed only through `PUT ministries/{id}/meeting-times` (office, `ministries.manage`, MFA; draft or active ministry; versioned; lifecycle history entry). They are operational and do not reopen the approved description; not in the public projection.
- **Roster removal:** `POST ministries/{id}/roster/{personId}/end` (priest only, reason stored data-protected, `JoinedAt` pins the interval on screen). Refused while the person has a pending application; ends linked leadership exactly as an approved departure does; the person can rejoin through a new application.
- **Adding members** uses the existing assisted join application (preparer with `people.write`; a different priest approves with the eligibility review).
- **Person → account:** `GET person-account-links/by-person/{personId}` (`people.write`, MFA), to appoint a roster member.
- **Formation draft editing:** `PUT formation/programs/{id}` edits a draft in place (formation recording duty); approved revisions stay immutable and are revised by a new draft.
- Leadership handover, appointment and ending already existed and are unchanged (priest, evidence, eligibility, grant deny of `ministries.manage`).

Screens:
- Group form: Arabic name, purpose and public information, usual meeting times (both languages).
- Overview: leaders by name (account-names lookup), **End** appointment (priest). Handover: evidence and duties, immediate replacement.
- Roster menu: make leader / make assistant (evidence, duties), remove from group (priest, reason). Add member: creates assisted join requests with the recorded evidence.
- Belongings: Arabic name and storage saved; lend to a current member (request, approve, issue with due date and condition); each loan shows its status and the next steps (approve/decline, issue, return or report missing, condition check, close).
- Formation: milestones edited as the draft program (Arabic name, descriptions, clergy completion); priest approves the draft with a reference; "Record evidence" enrolls if needed and submits evidence with a date; a different reviewer reviews and completes; a priest reopens a completion.

## Fields with no API equivalent (left empty or not saved)

- Group: visibility (shown as public when published, else private), budget, posts, files, tasks, history, automations and messaging rules, signup QR.
- Arabic name, purpose and public information can only be saved while the group is a draft (the API refuses edits to an approved description); see owner question 6.
- Meeting Arabic title: the API field exists, but the meeting dialogs do not have an Arabic title input yet.
- Belongings: inventory code, condition and description have no API field (not saved).
- Meetings for chosen people or "committee only" (no participant field); Late attendance shows as present; attendance import from a workbook (old route); guests (need an identity review reference).
- Formation: external prior learning, returning evidence for more information and enrollment withdrawal are not on screen (the API supports them).
- Loans: members requesting their own loans ("My resources") belong to the member area; the backend routes (`stock/available`, `loans/mine`) already exist.
- Volunteers: skills, availability, training, safeguarding clearance (shown as "not recorded here") and the rota. Hours are the verified hours the API holds. Creating or editing a sign-up sheet (needs a ministry and a position).
- Hours review, RSVP replies and the private RSVP reason, other attendance corrections.

## Open decisions for the owner

1. **Parish time zone:** the API has none, so new meetings use the group's existing meetings' zone or the browser's. Expose a parish time zone?
2. **New groups are drafts:** should a priest creating a group approve it at once?
3. **Attendance closing:** which reporting reference and reason should the screen collect to close a sheet?
4. **Leader list route:** leaders cannot list ministries; their ministries come from capacities. A "my ministries" route would be simpler.
5. **Sign-up sheets and volunteers:** which ministry and position a sheet belongs to; whether volunteer skills and clearance belong in ParishLife.

6. **Arabic names for approved groups:** an active group's description cannot be edited, so existing groups cannot get Arabic names without a reviewed revision path. Allow Arabic twins (or a reviewed revision) on active groups?
7. **Meeting times editors:** only the office (`ministries.manage`) can change them. Should current leaders also be allowed?
8. **Roster removal:** only a priest can end a membership, with a reason. Confirm, and whether the removed person should be told.
9. **Single-priest parishes:** an assisted join prepared by the priest needs a different priest to approve (existing separation rule). Confirm or define the exception.

## Not verified live

Only the mock check was run (a local API needs a verified account and a priest appointment). Routes and fields were taken from the C# controllers and DTOs.
