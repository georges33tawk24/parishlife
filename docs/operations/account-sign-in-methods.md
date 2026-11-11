# Passkeys, contact verification, external sign-in and Turnstile

Backend slices for X01 (passkeys), A06 (external sign-in, contact verification, email alias change) and X13 (optional Turnstile and the public capability endpoint). No account, Person, membership, provider credential or seed is created. Frontend integration is deferred. Local tests only; no live Cosmos, provider or Cloudflare acceptance was performed.

## Requirement basis and what is proposed

Read: `sections/S06.md` S06.05, S06.06, S06.11; `sections/S29.md` S29.18; `open-inputs-and-conflicts.md` U10, C08. Every detail there is a **proposed** recommendation, not owner-approved policy. The sources do not mention passkeys or Turnstile at all; the choices below are conservative implementation decisions recorded for review:

- **A passkey or linked external login is one sign-in factor, never MFA.** The existing MFA model means "authenticator code after a first factor" (`amr=mfa`) and many protected actions additionally require a fresh authenticator code. Nothing in the sources says a passkey satisfies MFA, so a passkey/external login replaces only the *password* step: MFA-enabled accounts still receive the normal five-minute authenticator challenge (completable with a code or a recovery code, unchanged), platform operators without MFA are refused, and only ordinary non-MFA members get a session, labelled `passkey`/`external` with the same authority a password session has.
- Registering/removing a passkey and changing the sign-in email use the existing password-change rule: personal capacity only (no `X-ParishLife-Appointment`), never a recovery cookie, MFA accounts need an MFA session **plus** fresh password and authenticator code; non-MFA members prove the current password. Linking an external provider additionally requires the account to have MFA enabled (proposed S06.06 "account-link verification").
- S06.11 "cannot remove the only usable sign-in method": every account currently has a password, so removal is allowed; a defensive guard refuses removing the last method if an account ever has no password and no other method.
- S06.06: provider login never merges by a claimed email. Only the provider's stable `sub` is used (stored as a SHA-256 hash); provider email claims are ignored.
- S06.05/U10: contact stays unverified until a real challenge succeeds. Without a configured delivery provider nothing is generated or claimed sent.

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

Providers `google` and `microsoft` exist only when `ExternalSignIn:<provider>:ClientId` **and** `ClientSecret` are configured (App Service settings / Key Vault references; never `appsettings.json`). Unconfigured providers have no authentication scheme: capability reports `Available=false` and routes return 404 `external_provider_unavailable`. Configured providers use the shared-framework OAuth handler with PKCE, the documented public authorization/token/OpenID userinfo endpoints, scope `openid`, and map only `sub`. Provider callback path: `/api/auth/external/callback/<provider>` (register this redirect URI with the provider).

- `POST /api/auth/external/{provider}/link` (`LinkExternalLoginDto`, MFA account + MFA session + fresh proofs) → provider redirect. The account, session ID and stamp hash ride in the protected state; completion rechecks the stored MFA session, claims the unique `external:<provider>:<subject hash>` index and commits the link (one per provider).
- `POST /api/auth/external/{provider}/sign-in` (anonymous, Turnstile when configured) → provider redirect; `GET /api/auth/external/complete` resolves only a linked subject. Unlinked → 401 `external_login_not_linked`; no account/Person/membership is created.
- `GET /api/auth/external`, `POST /api/auth/external/{provider}/unlink` (`UnlinkExternalLoginDto`, fresh proofs; new stamp; sign-out).

`complete` currently returns JSON; the deferred frontend decides the final browser redirect. Apple is not implemented. No provider app registration or secret exists in this repository.

## Turnstile and capability (X13)

`Turnstile:SiteKey` + `Turnstile:SecretKey` (secret via App Service/Key Vault reference) enable enforcement; otherwise behaviour is unchanged. Optional `Turnstile:ExpectedHostname`. Protected public endpoints: `register`, `login`, `login/passkey/options`, `contact-verification`, `external/{provider}/sign-in`. Clients send the widget token in `X-Turnstile-Token`; the API posts secret/token/remote IP to Cloudflare siteverify through the named `Turnstile` HttpClient (10 s timeout). Missing/failed token → 400 `turnstile_failed`; verifier unreachable → 503 `turnstile_unavailable` (fail closed). Secrets/tokens are never logged. Guest intake (Q08) is not covered by this card.

`GET /api/auth/capabilities` (anonymous, no-store) returns `AuthenticationCapabilitiesDto`: PasswordSignIn, Registration, Passkeys, ExternalProviders[{Provider, Available}], Turnstile {Enabled, SiteKey (only when enabled), Header}, ContactVerificationDelivery, ManualIdentityReview. It never returns secrets.

## Verification

Focused local tests (`PasskeyTests` 6, `AccountContactTests` 6, `AuthenticationCapabilityTests` 2) drive real Identity, Data Protection, isolated local storage and HTTP/CSRF: a fixture software authenticator (P-256, "none" attestation), a fake OAuth backchannel for the full provider redirect/callback/complete round trip, a captured contact-code channel and a fake siteverify handler. They do not prove live Cosmos transactions, real browsers/authenticators, real provider apps, Cloudflare or email delivery.
