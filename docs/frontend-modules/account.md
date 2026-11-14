# Account module

Sign-in and My account, connected to `ParishLife.Api` (`Controllers/Accounts`). Updated **11 November 2026**.

Files: `frontend/src/portal/shell/Auth.jsx`, `features/account/*` (`account.jsx`, `account-security.jsx`, `account-mfa.jsx`, `account-passkeys.jsx`, `account-sessions.jsx`), `model/passkeys.js`, `model/account.js` (one function per route) and `model/modules/account.js` (loads the saved appearance after every sign-in and reload). Check: `frontend/scripts/checks/account.mjs`.

## Routes used

| Area | Routes | Notes |
| --- | --- | --- |
| What is on offer | `GET /api/auth/capabilities` | Passkeys, email codes and external providers appear only when this says so (see below). |
| Email code (sign-in page) | `POST /api/auth/contact-verification` (bot check), `POST /api/auth/contact-verification/confirm` | Offered when `contactVerificationDelivery` is `ProviderConfigured`: after sign-up, and from "Verify my email with a code" on sign-in. The reply is neutral by design, so the screen says "if an account is waiting, a code is on its way". |
| Passkey sign-in | `POST /api/auth/login/passkey/options` (bot check), `POST /api/auth/login/passkey` | `optionsJson` goes to the browser's WebAuthn; the credential goes back as a JSON string. Browsers without `parse…FromJSON` / `toJSON` use the converters in `model/passkeys.js`. An account with two-factor continues to the authenticator-code step. Shown when `passkeys: true` and the browser supports WebAuthn. |
| External sign-in | `POST /api/auth/external/{provider}/sign-in` | A form post with the anti-forgery token as a form field. Shown for each provider with `available: true`, only while the bot check is off (see decisions). |
| Profile and appearance | `GET`/`PUT /api/auth/profile`, `POST …/appearance/preview`, `POST …/appearance/reset` | Updates send `operationId` and the profile `version`. Preview asks the API for checked colours and contrast, applies the theme without saving, and shows the contrast ratios. Reset keeps name and language. |
| Password | `POST /api/auth/password` | Current password (+ authenticator code with two-factor). The API signs every session out. |
| Email change | `POST /api/auth/email-change`, `POST …/email-change/confirm` | Two steps (code to the new address). Offered only with a delivery provider. Signs every session out. |
| Two-factor | `GET /api/auth/mfa/status`, `POST …/mfa/enrollment`, `POST …/mfa/enrollment/complete`, `POST …/mfa/recovery-codes` | Staged proof: key shown, then a code from the new app, with the current password (and current code if two-factor is already on). Recovery codes are shown once; the API then signs every session out. |
| Passkeys | `GET /api/auth/passkeys`, `POST …/registration/options`, `POST …/registration`, `POST …/{credentialId}/remove` | Adding and removing need the current password (+ code). Removing signs every session out. |
| Sessions | `GET /api/auth/sessions`, `POST …/sessions/{id}/revoke` | Active sessions, this one marked. |
| Account | `GET /api/auth/me` | Username, email, whether the email is confirmed. |
| My parishes | `GET /api/me/parishes`, `POST`/`DELETE /api/parishes/{id}/follow`, `PUT …/primary`, `GET /api/public/parishes` | Follow, unfollow (not for a member) and make primary. |

After any change that signs every session out, the page stores a notice and reloads, so the person lands on sign-in with the reason.

## Added on fullstack2-account (14 November 2026)

This supersedes the matching items under "Fields with no API equivalent" below.

| Area | Routes | Notes |
| --- | --- | --- |
| Profile details | `GET`/`PUT /api/auth/profile` | Optional first/last name and town with Arabic twins, address, occupation, about. Private to the holder; they never change a Person. Every save sends all details (blank clears one); appearance reset keeps them. |
| My signature | `GET`/`POST /api/account/signature`, `POST …/remove` | The holder's own signature image (an SVG path of M/L/Q segments, a title and an Arabic title). Versioned, idempotent, absent from receipts and audit. An image only: it signs nothing, and no passkey is involved. |
| My parish records | `GET /api/account/records`; corrections `POST /api/parishes/{id}/profile-corrections` | Only the account's own active link in each followed parish (given and family name, birth date, contact) with its own corrections. Corrections use the existing office review (four fields; names and birth date need evidence). |
| Membership request | `POST /api/parishes/{id}/membership-requests` (`…/mine` in the model) | "Request membership" in My parishes opens the form: given and family name required; birth date, contact, town and note optional. |
| External sign-in | `POST …/{provider}/sign-in` with `returnTo=portal` and `turnstileToken` form fields; `GET …/complete?return=portal`; `POST …/pending-challenge`; `POST …/{provider}/link/ticket`, then a form post to `…/link/redirect` | A portal round trip ends on `/index.html?external=` plus one word: `signed-in`, `two-factor`, `linked`, `not-linked`, `in-use` or `failed`. Nothing secret is in the address. The MFA challenge is held in a protected HttpOnly Strict cookie and handed over once. Linking checks the password (and code) over JSON first; a two-minute ticket, bound to the account, session, security stamp and provider, then starts the redirect. Unconfigured providers still answer `external_provider_unavailable`. |

