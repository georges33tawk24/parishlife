---
name: ParishLife
description: Bilingual parish administration for Lebanon. Forest and warm white where the work is done; night, lapis and gilt where a parish meets the public.
colors:
  primary: "#233B32"
  primary-hover: "#172B23"
  primary-subtle: "#EDF0E8"
  selection: "#D6E1D0"
  bg: "#F7F7F2"
  surface: "#FFFFFF"
  muted: "#EDF0E8"
  border: "#DCE2DB"
  border-strong: "#9BAC9F"
  text: "#233B32"
  text-2: "#607068"
  success: "#365546"
  warning: "#795C2F"
  danger: "#B42318"
  night: "#0E1A31"
  lapis: "#2A4A96"
  gilt: "#D7A548"
  gilt-ink: "#80601C"
  mist: "#F5F1E8"
typography:
  heading:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "-.015em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "26px"
  ui:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "18px"
  public-display:
    fontFamily: "Marcellus, Amiri, Georgia, serif"
    fontWeight: 400
rounded:
  input: "6px"
  card: "10px"
  modal: "14px"
  pill: "999px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "16px"
  s4: "24px"
  s5: "32px"
  s6: "48px"
  s7: "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.card}"
    height: "40px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  input:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.input}"
    height: "40px"
---

# Design System: ParishLife

Tokens live in `frontend/src/styles/parishlife.css` (portal and product page) and `frontend/src/styles/site.css` (public site). This file says how to use them. The running reference is the portal's own `#/styleguide`, drawn with the same CSS as the product.

## Overview

Two worlds, one product. Choose by who is on the screen, not by which file is open.

- **The office** (portal): forest, sage and warm white, set in Inter. The people using it have a job to finish, often a volunteer on an old monitor in poor light. The interface should disappear into the task: familiar patterns, consistent controls, density where it helps. Its identity lives in a few precise details: Marcellus page titles, the gold mark in the rail, a colour for each person.
- **The sanctuary** (public site, sign-in, product page): night, lapis and gilt, with Marcellus over Source Sans 3 and the stained-glass window. A visitor is arriving at a place, or deciding whether to trust one. These surfaces may have atmosphere. On the product page the app window keeps the office's colours, so it reads as the real product.

Parishes choose their own colours (`lib/theme.js`), so components use tokens, never the forest hex values.

## Colors

Colour says what can be acted on and what state something is in. It does not decorate.

- `--primary` is for primary actions and the current selection. One primary button per view. Text on anything filled with it is `--on-primary`, never a literal white: in dark mode `--primary` turns pale and `--on-primary` turns dark.
- `--selection` marks what is chosen: the pressed segment, the chosen chip, selected text.
- `--feast` is the gold dot for a feast day in the date picker, in every parish scheme and in dark mode.
- Status (`success`, `warning`, `danger`) always comes with a word or icon, never colour alone. Amber is reserved for pending work.
- Text is `--text` or `--text-2`. Both clear 4.5:1 on white and on `--bg`.

## Typography

- **The floor is 12px.** The exceptions are initials in small avatars, counts inside 16px circles, event times in a calendar cell, the printed A4 sheets and chart ticks.
- The portal's scale is six sizes: 32, 24, 20, 16, 14 and 12, in `.t-*` classes. Inter does the work, with IBM Plex Mono for figures and references, never as decoration. The one exception is the page title (`.pagehead h1`), in Marcellus, or Amiri in Arabic: never use a display face on labels, buttons or data.
- Arabic runs one step larger with looser leading (IBM Plex Sans Arabic in the office, Noto Sans Arabic and Amiri in the sanctuary).
- Figures use tabular numerals and stay left to right in both directions. USD leads at full size; lira follows, smaller, in mono, with the rate that produced it.

## Layout

- Spacing lands on 8, with 4 only inside a control.
- Use logical properties (`inset-inline`, `margin-inline-start`) so Arabic mirrors without separate styles. Chevrons mirror; clocks, logos and play triangles do not.
- Portal: rail plus top bar on desktop, an icon rail on tablets, a bottom bar and an off-canvas rail on phones. Wide tables scroll inside their card, and `hide-sm` / `hide-md` columns drop out.
- Touch: hit areas reach about 44px on a coarse pointer, using `::after` on the control so its drawn size does not change. Anything that lifts on hover is gated, since a tap also reports a hover.

## Elevation & Depth

