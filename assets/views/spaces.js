/* Module 5 — facilities, equipment, reservations, maintenance, issues, rentals. */
import { t, isAr, num, usd, fmtDate } from '../i18n.js';
import { is, bus, S } from '../store.js';
import { icon, pageHead, sectionH, panel, who, status, pill, esc, table, wireTables, empty, stat,
         searchField, openDrawer, openModal, closeOverlays, toast, avatar, tabBar } from '../ui.js';
import * as C from '../components.js';
import * as CR from '../crud.js';
import * as F from '../flows.js';
import { VENUES, EQUIPMENT, RESERVATIONS, MAINTENANCE, ISSUES, RENTALS, person, venue, group, resClash, resStatus } from '../data.js';

const L = (en, ar) => t(en, ar);
const STAGES = [['Requested', 'الطلب'], ['Secretary review', 'مراجعة أمانة السرّ'], ['Priest approval', 'موافقة الكاهن'], ['Approved', 'موافَق عليه']];
const FTABS = () => [['', 'Rooms', 'القاعات'], ['equipment', 'Equipment', 'التجهيزات'], ['maintenance', 'Maintenance', 'الصيانة'],
               ['issues', 'Issues', 'الأعطال', ISSUES.length], ['rentals', 'External renters', 'الإيجار الخارجي', RENTALS.length]];

