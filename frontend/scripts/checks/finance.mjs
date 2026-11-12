/* Purpose: checks the Finance module against a stand-in for ParishLife.Api's finance routes: what load
   fills (funds with per-currency balances, gifts, expenses, bank lines, the office ledger, the open counting
   session), what save sends (a new fund, expense, pledge, session lines, office entries), what is refused
   as unsupported (the exchange rate, recurring gifts), and the workflow calls (verify, post, expense
   decisions, bank match). Run with `npm run check`. */
import assert from 'node:assert/strict';
import { json, mockApi, signedIn } from '../mock-api.mjs';

const F1 = 'f1111111-1111-1111-1111-111111111111',
  S1 = 's1111111-1111-1111-1111-111111111111',
  P1 = 'p1111111-1111-1111-1111-111111111111';
const store = {
  expenses: [
    {
      value: {
        id: 'x1',
        description: 'Diesel',
        fundId: F1,
        payee: 'Fuel Co',
        incurredOn: '2026-11-02',
        amount: 180,
        currency: 'USD',
        evidenceReference: 'INV-9',
        status: 'Submitted',
        createdBy: 'a1'
      },
      version: 'v-x1'
    }
  ],
  session: {
    value: {
      id: S1,
      reference: 'CS-20261108-AAAAAA',
      source: 'Sunday Mass',
      collectedOn: '2026-11-08',
      status: 'Open',
      revision: 1,
      lines: [
        { key: 'l1', amount: 50, currency: 'USD', method: 'Cash', fundId: F1, personId: P1, envelopeId: '0142' },
        {
          key: 'l2',
          amount: 4500000,
          currency: 'LBP',
          method: 'Cash',
          fundId: F1,
          unattributed: false,
          reference: 'Loose cash'
        }
      ],
      totals: [
        { currency: 'LBP', method: 'Cash', amount: 4500000 },
        { currency: 'USD', method: 'Cash', amount: 50 }
      ]
    },
    version: 'v-s1'
  }
};
const { sent } = mockApi((method, path, body) => {
  const p = path.replace('parishes/P/', '');
  if (method === 'GET') {
    if (p.startsWith('people')) return json(200, { items: [], continuationToken: null });
    if (p === 'finance/funds')
      return json(200, [
        { id: F1, name: 'General fund', purpose: 'Running costs', restricted: false, status: 'Active' }
      ]);
    if (p === 'finance/balances')
      return json(200, [
        { fundId: F1, fundName: 'General fund', currency: 'USD', received: 500, paid: 180, balance: 320 },
        { fundId: F1, fundName: 'General fund', currency: 'LBP', received: 4500000, paid: 0, balance: 4500000 }
      ]);
    if (p === 'finance/campaigns')
      return json(200, [
        {
          id: 'c1',
          name: 'Roof',
          purpose: 'Repairs',
          fundId: F1,
          startsOn: '2026-01-01',
          endsOn: null,
          targets: { USD: 1000 },
          received: { USD: 250 },
          pledged: { USD: 400 },
          status: 'Active'
        }
      ]);
    if (p === 'finance/pledges')
      return json(200, [
        {
          id: 'pl1',
          personId: P1,
          fundId: F1,
          amount: 600,
          currency: 'USD',
          allocated: 150,
          startsOn: '2026-01-01',
          status: 'Active'
        }
      ]);
    if (p === 'finance/contributions')
      return json(200, [
        {
          value: {
            id: 'g1',
            sessionId: 's0',
            amount: 100,
            currency: 'USD',
            method: 'Cash',
            fundId: F1,
            personId: P1,
            anonymous: false,
            receivedOn: '2026-11-01',
            status: 'Posted'
          },
          version: 'v-g1'
        },
        {
          value: {
            id: 'g2',
            amount: 300,
            currency: 'USD',
            method: 'Bank',
            fundId: F1,
            anonymous: true,
            receivedOn: '2026-10-01',
            status: 'Posted'
          },
          version: 'v-g2'
        }
      ]);
    if (p === 'finance/expenses') return json(200, store.expenses);
    if (p === 'finance/bank/lines')
      return json(200, [
        {
          id: 'b1',
          version: 'v-b1',
          bankAccount: 'Main',
          postedOn: '2026-11-03',
          reference: 'TRF 1',
          amount: 100,
          currency: 'USD',
          status: 'Unmatched',
          allocations: []
        },
        {
          id: 'b2',
          version: 'v-b2',
          bankAccount: 'Main',
          postedOn: '2026-11-04',
          reference: 'FEE',
          amount: -12,
          currency: 'USD',
          status: 'Matched',
          allocations: [{ kind: 'Fee', amount: -12 }]
        }
      ]);
    if (p === 'finance/bank/reconciliations') return json(200, []);
    if (p === 'office-ledger/entries')
      return json(200, [
        {
          id: 'o1',
          version: 'v-o1',
          kind: 'Allowance',
          occurredOn: '2026-10-05',
          amount: 200,
          currency: 'USD',
          description: 'October allowance',
          financeReference: 'TR-1',
          status: 'Active',
          monthClosed: false
        },
        {
          id: 'o2',
          version: 'v-o2',
          kind: 'Purchase',
          occurredOn: '2026-11-03',
          amount: 30,
          currency: 'USD',
          description: 'Paper',
          supplier: 'Shop',
          missingEvidenceReason: 'Lost',
          status: 'Active',
          monthClosed: false
        }
      ]);
    if (p === 'office-ledger/balances')
      return json(200, {
        period: '2026-11',
        totals: { USD: { opening: 1200, in: 0, out: 30, closing: 1170 } },
        negativeCurrencies: []
      });
    if (p === `finance/sessions/${S1}`) return json(200, store.session);
  }
  if (method === 'POST' || method === 'PUT') return json(200, { id: 'new', status: 'Verified', ...body });
});

