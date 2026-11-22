# Handoffs from Agent 06 (Legal, privacy and content)

## 1. Account deletion and data copy promised by the privacy policy
- **To:** Agent 03 (app security and auth)
- **File:** `ParishLife.Api/Identity/CosmosIdentityStore.cs` (`DeleteAsync` returns `DeletionRequiresReview`), `ParishLife.Api/Services/Administration/AccountStatusService.cs`, `ParishLife.Api/Services/People/PersonDataService.cs`
- **Requested change:** When you build the account-and-data deletion flow, cover the two promises the published privacy policy makes "by request": (a) deleting an account, and (b) giving a person a copy of their data. Today neither is possible: deletion is refused, and there is no own-data export. Please send me back the deletion details for the confirmation wording (Part B item 11): what is deleted, what is kept for legal reasons (official, financial and safeguarding records) and for how long.
- **Reason:** `frontend/privacy.html` ("By request … a copy of your data, deleting your account") and `terms.html` ("to close your account, write to …") promise something the code cannot deliver. See `hardening/legal-drafts/privacy-policy.md`, row 32.
- **Priority:** High

## 2. Account-linked browser storage left after sign-out
- **To:** Agent 03 (app security and auth)
- **File:** `frontend/src/portal/features/records/sacraments.jsx` (`pl-anniversaries-<account id>`), `frontend/src/portal/model/modules/finance.js` (`pl-finance-session:<parish id>`), the sign-out path in the portal
- **Requested change:** Remove these two localStorage keys at sign-out. Alternatively, key the anniversaries layout without the account's internal ID.
- **Reason:** On a shared computer they show that a given account, and its finance work for a given parish, were used in this browser. They are listed in the cookie policy draft. Low impact, but it is an easy fix.
- **Priority:** Low

## 3. Confirm what the technical logs keep, and for how long
- **To:** Agent 08 (DevOps and SRE)
- **File:** `ParishLife.Api/Extensions/TelemetryExtensions.cs`; Azure Application Insights and Log Analytics settings (read-only)
- **Requested change:** Confirm and record in `docs/operations/`:
  - (a) the retention of the Application Insights data. The privacy page says 90 days.
  - (b) that IP masking is on, meaning `DisableIpMasking` is not set.
  - (c) whether request telemetry stores query strings. For example, `GET /api/public/parishes?q=` carries the directory search text.
  - (d) the Cosmos continuous-backup window and the blob soft-delete period (the page says 7 and 30 days).
  - (e) where operator snapshots are stored and how long they are kept.
- **Reason:** The privacy policy states (a) and (d) as facts, and they cannot be checked from the repository. (c) and (e) are missing from the policy. See `hardening/legal-drafts/privacy-policy.md`, rows 12, 29 and 30.
- **Priority:** Medium

**Status of 1–3 (Part B, 22 November 2026):** 1 and 2 handled by Agent 03 (self-service copy and closure; `forgetAccountStorage` clears the account-linked keys at sign-out). The privacy, terms and cookie pages now describe both. 3 is still open with Agent 08.

## 4. Printed sheets still load Google Fonts
- **To:** Agent 05 (UI)
- **File:** `frontend/src/portal/shared/print.js` (line 13, `FONTS`)
- **Requested change:** set `const FONTS = '/assets/fonts/portal-fonts.css';`. That file, added by Agent 06, declares the same families and weights (Inter, IBM Plex Mono, IBM Plex Sans Arabic) from `/assets/fonts`. In the same commit, delete the Google Fonts item from `frontend/privacy.html` ("Services we use", both languages) and from `frontend/public/cookies.html` ("Other services", both languages). I agree to that exact deletion in my files; anything else there comes back to me.
- **Reason:** Part B item 6. Index and the product page no longer contact Google; printing is the last place where a visitor's IP address goes to Google before any choice.
- **Priority:** Medium

## 5. Drop Google Fonts from the page policy
- **To:** Agent 03 (security)
- **File:** `ParishLife.Api/Extensions/FrontendHostingExtensions.cs` (`style-src`, `font-src`)
- **Requested change:** once handoff 4 is merged, remove `https://fonts.googleapis.com` from `style-src` and `https://fonts.gstatic.com` from `font-src`. Not before then, or printed sheets lose their fonts (they would fall back to system fonts; nothing breaks).
- **Reason:** least privilege; no page needs Google any more.
- **Priority:** Low

## 6. Parish pages for search engines: server-side head, real 404, sitemap
- **To:** Agent 03 (server; with Agent 08 if hosting changes)
- **File:** `ParishLife.Api/Extensions/FrontendHostingExtensions.cs` (or a small endpoint before the static files), `frontend/public/sitemap.xml` (mine; replace it when the server writes one)
- **Requested change:**
  - (a) When `GET /public.html?parish=<id>` names a **published** parish, serve `public.html` with that parish's `<title>`, `<meta name="description">`, `<link rel="canonical" href="https://parish-life.org/public.html?parish=<id>">`, `og:title`/`og:description`, and a JSON-LD block (`@type` `Church`, with name, address and `geo` only if the parish published them). Use only published profile fields; HTML-encode everything.
  - (b) For an unknown or unpublished parish id, answer **404** with the same page body, so the client still shows its "not found" view.
  - (c) Serve `/sitemap.xml` from the server: the five static pages plus one `public.html?parish=<id>` per published parish, with its last change date. Then delete `frontend/public/sitemap.xml`.
