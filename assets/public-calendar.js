/* The public parish calendar: a month of days carrying the parish's published events, and
   beside it the events of the chosen day, or the rest of the month. A list view shows
   everything coming up. Search narrows both. Any event can be saved to the visitor's own
   calendar as an .ics file. */
const pad = n => String(n).padStart(2, '0');
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const svg = d => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const PREV = svg('<path d="m15 5-7 7 7 7"/>'), NEXT = svg('<path d="m9 5 7 7-7 7"/>');
const SEARCH = svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>');
const ADD = svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M8 3v4m8-4v4M3.5 10h17M12 13v5m-2.5-2.5h5"/>');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const KINDS = { mass: ['Mass', 'قدّاس'], sacr: ['Sacrament', 'سرّ'], group: ['Group', 'لقاء جماعة'], event: ['Parish event', 'حدث رعوي'],
  wedding: ['Wedding', 'إكليل'], baptism: ['Baptism', 'معمودية'], funeral: ['Funeral', 'جنّاز'] };
export const kindName = (L, kind) => L(...(KINDS[kind] || KINDS.event));

export function calendarMarkup(L) {
  return `<div class="pcal" data-pcal>
    <div class="pcal-bar">
      <div class="pcal-period">
        <button type="button" class="icon-button" data-pcal-step="-1" aria-label="${esc(L('Previous month', 'الشهر السابق'))}">${PREV}</button>
        <h3 class="pcal-title" data-pcal-title aria-live="polite"></h3>
        <button type="button" class="icon-button" data-pcal-step="1" aria-label="${esc(L('Next month', 'الشهر التالي'))}">${NEXT}</button>
        <button type="button" class="text-button" data-pcal-today>${L('Today', 'اليوم')}</button>
      </div>
      <div class="pcal-tools">
        <label class="pcal-search">${SEARCH}<span class="sr-only">${L('Search events', 'ابحث في الأحداث')}</span><input type="search" data-pcal-q autocomplete="off" placeholder="${esc(L('Search events', 'ابحث في الأحداث'))}"></label>
        <div class="pcal-mode" role="group" aria-label="${esc(L('Calendar view', 'عرض الرزنامة'))}"><button type="button" data-pcal-mode="month" aria-pressed="true">${L('Month', 'الشهر')}</button><button type="button" data-pcal-mode="list" aria-pressed="false">${L('Coming up', 'القادم')}</button></div>
      </div>
    </div>
    <div class="pcal-body" data-pcal-body><div class="pcal-month" data-pcal-month></div><div class="pcal-agenda" data-pcal-agenda></div></div>
  </div>`;
}

