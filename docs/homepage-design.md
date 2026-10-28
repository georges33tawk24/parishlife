# Homepage design

The public homepage (`public.html`, served at `/`) is the first thing a parishioner,
a family planning a baptism, or someone abroad looking for their village church
sees. Its job, in order: help them find their parish, show what is happening there,
and let them ask the parish office for something.

## Concept: the sanctuary, and the lights of the valley

The homepage opens inside a church at night, so a visitor knows at once where they are: a wall of
dressed limestone, a stained-glass window (a rose with the cross of the Maronites above two lancets,
one with the cedar of Lebanon and one with the chalice), shafts of coloured light falling across
the nave, a sanctuary lamp on its chains, and candles on the window sill. **Each parish on
ParishLife is one lit candle**; the shorter candles beside them wait, and a visitor may light one
for their intention. The window, the wall, the candles and their brass tray are rendered pictures
(see "The sanctuary render" below); the light, the haze, the lamp and the motion are drawn by the
page (SVG and CSS).

The light through the glass follows the hour in Beirut: rose and gold at dawn, strong golden
shafts by day, amber in the evening, moonlight at night (`?light=dawn`, `day`, `dusk` or `night`
shows another hour).

The sanctuary also keeps the season of the Church's year (`assets/liturgy.js`): in the Season of
the Holy Cross the window throws a cross of light on the wall; at the Birth and the Epiphany a
star shines over the window; in Lent and Passion Week a violet veil hangs across it; at the
Resurrection the paschal candle stands at the end of the sill, bearing the Alpha, the Omega and
the year; at Pentecost the light turns red
(`?season=cross`, `birth`, `epiphany`, `lent`, `passion`, `resurrection`, `pentecost` or `church`
shows another season). The bell of Mass times rings when pressed: a bronze bell's partials, made
in the browser, and only on a press.

Further down, the same idea runs through the page: at dusk in the Lebanese mountains the village
churches light up across the valley, and on the hand-drawn map of Lebanon each gold light is a
parish. The valley render stays on the sign-in screen and the closing section.

## Tokens

| Name | Hex | Role |
| --- | --- | --- |
| Night lapis | `#0E1A31` | Night sky, deep sections, footer |
| Lapis | `#2A4A96` | Links, focus, interactive accents (the blue of icon mantles) |
| Gilt | `#D7A548` | Parish lights, the selected state, primary buttons on dark |
| Limestone | `#E6DED0` | Stone planes behind images and quotes |
| Mist | `#F5F1E8` | Page background, warm limestone; hairlines `#E0D7C7` |
| Cedar | `#1F3A2E` | Brand mark and the land on the map |
| Sanctuary red | `#B23A2B` | Only "today": an event happening today, like the lamp that is always lit |

Type:

- **Marcellus** for Latin display: a flared serif drawn from carved inscriptions,
  like the lintels over Lebanese church doors.
- **Amiri** (bold) for Arabic display: classical Naskh, the hand of Arabic liturgical books.
- **Source Sans 3** for Latin text and **Noto Sans Arabic** for Arabic text.
- Scale: a perfect fourth (1.333) from 18 px body (19 px Arabic, with taller line height).
  Display sizes are fluid with `clamp()`; lines stay under 70 characters.

## Layout

Left-aligned in English and mirrored in Arabic. The map never mirrors: geography is geography.

