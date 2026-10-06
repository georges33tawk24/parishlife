/* Modules 3, 4, 6, 8, 9, 10 — groups, calendar, services, volunteers,
   registration and check-in. */
import { t, isAr, num, usd, fmtDate, fmtLong, dayShort, month } from '../i18n.js';
import { is, S, go, bus } from '../store.js';
import { icon, pageHead, sectionH, panel, who, status, pill, esc, table, wireTables, empty, amount,
         searchField, openDrawer, openModal, closeOverlays, toast, stat, avatar, tabBar, openMenu } from '../ui.js';
import * as C from '../components.js';
import * as CR from '../crud.js';
import { VERBS, download } from '../actions.js';
import { parishAPI, session } from '../api.js';
import { persist } from '../persist.js';
import { safeRichText } from '../rich-text.js';
import * as F from '../flows.js';
import { printWeekDialog, priestScheduleDialog } from '../schedules.js';
import { allPlans, currentPlan, workingPlan, planDirty, savePlanDraft, normalizePlanOrder, planTotalMinutes,
  meetingId, attendanceCounts, attendanceValue } from '../planning.js';
import { eligibleEvents, eventById, selectedRegistration, selectRegistration, registrantsFor, linkedEvent,
  selectableCheckinEvents, selectCheckinEvent, selectedCheckin, ensureCheckinSession, eventVenue } from '../event-workflows.js';
import { EVENTS, EVENT_DETAIL, PEOPLE, FEASTS, GROUPS, GROUP_DETAIL, groupInfo, eventInfo, ROTA, REGISTRATIONS, REG_FORM, REGISTRANTS, REFUNDS,
         CHECKIN, PICKUP, INCIDENTS, VENUES, TODAY, VOLUNTEERS, SIGNUP_SHEETS,
         SERVICE_REQUESTS, SERVICE_TEMPLATES, EVENT_TEMPLATES, MUSIC,
         person, venue, group, initials } from '../data.js';

/* Month shown on the calendar: October 2026 moved by the prev / next buttons. */
const calMonth = () => { const d = new Date(2026, 9 + S.ui.calOffset, 1); return { y: d.getFullYear(), m: d.getMonth() }; };
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const L = (en, ar) => t(en, ar);
const byTime = (a, b) => (a.d + a.t).localeCompare(b.d + b.t);
const meetingKind = m => m.kind === 'committee' ? L('Committee / people in charge','اللجنة / المسؤولون') : L('Whole group','المجموعة كاملة');
const MINISTRY_ROLES=[['President','رئيس'],['Vice President','نائب رئيس'],['Secretary','أمين السرّ'],['Treasurer','أمين الصندوق'],['Responsible of Apostolic Mission','وكيل الرسالة'],['Responsible for Christian Education','وكيل التنشئة والثقافة المسيحية'],['Social Media Manager','وكيل الإعلام'],['Consultant','مستشار'],['Advisor','موجّه'],['Group Monitor','مسؤول فريق'],['Trainer','مدرّب في معهد التنشئة والتدريب'],['Trainee','طالب في معهد التنشئة والتدريب'],['Member','عضو']];
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
      <button class="btn btn-secondary" id="printweek">${icon('print', 17)}${L('Print my schedule', 'اطبع جدولي')}</button>
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
  if(is('leader')) {
    const meetings=GROUPS.flatMap(g=>groupInfo(g.id).meetings.map(m=>({g,m}))).sort((a,b)=>(a.m.d+a.m.t).localeCompare(b.m.d+b.m.t));
    return pageHead({crumbs:[{label:L('My ministry','خدمتي')},{label:L('Service planning','تخطيط الخدمة')}],
      title:L('Ministry planning','تخطيط الخدمة'),sub:L('Plan your group meetings and the music for each one.','خطّط لاجتماعات مجموعتك والموسيقى لكل اجتماع.'),
      actions:`<button class="btn btn-primary" data-leader-meeting-new ${GROUPS.length?'':'disabled'}>${icon('plus',17)}${L('Add meeting','إضافة اجتماع')}</button>`})+
      `<div class="toolbar" style="margin:16px 0"><span class="t-caption dim">${L('Choose a group meeting to manage its details and attendance.','اختر اجتماع مجموعة لإدارة التفاصيل والحضور.')}</span></div>
      ${GROUPS.map(g=>panel(L(g.name,g.ar),table({cols:[{label:L('Meeting','الاجتماع')},{label:L('When','الموعد')},{label:L('Type / place','النوع / المكان')},
        {label:L('Music','الموسيقى')},{label:'',cls:'shrink'}],rows:meetings.filter(row=>row.g.id===g.id).map(({m})=>({cells:[
          `<b>${esc(m.title||L('Ministry meeting','اجتماع الخدمة'))}</b>`,`${fmtDate(m.d)} · ${esc(m.t)}`,
          `${esc(meetingKind(m))}${m.place?` · ${esc(m.place)}`:''}`,
          (m.hymns||[]).map(id=>MUSIC.find(item=>item.id===id)).filter(Boolean).map(h=>esc(L(h.title,h.ar))).join(', ')||'—',
          `<a class="btn btn-secondary btn-dense" href="#/groups/${esc(g.id)}/meetings">${L('Open meeting','افتح الاجتماع')}</a>`]}))}),{tight:true})).join('')}
      ${!meetings.length?empty('calendar',L('No meetings yet','لا اجتماعات بعد'),L('Schedule one from your group page.','جدول اجتماعاً من صفحة مجموعتك.')):''}`;
  }
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

  if (tab === '') {
    const f=S.ui.serviceFilter||{};
    const plans=allPlans().filter(p=>(!f.status||p.status===f.status)&&(!f.from||p.date>=f.from)&&(!f.to||p.date<=f.to)&&
      (!f.search||`${p.title} ${p.titleAr} ${venue(p.venue)?.name||''}`.toLocaleLowerCase().includes(f.search.toLocaleLowerCase())));
    return head + `<div class="tabbody"><div class="toolbar" style="margin-bottom:16px;gap:10px;flex-wrap:wrap">
      <label class="formrow" style="margin:0;min-width:220px;flex:1"><span class="label">${L('Find a service','ابحث عن خدمة')}</span><input class="input" data-service-filter="search" value="${esc(f.search||'')}" placeholder="${L('Name or place','الاسم أو المكان')}"></label>
      <label class="formrow" style="margin:0"><span class="label">${L('Status','الحالة')}</span><select class="select" data-service-filter="status">${[['','All statuses','كل الحالات'],['draft','Draft','مسودة'],['scheduled','Scheduled','مجدول'],['ready','Ready','جاهز'],['completed','Completed','منجز']].map(([v,en,ar])=>`<option value="${v}" ${f.status===v?'selected':''}>${L(en,ar)}</option>`).join('')}</select></label>
      <label class="formrow" style="margin:0"><span class="label">${L('From','من')}</span><input class="input" type="date" data-service-filter="from" value="${esc(f.from||'')}"></label>
      <label class="formrow" style="margin:0"><span class="label">${L('Through','حتى')}</span><input class="input" type="date" data-service-filter="to" value="${esc(f.to||'')}"></label></div>
      <p class="t-caption dim" style="margin-bottom:10px">${plans.length} ${L('plans shown','خطط معروضة')}</p>${table({
    cols:[{label:L('Service','الخدمة')},{label:L('When','الموعد')},{label:L('Type / room','النوع / المكان')},{label:L('Status','الحالة')},{label:'',cls:'shrink'}],
    rows:plans.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(p=>({cells:[
      `<b>${esc(L(p.title,p.titleAr))}</b>`, `<span class="mono">${fmtDate(p.date)} ${esc(p.time || '')}</span>`,
      `${esc(L(venue(p.venue)?.name || '',venue(p.venue)?.ar || ''))} · ${esc(L(p.language,p.languageAr))}`,
      status(p.status || 'scheduled'), `<a class="btn btn-secondary btn-dense" href="#/services/plan/${esc(p.id)}">${L('Open plan','فتح الخطة')}</a>`]}))})}</div>`;
  }

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
    return `<div class="oos-row" data-service-row="${oi}" ${canEdit ? 'draggable="true"' : ''} style="padding:14px 16px;min-height:70px;gap:14px"><span class="dur">${oi+1}. ${esc(o.start||'—')} · ${o.dur}'</span>
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
  host.querySelectorAll('[data-service-filter]').forEach(input=>input.addEventListener(input.type==='text'?'input':'change',()=>{
    const key=input.dataset.serviceFilter,value=input.value,pos=input.selectionStart;
    S.ui.serviceFilter={...(S.ui.serviceFilter||{}),[key]:value};
    host.innerHTML=services('');services.mount(host);
    if(input.type==='text'){const replacement=host.querySelector(`[data-service-filter="${key}"]`);replacement?.focus();replacement?.setSelectionRange(pos,pos);}
  }));
  if(is('leader')){
    host.querySelector('[data-leader-meeting-new]')?.addEventListener('click',()=>{
      if(GROUPS.length===1)return F.meetingNew(GROUPS[0].id);
      openModal({title:L('Choose ministry','اختر الخدمة'),body:`<div class="gridcards">${GROUPS.map(g=>`<button class="panel card-link" style="cursor:pointer;text-align:start;padding:18px" data-leader-group="${esc(g.id)}"><b>${esc(L(g.name,g.ar))}</b></button>`).join('')}</div>`,
        foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button>`,
        onMount(el){el.querySelectorAll('[data-leader-group]').forEach(button=>button.addEventListener('click',()=>{closeOverlays();F.meetingNew(button.dataset.leaderGroup);}));}});
    });return;
  }
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
function groupCards(items, tab = '') {
  return items.map(g => {
    const leader = person(g.leader);
    const visTone = g.vis === 'confidential' ? 'danger' : g.vis === 'private' ? 'warning' : '';
    const visLabel = g.vis === 'confidential' ? L('Confidential', 'سرّي') : g.vis === 'private' ? L('Private', 'خاص') : L('Public', 'عام');
    return `<section class="panel card-link" data-find-item><div class="panel-b">
      <div class="row" style="gap:10px;align-items:flex-start">
        <span class="avatar avatar-lg">${icon('groups', 20)}</span>
        <div style="flex:1;min-width:0">
          <a class="stretch" href="#/groups/${esc(g.id)}${tab ? `/${tab}` : ''}"><b style="display:block;font:600 16px/22px var(--sans)">${esc(L(g.name, g.ar))}</b></a>
          <small class="t-caption dim">${esc(L(g.cat, g.catAr))}${g.meets ? ` · ${esc(L(g.meets, g.meetsAr))}` : ''}</small></div>
        ${!is('leader') ? CR.recBtn('group', g.id) : ''}</div>
      <div class="divider"></div>
      <div class="row" style="gap:10px">${who(leader)}<span class="row" style="gap:8px;margin-inline-start:auto">${pill(visLabel, visTone, g.vis === 'public' ? true : 'lock')}
        <span class="badge badge-quiet" title="${L('members', 'أعضاء')}">${g.members}</span></span></div>
    </div></section>`;
  }).join('');
}

export function groups(id, tab) {
  if (id) return groupDetail(id, tab || '');
  const cards = groupCards(GROUPS); // the API has already scoped leaders to their own groups

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
               ['posts', 'Posts & files', 'المنشورات والملفات'], ['belongings', 'Resources', 'الموارد'],
               ['tasks', 'Tasks', 'المهام'], ['formation', 'Formation', 'التنشئة'], ['history', 'History', 'السجل']];

function groupGone() {
  return `${pageHead({ crumbs: [{ label: L('Groups', 'المجموعات'), href: '#/groups' }], title: L('Group not found', 'المجموعة غير موجودة') })}
    ${empty('groups', L('This group no longer exists', 'هذه المجموعة لم تعد موجودة'), L('It may have been deleted. Its members keep their records.', 'ربما حُذفت. ويحتفظ أعضاؤها بسجلاتهم.'),
      `<a class="btn btn-primary btn-dense" href="#/groups">${L('All groups', 'كل المجموعات')}</a>`)}`;
}

function meetingAttendance(m) {
  const values = Object.values(m.attendance || {});
  if (values.length) return {
    present: Math.max(m.present || 0, values.filter(value => value === 'present').length),
    excused: values.filter(value => value === 'excused').length + (m.absent || []).filter(([pid]) => !(pid in (m.attendance || {}))).length,
    absent: values.filter(value => value === 'absent').length
  };
  return { present: m.present || 0, excused: (m.absent || []).length, absent: 0 };
}

