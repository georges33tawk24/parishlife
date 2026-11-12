# Module: public site

Owner files: `frontend/src/public/` (except `pages/RequestPage.jsx` and `pages/TrackingPage.jsx`, which belong to the requests module), `frontend/public/sw.js` (the site's service worker), `frontend/scripts/checks/public.mjs`. Two small edits outside: a `.verify-state.is-note` rule in `frontend/src/styles/parish.css`, and `yearLabel` in `src/public/site.jsx`.

All reads are anonymous. The one write (nearby) goes through `api()` in `portal/model/api.js`, so it carries the anti-forgery token; the reads use `fetch` in `src/public/api-data.js` with a timeout.

## Routes used

| Feature | Route | Where |
| --- | --- | --- |
| Directory | `GET /api/public/parishes` | `loadDirectory` (already connected) |
| Parish page | `GET .../parishes/{id}/website`, `.../calendar`, `.../ministries` | `loadParish` (already connected) |
| Near me | `POST /api/public/parishes/nearby` `{latitude, longitude}` | `nearbyParishes`; the "Near me" button in `pages/Home.jsx` |
| Homepage content | `GET /api/public/homepage?lang=en` and `?lang=ar` | `loadHomepage`, `toSite` |
| Liturgical calendar, homepage | `GET /api/public/parishes/{id}/liturgical-calendar?from&to&lang` | `loadHomeLiturgy` |
| Liturgical calendar, parish page | the same route, from 7 days ago to 120 days ahead, for that parish | `loadParish`; calendar and event pages |
| App information | `GET /api/public/app/manifest`, `GET /api/public/app/offline-policy` | `loadAppInfo` in `App.jsx`; `public/sw.js` reads the policy itself |
| Document check | `GET /api/public/document-verifications/{code}` | `verifyDocument`; `pages/VerifyPage.jsx` |
| Visit counts | `POST /api/public/site-metrics` | `lib/beacon.js` (already connected) |

## What each part does

**Near me.** The browser asks for the visitor's position, sends it in the request body (never in an address) and sorts the list by the `distanceKm` the API returns. The old browser-side haversine over map positions is gone. Parishes the API has no location for (`distanceUnavailable`) get no distance and follow the others by name. If the call fails the list stays as it was and a note says so. The text filters (search, town, diocese) still run in the browser on top of the sorted list.

**Homepage content.** Both languages are fetched (the page switches language without reloading) and each text is filed under the language the API says it served (`language`), so a block with no Arabic text leaves Arabic empty rather than showing English as Arabic.

| API section | Shown as |
| --- | --- |
| `hero` | `title` is the headline, `body` the line under it |
| `announcement` | the note above the headline: `title`, then `body` (cut at 240 characters), then a link (`linkLabel`, `linkUrl`) |
| `stories` | one card per story (`id` is the key): `title`, `body`, link with its `linkLabel` |
| `about` | title and body of the About section |
| `join` | title and body of the Join section |

With nothing published (the API answers 404) or on any failure, the page keeps its built-in wording (`lib/site-defaults.js`). When something is published, a section the editor left out is hidden (About, Join, stories); the hero keeps the built-in wording for any field the editor did not provide.

**Liturgical calendar.** `lib/liturgy.js` worked out the season and feasts in the browser (Easter by formula, a fixed list of feasts). The site no longer uses it for any text:

- The homepage has no parish of its own, so `loadHomeLiturgy` asks the first four listed parishes (for the next seven days, English) until one answers `Published`, then reads Arabic for that parish. The week's ribbon marks days that have an observance and the hero says "Today · …" from it.
- "In the Maronite year" now shows the `season` the approved calendar attaches to today, and appears only when it attaches one. The label says "Maronite" when the calendar's `rite` is Maronite and "In the liturgical year" otherwise.
- A parish page, its calendar page and an event page read that parish's own calendar. Parish exceptions (`parishException`) show only there, never on the homepage.
- `NotPublished` shows nothing. It means the authority has approved no calendar, not that there are no observances.

**App information.** When `/api/public/app/manifest` answers (the deployment has `PublicApp` configured), the page points its `<link rel="manifest">` at it and takes `theme-color` and the app title from it. When it answers 404 (not configured) the built-in `/site.webmanifest` stays. The service worker (`public/sw.js`, cache `parishlife-public-v2`) now keeps only the API reads listed in `/api/public/app/offline-policy` (the policy's route templates), plus the pages and assets; before, it kept every `/api/public/*` read except a few names, which would have stored document checks once the route changed. Without the policy nothing from the API is kept.

**Document verification.** `VerifyPage.jsx` no longer shows "signature valid", "content matches", the signer's passkey or a fingerprint, because the API checks none of that. It shows what the API answers:

- a title from `status` (Valid, NotYetIssued, Superseded, Withdrawn, Revoked, IntegrityCheckFailed, or the rest, "No longer matches the document"), with a tone: good only for `Valid` with `electronicSignatureRecognized`; a `Valid` answer without it is "Reference only: not an official electronic signature" (a note, not green); `NotYetIssued` is a note; the others are critical;
- the API's `statusMeaning` and `officialStatement` verbatim (English; the API has no Arabic wording), marked `lang="en"` on the Arabic page. For "reference only" the `statusMeaning` of Valid is left out because it says "electronically authorized", which the official statement just denied;
- document type and detail (the sacrament), reference, version, issuing parish, who authorized it and when, when it was checked, and the code;
- a closing line that the page reports the parish's records and does not show or check the document.

A code is 32 hexadecimal characters, with or without hyphens or spaces; an unknown or malformed code is a 404 with "No authorized document has this code". The route is rate limited (20 a minute per address); the API's own 429 message is shown.

## Fields with no API equivalent (left empty, not invented)

- Arabic parish name, Arabic town, rite, phone, address, clergy, photos, news posts, WhatsApp, livestream (the public parish has name, locality, diocese, coordinates, links).
- Arabic text for the liturgical `season` and `rank`: they are single free-text fields. A season written in English shows in English on the Arabic page.
- A story's image: the API's story has none, so each shows the built-in crest picture.
- A calendar feed (`.ics`) for a parish: none, so "subscribe in my calendar" stays out.
- The homepage `join` block's link and the section order (`Order`): the page's section order is fixed, so only presence matters.
- Request buttons are shown: the requests module connected the request form to the anonymous request route (`publicRequests: true`).

## Not changed

- The hero's candle scene (`components/Sanctuary.jsx`) still picks its decoration by season from `lib/liturgy.js` (`seasonNow`). It shows no text, and the API's `season` is free text that cannot be mapped to the scene's eight seasons without guessing. Left as is; see decision 3.
- `docs/frontend-integration.md` still lists near me, the homepage and verification as "not yet in the frontend"; the coordinator should update it when merging.

## Decisions for the owner

1. **A platform-level liturgical read.** The API only has a per-parish calendar, so the homepage borrows the first listed parish with an approved calendar. A platform or per-rite route (or a rite parameter) would be cleaner, and would stop the homepage showing one parish's archdiocese's calendar to everyone.
2. **What counts as a feast.** The ribbon marks every observance the calendar lists for a day. If calendars list ordinary days too, the ribbon should show only ranked ones; the API's `rank` has no fixed vocabulary to rely on.
3. **Season for the scene and for days without an entry.** Should the API give a season for every day (or a small fixed list of season ids), so the candle scene and the "In the … year" line can both rely on it? Today the line appears only when today's entry names a season.
4. **Translated verification wording.** `statusMeaning` and `officialStatement` are English only; the Arabic page shows them in English.
5. **Announcement shape.** The editor requires a title and a body for the announcement; the site's note shows both. Confirm that is what the editor intends (a one-line note would want a title only).
6. **Manifest 404 noise.** A deployment with no `PublicApp` configuration answers the manifest read with a 404 on every page load (the browser logs it). A 204 or a flag in `GET /api/auth/capabilities` would avoid it.

## Checks

`frontend/scripts/checks/public.mjs` (part of `npm run check`) runs against a stand-in for the routes above and asserts:

- nearby sends the point in the body only, and keeps distances for located parishes only;
- the homepage mapping per section and per language, a story with no Arabic text, a section left out, and 404 meaning built-in wording;
- the homepage liturgy: which parish is read, no parish exceptions, one-language titles, season only from the day's own entry, `NotPublished` empty; a parish page keeps its exceptions and the homepage does not load every parish's calendar;
- the manifest read (404 and configured) and the offline policy;
- the verification read (code trimmed, 404 message) and the tone for every status, including Valid without a recognized arrangement;
- the service worker, run in a sandbox, keeps the listed reads and never a document check or an unlisted read.

Also run once by hand in Chromium against a local stand-in server (not the .NET API): the homepage content in English and Arabic, near me sorted by the returned distances, a valid, an unknown and a malformed code, no script errors.

Not verified: the real .NET API (no verified account is needed for these routes, but local data has no published parish, homepage, calendar or signed document to read), a deployed service worker across a real offline reload, and the manifest swap with an installed app.
