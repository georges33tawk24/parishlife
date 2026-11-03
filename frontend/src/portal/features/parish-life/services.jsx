/* Services and activities: service plans with their items, requests for a service, and plan
   templates. */
import { Select } from '../../ui/components.jsx';
import { htmlAttrs, paint } from '../../ui/html.js';
import { t, isAr, fmtDate, fmtLong } from '../../../lib/i18n.js';
import { is, S } from '../../model/store.js';
import {
  Icon,
  PageHead,
  Panel,
  Who,
  Status,
  Pill,
  Table,
  Empty,
  openDrawer,
  openModal,
  closeOverlays,
  toast,
  Avatar,
  TabBar,
  Paged
} from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import {
  servicePlanNew,
  serviceTemplateDelete,
  serviceTemplateEdit,
  slides,
  svcRequestOpen
} from './services-dialogs.jsx';
import { meetingNew } from './groups-dialogs.jsx';
import { need } from '../../shared/dialogs.jsx';
import {
  allPlans,
  workingPlan,
  planDirty,
  savePlanDraft,
  normalizePlanOrder,
  planTotalMinutes
} from '../../model/planning.js';
import {
  PEOPLE,
  GROUPS,
  groupInfo,
  VENUES,
  SERVICE_REQUESTS,
  SERVICE_TEMPLATES,
  MUSIC,
  person,
  venue,
  group
} from '../../model/data.js';
import { addMin, meetingKind } from './parish-life-shared.jsx';

const L = (en, ar) => t(en, ar);

const STABS = () => [
  ['', 'This plan', 'هذه الخدمة'],
  ['requests', 'Requests', 'الطلبات', SERVICE_REQUESTS.filter(r => r.status === 'pending').length],
  ['templates', 'Templates', 'القوالب']
];

