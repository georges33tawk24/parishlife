# Sacramental case and register operations

Updated 10 November 2026. Source basis: S12.01–S12.13 and S02.07 (proposed). Routes are under `/api/parishes/{parish}/sacraments`; the sacraments module must be covered. Office work needs sacraments.record with current MFA; decisions marked *priest* need a current parish priest. Rite-specific required fields, preparation requirements and the numbering scheme are clergy inputs; none is invented.

## Case lifecycle (`POST /sacraments`, `POST /sacraments/{id}/actions`)

| Action | From → to | Who |
| --- | --- | --- |
| (open) | → Received | Office, for an existing unarchived Person; a second active or registered Baptism, First Communion or Confirmation for the same person is refused |
| accept | Received → Preparation | Priest, or a secretary recording a genuine prior instruction of a current priest (priest, basis, actual time; both identities are kept) |
| schedule | Preparation → Scheduled | Office: future date and celebrant |
| reschedule, decline, cancel | Pre-celebration only, with a reason | Priest or recorded instruction |
| record-celebration | Scheduled/Preparation → Celebrated | Office: actual time (never in the future), place, celebrant, witnesses, facts |
| amend-facts | Before registration | Office; clears a returned entry |
| return-entry | Celebrated | Priest, with a reason; blocks registration until amended |
| register | Celebrated → Registered | Priest; allocates the official number |

Acceptance starts preparation only; it does not verify evidence, reserve a date or prove a celebration. Every step is kept on the case timeline with the actual actor and time.

## Official numbering

`PUT /sacraments/numbering` (*priest*) records the competent authority's scheme for one sacrament: a format containing `{n}` and optionally `{year}`, whether numbering restarts each year, and an approval reference. Without a scheme, registration is refused. The counter is updated in the same transaction as the entry, so concurrent registrations cannot share a number and numbers are never reused. Once entries are registered under a scheme it cannot be replaced without a separate reviewed migration.

## Corrections and register search

- `POST /sacraments/{id}/corrections` (office) proposes a correction to a registered entry's place, celebrant name, witnesses, book reference, celebration time or `facts.<key>`, with reason and evidence. `POST /sacraments/corrections/{id}/decision` (*priest*) approves or rejects it. An approval appends an amendment with the previous value, proposer and approver; the original entry is never overwritten, and responses show original `Facts` and amended `CurrentFacts`. `GET /sacraments/corrections` lists pending corrections.
- `GET /sacraments?sacrament=&status=&personId=` is the read-only register search; `GET /sacraments/{id}` returns one case.

Not implemented: clergy/venue conflict checks at scheduling, group celebrations with shared facts, approved per-rite preparation templates, certificate preparation/signing/bishop review/release (S06–S08), official sheets and exports (S10), anniversaries (S11) and book/page/year filters beyond the search parameters.

## Certificates (`/api/parishes/{parish}/certificates`)

Source basis: S14.01–S14.14 and S15.09–S15.12 (proposed). No national document list, wording, expiry or electronic signature is invented. Until an approved electronic-signature arrangement exists, the wet-signed and sealed paper is the official document, and every response says that a digital copy is for reference only.

| Action | From → to | Who |
| --- | --- | --- |
| (create) | → Received, or WaitingForSource for a planned sacrament | sacraments.record; the source must be this person's registered entry for the same sacrament |
| link-source | WaitingForSource → Received | sacraments.record |
| prepare | Received/Returned → Prepared | sacraments.record; freezes the entry's current (amended) facts and official number |
| submit | Prepared → AwaitingSignature | sacraments.record |
| sign | AwaitingSignature → AwaitingBishop, or AuthorizedForIssuance when the bishop's policy waives acceptance | Current parish priest; records that the priest approved and signed the paper |
| accept | AwaitingBishop → AuthorizedForIssuance | The bishop of the parish's jurisdiction |
| return | AwaitingSignature, AwaitingBishop or AuthorizedForIssuance → Returned | Priest (or the bishop at his stage), with a reason restricted to office and clergy |
| issue | AuthorizedForIssuance → Issued | documents.release; refused if the source entry was corrected after preparation |
| release | Issued → Released | documents.release; recipient name, relationship, verification method and evidence |
| withdraw | Issued/Released → Withdrawn | documents.release, with a reason; what was released stays recorded |
| cancel | Before signing is complete | sacraments.record, with a reason |

- Bishop acceptance of new certificates stays required by default. `PUT /api/archdioceses/{id}/certificate-policy` lets that bishop explicitly record a different choice with a reason.
- A reissue is a new certificate (`ReplacesCertificateId` plus a reason) with its own reference and version, and it repeats every gate.
- Reads are limited to sacraments.record staff, the parish's priests and its bishop.

## Anniversaries (S11)

- `GET /api/parishes/{parish}/sacraments/anniversaries?from=yyyy-MM-dd&days=30` (priest or sacraments.record; 1–92 days) lists upcoming anniversaries of registered Baptism, FirstCommunion, Confirmation and Marriage entries. Only registered entries with a recorded celebration date count, amendments included, and the recorded calendar date is kept wherever the viewer is. Archived people are left out.
- `GET .../sacraments/anniversaries/mine` shows a linked member their own anniversaries for the coming year.
- No greetings are sent: outreach needs consent, a purpose and a real delivery channel, and the person record has no deceased status yet (P02), so celebratory outreach could not be suppressed safely.

Not implemented for certificates: approved document templates and layouts, PDF output and secure download, fees and offerings, a combined bishop queue across parishes, substitute signers, and legacy issued certificates.

## Certificate sheets (S10)

Source basis: S14.09–S14.10, S30.19 (proposed). The system never writes or translates certificate wording.

- `PUT /api/parishes/{parish}/document-templates` (acting priest, MFA) proposes the wording for one sacrament and language (en, fr or ar), as supplied by the competent authority. Placeholders are `{{name}}`, `{{reference}}`, `{{officialNumber}}`, `{{celebratedAt}}`, `{{place}}`, `{{celebrantName}}`, `{{witnesses}}`, `{{bookReference}}`, `{{issuedAt}}` and `{{facts.<key>}}`; unknown ones are refused. A new proposal replaces the wording and needs fresh approval.
- `POST .../document-templates/{kind}/{language}/approve` (the jurisdiction bishop) approves it. `GET .../document-templates` lists them for priests.
- `GET /api/parishes/{parish}/certificates/{certificate}/sheet` (certificate readers) returns a printable A4 HTML file, as a download:
  - It uses only approved wording, filled from the certificate's own prepared snapshot, so later register or profile changes never alter it.
  - The wording and every value are escaped, and Arabic sheets are right-to-left.
  - A missing value is shown as `[field not recorded]`, never invented.
  - Every sheet carries a banner: **DRAFT** until issued, then **COPY**. The official document remains the signed and sealed paper until an approved electronic signature and verification arrangement exists.

Not implemented: PDF generation, bilingual layouts, the printed priest-name block, serial/QR verification (X05), and register-page and other sheets (rosters, vouchers, receipts).