```
┌─ header: mark · Find a parish · This week · Mass times · Ask your parish · العربية · Members portal
│
├─ HERO (100svh): night → dawn landscape, ridges in layers, a chapel, gold lights
│    Find your parish,
│    wherever you are in Lebanon.
│    [ Parish, town or village ……………… ] [Search]
│
├─ THIS WEEK: "Still to come today" (what has not started yet by Beirut's clock, across every parish),
│    the seven days as a ribbon (a red lamp marks today, dots mark what is published) and the
│    week's celebrations as cards with a date arch and an add-to-calendar button; a day narrows them,
│    and each card opens the event's own page
│
├─ DIRECTORY: [ map of Lebanon, relief lines, parish lights ] [ parish list, arch photos ]
│    search forgives spelling: Arabic or Latin letters, French or English forms, Arabizi
│
├─ ASK YOUR PARISH: baptism · first communion · confirmation · marriage · funeral · certificate,
│    then the three steps (send · the office reviews · follow with your private link)
│
├─ MASS TIMES: one entry per parish, from each parish's Website content (a slim band until one is published)
├─ FROM THE PARISHES: latest published announcements
├─ STORIES: slides managed in the dashboard Homepage editor
├─ VERSE: "Let your light shine before others" (Matthew 5:16), lit word by word as it is read
├─ ABOUT: what ParishLife is, with its numbers
├─ JOIN: members portal and account creation
└─ footer, ending in the ParishLife name, large and faint
```

## Principles

1. **Light is information.** Gold marks a parish; red marks today. Nothing glows for decoration.
2. **Arches, not cards.** Images sit in the round arch of Lebanese stone windows, on stone
   and mist planes, instead of rows of identical rounded cards. A parish without photographs gets
   a monogram arch (its initial in gold), never a borrowed picture of another church.
3. **Bilingual parity.** Arabic has its own display face and spacing, not a fallback. Headlines
   split by word, never by letter, so Arabic letters stay joined.
4. **One orchestrated moment.** Dawn breaks once, on load and as the visitor scrolls out of
   the hero. Everything else moves only in answer to the visitor.
5. **Real content or an honest invitation.** Every line comes from the dashboard: parish
   Website content and public profiles, published events and announcements, and the
   Homepage editor. Empty sections tell the parish office what to publish.

## Review against generic defaults

Checked against the common generated-page defaults, and changed:

- No warm cream background: the page is a cool mist white. Limestone appears only as a surface.
- No all-caps labels above headings, no single accented word in a headline, and no `·`-joined
  meta strings. An arrow marks only a card or row that opens another page, never inline text.
- Numbers appear only where content is a real sequence (the three request steps).
- The directory is a map and a list, not a grid of identical cards.

## Motion

GSAP 3.15 (ScrollTrigger and SplitText, vendored in `assets/vendor/gsap/`) and Lenis 1.3 smooth
scrolling (`assets/vendor/lenis/`), all inside `gsap.matchMedia()` in `assets/home-motion.js`:

- **Homepage sanctuary** (`assets/home-sanctuary.js`, `assets/sanctuary.css`): the wall comes out
  of the dark, the panes of glass take the light one group after another (the rose first), the shafts
  reach into the nave, the lamp settles on its chains, then the parishes' candles are lit one by one.
  Afterwards clouds pass behind the glass, the light behind it shifts, the shafts brighten and dim,
  flames flicker, the lamp sways, and dust drifts through the shafts (a canvas that sleeps out of
  view). The pointer moves the wall, window and lamp at different depths; scrolling out lifts the
  window and warms the glass into morning. Hovering a lit candle names its parish and choosing it
  opens the parish; an unlit one can be lit. The moving light is a separate layer from the window
  so the glass and stone textures are painted once, and no layer uses a blend mode (they cost the
  most frames). On narrow or tall screens the window stands behind the words, dimmer, without the
  candles and the lamp.
