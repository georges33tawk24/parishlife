# Account and permission workflows

This describes the source implementation on `colin`. It is not a runtime validation report. The owner requested no testing for this continuation; no tests, builds, syntax checks, browser checks, deployment or database setup were executed.

## Separate records and relationships

An account is a login identity, a parish person is an office record, and a ministry membership is a roster entry. They are not created interchangeably. A user can follow multiple parishes without joining them. A parish membership request requires office review and a link to an existing person; ministry applications then follow their own approval process. A primary parish and an all-parish activity view are available.

Legacy assignments continue to work. New scoped grants can add different roles in different parishes. Revoking a legacy role writes an explicit scoped override rather than deleting the account. A new priest or ministry leader grant must identify the person in that parish. A person ID from another parish is not automatically reused. Duplicate account/person links are rejected.

## Profile and invitations

Account profile fields are saved separately from official parish records. My parish records prefills official information. Proposed corrections retain the original and proposed field values in `pl_profile_reviews`; the office approves or declines them from Requests. Approval applies only the proposed fields and refuses to overwrite fields changed since submission. The requester cannot approve their own correction. Updating a parish email or phone does not change the account's sign-in identities.

People without a linked account can receive a one-use invitation, valid for seven days. Only its hash is stored. The office shares the invitation manually; email/SMS delivery is not configured. Claiming it checks for an existing account/person link before accepting it. Invitations do not assign ministry membership or staff privileges.

## Ministry requests

A join request goes to the ministry leader and then the parish priest. A priest can approve directly. Only final priest approval adds the roster entry. Before approval has started, withdrawal completes immediately; after leader approval it becomes a withdrawal request. Leaving a ministry is private to the requester and parish priests. The leader does not receive the reason. Approved departure removes the active roster membership and updates its count, while attendance and other history remain. The user, parish priests and diocesan bishop receive the outcome.

## Guest requests

Public request submission does not require an account. It requires contact information and confirmation that a responsible adult is submitting/handling the request. The office receives it in Requests → Guest requests. A random private tracking link exposes status, office response and explicitly released files; only the token hash is stored.

Office uploads are private until release. Release requires confirmation of applicant identity. A certificate release must be tied to an issued certificate; newly signed certificates also require bishop acceptance. The applicant can download an explicitly released file from the tracking link or collect documents through the office.

After creating an account, a guest can submit the tracking link in My account. `pl_guest_links` records a pending association. The office reviews it from the guest request and confirms the account belongs to the applicant. Only then does the account receive the request details and released documents through an authenticated download endpoint. This association does not create parish or ministry membership.

## Privacy and authority

- Pastoral notes are private to their author unless the author shares them with current parish priests. A successor, bishop or administrator does not inherit private notes.
- Inbox messages are accessible to their sender and recipient. Users can send, reply, mark read/unread and archive their own view; there is no message editing or deletion. Emergency access requires a super administrator, one exact message reference and a recorded reason. It does not provide a browse-all inbox.
- Complaint access is limited to selected reviewers. Unselected administrators receive neither content nor aggregate counts/status. Anonymous submitters remain anonymous in the complaint response. Named conflicts are checked at selection and review.
- Bishops manage their own dioceses. Diocesan and parish administrators stay within their appointed scopes. Only bishops change clergy titles. An explicit `clergy_assigner` grant lets an appointed diocesan administrator assign qualified priests within the diocese; it does not permit changing titles.
- Finance viewing is automatic for the super administrator, bishop and priest, or can be explicitly delegated. Viewing and editing are separate permissions. Administrative roles do not acquire priest signature authority.
- Parish deactivation preserves records and affects only that parish. Global deactivation is restricted to the super administrator. Reactivation cannot override a higher authority's recorded deactivation.

## Certificates

The existing sacrament progression is preserved: request, optional secretary review, priest acceptance, preparation, celebration and official register approval. Certificates refer to official register entries. Only a priest signs; signing submits the certificate for bishop acceptance. Returned certificates retain the bishop's reason and can be resubmitted with a priest's review note. Issuance no longer tells the requester that collection is ready while bishop acceptance is pending. Legacy issued certificates without a bishop-review field remain usable.

## Bundles and appearance

Presence, Office, Community and Complete bundles are managed manually. Diocesan arrangements may cover multiple parishes. A priest may activate a parish-managed bundle; changes to a diocese-sponsored bundle become requests. Disabled modules retain historical records for reading/export, reject new writes/submissions where applicable, and permit existing approval workflows to finish. No billing charge or payment integration is triggered.

Personal dashboard palettes and light/dark preferences are stored per account. Public parish websites share one theme. Shared calendars use Month/Week controls with a separate List view, title/date search and chronological navigation. Collection controls default to ten rows/cards, including lists loaded asynchronously.

The bishop's oversight calendar uses the same calendar component. Household selection applies to the visible page; filtered household exports include every matching household. Dark mode preserves the meaning of green, amber and red status indicators. Finance viewers receive viewing, printing and export controls without transaction-editing controls.

Administration → Edit public parish profile publishes office contacts, Mass/confession times, office hours, accessibility, coordinates and gallery image links. The editor uses a revision check to avoid overwriting another user's changes. Directory cards, parish profiles and galleries use custom parish images when provided and default illustrative photographs otherwise. Public profile actions open dedicated request and calendar pages. New parishes start with empty records, preparation requirements and complaint categories.

Changing a clergy title to Deacon requires revoking active priest assignments first. Role revocation preserves historical activity. Guest-account link review notifies the applicant of the outcome, and new requests notify the office. A request cannot be marked ready for download until a reviewed file has been released.

## External configuration boundaries

Google Maps is a labelled preview. Google, Apple and Microsoft sign-in, provider linking, email/SMS verification and optional MFA are unavailable until configured and implemented against the chosen services. Contacts in the current preview remain unverified. No delivery or successful verification is simulated. Invitations, guest tracking links and downloads work independently of outbound delivery. Manual bundles do not imply a live subscription payment processor.

The Python and Worker services use the same additive workspace schema. Existing data is retained. The local demo super-administrator command is explicit and refuses to reset an existing account; ordinary startup never creates a known-password super administrator.
