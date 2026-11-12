/* Service-plan dialogs: adding and arranging items, plans and templates, service requests, and
   slides for the screen. */
import { useLayoutEffect, useRef, useState } from 'react';
import { Select } from '../../ui/components.jsx';
import { markup } from '../../ui/html.js';
import { t, fmtDate } from '../../../lib/i18n.js';
import { go, me, is } from '../../model/store.js';
import { Icon, toast, openDrawer, openModal, closeOverlays, Status } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as D from '../../model/data.js';
import { currentPlan, copyOrder, allPlans, normalizePlanOrder } from '../../model/planning.js';
import { download } from '../../shell/actions.jsx';
import { hydrate, persist } from '../../model/persist.js';
import { planAction } from '../../model/modules/calendar.js';
import { requestRequirements, RequestDocuments } from '../records/request-documents.jsx';
import { nameOf, ok, refresh, val } from '../../shared/dialog-helpers.jsx';
import { need } from '../../shared/dialogs.jsx';

const L = (en, ar) => t(en, ar);

export function slides() {
  const plan = currentPlan();
  const file = `${
    plan.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'service'
  }-slides.html`;
  const deck = plan.order.map((o, i) => (
    <section key={i} className="s">
      <div className="k">
        {i + 1} / {plan.order.length}
      </div>{' '}
      <h2>{o.t}</h2>
    </section>
  ));
  download(
    file,
    `<!doctype html><html><head><meta charset="utf-8"><title>Slides</title>
    <style>body{margin:0;font-family:Inter,system-ui,sans-serif;background:#233B32}
    .s{height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;
      color:#FFFFFF;border-bottom:1px solid #233B32;page-break-after:always;padding:0 8vw}
    .k{color:#EDF0E8;font:500 14px ui-monospace,monospace;letter-spacing:.1em}
    h2{font-size:5vw;margin:.4em 0 .2em;font-weight:600}.ar{font-size:4vw;color:#EDF0E8;margin:0}</style></head>
    <body><section class="s"><div class="k">${D.PARISH.name.toUpperCase()}</div><h2>${plan.title}</h2></section>${markup(deck)}</body></html>`,
    'text/html'
  );
  closeOverlays();
  ok(L('Slides generated', 'تمّ توليد الشرائح'), `${plan.order.length + 1} ${L('slides', 'شريحة')}`);
}

export function svcTemplateUse(i) {
  const tpl = D.SERVICE_TEMPLATES.find(x => x.id === i);
  if (!tpl) return;
  servicePlanNew(tpl.id);
}

