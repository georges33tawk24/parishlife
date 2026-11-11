/* One event a parish published: when and where, what it is, how to share it or save it to a
   calendar. */
import { season, feastOn } from '../../lib/liturgy.js';
import { kindName, icsHref, icsName, googleHref } from '../components/ParishCalendar.jsx';
import { useSite, digits } from '../site.jsx';
import { Glyph } from '../components/icons.jsx';
import {
  ParishSub,
  ShareRow,
  TIME,
  Thumb,
  abroad,
  directionsURL,
  evLink,
  facts,
  loc,
  relative,
  title,
  when
} from './parish-parts.jsx';

/* One event's own page: when and where, saving it to a calendar, sharing it, and what else is coming. */
export function EventPage({ p, d, id }) {
  const c = useSite(),
    f = facts(c, p, d),
    { L } = c,
    e = f.events.find(x => x.id && String(x.id) === String(id));
  if (!e)
    return (
      <ParishSub
        p={p}
        f={f}
        here={L('Event', 'مناسبة')}
        heading={L('This event is no longer in the calendar', 'لم تعد هذه المناسبة في الرزنامة')}
        lede={L(
          'The parish may have changed or removed it. Its calendar shows everything coming up.',
          'ربما عدّلتها الرعية أو أزالتها. تعرض رزنامتها كلّ ما هو قادم.'
        )}
      >
        <section className="site-wrap ev-missing" data-reveal>
          <a className="btn btn-gilt" href={c.calendarURL(p.id)}>
            <Glyph name="cal" />
            {L('Open the calendar', 'افتح الرزنامة')}
          </a>
          <a className="btn btn-ink-line" href={c.profileURL(p.id)}>
            {L('Parish page', 'صفحة الرعية')}
          </a>
        </section>
      </ParishSub>
    );
  const t = title(c, e),
    place = [f.name, f.town].filter(Boolean).join(L(', ', '، ')),
    url = c.shareURL(c.eventURL(p.id, e.id));
  const date = new Date(e.d + 'T12:00:00'),
    soon = e.d >= f.today ? relative(c, e) : '',
    more = f.upcoming.filter(x => x !== e).slice(0, 4);
  const fmt = o => new Intl.DateTimeFormat(loc(c), o).format(date);
  // where the day stands in the Church's year, and its feast if it has one
  const year = season(e.d),
    feastDay = feastOn(e.d);
  const rows = [
    [
      'clock',
      L('When', 'متى'),
      <>
        <time dateTime={e.d + (TIME.test(e.t || '') ? 'T' + e.t : '')}>{when(c, e)}</time>
        {soon ? (
          <>
            {' '}
            <span className="wk-in">{soon}</span>
          </>
        ) : null}
        {abroad() && TIME.test(e.t || '') ? (
          <small className="ev-zone">{L('Beirut time', 'بتوقيت بيروت')}</small>
        ) : null}
      </>
    ],
    [
      'pin',
      L('Where', 'أين'),
      <>
        {place}
        {f.address ? <small dir="auto">{f.address}</small> : null}
      </>
    ],
    ['cross', L('What', 'ماذا'), kindName(L, e.kind)],
    [
      'star',
      L('In the Maronite year', 'في السنة المارونية'),
      <>
        {L(year.en, year.ar)}
        {feastDay ? <small className="ev-feast">{L(feastDay.en, feastDay.ar)}</small> : null}
      </>
    ]
  ];
  return (
    <ParishSub
      p={p}
      f={f}
      className="ev-page"
      docTitle={t + ' · ' + f.name}
      here={L('Event', 'مناسبة')}
      heading={t}
      lede={L(`${when(c, e)}, at ${f.name}`, `${when(c, e)}، في رعية ${f.name}`)}
    >
      <div className="site-wrap ev-grid">
        <article className={`ev-card k-${e.kind || 'event'}`} data-reveal>
          <span className="wk-date ev-date" aria-hidden="true">
            <small>{fmt({ weekday: 'short' })}</small>
            <b>{digits(c, date.getDate())}</b>
            <small>{fmt({ month: 'short' })}</small>
          </span>
          <dl className="ev-facts">
            {rows.map(([icon, k, v]) => (
              <div key={k}>
                <span className="ph-contact-icon">
                  <Glyph name={icon} />
                </span>
                <dt>{k}</dt>
                <dd dir="auto">{v}</dd>
              </div>
            ))}
          </dl>
          {e.d < f.today ? (
            <p className="ev-past">{L('This event has already taken place.', 'جرت هذه المناسبة.')}</p>
          ) : (
            <div className="ev-actions">
              <a className="btn btn-gilt" href={icsHref(e, t, place, url)} download={icsName(t)}>
                <Glyph name="add" />
                {L('Add to my calendar', 'أضف إلى رزنامتي')}
              </a>
              <a className="btn btn-ink-line" href={googleHref(e, t, place, url)} target="_blank" rel="noopener">
                <Glyph name="google" />
                {L('Google Calendar', 'رزنامة Google')}
              </a>
              <a className="btn btn-ink-line" href={directionsURL(p, d, f.visit)} target="_blank" rel="noopener">
                <Glyph name="route" />
                {L('Directions', 'الاتجاهات')}
              </a>
            </div>
          )}
          <ShareRow
            url={url}
            text={`${t} · ${when(c, e)} · ${place}`}
            label={L('Share this event', 'شارك هذه المناسبة')}
          />
        </article>
        <aside className="ev-side" data-reveal>
          <a className="rq-parish" href={c.profileURL(p.id)}>
            <Thumb src={f.photos[0]} name={f.name} />
            <span>
              <b>{f.name}</b>
              <small>{[f.town, f.rite].filter(Boolean).join(' · ')}</small>
            </span>
          </a>
          {more.length ? (
            <>
              <h2>{L(`More at ${f.name}`, `المزيد في رعية ${f.name}`)}</h2>
              <ul className="ev-more">
                {more.map((x, i) => (
                  <li key={(x.id || i) + x.d}>
                    <a href={evLink(c, p, x)}>
                      <time>{when(c, x)}</time>
                      <b dir="auto">{title(c, x)}</b>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <a className="text-button" href={c.calendarURL(p.id)}>
            {L('The whole calendar', 'الرزنامة كاملة')}
          </a>
        </aside>
      </div>
    </ParishSub>
  );
}
