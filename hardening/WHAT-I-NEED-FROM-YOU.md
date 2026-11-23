# What I need from you to finish the hardening

Written 23 November 2026, after the hardening run (branch `fullstack-hardening`, commit `ba43f3c`). The full detail behind every line is in [FINAL-REPORT.md](FINAL-REPORT.md), section D, whose step numbers are given as "D…" below.

**Update, 24 November 2026:** you accepted my recommendations. The non-legal items are done or waiting on you as listed in the status table at the top of [WHAT-I-NEED-FROM-YOU-NON-LEGAL.md](WHAT-I-NEED-FROM-YOU-NON-LEGAL.md). In this file, that covers:
- 1.1–1.3, 1.6–1.18 and section 6;
- 1.2 was done without SkiaSharp (no image library needed).

Two legal-side effects:
- the privacy page now names Have I Been Pwned (breached-password check) and is effective 24 November 2026;
- the recorded terms version is `2026-11-24`.

Every legal item below (1.5 and sections 2–5) still waits on you.

There are four kinds of request:

1. **Decisions.** Answer them and I build the result.
2. **Facts.** Only you know them. I won't invent them.
3. **Permissions.** Grant them and I can do more of the work myself.
4. **Things only you can do.** Accounts, billing, legal sign-off and real devices.

The fastest way through is to answer sections 1 and 2 in one message, for example "1.1 yes, 1.2 yes, 1.3 no, …". Wherever you agree with my recommendation, "as recommended" is enough.

Two more sections follow the requests:
- **Section 5** lists, item by item, the work that is still left once you've answered, who does it, and how we'll know it's done.
- **Section 6** lists the work I can do now, without anything from you.

---

## 1. Decisions (answer, and I build it)

### Needed before the pilot

| # | Decision | My recommendation | What I do once you answer |
|---|---|---|---|
| 1.1 | **Daily cap on login and reset code emails per address** (QA bug 3; today anyone can send one person 1,440 emails a day) (D6) | **10 per address per day** | Add the cap and turn the failing test green |
| 1.2 | **Strip location data from uploaded photos** (QA bug 2; published parish photos still carry their GPS position). Doing it properly needs an image library, so you must approve one new package. (D7) | **Yes, approve SkiaSharp** (MIT licence). It strips the metadata and keeps phones' rotation. | Re-encode uploads and turn the failing test green |
| 1.3 | **The demo parish, priest and town in the code and on the product page** ("Saint Elias, Hadath", "Fr. Antoine Khoury"). I already removed the phone number. (D13) | **Replace them with obviously made-up ones**, and delete the demo data no screen uses | Replace and delete them, then run every check |
| 1.4 | **The product page's WhatsApp number +961 3 421 887**: whose is it, and may it stay? (D11) | Keep it only if it's yours or Colin's | Remove or keep it |
| 1.5 | **The prices on the product page** ($19 and $49 a month, fixed rate 89,500 LBP) (D11) | **Hide them** until the subscription and refund terms are written | Hide them, or keep them if you send the terms |

### Can follow the pilot

| # | Decision | My recommendation | What I do |
|---|---|---|---|
| 1.6 | **Show page text to search engines and link previews without JavaScript** (QA bug 4; prerendering) (D27) | Yes, after launch | Propose the approach first, then build it |
| 1.7 | **Add the accessibility checker to CI** (`@axe-core/playwright`, a new dev package) (D26) | **Yes** | Add it, so the 230/230 accessible screens can't quietly regress |
| 1.8 | **Check new passwords against known breaches** (Have I Been Pwned, privacy-preserving range check) (D19) | **Yes** | Build it, and add one line to the privacy page |
| 1.9 | **Block throwaway email addresses at sign-up** (D20) | **No** | Nothing |
| 1.10 | **Limit admin pages to fixed IP addresses** (D20) | **No** | Nothing |
| 1.11 | **Error tracking in the browser, plus real-user speed data** (D21) | **No; backend only for the pilot** | Nothing now |
| 1.12 | **Put Cloudflare's proxy or firewall in front of the site** (D18) | **No; DNS only for the pilot** | If yes: change how the app reads the visitor's IP address, in the same deploy |
| 1.13 | **A staging copy of the site** (costs an extra App Service plus database) (D17) | **Yes, cheapest form** | Write the exact setup once you approve the cost |
| 1.14 | **Signed-in pages re-read the same data several times per request** (D23) | **Defer** until more parishes join | Nothing now |
| 1.15 | **Upgrades:** .NET 11, Aspire 17, Vite 8, React 19.3, Prettier, Playwright, and pinning Node 26 (D28) | Yes, one at a time, as separate tasks | Each upgrade with its own full test run |
| 1.16 | **Delete the two unused images** `church-light.jpg` and `church-interior.jpg` (1.6 MB, used nowhere) (D13) | Yes | Delete them |
| 1.17 | **One tab icon for every page**, or keep the three today (D30) | One | Unify them |
| 1.18 | **New accounts follow the device's dark-mode setting** (today only a saved choice counts) (D30) | Yes | Change the default |

