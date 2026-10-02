/* Modules 3, 4, 6, 8, 9, 10 — groups, calendar, services, volunteers,
   registration and check-in. */
import { t, isAr, num, usd, fmtDate, fmtLong, dayShort, month } from '../i18n.js';
import { is, S, go, bus } from '../store.js';
import { icon, pageHead, sectionH, panel, who, status, pill, esc, table, wireTables, empty, amount,
         searchField, openDrawer, openModal, closeOverlays, toast, stat, avatar, tabBar, openMenu } from '../ui.js';
import * as C from '../components.js';
import * as CR from '../crud.js';
import { VERBS } from '../actions.js';
import * as F from '../flows.js';
import { printWeekDialog, priestScheduleDialog } from '../schedules.js';
import { allPlans, currentPlan, workingPlan, planDirty, savePlanDraft, normalizePlanOrder, planTotalMinutes,
  meetingId, attendanceCounts, attendanceValue } from '../planning.js';
import { eligibleEvents, eventById, selectedRegistration, selectRegistration, registrantsFor, linkedEvent,
  selectableCheckinEvents, selectCheckinEvent, selectedCheckin, ensureCheckinSession, eventVenue } from '../event-workflows.js';
import { EVENTS, EVENT_DETAIL, PEOPLE, FEASTS, GROUPS, GROUP_DETAIL, groupInfo, eventInfo, ROTA, REGISTRATIONS, REG_FORM, REGISTRANTS, REFUNDS,
         CHECKIN, PICKUP, INCIDENTS, VENUES, TODAY, VOLUNTEERS, SIGNUP_SHEETS,
         SERVICE_REQUESTS, SERVICE_TEMPLATES, EVENT_TEMPLATES,
         person, venue, group, initials } from '../data.js';

/* Month shown on the calendar: October 2026 moved by the prev / next buttons. */
const calMonth = () => { const d = new Date(2026, 9 + S.ui.calOffset, 1); return { y: d.getFullYear(), m: d.getMonth() }; };
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const L = (en, ar) => t(en, ar);
const byTime = (a, b) => (a.d + a.t).localeCompare(b.d + b.t);
/* the kinds of entry the calendar can show; the chips switch each on and off */
const CAL_KINDS = [['mass', 'Masses', 'القداديس'], ['event', 'Parish events', 'أحداث الرعية'], ['group', 'Groups', 'المجموعات'],
                   ['sacr', 'Sacraments', 'الأسرار'], ['pending', 'Reservations', 'الحجوزات']];
const calEvents = () => EVENTS.filter(e => !(S.ui.calOff || []).includes(e.kind));
const addMin = (hm, m) => { const [h, mi] = hm.split(':').map(Number), x = h * 60 + mi + m; return `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };

/* ═══════════════ 4 · calendar ═══════════════ */
const CALTABS = () => [['', 'Month', 'شهر'], ['week', 'Week', 'أسبوع'], ['day', 'Day', 'يوم'], ['agenda', 'Agenda', 'جدول'], ['templates', 'Templates', 'قوالب']];

export function calendar(tab = '') {
  const head = pageHead({
    crumbs: [{ label: L('Parish life', 'حياة الرعية') }, { label: L('Calendar', 'الرزنامة') }],
    title: `${month(calMonth().m)} ${calMonth().y}`,
    sub: L('One event system with filtered views — personal, group, parish, facility and eparchy. Pending reservations are shown only to those allowed to see them.',
           'نظام أحداث واحد بعروض مرشّحة — شخصي ومجموعة ورعية ومرفق وأبرشية. الحجوزات المعلّقة تظهر فقط لمن يحقّ له.'),
    actions: `${is('priest')?`<button class="btn btn-secondary" id="priest-schedule">${icon('print',17)}${L('Priest schedule','جدول الكهنة')}</button>`:''}
      <button class="btn btn-secondary" id="printweek">${icon('print', 17)}${L('Print my week', 'اطبع أسبوعي')}</button>
      <button class="btn btn-secondary" id="subscribe">${icon('link', 17)}${L('Subscribe', 'اشتراك')}</button>
      ${is('priest','secretary','bishop') ? C.splitBtn(L('New event', 'حدث جديد'), 'newev') : ''}`
  }) + tabBar('calendar', CALTABS(), tab);

  const filters = `<div class="toolbar" style="margin:20px 0 16px">
      <div style="display:flex;gap:6px">
        ${C.iconBtn('chevL', L('Previous month', 'الشهر السابق'), 'data-act="cal-prev"')}
        <button class="btn btn-secondary btn-dense" data-act="cal-today">${L('Today', 'اليوم')}</button>
        ${C.iconBtn('chevR', L('Next month', 'الشهر التالي'), 'data-act="cal-next"')}
      </div>
      <div class="chipset" role="group" aria-label="${L('Show on the calendar', 'اعرض على الرزنامة')}" style="margin-inline-start:auto">
        ${CAL_KINDS.map(([k, en, ar]) => { const on = !(S.ui.calOff || []).includes(k);
          return `<button class="chip ${on ? 'chip-on' : ''}" aria-pressed="${on}" data-act="cal-kind:${k}">${on ? icon('check', 13) : ''}${esc(L(en, ar))}</button>`; }).join('')}</div>
    </div>`;

  if (tab === 'templates') return head + `<div class="toolbar" style="margin:16px 0">
      <p class="t-caption dim">${L('Templates set defaults for new events. Existing events stay independent.', 'تحدّد القوالب إعدادات الأحداث الجديدة. تبقى الأحداث الحالية مستقلة.')}</p>
      ${is('priest','secretary','bishop') ? `<button class="btn btn-primary btn-dense" data-event-template-new>${icon('plus', 15)}${L('New template', 'قالب جديد')}</button>` : ''}</div>
    ${table({ cols:[{label:L('Template','القالب')},{label:L('Category','الفئة')},{label:L('Room / duration','القاعة / المدة')},{label:'',cls:'shrink'}],
      rows:EVENT_TEMPLATES.map(tpl => ({cells:[`<b>${esc(L(tpl.name,tpl.nameAr))}</b>`, esc(tpl.kind),
        `${esc(L(venue(tpl.venue)?.name || '',venue(tpl.venue)?.ar || ''))} · ${Number(tpl.duration)||60} ${L('min','د')}`,
        `<span class="row" style="gap:6px">${is('priest','secretary','bishop') ? `<button class="btn btn-secondary btn-dense" data-tpl-use="${esc(tpl.id)}">${L('Use','استعمال')}</button>
        ${C.iconBtn('edit',L('Edit template','تعديل القالب'),`data-tpl-edit="${esc(tpl.id)}"`)}${C.iconBtn('trash',L('Delete template','حذف القالب'),`data-tpl-delete="${esc(tpl.id)}"`)}` : ''}</span>`]})) })}`;

  if (tab === 'agenda') return head + filters + table({
    cols: [{ label: L('When', 'الموعد') }, { label: L('Event', 'الحدث') }, { label: L('Where', 'المكان'), cls: 'hide-sm' },
           { label: L('Kind', 'النوع'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
    rows: calEvents().sort(byTime).map(e => ({ cells: [
      `<span class="mono dim">${fmtDate(e.d)} ${e.t}</span>`,
      `<b>${esc(L(e.title, e.titleAr))}</b>`,
      `<span class="dim">${esc(L(venue(e.venue).name, venue(e.venue).ar))}</span>`,
      e.kind === 'pending' ? status('pending') : pill(L(e.kind, e.kind)),
      `<button class="btn btn-secondary btn-dense" data-ev="${e.id}">${L('Open', 'فتح')}</button>`]}))
  });

  /* day — the same event chip as the week, laid on an hour grid */
  if (tab === 'day') {
    const key = S.ui.calDay || iso(TODAY), evs = calEvents().filter(e => e.d === key).sort(byTime);
    const H0 = 7, ROW = 56, feast = FEASTS[key];
    const top = hm => { const [h, mi] = hm.split(':').map(Number); return (h - H0 + mi / 60) * ROW; };
    const mins = e => e.kind === 'mass' ? 60 : e.kind === 'sacr' ? 90 : 75;   // ponytail: events carry no end time yet; typical length by kind
    const rooms = [...new Set(evs.map(e => e.venue))].map(venue);
    return head + `<div class="toolbar" style="margin:20px 0 16px">
        <div style="display:flex;gap:6px">
          ${C.iconBtn('chevL', L('Previous day', 'اليوم السابق'), 'data-act="cal-day:-1"')}
          <button class="btn btn-secondary btn-dense" data-act="cal-day:0">${L('Today', 'اليوم')}</button>
          ${C.iconBtn('chevR', L('Next day', 'اليوم التالي'), 'data-act="cal-day:1"')}
        </div>
        <b class="dv-title">${fmtLong(key)}</b>
      </div>
      <div class="splitview">
        <div class="cal dayview" style="--row:${ROW}px">
          ${Array.from({ length: 15 }, (_, i) => `<div class="dv-h"><span>${String(H0 + i).padStart(2, '0')}:00</span></div>`).join('')}
          <div class="dv-track">${evs.map(e => `<button class="cal-ev dv-ev ${e.kind === 'mass' ? 'mass' : e.kind === 'pending' ? 'pending' : ''}" data-ev="${e.id}"
              style="top:${top(e.t) + 2}px;height:${mins(e) / 60 * ROW - 4}px">
            <span class="row" style="gap:6px"><span class="t">${e.t}</span><b>${esc(L(e.title, e.titleAr))}</b></span>
            <small>${esc(L(venue(e.venue).name, venue(e.venue).ar))} · ${mins(e)} ${L('min', 'د')}</small></button>`).join('')}</div>
        </div>
        <div class="sidecol">
          ${panel(L('This day', 'هذا اليوم'), `
            ${feast ? `<div class="row" style="gap:8px;margin-bottom:12px"><span class="feastdot"></span><b style="font:500 14px/20px var(--sans)">${esc(L(...feast))}</b></div>` : ''}
            <dl class="dl">
              <dt>${L('Events', 'الأحداث')}</dt><dd class="mono">${evs.length}</dd>
              <dt>${L('Awaiting approval', 'بانتظار الموافقة')}</dt><dd class="mono">${evs.filter(e => e.kind === 'pending').length}</dd>
              <dt>${L('Rooms in use', 'القاعات المستخدمة')}</dt><dd>${rooms.length ? rooms.map(v => esc(L(v.name, v.ar))).join(', ') : '—'}</dd>
            </dl>
            <button class="btn btn-secondary" id="newday" style="width:100%;margin-top:16px">${icon('plus', 17)}${L('New event this day', 'حدث جديد في هذا اليوم')}</button>`)}
        </div>
      </div>`;
  }

  if (tab === 'week') {
    const days = [4, 5, 6, 7, 8, 9, 10].map(d => new Date(2026, 9, d));
    return head + filters + `<div class="cal"><div class="cal-head">
      ${days.map(d => `<div>${esc(dayShort(d.getDay()))} ${d.getDate()}</div>`).join('')}</div>
      <div class="cal-grid">${days.map(d => {
        const evs = calEvents().filter(e => e.d === iso(d)).sort(byTime);
        return `<div class="cal-day" style="min-height:280px">
          ${evs.map(e => `<span class="cal-ev ${e.kind === 'mass' ? 'mass' : e.kind === 'pending' ? 'pending' : ''}"
            data-ev="${e.id}"><span class="t">${e.t}</span>${esc(L(e.title, e.titleAr))}</span>`).join('')
            || `<span class="t-caption dimmer">${L('Nothing', 'لا شيء')}</span>`}</div>`;
      }).join('')}</div></div>`;
  }

  /* month */
  const { y, m } = calMonth();
  const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), lead = first.getDay();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push({ d: new Date(y, m, -(lead - i - 1)), out: true });
  for (let i = 1; i <= days; i++) cells.push({ d: new Date(y, m, i), out: false });
  while (cells.length % 7) cells.push({ d: new Date(y, m + 1, cells.length - days - lead + 1), out: true });

  const grid = cells.map(({ d, out }) => {
    const key = iso(d), evs = calEvents().filter(e => e.d === key).sort(byTime), feast = FEASTS[key], today = key === iso(TODAY);
    return `<div class="cal-day ${out ? 'out' : ''} ${today ? 'today' : ''}">
      <button class="dn" data-day="${key}" aria-label="${esc(fmtLong(key))}">${d.getDate()}${feast && !today ? '<span class="feast"></span>' : ''}</button>
      ${feast && !out ? `<span class="t-caption" style="color:var(--accent);font-size:10px;line-height:14px">${esc(L(...feast))}</span>` : ''}
      ${evs.slice(0, 3).map(e => `<span class="cal-ev ${e.kind === 'mass' ? 'mass' : e.kind === 'pending' ? 'pending' : ''}"
        data-ev="${e.id}" title="${esc(L(e.title, e.titleAr))}"><span class="t">${e.t}</span>${esc(L(e.title, e.titleAr))}</span>`).join('')}
      ${evs.length > 3 ? `<span class="cal-more">+${evs.length - 3}</span>` : ''}</div>`;
  }).join('');

  return head + filters + `<div class="cal">
      <div class="cal-head">${[0,1,2,3,4,5,6].map(i => `<div>${esc(dayShort(i))}</div>`).join('')}</div>
      <div class="cal-grid">${grid}</div></div>
    <div class="row cal-legend" style="gap:20px;margin-top:16px;flex-wrap:wrap">
      ${[['mass', L('Mass', 'قدّاس')], ['', L('Parish event', 'حدث رعوي')], ['pending', L('Pending reservation — holds the slot', 'حجز معلّق — يحجز الوقت')]]
        .map(([cls, lbl]) => `<span class="row" style="gap:7px"><span class="cal-ev cal-sw ${cls}"></span>
          <span class="t-caption dim">${esc(lbl)}</span></span>`).join('')}
      <span class="row" style="gap:7px"><span class="feastdot" style="width:7px;height:7px"></span>
        <span class="t-caption dim">${L('Feast day (Maronite calendar)', 'يوم عيد (الرزنامة المارونية)')}</span></span>
    </div>`;
}

calendar.mount = host => {
  C.wire(host); wireTables(host);
  host.querySelector('#priest-schedule')?.addEventListener('click', priestScheduleDialog);
  host.querySelectorAll('[data-ev]').forEach(el => el.addEventListener('click', () => eventDrawer(el.dataset.ev)));
  host.querySelector('[data-split="newev"]')?.addEventListener('click', () => eventDrawer(null, true));
  host.querySelector('#newday')?.addEventListener('click', () => eventDrawer(null, true, { d: S.ui.calDay || iso(TODAY) }));
  host.querySelectorAll('[data-day]').forEach(b => b.addEventListener('click', () => { S.ui.calDay = b.dataset.day; go('calendar/day'); }));
  host.querySelector('[data-event-template-new]')?.addEventListener('click', () => eventTemplateDrawer());
  host.querySelectorAll('[data-tpl-edit]').forEach(b => b.addEventListener('click', () => eventTemplateDrawer(b.dataset.tplEdit)));
  host.querySelectorAll('[data-tpl-delete]').forEach(b => b.addEventListener('click', () => deleteEventTemplate(b.dataset.tplDelete)));
  host.querySelectorAll('[data-tpl-use]').forEach(b => b.addEventListener('click', () => useEventTemplate(b.dataset.tplUse)));
  host.querySelector('[data-splitmenu="newev"]')?.addEventListener('click', e => openMenu(e.currentTarget, [
    { head: L('Start from a template', 'ابدأ من قالب') },
    ...EVENT_TEMPLATES.map(tpl => ({ label: L(tpl.name, tpl.nameAr), icon: tpl.icon, fn: () => useEventTemplate(tpl.id) })),
    { sep: true },
    { label: L('Manage templates', 'إدارة القوالب'), icon: 'settings', fn: () => go('calendar/templates') }
  ], { width: 240 }));
  host.querySelector('#subscribe')?.addEventListener('click', () => openModal({
    title: L('Subscribe to this calendar', 'الاشتراك بهذه الرزنامة'),
    sub: L('Export or subscribe first; provider sync comes later, once update and cancellation behaviour is proven.',
           'التصدير والاشتراك أولاً؛ والمزامنة مع المزوّدين لاحقاً بعد إثبات سلوك التحديث والإلغاء.'),
    body: `<div class="formrow"><label class="label">${L('Subscription link (iCal)', 'رابط الاشتراك (iCal)')}</label>
        <input class="input mono" readonly dir="ltr" value="webcal://parishlife.app/saint-elias/cal.ics"></div>
      <div class="stack" style="gap:10px">
        ${C.checkRow(L('Masses and services', 'القداديس والخدم'), { checked: true })}
        ${C.checkRow(L('My volunteer assignments', 'مناوباتي'), { checked: true })}
        ${C.checkRow(L('Private group meetings', 'اجتماعات المجموعات الخاصة'))}
      </div>
      <div class="divider"></div>
      <div class="row" style="gap:8px"><button class="btn btn-secondary btn-dense" data-act="export">${L('Download .ics', 'تنزيل .ics')}</button>
        <button class="btn btn-secondary btn-dense" data-act="ics">${L('Google Calendar', 'رزنامة غوغل')}</button>
        <button class="btn btn-secondary btn-dense" data-act="ics">${L('Outlook', 'أوتلوك')}</button></div>`
  }));
  host.querySelector('#printweek')?.addEventListener('click', printWeekDialog);
};

function useEventTemplate(id) {
  const tpl = EVENT_TEMPLATES.find(x => x.id === id);
  if (!tpl) return;
  const date = S.ui.calDay || iso(TODAY);
  eventDrawer(null, true, { title:tpl.name, titleAr:tpl.nameAr, kind:tpl.kind, venue:tpl.venue,
    d:date, t:'12:00', to:addMin('12:00', Number(tpl.duration) || 60), templateId:id });
}

function eventTemplateDrawer(id) {
  const tpl = EVENT_TEMPLATES.find(x => x.id === id);
  openDrawer({
    title: tpl ? L('Edit calendar template','تعديل قالب الرزنامة') : L('New calendar template','قالب رزنامة جديد'),
    sub:L('Changes affect future events only.','تؤثر التغييرات في الأحداث المستقبلية فقط.'),
    body:`${C.field({label:L('Name','الاسم'),req:true,id:'ct_name',value:tpl?.name || ''})}
      ${C.field({label:L('Arabic name','الاسم العربي'),id:'ct_ar',value:tpl?.nameAr || ''})}
      <div class="formgrid"><div class="formrow"><label class="label" for="ct_kind">${L('Category','الفئة')}</label><select id="ct_kind" class="select">
        ${[['event','Parish event','حدث رعوي'],['mass','Mass','قدّاس'],['group','Group','مجموعة'],['sacr','Sacrament','سرّ']].map(([v,en,ar]) => `<option value="${v}" ${tpl?.kind===v?'selected':''}>${L(en,ar)}</option>`).join('')}</select></div>
      <div class="formrow"><label class="label" for="ct_venue">${L('Default room','القاعة الافتراضية')}</label><select id="ct_venue" class="select">
        ${VENUES.map(v => `<option value="${v.id}" ${tpl?.venue===v.id?'selected':''}>${esc(L(v.name,v.ar))}</option>`).join('')}</select></div></div>
      ${C.stepper({label:L('Duration in minutes','المدة بالدقائق'),value:tpl?.duration || 60,id:'ct_duration'})}
      ${C.textarea({label:L('Default description','الوصف الافتراضي'),id:'ct_desc',value:tpl?.description || '',max:400})}`,
    foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-primary" id="ct_save" style="margin-inline-start:auto">${L('Save template','حفظ القالب')}</button>`,
    onMount(el) { C.wire(el); el.querySelector('#ct_save').addEventListener('click', () => {
      if (!F.need(el,'#ct_name',L('Name the template','سمّ القالب'))) return;
      const kind=el.querySelector('#ct_kind').value, name=el.querySelector('#ct_name').value.trim();
      const fields={name,nameAr:el.querySelector('#ct_ar').value.trim() || name,kind,
        icon:{mass:'service',sacr:'sacr',group:'groups',event:'events'}[kind],venue:el.querySelector('#ct_venue').value,
        duration:Math.max(1,Number(el.querySelector('#ct_duration').value)||60),description:el.querySelector('#ct_desc').value.trim(),capacity:tpl?.capacity || 0};
      if (tpl) Object.assign(tpl,fields); else EVENT_TEMPLATES.push({id:'et'+Date.now().toString(36),...fields});
      closeOverlays(); bus.refresh(); toast(L('Template saved','حُفظ القالب'),'','success');
    }); }
  });
}

