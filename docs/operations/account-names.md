# Account-name lookup

`GET /api/parishes/{parishId}/account-names?ids={id},{id}` resolves the account ids that parish records carry (who sent, recorded, approved or requested something) to display names. The frontend uses it through `frontend/src/portal/model/names.js` (`loadNames`, `nameOf`). Rules come from `docs/frontend-modules/CONVENTIONS.md` section 2.

## What it returns

`[{ "accountId": "...", "displayName": "..." }]`, only for ids the caller may see. Ids it may not reveal are left out, never reported as errors, so the answer does not say whether an account exists.

- **Current capacity holders** in the parish are named to any signed-in account **related** to the parish:
  - capacity: a current parish grant (not revoked, in its date window, at least one allowed permission not denied), an effective priest appointment of the parish's jurisdiction, or a current ministry leader or assistant of a ministry of the parish;
  - related: an active, claimed link to a current person of the parish (a member), a follower, or a capacity holder.
- **Any other account** is named only to a caller with `people.read` and the office module in the parish (the same check as the people list), and only when that account is actively linked to a current, non-archived person of the parish.
- Inactive accounts and accounts without a display name are never named.
- A closed, suspended or unknown parish returns an empty list.

Input: 1 to 100 distinct ids, comma-separated (`ids_required`, `too_many_ids`, `invalid_id` otherwise, as 400).

## Limits

- Capacity holders are read with one bounded query per kind (500 rows each for grants, staff appointments and ministry leaders). A parish beyond that bound would leave some holders unnamed; it fails closed (no name), never open.
- Each revealed name is a point read of the account; office lookups add up to three point reads per id for the person link. At 100 ids this is a few hundred point reads; acceptable for screens, but a cache or a parish-side name projection would be the upgrade if it shows in Cosmos RU costs.
- The display name is what the account holder typed. It is not an official spelling from the parish register, and the lookup never shows the person record's name instead.
- Verified locally (`AccountNamesTests`, local storage). Not verified against Cosmos.