/* A plan belongs to an event, so it is made for one of the calendar's upcoming events. */
export function servicePlanNew(templateId = '') {
  const today = new Date().toLocaleDateString('sv-SE');
  const taken = new Set(allPlans().map(p => p.eventId));
  const events = D.EVENTS.filter(e => !e.redacted && e.status !== 'Cancelled' && e.d >= today && !taken.has(e.id));
  const templates = D.SERVICE_TEMPLATES.filter(x => x.apiStatus === 'Approved');
  const first = templates.find(x => x.id === templateId);
  if (!events.length)
    return toast(
      L('No event to plan', 'لا حدث للتخطيط'),
      L(
        'Create the event on the calendar first; a plan is made for one of its events.',
        'أنشئ الحدث في الرزنامة أولاً؛ الخطة تُعدّ لأحد أحداثها.'
      ),
      'warning'
    );
  openDrawer({
    title: L('New service plan', 'خطة خدمة جديدة'),
    sub: L(
      'Choose the event and, if you like, an approved template. The new plan is independent of its template.',
      'اختر الحدث وقالباً معتمداً إن شئت. الخطة الجديدة مستقلة عن قالبها.'
    ),
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="sp_event">
            {L('Event', 'الحدث')}
          </label>
          <Select id="sp_event">
            {events.map((e, i) => (
              <option key={i} value={e.id}>
                {e.title} · {fmtDate(e.d)} {e.t}
              </option>
            ))}
          </Select>
        </div>{' '}
        <C.Field label={L('Service name', 'اسم الخدمة')} req={true} id="sp_name" value={events[0].title} />{' '}
        <div className="formgrid">
          <div className="formrow">
            <label className="label" htmlFor="sp_type">
              {L('Type', 'النوع')}
            </label>
            <Select id="sp_type">
              <option value="Liturgy">{L('Liturgy', 'ليتورجيا')}</option>
              <option value="Activity">{L('Activity', 'نشاط')}</option>
            </Select>
          </div>{' '}
          <div className="formrow">
            <label className="label" htmlFor="sp_template">
              {L('Start from template', 'ابدأ من قالب')}
            </label>{' '}
            <Select defaultValue={first?.id || ''} id="sp_template">
              <option value="">{L('Blank plan', 'خطة فارغة')}</option>
              {templates.map((x, i) => (
                <option key={i} value={x.id}>
                  {x.name} · {x.order.length} {L('items', 'بنود')}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="sp_save">
          {L('Create plan', 'إنشاء الخطة')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#sp_event').addEventListener('change', () => {
        el.querySelector('#sp_name').value = events.find(e => e.id === val(el, '#sp_event'))?.title || '';
      });
      el.querySelector('#sp_save').addEventListener('click', async () => {
        if (!need(el, '#sp_name', L('Name the service', 'سمّ الخدمة'))) return;
        const event = events.find(e => e.id === val(el, '#sp_event')),
          name = val(el, '#sp_name');
        const plan = {
          id: 'new-' + Date.now().toString(36),
          eventId: event.id,
          title: name,
          titleAr: name,
          date: event.d,
          time: event.t,
          planType: val(el, '#sp_type'),
          templateId: val(el, '#sp_template') || null, // the API copies the template's items into a plan with none
          celebrantAccountId: null,
          status: 'draft',
          order: []
        };
        D.SERVICE_PLANS.push(plan);
        el.querySelector('#sp_save').disabled = true;
        if (!(await persist())) {
          el.querySelector('#sp_save').disabled = false;
          return;
        }
        closeOverlays();
        refresh();
        const made = allPlans().find(p => p.eventId === event.id);
        if (made) go(`services/plan/${made.id}`);
        ok(L('Plan created', 'أُنشئت الخطة'), `${name} · ${fmtDate(event.d)}`);
      });
    }
  });
}

/* One line of a template's order of service. Its fields keep their own text; Save reads them back. */
function TemplateRow({ item, rowKey, onMove, onRemove }) {
  return (
    <div
      className="card card-flat"
      data-st-row=""
      data-st-key={rowKey}
      style={{ padding: '10px', marginBottom: '8px' }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
        <input
          className="input"
          data-st-dur=""
          type="number"
          min="1"
          defaultValue={item.dur || '3'}
          aria-label={L('Minutes', 'الدقائق')}
          title={L('Minutes', 'الدقائق')}
          style={{ width: '70px', flex: 'none' }}
        />{' '}
        <input
          className="input"
          data-st-title=""
          defaultValue={item.t || ''}
          placeholder={L('Item name', 'اسم البند')}
          aria-label={L('Item name', 'اسم البند')}
          style={{ minWidth: '140px', flex: '1 1 140px' }}
        />{' '}
      </div>{' '}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginTop: '7px', alignItems: 'center' }}>
        <input
          className="input"
          data-st-role=""
          defaultValue={item.role || ''}
          placeholder={L('Role (optional)', 'الدور (اختياري)')}
          aria-label={L('Responsible role', 'الدور المسؤول')}
          style={{ minWidth: '140px', flex: '1 1 140px' }}
        />{' '}
        <input
          className="input"
          data-st-note=""
          defaultValue={item.note || ''}
          placeholder={L('Instruction (optional)', 'تعليمات (اختياري)')}
          aria-label={L('Instruction', 'تعليمات')}
          style={{ minWidth: '140px', flex: '1 1 140px' }}
        />{' '}
        <span className="row" style={{ gap: '2px' }}>
          <C.IconBtn
            ico="chevD"
            label={L('Move up', 'نقل للأعلى')}
            data-st-move="-1"
            style={{ transform: 'rotate(180deg)' }}
            onClick={() => onMove(-1)}
          />{' '}
          <C.IconBtn ico="chevD" label={L('Move down', 'نقل للأسفل')} data-st-move="1" onClick={() => onMove(1)} />{' '}
          <C.IconBtn ico="trash" label={L('Remove item', 'إزالة البند')} data-st-remove="" onClick={onRemove} />
        </span>
      </div>
    </div>
  );
}

