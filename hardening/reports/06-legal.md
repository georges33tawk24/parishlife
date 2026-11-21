# Agent 06: Legal, privacy and content (Part A note)

## A. Summary

Part A only: drafts written, and no application code changed. The privacy policy and the terms are **not rewritten**. The published, owner-approved texts of 21 November 2026 are checked against the code, the prompt's required contents and Lebanon's Law No. 81/2018, and each gap gets proposed wording in English and Arabic. The cookie policy is new and lists every cookie and browser-storage item the code sets. The refund policy states that nothing is sold online and adds a future-subscription structure that is **not for publication**.

**All four documents are drafts that need review by a lawyer licensed in Lebanon before anything is published.** The most important finding: the published privacy policy and terms promise account deletion and a copy of your data "by request", and the code can do neither today.

## B. Part A items

| Item | Status | Risk | What I found | What I changed (files) | How I verified it |
| --- | --- | --- | --- | --- | --- |
| A1. Privacy policy | Needs your action | High | Of 35 statements checked:<br>• 20 verified;<br>• 4 incomplete (signatures, prayer intentions, children's pickup and evacuation rolls, renters, recovery requests, reported-message review);<br>• 3 imprecise (cookie lifetime, code lifetimes, "all necessary");<br>• 4 could not be verified (Azure log contents and retention, region, backups; the backups row is also incomplete because operator snapshots are missing);<br>• 1 not supported by the code ("a copy of your data, deleting your account": no export, and deletion is refused);<br>• 1 not enforced (accounts from 13: no age check);<br>• 1 matches the owner's decision (Lebanese law);<br>• 1 cosmetic (English date in the Arabic text).<br>Missing contents: legal basis, transfers, right to object, mandatory/optional answers, security, AI and biometrics statements, the operator's legal identity. | `hardening/legal-drafts/privacy-policy.md` (fact check; required-contents check; Law 81 and GDPR check; changes P1–P16 in EN and AR) | I read each model and service named in the fact table, the frontend storage use and `sw.js`. I made read-only GETs on production (`/`, `/privacy.html`, `/api/auth/csrf`) to check cookies and Cloudflare proxying. Law 81 points come from DLA Piper's summary and must be confirmed by counsel. |
| A2. Terms and conditions | Needs your action | Medium | Present: acceptable use, accounts, governing law, termination, changes. Missing: the contracting party, minimum age, payments statement, IP, content licence, reporting, dispute forum, language precedence. Limitation of liability was left out by choice (**owner decision** to change). "A parish may suspend an account" is imprecise: only operators can suspend an account. | `hardening/legal-drafts/terms-of-use.md` (T1–T14 in EN and AR) | Code references in the fact table (`AccountStatusService`, `StaffAppointmentService`, `CosmosIdentityStore.DeleteAsync`) |
| A3. Cookie policy | Needs your action | Low | Five first-party cookies, all strictly necessary. Six localStorage keys, two sessionStorage keys and one service-worker cache (`pl-welcome` is read in the code but never set, so it is excluded). No analytics, advertising or embeds. Google Fonts sets no cookies but receives the IP address. Turnstile cookies (on `challenges.cloudflare.com`) **could not be verified in a browser**. | `hardening/legal-drafts/cookie-policy.md` (inventory and published text, EN and AR) | grep of the API and frontend, framework cookie names read from the ASP.NET Core 10.0.15 assemblies, production `Set-Cookie` headers, Cloudflare and Google documentation |
| A4. Refund policy | Needs your action | Low | Nothing is sold online. Parish money is recorded offline, between the person and the parish. A subscription model exists in the code with no refund policy, and the refund terms are Not provided. | `hardening/legal-drafts/refund-policy.md` (publishable short statement in EN and AR; future structure marked NOT FOR PUBLICATION) | Models and `docs/operations/subscription-payer-transfer.md` |

Part B items 1–26 are not started. They run in Wave 2.

## E. Needs your action

1. **Lawyer review.** Have a lawyer licensed in Lebanon review the four files in `hardening/legal-drafts/`, especially the `[COUNSEL]` items:
   - the declaration to the Ministry of Economy and Trade under Law 81/2018;
   - a licence for health data (medical and allergy notes);
   - minors aged 13 to 17;
   - liability limits;
   - consumer-law withdrawal rights for future subscriptions.
2. **Operator identity.** Give the legal name of the operator, its registered address and its registration number and register (privacy P1; terms T1 and T4).
3. **Account deletion and data copy.** Decide how they are done today. Until Agent 03's flow lands, write a manual procedure: who does it, what is kept, and how fast. Otherwise, temporarily soften the privacy and terms wording (privacy row 32, P7; terms T10).
4. **Placeholders to fill:**
   - the countries operators work from, and the provider data processing terms (P5);
   - retention per record type (owner question 15) and operator snapshot retention and location (P6);
   - response time for requests (P7);
   - notice period for changes (P12, T11);
   - abuse or legal contact (T6);
   - the dispute settlement period and the court's city (T12);
   - the prevailing language (T13);
   - the effective date.
5. **Decide on T8** (limitation of liability). It is not in the current terms, by your choice. Adding it changes what users agreed to.
6. **Confirm the Azure facts** the privacy page states: 90-day log retention, IP masking, and 7-day and 30-day backups. Read-only checks in the Azure portal; also sent to Agent 08.
7. **Parish service agreement.** Have one drafted with data processing terms (parish as controller, ParishLife as processor) and the indemnity in T9. It is required if any EU parish joins.
8. **Diaspora parishes.** Confirm whether any will join from the EU, UK, US or Australia. If they will, apply the GDPR changes in privacy section C2.

## F. Handoffs

**Sent** (`hardening/handoffs/from-06-legal.md`):
- Agent 03: account deletion and data copy (High).
- Agent 03: account-linked localStorage left after sign-out (Low).
- Agent 08: confirm log retention, IP masking, query strings in telemetry, backup and snapshot retention (Medium).

**Received:** none. `hardening/handoffs/` had only `.gitkeep`, and `PROJECT_MAP.md` does not exist yet.