- **Reason:** Part B items 15, 16 and 18. Parish pages are client-only today. Their only server answer is the generic `public.html` (title "Find your parish"), so search and answer engines that do not run JavaScript see no parish content, and unknown parishes answer 200.
- **Priority:** Medium

## 7. Keep private links and the API out of search results
- **To:** Agent 03 (security)
- **File:** `ParishLife.Api/Program.cs` (header middleware)
- **Requested change:** send `X-Robots-Tag: noindex, nofollow` on every `/api/*` response, and on `public.html` when the query has `track=` (guest request tracking links carry a private token). `robots.txt` already disallows `/api/` except `/api/public/`. The header also covers links that leak or are shared.
- **Reason:** Part B item 17.
- **Priority:** Medium

## 8. Record which policy version a person accepted at sign-up
- **To:** Agent 03 (security; DTO and account model)
- **File:** `ParishLife.Api/Services/Accounts/AccountService.cs` (`RegisterAsync`), the external sign-up path, `Identity/ParishUser.cs`
- **Requested change:** when an account is created (form or Google/Microsoft), store `TermsAcceptedAt` (UTC) and `TermsVersion`. For the version, use one server constant, today `"2026-11-22"`, which matches the effective date of `terms.html` and `privacy.html`. Include both in the data copy (`AccountClosureService.ExportAsync`). Never store the policy text.
- **Reason:** Part B item 3: "consent records stored (what, when, which version)". Sign-up already shows "By creating an account you accept the terms of use and the privacy policy" with links, but nothing records it.
- **Priority:** Medium

## 9. Copy at the point of collection and in the closure drawer
- **To:** Agent 05 (UI)
- **Files and exact text (English and Arabic):**
  - (a) `frontend/src/portal/shell/Auth.jsx`, the forgot panel (around line 726). The sentence "The office of the parish your account is with can reset it for you…" describes a route that does not exist (`member-data.js` `accountReset` always throws). Replace it with:
    - EN: "Reset it with a code sent to your email. If you cannot receive email, write to privacy@parish-life.org."
    - AR: "أعد تعيينها برمز يُرسَل إلى بريدك. وإذا لم يصلك البريد، راسلنا على privacy@parish-life.org."
    - When `features.verification` is off, keep only the second sentence.
  - (b) `frontend/src/portal/features/account/account-closure.jsx`, closure help text. After "It cannot be undone.", add:
    - EN: "ParishLife keeps only a marker that the account existed and was closed (its number and the closing time, without your name or email) and its security and audit records."
    - AR: "لا يحتفظ ParishLife إلا بإشارة إلى أن الحساب كان موجوداً وأُغلق (رقمه ووقت إغلاقه، من دون اسمك أو بريدك) وبسجلات الأمان والتدقيق الخاصة به."
    - This is Part B item 11: what is kept for legal reasons. There is no retention period yet (owner question 15), so no period is stated.
  - (c) `frontend/src/public/components/Chrome.jsx`, footer: add a third link after terms, `cookies.html?lang=ar|en`, labelled "Cookie policy" / "سياسة ملفات تعريف الارتباط".
  - (d) `frontend/src/public/pages/RequestPage.jsx`, the `rq-privacy` note. Add before the existing text:
    - EN: "The parish receives these details to handle your request. See the privacy policy." (linking `privacy.html?lang=en`)
    - AR: "تتلقّى الرعية هذه التفاصيل لمتابعة طلبك. راجع سياسة الخصوصية." (linking `privacy.html?lang=ar`)
- **Reason:** Part B items 1, 3 and 11, and Agent 03 handoff 4 (the forgot sentence).
- **Priority:** Medium

## 10. Email and DNS facts the legal pages depend on
- **To:** Agent 08 (DevOps), to document; the DNS change itself is the owner's
- **File:** `docs/operations/email-delivery.md`
- **Requested change:** record that on 22 November 2026 public DNS showed **no MX record for parish-life.org** (resolvers 1.1.1.1 and 8.8.8.8). So `privacy@parish-life.org`, the published contact for every privacy and legal request, cannot receive mail until Cloudflare Email Routing is enabled (it adds the MX and SPF records). Also record the Resend domain records when they are added, and the Google Search Console and Bing verification TXT records (owner steps in `hardening/reports/06-legal.md`, section E).
- **Reason:** the policies promise answers by email to that address. Part B items 9 and 20.
- **Priority:** High

## 11. New end-to-end test file in your folder
- **To:** Agent 09 (QA)
- **File:** `frontend/e2e/legal-seo.spec.mjs` (new; nothing existing was edited)
- **Requested change:** review it and keep it in the suite. It covers the three legal pages in both languages under the page policy, no Google requests from the product and sign-in pages, robots and sitemap, noindex, canonical links and JSON-LD. 3 of 3 pass with `E2E_CHANNEL=chromium`.
- **Reason:** proof for Part B items 1, 6, 15 and 17.
- **Priority:** Low

**Agent 03 note (sweep 1, 22 November 2026):**
- 1 and 2: done in wave 1. Self-service copy and closure in `fee7996`, the portal and storage clearing in `826b05d`, tests in `3976aa8`; the closure responsibility guard was added in sweep 1 (`e6c7e95`).
- 5: done in `f2733a5`.
- 6: done in `f2733a5`. The sitemap is now generated; deleting the static file was handed to 05.
- 7 and 8: done in `c062c71`.