/* The order of service: items are added, moved and removed here; focus follows the item it acted on. */
function TemplateItems({ order }) {
  const [rows, setRows] = useState(() => order.map((item, key) => ({ key, item })));
  const nextKey = useRef(order.length),
    box = useRef(null),
    focusNext = useRef('');
  useLayoutEffect(() => {
    const target = focusNext.current ? box.current.querySelector(focusNext.current) : null;
    focusNext.current = '';
    target?.focus();
  });
  const add = () => {
    const key = nextKey.current++;
    focusNext.current = `[data-st-key="${key}"] [data-st-title]`;
    setRows(list => [...list, { key, item: {} }]);
  };
  const move = (key, by) => {
    const from = rows.findIndex(r => r.key === key),
      to = from + by;
    if (to < 0 || to >= rows.length) return;
    focusNext.current = `[data-st-key="${key}"] [data-st-move="${by}"]`;
    const copy = [...rows];
    [copy[from], copy[to]] = [copy[to], copy[from]];
    setRows(copy);
  };
  const remove = key => {
    focusNext.current = '#st_add';
    setRows(list => list.filter(r => r.key !== key));
  };
  return (
    <div ref={box}>
      <div className="row" style={{ justifyContent: 'space-between', margin: '12px 0 8px' }}>
        <b>{L('Order of service', 'ترتيب الخدمة')}</b>{' '}
        <button className="btn btn-secondary btn-dense" id="st_add" onClick={add}>
          <Icon name="plus" size={15} />
          {L('Add item', 'إضافة بند')}
        </button>
      </div>{' '}
      <div id="st_items">
        {rows.map(({ key, item }) => (
          <TemplateRow key={key} rowKey={key} item={item} onMove={by => move(key, by)} onRemove={() => remove(key)} />
        ))}
      </div>
    </div>
  );
}

export function serviceTemplateEdit(id = '', fromPlan = false) {
  const source = fromPlan ? currentPlan() : D.SERVICE_TEMPLATES.find(x => x.id === id);
  if (source && !fromPlan && source.apiStatus && !['Draft', 'Returned'].includes(source.apiStatus))
    return toast(
      L('This template can no longer be edited', 'لا يمكن تعديل هذا القالب بعد الآن'),
      L(
        'Only a draft or returned template can change. Start a new one instead.',
        'يمكن تعديل المسودة أو المُعادة فقط. ابدأ قالباً جديداً.'
      ),
      'warning'
    );
  openDrawer({
    large: true,
    title:
      source && !fromPlan
        ? L('Edit service template', 'تعديل قالب الخدمة')
        : L('New service template', 'قالب خدمة جديد'),
    sub: L(
      'Set the order once, with no people or fixed times. A template is approved before plans can start from it.',
      'اضبط الترتيب مرة واحدة، بلا أشخاص أو أوقات ثابتة. يُعتمد القالب قبل أن تبدأ الخطط منه.'
    ),
    body: (
      <>
        <C.Field
          label={L('Template name', 'اسم القالب')}
          req={true}
          id="st_name"
          value={source?.name || source?.title || ''}
        />{' '}
        <TemplateItems order={source?.order || []} />
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>
        <button className="btn btn-primary" id="st_save">
          {L('Save template', 'حفظ القالب')}
        </button>
      </>
    ),
    onMount(el) {
      const items = el.querySelector('#st_items');
      el.querySelector('#st_save').addEventListener('click', async () => {
        if (!need(el, '#st_name', L('Name the template', 'سمّ القالب'))) return;
        const order = [];
        for (const row of items.querySelectorAll('[data-st-row]')) {
          const dur = Number(row.querySelector('[data-st-dur]').value),
            t = row.querySelector('[data-st-title]').value.trim(),
            role = row.querySelector('[data-st-role]').value.trim(),
            note = row.querySelector('[data-st-note]').value.trim();
          if (!t || !Number.isFinite(dur) || dur <= 0) {
            row.querySelector(!t ? '[data-st-title]' : '[data-st-dur]').focus();
            toast(L('Each item needs a name and minutes', 'كل بند يحتاج اسماً ودقائق'), '', 'warning');
            return;
          }
          const kept = source?.order?.find(o => o.t === t);
          order.push({
            key: kept?.key || '',
            dur: String(dur),
            t,
            ar: '',
            role,
            note,
            noteAr: '',
            who: null,
            audience: kept?.audience || 'Clergy',
            required: !!kept?.required,
            musicId: kept?.musicId || null
          });
        }
        const name = val(el, '#st_name');
        if (source && !fromPlan) Object.assign(source, { name, ar: name, order });
        else
          D.SERVICE_TEMPLATES.push({
            id: 'new-' + Date.now().toString(36),
            name,
            ar: name,
            planType: 'Liturgy',
            status: 'draft',
            order
          });
        el.querySelector('#st_save').disabled = true;
        if (!(await persist())) {
          el.querySelector('#st_save').disabled = false;
          return;
        }
        closeOverlays();
        refresh();
        ok(L('Template saved', 'حُفظ القالب'));
      });
    }
  });
}