/* events: [{id, d, t, title, titleAr, kind}]; place: the parish name and town for saved events. */
export function mountCalendar(root, events, { L, lang, place = '' }) {
  const box = root.querySelector('[data-pcal]');
  if (!box) return () => {};
  const loc = lang === 'ar' ? 'ar-LB' : 'en-GB', digits = new Intl.NumberFormat(loc);
  const all = events.filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.d || ''))
    .map(e => ({ ...e, t: e.t || '', name: (lang === 'ar' ? e.titleAr || e.title : e.title || e.titleAr) || kindName(L, e.kind) }))
    .sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
  const today = dayKey(new Date());
  const first = all.find(e => e.d >= today);
  const state = { month: (first?.d || today).slice(0, 7), picked: '', q: '', mode: 'month' };
  const title = box.querySelector('[data-pcal-title]'), month = box.querySelector('[data-pcal-month]'), agenda = box.querySelector('[data-pcal-agenda]');
  const fold = v => String(v || '').normalize('NFKD').replace(/[̀-ًͯ-ٰٟ]/g, '').toLocaleLowerCase();
  const shown = () => { const q = fold(state.q.trim()); return q ? all.filter(e => fold(`${e.title} ${e.titleAr} ${kindName(L, e.kind)}`).includes(q)) : all; };
  const date = key => new Date(key + 'T12:00:00');
  const time = t => t ? new Intl.DateTimeFormat(loc, { hour: 'numeric', minute: '2-digit', hour12: false }).format(new Date(`2000-01-01T${t}`)) : L('All day', 'طوال اليوم');
  const ics = e => {
    const start = e.d.replace(/-/g, '') + (e.t ? 'T' + e.t.replace(':', '') + '00' : '');
    const end = e.t ? new Date(`${e.d}T${e.t}`) : null;
    if (end) end.setHours(end.getHours() + 1);
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ParishLife//Public calendar//EN', 'BEGIN:VEVENT', `UID:${e.id || start}@parishlife`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, e.t ? `DTSTART:${start}` : `DTSTART;VALUE=DATE:${start}`,
      end ? `DTEND:${dayKey(end).replace(/-/g, '')}T${pad(end.getHours())}${pad(end.getMinutes())}00` : '', `SUMMARY:${e.name.replace(/[,;\\]/g, m => '\\' + m)}`,
      place ? `LOCATION:${place.replace(/[,;\\]/g, m => '\\' + m)}` : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean);
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'));
  };
  const row = e => `<li class="pcal-ev k-${esc(e.kind || 'event')}"><time>${esc(time(e.t))}</time><div><strong dir="auto">${esc(e.name)}</strong><span>${esc(kindName(L, e.kind))}</span></div>
    <a class="pcal-add" href="${ics(e)}" download="${esc((e.name || 'event').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'event')}.ics" title="${esc(L('Add to my calendar', 'أضف إلى رزنامتي'))}" aria-label="${esc(L(`Add ${e.name} to my calendar`, `أضف «${e.name}» إلى رزنامتي`))}">${ADD}</a></li>`;
  const group = list => {
    const days = [...new Set(list.map(e => e.d))];
    return days.map(k => `<section class="pcal-group"><h4><span>${esc(new Intl.DateTimeFormat(loc, { weekday: 'long' }).format(date(k)))}</span> ${esc(new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long' }).format(date(k)))}${k === today ? ` <b class="pcal-today-tag">${L('Today', 'اليوم')}</b>` : ''}</h4>
      <ul>${list.filter(e => e.d === k).map(row).join('')}</ul></section>`).join('');
  };
  function paint() {
    const list = shown(), [y, m] = state.month.split('-').map(Number), start = new Date(y, m - 1, 1);
    box.dataset.mode = state.mode;
    box.querySelectorAll('[data-pcal-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pcalMode === state.mode)));
    box.querySelectorAll('[data-pcal-step],[data-pcal-today]').forEach(b => { b.hidden = state.mode === 'list'; });
    if (state.mode === 'list') {
      const ahead = list.filter(e => e.d >= today);
      title.textContent = L('Coming up', 'القادم');
      month.innerHTML = '';
      agenda.innerHTML = ahead.length ? group(ahead.slice(0, 40)) : `<p class="pcal-none">${state.q ? L('No event matches this search.', 'لا حدث يطابق هذا البحث.') : L('Nothing has been published for the coming weeks yet.', 'لم يُنشر شيء للأسابيع المقبلة بعد.')}</p>`;
      return;
    }
    title.textContent = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(start);
    const lead = (start.getDay() + 6) % 7, length = new Date(y, m, 0).getDate(), cells = Math.ceil((lead + length) / 7) * 7;
    const heads = Array.from({ length: 7 }, (_, i) => `<span>${esc(new Intl.DateTimeFormat(loc, { weekday: 'narrow' }).format(new Date(2026, 9, 5 + i)))}</span>`).join('');
    const byDay = new Map();
    list.forEach(e => byDay.set(e.d, [...(byDay.get(e.d) || []), e]));
    month.innerHTML = `<div class="pcal-heads" aria-hidden="true">${heads}</div><div class="pcal-grid">${Array.from({ length: cells }, (_, i) => {
      const d = new Date(y, m - 1, 1 - lead + i), k = dayKey(d), evs = byDay.get(k) || [], out = d.getMonth() !== m - 1;
      const label = `${new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(d)}${evs.length ? ', ' + L(`${evs.length} ${evs.length === 1 ? 'event' : 'events'}`, `${digits.format(evs.length)} ${evs.length === 1 ? 'حدث' : evs.length === 2 ? 'حدثان' : evs.length <= 10 ? 'أحداث' : 'حدثاً'}`) : ''}`;
      return `<button type="button" class="pcal-day${out ? ' is-out' : ''}${k === today ? ' is-today' : ''}${k === state.picked ? ' is-picked' : ''}${evs.length ? ' has-events' : ''}" data-day="${k}" aria-pressed="${k === state.picked}" aria-label="${esc(label)}">
        <span class="pcal-n">${esc(digits.format(d.getDate()))}</span>${evs.length ? `<span class="pcal-dots" aria-hidden="true">${evs.slice(0, 4).map(e => `<i class="k-${esc(e.kind || 'event')}"></i>`).join('')}</span>` : ''}</button>`;
    }).join('')}</div>`;
    const inMonth = list.filter(e => e.d.startsWith(state.month));
    if (state.picked) {
      const day = list.filter(e => e.d === state.picked);
      agenda.innerHTML = day.length ? group(day) : `<h4 class="pcal-quiet-head">${esc(new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(date(state.picked)))}</h4><p class="pcal-none">${L('Nothing published for this day.', 'لا شيء منشور لهذا اليوم.')}</p>`;
    } else {
      const rest = state.month === today.slice(0, 7) ? inMonth.filter(e => e.d >= today) : inMonth;
      agenda.innerHTML = rest.length ? group(rest) : `<p class="pcal-none">${state.q ? L('No event matches this search this month.', 'لا حدث يطابق هذا البحث في هذا الشهر.') : L('Nothing published for the rest of this month.', 'لا شيء منشور لبقية هذا الشهر.')}</p>`;
    }
    month.querySelectorAll('[data-day]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.day;
      state.picked = state.picked === k ? '' : k;
      if (!k.startsWith(state.month)) state.month = k.slice(0, 7);
      paint();
      month.querySelector(`[data-day="${k}"]`)?.focus();
    }));
  }
  box.querySelectorAll('[data-pcal-step]').forEach(b => b.addEventListener('click', () => {
    const [y, m] = state.month.split('-').map(Number), next = new Date(y, m - 1 + Number(b.dataset.pcalStep), 1);
    state.month = dayKey(next).slice(0, 7); state.picked = ''; paint();
  }));
  box.querySelector('[data-pcal-today]').addEventListener('click', () => { state.month = today.slice(0, 7); state.picked = today; paint(); });
  box.querySelectorAll('[data-pcal-mode]').forEach(b => b.addEventListener('click', () => { state.mode = b.dataset.pcalMode; paint(); }));
  const q = box.querySelector('[data-pcal-q]');
  q.addEventListener('input', () => { state.q = q.value; paint(); });
  paint();
  return () => {};
}
