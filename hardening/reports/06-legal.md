# Agent 06: Legal, privacy, content and SEO/AEO

Branch `hardening/06-legal`. Part A on 21 November 2026, from `abf17e3`. Part B on 22 November 2026, from `fullstack-hardening` at `4bc66d1`, which already includes the work of Agents 01, 02 and 03.

**Changes stayed within my files:**
- the legal pages and the product page;
- the heads of `index.html`, `public.html` and `landing.html`;
- `robots.txt` and `sitemap.xml`;
- `docs/operations/legal-pages.md` and `hardening/legal-drafts/`.

**Additions in other agents' folders**, listed in the handoffs:
- new font files under `frontend/public/assets/fonts/` (Agent 05's folder; nothing existing was edited);
- a new end-to-end test file, `frontend/e2e/legal-seo.spec.mjs` (Agent 09's folder).

**Not changed:** no backend file. Nothing was deployed. Production received only read-only GET and HEAD requests (headers, redirects, a 404 check). DNS was only looked up publicly.

## A. Summary

- **Status: these documents are drafts that need review by a lawyer licensed in Lebanon.** That includes the published pages, which now carry factual corrections. The owner's policy choices remain decisions: operator identity, legal bases, liability, disputes and notice periods.
- **Published:**
  - the privacy policy and terms updated in English and Arabic, effective 22 November 2026, every changed sentence listed below;
  - a new cookie policy page;
  - policy links in the product page footer.
- **Fixed on the site:**
  - the portal and product page no longer load Google Fonts, which are now served from the site under the OFL;
  - four unsupported claims corrected on the product page, and one in the public site's description;
  - robots.txt, sitemap.xml, canonical links, `noindex` on the private portal, and JSON-LD.
- **Top risks:**
  1. `privacy@parish-life.org`, the only contact in the policies, **cannot receive mail**: parish-life.org has no MX record.
  2. The product page's contact address `hello@parishlife.app` is on a domain with no mail server and no proof of ownership.
  3. The product page shows monthly prices with no subscription or refund terms.
  4. Under Law 81/2018, the operator may need to file a declaration with the Ministry of Economy and Trade and get a licence for health data.
  5. Parish pages are invisible to search and answer engines that don't run JavaScript. The server fix is handed off.

## B. Item table

**Status counts (31 rows):**

| Status | Count |
| --- | --- |
| Fixed | 8 |
| Already OK | 5 |
| Handed off | 4 |
| Needs your action | 10 |
| Not applicable | 4 |
| Could not verify | 0 |

"Handed off" means my part is done, and the remainder needs code in another agent's files (`hardening/handoffs/from-06-legal.md`).

| Item | Status | Risk | What I found | What I changed (files) | How I verified it |
| --- | --- | --- | --- | --- | --- |
| A1 Privacy policy draft | Needs your action | High | The approved text was checked against the code (35 statements). After Agent 03's work, every statement is now supported; two are unverifiable Azure facts (log retention, backups). Missing contents: legal bases, the right to object, response time, the operator's legal identity. | `hardening/legal-drafts/privacy-policy.md` (P1–P16 in English and Arabic, plus a Part B status note) | Code references in the draft's fact table |
| A2 Terms draft | Needs your action | Medium | Missing: the contracting party, intellectual property, content licence, dispute forum, language precedence. Liability is left out by the owner's choice. | `hardening/legal-drafts/terms-of-use.md` (T1–T14) | Code references |
| A3 Cookie policy | Fixed | Low | No cookie policy existed. | `frontend/public/cookies.html` (new); draft inventory updated | `legal-seo.spec.mjs` test 1 |
| A4 Refund policy | Needs your action | Medium | Nothing is sold online, but the product page shows $19 and $49 a month with no subscription or refund terms. | "Payments and refunds" section in `terms.html`; `refund-policy.md` (future structure, NOT FOR PUBLICATION) | Code: no payment provider; `Landing.jsx` pricing |
| B1 Publish policies, links, effective date | Fixed | Medium | The product page footer showed "Privacy" and "Terms" as plain text. There was no cookie page. Sign-up already linked the terms and the privacy policy. There is no checkout. | `privacy.html`, `terms.html`, `public/cookies.html` (effective date shown on each, each links the other two); `Landing.jsx` footer links all three. Public-site footer cookie link: handoff 05 #9c. | `legal-seo.spec.mjs` (both languages, page policy, links); the full e2e suite |
| B2 Cookie consent banner | Not applicable | Low | Every cookie is strictly necessary. Storage holds only user-set preferences, session notices and an offline copy of public pages. There is no analytics, marketing or third-party tracking, and Google Fonts was removed from the pages. **Lebanon:** Law 81/2018 makes "no specific mention to cookies" (DLA Piper), so no consent requirement applies. **If EU users come:** ePrivacy Art. 5(3) exempts storage strictly necessary for a service the user asked for, and preference items set by the user directly are generally treated as exempt. The offline copy and the counting cookie would be `[COUNSEL]` points. A banner here would block nothing, so none was added; the notice is the cookie policy page and the privacy section. | none (decision recorded) | Inventory in `cookie-policy.md` section 1; `legal-seo.spec.mjs` test 2 (no third-party requests) |
| B3 Form consent | Handed off | Medium | Sign-up says "By creating an account you accept…" with both links. The guest request form has no policy link. There are no marketing opt-ins (no marketing exists). Nothing records which policy version was accepted. | Handoff 03 #8 (store `TermsAcceptedAt` and `TermsVersion`); handoff 05 #9d (privacy link on the request form) | Code review: `Auth.jsx`, `RequestPage.jsx`, `RegisterAccountDto` |
| B4 Only necessary data | Needs your action | Medium | Sign-up: email, password, display name, age box; all needed. Guest request: needed to handle it. Profile extras are optional. Parish record fields are the parish's choice. No field to remove. Retention periods are **not set** (owner question 15), so nothing is purged. Deletion process: self-service closure (Agent 03) plus parish data-closure requests. | none | PROJECT_MAP §10; `AccountClosureService` |
| B5 Analytics | Already OK | Low | No analytics tool. Anonymous server-side daily counts (`SiteMetric`: day, kind, language, parish) through `beacon.js`, skipped on Do Not Track and Global Privacy Control. No IP address, device or visitor ID. Disclosed in the privacy and cookie pages. **Recommendation:** keep it, and add no tool. If more insight is ever needed, add server-side counts of key events (sign-up, closure) in the same anonymous style. No CSP domains needed. | Privacy text now mentions DNT/GPC | `beacon.js`, `SiteMetric` |
| B6 Third-party embeds and fonts | Fixed | Medium | Google Fonts loaded on the portal, sign-in and product page before any choice. Turnstile is necessary security and disclosed. YouTube, Maps and WhatsApp appear only as links. | Inter, IBM Plex Mono and IBM Plex Sans Arabic from Fontsource 5.3.0 (OFL) in `public/assets/fonts/` with `portal-fonts.css`; `index.html` and `landing.html` link it. Printed sheets: handoff 05 #4; page policy: handoff 03 #5. | Measured: no non-site request on index and landing (EN and AR); fonts load from `/assets/fonts`; `legal-seo.spec.mjs` test 2 |
| B7 Fake reviews | Already OK | Low | No testimonials, ratings, reviews or logo walls (PROJECT_MAP §12 and my reading of `Landing.jsx` and `Home.jsx`). One social-proof badge is handled in B8. | none | Code review |
| B8 Unsupported claims | Fixed | Medium | Five claims could not be backed (section C). | `Landing.jsx` (four), `public.html` description (one) | Built page checked in a browser (badge text, footer) |
| B9 Business details | Needs your action | High | The legal name, address and registration number are not provided. The product page lists "Beirut, Lebanon", an unverified email and a WhatsApp number. | Placeholder comments in `privacy.html` and `terms.html` (not shown to readers); drafts P1 and T1 | — |
| B10 Image copyright | Needs your action | Medium | 33 photos and backgrounds plus 4 app icons have no per-file source or licence. The footer credits one Unsplash photographer for "illustrative photographs". The only embedded metadata is an sRGB profile notice. Fonts are OFL with licence files, including the new ones. The map is Natural Earth (public domain). | none (asked before any replacement) | Byte scan of `public/assets/images` for EXIF, XMP, C2PA and AI tags |
| B11 Deletion wording | Handed off | Medium | The closure drawer says what is deleted and what parishes keep, but not what ParishLife itself keeps. No email is sent on closure. | `privacy.html` now states exactly what is deleted and kept. Drawer sentence: handoff 05 #9b. | `AccountClosureService`, `account-closure.jsx` |
| B12 AI disclosures | Not applicable | — | No AI in the product, and no Agent 07 handoff. | Privacy states "no AI" | PROJECT_MAP §12 |
| B13 Applicable laws | Needs your action | High | See the compliance table in section D. | none | — |
| B14 Other legal risks | Needs your action | Medium | Risk register in section D. | none | — |
| B15 SEO and AEO | Fixed | Medium | There was no robots.txt, sitemap, canonical link or structured data. Parish pages are client-only. | `public/robots.txt`, `public/sitemap.xml`; heads of `index`, `public`, `landing`, `privacy`, `terms`, `cookies` (unique titles, descriptions, canonicals; landing Open Graph text); JSON-LD WebSite and Organization (public), SoftwareApplication and FAQPage (landing; the questions and answers come from the page itself). Parish-page heads and a dynamic sitemap: handoff 03 #6. | `legal-seo.spec.mjs` test 3 (robots rules, every sitemap address 200, JSON-LD parses with the expected types). Rich-results validation needs Google's tool (Needs your action 9). |
| B16 Server-rendered public pages | Handed off | Medium | `curl` of `public.html` and `landing.html` returns real titles, descriptions and JSON-LD, but no body content; React draws it. Prerendering the product page would need a build step in Agent 04's `vite.config.js`. | Heads improved (B15). Server-side parish heads: handoff 03 #6a. | `legal-seo.spec.mjs` reads the server HTML with `request.get` |
| B17 Stray noindex | Fixed | Low | There was no noindex anywhere, including on the private portal. | `noindex` on `index.html` (sign-in and portal); robots does not block it, so crawlers can read it. `X-Robots-Tag` on `/api` and tracking links: handoff 03 #7. | Test 3: index is noindex, the five public pages are not |
| B18 Real 404s | Handed off | Low | Unknown paths answer 404 (production GET `/this-page-does-not-exist` → 404, and `/robots.txt` was 404 before this change). Unknown parish ids (`public.html?parish=x`) answer 200 with a client "not found" view. | Handoff 03 #6b | Production GET (2 requests) |
| B19 One URL per page | Already OK | Low | `http://` → 301 to `https://parish-life.org/`; `www` → 301 to the apex, keeping the path. Canonical links now on every single-file page. `/` and `/index.html` duplicate each other, but both are noindex. | Canonical links (B15) | Production GETs (3 requests, 21–22 Nov) |
| B20 Search Console and Business Profile | Needs your action | Low | Not set up. Each parish is a physical place but is the parish's own; ParishLife has no published address. | none | — |
| B21 Fact-check AI content | Needs your action | Medium | Unknown which texts and translations were written with AI (PROJECT_MAP §12, owner question 1). **The Arabic of every legal sentence changed on 22 November was written by an AI agent (me)** and must be checked by a native speaker. Religious content to confirm (section C): Matthew 5:16 text and translation, the Maronite calendar in `lib/liturgy.js`. | none | — |
| B22 AI policy and AI claims | Not applicable | — | No AI. No "AI-powered", "smart" or accuracy claims in the landing or public copy (searched in English and Arabic). | none | grep |
| B23 Marketing consent and unsubscribe | Not applicable | — | No marketing email, SMS or WhatsApp sending. Resend sends only transactional codes, which need no List-Unsubscribe. In-app broadcasts respect each topic's mute. | none | `ResendContactCodeDelivery`, `BroadcastService` |
| B24 DMCA agent and takedowns | Already OK | Low | US users not confirmed, so a DMCA agent is not needed. A report process is now published (terms: report option on messages, email for other content). | `terms.html` "Reporting content" | `MessageReport` route exists |
| B25 Age gate | Already OK | Medium | 13+ confirmation enforced server-side at sign-up (Agent 03); no birth date collected. Under 13: refused. Ages 13–17 and guardian consent: `[COUNSEL]`. | Wording in `terms.html` and `privacy.html` | Agent 03's test `Sign_up_requires_the_13_or_older_confirmation` |
| B26 Biometrics | Fixed | Low | Passkeys only; biometrics never leave the device (Agent 03 C19). | Sentence in `privacy.html` (EN and AR) | `PasskeyService`, `AccountPasskey` |
| Docs | Fixed | Low | `legal-pages.md` did not reflect the new version. | `docs/operations/legal-pages.md` (new sources, cookie page, drafts still open) | — |

### Every sentence changed on the published pages (22 November 2026)

The Arabic mirrors each item. Old and new texts are in `git diff 4bc66d1 -- frontend/privacy.html frontend/terms.html`.

**privacy.html**
1. Effective date: "21 November 2026" → "22 November 2026" (Arabic now written in Arabic: "٢٢ تشرين الثاني ٢٠٢٦").
2. Your account: added "It also holds the parishes you follow, your notification choices, your own notes and to-do list (visible only to you and stored encrypted) and, if you add one, the signature you draw and the title shown with it on documents you sign." and "If you unlock a passkey with your face or fingerprint, that check happens on your device: ParishLife never receives biometric data."
3. Parish records: the list now reads "name, date of birth and family details, contact details and address, rite, occupation and skills, households and relationships, sacraments and certificates, parish and ministry membership, catechism and formation progress, attendance, volunteering, registrations, contributions and receipts, consents you have given the parish, date of death, and letters or documents the parish issues."
4. New items:
   - Children's safety records
   - Prayer intentions
   - Clergy signatures
   - People who rent parish facilities
   - Help with two-step sign-in
   - Your location ("Near me", not stored)
5. Requests and messages: added "and messages in the parish inbox".
6. Anonymous site counts: added "and a browser that asks not to be tracked (Do Not Track or Global Privacy Control) is not counted."
7. New section "Artificial intelligence": "ParishLife does not use artificial intelligence to analyse your data, and no decision about you is made by automated means alone."
8. Platform operators: added "This includes reviewing a message that someone reports to them and requests for help with two-step sign-in."
9. Resend: added "and the codes that reset a forgotten password."
10. Google Fonts: now "when you print or save a document from the members portal, the printed page loads its fonts from Google … The pages themselves use fonts served by ParishLife."
11. New: "ParishLife stores its data in Microsoft Azure's France Central region, in the European Union. Cloudflare, Google, Microsoft and Resend may handle the limited data described above in other countries, including the United States."
12. Cookies:
    - The sign-in cookie: "deleted when you sign out or close the browser, and the sign-in inside it ends 8 hours after you signed in."
    - The security cookie: added "The public pages also use it to send the anonymous visit count."
    - Provider cookies: "(15 minutes at most)".
    - The closing paragraph was rewritten. It distinguishes necessary cookies from preferences, gives Cloudflare's statement on Turnstile cookies, and links the cookie policy.
13. New section "How we protect it": encrypted connections, role-based access, two-step sign-in for staff, clergy and operators, protection at rest for sensitive records, audit records.
14. Retention:
    - "Sessions end after 8 hours, sign-in codes after a few minutes" → "A sign-in ends after 8 hours (15 minutes for a recovery sign-in), or as soon as you sign out; email codes expire after 15 minutes."
    - New paragraph on what closing deletes and keeps.
    - Backups: added "so deleted data can remain in backups until then."
15. Rights in the app: added "reset a forgotten password with a code we email you", "download a copy of your account data and of your own record in each parish you are linked to" and "close your account yourself".
16. Children: added "sign-up asks you to confirm your age and does not ask for your date of birth" and "only the parish office records them."
17. Head: meta description and canonical link. Footer: cookie policy link.

**terms.html**
1. Effective date → 22 November 2026, in Arabic in the Arabic text.
2. Accounts: new item "You must be 13 or older to create an account; sign-up asks you to confirm it."
3. New section "Payments and refunds": "Using ParishLife as a member is free, and ParishLife takes no payments online, so there is nothing to refund through ParishLife. Gifts, registration fees, rentals and any refunds that a parish records are arranged directly with that parish, under its own rules; ask the parish office."
4. New section "Reporting content": "To report a message, use the report option on that message. To report other content that is unlawful, abusive or infringes your rights, write to privacy@parish-life.org."
5. Suspension and closing:
   - "We or a parish may suspend an account or limit access…" → "We may suspend an account, and a parish may end your access to its records, if the account breaks these terms or puts other people or the service at risk."
   - "to close your account, write to …" → "close your account yourself in My account ("Close my account") or by writing to privacy@parish-life.org. What closing deletes and what is kept is explained in the privacy policy."
6. Head: meta description and canonical link. Footer: cookie policy link.

## C. Flagged reviews and claims

| Location | Original | Why flagged | Action |
| --- | --- | --- | --- |
| `Landing.jsx` pricing, Parish plan badge | "Most parishes" / "الأكثر اختياراً" | Social proof with no customer data during a pilot (consumer-protection risk for misleading claims) | **Changed** to "Recommended" / "المقترحة" |
| `Landing.jsx` FAQ, paper registers | "Yes, and many parishes do." | Implies existing customers | **Changed** to "Yes." |
| `Landing.jsx` FAQ (offline) and FAQ (data) | "saved on the parish's server", "In the parish's database on the server" | Factually wrong: there is one ParishLife database on Azure (France), partitioned per parish | **Changed** to "ParishLife's server" and "ParishLife's database, hosted by Microsoft Azure in France, with each parish's records kept apart" |
| `Landing.jsx` modules and FAQ | "exported to PDF or Excel", "export to Excel, CSV or PDF" | Exports are CSV files (with a BOM so Excel opens them) or printed PDF; no .xlsx is written | **Changed** to "CSV (which opens in Excel) or PDF" |
| `public.html` meta description | "Find your parish anywhere in Lebanon" | The directory lists only parishes on ParishLife | **Changed** to "Find parishes on ParishLife in Lebanon" |
| `Landing.jsx` pricing | "$19/mo", "$49/mo", "L.L … at 89,500", "No setup fee, no annual lock-in", "Unlimited records" | Commercial offer with no subscription terms, refund terms or seller identity; the exchange rate is fixed in the code | **Kept.** Needs your action 4 |
| `Landing.jsx` contact | `hello@parishlife.app` (three places) | Domain has no MX record and is parked on GoDaddy DNS; ownership unknown. Enquiries, which may include personal data, could reach a stranger. | **Kept.** Needs your action 3 |
| `Landing.jsx` contact | WhatsApp `+961 3 421 887`; "Beirut, Lebanon" (a link to `#`) | Owner of the number unknown; the address is not provided | **Kept.** Needs your action 3 |
| `Landing.jsx` "Set your parish up in one afternoon", "30 minutes · no commitment" | — | Service promise; fine if the owner delivers it | **Kept** |
| `Home.jsx` verse | English text of Matthew 5:16 | Wording matches the NRSV, which asks for a copyright notice when quoted; the Arabic appears to be the Van Dyck text (public domain) | **Kept.** Needs your action 8 (05's file) |

No fake reviews or testimonials were found.

## D. Legal risk register and compliance status

| Risk | Law or reason | Likelihood / impact | Recommended action |
| --- | --- | --- | --- |
| The privacy contact cannot receive mail (no MX on parish-life.org, checked against 1.1.1.1 and 8.8.8.8) | Law 81/2018 rights of access and correction need a working channel; the policies promise answers by email | High / High | Enable Cloudflare Email Routing (Needs your action 2) |
| No declaration or licence for processing personal data (health notes in particular) | Law 81/2018: declaration to the Ministry of Economy and Trade (with exemptions) and a licence for health data (DLA Piper; article numbers `[COUNSEL]`) | Medium / High | Lawyer to decide who must file; keep medical notes off until licensed if needed |
| Prices shown with no subscription terms, refund terms or seller identity | Consumer Protection Law 659/2005 (as amended in 2014): information duties and abusive clauses; Art. 55 withdrawal for distance contracts `[COUNSEL]` | Medium / Medium | Confirm the prices and how parishes pay; complete the refund structure; name the seller |
| Operator not identified (no legal entity on any page) | Law 81/2018: data subjects must be told who the controller is; contract law needs a party | High / Medium | Provide legal details (Needs your action 1) |
| Product page contact on an unverified domain | Misdirected personal data; misleading contact details | Medium / Medium | Replace it with a parish-life.org address once mail routing works |
| Religious affiliation and children's records at scale | Law 81 sensitive categories (health); GDPR Art. 9 and Art. 8 if EU parishes join | Low now / High | Confirm the diaspora question; a parish service agreement with data processing terms |
| No data processing terms signed with vendors | Microsoft Azure, Cloudflare, Resend, Google, Microsoft identity | Medium / Medium | Accept each vendor's DPA in their consoles (Needs your action 6) |
| Image licences unknown | Copyright (Lebanese Law 75/1999 on literary and artistic property); Unsplash licence for credited photos | Medium / Medium | Record the source of each image; replace unknowns |
| NRSV quotation without notice | NCC NRSV permission terms | Low / Low | Add the notice, or use another translation |
| Brand use: Google and Microsoft names on sign-in buttons, WhatsApp name | Brand guidelines for the sign-in buttons | Low / Low | Follow Google's "Sign in with Google" and Microsoft's sign-in branding guidelines (05 for styling) |
| Open-source obligations | npm packages are MIT/ISC; GSAP's standard licence allows commercial use; fonts OFL (licence files shipped) | Low / Low | Keep the licence files; no action |
| User-generated content (parish websites, messages, uploads) | Liability for unlawful content | Low / Medium | Reporting process now published; operators review reported messages |
| Minors aged 13–17 accept terms alone | Age of majority 18 (capacity to contract) `[COUNSEL]` | Medium / Low | Lawyer to advise; the owner's decision stands meanwhile |

**Compliance status by law** (short):

| Law | Status |
| --- | --- |
| **Lebanon, Law 81/2018** | Information notice mostly in place (controller identity missing). Rights in the app and by email, but the email does not work yet. Security in place. Declaration and licence open. |
| **Lebanon, Consumer Protection 659/2005** | Not engaged for members (free). Engaged for parish subscriptions once sold. |
| **GDPR, UK GDPR, ePrivacy** | Not applicable until EU or UK users are confirmed. What would change is listed in privacy draft C2. |
| **CCPA/CPRA, other US state laws, COPPA** | Not applicable: no US users confirmed; no under-13 accounts; no sale or sharing. |
| **CAN-SPAM and other anti-spam laws** | Not applicable: transactional email only. |
| **PCI DSS** | Not applicable: no card data; no payment provider. |
| **Auto-renewal laws** | Not applicable until subscriptions are sold online. |
| **Accessibility (ADA, European Accessibility Act)** | Agent 05's area. The legal pages use semantic headings, `lang`/`dir` per section and table headers with `scope`. |
| **EU AI Act** | Not applicable: no AI. |

## E. Needs your action

1. **Operator identity.** Provide the legal name, registered address, registration number and register. Add them to "Who runs ParishLife" (privacy) and "About these terms" (terms) in both languages; placeholder comments mark the places. Also confirm "Beirut, Lebanon" on the product page, or give the real city or address.
2. **Make `privacy@parish-life.org` work.** It gets no mail today.
   1. In the Cloudflare dashboard, open parish-life.org, then Email, then Email Routing.
   2. Enable it and add the records it proposes: MX and SPF TXT.
   3. Add a route from `privacy@` to your inbox and verify that inbox.
   4. Send a test email from another account.
   5. Run `dig MX parish-life.org` and confirm it shows `route*.mx.cloudflare.net`.
3. **Product page contact.** Confirm that you own `parishlife.app` and that `hello@parishlife.app` receives mail (today: no MX record). Also confirm whose WhatsApp number +961 3 421 887 is. If either is not yours, give me the replacement and I will change `Landing.jsx`.
4. **Prices and subscriptions.** Confirm the $19 and $49 monthly prices and the fixed rate of 89,500 LBP shown on the product page. Then decide the subscription terms (renewal, cancellation, refunds) and fill `hardening/legal-drafts/refund-policy.md` part 2. Until then, consider removing the prices.
5. **Lawyer review** of `hardening/legal-drafts/*` and the published pages. The `[COUNSEL]` items:
   - the declaration and health-data licence under Law 81;
   - minors aged 13–17;
   - liability limits (T8 is an **owner decision**);
   - the withdrawal right for subscriptions;
   - whether religious affiliation is restricted by any other law.
6. **Vendor data processing terms.** Accept or download the DPA from each provider:
   - Microsoft: Azure Products and Services DPA, covering Entra sign-in;
   - Cloudflare: DPA in the dashboard;
   - Resend: DPA on its legal page;
   - Google: Cloud/Workspace data processing terms for the OAuth client, through the Google Cloud console.

   Record the dates in `docs/operations/legal-pages.md`.
7. **Placeholders to fill in the drafts:**
   - countries operators work from (P5);
   - retention per record type (owner question 15), and the retention and location of operator snapshots (P6);
   - response time (P7);
   - notice period (P12, T11);
   - abuse or legal contact (T6);
   - settlement period and court city (T12);
   - prevailing language (T13).
8. **Content to confirm:**
   - which texts, Arabic translations and images were written or made with AI;
   - a native-speaker check of the Arabic sentences changed on 22 November (written by an AI agent);
   - the source and licence of each image in `frontend/public/assets/images/`;
   - Matthew 5:16: NRSV notice or another translation;
   - the Maronite calendar dates in `src/lib/liturgy.js`, against the Patriarchate's calendar.
9. **Google Search Console and Bing.**
   1. In Search Console, add a "Domain" property for `parish-life.org`.
   2. Copy the TXT record and add it in Cloudflare DNS (Type TXT, Name `@`).
   3. Verify the property.
   4. Under Sitemaps, submit `https://parish-life.org/sitemap.xml`.
   5. Bing Webmaster Tools: "Import from Google Search Console", or the same TXT method.
   6. Test `landing.html` and `public.html` in Google's Rich Results Test.

   **Google Business Profile:** not applicable to ParishLife, which has no public address. Each parish may claim its own.
10. **Effective date.** If the pages are deployed later than 22 November 2026, change the date in both languages on `privacy.html`, `terms.html` and `cookies.html` to the deploy day.
11. **Diaspora parishes.** Confirm whether parishes in the EU, UK, US or Australia will use ParishLife. If so: GDPR changes (privacy draft C2), an EU representative, a DPA with each parish, and possibly a DMCA agent.

## F. Handoffs

**Sent** (`hardening/handoffs/from-06-legal.md`):

| # | To | What | Priority |
| --- | --- | --- | --- |
| 1 | 03 | Account deletion and data copy | handled by 03 |
| 2 | 03 | Storage left after sign-out | handled by 03 |
| 3 | 08 | Confirm log retention, IP masking, query strings, backup and snapshot retention | Medium, open |
| 4 | 05 | `print.js` fonts to `/assets/fonts/portal-fonts.css`; then delete the Google Fonts items in privacy and cookies | Medium |
| 5 | 03 | Remove Google Fonts from the page policy after #4 | Low |
| 6 | 03 | Server-side head and JSON-LD for parish pages, 404 for unknown parishes, server sitemap | Medium |
| 7 | 03 | `X-Robots-Tag: noindex` on `/api` and on tracking links | Medium |
| 8 | 03 | Record the accepted policy version at sign-up | Medium |
| 9 | 05 | Copy: forgot panel, closure drawer, public footer cookie link, request-form privacy note | Medium |
| 10 | 08 | Document the missing MX record and the DNS records to come | High |
| 11 | 09 | Review the new `frontend/e2e/legal-seo.spec.mjs` | Low |

**Received:**
- **03 #5:** facts for the closure, data copy, reset and age wording. **Handled:** used in `privacy.html` and `terms.html`. The closure drawer sentence went to 05 (#9b). The office-reset sentence also went to 05 (#9a), with my wording, as 03 asked.
- **03 #4:** the forgot-panel sentence, to change "with Agent 06". **Handled** through 05 #9a.
- **02:** nothing addressed to 06.

## G. Checks run (22 November 2026)

- **Frontend:** `npm run format:check`, `npm run check` and `npm run build` all pass. `npm run check:routes` passes (no route touched; run anyway).
- **New end-to-end tests:** `E2E_PORT=7366 E2E_CHANNEL=chromium npm run e2e -- legal-seo.spec.mjs` → 3 passed. Port 7311 was taken by another agent's run.
- **Full end-to-end suite:** `E2E_PORT=7366 E2E_CHANNEL=chromium npm run e2e` → **15 passed, 1 failed** (16 tests: the baseline 13 plus my 3).
  - The failure is the known baseline one, "public pages load signed out".
  - Its only problem is "[/public.html] console error: An SSL certificate error occurred when fetching the script". That is the service worker under the untrusted local certificate.
  - The legal pages it also opens pass its checks.
- **Measured font check** (Playwright script in the scratchpad, on the built pages): `index.html` and `landing.html` in English and Arabic make no request outside the site; Inter and IBM Plex load from `/assets/fonts`.
- **Backend:** not run. No backend file changed.
- **gitleaks** on the commits: no leaks found.