export function services(tab = '', planId = '') {
  if (is('leader')) {
    const meetings = GROUPS.flatMap(g => groupInfo(g.id).meetings.map(m => ({ g, m }))).sort((a, b) =>
      (a.m.d + a.m.t).localeCompare(b.m.d + b.m.t)
    );
    return (
      <>
        <PageHead
          crumbs={[{ label: L('My ministry', 'خدمتي') }, { label: L('Services & Activities', 'الخدمات والأنشطة') }]}
          title={L('Services & Activities', 'الخدمات والأنشطة')}
          sub={L(
            'Plan your group meetings and the music for each one.',
            'خطّط لاجتماعات مجموعتك والموسيقى لكل اجتماع.'
          )}
          actions={
            <button className="btn btn-primary" data-leader-meeting-new="" disabled={!GROUPS.length}>
              <Icon name="plus" size={17} />
              {L('Add meeting', 'إضافة اجتماع')}
            </button>
          }
        />
        <div className="toolbar" style={{ margin: '16px 0' }}>
          <span className="t-caption dim">
            {L(
              'Choose a group meeting to manage its details and attendance.',
              'اختر اجتماع مجموعة لإدارة التفاصيل والحضور.'
            )}
          </span>
        </div>{' '}
        {GROUPS.map(g => (
          <Panel title={L(g.name, g.ar)} tight={true}>
            <Table
              cols={[
                { label: L('Meeting', 'الاجتماع') },
                { label: L('When', 'الموعد') },
                { label: L('Type / place', 'النوع / المكان') },
                { label: L('Music', 'الموسيقى') },
                { label: '', cls: 'shrink' }
              ]}
              rows={meetings
                .filter(row => row.g.id === g.id)
                .map(({ m }) => ({
                  cells: [
                    <b>{m.title || L('Ministry meeting', 'اجتماع الخدمة')}</b>,
                    `${fmtDate(m.d)} · ${m.t}`,
                    `${meetingKind(m)}${m.place ? ` · ${m.place}` : ''}`,
                    (m.hymns || [])
                      .map(id => MUSIC.find(item => item.id === id))
                      .filter(Boolean)
                      .map(h => L(h.title, h.ar))
                      .join(', ') || '—',
                    <a className="btn btn-secondary btn-dense" href={`#/groups/${g.id}/meetings`}>
                      {L('Open meeting', 'افتح الاجتماع')}
                    </a>
                  ]
                }))}
            />
          </Panel>
        ))}{' '}
        {!meetings.length ? (
          <Empty
            glyph="calendar"
            title={L('No meetings yet', 'لا اجتماعات بعد')}
            body={L('Schedule one from your group page.', 'جدول اجتماعاً من صفحة مجموعتك.')}
          />
        ) : (
          ''
        )}
      </>
    );
  }
  const savedPlan = tab === 'plan' ? allPlans().find(p => p.id === planId) : null;
  if (tab === 'plan' && !savedPlan)
    return (
      <>
        <PageHead
          title={L('Plan not found', 'الخطة غير موجودة')}
          crumbs={[{ label: L('Services & Activities', 'الخدمات والأنشطة'), href: '#/services' }]}
        />
        <a className="btn btn-secondary" href="#/services">
          {L('All plans', 'كل الخطط')}
        </a>
      </>
    );
  const canEdit = is('priest', 'secretary');
  const plan = savedPlan ? (canEdit ? workingPlan(savedPlan.id) : savedPlan) : null;
  const cel = person(plan?.celebrant),
    coord = person(plan?.coordinator);
  const total = plan ? planTotalMinutes(plan) : 0;
  const head = (
    <>
      <PageHead
        crumbs={[
          { label: L('Parish life', 'حياة الرعية') },
          { label: L('Services & Activities', 'الخدمات والأنشطة'), href: tab === 'plan' ? '#/services' : undefined }
        ]}
        title={plan ? L(plan.title, plan.titleAr) : L('Services & Activities', 'الخدمات والأنشطة')}
        sub={
          !plan
            ? L(
                'Choose a plan to open, or create one from a reusable template. Ceremonies are separate from official registers.',
                'تُخطَّط الاحتفالات هنا؛ والسجل الرسمي يُنشأ منفصلاً في سجلات الأسرار'
              )
            : `${fmtLong(new Date(plan.date))} · ${L(venue(plan.venue)?.name || '', venue(plan.venue)?.ar || '')} ·
                ${L(plan.language, plan.languageAr)} · ${total} ${L('minutes', 'دقيقة')}`
        }
        actions={
          plan ? (
            <>
              <a className="btn btn-secondary" href="#/services">
                {L('All plans', 'كل الخطط')}
              </a>{' '}
              <button className="btn btn-secondary" id="slides">
                <Icon name="doc" size={17} />
                {L('Generate slides', 'توليد العرض')}
              </button>{' '}
              <button className="btn btn-secondary" data-act="print">
                <Icon name="print" size={17} />
                {L('Print order', 'طباعة الترتيب')}
              </button>{' '}
              {canEdit ? (
                <>
                  <button className="btn btn-secondary" data-plan-add="">
                    <Icon name="plus" size={17} />
                    {L('Add item', 'إضافة بند')}
                  </button>{' '}
                  <button className="btn btn-primary" data-plan-save="" disabled={!planDirty()}>
                    <Icon name="check" size={17} />
                    {L('Save plan', 'حفظ الخطة')}
                  </button>
                </>
              ) : (
                ''
              )}
            </>
          ) : canEdit ? (
            <button className="btn btn-primary" data-plan-new="">
              <Icon name="plus" size={17} />
              {L('New plan', 'خطة جديدة')}
            </button>
          ) : (
            ''
          )
        }
      />
      {plan ? '' : <TabBar base="services" items={STABS()} active={tab} />}
    </>
  );
  if (tab === '') {
    const f = S.ui.serviceFilter || {};
    const plans = allPlans().filter(
      p =>
        (!f.status || p.status === f.status) &&
        (!f.from || p.date >= f.from) &&
        (!f.to || p.date <= f.to) &&
        (!f.search ||
          `${p.title} ${p.titleAr} ${venue(p.venue)?.name || ''}`
            .toLocaleLowerCase()
            .includes(f.search.toLocaleLowerCase()))
    );
    return (
      <>
        {head}
        <div className="tabbody">
          <div className="toolbar" style={{ marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
            <label className="formrow" style={{ margin: 0, minWidth: '220px', flex: 1 }}>
              <span className="label">{L('Find a service', 'ابحث عن خدمة')}</span>
              <input
                className="input"
                data-service-filter="search"
                defaultValue={f.search || ''}
                placeholder={L('Name or place', 'الاسم أو المكان')}
              />
            </label>{' '}
            <label className="formrow" style={{ margin: 0 }}>
              <span className="label">{L('Status', 'الحالة')}</span>
              <Select data-service-filter="status">
                {[
                  ['', 'All statuses', 'كل الحالات'],
                  ['draft', 'Draft', 'مسودة'],
                  ['scheduled', 'Scheduled', 'مجدول'],
                  ['ready', 'Ready', 'جاهز'],
                  ['completed', 'Completed', 'منجز']
                ].map(([v, en, ar]) => (
                  <option value={v} selected={!!(f.status === v)}>
                    {L(en, ar)}
                  </option>
                ))}
              </Select>
            </label>{' '}
            <label className="formrow" style={{ margin: 0 }}>
              <span className="label">{L('From', 'من')}</span>
              <input className="input" type="date" data-service-filter="from" defaultValue={f.from || ''} />
            </label>{' '}
            <label className="formrow" style={{ margin: 0 }}>
              <span className="label">{L('Through', 'حتى')}</span>
              <input className="input" type="date" data-service-filter="to" defaultValue={f.to || ''} />
            </label>
          </div>{' '}
          <p className="t-caption dim" style={{ marginBottom: '10px' }}>
            {plans.length} {L('plans shown', 'خطط معروضة')}
          </p>
          <Table
            cols={[
              { label: L('Service', 'الخدمة') },
              { label: L('When', 'الموعد') },
              { label: L('Type / room', 'النوع / المكان') },
              { label: L('Status', 'الحالة') },
              { label: '', cls: 'shrink' }
            ]}
            rows={plans
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .map(p => ({
                cells: [
                  <b>{L(p.title, p.titleAr)}</b>,
                  <span className="mono">
                    {fmtDate(p.date)} {p.time || ''}
                  </span>,
                  `${L(venue(p.venue)?.name || '', venue(p.venue)?.ar || '')} · ${L(p.language, p.languageAr)}`,
                  <Status k={p.status || 'scheduled'} />,
                  <a className="btn btn-secondary btn-dense" href={`#/services/plan/${p.id}`}>
                    {L('Open plan', 'فتح الخطة')}
                  </a>
                ]
              }))}
          />
        </div>
      </>
    );
  }
  if (tab === 'requests')
    return (
      <>
        {head}
        <div className="tabbody">
          <Table
            cols={[
              { label: L('Ceremony', 'الاحتفال') },
              { label: L('Requested by', 'مقدَّم من') },
              { label: L('Date', 'التاريخ') },
              { label: L('Preparation', 'التحضير'), cls: 'hide-sm' },
              { label: L('Status', 'الحالة'), cls: 'shrink' },
              { label: '', cls: 'shrink' }
            ]}
            rows={SERVICE_REQUESTS.map(r => ({
              cells: [
                <b>{L(r.kind, r.kindAr)}</b>,
                <Who p={person(r.by)} />,
                <span className="mono dim">{fmtDate(r.date)}</span>,
                r.prep === 'complete' ? (
                  <Pill label={L('Complete', 'مكتمل')} tone="success" />
                ) : (
                  <Pill label={L(r.prep, r.prepAr || r.prep)} tone="warning" />
                ),
                <Status k={r.status} />,
                <button className="btn btn-secondary btn-dense" data-act={`svc-request:${r.id}`}>
                  {L('Open', 'فتح')}
                </button>
              ]
            }))}
          />{' '}
          <div className="tabbody">
            <Panel title={L('Request a ceremony', 'طلب احتفال')}>
              <Paged className="gridcards">
                {[
                  ['Mass', 'قدّاس', 'service'],
                  ['Wedding', 'إكليل', 'sacr'],
                  ['Baptism', 'معمودية', 'sacr'],
                  ['Funeral', 'جنّاز', 'sacr'],
                  ['Prayer meeting', 'لقاء صلاة', 'groups'],
                  ['Retreat', 'خلوة', 'events'],
                  ['Special celebration', 'احتفال خاص', 'events']
                ].map(([en, ar, ic]) => (
                  <button
                    className="card card-flat"
                    style={{ cursor: 'pointer', textAlign: 'start' }}
                    data-act={`svc-request-new:${en}|${ar}`}
                  >
                    <div className="row" style={{ gap: '10px' }}>
                      <Icon name={ic} size={19} cls="dimmer" />
                      <b style={{ font: '500 14px/20px var(--sans)' }}>{L(en, ar)}</b>
                    </div>
                  </button>
                ))}
              </Paged>
            </Panel>
          </div>
        </div>
      </>
    );
  if (tab === 'templates')
    return (
      <>
        {head}
        <div className="tabbody">
          <div className="toolbar" style={{ marginBottom: '12px' }}>
            <span className="t-caption dim">
              {L('Using a template creates an independent plan.', 'استعمال القالب ينشئ خطة مستقلة.')}
            </span>{' '}
            {canEdit ? (
              <button className="btn btn-primary btn-dense" data-service-template-new="">
                <Icon name="plus" size={15} />
                {L('New template', 'قالب جديد')}
              </button>
            ) : (
              ''
            )}
          </div>
          <Table
            cols={[
              { label: L('Template', 'القالب') },
              { label: L('Items', 'البنود'), cls: 'num' },
              { label: '', cls: 'shrink' }
            ]}
            rows={SERVICE_TEMPLATES.map(tpl => ({
              cells: [
                <b>{L(tpl.name, tpl.ar)}</b>,
                <span className="num">{tpl.order?.length || 0}</span>,
                <span className="row" style={{ gap: '6px', justifyContent: 'flex-end' }}>
                  {canEdit ? (
                    <>
                      <button className="btn btn-secondary btn-dense" data-act={`svc-tpl:${tpl.id}`}>
                        {L('Use', 'استعمال')}
                      </button>{' '}
                      <C.IconBtn
                        ico="edit"
                        label={L('Edit template', 'تعديل القالب')}
                        data-service-template-edit={tpl.id}
                      />{' '}
                      <C.IconBtn
                        ico="trash"
                        label={L('Delete template', 'حذف القالب')}
                        data-service-template-delete={tpl.id}
                      />
                    </>
                  ) : (
                    ''
                  )}
                </span>
              ]
            }))}
          />
        </div>
      </>
    );
  const rows = plan.order.map((o, oi) => {
    const a = o.who?.startsWith('g') ? group(o.who) : person(o.who);
    const aLabel = !a ? '' : a.lat ? (isAr() ? a.ar : a.lat) : L(a.name, a.ar);
    return (
      <div
        className="oos-row"
        data-service-row={oi}
        draggable={canEdit ? 'true' : undefined}
        style={{ padding: '14px 16px', minHeight: '70px', gap: '14px' }}
      >
        <span className="dur">
          {oi + 1}. {o.start || '—'} · {o.dur}'
        </span>{' '}
        <span className="body">
          <b>{o.t}</b>
          <span className="ar">{o.ar}</span>{' '}
          {o.note ? <span className="note">{L(o.note, o.noteAr || o.note)}</span> : ''}
        </span>{' '}
        <span className="who-s">
          {a && a.lat ? <Avatar p={a} cls="avatar-sm" /> : ''}
          <span className="t-caption dim">{aLabel}</span>{' '}
          {canEdit ? (
            <>
              {
                <C.IconBtn
                  ico="chevD"
                  label={L('Move up', 'نقل للأعلى')}
                  {...htmlAttrs(`data-svc-step="${oi}|-1" style="transform:rotate(180deg)" ${oi ? '' : 'disabled'}`)}
                />
              }{' '}
              {
                <C.IconBtn
                  ico="chevD"
                  label={L('Move down', 'نقل للأسفل')}
                  {...htmlAttrs(`data-svc-step="${oi}|1" ${oi < plan.order.length - 1 ? '' : 'disabled'}`)}
                />
              }{' '}
              {<C.IconBtn ico="edit" label={L('Edit item', 'تعديل البند')} data-plan-item={oi} />}
            </>
          ) : (
            ''
          )}
        </span>
      </div>
    );
  });
  return (
    <>
      {head}
      <div className="splitview">
        <div>
          {canEdit ? (
            <div className="row" style={{ gap: '8px', marginBottom: '10px' }}>
              <span className={`pill ${planDirty() ? 'pill-warning' : 'pill-success'}`} aria-live="polite">
                {planDirty()
                  ? L('Unsaved changes', 'تغييرات غير محفوظة')
                  : L('All changes saved', 'كل التغييرات محفوظة')}
              </span>{' '}
              <span className="t-caption dim">
                {L('Total planned duration', 'المدة الإجمالية للخطة')}: {total} {L('minutes', 'دقيقة')}
              </span>
            </div>
          ) : (
            ''
          )}{' '}
          <Panel
            title={L('Order of service', 'ترتيب الخدمة')}
            tight={true}
            more={
              canEdit ? (
                <button className="btn btn-ghost btn-dense" data-save-template="">
                  {L('Save as template', 'حفظ كقالب')}
                </button>
              ) : (
                ''
              )
            }
          >
            {rows || (
              <p className="t-caption dim">
                {L('No items yet. Add one or start from a template.', 'لا بنود بعد. أضف بنداً أو ابدأ من قالب.')}
              </p>
            )}
          </Panel>{' '}
          {canEdit ? (
            <p className="t-caption dim" style={{ marginTop: '6px' }}>
              {L(
                'Items follow their scheduled times. Drag or use the arrow buttons to change the order; then choose Save plan.',
                'تتبع البنود أوقاتها المحدّدة. اسحب أو استخدم الأسهم لتغيير الترتيب، ثم اختر حفظ الخطة.'
              )}
            </p>
          ) : (
            ''
          )}
        </div>{' '}
        <div className="sidecol">
          <Panel
            title={L('Details', 'التفاصيل')}
            more={
              <>
                {canEdit ? (
                  <button className="btn btn-ghost btn-dense" data-plan-edit="">
                    {L('Edit details', 'تعديل التفاصيل')}
                  </button>
                ) : (
                  ''
                )}
                <a href="#/volunteers">{L('Open rota', 'افتح المناوبات')}</a>
              </>
            }
            tight={true}
          >
            <dl className="dl">
              <dt>{L('Date and time', 'التاريخ والوقت')}</dt>
              <dd>
                {fmtDate(plan.date)} {plan.time || ''}
              </dd>
              <dt>{L('Venue', 'المكان')}</dt>
              <dd>{L(venue(plan.venue)?.name || '—', venue(plan.venue)?.ar || '—')}</dd>
              <dt>{L('Celebrant', 'المحتفل')}</dt>
              <dd>{cel ? (isAr() ? cel.ar : cel.lat) : '—'}</dd>
              <dt>{L('Coordinator', 'المنسّقة')}</dt>
              <dd>{coord ? (isAr() ? coord.ar : coord.lat) : '—'}</dd>
              <dt>{L('Language', 'اللغة')}</dt>
              <dd>{L(plan.language, plan.languageAr)}</dd>
              <dt>{L('Status', 'الحالة')}</dt>
              <dd>
                <Status k={plan.status || 'scheduled'} />
              </dd>
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}

services.mount = host => {
  if (S.params[0] === 'requests' && S.params[1] && !is('leader')) svcRequestOpen(decodeURIComponent(S.params[1]));
  host.querySelectorAll('[data-service-filter]').forEach(input =>
    input.addEventListener(input.type === 'text' ? 'input' : 'change', () => {
      const key = input.dataset.serviceFilter,
        value = input.value,
        pos = input.selectionStart;
      S.ui.serviceFilter = { ...(S.ui.serviceFilter || {}), [key]: value };
      paint(host, services(''));
      services.mount(host);
      if (input.type === 'text') {
        const replacement = host.querySelector(`[data-service-filter="${key}"]`);
        replacement?.focus();
        replacement?.setSelectionRange(pos, pos);
      }
    })
  );
  if (is('leader')) {
    host.querySelector('[data-leader-meeting-new]')?.addEventListener('click', () => {
      if (GROUPS.length === 1) return meetingNew(GROUPS[0].id);
      openModal({
        title: L('Choose ministry', 'اختر الخدمة'),
        body: (
          <Paged className="gridcards">
            {GROUPS.map(g => (
              <button
                className="panel card-link"
                style={{ cursor: 'pointer', textAlign: 'start', padding: '18px' }}
                data-leader-group={g.id}
              >
                <b>{L(g.name, g.ar)}</b>
              </button>
            ))}
          </Paged>
        ),
        foot: (
          <button className="btn btn-secondary" data-close="">
            {L('Cancel', 'إلغاء')}
          </button>
        ),
        onMount(el) {
          el.querySelectorAll('[data-leader-group]').forEach(button =>
            button.addEventListener('click', () => {
              closeOverlays();
              meetingNew(button.dataset.leaderGroup);
            })
          );
        }
      });
    });
    return;
  }
  const redraw = () => {
    if (S.route === 'services' && S.params[0] === 'plan') {
      paint(host, services(...S.params));
      services.mount(host);
    }
  };
  host.querySelector('[data-plan-new]')?.addEventListener('click', () => servicePlanNew());
  host.querySelector('[data-plan-edit]')?.addEventListener('click', () => editPlanDetails(redraw));
  host.querySelector('[data-plan-add]')?.addEventListener('click', () => editPlanItem(-1, redraw));
  host
    .querySelectorAll('[data-plan-item]')
    .forEach(b => b.addEventListener('click', () => editPlanItem(Number(b.dataset.planItem), redraw)));
  host.querySelector('[data-plan-save]')?.addEventListener('click', async () => {
    const button = host.querySelector('[data-plan-save]');
    if (button) button.disabled = true;
    if (await savePlanDraft()) {
      redraw();
      toast(L('Plan saved', 'حُفظت الخطة'), '', 'success');
    } else {
      if (button) button.disabled = false;
      toast(
        L('Plan was not saved', 'لم تُحفظ الخطة'),
        L('Check the save error and retry.', 'تحقّق من خطأ الحفظ وأعد المحاولة.'),
        'danger'
      );
    }
  });
  host.querySelector('[data-save-template]')?.addEventListener('click', () => {
    if (planDirty())
      return toast(
        L('Save the plan first', 'احفظ الخطة أولاً'),
        L('The template will use the saved order.', 'سيستخدم القالب الترتيب المحفوظ.'),
        'warning'
      );
    serviceTemplateEdit('', true);
  });
  host.querySelector('[data-service-template-new]')?.addEventListener('click', () => serviceTemplateEdit());
  host
    .querySelectorAll('[data-service-template-edit]')
    .forEach(b => b.addEventListener('click', () => serviceTemplateEdit(b.dataset.serviceTemplateEdit)));
  host
    .querySelectorAll('[data-service-template-delete]')
    .forEach(b => b.addEventListener('click', () => serviceTemplateDelete(b.dataset.serviceTemplateDelete)));
  host.querySelectorAll('[data-svc-step]').forEach(b =>
    b.addEventListener('click', () => {
      const [i, delta] = b.dataset.svcStep.split('|').map(Number),
        order = workingPlan(S.params[1]).order,
        j = i + delta;
      if (j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      normalizePlanOrder(workingPlan(S.params[1]), 'reflow');
      redraw();
      host.querySelector(`[data-svc-step="${j}|${delta}"]`)?.focus();
    })
  );
  let dragged = -1;
  host.querySelectorAll('[data-service-row]').forEach(row => {
    row.addEventListener('dragstart', e => {
      dragged = Number(row.dataset.serviceRow);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(dragged));
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    row.addEventListener('drop', e => {
      e.preventDefault();
      const to = Number(row.dataset.serviceRow),
        order = workingPlan(S.params[1]).order;
      if (dragged < 0 || dragged === to || !order[dragged]) return;
      order.splice(to, 0, ...order.splice(dragged, 1));
      dragged = -1;
      normalizePlanOrder(workingPlan(S.params[1]), 'reflow');
      redraw();
    });
    row.addEventListener('dragend', () => {
      dragged = -1;
    });
  });
  host.querySelector('#slides')?.addEventListener('click', () => {
    if (planDirty())
      return toast(
        L('Save the plan first', 'احفظ الخطة أولاً'),
        L('Slides use the saved order.', 'تستخدم الشرائح الترتيب المحفوظ.'),
        'warning'
      );
    slides();
  });
};

function editPlanDetails(redraw) {
  const plan = workingPlan(S.params[1]);
  if (!plan) return;
  openDrawer({
    title: L('Edit plan details', 'تعديل تفاصيل الخطة'),
    body: (
      <>
        <div className="formgrid">
          <C.Field label={L('Service name', 'اسم الخدمة')} id="pd_title" req={true} value={plan.title} />{' '}
          <C.Field label={L('Arabic name', 'الاسم العربي')} id="pd_ar" value={plan.titleAr} />
        </div>{' '}
        <div className="formgrid">
          <C.Field label={L('Date', 'التاريخ')} id="pd_date" type="date" value={plan.date} />{' '}
          <C.Field label={L('Start time', 'وقت البدء')} id="pd_time" type="time" value={plan.time || '09:00'} />
        </div>{' '}
        <div className="formrow">
          <label className="label" htmlFor="pd_venue">
            {L('Venue', 'المكان')}
          </label>
          <Select id="pd_venue">
            {VENUES.map(v => (
              <option value={v.id} selected={!!(v.id === plan.venue)}>
                {L(v.name, v.ar)}
              </option>
            ))}
          </Select>
        </div>{' '}
        <div className="formrow">
          <label className="label" htmlFor="pd_status">
            {L('Status', 'الحالة')}
          </label>
          <Select id="pd_status">
            {[
              ['draft', 'Draft', 'مسودة'],
              ['scheduled', 'Scheduled', 'مجدول'],
              ['ready', 'Ready', 'جاهز'],
              ['completed', 'Completed', 'منجز']
            ].map(([v, en, ar]) => (
              <option value={v} selected={!!(v === plan.status)}>
                {L(en, ar)}
              </option>
            ))}
          </Select>
        </div>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="pd_stage">
          {L('Apply changes', 'تطبيق التغييرات')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#pd_stage').addEventListener('click', () => {
        if (
          !need(el, '#pd_title', L('Name the plan', 'سمّ الخطة')) ||
          !need(el, '#pd_date', L('Choose a date', 'اختر التاريخ'))
        )
          return;
        const oldTime = plan.time;
        Object.assign(plan, {
          title: el.querySelector('#pd_title').value.trim(),
          titleAr: el.querySelector('#pd_ar').value.trim() || el.querySelector('#pd_title').value.trim(),
          date: el.querySelector('#pd_date').value,
          time: el.querySelector('#pd_time').value,
          venue: el.querySelector('#pd_venue').value,
          status: el.querySelector('#pd_status').value
        });
        if (plan.time !== oldTime) normalizePlanOrder(plan, 'reflow');
        closeOverlays();
        redraw();
      });
    }
  });
}

function editPlanItem(index, redraw) {
  const plan = workingPlan(S.params[1]);
  if (!plan) return;
  const item = index >= 0 ? plan.order[index] : null;
  const last = plan.order.at(-1),
    after = last ? addMin(last.start || plan.time || '09:00', Number(last.dur) || 1) : plan.time || '09:00';
  openDrawer({
    title: item ? L('Edit service item', 'تعديل بند الخدمة') : L('Add service item', 'إضافة بند للخدمة'),
    body: (
      <>
        <div className="formgrid">
          <C.Field label={L('English item', 'البند بالإنكليزية')} id="pi_title" req={true} value={item?.t || ''} />{' '}
          <C.Field label={L('Arabic item', 'البند بالعربية')} id="pi_ar" value={item?.ar || ''} />
        </div>{' '}
        <div className="formgrid">
          <C.Field
            label={L('Scheduled time', 'الوقت المحدّد')}
            id="pi_start"
            type="time"
            value={item?.start || after}
          />{' '}
          <C.Field label={L('Duration (minutes)', 'المدة (دقائق)')} id="pi_dur" type="number" value={item?.dur || 3} />
        </div>{' '}
        <div className="formrow">
          <label className="label" htmlFor="pi_who">
            {L('Led by', 'يقوده')}
          </label>
          <Select id="pi_who">
            <option value="">{L('Unassigned', 'غير محدّد')}</option>
            {[...GROUPS.map(g => [g.id, L(g.name, g.ar)]), ...personOptions()].map(([id, name]) => (
              <option value={id} selected={!!(id === item?.who)}>
                {name}
              </option>
            ))}
          </Select>
        </div>{' '}
        <C.Field label={L('Instructions', 'تعليمات')} id="pi_note" value={item?.note || ''} />
      </>
    ),
    foot: (
      <>
        {item ? (
          <button className="btn btn-danger-quiet" id="pi_delete">
            {L('Remove item', 'إزالة البند')}
          </button>
        ) : (
          ''
        )}{' '}
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="pi_stage">
          {L('Apply changes', 'تطبيق التغييرات')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#pi_stage').addEventListener('click', () => {
        if (
          !need(el, '#pi_title', L('Name the item', 'سمّ البند')) ||
          !need(el, '#pi_dur', L('Enter a positive duration', 'أدخل مدة موجبة'), v => Number(v) > 0)
        )
          return;
        const t = el.querySelector('#pi_title').value.trim(),
          note = el.querySelector('#pi_note').value.trim();
        const fields = {
          t,
          ar: el.querySelector('#pi_ar').value.trim() || t,
          start: el.querySelector('#pi_start').value,
          dur: String(Number(el.querySelector('#pi_dur').value)),
          who: el.querySelector('#pi_who').value,
          note,
          noteAr: item?.note === note ? item.noteAr || note : note
        };
        if (item) Object.assign(item, fields);
        else plan.order.push(fields);
        normalizePlanOrder(plan, 'sort');
        closeOverlays();
        redraw();
      });
      el.querySelector('#pi_delete')?.addEventListener('click', () => {
        plan.order.splice(index, 1);
        normalizePlanOrder(plan, 'sort');
        closeOverlays();
        redraw();
      });
    }
  });
}

function personOptions() {
  return PEOPLE.filter(p => p.status !== 'visitor').map(p => [p.id, L(p.lat, p.ar)]);
}
