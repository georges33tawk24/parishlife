/* A parish's whole public calendar, on a page of its own (design A3): the title and the month at the top
   left, the chosen day beside it, and the way to keep the parish's calendar on the visitor's phone. */
import { ParishCalendar } from '../components/ParishCalendar.jsx';
import { Crumbs } from '../components/a3.jsx';
import { useSite } from '../site.jsx';
import { facts } from './parish-parts.jsx';
import { Follow } from './ParishPage.jsx';

export function CalendarPage({ p, d }) {
  const c = useSite(),
    f = facts(c, p, d),
    { L } = c;
  return (
    <section
      className="wrap cal-page"
      aria-labelledby="pg-title"
      data-doc-title={L(`${f.name} calendar`, `رزنامة رعية ${f.name}`) + ' · ParishLife'}
    >
      <Crumbs
        L={L}
        items={[
          [L('All parishes', 'كل الرعايا'), 'public.html#directory'],
          [f.name, c.profileURL(p.id)],
          [L('Calendar', 'الرزنامة')]
        ]}
      />
      <h1 id="pg-title" className="h2 cal-title">
        {L(`${f.name} calendar`, `رزنامة رعية ${f.name}`)}
      </h1>
      {f.events.length ? null : (
        <p className="empty-note" style={{ marginBottom: 20 }}>
          {L(
            'The parish has not published any events yet. They appear here as soon as the parish office adds them to its calendar.',
            'لم تنشر الرعية أي مناسبات بعد. تظهر هنا فور إضافتها إلى رزنامة مكتب الرعية.'
          )}
        </p>
      )}
      <ParishCalendar
        L={L}
        lang={c.lang}
        events={d.events || []}
        liturgy={d.liturgy}
        place={[f.name, f.town].filter(Boolean).join(', ')}
        link={e => c.eventURL(p.id, e.id)}
        side={
          <a className="btn btn-soft" href={c.profileURL(p.id)} style={{ alignSelf: 'flex-start' }}>
            {L('Back to the parish page', 'العودة إلى صفحة الرعية')}
          </a>
        }
      />
      <Follow p={p} f={f} />
    </section>
  );
}
