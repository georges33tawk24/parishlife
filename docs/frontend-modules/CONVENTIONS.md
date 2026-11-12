# Conventions for completing the full stack

These rules apply to every session that adds what the frontend still lacks, backend and frontend together. The owner has asked for Arabic names and everything else the screens show, implemented properly. Read this file, `README.md` (the module pattern), and the repository's `CLAUDE.md` and `AGENTS.md` before changing anything.

## 1. Bilingual names (Arabic and English)

Every name or title that a parish, office or person types in gets an optional Arabic twin, stored next to it:

| Latin field | Arabic twin |
| --- | --- |
| `GivenName`, `FamilyName` | `GivenNameAr`, `FamilyNameAr` |
| `Name` | `NameAr` |
| `Title` | `TitleAr` |
| `Description`, `Purpose`, `PublicInformation` | `DescriptionAr`, `PurposeAr`, `PublicInformationAr` |
| `Locality`, `Town` | `LocalityAr`, `TownAr` |

**Backend:**
- Add the twin as an ordinary optional property (`string?`, default `null`) to the model, the read DTO and the save DTO.
- Use the same `[StringLength]` as the Latin field, trimmed, with no script check, since names mix scripts.
- Records saved before the change return `null`.
- Never translate, transliterate or copy one language into the other. If a rule needs one name present, either language satisfies it unless the requirement says otherwise.
- Search should match both.

**Frontend:**
- The view model's Arabic field (`ar`, `nameAr`, `titleAr`, and so on) comes from the twin.
- For display only, fall back to the other language when the twin is empty, as the screens already do.
- A form shows both fields and saves each as typed. Never fill one from the other when saving.

French is not in the current UI; do not add French fields unless an existing DTO already has them.

## 2. People's names where the API returns account ids

Many records name their actor by account id: who sent, recorded, approved or requested something. Show a name instead, through one shared lookup.

**API:** `GET /api/parishes/{parishId}/account-names?ids={id},{id}` (at most 100 ids) returns `[{ "accountId": "...", "displayName": "..." }]`.
- It returns only the accounts the caller may see:
  - an account holding a current capacity in that parish (priest, office grant, ministry leader), to any signed-in account related to the parish
  - any other account, only when the caller has `people.read` in the parish and the account is linked to a person of that parish
- Ids it may not reveal are left out, not reported as errors.
- The **names** session builds this route.

**Frontend:** `frontend/src/portal/model/names.js` already exists:
- `await loadNames(parishId, ids)` fetches what is missing, in chunks of 100. A failure leaves names empty and never fails a module's load.
- `nameOf(parishId, accountId)` returns the name, or `''`.
- Every module calls `loadNames` in its `load` for the actor ids it shows, then displays `nameOf(...) || '—'`. In checks, mock `account-names`.

## 3. Who owns which backend model

Each area changes only its own models, DTOs, services, controllers and tests.

**Parish profile:** the public session owns it, including the fields, the edit route, the settings profile screen and the public projection. Other sessions read the profile; they do not add fields to it.

**Shared files:**
- **Service registration** (`Extensions/ServiceCollectionExtensions.cs`): add yours next to your area's existing registrations, one line each, and nothing else in that file.
- **Index contract** (`docs/cosmos/containers.json`): the local store refuses queries on paths this contract leaves unindexed, so every new queried path must be added there. Add one path per line inside your container's list.
- **Leave alone:** `docs/continuation/STATUS.md`, `README.md`, `docs/features/coverage.json` and `docs/features/implementation-status.md`. The integration step updates them. Write your notes in `docs/operations/<area>.md` and `docs/frontend-modules/<module>.md`.

## 4. Backend rules (from CLAUDE.md and AGENTS.md)

- One public type per file, with a purpose comment at the top.
- DTOs go in `DTOs/<Area>`, models in `Models`, enums in `Models/Enums`.
- Validation attributes go on input DTOs.
- Creates take an `OperationId`, and versioned writes take a `Version`.
- Keep the permission checks, ETags, idempotency and privacy rules.
- No seed or demo data, ever.
- Tests stay in source. Add integration tests for every new route and rule.

## 5. Done means

- **Backend:** `dotnet test ParishLife.slnx` passes on the SDK pinned in `global.json` (install it with the official `dotnet-install` script if it is missing), with no new build warnings.
- **Frontend:** `npm ci && npm run format:check && npm run check && npm run build` pass in `frontend/`, with your module's check extended.
- **Docs:** the module doc lists what is now connected and what, if anything, still is not, and why.
- **Git:** everything is committed and pushed to your own branch, `fullstack2-<area>`. Never push to `fullstack`, `backend` or `frontend-new2`, and never force-push.