function deleteEventTemplate(id) {
  const tpl=EVENT_TEMPLATES.find(x=>x.id===id); if (!tpl) return;
  openModal({title:L('Delete template?','حذف القالب؟'),body:`<p>${esc(L(tpl.name,tpl.nameAr))}</p><p class="t-caption dim">${L('Events already made from it will stay unchanged.','الأحداث المنشأة منه ستبقى بلا تغيير.')}</p>`,
    foot:`<button class="btn btn-secondary" data-close>${L('Keep template','إبقاء القالب')}</button><button class="btn btn-danger" id="ct_confirm">${L('Delete template','حذف القالب')}</button>`,
    onMount(el){el.querySelector('#ct_confirm').addEventListener('click',()=>{EVENT_TEMPLATES.splice(EVENT_TEMPLATES.indexOf(tpl),1);closeOverlays();bus.refresh();toast(L('Template deleted','حُذف القالب'),'','success');});}});
}

function eventDrawer(id, isNew = false, pre = null) {
  const e = EVENTS.find(x => x.id === id);
  if (!isNew && !e) return;
  const d = e ? eventInfo(e) : null, ed = pre?.id ? eventInfo(pre) : null;
  const initialWedding = ed?.subtype === 'wedding' || /wedding/i.test(pre?.title || '') || /إكليل/.test(pre?.titleAr || '');
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const nextDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;
  if (isNew) return openDrawer({
    large: true,
    title: pre?.id ? L('Edit event', 'تعديل الحدث') : L('New event', 'حدث جديد'),
    sub: L('Choose the date, time, room, and visibility. Room conflicts appear beside the time fields.', 'اختر التاريخ والوقت والقاعة والظهور. تظهر تعارضات القاعة قرب حقول الوقت.'),
    body: `${C.field({ label: L('Title', 'العنوان'), req: true, id: 'ev_t', value: pre ? L(pre.title, pre.titleAr) : '', ph: L('Parish lunch', 'غداء الرعية') })}
      <div class="formgrid">
        <div class="formrow"><label class="label" for="ev_template">${L('Template', 'القالب')}</label>
          <select class="select" id="ev_template"><option value="">${L('None', 'بلا')}</option>${EVENT_TEMPLATES.map(x => `<option value="${esc(x.id)}" ${pre?.templateId===x.id?'selected':''}>${esc(L(x.name,x.nameAr))}</option>`).join('')}</select></div>
        <div class="formrow"><label class="label">${L('Category', 'الفئة')}</label>
          <select class="select" id="ev_cat">${[['event', 'Parish life', 'حياة الرعية'], ['mass', 'Worship', 'العبادة'], ['group', 'Formation', 'التنشئة'], ['sacr', 'Sacrament', 'سرّ']]
            .map(([v, en, ar]) => `<option value="${v}" ${(pre?.kind || 'event') === v ? 'selected' : ''}>${esc(L(en, ar))}</option>`).join('')}</select></div>
        ${C.field({ label: L('Date', 'التاريخ'), type: 'date', value: pre?.d || nextDate, id: 'ev_d' })}
        ${C.field({ label: L('From', 'من'), type: 'time', value: pre?.t || '12:00', id: 'ev_from' })}
        ${C.field({ label: L('To', 'إلى'), type: 'time', value: pre?.to || '14:00', id: 'ev_to' })}
        <div id="evclash" style="grid-column:1/-1"></div>
        <div class="formrow"><label class="label" for="ev_v">${L('Room', 'القاعة')}</label>
          <select class="select" id="ev_v">${VENUES.map(v => `<option value="${v.id}" ${(pre?.venue || 'v3') === v.id ? 'selected' : ''}>${esc(L(v.name, v.ar))}</option>`).join('')}</select></div>
      </div>
      ${C.textarea({ label: L('Description', 'الوصف'), id: 'evdesc', max: 400, value: ed ? L(ed.desc, ed.descAr) : (EVENT_TEMPLATES.find(x=>x.id===pre?.templateId)?.description || '') })}
      <div id="ev-subtype" ${(pre?.kind||'event')==='sacr'?'':'hidden'} class="formrow"><label class="label" for="ev_subtype">${L('Sacrament event type','نوع حدث السرّ')}</label>
        <select class="select" id="ev_subtype"><option value="">${L('Other sacrament','سرّ آخر')}</option><option value="wedding" ${initialWedding?'selected':''}>${L('Wedding','إكليل')}</option></select></div>
      <div id="ev-participants" ${initialWedding?'':'hidden'}>
        <div class="formgrid">${C.field({label:L('Person getting married — first','المتزوّج الأول'),id:'ev_partner1',value:ed?.participants?.[0]||''})}
        ${C.field({label:L('Person getting married — second','المتزوّج الثاني'),id:'ev_partner2',value:ed?.participants?.[1]||''})}</div>
      </div>
      ${C.chipField(L('Required items', 'المستلزمات'), (ed?.bring||[]).map(([en,ar])=>L(en,ar)))}
      <div class="formgrid">
        ${C.stepper({ label: L('Capacity', 'السعة'), value: ed?.cap ?? (EVENT_TEMPLATES.find(x=>x.id===pre?.templateId)?.capacity ?? 60), id: 'evcap' })}
        <div class="formrow"><label class="label" for="ev_visibility">${L('Visibility', 'الظهور')}</label>
          <select class="select" id="ev_visibility"><option value="public" ${!ed?.visibility||ed.visibility==='public'?'selected':''}>${L('Public — parish calendar', 'عام — رزنامة الرعية')}</option>
            <option value="groups" ${ed?.visibility==='groups'?'selected':''}>${L('Selected groups only', 'للمجموعات المحدّدة فقط')}</option>
            <option value="confidential" ${ed?.visibility==='confidential'?'selected':''}>${L('Clergy and office only', 'للإكليروس والمكتب فقط')}</option></select></div>
      </div>
      <div id="ev-visible-groups" ${ed?.visibility==='groups'?'':'hidden'}><label class="label">${L('Groups allowed to see this event','المجموعات المخوّلة رؤية الحدث')}</label>
        <div class="choice-grid">${GROUPS.map(g=>`<label class="row"><input type="checkbox" data-ev-group value="${esc(g.id)}" ${ed?.visibleGroupIds?.includes(g.id)?'checked':''}><span>${esc(L(g.name,g.ar))}</span></label>`).join('')}</div></div>
      <div id="ev-priest-box" ${(pre?.kind||'event')==='mass'?'':'hidden'}><label class="label">${L('Assigned priests','الكهنة المكلّفون')}</label>
        <div class="choice-grid">${PEOPLE.filter(p=>p.status==='clergy').map(p=>`<label class="row"><input type="checkbox" data-ev-priest value="${esc(p.id)}" ${ed?.priestIds?.includes(p.id)?'checked':''}><span>${esc(p.lat)} · ${esc(p.ar)}</span></label>`).join('')}</div></div>
      `,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="ok" style="margin-inline-start:auto">${pre?.id ? L('Save changes', 'حفظ التعديلات') : L('Create event', 'إنشاء الحدث')}</button>`,
    onMount(el) {
      C.wire(el);
      const v = sel => el.querySelector(sel).value;
      const updateFields=()=>{
        const sacrament=v('#ev_cat')==='sacr', wedding=sacrament&&v('#ev_subtype')==='wedding';
        el.querySelector('#ev-subtype').hidden=!sacrament;
        el.querySelector('#ev-participants').hidden=!wedding;
        el.querySelector('#ev-priest-box').hidden=v('#ev_cat')!=='mass';
        el.querySelector('#ev-visible-groups').hidden=v('#ev_visibility')!=='groups';
      };
      ['#ev_cat','#ev_subtype','#ev_visibility'].forEach(sel=>el.querySelector(sel).addEventListener('change',updateFields));
      updateFields();
      el.querySelector('#ev_template').addEventListener('change', () => {
        const tpl=EVENT_TEMPLATES.find(x=>x.id===v('#ev_template')); if (!tpl) return;
        el.querySelector('#ev_t').value=L(tpl.name,tpl.nameAr);
        el.querySelector('#ev_cat').value=tpl.kind; el.querySelector('#ev_v').value=tpl.venue;
        el.querySelector('#ev_to').value=addMin(v('#ev_from'),Number(tpl.duration)||60);
        el.querySelector('#evdesc').value=tpl.description || '';
        el.querySelector('#evcap').value=tpl.capacity || 0;
        updateFields();
        showClash();
      });
      /* the room clash is checked as the date, times and room change, against every other event in that room */
      const clash = () => EVENTS.find(x => x.id !== pre?.id && x.venue === v('#ev_v') && x.d === v('#ev_d')
        && x.t < v('#ev_to') && v('#ev_from') < (x.to || addMin(x.t, x.kind === 'mass' ? 60 : 90)));
      const showClash = () => {
        const c = clash(), room = venue(v('#ev_v'));
        el.querySelector('#evclash').innerHTML = v('#ev_from') >= v('#ev_to')
          ? C.inlineAlert('warning', L('The event ends before it starts', 'ينتهي الحدث قبل أن يبدأ'), L('Check the two times.', 'تحقّق من الوقتين.'))
          : c ? C.inlineAlert('warning', L(`${room ? room.name : 'The room'} is taken`, `${room ? room.ar : 'القاعة'} محجوزة`),
                  L(`${c.title} is there from ${c.t}. Pick another room or time.`, `${c.titleAr} فيها من ${c.t}. اختر قاعة أو وقتاً آخر.`))
          : C.inlineAlert('success', L('No clash', 'لا تعارض'), L(`${room ? room.name : 'The room'} is free at that time.`, `${room ? room.ar : 'القاعة'} متاحة في ذلك الوقت.`));
      };
      ['#ev_d', '#ev_from', '#ev_to', '#ev_v'].forEach(s2 => el.querySelector(s2).addEventListener('change', showClash));
      showClash();
      el.querySelector('#ok').addEventListener('click', () => {
        if (!F.need(el, '#ev_t', L('Give the event a title', 'أعطِ الحدث عنواناً'))) return;
        if (!F.need(el, '#ev_to', L('Ends before it starts', 'ينتهي قبل أن يبدأ'), to => to > v('#ev_from'))) return;
        const visibility=v('#ev_visibility'),visibleGroupIds=[...el.querySelectorAll('[data-ev-group]:checked')].map(x=>x.value);
        if(visibility==='groups'&&!visibleGroupIds.length)return toast(L('Choose at least one group','اختر مجموعة واحدة على الأقل'),'','warning');
        const wedding=!el.querySelector('#ev-participants').hidden;
        const participants=wedding?[v('#ev_partner1').trim(),v('#ev_partner2').trim()]:[];
        if(wedding&&participants.some(x=>!x))return toast(L('Enter both people getting married','أدخل اسمي المتزوّجين'),'','warning');
        const title = v('#ev_t').trim(), dte = v('#ev_d'), tme = v('#ev_from');
        const fields = { d: dte, t: tme, to: v('#ev_to'), venue: v('#ev_v'), kind: v('#ev_cat'), templateId:v('#ev_template') || null };
        const desc = v('#evdesc').trim(), cap = +v('#evcap') || 0;
        const bring=[...el.querySelectorAll('[data-chipfield] .tag')].map(tag=>tag.firstChild?.textContent?.trim()).filter(Boolean).map(label=>[label,label]);
        const category={event:['Parish life','حياة الرعية'],mass:['Worship','العبادة'],group:['Formation','التنشئة'],sacr:['Sacrament','سرّ']}[fields.kind];
        let ev;
        if (pre?.id) {
          ev = EVENTS.find(x => x.id === pre.id);
          const same = title === L(ev.title, ev.titleAr);
          Object.assign(ev, fields, same ? {} : { title, titleAr: title });
        } else EVENTS.push(ev = { id: 'ev' + Date.now().toString(36), title, titleAr: title, ...fields });
        EVENT_DETAIL[ev.id] ||= eventInfo(ev);
        Object.assign(EVENT_DETAIL[ev.id], { desc, descAr: desc, cat:category[0], catAr:category[1], cap, bring, visibility, visibleGroupIds:visibility==='groups'?visibleGroupIds:[],
          priestIds:fields.kind==='mass'?[...el.querySelectorAll('[data-ev-priest]:checked')].map(x=>x.value):[],
          subtype:wedding?'wedding':'',participants });
        const target = new Date(dte); S.ui.calOffset = (target.getFullYear() - 2026) * 12 + target.getMonth() - 9;
        closeOverlays(); bus.refresh();
        document.querySelectorAll(`#view [data-ev="${ev.id}"]`).forEach(x => x.classList.add('flash'));
        toast(pre?.id ? L('Event updated', 'حُدّث الحدث') : L('Event created', 'أُنشئ الحدث'),
          `${title} · ${fmtDate(dte)} ${tme}`, 'success'); });
    }
  });

  openDrawer({
    large: true,
    title: L(e.title, e.titleAr),
    sub: `${fmtLong(new Date(e.d))} · ${e.t}${e.to ? `–${e.to}` : ''} · ${esc(venue(e.venue) ? L(venue(e.venue).name, venue(e.venue).ar) : '—')}`,
    body: `<dl class="dl">
        <dt>${L('Organiser', 'المنظّم')}</dt><dd>${d.organizer&&person(d.organizer)?esc(L(person(d.organizer).lat,person(d.organizer).ar)):'—'}</dd>
        <dt>${L('Category', 'الفئة')}</dt><dd>${esc(L(d.cat, d.catAr))}</dd>
        <dt>${L('Time zone', 'المنطقة الزمنية')}</dt><dd class="mono">${d.tz}</dd>
        <dt>${L('Visibility', 'الظهور')}</dt><dd>${d.visibility==='groups'?L('Selected groups','مجموعات محدّدة'):d.visibility==='confidential'?L('Clergy and office','الإكليروس والمكتب'):L('Public','عام')}</dd>
        ${d.subtype==='wedding'?`<dt>${L('Getting married','المتزوّجون')}</dt><dd>${esc((d.participants||[]).join(' & ')||L('Not recorded','غير مسجّل'))}</dd>`:''}
        ${e.kind==='mass'?`<dt>${L('Assigned priests','الكهنة المكلّفون')}</dt><dd>${(d.priestIds||[]).map(pid=>esc(person(pid)?.lat||pid)).join(', ')||L('Unassigned','غير مسند')}</dd>`:''}
        ${d.tags.length ? `<dt>${L('Tags', 'الوسوم')}</dt><dd>${d.tags.map(x => `<span class="chip" style="margin-inline-end:6px">${esc(x)}</span>`).join('')}</dd>` : ''}
      </dl>
      <h4 class="t-ui" style="margin-top:14px">${L('Purpose and details','الغاية والتفاصيل')}</h4>
      ${d.desc ? `<p class="t-body dim" style="font-size:14px;margin-top:6px">${esc(L(d.desc, d.descAr))}</p>` : `<p class="help">${L('No purpose or details recorded.','لا غاية أو تفاصيل مسجّلة.')}</p>`}
      <div class="divider"></div>
      <h4 class="t-ui" style="margin-bottom:10px">${L('RSVP', 'تأكيد الحضور')}</h4>
      <div class="grid g4" style="gap:10px">
        ${[[L('Yes', 'نعم'), d.rsvp.yes], [L('No', 'لا'), d.rsvp.no], [L('Maybe', 'ربما'), d.rsvp.maybe], [L('No reply', 'بلا ردّ'), d.rsvp.none]]
          .map(([k, v]) => `<div class="card card-flat" style="padding:12px"><div class="t-caption dim">${esc(k)}</div>
            <div style="font:600 20px/26px var(--sans);font-variant-numeric:tabular-nums">${v}</div></div>`).join('')}
      </div>
      ${d.cap ? `<span class="meter" style="margin-top:12px"><i style="width:${Math.min(100, Math.round(d.rsvp.yes / d.cap * 100))}%"></i></span>
      <span class="t-caption dim" style="display:block;margin-top:6px">${d.rsvp.yes} / ${d.cap} ${L('places', 'مقعداً')} ·
        ${d.waiting} ${L('on the waiting list', 'على لائحة الانتظار')}</span>` : ''}
      ${d.bring.length ? `<div class="divider"></div>
      <h4 class="t-ui" style="margin-bottom:10px">${L('Required items', 'المستلزمات')}</h4>
      <div class="stack" style="gap:8px">${d.bring.map(([en, ar]) => C.checkRow(L(en, ar))).join('')}</div>` : ''}
      <div class="divider"></div>
      <h4 class="t-ui" style="margin-bottom:10px">${L('Tasks', 'المهام')}</h4>
      ${d.tasks.length ? '' : `<p class="t-caption dim">${L('No tasks yet.', 'لا مهام بعد.')}</p>`}
      ${d.tasks.map(([en, ar, p, due, done], ti) => `<div class="listrow ${done ? 'is-done' : ''}" style="padding-inline:0">
        ${avatar(person(p), 'avatar-sm')}<span class="grow"><b>${esc(L(en, ar))}</b>
        <small class="mono">${done ? L('done', 'أُنجزت') : `${L('due', 'حتى')} ${fmtDate(due)}`}</small></span>
        ${C.iconBtn('check', done ? L('Reopen', 'إعادة فتح') : L('Mark done', 'تعليم كمنجز'), `data-act="evtask-toggle:${e.id}|${ti}" aria-pressed="${!!done}"`)}</div>`).join('')}
      <div class="divider"></div>
      <h4 class="t-ui" style="margin-bottom:10px">${L('Linked to', 'مرتبط بـ')}</h4>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        ${REGISTRATIONS.filter(form=>form.eventId===e.id).map(form=>`<a class="chip" href="#/registrations">${icon('registr',14)} ${esc(L(form.event,form.eventAr))}</a>`).join('')||`<span class="help">${L('No linked registration forms are recorded.','لا توجد استمارات تسجيل مرتبطة مسجّلة.')}</span>`}
      </div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
      ${is('priest','secretary') ? `<button class="btn btn-secondary" data-act="event-dup:${e.id}">${L('Duplicate', 'نسخ')}</button>
      <button class="btn btn-danger-quiet" data-act="event-cancel:${e.id}">${L('Cancel event', 'إلغاء الحدث')}</button>
      <button class="btn btn-primary" style="margin-inline-start:auto" id="evedit">${L('Edit', 'تعديل')}</button>` : ''}`,
    onMount(el) { C.wire(el); el.querySelector('#evedit')?.addEventListener('click', () => eventDrawer(e.id, true, e)); }
  });
}

