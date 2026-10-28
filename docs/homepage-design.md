# Homepage design

The public homepage (`public.html`, served at `/`) is the first thing a parishioner,
a family planning a baptism, or someone abroad looking for their village church
sees. Its job, in order: help them find their parish, show what is happening there,
and let them ask the parish office for something.

## Concept: lights of the valley

At dusk in the Lebanese mountains, the village churches light up across the slopes
of the Qadisha valley. ParishLife connects those parishes, so the page is built
around that image: a dawn landscape where each light is a parish, and a hand-drawn
map of Lebanon where the same lights mark the parishes in the directory.

## Tokens

| Name | Hex | Role |
| --- | --- | --- |
| Night lapis | `#0E1A31` | Night sky, deep sections, footer |
| Lapis | `#2A4A96` | Links, focus, interactive accents (the blue of icon mantles) |
| Gilt | `#D7A548` | Parish lights, the selected state, primary buttons on dark |
| Limestone | `#E6DED0` | Stone planes behind images and quotes |
| Mist | `#F3F5F7` | Page background, a cool morning white |
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
├─ THIS WEEK: the seven days as a ribbon (a red lamp marks today, dots mark what is published) and the
│    week's celebrations as cards with a date arch and an add-to-calendar button; a day narrows them
│
├─ DIRECTORY: [ map of Lebanon, relief lines, parish lights ] [ parish list, arch photos ]
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

- **Loader:** a night screen with the arch mark, its gold light breathing, until the page is ready.
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

- **Hero:** without a photograph, the valley flies in to the parish's own gold light, named, at a
  village of its own (chosen from the parish id, so it stays put). With a photograph, the photograph
  fills the hero. Then the parish's name in both languages, a plain line built from its town, rite
  and diocese (or its own welcome text), the way to ask the office, and the next published event,
  counting down.
- **Section bar:** sticks under the header, names the parish once the hero is behind, and slides a
  gold line under the section being read.
- **Events and calendar** is on every parish page, linked from a hero button: the next four
  events as cards (date arch, time, kind, how many days away, and an `.ics` button each), one
  button that saves all of them to the visitor's calendar, then the calendar itself (a month of
  days with dots, the chosen day or the rest of the month beside it, a coming-up list, and search)
  and a link to the calendar on its own page. A parish with nothing published yet says so and
  still shows the month.
- **Other sections,** each shown only when the parish has published something for it: About
  (history and facts), Mass times (the published text, the Masses of the next seven days,
  confession and office hours), Ministries and clergy, Requests (the arcade, straight to this parish), News, Photographs (with a
  lightbox), and Visit (contact details, directions, and the map of Lebanon zooming in to the
  parish). Parishes nearby close the page.
- **Request form** (`&request=…`): the request type as a choice of arches, then who is asking and the
  request itself, with what happens next beside it. Sending it draws a gold check and gives the
  private tracking link with a copy button. **Tracking** (`#track=…`) shows where the request stands
  as four steps. **Calendar page** (`&view=calendar`): the calendar on its own.

## Other public pages

- **For parishes** (`public.html?view=bundles`, "ParishLife bundles" in the footer): the four bundles as
  arches, one gold light for each step up, with what each includes; how a parish joins; the practical
  notes on subscriptions; and a call to the members portal.
- **A page that could not be shown** (an unknown parish, a directory that did not load, a parish that
  takes requests only through its office): an unlit lamp in an arch, what happened, and the way back.
- **Phone menu:** the whole screen at night, the links rising one by one, the valley's villages at the
  foot and the members portal as the one gold button.

## Sign in and sign up

The members portal opens on the valley at dusk beside a compact form, in the public site's type
and colours (`assets/auth.css`, scoped to `.account-auth`). Every field and check of the account
form is kept; sign-up pairs its fields (names, email and phone, the two passwords) so it fits one
screen, and passwords can be shown. The way to sign in (username, email or phone) is a choice of
three, not a dropdown. The portal stops the page itself from scrolling (its panels scroll inside), so the
sign-in screen is its own scrolling area, with the valley pinned beside the form; on short laptop screens
the spacing tightens so signing in fits without scrolling.

## Content and the dashboard

- **Homepage editor** (dashboard → Administration → Homepage, Super Admin): hero title and
  subtitle, a seasonal announcement, stories, the about text, and which sections are shown
  (the verse among them), in English and Arabic, with drafts and publishing.
- **Parish Website content** (each parish): welcome, history, Mass times, contact and
  sacraments text, already edited under Website content.
- **Public parish profile** (each parish): photos, coordinates, visiting information.
  Coordinates place the parish on the map.
- **Calendar and announcements** (each parish): public events and posts.

## Implementation

| Part | Files |
| --- | --- |
| Page shell, header, footer | `public.html`, `assets/site.css` (fonts, tokens, chrome; shared by every public page) |
| Homepage | `assets/home.js`, `assets/home.css`; wired in `assets/public.js` (`homeView`, `mountHome`) |
| Hero valley | `assets/home-valley.js`; rendered layers in `assets/images/valley/` and village spots in `assets/data/valley.js`, made by `docs/tools/render_valley.py` (wide and tall framings, night and dawn); mirrored in Arabic |
| Map of Lebanon | `assets/home-map.js`, data in `assets/data/lebanon-map.js`, relief in `assets/images/lebanon-relief.webp` |
| Motion | `assets/home-motion.js` (homepage and parish pages) |
| Parish pages | `assets/parish.js`, `assets/parish.css`, calendar in `assets/public-calendar.js`; request sending and tracking in `assets/public-features.js` |
| Sign in and sign up | `assets/auth.js`, `assets/auth.css` |
| Built-in wording | `assets/site-defaults.js`, shared by the homepage and the editor |
| Homepage editor | `assets/views/homepage-editor.js` |
| Homepage content API | `backend/site_content.py` and `cloudflare/src/site-content.js` (kept in parity), table `pl_site_content` in `backend/workspace-schema.json` |

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

### Assets and licences

- Marcellus, Amiri and Source Sans 3: SIL Open Font License, notices in `assets/fonts/`.
- GSAP 3.15.0: GreenSock Standard "No Charge" License, see `assets/vendor/gsap/README.md`.
- Lenis 1.3.26: MIT License, `assets/vendor/lenis/LICENSE.txt`.
- The valley images, mist and `crest-dawn.webp` are generated by `docs/tools/render_valley.py`.
- Lebanon outline and governorates: Natural Earth 1:10m, public domain.
- `church-light.webp` and `church-interior.webp` are resized copies of the Unsplash photographs
  credited in `docs/public-site-design.md`. `og-home.jpg` is the dusk valley layers with the headline.
