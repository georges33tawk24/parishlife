/* Shared collection controls: the month, week and list calendar every schedule uses. Filtering
   happens before paging; the list pages itself like any other collection. */
import { Fragment } from 'react';
import { t, isAr } from '../../lib/i18n.js';
import { Paged } from './ui.jsx';
import { useRedraw } from '../version.js';

const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** events: [{id, title, subtitle, date|d, time|t}]. state: {mode, date, query, filterDate}, kept by the
    caller so the calendar comes back as it was left. onOpen(id) opens an event. */
export function CalendarView({ events, state, onOpen, onChange }) {
  const redraw = useRedraw();
  const set = patch => { Object.assign(state, patch); redraw(); onChange?.(); };
  const mode = state.mode || 'month', anchor = new Date(`${state.date || dayKey(new Date())}T12:00:00`);
  const start = mode === 'week' ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay()) : new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = mode === 'week' ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7) : new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const locale = isAr() ? 'ar-LB' : 'en-GB';
  const dateLabel = mode === 'week' ? `${start.toLocaleDateString(locale)} – ${new Date(end - 86400000).toLocaleDateString(locale)}` : start.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const query = (state.query || '').toLocaleLowerCase();
  const items = events.filter(e => (!query || `${e.title || ''} ${e.subtitle || ''}`.toLocaleLowerCase().includes(query)) && (!state.filterDate || (e.date || e.d) === state.filterDate))
    .map(e => ({ ...e, date: e.date || e.d, time: e.time || e.t || '' }));
  const step = n => {
    const d = new Date(`${state.date || dayKey(new Date())}T12:00:00`);
    if (state.mode === 'week') d.setDate(d.getDate() + n * 7); else { d.setDate(1); d.setMonth(d.getMonth() + n); }
    set({ date: dayKey(d) });
  };
  const controls = <div className="collection-toolbar">
    <div className="seg" role="group" aria-label={t('Calendar view', 'عرض الرزنامة')}>{[['month', 'Month', 'شهر'], ['week', 'Week', 'أسبوع']].map(([v, en, ar]) =>
      <button key={v} type="button" data-calendar-mode={v} aria-pressed={mode === v} onClick={() => set({ mode: v })}>{t(en, ar)}</button>)}</div>
    <button className="btn btn-secondary" type="button" data-calendar-mode="list" aria-pressed={mode === 'list'} onClick={() => set({ mode: 'list' })}>{t('List', 'قائمة')}</button>
    <input className="input" type="search" data-calendar-search value={state.query || ''} placeholder={t('Search by name', 'البحث بالاسم')} aria-label={t('Search events', 'البحث عن الأحداث')}
      onChange={e => set({ query: e.target.value })} />
    <input className="input" type="date" data-calendar-date-filter value={state.filterDate || ''} aria-label={t('Search by date', 'البحث بالتاريخ')}
      onChange={e => set(e.target.value ? { filterDate: e.target.value, date: e.target.value } : { filterDate: '' })} />
    <button className="btn btn-ghost" data-calendar-clear onClick={() => set({ query: '', filterDate: '' })}>{t('Reset', 'إعادة ضبط')}</button>
  </div>;
  const event = e => <button key={e.id} type="button" className="cal-ev collection-event" data-calendar-event={e.id} onClick={() => onOpen?.(e.id)}>
    <time>{e.time}</time><span>{e.title}</span>{e.subtitle ? <small>{e.subtitle}</small> : null}</button>;
  if (mode === 'list') {
    const now = dayKey(new Date());
    const upcoming = items.filter(e => e.date >= now).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const past = items.filter(e => e.date < now).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const all = [...upcoming, ...past];
    return <>{controls}<Paged className="collection-list" data-paginate="">{all.length ? all.map(e => <article key={e.id} className="collection-list-item">
      <time>{new Date(e.date + 'T12:00:00').toLocaleDateString(locale, { dateStyle: 'medium' })}</time>{event(e)}</article>)
      : <p className="help">{t('No matching events.', 'لا أحداث مطابقة.')}</p>}</Paged></>;
  }
  const offset = mode === 'week' ? 0 : start.getDay();
  const count = mode === 'week' ? 7 : Math.ceil((new Date(end - 86400000).getDate() + offset) / 7) * 7;
  return <>{controls}
    <div className="collection-period"><button className="btn btn-secondary" data-calendar-step="-1" aria-label={t('Previous period', 'الفترة السابقة')} onClick={() => step(-1)}>‹</button>
      <strong>{dateLabel}</strong>
      <button className="btn btn-secondary" data-calendar-step="1" aria-label={t('Next period', 'الفترة التالية')} onClick={() => step(1)}>›</button>
      <button className="btn btn-ghost" data-calendar-today onClick={() => set({ date: dayKey(new Date()) })}>{t('Today', 'اليوم')}</button></div>
    <div className="collection-calendar-scroll"><div className="cal collection-calendar">
      <div className="cal-head">{Array.from({ length: 7 }, (_, i) => <div key={i}>{new Date(2026, 9, 4 + i).toLocaleDateString(locale, { weekday: 'short' })}</div>)}</div>
      <div className="cal-grid">{Array.from({ length: count }, (_, i) => {
        const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i - offset), key = dayKey(date);
        return <div key={key} className={`cal-day${mode === 'month' && date.getMonth() !== anchor.getMonth() ? ' out' : ''}${key === dayKey(new Date()) ? ' today' : ''}`}>
          <time className="dn" dateTime={key}>{date.getDate()}</time>
          {items.filter(e => e.date === key).sort((a, b) => a.time.localeCompare(b.time)).map(e => <Fragment key={e.id}>{event(e)}</Fragment>)}</div>;
      })}</div></div></div>
  </>;
}
