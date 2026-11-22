# Handoffs from Agent 04 (Performance)

Each entry gives To, File, Requested change, Reason and Priority. Ready-to-apply patches are in `hardening/handoffs/patches/` (apply with `git apply <file>` from the repository root, on top of `hardening/04-performance`). Every number below was measured locally (test host `ParishLife.EndToEnd`, local file storage, one machine); local timings are not production timings. No secret value appears here.

## 1. Compress the static pages, scripts and styles (Brotli/gzip)
- **To:** 03
- **File:** `ParishLife.Api/Program.cs` (patch: `patches/04-to-03-static-compression.patch`, 28 lines)
- **Requested change:** register `AddResponseCompression` (Brotli and gzip providers, `EnableForHttps = true`, default MIME types plus `image/svg+xml` and `application/manifest+json`) and add `app.UseWhen(context => !context.Request.Path.StartsWithSegments("/api"), pages => pages.UseResponseCompression());` just before `app.UseParishLifeFrontend()`. `/api` stays uncompressed on purpose (BREACH: an answer that carries a token beside caller-chosen text must not be compressed over HTTPS).
- **Reason:** production sends the portal script uncompressed: a read-only GET on 21–22 November returned `Content-Length: 1666695` and no `Content-Encoding` for `/assets/app/portal-C1oHGJX7.js` although the request offered `br, gzip`. With the patch the test host served the (route-split) portal script as 261,429 bytes (Brotli) or 279,154 (gzip) instead of 613,849, and `/api/auth/csrf` stayed uncompressed. Lighthouse mobile "text compression" estimated 7.2 s of savings on the sign-in page. Verified: `curl` with and without `Accept-Encoding`; end-to-end run with the patch applied (see report E).
- **Upgrade later:** precompress at build time (a Vite step writing `.br`/`.gz`) to save the per-request CPU, or put a CDN in front (report D).
- **Priority:** High

## 2. Load the portal's screens on first use (route-level code splitting)
- **To:** 05
- **File:** `frontend/src/portal/shell/routes.jsx` (patch: `patches/04-to-05-portal-route-splitting.patch`)
- **Requested change:** replace the 50 static feature imports with `React.lazy` loaders. Each route's view becomes `page(() => import(...), m => m.screen)` (render functions, still wrapped by `screen()`) or `part(...)` (component screens), inside a `Suspense` boundary that shows "Loading…" in the page well while a screen's file downloads the first time. Nothing else changes: the route table, badges, permissions and `Portal.jsx` are as before. Please restyle the fallback if you want.
- **Reason:** the portal entry downloaded every screen before the sign-in form could appear. Measured: main portal script 1,674.55 KB → 613.85 KB minified (486.39 → 195.70 KB gzip), 68 chunks. Lighthouse sign-in page, patch alone: mobile LCP 14.89 s → 9.59 s, desktop 2.76 s → 1.88 s (score 70 → 84); with compression too: mobile 6.41 s (score 55 → 65), desktop 1.28 s (score 95). The end-to-end run (every role opens every screen in English and Arabic) passed with the patch applied: see report E.
- **Further split (optional):** `shell/actions.jsx` still imports twelve dialog modules statically (about 250 KB of source), and `features/records/notes.jsx` stays in the main file because `actions.jsx` imports it. Turning those into `import()` calls inside the actions would shrink the main file further.
- **Priority:** High

## 3. Public directory: stop reading each parish's location and profile one by one
- **To:** 03
- **File:** `ParishLife.Api/Services/Publishing/PublicDirectoryService.cs` (patch: `patches/04-to-03-public-directory-batched-reads.patch`)
- **Requested change:** use the new `IParishDirectory.ByParishAsync<ParishLocation>("parishLocation")` and `ByParishAsync<ParishProfile>("parishProfile")` (added by 04, keyed by the partition that holds each document) instead of `records.ReadAsync` and `profiles.PublishedAsync` per parish. The patch keeps the verified-only filter, the `location.ParishId == parish.Id` check and the diocese lookups, and drops two constructor parameters that become unused.
- **Reason:** item 1 (N+1). Measured with `RequestCostTests`: 3 reads + 1 query for 1 parish and 23 reads + 1 query for 11 parishes (2 reads per parish) before; 1 read + 3 queries for both after. `PublicDirectoryTests` pass with the patch. With 04's public read cache this cost is paid once per change rather than once per visitor, but the first visitor after each change still pays it.
- **Priority:** Medium

