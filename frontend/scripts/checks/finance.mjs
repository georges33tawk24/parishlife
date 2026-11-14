/* Purpose: checks the Finance module against a stand-in for ParishLife.Api's finance routes: what load
   fills (funds with Arabic twins, per-currency balances and budgets, gifts, expenses, bank lines, the
   office ledger and its recorded openings, the counting sessions, recorded exchange rates, recurring
   gifts, numbered receipts, people's names for actor ids), what save sends (a new fund, fund and campaign
   name corrections, expense, pledge, session lines, office entries with category), what is refused as
   unsupported (changing a recorded rate, a recurring gift or a fund's restriction through the diff), and
   the workflow calls (verify, expense decisions, bank match, record a rate, set a budget, recurring gifts,
   issue and void a receipt). Run with `npm run check`. */
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
      countedBy: ['a1'],
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
        {
          id: F1,
          version: 'v-f1',
          name: 'General fund',
          nameAr: 'الصندوق العام',
          purpose: 'Running costs',
          purposeAr: null,
          restricted: false,
          status: 'Active'
        }
      ]);
    if (p === 'finance/exchange-rates')
      return json(200, [
        {
          id: 'r2',
          baseCurrency: 'USD',
          quoteCurrency: 'LBP',
          rate: 89700,
          effectiveOn: '2026-11-02',
          source: 'Bank board',
          recordedBy: 'a2',
          recordedAt: '2026-11-02T08:00:00Z'
        },
        {
          id: 'r1',
          baseCurrency: 'USD',
          quoteCurrency: 'LBP',
          rate: 89500,
          effectiveOn: '2026-11-01',
          source: 'Bank board',
          recordedBy: 'a2',
          recordedAt: '2026-11-01T08:00:00Z'
        }
      ]);
    if (p === 'finance/budgets')
      return json(200, [
        {
          id: 'b-usd',
          version: 'v-bu',
          fundId: F1,
          year: new Date().getFullYear(),
          currency: 'USD',
          amount: 1000,
          spent: 180,
          remaining: 820,
          setBy: 'a2'
        }
      ]);
    if (p === 'finance/recurring-gifts')
      return json(200, [
        {
          id: 'rg1',
          version: 'v-rg1',
          personId: P1,
          fundId: F1,
          amount: 50,
          currency: 'USD',
          frequency: 'Monthly',
          method: 'Bank',
          startsOn: '2026-10-15',
          endsOn: null,
          nextExpectedOn: '2026-11-15',
          status: 'Active'
        }
      ]);
    if (p === 'finance/receipts')
      return json(200, [
        {
          id: 'rc1',
          version: 'v-rc1',
          number: 1,
          contributionId: 'g1',
          personId: P1,
          fundId: F1,
          amount: 100,
          currency: 'USD',
          receivedOn: '2026-11-01',
          status: 'Issued',
          giftStatus: 'Posted',
          issuedBy: 'a3'
        }
      ]);
    if (p === 'finance/sessions')
      return json(200, [{ value: { ...store.session.value, countedBy: ['a1'] }, version: 'v-s1' }]);
    if (p === 'office-ledger/openings')
      return json(200, [
        { currency: 'USD', amount: 1000, effectiveOn: '2026-10-01', provenance: 'Cash count', enteredBy: 'a2' }
      ]);
    if (p.startsWith('account-names'))
      return json(200, [
        { accountId: 'a1', displayName: 'First Counter' },
        { accountId: 'a2', displayName: 'Treasurer' }
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
localStorage_set('');
const D = await import('../../src/portal/model/data.js');
const { hydrate, persist } = await import('../../src/portal/model/persist.js');
const F = await import('../../src/portal/model/modules/finance.js');
const { nameOf } = await import('../../src/portal/model/names.js');

function localStorage_set(id) {
  const mem = new Map([['pl-finance-session:P', id]]);
  globalThis.localStorage = {
    getItem: k => mem.get(k) ?? null,
    setItem: (k, v) => mem.set(k, v),
    removeItem: k => mem.delete(k)
  };
}

await hydrate();
// funds carry Arabic twins, per-currency balances and this year's budgets
assert.equal(D.FUNDS[0].balances.length, 2);
assert.deepEqual([D.FUNDS[0].ar, D.FUNDS[0].nameAr, D.FUNDS[0].purposeAr], ['الصندوق العام', 'الصندوق العام', '']);
assert.deepEqual([D.FUNDS[0].budget, D.FUNDS[0].actual, D.FUNDS[0].budgets.length], [1000, 180, 1]);
// the rate is the latest one the office recorded, with its date and source; nothing is converted
assert.deepEqual(
  [D.RATE.value, new Date(D.RATE.setOn).toISOString().slice(0, 10), D.RATE.source],
  [89700, '2026-11-02', 'Bank board']
);
assert.equal(D.RATES.length, 2);
assert.deepEqual(
  D.RECURRING.map(r => [r.id, r.p, r.amount, r.frequency, r.next, r.status]),
  [['rg1', P1, 50, 'Monthly', '2026-11-15', 'Active']]
);
assert.deepEqual(
  D.RECEIPTS.map(r => [r.no, r.contribution, r.status]),
  [[1, 'g1', 'Issued']]
);
// with nothing remembered, the newest open session is brought into view; counters are named
assert.equal(D.COUNT_SESSIONS.length, 1);
assert.deepEqual(D.BATCH.counters, ['a1']);
assert.equal(nameOf('P', 'a1'), 'First Counter');
assert.equal(nameOf('P', 'a2'), 'Treasurer');
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
// the office opening comes from the recorded openings, with its provenance
assert.deepEqual(
  ['amount', 'notes', 'effectiveOn'].map(k => D.OFFICE_LEDGER.find(r => r.kind === 'opening')[k]),
  [1000, 'Cash count', '2026-10-01']
);
assert.deepEqual(
  D.OFFICE_LEDGER.filter(r => r.kind !== 'opening').map(r => [r.id, r.kind, r.effect]),
  [
    ['o1', 'allowance', 200],
    ['o2', 'expense', -30]
  ]
);

// a new fund and an expense go to their routes, with operation ids
D.FUNDS.push({
  id: 'draft-f',
  name: 'Charity',
  nameAr: 'المحبة',
  purpose: 'Food parcels',
  purposeAr: '',
  restricted: true,
  balances: []
});
assert.equal(await persist(), true);
let [method, path, body] = sent.find(s => s[1] === 'parishes/P/finance/funds');
assert.equal(method, 'POST');
assert.match(body.operationId, /^[0-9a-f-]{36}$/);
assert.deepEqual(
  [body.name, body.nameAr, body.purpose, body.purposeAr, body.restricted],
  ['Charity', 'المحبة', 'Food parcels', null, true]
);

// a fund's names are corrected with its version; each language is sent as typed
D.FUNDS[0].nameAr = 'صندوق الرعية';
assert.equal(await persist(), true);
[method, path, body] = sent.find(s => s[1] === `parishes/P/finance/funds/${F1}`);
assert.deepEqual([method, body.version, body.name, body.nameAr], ['PUT', 'v-f1', 'General fund', 'صندوق الرعية']);

// a campaign is corrected with its version
D.CAMPAIGNS[0].nameAr = 'السقف';
assert.equal(await persist(), true);
[method, path, body] = sent.find(s => s[1] === 'parishes/P/finance/campaigns/c1');
assert.deepEqual([method, body.nameAr, body.fundId], ['PUT', 'السقف', F1]);

D.EXPENSES.unshift({
  id: 'draft-x',
  what: 'Candles',
  payee: 'Wax Ltd',
  amount: 40,
  currency: 'USD',
  fund: F1,
  d: '2026-11-10',
  descriptionAr: 'شموع',
  evidence: '',
  missingEvidence: 'No receipt given'
});
assert.equal(await persist(), true);
[, , body] = sent.find(s => s[1] === 'parishes/P/finance/expenses');
assert.deepEqual(
  [body.description, body.descriptionAr, body.fundId, body.amount, body.evidenceReference, body.missingEvidenceReason],
  ['Candles', 'شموع', F1, 40, null, 'No receipt given']
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
  descriptionAr: 'طوابع',
  category: 'Postage',
  payee: 'Post',
  reference: 'R-1',
  notes: ''
});
assert.equal(await persist(), true);
[, , body] = sent.find(s => s[1] === 'parishes/P/office-ledger/entries');
assert.deepEqual(
  [body.kind, body.supplier, body.evidenceReference, body.financeReference, body.descriptionAr, body.category],
  ['Purchase', 'Post', 'R-1', null, 'طوابع', 'Postage']
);

// what the API cannot hold is undone and reported, never left looking saved
const writes = sent.length;
D.RATE.value = 1;
assert.equal(await persist(), false);
assert.equal(D.RATE.value, 89700);
D.RECURRING.push({ p: P1, amount: 5 });
assert.equal(await persist(), false);
assert.equal(D.RECURRING.length, 1);
D.FUNDS[0].restricted = true;
assert.equal(await persist(), false);
assert.equal(D.FUNDS[0].restricted, false);
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

// a rate is recorded as typed with its date and source; a budget, recurring gift and receipt use their routes
await F.recordRate(parish, {
  base: 'USD',
  quote: 'LBP',
  rate: '89600',
  on: '2026-11-03',
  source: 'Bank board',
  note: ''
});
[method, path, body] = sent.at(-1);
assert.deepEqual(
  [method, path, body.baseCurrency, body.quoteCurrency, body.rate, body.effectiveOn, body.source, body.note],
  ['POST', 'parishes/P/finance/exchange-rates', 'USD', 'LBP', 89600, '2026-11-03', 'Bank board', null]
);
await F.saveBudget(parish, { fund: F1, year: '2026', currency: 'USD', amount: '1200' }, D.BUDGETS[0]);
[method, path, body] = sent.at(-1);
assert.deepEqual(
  [method, path, body.version, body.year, body.amount],
  ['PUT', 'parishes/P/finance/budgets', 'v-bu', 2026, 1200]
);
await F.saveRecurring(parish, { ...D.RECURRING[0], amount: '60' }, D.RECURRING[0]);
[method, path, body] = sent.at(-1);
assert.deepEqual(
  [method, path, body.version, body.amount, body.frequency, body.personId],
  ['PUT', 'parishes/P/finance/recurring-gifts/rg1', 'v-rg1', 60, 'Monthly', P1]
);
await F.recurringAction(parish, D.RECURRING[0], 'end', 'Moved away');
[, path, body] = sent.at(-1);
assert.deepEqual(
  [path, body.action, body.reason],
  ['parishes/P/finance/recurring-gifts/rg1/actions', 'end', 'Moved away']
);
await F.issueReceipt(parish, 'g1');
[method, path, body] = sent.at(-1);
assert.deepEqual([method, path, body.contributionId], ['POST', 'parishes/P/finance/receipts', 'g1']);
await F.voidReceipt(parish, D.RECEIPTS[0], 'Gift reversed');
[, path, body] = sent.at(-1);
assert.deepEqual([path, body.version, body.reason], ['parishes/P/finance/receipts/rc1/void', 'v-rc1', 'Gift reversed']);
console.log('finance: ok');
