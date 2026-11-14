# Public area: parish profile, photos, calendar feed, liturgical Arabic labels

Built on branch `fullstack2-public`. Local tests only; nothing here is Azure acceptance.

## Routes

| Route | Who | What |
| --- | --- | --- |
| `GET /api/parishes/{id}/profile` | editors (`publishing.manage`, MFA, core module) | draft, published copy, status, photos (version is empty before the first save) |
| `PUT /api/parishes/{id}/profile` | editors | save the draft (`operationId`, `version`, `profile`) |
| `POST /api/parishes/{id}/profile/actions` | editors | `publish` (copies the draft) or `unpublish` (removes the public copy, keeps the draft) |
| `POST /api/parishes/{id}/profile/photos` | editors | multipart upload (JPEG/PNG/WebP by content, 5 MB, 12 non-removed); stored privately, status Private |
| `GET /api/parishes/{id}/profile/photos/{photoId}` | editors | private preview |
| `POST /api/parishes/{id}/profile/photos/{photoId}/actions` | editors | `publish`, `unpublish`, `remove`, `caption` |
| `GET /api/public/parishes/{id}/profile` | anyone | published copy only, verified parish only, 404 until published; `[PublicCache]` |
| `GET /api/public/parishes/{id}/profile/photos/{photoId}` | anyone | published photos only |
| `GET /api/public/parishes/{id}/calendar.ics` | anyone | iCalendar feed, rate limited (existing `authentication` policy, 20/min per address), `public, max-age=900` |

The public directory card gains `nameAr`, `localityAr` (from the published profile only; search matches them) and `links.profile`, `links.calendarFeed`.

## Rules kept

- Nothing is public until an explicit publish; the private registration `Contact` is never used.
- Arabic twins are stored as typed, never derived. Links (website, livestream, WhatsApp) must be https; WhatsApp only on `wa.me`/`whatsapp.com` hosts; nothing is fetched.
- Clergy appear only when the published profile has `showClergy`, and only from current accepted priest appointments in the parish's current jurisdiction (display name, `Priest` or `ParishPriest`).
- Photo bytes are write-once in the private evidence store (`profile-photos/{parish}/{id}`), integrity-checked on read, and included in operator snapshots (records carry `storagePath`/`contentType`).
- Feed: published public parish activities and their cancellations only (the existing public calendar read), 30 days back to 180 days ahead, at most 500 events, RFC 5545 escaping and folding, no liturgical content.
- Liturgical entries gain optional `rankAr`/`seasonAr` (authority-supplied, 80 chars); the public read returns them next to `rank`/`season`.
- No index-contract change: only `type` and existing paths are queried.

## Open questions for the owner

1. Should publishing the profile need a priest's review (as website sections do), rather than any `publishing.manage` editor?
2. Must an appointed priest consent before being named publicly when the parish ticks "list our clergy"? Clergy have no Arabic display name.
3. Whether a new parish is public at once (C-items): unchanged. A verified parish still appears in the directory and has a (possibly empty) feed; its profile is public only after publish.
4. A dedicated rate-limit policy for the feed (today it shares the per-address `authentication` bucket, which needs a Program.cs line).
5. Photo limits (5 MB, 12) and the 180-day feed window are working choices, not owner policy.
