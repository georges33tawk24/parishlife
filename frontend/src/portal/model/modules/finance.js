/* Purpose: the Finance module's connection to ParishLife.Api: giving (counting sessions, posted gifts,
   pledges, campaigns), funds and balances, expenses, the office cash ledger and bank reconciliation.
   Main members: keys (the view-model collections this module owns), routes (the pages it feeds), load (fills
   them from the API), save (sends what changed), and the helpers the money screens call for the
   workflows a plain diff cannot express (counting-session steps, expense decisions, bank matching,
   office months, rates, budgets, recurring gifts, receipts): openSession, verifySession, postSession,
   expenseAction, recordRate, saveBudget, saveRecurring, issueReceipt, voidReceipt, and so on.

   The API keeps every amount in the currency it was given in and never converts. An exchange rate is
   what the parish office recorded, with its date and source (RATE is the latest USD→LBP one, RATES all
   of them); it is shown for reference and never used to convert or add amounts. A recurring gift is a
   stored schedule: nothing is charged. A receipt carries the parish's sequential number. Finance needs
   the priest or a grant with finance.read; each action also needs its own capability (finance.enter,
   finance.post, finance.approve), which the API checks. A 403 leaves a collection empty. Actor ids are
   shown as names through model/names.js. */
import { api, newOperationId } from '../api.js';
import { loadNames } from '../names.js';

export const keys = [
  'RATE',
  'RATES',
  'BUDGETS',
  'SESSIONS',
  'BATCH',
  'FUNDS',
  'EXPENSES',
  'PLEDGES',
  'CAMPAIGNS',
  'RECURRING',
  'RECEIPTS',
  'BANKLINES',
  'GIVING_SERIES',
  'PAYMENT_MIX',
  'OFFICE_LEDGER',
  'CONTRIBUTIONS'
];
export const routes = ['giving', 'finance', 'officeexpenses'];

const base = parish => `parishes/${encodeURIComponent(parish.id)}`;
const fin = (parish, path) => `${base(parish)}/finance/${path}`;
const canRead = parish =>
  !!parish && (parish.roles?.includes('priest') || parish.capabilities?.includes('finance.read'));
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const encode = encodeURIComponent;

/* The counting session in view: the one last chosen in this browser (a convenience only), otherwise the
   newest session that is still open, has a variance or awaits posting (GET finance/sessions). */
const memory = parish => `pl-finance-session:${parish.id}`;
export const rememberedSession = parish => {
  try {
    return localStorage.getItem(memory(parish)) || '';
  } catch {
    return '';
  }
};
export const rememberSession = (parish, id) => {
  try {
    if (id) localStorage.setItem(memory(parish), id);
    else localStorage.removeItem(memory(parish));
  } catch {
    /* private mode: the session is simply not remembered */
  }
};

export const emptyBatch = () => ({
  id: '',
  ref: '',
  refAr: '',
  source: '',
  date: '',
  status: '',
  apiStatus: '',
  version: '',
  revision: 0,
  counters: [],
  lines: [],
  totals: [],
  verifiedBy: null,
  variance: [],
  varianceNote: null,
  postedBy: null,
  postedAt: null
});

/* ---------- API → view model ---------- */
export const SESSION_STATUS = { Open: 'open', Verified: 'verified', Variance: 'variance', Posted: 'closed' };
export const EXPENSE_STATUS = {
  Draft: 'draft',
  Submitted: 'awaiting-approval',
  Returned: 'returned',
  Approved: 'approved',
  Paid: 'paid',
  Rejected: 'rejected',
  Cancelled: 'cancelled'
};

/* A counted line: the amount in the currency it was counted in (never converted); usd and lbp are kept
   for the screens that total dollars and lira apart. */
export const toLine = l => ({
  key: l.key,
  env: l.envelopeId || null,
  p: l.personId || null,
  hh: l.householdId || null,
  fund: l.fundId,
  campaign: l.campaignId || null,
  amount: l.amount,
  currency: l.currency,
  method: l.method,
  anonymous: !!l.anonymous,
  unattributed: !!l.unattributed,
  ref: l.reference || '',
  ...(l.currency === 'USD' ? { usd: l.amount } : {}),
  ...(l.currency === 'LBP' ? { lbp: l.amount } : {})
});
export const toBatch = (versioned, id) => {
  const s = versioned.value;
  return {
    ...emptyBatch(),
    id: s.id || id,
    ref: s.reference,
    refAr: s.reference,
    source: s.source,
    date: s.collectedOn,
    status: SESSION_STATUS[s.status] || String(s.status || '').toLowerCase(),
    apiStatus: s.status,
    version: versioned.version,
    revision: s.revision,
    counters: s.countedBy || [],
    lines: (s.lines || []).map(toLine),
    totals: s.totals || [],
    verifiedBy: s.verifiedBy || null,
    variance: s.varianceObserved || [],
    varianceNote: s.varianceNote || null,
    postedBy: s.postedBy || null,
    postedAt: s.postedAt || null
  };
};