/* ═══════════════ 6 · service planning ═══════════════ */
const STABS = () => [['', 'This plan', 'هذه الخدمة'], ['requests', 'Requests', 'الطلبات', SERVICE_REQUESTS.filter(r => r.status === 'pending').length],
               ['templates', 'Templates', 'القوالب']];

export function services(tab = '', planId = '') {
  const savedPlan = tab === 'plan' ? allPlans().find(p => p.id === planId) : null;
  if (tab === 'plan' && !savedPlan) return pageHead({title:L('Plan not found','الخطة غير موجودة'),crumbs:[{label:L('Service planning','تخطيط الخدم'),href:'#/services'}]}) +
    `<a class="btn btn-secondary" href="#/services">${L('All plans','كل الخطط')}</a>`;
  const canEdit = is('priest','secretary');
  const plan = savedPlan ? (canEdit ? workingPlan(savedPlan.id) : savedPlan) : null;
  const cel = person(plan?.celebrant), coord = person(plan?.coordinator);
  const total = plan ? planTotalMinutes(plan) : 0;
  const head = pageHead({
    crumbs: [{ label: L('Parish life', 'حياة الرعية') }, { label: L('Service planning', 'تخطيط الخدم'),href:tab==='plan'?'#/services':undefined }],
    title: plan ? L(plan.title, plan.titleAr) : L('Service planning', 'تخطيط الخدم'),
    sub: !plan ? L('Choose a plan to open, or create one from a reusable template. Ceremonies are separate from official registers.',
                 'تُخطَّط الاحتفالات هنا؛ والسجل الرسمي يُنشأ منفصلاً في سجلات الأسرار')
             : `${fmtLong(new Date(plan.date))} · ${esc(L(venue(plan.venue)?.name || '', venue(plan.venue)?.ar || ''))} ·
                ${esc(L(plan.language, plan.languageAr))} · ${total} ${L('minutes', 'دقيقة')}`,
    actions: plan ? `<a class="btn btn-secondary" href="#/services">${L('All plans','كل الخطط')}</a>
      <button class="btn btn-secondary" id="slides">${icon('doc', 17)}${L('Generate slides', 'توليد العرض')}</button>
      <button class="btn btn-secondary" data-act="print">${icon('print', 17)}${L('Print order', 'طباعة الترتيب')}</button>
      ${canEdit ? `<button class="btn btn-secondary" data-plan-add>${icon('plus', 17)}${L('Add item', 'إضافة بند')}</button>
      <button class="btn btn-primary" data-plan-save ${planDirty()?'':'disabled'}>${icon('check',17)}${L('Save plan','حفظ الخطة')}</button>` : ''}`
      : canEdit ? `<button class="btn btn-primary" data-plan-new>${icon('plus',17)}${L('New plan','خطة جديدة')}</button>` : ''
  }) + (plan ? '' : tabBar('services', STABS(), tab));

  if (tab === '') return head + `<div class="tabbody">${table({
    cols:[{label:L('Service','الخدمة')},{label:L('When','الموعد')},{label:L('Type / room','النوع / المكان')},{label:L('Status','الحالة')},{label:'',cls:'shrink'}],
    rows:allPlans().slice().sort((a,b)=>a.date.localeCompare(b.date)).map(p=>({cells:[
      `<b>${esc(L(p.title,p.titleAr))}</b>`, `<span class="mono">${fmtDate(p.date)} ${esc(p.time || '')}</span>`,
      `${esc(L(venue(p.venue)?.name || '',venue(p.venue)?.ar || ''))} · ${esc(L(p.language,p.languageAr))}`,
      status(p.status || 'scheduled'), `<a class="btn btn-secondary btn-dense" href="#/services/plan/${esc(p.id)}">${L('Open plan','فتح الخطة')}</a>`]}))})}</div>`;

  if (tab === 'requests') return head + `<div class="tabbody">
    ${table({
      cols: [{ label: L('Ceremony', 'الاحتفال') }, { label: L('Requested by', 'مقدَّم من') }, { label: L('Date', 'التاريخ') },
             { label: L('Preparation', 'التحضير'), cls: 'hide-sm' }, { label: L('Status', 'الحالة'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
      rows: SERVICE_REQUESTS.map(r => ({ cells: [
        `<b>${esc(L(r.kind, r.kindAr))}</b>`, who(person(r.by)), `<span class="mono dim">${fmtDate(r.date)}</span>`,
        r.prep === 'complete' ? pill(L('Complete', 'مكتمل'), 'success') : pill(L(r.prep, r.prepAr || r.prep), 'warning'),
        status(r.status),
        `<button class="btn btn-secondary btn-dense" data-act="svc-request:${r.id}">${L('Open', 'فتح')}</button>`]}))
    })}
    <div class="tabbody">${panel(L('Request a ceremony', 'طلب احتفال'), `
      <div class="gridcards">${[['Mass','قدّاس','service'],['Wedding','إكليل','sacr'],['Baptism','معمودية','sacr'],
        ['Funeral','جنّاز','sacr'],['Prayer meeting','لقاء صلاة','groups'],['Retreat','خلوة','events'],
        ['Special celebration','احتفال خاص','events']].map(([en, ar, ic]) =>
        `<button class="card card-flat" style="cursor:pointer;text-align:start" data-act="svc-request-new:${en}|${ar}">
          <div class="row" style="gap:10px">${icon(ic, 19, 'dimmer')}<b style="font:500 14px/20px var(--sans)">${esc(L(en, ar))}</b></div>
        </button>`).join('')}</div>`)}</div></div>`;

  if (tab === 'templates') return head + `<div class="tabbody"><div class="toolbar" style="margin-bottom:12px">
    <span class="t-caption dim">${L('Using a template creates an independent plan.','استعمال القالب ينشئ خطة مستقلة.')}</span>
    ${canEdit ? `<button class="btn btn-primary btn-dense" data-service-template-new>${icon('plus',15)}${L('New template','قالب جديد')}</button>` : ''}</div>${table({
    cols: [{ label: L('Template', 'القالب') }, { label: L('Items', 'البنود'), cls: 'num' }, { label: '', cls: 'shrink' }],
    rows: SERVICE_TEMPLATES.map(tpl => ({ cells: [
      `<b>${esc(L(tpl.name, tpl.ar))}</b>`, `<span class="num">${tpl.order?.length || 0}</span>`,
      `<span class="row" style="gap:6px;justify-content:flex-end">
        ${canEdit ? `<button class="btn btn-secondary btn-dense" data-act="svc-tpl:${esc(tpl.id)}">${L('Use', 'استعمال')}</button>
        ${C.iconBtn('edit', L('Edit template', 'تعديل القالب'), `data-service-template-edit="${esc(tpl.id)}"`)}
        ${C.iconBtn('trash', L('Delete template', 'حذف القالب'), `data-service-template-delete="${esc(tpl.id)}"`)}` : ''}</span>`]}))
  })}</div>`;

  const rows = plan.order.map((o, oi) => {
    const a = o.who?.startsWith('g') ? group(o.who) : person(o.who);
    const aLabel = !a ? '' : a.lat ? (isAr() ? a.ar : a.lat) : L(a.name, a.ar);
    return `<div class="oos-row" data-service-row="${oi}" ${canEdit ? 'draggable="true"' : ''} style="padding:8px 12px"><span class="dur">${oi+1}. ${esc(o.start||'—')} · ${o.dur}'</span>
      <span class="body"><b>${esc(o.t)}</b><span class="ar">${esc(o.ar)}</span>
        ${o.note ? `<span class="note">${esc(L(o.note, o.noteAr || o.note))}</span>` : ''}</span>
      <span class="who-s">${a && a.lat ? avatar(a, 'avatar-sm') : ''}<span class="t-caption dim">${esc(aLabel)}</span>
        ${canEdit ? `${C.iconBtn('chevD', L('Move up', 'نقل للأعلى'), `data-svc-step="${oi}|-1" style="transform:rotate(180deg)" ${oi ? '' : 'disabled'}`)}
          ${C.iconBtn('chevD', L('Move down', 'نقل للأسفل'), `data-svc-step="${oi}|1" ${oi < plan.order.length - 1 ? '' : 'disabled'}`)}
          ${C.iconBtn('edit', L('Edit item', 'تعديل البند'), `data-plan-item="${oi}"`)}` : ''}</span></div>`;
  }).join('');

  return head + `<div class="splitview">
    <div>
      ${canEdit ? `<div class="row" style="gap:8px;margin-bottom:10px"><span class="pill ${planDirty()?'pill-warning':'pill-success'}" aria-live="polite">${planDirty()?L('Unsaved changes','تغييرات غير محفوظة'):L('All changes saved','كل التغييرات محفوظة')}</span>
        <span class="t-caption dim">${L('Total planned duration','المدة الإجمالية للخطة')}: ${total} ${L('minutes','دقيقة')}</span></div>` : ''}
      ${panel(L('Order of service', 'ترتيب الخدمة'), rows || `<p class="t-caption dim">${L('No items yet. Add one or start from a template.','لا بنود بعد. أضف بنداً أو ابدأ من قالب.')}</p>`, { tight: true,
        more: canEdit ? `<button class="btn btn-ghost btn-dense" data-save-template>${L('Save as template','حفظ كقالب')}</button>` : '' })}
      ${canEdit ? `<p class="t-caption dim" style="margin-top:6px">${L('Items follow their scheduled times. Drag or use the arrow buttons to change the order; then choose Save plan.','تتبع البنود أوقاتها المحدّدة. اسحب أو استخدم الأسهم لتغيير الترتيب، ثم اختر حفظ الخطة.')}</p>` : ''}
    </div>
    <div class="sidecol">
      ${panel(L('Details', 'التفاصيل'), `<dl class="dl">
        <dt>${L('Date and time', 'التاريخ والوقت')}</dt><dd>${fmtDate(plan.date)} ${esc(plan.time || '')}</dd>
        <dt>${L('Venue', 'المكان')}</dt><dd>${esc(L(venue(plan.venue)?.name || '—', venue(plan.venue)?.ar || '—'))}</dd>
        <dt>${L('Celebrant', 'المحتفل')}</dt><dd>${esc(cel ? isAr() ? cel.ar : cel.lat : '—')}</dd>
        <dt>${L('Coordinator', 'المنسّقة')}</dt><dd>${esc(coord ? isAr() ? coord.ar : coord.lat : '—')}</dd>
        <dt>${L('Language', 'اللغة')}</dt><dd>${esc(L(plan.language, plan.languageAr))}</dd>
        <dt>${L('Status', 'الحالة')}</dt><dd>${status(plan.status || 'scheduled')}</dd></dl>`, { more: `${canEdit?`<button class="btn btn-ghost btn-dense" data-plan-edit>${L('Edit details','تعديل التفاصيل')}</button>`:''}<a href="#/volunteers">${L('Open rota', 'افتح المناوبات')}</a>`, tight: true })}
    </div></div>`;
}
services.mount = host => {
  C.wire(host); wireTables(host);
  const redraw = () => { if (S.route === 'services' && S.params[0] === 'plan') { host.innerHTML=services(...S.params); services.mount(host); } };
  host.querySelector('[data-plan-new]')?.addEventListener('click',()=>F.servicePlanNew());
  host.querySelector('[data-plan-edit]')?.addEventListener('click',()=>editPlanDetails(redraw));
  host.querySelector('[data-plan-add]')?.addEventListener('click',()=>editPlanItem(-1,redraw));
  host.querySelectorAll('[data-plan-item]').forEach(b=>b.addEventListener('click',()=>editPlanItem(Number(b.dataset.planItem),redraw)));
  host.querySelector('[data-plan-save]')?.addEventListener('click',async()=>{
    const button=host.querySelector('[data-plan-save]'); if(button)button.disabled=true;
    if(await savePlanDraft()){redraw();toast(L('Plan saved','حُفظت الخطة'),'','success');}
    else {if(button)button.disabled=false;toast(L('Plan was not saved','لم تُحفظ الخطة'),L('Check the save error and retry.','تحقّق من خطأ الحفظ وأعد المحاولة.'),'danger');}
  });
  host.querySelector('[data-save-template]')?.addEventListener('click',()=>{
    if(planDirty())return toast(L('Save the plan first','احفظ الخطة أولاً'),L('The template will use the saved order.','سيستخدم القالب الترتيب المحفوظ.'),'warning');
    F.serviceTemplateEdit('',true);
  });
  host.querySelector('[data-service-template-new]')?.addEventListener('click',()=>F.serviceTemplateEdit());
  host.querySelectorAll('[data-service-template-edit]').forEach(b=>b.addEventListener('click',()=>F.serviceTemplateEdit(b.dataset.serviceTemplateEdit)));
  host.querySelectorAll('[data-service-template-delete]').forEach(b=>b.addEventListener('click',()=>F.serviceTemplateDelete(b.dataset.serviceTemplateDelete)));
  host.querySelectorAll('[data-svc-step]').forEach(b=>b.addEventListener('click',()=>{
    const [i,delta]=b.dataset.svcStep.split('|').map(Number), order=workingPlan(S.params[1]).order, j=i+delta;
    if(j<0||j>=order.length)return; [order[i],order[j]]=[order[j],order[i]];normalizePlanOrder(workingPlan(S.params[1]),'reflow');redraw();
    host.querySelector(`[data-svc-step="${j}|${delta}"]`)?.focus();
  }));
  let dragged=-1;
  host.querySelectorAll('[data-service-row]').forEach(row=>{
    row.addEventListener('dragstart',e=>{dragged=Number(row.dataset.serviceRow);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(dragged));});
    row.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';});
    row.addEventListener('drop',e=>{e.preventDefault();const to=Number(row.dataset.serviceRow),order=workingPlan(S.params[1]).order;
      if(dragged<0||dragged===to||!order[dragged])return;order.splice(to,0,...order.splice(dragged,1));dragged=-1;
      normalizePlanOrder(workingPlan(S.params[1]),'reflow');redraw();});
    row.addEventListener('dragend',()=>{dragged=-1;});
  });
  host.querySelector('#slides')?.addEventListener('click', () => {
    if(planDirty())return toast(L('Save the plan first','احفظ الخطة أولاً'),L('Slides use the saved order.','تستخدم الشرائح الترتيب المحفوظ.'),'warning');
    F.slides();
  });
};