- **In the sanctuary as well:** a blind arcade of round arches stands in the shadow of the nave behind
  the words; *Gloria in excelsis Deo* (المجد لله في العُلى) is gilded on the front of the sill; incense
  drifts through the shafts (a seamless haze made on the visitor's device, masked to the shafts);
  each lit candle sends up a thread of smoke and lights the brass beneath it.
- **Further down:** a gold rule with the cross draws under each section heading, and This week says
  where the Maronite year stands (`assets/liturgy.js`: the seasons from the Sunday of the Consecration
  of the Church through Great Lent, the Resurrection, Pentecost and the Holy Cross, reckoned from
  Gregorian Easter) and marks the great feasts on the ribbon; on a feast day the hero's kicker names
  it. Sundays carry the cross. The night sections are a chapel ceiling of small gold stars and rise
  with a gilded arch edge. The request arches are gilded niches with gold leaf in the lunette and a
  cross at the crown; the steps are numbered I, II, III. Mass times has a bell in its belfry that
  rings as the section arrives. The announcements are parchment notices sealed in red wax. Behind the
  verse, a half-dome of gold mosaic (tesserae made on the visitor's device) with a red cross, and a
  rose window drawn in gold turning very slowly. About opens with an illuminated initial, gold on
  manuscript red, beside a votive stand in the dark church, rows of candles in ruby and amber
  glass (`assets/images/votives.webp`, rendered by `docs/tools/render_votives.py` with a shallow
  depth of field). On the map each parish
  is a small flickering flame. The footer opens on a carved frieze of crosses, and the brand's light
  breathes like a flame.
- **The small things** (`assets/church.css`, and `assets/auth.css` for the sign-in screen): the gilded
  buttons are gold leaf over its bole (`assets/images/gilt.webp`, rendered by
  `docs/tools/render_gilt.py`: squares of leaf with their overlapping edges, burnish and wrinkles),
  burnished along the top with an engraved line inside the edge, and light runs across them on
  hover. With a mouse the pointer is a fine arrow inlaid with gold, and over anything that can be
  chosen a small lit candle whose flame's tip is the point (both drawn as SVG; stylesheets use
  `cursor:var(--hand,pointer)`, so the portal, which does not set it, keeps the usual hand). Fields
  are warm parchment and turn gold when written in; the scrollbar is a gilt rod on parchment; text
  is selected in gold leaf, or candlelight on the night sections; checkboxes take the gilt ink.
- **Loader:** warm dark stone, and a candle is lit in the arch mark until the page is ready.
  It also fades on its own after eight seconds, so a failed script can never leave it in place.
- **Load:** the camera settles on the valley while the sky, crest and valley layers rise into place,
  the mist drifts in, the villages light up, the headline rises word by word, and then each parish
  on ParishLife lights its gold light on a village. It plays once per visit.
- **Pointer:** on a mouse or trackpad, the layers shift at different depths as the pointer moves.
- **Scroll out of the hero:** the night render crossfades into the dawn render while the layers part,
  the village glow fades with the daylight, and the header turns to dark glass, then light glass.
- **Always:** two mist layers drift across the valley; a shooting star crosses the sky now and then;
  the parish lights breathe; on the map, lights pulse and relief lines draw once.
- **Sections:** headings rise word by word, blocks settle once (IntersectionObserver, so late-loading
  fonts and images above can never leave a section hidden), the arcade of arches is built arch by
  arch, numbers count up, the About text lights up word by word as it is read, and photographs in
  arches drift slightly against the scroll.
- **Under the pointer** (mouse or trackpad only): gold buttons lean toward it, arches and ministry
  cards tilt a few degrees with a sheen that follows it, and on the night sections a candle's glow
  follows it. The stories row can be dragged and glides to a stop.
- **Fireflies:** warm sparks rise slowly from the villages and flicker out (a small canvas that sleeps
  while the hero is out of view).
- **Arched edges:** each night section rises into the section above with the curve of a window's arch,
  and the first light section rises the same way over the hero.
- **Small things:** a gold rule draws under each section heading as it arrives; map lights send out
  a slow ripple; a scroll cue sits at the foot of the hero; a gold line under the header shows how
  far the page has been read; moving between public pages cross-fades (cross-document view
  transitions, where the browser supports them); the footer ends in the ParishLife name, which a
  band of light crosses now and then.
- **Reduced motion, or a script failing to load:** every element shows in its final state, with the
  night valley and no smooth scrolling. Hidden starting states are only ever set by motion code.

## Parish pages

A parish's page (`public.html?parish=…`) speaks the homepage's language:

- **Hero:** without a photograph, the parish's own church at night: the same window, with the
  parish's initial in gold in one medallion (on a ground of its own colour, chosen from the parish
  id) and the cedar in the other, its name gilded on the sill, and its candle lit among the others
  (choosing it goes to the visit details). With a photograph, the photograph fills the hero. The
  parish's other pages (request, calendar, event) open under the top of its window. Then the parish's name in both languages, a plain line built from its town, rite
  and diocese (or its own welcome text), the next Mass ("Today at 18:00 · in 2 hours", by Beirut's
  clock, marked "Beirut time" for a visitor abroad), the way to ask the office, the livestream when
  there is one, sharing (WhatsApp, copy the link, the phone's own sheet), and the next published
  event, counting down. Within 40 days of the parish feast a gold line counts down to it.
- **Section bar:** sticks under the header, names the parish once the hero is behind, and slides a
  gold line under the section being read.
- **Events and calendar** is on every parish page, linked from a hero button: the next four
  events as cards (date arch, time, kind, how many days away, and an `.ics` button each), one
  button that saves all of them to the visitor's calendar, then the calendar itself (a month of
  days with dots, the chosen day or the rest of the month beside it, a coming-up list, and search)
  and a link to the calendar on its own page. A parish with nothing published yet says so and
  still shows the month. Beneath it, **Never miss a celebration**: subscribe to the parish calendar
  (a feed the visitor's calendar keeps up to date), Google Calendar, the parish's WhatsApp channel
  when it has one, and following the parish from a ParishLife account.
- **Other sections,** each shown only when the parish has published something for it: About
  (history and facts, the feast day among them), Mass times (the published text, the Masses of the
  next seven days, confession and office hours, the livestream), Ministries and clergy, Requests (the
  arcade, straight to this parish, with "Before you ask: what to bring" when the office has written
  it), News, Photographs (with a lightbox), and Visit (contact details, Plan your visit: what to
  expect, languages and rite, parking and accessibility; directions, and the map of Lebanon zooming
  in to the parish). Parishes nearby close the page.
- **The Church's year on parish pages:** the parish calendar sets Sundays in gilt and marks the great
  feasts with a small cross, naming the feast above the chosen day; each event page says where its
  day stands in the Maronite year. The About arch of a parish without a photograph is an icon (gold
  leaf, a haloed initial in cinnabar, a red lamp before it); ministries and request kinds are gilded
  niches.
- **Event page** (`&event=…`): one event, with when (and how far away), where and what; saving it to
  the visitor's calendar or to Google Calendar, directions, sharing, and what else is coming at the
  parish. Every event card and calendar entry links to it, and a shared link carries its preview.
- **Request form** (`&request=…`): the request type as a choice of arches, then who is asking and the
  request itself, with what happens next beside it. Sending it draws a gold check and gives the
  private tracking link with a copy button. **Tracking** (`#track=…`) shows where the request stands
  as four steps. **Calendar page** (`&view=calendar`): the calendar on its own.

## Other public pages

- **Request tracking and the signature check** are parchment with a gilded inner rule, sealed with red
  wax bearing the Maronite cross; each finished step of a request lights a candle, the current one
  burning brightest (red when documents are missing).

- **For parishes** (`public.html?view=bundles`, "ParishLife bundles" in the footer): the four bundles as
  arches, one gold light for each step up, with what each includes; how a parish joins; the practical
  notes on subscriptions; and a call to the members portal.
- **A page that could not be shown** (an unknown parish, a directory that did not load, a parish that
  takes requests only through its office): an unlit lamp in an arch, what happened, and the way back.
- **Phone menu:** the whole screen at night, the links rising one by one, the valley's villages at the
  foot and the members portal as the one gold button.
- **On a phone:** the site installs as an app (`site.webmanifest`, icons in `assets/images/icons/`),
  and `sw.js` keeps what the public pages last showed readable without a connection (the network
  always comes first; the portal and private links are never kept). On a phone asking to save data,
  or one with little memory, the page drops smooth scrolling, the fireflies, image parallax and glass
  blur (`lite` in `assets/home-motion.js`).

## Sign in and sign up

The members portal opens beside the same church window as the public site (its light by the hour, the
lamp, the incense, a few candles already lit and the rest for the visitor to light), next to a compact
form on warm limestone, in the public site's type and colours (`assets/auth.css`, scoped to
`.account-auth`; the scene comes from `assets/sanctuary.css`).

