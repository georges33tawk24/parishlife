# Document signatures, request letters and public verification (X03–X05)

Updated 10 November 2026. Source basis: S14.10–S14.12, S15.09–S15.11, WF20/WF21, scenarios A08–A10, inputs U05/U10. Every rule below is the **proposed** reviewed answer implemented as a mechanism; none is owner-approved policy. No electronic-signature arrangement, wording, seal, signer or provider has been supplied, so nothing here makes a digital file official.

## What an electronic authorization is

An authorization is an immutable record of the **exact canonical content** of one document version (certificate: kind, reference, version, language, subject id and name, official number, linked request, source entry, every prepared fact and the SHA-256 of the bishop-approved wording; letter: reference, version, language, request id/reference, addressee, title, body and replaced letter). It stores the content, its SHA-256, the signer's printed name and verified authority, the selected appointment, the time, the arrangement reference in force (if any) and an ASP.NET Data Protection seal over all of these. A random 128-bit code (32 hex characters) is printed on the document.

- The signer must be a **current parish priest acting in that appointment**, with MFA (never a recovery session), must supply the content hash shown in the preview (`document_content_changed` otherwise) and a **fresh authenticator code** for that one act. The code is a credential: it is verified, counts toward lockout, and never enters the operation fingerprint, receipt or audit.
- `ponytail`: a TOTP code can be reused inside its time step; a one-use server challenge or passkey assertion is the upgrade once U10 provides it. No drawn signature image is stored.
- The verification pointer is written in the platform catalog partition before the document commit; an orphan pointer only ever resolves to "not found".

## Official status (U05)

`PUT /api/archdioceses/{id}/signature-arrangement` (jurisdiction bishop, MFA) records `Approved` (required, never defaulted), the authority's `ApprovalReference` (required when approving) and a reason. Absent or not approved, every response, sheet and verification says the result is **reference only** and that the wet-signed and sealed paper is the official document. An authorization keeps the arrangement reference in force when it was made. `GET` returns the current state to the bishop.

## Signer setup (X03)

`GET|PUT /api/me/signer-profile` — the caller's own printed name (2–200 characters), personal capacity only (no selected appointment, no recovery session, MFA). Replacing it needs the current version. Earlier authorizations keep the name they were made with.

## Certificates (X03, building on the existing certificate workflow)

- `GET /api/parishes/{p}/certificates/{c}/authorization-preview` (certificate readers) returns the canonical content and hash. It needs a prepared certificate and bishop-approved wording for its kind and language.
- `POST /api/parishes/{p}/certificates/{c}/authorization` (`OperationId`, `Version`, `ExpectedContentHash`, `AuthenticatorCode`): only the priest who recorded `sign`, while the certificate is AwaitingBishop, AuthorizedForIssuance or Issued and not already authorized. The existing wet-signature `sign` step is unchanged.
- `return` clears the current authorization (the record stays and now verifies as Invalidated); re-preparing and signing allows a new one. Issuing a reissue marks the replaced certificate `SupersededById`.
- The printable sheet of an authorized certificate uses the authorized subject name, refuses if the approved wording changed since, and prints "Electronically authorized by {printed name}, Parish priest", the code, its current status and the honest official statement. The printed authority is the priest; office attribution stays in internal history.

## Request letters (X04)

| Route (under `/api/parishes/{p}`) | Who | Effect |
| --- | --- | --- |
| `POST requests/{r}/letters` | requests.manage | Draft (title, body, en/fr/ar, addressee); `ReplacesLetterId` + reason drafts a replacement with a new reference and version |
| `PUT letters/{l}` | requests.manage | Revise a draft at its version; signed letters are never edited |
| `GET letters/{l}/authorization-preview` | requests.manage, documents.release or priest | Canonical content and hash |
| `POST letters/{l}/authorization` | current parish priest | Draft → Signed; signing a replacement marks the old letter superseded |
| `POST letters/{l}/release` | documents.release | Signed → Released |
| `POST letters/{l}/withdraw` | documents.release | Signed/Released → Withdrawn with reason |
| `GET requests/{r}/letters` | requests.manage, documents.release or priest | Full staff view |
| `GET requests/{r}/letters/mine` | the request's own applicant account (personal capacity) | Released letters; text, signer and code only when released to that account |

Release (S15.09) re-enters the request reference, addressee and signed content hash; the server compares them and a mismatch (`release_mismatch`) releases nothing. A revoked authorization or superseded letter cannot be released. `VerifiedAccount` needs the request's own or office-reviewed applicant account; otherwise `InPerson` with recorded evidence. Release and withdrawal fence the request and stage a neutral `RequestApplicant` notice for an account release, dispatched after commit; no external delivery is claimed.

Guests: `GET /api/public/parishes/{p}/requests/{r}/letters` with the `X-ParishLife-Tracking` header lists released/withdrawn letters (reference, title, status, release time, method, statement) but **never the text or code** (S15.11: a tracking bearer is not download identity). Guests collect in person or have the office link a verified account.

The proposed matrix suggested an office letter authority distinct from the priest; the backend has no grantable signing permission (owners cannot delegate `documents.sign`), and S14.10/S15.09 name the priest as printed authority, so letters are priest-signed. A delegated non-priest signer needs an explicit authority decision.

## Verification and revocation (X05)

- `GET /api/public/document-verifications/{code}` — anonymous, rate limited (`authentication` policy). Returns only: code, status and meaning, document type (and sacrament), reference, version, issuing parish name, printed authority, authorization time, whether an approved arrangement applied, the official statement and check time. No subject, contents, reasons or account ids. Unknown or malformed codes return a generic 404.
- Status is derived from the document, never by rewriting the signature: `Valid` (issued/released, current), `NotYetIssued`, `Superseded`, `Withdrawn`, `Invalidated` (returned, cancelled or no longer the current authorization), `Revoked`, `IntegrityCheckFailed` (content hash or Data Protection seal no longer matches the stored record).
- `GET /api/parishes/{p}/document-signatures/{code}` — documents.release, current priest or jurisdiction bishop: full record with integrity result.
- `POST /api/parishes/{p}/document-signatures/{code}/revoke` (`OperationId`, `Reason`) — current parish priest or jurisdiction bishop, MFA. Append-only; the reason stays internal. Revocation does not change the document's own status.
- Withdrawal and revocation stop future reliance; copies already handed over or downloaded cannot be recalled, and responses say so.

## Letter notification outcome

- `GET /api/parishes/{p}/letters/{letterId}/notification-outcome` follows the same current MFA staff/priest reader gate as the letter list. It confirms only the exact letter's latest required in-app notice state (`NotTracked`, `NotRequired`, `Pending`, `Stored` or `Unconfirmed`); it does not expose work IDs, recipient accounts, counts or external delivery claims. Applicants and guest tracking links cannot read this operational outcome.

## Not delivered

Approved arrangement/wording/seals (U05), PDF output and QR images, drawn signature images, one-use signing challenges/passkeys and contact-challenge downloads (U10), delegated or substitute signers, bishop co-signature as a separate authorization, a disclosure-incident worklist after wrongful release, letter templates/letterhead, legacy issued documents, and the frontend. Local tests only: no live Cosmos, Key Vault key-ring or managed-identity acceptance, and the catalog pointer partition is an unmeasured single logical partition.