function meetingCard(g, m) {
  const date = new Date(`${m.d}T12:00:00`);
  const monthLabel = new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-US', { month: 'short' }).format(date);
  const upcoming = !m.done && m.d >= iso(new Date());
  const rsvp = m.rsvp || {};
  const counts = meetingAttendance(m);
  return `<section class="meeting-card">
    <div class="meeting-date"><strong>${esc(new Intl.DateTimeFormat(isAr() ? 'ar-LB' : 'en-US', { day: 'numeric' }).format(date))}</strong><span>${esc(monthLabel)}</span></div>
    <div class="meeting-content">
      <div class="meeting-heading"><div><p class="meeting-eyebrow">${fmtLong(date)}</p>
        <h3>${esc(m.title||L('Group meeting','اجتماع المجموعة'))}</h3><p class="meeting-time">${esc(meetingKind(m))} · ${icon('events',15)}<span dir="ltr">${esc(m.t || '—')}${m.end?`–${esc(m.end)}`:''}</span>${m.place?` · ${esc(m.place)}`:''}</p></div>
        <div class="meeting-heading-actions">${m.done ? status('closed') : upcoming ? status('scheduled') : pill(L('Attendance needed','الحضور مطلوب'),'warning')}
          ${C.iconBtn('edit',L('Edit meeting','تعديل الاجتماع'),`data-meeting-edit="${esc(meetingId(m))}"`)}</div></div>
      <div class="meeting-summary">${m.done
        ? `${attendanceTag('present',counts.present)}${attendanceTag('excused',counts.excused)}${attendanceTag('absent',counts.absent)}`
        : upcoming ? `<span class="meeting-rsvp"><b>${Number(rsvp.yes)||0}</b>${L('Going','سيحضرون')}</span><span class="meeting-rsvp"><b>${Number(rsvp.no)||0}</b>${L('Not going','لن يحضروا')}</span><span class="meeting-rsvp"><b>${Number(rsvp.none)||0}</b>${L('No reply','بلا ردّ')}</span>`
        : `<span class="t-caption dim">${L('Record attendance to close this meeting.','سجّل الحضور لإقفال هذا الاجتماع.')}</span>`}</div>
      ${m.description?`<p class="meeting-description">${esc(m.description)}</p>`:''}
      ${m.hymns?.length?`<p class="meeting-description">${L('Music','الموسيقى')}: ${m.hymns.map(id=>MUSIC.find(h=>h.id===id)).filter(Boolean).map(h=>esc(L(h.title,h.ar))).join(', ')}</p>`:''}
      ${m.done && m.absent?.length ? `<details class="meeting-details"><summary>${L('Excused absence details','تفاصيل الغياب بعذر')}</summary>
        ${m.absent.map(([pid,en,ar])=>`<p>${esc(L(person(pid)?.lat||pid,person(pid)?.ar||pid))} · ${esc(L(en,ar))}</p>`).join('')}</details>` : ''}
      <div class="meeting-actions">${upcoming ? `<button class="btn btn-secondary btn-dense" data-act="remind:group">${L('Send reminder','إرسال تذكير')}</button>` : ''}
        <button class="btn btn-primary btn-dense" data-meeting-review="${esc(meetingId(m))}">${m.done ? L('Review attendance','مراجعة الحضور') : L('Take attendance','تسجيل الحضور')}</button></div>
    </div></section>`;
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
        ${!is('leader')?panel(L('Leadership handover','تسليم المسؤولية'),`<p class="t-caption dim">${L('Transfer the group role and open tasks to an existing member. The person’s history stays intact.','انقل مسؤولية المجموعة ومهامها المفتوحة إلى عضو موجود. يبقى تاريخ الشخص محفوظاً.')}</p>
          <button class="btn btn-secondary btn-dense" style="margin-top:10px" data-act="handover">${L('Start handover','بدء التسليم')}</button>`):''}
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

    roster: () => `<div class="toolbar" style="margin:16px 0;gap:8px;flex-wrap:wrap">
      <div class="search" style="max-width:300px">${icon('search',16)}<input class="input" type="search" data-roster-search placeholder="${L('Search members','ابحث عن الأعضاء')}" aria-label="${L('Search members','البحث عن الأعضاء')}"></div>
      <select class="select" data-roster-filter aria-label="${L('Filter roster','تصفية اللائحة')}" style="max-width:230px"><option value="all">${L('All roles','كل الأدوار')}</option><option value="leaders">${L('People in charge','المسؤولون')}</option><option value="members">${L('Members','الأعضاء')}</option></select></div>
      <div data-roster-list>${table({
      pick: true,
      cols: [{ label: L('Member', 'العضو'), sort: true }, { label: L('Role', 'الدور'), cls: 'hide-sm' },
             { label: L('Joined', 'انتسب'), cls: 'hide-md' }, { label: L('Attendance', 'الحضور'), cls: 'num' }, { label: '', cls: 'shrink' }],
      rows: d.roster.filter(r=>{const q=(S.ui.rosterQuery||'').toLocaleLowerCase(),p=person(r.p),mode=S.ui.rosterFilter||'all',lead=r.role!=='Member';return (!q||`${p?.lat||''} ${p?.ar||''} ${r.role||''}`.toLocaleLowerCase().includes(q))&&(mode==='all'||(mode==='leaders')===lead);}).map(r => ({ cells: [
        `<button type="button" class="btn btn-ghost btn-dense" data-attendance-history="${esc(r.p)}">${esc(L(person(r.p)?.lat||r.p,person(r.p)?.ar||r.p))}</button>`,
        `<span class="dim">${esc(L(r.role, r.roleAr))}</span>`,
        `<span class="mono dim">${r.joined}</span>`,
        `<span class="num">${memberAttendancePct(d.meetings,r.p)}</span>`,
        `<span class="rowacts"><button class="btn btn-secondary btn-dense" data-roster-formation="${esc(r.p)}">${L('Formation','التنشئة')}</button>${!is('leader') ? C.iconBtn('msg', L('Message', 'مراسلة'), `data-act="compose:${r.p}"`) : ''}${C.iconBtn('dots', L('More', 'المزيد'), `data-act="member-menu:${r.p}"`)}</span>`]}))
    })}</div>`,

    attendance: () => attendanceMatrix(g,d),

    meetings: () => {
      const today = iso(new Date());
      const direction=S.ui.meetingReverse?-1:1;
      const upcoming = d.meetings.filter(m => !m.done && m.d >= today).sort((a,b)=>direction*byTime(a,b));
      const earlier = d.meetings.filter(m => m.done || m.d < today).sort((a,b)=>direction*byTime(a,b));
      const calendar=S.ui.meetingView==='calendar';
      const monthKey=S.ui.meetingMonth||today.slice(0,7),[year,monthNumber]=monthKey.split('-').map(Number);
      const first=new Date(year,monthNumber-1,1),days=new Date(year,monthNumber,0).getDate(),offset=first.getDay();
      const monthLabel=new Intl.DateTimeFormat(isAr()?'ar-LB':'en-US',{month:'long',year:'numeric'}).format(first);
      return `<div class="meeting-overview"><div><h2>${L('Ministry meetings','اجتماعات الخدمة')}</h2>
        <p class="t-caption dim">${L('Plan meetings, follow replies, and record attendance in one place.','خطّط للاجتماعات وتابع الردود وسجّل الحضور في مكان واحد.')}</p></div>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn btn-secondary btn-dense" data-meeting-order title="${L('Reverse meeting date order','عكس ترتيب الاجتماعات')}"><span aria-hidden="true">⇅</span>${L(S.ui.meetingReverse?'Newest first':'Oldest first',S.ui.meetingReverse?'الأحدث أولاً':'الأقدم أولاً')}</button>
        <div class="seg"><button data-meeting-view="list" aria-pressed="${!calendar}">${L('List','قائمة')}</button><button data-meeting-view="calendar" aria-pressed="${calendar}">${L('Calendar','رزنامة')}</button></div>
        <button class="btn btn-primary" data-act="meeting-new">${icon('plus',17)}${L('Add meeting','إضافة اجتماع')}</button></div></div>
        ${!d.meetings.length ? empty('calendar',L('No meetings yet','لا اجتماعات بعد'),L('Add the first meeting for this ministry.','أضف أول اجتماع لهذه الخدمة.')) : ''}
        ${calendar?`<div class="toolbar"><button class="btn btn-secondary btn-dense" data-meeting-month="-1" aria-label="${L('Previous month','الشهر السابق')}">${icon('chevL',16)}</button><b>${esc(monthLabel)}</b><button class="btn btn-secondary btn-dense" data-meeting-month="1" aria-label="${L('Next month','الشهر التالي')}">${icon('chevR',16)}</button></div>
        <div class="ministry-calendar-scroll"><div class="cal ministry-calendar"><div class="cal-head">${Array.from({length:7},(_,i)=>`<div>${esc(new Intl.DateTimeFormat(isAr()?'ar-LB':'en-US',{weekday:'short'}).format(new Date(2026,9,4+i)))}</div>`).join('')}</div><div class="cal-grid">${Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>{
          const day=new Date(year,monthNumber-1,i-offset+1),date=iso(day),outside=day.getMonth()!==monthNumber-1;
          const items=d.meetings.filter(m=>m.d===date).sort(byTime);
          return `<div class="cal-day${outside?' out':''}${date===today?' today':''}"><span class="dn">${day.getDate()}</span>${items.map(m=>`<button class="cal-ev ministry-calendar-event" data-meeting-edit="${esc(meetingId(m))}" title="${esc(m.title||L('Group meeting','اجتماع المجموعة'))}"><span>${esc(m.title||L('Group meeting','اجتماع المجموعة'))}</span><small>${esc(m.t)} · ${esc(meetingKind(m))}</small></button>`).join('')}</div>`;
        }).join('')}</div></div></div>`:
        `${upcoming.length ? `<section class="meeting-section"><div class="meeting-section-title"><h3>${L('Upcoming','القادمة')}</h3><span class="badge badge-quiet">${upcoming.length}</span></div>${upcoming.map(m=>meetingCard(g,m)).join('')}</section>` : ''}
        ${earlier.length ? `<section class="meeting-section"><div class="meeting-section-title"><h3>${L('Earlier meetings','الاجتماعات السابقة')}</h3><span class="badge badge-quiet">${earlier.length}</span></div>${earlier.map(m=>meetingCard(g,m)).join('')}</section>` : ''}`}`;
    },

    posts: () => `<div class="splitview">
      <div class="stack" style="gap:16px">
        ${panel(L('Announcements', 'الإعلانات'), `${C.richText('')}
           <button class="btn btn-primary btn-dense" style="margin:12px 0" data-act="post-add">${L('Post', 'نشر')}</button><div class="divider"></div>`+d.posts.map(p => `<div class="group-announcement">
          <div class="row" style="gap:10px">${avatar(person(p.by), 'avatar-sm')}
            <span><b style="font:500 13px/18px var(--sans)">${esc(isAr() ? person(p.by).ar : person(p.by).lat)}</b>
            <small class="t-caption dim" style="display:block">${fmtDate(p.at)}</small></span></div>
          <div class="t-body" style="font-size:14px;margin-top:10px">${p.html?safeRichText(p.html):esc(L(p.body, p.bodyAr))}</div></div>`).join(''))}
      </div>
      <div class="sidecol">${panel(L('Files and learning resources', 'الملفات وموارد التنشئة'),
        d.files.map(([en, ar, size]) => `<div class="listrow" style="padding-inline:0">${icon('doc', 17, 'dimmer')}
          <span class="grow"><b>${esc(isAr() ? ar : en)}</b><small class="mono">${esc(size)} · ${L('Legacy reference; ask the office for the file','مرجع قديم؛ اطلب الملف من المكتب')}</small></span></div>`).join('')+`<div class="divider"></div><div class="group-upload">${C.dropzone('gfiles',{scope:'group',ownerId:g.id})}</div>`)}
      </div></div>`,

    belongings: () => `<div class="toolbar"><p class="t-caption dim">${L('Track ministry-owned items and who has borrowed them.','تابع مقتنيات الخدمة ومن استعارها.')}</p>
      <button class="btn btn-primary btn-dense" data-resource-new>${icon('plus',15)}${L('Add item','إضافة صنف')}</button></div>
      <div class="toolbar ministry-filters"><input class="input" type="search" data-resource-search placeholder="${L('Search items and locations','البحث في الأصناف والأماكن')}" value="${esc(S.ui.resourceQuery||'')}"><button class="btn btn-secondary btn-dense" data-resource-search-button>${L('Search','بحث')}</button><select class="select" data-resource-filter aria-label="${L('Filter resources','تصفية الموارد')}"><option value="all">${L('All items','كل الأصناف')}</option><option value="available">${L('Available','متاح')}</option><option value="loaned">${L('On loan','مُعار')}</option></select></div>
      <div class="gridcards resource-cards">${d.belongings.filter(r=>{const q=(S.ui.resourceQuery||'').toLocaleLowerCase(),lent=d.resourceLoans.filter(l=>l.resourceId===r.id&&!l.returnedAt).reduce((n,l)=>n+l.qty,0),filter=S.ui.resourceFilter||'all';return `${r.name} ${r.ar} ${r.location} ${r.locationAr} ${r.code||''} ${r.description||''}`.toLocaleLowerCase().includes(q)&&(filter==='all'||filter==='available'&&r.qty>lent||filter==='loaned'&&lent>0);}).map(r=>{const lent=d.resourceLoans.filter(l=>l.resourceId===r.id&&!l.returnedAt).reduce((n,l)=>n+l.qty,0);return `<section class="panel"><div class="panel-b"><h3 class="resource-name"><span>${esc(r.name)}</span><span class="dim" lang="ar" dir="rtl">${esc(r.ar||'')}</span></h3>
        <p><b>${r.qty-lent} / ${r.qty}</b> ${L('available','متاح')} ${r.condition?`· ${esc(r.condition)}`:''}</p><p>${L('Stored at','محفوظ في')}: <span>${esc(r.location||'—')}</span> <span class="dim" lang="ar" dir="rtl">${esc(r.locationAr||'')}</span></p>
        ${r.code?`<p>${L('Inventory code','رمز الجرد')}: <b>${esc(r.code)}</b></p>`:''}${r.description?`<p class="t-caption dim" style="margin:8px 0">${esc(r.description)}</p>`:''}
        <div class="row" style="gap:6px;flex-wrap:wrap">${C.iconBtn('edit',L('Edit','تعديل'),`data-resource-edit="${esc(r.id)}"`)}${C.iconBtn('trash',L('Delete','حذف'),`data-resource-delete="${esc(r.id)}"`)}<button class="btn btn-secondary btn-dense" data-resource-lend="${esc(r.id)}" ${r.qty-lent<1?'disabled':''}>${L('Lend','إعارة')}</button></div></div></section>`;}).join('')||`<p class="help">${L('No matching resources.','لا موارد مطابقة.')}</p>`}</div>
      <h3 style="margin:24px 0 10px">${L('Loans','الإعارات')}</h3>
      ${table({cols:[{label:L('Item','الصنف')},{label:L('Borrower','المستعير')},{label:L('Quantity','العدد'),cls:'num'},
        {label:L('Due date','تاريخ الإرجاع')},{label:L('Status','الحالة')},{label:'',cls:'shrink'}],
        rows:d.resourceLoans.slice().reverse().map(l=>({cells:[esc(L(d.belongings.find(r=>r.id===l.resourceId)?.name||'—',d.belongings.find(r=>r.id===l.resourceId)?.ar||'—')),
          esc(l.borrower),String(l.qty),fmtDate(l.due),l.returnedAt?pill(L('Returned','أُعيد'),'success'):
            l.due<iso(new Date())?pill(L('Overdue','متأخر'),'danger'):pill(L('On loan','مُعار'),'warning'),
          l.returnedAt?'':`<span class="row" style="gap:6px"><button class="btn btn-secondary btn-dense" data-resource-loan-edit="${esc(l.id)}">${L('Edit','تعديل')}</button><button class="btn btn-secondary btn-dense" data-resource-return="${esc(l.id)}">${L('Mark returned','تسجيل الإرجاع')}</button></span>`]}))})}`,

    tasks: () => `<div class="ministry-tasks"><div class="toolbar ministry-section-heading"><h2>${L('Notes, tasks and follow-ups','الملاحظات والمهام والمتابعات')}</h2><button class="btn btn-primary btn-dense" data-group-task-new>${icon('plus',15)}${L('Add item','إضافة عنصر')}</button></div>
      <div class="toolbar ministry-filters"><input class="input" type="search" data-group-task-search placeholder="${L('Search notes and tasks','البحث في الملاحظات والمهام')}" value="${esc(S.ui.groupTaskQuery||'')}"><select class="select" data-group-task-filter><option value="all">${L('All','الكل')}</option><option value="pinned">${L('Pinned','مثبّتة')}</option><option value="pending">${L('Pending tasks','مهام معلّقة')}</option><option value="done">${L('Completed','مكتملة')}</option></select></div>
      ${panel('',d.tasks.map((tk,ki)=>({...tk,index:ki})).filter(tk=>{const q=(S.ui.groupTaskQuery||'').toLocaleLowerCase(),filter=S.ui.groupTaskFilter||'all';return `${tk.what} ${tk.whatAr||''}`.toLocaleLowerCase().includes(q)&&(filter==='all'||filter==='pinned'&&tk.pinned||filter==='pending'&&!tk.done&&tk.kind!=='note'||filter==='done'&&tk.done);}).sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||(a.due||'9999').localeCompare(b.due||'9999')).map(tk=>`<div class="listrow pastoral-row" style="padding-inline:0"><button class="btn-icon" data-group-task-done="${tk.index}" ${tk.kind==='note'?'disabled':''} aria-label="${L('Toggle complete','تغيير حالة الإنجاز')}">${icon(tk.kind==='note'?'notes':'check',17)}</button><span class="grow"><b style="${tk.done?'text-decoration:line-through':''}">${esc(L(tk.what,tk.whatAr||tk.what))}</b><small>${tk.kind==='note'?L('Note','ملاحظة'):L('Task','مهمة')}${tk.due?` · ${L('Due','حتى')} ${fmtDate(tk.due)}`:''}${tk.who?` · ${esc(person(tk.who)?.lat||'')}`:''}</small></span><button class="btn-icon" data-group-task-pin="${tk.index}" aria-pressed="${!!tk.pinned}" aria-label="${L(tk.pinned?'Unpin':'Pin',tk.pinned?'إلغاء التثبيت':'تثبيت')}">${icon('pin',17)}</button><button class="btn btn-secondary btn-dense" data-group-task-edit="${tk.index}">${L('Edit','تعديل')}</button><button class="btn-icon" data-group-task-delete="${tk.index}" aria-label="${L('Delete','حذف')}">${icon('trash',16)}</button></div>`).join('')||`<p class="help">${L('No matching items.','لا عناصر مطابقة.')}</p>`,{tight:true})}</div>`,

    formation: () => `${C.inlineAlert('info',L('Formation records, not rankings','سجلات تنشئة، لا تصنيفات'),
      L('Record each member’s completion date and notes. Earlier totals without names remain labelled as historical.','سجّل تاريخ إنجاز كل عضو وملاحظاته. تبقى المجاميع القديمة غير المرتبطة بأسماء موسومة كتاريخية.'))}
      <div class="toolbar" style="margin:16px 0"><span class="t-caption dim">${d.milestones.length} ${L('milestones','محطات')}</span>
        <button class="btn btn-primary btn-dense" data-formation-new>${icon('plus',15)}${L('Add milestone','إضافة محطة')}</button></div>
      ${d.roster.length&&d.milestones.length?`<details class="panel formation-progress" style="margin:12px 0"><summary class="panel-h"><b>${L('Member progress','تقدّم الأعضاء')}</b><span class="more">${L('View members','عرض الأعضاء')} ${icon('chevD',14)}</span></summary><div class="panel-b">${table({
        cols:[{label:L('Member','العضو')},{label:L('Completed','المنجَز'),cls:'num'},{label:L('Still open','المتبقي'),cls:'num'}],
        rows:d.roster.map(r=>{const active=d.milestones.filter(m=>!m.archived),count=active.filter(m=>m.completions?.[r.p]).length;
          return {cells:[esc(L(person(r.p)?.lat||r.p,person(r.p)?.ar||r.p)),`${count} / ${active.length}`,String(active.length-count)]};})})}</div></details>`:''}
      <div class="gridcards formation-cards">${d.milestones.filter(m=>!m.archived).map(m=>{
        const names=Object.entries(m.completions||{}).sort((a,b)=>a[1].date.localeCompare(b[1].date));
        return panel(L(m.name,m.ar),`<p class="t-caption dim">${esc(m.description||'')}</p>
          <div class="row" style="gap:8px;flex-wrap:wrap;margin:10px 0">${pill(`${names.length} ${L('named completions','إنجازات بالأسماء')}`,'success')}
          ${m.legacyCount?pill(`${m.legacyCount} ${L('historical, unassigned','تاريخية بلا أسماء')}`,'warning'):''}</div>
          ${names.length?`<details><summary>${L('View completions','عرض الإنجازات')} · ${names.length}</summary>`+names.map(([pid,record])=>`<div class="listrow" style="padding-inline:0"><span class="grow"><b>${esc(L(person(pid)?.lat||pid,person(pid)?.ar||pid))}</b>
            <small>${fmtDate(record.date)}${record.notes?` · ${esc(record.notes)}`:''}</small></span>
            ${C.iconBtn('edit',L('Edit completion','تعديل الإنجاز'),`data-formation-record="${esc(m.id)}|${esc(pid)}"`)}
            ${C.iconBtn('trash',L('Remove completion','حذف الإنجاز'),`data-formation-remove="${esc(m.id)}|${esc(pid)}"`)}</div>`).join('')+'</details>':
            `<p class="t-caption dim">${L('No named completions yet.','لا إنجازات بأسماء بعد.')}</p>`}
          <div class="formation-card-actions"><button class="btn btn-secondary btn-dense" data-formation-record="${esc(m.id)}">${icon('plus',15)}${L('Record completion','تسجيل إنجاز')}</button></div>`,
          {more:`${C.iconBtn('edit',L('Edit milestone','تعديل المحطة'),`data-formation-edit="${esc(m.id)}"`)}${C.iconBtn('trash',L('Delete milestone','حذف المحطة'),`data-formation-delete="${esc(m.id)}"`)}`});
      }).join('')||empty('doc',L('No formation milestones','لا محطات تنشئة'),L('Add the first training milestone.','أضف أول محطة تدريب.'))}</div>`,

    history: () => `<div style="max-width:720px">${panel(L('Membership and leadership history', 'سجل العضوية والمسؤوليات'), `
      <div class="timeline">${d.history.map(([en, ar, when]) => `<div class="tl-item">
        <div class="when">${fmtDate(when)}</div><div class="what">${esc(L(en, ar))}</div></div>`).join('')}</div>
      <div class="divider"></div>
      <p class="t-caption dim">${L(
        'A leadership handover moves the role, not the person’s history. Ongoing tasks follow the role to whoever takes it, and the permission review runs automatically.',
        'تسليم المسؤولية ينقل الدور لا تاريخ الشخص. والمهام الجارية تتبع الدور إلى من يتسلّمه، وتُراجَع الصلاحيات تلقائياً.')}</p>`)}</div>`
  };

  return head + `<div class="ministry-content">${(T[tab] || T[''])()}</div>`;
}

