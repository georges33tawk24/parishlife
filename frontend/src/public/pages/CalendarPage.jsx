/* A parish's whole public calendar, on a page of its own. */
import { ParishCalendar } from '../components/ParishCalendar.jsx';
import { useSite } from '../site.jsx';
import { ParishSub, facts } from './parish-parts.jsx';

export function CalendarPage({ p, d }) {
  const c = useSite(),
    f = facts(c, p, d),
    { L } = c;
  return (
    <ParishSub
      p={p}
      f={f}
      here={L('Calendar', 'الرزنامة')}
      heading={L(`${f.name} calendar`, `رزنامة رعية ${f.name}`)}
      lede={L(
        'Masses, celebrations and gatherings, as the parish office publishes them.',
        'القداديس والاحتفالات واللقاءات، كما ينشرها مكتب الرعية.'
      )}
    >
      <section className="site-wrap ph-calpage" data-reveal>
        {f.events.length ? null : (
          <div className="ph-cal-empty">
            <span className="lamp is-unlit" aria-hidden="true"></span>
            <p>
              {L(
                'The parish has not published any events yet. They appear here as soon as the parish office adds them to its calendar.',
                'لم تنشر الرعية أي مناسبات بعد. تظهر هنا فور إضافتها إلى رزنامة مكتب الرعية.'
              )}
            </p>
          </div>
        )}
        <ParishCalendar
          L={L}
          lang={c.lang}
          events={d.events || []}
          liturgy={d.liturgy}
          place={[f.name, f.town].filter(Boolean).join(', ')}
          link={e => c.eventURL(p.id, e.id)}
        />
      </section>
    </ParishSub>
  );
}