---

## 2. Facts only you know (send them, and I fill them in)

| # | What I need | Where it goes |
|---|---|---|
| 2.1 | **Who runs ParishLife:** legal name, registered address, registration number and which register (D9) | Privacy and terms pages, English and Arabic; I fill the placeholders |
| 2.2 | **Do you own `parishlife.app`?** `hello@parishlife.app` has no mail server. Which `parish-life.org` address should replace it? (D11) | Product page |
| 2.3 | **The open placeholders in the legal drafts** (D14): | `hardening/legal-drafts/*`, then the live pages |
| | P5, the countries the operator works from | |
| | P6, how long data is kept, and where the operator's backup copies are stored | |
| | P7, how fast you answer privacy requests | |
| | P12 and T11, notice period for changes | |
| | T6, the abuse contact | |
| | T12, settlement period and which court | |
| | T13, which language wins if the English and Arabic differ | |
| | How long each type of record is kept | |
| 2.4 | **Will parishes outside Lebanon use ParishLife** (EU, UK, US, Australia)? (D16) | If yes, the GDPR changes in the privacy draft |
| 2.5 | **Your real pilot peak:** how many visitors and staff at the busiest moment? The load test assumes 40 and 10. (D22) | Rerun the load test with your numbers |
| 2.6 | **Which texts, translations and images were made with AI**, plus the source and licence of each image in `frontend/public/assets/images/` (D13) | Image credits and the AI-use statement |
| 2.7 | **The Bible verse on the home page** (Matthew 5:16): keep that translation and add its copyright notice, or use another? (D13) | Home page |
| 2.8 | **Are the Maronite feast dates right** in `frontend/src/lib/liturgy.js`? (D13) | Fix any wrong date |
| 2.9 | **Liability wording** in the terms (T8, your decision, ideally with the lawyer) (D10) | Terms page |

---

## 3. Permissions you can give me (optional; each lets me do more)

During the run I was told not to touch Azure, deploy, change DNS or change GitHub settings, so these are yours to grant or keep.

| # | Permission | What I would do with it | Notes |
|---|---|---|---|
| 3.1 | **Read-only look at Azure**, through an `az login` you start on this machine; I never see your password | Confirm the facts the report could only claim (D1.2–D1.4, D3.1, D4.3): the forwarded-headers setting, the .NET runtime version, Key Vault references resolved, log retention and IP masking, the backup mode and soft delete, and who holds which roles | Read-only, no changes. Close the session afterwards (D2). |
| 3.2 | **Deploy the monitoring file** `infra/monitoring.bicep` (alerts, uptime checks, budget) (D4) | Run `what-if` first and show you the result, then deploy on your yes | Costs a little (uptime tests and alert rules). You set the alert email and budget amount. |
| 3.3 | **Deploy the hardened build** (D1) | Run `tools/Publish-ParishLife.ps1`, deploy, then run the smoke test and the header checks | Only after you've done D1.1 yourself, since it involves secret values |
| 3.4 | **GitHub repository settings** (D8): sign in to the `gh` command-line tool yourself | Create the `production` environment, the ruleset on `main` and secret scanning | You must add the required reviewers (you and Colin), and you set the secret values |
| 3.5 | **Open a pull request** from `fullstack-hardening` into `fullstack-integration` | Open it with a summary, then follow its CI | Nothing merges without you |
| 3.6 | **Read access to Colin's repository** (D29) | Scan its full history for leaked secrets with gitleaks | Read-only |

---

## 4. Things only you can do

These involve your accounts, money, legal sign-off or physical devices.

