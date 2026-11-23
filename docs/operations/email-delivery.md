# Account email through Resend

ParishLife sends three kinds of email, all one-use codes valid for 15 minutes:
- a code to confirm the email address of a new account (registration with email and password);
- a code to confirm a new sign-in email (change of email);
- a code to reset a forgotten password.

Limits: at most one code a minute, and at most 10 codes in 24 hours, per account and kind of code (owner decision, 23 November 2026). Past the daily cap, the confirmation and reset requests get the usual neutral answer and nothing is sent; an email change answers `contact_daily_limit`. This keeps one address from being flooded and bounds the Resend bill (`ContactVerificationService`).

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

## DNS records for email (public lookups, 22 November 2026)

Agent 06 found **no MX record** for `parish-life.org` earlier on 22 November 2026, through resolvers 1.1.1.1 and 8.8.8.8. Agent 08 looked again later that day, through the same resolvers, and the records below had been added since:

| Name | Type | Value seen | What it is |
|---|---|---|---|
| `parish-life.org` | MX | `route1.mx.cloudflare.net` (63), `route2…` (85), `route3…` (87) | Cloudflare Email Routing: `privacy@` can now receive mail |
| `parish-life.org` | TXT | `v=spf1 include:_spf.mx.cloudflare.net ~all` | SPF for the apex, added by Email Routing |
| `_dmarc.parish-life.org` | TXT | `v=DMARC1; p=none; rua=mailto:<id>@dmarc-reports.cloudflare.net` | DMARC in monitoring mode; aggregate reports go to Cloudflare's DMARC Management (dashboard → Email → DMARC Management) |
| `resend._domainkey.parish-life.org` | TXT | `p=MIGfMA0…` (an RSA public key) | DKIM for Resend, so mail is signed as `parish-life.org` |
| `send.parish-life.org` | CNAME | `send.forge.rmta.net` (which publishes its own MX and SPF) | the bounce (return-path) domain for outgoing mail. Confirm in the Resend dashboard that this is the record Resend asked for. |
| `parish-life.org` | CAA | none | any public CA may issue; optional, see below |

What this means:
- Mail from `no-reply@parish-life.org` through Resend can pass DMARC two ways:
  - DKIM, signed for `parish-life.org`;
  - SPF on `send.parish-life.org`, which aligns with `parish-life.org` under DMARC's default relaxed alignment.
- Still to confirm by the owner:
  - The routing rule `privacy@` → your inbox exists and the destination is verified (Cloudflare → Email → Email Routing → Routing rules). Then send a test message to `privacy@parish-life.org` from another account and see it arrive.
  - Resend shows the domain as **Verified**. Then do the live test in step 6 above.

### Tightening DMARC (owner, in Cloudflare DNS; keep each record DNS only)

Keep the `rua` address exactly as it is today in each step.
1. **Now, 2 to 4 weeks:** keep `v=DMARC1; p=none; rua=mailto:<current Cloudflare address>`. Read the DMARC Management reports weekly. Every source sending as `parish-life.org` should be Resend (or Cloudflare forwarding) with DKIM pass.
2. **Then quarantine:** `v=DMARC1; p=quarantine; rua=mailto:<same address>`. Mail that fails goes to spam.
3. **After 2 more clean weeks, reject:** `v=DMARC1; p=reject; rua=mailto:<same address>`. Forged mail is refused.

If a report shows a legitimate sender failing, for example a new mail service, add its DKIM or SPF record before tightening further. Moving the apex SPF from `~all` to `-all` is optional once DMARC is at `reject`.

CAA is optional: production's certificate comes from DigiCert (GeoTrust, App Service managed certificate), while `www` uses Cloudflare's edge certificate. A CAA record has to allow both, or renewals fail. The safe choice for the pilot is no CAA.

## Tests

`ResendEmailTests` (3) cover:
- a real HTTP registration, the code email through a stand-in Resend endpoint (sender, recipient, bearer header, both languages), confirmation, then sign-in;
- a refusal reported as not sent;
- no settings means the unconfigured sender, and capabilities stay NotConfigured;
- the change-email wording.

No email has been sent through the real Resend yet.
