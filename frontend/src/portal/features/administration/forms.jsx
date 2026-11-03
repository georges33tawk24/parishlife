/* Forms and workflows: request workflows with their steps, open tasks, the form builder and the
   activity log. */
import { nodesOr, css } from '../../ui/html.js';
import { t, isAr, fmtDate } from '../../../lib/i18n.js';
import { S } from '../../model/store.js';
import { Icon, PageHead, Panel, Who, Pill, Table, Empty, Stat, openDrawer, TabBar, Paged } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as CR from '../../shared/record-editor.jsx';
import { WORKFLOWS, RUNS, RUN_LOG, FORM_FIELDS, FORM_RULES, person } from '../../model/data.js';
import { FIELD_TYPES } from '../../shared/record-editor.jsx';

const L = (en, ar) => t(en, ar);

const WTABS = () => [
  ['', 'Workflows', 'المسارات'],
  ['runs', 'Open tasks', 'المهام المفتوحة', RUNS.length],
  ['builder', 'Form builder', 'بناء الاستمارة'],
  ['log', 'Activity log', 'سجل النشاط']
];

const wfSteps = w => (w && (isAr() ? w.stepsAr : w.steps)) || w?.steps || [];

const nameIn = p => (p ? L(p.lat, p.ar || p.lat) : '');

const RULE_OPS = { '=': ['is', 'هو'], '≠': ['is not', 'ليس'] };

