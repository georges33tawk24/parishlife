/* One event a parish published (design A3): its name over a candlelit photograph, When, Where and What as
   three coloured cards, a bar to save it (this phone's calendar, Google Calendar, Google Maps, sharing),
   and what else is coming at the parish. */
import { observanceOn, seasonOn } from '../api-data.js';
import { kindName, icsHref, icsName, googleHref } from '../components/ParishCalendar.jsx';
import { useSite, yearLabel } from '../site.jsx';
import { A3Icon, PhotoHero } from '../components/a3.jsx';
import { EventCard } from './Home.jsx';
import {
  CopyButton,
  ParishSub,
  TIME,
  abroad,
  directionsURL,
  evLink,
  facts,
  loc,
  relative,
  title
} from './parish-parts.jsx';

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
        <div className="wrap sec acts" style={{ marginTop: 0 }}>
          <a className="btn btn-red" href={c.calendarURL(p.id)}>
            <A3Icon name="cal" />
            {L('Open the calendar', 'افتح الرزنامة')}
          </a>
          <a className="btn btn-soft" href={c.profileURL(p.id)}>
            {L('Parish page', 'صفحة الرعية')}
          </a>
        </div>
      </ParishSub>
    );
  const t = title(c, e),
    place = [f.name, f.town].filter(Boolean).join(L(', ', '، ')),
    url = c.shareURL(c.eventURL(p.id, e.id));
  const date = new Date(e.d + 'T12:00:00'),
    timed = TIME.test(e.t || ''),
    soon = e.d >= f.today ? relative(c, e) : '',
    more = f.upcoming.filter(x => x !== e).slice(0, 3);
  const day = new Intl.DateTimeFormat(loc(c), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
  const hour = timed
    ? new Intl.DateTimeFormat(loc(c), { hour: 'numeric', minute: '2-digit', hour12: true }).format(
        new Date(`2000-01-01T${e.t}`)
      )
    : '';
  // where the day stands in the Church's year, and its feast, as the parish's approved calendar says
  const year = seasonOn(d.liturgy, e.d, c.lang),
    feastDay = observanceOn(d.liturgy, e.d);
  return (
    <div className="ev-page" data-doc-title={t + ' · ' + f.name}>
      <PhotoHero
        L={L}
        image="img-votive"
        crumbs={[
          [L('All parishes', 'كل الرعايا'), 'public.html#directory'],
          [f.name, c.profileURL(p.id)],
          [L('Event', 'مناسبة')]
        ]}
      >
        <div className="hero-gap">
          <p className="kick">{L(`${kindName(L, e.kind)} at ${f.name}`, `${kindName(L, e.kind)} في رعية ${f.name}`)}</p>
          <h1 id="pg-title" className="h1 one-line" dir="auto">
            {t}
          </h1>
          <p className="hl time">
            {day}
            {hour ? L(`, ${hour}`, `، ${hour}`) : ''}
          </p>
        </div>
      </PhotoHero>
      <section className="wrap sec" aria-label={L('Event details', 'تفاصيل المناسبة')}>
        <div className="g3 tints hi">
          <div className="card">
            <span className="ic" aria-hidden="true">
              <A3Icon name="cal" />
            </span>
            <h2>{L('When', 'متى')}</h2>
            <p>
              <strong>
                <time dateTime={e.d + (timed ? 'T' + e.t : '')}>{day}</time>
              </strong>
              {hour ? (
                <>
                  <br />
                  <span className="time">{hour}</span>
                  {abroad() ? L(', Beirut time', '، بتوقيت بيروت') : ''}
                </>
              ) : null}
              {soon ? (
                <>
                  <br />
                  <span className="d">{soon}</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="card">
            <span className="ic" aria-hidden="true">
              <A3Icon name="pin" />
            </span>
            <h2>{L('Where', 'أين')}</h2>
            <p>
              <strong>{place}</strong>
              {f.address ? (
                <>
                  <br />
                  <span dir="auto">{f.address}</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="card">
            <span className="ic" aria-hidden="true">
              <A3Icon name="info" />
            </span>
            <h2>{L('What', 'ماذا')}</h2>
            <p>
              <strong>{kindName(L, e.kind)}</strong>
              {year || feastDay ? (
                <>
                  <br />
                  <span className="d">{yearLabel(L, (year || feastDay).rite)}: </span>
                  {year ? (
                    <span dir="auto" lang={year.lang}>
                      {year.text}
                    </span>
                  ) : null}
                  {feastDay ? (
                    <>
                      {year ? L(', ', '، ') : ''}
                      {L(feastDay.en, feastDay.ar)}
                    </>
                  ) : null}
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="card actbar">
          <h2 className="h3">
            {e.d < f.today
              ? L('This event has already taken place', 'جرت هذه المناسبة')
              : L('Save the date', 'احفظ الموعد')}
          </h2>
          <div className="acts">
            {e.d < f.today ? null : (
              <>
                <a className="btn btn-red" href={icsHref(e, t, place, url)} download={icsName(t)}>
                  <A3Icon name="cal" />
                  {L('Add to my calendar', 'أضف إلى رزنامتي')}
                </a>
                <a className="btn btn-soft" href={googleHref(e, t, place, url)} target="_blank" rel="noopener">
                  <A3Icon name="calplus" />
                  {L('Google Calendar', 'رزنامة Google')}
                </a>
              </>
            )}
            <a className="btn btn-soft" href={directionsURL(p, d, f.visit)} target="_blank" rel="noopener">
              <A3Icon name="map" />
              {L('Google Maps', 'خرائط Google')}
            </a>
            <CopyButton url={url} icon="share" label={L('Share this event', 'شارك هذه المناسبة')} />
          </div>
        </div>
      </section>
      {more.length ? (
        <section className="wrap sec" style={{ paddingTop: 0 }} aria-labelledby="ev-more">
          <div className="head">
            <h2 id="ev-more" className="h2">
              {L(`More at ${f.name}`, `المزيد في رعية ${f.name}`)}
            </h2>
            <a className="more" href={c.calendarURL(p.id)}>
              {L('The whole calendar', 'الرزنامة كاملة')}
            </a>
          </div>
          <div className="g3 tints">
            {more.map((x, i) => (
              <EventCard key={(x.id || i) + x.d} e={x} p={p} hrefOf={y => evLink(c, p, y)} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
