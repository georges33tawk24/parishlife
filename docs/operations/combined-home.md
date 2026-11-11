# Combined Home and capacity choice (D01)

Updated 11 November 2026. Source basis: S02.05, S03.01–S03.06, all *proposed* refinements of the owner direction "one combined home; one role enters directly, several require a choice".

- `GET /api/me/home` (signed-in, active verified account, no `X-ParishLife-Appointment` header, no recovery session) returns one account-level view:
  - `Parishes`: every parish the account follows or serves, each with its own separate flags `Following`, `Member` (active person link), `MembershipPending` (own Submitted/NeedsInformation request), `Primary`, the account's own unread notices for that parish and the kinds of capacity held there.
  - `Capacities`: each capacity currently valid, listed separately and never merged — `Priest` / `ArchdioceseAdmin` staff appointments (accepted, effective, verified archdiocese, matching jurisdiction, verified parish; duties after the appointment's and the parish grant's explicit denials), `Bishop` (the archdiocese's current seat), `MinistryLeader` (current Leader/Assistant period, not denied ministries.manage), `ParishGrant` (legacy direct grant) and `PlatformOperator`. `AppointmentId` is the value to send in `X-ParishLife-Appointment`; null means the capacity is used without it. All need MFA to act; `SessionHasMfa` says whether this session has it.
  - `HomeState`: `NoParish`, `Personal`, `AwaitingAssignment` (staff history but no current capacity), `SingleCapacity` (with `DirectCapacity`) or `ChooseCapacity`. Plus total unread notices, pending staff invitations and the public directory link.
- `GET /api/me/capacities` returns the same capacity list for a role switcher. Capacities are recomputed on every call, so a suspended or ended appointment disappears without a new login.
- The choice is not stored server-side: each request (and therefore each tab) carries its own selected appointment and every action re-checks authority. The home reads no office queues or records; per-parish work counts stay at `GET /api/parishes/{parish}/work-overview` in one chosen capacity.
- All-parish browse is the anonymous directory, see `public-directory-and-offline.md`.

## Not delivered
Direct grants and ministry leadership are discovered only in parishes the account follows or serves (those records have no account-side index). Remembered per-role views and filters (S03.06), draft-preserving switch prompts, personal task/inbox counts, terminology dictionary (S03.04), navigation menus and the frontend. Local tests do not prove live Cosmos cross-partition query behaviour.
