/* The public parish calendar: a month of days carrying the parish's published events, and
   beside it the events of the chosen day, or the rest of the month. A list view shows
   everything coming up. Search narrows both. Any event can be saved to the visitor's own
   calendar as an .ics file. */
import { useState } from 'react';
import { observanceOn } from '../api-data.js';
import { Glyph } from './icons.jsx';

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

/* The month and its agenda. events: [{id, d, t, title, titleAr, kind}]; place: the parish name and
   town for saved events; link: an event's own page, when it has one; liturgy: the parish's approved
   observances (api-data.js toLiturgy), which mark the feasts. */
export function ParishCalendar({ L, lang, events, place = '', link = null, liturgy = null }) {
  const loc = lang === 'ar' ? 'ar-LB' : 'en-GB',
    digits = new Intl.NumberFormat(loc);
  const all = events
    .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.d || ''))
    .map(e => ({
      ...e,
      t: e.t || '',
      name: (lang === 'ar' ? e.titleAr || e.title : e.title || e.titleAr) || kindName(L, e.kind)
    }))
    .sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
  const today = dayKey(new Date());
  const [state, setState] = useState(() => ({
    month: (all.find(e => e.d >= today)?.d || today).slice(0, 7),
    picked: '',
    q: '',
    mode: 'month'
  }));
  const set = change => setState(s => ({ ...s, ...change }));
  const fold = v =>
    String(v || '')
      .normalize('NFKD')
      .replace(/[̀-ًͯ-ٰٟ]/g, '')
      .toLocaleLowerCase();
  const q = fold(state.q.trim()),
    list = q ? all.filter(e => fold(`${e.title} ${e.titleAr} ${kindName(L, e.kind)}`).includes(q)) : all;
  const date = key => new Date(key + 'T12:00:00');
  const time = t =>
    t
      ? new Intl.DateTimeFormat(loc, { hour: 'numeric', minute: '2-digit', hour12: false }).format(
          new Date(`2000-01-01T${t}`)
        )
      : L('All day', 'طوال اليوم');
  const page = e => (link && e.id ? new URL(link(e), location.href).href : '');
  const row = e => (
    <li key={(e.id || '') + e.d + e.t + e.name} className={`pcal-ev k-${e.kind || 'event'}`}>
      <time>{time(e.t)}</time>
      <div>
        {page(e) ? (
          <a className="pcal-ev-link" href={page(e)}>
            <strong dir="auto">{e.name}</strong>
          </a>
        ) : (
          <strong dir="auto">{e.name}</strong>
        )}
        <span>{kindName(L, e.kind)}</span>
      </div>
      <a
        className="pcal-add"
        href={icsHref(e, e.name, place, page(e))}
        download={icsName(e.name)}
        title={L('Add to my calendar', 'أضف إلى رزنامتي')}
        aria-label={L(`Add ${e.name} to my calendar`, `أضف «${e.name}» إلى رزنامتي`)}
      >
        <Glyph name="add" />
      </a>
    </li>
  );
  const group = items =>
    [...new Set(items.map(e => e.d))].map(k => (
      <section key={k} className="pcal-group">
        <h4>
          <span>{new Intl.DateTimeFormat(loc, { weekday: 'long' }).format(date(k))}</span>{' '}
          {new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long' }).format(date(k))}
          {k === today ? (
            <>
              {' '}
              <b className="pcal-today-tag">{L('Today', 'اليوم')}</b>
            </>
          ) : null}
        </h4>
        <ul>{items.filter(e => e.d === k).map(row)}</ul>
      </section>
    ));

  let title,
    month = null,
    agenda;
  if (state.mode === 'list') {
    const ahead = list.filter(e => e.d >= today);
    title = L('Coming up', 'القادم');
    agenda = ahead.length ? (
      group(ahead.slice(0, 40))
    ) : (
      <p className="pcal-none">
        {state.q
          ? L('No event matches this search.', 'لا حدث يطابق هذا البحث.')
          : L('Nothing has been published for the coming weeks yet.', 'لم يُنشر شيء للأسابيع المقبلة بعد.')}
      </p>
    );
  } else {
    const [y, m] = state.month.split('-').map(Number),
      start = new Date(y, m - 1, 1);
    title = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(start);
    const lead = (start.getDay() + 6) % 7,
      length = new Date(y, m, 0).getDate(),
      cells = Math.ceil((lead + length) / 7) * 7;
    const byDay = new Map();
    list.forEach(e => byDay.set(e.d, [...(byDay.get(e.d) || []), e]));
    const pick = k => {
      setState(s => ({
        ...s,
        picked: s.picked === k ? '' : k,
        month: k.startsWith(s.month) ? s.month : k.slice(0, 7)
      }));
    };
    month = (
      <>
        <div className="pcal-heads" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i}>{new Intl.DateTimeFormat(loc, { weekday: 'narrow' }).format(new Date(2026, 9, 5 + i))}</span>
          ))}
        </div>
        <div className="pcal-grid">
          {Array.from({ length: cells }, (_, i) => {
            const d = new Date(y, m - 1, 1 - lead + i),
              k = dayKey(d),
              evs = byDay.get(k) || [],
              out = d.getMonth() !== m - 1;
            const feast = observanceOn(liturgy, k);
            const label = `${new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(d)}${feast ? ', ' + L(feast.en, feast.ar) : ''}${evs.length ? ', ' + L(`${evs.length} ${evs.length === 1 ? 'event' : 'events'}`, `${digits.format(evs.length)} ${evs.length === 1 ? 'حدث' : evs.length === 2 ? 'حدثان' : evs.length <= 10 ? 'أحداث' : 'حدثاً'}`) : ''}`;
            return (
              <button
                key={k}
                type="button"
                className={
                  'pcal-day' +
                  (out ? ' is-out' : '') +
                  (feast ? ' is-feast' : '') +
                  (d.getDay() === 0 ? ' is-sunday' : '') +
                  (k === today ? ' is-today' : '') +
                  (k === state.picked ? ' is-picked' : '') +
                  (evs.length ? ' has-events' : '')
                }
                data-day={k}
                aria-pressed={k === state.picked}
                aria-label={label}
                onClick={() => pick(k)}
              >
                <span className="pcal-n">{digits.format(d.getDate())}</span>
                {feast ? <span className="pcal-feast" aria-hidden="true" title={L(feast.en, feast.ar)}></span> : null}
                {evs.length ? (
                  <span className="pcal-dots" aria-hidden="true">
                    {evs.slice(0, 4).map((e, n) => (
                      <i key={n} className={`k-${e.kind || 'event'}`}></i>
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </>
    );
    const inMonth = list.filter(e => e.d.startsWith(state.month));
    if (state.picked) {
      const day = list.filter(e => e.d === state.picked),
        feast = observanceOn(liturgy, state.picked);
      agenda = (
        <>
          {feast ? <p className="pcal-feast-note">{L(feast.en, feast.ar)}</p> : null}
          {day.length ? (
            group(day)
          ) : (
            <>
              <h4 className="pcal-quiet-head">
                {new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(
                  date(state.picked)
                )}
              </h4>
              <p className="pcal-none">{L('Nothing published for this day.', 'لا شيء منشور لهذا اليوم.')}</p>
            </>
          )}
        </>
      );
    } else {
      const rest = state.month === today.slice(0, 7) ? inMonth.filter(e => e.d >= today) : inMonth;
      agenda = rest.length ? (
        group(rest)
      ) : (
        <p className="pcal-none">
          {state.q
            ? L('No event matches this search this month.', 'لا حدث يطابق هذا البحث في هذا الشهر.')
            : L('Nothing published for the rest of this month.', 'لا شيء منشور لبقية هذا الشهر.')}
        </p>
      );
    }
  }
  const step = n => {
    const [y, m] = state.month.split('-').map(Number);
    set({ month: dayKey(new Date(y, m - 1 + n, 1)).slice(0, 7), picked: '' });
  };
  const listMode = state.mode === 'list';
  return (
    <div className="pcal" data-pcal data-mode={state.mode}>
      <div className="pcal-bar">
        <div className="pcal-period">
          <button
            type="button"
            className="icon-button"
            data-pcal-step="-1"
            hidden={listMode}
            aria-label={L('Previous month', 'الشهر السابق')}
            onClick={() => step(-1)}
          >
            <Glyph name="prev" />
          </button>
          <h3 className="pcal-title" data-pcal-title aria-live="polite">
            {title}
          </h3>
          <button
            type="button"
            className="icon-button"
            data-pcal-step="1"
            hidden={listMode}
            aria-label={L('Next month', 'الشهر التالي')}
            onClick={() => step(1)}
          >
            <Glyph name="next" />
          </button>
          <button
            type="button"
            className="text-button"
            data-pcal-today
            hidden={listMode}
            onClick={() => set({ month: today.slice(0, 7), picked: today })}
          >
            {L('Today', 'اليوم')}
          </button>
        </div>
        <div className="pcal-tools">
          <div className="pcal-find">
            <label className="field-cap" htmlFor="pcal-q">
              {L('Search events', 'ابحث في الأحداث')}
            </label>
            <label className="pcal-search">
              <Glyph name="search" />
              <input
                id="pcal-q"
                type="search"
                data-pcal-q
                autoComplete="off"
                placeholder={L('For example: Mass', 'مثلاً: قداس')}
                value={state.q}
                onChange={e => set({ q: e.target.value })}
              />
            </label>
          </div>
          <div className="pcal-mode" role="group" aria-label={L('Calendar view', 'عرض الرزنامة')}>
            <button
              type="button"
              data-pcal-mode="month"
              aria-pressed={state.mode === 'month'}
              onClick={() => set({ mode: 'month' })}
            >
              {L('Month', 'الشهر')}
            </button>
            <button
              type="button"
              data-pcal-mode="list"
              aria-pressed={state.mode === 'list'}
              onClick={() => set({ mode: 'list' })}
            >
              {L('Coming up', 'القادم')}
            </button>
          </div>
        </div>
      </div>
      <div className="pcal-body" data-pcal-body>
        <div className="pcal-month" data-pcal-month>
          {month}
        </div>
        <div className="pcal-agenda" data-pcal-agenda>
          {agenda}
        </div>
      </div>
    </div>
  );
}
