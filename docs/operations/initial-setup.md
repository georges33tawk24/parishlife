# Explicit operator setup

There is no automatic administrator or business-data seed. Only `colinsleiman` and `georgestawk` are supported by the bootstrap command. Public signup cannot grant platform administration.

## Before invoking a command

Verify the target account/database and configuration directory. Azure commands use the operator's developer credential flow; they do not impersonate App Service's managed identity. The operator needs the existing data-plane permissions and access to the production Data Protection key ring/key when operating on production identities. Do not widen roles or networking automatically.

`--settings <directory>` selects a directory containing the API's `appsettings.json`. Without it, the command locates `ParishLife.Api` in the source tree. Environment variables override JSON settings. The host is built but never started, so API listeners and background jobs do not run.

## Read-only metadata verification

```powershell
dotnet run --project tools/ParishLife.Maintenance -- check-infrastructure
```

A failing probe exits nonzero and prints safe failure codes. Passing metadata reads do not prove write permission, key wrap/unwrap, or application deployment. A local-mode result explicitly says Azure was not checked.

## Bootstrap the exact two administrators

```powershell
dotnet run --project tools/ParishLife.Maintenance -- bootstrap-superadmins
```

Use a trusted interactive terminal. Confirm the exact operation, then configure each named person using their own password and actual operator verification reference. Passwords are entered without echo and must contain 16–200 characters. Do not paste credentials into a chat, command argument, source file, screenshot, or log.

For a new MFA enrollment, generate a private Base32 TOTP secret using your trusted password manager/authenticator, add the same secret to that person's authenticator, and enter it privately in the operator command. The backend stores it under account-bound Data Protection. Enter the current authenticator code to prove enrollment. No Super Admin privilege is granted until the code is verified. Secrets and recovery codes are never printed by the command.

Re-running with verified existing credentials resumes setup or verifies the existing MFA configuration; it does not reset an existing administrator's password/MFA or create additional records. Existing conflicting accounts require deliberate review; they are not deleted or silently elevated.

The two administrators have usernames without fabricated email addresses and can authenticate through the API with username/password plus MFA. Creating real organizations and other users is a later authorized application flow. A privileged recovery workflow is not implemented by silently rerunning bootstrap with a new password.

After signing in, each administrator can privately generate their own recovery codes through the MFA API with fresh password/authenticator proof. Enrollment, code replacement and independently reviewed lost-device recovery are documented in [account-mfa.md](account-mfa.md). The operator bootstrap never prints those codes or bypasses an existing factor.

## Manual identity review for ordinary accounts

`verify-identity <account UUID>` records the actual operator identity-review evidence after the claimant privately proves control of the existing account credentials. It sets `IdentityVerified` and retains the evidence reference. It does not set `EmailConfirmed`, prove inbox ownership, create accounts, or grant parish/clergy/platform authority. Actual email confirmation needs a real challenge/provider workflow. Historical confirmed-email flags need appropriate review before sensitive recovery; no bulk data changes run automatically.

## Data snapshot, verification and restore

`snapshot-export`, `snapshot-verify` and `snapshot-restore` (dry run unless `--apply`; empty isolated target only) are documented in [data-snapshot-and-recovery.md](data-snapshot-and-recovery.md). The key ring and secrets are never included.

## Isolated local development

Append `--local` only when intentionally using the separate Development document directory and keys. No local result proves Azure behavior. Do not mix production and development key rings or point test fixtures at production.
