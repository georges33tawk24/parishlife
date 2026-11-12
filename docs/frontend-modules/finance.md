# Finance module

Pages `giving`, `finance`, `officeexpenses`. Code: `frontend/src/portal/model/modules/finance.js`, `features/money/*` (including `money-actions.jsx` for the decision dialogs), check `frontend/scripts/checks/finance.mjs`. Collections owned: `RATE`, `BATCH`, `FUNDS`, `EXPENSES`, `PLEDGES`, `CAMPAIGNS`, `RECURRING`, `RECEIPTS`, `BANKLINES`, `GIVING_SERIES`, `PAYMENT_MIX`, `OFFICE_LEDGER`, and `CONTRIBUTIONS` (new in `data.js`: posted gifts).

Visible to the priest and to grants with `finance.read`. Buttons follow `finance.enter`, `finance.post` and `finance.approve`; the API checks each again (and requires MFA). A 403 leaves a collection empty.

## Amounts and the exchange rate

The API keeps every amount in the currency it was recorded in and never converts: there is **no exchange rate**. `RATE` stays `{ value: 0 }` and a change to it is undone and reported as not connected. The screens show each amount in its own currency (`$`, `L.L`, or the code) and never add currencies together or show a converted figure. The "rate that produced it" does not exist in the API, so none is shown.

## Routes used

All under `/api/parishes/{id}/`.

| Screen | Route |
| --- | --- |
| Funds, balances | `GET finance/funds`, `GET finance/balances`, `POST finance/funds` |
| Campaigns | `GET/POST finance/campaigns` |
| Pledges | `GET/POST finance/pledges`, `POST finance/pledges/{id}/allocations` |
| Counting session | `POST finance/sessions`, `GET finance/sessions/{id}`, `PUT .../lines` (all lines, with `version`), `POST .../verify`, `POST .../post` |
| Posted gifts | `GET finance/contributions`, `POST finance/contributions/{id}/corrections` (reverse, reclassify) |
| Statements | `GET finance/statements?year&personId\|householdId` (one giver, or one call per giver for "every giver") |
| Expenses | `GET/POST finance/expenses`, `PUT finance/expenses/{id}`, `POST .../actions` (submit, return, approve, reject, cancel, record-payment) |
| Bank | `GET finance/bank/lines`, `POST bank/imports`, `POST bank/lines/{id}/actions` (match, outstanding, unmatch), `GET/POST bank/reconciliations`, `POST bank/reconciliations/reopen` |
| Office ledger | `GET office-ledger/entries`, `GET office-ledger/balances`, `POST openings`, `POST/PUT entries`, `POST entries/{id}/actions` (remove, reverse), `POST months` |

Creates carry an `operationId`; versioned writes send the version returned with the record. Diff-saved: new fund, campaign, pledge, expense (a draft; Submit is a button), edit of a draft/returned expense, the open session's lines, office entries and openings. Everything that is a decision (verify, close, approve, pay, match, reconcile, remove/reverse, close month) is a dialog that calls the route and reloads.

## Fields with no API equivalent (left empty or removed)

- Exchange rate (`RATE`), and the dollar-equivalent shown beside lira everywhere on these pages.
- Fund budgets: `FUNDS[].budget` is 0 and the budget columns and chart were removed. (The dashboard still reads it.)
- Recurring gifts (`RECURRING`) and numbered receipts (`RECEIPTS`): empty with a notice. A giver's yearly statement stands in for receipts.
- Arabic names of funds, campaigns and expenses; donor count and "ends" count on campaigns (totals per currency are shown instead).
- Office ledger: category, receipt file attachments (the API stores a receipt reference or the reason it is missing), and a list of openings.
- Expense "submitted by": the API names an account, not a person.
- Counting-session counters (people): the API names accounts.
- Editing or deleting a fund, campaign or pledge; deleting an expense (cancel with a reason instead); editing a posted gift (reverse or reclassify instead).
- Pledge `paid` is the sum of allocations; a gift counts toward a pledge only through "Count a gift".

## Workarounds worth knowing

- The office opening balance has no list route. It is derived as the current month's opening balance less everything dated before that month, kept as a dateless row that counts toward every month and is not listed.
- The dollar series and "how people give" are computed from posted USD gifts only.
- The open counting session id is remembered in this browser (`localStorage`, per parish) because there is no list route. Another counter opens it by its id, shown on the page.

## Open owner decisions

1. **List counting sessions** (`GET finance/sessions`): without it the second counter must be given the session id.
2. **Exchange rate**: the product text promised "the rate that produced them". Add a parish rate with each gift or expense, or drop the idea of conversion.
3. **Budgets, recurring gifts, numbered receipts**: add to the API or retire from the screens.
4. **Office ledger**: a `GET openings` route, an expense category, and file evidence (the Files module) if wanted.
5. The role `treasurer` is a grant with only `finance.*`; confirm those grants should see Office Expenses.
6. `features/dashboard/` still reads `BATCH.lines[].usd`, `FUNDS[].budget/actual` and `RATE`; it keeps working but shows 0 for budget and the rate until integration.

## Verified

`npm ci`, `npm run format:check`, `npm run check` (includes `checks/finance.mjs`: load mapping, fund/expense/session-lines/office saves, unsupported edits undone, verify/approve/match calls) and `npm run build`. Not run against a live API (a signed-in finance account needs the operator commands).
