# Passkeys, contact verification, external sign-in and Turnstile

Slices for X01 (passkeys), A06 (external sign-in and sign-up, contact verification, email alias change) and X13 (optional Turnstile and the public capability endpoint). No Person, membership, provider credential or seed is created; the only account ever created here is one a person signs up for with Google or Microsoft. The portal screens for all of them are built (`frontend/src/portal/shell/Auth.jsx`, `features/account/`). Local tests only; no live Cosmos or real provider acceptance was performed (Turnstile is live since 19 November 2026).

## Requirement basis and what is proposed

Read: `sections/S06.md` S06.05, S06.06, S06.11; `sections/S29.md` S29.18; `open-inputs-and-conflicts.md` U10, C08. Every detail there is a **proposed** recommendation, not owner-approved policy. The sources do not mention passkeys or Turnstile at all; the choices below are conservative implementation decisions recorded for review:

- **A passkey or linked external login is one sign-in factor, never MFA.** The existing MFA model means "authenticator code after a first factor" (`amr=mfa`) and many protected actions additionally require a fresh authenticator code. Nothing in the sources says a passkey satisfies MFA, so a passkey/external login replaces only the *password* step: MFA-enabled accounts still receive the normal five-minute authenticator challenge (completable with a code or a recovery code, unchanged), platform operators without MFA are refused, and only ordinary non-MFA members get a session, labelled `passkey`/`external` with the same authority a password session has.
- Registering/removing a passkey and changing the sign-in email use the existing password-change rule: personal capacity only (no `X-ParishLife-Appointment`), never a recovery cookie, MFA accounts need an MFA session **plus** fresh password and authenticator code; non-MFA members prove the current password. Linking an external provider additionally requires the account to have MFA enabled (proposed S06.06 "account-link verification").
- S06.11 "cannot remove the only usable sign-in method": accounts made by Google/Microsoft sign-up have no password, so this guard is now live. Unlinking a provider that is the account's only method (no password, no passkey, no other provider) answers 409 `last_sign_in_method`, checked before any proof is asked for and again on the proven account state.
- S06.06: provider login never merges by a claimed email. Only the provider's stable `sub` is used (stored as a SHA-256 hash). **Owner decisions, 19 November 2026 (approved policy, OWNER-QUESTIONS #21):**
  - (a) Signing up with Google or Microsoft creates an account with **no password**; the person can add one later in My account.
  - (b) A **provider-verified** email counts as a **confirmed** email, so these accounts sign in without an email code. It is never used to merge: if any account already holds that email, nothing is created (`email-in-use`).
  - (c) Google and Microsoft now; Apple later (it needs the paid Apple Developer Program and a `form_post` callback).
- S06.05/U10: contact stays unverified until a real challenge succeeds. Without a configured delivery provider nothing is generated or claimed sent. The one exception is (b): an email the provider itself verified.

## Passkeys (X01)

Uses ASP.NET Core Identity's built-in WebAuthn handler (`IPasskeyHandler<ParishUser>`; no new package). `CosmosIdentityStore` implements `IUserPasskeyStore`; passkeys (credential ID, COSE public key, sign count, flags, name, dates) live on the account document, max 10. A unique credential index (`LoginAliases`, partition `passkey:<sha256>`) blocks one credential on two accounts; it is claimed before the account commit and released on rollback/removal. User verification is `required`. Origin validation is the framework default (the request `Origin` must equal the client-data origin, no cross-origin); `Passkeys:ServerDomain` optionally overrides the RP ID (default: request host).

| Endpoint | Behaviour |
| --- | --- |
| `GET /api/auth/passkeys` | Safe list (ID, name, created, last used, backed up). No public key/sign count. |
| `POST /api/auth/passkeys/registration/options` | `BeginPasskeyRegistrationDto` (fresh proofs) → `PasskeyCeremonyDto` { State, OptionsJson, ExpiresAt }. |
| `POST /api/auth/passkeys/registration` | `CompletePasskeyRegistrationDto` { OperationId, State, Credential JSON, Name }. Exact retry returns the same passkey; reuse with different input → `operation_reused`. |
| `POST /api/auth/passkeys/{id}/remove` | `RemovePasskeyDto` (fresh proofs). New security stamp, sign-out; other sessions end. |
| `POST /api/auth/login/passkey/options` | Anonymous discoverable-credential options (no identifier → no account enumeration). Turnstile-protected when configured. |
| `POST /api/auth/login/passkey` | 200 + cookie (non-MFA member), 202 `{requiresTwoFactor, challenge}` (MFA account), else 401. |

