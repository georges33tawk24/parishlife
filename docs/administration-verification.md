# Administration verification — 2026-10-26

Verification used disposable SQLite databases, Python 3.12.14, Node 24.22.1,
and headless Microsoft Edge through Playwright. The installation's real database
and user accounts were not modified.

| Check | Result |
| --- | --- |
| Python administration HTTP and provisioning suite | 52 passed: 49 HTTP workflows and 3 operator provisioning tests |
| Worker administration HTTP and provisioning suite | 52 passed with the same shared tests |
| D1 concurrency scenarios | Passed concurrent removal of the last Super Admin and concurrent secretary replacement |
| Browser workflows | Passed Super Admin appointment/revocation, staff recovery, own password change, scoped role choices, secretary assignment/removal, history, first parish in an empty archdiocese, mobile layout, and Arabic RTL forms |
| JavaScript/ES module syntax | 81 files passed |
| Python compilation | Passed for server.py and backend modules |
| Git whitespace/error check | Passed |

## Broader regression baseline

| Run | Tests run | Failures | Errors |
| --- | ---: | ---: | ---: |
| Python before implementation | 95 | 25 | 10 |
| Python after implementation | 147 | 25 | 10 |
| Worker after implementation | 147 | 25 | 10 |

The failing test/subtest identities in both completed backend runs match the
captured Python baseline exactly. These include older sign-up expectations,
confidential concern fixtures, legacy workflow expectations, and public response
field expectations. They were not weakened or rewritten to obtain a passing run.
The focused suite was rerun after the disabled-account secretary cleanup fix.

The Windows Worker test adapter needed explicit UTF-8, serialized request/response
access, response ID checks, and URL-path normalization. Its static asset tests now
handle normal paths and reject encoded backslash traversal consistently. The
remaining public-site failures are the same response-contract expectations present
in the baseline.

## Important verified boundaries

- Administrative authority stays attached to its system, archdiocese or parish scope.
- Role grants, account creation, account suspension and credential recovery cannot bypass appointment authority.
- Existing sessions lose revoked permissions on their next protected request.
- Administrators do not gain clergy signing/approval through their administrative role.
- Parishes work without secretaries; replacing or clearing appointments is atomic and detects stale selections.
- Secretary assignments can be removed from suspended or disabled accounts without deleting those accounts.
- Multiple roles preserve their own scopes and valid clergy/financial capabilities.
- Scope ID collisions do not accidentally grant finance access.
- Scoped staff cannot recover other staff credentials through the ordinary parish-member reset tool.
- Member-only recovery supports approved affiliations and generates strong random credentials.
- Super Admin changes and staff recovery require current-password verification.
- Last-Super-Admin protection also exists in database triggers and guarded D1 transactions.
- Failed privileged actions are audited without copying passwords or request bodies.
- Cursor pagination does not lose events with identical timestamps or leak other organizations.
- Provisioning refuses existing usernames/output files and never writes plaintext developer passwords.

## Deployment boundary

No production deployment, remote migration or real account provisioning was performed.
The broader suite is not green, and existing MFA, identity verification and outbound
delivery services remain unconfigured. This verification establishes the implemented
administration workflows; it is not certification of nationwide operational readiness.

See [administration](administration.md) for setup, migration, recovery and test commands.
