# Privacy policy, terms of use and cookie policy

Approved by the owner on 21 November 2026 (effective that day; the draft banner is removed): `frontend/privacy.html` and `frontend/terms.html`. Version of 22 November 2026 (hardening Agent 06, Part B): factual corrections and the wording the new account features need (self-service data copy and closure, forgotten-password reset, the 13+ confirmation), listed sentence by sentence in `hardening/reports/06-legal.md`; and a new cookie policy, `frontend/public/cookies.html`. Once deployed they are served by the API at `https://parish-life.org/privacy.html`, `/terms.html` and `/cookies.html`. Google needs the first two before the OAuth app can go "In production", and Microsoft wants the same links on its app registration.

- **What they are:** static pages in English and Arabic, with no sign-in. `privacy.html` and `terms.html` are Vite inputs; `cookies.html` sits in `frontend/public/` and is copied as is (it has no module script, so it needs no Vite input). All three land in `dist/` and `wwwroot/`.
- **Language:** one language shows at a time. `?lang=ar` or `?lang=en` chooses it; otherwise the page uses the site's saved language (`pl-lang`).
- **Page policy:** the only script is the one-line language setter, and its hash is added to the page policy automatically (`FrontendHostingExtensions`). Styles are inline, and fonts come from `/assets/fonts`.
- **Links to them:** the public site footer (privacy, terms), the product page footer (privacy, terms, cookies), the sign-in/sign-up screen ("By creating an account you accept the terms of use and the privacy policy"). Each legal page links to the other two.
- **Checks:** the end-to-end public-pages test opens privacy and terms in both languages (page policy, caching, no blocked resources or script errors, one language at a time); `frontend/e2e/legal-seo.spec.mjs` does the same for all three pages and checks robots, sitemap and the page heads.
- **Drafts not yet published** (owner and lawyer decisions): `hardening/legal-drafts/` (privacy P1, P3, P4, P6 periods, P7 objection and response time, P9 guardians, P12; terms T1, T2 guardians, T4, T5, T7, T8, T11–T13; the refund structure for future subscriptions).
## The owner's answers (21 November 2026)

- **Operator:** ParishLife ("ParishLife runs this service at parish-life.org").
- **Contact for privacy requests and questions:** `privacy@parish-life.org`. It needs Cloudflare Email Routing to the owner's inbox; see `docs/operations/email-delivery.md`.
- **Governing law:** Lebanon.
- **Minimum age for an account:** 13.
- **Effective date:** 21 November 2026.

Filled in from the code and setup rather than asked:
- **Records:** kept until the person or the parish asks for removal; nothing is deleted automatically.
- **Technical logs:** deleted after 90 days. This is the Application Insights retention to confirm in the Azure session; if it differs, change both pages.
- **Liability:** no limitation clause; the pages keep the plain statement that availability cannot be guaranteed.
- **Resend:** named as the email sender, because account emails now go out through it (`docs/operations/email-delivery.md`).

Georges was not consulted on this wording. Any change later: edit the page, keep English and Arabic in step, and update the effective date.

## Where each statement comes from (checked 19 November 2026; rows added 22 November 2026)

