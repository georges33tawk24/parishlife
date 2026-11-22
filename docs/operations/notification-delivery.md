# Email, push and WhatsApp delivery

Owner decisions of 21 November 2026:
- **Resend** for email, from `ParishLife <no-reply@parish-life.org>`. It sends the account codes, and also personal notices, scheduled-report notices and parish broadcasts.
- **Web push** to phones and browsers.
- **WhatsApp** through Meta's WhatsApp Cloud API.
- No SMS, and no online payments.

Each channel works only once its settings exist. Secrets are always Key Vault references. With no channel set up, nothing is queued and nothing is sent.

## What is sent, and to whom

| Source | In the app | Outside (each person's choices) |
| --- | --- | --- |
| **Account codes** (sign-up email confirmation, change of email) | n/a | Email only, to the address being proven |
| **Personal notices** (request updates, inbox messages, case updates, report-ready notices…) | Stored, as before | Email, push and WhatsApp carry the notice's **neutral title** plus a link to `https://parish-life.org/index.html`; nothing else about the case leaves the app |
| **Parish broadcasts** | Stored for each recipient, as before | Email carries the title and text; push carries the title and a short text; WhatsApp carries the title. Each is in the recipient's language when an Arabic version exists |

**Recipients and choices:**
- Muted optional topics are not sent anywhere; broadcast recipients already exclude people who muted the topic.
- Each person chooses on My account → **How ParishLife reaches you**.
- **Email:** on by default, but only to a **confirmed** address.
- **Push:** on by default, but only to devices the person turned on, each with the browser's own permission.
- **WhatsApp:** off until the person proves a number with a code; proving it turns it on, and removing the number turns it off.

**How it works:**
- When a notice is stored, or a broadcast is sent, a `deliveryWork` row is written **in the same transaction**: notices in the account partition, broadcasts in the parish partition.
- `DeliveryWorker` (every 15 s, when background jobs are on) sends the rows.
- **Notices:** a channel that fails is retried up to 3 times, and channels already sent are never repeated.
- **Broadcasts:** 25 recipients per tick, one attempt each.
- A broadcast's outside channels show `Queued` once handed over: never "sent", and never proof of receipt.

## Settings (App Service)

| Setting | Value |
| --- | --- |
| `Email__Provider` | `Resend` |
| `Email__ResendApiKey` | `@Microsoft.KeyVault(SecretUri=https://keyvault-parishlife.vault.azure.net/secrets/resend-api-key/)` |
| `Email__From` | `ParishLife <no-reply@parish-life.org>` |
| `WebPush__PublicKey` | printed by `tools/New-VapidKeys.ps1` (not secret) |
| `WebPush__PrivateKey` | `@Microsoft.KeyVault(SecretUri=https://keyvault-parishlife.vault.azure.net/secrets/webpush-private-key/)` |
| `WebPush__Subject` | optional; default `mailto:privacy@parish-life.org` |
| `WhatsApp__PhoneNumberId` | the WhatsApp business number's ID (not secret) |
| `WhatsApp__AccessToken` | `@Microsoft.KeyVault(SecretUri=https://keyvault-parishlife.vault.azure.net/secrets/whatsapp-access-token/)` |
| `WhatsApp__NoticeTemplate` / `WhatsApp__CodeTemplate` | optional; defaults `parishlife_notice` / `parishlife_code` |
| `WhatsApp__ApiVersion` | optional; default `v23.0` |
| `Delivery__SiteUrl` | optional; default `https://parish-life.org` |

`id-parishlife` needs "Key Vault Secrets User" on each of the three secrets (an RBAC change, with the owner's go-ahead).

## Setup, step by step (owner, then the Azure session)

### Email (Resend)
1. **Owner:** create the Resend account, and add the domain `parish-life.org` with the region Resend offers.
2. **Cloudflare DNS:** add exactly the records Resend shows (DKIM `TXT` at `resend._domainkey`; `MX` and SPF `TXT` on the `send` subdomain). They must be DNS only (grey cloud). Then press Verify in Resend.
3. **Owner:** create an API key with "Sending access" for `parish-life.org`, and store it **only** in Key Vault as `resend-api-key`.
4. **Azure session:** RBAC on the secret, the three `Email__` settings, a check that the reference shows `Resolved`, then restart.
5. **Test:**
   - register with a real inbox, request the code, confirm it, sign in;
   - send yourself a parish broadcast;
   - check "Email" is on under My account.

### Push
1. **Azure session:** `./tools/New-VapidKeys.ps1 -VaultName keyvault-parishlife`. It stores the private key in Key Vault without showing it, and prints the public key and both setting values. Run it once: a new key means every device must turn notifications on again.
2. **Azure session:** RBAC on `webpush-private-key`, then the two `WebPush__` settings.
3. **Test:** on My account, "Turn on notifications on this device", allow it, then send yourself a notice or broadcast.
   - **iPhone/iPad:** push works only after ParishLife is added to the Home Screen (iOS 16.4 or later). Android, Windows and Mac browsers work directly.
- Only these push services are accepted as device addresses, so a stored address can never make the server call anything else:
  - Google FCM;
  - Mozilla;
  - Windows (WNS);
  - Apple.

### WhatsApp (Meta WhatsApp Cloud API)
1. **Owner, in Meta Business Manager:**
   - a verified business;
   - a WhatsApp Business Account;
   - a phone number dedicated to ParishLife (it cannot stay on the normal WhatsApp app);
   - its display name approved.
2. **Owner, in WhatsApp Manager:** create and get approved two templates, each in **English (`en`) and Arabic (`ar`)**:
   - `parishlife_notice`, category **Utility**:
     - body with one variable, for example "ParishLife: {{1}}" / "ParishLife: {{1}}";
     - optional button "Open ParishLife" → `https://parish-life.org/index.html`.

     The variable is the neutral notice title or the broadcast title.
   - `parishlife_code`, category **Authentication**, "copy code" button. Meta writes the text; the code is the variable.

   Meta may class parish announcements as Marketing rather than Utility, which changes the price. Meta charges per conversation.
3. **Owner:** create a **system user** with a permanent token that has `whatsapp_business_messaging` on that account. Store the token **only** in Key Vault as `whatsapp-access-token`, and note the phone number ID (not secret).
4. **Azure session:** RBAC on the secret, then the `WhatsApp__` settings.
5. **Test:**
   - My account → WhatsApp: enter your number, receive the code, confirm it;
   - send yourself a notice.

## privacy@parish-life.org

Resend only sends. To receive at `privacy@parish-life.org`, turn on Cloudflare **Email Routing** for `parish-life.org`:
- create a custom address `privacy@` that forwards to the owner's own inbox;
- the owner verifies the destination;
- Cloudflare adds its own `MX` and SPF records on the apex.

These do not clash with Resend's records, which are on the `send` subdomain.

## Email: live setup (21–22 November 2026)

Done by the owner (Resend and Cloudflare dashboards) and the Azure session (Azure only), each Azure change with the owner's go-ahead. The API key never passed through the Azure session: the owner stored it in Key Vault directly.

- **Resend:**
  - Domain `parish-life.org`, region Ireland (`eu-west-1`), verified 21 November. Resend's "Forge" infrastructure is enabled for the domain.
  - Open and click tracking are off: no tracking subdomain is configured. TLS is "Opportunistic".
  - The API key has sending access, restricted to `parish-life.org`.
  - Free plan: 3,000 emails a month, **100 a day**. A broadcast to more people than that will need a paid plan.
- **Cloudflare DNS** (all DNS only), checked against the zone's own nameservers:

  | Name | Type | Content |
  |---|---|---|
  | `resend._domainkey` | TXT | Resend's DKIM key |
  | `send` | MX | `10 feedback.forge.rmta.net` |
  | `send` | TXT | `v=spf1 ip4:52.3.252.119 ip4:44.222.39.36 ip4:199.249.231.0/24 ~all` |
  | `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:066e8fd7867b4ff39decf2aa6200e04e@dmarc-reports.cloudflare.net` |
  | `@` | MX | `route1/2/3.mx.cloudflare.net` (Email Routing, managed by Cloudflare) |
  | `@` | TXT | `v=spf1 include:_spf.mx.cloudflare.net ~all` (Email Routing) |
  | `cf2024-1._domainkey` | TXT | Cloudflare Email Routing's DKIM key |

  - DMARC is `p=none` (monitoring). Aggregate reports go to Cloudflare **DMARC Management** for the zone. Move to `p=quarantine` once the reports show only Resend and Cloudflare sending as the domain.
- **Azure:**
  - Key Vault secret `resend-api-key` (owner, 21 November, 15:39:58 UTC). `id-parishlife` has "Key Vault Secrets User" on that secret only.
  - App settings at 15:44:04 UTC: `Email__Provider=Resend`, `Email__ResendApiKey` (Key Vault reference, `Resolved`), `Email__From=ParishLife <no-reply@parish-life.org>`. The owner chose to keep `no-reply` despite Resend's advice.
  - Capabilities have reported `contactVerificationDelivery: ProviderConfigured` since 15:45:44 UTC.
- **Live test** (owner, 21 November, running `39e5df6`):
  - A new account registered with email and password, and the code email was sent through Resend.
  - The code confirmed the address, and the account signed in.
  - The email landed in **Junk**. That happened before DMARC existed, from a brand-new sending domain; inbox placement should improve with DMARC and normal use.
- **privacy@parish-life.org:**
  - Cloudflare Email Routing is on. The rule `privacy@` forwards to the project's own verified Gmail inbox (changed by the owner on 22 November); the catch-all is disabled (drop).
  - Forwarding was tested 22 November from another account.
- **Rollback:**
  - Remove the three `Email__*` settings, and sending stops after the restart.
  - Disabling Email Routing removes its records; the Resend records stay.

## Send a test notification

My account → How ParishLife reaches you → **Send a test notification** (`POST /api/notifications/test`, `NotificationTestService`) checks delivery live.
- **What it sends:** one fixed, neutral message ("ParishLife test notification: notifications are working.") to the person pressing it. That means their own push devices, their own confirmed email if email is on, and their own proven WhatsApp number if WhatsApp is on. It takes no recipient, text or link.
- **Who may use it:** a personal sign-in only. Never a recovery sign-in or an appointment capacity, and an account with two-factor needs its authenticator session.
- **Limits:** one a minute and five a day per account, counted before sending.
- **Result per channel:** `sent` only when the push service, Resend or WhatsApp accepted the message, then `no-device`, `no-address`, `no-number`, `not-enabled` or `failed`. Push devices reported gone are removed.
- **What it records:** nothing about devices or addresses in receipts or audit; the log holds outcomes and the device count only.

## Privacy

- **Processors:** the privacy page names Resend, the push services, and Meta (WhatsApp, only for people who turn it on).
- **Code safety:** WhatsApp codes are stored only as a hash bound to the account. Codes, numbers, tokens and message text are never logged.
- **Log content:** failures log only an HTTP status or error type.

## Tests

- `DeliveryTests` (6, two of them for the test notification):
  - a notice reaches a confirmed email and a registered push device; the test decrypts the push like a browser and checks the VAPID header;
  - WhatsApp only after the code; the code is never stored in plain text, receipts or audit;
  - a gone device is removed, and unknown push endpoints are refused;
  - a failed channel is retried without repeating the others, and channel choices are kept and honoured;
  - broadcasts go out in the recipient's language, at confirmed addresses only;
  - nothing is queued while no channel is set up.
- `WebPushSenderTests`: encryption matches RFC 8291's published example byte for byte; the VAPID token verifies; the endpoint allowlist.
- `ResendEmailTests` (3): the account codes.
- None of Resend, a real push service or WhatsApp has been exercised live yet.