function editPlanDetails(redraw) {
  const plan=workingPlan(S.params[1]); if(!plan)return;
  openDrawer({title:L('Edit plan details','تعديل تفاصيل الخطة'),body:`<div class="formgrid">
    ${C.field({label:L('Service name','اسم الخدمة'),id:'pd_title',req:true,value:plan.title})}
    ${C.field({label:L('Arabic name','الاسم العربي'),id:'pd_ar',value:plan.titleAr})}</div>
    <div class="formgrid">${C.field({label:L('Date','التاريخ'),id:'pd_date',type:'date',value:plan.date})}
    ${C.field({label:L('Start time','وقت البدء'),id:'pd_time',type:'time',value:plan.time||'09:00'})}</div>
    <div class="formrow"><label class="label" for="pd_venue">${L('Venue','المكان')}</label><select class="select" id="pd_venue">${VENUES.map(v=>`<option value="${v.id}" ${v.id===plan.venue?'selected':''}>${esc(L(v.name,v.ar))}</option>`).join('')}</select></div>
    <div class="formrow"><label class="label" for="pd_status">${L('Status','الحالة')}</label><select class="select" id="pd_status">${[['draft','Draft','مسودة'],['scheduled','Scheduled','مجدول'],['ready','Ready','جاهز'],['completed','Completed','منجز']].map(([v,en,ar])=>`<option value="${v}" ${v===plan.status?'selected':''}>${L(en,ar)}</option>`).join('')}</select></div>`,
    foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-primary" id="pd_stage">${L('Apply changes','تطبيق التغييرات')}</button>`,
    onMount(el){C.wire(el);el.querySelector('#pd_stage').addEventListener('click',()=>{
      if(!F.need(el,'#pd_title',L('Name the plan','سمّ الخطة'))||!F.need(el,'#pd_date',L('Choose a date','اختر التاريخ')))return;
      const oldTime=plan.time;
      Object.assign(plan,{title:el.querySelector('#pd_title').value.trim(),titleAr:el.querySelector('#pd_ar').value.trim()||el.querySelector('#pd_title').value.trim(),
        date:el.querySelector('#pd_date').value,time:el.querySelector('#pd_time').value,venue:el.querySelector('#pd_venue').value,status:el.querySelector('#pd_status').value});
      if(plan.time!==oldTime)normalizePlanOrder(plan,'reflow');
      closeOverlays();redraw();
    });}
  });
}

function editPlanItem(index,redraw) {
  const plan=workingPlan(S.params[1]);if(!plan)return;
  const item=index>=0?plan.order[index]:null;
  const last=plan.order.at(-1), after=last?addMin(last.start||plan.time||'09:00',Number(last.dur)||1):plan.time||'09:00';
  openDrawer({title:item?L('Edit service item','تعديل بند الخدمة'):L('Add service item','إضافة بند للخدمة'),
    body:`<div class="formgrid">${C.field({label:L('English item','البند بالإنكليزية'),id:'pi_title',req:true,value:item?.t||''})}
    ${C.field({label:L('Arabic item','البند بالعربية'),id:'pi_ar',value:item?.ar||''})}</div>
    <div class="formgrid">${C.field({label:L('Scheduled time','الوقت المحدّد'),id:'pi_start',type:'time',value:item?.start||after})}
    ${C.field({label:L('Duration (minutes)','المدة (دقائق)'),id:'pi_dur',type:'number',value:item?.dur||3})}</div>
    <div class="formrow"><label class="label" for="pi_who">${L('Led by','يقوده')}</label><select class="select" id="pi_who"><option value="">${L('Unassigned','غير محدّد')}</option>
      ${[...GROUPS.map(g=>[g.id,L(g.name,g.ar)]),...personOptions()].map(([id,name])=>`<option value="${esc(id)}" ${id===item?.who?'selected':''}>${esc(name)}</option>`).join('')}</select></div>
    ${C.field({label:L('Instructions','تعليمات'),id:'pi_note',value:item?.note||''})}`,
    foot:`${item?`<button class="btn btn-danger-quiet" id="pi_delete">${L('Remove item','إزالة البند')}</button>`:''}
      <button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-primary" id="pi_stage">${L('Apply changes','تطبيق التغييرات')}</button>`,
    onMount(el){C.wire(el);
      el.querySelector('#pi_stage').addEventListener('click',()=>{
        if(!F.need(el,'#pi_title',L('Name the item','سمّ البند'))||!F.need(el,'#pi_dur',L('Enter a positive duration','أدخل مدة موجبة'),v=>Number(v)>0))return;
        const t=el.querySelector('#pi_title').value.trim(),note=el.querySelector('#pi_note').value.trim();
        const fields={t,ar:el.querySelector('#pi_ar').value.trim()||t,start:el.querySelector('#pi_start').value,dur:String(Number(el.querySelector('#pi_dur').value)),
          who:el.querySelector('#pi_who').value,note,noteAr:item?.note===note?item.noteAr||note:note};
        if(item)Object.assign(item,fields);else plan.order.push(fields);
        normalizePlanOrder(plan,'sort');closeOverlays();redraw();
      });
      el.querySelector('#pi_delete')?.addEventListener('click',()=>{plan.order.splice(index,1);normalizePlanOrder(plan,'sort');closeOverlays();redraw();});
    }
  });
}

function personOptions() { return PEOPLE.filter(p=>p.status!=='visitor').map(p=>[p.id,L(p.lat,p.ar)]); }

/* ═══════════════ 3 · groups ═══════════════ */
export function groups(id, tab) {
  if (id) return groupDetail(id, tab || '');
  const mine = GROUPS; // the API has already scoped leaders to their own groups
  const cards = mine.map(g => {
    const leader = person(g.leader);
    const visTone = g.vis === 'confidential' ? 'danger' : g.vis === 'private' ? 'warning' : '';
    const visLabel = g.vis === 'confidential' ? L('Confidential', 'سرّي') : g.vis === 'private' ? L('Private', 'خاص') : L('Public', 'عام');
    return `<section class="panel card-link" data-find-item><div class="panel-b">
      <div class="row" style="gap:10px;align-items:flex-start">
        <span class="avatar avatar-lg">${icon('groups', 20)}</span>
        <div style="flex:1;min-width:0">
          <a class="stretch" href="#/groups/${g.id}"><b style="display:block;font:600 16px/22px var(--sans)">${esc(L(g.name, g.ar))}</b></a>
          <small class="t-caption dim">${esc(L(g.cat, g.catAr))}${g.meets ? ` · ${esc(L(g.meets, g.meetsAr))}` : ''}</small></div>
        ${!is('leader') ? CR.recBtn('group', g.id) : ''}</div>
      <div class="divider"></div>
      <div class="row" style="gap:10px">${who(leader)}<span class="row" style="gap:8px;margin-inline-start:auto">${pill(visLabel, visTone, g.vis === 'public' ? true : 'lock')}
        <span class="badge badge-quiet" title="${L('members', 'أعضاء')}">${g.members}</span></span></div>
    </div></section>`;
  }).join('');

  return `${pageHead({
      crumbs: [{ label: is('leader') ? L('My ministry', 'خدمتي') : L('Parish life', 'حياة الرعية') }, { label: L('Groups', 'المجموعات') }],
      title: is('leader') ? L('My groups', 'مجموعاتي') : L('Groups and ministries', 'المجموعات والخدم'),
      sub: is('leader') ? L('You see only the groups you lead.', 'ترين فقط المجموعات التي تقودينها.')
        : L('Youth, choirs, brotherhoods, catechism classes and committees — each with its own leader, roster and visibility.',
            'شبيبة وجوقات وأخويّات وصفوف تعليم ولجان — لكلٍّ مسؤولها ولائحتها ومستوى ظهورها.'),
      actions: `<button class="btn btn-secondary" id="qr">${icon('qr', 17)}${L('Signup QR', 'رمز التسجيل')}</button>
        ${!is('leader') ? `<button class="btn btn-primary" data-act="group-new">${icon('plus', 17)}${L('New group', 'مجموعة جديدة')}</button>` : ''}`
    })}
    <div class="gridcards">${cards}</div>
    <p class="t-caption dim" style="margin-top:20px">${L(
      'People are placed into roles, not roles into people. When a leader hands over, the ongoing tasks follow the role to whoever takes it.',
      'يوضع الأشخاص في الأدوار لا الأدوار في الأشخاص. وعند التسليم تنتقل المهام الجارية مع الدور إلى من يتسلّمه.')}</p>`;
}

const GTABS = () => [['', 'Overview', 'نظرة عامة'], ['roster', 'Roster', 'اللائحة'], ['attendance', 'Attendance', 'الحضور'], ['meetings', 'Meetings', 'الاجتماعات'],
               ['posts', 'Posts & files', 'المنشورات والملفات'], ['belongings', 'Belongings', 'المقتنيات'],
               ['tasks', 'Tasks', 'المهام'], ['formation', 'Formation', 'التنشئة'], ['history', 'History', 'السجل']];

function groupGone() {
  return `${pageHead({ crumbs: [{ label: L('Groups', 'المجموعات'), href: '#/groups' }], title: L('Group not found', 'المجموعة غير موجودة') })}
    ${empty('groups', L('This group no longer exists', 'هذه المجموعة لم تعد موجودة'), L('It may have been deleted. Its members keep their records.', 'ربما حُذفت. ويحتفظ أعضاؤها بسجلاتهم.'),
      `<a class="btn btn-primary btn-dense" href="#/groups">${L('All groups', 'كل المجموعات')}</a>`)}`;
}

