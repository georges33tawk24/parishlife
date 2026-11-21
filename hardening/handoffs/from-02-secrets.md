# Handoffs from Agent 02 (Secrets and dependencies)

Each entry gives To, File, Requested change, Reason and Priority. No secret value appears here.

## 1. Fail fast on half-configured secret settings (wire the new checks)
- **To:** 03
- **File:** `ParishLife.Api/Extensions/ServiceCollectionExtensions.cs`, `RegisterAuthenticationCapabilities`
- **Requested change:** after my branch merges, call the new checks at registration and stop startup with their message. The messages name the setting and never contain its value. The existing `Storage` check uses the same style.
  ```csharp
  var turnstile = configuration.GetSection("Turnstile").Get<TurnstileOptions>() ?? new();
  if (turnstile.ConfigurationProblem() is { } turnstileProblem) throw new InvalidOperationException(turnstileProblem);
  var email = configuration.GetSection("Email").Get<EmailOptions>() ?? new();
  if (email.ConfigurationProblem() is { } emailProblem) throw new InvalidOperationException(emailProblem);
  // inside the ExternalSignIn loop, before `if (!settings.IsConfigured(provider)) continue;`
  if (settings.ConfigurationProblem(provider) is { } providerProblem) throw new InvalidOperationException(providerProblem);
  ```
- **Reason:** item B2 asks for startup validation. Today these three cases fail silently:
  - Setting only one of the two Turnstile keys switches the bot check off without a word.
  - A Resend or OAuth setup with a missing value turns the feature off.
  - A Key Vault reference that cannot be resolved arrives as the literal text `@Microsoft.KeyVault(...)`. It then counts as "configured" and breaks sign-in or email at run time.

  The checks are `TurnstileOptions.ConfigurationProblem()`, `EmailOptions.ConfigurationProblem()`, `ExternalProviderOptions.ConfigurationProblem(provider)` and `AzureConfiguration.IsUnresolvedKeyVaultReference`. `ParishLife.UnitTests/ConfigurationProblemTests.cs` covers them.
- **Before the next deploy (owner):** check that the App Service settings are either complete or empty for each feature. Otherwise the app will refuse to start, which is the intended fail-fast behaviour.
- **Priority:** High

## 2. Silent catch blocks in the API
- **To:** 03
- **Files and requested changes:**
  - `ParishLife.Api/Services/Communications/NotificationOutcomeReader.cs` line 35: `catch (Exception) { ...; return Outcome("Unconfirmed"); }` logs nothing. Add `logger.LogWarning("Notification outcome read failed. Failure type: {FailureType}", error.GetType().Name)` before returning. Log the type only, never the message.
  - `ParishLife.Api/Services/Sacraments/CertificateService.cs` line 348: `catch (DomainException) { }` swallows every domain error. Narrow it to `when (error.Kind is FailureKind.NotFound or FailureKind.Forbidden)`, as on line 346.
  - `ParishLife.Api/Services/Scheduling/ServicePlanService.cs` line 310: `catch (DomainException) { }` inside the celebrant loop. Narrow it the same way, so a store failure is not reported as "not a priest".
- **Reason:** item B11. A swallowed error hides real failures, such as a storage outage, behind an ordinary answer. The filtered `catch ... when (...) { }` blocks elsewhere are deliberate control flow and can stay.
- **Priority:** Medium

## 3. Silent promise rejections in the frontend
- **To:** 05 (portal UI and public site); 03 for `frontend/src/lib/rich-text.js`
- **Files and requested changes:**
  - `frontend/src/portal/shell/Portal.jsx` lines 637 and 674: `endSession().catch(() => {})` and `hydrate().catch(() => {})`.
  - `frontend/src/portal/features/records/person-records.jsx` line 35: `reloadPerson(id).catch(() => {})`.
  - `frontend/src/portal/features/dashboard/dashboard.jsx` line 692: `.catch(() => {})`.
  - `frontend/src/portal/features/records/sacraments.jsx` line 519: `catch {}`.
  - `frontend/src/public/main.jsx` line 38: service-worker registration `.catch(() => {})`.
  - `frontend/src/lib/rich-text.js` line 23: `catch {}` (owned by 03).
  - For each one, either show the existing error toast or banner (for user-visible reloads), or add a one-line comment saying why ignoring the failure is safe (sign-out, service worker).