export function facilities(tab = '') {
  const head = pageHead({
    crumbs: [{ label: L('Spaces', 'المرافق') }, { label: L('Facilities', 'المرافق') }],
    title: L('Facilities and resources', 'المرافق والموارد'),
    sub: L('Churches, halls, rooms, the kitchen, the courtyard and the field — with capacity, accessibility and usage policy.',
           'كنائس وقاعات وغرف ومطبخ وساحة وملعب — مع السعة وإمكانية الوصول وقواعد الاستعمال.'),
    actions: `<button class="btn btn-secondary" id="block">${icon('warn', 17)}${L('Block for maintenance', 'إغلاق للصيانة')}</button>
      <button class="btn btn-primary" id="newvenue">${icon('plus', 17)}${L('Add facility', 'إضافة مرفق')}</button>`
  }) + tabBar('facilities', FTABS(), tab);

  if (tab === 'equipment') return head + `<div class="tabbody">${table({
      cols: [{ label: L('Item', 'الصنف'), sort: true }, { label: L('Total', 'الإجمالي'), cls: 'num hide-sm' },
             { label: L('On loan', 'معار'), cls: 'num hide-sm' }, { label: L('Available', 'متاح'), cls: 'num' },
             { label: L('Custody', 'العهدة'), cls: 'hide-md' }, { label: L('Condition', 'الحالة'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
      rows: EQUIPMENT.map(e => ({ cells: [
        `<b>${esc(L(e.name, e.ar))}</b>`, `<span class="num">${e.qty}</span>`, `<span class="num">${e.out}</span>`,
        `<span class="num">${e.qty - e.out}</span>`,
        `<span class="dim">${e.out ? L('Choir · until 9 Oct', 'الجوقة · حتى ٩ ت١') : L('In store', 'في المستودع')}</span>`,
        e.cond === 'needs service' ? pill(L('Needs service', 'تحتاج صيانة'), 'warning')
          : e.cond === 'fair' ? pill(L('Fair', 'مقبولة'), 'warning') : pill(L('Good', 'جيدة'), 'success'),
        `<span class="row" style="gap:6px;justify-content:flex-end"><button class="btn btn-secondary btn-dense" id="loan-${e.id}" ${e.qty - e.out > 0 ? '' : 'disabled'}>${L('Loan out', 'إعارة')}</button>${CR.recBtn('equipment', e.id)}</span>`]})),
      empty: empty('rooms', L('No equipment recorded', 'لا تجهيزات مسجّلة'), L('Add what the parish lends out — microphones, projectors, chairs.', 'أضف ما تعيره الرعية — مايكروفونات، أجهزة عرض، كراسي.'))
    })}
    <button class="btn btn-secondary" style="margin-top:16px" data-act="rec-new:equipment">${icon('plus', 17)}${L('Add equipment', 'إضافة تجهيز')}</button></div>`;

  if (tab === 'maintenance') return head + `<div class="tabbody">
    ${table({
      cols: [{ label: L('Room', 'القاعة') }, { label: L('From', 'من') }, { label: L('To', 'إلى') },
             { label: L('Reason', 'السبب'), cls: 'hide-sm' }, { label: '', cls: 'shrink' }],
      rows: MAINTENANCE.map((m, mi) => ({ cells: [
        `<b>${esc(L(venue(m.venue).name, venue(m.venue).ar))}</b>`,
        `<span class="mono dim">${fmtDate(m.from)}</span>`, `<span class="mono dim">${fmtDate(m.to)}</span>`,
        `<span class="dim">${esc(L(m.why, m.whyAr))}</span>`,
        `<button class="btn btn-secondary btn-dense" data-act="block-cancel:${mi}">${L('Cancel block', 'إلغاء الإغلاق')}</button>`]})),
      empty: empty('rooms', L('No rooms are blocked', 'لا قاعات مُغلقة'), L('Block a room for works or cleaning from its facility page.', 'أغلق قاعة للأشغال أو التنظيف من صفحة المرفق.'))
    })}
    ${C.inlineAlert('info', L('A block stops bookings; it does not close the room', 'الإغلاق يمنع الحجز ولا يقفل القاعة'),
      L('Facility status and time-based availability are separate. A fully booked hall is still open; a blocked one refuses new requests and warns about approved ones inside the window.',
        'حالة المرفق والتوفّر الزمني منفصلان. القاعة المحجوزة بالكامل تبقى مفتوحة؛ والمُغلقة ترفض الطلبات الجديدة وتنبّه على الموافَق عليها داخل المدة.'))}</div>`;

  if (tab === 'issues') return head + `<div class="tabbody">${table({
      cols: [{ label: L('Room', 'القاعة') }, { label: L('Reported', 'العطل') }, { label: L('By', 'بواسطة'), cls: 'hide-sm' },
             { label: L('When', 'متى'), cls: 'hide-md' }, { label: L('Status', 'الحالة'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
      rows: ISSUES.map(i => ({ cells: [
        `<b>${esc(venue(i.venue) ? L(venue(i.venue).name, venue(i.venue).ar) : '—')}</b>`, esc(L(i.what, i.whatAr)), who(person(i.by)),
        `<span class="mono dim">${fmtDate(i.at)}</span>`, status(i.status),
        `<span class="row" style="gap:6px;justify-content:flex-end">${i.status === 'awaiting-approval' ? `<button class="btn btn-secondary btn-dense" data-act="issue-assign:${i.id}">${L('Assign', 'إسناد')}</button>` : ''}${CR.recBtn('issue', i.id)}</span>`]})),
      empty: empty('check', L('Nothing reported', 'لا أعطال مبلَّغ عنها'), L('Anything broken in a room can be reported here, with a photo.', 'أيّ عطل في قاعة يُبلَّغ عنه هنا، مع صورة.'))
    })}
    <button class="btn btn-secondary" style="margin-top:16px" id="newissue">${icon('plus', 17)}${L('Report an issue', 'الإبلاغ عن عطل')}</button></div>`;

  if (tab === 'rentals') return head + `<div class="tabbody">${table({
      cols: [{ label: L('Renter', 'المستأجر') }, { label: L('Room', 'القاعة'), cls: 'hide-sm' }, { label: L('Date', 'التاريخ') },
             { label: L('Deposit', 'العربون'), cls: 'num' }, { label: L('Charge', 'البدل'), cls: 'num' },
             { label: L('Status', 'الحالة'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
      rows: RENTALS.map(r => ({ cells: [
        `<b>${esc(L(r.who, r.whoAr))}</b>`, `<span class="dim">${esc(L(venue(r.venue).name, venue(r.venue).ar))}</span>`,
        `<span class="mono dim">${fmtDate(r.date)}</span>`, `<span class="num">${usd(r.deposit)}</span>`,
        `<span class="num">${usd(r.charge)}</span>`, status(r.status),
        `<a class="btn btn-secondary btn-dense" href="#/finance">${L('In Finance', 'في المالية')}</a>`]}))
    })}
    <p class="t-caption dim" style="margin-top:16px">${L(
      'Agreements, deposits, charges, payments and refunds for an external renter all run through the finance module, so the hall never keeps its own cash book.',
      'الاتفاقات والعرابين والبدلات والدفعات والاسترجاعات للمستأجر الخارجي تمرّ كلها عبر وحدة المالية، فلا تحتفظ القاعة بدفتر نقد خاص بها.')}</p></div>`;

  const cards = VENUES.map(v => `<section class="panel"><div class="panel-b">
    <div style="height:96px;margin:-24px -24px 16px;background:linear-gradient(135deg,var(--primary-subtle),var(--muted));
      display:grid;place-items:center;color:var(--primary)">${icon('rooms', 30)}</div>
    <div class="row" style="gap:10px;align-items:flex-start">
      <div style="flex:1;min-width:0"><b style="display:block;font:600 16px/22px var(--sans)">${esc(L(v.name, v.ar))}</b>
        <small class="t-caption dim">${esc(L(v.kind, v.kindAr))} · ${L('seats', 'يتّسع لـ')} <span class="tnum">${v.cap}</span></small></div>${CR.recBtn('venue', v.id)}</div>
    <div class="row" style="gap:6px;margin-top:12px;flex-wrap:wrap">
      ${v.access ? pill(L('Step-free access', 'مدخل بلا درج'), 'success') : pill(L('Stairs only', 'درج فقط'), 'warning')}
      ${MAINTENANCE.filter(m => m.venue === v.id).map(m => pill(L(`Blocked ${fmtDate(m.from)} – ${fmtDate(m.to)}`, `مغلقة ${fmtDate(m.from)} – ${fmtDate(m.to)}`), 'danger')).join('')}</div>
    <div class="divider"></div>
    <div class="row" style="gap:6px">
      <button class="btn btn-secondary" style="flex:1;min-height:34px;font-size:13px" data-avail="${v.id}">${L('Availability', 'التوفّر')}</button>
      <button class="btn btn-secondary" style="flex:1;min-height:34px;font-size:13px" data-act="book-room:${v.id}">${L('Book', 'حجز')}</button>
    </div></div></section>`).join('');

  return head + `<div style="margin-top:20px" class="gridcards">${cards || empty('rooms', L('No rooms yet', 'لا قاعات بعد'), L('Add the church, the hall and every room people can book.', 'أضف الكنيسة والقاعة وكل مكان يمكن حجزه.'))}</div>
    <p class="t-caption dim" style="margin-top:16px">${L(
      'Every room carries its capacity, accessibility, photos and usage policy, so a request does not need a phone call to answer.',
      'تحمل كل قاعة سعتها وإمكانية الوصول والصور وقواعد الاستعمال، فلا يحتاج الطلب إلى مكالمة هاتفية.')}</p>`;
}

