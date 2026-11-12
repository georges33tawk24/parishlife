# Communications module

Files: `frontend/src/portal/model/modules/communications.js`, `features/communicate/inbox*`, `messaging*`, `notices*`, `website*`, check `frontend/scripts/checks/communications.mjs`. Pages: `inbox`, `mymessages`, `messaging`, `notices`, `portal`. Collections: `MESSAGES` (broadcasts), `TEMPLATES`, `NOTICES` (announcements), `NOTIFICATIONS` (the bell), `CONTENT` (website sections), `PRAYERS`.

Only marking a notification read goes through `save()`. Every other change is a direct workflow call from the screen (with an `operationId`, and the `version` the API returned) followed by `hydrate()`; a plain edit of these collections is undone and reported.

**External delivery is not connected.** Broadcasts and messages are stored in the app. The screens say "stored in the app", show email, SMS and push as "not set up" (the API's `NotConfigured`), and show the API's own notice-status wording. Nothing says anything was sent outside ParishLife.

## Routes used

| Screen | Routes (under `/api`) |
| --- | --- |
| Inbox, My messages | `GET/POST parishes/{p}/inbox`, `GET .../inbox/{c}` (marks read), `POST .../inbox/{c}/messages`, `POST .../inbox/{c}/archive?archived=`, `GET .../inbox/{c}/notification-outcome`, `GET .../inbox/{c}/messages/{m}/notification-outcome`, `POST .../inbox/{c}/messages/{m}/reports`, `GET .../inbox/reports/mine`, `GET parishes/{p}/broadcasts/mine` |
| Broadcasts (N05) | `GET/POST parishes/{p}/broadcasts`, `PUT .../broadcasts/{id}`, `POST .../broadcasts/{id}/actions` (approve, send, cancel), `GET .../broadcasts/{id}/audience-preview` |
| Templates (N05) | `GET/POST parishes/{p}/broadcast-templates`, `PUT .../{id}`, `POST .../{id}/actions` (approve, retire) |
| Exact-message review (N02, platform operators) | `GET parishes/{p}/message-reports`, `POST .../message-reports/{id}/close`, `GET/POST .../message-reviews`, `POST .../message-reviews/{id}/decision`, `GET .../message-reviews/{id}/message`, `POST .../message-reviews/{id}/close` |
| Notices | `GET/POST parishes/{p}/announcements`, `PUT .../{id}`, `POST .../{id}/actions` (publish, withdraw), `GET parishes/{p}/ministries` (audience picker) |
| Bell | `GET notifications?size=&cursor=`, `POST notifications/{id}/state` |
| Website editor | `GET parishes/{p}/website/sections`, `PUT .../sections/{key}/draft`, `POST .../sections/{key}/revisions/{rev}/actions` (submit, return, publish, unpublish); the public site reads `GET public/parishes/{p}/website` |
| Prayer intentions (portal page, priest) | `GET parishes/{p}/prayer-intentions`, `POST .../{id}/decision` |

Staff lists are loaded for a priest or a grant with `communications.manage` (broadcasts, templates, notices) or `publishing.manage` (website). A 403 or 404 leaves the collection empty.

## Fields and features with no API equivalent

- **Direct message to a person:** needs the parishioner's account id; the people list has none and the API has no directory. "Message a person" is removed from the menu, and `compose(personId)` from other screens says nothing was sent. Staff can reply in office conversations.
- **Names in conversations:** only account ids come back, so messages show You, Parish office or Parishioner. There is no sender/recipient name or a Sent folder; folders are Open, Unread, Archived. "Mark unread" is not in the API.
- **Broadcast channel, schedule, per-send reach history:** one language per broadcast, no WhatsApp/SMS/email channel choice, no scheduled send, no Arabic+English pair in one message. Emergency broadcast and reminders still say they are not connected.
- **Automations and messaging rules:** no API. The non-leader Automations tab is removed; the leader tabs still read the ministries module's group data.
- **Posters** made from a template are drawn in the browser only; the date and place are typed and not stored. The old hard-coded "Hadath · Maronite" line is gone.
- **Notices:** the old "urgent" priority and author name do not exist; a notice can be pinned, and shows no author. A published notice is not edited, only withdrawn. Weekly bulletin introduction and Mass intentions are typed for printing and **not saved**.
- **Website:** the API needs English, French and Arabic to submit; the editor now has all three with a title each. Only the live and the working revision are returned, so there is no revision history list. Other section keys the API may hold are not shown, only welcome, history, mass-times, contact and sacraments.
- **Bell links:** a notification's link is an API path. Only `inbox.message` is mapped to a page; other notices show without a link (a small change in `shell/Portal.jsx` allows that).
- **Self-service requests tab** of the portal page: not part of this API area (profile corrections belong to People); it stays empty.
- **Ministry names in broadcast rows** come from the groups data when present, otherwise "A ministry".

## Open owner decisions

1. Which role may approve broadcasts and templates: the API requires a different staff member than the author (no named approver role).
2. A priest other than the author publishes website sections; a small parish with one priest cannot publish its own edits.
3. A way for staff to start a direct message (an account lookup or a person-to-account route).
4. Whether the bulletin text should be stored (a website section, or a new field).
5. Whether notification links should be portal routes rather than API paths.

## Checks

`scripts/checks/communications.mjs`: loading of every collection (all notification pages, archived and other-parish notices left out, staff-only data empty for a member), marking read, refusal of other edits, and the request bodies of the broadcast, website, inbox and ministry-list calls. Not verified against a live API: it needs a verified account with an appointment.