/* A reason is asked for before a plan is returned or cancelled; the other steps need none. */
function askReason(title, then) {
  openModal({
    title,
    body: <C.Textarea label={L('Reason', 'السبب')} id="pr_reason" max={400} />,
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Back', 'رجوع')}
        </button>
        <button className="btn btn-primary" id="pr_ok" style={{ marginInlineStart: 'auto' }}>
          {L('Continue', 'متابعة')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#pr_ok').addEventListener('click', () => {
        const reason = val(el, '#pr_reason');
        if (!reason) return toast(L('Give a reason', 'اذكر السبب'), '', 'warning');
        then(reason);
      });
    }
  });
}

async function runStep(plan, action, reason) {
  try {
    await planAction(plan, action, reason);
    closeOverlays();
    await hydrate();
    refresh();
    ok(L('Plan updated', 'حُدّثت الخطة'));
  } catch (error) {
    toast(L('That did not work', 'لم تنجح العملية'), error.message, 'warning');
  }
}

/* submit, approve, return, complete or cancel: a call to the API and a reload, never an edit to the list. */
export function planStep(plan, action) {
  if (!plan) return;
  if (action === 'return' || action === 'cancel')
    return askReason(
      action === 'return' ? L('Return this plan', 'إعادة الخطة') : L('Cancel this plan', 'إلغاء الخطة'),
      reason => runStep(plan, action, reason)
    );
  runStep(plan, action);
}
export function templateStep(id, action) {
  planStep(
    D.SERVICE_TEMPLATES.find(x => x.id === id),
    action
  );
}

/* A template cannot be deleted in the API; it is cancelled, with the reason recorded. */
export function serviceTemplateDelete(id) {
  const tpl = D.SERVICE_TEMPLATES.find(x => x.id === id);
  if (!tpl) return;
  planStep(tpl, 'cancel');
}

