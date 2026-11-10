# Work overview operations

Updated 10 November 2026. Source basis: S03.07–S03.09 (proposed).

`GET /api/parishes/{parish}/work-overview` (current MFA) counts distinct open, actionable cases per queue for the current viewer. It includes only the queues whose permission the viewer already holds, so a restricted queue (for example incidents, which needs `incidents.manage`) never shows a count to anyone else. A viewer with no matching permission gets not-found.

Queues and what they count:

| Area | Queue | Permission | Counts |
| --- | --- | --- | --- |
| Requests | Open requests | requests.manage | cases not completed, declined, withdrawn or cancelled |
| People | Membership requests | people.write | Submitted, NeedsInformation |
| People | Profile corrections | people.write | Pending |
| People | Data closure requests | people.write | Submitted |
| People | Person invitations needing review | people.write | NeedsReview |
| Finance | Expenses awaiting approval | finance.approve | Submitted |
| Finance | Unmatched bank lines | finance.post | Unmatched (lines) |
| Finance | Outstanding bank differences | finance.approve | Outstanding (lines) |
| Sacraments | Register corrections awaiting decision | sacraments.record | Pending |
| Care | Open incidents | incidents.manage | Recorded, Assigned, FollowUp, Resolved |

Each count states its unit, statuses and list route, and the response carries the time it was computed. Counts are never rankings or comparisons between parishes. A failed call is an error, never a zero.

Not implemented: "needs my action" versus team work, waiting-for-applicant splits, ministry leader and bishop queues, period reports (attendance, membership, giving and budget definitions still need owner approval), exports and frontend.

## Capability report (W06)

`GET /api/capabilities` (any signed-in user) lists what this deployment really has: email, SMS, online payments, electronic signatures, external sign-in and the bot check are **not configured**; scheduled jobs follow `BackgroundJobs:Enabled`; private file storage is the local folder or the existing evidence container. No retention classes are approved, so nothing is deleted automatically. Screens should use it to avoid offering or claiming a delivery, charge, signature or deletion that does not happen. It reads configuration only and contains no secrets.

Not implemented: parish settings screens, approved retention classes with holds and disposition, and switching integrations on (each needs its provider, credentials and owner approval).
