# Handoffs from Agent 05 (UI, design and accessibility)

Each entry gives To, File, Requested change, Reason and Priority. No secret value appears here.

## 1. Merge `fullstack-hardening` into `hardening/05-ui` (or merge this branch on top of it)
- **To:** integrator
- **File:** branch `hardening/05-ui`
- **Requested change:** the coordinator authorised `git merge --no-ff fullstack-hardening` (d261412) before my final checks, but the permission system on this machine refused the merge, so I did not work around it. My final e2e run therefore covers this branch alone. Two consequences to check after you merge:
  - `frontend/e2e/legal-seo.spec.mjs` ("robots, sitemap, …") fails on this branch alone, because I deleted the static `public/sitemap.xml` (03 sweep S2) and the server sitemap is only on your branch. The assertion now accepts the sitemap's own origin (the server writes `https://<host>/…`), so it should pass after the merge.
  - No textual conflict is expected: Agent 03's sweep changed no frontend file, and I changed no backend file.
- **Reason:** one combined verification run.
- **Priority:** High

## 2. Service worker registration from the members portal
- **To:** 08 (CI) and the owner
- **File:** `frontend/src/portal/main.jsx`, `frontend/public/sw.js`
- **Requested change:** the new offline page for `/` and `/index.html` is served by the service worker, which only the public site registers today. Registering it from the portal too is one line (as in `src/public/main.jsx`), but on this machine every e2e role test would then fail, because Chromium refuses the service-worker script over the untrusted local certificate and logs a console error (the same cause as the known "public pages load signed out" failure). Once CI runs the e2e host with a trusted certificate, add the registration to `portal/main.jsx` and keep the e2e suite green.
- **Reason:** Part C 6 (a reload while offline shows a friendly page) for people who never opened the public site.
- **Priority:** Medium

## 3. Keep the share image on server-written parish pages
- **To:** 03
- **File:** `ParishLife.Api/Middleware/PublicPages.cs` (parish page head rewrite)
- **Requested change:** `public.html` now carries absolute `og:image` / `twitter:image` (`https://parish-life.org/assets/images/og-home.jpg`, 1200×630, with `og:image:width`, `og:image:height`, `og:image:alt`). When the server rewrites the head for a parish, keep these tags (or replace them with the parish's published photo as an absolute URL), and keep `<title>` and `</head>` as the anchors.
- **Reason:** Part B 8; social previews need an absolute image URL.
- **Priority:** Low

## 4. New and changed end-to-end tests
- **To:** 09
- **Files:** `frontend/e2e/ui-states.spec.mjs` (new), `frontend/e2e/legal-seo.spec.mjs` (sitemap assertion)
- **Requested change:** review and keep in the suite.
  - "a double click on Delete removes one meeting, not two": the ministry leader creates two meetings through the API, opens the first, presses Delete, and presses again just after the server answered while the dialog fades. It fails on the code before this branch (the second meeting was cancelled) and passes now.
  - "the portal says when the device is offline…": the offline banner appears and goes.
  - legal-seo: the sitemap's addresses may be on the host that served it (the server's sitemap), and every one must answer 200.
  - Consider adding an axe pass to CI. I ran axe-core 4.14.1 from the npm cache with a scratchpad Playwright script, not added to the project; making it permanent needs `axe-core` (or `@axe-core/playwright`) as a dev dependency, which is the owner's call.
- **Reason:** proof for Part C 1 and C 6 and the S2 change.
- **Priority:** Medium

## 5. Re-measure the page-load numbers after the merge
- **To:** 04
- **Files:** `frontend/index.html`, `frontend/public.html` (preload of `sanctuary/wall.webp`), `src/public/components/Sanctuary.jsx` (`window-540.webp`), the route-split portal
- **Requested change:** with compression (03) and these changes together, re-run Lighthouse mobile on `/`, `public.html` and a parish page. I measured the portal entry (1,674.55 KB to 616.04 KB minified) but not LCP on the merged state.
- **Reason:** handoffs 04-2 and 04-9 are applied; their combined effect is yours to report.
- **Priority:** Low

## 6. Arabic and English copy written by this agent
- **To:** 06
- **Files:** `src/portal/model/api.js` (error messages), `src/portal/shell/Portal.jsx` (offline banner, "Part of this page could not load", "Opening ParishLife…"), `src/portal/ui/ui.jsx` (page that could not open), `public/sw.js` (offline page), `src/portal/features/member/pages.jsx` (attendance status names), `public.html` / `landing.html` (`og:image:alt`)
- **Requested change:** review the wording, and have a native speaker check the Arabic, which I wrote. Your exact sentences for the forgot panel, the closure drawer, the cookie footer link and the request-form note were used as given.
- **Reason:** Part C 5 (every supported language); no invented claims, but the Arabic is unreviewed.
- **Priority:** Medium