export function addToService(mid) {
  const m = D.MUSIC.find(x => x.id === mid);
  if (!m) return;
  const leader = is('leader');
  const targets = leader
    ? D.GROUPS.flatMap(g =>
        D.groupInfo(g.id).meetings.map(meeting => ({
          id: `${g.id}|${meeting.id}`,
          label: `${D.group(g.id)?.name || g.id} · ${meeting.d} ${meeting.t} · ${meeting.title || 'Meeting'}`
        }))
      )
    : allPlans()
        .filter(plan => ['Draft', 'Returned'].includes(plan.apiStatus))
        .map(plan => ({ id: plan.id, label: `${plan.title} · ${plan.date} ${plan.time || ''}` }));
  if (!targets.length) return toast(L('Schedule a meeting first', 'جدول اجتماعاً أولاً'), '', 'warning');
  openModal({
    title: L('Choose where to add this hymn', 'اختر الخدمة لإضافة الترنيمة'),
    sub: L(m.title, m.ar),
    body: (
      <div className="formrow">
        <label className="label" htmlFor="music_target">
          {L('Service or meeting', 'الخدمة أو الاجتماع')}
        </label>{' '}
        <Select id="music_target">
          <option value="">{L('Choose one', 'اختر واحدة')}</option>
          {targets.map((target, i) => (
            <option key={i} value={target.id}>
              {target.label}
            </option>
          ))}
        </Select>
      </div>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="music_add">
          {L('Add hymn', 'إضافة الترنيمة')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#music_add').addEventListener('click', async () => {
        const selected = el.querySelector('#music_target').value;
        if (!selected) return toast(L('Choose a service or meeting', 'اختر خدمة أو اجتماعاً'), '', 'warning');
        if (leader) {
          const [gid, meetingId] = selected.split('|'),
            meeting = D.groupInfo(gid).meetings.find(x => x.id === meetingId);
          if (!meeting) return;
          meeting.hymns ||= [];
          if (meeting.hymns.includes(mid))
            return toast(L('Hymn already added', 'الترنيمة مضافة مسبقاً'), '', 'warning');
          meeting.hymns.push(mid);
        } else {
          const plan = allPlans().find(x => x.id === selected);
          if (!plan) return;
          if (plan.order.some(o => o.musicId === mid))
            return toast(L('Hymn already added', 'الترنيمة مضافة مسبقاً'), '', 'warning');
          plan.order.push({
            t: `Hymn — ${m.title}`,
            ar: '',
            dur: '4',
            start: '',
            note: m.key ? `Key: ${m.key}` : '',
            noteAr: '',
            who: null,
            assignedAccountId: null,
            role: '',
            audience: 'Team',
            required: false,
            musicId: mid
          });
          normalizePlanOrder(plan, 'reflow');
          if (!(await persist())) return;
        }
        closeOverlays();
        refresh();
        ok(L('Hymn added', 'أُضيفت الترنيمة'), L(m.title, m.ar));
      });
    }
  });
}