/* GiftLineDto from a counted line: the amount and currency as counted. */
export const toGiftLine = l => ({
  key: l.key || 'l' + crypto.randomUUID().replaceAll('-', ''),
  amount: Number(l.amount ?? l.usd ?? l.lbp),
  currency: l.currency || (l.lbp != null && l.usd == null ? 'LBP' : 'USD'),
  method: l.method || 'Cash',
  fundId: l.fund,
  campaignId: l.campaign || null,
  personId: l.anonymous ? null : l.p || null,
  envelopeId: l.anonymous ? null : l.env || null,
  anonymous: !!l.anonymous,
  reference: l.ref || null
});

/* A fund: nameAr/purposeAr are the Arabic twins as typed (empty when none); ar is for display only and
   falls back to the English name. budget/actual are this year's dollar budget and dollars paid, for the
   screens that show one figure; budgets lists every currency's budget for this year. */
const toFund = (f, balances, budgets = []) => {
  const mine = balances.filter(b => b.fundId === f.id).map(b => ({ ...b, fundId: undefined }));
  const year = new Date().getFullYear();
  const thisYear = budgets.filter(b => b.fund === f.id && b.year === year);
  return {
    id: f.id,
    version: f.version || '',
    name: f.name,
    ar: f.nameAr || f.name,
    nameAr: f.nameAr || '',
    purpose: f.purpose,
    purposeAr: f.purposeAr || '',
    restricted: !!f.restricted,
    status: f.status,
    budget: thisYear.find(b => b.currency === 'USD')?.amount || 0,
    actual: thisYear.find(b => b.currency === 'USD')?.spent || 0,
    budgets: thisYear,
    balances: mine
  };
};
const toExpense = ({ value: x, version }) => ({
  id: x.id,
  version,
  d: x.incurredOn,
  what: x.description,
  whatAr: x.descriptionAr || x.description, // display only
  descriptionAr: x.descriptionAr || '',
  fund: x.fundId,
  payee: x.payee,
  amount: x.amount,
  currency: x.currency,
  ...(x.currency === 'USD' ? { usd: x.amount } : {}),
  status: EXPENSE_STATUS[x.status] || String(x.status || '').toLowerCase(),
  apiStatus: x.status,
  evidence: x.evidenceReference || '',
  missingEvidence: x.missingEvidenceReason || '',
  missingEvidenceApproved: !!x.missingEvidenceApproved,
  reason: x.reason || '',
  by: null, // an account id, shown through nameOf(createdBy)
  createdBy: x.createdBy,
  submittedBy: x.submittedBy || null,
  approvedBy: x.approvedBy || null,
  paidOn: x.paidOn || '',
  paymentReference: x.paymentReference || ''
});
const toPledge = x => ({
  id: x.id,
  p: x.personId || null,
  hh: x.householdId || null,
  fund: x.fundId,
  campaign: x.campaignId || null,
  currency: x.currency,
  pledged: x.amount,
  paid: x.allocated,
  schedule: x.schedule || '',
  starts: x.startsOn,
  ends: x.endsOn || '',
  status: x.status
});
const toCampaign = x => ({
  id: x.id,
  version: x.version || '',
  name: x.name,
  ar: x.nameAr || x.name, // display only
  nameAr: x.nameAr || '',
  purpose: x.purpose,
  purposeAr: x.purposeAr || '',
  fund: x.fundId,
  starts: x.startsOn,
  ends: x.endsOn || '',
  status: x.status,
  targets: x.targets || {},
  received: x.received || {},
  pledged: x.pledged || {}
});
const toContribution = ({ value: c, version }) => ({
  id: c.id,
  version,
  session: c.sessionId || null,
  amount: c.amount,
  currency: c.currency,
  method: c.method,
  fund: c.fundId,
  campaign: c.campaignId || null,
  p: c.personId || null,
  hh: c.householdId || null,
  anonymous: !!c.anonymous,
  date: c.receivedOn,
  status: c.status,
  reversalOf: c.reversalOf || null,
  reclassifiedFrom: c.reclassifiedFrom || null,
  reason: c.reason || ''
});
const toBankLine = (b, closed) => ({
  id: b.id,
  version: b.version,
  account: b.bankAccount,
  at: b.postedOn,
  ref: b.reference,
  amount: b.amount,
  currency: b.currency,
  status: b.status,
  matched: b.status === 'Matched',
  allocations: b.allocations || [],
  outstandingReason: b.outstandingReason || '',
  reconciled: closed.has(`${b.bankAccount}:${b.postedOn.slice(0, 7)}`)
});

