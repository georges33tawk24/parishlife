# Handoffs from Agent 06 (Legal, privacy and content)

## 1. Account deletion and data copy promised by the privacy policy
- **To:** Agent 03 (app security and auth)
- **File:** `ParishLife.Api/Identity/CosmosIdentityStore.cs` (`DeleteAsync` returns `DeletionRequiresReview`), `ParishLife.Api/Services/Administration/AccountStatusService.cs`, `ParishLife.Api/Services/People/PersonDataService.cs`
- **Requested change:** When you build the account-and-data deletion flow, cover the two promises the published privacy policy makes "by request": (a) deleting an account, and (b) giving a person a copy of their data. Today neither is possible: deletion is refused, and there is no own-data export. Please send me back the deletion details for the confirmation wording (Part B item 11): what is deleted, what is kept for legal reasons (official, financial and safeguarding records) and for how long.
- **Reason:** `frontend/privacy.html` ("By request … a copy of your data, deleting your account") and `terms.html` ("to close your account, write to …") promise something the code cannot deliver. See `hardening/legal-drafts/privacy-policy.md`, row 32.
- **Priority:** High

## 2. Account-linked browser storage left after sign-out
- **To:** Agent 03 (app security and auth)
- **File:** `frontend/src/portal/features/records/sacraments.jsx` (`pl-anniversaries-<account id>`), `frontend/src/portal/model/modules/finance.js` (`pl-finance-session:<parish id>`), the sign-out path in the portal
- **Requested change:** Remove these two localStorage keys at sign-out. Alternatively, key the anniversaries layout without the account's internal ID.
- **Reason:** On a shared computer they show that a given account, and its finance work for a given parish, were used in this browser. They are listed in the cookie policy draft. Low impact, but it is an easy fix.
- **Priority:** Low

## 3. Confirm what the technical logs keep, and for how long
- **To:** Agent 08 (DevOps and SRE)
- **File:** `ParishLife.Api/Extensions/TelemetryExtensions.cs`; Azure Application Insights and Log Analytics settings (read-only)
- **Requested change:** Confirm and record in `docs/operations/`:
  - (a) the retention of the Application Insights data. The privacy page says 90 days.
  - (b) that IP masking is on, meaning `DisableIpMasking` is not set.
  - (c) whether request telemetry stores query strings. For example, `GET /api/public/parishes?q=` carries the directory search text.
  - (d) the Cosmos continuous-backup window and the blob soft-delete period (the page says 7 and 30 days).
  - (e) where operator snapshots are stored and how long they are kept.
- **Reason:** The privacy policy states (a) and (d) as facts, and they cannot be checked from the repository. (c) and (e) are missing from the policy. See `hardening/legal-drafts/privacy-policy.md`, rows 12, 29 and 30.
- **Priority:** Medium
