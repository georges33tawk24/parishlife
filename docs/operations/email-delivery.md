# Account email through Resend

ParishLife sends two kinds of email, both one-use codes valid for 15 minutes:
- a code to confirm the email address of a new account (registration with email and password);
- a code to confirm a new sign-in email (change of email).

Owner decision (19–21 November 2026): Resend, from `ParishLife <no-reply@parish-life.org>`. Nothing else is emailed: no newsletters or notifications yet.

## How it works

- `Services/Accounts/ResendContactCodeDelivery.cs` sends one `POST https://api.resend.com/emails` per code, with the API key as a bearer token.
  - The email is in English, then Arabic. The code is the only variable part; no other account detail is included.
  - "Sent" means Resend accepted the email (any 2xx answer). That is not proof it arrived.
  - On a refusal, only the HTTP status is logged. The code and the key are never logged or stored.
- It is used only when all three settings are present; otherwise `UnconfiguredContactCodeDelivery` stays, and nothing is sent.

| App Service setting | Value |
| --- | --- |
| `Email__Provider` | `Resend` |
| `Email__ResendApiKey` | `@Microsoft.KeyVault(SecretUri=https://keyvault-parishlife.vault.azure.net/secrets/resend-api-key/)` |
| `Email__From` | `ParishLife <no-reply@parish-life.org>` |

- With them set, `GET /api/auth/capabilities` reports `contactVerificationDelivery: ProviderConfigured`.
- The sign-in page then offers "Verify my email with a code". After registering, the portal asks for the code.
- **This also fixes the earlier dead end:** a person who registered with email and password can now confirm the email and sign in.

## Setup (owner, then the Azure session; each step with the owner's go-ahead)

1. **Resend account** (owner): sign up at resend.com. Add the domain `parish-life.org` and choose the sending region Resend offers.
2. **DNS in Cloudflare:** add exactly the records Resend shows. Usually:
   - a DKIM `TXT` at `resend._domainkey`;
   - an `MX` and an SPF `TXT` on the `send` subdomain.

   Records added for Resend must be **DNS only** (grey cloud). Then press Verify in Resend.
3. **API key** (owner): create one in Resend with "Sending access" restricted to `parish-life.org`. Store it **only** in Key Vault `keyvault-parishlife` as `resend-api-key`: never in Git, chat or files.
4. **Access** (Azure session): grant `id-parishlife` "Key Vault Secrets User" on that secret only. This is an RBAC change.
5. **Settings** (Azure session): add the three settings above, check the Key Vault reference shows `Resolved`, and restart.
6. **Live test:** register a new account with a real inbox, request the code, confirm it, sign in.

## privacy@parish-life.org (for the privacy and terms pages)

Resend only sends. To receive at `privacy@parish-life.org`, turn on Cloudflare **Email Routing** for `parish-life.org`:
- create a custom address `privacy@` that forwards to the owner's own inbox;
- the owner verifies the destination;
- Cloudflare adds its own `MX` and SPF records on the apex.

These do not clash with Resend's records, which are on the `send` subdomain.

## Tests

`ResendEmailTests` (3) cover:
- a real HTTP registration, the code email through a stand-in Resend endpoint (sender, recipient, bearer header, both languages), confirmation, then sign-in;
- a refusal reported as not sent;
- no settings means the unconfigured sender, and capabilities stay NotConfigured;
- the change-email wording.

No email has been sent through the real Resend yet.