/* The office ledger's effect on its balance: allowances add, purchases subtract, and a reversal undoes
   the entry it names. */
const officeEffect = (e, byId) =>
  e.kind === 'Allowance'
    ? e.amount
    : e.kind === 'Purchase'
      ? -e.amount
      : byId.has(e.reversalOf)
        ? -officeEffect(byId.get(e.reversalOf), byId)
        : 0;
const OFFICE_KIND = { Allowance: 'allowance', Purchase: 'expense', Reversal: 'reversal' };
function toOffice(entries, balances, openings) {
  const active = entries.filter(e => e.status === 'Active');
  const byId = new Map(entries.map(e => [e.id, e]));
  const rows = entries.map(e => ({
    id: e.id,
    version: e.version,
    kind: OFFICE_KIND[e.kind] || String(e.kind).toLowerCase(),
    date: e.occurredOn,
    currency: e.currency,
    amount: e.amount,
    effect: e.status === 'Active' ? officeEffect(e, byId) : 0,
    description: e.description,
    descriptionAr: e.descriptionAr || '',
    category: e.category || '',
    payee: e.supplier || '',
    reference: e.evidenceReference || e.financeReference || '',
    notes: e.missingEvidenceReason || '',
    reversalOf: e.reversalOf || null,
    status: e.status,
    deleteReason: e.deleteReason || '',
    monthClosed: !!e.monthClosed
  }));
  /* The recorded openings (GET office-ledger/openings) with their provenance. An opening row has no
     date, so it counts toward every month. When the openings route is refused, the opening is derived
     from the current month's balances less everything dated before the month. */
  if (openings) {
    for (const o of openings)
      rows.push({
        id: `opening-${o.currency}`,
        kind: 'opening',
        date: '',
        effectiveOn: o.effectiveOn,
        currency: o.currency,
        amount: o.amount,
        effect: o.amount,
        description: '',
        category: '',
        payee: '',
        reference: '',
        notes: o.provenance || '',
        enteredBy: o.enteredBy || null,
        monthClosed: false
      });
    return rows;
  }
  const period = balances?.period || '';
  for (const [currency, total] of Object.entries(balances?.totals || {})) {
    const before = active
      .filter(e => e.currency === currency && e.occurredOn.slice(0, 7) < period)
      .reduce((sum, e) => sum + officeEffect(e, byId), 0);
    rows.push({
      id: `opening-${currency}`,
      kind: 'opening',
      date: '',
      currency,
      amount: total.opening - before,
      effect: total.opening - before,
      description: '',
      category: '',
      payee: '',
      reference: '',
      notes: '',
      monthClosed: false
    });
  }
  return rows;
}

/* Derived from the posted gifts only: dollars given per month over the last twelve months, and the share
   of dollars by method. Lira and other currencies are not added into them. */
function givingSeries(contributions, now = new Date()) {
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1));
    return d.toISOString().slice(0, 7);
  });
  const usd = contributions.filter(c => c.currency === 'USD');
  return months.map(
    m => Math.round(usd.filter(c => (c.date || '').slice(0, 7) === m).reduce((sum, c) => sum + c.amount, 0) * 100) / 100
  );
}
const METHODS = {
  Cash: ['Cash', 'نقداً', '#233B32'],
  Bank: ['Bank transfer', 'تحويل مصرفي', '#9BAC9F'],
  Cheque: ['Cheque', 'شيك', '#C9D3C7'],
  Card: ['Card', 'بطاقة', '#EDF0E8'],
  Other: ['Other', 'أخرى', '#6B7F73']
};
function paymentMix(contributions) {
  const usd = contributions.filter(c => c.currency === 'USD' && c.status !== 'Reversed');
  const total = usd.reduce((sum, c) => sum + c.amount, 0);
  if (total <= 0) return [];
  return Object.entries(METHODS)
    .map(([method, [label, labelAr, color]]) => ({
      label,
      labelAr,
      color,
      v: Math.round((usd.filter(c => c.method === method).reduce((sum, c) => sum + c.amount, 0) / total) * 100)
    }))
    .filter(x => x.v > 0);
}