- **Sign in:** one field for an email, a phone number (typed as it is dialled in Lebanon) or a
  username, the password, "Forgot your password?" (the parish office resets it), and **Sign in with a
  passkey** where the browser supports passkeys.
- **Sign up:** names, the date of birth as day, month and year, email and/or phone (with +961 in
  front unless another country code is typed), and the two passwords with their rules shown before
  typing and ticked off as they are met. Turnstile appears when the platform has a key for it. A new
  account opens on My account with a note on choosing a parish, already following the parish whose
  page the visitor came from.
- **My account → Sign-in and security** adds and removes passkeys, one per device.
- The portal stops the page itself from scrolling (its panels scroll inside), so the sign-in screen is
  its own scrolling area, with the valley pinned beside the form; on short laptop screens the spacing
  tightens so signing in fits without scrolling.

## Content and the dashboard

- **Homepage editor** (dashboard → Administration → Homepage, Super Admin): hero title and
  subtitle, a seasonal announcement, stories, the about text, and which sections are shown
  (the verse among them), in English and Arabic, with drafts and publishing.
- **Parish Website content** (each parish): welcome, history, Mass times, contact and
  sacraments text, already edited under Website content.
- **Public parish profile** (each parish): photos, coordinates, visiting information, the patron
  feast and its day, languages and rite, parking, what to expect on a first visit, what to bring for
  a sacrament, the livestream and the WhatsApp channel. Coordinates place the parish on the map.