const ATTENDANCE_OPTIONS = [
  ['', 'Not recorded', 'غير مسجّل'], ['present','Present','حاضر'], ['excused','Excused','معذور'], ['absent','Absent','غائب']
];
const attendanceTag = (value, count) => {
  const option = ATTENDANCE_OPTIONS.find(([key]) => key === value) || ATTENDANCE_OPTIONS[0];
  return `<span class="attendance-tag attendance-${value || 'unrecorded'}"><span class="attendance-dot"></span>${count == null ? '' : `<b>${count}</b>`}${esc(L(option[1],option[2]))}</span>`;
};
function chooseAttendance(anchor, meeting, pid, afterSave = () => {}) {
  openMenu(anchor, ATTENDANCE_OPTIONS.map(([value,en,ar]) => ({
    label:L(en,ar), tone:value || 'unrecorded', fn:() => {
      meeting.attendance ||= {};
      if (value) meeting.attendance[pid] = value;
      else delete meeting.attendance[pid];
      if (value) meeting.done = true;
      bus.refresh();
      afterSave();
    }
  })), {width:190});
}

export function ministryAttendance(){
  return pageHead({crumbs:[{label:L('My ministry','خدمتي')},{label:L('Attendance','الحضور')}],title:L('Attendance','الحضور'),sub:L('Open the attendance register for each group you lead.','افتح سجل الحضور لكل مجموعة تقودها.')})+
    `<div class="gridcards">${groupCards(GROUPS, 'attendance')}</div>`;
}

function meetingReview(mid) {
  const g = group(S.params[0]), d = groupInfo(S.params[0]);
  const meeting = d.meetings.find(m => meetingId(m) === mid);
  if (!g || !meeting) return;
  const rosterIds = d.roster.map(r => r.p).filter(pid=>!meeting.participants?.length||meeting.participants.includes(pid));
  const peopleIds = [...rosterIds, ...Object.keys(meeting.attendance || {}).filter(pid => !rosterIds.includes(pid))];
  const categories = [
    ['present',L('Came','حضروا')], ['excused',L('Excused','معذورون')],
    ['absent',L('Did not come','لم يحضروا')], ['',L('No answer','بلا جواب')]
  ];
  openModal({wide:true,title:L('Meeting attendance','حضور الاجتماع'),
    sub:`${esc(L(g.name,g.ar))} · ${fmtDate(meeting.d)} · ${esc(meeting.t)}`,
    body:`${meeting.present && !Object.values(meeting.attendance||{}).includes('present') ? C.inlineAlert('info',
      L('Historical total without names','مجموع سابق من دون أسماء'),
      L(`${meeting.present} people were recorded as present in the old summary. Their names were not stored, so they are not assigned to a column.`,
        `سُجّل حضور ${meeting.present} أشخاص في الملخّص السابق من دون حفظ أسمائهم، لذلك لم يُوزّعوا على الأعمدة.`)) : ''}
      <div class="meeting-review-grid">${categories.map(([value,label]) => {
        const ids = peopleIds.filter(pid => attendanceValue(meeting,pid) === value);
        return `<section class="meeting-review-column attendance-${value||'unrecorded'}"><h3>${esc(label)} <span>${ids.length}</span></h3>
          <div class="meeting-review-list">${ids.length ? ids.map(pid => `<button type="button" data-review-person="${esc(pid)}">
            ${esc(L(person(pid)?.lat||pid,person(pid)?.ar||pid))}${icon('chevD',14)}</button>`).join('') : `<p>${L('No people here','لا أشخاص هنا')}</p>`}</div></section>`;
      }).join('')}</div>
      <p class="t-caption dim" style="margin-top:14px">${L('Select a person to change their attendance. Changes save immediately.','اختر شخصاً لتغيير حالة حضوره. تُحفظ التغييرات فوراً.')}</p>`,
    foot:`<button class="btn btn-secondary" data-close>${L('Close','إغلاق')}</button>`,
    onMount(el){el.querySelectorAll('[data-review-person]').forEach(button => button.addEventListener('click',
      () => chooseAttendance(button,meeting,button.dataset.reviewPerson,() => meetingReview(mid))));}
  });
}

function memberAttendancePct(meetings,pid) {
  const values=meetings.map(m=>attendanceValue(m,pid)).filter(Boolean);
  return values.length ? `${Math.round(values.filter(x=>x==='present').length/values.length*100)}%` : '—';
}

