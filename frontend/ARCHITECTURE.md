# Front-end architecture

The front end is three React pages built by Vite into the repository root, where `server.py` and the
Cloudflare Worker serve them:

| Page | Entry | What it is |
| --- | --- | --- |
| `public.html` | `src/public/main.jsx` | The public site: homepage, parish pages, calendars, requests without an account, tracking, checking a signed document, bundles |
| `index.html` | `src/portal/main.jsx` | Sign-in and the members portal: the parish office, clergy, ministry leaders, members, bishops and the Super Admin |
| `landing.html` | `src/landing/main.jsx` | The product page |

`npm run build` writes those three pages and `assets/app/` (scripts and styles with hashed names).
Images and fonts are not built: they stay in `assets/images` and `assets/fonts` and are referenced by
absolute paths. The server owns sign-in, permissions and the records; the browser only shows them and
sends changes.

## Folders

```
frontend/src/
├── lib/                 used by all three pages: language (i18n.js), liturgical calendar, search,
│                        theme colours, rich text, the Turnstile check, visit analytics, map data
├── reading/             the easier-reading control (text size, Simple view) on every page
├── styles/              the stylesheets; styles/pages/ holds one entry per page that imports
│                        the parts in the order the cascade needs
├── landing/             the product page
├── public/              the public site
│   ├── main.jsx         entry
│   ├── App.jsx          loads the parishes and picks the page from the address
│   ├── site.jsx         the site context (language, parishes, filters) and text helpers
│   ├── motion.js        scroll and hero motion (GSAP, Lenis)
│   ├── pages/           one file per page (Home, ParishPage, RequestPage, EventPage, …)
│   └── components/      Chrome (header and footer), LebanonMap, Sanctuary, ParishCalendar, icons
└── portal/              the members portal
    ├── main.jsx         entry
    ├── shell/           the frame around every screen
    │   ├── Portal.jsx   sign-in until someone signs in, then the sidebar, top bar, the screen for
    │   │                the route, and the clicks every screen shares (data-go, data-act, …)
    │   ├── Auth.jsx     sign-in and sign-up
    │   ├── routes.jsx   the route table: every screen, its icon and names, who may open it
    │   ├── actions.jsx  what each data-act verb does
    │   └── version.js   refresh() and useVersion(): redrawing after records change
    ├── model/           data and the server
    │   ├── data.js      the parish records the screens read (PEOPLE, GROUPS, EVENTS, …)
    │   ├── persist.js   loading the parish from the server and saving changed collections
    │   ├── api.js       the session and the API client
    │   ├── store.js     who is signed in, their role, the route (S), navigation (go)
    │   └── …            member data, passkeys, signing, planning, sacrament requests
    ├── ui/              the design system: ui.jsx (page head, panels, tables, tabs, drawers,
    │                    modals, menus, toasts), components.jsx (fields, selects, alerts, …),
    │                    icons, the shared calendar, signatures, address fields
    ├── shared/          what every feature uses: dialogs.jsx (confirm, share, preview, …),
    │                    record-editor.jsx (create/edit/delete any kind of record), print.js
    └── features/        the screens, grouped as the sidebar groups them
        ├── dashboard/
        ├── records/         people, person, households, sacraments, requests, certificates, notes
        ├── parish-life/     calendar, services, groups, attendance, volunteers, registrations, check-in
        ├── spaces/          facilities, reservations
        ├── communicate/     messaging, inbox, notices, music, the parish website
        ├── money/           giving, finance, office expenses
        ├── administration/  forms, reports, audit, settings, eparchy, design system, workspace, insights
        ├── oversight/       the bishop's read-only view
        ├── member/          a member's own pages and requests
        └── account/         My account, password, guest requests linked to an account
```

Inside a feature folder:

- `<screen>.jsx` holds one screen (or a screen and the pages under it), for example
  `records/people.jsx` (the register) and `records/person.jsx` (one person).
- `<feature>-dialogs.jsx` holds the dialogs that feature opens, for example
  `parish-life/groups-dialogs.jsx` (new meeting, add member, hand over, …).
- `<feature>-shared.jsx` holds helpers two or more of its screens need.

Every file starts with a comment that says what it holds.

## Where to change things

