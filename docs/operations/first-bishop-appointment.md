# First bishop appointment: implemented slice

This records an actual evidenced appointment; software does not confer religious office. Startup creates no organization, clergy, or appointment. Names, jurisdiction, rite, responsible people, and appointment evidence remain factual inputs.

S02.02 gives Super Admins first-diocese/bishop setup responsibility; S02.12 requires dates and acceptance. Independent administrative review follows the proposed S02.13 safeguard as a conservative implementation assumption. Named organizational approval of that policy remains an input. Technical rank grants no bishop/priest authority.

1. An authenticated MFA-protected Super Admin registers the actual archdiocese at `POST /api/archdioceses` and completes explicit representative verification. Setup needs no parish or Person record.
2. Get the current organization version from the administration verification endpoint. Post `ProposeBishopAppointmentDto` to `/api/archdioceses/{id}/bishop-appointments` with a different existing active verified nominee, actual evidence/reason, UTC effective dates, acceptance deadline, and any review due date.
3. A different active MFA-protected Super Admin reads the proposal and posts `ReviewBishopAppointmentDto` to `/{appointmentId}/review`. The proposer/nominee cannot perform this independent review. Require an explicit approval/rejection and current proposal version.
4. The named nominee reads their invitation and posts `DecideBishopInvitationDto` to `/{appointmentId}/response`. Omitted decisions and expired/rejected invitations fail. Decline grants no authority.
5. Acceptance conditionally creates one first-bishop seat and updates the appointment, receipt, audit, and organization fence in one existing `TenantControl` archdiocese partition. Local competing-acceptance tests have one winner; actual Cosmos behavior still requires isolated service verification.

`IArchdioceseAuthority` checks the current verified active account, enabled MFA and current MFA authentication, verified organization, exact seat/appointment, acceptance, dates, and revocation. Review deadlines do not silently extend or terminate authority. End dates are exclusive. Nominee projections hide private evidence references; operator review sees the reference, not the file.

This slice is initial appointment API/service/persistence plus an authority boundary. Archdiocese Admin invitations, parish-priest appointments, head periods, personal staff discovery and selected acting capacities are now implemented in [staff-appointments.md](staff-appointments.md), with their remaining limits. Bishop succession/revocation approval, formal handover, bishop directory/worklists and the broader organization profile remain incomplete. The account MFA enrollment/recovery API is described in [account-mfa.md](account-mfa.md), with its remaining all-factors-lost/password-recovery limits. No complete governance or signature workflow is claimed.

The real local service tests cover review, acceptance, effective dates, expired/rejected/declined invitations, stale-write rollback, competing seat claims, unrelated-account denial, and account/MFA enforcement. The HTTP test authenticates the two separate administrators and nominee through password/TOTP, real cookies and CSRF. This is neither frontend integration nor live Cosmos acceptance.
