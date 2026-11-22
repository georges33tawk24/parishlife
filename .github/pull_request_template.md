## What this changes

<!-- One or two sentences a parish office could understand. -->

## Why

<!-- The problem, the request or the owner decision behind it. Link the issue, report or doc. -->

## How I checked it

<!-- Commands you ran and their results, for example `dotnet test ParishLife.slnx` 591/591, `npm run check`, a screenshot. -->

## Risk and rollback

<!-- What could break, who would notice, and how to undo it (docs/operations/deployment-and-rollback.md).
     Stored data: does an older version of the app still read what this version writes? -->

## Checklist

- [ ] CI is green (secret scan, dependency audit, backend tests, frontend checks, package).
- [ ] No secret, password, token, connection string or real personal data in the code, tests, logs or screenshots.
- [ ] New rules or routes have tests; no existing test was weakened.
- [ ] Docs updated where behaviour, settings or operations changed (`docs/operations/`, `README.md`).
- [ ] Each commit message says what changed and why (`.githooks/commit-msg`).
