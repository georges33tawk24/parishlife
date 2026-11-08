# Account MFA and reviewed device recovery

This backend slice uses the existing Accounts container and the account's complete partition. It creates no initial users, churches, appointments, or other business records. Frontend integration remains deferred.

## Authenticator enrollment and rotation

An active verified account signs in normally, obtains CSRF state, and posts `BeginMfaEnrollmentDto` to `POST /api/auth/mfa/enrollment`. Supply the current password. An already-enabled account also supplies its current authenticator code, or uses the approved recovery procedure below. The response contains the private shared key, standard authenticator URI, enrollment ID and ten-minute expiry. Render any future QR locally; the backend does not call an external QR service.

The active authenticator is unchanged during setup. `POST /api/auth/mfa/enrollment/complete` requires the enrollment ID, current password and the new device's actual code. Ordinary rotation also requires a fresh code from the old device. The server verifies through ASP.NET Core Identity, then commits the new protected key, enabled state, replacement recovery codes, new security stamp, completed enrollment, audit and safe operation receipt together. The old enrollment secret is removed from the pending document.

Successful completion signs out the current browser and invalidates earlier sessions/challenges through the changed security stamp. Sign in using the newly proved authenticator. This never changes the account's platform, parish, bishop or priest authority.

Identity supplies the key and recovery-code generators and authenticator verification; application code supplies the Cosmos transaction boundary. See the maintained [UserManager source](https://github.com/dotnet/aspnetcore/blob/v10.0.14/src/Identity/Extensions.Core/src/UserManager.cs), [authenticator provider](https://github.com/dotnet/aspnetcore/blob/v10.0.14/src/Identity/Extensions.Core/src/AuthenticatorTokenProvider.cs), and [recovery-code store contract](https://github.com/dotnet/aspnetcore/blob/v10.0.14/src/Identity/Extensions.Core/src/IUserTwoFactorRecoveryCodeStore.cs).

## Recovery codes and restricted sign-in

Enrollment returns the new codes once. Existing MFA users, including the two bootstrapped administrators, can generate a set at `POST /api/auth/mfa/recovery-codes` with a fresh password and authenticator proof. Replacement invalidates old codes and sessions/challenges. Codes are protected per account through Data Protection. Plain secrets and proofs are excluded from operation fingerprints, receipts and audit. A repeated completed issuance does not return locally generated, uncommitted codes. If a response is lost, sign in with the actual authenticator and request a new set with a new operation ID.

Start the normal username/email and password login to obtain its five-minute challenge. Complete it at `POST /api/auth/login/mfa/recovery` with the account ID, challenge and one unused recovery code. Code removal, challenge consumption and a fifteen-minute recovery session commit atomically. Replays, stale security versions and expired challenges cannot consume further codes or create a normal MFA session.

The signed cookie and stored session both carry authentication method `recovery`. Middleware permits only public endpoints and explicitly marked account-security actions. Regular application work, administration, bishop actions and ordinary password changes are blocked. The recovery cookie cannot claim authenticator MFA. The owner can inspect/revoke their sessions and request reviewed device recovery.

`GET /api/auth/mfa/status` returns actual enrollment state and remaining-code count without secrets. `GET /api/auth/sessions` returns persisted sessions with effective Active, Revoked, Expired or Invalidated status and authentication method; it invents no device names.

## Independently reviewed lost-device reset

1. From the restricted recovery session, post `RequestMfaRecoveryDto` to `/api/auth/mfa/recovery-requests`, proving the current password and recording the real reason. The request lasts 24 hours. Give its account/request reference to the authorized reviewer through the actual support process; the API does not pretend to send a message.
2. Another active MFA-authenticated Super Admin reads `/api/administration/accounts/{accountId}/mfa-recovery-requests/{requestId}` and posts its `/review` action. Approval/rejection is explicit and version-checked. Review requires the reviewer's current password, authenticator code, reason and actual identity-review evidence reference. Self-review is forbidden.
3. Approved reset authority lasts thirty minutes and is bound to that account's current security stamp. The owner begins enrollment with the approved recovery request ID. That approval is bound to the current enrollment; expired/rejected approvals, changed security versions and an ineligible reviewer fail.
4. The owner proves the new authenticator. Its activation, new codes/stamp and consumption of the approval commit together. Previous cookies/challenges become unusable. Sign in normally with the new device before returning to privileged work.

The process verifies account ownership and records an actual operator review. It does not establish religious office or give the reviewer automatic access to confidential parish records. A stored evidence reference is not a claim that any external message or official approval occurred.

## Verification and remaining scope

Fifteen new local integration cases cover real enrollment/rotation, duplicate races, failed proof preservation, account-bound protected codes, competing redemption, old-code/challenge invalidation, expiry, independent review, rejected/stale/revoked approvals, restricted cookies, CSRF, and full operator access restoration. HTTP contracts have typed OpenAPI responses; internal Identity records are excluded. These tests use explicit temporary storage, not Azure or the frontend.

Recovery when both the authenticator and all saved codes are lost is not implemented by this slice. Verified-contact password recovery, broader break-glass procedures, approved MFA disablement/alternate methods, notifications/delivery, request worklists, retention and live Cosmos/hosted acceptance remain. The source feature register stays partial. Bootstrap cannot silently reset an existing administrator's MFA.

Existing production key-ring continuity must be preserved. Older cookies whose stored sessions lack the authentication-method field require one fresh login; historical methods are reported as unknown rather than guessed. Nothing in this implementation deploys or changes live accounts automatically.
