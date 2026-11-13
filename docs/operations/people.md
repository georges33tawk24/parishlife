# People record additions (people area)

Updated 13 November 2026. Routes are under `/api/parishes/{parish}`. Screens and open owner questions: `docs/frontend-modules/people.md`.

## Person record

- `Person` (and `PersonDto`, `CreatePersonDto`) gain optional `GivenNameAr`, `FamilyNameAr` (Arabic as typed, never derived from the Latin name), `Rite` (free text, at most 100 characters) and `RegisterStatus` (`Member`, `Visitor` or null), plus `UpdatedBy`/`UpdatedAt`. Records saved earlier read back with null.
- `RegisterStatus` is a label only. It grants no account membership, eligibility or access; parish membership (account links) and ecclesiastical office stay separate. Clergy is not a register status.
- `PUT people/{personId}` (`UpdatePersonDto`): the office replaces the given and family names, Arabic twins, birth date, contact, rite and status. It needs `people.write`, the office module and an authenticator session, a matching `Version` (409 on a stale one) and an `OperationId` (replays return the first result). It answers `{ value, version }`. Audit action `person.update`; no field values are put in the audit.
- Archive/restore, merges, unmerge and the scenario store keep the new fields. Merges list `GivenNameAr`, `FamilyNameAr`, `Rite` and `RegisterStatus` as fields to choose between when they differ.
- Search matches Arabic names too (mark-insensitive, so hamza forms match). Export may choose `GivenNameAr`, `FamilyNameAr`, `Rite` and `RegisterStatus` columns.

## Facts and consents

- `PersonFacts` gains `TownAr`; a town in either language makes the locality "Listed", and neither may be combined with `LocalityNotListed`.
- `GET people/facts?size=1..100&cursor=` pages every stored facts record of the parish (same rules as one person's facts: `people.read`, office module, authenticator session).
- `GET consents?kind=Directory|Photo|Communications|Event|Representation&includeWithdrawn=false&size=&cursor=` pages the parish's consents of one kind; withdrawn ones only on request. It uses the existing `/data/kind/?` and `/data/status/?` index paths; `docs/cosmos/containers.json` is unchanged.

## Households

- `Household`, `HouseholdDto` and `SaveHouseholdDto` gain optional `NameAr`, `Town` and `TownAr`. A town change on an existing household adds a `town` history entry with the previous town.
- `GET households` now returns each household with its members (one member query and one person read per member, server side). Member and relationship names carry `DisplayNameAr`/`RelatedNameAr` only when an Arabic name is recorded.

## Verification

`ParishLife.IntegrationTests/PeopleRecordTests.cs` covers these rules through local services and storage, including denials (no write permission, no authenticator session, unrelated account, stale or missing version, future birth date, unknown consent kind, page size) and one HTTP pass with real cookies, MFA, CSRF and isolated storage. Local storage tests do not prove Cosmos query or transaction behavior.