function groupDetail(id, tab) {
  const g = group(id);
  if (!g) return groupGone();
  const d = groupInfo(g.id);
  const head = `<div class="pagehead"><div class="entityhead" style="width:100%">
      <div class="id">
        <nav class="crumbs"><a href="#/groups">${L('Groups', 'المجموعات')}</a><span class="sep">/</span><span>${esc(L(g.name, g.ar))}</span></nav>
        <h1 style="font:600 26px/34px var(--sans);letter-spacing:-.02em">${esc(L(g.name, g.ar))}
          ${pill(L(g.vis === 'private' ? 'Private' : g.vis === 'confidential' ? 'Confidential' : 'Public',
                   g.vis === 'private' ? 'خاص' : g.vis === 'confidential' ? 'سرّي' : 'عام'),
                 g.vis === 'confidential' ? 'danger' : g.vis === 'private' ? 'warning' : '', g.vis === 'public' ? true : 'lock')}</h1>
        <div class="meta">${esc(L(g.cat, g.catAr))} · ${esc(L(g.meets, g.meetsAr))} · ${g.members} ${L('members', 'عضواً')}</div>
      </div>
      <div class="acts">${!is('leader') ? `<button class="btn btn-secondary" data-act="compose:group">${icon('msg', 17)}${L('Message group', 'مراسلة المجموعة')}</button>` : ''}
        <button class="btn btn-secondary" id="qr">${icon('qr', 17)}${L('Signup QR', 'رمز التسجيل')}</button>
        <button class="btn btn-primary" data-act="member-add:${g.id}">${icon('plus', 17)}${L('Add member', 'إضافة عضو')}</button>
        ${!is('leader') ? CR.recBtn('group', g.id, L('Group actions', 'إجراءات المجموعة')) : ''}</div>
    </div></div>${tabBar('groups/' + g.id, GTABS(), tab)}`;

  const T = {
    '': () => `<div class="splitview"><div class="stack" style="gap:16px">
        ${panel(L('Leadership', 'المسؤوليات'), d.roles.map(([p, en, ar]) => `<div class="listrow">
          ${who(person(p))}<span class="grow"></span><span class="chip">${esc(L(en, ar))}</span></div>`).join(''), { tight: true })}
        ${panel(L('Join requests', 'طلبات الانتساب'), d.requests.length ? d.requests.map(r => `<div class="listrow">
            ${who(person(r.p))}<span class="grow"><small class="mono">${fmtDate(r.at)}</small></span>
            <button class="btn btn-secondary btn-dense" data-act="join-decline:${r.p}">${L('Decline', 'رفض')}</button>
            <button class="btn btn-primary btn-dense" data-act="join-approve:${r.p}">${L('Approve', 'قبول')}</button></div>`).join('')
          : empty('groups', L('No requests', 'لا طلبات'), L('Nobody is waiting.', 'لا أحد ينتظر.')), { tight: true })}
      </div>
      <div class="sidecol">
        ${panel(L('Budget', 'الموازنة'), `${C.barChart([{ label: L('Youth & catechism', 'الشبيبة والتعليم'),
          v: d.budget.spent, max: d.budget.allocated }])}
          <p class="t-caption dim" style="margin-top:12px">${L('Income and expenses live in Finance; the group sees only its own allocation.',
            'المداخيل والمصاريف في المالية؛ وترى المجموعة مخصّصها فقط.')}</p>
          <a class="btn btn-secondary btn-dense" style="margin-top:10px" href="#/finance">${L('Open in Finance', 'فتح في المالية')}</a>`)}
        ${panel(L('Attendance', 'الحضور'), (() => { const recent=d.meetings.slice().sort((a,b)=>b.d.localeCompare(a.d)).slice(0,4),
          counts=attendanceCounts(recent,d.roster), recorded=counts.present+counts.excused+counts.absent;
          return `<div class="row" style="gap:12px;align-items:baseline"><b style="font:600 24px/30px var(--sans)">${recorded?Math.round(counts.present/recorded*100)+'%':'—'}</b>
            <span class="t-caption dim">${L('present among recorded statuses','حاضر من الحالات المسجّلة')}</span></div>
            <p class="t-caption dim">${recorded} ${L('statuses in the last four meetings','حالات في آخر أربعة اجتماعات')}</p>
            <a class="btn btn-secondary btn-dense" style="margin-top:10px" href="#/groups/${esc(g.id)}/attendance">${L('Open attendance','فتح الحضور')}</a>`; })())}
      </div></div>`,

    roster: () => table({
      pick: true,
      cols: [{ label: L('Member', 'العضو'), sort: true }, { label: L('Role', 'الدور'), cls: 'hide-sm' },
             { label: L('Joined', 'انتسب'), cls: 'hide-md' }, { label: L('Attendance', 'الحضور'), cls: 'num' }, { label: '', cls: 'shrink' }],
      rows: d.roster.map(r => ({ cells: [
        who(person(r.p)),
        `<span class="dim">${esc(L(r.role, r.roleAr))}</span>`,
        `<span class="mono dim">${r.joined}</span>`,
        `<span class="num">${memberAttendancePct(d.meetings,r.p)}</span>`,
        `<span class="rowacts">${!is('leader') ? C.iconBtn('msg', L('Message', 'مراسلة'), `data-act="compose:${r.p}"`) : ''}${C.iconBtn('dots', L('More', 'المزيد'), `data-act="member-menu:${r.p}"`)}</span>`]}))
    }),

    attendance: () => attendanceMatrix(g,d),

    meetings: () => `<div class="stack" style="gap:16px">
      ${d.meetings.map(m => `<section class="panel"><div class="panel-h">
        <h3>${fmtLong(new Date(m.d))} · ${m.t}</h3>
        <span class="row" style="gap:8px">${m.done ? status('closed') : status('scheduled')}
          ${C.iconBtn('edit',L('Edit meeting','تعديل الاجتماع'),`data-meeting-edit="${esc(meetingId(m))}"`)}</span></div>
        <div class="panel-b">${m.done
          ? `<div class="row" style="gap:24px;flex-wrap:wrap">
              <div><div class="t-caption dim">${L('Present', 'حاضر')}</div><div style="font:600 22px/28px var(--sans)">${Object.keys(m.attendance||{}).length ? Object.values(m.attendance).filter(x=>x==='present').length : m.present || 0}</div></div>
              <div style="flex:1;min-width:200px"><div class="t-caption dim">${L('Absent, with a reason', 'غائب بعذر')}</div>
                ${(m.absent||[]).map(([p, en, ar]) => `<div class="row" style="gap:8px;margin-top:6px">${avatar(person(p), 'avatar-sm')}
                  <span class="t-caption">${esc(isAr() ? person(p).ar : person(p).lat)} — ${esc(L(en, ar))}</span></div>`).join('')}</div>
            </div>`
          : `<div class="grid g3" style="gap:10px">
              ${[[L('Yes', 'نعم'), m.rsvp.yes], [L('No', 'لا'), m.rsvp.no], [L('No reply', 'بلا ردّ'), m.rsvp.none]]
                .map(([k, v]) => `<div class="card card-flat" style="padding:12px"><div class="t-caption dim">${esc(k)}</div>
                  <div style="font:600 20px/26px var(--sans)">${v}</div></div>`).join('')}</div>
             <div class="row" style="gap:8px;margin-top:14px">
               <button class="btn btn-secondary btn-dense" data-act="remind:group">${L('Send a reminder', 'إرسال تذكير')}</button>
               <a class="btn btn-primary btn-dense" href="#/groups/${esc(g.id)}/attendance">${L('Take attendance', 'تسجيل الحضور')}</a></div>`}
        </div></section>`).join('')}
      <button class="btn btn-secondary" data-act="meeting-new">${icon('plus', 17)}${L('Schedule a recurring meeting', 'جدولة اجتماع متكرّر')}</button>
    </div>`,

    posts: () => `<div class="splitview">
      <div class="stack" style="gap:16px">
        ${panel(L('Announcements', 'الإعلانات'), d.posts.map(p => `<div style="padding:4px 0">
          <div class="row" style="gap:10px">${avatar(person(p.by), 'avatar-sm')}
            <span><b style="font:500 13px/18px var(--sans)">${esc(isAr() ? person(p.by).ar : person(p.by).lat)}</b>
            <small class="t-caption dim" style="display:block">${fmtDate(p.at)}</small></span></div>
          <p class="t-body" style="font-size:14px;margin-top:10px">${esc(L(p.body, p.bodyAr))}</p></div>`).join('') +
          `<div class="divider"></div>${C.richText('')}
           <button class="btn btn-primary btn-dense" style="margin-top:12px" data-act="post-add">${L('Post', 'نشر')}</button>`)}
      </div>
      <div class="sidecol">${panel(L('Files and learning resources', 'الملفات وموارد التنشئة'),
        d.files.map(([en, ar, size]) => `<div class="listrow" style="padding-inline:0">${icon('doc', 17, 'dimmer')}
          <span class="grow"><b>${esc(isAr() ? ar : en)}</b><small class="mono">${size}</small></span>
          ${C.iconBtn('export', L('Open', 'فتح'), `data-act="doc:${isAr() ? ar : en}"`)}</div>`).join('') + `<div class="divider"></div>${C.dropzone('gfiles')}`)}
      </div></div>`,

    belongings: () => `${C.inlineAlert('info', L('Physical belongings, linked to resource management', 'مقتنيات مادية، مرتبطة بإدارة الموارد'),
        L('What the group owns and where it is kept, so a handover does not lose the cupboard key.',
          'ما تملكه المجموعة وأين يُحفظ، كي لا يضيع مفتاح الخزانة عند التسليم.'))}
      <div style="margin-top:16px">${table({
        cols: [{ label: L('Item', 'الصنف') }, { label: L('Quantity', 'العدد'), cls: 'num' },
               { label: L('Kept in', 'محفوظ في') }, { label: '', cls: 'shrink' }],
        rows: d.belongings.map(([en, ar, n, we, wa]) => ({ cells: [
          `<b>${esc(L(en, ar))}</b>`, `<span class="num">${n}</span>`, `<span class="dim">${esc(L(we, wa))}</span>`,
          `<button class="btn btn-secondary btn-dense" data-go="facilities">${L('In resources', 'في الموارد')}</button>`]}))
      })}</div>`,

    tasks: () => `<div style="max-width:760px">${panel(L('Tasks and follow-ups', 'المهام والمتابعات'),
      d.tasks.map((tk, ki) => `<div class="listrow" style="padding-inline:0">
        <label class="check" style="min-height:0"><input type="checkbox" data-task="${ki}" ${tk.done ? 'checked' : ''}><span class="sr">done</span></label>
        <span class="grow"><b style="${tk.done ? 'text-decoration:line-through;color:var(--text-2)' : ''}">${esc(L(tk.what, tk.whatAr))}</b>
          <small class="mono">${L('due', 'حتى')} ${fmtDate(tk.due)}</small></span>
        ${avatar(person(tk.who), 'avatar-sm')}</div>`).join('') +
      `<button class="btn btn-secondary btn-dense" style="margin-top:14px" data-act="task-add">${icon('plus', 15)}${L('Add task', 'إضافة مهمة')}</button>`,
      { tight: false })}</div>`,

    formation: () => `${C.inlineAlert('info', L('Voluntary formation, never a ranking', 'تنشئة اختيارية، لا ترتيب'),
        L('Milestones record training that was completed. They do not measure anyone’s faith or worth, and nobody is ranked by them.',
          'تسجّل المحطات تدريباً أُنجز. وهي لا تقيس إيمان أحد أو قيمته، ولا يُرتَّب بها أحد.'))}
      <div style="margin-top:16px">${table({
        cols: [{ label: L('Milestone', 'المحطة') }, { label: L('Completed by', 'أنجزها'), cls: 'num' }, { label: '', cls: 'shrink' }],
        rows: d.milestones.map(([en, ar, n], mi) => ({ cells: [
          `<b>${esc(L(en, ar))}</b>`,
          `<span style="display:block;min-width:140px"><span class="t-caption dim tnum">${n} / ${g.members}</span>
            <span class="meter" style="margin-top:6px"><i style="width:${Math.round(n / g.members * 100)}%"></i></span></span>`,
          `<button class="btn btn-secondary btn-dense" data-act="milestone:${mi}">${L('Record', 'تسجيل')}</button>`]}))
      })}</div>`,

    history: () => `<div style="max-width:720px">${panel(L('Membership and leadership history', 'سجل العضوية والمسؤوليات'), `
      <div class="timeline">${d.history.map(([en, ar, when]) => `<div class="tl-item">
        <div class="when">${fmtDate(when)}</div><div class="what">${esc(L(en, ar))}</div></div>`).join('')}
        <div class="tl-item"><div class="when">${fmtDate('2024-09-01')}</div>
          <div class="what">${L('Age-group transition: 4 members moved up from Youth', 'انتقال فئة عمرية: انتقل ٤ أعضاء من الشبيبة')}</div></div></div>
      <div class="divider"></div>
      <p class="t-caption dim">${L(
        'A leadership handover moves the role, not the person’s history. Ongoing tasks follow the role to whoever takes it, and the permission review runs automatically.',
        'تسليم المسؤولية ينقل الدور لا تاريخ الشخص. والمهام الجارية تتبع الدور إلى من يتسلّمه، وتُراجَع الصلاحيات تلقائياً.')}</p>
      <button class="btn btn-secondary btn-dense" style="margin-top:12px" data-act="handover">${L('Start a handover', 'بدء تسليم')}</button>`)}</div>`
  };

  return head + (T[tab] || T[''])();
}

const ATTENDANCE_OPTIONS = [
  ['', 'Not recorded', 'غير مسجّل'], ['present','Present','حاضر'], ['excused','Excused','معذور'], ['absent','Absent','غائب']
];

function memberAttendancePct(meetings,pid) {
  const values=meetings.map(m=>attendanceValue(m,pid)).filter(Boolean);
  return values.length ? `${Math.round(values.filter(x=>x==='present').length/values.length*100)}%` : '—';
}

function attendanceMatrix(g,d) {
  if(S.ui.attendanceGroup!==g.id){S.ui.attendanceGroup=g.id;S.ui.attendancePeriod=null;}
  const latest=d.meetings.slice().sort((a,b)=>b.d.localeCompare(a.d))[0]?.d?.slice(0,7) || iso(TODAY).slice(0,7);
  const period=S.ui.attendancePeriod || latest;
  const meetings=d.meetings.filter(m=>m.d.startsWith(period)).sort((a,b)=>b.d.localeCompare(a.d));
  const rosterIds=new Set(d.roster.map(r=>r.p));
  const formerIds=[...new Set(meetings.flatMap(m=>Object.keys(m.attendance||{})).filter(pid=>!rosterIds.has(pid)))];
  const visibleRoster=[...d.roster,...formerIds.map(p=>({p,former:true}))];
  const counts=attendanceCounts(meetings,d.roster);
  for(const meeting of meetings)for(const pid of formerIds){const value=attendanceValue(meeting,pid);if(value)counts[value]++;}
  const recorded=counts.present+counts.excused+counts.absent;
  const [year,mo]=period.split('-').map(Number);
  const periodLabel=new Intl.DateTimeFormat(isAr()?'ar-LB':'en-US',{month:'long',year:'numeric'}).format(new Date(year,mo-1,1));
  return `<div class="toolbar" style="margin:16px 0;gap:8px;flex-wrap:wrap">
    <div class="row" style="gap:6px">${C.iconBtn('chevL',L('Previous month','الشهر السابق'),'data-attendance-shift="-1"')}
      <b style="min-width:130px;text-align:center">${esc(periodLabel)}</b>
      ${C.iconBtn('chevR',L('Next month','الشهر التالي'),'data-attendance-shift="1"')}</div>
    <input class="input" type="search" data-attendance-search placeholder="${esc(L('Find a member','ابحث عن عضو'))}" aria-label="${esc(L('Find a member','ابحث عن عضو'))}" style="max-width:230px">
    <span class="t-caption dim">${recorded}/${meetings.length*d.roster.length + formerIds.reduce((n,pid)=>n+meetings.filter(m=>attendanceValue(m,pid)).length,0)} ${L('recorded','مسجّل')} · ${counts.present} ${L('present','حاضر')} · ${counts.excused} ${L('excused','معذور')} · ${counts.absent} ${L('absent','غائب')}</span>
    <button class="btn btn-primary btn-dense" data-act="meeting-new">${icon('plus',15)}${L('Add meeting','إضافة اجتماع')}</button>
  </div>
  ${!meetings.length ? empty('calendar',L('No meetings this month','لا اجتماعات هذا الشهر'),L('Add a meeting or choose another month.','أضف اجتماعاً أو اختر شهراً آخر.')) :
    !visibleRoster.length ? empty('groups',L('No group members yet','لا أعضاء في المجموعة بعد'),L('Add members to start attendance.','أضف أعضاء لبدء تسجيل الحضور.')) :
    `<div class="attendance-scroll" style="overflow:auto;max-width:100%;border:1px solid var(--border);border-radius:var(--r-card)">
      <table class="attendance-table" style="border-collapse:separate;border-spacing:0;width:100%;min-width:max-content">
        <caption class="sr">${esc(L(g.name,g.ar))} — ${esc(periodLabel)} ${L('attendance','الحضور')}</caption>
        <thead><tr><th class="attendance-name" style="position:sticky;inset-inline-start:0;top:0;z-index:3;background:var(--muted);padding:10px;text-align:start;min-width:200px">${L('Member','العضو')}</th>
          ${meetings.map(m=>`<th style="position:sticky;top:0;z-index:2;background:var(--muted);padding:8px;min-width:138px;text-align:center">
            <span class="mono">${fmtDate(m.d)}</span><br><small class="dim">${esc(m.t)}</small>
            ${C.iconBtn('edit',L('Edit meeting','تعديل الاجتماع'),`data-meeting-edit="${esc(meetingId(m))}"`)}</th>`).join('')}</tr></thead>
        <tbody>${visibleRoster.map(r=>{const p=person(r.p);return `<tr data-attendance-member="${esc(`${p?.lat||''} ${p?.ar||''}`.toLowerCase())}">
          <th class="attendance-name" scope="row" style="position:sticky;inset-inline-start:0;z-index:1;background:var(--surface);padding:9px 10px;text-align:start;border-top:1px solid var(--border)">
            <button class="btn btn-ghost btn-dense" data-attendance-history="${esc(r.p)}" style="text-align:start">${esc(L(p?.lat||r.p,p?.ar||r.p))}</button>
            ${r.former?`<small class="dim" style="display:block">${L('Former member','عضو سابق')}</small>`:''}</th>
          ${meetings.map(m=>{const value=attendanceValue(m,r.p);return `<td style="padding:6px;border-top:1px solid var(--border);text-align:center">
            <select class="select attendance-cell" data-attendance="${esc(meetingId(m))}|${esc(r.p)}" data-status="${value||'unrecorded'}" ${r.former?'disabled':''}
              aria-label="${esc(L(p?.lat||r.p,p?.ar||r.p))} — ${fmtDate(m.d)}" style="min-width:118px;font-weight:600">
              ${ATTENDANCE_OPTIONS.map(([v,en,ar])=>`<option value="${v}" ${value===v?'selected':''}>${L(en,ar)}</option>`).join('')}</select></td>`;}).join('')}</tr>`;}).join('')}</tbody>
      </table></div>`}
    <p class="t-caption dim" style="margin-top:10px">${L('Each cell belongs to a group member and meeting. Changes save as you select a status.','كل خانة مرتبطة بعضو واجتماع. تُحفظ التغييرات عند اختيار الحالة.')}</p>`;
}

