/* Forms and workflows, on ParishLife.Api's custom-workflow routes (/api/parishes/{id}/workflows and
   .../workflow-runs). A workflow is a form (fields, some shown only when another field has a value) and
   ordered steps, each needing a parish permission. Edits go to the API directly and the screen reloads.
   The API has no due date, owner or subject person for a run, no average duration and no automation, so
   those are not shown. Main members: forms (the page), openRun. */
import { useState } from 'react';
import { t, fmtDate } from '../../../lib/i18n.js';
import { S, bus } from '../../model/store.js';
import { session } from '../../model/api.js';
import { hydrate } from '../../model/persist.js';
import { WORKFLOWS, RUNS, RUN_LOG } from '../../model/data.js';
import { Icon, PageHead, Panel, Pill, Table, Empty, Stat, TabBar, Paged, openDrawer, toast } from '../../ui/ui.jsx';
import { Select } from '../../ui/components.jsx';
import * as A from '../../model/modules/administration-api.js';
import { L, openForm, Fields, csv } from './workspace-forms.jsx';

const PERMISSIONS = [
  'people.read',
  'people.write',
  'requests.manage',
  'sacraments.record',
  'clergy.approve',
  'documents.sign',
  'documents.release',
  'finance.read',
  'finance.enter',
  'finance.approve',
  'registrations.manage',
  'communications.manage',
  'publishing.manage',
  'workflows.manage',
  'ministries.manage',
  'facilities.manage',
  'schedule.manage',
  'incidents.manage',
  'parish.manage'
];
const perm = (name = 'permission', value = 'requests.manage') => ({
  name,
  label: L('Permission needed', 'الصلاحية المطلوبة'),
  type: 'select',
  value,
  options: PERMISSIONS.map(p => [p, p])
});
const TYPES = [
  ['Text', L('Text', 'نص')],
  ['Choice', L('Choice', 'خيار')],
  ['Boolean', L('Yes / no', 'نعم / لا')],
  ['Number', L('Number', 'رقم')],
  ['Date', L('Date', 'تاريخ')]
];
const MODES = {
  Open: L('Open', 'مفتوح'),
  PausedNew: L('No new runs', 'لا بدايات جديدة'),
  SafetyStop: L('Safety stop', 'إيقاف احترازي')
};
const parishId = () => session.parishId;
const slug = (text, i) =>
  (String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'step') +
  '_' +
  (i + 1);
const reload = async () => {
  await hydrate();
  bus.refresh();
};
const fail = title => e => toast(title, e.message, 'danger');
const stamp = v => `${fmtDate(String(v).slice(0, 10))}${String(v).length > 10 ? ` · ${String(v).slice(11, 16)}` : ''}`;

const TABS = () => [
  ['', 'Workflows', 'المسارات'],
  ['runs', 'Open tasks', 'المهام المفتوحة', RUNS.length],
  ['builder', 'Form builder', 'بناء الاستمارة'],
  ['log', 'Activity log', 'سجل النشاط']
];

const newWorkflow = () =>
  openForm({
    title: L('New workflow', 'مسار جديد'),
    intro: L(
      'Start with one step; add fields and more steps in the form builder.',
      'ابدأ بخطوة واحدة؛ أضف الحقول والخطوات في بناء الاستمارة.'
    ),
    fields: [
      { name: 'title', label: L('Name', 'الاسم') },
      perm('startPermission', 'requests.manage'),
      { name: 'stepTitle', label: L('First step', 'الخطوة الأولى') },
      perm('stepPermission', 'requests.manage')
    ],
    save: v =>
      A.createWorkflow(parishId(), {
        title: v.title,
        template: {
          startPermission: v.startPermission,
          fields: [],
          restrictedFieldKeys: [],
          steps: [
            {
              key: slug(v.stepTitle, 0),
              title: v.stepTitle,
              permission: v.stepPermission,
              whenField: null,
              whenValue: null,
              viewsRestricted: false
            }
          ]
        }
      }),
    done: reload
  });