/* ---------- the office's own records: rates, budgets, recurring gifts, receipts, sessions ---------- */
const toRate = r => ({
  id: r.id,
  base: r.baseCurrency,
  quote: r.quoteCurrency,
  rate: r.rate,
  on: r.effectiveOn,
  source: r.source,
  note: r.note || '',
  recordedBy: r.recordedBy,
  recordedAt: r.recordedAt
});
const toBudget = b => ({
  id: b.id,
  version: b.version,
  fund: b.fundId,
  year: b.year,
  currency: b.currency,
  amount: b.amount,
  spent: b.spent,
  remaining: b.remaining,
  note: b.note || '',
  setBy: b.setBy,
  setAt: b.setAt
});
export const RECURRING_STATUS = { Active: 'active', Paused: 'paused', Ended: 'ended' };
const toRecurring = r => ({
  id: r.id,
  version: r.version,
  p: r.personId || null,
  hh: r.householdId || null,
  fund: r.fundId,
  amount: r.amount,
  currency: r.currency,
  frequency: r.frequency,
  method: r.method,
  starts: r.startsOn,
  ends: r.endsOn || '',
  next: r.nextExpectedOn || '', // an expected date only, never a charge
  note: r.note || '',
  status: r.status,
  reason: r.reason || ''
});
const toReceipt = r => ({
  id: r.id,
  version: r.version,
  no: r.number,
  contribution: r.contributionId,
  p: r.personId || null,
  hh: r.householdId || null,
  fund: r.fundId,
  amount: r.amount,
  currency: r.currency,
  date: r.receivedOn,
  status: r.status,
  giftStatus: r.giftStatus || '',
  voidReason: r.voidReason || '',
  issuedBy: r.issuedBy,
  issuedAt: r.issuedAt
});
const toSession = ({ value: s }) => ({
  id: s.id,
  ref: s.reference,
  source: s.source,
  date: s.collectedOn,
  status: SESSION_STATUS[s.status] || String(s.status || '').toLowerCase(),
  apiStatus: s.status,
  countedBy: s.countedBy || []
});
/* The latest recorded dollar-to-lira rate, for the screens that show one rate; value 0 when none. */
const latestRate = rates => {
  const r = rates.find(x => x.base === 'USD' && x.quote === 'LBP');
  return r
    ? { value: r.rate, setOn: r.on, setBy: r.recordedBy, source: r.source, id: r.id }
    : { value: 0, setOn: null, setBy: '', source: '', id: '' };
};