groups.mount = host => {
  C.wire(host); wireTables(host);
  host.querySelectorAll('[data-attendance-shift]').forEach(b=>b.addEventListener('click',()=>{
    const d=groupInfo(S.params[0]).meetings.slice().sort((a,b)=>b.d.localeCompare(a.d))[0]?.d?.slice(0,7) || iso(TODAY).slice(0,7);
    const [y,m]=(S.ui.attendancePeriod || d).split('-').map(Number), next=new Date(y,m-1+Number(b.dataset.attendanceShift),1);
    S.ui.attendancePeriod=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`;bus.refresh();
  }));
  host.querySelector('[data-attendance-search]')?.addEventListener('input',e=>{
    const query=e.target.value.trim().toLowerCase();
    host.querySelectorAll('[data-attendance-member]').forEach(row=>{row.hidden=!row.dataset.attendanceMember.includes(query);});
  });
  host.querySelectorAll('[data-attendance]').forEach(select=>select.addEventListener('change',()=>{
    const [mid,pid]=select.dataset.attendance.split('|'), meeting=groupInfo(S.params[0]).meetings.find(m=>meetingId(m)===mid);
    if(!meeting)return; meeting.attendance ||= {};
    if(select.value)meeting.attendance[pid]=select.value;else delete meeting.attendance[pid];
    select.dataset.status=select.value || 'unrecorded';
    if(Object.keys(meeting.attendance).length)meeting.done=true;
    bus.refresh();
    toast(L('Attendance saved','حُفظ الحضور'),`${fmtDate(meeting.d)} · ${L(select.value || 'Not recorded',
      {'present':'حاضر','excused':'معذور','absent':'غائب'}[select.value] || 'غير مسجّل')}`,'success');
  }));
  host.querySelectorAll('[data-attendance-history]').forEach(b=>b.addEventListener('click',()=>{
    const pid=b.dataset.attendanceHistory,p=person(pid),rows=groupInfo(S.params[0]).meetings.slice().sort((a,c)=>c.d.localeCompare(a.d));
    openDrawer({title:L(p?.lat||pid,p?.ar||pid),sub:L('Group attendance history','سجل حضور المجموعة'),
      body:rows.map(m=>`<div class="listrow" style="padding-inline:0"><span class="grow">${fmtDate(m.d)} · ${esc(m.t)}</span>
        ${pill(L(...(ATTENDANCE_OPTIONS.find(x=>x[0]===attendanceValue(m,pid))||ATTENDANCE_OPTIONS[0]).slice(1)))}</div>`).join('') || `<p>${L('No meetings yet','لا اجتماعات بعد')}</p>`,
      foot:`<button class="btn btn-secondary" data-close>${L('Close','إغلاق')}</button>`});
  }));
  host.querySelectorAll('[data-meeting-edit]').forEach(b=>b.addEventListener('click',()=>F.meetingEdit(b.dataset.meetingEdit)));
  host.querySelectorAll('[data-task]').forEach(c => c.addEventListener('change', () => VERBS['task-toggle'](c, c.dataset.task)));
  host.querySelector('#qr')?.addEventListener('click', () => openModal({
    title: L('Group signup code', 'رمز انتساب المجموعة'),
    sub: L('A revocable link that opens a controlled registration flow. It is not a way into anyone’s record.',
           'رابط قابل للإلغاء يفتح مسار تسجيل مضبوطاً. وليس مدخلاً إلى سجل أحد.'),
    body: `<div style="display:grid;place-items:center;padding:8px 0">
        <div style="width:150px;height:150px;border:1px solid var(--border);border-radius:var(--r-card);
          display:grid;place-items:center;background:var(--muted);color:var(--text-3)">${icon('qr', 64)}</div></div>
      <div class="formgrid" style="margin-top:16px">
        <div class="formrow"><label class="label">${L('Expires', 'ينتهي')}</label>
          <select class="select"><option>${L('In 7 days', 'بعد ٧ أيام')}</option><option>${L('In 30 days', 'بعد ٣٠ يوماً')}</option>
            <option>${L('Never', 'أبداً')}</option></select></div>
        ${C.stepper({ label: L('Capacity', 'السعة'), value: 30, id: 'qrcap' })}
      </div>
      ${C.checkRow(L('Require approval before someone joins', 'اشتراط الموافقة قبل الانتساب'), { checked: true })}`,
    foot: `<button class="btn btn-danger-quiet" data-act="qr-revoke">${L('Revoke code', 'إلغاء الرمز')}</button>
      <button class="btn btn-primary" style="margin-inline-start:auto" data-act="print">${L('Print', 'طباعة')}</button>`,
    onMount(el) { C.wire(el); }
  }));
};

/* ═══════════════ 8 · volunteers ═══════════════ */
const VTABS = () => [['', 'Rota', 'المناوبات'], ['people', 'Volunteers', 'المتطوّعون', VOLUNTEERS.length],
               ['sheets', 'Sign-up sheets', 'لوائح التطوّع', SIGNUP_SHEETS.length], ['hours', 'Hours', 'الساعات']];

export function volunteers(tab = '') {
  const teams = is('leader') ? ROTA.teams.filter(tm => tm.leader === 'p3') : ROTA.teams;
  const head = pageHead({
    crumbs: [{ label: L('Parish life', 'حياة الرعية') }, { label: L('Volunteers', 'المتطوّعون') }],
    title: is('leader') ? L('My teams — Sunday Mass 10:30', 'فرقي — قدّاس الأحد ١٠:٣٠') : L('Volunteers', 'المتطوّعون'),
    sub: L('Accept, decline, swap. A volunteer does not need an account — they can be added by hand and reached on WhatsApp.',
           'قبول واعتذار وتبديل. المتطوّع لا يحتاج حساباً — يمكن إضافته يدوياً والوصول إليه عبر واتساب.'),
    actions: `<button class="btn btn-secondary" data-act="remind:rota">${icon('msg', 17)}${L('Remind everyone', 'تذكير الجميع')}</button>
      <button class="btn btn-primary" data-act="vol-add">${icon('plus', 17)}${L('Add volunteer', 'إضافة متطوّع')}</button>`
  }) + tabBar('volunteers', VTABS(), tab);

  if (tab === 'people') return head + `<div class="tabbody">
    ${(() => { const miss = VOLUNTEERS.filter(v => v.clearance === 'missing').length, exp = VOLUNTEERS.filter(v => v.clearance === 'expiring').length;
      return miss || exp ? C.inlineAlert('warning',
        L(`${miss} clearance${miss === 1 ? ' is' : 's are'} missing and ${exp} expire${exp === 1 ? 's' : ''} within 30 days`, `${miss} إفادة ناقصة و${exp} تنتهي خلال ٣٠ يوماً`),
        L('Anyone without a valid safeguarding clearance cannot be scheduled to a team that works with children.',
          'من لا يحمل إفادة حماية سارية لا يمكن إسناده إلى فريق يعمل مع الأطفال.')) : ''; })()}
    <div>${table({
      cols: [{ label: L('Volunteer', 'المتطوّع'), sort: true }, { label: L('Skills', 'المهارات'), cls: 'hide-sm' },
             { label: L('Available', 'التوفّر'), cls: 'hide-md' }, { label: L('Safeguarding', 'الحماية'), cls: 'shrink' },
             { label: L('Hours', 'الساعات'), cls: 'num', sort: true }, { label: '', cls: 'shrink' }],
      rows: VOLUNTEERS.map(v => ({ cells: [
        who(person(v.p)),
        `<span class="row" style="gap:4px;flex-wrap:wrap">${(isAr() ? v.skillsAr : v.skills).map(s => `<span class="chip">${esc(s)}</span>`).join('')}</span>`,
        `<span class="dim t-caption">${v.avail.join(' · ')}</span>`,
        v.clearance === 'valid' ? pill(L('Valid', 'سارية'), 'success')
          : v.clearance === 'expiring' ? pill(L('Expiring', 'تنتهي قريباً'), 'warning', 'st-wait') : pill(L('Missing', 'ناقصة'), 'danger'),
        `<span class="num">${v.hours}</span>`,
        `<span class="row" style="gap:6px;justify-content:flex-end"><button class="btn btn-secondary btn-dense" data-vol="${v.p}">${L('Open', 'فتح')}</button>${CR.recBtn('volunteer', v.p)}</span>`]})),
      empty: empty('vol', L('No volunteers yet', 'لا متطوّعين بعد'), L('Add the people who serve — no account needed.', 'أضف من يخدمون — لا حاجة إلى حساب.'),
        `<button class="btn btn-primary btn-dense" data-act="vol-add">${L('Add volunteer', 'إضافة متطوّع')}</button>`)
    })}</div>
    <p class="t-caption dim" style="margin-top:16px">${L(
      'A high load is flagged for a human to look at. ParishLife does not diagnose burnout and never penalises anyone automatically.',
      'يُعلَّم العبء المرتفع لينظر فيه إنسان. ولا يشخّص «حياة الرعية» الإنهاك ولا يعاقب أحداً تلقائياً.')}</p></div>`;

  if (tab === 'sheets') return head + `<div class="tabbody">
    <div class="toolbar"><button class="btn btn-secondary" data-act="rec-new:sheet" style="margin-inline-start:auto">${icon('plus', 17)}${L('New sign-up sheet', 'لائحة تطوّع جديدة')}</button></div>
    ${SIGNUP_SHEETS.length ? '' : empty('vol', L('No sign-up sheets', 'لا لوائح تطوّع'), L('Open one when the parish needs hands for a date — readers, servers, a lunch team.', 'افتح واحدة حين تحتاج الرعية إلى أيادٍ لموعد — قرّاء، خدّام، فريق غداء.'))}
    ${SIGNUP_SHEETS.map(s => `<section class="panel"><div class="panel-b">
      <div class="row" style="gap:12px;flex-wrap:wrap"><div style="flex:1;min-width:200px">
        <b style="font:600 15px/21px var(--sans)">${esc(L(s.what, s.whatAr))}</b>
        <div class="t-caption dim" style="margin-top:3px">${L('closes', 'يقفل')} ${fmtDate(s.deadline)}</div></div>
        ${s.taken >= s.slots ? status('ready') : pill(`${s.slots - s.taken} ${L('left', 'متبقٍ')}`, 'warning')}${CR.recBtn('sheet', s.id)}</div>
      <span class="meter" style="margin-top:12px"><i style="width:${Math.round(s.taken / s.slots * 100)}%"></i></span>
      <div class="row" style="gap:8px;margin-top:14px">
        <span class="t-caption dim">${s.taken} / ${s.slots} ${L('places taken', 'مركزاً مأخوذاً')}</span>
        <button class="btn btn-secondary btn-dense" style="margin-inline-start:auto" data-act="invite:sheet|${s.id}" ${s.taken >= s.slots ? 'disabled' : ''}>${L('Invite more', 'دعوة المزيد')}</button>
        <button class="btn btn-primary btn-dense" data-act="sheet-open:${s.id}">${L('Open sheet', 'فتح اللائحة')}</button></div>
    </div></section>`).join('')}</div>`;

  if (tab === 'hours') return head + `<div style="margin-top:20px" class="splitview">
    ${panel(L('Service hours, this year', 'ساعات الخدمة، هذه السنة'), C.barChart(
      VOLUNTEERS.map(v => ({ label: isAr() ? person(v.p).ar : person(v.p).lat, v: v.hours, max: 140, text: `${v.hours} h` }))))}
    <div class="sidecol">
      ${panel(L('Recognition', 'التقدير'), `<p class="t-body dim" style="font-size:14px">${L(
        'Optional and never automatic. A parish can thank people; ParishLife will not rank them.',
        'اختياري وغير تلقائي أبداً. تستطيع الرعية أن تشكر؛ ولن يرتّب «حياة الرعية» أحداً.')}</p>
        <button class="btn btn-secondary btn-dense" style="margin-top:12px" data-act="print">${L('Print thank-you cards', 'طباعة بطاقات شكر')}</button>`)}
      ${panel(L('Workload flags', 'تنبيهات العبء'), `<div class="listrow" style="padding-inline:0">
        ${who(person('p12'))}<span class="grow"></span>${pill(L('3 teams this week', '٣ فرق هذا الأسبوع'), 'warning')}</div>
        <p class="t-caption dim" style="margin-top:10px">${L('Shown to the leader for a conversation, not acted on by the system.',
          'تُعرَض على المسؤول للحوار، ولا يتصرّف النظام بناءً عليها.')}</p>`)}
    </div></div>`;

  /* rota board — sheet 04: drag a person onto a role. Green dot confirmed, amber awaiting
     reply, red border a double-booking; a swap request is a pending badge on the card. */
  const onTeams = id => ROTA.teams.filter(tm => tm.filled.some(f => f.p === id && f.s !== 'declined'));
  const cols = teams.map(tm => {
    const ti = ROTA.teams.indexOf(tm);
    const cards = tm.filled.map((f, si) => {
      const at = `${ti}|${si}`;
      if (!f.p) return `<button class="rota-slot" data-accept="any" data-slot="${at}" data-act="rota-fill:${at}">
        <span class="idle">${L(`Assign ${tm.one}`, `إسناد ${tm.oneAr}`)}</span><span class="rel">${L('Release here', 'أفلت هنا')}</span></button>`;
      const p = person(f.p), also = onTeams(f.p).filter(x => x !== tm)[0];
      const dbl = f.s !== 'declined' && !!also;
      const sub = f.s === 'declined' ? L('Declined', 'اعتذر')
        : dbl ? L(`Also on ${also.team}`, `أيضاً في ${also.teamAr}`)
        : f.s === 'pending' ? L('Awaiting confirmation', 'بانتظار التأكيد') : L(p.town, p.townAr);
      return `<div class="rota-card ${f.s}${dbl ? ' dbl' : ''}" draggable="true" data-slot="${at}" data-accept="${f.s === 'declined' ? 'any' : 'card'}">
        ${avatar(p, 'avatar-sm')}
        <span class="rc-t"><b title="${esc(isAr() ? p.ar : p.lat)}">${esc(isAr() ? p.ar : p.lat)}</b><small>${esc(sub)}</small></span>
        ${f.swap ? `<button class="rota-swap" data-act="rota-swap:${at}">${L('Swap', 'تبديل')}</button>` : ''}
        ${f.s === 'declined' ? '' : `<span class="rdot ${f.s}" role="img" aria-label="${f.s === 'accepted' ? L('Confirmed', 'مؤكَّد') : L('Awaiting reply', 'بانتظار الردّ')}"></span>`}
        ${f.s === 'declined' ? `<button class="rota-sub" data-sub="${p.id}">${L('Shortlist substitutes', 'اقتراح بدلاء')}</button>` : ''}
        <span class="rc-acts"><button class="btn btn-secondary btn-dense" data-act="rota-fill:${at}">${L('Replace','استبدال')}</button>
        <button class="btn btn-ghost btn-dense" data-act="rota-remove:${at}">${L('Remove','إزالة')}</button></span>
      </div>`;
    }).join('');
    const ok = tm.filled.filter(f => f.p && f.s === 'accepted').length;
    return `<section class="rota-col"><header><b>${esc(L(tm.team, tm.teamAr))}</b><small>${esc(L(tm.one,tm.oneAr))}</small>
      <small class="${ok < tm.need ? 'short' : ''}">${L(`${ok} of ${tm.need} confirmed`, `${ok} من ${tm.need} مؤكَّد`)}</small></header>
      <div class="rota-list">${cards}</div></section>`;
  }).join('');
  const tray = VOLUNTEERS.map(v => person(v.p)).map(p => `<span class="rota-chip" draggable="true" data-p="${p.id}">
      ${avatar(p, 'avatar-xs')}${esc(isAr() ? p.ar : p.lat)}</span>`).join('');
  const places = teams.flatMap(tm => tm.filled);
  const open = places.filter(f => !f.p || f.s === 'declined');

  return head + `<div class="stats" style="margin:20px 0 24px">
      ${stat(L('Places', 'المراكز'), places.length, teams.length === 1 ? L('in one team', 'في فريق واحد') : L(`across ${teams.length} teams`, `في ${teams.length} فرق`))}
      ${stat(L('Confirmed', 'مؤكَّد'), places.filter(f => f.p && f.s === 'accepted').length, L('accepted the invitation', 'قبلوا الدعوة'))}
      ${stat(L('Still open', 'ما زال شاغراً'), open.length, !open.length ? L('every place is covered', 'كل المراكز مغطّاة')
        : open.some(f => f.s === 'declined') ? `<span class="down">${L('one declined late', 'اعتذار متأخر واحد')}</span>`
        : L('tap a place to invite someone', 'اضغط مركزاً لدعوة أحد'))}
      ${stat(L('Swap requests', 'طلبات التبديل'), places.filter(f => f.swap).length, L('waiting on the leader', 'بانتظار المسؤول'))}
    </div>
    ${panel(`${fmtLong(ROTA.date)} · ${L(ROTA.service, ROTA.serviceAr)}`, `
      <div class="rota-wrap"><div class="rota-tray"><span class="overline">${L('Drag onto a place', 'اسحب إلى مركز')}</span>${tray}</div>
      <div class="rota-board${teams.length < 3 ? ' few' : ''}" tabindex="0" aria-label="${L('Teams — scroll sideways for more', 'الفرق — مرّر جانبياً للمزيد')}">${cols}</div></div>
      <p class="rota-legend"><span><i class="rdot accepted"></i>${L('confirmed', 'مؤكَّد')}</span>
        <span><i class="rdot pending"></i>${L('awaiting reply', 'بانتظار الردّ')}</span>
        <span><i class="rdbl"></i>${L('double-booked', 'حجز مزدوج')}</span>
        <span><i class="rota-swap" aria-hidden="true">${L('Swap', 'تبديل')}</i>${L('swap request', 'طلب تبديل')}</span>
        <span class="dim">${L('On a phone, tap an empty place to invite someone.', 'على الهاتف، اضغط مركزاً شاغراً لدعوة أحد.')}</span></p>`,
      { more: teams.length > 2 ? `<span class="row rota-nav" style="gap:6px">${C.iconBtn('chevL', L('Scroll to earlier teams', 'الفرق السابقة'), 'data-rota-scroll="-1"')}${C.iconBtn('chevR', L('Scroll to more teams', 'المزيد من الفرق'), 'data-rota-scroll="1"')}</span>` : '' })}
    ${C.inlineAlert('info', L('Late cancellations trigger a shortlist', 'الاعتذار المتأخر يُطلق لائحة بدلاء'),
      L('ParishLife proposes volunteers who are free, trained for that team and not already serving twice that week. A human always picks.',
        'يقترح «حياة الرعية» متطوّعين متفرّغين ومدرَّبين لهذا الفريق وغير مناوبين مرّتين في الأسبوع نفسه. والاختيار دائماً بشري.'))}`;
}

volunteers.mount = host => {
  C.wire(host); wireTables(host);
  /* HTML drag and drop: a tray chip or a board card onto an open place (or a card onto a card to swap). */
  const board = host.querySelector('.rota-board')?.closest('.panel');
  if (board) {
    let from = null;
    const clear = () => board.querySelectorAll('.over,.dragging').forEach(x => x.classList.remove('over', 'dragging'));
    const target = e => {
      const tg = e.target.closest?.('[data-accept]');
      return tg && from && tg.dataset.slot !== from.at && (tg.dataset.accept === 'any' || from.at) ? tg : null;
    };
    board.addEventListener('dragstart', e => {
      const el = e.target.closest?.('[draggable=true]'); if (!el) return;
      from = el.dataset.p ? { p: el.dataset.p } : { at: el.dataset.slot };
      e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', el.dataset.p || el.dataset.slot);
      el.classList.add('dragging');
    });
    board.addEventListener('dragover', e => {
      const tg = target(e); if (!tg) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      if (!tg.classList.contains('over')) { clear(); tg.classList.add('over'); }
    });
    board.addEventListener('dragleave', e => { const tg = target(e); if (tg && !tg.contains(e.relatedTarget)) tg.classList.remove('over'); });
    board.addEventListener('drop', e => { const tg = target(e); if (!tg) return; e.preventDefault(); clear(); F.rotaDrop(from, tg.dataset.slot); from = null; });
    board.addEventListener('dragend', () => { clear(); from = null; });
  }
  host.querySelectorAll('[data-sub]').forEach(b => b.addEventListener('click', () => openDrawer({
    title: L('Available substitutes', 'بدلاء متاحون'),
    sub: L('Free at that hour, trained for this team, clearance valid, and not already serving twice this week.',
           'متفرّغون في تلك الساعة، مدرَّبون، إفادتهم سارية، وغير مناوبين مرّتين هذا الأسبوع.'),
    body: ['p16', 'p9', 'p5'].map(id => `<div class="listrow">${who(person(id))}<span class="grow"></span>
        ${pill(L('Clearance valid', 'إفادة سارية'), 'success')}
        <button class="btn btn-secondary btn-dense" data-act="sub-invite:${id}">${L('Invite', 'دعوة')}</button></div>`).join(''),
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>`
  })));
  host.querySelectorAll('[data-vol]').forEach(b => b.addEventListener('click', () => volDrawer(b.dataset.vol)));
  const rb = host.querySelector('.rota-board');
  host.querySelectorAll('[data-rota-scroll]').forEach(b => b.addEventListener('click', () => {
    const step = (rb.querySelector('.rota-col')?.offsetWidth || 280) + 14, way = document.documentElement.dir === 'rtl' ? -1 : 1;
    rb.scrollBy({ left: +b.dataset.rotaScroll * step * way, behavior: 'smooth' });
  }));

};

