/* Pieces the parish pages share (design A3): the facts drawn from a parish's published details, the title
   band of the smaller pages, dates and times in Beirut, share and copy buttons, what to bring.
   Main exports: facts, loc, when, relative, title, TIME, abroad, evLink, directionsURL, CopyButton,
   ShareRow, Bring, ParishSub, PlainPage. */
import { useEffect, useState } from 'react';
import { locate } from '../components/LebanonMap.jsx';
import { kindName } from '../components/ParishCalendar.jsx';
import { useSite, Lines, dioceseName, digits } from '../site.jsx';
import { A3Icon, Band } from '../components/a3.jsx';

/* Everything the page says about the parish, read once. */
export function facts(c, p, d) {
  const parish = d.parish || {},
    raw = d.visit || {},
    visit = { ...raw };
  for (const k of [
    'officeHours',
    'confessionTimes',
    'expect',
    'languages',
    'parking',
    'accessibility',
    'sacramentNotes',
    'feastName'
  ])
    visit[k] = c.pair(raw, k, k + 'Ar');
  const name = c.pair(parish, 'name', 'nameAr') || c.parishName(p);
  const other = c.lang === 'ar' ? parish.name || p.name : parish.nameAr || p.ar;
  const town = c.pair(parish, 'town', 'townAr') || c.townName(p);
  const rite = c.pair(parish, 'rite', 'riteAr'),
    diocese = dioceseName(c, p.diocese);
  const today = c.localToday();
  const events = (d.events || [])
    .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.d || ''))
    .sort((a, b) => (a.d + (a.t || '')).localeCompare(b.d + (b.t || '')));
  const upcoming = events.filter(e => e.d >= today);
  const photos = c.parishPhotos(d);
  const phone = String(parish.phone || '').replace(/[^\d+]/g, '');
  const address = c.pair(parish, 'address', 'addressAr');
  const at = locate(p, d);
  return {
    name,
    other: other && other !== name ? other : '',
    town,
    rite,
    diocese,
    today,
    events,
    upcoming,
    photos,
    phone,
    address,
    visit,
    at,
    open: d.publicRequests !== false,
    massTimes: c.content(d, 'massTimes').trim(),
    history: c.content(d, 'history').trim(),
    welcome: c.content(d, 'welcome').trim(),
    contact: c.content(d, 'contact').trim(),
    intro: c.content(d, 'sacraments').trim()
  };
}

export const loc = c => (c.lang === 'ar' ? 'ar-LB' : 'en-GB');

export const when = (c, e) => {
  const date = new Date(e.d + 'T12:00:00'),
    day = new Intl.DateTimeFormat(loc(c), { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  return e.t ? `${day}${c.L(', ', '، ')}${c.clock(e.t) || digits(c, e.t)}` : day;
};

export function relative(c, e) {
  const days = Math.round((new Date(e.d + 'T12:00:00') - new Date(c.localToday() + 'T12:00:00')) / 86400000);
  return days > 60
    ? ''
    : digits(c, new Intl.RelativeTimeFormat(c.lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' }).format(days, 'day'));
}

export const title = (c, e) => (c.lang === 'ar' ? e.titleAr || e.title : e.title || e.titleAr) || kindName(c.L, e.kind);

export const TIME = /^\d{2}:\d{2}$/;

export const abroad = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone !== 'Asia/Beirut';
  } catch {
    return false;
  }
};

export const evLink = (c, p, e) => (e?.id ? c.eventURL(p.id, e.id) : c.calendarURL(p.id));

export const directionsURL = (p, d, v) =>
  'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent(
    /^-?\d+(\.\d+)?$/.test(String(v.latitude || '').trim()) && /^-?\d+(\.\d+)?$/.test(String(v.longitude || '').trim())
      ? `${v.latitude},${v.longitude}`
      : [d.parish.name || p.name, d.parish.address, p.town, 'Lebanon'].filter(Boolean).join(' ')
  );

/* Copying a link: the button says so for a moment. */
export function CopyButton({ url, className = 'btn btn-soft', icon = 'link', label, done: doneLabel, ...rest }) {
  const { L } = useSite();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(() => setDone(false), 2200);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <button
      type="button"
      className={className}
      {...rest}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url || location.href);
          setDone(true);
        } catch {
          /* not allowed */
        }
      }}
    >
      {icon ? <A3Icon name={done ? 'check' : icon} /> : null}
      <span aria-live="polite">{done ? doneLabel || L('Link copied', 'نُسخ الرابط') : label}</span>
    </button>
  );
}

/* Share a page: WhatsApp first (how Lebanon shares), copying the link, and the phone's own sheet. */
export function ShareRow({ url, text }) {
  const { L } = useSite(),
    wa = 'https://wa.me/?text=' + encodeURIComponent(text + '\n' + url);
  return (
    <div className="share-row">
      <a className="btn btn-soft" href={wa} target="_blank" rel="noopener">
        <A3Icon name="chat" />
        WhatsApp
      </a>
      <CopyButton url={url} label={L('Copy link', 'انسخ الرابط')} />
      {navigator.share ? (
        <button
          type="button"
          className="btn btn-soft"
          onClick={() => navigator.share({ title: text, url }).catch(() => {})}
        >
          <A3Icon name="share" />
          {L('More', 'المزيد')}
        </button>
      ) : null}
    </div>
  );
}

/* What to bring for a baptism, a wedding or a certificate, as the parish office writes it. */
export function Bring({ f, className = '' }) {
  const { L } = useSite(),
    notes = String(f.visit.sacramentNotes || '').trim();
  if (!notes) return null;
  return (
    <div className={'card t-gold bring ' + className}>
      <span className="ic" aria-hidden="true">
        <A3Icon name="filecheck" />
      </span>
      <div>
        <h3 className="t">{L('Before you ask: what to bring', 'قبل أن تطلب: ما الذي تحضره')}</h3>
        <div dir="auto">
          <Lines text={notes} />
        </div>
      </div>
    </div>
  );
}

/* The parish's other pages (a request, the calendar, an event): its title band, then the page. */
export function ParishSub({ p, f, here, heading, lede, className = '', docTitle, children }) {
  const c = useSite(),
    { L } = c;
  return (
    <div className={'parish-sub ' + className} data-doc-title={docTitle}>
      <Band
        L={L}
        crumbs={[[L('All parishes', 'كل الرعايا'), 'public.html#directory'], [f.name, c.profileURL(p.id)], [here]]}
        title={heading}
        lede={lede}
      />
      {children}
    </div>
  );
}

/* Pages without a parish (For parishes, a page that could not be shown). */
export function PlainPage({ className = '', children }) {
  return <div className={className}>{children}</div>;
}
