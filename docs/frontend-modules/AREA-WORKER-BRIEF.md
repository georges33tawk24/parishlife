# Shared brief for every ParishLife area worker

Given to each Claude worker that built a `fullstack2-<area>` branch (13-14 November 2026), on Colin's Windows machine with one worktree per area and Georges's repository as remote `upstream`. Reuse it for the remaining areas with your own paths and remote name (usually `origin`).

You finish ONE area of the ParishLife full stack: the .NET API (`ParishLife.Api`) and the React frontend (`frontend/`) together. Georges planned these areas as `fullstack2-<area>` cloud sessions that never ran; you are doing that work now.

## Where you work
- Your own git worktree (given in your task). Work ONLY inside it. It is on branch `fullstack2-<area>`, cut from local `fullstack-integration`.
- Never touch the main checkout (another session's working copy) or another worker's worktree.
- Commit AND push at every checkpoint (each coherent piece that builds and whose targeted tests pass): `git -C <your worktree> push -u upstream fullstack2-<area>`. Push only your own branch to remote `upstream`. **Do not merge. No force, no reset --hard, no branch switching.** The integrator merges your branch.
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Read first (in your worktree)
1. `docs/frontend-modules/CONVENTIONS.md` — binding rules: Arabic twin fields, the account-names lookup, ownership of shared files, done criteria.
2. `docs/frontend-modules/README.md` (module pattern) and `docs/frontend-modules/<your module>.md` (what is connected, what is not, and why).
3. `CLAUDE.md` and `AGENTS.md` (backend boundaries), `docs/REMAINING-WORK.md` (your area's row).

## Rules that matter most
- Backend: one public type per file, a purpose/main-members comment at the top of every file you create or rewrite; DTOs in `DTOs/<Area>`, models in `Models`, enums in `Models/Enums`; ordinary classes with get/set properties and safe defaults (no positional records); validation attributes on input DTOs; creates take `OperationId`, versioned writes take `Version`; keep permission checks, ETags, idempotency, privacy and recovery-session restrictions. Never put credentials in Operation.Create/fingerprints/audit.
- **No seed, demo or invented data**, ever. Never invent church facts or policy; where a rule needs an owner decision, implement the neutral mechanism and record the open question in your module doc.
- Only change your own area's models/DTOs/services/controllers/tests. Shared files: one registration line per service in `Extensions/ServiceCollectionExtensions.cs` next to your area's lines; one index path per line in `docs/cosmos/containers.json` for every newly queried path (the local store refuses unindexed queries); in `frontend/src/portal/model/modules/index.js` and `frontend/scripts/check-api.mjs` change only what you must.
- Do NOT edit `docs/continuation/STATUS.md`, root `README.md`, `docs/features/coverage.json`, `docs/features/implementation-status.md`. Write notes in `docs/operations/<area>.md` and `docs/frontend-modules/<module>.md`.
- The **account-names** route (`GET /api/parishes/{id}/account-names`) is being built by the integrator. Use `loadNames`/`nameOf` from `frontend/src/portal/model/names.js` for actor ids and mock `account-names` in your checks; do not build that route.
- **Parish profile** fields belong to the public area only.
- Integration tests for every new route and rule (authorization denials included). API-hosting tests must use the existing isolated temp-storage fixtures.
- Local tests are not Azure acceptance. Never touch Azure, never deploy, never bootstrap accounts.

## Environment (Windows, Git Bash)
Use the pinned SDK installed per-user:
```
export DOTNET_ROOT="$LOCALAPPDATA/Microsoft/dotnet" PATH="$LOCALAPPDATA/Microsoft/dotnet:$PATH" DOTNET_MULTILEVEL_LOOKUP=0
dotnet --version   # must print 10.0.401
```
- Up to 13 workers build and test at the same time on this machine (16 GB RAM). Always pass `-m:2` to `dotnet build`/`dotnet test` and never start more than one dotnet build/test at a time yourself. If a build fails with out-of-memory or file-lock errors, wait a minute and retry rather than changing code. While iterating, build only the API and integration tests and run targeted tests: `dotnet test ParishLife.IntegrationTests -c Release --filter "FullyQualifiedName~<YourArea>"`. Run the full `dotnet test ParishLife.slnx -c Release` once at the end.
- `ParishLife.AppHost` currently fails restore with NU1903 (an Aspire 13.6.4 advisory; the fix is in another branch). Ignore that one error; do not change AppHost. Everything else must build with no new warnings.
- Frontend: `cd frontend && npm ci` once, then `npm run format:check && npm run check && npm run check:routes && npm run build`. `check:routes` matches every frontend call against the API's controller routes; when you add a route that closes a gap, remove that entry from `frontend/scripts/route-gaps.json`. Never add an entry to route-gaps.json for a route you were meant to build.
- Use your worktree's absolute paths; the shell's cwd resets between commands.

## Done means
- Backend tests pass (your new ones and the full suite), frontend checks pass, module doc updated (what is now connected, what is still not and why, owner questions), all committed on your branch.
- Final reply to the integrator (under 300 words): branch name and final commit, what you built (routes, fields, screens), exact check results (test counts), what you could not finish and why, any shared-file edits (ServiceCollectionExtensions, containers.json, index.js, check-api.mjs, route-gaps.json) so merges can be planned. Do not claim anything you did not verify.
