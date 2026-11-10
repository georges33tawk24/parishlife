# Jurisdiction and staff appointments

Implemented on 8 November 2026. These APIs record evidenced appointments; they do not confer religious office. No churches, organizations, clergy or business records are seeded. Only the two permitted Super Admin bootstrap names are configured, through the private operator procedure.

## Factual jurisdiction

`Parish.JurisdictionArchdioceseId` records factual church jurisdiction. `RegisteredArchdioceseId` and `RegisteredAssociationId` continue to describe the optional commercial association. Accepting or ending a commercial association preserves jurisdiction, parish ownership, and accepted clergy appointments. Coverage and billing remain independent checks.

The current first-link procedure is deliberately explicit:

1. The actual verified parish representative, signed in with an authenticator, reads the current parish version and posts `ProposeParishJurisdictionDto` to `/api/parishes/{parishId}/jurisdiction-proposals`. Supply the actual verified archdiocese ID, evidence reference, reason, version and a new operation UUID. Clear the acting-appointment header for this personal representative action.
2. The current accepted bishop of that exact archdiocese reads `/{proposalId}`. Read access is limited to the representative and current bishop.
3. The bishop posts `DecideParishJurisdictionDto` to `/{proposalId}/decision`, with an explicit decision, current proposal version, reason, fresh password and current authenticator code. Only an accepted decision sets jurisdiction. A Super Admin or archdiocese commercial representative cannot decide by technical rank.

The parish fence, proposal decision, operation receipt and audit commit together in the existing `TenantControl` parish partition. Stale versions change none of them. This establishes only a first factual link; contested claims, reassignment, official profile approval and parish activation require their further workflows.

## Staff invitation and acceptance

The existing first-bishop procedure is in [first-bishop-appointment.md](first-bishop-appointment.md). A current bishop can invite another active verified account through either scope:

| Role | API root |
| --- | --- |
| Archdiocese Admin | `/api/archdioceses/{archdioceseId}/staff-appointments` |
| Parish priest | `/api/archdioceses/{archdioceseId}/parishes/{parishId}/priest-appointments` |

First, the current bishop reads `GET {root}/scope` to obtain safe organization/parish metadata and its current version, without needing the representative's private billing or contact access. Post `InviteStaffAppointmentDto` to the chosen root using that version as `ScopeVersion`. The request also requires the actual nominee, matching role, explicit `Allows`/`Denies`, UTC start/end and acceptance deadline, optional review date, actual evidence/reason, and fresh bishop password/authenticator proof. `IsHead` can be requested only on a priest invitation. Self-invitation is refused. The parish must have that exact factual jurisdiction; commercial association alone is insufficient.

The nominee can discover their own invitations at `GET /api/auth/staff-appointments?size=25&cursor=...`, then read `GET {root}/{appointmentId}`. The directory contains only their own staff appointments, including historical states, and uses account/page-size-bound protected cursors. It is not a bishop directory and does not grant authority. Private evidence references are omitted from nominee and administrative projections.

The nominee must have actual enabled MFA and an authenticator-authenticated session before posting `DecideStaffAppointmentDto` to `/{appointmentId}/response`. Clear any acting header: acceptance is a personal decision. Omitted decisions, expired invitations, stale versions, another account, and an issuing bishop who is no longer current all fail. Decline grants no authority. Acceptance does not begin authority before the start time. End times are exclusive. An already accepted office does not automatically end when the original appointing bishop later leaves.

## Select one capacity

For priest operational requests, send exactly one header:

```http
X-ParishLife-Appointment: <accepted-appointment-UUID>
```

`GET {root}/{appointmentId}/workspace` returns current safe scope metadata and effective capabilities. Archdiocese Admin metadata duties are `archdiocese.read` and `archdiocese.appointments.read`; the latter permits listing archdiocesan staff metadata only. It does not expose parish appointments, private evidence, parish people, finances or clergy authority.

Priest duties are an explicit bounded set of office, scheduling, facilities, ministries, request, sacrament-recording, document-release and registration operations. Appointment does not grant technical access management, billing, finance, signature or platform privileges. A valid accepted priest office establishes priest qualification for the clergy boundary, subject to a separate explicit `clergy.approve` denial; each application action still needs its own operational permission and any paid-module coverage.

The selected appointment must belong to the current verified account, be accepted and effective, and match the exact factual parish/jurisdiction. Stored deactivation, lockout, removed MFA, suspension, revocation, expiry or a different scope prevents authority on the next check. Selected duties are never combined with the account's ordinary parish grants. Explicit parish denials still apply. Without this header, existing grant-based work remains available according to those grants. Clear the header for personal representative or platform actions; a selected priest role cannot inherit the same account's platform authority.