function attendanceMatrix(g,d) {
  if(S.ui.attendanceGroup!==g.id){S.ui.attendanceGroup=g.id;S.ui.attendancePeriod=null;}
  const latest=d.meetings.slice().sort((a,b)=>b.d.localeCompare(a.d))[0]?.d?.slice(0,7) || iso(TODAY).slice(0,7);
  const period=S.ui.attendancePeriod || latest;
  const meetings=d.meetings.filter(m=>m.d.startsWith(period)).sort((a,b)=>(S.ui.attendanceReverse?-1:1)*byTime(a,b));
  const rosterIds=new Set(d.roster.map(r=>r.p));
  const formerIds=[...new Set(meetings.flatMap(m=>Object.keys(m.attendance||{})).filter(pid=>!rosterIds.has(pid)))];
  const visibleRoster=[...d.roster,...formerIds.map(p=>({p,former:true}))];
  const counts=attendanceCounts(meetings,d.roster);
  for(const meeting of meetings)for(const pid of formerIds){const value=attendanceValue(meeting,pid);if(value)counts[value]++;}
  const recorded=counts.present+counts.excused+counts.absent;
  const [year,mo]=period.split('-').map(Number);
  const periodLabel=new Intl.DateTimeFormat(isAr()?'ar-LB':'en-US',{month:'long',year:'numeric'}).format(new Date(year,mo-1,1));
  const held=d.meetings.filter(m=>m.done);
  const overall=held.reduce((total,m)=>{const count=meetingAttendance(m);for(const key of ['present','excused','absent'])total[key]+=count[key];return total;},{present:0,excused:0,absent:0});
  const known=overall.present+overall.excused+overall.absent;
  return `<div class="stats attendance-stats" style="margin:20px 0 12px">
    ${stat(L('Meetings held','اجتماعات أُقيمت'),held.length,L('all recorded meetings','كل الاجتماعات المسجّلة'))}
    <div class="stat"><span class="k">${L('Attendance breakdown','تفصيل الحضور')}</span><div class="attendance-breakdown">${[['present','Present','حاضر'],['excused','Excused','معذور'],['absent','Absent','غائب']].map(([key,en,ar])=>`<div><span>${L(en,ar)}</span><b>${overall[key]}</b><small>${known?Math.round(overall[key]/known*100):0}%</small></div>`).join('')}</div></div>
    ${stat(L('Attendance rate','نسبة الحضور'),known?`${Math.round(overall.present/known*100)}%`:'—',L('of known responses','من الردود المعروفة'))}
  </div><div class="toolbar" style="margin:16px 0;gap:8px;flex-wrap:wrap">
    <div class="row" style="gap:6px">${C.iconBtn('chevL',L('Previous month','الشهر السابق'),'data-attendance-shift="-1"')}
      <b style="min-width:130px;text-align:center">${esc(periodLabel)}</b>
      ${C.iconBtn('chevR',L('Next month','الشهر التالي'),'data-attendance-shift="1"')}</div>
    <input class="input" type="search" data-attendance-search placeholder="${esc(L('Find a member','ابحث عن عضو'))}" aria-label="${esc(L('Find a member','ابحث عن عضو'))}" style="max-width:230px">
    <button class="btn btn-secondary btn-dense" data-attendance-order aria-label="${L('Reverse meeting date order','عكس ترتيب تواريخ الاجتماعات')}" title="${L('Reverse meeting date order','عكس ترتيب تواريخ الاجتماعات')}"><span aria-hidden="true">⇅</span>${L(S.ui.attendanceReverse?'Newest first':'Oldest first',S.ui.attendanceReverse?'الأحدث أولاً':'الأقدم أولاً')}</button>
    <span class="t-caption dim">${recorded}/${meetings.reduce((n,m)=>n+d.roster.filter(r=>!m.participants?.length||m.participants.includes(r.p)).length,0) + formerIds.reduce((n,pid)=>n+meetings.filter(m=>attendanceValue(m,pid)).length,0)} ${L('recorded','مسجّل')}</span>
    <span class="attendance-legend">${attendanceTag('present',counts.present)}${attendanceTag('excused',counts.excused)}${attendanceTag('absent',counts.absent)}</span>
    <button class="btn btn-secondary btn-dense" data-attendance-import>${L('Import Excel','استيراد Excel')}</button>
    <button class="btn btn-secondary btn-dense" data-attendance-export>${L('Export','تصدير')}</button>
    <button class="btn btn-secondary btn-dense" data-attendance-print>${icon('print',15)}${L('Print','طباعة')}</button>
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
           ${meetings.map(m=>{const value=attendanceValue(m,r.p),invited=!m.participants?.length||m.participants.includes(r.p);return `<td style="padding:6px;border-top:1px solid var(--border);text-align:center">
             ${!invited&&!value?`<span class="dim" title="${L('Not invited','غير مدعو')}">—</span>`:`<button type="button" class="attendance-choice attendance-${value||'unrecorded'}" data-attendance="${esc(meetingId(m))}|${esc(r.p)}" ${r.former||!invited?'disabled':''}
               aria-label="${esc(L(p?.lat||r.p,p?.ar||r.p))} — ${fmtDate(m.d)}: ${esc(L(...(ATTENDANCE_OPTIONS.find(x=>x[0]===value)||ATTENDANCE_OPTIONS[0]).slice(1)))}">
               ${attendanceTag(value)}${icon('chevD',14)}</button>`}</td>`;}).join('')}</tr>`;}).join('')}</tbody>
      </table></div>`}
    <p class="t-caption dim" style="margin-top:10px">${L('Each cell belongs to a group member and meeting. Changes save as you select a status.','كل خانة مرتبطة بعضو واجتماع. تُحفظ التغييرات عند اختيار الحالة.')}</p>`;
}

function attendanceRows(gid) {
  const d=groupInfo(gid),period=S.ui.attendancePeriod||d.meetings.slice().sort((a,b)=>b.d.localeCompare(a.d))[0]?.d?.slice(0,7)||'';
  const meetings=d.meetings.filter(m=>m.d.startsWith(period)).sort(byTime);
  return {period,rows:meetings.flatMap(m=>d.roster.filter(r=>!m.participants?.length||m.participants.includes(r.p)).map(r=>[
    m.d,m.t,m.title||'',r.p,person(r.p)?.lat||'',person(r.p)?.ar||'',attendanceValue(m,r.p)||'unrecorded']))};
}
function attendanceExport(gid) {
  const {period,rows}=attendanceRows(gid),fields=[['Date','Time','Meeting','Person ID','Name','Arabic name','Attendance'],...rows];
  const safe=value=>{const str=String(value??'');return `"${(/^[=+@-]/.test(str)?"'":'')+str.replace(/"/g,'""')}"`;};
  download(`attendance-${gid}-${period}.csv`,fields.map(row=>row.map(safe).join(',')).join('\r\n'));
}
function attendancePrint(gid) {
  const g=group(gid),{period,rows}=attendanceRows(gid);
  const popup=window.open('','_blank');if(!popup)return toast(L('Allow the print window','اسمح بنافذة الطباعة'),'','warning');
  popup.document.write(`<!doctype html><html lang="${isAr()?'ar':'en'}" dir="${isAr()?'rtl':'ltr'}"><meta charset="utf-8"><title>${esc(L(g.name,g.ar))} — ${esc(period)}</title>
    <style>body{font:14px Arial,sans-serif;padding:24px;color:#233B32}h1{font-size:22px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #DCE2DB;padding:8px;text-align:start}th{background:#EDF0E8}@page{size:landscape;margin:15mm}</style>
    <h1>${esc(L(g.name,g.ar))} — ${esc(period)} ${L('attendance','الحضور')}</h1><table><thead><tr>${[L('Date','التاريخ'),L('Time','الوقت'),L('Meeting','الاجتماع'),L('Member','العضو'),L('Status','الحالة')].map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>
    ${rows.map(row=>`<tr>${[row[0],row[1],row[2],L(row[4],row[5]),row[6]].map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></html>`);
  popup.document.close();popup.focus();setTimeout(()=>popup.print(),150);
}
function attendanceImport(gid) {
  const d=groupInfo(gid);let workbook=[],mapped=[];
  const roster=d.roster.map(r=>person(r.p)).filter(Boolean);
  const normalize=s=>String(s||'').trim().toLocaleLowerCase().replace(/\s+/g,' ');
  const labels=[['present','Present','حاضر'],['excused','Excused','معذور'],['absent','Absent','غائب']];
  openDrawer({large:true,title:L('Import attendance from Excel','استيراد الحضور من Excel'),
    sub:L('Choose a workbook, map its name and status columns, review every match, then apply to one meeting. No file is stored.','اختر ملف Excel وحدّد عمودي الاسم والحالة وراجع كل مطابقة ثم طبّقها على اجتماع واحد. لا يُحفظ الملف.'),
    body:`<div class="formrow"><label class="label" for="ai_meeting">${L('Meeting','الاجتماع')}</label><select class="select" id="ai_meeting"><option value="">${L('Choose a meeting','اختر اجتماعاً')}</option>${d.meetings.slice().sort((a,b)=>b.d.localeCompare(a.d)).map(m=>`<option value="${esc(meetingId(m))}">${esc(m.title||L('Meeting','اجتماع'))} · ${fmtDate(m.d)}</option>`).join('')}</select></div>
      <div class="formrow"><label class="label" for="ai_file">${L('Excel workbook (.xlsx)','ملف Excel (.xlsx)')}</label><input class="input" id="ai_file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></div>
      <div id="ai_map" aria-live="polite"></div><div id="ai_review" aria-live="polite"></div>`,
    foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-primary" id="ai_apply" disabled>${L('Apply reviewed records','تطبيق السجلات المراجَعة')}</button>`,
    onMount(el){
      const mapping=el.querySelector('#ai_map'),review=el.querySelector('#ai_review'),apply=el.querySelector('#ai_apply');
      const update=()=>{
        mapped=[];apply.disabled=true;
        const mid=el.querySelector('#ai_meeting').value,meeting=d.meetings.find(m=>meetingId(m)===mid);
        if(!workbook.length||!meeting){review.innerHTML='';return;}
        const ni=Number(el.querySelector('#ai_name')?.value),si=Number(el.querySelector('#ai_status')?.value),seen=new Set();
        const results=workbook.slice(1).filter(row=>row.some(cell=>String(cell||'').trim())).map((row,index)=>{
          const source=normalize(row[ni]),matches=roster.filter(p=>[p.id,p.lat,p.ar].some(v=>normalize(v)===source));
          const p=matches.length===1?matches[0]:null,raw=normalize(row[si]);
          const value=labels.find(([key,en,ar])=>[key,normalize(en),normalize(ar)].includes(raw))?.[0]||'';
          const error=!source?L('Name missing','الاسم ناقص'):matches.length!==1?L(matches.length?'Ambiguous name':'Person not in roster',matches.length?'الاسم ملتبس':'ليس في لائحة الأعضاء'):
            meeting.participants?.length&&!meeting.participants.includes(p.id)?L('Not invited','غير مدعو'):seen.has(p.id)?L('Duplicate person','شخص مكرّر'):!value?L('Unrecognized status','حالة غير معروفة'):'';
          if(p&&!error)seen.add(p.id);
          return {line:index+2,p,value,error,current:p?attendanceValue(meeting,p.id):'',source:row[ni],raw:row[si]};
        });
        mapped=results.filter(row=>!row.error);const errors=results.filter(row=>row.error);
        review.innerHTML=`<div class="divider"></div><p class="t-caption">${mapped.length} ${L('ready','جاهز')} · ${errors.length} ${L('errors','أخطاء')}</p>
          ${errors.length?C.inlineAlert('warning',L('Fix the workbook before applying','صحّح الملف قبل التطبيق'),L('Rows with errors will not be applied.','الصفوف التي فيها أخطاء لن تُطبّق.')):''}
          <div class="tablewrap"><table class="table"><thead><tr>${[L('Row','الصف'),L('Workbook name','الاسم في الملف'),L('Matched member','العضو المطابق'),L('Status','الحالة'),L('Current','الحالي'),L('Review','المراجعة')].map(label=>`<th>${label}</th>`).join('')}</tr></thead><tbody>${results.slice(0,100).map(row=>`<tr><td>${row.line}</td><td>${esc(row.source||'—')}</td><td>${esc(row.p?L(row.p.lat,row.p.ar):'—')}</td><td>${esc(row.raw||'—')}</td><td>${esc(row.current||'—')}</td><td>${row.error?`<span class="help-error">${esc(row.error)}</span>`:L('Ready','جاهز')}</td></tr>`).join('')}</tbody></table></div>${results.length>100?`<p class="help">${L('Only the first 100 rows are shown; all rows are checked.','تظهر أول ١٠٠ صف فقط، وتُفحص كل الصفوف.')}</p>`:''}`;
        apply.disabled=!mapped.length||!!errors.length;
      };
      el.querySelector('#ai_file').addEventListener('change',async event=>{
        const file=event.target.files?.[0];if(!file)return;
        if(!/\.xlsx$/i.test(file.name)||file.size>2_000_000){toast(L('Choose an .xlsx file under 2 MB','اختر ملف .xlsx أصغر من ٢ ميغابايت'),'','warning');return;}
        const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
        try{workbook=(await parishAPI('attendance-preview','POST',{groupId:gid,data:btoa(binary)})).rows;}catch(error){toast(L('Could not read workbook','تعذّرت قراءة الملف'),error.message,'danger');return;}
        const headings=workbook[0]||[],options=headings.map((heading,index)=>`<option value="${index}">${esc(heading||`Column ${index+1}`)}</option>`).join('');
        mapping.innerHTML=`<div class="formgrid"><div class="formrow"><label class="label" for="ai_name">${L('Person column','عمود الشخص')}</label><select class="select" id="ai_name">${options}</select></div>
          <div class="formrow"><label class="label" for="ai_status">${L('Attendance column','عمود الحضور')}</label><select class="select" id="ai_status">${options}</select></div></div>
          <p class="help">${L('Accepted statuses: Present, Excused, Absent (or Arabic equivalents).','الحالات المقبولة: حاضر، معذور، غائب (أو ما يقابلها بالإنكليزية).')}</p>`;
        const nameIndex=headings.findIndex(v=>/person|member|name|الاسم|الشخص/i.test(v)),statusIndex=headings.findIndex(v=>/status|attendance|الحضور|الحالة/i.test(v));
        el.querySelector('#ai_name').value=String(Math.max(0,nameIndex));el.querySelector('#ai_status').value=String(Math.max(0,statusIndex));
        el.querySelectorAll('#ai_name,#ai_status').forEach(sel=>sel.addEventListener('change',update));update();
      });
      el.querySelector('#ai_meeting').addEventListener('change',update);
      apply.addEventListener('click',async()=>{
        const meeting=d.meetings.find(m=>meetingId(m)===el.querySelector('#ai_meeting').value);if(!meeting||!mapped.length||apply.disabled)return;
        meeting.attendance||={};for(const row of mapped)meeting.attendance[row.p.id]=row.value;
        meeting.done=true;if(!await persist())return;closeOverlays();bus.refresh();toast(L('Attendance imported','استُورد الحضور'),`${mapped.length} ${L('records','سجلات')}`,'success');
      });
    }});
}