- **Calendar and announcements** (each parish): public events and posts.

## Implementation

| Part | Files |
| --- | --- |
| Page shell, header, footer | `public.html`, `assets/site.css` (fonts, tokens, chrome; shared by every public page) |
| Homepage | `assets/home.js`, `assets/home.css`; wired in `assets/public.js` (`homeView`, `mountHome`) |
| Sanctuary scene | `assets/home-sanctuary.js` (the window picture and a parish's initial over it, arcade, light, haze, lamp and candles, mosaic) and `assets/sanctuary.css`; rendered pictures in `assets/images/sanctuary/` made by `docs/tools/render_sanctuary.py`, `render_wall.py` and `render_candle.py`; used by the homepage, parish pages, their banners and the sign-in screen |
| Church details | `assets/church.css` (loaded last on public pages: hero words over the scene, niches, stars, bell, initial, notices, wax seals, frieze, flames on the map, gilded buttons, pointer, fields), `assets/liturgy.js` (seasons and feasts) |
| Valley (parish pages) | `assets/home-valley.js`; rendered layers in `assets/images/valley/` and village spots in `assets/data/valley.js`, made by `docs/tools/render_valley.py` (wide and tall framings, night and dawn); mirrored in Arabic |
| Map of Lebanon | `assets/home-map.js`, data in `assets/data/lebanon-map.js`, relief in `assets/images/lebanon-relief.webp` |
| Motion | `assets/home-motion.js` (homepage and parish pages) |
| Parish pages | `assets/parish.js`, `assets/parish.css`, calendar in `assets/public-calendar.js`; request sending and tracking in `assets/public-features.js` |
| Sign in and sign up | `assets/auth.js`, `assets/auth.css`; passkeys in `assets/passkeys.js`, Turnstile in `assets/turnstile.js` |
| Search | `assets/search.js` (homepage hero, directory and parish picker) |
| Public data, previews | `backend/public_site.py` and `cloudflare/src/public-site.js` (kept in parity) |
| Sign-in protections, passkeys | `backend/sign_in.py` and `cloudflare/src/sign-in.js` (kept in parity), `backend/common-passwords.json` |
| App and offline | `site.webmanifest`, `sw.js`, `assets/images/icons/` |
| Built-in wording | `assets/site-defaults.js`, shared by the homepage and the editor |
| Homepage editor | `assets/views/homepage-editor.js` |
| Homepage content API | `backend/site_content.py` and `cloudflare/src/site-content.js` (kept in parity), table `pl_site_content` in `backend/workspace-schema.json` |

### Insights and the parish CRM (Super Admin)

Dashboard → **Insights** (`assets/views/insights.js`, charts in `assets/views/insight-charts.js`,
styles in `assets/insights.css`; data from `backend/analytics.py` and `cloudflare/src/analytics.js`,
kept in parity).

- **Overview:** visits, page views, requests sent, new accounts, parishes followed, links shared and
  directions or calls, each against the period before; daily visits and page views; the most viewed
  pages; the forms filled most (guest requests by kind, member requests, sign-ups, ministry joins);
  where visitors come from, their devices and languages; the path from a visit to a sent request;
  what visitors did; what they searched for; and the parishes with the most visits.
- **Parishes (CRM):** every parish with its stage (onboarding, active, needs attention, paused), a
  health score (profile completeness, activity, published content, how quickly requests are
  answered), requests overdue past three days, the median answer time, the follow-up date and who
  follows it; sorting, search and a CSV export. A parish opens in a drawer with its own numbers and
  trend, the checklist behind its score, recent requests, its team, and notes.
- **How visits are counted:** no cookies and nothing stored on the visitor's device. A visit is one
  visitor on one day, recognised by a hash of the address and browser with a salt that changes
  daily and is deleted the next day; the hashes are kept 95 days. Browsers that send Do Not Track or
  Global Privacy Control are not counted, nor are known robots. Only daily totals are kept
  (`pl_stats`), by page, parish and kind.

### Personal signatures and signed documents

- **Setting up** (My account → My signature; priests and parish office staff): the person draws
  their signature and saves it with one of their passkeys, unlocking it with their face,
  fingerprint or PIN. Removing that passkey removes the signature with it.
- **Signing:** Sign and issue a certificate, or Write a signed letter on a guest request, asks for
  that same passkey with user verification, over a challenge made from a fingerprint (SHA-256) of
  the exact content and a nonce kept in a five-minute cookie. The server checks the passkey's
  signature, stores the proof with a 12-character code (`XXXX-XXXX-XXXX`), and keeps the drawing as
  it was when signing. The proof never goes into the audit trail.
- **What the reader sees:** the certificate carries the drawing, the printed name, the title and a
  line with the code; a letter appears on the applicant's tracking page with the parish letterhead
  and can be printed.
- **Checking** (`public.html?verify=CODE`, "Check a signed document" in the footer): who signed,
  for which parish, when, and whether the signature is valid and the document unchanged (the
  fingerprint is computed again from the record). A withdrawn signature says so.
- Files: `backend/signatures.py` and `cloudflare/src/signatures.js` (kept in parity),
  `assets/signing.js`, tables `pl_signers`, `pl_signatures` and `pl_letters`.

### Public data and link previews

- `GET /api/public/overview`: every parish with what the homepage shows of it, in one answer (the
  homepage used to fetch each parish's full page). A parish's own pages also fetch its full
  `GET /api/public/parishes/<id>`.
- `GET /api/public/parishes/<id>/calendar.ics` (`?lang=ar` for Arabic titles): the parish's public
  events as a calendar feed, in Beirut time, refreshed by calendars every few hours.
- `public.html?parish=…` (and `&event=…`) is answered with that parish's or event's title,
  description and picture in its preview tags, every address absolute, and schema.org `Church` or
  `Event` data, so a link shared on WhatsApp shows the parish rather than the homepage. On
  Cloudflare this needs `run_worker_first` for `/public.html` (`wrangler.jsonc`).

### Sign-in protections

- Ten wrong passwords for one account, or sixty from one address, within fifteen minutes pause
  signing in for that account or address (table `pl_login_failures`, keys stored as hashes).
- A new password is refused when it is common, contains the email or phone, or appears in Have I Been
  Pwned's Pwned Passwords (only the first five characters of its SHA-1 are sent; if the service
  cannot be reached the password is accepted).
- Passkeys (WebAuthn, ES256 and RS256) are stored in `pl_passkeys`; the sign-in challenge travels in
  a five-minute cookie. They work on the site's own address over HTTPS, and on `localhost`.
- **Settings the platform can add** (Cloudflare: Worker variables and secrets; `server.py`:
  environment variables): `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET` turn on Turnstile for sign-up
  and requests; `CF_ANALYTICS_TOKEN` adds Cloudflare Web Analytics (no cookies) to the public pages.
  Without them nothing changes.

### Homepage content API

- `GET /api/public/site`: the published projection. Unpublished stories, a draft announcement and
  hidden About/Join blocks never leave the server.
- `GET /api/workspace/site-content` and `PUT /api/workspace/site-content`: Super Admin only. A save
  sends the `revision` it opened; a stale revision is refused (409). Text is limited per field,
  links must be HTTPS, a page path or a `#section`, and images HTTPS or a photograph in
  `assets/images/`. Each save is recorded in the history as `site.homepage.updated`.

The editor opens from **Administration → Homepage** and, for a Super Admin, from
**Member portal → Website content → ParishLife homepage**. An empty field keeps the built-in
wording, shown in grey as the field's placeholder.

### Where parishes appear on the map

A parish sits where its public parish profile's coordinates place it (**Administration → Edit
public parish profile**). Without coordinates it is shown at its town centre when the town is in
the gazetteer in `docs/tools/build_lebanon_map.py` (marked "shown at the town centre"); otherwise
the list says it is not on the map yet. Parishes in the same town are spread on a small ring;
close lights gather into a numbered cluster that zooms in when chosen.

