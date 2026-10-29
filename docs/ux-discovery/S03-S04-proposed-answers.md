# ParishLife — S03 owner answers and S04 proposals

These answers cover all 14 questions in S03 and all 12 questions in S04. They are written for a nationwide product beginning with Beirut Archdiocese, Saint Abda and Foucas Church, and Saint Georges Church.

Read with [the questionnaire](questionnaire.md), [refined S01/S02 answers](S01-S02-refined-answers.md), [project review](project-review.md) and [decision register](decision-register.md).

**Status: S03.01–S03.06 owner directions recorded; additional detail remains proposed. S03.07 is unanswered by the owner, and S03.08–S03.14/S04 remain proposed.** This document changes no application behavior and does not automatically approve earlier recommendations.

The draft preserves confirmed directions: all existing modules remain in scope; laptops/web are primary; English, French and Arabic are required; several scoped roles may belong to one account; office preparation is separate from priest decisions; and a secretary may record a priest's prior approval without requiring another online approval.

The latest owner direction is one combined home, a role chooser for accounts with multiple available roles, navigation derived from permissions, a combined parish view and loss of old access when roles change. This supersedes the earlier proposal for separate personal and work home screens and automatic entry into the last-used role. Role selection remains distinct from choosing an extra personal home. Detailed permission enforcement, confidential-access boundaries and translation publication rules beyond these directions remain proposals from S01/S02.

## S03 — Navigation, dashboard, search and work queues

### S03.01 — First screen after login

**Owner direction:** An account with one available role enters its dashboard directly. An account with multiple available roles chooses the role it wants to use and then enters the dashboard. Do not skip this choice by automatically opening the last-used role. The account remains signed in when switching between its authorized roles.

The dashboard is the one combined home described in S03.02. It adapts to the selected role and includes the account's permitted personal/community information without requiring another home/workspace switch. An ordinary member identity does not by itself add a redundant role-choice step for someone with only one working role; exact role-choice presentation is a UX detail for validation.

People with no parish relationship can discover nearby/selected-area parishes and read publicly listed events and other published parish information. Location access is optional; locality/name search remains available. A follower without approved membership sees the parish's published events and public information, but following does not expose office records, private group content or other people's data.

An unassigned priest receives a clear **Awaiting parish assignment** state, with their own account information and public discovery still available. This is a pending state, not parish working access.

**Proposed refinements for additional account contexts:** The following table describes priorities inside the same combined home, not separate personal/work home screens. Detailed dashboard contents remain open under S03.07.

| Account/context | First destination and immediate purpose |
| --- | --- |
| First Super Admin, no organization yet | System Home with initialization steps: establish second privileged account, diocese and bishop appointment |
| Super Admin after initialization | System Home: organization status, authorized administration work and relevant access/support issues; no automatic private-record feed |
| Bishop | Diocese Home: parish overview, clergy/administrative matters and decisions actually requiring the bishop |
| Archdiocese Admin | Diocese Administration Home: permitted organization/office work and delegated responsibilities |
| Head or other assigned priest | Parish Home: requests requiring a priest, today's/upcoming calendar, office exceptions and actions recorded on his behalf |
| Parish Admin | Parish Office Home: intake, preparation, calendar/reservation/event issues and authorized administrative work |
| Secretary | Parish Office Home: today's calendar, requests to prepare/follow up, reservations and event registrations |
| Treasurer | Finance Home: actual finance work, reconciliation/approvals within authority and clearly dated balances |
| Finance viewer | Finance Overview: permitted summaries/reports, with viewing rather than transaction-entry actions |
| Ministry leader | Ministry Home: assigned ministries, meetings, membership reviews, attendance and volunteer work |
| Member with approved parish link | Personal Home: own requests, upcoming activities, messages and commitments |
| Account following parishes without membership | Personal Home with followed public activity, membership status and explicit next steps; no implied staff/person-record access |
| Account with no parish relationship | Personal Home with Find a parish, follow/choose primary parish and optional profile completion |
| Priest account with no current assignment | **Awaiting parish assignment** home state, own account information and public discovery; no parish records opened automatically |

A valid direct link received before login should return the user to the intended record after authentication, required role choice and access checking. A link must not silently select a privileged role or a different parish. A role must not force an ordinary account to redo completed onboarding on every login.

### S03.02 — Staff and personal parish life

**Owner direction:** Provide **one combined home** so staff do not need extra steps between work and their own parish life. Do not require a separate personal-home/work-home switch. The role chooser in S03.01 selects the acting role; it does not introduce another layer of home selection.

**Refined answer:** The same dashboard contains the selected role's permitted responsibilities and the signed-in account's permitted personal/community information. Group related cards/sections clearly, using one navigation shell and shared account/language/appearance controls. Specific card priority remains for S03.07, which the owner has not answered.

One combined home does not combine every role's powers or reveal colleagues' personal information. It includes only information the current account may see. A secretary's own requests, personal notes or concerns, if available under their legitimate account/member permissions, remain account-private rather than becoming office/team records. No staff title automatically creates parish membership. The earlier blanket secretary personal-route restriction must be reviewed against this combined-home direction; exact personal-feature eligibility remains a permission-matrix detail rather than an assumed approval of every personal module.

### S03.03 — Navigation by role and context

**Owner direction:** Show sections according to permissions granted through roles and any authorized person-specific grants.

