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
├─ THIS WEEK: the next Masses and events across parishes; a red lamp marks today
│
├─ DIRECTORY: [ map of Lebanon, relief lines, parish lights ] [ parish list, arch photos ]
│
├─ ASK YOUR PARISH: baptism · first communion · confirmation · marriage · funeral · certificate,
│    then the three steps (send · the office reviews · follow with your private link)
│
├─ MASS TIMES: one entry per parish, from each parish's Website content
├─ FROM THE PARISHES: latest published announcements
├─ STORIES: slides managed in the dashboard Homepage editor
├─ JOIN: members portal and account creation
└─ footer
```

## Principles

1. **Light is information.** Gold marks a parish; red marks today. Nothing glows for decoration.
2. **Arches, not cards.** Images sit in the round arch of Lebanese stone windows, on stone
   and mist planes, instead of rows of identical rounded cards.
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
- No all-caps labels above headings, no single accented word in a headline, no `·`-joined meta
  strings and no `→` appended to links.
- Numbers appear only where content is a real sequence (the three request steps).
- The directory is a map and a list, not a grid of identical cards.

## Motion

GSAP 3.15 (ScrollTrigger and SplitText, vendored in `assets/vendor/gsap/`), all inside
`gsap.matchMedia()` in `assets/home-motion.js`:

- **Load:** the sky lifts from night, the ridges rise into place, the headline reveals word by
  word, then the parish lights come on one after another. It plays once per visit; switching
  language shows the final frame.
- **Scroll out of the hero:** the sky moves to morning, ridge layers part at different speeds, and
  the lights fade as day comes. The header is clear at the very top, dark glass over the hero
  once the visitor scrolls, and light glass after it.
- **Sections settle once** as they arrive (IntersectionObserver, so late-loading fonts and images
  above can never leave a section hidden).
- **Map:** relief lines and rivers draw once when the map enters view, then the lights come on.
- **Answering the visitor:** hovering or focusing a parish in the list lights its place on the
  map; choosing a light selects the parish in the list and opens a card; a numbered cluster zooms in.
- **Reduced motion, or GSAP failing to load:** every element is shown in its final state. Hidden
  starting states are only ever set by the motion code, never by CSS.

## Content and the dashboard

- **Homepage editor** (dashboard → Administration → Homepage, Super Admin): hero title and
  subtitle, a seasonal announcement, stories, the about text, and which sections are shown,
  in English and Arabic, with drafts and publishing.
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
| Hero valley | `assets/home-scene.js`: SVG generated from a fixed seed; its width follows the viewport, so phones get their own composition; mirrored in Arabic |
| Map of Lebanon | `assets/home-map.js`, data in `assets/data/lebanon-map.js`, relief in `assets/images/lebanon-relief.webp` |
| Motion | `assets/home-motion.js` |
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

### Assets and licences

- Marcellus, Amiri and Source Sans 3: SIL Open Font License, notices in `assets/fonts/`.
- GSAP 3.15.0: GreenSock Standard "No Charge" License, see `assets/vendor/gsap/README.md`.
- Lebanon outline and governorates: Natural Earth 1:10m, public domain.
- `church-light.webp` and `church-interior.webp` are resized copies of the Unsplash photographs
  credited in `docs/public-site-design.md`. `og-home.jpg` is rendered from the hero scene.