export function forms(tab = '') {
  if (tab !== 'runs') S.ui.runWf = ''; // the queue filter belongs to the visit that set it
  const head = (
    <>
      <PageHead
        crumbs={[{ label: L('Administration', 'الإدارة') }, { label: L('Forms & workflows', 'الاستمارات والمسارات') }]}
        title={L('Forms and workflows', 'الاستمارات ومسارات العمل')}
        sub={L(
          'Each request moves through set steps. Every step has a person responsible and a due date, so nothing is forgotten.',
          'يمرّ كل طلب بخطوات محدّدة، ولكل خطوة شخص مسؤول وموعد، فلا يُنسى شيء.'
        )}
        actions={
          <>
            {tab === 'builder' ? (
              ''
            ) : (
              <button className="btn btn-secondary" data-go="forms/builder">
                <Icon name="doc" size={17} />
                {L('Form templates', 'قوالب الاستمارات')}
              </button>
            )}{' '}
            <button className="btn btn-primary" data-act="wf-new">
              <Icon name="plus" size={17} />
              {L('New workflow', 'مسار جديد')}
            </button>
          </>
        }
      />
      <TabBar base="forms" items={WTABS()} active={tab} />
    </>
  );
  if (tab === 'runs') {
    const only = WORKFLOWS.find(w => w.id === S.ui.runWf),
      runs = RUNS.filter(r => WORKFLOWS.some(w => w.id === r.wf) && (!only || r.wf === only.id));
    const late = runs.filter(r => r.overdue).length;
    return (
      <>
        {head}
        {only ? (
          <div className="toolbar" style={{ marginBottom: '14px' }}>
            <span className="chip chip-on" style={{ gap: '6px' }}>
              <Icon name="filter" size={14} />
              {L(only.name, only.ar)}
            </span>{' '}
            <span className="t-caption dim">
              {runs.length} {L('open', 'مفتوحة')}
            </span>{' '}
            <button className="btn btn-ghost btn-dense" data-act="wf-queue:">
              {L('Show every workflow', 'عرض كل المسارات')}
            </button>
          </div>
        ) : (
          ''
        )}{' '}
        {
          <Table
            cols={[
              { label: L('Workflow', 'المسار'), sort: true },
              { label: L('For', 'لـ') },
              { label: L('Current step', 'الخطوة الحالية') },
              { label: L('Responsible', 'المسؤول'), cls: 'hide-sm' },
              { label: L('Due', 'الموعد'), sort: true },
              { label: '', cls: 'shrink' }
            ]}
            rows={runs.map(r => {
              const w = WORKFLOWS.find(x => x.id === r.wf),
                steps = wfSteps(w);
              return {
                cls: 'clickable',
                attrs: `data-run="${r.id}" tabindex="0"`,
                cells: [
                  <b>{L(w.name, w.ar)}</b>,
                  r.subject ? (
                    <Who p={person(r.subject)} />
                  ) : (
                    <span className="dim">{L('Parish expense', 'مصروف الرعية')}</span>
                  ),
                  <span style={{ display: 'block', minWidth: '150px' }}>
                    <b style={{ fontWeight: 500 }}>{steps[r.step] || ''}</b>{' '}
                    <span className="t-caption dim tnum" style={{ display: 'block' }}>
                      {L(
                        `Step ${Math.min(r.step + 1, r.total)} of ${r.total}`,
                        `الخطوة ${Math.min(r.step + 1, r.total)} من ${r.total}`
                      )}
                    </span>{' '}
                    <span className="meter" style={{ marginTop: '6px' }}>
                      <i style={css(`width:${Math.round((r.step / r.total) * 100)}%`)} />
                    </span>
                  </span>,
                  <Who p={person(r.owner)} />,
                  r.overdue ? (
                    <Pill label={`${fmtDate(r.due)} · ${L('late', 'متأخرة')}`} tone="danger" />
                  ) : (
                    <span className="mono dim">{fmtDate(r.due)}</span>
                  ),
                  <span className="btn btn-secondary btn-dense" aria-hidden="true">
                    {L('Open', 'فتح')}
                  </span>
                ]
              };
            })}
            empty={
              <Empty
                glyph="check"
                title={L('No open tasks', 'لا مهام مفتوحة')}
                body={
                  only
                    ? L('Nothing is waiting in this workflow.', 'لا شيء ينتظر في هذا المسار.')
                    : L('Every request has been dealt with.', 'عولجت كل الطلبات.')
                }
              />
            }
          />
        }{' '}
        {late ? (
          <C.InlineAlert
            tone="warning"
            title={
              late === 1
                ? L('One task is late', 'مهمّة واحدة متأخرة')
                : L(`${late} tasks are late`, `${late} مهام متأخرة`)
            }
            body={L(
              'The person responsible is reminded. Nothing is ever decided automatically.',
              'يُذكَّر الشخص المسؤول. ولا يُتّخذ أي قرار تلقائياً.'
            )}
          />
        ) : (
          ''
        )}
      </>
    );
  }
  if (tab === 'builder')
    return (
      <>
        {head}
        <div className="splitview">
          <div>
            <Panel title={L('Certificate request form', 'استمارة طلب شهادة')}>
              {nodesOr(
                FORM_FIELDS.map(f => (
                  <div className="listrow" style={{ paddingInline: 0, alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--text-3)', marginTop: '2px' }}>
                      <Icon
                        name={
                          f.type === 'file'
                            ? 'doc'
                            : f.type === 'person'
                              ? 'people'
                              : f.type === 'date'
                                ? 'events'
                                : 'forms'
                        }
                        size={17}
                      />
                    </span>{' '}
                    <span className="grow">
                      <b>
                        {L(f.label, f.labelAr)}
                        {f.req ? <span style={{ color: 'var(--danger)' }}>*</span> : ''}
                      </b>{' '}
                      {f.note ? <small style={{ whiteSpace: 'normal' }}>{L(f.note, f.noteAr)}</small> : ''}
                    </span>{' '}
                    <span className="chip">{L(...(FIELD_TYPES[f.type] || [f.type, f.type]))}</span>
                    {CR.recBtn('field', f.id, L('Field options', 'خيارات الحقل'))}
                  </div>
                )),
                <p className="t-caption dim">{L('No fields yet — add the first one.', 'لا حقول بعد — أضف الأول.')}</p>
              )}{' '}
              <button className="btn btn-secondary btn-dense" style={{ marginTop: '14px' }} data-act="dom-add-field">
                <Icon name="plus" size={15} />
                {L('Add field', 'إضافة حقل')}
              </button>{' '}
              <p className="t-caption dim" style={{ marginTop: '12px' }}>
                {L(
                  'Fields marked * must be filled in before the request can be sent.',
                  'يجب ملء الحقول المعلَّمة بـ* قبل إرسال الطلب.'
                )}
              </p>
            </Panel>
          </div>{' '}
          <div className="sidecol">
            <Panel title={L('Show a field only when…', 'أظهر الحقل فقط حين…')}>
              {nodesOr(
                FORM_RULES.map(r => {
                  const a = FORM_FIELDS.find(f => f.id === r.show),
                    b = FORM_FIELDS.find(f => f.id === r.when);
                  return (
                    <div className="rulecard">
                      <span className="grow">
                        {L('Show', 'أظهر')} <b>{a ? L(a.label, a.labelAr) : '—'}</b> {L('only when', 'فقط حين يكون')}{' '}
                        <b>{b ? L(b.label, b.labelAr) : '—'}</b> {L(...(RULE_OPS[r.op] || [r.op, r.op]))}{' '}
                        <b>{L(r.value, r.valueAr)}</b>
                      </span>{' '}
                      <C.IconBtn ico="close" label={L('Remove rule', 'إزالة القاعدة')} data-act={`rule-del:${r.id}`} />
                    </div>
                  );
                }),
                <p className="t-caption dim">
                  {L('No rules — every field always shows.', 'لا قواعد — كل الحقول تظهر دائماً.')}
                </p>
              )}{' '}
              <button className="btn btn-secondary btn-dense" style={{ marginTop: '4px' }} data-act="dom-add-rule">
                <Icon name="plus" size={15} />
                {L('Add rule', 'إضافة قاعدة')}
              </button>
            </Panel>{' '}
            <Panel title={L('Checks before sending', 'تحقّق قبل الإرسال')}>
              <div className="stack" style={{ gap: '10px' }}>
                <C.CheckRow label={L('Required fields must be filled', 'الحقول المطلوبة إلزامية')} checked={true} />{' '}
                <C.CheckRow label={L('Attachments limited to 10 MB', 'المرفقات حتى ١٠ ميغابايت')} checked={true} />{' '}
                <C.CheckRow
                  label={L('Refuse the same request twice within 7 days', 'رفض الطلب نفسه مرّتين خلال ٧ أيام')}
                  checked={true}
                />
              </div>
            </Panel>
          </div>
        </div>
      </>
    );
  if (tab === 'log')
    return (
      <>
        {head}
        <Panel title={L('What happened, newest first', 'ما جرى، الأحدث أولاً')}>
          <div className="timeline">
            {RUN_LOG.map(([when, en, ar, kind]) => (
              <div className={`tl-item ${kind === 'err' ? 'accent' : ''}`}>
                <div className="when">{stampText(when)}</div>{' '}
                <div className="what">
                  {L(en, ar)}
                  {kind === 'err' && /retry|محاولة/i.test(en + ar) ? (
                    <>{<Pill label={L('Retried', 'أُعيدت')} tone="warning" />}</>
                  ) : (
                    ''
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>{' '}
        <div className="grid g2">
          <Panel title={L('Pause or resume a workflow', 'إيقاف مسار أو استئنافه')}>
            {WORKFLOWS.map(w => (
              <div className="listrow" style={{ paddingInline: 0 }}>
                <span className="grow">
                  <b>{L(w.name, w.ar)}</b>
                  <small>
                    {w.paused
                      ? L('Paused — no new requests start', 'متوقّف — لا تبدأ طلبات جديدة')
                      : L('Running', 'يعمل')}
                  </small>
                </span>{' '}
                <button className="btn btn-secondary btn-dense" data-act={`wf-pause:${w.id}`}>
                  {w.paused ? L('Resume', 'استئناف') : L('Pause', 'إيقاف مؤقّت')}
                </button>
              </div>
            ))}{' '}
            <div className="row" style={{ gap: '8px', marginTop: '14px' }}>
              <button className="btn btn-secondary btn-dense" data-act="wf-retry">
                {L('Retry messages that failed', 'إعادة إرسال الرسائل الفاشلة')}
              </button>
            </div>{' '}
            <p className="t-caption dim" style={{ marginTop: '12px' }}>
              {L(
                'Retrying never sends a message twice: anything already delivered is skipped.',
                'إعادة المحاولة لا تُرسل رسالة مرّتين: ما وصل سابقاً يُتخطّى.'
              )}
            </p>
          </Panel>{' '}
          <Panel title={L('When something goes wrong', 'حين يتعطّل شيء')}>
            <dl className="dl">
              <dt>{L('A message fails', 'فشل رسالة')}</dt>
              <dd>
                {L('Tried again up to 3 times, a little later each time', 'تُعاد حتى ٣ مرّات، بفاصل أطول كل مرّة')}
              </dd>
              <dt>{L('It still fails', 'إن استمرّ الفشل')}</dt>
              <dd>{L('The workflow stops and tells the person responsible', 'يتوقّف المسار ويُبلغ المسؤول')}</dd>
              <dt>{L('Sensitive steps', 'الخطوات الحسّاسة')}</dt>
              <dd>{L('Always wait for a person', 'تنتظر شخصاً دائماً')}</dd>
            </dl>
          </Panel>
        </div>
      </>
    );
  const cards = WORKFLOWS.map(w => {
    const steps = wfSteps(w),
      open = RUNS.filter(r => r.wf === w.id).length;
    return (
      <section className="panel">
        <div className="panel-b">
          <div className="row" style={{ gap: '10px', alignItems: 'flex-start' }}>
            <span className="avatar avatar-lg">
              <Icon name="forms" size={20} />
            </span>{' '}
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block', font: '600 16px/22px var(--sans)' }}>{L(w.name, w.ar)}</b>{' '}
              <small className="t-caption dim">
                {L('usually takes', 'يستغرق عادةً')} {L(w.avg, w.avgAr)}
              </small>
            </div>{' '}
            {w.paused ? <Pill label={L('Paused', 'متوقّف')} tone="warning" mark="st-pause" /> : ''}
            <span className={`badge ${open ? '' : 'badge-quiet'}`} title={L('Open tasks', 'مهام مفتوحة')}>
              {open}
            </span>
            {CR.recBtn('workflow', w.id)}
          </div>{' '}
          <div className="divider" />{' '}
          <ol className="wfsteps">
            {steps.map((st, i) => (
              <li>
                <span className="n">{i + 1}</span>
                {st}
              </li>
            ))}
          </ol>{' '}
          <button
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: '14px', minHeight: '34px', fontSize: '13px' }}
            data-act={`wf-queue:${w.id}`}
          >
            {open
              ? L(`See ${open} open task${open === 1 ? '' : 's'}`, `عرض المهام المفتوحة (${open})`)
              : L('No open tasks', 'لا مهام مفتوحة')}
          </button>
        </div>
      </section>
    );
  });
  const late = RUNS.filter(r => r.overdue),
    lateW = late[0] && WORKFLOWS.find(w => w.id === late[0].wf);
  return (
    <>
      {head}
      <div className="stats">
        <Stat
          k={L('Open tasks', 'مهام مفتوحة')}
          v={RUNS.length}
          d={L(`in ${new Set(RUNS.map(r => r.wf)).size} workflows`, `في ${new Set(RUNS.map(r => r.wf)).size} مسارات`)}
        />{' '}
        <Stat
          k={L('Late', 'متأخرة')}
          v={late.length}
          d={
            late.length ? (
              <span className="down">
                {L(lateW?.name || '', lateW?.ar || '')} · {fmtDate(late[0].due)}
              </span>
            ) : (
              L('nothing is late', 'لا شيء متأخر')
            )
          }
        />{' '}
        <Stat
          k={L('Finished this month', 'أُنجزت هذا الشهر')}
          v={27}
          d={L('usually within 2 days', 'عادةً خلال يومين')}
        />{' '}
        <Stat
          k={L('Automatic steps', 'خطوات تلقائية')}
          v={4}
          d={L('a person always checks the result', 'يراجع شخصٌ النتيجة دائماً')}
        />
      </div>{' '}
      <Paged className="gridcards">{cards}</Paged>{' '}
      <C.InlineAlert
        tone="info"
        title={L('Sensitive decisions always stop for a person', 'القرارات الحسّاسة تتوقّف دائماً عند شخص')}
        body={L(
          'Pastoral, safeguarding, financial and disciplinary steps are never completed automatically, however routine they look. Automation may prepare the work; it never decides it.',
          'لا تُنجَز الخطوات الرعوية والحمائية والمالية والتأديبية تلقائياً مهما بدت روتينية. للأتمتة أن تُحضّر العمل لا أن تقرّره.'
        )}
      />
    </>
  );
}

/* One open task: its steps, who is responsible, and the next action. Also reopened after
   "Keep the task" in the cancel confirmation. */
/* "2026-10-04 11:02" as people read it: 4 Oct 2026 · 11:02 */
const stampText = v =>
  `${fmtDate(String(v).slice(0, 10))}${String(v).length > 10 ? ` · ${String(v).slice(11, 16)}` : ''}`;

export function openRun(id) {
  const r = RUNS.find(x => x.id === id),
    w = r && WORKFLOWS.find(x => x.id === r.wf);
  if (!w) return;
  const steps = wfSteps(w),
    owner = person(r.owner);
  openDrawer({
    title: L(w.name, w.ar),
    sub: r.subject ? nameIn(person(r.subject)) : L('Parish expense', 'مصروف الرعية'),
    body: (
      <>
        <ol className="runsteps">
          {steps.map((st, i) => (
            <li className={i < r.step ? 'done' : i === r.step ? 'now' : ''}>
              <span className="dot" aria-hidden="true">
                {i < r.step ? <Icon name="check" size={13} /> : i + 1}
              </span>{' '}
              <span className="grow">
                <b>{st}</b>
                <small>
                  {i < r.step
                    ? `${L('Done', 'أُنجزت')}${r.doneAt?.[i] ? ` · ${stampText(r.doneAt[i])}` : ''}`
                    : i === r.step
                      ? `${L('Current step', 'الخطوة الحالية')}${r.doneAt?.[i - 1] ? ` · ${L('waiting since', 'بانتظار منذ')} ${stampText(r.doneAt[i - 1])}` : ''}`
                      : L('Still to come', 'لاحقاً')}
                </small>
              </span>
            </li>
          ))}
        </ol>{' '}
        <div className="divider" />{' '}
        <dl className="dl">
          <dt>{L('Responsible', 'المسؤول')}</dt>
          <dd>{nameIn(owner) || '—'}</dd>
          <dt>{L('Due', 'الموعد')}</dt>
          <dd>
            {fmtDate(r.due)}
            {r.overdue ? (
              <>
                {' '}
                · <span style={{ color: 'var(--danger-ink)', fontWeight: 600 }}>{L('late', 'متأخرة')}</span>
              </>
            ) : (
              ''
            )}
          </dd>
          <dt>{L('If it runs late', 'إن تأخّرت')}</dt>
          <dd>{L('Fr. Antoine Khoury is reminded after 2 days', 'يُذكَّر الأب أنطوان خوري بعد يومين')}</dd>
        </dl>{' '}
        <div style={{ marginTop: '18px' }}>
          <C.Textarea
            label={L('Note for the next person (optional)', 'ملاحظة لمن يتابع (اختياري)')}
            id="runnote"
            max={300}
          />
        </div>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>{' '}
        <button className="btn btn-danger-quiet" data-act={`wf-cancel:${r.id}`}>
          {L('Cancel task', 'إلغاء المهمّة')}
        </button>{' '}
        <button
          className="btn btn-primary"
          id="run_go"
          style={{ marginInlineStart: 'auto' }}
          data-act={`run-step:${r.id}`}
        >
          <Icon name="check" size={16} />
          {r.step + 1 >= r.total ? L('Finish task', 'إنهاء المهمّة') : L('Mark step done', 'إنجاز الخطوة')}
        </button>
      </>
    ),
    onMount(el) {
      /* start on the steps, not in the note: on a phone, focusing the note would scroll past them and
         open the keyboard. Focus rests on the dialog itself, so no key press completes a step by accident. */
      el.querySelector('.drawer-body').scrollTop = 0;
      el.tabIndex = -1;
      el.focus({ preventScroll: true });
    }
  });
}

forms.mount = host => {
  host.querySelectorAll('tr[data-run]').forEach(tr => {
    tr.addEventListener('click', () => openRun(tr.dataset.run));
    tr.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openRun(tr.dataset.run);
      }
    });
  });
};
