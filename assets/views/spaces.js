/* Module 5 — facilities, equipment, reservations, maintenance, issues, rentals. */
import { t, isAr, num, usd, fmtDate, fmtLong, month, dayShort } from '../i18n.js';
import { is, bus, S, me } from '../store.js';
import { icon, pageHead, sectionH, panel, who, status, pill, esc, table, wireTables, empty, stat,
         searchField, openDrawer, openModal, closeOverlays, toast, avatar, tabBar } from '../ui.js';
import * as C from '../components.js';
import * as CR from '../crud.js';
import * as F from '../flows.js';
import { VENUES, EQUIPMENT, RESERVATIONS, MAINTENANCE, ISSUES, RENTALS, EVENTS, PEOPLE, TODAY, person, venue, group, resClash, resStatus } from '../data.js';

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
    actions: `<button class="btn btn-primary" id="newvenue">${icon('plus', 17)}${L('Add facility', 'إضافة مرفق')}</button>`
  }) + tabBar('facilities', FTABS(), tab);

  if (tab === 'equipment') {
    /* narrow the list by name, and by whether it can go out today, is out, or needs attention */
    const f = S.ui.eqFilter || 'all', attention = e => e.cond === 'needs service' || e.cond === 'fair';
    const FILTERS = [['all', L('All', 'الكل'), () => true], ['available', L('Available now', 'متاح الآن'), e => e.qty - e.out > 0],
                     ['loan', L('On loan', 'معار'), e => e.out > 0], ['service', L('Needs attention', 'يحتاج عناية'), attention]];
    const keep = (FILTERS.find(([k]) => k === f) || FILTERS[0])[2];
    return head + `<div class="tabbody">
      <div class="toolbar eqbar" style="margin-bottom:14px">
        <div class="grow">${C.searchClear(L('Search equipment', 'ابحث في التجهيزات'), 'eqsearch', 'data-find')}</div>
        <span class="seg" role="group" aria-label="${L('Show', 'عرض')}">${FILTERS.map(([k, lab, test]) =>
          `<button type="button" aria-pressed="${f === k}" data-act="eq-filter:${k}">${esc(lab)}<span class="segn">${EQUIPMENT.filter(test).length}</span></button>`).join('')}</span>
      </div>
      ${table({
        cols: [{ label: L('Item', 'الصنف'), sort: true }, { label: L('Total', 'الإجمالي'), cls: 'num hide-sm' },
               { label: L('On loan', 'معار'), cls: 'num hide-sm' }, { label: L('Available', 'متاح'), cls: 'num' },
               { label: L('Custody', 'العهدة'), cls: 'hide-md' }, { label: L('Condition', 'الحالة'), cls: 'shrink' }, { label: '', cls: 'shrink' }],
        rows: EQUIPMENT.filter(keep).map(e => ({ attrs: 'data-find-item', cells: [
          `<b>${esc(L(e.name, e.ar))}</b>`, `<span class="num">${e.qty}</span>`, `<span class="num">${e.out}</span>`,
          `<span class="num">${e.qty - e.out}</span>`,
          `<span class="dim">${e.out ? L('Choir · until 9 Oct', 'الجوقة · حتى ٩ ت١') : L('In store', 'في المستودع')}</span>`,
          e.cond === 'needs service' ? pill(L('Needs service', 'تحتاج صيانة'), 'warning')
            : e.cond === 'fair' ? pill(L('Fair', 'مقبولة'), 'warning') : pill(L('Good', 'جيدة'), 'success'),
          `<span class="row" style="gap:6px;justify-content:flex-end"><button class="btn btn-secondary btn-dense" id="loan-${e.id}" ${e.qty - e.out > 0 ? '' : 'disabled'}>${L('Loan out', 'إعارة')}</button>${CR.recBtn('equipment', e.id)}</span>`]})),
        empty: EQUIPMENT.length
          ? empty('filter', L('Nothing in this view', 'لا شيء في هذا العرض'), L('Choose another filter to see the rest of the equipment.', 'اختر مرشّحاً آخر لرؤية بقية التجهيزات.'),
              `<button class="btn btn-secondary btn-dense" data-act="eq-filter:all">${L('Show all equipment', 'عرض كل التجهيزات')}</button>`)
          : empty('rooms', L('No equipment recorded', 'لا تجهيزات مسجّلة'), L('Add what the parish lends out — microphones, projectors, chairs.', 'أضف ما تعيره الرعية — مايكروفونات، أجهزة عرض، كراسي.'))
      })}
      <div class="find-empty" hidden>${empty('search', L('No equipment matches', 'لا تجهيزات مطابقة'), L('Try another name, in English or Arabic.', 'جرّب اسماً آخر، بالعربية أو بالإنكليزية.'))}</div>
      <button class="btn btn-secondary" style="margin-top:16px" data-act="rec-new:equipment">${icon('plus', 17)}${L('Add equipment', 'إضافة تجهيز')}</button></div>`;
  }

  if (tab === 'maintenance') return head + `<div class="tabbody">
    ${table({
      cols: [{ label: L('Room', 'القاعة') }, { label: L('From', 'من') }, { label: L('To', 'إلى') },
             { label: L('Reason', 'السبب'), cls: 'hide-sm' }, { label: '', cls: 'shrink' }],
      rows: MAINTENANCE.map((m, mi) => ({ cells: [
        `<b>${esc(L(venue(m.venue).name, venue(m.venue).ar))}</b>`,
        `<span class="mono dim">${fmtDate(m.from)}</span>`, `<span class="mono dim">${fmtDate(m.to)}</span>`,
        `<span class="dim">${esc(L(m.why, m.whyAr))}</span>`,
        `<button class="btn btn-secondary btn-dense" data-act="block-cancel:${mi}">${L('Cancel block', 'إلغاء الإغلاق')}</button>`]})),
      empty: empty('rooms', L('No rooms are blocked', 'لا قاعات مُغلقة'), L('Block a room for works or cleaning with the button on its card in Rooms.', 'أغلق قاعة للأشغال أو التنظيف من الزرّ على بطاقتها في القاعات.'))
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
      <button class="btn btn-secondary" style="flex:1;min-height:34px;font-size:13px" data-avail="${v.id}">${icon('events', 15)}${L('Availability', 'التوفّر')}</button>
      <button class="btn btn-secondary" style="flex:1;min-height:34px;font-size:13px" data-act="book-room:${v.id}">${icon('plus', 15)}${L('Book', 'حجز')}</button>
    </div>
    <button class="btn btn-ghost roomblock" data-block="${v.id}">${icon('warn', 15)}${L('Block for maintenance', 'إغلاق للصيانة')}</button>
    </div></section>`).join('');

  return head + `<div style="margin-top:20px" class="gridcards">${cards || empty('rooms', L('No rooms yet', 'لا قاعات بعد'), L('Add the church, the hall and every room people can book.', 'أضف الكنيسة والقاعة وكل مكان يمكن حجزه.'))}</div>
    <p class="t-caption dim" style="margin-top:16px">${L(
      'Every room carries its capacity, accessibility, photos and usage policy, so a request does not need a phone call to answer.',
      'تحمل كل قاعة سعتها وإمكانية الوصول والصور وقواعد الاستعمال، فلا يحتاج الطلب إلى مكالمة هاتفية.')}</p>`;
}