**Refined answer:** Use one navigation shell that reflects the selected role, current permitted parish/diocesan scope and any valid scoped individual grant. A role in one church must not reveal a section's records in a church where that permission is absent. View-only access shows viewing tools; edit/approval/release/export actions each require their relevant permission. Changing the visible menu does not itself grant or remove backend authority.

**Proposed organization:** Put frequent work at the top and group supporting modules under descriptive labels. The table below is a candidate arrangement of permission-enabled sections, not an approved fixed menu or a collection of separate home screens.

All retained modules must have an understandable destination for roles allowed to use them. A shorter primary navigation is not removal from scope. Show only authorized destinations; account/workspace controls remain available without any selected parish.

| Workspace | Primary destinations | Supporting grouped destinations |
| --- | --- | --- |
| System administration | Home, Organizations, Accounts & access, Administrative activity | Platform settings, scoped support/recovery and authorized system reports |
| Diocese/bishop | Home, Parishes, Appointments, My work, Diocese calendar | Authorized reports/finance, diocesan administration and relevant certificate-review queue if retained |
| Diocese administration | Home, Parishes, Accounts & access, My work | Scoped office support, reports, public information and explicitly delegated appointments |
| Priest | Home, Requests, Calendar, Reservations, Ministries, People | Households; sacramental preparation/records; Services & Activities; events/registrations/check-in; volunteers; facilities/equipment; communications/music; finance/office expenses; private pastoral work; reports/forms/audit/settings/administration as authorized |
| Parish Office — Parish Admin | Home, Requests, Calendar, Reservations, Ministries, People | Households, preparation, event forms/registrations/check-in, facilities/volunteers, permitted office expenses, public-content administration, permitted staff/settings/report tools |
| Parish Office — Secretary | Home, Requests, Calendar, Reservations, Ministries | People/households, sacramental preparation, Services & Activities, event forms/registrations/check-in, volunteers, facilities and Office Expenses; contextual in-app communication |
| Finance — Treasurer | Home, Giving, Finance, Reports | Permitted donor/household lookup, reconciliation, receipts, financial settings and authorized exports |
| Finance viewer | Overview, Finance, Reports | Only permitted viewing/printing/export; no editing routes |
| Ministry leader | Home, My ministries, Meetings/attendance, Volunteers, Calendar | Membership applications, resources/formation, ministry communication, services/music/check-in where explicitly assigned |
| Personal | Home, My requests, Ministries, Calendar, Inbox | Meetings, attendance, commitments, announcements/resources/formation, private notes, profile/official records, concerns, notifications and My account |

Exact labels/group placement should be validated in prototypes with the first two parishes; feature permissions remain controlled separately. Bishop review is included conditionally because its final policy remains open in S14.

Open person, household, request, certificate, event, reservation and ministry detail pages through their parent collections and related links. Keep editing, document release and individual history contextual to their record. Put infrequent account/settings controls in the account or relevant administrative menu. Do not put private cases in a broad More menu accessible to unrelated users.

### S03.04 — Consistent names and terminology

**Owner response:** “All of them.” Record this as a direction to review and standardize all the ambiguous labels listed in the question. It does not select the final English/French/Arabic wording of every replacement.

**Proposed completion:** Adopt an English/French/Arabic terminology dictionary. The labels below are proposed English labels; translated ecclesiastical terms and official organization names require approved language review rather than automatic transliteration.

| Current ambiguity | Proposed user-facing treatment |
| --- | --- |
| People / Parishioners | **People** for the office collection, since it can include visitors, children, clergy and other recorded persons; parish membership is a separate status |
| Groups / Ministries | **Ministries & Groups** for the collection; each record has a type such as choir, catechism class or committee |
| Dashboard / Home | One combined **Home** with the selected acting role and clear parish/combined-view context |
| My parish life / member Home | Personal/community content within the combined home and permitted direct destinations; no extra personal-home switch |
| Member portal / Website content | Public header: **Sign in** or **My account**; inside administration: **Public website → Content**, rather than calling the content editor Member portal |
| My account / My profile / My parish records | **My account** for login, preferences and appointments; personal profile content under it; **My parish records** for office-held facts and correction requests |
| Eparchy / Diocese / Archdiocese | Use the organization's approved ecclesiastical term in that context; internal generic labels must not overwrite its official identity |
| Requests / Forms | **Requests** for submitted work; **Event registrations** for event applications; **Forms & workflows** for reusable form/process definitions |
| Messages / Messaging / Notices | **Inbox** for private conversations; **Communications** for authorized audience composing/publishing; **Announcements** for published updates |
| Sacraments / Certificate | Use explicit labels: **Sacramental preparation**, **Official entry**, **Certificate request** and **Issued certificate**, according to the record/stage |
| Approval on behalf | **Record priest's approval**, with priest and actual entering secretary preserved in history |

Labels must describe actual outcomes. Do not call a submission a reservation confirmation, preparation an official record, an uploaded file a verified original, or a signed certificate ready for collection before all required later gates are satisfied.

### S03.05 — Parish and organization selection

**Owner direction:** Use a **combined parish view**.

**Refined answer:** The combined home can show permitted information across the parishes associated with the account. Provide **All my parishes** and an optional parish filter rather than requiring repeated parish switches simply to browse activity. Each card, event, request and task identifies its parish and, where relevant, the role/authority through which it is visible.

