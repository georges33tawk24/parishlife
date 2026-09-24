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
import { EVENTS, FEASTS, SERVICE, GROUPS, GROUP_DETAIL, groupInfo, eventInfo, ROTA, REGISTRATIONS, REG_FORM, REGISTRANTS, REFUNDS,
         CHECKIN, PICKUP, INCIDENTS, EVACUATION, VENUES, TODAY, VOLUNTEERS, SIGNUP_SHEETS,
         SERVICE_REQUESTS, SERVICE_TEMPLATES, EVENT_DETAIL, EVENT_TEMPLATES,
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
    actions: `<button class="btn btn-secondary" id="printweek">${icon('print', 17)}${L('Print my week', 'اطبع أسبوعي')}</button>
      <button class="btn btn-secondary" id="subscribe">${icon('link', 17)}${L('Subscribe', 'اشتراك')}</button>
      ${C.splitBtn(L('New event', 'حدث جديد'), 'newev')}`
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

  if (tab === 'templates') return head + `<div style="margin-top:20px" class="gridcards">
    ${EVENT_TEMPLATES.map(([en, ar, ic], ti) => `<button class="panel" style="cursor:pointer;text-align:start;border:1px solid var(--border)" data-tpl="${ti}">
      <div class="panel-b"><div class="row" style="gap:10px"><span class="avatar avatar-lg">${icon(ic, 20)}</span>
        <b style="font:600 15px/21px var(--sans)">${esc(L(en, ar))}</b></div></div></button>`).join('')}</div>
    <p class="t-caption dim" style="margin-top:16px">${L(
      'A template carries the duration, the default room, the teams to invite and the order of service, so a Sunday takes one click rather than twenty fields.',
      'يحمل القالب المدة والقاعة الافتراضية والفرق المدعوّة وترتيب الخدمة، فيصبح الأحد نقرة واحدة بدل عشرين حقلاً.')}</p>`;

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
  host.querySelectorAll('[data-ev]').forEach(el => el.addEventListener('click', () => eventDrawer(el.dataset.ev)));
  host.querySelector('[data-split="newev"]')?.addEventListener('click', () => eventDrawer(null, true));
  host.querySelector('#newday')?.addEventListener('click', () => eventDrawer(null, true, { d: S.ui.calDay || iso(TODAY) }));
  host.querySelectorAll('[data-day]').forEach(b => b.addEventListener('click', () => { S.ui.calDay = b.dataset.day; go('calendar/day'); }));
  host.querySelectorAll('[data-tpl]').forEach(b => b.addEventListener('click', () => {
    const [en, ar] = EVENT_TEMPLATES[+b.dataset.tpl];
    eventDrawer(null, true, { title: en, titleAr: ar, d: '2026-10-18' });
  }));
  host.querySelector('[data-splitmenu="newev"]')?.addEventListener('click', e => openMenu(e.currentTarget, [
    { head: L('Start from a template', 'ابدأ من قالب') },
    ...EVENT_TEMPLATES.map(([en, ar, ic]) => ({ label: L(en, ar), icon: ic, fn: () => eventDrawer(null, true, { title: en, titleAr: ar, d: S.ui.calDay || iso(TODAY) }) })),
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
  host.querySelector('#printweek')?.addEventListener('click', () => openModal({
    title: L('Print my week', 'اطبع أسبوعي'),
    sub: L('One readable sheet of Masses, meetings, room bookings and assigned volunteers — for the staff who prefer paper.',
           'ورقة واحدة بالقداديس والاجتماعات وحجوزات القاعات والمتطوّعين — لمن يفضّل الورق.'),
    body: `<div class="stack" style="gap:10px">
      ${C.checkRow(L('Masses and services', 'القداديس والخدم'), { checked: true })}
      ${C.checkRow(L('Room bookings', 'حجوزات القاعات'), { checked: true })}
      ${C.checkRow(L('Assigned volunteers', 'المتطوّعون المسندون'), { checked: true })}
      ${C.checkRow(L('Private group meetings', 'اجتماعات المجموعات الخاصة'))}</div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" data-act="print">${L('Print', 'طباعة')}</button>`
  }));
};

function eventDrawer(id, isNew = false, pre = null) {
  const e = EVENTS.find(x => x.id === id);
  if (!isNew && !e) return;
  const d = e ? eventInfo(e) : null, ed = pre?.id ? eventInfo(pre) : null;
  if (isNew) return openDrawer({
    large: true,
    title: pre?.id ? L('Edit event', 'تعديل الحدث') : L('New event', 'حدث جديد'),
    sub: L('Conflicts are checked for the room and for every person you invite.', 'يُفحص التعارض للقاعة ولكل شخص تدعوه.'),
    body: `${C.field({ label: L('Title', 'العنوان'), req: true, id: 'ev_t', value: pre ? L(pre.title, pre.titleAr) : '', ph: L('Parish lunch', 'غداء الرعية') })}
      <div class="formgrid">
        <div class="formrow"><label class="label">${L('Template', 'القالب')}</label>
          <select class="select"><option>${L('None', 'بلا')}</option>${EVENT_TEMPLATES.map(x => `<option ${pre?.title === x[0] ? 'selected' : ''}>${esc(L(x[0], x[1]))}</option>`).join('')}</select></div>
        <div class="formrow"><label class="label">${L('Category', 'الفئة')}</label>
          <select class="select" id="ev_cat">${[['event', 'Parish life', 'حياة الرعية'], ['mass', 'Worship', 'العبادة'], ['group', 'Formation', 'التنشئة'], ['sacr', 'Sacrament', 'سرّ']]
            .map(([v, en, ar]) => `<option value="${v}" ${(pre?.kind || 'event') === v ? 'selected' : ''}>${esc(L(en, ar))}</option>`).join('')}</select></div>
        ${C.field({ label: L('Date', 'التاريخ'), type: 'date', value: pre?.d || '2026-10-18', id: 'ev_d' })}
        <div class="formrow"><label class="label">${L('Repeats', 'التكرار')}</label>
          <select class="select"><option>${L('Once', 'مرّة')}</option><option>${L('Every week', 'كل أسبوع')}</option>
            <option>${L('Every month', 'كل شهر')}</option><option>${L('Every year', 'كل سنة')}</option></select></div>
        ${C.field({ label: L('From', 'من'), type: 'time', value: pre?.t || '12:00', id: 'ev_from' })}
        ${C.field({ label: L('To', 'إلى'), type: 'time', value: pre?.to || '14:00', id: 'ev_to' })}
        <div class="formrow"><label class="label" for="ev_v">${L('Room', 'القاعة')}</label>
          <select class="select" id="ev_v">${VENUES.map(v => `<option value="${v.id}" ${(pre?.venue || 'v3') === v.id ? 'selected' : ''}>${esc(L(v.name, v.ar))}</option>`).join('')}</select></div>
        <div class="formrow"><label class="label">${L('Time zone', 'المنطقة الزمنية')}</label>
          <select class="select"><option>Asia/Beirut (EEST)</option></select></div>
      </div>
      ${C.textarea({ label: L('Description', 'الوصف'), id: 'evdesc', max: 400, value: ed ? L(ed.desc, ed.descAr) : '' })}
      ${C.personPicker(L('Invite people', 'دعوة أشخاص'), 'evinv')}
      ${C.chipField(L('Required items', 'المستلزمات'), [L('Trestle tables', 'طاولات'), L('Cash box', 'صندوق نقد')])}
      <div class="formgrid">
        ${C.stepper({ label: L('Capacity', 'السعة'), value: ed?.cap || 60, id: 'evcap' })}
        <div class="formrow"><label class="label">${L('Visibility', 'الظهور')}</label>
          <select class="select"><option>${L('Public — parish calendar', 'عام — رزنامة الرعية')}</option>
            <option>${L('Private — inside the group', 'خاص — داخل المجموعة')}</option>
            <option>${L('Confidential', 'سرّي')}</option></select></div>
      </div>
      <div class="stack" style="gap:10px">${C.checkRow(L('Ask for RSVP', 'طلب تأكيد الحضور'), { checked: true })}
        ${C.checkRow(L('Allow a waiting list once full', 'السماح بلائحة انتظار عند الامتلاء'), { checked: true })}
        ${C.checkRow(L('Send a reminder 24 hours before', 'تذكير قبل ٢٤ ساعة'), { checked: true })}</div>
      <div id="evclash"></div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="ok" style="margin-inline-start:auto">${pre?.id ? L('Save changes', 'حفظ التعديلات') : L('Create event', 'إنشاء الحدث')}</button>`,
    onMount(el) {
      C.wire(el);
      const v = sel => el.querySelector(sel).value;
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
        const title = v('#ev_t').trim(), dte = v('#ev_d'), tme = v('#ev_from');
        const fields = { d: dte, t: tme, to: v('#ev_to'), venue: v('#ev_v'), kind: v('#ev_cat') };
        const desc = v('#evdesc').trim(), cap = +v('#evcap') || 0;
        let ev;
        if (pre?.id) {
          ev = EVENTS.find(x => x.id === pre.id);
          const same = title === L(ev.title, ev.titleAr);
          Object.assign(ev, fields, same ? {} : { title, titleAr: title });
        } else EVENTS.push(ev = { id: 'ev' + Date.now().toString(36), title, titleAr: title, ...fields });
        Object.assign(eventInfo(ev), { desc, descAr: desc, cap });
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
        <dt>${L('Organiser', 'المنظّم')}</dt><dd>${esc(isAr() ? person(d.organizer).ar : person(d.organizer).lat)}</dd>
        <dt>${L('Category', 'الفئة')}</dt><dd>${esc(L(d.cat, d.catAr))}</dd>
        <dt>${L('Time zone', 'المنطقة الزمنية')}</dt><dd class="mono">${d.tz}</dd>
        <dt>${L('Visibility', 'الظهور')}</dt><dd>${L('Public', 'عام')}</dd>
        ${d.tags.length ? `<dt>${L('Tags', 'الوسوم')}</dt><dd>${d.tags.map(x => `<span class="chip" style="margin-inline-end:6px">${esc(x)}</span>`).join('')}</dd>` : ''}
      </dl>
      ${d.desc ? `<p class="t-body dim" style="font-size:14px;margin-top:14px">${esc(L(d.desc, d.descAr))}</p>` : ''}
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
        <a class="chip" href="#/reservations">${icon('rooms', 14)} ${L('Reservation RES-2026-210', 'الحجز RES-2026-210')}</a>
        <a class="chip" href="#/registrations">${icon('registr', 14)} ${L('Registration form', 'استمارة التسجيل')}</a>
        <a class="chip" href="#/volunteers">${icon('vol', 14)} ${L('Serving team', 'فريق الخدمة')}</a>
      </div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
      <button class="btn btn-secondary" data-act="event-dup:${e.id}">${L('Duplicate', 'نسخ')}</button>
      <button class="btn btn-danger-quiet" data-act="event-cancel:${e.id}">${L('Cancel event', 'إلغاء الحدث')}</button>
      <button class="btn btn-primary" style="margin-inline-start:auto" id="evedit">${L('Edit', 'تعديل')}</button>`,
    onMount(el) { C.wire(el); el.querySelector('#evedit').addEventListener('click', () => eventDrawer(e.id, true, e)); }
  });
}

/* ═══════════════ 6 · service planning ═══════════════ */
const STABS = () => [['', 'This plan', 'هذه الخدمة'], ['requests', 'Requests', 'الطلبات', SERVICE_REQUESTS.filter(r => r.status === 'pending').length],
               ['templates', 'Templates', 'القوالب']];

export function services(tab = '') {
  const cel = person(SERVICE.celebrant), coord = person(SERVICE.coordinator);
  const total = SERVICE.order.reduce((a, o) => a + Number(o.dur), 0);
  const head = pageHead({
    crumbs: [{ label: L('Parish life', 'حياة الرعية') }, { label: L('Service planning', 'تخطيط الخدم') }],
    title: tab ? L('Service planning', 'تخطيط الخدم') : L(SERVICE.title, SERVICE.titleAr),
    sub: tab ? L('Ceremonies are planned here; the official record is created separately in the sacramental registers.',
                 'تُخطَّط الاحتفالات هنا؛ والسجل الرسمي يُنشأ منفصلاً في سجلات الأسرار')
             : `${fmtLong(new Date(SERVICE.date))} · ${esc(L(venue(SERVICE.venue).name, venue(SERVICE.venue).ar))} ·
                ${esc(L(SERVICE.language, SERVICE.languageAr))} · ${total} ${L('minutes', 'دقيقة')}`,
    actions: `<button class="btn btn-secondary" id="slides">${icon('doc', 17)}${L('Generate slides', 'توليد العرض')}</button>
      <button class="btn btn-secondary" data-act="print">${icon('print', 17)}${L('Print order', 'طباعة الترتيب')}</button>
      <button class="btn btn-primary" data-act="svc-add">${icon('plus', 17)}${L('Add item', 'إضافة بند')}</button>`
  }) + tabBar('services', STABS(), tab);

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

  if (tab === 'templates') return head + `<div class="tabbody">${table({
    cols: [{ label: L('Template', 'القالب') }, { label: L('Items', 'البنود'), cls: 'num' }, { label: '', cls: 'shrink' }],
    rows: SERVICE_TEMPLATES.map(([en, ar, n], ti) => ({ cells: [
      `<b>${esc(L(en, ar))}</b>`, `<span class="num">${n}</span>`,
      `<span class="row" style="gap:6px;justify-content:flex-end">
        <button class="btn btn-secondary btn-dense" data-act="svc-tpl:${ti}">${L('Use', 'استعمال')}</button>
        ${C.iconBtn('edit', L('Edit template', 'تعديل القالب'), 'data-go="services"')}</span>`]}))
  })}
  <p class="t-caption dim" style="margin-top:16px">${L(
    'A completed plan can be saved back as a template, so last Christmas becomes the starting point for this one.',
    'يمكن حفظ خطة منجزة كقالب، فيصبح ميلاد العام الماضي نقطة انطلاق هذا العام.')}</p></div>`;

  const rows = SERVICE.order.map((o, oi) => {
    const a = o.who?.startsWith('g') ? group(o.who) : person(o.who);
    const aLabel = !a ? '' : a.lat ? (isAr() ? a.ar : a.lat) : L(a.name, a.ar);
    return `<div class="oos-row"><span class="dur">${o.dur}'</span>
      <span class="body"><b>${esc(o.t)}</b><span class="ar">${esc(o.ar)}</span>
        ${o.note ? `<span class="note">${esc(L(o.note, o.noteAr || o.note))}</span>` : ''}</span>
      <span class="who-s">${a && a.lat ? avatar(a, 'avatar-sm') : ''}<span class="t-caption dim">${esc(aLabel)}</span>
        ${S.ui.reorder
          ? `${C.iconBtn('chevD', L('Move up', 'نقل للأعلى'), `data-act="svc-move:${oi}|-1" style="transform:rotate(180deg)" ${oi ? '' : 'disabled'}`)}${C.iconBtn('chevD', L('Move down', 'نقل للأسفل'), `data-act="svc-move:${oi}|1" ${oi < SERVICE.order.length - 1 ? '' : 'disabled'}`)}`
          : C.iconBtn('dots', L('Item actions', 'إجراءات البند'), `data-act="svc-item:${oi}"`)}</span></div>`;
  }).join('');

  const teamRows = ROTA.teams.map(tm => {
    const filled = tm.filled.filter(f => f.s === 'accepted').length;
    return `<div class="listrow"><span class="grow"><b>${esc(L(tm.team, tm.teamAr))}</b>
        <small>${filled}/${tm.need} ${L('confirmed', 'مؤكَّد')}</small></span>
      ${filled >= tm.need ? status('ready') : status('unfilled')}</div>`;
  }).join('');

  return head + `<div class="splitview">
    <div>
      ${panel(L('Order of service', 'ترتيب الخدمة'), rows, { tight: true,
        more: `<button class="btn btn-ghost btn-dense" data-act="svc-reorder">${S.ui.reorder ? L('Done', 'تمّ') : L('Reorder', 'إعادة الترتيب')}</button>` })}
      <p class="t-caption dim" style="margin-top:12px">${L(
        'Hymns come from the music library with their key already set, so the choir does not re-decide it every week.',
        'تأتي الألحان من مكتبة الألحان بمقامها المحدَّد، فلا تعيد الجوقة تحديده كل أسبوع.')}</p>
      ${sectionH(L('Rehearsal plan', 'خطة التمرين'))}
      ${panel('', `<div class="timeline">
        <div class="tl-item accent"><div class="when">${L('Friday 19:00', 'الجمعة ١٩:٠٠')}</div>
          <div class="what">${L('Full run of the entrance and offertory hymns', 'تمرين كامل لنشيدَي الدخول والتقدمة')}</div></div>
        <div class="tl-item"><div class="when">${L('Sunday 09:45', 'الأحد ٠٩:٤٥')}</div>
          <div class="what">${L('Sound check and altar servers briefing', 'فحص الصوت وإحاطة خدّام المذبح')}</div></div></div>`)}
    </div>
    <div class="sidecol">
      ${panel(L('Who is on', 'من يخدم'), teamRows, { more: `<a href="#/volunteers">${L('Rota', 'المناوبات')}</a>`, tight: true })}
      ${panel(L('Details', 'التفاصيل'), `<dl class="dl">
        <dt>${L('Celebrant', 'المحتفل')}</dt><dd>${esc(isAr() ? cel.ar : cel.lat)}</dd>
        <dt>${L('Coordinator', 'المنسّقة')}</dt><dd>${esc(isAr() ? coord.ar : coord.lat)}</dd>
        <dt>${L('Language', 'اللغة')}</dt><dd>${esc(L(SERVICE.language, SERVICE.languageAr))}</dd>
        <dt>${L('Preparation', 'التحضير')}</dt><dd>${status('ready')}</dd>
        <dt>${L('Recording', 'التسجيل')}</dt><dd>${L('Homily, requested by the eparchy', 'العظة، بطلب من الأبرشية')}</dd></dl>`)}
      ${panel(L('Attached', 'المرفقات'), `
        ${[[ 'music', 'Qadishat Aloho', L('sheet + recording', 'نوتة + تسجيل')],
           ['doc', L('Readings sheet', 'ورقة القراءات'), 'PDF · 2'],
           ['doc', L('Slides', 'الشرائح'), L('generated from the order', 'مولّدة من الترتيب')],
           ['msg', L('Homily recording', 'تسجيل العظة'), 'MP3 · 11:04']]
          .map(([ic, a, b]) => `<div class="listrow" style="padding-inline:0">${icon(ic, 17, 'dimmer')}
            <span class="grow"><b>${esc(a)}</b><small>${esc(b)}</small></span>${C.iconBtn('export', L('Open', 'فتح'), `data-act="doc:${a}"`)}</div>`).join('')}
        <div class="divider"></div>${C.dropzone('svc')}`, { tight: false })}
      ${panel(L('After the ceremony', 'بعد الاحتفال'), `
        <div class="stack" style="gap:10px">${C.checkRow(L('Attendance recorded', 'سُجّل الحضور'), { checked: true })}
          ${C.checkRow(L('Follow-up notes written', 'كُتبت ملاحظات المتابعة'))}
          ${C.checkRow(L('Linked to the sacramental register', 'رُبط بسجل الأسرار'))}</div>
        <p class="t-caption dim" style="margin-top:10px">${L(
          'Linking is a separate, authorised step. A ceremony happening is not the same as a register entry.',
          'الربط خطوة منفصلة ومُصرَّح بها. حصول الاحتفال ليس كقيده في السجل.')}</p>`)}
    </div></div>`;
}
services.mount = host => {
  C.wire(host); wireTables(host);
  host.querySelector('#slides')?.addEventListener('click', () => openModal({
    title: L('Generate slides', 'توليد العرض'),
    sub: L('Built from the order of service and the licensed lyrics already in the music library.',
           'مبنيّة من ترتيب الخدمة والكلمات المرخّصة الموجودة في مكتبة الألحان.'),
    body: `<div class="stack" style="gap:10px">
        ${C.checkRow(L('Hymn lyrics (where the licence allows)', 'كلمات الألحان (حيث يسمح الترخيص)'), { checked: true })}
        ${C.checkRow(L('Readings', 'القراءات'), { checked: true })}
        ${C.checkRow(L('Announcements', 'الإعلانات'), { checked: true })}
        ${C.checkRow(L('Parish logo on every slide', 'شعار الرعية على كل شريحة'), { checked: true })}</div>
      <div class="formrow" style="margin-top:16px"><label class="label">${L('Language', 'اللغة')}</label>
        <select class="select"><option>${L('Arabic', 'عربي')}</option><option>${L('Bilingual', 'ثنائي اللغة')}</option>
          <option>${L('English', 'إنكليزي')}</option></select></div>
      ${C.inlineAlert('info', L('A generic deck every parish can use', 'عرض عام تستطيع كل رعية استعماله'),
        L('The layout is shared; only the parish name, logo and content change.', 'التصميم مشترك؛ ويتغيّر اسم الرعية والشعار والمحتوى فقط.'))}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" data-act="slides">${icon('export', 16)}${L('Generate', 'توليد')}</button>`,
    onMount(el) { C.wire(el); }
  }));
};

/* ═══════════════ 3 · groups ═══════════════ */
export function groups(id, tab) {
  if (id) return groupDetail(id, tab || '');
  const mine = is('leader') ? GROUPS.filter(g => g.leader === 'p3') : GROUPS;
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
        ${CR.recBtn('group', g.id)}</div>
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
        <button class="btn btn-primary" data-act="group-new">${icon('plus', 17)}${L('New group', 'مجموعة جديدة')}</button>`
    })}
    <div class="gridcards">${cards}</div>
    <p class="t-caption dim" style="margin-top:20px">${L(
      'People are placed into roles, not roles into people. When a leader hands over, the ongoing tasks follow the role to whoever takes it.',
      'يوضع الأشخاص في الأدوار لا الأدوار في الأشخاص. وعند التسليم تنتقل المهام الجارية مع الدور إلى من يتسلّمه.')}</p>`;
}

const GTABS = () => [['', 'Overview', 'نظرة عامة'], ['roster', 'Roster', 'اللائحة'], ['meetings', 'Meetings', 'الاجتماعات'],
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
      <div class="acts"><button class="btn btn-secondary" data-act="compose:group">${icon('msg', 17)}${L('Message group', 'مراسلة المجموعة')}</button>
        <button class="btn btn-secondary" id="qr">${icon('qr', 17)}${L('Signup QR', 'رمز التسجيل')}</button>
        <button class="btn btn-primary" data-act="member-add:${g.id}">${icon('plus', 17)}${L('Add member', 'إضافة عضو')}</button>
        ${CR.recBtn('group', g.id, L('Group actions', 'إجراءات المجموعة'))}</div>
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
        ${panel(L('Attendance', 'الحضور'), C.kpi({ k: L('Last 4 meetings', 'آخر ٤ اجتماعات'), v: '86%',
          delta: L('+4 on the month', '+٤ عن الشهر'), spark: [72, 80, 76, 88, 84, 90, 86] }))}
      </div></div>`,

    roster: () => table({
      pick: true,
      cols: [{ label: L('Member', 'العضو'), sort: true }, { label: L('Role', 'الدور'), cls: 'hide-sm' },
             { label: L('Joined', 'انتسب'), cls: 'hide-md' }, { label: L('Attendance', 'الحضور'), cls: 'num' }, { label: '', cls: 'shrink' }],
      rows: d.roster.map(r => ({ cells: [
        who(person(r.p)),
        `<span class="dim">${esc(L(r.role, r.roleAr))}</span>`,
        `<span class="mono dim">${r.joined}</span>`,
        `<span class="num">${r.att}%</span>`,
        `<span class="rowacts">${C.iconBtn('msg', L('Message', 'مراسلة'), `data-act="compose:${r.p}"`)}${C.iconBtn('dots', L('More', 'المزيد'), `data-act="member-menu:${r.p}"`)}</span>`]}))
    }),

    meetings: () => `<div class="stack" style="gap:16px">
      ${d.meetings.map(m => `<section class="panel"><div class="panel-h">
        <h3>${fmtLong(new Date(m.d))} · ${m.t}</h3>
        ${m.done ? status('closed') : status('scheduled')}</div>
        <div class="panel-b">${m.done
          ? `<div class="row" style="gap:24px;flex-wrap:wrap">
              <div><div class="t-caption dim">${L('Present', 'حاضر')}</div><div style="font:600 22px/28px var(--sans)">${m.present}</div></div>
              <div style="flex:1;min-width:200px"><div class="t-caption dim">${L('Absent, with a reason', 'غائب بعذر')}</div>
                ${m.absent.map(([p, en, ar]) => `<div class="row" style="gap:8px;margin-top:6px">${avatar(person(p), 'avatar-sm')}
                  <span class="t-caption">${esc(isAr() ? person(p).ar : person(p).lat)} — ${esc(L(en, ar))}</span></div>`).join('')}</div>
            </div>`
          : `<div class="grid g3" style="gap:10px">
              ${[[L('Yes', 'نعم'), m.rsvp.yes], [L('No', 'لا'), m.rsvp.no], [L('No reply', 'بلا ردّ'), m.rsvp.none]]
                .map(([k, v]) => `<div class="card card-flat" style="padding:12px"><div class="t-caption dim">${esc(k)}</div>
                  <div style="font:600 20px/26px var(--sans)">${v}</div></div>`).join('')}</div>
             <div class="row" style="gap:8px;margin-top:14px">
               <button class="btn btn-secondary btn-dense" data-act="remind:group">${L('Send a reminder', 'إرسال تذكير')}</button>
               <button class="btn btn-primary btn-dense" data-go="checkin">${L('Take attendance', 'تسجيل الحضور')}</button></div>`}
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

groups.mount = host => {
  C.wire(host); wireTables(host);
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
        <span class="idle">${L(`Drop ${tm.one}`, `أفلت ${tm.oneAr}`)}</span><span class="rel">${L('Release here', 'أفلت هنا')}</span></button>`;
      const p = person(f.p), also = onTeams(f.p).filter(x => x !== tm)[0];
      const dbl = f.s !== 'declined' && !!also;
      const sub = f.s === 'declined' ? L('Declined', 'اعتذر')
        : dbl ? L(`Also on ${also.team}`, `أيضاً في ${also.teamAr}`)
        : f.s === 'pending' ? L('Reply due 6 Oct', 'مهلة الردّ ٦ ت١') : L(p.town, p.townAr);
      return `<div class="rota-card ${f.s}${dbl ? ' dbl' : ''}" draggable="true" data-slot="${at}" data-accept="${f.s === 'declined' ? 'any' : 'card'}">
        ${avatar(p, 'avatar-xs')}
        <span class="rc-t"><b title="${esc(isAr() ? p.ar : p.lat)}">${esc(isAr() ? p.ar : p.lat.replace(/^(\S+)\s+(\S).*$/, '$1 $2.'))}</b><small>${esc(sub)}</small></span>
        ${f.swap ? `<button class="rota-swap" data-act="rota-swap:${at}">${L('Swap', 'تبديل')}</button>` : ''}
        ${f.s === 'declined' ? '' : `<span class="rdot ${f.s}" role="img" aria-label="${f.s === 'accepted' ? L('Confirmed', 'مؤكَّد') : L('Awaiting reply', 'بانتظار الردّ')}"></span>`}
        ${f.s === 'declined' ? `<button class="rota-sub" data-sub="${p.id}">${L('Shortlist substitutes', 'اقتراح بدلاء')}</button>` : ''}
      </div>`;
    }).join('');
    const ok = tm.filled.filter(f => f.p && f.s === 'accepted').length;
    return `<section class="rota-col"><header><b>${esc(L(tm.team, tm.teamAr))}</b>
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
      <div class="rota-board${teams.length < 3 ? ' few' : ''}">${cols}</div></div>
      <p class="rota-legend"><span><i class="rdot accepted"></i>${L('confirmed', 'مؤكَّد')}</span>
        <span><i class="rdot pending"></i>${L('awaiting reply', 'بانتظار الردّ')}</span>
        <span><i class="rdbl"></i>${L('double-booked', 'حجز مزدوج')}</span>
        <span><i class="rota-swap" aria-hidden="true">${L('Swap', 'تبديل')}</i>${L('swap request', 'طلب تبديل')}</span>
        <span class="dim">${L('On a phone, tap an empty place to invite someone.', 'على الهاتف، اضغط مركزاً شاغراً لدعوة أحد.')}</span></p>`)}
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
  const head = pageHead({
    crumbs: [{ label: L('Parish life', 'حياة الرعية') }, { label: L('Registrations', 'التسجيلات') }],
    title: L('Registration and payments', 'التسجيل والدفع'),
    sub: L('Individual and household registration, capacity, waiting lists, consent and recorded cash — connected straight to the check-in roster.',
           'تسجيل فردي وعائلي، سعة ولوائح انتظار وموافقات ودفع نقدي مسجَّل — موصول مباشرة بلائحة التسجيل عند الباب.'),
    actions: `<button class="btn btn-secondary" id="regqr">${icon('qr', 17)}${L('Registration QR', 'رمز التسجيل')}</button>
      <button class="btn btn-primary" data-act="form-new">${icon('plus', 17)}${L('New form', 'استمارة جديدة')}</button>`
  }) + tabBar('registrations', RTABS(), tab);

  if (tab === 'builder') return head + `<div style="margin-top:20px" class="splitview">
    <div>${panel(L(REG_FORM.title, REG_FORM.titleAr), REG_FORM.fields.map(([en, ar, type, req, he, ha], fi) => `
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
        <div class="amount" dir="ltr"><span class="usd">${usd(REG_FORM.fee)}</span>
          <span class="lbp">L.L ${num(REG_FORM.fee * 89500)}</span></div>
        <div class="divider"></div>
        ${REG_FORM.discounts.map(([en, ar, v]) => `<div class="listrow" style="padding-inline:0">
          <span class="grow">${esc(L(en, ar))}</span><b class="mono">${v}</b></div>`).join('')}
        <div class="ac-group" style="padding-inline:0">${L('Instalments', 'أقساط')}</div>
        ${REG_FORM.installments.map(([en, ar, v]) => `<div class="listrow" style="padding-inline:0">
          <span class="grow">${esc(L(en, ar))}</span><b class="mono">${usd(v)}</b></div>`).join('')}`)}
      ${panel(L('Confirmation message', 'رسالة التأكيد'), C.richText(
        L('You are registered for the Annaya retreat. Bring a sleeping bag, a jacket and your own water bottle.',
          'تسجيلك في خلوة عنّايا مؤكَّد. أحضر كيس نوم وسترة وقنّينة ماء.')))}
    </div></div>`;

  if (tab === 'registrants') return head + `<div class="tabbody">${table({
    pick: true,
    cols: [{ label: L('Participant', 'المشترك'), sort: true }, { label: L('Consent', 'الموافقة'), cls: 'shrink' },
           { label: L('Transport', 'النقل'), cls: 'hide-sm' }, { label: L('Paid', 'المدفوع'), cls: 'num' },
           { label: L('Status', 'الحالة'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
    rows: REGISTRANTS.map(r => ({ cells: [
      who(person(r.p)),
      r.consent ? pill(L('Signed', 'موقَّعة'), 'success') : pill(L('Missing', 'ناقصة'), 'warning'),
      `<span class="dim">${r.transport === 'bus' ? L('Bus (+$5)', 'باص (+٥$)') : L('Own car', 'سيارة خاصة')}</span>`,
      `<span class="num">${usd(r.paid)}</span>`, status(r.status),
      `<button class="btn btn-secondary btn-dense" data-go="checkin">${L('Check-in', 'التسجيل')}</button>`]}))
  })}
  <p class="t-caption dim" style="margin-top:16px">${L(
    'Each registrant carries a reference and a QR that opens the correct check-in session, so the door team never searches a list.',
    'يحمل كل مسجَّل رقماً ورمزاً يفتح جلسة التسجيل الصحيحة، فلا يبحث فريق الباب في لائحة أبداً.')}</p></div>`;

  if (tab === 'payments') return head + `<div style="margin-top:20px" class="splitview">
    ${panel(L('Recorded payments', 'الدفعات المسجَّلة'), table({
      cols: [{ label: L('Participant', 'المشترك') }, { label: L('Method', 'الطريقة'), cls: 'hide-sm' },
             { label: L('Amount', 'المبلغ'), cls: 'num' }, { label: L('Status', 'الحالة'), cls: 'shrink' }],
      rows: REGISTRANTS.map(r => ({ cells: [who(person(r.p)), `<span class="chip">${L('Cash', 'نقداً')}</span>`,
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
    const pct = Math.round(r.taken / r.cap * 100);
    return { cells: [
      `<b>${esc(L(r.event, r.eventAr))}</b>`,
      `<span style="display:block;min-width:150px"><span class="t-caption dim tnum">${r.taken} / ${r.cap}</span>
        <span class="meter" style="margin-top:6px"><i style="width:${pct}%"></i></span></span>`,
      r.waiting ? pill(`${r.waiting} ${L('waiting', 'بالانتظار')}`, 'warning') : '<span class="dimmer">—</span>',
      r.fee ? `<span class="num">${usd(r.fee)}</span>` : `<span class="dim">${L('Free', 'مجاني')}</span>`,
      `<span class="dim">${fmtDate(r.deadline)}</span>`,
      r.open ? status('open') : status('draft'),
      `<span class="row" style="gap:6px;justify-content:flex-end"><button class="btn btn-secondary btn-dense" data-go="registrations/registrants">${L('Open', 'فتح')}</button>${CR.recBtn('registration', r.id)}</span>`
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
  const head = pageHead({
    crumbs: kiosk ? [{ label: L('Station', 'المحطة') }, { label: L('Check-in', 'التسجيل') }]
                  : [{ label: L('Parish life', 'حياة الرعية') }, { label: L('Check-in', 'التسجيل عند الباب') }],
    title: L(CHECKIN.session, CHECKIN.sessionAr),
    sub: `${esc(L(venue(CHECKIN.room).name, venue(CHECKIN.room).ar))} · <span class="tnum">${CHECKIN.present}</span>
          ${L('present of', 'حاضر من')} <span class="tnum">${CHECKIN.expected}</span> ·
          <span class="tnum">${CHECKIN.awaitingGuardian}</span> ${L('awaiting a guardian code', 'بانتظار رمز وليّ الأمر')}`,
    actions: `<button class="btn btn-secondary" data-act="scan">${icon('qr', 17)}${L('Scan QR', 'مسح الرمز')}</button>
      <button class="btn btn-secondary" id="tags">${icon('print', 17)}${L('Name tags', 'بطاقات الأسماء')}</button>
      ${kiosk ? '' : `<button class="btn btn-primary" data-act="checkin-manual">${icon('plus', 17)}${L('Manual check-in', 'تسجيل يدوي')}</button>`}`
  }) + (kiosk ? '' : tabBar('checkin', CTABS(), tab));

  if (kiosk) return head + `<div class="panel" style="margin-top:20px"><div class="panel-b" style="max-width:420px;margin-inline:auto">
    <label class="label" style="font-size:15px">${L('Guardian code', 'رمز وليّ الأمر')}</label>
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
      ${Object.entries(PICKUP).map(([pid, v]) => `<section class="panel"><div class="panel-h">
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
        </div></section>`).join('')}
    </div></div>`;

  if (tab === 'incidents') return head + `<div class="tabbody">
    ${C.inlineAlert('info', L('Restricted', 'مقيّد'), L('Incident reports are visible to the priest and the safeguarding lead only, and opening one is itself logged.',
      'تقارير الحوادث للكاهن ومسؤول الحماية فقط، وفتحها بحدّ ذاته يُسجَّل.'))}
    <div style="margin-top:16px">${table({
      cols: [{ label: L('When', 'الوقت') }, { label: L('Room', 'المكان'), cls: 'hide-sm' }, { label: L('What happened', 'ما حدث') },
             { label: L('Recorded by', 'سجّله'), cls: 'hide-md' }, { label: '', cls: 'shrink' }],
      rows: INCIDENTS.map(i => ({ cells: [
        `<span class="mono dim">${i.at}</span>`, `<span class="dim">${esc(L(venue(i.room).name, venue(i.room).ar))}</span>`,
        esc(L(i.what, i.whatAr)), who(person(i.by)),
        `<button class="btn btn-secondary btn-dense" data-act="incident-open:${i.id}">${L('Open', 'فتح')}</button>`]}))
    })}</div>
    <button class="btn btn-secondary" style="margin-top:16px" data-act="incident-new">${icon('plus', 17)}${L('Record an incident', 'تسجيل حادث')}</button></div>`;

  if (tab === 'evacuation') return head + `<div style="margin-top:20px" class="splitview">
    <div>${panel(L('Evacuation roster — who is in the building now', 'لائحة الإخلاء — من في المبنى الآن'), table({
      cols: [{ label: L('Room', 'المكان') }, { label: L('People', 'الأشخاص'), cls: 'num' }, { label: '', cls: 'shrink' }],
      rows: EVACUATION.rooms.map(([id, en, ar, n]) => ({ cells: [
        `<b>${esc(L(en, ar))}</b>`, `<span class="num">${n}</span>`,
        `<button class="btn btn-secondary btn-dense" data-act="print">${L('Print list', 'طباعة اللائحة')}</button>`]}))
    }), { tight: true })}
    <p class="t-caption dim" style="margin-top:12px">${L('Muster point:', 'نقطة التجمّع:')} <b>${esc(L(EVACUATION.muster, EVACUATION.musterAr))}</b></p></div>
    <div class="sidecol">${panel(L('Emergency broadcast', 'بثّ طارئ'), `
      <p class="t-body dim" style="font-size:14px">${L(
        'Reaches every guardian of a child currently checked in, on their preferred channel, ignoring quiet hours.',
        'يصل إلى كل وليّ أمر لطفل مسجَّل الآن، على قناته المفضّلة، متجاوزاً ساعات الهدوء.')}</p>
      <button class="btn btn-danger" style="width:100%;margin-top:14px" data-act="broadcast">${icon('bell', 17)}${L('Send emergency broadcast', 'إرسال بثّ طارئ')}</button>`)}</div></div>`;

  /* room roster */
  const rows = CHECKIN.rows.map(r => {
    const p = person(r.p);
    return `<div class="listrow">${who(p)}
      <span class="grow">${r.alert ? `<span class="pill pill-danger"><span class="dot"></span>${esc(L(r.alert, 'حساسية فول سوداني'))}</span>` : ''}</span>
      <span class="mono dim" dir="ltr">${L('in', 'دخول')} ${r.in}</span>
      <span class="t-caption dim">${L('Guardian', 'وليّ الأمر')}: ${esc(r.guardian)} · <b class="mono">${r.code}</b></span>
      <button class="btn btn-secondary btn-dense" data-act="checkout:${r.p}">${L('Check out', 'تسجيل خروج')}</button></div>`;
  }).join('');

  return head + `<div class="stats" style="margin:20px 0 24px">
      ${stat(L('Present now', 'الحاضرون الآن'), CHECKIN.present, L('room capacity 28', 'سعة الصف ٢٨'))}
      ${stat(L('Awaiting guardian', 'بانتظار وليّ الأمر'), CHECKIN.awaitingGuardian, L('still in the room', 'ما زالوا في الصف'))}
      ${stat(L('Medical alerts', 'تنبيهات طبية'), 1, L('visible to this room’s staff only', 'تظهر لموظّفي هذا الصف فقط'))}
      ${stat(L('Late pickups', 'تأخّر في الاستلام'), 0, L('none today', 'لا شيء اليوم'))}
    </div>
    ${panel(L('Children in the room', 'الأطفال في الصف'), rows, { tight: true })}
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
    code.value === CHECKIN.rows[0].code
      ? toast(L('Code matches — Nada Haddad', 'الرمز مطابق — ندى حدّاد'),
              L('Confirm the face before releasing Yara and Karim.', 'تأكّد من الوجه قبل تسليم يارا وكريم.'), 'success')
      : toast(L('No match', 'لا تطابق'), L('Call a member of staff. Do not release.', 'نادِ أحد الموظّفين. لا تُسلّم.'), 'danger');
    code.value = '';
  });
};
