# ParishLife: current product and UI/UX decision review

Review date: 27 October 2026. This describes the current checkout, not a deployed production service.

## Review basis and limits

I inspected the README, account/administration/public-site documentation, route and role definitions, screen/tab definitions across the view modules, shared forms and actions, persistence behavior, and relevant account, request, certificate and guest-delivery service code. I also inspected the public directory, parish page, guest baptism form, sign-in, Parish Admin workspace, Requests, People/new-person drawer and Registrations in a disposable localhost preview at a narrow viewport. The preview used a separate temporary database and fixture account.

The visual pass is a sample, not an exhaustive browser test of every role, state or device. Source-supported behavior and UI text are identified separately below where it matters. No regression suite, external delivery, production environment or real parish operation was validated for this discovery exercise. Existing unrelated output files were left alone.

## What the project already is

ParishLife is an English/Arabic parish administration and community application. It already contains frontend and backend implementation, sample records and tests. The next design phase is therefore deciding what to retain, adjust, remove or specify further, rather than starting from a blank screen.

| Surface | Existing screens and concepts | Main source |
| --- | --- | --- |
| Public website | Parish directory, location/diocese/rite filters, nearby search, map preview, parish profiles, clergy/ministry information, published times, gallery, announcements, public calendar, bundles | `public.html`, `assets/public.js`, `assets/public-features.js` |
| Guest journey | Request without sign-in, responsible-adult confirmation, private tracking link, office response, reviewed file release, later account association | `assets/public-features.js`, `assets/views/guest-requests.js`, `backend/guest_links.py`, `backend/guest_delivery.py` |
| Identity and account | Sign-up/sign-in, account profile, sign-in identities, password change, personal theme, followed/primary parishes, office-reviewed membership, official-record corrections | `assets/auth.js`, `assets/views/account.js`, `assets/views/profile-reviews.js` |
| Personal member workspace | My parish life, Home, My requests, ministries, meetings, calendar, attendance, messages, posts, resources, formation, commitments, private notes, profile, concerns, notifications | `assets/views/activity.js`, `assets/views/member.js`, `assets/views/member-requests.js` |
| People and households | People list, bilingual records, profile tabs, family diagram, group membership, sacrament history, attendance, giving, files, consent, households, imports, duplicate review, archive | `assets/views/people.js` |
| Office intake | Combined request queue plus separate membership, guest and profile-correction queues; online member intake, service requests, reservations and waitlist work | `assets/views/records.js`, `assets/views/online-requests.js`, review view modules |
| Sacramental records | Requests, priest acceptance, preparation, celebration, official register approval, certificates, bishop review, anniversary views, printed/exported documents | `assets/views/records.js`, `server.py`, `backend/workspace.py` |
| Calendar and services | Events, visibility, clergy schedules, reusable event templates, service plans, timed order of service, plan templates, associated requests | `assets/views/parish.js`, `assets/planning.js`, `assets/schedules.js` |
| Ministries | Group directory/detail, members and contacts, meetings, attendance, posts/files, resources/loans, tasks, formation, history, join and private leave approvals | `assets/views/parish.js`, `assets/views/ministry-requests.js`, `backend/ministry.py` |
| Volunteers | Rota, volunteer list, sign-up sheets, hours, confirmations and commitments | `assets/views/parish.js`, `assets/views/member.js` |
| Events and safeguarding | Registration forms, event links, registrants, place/consent/payment states, transport, refunds, event-specific check-in, pickup, parish-wide incident log, event evacuation roster | `assets/views/parish.js`, `assets/registration.js`, `assets/event-workflows.js` |
| Spaces and assets | Rooms, availability, reservations, equipment, maintenance, issues and external renters | `assets/views/spaces.js` |
| Money | Giving/counting, contributions, pledges, standing gifts, appeals, receipts/statements, funds, budget, expenses, reconciliation; separate Office Expenses ledger | `assets/views/money.js`, `assets/views/office-expenses.js` |
| Communications | Inbox, staff messaging, message designs/rules/automation records, notices, member posts/resources, prayer requests, website content | `assets/views/inbox.js`, `assets/views/comms.js`, `assets/flows.js` |
| Music | Library, lyrics, chords, instrument notes, versions, rights, setlists and service use | `assets/views/comms.js` |
| Administration | Dioceses, parishes, accounts, scoped appointments, optional secretaries, clergy titles, certificate acceptance, bundles, public profile, administrative history | `assets/views/workspace.js`, `assets/views/administration-access.js`, `backend/administration-policy.json` |
| Oversight and controls | Bishop oversight/map, reports, general audit, forms/workflows, parish settings, role matrix, retention/security/integration screens, design system | `assets/views/oversight.js`, `assets/views/admin.js` |