Distinguish **Member**, **Following**, **Membership pending**, **Primary parish** and actual staff appointments. A followed parish contributes its published public information; an approved membership contributes permitted personal/member information; an active staff appointment contributes operational information only where the selected role/grant permits it. Primary parish is a personal default, not wider authority.

Combined display does not merge records or authority across parishes. When creating a request, event, reservation or other record, choose/confirm one target parish. When acting on an existing record, its own parish remains the target. If a different acting role is needed, offer an explicit role change rather than invisibly borrowing permission from another appointment.

Diocese/system scopes remain clearly labeled. A national directory or combined overview does not make every listed parish operationally editable. Similar parish names are disambiguated by locality/diocese. Detailed filter memory and default combined-view presentation remain UX refinements for validation.

### S03.06 — Context changes and remembered views

**Owner direction:** When a person's role changes, they must lose the information/actions their previous role no longer authorizes. An open page or remembered view does not preserve the former access.

**Refined answer:** Refresh the available role choices, navigation, combined dashboard, search results, counts and record/action permissions when appointments change. Apply the new authority to protected reads and writes without waiting for a new login. Remove now-inaccessible detail content from active views; previously delivered information cannot be assumed to have been unseen. If the selected role is no longer available, show the updated role choice or an allowed home/pending state. Unrelated valid roles/parish relationships remain intact.

**Proposed completion of the remaining view-memory question:** Remember language, appearance, accessibility preferences and collapsed navigation per account. Remember collection view, allowed columns, sort, page size, filters and calendar position separately for each account/role/parish where appropriate, including the combined-view filter.

When switching role within the same parish, retain a compatible calendar period or collection filter only if its fields and records remain permitted. When switching parish, restore that parish's own last view or use a safe default. Never carry a person ID, selected row, pending approval, resource, household or document into another parish.

The current page may stay open only when its collection exists and is authorized in the destination. Otherwise return to the combined home or an appropriate allowed/pending state and explain the change. Preserve recovery material only where the user remains entitled to retain it.

For unsaved changes, offer **Save draft**, **Discard** or **Stay here**, only where a draft is supported and the account may retain it. Submitted facts cannot be moved to another parish by changing the selector. Clear bulk selections, close approval/release confirmations and recheck authority before any subsequent action.

Each open tab maintains its own target context. Another tab's parish switch must not silently change the target of an existing form. Remembered settings are preferences, not permission grants; validate them after a role is removed or a module becomes unavailable.

### S03.07 — Dashboard contents and metric definitions

**Owner answer: Open.** The owner left item 7 blank. The dashboard layout, cards, priorities and metrics below remain recommendations, adapted to one combined home; they have not been approved by the blank response.

The first visible area should show the active context, today's relevant responsibilities, work the user can actually act on, and useful next actions. Calendar, reservations and ministries get prominent placement in parish workspaces, consistent with S01 priorities.

| Workspace | First-screen priorities |
| --- | --- |
| Priest | Needs my decision; today's/upcoming calendar; reservations requiring his decision; ministry/office exceptions; **Recorded on my behalf** activity; quick links to Requests/Calendar |
| Secretary/Parish Office | Today's calendar; preparation/follow-up queue; reservations awaiting office work; event-form/registration issues; ministry coordination; Create request/event/reservation where permitted |
| Bishop | Diocesan work requiring his authority; parish/appointment exceptions; upcoming diocesan responsibilities; scoped overview with explicit date period; conditional certificate decisions |
| Diocese administrator | Onboarding/appointment tasks, authorized parish support, pending requests in own scope and administrative follow-up |
| Super Admin | Initialization where applicable; organization/account administration; actual support/access issues; platform status only from real available information |
| Treasurer | Open finance tasks, actual count/reconciliation work, authorized approvals, dated balances separated by currency and pending evidence |
| Finance viewer | Scoped financial summaries/reports with date range and no transaction-entry controls |
| Ministry leader | Next meetings, pending permitted membership work, attendance not yet recorded, volunteer gaps and tasks for assigned ministries |
| Personal | Own active requests and next steps, upcoming permitted activities/commitments, unread messages/notifications and membership/onboarding progress |

Every metric defines **record unit, organization scope, period, applicable statuses, refresh time and drill-down**. Examples:

- **Needs my decision:** Distinct authorized open cases whose next available decision belongs to this acting capacity. Excludes information-only updates and cases blocked by unmet prerequisites.
- **Office preparation:** Distinct open cases awaiting a required office step; show whether assigned to me, another colleague or unassigned office work.
- **Upcoming reservations:** Confirmed reservations in the displayed upcoming period, with tentative requests shown separately.
- **Ministry members:** Active roster membership in the selected group/scope; “memberships” and unique people must not be conflated across several groups.
- **Unread messages:** Conversations/messages addressed to the current account according to one consistently defined read unit; not staff-wide message volume.

Show missing/unrecorded data as **Not recorded**, **No data for this period** or **Unavailable**, rather than fabricated sample values or an unjustified zero. Confidential case counts are absent for unauthorized users. **Recorded on my behalf** is an activity/notification item, not an approval still waiting for the priest to repeat it.

### S03.08 — One work inbox with module views

Provide **My work** as a unified triage experience across the user's current authorized scope, with clear filters rather than merging underlying record types into one undifferentiated process.

Primary views should be **Needs my action**, **Office/team work**, **Waiting**, **Completed** and **All permitted**. Waiting can be filtered to applicant information/documents, another authority, planned date or an external dependency. Group/filter by parish, type, stage, owner, due date and priority where those facts exist.

