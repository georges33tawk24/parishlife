# Finance module

Pages `giving`, `finance`, `officeexpenses`. Code: `frontend/src/portal/model/modules/finance.js`, `features/money/*` (including `money-actions.jsx` for the decision dialogs), check `frontend/scripts/checks/finance.mjs`. Collections owned: `RATE`, `RATES`, `BUDGETS`, `COUNT_SESSIONS`, `BATCH`, `FUNDS`, `EXPENSES`, `PLEDGES`, `CAMPAIGNS`, `RECURRING`, `RECEIPTS`, `BANKLINES`, `GIVING_SERIES`, `PAYMENT_MIX`, `OFFICE_LEDGER` and `CONTRIBUTIONS`. (`RATES`, `BUDGETS` and `COUNT_SESSIONS` are new in `data.js`; `SESSIONS` was already taken by another page.)

Visible to the priest and to grants with `finance.read`. Buttons follow `finance.enter`, `finance.post` and `finance.approve`; the API checks each again (and requires MFA). A 403 leaves a collection empty. Actor ids (who entered, approved, counted, verified, posted, recorded a rate, issued a receipt) are shown through `loadNames`/`nameOf`.

## Amounts and the exchange rate

Every amount stays in the currency it was recorded in; the API never converts and the screens never add currencies together. An **exchange rate** is a value an office with `finance.approve` records with its effective date and source (`POST finance/exchange-rates`). It is never fetched from an outside service, never invented and never applied to a stored amount. Records are append-only: a mistake is corrected by recording the right rate, and the latest recorded rate for a date applies (`GET finance/exchange-rates/current?baseCurrency&quoteCurrency&on`). The Finance page lists the recorded rates with date, source and who recorded them. `RATE` is the latest USD→LBP record (`value`, `setOn`, `source`, `setBy`), or `value: 0` when none is recorded. No dollar-equivalent is shown beside lira.

## Routes used

All under `/api/parishes/{id}/`.

| Screen | Route |
| --- | --- |
| Funds, balances | `GET finance/funds`, `GET finance/balances`, `POST finance/funds`, `PUT finance/funds/{id}` (names and purpose in both languages; the restriction never changes) |
| Budgets | `GET finance/budgets`, `PUT finance/budgets` (fund, year, currency; version when replacing). Spent = paid expenses of that fund and currency with a payment date in that year |
| Exchange rates | `GET/POST finance/exchange-rates`, `GET finance/exchange-rates/current` |
| Campaigns | `GET/POST finance/campaigns`, `PUT finance/campaigns/{id}` (the fund never changes) |
| Pledges | `GET/POST finance/pledges`, `POST finance/pledges/{id}/allocations` |
| Counting sessions | `GET finance/sessions` (list, with `countedBy`), `POST finance/sessions`, `GET finance/sessions/{id}`, `PUT .../lines`, `POST .../verify`, `POST .../post` |
| Posted gifts | `GET finance/contributions`, `POST finance/contributions/{id}/corrections` |
| Recurring gifts | `GET/POST finance/recurring-gifts`, `PUT finance/recurring-gifts/{id}`, `POST .../actions` (pause, resume, end with a reason) |
| Receipts | `GET/POST finance/receipts`, `POST finance/receipts/{id}/void` |
| Statements | `GET finance/statements?year&personId\|householdId` |
| Expenses | `GET/POST finance/expenses`, `PUT finance/expenses/{id}`, `POST .../actions` |
| Bank | `GET finance/bank/lines`, `POST bank/imports`, `POST bank/lines/{id}/actions`, `GET/POST bank/reconciliations`, `POST bank/reconciliations/reopen` |
| Office ledger | `GET office-ledger/entries`, `GET office-ledger/balances`, `GET/POST office-ledger/openings`, `POST/PUT entries`, `POST entries/{id}/actions`, `POST months` |

Diff-saved: new fund and fund name corrections, new campaign and campaign corrections, pledge, expense (draft), the open session's lines, office entries and openings. Dialogs: verify, close, approve, pay, match, reconcile, remove/reverse, close month, choose a session, record a rate, set a budget, new/edit/pause/resume/end a recurring gift, issue/void a receipt.

