# People module

Files: `frontend/src/portal/model/modules/people.js` (load and save), `people-workflows.js` (direct calls), `features/records/people*`, `person*`, `households*`, `membership-reviews*`, `profile-reviews*`. Check: `frontend/scripts/checks/people.mjs`. Pages: people, person, households, household, membershipreviews, profilereviews.

## Routes used (all under `/api/parishes/{parishId}`)

| Area | Routes | Where |
| --- | --- | --- |
| People | `GET people` (pageSize 100), `POST people`, `GET people/{id}`, `PUT people/{id}` (office edit of the core record, `version` from `GET people/{id}`), `POST people/{id}/archive` (archive and restore: `archived` true/false, `version` from `GET people/{id}`) | list, add, edit record, archive, restore |
| Facts | `GET people/facts` (size/cursor, the whole parish), `GET`/`PUT people/{id}/facts` (the whole record is replaced, so only changed fields are patched onto the stored one; `version` sent, none for the first save) | town and Arabic town in lists, address cascade, occupation, skills, language |
| Medical, consents | `GET`/`PUT people/{id}/medical`, `GET`/`POST people/{id}/consents`, `POST consents/{id}/withdraw`, `GET consents?kind=Directory` (size/cursor, the whole parish) | person page, Consent tab, directory flag, printed directory |
| Households | `GET households` (size/cursor, each with its members), `GET`/`PUT households/{id}`, `POST households`, `POST households/{id}/members` (add, remove, set-contact), `GET households/{id}/history` | HOUSEHOLDS, each person's `hh` |
| Relationships | `GET`/`POST people/{id}/relationships`, `POST .../{rid}/end` | "Recorded relationships" panel |
| Duplicates | `GET people/duplicates`, `POST people/duplicates/decisions`, `GET people/merges/preview`, `POST people/merges`, `GET people/merges`, `POST people/merges/{id}/unmerge` | DUPLICATES, People → Duplicates |
| Search, export | `GET people/search`, `GET people/export/preview`, `POST people/export` (CSV) | membership link picker, relationship picker, Export people |
| Office queues | `GET membership-requests`, `POST membership-requests/{id}/decision`, `GET profile-corrections`, `POST profile-corrections/{id}/review` | membershipreviews, profilereviews |

Several routes need an authenticator (MFA) session; without one the API answers 403 and the part stays empty.

## How it behaves

- **Names.** A person has a given and family name and optional Arabic twins (`givenNameAr`, `familyNameAr`); a household has `name` and optional `nameAr`. The screen shows the Latin text when no Arabic one is stored (display only). A save sends Arabic only as typed: an untouched fallback is never stored as Arabic, and clearing a stored Arabic name sends it as not recorded. A typed name is split into given (first word) and family (the rest), for both languages.
- **Office edit.** Changing a person's name, Arabic name, birth date, contact, rite or status sends `PUT people/{id}` with the current version. It needs `people.write`, the office module and an authenticator session. A name of one word cannot be saved (the API needs a family name) and is undone and reported. A linked member's own proposals still go through the profile-correction queue.
- **Rite and status** are stored as recorded by the office: rite is free text; status is Member, Visitor or not recorded. Neither grants anything. *Clergy* is no longer offered in the edit form: clergy comes from appointments (ecclesiastical office), not the person record; a clergy status on a new person is named in the notice and not kept.
- **Facts load for the whole parish** with `GET people/facts` (and again for one person when opened), so the people list shows town and Arabic town without opening anyone. The Arabic town sent is the one the address cascade shows, unless it only repeats the Latin town.
- **Households** come with their members in the list, so no household is read on its own during load. Town and Arabic name are saved; a town change is kept in the household history.
- **Directory.** The person's directory flag comes from the parish's given Directory consents (`GET consents?kind=Directory`). The printed directory reads the same list when printing and shows, for each person, only the fields their consents name (Name is required to be listed; Phone, Household and Address control the phone, household and town columns). The add-person "include in the printed directory" box is not kept as a consent (a consent needs who gave it and the policy version); the notice says to record it on the Consent tab.
- **Still undone and reported, nothing sent:** deleting a person or household, tags, the notification channel, blood type outside the medical declaration, relationship labels, important dates and parish fields.
- The CSV import screen no longer fills an empty rite with a default rite or marks everyone a member.

## Owner requests of 27 November 2026 (branch `agent/people-fixes`)

