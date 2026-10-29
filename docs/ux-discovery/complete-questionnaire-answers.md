# ParishLife — complete questionnaire answers, S01–S32

Prepared 28 October 2026 for the product owners and development team.

**Coverage:** All 436 original questions, in their original order and with their original IDs and wording. The answer is followed where useful by operational rules, exceptions or required factual inputs. This is a proposed product/UX specification, not application implementation or evidence of production rea
# BARBERSHOP MANAGEMENT SYSTEM
# MASTER IMPLEMENTATION SPECIFICATION — VERSION 3.0
# EXISTING WEBSITE + PUBLIC BOOKINGS + EMPLOYEE PORTAL
# MANAGER CRM + FINANCIAL ANALYTICS + WEBSITE CMS

============================================================
0. YOUR MISSION
============================================================

You are a multidisciplinary senior software engineering team:

- Principal Software Architect
- Senior React / Next.js / TypeScript Engineer
- PostgreSQL Database Architect
- Supabase Backend Engineer
- Application Security Engineer
- Reservation and Scheduling Systems Engineer
- Financial Systems Engineer
- SaaS Product Designer
- Internationalization Specialist
- Quality Assurance and Testing Engineer

You are working inside an EXISTING barbershop project.

The public website has ALREADY been implemented.

It already runs locally at:

http://127.0.0.1:4173/

Your mission is to extend this existing application
into a functional, database-connected Barbershop
Management System.

Do not start a new project.

Do not replace the public website.

Do not destroy existing animations, branding,
styling, layouts, or reusable components.

Preserve the existing premium, cinematic website.

Add the necessary backend, authentication, databases,
booking functionality, dashboards, employee operations,
financial reporting, and content management.

The final system must contain THREE interfaces:

1. Public customer website
2. Shared Employee portal
3. Manager / CEO portal

There are TWO internal authentication roles:

- MANAGER
- EMPLOYEE

Customers DO NOT create accounts.

The Employee account is SHARED among employees.

The system must support multiple individual barbers
and other staff members without giving each person
a separate login.

All operations must use real, persistent database records.

Do not substitute hardcoded mock data for functioning
business workflows.

============================================================
1. REPOSITORY INSPECTION — MANDATORY FIRST STEP
============================================================

Before installing packages or changing files:

Inspect the existing repository.

Determine:

- Actual frontend framework
- Framework version
- Package manager
- TypeScript configuration
- Existing application routing
- Existing design system
- Existing animation libraries
- Existing UI component libraries
- Existing services and booking components
- Existing public website content
- Current deployment strategy
- Build and preview commands
- Existing environment variables

IMPORTANT:

The application currently runs on port 4173.

Do not assume it uses Next.js solely because the
original design prompt recommended Next.js.

The port may indicate a Vite preview setup.

Determine the actual framework from package.json
and project configuration.

Preserve the existing architecture where practical.

Do not migrate to another framework without
a clear, demonstrated technical requirement.

Create an architecture assessment before making
major changes.

Then extend the existing codebase incrementally.

============================================================
2. ABSOLUTE SOFTWARE BUDGET
============================================================

The initial implementation must use free,
open-source, or free-tier technologies.

Preferred backend:

- Supabase PostgreSQL
- Supabase Auth
- Supabase Edge Functions
- Supabase Storage

Preferred frontend:

- Existing React-based frontend
- TypeScript
- Tailwind CSS
- Existing animation libraries
- shadcn/ui where compatible
- Recharts
- React Hook Form
- Zod

Calendar:

- FullCalendar Standard, if suitable
- Custom React calendar components when needed

Hosting:

- Cloudflare Pages free tier where compatible
- Supabase free tier for initial backend

Do not use paid FullCalendar Scheduler or
premium resource calendar plugins.

Do not require a paid booking platform.

Do not require paid UI components.

Do not require a paid database plan to run locally.

Do not embed paid APIs without explicit approval.

Document actual free-tier limits.

Do not falsely claim that a free-tier deployment
provides production SLAs or automatic backups.

Implement without requiring a paid subscription,
while documenting unavoidable external requirements.

============================================================
3. BUSINESS MODEL
============================================================

Initially, the system serves ONE physical barbershop.

Expected staff:

Approximately 6–10 barbers.

The manager must be able to configure the actual number.

The shop may also employ:

- Receptionists
- Cleaners
- Assistants
- Other staff categories

Employee positions must be configurable.

Do not assume every employee performs haircuts.

FUTURE BRANCH SUPPORT:

The business may operate multiple branches later.

An employee may eventually work at more than one branch.

For now:

- Implement one operational branch.
- Include a simple branch identifier in relevant records.
- Keep the data model compatible with future expansion.
- Do not build a complex multi-branch management UI.
- Do not implement branch transfers yet.

Avoid unnecessary future features.

============================================================
4. INTERNAL ACCOUNTS AND AUTHENTICATION
============================================================

There are TWO account roles.

ROLE A — MANAGER

Initially, one manager account.

The architecture must support additional manager
accounts created by an authorized manager later.

Managers have full authorized system access.

ROLE B — EMPLOYEE

ONE shared account.

Example login identity:

employee

All employees may use this shared account.

The account can remain signed in on
authorized shop devices.

Multiple sessions may exist simultaneously.

Do not create a personal login for each barber.

Do not require personal PINs.

Do not require employees to authenticate individually.

IMPORTANT ACCOUNTABILITY REQUIREMENT:

Because employees share one account, the system
cannot securely identify the actual human operator.

For haircut registration, provide:

"Performed By" — required barber selection.

"Recorded By" — required staff name selection.

Store both values.

Also store the authenticated account and timestamp.

Treat "Recorded By" as a DECLARED identity,
not a cryptographically verified identity.

Do not claim that these records prove which
employee entered information.

MANAGER SECURITY:

Manager credentials must never be shared with
the employee account.

Managers must have their own authentication sessions.

Implement secure password authentication.

Use Supabase Auth.

Enforce authorization on the backend and in RLS.

Disable public registration for internal accounts.

Use a secure initial manager setup.

Only authorized managers can create
additional internal accounts.

Use safe password reset procedures.

Never expose privileged service credentials
to browser code.

Provide sign-out controls.

Do not force automatic inactivity logout
for the shared employee account.

Document the security implications of persistent
shared sessions.

============================================================
5. ACCESS CONTROL MATRIX
============================================================

PUBLIC VISITOR:

Allowed:

- View public website
- View published services and prices
- View public barber information
- View available appointment slots
- Submit booking requests
- Cancel their own booking with secure token
  when permitted by cancellation rules

Not allowed:

- Access internal dashboards
- Read other customers' details
- Read employee records beyond published information
- View financial data
- Access payroll
- Modify services
- Access private reservations

EMPLOYEE:

Allowed:

- View all shop reservations
- Filter reservations by barber
- View day/week/month calendars
- Create internal reservations
- Approve public booking requests
- Mark reservations completed
- Mark cancellations and no-shows where permitted
- Reassign a barber when necessary
- Register walk-in haircuts
- Register completed services
- Select which barber performed a service
- Select who recorded the service
- Record payments
- Apply discounts
- Record tips
- View today's operational activity
- Record daily cash-closing information
- Print operational receipts

Not allowed:

- Delete historical haircut records
- Permanently delete reservations
- Delete payments
- Modify official service prices
- Modify salaries
- Change employee compensation
- Edit the public website
- View payroll reports
- View confidential business-wide analytics
- Edit system roles
- Access manager-only settings

MANAGER:

Allowed:

- Full reservation management
- Full employee management
- Full service management
- Full calendar management
- Financial monitoring
- Payroll and compensation configuration
- Audited financial corrections
- Website CMS management
- Business settings
- Exports
- Reports
- Access management

IMPORTANT:

Employee permissions are deliberately narrower
than full CRUD.

Employees can create records and perform specific
approved workflow updates.

They cannot arbitrarily edit or delete any record.

Manager deletion of financial information must
use audited reversal or soft-deletion semantics
where appropriate.

============================================================
6. STAFF MANAGEMENT
============================================================

Manager route:

/manager/employees

Implement CRUD for personnel records.

Fields:

- ID
- Full name
- Position
- Phone, optional
- Active/inactive
- Is bookable barber
- Employment start date
- Working schedule
- Time-off schedule
- Salary arrangement
- Display order
- Optional public website profile

Allow manager-defined job titles.

Examples:

Barber
Senior Barber
Receptionist
Cleaner
Assistant

A non-barber employee must not appear in public
barber selection unless explicitly enabled.

Allow employees to be deactivated without
deleting historical service and financial records.

============================================================
7. WORKING HOURS AND AVAILABILITY
============================================================

Each barber must have an independently
configurable weekly schedule.

Example:

Ali:
Monday, Wednesday, Friday

Jad:
Tuesday, Thursday, Saturday

Working hours may differ by employee.

Manager can configure:

- Weekly working hours
- Multiple work intervals in a day
- Breaks
- Days off
- Vacations
- Holidays
- Temporary unavailability
- Exceptional working hours

Business opening hours are separate.

A barber may only be publicly bookable when
both the shop and barber are available.

Support schedule exceptions.

Use the Asia/Beirut timezone by default.

Store actual appointment instants in UTC.

Handle daylight-saving transitions correctly.

============================================================
8. PHYSICAL CHAIR MANAGEMENT
============================================================

The system must independently track barber chairs.

Chairs are physical resources.

They are NOT permanently owned by a particular barber.

Manager route:

/manager/chairs

The manager can:

- Add chairs
- Edit chair names/numbers
- Activate/deactivate chairs
- Assign chairs during particular shifts
- Reassign chairs when schedules change

Example:

Chair A:
Ali uses it Monday, Wednesday, Friday.

Jad uses it Tuesday and Thursday.

Support flexible time-based chair assignments.

Prevent conflicting explicit chair assignments.

Allow a chair to be reused at non-overlapping times.

Show chair information in the internal calendar
when relevant.

Do not force public customers to select a chair.

Public customers select a barber.

The system can manage physical chair allocation
internally.

Implement chair conflict rules without
unnecessarily preventing valid bookings.

If strict chair-capacity enforcement is enabled,
validate available physical chairs transactionally.

============================================================
9. PUBLIC CUSTOMER BOOKING
============================================================

Preserve the existing public website.

Its "Book Now" button must launch
a genuinely functional booking workflow.

Route:

/book

Customers DO NOT create accounts.

BOOKING STEPS:

STEP 1:
Select one or more services.

STEP 2:
Select a specific barber or "Any Available Barber."

STEP 3:
Select a date.

STEP 4:
Select an available time.

STEP 5:
Enter customer information.

STEP 6:
Review booking details.

STEP 7:
Submit booking request.

CUSTOMER INFORMATION:

Required:
- Full name
- Phone number

Optional:
- Email address
- Booking notes

The booking notes are entered by the customer.

Do not create employee-authored customer notes.

Do not create a separate customer profile.

Do not require customers to sign in.

BOOKING DETAILS:

- Selected services
- Total estimated duration
- Assigned barber
- Date
- Start time
- End time
- Service price summary
- Customer name
- Customer phone
- Optional email
- Optional customer notes

Support multiple services in one appointment.

Example:

Haircut — 30 minutes
Beard Trim — 15 minutes

Combined duration:
45 minutes

Apply the configured appointment buffer.

============================================================
10. PUBLIC BOOKING APPROVAL
============================================================

PUBLIC BOOKINGS REQUIRE STAFF APPROVAL.

When a visitor submits a reservation:

1. Validate the request.
2. Verify actual availability.
3. Create a Pending reservation.
4. Reserve the selected timeslot.
5. Display a pending confirmation message.
6. Add it to the internal booking queue.

The booking is NOT immediately confirmed.

A manager or the shared Employee account
must approve the request.

After approval:

Pending -> Confirmed

After the visit:

Confirmed -> Completed

Additional statuses:

Cancelled
No Show

Do not add unnecessary lifecycle stages.

Show a clear status label everywhere.

IMPORTANT:

Pending reservations must block overlapping
requests until approved, rejected, cancelled,
or expired.

Use a configurable pending-expiration policy
to prevent abandoned reservations from
blocking availability indefinitely.

Default recommendation:

Expire unapproved public requests after
a configurable 24-hour period, or sooner
when the appointment start time is reached.

Allow the manager to change this policy.

A legitimate customer should receive an
accurate status.

Do not display "Confirmed" for Pending bookings.

EMPLOYEE-CREATED RESERVATIONS:

When the shared Employee account creates
a reservation internally, it may be
confirmed immediately.

No additional manager approval is required.

============================================================
11. BOOKING HORIZON AND TIME SLOTS
============================================================

Customers may book:

- On the current day
- Several days ahead
- Weeks ahead
- Months ahead
- Further into the future

Do not impose a business-defined maximum
booking horizon by default.

Use bounded API queries and pagination to
avoid unbounded database or calendar requests.

Use a configurable slot interval.

Default:
15 minutes.

Each service has its own duration.

Service durations are manager-configurable.

Manager may also adjust the duration
of a particular reservation.

Add a configurable appointment buffer.

Default:
5 minutes.

Support a 10-minute buffer option.

Calculate available slots using:

- Business opening hours
- Barber working hours
- Barber breaks
- Barber time off
- Existing reservations
- Pending reservations
- Service duration
- Buffer duration
- Chair constraints when applicable

============================================================
12. BOOKING CONFLICT PREVENTION
============================================================

This is a CRITICAL correctness requirement.

Never rely on frontend availability checks alone.

Enforce booking conflicts at the database level.

For the same barber:

Two active reservations cannot overlap.

Use PostgreSQL transactional logic.

Use appropriate range constraints such as
tstzrange with exclusion constraints where suitable.

Handle concurrent booking attempts safely.

Example:

Ali booked:
14:00–14:30

Second request:
14:15–14:45

Result:
Reject overlapping request.

Jad available:
14:15–14:45

Result:
Allow reservation if all other constraints pass.

ANY AVAILABLE BARBER:

Find an eligible available barber.

Assign the barber atomically.

Prevent race conditions.

If the slot becomes unavailable,
return an informative error.

Provide alternative available times.

Test concurrent requests explicitly.

============================================================
13. PUBLIC CANCELLATION RULE
============================================================

Customers may cancel their own reservation
through the website if the appointment
is at least 3 hours away.

Example:

Appointment:
15:00

Customer cancellation:
Before or at 12:00 — allowed online.

After 12:00 — customer must contact the shop.

Use the business timezone for display
and absolute timestamps for comparisons.

PUBLIC CANCELLATION SECURITY:

Do not expose customer reservation records
through sequential IDs.

Use a secure, unguessable cancellation token.

Store only a secure token hash.

Allow customers to cancel only their own
booking through the valid token.

Do not allow public users to access
other customers' information.

Public self-rescheduling is not required
in the initial implementation.

Staff can manage scheduling adjustments internally.

============================================================
14. LATE ARRIVAL AND NO-SHOW POLICY
============================================================

Implement configurable late-arrival handling.

Recommended initial behavior:

- Show late appointments clearly in the calendar.
- Do not automatically cancel a reservation
  solely because the customer is late.
- Allow staff to mark a No Show.
- Allow staff to complete the appointment if
  the customer eventually receives the service.
- Allow the manager to adjust the grace period.

Suggested initial grace period:

10 minutes.

Avoid creating unnecessary automatic penalties.

Do not automatically charge customers
for missed appointments.

============================================================
15. PUBLIC BOOKING CONFIRMATIONS
============================================================

On-screen confirmation is mandatory.

Transactional email is required where
a valid email address has been provided
and email delivery is configured.

For a new public request:

Show:
"Booking Request Received."

After staff approval:

Show/send:
"Appointment Confirmed."

After cancellation:

Show/send:
"Appointment Cancelled."

Do not invent email delivery success.

Use a free-tier compatible transactional
email provider where possible.

Suggested:
Resend.

Use a secure Edge Function for email sending.

Never place email API secrets in frontend code.

Implement an email outbox with:

- Event type
- Recipient
- Delivery status
- Retry count
- Last error
- Creation timestamp

Use idempotent delivery logic.

Handle rate limits gracefully.

Do not block successful reservation creation
merely because an email provider is temporarily down.

If the customer provides no email address,
display on-screen confirmation and a secure
cancellation link that can be saved.

Clearly explain the limits of email notifications.

============================================================
16. BOOKING CALENDAR
============================================================

Both Manager and Employee have calendars.

Manager route:

/manager/calendar

Employee route:

/employee/calendar

REQUIRED VIEWS:

- Month
- Week
- Day

REQUIRED FILTERS:

- All barbers
- Specific barber
- Appointment status
- Service
- Date range

SALON-STYLE CALENDAR:

For day and week views, create an optional
salon scheduling layout.

Show each barber in a separate column.

Example:

TIME       ALI       JAD       RAMI
09:00      Booking   Free      Booking
09:30      Booking   Booking   Free
10:00      Free      Booking   Booking

Use a real interactive calendar interface.

This diagram is illustrative only.

Use a responsive grid with sticky time labels,
barber headers, and reservation blocks.

Do not use paid FullCalendar resource plugins.

Use FullCalendar Standard for standard
month/week/day views where suitable.

Implement the barber-column view using
custom React components and free libraries.

Calendar reservations should show:

- Customer name
- Time
- Barber
- Service
- Status

Avoid showing unnecessary contact information
in crowded calendar views.

Clicking a reservation opens its details.

MANAGER:

May create, edit, reschedule, cancel,
and reassign reservations.

EMPLOYEE:

May create bookings, approve bookings,
update permitted statuses, and correct
barber assignments.

Employees cannot arbitrarily delete
or alter historical records.

Validate every calendar modification on the backend.

============================================================
17. EMPLOYEE PORTAL
============================================================

Route:

/employee

Create a clean, responsive operational dashboard.

PRIMARY MODULES:

Dashboard
Calendar
Reservations
Register Haircut
Payments
Cash Closing

EMPLOYEE DASHBOARD:

Show:

- Today's reservations
- Pending booking requests
- Upcoming appointments
- Completed haircuts today
- Bookings by barber
- Quick actions

QUICK ACTIONS:

"View Calendar"
"Approve Booking"
"Add Reservation"
"Register Haircut"
"Record Payment"

Do not display business-wide profit,
payroll totals, or confidential financial analytics.

Employees may see payment information required
for operating the cash register.

Avoid exposing unnecessary manager-only reports.

Optimize the experience for tablets and phones.

============================================================
18. RESERVATION MANAGEMENT
============================================================

Create a searchable reservations table.

Features:

- Date filtering
- Barber filtering
- Status filtering
- Service filtering
- Search by customer name
- Search by booking reference
- Sort by appointment time
- Pagination

BOOKING DETAILS:

- Customer name
- Phone
- Optional email
- Optional customer-entered notes
- Selected services
- Barber
- Assigned chair, if applicable
- Start and end time
- Reservation status
- Payment status
- Booking source

Booking source:

Public Website
Employee
Manager

PUBLIC RESERVATIONS:

Created as Pending.

EMPLOYEE/MANAGER RESERVATIONS:

Can be created as Confirmed.

Employees can approve or cancel eligible bookings
according to their allowed workflows.

Managers have full administrative control.

Historical changes must be auditable.

============================================================
19. WALK-IN CUSTOMERS
============================================================

Support walk-in customers.

A walk-in customer has no prior reservation.

The employee can select:

"Register Walk-In"

Required:

- Customer name
- Barber
- Service or services
- Actual completion time
- Payment information

Phone may be optional for walk-ins.

Do not require a customer account.

Do not create a persistent customer profile.

Each walk-in becomes an independent visit record.

The haircut and associated payment appear
in operational and financial reporting.

============================================================
20. NO CUSTOMER PROFILE MODULE
============================================================

THIS IS AN EXPLICIT REQUIREMENT.

Do not create:

- Customer accounts
- Customer login
- Customer dashboard
- Customer directory
- Customer loyalty profiles
- Favorite barber profiles
- Customer spending history page
- Customer segmentation
- Marketing CRM
- Employee-authored customer notes

Customer contact information exists only
where necessary for reservations and visits.

A reservation must store:

- Customer name
- Phone
- Optional email
- Optional customer notes

A walk-in service record must store
the name required to record the visit.

Do not introduce a separate Customers table
unless technically necessary.

Prefer guest information attached directly
to reservations and visits.

Keep personal data collection minimal.

Protect private booking records.

Support appropriate retention and deletion
of personal data without destroying necessary
financial history.

============================================================
21. HAIRCUT AND SERVICE REGISTRATION
============================================================

This is one of the most important workflows.

Employee route:

/employee/haircuts/new

Manager may access the same functionality
through the management portal.

FORM FIELDS:

Customer Name:
Required.

Existing Reservation:
Optional.

Performed By:
Required barber selection.

Recorded By:
Required employee name selection.

Services:
One or multiple.

Date:
Required.

Time:
Required.

Standard Price:
Automatic.

Discount:
Optional.

Tip:
Optional.

Payment Method:
Required when payment is recorded.

Payment Status:
Paid / Partially Paid / Unpaid.

IMPORTANT PRICE RULE:

Official service prices are FIXED.

Employees cannot enter arbitrary service prices.

The manager defines service prices.

The transaction uses the configured service prices.

Employees may apply discounts.

Do not change the underlying service catalog
when a discount is applied.

Example:

Haircut:
$20

Discount:
$5

Charged:
$15

Tip:
$3

Service Revenue:
$15

Tips Collected:
$3

Total Collected:
$18

Keep the tip separate from service revenue.

Allow discounts without requiring
manager approval.

Ensure discounts cannot produce
a negative charged amount.

Record a discount reason if useful
for transparency and auditing.

============================================================
22. MULTIPLE SERVICES PER VISIT
============================================================

One customer may receive several services.

Example:

Haircut:
$15

Beard Trim:
$5

Total:
$20

One visit.
One payment summary.

Store each service as a separate line item
linked to the same visit.

Retain:

- Service ID
- Service name snapshot
- Standard price snapshot
- Discount allocation
- Net service charge
- Performing barber
- Duration

By default, one barber performs all services
for a public booking.

Manager or Employee may correct the assigned
barber when operationally necessary.

For internally registered visits, allow
different services to be attributed to
different barbers if genuinely performed
by different employees.

Ensure financial reporting and commissions
attribute each service to the correct barber.

One visit can have multiple services
without producing duplicate visit counts.

============================================================
23. SERVICE CATALOG
============================================================

Manager route:

/manager/services

Manager can:

- Create services
- Edit services
- Set prices
- Set durations
- Reorder services
- Activate/deactivate services
- Configure availability
- Configure public visibility

Fields:

- ID
- Name
- Localized name
- Description
- Localized description
- Duration
- Price
- Currency
- Active
- Publicly visible
- Display order

Prices must support:

USD
LBP

Every price must have an explicit currency.

Do not automatically convert between currencies.

The manager may configure prices for
each supported currency.

Use decimal-safe monetary representations.

Prefer integer minor-unit storage where suitable.

Never use JavaScript floating-point arithmetic
for authoritative financial calculations.

Keep historical service price snapshots.

Changing a service price must not
change old financial transactions.

============================================================
24. PAYMENTS
============================================================

Supported payment methods:

- Cash
- Card
- Whish
- OMT
- Other

Supported payment states:

- Paid
- Partially Paid
- Unpaid

Customers normally pay after receiving services.

Employees record the actual collection.

One visit may have multiple services.

One visit has one consolidated payment summary,
but may contain multiple payment entries
to support partial or split payments.

Example:

Visit total:
$20

First payment:
$10 Cash

Second payment:
$10 Whish

Remaining:
$0

Payment status:
Paid

Record:

- Payment ID
- Visit ID
- Amount
- Currency
- Method
- Timestamp
- Authenticated account
- Declared recording employee
- Status

Prevent duplicate submissions.

Use transaction-safe payment writes.

Do not recognize reservation value as collected income.

Revenue reports must distinguish:

- Service charges
- Discounts
- Amount collected
- Outstanding balance
- Refunds
- Tips

============================================================
25. TIPS
============================================================

Record tips separately from service prices.

Fields:

- Visit ID
- Tip amount
- Currency
- Recipient barber
- Payment method
- Date

Tips do not automatically increase
service revenue.

Tips must not automatically increase
commissionable service value.

Allow the manager to inspect tips by barber.

If one visit involves multiple barbers,
support explicitly assigning tips to one
or more relevant employees.

Do not silently split tips equally.

============================================================
26. REFUNDS AND FINANCIAL CORRECTIONS
============================================================

Manager-only functionality.

Manager route:

/manager/finances

Allow:

- Refunds
- Payment corrections
- Transaction reversals
- Audited adjustments

Never permanently erase financial history.

Do not silently overwrite an original payment.

Create linked correction records.

Store:

- Original payment reference
- Adjustment amount
- Adjustment reason
- Manager actor
- Timestamp

Recalculate financial reports correctly.

Employees cannot reverse historical payments.

Do not allow direct unauthorized table updates
to bypass these rules.

============================================================
27. CASH REGISTER AND DAILY CLOSING
============================================================

Implement a basic cash closing feature.

Employee may record end-of-shift cash details.

Manager may review and approve.

Example:

Expected Cash:
$500

Actual Cash Counted:
$490

Difference:
-$10

The expected cash amount should come from
recorded cash payments and cash adjustments.

Include cash tips consistently and report
them separately from service revenue.

Exclude card, Whish, OMT, and other noncash
payments from expected physical cash.

Store:

- Opening balance, if used
- Period
- Expected cash
- Counted cash
- Difference
- Declared employee
- Account identity
- Manager review
- Closing timestamp

Provide daily and custom-period filtering.

Do not use this screen to expose
full business financial analytics to employees.

============================================================
28. RECEIPTS
============================================================

Generate professional payment receipts.

Support:

- Printable receipt
- Downloadable PDF receipt

Receipt includes:

- Barbershop name
- Address and contact details
- Receipt reference
- Date and time
- Customer name, if supplied
- Services
- Prices
- Discounts
- Tips
- Payment methods
- Paid amount
- Remaining balance
- Currency

Use a clean, professional layout.

Do not label the receipt as a legally compliant
tax invoice without the required configuration.

Do not invent tax numbers or tax rates.

Preserve transaction references.

============================================================
29. MANAGER DASHBOARD
============================================================

Route:

/manager

Create a premium SaaS-style management dashboard.

Preserve the existing barbershop brand identity,
but prioritize readability and operational clarity.

SIDEBAR:

Overview
Calendar
Reservations
Haircuts
Employees
Chairs
Services
Finances
Payroll
Cash Closing
Website CMS
Reports
Settings

OVERVIEW KPIs:

- Today's collected service revenue
- Weekly collected service revenue
- Monthly collected service revenue
- Today's completed haircuts
- Total upcoming reservations
- Pending approvals
- Cancellations
- No-shows
- Active barbers
- Average haircut transaction value

Use real database queries.

No hardcoded analytics.

Allow filtering by:

Today
This Week
This Month
Custom Period

Show separate totals for USD and LBP.

Never silently add currencies together.

Use Recharts or another free compatible library.

Provide:

- Revenue chart
- Haircuts by barber
- Service distribution
- Booking status chart
- Recent activity
- Upcoming bookings

Make relevant dashboard elements interactive.

============================================================
30. BARBER PERFORMANCE ANALYTICS
============================================================

This is a high-priority manager feature.

For every barber, show:

- Completed haircut count
- Completed service count
- Collected service revenue
- Outstanding service payments
- Average service value
- Appointment count
- Cancelled appointments
- No-shows
- Services performed
- Tips received
- Commission amount, where applicable

Support:

- Barber filters
- Date filters
- Service filters
- Monthly comparisons
- Export

Make it easy for the manager to compare
the operational contribution of different barbers.

Use objective metrics.

Avoid misleading rankings based on incomplete data.

============================================================
31. FINANCIAL DASHBOARD
============================================================

Manager route:

/manager/finances

Show:

- Service charges
- Discounts
- Collected service revenue
- Unpaid balances
- Partial payments
- Refunds
- Cash collections
- Card collections
- Whish collections
- OMT collections
- Tips
- Salary costs
- Commissions

Provide charts over time.

Important:

The system will NOT initially include
a general operating-expense management module.

Do not add:

- Rent tracking
- Utilities tracking
- Equipment expense tracking
- Inventory costing
- Supplier accounting

Do not label revenue minus salaries as
complete business profit.

Instead display accurately named measures,
such as:

"Revenue After Recorded Payroll"

or

"Service Revenue Less Payroll"

Provide clear explanations of calculations.

Do not combine USD and LBP without
an explicit manager-approved exchange rate.

============================================================
32. EMPLOYEE SALARIES
============================================================

Manager route:

/manager/payroll

Payroll must support all employee types.

Not only barbers.

Monthly payroll period.

The manager may configure a different
compensation method for each employee.

MODELS:

A. Fixed monthly salary

B. Commission per paid service

C. Fixed monthly salary plus commission

Each compensation rule must be configurable.

Example:

Ali:
Fixed monthly salary.

Jad:
10% commission.

Rami:
Fixed salary plus 5% commission.

These are examples, not default compensation facts.

COMMISSION RULES:

Default commission base:

Net collected service revenue attributed
to the employee, after discounts and refunds,
excluding tips.

For partially paid visits, commission
should accrue only on the collected
commissionable portion.

Allocate collected payments to service lines
deterministically for commission calculations.

Store commission calculation snapshots.

A later refund must produce an auditable
commission adjustment.

Do not silently change finalized payroll.

MANAGER FEATURES:

- Set compensation models
- Change effective dates
- View salary calculations
- View commissions
- Add authorized payroll adjustments
- Finalize monthly payroll
- Record salary payments
- View outstanding salary balances
- Export payroll reports

EMPLOYEE RESTRICTION:

The shared Employee account has
NO payroll access.

============================================================
33. CUSTOMER DATA POLICY
============================================================

There is NO CUSTOMER PROFILE MODULE.

Do not build a customer relationship directory.

The system must still safely retain the
minimal guest information necessary
for reservations and service records.

Store this information in the relevant
booking or visit records.

Do not implement:

- Loyalty points
- Customer accounts
- Customer lifetime value profiles
- Favorite service profiles
- Customer marketing segments
- Retention campaigns
- General customer notes

Public booking notes are allowed.

Employee-authored customer notes are NOT required.

Protect all customer contact details.

Do not expose guest names or phone numbers
through public availability endpoints.

Implement appropriate access restrictions.

============================================================
34. CONTENT MANAGEMENT SYSTEM
============================================================

Manager route:

/manager/cms

The Manager must be able to edit the
existing public website without writing code.

CMS MODULES:

HERO

- Headline
- Subtitle
- CTA text
- Background image
- Background video

ABOUT

- Heading
- Description
- Photos

SERVICES

- Published services
- Localized descriptions
- Display order

TEAM

- Barber names
- Photos
- Public descriptions
- Display order

GALLERY

- Upload images
- Upload permitted videos
- Remove media
- Reorder media
- Change captions

CONTACT

- Address
- Phone
- WhatsApp
- Instagram
- Google Maps link

BUSINESS SETTINGS

- Opening hours
- Holiday closures
- Public booking enabled
- Appointment buffers
- Booking rules
- Cancellation rules

SEO

- Page title
- Meta description
- Social sharing image
- Localized metadata

PUBLISHING:

Manager edits should publish immediately.

Do not add a mandatory draft approval workflow.

CMS media should use Supabase Storage.

Implement:

- File type validation
- File size limits
- Authenticated upload permissions
- Safe file paths
- Public/private media separation
- Image optimization
- Deletion policies

Ensure edits appear on the public site
without manually changing application code.

ARCHITECTURAL NOTE:

If static hosting prevents immediate changes
to server-generated SEO metadata, do not
pretend static metadata updates instantly.

Implement the best supported solution and
document the publishing limitation.

============================================================
35. THREE-LANGUAGE SUPPORT
============================================================

The public website must support:

ENGLISH
FRENCH
ARABIC

Arabic must support full RTL presentation.

Implement:

- Language selector
- Localized navigation
- Localized section content
- Localized service descriptions
- Localized booking interface
- Localized confirmation messages
- Correct date/time formatting
- RTL-aware layouts
- Logical CSS properties

Use proper dir="rtl" handling where applicable.

Do not simply right-align Arabic text.

Ensure icons and directional navigation
behave appropriately in RTL.

Store CMS content per language.

If a translation is unavailable,
use a documented fallback strategy.

Internal dashboards may initially use English
unless localization is straightforward.

The public website and customer booking
experience require all three languages.

Do not introduce paid translation services.

Do not generate fabricated business content.

============================================================
36. DATA MODEL
============================================================

Design a normalized PostgreSQL database.

Required conceptual entities:

BUSINESSES
BRANCHES
STAFF
STAFF_POSITIONS
STAFF_WORKING_HOURS
STAFF_TIME_OFF
CHAIRS
CHAIR_ASSIGNMENTS
USER_PROFILES
SERVICES
SERVICE_PRICES
RESERVATIONS
RESERVATION_SERVICES
VISITS
VISIT_SERVICES
PAYMENTS
PAYMENT_ADJUSTMENTS
TIPS
CASH_CLOSINGS
COMPENSATION_RULES
PAYROLL_PERIODS
PAYROLL_LINES
PAYROLL_PAYMENTS
CMS_CONTENT
CMS_MEDIA
BUSINESS_SETTINGS
AUDIT_LOGS
EMAIL_OUTBOX

You may adjust table design to improve
normalization and transactional correctness.

Do not add a persistent Customers table
unless technically justified.

Keep guest contact information associated
with bookings and visits.

REQUIREMENTS:

- UUID primary keys
- Correct foreign keys
- Proper indexes
- Explicit delete behavior
- Monetary precision
- Currency codes
- UTC timestamps
- Booking conflict constraints
- Historical pricing snapshots
- Auditability
- Branch identifier where relevant

Create versioned SQL migrations.

Do not manually change production schema
without migration files.

============================================================
37. DATABASE SECURITY
============================================================

Implement PostgreSQL Row Level Security.

RLS must be enabled on exposed tables.

Review table grants as well as RLS policies.

Public users should access only the
information needed for public browsing
and availability.

Employee account access must be restricted.

Manager account access must be validated securely.

Prevent employees from:

- Reading salaries
- Editing payroll
- Updating global prices
- Managing user roles
- Editing CMS content
- Deleting financial history

Prevent public users from:

- Listing reservation contacts
- Listing private employee information
- Reading payments
- Reading internal analytics
- Accessing audit logs

Use backend functions for sensitive operations.

Do not expose privileged service credentials
in frontend code.

Secure all Edge Functions.

Do not assume hiding a route is authorization.

============================================================
38. BACKEND OPERATIONS
============================================================

Use secure transactional operations for:

- Create public booking request
- Approve booking
- Create internal booking
- Cancel booking
- Reassign barber
- Register completed visit
- Record payment
- Record discount
- Record tip
- Reverse or refund payment
- Finalize payroll
- Publish CMS content

Use appropriate PostgreSQL transactions
or database functions.

Do not implement multi-step critical workflows
using independent unsafe client requests.

Use idempotency protection for operations
that could otherwise be submitted twice.

Validate all financial calculations
on the backend.

The client is responsible for presentation,
not authoritative business calculations.

============================================================
39. REAL-TIME DATA UPDATES
============================================================

When the Employee account approves a booking,
the Manager calendar should update.

When the Manager creates a reservation,
the Employee calendar should update.

When a haircut is completed,
the Manager dashboard should reflect
the updated data.

When a payment is recorded,
financial reporting should reflect it.

Use Supabase Realtime where appropriate.

Use query invalidation or refetching
as a reliability fallback.

Do not make correctness depend entirely
on receiving a realtime event.

Avoid subscribing to more data than necessary.

Respect free-tier limits.

============================================================
40. PUBLIC BOOKING SECURITY
============================================================

Public booking endpoints must have:

- Server-side validation
- Input length restrictions
- Date/time validation
- Rate limiting
- Anti-spam protection
- Booking conflict protection
- Secure cancellation tokens
- Privacy-safe error messages

Use Cloudflare Turnstile Free when feasible.

Verify anti-spam tokens server-side.

Do not reveal private booking records
through the availability API.

Use safe, aggregate availability responses.

Do not expose all reservation details
to anonymous visitors.

Protect against duplicate public submissions.

============================================================
41. USER INTERFACE DESIGN
============================================================

PUBLIC WEBSITE:

Preserve current cinematic design.

Do not downgrade:

- Hero
- Typography
- Animations
- Section transitions
- Gallery
- Navigation
- Brand identity

Public booking must visually match
the existing premium website.

MANAGER DASHBOARD:

Create a sophisticated operational SaaS interface.

Use:

- Sidebar
- Dashboard cards
- Charts
- Tables
- Filters
- Calendar
- Dialogs
- Forms
- Clear feedback states

EMPLOYEE PORTAL:

Simpler than Manager portal.

Prioritize speed.

Make it easy to:

- Approve a booking
- View a barber's schedule
- Record a haircut
- Collect payment

Avoid unnecessary animations in operational workflows.

Make all three interfaces responsive.

============================================================
42. ROUTE STRUCTURE
============================================================

Use the existing framework's routing system.

Suggested routes:

PUBLIC:

/
/book
/booking-result
/booking/cancel

AUTHENTICATION:

/login

MANAGER:

/manager
/manager/calendar
/manager/reservations
/manager/haircuts
/manager/employees
/manager/chairs
/manager/services
/manager/finances
/manager/payroll
/manager/cash-closing
/manager/reports
/manager/cms
/manager/settings

EMPLOYEE:

/employee
/employee/calendar
/employee/reservations
/employee/haircuts/new
/employee/payments
/employee/cash-closing

Adapt the routes if the existing application
already uses a suitable structure.

Do not create duplicate routing systems.

============================================================
43. REPORTING
============================================================

Manager must have reporting tools.

Required reports:

1. Daily revenue
2. Weekly revenue
3. Monthly revenue
4. Revenue by barber
5. Revenue by service
6. Haircuts by barber
7. Completed appointments
8. Pending reservations
9. Cancelled reservations
10. No-shows
11. Average service value
12. Tips by barber
13. Salary totals
14. Commission totals
15. Payment method distribution
16. Cash closing differences
17. Period-over-period comparisons

REPORT FILTERS:

- Date range
- Barber
- Service
- Payment method
- Currency
- Appointment status

EXPORTS:

- CSV
- Excel-compatible exports

Generate actual XLSX only when a suitable
free dependency is available and justified.

Do not fake an XLSX file by renaming CSV.

Ensure all exports respect Manager permissions.

============================================================
44. FINANCIAL ACCURACY
============================================================

Never combine different currencies silently.

Examples:

USD Revenue:
$500

LBP Revenue:
15,000,000 LBP

Do not display an invalid combined total.

Use separate currency totals unless an
explicit conversion policy is configured.

Keep payment amounts exact.

Avoid double-counting:

- One visit with multiple services
- Partial payments
- Refunds
- Tips
- Repeated payment submissions

Ensure reporting uses consistent definitions.

Distinguish:

Service Revenue
Collected Service Revenue
Tips
Outstanding Amount
Refunds
Payroll Costs

Do not create misleading "Net Profit"
metrics without all necessary expense data.

============================================================
45. DAILY OPERATIONS WORKFLOW
============================================================

EXAMPLE 1 — PUBLIC RESERVATION

Customer opens website.

Customer selects:

Haircut + Beard

Customer selects:

Ali

Customer chooses:

Wednesday at 14:00

System checks availability.

Customer enters name and phone.

Customer submits.

Reservation created as Pending.

Slot becomes unavailable.

Employee opens Pending Reservations.

Employee approves booking.

Reservation becomes Confirmed.

Customer arrives.

Ali performs the service.

Employee registers completed haircut.

Employee records payment.

Reservation becomes Completed.

Manager analytics update.

EXAMPLE 2 — WALK-IN

Customer enters the barbershop.

No reservation exists.

Employee opens Register Walk-In.

Employee enters customer name.

Employee chooses barber Jad.

Employee selects Haircut.

System loads official fixed price.

Employee may apply a discount.

Employee records payment.

System creates visit and payment records.

Manager dashboard updates.

EXAMPLE 3 — BARBER CHANGE

Customer booked Ali.

Ali becomes unavailable.

Employee changes assigned barber to Jad.

Backend checks Jad's availability.

If available, reassignment succeeds.

If unavailable, system rejects the change
and provides a useful message.

The reservation retains change history.

EXAMPLE 4 — CASH CLOSING

At the end of the shift:

Employee opens Cash Closing.

System calculates expected cash.

Employee enters actual cash amount.

System calculates difference.

Manager reviews the closing.

============================================================
46. PERFORMANCE AND RESPONSIVENESS
============================================================

The public website must remain fast
despite database integration.

Avoid moving all public rendering into
unnecessary client-side components.

Use caching where safe.

Never cache sensitive user data publicly.

Operational dashboards should:

- Use pagination
- Avoid fetching entire financial history
- Filter queries server-side
- Use appropriate indexes
- Handle loading and error states

Target good Core Web Vitals.

Do not introduce heavy animation
into everyday employee forms.

Avoid unnecessary rerenders.

Test mobile calendar overflow.

Support the expected initial scale
of approximately 50 bookings per day.

============================================================
47. BACKUP AND RECOVERY
============================================================

Create a practical backup strategy.

Include:

- Database backup instructions
- Exportable SQL/data backup
- Migration files
- Restore instructions
- Critical data verification

Protect:

- Reservations
- Service records
- Payments
- Payroll
- CMS content

Document free-tier platform limitations.

Do not claim automatic backups exist
unless configured and verified.

Test restoration when possible.

Never store backup files in a publicly
accessible repository.

============================================================
48. AUTOMATED TESTING
============================================================

Write and execute tests for critical workflows.

AUTHENTICATION:

- Manager login
- Shared Employee login
- Unauthorized access rejection

RESERVATIONS:

- Public pending reservation
- Employee approval
- Manager approval
- Conflicting booking rejection
- Concurrent booking attempts
- Multiple barbers at same time
- Multiple services in one reservation
- Any available barber assignment
- 3-hour cancellation rule
- Pending expiration
- Barber reassignment
- Chair assignment conflicts

EMPLOYEE OPERATIONS:

- Walk-in registration
- Fixed service prices
- Discount application
- Tip recording
- Multiple services
- Correct barber attribution
- Recorded-by staff selection

PAYMENTS:

- Paid
- Partially paid
- Unpaid
- Partial payment completion
- Refund
- Duplicate payment prevention
- Cash closing reconciliation
- Separate currency reporting

PAYROLL:

- Fixed salary
- Commission
- Salary plus commission
- Monthly finalization
- Refund adjustment
- Unauthorized access rejection

CMS:

- Edit hero
- Edit services
- Upload media
- Publish content
- Language switching
- Arabic RTL layout

CALENDAR:

- Month view
- Week view
- Day view
- Barber filter
- All-barbers salon view

SECURITY:

- Anonymous user cannot read customer contacts
- Employee cannot read payroll
- Employee cannot modify global prices
- Employee cannot alter financial history
- Employee cannot edit CMS
- Public booking endpoint resists abuse
- Privileged secrets never appear in client bundle

============================================================
49. IMPLEMENTATION PHASES
============================================================

Complete the project incrementally.

Do not attempt to generate every feature
as one giant untested code change.

PHASE 1 — PROJECT AUDIT

Inspect existing code.

Identify architecture and compatibility.

Document what can be reused.

PHASE 2 — DATABASE FOUNDATION

Create database schema and migrations.

Implement relationships and constraints.

PHASE 3 — AUTHENTICATION AND AUTHORIZATION

Create Manager and Employee access.

Implement backend permission enforcement.

PHASE 4 — STAFF, CHAIRS, AND SERVICES

Build management CRUD.

Configure schedules and pricing.

PHASE 5 — RESERVATION ENGINE

Implement availability calculations,
transaction-safe booking, approvals,
and cancellation rules.

PHASE 6 — PUBLIC BOOKING

Connect the existing website to the
real reservation engine.

PHASE 7 — EMPLOYEE PORTAL

Create calendar, approvals,
walk-in registration, haircut recording,
and payment collection.

PHASE 8 — MANAGER DASHBOARD

Create operational analytics,
reservations, and employee performance reporting.

PHASE 9 — FINANCIAL MANAGEMENT

Implement financial reports, tips,
refunds, cash closing, and reconciliation.

PHASE 10 — PAYROLL

Implement compensation models,
commissions, and monthly payroll.

PHASE 11 — WEBSITE CMS

Connect public content to managed database content.

Support media uploads and immediate publishing.

PHASE 12 — INTERNATIONALIZATION

Implement English, French, and Arabic RTL
for the public website and booking flow.

PHASE 13 — SECURITY AND TESTING

Run automated tests.

Test authorization.

Test race conditions.

Test financial accuracy.

PHASE 14 — DEPLOYMENT AND DOCUMENTATION

Prepare free-tier deployment.

Document environment variables,
database setup, backup, and configuration.

At the end of each phase:

- Implement actual code
- Validate functionality
- Fix failures
- Report what was tested
- Identify external configuration requirements

Maintain a progress checklist in the repository.

Continue with the next phase when feasible.

============================================================
50. FINAL ACCEPTANCE CRITERIA
============================================================

The system is complete only when:

[ ] Existing cinematic website remains functional.
[ ] Public booking is database-connected.
[ ] Customers can select multiple services.
[ ] Customers can select a specific barber.
[ ] Customers can choose any available barber.
[ ] Real available times are displayed.
[ ] Public requests require approval.
[ ] Employee can approve reservations.
[ ] Manager can manage reservations.
[ ] Booking conflicts are prevented.
[ ] Customer can cancel at least 3 hours early.
[ ] Shared Employee login works.
[ ] Multiple employees can use shared sessions.
[ ] Employee can select performing barber.
[ ] Employee can select recording staff member.
[ ] Walk-in registration works.
[ ] Fixed prices are enforced.
[ ] Discounts work.
[ ] Tips are recorded separately.
[ ] Cash and noncash payments work.
[ ] Partial payments work.
[ ] Monthly payroll works.
[ ] Commissions are calculated correctly.
[ ] Financial history is preserved.
[ ] Manager analytics use real data.
[ ] Barber performance reports work.
[ ] Calendar supports month/week/day.
[ ] Salon-style barber columns work.
[ ] Chair tracking works.
[ ] CMS edits appear on public website.
[ ] Arabic RTL works.
[ ] English works.
[ ] French works.
[ ] Exports work.
[ ] Backup documentation exists.
[ ] Security policies are tested.
[ ] Production build succeeds.
[ ] No paid premium UI dependency is required.

============================================================
51. FINAL ENGINEERING RULES
============================================================

DO NOT:

- Rebuild the existing website from scratch.
- Remove established cinematic design.
- Create individual barber accounts.
- Create customer accounts.
- Add customer profile management.
- Introduce employee-authored customer notes.
- Allow employees to change official service prices.
- Allow employees to access salaries.
- Allow employees to erase payment history.
- Count pending reservations as revenue.
- Fabricate financial statistics.
- Use paid calendar resource views.
- Expose privileged Supabase keys in the browser.
- Implement fake authentication.
- Implement fake booking confirmations.
- Skip server-side booking validation.
- Pretend unexecuted tests passed.
- Implement unrelated future modules.
- Replace the existing framework unnecessarily.

DO:

- Preserve existing work.
- Build a genuine database-backed application.
- Use secure authentication and authorization.
- Keep shared-account limitations explicit.
- Enforce booking conflicts transactionally.
- Keep prices fixed and discounts separate.
- Support multiple services per visit.
- Track actual payments.
- Calculate payroll correctly.
- Support USD and LBP separately.
- Build real Manager analytics.
- Build an efficient Employee portal.
- Implement a professional CMS.
- Support multilingual public booking.
- Implement tests.
- Document deployment and backup limitations.

============================================================
52. START IMPLEMENTATION
============================================================

Begin immediately by inspecting the current repository.

First output:

1. Existing architecture summary
2. Components that will be preserved
3. Required new modules
4. Database design outline
5. Implementation sequence
6. External configuration requirements

Then implement the project in the existing codebase.

Do not stop after the analysis.

Do not generate mockups instead of real application code.

Proceed incrementally through the implementation phases.

When credentials or external account setup are required,
implement the code and provide exact setup steps.

Never fabricate credentials.

Never claim production deployment succeeded
without a real successful deployment.

The final application must be a complete,
secure, database-connected barbershop operations
and management platform built upon the current
premium website.

START BY AUDITING THE EXISTING PROJECT.

# BARBERSHOP MANAGEMENT SYSTEM
# MASTER IMPLEMENTATION SPECIFICATION — VERSION 3.0
# EXISTING WEBSITE + PUBLIC BOOKINGS + EMPLOYEE PORTAL
# MANAGER CRM + FINANCIAL ANALYTICS + WEBSITE CMS

============================================================
0. YOUR MISSION
============================================================

You are a multidisciplinary senior software engineering team:

- Principal Software Architect
- Senior React / Next.js / TypeScript Engineer
- PostgreSQL Database Architect
- Supabase Backend Engineer
- Application Security Engineer
- Reservation and Scheduling Systems Engineer
- Financial Systems Engineer
- SaaS Product Designer
- Internationalization Specialist
- Quality Assurance and Testing Engineer

You are working inside an EXISTING barbershop project.

The public website has ALREADY been implemented.

It already runs locally at:

http://127.0.0.1:4173/

Your mission is to extend this existing application
into a functional, database-connected Barbershop
Management System.

Do not start a new project.

Do not replace the public website.

Do not destroy existing animations, branding,
styling, layouts, or reusable components.

Preserve the existing premium, cinematic website.

Add the necessary backend, authentication, databases,
booking functionality, dashboards, employee operations,
financial reporting, and content management.

The final system must contain THREE interfaces:

1. Public customer website
2. Shared Employee portal
3. Manager / CEO portal

There are TWO internal authentication roles:

- MANAGER
- EMPLOYEE

Customers DO NOT create accounts.

The Employee account is SHARED among employees.

The system must support multiple individual barbers
and other staff members without giving each person
a separate login.

All operations must use real, persistent database records.

Do not substitute hardcoded mock data for functioning
business workflows.

============================================================
1. REPOSITORY INSPECTION — MANDATORY FIRST STEP
============================================================

Before installing packages or changing files:

Inspect the existing repository.

Determine:

- Actual frontend framework
- Framework version
- Package manager
- TypeScript configuration
- Existing application routing
- Existing design system
- Existing animation libraries
- Existing UI component libraries
- Existing services and booking components
- Existing public website content
- Current deployment strategy
- Build and preview commands
- Existing environment variables

IMPORTANT:

The application currently runs on port 4173.

Do not assume it uses Next.js solely because the
original design prompt recommended Next.js.

The port may indicate a Vite preview setup.

Determine the actual framework from package.json
and project configuration.

Preserve the existing architecture where practical.

Do not migrate to another framework without
a clear, demonstrated technical requirement.

Create an architecture assessment before making
major changes.

Then extend the existing codebase incrementally.

============================================================
2. ABSOLUTE SOFTWARE BUDGET
============================================================

The initial implementation must use free,
open-source, or free-tier technologies.

Preferred backend:

- Supabase PostgreSQL
- Supabase Auth
- Supabase Edge Functions
- Supabase Storage

Preferred frontend:

- Existing React-based frontend
- TypeScript
- Tailwind CSS
- Existing animation libraries
- shadcn/ui where compatible
- Recharts
- React Hook Form
- Zod

Calendar:

- FullCalendar Standard, if suitable
- Custom React calendar components when needed

Hosting:

- Cloudflare Pages free tier where compatible
- Supabase free tier for initial backend

Do not use paid FullCalendar Scheduler or
premium resource calendar plugins.

Do not require a paid booking platform.

Do not require paid UI components.

Do not require a paid database plan to run locally.

Do not embed paid APIs without explicit approval.

Document actual free-tier limits.

Do not falsely claim that a free-tier deployment
provides production SLAs or automatic backups.

Implement without requiring a paid subscription,
while documenting unavoidable external requirements.

============================================================
3. BUSINESS MODEL
============================================================

Initially, the system serves ONE physical barbershop.

Expected staff:

Approximately 6–10 barbers.

The manager must be able to configure the actual number.

The shop may also employ:

- Receptionists
- Cleaners
- Assistants
- Other staff categories

Employee positions must be configurable.

Do not assume every employee performs haircuts.

FUTURE BRANCH SUPPORT:

The business may operate multiple branches later.

An employee may eventually work at more than one branch.

For now:

- Implement one operational branch.
- Include a simple branch identifier in relevant records.
- Keep the data model compatible with future expansion.
- Do not build a complex multi-branch management UI.
- Do not implement branch transfers yet.

Avoid unnecessary future features.

============================================================
4. INTERNAL ACCOUNTS AND AUTHENTICATION
============================================================

There are TWO account roles.

ROLE A — MANAGER

Initially, one manager account.

The architecture must support additional manager
accounts created by an authorized manager later.

Managers have full authorized system access.

ROLE B — EMPLOYEE

ONE shared account.

Example login identity:

employee

All employees may use this shared account.

The account can remain signed in on
authorized shop devices.

Multiple sessions may exist simultaneously.

Do not create a personal login for each barber.

Do not require personal PINs.

Do not require employees to authenticate individually.

IMPORTANT ACCOUNTABILITY REQUIREMENT:

Because employees share one account, the system
cannot securely identify the actual human operator.

For haircut registration, provide:

"Performed By" — required barber selection.

"Recorded By" — required staff name selection.

Store both values.

Also store the authenticated account and timestamp.

Treat "Recorded By" as a DECLARED identity,
not a cryptographically verified identity.

Do not claim that these records prove which
employee entered information.

MANAGER SECURITY:

Manager credentials must never be shared with
the employee account.

Managers must have their own authentication sessions.

Implement secure password authentication.

Use Supabase Auth.

Enforce authorization on the backend and in RLS.

Disable public registration for internal accounts.

Use a secure initial manager setup.

Only authorized managers can create
additional internal accounts.

Use safe password reset procedures.

Never expose privileged service credentials
to browser code.

Provide sign-out controls.

Do not force automatic inactivity logout
for the shared employee account.

Document the security implications of persistent
shared sessions.

============================================================
5. ACCESS CONTROL MATRIX
============================================================

PUBLIC VISITOR:

Allowed:

- View public website
- View published services and prices
- View public barber information
- View available appointment slots
- Submit booking requests
- Cancel their own booking with secure token
  when permitted by cancellation rules

Not allowed:

- Access internal dashboards
- Read other customers' details
- Read employee records beyond published information
- View financial data
- Access payroll
- Modify services
- Access private reservations

EMPLOYEE:

Allowed:

- View all shop reservations
- Filter reservations by barber
- View day/week/month calendars
- Create internal reservations
- Approve public booking requests
- Mark reservations completed
- Mark cancellations and no-shows where permitted
- Reassign a barber when necessary
- Register walk-in haircuts
- Register completed services
- Select which barber performed a service
- Select who recorded the service
- Record payments
- Apply discounts
- Record tips
- View today's operational activity
- Record daily cash-closing information
- Print operational receipts

Not allowed:

- Delete historical haircut records
- Permanently delete reservations
- Delete payments
- Modify official service prices
- Modify salaries
- Change employee compensation
- Edit the public website
- View payroll reports
- View confidential business-wide analytics
- Edit system roles
- Access manager-only settings

MANAGER:

Allowed:

- Full reservation management
- Full employee management
- Full service management
- Full calendar management
- Financial monitoring
- Payroll and compensation configuration
- Audited financial corrections
- Website CMS management
- Business settings
- Exports
- Reports
- Access management

IMPORTANT:

Employee permissions are deliberately narrower
than full CRUD.

Employees can create records and perform specific
approved workflow updates.

They cannot arbitrarily edit or delete any record.

Manager deletion of financial information must
use audited reversal or soft-deletion semantics
where appropriate.

============================================================
6. STAFF MANAGEMENT
============================================================

Manager route:

/manager/employees

Implement CRUD for personnel records.

Fields:

- ID
- Full name
- Position
- Phone, optional
- Active/inactive
- Is bookable barber
- Employment start date
- Working schedule
- Time-off schedule
- Salary arrangement
- Display order
- Optional public website profile

Allow manager-defined job titles.

Examples:

Barber
Senior Barber
Receptionist
Cleaner
Assistant

A non-barber employee must not appear in public
barber selection unless explicitly enabled.

Allow employees to be deactivated without
deleting historical service and financial records.

============================================================
7. WORKING HOURS AND AVAILABILITY
============================================================

Each barber must have an independently
configurable weekly schedule.

Example:

Ali:
Monday, Wednesday, Friday

Jad:
Tuesday, Thursday, Saturday

Working hours may differ by employee.

Manager can configure:

- Weekly working hours
- Multiple work intervals in a day
- Breaks
- Days off
- Vacations
- Holidays
- Temporary unavailability
- Exceptional working hours

Business opening hours are separate.

A barber may only be publicly bookable when
both the shop and barber are available.

Support schedule exceptions.

Use the Asia/Beirut timezone by default.

Store actual appointment instants in UTC.

Handle daylight-saving transitions correctly.

============================================================
8. PHYSICAL CHAIR MANAGEMENT
============================================================

The system must independently track barber chairs.

Chairs are physical resources.

They are NOT permanently owned by a particular barber.

Manager route:

/manager/chairs

The manager can:

- Add chairs
- Edit chair names/numbers
- Activate/deactivate chairs
- Assign chairs during particular shifts
- Reassign chairs when schedules change

Example:

Chair A:
Ali uses it Monday, Wednesday, Friday.

Jad uses it Tuesday and Thursday.

Support flexible time-based chair assignments.

Prevent conflicting explicit chair assignments.

Allow a chair to be reused at non-overlapping times.

Show chair information in the internal calendar
when relevant.

Do not force public customers to select a chair.

Public customers select a barber.

The system can manage physical chair allocation
internally.

Implement chair conflict rules without
unnecessarily preventing valid bookings.

If strict chair-capacity enforcement is enabled,
validate available physical chairs transactionally.

============================================================
9. PUBLIC CUSTOMER BOOKING
============================================================

Preserve the existing public website.

Its "Book Now" button must launch
a genuinely functional booking workflow.

Route:

/book

Customers DO NOT create accounts.

BOOKING STEPS:

STEP 1:
Select one or more services.

STEP 2:
Select a specific barber or "Any Available Barber."

STEP 3:
Select a date.

STEP 4:
Select an available time.

STEP 5:
Enter customer information.

STEP 6:
Review booking details.

STEP 7:
Submit booking request.

CUSTOMER INFORMATION:

Required:
- Full name
- Phone number

Optional:
- Email address
- Booking notes

The booking notes are entered by the customer.

Do not create employee-authored customer notes.

Do not create a separate customer profile.

Do not require customers to sign in.

BOOKING DETAILS:

- Selected services
- Total estimated duration
- Assigned barber
- Date
- Start time
- End time
- Service price summary
- Customer name
- Customer phone
- Optional email
- Optional customer notes

Support multiple services in one appointment.

Example:

Haircut — 30 minutes
Beard Trim — 15 minutes

Combined duration:
45 minutes

Apply the configured appointment buffer.

============================================================
10. PUBLIC BOOKING APPROVAL
============================================================

PUBLIC BOOKINGS REQUIRE STAFF APPROVAL.

When a visitor submits a reservation:

1. Validate the request.
2. Verify actual availability.
3. Create a Pending reservation.
4. Reserve the selected timeslot.
5. Display a pending confirmation message.
6. Add it to the internal booking queue.

The booking is NOT immediately confirmed.

A manager or the shared Employee account
must approve the request.

After approval:

Pending -> Confirmed

After the visit:

Confirmed -> Completed

Additional statuses:

Cancelled
No Show

Do not add unnecessary lifecycle stages.

Show a clear status label everywhere.

IMPORTANT:

Pending reservations must block overlapping
requests until approved, rejected, cancelled,
or expired.

Use a configurable pending-expiration policy
to prevent abandoned reservations from
blocking availability indefinitely.

Default recommendation:

Expire unapproved public requests after
a configurable 24-hour period, or sooner
when the appointment start time is reached.

Allow the manager to change this policy.

A legitimate customer should receive an
accurate status.

Do not display "Confirmed" for Pending bookings.

EMPLOYEE-CREATED RESERVATIONS:

When the shared Employee account creates
a reservation internally, it may be
confirmed immediately.

No additional manager approval is required.

============================================================
11. BOOKING HORIZON AND TIME SLOTS
============================================================

Customers may book:

- On the current day
- Several days ahead
- Weeks ahead
- Months ahead
- Further into the future

Do not impose a business-defined maximum
booking horizon by default.

Use bounded API queries and pagination to
avoid unbounded database or calendar requests.

Use a configurable slot interval.

Default:
15 minutes.

Each service has its own duration.

Service durations are manager-configurable.

Manager may also adjust the duration
of a particular reservation.

Add a configurable appointment buffer.

Default:
5 minutes.

Support a 10-minute buffer option.

Calculate available slots using:

- Business opening hours
- Barber working hours
- Barber breaks
- Barber time off
- Existing reservations
- Pending reservations
- Service duration
- Buffer duration
- Chair constraints when applicable

============================================================
12. BOOKING CONFLICT PREVENTION
============================================================

This is a CRITICAL correctness requirement.

Never rely on frontend availability checks alone.

Enforce booking conflicts at the database level.

For the same barber:

Two active reservations cannot overlap.

Use PostgreSQL transactional logic.

Use appropriate range constraints such as
tstzrange with exclusion constraints where suitable.

Handle concurrent booking attempts safely.

Example:

Ali booked:
14:00–14:30

Second request:
14:15–14:45

Result:
Reject overlapping request.

Jad available:
14:15–14:45

Result:
Allow reservation if all other constraints pass.

ANY AVAILABLE BARBER:

Find an eligible available barber.

Assign the barber atomically.

Prevent race conditions.

If the slot becomes unavailable,
return an informative error.

Provide alternative available times.

Test concurrent requests explicitly.

============================================================
13. PUBLIC CANCELLATION RULE
============================================================

Customers may cancel their own reservation
through the website if the appointment
is at least 3 hours away.

Example:

Appointment:
15:00

Customer cancellation:
Before or at 12:00 — allowed online.

After 12:00 — customer must contact the shop.

Use the business timezone for display
and absolute timestamps for comparisons.

PUBLIC CANCELLATION SECURITY:

Do not expose customer reservation records
through sequential IDs.

Use a secure, unguessable cancellation token.

Store only a secure token hash.

Allow customers to cancel only their own
booking through the valid token.

Do not allow public users to access
other customers' information.

Public self-rescheduling is not required
in the initial implementation.

Staff can manage scheduling adjustments internally.

============================================================
14. LATE ARRIVAL AND NO-SHOW POLICY
============================================================

Implement configurable late-arrival handling.

Recommended initial behavior:

- Show late appointments clearly in the calendar.
- Do not automatically cancel a reservation
  solely because the customer is late.
- Allow staff to mark a No Show.
- Allow staff to complete the appointment if
  the customer eventually receives the service.
- Allow the manager to adjust the grace period.

Suggested initial grace period:

10 minutes.

Avoid creating unnecessary automatic penalties.

Do not automatically charge customers
for missed appointments.

============================================================
15. PUBLIC BOOKING CONFIRMATIONS
============================================================

On-screen confirmation is mandatory.

Transactional email is required where
a valid email address has been provided
and email delivery is configured.

For a new public request:

Show:
"Booking Request Received."

After staff approval:

Show/send:
"Appointment Confirmed."

After cancellation:

Show/send:
"Appointment Cancelled."

Do not invent email delivery success.

Use a free-tier compatible transactional
email provider where possible.

Suggested:
Resend.

Use a secure Edge Function for email sending.

Never place email API secrets in frontend code.

Implement an email outbox with:

- Event type
- Recipient
- Delivery status
- Retry count
- Last error
- Creation timestamp

Use idempotent delivery logic.

Handle rate limits gracefully.

Do not block successful reservation creation
merely because an email provider is temporarily down.

If the customer provides no email address,
display on-screen confirmation and a secure
cancellation link that can be saved.

Clearly explain the limits of email notifications.

============================================================
16. BOOKING CALENDAR
============================================================

Both Manager and Employee have calendars.

Manager route:

/manager/calendar

Employee route:

/employee/calendar

REQUIRED VIEWS:

- Month
- Week
- Day

REQUIRED FILTERS:

- All barbers
- Specific barber
- Appointment status
- Service
- Date range

SALON-STYLE CALENDAR:

For day and week views, create an optional
salon scheduling layout.

Show each barber in a separate column.

Example:

TIME       ALI       JAD       RAMI
09:00      Booking   Free      Booking
09:30      Booking   Booking   Free
10:00      Free      Booking   Booking

Use a real interactive calendar interface.

This diagram is illustrative only.

Use a responsive grid with sticky time labels,
barber headers, and reservation blocks.

Do not use paid FullCalendar resource plugins.

Use FullCalendar Standard for standard
month/week/day views where suitable.

Implement the barber-column view using
custom React components and free libraries.

Calendar reservations should show:

- Customer name
- Time
- Barber
- Service
- Status

Avoid showing unnecessary contact information
in crowded calendar views.

Clicking a reservation opens its details.

MANAGER:

May create, edit, reschedule, cancel,
and reassign reservations.

EMPLOYEE:

May create bookings, approve bookings,
update permitted statuses, and correct
barber assignments.

Employees cannot arbitrarily delete
or alter historical records.

Validate every calendar modification on the backend.

============================================================
17. EMPLOYEE PORTAL
============================================================

Route:

/employee

Create a clean, responsive operational dashboard.

PRIMARY MODULES:

Dashboard
Calendar
Reservations
Register Haircut
Payments
Cash Closing

EMPLOYEE DASHBOARD:

Show:

- Today's reservations
- Pending booking requests
- Upcoming appointments
- Completed haircuts today
- Bookings by barber
- Quick actions

QUICK ACTIONS:

"View Calendar"
"Approve Booking"
"Add Reservation"
"Register Haircut"
"Record Payment"

Do not display business-wide profit,
payroll totals, or confidential financial analytics.

Employees may see payment information required
for operating the cash register.

Avoid exposing unnecessary manager-only reports.

Optimize the experience for tablets and phones.

============================================================
18. RESERVATION MANAGEMENT
============================================================

Create a searchable reservations table.

Features:

- Date filtering
- Barber filtering
- Status filtering
- Service filtering
- Search by customer name
- Search by booking reference
- Sort by appointment time
- Pagination

BOOKING DETAILS:

- Customer name
- Phone
- Optional email
- Optional customer-entered notes
- Selected services
- Barber
- Assigned chair, if applicable
- Start and end time
- Reservation status
- Payment status
- Booking source

Booking source:

Public Website
Employee
Manager

PUBLIC RESERVATIONS:

Created as Pending.

EMPLOYEE/MANAGER RESERVATIONS:

Can be created as Confirmed.

Employees can approve or cancel eligible bookings
according to their allowed workflows.

Managers have full administrative control.

Historical changes must be auditable.

============================================================
19. WALK-IN CUSTOMERS
============================================================

Support walk-in customers.

A walk-in customer has no prior reservation.

The employee can select:

"Register Walk-In"

Required:

- Customer name
- Barber
- Service or services
- Actual completion time
- Payment information

Phone may be optional for walk-ins.

Do not require a customer account.

Do not create a persistent customer profile.

Each walk-in becomes an independent visit record.

The haircut and associated payment appear
in operational and financial reporting.

============================================================
20. NO CUSTOMER PROFILE MODULE
============================================================

THIS IS AN EXPLICIT REQUIREMENT.

Do not create:

- Customer accounts
- Customer login
- Customer dashboard
- Customer directory
- Customer loyalty profiles
- Favorite barber profiles
- Customer spending history page
- Customer segmentation
- Marketing CRM
- Employee-authored customer notes

Customer contact information exists only
where necessary for reservations and visits.

A reservation must store:

- Customer name
- Phone
- Optional email
- Optional customer notes

A walk-in service record must store
the name required to record the visit.

Do not introduce a separate Customers table
unless technically necessary.

Prefer guest information attached directly
to reservations and visits.

Keep personal data collection minimal.

Protect private booking records.

Support appropriate retention and deletion
of personal data without destroying necessary
financial history.

============================================================
21. HAIRCUT AND SERVICE REGISTRATION
============================================================

This is one of the most important workflows.

Employee route:

/employee/haircuts/new

Manager may access the same functionality
through the management portal.

FORM FIELDS:

Customer Name:
Required.

Existing Reservation:
Optional.

Performed By:
Required barber selection.

Recorded By:
Required employee name selection.

Services:
One or multiple.

Date:
Required.

Time:
Required.

Standard Price:
Automatic.

Discount:
Optional.

Tip:
Optional.

Payment Method:
Required when payment is recorded.

Payment Status:
Paid / Partially Paid / Unpaid.

IMPORTANT PRICE RULE:

Official service prices are FIXED.

Employees cannot enter arbitrary service prices.

The manager defines service prices.

The transaction uses the configured service prices.

Employees may apply discounts.

Do not change the underlying service catalog
when a discount is applied.

Example:

Haircut:
$20

Discount:
$5

Charged:
$15

Tip:
$3

Service Revenue:
$15

Tips Collected:
$3

Total Collected:
$18

Keep the tip separate from service revenue.

Allow discounts without requiring
manager approval.

Ensure discounts cannot produce
a negative charged amount.

Record a discount reason if useful
for transparency and auditing.

============================================================
22. MULTIPLE SERVICES PER VISIT
============================================================

One customer may receive several services.

Example:

Haircut:
$15

Beard Trim:
$5

Total:
$20

One visit.
One payment summary.

Store each service as a separate line item
linked to the same visit.

Retain:

- Service ID
- Service name snapshot
- Standard price snapshot
- Discount allocation
- Net service charge
- Performing barber
- Duration

By default, one barber performs all services
for a public booking.

Manager or Employee may correct the assigned
barber when operationally necessary.

For internally registered visits, allow
different services to be attributed to
different barbers if genuinely performed
by different employees.

Ensure financial reporting and commissions
attribute each service to the correct barber.

One visit can have multiple services
without producing duplicate visit counts.

============================================================
23. SERVICE CATALOG
============================================================

Manager route:

/manager/services

Manager can:

- Create services
- Edit services
- Set prices
- Set durations
- Reorder services
- Activate/deactivate services
- Configure availability
- Configure public visibility

Fields:

- ID
- Name
- Localized name
- Description
- Localized description
- Duration
- Price
- Currency
- Active
- Publicly visible
- Display order

Prices must support:

USD
LBP

Every price must have an explicit currency.

Do not automatically convert between currencies.

The manager may configure prices for
each supported currency.

Use decimal-safe monetary representations.

Prefer integer minor-unit storage where suitable.

Never use JavaScript floating-point arithmetic
for authoritative financial calculations.

Keep historical service price snapshots.

Changing a service price must not
change old financial transactions.

============================================================
24. PAYMENTS
============================================================

Supported payment methods:

- Cash
- Card
- Whish
- OMT
- Other

Supported payment states:

- Paid
- Partially Paid
- Unpaid

Customers normally pay after receiving services.

Employees record the actual collection.

One visit may have multiple services.

One visit has one consolidated payment summary,
but may contain multiple payment entries
to support partial or split payments.

Example:

Visit total:
$20

First payment:
$10 Cash

Second payment:
$10 Whish

Remaining:
$0

Payment status:
Paid

Record:

- Payment ID
- Visit ID
- Amount
- Currency
- Method
- Timestamp
- Authenticated account
- Declared recording employee
- Status

Prevent duplicate submissions.

Use transaction-safe payment writes.

Do not recognize reservation value as collected income.

Revenue reports must distinguish:

- Service charges
- Discounts
- Amount collected
- Outstanding balance
- Refunds
- Tips

============================================================
25. TIPS
============================================================

Record tips separately from service prices.

Fields:

- Visit ID
- Tip amount
- Currency
- Recipient barber
- Payment method
- Date

Tips do not automatically increase
service revenue.

Tips must not automatically increase
commissionable service value.

Allow the manager to inspect tips by barber.

If one visit involves multiple barbers,
support explicitly assigning tips to one
or more relevant employees.

Do not silently split tips equally.

============================================================
26. REFUNDS AND FINANCIAL CORRECTIONS
============================================================

Manager-only functionality.

Manager route:

/manager/finances

Allow:

- Refunds
- Payment corrections
- Transaction reversals
- Audited adjustments

Never permanently erase financial history.

Do not silently overwrite an original payment.

Create linked correction records.

Store:

- Original payment reference
- Adjustment amount
- Adjustment reason
- Manager actor
- Timestamp

Recalculate financial reports correctly.

Employees cannot reverse historical payments.

Do not allow direct unauthorized table updates
to bypass these rules.

============================================================
27. CASH REGISTER AND DAILY CLOSING
============================================================

Implement a basic cash closing feature.

Employee may record end-of-shift cash details.

Manager may review and approve.

Example:

Expected Cash:
$500

Actual Cash Counted:
$490

Difference:
-$10

The expected cash amount should come from
recorded cash payments and cash adjustments.

Include cash tips consistently and report
them separately from service revenue.

Exclude card, Whish, OMT, and other noncash
payments from expected physical cash.

Store:

- Opening balance, if used
- Period
- Expected cash
- Counted cash
- Difference
- Declared employee
- Account identity
- Manager review
- Closing timestamp

Provide daily and custom-period filtering.

Do not use this screen to expose
full business financial analytics to employees.

============================================================
28. RECEIPTS
============================================================

Generate professional payment receipts.

Support:

- Printable receipt
- Downloadable PDF receipt

Receipt includes:

- Barbershop name
- Address and contact details
- Receipt reference
- Date and time
- Customer name, if supplied
- Services
- Prices
- Discounts
- Tips
- Payment methods
- Paid amount
- Remaining balance
- Currency

Use a clean, professional layout.

Do not label the receipt as a legally compliant
tax invoice without the required configuration.

Do not invent tax numbers or tax rates.

Preserve transaction references.

============================================================
29. MANAGER DASHBOARD
============================================================

Route:

/manager

Create a premium SaaS-style management dashboard.

Preserve the existing barbershop brand identity,
but prioritize readability and operational clarity.

SIDEBAR:

Overview
Calendar
Reservations
Haircuts
Employees
Chairs
Services
Finances
Payroll
Cash Closing
Website CMS
Reports
Settings

OVERVIEW KPIs:

- Today's collected service revenue
- Weekly collected service revenue
- Monthly collected service revenue
- Today's completed haircuts
- Total upcoming reservations
- Pending approvals
- Cancellations
- No-shows
- Active barbers
- Average haircut transaction value

Use real database queries.

No hardcoded analytics.

Allow filtering by:

Today
This Week
This Month
Custom Period

Show separate totals for USD and LBP.

Never silently add currencies together.

Use Recharts or another free compatible library.

Provide:

- Revenue chart
- Haircuts by barber
- Service distribution
- Booking status chart
- Recent activity
- Upcoming bookings

Make relevant dashboard elements interactive.

============================================================
30. BARBER PERFORMANCE ANALYTICS
============================================================

This is a high-priority manager feature.

For every barber, show:

- Completed haircut count
- Completed service count
- Collected service revenue
- Outstanding service payments
- Average service value
- Appointment count
- Cancelled appointments
- No-shows
- Services performed
- Tips received
- Commission amount, where applicable

Support:

- Barber filters
- Date filters
- Service filters
- Monthly comparisons
- Export

Make it easy for the manager to compare
the operational contribution of different barbers.

Use objective metrics.

Avoid misleading rankings based on incomplete data.

============================================================
31. FINANCIAL DASHBOARD
============================================================

Manager route:

/manager/finances

Show:

- Service charges
- Discounts
- Collected service revenue
- Unpaid balances
- Partial payments
- Refunds
- Cash collections
- Card collections
- Whish collections
- OMT collections
- Tips
- Salary costs
- Commissions

Provide charts over time.

Important:

The system will NOT initially include
a general operating-expense management module.

Do not add:

- Rent tracking
- Utilities tracking
- Equipment expense tracking
- Inventory costing
- Supplier accounting

Do not label revenue minus salaries as
complete business profit.

Instead display accurately named measures,
such as:

"Revenue After Recorded Payroll"

or

"Service Revenue Less Payroll"

Provide clear explanations of calculations.

Do not combine USD and LBP without
an explicit manager-approved exchange rate.

============================================================
32. EMPLOYEE SALARIES
============================================================

Manager route:

/manager/payroll

Payroll must support all employee types.

Not only barbers.

Monthly payroll period.

The manager may configure a different
compensation method for each employee.

MODELS:

A. Fixed monthly salary

B. Commission per paid service

C. Fixed monthly salary plus commission

Each compensation rule must be configurable.

Example:

Ali:
Fixed monthly salary.

Jad:
10% commission.

Rami:
Fixed salary plus 5% commission.

These are examples, not default compensation facts.

COMMISSION RULES:

Default commission base:

Net collected service revenue attributed
to the employee, after discounts and refunds,
excluding tips.

For partially paid visits, commission
should accrue only on the collected
commissionable portion.

Allocate collected payments to service lines
deterministically for commission calculations.

Store commission calculation snapshots.

A later refund must produce an auditable
commission adjustment.

Do not silently change finalized payroll.

MANAGER FEATURES:

- Set compensation models
- Change effective dates
- View salary calculations
- View commissions
- Add authorized payroll adjustments
- Finalize monthly payroll
- Record salary payments
- View outstanding salary balances
- Export payroll reports

EMPLOYEE RESTRICTION:

The shared Employee account has
NO payroll access.

============================================================
33. CUSTOMER DATA POLICY
============================================================

There is NO CUSTOMER PROFILE MODULE.

Do not build a customer relationship directory.

The system must still safely retain the
minimal guest information necessary
for reservations and service records.

Store this information in the relevant
booking or visit records.

Do not implement:

- Loyalty points
- Customer accounts
- Customer lifetime value profiles
- Favorite service profiles
- Customer marketing segments
- Retention campaigns
- General customer notes

Public booking notes are allowed.

Employee-authored customer notes are NOT required.

Protect all customer contact details.

Do not expose guest names or phone numbers
through public availability endpoints.

Implement appropriate access restrictions.

============================================================
34. CONTENT MANAGEMENT SYSTEM
============================================================

Manager route:

/manager/cms

The Manager must be able to edit the
existing public website without writing code.

CMS MODULES:

HERO

- Headline
- Subtitle
- CTA text
- Background image
- Background video

ABOUT

- Heading
- Description
- Photos

SERVICES

- Published services
- Localized descriptions
- Display order

TEAM

- Barber names
- Photos
- Public descriptions
- Display order

GALLERY

- Upload images
- Upload permitted videos
- Remove media
- Reorder media
- Change captions

CONTACT

- Address
- Phone
- WhatsApp
- Instagram
- Google Maps link

BUSINESS SETTINGS

- Opening hours
- Holiday closures
- Public booking enabled
- Appointment buffers
- Booking rules
- Cancellation rules

SEO

- Page title
- Meta description
- Social sharing image
- Localized metadata

PUBLISHING:

Manager edits should publish immediately.

Do not add a mandatory draft approval workflow.

CMS media should use Supabase Storage.

Implement:

- File type validation
- File size limits
- Authenticated upload permissions
- Safe file paths
- Public/private media separation
- Image optimization
- Deletion policies

Ensure edits appear on the public site
without manually changing application code.

ARCHITECTURAL NOTE:

If static hosting prevents immediate changes
to server-generated SEO metadata, do not
pretend static metadata updates instantly.

Implement the best supported solution and
document the publishing limitation.

============================================================
35. THREE-LANGUAGE SUPPORT
============================================================

The public website must support:

ENGLISH
FRENCH
ARABIC

Arabic must support full RTL presentation.

Implement:

- Language selector
- Localized navigation
- Localized section content
- Localized service descriptions
- Localized booking interface
- Localized confirmation messages
- Correct date/time formatting
- RTL-aware layouts
- Logical CSS properties

Use proper dir="rtl" handling where applicable.

Do not simply right-align Arabic text.

Ensure icons and directional navigation
behave appropriately in RTL.

Store CMS content per language.

If a translation is unavailable,
use a documented fallback strategy.

Internal dashboards may initially use English
unless localization is straightforward.

The public website and customer booking
experience require all three languages.

Do not introduce paid translation services.

Do not generate fabricated business content.

============================================================
36. DATA MODEL
============================================================

Design a normalized PostgreSQL database.

Required conceptual entities:

BUSINESSES
BRANCHES
STAFF
STAFF_POSITIONS
STAFF_WORKING_HOURS
STAFF_TIME_OFF
CHAIRS
CHAIR_ASSIGNMENTS
USER_PROFILES
SERVICES
SERVICE_PRICES
RESERVATIONS
RESERVATION_SERVICES
VISITS
VISIT_SERVICES
PAYMENTS
PAYMENT_ADJUSTMENTS
TIPS
CASH_CLOSINGS
COMPENSATION_RULES
PAYROLL_PERIODS
PAYROLL_LINES
PAYROLL_PAYMENTS
CMS_CONTENT
CMS_MEDIA
BUSINESS_SETTINGS
AUDIT_LOGS
EMAIL_OUTBOX

You may adjust table design to improve
normalization and transactional correctness.

Do not add a persistent Customers table
unless technically justified.

Keep guest contact information associated
with bookings and visits.

REQUIREMENTS:

- UUID primary keys
- Correct foreign keys
- Proper indexes
- Explicit delete behavior
- Monetary precision
- Currency codes
- UTC timestamps
- Booking conflict constraints
- Historical pricing snapshots
- Auditability
- Branch identifier where relevant

Create versioned SQL migrations.

Do not manually change production schema
without migration files.

============================================================
37. DATABASE SECURITY
============================================================

Implement PostgreSQL Row Level Security.

RLS must be enabled on exposed tables.

Review table grants as well as RLS policies.

Public users should access only the
information needed for public browsing
and availability.

Employee account access must be restricted.

Manager account access must be validated securely.

Prevent employees from:

- Reading salaries
- Editing payroll
- Updating global prices
- Managing user roles
- Editing CMS content
- Deleting financial history

Prevent public users from:

- Listing reservation contacts
- Listing private employee information
- Reading payments
- Reading internal analytics
- Accessing audit logs

Use backend functions for sensitive operations.

Do not expose privileged service credentials
in frontend code.

Secure all Edge Functions.

Do not assume hiding a route is authorization.

============================================================
38. BACKEND OPERATIONS
============================================================

Use secure transactional operations for:

- Create public booking request
- Approve booking
- Create internal booking
- Cancel booking
- Reassign barber
- Register completed visit
- Record payment
- Record discount
- Record tip
- Reverse or refund payment
- Finalize payroll
- Publish CMS content

Use appropriate PostgreSQL transactions
or database functions.

Do not implement multi-step critical workflows
using independent unsafe client requests.

Use idempotency protection for operations
that could otherwise be submitted twice.

Validate all financial calculations
on the backend.

The client is responsible for presentation,
not authoritative business calculations.

============================================================
39. REAL-TIME DATA UPDATES
============================================================

When the Employee account approves a booking,
the Manager calendar should update.

When the Manager creates a reservation,
the Employee calendar should update.

When a haircut is completed,
the Manager dashboard should reflect
the updated data.

When a payment is recorded,
financial reporting should reflect it.

Use Supabase Realtime where appropriate.

Use query invalidation or refetching
as a reliability fallback.

Do not make correctness depend entirely
on receiving a realtime event.

Avoid subscribing to more data than necessary.

Respect free-tier limits.

============================================================
40. PUBLIC BOOKING SECURITY
============================================================

Public booking endpoints must have:

- Server-side validation
- Input length restrictions
- Date/time validation
- Rate limiting
- Anti-spam protection
- Booking conflict protection
- Secure cancellation tokens
- Privacy-safe error messages

Use Cloudflare Turnstile Free when feasible.

Verify anti-spam tokens server-side.

Do not reveal private booking records
through the availability API.

Use safe, aggregate availability responses.

Do not expose all reservation details
to anonymous visitors.

Protect against duplicate public submissions.

============================================================
41. USER INTERFACE DESIGN
============================================================

PUBLIC WEBSITE:

Preserve current cinematic design.

Do not downgrade:

- Hero
- Typography
- Animations
- Section transitions
- Gallery
- Navigation
- Brand identity

Public booking must visually match
the existing premium website.

MANAGER DASHBOARD:

Create a sophisticated operational SaaS interface.

Use:

- Sidebar
- Dashboard cards
- Charts
- Tables
- Filters
- Calendar
- Dialogs
- Forms
- Clear feedback states

EMPLOYEE PORTAL:

Simpler than Manager portal.

Prioritize speed.

Make it easy to:

- Approve a booking
- View a barber's schedule
- Record a haircut
- Collect payment

Avoid unnecessary animations in operational workflows.

Make all three interfaces responsive.

============================================================
42. ROUTE STRUCTURE
============================================================

Use the existing framework's routing system.

Suggested routes:

PUBLIC:

/
/book
/booking-result
/booking/cancel

AUTHENTICATION:

/login

MANAGER:

/manager
/manager/calendar
/manager/reservations
/manager/haircuts
/manager/employees
/manager/chairs
/manager/services
/manager/finances
/manager/payroll
/manager/cash-closing
/manager/reports
/manager/cms
/manager/settings

EMPLOYEE:

/employee
/employee/calendar
/employee/reservations
/employee/haircuts/new
/employee/payments
/employee/cash-closing

Adapt the routes if the existing application
already uses a suitable structure.

Do not create duplicate routing systems.

============================================================
43. REPORTING
============================================================

Manager must have reporting tools.

Required reports:

1. Daily revenue
2. Weekly revenue
3. Monthly revenue
4. Revenue by barber
5. Revenue by service
6. Haircuts by barber
7. Completed appointments
8. Pending reservations
9. Cancelled reservations
10. No-shows
11. Average service value
12. Tips by barber
13. Salary totals
14. Commission totals
15. Payment method distribution
16. Cash closing differences
17. Period-over-period comparisons

REPORT FILTERS:

- Date range
- Barber
- Service
- Payment method
- Currency
- Appointment status

EXPORTS:

- CSV
- Excel-compatible exports

Generate actual XLSX only when a suitable
free dependency is available and justified.

Do not fake an XLSX file by renaming CSV.

Ensure all exports respect Manager permissions.

============================================================
44. FINANCIAL ACCURACY
============================================================

Never combine different currencies silently.

Examples:

USD Revenue:
$500

LBP Revenue:
15,000,000 LBP

Do not display an invalid combined total.

Use separate currency totals unless an
explicit conversion policy is configured.

Keep payment amounts exact.

Avoid double-counting:

- One visit with multiple services
- Partial payments
- Refunds
- Tips
- Repeated payment submissions

Ensure reporting uses consistent definitions.

Distinguish:

Service Revenue
Collected Service Revenue
Tips
Outstanding Amount
Refunds
Payroll Costs

Do not create misleading "Net Profit"
metrics without all necessary expense data.

============================================================
45. DAILY OPERATIONS WORKFLOW
============================================================

EXAMPLE 1 — PUBLIC RESERVATION

Customer opens website.

Customer selects:

Haircut + Beard

Customer selects:

Ali

Customer chooses:

Wednesday at 14:00

System checks availability.

Customer enters name and phone.

Customer submits.

Reservation created as Pending.

Slot becomes unavailable.

Employee opens Pending Reservations.

Employee approves booking.

Reservation becomes Confirmed.

Customer arrives.

Ali performs the service.

Employee registers completed haircut.

Employee records payment.

Reservation becomes Completed.

Manager analytics update.

EXAMPLE 2 — WALK-IN

Customer enters the barbershop.

No reservation exists.

Employee opens Register Walk-In.

Employee enters customer name.

Employee chooses barber Jad.

Employee selects Haircut.

System loads official fixed price.

Employee may apply a discount.

Employee records payment.

System creates visit and payment records.

Manager dashboard updates.

EXAMPLE 3 — BARBER CHANGE

Customer booked Ali.

Ali becomes unavailable.

Employee changes assigned barber to Jad.

Backend checks Jad's availability.

If available, reassignment succeeds.

If unavailable, system rejects the change
and provides a useful message.

The reservation retains change history.

EXAMPLE 4 — CASH CLOSING

At the end of the shift:

Employee opens Cash Closing.

System calculates expected cash.

Employee enters actual cash amount.

System calculates difference.

Manager reviews the closing.

============================================================
46. PERFORMANCE AND RESPONSIVENESS
============================================================

The public website must remain fast
despite database integration.

Avoid moving all public rendering into
unnecessary client-side components.

Use caching where safe.

Never cache sensitive user data publicly.

Operational dashboards should:

- Use pagination
- Avoid fetching entire financial history
- Filter queries server-side
- Use appropriate indexes
- Handle loading and error states

Target good Core Web Vitals.

Do not introduce heavy animation
into everyday employee forms.

Avoid unnecessary rerenders.

Test mobile calendar overflow.

Support the expected initial scale
of approximately 50 bookings per day.

============================================================
47. BACKUP AND RECOVERY
============================================================

Create a practical backup strategy.

Include:

- Database backup instructions
- Exportable SQL/data backup
- Migration files
- Restore instructions
- Critical data verification

Protect:

- Reservations
- Service records
- Payments
- Payroll
- CMS content

Document free-tier platform limitations.

Do not claim automatic backups exist
unless configured and verified.

Test restoration when possible.

Never store backup files in a publicly
accessible repository.

============================================================
48. AUTOMATED TESTING
============================================================

Write and execute tests for critical workflows.

AUTHENTICATION:

- Manager login
- Shared Employee login
- Unauthorized access rejection

RESERVATIONS:

- Public pending reservation
- Employee approval
- Manager approval
- Conflicting booking rejection
- Concurrent booking attempts
- Multiple barbers at same time
- Multiple services in one reservation
- Any available barber assignment
- 3-hour cancellation rule
- Pending expiration
- Barber reassignment
- Chair assignment conflicts

EMPLOYEE OPERATIONS:

- Walk-in registration
- Fixed service prices
- Discount application
- Tip recording
- Multiple services
- Correct barber attribution
- Recorded-by staff selection

PAYMENTS:

- Paid
- Partially paid
- Unpaid
- Partial payment completion
- Refund
- Duplicate payment prevention
- Cash closing reconciliation
- Separate currency reporting

PAYROLL:

- Fixed salary
- Commission
- Salary plus commission
- Monthly finalization
- Refund adjustment
- Unauthorized access rejection

CMS:

- Edit hero
- Edit services
- Upload media
- Publish content
- Language switching
- Arabic RTL layout

CALENDAR:

- Month view
- Week view
- Day view
- Barber filter
- All-barbers salon view

SECURITY:

- Anonymous user cannot read customer contacts
- Employee cannot read payroll
- Employee cannot modify global prices
- Employee cannot alter financial history
- Employee cannot edit CMS
- Public booking endpoint resists abuse
- Privileged secrets never appear in client bundle

============================================================
49. IMPLEMENTATION PHASES
============================================================

Complete the project incrementally.

Do not attempt to generate every feature
as one giant untested code change.

PHASE 1 — PROJECT AUDIT

Inspect existing code.

Identify architecture and compatibility.

Document what can be reused.

PHASE 2 — DATABASE FOUNDATION

Create database schema and migrations.

Implement relationships and constraints.

PHASE 3 — AUTHENTICATION AND AUTHORIZATION

Create Manager and Employee access.

Implement backend permission enforcement.

PHASE 4 — STAFF, CHAIRS, AND SERVICES

Build management CRUD.

Configure schedules and pricing.

PHASE 5 — RESERVATION ENGINE

Implement availability calculations,
transaction-safe booking, approvals,
and cancellation rules.

PHASE 6 — PUBLIC BOOKING

Connect the existing website to the
real reservation engine.

PHASE 7 — EMPLOYEE PORTAL

Create calendar, approvals,
walk-in registration, haircut recording,
and payment collection.

PHASE 8 — MANAGER DASHBOARD

Create operational analytics,
reservations, and employee performance reporting.

PHASE 9 — FINANCIAL MANAGEMENT

Implement financial reports, tips,
refunds, cash closing, and reconciliation.

PHASE 10 — PAYROLL

Implement compensation models,
commissions, and monthly payroll.

PHASE 11 — WEBSITE CMS

Connect public content to managed database content.

Support media uploads and immediate publishing.

PHASE 12 — INTERNATIONALIZATION

Implement English, French, and Arabic RTL
for the public website and booking flow.

PHASE 13 — SECURITY AND TESTING

Run automated tests.

Test authorization.

Test race conditions.

Test financial accuracy.

PHASE 14 — DEPLOYMENT AND DOCUMENTATION

Prepare free-tier deployment.

Document environment variables,
database setup, backup, and configuration.

At the end of each phase:

- Implement actual code
- Validate functionality
- Fix failures
- Report what was tested
- Identify external configuration requirements

Maintain a progress checklist in the repository.

Continue with the next phase when feasible.

============================================================
50. FINAL ACCEPTANCE CRITERIA
============================================================

The system is complete only when:

[ ] Existing cinematic website remains functional.
[ ] Public booking is database-connected.
[ ] Customers can select multiple services.
[ ] Customers can select a specific barber.
[ ] Customers can choose any available barber.
[ ] Real available times are displayed.
[ ] Public requests require approval.
[ ] Employee can approve reservations.
[ ] Manager can manage reservations.
[ ] Booking conflicts are prevented.
[ ] Customer can cancel at least 3 hours early.
[ ] Shared Employee login works.
[ ] Multiple employees can use shared sessions.
[ ] Employee can select performing barber.
[ ] Employee can select recording staff member.
[ ] Walk-in registration works.
[ ] Fixed prices are enforced.
[ ] Discounts work.
[ ] Tips are recorded separately.
[ ] Cash and noncash payments work.
[ ] Partial payments work.
[ ] Monthly payroll works.
[ ] Commissions are calculated correctly.
[ ] Financial history is preserved.
[ ] Manager analytics use real data.
[ ] Barber performance reports work.
[ ] Calendar supports month/week/day.
[ ] Salon-style barber columns work.
[ ] Chair tracking works.
[ ] CMS edits appear on public website.
[ ] Arabic RTL works.
[ ] English works.
[ ] French works.
[ ] Exports work.
[ ] Backup documentation exists.
[ ] Security policies are tested.
[ ] Production build succeeds.
[ ] No paid premium UI dependency is required.

============================================================
51. FINAL ENGINEERING RULES
============================================================

DO NOT:

- Rebuild the existing website from scratch.
- Remove established cinematic design.
- Create individual barber accounts.
- Create customer accounts.
- Add customer profile management.
- Introduce employee-authored customer notes.
- Allow employees to change official service prices.
- Allow employees to access salaries.
- Allow employees to erase payment history.
- Count pending reservations as revenue.
- Fabricate financial statistics.
- Use paid calendar resource views.
- Expose privileged Supabase keys in the browser.
- Implement fake authentication.
- Implement fake booking confirmations.
- Skip server-side booking validation.
- Pretend unexecuted tests passed.
- Implement unrelated future modules.
- Replace the existing framework unnecessarily.

DO:

- Preserve existing work.
- Build a genuine database-backed application.
- Use secure authentication and authorization.
- Keep shared-account limitations explicit.
- Enforce booking conflicts transactionally.
- Keep prices fixed and discounts separate.
- Support multiple services per visit.
- Track actual payments.
- Calculate payroll correctly.
- Support USD and LBP separately.
- Build real Manager analytics.
- Build an efficient Employee portal.
- Implement a professional CMS.
- Support multilingual public booking.
- Implement tests.
- Document deployment and backup limitations.

============================================================
52. START IMPLEMENTATION
============================================================

Begin immediately by inspecting the current repository.

First output:

1. Existing architecture summary
2. Components that will be preserved
3. Required new modules
4. Database design outline
5. Implementation sequence
6. External configuration requirements

Then implement the project in the existing codebase.

Do not stop after the analysis.

Do not generate mockups instead of real application code.

Proceed incrementally through the implementation phases.

When credentials or external account setup are required,
implement the code and provide exact setup steps.

Never fabricate credentials.

Never claim production deployment succeeded
without a real successful deployment.

The final application must be a complete,
secure, database-connected barbershop operations
and management platform built upon the current
premium website.

START BY AUDITING THE EXISTING PROJECT.
diness.

## How to read this document

- **Owner direction** preserves what you explicitly decided. New details within those answers remain proposed unless expressly confirmed.
- **Proposed answer/default** gives a concrete recommended decision where you have not answered. It is ready for review, not silently approved.
- **Domain input required** identifies real facts or official rules that cannot be invented: church identities/names, contacts, actual schedules, approved templates, clergy requirements, retention periods, fees and operating volumes. A design answer is supplied even when those facts remain to be populated.
- Your latest correction takes precedence over an older draft. In particular, one combined home and a combined parish view replace the previous separate-personal-home proposal. S03.07 was previously blank; its answer here is a new proposal.
- All existing modules remain in scope. Individual roles see only authorized functions. A missing integration stays visibly unavailable or uses an approved manual process until actual delivery exists.

### Confirmed foundations

1. Start with Beirut Archdiocese, Saint Abda and Foucas Church, and Saint Georges Church; support later expansion across Lebanon.
2. Initially use two separate developer Super Admin accounts, a bishop, an Archdiocese Admin, and assigned parish priests; optional staff are appointed within scope. One head priest is designated per parish.
3. Calendar, reservations and ministry management are primary usability priorities. Keep all existing modules.
4. A secretary is optional. Eligible priests/admins can perform office work without creating a fictitious secretary.
5. English, French and Arabic must be complete at launch; staff primarily use laptops/web.
6. One role opens its dashboard directly; several working roles require role choice. Provide one combined home and combined authorized parish information.
7. Priest, Parish Admin and secretary can prepare sacramental paperwork. The priest decides. A secretary can record a specific priest approval already given outside the system using their own account, with both identities recorded and priest-side visibility. It takes effect without a second online approval.
8. Printed sacramental paperwork shows the priest's name; secretary recording attribution remains inside the system. Signature application is a separate permission.
9. A combined home/view does not expose other people's private information or merge authority between parishes. Role loss removes old access.
10. Developers own product/release decisions; priests, bishop, finance and language reviewers validate their corresponding domain rules.

### Common proposed defaults used consistently below

| Topic | Proposed default |
| --- | --- |
| Confidentiality | Scope and case access apply to pages, badges, search, notifications, print and export; rank alone is not unrestricted content access. |
| Three-language content | Interface, public/reusable content and official templates support EN/FR/AR. Private free text retains its original; reviewed translation is separate. Confirm this interpretation of user content. |
| Scheduling | Display parish-local time using the parish's configured zone, including daylight-saving changes; identify overseas equivalents separately. |
| External services | No simulated OAuth, verification, payment, scheduled reminder or delivered message. Launch-required services are release dependencies until actually connected. |
| Money | Preserve actual USD/LBP amounts separately, historical transaction rates and dated corrections; never silently recompute historic transactions at today's rate. |
| Deletion | Archive/close record-bearing organizations and retain official history; permanent deletion has a reviewed, record-specific policy. |
| Approvals | Preparation, acceptance, official-entry approval, signature, issuance, release and collection are different actions. No hidden bypass of prerequisites. |
| Work queues | One linked case has one canonical identity and a consistent next action; intake-to-office conversion does not duplicate counts. |
| Drafts and conflicts | Preserve permitted user work, identify failures clearly, and compare stale edits rather than silently overwriting newer records. |
| Unapproved facts | No invented fees, legal retention durations, ecclesiastical requirements, coordinates, contacts, performance results or national user counts. |

## Contents

- [S01 — Purpose, release scope and decision owners](#s01)
- [S02 — Organizational structure, roles and authority](#s02)
- [S03 — Navigation, dashboard, search and work queues](#s03)
- [S04 — Public directory, parish pages and visitor discovery](#s04)
- [S05 — Website content, announcements and publishing](#s05)
- [S06 — Sign-up, sign-in, invitations and recovery](#s06)
- [S07 — Following, parish membership and profile corrections](#s07)
- [S08 — People records and individual profiles](#s08)
- [S09 — Households, family relationships and representation](#s09)
- [S10 — Import, duplicate review, archive and historical records](#s10)
- [S11 — Request intake, office queues and guest tracking](#s11)
- [S12 — Sacramental lifecycle and official register approval](#s12)
- [S13 — Details and exceptions for each sacrament and service](#s13)
- [S14 — Certificates, bishop review and collection](#s14)
- [S15 — Documents, evidence, attachments and file release](#s15)
- [S16 — Calendar, Mass times, clergy schedules and anniversaries](#s16)
- [S17 — Service/activity planning and music library](#s17)
- [S18 — Ministries, leadership and membership applications](#s18)
- [S19 — Meetings, attendance, formation and group resources](#s19)
- [S20 — Volunteers, commitments, rota and hours](#s20)
- [S21 — Event registrations, consent, transport, fees and refunds](#s21)
- [S22 — Check-in, child pickup, incidents and emergency rosters](#s22)
- [S23 — Facilities, reservations, equipment, maintenance and renters](#s23)
- [S24 — Giving, envelopes, counting, pledges and receipts](#s24)
- [S25 — Finance, approvals, reconciliation and Office Expenses](#s25)
- [S26 — Inbox, staff messaging, notices, prayers and notifications](#s26)
- [S27 — Concerns, complaints, reviewer independence and privacy](#s27)
- [S28 — Private notes, pastoral tasks and forms/workflows](#s28)
- [S29 — Administration, bundles, oversight, reports and settings](#s29)
- [S30 — Visual design, English/Arabic, accessibility and mobile use](#s30)
- [S31 — Saving, drafts, connection loss, concurrency and recovery](#s31)
- [S32 — Retention, support, onboarding and design acceptance](#s32)

---

## S01

**Purpose, release scope and decision owners**

### S01.01

**Question:** What is the first operating scope: one parish, one archdiocese with several parishes, or several independent dioceses? Name the intended first setting.

**Owner direction:** Launch with Beirut Archdiocese and the following two parishes:

1. Saint Abda and Foucas Church.
2. Saint Georges Church.

There will initially be two individual Super Admin accounts for the developers, a bishop account, an Archdiocese Admin account for the administrator working with the bishop, and an assigned priest for each parish. Additional parish roles are appointed under the parish priest's authority. The two developers are the two Super Admins; the bishop, diocesan administrator and parish priests are separate roles and do not automatically become Super Admins.

**Proposed completion:** The two-parish rollout uses the same structure intended for national expansion. Additional dioceses, parishes, staff and members are added through controlled onboarding without redesigning account identities or weakening parish boundaries. A bishop and Archdiocese Admin operate within their assigned diocese. Parish roles operate only in explicitly assigned parishes; ministry leaders operate only in their assigned ministries. A person can hold different roles in different places through one account.

Each parish has one designated head priest for accountability, with additional priests allowed. The initial count of two Super Admins is an operating decision, not a permanent application-wide maximum.

**Input required:** The exact official identity/jurisdiction and approved English, French and Arabic names for the archdiocese and both churches, including towns/locations. Similar church names must not be treated as the same parish merely because their display names match.

### S01.02

**Question:** Which three problems must the first release solve well enough that parishes will use it regularly?

**Owner direction:** Calendar, reservations and ministry management are the three primary priorities.

**Refined answer:**

1. **Calendar:** Give the priest and office one reliable view of parish activities, relevant clergy duties and resource availability. Define which events are public, member/group-only or office-only. Changes should remain consistent across calendar, service plans, ministry meetings, registrations and bookings where those items are linked.
2. **Reservations:** Let authorized users request available facilities, let the office prepare/review requests, and let the correct authority decide. Show actual availability, setup/cleanup time, maintenance conflicts, current status and the next responsible person. A request must never look confirmed merely because it was submitted.
3. **Ministry management:** Give each ministry accurate leadership, membership, meetings, attendance, resources and commitments, with an understandable application and departure process. Leaders must receive the information relevant to their ministry without receiving unrelated parish or private records.

**Proposed completion:** These are usability and validation priorities, not permission to remove the other modules. Success is demonstrated through completed, consistent workflows rather than feature counts or sample dashboard figures. Exact booking-hold and conflict-resolution policies remain for S23; this answer does not silently choose automatic refusal or timed holds.

### S01.03

**Question:** Who is the primary daily user, and what are that person's five most frequent tasks today?

**Owner direction:** The parish priest and secretary are the main daily users. A secretary is optional.

**Refined answer:** The priest's five main daily task groups are:

1. Review incoming requests and forms, see missing information and identify items requiring his own decision.
2. Accept, return, decline or approve matters within his authority, including sacramental decisions.
3. Review parish calendar, reservations and upcoming clergy responsibilities.
4. Oversee ministries, staff assignments, events and unresolved operational issues.
5. Review parish summaries, delegated actions, secretary-recorded priest approvals and work requiring follow-up.

The secretary's five main daily task groups are:

1. Maintain calendar information and prepare activity schedules.
2. Receive/review reservation requests, check information and prepare decisions for the appropriate authority.
3. Handle event forms, registrations, documents and applicant follow-up.
4. Support ministry records, meeting schedules and permitted member/contact administration.
5. Receive requests, prepare sacramental paperwork and record a priest's already-given approval on his behalf under the agreed rule.

**Proposed completion:** The combined home, adapted to the selected role, should distinguish **Needs my decision**, **Needs preparation**, **Waiting for information**, **Upcoming** and **Recorded on my behalf**. Those labels should link to actual work. The absence of a secretary must not leave a parish unable to operate.

### S01.04

**Question:** Which other users must be served at launch, and how often will each use the system?

**Owner direction:** Super Admins, bishop, Archdiocese Admin and priests will use the system regularly. Secretaries are optional. Normal users and the remaining existing roles remain part of the product.

**Proposed completion:** All existing role experiences are within launch scope, with different patterns of use:

| Audience | Intended use |
| --- | --- |
| Super Admins | Regular platform/organization administration, access support, rollout oversight and exceptions requiring platform authority |
| Bishop | Regular diocesan oversight, parish and clergy appointments, diocesan decisions and escalations |
| Archdiocese Admin | Regular diocesan operational coordination and authorized office/administrative support |
| Head/other assigned priests | Daily parish operations and priest decisions within their assignments |
| Parish Admin | Daily or frequent office and staff coordination where appointed |
| Secretary | Daily office work where appointed |
| Treasurer/finance viewer | Finance operations/review according to actual duties; daily, weekly or periodic rather than an assumed constant session |
| Ministry leader | Frequent ministry coordination, with heavier use around meetings/events |
| Normal user/member | Personal parish activity, requests, membership, commitments, messages and permitted records as needed |
| Guest | Public browsing and request/tracking use without an account |
| Selected concern reviewer | Case-specific work independent of ordinary rank |

No parish is required to appoint every optional role. Frequency describes the intended design, not a promise that every person is always online or available for immediate approval.

### S01.05

**Question:** For every module in the project-review inventory, choose first release, later, or remove. Which existing modules are essential to keep exactly as they operate now?

**Owner direction:** All existing modules stay in scope.

**Refined answer:** Retain public directory/parish pages, account/member portal, administration and oversight, people and households, requests, sacramental preparation/records/certificates, calendar, Services & Activities, ministries, volunteers, registrations/payments, check-in/pickup/incidents, facilities/reservations/equipment, giving/Finance/Office Expenses, messaging/notices/resources/prayers, music, notes/tasks, forms/workflows, reports, audit, settings and bundle management.

**Proposed completion:** Retention does not mean every current implementation or screen promise is approved unchanged. Each module must follow the agreed role, language, privacy and workflow rules. All modules remain in the product and release design inventory; changes in release availability require an explicit recorded decision rather than silent omission.

An external provider, payment mechanism, scheduled runner, map or verification service must only be presented as operational when it actually exists and is configured. Retaining its module does not justify displaying a fabricated successful payment, verification, delivery or reminder. Where an integration is required for launch, resolving it is a launch dependency; where a manual procedure is accepted, the UI must clearly describe that procedure. Feature availability must not be mistaken for record-access permission.

### S01.06

**Question:** Which real procedures must remain on paper or happen in person, even when the system records their progress?

**Owner direction:** Sacramental processes currently retain paper/in-person steps.

**Refined answer:** ParishLife coordinates requests, preparation, documents, dates, priest decisions and status history while preserving the actual paper and in-person requirements approved by the parish/diocese. Online submission is not the celebration of a sacrament, verification of an original document or application of a priest's signature.

**Proposed completion:** Each sacramental workflow identifies which steps can be completed online and which require office attendance, original documents, a paper register, signature/seal or collection. The system records who checked or received an item and when, distinguishing **Uploaded**, **Paper received** and **Verified**.

A priest may give an instruction outside the application; a secretary may record that approval under S02.07. The instruction/decision date, if known, is separate from the actual time the secretary entered it. Recording historical facts must not falsify the activity timestamps. If the physical procedure and the entered record disagree, the record is flagged for authorized review rather than silently advanced.

**Input required:** Which originals, registers, signatures/seals and collection steps each supported sacrament/certificate actually requires. The answers belong with the priest and bishop; none are inferred from the existence of a form.

### S01.07

**Question:** Which church rites, ecclesiastical structures and sacramental practices must launch support? Which visible options should be excluded?

**Owner response:** “Irrelevant question.”

**Proposed replacement:** National expansion must not be designed around the assumption that every organization has identical rites, terminology, preparation requirements, calendars and certificate wording. The first rollout uses the practices approved by its actual ecclesiastical authority. The system should allow additional organizations to adopt approved configurations without imposing one parish's procedure nationwide.

At launch, users should see only the rites and document/workflow options that are genuinely supported and approved for their organization. Unsupported options must not appear as usable choices. Parish names, location in Beirut or current sample data are insufficient evidence for selecting a rite.

This is a scope and configuration requirement, not an instruction to invent doctrine or implement every rite immediately. It also prevents existing unsupported selectors from creating false expectations.

**Input required:** Confirm the first archdiocese's exact jurisdiction, rite and approving authority. Until that is known, this question remains open rather than being marked not applicable.

### S01.08

**Question:** Where and on what devices will people work: parish-office computers, shared desktops, personal phones, tablets at events, or elsewhere?

**Owner direction:** Primarily a web application used on laptops.

**Proposed completion:** Optimize daily staff work for laptops/desktops using tables, efficient filters, clear detail pages and deliberate approval actions. The essential public/member journeys must still work on common phone sizes; staff may need basic access away from the office. Event check-in should remain usable on a tablet or laptop.

The design must handle Arabic direction, enlarged text, keyboard operation and long forms without hiding mandatory information or trapping actions outside the viewport. A smaller screen must not remove essential status/authority information. A public request must be usable without a hover-only control or desktop-only upload interaction.

Shared computers use individual accounts, clear active user/parish/workspace indicators and reliable sign-out. Network interruptions must produce visible pending/failed-save states. Offline operation is not implied by being web-based and must be specified separately in S31. No native mobile application is required by this answer.

### S01.09

**Question:** What languages must be complete at launch for the interface, user content and official documents separately?

**Owner direction:** English, French and Arabic must be complete at launch for the interface, user content and official documents.

**Refined answer:** All navigation, forms, instructions, status labels, validation, errors, notifications, confirmations, help, print controls and official document templates must support the three languages. Arabic requires full right-to-left behavior, including mixed-direction names, numbers, phones, references and currency values. Each account chooses its interface language without changing the data or language of other users.

Public and reusable translatable content must support English/French/Arabic fields with an editor showing readiness by language. Published public pages, standard event/form descriptions, reusable notices and standard communication templates must have reviewed versions in all required languages before being represented as fully trilingual.

**Proposed clarification:** Personal names and private user-entered messages, evidence and confidential notes retain their original wording. They should not require an ordinary sender to produce three translations before saving or submitting. Where a translation is needed, preserve the original and identify the translation/reviewer. Unreviewed translation must not silently become official wording. This interpretation of “user content in three languages” needs confirmation; requiring every private note/message in three languages is a materially different workflow.

Official documents must be available in approved English, French and Arabic versions; a combined trilingual sheet is offered only where its layout and wording are approved. Available-in-three-languages does not by itself require three copies or all three languages on every page. Missing translations block the relevant final publication/official output rather than being hidden by an unexplained fallback.

### S01.10

**Question:** Who has final authority to approve product design, parish-office workflow, clergy rules, financial controls and sensitive-data access? Assign each area an owner.

**Owner direction:** Developers/Super Admins approve product design; parish priests own office workflows; the bishop owns clergy rules; priest and finance person own financial controls; Super Admins and the parish priest oversee sensitive-data access.

**Proposed completion:**

| Area | Accountable owner and validation |
| --- | --- |
| Product structure, shared UX, technical behavior and release | Developer/product owners acting as Super Admins |
| Parish office workflows and local operational choices | Head parish priest, with the staff who perform the work validating usability |
| Clergy appointments, ecclesiastical authority, sacramental policy and official document wording | Relevant bishop/competent ecclesiastical authority; priest implements within that policy |
| Financial controls and local operating rules | Head priest and designated treasurer/finance lead; diocesan rules apply where established |
| Sensitive-access policy and permission enforcement | Super Admins govern platform controls; priests govern permitted parish access within agreed privacy/case rules |
| Language quality and translated ecclesiastical wording | Named English/French/Arabic reviewers; ecclesiastical reviewer for official content |

Policy governance and the right to read a private record are different permissions. Proposed default: technical rank or priestly seniority does not automatically reveal personal notes, private conversations or independent concern cases. Case-specific restrictions and conflicts still apply. A Super Admin may administer an organization without browsing all its sensitive contents. Any exceptional access needs a defined purpose, permitted scope and audit.

Local configuration cannot override the common identity, attribution, scope and audit rules. If a local operational preference conflicts with a diocesan clergy rule, route it to the bishop; if a privacy exception affects platform-wide protection, route it to the designated policy owners. “The developers approve design” does not mean developers decide ecclesiastical facts.

### S01.11

**Question:** What operating scale must the design accommodate: parishes, people per parish, staff, active requests, simultaneous event check-ins and historic records?

**Owner response:** “All stated.” This confirms the dimensions that matter, but supplies no quantities beyond the initial organizational scope.

**Refined answer:** The product must support multiple independent dioceses, multiple parishes per diocese, one account with several scoped memberships/appointments, large people/household directories, historical registers, parallel office work and event-day peaks. No screen or permission rule should assume there will always be only two parishes or one priest/secretary.

**Proposed design requirements:** Use understandable parish/diocese selection, search, paginated collections, date/type/status filters, resumable administrative work, controlled bulk review/export, and summaries that explain their actual scope. Handle repeated names and localities without confusing records. Dashboards must not require reading an entire nation's individual records to show an appropriate scoped summary.

**Input required before capacity sign-off:**

| Measure | Known or required input |
| --- | --- |
| Initial dioceses / parishes / Super Admins | 1 / 2 / 2 |
| Initial priests and staff | At least an assigned priest per parish; actual additional staff count required |
| Initial people / households per parish | Required from each parish |
| Ministry count / largest roster | Required from each parish |
| Historical records and years to import | Required from each parish |
| Requests, reservations and messages in a normal/peak period | Required from offices |
| Peak simultaneous staff/member sessions and event check-ins | Required planning estimate |
| Attachments per record, typical size and historical total | Required planning estimate |
| National expansion horizon and expected participating organizations | Required from product owners |

No national volume or performance result is invented here. Numerical targets and representative large-data prototype cases must be agreed before claiming capacity validation. Qualitative readiness for growth is distinct from tested national deployment capacity.

### S01.12

**Question:** What concrete outcomes will establish that the UI/UX is ready for implementation, and which representative users will validate them?

**Owner direction:** The developers validate the result and make the release decision.

**Proposed completion:** Developer approval is based on a complete design pack containing:

1. Release/module inventory and each module's configured/unavailable states.
2. Role, organization and workspace navigation for all retained roles.
3. Record/action permission matrix, including confidential access and on-behalf approvals.
4. Workflow states, responsible roles, transitions, prerequisites and exceptions.
5. Field dictionaries and reviewed English/French/Arabic wording.
6. Annotated pages, drawers/dialogs, tables, mobile layouts and all loading/error/empty/conflict states.
7. Official document/print/export layouts and approval/release rules.
8. Notification and action-history rules.
9. A clickable prototype covering normal work, refusal, cancellation, correction, changed access and interrupted work.
10. Validation findings, resolutions and any explicitly accepted remaining limitations.

Priests, secretaries where available, bishop/diocesan staff, finance and ministry users validate the tasks they actually perform. Developers keep final product/design sign-off; domain owners confirm their rules and official wording so technical review does not substitute for operational validation.

The first two parishes should both participate, including a complete no-secretary scenario. No unresolved authority, sacramental attribution, confidential visibility, financial-state or essential-language contradiction should be labeled approved. The full S01–S32 draft below supplies proposed detailed answers; implementation handoff still requires approval of those choices and validation of the corresponding UI.

## S02

**Organizational structure, roles and authority**

### S02.01

**Question:** Are those role names and their English/Arabic labels correct for your actual organization? Define any missing role by its duties rather than its title alone.

**Owner direction:** Existing role names are correct. Include the normal user with one account linked to one or more parishes.

**Proposed completion:** Distinguish account identity, parish person record, parish membership, ministry membership, clergy office and operational appointment. A person's presence in a parish directory or group roster does not automatically create a staff role.

| Role or relationship | Intended responsibility and boundary |
| --- | --- |
| Super Admin | Platform and organization administration across the system; not automatic clergy decision/signature authority or unrestricted confidential content access |
| Bishop | Ecclesiastical oversight, clergy authority and authorized administrative actions within appointed diocesan scope |
| Archdiocese Admin | Diocesan operational/administrative work and explicitly delegated duties; no inherited priest/bishop decisions |
| Head parish priest | Parish accountability, local appointments and priest decisions within the parish |
| Other assigned parish priest | Same kind of priest capabilities within an authorized assignment; head-priest accountability remains separately identified |
| Parish Admin | Parish office administration, permitted staff management, preparation and assigned operational duties |
| Secretary | Parish office intake, records/preparation, scheduling and allowed operational actions; may record prior priest approval under S02.07 |
| Treasurer | Finance operations according to the agreed financial controls |
| Finance viewer | Permitted finance viewing/reporting/export; no transaction editing or approval merely from that role |
| Ministry leader | Management of explicitly assigned ministries, not the whole parish or other ministries |
| Normal user/member | Their own account, separately approved parish links, personal requests and permitted community activity |
| Guest | Public information and allowed request/tracking functions without a staff account |
| Selected reviewer/delegate | Exact case or capability assigned through a separate scoped authorization; not a blanket new rank |

Head priest is a designation on a priest's parish appointment, not a second identity or a Super Admin role. Preferred public role names and the corresponding Arabic/French translations need approval, but national support must not depend on English-only labels.

### S02.02

**Question:** Who establishes a diocese and appoints its first bishop in the intended onboarding process? The current appointment policy does not expose bishop appointment as an ordinary assign-access option.

**Owner direction:** A Super Admin establishes the first diocese and appoints the first bishop. The first account is a Super Admin account from which the system is initialized.

**Proposed completion:**

1. Establish the first developer's individual Super Admin account through a controlled initial setup. Public signup must never offer self-selection of Super Admin or bishop.
2. Establish the second developer's separately controlled Super Admin account. Do not share one developer login between two people.
3. Create the actual archdiocese with approved names, jurisdiction, responsible contacts and initial operating settings.
4. Link/appoint the verified bishop account to that archdiocese, with an effective start date and clear scope. This records a real ecclesiastical appointment; the software does not confer religious office by itself.
5. The bishop appoints the Archdiocese Admin and establishes parish/priest appointments within his authority.
6. Onboard and activate the two participating parishes under S02.03.

Repeatable organization onboarding must work for additional dioceses. Existing accounts are reused where identity is already established; another diocese does not require a duplicate login for the same individual. Each appointment is separately scoped and historical appointments are retained.

The initial Super Admin dashboard must work before a diocese or parish exists. It shows initialization tasks and account/organization controls rather than empty parish forms that cannot operate. Initial setup, additional privileged appointments and recovery must be attributable; a fixed publicly known privileged password or hidden untracked promotion is not an acceptable setup experience.

### S02.03

**Question:** What information and approvals are required to create a parish, and when should it become publicly visible and operational?

**Owner direction:** The bishop initially creates/approves a parish using its name, assigned priest. The parish becomes public and operational when created. Deactivation/deletion controls are desired.

**Proposed completion:** Creation should collect the information necessary to identify and operate the parish: official English/French/Arabic names, diocese, locality/address, approved jurisdiction/rite, designated head priest and effective appointment, parish office contact, adoption confirmation by the authorized parish representative, and public-profile language readiness. Optional secretaries can be added now or later. Personal staff contacts must not silently become public office contacts.

The bishop owns ecclesiastical approval for parish participation and priest appointment. An Archdiocese Admin may prepare/create the organization only when explicitly authorized by the bishop; a Super Admin may assist with platform setup while recording the relevant authority. Neither role silently substitutes its technical rank for the bishop's decision.

Preserve **immediate activation on valid creation**: once the required information, adoption and appointments are confirmed, **Create and activate parish** makes it usable and publishes its approved public profile in one final action. No additional hidden waiting period is introduced. Incomplete preparation may be saved as a private setup draft; that is not yet an active/public parish. Activation itself should not require filling every optional website section or importing every historical record. Continue Parish Profile setup should be available.

Recommended lifecycle actions:

- **Deactivate temporarily:** Stop new public submissions and ordinary new operational work; show a clear status/contact fallback. Preserve historical records and authorized tracking/read access. Resolve or explicitly hand over in-flight workflows; do not silently approve or cancel them.
- **Reactivate:** Require the relevant organizational authority, reason and review of appointments, public information and outstanding work. A lower authority cannot override a higher authority's suspension.
- **Close/archive permanently:** Preserve the parish's historical identity, official records, financial history and audit. Identify any successor/custodian where applicable. This is different from deleting it.
- **Delete unused setup:** Restrict deletion to reviewed unused drafts/test/duplicate setups after demonstrating that no operational or official records depend on them. For an active parish with records, offer closure/archive rather than a destructive cascade.

Bishop/authorized diocesan staff manage diocesan parish status within scope. System-wide intervention belongs to Super Admins, with a reason and audit. Proposed deletion restrictions require approval because the owner requested deletion but did not define what it may destroy.

### S02.04

**Question:** Can a parish have multiple priests, secretaries, treasurers and administrators, and does each group need a designated lead?

**Owner direction:** A parish may have several priests, secretaries, treasurers and administrators. A designated lead is necessary. One priest is the head of the parish even when other priests have comparable operational capabilities.

**Proposed completion:** Each parish has exactly one current designated head priest, except for an explicitly recorded vacancy/interim arrangement. The bishop appoints/changes that designation. Other priests can perform the priest duties authorized for their parish appointment; the head priest retains overall accountability and the right to set the permitted local work allocation.

Where more than one secretary, administrator or treasurer is appointed, identify an operational lead for that team when needed. Leadership makes ownership/escalation clear; it does not automatically grant an additional financial approval or access to confidential cases.

Each workflow shows its preparing person/team, current action owner and final authority. The head priest can assign routine priest reviews to another qualified, assigned priest where policy allows. The head-priest designation should not force every ordinary task to wait for the same individual when another priest is authorized to decide it. If a specific class of decision must always return to the head priest, name it explicitly in the workflow.

Lead changes have effective dates and a visible handover list. Former leads retain their authorship/history but lose current authority when their appointment ends. A second head designation cannot silently coexist with the first.

### S02.05

**Question:** When one account has several roles in one parish, should permissions combine automatically, or should the user explicitly enter a role/workspace?

**Owner direction, updated by S03:** One available working role opens the dashboard directly; several roles require deliberate choice. Use one combined home and a combined view of permitted parish information. Do not add a separate personal/work-home switch or automatically enter a remembered privileged role.

The account keeps its valid appointments. Its selected role determines the acting capacity and relevant tools, with its own permitted personal/community information available in the same home. Switching roles does not require another login. A member identity alone should not force a second selection for someone with only one working role.

**Proposed completion:** Show the parish of every operational item. A combined overview can include public activity from followed parishes and permitted records from memberships/appointments, but an action always targets one authorized parish and stage. If another role is necessary, offer an explicit role change. Restrictive case access and independent-approval rules still apply across role changes; the same person cannot become their own second approver by switching capacity.

Before changing role with unsaved work, offer Save draft, Discard or Stay where applicable. Remove prior-role access as soon as an appointment is revoked or expires.

### S02.06

**Question:** When roles differ between parishes, what must the header and action confirmations show to make the active authority unmistakable?

**Owner direction:** Show the person's role in the active parish.

**Proposed completion:** The persistent header identifies the signed-in account, active diocese/parish, active workspace/role and any temporary delegated capacity. The account page lists all appointments, their scopes, lead designation, dates and status. Another parish's role must not look active here.

Before an important approval, release, appointment or organizational change, the confirmation identifies the record/person, target organization and acting capacity. For example: **Saint Georges Church — Secretary — Record approval on behalf of Fr. [Name]**. A system- or diocese-level administrator must see **System** or the relevant diocese as the management scope, not a parish label that disguises a wider action. **Owner clarification:** Printed sacramental paperwork shows the responsible priest's name. The secretary's recording action appears only in the authorized internal history, not as the approving name on the printed document. This does not itself grant permission to apply an electronic or scanned signature.

Links and notifications open in the correct permitted context, with a clear context-change notice where needed. Each tab/draft keeps its own record/organization context; switching parish in another tab must not redirect a pending save into the wrong parish. Historical entries identify the scope and capacity at the time of action even after appointments change.

### S02.07

**Question:** Approve a matrix for viewing, creating, editing, approving, signing, releasing, exporting and archiving each record type. Where must administrative authority stop short of clergy authority?

**Owner direction:** Priest, Parish Admin and secretary can prepare sacramental paperwork. The priest decides acceptance/approval. The secretary may record the priest's prior approval given outside the system; it takes effect without waiting for the priest to log in and must be logged and visible to him. This preserves decision D005.

**Sacramental workflow rules:**

1. Assigned priests, Parish Admins and secretaries can enter/precheck request information, collect supporting documents and prepare paperwork within their permitted parish scope. Draft preparation does not itself establish sacramental acceptance or an approved register entry.
2. A qualified, assigned priest makes the relevant ecclesiastical decision and may enter it directly.
3. A secretary acting on a specific priest's already-given instruction can use **Record priest's approval** for the authorized decision on that case. No prior digital instruction/delegation or repeat online approval is required to make this offline instruction usable.
4. The secretary uses their own account and selects the authorizing priest from eligible appointments. Record the case, exact decision/stage, secretary, priest, actual entry timestamp and brief instruction note. Capture when/how the instruction was received where known; never invent a date or rewrite entry history to make it look like the priest clicked.
5. Require an explicit statement such as **The named priest has already instructed me to record this decision for this request.** This confirms an actual case instruction, not an independent secretary decision or open-ended permission to approve all cases.
6. History states **Approved on behalf of Fr. [Name] by [Secretary]**. Priest-side activity and a notification identify the action and link to the record. Applicant-facing status can say **Approved by the parish priest** without exposing internal instruction notes.
7. The approval is effective when recorded. The priest's later reading/acknowledgment is visibility and oversight, not a second pending approval gate. An unread notification does not invalidate the approval.
8. The priest can flag an action recorded without authority or with incorrect details. Proposed correction uses a visible review/correction entry and appropriate suspension of any uncompleted dependent work; it does not erase history or silently undo a completed official record, signature or release. Exact dispute/correction rules need the detailed sacramental workflow specification.
9. Parish Admins and higher administrators do not automatically gain secretary-on-behalf approval through preparation access. Extending that capability needs an explicit separate decision. A bishop decision is not implied by a priest's instruction.
10. Approval, official-register approval, signing, issuance and release are distinct. The current user decision does not authorize secretaries to apply a priest's signature or bypass any later ecclesiastical review. Define which decision stages support on-behalf recording in S12–S14 before finalizing those controls.

**Proposed action meanings and boundaries:**

| Action | Required meaning in the permission matrix |
| --- | --- |
| View | Read the permitted record/fields at its actual scope; search, counters and previews obey the same privacy limits |
| Create | Start a draft/request, without implicitly approving it or creating authority |
| Edit | Change permitted fields at that stage; locked official facts use a correction workflow |
| Approve | Make or explicitly record a permitted decision with prerequisites, actor and responsible authority |
| Sign | Apply a signature under an independently defined signing permission; not inherited from data entry or proxy approval |
| Release | Give the intended recipient access to an already authorized final document; not another way to sign/approve it |
| Export/print | Take an authorized scope and field subset outside the screen; view permission alone need not imply bulk export |
| Archive | End active operational use while preserving required records and links; never a hidden synonym for permanent deletion |

**Proposed starting matrix for non-sacramental records and remaining actions:** The table completes the missing breadth of S02.07 but is not yet the owner's approved detailed matrix. “Office staff” below means the priest/Parish Admin/secretary or explicitly authorized scoped office administrator, not every staff account.

| Record type | View/create/edit | Decision or reserved action | Export/archive boundary |
| --- | --- | --- | --- |
| Public parish profile/content | Authorized office editors; public sees published approved fields only | Authorized publisher; bishop/diocese controls organizational facts and appointments | Public output only; drafts/history stay restricted |
| Diocese/parish organization | Super Admin and scoped bishop/admin according to appointment | Organizational approval/activation under S02.02–S02.03; clergy office stays with ecclesiastical authority | Scoped administrative exports; active record-bearing parish closes/archives rather than cascades to deletion |
| Accounts and appointments | Own account details or permitted administrator functions; people cannot grant their own rank | Appointing authority per scope; protected changes under S02.13 | No credential export; revocation retains appointment history |
| People/households | Permitted office staff; own official record visible through member projection; finance/leader views only need their permitted subsets | Office identity/link/correction review; no self-approval of official correction | Scoped, field-limited exports; archive preserves linked official records |
| Parish membership/profile corrections | Applicant submits own proposal; office reviews evidence and proposed link/fields | Permitted office reviewer; requester cannot approve their own proposal | Avoid global account exposure; retain decision history |
| Sacramental request/preparation | Applicant's own projection plus authorized preparation staff | Priest decision or specific secretary-recorded priest decision above | Applicant sees own results; official bulk export needs explicit authority |
| Official register entry/correction | Permitted preparation and clergy views; approved facts protected | Assigned priest approves official entry; correction authority/process must be specified | No ordinary delete; corrections and historical entries remain attributable |
| Certificate/signature | Permitted preparation staff and clergy; applicant sees permitted own status/output | Priest approval/signature; bishop review where separately required | Final file release only after applicable approval/signature/identity gates; no signature delegation assumed |
| Ministry/roster | Assigned leader and permitted office/clergy; member gets permitted own/group information | Join/departure rules in S18; confidential departure reason restricted | Scoped roster/attendance exports; departure keeps history |
| Calendar/service plans | Authorized office/clergy/leader within audience and event scope | Required publication or clergy/room approvals remain distinct from drafting | Export excludes private titles/details not permitted to viewer |
| Registrations/check-in | Assigned event/office users and own applicant data; medical/guardian fields restricted | Confirmation, consent, check-in, pickup and refunds have separate rules | Restrict participant exports; retain attendance/payment/incident history under policy |
| Reservations/equipment | Authorized requester and resource/office staff; other users see only permitted availability | Resource-specific confirmation/fees/cancellation authority | Do not export private applicant details through public availability |
| Giving/finance | Treasurer/authorized finance users; viewer read/report only; ordinary secretary has Office Expenses access rather than automatic full Finance | Named financial approver and separation of duties in S25; no self-second-approval | Financial close/correction rules; no silent deletion of approved history |
| Office Expenses | Permitted office staff and explicitly authorized finance roles | Approved allowance/expense/review rules; preparation role does not imply every financial approval | Scoped voucher/monthly export; correction/deletion rule to be agreed in S25 |
| Notes/messages/concerns/incidents | Author, recipients or explicitly assigned reviewers/handlers according to record type | No rank-based browse-all; reviewer conflicts and identity restrictions apply | No general export/archive right inherited from administrative rank |
| Audit | Scoped authorized reviewers with appropriate event visibility | Read-only history; corrections add events rather than edit the past | Audit export itself requires permission and must exclude secrets/private case content |

This matrix is a foundation for the full per-role/per-record view/create/edit/approve/sign/release/export/archive specification. Later sections must supply exact field, money, retention and stage rules; agreement to “all modules stay” is not approval of all current role permissions.

### S02.08

**Question:** Which exact office duties may Parish Admins and higher administrators perform when there is no secretary? Guest document controls need to agree with this policy.

**Owner direction:** Parish Admins and higher administrators can perform secretary duties when no secretary exists.

**Proposed completion:** No-secretary operation is a supported normal configuration. The assigned priest can perform office preparation; an appointed Parish Admin or an authorized diocesan/system office administrator can perform intake, ordinary person/household work, membership/correction reviews, calendar and facility administration, event forms, registration support, document collection and other explicitly permitted secretary duties within scope.

Do not require a fake secretary account or a secretary appointment just to enable these functions. Role labels continue to show the person's actual role; support is not performed by impersonating a secretary. Requests route to the assigned office team or priest when the secretary list is empty, and one person holding several roles receives one relevant notification rather than duplicates.

Office fallback does not itself grant priest decisions, signatures, private pastoral access, concern access or full finance authority. Under the currently agreed rule, only an authorized secretary records a prior priest approval on his behalf; an administrator who must do that would need an explicit decision granting that capability or a genuine secretary appointment. The priest can instead record the approval directly. This separates the owner's broad office fallback from the specifically authorized on-behalf exception.

The UI should show who currently owns office work and allow explicit reassignment. Absence of a secretary must never silently change who signed or made a clergy decision.

### S02.09

**Question:** Which duties may a priest delegate, to whom, for what period and with what visible notice? Which actions must remain personal to that priest?

**Owner direction:** Delegation follows the priest's decision.

**Proposed completion:** The priest chooses eligible staff and task distribution within parish policy, but delegation must name the person, parish, duty, scope, effective period and any restrictions. The user sees a clear acting-on-behalf label where appropriate; an account password is never shared as a delegation method.

| Delegation type | Proposed handling |
| --- | --- |
| Routine preparation/office work | Assigned to eligible office staff within their standing role or explicit scoped task authorization |
| A specific approval already given by the priest outside the system | Secretary records the prior decision under S02.07; no required prior online delegation or second online approval |
| Temporary ongoing operational coverage | Explicit duties, start/end, responsible priest and review/revocation; never blanket all-parish/all-role power |
| Priest duties assigned to another priest | Qualified active priest appointment and the required ecclesiastical authorization; duty allocation recorded |
| Signature, independent sacramental decision, bishop decision, confidential-case access | No automatic inheritance from administrative delegation; separate permitted authority required |

A delegation cannot exceed the giver's authority or cross into an unassigned parish, unrelated ministry or private case. It ends when expired, revoked or incompatible with loss/suspension of the underlying appointment. History retains both the acting account and the relevant responsible authority.

The scope of the specific offline instruction may be one request or a clearly enumerated set; it is not permission to decide future cases. Emergency/absence rules must identify an eligible substitute rather than treating unavailable clergy as an excuse for unqualified independent approval.

### S02.10

**Question:** When someone is absent, transferred, retired, suspended or deceased, who handles their pending approvals and assigned work?

**Owner direction:** Priest, Super Admin or secretary handles pending work, depending on the situation.

**Proposed completion:** Responsibility is transferred according to the kind of work, not merely to whoever is available:

- Office preparation and coordination can move to another authorized secretary/Parish Admin, eligible office administrator or priest.
- Ministry operations can move to a newly appointed/acting leader; unrelated leaders do not gain automatic access.
- Financial work moves to a permitted finance operator/approver, preserving independent-review rules.
- A decision requiring a priest moves to another qualified appointed priest. A secretary may record a prior genuine instruction under S02.07 but does not acquire the absent priest's independent judgment or signature.
- Head-priest/clergy vacancies and episcopal escalations go to the bishop or competent ecclesiastical authority. A temporary acting priest designation must be explicit.
- Super Admins coordinate technical access and reassignment under the proper authority; they do not become the replacement religious or financial decision-maker by being developers.

Before planned departure, show a handover list of open requests, approvals, events, reservations, assigned tasks, financial work and expiring delegations. Retain prior authorship and decisions; transfer only future responsibility/access. Unplanned suspension/death immediately removes applicable authority and routes unattended work to the proper authority for reassignment.

Private pastoral notes, private conversations and concern cases do not transfer with an ordinary work queue. Their own sharing/case rules apply. A former staff member may retain an ordinary member account if otherwise eligible. An instruction allegedly given before an appointment ended but entered later must be handled as a reviewed historical situation; it must not be used to exercise an expired appointment as current authority.

### S02.11

**Question:** What should happen to open forms and pending actions when access is revoked during a session? What explanation and safe destination should the user receive?

**Owner response:** Recommendation requested.

**Recommended answer:** Revocation takes effect for the next protected read or write, including sessions already open. The affected appointment stops authorizing actions immediately; do not wait until the next login or show a success result for a rejected save.

The user receives a plain-language message such as **Your access to this parish or role has changed. Your last action was not completed.** The message identifies their own affected context and an appropriate contact without exposing confidential reasons or another person's account details.

Close/restrict unauthorized detail screens, refresh available workspaces and navigate to an allowed workspace, My account or sign-in as appropriate. Removing one parish assignment does not remove other parish appointments or the account's unrelated member access. Global deactivation ends all access.

For unsaved forms, do not complete a submission using revoked authority or upload a hidden recovery copy of restricted data. Preserve only a draft that the account is still permitted to retain; otherwise explain the failure and route recovery through an authorized colleague/support process. Sensitive information already delivered to a device cannot be assumed to have been unseen; the interface must stop further authorized access and remove it from ordinary active views.

If the operation committed before the revocation, preserve its original actor/time and show it as completed only after checking its actual state. If it did not commit, it remains incomplete. A failed response must not be interpreted as proof either way. The same rule applies when a delegation, case assignment, appointment expiry or parish deactivation changes access.

### S02.12

**Question:** Should appointments have start/end dates, invitation acceptance or periodic review? What should upcoming expiry look like to the appointee and administrator?

**Owner direction:** Appointments should have dates, acceptance and review features.

**Proposed completion:** Every assignment records role, organization/ministry scope, appointing authority, start date/time, status, lead designation where relevant and history. End date is optional for ongoing appointments and required for temporary cover. Distinguish a scheduled end from an earlier manual revocation.

Recommended statuses: **Invited/Pending acceptance**, **Scheduled**, **Active**, **Suspended**, **Expired**, **Declined** and **Revoked/Ended** as appropriate. The effective date and acceptance requirements must both be met before an ordinary invited assignment becomes usable. A first privileged-account setup or an officially recorded existing appointment may need an explicit controlled activation path; it must not be mislabeled as a privately accepted invitation.

An invitation explains the role, parish/diocese, duties and dates. The person can accept, decline or request correction using their own identity. Membership invitation, ministry membership and staff appointment are different processes.

**Proposed defaults:** Notify the appointee and appointing authority 30 days and 7 days before expiry, with a clear period/recipient configuration for short appointments. Review active staff/administrative appointments annually and when leadership changes. These intervals are proposed product defaults, not claimed church requirements. Any configured reminders must actually be deliverable through the chosen in-system/scheduled mechanism.

Renewal requires an explicit authorized action; expiry never silently extends itself. Display the exact end time and parish time zone. Review reminders should not terminate an indefinite assignment unless an explicit expiry/revocation rule says so. Provide an escalation path for a head-priest vacancy or inaccessible last administrator so continuity is not solved through invented credentials.

### S02.13

**Question:** Which administrative changes need a reason, a second approver or current-password confirmation, and how should the confirmation describe its exact effect?

**Proposed answer:** Use safeguards appropriate to the effect of the action. A reason, current-password confirmation and a second person's approval are three different controls; requiring one does not satisfy the others.

| Change | Proposed safeguard |
| --- | --- |
| Ordinary clerical correction/draft change | Standard permitted save and history; extra reasons only where the record/workflow requires them |
| Staff role grant/revocation, temporary delegation, lead change | Explicit target/scope/effective-date confirmation and recorded reason; appointing authority must be eligible |
| Super Admin grant/revocation or global account deactivation | Current-password confirmation, reason and confirmation by another active Super Admin; a request to remove access cannot leave the platform without a controlled active administrator |
| Initial first Super Admin / exceptional recovery | Distinct controlled setup/recovery process with audit; no impossible requirement for a second account before the first exists |
| First bishop appointment or diocesan reassignment | Verified real authority, reason, effective scope/date and review by another eligible platform administrator for the administrative action; this does not confer religious office |
| Parish creation/activation or change of responsible clergy | Relevant bishop approval/appointment and clear parish/lead-priest summary; local staff cannot self-promote into clergy |
| Parish closure, removal of an unused setup or organizational ownership change | Impact preview, reason, reauthentication and independent authorized review; record-bearing parishes do not use ordinary hard deletion |
| Password recovery for privileged account | Verify target identity, current-password confirmation for the acting authorized administrator, reason and revoke the recovered account's old sessions; never disclose the password in an activity log |
| Exceptional confidential access or private export | Purpose, precise permitted records, appropriate independent authorization and audit; no permanent browse-all capability created as a shortcut |

The two developer accounts should remain separately usable for ordinary dual-control actions. Proposed operational policy is to maintain at least two active Super Admins; if a planned removal reduces that number, establish a replacement first. A genuine compromise/recovery procedure must still be able to contain a compromised account rather than being blocked by this operating target. Protection against losing all active privileged access remains mandatory.

The confirmation must show **who/what changes, exact scope, effect on access and pending work, effective date and reversibility**. A person cannot be the independent second approver by switching roles or accounts under their sole control. Temporary protective suspensions may need immediate effect with subsequent review, rather than waiting while compromised access remains usable; define that exception and its reviewers explicitly.

This proposal does not introduce a second online priest approval for the specific secretary-recorded instruction in S02.07.

### S02.14

**Question:** How should a user request missing access or challenge an incorrect appointment without seeing unauthorized records or other people's account details?

**Proposed answer:** Provide **Request access** and **Report incorrect appointment** from My account and appropriate denied-access screens. Requesting an appointment creates a review request; it never grants the requested role automatically.

Collect the requested organization, duty/role, reason, expected dates and the requester's own contact/account identity. Show only a public/authorized directory of target organizations and their own existing appointments; do not expose private staff lists, account matches, patient/person records or confidential case identifiers through an access request form.

Route parish staff requests to the head priest or eligible appointing authority, diocesan administrative requests to the bishop, and platform/bishop-onboarding issues to the Super Admin review process. Clergy appointment requests go through the ecclesiastical authority rather than ordinary office approval. Existing complaints about a conflicted authority follow an independent escalation route rather than being automatically disclosed to that same person.

Statuses should include **Submitted**, **Needs information**, **Approved/appointment offered**, **Declined**, **Withdrawn** and **Resolved** where applicable. A reviewer states scope/dates and an understandable outcome; the requester receives the result and a next action. Staff can decline their own pending invitation or report an incorrect active assignment without seeing anyone else's appointment details.

No reviewer approves their own request, appoints an unauthorized peer/superior or overrides independent-case restrictions. An escalation must go to an actually eligible authority. On approval, create the proper invitation/assignment and apply S02.12. Keep the access request and appointment history linked but distinct. General access appeals must not become a way to browse concern cases or private pastoral notes.

## S03

**Navigation, dashboard, search and work queues**

### S03.01

**Question:** What should be the first screen after login for each role, including an account with no parish, a follower without membership and an unassigned priest?

**Owner direction:** One available working role enters its dashboard directly. Multiple working roles require a role choice before entry; do not automatically enter the last-used role. Role changes do not require another login. The chosen role adapts the same combined home.

Accounts without a parish can search nearby/by locality and read published church information/events without approving location access. Followers see public parish content, not office or private ministry records. An unassigned priest receives **Awaiting parish assignment**, own account controls and public discovery. Super Admin initialization works before the first diocese exists. A permitted deep link returns after authentication, required role choice and access checking.

### S03.02

**Question:** Should staff enter their work tools and personal parish life through one switch, separate destinations, or one combined home? Confirm the current exclusion of secretary personal member routes.

**Owner direction:** Provide one combined home. Personal and work information may appear as clearly grouped sections for the signed-in account; do not add separate personal/work home selection. The role chooser selects acting authority, not a second home.

**Proposed completion:** Personal requests, commitments, notes and messages appear only where that account's legitimate relationship permits them. A secretary's personal content does not become office/team content because both appear in the same UI. Review the current secretary personal-route exclusion against this direction; staff appointments must not fabricate membership. Personal eligibility and consequential role-based actions remain separately enforced.

### S03.03

**Question:** Which sections should appear in each role's main navigation, and which should be reachable only from a related record or a More menu?

**Owner direction:** Navigation and actions follow role permissions and valid scoped individual grants. Show authorized sections; distinguish view-only from create/edit/approve/sign/release/export rights.

**Proposed completion:** Use one shell with role/context, search, notifications and account controls. Priest/office navigation prioritizes Home, Requests, Calendar, Reservations, Ministries and permitted People work; other modules are grouped by records, activities, communications, money and administration. Finance users prioritize Giving/Finance/Reports; leaders prioritize assigned ministries/meetings/volunteers; system/diocese roles prioritize their administrative scope. All retained authorized modules remain discoverable. Individual records open contextually rather than crowding navigation with every detail page.

### S03.04

**Question:** Which labels need changing to match users' language: People/Parishioners, Groups/Ministries, Member portal/Website content, Eparchy/Archdiocese, Services & Activities, or others?

**Owner direction:** Review all ambiguous labels; exact replacement wording still needs approval. Use one EN/FR/AR dictionary across screens, notifications, documents and help.

**Proposed wording:** People includes nonmembers and clergy; Ministries & Groups includes choir/class/committee types; Home means the combined dashboard. My account contains identity/preferences/appointments; My parish records contains office-held facts and correction requests. Website content belongs under Public website, not Member portal. Inbox means private conversations; Communications means audience composing; Announcements means published updates. Distinguish Event registrations from Forms & workflows and official entries from certificate requests. Use each organization's approved ecclesiastical terminology.

### S03.05

**Question:** What should the parish selector show: assigned parishes, followed parishes, all accessible parishes, primary parish and/or a combined view?

**Owner direction:** Use a combined parish view, with an optional parish filter. Label every task, event and record with its parish and relevant relationship.

**Proposed completion:** **All my parishes** includes public content from followed parishes, personal/member content from approved links and operational content only from appointments permitting the selected role. Identify Member, Following, Pending and Primary separately. A combined list does not merge records or confer authority across churches. New records require one explicit target parish; existing records retain their own target. Offer role change when required. National/diocesan scope is visibly distinct from ordinary parish access.

### S03.06

**Question:** What should persist after switching parish or workspace: current page, filters, selected date, open draft and last-used view? What must reset?

**Owner direction:** Changing/removing a role removes its former information and actions. Refresh role choices, navigation, home cards, search, badges and protected reads/writes without waiting for a fresh login. Retain unrelated valid roles and memberships.

**Proposed view-memory rules:** Save language/appearance globally and collection preferences per account/role/parish, including combined filters. Keep compatible dates/sorts; clear selected people, bulk selections and pending confirmations on incompatible scope changes. Unsaved work offers Save draft/Discard/Stay where permitted. Preserve recovery material only if continued access allows it. Each tab keeps its own target so another tab's parish change cannot redirect a save.

### S03.07

**Question:** For each dashboard, choose the information and actions that deserve the first visible screen. Which numbers need definitions, date periods and drill-down destinations?

**Proposed answer:** Adapt one combined home to the chosen role: priest decisions/upcoming clergy work/recorded-on-behalf activity; office calendar/preparation/reservations/registrations; leader meetings/membership/attendance/volunteer gaps; finance balances/reconciliation/authorized decisions; bishop diocesan work; Super Admin organizational/account issues. Include permitted own requests/messages/commitments without another home switch.

Every figure specifies unit, scope, period, status set, last refresh and drill-down. Distinguish missing data from zero. Combine matching work without duplicates and show private-case counts only to authorized reviewers. Secretary-recorded priest approval is information for the priest, not another pending approval. The earlier blank owner response did not approve these suggested cards.

### S03.08

**Question:** Should actionable work appear in one personal queue across request types, or in separate role/module queues? Distinguish “needs me,” “needs office,” and “waiting on applicant.”

**Proposed answer:** Use one **My work** triage area with Needs my action, Office/team work, Waiting, Completed and All permitted. Filter by parish, type, owner, stage, dates and urgency. Keep type-specific review screens and rules behind each item.

Show one canonical case with reference, origin, subject, parish, next action, responsible authority and dates; linked guest/member intake and office work do not duplicate it. Distinguish waiting for applicant/documents, another authority and a future date. A cross-role overview offers explicit role change before action. Confidential concerns, private pastoral work and restricted incidents remain in dedicated authorized queues, without general-count leakage.

### S03.09

**Question:** What exactly should each navigation badge count? Resolve whether it includes guest requests, membership, corrections, waitlists, bishop review and work someone else must perform.

**Proposed answer:** Badges count distinct currently actionable cases within the displayed role/scope; collection totals belong inside People/Households/Ministries pages. Requests includes actionable membership/correction/guest cases when permitted. Combined totals deduplicate overlapping module views and linked intake/office records.

Unread Inbox/Notifications use a separate consistently defined read unit. Label waitlist counts as events needing review or people waiting, never mix both. Exclude completed, withdrawn, cancelled, inaccessible and information-only cases. Show other-person work in permitted team views, not Needs me. Refresh list/dashboard/badge together; loading or failure is not zero. On-behalf approval creates attributed activity, not a repeated decision requirement.

### S03.10

**Question:** What should global search find for each role, and which fields may results expose? Include names in either script, phone, household, request reference, register number and pages/actions.

**Proposed answer:** Search permitted names/content in EN/FR/AR, original supplied variants, phone, household, request reference, register number, event, ministry/resource and application destinations. Normalize matching without rewriting official spellings. Default to the active authorized role/scope or explicit combined filter, with parish shown on results.

Personal/public searches have their own projections; system account lookup stays an administrative function. Enforce permission before results, snippets, counts and suggestions. Do not index other people's confidential notes, concern evidence, medical data or private messages through broad search. Dedicated private searches retain their own access checks. No match offers a permitted next action, never automatic person creation.

### S03.11

**Question:** What should selecting a search result open: a page, drawer or relevant tab? How should users return to the same result position and filters?

**Proposed answer:** Open stable record detail pages and relevant tabs for people, households, requests, official entries, reservations, events and ministries. Use drawers for short edits/previews while preserving an addressable detail page. If another authorized role/context is required, explain and offer the switch.

**Back to results** restores permitted query, filters, scope, sort, page and scroll. Search, notification and bookmark resolve to the same canonical record. Recheck access/state before display and action. Archived details are read-only where permitted. Unavailable records show a neutral explanation and safe return without disclosing an old confidential title.

### S03.12

**Question:** Which tables need saved filters, sort, column choices, page-size choices, bulk actions and selected-versus-all-matching selection?

**Proposed answer:** Provide consistent filters/sort/pagination and remembered allowed columns on major collections, with Reset view. Proposed page sizes are 10/25/50/100; avoid unbounded all-record rendering. Export scope is explicit: selected, all matching or an authorized full collection.

Separate Select this page from Select all matching count. Clear or explicitly reconcile selections when filters/scope change. Preview mutation scope and excluded items; return per-record outcomes and retry only failures. Restrict bulk operations by action and record eligibility. Do not infer permission for bulk signatures, priest decisions, document release, sensitive-case handling or independent financial approval from ordinary table selection.

### S03.13

**Question:** On a phone, which actions and fields must remain immediately visible when desktop tables become cards or hide columns? Which tasks need a dedicated full-screen flow?

**Proposed answer:** Keep phone cards readable with reference/type, subject, parish, status, next action, responsible role and relevant time. Financial cards retain actual amount/currency; sensitive guardian/medical details appear only in protected views.

Use full-screen layouts for complex requests, record editing, approval and document release. Keep role/parish/authorizing priest visible and ensure keyboards/fixed controls do not cover validation or submission. Provide alternatives to hover/drag and accessible list/detail alternatives to dense calendars/matrices. Opening a card must not trigger approval. Public/member journeys, file upload and permitted draft recovery remain complete on phones despite laptop-first staff design.

### S03.14

**Question:** When a direct link points to a moved, archived, removed or unauthorized record, what should the user see and where should they be able to go next?

**Proposed answer:** Redirect renamed/moved items only to a verified permitted successor. Archived records retain authorized read-only history; cancelled/closed workflows show outcome and allowed follow-up. Authentication preserves a legitimate destination for later access checks.

If unavailable/unauthorized, say **This item is unavailable or you do not have access**, with Back/Home or a nonrevealing support route. Do not reveal record existence, old titles, names or amounts through errors. Expired/revoked guest links use the office's verified recovery process, never a fresh link issued solely from a claimed name. A similar name is not proof of record identity.

## S04

**Public directory, parish pages and visitor discovery**

### S04.01

**Question:** What is the public homepage's main job: finding a parish, finding Mass times, making a request, or explaining ParishLife? Rank the primary actions.

**Proposed answer:** Rank public tasks: Find a parish; Find Mass/confession times; Contact/make a request to that parish; Discover ministries/events; Learn about ParishLife. Put search, languages and Sign in/My account within easy reach and keep introductory imagery from burying useful actions.

Offer a previous-parish shortcut without silently opening it or the first database entry. Identify the selected church before any request. List participating published parishes honestly; initially two is valid, not evidence of nationwide directory completeness. Keep marketing/adoption information secondary to parish discovery and visits.

### S04.02

**Question:** Which directory filters and sort choices are essential, and should visitors find Masses by day, time and language across parishes rather than only opening parish profiles?

**Proposed answer:** Search approved EN/FR/AR parish/locality names; filter by diocese, locality/region, supported jurisdiction/rite and request availability. Sort by display-language name, locality or optional approximate distance. Disambiguate repeated names using location/diocese.

Provide Find a Mass across published participating schedules with date/day, time range, language and locality; separate confession and appointment-only availability. Structured recurring schedules and dated exceptions/cancellations are prerequisites for computed next-Mass results. Existing free text remains published text with contact confirmation, not guessed occurrences. Show active filters, counts, reset and no-result alternatives; missing published times never means no services exist.

### S04.03

**Question:** Which details must a parish card show before a visitor opens it, including office availability or whether online requests are accepted?

**Proposed answer:** Cards contain approved parish name, locality/diocese, neutral emblem or verified photo and View parish. Add a real request/contact action when enabled. Show next published Mass, actual office hours, approximate distance and verified accessibility only when reliable source data supports them.

**Hours not published** differs from **Closed**. Compute Open now only from structured hours/time zone/exceptions. Deactivated/closed churches do not appear as accepting new requests. Do not publish internal activity counts, personal contacts or unverified stock images as parish facts. Card translations follow core public readiness.

### S04.04

**Question:** Is the map preview useful at launch, or should it be hidden until a live map is available? What must happen when location access is refused or coordinates are missing?

**Proposed answer:** Hide the unconfigured map preview from public navigation while retaining real-map support in product scope. A configured map mirrors published list filters, uses verified locations and retains a list alternative.

Request location only after Use my location; denial/unavailability leaves town/name search usable without repeated prompts. Label distances approximate; radius filtering respects known coordinates and separates Distance unavailable results. Never invent pins or infer exact directions from an ambiguous church name. Keep precise visitor coordinates out of public URLs and ordinary exports; offer Clear location. Name the external provider when opening approved directions.

### S04.05

**Question:** What must every parish profile contain, and in what order should story, visiting information, times, clergy, ministries, events, requests, updates and contacts appear?

**Proposed answer:** Use a shared profile order: identity/status/actions; Mass/confession times; visiting information/contact; public calendar; requests/services; ministries; approved clergy information; announcements; history/gallery; contact footer. Keep times and visiting details above long narrative content.

Expose only approved public fields, with clear full-calendar and request routes. Hide optional empty sections and their menu links. Keep contact/request actions reachable without obscuring phone content. Private people, family requests, group attendance, finances and attachments do not become public because their event/ministry is listed. Customize content within a uniform, accessible trilingual layout.

### S04.06

**Question:** Should missing parish information be hidden, shown as awaiting publication, or replaced with a specific contact action? Which missing fields should prevent publication?

**Proposed answer:** Require approved identity/core translations, diocese/locality, assigned responsible priest, adoption/activation approval and a maintained public contact route before Create and activate. Creation then makes the valid parish operational/public immediately; optional galleries/history or full data import do not block it. Offer Continue parish profile setup.

Keep incomplete setup private. Missing useful times/hours receives honest office-confirmation wording, not fabricated data; optional empty content stays hidden. Published content remains available while revised translations are drafted. Exact parish names, jurisdiction, contacts and coordinates require real inputs, not sample defaults. Minimum readiness beyond the owner's direction remains a proposal.

### S04.07

**Question:** Should illustrative photographs remain on named parish pages until verified parish images exist? Approve the wording and placement of the illustration label.

**Proposed answer:** Prefer verified parish-approved photographs. Use neutral church emblems/illustrations on named profiles until authentic images exist, avoiding unrelated real church photographs that imply authenticity. General illustrative homepage imagery may remain with a nearby label and source attribution.

Suggested label: **Illustrative image — not a photograph of this parish.** Record source, approval, caption and EN/FR/AR descriptive text. Apply approved publication consent for identifiable people and children; upload is not publicity authorization. If an image is withdrawn or fails, return to a neutral readable fallback. Photography is optional for parish activation.

### S04.08

**Question:** Which clergy/leader names and contact details may be public, and who confirms their publication? Should contact always route through the parish office?

**Proposed answer:** Publish approved clergy names, ecclesiastical titles and parish functions, with official office contact. Public leader names/contact roles require explicit parish/person publication approval. Default messages to a maintained office/ministry channel, not private phone/email.

The head priest owns correctness; office editors maintain permitted fields, while diocese authority validates clergy appointment/title facts. Never copy login identities into public contacts automatically. Show actual contact destination, hours and channel availability. Appointment changes trigger public-list review; former staff personal contacts are removed from current displays without exposing their underlying records.

### S04.09

**Question:** Should public calendar titles include family names for baptisms, weddings and funerals? Define default visibility and who authorizes exceptions.

**Proposed answer:** Public sacramental event titles default to Baptism celebration, Wedding celebration or Funeral service, without automatic family/person names. Maintain separate internal and approved public title/description fields.

Named publicity needs the parish's explicit process and appropriate subject/authorized-family permission, including guardian handling where applicable. A sacrament request is not publicity consent. Apply visibility to images, alt text, attendee lists, previews, feeds, exports and notification subjects. Withdrawal updates future public output with an internal history; downloaded/shared copies cannot honestly be recalled. Staff/group audiences receive extra details only under their own permission rules.

### S04.10

**Question:** Which guest request types should be discoverable from parish pages? The public form also contains appointment and ministry options beyond the main request cards.

**Proposed answer:** Discoverable configured requests include supported sacraments/certificates; hall/room/outdoor booking; blessing, Mass intention, visit and priest appointment; ministry inquiry; and general office needs. Publish plain-language preparation/eligibility expectations and contact alternatives.

Guest/member versions collect the same essential service facts; members prefill only permitted records. Guest inquiry creates neither ministry membership nor person/staff access. Before submit, show parish/type/subject/contact, documents/physical steps and review summary. Confirmation gives reference/private tracking and later office-reviewed account association. Bookings/appointments remain requests until actual confirmation. Disabled types offer maintained office contact while existing applicants retain permitted tracking.

### S04.11

**Question:** Should urgent needs such as a funeral or sick visit offer a clearly visible office/emergency contact route alongside online submission? Who maintains that contact and its availability?

**Proposed answer:** Display **Urgent pastoral need? Contact the parish** for time-sensitive funeral/visit arrangements, with an actual maintained office/designated contact and genuine hours. Out-of-hours or 24-hour labels require a real arrangement. Online submission may supplement direct contact but never promises continuous monitoring or automatic immediate response.

The head priest owns the route; office staff update exceptions and handovers. Distinguish Received from Read/responded. Urgency flags authorized work without bypassing identity, privacy, clergy authority or document requirements. ParishLife must not fabricate an emergency dispatch capability or external alert delivery. Contacts and response arrangements must be supplied per parish.

### S04.12

**Question:** What should shareable parish/event URLs, visitor language choice and return-to-results behavior preserve? Should the separate landing/marketing page remain part of the product?

**Proposed answer:** Use stable unambiguous parish/public-event URLs; names may be readable but identity must survive renaming. Preserve safe query/filter/date/sort/language state and Back position. Exclude private tracking tokens, account details, confidential references and precise visitor location from public share links.

Maintain EN/FR/AR throughout discovery, requests, validation and tracking. Public previews use only approved public content. Keep the directory as the service entry point and a separate About ParishLife/For parish teams marketing area, not a competing directory. Bundle descriptions do not trigger billing. Login from a legitimate public request retains its intended parish/type after membership/access checks.

## S05

**Website content, announcements and publishing**

### S05.01

**Question:** Who may edit public content, who may publish it, and should clergy or another reviewer approve particular types before publication?

**Proposed answer:** Parish Admins, secretaries and priests with content permission prepare public text/media within their parish. The head priest or an explicitly appointed public-content publisher approves ordinary publication; clergy titles, organizational facts and official sacramental wording require their competent authority. Leaders prepare material only for assigned ministries/audiences.

Keep edit and publish rights distinct, including urgent corrections. A colleague cannot approve their own content where a second review is configured. Every publication identifies editor, publisher, revision, language readiness and audience. Public access derives from approved publication, not from an internal record existing.

### S05.02

**Question:** Should public profile details and website sections be managed together, or should their different ownership remain visible as separate editors?

**Proposed answer:** Provide one Public website management area with Overview, Parish details, Schedules, Content, Announcements and Gallery. Each field retains its own authority: office editors maintain approved contact/visiting information, clergy/diocese control appointment/title facts, and content publishers control sections.

Show current public output, draft changes, all three language states and the action required. Avoid separate editors with contradictory copies of office hours, Mass times or contact information. Related administrative records can be linked read-only where this editor cannot change them. One area simplifies navigation without merging permissions or erasing responsibility.

### S05.03

**Question:** When editing published content, should Save draft retain the currently published version? Confirm or replace the current behavior that unpublishes a section.

**Proposed answer:** Save draft keeps the current published revision online. New unpublished content remains private; editing a published section creates a separate draft. Unpublishing is an explicit action with audience/impact confirmation, reason and history.

A draft save must never remove a live section as a hidden side effect. Preview clearly labels the version being viewed. Publishing promotes one reviewed language-complete revision; concurrent public changes trigger comparison. If a publisher withdraws incorrect content, choose restore previous approved version or explicit unpublish, with maintained contact information and a visible result.

### S05.04

**Question:** Which publishing states are needed: draft, awaiting approval, scheduled, published, expired, returned and archived? Who moves between them?

**Proposed answer:** Use Draft, Awaiting review, Returned, Approved/Scheduled, Published, Expired/Unpublished and Archived. Editors submit; authorized reviewers return/approve; publishers publish/schedule/withdraw. Scheduler-backed transitions only run when the actual service exists; otherwise show a manual publishing task.

Record who changed state, reason where needed and actual effective time. Scheduled content displays parish time zone, audience and cancellation control. Expiry removes public distribution but retains authorized history. Archive is not permanent deletion. Existing published content remains online while a replacement is returned for edits; avoid ambiguous mixed draft/published labels.

### S05.05

**Question:** Is publishing allowed with only one language complete? If so, what should visitors and editors see when the other translation is missing?

**Proposed answer:** Core public pages, reusable announcements/forms and official content require reviewed English/French/Arabic versions before final publication, consistent with launch language scope. Editors can save partial drafts; show missing/review-needed languages and the responsible reviewer.

Do not silently advertise a partially translated item as complete. The last approved trilingual version remains live. Private user free text retains its original language and does not require three authored copies; this remains the explicit interpretation to approve under S01.09. Any future urgent-language exception needs its own named authority/process and visible fallback, not an undocumented bypass.

### S05.06

**Question:** Must editors preview the exact public page on phone and desktop before publishing, including language fallback and private/public visibility?

**Proposed answer:** Require a preview of the actual pending public revision, with phone/desktop and EN/FR/AR controls. Show full page context, links, image descriptions, dates, schedule exceptions and public versus restricted audience. Label draft previews private and prevent public sharing/indexing of private previews.

Before publish, display changed sections, language readiness, recipient/audience scope and scheduled effective time. Preview must use the same rendering/content rules as publication. Review should catch long names, missing captions and wrong contact destinations. Preview alone does not grant publishing rights or mark documents officially approved.

### S05.07

**Question:** Which content should support rich text, links, files, galleries and captions? Who provides image descriptions and confirms permission to use photographs of people?

**Proposed answer:** Allow controlled rich text, safe links and approved images/files on stories, announcements, ministry descriptions and resources; structured schedule/contact fields remain structured. Avoid arbitrary embed/code entry for ordinary editors. Each image/file has title, description/caption, language, source, approval and intended audience.

The uploader supplies descriptive text and the publication-permission basis; the publisher verifies these before public use. Identify people only where approved. Private evidence and certificates are not reusable website media by default. Replacement/withdrawal retains authorized revision history and updates future public references. Rights and retention owners provide the applicable rules.

### S05.08

**Question:** Should Mass/confession/office times be structured schedules with exceptions or free text? Who keeps holiday changes consistent with the calendar?

**Proposed answer:** Store Mass/confession/office schedules as structured recurrence rules with dates, times, language, location, time zone and dated exceptions; retain supplementary explanatory text such as By appointment. Authorized office users prepare changes and the priest/publisher confirms relevant public schedules.

One authoritative schedule feeds parish profiles, Find a Mass, calendars and card summaries. A dated cancellation/holiday exception overrides the recurring occurrence rather than creating contradictory listings. Imported free text remains text pending review, not automatically parsed into trusted occurrences. Show publication/update date and source, and notify affected registered participants where actual event changes require it.

### S05.09

**Question:** Do announcements need pinning, expiry, categories, audiences, attachments and scheduled publication? Which should appear on both public and member pages?

**Proposed answer:** Announcements support audience, category, pinning, publish/expiry time, translations, attachments and an accountable author/publisher. Public/parish/member/group visibility is explicit; group updates do not automatically become public.

A single approved content identity may have permitted placements on the public website and combined home, preserving one revision/history. Audience changes require review and must not broaden access to formerly private attachments. Scheduled/expired behavior depends on a real runner; manual fallback is labeled. Keep historical authorized access separate from current feed placement. Pinning priority should be bounded so current operational notices remain findable.

### S05.10

**Question:** Should each parish be allowed to change public branding/layout, or should the current shared public theme remain uniform while dashboard colors stay personal?

**Proposed answer:** Retain a shared public layout and accessible theme across participating parishes. Allow approved identity assets, authentic imagery, names and content, not arbitrary layouts that make navigation or language behavior inconsistent. Dashboard color/mode remains a personal account preference.

Any parish accent customization stays within readable contrast/status constraints and does not alter official document styling. Public branding changes need preview and publish history. Diocese-specific seals or templates require approved assets. A future layout extension is a product-owner decision tested across all languages/devices, not an unrestricted settings toggle.

### S05.11

**Question:** What should happen when two editors change the same section: compare versions, keep a recoverable draft, request refresh, or assign an editor lock?

**Proposed answer:** Use revision-aware saving with a clear changed-by/when notice. If two editors change the same revision, preserve the second person's permitted draft, compare relevant fields/languages, and let them reload/reapply or submit a reconciled version. Never silently replace newer public text.

A nonblocking editing indicator can help coordination but must not become an abandoned permanent lock. Publishing rechecks current revision and authority. Show whether conflict affected draft or live content, and keep a recoverable path without copying confidential data to unauthorized users. Concurrent role revocation stops the attempted write.

### S05.12

**Question:** Who can see publication history, revert a mistake and remove an accidentally published private item? What should be retained in the audit record?

**Proposed answer:** Authorized parish publishers, priests and scoped administrative reviewers can view publication history with editor/publisher, time, revision, language/audience and reasons. Restore an approved prior revision through a new audited action rather than altering history.

A publisher can urgently unpublish an accidentally public private item, revoke future file access and notify the responsible authority. Remove it from current feeds/search/previews under system control; do not promise recovery of external copies. Technical Super Admin support remains scoped and logged. Sensitive incident details belong in a restricted review record, not the public change log.

## S06

**Sign-up, sign-in, invitations and recovery**

### S06.01

**Question:** Confirm who may create their own account and the minimum age. What is the intended account model for younger children and adults who cannot manage their own login?

**Proposed answer:** Preserve the current self-registration threshold of 13 as a proposed product rule, subject to approval by the responsible policy owners before launch. Adults and eligible teenagers create individual accounts; younger children have parish person/registration records managed by an authorized guardian without shared child credentials.

Provide an explicit assisted/representative process for adults unable to manage their account; household relationship alone is not authorization. Guardian/account access is scoped, reviewable and ends or changes when eligibility changes. Do not infer national legal requirements from this threshold. Staff access always requires separate appointment/acceptance.

### S06.02

**Question:** Which signup fields are essential immediately, and should Arabic name, address, parish and other profile details remain for later?

**Proposed answer:** Initial signup asks first/family name, birth date for eligibility, at least one sign-in contact, password and confirmation, preferred interface language and the required notices/consents. Explain which fields establish identity versus provide profile information.

Do not require parish selection, Arabic/French name translations, occupation, address or a ministry before account creation. Offer skippable profile completion and parish discovery afterward. Names are entered as supplied; do not auto-transliterate into an official name. No person/household/staff record is automatically created merely because signup succeeds. Preserve nonsensitive fields after validation without retaining passwords.

### S06.03

**Question:** Should new users sign in primarily with email, phone or username? Is selecting the identifier type desirable, or should one field recognize it with clear errors?

**Proposed answer:** Provide one clearly labeled **Email, phone or username** sign-in field that recognizes supported identifiers, with an optional explicit identifier-type control for ambiguous cases and legacy usernames. Keep existing usernames usable and show the selected interpretation before an ambiguous submission.

Use international phone formatting guidance and allow paste/password managers. Generic credential failure must not confirm account existence. Do not treat a username as an email address or create another identity when parsing fails. After authentication, use the owner's role-choice/direct-entry rules and one combined home, not an additional portal selector.

### S06.04

**Question:** How should signup explain a phone/email already in use, shared family contacts and possible existing office records without exposing another person's account?

**Proposed answer:** Signup gives a neutral explanation that the contact cannot currently be used and offers sign-in/recovery or a different contact, without displaying another person's name, parish or account details. A shared household phone/email may remain office contact information but should not ambiguously identify several login accounts.

Each login identity is linked to its intended account through verification/review. Existing parish-record matching occurs only after authenticated invitation or office membership review. Never expose likely person matches on public signup. A family needing assistance uses an office-supported invitation/representation route, not one shared staff login.

### S06.05

**Question:** Must a contact be verified before login, submitting a request, linking a parish record or holding a staff role? What happens when verification is unavailable or a code does not arrive?

**Proposed answer:** Verify a chosen login contact before treating it as verified or enabling self-service credential recovery. Public browsing and permitted guest requests remain possible; membership linking and staff appointment also require office/appointing-authority identity checks rather than contact ownership alone.

If delivery is unavailable, show unverified status and offer a documented office/manual identity-review route for permitted actions. Manual review is labeled as such, not as successful email/SMS verification. Codes have visible expiry/resend guidance and bounded attempts. Do not block access to existing legitimate credentials without a reviewed migration/recovery process. Production-required verification must be genuinely connected.

### S06.06

**Question:** Which external sign-in providers and MFA, if any, belong in launch? Until then should unavailable provider buttons be hidden or visibly disabled with an explanation?

**Proposed answer:** Password sign-in is the required baseline; keep Google/Apple/Microsoft as optional providers enabled individually only after real configuration and account-link verification. Hide unavailable provider buttons from the ordinary primary sign-in flow, with availability explained in account help/settings.

Require MFA for privileged administrative operations as a proposed launch control, with enrollment/recovery and actual verification rather than a decorative toggle. If unavailable, track this as an unresolved release requirement instead of simulating success. Provider login must not automatically merge accounts based solely on a claimed matching email. Retaining provider support does not imply every provider is already operational.

### S06.07

**Question:** What password guidance, visibility toggle, password-manager behavior and validation feedback should members and staff receive? Should the experience differ by privilege?

**Proposed answer:** Use clear passphrase guidance, show/hide controls, paste/autofill/password-manager support and immediate field-specific errors. Proposed minimums are 12 characters for ordinary new credentials and 16 for privileged accounts, with a generous maximum; final policy belongs to security/product owners and migration must avoid surprise lockouts.

Confirm new password matching; never log or echo secrets in history. Rate-limit authentication and recovery rather than relying on confusing complexity instructions. Staff enrollment explains stronger controls and MFA where required. Changing a password requires current identity confirmation and communicates which other sessions are revoked.

### S06.08

**Question:** What should Forgot password do for a member, a privileged staff account and an account with no usable verified contact? Define identity review and who may help.

**Proposed answer:** Forgot password accepts an identifier and returns a neutral confirmation. A verified usable contact receives a single-use expiring recovery route through a real service. If no verified route exists, direct the person to identity-reviewed office/platform support.

Ordinary member recovery cannot reset privileged accounts. Privileged recovery uses the authorized administrator procedure, recorded reason and strong actor reauthentication, without transmitting new secrets through unconfigured channels. Revoke prior sessions after successful reset and notify through permitted available channels. Lost access does not justify disclosing another account's existence or removing approval/audit safeguards.

### S06.09

**Question:** Should office-created people receive invitations, through which real channel, and what should the recipient see before accepting the person link?

**Proposed answer:** Office users can create a scoped one-use invitation for an existing person not already linked to an account. Deliver through a configured verified channel or hand it directly using an explicitly manual process; show **Link created, not sent** when no delivery occurred.

The recipient sees inviting parish, intended person link, purpose and expiry, then signs in or creates their own account and confirms the association. A mismatched or already-linked record goes to office review. The invitation grants only the stated person association, not ministry membership or staff authority. Staff never require the recipient to reveal a password.

### S06.10

**Question:** Confirm the invitation expiry and one-use rule. What should expired, already-used, revoked and wrong-person invitations offer as a recovery action?

**Proposed answer:** Preserve seven-day, single-use invitation expiry as the default, with a clearly shown deadline/time zone and revocation control. Store/reveal only what is needed to claim safely; office users can revoke and issue a replacement without changing the target identity.

Expired links offer request-new/contact-office; used links explain the limited unavailable state and provide sign-in where safe. Wrong-person claims stop and notify the office without displaying unrelated records. Revoked/replaced links remain unusable. Retrying an already successful claim should resolve the account's actual association rather than create a duplicate.

### S06.11

**Question:** How may a user change or remove a login email/phone, recover a lost device, sign out other devices and detect an unfamiliar session?

**Proposed answer:** Changing/removing a login contact requires authenticated reconfirmation and verification of the replacement, while keeping an existing recovery route until the new one is valid. Official parish contact corrections remain separate.

Provide actual session/device review and revoke-other-sessions controls backed by real session data, not seed devices. A lost-device/MFA recovery route verifies identity and records privileged support actions. Notify meaningful identity/session changes without exposing secrets. A user cannot remove their only usable sign-in/recovery method without a confirmed alternative or a reviewed account-closure process. Do not promise new-device alerts until detection/delivery is operational.

### S06.12

**Question:** What should login rate limiting, disabled accounts, session expiry and shared-computer sign-out communicate? What draft work should survive reauthentication?

**Proposed answer:** Explain temporary rate limits with a retry path, deactivated access with an appropriate support route, and expiry with sign-in-and-return. Authentication failures stay generic; authorized users may see their own specific account/appointment status afterward.

Shared devices should not retain secrets or privileged sessions indefinitely; propose an inactivity warning and configurable timeout for staff/sensitive work. Preserve permitted nonsecret drafts through reauthentication, but stop operations whose role was revoked. Show actual saved/pending state; signing in again must not blindly resubmit a payment/approval. On explicit sign-out, clear protected active views and shared-device recovery material.

## S07

**Following, parish membership and profile corrections**

### S07.01

**Question:** What can a follower see/do before parish membership is approved, and what should explain the benefit and meaning of formal membership?

**Proposed answer:** Followers can read published parish events, schedules, ministry descriptions and announcements, contact the office and submit permitted guest-style requests from their account. Their combined home labels the relationship Following rather than Member.

Explain that approved parish membership links the account to a verified office person record and enables permitted personal/member features. It does not grant ministry leadership, finance or clergy access. Show membership request status and next action without blocking ordinary public browsing. Internal rosters, private group content and other people's household/sacramental records remain unavailable until independently authorized.

### S07.02

**Question:** Can someone be a full member of several parishes simultaneously, and does primary parish affect eligibility, notifications, records or only defaults?

**Proposed answer:** One account may hold approved membership in several parishes, with a separate office-reviewed person link in each. Primary parish selects personal defaults and prominence; it does not transfer records, override other parishes' rules or automatically subscribe the person to every group.

The combined view labels each item's parish and filters by relationship. Each request/payment/registration has one target parish. Changing primary parish must not move open work or end existing memberships. Parish-specific notification choices remain available. Potential duplicate/cross-parish identities require review; shared account identity does not expose one office's records to another.

### S07.03

**Question:** What evidence must the office check to approve a membership link, and how should it document verification without keeping unnecessary private evidence?

**Proposed answer:** The office checks applicant identity against the intended person using relevant supplied names, birth information, contact and existing invitation/record evidence. Display side-by-side proposed versus official facts and existing links; require an explicit verified-link decision by an eligible reviewer.

Keep verification method, reviewer, date and a minimal note, not unnecessary copies of identity evidence. Uploaded material is restricted and follows a separately approved retention schedule. Ambiguous matches remain pending for information. A matching surname, phone or email alone is not enough to link, and a requester cannot approve their own record association.

### S07.04

**Question:** When no matching person exists, should membership review allow creating one inside the review flow rather than leaving the queue and returning later?

**Proposed answer:** Allow **Create person for this applicant** inside membership review with duplicate/archive checks, the same person form and clear creation summary. Preserve the application context and return directly to its decision.

Creation and approved association should either complete together or leave a visible recoverable pending state; do not silently link a half-created/wrong person. Save uncertain information as provisional, with official-output gates intact. A staff member may instead select a verified existing record. Do not create a person automatically from signup or from merely following a parish.

### S07.05

**Question:** How should the office compare several possible person matches, detect an existing account link and correct a link made to the wrong person?

**Proposed answer:** Compare names in supplied scripts, birth date/precision, relationships, contact, locality, archive status and existing account links. Reveal only office-authorized fields. Treat likely matches as suggestions and require a chosen person plus verification note.

If already linked, block ordinary reassignment and offer a restricted dispute/review route. Correcting a wrong link requires independent review, impact summary, revocation of inappropriate future access and notification to affected accounts without disclosing another person's private data. Preserve both link histories and correct dependent associations deliberately; never erase or move official records as a side effect.

### S07.06

**Question:** When membership is declined, should a reason be required and visible to the applicant? Can they correct information and reapply?

**Proposed answer:** Declining membership requires a clear applicant-visible reason, separated from internal notes. Explain what evidence/correction could allow reapplication and provide a safe office contact. Sensitive fraud/conflict details remain restricted rather than copied into the public-facing reason.

Permit corrected reapplication linked to prior history, with duplicate pending requests prevented. An applicant may withdraw an undecided application. Office refusal does not delete their account or prevent public following. Send one outcome notification in the preferred supported language through available channels, without claiming external delivery that did not occur.

### S07.07

**Question:** How can a member leave a parish, unfollow it or change primary parish, and what happens to active requests, group roles and historic records?

**Proposed answer:** Unfollow and primary-parish changes are personal preferences; leaving an approved membership is a separate reviewed process because roles, groups and open work may depend on it. Show the consequences before submission.

Staff appointments require explicit resignation/revocation/handover rather than disappearing because Following was unticked. Open personal requests remain trackable to their authorized requester; registrations, payments and official history stay in the original parish. Stop optional future updates as requested while retaining necessary operational notices for unresolved work. Do not transfer household, ministry or sacramental records to a new primary parish automatically.

### S07.08

**Question:** Should existing person invitations bypass any membership steps, or must the office approve every claim? What does an already signed-in recipient experience?

**Proposed answer:** A person-specific office invitation can complete the already-reviewed account/person association once the intended recipient authenticates and confirms, provided no conflict or existing link appears. It does not bypass new checks if the invitation is stale, disputed or claimed by the wrong identity.

An already signed-in person sees the intended account and parish link before accepting; offer switch account without creating a duplicate. Invitation and membership history record the office's prior verification and actual claimant. No staff/ministry grant is bundled silently. Ambiguous claims return to office review.

### S07.09

**Question:** Which official fields may a person propose correcting, and which require office-only handling or documentary proof?

**Proposed answer:** Members may propose corrections to own ordinary identity/contact/address fields, occupation and preferred language; show which affect official records. Names, birth facts and relationship changes may require supporting evidence and appropriate review. Official sacramental facts, register numbers, clergy signatures and another adult's information are not editable profile fields.

Permit a clear **I need another correction** office request for locked/unsupported fields. Proposed login email/phone changes use account security separately. The form shows current versus proposed values and never updates the official source before authorized approval. Evidence is restricted to necessary reviewers.

### S07.10

**Question:** Should a correction be approved as one proposal or field by field? Can the office modify the proposed value, and must the applicant accept that change?

**Proposed answer:** Review proposed fields individually so an office reviewer may approve supported changes and return/decline unsupported ones with reasons. Show which related records might be affected; approved official documents retain their historical snapshot.

If staff propose a different value, record it as a counterproposal and ask the applicant to confirm where their consent/identity representation is relevant, rather than pretending they submitted it. Allow a single approve-all action only when every field is eligible and no self-approval/conflict exists. Record reviewer, original/proposed/applied values and actual decision time.

### S07.11

**Question:** While a correction waits, may the applicant withdraw or replace it? How should a staff edit to the same field be compared and resolved?

**Proposed answer:** Applicants may withdraw or replace pending proposals until review commits, preserving superseded versions. Prevent overlapping active proposals to the same field or show an explicit consolidated replacement.

On review, compare the source's current value against its submission snapshot. If staff changed it meanwhile, show before/submitted/current values and require a fresh decision; never silently overwrite. If the desired value is already present, resolve as no additional change with explanation. Recheck access and revision on every decision and notify the applicant of partial outcomes or requested clarification.

### S07.12

**Question:** How should My account, My profile and My parish records explain which information controls login, personal display, office contact and official certificates?

**Proposed answer:** Use clear explanatory labels: **Sign-in details** controls authentication/recovery; **Account profile** controls personal display/preferences; **My parish records** shows each office's official facts; **Official document details** are reviewed snapshots from approved entries.

A change in one area states whether any other area is affected; no automatic contact synchronization between login and office records. Show parish identity on each official record and correction proposal in the combined view. Keep historical certificates unchanged when an ordinary profile field is updated; route any needed reissue through its own authorized workflow.

## S08

**People records and individual profiles**

### S08.01

**Question:** Which categories of person belong in People: parishioners, visitors, children, nonmembers, non-Catholic spouses, clergy, deceased people and outside witnesses? Define their statuses.

**Proposed answer:** People may include members, applicants, visitors, children, clergy, nonmember spouses, guardians/witnesses and deceased/archived persons when operationally necessary. Separate relationship/category from lifecycle status: Active, Provisional, Deceased and Archived; approved membership is another fact.

Avoid a single Member status that falsely grants account access. External witnesses can remain limited reference entries rather than full community memberships. Each record belongs to a parish with provenance and permitted relationships. Deceased/archived status preserves official/financial links while affecting active communication and participation through reviewed rules.

### S08.02

**Question:** What is the minimum information needed to save a person? Should a record be allowed when the Arabic/English name, birth date, phone or address is unknown?

**Proposed answer:** Permit a provisional person record with a supplied name, parish, record purpose/source and sufficient information to distinguish it from known duplicates. Unknown birth date/contact/address and missing script variants remain explicitly Unknown/Not supplied; do not enter fake dates or placeholder phone numbers.

The current requirement for both English and Arabic should become an official-output readiness gate rather than preventing legitimate initial intake. Request needed names/evidence before final official entry/certificate approval. Flag incomplete identity in the profile and relevant workflow. Never invent French/Arabic transliterations to satisfy a field.

### S08.03

**Question:** What name structure is needed for daily work and official documents: given/family names, parents' names, birth surname and title? Confirm that automatic transliteration and Preferred Name remain excluded.

**Proposed answer:** Store supplied given/family names and approved official display names in required scripts, with parental names, birth surname/title only where the procedure needs them. Preserve original spelling and a source/reviewer for corrections. French and English may legitimately use the same supplied Latin spelling; they need not be invented translations.

Retain the decision to exclude automatic transliteration and Preferred Name as separate office concepts. Display names may be composed from verified fields without overwriting originals. Certificates use the approved record snapshot and selected approved language template, not a guessed transliteration of current profile text.

### S08.04

**Question:** How should approximate/unknown dates, people without phones and international contacts be entered? Should Lebanese phone formatting ever reject an overseas person?

**Proposed answer:** Support Exact date, Year only, Approximate and Unknown with precision preserved. Do not convert a partial date into an invented day/month. Eligibility needing exact age becomes a review requirement.

Allow No personal phone and a separately authorized household/guardian contact. Support international numbers with country code and local formatting hints; Lebanese prefix validation must not reject overseas contacts. Preserve original formatted input alongside normalized matching where appropriate. Missing contact prevents unsupported automated delivery but not a legitimate office person record. Display uncertainty plainly in exports and official review.

### S08.05

**Question:** Which address choices must be selectable, and what is the path for a town, sector or foreign address absent from the verified list?

**Proposed answer:** Provide verified locality selection with country, governorate/region, district, town and optional sector/address detail. Offer **Locality not listed / Foreign address** as a reviewable structured exception, preserving the submitted text instead of forcing a false nearest town.

Office users can request a shared locality addition through authorized geographic-data maintenance. Unverified entries remain labeled pending and are not silently standardized into another parish's location. Existing unsupported historic addresses are preserved until reviewed. Household default addresses and individual overrides remain distinguishable. Do not expose private residential addresses through public parish location search.

### S08.06

**Question:** Is collecting blood type, medical/allergy information, skills and occupation necessary? For each, specify the purpose, permitted viewers and visibility in ordinary profiles.

**Proposed answer:** Occupation/skills are optional for community participation and volunteering; show them only to authorized office/group users for that purpose. Blood type/medical/allergy information is optional, purpose-limited and visibly unverified unless actual provenance supports it; no clinical inference is made.

Medical/guardian alerts appear only to designated event/care staff who need them, not ordinary profile lists, directories, global search or broad exports. A member/guardian can request correction/withdrawal subject to required incident/history rules. Explain collection purpose and who can read it before saving. Omit fields whose purpose cannot be justified.

### S08.07

**Question:** What must appear in the profile header and default tab, and which of Family, Groups, Sacraments, Attendance, Giving, Activity, Notes, Files and Consent should each role receive?

**Proposed answer:** Header shows approved supplied names, parish, status, household link and relevant permitted contact. Default Profile presents ordinary facts and pending corrections. Tabs appear only with corresponding access.

Office users get Family, permitted Groups, request/preparation links, Files and Consent; clergy get authorized official-entry and pastoral tools. Finance users get only necessary donor/household context and giving rights; leaders receive their own ministry context, not all personal tabs. Members use a restricted own-record projection. Private Notes, Giving and sensitive Files never appear solely because someone can open People.

### S08.08

**Question:** When staff add someone to a group from a person form/profile, should this take immediate effect or go through leader/priest approval? Reconcile this with member-initiated applications.

**Proposed answer:** A person-profile group action starts the same membership workflow as a member application. Office staff may prepare a roster addition, but final addition follows leader/priest rules; a priest may approve directly. Show Pending membership rather than falsely counting an unapproved person as active.

Historic/imported rosters can be entered as reviewed existing membership with source and priest approval, not fabricated new applicant consent. Removing a roster member preserves attendance/history and respects the private departure process. A staff account needs a valid scoped permission; selecting a group checkbox must not assign leadership or bypass priest decisions.

### S08.09

**Question:** Which edits need a reason, supporting document or approval, and which fields become locked after use in an official entry?

**Proposed answer:** Ordinary phone/address/work preferences can be edited by permitted office staff with history; identity names, birth facts, guardianship and relationships may require reason/evidence/review. Members propose rather than directly apply changes.

Approved register entries, certificate snapshots, signatures, issued references and closed financial facts remain locked to their correction workflows. Profile changes do not rewrite historical official outputs. Show pending changes and their reviewer so staff do not submit parallel conflicting edits. Record source, actor, before/after and time without copying sensitive evidence into a general activity feed.

### S08.10

**Question:** What photo capture/crop/replace/remove experience is required, including consent, missing images and a recognizable fallback?

**Proposed answer:** Support optional upload/capture, preview, rotation, square crop, replacement and removal, with a readable initials fallback. State formats/size and avoid forcing a photo to create a person. Ask/record the approved basis for storing and separately publishing a recognizable image.

Private profile photos do not become website/media assets automatically. Staff with photo-edit permission can correct it with history; a member can request removal/correction. Old versions remain only where an approved retention purpose requires them, with restricted access. Capture/upload failure does not discard the rest of the person form.

### S08.11

**Question:** Which contact and directory consent choices are needed, what exact information do they cover, and who may record or withdraw consent on another person's behalf?

**Proposed answer:** Separate printed-directory opt-in, public photograph/publicity, optional external communications, event consent and representation permissions. Each records purpose/version, source, date and person/guardian giving it, with clear withdrawal.

A household contact cannot opt another competent adult into publication automatically. Guardians act only for their authorized child/dependent scope; formal representation requires its own evidence. Directory consent identifies exact fields disclosed. Optional communication withdrawal stops future sends without suppressing necessary case notices. Staff record paper consent as Paper received with provenance, not fake digital acceptance. Consent changes do not silently erase required official history.

### S08.12

**Question:** When opening a profile, which related actions should be available directly: message, invitation, new request, certificate, registration, household edit or private note? Specify role restrictions.

**Proposed answer:** Offer contextual actions according to permission and stage: office request/intake, invitation, household update, permitted event registration and in-app contact; priest review/official-entry/certificate actions; finance donor functions; leader functions for assigned groups only.

Private pastoral note creation stays clergy/author restricted. Show disabled actions only when an understandable prerequisite can be resolved, such as missing official entry; otherwise omit unauthorized controls. Before messaging/export/release, verify recipient/scope and disclose whether delivery really occurs. A person profile is a convenient entry point, not a way around the underlying workflow or role checks.

## S09

**Households, family relationships and representation**

### S09.01

**Question:** What defines a household for your parish: shared residence, family relationship, shared finances or another rule? How should extended families at different addresses be represented?

**Proposed answer:** A household is an office-managed current living/contact unit, not proof of legal guardianship, shared finances or automatic access to everyone's records. Extended family relationships can connect people across households without merging residences or permissions.

Store shared address/contact and optional offering-envelope association separately from kinship links. A family diagram represents recorded relationships rather than assuming a surname or address establishes parentage. Public/member access is limited to legitimately permitted details; an office household association is not a national family database visible to all parishes.

### S09.02

**Question:** Is one current household per person sufficient for separated parents, shared custody, students away from home and members living abroad?

**Proposed answer:** Retain one primary administrative household per person for address/directory/envelope organization, while allowing explicit guardian/relationship and secondary-contact/residence notes for shared custody, students and overseas members. These links must not automatically expose another household's data.

When a case cannot be represented accurately, use a reviewed relationship record rather than duplicate the person or force a false residence. Explain the primary household's administrative purpose. Guardian authority, consent and delivery address are selected for the actual request/event and can differ from the primary household contact. Detailed secondary-residence support is a proposed extension, not a current capability claim.

### S09.03

**Question:** Is “household head” the right label, or should the interface use household contact? What authority, if any, does that designation confer?

**Proposed answer:** Use **Household contact** in ordinary UI. If official local practice requires Head of household, retain it as a separately explained designation. Neither label grants authority to edit another adult's identity, read their giving/messages, collect certificates or consent to publicity.

The contact receives only communications agreed for the household purpose. Staff can designate/change contact after confirming the people involved; a contact change is not a change of parentage. Permissions for guardians and representatives are explicit and record-specific. Official documents use the approved relationship facts, not this administrative label.

### S09.04

**Question:** Which relationships must be represented, including step/adoptive parents, guardians, deceased relatives, siblings and unrelated residents? Which should remain private?

**Proposed answer:** Represent parents/children, spouses, siblings, step/adoptive relationships, authorized guardians, deceased relatives and unrelated residents with links to specific people and a relationship source. Allow Unknown/Not recorded rather than assumed ancestry.

Sensitive guardianship/adoption/custody details have restricted visibility and never appear in public/ordinary printed directories by default. A recorded relationship is not automatic authority over account or documents. Cross-household links are permitted but reveal only authorized detail. Historic relationships remain dated where necessary; ending co-residence does not erase kinship or rewrite official sacramental snapshots.

### S09.05

**Question:** How should users enter a relationship to a specific person and resolve missing, conflicting or circular relationships in the family diagram?

**Proposed answer:** Let staff select relationship type and related person with a preview of resulting family layout. Validate impossible/circular parent links and clearly flag ambiguity, duplicate relationships or missing parents. A sibling marker can indicate that parents are not recorded rather than inventing them.

Do not infer relationships solely from surname. Corrections show old/new links and affected people, with reason/source where sensitive. A member proposes changes for review. The diagram needs an equivalent accessible list of relationships, including unknowns, and must not reveal restricted facts through tooltips or downloaded images.

### S09.06

**Question:** When changing the household head/contact, should all relationships remain as currently documented, and what comparison should be shown before saving?

**Proposed answer:** Changing household contact/head preserves person-to-person relationships and official history. Show old/new contact, who will receive shared communications and any address/default changes separately. Do not recalculate everyone's relationship merely as a relationship to the new head.

Require the new contact to be a valid current household person or an explicit reviewed representative contact. Staff review affected communication/envelope settings without granting private-data access. Existing documents retain their original relationship snapshot. Keep actor/time/reason and a correction path for a wrong designation.

### S09.07

**Question:** Which address/contact fields are shared, and how should individual overrides and a household move affect each member's record?

**Proposed answer:** Store a shared household address/contact as a default, with explicit individual overrides and preferred contact rules. Before a household move, preview members inheriting the address versus those retaining a separate address, plus affected future mail/contact uses.

Never overwrite personal phone/email/login identities from a shared contact change. Preserve address history where operationally required and the original address on issued documents. A move across parish boundaries does not transfer membership or sacramental records. Notify people only through permitted channels; sensitive location changes may need restricted review and suppressed broad announcements.

### S09.08

**Question:** Can any household adult request a sacrament or certificate for another adult, or is explicit authorization needed? Household membership alone may not establish permission.

**Proposed answer:** A household adult may help initiate a request, but submitting for another competent adult requires explicit authorization or an office-reviewed representation basis. Household membership alone is insufficient for access to private records or certificate release.

The request records subject, requester, relationship and the verification needed; do not display every household adult's official details just to choose a subject. Guardians can act for an authorized child/dependent within their verified scope. The priest/office can seek confirmation before processing sensitive work. Preserve applicant and subject identities separately throughout approval and collection.

### S09.09

**Question:** What must a guardian see/manage for a child, and when should the child's own account take over those responsibilities?

**Proposed answer:** Verified guardians can manage specified child's requests, event registrations, consent and collection arrangements, with purpose-specific visibility. They do not receive the child's unrelated private conversations/concerns merely through household membership.

When a child becomes eligible for their own account, office review links that account without deleting historic guardian actions. Proposed transition to adult autonomy ends routine guardian access at the policy-approved age/status, while retaining any separately verified representation. Explain the change beforehand and handle disputed guardianship privately. The applicable ages, evidence and exceptional arrangements require domain/policy approval rather than inference.

### S09.10

**Question:** How should joining, splitting, merging or leaving households preserve previous relationships, consent, giving and open requests?

**Proposed answer:** Use guided join/split/merge/leave actions with a preview of people, shared address, contact and envelope consequences. Preserve relationship/history links, individual consent and all official/financial references. Reassign future responsibility explicitly rather than transferring private account data.

Prevent a person being silently duplicated across active households. A split may create new household identifiers; old gifts remain associated with the historical household/envelope. Open requests keep their original requester/subject and request-specific authorized contact until reviewed. Sensitive household changes require restricted notes and must not generate general ministry/public announcements.

### S09.11

**Question:** Confirm the optional household envelope identifier: who assigns it, how uniqueness is checked, and what happens when the household splits or the identifier changes?

**Proposed answer:** Keep an optional manually assigned household envelope identifier, unique within the parish's applicable envelope scheme, with clear duplicate checking. Do not auto-generate one merely because a person or gift is created.

Retain dated identifier history so an old envelope still matches the correct historic household. For splits/merges, review whether a new identifier is needed and prevent unsafe reuse. Historical contributions and receipts do not move to every person in the household. Unknown/blank envelopes can be counted without invented attribution and later reconciled by authorized finance review.

### S09.12

**Question:** What should household cards, the diagram, printed directory and selected/filtered exports include? Should restricted relationships or nonconsenting members be omitted from each?

**Proposed answer:** Staff household cards/diagrams show only fields their role may read, with accessible relationship lists and export previews. Selected exports contain the explicitly selected households; filtered exports include all authorized matches, not only the current page.

The printed public/parish directory includes only individually permitted opt-in fields and people, excluding restricted relations, medical/guardian details and nonconsenting members. Operational staff exports follow purpose/permission rather than blindly using directory consent as a universal access rule. Show language/script, date/scope and exact columns before download. No household contact grants blanket permission to export another adult's private records.

## S10

**Import, duplicate review, archive and historical records**

### S10.01

**Question:** Which records must be brought in before launch, from which real formats and with what approximate volume? Include paper registers and previous spreadsheets if applicable.

**Proposed answer:** Inventory each parish's people/households, clergy/ministry rosters, historical sacramental entries, registrations, bookings, finance and documents before importing. Accept reviewed CSV/XLSX for structured data and approved scanned evidence; paper transcription is a separately reviewed historical-entry process.

Each import identifies parish, source owner/date, record type, field mapping and provenance. Actual file volumes/years must be supplied by the two offices; do not assume sample data represents production. Stage imports privately until validation and authorized reconciliation, and keep the original source securely for the agreed review/retention period.

### S10.02

**Question:** Who maps source columns, previews data, confirms import and resolves invalid rows? Should a partially valid file be imported in parts or rejected as a whole?

**Proposed answer:** A scoped office/import administrator maps columns using an approved template, previews normalized results, matches identities and resolves row-level errors. Clergy/finance reviewers approve their respective official/financial imports; ordinary import permission is not signing authority.

Validate the whole file before writing. Default to no partial commit; if the reviewer deliberately imports valid rows only, show exclusions, counts and a follow-up issue list. Imported identifiers and source-file references prevent accidental repeated import. Recheck current records before commit, report outcomes and provide a controlled rollback/correction plan rather than deleting unrelated later work.

### S10.03

**Question:** How should import handle missing translations, unsupported localities, inconsistent dates, phone formats and consent that is absent or undocumented?

**Proposed answer:** Missing translations remain Not supplied and block only outputs needing them; uncertain dates preserve precision and unknown contacts/consent are not fabricated. Preserve unsupported locality text as Unverified pending geographic review.

Phone/date/currency normalization is previewed with original values, and ambiguous date ordering requires a choice rather than guessing. Missing consent remains Unknown, never default Yes; relevant publication/event actions remain blocked or routed for review. Record source confidence so staff can distinguish verified facts from imported assertions. Do not claim an imported contact was externally verified.

### S10.04

**Question:** What identifies a likely duplicate, and which facts should reviewers compare before concluding two records represent the same person?

**Proposed answer:** Suggest duplicates using multiple permitted signals: supplied names in scripts, birth facts, parents/household, contact, locality and prior identifiers. Exact surname or shared family phone is never proof. Show why a candidate matched and where values differ, including archive/account-link status.

Reviewers compare appropriate evidence and choose Same person, Different people or Need information. Keep the match pending when uncertain; do not automatically merge during signup/import/request acceptance. Sensitive match evidence is available only to the necessary staff. A reviewed dismissal should suppress the same unhelpful suggestion unless new evidence changes it.

### S10.05

**Question:** Who may merge records, and how should the UI resolve conflicting fields, household/group links, account links, sacramental entries and financial history?

**Proposed answer:** Restrict merges to explicitly authorized office administrators with priest review where sacramental identity is involved and finance review where financial attribution changes. Preview both records, selected surviving fields, account links, household/group memberships, official entries and payment history.

Keep source identifiers/aliases and before/after snapshots. Conflicting account/person links require separate identity review. Official entries and closed finance records remain individually traceable; merging people does not rewrite their signed snapshots or combine different celebrations. Require a reason and supported field-by-field resolution, never automatic latest-value wins. Notify affected account holders through permitted routes.

### S10.06

**Question:** Must an incorrect merge be reversible? What should the pre-merge impact summary and subsequent history contain?

**Proposed answer:** Make a merge reversible through a reviewed unmerge/correction process with preserved source records, relationship changes and dependency history. Preview what can safely be restored and identify later requests, approvals or payments needing separate review.

Before merge, show field conflicts, reassigned links and records that remain immutable. Afterward retain actors, reason, source/survivor IDs and timestamps. Do not promise one-click rollback after later official actions have depended on the merge. Suspend unresolved identity-dependent releases and route them to authorized review rather than deleting issued history.

### S10.07

**Question:** Which person statuses require archiving rather than ordinary editing, and what should happen to accounts, rosters, pending requests and scheduled reminders?

**Proposed answer:** Use Deceased, Inactive and Archived distinctly. Death is a verified person fact; archive removes a record from ordinary active lists; inactivity may only reflect participation. A move or absence is not deletion.

Preview effects on rosters, invitations, commitments, account links, reminders and open work. Ending a staff appointment separately revokes authority. Personal account deactivation requires its own justified process. Keep sacramental/financial history and authorized request tracking. Stops to optional outreach and assignment need review; do not silently cancel paid bookings or erase complaints because a person was archived.

### S10.08

**Question:** How can a permitted user find and restore archived people while avoiding duplicate recreation during signup, membership or child-request review?

**Proposed answer:** Provide an authorized Include archived search/filter and show archive status in duplicate checks, membership review, person invitations and child-request matching. Ordinary users must not browse archived identities.

Restoration requires confirmation of the same person, reason and review of current household/contact/account links. Reactivation does not automatically restore expired staff assignments, old marketing consent or group membership. A suspected archived match blocks duplicate creation until resolved or an authorized Different person decision is recorded. Preserve the original person identifier and history when restoration is legitimate.

### S10.09

**Question:** What should happen when someone relocates to another parish, given that the transfer workflow was removed? Confirm the intended office procedure and record visibility.

**Proposed answer:** Keep the removed automatic transfer workflow excluded. A person moving parish can follow/request membership at the new parish, whose office performs its own identity review and person link.

Historical official records stay with the original parish/custodian; current membership or household departure is handled separately. Supply an approved certificate/reference or individually authorized evidence where required, not a bulk export of the old person's private profile. One account may link to both parishes while their office data remains independently scoped. Changing primary parish is not a record transfer.

### S10.10

**Question:** How should historical sacraments entered after the fact differ from newly celebrated ones, including source evidence, original dates, celebrants and register numbering?

**Proposed answer:** Historical entry records original celebration date/precision, source parish/register/book/page/reference, celebrant as originally known, evidence and transcription/reviewer information. Distinguish **Historical entry recorded on [actual entry date]** from a newly scheduled celebration.

External sacraments are verified references, not falsely numbered new local celebrations. Priest approval confirms the transcription/source under the approved historical workflow; missing facts stay unknown. Original numbers are preserved where valid and distinguishable from current system references. Never backdate the system audit to make late entry look contemporaneous.

### S10.11

**Question:** Which legacy items need a visible “requires review/linking” state before use, such as unlinked event forms or older certificates? Who completes that work?

**Proposed answer:** Flag unlinked registration/check-in items, ambiguous person/account links, unsupported localities, incomplete historical entries and certificates lacking new metadata as **Needs review** with a specific next task. Authorized office, clergy or finance owners handle their domain.

Block only the unsafe dependent action, not all historical reading. Legacy event forms cannot accept new participants/check-in until linked and reconciled. Existing issued certificates remain identifiable under the legacy policy rather than being silently invalidated. A remediation queue records resolved evidence, reviewer and counts; no mass migration should invent consent, approval or event links.

### S10.12

**Question:** What migration preview, reconciliation totals and approval are required before staff trust imported/historical data as official?

**Proposed answer:** Before activation of imported official data, show source count, accepted/rejected/duplicate/unchanged rows, totals by parish/type/status/currency, relationship/link issues and representative document comparisons. Explain every unmatched difference.

Office owners approve people/household/roster reconciliation; priests approve sacramental identity/register comparisons; finance owners approve balances/payment mappings. Developers validate import behavior and scope isolation. Keep a signed-off migration report, source references and recovery plan. No unexplained totals, unverified official numbering or unresolved account mislinks should be presented as production-trusted records.

## S11

**Request intake, office queues and guest tracking**

### S11.01

**Question:** Which request types should exist at launch, and which should be structured forms versus a general “Ask the parish” request? Include appointments, ministry inquiries, Mass intentions and visits.

**Proposed answer:** Launch structured intake for supported sacraments, certificates, facilities, priest appointments, Mass intentions, blessings/visits, ministry inquiries and general requests. Use conditional type-specific fields; retain a free-text **Something else** route.

A ministry inquiry is not a formal roster application, and an appointment/time preference is not a confirmed booking. Explain eligibility, required later evidence and target parish. Keep all configured existing types discoverable without exposing unsupported jurisdictional options. Service definitions are maintained by authorized parish/diocese owners, with EN/FR/AR labels and consistent applicant timelines.

### S11.02

**Question:** Should guests and linked members provide the same core information for the same service? If guest intake stays simpler, who obtains the missing details and where are they entered?

**Proposed answer:** Guest/member forms collect the same minimum facts for the same service, while members prefill only permitted verified person/household data. Guests need contact/relationship details and may supply additional facts later rather than being forced to know internal record identifiers.

If initial guest intake is shorter, create **Needs information** tasks in the same case and let the applicant/office complete the structured missing fields. Office preparation records provenance, not a second unrelated request. Both routes retain applicant identity separate from subject and use the same priest/approval gates before official processing.

### S11.03

**Question:** Can an unlinked account submit through its account rather than returning to the public guest form? What advantages or restrictions should that account receive?

**Proposed answer:** An unlinked signed-in account can submit a supported guest-style request inside its account, with own tracking and contact preferences, instead of being forced to log out. Clearly explain that office identity/person matching remains pending.

Do not expose household subject selection or official records before approved linking. The case retains the authenticated requester and supplied subject facts, then gains reviewed links without losing history. Login does not approve membership or sacramental eligibility. Repeated submission should detect an existing own pending case and offer its status rather than create another copy.

### S11.04

**Question:** Who may submit for someone else, and how should relationship/authorization be confirmed? Include children outside the household, another adult, a deceased relative and an overseas requester.

**Proposed answer:** Record requester, subject, claimed relationship and required authority separately. A verified guardian may act within their scope; another adult requires explicit authorization or a reviewed representative basis; a funeral request identifies the authorized family/contact rather than assuming all relatives share access.

Allow overseas requesters with international contacts and practical collection/download arrangements. Unverified representation can be received for office review but blocks sensitive disclosure/release. Do not reveal a household member's full records merely to name a subject. Store minimal evidence of authority and let clergy/office resolve exceptional cases privately.

### S11.05

**Question:** Should office staff enter telephone/in-person requests into the same intake flow, identifying their origin and requester, or create the office record directly?

**Proposed answer:** Staff may enter telephone, paper and in-person submissions through the same canonical intake, recording origin, actual requester/contact, subject, received date and entering account. Clearly distinguish staff-recorded statements from applicant-authenticated submission/consent.

Direct office creation is allowed when it produces the same linked case/history and prerequisites, rather than an invisible parallel route. A priest may receive/accept a case directly; office staff preparation does not become independent clergy approval. Scan/record paper evidence through its proper requirement and mark actual receipts. Submission success is recorded only after the case genuinely saves.

### S11.06

**Question:** What should submission show before the final action: parish, subject, required documents, expected review time, fees, privacy and a reviewable summary?

**Proposed answer:** Review-and-send shows parish, type, subject/requester, proposed dates, contact, supplied fields/documents, collection/delivery preference, actual fees/offering information if approved, and outstanding physical steps. Explain data visibility and the difference between request receipt and confirmation.

Let applicants edit before final submission and show field errors without losing values. State review expectations only where the office has a real monitored target; urgent routes provide maintained direct contact. Consent/representation/publicity are separate choices. Final success gives a unique reference and actual tracking access, not a false confirmed celebration or delivered external message.

### S11.07

**Question:** Should all request types share one reference, timeline and conversation from intake to completion, including guest-to-office conversion, or should linked references remain visible?

**Proposed answer:** Use one stable case reference, timeline and communication thread from intake to closure. Linked sacramental, register, certificate and reservation identifiers remain visible as related official/operational references; do not replace the applicant's known reference.

Convert accepted intake into linked office records with idempotent creation and canonical next-step counts. Keep origin/requester, received evidence and applicant-visible messages. Other offices cannot inherit the case through a parish filter change. Distinct separate requests stay separate but can be deliberately related; a shared family/event does not justify merging their authority or files.

### S11.08

**Question:** What office triage information is needed: urgency, deadline, assigned person, missing information, last contact and current next action? Who may change each?

**Proposed answer:** Triage captures type/stage, urgency with reason, received/deadline/preferred dates, parish, subject, assigned person/team, missing information/documents, last applicant contact and next action/authority. Distinguish overdue from a future planned celebration.

Eligible office staff can assign preparation and update factual follow-up; priest decision ownership/authority follows appointments and delegated case instructions. Staff cannot change priority to bypass mandatory approval. Changes remain audited, with internal notes separated from applicant responses. Unassigned work appears to the eligible office/lead rather than disappearing because no secretary exists.

### S11.09

**Question:** How should the office request more information without declining the request? Can applicants edit fields, add documents or reply while it waits?

**Proposed answer:** Add **Needs information** without declining. Specify each requested correction/document, recipient, due expectation where real and which submitted fields may be revised. Applicants reply/upload through own account or private tracking; staff can enter paper/telephone responses with provenance.

Keep original submission and versioned changes. Lock already approved official facts to correction workflows rather than reopening them casually. Notify the responsible team when a complete response arrives and show applicant waiting/answered states. Missing-information reminders require actual delivery capability and must not expose private content in general notifications.

### S11.10

**Question:** What distinguishes received, accepted for processing, clergy-approved, scheduled, completed and ready for collection in the applicant's language?

**Proposed answer:** Use distinct applicant wording: **Received** means saved for review; **Accepted for processing** means the relevant authority accepted the work; **Approved by priest** identifies a clergy decision; **Date confirmed** means the scheduled commitment is real; **Completed** means the service/entry's completion criteria are met; **Ready to collect/download** means a reviewed releasable output exists.

Display the current next step, responsible role and actual timestamp in EN/FR/AR. A secretary-recorded priest instruction is already effective approval, not awaiting online repetition. An official entry and a separately requested certificate have distinct completion states; bishop review, where required, delays release appropriately.

### S11.11

**Question:** Until which stage can applicants edit or withdraw a request? After acceptance, should they request cancellation/rescheduling, contact the office, or perform a direct action?

**Proposed answer:** Before office handling, applicants can revise permitted intake fields or withdraw with confirmation; retain the original version/history. Once accepted or resources/approvals depend on it, use a cancellation/rescheduling request rather than unilateral edits to confirmed facts.

Show consequences for dates, payments, other participants and documents. Office/clergy handles the change under its stage rules and notifies the applicant. Withdrawn intake cannot later be accepted without deliberate reopening/reapplication. Completed official records are not cancelled by an applicant button; disputes use correction/review. The UI states which changes require office contact.

### S11.12

**Question:** Which decisions require applicant-visible reasons, and how should internal staff notes be visually separated so they cannot be accidentally sent?

**Proposed answer:** Decline, cancellation, return for information, rescheduling refusal and any applicant-impacting partial decision require an understandable visible explanation and next action. Avoid publishing sensitive accusations or third-party facts in that reason.

Use separately labeled **Message to applicant** and **Internal staff note** fields with audience preview before sending. Never reuse one textarea with an obscure visibility toggle. Histories show which comments the applicant received. Corrections to a sent explanation add a follow-up rather than silently rewriting it. Proxy approval instruction notes remain internal, including on printed official paperwork.

### S11.13

**Question:** How should duplicate submissions, wrong-parish requests and an office acceptance made in error be handled without losing the request history?

**Proposed answer:** Detect likely duplicates and offer linking/continuing an existing own case, with staff-reviewed merge only where subjects/purpose truly match. Preserve all references/origins and avoid duplicate downstream records.

Wrong-parish cases are returned with contact guidance or explicitly reassigned through an authorized, applicant-informed process; private records do not transfer from a selector change. An acceptance entered in error receives an attributed correction/return/suspension with reason and review of dates/payments/files already affected. Never erase an issued official entry to hide the mistake. Recheck current state before retrying an interrupted decision.

### S11.14

**Question:** What should the guest success/tracking page show, and how can a guest recover a lost link, revoke a leaked link, receive updates and later link the request to an account?

**Proposed answer:** Success/tracking shows reference, target parish, type, supplied subject summary, status/next action, published office replies, required information and specifically released files. Explain that the private link grants limited access and should not be publicly shared.

Lost-link recovery uses verified contact or office identity review; do not issue a link solely from name/reference. Revocation/rotation invalidates future use of the old token and retains audit. Account association requires signed-in ownership plus office review before authenticated details appear. It creates no membership/staff access. Updates use actually configured channels and keep sensitive details out of notification subjects.

### S11.15

**Question:** Who owns overdue or unattended requests, what review times can the interface honestly promise, and how should applicants and staff escalate a delay?

**Proposed answer:** Each case has an accountable office/team and escalation owner; no-secretary work defaults to the priest or appointed office administrator. Monitor genuinely agreed review targets by request type/urgency and show received/last-update dates rather than invented universal promises.

Overdue work escalates to the designated lead, then appropriate priest/diocesan authority where necessary, preserving scope and privacy. Applicant status offers a real contact/follow-up action. Urgent pastoral needs include direct maintained contact and do not rely on unmonitored automation. Case reminders and escalations must have a real runner or a clearly assigned manual worklist.

## S12

**Sacramental lifecycle and official register approval**

### S12.01

**Question:** Confirm the exact lifecycle for each sacrament, including whether office review is optional and whether a priest can bypass it without a separate explanation.

**Proposed answer:** Use Received → optional office review → priest acceptance → Preparation → confirmed scheduling → celebration confirmed → official-entry review → Registered, with Needs information/Returned, Declined and Cancelled branches. Certificates use their separate lifecycle.

The priest may accept directly without waiting for optional office review; retain which steps happened rather than pretending a review occurred. A secretary may record the priest's already-given instruction for the exact authorized decision stage, preserving both identities under S02.07. This does not waive mandatory documents/celebration evidence or authorize signatures. Rite-specific approved procedures determine which preparation steps apply.

### S12.02

**Question:** What should priest acceptance mean operationally: permission to start preparation, eligibility confirmed, date reserved, or a different commitment?

**Proposed answer:** Priest acceptance authorizes beginning the approved preparation process for this case after the level of eligibility review required at that point. It is not proof every document is verified, a room/date is reserved, a celebration occurred or an official entry is registered.

Show those facts separately in the timeline. Accepted cases may still await evidence/formation/date. The acceptance action identifies priest, conditions and next tasks; a secretary-recorded prior acceptance has the same effect with explicit internal attribution. Further final approval needs its own case-specific instruction and completed prerequisites.

### S12.03

**Question:** Which preparation requirements are mandatory, which are optional, and who may configure or waive them? What should a waiver record and display?

**Proposed answer:** Version preparation requirements by approved sacrament/rite/diocese: required, conditional and optional, with evidence source, due stage and responsible verifier. Clergy/authorized policy owners approve templates; office staff maintain permitted data, not ecclesiastical requirements.

A waiver is available only for requirements the authority permits waiving and records priest/competent approver, specific requirement, reason, evidence and time. It must be visibly Waived, not falsely Complete. Nonwaivable prerequisites remain blocked. Existing cases retain their applied requirement version or receive an explicit reviewed migration, never silent template changes. Actual checklists need approved domain input.

### S12.04

**Question:** Must all required preparation be complete before selecting a date, before marking Scheduled, or only before celebration? Distinguish a tentative date from a confirmed date.

**Proposed answer:** Allow a clearly **Tentative date preference** during preparation and a separately confirmed resource/clergy hold where policy allows. Mark **Scheduled/confirmed** only after the required pre-scheduling checklist and approvals are satisfied. Unmet celebration-stage conditions remain visible and block celebration/official approval as applicable.

Distinguish tentative applicant preference, temporary facility hold and confirmed celebration so calendar/public notices do not imply approval. Requirement-stage definitions come from the approved template; urgent funeral procedures use their own appropriate checklist, not an undocumented bypass. Rescheduling rechecks resources and notifies affected parties.

### S12.05

**Question:** Should date, time, church/room, celebrant and relevant family availability be checked together against calendar and clergy conflicts? Who can authorize an exception?

**Proposed answer:** Check date/time, venue/setup, celebrant assignment and relevant linked schedules together before confirmation. Collect applicant availability as preference, not a guaranteed simultaneous-person scheduling service. Exact overlaps of exclusive resources/clergy block ordinary confirmation.

An authorized priest/resource authority may resolve conflicts by changing time/venue/celebrant or using a specifically permitted exception; never approve impossible physical double-booking by a generic override. Record reason and any affected existing commitment. Recheck at commit because availability can change after form opening. Public event visibility remains separately approved and privacy-filtered.

### S12.06

**Question:** How should a group celebration containing several people be entered, prepared and approved while preserving separate individual official entries?

**Proposed answer:** Link a shared celebration/event to separate individual cases. Shared date/place/celebrant and group formation can be recorded once, while each person has their own identity, evidence, consent, preparation, decision and official number.

Review an individual readiness matrix; one incomplete participant does not falsely complete every case. A priest's group instruction must enumerate the eligible cases/stage, with per-person history if recorded by a secretary. Individual cancellation or correction preserves other participants. Group attendance is not proof the sacrament was celebrated for every listed person; confirm actual participants before official-entry approval.

### S12.07

**Question:** Who confirms that a celebration occurred, what facts must be checked, and what should happen for a no-show, changed celebrant or changed celebration time?

**Proposed answer:** Authorized office/clergy records the actual celebration facts: participant, date/time/place, celebrant and required witnesses/details, with source and entering account. The priest reviews them before official registration; factual office entry is not independent clergy approval.

No-show remains uncelebrated and moves to rescheduling/cancellation review. Changed time/celebrant is corrected with actual facts and linked calendar history before submission. Future dates cannot be represented as already celebrated. A priest instruction to accept a request is not instruction to confirm a later celebration; each consequential stage requires its own basis.

### S12.08

**Question:** What must a priest compare before approving an official entry, and can they return it for correction instead of rejecting the underlying request?

**Proposed answer:** Priest review compares verified person identity, actual celebration, celebrant, approved required fields/evidence, book/page/reference, duplicates and the source paper record where required. Show the proposed official document/entry and differences from earlier versions.

Provide **Return for correction** distinct from Decline request. Office staff fix permitted draft facts and resubmit with a change note; preserve prior snapshots. Approval assigns the official number only once and locks official fields. A secretary records a prior priest approval only if that exact stage/case was authorized and all required facts are present; signature remains separate.

### S12.09

**Question:** Define official numbering: scope by parish/sacrament/year/book, when allocated, treatment of gaps, historical numbering and whether it may ever be changed.

**Proposed answer:** The competent diocesan/parish authority supplies the actual numbering scheme, scoped by parish/register/sacrament/year/book as approved. Allocate an official number at final registration, not initial intake, with a distinct stable request reference before then.

Prevent duplicate allocation even during concurrent approvals/retries. Never reuse or renumber an approved number silently; retain void/gap explanations where applicable. Book/page are actual register facts, not arbitrary generated replacements. Historical imports preserve legitimate original numbering with provenance; external references stay external. The format/prefix/start values require real register policy, not sample-derived national assumptions.

### S12.10

**Question:** If an approved official entry contains an error, what is the authorized correction process? Confirm whether an in-app correction flow should return or remain an office procedure outside the current UI.

**Proposed answer:** Provide a restricted **Request official correction** route because a nationwide system needs a traceable way to resolve errors even though older correction screens were removed. Keep the original approved entry, proposed correction, evidence, priest/competent approval, reason and effective revision.

Do not edit registered facts through an ordinary profile form. Review affected certificates and issue replacements/revocations where necessary without rewriting past downloads. If policy requires an external paper correction, record that authorized procedure and its result. Restore an in-app review interface only after domain approval of its exact permissions; server capability alone is not an approved workflow.

### S12.11

**Question:** How should cancellation, rejection and reopening work at each stage, especially after celebration or official registration? Which actions must be impossible?

**Proposed answer:** Before celebration, allow priest-authorized decline/cancellation/rescheduling with applicant-visible reasons and explicit effects on dates, preparation and fees. Office users may request/prepare the change; secretary-recorded priest instructions remain case/stage-specific.

After celebration, do not mark the historical event unperformed merely to cancel paperwork. After registration, use official correction/void procedures approved by the competent authority, preserving numbers and evidence. Reopening requires reason, current eligibility and a fresh action history; it must not duplicate the original celebration. Never delete registered entries or erase declined/cancelled history through a normal undo.

### S12.12

**Question:** Approve the numbered progress timeline: finished/current/future steps, timestamps, waiting duration, planned date, responsible person/role and what each audience may see.

**Proposed answer:** Show numbered finished/current/future steps, completed actor/authority and actual timestamps, current waiting-since duration, next responsible role and planned versus actual celebration time. Returned/reopened branches remain visible without making prior completed actions disappear.

Applicants see their permitted progress, requested information and public responses. Office/clergy sees detailed preparation/history; proxy entry identifies secretary and priest internally. Printed official paperwork displays the priest's name, not secretary audit attribution. Unavailable future outcomes are not marked complete. Local-time displays identify the relevant parish zone where cross-border viewing could confuse dates.

### S12.13

**Question:** Should Requests remain the main way to find official entries, or is a dedicated searchable register needed? Decide how book/page/year searches and complete register exports should work.

**Proposed answer:** Keep Requests as the main operational queue and completed-case history, with person-profile Sacraments access. Add a read-only register report/search view under authorized Records/Reports for sacrament, name, official number, year/book/page and date range; do not create a competing editable register list.

Exports clearly select all approved authorized entries or an explicit filtered scope, independent of visible pagination. Include provenance/precision for historical records and exclude drafts. Completed requests link back to official entries/certificates. This preserves simple office navigation while satisfying register retrieval without implying ordinary edit/correction permissions.

## S13

**Details and exceptions for each sacrament and service**

### S13.01

**Question:** For baptism, which child/adult, birth, parent, guardian, godparent, address and eligibility details are required at intake, preparation and official entry respectively?

**Proposed answer:** Intake captures subject's supplied names, birth date/place/precision, child/adult path, requester/relationship/contact, parents/guardian as known, parish and preferred date. Preparation adds verified identity/birth evidence, actual guardian authority, proposed godparents and the approved rite-specific eligibility/formation evidence.

The official entry adds actual celebration date/place, celebrant, approved parents/godparents/witness fields and register reference. Unknown/not applicable values are explicit and reviewed before official output, not fabricated. The bishop/priest supplies the real checklist and any required declarations; this specification defines data stages without inventing sacramental eligibility rules or demanding irrelevant fields from every family.

### S13.02

**Question:** When a baptism concerns an unregistered child, who may create/match their person record and choose the household? What should happen if an archived or ambiguous match exists?

**Proposed answer:** Office staff compare the child's supplied names, birth facts, parents/guardian, household and archive candidates before creating a person. Show exact/likely matches with evidence and preserve requester separately. An archived likely match routes to restoration/identity review, not automatic duplicate creation.

Creating a provisional person and linking the case should be one coherent reviewed flow. Household addition requires verified relationship/current residence and does not assume the requester's household is correct. Clergy approval remains separate. Ambiguous matches stop identity-dependent official approval/release while allowing safe follow-up for evidence.

### S13.03

**Question:** For adult baptism or a person with incomplete parental information, which fields and preparation differ, and how should the form avoid impossible required fields?

**Proposed answer:** An adult-baptism path asks the applicant directly for their own identity/contact, relevant prior sacramental information and the approved adult preparation process. Child-specific guardian/parent requirements appear only where applicable.

Allow Unknown, Not applicable or restricted explanation for incomplete parental facts; require competent clergy review of official-field exceptions rather than impossible form validation. Preserve original supplied names and evidence. Any eligibility concern is reviewed by clergy, not inferred by software. Do not invent parent identities or apply a child's checklist simply because the underlying sacrament type is the same.

### S13.04

**Question:** For First Communion, what prior records, age/formation evidence and group preparation must be checked? Can applicants provide evidence from another parish?

**Proposed answer:** First Communion preparation records the verified subject and required prior sacramental evidence, approved formation/catechism completion, responsible group/instructor and priest review. The actual age/formation prerequisites come from the competent authority, not a hard-coded nationwide assumption.

Accept evidence from another parish/country as an external source pending verification, with issuer/date/reference and reviewer. Group preparation can support individual requirements without automatically approving everyone. Duplicate checks distinguish an already recorded celebration from a planned request. An applicant missing local records receives a verification task rather than an automatic refusal.

### S13.05

**Question:** How should confirmation/chrismation vary by rite and its relationship to baptism? Which terminology, separate records and request options should be shown?

**Proposed answer:** Configuration must distinguish confirmation/chrismation terminology and its approved relationship to baptism for the relevant rite. Some workflows may record associated celebrations together while retaining separate official facts where required; others use separate requests/preparation.

Show only the approved options for the parish and preserve the rite/version on historical records. Do not label one tradition's sequence as universally required or create a second sacrament merely from a naming difference. The bishop supplies approved requirements, templates and anniversary rules; unsupported combinations route to clergy review rather than silently choosing from sample data.

### S13.06

**Question:** For marriage, what information is required for both partners, their parishes, witnesses, prior records and preparation? Can one partner be outside the local people database?

**Proposed answer:** Capture both partners' supplied official names, identity/birth facts, current parish/contact, relevant prior sacramental/civil or ecclesiastical evidence required by policy, preparation, proposed date/location, celebrant and witnesses. Keep each person's privacy/authorization separate.

An outside partner may be an external participant/reference or reviewed local provisional person; do not grant membership or duplicate a person just to complete a form. Clerk preparation can collect evidence, while priest/competent authority evaluates eligibility and external permissions. Both partners' confirmed details are previewed before official approval. Exact required documents/declarations must be supplied by clergy.

### S13.07

**Question:** Which marriage cases need a different approval route or outside authorization, and how should the UI identify that need without making the decision itself?

**Proposed answer:** Add **Requires special clergy review** with a restricted reason/category when facts indicate outside-parish jurisdiction, prior marriage questions, different rite/church affiliation, incomplete essential evidence or another policy-defined exception. These are routing prompts, not automated eligibility determinations.

The priest identifies the competent diocesan/external authority, required evidence and next step. Record permission/reference/date and applicable limits before the relevant final stage. Applicant sees a neutral useful status without another person's private facts. No secretary proxy or administrative rank may substitute for a required bishop/external authorization. Actual categories and decisions require approved domain policy.

### S13.08

**Question:** For funerals, what deceased-person, family-contact, celebrant, location and timing information is essential, and which steps must support urgent handling?

**Proposed answer:** Funeral intake prioritizes deceased identity, reported date of death, authorized family/contact, requested date/location, celebrant preference and essential immediate logistics. Flag unverified facts and separate arrangements from the later official-entry evidence.

Provide the maintained direct pastoral contact and expedited eligible office/priest worklist. Use an approved funeral-specific checklist so unrelated advance formation fields do not block urgent intake, while necessary identity/authority review remains intact. Record actual ceremony details afterward. A funeral request is not proof of death, permission to publicize details or automatic authority over all the deceased person's records.

### S13.09

**Question:** Should completing a funeral automatically mark a person deceased, or require a separate reviewed update? What should stop future invitations, commitments and inappropriate reminders?

**Proposed answer:** Offer a separate **Confirm deceased status** review using appropriate evidence and authorized office/priest confirmation. A completed funeral can suggest the action but must not silently change identity/account status if the match or facts are uncertain.

On confirmation, stop optional celebratory outreach/invitations and flag future commitments/rosters for review; handle bookings, payments, account access and guardian roles through their own consequences. Preserve official history and relevant family contact privately. Do not disclose death through broad notifications until publication is approved. Distinguish reported death, verified deceased status and account closure.

### S13.10

**Question:** For Mass intentions, blessings, sick visits and appointments, which details should be structured, who receives them and what event/task should acceptance create?

**Proposed answer:** Mass intentions capture requested intention, permitted publicity/name, preferred service/date and requester contact; blessings/visits capture subject, relationship, location, availability and private logistics; appointments capture topic category, participant/contact and preferred times without unnecessary sensitive detail.

Route to designated office/priest staff with restricted access where pastoral information is sensitive. Acceptance creates/links an actual calendar appointment, service-plan item or pastoral task only after confirming time/owner and visibility. Keep fees/offerings separate from spiritual approval. Public wording comes from an explicit publishable field, not the private visit description.

### S13.11

**Question:** How should sacramental records from another parish or country be referenced and verified without treating an uploaded document as a new local celebration?

**Proposed answer:** Store an external sacrament reference with source parish/diocese/country, type/date, issuer/book/page/reference where known, attached evidence and verification status/reviewer. Preserve original document language and separately reviewed translation if needed.

It supports eligibility or a local request without claiming a new local celebration or assigning a local register number to the external event. If an official copy is needed from the source parish, show that referral/request path. Review ambiguous identities with both sources through authorized channels. Never import another parish's full private record merely because an applicant supplies one certificate.

### S13.12

**Question:** Which requirements and official labels may vary by parish/diocese/rite, and who approves those variations before they affect forms or documents?

**Proposed answer:** Common workflow, attribution and access rules are system-wide. Clergy requirements, approved official labels, feast calendars, register formats and certificate templates are versioned by competent jurisdiction/rite, with parish variations only where authorized.

The bishop or nominated competent authority approves religious-policy changes; developers validate configuration behavior and language reviewers approve translations. Show effective date/version and impact on pending cases. Existing official entries retain their original policy/template snapshot. No ordinary settings editor can silently alter doctrine, required approval authority or historical forms across all parishes.

### S13.13

**Question:** Which fees, suggested offerings, exemptions or collection instructions apply to these requests, if any? Where should users see them without implying that payment establishes approval?

**Proposed answer:** Show only actual parish/diocese-approved fees or suggested offerings, labeled accurately with currency, purpose, payment method, waiver/contact route and whether payment is required for a particular administrative output. Amounts remain domain inputs, not sample defaults.

Payments and clergy approval are separate status facts. A paid request is not accepted, and financial hardship/waiver decisions follow the approved procedure rather than a hidden automatic rejection. Office records actual receipts once with finance linkage. Refunds, cancellations and uncollected outputs retain their financial history and applicant-visible explanation.

## S14

**Certificates, bishop review and collection**

### S14.01

**Question:** Which certificate types are required, and who will provide approved examples of their exact wording, layout, seal, signatures and required fields?

**Proposed answer:** Support certificates/extracts for approved official baptism, First Communion, confirmation/chrismation, marriage and funeral/death-related entries where that jurisdiction actually issues them. Do not invent a nationally uniform document list or wording.

The bishop/competent office provides approved samples, mandatory names/fields, register references, languages, seals/signature arrangements and any official purpose-specific variants. Version templates with authority/effective date; preview populated examples and long-name cases. Printed output identifies the responsible priest, while secretary entry attribution stays internal. Drafts/unapproved copies are unmistakably labeled and cannot be mistaken for issued originals.

### S14.02

**Question:** Who may request each certificate and for what purposes? What authorization is needed when requester and subject differ?

**Proposed answer:** Allow the subject to request their own certificate, a verified guardian to act for the appropriate child/dependent, and a representative with office-reviewed authorization to request another adult's document. Funeral/deceased-subject requests need the approved family/representative process.

Capture purpose only to the level genuinely needed for choosing the correct extract or authorization. Household contact alone grants no private document access. Receive questionable requests for review without exposing the official entry beforehand. Verify requester, subject and collection recipient separately; a legitimate requester can nominate a representative only through the release policy.

### S14.03

**Question:** Confirm whether every newly signed certificate needs bishop acceptance, or only specified types/parishes/cases. Who has authority to approve that policy?

**Proposed answer:** Preserve the current new-certificate bishop-acceptance stage as the default proposed policy until the bishop explicitly approves a narrower configuration. It remains a separate episcopal decision after priest signing, not an inferred developer rule.

If exceptions are approved, version them by document type/jurisdiction/effective date and show the applied rule on each case. A parish cannot switch off a mandated bishop gate through an ordinary local setting. Secretary-recorded priest approval never substitutes for bishop acceptance. Legacy issued certificates follow S14.12 rather than being retroactively blocked solely for missing new metadata.

### S14.04

**Question:** Approve the visible statuses before and after priest signature, bishop review, return, resubmission, acceptance, release and collection. At what point may the UI say “issued” or “ready”?

**Proposed answer:** Use Received → Waiting for official source where needed → Prepared → Awaiting priest approval → Awaiting priest signature → Awaiting bishop acceptance if applicable → Authorized for issuance → Issued → Ready for collection/secure download → Collected/Delivered → Closed. Returned, Cancelled and Correction/reissue branches preserve history.

Only say Issued after required signatures/acceptance and final document snapshot exist. Ready also requires a reviewed release/delivery arrangement, not merely a signed draft. A certificate can be approved on the priest's offline instruction recorded by a secretary while still awaiting an actual signature or bishop decision.

### S14.05

**Question:** Where should a bishop find the review queue, what information/document preview must it contain, and are individual or bulk decisions permitted?

**Proposed answer:** Include a permission-restricted certificate queue in the bishop's combined home/My work, with parish, subject's permitted identity, document/reference/type, signing priest, applied policy, final preview, submission/resubmission notes and waiting time.

Review should compare the signed snapshot, not mutable live profile fields. Default to individual accept/return decisions with required return reason. Bulk episcopal acceptance is not assumed; it needs explicit policy, per-item preview/eligibility and audit if later approved. Unassigned administrators cannot see queue contents/counts merely because they manage diocesan accounts.

### S14.06

**Question:** When the bishop returns a certificate, who sees the reason, what can the priest edit, and what must a resubmission explain? Should the applicant see this loop or only a neutral progress message?

**Proposed answer:** Bishop return sends a restricted reason to the responsible priest and eligible preparation staff. The applicant receives useful neutral progress/any action they must take, not internal criticism or another person's details.

Editing a returned certificate creates a new revision, with changes highlighted and a priest resubmission note. Material changes invalidate prior signature on that changed document and require the appropriate new signing/review steps. Preserve the returned snapshot and reason. Approval of the new version does not rewrite what the bishop originally saw or silently re-release an old file.

### S14.07

**Question:** How should the process continue during bishop/priest absence or reassignment? Are delegated signatures or acceptance ever allowed?

**Proposed answer:** Assign unresolved work to an eligible active priest/bishop substitute under the competent authority's appointment rules. Record acting appointment, scope/date and the actual signer/acceptor. Developers and office staff coordinate handover without acquiring religious authority.

A secretary may record a specific already-given priest approval, not apply a signature or make a bishop decision. Standing delegated signing/episcopal acceptance is unavailable unless expressly authorized in the domain policy and supported with clear attribution. During a genuine vacancy, show awaiting competent assignment with office contact rather than forging an unavailable cleric's approval.

### S14.08

**Question:** Can a certificate request wait on a planned sacrament, and how should automatic source linking, cancellation of the sacrament and several possible source entries be explained?

**Proposed answer:** Permit a certificate request linked to a planned sacrament and show **Waiting for official entry**. After actual celebration and final registration, propose/link the exact matching source and make the relation visible to office/applicant.

If several approved sources could match, require reviewed selection; never link by name alone. Cancelling the planned sacrament pauses/cancels or redirects the certificate request with an explanation and financial review as needed. Existing official sources can be chosen without rerunning the celebration. Source linking creates no certificate signature, bishop acceptance or release by itself.

### S14.09

**Question:** Which languages and name spellings may the requester choose, and who verifies translations? Resolve the current trilingual option against actual supported document templates.

**Proposed answer:** Offer approved English, French and Arabic document versions, plus bilingual/trilingual layouts where the competent authority has approved them. The requester chooses available language/layout and supplied verified name spellings; staff review against source evidence.

Do not auto-transliterate official names or equate interface language with certificate language. Missing approved name/script or template translation becomes a preparation task, not fabricated text. Show final language/identity preview before approval/signing. Preserve the issued snapshot and translation reviewer/source so later profile changes do not alter an already authorized document.

### S14.10

**Question:** What makes a downloaded or printed certificate official: wet signature, electronic signature, seal, serial, verification URL/QR, or an explicitly nonofficial copy? Which launch formats should be available?

**Proposed answer:** Until an approved electronic-signature/verification arrangement exists, treat unsigned downloaded previews as copies and the approved wet-signed/sealed paper as official where required by the issuing authority. Final digital copies must accurately state their status.

Use final PDF/print as the primary output; PNG/SVG can remain explicitly labeled previews/copies when available. A QR or serial can point to limited authorized verification but does not alone establish signature validity. Draft watermark and issuance gates must apply to every format. Printed authority name is the priest's; secretary audit attribution remains internal.

### S14.11

**Question:** Are certificates valid indefinitely or time-limited, and can copies be reprinted, replaced, revoked or corrected? What should distinguish a replacement from a new issuance?

**Proposed answer:** Do not invent a universal certificate expiry. Display issue date and any issuer-approved purpose/validity rule; requesting institutions' requirements may differ and require confirmation. Reprinting the same issued snapshot is a copy of that issuance, while replacement/reissue has its own reference/version and reason.

A revoked/corrected document retains history and a restricted verification outcome. Material changes require renewed relevant approvals/signatures; do not overwrite a previously downloaded artifact. Show which version is current and why another was superseded. Authorized staff review downstream releases and notify recipients through permitted routes.

### S14.12

**Question:** How should preexisting issued certificates be labeled and used when they lack the new bishop-review metadata? Is any retrospective review required?

**Proposed answer:** Preserve previously issued certificates as **Legacy issued** with their original date/reference/template/source and whatever actual authority evidence exists. Missing bishop-review metadata is Unknown/not applicable under the historic process, not proof of approval or invalidity.

Do not retrospectively invent acceptances or automatically block legitimate old documents. Any review/reissue policy must be explicitly adopted by the bishop, with a staged worklist and applicant explanation. Reprints retain the legacy snapshot; new material issuance uses the current approved workflow. Ambiguous legacy identity/authority triggers case review before sensitive release.

### S14.13

**Question:** What must be verified at physical collection or secure download, including a representative collecting on someone's behalf? Who records receipt and when is the request complete?

**Proposed answer:** Before handover, verify recipient identity and authority against requester/subject, chosen document/version and any representative nomination. Record who checked, recipient/relationship, actual date/time and receipt method with minimal evidence.

For secure download, use the approved authenticated/verified-contact route and release only selected final files. If necessary verification cannot be genuinely delivered, offer verified office collection rather than simulate security. Download availability is not actual collection; successful download/receipt is a separate fact and physical completion may require acknowledgment. Close after the defined delivery/collection criteria, retaining unresolved balances/issues separately.

### S14.14

**Question:** Should certificate requests support copy quantities, fees, payment status and delivery choice? What happens when payment or pickup remains outstanding after acceptance?

**Proposed answer:** Capture requested quantity, approved language/version, purpose where needed and preferred collection/secure-delivery method. Show genuine approved administrative fees/offerings and recorded payment/waiver separately from clergy approval.

After acceptance, unpaid fees or uncollected documents appear as clearly assigned follow-up, not false Ready/Delivered status. Apply only approved financial prerequisites and hardship rules; do not invent a payment gate for spiritual approval. Collection reminders use real channels with minimal details. Cancellation/refund and expiry of a download window retain issuance/payment history and a recovery/contact route.

## S15

**Documents, evidence, attachments and file release**

### S15.01

**Question:** For every request/preparation type, list required documents, optional evidence, who supplies each and the stage at which it becomes mandatory.

**Proposed answer:** Maintain a versioned requirement list per service/rite with document name, issuer/source, required/optional/conditional status, acceptable file/paper form, supplying party, due stage and verifier. Provide the applicant-facing list before submission and a clear remaining-items view.

Base identity/representation, prior sacramental evidence and celebration-specific documents are defined by the approved domain template, not generic assumptions. The office can receive evidence early; priest/competent authority resolves policy questions. No document checkbox silently grants clergy approval. Missing actual checklist inputs remain a domain configuration dependency before that service is offered as ready.

### S15.02

**Question:** Should applicants upload documents during submission, later from tracking, or only through the office? What should a guest who cannot upload be told to bring?

**Proposed answer:** Allow optional initial uploads and later responses from own account/private verified tracking, with the same requirement checklist. Office staff can attach scanned/paper-received evidence with provenance and entering identity.

Explain exact originals/paper items to bring and which upload still needs verification. A guest unable to upload can submit permissible intake and arrange office receipt; do not discard the request. External/contact evidence is not published to general parish state. Final dependent actions remain blocked until requirements are verified/waived by the proper authority, regardless of how the evidence arrived.

### S15.03

**Question:** What should distinguish file attached, paper received, verified, rejected/illegible, expired and waived? Is a receipt checkbox sufficient, or is verification a separate action?

**Proposed answer:** Distinguish Missing, Uploaded, Paper received, Under review, Verified, Rejected/Illegible, Expired and Waived. A receipt records possession, while verification records the qualified review and outcome. Show reviewer/date/source and the next responsible role.

Rejecting one document requests replacement without declining the whole case. Waiver requires eligible authority and reason; it cannot masquerade as verified evidence. Expired documents retain history and trigger the specific required renewal. Completing the document checklist is independent of priest approval, actual celebration and signing. Applicants see only the useful permitted explanation, not internal third-party notes.

### S15.04

**Question:** Which file types, size limits, number of files and page counts are appropriate for each surface? Confirm or change the current 1 MB member versus 10 MB office difference.

**Proposed answer:** Standardize official request uploads to PDF/JPEG/PNG, proposed 10 MB per file and 20 files per case, with configurable reviewed exceptions for legitimate larger material. Accept text files only in nonofficial resource/message areas where supported; do not accept executable/macro content as evidence.

Show limits before selection and preserve Arabic/French filenames. Proposed PDFs over 20 pages receive a review warning or office route rather than silent truncation. Replace the unexplained 1 MB versus 10 MB difference with consistent published scope rules. Final storage/security/performance validation must confirm these proposed limits before launch.

### S15.05

**Question:** Should phone users be able to photograph, rotate, crop, combine or compress documents? What preview must they see before sending?

**Proposed answer:** Offer phone capture, preview, rotate/crop and optional compression/combining where reliably supported, while retaining an office-upload alternative. Let users review all pages, order and legibility before sending.

Never silently alter original evidence or remove essential details; any processed derivative is identified and the original retained where policy requires. Warn if compression makes text unreadable. Do not infer document authenticity from an image. Camera access is user-initiated and optional; upload/capture failure leaves the form and already saved files intact. Advanced processing unavailable at launch is clearly labeled rather than simulated.

### S15.06

**Question:** How should uploads show progress, cancellation, retry, unsupported type, oversized file and an interrupted connection without losing the rest of the form?

**Proposed answer:** Show per-file selected/uploading/saved/failed states with progress where known, cancel and retry. Check type/size early, then report authoritative server validation clearly. Preserve form values and completed files through interruption.

A saved case with failed attachment says **Request saved; attachment not uploaded**, linking a retry for that file only. Never count a selected local file as received evidence. Use duplicate-safe retries and recheck access/revision on replacement. Keep failed sensitive upload data only in the permitted session/draft context; a shared-device sign-out must not leave unintended recoverable evidence.

### S15.07

**Question:** Who may view, replace, download or remove a file, and must replacement retain the old version and a reason? What happens once a record is approved or closed?

**Proposed answer:** Viewing/downloading follows record and file-level audience. Eligible preparation staff can add/replace evidence before closure; verifiers record outcomes. Replacement preserves prior version, reason and affected requirement decision where needed, rather than changing verified evidence silently.

Approved/closed official evidence becomes read-only; later change uses an authorized correction/reopen process. Applicant sees their own submitted/requested files and explicitly released outputs, not every office attachment. Removal is restricted and audited; retention/erasure rules determine physical deletion. Signature/approval does not automatically authorize file release or bulk export.

### S15.08

**Question:** Should a document be reusable across related requests, or copied/linked only after review? How should staff tell whether a reused document is still valid?

**Proposed answer:** Reuse evidence only through an authorized link/copy that identifies source case, subject, document type, verifier, validity and the new purpose. Recheck consent/access and whether a fresh original is required; prior upload alone is not reusable verification forever.

Keep prior snapshots and permissions separate so a new audience does not gain the source case's other files. A document replaced/withdrawn in its source flags dependent uses for review rather than silently rewriting old official decisions. Cross-parish reuse requires deliberate authorized disclosure, not a combined-view shortcut.

### S15.09

**Question:** What must the release confirmation show to prevent sending the wrong person's document? Must it compare applicant, subject, certificate, file preview and intended access method?

**Proposed answer:** Release confirmation must display applicant/subject, receiving contact or verified account, request/certificate reference, final version/language, file name and preview, applied approval/signature/bishop gates, and delivery method.

The office user confirms identity/authority and correct document. A mismatch, missing final gate or unverified recipient blocks release. Prefer one case/file at a time; no generic release-all button by ordinary upload permission. Internal supporting evidence is never selected by default. Preserve releaser/time and priest approval attribution internally; the printed official sheet identifies its priest rather than the secretary recording history.

### S15.10

**Question:** Can a released file be withdrawn, replaced or given an expiry? What should existing guest links and previously downloaded copies mean after withdrawal?

**Proposed answer:** A releaser can withdraw future access with reason and notify authorized parties; replacement creates a new version/release with repeated identity/gate checks. Preserve what was released and when, including earlier recipient access events.

Propose a 30-day availability window for sensitive released downloads, renewable after review; this is a delivery-window default, not record deletion or certificate validity. Old revoked tokens/files stop future download, while already downloaded copies cannot be recalled technically. Tracking can retain a limited status/contact route. A mistaken release also creates restricted incident/review work rather than disappearing from history.

### S15.11

**Question:** What should the private tracking link itself reveal, should download require an additional verification step, and how should a leaked link be replaced?

**Proposed answer:** Tracking links reveal limited case status, applicant-visible responses and an explicit list of available final outputs. Sensitive document download should require an authenticated office-approved account association or genuinely verified contact challenge, then a short-lived authorized download session.

Office identity verification before release remains required; it does not make any later bearer of a leaked URL the right recipient. If the additional verification service is not configured, provide verified collection/account linking rather than pretend a code was checked. Revoke/rotate leaked tracking access after identity review; never expose tokens in public links, logs or messages to unrelated staff.

### S15.12

**Question:** What file-view/release/download activity should be visible to staff and applicants, and what retention/deletion behavior applies when the parent request is cancelled or archived?

**Proposed answer:** Record file create/replace/remove, verification, release/withdrawal, permitted access/download and relevant denied attempts with actor, scope, file/version and time. Keep evidence contents, credentials and private tokens out of general audit.

Applicants see their own upload/release status and suitable receipt history, not staff-private review details. Staff access audit only within authorized scope. Cancellation/archive preserves evidence needed for official/history obligations; expiry deletion follows an approved retention schedule and holds, not an automatic case-close purge. Explain retained versus removable copies and preserve minimal deletion/redaction proof.

## S16

**Calendar, Mass times, clergy schedules and anniversaries**

### S16.01

**Question:** Which calendar event types exist, and which fields, icons, colors and default audiences distinguish Mass, sacrament, group meeting, parish activity and facility block?

**Proposed answer:** Distinguish Mass/liturgy, sacramental celebration, ministry meeting, parish event, appointment, volunteer duty and resource/maintenance block. Require title/type, parish, start/end/time zone, location/resource, owner, visibility and relevant clergy/group links.

Default pastoral appointments and staff planning to restricted; group meetings to their group; public Mass schedules to approved public visibility. Sacramental public titles remain generic. Use consistent type icons and colors with text labels, not color-only meaning. All-day and cancelled states are explicit.

### S16.02

**Question:** Which role may create/edit each event type, and who may publish an event publicly or invite a group?

**Proposed answer:** Office staff/priests maintain parish events within scope; leaders create assigned-group meetings and proposals; authorized facility staff manage resource blocks. Clergy appointments, sacramental dates and public publication retain their required approval.

Creation and public publishing are separate rights. Members submit requests rather than editing office calendars. Invitations target permitted group/member lists without exposing recipient identities publicly. The head priest can delegate operational scheduling, not religious authority. Record editor, approver, recurrence scope and actual published outcome.

### S16.03

**Question:** What should each audience see about a private event occupying a shared room/time: hidden entirely, busy interval, or limited title/location?

**Proposed answer:** Show an occupied busy interval/resource where needed to prevent conflicts, with no private title, subject, family name, notes or attendee list. Authorized staff see the additional details their role permits.

A public availability strip may say Unavailable without naming the pastoral/medical or family reason. Private appointments can be absent from public event lists while still blocking resources. Exports, search, map previews and tooltips obey the same redaction. Do not reveal sensitive cases through counts or appointment categories.

### S16.04

**Question:** Should recurring events support exceptions, cancellations and edits to one occurrence versus the series? How should changes affect bookings, registrations and volunteer assignments?

**Proposed answer:** Support recurring series with explicit **This occurrence**, **This and future** and **Entire eligible series** editing, showing affected dates and linked commitments before saving. Preserve completed/past facts and cancelled occurrences.

Recheck rooms, clergy, registration and volunteer conflicts per occurrence. Paid/registered events need reviewed change handling rather than silent series mutation. Dated exceptions override normal schedules in public results. Notify only affected audiences through actual channels and retain original/changed times; changing a series does not retrospectively change attendance or official celebration history.

### S16.05

**Question:** What should happen when a room, priest, leader or required equipment is double-booked? Which conflicts block saving and which require a reason to override?

**Proposed answer:** Block overlapping exclusive room/clergy/equipment commitments and eligibility failures; show enough permitted conflict information to choose alternatives. Availability preferences/workload warnings can allow an authorized reasoned exception.

Do not offer an override for impossible physical double-use; resolve by different resource/time/eligible person or an expressly modeled shared-capacity arrangement. Recheck on save/confirmation to handle concurrent requests. Cross-parish personal schedules expose only authorized busy information, not private titles. Changes affecting confirmed applicants require a reviewed reschedule/notification process.

### S16.06

**Question:** When a sacrament, group meeting or service plan is dated elsewhere, should its calendar entry be created automatically? Which screen becomes the authoritative editor?

**Proposed answer:** Dated sacramental, meeting and reservation workflows create/link one canonical calendar occurrence rather than independent duplicate copies. The source workflow owns its consequential status and date approval; calendar editing routes back to that source when required.

Service plans link to an event and do not silently overwrite it. Show source link and which fields are editable here. Rescheduling uses a coordinated preview of resources, registration and duties, then updates references together or reports an incomplete recovery state. Public visibility still needs its own approval.

### S16.07

**Question:** Which calendar views and filters are needed for each audience, and what should the default view, week start and displayed hours be on phone versus desktop?

**Proposed answer:** Provide Month, Week and List everywhere relevant, with Day/Agenda and templates for authorized staff. Default laptop staff to Week and phone/public users to List when more usable, with remembered per-account choice.

Propose Monday week start, configurable for local practice. Show normal operating hours by default with access to early/late/all-day items rather than hiding them. Filter by parish/type/group/clergy/resource/visibility according to access. Combined calendars label parishes; selecting a day/event never silently changes its owning parish.

### S16.08

**Question:** Should parish times always display in the parish's time zone for overseas users, with an optional local equivalent? How should daylight-saving changes and cross-midnight events be labeled?

**Proposed answer:** Store/display the parish's configured time zone and show parish-local time as authoritative for visits and events. For the initial parishes use their approved Beirut-zone configuration; do not assume a viewer abroad shares it.

An optional local-time equivalent is explicitly labeled. Cross-midnight events show both dates; daylight-saving ambiguity prompts confirmation rather than silently shifting a booked hour. Printable schedules and notifications identify the relevant zone. Date-only anniversaries retain calendar dates rather than changing day because the viewer travels.

### S16.09

**Question:** Are 30-minute increments and the current facility hours sufficient, or do offices need precise, early, late or all-day scheduling?

**Proposed answer:** Keep convenient 30-minute choices but allow permitted precise times and configurable booking increments, plus early/late and multi-day/all-day events. The current 07:00–23:00 strip is a view default, not a universal prohibition.

Each resource has actual operating hours, setup/cleanup and allowed exceptions. Staff see out-of-hours confirmation requirements and realistic end times. Never round a supplied official celebration time silently. End must follow start, with next-day dates explicit. Past events can be viewed and corrected through authorized historical workflows rather than ordinary new booking.

### S16.10

**Question:** What must Print my schedule and Priest schedule include, omit and distinguish? May users export calendars or subscribe from their calendar app?

**Proposed answer:** Print my schedule offers period, selected parishes, permitted event types and preview/count. Priest schedule contains authorized clergy duties and relevant location/contact logistics, excluding unrelated private notes/cases.

Public/member versions use redacted public/group fields. Date/time zone, generated-at and page headings remain clear in EN/FR/AR. Calendar export/subscription is optional scoped access with revocable private feeds and no public tokens for confidential data; disable until operational. Printed official sacramental authority still uses the priest's name, with internal secretary approval audit excluded.

### S16.11

**Question:** Which feasts/liturgical calendars are supported, who approves their source and corrections, and should parish exceptions be possible?

**Proposed answer:** Enable only liturgical calendars supplied/approved by the relevant bishop/competent authority, with rite, year/source, version and reviewed corrections. Do not derive feasts from sample data or assert unsupported traditions are available.

Parish exceptions are allowed only within approved authority and retain a reason/effective date. Fixed public schedule exceptions remain distinguishable from liturgical calendar facts. Existing celebrations preserve the calendar/rite applied at their date. Cross-parish combined views can display different approved calendars without converting one jurisdiction's feasts into another's policy.

### S16.12

**Question:** Which anniversaries should be shown to whom, how far ahead, and with what outreach action? What should happen for deceased people, private records and incomplete historic dates?

**Proposed answer:** Show verified baptism, chrismation, Communion and marriage anniversaries from approved sources to permitted office/clergy users; personal views show only allowed own/family facts. Propose upcoming 30-day filtering with explicit exact/year-only precision.

Do not generate exact anniversaries from unknown dates or treat legacy reminders as registered events. Deceased status suppresses inappropriate celebratory outreach while preserving optional approved remembrance use. Outreach requires consent/purpose and real delivery capability. No public family anniversary list or automatic leader access follows from a general calendar grant.

### S16.13

**Question:** When an event is changed or cancelled, which connected workflows must be updated and which participants need to explicitly acknowledge the change?

**Proposed answer:** A change preview identifies linked bookings/resources, registrations/fees/consent, volunteers, plan items and published notices. Update the source occurrence and related links coherently, retain old/new details and assign follow-up where automatic completion is unsafe.

Notify affected applicants/participants/owners through actual channels. Major date/venue/fee/consent changes may require participant/guardian reconfirmation and withdrawal/refund options; routine internal note changes do not. Record acknowledgments separately from message delivery. Cancellation preserves attendance/payments/history and removes future availability claims, without deleting official past events.

## S17

**Service/activity planning and music library**

### S17.01

**Question:** What is a “service” versus a calendar event, sacrament request and ministry meeting in your users' vocabulary? Which should share one detail page?

**Proposed answer:** A calendar event is the scheduled occurrence; a service/activity plan is its operational running order; a sacramental request is the clergy-approved case; a ministry meeting is group activity with roster/attendance.

Link them through a common event detail hub where appropriate, retaining distinct permissions/statuses. A plan cannot prove sacramental celebration or create membership. Display source/related records and route consequential date or approval edits to their owning workflow, avoiding duplicate calendars and contradictory names.

### S17.02

**Question:** Who creates a plan, who edits it, who approves it and who may see it during the activity? Can different teams collaborate on one plan?

**Proposed answer:** Priests and authorized office/planning staff create parish plans; assigned leaders prepare their group's portions. Name one plan coordinator and relevant approver, with multiple scoped contributors.

Clergy/liturgical parts receive the required priest review; operational approval does not grant signature authority. During an activity, each team sees its permitted running instructions, not confidential pastoral notes or donor/guardian evidence. Track revisions and concurrent contributors; a shared plan is not permission to edit other parishes' templates or publish the entire plan.

### S17.03

**Question:** Which plan information is mandatory: linked event, start/end, celebrant, room, team, participants, notes, readings and music?

**Proposed answer:** Require parish, plan title/type, owner and linked event for a scheduled plan. Use event start/end/location as referenced facts. Require celebrant for relevant clergy-led services, and roles/team/readings/music where the selected template needs them.

Participants need not become new office people merely to name an external speaker. Optional private logistics are audience-labeled. Draft templates can omit future date/people; publishing/finalizing a live plan checks remaining assignments and conflicts. Preserve the applied template/version and source event.

### S17.04

**Question:** How should an order-of-service item specify start time, duration, person responsible and instructions? Should later times recalculate when an item changes?

**Proposed answer:** Each item has title, duration or fixed start, responsible role/person, permitted instructions and optional linked music/reading. Reordering/duration edits recalculate relative times and total length, while fixed items remain explicit constraints.

Show overlaps/gaps and whether an item's timing changed before saving. Allow keyboard/touch move controls as alternatives to drag. Do not silently move the underlying event or confirmed room time to fit a longer plan. Historic completed plan revisions remain stable.

### S17.05

**Question:** What should users see when the plan exceeds available time, has an unassigned role or conflicts with a related event?

**Proposed answer:** Show unmet required roles, excessive duration, resource/clergy conflicts and missing approval as specific actionable issues with a linked resolution. Differentiate blocking requirements from advisory workload warnings.

Draft saving can remain possible with clear incomplete status; finalized/approved output must satisfy required checks or a specifically allowed reasoned exception. Do not show a generic Ready badge merely because the plan exists. If concurrent event changes caused a conflict, preserve the draft and ask for reconciliation rather than overwriting confirmed schedules.

### S17.06

**Question:** Which draft, saved, approved and completed states are needed, and what should happen when someone navigates away with an unsaved plan?

**Proposed answer:** Use Draft, Saved/Ready for review, Returned, Approved/Published to permitted teams and Completed, with cancellation/history. Retain explicit Save for running-order edits and show unsaved/saving/saved/failed state.

Leaving with edits offers Save draft/Discard/Stay. Approval records the exact revision and audience; later material changes require the relevant renewed review. Completion confirms operational closure, not sacramental registration. Recovery after failure preserves only permitted drafts and never fabricates successful persistence.

### S17.07

**Question:** Which parts of a template are copied, and which dates/people/rooms must be reviewed before reuse? Who can change a template already used by saved plans?

**Proposed answer:** Copy structural items, durations, instructions and approved resource references from a versioned template. Require review of dates, people, venue, current music rights and other event-specific facts; do not copy old participants/contact details as defaults without confirmation.

Authorized template editors create a new version. Existing plans keep their own copied/version-linked snapshot and arrays, so editing one plan/template does not mutate another. Offer deliberate template-update comparison for future draft plans only, with preserved changes and approval checks.

### S17.08

**Question:** Which outputs are required: clergy running sheet, volunteer assignments, printable program, musician setlist and participant version? Define private instructions excluded from each.

**Proposed answer:** Provide audience-specific outputs: clergy running sheet, volunteer duty list, musician setlist and approved public/participant program. Each includes only permitted instructions and relevant names/times; internal phone numbers, pastoral notes, complaints and private evidence stay out.

Preview language, scope, period/version and page breaks before print/download. Public programs require publishing permission, not just plan-edit rights. Include source event/version so teams can identify obsolete copies. A changed plan updates future accessible versions and notifies affected teams without claiming recall of paper copies.

### S17.09

**Question:** Who owns the music library, and which metadata and search filters are needed for language, rite, season, key, instrumentation and usage rights?

**Proposed answer:** Appoint parish/diocesan music custodians with scoped editors/reviewers. Search title, supplied alternate names, language, rite, season, composer/source, key, instrumentation, category and available version/rights.

Leaders/musicians see resources permitted for their ministries and service assignments, not all private libraries. Record attribution, source links and publication status. Rights unknown means review needed, not free reuse. Missing translated metadata does not justify inventing lyrics or official translations.

### S17.10

**Question:** How should lyrics, chords, instrument notes, audio/video links and versions be reviewed, corrected and linked to a plan without altering past plans unexpectedly?

**Proposed answer:** Store lyrics, chord sheets, instrument notes, recordings/links and revisions as distinct related materials with source and reviewer. Preview safe content and actual accessible media; unavailable links show a useful failure state.

Plans/setlists reference the chosen version so a library correction does not silently alter a completed service. New material or significant changes receive review and a new version; obsolete items remain traceable. Do not download/rehost external media automatically or equate an HTTPS link with permission to redistribute.

### S17.11

**Question:** Which music files or text may be downloaded, printed or projected, and who records the necessary permissions and attribution?

**Proposed answer:** Download/print/projection rights are recorded per item/version and intended use, with source/license or authorized permission and required attribution. Only outputs actually permitted are offered.

Unknown or restricted rights route to a custodian for review; ordinary upload does not establish permission. Public projection and private rehearsal copies may have different conditions. Preserve attribution in generated sheets and avoid exporting another group's restricted material through a combined setlist. The competent rights owner supplies facts; the system does not invent clearance.

### S17.12

**Question:** If music/planning is deferred, which existing plans and resources must remain readable and what should replace their navigation/actions at launch?

**Owner direction applied:** Music and planning remain in scope; no deferral is selected here. Existing plans/resources remain readable to their authorized audiences, with edit/review/print behavior defined above.

If a later explicitly approved release change disables new work, retain historic read/export where permitted and make unavailable actions understandable, rather than deleting records or falsely claiming delivery/media playback. Such a change needs a recorded owner decision with staffing/support fallback and in-progress handling; this answer does not silently remove the module.

## S18

**Ministries, leadership and membership applications**

### S18.01

**Question:** Are Groups and Ministries interchangeable in your parish, or do you need types such as committee, catechism class, choir and temporary event team?

**Proposed answer:** Use a shared Ministries & Groups collection with types for ministry, choir, class/formation cohort, committee and temporary team. Type changes labels, eligibility and available tools without creating unrelated duplicate rosters.

Each group belongs to a parish, has responsible leaders/priests and clear visibility/status. Temporary teams can have end dates. Membership, attendance and staff leadership are separate facts. A public group listing contains only approved descriptions, not its internal roster or private files.

### S18.02

**Question:** Who creates a group, assigns its leader/co-leaders, configures eligibility and approves its public listing?

**Proposed answer:** Priests or authorized parish administrators create a draft group and configure operational facts. The priest appoints eligible leaders/co-leaders within authority and approves ministry purpose/eligibility/public listing as required.

Leaders can maintain permitted assigned-group content but cannot grant themselves wider access or change clergy policy. Record effective leader dates, lead designation and handover. Publication uses the public-content process; creating a group internally does not automatically advertise its people or accept applications.

### S18.03

**Question:** What must a prospective member see before applying: purpose, age range, schedule, location, leader contact, capacity, prerequisites and commitment expectations?

**Proposed answer:** Show approved purpose/type, relevant age/eligibility, meeting frequency/location, commitment expectations, application process, capacity where real and office/approved leader contact. Explain any prerequisites or later interview/guardian review.

Avoid publishing participant identities or sensitive internal notes. Provide accessible EN/FR/AR descriptions and a clear inquiry/apply next step. Closed/full groups show the actual waitlist/contact option, not a disabled unexplained button. Public interest and formal membership are distinct.

### S18.04

**Question:** Can followers apply before formal parish membership, or must they first be linked to a person? What should the blocked application offer as a next step?

**Proposed answer:** Followers may browse approved descriptions and send an inquiry. Formal roster applications require a reviewed parish person/account link or an explicitly authorized guest/visitor process; interest alone does not expose member-only content.

When blocked, offer membership request/person-link review and preserve the intended ministry so the user can continue later. An office can help an unlinked person apply with provenance, but priest approval and roster identity checks remain. Following several parishes does not authorize joining every private group automatically.

### S18.05

**Question:** Confirm leader review followed by priest approval and the priest's direct-approval option. Are interviews, trial membership, guardian approval or group capacity decisions required?

**Proposed answer:** Preserve leader review followed by priest final membership approval, with priest direct approval allowed. Conditional interview, formation, capacity or guardian consent appear only where the approved group policy requires them.

Leader review gives a clear recommendation/decision at its stage; it does not activate the roster before required priest approval. Show exact next owner and applicant-visible missing information. A priest can accept the application directly without pretending leader review occurred. Domain-specific eligibility is configured, not guessed by software.

### S18.06

**Question:** Can staff add a person directly to a roster, and under which authority? Must that person consent or receive an invitation before being treated as active?

**Proposed answer:** Office/leader users may prepare a roster addition for an existing person, with identity, consent/basis and the same final priest gate. Do not bypass applications through a profile checkbox.

A priest can directly approve a supported addition, recording who prepared it and whether the person's agreement was obtained. Historic roster imports use reviewed existing membership with provenance, not fabricated new consent. Staff appointment remains separate from being on the roster. Ineligible or disputed additions stay pending and do not reveal private group resources.

### S18.07

**Question:** What should happen when a leader declines, is unavailable or has a conflict of interest? Who sees the reason, and can the applicant appeal or reapply?

**Proposed answer:** Leader decline requires a suitable applicant-visible reason and retains history; provide priest review/appeal where appropriate. A conflicted/unavailable leader routes the case to another eligible leader or priest, without widening private access.

Applicants can supply clarification/reapply under the group policy rather than creating hidden duplicate cases. Clergy can review directly. Internal conflict facts remain restricted. The outcome notification contains only necessary group/parish/status information; applicants do not see other candidates or leadership's private deliberations.

### S18.08

**Question:** Confirm the private leave process. Does membership remain active while departure waits, and can the member stop attendance/notifications immediately?

**Proposed answer:** Preserve the confidential departure request visible to the applicant and authorized parish priests, with active membership until the approved departure decision. A person may independently mute optional updates and mark future availability unavailable without exposing their departure reason.

No forced ongoing participation is implied by a pending administrative roster state. The priest resolves the departure promptly and handles commitments/handover. Leaders do not receive private reasons or a general departure-request feed. Urgent safety/privacy restrictions can limit future contact/access through the appropriate reviewed process.

### S18.09

**Question:** After a departure is approved, what neutral information may leaders see, and how are future meetings, assignments, resources and attendance access affected?

**Proposed answer:** After approval, leaders see neutral membership-end/effective-date information needed to maintain their roster and assignments, not the private reason. Remove future member-only access according to policy and review upcoming duties/resources.

Retain historic attendance and authorized group records without presenting the former member as currently active. Personal request/account history stays appropriately accessible. Notify the person, responsible priests and any permitted oversight recipient of the outcome with minimal data; do not broadcast the departure to the group.

### S18.10

**Question:** What is the withdrawal rule before versus after leader approval, and what should the applicant see while withdrawal itself awaits approval?

**Proposed answer:** Before leader approval, withdrawal completes immediately with history. After leader approval or another consequential commitment, record Withdrawal requested for priest/eligible review rather than silently erasing the application.

Show which state applies, current owner and any future roster effect. Withdrawal is not the same as leaving an already approved membership. Preserve original and subsequent decisions; prevent final approval after a successful withdrawal unless deliberately reopened. Applicants retain their own tracking and receive the actual outcome.

### S18.11

**Question:** How should leadership handover, group merge/split and group closure preserve members, pending applications, files, tasks and history?

**Proposed answer:** Leadership changes preserve group identity and recorded work, revoke old authority and assign future tasks to eligible replacements. Merge/split requires reviewed membership/resource/task mapping with explicit impacts on pending applications and history.

Closure stops new activity/applications while retaining authorized historic reading/export. It does not delete member accounts, alter official parish membership or transfer private notes/concern reasons. Show effective dates and handover owner; avoid double-counting moved roster memberships or rewriting past attendance as belonging to a different meeting.

### S18.12

**Question:** What should each role see on a group page? Confirm the secretary's smaller Members & contacts / Meetings / Resources workspace and any needed additions.

**Proposed answer:** Members see permitted own/group activities/resources; assigned leaders see group operations; priests/authorized administrators see their permitted oversight. Keep the secretary's operational focus on Members & contacts, Meetings and Resources, adding only explicitly granted tasks rather than a blanket group-management feed.

Attendance, formation, publishing, loans and private task details each require separate scope. Staff preparation is not leadership appointment. The combined home links to these role-appropriate group tabs; it does not bypass restrictions or reveal other ministries simply because they are in the same parish.

## S19

**Meetings, attendance, formation and group resources**

### S19.01

**Question:** Does creating/editing a group meeting also create/update the calendar event, or should meetings and calendar events remain separate with an explicit link?

**Proposed answer:** A meeting owns one linked calendar occurrence; creation/date changes update that occurrence through the meeting workflow. Keep agenda, roster, resources, RSVP and attendance attached to the meeting identity.

Calendar detail links back to the meeting and respects its edit rights. Recurring meetings have explicit occurrence/series actions, while completed attendance remains fixed to the actual occurrence. Do not create duplicate events from both screens. Public/group visibility and room/clergy conflicts are checked before publication/confirmation.

### S19.02

**Question:** Which meeting information and materials should members receive, and when should it become visible to new or trial members?

**Proposed answer:** Members receive permitted title, date/time/location, organizer, agenda, relevant preparation/resources and RSVP instructions. New/trial members gain current/future content according to eligibility; historical private content is not automatically exposed on joining.

Leaders choose audience and publication time within policy, with required translations for reusable shared content. Changes notify actual participants through available channels. Private individual absence reasons, medical notes and leadership deliberations are excluded from general meeting materials. Ex-members retain only the historical access explicitly allowed.

### S19.03

**Question:** Are RSVPs required, optional or inappropriate for some groups? Who can see absence reasons, and what is the deadline for changing a reply?

**Proposed answer:** RSVP is configurable per meeting type and supports Yes, No and Undecided until a published deadline or meeting start. It is planning information, not recorded attendance. Absence reasons are optional and visible only to designated leaders/clergy who need them.

Members can update replies before the deadline; later changes use a leader contact/follow-up. Notify the organizer of meaningful changes without broadcasting private reasons. A missing RSVP is not No and must not automatically mark the person absent.

### S19.04

**Question:** Which attendance states are needed: present, late, absent, excused, unknown and not expected? Should unrecorded attendance ever count as absence?

**Proposed answer:** Use Present, Late, Absent, Excused, Not expected and Not recorded. Preserve the distinction between unknown/unrecorded and actual absence. Configure whether Late counts toward a particular reporting measure and show that definition.

Default expected participants derive from the roster applicable on the meeting date, with reviewed guest/additional rows. A cancelled meeting has no ordinary absence denominator. Attendance entry requires an explicit meeting/date and actual recorder; a member RSVP or list membership cannot serve as proof of arrival.

### S19.05

**Question:** Who records/corrects attendance, for how long after a meeting, and what evidence/reason/history is needed for changes?

**Proposed answer:** Assigned leaders/attendance operators record meeting attendance, with authorized office/clergy correction rights. Keep ordinary correction open until the group's reporting period is closed; propose monthly review rather than an unexplained permanent edit window.

After closure, require a reason and eligible reviewer to reopen/correct. Preserve old/new state, source, actor and actual time; do not falsify the original meeting date. Members can request corrections to their own attendance but not directly edit everyone. Import/undo follows the same ownership and lock rules.

### S19.06

**Question:** How should guests, newcomers, a participant joining midterm and former members appear in attendance sheets and summary calculations?

**Proposed answer:** Roster snapshots determine whether someone was expected at each historical meeting. Newcomers count from their actual join/eligible date; former members remain in prior attendance without inflating current roster counts.

Guests can receive a limited attendance row with reviewed identity, not automatic ministry membership. Not expected stays outside absence denominators. Changes to current roster do not erase or rewrite old attendance. Overlapping memberships across groups need unique-person versus membership labels in aggregate reports; no public individual attendance display is implied.

### S19.07

**Question:** What is the required attendance-import flow, including template, matching, date mapping, preview, invalid rows, duplicates and reversal of a wrong import?

**Proposed answer:** Supply a versioned attendance template with permitted person identifiers, meeting/occurrence dates and accepted statuses. Preview name matches, unknown people, duplicate rows, new meeting dates and status mappings before commit.

Do not match by surname alone or create meetings/people silently. A reviewer resolves ambiguities and chooses whole-file or explicit valid-row import. Record source/batch and per-row outcomes, with duplicate-safe retry. Reversing a wrong import restores only its eligible changes; later reviewed corrections require comparison rather than a blind rollback.

### S19.08

**Question:** Which attendance figures should members, leaders, priests and bishops see, and what date range/denominator must each percentage explain?

**Proposed answer:** Members see own records; leaders see assigned-group individuals/aggregates; priests and authorized diocesan oversight see their allowed scope. Private absence reasons do not accompany broad percentage reports.

Each percentage shows date range, eligible expected/recorded rows, present/late rule, excluded Not expected/cancelled meetings and amount of missing data. Do not count Not recorded as absence. Combined reports distinguish people from memberships and preserve parish/group identity. Bishop summary drill-down must obey actual authorization rather than exposing raw private explanations.

### S19.09

**Question:** What does Formation mean for each group: courses, milestones, eligibility, completion or certificates? Who records evidence and signs off completion?

**Proposed answer:** Formation represents approved group courses/milestones, prerequisites, evidence, instructor/verifier and completion date. Leaders/instructors record progress; the designated priest/qualified reviewer approves milestones where clergy authority is needed.

Completion is a specific recorded result, not attendance percentage automatically converted into sacramental eligibility. External prior learning is reviewed with provenance. Corrections/revocation retain history and explain effects on future eligibility without rewriting already approved official entries. Personal views show only permitted own progress and accessible resources.

### S19.10

**Question:** Which resources are digital learning materials versus physical group belongings, and should the two use different labels and screens?

**Proposed answer:** Label digital material **Learning resources / Files** and physical stock **Equipment / Belongings**. Digital items have author/source/version/audience and download rights; physical items have owner, quantity, storage, condition and loan/return data.

Use linked tabs rather than one ambiguous list. A shared physical item reservation does not grant digital copyright access, and uploading a file is not a stock movement. Both retain scope and history through leadership changes, with clearly different actions and search filters.

### S19.11

**Question:** How should resource access, loans, returns, missing items and ownership transfer behave when a member leaves or a leader changes?

**Proposed answer:** Loan records identify item/quantity, borrower/contact authority, issue/due/return dates, condition and responsible custodian. Leaving a group ends future member-only resource access while outstanding loans remain a limited recovery task.

Leaders hand over custody/open loans to authorized replacements without transferring personal notes. Missing/damaged items trigger an issue with evidence and approved follow-up rather than hidden deletion or an automatic financial charge. Historic digital access/download logs remain restricted; current access is rechecked on each request.

### S19.12

**Question:** Which group tasks/notes are collaborative, which are private, and how should they remain distinct from personal member notes and confidential pastoral notes?

**Proposed answer:** Group tasks/notes intended for collaboration have an explicit group audience, assignee, owner, priority and due/completion state. Personal member notes remain account-private; confidential pastoral notes retain author/clergy-sharing rules.

Never reuse one vague Notes label with implicit sharing. Show audience before save, in detail and export preview. Assigning a task requires the assignee to be eligible to read it. Group membership/leader changes affect future access and tasks through handover, without exposing private personal records to successors.

## S20

**Volunteers, commitments, rota and hours**

### S20.01

**Question:** What makes someone a volunteer in this system: a roster flag, approved commitment, event assignment or separate reviewed volunteer record?

**Proposed answer:** A volunteer is a person with an approved service participation/assignment record; a role/account tier is not required just to volunteer. A member account exposes own opportunities and commitments, while staff can record an office-assisted volunteer with provenance.

Keep skills/availability, eligibility/training and accepted event commitments separate. Ministry roster membership does not automatically mean every duty is confirmed. Retain the removal of volunteer-only login roles. Unlinked volunteers gain only the explicitly approved invitation/assignment access, not general parish records.

### S20.02

**Question:** Can nonmembers, visitors or minors volunteer, and what consent, training or screening must be recorded before assignment?

**Proposed answer:** Permit visitors/nonmembers/minors where the specific opportunity and approved safeguarding/eligibility policy allow them. Record required guardian consent, relevant training/screening status and qualified approval before restricted assignments.

Do not infer suitability from age, membership or a staff title alone. Minors' public contact/roster visibility is restricted. Unmet prerequisites show Pending eligibility and an actionable review route, not a falsely confirmed duty. Actual screening rules, age limits and evidence retention are domain inputs; the system does not invent national legal requirements.

### S20.03

**Question:** Who defines teams, required positions, skills, dates, recurring slots and capacity for an opportunity?

**Proposed answer:** Authorized priest/office coordinators and assigned ministry leaders define teams, dates/occurrences, positions, quantity, skills, eligibility, start/end, location and responsible leader. Published opportunities show genuine capacity and expectations.

Templates can create recurring slots with per-occurrence exceptions and resource checks. Distinguish needed positions from named volunteers; do not count an unaccepted invitation as filled. Leaders cannot assign outside their scope or override training restrictions. Final clergy-led service responsibilities follow the approved planning authority.

### S20.04

**Question:** Should volunteers offer availability themselves, receive assignments, sign up for open places, or use all three? Which responses need leader confirmation?

**Proposed answer:** Support self-declared availability, staff invitations/assignments and signup for open slots. A volunteer response becomes Offered or Accepted invitation; the coordinator confirms eligibility/capacity before final commitment where review is required.

Show whether an apparently open place is actually pending another decision. Staff cannot silently accept for someone unless recording an explicitly received response with provenance. Availability is not consent to every assignment. The volunteer sees the same commitment/status history in the combined home without a separate account.

### S20.05

**Question:** What should distinguish invited, offered, awaiting confirmation, confirmed, declined, cancelled and completed commitments in member and leader views?

**Proposed answer:** Use Invited, Offered, Awaiting confirmation, Confirmed, Declined, Cancellation requested/Cancelled and Completed. Identify whether the next action belongs to the volunteer or coordinator and preserve actual response/confirmation dates.

Only confirmed eligible assignments fill required positions. Decline releases an unconfirmed invitation; cancelling a confirmed duty triggers replacement work. Completion records actual service/hours rather than mere elapsed time. Notify meaningful changes through available channels and do not claim delivery/read acknowledgment from an in-app record alone.

### S20.06

**Question:** Which conflicts should block assignment: overlapping duties, unavailable times, missing prerequisites, excessive workload or duties in another parish?

**Proposed answer:** Block actual overlapping confirmed duties, ineligible roles and missing mandatory training/consent. Show declared unavailability and workload warnings with an authorized reasoned exception only where safe and permitted.

Use cross-parish authorized/own busy information to prevent conflicting commitments without revealing private event details. Setup/travel allowance can be configured for duties needing it; do not silently schedule impossible transitions. Recheck capacity at confirmation, not just when an invitation was sent. High workload is a coordinator planning issue, not an automatic punitive label.

### S20.07

**Question:** How should a volunteer decline, cancel late, request a swap or find a replacement? Who approves a replacement and receives notice?

**Proposed answer:** Let volunteers decline invitations directly with optional reason. Confirmed-duty cancellation or swap creates a visible coordinator task with deadline/urgency; a proposed replacement must independently meet eligibility and accept.

The original assignment remains identifiable until the replacement/cancellation is resolved, with no hidden double filling. Notify the team leader and relevant affected participants, keeping personal reasons private. Late cancellation uses maintained direct contact where urgent rather than assuming automated reminders are monitored. Record who approved the swap and actual service outcome.

### S20.08

**Question:** How should drag-and-drop assignments be performed on touch screens and by keyboard, with a clear non-drag alternative?

**Proposed answer:** Keep drag-and-drop as an optional fast path. Every slot also offers Assign/change/remove through an accessible dialog with person, eligibility, conflict and confirmation summary.

Keyboard users can select a card and target slot or use move controls; touch users use the same explicit actions without precision dragging. Preserve undo for reversible draft movements, but confirmed changes follow notification/history rules. Never use a drag gesture to bypass consent/confirmation or transfer a volunteer into an unrelated parish/group.

### S20.09

**Question:** Who records and approves actual hours, corrections and no-shows, and what purpose do the reports serve?

**Proposed answer:** Volunteers may submit actual hours; authorized leaders/coordinators verify against the activity and record corrections with reason. Completed assignments do not automatically prove the full scheduled duration was served.

Reports support workload fairness, planning and any approved service record purpose, with clear estimated versus verified hours. Limit individual visibility to permitted users; no public rankings by default. Retain no-show facts separately from unrecorded attendance and allow a correction request. Historic approvals remain attributable after leadership handover.

### S20.10

**Question:** How should sign-up sheets be shared publicly or privately, how much volunteer identity/contact information may they reveal, and what should remain available after an opportunity ends?

**Proposed answer:** Public signup sheets show opportunity requirements, remaining places and office/approved contact, not volunteers' private names/phones. Private team sheets may show only necessary confirmed participant details under audience permissions.

After the opportunity ends, stop new signup and retain authorized commitment/hour history. Published expiry does not delete attendance or evidence. Joining through a sheet follows eligibility/confirmation rather than granting staff/group privileges. Sharing and downloads use the same audience restrictions, with revocable private links where appropriate.

## S21

**Event registrations, consent, transport, fees and refunds**

### S21.01

**Question:** Which activities use registration, and is one form per event sufficient? Do programs spanning several dates need session-by-session registration or one enrollment?

**Proposed answer:** Use registration for parish activities/programs with participants, capacity, consent, fees or transport, excluding individual Mass attendance. One event can have one primary form or explicitly related form categories sharing the same capacity where needed.

For a multi-session program, use a program enrollment linked to dated sessions, with optional session selection and per-session attendance/transport. Do not duplicate a person to count sessions. Each participant has one canonical event/program identity and clearly stated eligibility, deadlines and cancellation rules.

### S21.02

**Question:** Who may build/open/close a form, and can creating the form also create its calendar event and reserve the room?

**Proposed answer:** Permitted office/event coordinators build forms; leaders do so only for assigned activities. Open/publish requires the approved event authority and completed eligibility/consent/fee setup.

Allow Create form with new event as one reviewed flow, checking venue/clergy/resources and recording a linked reservation where required. Creation does not independently confirm a resource or publish an event before its approvals. On failure, show a recoverable draft/incomplete link, not an apparently open unlinked form. Once people participate, protect event/currency identity.

### S21.03

**Question:** Should guests and members register themselves or family members online, or is registration initially office-managed? How is an unrecorded participant added safely?

**Proposed answer:** Offer member self-registration and guest/public registration where the event permits, plus office-assisted entry. Members prefill authorized own/guardian subjects; another adult's registration needs an appropriate basis.

Unrecorded participants receive duplicate/archive review and a limited provisional identity/person creation flow, not automatic membership. Store origin/requester/participant separately and preserve submitted consent evidence. Public registration exposes only its own status/reference. Eligibility, capacity and final confirmation checks apply equally to office and self-service paths.

### S21.04

**Question:** What fields may the form builder offer, including conditional fields and attachments, and what should its applicant preview and validation show?

**Proposed answer:** Form fields include supplied participant identity, contact/guardian where needed, eligibility answers, specific consent, transport choices, approved fee options and permitted attachments. Support text/date/select/checkbox and controlled conditional questions with clear required/optional rules.

Preview the actual applicant view in EN/FR/AR and phone/desktop, including validation, fee total and consent wording. Avoid arbitrary medical/private questions without purpose and access limits. Snapshot the form/consent version on submission; changing a label must not silently alter what existing applicants agreed to.

### S21.05

**Question:** What should count toward capacity: reserved places, confirmed participants, pending approvals or a temporarily held checkout? Can staff override capacity with a reason?

**Proposed answer:** Confirmed and genuinely reserved places count toward capacity. A submitted application counts only if the configured process explicitly grants a reservation; otherwise label it pending review/waitlist. Temporary holds need a visible actual expiry and reliable release mechanism.

Propose a 48-hour reserved-place follow-up window where appropriate, configurable per event, not automatic silent cancellation when no runner exists. Hard venue/safety capacity cannot be bypassed by an ordinary reason field. Recheck concurrently at confirmation and explain full/waitlisted outcomes without taking a misleading payment.

### S21.06

**Question:** What should a waitlist do when a place opens: automatic promotion, timed invitation or staff review? Who decides priority and how is expiry explained?

**Proposed answer:** Use staff-reviewed promotion with a transparent published priority, normally application order among eligible candidates. When a place opens, invite the next suitable applicant and show response deadline; propose 48 hours unless event timing requires a shorter stated window.

A real expiry mechanism or assigned manual task releases unanswered offers; never claim a seat expired automatically when it did not. Promotion still requires consent/eligibility and any approved payment condition. Log exceptions with appropriate authority and keep other applicants' identities private. Notification delivery and acceptance are distinct facts.

### S21.07

**Question:** Confirm that reserved places may wait for consent, while final confirmation/check-in require applicable consent. Does payment ever become a separate prerequisite for confirmation?

**Proposed answer:** A place may remain Reserved while required consent is outstanding. Final Confirmed and check-in require applicable received/verified consent; missing age triggers review rather than presumed adulthood.

Payment remains a separate status. It becomes a confirmation prerequisite only when the approved event policy explicitly says so, with waiver/scholarship handling. Paying alone does not confirm an ineligible participant or supply consent. The UI shows place, consent, payment and transport independently, with the exact unresolved next step and owner.

### S21.08

**Question:** Which consent is event-specific versus reusable, whose signature/confirmation is required, and how are missing birth date, changing age and withdrawn consent handled?

**Proposed answer:** Core account/contact permissions can persist where appropriate, but event participation, transport, pickup and materially different publicity/medical handling need the relevant specific consent/version. Verify who has guardian/representative authority.

Use participant age at event date when the approved policy depends on it; unknown/invalid birth date remains Needs review. A changed date/wording may require renewed confirmation, not copied old acceptance. Withdrawal flags future participation and appropriate follow-up without erasing historical received evidence. Exact age thresholds/signature formalities require approved policy rather than a nationwide assumption.

### S21.09

**Question:** What transport options, seats, routes, pickup points, fees and deadlines are needed? What should happen when transport changes after money has been recorded?

**Proposed answer:** Configure actual transport choices, capacity, route/pickup points, departure/return times, charge/currency and cutoff. Distinguish Own transport, No transport selected and a reserved bus place.

Changing transport after payment shows revised amount, available seats and any refund/balance; preserve prior charge/payment facts and obtain required renewed consent. A transport place is not automatically included in event capacity. Operators receive only necessary participant/guardian logistics. Unconfigured routes/fees must not appear as promised choices or default charges.

### S21.10

**Question:** Are fees per person, household, event or selection? Define discounts, scholarships, waived fees, installment payments and who may approve adjustments.

**Proposed answer:** Define fee basis explicitly per participant/program/selected option, with household/group discounts only where configured. Snapshot applicable base/transport charges at registration. Authorized priest/finance/event owners approve scholarships, waivers and adjustments with reason.

Support partial actual receipts and remaining balance separately from place status. Do not silently change an existing participant's charge when the form fee changes. Show a reviewed adjustment rather than overwriting history. Publish genuine fees and cancellation/refund rules before submission; no invented default amount or automatic spiritual-approval linkage.

### S21.11

**Question:** Which real payment methods are accepted at launch, who records receipt, and what proof/receipt should the payer receive? Keep recorded bank/OMT/cash separate from a future payment gateway.

**Proposed answer:** Record actually received cash, bank transfer and OMT where the parish genuinely uses them, including amount/currency, payer, date, method, reference and operator. A claimed transfer stays Pending verification until confirmed.

Issue an attributed receipt for the recorded transaction and allocated participant(s), using approved language/layout. Card/online payment appears active only through a real configured processor; recording a method name is not collection. Handle receipt-upload failure separately from saved money. Reconcile actual payments to Finance once, without duplicating event balances.

### S21.12

**Question:** Can payment be received in a different currency, exceed the balance, cover several participants or be recorded by someone other than the participant? Define the allocation and review experience.

**Proposed answer:** Default event balances use the locked event currency. Different-currency receipts require an authorized finance conversion/allocation with original amount/currency, rate/date/source and resulting event-currency credit, not an unlabeled conversion in a simple participant form.

A payer can cover several participants through explicit allocations and authorized receipt visibility. Block casual overpayment in participant entry; route excess to a reviewed unallocated credit/refund process, not an automatic donation. Preserve payer versus participant identity and reconciliation references. If that allocation path is unavailable, direct the case to the office instead of simulating it.

### S21.13

**Question:** How should payments be corrected or reversed while preserving history, and what links should exist to Finance without recording the same money twice?

**Proposed answer:** Corrections use attributed reversal/adjustment entries tied to original receipts, not deletion of received payments or rewriting the payer/currency silently. A finance-authorized reviewer approves consequential corrections and refunds.

Maintain one transaction identity with event allocations and a Finance projection/link, distinguishing paid, allocated and refunded amounts. Retry must not create another payment. Participant details show current balance plus original/reversal history. Preserve prior receipts as superseded/corrected and produce a new document where needed, without changing issued copies invisibly.

### S21.14

**Question:** What happens when a participant/event is cancelled: place release, waitlist action, transport adjustment, fee policy, refund approval and applicant-visible explanation?

**Proposed answer:** Cancellation preview shows participant/event, place/transport release, future notifications, fees retained/waived and refundable amount under the published policy. Authorized staff approve financial outcomes; cancelling a place alone is not a completed refund.

Notify affected applicants, transport owners and eligible waitlist coordinators through actual channels. Keep payment/consent history and cancellation reason. Event-wide cancellation handles each participant's outcome separately and reports partial failures. Reopening requires fresh capacity/eligibility checks rather than silently restoring every cancelled place.

### S21.15

**Question:** Which form details may change after registrations begin, and how should event moves, currency changes or revised consent wording be handled when the current form is locked?

**Proposed answer:** Ordinary text/help corrections may be versioned for future applicants; event identity/currency remains locked once participants exist. A real move/change uses a reviewed amendment or replacement linked event/form, with old/new facts and explicit participant consequences.

Material consent, date, venue, transport or fee changes trigger reconfirmation/withdrawal/refund options as appropriate. Existing charge/consent snapshots remain. Do not use the form builder to silently move payments between currencies or rewrite what people accepted. Calendar/resource changes must remain synchronized and conflicts rechecked.

### S21.16

**Question:** What should staff and applicants see for legacy unlinked forms, duplicate participants, closed registration, unpaid balances and registration confirmation that has not actually been delivered?

**Proposed answer:** Legacy unlinked forms show **Needs event link — not accepting new registrations**, even if a historical Open flag exists. Review and reconcile their participants/capacity before activation.

Duplicate participants resolve to the canonical event registration, not another paid place. Closed/full forms show clear contact/waitlist routes. Unpaid, partial and waived balances are distinct from reservation/consent. **Confirmed** means saved operational confirmation; **Notification not sent/failed** describes actual delivery separately, with retry/manual follow-up rather than fake external confirmation.

## S22

**Check-in, child pickup, incidents and emergency rosters**

### S22.01

**Question:** Which events and participants require check-in, and who will operate it on which devices at the door?

**Proposed answer:** Enable event-specific check-in for registered activities needing arrival tracking, transport or guardian pickup; do not collect individual Mass attendance. Select the exact event/date/location before operating.

Authorized trained door staff use scoped laptop/tablet/phone views with minimal participant information. Assign an event lead responsible for exceptions and reconciliation. Access expires or narrows after the duty; it does not grant full People/medical histories. Show confirmed/eligible roster and explicit expected/present/not-arrived counts, not a parish-wide headcount.

### S22.02

**Question:** What identifies a participant: name search, registration reference, QR/code, household lookup or printed list? Which fallback is required?

**Proposed answer:** Support permitted name/reference search and optional QR/code when genuinely implemented, with household-assisted lookup revealing only necessary authorized participants. Confirm identity/event before marking arrival; a reference alone is not general access to personal records.

Provide a dated authorized printed roster/manual recording fallback. Avoid public displays of full contact/medical/pickup information. A scan identifies a registration but still checks status/consent and duplicates. Missing participants go through reviewed walk-in registration, not a free-text arrival that silently creates membership.

### S22.03

**Question:** Can a walk-in register and check in immediately, and how should staff resolve full capacity, missing consent, unknown age and unpaid fees?

**Proposed answer:** A walk-in can complete the same registration and eligibility checks before arrival confirmation, subject to real capacity and permitted event policy. Missing required consent or uncertain age prevents ordinary confirmation/check-in until authorized review resolves it.

Unpaid fees block only if the approved event policy makes them a prerequisite; payment is not substitute consent. Full capacity leads to waitlist/alternative, not an unrestricted override. Trained leads record exceptional handling under the agreed safeguarding procedure, with identity, reason and actual responsible decision-maker.

### S22.04

**Question:** Which alerts must appear before check-in, and who may see medical, allergy, guardian or pickup restrictions without exposing them to bystanders?

**Proposed answer:** Before arrival, show only actionable restricted alerts for authorized operators: applicable missing consent, verified pickup restriction, relevant declared allergy/medical support information and required supervisor review. Use privacy-conscious indicators that open detail away from bystanders.

Medical information is supplied/reviewed data, not clinical advice or a guarantee of safety. Do not print sensitive alerts on publicly visible badges or expose them in general lists. Guardian/contact details are limited to designated event/incident staff. Every override/review follows the approved event policy and history.

### S22.05

**Question:** How should duplicate arrival, wrong-event selection, checkout/reentry and corrections to an arrival time be handled?

**Proposed answer:** Reject duplicate active arrival with an explanation and show the actual existing state. Wrong-event attempts offer authorized correction, never silently move attendance. Checkout and reentry create separate timestamped events rather than overwriting arrival.

Corrections preserve original entry, actor, reason and true edit time. A later record on another device must be reconciled before another check-in. Participant status changes trigger revalidation, including consent and event cancellation. No countdown or elapsed event time automatically implies checkout or completed authorized pickup.

### S22.06

**Question:** Who defines authorized collectors, verifies their identity and records pickup restrictions? Is the authorization global, event-specific or both?

**Proposed answer:** Keep reviewed guardian/collector relationships as reusable evidence with event-specific confirmation and restrictions. The permitted guardian/office reviewer proposes collectors; authorized event staff verify actual collector identity at release.

Restrictions, effective dates and supporting review remain confidential. Updating a family relationship does not silently clear an event pickup restriction. The event record identifies who may collect, any conditions and the responsible lead. No household/contact label alone establishes authority. Cross-parish collection information is shared only through an explicitly permitted purpose.

### S22.07

**Question:** How is a pickup code issued, delivered, replaced if lost and checked? Is a matching code alone sufficient, or must staff also verify the collector?

**Proposed answer:** Issue a nonpublic event/participant-session pickup code through an actual supported delivery/print process to the authorized contact. Display a confirmation of creation versus delivery and mask it in ordinary staff lists.

Check code together with the approved collector list and identity procedure; matching code alone does not override restrictions. A lost/replaced code requires authorized verification, invalidates the old one and records actor/reason. End its use after actual authorized collection/session completion. Never send to an unverified substituted contact or simulate successful code delivery.

### S22.08

**Question:** What must happen when an unauthorized or restricted person arrives, a guardian cannot be reached, or staff need to record an exception? Name the real decision owner and escalation route.

**Proposed answer:** An unauthorized/restricted collector must not receive an ordinary release action. Keep the participant under the event's approved supervision process and escalate to the named safeguarding/event lead and verified guardian contacts according to that procedure.

If contact fails, follow the preapproved escalation plan rather than invent an exception at the door. Record facts, responsible decisions and restricted incident follow-up. A generic admin/priest rank or free-text reason must not automatically bypass a restriction. Real decision owners and their contact arrangements are mandatory event setup inputs.

### S22.09

**Question:** When a participant can leave independently, who records that permission and what checkout evidence is needed?

**Proposed answer:** Independent departure requires an explicit event-policy permission and verified guardian/participant authorization where applicable, recorded by an eligible reviewer. Make **May leave independently** separate from missing pickup configuration.

Checkout records participant, event, actual departure time, operator/method and any required acknowledgment. An unavailable guardian/code is not proof of independent permission. Changes after arrival need approved review and history. Exact eligibility/age rules are supplied by safeguarding owners rather than guessed from account signup age.

### S22.10

**Question:** Should incident reports link to event, person and location while remaining accessible only to authorized staff? Which information should guardians or other participants receive?

**Proposed answer:** Link incidents to event, location and involved persons where known, while retaining parish-wide restricted search for authorized handlers. Existing unlinked reports remain labeled historical/parish-wide until reviewed; do not invent event links.

Record factual description, immediate actions, witnesses/contacts as appropriate and assigned reviewer. Guardians/subjects receive relevant reviewed communications, not a full report containing others' private information. Ordinary leaders, office users and public calendars do not inherit access from event participation. Export and amendments require explicit incident permission.

### S22.11

**Question:** What incident lifecycle is required: initial record, immediate response, assigned reviewer, follow-up, notifications, resolution and restricted amendments?

**Proposed answer:** Use Recorded → Assigned/triaged → Follow-up → Resolved → Closed, with reopening/correction and a retained initial report. Urgency triggers the real approved contact/escalation procedure, not an automatic claim that help arrived.

Name the responsible handler, required actions/deadlines, communications and evidence. Reviewer-only notes and guardian-facing messages are separate. Restrict edits to attributed amendments; preserve original facts and actual entry time. Closure records outcome/remaining restrictions without deleting evidence. The event's qualified safeguarding authority approves this process before operational use.

### S22.12

**Question:** What should an emergency roster include and explicitly exclude? If you need everyone in a building, what additional attendance process would provide that information?

**Proposed answer:** Event emergency rosters list currently checked-in participants, event/location, last update and authorized staff/contact details needed for the purpose. Exclude checked-out people and state the data's coverage/connection status clearly.

Label **Selected-event roster — not everyone in the building**. Unknown/manual/offline entries are flagged until reconciled. Whole-building occupancy would require an additional controlled entry/exit process covering staff, visitors and all activities; this document does not pretend event registration supplies it. Printed copies are purpose-limited and handled under approved confidentiality procedures.

### S22.13

**Question:** During a connection failure, what exact check-in/pickup fallback should staff follow, and how should paper/offline records be reconciled later?

**Proposed answer:** Use a prepared dated roster and manual arrival/checkout log under the trained event lead when connection fails. Apply the same identity/consent/pickup rules through available verified records and approved direct contacts; do not bypass restrictions because the screen is offline.

Record actual action time, operator and source. Once online, reconcile duplicates/conflicting timestamps and guardian changes before importing, with reviewer approval and exception report. Do not label manual entries synchronized before confirmation. Keep paper records securely and dispose/retain them under the approved event policy.

### S22.14

**Question:** What wording and training must make clear which emergency functions actually work at launch, especially since emergency broadcast delivery is not connected?

**Proposed answer:** Training and screen labels must state which roster, contact and alert functions actually operate, their last refresh and manual fallback. Emergency broadcast remains unavailable until delivery and monitoring genuinely exist.

A button that only records a request must not imply emergency services or guardians were contacted. Test event selection, role restrictions, restricted pickup, connection failure and printed roster handling with actual operators. Name the event lead and escalation contacts before check-in opens; do not populate these with sample phone numbers or assume the priest is continuously online.

## S23

**Facilities, reservations, equipment, maintenance and renters**

### S23.01

**Question:** Which bookable resources exist: rooms, halls, outdoor areas, entire buildings, equipment or combinations? Which properties affect availability and eligibility?

**Proposed answer:** Model rooms, halls, outdoor areas, equipment stock and explicitly defined resource combinations. Record parish/site, capacity, accessibility facts, operating hours, setup/cleanup, permitted uses, approval owner, fees and maintenance/availability state.

A whole-building or partitioned-room booking has defined shared/exclusive dependencies so another room cannot be falsely offered. Equipment quantities differ from exclusive-room slots. Resources stay scoped to their owning parish even in a combined overview. Unsupported or out-of-service items are clearly unavailable rather than merely absent from search.

### S23.02

**Question:** Who can see availability and request each resource: public guests, members, group leaders, staff and external organizations?

**Proposed answer:** Public guests, followers, members and external organizations can see approved free/busy availability and submit permitted requests; leaders/staff can request within their duties. Actual approval follows resource/purpose policy, not public submission rights.

Office/resource managers see permitted applicant details, deposits and constraints. Private spaces can be office-only or invitation/request-only. A parish can disable new online bookings while retaining existing tracking/contact. Viewing availability does not expose another renter's contact, family event or internal pastoral reason.

### S23.03

**Question:** What should a free/busy view reveal about other reservations, and should public users see different detail from staff?

**Proposed answer:** Public availability shows bookable times, generic Busy/Unavailable intervals, resource features and relevant rules. It does not reveal requesters, titles of private events, deposits, guests or evidence.

Staff with reservation permission can see operational details; event/group participants receive their permitted activity facts. Use the same redaction in calendar export, list, tooltip and print. A pending unheld request can be disclosed as **Requests awaiting review** only if useful without identifying people; do not present it as a confirmed booking.

### S23.04

**Question:** When does a request hold a slot: submission, office acceptance, priest confirmation or deposit? Define hold duration and what actually ends an expired hold.

**Proposed answer:** Submission alone does not exclusively hold a slot. Eligible office staff may place an explicit temporary hold with owner, purpose and expiry; propose 24 hours, configurable and visibly renewable. Confirmed approval creates the actual reservation; any required deposit is a separately published condition.

Availability must release genuinely expired holds consistently, not rely on a decorative countdown. Reminders need a real mechanism; if expiry is manual, label that arrangement rather than pretend automation. Applicants see Request received, Temporarily held and Confirmed as different states.

### S23.05

**Question:** If two requests compete, should accepting one automatically refuse the other, move it to a waitlist, or ask staff to propose alternatives? Confirm the message and consent before this side effect.

**Proposed answer:** Approving one exclusive booking must not silently reject every competing applicant. Preview affected requests, confirm the winning reservation, then place unresolved competitors in **Time unavailable — alternative needed** for staff/applicant follow-up.

Offer alternative date/resource, waitlist or an explicit reasoned refusal. A confirmed booking is not displaced without authorized cancellation/reschedule. Notify only necessary facts, not the winning family's identity. Preserve all histories and recheck availability at commit so two simultaneous approvals cannot both claim the slot.

### S23.06

**Question:** What are the approval stages by resource/requester/purpose, and can office administrators confirm routine bookings without a priest?

**Proposed answer:** Default to office review/preparation followed by priest confirmation, matching the existing parish booking chain. A priest may confirm directly. Routine non-sacramental resource confirmation can be explicitly delegated by the priest to an authorized office/resource role, with defined resources/purposes/dates.

High-impact use, exceptional terms or religious decisions still require the relevant authority. A sacramental request's clergy approval is not replaced by room approval. State which authority is next and log actual actor/delegation. The secretary's specific sacramental proxy rule does not automatically authorize every operational delegation.

### S23.07

**Question:** How should setup, cleanup, opening hours, multi-day bookings, recurring use and partial-room combinations affect conflicts?

**Proposed answer:** Availability includes setup and cleanup on both sides, genuine operating hours, multi-day dates and each recurring occurrence. All-day use explicitly defines the occupied period, not an arbitrary default 24 hours.

Partition/whole-room dependencies and quantity-based equipment are checked together. Out-of-hours use requires the resource's approved exception route; hard capacity/physical exclusivity remains enforced. Preview series conflicts and allow deliberate selection of valid dates without falsely confirming the whole series. Past days remain viewable but not ordinarily bookable as new reservations.

### S23.08

**Question:** Should creating a reservation also create a calendar event, service plan or registration form? Which record owns date/time changes?

**Proposed answer:** A confirmed reservation links to one canonical event where scheduling needs it; private/public visibility remains separate. Optional service plans and registration forms are created deliberately, not for every room use.

The reservation owns resource timing/terms; linked event date changes use a coordinated workflow that rechecks availability and participant implications. Display source links and prevent two independent editors from creating contradictory times. A cancelled event prompts reservation/resource review rather than leaving an invisible occupied slot or silently issuing a refund.

### S23.09

**Question:** What booking details and documents are required, including purpose, guests, responsible adult, equipment, access arrangements, insurance/agreements if your parish requires them?

**Proposed answer:** Capture requester/authorized responsible adult or organization, contact, purpose, date/time, resource, expected attendance, setup/cleanup, equipment and access/keys needs. Collect only actual parish-required evidence/agreements, with version and review status.

Insurance or special permissions apply only where the approved policy requires them, not as invented national requirements. Show public versus office-only descriptions separately. The applicant reviews terms/charges/cancellation information before submitting. Identity/authority verification remains necessary for sensitive documents or privileged use, and a reservation form must not expose private account information.

### S23.10

**Question:** How should pricing, deposits, waivers, balance due and refunds work, and where should these payments appear without duplication in Finance?

**Proposed answer:** Resource owners/priest/finance authority approve actual prices, deposits, waivers, deadlines and refund rules. Snapshot agreed terms per booking; do not alter existing balances when the public rate changes.

Record actual receipts, allocations and refunds under one financial transaction reference linked to the reservation/Finance view. Deposit received, booking confirmed and balance paid are separate states. No payment method or electronic charge is simulated. Material fee changes require applicant explanation/acceptance under the approved process, and exceptions preserve reason/approver.

### S23.11

**Question:** Can applicants reschedule or cancel confirmed bookings, and how should fees, competing holds, room staff and linked events be updated?

**Proposed answer:** Applicants can request rescheduling/cancellation from own tracking; before approval an unheld request may be withdrawn directly. Confirmed changes require permitted office/priest handling, availability checks and the published fee/refund rules.

Preview old/new times, holds, participants, equipment and linked event/form consequences. Notify resource/access staff and affected applicants through real channels. Cancellation creates a dated outcome and finance follow-up, not deletion. A successful reschedule updates related records coherently while retaining original terms/history; partial failures remain visible tasks.

### S23.12

**Question:** When maintenance blocks a room with existing bookings, must the system prevent it, require a relocation plan, or notify affected applicants after a reviewed decision?

**Proposed answer:** Maintenance creation previews all affected confirmed reservations, holds and linked events. Routine work requires a reviewed relocation/reschedule plan or different maintenance period before blocking booked use.

An urgent unsafe-resource block may take immediate effect under the designated authority, with explicit affected-booking follow-up and genuine direct contact rather than silently preserving unusable confirmations. Do not auto-cancel payments or issue refunds. Record reason, responsible repair owner, expected period and clearance; current safety availability is not a cosmetic calendar note.

### S23.13

**Question:** How should equipment quantity, condition, storage, reservations, check-out, due date, return and damage/loss be recorded? Can a room booking reserve equipment atomically?

**Proposed answer:** Equipment records owner, quantity/serial where applicable, storage, condition, serviceability and permitted loan/reservation policy. Track reservation, issue, due date, borrower, returned quantity/condition and missing/damaged items.

A room request can reserve specified available equipment in the same reviewed commitment; if any required component fails, do not claim the complete package confirmed. Different parish ownership needs explicit permission. Loans/returns create attributable stock movements, while damage creates a linked issue and any financial action needs separate approval. Never infer return merely because the due date passed.

### S23.14

**Question:** Who can report/triage an issue, assign repair, mark a resource unusable and restore it? What evidence, costs and notification close the issue?

**Proposed answer:** Authorized users report issues with resource/location, factual description, urgency and evidence. Resource/maintenance leads triage, assign repair and decide serviceability within their authority; operators cannot falsely clear their own unresolved hazard.

Completion records actual work/evidence/cost and qualified clearance where required, then restores availability deliberately. A repair bill is linked to Finance once, not posted merely from an estimated cost field. Notify affected reservation owners and preserve history. Escalation uses actual named roles/contacts and never implies external services were called automatically.

### S23.15

**Question:** What information should external renter records contain, who may view it, and how do a guest requester and an external renter become the same recognized customer if appropriate?

**Proposed answer:** Keep an external renter/customer record with necessary name/organization, responsible contact, verification/terms references and booking/payment history, separate from parish membership. Restrict private contact/evidence to authorized office/finance roles.

A guest case can be linked to an existing renter after review; do not merge by name/phone alone. Account creation later uses reviewed association without granting community/staff access. Historic agreements and finance references remain attached to their transactions. Public availability never exposes renter identity or financial standing.

### S23.16

**Question:** Which availability/reservation metrics are actually useful, how are they calculated and what should display when there is not enough recorded data for a reliable figure?

**Proposed answer:** Useful measures are confirmed booked hours against actual available resource hours, request-to-decision time, cancellation/refusal reasons, unresolved alternatives, equipment utilization/overdue loans and maintenance downtime. Show period, parish/resource, included statuses and source coverage.

Exclude blocked/closed hours from an availability denominator as defined, and distinguish requested from confirmed use. Missing schedules/history yields **Insufficient recorded data**, not fixed percentages or zero delay. Drill-down lists must reconcile with totals while hiding private fields from unauthorized viewers. National comparisons are contextual operational analysis, not automatic parish rankings.

## S24

**Giving, envelopes, counting, pledges and receipts**

### S24.01

**Question:** Which kinds of giving must be recorded, and which are anonymous, household-attributed, person-attributed, restricted or linked to an appeal?

**Proposed answer:** Record actual cash/bank/other permitted gifts, one-time or pledged/standing, with optional person/household attribution, fund/campaign and restrictions. Anonymous gifts retain amount/method/fund without a hidden donor link.

Household envelopes identify the household contribution source, not every member as donor. Restricted gift purpose remains traceable through allocation/reporting. An appeal's public totals do not expose donor names by default. Distinguish promised amounts from received money and a draft count from a posted contribution.

### S24.02

**Question:** Who may see donor identity and amounts in lists, profiles, reports and exports? Should priests, administrators, leaders and financial viewers see different detail?

**Proposed answer:** Treasurer and explicitly authorized finance operators access necessary donor details; priests/head and diocesan/system viewers receive the scope their approved finance grant permits. Ministry leadership and ordinary office access do not automatically expose giving amounts.

Default broader oversight to aggregates unless itemized identity is explicitly authorized. Person-profile giving, search, print and exports enforce the same field rules. Anonymous giving remains anonymous in ordinary records. A finance viewer may read/export only the approved subset, not edit transactions or unmask donors through another report.

### S24.03

**Question:** How should an envelope number find a household, and what should happen for unknown, changed, duplicated or blank envelope identifiers?

**Proposed answer:** Resolve a supplied envelope against the parish's dated household envelope assignments and show the household for confirmation. Blank/unknown numbers are recorded as unattributed pending review, without generating a guessed identifier.

Duplicate/conflicting assignments stop attribution; an authorized finance reviewer resolves them with evidence. Changes/splits preserve old identifier history and past gift links. Do not silently reassign historic giving when a current contact or household changes. Later attribution is a reviewed adjustment with original/source preserved.

### S24.04

**Question:** What information must a contribution capture: actual currency/amount, received date, fund, campaign, donor/household, method, reference and anonymity choice?

**Proposed answer:** Capture actual received amount/currency, date, method, fund/restriction, optional campaign, payer/donor/household where authorized, envelope/reference, source/count batch and anonymity choice. Conversion fields exist only when a rate was actually applied or a labeled report equivalent is produced.

Validate positive receipts and record reversals separately. Required facts depend on method: verified bank reference versus actual cash count. Keep external proof restricted and do not create a paid receipt for a pledge or unverified claimed transfer. Source identity and entering account remain separate.

### S24.05

**Question:** Confirm that a gift received in LBP is entered and retained as its actual LBP amount. How should a user distinguish that from a displayed USD equivalent?

**Proposed answer:** A received LBP gift is stored and entered as its actual LBP amount, not as a USD amount multiplied by a current rate. Likewise retain actual USD receipts independently.

Show separate cash totals and label any optional converted figure **Reporting equivalent at [rate/date]**. Preserve transaction-rate/source where applicable; a later parish-rate change does not rewrite the original receipt or closed count. Allow decimal/rounding rules appropriate to the approved currency policy and show adjustments explicitly. No mixed-currency total is labeled actual cash.

### S24.06

**Question:** Who opens a counting session, what identifies its source/date and how are cash, bank and other payment totals kept separate?

**Proposed answer:** Authorized counters/treasurer open a uniquely referenced session with parish, collection source/date, currencies, methods, funds and assigned counters. Separate cash denominations/totals from bank/other receipts so a bank line is not counted twice as cash.

Save draft lines with provenance and current revision. Show expected versus actual amounts where a real independent source exists, not sample verification. Closed batches are locked; additional collection money starts another session or an authorized adjustment. Accounts and responsibility remain individual, not a shared counting login.

### S24.07

**Question:** What does a genuine second count involve: independent totals, line-by-line review, a second person's authenticated approval, or another procedure?

**Proposed answer:** Require an independent second person's actual review of amounts/currencies, envelope/fund attribution and cash against the batch. Prefer authenticated confirmation by a distinct eligible account after comparing totals; identify the exact revision reviewed.

If a real paper verification process is permitted, record that source, actual verifier and evidence with appropriate independent review, labeling it as paper-recorded rather than falsely saying both users signed in. Switching roles/accounts under one person's control is not a second count. Any changed line invalidates the relevant prior verification until reviewed again.

### S24.08

**Question:** What should happen when counts disagree or a second counter is unavailable? Which exceptional actions are allowed, by whom, with what evidence?

**Proposed answer:** Disagreement leaves the session open with a recorded variance and assigned recount task. Preserve both observations and correction history; do not change a displayed total simply to make it agree.

If no second qualified person is available, keep funds/count as pending verification and use the approved custody/escalation procedure. Any permitted exceptional closure needs an independently authorized reason/evidence and must remain visibly exceptional, not a fabricated two-counter success. The priest/finance owner defines that exception; this draft does not grant ordinary counters unilateral bypass.

### S24.09

**Question:** When closing a session, which balances/records are posted, what becomes locked, and what confirmation proves completion rather than showing fixed sample success text?

**Proposed answer:** Closure validates complete receipts/allocations, genuine independent verification, current revision and actual totals by currency/method. It posts the canonical transactions/fund movements once, fixes the closing reference/snapshot and locks lines.

Confirmation shows actual result, posted references, reviewers and time. If response is lost, query the same session's state before retrying. No fixed session number/named sample verifier appears as real evidence. Subsequent correction uses reversal/adjustment entries; closing does not itself prove a bank deposit occurred or send donor receipts externally.

### S24.10

**Question:** How should errors after closure be reversed/corrected, including wrong donor, wrong fund, incorrect currency and cancelled bank payment?

**Proposed answer:** Link every post-close reversal/correction to the original contribution and reason, with eligible finance approval. Wrong fund/donor allocation is reclassified without deleting the original trail; wrong amount/currency or failed payment gets the appropriate reversal/new receipt.

Reconcile affected fund, donor/household statements, campaign totals and bank matches. Reissue corrected receipts with version/reference and explain supersession. Avoid treating a cancelled bank payment as still collected money. Do not back-edit closed totals or retroactively apply today's rate to hide the difference.

### S24.11

**Question:** What do pledges and standing gifts promise operationally: expected payments, reminders, allocations or actual automatic collection? Confirm launch behavior where no payment processor exists.

**Proposed answer:** Pledges represent promised amounts and schedules; standing gifts represent expected recurring contributions, not authority to automatically charge anyone. Record each actual receipt separately and allocate it to a pledge where appropriate.

Reminders run only through a real configured service or assigned manual worklist, with preferences and no false delivery state. Pausing a pledge/standing record stops future expectations/reminders, not historical receipts. Payment processing would require a separate approved integration/consent workflow; no bank debit follows from toggling Active in this installation.

### S24.12

**Question:** Who creates/ends campaigns, what should be public about progress and donors, and how should restricted or excess funds be handled in the interface?

**Proposed answer:** Authorized priest/finance campaign owners create/end appeals with approved purpose, fund/restriction, dates, genuine target and public content. Totals derive from actual eligible received transactions, distinguishing pledges, refunds and reporting equivalents.

Public donor names require separate publicity approval; anonymous gifts are not unmasked through campaign reports. Restricted/excess-fund handling follows approved donor/parish policy and requires a recorded authorized reallocation rather than automatic redistribution. Closing a campaign stops new ordinary solicitation but preserves transactions/history and any outstanding pledge follow-up.

### S24.13

**Question:** Which contribution receipts and annual household statements are required, who reviews them and how are corrections/reissues recorded? What wording confirms their actual status and purpose?

**Proposed answer:** Provide individual contribution receipts and annual household statements showing issue reference/date, actual currencies, allocations and applied historical conversion where relevant. Authorized finance staff review; a document's status/purpose must be described accurately, without unsupported tax/legal claims.

Corrections create superseding versions and retain earlier issuance. Household statements use an explicit authorized recipient, not every household account. Generate in EN/FR/AR layouts with long-name/page-break checks and a preview of scope. Sent/delivered means actual channel evidence, distinct from receipt creation/download.

### S24.14

**Question:** Should members see their giving history or download statements, and how does household attribution affect what one household member may see?

**Proposed answer:** Members may see verified contributions attributed to themselves and request/download approved statements where the office enables this securely. Household-level giving is visible only to an explicitly authorized household finance contact or representative, not automatically every adult/child on the household record.

Anonymous or unverified entries remain appropriately restricted. A member can request attribution correction without directly editing money. Show pending verification and refunds clearly. Identity association to donor records is office/finance-reviewed; login contact or shared surname alone must not disclose donation history.

## S25

**Finance, approvals, reconciliation and Office Expenses**

### S25.01

**Question:** Is ParishLife intended as the authoritative parish accounting system or an administrative ledger alongside another accounting process? What information must be exchanged with that process?

**Proposed answer:** Treat ParishLife initially as a controlled parish administrative/financial ledger, not automatically a certified replacement for every existing accounting obligation. Finance owners approve whether particular ledgers become authoritative and how they reconcile to external books.

Exchange approved transaction references, dates, actual currencies, funds, counterparty subsets and reconciled totals through reviewed exports/imports. Maintain one source per movement and explicit mappings. Reports state scope/coverage and exclusions. Accounting classifications, statutory obligations and official retention rules require the competent finance/policy owners, not assumptions derived from UI labels.

### S25.02

**Question:** Which roles may view, enter, approve, pay, reverse, reconcile and export each financial record? Can the person submitting a payment/expense approve it?

**Proposed answer:** Separate view, entry, approval, payment recording, reversal, reconciliation, period close and export grants. Treasurers/authorized operators enter; designated priest/finance approvers decide within limits; viewers remain read-only.

Prohibit a submitter from serving as the independent required approver/reconciler merely by switching roles. Priests/administrators receive only explicitly approved financial scopes. Office Expenses duties do not imply full donor/Finance access. Staff records of offline payment evidence identify actual payer/verifier and do not manufacture independent approval. Every consequential action has actor, authority and time.

### S25.03

**Question:** What funds, restrictions, budgets and reporting periods are required, and who can create/change them or move money between them?

**Proposed answer:** Finance owners configure real funds, purpose/restrictions, budgets, periods and permitted accounts/currencies. The head priest and finance lead approve significant setup/budget changes; diocesan rules apply where established.

Transfers are explicitly linked movements between funds/accounts, not new income/expense automatically counted twice. Restricted-fund movement requires the applicable reviewed authority and reason. Closed historical budgets retain revisions and actuals. Do not invent national chart-of-account categories from seed data; show setup incompleteness and block transactions needing missing fund classification.

### S25.04

**Question:** What makes an expense draft, submitted, approved, paid, rejected or reimbursed? Confirm whether amount thresholds such as those shown in current UI should actually determine approval authority.

**Proposed answer:** Draft is entered but unsubmitted; Submitted awaits eligible review; Returned needs information; Approved authorizes the expense; Paid records actual outflow; Reimbursed records actual repayment to a claimant; Rejected/Cancelled preserves reason/history.

Approval and payment are separate. Configure amount/currency/fund-specific limits through priest/finance policy; current sample thresholds are not adopted as national rules. Evaluate the relevant total, including split-related claims, and prevent self-approval. A received invoice is not proof of payment, and a paid expense should not remain presented as awaiting money movement.

### S25.05

**Question:** What expense evidence is mandatory, how are missing receipts handled, and what should distinguish a supplier invoice, actual payment and a reimbursement claim?

**Proposed answer:** Require description, purpose/fund, payee/claimant, date, amount/currency and available invoice/receipt evidence, with explicit status for missing evidence. A permitted missing-receipt exception needs reason and named approval, not an automatically attached sample file.

Distinguish invoice obligation, actual supplier payment and reimbursement claim so one purchase is not paid twice. Restrict bank/identity documents and show relevant reviewers only. Partial payments and multiple receipts link to the same obligation. Attachments failing after a saved transaction remain a clear follow-up rather than silently disappearing.

### S25.06

**Question:** For each transaction, which original currency, rate/date/source and converted amount must be stored and displayed? Who may override a rate and what reason must appear?

**Proposed answer:** Store actual original amount/currency, transaction/receipt date, method and source reference. Where conversion/allocation occurs, also preserve applied rate, rate date/source, resulting amount/currency and rounding adjustment.

Authorized finance roles set/override rates with a reason; historic records retain their original snapshot. Today's rate can support a separately labeled reporting view, not overwrite old vouchers. Different-currency event payments use this reviewed allocation path. Missing/ambiguous rate blocks a claimed converted total but not a legitimate separately recorded original-currency receipt.

### S25.07

**Question:** Which screens need separate currency balances versus a reporting equivalent? Define rounding and the presentation of mixed-currency totals so users cannot mistake them for actual cash.

**Proposed answer:** Cash/fund/office balances display USD and LBP independently. Consolidated reports may show a labeled reporting equivalent with chosen rate basis/date and exclusions, never as a single physical-cash balance.

Propose USD to two decimal places and LBP to whole units for ordinary display, with any approved operational precision retained internally and documented rounding entries. Show fees/rate gains/losses only under the approved accounting model, not invented balancing values. Sum actual allocations in their recorded currency before conversion and expose meaningful reconciliation differences.

### S25.08

**Question:** How should bank lines enter the system, and what matching choices are needed for split/combined payments, fees, duplicates and unmatched differences?

**Proposed answer:** Import bank statements through reviewed templates or enter verified lines manually, retaining bank account, original reference/date/currency/amount and source batch. Preview duplicates and date/format ambiguity before commit.

Match one-to-one, split and combined payments, deposits and fees through explicit allocations whose totals reconcile. Unmatched differences remain outstanding with owner/reason, not auto-assigned to a sample counting session. Duplicate-safe retries and review of suspicious repeats prevent double posting. Bank availability is not proof all corresponding parish transactions have been recorded.

### S25.09

**Question:** What review confirms reconciliation, who may undo a match and what should be locked when a month/year is closed?

**Proposed answer:** A qualified independent reviewer checks statement coverage, unmatched lines, allocations, fees and balances before reconciliation/period close. Record period, actor, source statements and exceptions.

Only authorized finance roles can undo a match with reason; after close use a reviewed reopening/adjustment, preserving the original reconciliation. Locked periods prevent ordinary edits to affected receipts/expenses/rates. Closing a month/year must not delete evidence or invent missing matches. Show outstanding issues and the impact of any correction on subsequent opening balances.

### S25.10

**Question:** Should event fees, room rentals, refunds and contributions share Finance transaction references? Define the source of truth so money is counted once.

**Proposed answer:** Use one canonical transaction identity for each actual receipt/payment/refund, with event, reservation, contribution or other purpose linked through allocations. Domain screens show their relevant balance and Finance shows the authorized consolidated projection.

Do not create another expense/income merely because a module saves an already recorded payment. Partial/group payments maintain explicit allocations; reversals reference the original. Source method/reference, currency and actual time stay consistent across views. Reconciliation totals can drill into these links without exposing unrelated private participant or donor fields.

### S25.11

**Question:** Confirm the intended separation of Office Expenses from Finance. How is an allowance transferred into the office ledger represented in overall reporting without double-counting it?

**Owner direction applied:** Office Expenses remains a separate operational allowance/purchase ledger, not a duplicate copy of parish Finance expenses. Link an office allowance to the source cash/account transfer where Finance records it.

**Proposed completion:** Consolidated reporting eliminates internal transfer duplication: moving allowance to office cash is not new parish income plus a second purchase expense. Actual office purchases contribute once under the approved reporting mapping. Separate USD/LBP balances and transaction references remain. Finance owners approve mappings and any external-book export, with a reconciliation of office cash and actual spend.

### S25.12

**Question:** Who may enter an office opening balance, and how should duplicate/incorrect opening balances, negative balances and corrections to previous months be handled?

**Proposed answer:** Only permitted office/finance setup users enter the initial balance once per currency, with effective date, provenance and review. Later months carry balances forward automatically; another month is not a reason to add a second opening balance.

Wrong openings or backdated corrections require reason and period/reconciliation review. Show negative balances as real exceptions needing investigation, not an automatic invented allowance. Preview effects on later months and linked transfers before committing. Closed periods use adjustment/reopening rules rather than silent recalculation of approved vouchers.

### S25.13

**Question:** Should office transactions allow edit/delete as now, require reversals, or use different rules before and after monthly review? What should happen to their receipts?

**Proposed answer:** Draft/unreviewed office entries may be edited or removed with appropriate history and attachment handling. Once included in a reviewed monthly close, prefer reversal/adjustment and replacement vouchers rather than destructive edit/delete.

Retain original receipt evidence under approved policy; removing a visible attachment link is not permission to erase required evidence. Show balances before/after and downstream period impact. The owner must approve the final deletion-versus-reversal rule; this answer resolves it as a proposed control rather than assuming the current unrestricted CRUD behavior is final.

### S25.14

**Question:** Which printed vouchers, receipts, monthly summaries and exports are required, in which language/currency, and which need signatures or named approval?

**Proposed answer:** Provide internal office vouchers, supplier/payment receipts where appropriate, allowance records, monthly office summaries, fund/budget reports and reviewed reconciliation/export packs. Clearly distinguish internal vouchers from supplier originals or official certificates.

Offer approved EN/FR/AR layouts, actual USD/LBP values, historical rate context, references and actor/approver/signature fields genuinely required. Do not insert fake signatures or secretary proxy audit into a priest's official approval name. Reports identify date range, scope, version and generated time; finance/document owners approve final wording and required signatories.

### S25.15

**Question:** Which financial reports and donor details should bishops/diocesan administrators receive: aggregates, itemized transactions, individual identities or explicitly granted subsets?

**Proposed answer:** Bishop/diocesan administration receives authorized parish/fund/currency aggregates by default, with explicit scoped itemized financial access where needed. Donor identity is a separate sensitive field permission, not automatically included because a role can view finance totals.

Super Admin technical scope likewise does not justify all personal transaction details without the approved grant/purpose. Drill-down/exports enforce the same rules and explain incomplete coverage. Restricted gifts, anonymous donors and private evidence remain protected. Cross-parish comparisons need consistent definitions and must not expose individuals through tiny-group summaries.

### S25.16

**Question:** What should a finance viewer encounter when an action requires editing authority, and how should all sample/static financial claims be replaced with meaningful empty or incomplete-data states?

**Proposed answer:** Finance viewers receive actual read/print/export controls for their granted scope, with no transaction-edit or approval actions. A stale editing link shows a neutral access explanation and Request access where appropriate, not a misleading Save button.

Replace static sample metrics, receipt claims and reconciliation success with computed records and explicit No data, Incomplete period, Unmatched items or Integration unavailable states. Show last update/scope and a link to eligible details. Viewing a displayed figure does not imply all source documents or donor identities are exportable.

## S26

**Inbox, staff messaging, notices, prayers and notifications**

### S26.01

**Question:** Which communications should be private conversations, audience announcements, public notices or group posts? Should users compose them from one entry point or different clearly named tools?

**Proposed answer:** Use Inbox for private conversations and an authorized Communications area for audience messages, announcements, group posts and public notices. One clear Compose entry may ask type/audience first, but previews and permissions remain distinct.

Request replies stay linked to their case; public notices require publishing authority. A group post does not send a private message to everyone or become public automatically. Display sender capacity, audience, channel and actual delivery state before final action, preserving the owner's single-home navigation.

### S26.02

**Question:** Who can message whom, including strangers in the same parish, guests, minors, leaders and people in other parishes? Which recipient details should be searchable?

**Proposed answer:** Members contact the office, assigned leaders and permitted existing participants through purposeful recipient choices; do not expose a searchable national personal directory or allow unsolicited cross-parish messaging by default. Guests communicate through their own request/tracking route.

Minor/adult direct contact and group communication follow the approved safeguarding policy, with designated official routes where required. Staff can contact people within their actual task scope, not arbitrary private accounts. Hide login contact details and allow report/block preferences without suppressing necessary case communications through official channels.

### S26.03

**Question:** What identity should a recipient see: individual sender, parish office, ministry or priest? Can staff reply on behalf of a shared office without sharing a login?

**Proposed answer:** Show actual sender and authorized capacity, such as **Parish Office — entered by [staff]** where appropriate. A shared office conversation can be handled by authorized staff with individual accounts and per-action attribution, never a shared password.

Personal conversations remain personal; joining an office team does not expose unrelated private inboxes. Priest-on-behalf sacramental approval remains its specific rule, not permission to impersonate him in arbitrary messages. Official document prints show the responsible priest while internal history records the entering secretary.

### S26.04

**Question:** Are conversations one-to-one or may they include households, staff teams and groups? Who may join later and read earlier messages?

**Proposed answer:** Support one-to-one and explicitly configured office/team/group conversations, with visible participant/audience list. Household membership alone does not join every adult to another person's thread.

Adding recipients requires authority and a preview of prior history disclosure; default to sharing only the intended new content or a reviewed handover, not automatically all historical messages. A group roster change affects future thread access according to its policy and does not disclose departed/private participants' unrelated chats. Preserve sender/recipient history without a browse-all administrative inbox.

### S26.05

**Question:** What are the rules for attachments, reply threads, unread state, archive, retention and recipient notification? Confirm whether sent messages remain uneditable/undeletable.

**Proposed answer:** Sent messages are ordinarily uneditable/undeletable; corrections are follow-ups. Each user controls read/unread and archive for their own view without erasing the recipient's record. Threads/attachments inherit recipient access.

Show attachment limits and actual saved/sent status; expired/withdrawn file access has an explanation. Notification text minimizes private content. Retention/exceptional removal follows approved policy, with restricted audit rather than general publication. Delivery/read confirmation is shown only when genuinely recorded, not inferred from opening another page or saving a draft.

### S26.06

**Question:** Should request discussions happen on the request timeline or in Inbox, and how should both point to the same conversation without duplicate work?

**Proposed answer:** Use one canonical request conversation visible through both its timeline and the permitted Inbox entry, with the same messages/attachments/read state. Replies always identify target request/parish and intended recipient audience.

Internal staff notes remain separate from applicant communication and cannot be sent by reusing one ambiguous field. If a thread is linked to several related records, show that relation without duplicating sends. Guest replies stay scoped to the private case route; linking an account requires office verification before full authenticated access appears.

### S26.07

**Question:** Which notices/posts need approval, pinning, expiry, translation and public/member/group audiences? How does changing a person's membership affect access to earlier content?

**Proposed answer:** Public/member/group announcements have explicit audience, category, language readiness, optional pin/expiry, version and approving publisher. Leaders publish only within assigned groups unless another grant exists; public content follows S05.

Roster changes alter future access without rewriting who received earlier communications. Sensitive historical material can require tighter current access rather than automatic access for all new members. Audience broadening requires review of text and attachments. Scheduled/expiry behavior uses a real runner or labeled manual process, and publication does not imply external message delivery.

### S26.08

**Question:** Who may submit prayer intentions, what should be anonymous/private/public, who approves publication and how can a person withdraw a sensitive intention?

**Proposed answer:** Members/unlinked accounts or guests where enabled can submit prayer intentions privately through an approved route. Ask whether the intention is clergy-private, anonymous public or identified public; default to private until authorized publication.

The priest/appointed publisher reviews consent and third-party information before sharing. Keep private original and approved public wording separate. Withdrawal stops future public display and scheduled reuse, preserving only required restricted history. A prayer request does not grant consent to disclose medical/family details or send a public announcement automatically.

### S26.09

**Question:** Which real external channels are essential at launch? For each unavailable channel, should controls be hidden, disabled, or offer a clearly labeled manual handoff?

**Proposed answer:** In-app messages/notifications are the baseline. External email for verified account recovery/approved notifications may be a launch dependency if selected; SMS/WhatsApp/other channels remain individually configured choices, not presumed installed services.

Hide unavailable sending choices from ordinary compose, with honest configuration status in authorized settings and an explicit manual handoff where approved. **Copy invitation link** does not mean **Invitation sent**. No recipient is charged/subscribed by selecting a planning rule. Final channel/provider and monitored delivery arrangements require owner setup decisions; this draft does not invent integrations.

### S26.10

**Question:** What should draft, scheduled, sent to in-app recipient, delivered externally, read, failed and cancelled mean? Which of those states can launch actually verify?

**Proposed answer:** Draft is unsent; Scheduled is waiting on an actual runnable job; Sent in-app means stored for the intended recipient; Delivered externally requires provider evidence; Read requires recorded recipient action; Failed means a defined send attempt failed; Cancelled prevents a pending send.

Keep recipient-level outcomes for mixed batches and distinguish saved case from failed notice. Do not equate queued/sent/delivered/read or display a fake success from configuration alone. Show actual time/channel and retry options; a channel with no integration has no successful external state.

### S26.11

**Question:** Which automated reminders or message rules are required, what triggers them and who owns the content? Should nonrunning automation records be visible as planning-only configurations?

**Proposed answer:** Configure reminders for meetings/events, appointments, missing request information, pending decisions, unpaid approved balances, expiring appointments/holds and pickup/collection follow-up where policy allows. Each rule names trigger, scope, audience, language template, owner, timing and stop condition.

Nonrunning configurations are labeled **Planning only — not sending**, with no Active delivery claim. Cancelled/resolved cases stop future reminders; retries deduplicate recipients/actions. The priest/office/finance owner approves relevant content and quiet-hour handling. Background scheduling is a real release dependency for any promised automatic reminder.

### S26.12

**Question:** Complete a notification row for every important transition across membership, requests, certificates, events, volunteers, payments, concerns and appointments. Which roles receive each update?

**Proposed answer:** Use the transition matrix in Appendix C for membership/corrections, requests/documents, priest/proxy/bishop decisions, scheduling/cancellation, registrations/consent/payments/refunds, volunteers, concerns and appointments. Each rule records actual audience, actor/capacity, subject/body, language, channel, action link and timing.

Notify only people eligible to receive the event; one account holding several roles receives one update per intended purpose. Priest proxy activity is informational after effective approval. Sensitive reasons are omitted from general subjects/previews. Delivery failure creates owner follow-up without rolling back a completed underlying decision.

### S26.13

**Question:** Which notifications are optional versus required operational notices, and how should channel choices, quiet hours, digests and language preferences work?

**Proposed answer:** Separate optional community updates/marketing from necessary own-case/security/appointment notices. Let users choose actual supported channels, language, quiet hours and digest options for optional information.

Do not promise email/SMS merely because a preference is saved. Necessary notices remain visible in-app; off-hours escalation uses an explicit approved urgent-contact rule, not routine broadcast bypass. Guardian/minor contact rules and confidential-case channels may restrict options. Record preference versions and explain what an opt-out affects, while retaining permissions and required operational histories.

### S26.14

**Question:** Where should notifications be read across multiple parishes, and should opening their linked record mark them read? Define badge counts, stale links and dismissed/archived updates.

**Proposed answer:** Use one account notification center in the combined home, with parish/type/read filters and clearly labeled source. Badge means unread authorized notifications, not all team work.

Mark read on deliberate notification/detail viewing according to one defined rule, while allowing Mark unread/all read; opening an unrelated collection does not clear everything. Archive/dismiss affects the user's view without cancelling work. Recheck current access before showing a historic sensitive notification or following its link. Expired/removed targets offer an appropriate safe destination without retaining confidential previews after revocation.

### S26.15

**Question:** How should failed delivery, duplicate recipients, changed contact details and reopened requests affect retries and status messages? Who needs to follow up manually?

**Proposed answer:** Track per-recipient/channel attempts, provider/outcome time and a deduplication identity. Retry only failed eligible sends and recheck changed contacts/permissions. Do not resend successful messages because the case page reloaded.

A reopened case starts a new meaningful transition, not replay of all prior notices. Current contact verification and preferences determine the next permitted delivery. Assign failed important notices to a named office/role for manual follow-up, with clear link creation versus actual contact evidence. No retry may expose private content to a replacement unverified number.

### S26.16

**Question:** How should a user report unwanted contact or an inappropriate message, and when should the existing exceptional exact-message administrative review be available and audited?

**Proposed answer:** Provide a report-contact/message route that preserves the exact message reference and the complainant's explanation with restricted review. Blocking optional unsolicited contact must not erase evidence or require a public accusation.

Exceptional administrative message review remains limited to an authorized exact-message purpose/reason, with appropriate review and audit; it does not create a browse-all inbox. Conflicted handlers are excluded and a safe escalation route is configured. User-visible outcomes disclose only necessary action, not another party's private evidence or account details.

## S27

**Concerns, complaints, reviewer independence and privacy**

### S27.01

**Question:** What should the feature be called so users understand its purpose, and which matters belong here versus ordinary requests, feedback or incident reporting?

**Proposed answer:** Label the area **Concerns & complaints**, with plain explanations for confidential concerns, ordinary office requests, general suggestions and event incident reporting. Do not route a sensitive allegation through a public feedback form or broad office queue.

Provide a clear private submission path, expected reviewer access and maintained direct-help contacts where appropriate. A concern is not automatically a disciplinary finding. Case categories and language should be reviewed by the responsible safeguarding/independent authority, preserving supplied facts and avoiding accusatory default text.

### S27.02

**Question:** Who may submit: linked members, unlinked accounts, minors and/or guests? What support route is available to someone who cannot use the portal?

**Proposed answer:** Permit eligible authenticated accounts to raise concerns without requiring approved parish membership. Minors use a policy-approved confidential route; guardian/household association does not automatically disclose their case.

Offer an independent assisted/offline submission contact for people unable to use the portal. Guest confidential intake should open only with a genuine secure tracking/reviewer process; ordinary public guest requests must not masquerade as confidential cases. Access and age/representation rules require domain review. Do not force a person to contact the accused office to obtain a parish link first.

### S27.03

**Question:** Which categories and urgency choices are needed, who maintains them and which require specially authorized reviewers?

**Proposed answer:** Use reviewed categories such as operational conduct, interpersonal concern, safeguarding/sensitive matter and other, with urgency and immediate-risk guidance appropriate to the actual service. Avoid collecting unnecessary detailed allegations in public fields.

An authorized independent category manager maintains labels, sensitive classification and eligible reviewer pools. New/changed sensitive categories require the stronger access policy by default. Category hiding stops new selection without orphaning existing cases. Urgency changes ownership/escalation tasks, not a promise of continuously monitored emergency response.

### S27.04

**Question:** What must the submission screen say about confidentiality, anonymity to reviewers, technical limits and appropriate immediate-help routes before a person submits?

**Proposed answer:** Before submission, explain selected-reviewer access, what identified/anonymous means, limits of technical anonymity, evidence handling, applicant-visible replies and available contact/escalation routes. Anonymous to reviewers does not guarantee inability of infrastructure operators to correlate technical/private account data.

Use neutral notifications and private screens. State actual monitoring/response arrangements and urgent direct-help routes supplied by the competent authority, without inventing phone numbers. Ask for only necessary facts and separate identity/publicity choices. Confirmation must not expose sensitive case text on a shared-device success page.

### S27.05

**Question:** Should the submitter select reviewers as now, choose an independent office, or use automatic routing? What understandable information helps them choose safely?

**Proposed answer:** Preserve submitter selection of eligible independent reviewers, with approved descriptions of their role/scope and an alternative independent-office route if the person cannot choose. Do not expose private reviewer account/contact data or broad staff rosters.

Check named conflicts before submission and at review. Selection gives only the case-specific access needed, not authority to browse other cases. The submitter sees who may receive it and the rules for future reassignment. No automatic routing to the local priest/leader merely because they hold rank if they are implicated or not selected.

### S27.06

**Question:** What happens when every available reviewer has a conflict, the complaint involves the priest/bishop, or the selected reviewer becomes conflicted later?

**Proposed answer:** Exclude conflicted/implicated reviewers and route to the preappointed independent authority outside that conflict, including a safe route for concerns about a bishop. This responsible authority must be configured before the feature is advertised as ready.

If none exists, show a genuine independent contact/process rather than assigning a conflicted administrator or falsely accepting into an unreviewable queue. Later conflicts suspend that reviewer's future access and trigger restricted reassignment with history and appropriate submitter notice. Technical Super Admin coordination alone does not grant case-content access.

### S27.07

**Question:** Who may see case contents, counts, status, evidence and identified submitter details? Confirm that unrelated administrators receive none of these simply because of their role.

**Proposed answer:** Case content/status/counts/evidence are visible only to selected eligible reviewers and the submitter's own permitted view. Sensitive category access and identified-submitter visibility are separate permissions. Unselected administrators/bishops/priests receive no case totals or indirect dashboard/search signals.

Anonymous identity is not added to ordinary case/audit responses. Keep infrastructure/support access strictly purpose-scoped under the approved exceptional process. Export, notification, print and history follow the same boundaries. Permission to manage categories is not permission to read every case.

### S27.08

**Question:** What does accepting a case assignment entail, and who may reassign/escalate it without exposing it to a broader staff queue?

**Proposed answer:** A reviewer accepts assignment only after confirming scope/conflict suitability and responsibility for the next action. Show actual deadline/owner and permitted evidence, not automatic unrelated case access.

Restricted reassignment/escalation belongs to the designated independent case authority or approved selected reviewers under policy, with reason, recipient eligibility and access-history record. Inform the submitter where appropriate without disclosing restricted investigations. Removing a reviewer ends future access; it does not erase their prior contributions or grant the ordinary office an alternative viewing route.

### S27.09

**Question:** Define case statuses, response deadlines, review ownership, escalation and closure/reopening rules. Which steps should the submitter see?

**Proposed answer:** Use Submitted, Awaiting independent review, Accepted/Assigned, Needs information, Under review, Response provided, Resolved/Closed and Reopened. Record owner, actual update time, next action and any agreed target.

The competent service supplies realistic response/escalation deadlines and monitored availability; do not invent nationally promised hours. Applicants see useful permitted progress and released replies, not internal deliberation. Reopening identifies new information/reason and preserves closure history. Escalation stays within the independent eligible pool and does not leak into general parish work badges.

### S27.10

**Question:** How should reviewer-only notes, applicant-visible replies and requests for more information be visually separated and confirmed before sending?

**Proposed answer:** Separate **Reviewer-only note**, **Message to submitter** and **Request information** with fixed visible audience and a send preview. Do not use one textarea whose hidden toggle can accidentally publish internal material.

Replies show status change, actual sender/capacity and next requested action. Evidence references expose only permitted files. Correct a mistaken sent response through an attributed follow-up/withdrawal process without erasing history. The submitter's anonymous mode remains intact in reviewer responses and notification titles.

### S27.11

**Question:** May an anonymous submitter later identify themselves, or an identified submitter later hide identity? What should previously authorized readers and historic evidence retain?

**Proposed answer:** Allow voluntary later identification through explicit informed confirmation, with who will receive the information and a retained original anonymous history. An identified submitter may request reduced future identity visibility, but prior authorized knowledge cannot be made unseen.

Use reviewer/independent authority review for redaction, evidence and onward disclosure. Never silently switch anonymity because an account/person link changed. Historic identified files may require redaction or restricted originals rather than a false promise of complete retroactive anonymity. Record purpose and consent without copying identity into ordinary audit.

### S27.12

**Question:** What evidence uploads, downloads, redactions, exports and case-history access are permitted, and which actions require an extra reason or review?

**Proposed answer:** Permit necessary evidence uploads to authorized case participants with per-file audience/version and the same safe size/type controls. Downloads/exports are exceptional purpose-limited capabilities, with reason, reviewer authority, redaction preview and access audit.

Preserve originals where policy requires; redacted derivatives are labeled and do not replace hidden originals silently. No ordinary parish bulk export includes case evidence. Case history access distinguishes internal versus submitter-visible events. Retention, disclosure holds and exceptional deletion require the approved independent/policy process, not a general administrator button.

### S27.13

**Question:** How should follow-up and outcome notifications avoid sensitive case details on shared devices, email subjects or ordinary staff dashboards?

**Proposed answer:** Notifications say only **There is an update to your confidential case** with an authenticated/private destination, avoiding category, subject, identity or accusation in lock-screen/email previews. Shared office dashboards show no unrelated case signal.

The submitter chooses actually supported safe channels; urgent response arrangements are explicit and monitored. Reviewers receive minimal scoped notices and reauthenticate as needed. Marking a notification read does not close a case. Recheck access at view time and remove future details after reassignment/revocation without claiming external copies were recalled.

### S27.14

**Question:** What should happen when the submitter leaves the parish, a reviewer loses their appointment, the account closes, or a case predates automatic account tracking?

**Proposed answer:** Leaving a parish does not erase or abandon a submitted case; preserve the submitter's own permitted tracking independently of ordinary membership where policy allows. Reviewer appointment loss ends access and creates independent handover, not automatic transfer to their replacement priest/leader.

Account closure requires a reviewed safe follow-up/retention arrangement, without fabricating login access. Older anonymous cases lacking a verified account association use the approved private recovery process; never link by guessing identity. Case/audit retention follows independent policy and conflicts remain checked after every reassignment.

## S28

**Private notes, pastoral tasks and forms/workflows**

### S28.01

**Question:** What belongs in personal member notes, confidential pastoral notes, group notes/tasks and office workflow tasks? Approve labels and boundaries that prevent accidental sharing.

**Proposed answer:** Label account-private material **My notes**, author-owned clergy material **Private pastoral notes**, collaborative ministry material **Group notes/tasks**, and operational assignments **Office tasks/workflows**. Each shows its actual audience before saving.

A combined home is not a combined content store. Personal notes do not enter staff search; pastoral notes do not become People facts visible to every administrator. Group tasks use their group scope, while workflow answers use their own defined audience. Moving/sharing content requires explicit permission and preview, not a category change that silently publishes it.

### S28.02

**Question:** Confirm whether private pastoral notes remain inaccessible to successor priests, bishops and administrators, including after the author leaves. What access should the author retain then?

**Proposed answer:** Preserve author-only privacy against successors, bishops and administrators unless the author expressly shares or an approved exceptional policy applies. After departure, propose an author-owned archived notebook view of their retained note content, not live access to the former parish's people records.

The author cannot use retained references to regain revoked office data. Globally deactivated accounts do not keep normal login access; any personal-data recovery follows reviewed policy. A successor receives only properly shared/handed-over operational records, not inheritance of all private notes. Retention/disposition remains a domain/policy approval.

### S28.03

**Question:** When an author shares with parish priests, does that include priests appointed later? Can sharing be withdrawn, and what should prior readers and copies mean?

**Proposed answer:** The explicit audience **Current priests assigned to this parish** includes later eligible appointments while the share remains active; explain this future-reader effect before confirmation. Offer a named eligible-priest task share where a narrower audience is required.

The author can withdraw future sharing, with changed audience/history. Previously read/printed copies cannot be made unseen. Appointment expiry/revocation ends current audience access automatically. A shared note remains attributed to its author and does not become an editable communal fact or automatically visible to the bishop.

### S28.04

**Question:** Can a pastoral task be assigned while its content is still author-private? What should the UI explain before assignment, and who may actually complete or edit it?

**Proposed answer:** Do not assign a private task to someone who cannot read it. Before assignment, explain and confirm the minimum task-specific share with the eligible clergy assignee; this does not share the author's whole notebook or grant office people access.

The assignee can update permitted progress/completion while the author controls note body/sharing according to policy. Keep actual actor and owner separate. If access or assignment ends, reassign/return the task with a restricted handover rather than losing it or exposing content to general staff.

### S28.05

**Question:** Which notes/tasks need linked people, meetings, categories, priority, due dates, recurrence, reminders and attachments? Avoid implying a reminder runs if no scheduler exists.

**Proposed answer:** Notes have title/body, optional category/tags/link and audience; tasks add owner/assignee, status, priority and due date. Meetings/people links are permission-checked and optional for general tasks. Attachments inherit the content's privacy.

Recurrence/reminders are available only with real scheduling or labeled manual follow-up; a date field alone does not send anything. Private reminders avoid sensitive previews. Completed tasks retain dates/history, while reference notes have no forced completion state. Translation of personal free text stays optional and preserves originals.

### S28.06

**Question:** How should completion, reopening, deletion and archiving work for each note/task type, including what is retained in a privacy-appropriate history?

**Proposed answer:** Authors/permitted task owners can complete/reopen tasks with actual times; notes archive rather than pretend Completed. Personal deletion may be offered under the approved retention policy, with recoverable trash where supported.

Pastoral/case-linked shared material may require restricted review/retention instead of ordinary removal. History should record action/actor without putting confidential body text into general audit. Undo applies only to genuinely reversible current actions. Reopening preserves prior completion and revalidates assignee/access; group closure does not automatically expose or purge personal notes.

### S28.07

**Question:** Which real office processes need the separate workflow builder beyond the hard-coded sacrament/request processes? Give a completed example for each.

**Proposed answer:** Use the builder for repeatable operational processes: event proposal (coordinator details → room check → priest decision → approved publication); equipment repair (issue → triage → repair evidence → clearance); office purchase request (details/evidence → financial authorization → actual payment/receipt).

Dedicated appointment/sacramental/finance actions remain their authoritative services, linked from tasks rather than bypassed by a generic Complete button. A workflow's completion must reflect actual connected results, not falsely confer a role, signature or payment. Each real parish supplies its approved variant and owner.

### S28.08

**Question:** Who may define a workflow, publish a form, start a run, assign a step and view its submitted answers? Should templates vary by parish or diocese?

**Proposed answer:** Authorized parish/diocesan process owners define versioned templates; publishers approve their forms/audiences. Eligible users start runs, while step assignment and answer access follow declared roles, scope and confidentiality.

Diocesan templates can provide controlled parish adaptations without overwriting existing runs. Builders cannot create self-promoting roles, bypass clergy signatures or expose restricted answers through a report field. Preview actual submitter/reviewer views and permissions before publishing. The owner and fallback assignee must exist even when a parish has no secretary.

### S28.09

**Question:** Which workflow features are essential: sequential steps, conditional branches, parallel approvals, attachments, deadlines, return/rejection and escalation?

**Proposed answer:** Support sequential steps, conditional branches, explicitly required parallel reviews, documents, return/reject/cancel, deadlines and escalation, with one understandable current-next-action view. Validate templates for unreachable steps, missing assignees and forbidden authority before publication.

Task prerequisites must be real recorded facts, not merely displayed text. A form-builder approval cannot replace a required dedicated clergy/financial decision. Automatic actions/reminders require configured execution and recovery; otherwise present a manual task. Keep complex optional features out of ordinary editors until their behavior is defined and tested.

### S28.10

**Question:** When a workflow definition changes, should running tasks keep the old version? What does pausing a workflow do to new submissions and existing tasks?

**Proposed answer:** Running cases keep the published version they began under. A template edit creates a new draft/version for future runs; migrating active work requires a comparison, responsible approval and preservation of submitted answers/decisions.

Pause stops new runs while showing a contact/fallback; specify separately if existing work is suspended or allowed to finish. It must not silently freeze unrelated workflows. Resume rechecks owner/permissions and deadlines. Archive retains historic authorized reading/export and never invalidates actual official/financial outcomes produced earlier.

### S28.11

**Question:** What should a task detail show about completed steps, timestamps, next owner and final result? When should the last step automatically close it?

**Proposed answer:** Task detail shows purpose/parish/reference, template version, submitted data, permitted evidence, completed steps with actors/authority/timestamps, current owner, due/last-update, next action and outcome. Separate applicant messages from private notes.

Completing the last required step closes the workflow only if all mandatory connected outcomes genuinely succeeded. If file release/payment/appointment is still pending, show that failure/dependency rather than Done. A priest proxy action identifies both people internally without printing secretary attribution on official paperwork. Historic steps remain visible after reopening.

### S28.12

**Question:** How should cancelling, undoing, reopening and transferring workflow runs behave, and which notification/audit evidence must accompany those actions?

**Proposed answer:** Cancellation requires permitted authority/reason and impact review of pending resources, participants, money and documents. Preserve history and stop future reminders. Transfer changes future responsibility within eligibility, not original authorship.

Undo is limited to reversible draft/task actions; it cannot retract an already signed/released document or real payment. Reopening records reason/version/current prerequisites and may require renewed approval. Notify affected permitted participants once per transition and log actor/scope/outcome, keeping confidential content out of general worklists.

## S29

**Administration, bundles, oversight, reports and settings**

### S29.01

**Question:** What should the administrator's main screen prioritize at system, diocese and parish scope, and how should changing management scope differ visually from changing working parish?

**Proposed answer:** In the combined home, system scope prioritizes initialization, organizations/accounts and actual platform issues; diocesan scope prioritizes parishes, appointments and authorized support; parish scope prioritizes office work and local grants.

Management scope is separately labeled **Entire system / Diocese / Parish**, while the selected acting role remains visible. Wider administrative scope does not imply confidential-content access. Every consequential action shows the exact target organization, permissions and effect; changing a filter cannot silently turn a local operation into a national one.

### S29.02

**Question:** Should staff accounts be created by administrators with a temporary password, or invited to establish their own credentials? How should an existing ordinary account receive an appointment?

**Proposed answer:** Prefer inviting people to create/control their own credentials, then appoint the existing verified account. Office-created person records and staff roles remain separate. A verified normal account can receive a scoped role invitation without another login identity.

Controlled initial Super Admin setup and privileged recovery are explicit exceptions with individual attribution, not shared default passwords. If a temporary password workflow is retained, require secure handoff, first-use change and no credential disclosure in logs/messages. Public signup never grants staff/clergy authority.

### S29.03

**Question:** Is the current exact-username lookup suitable for appointing someone outside the visible account list? What should an administrator do when they know only the person's name or email?

**Proposed answer:** Retain exact audited username lookup for accounts beyond the visible authorized list, with neutral no-match handling. For a known email/contact, offer an invitation/claim process rather than broad global account enumeration.

Name-only search is limited to a legitimately scoped directory; ambiguous identities need confirmation before appointment. Show only relevant account identity and intended scope, not private memberships or case data. Lookup permission is not appointment authority. Recheck duplicate/current assignments and eligibility at save, including person links required for clergy/leaders.

### S29.04

**Question:** How should account identity, linked parish person, clergy title and active appointments be presented separately so changing one does not imply changing the others?

**Proposed answer:** Display separate panels for account/sign-in identity, parish person links/membership, clergy title/qualification, and active/historical appointments with role, parish/diocese/ministry, dates, lead designation and appointing authority.

Changing a phone or person link does not create a clergy title; changing title does not automatically reassign every parish. The combined view shows each appointment's scope. Before linked changes, preview conflicts and pending work; record explicit decisions without silently promoting or merging accounts. Personal login contacts remain different from public office contacts.

### S29.05

**Question:** Confirm the process for appointing/revoking secretaries, including several secretaries and none. What pending responsibilities should be shown before removing the last one?

**Owner direction applied:** Secretary appointment is optional and may include several people. The head priest/eligible appointing authority can add, replace or revoke with exact scope/dates and individual accounts.

Before removing the last secretary, show unresolved preparation, messages, documents, registrations, expenses and delegations; assign eligible office/priest ownership rather than block parish operation. Removal revokes applicable access promptly while preserving prior actions. Higher administrators' office fallback retains their actual identity and does not automatically extend the secretary-only priest-approval recording exception.

### S29.06

**Question:** How should administrators review the consequences of deactivating a parish, a parish-specific account access or a global account? Which connected users/workflows need notices and recovery routes?

**Proposed answer:** Preview whether the action affects one appointment/parish, a whole parish's operation or the account globally. Show roles, open work, existing tracking, resource commitments, messages and downstream access, with reason/effective time and recovery path.

Parish suspension/closure preserves official/financial history and handles in-flight work deliberately. Account global deactivation ends sessions everywhere; local revocation leaves other legitimate access. Notify affected owners with minimal sensitive details and protect higher-authority suspensions from lower overrides. An active record-bearing parish uses closure/archive, not ordinary destructive deletion.

### S29.07

**Question:** What should clergy title changes and cross-parish appointments require, including the current restriction on demoting a priest to Deacon while priest assignments remain?

**Proposed answer:** Only the competent bishop/clergy authority changes religious title and establishes qualified priest appointments. Cross-parish grants require eligible local links/scope and do not automatically reuse another parish's person identifier.

Before changing Priest to Deacon, resolve/revoke incompatible active priest assignments with handover and exact effective dates; no title edit silently preserves priest-only authority. Historical signed entries keep the original valid title/assignment snapshot. Super Admins administer records of real appointments, not confer office themselves. Reasons, authorization and affected work remain visible to appropriate reviewers.

### S29.08

**Question:** Which actions belong only in Administration and which in Parish settings? Should the older Roles & permissions, module toggles and security/integration screens be removed, read-only or reconciled with the actual policy?

**Proposed answer:** Administration owns organizations, account status, scoped appointments, head-priest designations, bundle authority and protected history. Parish settings owns approved local contact/preferences, schedules, permitted templates and nonsecurity operational configuration.

Reconcile older roles/module/security/integration screens with actual policy: make descriptive matrices read-only, route real changes to their authoritative editor, and remove misleading toggles claiming nonexistent MFA/session/webhook behavior. Keep retained features discoverable with honest configured/unavailable states. No ordinary parish setting can change diocesan ownership, grant clergy power or disable global privacy/audit protections.

### S29.09

**Question:** For Presence, Office, Community and Complete, specify the actual feature matrix, record limits if any, public/member access and launch availability. Are the bundle names understandable to parish decision-makers?

**Proposed answer:** Retain the current module-family baseline: Presence = public/core account functions; Office = office + requests + sacraments; Community = office + requests + ministries + facilities; Complete = all those plus finance. Public content is still restricted to approved publication, and guest forms require their actual service module/configuration.

Use Complete for the two-parish all-module pilot as a proposal, with no invented record quotas. Publish a reviewed detailed entitlement table before commercial rollout, including currently unmapped communications/music/forms/integration features. Bundle names can remain with plain EN/FR/AR descriptions; entitlement never replaces per-role permission.

### S29.10

**Question:** Who can activate/change a parish-managed bundle, and what approval process applies when the diocese sponsors it? What should a pending plan-change request show?

**Proposed answer:** A priest may activate/change a parish-managed bundle within authorized policy; Parish Admins can prepare requests but do not independently change sponsored arrangements. Diocese-sponsored changes require bishop/authorized diocesan review, including shared arrangement scope.

Show requested/current bundle, sponsor, affected parishes/modules, in-flight impact and Pending/Approved/Declined outcome with reason/history. Do not apply requested benefits before acceptance. Super Admin support records actual authority rather than hiding who decided. Actual fees and billing implications remain explicit owner inputs; a bundle selection alone cannot initiate a charge.

### S29.11

**Question:** Are prices, invoices, renewal dates, trials and subscriptions part of launch, or is bundle administration entirely manual? What should the public bundles page promise?

**Proposed answer:** Keep bundle administration manual for launch unless the owners separately approve and configure billing. Do not invent prices, trials, renewal dates, invoices or automatic subscriptions from sample settings.

Public bundles describe included capabilities, sponsorship and a real contact/request route, stating manual arrangement where applicable. If recurring billing is later adopted, design quotation/acceptance, payment, tax/invoice facts, renewal/cancellation and failure before enabling it. Keeping all modules in scope does not authorize charging the first parishes or represent an unconfigured payment processor as active.

### S29.12

**Question:** When a module is disabled or a bundle downgraded, exactly which historical records remain readable/exportable, which pending approvals can finish and which new submissions are blocked?

**Proposed answer:** A disable/downgrade preview identifies new work that will stop, existing cases allowed to finish, and historic read/export rights. Preserve records and required documents; do not hide history behind an irreversible inaccessible screen.

Reject new submissions/writes for disabled services while permitting specifically authorized completion/correction/release of existing work under an explicit transition rule. No downgrade bypasses priest/signature/bishop gates. Existing applicants retain limited tracking and office contact. Explain module-unavailable versus permission-denied separately and record effective date/approving arrangement.

### S29.13

**Question:** What should members/guests see when their parish stops accepting online requests or a feature is unavailable under its bundle? Which office fallback and tracking access remain?

**Proposed answer:** Replace new unavailable actions with a clear **Contact the parish office** route and actual hours/contact; do not leave active forms that fail only after submission. Explain relevant service availability without exposing commercial/account details.

Existing request references, permitted progress and released outputs remain accessible under retention/access rules. Offer office-assisted processing where explicitly supported. Members keep unrelated account/parish activity. Turning off online intake does not cancel confirmed reservations, paid registrations or pending priest decisions automatically; assign their follow-up and notify affected people honestly.

### S29.14

**Question:** What should a bishop's overview show across parishes, with what date filters, drill-down permissions and explanations of incomplete data? Is comparison/ranking between parishes appropriate?

**Proposed answer:** Show authorized parish activity, current clergy/administrative coverage, pending decisions, upcoming events and contextual financial/participation summaries with explicit periods/coverage. Drill-down follows actual record and field permissions.

Default to operational exceptions/trends, not public rankings or simplistic parish league tables. Attendance, capacity and giving require comparable definitions and missing-data explanation. Confidential concerns/private pastoral records do not contribute unauthorized counts. The combined diocesan view labels each parish and never turns oversight into automatic local signature or browse-all permission.

### S29.15

**Question:** For each existing report—attendance, membership, group participation, volunteer workload, facilities, giving, budget and registration versus attendance—what real decision does it support and how must each measure be calculated?

**Proposed answer:** Reports support specific decisions: attendance identifies recorded participation gaps; membership tracks verified active/archive changes; group participation distinguishes unique people/rosters and formation; volunteer workload uses actual commitments/verified hours; facilities uses confirmed time versus actual availability; giving uses actual receipts/refunds by currency/fund; budget compares approved revisions with eligible actuals; registration versus attendance uses confirmed eligible registrations and recorded arrivals.

Each measure defines date, source, denominator, missing data and scope. No unrecorded attendance becomes absence, and duplicate cross-group memberships do not inflate unique-person totals. Appendix B specifies shared metric rules.

### S29.16

**Question:** Which report filters, languages, date ranges, print layouts and export formats are needed, and should exports contain all matching records or only the visible page?

**Proposed answer:** Reports offer permitted parish/diocese/group/resource/fund/type/status/date filters, EN/FR/AR display and print, and clearly labeled CSV/XLSX/PDF outputs where actual export supports them. Dates/currencies/precision remain unambiguous and Arabic-compatible.

Default export to all authorized records matching stated filters, with Selected/current page only when explicitly chosen. Preview columns, count, privacy and rounding/converted equivalents. Include generated time, scope and definitions. Printed pages handle long names and repeated headers; asynchronous exports report actual completion/failure and recheck permission before download.

### S29.17

**Question:** Who may see general versus administrative audit history, which events/fields must be included or excluded, and how should users find the reason/actor for a disputed change?

**Proposed answer:** General audit shows authorized parish operational changes; administrative audit shows scoped appointment/account/organization events. Confidential-case/message/pastoral history uses dedicated restricted access rather than copying contents to the general feed.

Record actor, responsible authority when different, scope/reference, action, actual time, outcome/reason and appropriate before/after metadata. Exclude passwords, private tokens, unnecessary evidence/body text and hidden anonymous identity. Audit is read-only; corrections add events. Search by permitted reference/actor/date/request identifier, with export separately authorized and no cross-scope count leakage.

### S29.18

**Question:** Are API credentials, webhooks, external reporting and AI assistance actual launch features? For each retained integration, who configures it and what honest configured/unavailable/error experience is required?

**Proposed answer:** Retain integration administration in scope, but treat each API/webhook/external report/AI feature as an individually defined capability, not an active launch promise. Only authorized owners configure credentials, destinations, event scope, enabled state and revoke/rotation.

Show Unconfigured, Configured, Tested/Operational, Paused and Failed with actual evidence. Secrets remain masked and absent from logs/exports. Webhook retries/scoping and external disclosure need approved rules. AI must not approve clergy/financial matters or receive confidential content automatically. If no concrete AI use case/integration is approved, its controls remain unavailable rather than simulated.

## S30

**Visual design, English/Arabic, accessibility and mobile use**

### S30.01

**Question:** Which parts of the current visual design should be retained, and which concrete screens feel crowded, confusing, too formal, too plain or inconsistent? Give examples by screen name.

**Proposed answer:** Retain the current restrained green/warm public identity, readable tables/cards and consistent controls where they serve real tasks. Prioritize review of the crowded role navigation, Requests filter/action hierarchy, long People drawers, Administration scope controls and legacy registration states identified in the project review.

Use the owner's combined home rather than preserving duplicate personal/work starts. Improve clarity through consistent labels, spacing, visible next action and progressive detail. These are design-review targets, not a claim that every screen has been visually revalidated on every device.

### S30.02

**Question:** What visual character should the public site and staff workspace convey, and are their different current styles intentional?

**Proposed answer:** The public site should feel welcoming, credible and practical for finding/visiting a parish; staff tools should feel calm, efficient and accountable. Different density/imagery is intentional, while identity, language controls, accessibility and terminology remain coherent.

Avoid decorative animation or large images that bury times, contact or requests. Office screens prioritize current context, accurate state and clear actions over marketing. No visual status should imply delivery/approval unsupported by records. Validate with priests, secretaries and ordinary users rather than relying only on developer taste.

### S30.03

**Question:** Which logo, parish seal, colors, typography and icon conventions are final assets? Who approves them and can local parishes vary any of them?

**Proposed answer:** Developers/product owners approve the shared product logo/design system; parish/diocesan authorities provide approved seals, names and authentic assets. Language/official-document reviewers confirm ecclesiastical wording and mark use.

Keep typography/icon semantics consistent, including robust Arabic/French support and missing-image fallback. Local content/assets can vary within the shared layout; unrestricted color/layout plugins are not assumed. Personal dashboard palettes do not change public branding or official certificate styling. Do not mark an illustrative sample seal as the actual parish's official asset.

### S30.04

**Question:** Should staff screens optimize for dense office work or larger, guided interactions, and should users be able to choose a compact/comfortable density or larger text?

**Proposed answer:** Optimize frequent laptop staff work for an efficient comfortable default, with optional compact tables and larger text where usable. Keep complex/rare or applicant-facing tasks guided with clear sections/progress.

Density changes never hide mandatory status, authority or warnings. Preserve labels and keyboard focus, and allow browser zoom without clipped controls. Store preferences per account, not per parish for every user. Test older/less experienced users on actual tasks, avoiding both oversized low-information office screens and unreadably dense forms.

### S30.05

**Question:** Which personal palette/dark-mode choices should remain, and how should custom colors be constrained so status, focus, text and errors remain readable?

**Proposed answer:** Retain personal presets, custom primary color and light/dark choices across the account. Constrain custom choices through readable text/focus/status combinations and offer a safe reset/preview before save.

Green/amber/red meaning must remain legible with text/icons in every mode; custom brand color cannot redefine success or danger. Official documents and public pages retain their approved styles. Mode switching preserves drafts/context and does not announce success before the preference saves. Test selected/disabled/error controls, charts and long tables in both modes.

### S30.06

**Question:** When should a record open in a page, side drawer or dialog? Which complex flows need a dedicated full page, especially on phones?

**Proposed answer:** Use addressable full pages for case timelines, people/households, ministries, events/reservations and official document review. Use drawers for short related edits and dialogs for focused decisions/confirmations.

Complex mobile requests, family editing and release flows become full-screen rather than a narrow nested drawer. Keep breadcrumbs/Back to source and preserve allowed filter context. Avoid stacking modals without a clear close/return order. A preview is not the only way to retrieve a permanent official record; deep links recheck access.

### S30.07

**Question:** Which actions deserve a primary button, which should be secondary, and which belong in a More menu? Approve a consistent placement for Save, Cancel, Back and destructive actions.

**Proposed answer:** Give the current main task one clear primary action, named for its outcome: Submit request, Save draft, Record priest's approval, Confirm reservation or Release reviewed file. Keep Cancel/Back visible and secondary; infrequent record actions belong in a labeled More menu.

Destructive actions are distinct and separated from normal submission. Buttons respect actual permission/prerequisites rather than merely recoloring. Final actions identify parish/role/subject and do not share a generic ambiguous Confirm label when consequences differ. Placement/order remains consistent across languages while respecting reading direction.

### S30.08

**Question:** What confirmation is appropriate for approval, public publication, document release, merge, removal and cancellation? Which reversible actions should use Undo instead of interrupting dialogs?

**Proposed answer:** Consequential approval, publication, release, merge, cancellation and deletion use an explicit scope/impact preview with named actor/authority, recipient/count and reason where required. Priest proxy confirms the actual prior instruction without adding another online priest gate.

Use brief Undo for genuinely reversible draft/list/preference actions, not actual money movement, signature, publication to uncontrolled recipients or completed release. Proposed ordinary Undo duration is 10 seconds with an accessible history/recovery alternative. Timed notices must not be the only way to correct a mistake. Irreversible effects use reviewed correction processes.

### S30.09

**Question:** How should forms indicate required/optional/conditional fields, explain unfamiliar terms, show progress and preserve values after validation errors?

**Proposed answer:** Label required/optional and conditional fields in text, explain purpose/examples, and reveal dependencies without deleting entered values. Use logical sections/steps with progress and review before submission for long forms.

Unknown/Not applicable is available where factual uncertainty is legitimate, with official-output gates rather than fake values. After errors, retain permitted data and attachments actually saved, identify missing fields and avoid clearing unrelated sections. Language change should not reset a draft. Consent/representation/publicity choices are separate and never prechecked merely to accelerate completion.

### S30.10

**Question:** Should errors appear beside fields, in a summary, or both, and what should receive focus? Which success messages need a persistent record/timeline rather than a temporary toast?

**Proposed answer:** Show field errors beside their inputs and an accessible error summary linking to them; focus the summary/first relevant error without losing context. Distinguish validation, permission, concurrency and network failures with a concrete next step.

Temporary toasts can acknowledge ordinary saved preferences, but approvals, submissions, payments, releases and cancellations need persistent references/timeline outcomes. A saved record with failed upload/notification explicitly shows partial outcome. Never announce Saved when only in-memory state changed. Errors avoid technical stacks, secrets and private data leaks.

### S30.11

**Question:** What should English/Arabic switching preserve: route, form draft, selected filters and scroll? Which values should display both scripts regardless of interface language?

**Owner direction applied:** English, French and Arabic switching preserves route, selected role, parish/combined filter, draft values, saved files and meaningful position/focus. It changes presentation, not identity, currency or approval state.

Display supplied name scripts where identification benefits, especially office matching and official review; do not invent missing versions. References/phones/emails remain recognizable. Public content follows reviewed translation readiness, while personal free text retains original language. A language change must not resubmit a form, clear consent or select another parish.

### S30.12

**Question:** Choose conventions for Arabic/Western digits, names, date order, month names, time format and USD/LBP formatting in screens, documents and exports separately.

**Proposed answer:** Use unambiguous localized screen dates with month names and four-digit years; allow personal 12/24-hour preference, while operational print defaults to clearly labeled 24-hour parish time. Data interchange uses stable machine-readable dates and Western-digit identifiers.

Arabic UI may localize ordinary numerals, but reference/phone/currency fields remain unambiguous with explicit USD/LBP labels. Financial display follows S25 precision; exports include actual currency/rate/precision rather than formatted combined strings only. Official document name/date conventions require approved templates. Interface language never converts money or changes a historical date.

### S30.13

**Question:** Which mixed-direction fields must remain left-to-right inside Arabic screens, including phone, email, URLs, identifiers and currency? Which navigation/icons need mirroring?

**Proposed answer:** Keep phone, email, URL, machine identifier, register reference and appropriate amount/currency segments left-to-right inside isolated Arabic layout regions. Names/body text use their supplied script direction; mixed-script lines require deliberate isolation.

Mirror directional navigation, breadcrumb movement and relevant layout order, not universal symbols, photos, musical notation or fixed identifiers. Keyboard order/focus must follow the meaningful reading/task order. Test real long bilingual/trilingual values rather than only translated short labels. A reference copied from Arabic UI must preserve its exact characters.

### S30.14

**Question:** Who approves bilingual terminology and error/help text? What should the interface do when a field or published content has only one translation?

**Proposed answer:** Developers own consistency; named EN/FR/AR reviewers approve ordinary terminology/help/errors, and clergy/finance owners approve their domain wording. Maintain one reviewed dictionary and content translation status.

For mandatory public/official output, missing translation blocks publication/issuance under the proposed readiness rule while preserving the last complete version. Optional private free text remains original, with clearly identified reviewed translation when needed. Never silently copy another language into a missing approved field and call it complete. Actual official name forms are supplied, not generated.

### S30.15

**Question:** Is French required at launch, later or excluded? Which currently visible unsupported language options and trilingual claims should be removed or disabled accordingly?

**Owner direction:** French is required at launch, together with English and Arabic, across interface, user content support and official documents. This supersedes the original questionnaire's uncertainty about whether French is later.

A French selector alone is insufficient. Translate navigation, validation, help, timelines, notifications, print/export controls and approved templates; validate accent rendering and long strings. Remove unsupported success/trilingual claims until the specific output actually works, while treating completion as a launch dependency rather than quietly deferring the language. No code implementation is implied by this answer.

### S30.16

**Question:** Which tasks must work fully by keyboard and screen reader, including calendars, family diagrams, tables, selection, drawers, uploads and volunteer scheduling? What nonvisual alternatives are needed?

**Proposed answer:** All essential tasks must work by keyboard and screen reader: role choice, search/filters, calendars, selection, forms, drawers/dialogs, uploads, approval and volunteer assignment. Provide table/list alternatives to family diagrams, matrix calendars and drag-and-drop.

Use meaningful labels, heading/order, visible focus, announced status/errors and correct modal focus/return. Do not rely only on color, hover or timed gestures. Read references, amounts and mixed-direction names clearly. Validate with assistive-technology users or appropriate expert review; a visually attractive prototype alone is not accessibility approval.

### S30.17

**Question:** What text-size/zoom, touch-target, color/contrast, reduced-motion and focus behavior must be validated with the actual intended users, especially older staff and parishioners?

**Proposed answer:** Validate comfortable base text, enlargement to at least 200%, readable contrast/status distinctions, clear focus, usable touch targets and reduced-motion behavior on intended devices. Targets/layouts should remain usable for older staff without precise gestures.

Allow enough time for reading/reauthentication warnings; animations never carry essential content alone. Check dark/custom palettes, errors, disabled controls, calendar density and long Arabic/French labels. Treat failed keyboard/zoom/focus scenarios as design issues to fix, not a user-training problem. Formal accessibility criteria need explicit product approval and evidence, not an untested compliance label.

### S30.18

**Question:** For long tables and calendars on phones, which information becomes cards, expandable details or horizontally scrollable content, and what must never disappear?

**Proposed answer:** Convert ordinary long rows to labeled cards/detail expansions. Preserve reference, subject, parish, state, next action, owner and relevant date/amount/currency. Hide only supporting detail that remains readily accessible.

Use horizontal scrolling for inherently two-dimensional attendance/rota grids, with an obvious indicator and alternative individual/list view. Mobile calendars prioritize List with date navigation; no tiny-cell-only workflow. Sticky actions must not cover keyboard/errors. Selection and bulk scope remain explicit. Sensitive guardian/medical or finance information stays access-controlled regardless of layout.

### S30.19

**Question:** Which print/download designs must work in Arabic, English and bilingual form with long names, multiple pages, missing optional data and office printers?

**Owner direction applied:** Validate English, French, Arabic and approved mixed-language document layouts: certificates/register previews, schedules, directories, vouchers, receipts/statements, participant/roster sheets and reports. Test long names, missing optional values, many pages and actual A4 office printing.

Repeat meaningful headers, prevent clipped signatures/IDs, preserve direction/fonts and distinguish draft/copy/final. Printed sacramental authority shows the priest's name; secretary recording attribution remains internal. A PDF/PNG/SVG format never grants official validity by itself. Preview count/scope and print only the permitted audience fields.

### S30.20

**Question:** What should loading, first use, no records, no search results, denied access, unavailable feature and service failure look like on each main surface? Approve the next action in every state.

**Proposed answer:** Each surface defines Loading with progress/retained context; First use with eligible setup; No records with permitted creation; No matches with reset/search help; Denied/unavailable with safe navigation; Unconfigured feature with honest contact/setup; Failed service with retry/reference.

Do not replace errors with empty-success screens or invent sample data. Keep completed save results visible when another part fails. Explain pending priest assignment and incomplete translations distinctly. All next actions obey current permission and preserve allowed drafts. Validate these states in the prototype, not only the happy-path populated screen.

## S31

**Saving, drafts, connection loss, concurrency and recovery**

### S31.01

**Question:** Which interactions should save immediately, autosave a draft or require explicit Save? Define consistent rules for records, preferences, attendance grids, plans and long request forms.

**Proposed answer:** Use explicit Save for office records, service plans and settings changes with consequential scope; autosave permitted long-form drafts without submitting them. Attendance/task quick edits may save immediately with per-item pending/success/failure indicators and appropriate history.

Approvals, payments, signatures, publication, release and destructive actions always have deliberate reviewed final actions. Saving a draft never advances a workflow. State the rule at each form and apply it consistently in EN/FR/AR. Do not silently mix optimistic visual success with an unconfirmed server save.

### S31.02

**Question:** What should indicate unsaved, saving, saved, save failed and changed elsewhere, and which message must remain visible until the issue is resolved?

**Proposed answer:** Show Unsaved changes, Saving, Saved at actual time, Save failed and Changed elsewhere distinctly. A failure/conflict remains visible with affected fields/action and a recovery option until resolved, not only a disappearing toast.

Success requires authoritative confirmation and can link to the persisted record/timeline. If outcome is uncertain after timeout, say Checking result rather than Saved or Failed definitively. Distinguish a saved case from an unsaved attachment/message. Reload/role change must not hide outstanding permitted work or falsely preserve unauthorized access.

### S31.03

**Question:** Should users resume drafts across refresh, logout, device change or language switch? How long may sensitive drafts persist, especially on shared computers?

**Proposed answer:** Authorized server drafts can resume across refresh/devices after authentication and current scope checks; language switching preserves entered facts. Proposed ordinary draft expiry is 30 days with warning/recovery where policy permits, configurable and not a legal retention claim.

Passwords/secrets never enter draft storage. Sensitive drafts avoid persistent shared-device caches, and logout clears protected local views/material. Server drafts remain available only to the permitted account/role; global deactivation stops access. Do not keep a local recovery file of revoked parish data merely to claim draft preservation.

### S31.04

**Question:** When Back, Close, parish switch or sign-out would discard changes, what choices should be offered and which safe destination should follow each choice?

**Proposed answer:** Before losing permitted unsaved work, offer Save draft, Discard or Stay. Save draft is shown only where genuinely supported; otherwise explain the actual safe alternative. Return to the combined home/role chooser or intended allowed destination after a successful choice.

Consequential actions still pending cannot be silently cancelled by navigating away; query their outcome. A parish/role switch clears stale selection/confirmation and cannot reassign the draft's subject. Sign-out removes protected active views even when a server draft remains. Never trap users in an endless save-failure dialog without a safe exit.

### S31.05

**Question:** Which exact tasks must work without a connection: viewing already loaded pages, drafting, attendance/check-in, payment entry or none? Define each permitted offline action explicitly.

**Proposed answer:** Baseline offline behavior is limited to clearly identified already-loaded permitted information and temporary nonsensitive drafting within the session. Authoritative payments, approvals, official register actions, reservations and releases require connection.

Check-in/pickup uses the approved paper/manual fallback, not a falsely synchronized offline screen. Do not promise durable offline storage or cross-device sync without implementing it. Loaded information can be stale and must not be treated as current availability/authority. Any later offline-write capability needs its own permission, reconciliation and privacy design before activation.

### S31.06

**Question:** What should the user be told when an action requires a connection, and what manual fallback or recovery should be available?

**Proposed answer:** Say **Connection required — this action has not been confirmed**, identify what is saved versus pending and offer retry/check status, keep permitted draft, or a real office/manual route. Do not encourage repeated blind submission of money/approval.

For scheduled activities show last refresh and contact/printed fallback. An offline row can remain visible as stale reference but not as proof a room is free or consent current. Restore the intended record/context after reconnection, rechecking role, revision and prerequisites before a deliberate retry.

### S31.07

**Question:** If offline writes are required, how should pending changes, changed permissions, duplicates, approvals and stale availability be reviewed before synchronization?

**Proposed answer:** No automatic offline authoritative writes are approved in the baseline. If later required, queue clearly provisional operations with local actor/time/target, duplicate-safe identity and visible sync status, then revalidate current access, resource availability and record revisions.

Rejected/conflicting items require eligible human resolution and preserve permitted original intent. Offline priest/signature/financial authority cannot be assumed from an earlier login; do not auto-approve on reconnection. Separate actual action time from synchronization time and define secure shared-device storage/deletion. Production activation requires tested recovery and policy approval.

### S31.08

**Question:** When two users edit the same data, should the second compare field changes, refresh and reapply, or preserve a recoverable draft? Which conflicts require office review?

**Proposed answer:** On stale edits, preserve permitted draft values and show original/submitted/current field differences. Allow reload/reapply or an explicit reconciled save by an eligible editor; never last-write-wins for sensitive or official facts.

Identity/account links, family authority, money, resource timing and official records need the appropriate reviewer, not a casual overwrite checkbox. A changed record may require new approval of the exact revision. If access was revoked, stop and use the authorized recovery process rather than exporting another user's current data into the draft.

### S31.09

**Question:** If a save succeeds but its response is lost, how should retry avoid creating a duplicate request, payment, check-in or approval?

**Proposed answer:** Give each consequential submission a stable operation identity and reuse it on retry. After a lost response, query that operation/record and show actual committed/unfinished/unknown state before another action.

Do not create another request, payment, approval or check-in merely because the page refreshed. Match real business references as additional validation, not as a substitute for correct duplicate handling. If a partial operation remains, show the completed portion and assigned recovery step. Exact duplicate/conflict results preserve original actors/timestamps rather than pretending a retry was a new decision.

### S31.10

**Question:** If a record saves but its attachment or notification fails, what should the user see and how should they retry only the failed part?

**Proposed answer:** Show a persistent partial-outcome message: for example **Payment recorded; receipt upload failed** or **Request accepted; notification not sent**. Link the saved record/reference and retry only the failed component.

Do not roll back an effective approved case merely because email failed, or re-record money to attach a receipt. Check file version/recipient and current authority before retry. Failed external delivery creates owner follow-up and accurate recipient-level status. Logs correlate the related steps without storing secrets or publishing restricted evidence.

### S31.11

**Question:** What should happen when the active role/parish is revoked, a module changes or a linked person is archived while the user is editing?

**Proposed answer:** Recheck active authority, parish/module state, person status and revision at protected actions. A revoked role loses old records/actions; an archived subject or disabled service prompts the specific permitted correction/completion route.

Preserve unrelated valid access and only drafts the account may retain. Clear stale confirmation controls and refresh the combined home/role choices. Do not auto-switch into another higher role to force the submission through. Explain whether an operation actually committed and route unresolved work to the authorized replacement/office.

### S31.12

**Question:** What should timeout, unexpected server error and service maintenance messages show, including a useful reference for support without exposing internal or private data?

**Proposed answer:** Errors identify the user-facing operation/result, safe next action and a nonsecret support/reference ID. Distinguish timeout/unknown result, denied access, conflict, temporary service outage and planned maintenance.

Preserve permitted draft context and actual committed results. Avoid stack traces, database details, tokens, passwords and other people's names/content. Retry is safe only after outcome reconciliation for consequential writes. Maintenance notices state real affected functions/contact and known availability, without invented recovery times or a fake successful fallback.

### S31.13

**Question:** How should stale pages refresh when another person changes request status, room availability, check-in or a financial balance? Which actions need a fresh confirmation?

**Proposed answer:** Refresh actionable queues, availability, attendance and balances when new data is available, and show last-updated or changed-by indicators where useful. Do not overwrite an active form's permitted edits silently.

Before approval, payment allocation, reservation confirmation or file release, recheck current state/revision and show a fresh review if facts changed. Read-only lists can refresh in place while preserving allowed filters/position. Confidential/revoked content must be removed from active authorized views, acknowledging that data already delivered cannot be made unseen.

### S31.14

**Question:** Which bulk operations need progress, preview, partial-failure results, cancellation and a downloadable outcome report? How should completed items be distinguished from retriable ones?

**Proposed answer:** Imports, approved bulk assignments/archives, exports and supported communication batches need preview, count/scope, progress and per-item result. Distinguish Queued, Completed, Failed, Cancelled before processing and Not eligible.

Cancellation stops remaining work where possible without pretending completed items were reversed. Retry only eligible failures with their existing identities. Outcome files are permission-checked and omit confidential fields. Bulk religious/financial/release actions remain unavailable unless explicitly approved; table selection alone is not that authorization. Recheck access before background result download.

### S31.15

**Question:** What should users be able to recover after accidental removal, cancellation or incorrect approval, and how long should Undo/restore be available for each record type?

**Proposed answer:** Proposed defaults: a 10-second accessible Undo for reversible draft/list actions and up to 30-day recoverable trash for ordinary eligible personal drafts/notes, subject to approved privacy policy. Do not apply those defaults to official/financial retention automatically.

Confirmed cancellation/reassignment uses explicit reopen/reversal rules with current prerequisites. Signatures, releases, registered entries and real payments require reviewed correction/adjustment, not a cosmetic Undo toast. Historic versions remain attributable. Explain exactly what recovery can restore and which downstream effects need separate review; never promise recall of external copies.

### S31.16

**Question:** What should the interface call a data snapshot versus an actual restorable backup, and who should receive the recovery/export controls for each?

**Proposed answer:** Call browser exports **Data snapshot / Review export**, with exact scope/date and a statement that they are not a full restorable backup. Limit access to authorized fields; member exports are own-data projections.

Actual database/files/configuration backups are controlled operational artifacts with approved owners, access and recovery procedure. Super Admin/operators manage restoration with target/environment review, consistency checks, audit and a recovery exercise. No ordinary browser upload replaces official records. Backup handling must include attachments and relevant authority history; successful download alone does not prove recoverability.

## S32

**Retention, support, onboarding and design acceptance**

### S32.01

**Question:** For people, accounts, official registers, certificates, requests, financial evidence, incidents, concerns, notes and messages, who approves retention rules and the actions available at expiry?

**Proposed answer:** Product/policy owners establish record-class retention with clergy authority for official records, finance owners for financial evidence and independent/safeguarding owners for incidents/concerns. Obtain applicable qualified policy review before adopting durations; none are invented here.

Define purpose, start event, period, legal/official hold, access after archive, permitted deletion/anonymization and backup treatment per class. Expiry creates reviewed disposition where required, not a blanket purge. Official entry deletion is not an ordinary user action. Private note/message policy remains distinct from institutional records.

### S32.02

**Question:** How should a person request access to their information, a correction, account closure or deletion, and who reviews it when official/historical records must remain?

**Proposed answer:** Provide own-data access/correction/closure requests through My account and a verified office/support route for guests or inaccessible accounts. Confirm requester identity/representation without exposing unrelated data.

An authorized scoped reviewer identifies account, person, membership and official/history dependencies separately. Explain what can change/be removed, what must remain under approved policy and how access/contact ends. Keep necessary audit and response history. Account closure is not deletion of every sacramental/financial fact, and a household adult cannot request another adult's full records merely by sharing a surname.

### S32.03

**Question:** What should a deactivation/deletion review show about linked households, minors, active requests, giving, messages and shared records before a decision is made?

**Proposed answer:** Review shows target/scope, current appointments, household/guardian links, minors/representation, open requests, confirmed events/bookings, giving/payment history, messages/files and shared records, with each preservation/handover consequence.

Separate local revocation, global account deactivation, member departure, person archive and institutional closure. Identify pending work owner and safe applicant tracking. Affected people receive only appropriate notices; no bulk sensitive-case disclosure enters the preview. Require relevant approvals/reason and preserve historic authorship. Restoration cannot override a higher authority's suspension or recreate revoked privileges silently.

### S32.04

**Question:** Who may export which data, how should scope/private fields be reviewed before export, and what explanation should accompany a download containing personal information?

**Proposed answer:** Export requires explicit record/field/scope/purpose authorization beyond ordinary page visibility where necessary. Preview selected/all-matching count, columns, dates, currencies and restricted exclusions before generating.

Members get permitted own data; office/finance/diocesan exports follow their exact grants. Exclude credentials, private tokens, unrelated notes/concerns and unneeded medical/guardian details. Label personal-data downloads for intended recipient/use and actual coverage, without unsupported legal claims. Log exporter/scope/time and recheck access at retrieval. Public directory outputs follow individual publication consent.

### S32.05

**Question:** Who handles support for members, guests, office users and administrators? Where should Help appear and what fictional/sanitized information should a support request contain?

**Proposed answer:** Parish office handles ordinary member/guest operational help; head priest handles parish authority/workflow issues; diocesan staff handle organizational escalations; developers/Super Admins handle platform defects/access recovery within authorization.

Help is reachable from account, unavailable/error states and complex workflows. Request reference, screen, role/parish context, time and sanitized reproduction—not passwords, full identity documents or private allegations in a general ticket. Use a restricted channel for confidential matters. Keep support status/owner and actual next step, not an invented always-on response promise.

### S32.06

**Question:** What first-use setup should guide a new parish through identity, staff, approved requirements, public content, opening balances and legacy-data review before opening to applicants?

**Proposed answer:** Guide setup through approved organization names/jurisdiction/head priest, optional staff, verified public contact, language readiness, actual schedules, service requirements/templates, resource/registration rules and finance opening/migration review. Indicate required versus optional steps.

Preserve Create and activate once minimum approved readiness is met, with Continue parish profile setup for optional content. Gate each unconfigured feature rather than demanding every gallery/history import first. Use Complete for the proposed all-module pilot without fake demo records. Show outstanding owners and no-secretary routing before accepting requests for affected services.

### S32.07

**Question:** Which role-specific guidance, checklists, examples and training materials are needed, and which screens should link to a plain-language explanation of the procedure?

**Proposed answer:** Provide concise role-specific task help: priest decisions/proxy review; secretary preparation/scheduling/documents; admin scope/appointments; leader membership/attendance; finance actual currencies/reconciliation; member requests; event check-in/pickup. Include EN/FR/AR examples using fictional data.

Link help at the point of action, especially statuses, required documents, scope changes and irreversible consequences. Training explains real versus unavailable integrations and the paper fallback. It supports a clear UI rather than compensating for ambiguous labels or hidden permissions. Maintain guidance with the relevant approved workflow version.

### S32.08

**Question:** What should an administrator see before launch about unavailable integrations, incomplete translations, missing setup and legacy records that still require attention?

**Proposed answer:** Provide a readiness view with configured/unconfigured services, language/template completeness, missing authority/contacts, unknown schedules, legacy links, unverified identities, finance/migration reconciliation and required validation evidence.

Assign each blocker an owner, reason and actual next action. Do not show a single green Ready score while critical priest, confidentiality, money or recovery rules remain unresolved. Legacy reading can remain available while unsafe new actions stay gated. Production claims require actual implementation/verification; this answer document itself is a draft input, not deployment evidence.

### S32.09

**Question:** Which people will test the prototype as guest, member, guardian, secretary, priest, leader, treasurer, bishop and administrator? Name a responsible reviewer for each retained role.

**Proposed answer:** Developers coordinate validation and final product sign-off. Assign named reviewers from both initial parishes for priest, secretary or no-secretary office, leader, finance and normal member/guardian work; bishop/diocesan staff review their scope. Use independent qualified review for confidential/safeguarding flows and language reviewers for EN/FR/AR.

Guest scenarios need testers without staff assumptions. Actual names remain owner-supplied inputs, not invented here. A person covering several test roles must still validate boundaries using distinct authorized perspectives; being a developer alone is not evidence the domain rule is correct.

### S32.10

**Question:** Which real tasks will those reviewers perform without coaching, and what observable result, acceptable completion time and error tolerance determine success?

**Proposed answer:** Test realistic tasks uncoached: find a parish/time; submit/track/correct a request; record priest instruction; prepare/return/approve documents; manage ministry join/leave; register/pay/check in/collect; resolve booking conflict; reconcile money; change/revoke access.

Success means correct result, authority, history, privacy and understandable next step without facilitator rescue. Establish task-time targets from observed pilot baselines rather than guessed universal seconds. Critical unauthorized access, wrong-person release, duplicate money or false official approval has zero acceptable occurrences. Record completion, errors, hesitation and required redesign.

### S32.11

**Question:** Which layouts/languages/devices must be approved, including a small phone, office desktop, Arabic right-to-left and a printed official document?

**Owner direction applied:** Approve laptop/desktop staff layouts, a small phone public/member journey, tablet/laptop event operation and keyboard/screen-reader/zoom behavior. Cover English, French, Arabic RTL and mixed-script identifiers/names.

Inspect actual printed A4 official documents, schedules, directories, finance outputs and multi-page reports with long/missing optional values. Include combined home/multi-parish/role choice, no-secretary and pending-priest states. Source snapshots or screenshots of one happy path are insufficient; record the tested state/device/language and reviewer result.

### S32.12

**Question:** What findings block design approval, who resolves disagreements and who signs off the final prototype, permission matrix and workflow specifications?

**Proposed answer:** Block design approval for unresolved authority, confidentiality, identity/representation, official-entry/signature/release, financial double-counting, mandatory-language or essential recovery contradictions. Domain owners resolve their rules; developers resolve shared UX/technical feasibility and keep final product/release authority.

Approve versioned prototype, workflow/field/permission/notification specifications together, with representative validation findings closed or explicitly accepted. A proposed answer is not automatically agreed because it appears in this file. Later production approval additionally requires implementation and operational evidence; do not label questionnaire completion as deployed readiness.

### S32.13

**Question:** Which unanswered decisions may be deferred, with what launch fallback? Who owns each remaining decision and what is its resolution date?

**Proposed answer:** Defer only named noncritical choices with an owner, target resolution date, dependency and concrete launch fallback such as hidden/unconfigured/read-only/manual office handling. All existing modules remain in scope unless the owner explicitly changes that decision.

Do not defer critical privacy, priest authority, money integrity, required language, identity or recovery behavior into guesses. Actual fees, contacts, jurisdiction/templates, capacity estimates and policy durations remain real inputs to collect, with affected actions gated. Appendix D lists these inputs and who must supply them; dates must be genuinely assigned by the owners.

### S32.14

**Question:** After approval, how should a changed workflow be documented, re-prototyped and reapproved before coding so screens, permissions, notifications and printed documents remain consistent?

**Proposed answer:** After design approval, record a change request with reason, superseded decision/version, affected roles/parishes, workflow/fields, permissions, notifications, documents, migration and validation consequences. Update the prototype/specifications together and obtain the relevant product/domain approvals before coding.

Keep historical decisions and implementation references; do not edit approved requirements silently to match accidental code behavior. Revalidate affected scenarios, not every unrelated flow by habit. Developers communicate the approved version/remaining dependencies to the team so implementation, testing and later deployment use the same authoritative design.

## Appendix A — Shared workflow and permission rules

These are proposed design rules applying to every answer. Each retained workflow needs its own screen/field validation during prototype sign-off; this table gives the common contract without creating alternative approval paths.

| Journey | Primary actor and result | Required exception behavior |
| --- | --- | --- |
| Account/signup | Person creates their own identity; contact verification has an actual recorded method. | Duplicate/unverified/lost-contact routes never expose another account or grant staff access. |
| Parish membership | Office verifies identity and links one parish person; applicant receives outcome. | Ambiguous/archived/already-linked people require review; correction cannot be self-approved. |
| Profile correction | Applicant proposes fields; authorized reviewer applies eligible versioned changes. | Show stale current values and partial decisions; official entry corrections stay separate. |
| Guest/account association | Office verifies request ownership before linking to account. | Tracking possession alone is not automatic membership or unrestricted document access. |
| Sacramental preparation | Priest/Parish Admin/secretary prepare case under approved requirements. | Missing evidence/waiver/return remain explicit and cannot be hidden by a preparation checkbox. |
| Priest decision | Assigned priest decides, directly or through a secretary recording the already-given case/stage instruction. | Exact actor and authority retained; no second online priest approval and no automatic signature delegation. |
| Celebration/registration | Actual celebration facts are reviewed and final official entry approved. | No future-date celebration, duplicated official number or ordinary deletion of approved history. |
| Certificate | Source entry, required approvals, actual signature, applicable bishop review, issuance and release. | Return/correction creates a new version; old signed snapshots are not silently rewritten. |
| Ministry join/leave | Leader/priest stages for joining; private priest review for departure. | No group checkbox bypass; leaders do not receive private departure reasons. |
| Event registration | Participant place, consent, transport and payment remain separate. | Full capacity, unknown age, missing consent, amendments and refunds have distinct outcomes. |
| Check-in/pickup | Assigned event operators verify arrival and permitted departure. | Restricted collector/unknown consent follows approved escalation, never ordinary override. |
| Reservation | Office preparation and permitted confirmation reserve exact resources. | Temporary hold is real and dated; competitors receive alternatives instead of silent automatic refusal. |
| Equipment/maintenance | Custodian records stock movements; responsible authority manages serviceability. | Missing/damaged/unsafe items create follow-up; repair estimates are not paid expenses. |
| Giving/counting | Actual receipts and genuine independent verification precede closing. | Variance remains unresolved until reviewed; closed corrections use linked adjustments. |
| Finance/Office Expenses | One actual movement and explicit domain allocations/reporting mapping. | Internal allowances are transfers, not duplicated consolidated income/expense; no self-second-approval. |
| Publishing | Editor drafts, authorized reviewer/publisher approves actual revision/audience. | Save draft retains live content; incomplete mandatory translations do not fake readiness. |
| Concern | Selected independent reviewers and permitted identity/sensitive access. | Conflicts reroute privately; no count/subject leakage or false absolute-anonymity claim. |
| Notes/workflows | Author/audience permissions and versioned operational steps. | Generic completion cannot confer clergy/financial authority or publish personal content. |
| Appointment/handover | Eligible authority grants scoped dates; actual account acts. | Revocation affects current sessions and future responsibility without erasing prior actions. |
| Organizational closure | Appropriate authority reviews affected work and archives institutional identity. | Record-bearing parish is not removed through a destructive cascade; higher suspension is not casually overridden. |

### Field specification contract

For each form field, capture: EN/FR/AR label and help, purpose/source, required/optional/conditional status, Unknown/Not applicable handling, format/options, validation/error text, viewers/editors, lock stage, history, search/export/notification inclusion and approved document use. User-input text remains original; reviewed translations are separate.

At minimum apply this to account/contact, appointment, parish setup, person, household/relationship, membership/correction, guest/member intake, every sacrament, certificate, document requirement/release, event/recurrence, ministry application/departure, participant/consent/transport/payment, pickup/incident, reservation/resource loan, giving/count, expense/transfer/reconciliation, publication, concern and workflow-builder forms. Missing official templates/fields are domain inputs, not a reason to fabricate facts.

## Appendix B — Reporting and count definitions

| Measure | Proposed calculation and disclosure |
| --- | --- |
| Needs my action | Distinct canonical cases with a currently available action for the selected authority/scope; no double count of linked intake/office records. |
| Waiting | Open cases whose next action depends on another person, evidence, a date or a real external event; label the dependency. |
| Active membership | Current approved memberships/roster entries in stated scope; distinguish unique people and multiple memberships. |
| Group attendance | Present plus policy-defined Late over expected recorded outcomes in selected meetings/period; show missing data and exclude Not expected/cancelled meetings. |
| Registration versus attendance | Confirmed eligible registrations compared with actual recorded arrivals for the same occurrence; guests/manual pending data identified separately. |
| Volunteer workload | Confirmed scheduled commitments and separately verified actual hours, with period and overlapping-duty warnings; no unsupported public ranking. |
| Facility utilization | Confirmed occupied resource hours against actual available hours under stated block/opening rules; requests/holds/downtime separately visible. |
| Decision time | Actual received-to-decision intervals for the defined case/stage/status set; show unresolved cases and period/sample size. |
| Giving | Actual posted receipts less attributable reversals/refunds by currency/fund/period; pledges are separate and anonymity preserved. |
| Budget versus actual | Approved budget revision compared with eligible actual transactions under the defined fund/period mapping; internal transfers not new expense. |
| Office cash | Initial approved opening plus allowances/eligible receipts minus actual office spend by currency, carried forward; inter-ledger transfer reconciled once. |
| Unread notifications | Authorized account notifications not deliberately read, deduplicated per event/purpose; unrelated confidential cases excluded. |

Every report identifies parish/diocese/combined scope, date basis, precision/time zone, applicable status set, last refresh, source coverage and authorized drill-down. Zero is used only for an actual measured absence, not missing data. Financial equivalents clearly state conversion basis and are not cash balances.

## Appendix C — Notification transition matrix

All rows use the recipient's supported preferred language and currently permitted channel. In-system account notifications or private guest tracking are the baseline; external notices require genuine configured delivery. Every notification links to a currently authorized destination. Recheck recipients/scope at send/read time, deduplicate multiple roles, keep private details out of general previews, and assign failed important sends to a responsible owner.

| Trigger | Recipients | Message purpose / linked next action |
| --- | --- | --- |
| Signup/contact verification requested | Intended contact/account | Real verification step and actual expiry; never claim a code sent without delivery. |
| Invitation created manually | Inviting office | Link created, not sent; approved handoff needed. |
| Invitation actually delivered/expiring | Intended eligible recipient | Claim/renew through real invitation route. |
| Membership submitted | Applicant and eligible office queue | Received; office identity/link review. |
| Membership needs information | Applicant | Specific permitted clarification and reply route. |
| Membership approved/declined | Applicant | Outcome, appropriate reason and resulting permitted access/reapply route. |
| Profile correction submitted/replaced | Applicant and office reviewer | Proposal received/version changed; no official change yet. |
| Correction approved/partial/declined | Applicant | Field-level outcome and review link. |
| Guest/account association submitted | Account claimant and eligible office | Ownership review pending; no membership granted. |
| Guest/account association decided | Claimant | Approved/declined association and permitted request destination. |
| Service request saved | Applicant; eligible office/priest queue | Received with reference, actual next authority and contact. |
| Information/document requested | Applicant/authorized representative | Needed item and permitted response, not internal staff notes. |
| Applicant reply/document received | Current authorized case owner | Review the response and remaining requirements. |
| Direct priest acceptance/approval | Applicant and relevant office | Actual decision/stage and next required task. |
| Secretary records prior priest instruction | Responsible priest; relevant office/applicant as permitted | Priest gets attributed informational activity; applicant gets effective decision without internal instruction text. |
| Preparation completed/returned | Relevant office/priest; applicant when action needed | Remaining next stage or requested correction, not automatic celebration proof. |
| Date confirmed/changed | Applicant, assigned clergy/resources and relevant team | Exact new parish-local time/location; reconfirmation where needed. |
| Celebration facts submitted | Responsible priest/office | Review actual facts before official registration. |
| Official entry registered | Applicant/authorized office | Approved entry available; separate certificate process where requested. |
| Certificate awaits signature | Responsible priest | Review/sign actual approved revision. |
| Certificate signed, bishop review required | Eligible bishop queue and responsible office/priest | Review pending; no ready-to-collect claim. |
| Bishop returns certificate | Priest and eligible preparers; applicant only useful neutral update | Reason and revision/resubmission task. |
| Bishop accepts / certificate issuance authorized | Priest/eligible office | Finalize actual output and verify release arrangements. |
| Reviewed document released | Verified applicant/authorized recipient | Secure own download/collection instructions without attaching private evidence to broad messages. |
| Document collected/downloaded as recorded | Applicant/eligible office | Actual receipt status and remaining issues, if any. |
| Case declined/cancelled/reschedule refused | Applicant/affected authorized staff | Appropriate reason, alternatives and fee/resource consequences. |
| Ministry application submitted | Applicant and assigned leader/priest | Awaiting current stage owner. |
| Leader stage completed | Applicant and responsible priest as appropriate | Final roster approval still needed unless priest already decided. |
| Ministry membership approved/declined | Applicant and relevant permitted leader/office | Actual active roster outcome/reapply route. |
| Private departure submitted/updated | Applicant and authorized parish priests only | Private review; no reason in leader/general feed. |
| Departure completed | Applicant/priests; leader receives neutral roster change only | End date, assignment handover and access effect. |
| Event published/changed/cancelled | Intended permitted audience/registrants | Actual public/group information; material changes require relevant acknowledgment. |
| Registration reserved/waitlisted/confirmed | Applicant/authorized guardian and event owner | Separate place, consent, transport and payment facts. |
| Waitlist invitation/expiry | Invited applicant and coordinator | Real offer/deadline; manual follow-up when no automatic mechanism. |
| Required consent missing/changed/withdrawn | Authorized applicant/guardian and designated event staff | Applicable verification/action without broad medical/guardian details. |
| Payment verified / balance adjustment / refund completed | Authorized payer/applicant and finance owner | Actual transaction/reference/allocated outcome, not gateway simulation. |
| Volunteer invitation/offer/confirmation/decline | Volunteer and eligible coordinator | Exact slot/status/response needed. |
| Volunteer cancellation/swap | Volunteer, coordinator and permitted replacement | Replacement eligibility/acceptance and actual assignment update. |
| Reservation hold/confirmation/change/cancellation | Applicant and permitted resource/office owner | Actual resource/time/hold expiry and next action. |
| Competing booking loses availability | Affected applicant/office | Alternative needed; no disclosure of winning applicant. |
| Maintenance/resource failure affects commitment | Responsible staff and affected applicants | Real unusable/relocation status and contact; no automatic refund claim. |
| Loan overdue/damaged | Borrower/authorized custodian | Return/review task and permitted evidence. |
| Count variance / finance approval / reconciliation exception | Eligible finance actors | Review actual record; donor/private evidence excluded from general notifications. |
| Confidential concern submitted/reassigned/updated | Submitter and currently selected eligible reviewers only | Minimal confidential-case update via protected destination. |
| Incident assigned/updated | Designated incident handler/approved relevant recipient | Minimal restricted follow-up, no broadcast of involved persons. |
| Shared task assigned/completed/reopened | Permitted owner/assignee | Task-specific audience and actual result. |
| Appointment offered/accepted/expiring/revoked | Appointee and eligible appointing authority | Exact role/scope/date and access/review task. |
| Password/contact/session change | Intended account/security route | Actual change and safe recovery, without credentials. |
| Publication submitted/returned/published/withdrawn | Relevant editor/publisher and permitted audience | Revision/audience outcome; private drafts not sent publicly. |
| Export/import/bulk job completes partially | Authorized initiating actor | Per-item outcome and permitted result retrieval. |

Notification acknowledgment is distinct from underlying approval. An unread priest notification never turns an already effective secretary-recorded instruction into another required approval. No optional preference allows an unrelated person to receive a sensitive case.

## Appendix D — Required real-world inputs and approval owners

The document answers every question as a direction or proposal. These factual/policy values still need genuine sources before the affected feature is finalized; replacing them with guessed values would contradict the requested accuracy.

| Input / approval | Responsible source | How to proceed until supplied |
| --- | --- | --- |
| Official diocese/parish identities, three-language names, jurisdiction/rite | Bishop/authorized diocesan and parish offices | Keep setup provisional; do not infer from similarly named churches or seed data. |
| Actual clergy/staff appointments and head designations | Competent appointing authority | Show pending/unassigned state; no self-appointment. |
| Contacts/hours/urgent arrangements, verified address/coordinates/photos | Head priest/authorized office publisher | Honest missing data/contact setup; no invented number or 24-hour coverage. |
| Actual schedules, feast sources and service exceptions | Priest/competent calendar authority | Publish verified text only; no guessed next-Mass result. |
| Mandatory sacramental evidence, waivers, official numbers and templates | Bishop/competent sacramental office | Gate final approval/output until policy is approved. |
| Certificate bishop gate variations, signatures and official digital status | Competent ecclesiastical authority | Proposed new-certificate bishop gate; no assumed signature delegation. |
| Event age/guardian/pickup/incident and independent review procedures | Designated safeguarding/policy owners with appropriate review | Do not advertise unsupported protection/escalation; trained manual process required. |
| Real fees, funds, budgets, discounts, financial limits and reporting mappings | Priest/finance lead/diocesan finance where applicable | No sample amounts or fabricated balance; restrict unresolved financial actions. |
| Confidential case reviewers/conflict escalation and identity access | Approved independent authority | No automatic routing to an implicated/unauthorized person. |
| Retention/disposition and exceptional disclosure rules | Product/domain/policy owners with qualified review | Preserve required history; no blanket deletion durations inferred. |
| Actual operating volumes, peak use, import coverage and national expansion horizon | Product owners and participating offices | Use representative cases but do not claim national capacity validation. |
| Actual channel/provider, monitoring, scheduler, payment and verification setup | Authorized platform owners and operating service owners | Explicit unconfigured/manual state; no fake delivered/verified/paid result. |
| Approved EN/FR/AR text and document assets | Named language/domain reviewers | Draft readiness tasks; no automatic official-name invention. |
| Validation participants, target dates and accepted task-time targets | Developers and representative users | Record actual names/dates/results, not fictitious sign-off. |

### Proposed operational defaults requiring owner approval

| Default | Proposal and limitation |
| --- | --- |
| Person invitation | Seven days, single use, revocable; actual sent state separate. |
| Appointment expiry notices | 30 and 7 days beforehand; short assignments adjusted; genuine delivery/manual follow-up. |
| Appointment review | Annually and leadership change; review does not silently end an indefinite grant. |
| Temporary facility hold | 24 hours by eligible office action, with real expiry and reviewed renewal. |
| Event place/waitlist offer follow-up | Normally 48 hours where suitable; event-specific published deadline and actual release. |
| Sensitive released-file window | 30 days, renewable after review; different from certificate validity/record retention. |
| Ordinary saved drafts / eligible trash | Proposed 30-day window where privacy policy permits, with warning and authenticated recovery. |
| Reversible-action Undo | Proposed 10 seconds plus an accessible reviewed recovery route; not for irreversible external effects. |
| Uploads | Proposed 10 MB/file, 20 files/case, safe official types; long PDF warning/review, not truncation. |
| Password enrollment | Proposed 12 ordinary / 16 privileged characters with usability/actual security controls and reviewed migration. |

These are product-design proposals, not asserted statutory or ecclesiastical requirements.

## Appendix E — Acceptance and handoff checklist

Use fictional records in a representative prototype, then actual implemented verification before production. For each selected journey document actor/scope, start/end states, fields/evidence, timeline, notification, outputs and recovery. At minimum validate:

1. Initial system setup with two individual Super Admins, first bishop and both parishes.
2. One-role direct login, multi-role choice, one combined home and combined parish filtering.
3. Ordinary follower/no-parish discovery and pending priest assignment without staff-data access.
4. Same account with different parish roles, cross-tab switching and revocation during a pending action.
5. No-secretary office operation without fake identities or inherited clergy/signature powers.
6. Child/person matching with an ambiguous archived record and incomplete name/guardian information.
7. Guest request and authenticated request for the same service, missing evidence, replies and reviewed account linking.
8. A secretary records a specific priest instruction: effective once, both identities internal, priest notified, priest name on printed paperwork.
9. Tentative scheduling, resource conflict, rescheduling/no-show, actual celebration and official numbering/correction.
10. Certificate source waiting, priest signature, bishop return/resubmission, final release and wrong-recipient prevention.
11. Ministry join/withdrawal/private departure, leadership handover and historical attendance preservation.
12. Event capacity race, missing consent/unknown age, transport/payment adjustment, waitlist and refund.
13. Check-in/pickup restriction, lost code, paper fallback, incident privacy and event-only emergency roster.
14. Competing room requests, actual expiring hold, maintenance interruption, equipment package and damaged return.
15. Genuine two-person count disagreement, mixed actual USD/LBP, closure and attributed post-close adjustment.
16. Event/rental payment and office allowance/purchase reporting with no duplicate transaction/cost.
17. Confidential case involving a senior cleric, conflict reassignment, anonymous limits and zero unrelated count/search leakage.
18. Private author notes, explicit sharing, task assignment and appointment departure without inherited private access.
19. Published trilingual revision versus draft, concurrent editing, family publicity and withdrawal.
20. Arabic/French/English long forms, keyboard/screen reader/zoom, phones and real A4 document layouts.
21. Lost response after successful write, failed attachment/notification, safe retry and clear partial outcome.
22. Module downgrade/deactivation with in-flight work, existing tracking, retained official history and actual contact fallback.

A development handoff contains the approved revision of this answer file, permission/field/notification specifications, annotated UI/prototype, domain templates, actual setup inputs, scenario results and explicitly owned remaining tasks. This drafted answer file does not automatically approve its proposals, change application behavior or certify production readiness.
