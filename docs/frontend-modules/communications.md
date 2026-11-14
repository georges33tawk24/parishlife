# Communications module

Files: `frontend/src/portal/model/modules/communications.js`, `features/communicate/inbox*`, `messaging*`, `notices*`, `website*`, check `frontend/scripts/checks/communications.mjs`. Pages: `inbox`, `mymessages`, `messaging`, `notices`, `portal`. Collections: `MESSAGES` (broadcasts), `TEMPLATES`, `NOTICES` (announcements), `NOTIFICATIONS` (the bell), `CONTENT` (website sections), `PRAYERS`.

Only marking a notification read goes through `save()`. Every other change is a direct workflow call from the screen (with an `operationId`, and the `version` the API returned) followed by `hydrate()`; a plain edit of these collections is undone and reported.

**External delivery is not connected.** Broadcasts and messages are stored in the app. The screens say "stored in the app", show email, SMS and push as "not set up" (the API's `NotConfigured`), and show the API's own notice-status wording. Nothing says anything was sent outside ParishLife.

## Routes used

| Screen | Routes (under `/api`) |
| --- | --- |
| Inbox, My messages | `GET/POST parishes/{p}/inbox`, `GET .../inbox/{c}` (marks read), `POST .../inbox/{c}/messages`, `POST .../inbox/{c}/archive?archived=`, `GET .../inbox/{c}/notification-outcome`, `GET .../inbox/{c}/messages/{m}/notification-outcome`, `POST .../inbox/{c}/messages/{m}/reports`, `GET .../inbox/reports/mine`, `GET parishes/{p}/broadcasts/mine` |
| Broadcasts (N05) | `GET/POST parishes/{p}/broadcasts`, `PUT .../broadcasts/{id}`, `POST .../broadcasts/{id}/actions` (approve, schedule with `scheduledFor`, unschedule, send, cancel), `GET .../broadcasts/{id}/audience-preview` |
| Broadcast automations (staff) | `GET/POST parishes/{p}/broadcast-automations`, `PUT .../{id}`, `POST .../{id}/actions` (pause, resume, end) |
| Names | `GET parishes/{p}/account-names?ids=` through `model/names.js` (senders, authors, approvers, schedulers) |
| Templates (N05) | `GET/POST parishes/{p}/broadcast-templates`, `PUT .../{id}`, `POST .../{id}/actions` (approve, retire) |
| Exact-message review (N02, platform operators) | `GET parishes/{p}/message-reports`, `POST .../message-reports/{id}/close`, `GET/POST .../message-reviews`, `POST .../message-reviews/{id}/decision`, `GET .../message-reviews/{id}/message`, `POST .../message-reviews/{id}/close` |
| Notices | `GET/POST parishes/{p}/announcements`, `PUT .../{id}`, `POST .../{id}/actions` (publish, withdraw), `GET parishes/{p}/ministries` (audience picker) |
| Bell | `GET notifications?size=&cursor=`, `POST notifications/{id}/state` |
| Website editor | `GET parishes/{p}/website/sections`, `PUT .../sections/{key}/draft`, `POST .../sections/{key}/revisions/{rev}/actions` (submit, return, publish, unpublish); the public site reads `GET public/parishes/{p}/website` |
| Prayer intentions (portal page, priest) | `GET parishes/{p}/prayer-intentions`, `POST .../{id}/decision` |

Staff lists are loaded for a priest or a grant with `communications.manage` (broadcasts, templates, notices) or `publishing.manage` (website). A 403 or 404 leaves the collection empty.

## Now connected (fullstack2-communications)

- **Direct message to a person:** `compose(personId)` from the people list opens a message form for staff with `communications.manage`; it sends `recipientPersonId`. The API also requires `people.read` and the office module, finds the single active linked account of that person in the parish, and refuses (nothing stored) when there is none or more than one. Members still write only to the parish office.
- **Sender names:** messages show the author's name (with Parish office / Parishioner) when the account-name lookup reveals it; conversation cards show who it is from or to; `ConversationDto.createdBy` is new. A "Started by me" folder lists conversations this account started.
- **Scheduling:** an approved broadcast can be scheduled for a UTC time (within a year). Nothing is stored until then; at that time the background processor stores it only if the scheduler still holds communications access under the same capacity (grant or appointment, MFA account, open parish with core coverage). Otherwise it returns to Approved with a note. Unschedule and cancel remove the pending store; "Store in the app now" still works.
- **Bilingual broadcasts:** broadcasts, templates and notices take an optional Arabic version (`titleAr`, `bodyAr`): both or neither, never on an Arabic main text, saved as typed. Templates copy theirs into broadcasts; recipients' copies (`broadcasts/mine`) carry it.
- **Automations:** staff define bounded automations (approved template, audience, weekly or monthly, first run, 1 to 52 runs; at most 20 not ended per parish). Each due time creates **one draft** owned by the responsible staff member, so a different staff member must approve it, and someone must store or schedule it. A due time adds nothing while the previous draft still waits; a run pauses the automation when the responsible account lost access or the template is no longer approved; missed due times are not made up. Leaders without `communications.manage` still see the ministries module's group automation data.
- **Notices:** `priority` (Normal or Urgent; urgent is listed first for readers, nothing is sent) and `authorAccountId` (staff lists only; readers never see authoring identities). The staff list shows the author's name.

## Still not connected, and why

- **External delivery** (email, SMS, WhatsApp, push): no provider. Channels stay NotConfigured; a stored or scheduled broadcast is not proof of delivery. Emergency broadcast and reminders still say they are not connected.
- **Per-send reach history** beyond the counts on each broadcast; "Mark unread" (not in the API).
- **Posters** made from a template are drawn in the browser only; the date and place are typed and not stored.
- **Notices:** a published notice is not edited, only withdrawn. Weekly bulletin introduction and Mass intentions are typed for printing and **not saved**.
- **Website:** only the live and the working revision are returned (no revision history); only welcome, history, mass-times, contact and sacraments are shown.
- **Bell links:** a notification link is an API path; only `inbox.message` maps to a page.
- **Self-service requests tab** of the portal page belongs to People; it stays empty.
- **Ministry names in broadcast rows** come from the groups data when present, otherwise "A ministry".
- Not verified against a live API or Cosmos; the scheduled processor runs only where background jobs are enabled. No new notification topic was added.

## Open owner decisions

1. Which role may approve broadcasts and templates: the API requires a different staff member than the author (no named approver role).
2. A priest other than the author publishes website sections; a small parish with one priest cannot publish its own edits.
3. Whether the bulletin text should be stored (a website section, or a new field).
4. Whether notification links should be portal routes rather than API paths.
5. Whether readers (members, public) should see the author of a notice, and in what form (name, office title); today only staff see it.
6. Whether an automation may ever store or schedule its drafts without a fresh approval (today: never), and whether the 1 to 52 run bound and the 20-automation bound fit parish practice.
7. Whether an urgent notice should also raise an in-app notification (today it only orders the list), and who may mark a notice urgent.
8. Whether a scheduled broadcast whose scheduler lost access should be held (today) or stored under the authority of the parish.
9. Whether staff may message a person with several linked accounts (today refused) and whether the person route should keep requiring `people.read`.

## Checks

`scripts/checks/communications.mjs`: loading of every collection (all notification pages, archived and other-parish notices left out, staff-only data empty for a member), marking read, refusal of other edits, and the request bodies of the broadcast (with Arabic version), schedule, automation, notice (priority), website, inbox (by person) and ministry-list calls, plus names from a mocked account-names route. Not verified against a live API: it needs a verified account with an appointment.
