# Scoped administration

The Python and Cloudflare APIs use the same role policy and SQLite constraints.
The browser renders available appointments from the server's policy response.
Individual accounts replace shared administrator credentials.

## Authority

| Role | Administrative scope | Can appoint or remove |
| --- | --- | --- |
| Super Admin | Entire application | Super Admins, Archdiocese Admins, Parish Admins, permitted staff |
| Bishop | Assigned archdiocese | Archdiocese Admins, Parish Admins, permitted staff and existing clergy appointments |
| Archdiocese Admin | Assigned archdiocese and all its parishes | Parish Admins and permitted parish staff |
| Parish priest | Assigned parish | Parish Admins and permitted parish staff |
| Parish Admin | Assigned parish | Secretaries, treasurers, ministry leaders and financial viewers |

Archdiocese Admins cannot appoint administrative peers. Parish Admins cannot
appoint administrative peers. Suspension cannot be used to remove a peer or a
higher authority. Existing explicit delegation of clergy appointments to an
Archdiocese Admin remains supported; the bishop establishes clergy titles.

Administrative roles include financial and office administration. They do not
grant religious office, certificate-signing authority, or approval of sacramental
requests. A person who also has a valid priest assignment retains that authority
in that parish. Private pastoral notes remain subject to their established author
and clergy-sharing rules. Existing emergency message review requires a specific
message reference and a recorded reason.

The persisted key `diocesan_admin` is deliberately retained for compatibility;
the interface calls it **Archdiocese Admin**.

## Appointment workflow

1. Open **Administration**.
2. Select **Entire system**, an archdiocese, or a parish in **Management scope**.
3. Choose **Assign access**.
4. Select an existing account. If it is not listed, enter its complete username.
   This performs an exact, audited lookup rather than exposing a global search.
5. Choose an available role. Priest and ministry leader appointments require a
   valid person record in that parish.
6. Save. Super Admin appointments additionally require the acting user's current
   password, verified on the backend.

Use **Revoke access** beside an appointment to remove that assignment. Accounts,
person links, historical work and unrelated assignments are retained. Revocation
takes effect on the next protected request, including existing sessions.

An archdiocese needs no parish before its bishop can appoint an Archdiocese Admin.
That administrator can sign in, create its first parish, and then appoint parish
staff. Navigation without a selected parish exposes account and organization
management rather than parish screens that depend on parish data.

Account lists use server-side pages. **Load more accounts for assignment** adds
another page. Exact username lookup also allows appointment of an account beyond
the loaded page. Each account remains responsible for its own login.

In **Entire system**, **System accounts** also provides account deactivation,
reactivation and password recovery, including accounts without parish membership.
Recovery requires the acting Super Admin's current password, a recorded reason,
and a new confirmed password of 16–200 characters. It revokes the target's sessions
without changing their assignments or account status. It does not send credentials
through an unconfigured delivery service.

Every user can change their password under **My account → Change password**, even
without a parish. This requires their current password, retains the current
session and signs out their other sessions. The older parish-member recovery tool
cannot reset an account with any active staff/administrative assignment, including
an assignment in another parish. Staff cannot lower their password requirement
through the older member-portal password endpoint.

## Optional secretaries

**New parish** has an optional secretary username. Leave it blank to create the
parish without a secretary. When supplied, the account is checked before creation
and the parish and secretary grant are written atomically.

In a parish management scope, **Secretary · optional** shows current appointees.
**Manage secretaries** can keep several appointees, replace the selection, or clear
every selection. Clearing it does not remove accounts. The operation checks the
previous selection and rejects stale changes rather than replacing a concurrent
appointment silently.

The priest and permitted administrators can perform office work without a
secretary, including request review, preparation, uploads, document release,
membership and profile reviews, communications and office expenses. Existing
clergy approvals remain with an assigned priest. Office review notifications
include authorized administrators, with one notification per recipient account.

## Super Admin provisioning and recovery

No default privileged password is created. The former fixed-password demo command
has been removed. Public registration never grants developer access.

### Python installation

Run from the repository directory using the installation's Python interpreter:

```powershell
python server.py --bootstrap-super-admin developer-colin --name "Colin"
```

The operator is prompted twice for a password of 16–200 characters. No password
is printed or logged. The operation creates a new account and an explicit global
grant. An existing username is rejected without resetting or promoting it.

For exceptional recovery, an authorized host operator can use the same command
with a new, unique account name. This is a deliberate operator action, recorded
as `super-admin.operator.provisioned`, and is not a public HTTP endpoint.

Keep at least two separately controlled developer accounts. The application and
database reject removal or global deactivation of the last active Super Admin,
including concurrent attempts.

If an older preview used a known demo password, provision a fresh developer
account, sign in with it, revoke the old account's Super Admin appointment and
deactivate the old account. This update does not silently change existing
installation credentials.

### Cloudflare installation

Initialize the updated application schema in the intended D1 environment first.
Then generate an operator provisioning file locally:

```sh
node cloudflare/tools/bootstrap-super-admin.mjs developer-colin private-bootstrap.sql "Colin"
```

The password prompts hide input. Automation may supply a password through a
private input pipe with `--password-stdin`; never put it in command arguments.
The tool refuses to overwrite an existing output file. The file contains a salted
600,000-iteration PBKDF2-SHA256 hash, not the plaintext password. Treat the file as
sensitive and restrict its filesystem permissions; POSIX mode settings alone do
not configure Windows ACLs.