Navigation is defined in `assets/app.js` and `assets/store.js`; it changes with role, additional grants, linked person, parish context and some member data. Designing one sidebar is insufficient.

## Roles that require distinct experiences

| Role or condition | Existing distinction to preserve or explicitly change |
| --- | --- |
| Guest | No account; private tracking link rather than a member dashboard |
| Account without person link | Account, following and public activity precede access to linked member pages |
| Member/user | Personal and permitted group information; cannot read general staff parish state |
| Ministry leader | Group-scoped tools; membership itself does not grant leadership |
| Secretary | Deliberately restricted office workspace; no general Administration or standalone communications; contextual messages remain |
| Treasurer | Finance tools and some people/household/report context; separate from finance viewer |
| Finance viewer | Read/print/export authority distinct from editing |
| Parish priest | Assigned-parish tools and clergy-only sacramental authority; private pastoral notes follow separate rules |
| Parish Admin | Office/administrative scope without priest signature authority |
| Archdiocese Admin | Assigned diocese; clergy appointment delegation is an additional grant |
| Bishop | Diocesan oversight/appointments and certificate acceptance; sensitive case access is not inherited from the title |
| Super Admin | System administration; not an automatic reader of private notes or all inbox messages |
| Selected concern reviewer | Case-specific access plus relevant permissions; conflict checks and identity visibility are separate |
| Multiple roles/parishes | One account may hold different roles in different places; effective actions need clear context |

## Existing workflow baselines to confirm

1. **Identity:** account → follow parish / choose primary parish → request parish membership → office verifies identity and links a person → ministry application follows a separate process. An account, person, household and ministry membership are different things.
2. **Member request:** linked member submits for self/eligible household member, or an unregistered child for baptism → office review → accepted request creates/links the relevant office record → subsequent steps appear to the applicant. A general request uses accepted/done; a booking uses reservation confirmation. Withdrawal is limited by handling state.
3. **Guest request:** public form → separate guest queue → office-controlled status/response → optional private document release. Later linking to an account needs office review. A guest request does not itself create parish membership. Automatic equivalence with detailed member sacrament intake must not be assumed.
4. **Sacrament:** request → optional secretary review → priest acceptance → required preparation and date/time → celebration → submitted entry → priest approval assigns official register number. Declined/cancelled history remains. The current UI has Preparation/Anniversaries, not a standalone register-list or correction screen.
5. **Certificate:** official source entry, or wait for a planned sacrament → clergy review → priest signature → bishop acceptance/return → release/collection. Older issued certificates may have no bishop-review field. The older office next-step/status language is not sufficient on its own to explain the added bishop stage.
6. **Ministry:** application → leader review → priest approval, with a priest permitted to approve directly. Leaving is privately reviewed by priests; leaders do not receive the reason. Attendance/history remains after roster departure.
7. **Event:** eligible calendar event → linked registration form → participant seat status, applicable consent, transport and received payment as separate facts → confirmed/consented participant → arrival → authorized pickup/checkout. Mass attendance is not individually collected.
8. **Facilities:** availability → booking request → office/priest action → reservation. Setup time, events, bookings and maintenance interact. Current reservation copy also promises pending holds and automatic refusal of a competing booking; the precise desired policy needs agreement.
9. **Documents:** requirements/evidence and paper receipt are separate from priest approval. Guest files stay office-private until explicit release after identity confirmation. Member-content attachments and office request uploads have different limits.
10. **Money:** USD and LBP are distinct currencies. The intended model retains historical rates. Office Expenses is a separate allowance/purchase ledger, not an automatic duplicate in parish Finance. Giving includes two-counter language that needs an agreed real approval interaction.
11. **Publishing and delivery:** public content, parish/group posts, private inbox messages, notifications and external broadcasts are distinct. The current installation does not deliver external email/SMS/WhatsApp, run timed automations or charge bundle subscriptions.
12. **Privacy:** personal member notes are account-private. Pastoral notes are author-private unless shared with current parish priests. Concern access depends on selected reviewers, not administrative rank. Export, notification and print behavior must follow the same boundaries.

## Concrete decision gaps and mismatches

These are design questions, not a complete bug report. Some source definitions may be legacy; seeing code or text does not prove an active, implemented capability.