groups.mount = host => {
  C.wire(host); wireTables(host);
  const bindFilter=(selector,key)=>{const el=host.querySelector(selector);if(!el)return;el.value=S.ui[key]||el.value;el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{const caret=el.tagName==='INPUT'?el.selectionStart:0;S.ui[key]=el.value;bus.refresh();if(el.tagName==='INPUT'){const next=host.querySelector(selector);next?.focus();next?.setSelectionRange(caret,caret);}});};
  bindFilter('[data-roster-search]','rosterQuery');bindFilter('[data-roster-filter]','rosterFilter');
  bindFilter('[data-resource-search]','resourceQuery');bindFilter('[data-resource-filter]','resourceFilter');
  host.querySelector('[data-resource-search-button]')?.addEventListener('click',()=>host.querySelector('[data-resource-search]')?.focus());
  bindFilter('[data-group-task-search]','groupTaskQuery');bindFilter('[data-group-task-filter]','groupTaskFilter');
  host.querySelector('[data-attendance-order]')?.addEventListener('click',()=>{S.ui.attendanceReverse=!S.ui.attendanceReverse;bus.refresh();});
  host.querySelector('[data-meeting-order]')?.addEventListener('click',()=>{S.ui.meetingReverse=!S.ui.meetingReverse;bus.refresh();});
  host.querySelectorAll('[data-meeting-view]').forEach(b=>b.addEventListener('click',()=>{S.ui.meetingView=b.dataset.meetingView;bus.refresh();}));
  host.querySelectorAll('[data-meeting-month]').forEach(b=>b.addEventListener('click',()=>{const [y,m]=(S.ui.meetingMonth||iso(new Date()).slice(0,7)).split('-').map(Number),date=new Date(y,m-1+Number(b.dataset.meetingMonth),1);S.ui.meetingMonth=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;bus.refresh();}));
  host.querySelectorAll('[data-roster-formation]').forEach(b=>b.addEventListener('click',()=>{const d=groupInfo(S.params[0]),pid=b.dataset.rosterFormation,p=person(pid);openDrawer({title:L(p?.lat||pid,p?.ar||pid),sub:L('Formation progress','تقدّم التنشئة'),body:d.milestones.filter(m=>!m.archived).map(m=>`<div class="listrow"><span class="grow"><b>${esc(L(m.name,m.ar))}</b><small>${m.completions?.[pid]?`${L('Completed','مكتمل')} · ${fmtDate(m.completions[pid].date)}`:L('Not completed','لم يكتمل')}</small></span></div>`).join('')||`<p>${L('No formation milestones yet.','لا محطات تنشئة بعد.')}</p>`,foot:`<button class="btn btn-secondary" data-close>${L('Close','إغلاق')}</button>`});}));
  host.querySelector('[data-group-task-new]')?.addEventListener('click',()=>groupTaskForm());
  host.querySelectorAll('[data-group-task-edit]').forEach(b=>b.addEventListener('click',()=>groupTaskForm(Number(b.dataset.groupTaskEdit))));
  for(const [selector,field] of [['[data-group-task-pin]','pinned'],['[data-group-task-done]','done']])host.querySelectorAll(selector).forEach(b=>b.addEventListener('click',async()=>{const item=groupInfo(S.params[0]).tasks[Number(b.dataset.groupTaskPin??b.dataset.groupTaskDone)];if(item){item[field]=!item[field];if(await persist())bus.refresh();}}));
  host.querySelectorAll('[data-group-task-delete]').forEach(b=>b.addEventListener('click',()=>{const d=groupInfo(S.params[0]),i=Number(b.dataset.groupTaskDelete),item=d.tasks[i];if(item)openModal({title:L('Delete item?','حذف العنصر؟'),body:`<p>${esc(L(item.what,item.whatAr||item.what))}</p>`,foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-danger" id="group-task-confirm">${L('Delete','حذف')}</button>`,onMount(el){el.querySelector('#group-task-confirm').addEventListener('click',async()=>{d.tasks.splice(i,1);if(!await persist())return;closeOverlays();bus.refresh();});}});}));
  host.querySelector('[data-resource-new]')?.addEventListener('click',()=>resourceForm());
  host.querySelectorAll('[data-resource-edit]').forEach(b=>b.addEventListener('click',()=>resourceForm(b.dataset.resourceEdit)));
  host.querySelectorAll('[data-resource-delete]').forEach(b=>b.addEventListener('click',()=>resourceDelete(b.dataset.resourceDelete)));
  host.querySelectorAll('[data-resource-lend]').forEach(b=>b.addEventListener('click',()=>resourceLend(b.dataset.resourceLend)));
  host.querySelectorAll('[data-resource-loan-edit]').forEach(b=>b.addEventListener('click',()=>resourceLoanEdit(b.dataset.resourceLoanEdit)));
  host.querySelectorAll('[data-resource-return]').forEach(b=>b.addEventListener('click',async()=>{
    const loan=groupInfo(S.params[0]).resourceLoans.find(l=>l.id===b.dataset.resourceReturn);
    if(loan){loan.returnedAt=iso(new Date());if(!await persist())return;bus.refresh();toast(L('Item returned','أُعيد الصنف'),'','success');}
  }));
  host.querySelector('[data-formation-new]')?.addEventListener('click',()=>formationForm());
  host.querySelectorAll('[data-formation-edit]').forEach(b=>b.addEventListener('click',()=>formationForm(b.dataset.formationEdit)));
  host.querySelectorAll('[data-formation-delete]').forEach(b=>b.addEventListener('click',()=>formationDelete(b.dataset.formationDelete)));
  host.querySelectorAll('[data-formation-record]').forEach(b=>b.addEventListener('click',()=>{
    const [mid,pid='']=b.dataset.formationRecord.split('|');formationRecord(mid,pid);
  }));
  host.querySelectorAll('[data-formation-remove]').forEach(b=>b.addEventListener('click',async()=>{
    const [mid,pid]=b.dataset.formationRemove.split('|'),m=groupInfo(S.params[0]).milestones.find(x=>x.id===mid);
    if(m?.completions?.[pid]){delete m.completions[pid];if(!await persist())return;bus.refresh();toast(L('Completion removed','حُذف الإنجاز'),'','success');}
  }));
  host.querySelectorAll('[data-attendance-shift]').forEach(b=>b.addEventListener('click',()=>{
    const d=groupInfo(S.params[0]).meetings.slice().sort((a,b)=>b.d.localeCompare(a.d))[0]?.d?.slice(0,7) || iso(TODAY).slice(0,7);
    const [y,m]=(S.ui.attendancePeriod || d).split('-').map(Number), next=new Date(y,m-1+Number(b.dataset.attendanceShift),1);
    S.ui.attendancePeriod=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`;bus.refresh();
  }));
  host.querySelector('[data-attendance-search]')?.addEventListener('input',e=>{
    const query=e.target.value.trim().toLowerCase();
    host.querySelectorAll('[data-attendance-member]').forEach(row=>{row.hidden=!row.dataset.attendanceMember.includes(query);});
  });
  host.querySelector('[data-attendance-import]')?.addEventListener('click',()=>attendanceImport(S.params[0]));
  host.querySelector('[data-attendance-export]')?.addEventListener('click',()=>attendanceExport(S.params[0]));
  host.querySelector('[data-attendance-print]')?.addEventListener('click',()=>attendancePrint(S.params[0]));
  host.querySelectorAll('[data-attendance]').forEach(button=>button.addEventListener('click',()=>{
    const [mid,pid]=button.dataset.attendance.split('|'), meeting=groupInfo(S.params[0]).meetings.find(m=>meetingId(m)===mid);
    if(meeting)chooseAttendance(button,meeting,pid);
  }));
  host.querySelectorAll('[data-attendance-history]').forEach(b=>b.addEventListener('click',()=>{
    const pid=b.dataset.attendanceHistory,p=person(pid),rows=groupInfo(S.params[0]).meetings.slice().sort((a,c)=>c.d.localeCompare(a.d));
    const values=rows.map(m=>attendanceValue(m,pid)).filter(Boolean);
    const present=values.filter(v=>v==='present').length,excused=values.filter(v=>v==='excused').length,absent=values.filter(v=>v==='absent').length;
    openDrawer({title:L(p?.lat||pid,p?.ar||pid),sub:L('Individual attendance tracking','متابعة الحضور الفردي'),
      body:`<div class="attendance-person-stats">${attendanceTag('present',present)}${attendanceTag('excused',excused)}${attendanceTag('absent',absent)}
        <span class="t-caption dim">${values.length?`${Math.round(present/values.length*100)}%`:'—'} ${L('present among recorded meetings','حاضر من الاجتماعات المسجّلة')}</span></div>`+
        rows.map(m=>`<div class="listrow" style="padding-inline:0"><span class="grow">${fmtDate(m.d)} · ${esc(m.t)}</span>
        ${attendanceTag(attendanceValue(m,pid))}</div>`).join('') || `<p>${L('No meetings yet','لا اجتماعات بعد')}</p>`,
      foot:`<button class="btn btn-secondary" data-close>${L('Close','إغلاق')}</button>`});
  }));
  host.querySelectorAll('[data-meeting-review]').forEach(b=>b.addEventListener('click',()=>meetingReview(b.dataset.meetingReview)));
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

function groupTaskForm(index=-1){
  const d=groupInfo(S.params[0]),item=d.tasks[index];
  openDrawer({title:item?L('Edit item','تعديل العنصر'):L('Add note or task','إضافة ملاحظة أو مهمة'),body:`<div class="formrow"><label class="label" for="gt_kind">${L('Type','النوع')}</label><select class="select" id="gt_kind"><option value="task" ${item?.kind!=='note'?'selected':''}>${L('Task','مهمة')}</option><option value="note" ${item?.kind==='note'?'selected':''}>${L('Note','ملاحظة')}</option></select></div>${C.field({label:L('Text','النص'),id:'gt_what',value:item?.what||'',req:true})}${C.field({label:L('Arabic text','النص العربي'),id:'gt_ar',value:item?.whatAr||''})}<div class="formgrid"><div class="formrow"><label class="label" for="gt_who">${L('Owner','المسؤول')}</label><select class="select" id="gt_who"><option value="">—</option>${d.roster.map(r=>`<option value="${esc(r.p)}" ${item?.who===r.p?'selected':''}>${esc(L(person(r.p)?.lat||r.p,person(r.p)?.ar||r.p))}</option>`).join('')}</select></div>${C.field({label:L('Due date','تاريخ الاستحقاق'),id:'gt_due',type:'date',value:item?.due||''})}</div>`,foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-primary" id="gt_save">${L('Save','حفظ')}</button>`,onMount(el){C.wire(el);el.querySelector('#gt_save').addEventListener('click',async()=>{const what=el.querySelector('#gt_what').value.trim();if(!what)return toast(L('Enter text','أدخل النص'),'','warning');const target=item||{id:`task-${Date.now().toString(36)}`};Object.assign(target,{kind:el.querySelector('#gt_kind').value,what,whatAr:el.querySelector('#gt_ar').value.trim()||what,who:el.querySelector('#gt_who').value,due:el.querySelector('#gt_due').value,done:target.done||false,pinned:target.pinned||false});if(!item)d.tasks.unshift(target);if(!await persist())return;closeOverlays();bus.refresh();});}});
}

function resourceForm(id='') {
  const d=groupInfo(S.params[0]),r=d.belongings.find(x=>x.id===id),lent=id?d.resourceLoans.filter(l=>l.resourceId===id&&!l.returnedAt).reduce((n,l)=>n+l.qty,0):0;
  openDrawer({title:r?L('Edit item','تعديل الصنف'):L('Add item','إضافة صنف'),body:`
    ${C.field({label:L('Name','الاسم'),id:'rs_name',value:r?.name||'',req:true})}
    ${C.field({label:L('Arabic name','الاسم العربي'),id:'rs_ar',value:r?.ar||''})}
    <div class="formgrid">${C.field({label:L('Inventory code','رمز الجرد'),id:'rs_code',value:r?.code||''})}
      <div class="formrow"><label class="label" for="rs_condition">${L('Condition','الحالة')}</label><select class="select" id="rs_condition">${[['good','Good','جيد'],['fair','Fair','مقبول'],['repair','Needs repair','يحتاج تصليح'],['damaged','Damaged','تالف']].map(([v,en,ar])=>`<option value="${v}" ${r?.condition===v?'selected':''}>${L(en,ar)}</option>`).join('')}</select></div></div>
    ${C.textarea({label:L('Description / care notes','الوصف / ملاحظات العناية'),id:'rs_description',value:r?.description||'',max:500})}
    <div class="formgrid">${C.field({label:L('Total quantity','العدد الكلي'),id:'rs_qty',type:'number',value:r?.qty??1})}
      ${C.field({label:L('Stored at','محفوظ في'),id:'rs_location',value:r?.location||''})}</div>
    ${C.field({label:L('Location (Arabic)','المكان بالعربي'),id:'rs_location_ar',value:r?.locationAr||''})}
    ${lent?`<p class="help">${lent} ${L('currently on loan; total quantity cannot be lower.','معار حالياً؛ لا يمكن تقليل العدد الكلي إلى أقل من ذلك.')}</p>`:''}`,
    foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-primary" id="rs_save">${L('Save item','حفظ الصنف')}</button>`,
    onMount(el){C.wire(el);el.querySelector('#rs_save').addEventListener('click',async()=>{
      if(!F.need(el,'#rs_name',L('Enter an item name','أدخل اسم الصنف')))return;
      const qty=Number(el.querySelector('#rs_qty').value);
      if(!Number.isInteger(qty)||qty<lent||qty<0)return toast(L('Invalid quantity','عدد غير صالح'),L(`At least ${lent} items are needed to cover active loans.`,`يلزم ${lent} صنفاً لتغطية الإعارات الحالية.`),'warning');
      const target=r||{id:`res-${Date.now().toString(36)}`};Object.assign(target,{name:el.querySelector('#rs_name').value.trim(),
        ar:el.querySelector('#rs_ar').value.trim(),code:el.querySelector('#rs_code').value.trim(),condition:el.querySelector('#rs_condition').value,
        description:el.querySelector('#rs_description').value.trim(),qty,location:el.querySelector('#rs_location').value.trim(),locationAr:el.querySelector('#rs_location_ar').value.trim()});
      if(!r)d.belongings.push(target);if(!await persist())return;closeOverlays();bus.refresh();toast(L('Item saved','حُفظ الصنف'),'','success');
    });}});
}

function resourceDelete(id) {
  const d=groupInfo(S.params[0]),r=d.belongings.find(x=>x.id===id);if(!r)return;
  if(d.resourceLoans.some(l=>l.resourceId===id))return toast(L('Item has loan history','للصنف سجل إعارات'),L('Keep the item so its loan history stays attached.','أبق الصنف كي يظل سجل الإعارات مرتبطاً به.'),'warning');
  openModal({title:L('Delete item?','حذف الصنف؟'),body:`<p>${esc(L(r.name,r.ar))}</p>`,
    foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-danger" id="rs_delete">${L('Delete','حذف')}</button>`,
    onMount(el){el.querySelector('#rs_delete').addEventListener('click',async()=>{d.belongings.splice(d.belongings.indexOf(r),1);if(!await persist())return;closeOverlays();bus.refresh();});}});
}

function resourceLend(id) {
  const d=groupInfo(S.params[0]),r=d.belongings.find(x=>x.id===id);if(!r)return;
  const available=r.qty-d.resourceLoans.filter(l=>l.resourceId===id&&!l.returnedAt).reduce((n,l)=>n+l.qty,0);
  openDrawer({title:L('Lend item','إعارة صنف'),sub:esc(L(r.name,r.ar)),body:`
    ${C.field({label:L('Borrower name','اسم المستعير'),id:'loan_name',req:true})}
    <div class="formgrid">${C.field({label:L('Quantity','العدد'),id:'loan_qty',type:'number',value:1})}
      ${C.field({label:L('Due date','تاريخ الإرجاع'),id:'loan_due',type:'date',value:iso(new Date()),req:true})}</div>
    <p class="help">${available} ${L('available','متاح')}</p>`,
    foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-primary" id="loan_save">${L('Record loan','تسجيل الإعارة')}</button>`,
    onMount(el){C.wire(el);el.querySelector('#loan_save').addEventListener('click',async()=>{
      if(!F.need(el,'#loan_name',L('Enter the borrower','أدخل اسم المستعير'))||!F.need(el,'#loan_due',L('Choose a due date','اختر تاريخ الإرجاع')))return;
      const qty=Number(el.querySelector('#loan_qty').value),due=el.querySelector('#loan_due').value;
      if(!Number.isInteger(qty)||qty<1||qty>available||due<iso(new Date()))return toast(L('Check quantity and due date','تحقّق من العدد والتاريخ'),'','warning');
      d.resourceLoans.push({id:`loan-${Date.now().toString(36)}`,resourceId:id,borrower:el.querySelector('#loan_name').value.trim(),qty,
        checkedOutAt:iso(new Date()),due,returnedAt:''});if(!await persist())return;closeOverlays();bus.refresh();toast(L('Loan recorded','سُجّلت الإعارة'),'','success');
  });}});
}

function resourceLoanEdit(id) {
  const d=groupInfo(S.params[0]),loan=d.resourceLoans.find(item=>item.id===id);
  if(!loan)return;
  const resource=d.belongings.find(item=>item.id===loan.resourceId);
  if(!resource)return;
  const otherLoans=d.resourceLoans.filter(item=>item.resourceId===resource.id&&!item.returnedAt&&item.id!==id)
    .reduce((count,item)=>count+item.qty,0);
  const limit=loan.returnedAt?loan.qty:resource.qty-otherLoans;
  openDrawer({title:L('Edit loan','تعديل الإعارة'),sub:esc(L(resource.name,resource.ar)),body:`
    ${C.field({label:L('Borrower name','اسم المستعير'),id:'loan_name',value:loan.borrower,req:true})}
    <div class="formgrid">${C.field({label:L('Quantity','العدد'),id:'loan_qty',type:'number',value:loan.qty})}
      ${C.field({label:L('Due date','تاريخ الإرجاع'),id:'loan_due',type:'date',value:loan.due,req:true})}</div>
    <p class="help">${loan.returnedAt?L('This loan was returned; its quantity is retained for the record.','أُعيدت هذه الإعارة؛ يبقى عددها محفوظاً في السجل.'):`${limit} ${L('items available to this loan','أصناف متاحة لهذه الإعارة')}`}</p>`,
    foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-primary" id="loan_save">${L('Save loan','حفظ الإعارة')}</button>`,
    onMount(el){C.wire(el);el.querySelector('#loan_save').addEventListener('click',async()=>{
      if(!F.need(el,'#loan_name',L('Enter the borrower','أدخل اسم المستعير'))||!F.need(el,'#loan_due',L('Choose a due date','اختر تاريخ الإرجاع')))return;
      const qty=Number(el.querySelector('#loan_qty').value),due=el.querySelector('#loan_due').value;
      if(!Number.isInteger(qty)||qty<1||qty>limit||due<loan.checkedOutAt||loan.returnedAt&&qty!==loan.qty)
        return toast(L('Check quantity and due date','تحقّق من العدد والتاريخ'),'','warning');
      Object.assign(loan,{borrower:el.querySelector('#loan_name').value.trim(),qty,due});
      if(!await persist())return;closeOverlays();bus.refresh();toast(L('Loan updated','حُدّثت الإعارة'),'','success');
    });}});
}

function formationForm(id='') {
  const d=groupInfo(S.params[0]),m=d.milestones.find(x=>x.id===id);
  openDrawer({title:m?L('Edit milestone','تعديل المحطة'):L('Add milestone','إضافة محطة'),body:`
    ${C.field({label:L('Milestone name','اسم المحطة'),id:'fm_name',value:m?.name||'',req:true})}
    ${C.field({label:L('Arabic name','الاسم العربي'),id:'fm_ar',value:m?.ar||''})}
    ${C.textarea({label:L('Description or learning goal','الوصف أو هدف التعلم'),id:'fm_description',value:m?.description||'',max:500})}`,
    foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-primary" id="fm_save">${L('Save milestone','حفظ المحطة')}</button>`,
    onMount(el){C.wire(el);el.querySelector('#fm_save').addEventListener('click',async()=>{
      if(!F.need(el,'#fm_name',L('Name the milestone','سمّ المحطة')))return;
      const target=m||{id:`fm-${Date.now().toString(36)}`,legacyCount:0,completions:{}};
      Object.assign(target,{name:el.querySelector('#fm_name').value.trim(),ar:el.querySelector('#fm_ar').value.trim(),
        description:el.querySelector('#fm_description').value.trim()});if(!m)d.milestones.push(target);
      if(!await persist())return;closeOverlays();bus.refresh();toast(L('Milestone saved','حُفظت المحطة'),'','success');
    });}});
}

function formationDelete(id) {
  const d=groupInfo(S.params[0]),m=d.milestones.find(x=>x.id===id);if(!m)return;
  if(m.legacyCount||Object.keys(m.completions||{}).length)return toast(L('Milestone has history','للمحطة سجل'),
    L('Remove individual completions first. Historical totals are preserved.','احذف الإنجازات الفردية أولاً. وتبقى المجاميع التاريخية محفوظة.'),'warning');
  openModal({title:L('Delete milestone?','حذف المحطة؟'),body:`<p>${esc(L(m.name,m.ar))}</p>`,
    foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-danger" id="fm_delete">${L('Delete','حذف')}</button>`,
    onMount(el){el.querySelector('#fm_delete').addEventListener('click',async()=>{d.milestones.splice(d.milestones.indexOf(m),1);if(!await persist())return;closeOverlays();bus.refresh();});}});
}

function formationRecord(id,pid='') {
  const d=groupInfo(S.params[0]),m=d.milestones.find(x=>x.id===id);if(!m)return;
  const saved=m.completions?.[pid];
  openDrawer({title:L('Record completion','تسجيل إنجاز'),sub:esc(L(m.name,m.ar)),body:`
    <fieldset class="formrow"><legend class="label">${L('Members','الأعضاء')}</legend><div class="formation-member-choices">${d.roster.filter(r=>!pid||r.p===pid).map(r=>`<label class="check"><input type="checkbox" name="fr_person" value="${esc(r.p)}" ${r.p===pid?'checked':''} ${!pid&&m.completions?.[r.p]?'disabled':''}><span>${esc(L(person(r.p)?.lat||r.p,person(r.p)?.ar||r.p))}${!pid&&m.completions?.[r.p]?` · ${L('Already completed','مكتمل سابقاً')}`:''}</span></label>`).join('')}</div></fieldset>
    ${C.field({label:L('Completed on','تاريخ الإنجاز'),id:'fr_date',type:'date',value:saved?.date||iso(new Date()),req:true})}
    ${C.textarea({label:L('Notes (optional)','ملاحظات (اختياري)'),id:'fr_notes',value:saved?.notes||'',max:500})}`,
    foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-primary" id="fr_save">${L('Save completion','حفظ الإنجاز')}</button>`,
    onMount(el){C.wire(el);el.querySelector('#fr_save').addEventListener('click',async()=>{
      const members=[...el.querySelectorAll('[name="fr_person"]:checked')].map(box=>box.value),date=el.querySelector('#fr_date').value;
      if(!members.length||!date)return toast(L('Choose members and date','اختر الأعضاء والتاريخ'),'','warning');
      if(members.some(member=>m.completions?.[member]&&member!==pid))return toast(L('Already recorded','مسجّل سابقاً'),L('Edit an existing completion instead.','عدّل الإنجاز الموجود بدلاً من ذلك.'),'warning');
      for(const member of members)m.completions[member]={date,notes:el.querySelector('#fr_notes').value.trim()};
      if(!await persist())return;closeOverlays();bus.refresh();toast(L('Completion saved','حُفظ الإنجاز'),'','success');
    });}});
}

/* ═══════════════ 8 · volunteers ═══════════════ */
const VTABS = () => [['', 'Rota', 'المناوبات'], ['people', 'Volunteers', 'المتطوّعون', VOLUNTEERS.length],
               ['sheets', 'Sign-up sheets', 'لوائح التطوّع', SIGNUP_SHEETS.length], ['hours', 'Hours', 'الساعات']];

export function volunteers(tab = '') {
  if(is('leader')) {
    const managed=GROUPS, unique=[...new Set(managed.flatMap(g=>groupInfo(g.id).roster.map(r=>r.p)))];
    const held=managed.flatMap(g=>groupInfo(g.id).meetings.filter(m=>m.done));
    return pageHead({crumbs:[{label:L('My ministry','خدمتي')},{label:L('Volunteers','المتطوّعون')}],
      title:L('Ministry volunteers','متطوعو الخدمة'),sub:L('Members and attendance in the groups you lead.','الأعضاء والحضور في المجموعات التي تقودها.')})+
      `<div class="stats" style="margin:20px 0">${stat(L('Members','الأعضاء'),unique.length,L('across my groups','في مجموعاتي'))}
        ${stat(L('Groups','المجموعات'),managed.length,L('I lead','أقودها'))}
        ${stat(L('Meetings held','اجتماعات أُقيمت'),held.length,L('across my groups','في مجموعاتي'))}</div>
      ${managed.map(g=>{const d=groupInfo(g.id);return panel(L(g.name,g.ar),
        `<div class="toolbar"><b>${L('Role assignments','إسناد الأدوار')}</b><button class="btn btn-primary btn-dense" data-role-assign="${esc(g.id)}">${icon('plus',15)}${L('Assign role','إسناد دور')}</button></div>
        ${d.roles.map(([pid,en,ar],i)=>`<div class="listrow"><span class="grow">${esc(L(person(pid)?.lat||pid,person(pid)?.ar||pid))}<small>${esc(L(en,ar))}</small></span><button class="btn-icon" data-role-remove="${esc(g.id)}|${i}" aria-label="${L('Remove assignment','إزالة الإسناد')}">${icon('trash',16)}</button></div>`).join('')}
        <div class="divider"></div>${table({cols:[{label:L('Member','العضو')},{label:L('Role','الدور')},{label:L('Attendance','الحضور'),cls:'num'}],
          rows:d.roster.map(r=>({cells:[esc(L(person(r.p)?.lat||r.p,person(r.p)?.ar||r.p)),esc(L(r.role,r.roleAr)),memberAttendancePct(d.meetings,r.p)]}))})}`,
        {more:`<a class="btn btn-secondary btn-dense" href="#/groups/${esc(g.id)}/roster">${L('Open roster','افتح اللائحة')}</a>
          <button class="btn btn-primary btn-dense" data-leader-add="${esc(g.id)}">${L('Add member','إضافة عضو')}</button>`});}).join('')||
          empty('groups',L('No groups assigned','لا مجموعات مخصصة'),L('Ask the parish office to assign a ministry.','اطلب من مكتب الرعية تخصيص خدمة.'))}`;
  }
  const teams = is('leader') ? ROTA.teams.filter(tm => tm.leader === 'p3') : ROTA.teams;
  const head = pageHead({
    crumbs: [{ label: L('Parish life', 'حياة الرعية') }, { label: L('Volunteers', 'المتطوّعون') }],
    title: is('leader') ? L('My teams — Sunday Mass 10:30', 'فرقي — قدّاس الأحد ١٠:٣٠') : L('Volunteers', 'المتطوّعون'),
    sub: L('Plan volunteer assignments here. Anyone who needs personal access signs in as a member, with or without a ministry group.',
           'نظّم مناوبات المتطوعين هنا. من يحتاج إلى دخول شخصي يسجّل كعضو، سواء انضم إلى خدمة أم لا.'),
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
      empty: empty('vol', L('No volunteers yet', 'لا متطوّعين بعد'), L('Add parishioners who serve. A member account is optional.', 'أضف المؤمنين الذين يخدمون. حساب العضو اختياري.'),
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
        <button class="btn btn-secondary btn-dense" style="margin-inline-start:auto" data-act="sheet-open:${s.id}">${L('Manage participants', 'إدارة المشاركين')}</button>
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
        <span class="dim rota-hint">${L('On a phone, tap an empty place to invite someone.', 'على الهاتف، اضغط مركزاً شاغراً لدعوة أحد.')}</span></p>`,
      { more: teams.length > 2 ? `<span class="row rota-nav" style="gap:6px">${C.iconBtn('chevL', L('Scroll to earlier teams', 'الفرق السابقة'), 'data-rota-scroll="-1"')}${C.iconBtn('chevR', L('Scroll to more teams', 'المزيد من الفرق'), 'data-rota-scroll="1"')}</span>` : '' })}
    ${C.inlineAlert('info', L('Late cancellations trigger a shortlist', 'الاعتذار المتأخر يُطلق لائحة بدلاء'),
      L('ParishLife proposes volunteers who are free, trained for that team and not already serving twice that week. A human always picks.',
        'يقترح «حياة الرعية» متطوّعين متفرّغين ومدرَّبين لهذا الفريق وغير مناوبين مرّتين في الأسبوع نفسه. والاختيار دائماً بشري.'))}`;
}

volunteers.mount = host => {
  C.wire(host); wireTables(host);
  if(is('leader')){
    host.querySelectorAll('[data-leader-add]').forEach(b=>b.addEventListener('click',()=>F.memberAdd(b.dataset.leaderAdd)));
    host.querySelectorAll('[data-role-assign]').forEach(b=>b.addEventListener('click',()=>ministryRoleForm(b.dataset.roleAssign)));
    host.querySelectorAll('[data-role-remove]').forEach(b=>b.addEventListener('click',()=>{const [gid,index]=b.dataset.roleRemove.split('|'),d=groupInfo(gid);d.roles.splice(Number(index),1);bus.refresh();}));
    return;
  }
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
  const rb = host.querySelector('.rota-board'), back = host.querySelector('[data-rota-scroll="-1"]'), more = host.querySelector('[data-rota-scroll="1"]');
  host.querySelectorAll('[data-rota-scroll]').forEach(b => b.addEventListener('click', () => {
    const step = (rb.querySelector('.rota-col')?.offsetWidth || 280) + 14, way = document.documentElement.dir === 'rtl' ? -1 : 1;
    rb.scrollBy({ left: +b.dataset.rotaScroll * step * way, behavior: 'smooth' });
  }));
  /* the arrows rest at either end of the row (scrollLeft runs negative in Arabic) */
  const ends = () => { if (!rb || !back) return; const x = Math.abs(rb.scrollLeft), max = rb.scrollWidth - rb.clientWidth;
    back.disabled = x <= 2; more.disabled = x >= max - 2; };
  rb?.addEventListener('scroll', ends, { passive: true }); ends();

};

function ministryRoleForm(gid){
  const d=groupInfo(gid);
  openDrawer({title:L('Assign ministry role','إسناد دور في الخدمة'),sub:esc(L(group(gid)?.name||'',group(gid)?.ar||'')),body:`<div class="formrow"><label class="label" for="role_name">${L('Role','الدور')}</label><select class="select" id="role_name">${MINISTRY_ROLES.map(([en,ar])=>`<option value="${esc(en)}">${esc(L(en,ar))}</option>`).join('')}</select></div><div class="formrow"><label class="label" for="role_person">${L('Group member','عضو المجموعة')}</label><select class="select" id="role_person">${d.roster.map(r=>`<option value="${esc(r.p)}">${esc(L(person(r.p)?.lat||r.p,person(r.p)?.ar||r.p))}</option>`).join('')}</select></div>`,foot:`<button class="btn btn-secondary" data-close>${L('Cancel','إلغاء')}</button><button class="btn btn-primary" id="role_save">${L('Assign','إسناد')}</button>`,onMount(el){C.wire(el);el.querySelector('#role_save').addEventListener('click',()=>{const pid=el.querySelector('#role_person').value,en=el.querySelector('#role_name').value,ar=MINISTRY_ROLES.find(([name])=>name===en)?.[1]||en;if(!pid)return toast(L('Choose a group member','اختر عضواً من المجموعة'),'','warning');if(d.roles.some(([personId,role])=>personId===pid&&role===en))return toast(L('Already assigned','الدور مسند مسبقاً'),'','warning');d.roles.push([pid,en,ar]);closeOverlays();bus.refresh();toast(L('Role assigned','أُسند الدور'),'','success');});}});
}

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
function registrationNext(row,form) {
  if(row.status==='awaiting-approval')return L('Review application','راجع الطلب');
  if(!row.consent)return L('Record consent','سجّل الموافقة');
  if(row.status!=='registered'&&row.status!=='paid')return L('Confirm place','ثبّت المقعد');
  if(row.status==='paid')return L('Confirm place','ثبّت المقعد');
  if(Number(row.paid||0)<Number(form?.fee||0))return L('Record payment','سجّل الدفعة');
  return L('Ready for check-in','جاهز لتسجيل الوصول');
}

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
           { label: L('Status', 'الحالة'), cls: 'shrink' }, {label:L('Next action','الخطوة التالية'),cls:'shrink'}],
    rows: selectedRows.map(r => ({ cells: [
      who(person(r.p)),
      r.consent ? pill(L('Signed', 'موقَّعة'), 'success') : pill(L('Missing', 'ناقصة'), 'warning'),
      `<span class="dim">${r.transport === 'bus' ? L('Bus (+$5)', 'باص (+٥$)') : L('Own car', 'سيارة خاصة')}</span>`,
      `<span class="num">${usd(r.paid)}</span>`, status(r.status),
      `<button class="btn btn-secondary btn-dense" data-registration-review="${esc(r.id)}">${esc(registrationNext(r,selected))}</button>`]})),
    empty:empty('registr',L('No participants registered yet','لا مشتركون مسجّلون بعد'),
      L('Choose Register participant above to reserve the first place for this event.','اختر تسجيل مشترك أعلاه لحجز المقعد الأول لهذا الحدث.'))
  })}
  ${!selected.open?C.inlineAlert('info',L('Registration is closed','التسجيل مغلق'),L('Open the form before adding participants.','افتح الاستمارة قبل إضافة المشتركين.')):
    selected.taken>=selected.cap?C.inlineAlert('warning',L('Event capacity reached','بلغ الحدث سعته'),L('Increase the reviewed capacity before adding participants.','زد السعة بعد مراجعتها قبل إضافة مشتركين.')):''}
  <p class="t-caption dim" style="margin-top:16px">${L(
    'Use the participant reference in this event’s check-in session. A registration records a place; check-in records arrival.',
    'استعمل مرجع المشترك في جلسة الوصول الخاصة بهذا الحدث. يثبت التسجيل المقعد، ويثبت تسجيل الوصول الحضور.')}</p></div>`;

  if (tab === 'payments') {
    const paymentRows=selectedRows.map(r=>{
      const form=REGISTRATIONS.find(f=>f.id===r.registrationId),due=Number(form?.fee||0),payments=r.payments||[];
      const methods=payments.map(payment=>({cash:L('Cash','نقداً'),bank:L('Bank transfer','تحويل مصرفي'),omt:'OMT'}[payment.method]||payment.method)).join(', ');
      return {cells:[who(person(r.p)),methods?esc(methods):`<span class="dim">${L('Not recorded','غير مسجّلة')}</span>`,
        `<span class="num">${usd(r.paid||0)}</span>`,due<=0?pill(L('No fee','دون رسم'),''):
          Number(r.paid||0)>=due?pill(L('Paid','مدفوع'),'success'):pill(L('Balance due','رصيد مستحق'),'warning')]};
    });
    return head + `<div style="margin-top:20px" class="splitview">
    ${panel(L('Payment tracking', 'متابعة الدفعات'), table({
      cols: [{ label: L('Participant', 'المشترك') }, { label: L('Method', 'الطريقة'), cls: 'hide-sm' },
             { label: L('Amount', 'المبلغ'), cls: 'num' }, { label: L('Status', 'الحالة'), cls: 'shrink' }],
      rows: paymentRows
    }), { tight: true })}
    <div class="sidecol">${panel(L('Providers', 'مزوّدو الدفع'), `
      <p class="t-body dim" style="font-size:14px">${L(
        'Cash and bank transfers are recorded by hand with the currency they were paid in. An online provider is added only after supported countries, fees and refund behaviour have been confirmed.',
        'النقد والتحاويل تُسجَّل يدوياً بعملة الدفع. ولا يُضاف مزوّد إلكتروني إلا بعد تثبيت الدول المدعومة والرسوم وسلوك الاسترجاع.')}</p>
      <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><span class="chip chip-on">${L('Cash', 'نقداً')}</span>
        <span class="chip chip-on">${L('Bank transfer', 'تحويل')}</span><span class="chip">OMT</span>
        <span class="chip">${L('Card — not connected', 'بطاقة — غير موصولة')}</span></div>`)}</div></div>`;
  }

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
    const linked=!!linkedEvent(r),next=!linked?L('Link an event','اربط حدثاً'):!r.open?L('Open the form to accept people','افتح الاستمارة لقبول الأشخاص'):
      r.taken>=r.cap?L('At capacity; review participants','بلغت السعة؛ راجع المشتركين'):L('Register or review participants','سجّل المشتركين أو راجعهم');
    return { cells: [
      `<b>${esc(L(r.event, r.eventAr))}</b>${!linkedEvent(r)?`<small class="dim" style="display:block">${L('Legacy form · link an event before use','استمارة قديمة · اربطها بحدث قبل الاستخدام')}</small>`:''}`,
      `<span style="display:block;min-width:150px"><span class="t-caption dim tnum">${r.taken} / ${r.cap}</span>
        <span class="meter" style="margin-top:6px"><i style="width:${pct}%"></i></span></span>`,
      r.waiting ? pill(`${r.waiting} ${L('waiting', 'بالانتظار')}`, 'warning') : '<span class="dimmer">—</span>',
      r.fee ? `<span class="num">${usd(r.fee)}</span>` : `<span class="dim">${L('Free', 'مجاني')}</span>`,
      `<span class="dim">${fmtDate(r.deadline)}</span>`,
      r.open ? status('open') : status('draft'),
      `<span class="t-caption dim">${esc(next)}</span>`,
      `<span class="row" style="gap:6px;justify-content:flex-end"><button class="btn btn-secondary btn-dense" data-open-registration="${esc(r.id)}">${linked?L('Participants','المشتركون'):L('Link event','ربط الحدث')}</button>${CR.recBtn('registration', r.id)}</span>`
    ]};
  });

  return head + `<div class="tabbody"><div class="stats" style="margin-bottom:16px">${stat(L('Forms','الاستمارات'),REGISTRATIONS.length,L('for parish events','لأحداث الرعية'))}
    ${stat(L('Open forms','استمارات مفتوحة'),REGISTRATIONS.filter(form=>form.open&&linkedEvent(form)).length,L('accepting participants','تقبل المشتركين'))}
    ${stat(L('Participants','المشتركون'),REGISTRANTS.length,L('across linked forms','في الاستمارات المرتبطة'))}</div>${table({
      cols: [{ label: L('Event', 'الحدث'), sort: true }, { label: L('Capacity', 'السعة') },
             { label: L('Waiting', 'الانتظار'), cls: 'hide-sm' }, { label: L('Fee', 'الرسم'), cls: 'num hide-sm' },
             { label: L('Closes', 'يقفل'), cls: 'hide-md' }, { label: L('Status', 'الحالة'), cls: 'shrink' },
             {label:L('Next step','الخطوة التالية'),cls:'hide-sm'}, { label: '', cls: 'shrink' }],
      rows,
      empty: empty('registr', L('No registration forms', 'لا استمارات تسجيل'), L('Create one for a retreat, a lunch or a catechism year.', 'أنشئ واحدة لخلوة أو غداء أو سنة تعليم.'),
        `<button class="btn btn-primary btn-dense" data-act="form-new">${L('New form', 'استمارة جديدة')}</button>`)
    })}</div>`;
}

function registrationReview(id) {
  const row=REGISTRANTS.find(item=>item.id===id),form=row&&REGISTRATIONS.find(item=>item.id===row.registrationId);
  if(!row||!form)return;
  const event=linkedEvent(form),next=registrationNext(row,form);
  if(row.status==='registered'&&row.consent&&Number(row.paid||0)>=Number(form.fee||0)){
    if(event){selectCheckinEvent(event.id);go('checkin');}return;
  }
  const approval=row.status==='awaiting-approval',consent=!approval&&!row.consent;
  const confirm=!approval&&!consent&&row.status!=='registered';
  const payment=!approval&&!consent&&!confirm;
  const due=Math.max(0,Number(form.fee||0)-Number(row.paid||0));
  openDrawer({title:next,sub:esc(L(person(row.p)?.lat||row.p,person(row.p)?.ar||row.p)),
    body:`<dl class="dl"><dt>${L('Event','الحدث')}</dt><dd>${esc(L(form.event,form.eventAr))}</dd>
      <dt>${L('Current status','الحالة الحالية')}</dt><dd>${status(row.status)}</dd>
      <dt>${L('Consent','الموافقة')}</dt><dd>${row.consent?L('Received','مستلمة'):L('Missing','ناقصة')}</dd>
      <dt>${L('Paid','المدفوع')}</dt><dd>${usd(row.paid||0)} / ${usd(form.fee||0)}</dd></dl><div class="divider"></div>
      ${approval?C.inlineAlert('info',L('Office review','مراجعة المكتب'),L('Approving this application moves it to confirmation. Confirm consent separately when it is actually received.','تنقل الموافقة على الطلب إلى مرحلة التثبيت. سجّل الموافقة الأسرية عند استلامها فعلياً.')):''}
      ${consent?C.inlineAlert('warning',L('Confirm receipt of consent','أكّد استلام الموافقة'),L('Only continue if the required consent has been received.','تابع فقط إذا استلمت الموافقة المطلوبة.')):''}
      ${confirm?C.inlineAlert('info',L('Confirm the place','ثبّت المقعد'),L('The participant will appear as registered and can then check in at the event. Payment can be recorded separately.','سيظهر المشترك مسجّلاً ويمكنه الوصول إلى الحدث. يمكن تسجيل الدفع بشكل منفصل.')):''}
      ${payment?`<div class="formgrid">${C.field({label:L('Payment received (USD)','الدفعة المستلمة (دولار)'),id:'rg_amount',type:'number',value:due})}
        <div class="formrow"><label class="label" for="rg_method">${L('Method','الطريقة')}</label><select class="select" id="rg_method"><option value="cash">${L('Cash','نقداً')}</option><option value="bank">${L('Bank transfer','تحويل مصرفي')}</option><option value="omt">OMT</option></select></div></div>
        <p class="help">${L('Record only a payment already received.','سجّل فقط دفعة تم استلامها فعلياً.')}</p>`:''}`,
    foot:`<button class="btn btn-secondary" data-close>${L('Close','إغلاق')}</button><button class="btn btn-primary" id="rg_review_save">${esc(next)}</button>`,
    onMount(el){C.wire(el);el.querySelector('#rg_review_save').addEventListener('click',async()=>{
      if(approval)row.status='pending';
      else if(consent)row.consent=true;
      else if(confirm)row.status='registered';
      else if(payment){const amount=Number(el.querySelector('#rg_amount').value);
        if(!Number.isFinite(amount)||amount<=0||amount>due)return toast(L('Enter an amount no greater than the balance','أدخل مبلغاً لا يتجاوز الرصيد'),'','warning');
        row.paid=Number((Number(row.paid||0)+amount).toFixed(2));
        row.payments ||= [];row.payments.push({amount,method:el.querySelector('#rg_method').value,at:new Date().toISOString(),by:session.user?.id});
      }
      if(!await persist())return;closeOverlays();bus.refresh();toast(L('Registration updated','حُدّث التسجيل'),'','success');
    });}
  });
}

registrations.mount = host => {
  C.wire(host); wireTables(host);
  host.querySelector('[data-register-participant]')?.addEventListener('click',()=>F.registerParticipant());
  host.querySelectorAll('[data-registration-review]').forEach(button=>button.addEventListener('click',()=>registrationReview(button.dataset.registrationReview)));
  host.querySelector('#registration-select')?.addEventListener('change',e=>{selectRegistration(e.target.value);bus.refresh();});
  host.querySelectorAll('[data-open-registration]').forEach(b=>b.addEventListener('click',()=>{const form=REGISTRATIONS.find(r=>r.id===b.dataset.openRegistration);
    if(!linkedEvent(form))return CR.edit('registration',form?.id);
    selectRegistration(form.id);go('registrations/registrants');}));
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
  const chosenEvent=selectableCheckinEvents().find(e=>e.id===S.ui.checkinEventId);
  const session=selectedCheckin()||{rows:[],present:0,expected:chosenEvent?REGISTRANTS.filter(r=>REGISTRATIONS.some(f=>f.id===r.registrationId&&f.eventId===chosenEvent.id)).length:0,awaitingGuardian:0,room:chosenEvent?.venue};
  const eventParticipants=new Set(chosenEvent?REGISTRANTS.filter(r=>REGISTRATIONS.some(f=>f.id===r.registrationId&&f.eventId===chosenEvent.id)).map(r=>r.p):[]);
  const expected=eventParticipants.size;
  const head = pageHead({
    crumbs: [{ label: L('Parish life', 'حياة الرعية') }, { label: L('Check-in', 'التسجيل عند الباب') }],
    title: chosenEvent?L(chosenEvent.title,chosenEvent.titleAr):L('Check-in','تسجيل الوصول'),
    sub: chosenEvent?`${fmtDate(chosenEvent.d)} ${esc(chosenEvent.t)} · ${esc(L(eventVenue(chosenEvent)?.name||'',eventVenue(chosenEvent)?.ar||''))} · <span class="tnum">${session.present}</span>
          ${L('present of', 'حاضر من')} <span class="tnum">${expected}</span>`:
          L('Select the event whose registered participants are arriving. No event is selected by default.','اختر الحدث الذي يصل إليه المشتركون. لا يُحدّد حدث افتراضياً.'),
    actions: chosenEvent?`<button class="btn btn-secondary" data-act="scan">${icon('qr', 17)}${L('Enter reference', 'إدخال الرقم')}</button>
      <button class="btn btn-secondary" id="tags">${icon('print', 17)}${L('Name tags', 'بطاقات الأسماء')}</button>
      <button class="btn btn-primary" data-act="checkin-manual">${icon('plus', 17)}${L('Manual check-in', 'تسجيل يدوي')}</button>`:''
  }) + `<div class="toolbar" style="margin:18px 0"><label class="label" for="checkin-event">${L('Check-in event','حدث تسجيل الوصول')}</label>
    <select class="select" id="checkin-event" style="max-width:380px"><option value="">${L('Select event','اختر حدثاً')}</option>
    ${selectableCheckinEvents().map(e=>`<option value="${esc(e.id)}" ${chosenEvent?.id===e.id?'selected':''}>${esc(L(e.title,e.titleAr))} · ${esc(e.d)} ${esc(e.t)} · ${esc(eventVenue(e)?.name||'')}</option>`).join('')}</select></div>` + tabBar('checkin', CTABS(), tab);

  if(!chosenEvent)return head+`<div class="tabbody">${empty('registr',L('Select an event to check in','اختر حدثاً لتسجيل الوصول'),
    L('Only events with linked registration forms appear above. Mass and feast liturgies are not eligible.','تظهر فقط الأحداث المرتبطة باستمارات تسجيل. القداديس واحتفالات الأعياد غير مشمولة.'))}</div>`;

  if (tab === 'pickup') return head + `<div class="tabbody">
    ${C.inlineAlert('warning', L('Check-in and release are separate, auditable actions', 'التسجيل والتسليم إجراءان منفصلان قابلان للتدقيق'),
      L('A restricted entry means do not release, whatever code is presented. Call a member of staff.',
        'القيد المقيَّد يعني عدم التسليم مهما كان الرمز المقدَّم. نادِ أحد الموظّفين.'))}
    <div class="stack" style="gap:16px;margin-top:16px">
      ${[...eventParticipants].map(pid=>{const v=PICKUP[pid]||{approved:[],restricted:[],required:false};return `<section class="panel"><div class="panel-h">
        ${who(person(pid))}<span style="margin-inline-start:auto"></span>
        ${v.restricted.length ? pill(L('Restricted', 'مقيّد'), 'danger', 'lock') : v.required===false||!PICKUP[pid]?pill(L('No pickup needed','لا حاجة إلى استلام'),'success'):pill(L('Pickup required','يتطلب الاستلام'),'warning')}</div>
        <div class="panel-b">
          <label class="check"><input type="checkbox" data-pickup-required="${esc(pid)}" ${v.required!==false&&!!PICKUP[pid]?'checked':''} ${v.restricted.length?'disabled':''}><span>${L('Requires an authorised pickup','يتطلب استلاماً من شخص مفوّض')}</span></label>
          ${v.required===false||!PICKUP[pid]?`<p class="help">${L('This participant can check out without a pickup code.','يمكن لهذا المشترك تسجيل الخروج بلا رمز استلام.')}</p>`:''}
          <div class="ac-group" style="padding-inline:0">${L('Approved to collect', 'مفوَّضون بالاستلام')}</div>
          ${v.approved.map(([en, ar, rel], ai) => `<div class="listrow" style="padding-inline:0">
            <span class="grow"><b>${esc(isAr() ? ar : en)}</b><small>${esc(rel)}</small></span>
            ${C.iconBtn('trash', L('Remove', 'إزالة'), `data-act="pickup-remove:${pid}|${ai}"`)}</div>`).join('')}
          ${v.restricted.length ? `<div class="divider"></div>
            ${v.restricted.map(([en, ar]) => C.inlineAlert('danger', L('Do not release', 'لا تُسلّم'), L(en, ar))).join('')}` : ''}
          <button class="btn btn-secondary btn-dense" style="margin-top:12px" data-act="pickup-add:${pid}">${icon('plus', 15)}${L('Add an authorised person', 'إضافة شخص مفوَّض')}</button>
        </div></section>`;}).join('') || `<p class="help">${L('No registered participants at this event.','لا مشتركون مسجّلون في هذا الحدث.')}</p>`}
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
      <span class="t-caption dim">${r.code?`${r.guardian&&r.guardian!=='—'?`${L('Pickup','الاستلام')}: ${esc(r.guardian)} · `:''}<b class="mono">${esc(r.code)}</b>`:L('No pickup needed','لا حاجة إلى استلام')}</span>
      <button class="btn btn-secondary btn-dense" data-act="checkout:${r.p}">${L('Check out', 'تسجيل خروج')}</button></div>`;
  }).join('');

  return head + `<div class="stats" style="margin:20px 0 24px">
      ${stat(L('Present now', 'الحاضرون الآن'), session.rows.length, `${L('registered','مسجّل')} ${expected}`)}
      ${stat(L('Awaiting pickup', 'بانتظار الاستلام'), session.rows.filter(r=>!!r.code).length, L('pickup code issued','صدر رمز استلام'))}
      ${stat(L('No pickup needed', 'لا حاجة إلى استلام'), session.rows.filter(r=>!r.code).length, L('may check out normally','يمكنهم تسجيل الخروج مباشرةً'))}
    </div>
    ${panel(L('Participants checked in', 'المشتركون الحاضرون'), rows||`<p class="help">${L('No one has checked in yet.','لم يسجّل أحد وصوله بعد.')}</p>`, { tight: true })}
    ${C.inlineAlert('warning', L('Confirm identity before releasing a participant', 'تحقّق من الهوية قبل تسليم المشترك'),
      L('Every release, exception and override is recorded with the name of whoever approved it.',
        'كل تسليم واستثناء وتجاوز يُسجَّل باسم من وافق عليه.'))}`;
}

checkin.mount = host => {
  C.wire(host); wireTables(host);
  host.querySelectorAll('[data-pickup-required]').forEach(box=>box.addEventListener('change',()=>{const pid=box.dataset.pickupRequired;PICKUP[pid] ||= {approved:[],restricted:[],required:false};if(PICKUP[pid].restricted?.length&& !box.checked){box.checked=true;return;}PICKUP[pid].required=box.checked;const row=selectedCheckin()?.rows.find(r=>r.p===pid);if(row){row.pickupRequired=box.checked;row.code=box.checked?(row.code||String(1000+Math.floor(Math.random()*9000))):'';}bus.refresh();}));
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
};