Review the target database and SQL, back up D1, then apply through the authorized
operator's usual D1 tooling:

```sh
npx wrangler d1 execute parishlife --remote --file private-bootstrap.sql
```

An existing username is never overwritten or promoted. If execution is interrupted,
inspect the new account and grant before retrying; do not bypass uniqueness errors.
The generator creates fresh IDs for a deliberately new account. Delete the private
provisioning file securely after the operator has verified the account.

New Worker passwords now use the Python backend's 600,000-iteration work factor.
Legacy stored hashes remain readable. Configure adequate Worker CPU capacity for
password authentication; this update does not lower password hashing to fit a
restricted hosting tier.

## Storage, migration and deployment

Relevant files:

- `backend/administration-policy.json`: role labels, scopes, ranks and appointment authority.
- `backend/administration-schema.json`: indexes, scope constraints and last-Super-Admin safeguards.
- `backend/administration.py` and `cloudflare/src/administration.js`: matching administrative workflows.
- `backend/workspace.py` and `cloudflare/src/workspace.js`: current scoped authority and account lifecycle.
- `assets/views/administration-access.js`: administrative assignments, optional secretaries and audit history.
- `backend/account_security.py`, `cloudflare/src/account-security.js`, and `assets/account-security.js`: credential changes and protected recovery.

New scoped staff accounts use an ordinary account identity and explicit
`pl_grants` rows. Multiple roles remain attached to their respective scopes.
Inactive grant rows are retained because they also suppress legacy assignments;
deleting them could restore legacy access.

Migration version 1 in `pl_authorization_migrations` backfills only an explicitly
named legacy `diocesan_admin` whose existing stored archdiocese is real. It never
promotes generic `admin` accounts. Existing inactive grant rows are preserved.
Ambiguous account roles or malformed legacy grants require operator review;
malformed scope/role combinations do not confer authority. Use a database backup
and operator review for such remediation rather than guessing organizational scope.

Secretary optionality uses assignment relationships; there is no new mandatory
secretary column, fake person, or default account. Existing parish and person
records are retained. Ordinary parish settings cannot change organizational
ownership. No parish-transfer workflow or destructive deletion flow is introduced.

Deployment sequence:

1. Stop local writers or use a consistent SQLite backup; back up the intended D1 environment.
2. Review existing privileged accounts and their recorded scopes.
3. Deploy the backend and frontend together. Python initializes additions at startup;
   the Worker initializes them before application request handling.
4. Provision secure developer access if necessary.
5. Verify the bishop and priest appointments in a staging environment, then the
   archdiocese and parish administrator workflows and secretary-free operation.

Keep the new schema when rolling application code back. An older backend does
not necessarily understand explicit global grants or retained revocations. Do not
drop grant records or safeguards to make an older application run. Restore a
consistent database/application backup if a full rollback is required.

Authorization snapshots are local to a request; no permission TTL delays revoked
access. Parish selection and administration directories use bounded database
reads rather than a query for every account/parish pair. Scope filtering happens
before directory pagination. D1's commit counter rechecks concurrent authorization
decisions before queued writes can commit.

## Audit

**Administrative history** is scoped to the selected organization; the system
scope can read all administrative events. History is read-only and paginated by
timestamp plus event ID, so simultaneous timestamps do not skip events.

Appointment changes, secretary selections, account status changes, provisioning
and existing sensitive workflows retain actor and scope attribution. Rejected
administrative mutations are recorded after their failed transaction rolls back.
Attempts outside the actor's authority are reserved to the system audit. API
responses carry an `X-Request-ID` for correlation. Failure audit records include
only selected administrative identifiers, never copied passwords or request bodies.

## Verification

See [recorded verification results](administration-verification.md) for the completed runs and baseline comparison.

Run the shared HTTP suite against both backends:

```sh
python -m unittest discover -s backend -p test_administration.py
python -m unittest discover -s backend -p test_administration_provisioning.py
python cloudflare/test/run_backend_tests.py test_administration.py
node --no-warnings cloudflare/test/administration-concurrency.mjs
```

The Worker test adapter uses Node's built-in SQLite API; verification used Node
24.22.1. Set `PARISHLIFE_TEST_NODE` to a suitable Node executable when the default
`node` points to an older installation.

For browser verification, use an isolated preview, never production accounts:

```sh
python backend/administration_preview.py
# In a second terminal with Playwright available:
node backend/test_administration_browser.mjs
```

Set `PARISHLIFE_PLAYWRIGHT_MODULE` to the Playwright module URL if it is supplied
by a separate runtime. `PARISHLIFE_PREVIEW_CREDENTIALS` can override the temporary
preview configuration path. No real parish database is opened by the preview.

The existing broader suite has pre-existing failures associated with older account,
privacy and workflow expectations. Baseline logs were captured before this update;
these failures must not be represented as passing or as proof of nationwide readiness.

## Existing operational limitations

This feature does not configure MFA, identity verification, OAuth, outbound email,
SMS, a production reverse proxy or nationwide hosting. Current interfaces continue
to identify unavailable authentication/delivery services accurately. Super Admin
changes require current-password confirmation; there is no simulated MFA success.
Production activation still needs those deployment decisions, approved data
retention and ecclesiastical workflows, capacity validation, backups and recovery
exercises, and resolution of the pre-existing regression failures.

No production deployment, remote migration, or live account change is performed
by the implementation or its verification fixtures.
