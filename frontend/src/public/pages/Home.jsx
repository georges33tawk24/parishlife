/* The public homepage (design A3). Every line comes from the dashboard: the Homepage editor
   (Administration → Homepage), each parish's Website content and public profile, and the events and
   announcements parishes publish. Empty sections say what a parish office can publish, rather than
   filling the page with placeholders.
   Main parts: Hero, Times (one parish's Mass times, and the Masses still to come today across every
   parish), Tasks, Week, Photos, Requests (with Picker, which parish a request goes to), Directory
   (search, town, rite, near me, the map), News, Stories, Verse. */
import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { LebanonMap, locate } from '../components/LebanonMap.jsx';
import { icsHref, icsName, kindName, beirutNow } from '../components/ParishCalendar.jsx';
import { find } from '../../lib/search.js';
import { trackAction } from '../../lib/beacon.js';
import { HOME_DEFAULTS } from '../../lib/site-defaults.js';
import { observanceOn, nearbyParishes } from '../api-data.js';
import { useSite, Lines, noun, counted, digits, words, either, plain, clip, initialOf, still } from '../site.jsx';
import { A3Icon, Select } from '../components/a3.jsx';

const isoDay = date =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const loc = c => (c.lang === 'ar' ? 'ar-LB' : 'en-GB');
const place = (c, p) => [c.parishName(p), c.townName(p)].filter(Boolean).join(c.L(', ', '، '));
const titleOf = (c, e) => c.pair(e, 'title', 'titleAr') || kindName(c.L, e.kind);
const eventHref = (c, e) => (e.id ? c.eventURL(e.parish.id, e.id) : c.calendarURL(e.parish.id));

/* The seven days ahead and every dated event of every parish. */
function weekEvents(c) {
  const today = new Date(c.localToday() + 'T12:00:00');
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return isoDay(d);
  });
  const all = c.directory
    .flatMap(p => (c.details.get(p.id)?.events || []).map(e => ({ ...e, parish: p })))
    .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.d || ''))
    .sort((a, b) => (a.d + (a.t || '')).localeCompare(b.d + (b.t || '')));
  return { days, all, inWeek: all.filter(e => e.d >= days[0] && e.d <= days[6]) };
}

/* The request kinds a visitor can choose on the homepage (the public request form's kinds). */
const KINDS = [
  ['baptism', 'Baptism', 'المعمودية'],
  ['communion', 'First Communion', 'المناولة الأولى'],
  ['confirmation', 'Confirmation', 'الميرون'],
  ['marriage', 'Marriage', 'الإكليل'],
  ['funeral', 'Funeral', 'الجنّاز'],
  ['certificate', 'Certificate', 'شهادة'],
  ['booking', 'Book a hall', 'حجز قاعة'],
  ['appointment', 'Appointment', 'موعد مع المكتب'],
  ['ministry', 'Join a ministry', 'الانضمام إلى خدمة'],
  ['custom', 'Something else', 'طلب آخر']
];

export function Home() {
  const c = useSite(),
    { site } = c,
    on = key => site?.sections?.[key] !== false;
  const picker = useRef(null);
  const [asking, setAsking] = useState('');
  const open = c.directory.filter(p => c.details.get(p.id)?.publicRequests !== false);
  /* A request chosen on the homepage asks which parish, when there is more than one. */
  const ask = (kind, event) => {
    if (open.length < 2 || typeof HTMLDialogElement === 'undefined') return;
    event.preventDefault();
    setAsking(kind);
    picker.current.open();
  };
  return (
    <div className="home">
      <Hero />
      {on('times') ? <Times /> : null}
      <Tasks />
      {on('week') ? <Week /> : null}
      <Photos />
      {on('requests') ? <Requests open={open} onAsk={ask} /> : null}
      {on('map') ? <Directory /> : null}
      {on('news') ? <News /> : null}
      {on('stories') ? <Stories /> : null}
      {on('verse') ? <Verse /> : null}
      <Picker ref={picker} kind={asking} open={open} />
    </div>
  );
}