function startRun(w) {
  const fields = w.template?.fields || [];
  if (!w.publishedVersionId) return toast(L('Publish the workflow first', 'انشر المسار أولاً'), '', 'warning');
  openForm({
    title: L('Start', 'بدء') + ' · ' + w.name,
    fields: fields.map(f => ({
      name: f.key,
      label: f.label,
      required: f.required,
      type:
        f.type === 'Choice'
          ? 'select'
          : f.type === 'Date'
            ? 'date'
            : f.type === 'Number'
              ? 'number'
              : f.type === 'Boolean'
                ? 'select'
                : 'text',
      options:
        f.type === 'Choice'
          ? f.options.map(o => [o, o])
          : [
              ['true', L('Yes', 'نعم')],
              ['false', L('No', 'لا')]
            ]
    })),
    save: v =>
      A.startRun(parishId(), w.id, {
        versionId: w.publishedVersionId,
        answers: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== ''))
      }),
    done: reload
  });
}

function setMode(w) {
  openForm({
    title: L('Run mode', 'نمط التشغيل') + ' · ' + w.name,
    intro: L('A safety stop also freezes runs already under way.', 'الإيقاف الاحترازي يجمّد أيضاً المسارات الجارية.'),
    fields: [
      { name: 'mode', label: L('Mode', 'النمط'), type: 'select', value: w.mode, options: Object.entries(MODES) },
      { name: 'reason', label: L('Reason', 'السبب'), type: 'textarea' }
    ],
    save: v => A.setWorkflowMode(parishId(), w.id, { version: w.version, mode: v.mode, reason: v.reason }),
    done: reload
  });
}

export function openRun(id) {
  const r = RUNS.find(x => x.id === id);
  if (!r) return;
  const act = action =>
    openForm({
      title: action + ' · ' + r.title,
      fields: [{ name: 'reason', label: L('Reason', 'السبب'), type: 'textarea' }],
      save: v => A.actRun(parishId(), r.id, { version: r.version, action: action.toLowerCase(), reason: v.reason }),
      done: reload
    });
  const step = () =>
    openForm({
      title: L('Record the current step', 'تسجيل الخطوة الحالية') + ' · ' + r.title,
      fields: [
        {
          name: 'result',
          label: L('Result', 'النتيجة'),
          type: 'select',
          options: [
            ['Completed', L('Completed', 'أُنجزت')],
            ['Declined', L('Declined', 'رُفضت')]
          ]
        },
        { name: 'note', label: L('Note (optional)', 'ملاحظة (اختياري)'), required: false, type: 'textarea' }
      ],
      save: v =>
        A.recordRunStep(parishId(), r.id, {
          version: r.version,
          stepKey: r.stepKey,
          result: v.result,
          note: v.note || null
        }),
      done: reload
    });
  openDrawer({
    title: r.title,
    sub: `${r.status} · ${L('cycle', 'دورة')} ${r.cycle}`,
    body: (
      <>
        <ol className="runsteps">
          {r.steps.map((s, i) => (
            <li key={s.key} className={s.status === 'Completed' ? 'done' : s.key === r.stepKey ? 'now' : ''}>
              <span className="dot" aria-hidden="true">
                {s.status === 'Completed' ? <Icon name="check" size={13} /> : i + 1}
              </span>{' '}
              <span className="grow">
                <b>{s.title}</b>
                <small>
                  {s.status}
                  {s.completedAt ? ` · ${stamp(s.completedAt)}` : ''}
                  {s.note ? ` · ${s.note}` : ''} · {s.permission}
                </small>
              </span>
            </li>
          ))}
        </ol>
        <dl className="dl">
          <dt>{L('Started', 'بدأت')}</dt>
          <dd>{stamp(r.startedAt)}</dd>
          {Object.entries(r.answers || {}).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{r.redacted.includes(k) ? L('Restricted', 'مقيّد') : v}</dd>
            </div>
          ))}
        </dl>
        <div className="row" style={{ gap: '8px', marginTop: '16px' }}>
          {r.status === 'InProgress' ? (
            <button className="btn btn-primary" data-run-step="" onClick={step}>
              {L('Record step', 'تسجيل الخطوة')}
            </button>
          ) : null}
          {r.status === 'InProgress' ? (
            <button className="btn btn-secondary" onClick={() => act('Pause')}>
              {L('Pause', 'إيقاف مؤقّت')}
            </button>
          ) : null}
          {r.status === 'Paused' ? (
            <button className="btn btn-secondary" onClick={() => act('Resume')}>
              {L('Resume', 'استئناف')}
            </button>
          ) : null}
          <button className="btn btn-danger-quiet" data-run-cancel="" onClick={() => act('Cancel')}>
            {L('Cancel', 'إلغاء')}
          </button>
        </div>
      </>
    )
  });
}

