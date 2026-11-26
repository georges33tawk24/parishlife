# Proposal: page text that works without JavaScript (T5, QA bug 4)

Written 24 November 2026. **Built 26 November 2026 (owner said go):** landing.html is rendered at build time (`frontend/scripts/prerender.mjs`, hydrated in `src/landing/main.jsx`; Arabic or reduced-motion visitors get a fresh render), and the server writes the directory list or the parish text into `public.html` (`Middleware/PublicPages.cs`, 60-second cache). The no-JavaScript e2e test is now a normal test.

## The problem

`public.html` (the parish directory and parish pages) and `landing.html` (the product page) arrive with an empty `<div id="root">`; React draws all the text in the browser.
- Crawlers and link previews that don't run JavaScript see only the `<head>`: title, description, canonical link and JSON-LD. Parish pages already get their own head from the server (`Middleware/PublicPages.cs`), but no body text.
- The QA test "public pages show their content without JavaScript" proves it, and stays marked as an expected failure until this is fixed.

## What I propose

**1. Product page (`landing.html`): render it at build time.**
- The page is the same for every visitor, so `npm run build` can run React once on the server side (`react-dom/server`, already part of React; no new package) and write the result into `landing.html` in both languages. That makes two files, `landing.html` and the Arabic one, or one file with the Arabic served by `?lang=ar`; I'd pick whichever keeps the current URLs.
- The browser then attaches to that HTML (`hydrateRoot` instead of `createRoot`) instead of drawing it again.
- Before that works: `Landing.jsx` uses `window`, `document` or `localStorage` in six places and `main.jsx` in one. Any of those that run while the page is drawn must move into effects, so the server-side run doesn't touch the browser. The language choice already falls back to English.

**2. Directory and parish pages (`public.html`): the server writes the text it already has.**
- The server already reads the published profile to write each parish page's head. It can also put the published text into the body: the name, locality, rite, address, Mass, office and confession times, and visitor notes. The values are HTML-encoded exactly like the head, through the same `MatchEvaluator`-safe insertion.
- The directory page (`public.html` with no parish) gets a short static introduction plus the list of published parishes as plain links. These are the same parishes the sitemap lists.
- React replaces this block when it starts, so people with JavaScript see the page exactly as today.
- Why not build-time rendering here: parish pages change whenever a parish publishes, so a static build would go stale. The server already has the data at request time, and the 60-second public cache keeps the cost down.

## What it changes for you

- The page text shows in link previews and to every crawler, not only Google's JavaScript renderer.
- No new package, service or setting. Build time grows by a few seconds.

## Risks, and how I would check each

| Risk | Check |
|---|---|
| The browser's first drawing differs from the server's HTML (a "hydration mismatch"), so the page flickers or React warns | Every page in both languages: no hydration warning in the console (e2e reads it), and a screenshot before and after |
| Parish text inserted into HTML could break the markup | The same encoding as the head, a test with `<`, `&`, `"`, `$&` and Arabic in every field, and an XSS case |
| A slower directory page | Measure with the existing k6 profile before and after; the public cache absorbs repeats |
| Motion and animation code runs before the page is interactive | Animations start only after hydration, as today |

## Steps, once you say go

1. Move the browser-only reads in `Landing.jsx` and `main.jsx` into effects, with no visible change. Run the checks and e2e.
2. Add the build-time render for `landing.html` (a small `scripts/prerender.mjs` called after `vite build`).
3. Extend `PublicPages.ParishPageAsync` to write the parish body block, and add a directory block for `public.html`. Integration tests cover the encoding.
4. Turn the QA test "public pages show their content without JavaScript" into a normal test. Add a no-hydration-warning check.
5. Run the full checks, e2e, axe (once T6 is in) and Lighthouse on the changed pages, and compare with the numbers in `hardening/FINAL-REPORT.md` section G.

Reply "go" and I start with step 1.