- **Names.** Separate first and last name in English and in Arabic (`features/records/people-fields.jsx`, `NameFields`). Letters only: Latin letters for the English pair, Arabic letters for the Arabic pair; spaces, hyphens, apostrophes and full stops may join them. The API enforces the same rule (`Services/People/PersonRules.cs`, `Validation/PersonNameAttribute.cs`) on create, office edit and CSV import staging. Older records with digits or the other script must be corrected before their next office edit.
- **Phones.** A person has up to five numbers (`Person.Phones`: international `Number`, `Kind` Mobile or Landline). The leading 0 is dropped; Lebanese 03 and landlines (01, 04 to 09) have 7 digits, 70, 71, 76, 78, 79 and 81 have 8, and the kind is derived from the prefix (a 7-digit number starting with 7 is a 07 landline). Foreign numbers need 8 to 15 digits with the country code and may state their kind. The form is `PhoneList` (country picker from `ui/phone-input.jsx`). An older record whose single `contact` is a phone number shows it as its first phone; it moves into `phones` (and the contact is cleared) only when the office saves a changed list. Phones travel through merges (field `Phones`), duplicate signals ("Same phone number"), search, export (column `Phones`) and own-data, and are cleared by an approved data closure.
- **Date of birth** is typed as dd/mm/yyyy, never in the future and never more than 110 years ago (API too).
- **Address.** All governorates and districts of Lebanon are offered (`ui/geography.jsx`). Towns are listed only where a verified list exists (Baabda); elsewhere, or with "Another town", the town and its Arabic spelling are typed. The sector is typed and stored in facts `Sector`.
- **Languages.** Several languages (facts `Languages`, ISO codes); `PreferredLanguage` is the first of Arabic, English or French among them.
- **Skills** are typed and added one at a time (no digits, API too); the "search existing skills" list is gone.
- **Consents.** In the new-person drawer every consent (WhatsApp announcements = Communications, printed directory, photos, events) is ticked by default in the same control style; the ticked ones are recorded after the create as office entries (`PaperReceived`) with the person as the giver, purpose "Agreed when registered with the parish office", policy version `registration-default`, and Directory fields Name, Phone, Address and Household. They need an authenticator session; what could not be recorded is reported. Withdrawing ("Remove this consent") no longer requires a reason. Owner to confirm the policy version label.
- **Export** asks for no purpose; the API logs a blank one as "Not stated".
- **Status filter**: Member, Visitor, Not recorded; Apply and Clear close the popover (its buttons now use `onClick`, since `openPopover` has no `onMount`).
- **Duplicates**: "View side by side" on each column opens both records field by field; the merge form names the kept record and the merged one and offers each differing value as "Keep the kept record's value" or "Use the value from the merged record".
- **Import**: a guide lists the recognised column names (First name, Last name, their Arabic twins, Phone numbers separated by ";", Date of birth dd/mm/yyyy, Town, Rite, Line of work); rows are marked Ready (green) or Needs correction (red) in a smaller font, with the same name, date and phone checks.
- **Profile page**: the record's facts use the whole width in a responsive grid; skills and languages, household and account sit side by side below. The portal-only "important dates" and "parish fields" (never stored by the API) are no longer shown.
- **Family tab**: "Link or create a household" offers "+ New household" (name, optional Arabic name); the household is created with the person as its first member and contact.
- **Offering envelopes** are no longer shown on the People and person screens (search, filter, header, Giving tab). The stored `envelopeId` is untouched; the household form (`shared/record-editor.jsx`, households area) still has its optional field.

## Fields with no API equivalent

Tags, relationship labels (`rel`, `relativeTo`, emergency flag), notification channel, important dates and parish fields, a duplicate "similarity score" (the API gives signals and differences instead), the envelope on a duplicate card, the member-side "My parish records" correction form in `profile-reviews.jsx` (`RecordCorrections`, shown on My account, still calls the old route; it belongs with the account/member modules and `GET/POST profile-corrections`).

Facts' region holds the portal's governorate; the sector is facts `Sector` (since 27 November 2026).

## Fixed in the already-connected list

The first connection used `pageSize=200` (the API allows 100) and archived without the required `version`; restore was reported as impossible but the archive route does it. All three are corrected, and `scripts/check-api.mjs` now asserts the real contract. Its "unsupported change" example now uses tags, since a name change has a route.

## Settled (2026-11, people area)

- Arabic names, rite and status live on the person record (not facts); town and Arabic town on facts.
- The office edits name, birth date and contact directly (`PUT people/{id}`).
- Town in lists: `GET people/facts` (parish-wide page). Members in the household list: included.
- Parish-wide consent list: `GET consents?kind=...` (withdrawn ones with `includeWithdrawn=true`).
- Households keep an optional town and Arabic name.

## Open owner decisions

1. **Which rites exist.** Rite is free text so no list is invented; the screens' rite filter uses the values recorded. Say whether a fixed list (and its Arabic labels) should be enforced.
2. **What Member and Visitor mean.** They are labels only: they grant no account membership, eligibility, voting, sacrament or registration rights. Say whether any rule should depend on them, and whether other values are needed.
3. **Directory opt-in when adding a person.** Settled by the owner on 27 November 2026: consents are granted by default and recorded at registration (see above). Still to confirm: the policy version label `registration-default`, and whether existing people without consent records should also count as granted (not done: the printed directory still lists only people with a given Directory consent).
4. The profile-correction list returns only pending items; decided ones cannot be listed.
5. Merges now also offer the Arabic names, rite and status as fields to choose between; confirm that is the intended review.