function volDrawer(id) {
  const v = VOLUNTEERS.find(x => x.p === id), p = person(id);
  if (!v || !p) return;
  openDrawer({
    title: isAr() ? p.ar : p.lat,
    sub: L('Volunteer record — skills, availability and eligibility', 'سجل متطوّع — المهارات والتوفّر والأهلية'),
    body: `<dl class="dl">
        <dt>${L('Skills', 'المهارات')}</dt><dd>${(isAr() ? v.skillsAr : v.skills).join(', ')}</dd>
        <dt>${L('Available', 'التوفّر')}</dt><dd>${v.avail.join(' · ')}</dd>
        <dt>${L('Training', 'التدريب')}</dt><dd>${v.training.join(', ') || '—'}</dd>
        <dt>${L('Service hours', 'ساعات الخدمة')}</dt><dd class="mono">${v.hours}</dd>
        <dt>${L('Assignments', 'الإسنادات')}</dt><dd class="mono">${v.assignments}</dd>
      </dl>
      <div class="divider"></div>
      ${v.clearance === 'valid'
        ? C.inlineAlert('success', L('Safeguarding clearance valid', 'إفادة الحماية سارية'), L(`Until ${fmtDate(v.until)}.`, `حتى ${fmtDate(v.until)}.`))
        : v.clearance === 'expiring'
        ? C.inlineAlert('warning', L('Clearance expires soon', 'الإفادة تنتهي قريباً'), L(`Expires ${fmtDate(v.until)}. Renew before the next rota.`, `تنتهي ${fmtDate(v.until)}. جدّدها قبل المناوبة التالية.`))
        : C.inlineAlert('danger', L('No safeguarding clearance on file', 'لا إفادة حماية في الملف'), L('Cannot be scheduled to any team that works with children.', 'لا يمكن إسناده إلى أي فريق يعمل مع الأطفال.'))}
      <p class="t-caption dim" style="margin-top:14px">${L(
        'Who may see this documentation is controlled separately from who may schedule the team.',
        'من يرى هذه المستندات يُضبط بمعزل عمّن يجدول الفريق.')}</p>`,
    foot: `<button class="btn btn-danger-quiet" data-act="rec-del:volunteer|${id}">${icon('trash', 16)}${L('Remove', 'إزالة')}</button>
      <button class="btn btn-secondary" data-close style="margin-inline-start:auto">${L('Close', 'إغلاق')}</button>
      <button class="btn btn-primary" data-act="vol-edit:${id}">${L('Edit', 'تعديل')}</button>`
  });
}

/* ═══════════════ 9 · registration & payments ═══════════════ */
const RTABS = () => [['', 'Forms', 'الاستمارات'], ['builder', 'Form', 'الاستمارة'], ['registrants', 'Registrants', 'المسجّلون', REGISTRANTS.length],
               ['payments', 'Payments', 'الدفعات'], ['refunds', 'Refunds', 'الاسترجاعات', REFUNDS.length]];

export function registrations(tab = '') {
  const selected=selectedRegistration(), chosenEvent=linkedEvent(selected), selectedRows=registrantsFor(selected);
  const head = pageHead({
    crumbs: [{ label: L('Parish life', 'حياة الرعية') }, { label: L('Registrations', 'التسجيلات') }],
    title: L('Registration and payments', 'التسجيل والدفع'),
    sub: L('Registration signs a participant up for a selected event. Check-in records their arrival at that same event.',
           'التسجيل يضيف مشتركاً إلى حدث محدّد. التسجيل عند الباب يثبت وصوله إلى الحدث نفسه.'),
    actions: `<button class="btn btn-primary" data-act="form-new">${icon('plus', 17)}${L('New form', 'استمارة جديدة')}</button>`
  }) + tabBar('registrations', RTABS(), tab) + (tab ? `<div class="toolbar" style="margin:18px 0"><label class="label" for="registration-select">${L('Registration form','استمارة التسجيل')}</label>
    <select class="select" id="registration-select" style="max-width:360px"><option value="">${L('Select a form','اختر استمارة')}</option>
    ${REGISTRATIONS.map(f=>`<option value="${esc(f.id)}" ${selected?.id===f.id?'selected':''}>${esc(L(f.event,f.eventAr))}</option>`).join('')}</select></div>
    ${chosenEvent?`<div class="card card-flat" style="padding:12px;margin-bottom:18px"><b>${esc(L(chosenEvent.title,chosenEvent.titleAr))}</b> · ${fmtDate(chosenEvent.d)} ${esc(chosenEvent.t)} · ${esc(L(eventVenue(chosenEvent)?.name||'',eventVenue(chosenEvent)?.ar||''))}</div>`:''}` : '');

  if(tab && !selected)return head+`<div class="tabbody">${empty('registr',L('Select a registration form','اختر استمارة تسجيل'),L('Choose the event form above. No default event is selected.','اختر استمارة الحدث أعلاه. لا يُحدّد حدث افتراضياً.'))}</div>`;
  if(tab && !chosenEvent)return head+`<div class="tabbody">${C.inlineAlert('warning',L('This legacy form is not linked to an event','هذه الاستمارة القديمة غير مرتبطة بحدث'),
    L('Review it and link an eligible event before editing fields or checking in participants. Existing registrations are preserved.','راجعها واربطها بحدث صالح قبل تعديل الحقول أو تسجيل وصول المشتركين. تبقى التسجيلات القديمة محفوظة.'))}
    <button class="btn btn-secondary" data-act="rec-edit:registration|${esc(selected.id)}" style="margin-top:12px">${L('Link event','ربط حدث')}</button></div>`;

  if (tab === 'builder') return head + `<div style="margin-top:20px" class="splitview">
    <div>${panel(L(selected.event, selected.eventAr), selected.fields.map(([en, ar, type, req, he, ha], fi) => `
      <div class="listrow" style="padding-inline:0;align-items:flex-start">
        <span style="color:var(--text-3);margin-top:2px">${icon(type === 'file' ? 'doc' : type === 'person' ? 'people' : type === 'date' ? 'events' : type === 'restricted' ? 'shield' : 'forms', 17)}</span>
        <span class="grow"><b>${esc(L(en, ar))}${req ? ' <span style="color:var(--danger)">*</span>' : ''}</b>
          ${he ? `<small style="white-space:normal">${esc(L(he, ha || he))}</small>` : ''}</span>
        <span class="chip">${esc(type)}</span>${C.iconBtn('dots', L('Field options', 'خيارات الحقل'), `data-act="field-menu:${fi}"`)}</div>`).join('') +
      `<button class="btn btn-secondary btn-dense" style="margin-top:14px" data-act="field-add">${icon('plus', 15)}${L('Add field', 'إضافة حقل')}</button>`,
      { tight: false })}
      <p class="t-caption dim" style="margin-top:12px">${L(
        'Fixed field types first. A drag-and-drop designer comes once real forms have been tested on real registrations.',
        'أنواع حقول ثابتة أولاً. ومصمّم السحب والإفلات يأتي بعد اختبار استمارات حقيقية على تسجيلات حقيقية.')}</p>
    </div>
    <div class="sidecol">
      ${panel(L('Fee and discounts', 'الرسم والحسومات'), `
        <div class="amount" dir="ltr"><span class="usd">${usd(selected.fee)}</span>
          <span class="lbp">L.L ${num(selected.fee * 89500)}</span></div>
        <div class="divider"></div>
        ${(selected.discounts||[]).map(([en, ar, v]) => `<div class="listrow" style="padding-inline:0">
          <span class="grow">${esc(L(en, ar))}</span><b class="mono">${v}</b></div>`).join('')}
        <div class="ac-group" style="padding-inline:0">${L('Instalments', 'أقساط')}</div>
        ${(selected.installments||[]).map(([en, ar, v]) => `<div class="listrow" style="padding-inline:0">
          <span class="grow">${esc(L(en, ar))}</span><b class="mono">${usd(v)}</b></div>`).join('')}`)}
      ${panel(L('Registration confirmation', 'تأكيد التسجيل'), `
        <p class="t-body dim">${L('A saved participant appears under Registrants for this event. Automated confirmation delivery is not connected.',
          'يظهر المشترك المحفوظ في قائمة المسجّلين لهذا الحدث. إرسال التأكيد تلقائياً غير موصول.')}</p>`)}
    </div></div>`;

  if (tab === 'registrants') return head + `<div class="tabbody">
    <div class="toolbar" style="margin-bottom:14px;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary" data-register-participant ${!selected.open||selected.taken>=selected.cap?'disabled':''}>${icon('plus',16)}${L('Register participant','تسجيل مشترك')}</button>
      <button class="btn btn-secondary" data-select-checkin="${esc(chosenEvent.id)}">${L('Open event check-in','فتح تسجيل الوصول للحدث')}</button>
    </div>${table({
    pick: true,
    cols: [{ label: L('Participant', 'المشترك'), sort: true }, { label: L('Consent', 'الموافقة'), cls: 'shrink' },
           { label: L('Transport', 'النقل'), cls: 'hide-sm' }, { label: L('Paid', 'المدفوع'), cls: 'num' },
           { label: L('Status', 'الحالة'), cls: 'shrink' }],
    rows: selectedRows.map(r => ({ cells: [
      who(person(r.p)),
      r.consent ? pill(L('Signed', 'موقَّعة'), 'success') : pill(L('Missing', 'ناقصة'), 'warning'),
      `<span class="dim">${r.transport === 'bus' ? L('Bus (+$5)', 'باص (+٥$)') : L('Own car', 'سيارة خاصة')}</span>`,
      `<span class="num">${usd(r.paid)}</span>`, status(r.status)]})),
    empty:empty('registr',L('No participants registered yet','لا مشتركون مسجّلون بعد'),
      L('Choose Register participant above to reserve the first place for this event.','اختر تسجيل مشترك أعلاه لحجز المقعد الأول لهذا الحدث.'))
  })}
  ${!selected.open?C.inlineAlert('info',L('Registration is closed','التسجيل مغلق'),L('Open the form before adding participants.','افتح الاستمارة قبل إضافة المشتركين.')):
    selected.taken>=selected.cap?C.inlineAlert('warning',L('Event capacity reached','بلغ الحدث سعته'),L('Increase the reviewed capacity before adding participants.','زد السعة بعد مراجعتها قبل إضافة مشتركين.')):''}
  <p class="t-caption dim" style="margin-top:16px">${L(
    'Use the participant reference in this event’s check-in session. A registration records a place; check-in records arrival.',
    'استعمل مرجع المشترك في جلسة الوصول الخاصة بهذا الحدث. يثبت التسجيل المقعد، ويثبت تسجيل الوصول الحضور.')}</p></div>`;

  if (tab === 'payments') return head + `<div style="margin-top:20px" class="splitview">
    ${panel(L('Recorded payments', 'الدفعات المسجَّلة'), table({
      cols: [{ label: L('Participant', 'المشترك') }, { label: L('Method', 'الطريقة'), cls: 'hide-sm' },
             { label: L('Amount', 'المبلغ'), cls: 'num' }, { label: L('Status', 'الحالة'), cls: 'shrink' }],
      rows: selectedRows.map(r => ({ cells: [who(person(r.p)), `<span class="dim">${L('Not recorded', 'غير مسجّلة')}</span>`,
        `<span class="num">${usd(r.paid)}</span>`, status(r.status)]}))
    }), { tight: true })}
    <div class="sidecol">${panel(L('Providers', 'مزوّدو الدفع'), `
      <p class="t-body dim" style="font-size:14px">${L(
        'Cash and bank transfers are recorded by hand with the currency they were paid in. An online provider is added only after supported countries, fees and refund behaviour have been confirmed.',
        'النقد والتحاويل تُسجَّل يدوياً بعملة الدفع. ولا يُضاف مزوّد إلكتروني إلا بعد تثبيت الدول المدعومة والرسوم وسلوك الاسترجاع.')}</p>
      <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><span class="chip chip-on">${L('Cash', 'نقداً')}</span>
        <span class="chip chip-on">${L('Bank transfer', 'تحويل')}</span><span class="chip">OMT</span>
        <span class="chip">${L('Card — not connected', 'بطاقة — غير موصولة')}</span></div>`)}</div></div>`;

  if (tab === 'refunds') return head + `<div class="tabbody">${table({
    cols: [{ label: L('Participant', 'المشترك') }, { label: L('Reason', 'السبب') }, { label: L('Amount', 'المبلغ'), cls: 'num' },
           { label: L('Status', 'الحالة'), cls: 'shrink' }, { label: L('Date', 'التاريخ'), cls: 'hide-sm' }],
    rows: REFUNDS.map(r => ({ cells: [who(person(r.p)), `<span class="dim">${esc(L(r.why, r.whyAr))}</span>`,
      `<span class="num">${usd(r.amount)}</span>`, status(r.status), `<span class="mono dim">${fmtDate(r.at)}</span>`]}))
  })}
  <p class="t-caption dim" style="margin-top:16px">${L(
    'A refund reverses the contribution rather than deleting it, so the counting session it belonged to still balances.',
    'الاسترجاع يعكس المساهمة ولا يحذفها، فتبقى جلسة العدّ التي تنتمي إليها متوازنة.')}</p></div>`;

  const rows = REGISTRATIONS.map(r => {
    const pct = r.cap ? Math.min(100,Math.round(r.taken / r.cap * 100)) : 0;
    return { cells: [
      `<b>${esc(L(r.event, r.eventAr))}</b>${!linkedEvent(r)?`<small class="dim" style="display:block">${L('Legacy form · link an event before use','استمارة قديمة · اربطها بحدث قبل الاستخدام')}</small>`:''}`,
      `<span style="display:block;min-width:150px"><span class="t-caption dim tnum">${r.taken} / ${r.cap}</span>
        <span class="meter" style="margin-top:6px"><i style="width:${pct}%"></i></span></span>`,
      r.waiting ? pill(`${r.waiting} ${L('waiting', 'بالانتظار')}`, 'warning') : '<span class="dimmer">—</span>',
      r.fee ? `<span class="num">${usd(r.fee)}</span>` : `<span class="dim">${L('Free', 'مجاني')}</span>`,
      `<span class="dim">${fmtDate(r.deadline)}</span>`,
      r.open ? status('open') : status('draft'),
      `<span class="row" style="gap:6px;justify-content:flex-end"><button class="btn btn-secondary btn-dense" data-open-registration="${esc(r.id)}">${L('Open', 'فتح')}</button>${CR.recBtn('registration', r.id)}</span>`
    ]};
  });

  return head + `<div class="tabbody">${table({
      cols: [{ label: L('Event', 'الحدث'), sort: true }, { label: L('Capacity', 'السعة') },
             { label: L('Waiting', 'الانتظار'), cls: 'hide-sm' }, { label: L('Fee', 'الرسم'), cls: 'num hide-sm' },
             { label: L('Closes', 'يقفل'), cls: 'hide-md' }, { label: L('Status', 'الحالة'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
      rows,
      empty: empty('registr', L('No registration forms', 'لا استمارات تسجيل'), L('Create one for a retreat, a lunch or a catechism year.', 'أنشئ واحدة لخلوة أو غداء أو سنة تعليم.'),
        `<button class="btn btn-primary btn-dense" data-act="form-new">${L('New form', 'استمارة جديدة')}</button>`)
    })}</div>`;
}

