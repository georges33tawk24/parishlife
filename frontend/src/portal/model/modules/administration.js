/* Purpose: the Administration module's connection to ParishLife.Api: the parish's custom workflows
   (forms) and their runs, the activity the API records for the parish, and the parish profile.
   Main members: keys (the view-model collections this module owns), routes (the portal pages it
   feeds), load (fills the collections from the API), save (reports edits as unsupported: workflow
   and form edits go to the API directly from their screens, then reload).

   The organization workspace, insights, bishop pages and reports are not parish collections: their
   screens call the functions in administration-api.js when they open. Collections that have no API
   equivalent (permissions, security alerts, retention, webhooks, exceptions, eparchy news) stay
   empty; docs/frontend-modules/administration.md lists them. */
import {
  getParish,
  listWorkflows,
  listRuns,
  runWorklist,
  runHistory,
  parishStatusHistory,
  orEmpty
} from './administration-api.js';

export const keys = [
  'WORKFLOWS',
  'RUNS',
  'RUN_LOG',
  'FORM_FIELDS',
  'FORM_RULES',
  'AUDIT',
  'PERMISSIONS',
  'SECURITY_ALERTS',
  'RETENTION',
  'WEBHOOKS',
  'EXCEPTIONS',
  'EPARCHY_NEWS'
];
export const routes = [
  'workspace',
  'assignments',
  'insights',
  'forms',
  'reports',
  'audit',
  'settings',
  'eparchy',
  'oversight',
  'bishopeparchy',
  'bishopmap'
];

const OPEN = ['InProgress', 'Paused'];
const RUN_HISTORY_LIMIT = 10; // the newest open runs whose history feeds the activity log

/* WorkflowDefinitionDto → the portal's workflow card. The API has no average duration, so it stays empty. */
const toWorkflow = ({ value: w, version }, open) => {
  const steps = (w.draft?.steps || []).map(s => s.title);
  return {
    id: w.id,
    name: w.title,
    ar: w.title,
    open,
    avg: '',
    avgAr: '',
    steps,
    stepsAr: steps,
    mode: w.mode,
    modeReason: w.modeReason || '',
    paused: w.mode !== 'Open',
    version,
    publishedVersionId: w.publishedVersionId || '',
    publishedNumber: w.publishedNumber || 0,
    template: w.draft,
    updatedAt: w.updatedAt
  };
};

/* WorkflowRunDto → an open task. The API has no due date, owner or subject person for a run, so those stay empty. */
const toRun = ({ value: r, version }) => {
  const at = r.steps.findIndex(s => s.key === r.currentStepKey);
  return {
    id: r.id,
    wf: r.definitionId,
    subject: '',
    step: at < 0 ? r.steps.length : at,
    total: r.steps.length,
    due: '',
    owner: '',
    status: r.status,
    overdue: false,
    version,
    title: r.title,
    cycle: r.cycle,
    startedAt: r.startedAt,
    stepKey: r.currentStepKey || '',
    steps: r.steps,
    answers: r.answers,
    redacted: r.redactedFieldKeys || []
  };
};

const kindOf = action =>
  /declin|cancel|fail/i.test(action)
    ? 'error'
    : /complet|approv/i.test(action)
      ? 'approve'
      : /start|creat/i.test(action)
        ? 'create'
        : 'settings';

export async function load(parish, d) {
  const id = parish.id;
  const [detail, defs, runs, statusChanges] = await Promise.all([
    getParish(id).catch(() => null),
    orEmpty(listWorkflows(id)),
    orEmpty(listRuns(id).catch(error => (error.status === 403 ? runWorklist(id) : Promise.reject(error)))),
    orEmpty(parishStatusHistory(id))
  ]);
  /* the parish profile: only what the API holds (name, locality, contact, the archdiocese it declared) */
  if (detail?.value) {
    const p = detail.value;
    Object.assign(d.PARISH, {
      name: p.name || d.PARISH.name,
      town: p.locality || '',
      contact: p.contact || '',
      eparchy: p.declaredArchdiocese || '',
      status: p.status
    });
  }
  const open = runs.filter(r => OPEN.includes(r.value.status));
  d.RUNS = open.map(toRun);
  d.WORKFLOWS = defs.map(w => toWorkflow(w, open.filter(r => r.value.definitionId === w.value.id).length));

  /* what happened: the history of the newest open runs, and the parish's operating-status changes */
  const histories = await Promise.all(
    open.slice(0, RUN_HISTORY_LIMIT).map(r => orEmpty(runHistory(id, r.value.id)).then(list => [r.value, list]))
  );
  const entries = histories.flatMap(([run, list]) =>
    list.map(e => {
      const step = run.steps.find(s => s.key === e.stepKey);
      const text = [run.title, e.action, step ? step.title : '', e.reason ? `(${e.reason})` : '']
        .filter(Boolean)
        .join(' — ');
      return {
        at: e.at,
        text,
        kind: /error|declin|cancel/i.test(e.action + e.toStatus) ? 'err' : 'ok',
        action: e.action,
        by: e.by
      };
    })
  );
  d.RUN_LOG = entries.sort((a, b) => String(b.at).localeCompare(String(a.at))).map(e => [e.at, e.text, e.text, e.kind]);
  d.AUDIT = [
    ...entries.map(e => ({ at: e.at, who: '', actorName: '', what: e.text, whatAr: e.text, kind: kindOf(e.action) })),
    ...statusChanges.map(c => ({
      at: c.at,
      who: '',
      actorName: '',
      what: `Parish status ${c.action}: ${c.from} → ${c.to}${c.reason ? ` (${c.reason})` : ''}`,
      whatAr: `Parish status ${c.action}: ${c.from} → ${c.to}${c.reason ? ` (${c.reason})` : ''}`,
      kind: 'settings'
    }))
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/* before and now are snapshots of the whole view model. Workflow and form edits do not go through here:
   their screens call the API and reload. Any change to a collection this module owns is therefore one
   the API cannot take. */
export async function save(before, now) {
  const unsupported = keys.some(k => JSON.stringify(before[k]) !== JSON.stringify(now[k]));
  return { unsupported, saved: false };
}