const { session } = await import('../../src/portal/model/api.js');
signedIn(session, { roles: ['priest'] });
localStorage_set(S1);
const D = await import('../../src/portal/model/data.js');
const { hydrate, persist } = await import('../../src/portal/model/persist.js');
const F = await import('../../src/portal/model/modules/finance.js');

function localStorage_set(id) {
  const mem = new Map([['pl-finance-session:P', id]]);
  globalThis.localStorage = {
    getItem: k => mem.get(k) ?? null,
    setItem: (k, v) => mem.set(k, v),
    removeItem: k => mem.delete(k)
  };
}

await hydrate();
// funds carry per-currency balances; no budget and no rate are invented
assert.equal(D.FUNDS[0].balances.length, 2);
assert.equal(D.FUNDS[0].budget, 0);
assert.equal(D.RATE.value, 0);
assert.deepEqual(D.RECURRING, []);
assert.deepEqual(D.RECEIPTS, []);
// the counting session: amounts stay in their own currency
assert.equal(D.BATCH.id, S1);
assert.equal(D.BATCH.status, 'open');
assert.deepEqual(
  D.BATCH.lines.map(l => [l.env, l.amount, l.currency, l.usd, l.lbp]),
  [
    ['0142', 50, 'USD', 50, undefined],
    [null, 4500000, 'LBP', undefined, 4500000]
  ]
);
// expenses, pledges, gifts, campaigns, bank
assert.deepEqual(
  D.EXPENSES.map(x => [x.id, x.status, x.amount, x.currency]),
  [['x1', 'awaiting-approval', 180, 'USD']]
);
assert.equal(D.PLEDGES[0].paid, 150);
assert.equal(D.CONTRIBUTIONS.length, 2);
assert.deepEqual(D.CAMPAIGNS[0].targets, { USD: 1000 });
assert.deepEqual(
  D.BANKLINES.map(b => [b.id, b.matched]),
  [
    ['b2', true],
    ['b1', false]
  ]
    .reverse()
    .reverse()
);
// the dollar series and mix come from posted dollar gifts only
assert.equal(D.GIVING_SERIES.at(-1), 100);
assert.ok(D.PAYMENT_MIX.every(m => m.v > 0));
// the office opening is worked out from the month's balances: 1200 - 200 (October allowance)
assert.equal(D.OFFICE_LEDGER.find(r => r.kind === 'opening').amount, 1000);
assert.deepEqual(
  D.OFFICE_LEDGER.filter(r => r.kind !== 'opening').map(r => [r.id, r.kind, r.effect]),
  [
    ['o1', 'allowance', 200],
    ['o2', 'expense', -30]
  ]
);