### Still not connected

- **Link and unlink buttons in My account.** The API routes exist and are tested (`link/ticket`, `link/redirect`, `unlink`, `GET auth/external`), but the My account panel for them was not built in this pass.
- **QR code for the authenticator key.** Not built: the frontend has no QR library, and adding a dependency or a hand-written encoder needs a decision and review. The key and the `otpauth://` link remain.
- **Earlier requests.** The tracking-link claim (`POST …/requests/{id}/claim`) is unchanged: the proof is the private tracking token, followed by office approval. A list of the account's pending claims is not built here, because it overlaps the requests area's "pending claims". Matching by a typed email is deliberately not offered.
- **Arabic twins on the membership request** (`GivenNameAr`, `FamilyNameAr`, `LocalityAr`). Not added: `MembershipService` belongs to the people area.
- **Records without a follow.** Records list only the parishes the account follows, as My parishes does, so a link created without a follow is not found.

### Owner questions (account)

1. U05: may a stored signature image ever appear on certificates or letters? Who may keep one? For now, any normal personal sign-in may.
2. Should parish offices ever see the self-described profile details? For now, never.
3. Should pending tracking-link claims be listed on My account, and with what detail?

## Fields with no API equivalent

- First name, last name, town, address, occupation and "about me" on the old profile form: the API profile is a display name, a preferred language (`en`, `fr`, `ar`) and the colours. Those fields are not shown.
- "Request membership" in My parishes: the API's request needs given and family name, birth date and contact (`RequestMembershipDto`), which this page does not have. The button is not shown; the panel says so. It belongs with the member module.
- Listing, linking and unlinking an external provider (`GET /api/auth/external`, `/{provider}/link`, `/{provider}/unlink`), the "lost authenticator" recovery requests (`/api/auth/mfa/recovery-requests`) and sign-in with a recovery code (`/api/auth/login/mfa/recovery`) are not built. Linking needs a JSON body that a browser form post cannot send.
- The authenticator key is shown as text and an `otpauth://` link; there is no QR image.
- The "My signature", "My parish records" and "Requests made before signing in" parts of the page still call the old server (`account/signature`, `account/records`, `account/guest-requests`). They stay hidden until their own modules (sacraments, people, requests) connect them.
- `PREFS` in `model/data.js` is the settings screens' store, not the account's, and is left to the administration module. The account's saved appearance and language are in `session.preferences`.
- An account with no parish never runs the module `load`, so its saved colours apply only after it opens My account.

## Open decisions for the owner

1. **External sign-in cannot finish in the frontend as the backend stands.**
   - The bot-check header cannot travel on a browser form post, so the buttons are hidden when Turnstile is on.
   - The provider returns to `GET /api/auth/external/complete`, a fixed API URL that answers with JSON. The person lands on that JSON (signed in if the account has no two-factor); an account with two-factor never receives its challenge. A return address on a frontend page, and a bot-check form field, would fix both.
   - Linking a provider must also be done outside this frontend until the API accepts a form post or a JSON-capable redirect.
2. **Email codes need a delivery provider** (`contactVerificationDelivery`). Without one, sign-up shows the earlier "once verified" message and Change email is explained instead of offered.
3. **Unverified accounts** get a neutral 401 on sign-in, so the sign-in page cannot tell the person to verify; it offers the code link whenever delivery is configured.
4. **Preferred language `fr`** can be stored, but the portal has English and Arabic only. The saved language is not applied automatically.

## Verified

- `npm ci`, `npm run format:check`, `npm run check` (including `scripts/checks/account.mjs`) and `npm run build` pass in `frontend/`.
- The check asserts the exact JSON sent for every route above against a stand-in API, including the WebAuthn conversion, the two-step flows and the capability gates.
- A browser run with a mocked API showed the passkey, Google and "verify email" controls on sign-in, the code request, and every section of My account without script errors.
- Not verified against a running API: a verified account needs the interactive operator commands (`frontend/README.md`). Real passkeys, email delivery and Google or Microsoft sign-in were not exercised.