facilities.mount = host => {
  C.wire(host); wireTables(host);
  host.querySelector('#block')?.addEventListener('click', () => openDrawer({
    title: L('Block a room for maintenance', 'إغلاق قاعة للصيانة'),
    sub: L('New requests are refused for the period, and anything already approved inside it is listed for you.',
           'تُرفض الطلبات الجديدة خلال المدة، وتُعرَض عليك الحجوزات الموافَق عليها داخلها.'),
    body: `<div class="formrow"><label class="label">${L('Room', 'القاعة')}</label>
        <select class="select" id="bk_v">${VENUES.map(v => `<option value="${v.id}">${esc(L(v.name, v.ar))}</option>`).join('')}</select></div>
      <div class="formgrid">${C.field({ label: L('From', 'من'), type: 'date', value: '2026-10-20', id: 'bk_f' })}
        ${C.field({ label: L('To', 'إلى'), type: 'date', value: '2026-10-24', id: 'bk_t' })}</div>
      ${C.field({ label: L('Reason', 'السبب'), id: 'bk_w', ph: L('Damp treatment on the north wall', 'معالجة الرطوبة في الجدار الشمالي') })}
      ${C.personPicker(L('Responsible staff', 'المسؤول'), 'mstaff')}
      ${C.inlineAlert('warning', L('One approved booking falls inside this window', 'حجز موافَق عليه واحد داخل هذه المدة'),
        L('Legion of Mary, 20 October 16:30. They will need to be told and moved.', 'فيلق مريم، ٢٠ تشرين الأول ١٦:٣٠. يجب إبلاغهم ونقلهم.'))}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="doblock" style="margin-inline-start:auto">${L('Block the room', 'إغلاق القاعة')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#doblock').addEventListener('click', () => {
        const v = el.querySelector('#bk_v').value, why = el.querySelector('#bk_w').value.trim() || L('Maintenance', 'صيانة');
        MAINTENANCE.unshift({ venue: v, from: el.querySelector('#bk_f').value, to: el.querySelector('#bk_t').value, why, whyAr: why, by: 'p15' });
        closeOverlays(); bus.refresh();
        toast(L('Room blocked', 'أُغلقت القاعة'), `${L(venue(v).name, venue(v).ar)} · ${why}`, 'success',
          { action: { label: L('Undo', 'تراجع'), fn: () => { MAINTENANCE.shift(); bus.refresh(); } } });
      });
    }
  }));
  host.querySelectorAll('[data-avail]').forEach(b => b.addEventListener('click', () => openDrawer({
    large: true,
    title: L('Availability', 'التوفّر'),
    sub: L('Setup and cleanup buffers are part of the booking, so nothing can be scheduled inside them.',
           'وقتا التحضير والتنظيف جزء من الحجز، فلا يُجدوَل شيء داخلهما.'),
    body: `<div class="a4frame" style="padding:14px">
      ${['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'].map((h, i) => `
        <div style="display:grid;grid-template-columns:56px 1fr;gap:10px;align-items:center;margin-bottom:6px">
          <span class="mono t-caption dim">${h}</span>
          <span style="height:30px;border-radius:6px;background:${i === 2 || i === 3 ? 'var(--primary-subtle)' : i === 5 ? 'repeating-linear-gradient(135deg,var(--warning-subtle),var(--warning-subtle) 5px,#E9DFC4 5px,#E9DFC4 10px)' : 'var(--surface)'};
            border:1px solid var(--border);display:flex;align-items:center;padding:0 10px;font:500 12px/1 var(--sans);
            color:${i === 2 || i === 3 ? 'var(--primary)' : i === 5 ? 'var(--warning-ink)' : 'var(--text-3)'}">
            ${i === 2 ? L('Parish lunch — approved', 'غداء الرعية — موافَق') : i === 3 ? L('…including cleanup buffer', '…مع وقت التنظيف') :
              i === 5 ? L('Choir rehearsal — pending, holds the slot', 'تمرين الجوقة — معلّق، يحجز الوقت') : L('Free', 'متاح')}</span>
        </div>`).join('')}</div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>`
  })));
  host.querySelector('#newvenue')?.addEventListener('click', () => CR.create('venue'));
  host.querySelector('#newissue')?.addEventListener('click', () => CR.create('issue'));
  host.querySelectorAll('[id^="loan-"]').forEach(b => b.addEventListener('click', () => { const eq = EQUIPMENT.find(x => 'loan-' + x.id === b.id); openModal({
    title: L('Loan out equipment', 'إعارة تجهيزات'), sub: esc(L(eq.name, eq.ar)) + ` · ${eq.qty - eq.out} ${L('available', 'متاح')}`,
    body: `${C.personPicker(L('Taken by', 'المستلم'), 'loanp')}
      ${C.stepper({ label: L('Quantity', 'العدد'), value: 2, id: 'loanq' })}
      ${C.field({ label: L('Back by', 'الإعادة قبل'), type: 'date', value: '2026-10-12' })}
      ${C.checkRow(L('Condition checked on the way out', 'فُحصت الحالة عند الخروج'), { checked: true })}`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="doloan">${L('Record loan', 'تسجيل الإعارة')}</button>`,
    onMount(el) {
      C.wire(el);
      el.querySelector('#doloan').addEventListener('click', () => {
        const q = Math.min(eq.qty - eq.out, parseInt(el.querySelector('#loanq').value, 10) || 1);
        if (q <= 0) return toast(L('None left to lend', 'لا شيء متبقٍّ للإعارة'), '', 'warning');
        eq.out += q; closeOverlays(); bus.refresh();
        toast(L('Loan recorded', 'سُجّلت الإعارة'), `${q} × ${L(eq.name, eq.ar)}`, 'success',
          { action: { label: L('Undo', 'تراجع'), fn: () => { eq.out -= q; bus.refresh(); } } });
      });
    }
  }); }));
};

