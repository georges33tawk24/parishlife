# People module

Files: `frontend/src/portal/model/modules/people.js` (load and save), `people-workflows.js` (direct calls), `features/records/people*`, `person*`, `households*`, `membership-reviews*`, `profile-reviews*`. Check: `frontend/scripts/checks/people.mjs`. Pages: people, person, households, household, membershipreviews, profilereviews.

## Routes used (all under `/api/parishes/{parishId}`)

| Area | Routes | Where |
| --- | --- | --- |
| People | `GET people` (pageSize 100), `POST people`, `GET people/{id}`, `POST people/{id}/archive` (archive and restore: `archived` true/false, `version` from `GET people/{id}`) | list, add, archive, restore |
| Facts | `GET`/`PUT people/{id}/facts` (the whole record is replaced, so only changed fields are patched onto the stored one; `version` sent, none for the first save) | town, address cascade, occupation, skills, language |
| Medical, consents | `GET`/`PUT people/{id}/medical`, `GET`/`POST people/{id}/consents`, `POST consents/{id}/withdraw` | person page, Consent tab |
| Households | `GET households` (size/cursor), `GET`/`PUT households/{id}`, `POST households`, `POST households/{id}/members` (add, remove, set-contact), `GET households/{id}/history` | HOUSEHOLDS, each person's `hh` |
| Relationships | `GET`/`POST people/{id}/relationships`, `POST .../{rid}/end` | "Recorded relationships" panel |
| Duplicates | `GET people/duplicates`, `POST people/duplicates/decisions`, `GET people/merges/preview`, `POST people/merges`, `GET people/merges`, `POST people/merges/{id}/unmerge` | DUPLICATES, People → Duplicates |
| Search, export | `GET people/search`, `GET people/export/preview`, `POST people/export` (CSV) | membership link picker, relationship picker, Export people |
| Office queues | `GET membership-requests`, `POST membership-requests/{id}/decision`, `GET profile-corrections`, `POST profile-corrections/{id}/review` | membershipreviews, profilereviews |

Several routes need an authenticator (MFA) session; without one the API answers 403 and the part stays empty.

## How it behaves

- **Facts load when a person is opened** (the API has no bulk read) and stay cached for the session. A person nobody opened shows no town; the list's town filter only sees opened people.
- **Households**: the list has no members, so each household is read once and again only when its version changes. The head is the household's contact person; the envelope number is the household's.
- **Unsupported edits are undone and reported, and nothing is sent**: changing an existing person's name, birth date or contact (no update route; corrections go through the member's profile-correction flow), deleting a person or household, changing a household's Arabic name or town, and any portal-only field (status, rite, tags, channel, blood on the person row, important dates, parish fields).
- **Details that cannot be kept on a create** (Arabic name, rite, status, relationship label, household's Arabic name or town) are named in a notice after the rest is saved.
- The printed directory reads each person's consents when printing (no parish-wide list exists).

## Fields with no API equivalent

Arabic names (the Arabic UI shows the stored text), rite, member/visitor/clergy status, tags, town in Arabic, a household's town, relationship labels (`rel`, `relativeTo`, emergency flag), notification channel, important dates and parish fields, a duplicate "similarity score" (the API gives signals and differences instead), the envelope on a duplicate card, the member-side "My parish records" correction form in `profile-reviews.jsx` (`RecordCorrections`, shown on My account, still calls the old route; it belongs with the account/member modules and `GET/POST profile-corrections`).

The old sector level of the address has no field. Facts' region holds the portal's governorate.

## Fixed in the already-connected list

The first connection used `pageSize=200` (the API allows 100) and archived without the required `version`; restore was reported as impossible but the archive route does it. All three are corrected, and `scripts/check-api.mjs` now asserts the real contract.

## Open owner decisions

1. A bulk facts read (or town in the people list) so lists can show town without opening each person.
2. Members in the household list, to avoid one read per household.
3. Where Arabic names, rite and status should live (person facts or new fields).
4. A route to edit a person's name, birth date and contact directly for the office.
5. Parish-wide consent list for the printed directory.
6. Whether a household needs a town and Arabic name.
7. The profile-correction list returns only pending items; decided ones cannot be listed.
