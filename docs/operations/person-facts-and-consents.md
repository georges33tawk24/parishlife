# Person facts, medical declarations and consents operations

Updated 10 November 2026. Source basis: S08.04–S08.06, S08.11 (proposed). Routes are under `/api/parishes/{parish}` and need current MFA and the office module unless they are a member's own routes.

## Optional facts

- `PUT /people/{person}/facts` (people.write; send the current version once facts exist) and `GET /people/{person}/facts` (people.read) hold structured locality (country, region, district, town, address detail), occupation, skills, preferred language (en/fr/ar) and deceased status.
- A locality that is not in a list is kept exactly as submitted in `LocalityNotListed` and shown as `PendingReview`; it cannot be combined with a listed town. No locality list is provided yet.
- Deceased status keeps its precision: `Exact` (yyyy-MM-dd, not in the future) or `Year` (yyyy), always with evidence. Nothing invents a day or month. People recorded as deceased are left out of sacramental anniversary lists.

## Medical declarations

- `PUT` / `GET /people/{person}/medical` need the separate `people.medical.manage` duty, which is not part of people.read/write or the setup owner's default set. Allergies, conditions, blood type and notes are protected at rest, carry a stated purpose, and show `Verified: false` unless a source is recorded. Nothing is inferred clinically, and they never appear in search, people lists or exports.

## Consents

- Kinds: Directory, Photo, Communications, Event and Representation. Each records purpose, policy version, source, who gave it and when. Directory consent names the exact fields it discloses (Name, Phone, Email, Address, Photo, Household); other kinds name none.
- The office records a paper form with `POST /people/{person}/consents` as `PaperReceived` with the giver's name, never as a digital acceptance. `GET /people/{person}/consents` lists them; `POST /consents/{consent}/withdraw` records withdrawal.
- A linked member uses `POST /me/consents`, `GET /me/consents` and `POST /me/consents/{consent}/withdraw` for their own consents, recorded as `Digital`/`Self`. Representation needs office review of evidence. Withdrawal is recorded with time and reason; the original record stays.

Not implemented: verified locality lists and their maintenance, birth-date precision on the core person record, guardian consent for a child's scope, enforcement of consents by future directory/publicity features, member-requested correction of medical data, and frontend.

## Own data and data closure (P04)

Source basis: S10.07, S32.01–S32.03 (proposed). No retention period is defined or invented here; physical deletion of official records is not an ordinary action.

- `GET /api/parishes/{parish}/me/data` shows a linked member their person record, optional facts, consents and how many sacramental, giving, registration, volunteering, household and pledge records refer to them.
- `POST /me/data-closure-requests` asks the parish to close their personal data, with one waiting request at a time; `GET /me/data-closure-requests` follows it, including after access has ended.
- Office reviewers (people.write, MFA, office module) use `GET /data-closure-requests`, then `GET .../{request}/preview`, which lists what stays, what would be removed and which access would end.
- `POST .../{request}/decision`: a reviewer other than the requester approves or declines with a reason. Approval:
  - removes the contact, optional facts and medical declarations;
  - records every given consent as withdrawn;
  - ends the account link and archives the person.

  Official, financial, safeguarding and participation history stay, and the outcome lists each step taken.

Not implemented: guest/representative requests through a verified office route, account-wide (all parishes) closure and global deactivation, approved retention classes with holds and reviewed disposition, an exportable own-data file, and frontend.