Ceremony state is Data Protection–protected (purpose `ParishLife.Identity.PasskeyCeremony.v1`), five-minute, purpose-bound; registration state is bound to account, session ID and security stamp. Each login state carries a nonce consumed in the same account-partition batch as the session or challenge, so a captured assertion cannot be replayed even when the authenticator never increments its counter. Sign-count/last-used updates commit with that batch. Fingerprints/receipts/audit contain no credentials or attestation data.

## Contact verification and email change (A06)

`IContactCodeDelivery` is the provider boundary; the registered `UnconfiguredContactCodeDelivery` reports `Configured=false` and sends nothing. **No email provider is configured, so in this deployment codes cannot be delivered and these flows cannot complete** — the capability endpoint reports `ContactVerificationDelivery: NotConfigured` and the office/manual identity review remains the route (U10). Wiring a real provider (Azure Communication Services or another approved channel) is a separate decision.

- `POST /api/auth/contact-verification` (anonymous, Turnstile when configured): neutral 202 for every address. For an active unconfirmed account and a configured provider, a six-digit code (15 minutes, 5 attempts, one-minute resend throttle) is handed to the provider and only its hash is stored (`contactVerification:ConfirmEmail` in the account partition, `Delivery=Accepted` meaning provider acceptance, not receipt).
- `POST /api/auth/contact-verification/confirm`: correct code sets `EmailConfirmed` atomically with the verification record; the account can then sign in (current rule: sign-in requires confirmed email or recorded identity review). S06.05's proposed "may authenticate while unverified" is **not** adopted here; that conflicts with the existing sign-in rule and needs an owner decision.
- `POST /api/auth/email-change` (`BeginEmailChangeDto`, fresh proofs): without a provider → 503 `contact_delivery_unavailable`, nothing stored. Otherwise the code goes only to the **new** address; the old email stays the active alias.
- `POST /api/auth/email-change/confirm` (`ConfirmEmailChangeDto`: change ID, code, fresh proofs): claims the new email (and username when it equalled the email) aliases, commits email/confirmed/username/new security stamp and the completed record together, then releases the old aliases and signs out. A taken address → `email_unavailable`; a stale account version → `write_conflict`; both release any claimed alias and change nothing. Replays return `AlreadyApplied`.

Not implemented: phone contacts, standalone username rename, password reset via verified contact, notifications of identity changes (no delivery), and resend/expiry UI.

## External sign-in (A06)

Providers `google` and `microsoft` exist only when configured (App Service settings / Key Vault references; never `appsettings.json`):

| Setting | Google | Microsoft |
| --- | --- | --- |
| `ExternalSignIn:<provider>:ClientId` | required | required |
| `ExternalSignIn:<provider>:ClientSecret` | required (Key Vault reference) | only without the assertion below |
| `ExternalSignIn:microsoft:UseManagedIdentityAssertion` | — | `true`: no secret at all (see below) |

Unconfigured providers have no authentication scheme: capability reports `Available=false` and routes return 404 `external_provider_unavailable`. Configured providers use the framework OAuth handler (`ExternalOAuthHandler`, a subclass) with PKCE, the documented public authorization/token/OpenID userinfo endpoints and scopes `openid email profile`. Callback path: `/api/auth/external/callback/<provider>` (register this redirect URI with the provider). Google is registered for `https://parish-life.org` only (`azurewebsites.net` is a public suffix Google refuses); Microsoft for both hostnames, audience "any organizational directory and personal Microsoft accounts".

**Which provider emails count as verified** (`Identity/ExternalIdentityClaims.cs`; unit-tested):
- Google: the userinfo `email` only when `email_verified` is true.
- Microsoft says not to trust its `email` claim. It counts only when the ID token says `tid` = `9188040d-6c67-4c5b-b112-36a304b66dad` (a personal Microsoft account, whose address Microsoft verified) **or** the optional claim `xms_edov` (email domain owner verified) is true. The app registration must request the optional ID-token claims `email` and `xms_edov`. The ID token comes straight from the token endpoint over TLS in the back channel, so, as OpenID Connect Core 3.1.3.7 (6) allows, TLS stands in for the signature check; its audience (this client), issuer (`https://login.microsoftonline.com/<tid>/v2.0`), expiry and subject (equal to the userinfo `sub`) are still checked. Anything else gives no verified email.

