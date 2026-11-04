/* Service-plan dialogs: adding and arranging items, plans and templates, service requests, and
   slides for the screen. */
import { Fragment } from 'react';
import { Select } from '../../ui/components.jsx';
import { markup } from '../../ui/html.js';
import { t, fmtDate } from '../../../lib/i18n.js';
import { go, me, is } from '../../model/store.js';
import { Icon, toast, openDrawer, openModal, closeOverlays, Status } from '../../ui/ui.jsx';
import * as C from '../../ui/components.jsx';
import * as D from '../../model/data.js';
import { currentPlan, copyOrder, allPlans, normalizePlanOrder } from '../../model/planning.js';
import { download } from '../../shell/actions.jsx';
import { persist } from '../../model/persist.js';
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
      <p className="ar">{o.ar}</p>
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
    <body><section class="s"><div class="k">${D.PARISH.name.toUpperCase()}</div><h2>${L(plan.title, plan.titleAr)}</h2>
    <p class="ar">${D.PARISH.nameAr}</p></section>${markup(deck)}</body></html>`,
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

export function servicePlanNew(templateId = '') {
  const first = D.SERVICE_TEMPLATES.find(x => x.id === templateId);
  openDrawer({
    title: L('New service plan', 'خطة خدمة جديدة'),
    sub: L(
      'Choose a date and optional template. The new plan is independent of its template.',
      'اختر التاريخ وقالباً اختيارياً. الخطة الجديدة مستقلة عن قالبها.'
    ),
    body: (
      <>
        <div className="formgrid">
          <C.Field label={L('Service name', 'اسم الخدمة')} req={true} id="sp_name" value={first?.name || ''} />{' '}
          <C.Field label={L('Arabic name', 'الاسم العربي')} id="sp_ar" value={first?.ar || ''} />
        </div>{' '}
        <div className="formgrid">
          <C.Field
            label={L('Date', 'التاريخ')}
            type="date"
            req={true}
            id="sp_date"
            value={new Date().toISOString().slice(0, 10)}
          />{' '}
          <C.Field label={L('Time', 'الوقت')} type="time" id="sp_time" value="10:30" />
        </div>{' '}
        <div className="formrow">
          <label className="label" htmlFor="sp_template">
            {L('Start from template', 'ابدأ من قالب')}
          </label>{' '}
          <Select defaultValue={templateId} id="sp_template">
            <option value="">{L('Blank plan', 'خطة فارغة')}</option>
            {D.SERVICE_TEMPLATES.map((x, i) => (
              <option key={i} value={x.id}>
                {L(x.name, x.ar)} · {x.order.length} {L('items', 'بنود')}
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
        <button className="btn btn-primary" id="sp_save">
          {L('Create plan', 'إنشاء الخطة')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#sp_template').addEventListener('change', () => {
        const tpl = D.SERVICE_TEMPLATES.find(x => x.id === val(el, '#sp_template'));
        if (tpl) {
          el.querySelector('#sp_name').value = tpl.name;
          el.querySelector('#sp_ar').value = tpl.ar;
        }
      });
      el.querySelector('#sp_save').addEventListener('click', () => {
        if (
          !need(el, '#sp_name', L('Name the service', 'سمّ الخدمة')) ||
          !need(el, '#sp_date', L('Choose a date', 'اختر التاريخ'))
        )
          return;
        const tpl = D.SERVICE_TEMPLATES.find(x => x.id === val(el, '#sp_template'));
        const name = val(el, '#sp_name');
        const plan = {
          id: 'sp' + Date.now().toString(36),
          title: name,
          titleAr: val(el, '#sp_ar') || name,
          date: val(el, '#sp_date'),
          time: val(el, '#sp_time') || '10:30',
          venue: tpl?.venue || 'v1',
          celebrant: tpl?.celebrant || 'p17',
          coordinator: tpl?.coordinator || 'p4',
          language: tpl?.language || 'Arabic & Syriac',
          languageAr: tpl?.languageAr || 'عربي وسرياني',
          status: 'draft',
          order: copyOrder(tpl?.order)
        };
        D.SERVICE_PLANS.push(plan);
        closeOverlays();
        refresh();
        go(`services/plan/${plan.id}`);
        ok(L('Plan created', 'أُنشئت الخطة'), `${name} · ${fmtDate(plan.date)}`);
      });
    }
  });
}

function serviceTemplateRow(item = {}) {
  const leaders = [...D.PEOPLE.map(p => [p.id, L(p.lat, p.ar)]), ...D.GROUPS.map(g => [g.id, L(g.name, g.ar)])];
  return (
    <div
      className="card card-flat"
      data-st-row=""
      data-note-ar={item.noteAr || ''}
      data-original-note={item.note || ''}
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
          aria-label={L('Item name in English', 'اسم البند بالإنكليزية')}
          style={{ minWidth: '140px', flex: '1 1 140px' }}
        />{' '}
        <input
          className="input"
          data-st-ar=""
          defaultValue={item.ar || ''}
          placeholder={L('Arabic name', 'الاسم العربي')}
          dir="rtl"
          aria-label={L('Item name in Arabic', 'اسم البند بالعربية')}
          style={{ minWidth: '140px', flex: '1 1 140px' }}
        />
      </div>{' '}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginTop: '7px', alignItems: 'center' }}>
        <Select
          defaultValue={item.who}
          data-st-who=""
          aria-label={L('Led by', 'يقوده')}
          style={{ minWidth: '140px', flex: '1 1 140px' }}
        >
          <option value="">{L('Unassigned', 'غير محدّد')}</option>
          {leaders.map(([v, label], i) => (
            <option key={i} value={v}>
              {label}
            </option>
          ))}
        </Select>{' '}
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
          />{' '}
          <C.IconBtn ico="chevD" label={L('Move down', 'نقل للأسفل')} data-st-move="1" />{' '}
          <C.IconBtn ico="trash" label={L('Remove item', 'إزالة البند')} data-st-remove="" />
        </span>
      </div>
    </div>
  );
}

export function serviceTemplateEdit(id = '', fromPlan = false) {
  const source = fromPlan ? currentPlan() : D.SERVICE_TEMPLATES.find(x => x.id === id);
  openDrawer({
    large: true,
    title:
      source && !fromPlan
        ? L('Edit service template', 'تعديل قالب الخدمة')
        : L('New service template', 'قالب خدمة جديد'),
    sub: L(
      'Set the defaults and order once. Existing plans stay independent.',
      'اضبط القيم والترتيب مرة واحدة. تبقى الخطط الموجودة مستقلة.'
    ),
    body: (
      <>
        <div className="formgrid">
          <C.Field
            label={L('Template name', 'اسم القالب')}
            req={true}
            id="st_name"
            value={source?.name || source?.title || ''}
          />{' '}
          <C.Field label={L('Arabic name', 'الاسم العربي')} id="st_ar" value={source?.ar || source?.titleAr || ''} />
        </div>{' '}
        <div className="formgrid">
          <div className="formrow">
            <label className="label" htmlFor="st_venue">
              {L('Default venue', 'المكان الافتراضي')}
            </label>
            <Select defaultValue={source?.venue || 'v1'} id="st_venue">
              {D.VENUES.map((v, i) => (
                <option key={i} value={v.id}>
                  {L(v.name, v.ar)}
                </option>
              ))}
            </Select>
          </div>{' '}
          <div className="formrow">
            <label className="label" htmlFor="st_lang">
              {L('Language', 'اللغة')}
            </label>
            <Select defaultValue={source?.language} id="st_lang">
              {[
                ['Arabic & Syriac', 'عربي وسرياني'],
                ['Bilingual', 'ثنائي اللغة'],
                ['English', 'إنكليزي']
              ].map(([en, ar], i) => (
                <option key={i} value={en}>
                  {L(en, ar)}
                </option>
              ))}
            </Select>
          </div>
        </div>{' '}
        <div className="row" style={{ justifyContent: 'space-between', margin: '12px 0 8px' }}>
          <b>{L('Order of service', 'ترتيب الخدمة')}</b>{' '}
          <button className="btn btn-secondary btn-dense" id="st_add">
            <Icon name="plus" size={15} />
            {L('Add item', 'إضافة بند')}
          </button>
        </div>{' '}
        <div id="st_items">
          {(source?.order || []).map((item, i, all) => (
            <Fragment key={i}>{serviceTemplateRow(item, i, all)}</Fragment>
          ))}
        </div>
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
      el.querySelector('#st_add').addEventListener('click', () => {
        items.insertAdjacentHTML('beforeend', serviceTemplateRow());
        items.lastElementChild.querySelector('[data-st-title]').focus();
      });
      items.addEventListener('click', event => {
        const row = event.target.closest('[data-st-row]');
        if (!row) return;
        if (event.target.closest('[data-st-remove]')) {
          row.remove();
          return;
        }
        const move = event.target.closest('[data-st-move]');
        if (!move) return;
        if (move.dataset.stMove === '-1' && row.previousElementSibling)
          items.insertBefore(row, row.previousElementSibling);
        if (move.dataset.stMove === '1' && row.nextElementSibling) items.insertBefore(row.nextElementSibling, row);
        move.focus();
      });
      el.querySelector('#st_save').addEventListener('click', () => {
        if (!need(el, '#st_name', L('Name the template', 'سمّ القالب'))) return;
        const order = [];
        for (const row of items.querySelectorAll('[data-st-row]')) {
          const dur = Number(row.querySelector('[data-st-dur]').value),
            t = row.querySelector('[data-st-title]').value.trim(),
            ar = row.querySelector('[data-st-ar]').value.trim(),
            who = row.querySelector('[data-st-who]').value,
            note = row.querySelector('[data-st-note]').value.trim();
          if (!t || !Number.isFinite(dur) || dur <= 0) {
            row.querySelector(!t ? '[data-st-title]' : '[data-st-dur]').focus();
            toast(L('Each item needs a name and minutes', 'كل بند يحتاج اسماً ودقائق'), '', 'warning');
            return;
          }
          order.push({
            dur: String(dur),
            t,
            ar: ar || t,
            who,
            note,
            noteAr: note === row.dataset.originalNote ? row.dataset.noteAr : note
          });
        }
        const name = val(el, '#st_name'),
          lang = val(el, '#st_lang');
        const fields = {
          name,
          ar: val(el, '#st_ar') || name,
          venue: val(el, '#st_venue'),
          language: lang,
          languageAr: { Bilingual: 'ثنائي اللغة', English: 'إنكليزي' }[lang] || 'عربي وسرياني',
          celebrant: source?.celebrant || 'p17',
          coordinator: source?.coordinator || 'p4',
          order
        };
        if (source && !fromPlan) Object.assign(source, fields);
        else D.SERVICE_TEMPLATES.push({ id: 'st' + Date.now().toString(36), ...fields });
        closeOverlays();
        refresh();
        ok(L('Template saved', 'حُفظ القالب'));
      });
    }
  });
}

export function serviceTemplateDelete(id) {
  const tpl = D.SERVICE_TEMPLATES.find(x => x.id === id);
  if (!tpl) return;
  openModal({
    title: L('Delete template?', 'حذف القالب؟'),
    body: (
      <>
        <p>{L(tpl.name, tpl.ar)}</p>
        <p className="t-caption dim">
          {L('Plans already created from it stay unchanged.', 'الخطط المنشأة منه تبقى بلا تغيير.')}
        </p>
      </>
    ),
    foot: (
      <>
        <button className="btn btn-secondary" data-close="">
          {L('Keep template', 'إبقاء القالب')}
        </button>
        <button className="btn btn-danger" id="std_go">
          {L('Delete template', 'حذف القالب')}
        </button>
      </>
    ),
    onMount(el) {
      el.querySelector('#std_go').addEventListener('click', () => {
        D.SERVICE_TEMPLATES.splice(D.SERVICE_TEMPLATES.indexOf(tpl), 1);
        closeOverlays();
        refresh();
        ok(L('Template deleted', 'حُذف القالب'));
      });
    }
  });
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
    : allPlans().map(plan => ({ id: plan.id, label: `${plan.title} · ${plan.date} ${plan.time || ''}` }));
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
      el.querySelector('#music_add').addEventListener('click', () => {
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
          plan.order.push({
            dur: '4',
            t: `Hymn — ${m.title}`,
            ar: `لحن — ${m.ar}`,
            note: m.key ? `Key: ${m.key}` : '',
            noteAr: m.key ? `المقام: ${m.key}` : '',
            who: 'g1',
            hymnId: mid
          });
          normalizePlanOrder(plan, 'reflow');
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
          prep: requestRequirements({ kind: en }).some(([, , required]) => required) ? 'documents missing' : 'complete',
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
