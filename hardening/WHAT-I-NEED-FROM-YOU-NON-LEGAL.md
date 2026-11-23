# What I need from you: everything except legal

Written 23 November 2026, after the hardening run (branch `fullstack-hardening`). This file holds only the technical, operations, product and content items. The legal items stay in [WHAT-I-NEED-FROM-YOU.md](WHAT-I-NEED-FROM-YOU.md):
- operator identity;
- the lawyer review;
- the legal placeholders and liability wording;
- vendor data processing terms;
- the product page prices and their subscription and refund terms;
- image licences and the AI-use statement;
- the Bible verse's copyright notice;
- parishes outside Lebanon (GDPR).

## Status on 24 November 2026 (after you accepted my recommendations)

**Done, tested and committed on `fullstack-hardening`:**

| Item | What changed | Commit |
|---|---|---|
| T1 daily code-email cap | At most 10 codes per account and kind of code in 24 hours; past that, the usual neutral answer and nothing is sent | `efbfa37` |
| T2 photo location data | Uploads lose every metadata block: GPS, device, time, XMP, IPTC, comments, and extra pictures appended after the image. A photo taken turned keeps only its orientation, so it stays upright. Done **without SkiaSharp**: removing metadata needs no image decoder, and SkiaSharp's native libraries would have added about 100 MB to every build and to the deploy package, on a machine with under 2 GB free. Image data is copied unchanged, so there's no quality loss. Checked on real files with Apple's ImageIO. | `c15971b` |
| T3 demo names and data | "Saint Elias, Hadath", "Fr. Antoine Khoury" and the Khoury address are replaced with "Demo Parish", "Demo Town", "Fr. John Doe" and "Demo Building" (Arabic too). Demo data no screen reads is deleted (`data.js`: 2,606 lines to 269). The portal bundle is 48 KB smaller. | `5b0f750`, `2007eee` |
| T5 prerendering | Proposal written: [PRERENDER-PROPOSAL.md](PRERENDER-PROPOSAL.md). Nothing built yet. | `fd651fd` |
| T6 accessibility checks in CI | `e2e/accessibility.spec.mjs`: 130 axe scans (public pages EN/AR, every member and priest screen, dark mode, Arabic), 0 violations. CI's e2e job runs it. | `78d7471`, `02fde30` |
| T7 breached passwords | New passwords are checked with Have I Been Pwned (5-character hash prefix only). On in production by default; if the service is down, the password is accepted. The privacy page names it in both languages (effective 24 November 2026). | `000a5ed` |
| T8–T11, T13 | No change, as recommended | — |
| T15 unused images | Both JPEGs deleted (1.6 MB) | `bcf3d3b` |
| T16 one tab icon | Every page uses the app's own icon | `661e27c` |
| T17 dark mode | An account with no saved appearance follows the device, live | `b3756bf` |
| Saving twice after a time-out (audit N2) | Pressing Save again after no answer reuses the same operation id, so the server never records it twice | `43c08a2` |
| Smoke test step in the deploy runbook | Added | `f802bdf` |

**Still waiting on you:**
- **T4:** whose is the WhatsApp number +961 3 421 887? My recommendation was conditional on the answer.
- **T5:** reply "go" to start the prerendering.
- **T12 staging (approved):** it needs Azure. Either grant P1–P3 below, or create it yourself from the runbook.
- **T14 upgrades (approved):** blocked by disk space. This Mac has under 2 GB free, and a .NET 11 SDK plus builds needs about 3 GB more. Please free at least 5 GB; the largest caches here are `~/Library/Caches/Google` (3.1 GB) and `~/Library/Caches/JetBrains` (1.3 GB). Then I'll do the upgrades one at a time.
- **F1–F3 and P1–P6** below.
- **New questions from this round:**
  1. **"Same as device" appearance:** today, an account that once saved light or dark keeps it, and "Reset appearance" stores light. A real "Same as device" option needs a new `system` value in the backend appearance setting. Do you want it?
  2. **The remaining demo first names on the product page** (Rita Nassar, Nabil Saade, Maya Haddad, and the donors in the counting demo): make them obviously fictional too?
  3. **Leftover demo text in fallback screens** (for example "Youth retreat — Annaya"). It shows only when a module fails to load. Replace it?
  4. **A native Arabic check** of the new demo names and the new time-out message (listed in `hardening/reports/11-owner-frontend.md`, section B).

The numbers here (T, F, P) are this file's own. To answer, reply for example "T1 yes, T2 yes, T3 as recommended, F1 …". The detail behind each item is in [FINAL-REPORT.md](FINAL-REPORT.md), section D.