export function svcRequestOpen(id) {
  const r = D.SERVICE_REQUESTS.find(x => x.id === id);
  if (!r) return;
  const reqs = requestRequirements(r);
  const stage = r.stage || (r.status === 'pending' ? 'request' : r.status === 'approved' ? 'preparation' : r.status);
  const stageLabel =
    {
      request: L('Request', 'طلب'),
      approval: L('Approved', 'موافَق عليه'),
      preparation: L('Preparation', 'تحضير'),
      celebration: L('Celebrated', 'احتُفل به'),
      rejected: L('Declined', 'مرفوض')
    }[stage] || stage;
  const canAdvance = is('priest') && !['celebrated', 'rejected'].includes(r.status);
  openDrawer({
    title: L(r.kind, r.kindAr),
    sub: `${nameOf(D.person(r.by))} · ${fmtDate(r.date)}`,
    body: (
      <>
        <dl className="dl">
          <dt>{L('Status', 'الحالة')}</dt>
          <dd>
            <Status k={r.status} />
          </dd>
          <dt>{L('Requested by', 'مقدَّم من')}</dt>
          <dd>{nameOf(D.person(r.by))}</dd>
          <dt>{L('Preferred date and time', 'التاريخ والوقت المفضّلان')}</dt>
          <dd className="mono">
            {fmtDate(r.date)} {r.time || ''}
          </dd>
          <dt>{L('Place', 'المكان')}</dt>
          <dd>{D.venue(r.venue)?.name || r.place || '—'}</dd>
          <dt>{L('Contact', 'التواصل')}</dt>
          <dd>{r.contact || '—'}</dd>
          <dt>{L('Purpose / intention', 'الغاية / النيّة')}</dt>
          <dd>{r.purpose || '—'}</dd>
          <dt>{L('Language', 'اللغة')}</dt>
          <dd>{r.language || '—'}</dd>
          <dt>{L('Notes', 'ملاحظات')}</dt>
          <dd>{r.notes || '—'}</dd>
          {r.celebratedAt ? (
            <>
              <dt>{L('Celebrated on', 'تاريخ الاحتفال')}</dt>
              <dd>{fmtDate(r.celebratedAt)}</dd>
            </>
          ) : (
            ''
          )}
        </dl>{' '}
        <div className="divider" />
        <h4 className="t-ui" style={{ marginBottom: '10px' }}>
          {L('Progress', 'التقدّم')}
        </h4>{' '}
        <p className="t-caption dim">
          {L('Request → priest approval → preparation → celebration', 'طلب ← موافقة الكاهن ← تحضير ← احتفال')}
        </p>{' '}
        <p className="t-caption">
          {L('Current stage', 'المرحلة الحالية')}: <b>{stageLabel}</b>
        </p>{' '}
        <RequestDocuments
          record={r}
          scope="service-request"
          onChange={() => {
            closeOverlays();
            svcRequestOpen(id);
          }}
        />{' '}
        {r.status === 'ready' ? (
          <C.Field
            label={L('Actual celebration date', 'تاريخ الاحتفال الفعلي')}
            id="sr_actual"
            type="date"
            value={new Date().toLocaleDateString('sv-SE')}
          />
        ) : (
          ''
        )}{' '}
        {r.status === 'celebrated' ? (
          <C.InlineAlert
            tone="success"
            title={L('Celebration recorded', 'سُجّل الاحتفال')}
            body={L(
              'This service request does not create an official sacramental register entry.',
              'لا ينشئ طلب الخدمة هذا قيداً رسمياً في سجل الأسرار.'
            )}
          />
        ) : (
          ''
        )}
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Close', 'إغلاق')}
        </button>{' '}
        {r.status === 'pending' && is('priest') ? (
          <button className="btn btn-secondary" id="srreject">
            {L('Decline', 'رفض')}
          </button>
        ) : (
          ''
        )}{' '}
        {canAdvance ? (
          <button className="btn btn-primary" id="srok" style={{ marginInlineStart: 'auto' }}>
            {r.status === 'pending'
              ? L('Approve request', 'الموافقة على الطلب')
              : r.status === 'approved'
                ? L('Start preparation', 'بدء التحضير')
                : r.status === 'preparing'
                  ? L('Mark ready', 'جاهز للاحتفال')
                  : L('Record celebration', 'تسجيل الاحتفال')}
          </button>
        ) : (
          ''
        )}
      </>
    ),
    onMount(el) {
      el.querySelector('#srok')?.addEventListener('click', async () => {
        if (
          ['preparing', 'ready'].includes(r.status) &&
          reqs.some(([en, , required]) => required && !r.documents?.[en])
        )
          return toast(L('Complete the missing requirements first', 'أكمل المتطلبات الناقصة أولاً'), '', 'warning');
        const next = { pending: 'approved', approved: 'preparing', preparing: 'ready', ready: 'celebrated' }[r.status];
        if (!next) return;
        if (next === 'celebrated') {
          const actual = val(el, '#sr_actual'),
            todayKey = new Date().toLocaleDateString('sv-SE');
          if (!actual || actual > todayKey)
            return toast(
              L('Enter the actual date, today or earlier', 'أدخل التاريخ الفعلي، اليوم أو قبله'),
              '',
              'warning'
            );
          r.celebratedAt = actual;
        }
        r.status = next;
        r.stage =
          next === 'approved' ? 'approval' : next === 'preparing' || next === 'ready' ? 'preparation' : 'celebration';
        r.history ||= [];
        r.history.push({ at: new Date().toISOString(), status: next, by: me()?.id || null });
        if (!(await persist())) return;
        closeOverlays();
        refresh();
        ok(L('Request updated', 'حُدّث الطلب'), L(r.kind, r.kindAr));
      });
      el.querySelector('#srreject')?.addEventListener('click', async () => {
        r.status = 'rejected';
        r.stage = 'rejected';
        r.history ||= [];
        r.history.push({ at: new Date().toISOString(), status: 'rejected', by: me()?.id || null });
        if (!(await persist())) return;
        closeOverlays();
        refresh();
        ok(L('Request declined', 'رُفض الطلب'));
      });
    }
  });
}