**Accounts and security** (D1, D2, D5, D8)
- Put the secret values into App Service: Turnstile, Resend, sign-in providers. Make each group complete or empty, or the new build will refuse to start.
- Close any `az login` on a machine where an AI tool runs. Use a separate admin account with MFA.
- Remove standing data and Key Vault roles from people (Colin's included). Turn off Cosmos key sign-in (`disableLocalAuth`), storage-key access and basic-auth publishing. Turn on audit logs.
- Turn on MFA on Cloudflare, Google, GitHub and Resend. Delete any leftover client secret on the Entra app.
- Set `PRODUCTION_DEPLOY_ENABLED=true` in GitHub, only after the reviewers are in place.

**Backups** (D3)
- Run one point-in-time restore into a throwaway database, compare counts, record the time, then delete it.
- Decide where operator snapshots live and how long they're kept. Recommended: monthly, on an encrypted disk, kept 3 months.

**Money** (D4)
- Set the Azure budget (about 1.5× last month's cost) and the 0.15 GB/day log cap.
- Keep Resend and Cloudflare on their free plans, and Google Cloud with no billing account.
- Keep domain auto-renew on.

**Email and DNS** (D5, D11)
- Confirm the Cloudflare routing rule for `privacy@parish-life.org` and send it a test message.
- Confirm the Resend domain shows Verified. Then, after 2–4 clean weeks, tighten DMARC to `quarantine`, then `reject`.
- Receive the test alert email once the monitoring is deployed.

**Legal** (D10, D12)
- Have a lawyer licensed in Lebanon review the published pages and `hardening/legal-drafts/*`. That review should cover:
  - whether a Law 81/2018 declaration or a health-data licence is needed;
  - minors aged 13 to 17;
  - religious-affiliation data;
  - the right to withdraw from a subscription.
- Accept or download the data processing terms of Microsoft, Cloudflare, Resend and Google, and send me the dates.
- Have a native Arabic speaker check every Arabic sentence the agents and I wrote: the legal pages, error messages, the offline page and banners.

**Real devices** (D25)
- Test on Safari, an iPhone and a real Android phone, in light and dark mode and in English and Arabic. Safari's test engine crashes on this Mac, so this couldn't be tested here.
- In real Firefox, open `public.html`, sign in, then reload the portal. If it doesn't hang, tell me, and I'll turn on the offline page for the portal (one line).
- Look over the new design details: darker field edges and see-through dividers (D30).

**Search** (D24)
- Add the site to Google Search Console and Bing Webmaster Tools, submit `https://parish-life.org/sitemap.xml`, and run Google's Rich Results Test on the home and directory pages.

**Housekeeping** (D29)
- Retire the old Cloudflare Worker and its D1 database.
- Keep only `parish-life.org` in the Turnstile widget's allowed hostnames.
- In each clone, run `git config core.hooksPath .githooks` (this turns on the secret scan before every commit).

---

## 5. What still has to be done after your answers

Each item says what it waits on, the steps left in order, and when it counts as done. "Me" means I do it here and verify it before committing. "You" means it needs your account, money or sign-off. Every code change also has to pass the full checks before it counts as done:
- the backend suite (`dotnet test ParishLife.slnx`);
- the frontend checks;
- end-to-end (`E2E_CHANNEL=chromium npm run e2e`);
- the secret scan.

### 5.1 Before the pilot

| Item | Waits on | Still to do | Who | Done when |
|---|---|---|---|---|
| Daily code-email cap | 1.1 | 1. Count sends per address and purpose per day in the existing verification record (`ContactVerificationService`: `RequestAsync`, `RequestPasswordResetAsync`, `BeginEmailChangeAsync`). 2. Past the cap, give the same neutral answer as today, so no one learns anything. 3. Turn the known-failure test `Code_emails_to_one_address_stop_at_a_daily_cap` into a normal test. | Me | That test passes in the normal suite, and an 11th code to one address in a day is not sent |
| Photo location data | 1.2 | 1. Add SkiaSharp plus its Linux native package (App Service runs Linux). 2. Re-encode JPEG, PNG and WebP uploads in `ParishProfileService.UploadPhotoAsync`: apply the phone's rotation, then drop all metadata. 3. Decide with you whether private evidence files are re-encoded too (they may need to stay byte-for-byte as evidence). 4. Check that the publish package contains the native library. 5. Turn `A_published_photo_is_served_without_its_location_metadata` into a normal test. 6. Upload one real phone photo on staging or after the deploy. | Me (steps 1–5), you (step 6) | The test passes, and a real phone photo shows upright with no GPS data |
| Demo parish, priest and town | 1.3 | 1. Replace the names in `Landing.jsx`, `CountingDemo.jsx`, the style guide and `portal/model/data.js` with obviously made-up ones. 2. Find which demo data no screen reads, and delete it. 3. Look at the product page in English and Arabic. | Me | No real parish, priest or person name in `frontend/dist`, and every screen still opens (e2e) |
| WhatsApp number | 1.4 | Remove it or keep it in `Landing.jsx` (two places) | Me | The product page shows only a number you approved |
| Prices | 1.5 | If hidden: remove the price cards and the rate line from `Landing.jsx` and `CountingDemo.jsx`. If kept: you send the subscription and refund terms, I write them into the terms page and `refund-policy.md`, and you have the lawyer check them. | Me, plus you if kept | No price shows without published terms |
| Operator identity | 2.1 | 1. Fill the "Who runs ParishLife" and "About these terms" placeholders, English and Arabic. 2. Move the effective dates and `AccountService.TermsVersion`. 3. Get the Arabic checked by a native speaker. | Me (1–2), you (3) | Both pages name the operator, and the versions match the dates |
| Contact address | 2.2 | 1. Replace `hello@parishlife.app` on the product page. 2. Set up the routing for the new address in Cloudflare. 3. Send it a test message. | Me (1), you (2–3) | A message to the new address reaches you |
| Legal placeholders | 2.3, 2.9, then the lawyer | 1. Fill the drafts in `hardening/legal-drafts/`. 2. You send them to the lawyer. 3. I carry the approved text into the live pages, English and Arabic, with new dates and a matching `TermsVersion`. 4. Native Arabic check. | Me, you, the lawyer | No placeholder is left on a live page, and the lawyer has signed off |
| Data processing terms | 4 (Legal) | You accept or download each provider's terms; I record the dates in `docs/operations/legal-pages.md` | You, then me | All four dates are recorded |
| Image sources and AI use | 2.6 | 1. Add image credits. 2. Add an AI-use statement where you decide one belongs. 3. Replace any image without a clear licence. | Me | Every image has a known source and licence |
| Bible verse | 2.7 | Add the translation's copyright notice, or swap the translation, on the home page | Me | The verse has a permitted source |
| Feast dates | 2.8 | Fix any wrong date in `frontend/src/lib/liturgy.js` and check the calendar screens | Me | The dates match what you confirmed |
| Outside Lebanon | 2.4 | If yes: 1. Apply the GDPR changes from the privacy draft. 2. You appoint an EU representative and sign a data processing agreement with each parish. 3. A DMCA agent if US parishes join. | Me (1), you (2–3) | The policy matches where users actually are |

### 5.2 Getting the hardened build live

| Item | Waits on | Still to do | Who | Done when |
|---|---|---|---|---|
| App Service settings | You (section 4) | 1. Make each settings group complete or empty. 2. Check every Key Vault reference shows Resolved. 3. Confirm the .NET runtime is 10.0.15 or later. | You, or me read-only with 3.1 | Every group is complete or empty, and every reference is Resolved |
| Deploy | The row above, plus 3.3 or your own deploy | 1. Build the package (`tools/Publish-ParishLife.ps1`). 2. Deploy. 3. Run the smoke test against `https://parish-life.org`. 4. Check the headers: one-year HSTS and no `Server` header. 5. Watch the logs for an hour. | Me with 3.3, or you | The smoke test passes against production |
| Offline page for the portal | Your real-Firefox check (section 4) | Add one line to `frontend/src/portal/main.jsx` to register the offline worker, then rerun e2e | Me | Opening the portal offline shows the offline page instead of a browser error |
| Pipeline | 3.4 or your own clicks, then 3.5 | 1. Deploy identity. 2. `production` environment with you and Colin as reviewers. 3. Ruleset on `main`. 4. Secret scanning. 5. Open the PR so the pipeline runs. 6. Fix anything that fails on GitHub's Linux machines, most likely the end-to-end job's certificate step. 7. Make the end-to-end job a required check. 8. Set `PRODUCTION_DEPLOY_ENABLED=true` last. | You (2, 8), me (the rest, with 3.4 and 3.5) | One run on `main` is green, and a production deploy waits for a reviewer |
| Backups | You | 1. Confirm continuous backup and soft delete. 2. Run one point-in-time restore into a throwaway database, compare counts, time it, then delete it. 3. Decide the snapshot policy. 4. I record the results in `docs/operations/data-snapshot-and-recovery.md`. | You (1–3), me (4) | A restore has been done once and timed |
| Monitoring and caps | 3.2, or your own deploy | 1. Install the Bicep tool (needs your yes, as it's a new tool). 2. Compile the file. 3. Run `what-if` and show you the result. 4. Deploy. 5. You receive the test alert. 6. You set the budget and the log cap. | Me (1–4), you (5–6) | The test alert reached your inbox and the budget exists |
| Email | You | 1. Resend domain Verified. 2. One live code sent. 3. Turn on the three `Email__*` settings. 4. After 2–4 clean weeks, tighten DMARC. | You | Password reset appears in the portal and a real code arrives |
| Production access | You | Every step in section 4, "Accounts and security" | You | `az role assignment list` shows no standing data roles for people |

### 5.3 After the pilot starts

| Item | Waits on | Still to do | Who | Done when |
|---|---|---|---|---|
| Prerendering | 1.6 | 1. I propose an approach (render the public and product page bodies at build time). 2. You approve it. 3. I build it, check that the page still comes to life correctly in the browser, and turn the "without JavaScript" e2e test into a normal test. | Me, you (2) | The page text is in the HTML with JavaScript off |
| Accessibility checks in CI | 1.7 | 1. Add `@axe-core/playwright`. 2. Turn the scratch scan into an e2e test over the main pages in both languages. 3. Add it to CI. | Me | CI fails on any new accessibility violation |
| Breached-password check | 1.8 | 1. Check new passwords at sign-up, change and reset against the Have I Been Pwned range API: it gets only the first 5 characters of the password's hash, has a short time-out, and lets the password through if the service is down. 2. Tests with a stand-in for the API. 3. A privacy page line in English and Arabic, new dates and `TermsVersion`. | Me | A known-breached password is refused, and sign-up still works when the service is down |
| Cloudflare proxy | 1.12 (only if yes) | 1. Change how the app reads the visitor's IP address (Cloudflare's address list and header) in the same deploy. 2. You restrict App Service to Cloudflare's addresses. | Me (1), you (2) | Rate limits still count each visitor separately |
| Staging | 1.13 | 1. You approve the cost. 2. Create it following `docs/operations/deployment-and-rollback.md` (staging steps 1–8). 3. Turn on `STAGING_ENABLED`. 4. Rehearse one rollback and record the time. | You (1), you or me with permission (2–4) | A rollback has been done once on staging |
| Pilot peak | 2.5 | Rerun the load test with your numbers and update the thresholds and the report | Me | The load test passes at your real peak |
| Search Console | You | Add the site, submit the sitemap, run the Rich Results Test, and send me any errors | You, then me | No errors in Search Console |
| Upgrades | 1.15 | One at a time: update the package, fix what breaks, run the full checks | Me | Each one is green on its own |
| Small UI choices | 1.16, 1.17, 1.18 | Delete the two images; unify the tab icon; change the dark-mode default | Me | Done and checked in both languages |
| Signed-in read cost | 1.14 | Nothing until more parishes join; then cache the repeated reads and remove the per-row reads in 7 lists | Me, later | Requests per page are back near one read per record |
| Housekeeping | You | Retire the old Cloudflare Worker and its D1 database, tidy the Turnstile hostnames, and turn on the commit hooks in each clone | You | — |

---

## 6. Work I can do now, without anything from you

| Item | Still to do | Done when |
|---|---|---|
| A timed-out save repeated (audit N2) | Today a save that gets no answer for 30 seconds says it may already be saved. The full fix: a failed save keeps its operation id, so pressing Save again can never create a second record. This touches the save path of every portal module. | A test that holds a save past 30 seconds, then presses Save again, finds one record |
| Smoke test in the deploy runbook | Add the post-deploy smoke-test command as a numbered step in `docs/operations/deployment-and-rollback.md` (today it's only in the QA report) | The runbook has the step |
| Commit this file | Commit and push `hardening/WHAT-I-NEED-FROM-YOU.md` to `fullstack-hardening` | It's on GitHub |

---

## Already done since the report was written

- The recorded terms version now follows the privacy page's 23 November date (D15). If the pages are published on a later day, the dates must move again: tell me the day.
- The CI actions are pinned to exact commits (D8.8).
- The staging runbook now requires a staging-only deploy identity (N6).