/* ---------- hero: a photograph, the title, two actions and three numbers ---------- */
function Hero() {
  const c = useSite(),
    { L, site } = c;
  const note = site?.announcement,
    text = note && either(c, note.text),
    detail = note && either(c, note.detail),
    label = note && either(c, note.linkLabel);
  const feast = observanceOn(c.liturgy, c.localToday());
  const today = new Intl.DateTimeFormat(loc(c), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());
  const towns = new Set(c.directory.map(p => (p.town || p.townAr || '').trim().toLowerCase()).filter(Boolean)).size;
  const week = weekEvents(c).inWeek.length;
  const dioceses = new Set(c.directory.map(p => p.diocese).filter(Boolean)).size;
  const stats = [[c.directory.length, 'parish'], [towns, 'town'], week ? [week, 'celebration'] : [dioceses, 'diocese']];
  return (
    <section className="photo-hero img-interior dark home-hero" id="top" aria-labelledby="hero-title">
      <div className="shade" aria-hidden="true"></div>
      <div className="wrap home-hero-inner">
        <div className="home-hero-copy">
          {text ? (
            <p className="hero-note">
              <span {...text.attrs}>{text.text}</span>
              {detail ? <span {...detail.attrs}> {clip(detail.text, 240)}</span> : null}
              {note.link ? (
                <>
                  {' '}
                  <a href={note.link} {...(label?.attrs || {})}>
                    {label?.text || L('Read more', 'اقرأ المزيد')}
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
          <p className="kick">
            {feast ? L(`Today: ${feast.en}`, `اليوم: ${feast.ar}`) : L(`Today is ${today}`, `اليوم ${today}`)}
          </p>
          <h1 className="h1" id="hero-title">
            {words(c, site?.hero?.title, HOME_DEFAULTS.hero.title)}
          </h1>
          <p className="hl">{words(c, site?.hero?.subtitle, HOME_DEFAULTS.hero.subtitle)}</p>
          <div className="acts">
            <a href="#directory" className="btn btn-red">
              {L('Find your parish', 'ابحث عن رعيتك')}
            </a>
            <a href="#times" className="btn btn-ghost">
              {L('See Mass times', 'مواعيد القداديس')}
            </a>
          </div>
        </div>
        <dl className="hero-stats" aria-label={L('ParishLife in numbers', 'ParishLife بالأرقام')}>
          {stats.map(([n, key]) => (
            <div key={key}>
              <dt>{noun(c, n, key)}</dt>
              <dd className="time">{c.number(n)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ---------- Mass times: one parish's published times, and what is still to come today ---------- */
function Times() {
  const c = useSite(),
    { L } = c,
    rows = c.directory.filter(p => c.content(c.details.get(p.id), 'massTimes').trim());
  const [chosen, setChosen] = useState(rows[0]?.id || '');
  const p = rows.find(r => r.id === chosen) || rows[0];
  const { all } = weekEvents(c),
    now = beirutNow();
  const today = all.filter(e => e.d === now.d && /^\d{2}:\d{2}$/.test(e.t || '') && e.t >= now.t);
  const masses = today.filter(e => e.kind === 'mass');
  const next = (masses.length ? masses : today).slice(0, 5);
  return (
    <section id="times" className="wrap times-sec" aria-labelledby="times-title">
      <div className="dark walnut panel times-panel">
        <div>
          <h2 id="times-title" className="h2 on-dark">
            {L('Mass times', 'مواعيد القداديس')}
          </h2>
          {p ? (
            <>
              <Select
                id="times-parish"
                className="times-pick"
                label={L('Your parish', 'رعيتك')}
                value={p.id}
                options={rows.map(r => ({ value: r.id, label: c.parishName(r), sub: c.townName(r) }))}
                onChange={setChosen}
              />
              <div className="times-text" dir="auto">
                <Lines text={c.content(c.details.get(p.id), 'massTimes')} />
              </div>
              <p className="cream-2">
                {L(
                  'As the parish office publishes them. On feast days, check the parish page for changes.',
                  'كما ينشرها مكتب الرعية. في الأعياد، راجع صفحة الرعية لمعرفة أي تغيير.'
                )}{' '}
                <a className="on-dark-link" href={c.profileURL(p.id, '#times')}>
                  {L('Open the parish page', 'افتح صفحة الرعية')}
                </a>
              </p>
            </>
          ) : (
            <p className="cream-2" style={{ marginTop: 14 }}>
              {L(
                'No parish has published its Mass times yet. Parish offices add them under Website content in ParishLife, and they appear here and on the parish’s page.',
                'لم تنشر أي رعية مواعيد قداديسها بعد. تضيفها مكاتب الرعايا ضمن محتوى الموقع في ParishLife، فتظهر هنا وفي صفحة الرعية.'
              )}
            </p>
          )}
        </div>
        <div className="times-next">
          <h2 className="h3 on-dark">
            {masses.length || !today.length
              ? L('Next Masses today', 'القداديس التالية اليوم')
              : L('Still to come today', 'لاحقاً اليوم')}
          </h2>
          <p className="cream-2">
            {L('Across every parish on ParishLife, soonest first.', 'في كل رعايا ParishLife، الأقرب أولاً.')}
          </p>
          {next.length ? (
            <ul className="next-list">
              {next.map((e, i) => (
                <li key={(e.id || i) + e.parish.id}>
                  <span className="time">{c.clock(e.t)}</span>
                  <a href={eventHref(c, e)}>
                    <strong>{masses.length ? c.parishName(e.parish) : titleOf(c, e)}</strong>
                    <span>{masses.length ? c.townName(e.parish) : place(c, e.parish)}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="times-none">
              {L('Nothing more has been published for today.', 'لم يُنشر شيء آخر لهذا اليوم.')}
            </p>
          )}
          <div className="acts" style={{ marginTop: 22 }}>
            <a href="#directory" className="btn btn-cream">
              {L('Find a parish', 'ابحث عن رعية')}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- what would you like to do? ---------- */
function Tasks() {
  const { L } = useSite();
  const tasks = [
    [
      '#week',
      'cal',
      L('This week', 'هذا الأسبوع'),
      L('Celebrations and events in the next seven days', 'الاحتفالات والمناسبات في الأيام السبعة المقبلة')
    ],
    [
      '#requests',
      'mail',
      L('Ask the parish office', 'اطلب من مكتب الرعية'),
      L('Baptism, marriage, a certificate, with no account', 'معمودية أو إكليل أو شهادة، من دون حساب')
    ],
    [
      '#directory',
      'pin',
      L('Find a parish', 'ابحث عن رعية'),
      L('Every parish on ParishLife, by name or town', 'كل رعايا ParishLife، بالاسم أو البلدة')
    ],
    [
      'index.html',
      'person',
      L('Members portal', 'بوّابة المؤمنين'),
      L('Sign in to follow your parish and get your documents', 'سجّل الدخول لتتابع رعيتك وتستلم مستنداتك')
    ]
  ];
  return (
    <section className="wrap tasks-sec" aria-labelledby="tasks-title">
      <h2 id="tasks-title" className="h2">
        {L('What would you like to do?', 'ماذا تودّ أن تفعل؟')}
      </h2>
      <div className="tasks tints">
        {tasks.map(([href, icon, t, d]) => (
          <a key={href} className="task card" href={href}>
            <span className="roundel" aria-hidden="true">
              <A3Icon name={icon} />
            </span>
            <span>
              <span className="t">{t}</span>
              <span className="d">{d}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ---------- this week ---------- */
export function EventCard({ e, p = e.parish, hrefOf }) {
  const c = useSite(),
    { L } = c;
  const title = titleOf(c, e),
    d = new Date(e.d + 'T12:00:00'),
    where = place(c, p),
    today = e.d === c.localToday(),
    href = hrefOf ? hrefOf(e) : eventHref(c, { ...e, parish: p });
  return (
    <article className="card ev">
      <div className={'datebox' + (today ? ' today' : '')} aria-hidden="true">
        <span>{today ? L('Today', 'اليوم') : new Intl.DateTimeFormat(loc(c), { weekday: 'long' }).format(d)}</span>
        <b className="time">{digits(c, d.getDate())}</b>
        <span>{new Intl.DateTimeFormat(loc(c), { month: 'long' }).format(d)}</span>
      </div>
      <div className="ev-body">
        {e.t ? <span className="tm time">{c.clock(e.t)}</span> : null}
        <h3 className="t">
          <a href={href} dir="auto">
            {title}
          </a>
        </h3>
        <span className="d">{where}</span>
        <span className="sr-only">
          {new Intl.DateTimeFormat(loc(c), { weekday: 'long', day: 'numeric', month: 'long' }).format(d)}
        </span>
        <a
          className="ev-add"
          href={icsHref(e, title, where, e.id ? c.shareURL(c.eventURL(p.id, e.id)) : '')}
          download={icsName(title)}
        >
          {L('Add to my calendar', 'أضف إلى رزنامتي')}
          <span className="sr-only">: {title}</span>
        </a>
      </div>
    </article>
  );
}

function Week() {
  const c = useSite(),
    { L } = c,
    { days, all, inWeek } = weekEvents(c);
  const [more, setMore] = useState(false);
  const shown = more ? inWeek : inWeek.slice(0, 6);
  const next = !inWeek.length && all.find(e => e.d > days[6]);
  return (
    <section id="week" className="wrap week-sec" aria-labelledby="week-title">
      <div className="head">
        <h2 id="week-title" className="h2">
          {L('This week', 'هذا الأسبوع')}
        </h2>
      </div>
      {inWeek.length ? (
        <>
          <div className="g3 tints">
            {shown.map((e, i) => (
              <EventCard key={(e.id || i) + e.parish.id} e={e} />
            ))}
          </div>
          {inWeek.length > 6 && !more ? (
            <button type="button" className="text-button" style={{ marginTop: 14 }} onClick={() => setMore(true)}>
              {L(`Show all ${inWeek.length} this week`, `عرض الكل هذا الأسبوع (${c.number(inWeek.length)})`)}
            </button>
          ) : null}
        </>
      ) : (
        <>
          <p className="empty-note">
            {L(
              'No celebrations have been published for the next seven days yet.',
              'لم تُنشر احتفالات للأيام السبعة المقبلة بعد.'
            )}
            {next
              ? ''
              : ` ${L('Parish offices add public Masses and events from their parish calendar in ParishLife.', 'تضيف مكاتب الرعايا القداديس والأحداث العامة من رزنامة الرعية في ParishLife.')}`}
          </p>
          {next ? (
            <>
              <h3 className="h3 later">{L('Coming later', 'لاحقاً')}</h3>
              <div className="g3 tints">
                <EventCard e={next} />
              </div>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}

/* ---------- photographs the parishes publish, in a rail that swipes and pages ---------- */
function Photos() {
  const c = useSite(),
    { L } = c;
  const items = useMemo(
    () => c.directory.flatMap(p => c.parishPhotos(c.details.get(p.id)).map((src, i) => ({ src, p, i }))).slice(0, 24),
    [c.directory, c.details]
  );
  const rail = useRef(null);
  const [pages, setPages] = useState(1),
    [page, setPage] = useState(0);
  useEffect(() => {
    const el = rail.current;
    if (!el) return undefined;
    const measure = () => {
      setPages(Math.max(1, Math.ceil((el.scrollWidth - 4) / el.clientWidth)));
      setPage(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    el.addEventListener('scroll', measure, { passive: true });
    return () => {
      watch.disconnect();
      el.removeEventListener('scroll', measure);
    };
  }, [items.length]);
  if (!items.length) return null;
  const go = n => {
    const el = rail.current,
      dir = getComputedStyle(el).direction === 'rtl' ? -1 : 1;
    el.scrollTo({ left: n * el.clientWidth * dir, behavior: still() ? 'auto' : 'smooth' });
  };
  return (
    <section className="wrap media-sec" aria-labelledby="media-title">
      <div className="head">
        <h2 id="media-title" className="h2">
          {L('Photos from the parishes', 'صور من الرعايا')}
        </h2>
      </div>
      <div
        className="rail"
        ref={rail}
        role="region"
        aria-label={L('Photographs, scroll sideways for more', 'الصور، مرّر جانباً للمزيد')}
        tabIndex="0"
      >
        {items.map(({ src, p, i }) => (
          <figure className="tile" key={p.id + i}>
            <a className="media" href={c.profileURL(p.id, '#gallery')}>
              <img src={src} alt="" loading="lazy" decoding="async" />
              <span className="sr-only">{L(`Photographs of ${c.parishName(p)}`, `صور ${c.parishName(p)}`)}</span>
            </a>
            <figcaption>
              <strong>{c.parishName(p)}</strong>
              <span className="d">{c.townName(p)}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      {pages > 1 ? (
        <div className="pager">
          <button
            type="button"
            className="arrow flip"
            aria-label={L('Previous photos', 'الصور السابقة')}
            disabled={page === 0}
            onClick={() => go(page - 1)}
          >
            <A3Icon name="prev" />
          </button>
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              className={'dot' + (i === page ? ' on' : '')}
              aria-label={L(`Page ${i + 1}`, `الصفحة ${c.number(i + 1)}`)}
              aria-current={i === page ? 'true' : undefined}
              onClick={() => go(i)}
            ></button>
          ))}
          <button
            type="button"
            className="arrow flip"
            aria-label={L('Next photos', 'الصور التالية')}
            disabled={page >= pages - 1}
            onClick={() => go(page + 1)}
          >
            <A3Icon name="next" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

/* ---------- requests: a candlelit band with what a visitor can ask for ---------- */
function Requests({ open, onAsk }) {
  const c = useSite(),
    { L } = c;
  if (!open.length) return null;
  const href = kind => (open.length === 1 ? c.requestURL(open[0].id, kind) : '#requests');
  return (
    <section id="requests" className="votive dark img-votive" aria-labelledby="requests-title">
      <div className="votive-shade" aria-hidden="true"></div>
      <div className="wrap votive-inner">
        <h2 id="requests-title" className="votive-title">
          {L('Ask your parish office', 'اطلب من مكتب رعيتك')}
        </h2>
        <p className="votive-lede">
          {L(
            'Choose what you need. No account is needed, and you follow your request with a private link.',
            'اختر ما تحتاجه. لا حاجة إلى حساب، وتتابع طلبك برابط خاص.'
          )}
        </p>
        <nav aria-label={L('Kinds of request', 'أنواع الطلبات')} className="chips">
          {KINDS.map(([kind, en, ar]) => (
            <a key={kind} className="chip" href={href(kind)} data-request={kind} onClick={e => onAsk(kind, e)}>
              {L(en, ar)}
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}

/* Which parish a request from the homepage goes to. */
function Picker({ ref, kind, open }) {
  const c = useSite(),
    { L } = c;
  const dialog = useRef(null),
    input = useRef(null);
  const [q, setQ] = useState('');
  useImperativeHandle(ref, () => ({
    open() {
      setQ('');
      dialog.current.showModal?.();
      input.current?.focus();
    }
  }));
  const label = KINDS.find(k => k[0] === kind);
  const rows = find(q, open, p => [p.name, p.ar, p.town, p.townAr].join(' '), c.normalize).sort((a, b) =>
    c.parishName(a).localeCompare(c.parishName(b), c.lang)
  );
  return (
    <dialog
      className="picker"
      aria-labelledby="picker-title"
      ref={dialog}
      onClick={e => {
        if (e.target === dialog.current) dialog.current.close();
      }}
    >
      <form method="dialog" className="picker-head">
        <h2 id="picker-title" className="h3">
          {kind ? L(`${label ? label[1] : 'Request'}: which parish?`, `${label ? label[2] : 'طلب'}: في أي رعية؟`) : ''}
        </h2>
        <button className="icon-button" aria-label={L('Close', 'إغلاق')}>
          <A3Icon name="close" />
        </button>
      </form>
      <label className="lbl" htmlFor="picker-q">
        {L('Search parishes', 'ابحث عن رعية')}
      </label>
      <input
        id="picker-q"
        className="field"
        type="search"
        placeholder={L('Name or town', 'الاسم أو البلدة')}
        value={q}
        onChange={e => setQ(e.target.value)}
        ref={input}
      />
      <ul className="picker-list">
        {kind ? (
          rows.length ? (
            rows.map(p => (
              <li key={p.id}>
                <a href={c.requestURL(p.id, kind)}>
                  <ParishMark p={p} />
                  <span>
                    <b>{c.parishName(p)}</b>
                    <small className="d">{c.townName(p)}</small>
                  </span>
                </a>
              </li>
            ))
          ) : (
            <li className="d">{L('No parish matches.', 'لا رعية مطابقة.')}</li>
          )
        ) : null}
      </ul>
    </dialog>
  );
}

/* A parish's own photograph, or the first letter of its name. */
export function ParishMark({ p }) {
  const c = useSite(),
    src = c.parishPhotos(c.details.get(p.id))[0];
  return (
    <span className="ini" aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : initialOf(c.parishName(p))}
    </span>
  );
}

/* ---------- find a parish ---------- */
/* Near me: the API measures from the visitor's point (POST /api/public/parishes/nearby) and the
   distances arrive in filters.distances, by parish id. */
function filtered(c, filters = c.filters) {
  const chosen = c.directory.filter(
    p =>
      (!filters.town || p.town === filters.town) &&
      (!filters.rite || c.details.get(p.id)?.parish?.rite === filters.rite)
  );
  return find(filters.q, chosen, p => [p.name, p.ar, p.town, p.townAr, p.diocese].join(' '), c.normalize)
    .map(p => ({ p, d: filters.distances?.[p.id] ?? null }))
    .sort((a, b) =>
      filters.location
        ? (a.d ?? Infinity) - (b.d ?? Infinity) || c.parishName(a.p).localeCompare(c.parishName(b.p), c.lang)
        : c.parishName(a.p).localeCompare(c.parishName(b.p), c.lang)
    );
}

function Directory() {
  const c = useSite(),
    { L, filters, setFilters } = c;
  const map = useRef(null),
    typed = useRef(0);
  const [note, setNote] = useState('');
  const [showMap, setShowMap] = useState(false);
  const rows = filtered(c);
  const uniq = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, c.lang));
  const places = useMemo(() => {
    const out = new Map();
    for (const p of c.directory) {
      const at = locate(p, c.details.get(p.id));
      if (at) out.set(p.id, at);
    }
    return out;
  }, [c.directory, c.details]);
  const items = useMemo(
    () =>
      c.directory
        .filter(p => places.has(p.id))
        .map(p => ({ id: p.id, ...places.get(p.id), name: c.parishName(p), town: c.townName(p) })),
    [places, c.lang]
  );
  const update = change => {
    const next = { ...filters, ...change };
    setFilters(next);
    const url = new URL(location.href);
    for (const key of ['q', 'town']) next[key] ? url.searchParams.set(key, next[key]) : url.searchParams.delete(key);
    history.replaceState(null, '', url);
    setNote('');
    return next;
  };
  const near = () => {
    if (filters.location) {
      setFilters({ ...filters, location: null, distances: null });
      setNote('');
      return;
    }
    if (!navigator.geolocation) {
      setNote(L('Your location is not available in this browser.', 'موقعك غير متاح في هذا المتصفح.'));
      return;
    }
    setNote(L('Finding your location…', 'جارٍ تحديد موقعك…'));
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const distances = await nearbyParishes([pos.coords.latitude, pos.coords.longitude]);
          setFilters(f => ({ ...f, location: [pos.coords.latitude, pos.coords.longitude], distances }));
          setNote(
            Object.keys(distances).length
              ? L('Nearest parishes first. Distances are approximate.', 'الرعايا الأقرب أولاً. المسافات تقريبية.')
              : L(
                  'No parish has a recorded location yet, so none can be sorted by distance.',
                  'لا موقع مسجّلًا لأي رعية بعد، فلا يمكن ترتيبها حسب المسافة.'
                )
          );
        } catch {
          setNote(
            L(
              'Distances could not be worked out just now. Every parish is still listed.',
              'تعذّر حساب المسافات الآن. ما زالت كل الرعايا معروضة.'
            )
          );
        }
      },
      () =>
        setNote(
          L(
            'Your location could not be found. Every parish is still listed.',
            'تعذّر تحديد موقعك. ما زالت كل الرعايا معروضة.'
          )
        ),
      { timeout: 10000, maximumAge: 60000 }
    );
  };
  const card = (item, close) => (
    <>
      <button type="button" className="icon-button card-close" aria-label={L('Close', 'إغلاق')} onClick={close}>
        <A3Icon name="close" />
      </button>
      <div>
        <h3 className="t">{item.name}</h3>
        <p className="d">
          {item.town}
          {item.exact ? null : <small> {L('(shown at the town centre)', '(تظهر في وسط البلدة)')}</small>}
        </p>
        <a className="btn btn-red" href={c.profileURL(item.id)}>
          {L('Open parish page', 'افتح صفحة الرعية')}
        </a>
      </div>
    </>
  );
  const towns = uniq(c.directory.map(p => p.town));
  const rites = uniq(c.directory.map(p => c.details.get(p.id)?.parish?.rite));
  const riteName = v =>
    c.pair(
      c.directory.map(p => c.details.get(p.id)?.parish).find(r => r?.rite === v),
      'rite',
      'riteAr'
    ) || v;
  const status =
    rows.length === c.directory.length
      ? counted(c, rows.length, 'parish')
      : L(
          `${rows.length} of ${c.directory.length} parishes`,
          `${c.number(rows.length)} من أصل ${counted(c, c.directory.length, 'parish')}`
        );
  return (
    <section id="directory" className="dir-sec" aria-labelledby="directory-title">
      <div className="strip" aria-hidden="true"></div>
      <div className="wrap">
        <h2 id="directory-title" className="h2" style={{ marginBottom: 26 }}>
          {L('Find a parish', 'ابحث عن رعية')}
        </h2>
        <form className="dir-filters t-gold" role="search" onSubmit={e => e.preventDefault()}>
          <div>
            <label className="lbl" htmlFor="directory-filter">
              {L('Name or town', 'الاسم أو البلدة')}
            </label>
            <input
              id="directory-filter"
              className="field"
              type="search"
              value={filters.q}
              placeholder={L('For example, Hadath…', 'مثلاً: الحدث…')}
              onChange={e => {
                const value = e.target.value;
                update({ q: value });
                clearTimeout(typed.current);
                typed.current = setTimeout(() => value.trim().length >= 3 && trackAction('search', '', value), 1500);
              }}
            />
          </div>
          <Select
            id="directory-town"
            label={L('Town', 'البلدة')}
            value={filters.town || ''}
            options={[
              { value: '', label: L('All towns', 'كل البلدات') },
              ...towns.map(v => ({ value: v, label: c.townName(c.directory.find(p => p.town === v)) || v }))
            ]}
            onChange={v => update({ town: v })}
          />
          <Select
            id="directory-rite"
            label={L('Rite', 'الطقس')}
            value={filters.rite || ''}
            options={[
              { value: '', label: L('All rites', 'كل الطقوس') },
              ...rites.map(v => ({ value: v, label: riteName(v) }))
            ]}
            onChange={v => update({ rite: v })}
          />
          <div className="dir-tools">
            <button type="button" className="btn btn-soft" aria-pressed={!!filters.location} onClick={near}>
              <A3Icon name="pin" />
              {L('Near me', 'بالقرب مني')}
            </button>
            {items.length ? (
              <button
                type="button"
                className="btn btn-soft"
                aria-pressed={showMap}
                aria-controls="directory-map"
                onClick={() => setShowMap(!showMap)}
              >
                <A3Icon name="map" />
                {L('Map', 'الخريطة')}
              </button>
            ) : null}
          </div>
        </form>
        <div id="directory-map" className="dir-map" hidden={!showMap}>
          {showMap ? (
            <LebanonMap ref={map} L={L} items={items} visible={rows.map(r => r.p.id)} card={card} onChoose={() => {}} />
          ) : null}
        </div>
        <p className="dir-status" role="status">
          {note || status}
        </p>
        <ul className="dir-list">
          {rows.length ? (
            rows.map(({ p, d }) => {
              const detail = c.pair(c.details.get(p.id)?.parish, 'rite', 'riteAr');
              return (
                <li
                  key={p.id}
                  onPointerEnter={() => map.current?.mark(p.id)}
                  onPointerLeave={() => map.current?.mark(null)}
                >
                  <ParishMark p={p} />
                  <span className="dir-name">
                    <strong className="t">{c.parishName(p)}</strong>
                    <span className="d">
                      {[c.townName(p) || L('Town not published', 'البلدة غير منشورة'), detail]
                        .filter(Boolean)
                        .join(L(', ', '، '))}
                      {d !== null ? ` · ${c.number(Math.round(d * 10) / 10)} ${L('km', 'كم')}` : ''}
                    </span>
                  </span>
                  <a href={c.profileURL(p.id)} className="btn btn-soft">
                    {L('Open parish page', 'افتح صفحة الرعية')}
                    <span className="sr-only">: {c.parishName(p)}</span>
                  </a>
                </li>
              );
            })
          ) : (
            <li className="dir-empty">
              <span>{L('No parish matches this search.', 'لا رعية تطابق هذا البحث.')}</span>
              <button type="button" className="text-button" onClick={() => update({ q: '', town: '', rite: '' })}>
                {L('Show every parish', 'عرض كل الرعايا')}
              </button>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}

/* ---------- announcements ---------- */
function News() {
  const c = useSite(),
    { L } = c;
  const posts = c.directory
    .flatMap(p => (c.details.get(p.id)?.posts || []).map(post => ({ ...post, parish: p })))
    .filter(post => post.title || post.body)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 6);
  if (!posts.length) return null;
  return (
    <section className="wrap sec" id="news" aria-labelledby="news-title">
      <div className="head">
        <h2 id="news-title" className="h2">
          {L('From the parishes', 'من الرعايا')}
        </h2>
      </div>
      <div className="g3 tints">
        {posts.map((post, i) => (
          <article key={(post.id || i) + post.parish.id} className="card news-card">
            {c.publishedDate(post.at) ? (
              <time className="d" dateTime={post.at}>
                {c.publishedDate(post.at)}
              </time>
            ) : null}
            <h3 className="t" dir="auto">
              <a href={c.profileURL(post.parish.id, '#updates')}>{post.title || clip(plain(post.body), 80)}</a>
            </h3>
            <p dir="auto">{clip(plain(post.body), 170)}</p>
            <p className="d">{c.parishName(post.parish)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------- stories (Homepage editor) ---------- */
function Stories() {
  const c = useSite(),
    { L } = c,
    list = (c.site?.stories || [])
      .map(s => ({ ...s, t: either(c, s.title), b: either(c, s.body), more: either(c, s.linkLabel) }))
      .filter(s => s.t);
  if (!list.length) return null;
  return (
    <section className="wrap sec" id="stories" aria-labelledby="stories-title">
      <div className="head">
        <h2 id="stories-title" className="h2">
          {L('Stories', 'قصص')}
        </h2>
      </div>
      <div className="g3">
        {list.map((s, i) => (
          <article key={i} className="card story">
            <img src={s.image || 'assets/images/church-light.webp'} alt="" loading="lazy" decoding="async" />
            <div>
              <h3 className="t" {...s.t.attrs}>
                {s.t.text}
              </h3>
              {s.b ? <p {...s.b.attrs}>{s.b.text}</p> : null}
              {s.link ? (
                <a className="more" href={s.link}>
                  <span {...(s.more?.attrs || {})}>{s.more?.text || L('Read more', 'اقرأ المزيد')}</span>
                  <span className="sr-only">: {s.t.text}</span>
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------- the verse ---------- */
function Verse() {
  const { L, lang } = useSite();
  return (
    <section className="verse" aria-labelledby="verse-text">
      <div className="wrap verse-inner">
        <svg className="verse-cross" viewBox="0 0 22 30" fill="currentColor" aria-hidden="true" focusable="false">
          <path d="M9.6 4h2.8v24H9.6zM2.5 11.6h17v2.8h-17z" />
          {[
            [11, 3, 2.1],
            [11, 27.6, 2.1],
            [2.4, 13, 2.1],
            [19.6, 13, 2.1],
            [8.4, 4.4, 1.5],
            [13.6, 4.4, 1.5],
            [3.8, 10.4, 1.5],
            [3.8, 15.6, 1.5],
            [18.2, 10.4, 1.5],
            [18.2, 15.6, 1.5]
          ].map(([cx, cy, r]) => (
            <circle key={cx + ',' + cy} cx={cx} cy={cy} r={r} />
          ))}
        </svg>
        <blockquote>
          <p id="verse-text" className="verse-text">
            {lang === 'ar'
              ? '«فَلْيُضِئْ نُورُكُمْ هكَذَا قُدَّامَ النَّاسِ، لِكَيْ يَرَوْا أَعْمَالَكُمُ الْحَسَنَةَ، وَيُمَجِّدُوا أَبَاكُمُ الَّذِي فِي السَّمَاوَاتِ.»'
              : '“Let your light shine before others, so that they may see your good works and give glory to your Father in heaven.”'}
          </p>
          <footer>
            <cite>{L('Matthew 5:16', 'متّى ٥: ١٦')}</cite>
          </footer>
        </blockquote>
      </div>
    </section>
  );
}