| To change… | Look in |
| --- | --- |
| A screen of the portal | `portal/features/<sidebar group>/<screen>.jsx`; its route is in `portal/shell/routes.jsx` |
| What a button does (`data-act="verb:…"`) | `portal/shell/actions.jsx` (`VERBS`), then the dialog it opens in a `*-dialogs.jsx` file |
| The fields of a record form (person, group, event, fund, …) | `portal/shared/record-editor.jsx` (`ENT`) |
| Who sees which screen | the role's `nav` in `portal/model/store.js` (`ROLES`), and `allowed()` in `routes.jsx` |
| The sidebar, top bar, search, notifications | `portal/shell/Portal.jsx` |
| Sign-in and sign-up | `portal/shell/Auth.jsx` |
| Tables, panels, drawers, modals, toasts | `portal/ui/ui.jsx` |
| Text in both languages | the screen itself: every string is written `t('English', 'عربي')` |
| A page of the public site | `public/pages/`; which page an address opens is decided in `public/App.jsx` |
| Colours, spacing, type | `styles/parishlife.css` (tokens), `styles/app.css` (the portal), `styles/site.css` and `styles/home.css` (the public site) |

## How a portal screen works

1. **The route.** `routes.jsx` maps a route id (`#/people`, `#/person/p1`) to a screen. `Portal.jsx`
   reads the address, checks `allowed(id)` and draws the screen inside `#view`.
2. **Reading.** A screen reads the parish records from `model/data.js` and the signed-in role from
   `model/store.js`, and returns JSX. Most screens are plain functions, `people(tab)`, called with the
   route's parameters; a few are components (`AccountPage`, `InboxPage`, …), listed in `COMPONENTS` in
   `routes.jsx`.
3. **Wiring.** A screen function may have a `.mount(host, …params)` that runs once the screen is on the
   page, to attach what plain JSX could not (search boxes that filter rows, drag and drop on the rota).
4. **Acting.** Buttons carry `data-act="verb:arguments"`. One click handler in `Portal.jsx` finds the
   verb in `actions.jsx` and runs it, wherever the button is (a screen, a drawer, a menu).
   `data-go="route"` navigates the same way.
5. **Changing.** An action changes the records in `model/data.js` and calls `bus.refresh()`. That
   redraws every screen that reads records (`useVersion()` in `version.js`) and saves the changed
   collections to the server (`model/persist.js`), which refuses a save made on stale data.
6. **Dialogs.** `openDrawer({ title, body, foot })` and `openModal(…)` from `ui/ui.jsx` show a drawer or
   a modal with JSX content; `closeOverlays()` closes them. On a phone a drawer becomes a bottom sheet.

### Adding a screen

1. Write it in the feature folder it belongs to: `export function myScreen(param) { return <>…</>; }`.
   Start with `<PageHead crumbs title sub actions />` from `ui/ui.jsx` like the other screens.
2. Add it to `ROUTES` in `routes.jsx` with its icon and English and Arabic names.
3. Add the route to the `nav` of each role that should see it in `model/store.js`.

### Adding a button that does something

1. Give the button `data-act="my-verb:argument"`.
2. Add `'my-verb': (button, argument) => …` to `VERBS` in `actions.jsx`; if it opens a dialog, write the
   dialog in the feature's `*-dialogs.jsx` file and call it from there.

## Bridges from the earlier app

Many portal screens began as HTML strings and were converted to JSX, so a few bridges remain in
`portal/ui/html.js`: `paint(el, jsx)` draws JSX into an element a `.mount` function found, `markup(jsx)`
turns JSX into an HTML string for printing and downloads, and `css`/`htmlAttrs` read inline styles and
attributes written as text. New code should prefer React state and event handlers (`onClick`,
`useState`), as the component screens (`account.jsx`, `inbox.jsx`, `insights.jsx`) do.

## Conventions

- **Formatting**: Prettier (`.prettierrc.json`). Run `npm run format` before committing;
  `npm run format:check` reports any file that differs. Stylesheets keep their one-rule-per-line style.
- **Names**: a file that exports one main component is named after it in PascalCase (`Portal.jsx`,
  `ParishPage.jsx`); other modules are kebab-case (`record-editor.jsx`, `people-dialogs.jsx`).
- **Imports**: relative paths with the file extension, named exports only.
- **Languages**: every visible string is given in English and Arabic, `t(en, ar)` (or `L(en, ar)` in
  the feature files, the same function). Layout uses logical properties (`inset-inline`,
  `margin-inline-start`) so Arabic mirrors without separate styles.
- **Screen sizes**: the portal is laid out for phones (≤640px: bottom navigation, drawers as bottom
  sheets, calendar with a day list), tablets (icon rail) and desktops; the public site from 360px up.
  Wide tables scroll inside their card, and columns marked `hide-sm`/`hide-md` drop out on small screens.
- **Styles**: each page's stylesheet order lives in `styles/pages/<page>.css`; add a new stylesheet
  there, in the position the cascade needs, rather than importing it from a component.

## Building and running

```
cd frontend
npm install          # once
npm run build        # writes ../index.html, ../public.html, ../landing.html and ../assets/app/
npm run dev          # with `python server.py 4399` running: live reload on http://localhost:5173
npm run format       # format the code
```

Commit the rebuilt files with the source: the server serves what is in the repository.