Three levels: `--e1` resting cards, `--e2` menus and toasts, `--e3` drawers and modals. Shadows always have an offset and a soft blur, and something off-canvas casts none until it is open. The focus ring is not elevation: `--focus` is a gap in the surface colour and then the text colour, which clears 3:1 in light mode, dark mode and on the rail, with a transparent outline for high-contrast mode. A field whose border has already turned dark may use `--focus-soft`.

## Shapes

`--r-input` 6px for fields and menu rows, `--r-card` 10px for buttons and cards, `--r-modal` 14px for sheets, full pills for status and filters. The arch is the public site's own shape; the portal does not borrow it.

## Motion

Motion explains a state change, gives feedback, or keeps things spatially connected. Otherwise it does not exist. Frequency decides: what happens many times a day gets the least.

| Moment | Treatment |
|---|---|
| Command palette | None. It opens from the keyboard, many times a day. |
| Moving between pages | 120ms fade, no travel. |
| Button press | `scale(.97)`, at once. |
| Menus, dropdowns | 120ms from `scale(.97)`, growing from the corner nearest their trigger. |
| Modals | 200ms in, 120ms out, centred. |
| Drawers | 300ms in on `--ease-drawer`, 200ms out. |
| Toasts | A transition from `@starting-style`, so quick repeats retarget. Timers wait while the tab is hidden. |
| Marketing | May run longer, once, in view. Not one identical entrance on every section. |

- Curves: `--ease` for arriving and responding, `--ease-drawer` for sheets. Never `ease-in`, never from `scale(0)`, never `transition: all`.
- Animate `transform` and `opacity`. Anything else needs a reason.
- **Reduced motion means nothing travels and nothing loops, not that nothing responds.** State changes still fade. An endless animation must stop or become a slow opacity change: an infinite spinner at `.01ms` strobes.

## Components

Use what is already in `portal/ui/ui.jsx` and `portal/ui/components.jsx` before writing a lookalike.

- **Every state is designed:** default, hover, focus, active, disabled, loading, error, and empty. A `Panel` with nothing in it says so by itself; give it `none` for words that fit, and use `Empty` when a whole screen is empty and there is a next step to offer. A new parish starts with no records, so check that view too.
- **Icon names** must exist in `portal/ui/icons.jsx`: an unknown name draws `⋮` and raises no error.
- **Icon-only controls** carry `aria-label` and `data-tip`. A label hidden with `display:none` is hidden from screen readers as well.
- **People** get a colour: `Avatar` picks one of six tints from the person's id, the same every time. Pastels live here and nowhere else.
- **The usual state is quiet.** `member` renders with no chip (`pill-quiet`), so that a pill in a list always means something needs reading.
- **Stats** are one strip (`.stats`), not a row of boxes. Cards are for groups of content, not for each number.
- **The rail** marks where you are with white on its own colour and one gold bar. Elsewhere in the office, gold only marks a feast day.
- **Search boxes** are `SearchField` or `SearchClear`. Both name their input for screen readers. A bare `<input type="search">` needs its own `aria-label`.
- **Required fields** are checked with `need` / `needAll` from `shared/dialogs.jsx`, which marks the field itself. Do not use a toast, which disappears and does not say which field.
- **Scroll regions** soften the edge content leaves through instead of cutting it: a mask on the rail, a sticky gradient in drawer and modal bodies. Do not put a mask on anything that holds a floating dropdown, because a mask clips its fixed children too.
- **Faux product UI** on the product page follows `landing/CountingDemo.jsx`: one window, one object straddling its edge, real words on what the story is about and placeholders where it crops, a cursor that moves only to do something, figures that never rewind, motion by transform and opacity only, a pause control, and a finished frame for reduced motion.
- **Saying something was sent:** only say someone was told if something really reached them. In-app notifications exist for member requests, bookings, meetings and messages; WhatsApp, SMS and email are not connected. Everywhere else, write "Nothing is sent automatically."

## Do's and Don'ts

**Do**

- Write every visible string as `t('English', 'عربي')`.
- Check phone width and Arabic before calling anything finished.
- Reuse tokens; add one only when a value is genuinely reused.

**Don't**

- Don't use a modal when a drawer or inline edit would do.
- Don't use a kicker above a heading when it only repeats what is around it, or number sections whose order means nothing.
- Don't use a coloured side-stripe on a card where a word or icon would say more.
- Don't put running text over the window artwork at any strength that competes with the words: contrast checks cannot see a background image, so look.
- Don't use emoji or Unicode arrows as icons; icons come from `portal/ui/icons.jsx`.
- Don't claim something, on the product page or in a toast, that the product does not do.