**Routes:**
- `POST /api/auth/external/{provider}/sign-in` (anonymous, Turnstile, rate-limited) → provider redirect; completion resolves only a linked subject. Unlinked → 401 `external_login_not_linked` / portal `not-linked`; nothing is created.
- `POST /api/auth/external/{provider}/sign-up` (anonymous, Turnstile, rate-limited) → provider redirect. On completion:
  - a subject that is already linked simply signs in (`signed-in`);
  - no provider-verified email → 409 `external_email_not_verified` / `not-verified`, nothing created (decision: refuse rather than make an unconfirmed account; with no email sender such an account could never sign in);
  - an email or username alias already held by **any** account (active or a pending registration) → 409 `external_email_in_use` / `email-in-use`, nothing created and nothing linked (never merge; the person signs in normally and links the provider from My account);
  - otherwise a new account: username and email = the verified email, `EmailConfirmed = true`, display name from the provider (else the part before `@`), **no password**, the external login on the account document from the start. The `external:<provider>:<subject hash>` index, then the username and email aliases are claimed for the new ID in the registration pattern (pending account, aliases, activation); a failure at any step releases every claimed index. A normal member session (`amr=external`) is issued and the portal gets `signed-up`. No Person, membership or capacity is created.
- `POST /api/auth/external/{provider}/link` and the `link/ticket` + `link/redirect` pair (MFA account + MFA session + fresh proofs) → provider redirect; completion rechecks the stored MFA session, claims the unique external index and commits the link (one per provider).
- `GET /api/auth/external`, `POST /api/auth/external/{provider}/unlink` (`UnlinkExternalLoginDto`, fresh proofs; new stamp; sign-out; `last_sign_in_method` as above).
- `POST /api/auth/password/add` (`AddAccountPasswordDto` { OperationId, NewPassword, CurrentCode only with an authenticator }) gives a passwordless account its first password. There is no current password to prove, so the proof is that **this session** came from a Google/Microsoft sign-in within the last 10 minutes (`fresh_external_sign_in_required` otherwise: sign out and in again). An account that already has one gets 409 `password_exists`. The new security stamp ends every session; the password and the provider both sign in afterwards. A passwordless account must add a password before it can enrol an authenticator, add a passkey or link a second provider, since those prove the current password.

`GET /api/auth/me` reports `hasPassword`. A portal round trip (`returnTo=portal`) ends on `/index.html?external=` plus one word: `signed-in`, `signed-up`, `two-factor`, `linked`, `not-linked`, `in-use`, `email-in-use`, `not-verified` or `failed`; the JSON form answers with the same codes as problem titles.

**Microsoft without a secret.** With `UseManagedIdentityAssertion=true`, the code is redeemed with `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer` and `client_assertion` = a token of the app's user-assigned managed identity `id-parishlife` for `api://AzureADTokenExchange/.default`, instead of `client_secret` (tested: no secret is sent, PKCE is kept). The app registration needs a federated identity credential: issuer `https://login.microsoftonline.com/<tenant>/v2.0`, subject = the managed identity's **object (principal) ID**, audience `api://AzureADTokenExchange`. **Not verified:** Microsoft's documentation (checked 19 November 2026) does not say whether a managed-identity federated credential is accepted when the code of a **personal** Microsoft account is redeemed at the `common` endpoint; it requires only that the app registration and managed identity share a tenant. This must be tested live with a personal account once the registration exists. If the token endpoint refuses it (an `AADSTS` error at the callback, logged without the assertion), set `UseManagedIdentityAssertion=false` and a Key Vault-referenced `ClientSecret` instead; no code change is needed. Locally, the developer credential cannot produce this assertion, so local Microsoft tests use a secret or the test stand-in.

Known limit: someone who registered with email and password but never confirmed the email (no email sender exists yet) cannot sign in, and sign-up with that email answers `email-in-use`. That is the never-merge rule working as decided; it resolves once email delivery exists. Apple is not implemented. No provider app registration or secret exists in this repository.

## Turnstile and capability (X13)

`Turnstile:SiteKey` + `Turnstile:SecretKey` (secret via App Service/Key Vault reference) enable enforcement; otherwise behaviour is unchanged. Optional `Turnstile:ExpectedHostname`. Protected public endpoints: `register`, `login`, `login/passkey/options`, `contact-verification`, `external/{provider}/sign-in`, `external/{provider}/sign-up` (the external posts take the token as the `turnstileToken` form field). Clients send the widget token in `X-Turnstile-Token`; the API posts secret/token/remote IP to Cloudflare siteverify through the named `Turnstile` HttpClient (10 s timeout). Missing/failed token → 400 `turnstile_failed`; verifier unreachable → 503 `turnstile_unavailable` (fail closed). Secrets/tokens are never logged. Since 19 November 2026 the anonymous guest request form (`POST /api/public/parishes/{id}/requests`, Q08) is protected too: the public request page already sent the token, but the API did not check it. The later guest steps (tracking, messages, files) use the private tracking token and are not bot-checked.