Requests remains the principal intake/processing collection. Membership, profile corrections, guests, sacramental requests, bookings and event-related work can appear in the same triage interface while opening their specific review screens. Existing module queues remain useful filtered views of the same canonical work, not competing copies with different status/count rules.

Each row shows reference, subject, parish, request type, current stage, next action, responsible person/role and relevant received/due/last-updated date. Internal notes and applicant-visible replies remain separate.

An optional **Across my workspaces** overview may aggregate authorized work for one account. Actions require the correct acting workspace; selecting an item offers an explicit context switch. It does not combine powers from unrelated assignments. Confidential concerns, private pastoral work and restricted incidents use separate authorized queues and do not leak titles, existence or counts through the general inbox.

Accepted online/guest work that links to an office record retains its origin/reference without appearing twice for the same next step. A secretary can record an already-given priest instruction through the case's authorized action even though the normal digital decision queue points to the priest; the interface must not demand a nonexistent prior online instruction.

### S03.09 — Badges and counting rules

Navigation badges indicate **authorized outstanding work**, not the total size of a collection. Put collection totals such as People/Households/Ministries inside their pages, where their meaning is clearer. Put unread counts on Inbox/Notifications separately.

Recommended rules:

1. Define one canonical actionable case per workflow record with a currently permitted next action. A linked online submission and resulting office record do not count as two cases for the same work.
2. **Requests** counts actionable cases in the selected workspace/scope, including membership, corrections and guest work where that user can act. Show their category breakdown inside the queue.
3. A combined **My work** total is a deduplicated union, not the arithmetic sum of several overlapping module badges.
4. Waitlists contribute the number of event waitlists requiring a staff decision if rows represent events; participant counts are separately labeled. Never mix “events needing review” with “people waiting” under one unexplained number.
5. Priest/bishop decisions count only when the user has the relevant decision and actual stage is ready. Unresolved bishop policy does not create an automatic bishop badge.
6. Information-only recorded-priest-approval updates count as unread activity/notifications where relevant, not as approvals waiting again.
7. Exclude closed, withdrawn, cancelled, finished and inaccessible cases. Work assigned to another person appears in an authorized team view rather than inflating **Needs me**.
8. All badge/list/dashboard figures use the same scope and unit. A filter clearly explains why a visible subset differs from the unfiltered badge. Show loading/failure instead of treating an unknown count as zero.

After transitions or access changes, refresh counts and lists consistently. No count, tooltip, search result, exported total or cross-parish summary may reveal a restricted concern's existence to an unassigned user.

### S03.10 — Global search scope and privacy

Search should find permitted records and destinations using English, French and Arabic names/content, supplied alternate official names, phone, request reference, register number, household and allowed event/ministry/resource fields. Preserve stored names; searching should not rewrite official spellings or invent translations.

Default staff search to the active parish/workspace. Offer an explicit wider scope only when authorized. Public search searches only published public information. Personal search searches the person's permitted requests, conversations and community records rather than the staff directory. System account administration has a separate authorized account lookup, not a public identity search.

Group results by type and identify parish/locality, record label, reference and permitted status. Match sensitivity must be respected before returning results or counts. Do not expose donor details, medical data, internal notes, document contents or private account identities merely because they match text.

Confidential concerns, pastoral/private notes and private conversations should use their dedicated permitted search surfaces. Global search may offer the destination **My concerns** or **My notes** without indexing other people's content. No search suggestion should confirm the existence of a restricted case.

Phone/email search must account for permitted normalization/international formats while preserving original data. Searching a number does not authorize its public disclosure. If nothing matches, offer a permitted next action such as changing search scope or creating a new record after duplicate checking; do not automatically create one.

### S03.11 — Search results, detail pages and return navigation

Selecting a result should open the stable detail page for that record and relevant tab. Use full pages for requests/timelines, people/households, event/reservation details, ministry records and official-entry/certificate work. Drawers serve short edits or previews without replacing the only addressable version of a record.

If the result belongs to another permitted parish/workspace, name the destination and offer an explicit switch. Preserve the search query, allowed scope, filters, sort, pagination and scroll position for **Back to results**. Breadcrumbs should explain the record's parent collection rather than force a browser-history guess.

Recheck access and record state when opening and again before action. If the result is now archived, show an authorized archive detail with a status banner. If it is no longer available, explain the limited situation and offer a safe return without exposing a prior confidential title. A notification, bookmark and search result should resolve to the same underlying record rather than three competing copies.

### S03.12 — Collection preferences, selection and bulk actions

Support consistent search/filter/sort/pagination on People, Households, Requests, Ministries, Registrations, Reservations, Facilities/Equipment, financial collections, reports, and authorized account/administrative history lists.

Save preferences per account and relevant parish/workspace. Provide useful defaults, visible active filters and **Reset view**. Proposed page-size choices are 10, 25, 50 and 100 where appropriate; large administrative collections should not attempt an unbounded “show everything” screen. Restricted fields cannot be added through a column picker.

Selection must distinguish **Select this page** from **Select all matching [count]**. A selected-count summary persists while selections exist. Changing scope/filter must clear selection or explicitly explain which selected records remain; no hidden selection may be acted upon accidentally.

Allow bulk actions only when each record is eligible and the action is understandable: permitted export, reminders through working channels, assignment or eligible archive. Before mutation/export, show record count, scope, action and any excluded/ineligible items. Return item-level outcomes and preserve successful results when some items fail.