---

## 1. Decisions (answer, and I build it)

### Needed before the pilot

| # | Decision | My recommendation |
|---|---|---|
| T1 | **Daily cap on login and reset code emails per address.** Today anyone can make the app send one person 1,440 emails a day. | **10 per address per day** |
| T2 | **Strip location data from uploaded photos.** Published parish photos still carry their GPS position. Doing it properly needs one new package. | **Approve SkiaSharp** (MIT licence). It removes the metadata and keeps phone photos upright. |
| T3 | **The demo parish, priest and town in the code and on the product page** ("Saint Elias, Hadath", "Fr. Antoine Khoury"). The phone number is already removed. | **Replace them with obviously made-up ones**, and delete the demo data no screen uses |
| T4 | **The product page's WhatsApp number +961 3 421 887**: whose is it, and may it stay? | Keep it only if it's yours or Colin's |

### Can follow the pilot

| # | Decision | My recommendation |
|---|---|---|
| T5 | **Show page text without JavaScript** (prerendering) for search engines and link previews | Yes, after launch; I propose the approach first |
| T6 | **Accessibility checks in CI** (adds the dev package `@axe-core/playwright`) | **Yes** |
| T7 | **Check new passwords against known breaches** (Have I Been Pwned range check) | **Yes** |
| T8 | **Block throwaway email addresses at sign-up** | **No** |
| T9 | **Limit admin pages to fixed IP addresses** | **No** |
| T10 | **Error tracking in the browser, plus real-user speed data** | **No; backend only for the pilot** |
| T11 | **Put Cloudflare's proxy or firewall in front of the site** | **No; DNS only for the pilot** |
| T12 | **A staging copy of the site** (costs an extra App Service plus database) | **Yes, cheapest form** |
| T13 | **Signed-in pages re-read the same data several times per request** | **Defer** until more parishes join |
| T14 | **Upgrades:** .NET 11, Aspire 17, Vite 8, React 19.3, Prettier, Playwright, pinning Node 26 | Yes, one at a time |
| T15 | **Delete the two unused images** `church-light.jpg` and `church-interior.jpg` (1.6 MB) | Yes |
| T16 | **One tab icon for every page**, or keep the three | One |
| T17 | **New accounts follow the device's dark-mode setting** | Yes |

---

## 2. Facts only you know

| # | What I need | What I do with it |
|---|---|---|
| F1 | **The contact address for the product page.** `hello@parishlife.app` has no mail server. Which `parish-life.org` address should replace it? | Replace it on the product page |
| F2 | **Your real pilot peak:** visitors and staff at the busiest moment (the load test assumes 40 and 10) | Rerun the load test with your numbers |
| F3 | **Are the Maronite feast dates right** in `frontend/src/lib/liturgy.js`? | Fix any wrong date |

---

## 3. Permissions you can give me (optional)

| # | Permission | What I would do |
|---|---|---|
| P1 | **Read-only look at Azure**, through an `az login` you start here; I never see your password | Confirm the settings the report could only claim: forwarded headers, .NET runtime version, Key Vault references, log retention and IP masking, backup mode and soft delete, role assignments. No changes. |
| P2 | **Deploy the monitoring file** `infra/monitoring.bicep` | Install the Bicep tool, compile, show you the `what-if` result, then deploy on your yes. Small cost; you choose the alert email and budget. |
| P3 | **Deploy the hardened build** | Build the package, deploy, run the smoke test and header checks. Only after you've put in the secret settings. |
| P4 | **GitHub repository settings**, through the `gh` tool you sign in to yourself | Create the `production` environment, the ruleset on `main` and secret scanning. You add the reviewers and the secret values. |
| P5 | **Open a pull request** from `fullstack-hardening` into `fullstack-integration` | Open it and fix whatever the first pipeline run shows. Nothing merges without you. |
| P6 | **Read access to Colin's repository** | Scan its full history for leaked secrets |

---

## 4. Things only you can do

