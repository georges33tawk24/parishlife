# Privacy policy and terms of use

Approved by the owner on 21 November 2026 (effective that day; the draft banner is removed): `frontend/privacy.html` and `frontend/terms.html`. Once deployed, they are served by the API at `https://parish-life.org/privacy.html` and `https://parish-life.org/terms.html`. Google needs them before the OAuth app can go "In production", and Microsoft wants the same links on its app registration.

- **What they are:** static pages in English and Arabic, with no sign-in. Built as Vite inputs, so they land in `dist/` and `wwwroot/`.
- **Language:** one language shows at a time. `?lang=ar` or `?lang=en` chooses it; otherwise the page uses the site's saved language (`pl-lang`).
- **Page policy:** the only script is the one-line language setter, and its hash is added to the page policy automatically (`FrontendHostingExtensions`). Styles are inline, and fonts come from `/assets/fonts`.
- **Links to them:** the public site footer, and the sign-in/sign-up screen ("By creating an account you accept the terms of use and the privacy policy"). Each page links to the other.
- **Checks:** the end-to-end public-pages test opens both pages in both languages. It checks the page policy and caching, that there are no blocked resources or script errors, that the draft banner is visible, and that one language shows at a time.

## The owner's answers (21 November 2026)

- **Operator:** ParishLife ("ParishLife runs this service at parish-life.org").
- **Contact for privacy requests and questions:** `privacy@parish-life.org`. It needs Cloudflare Email Routing to the owner's inbox; see `docs/operations/notification-delivery.md`.
- **Governing law:** Lebanon.
- **Minimum age for an account:** 13.
- **Effective date:** 21 November 2026.

Filled in from the code and setup rather than asked:
- **Records:** kept until the person or the parish asks for removal; nothing is deleted automatically.
- **Technical logs:** deleted after 90 days. This is the Application Insights retention to confirm in the Azure session; if it differs, change both pages.
- **Liability:** no limitation clause; the pages keep the plain statement that availability cannot be guaranteed.
- **Resend, push services and Meta (WhatsApp):** named as the services that carry outside messages (`docs/operations/notification-delivery.md`). The push and WhatsApp lines were added the same day, when those channels were built.

Georges was not consulted on this wording. Any change later: edit both files, keep English and Arabic in step, and update the effective date.

## Where each statement comes from (checked 19 November 2026)

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
| **Google Fonts** on the portal and product pages. | `index.html`, `landing.html`, `src/portal/shared/print.js` |
| **Resend emails:** codes, plus copies of notices and broadcasts for people who keep email on; no marketing, SMS or online payments. | `ResendEmailSender`, `EmailDeliveryChannel`; no SMS channel or payment provider |
| **Push services** carry encrypted push messages to devices the person turned on. | `WebPushSender` (RFC 8291 encryption), `PushDeliveryChannel` |
| **Meta (WhatsApp)** gets the number and the short title, only after the person proves the number and keeps WhatsApp on. | `WhatsAppSender`, `WhatsAppDeliveryChannel`, `NotificationChannelService` |
| **How you chose to be reached** is stored: channel choices, push device addresses, the proven WhatsApp number; the code is kept only hashed, until used. | `NotificationPreferences`, `PushDevice`, `WhatsAppContact` |
| **Cookies:** session (8 h), anti-forgery, short-lived provider cookies. | `Program.cs` (`__Host-ParishLife`, `__Host-ParishLife.Csrf`), `AccountSessionService` (8 h), `ExternalSignInService` (`__Host-ParishLife.ExternalMfa`, at most 10 min), the Identity external cookie |
| **Browser storage:** language, reading preferences, screen choices; offline copy of public pages. | `lib/i18n.js`, `reading/EasyReading.jsx`, `portal/model/store.js`, `public/sw.js` |
| **Retention:** nothing deleted automatically. | `CapabilityService` ("No retention classes are approved") |
| **Backups:** 7 days point-in-time; deleted files recoverable 30 days. | Azure setup recorded by the Azure session (Cosmos continuous backup, blob soft delete) |
| **In-product rights:** own data per parish, closure request, profile corrections, password, sign-in methods, sessions. | `PersonDataService` (`me/data`, closure requests), `ProfileCorrection`, account routes |
| **Account deletion only by request.** | `CosmosIdentityStore.DeleteAsync` refuses ("requires the retention and ownership review workflow") |
| **Staff, clergy and operators use an authenticator.** | `StaffAppointmentAccess`, `ClergyAuthority`, `AccountDirectory.RequireOperatorAsync` |
