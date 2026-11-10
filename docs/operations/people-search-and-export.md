# People search and export operations

Updated 10 November 2026. Source basis: S03.10, S32.04 (proposed). Routes are under `/api/parishes/{parish}/people` and need current MFA and the office module.

- `GET /search?q=&includeArchived=false&size=25` (people.read) matches every word of the query against names and contact, ignoring case and combining marks (Latin accents and Arabic vowel marks), so "elie" finds "Élie" and "محمد" finds "مُحَمَّد". Stored spellings are never rewritten. Results carry only id, names, birth date and archive flag; nothing is created when there is no match.
- `GET /export/preview?columns=GivenName&columns=Contact` (people.read and exports.manage) shows the row count, columns and what is always excluded (account links, credentials and tokens, pastoral notes and concerns, register entries, household and guardian details).
- `POST /export` with a purpose, columns (GivenName, FamilyName, BirthDate, Contact, Archived) and scope returns a UTF-8 CSV. Cells that a spreadsheet would treat as formulas are prefixed with an apostrophe. Each generation stores an export log (exporter, purpose, columns, scope, count, time); the file itself is not stored.

Not implemented: searching households, request references, register numbers, events and ministries from one box; bulk actions; XLSX/PDF; asynchronous exports; and other export kinds (finance, registrations).

## Duplicates and merges (P05)

Source basis: S10.04–S10.06 (proposed). Routes under `/api/parishes/{parish}/people` need current MFA and the office module.

- `GET /duplicates` (people.read) suggests current people who share a family name **and** at least two more signals (given name, birth date, contact), ignoring case and marks. A shared name or family phone alone never suggests a duplicate. Each suggestion shows why it matched, which fields differ and whether either person is linked to an account. Nothing is merged automatically.
- `POST /duplicates/decisions` (people.write) records `different` (the pair is no longer suggested) or `need-information` (kept, labelled), with a reason.
- `GET /merges/preview?survivorId=&sourceId=` lists the differing fields and the records that keep pointing at the source person (sacramental entries, registrations, volunteering, household memberships, consents). Those records are not rewritten and stay individually traceable.
- `POST /merges` (people.write) needs a `survivor` or `source` choice for every differing field and a reason. Only an unlinked person can be merged away; when both are account-linked, identity review comes first. If either person has sacramental entries, an acting priest must do the merge. The source person is archived and both before-snapshots are kept.
- `POST /merges/{merge}/unmerge` restores both people from the snapshots, but only while neither changed after the merge; otherwise use a separate reviewed correction. `GET /merges` lists merges and unmerges.

Not implemented: matching on relationships, households, locality or transliterated scripts; finance review when financial attribution changes; moving dependent records onto the survivor; and notifying affected account holders.

## People import (P06)

Source basis: S10.01–S10.03, S10.12 (proposed). Routes under `/api/parishes/{parish}/people/imports` need people.write **and** imports.manage, current MFA and the office module.

- `POST /` stages a CSV with the template header `GivenName,FamilyName,BirthDate,Contact,SourceId` (up to 1,000 rows, quoted fields allowed) together with its source name, owner and date. The whole file is validated before anything is written, and each row keeps its original line next to the normalized values.
- Validation rules:
  - Names and a source identifier are required.
  - Dates are ISO (yyyy-MM-dd) or day/month/year with the file's stated `DateOrder` (DMY or MDY). A date that could be read either way without a stated order is an error; nothing is guessed.
  - Year-only birth dates are rejected because the person record cannot hold that precision yet.
  - A source identifier already imported from the same source is a `Duplicate`; a row matching a current person's names and birth date is a `PossibleDuplicate`.
- `GET /{import}` shows counts by outcome and every row.
- `POST /{import}/commit` with the current version imports nothing unless every row is valid, or unless `ValidRowsOnly` is chosen, which imports exactly the valid rows in batches. Each imported person gets a source claim, so the same file staged again shows its rows as duplicates. Contacts are stored as supplied and never marked verified.

Not implemented: XLSX, households/rosters/sacramental/finance imports, clergy or finance sign-off of official imports, a migration report document, rollback (archive imported people instead), and keeping the original file.
