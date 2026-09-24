# ParishLife — frontend

A static, frontend-only rebuild of the ParishLife parish-administration interface.
Every module in *ParishLife — Features and Development Roadmap* (20 September 2026)
has a working screen, and every token, control and pattern in the **ParishLife design
system v1.0** is used by the product and shown in a living style guide inside it.

No backend, no build step, no framework, no dependencies.

```bash
python3 .claude/serve.py 4399     # then open http://localhost:4399
```

Serve it — don't open `file://`. The code is ES modules and browsers block module
imports from the file system.

---

## Where things are

| | |
|---|---|
| `index.html` | the application |
| `landing.html` | the public marketing site |
| `assets/parishlife.css` | **the design system** — tokens and every component primitive |
| `assets/components.js` | the interactive controls (date picker, autocomplete, charts, menus…) |
| `assets/app.css` | application shell and screen layouts |
| `assets/app.js` | shell, hash router, command palette, notifications, account menu |
| `assets/actions.js` | every `data-act` verb — exports, approvals, sign-offs, calendar moves… |
| `assets/flows.js` | the designed flows those verbs open: drawers, dialogs, generated files |
| `assets/crud.js` | create, edit and delete for every record type, from one registry |
| `assets/persist.js` | saves the parish in this browser and loads it back; backup, restore, reset |
| `assets/store.js` | session state, the five roles and their rails |
| `assets/data.js` | demo parish: Saint Elias, Hadath |
| `assets/ui.js` | page header, tabs, table, panel, drawer, modal, toast, menu, status pill |
| `assets/icons.js` | the icon set; direction-bearing icons mirror in Arabic |
| `assets/views/*.js` | one file per area of the rail |

**81 routes** (every tab is its own route), five roles, two directions. `#/styleguide` is the design system
rendered by the same CSS the product uses, so the library cannot drift from the app.

## Colour

Six brand colours, everything else derived from them:

```
#0D1B2A  ink     the rail and full-bleed dark panels
#1B263B  navy    body text, primary hover
#415A77  slate   primary action, links, focus ring        7.1:1 on white
#778D7A  sage    sync dot, quiet positive marks
#D4C4A8  sand    active marker on the dark rail, fills
#F4F1DE  cream   page ground
```

The palette runs dark to light, so the frame is dark and the work is light: an ink
rail, a cream page, white cards, slate for anything you can act on, and sand for the
one marker that says "you are here". `#7E6435` is sand darkened far enough for an
eyebrow or a feast marker to clear 4.5:1 on cream. Status colours are the only
additions, because the palette has no red or amber; their tints and inks are all
contrast-checked on the cream ground.

## What is covered

All seventeen modules from the roadmap, plus the four added features (weekly bulletin
builder, permanent parish QR, ready-made parish designs, print my week). Module 18 —
AI chatbots — is deliberately absent, as the document asks.

Archdiocese & parish · People & households · Groups & ministries · Calendar & events ·
Facilities & resources · Liturgical service planning · Sacramental records · Volunteer
management · Registration & payments · Secure check-in & safeguarding · Communication
centre · Giving & finance · Music & worship resources · Parish content & member portal ·
Forms, workflows & automation · Reporting & analytics · Security & administration.

## Things worth knowing

**Five roles.** Switch from the avatar menu, top right (a demo control). The rail, the screens and the
permissions all change — what a role may not use is *absent from the rail*, not greyed
out. A secretary has no Giving entry at all; a ministry leader sees only her own groups
and teams; a volunteer gets a check-in station with no navigation.

**Bilingual, both directions.** The language switch in the avatar menu mirrors the whole interface:
rail side, table column order, chevrons, drawer entry edge. Numerals and amounts stay
left-to-right in both, and Arabic runs one size larger with looser leading. Every
string is a `t(english, arabic)` pair at its call site; French is a third argument and
one `case` in `i18n.js`.

**Dual currency.** USD leads, lira follows in mono, and the rate that produced the
figure travels with the amount. Lira given as lira is never silently converted.

**Offline.** Toggle it in the account drawer to see the shell banner and the
queued-changes state.