Do not introduce blanket bulk sacramental signing, signature application, guest-file release, sensitive-case action or independent financial approval as a convenience. Those require separate explicit workflow authorization. Bulk recording of a priest's offline instruction, if ever permitted, must enumerate the cases and preserve per-case attribution; it is not approved by this section. Export scope is explicit: **Selected**, **All matching filters**, or an authorized complete collection.

### S03.13 — Phone layouts and essential actions

Although laptops are primary, phone layouts must support public/member journeys and essential away-from-office staff work. Transform long rows into cards or labeled detail expansions when needed. Horizontal scrolling is acceptable for genuinely two-dimensional calendars/matrices, with an obvious indication and an accessible list/detail alternative.

Each actionable request/reservation card retains its reference/type, subject, parish, stage, next action, relevant date and responsible role. A money card retains actual currency/amount and status; guardian/medical fields remain restricted rather than casually copied onto a public-facing card.

Use full-screen flows for long requests, complex person/household editing, reservation selection, document review/release and consequential approval confirmations. Keep the current parish, acting role, authorizing priest where applicable, primary action, Back/Cancel and visible validation. Prevent keyboards or fixed bottom navigation from covering errors and final controls.

Offer touch/keyboard alternatives to drag-and-drop, hover menus and tiny calendar cells. A tap to open detail must not also approve. Do not conceal an essential status or action solely to make the layout fit. Camera/file upload and return-from-reauthentication must preserve the permitted draft context.

### S03.14 — Moved, archived, deleted and unauthorized links

Use a consistent access-checked record resolution experience:

- **Moved/renamed record:** Redirect only to its verified successor within the user's authority, preserving context and a simple explanatory notice. Do not infer a match from a similar name.
- **Archived record:** Show a read-only detail/status when permitted, with restoration only for authorized roles. Archiving should not automatically break all historical links.
- **Closed/cancelled workflow:** Retain its history and outcome; show any permitted next request/reopening action rather than a live approval control.
- **Unauthenticated user:** Sign in, then return after checking access. Do not expose the record title/content on the login page.
- **No longer authorized or record unavailable:** Use a neutral **This item is unavailable or you do not have access** response without confirming private record existence. Offer Back, workspace Home or a nonrevealing access/support route.
- **Expired/revoked guest tracking link:** Offer the office's approved recovery/contact process without revealing another applicant's request or issuing a new link merely from a claimed name.

Detailed distinctions can be shown only to authorized administrators/support staff. Error pages must not contain previous confidential titles, amounts or identities. A permanently removed unused setup is different from an archived institutional record and must not turn into a public list of former private contents.

## S04 — Public directory, parish pages and visitor discovery

### S04.01 — Purpose and action order of the public homepage

The public homepage is primarily a useful parish-discovery and visiting tool. Proposed priority:

1. **Find a parish** by name, place or diocese.
2. **Find Mass/confession times** and plan a visit.
3. **Contact or make a request to the correct parish**.
4. Discover public activities and ministries.
5. Learn about ParishLife and adoption by parish teams.

The first screen should provide an obvious search/Find a parish action, language control and Sign in/My account. Place Mass-time search within easy reach. Keep introductory imagery/copy concise enough that it does not bury these tasks, especially on phones.

For a returning visitor, offer their previously selected parish without redirecting them away from the directory automatically. A generic homepage must not silently select the first parish in the database. Once a visitor chooses a parish, request/contact actions clearly identify that parish before submission.

The directory represents participating/published parishes, not an asserted complete list of every church in Lebanon. At initial launch it may legitimately show only the two participating parishes. The interface should scale to additional dioceses without fabricated sample parishes, visits, events or live activity counters.

### S04.02 — Directory filters and cross-parish time search

Provide text search across approved English/French/Arabic parish names and locality names. Useful directory filters are diocese, locality/region, supported rite/jurisdiction where relevant, and **Online requests available**. At national scale, reveal hierarchical location filters progressively; do not force several geographic selections before a visitor can search by name.

Default sort is parish name in the chosen display language, with locality and optional nearest-distance alternatives. Always show locality/diocese to disambiguate similar church names. Do not introduce an unexplained recommendation ranking or make the nearest parish look like the visitor's automatically assigned parish.

Offer a separate **Find a Mass** search across published participating parishes, with date/day, time range, celebration language, parish/locality/diocese and service type where supported. Confession availability should be clearly distinguished from Mass; appointment-only confession appears as such, not as an invented timed session.

Results require structured recurring schedules with actual dated exceptions/cancellations so “next Mass” and time filters have defensible meanings. This is a design dependency for S05.08/S16; existing free-text times must not be parsed or guessed into supposedly verified occurrences. Where structured data is unavailable, show the parish's approved published schedule text and a contact action, with exact-date filtering unavailable for that record.

Give **Today**, a chosen date and a clearly defined upcoming period, displaying parish-local date/time and celebration language. Surface published changes/cancellations and avoid claiming real-time confirmation when the parish only maintains a posted schedule.

Show the results count, active filters, Clear filters and helpful no-result alternatives. Never translate “no schedule published” into “no services exist.”

### S04.03 — Parish card contents

Each directory card should identify the parish and help a visitor decide whether to open it without exposing internal records.

Required card information:

- Approved parish name in the selected language, with other supplied official names accessible when useful.
- Locality and diocese; relevant rite/jurisdiction label only when accurate and helpful.
- Verified parish photo or neutral church illustration/emblem.
- Clear **View parish** action; a separate useful contact/request action where genuinely available.

Optional, only when supported by actual published information:

- Next published Mass time/language from the dated schedule.
- **Online requests available** or **Contact parish office**.
- Published office hours; **Open now** only when structured hours, parish time zone and exceptions support the calculation.
- Approximate distance when location/coordinates are valid.
- Verified accessibility information, avoiding ambiguous unsupported “accessible” claims.

Missing data should not be replaced with guessed times, personal numbers or sample photographs presented as actual parish images. “Hours not published” is different from “Office closed.” Deactivated/closed parishes must not receive an active request button; any retained public historical listing clearly identifies status and the appropriate contact/custodian.

### S04.04 — Map and optional location

Hide the nonfunctional map preview from ordinary public navigation until a working geographic map is configured. Retain real-map support in the product scope; an unconfigured integration is an availability state rather than a reason to remove the feature permanently. The directory/list and verified directions links remain fully useful without it.

A future map must reflect the same published parishes and filters as the list, use verified locations and offer a list alternative. It cannot display fabricated pins or suggest that an inaccurate illustrative location is verified.

Request browser location only after the visitor selects **Use my location**. Explain its purpose as nearby sorting/filtering. If refused, unavailable or inaccurate, preserve the ordinary directory and let the visitor enter a town/region; do not repeatedly prompt or require permission to browse.

When distance is enabled, label it approximate. Selecting a radius should genuinely limit results with known coordinates to that radius; offer an explicitly labeled way to view more. Parishes without coordinates may appear in a separate **Distance unavailable** group or ordinary name/locality results, not as if they met the radius. Do not calculate directions from a parish name when a verified address/coordinate is required to identify the correct church.

Keep precise visitor coordinates out of shared URLs and ordinary logs/exports. Propose session-only nearby preferences with a clear **Clear location** control. External map/directions navigation should name the destination/provider and use only approved public parish location information.

### S04.05 — Parish profile structure

Use one consistent public profile structure across participating dioceses, populated with approved parish information rather than staff-state data. The proposed order prioritizes visiting and contact:

1. **Identity and actions:** Parish name, locality/diocese, verified image/emblem and clear status; View times, Make a request, Contact and Directions as available.
2. **Mass/confession times:** Published schedules, celebration languages and specific exceptions/cancellations; avoid hiding this practical information below a long parish story.
3. **Plan your visit:** Verified address/directions, office contact/hours and accurate accessibility information.
4. **Parish calendar:** Upcoming published activities with a dedicated full-calendar link and explicit public details.
5. **Requests and parish services:** Relevant request types with a plain-language explanation that office/priest review follows submission.
6. **Ministries & groups:** Approved description, eligibility/schedule where public and Ask about joining/Apply through the appropriate route.
7. **Meet the parish:** Approved clergy names/titles/roles; approved ministry contact roles, using office contact defaults.
8. **Latest announcements:** Current published notices with dates and expiry where relevant.
9. **About/history and gallery:** Verified story, supplied imagery/captions and descriptive text.
10. **Contact footer:** Office details, maintained contact hours, other official links and the relevant next action.

Use a simple section navigation/contents menu and shareable public event/request pages. Hide optional empty sections cleanly without breaking navigation. Keep Request/Contact reachable on phones without intrusive controls covering content. Private family names, attendance, request status, finances or personal profiles never appear merely because they are linked to a public event or ministry.

### S04.06 — Missing information and publication readiness

Distinguish **required identity/readiness**, **useful but unpublished** and **optional content**.

Minimum proposed public/operational activation requirements: correct organization identity, approved English/French/Arabic core parish labels, verified diocese/locality, an active responsible priest/authorized contact owner, adoption/activation approval and at least one usable public office contact route or explicitly staffed contact mechanism. Publish a verified address/location or accurately indicate its absence; do not invent coordinates.

These readiness checks must be compatible with S02.03's **Create and activate** action. Once required setup is confirmed, creation activates/publicizes the parish without an additional unpublished queue. Incomplete setup can remain a private draft. The owner must approve any change to what counts as minimum readiness before implementation.

For missing useful information, show a limited honest prompt such as **Mass times have not been published. Contact the parish office to confirm.** An unpublished confession schedule or office hours should not be shown as closed/unavailable in fact. Hide optional story, empty gallery or ministries without public descriptions; absence of a gallery must not prevent an otherwise ready parish from operating.

Core public labels and reusable content follow the proposed three-language publication policy. Editors see missing-language readiness before publishing. Partial optional content can remain draft while the existing complete public page stays available. A content fallback must be explicit and must not disguise incomplete French/Arabic support as completed translation.

Wrong identity/diocese, no authorized responsible office, inaccurate mandatory contact or an unapproved parish must block activation, not merely display a decorative warning. Exact jurisdiction and names remain owner/diocese inputs; this draft does not fill them from sample data.

### S04.07 — Real photographs and illustrative assets

Prefer verified images supplied/approved by the parish. Until available, use a neutral church emblem or clearly illustrative nonidentifying artwork on named parish cards/pages rather than an unrelated real church photograph suggesting it depicts that parish.

General homepage imagery may remain illustrative when labeled near its use and appropriately attributed. Proposed wording is **Illustrative image — not a photograph of this parish.** A footer credit alone is insufficient if a named parish's hero visually implies an authentic local photograph.