export function svcRequestNew(kind = 'Mass|قدّاس') {
  const [en, ar] = kind.split('|');
  openDrawer({
    title: L(`Request — ${en}`, `طلب — ${ar}`),
    body: (
      <>
        <div className="formrow">
          <label className="label" htmlFor="sq_p">
            {L('Requested by', 'مقدَّم من')}
          </label>
          <Select id="sq_p">
            <option value="">{L('Choose a person', 'اختر شخصاً')}</option>
            {D.PEOPLE.map((p, i) => (
              <option key={i} value={p.id}>
                {L(p.lat, p.ar)}
              </option>
            ))}
          </Select>
        </div>{' '}
        <div className="formgrid">
          <C.Field label={L('Preferred date', 'التاريخ المفضّل')} type="date" id="sq_d" />{' '}
          <C.Field label={L('Preferred time', 'الوقت المفضّل')} type="time" id="sq_t" />
        </div>{' '}
        <div className="formrow">
          <label className="label" htmlFor="sq_v">
            {L('Preferred place', 'المكان المفضّل')}
          </label>
          <Select id="sq_v">
            <option value="">{L('To be arranged', 'يُحدّد لاحقاً')}</option>
            {D.VENUES.map((v, i) => (
              <option key={i} value={v.id}>
                {L(v.name, v.ar)}
              </option>
            ))}
          </Select>
        </div>{' '}
        <C.Field label={L('Contact phone or email', 'رقم الهاتف أو البريد')} id="sq_c" req={true} max={160} />{' '}
        <C.Field label={L('Purpose or intention', 'الغاية أو النيّة')} id="sq_i" req={true} max={240} />{' '}
        <div className="formrow">
          <label className="label" htmlFor="sq_l">
            {L('Language', 'اللغة')}
          </label>
          <Select id="sq_l">
            <option value="Arabic">{L('Arabic', 'عربي')}</option>
            <option value="Arabic & Syriac">{L('Arabic & Syriac', 'عربي وسرياني')}</option>
            <option value="Bilingual">{L('Bilingual', 'ثنائي')}</option>
          </Select>
        </div>{' '}
        <C.Textarea label={L('Notes for the office', 'ملاحظات للمكتب')} id="sq_n" max={1000} />{' '}
        {['baptism', 'wedding'].includes(en.toLowerCase()) ? (
          <p className="help">
            {L(
              'A service request plans the ceremony. Submit the sacramental request separately for the official register.',
              'طلب الخدمة يخطّط للاحتفال. قدّم طلب السرّ منفصلاً للسجل الرسمي.'
            )}
          </p>
        ) : (
          ''
        )}
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Cancel', 'إلغاء')}
        </button>{' '}
        <button className="btn btn-primary" id="sq_go" style={{ marginInlineStart: 'auto' }}>
          {L('Send request', 'إرسال الطلب')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#sq_go').addEventListener('click', async () => {
        if (
          !need(el, '#sq_p', L('Choose the requester', 'اختر مقدّم الطلب')) ||
          !need(el, '#sq_d', L('Choose a date', 'اختر تاريخاً')) ||
          !need(el, '#sq_t', L('Choose a time', 'اختر وقتاً')) ||
          !need(el, '#sq_c', L('Add contact details', 'أضف معلومات التواصل')) ||
          !need(el, '#sq_i', L('Describe the purpose', 'اشرح الغاية'))
        )
          return;
        D.SERVICE_REQUESTS.unshift({
          id: 'sr' + Date.now(),
          kind: en,
          kindAr: ar,
          by: val(el, '#sq_p'),
          date: val(el, '#sq_d'),
          time: val(el, '#sq_t'),
          venue: val(el, '#sq_v'),
          contact: val(el, '#sq_c'),
          purpose: val(el, '#sq_i'),
          language: val(el, '#sq_l'),
          notes: val(el, '#sq_n'),
          documents: {},
          paperDocuments: {},
          ...(requestRequirements({ kind: en }).some(([, , required]) => required)
            ? { prep: 'documents missing', prepAr: 'مستندات ناقصة' }
            : { prep: 'complete' }),
          status: 'pending',
          stage: 'request',
          history: []
        });
        if (!(await persist())) return;
        closeOverlays();
        refresh();
        ok(L('Request sent', 'أُرسل الطلب'), L(`${en} · awaiting priest review`, `${ar} · بانتظار مراجعة الكاهن`));
      });
    }
  });
}