**Your changes are saved — without a server.** Every record can be created, edited
and deleted: people (archive, restore, reviewed permanent deletion), households,
groups and their rosters, events, rooms and equipment, room requests, funds,
expenses, pledges, appeals, hymns and setlists, messages, notices, prayer
requests, registration forms, sign-up sheets, workflows, issues and volunteers.
The whole parish is written to the browser's `localStorage` after every change
(`assets/persist.js`) and read back before the first render, so a reload shows
exactly what you left. Settings → Data & retention downloads the parish as a
backup file, restores one (to move it to another browser or computer), or resets
to the sample parish. `assets/crud.js` holds the shared create/edit/delete
engine: one registry of record types, one form, inline validation, a confirm step
and Undo on every change; deleting is refused where it would orphan something
(a room with bookings, a fund with money in it, equipment out on loan). When a new
version of the app adds fields to the sample records, a saved parish picks them up once
(`REV` in `persist.js`) without losing anything you changed.

**Every control does its job.** Buttons change the in-memory parish and re-render in
place — approve a reservation, sign a certificate, close a counting batch, merge a
duplicate, reorder a service, move someone on the rota — and reversible changes offer
Undo in the toast, as sheet 04 asks. Exports are real files generated in the browser:
CSV (with a BOM so Excel reads Arabic), `.ics`, receipts and giving statements, the
Sunday slide deck and the ready-made parish designs as SVG. A click sweep of every
control on every route, and of every control inside the dialog it opens — about 2,000
clicks across the five roles — finds no placeholder and no dead button.

**Status badges.** Every status pill carries an icon as well as a colour — a tick for
approved, a clock for pending, a cross for declined, a lock for private — so the state
reads without relying on colour alone. The mapping lives in one place (`STATUS` and
`TONE_ICON` in `assets/ui.js`, glyphs `st-*` in `assets/icons.js`).

**Dropdowns.** Every `<select class="select">` becomes the design system's own list on a
mouse or trackpad: arrow keys, Home/End, type-ahead, Enter and Esc work, lists longer
than eight options get a filter box, and it mirrors in Arabic. The native select stays
underneath and keeps the value, so forms and change handlers are untouched. Phones and
tablets keep their own picker, which is the better control there.

**Family tree.** A person's Family tab draws the household as a tree — parents,
the couple joined by a ring, brothers and sisters, children and grandchildren — built
from each member's relationship. Add a member, change a relationship or remove someone
from the household from the same tab; emergency contacts come from the same records.

**Filters and search.** Every filter on a list really filters and every search box
really searches: people (status, town, rite, envelope holders), households, music
(occasion, Mass part, language), the calendars shown, sacraments (sacrament, year),
reservations, the audit trail (kind), and reports (period, fund). Search ignores case, accents and Arabic spelling variants
(أ/ا, ة/ه, ى/ي, tashkeel, Arabic-Indic digits), and a phone number matches however it
is typed. What you typed survives a re-render, and an empty result says so.

**Responsive.** Below 1180px the rail collapses to icons; below 760px it becomes an
off-canvas drawer with a bottom nav, and secondary table columns drop out rather than
forcing a sideways scroll to read a name. No horizontal overflow down to 332px.

**Rota board.** Drag a volunteer from the tray, or a card from another team, onto an
open place; drop a card on a card to swap them. Double-bookings get the red border and
swap requests the pending badge from sheet 04. On a phone, tap the empty place instead.

**Calendar.** Month, week and day views share one event chip. On a phone the month
shows dots and a tap on any day opens that day.

**Keyboard.** ⌘K opens the command palette over actions, pages and people. Dialogs
trap Tab and restore focus on close. Focus rings are never removed.

## Limits of this build

It is a frontend. Changes are kept in this browser only: another browser or
computer starts from its own copy unless you restore a backup there. Nothing is
sent to a server, and no permission is really enforced — the role switch is a
demo control, not authentication. Clearing the browser's site data clears the
parish too, so download a backup first.

The registers are **not** ready for real documents: numbering, access and retention
have to be confirmed with the eparchy first, as the roadmap says. Certificate layouts
here are illustrative, and the pricing on the landing page is placeholder.