/* ---------------- reservations ---------------- */
export function reservations() {
  const pending = RESERVATIONS.filter(r => r.status === 'pending');
  const clashing = pending.filter(resClash);
  const f = S.ui.resFilter || 'all';
  const shown = RESERVATIONS.filter(r => f === 'all' || (f === 'mine' ? r.status === 'pending' && (is('priest') ? r.stage === 'priest' : r.stage === 'secretary') : r.status === f));
  const rows = shown.map(r => {
    const v = venue(r.venue), by = person(r.by), g = r.group ? group(r.group) : null;
    return { cls: 'clickable', attrs: `data-res="${r.id}" tabindex="0" data-find-item`, cells: [
      `<span class="mono" dir="ltr">${r.ref}</span>`,
      `<b style="font:500 14px/20px var(--sans)">${esc(L(r.title, r.titleAr))}</b>
       ${g ? `<small class="t-caption dim" style="display:block">${esc(L(g.name, g.ar))}</small>` : ''}`,
      `<span class="dim">${esc(v ? L(v.name, v.ar) : '—')}</span>`,
      `<span class="dim">${fmtDate(r.date)} <span class="mono" dir="ltr">${r.from}–${r.to}</span></span>`,
      who(by), status(resStatus(r)), CR.recBtn('reservation', r.id)]};
  });

  return `${pageHead({
      crumbs: [{ label: L('Spaces', 'المرافق') }, { label: L('Reservations', 'الحجوزات') }],
      title: L('Reservations', 'الحجوزات'),
      sub: L('Requests move through a configurable approval chain. A pending request holds the slot until the hold expires or the priest decides.',
             'تمرّ الطلبات في سلسلة موافقات قابلة للضبط. والطلب المعلّق يحجز الوقت حتى تنتهي المهلة أو يقرّر الكاهن.'),
      actions: `<button class="btn btn-secondary" data-go="facilities">${icon('events', 17)}${L('Availability', 'التوفّر')}</button>
        <button class="btn btn-primary" data-act="rec-new:reservation">${icon('plus', 17)}${L('Request a room', 'طلب قاعة')}</button>`
    })}
    <div class="stats" style="margin-bottom:24px">
      ${stat(L('Awaiting a decision', 'بانتظار قرار'), pending.length, clashing.length ? `<span class="down">${L(`${clashing.length} with a clash`, `${clashing.length} فيها تعارض`)}</span>` : L('no clashes', 'بلا تعارض'))}
      ${stat(L('Approved this month', 'مُوافق عليه هذا الشهر'), RESERVATIONS.filter(r => r.status === 'approved').length,
        L(`${new Set(RESERVATIONS.filter(r => r.status === 'approved').map(r => r.venue)).size} rooms in use`, `${new Set(RESERVATIONS.filter(r => r.status === 'approved').map(r => r.venue)).size} قاعات مستعملة`))}
      ${stat(L('Hall utilisation', 'استخدام القاعة'), '68%', `<span class="up">${L('+9 on September', '+٩ عن أيلول')}</span>`)}
      ${stat(L('Average decision time', 'متوسط زمن القرار'), L('1 day', 'يوم واحد'), L('target: 2 days', 'الهدف: يومان'))}
    </div>
    ${clashing.slice(0, 1).map(r => { const o = resClash(r), v = venue(r.venue);
      return C.inlineAlert('warning', L(`${r.ref} clashes with ${o.ref}`, `تعارض بين ${r.ref} و${o.ref}`),
        L(`Both want ${v ? `the ${v.name}` : 'the same room'} on ${fmtDate(r.date)}, counting their set-up time. Approving one refuses the other — each request sees the clash, not the other one’s private details.`,
          `كلاهما يطلب ${v ? v.ar : 'القاعة نفسها'} في ${fmtDate(r.date)}، مع وقت التحضير. الموافقة على أحدهما ترفض الآخر — ويرى كل طلب التعارض لا تفاصيل الآخر الخاصة.`)); }).join('')}
    <div class="toolbar" style="margin:20px 0 16px">
      <span class="seg" role="group" aria-label="${L('Show', 'عرض')}">${[['all', 'All', 'الكل'], ['mine', 'Awaiting me', 'بانتظاري'], ['approved', 'Approved', 'موافَق'], ['rejected', 'Rejected', 'مرفوض']]
        .map(([k, en, ar]) => `<button aria-pressed="${f === k}" data-act="res-filter:${k}">${esc(L(en, ar))}</button>`).join('')}</span>
      <div class="grow" style="max-width:260px;margin-inline-start:auto">${searchField(L('Reference or title', 'الرقم أو العنوان'), 'data-find')}</div>
    </div>
    ${table({
      cols: [{ label: L('Reference', 'الرقم'), cls: 'shrink' }, { label: L('Request', 'الطلب'), sort: true },
             { label: L('Room', 'القاعة'), cls: 'hide-sm' }, { label: L('When', 'الموعد'), cls: 'shrink hide-sm', sort: true },
             { label: L('Requested by', 'مقدَّم من'), cls: 'hide-md' }, { label: L('Status', 'الحالة'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
      rows,
      empty: empty('attend', L('Nothing here', 'لا شيء هنا'), f === 'all' ? L('No room requests yet.', 'لا طلبات قاعات بعد.') : L('No request matches this filter.', 'لا طلب يطابق هذا المرشّح.'))
    })}
    <div class="find-empty" hidden>${empty('search', L('No request matches', 'لا طلب مطابق'), L('Try the reference number or part of the title.', 'جرّب رقم الطلب أو جزءاً من العنوان.'))}</div>`;
}