/* ---------- load ---------- */
export async function load(parish, d) {
  d.RATE = latestRate([]);
  d.RATES = [];
  d.BUDGETS = [];
  d.SESSIONS = [];
  d.BATCH = emptyBatch();
  d.RECURRING = [];
  d.RECEIPTS = [];
  if (!canRead(parish)) return;
  /* a 403 means this account may not read that part: leave it empty */
  const get = async path => {
    try {
      return await api(path);
    } catch (e) {
      if (e.status === 403) return null;
      throw e;
    }
  };
  const [
    funds,
    balances,
    campaigns,
    pledges,
    gifts,
    expenses,
    lines,
    reconciliations,
    entries,
    office,
    openings,
    rates,
    budgets,
    recurring,
    receipts,
    sessions
  ] = await Promise.all([
    get(fin(parish, 'funds')),
    get(fin(parish, 'balances')),
    get(fin(parish, 'campaigns')),
    get(fin(parish, 'pledges')),
    get(fin(parish, 'contributions')),
    get(fin(parish, 'expenses')),
    get(fin(parish, 'bank/lines')),
    get(fin(parish, 'bank/reconciliations')),
    get(`${base(parish)}/office-ledger/entries`),
    get(`${base(parish)}/office-ledger/balances`),
    get(`${base(parish)}/office-ledger/openings`),
    get(fin(parish, 'exchange-rates')),
    get(fin(parish, 'budgets')),
    get(fin(parish, 'recurring-gifts')),
    get(fin(parish, 'receipts')),
    get(fin(parish, 'sessions'))
  ]);
  d.RATES = (rates || []).map(toRate);
  d.RATE = latestRate(d.RATES);
  d.BUDGETS = (budgets || []).map(toBudget);
  d.FUNDS = (funds || []).map(f => toFund(f, balances || [], d.BUDGETS));
  d.CAMPAIGNS = (campaigns || []).map(toCampaign);
  d.PLEDGES = (pledges || []).map(toPledge);
  d.CONTRIBUTIONS = (gifts || []).map(toContribution).sort((a, b) => b.date.localeCompare(a.date));
  d.EXPENSES = (expenses || []).map(toExpense);
  d.RECURRING = (recurring || []).map(toRecurring);
  d.RECEIPTS = (receipts || []).map(toReceipt);
  d.SESSIONS = (sessions || []).map(toSession);
  const closed = new Set(
    (reconciliations || []).filter(r => r.status === 'Closed').map(r => `${r.bankAccount}:${r.period}`)
  );
  d.BANKLINES = (lines || []).map(b => toBankLine(b, closed)).sort((a, b) => b.at.localeCompare(a.at));
  d.OFFICE_LEDGER = toOffice(entries || [], office ? { period: office.period, totals: office.totals } : null, openings);
  d.GIVING_SERIES = givingSeries(d.CONTRIBUTIONS);
  d.PAYMENT_MIX = paymentMix(d.CONTRIBUTIONS);
  const remembered = rememberedSession(parish);
  const working = d.SESSIONS.find(s => ['Open', 'Variance', 'Verified'].includes(s.apiStatus));
  const id = remembered || working?.id || '';
  if (id) {
    try {
      d.BATCH = toBatch(await api(fin(parish, `sessions/${encode(id)}`)), id);
    } catch (e) {
      if (e.status === 404 || e.status === 403)
        rememberSession(parish, ''); // not there any more, or not ours to see
      else throw e;
    }
  }
  /* people's names for the account ids these records carry */
  await loadNames(parish.id, [
    ...d.EXPENSES.flatMap(x => [x.createdBy, x.submittedBy, x.approvedBy]),
    ...d.RATES.map(r => r.recordedBy),
    ...d.BUDGETS.map(b => b.setBy),
    ...d.RECEIPTS.map(r => r.issuedBy),
    ...d.SESSIONS.flatMap(s => s.countedBy),
    ...d.BATCH.counters,
    d.BATCH.verifiedBy,
    d.BATCH.postedBy
  ]);
}

/* ---------- save: what a diff can say ---------- */
const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const byId = list => new Map((list || []).map(x => [x.id, x]));
/* the fields the API stores; derived ones (usd, totals, balances) are ignored when comparing */
const core = (x, fields) => Object.fromEntries(fields.map(f => [f, x?.[f] ?? null]));
const FIELDS = {
  fund: ['name', 'nameAr', 'purpose', 'purposeAr', 'restricted'],
  campaign: ['name', 'nameAr', 'purpose', 'purposeAr', 'fund', 'starts', 'ends', 'targets'],
  pledge: ['p', 'hh', 'fund', 'campaign', 'currency', 'pledged', 'schedule', 'starts', 'ends'],
  expense: ['what', 'descriptionAr', 'fund', 'payee', 'd', 'amount', 'currency', 'evidence', 'missingEvidence'],
  office: [
    'kind',
    'date',
    'currency',
    'amount',
    'description',
    'descriptionAr',
    'category',
    'payee',
    'reference',
    'notes'
  ]
};
/* new, changed and removed records between two snapshots of a collection */
function changes(before, now, fields) {
  const was = byId(before),
    is = byId(now);
  return {
    added: [...is.values()].filter(x => !was.has(x.id)),
    edited: [...is.values()].filter(x => was.has(x.id) && !sameJSON(core(x, fields), core(was.get(x.id), fields))),
    removed: [...was.values()].filter(x => !is.has(x.id))
  };
}

const todayDate = () => new Date().toLocaleDateString('sv-SE');
const money = (v, label) => {
  const n = Number(v);
  if (!(n > 0)) throw new Error(`${label} needs an amount above zero.`);
  return Math.round(n * 100) / 100;
};
const optional = v => (v == null || String(v).trim() === '' ? null : String(v).trim());

