/* The public parish calendar: a month of days carrying the parish's published events, and
   beside it the events of the chosen day, or the rest of the month. A list view shows
   everything coming up. Search narrows both. Any event can be saved to the visitor's own
   calendar as an .ics file. */
import { useState } from 'react';
import { observanceOn } from '../api-data.js';
import { A3Icon, Select } from './a3.jsx';

const pad = n => String(n).padStart(2, '0');

const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const KINDS = {
  mass: ['Mass', 'قدّاس'],
  sacr: ['Sacrament', 'سرّ'],
  group: ['Group', 'لقاء جماعة'],
  event: ['Parish event', 'حدث رعوي'],
  wedding: ['Wedding', 'إكليل'],
  baptism: ['Baptism', 'معمودية'],
  funeral: ['Funeral', 'جنّاز']
};

export const kindName = (L, kind) => L(...(KINDS[kind] || KINDS.event));

/* Events as .ics data links that the visitor's calendar opens: one event, or all of them. Times
   are Beirut times, so a visitor abroad sees them at the right hour in their own calendar. */
const TIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Asia/Beirut',
  'X-LIC-LOCATION:Asia/Beirut',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0300',
  'TZOFFSETTO:+0200',
  'TZNAME:EET',
  'DTSTART:19701025T000000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0300',
  'TZNAME:EEST',
  'DTSTART:19700329T000000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'END:VTIMEZONE'
];

/* Start and end as calendar stamps: an hour for a timed event, the whole day otherwise. */
function span(e) {
  if (/^\d{2}:\d{2}$/.test(e.t || '')) {
    const end = new Date(`${e.d}T${e.t}:00Z`);
    end.setUTCHours(end.getUTCHours() + 1);
    return {
      timed: true,
      start: e.d.replace(/-/g, '') + 'T' + e.t.replace(':', '') + '00',
      end: end.toISOString().slice(0, 16).replace(/[-:]/g, '') + '00'
    };
  }
  const end = new Date(e.d + 'T00:00:00Z');
  end.setUTCDate(end.getUTCDate() + 1);
  return { timed: false, start: e.d.replace(/-/g, ''), end: end.toISOString().slice(0, 10).replace(/-/g, '') };
}

function vevent(e, name, place, url) {
  const { timed, start, end } = span(e),
    text = v => String(v).replace(/[,;\\]/g, m => '\\' + m);
  return [
    'BEGIN:VEVENT',
    `UID:${e.id || start}@parishlife`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    timed ? `DTSTART;TZID=Asia/Beirut:${start}` : `DTSTART;VALUE=DATE:${start}`,
    timed ? `DTEND;TZID=Asia/Beirut:${end}` : `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${text(name)}`,
    place ? `LOCATION:${text(place)}` : '',
    url ? `URL:${url}` : '',
    'END:VEVENT'
  ].filter(Boolean);
}

const calendarFile = vevents =>
  'data:text/calendar;charset=utf-8,' +
  encodeURIComponent(
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ParishLife//Public calendar//EN',
      ...TIMEZONE,
      ...vevents,
      'END:VCALENDAR'
    ].join('\r\n')
  );

export const icsHref = (e, name, place = '', url = '') => calendarFile(vevent(e, name, place, url));

export const icsAllHref = (events, nameOf, place = '', urlOf = () => '') =>
  calendarFile(events.flatMap(e => vevent(e, nameOf(e), place, urlOf(e))));

/* The same event opened in Google Calendar, ready to save. */
export function googleHref(e, name, place = '', details = '') {
  const { start, end } = span(e),
    q = new URLSearchParams({ action: 'TEMPLATE', text: name, dates: `${start}/${end}`, ctz: 'Asia/Beirut' });
  if (place) q.set('location', place);
  if (details) q.set('details', details);
  return 'https://calendar.google.com/calendar/render?' + q;
}

export const icsName = name =>
  (String(name || 'event')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .trim() || 'event') + '.ics';

/* Now in Beirut, where the parishes keep their times, so a visitor abroad still reads "in 2 hours" right. */
export function beirutNow() {
  try {
    const part = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Beirut',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      })
        .formatToParts(new Date())
        .map(x => [x.type, x.value])
    );
    return { d: `${part.year}-${part.month}-${part.day}`, t: `${part.hour}:${part.minute}` };
  } catch {
    const d = new Date();
    return { d: dayKey(d), t: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  }
}