reservations.mount = host => {
  C.wire(host); wireTables(host);
  host.querySelectorAll('[data-res]').forEach(tr => {
    const open = () => resDrawer(tr.dataset.res);
    tr.addEventListener('click', e => { if (!e.target.closest('button, a, input, label')) open(); });
    tr.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === tr) open(); });
  });
};

function stageBar(current) {
  const idx = { secretary: 1, priest: 2, done: 3 }[current] ?? 0;
  return `<div style="display:flex;margin:4px 0 20px">${STAGES.map(([en, ar], i) => `
    <div style="flex:1;min-width:0">
      <div style="height:4px;border-radius:99px;background:${i <= idx ? 'var(--primary)' : 'var(--border)'};margin-inline-end:${i === 3 ? 0 : '4px'}"></div>
      <div class="t-caption" style="margin-top:8px;color:${i <= idx ? 'var(--text)' : 'var(--text-3)'};font-weight:${i === idx ? 500 : 400}">${esc(L(en, ar))}</div>
    </div>`).join('')}</div>`;
}

function resDrawer(id) {
  const r = RESERVATIONS.find(x => x.id === id); if (!r) return;
  const v = venue(r.venue) || { name: '—', ar: '—', cap: 0 }, by = person(r.by) || { lat: '—', ar: '—' }, g = r.group ? group(r.group) : null;
  const clash = resClash(r);
  const canDecide = is('priest') || (is('secretary') && r.stage === 'secretary');
  openDrawer({
    large: true,
    title: L(r.title, r.titleAr),
    sub: `<span class="mono">${r.ref}</span> · ${esc(L(v.name, v.ar))} · ${fmtDate(r.date)}`,
    body: `${stageBar(r.stage)}
      ${clash && r.status === 'pending' ? C.inlineAlert('warning', L('Clashes with an existing booking', 'يتعارض مع حجز قائم'),
        L(`The ${v.name} is already held on ${fmtDate(clash.date)} from ${clash.from}, including a ${clash.setup || 0}-minute set-up buffer. Approving this request refuses the other one.`,
          `${v.ar} محجوزة في ${fmtDate(clash.date)} من ${clash.from}، مع ${clash.setup || 0} دقيقة تحضير. الموافقة على هذا الطلب ترفض الآخر.`)) : ''}
      <dl class="dl">
        <dt>${L('Room', 'القاعة')}</dt><dd>${esc(L(v.name, v.ar))} · ${L('seats', 'يتّسع لـ')} ${v.cap}</dd>
        <dt>${L('When', 'الموعد')}</dt><dd class="mono" dir="ltr">${fmtDate(r.date)} · ${r.from}–${r.to}</dd>
        <dt>${L('Setup buffer', 'وقت التحضير')}</dt><dd>${r.setup} ${L('minutes before and after', 'دقيقة قبل وبعد')}</dd>
        <dt>${L('Requested by', 'مقدَّم من')}</dt><dd>${esc(isAr() ? by.ar : by.lat)}</dd>
        ${g ? `<dt>${L('Group', 'المجموعة')}</dt><dd>${esc(L(g.name, g.ar))}</dd>` : ''}
        <dt>${L('Hold expires', 'ينتهي الحجز المؤقت')}</dt><dd class="mono">${fmtDate('2026-10-07')}</dd>
        <dt>${L('Status', 'الحالة')}</dt><dd>${status(resStatus(r))}</dd></dl>
      <div class="divider"></div>
      <h4 class="t-ui" style="margin-bottom:12px">${L('Opening and closing checklist', 'لائحة الفتح والإقفال')}</h4>
      <div class="stack" style="gap:8px">
        ${[L('Keys handed to the named responsible person', 'تسليم المفاتيح إلى المسؤول المسمّى'),
           L('Chairs and tables returned to the store', 'إعادة الكراسي والطاولات إلى المستودع'),
           L('Lights and generator switched off', 'إطفاء الإنارة والمولّد'),
           L('Kitchen left clean', 'ترك المطبخ نظيفاً')].map(x => C.checkRow(x)).join('')}</div>
      <div class="divider"></div>
      <h4 class="t-ui" style="margin-bottom:10px">${L('Decision history', 'سجل القرارات')}</h4>
      <div class="timeline"><div class="tl-item accent"><div class="when">${L('Submitted', 'قُدّم')}</div>
          <div class="what">${L(`By ${by.lat}`, `من ${by.ar}`)}</div></div>
        ${r.stage !== 'secretary' ? `<div class="tl-item"><div class="when">${L('Reviewed', 'رُوجع')}</div>
          <div class="what">${L('By Rita Nassar and forwarded to the priest', 'من ريتا نصّار وأُحيل إلى الكاهن')}</div></div>` : ''}
        ${r.status === 'approved' || r.status === 'rejected' ? `<div class="tl-item"><div class="when">${L('Decided', 'قُرّر')}</div>
          <div class="what">${status(r.status)}</div></div>` : ''}</div>`,
    foot: canDecide
      ? `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
         <button class="btn btn-danger-quiet" data-act="res-reject:${r.id}">${L('Reject', 'رفض')}</button>
         <button class="btn btn-primary" data-act="res-approve:${r.id}" style="margin-inline-start:auto">
           ${is('secretary') ? L('Forward to the priest', 'إحالة إلى الكاهن') : L('Approve', 'موافقة')}</button>`
      : `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
         <span class="t-caption dim" style="margin-inline-start:auto">${L('Your role can view this request but not decide it.', 'دورك يتيح الاطّلاع لا القرار.')}</span>`,
    onMount(el) {
      C.wire(el);
      /* real: the decision moves the request through the chain */
    }
  });
}