export async function save(before, now, parish) {
  let unsupported = false,
    saved = false;
  const post = (path, body) => api(path, 'POST', { operationId: newOperationId(), ...body });

  /* rates, budgets, recurring gifts, receipts and sessions change through their own dialogs (recordRate,
     saveBudget, saveRecurring, issueReceipt...), and posted gifts never change: read-only in a diff */
  for (const key of [
    'RATE',
    'RATES',
    'BUDGETS',
    'SESSIONS',
    'RECURRING',
    'RECEIPTS',
    'CONTRIBUTIONS',
    'BANKLINES',
    'GIVING_SERIES',
    'PAYMENT_MIX'
  ])
    if (!sameJSON(before[key], now[key])) unsupported = true;
  if (!sameJSON(before.BATCH?.status, now.BATCH?.status)) unsupported = true;

  /* a fund's names and purpose (in each language, as typed) can be corrected; its restriction never changes */
  const funds = changes(before.FUNDS, now.FUNDS, FIELDS.fund);
  if (funds.removed.length) unsupported = true;
  const fundBody = f => ({
    name: String(f.name || '').trim(),
    nameAr: optional(f.nameAr),
    purpose: String(f.purpose || '').trim(),
    purposeAr: optional(f.purposeAr),
    restricted: !!f.restricted
  });
  for (const f of funds.added) {
    await post(fin(parish, 'funds'), fundBody(f));
    saved = true;
  }
  for (const f of funds.edited) {
    const was = byId(before.FUNDS).get(f.id);
    if (!!was.restricted !== !!f.restricted) {
      unsupported = true;
      continue;
    }
    await api(fin(parish, `funds/${encode(f.id)}`), 'PUT', {
      operationId: newOperationId(),
      version: was.version,
      ...fundBody(f)
    });
    saved = true;
  }

  /* a campaign can be corrected except for its fund, which posted gifts already name */
  const campaigns = changes(before.CAMPAIGNS, now.CAMPAIGNS, FIELDS.campaign);
  if (campaigns.removed.length) unsupported = true;
  const campaignBody = c => ({
    name: String(c.name || '').trim(),
    nameAr: optional(c.nameAr),
    purpose: String(c.purpose || '').trim(),
    purposeAr: optional(c.purposeAr),
    fundId: c.fund,
    startsOn: isDate(c.starts) ? c.starts : todayDate(),
    endsOn: isDate(c.ends) ? c.ends : null,
    targets: c.targets
  });
  for (const c of campaigns.added) {
    await post(fin(parish, 'campaigns'), campaignBody(c));
    saved = true;
  }
  for (const c of campaigns.edited) {
    const was = byId(before.CAMPAIGNS).get(c.id);
    if (was.fund !== c.fund) {
      unsupported = true;
      continue;
    }
    await api(fin(parish, `campaigns/${encode(c.id)}`), 'PUT', {
      operationId: newOperationId(),
      version: was.version,
      ...campaignBody(c)
    });
    saved = true;
  }

  const pledges = changes(before.PLEDGES, now.PLEDGES, FIELDS.pledge);
  if (pledges.edited.length || pledges.removed.length) unsupported = true;
  for (const p of pledges.added) {
    await post(fin(parish, 'pledges'), {
      personId: p.p || null,
      householdId: p.hh || null,
      fundId: p.fund,
      campaignId: p.campaign || null,
      amount: money(p.pledged, 'A pledge'),
      currency: p.currency || 'USD',
      schedule: optional(p.schedule),
      startsOn: isDate(p.starts) ? p.starts : todayDate(),
      endsOn: isDate(p.ends) ? p.ends : null
    });
    saved = true;
  }

  const expenses = changes(before.EXPENSES, now.EXPENSES, FIELDS.expense);
  if (expenses.removed.length) unsupported = true; // an expense is cancelled with a reason, not deleted
  const expenseBody = x => ({
    description: String(x.what || '').trim(),
    descriptionAr: optional(x.descriptionAr),
    fundId: x.fund,
    payee: String(x.payee || '').trim(),
    incurredOn: isDate(x.d) ? x.d : todayDate(),
    amount: money(x.amount ?? x.usd, 'An expense'),
    currency: x.currency || 'USD',
    evidenceReference: optional(x.evidence),
    missingEvidenceReason: optional(x.evidence) ? null : optional(x.missingEvidence)
  });
  for (const x of expenses.added) {
    await post(fin(parish, 'expenses'), expenseBody(x));
    saved = true;
  }
  for (const x of expenses.edited) {
    const was = byId(before.EXPENSES).get(x.id);
    if (!['Draft', 'Returned'].includes(was.apiStatus)) {
      unsupported = true; // only a draft or returned expense is edited
      continue;
    }
    await api(fin(parish, `expenses/${encode(x.id)}`), 'PUT', {
      operationId: newOperationId(),
      version: was.version,
      ...expenseBody(x)
    });
    saved = true;
  }

  const office = changes(before.OFFICE_LEDGER, now.OFFICE_LEDGER, FIELDS.office);
  if (office.removed.length) unsupported = true; // removal needs a reason: officeEntryAction
  for (const e of office.added) {
    if (e.kind === 'opening') {
      await api(`${base(parish)}/office-ledger/openings`, 'POST', {
        operationId: newOperationId(),
        currency: e.currency,
        amount: Number(e.amount),
        effectiveOn: isDate(e.date) ? e.date : todayDate(),
        provenance: String(e.notes || '').trim()
      });
    } else await api(`${base(parish)}/office-ledger/entries`, 'POST', officeBody(e));
    saved = true;
  }
  for (const e of office.edited) {
    const was = byId(before.OFFICE_LEDGER).get(e.id);
    if (was.kind === 'opening' || was.kind === 'reversal' || was.monthClosed || e.kind !== was.kind) {
      unsupported = true;
      continue;
    }
    await api(`${base(parish)}/office-ledger/entries/${encode(e.id)}`, 'PUT', {
      ...officeBody(e),
      version: was.version
    });
    saved = true;
  }

  /* the open counting session's lines */
  const was = before.BATCH,
    is = now.BATCH;
  if (!sameJSON(was?.lines, is?.lines)) {
    if (!is?.id || !['Open', 'Variance'].includes(is.apiStatus) || was?.id !== is.id) unsupported = true;
    else {
      const result = await api(fin(parish, `sessions/${encode(is.id)}/lines`), 'PUT', {
        operationId: newOperationId(),
        version: is.version,
        lines: is.lines.map(toGiftLine)
      });
      saved ||= !!result;
    }
  }
  return { unsupported, saved };
}