## Arabic names

Funds (`nameAr`, `purposeAr`), campaigns (`nameAr`, `purposeAr`), expenses (`descriptionAr`) and office entries (`descriptionAr`) store an optional Arabic twin exactly as typed, never filled from English. The record-editor fields deliberately do not use the `pair` helper, whose `fallback` copies English into Arabic on save. Display falls back to English when the twin is empty. Records saved before the change return `null`. Office entries also take an optional free-text `category`.

## Recurring gifts

A stored intention: giver (person or household), fund, amount and currency, frequency (Weekly/Monthly/Quarterly/Yearly), the method the giver said they use, start/end and a note. `nextExpectedOn` is an expectation only. Nothing is charged, collected or marked paid; a gift counts only when it is counted and posted in a session.

## Numbered receipts: the guarantee achieved

One counter per parish (`giftReceiptCounter`). Issuing a receipt commits, in one conditional transaction on the parish partition: the parish fence (ETag), the counter replace (ETag of the counter read, or create for the first), a one-receipt-per-gift claim (`giftReceiptFor:{gift}`, create-only) and the receipt. A number is used only when its receipt is stored, so numbers are unique and consecutive with no gap, and a gift gets at most one receipt. A conflicting concurrent write makes the commit fail with `write_conflict`; the service re-reads everything and retries (up to 8 attempts), and the operation id makes a retry of the same request idempotent. A voided receipt keeps its number, and its gift's receipt is never reissued. Only posted, non-anonymous, attributed gifts receive receipts. A receipt is labelled as not a tax document.

**Verified locally only** (`LocalDocumentDatabase`, file-locked atomic batches): the integration test issues five receipts concurrently and gets 1–5 with the counter at 6. **Cosmos behaviour is unverified**. The code relies on the Cosmos transactional batch with If-Match being atomic within one partition, as `RecordTransactions` already does for every other write. Under heavy contention, more than 8 conflicts in a row return a 409 to the caller; no number is lost in that case.

## Still not connected, and why

- Dollar equivalents beside lira: a recorded rate exists now, but showing converted figures is an owner decision (below).
- Fees and refunds to donors: owner policy (U-items); nothing is invented.
- Office ledger receipt files (the Files module) and a fixed category list (the category is free text).
- Editing or deleting a pledge; deleting an expense (cancel instead); editing a posted gift (reverse or reclassify instead).
- Pledge `paid` is the sum of allocations. `POST pledges/{id}/allocations` takes a GUID contribution id, so a reclassified gift (id with a `c` suffix) cannot be allocated. This limitation already existed and is unchanged.
- `features/dashboard/` still reads `FUNDS[].budget/actual`, `RATE` and `BATCH.lines[].usd`. `budget`/`actual` are now this year's USD budget and USD spent, and `RATE` is the latest recorded USD→LBP rate. Left to integration.

## Open owner decisions

1. **Converted figures**: should screens show labelled equivalents using a recorded rate (and of which date: the gift's or the report's), or only list rates?
2. **Receipt numbering format**: currently a plain per-parish sequence (1, 2, 3…) that never resets. A prefix, yearly reset or per-fund books need a decision.
3. **Who issues receipts**: `finance.post` issues, `finance.approve` voids. Confirm.
4. **Rates permission**: `finance.approve` records rates. Confirm, and whether a fixed list of rate sources is wanted.
5. **Budgets**: per fund, calendar year and currency, set by `finance.approve`. Confirm calendar versus fiscal year.
6. Fees, refunds and approval limits (OWNER-QUESTIONS item 17).
7. The role `treasurer` is a grant with only `finance.*`; confirm those grants should see Office Expenses.

## Verified

Backend: `FinanceTests` (13 tests, including the new rate, budget, recurring, receipt, concurrent-receipt and HTTP authorization tests). Frontend: `npm run format:check`, `npm run check` (the finance check covers the load mapping of twins, budgets, rates, recurring gifts, receipts, sessions, openings and names; fund and campaign PUTs; unsupported edits undone; and the rate, budget, recurring and receipt calls), `npm run check:routes` (0 new gaps) and `npm run build`. Not run against a live API.