Record image source, approval, caption and descriptive text in the content workflow. Photos of identifiable people, particularly children, require the parish's approved publication procedure; uploading an image is not itself permission to publish it. Inspect captions/alt text for private names or details before publication.

When a real image is withdrawn or unavailable, return to the neutral fallback and retain layout/readability. Do not require uploading photographs to activate the parish. French/Arabic image descriptions and labels are part of launch content readiness.

### S04.08 — Public clergy, ministry and contact details

Publish only approved public clergy information: supplied name, ecclesiastical title, parish function/head designation and relevant official parish contact. Staff/clergy appointment changes should trigger review of the public listing; an internal person record is not automatically a public profile.

Ministry pages may show an approved leader name or role where the parish and relevant person have authorized publication. Default contact is the parish/ministry office route rather than the leader's personal phone/email. A person may supply a genuinely intended public contact, but it must be explicitly designated and removable; never copy an account's login contact into a website field automatically.

The head priest is accountable for parish public-contact correctness; appointed office staff may prepare/maintain it under the agreed publishing authority. Diocese/bishop authority validates clergy title and appointment facts. Public publishing permission and clergy appointment permission are separate.

Contact actions should clearly show which office receives the message, available hours and whether the route is phone, email, external service or in-system request. Do not imply an external channel delivers when it is only a stored preference. Where a leader leaves or a number changes, update the public contact and offer a maintained office fallback without revealing the former contact's private record.

### S04.09 — Public event titles and family privacy

Default publicly visible sacramental events to generic titles such as **Baptism celebration**, **Wedding celebration** or **Funeral service**, with the approved time/location. Do not automatically reuse the internal request title, household surname or person name as public calendar text.

Provide separate fields for internal title/details and approved public title/description. Visibility also applies to linked images, captions, attendee lists, documents, calendar feeds/downloads, search snippets, reminder content and shared previews; a public event is not permission to publish all its related records.

A named public announcement/event may be allowed only through the parish's explicit publication procedure, with the relevant subject/authorized family approval and authorized parish publication approval. Staff should record the approval scope rather than assuming that requesting the sacrament means agreeing to public publicity. Minor/guardian and funeral-announcement handling must follow the final parish/diocesan policy specified in later sections.

If publicity is withdrawn or corrected, update future public displays/feeds and keep an appropriate internal history. The system cannot honestly promise to retract copies already downloaded/shared. Staff/member/clergy audiences may receive different details only where the corresponding access rules permit them; public names cannot be restored through an alternate export or list view.

### S04.10 — Guest requests and discovery

Offer clear request groups on the parish page, with only configured, genuinely supported choices active:

| Group | Discoverable request types and expectations |
| --- | --- |
| Sacraments and official documents | Baptism, First Communion, confirmation/chrismation, marriage, funeral and certificate, according to approved parish/jurisdiction support |
| Facilities | Hall/room/outdoor-space booking where supported; show permitted availability without other applicants' private details |
| Pastoral services | House blessing, sick/home visit, Mass intention, meeting/appointment with priest and another pastoral request |
| Parish/community | Ministry inquiry and other general office requests |

An inquiry about joining a ministry is not approval of ministry membership. A guest appointment request is not an automatically reserved time. A booking request is not confirmed occupancy. A certificate request is not issuance. Every type must state who handles it and the next expected step.

Guest and member versions should collect the same essential facts for the service, using conditional structured questions where necessary. Signed-in linked members can prefill permitted household/person data; guests provide their own information with only the necessary contact and relationship details. Exact fields, authorization for others and supporting documents remain S11–S15 decisions. Do not demand an account merely to contact or make a supported guest request.

Before submission, show selected parish, request type, subject, supplied details, contact method, required physical follow-up and an understandable review summary. Submitting a sacramental need routes it to authorized preparation and priest decisions, including the already-agreed secretary-recorded-priest-instruction path when applicable; it does not give a guest internal sacramental access.

After submission, show a reference and private tracking route with clear instructions to keep it safe. Permit the future office-reviewed association to an account; do not auto-create membership/person/staff access from a guest submission. Tracking tokens and private document URLs must never appear in public search, share buttons or event previews.

When online requests are disabled for the parish or a particular type, show **Contact the parish office** with the real route and relevant hours. Existing applicants retain the authorized tracking/follow-up route even when new submissions close. Public ministry inquiries and signed-in formal ministry applications remain clearly distinguished.

### S04.11 — Urgent pastoral contact

Provide an obvious **Urgent pastoral need? Contact the parish** route for funeral arrangements, a sick visit or another time-sensitive pastoral matter. Use a direct, maintained office/designated pastoral contact where supplied. An online request can accompany the contact but must not imply immediate review.

Display contact hours and any actually maintained out-of-hours number. **24-hour** or **emergency** availability is used only when the parish has designated a real staffed arrangement. ParishLife's online queue is not automatically an emergency dispatch or continuously monitored response service.

The head priest is accountable for this route; authorized office staff keep details and exceptions current. Require periodic confirmation when parish leadership/contact arrangements change. If no out-of-hours route exists, state the published availability plainly instead of inventing one or repeatedly suggesting that an unavailable office is staffed.

Messages must distinguish **request received** from **someone has read/responded**. Do not promise SMS/email/WhatsApp alerts until those services actually deliver. Urgency may flag permitted office/priest work, but it does not bypass confidential access, identity review, priest authority or official document requirements.