/* The kinds of event, gathered into the categories the calendar's dropdown offers, with their colour. */
export const CATEGORIES = [
  ['', ['All events', 'كل المناسبات'], []],
  ['mass', ['Masses', 'القداديس'], ['mass']],
  ['sacr', ['Sacraments', 'الأسرار'], ['sacr', 'wedding', 'baptism', 'funeral']],
  ['group', ['Gatherings', 'اللقاءات'], ['group']],
  ['event', ['Parish events', 'أحداث الرعية'], ['event']]
];
export const categoryOf = kind => (CATEGORIES.find(c => c[2].includes(kind)) || CATEGORIES[4])[0];

/* The month (design A3): a grid of days, each showing its first event in its category's colour and how
   many more; the chosen day's events in a panel beside it; a dropdown narrows the calendar to one kind.
   events: [{id, d, t, title, titleAr, kind}]; place: the parish name and town for saved events; link: an
   event's own page, when it has one; liturgy: the parish's approved observances (api-data.js toLiturgy),
   which mark the feasts; side: anything to show under the day's panel. */
export function ParishCalendar({ L, lang, events, place = '', link = null, liturgy = null, side = null }) {
  const loc = lang === 'ar' ? 'ar-LB' : 'en-GB',
    digits = new Intl.NumberFormat(loc);
  const all = events
    .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.d || ''))
    .map(e => ({
      ...e,
      t: e.t || '',
      cat: categoryOf(e.kind),
      name: (lang === 'ar' ? e.titleAr || e.title : e.title || e.titleAr) || kindName(L, e.kind)
    }))
    .sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
  const today = beirutNow().d;
  const [state, setState] = useState(() => {
    const first = (all.find(e => e.d >= today)?.d || today).slice(0, 7);
    return { month: first, picked: first === today.slice(0, 7) ? today : '', cat: '' };
  });
  const set = change => setState(s => ({ ...s, ...change }));
  const list = state.cat ? all.filter(e => e.cat === state.cat) : all;
  const date = key => new Date(key + 'T12:00:00');
  const time = t =>
    t
      ? new Intl.DateTimeFormat(loc, { hour: 'numeric', minute: '2-digit', hour12: true }).format(
          new Date(`2000-01-01T${t}`)
        )
      : L('All day', 'طوال اليوم');
  const page = e => (link && e.id ? new URL(link(e), location.href).href : '');
  const count = n =>
    L(
      `${n} ${n === 1 ? 'event' : 'events'}`,
      n === 1 ? 'حدث واحد' : n === 2 ? 'حدثان' : `${digits.format(n)} ${n <= 10 ? 'أحداث' : 'حدثاً'}`
    );
  const [y, m] = state.month.split('-').map(Number),
    start = new Date(y, m - 1, 1),
    lead = (start.getDay() + 6) % 7,
    length = new Date(y, m, 0).getDate(),
    cells = Math.ceil((lead + length) / 7) * 7;
  const byDay = new Map();
  list.forEach(e => byDay.set(e.d, [...(byDay.get(e.d) || []), e]));
  const step = n => set({ month: dayKey(new Date(y, m - 1 + n, 1)).slice(0, 7), picked: '' });
  const picked = state.picked,
    dayEvents = picked ? byDay.get(picked) || [] : [],
    dayFeast = picked ? observanceOn(liturgy, picked) : null;
  const ahead = list.filter(e => e.d.startsWith(state.month) && (state.month !== today.slice(0, 7) || e.d >= today));
  const row = (e, withDate = false) => (
    <li key={(e.id || '') + e.d + e.t + e.name} className={'dayev c-' + e.cat}>
      <span className="tm time">
        {withDate ? new Intl.DateTimeFormat(loc, { weekday: 'short', day: 'numeric' }).format(date(e.d)) + ' ' : ''}
        {time(e.t)}
      </span>
      <div>
        {page(e) ? (
          <a className="t-link" href={page(e)} dir="auto">
            {e.name}
          </a>
        ) : (
          <strong dir="auto">{e.name}</strong>
        )}
        <a href={icsHref(e, e.name, place, page(e))} download={icsName(e.name)} className="ev-add">
          {L('Add to my calendar', 'أضف إلى رزنامتي')}
          <span className="sr-only">: {e.name}</span>
        </a>
      </div>
    </li>
  );
  return (
    <div className="split cal-split">
      <div className="main">
        <div className="head cal-head">
          <div className="cal-period">
            <button
              type="button"
              className="arrow flip"
              aria-label={L('Previous month', 'الشهر السابق')}
              onClick={() => step(-1)}
            >
              <A3Icon name="prev" />
            </button>
            <h2 className="h3" id="cal-month" aria-live="polite">
              {new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(start)}
            </h2>
            <button
              type="button"
              className="arrow flip"
              aria-label={L('Next month', 'الشهر التالي')}
              onClick={() => step(1)}
            >
              <A3Icon name="next" />
            </button>
            {state.month !== today.slice(0, 7) || picked !== today ? (
              <button
                type="button"
                className="text-button"
                onClick={() => set({ month: today.slice(0, 7), picked: today })}
              >
                {L('Today', 'اليوم')}
              </button>
            ) : null}
          </div>
          <Select
            id="cal-cat"
            className="cal-cat"
            hideLabel
            label={L('Kind of event', 'نوع المناسبة')}
            value={state.cat}
            options={CATEGORIES.map(([value, words]) => ({ value, label: L(...words) }))}
            onChange={cat => set({ cat })}
          />
        </div>
        <div className="cal" role="group" aria-labelledby="cal-month">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={'h' + i} className="dow" aria-hidden="true">
              <span className="dow-long">
                {new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(new Date(2026, 9, 5 + i))}
              </span>
              <span className="dow-narrow">
                {new Intl.DateTimeFormat(loc, { weekday: 'narrow' }).format(new Date(2026, 9, 5 + i))}
              </span>
            </span>
          ))}
          {Array.from({ length: cells }, (_, i) => {
            const n = i - lead + 1;
            if (n < 1 || n > length) return <span key={'b' + i} aria-hidden="true"></span>;
            const k = dayKey(new Date(y, m - 1, n)),
              evs = byDay.get(k) || [],
              feast = observanceOn(liturgy, k);
            const label = `${new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(date(k))}${feast ? ', ' + L(feast.en, feast.ar) : ''}${evs.length ? L(', ', '، ') + count(evs.length) : ''}`;
            return (
              <button
                key={k}
                type="button"
                className={
                  'day' + (k === today ? ' today' : '') + (k === picked ? ' sel' : '') + (feast ? ' feast' : '')
                }
                aria-pressed={k === picked}
                aria-label={label}
                onClick={() => set({ picked: k === picked ? '' : k })}
              >
                <span className="n time">{digits.format(n)}</span>
                {evs.length ? <span className={'ev-dot c-' + evs[0].cat}>{evs[0].name}</span> : null}
                {evs.length > 1 ? (
                  <span className="more-n">{L(`+${evs.length - 1} more`, `+${digits.format(evs.length - 1)}`)}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <aside className="side">
        <section className="card day-panel" aria-labelledby="day-title" aria-live="polite">
          {picked ? (
            <>
              <h2 id="day-title" className="h3">
                {picked === today ? L('Today, ', 'اليوم، ') : ''}
                {new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(date(picked))}
              </h2>
              {dayFeast ? <p className="cal-feast">{L(dayFeast.en, dayFeast.ar)}</p> : null}
              {dayEvents.length ? (
                <>
                  <p className="d">{count(dayEvents.length)}</p>
                  <ul className="day-list">{dayEvents.map(e => row(e))}</ul>
                </>
              ) : (
                <p className="d" style={{ marginTop: 10 }}>
                  {state.cat
                    ? L('No events of this kind on this day.', 'لا مناسبات من هذا النوع في هذا اليوم.')
                    : L('Nothing published for this day.', 'لا شيء منشور لهذا اليوم.')}
                </p>
              )}
            </>
          ) : (
            <>
              <h2 id="day-title" className="h3">
                {L('Coming up this month', 'القادم هذا الشهر')}
              </h2>
              {ahead.length ? (
                <ul className="day-list">{ahead.slice(0, 8).map(e => row(e, true))}</ul>
              ) : (
                <p className="d" style={{ marginTop: 10 }}>
                  {L('Nothing published for the rest of this month.', 'لا شيء منشور لبقية هذا الشهر.')}
                </p>
              )}
            </>
          )}
        </section>
        {side}
      </aside>
    </div>
  );
}