registrations.mount = host => {
  C.wire(host); wireTables(host);
  host.querySelector('[data-register-participant]')?.addEventListener('click',()=>F.registerParticipant());
  host.querySelector('#registration-select')?.addEventListener('change',e=>{selectRegistration(e.target.value);bus.refresh();});
  host.querySelectorAll('[data-open-registration]').forEach(b=>b.addEventListener('click',()=>{selectRegistration(b.dataset.openRegistration);go('registrations/registrants');}));
  host.querySelectorAll('[data-select-checkin]').forEach(b=>b.addEventListener('click',()=>{selectCheckinEvent(b.dataset.selectCheckin);go('checkin');}));
  host.querySelector('#regqr')?.addEventListener('click', () => openModal({
    title: L('Registration code', 'رمز التسجيل'),
    sub: L('Opens the form, and the reference it issues connects the attendee to the right check-in session.',
           'يفتح الاستمارة، والرقم الذي يصدره يربط المشترك بجلسة التسجيل الصحيحة.'),
    body: `<div style="display:grid;place-items:center;padding:8px 0">
      <div style="width:150px;height:150px;border:1px solid var(--border);border-radius:var(--r-card);
        display:grid;place-items:center;background:var(--muted);color:var(--text-3)">${icon('qr', 64)}</div></div>`
  }));
};

/* ═══════════════ 10 · check-in & safeguarding ═══════════════ */
const CTABS = () => [['', 'Room', 'الصف'], ['pickup', 'Pickup', 'الاستلام'], ['incidents', 'Incidents', 'الحوادث', INCIDENTS.length],
               ['evacuation', 'Evacuation', 'الإخلاء']];

export function checkin(tab = '') {
  const kiosk = is('volunteer');
  const chosenEvent=selectableCheckinEvents().find(e=>e.id===S.ui.checkinEventId);
  const session=selectedCheckin()||{rows:[],present:0,expected:chosenEvent?REGISTRANTS.filter(r=>REGISTRATIONS.some(f=>f.id===r.registrationId&&f.eventId===chosenEvent.id)).length:0,awaitingGuardian:0,room:chosenEvent?.venue};
  const eventParticipants=new Set(chosenEvent?REGISTRANTS.filter(r=>REGISTRATIONS.some(f=>f.id===r.registrationId&&f.eventId===chosenEvent.id)).map(r=>r.p):[]);
  const expected=eventParticipants.size;
  const head = pageHead({
    crumbs: kiosk ? [{ label: L('Station', 'المحطة') }, { label: L('Check-in', 'التسجيل') }]
                  : [{ label: L('Parish life', 'حياة الرعية') }, { label: L('Check-in', 'التسجيل عند الباب') }],
    title: chosenEvent?L(chosenEvent.title,chosenEvent.titleAr):L('Check-in','تسجيل الوصول'),
    sub: chosenEvent?`${fmtDate(chosenEvent.d)} ${esc(chosenEvent.t)} · ${esc(L(eventVenue(chosenEvent)?.name||'',eventVenue(chosenEvent)?.ar||''))} · <span class="tnum">${session.present}</span>
          ${L('present of', 'حاضر من')} <span class="tnum">${expected}</span>`:
          L('Select the event whose registered participants are arriving. No event is selected by default.','اختر الحدث الذي يصل إليه المشتركون. لا يُحدّد حدث افتراضياً.'),
    actions: chosenEvent?`<button class="btn btn-secondary" data-act="scan">${icon('qr', 17)}${L('Enter reference', 'إدخال الرقم')}</button>
      <button class="btn btn-secondary" id="tags">${icon('print', 17)}${L('Name tags', 'بطاقات الأسماء')}</button>
      ${kiosk ? '' : `<button class="btn btn-primary" data-act="checkin-manual">${icon('plus', 17)}${L('Manual check-in', 'تسجيل يدوي')}</button>`}`:''
  }) + `<div class="toolbar" style="margin:18px 0"><label class="label" for="checkin-event">${L('Check-in event','حدث تسجيل الوصول')}</label>
    <select class="select" id="checkin-event" style="max-width:380px"><option value="">${L('Select event','اختر حدثاً')}</option>
    ${selectableCheckinEvents().map(e=>`<option value="${esc(e.id)}" ${chosenEvent?.id===e.id?'selected':''}>${esc(L(e.title,e.titleAr))} · ${esc(e.d)} ${esc(e.t)} · ${esc(eventVenue(e)?.name||'')}</option>`).join('')}</select></div>` + (kiosk ? '' : tabBar('checkin', CTABS(), tab));

  if(!chosenEvent)return head+`<div class="tabbody">${empty('registr',L('Select an event to check in','اختر حدثاً لتسجيل الوصول'),
    L('Only events with linked registration forms appear above. Mass and feast liturgies are not eligible.','تظهر فقط الأحداث المرتبطة باستمارات تسجيل. القداديس واحتفالات الأعياد غير مشمولة.'))}</div>`;

  if (kiosk) return head + `<div class="panel" style="margin-top:20px"><div class="panel-b" style="max-width:420px;margin-inline:auto">
    <label class="label" style="font-size:15px">${L('Guardian pickup code (4 digits)', 'رمز استلام وليّ الأمر (٤ أرقام)')}</label>
    <p class="help" style="margin:4px 0 12px">${L(
      'Enter the code issued when this participant was checked in to the selected event. This is not your volunteer sign-in password. There is no shared or default pickup code.',
      'أدخل الرمز الصادر عند تسجيل وصول المشترك إلى الحدث المحدّد. هذا ليس كلمة مرور حساب المتطوّع. لا يوجد رمز استلام مشترك أو افتراضي.')}</p>
    <input class="input mono tnum" id="code" readonly value="" dir="ltr"
      style="height:64px;font-size:30px;line-height:62px;text-align:center;letter-spacing:.3em">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px">
      ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="btn btn-secondary" data-k="${n}"
        style="height:64px;font-size:22px;font-family:var(--mono)">${n}</button>`).join('')}
      <button class="btn btn-secondary" data-k="clear" style="height:64px;font-size:14px">${L('Clear', 'مسح')}</button>
      <button class="btn btn-secondary" data-k="0" style="height:64px;font-size:22px;font-family:var(--mono)">0</button>
      <button class="btn btn-secondary" data-k="back" style="height:64px" aria-label="${L('Delete last digit', 'حذف آخر رقم')}">${icon('chevL', 20)}</button>
    </div>
    <button class="btn btn-primary" id="done" style="width:100%;height:64px;font-size:18px;margin-top:16px">${L('Done', 'تمّ')}</button>
    <p class="t-caption dim" style="margin-top:14px;text-align:center">${L(
      'A scanned code alone never authorises release. A person on the door confirms the match.',
      'الرمز الممسوح وحده لا يُجيز التسليم أبداً. الشخص على الباب يؤكّد التطابق.')}</p></div></div>`;

  if (tab === 'pickup') return head + `<div class="tabbody">
    ${C.inlineAlert('warning', L('Check-in and release are separate, auditable actions', 'التسجيل والتسليم إجراءان منفصلان قابلان للتدقيق'),
      L('A restricted entry means do not release, whatever code is presented. Call a member of staff.',
        'القيد المقيَّد يعني عدم التسليم مهما كان الرمز المقدَّم. نادِ أحد الموظّفين.'))}
    <div class="stack" style="gap:16px;margin-top:16px">
      ${Object.entries(PICKUP).filter(([pid])=>eventParticipants.has(pid)).map(([pid, v]) => `<section class="panel"><div class="panel-h">
        ${who(person(pid))}<span style="margin-inline-start:auto"></span>
        ${v.restricted.length ? pill(L('Restricted', 'مقيّد'), 'danger', 'lock') : pill(L('Standard', 'عادي'), 'success')}</div>
        <div class="panel-b">
          <div class="ac-group" style="padding-inline:0">${L('Approved to collect', 'مفوَّضون بالاستلام')}</div>
          ${v.approved.map(([en, ar, rel], ai) => `<div class="listrow" style="padding-inline:0">
            <span class="grow"><b>${esc(isAr() ? ar : en)}</b><small>${esc(rel)}</small></span>
            ${C.iconBtn('trash', L('Remove', 'إزالة'), `data-act="pickup-remove:${pid}|${ai}"`)}</div>`).join('')}
          ${v.restricted.length ? `<div class="divider"></div>
            ${v.restricted.map(([en, ar]) => C.inlineAlert('danger', L('Do not release', 'لا تُسلّم'), L(en, ar))).join('')}` : ''}
          <button class="btn btn-secondary btn-dense" style="margin-top:12px" data-act="pickup-add:${pid}">${icon('plus', 15)}${L('Add an authorised person', 'إضافة شخص مفوَّض')}</button>
        </div></section>`).join('') || `<p class="help">${L('No pickup authorisations are recorded for registered people at this event.','لا توجد تفويضات استلام مسجّلة للمشتركين في هذا الحدث.')}</p>`}
    </div></div>`;

  if (tab === 'incidents') return head + `<div class="tabbody">
    ${C.inlineAlert('info', L('Parish-wide incident log', 'سجل حوادث الرعية'), L('Existing incident reports are parish-wide and are not linked to the selected event. The log is restricted to authorised staff.',
      'تقارير الحوادث الحالية على مستوى الرعية وغير مرتبطة بالحدث المحدّد. يقتصر السجل على الموظفين المخوّلين.'))}
    <div style="margin-top:16px">${table({
      cols: [{ label: L('When', 'الوقت') }, { label: L('Room', 'المكان'), cls: 'hide-sm' }, { label: L('What happened', 'ما حدث') },
             { label: L('Recorded by', 'سجّله'), cls: 'hide-md' }, { label: '', cls: 'shrink' }],
      rows: INCIDENTS.map(i => ({ cells: [
        `<span class="mono dim">${i.at}</span>`, `<span class="dim">${esc(L(venue(i.room).name, venue(i.room).ar))}</span>`,
        esc(L(i.what, i.whatAr)), who(person(i.by)),
        `<button class="btn btn-secondary btn-dense" data-act="incident-open:${i.id}">${L('Open', 'فتح')}</button>`]}))
    })}</div>
    <button class="btn btn-secondary" style="margin-top:16px" data-act="incident-new">${icon('plus', 17)}${L('Record an incident', 'تسجيل حادث')}</button></div>`;

  if (tab === 'evacuation') return head + `<div class="tabbody">
    ${C.inlineAlert('info', L('Selected event roster', 'لائحة الحدث المحدّد'),
      L('This list shows the people currently checked in to this event. It does not count everyone in the building. Emergency message delivery is not connected.',
        'تُظهر هذه اللائحة الموجودين حالياً في هذا الحدث فقط، ولا تشمل كل الموجودين في المبنى. إرسال رسائل الطوارئ غير موصول.'))}
    <div style="margin-top:16px">${panel(L('Present participants', 'المشتركون الحاضرون'), table({
      cols: [{ label: L('Participant', 'المشترك') }, { label: L('Location', 'المكان') }, { label: L('Arrived', 'وقت الوصول') }],
      rows: session.rows.map(row => ({ cells: [who(person(row.p)), esc(L(eventVenue(chosenEvent)?.name||'',eventVenue(chosenEvent)?.ar||'')),
        `<span class="mono">${esc(row.in||'')}</span>`] })),
      empty: empty('people',L('No participants checked in', 'لا مشتركون حاضرون'),L('The event roster updates as participants arrive.', 'تتحدّث لائحة الحدث عند وصول المشتركين.'))
    }), { tight:true })}</div>
    <button class="btn btn-secondary" style="margin-top:14px" data-act="print">${icon('print',17)}${L('Print event roster','طباعة لائحة الحدث')}</button>
  </div>`;

  /* room roster */
  const rows = session.rows.map(r => {
    const p = person(r.p);
    return `<div class="listrow">${who(p)}
      <span class="grow">${r.alert ? `<span class="pill pill-danger"><span class="dot"></span>${esc(r.alert)}</span>` : ''}</span>
      <span class="mono dim" dir="ltr">${L('in', 'دخول')} ${r.in}</span>
      <span class="t-caption dim">${r.guardian&&r.guardian!=='—'?`${L('Guardian', 'وليّ الأمر')}: ${esc(r.guardian)} · `:''}<b class="mono">${r.code}</b></span>
      <button class="btn btn-secondary btn-dense" data-act="checkout:${r.p}">${L('Check out', 'تسجيل خروج')}</button></div>`;
  }).join('');

  return head + `<div class="stats" style="margin:20px 0 24px">
      ${stat(L('Present now', 'الحاضرون الآن'), session.rows.length, `${L('registered','مسجّل')} ${expected}`)}
      ${stat(L('Awaiting guardian', 'بانتظار وليّ الأمر'), session.awaitingGuardian, L('still in the room', 'ما زالوا في الصف'))}
      ${stat(L('Medical alerts', 'تنبيهات طبية'), session.rows.filter(r=>r.alert).length, L('visible to this event’s staff only', 'تظهر لموظّفي هذا الحدث فقط'))}
      ${stat(L('Late pickups', 'تأخّر في الاستلام'), 0, L('none today', 'لا شيء اليوم'))}
    </div>
    ${panel(L('Participants checked in', 'المشتركون الحاضرون'), rows||`<p class="help">${L('No one has checked in yet.','لم يسجّل أحد وصوله بعد.')}</p>`, { tight: true })}
    ${panel(L('How a family can check in', 'كيف تسجّل العائلة'), `
      <div class="grid g4" style="gap:12px">
        ${[['checkin', L('Staffed kiosk', 'كشك بموظّف'), L('A volunteer on the door, with the keypad', 'متطوّع على الباب مع لوحة الأرقام')],
           ['qr', L('QR from the registration', 'رمز من التسجيل'), L('Opens the right session directly', 'يفتح الجلسة الصحيحة مباشرة')],
           ['card', L('Reusable card', 'بطاقة قابلة لإعادة الاستعمال'), L('Printed once, carried by the family', 'تُطبع مرّة وتحملها العائلة')],
           ['doc', L('Manual roster', 'لائحة يدوية'), L('Paper, when the power is out', 'ورقية عند انقطاع الكهرباء')]]
          .map(([ic, a, b]) => `<div class="card card-flat" style="padding:14px">
            <span style="color:var(--primary)">${icon(ic, 20)}</span>
            <b style="display:block;font:500 13px/18px var(--sans);margin-top:8px">${esc(a)}</b>
            <small class="t-caption dim" style="display:block;margin-top:2px">${esc(b)}</small></div>`).join('')}
      </div>
      <p class="t-caption dim" style="margin-top:14px">${L(
        'A scanned code or a card identifies the child. It never authorises release on its own — a person on the door matches the guardian credential every time.',
        'الرمز الممسوح أو البطاقة تُعرّف الطفل فقط. ولا تُجيز التسليم وحدها أبداً — إذ يطابق شخص على الباب بيانات وليّ الأمر في كل مرة.')}</p>`)}
    ${C.inlineAlert('warning', L('A volunteer sees only their assigned room, and only during the session', 'يرى المتطوّع صفّه المسند فقط وخلال الجلسة فقط'),
      L('Every release, exception and override is recorded with the name of whoever approved it.',
        'كل تسليم واستثناء وتجاوز يُسجَّل باسم من وافق عليه.'))}`;
}

checkin.mount = host => {
  C.wire(host); wireTables(host);
  host.querySelector('#checkin-event')?.addEventListener('change',e=>{selectCheckinEvent(e.target.value);bus.refresh();});
  host.querySelector('#tags')?.addEventListener('click', () => openModal({
    title: L('Print name tags', 'طباعة بطاقات الأسماء'),
    sub: L('Choose what goes on the label. Nothing beyond what the room needs.', 'اختر ما يظهر على البطاقة. لا شيء يتجاوز حاجة الصف.'),
    body: `<div class="stack" style="gap:10px">
        ${C.checkRow(L('First name', 'الاسم الأول'), { checked: true })}
        ${C.checkRow(L('Room', 'الصف'), { checked: true })}
        ${C.checkRow(L('Guardian code', 'رمز وليّ الأمر'), { checked: true })}
        ${C.checkRow(L('Medical alert symbol (no detail)', 'رمز تنبيه طبي (بلا تفاصيل)'), { checked: true })}
        ${C.checkRow(L('Full name and phone', 'الاسم الكامل والهاتف'), { note: L('not recommended', 'غير مستحسن') })}</div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" data-act="print">${L('Print', 'طباعة')}</button>`,
    onMount(el) { C.wire(el); }
  }));
  const code = host.querySelector('#code');
  if (!code) return;
  host.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.k;
    if (k === 'clear') code.value = '';
    else if (k === 'back') code.value = code.value.slice(0, -1);
    else if (code.value.length < 4) code.value += k;
  }));
  host.querySelector('#done').addEventListener('click', () => {
    if (code.value.length < 4) return toast(L('Enter four digits', 'أدخل أربعة أرقام'), '', 'warning');
    const match=selectedCheckin()?.rows?.find(row=>row.code===code.value);
    match?toast(L('Code matches','الرمز مطابق'),`${person(match.p)?.lat||''} · ${L('Confirm identity before release.','تحقّق من الهوية قبل التسليم.')}`,'success'):
      toast(L('No match', 'لا تطابق'), L('Call a member of staff. Do not release.', 'نادِ أحد الموظّفين. لا تُسلّم.'), 'danger');
    code.value = '';
  });
};