Specific contact numbers/hours and escalation arrangements must be supplied by each parish. None are guessed from church names or current sample records.

### S04.12 — Public links, language, back navigation and marketing

Give every published parish and public event a stable, shareable public URL. Resolve by an unambiguous stable identity, with readable names where useful; similar names in different towns must never collide. Renaming a parish should preserve an access-checked redirect from its old public link.

Preserve appropriate public directory state in links/history: text query, locality/diocese filters, sort, selected date/service filters, view and language. Preserve browser return position/pagination when going back from a profile. Precise visitor location, tracking tokens, private filters, account identities and confidential record references do not belong in public sharing URLs.

Keep the visitor's chosen English/French/Arabic language through directory, profile, event, request, success and contact journeys. A language switch retains the current parish and permitted form state. Public share previews must contain the approved public translation/title, not private internal event details. Missing optional translations follow the agreed publication policy without silently substituting incorrect official names.

Keep the current public directory/parish site as the public service entry point. Retain a separate marketing/about area for **About ParishLife / For parish teams**, reachable through appropriate navigation/footer links, with product explanation, bundles and adoption/contact information. Avoid two competing sites each pretending to be the parish directory or showing divergent parish information.

The marketing page must accurately describe configured product capabilities. It does not initiate billing merely because bundles appear. Public **Sign in** returns existing users to the relevant account/workspace, with **Create account** available without interrupting guest browsing. After login from a legitimate public request link, retain the intended parish/type while rechecking actual membership and authority.

## Design-review cases for S03/S04

These cases validate the recorded owner directions and remaining proposed answers in a prototype; they are not claims that the current application passes.

| Case | Expected result |
| --- | --- |
| N01 — First Super Admin, no diocese | Initialization controls appear; no dependency on selecting a nonexistent parish |
| N02 — Ministry leader and treasurer, same account | Explicit role/workspace choice; permitted records/actions follow that capacity; no second login |
| N03 — Role differs across two parishes | Header and confirmation identify correct parish/role; draft/selected rows cannot cross scope |
| N04 — Secretary with a personal membership | One combined home; only that account's permitted personal content appears, and it does not become office/team content |
| N05 — Priest approval recorded by secretary | Case advances once; priest sees attributed activity/notification; no repeat-approval badge |
| N06 — Guest request becomes office case | Origin/reference remain linked; same next action is not duplicated in badge or queue |
| N07 — Restricted concern exists | Unassigned user receives no result, count, suggestion or indirect badge information |
| N08 — Browser Back from search result | Original query/scope/filter/page/position restored where still permitted |
| N09 — Parish/role revoked with form open | Protected action stops; accurate result and safe destination; no cross-scope recovery leak |
| N10 — One role versus several roles at login | One available role opens its dashboard directly; several roles require deliberate choice before entering the combined home |
| N11 — No parish / follower / unassigned priest | Public discovery and published parish activity remain usable; unassigned priest sees a pending-assignment state without staff records |
| N12 — Combined multi-parish home | Rows retain parish identity; followed-parish content stays public; creation/approval targets exactly one authorized parish |
| P01 — Two parishes with similar names | Locality/diocese disambiguate search/cards; request confirms correct parish |
| P02 — No map integration or denied location | Directory remains fully usable, with manual locality search and accurate directions only |
| P03 — Schedule not published | No guessed next Mass/open-now result; office confirmation action available |
| P04 — Named internal baptism event | Public title is generic unless separately approved; exports/previews preserve that boundary |
| P05 — French/Arabic visitor submits guest request | Language/context persist through validation, review, receipt and private tracking |
| P06 — Missing gallery/verified photograph | Neutral fallback and clear optional section behavior; no unrelated church photo presented as authentic |
| P07 — Parish deactivated | No new submission presented as accepted; existing permitted tracking/history and appropriate contact remain |
| P08 — Urgent pastoral request outside office hours | Real published availability/contact shown; no promise of continuous online response |

## Decisions introduced by this draft

S03.01–S03.06 now include owner directions; their implementation detail and unselected wording remain proposed. S03.07 is unanswered; S03.08–S03.14 and all S04 answers remain proposals. The following have particular effects on other sections:

1. **Owner direction:** One combined home with no additional personal/work home switch; login role choice only when multiple roles are available.
2. **Owner direction:** Combined parish view and permission-driven sections; detailed acting-capacity, personal-feature eligibility and scoped individual-grant rules remain to validate.
3. One canonical work/count definition and deduplication of linked intake/office cases.
4. Case-private and confidential content excluded from broad search/queues unless its dedicated access permits it.
5. Proposed English navigation/terminology, with French/Arabic review still needed.
6. Cross-parish Mass search requiring structured approved schedules and dated exceptions.
7. Map preview hidden publicly until a real integration is available, while map support remains in product scope.
8. Neutral imagery on named parish profiles until authentic imagery is supplied.
9. Separate public sacramental titles and explicit publication approval for personal/family names.
10. Minimum trilingual core/contact readiness aligned with **Create and activate parish**.
11. Parish-specific request type configuration, maintained contacts/hours and an honest urgent pastoral route.

Inputs still required: official parish/diocese identities and names, approved translations/terminology, public contacts and hours, verified locations/photos, actual schedules, supported request types and final bishop/certificate policies. The draft establishes desired behavior without inventing these facts or implementing them.