// a new fund and an expense go to their routes, with operation ids
D.FUNDS.push({ id: 'draft-f', name: 'Charity', purpose: 'Food parcels', restricted: true, balances: [] });
assert.equal(await persist(), true);
let [method, path, body] = sent.find(s => s[1] === 'parishes/P/finance/funds');
assert.equal(method, 'POST');
assert.match(body.operationId, /^[0-9a-f-]{36}$/);
assert.deepEqual([body.name, body.purpose, body.restricted], ['Charity', 'Food parcels', true]);

D.EXPENSES.unshift({
  id: 'draft-x',
  what: 'Candles',
  payee: 'Wax Ltd',
  amount: 40,
  currency: 'USD',
  fund: F1,
  d: '2026-11-10',
  evidence: '',
  missingEvidence: 'No receipt given'
});
assert.equal(await persist(), true);
[, , body] = sent.find(s => s[1] === 'parishes/P/finance/expenses');
assert.deepEqual(
  [body.description, body.fundId, body.amount, body.evidenceReference, body.missingEvidenceReason],
  ['Candles', F1, 40, null, 'No receipt given']
);

// counting-session lines are replaced with the session version
D.BATCH.lines.push({
  key: 'l3',
  env: '0200',
  p: null,
  fund: F1,
  amount: 25,
  currency: 'USD',
  method: 'Cash',
  anonymous: false,
  usd: 25
});
assert.equal(await persist(), true);
[method, path, body] = sent.findLast(s => s[1].endsWith('/lines'));
assert.equal(`${method} ${path}`, `PUT parishes/P/finance/sessions/${S1}/lines`);
assert.equal(body.version, 'v-s1');
assert.deepEqual(
  body.lines.map(l => [l.key, l.amount, l.currency, l.envelopeId]),
  [
    ['l1', 50, 'USD', '0142'],
    ['l2', 4500000, 'LBP', null],
    ['l3', 25, 'USD', '0200']
  ]
);

// an office purchase and an allowance
D.OFFICE_LEDGER.push({
  id: 'office-n',
  kind: 'expense',
  date: '2026-11-05',
  currency: 'USD',
  amount: 12,
  description: 'Stamps',
  payee: 'Post',
  reference: 'R-1',
  notes: ''
});
assert.equal(await persist(), true);
[, , body] = sent.find(s => s[1] === 'parishes/P/office-ledger/entries');
assert.deepEqual(
  [body.kind, body.supplier, body.evidenceReference, body.financeReference],
  ['Purchase', 'Post', 'R-1', null]
);

// what the API cannot hold is undone and reported, never left looking saved
const writes = sent.length;
D.RATE.value = 89500;
assert.equal(await persist(), false);
assert.equal(D.RATE.value, 0);
D.RECURRING.push({ p: P1, amount: 5 });
assert.equal(await persist(), false);
assert.deepEqual(D.RECURRING, []);
D.FUNDS[0].name = 'Renamed';
assert.equal(await persist(), false);
assert.equal(D.FUNDS[0].name, 'General fund');
assert.equal(sent.length, writes, 'nothing was sent for unsupported changes');

// workflow calls
const parish = session.parishes[0];
await F.verifySession(parish, D.BATCH, [{ currency: 'USD', method: 'Cash', amount: 75 }], '');
[, path, body] = sent.at(-1);
assert.equal(path, `parishes/P/finance/sessions/${S1}/verify`);
assert.equal(body.revision, 1);
await F.expenseAction(
  parish,
  D.EXPENSES.find(x => x.id === 'x1'),
  'approve'
);
[, path, body] = sent.at(-1);
assert.deepEqual([path, body.action, body.version], ['parishes/P/finance/expenses/x1/actions', 'approve', 'v-x1']);
await F.bankLineAction(
  parish,
  D.BANKLINES.find(b => b.id === 'b1'),
  'match',
  { allocations: [{ kind: 'Contribution', recordId: 'g1', amount: 100 }] }
);
[, path, body] = sent.at(-1);
assert.deepEqual([path, body.action, body.version], ['parishes/P/finance/bank/lines/b1/actions', 'match', 'v-b1']);
console.log('finance: ok');