### Rebuilding the map data

```
python docs/tools/build_lebanon_map.py natural-earth-vector/geojson/ assets/data/lebanon-map.js assets/images/lebanon-relief.webp
```

It needs numpy, shapely and pillow, and a checkout of
[natural-earth-vector](https://github.com/nvkelso/natural-earth-vector). The relief is stylized from
the main summits and river gorges, not survey data; the Litani and Orontes courses are approximate.

### The valley render

The hero is not a photograph: `docs/tools/render_valley.py` generates it. An eroded heightfield
(ridged and slope-damped fractal noise) rises to a snow-capped crest. It is coloured by slope and
altitude (limestone, scrub, pine, snow with gullies, villages) and lit for blue hour (moonlight,
afterglow on the peaks) or dawn (low raking sun). A voxel-space renderer draws it with aerial
perspective and valley mist. About four thousand warm windows and three illuminated crosses are
projected, occluded by the terrain and bloomed.

Each mood is written as layers so the page can move them: sky, far crest (beyond 14 km), and the
valley, plus the village glow as an alpha layer. Every layer is complete behind the next, so
nothing tears when they part. The centres of the brightest village clusters are written to
`assets/data/valley.js`; the page places one gold light per parish on them, away from the headline.

The wide frame looks 14 degrees left of the valley axis so the brightest town sits opposite the
headline; Arabic mirrors the images (never the animated container, which GSAP would read as a
rotation). Clouds and mist use noise tied to view angles, so they keep their shape in the tall
phone frame, and the village glow is normalised for resolution, so a preview and the final render
match.

```
python docs/tools/render_valley.py /tmp/valley --size 2560x1440 --portrait 1080x1920
python docs/tools/render_valley.py /tmp/valley --publish .
```

### The sanctuary render

The window is designed as a glazier's cartoon in `docs/tools/sanctuary_window.mjs`: every piece of
glass with its colour, the lead between them, the stone tracery over them. The rose has the cross
of the Maronites at its heart, a ring of ruby, a ring of jewels and twelve leaves of ruby and green
between the spokes; the lancets have jewelled borders, pale quarries and a medallion each (the cedar
on its hill, the chalice and the host). `docs/tools/sanctuary_layers.mjs` draws it in layers
(glass, lead, tracery, openings, stone outline) with Playwright, and `docs/tools/render_sanctuary.py`
gives them their materials:

- **Glass:** each piece its own sheet, its colour taken as transmittance and raised to a thickness
  that varies with streaks drawn its own way, so deep colours deepen; some pieces are seedy with
  bubbles, the pale quarries are hammered rolled glass with a quatrefoil in silver stain outlined in
  grisaille; the painter's matt darkens each piece toward its leads, so it glows from within; dust
  gathers at the foot. Daylight behind is brighter above and toward the sun.
- **Lead and solder:** rounded came that catches the candles, with solder where the cames meet.
- **Stone:** the arch's voussoirs and keystone, coursed ashlar in the plate with voussoirs turned
  round each opening, chamfers and splays, worn arrises, mortar, pits and soot; lit by the candles
  from below, by the glass on the splays and the ribs' edges, with ambient occlusion.
- **Bloom** from the brightest glass, an ACES-like tone curve and a little grain.

The default window has the cedar and the chalice (`window-1080.webp`, `window-1620.webp`); a
parish's window (`parish-<ground>-1080.webp`) has a blank left medallion on one of four grounds
(deep blue, wine, moss, violet, chosen from the parish id) where the page sets the parish's initial
in gold glass, and the cedar on the right. `docs/tools/render_wall.py` renders a seamless tile of
dressed limestone (1152 by 576 CSS pixels) and `docs/tools/render_candle.py` the flame, the beeswax
taper with its drips and the brass tray. They need numpy, scipy and Pillow; every random choice is
seeded, so a render repeats exactly.

```
node docs/tools/sanctuary_layers.mjs /tmp/sanctuary 2 window:deep:cedar:chalice parish-deep:deep:blank:cedar parish-wine:wine:blank:cedar parish-moss:moss:blank:cedar parish-violet:violet:blank:cedar
python3 docs/tools/render_sanctuary.py /tmp/sanctuary/window assets/images/sanctuary/window 1080,1620
python3 docs/tools/render_sanctuary.py /tmp/sanctuary/parish-wine assets/images/sanctuary/parish-wine 1080
python3 docs/tools/render_wall.py assets/images/sanctuary 1.25
python3 docs/tools/render_candle.py assets/images/sanctuary
```

### Assets and licences

- Marcellus, Amiri and Source Sans 3: SIL Open Font License, notices in `assets/fonts/`.
- GSAP 3.15.0: GreenSock Standard "No Charge" License, see `assets/vendor/gsap/README.md`.
- Lenis 1.3.26: MIT License, `assets/vendor/lenis/LICENSE.txt`.
- The valley images, mist and `crest-dawn.webp` are generated by `docs/tools/render_valley.py`.
- The sanctuary pictures in `assets/images/sanctuary/`, `gilt.webp` and `votives.webp` are generated
  by the tools above.
  The season signs (the star, the cross of light, the Lenten veil, the paschal candle) come from
  `docs/tools/render_seasons.py`.
- Lebanon outline and governorates: Natural Earth 1:10m, public domain.
- `church-light.webp` and `church-interior.webp` are resized copies of the Unsplash photographs
  credited in `docs/public-site-design.md`. `og-home.jpg` is the dusk valley layers with the headline.