**Frontend:** the sign-in screen and the public request page show the widget only when `auth/capabilities` reports Turnstile on (`frontend/src/lib/turnstile.js`). A token works once, so the screen fetches a fresh check after every attempt, including after the password step. A press before the check has finished shows "Complete the check first." instead of sending a request the API would refuse. The page Content-Security-Policy allows `challenges.cloudflare.com` for the script, the frame and verification.

**Production setup (`parish-life.org`), each step with the owner's go-ahead in the Azure session:**
1. In Cloudflare (the account that holds `parish-life.org`), go to Turnstile and add a widget:
   - name "ParishLife";
   - mode "Managed";
   - hostnames `parish-life.org` and `app-parishlife-gxcjhmgqagd7hhg0.francecentral-01.azurewebsites.net`, so sign-in also works on the old address.

   Note the site key (public) and the secret key.
2. Store the secret key only in Key Vault `keyvault-parishlife`, as secret `turnstile-secret-key`: never in Git, chat or `appsettings.json`.
3. Let the app read it: grant the user-assigned identity `id-parishlife` "Key Vault Secrets User" on that secret (or the vault). This is an RBAC change. Then set the App Service `keyVaultReferenceIdentity` to that identity.
4. App settings:
   - `Turnstile__SiteKey` = the site key;
   - `Turnstile__SecretKey` = `@Microsoft.KeyVault(SecretUri=https://keyvault-parishlife.vault.azure.net/secrets/turnstile-secret-key/)`.

   Leave `Turnstile__ExpectedHostname` empty while both hostnames are allowed. The widget's hostname list already limits where tokens can be made. Use `-o none` so values are not echoed.
5. Check:
   - `GET /api/auth/capabilities` shows `turnstile.enabled: true` with the site key, and the Key Vault reference shows as resolved in the portal;
   - the sign-in page on `parish-life.org` shows the check, and sign-in with password and authenticator works;
   - a `POST /api/auth/login` without `X-Turnstile-Token` returns 400 `turnstile_failed`;
   - Application Insights shows no `turnstile_unavailable` responses.
6. **Rollback:** remove the two `Turnstile__*` settings. Enforcement stops after the restart, and nothing else changes.

**Live since 19 November 2026.**
- These steps were followed, with one difference: the widget was created with Cloudflare's "Set up with Spin" dashboard flow. Skip Spin's agent prompt, because the code is already here.
- Spin may add `localhost` and `127.0.0.1`. Keep them off the live widget. Its list was confirmed on 19 November: the two hostnames above only.
- Storing the secret needed "Key Vault Secrets Officer" for the person who stores it.
- The owner's real sign-in through the widget passed.
- Record: "Turnstile switched on" in `docs/operations/frontend-hosting.md`.

**Tests:**
- `AuthenticationCapabilityTests` uses a fake verifier: tokens refused on every protected endpoint (including the guest form), the secret posted only to the verifier, fail-closed outage.
- The browser tests (`npm run e2e`) run with Cloudflare's published test keys: the site key `1x00000000000000000000AA` always passes, and its secret is accepted by the real siteverify. Every sign-in goes through the real widget and the real Cloudflare check under the page policy.
- That test secret accepts any token, so forged-token refusal is proven by the backend test, not the browser test. `E2E_TURNSTILE=0` runs the browser tests without Turnstile.

`GET /api/auth/capabilities` (anonymous, no-store) returns `AuthenticationCapabilitiesDto`: PasswordSignIn, Registration, Passkeys, ExternalProviders[{Provider, Available}], Turnstile {Enabled, SiteKey (only when enabled), Header}, ContactVerificationDelivery, ManualIdentityReview. It never returns secrets.

## Verification

Focused local tests (`PasskeyTests` 6, `AccountContactTests` 6, `AuthenticationCapabilityTests` 2) drive real Identity, Data Protection, isolated local storage and HTTP/CSRF: a fixture software authenticator (P-256, "none" attestation), a fake OAuth backchannel for the full provider redirect/callback/complete round trip, a captured contact-code channel and a fake siteverify handler. Sign-up adds `ExternalSignUpTests` (4: one passwordless confirmed account then sign-in by the same subject; never merge and unverified email create nothing; the only method cannot be unlinked, adding a password needs a sign-in within 10 minutes, then the password works and unlinking is allowed; Microsoft redeems with the managed-identity assertion and no secret, personal account or `xms_edov` only) and the unit tests `ExternalIdentityClaimsTests` (7). They do not prove live Cosmos transactions, real browsers/authenticators, real provider apps, Cloudflare or email delivery.