const officeBody = e => ({
  operationId: newOperationId(),
  kind: e.kind === 'expense' ? 'Purchase' : 'Allowance',
  occurredOn: isDate(e.date) ? e.date : todayDate(),
  amount: money(e.amount, 'An entry'),
  currency: e.currency,
  description: String(e.description || '').trim(),
  descriptionAr: optional(e.descriptionAr),
  category: optional(e.category),
  supplier: e.kind === 'expense' ? optional(e.payee) : null,
  evidenceReference: e.kind === 'expense' ? optional(e.reference) : null,
  missingEvidenceReason: e.kind === 'expense' && !optional(e.reference) ? optional(e.notes) : null,
  financeReference: e.kind === 'expense' ? null : optional(e.reference)
});

/* ---------- workflows the diff cannot express: each returns the API's answer; the caller reloads ---------- */
export const sessionPath = (parish, id, tail = '') => fin(parish, `sessions/${encode(id)}${tail}`);

/* Opens a counting session for a source and date, and keeps it in view. */
export async function openSession(parish, { source, collectedOn }) {
  const session = await api(fin(parish, 'sessions'), 'POST', {
    operationId: newOperationId(),
    source: String(source || '').trim(),
    collectedOn: isDate(collectedOn) ? collectedOn : todayDate()
  });
  rememberSession(parish, session.id);
  return session;
}
/* Brings a session counted by someone else into view, by its id. */
export async function viewSession(parish, id) {
  const text = String(id || '').trim();
  const found = await api(sessionPath(parish, text)); // 404 if it is not this parish's
  rememberSession(parish, found.value.id);
  return found;
}
/* A second person's own count of the exact revision, as totals by currency and method. */
export const verifySession = (parish, batch, observed, note) =>
  api(sessionPath(parish, batch.id, '/verify'), 'POST', {
    operationId: newOperationId(),
    version: batch.version,
    revision: batch.revision,
    observed,
    note: optional(note)
  });
export const postSession = (parish, batch) =>
  api(sessionPath(parish, batch.id, '/post'), 'POST', { operationId: newOperationId(), version: batch.version });

/* A posted gift is corrected by a reversal (or a reclassification), never edited. */
export const correctContribution = (parish, gift, body) =>
  api(fin(parish, `contributions/${encode(gift.id)}/corrections`), 'POST', {
    operationId: newOperationId(),
    version: gift.version,
    ...body
  });

export const allocatePledge = (parish, pledge, contributionId, amount) =>
  api(fin(parish, `pledges/${encode(pledge.id)}/allocations`), 'POST', {
    operationId: newOperationId(),
    contributionId,
    amount: money(amount, 'An allocation')
  });