Consequential staff-management actions derive the exact bishop appointment and bind it into the operation fingerprint and audit. Ordinary actor commands also bind an explicitly selected appointment. Passwords and authenticator responses are excluded from receipts, fingerprints and audit.

Office revocation uses its own appointment workflow. Revocation of an unrelated ordinary technical grant remains separate from the actual bishop office, while explicit clergy denials continue to apply. Bishop qualification still requires the actual current office, factual jurisdiction and selected capacity; it grants no automatic private parish-data permission.

## Changes, reviews and head designation

Read the current appointment version before every change. The bishop posts `ActStaffAppointmentDto` to `/{appointmentId}/actions` for `Suspend`, `Resume`, `Revoke` or `Review`, with a reason and fresh proofs. Review history is retained; a review does not extend the office end date. Any new review due date must be future and within the office period. Suspension stops active work but reserves an existing head period until explicitly ended or the office is revoked/expired.

For accepted priest appointments, `PUT /{appointmentId}/head-designation` uses `DesignateHeadPriestDto` to set a nonhistorical period within the office. `POST /{appointmentId}/head-designation/end` uses `EndHeadPriestDto` to end or cancel the reserved period without extending it. Both require version, actual evidence/reason and fresh bishop proofs, and retain explicit head-change history. Ending head designation preserves ordinary priest office.

Accepted or suspended head periods cannot overlap in a parish. Multiple ordinary priests are allowed. A conditional parish-root fence serializes competing acceptance/head changes with the appointment, receipt and audit writes. The bounded conflict query fails safely if history exceeds its limit. Workspace `HasCurrentHead` and `HasHeadReservation` describe current stored observations; they do not invent an official vacancy, vacancy reason, acting bishop or replacement appointment. For archdiocesan workspaces these parish observations are null.

## Verification and remaining work

Automated tests use the actual backend, Identity, cookie/CSRF flows and isolated local document persistence. They cover acceptance/MFA/dates, authority separation, selected permissions and denials, exact scope, head conflicts/handover/history, issuer rechecks, reviews, stale atomic rollback, lifecycle changes, private evidence, credential exclusion, account-bound paging and commercial/jurisdiction independence. Real HTTP tests cover invitation, acceptance, office reads, forbidden writes, invalid acting headers, revocation and typed OpenAPI. Recovery cookies remain blocked from these protected routes.

The code uses only the existing `TenantControl` container for this slice and creates no Azure resources. Local race tests do not prove Cosmos service behavior. Live query/indexing/transaction acceptance remains pending Azure authentication. Bishop authority is rechecked before a parish write; archdiocese authority and parish data occupy different partitions, so this is not a cross-partition atomic bishop-retirement protocol. That wider succession/handover process is unfinished.

Remaining governance includes bishop succession/revocation and independently reviewed exceptional recovery, full official multilingual profiles, contested jurisdiction/claims, formal vacancy/acting/handover procedure, notifications/worklists/reminders, other staff roles and bounded delegated administration. Older unreviewed `clergyAppointment` documents are retained but do not automatically become accepted offices under this authority model. Review/migration must be explicit. Broad product features remain tracked in `docs/features/coverage.json`; this slice is not full backend completion or frontend integration.

## Office coverage and handover (O04) — 10 November 2026

Source basis: S01.03, S02.04, S02.08, S29.05. A parish may have no secretary or several: office duties come from direct access grants (any number) and from appointed priests' duties.

- `GET /api/parishes/{parish}/office/coverage` (access.manage, MFA) lists every current direct-grant holder with office duties (people.write, requests.manage, registrations.manage, sacraments.record, communications.manage), their grant end and their open assigned requests and incidents. With no holder it says so; appointed priests and the owner carry on within their own access, and nothing is reassigned automatically.
- Before revoking a departing secretary, `POST /api/parishes/{parish}/requests/handover` (access.manage, MFA) moves their open request cases to another account that currently holds requests.manage, up to 45 per run with a history entry per case; `Remaining` says whether to run it again. Revocation itself is unchanged (`POST /api/parishes/{parish}/grants/revoke` by the owner).

## Parish suspension and closure (O05) — 10 November 2026

Source basis: S02.11, S29.06. `POST /api/parishes/{parish}/status` (the bishop of the parish's jurisdiction, MFA, current parish version) with `suspend`, `reinstate` or `close` and a reason. Suspension stops ordinary parish operations at the next protected read or write, for direct grants, appointments and member routes alike, until reinstated; closure is final here. Every record, receipt and history entry stays. Each change is kept in `GET .../status/history` and leaves the parish owner a required notification.

Not implemented: the last-secretary warning inside the revoke call itself, handover of incidents, registrations and drafts, team-lead designation for office staff, global account deactivation (operator-only today), protection of higher-authority suspensions from lower overrides beyond the bishop-only rule, and reopening a closed parish.