**Accounts and security**
- Put the secret values into App Service: Turnstile, Resend, sign-in providers. Make each group complete or empty, or the new build refuses to start.
- Close any `az login` on a machine where an AI tool runs. Use a separate admin account with MFA.
- Remove standing data and Key Vault roles from people (Colin's included).
- Turn off Cosmos key sign-in (`disableLocalAuth`), storage-key access and basic-auth publishing. Turn on audit logs.
- Turn on MFA on Cloudflare, Google, GitHub and Resend. Delete any leftover client secret on the Entra app.
- Set `PRODUCTION_DEPLOY_ENABLED=true` in GitHub, only after the reviewers are in place.

**Backups**
- Run one point-in-time restore into a throwaway database, compare counts, record the time, then delete it.
- Decide where operator snapshots live and how long they're kept. Recommended: monthly, on an encrypted disk, kept 3 months.

**Money**
- Set the Azure budget (about 1.5× last month's cost) and the 0.15 GB/day log cap.
- Keep Resend and Cloudflare on their free plans, and Google Cloud with no billing account.
- Keep domain auto-renew on.

**Email and DNS**
- Confirm the Cloudflare routing rule for `privacy@parish-life.org` and send it a test message.
- Confirm the Resend domain shows Verified. After 2–4 clean weeks, tighten DMARC to `quarantine`, then `reject`.
- Receive the test alert email once monitoring is deployed.

**Real devices and copy**
- Test on Safari, an iPhone and a real Android phone, in light and dark mode and in English and Arabic. Safari's test engine crashes on this Mac.
- In real Firefox, open `public.html`, sign in, then reload the portal. Tell me whether it hangs.
- Have a native Arabic speaker check the app's Arabic: error messages, the offline page and banners, and the sign-in messages.
- Look over the new design details: darker field edges and see-through dividers.

**Search**
- Add the site to Google Search Console and Bing Webmaster Tools, submit `https://parish-life.org/sitemap.xml`, and run Google's Rich Results Test on the home and directory pages.

**Housekeeping**
- Retire the old Cloudflare Worker and its D1 database.
- Keep only `parish-life.org` in the Turnstile widget's allowed hostnames.
- In each clone, run `git config core.hooksPath .githooks` (secret scan before every commit).

---

## 5. What still has to be done after your answers

"Me" means I do it here and verify it before committing. "You" means it needs your account, money or sign-off. Every code change also has to pass the full checks before it counts as done:
- the backend suite;
- the frontend checks;
- end-to-end;
- the secret scan.

### 5.1 Before the pilot

| Item | Waits on | Still to do | Who | Done when |
|---|---|---|---|---|
| Daily code-email cap | T1 | 1. Count sends per address and purpose per day in the existing verification record (`ContactVerificationService`: `RequestAsync`, `RequestPasswordResetAsync`, `BeginEmailChangeAsync`). 2. Past the cap, give the same neutral answer as today. 3. Turn the known-failure test `Code_emails_to_one_address_stop_at_a_daily_cap` into a normal test. | Me | That test passes in the normal suite |
| Photo location data | T2 | 1. Add SkiaSharp and its Linux native package. 2. Re-encode JPEG, PNG and WebP uploads in `ParishProfileService.UploadPhotoAsync`: rotate as the phone intended, then drop all metadata. 3. Decide with you whether private evidence files are re-encoded too (they may need to stay byte-for-byte). 4. Check that the publish package contains the native library. 5. Turn `A_published_photo_is_served_without_its_location_metadata` into a normal test. 6. Upload one real phone photo after the deploy. | Me (1–5), you (6) | The test passes, and a real phone photo shows upright with no GPS data |
| Demo parish, priest and town | T3 | 1. Replace the names in `Landing.jsx`, `CountingDemo.jsx`, the style guide and `portal/model/data.js`. 2. Find the demo data no screen reads, and delete it. 3. Look at the product page in English and Arabic. | Me | No real parish, priest or person name in the built files, and every screen still opens |
| WhatsApp number | T4 | Remove it or keep it in `Landing.jsx` (two places) | Me | Only an approved number shows |
| Contact address | F1 | 1. Replace `hello@parishlife.app` on the product page. 2. Set up the routing in Cloudflare. 3. Send a test message. | Me (1), you (2–3) | A message to the new address reaches you |
| Feast dates | F3 | Fix any wrong date in `frontend/src/lib/liturgy.js` and check the calendar screens | Me | The dates match what you confirmed |

### 5.2 Getting the hardened build live

| Item | Waits on | Still to do | Who | Done when |
|---|---|---|---|---|
| App Service settings | You | 1. Make each settings group complete or empty. 2. Check every Key Vault reference shows Resolved. 3. Confirm the .NET runtime is 10.0.15 or later. | You, or me read-only with P1 | Every group is complete or empty, and every reference is Resolved |
| Deploy | The row above, plus P3 or your own deploy | 1. Build the package. 2. Deploy. 3. Run the smoke test against `https://parish-life.org`. 4. Check the headers: one-year HSTS and no `Server` header. 5. Watch the logs for an hour. | Me with P3, or you | The smoke test passes against production |
| Offline page for the portal | Your Firefox check | Add one line to `frontend/src/portal/main.jsx` to register the offline worker, then rerun e2e | Me | Opening the portal offline shows the offline page |
| Pipeline | P4 or your own clicks, then P5 | 1. Deploy identity. 2. `production` environment with you and Colin as reviewers. 3. Ruleset on `main`. 4. Secret scanning. 5. Open the PR so the pipeline runs. 6. Fix anything that fails on GitHub's Linux machines, most likely the end-to-end job's certificate step. 7. Make the end-to-end job a required check. 8. Set `PRODUCTION_DEPLOY_ENABLED=true` last. | You (2, 8), me (the rest) | One run on `main` is green, and a production deploy waits for a reviewer |
| Backups | You | 1. Confirm continuous backup and soft delete. 2. Run one point-in-time restore, compare counts, time it, then delete it. 3. Decide the snapshot policy. 4. I record the results in `docs/operations/data-snapshot-and-recovery.md`. | You (1–3), me (4) | A restore has been done once and timed |
| Monitoring and caps | P2, or your own deploy | 1. Install the Bicep tool (needs your yes). 2. Compile the file. 3. Run `what-if`. 4. Deploy. 5. You receive the test alert. 6. You set the budget and the log cap. | Me (1–4), you (5–6) | The test alert arrived and the budget exists |
| Email | You | 1. Resend domain Verified. 2. One live code sent. 3. Turn on the three `Email__*` settings. 4. After 2–4 clean weeks, tighten DMARC. | You | Password reset appears in the portal and a real code arrives |
| Production access | You | Section 4, "Accounts and security" | You | No standing data roles for people |

### 5.3 After the pilot starts

| Item | Waits on | Still to do | Who | Done when |
|---|---|---|---|---|
| Prerendering | T5 | 1. I propose rendering the public and product page bodies at build time. 2. You approve. 3. I build it, check that the page still comes to life correctly in the browser, and turn the "without JavaScript" e2e test into a normal test. | Me, you (2) | The page text is in the HTML with JavaScript off |
| Accessibility checks in CI | T6 | 1. Add `@axe-core/playwright`. 2. Turn the scratch scan into an e2e test over the main pages in both languages. 3. Add it to CI. | Me | CI fails on any new accessibility violation |
| Breached-password check | T7 | 1. Check passwords at sign-up, change and reset against the range API: it gets only the first 5 characters of the password's hash, has a short time-out, and lets the password through if the service is down. 2. Tests with a stand-in for the API. 3. One line on the privacy page (that part goes through the legal list). | Me | A known-breached password is refused, and sign-up works with the service down |
| Cloudflare proxy | T11 (only if yes) | 1. Change how the app reads the visitor's IP address, in the same deploy. 2. You restrict App Service to Cloudflare's addresses. | Me (1), you (2) | Rate limits still count each visitor separately |
| Staging | T12 | 1. You approve the cost. 2. Create it following `docs/operations/deployment-and-rollback.md` (staging steps 1–8). 3. Turn on `STAGING_ENABLED`. 4. Rehearse one rollback and record the time. | You (1), you or me with permission (2–4) | A rollback has been done once on staging |
| Pilot peak | F2 | Rerun the load test with your numbers; update the thresholds and the report | Me | The load test passes at your real peak |
| Search Console | You | Add the site, submit the sitemap, run the Rich Results Test, and send me any errors | You, then me | No errors in Search Console |
| Upgrades | T14 | One at a time: update the package, fix what breaks, run the full checks | Me | Each one is green on its own |
| Small UI choices | T15, T16, T17 | Delete the two images; unify the tab icon; change the dark-mode default | Me | Done and checked in both languages |
| Signed-in read cost | T13 | Nothing until more parishes join; then cache the repeated reads and remove the per-row reads in 7 lists | Me, later | About one read per record per page |
| Housekeeping | You | Retire the old Worker and D1 database, tidy the Turnstile hostnames, turn on the commit hooks | You | — |

---

## 6. Work I can do now, without anything from you

| Item | Still to do | Done when |
|---|---|---|
| A timed-out save repeated (audit N2) | A failed save keeps its operation id, so pressing Save again can never create a second record. This touches the save path of every portal module. | A test that holds a save past 30 seconds, then presses Save again, finds one record |
| Smoke test in the deploy runbook | Add the post-deploy smoke-test command as a step in `docs/operations/deployment-and-rollback.md` | The runbook has the step |
| Commit both files | Commit and push this file and `WHAT-I-NEED-FROM-YOU.md` to `fullstack-hardening` | They're on GitHub |
