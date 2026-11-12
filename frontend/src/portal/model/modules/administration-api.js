/* Purpose: the administration module's calls to ParishLife.Api, one small function per route, so the
   screens in features/administration and features/oversight never build a URL themselves.
   Main members: listAll (every page of a list that pages with size and cursor), myScopes (the
   organizations and parishes the signed-in account has a capacity in), organization and parish calls,
   appointments, billing, reporting, workflows and the platform homepage.

   Routes, DTOs and permissions are those of ParishLife.Api/Controllers (Organizations, Administration,
   Billing, Reporting, Workflows, Publishing/HomepageController). Property names are camelCase and enums
   are strings. Creates carry an operationId; a versioned write sends the version the API returned.
   The API has no list of all parishes, archdioceses or accounts: what is shown is what the account can
   reach through its capacities (GET /api/me/capacities), or what it opens by reference. */
import { api, newOperationId, notConnected } from '../api.js';

const e = encodeURIComponent;
const op = body => ({ operationId: newOperationId(), ...body });
const query = params =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${e(v)}`)
    .join('&');
const withQuery = (path, params) => {
  const q = query(params);
  return q ? `${path}?${q}` : path;
};

/* Every page of a list that pages with size and cursor (Page<T> is { items, continuationToken }). */
export async function listAll(path, { limit = 1000, size = 50, params = {} } = {}) {
  const items = [];
  let cursor = '';
  do {
    const page = await api(withQuery(path, { ...params, size, cursor }));
    items.push(...(page?.items || []));
    cursor = page?.continuationToken || '';
  } while (cursor && items.length < limit);
  return items;
}
/* A 403 means "not allowed here"; a route the API does not answer means not connected: either way the list is empty. */
export const orEmpty = (promise, empty = []) =>
  promise.catch(error => (error.status === 403 || error.message === notConnected ? empty : Promise.reject(error)));

/* What the account may reach: GET /api/me/capacities lists Priest, ParishGrant, MinistryLeader (a parish),
   Bishop and ArchdioceseAdmin (an archdiocese) and PlatformOperator (the platform). */
export async function myScopes() {
  const capacities = (await api('me/capacities').catch(() => [])) || [];
  const archdioceses = new Map(),
    parishes = new Map();
  let operator = false;
  for (const c of capacities) {
    if (c.kind === 'PlatformOperator') operator = true;
    if (c.archdioceseId) {
      const a = archdioceses.get(c.archdioceseId) || { id: c.archdioceseId, name: '', kinds: [], appointmentIds: [] };
      if (['Bishop', 'ArchdioceseAdmin'].includes(c.kind)) {
        a.name = c.scopeName || a.name;
        a.kinds = [...new Set([...a.kinds, c.kind])];
        if (c.appointmentId) a.appointmentIds.push(c.appointmentId);
      }
      archdioceses.set(c.archdioceseId, a);
    }
    if (c.parishId) {
      const p = parishes.get(c.parishId) || { id: c.parishId, name: c.scopeName || '', kinds: [], archdioceseId: null };
      p.kinds = [...new Set([...p.kinds, c.kind])];
      p.archdioceseId ||= c.archdioceseId || null;
      parishes.set(c.parishId, p);
    }
  }
  return {
    operator,
    bishop: [...archdioceses.values()].some(a => a.kinds.includes('Bishop')),
    archdioceses: [...archdioceses.values()].filter(a => a.kinds.length),
    parishes: [...parishes.values()]
  };
}

/* ---- Organizations ---- */
export const getArchdiocese = id => api(`archdioceses/${e(id)}`); // Versioned<ArchdioceseDto>
export const getParish = id => api(`parishes/${e(id)}`); // Versioned<ParishDto>
export const registerArchdiocese = ({ name, locality }) => api('archdioceses', 'POST', op({ name, locality }));
export const registerParish = ({ name, locality, contact, declaredArchdiocese }) =>
  api('parishes', 'POST', op({ name, locality, contact, declaredArchdiocese: declaredArchdiocese || null }));
/* Verification needs the version the operator inspected (GET /api/administration/...-verifications/{id}). */
export const inspectParishVerification = id => api(`administration/parish-verifications/${e(id)}`);
export const inspectArchdioceseVerification = id => api(`administration/archdiocese-verifications/${e(id)}`);
export const verifyParish = (id, version, evidenceReference) =>
  api(`parishes/${e(id)}/verify`, 'POST', op({ version, evidenceReference }));
export const verifyArchdiocese = (id, version, evidenceReference) =>
  api(`archdioceses/${e(id)}/verify`, 'POST', op({ version, evidenceReference }));
/* action: suspend | reinstate | close (the jurisdiction bishop) */
export const changeParishStatus = (id, version, action, reason) =>
  api(`parishes/${e(id)}/status`, 'POST', op({ version, action, reason }));
export const parishStatusHistory = id => api(`parishes/${e(id)}/status/history`);
export const parishOfficeCoverage = id => api(`parishes/${e(id)}/office/coverage`);
export const getParishLocation = id => api(`parishes/${e(id)}/location`);
export const setParishLocation = (id, body) => api(`parishes/${e(id)}/location`, 'PUT', op(body));
export const proposeAssociation = (id, version, archdioceseId) =>
  api(`parishes/${e(id)}/association-requests`, 'POST', op({ version, archdioceseId }));
export const getAssociation = (id, requestId) => api(`parishes/${e(id)}/association-requests/${e(requestId)}`);
export const decideAssociation = (id, requestId, version, accept) =>
  api(`parishes/${e(id)}/association-requests/${e(requestId)}/decision`, 'POST', op({ version, accept }));
export const endAssociation = (id, version, reason) =>
  api(`parishes/${e(id)}/association/end`, 'POST', op({ version, reason }));
export const proposeJurisdiction = (id, body) => api(`parishes/${e(id)}/jurisdiction-proposals`, 'POST', op(body));
export const getJurisdiction = (id, proposalId) => api(`parishes/${e(id)}/jurisdiction-proposals/${e(proposalId)}`);
export const decideJurisdiction = (id, proposalId, body) =>
  api(`parishes/${e(id)}/jurisdiction-proposals/${e(proposalId)}/decision`, 'POST', op(body));

/* Parish office grants (GrantAccessDto, RevokeAccessDto): the parish version is required. */
export const grantAccess = (parishId, body) => api(`parishes/${e(parishId)}/grants`, 'PUT', op(body));
export const revokeAccess = (parishId, body) => api(`parishes/${e(parishId)}/grants/revoke`, 'POST', op(body));

/* Ownership claims */
export const listClaims = parishId => listAll(`parishes/${e(parishId)}/ownership-claims`);
export const openClaim = (parishId, body) => api(`parishes/${e(parishId)}/ownership-claims`, 'POST', op(body));
export const getClaim = (parishId, id) => api(`parishes/${e(parishId)}/ownership-claims/${e(id)}`);
export const respondClaim = (parishId, id, version, response) =>
  api(`parishes/${e(parishId)}/ownership-claims/${e(id)}/response`, 'POST', op({ version, response }));
export const withdrawClaim = (parishId, id, version) =>
  api(`parishes/${e(parishId)}/ownership-claims/${e(id)}/withdraw`, 'POST', op({ version }));
export const decideClaim = (parishId, id, body) =>
  api(`parishes/${e(parishId)}/ownership-claims/${e(id)}/decision`, 'POST', op(body));

/* ---- Appointments ---- */
/* Staff appointments in an archdiocese; priest appointments in a parish of it (with the head designation). */
const staffBase = (archdioceseId, parishId) =>
  parishId
    ? `archdioceses/${e(archdioceseId)}/parishes/${e(parishId)}/priest-appointments`
    : `archdioceses/${e(archdioceseId)}/staff-appointments`;
export const appointmentScope = (a, p) => api(`${staffBase(a, p)}/scope`);
export const listAppointments = (a, p) => listAll(staffBase(a, p));
export const inviteAppointment = (a, p, body) => api(staffBase(a, p), 'POST', op(body));
export const respondAppointment = (a, p, id, body) => api(`${staffBase(a, p)}/${e(id)}/response`, 'POST', op(body));
export const actAppointment = (a, p, id, body) => api(`${staffBase(a, p)}/${e(id)}/actions`, 'POST', op(body));
export const designateHead = (a, p, id, body) => api(`${staffBase(a, p)}/${e(id)}/head-designation`, 'PUT', op(body));
export const endHead = (a, p, id, body) => api(`${staffBase(a, p)}/${e(id)}/head-designation/end`, 'POST', op(body));
/* Bishop appointments: only a single one can be read, so one is opened by its reference. */
export const proposeBishop = (a, body) => api(`archdioceses/${e(a)}/bishop-appointments`, 'POST', op(body));
export const getBishopAppointment = (a, id) => api(`archdioceses/${e(a)}/bishop-appointments/${e(id)}`);
export const reviewBishop = (a, id, body) =>
  api(`archdioceses/${e(a)}/bishop-appointments/${e(id)}/review`, 'POST', op(body));
export const respondBishop = (a, id, body) =>
  api(`archdioceses/${e(a)}/bishop-appointments/${e(id)}/response`, 'POST', op(body));

/* ---- Plans and billing ---- */
export const listPlans = () => api('plans');
export const publishPlan = body => api('plans', 'POST', op(body));
export const parishCoverage = parishId => api(`parishes/${e(parishId)}/billing/coverage`);
export const createInvoice = (parishId, body) => api(`parishes/${e(parishId)}/billing/invoices`, 'POST', op(body));
export const getInvoice = (parishId, id) => api(`parishes/${e(parishId)}/billing/invoices/${e(id)}`);
export const recordCash = (parishId, id, body) =>
  api(`parishes/${e(parishId)}/billing/invoices/${e(id)}/cash-receipts`, 'POST', op(body));
export const archdioceseInvoice = (a, id) => api(`archdioceses/${e(a)}/billing/invoices/${e(id)}`);
export const createArchdioceseInvoice = (a, parishId, body) =>
  api(`archdioceses/${e(a)}/billing/parishes/${e(parishId)}/invoices`, 'POST', op(body));
export const recordArchdioceseCash = (a, id, body) =>
  api(`archdioceses/${e(a)}/billing/invoices/${e(id)}/cash-receipts`, 'POST', op(body));
export const operatorInvoice = (parishId, id) => api(`administration/parishes/${e(parishId)}/invoices/${e(id)}`);
export const payerSchedule = parishId => api(`parishes/${e(parishId)}/payer-schedule`);
export const listPayerTransfers = parishId => listAll(`parishes/${e(parishId)}/payer-transfers`);
export const getPayerTransfer = (parishId, id) => api(`parishes/${e(parishId)}/payer-transfers/${e(id)}`);
/* The parish offers to hand its billing to an archdiocese, or the archdiocese offers to take it. */
export const proposeTransferToArchdiocese = (parishId, archdioceseId, body) =>
  api(`parishes/${e(parishId)}/payer-transfers/archdioceses/${e(archdioceseId)}`, 'POST', op(body));
export const proposeTransferToParish = (archdioceseId, parishId, body) =>
  api(`archdioceses/${e(archdioceseId)}/payer-transfers/parishes/${e(parishId)}`, 'POST', op(body));
export const decideTransfer = (parishId, id, body) =>
  api(`parishes/${e(parishId)}/payer-transfers/${e(id)}/decision`, 'POST', op(body));
export const cancelTransfer = (parishId, id, body) =>
  api(`parishes/${e(parishId)}/payer-transfers/${e(id)}/cancel`, 'POST', op(body));

/* ---- Reporting ---- */
export const platformInsights = (from, to) => api(withQuery('administration/insights', { from, to }));
export const bishopOverview = (archdioceseId, from, to) =>
  api(withQuery(`archdioceses/${e(archdioceseId)}/overview`, { from, to }));
export const bishopMap = archdioceseId => api(`archdioceses/${e(archdioceseId)}/overview/map`);
export const workOverview = parishId => api(`parishes/${e(parishId)}/work-overview`);
export const crmWorklist = (params = {}) => listAll('administration/parish-crm/worklist', { params });
export const getCrm = parishId => api(`administration/parishes/${e(parishId)}/crm`);
export const saveCrm = (parishId, body) => api(`administration/parishes/${e(parishId)}/crm`, 'PUT', op(body));
export const addCrmNote = (parishId, body) => api(`administration/parishes/${e(parishId)}/crm/notes`, 'POST', op(body));
export const crmHistory = parishId => listAll(`administration/parishes/${e(parishId)}/crm/history`);
export const listReportSchedules = () => listAll('report-schedules');
export const createReportSchedule = body => api('report-schedules', 'POST', op(body));
export const actReportSchedule = (id, version, action, reason) =>
  api(`report-schedules/${e(id)}/actions`, 'POST', op({ version, action, reason: reason || null }));
export const listReportDeliveries = () => listAll('report-deliveries');

/* ---- Custom workflows (forms and runs) ---- */
const wf = parishId => `parishes/${e(parishId)}/workflows`;
const runs = parishId => `parishes/${e(parishId)}/workflow-runs`;
export const listWorkflows = parishId => listAll(wf(parishId));
export const createWorkflow = (parishId, body) => api(wf(parishId), 'POST', op(body));
export const saveWorkflowDraft = (parishId, id, body) => api(`${wf(parishId)}/${e(id)}`, 'PUT', op(body));
export const publishWorkflow = (parishId, id, version) =>
  api(`${wf(parishId)}/${e(id)}/publish`, 'POST', op({ version }));
export const setWorkflowMode = (parishId, id, body) => api(`${wf(parishId)}/${e(id)}/mode`, 'POST', op(body));
export const listRuns = (parishId, params = {}) => listAll(runs(parishId), { params });
export const runWorklist = parishId => listAll(`${runs(parishId)}/worklist`);
export const startRun = (parishId, definitionId, body) =>
  api(`parishes/${e(parishId)}/workflows/${e(definitionId)}/runs`, 'POST', op(body));
export const recordRunStep = (parishId, id, body) => api(`${runs(parishId)}/${e(id)}/steps`, 'POST', op(body));
export const actRun = (parishId, id, body) => api(`${runs(parishId)}/${e(id)}/actions`, 'POST', op(body));
export const runHistory = (parishId, id) => listAll(`${runs(parishId)}/${e(id)}/history`, { limit: 200 });

/* ---- The platform homepage (platform operators) ---- */
export const homepageDraft = () => api('administration/homepage/draft');
export const saveHomepageDraft = body => api('administration/homepage/draft', 'PUT', op(body));
export const publishHomepage = body => api('administration/homepage/publish', 'POST', op(body));
export const homepageRevisions = () => listAll('administration/homepage/revisions', { limit: 100 });

/* ---- Accounts and identity ---- */
/* An account's MFA recovery request, opened by account and request reference. */
export const getMfaRecoveryRequest = (accountId, id) =>
  api(`administration/accounts/${e(accountId)}/mfa-recovery-requests/${e(id)}`);
export const reviewMfaRecovery = (accountId, id, body) =>
  api(`administration/accounts/${e(accountId)}/mfa-recovery-requests/${e(id)}/review`, 'POST', op(body));
