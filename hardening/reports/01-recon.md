# Agent 01 report: recon and architecture map

Branch `hardening/01-recon`, from `fullstack-hardening` at `abf17e3`, 21 November 2026. Output: `hardening/PROJECT_MAP.md`.

## Summary

1. ParishLife is one ASP.NET Core 10 API (`ParishLife.Api`, 636 controller actions, 39 anonymous) that also serves a client-rendered React 19/Vite 7 frontend from the same origin on Azure App Service (Linux, B1, one instance), with Cosmos DB (5 containers, document envelopes partitioned by `parish:<id>` / `account:<id>`) and private Blob Storage.
2. Security controls are central and consistent: cookie sessions re-validated server-side, a global CSRF filter on every write, per-IP rate limits, Turnstile on 7 anonymous actions, restricted recovery sessions; roles and permissions are enforced inside services, not by attributes, so the routes table lists the checks found there as a heuristic for Agent 03.
3. The product does **not** call any AI/LLM model (searched code, frontend, tools, manifests and lock files); Agent 07 has nothing to run. There are no online payments, no SMS, no WebSockets, no GraphQL, no SAML; email is Resend for account codes only.
4. Personal data is broad and sensitive (religious affiliation through sacraments and membership, medical notes, children's registrations and pickup codes, pastoral and safeguarding records); the most sensitive free text is encrypted with Data Protection, and nothing is ever deleted automatically.
5. Operations are manual: no CI, no staging, deploys by script with the owner's go-ahead; backups, log retention and alerts exist only as Azure settings this agent could not verify.

## Status

| # | Task | Status | Note |
|---|---|---|---|
| 1 | Stack | Done | |
| 2 | Folder structure | Done | |
| 3 | Routes and endpoints | Done (role column heuristic) | 636 actions generated from attributes; a check was found for 540 of the 597 signed-in actions, 57 show "not detected" |
| 4 | Database | Done | Cosmos adaptation; RLS/views/SECURITY DEFINER Not applicable with reason |
| 5 | Environment variables | Done | no `.env.example` exists |
| 6 | Data inventory | Done (retention and backups Unverified) | |
| 7 | Third-party scripts | Done | |
| 8 | Cookies and storage | Done (framework cookie names Unverified) | |
| 9 | Assets | Partial | image provenance per file unknown |
| 10 | Forms | Done (portal dialogs summarized per module) | |
| 11 | Quality and operations | Done (Azure side Unverified) | |
| 12 | Applicability list | Done (AI-written content Unverified) | 31 questions answered with file references |
| 13 | File ownership | Done | |
| 14 | Open questions | Done | 13 questions |
| 15 | Urgent observations | Done | 10 lines |

Counts: Done 14, Partial 1 (assets). Five Done items carry Unverified parts (3, 6, 8, 11, 12). Docs-versus-code mismatches recorded: 10 (map section 16).

## Open questions for the owner

1. Were any page texts, Arabic translations, photos or icons made with AI?
2. Which images are Unsplash photos (which photographers), which are your own, which are generated?
3. Sign-up has no age question although the terms say 13+. Add a confirmation, a birth year, or nothing?
4. The public request form offers "Parent" and "Guardian" as the requester's relationship. Is that compatible with "parents do not act for children in the app"?
5. Self-host the Google Fonts used by the portal and product page (they load before any consent)?
6. Should parish pages rank in Google? They are client-rendered `public.html?parish=<id>` pages with no sitemap or robots file, and `/` is the sign-in page.
7. Confirm the Application Insights retention (the privacy page says 90 days).
8. Confirm Cosmos continuous backup (7 days) and Blob soft delete (30 days), and answer question 16 (schedule, RPO/RTO, custody).
9. Are there any Azure alert rules or availability tests?
10. Legal business name, country, address, registration numbers; and whose WhatsApp number is on the product page?
11. Will diaspora parishes (EU, US, Australia) use the product?
12. There is no "forgot password" flow. Intended for the pilot?
13. Staging database (question 26).

## Urgent observations

1. Microsoft `id_token` decoded without signature validation, trusting the TLS token response (`Api/Identity/ExternalIdentityClaims.cs` lines 58–62). [03]
2. Rate limits key on `RemoteIpAddress` with no forwarded-headers handling in code; behaviour behind App Service's front end is unverified. [03, 08]
3. Website HTML from editors is sanitized only in the browser; the API stores raw HTML. [03]
4. Any signed-in account can read `/openapi/v1.json`. [03]
5. `Server: Kestrel` is sent; HSTS is 30 days without `includeSubDomains` (seen live). [03]
6. No CI: tests and frontend checks are not run before deploys. [08]
7. `GET /api/capabilities` hard-codes External sign-in and Bot check as "Not configured" while both are live. [03, 06]
8. No `robots.txt` or `sitemap.xml`; unknown public addresses return 200. [06]
9. Google Fonts load before consent on the portal and product page. [06]
10. `gitleaks git` over the whole history found no secrets.

## What could not be mapped, and why

- **Per-action roles are a heuristic.** Permissions are checked in services, often through helper classes (`MinistryAccess`, `MfaAccountAccess`, `StaffAppointmentAccess`, workflow and reservation access). The extractor followed each action into its service method and two levels of same-file helpers; 57 signed-in actions show "not detected" and some listed checks may cover only one branch. Agent 03 must confirm each action it changes.
- **Azure settings** (backups, Application Insights retention, alerts, HTTP/2 setting, how App Service forwards the client IP, the Cloudflare and Google console settings): this run may not touch Azure, so they come from docs and are marked Unverified. Four read-only HEAD requests to public production URLs confirmed headers, HTTP/1.1 on the apex, the Cloudflare `www` redirect, and 404 for `robots.txt` and `sitemap.xml`.
- **Image provenance and licences**: only one Unsplash credit exists; no per-file record.
- **Framework cookie names** for the OAuth correlation and Identity external cookies are framework defaults, not set in code.
- **Cosmos document types** were extracted by pattern; a few written through constants were added by hand, others may be missing.
- **Portal dialogs** are summarized per module and pointed to `docs/frontend-modules/*.md` instead of listing every field of every dialog.
- No build or test was run (the recon prompt is read-only). Checks run: `gitleaks git --redact` (no leaks found); four HEAD requests listed above. The route and document-type extraction scripts were kept outside the repository (scratchpad), not committed.