## 4. Repeated reads on every signed-in request
- **To:** 03
- **Files:** `ParishLife.Api/Identity/AccountSessionService.cs`, `Identity/CosmosIdentityStore.cs`, `Authorization/CurrentActor.cs`, `Authorization/ParishAccess.cs`, `Authorization/StaffAppointmentAccess.cs`
- **Requested change:** read each document once per request. Measured repeats (`RequestCostTests`, "repeated" lines): the caller's account document is read 2× on `GET /api/auth/me`, 3× on staff parish reads and 4× on `/api/me/capacities` and `/api/me/home`; the parish root is read 3–4× on staff parish reads. Suggested shape: the cookie check (`OnValidatePrincipal` → `AccountSessionService.ValidAsync`) already loads the account; keep that `ParishUser` in `HttpContext.Items` for `CurrentActor`/`AccountAccess` to reuse, and let `ParishAccess.RequireAsync` hand the `Versioned<Parish>` it read to `RequireModuleAsync` and to the service instead of each reading it again. Keep every check as it is; only the duplicate reads go.
- **Reason:** item 8's first bottleneck for signed-in traffic. A staff list read costs 10 point reads and 3 queries, of which about 5 are repeats; at ten times the pilot peak the staff p95 was 1.79 s locally (all requests share one account and one parish partition). In Cosmos each repeat is a sequential point read (RU and a round trip).
- **Priority:** Medium

## 5. Per-item reads in list endpoints (N+1, found by code inspection)
- **To:** 03
- **Files and pattern:** a point read or helper call per row of a list. Fix by reading the needed documents of the partition once (one bounded query, a dictionary by id) before the loop:
  - `Services/People/HouseholdService.cs` lines ~177, ~275, ~346 (member names per household and per relationship)
  - `Services/Scheduling/ServicePlanService.cs` lines ~152–173 (event per plan, music version per entry)
  - `Services/Communications/InboxService.cs` lines ~116 and ~127 (conversation per id, projection per conversation)
  - `Services/Communications/MessageReviewService.cs` line ~90 (conversation per report)
  - `Services/PersonalWorkspace/CombinedHomeService.cs` lines ~45, ~114, ~124, ~165–180 (`/api/me/home`: 11 reads + 8 queries for one parish, measured)
  - `Services/PersonalWorkspace/MemberMinistryResourceService.cs` line ~31 (membership check and ministry per row)
  - `Services/People/MembershipService.cs` line ~78 (`/api/me/parishes`: parish root and link per followed parish)
- **Reason:** item 1. Each adds one sequential Cosmos round trip per row. Small at pilot size (one parish), linear in rows.
- **Priority:** Low (pilot), Medium before more parishes join

## 6. Cache headers for public parish photos and the calendar feed; cache the busiest public reads
- **To:** 03
- **Files:** `ParishLife.Api/Controllers/Publishing/PublicParishProfileController.cs` (`photos/{photoId}`), `Controllers/Publishing/PublicCalendarFeedController.cs`, `Controllers/Scheduling/PublicCalendarController.cs`, `Controllers/Ministries/PublicMinistriesController.cs`, `Controllers/Communications/CommunicationsController.cs` (public announcements)
- **Requested change:**
  - Published parish photos are served through the API under `/api`, so `Program.cs` marks them `Cache-Control: no-store`: every view downloads every photo again through the app from Blob. A photo id names one immutable upload, so send `public, max-age=86400` for published photos (set it in the action after the published check; the `/api` middleware runs first).
  - The `.ics` feed is polled by calendar apps: `public, max-age=900` (it is already public by design).
  - Add `[PublicCache]` to the anonymous public calendar, ministries and announcements reads. The public calendar is the most requested public read (one per parish on the homepage, five on a parish page), and with the attribute it uses 04's server cache, cleared by any TenantControl write. These actions read no identity; please confirm that in review.
- **Reason:** items 3, 7 and 9 (egress and repeat reads).
- **Priority:** Medium

## 7. Optional Cosmos client setting
- **To:** 03
- **File:** `ParishLife.Api/Extensions/ServiceCollectionExtensions.cs` (`RegisterStorage`)
- **Requested change:** none required. The client is already one shared singleton (Direct mode by default, Strong, 5 retries on 429). Optional: `EnableContentResponseOnWrite = false`, because batch commits use only the returned ETags; it trims response size, not RU.
- **Reason:** item 8 review.
- **Priority:** Low