- **Reason:** item B11. The `response.json().catch(() => null)` parse fallbacks are deliberate and can stay. `console.warn` in `portal/shell/actions.jsx` line 861 is a deliberate "no verb" developer warning, not debug output, and can stay.
- **Priority:** Low

## 4. Unreferenced types to delete (02 proposes; the path owner applies)
- **To:** 03
- **Files:**
  - `ParishLife.Api/Models/AttendanceCorrection.cs`
  - `ParishLife.Api/Models/ClergyAppointment.cs`
  - `ParishLife.Api/Models/MinistryRules.cs` (neither `AttendanceStatuses` nor `IsLiturgy` is used anywhere)
  - `ParishLife.Api/DTOs/Ministries/AttendanceGridDto.cs`
- **Requested change:** delete them.
- **Reason:** item B6. Nothing refers to them: I checked the API, all test projects, the frontend and the docs, and no stored document type names them. Keep `Models/AttendanceRecord.cs`, because `MinistryMeetingTests` uses it.
- **Priority:** Low

## 5. Duplicated one-line helpers
- **To:** 04 (owns `Interfaces/Repositories/**`, where `RecordScope` and `RecordCondition` live); then 03 for the call sites in `Services/**`
- **Requested change:** after 03 merges, add shared factories and replace the private copies:
  - `RecordScope.Parish(id)`: about 52 copies of `new() { Area = RecordArea.Parish, OwnerId = parish }`, named `Scope` or `Parish`, in 46 or more service files.
  - `RecordScope.Account(id)`: 8 copies.
  - `RecordCondition.Equal(path, value)`: 20 copies.
  - `Guard.OptionalText(value, name, max)`: 14 copies of `string.IsNullOrWhiteSpace(value) ? null : Guard.Text(...)`.
  - Shared `NotFound(message)`: about 10 copies of `new("resource_not_found", ..., FailureKind.NotFound)`.
  - A single token-hash helper (`Convert.ToHexString(SHA256.HashData(...))`) in `PersonInvitationService` and `RequestService`.
- **Reason:** item B11, merging functions duplicated across files. This is a behaviour-neutral refactor, so do it last to avoid merge conflicts.
- **Priority:** Low

## 6. CI: secret scan and dependency audit commands
- **To:** 08
- **File:** a new CI workflow
- **Requested change:** run these on every push and pull request:
  - `gitleaks git --redact --no-banner --log-opts="--all"` for full history, or `gitleaks git --redact --log-opts="<base>..HEAD"` per pull request.
  - `dotnet restore ParishLife.slnx --locked-mode`, then `dotnet list ParishLife.slnx package --vulnerable --include-transitive`. The step fails if the output contains `has the following vulnerable packages`.
  - `cd frontend && npm ci && npm audit --audit-level=high`.
  - Optionally `dotnet list ParishLife.slnx package --outdated` and `npm outdated`, report only.

  The pre-commit hook `.githooks/pre-commit` runs the same gitleaks rules locally. Enable it with `git config core.hooksPath .githooks`.
- **Reason:** items B3 and B5, so that new leaks and vulnerable packages are caught before a deploy.
- **Priority:** High

## 7. Project map correction
- **To:** 01
- **File:** `hardening/PROJECT_MAP.md` section 16
- **Requested change:** remove the row saying that `.gitignore` ignores `docs/REMAINING-WORK.md` and `docs/frontend-integration.md`.
- **Reason:** `git check-ignore --no-index` shows that no rule ignores either file. Both are tracked and visible.
- **Priority:** Low
