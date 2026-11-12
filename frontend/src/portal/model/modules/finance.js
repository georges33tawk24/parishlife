/* Purpose: the Finance module's connection to ParishLife.Api: giving (counting sessions, posted gifts,
   pledges, campaigns), funds and balances, expenses, the office cash ledger and bank reconciliation.
   Main members: keys (the view-model collections this module owns), routes (the pages it feeds), load (fills
   them from the API), save (sends what changed), and the helpers the money screens call for the
   workflows a plain diff cannot express (counting-session steps, expense decisions, bank matching,
   office months): openSession, verifySession, postSession, expenseAction, matchBankLine, and so on.

   The API keeps every amount in the currency it was given in and never converts: it has no exchange
   rate, no recurring gifts, no numbered receipts, no budgets and no list of counting sessions. Those
   stay empty (RATE.value 0, RECURRING and RECEIPTS empty, FUNDS[].budget 0) and are listed in
   docs/frontend-modules/finance.md. Finance needs the priest or a grant with finance.read; each
   action also needs its own capability (finance.enter, finance.post, finance.approve), which the
   API checks. A 403 leaves a collection empty. */
import { api, newOperationId } from '../api.js';

export const keys = [
  'RATE',
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

/* The counting session in view. The API can fetch a session by id but has no list of sessions, so the
   id is remembered in this browser (a convenience only) and a session can also be opened by its id. */
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

const toFund = (f, balances) => {
  const mine = balances.filter(b => b.fundId === f.id).map(b => ({ ...b, fundId: undefined }));
  return {
    id: f.id,
    name: f.name,
    ar: f.name,
    purpose: f.purpose,
    restricted: !!f.restricted,
    status: f.status,
    budget: 0, // the API has no budget
    actual: mine.find(b => b.currency === 'USD')?.paid || 0,
    balances: mine
  };
};
const toExpense = ({ value: x, version }) => ({
  id: x.id,
  version,
  d: x.incurredOn,
  what: x.description,
  whatAr: x.description,
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
  by: null, // the API names the entering account, not a person
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
  name: x.name,
  ar: x.name,
  purpose: x.purpose,
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
function toOffice(entries, balances) {
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
    category: '', // the API has no category
    payee: e.supplier || '',
    reference: e.evidenceReference || e.financeReference || '',
    notes: e.missingEvidenceReason || '',
    reversalOf: e.reversalOf || null,
    status: e.status,
    deleteReason: e.deleteReason || '',
    monthClosed: !!e.monthClosed
  }));
  /* The opening balance has no list route. The current month's balances carry it forward, so what was
     opened is that opening less everything dated before the month. It has no date, so it counts
     toward every month. */
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

/* ---------- load ---------- */
export async function load(parish, d) {
  d.RATE = { value: 0, setOn: null, setBy: '' }; // the API has no exchange rate
  d.BATCH = emptyBatch();
  d.RECURRING = []; // no recurring gifts in the API
  d.RECEIPTS = []; // no numbered receipts in the API
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
  const [funds, balances, campaigns, pledges, gifts, expenses, lines, reconciliations, entries, office] =
    await Promise.all([
      get(fin(parish, 'funds')),
      get(fin(parish, 'balances')),
      get(fin(parish, 'campaigns')),
      get(fin(parish, 'pledges')),
      get(fin(parish, 'contributions')),
      get(fin(parish, 'expenses')),
      get(fin(parish, 'bank/lines')),
      get(fin(parish, 'bank/reconciliations')),
      get(`${base(parish)}/office-ledger/entries`),
      get(`${base(parish)}/office-ledger/balances`)
    ]);
  d.FUNDS = (funds || []).map(f => toFund(f, balances || []));
  d.CAMPAIGNS = (campaigns || []).map(toCampaign);
  d.PLEDGES = (pledges || []).map(toPledge);
  d.CONTRIBUTIONS = (gifts || []).map(toContribution).sort((a, b) => b.date.localeCompare(a.date));
  d.EXPENSES = (expenses || []).map(toExpense);
  const closed = new Set(
    (reconciliations || []).filter(r => r.status === 'Closed').map(r => `${r.bankAccount}:${r.period}`)
  );
  d.BANKLINES = (lines || []).map(b => toBankLine(b, closed)).sort((a, b) => b.at.localeCompare(a.at));
  d.OFFICE_LEDGER = toOffice(entries || [], office ? { period: office.period, totals: office.totals } : null);
  d.GIVING_SERIES = givingSeries(d.CONTRIBUTIONS);
  d.PAYMENT_MIX = paymentMix(d.CONTRIBUTIONS);
  const id = rememberedSession(parish);
  if (id) {
    try {
      d.BATCH = toBatch(await api(fin(parish, `sessions/${encode(id)}`)), id);
    } catch (e) {
      if (e.status === 404 || e.status === 403)
        rememberSession(parish, ''); // not there any more, or not ours to see
      else throw e;
    }
  }
}

/* ---------- save: what a diff can say ---------- */
const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const byId = list => new Map((list || []).map(x => [x.id, x]));
/* the fields the API stores; derived ones (usd, totals, balances) are ignored when comparing */
const core = (x, fields) => Object.fromEntries(fields.map(f => [f, x?.[f] ?? null]));
const FIELDS = {
  fund: ['name', 'purpose', 'restricted'],
  campaign: ['name', 'purpose', 'fund', 'starts', 'ends', 'targets'],
  pledge: ['p', 'hh', 'fund', 'campaign', 'currency', 'pledged', 'schedule', 'starts', 'ends'],
  expense: ['what', 'fund', 'payee', 'd', 'amount', 'currency', 'evidence', 'missingEvidence'],
  office: ['kind', 'date', 'currency', 'amount', 'description', 'payee', 'reference', 'notes']
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

  /* the exchange rate, recurring gifts, receipts and contributions are read-only here */
  for (const key of ['RATE', 'RECURRING', 'RECEIPTS', 'CONTRIBUTIONS', 'BANKLINES', 'GIVING_SERIES', 'PAYMENT_MIX'])
    if (!sameJSON(before[key], now[key])) unsupported = true;
  if (!sameJSON(before.BATCH?.status, now.BATCH?.status)) unsupported = true;

  const funds = changes(before.FUNDS, now.FUNDS, FIELDS.fund);
  if (funds.edited.length || funds.removed.length) unsupported = true; // funds can be created, not changed
  for (const f of funds.added) {
    await post(fin(parish, 'funds'), {
      name: String(f.name || '').trim(),
      purpose: String(f.purpose || '').trim(),
      restricted: !!f.restricted
    });
    saved = true;
  }

  const campaigns = changes(before.CAMPAIGNS, now.CAMPAIGNS, FIELDS.campaign);
  if (campaigns.edited.length || campaigns.removed.length) unsupported = true;
  for (const c of campaigns.added) {
    await post(fin(parish, 'campaigns'), {
      name: String(c.name || '').trim(),
      purpose: String(c.purpose || '').trim(),
      fundId: c.fund,
      startsOn: isDate(c.starts) ? c.starts : todayDate(),
      endsOn: isDate(c.ends) ? c.ends : null,
      targets: c.targets
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
