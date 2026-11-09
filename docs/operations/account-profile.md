# Personal account profile and appearance

This backend slice supports A08: a holder's personal display name, preferred interface language and personal appearance. It does not turn personal display text into a verified legal or parish identity. No Person, household, parish membership, office contact, certificate or other official snapshot is created or changed.

## Basis and decision status

The reviewed source set is indexed by the project's source register. Actual retained files read for this implementation are under `C:\Users\User\Downloads\parishlife-master\parishlife-master\docs\ux-discovery\reviewed-answers`:

- `sections/S06.md`, S06.02: skippable profile completion and supplied names/language; account creation does not create official Person or staff facts.
- `sections/S07.md`, S07.12: personal account display/preferences, sign-in details, office records and reviewed certificate snapshots have distinct effects. S07.09 and the permission matrix P06 retain independent review of official-record corrections.
- `sections/S30.md`, S30.05: retain personal presets/custom primary/light-dark choices, readable combinations, preview/reset and unchanged official/public styling. S30.11–12 keep interface language separate from entered names, dates, money and submissions.
- `workflow-specifications.md`: shared conditional-operation/retry contract and WF01's account/profile boundary. WF32 is publishing, not authority to change public branding through this account endpoint.
- `field-dictionary.md` FM01 and `permission-matrix.md`: account fields are separate from office identity fields and grants.
- `scenario-walkthroughs.md` A29: preserve supplied scripts, entered facts and current authority on language change/retry. A24 concerns publishing and is not implemented by this feature.
- Retained `assets/theme.js`: the existing eight preset identifiers/colors and light/dark compatibility values. The backend does not integrate or edit that frontend.

These reviewed recommendations identify their new details as **proposed** and leave individual operational/design/language/accessibility approvals outstanding. This implementation is evidence of backend behavior, not a fabricated owner policy approval or an executed frontend acceptance scenario. Current owner instructions and [AGENTS.md](../../AGENTS.md) govern the work; [DTO/model conventions](../architecture/dto-model-conventions.md) apply.

## Ownership and boundaries

All routes derive the account from the authenticated principal. There is no account ID route/body selector and no administrator, priest, household, guardian or selected staff-capacity fallback. An active currently verified unlocked account may use a normal password-only sign-in when MFA is not enrolled. Enrolled accounts require their normal MFA sign-in; platform operators with MFA disabled fail closed. Restricted recovery cookies and any selected `X-ParishLife-Appointment` are rejected, including reads, previews and retries.

The profile response contains only account ID, personal display text, preferred interface language and appearance, configured/updated status, and an opaque concurrency Version. It excludes username, email, phone, password/hash, authenticator/recovery data, roles, official Person IDs and personal office facts. Unknown JSON input fields are rejected, so this endpoint cannot become an identity/contact/security editing shortcut. Sign-in contact/password changes and official-record corrections use their own independently authorized workflows.

`DisplayName` updates the existing Identity account's personal display field; `/api/auth/me` consequently returns the current display name. Security stamp, password, aliases, account verification, roles, contact details and existing sessions are preserved. Display text remains untrusted plain text for consuming renderers to encode; it must not be interpreted as HTML, official multilingual names or authority.

## API and fields

| Endpoint | Behavior |
| --- | --- |
| `GET /api/auth/profile` | Current safe state and Version; missing preferences produce read-only defaults without a write. |
| `PUT /api/auth/profile` | Conditional update with OperationId, Version, DisplayName, optional PreferredLanguage and Appearance. |
| `POST /api/auth/profile/appearance/preview` | Validate and normalize Appearance; return derived readable color pairs without saving. |
| `POST /api/auth/profile/appearance/reset` | Conditional reset with OperationId and Version; resets only appearance to Forest/light and preserves display/language. |