## 8. Delete buttons can delete a second record on a double click
- **To:** 05
- **Files:** `frontend/src/portal/features/parish-life/groups-dialogs.jsx` ~line 465 (`gd().meetings.splice(gd().meetings.indexOf(meeting), 1)`), `features/parish-life/group-resources.jsx` ~line 151 (`d.belongings.splice(d.belongings.indexOf(r), 1)`), `features/parish-life/groups.jsx` ~line 1329 (`d.tasks.splice(i, 1)`), `features/communicate/messaging.jsx` ~line 786 (`items.splice(Number(index), 1)`)
- **Requested change:** disable the dialog's Delete button (and show it as saving) from the first click until `persist()` answers, and guard the index: `indexOf` returns -1 on the second click and `splice(-1, 1)` removes the **last** item; the fixed-index ones remove the next item. `notes.jsx` (findIndex by id) and `people.jsx` (checks the index) are already safe.
- **Reason:** item 5. Deletions and sends must show a loading state, never an optimistic change; these already wait for the server before closing, but a second click during the wait changes the view model again and the coalesced save sends that second deletion too. Data loss risk.
- **Priority:** High

## 9. Above-the-fold image and render-blocking fonts in the page heads
- **To:** 06 (owns the heads: fonts loading); 05 for the image files
- **Files:** `frontend/index.html`, `frontend/public.html`, `frontend/landing.html`; `frontend/public/assets/images/sanctuary/`
- **Requested change:**
  - The largest paint on `/` and `public.html` is the `.sn-wall` background (`/assets/images/sanctuary/wall.webp`, 73 KB), found only after the CSS and script run (Lighthouse "load delay" 3.6 s mobile on `/`). Add `<link rel="preload" as="image" href="/assets/images/sanctuary/wall.webp" fetchpriority="high">` to the heads of `index.html` and `public.html`.
  - `index.html` and `landing.html` load Google Fonts with a render-blocking stylesheet (Lighthouse: about 0.9 s each on mobile). Self-host the three families as `public.html` already does for its fonts (also removes a third-party request, which matters for the privacy pages), or at least load the stylesheet without blocking (`media="print" onload="this.media='all'"` is blocked by the CSP's inline-handler rule, so self-hosting is the clean option).
  - 05: the sign-in screen downloads `window-1080.webp` (153 KB) on phones; add a ~540 px variant and `srcset`/`sizes` (Lighthouse "responsive images": 95 KB).
  - 05: `DEFAULT_PHOTOS` (`src/public/site.jsx` line 58, the fallback when a parish photo fails) points at the JPEGs (`church-light.jpg` 697 KB, `church-interior.jpg` 909 KB) although WebP copies exist (114 KB and 157 KB). The CSS classes `.fixed-story` and `.profile-hero` (`src/styles/public.css` lines 91, 150, 188, 230) also point at the JPEGs, but no page uses them (dead CSS).
- **Reason:** item 10. With all of 04's changes and handoffs 1–2 applied, mobile LCP is still 6.41 s on `/`, 3.81 s on the homepage, 3.22 s on a parish page and 5.06 s on `landing.html`; these are the next blockers Lighthouse names.
- **Priority:** Medium

## 10. Load test command
- **To:** 09
- **File:** `tools/load/parishlife.k6.js` (new; the run steps are in its header comment)
- **Requested change:** add it to the verification docs and, if wanted, CI (local host only; the script refuses any other host):
  ```
  cd frontend && npm run build && cd ..
  tail -f /dev/null | dotnet run -c Release --project ParishLife.EndToEnd -- --manifest /tmp/pl-load/manifest.json --port 7311   # wait for E2E READY
  k6 run -e E2E_MANIFEST=/tmp/pl-load/manifest.json -e PROFILE=pilot tools/load/parishlife.k6.js
  k6 run -e E2E_MANIFEST=/tmp/pl-load/manifest.json -e PROFILE=tenx  tools/load/parishlife.k6.js
  ```
  Also new: `ParishLife.IntegrationTests/RequestCostTests.cs` and `Support/CountingDocumentDatabase.cs` (document operations per request, and the public cache's contract).
- **Reason:** item 8.
- **Priority:** Medium

## 11. Shared helper for the parish and account record scopes (reply to Agent 02 handoff 5)
- **To:** 03
- **Files:** call sites in `ParishLife.Api/Services/**`; helpers `ParishLife.Api/Interfaces/Repositories/Common/RecordScopes.cs` and `RecordConditions.cs` (new, 04)
- **Requested change:** replace the private copies with `RecordScopes.Parish(id)`, `RecordScopes.Account(id)` and `RecordConditions.Equal(path, value)`. `RecordScope`, `RecordCondition` and `Guard` live in `Models/` (03's), not in `Interfaces/Repositories/` as handoff 02-5 assumed, so I put the factories beside `IRecordTransactions`, which takes them; move them onto the model classes if you prefer. The other three requests in 02-5 are in your files: `Guard.OptionalText` (`Models/Guard.cs`), a shared `NotFound(message)` (`DomainException`), and one token-hash helper for `PersonInvitationService` and `RequestService`.
- **Reason:** Agent 02 handoff 5 (behaviour-neutral refactor; do it after this wave merges).
- **Priority:** Low