/* A year's statement for one person or household. */
export const statement = (parish, { personId, householdId, year }) =>
  api(
    fin(
      parish,
      `statements?year=${encode(year)}${personId ? `&personId=${encode(personId)}` : ''}${householdId ? `&householdId=${encode(householdId)}` : ''}`
    )
  );

/* An expense decision: submit, return, approve, reject, cancel or record-payment. */
export const expenseAction = (parish, expense, action, extra = {}) =>
  api(fin(parish, `expenses/${encode(expense.id)}/actions`), 'POST', {
    operationId: newOperationId(),
    version: expense.version,
    action,
    ...extra
  });

/* Bank statement lines pasted or chosen as CSV (Date,Reference,Amount,Currency). */
export const importBank = (parish, bankAccount, csv) =>
  api(fin(parish, 'bank/imports'), 'POST', { operationId: newOperationId(), bankAccount, csv });
export const bankLineAction = (parish, line, action, extra = {}) =>
  api(fin(parish, `bank/lines/${encode(line.id)}/actions`), 'POST', {
    operationId: newOperationId(),
    version: line.version,
    action,
    allocations: [],
    ...extra
  });
export const reconcileMonth = (parish, bankAccount, period, reopenReason) =>
  api(fin(parish, reopenReason ? 'bank/reconciliations/reopen' : 'bank/reconciliations'), 'POST', {
    operationId: newOperationId(),
    bankAccount,
    period,
    ...(reopenReason ? { reason: reopenReason } : {})
  });

/* An office entry: remove it while its month is open, reverse it once the month is closed. */
export const officeEntryAction = (parish, entry, action, reason, occurredOn) =>
  api(`${base(parish)}/office-ledger/entries/${encode(entry.id)}/actions`, 'POST', {
    operationId: newOperationId(),
    version: entry.version,
    action,
    reason,
    ...(occurredOn ? { occurredOn } : {})
  });
export const closeOfficeMonth = (parish, period) =>
  api(`${base(parish)}/office-ledger/months`, 'POST', { operationId: newOperationId(), period });

/* An exchange rate the office took from a named source for a date: recorded, never fetched or invented. */
export const recordRate = (parish, { base: baseCurrency, quote, rate, on, source, note }) =>
  api(fin(parish, 'exchange-rates'), 'POST', {
    operationId: newOperationId(),
    baseCurrency,
    quoteCurrency: quote,
    rate: Number(rate),
    effectiveOn: on,
    source: String(source || '').trim(),
    note: optional(note)
  });

/* A fund's budget for a year and currency; replacing one sends the version it was read at. */
export const saveBudget = (parish, { fund, year, currency, amount, note }, existing) =>
  api(fin(parish, 'budgets'), 'PUT', {
    operationId: newOperationId(),
    version: existing?.version || null,
    fundId: fund,
    year: Number(year),
    currency,
    amount: money(amount, 'A budget'),
    note: optional(note)
  });

/* A recurring gift is a stored schedule: saving it never charges anyone or records a gift. */
export const saveRecurring = (parish, value, existing) =>
  api(fin(parish, existing ? `recurring-gifts/${encode(existing.id)}` : 'recurring-gifts'), existing ? 'PUT' : 'POST', {
    operationId: newOperationId(),
    ...(existing ? { version: existing.version } : {}),
    personId: value.p || null,
    householdId: value.hh || null,
    fundId: value.fund,
    amount: money(value.amount, 'A recurring gift'),
    currency: value.currency || 'USD',
    frequency: value.frequency || 'Monthly',
    method: value.method || 'Cash',
    startsOn: isDate(value.starts) ? value.starts : todayDate(),
    endsOn: isDate(value.ends) ? value.ends : null,
    note: optional(value.note)
  });
export const recurringAction = (parish, gift, action, reason) =>
  api(fin(parish, `recurring-gifts/${encode(gift.id)}/actions`), 'POST', {
    operationId: newOperationId(),
    version: gift.version,
    action,
    reason: optional(reason)
  });

/* The next numbered receipt for a posted gift with a named giver; a void keeps the number. */
export const issueReceipt = (parish, contributionId) =>
  api(fin(parish, 'receipts'), 'POST', { operationId: newOperationId(), contributionId });
export const voidReceipt = (parish, receipt, reason) =>
  api(fin(parish, `receipts/${encode(receipt.id)}/void`), 'POST', {
    operationId: newOperationId(),
    version: receipt.version,
    reason: String(reason || '').trim()
  });