function Builder() {
  const first = WORKFLOWS.find(w => w.id === S.ui.formWf) || WORKFLOWS[0];
  const [picked, setPicked] = useState(first?.id || '');
  const w = WORKFLOWS.find(x => x.id === picked) || first;
  const [draft, setDraft] = useState(() => structuredClone(w?.template || null));
  const [seen, setSeen] = useState(w ? w.id + w.version : '');
  if (w && seen !== w.id + w.version) {
    setSeen(w.id + w.version);
    setDraft(structuredClone(w.template));
  }
  if (!w)
    return (
      <Empty
        glyph="forms"
        title={L('No workflow yet', 'لا مسار بعد')}
        body={L('Create a workflow to build its form.', 'أنشئ مساراً لبناء استمارته.')}
      />
    );
  const edit = fn =>
    setDraft(d => {
      const c = structuredClone(d);
      fn(c);
      return c;
    });
  const addField = () =>
    openForm({
      title: L('Add a field', 'إضافة حقل'),
      fields: [
        { name: 'label', label: L('Label', 'العنوان') },
        { name: 'type', label: L('Type', 'النوع'), type: 'select', options: TYPES },
        {
          name: 'options',
          label: L('Choices (comma separated, for a choice field)', 'الخيارات (مفصولة بفواصل)'),
          required: false
        },
        { name: 'required', label: L('Required', 'إلزامي'), type: 'check' },
        {
          name: 'restricted',
          label: L('Restricted: hidden from steps not marked to see it', 'مقيّد: مخفي عن الخطوات غير المخوّلة'),
          type: 'check'
        }
      ],
      save: v =>
        edit(d => {
          const key = slug(v.label, d.fields.length);
          d.fields.push({
            key,
            label: v.label,
            type: v.type,
            required: !!v.required,
            options: v.type === 'Choice' ? csv(v.options) : [],
            visibleWhenField: null,
            visibleWhenValue: null
          });
          if (v.restricted) d.restrictedFieldKeys.push(key);
        })
    });
  const addRule = () =>
    openForm({
      title: L('Show a field only when…', 'أظهر الحقل فقط حين…'),
      fields: [
        {
          name: 'show',
          label: L('Field to show', 'الحقل المراد إظهاره'),
          type: 'select',
          options: draft.fields.map(f => [f.key, f.label])
        },
        {
          name: 'when',
          label: L('When this field', 'حين يكون هذا الحقل'),
          type: 'select',
          options: draft.fields.map(f => [f.key, f.label])
        },
        { name: 'value', label: L('has this value (true / false for yes-no)', 'قيمته (true / false لنعم / لا)') }
      ],
      save: v =>
        edit(d => {
          const f = d.fields.find(x => x.key === v.show);
          f.visibleWhenField = v.when;
          f.visibleWhenValue = v.value;
        })
    });
  const addStep = () =>
    openForm({
      title: L('Add a step', 'إضافة خطوة'),
      fields: [
        { name: 'title', label: L('Step', 'الخطوة') },
        perm(),
        {
          name: 'whenField',
          label: L('Only when this field… (optional)', 'فقط حين هذا الحقل… (اختياري)'),
          type: 'select',
          required: false,
          options: [['', '—'], ...draft.fields.map(f => [f.key, f.label])]
        },
        { name: 'whenValue', label: L('…has this value', '…قيمته'), required: false },
        { name: 'viewsRestricted', label: L('May see restricted fields', 'يرى الحقول المقيّدة'), type: 'check' }
      ],
      save: v =>
        edit(d =>
          d.steps.push({
            key: slug(v.title, d.steps.length),
            title: v.title,
            permission: v.permission,
            whenField: v.whenField || null,
            whenValue: v.whenField ? v.whenValue : null,
            viewsRestricted: !!v.viewsRestricted
          })
        )
    });
  const saveDraft = async publish => {
    try {
      const saved = await A.saveWorkflowDraft(parishId(), w.id, { version: w.version, title: w.name, template: draft });
      if (publish) await A.publishWorkflow(parishId(), w.id, saved.version);
      toast(publish ? L('Published', 'نُشر') : L('Draft saved', 'حُفظت المسوّدة'), '', 'success');
      await reload();
    } catch (e) {
      fail(L('Could not save', 'تعذّر الحفظ'))(e);
    }
  };
  return (
    <div className="splitview">
      <div>
        <div className="toolbar">
          <Select
            aria-label={L('Workflow', 'المسار')}
            value={w.id}
            onChange={e => {
              S.ui.formWf = e.target.value;
              setPicked(e.target.value);
            }}
          >
            {WORKFLOWS.map(x => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
          <span className="chip">
            {w.publishedNumber
              ? `${L('Published version', 'النسخة المنشورة')} ${w.publishedNumber}`
              : L('Never published', 'لم تُنشر')}
          </span>
        </div>
        <Panel title={L('Fields', 'الحقول')}>
          {draft.fields.map((f, i) => (
            <div key={f.key} className="listrow" style={{ paddingInline: 0 }}>
              <span className="grow">
                <b>
                  {f.label}
                  {f.required ? <span style={{ color: 'var(--danger)' }}>*</span> : ''}
                </b>
                <small>
                  {f.type}
                  {f.options.length ? ` · ${f.options.join(', ')}` : ''}
                  {draft.restrictedFieldKeys.includes(f.key) ? ` · ${L('restricted', 'مقيّد')}` : ''}
                </small>
              </span>
              <button
                className="btn btn-ghost btn-dense"
                aria-label={L('Remove field', 'إزالة الحقل')}
                onClick={() =>
                  edit(d => {
                    const [g] = d.fields.splice(i, 1);
                    d.restrictedFieldKeys = d.restrictedFieldKeys.filter(k => k !== g.key);
                    d.fields.forEach(x => {
                      if (x.visibleWhenField === g.key) {
                        x.visibleWhenField = null;
                        x.visibleWhenValue = null;
                      }
                    });
                    d.steps.forEach(s => {
                      if (s.whenField === g.key) {
                        s.whenField = null;
                        s.whenValue = null;
                      }
                    });
                  })
                }
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
          {!draft.fields.length ? <p className="t-caption dim">{L('No fields yet.', 'لا حقول بعد.')}</p> : null}
          <button className="btn btn-secondary btn-dense" data-add-field="" onClick={addField}>
            {L('Add field', 'إضافة حقل')}
          </button>
        </Panel>
        <Panel title={L('Steps', 'الخطوات')}>
          <ol className="wfsteps">
            {draft.steps.map((s, i) => (
              <li key={s.key}>
                <span className="n">{i + 1}</span> {s.title}{' '}
                <small className="dim">
                  {s.permission}
                  {s.whenField ? ` · ${L('when', 'حين')} ${s.whenField} = ${s.whenValue}` : ''}
                </small>
                {draft.steps.length > 1 ? (
                  <button
                    className="btn btn-ghost btn-dense"
                    aria-label={L('Remove step', 'إزالة الخطوة')}
                    onClick={() => edit(d => d.steps.splice(i, 1))}
                  >
                    <Icon name="close" size={14} />
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
          <button className="btn btn-secondary btn-dense" data-add-step="" onClick={addStep}>
            {L('Add step', 'إضافة خطوة')}
          </button>
        </Panel>
      </div>
      <div className="sidecol">
        <Panel title={L('Show a field only when…', 'أظهر الحقل فقط حين…')}>
          {draft.fields
            .filter(f => f.visibleWhenField)
            .map(f => (
              <div key={f.key} className="rulecard">
                <span className="grow">
                  {L('Show', 'أظهر')} <b>{f.label}</b> {L('only when', 'فقط حين')}{' '}
                  <b>{draft.fields.find(x => x.key === f.visibleWhenField)?.label}</b> = <b>{f.visibleWhenValue}</b>
                </span>
                <button
                  className="btn btn-ghost btn-dense"
                  aria-label={L('Remove rule', 'إزالة القاعدة')}
                  onClick={() =>
                    edit(d => {
                      const x = d.fields.find(y => y.key === f.key);
                      x.visibleWhenField = null;
                      x.visibleWhenValue = null;
                    })
                  }
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            ))}
          {!draft.fields.some(f => f.visibleWhenField) ? (
            <p className="t-caption dim">
              {L('No rules — every field always shows.', 'لا قواعد — كل الحقول تظهر دائماً.')}
            </p>
          ) : null}
          <button
            className="btn btn-secondary btn-dense"
            data-add-rule=""
            disabled={draft.fields.length < 2}
            onClick={addRule}
          >
            {L('Add rule', 'إضافة قاعدة')}
          </button>
        </Panel>
        <div className="row" style={{ gap: '8px' }}>
          <button className="btn btn-secondary" data-save-draft="" onClick={() => saveDraft(false)}>
            {L('Save draft', 'حفظ المسوّدة')}
          </button>
          <button className="btn btn-primary" data-publish="" onClick={() => saveDraft(true)}>
            {L('Save and publish', 'حفظ ونشر')}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormsPage({ tab }) {
  const unavailable = !parishId();
  const late = 0;
  const head = (
    <>
      <PageHead
        crumbs={[{ label: L('Administration', 'الإدارة') }, { label: L('Forms & workflows', 'الاستمارات والمسارات') }]}
        title={L('Forms and workflows', 'الاستمارات ومسارات العمل')}
        sub={L(
          'Each request moves through set steps, each needing a permission the person doing it holds.',
          'يمرّ كل طلب بخطوات محدّدة، لكل خطوة صلاحية يملكها منفّذها.'
        )}
        actions={
          <button className="btn btn-primary" data-new-workflow="" onClick={newWorkflow}>
            <Icon name="plus" size={17} />
            {L('New workflow', 'مسار جديد')}
          </button>
        }
      />
      <TabBar base="forms" items={TABS()} active={tab} />
    </>
  );
  if (unavailable)
    return (
      <>
        {head}
        <Empty glyph="forms" title={L('Choose a parish', 'اختر رعية')} />
      </>
    );
  if (tab === 'runs') {
    const only = WORKFLOWS.find(w => w.id === S.ui.runWf);
    const runs = RUNS.filter(r => !only || r.wf === only.id);
    return (
      <>
        {head}
        {only ? (
          <p className="t-caption dim">
            {only.name}{' '}
            <a href="#/forms/runs" onClick={() => (S.ui.runWf = '')}>
              {L('Show every workflow', 'عرض كل المسارات')}
            </a>
          </p>
        ) : null}
        <Table
          cols={[
            { label: L('Task', 'المهمة') },
            { label: L('Current step', 'الخطوة الحالية') },
            { label: L('Status', 'الحالة') },
            { label: L('Started', 'بدأت') },
            { label: '', cls: 'shrink' }
          ]}
          rows={runs.map(r => ({
            cells: [
              <b>{r.title}</b>,
              r.steps[r.step]?.title || '—',
              <Pill label={r.status} tone={r.status === 'Paused' ? 'warning' : 'info'} />,
              <span className="mono dim">{stamp(r.startedAt)}</span>,
              <button className="btn btn-secondary btn-dense" data-run={r.id} onClick={() => openRun(r.id)}>
                {L('Open', 'فتح')}
              </button>
            ]
          }))}
          empty={<Empty glyph="check" title={L('No open tasks', 'لا مهام مفتوحة')} />}
        />
      </>
    );
  }
  if (tab === 'builder')
    return (
      <>
        {head}
        <Builder />
      </>
    );
  if (tab === 'log')
    return (
      <>
        {head}
        <Panel title={L('What happened, newest first', 'ما جرى، الأحدث أولاً')}>
          <div className="timeline">
            {RUN_LOG.map(([when, en, , kind], i) => (
              <div key={i} className={`tl-item ${kind === 'err' ? 'accent' : ''}`}>
                <div className="when">{stamp(when)}</div>
                <div className="what">{en}</div>
              </div>
            ))}
          </div>
          {!RUN_LOG.length ? (
            <p className="t-caption dim">{L('Nothing recorded yet.', 'لم يُسجَّل شيء بعد.')}</p>
          ) : null}
        </Panel>
        <Panel title={L('Run mode', 'نمط التشغيل')}>
          {WORKFLOWS.map(w => (
            <div key={w.id} className="listrow" style={{ paddingInline: 0 }}>
              <span className="grow">
                <b>{w.name}</b>
                <small>
                  {MODES[w.mode] || w.mode}
                  {w.modeReason ? ` — ${w.modeReason}` : ''}
                </small>
              </span>
              <button className="btn btn-secondary btn-dense" data-mode={w.id} onClick={() => setMode(w)}>
                {L('Change', 'تغيير')}
              </button>
            </div>
          ))}
        </Panel>
      </>
    );
  return (
    <>
      {head}
      <div className="stats">
        <Stat k={L('Workflows', 'المسارات')} v={WORKFLOWS.length} />
        <Stat k={L('Open tasks', 'مهام مفتوحة')} v={RUNS.length} />
        <Stat k={L('Paused', 'متوقفة')} v={RUNS.filter(r => r.status === 'Paused').length + late} />
      </div>
      <Paged className="gridcards">
        {WORKFLOWS.map(w => (
          <section key={w.id} className="panel" data-workflow={w.id}>
            <div className="panel-b">
              <div className="row" style={{ gap: '10px' }}>
                <b className="grow">{w.name}</b>
                {w.mode !== 'Open' ? <Pill label={MODES[w.mode]} tone="warning" /> : null}
                <span className={`badge ${w.open ? '' : 'badge-quiet'}`}>{w.open}</span>
              </div>
              <ol className="wfsteps">
                {w.steps.map((s, i) => (
                  <li key={i}>
                    <span className="n">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
              <div className="row" style={{ gap: '8px', marginTop: '12px' }}>
                <button
                  className="btn btn-primary btn-dense"
                  data-start={w.id}
                  disabled={w.mode !== 'Open'}
                  onClick={() => startRun(w)}
                >
                  {L('Start', 'بدء')}
                </button>
                <a className="btn btn-secondary btn-dense" href="#/forms/runs" onClick={() => (S.ui.runWf = w.id)}>
                  {L('Open tasks', 'المهام المفتوحة')}
                </a>
                <a className="btn btn-secondary btn-dense" href="#/forms/builder" onClick={() => (S.ui.formWf = w.id)}>
                  {L('Edit', 'تعديل')}
                </a>
              </div>
            </div>
          </section>
        ))}
      </Paged>
      {!WORKFLOWS.length ? (
        <Empty
          glyph="forms"
          title={L('No workflow yet', 'لا مسار بعد')}
          body={L(
            'Create the first one with New workflow. Listing workflows needs the workflow permission in this parish.',
            'أنشئ الأول بزر «مسار جديد». عرض المسارات يتطلب صلاحية المسارات في هذه الرعية.'
          )}
        />
      ) : null}
    </>
  );
}

export function forms(tab = '') {
  if (tab !== 'runs') S.ui.runWf = '';
  return <FormsPage tab={tab} />;
}
void t;
void Fields;