/* ---------- availability: pick any day, see what holds the room and what is still free ---------- */
const mins = hm => { const [h, m] = String(hm || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const hhmm = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const isoD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const OPEN = [7 * 60, 23 * 60];                        /* the parish day the timeline shows */
const blockOn = (vid, date) => MAINTENANCE.find(m => m.venue === vid && m.from <= date && date <= m.to);
const length = n => n >= 60 ? L(`${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60} min` : ''}`, `${Math.floor(n / 60)} س${n % 60 ? ` ${n % 60} د` : ''}`) : L(`${n} min`, `${n} د`);

/* what holds the room that day: room requests (with their set-up time) and calendar events; a
   request and the event it was made for are the same thing and are listed once */
function heldOn(vid, date) {
  const res = RESERVATIONS.filter(r => r.venue === vid && r.date === date && r.status !== 'rejected');
  const items = res.map(r => ({ from: mins(r.from), to: mins(r.to), buffer: +r.setup || 0, title: L(r.title, r.titleAr || r.title), state: resStatus(r), ref: r.ref }));
  for (const e of EVENTS.filter(x => x.venue === vid && x.d === date && x.kind !== 'pending')) {
    if (res.some(r => mins(r.from) === mins(e.t))) continue;
    const len = e.to ? mins(e.to) - mins(e.t) : e.kind === 'mass' ? 60 : e.kind === 'sacr' ? 90 : 120;
    items.push({ from: mins(e.t), to: mins(e.t) + len, buffer: 0, title: L(e.title, e.titleAr || e.title), state: e.kind === 'mass' ? 'mass' : 'event' });
  }
  return items.sort((x, y) => x.from - y.from);
}
function freeGaps(items) {
  const gaps = []; let at = OPEN[0];
  for (const it of [...items].sort((x, y) => (x.from - x.buffer) - (y.from - y.buffer))) {   /* set-up time starts the hold */ const start = Math.max(OPEN[0], it.from - it.buffer); if (start - at >= 30) gaps.push([at, start]); at = Math.max(at, it.to); }
  if (OPEN[1] - at >= 30) gaps.push([at, OPEN[1]]);
  return gaps;
}
const STATE = () => ({ approved: [L('Approved', 'موافَق عليه'), 'success'], pending: [L('Pending — holds the slot', 'معلّق — يحجز الوقت'), 'warning'],
  conflict: [L('Clashes with another request', 'يتعارض مع طلب آخر'), 'danger'], mass: [L('Mass', 'قدّاس'), 'info'], event: [L('Calendar event', 'حدث في الرزنامة'), 'info'] });

function availabilityDrawer(vid) {
  const v = venue(vid); if (!v) return;
  let day = S.ui.availDay || isoD(TODAY);
  let shown = new Date(+day.slice(0, 4), +day.slice(5, 7) - 1, 1);
  const render = () => {
    const y = shown.getFullYear(), m = shown.getMonth(), first = new Date(y, m, 1), n = new Date(y, m + 1, 0).getDate();
    const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: n }, (_, i) => new Date(y, m, i + 1))];
    const block = blockOn(vid, day), items = block ? [] : heldOn(vid, day), gaps = block ? [] : freeGaps(items), past = day < isoD(TODAY);
    const pct = x => `${((Math.min(Math.max(x, OPEN[0]), OPEN[1]) - OPEN[0]) / (OPEN[1] - OPEN[0]) * 100).toFixed(2)}%`;
    const width = (a, b) => `${((Math.min(b, OPEN[1]) - Math.max(a, OPEN[0])) / (OPEN[1] - OPEN[0]) * 100).toFixed(2)}%`;
    const rows = block ? [] : [...items.map(it => ({ at: it.from - it.buffer, it })), ...gaps.map(g => ({ at: g[0], g }))].sort((p, q) => p.at - q.at);
    const S2 = STATE();
    return `<div class="avail">
      <div class="avail-cal">
        <div class="avail-cal-h">${C.iconBtn('chevL', L('Previous month', 'الشهر السابق'), 'data-avm="-1"')}<b>${esc(month(m))} ${y}</b>${C.iconBtn('chevR', L('Next month', 'الشهر التالي'), 'data-avm="1"')}</div>
        <div class="avail-grid" role="grid">${[0, 1, 2, 3, 4, 5, 6].map(i => `<span class="dh">${esc(dayShort(i))}</span>`).join('')}
          ${cells.map(d => { if (!d) return '<span></span>'; const k = isoD(d), bl = blockOn(vid, k), busy = !bl && heldOn(vid, k).length;
            return `<button type="button" class="ad${k === day ? ' on' : ''}${k === isoD(TODAY) ? ' today' : ''}${k < isoD(TODAY) ? ' past' : ''}${bl ? ' blocked' : ''}" data-avday="${k}" aria-pressed="${k === day}"
              aria-label="${esc(fmtLong(d))}${bl ? ' · ' + L('blocked', 'مغلقة') : busy ? ` · ${busy} ${L('booked', 'محجوز')}` : ''}">${d.getDate()}${busy ? '<i></i>' : ''}</button>`; }).join('')}</div>
        <div class="avail-legend"><span><i class="lg busy"></i>${L('something booked', 'محجوز جزئياً')}</span><span><i class="lg blocked"></i>${L('blocked', 'مغلقة')}</span></div>
        <label class="avail-jump"><span class="t-caption dim">${L('Or go straight to a date', 'أو اذهب إلى تاريخ')}</span><input class="input" type="date" id="av_date" value="${day}"></label>
      </div>
      <div class="avail-day">
        <div class="avail-day-h"><div><span class="overline">${day === isoD(TODAY) ? L('Today', 'اليوم') : L('Selected day', 'اليوم المحدّد')}</span><h4>${esc(fmtLong(day))} ${day.slice(0, 4)}</h4></div>
          <span class="row" style="gap:6px">${C.iconBtn('chevL', L('Previous day', 'اليوم السابق'), 'data-avd="-1"')}<button type="button" class="btn btn-secondary btn-dense" data-avd="0">${L('Today', 'اليوم')}</button>${C.iconBtn('chevR', L('Next day', 'اليوم التالي'), 'data-avd="1"')}</span></div>
        ${block ? C.inlineAlert('warning', L('Blocked for maintenance', 'مغلقة للصيانة'), L(`${block.why} · ${fmtDate(block.from)} – ${fmtDate(block.to)}. No new requests are accepted on this day.`, `${block.whyAr || block.why} · ${fmtDate(block.from)} – ${fmtDate(block.to)}. لا تُقبل طلبات جديدة في هذا اليوم.`))
        : `<div class="avail-strip" aria-hidden="true">${items.map(it => `${it.buffer ? `<span class="seg buf" style="inset-inline-start:${pct(it.from - it.buffer)};width:${width(it.from - it.buffer, it.from)}"></span>` : ''}
            <span class="seg ${it.state}" style="inset-inline-start:${pct(it.from)};width:${width(it.from, it.to)}" title="${esc(it.title)}"></span>`).join('')}</div>
          <div class="avail-scale" aria-hidden="true">${[7, 11, 15, 19, 23].map(h => `<span>${String(h).padStart(2, '0')}:00</span>`).join('')}</div>
          ${past ? `<p class="t-caption dim" style="margin:10px 0 0">${icon('info', 14)} ${L('This day has passed — it is shown for reference and cannot be booked.', 'مضى هذا اليوم — يُعرض للاطّلاع ولا يمكن الحجز فيه.')}</p>` : ''}
          <p class="t-caption dim" style="margin:10px 0 8px">${items.length ? L(`${items.length} booking${items.length === 1 ? '' : 's'} · ${gaps.length} free slot${gaps.length === 1 ? '' : 's'} between 07:00 and 23:00`, `${items.length} حجوزات · ${gaps.length} أوقات متاحة بين 07:00 و23:00`) : L('Free all day, 07:00 – 23:00.', 'متاحة طوال اليوم، 07:00 – 23:00.')}</p>
          <ol class="avail-list">${rows.map(({ it, g }) => it
            ? `<li class="held"><span class="tm mono">${hhmm(it.from)}–${hhmm(it.to)}</span><span class="grow"><b>${esc(it.title)}</b>${it.buffer ? `<small>${L(`plus ${it.buffer} min to set up before`, `مع ${it.buffer} د للتجهيز قبلها`)}</small>` : it.ref ? `<small class="mono">${esc(it.ref)}</small>` : ''}<span class="avail-state">${pill(S2[it.state][0], S2[it.state][1])}</span></span></li>`
            : `<li class="free"><span class="tm mono">${hhmm(g[0])}–${hhmm(g[1])}</span><span class="grow"><b>${L('Free', 'متاحة')}</b><small>${length(g[1] - g[0])}</small></span>
                ${past ? '' : `<button type="button" class="btn btn-secondary btn-dense" data-avbook="${hhmm(g[0])}|${hhmm(Math.min(g[1], g[0] + 120))}">${icon('plus', 14)}${L('Book', 'احجز')}</button>`}</li>`).join('')}</ol>`}
      </div></div>`;
  };
  openDrawer({ large: true,
    title: L(`Availability — ${v.name}`, `التوفّر — ${v.ar || v.name}`),
    sub: `${esc(L(v.kind, v.kindAr || v.kind))} · ${L('seats', 'يتّسع لـ')} ${v.cap}${v.access ? ' · ' + L('step-free access', 'مدخل بلا درج') : ''}`,
    body: `<div id="avbody">${render()}</div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Close', 'إغلاق')}</button>
      <button class="btn btn-primary" id="av_book" style="margin-inline-start:auto">${icon('plus', 16)}<span></span></button>`,
    onMount(el) {
      const book = (from, to) => { S.ui.availDay = day; CR.create('reservation', { venue: vid, date: day, ...(from ? { from, to } : {}) }); };
      const paint = () => {
        el.querySelector('#avbody').innerHTML = render();
        const blocked = !!blockOn(vid, day), foot = el.querySelector('#av_book');
        foot.disabled = blocked || day < isoD(TODAY); foot.querySelector('span').textContent = L(`Book on ${fmtDate(day)}`, `احجز في ${fmtDate(day)}`);
        const go = d => { day = d; shown = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, 1); S.ui.availDay = d; paint(); };
        el.querySelectorAll('[data-avday]').forEach(b => b.addEventListener('click', () => go(b.dataset.avday)));
        el.querySelectorAll('[data-avm]').forEach(b => b.addEventListener('click', () => { shown = new Date(shown.getFullYear(), shown.getMonth() + +b.dataset.avm, 1); paint(); }));
        el.querySelectorAll('[data-avd]').forEach(b => b.addEventListener('click', () => {
          const n = +b.dataset.avd, d = new Date(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + n); go(n ? isoD(d) : isoD(TODAY)); }));
        el.querySelector('#av_date')?.addEventListener('change', e => { if (e.target.value) go(e.target.value); });
        el.querySelectorAll('[data-avbook]').forEach(b => b.addEventListener('click', () => { const [f, t2] = b.dataset.avbook.split('|'); book(f, t2); }));
      };
      el.querySelector('#av_book').addEventListener('click', () => book());
      paint();
    } });
}

/* Block one room: pick the dates and the reason; anything already booked inside them is listed,
   because those people need to be told and moved. */
function blockDrawer(vid) {
  const v = venue(vid); if (!v) return;
  const start = isoD(TODAY), end = isoD(new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + 2));
  const inside = (from, to) => [
    ...RESERVATIONS.filter(r => r.venue === vid && r.status !== 'rejected' && r.date >= from && r.date <= to)
      .map(r => ({ d: r.date, t: r.from, title: L(r.title, r.titleAr || r.title), state: r.status, who: person(r.by) })),
    ...EVENTS.filter(e => e.venue === vid && e.kind !== 'pending' && e.d >= from && e.d <= to
      && !RESERVATIONS.some(r => r.venue === vid && r.date === e.d && r.from === e.t))
      .map(e => ({ d: e.d, t: e.t, title: L(e.title, e.titleAr || e.title), state: e.kind === 'mass' ? 'mass' : 'event' }))
  ].sort((x, y) => (x.d + x.t).localeCompare(y.d + y.t));
  openDrawer({
    title: L(`Block ${v.name} for maintenance`, `إغلاق ${v.ar || v.name} للصيانة`),
    sub: L('New requests for this room are refused for those dates. Anything already booked inside them is listed below.',
           'تُرفض طلبات هذه القاعة الجديدة في تلك الأيام، وتُعرض أدناه الحجوزات القائمة داخلها.'),
    body: `<div class="formgrid">${C.field({ label: L('From', 'من'), type: 'date', value: start, id: 'bk_f', req: true })}
        ${C.field({ label: L('To', 'إلى'), type: 'date', value: end, id: 'bk_t', req: true })}</div>
      ${C.field({ label: L('Reason', 'السبب'), id: 'bk_w', ph: L('Damp treatment on the north wall', 'معالجة الرطوبة في الجدار الشمالي') })}
      ${C.personPicker(L('Responsible staff', 'المسؤول'), 'mstaff')}
      <div id="bk_inside"></div>`,
    foot: `<button class="btn btn-secondary" data-close>${L('Cancel', 'إلغاء')}</button>
      <button class="btn btn-primary" id="doblock" style="margin-inline-start:auto">${icon('warn', 16)}${L('Block the room', 'إغلاق القاعة')}</button>`,
    onMount(el) {
      C.wire(el);
      const f = () => el.querySelector('#bk_f').value, t2 = () => el.querySelector('#bk_t').value;
      const show = () => {
        const list = f() && t2() && f() <= t2() ? inside(f(), t2()) : [];
        el.querySelector('#bk_inside').innerHTML = !f() || !t2() ? ''
          : f() > t2() ? C.inlineAlert('warning', L('The block ends before it starts', 'ينتهي الإغلاق قبل أن يبدأ'), L('Check the two dates.', 'تحقّق من التاريخين.'))
          : !list.length ? C.inlineAlert('success', L('Nothing is booked in those dates', 'لا حجوزات في تلك الأيام'), L(`${v.name} is free to close.`, `يمكن إغلاق ${v.ar || v.name}.`))
          : C.inlineAlert('warning', list.length === 1 ? L('One booking falls inside these dates', 'حجز واحد يقع داخل هذه الأيام') : L(`${list.length} bookings fall inside these dates`, `${list.length} حجوزات تقع داخل هذه الأيام`),
              L('Tell the people concerned and move them to another room or day.', 'أبلغ المعنيّين وانقلهم إلى قاعة أو يوم آخر.'))
            + `<ul class="blocklist">${list.map(x => `<li><span class="mono dim">${fmtDate(x.d)} · ${esc(x.t)}</span><b>${esc(x.title)}</b>${x.who ? `<small>${esc(L(x.who.lat, x.who.ar))}</small>` : ''}</li>`).join('')}</ul>`;
      };
      ['#bk_f', '#bk_t'].forEach(q => el.querySelector(q).addEventListener('change', show));
      show();
      el.querySelector('#doblock').addEventListener('click', () => {
        const typed = el.querySelector('#mstaff').value.trim(), found = typed && PEOPLE.find(p => p.lat === typed || p.ar === typed);
        if (![F.need(el, '#bk_f', L('Choose the first day', 'اختر اليوم الأول')), F.need(el, '#bk_t', L('Choose the last day', 'اختر اليوم الأخير')),
              F.need(el, '#mstaff', L('Choose someone from the list, or leave it empty', 'اختر شخصاً من اللائحة، أو اتركه فارغاً'), () => !typed || !!found)].every(Boolean)) return;
        if (f() > t2()) return show();
        const why = el.querySelector('#bk_w').value.trim() || L('Maintenance', 'صيانة');
        const staff = found ? found.id : me().id;
        const entry = { venue: vid, from: f(), to: t2(), why, whyAr: why, by: staff };
        MAINTENANCE.unshift(entry);
        closeOverlays(); bus.refresh();
        toast(L('Room blocked', 'أُغلقت القاعة'), `${L(v.name, v.ar || v.name)} · ${fmtDate(f())} – ${fmtDate(t2())}`, 'success',
          { action: { label: L('Undo', 'تراجع'), fn: () => { const i = MAINTENANCE.indexOf(entry); if (i >= 0) MAINTENANCE.splice(i, 1); bus.refresh(); } } });
      });
    }
  });
}

facilities.mount = host => {
  C.wire(host); wireTables(host);
  host.querySelectorAll('[data-block]').forEach(b => b.addEventListener('click', () => blockDrawer(b.dataset.block)));
  host.querySelectorAll('[data-avail]').forEach(b => b.addEventListener('click', () => availabilityDrawer(b.dataset.avail)));
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