| Field | Contract |
| --- | --- |
| DisplayName | Required, trimmed, 1–200 characters, no control/newline characters. Supplied scripts/accents are retained. It is personal display text. |
| PreferredLanguage | `en`, `fr`, `ar` or null (no saved preference); no translation, transliteration, office synchronization, consent change or resubmission. |
| Appearance.Mode | `light` or `dark`. |
| Appearance.Scheme | `forest`, `navy`, `marian`, `burgundy`, `purple`, `teal`, `cedar`, `slate` or `custom`. |
| Appearance.PrimaryColor | A matching preset color or omitted for a preset; required `#RRGGBB` for custom and returned uppercase. CSS, alpha channels and short hex are rejected. |
| Version | Opaque value from the latest GET/operation result. Account changes, including independent security/sign-in activity, may invalidate it. |
| OperationId | New nonempty UUID per intended change. Retain the original full request unchanged for a lost-response retry. |

Preset colors, in the order above, are `#233B32`, `#1F3A5F`, `#1C4F8A`, `#6E1F31`, `#4A2D6E`, `#12514C`, `#5B3F2B` and `#2E3A46`. Forest/light are technical display defaults compatible with the retained prototype, not official branding facts. An unset language stays null; the backend does not infer a person's preferred language.

Preview chooses black/white primary text with at least 4.5:1 computed contrast, derives a link color with at least 4.5:1 contrast against its returned surface, and supplies the surface foreground as a visible focus/primary-boundary color. It exposes no arbitrary CSS or semantic success/warning/danger overrides. `Saved=false` distinguishes preview from commit. Consuming UI must use the provided pairs and retain independent semantic colors, text/icons and visible focus; these pair calculations alone do not establish accessibility of disabled/selected controls, charts, tables, keyboard operation or actual pages. Official documents/public pages never read these preferences here.

Normal cookie authentication and the existing CSRF token/header apply to PUT and both POST routes. Responses use `Cache-Control: no-store`. No frontend palette application, browser draft storage or language switching is implemented.

## Atomicity and retries

One `accountProfile` document lives in the existing Accounts container, partition `account:<accountId>`. Its fields are AccountId, PreferredLanguage, Mode, Scheme, PrimaryColor and UpdatedAt. DisplayName remains on the existing account identity document; both are committed together with a safe receipt/audit. Conditional writes to the exact current identity and existing profile versions prevent concurrent deactivation, security changes, sign-in or preference edits being overwritten. A stale first-save create also rolls back the whole batch.

GET checks the account fence before and after reading preferences and retries a bounded number of times to avoid returning a mixed name/preference revision. Every operation/replay rechecks current account eligibility and normal authentication. No public list, cross-account query or unbounded export exists.

Receipts contain only a random CommitId and AppliedAt; general audit records action/account/actor/time without display text or preference values. Fingerprints bind the normalized allowed request and version through the existing operation hash, with no credential input. Reusing an operation for different allowed values fails with `operation_reused`. Successful exact retry reports `AlreadyApplied`, the original AppliedAt and **current** authorized state. `RequestedValuesAreCurrent=false` explicitly identifies an intervening later change instead of implying it was reapplied. New edits require a fresh Version and OperationId; a stale operation is never silently rebased.

## Verification and remaining scope

`AccountProfileTests` exercises real isolated Identity/local storage and authenticated HTTP: non-writing defaults/previews, supplied Unicode display text, safe projections/metadata, preserved sign-in fields/sessions, exact and concurrent retries, current-state reporting, appearance-only reset, malformed values/overposting, stale/revocation atomic rollback, current verification/lockout/capacity/MFA checks, CSRF, no-store and actual recovery-cookie rejection. On 9 November 2026, the focused Release/net10.0 command `dotnet test ParishLife.IntegrationTests/ParishLife.IntegrationTests.csproj --configuration Release --no-restore --filter FullyQualifiedName~AccountProfileTests` passed all seven tests with zero failures/skips after the final profile source changes. This focused result is separate from the final integrated verification report. Local tests do not prove hosted Cosmos transaction behavior or live Azure access.

A08 remains partial for the complete retained user journey: frontend integration, visual/assistive-device acceptance, approved design/language reviews, draft-preserving mode/language changes and any broader signup/profile fields are not completed by this backend slice. It does not implement direct official Person corrections, legal-name/contact synchronization, notification delivery, profile photographs or a public directory. Those require their actual independent specifications and authority rather than guessed fields/policies.

DI requires `AddScoped<AccountProfileService>()`. Storage uses existing point reads and account partition batching, with no new Cosmos container, query index, Azure resource, seed or live write test.