| ID | Evidence in current project | Decision required | Questionnaire |
| --- | --- | --- | --- |
| G01 | Requests visually shows separate membership/guest/profile entry buttons. Local fixture sidebar badge was 11 while the queue showed 12 needing action. Counting logic lives in `app.js` and `records.js`. | One definition of actionable work, badge scope and unified versus separate queues | S03, S11 |
| G02 | Guest baptism form is generic contact/details; member intake has structured steps and household subjects. Guest handling is separate. | Deliberate difference versus a shared intake/continuation experience | S04, S11, S13 |
| G03 | Backend signing writes pending bishop review; older `records.js` next-step mapping treats issued as done. | Final lifecycle wording, bishop queue, return loop and release gates | S14 |
| G04 | Narrow preview registration rows said Open but also “Legacy form · link an event before use”; open-form summary was zero. | Visible migration state and when a form is actually accepting registrations | S10, S21 |
| G05 | Settings source renders security toggles, sessions, module preferences and integration controls; auth/account documentation explicitly says MFA/providers/verification are unavailable. | Remove, disable with explanation, or implement each promise; authoritative settings location | S02, S06, S29 |
| G06 | Bundle disablement documentation retains history and existing approvals; older Settings module copy says a disabled module disappears everywhere. | Historical access, in-flight completion and member submissions when modules change | S29 |
| G07 | Giving source includes a named second-count success block and fixed session examples. Actions do not by themselves establish a second independent user's approval. | Real two-counter interaction, exception path and honest verification status | S24 |
| G08 | Reservation copy promises expiring pending holds and automatic refusal of a competing request. Some actions contain fixed names/figures. | Holds, competing requests, expiry, rescheduling and who actually receives a message | S23, S26 |
| G09 | Settings language source offers French/trilingual documents while current principal UI/documents use English/Arabic. | Supported launch languages and document templates; no unsupported language promise | S14, S30 |
| G10 | New-person drawer requires English and Arabic names; public signup only separates first/last name. | Partial/unknown names, transliteration responsibility and transition to official documents | S06, S08, S13 |
| G11 | The personal area has My parish life, Home, My profile and My account; staff also have multiple messaging/content surfaces. | Clear entry points, terminology and avoidance of duplicate-feeling destinations | S03, S07, S26 |
| G12 | Guest file controls contain a direct priest/secretary role check even though scoped admin documentation permits office work without a secretary. | User-facing permission matrix for administrators who perform office duties | S02, S15 |
| G13 | Member attachments allow PDF/images/text up to 1 MB; office uploads commonly allow PDF/images up to 10 MB. | Scope-specific limits, explanation, phone capture and error recovery | S15 |
| G14 | Incident reports are parish-wide, while check-in and evacuation are event-specific. | Incident linking, disclosure, response ownership and exact emergency roster scope | S22 |
| G15 | Some screen text/metrics/actions embed sample dates, names, counts or success claims. | Define every displayed metric/status and unavailable state from actual product behavior | S03, S24–S26, S29 |
| G16 | Metadata calls the app offline-tolerant; persistence saves to the server and recovers after failed writes. | Exactly what users can read/write offline and how they recover unsaved work | S31 |

## Evidence locations

- Entry points and destinations: `index.html`, `public.html`, `landing.html`, `assets/app.js`, `assets/store.js`.
- Existing product rules and operating boundaries: `README.md`, `docs/account-workflows.md`, `docs/administration.md`, `docs/public-site-design.md`.
- Scope/authority: `backend/administration-policy.json`, `backend/administration.py`, `backend/workspace.py`, `assets/views/administration-access.js`.
- Main request progression and presentation: `assets/views/records.js`, `assets/views/member-requests.js`, `assets/views/online-requests.js`, `assets/sacrament-requests.js`, workflow handlers in `server.py`.
- Guest review/release: `assets/views/guest-requests.js`, `assets/views/guest-links.js`, `backend/guest_delivery.py`, `backend/guest_links.py`.
- Registration facts and eligible events: `assets/registration.js`, `assets/event-workflows.js`, registration/check-in views in `assets/views/parish.js`.
- Save and recovery behavior: `assets/persist.js`; unavailable delivery and shared actions: `assets/actions.js`, `assets/flows.js`.
- Parallel deployment implementation exists under `cloudflare/src/`; documentation states shared policy, but runtime parity was not revalidated during this review.

## Recommended discussion order

Release and decision owners → organization/authority → navigation → identity/membership/people → requests/sacraments/certificates → calendar/ministry/events/facilities → money/communications/privacy → administration/design/resilience → scenario walkthroughs and prototype approval.

Start with the product owner's answers. Confirm operational details with the people who actually do the work; do not ask the product owner to invent clergy policy, safeguarding procedure or finance controls on everyone else's behalf.
