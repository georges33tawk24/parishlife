# Parish finance operations

Updated 10 November 2026. Source basis: S24.01–S24.14 and S25.01–S25.07 (proposed). Routes are under `/api/parishes/{parish}/finance`; every path needs current MFA and the finance module. ParishLife is a controlled parish administrative ledger, not automatically a certified replacement for external accounting; finance owners decide that. Parish finance is separate from ParishLife subscription billing.

**Currencies:** amounts are stored exactly in their actual currency (three-letter code, at most two decimals). An LBP gift is stored in LBP, never as converted USD. Balances, totals and statements are shown per currency and are never combined; no exchange rate or reporting equivalent is applied.

## Permissions

| Permission | Used for |
| --- | --- |
| finance.read | Funds, campaigns, sessions, gifts, pledges, statements, expenses, balances |
| finance.enter | Opening sessions and counting lines, verifying another person's count, pledges, allocations, entering/submitting expenses |
| finance.approve | Creating funds and campaigns, reversing/reclassifying posted gifts, approving/returning/rejecting expenses |
| finance.post | Posting a verified session, recording an expense payment |

## Counting and posting

1. `POST /sessions` opens a session with a unique reference (`CS-<date>-…`), source and collection date.
2. `PUT /sessions/{id}/lines` saves up to 90 lines (amount, currency, method, fund, campaign, person, envelope, anonymity, reference); each save is a new revision. Envelope numbers resolve against the parish's household envelope assignments; an unknown number stays unattributed for review. Anonymous lines keep no donor link.
3. `POST /sessions/{id}/verify`: someone who neither opened nor edited the session enters the totals they counted per currency and method for the exact revision. Matching totals mark it Verified. A mismatch records a Variance with both observations kept, and the session goes back for a recount; nothing is adjusted to make totals agree.
4. `POST /sessions/{id}/post` (finance.post) posts a session verified at its current revision once. Each line becomes one contribution with an id derived from the session and line, so a second posting is impossible.

## Corrections, pledges, campaigns and statements

- `POST /contributions/{id}/corrections`: `reverse` adds a linked negative reversal; `reclassify` adds the reversal plus a new gift with the corrected fund, donor or anonymity. Originals are never edited or deleted.
- `POST /pledges` records a promise and schedule for a person or household; it never authorizes charging anyone. `POST /pledges/{id}/allocations` allocates part of a posted gift in the same currency, never more than the gift's unallocated amount.
- `POST /campaigns` records purpose, fund, dates and optional genuine targets per currency. Campaign totals come from posted gifts (net of reversals), with pledges reported separately.
- `GET /statements?personId|householdId&year=` lists attributed, non-anonymous posted gifts with totals per currency, labelled as a record of gifts received, not a tax receipt. `GET /giving/mine?year=` gives a linked member their own gifts only.

## Expenses and balances

- `POST /expenses`, `PUT /expenses/{id}` save a draft with description, fund, payee, date, amount and currency, plus either an invoice/receipt reference or the reason one is missing.
- `POST /expenses/{id}/actions`: `submit`; `approve`, `return` or `reject` by a different person from the one who entered or submitted it (approving a missing-receipt expense records that named exception); `record-payment` with the actual date and reference; `cancel` with a reason.
- `GET /balances` shows, per fund and currency, posted gifts net of reversals, paid expenses and the balance.

Not implemented: bank import and reconciliation (G08), labelled reporting equivalents with recorded rates (G09), office allowances and vouchers (G10), period close and export grants, budgets, refunds to donors, receipt documents and issued statements, member household giving views, and online payment.

## Bank statements and reconciliation (G08)

Source basis: S25.08–S25.10 (proposed). Routes under `/api/parishes/{parish}/finance/bank` need current MFA and the finance module.

- `POST /imports` (finance.enter) takes a CSV with the header `Date,Reference,Amount,Currency`: ISO dates and signed amounts (deposits positive, withdrawals negative) with up to two decimals, for one named bank account. The whole file is checked first and nothing is written if any line is wrong. A line with the same account, date, reference, amount and currency is recognised as already imported and reported as a duplicate, never posted twice. Original text is kept on each line.
- `GET /lines?account=&status=` (finance.read) lists lines.
- `POST /lines/{line}/actions` with the line's version:
  - `match` (finance.post) needs allocations that add up exactly to the line. Deposits can go to posted gifts, withdrawals to paid expenses, both in the same currency. `Fee` allocations are withdrawals; `Other` needs a note. A gift or expense can never be allocated beyond its recorded amount, and concurrent matches against the same record conflict.
  - `outstanding` (finance.post) records an unexplained difference with its owner/reason; nothing is auto-assigned.
  - `unmatch` (finance.approve) needs a reason.
- `POST /reconciliations` (finance.approve) closes one account's month (`yyyy-MM`) once every line is matched or outstanding. It must be done by a reviewer who matched none of that month's lines. It records totals per currency and the outstanding lines, and locks the month's lines.
- `POST /reconciliations/reopen` reopens a closed month with a reason, keeping the original reviewer and time. `GET /reconciliations` lists them.

Not implemented: bank templates other than this CSV, non-ISO date formats, matching to registration/reservation payments, opening/closing balance checks against the statement, and frontend.

## Office ledger (G10)

Source basis: S25.11–S25.13 (proposed). The office ledger is the office's own cash book, separate from parish Finance expenses. Routes under `/api/parishes/{parish}/office-ledger` need current MFA and the finance module.

- `POST /openings` (finance.approve) enters the one opening balance per currency, with its effective date and provenance. A second opening is refused; later months carry the balance forward.
- `POST /entries` and `PUT /entries/{entry}` (finance.enter, with the version when editing) record entries:
  - An **Allowance** names the Finance record that moved the cash, so consolidated reports can avoid counting it twice.
  - A **Purchase** names the supplier and a receipt reference, or the reason the receipt is missing.
  - Amounts keep their own currency (for example USD and LBP), and dates fall on or after the opening and not in the future.
- `POST /entries/{entry}/actions`:
  - `remove` takes an entry out of an open month, keeping it as Removed with the reason.
  - `reverse` corrects an entry in a closed month with a new reversal entry dated in an open month.
- `POST /months` (finance.approve) closes a month once earlier months with entries are closed. The reviewer must have entered none of the month's lines. It stores per-currency opening, in, out and closing figures and flags negative balances. Nothing is topped up automatically.
- `GET /entries?period=`, `GET /months` and `GET /balances` show entries, closed months and the current month's running balances.

Not implemented: vouchers and printable monthly summaries in EN/FR/AR, a mapping to Finance reporting categories, reopening a closed month, attachment handling and frontend. The owner still has to approve the delete-versus-reversal rule.