| Statement | Source in the code or setup |
| --- | --- |
| **Account data:** username, email, display name, language, colours and optional details. | `ParishUser`, `AccountProfile` |
| Password stored only as a one-way hash. | ASP.NET Core Identity hasher (`MfaAccountAccess`, `AccountPasswordService`) |
| Authenticator key and recovery codes stored protected. | `CosmosIdentityStore` (Data Protection) |
| Passkeys keep only the public key. | `AccountPasskey`, `docs/operations/account-sign-in-methods.md` |
| Google/Microsoft: a hashed subject; at sign-up, the provider-confirmed name and email. | `ExternalSignInService`, `ExternalIdentityClaims` |
| Sessions: when each started and how. | `AccountSession` |
| **Parish records:** people, households, sacraments, certificates, memberships, attendance, registrations, contributions, receipts, letters. | `Models/` (`Person*`, `Household*`, `Sacrament*`, `Certificate`, `Ministry*`, `Attendance*`, `Registration*`, `Contribution`, `GiftReceipt`, `RequestLetter`, `DocumentSignature`) |
| Sensitive records protected at rest, readable only by designated roles. | `PersonMedical`, `PastoralNote`, `Concern`, `Incident` (each `ProtectedContent`/`ProtectedReport`) |
| **Requests:** messages and files; guest name, contact and details. | `ParishRequest`, `RequestMessage`, `EvidenceFile`, `GuestRequestDto` |
| **Audit records.** | `AuditRecord` |
| **Anonymous daily site counts**, with no IP, device, visitor ID or search text. | `SiteMetric`, `SiteInsightsService` |
| **No advertising or analytics trackers.** | No analytics or advertising script in `frontend/` (searched for gtag, Google Analytics, App Insights JS, Clarity, Plausible, Matomo) |
| **Technical logs.** | `TelemetryExtensions` (Azure Monitor, only when `APPLICATIONINSIGHTS_CONNECTION_STRING` is set) |
| **Hosting:** Azure France Central (Cosmos DB, Blob Storage, Key Vault, Application Insights). | `docs/operations/frontend-hosting.md`; App Service `app-parishlife` in France Central |
| **Cloudflare:** DNS and Turnstile on sign-in, sign-up and public request forms. | `TurnstileProtected` on register, login, passkey options, contact verification, external sign-in/sign-up, guest requests |
| **Account emails through Resend only; no newsletters, SMS or online payments.** | `ResendContactCodeDelivery` (codes only); broadcast channels report NotConfigured; no payment provider |
| **Cookies:** session (8 h), anti-forgery, short-lived provider cookies. | `Program.cs` (`__Host-ParishLife`, `__Host-ParishLife.Csrf`), `AccountSessionService` (8 h), `ExternalSignInService` (`__Host-ParishLife.ExternalMfa`, at most 10 min), the Identity external cookie |
| **Browser storage:** language, reading preferences, screen choices; offline copy of public pages. | `lib/i18n.js`, `reading/EasyReading.jsx`, `portal/model/store.js`, `public/sw.js` |
| **Retention:** nothing deleted automatically. | `CapabilityService` ("No retention classes are approved") |
| **Backups:** 7 days point-in-time; deleted files recoverable 30 days. | Azure setup recorded by the Azure session (Cosmos continuous backup, blob soft delete) |
| **In-product rights:** own data per parish, closure request, profile corrections, password, sign-in methods, sessions. | `PersonDataService` (`me/data`, closure requests), `ProfileCorrection`, account routes |
| **Staff, clergy and operators use an authenticator.** | `StaffAppointmentAccess`, `ClergyAuthority`, `AccountDirectory.RequireOperatorAsync` |
| **Account also holds:** followed parishes, notification choices, private notes and to-dos (encrypted), drawn signature. | `ParishFollow`, `NotificationPreferences`, `PersonalWorkspaceItem`, `AccountSignature` |
| **More parish records:** date of birth, rite, address, occupation, skills, relationships, consents, formation, volunteering, date of death; children's pickup and evacuation rolls; prayer intentions; clergy signature images; facility renters; two-step recovery requests. | `Person`, `PersonFacts`, `PersonRelationship`, `PersonConsent`, `Formation*`, `Volunteer*`, `AuthorizedCollector`, `PresentRoster`, `Evacuation*`, `PrayerIntention`, `ClergySignatureImage`, `Renter`, `MfaRecoveryRequest` |
| **"Near me" location** is used to compute distances and not stored. | `PublicDirectoryService.NearbyAsync` |
| **Visit counts skip Do Not Track / Global Privacy Control**; the count sends the anti-forgery cookie. | `frontend/src/lib/beacon.js` |
| **Operators review reported messages.** | `MessageReport`, `docs/operations/communications.md` (N02) |
| **Resend also sends password-reset codes.** | `ResendContactCodeDelivery` (reset purpose), `docs/operations/account-*.md` |
| **Have I Been Pwned checks new passwords; only the first 5 characters of a one-way fingerprint are sent.** | `Identity/BreachedPasswordValidator.cs` (SHA-1 prefix, `Add-Padding`, on in Production only, fails open after 3 s) |
| **Self-service copy and closure; what closing deletes and keeps.** | `AccountClosureService` (`ExportAsync`, `CloseAsync`), `account-closure.jsx` |
| **Sign-up asks for the 13+ confirmation, no birth date.** | `RegisterAccountDto`, `Auth.jsx` (`ageConfirmed`) |
| **No AI.** | No model calls in the code (`hardening/PROJECT_MAP.md` section 12) |
| **Fonts:** the portal and product page are served from `/assets/fonts` (OFL); only printed sheets still load Google Fonts. | `frontend/public/assets/fonts/portal-fonts.css`, `index.html`, `landing.html`, `src/portal/shared/print.js` |
| **Every cookie and storage key** (cookie policy). | `hardening/legal-drafts/cookie-policy.md` section 1 |
