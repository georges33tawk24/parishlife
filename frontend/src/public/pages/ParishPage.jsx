/* A parish's public page (design A3): its photograph with the next Mass beside the name, a bar of what is
   on the page, then About (its words, four coloured facts, its clergy), Mass times on a walnut panel,
   Events, Ministries, a candlelit band of requests, News beside its photographs, Visit, and the parishes
   nearby. A section the parish has not published stays out rather than fill the page with placeholders.
   Main parts: ParishPage, Hero, OnPage, About, Times, Events, Ministries, Requests, NewsAndPhotos,
   Lightbox, Visit, Nearby. */
import { useEffect, useRef, useState } from 'react';
import { locate, projection } from '../components/LebanonMap.jsx';
import { beirutNow as beirut } from '../components/ParishCalendar.jsx';
import { safeRichText } from '../../lib/rich-text.js';
import { useSite, Lines, Paragraphs, digits } from '../site.jsx';
import { A3Icon, Crumbs } from '../components/a3.jsx';
import { EventCard, ParishMark } from './Home.jsx';
import { Bring, CopyButton, TIME, abroad, directionsURL, evLink, facts, loc, title } from './parish-parts.jsx';

const KM = projection.ky / 111.2; // map units per kilometre, north to south

/* "A Maronite parish in Hadath." Arabic adjectives agree with رعية. */
function plainLede(c, f) {
  if (c.lang === 'ar') {
    const adj = f.rite && /^\S+ي$/.test(f.rite) ? f.rite + 'ة' : '';
    return `رعية${adj ? ' ' + adj : ''}${f.town ? ' في ' + f.town : ''}${f.rite && !adj ? ` (${f.rite})` : ''}`;
  }
  const a = f.rite ? (/^[aeiou]/i.test(f.rite) ? 'An ' : 'A ') + f.rite + ' parish' : 'A parish';
  return `${a}${f.town ? ' in ' + f.town : ''}`;
}

const minutes = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);

const addDays = (key, n) => {
  const d = new Date(key + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};

function nextMass(f) {
  const now = beirut();
  return (
    f.upcoming.find(
      e => e.kind === 'mass' && (e.d > now.d || (e.d === now.d && (!TIME.test(e.t || '') || e.t >= now.t)))
    ) || null
  );
}

/* "Today, 6:00 pm" and "in 2 hours"; "Tomorrow, 8:00 am"; "Sunday 2 November, 10:30". */
function massWhen(c, e) {
  const { L } = c,
    now = beirut(),
    at = c.clock(e.t);
  const day =
    e.d === now.d
      ? L('Today', 'اليوم')
      : e.d === addDays(now.d, 1)
        ? L('Tomorrow', 'غداً')
        : new Intl.DateTimeFormat(loc(c), { weekday: 'long', day: 'numeric', month: 'long' }).format(
            new Date(e.d + 'T12:00:00')
          );
  let soon = '';
  if (e.d === now.d && at) {
    const left = minutes(e.t) - minutes(now.t),
      rtf = new Intl.RelativeTimeFormat(c.lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
    soon =
      left < 1
        ? L('starting now', 'يبدأ الآن')
        : left < 60
          ? rtf.format(left, 'minute')
          : rtf.format(Math.round(left / 60), 'hour');
  }
  return { when: at ? `${day}${L(', ', '، ')}${at}` : day, soon: soon && digits(c, soon) };
}

/* The parish's feast: its name, the next date it falls on, and how far away that is. */
function feast(c, f) {
  const md = String(f.visit.feastDate || '');
  if (!/^\d{2}-\d{2}$/.test(md)) return null;
  const today = beirut().d,
    year = +today.slice(0, 4),
    date = `${year}-${md}` >= today ? `${year}-${md}` : `${year + 1}-${md}`;
  return {
    name: String(f.visit.feastName || '').trim() || c.L('The parish feast', 'عيد الرعية'),
    date,
    days: Math.round((new Date(date + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000),
    day: new Intl.DateTimeFormat(loc(c), { day: 'numeric', month: 'long' }).format(new Date(date + 'T12:00:00'))
  };
}

const https = value => (/^https:\/\/[^\s]+$/.test(String(value || '').trim()) ? String(value).trim() : '');

/* The request kinds a visitor can choose (the public request form's kinds). */
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

export function ParishPage({ p, d }) {
  const c = useSite(),
    f = facts(c, p, d),
    { L } = c;
  const [photo, setPhoto] = useState(-1);
  const posts = (d.posts || []).some(x => x.title || x.body);
  const sections = [
    ['about', L('About', 'عن الرعية'), <About key="about" p={p} d={d} f={f} />],
    ['times', L('Mass times', 'القداديس'), hasTimes(f) && <Times key="times" f={f} />],
    ['calendar', L('Events', 'المناسبات'), <Events key="calendar" p={p} f={f} />],
    [
      'ministries',
      L('Ministries', 'الخدمات'),
      (d.ministries || []).length ? <Ministries key="ministries" p={p} d={d} /> : null
    ],
    ['sacraments', L('Requests', 'الطلبات'), f.open && <Requests key="sacraments" p={p} f={f} />],
    [
      posts ? 'updates' : 'gallery',
      posts ? L('News', 'الأخبار') : L('Photos', 'الصور'),
      (posts || f.photos.length >= 2) && <NewsAndPhotos key="updates" d={d} f={f} onOpen={setPhoto} />
    ],
    ['contact', L('Visit', 'الزيارة'), <Visit key="contact" p={p} d={d} f={f} />]
  ].filter(s => s[2]);
  return (
    <div className="parish">
      <Hero p={p} d={d} f={f} />
      <OnPage sections={sections} />
      {sections.map(s => s[2])}
      <Nearby p={p} f={f} />
      <Lightbox photos={f.photos} at={photo} onClose={() => setPhoto(-1)} onStep={setPhoto} />
    </div>
  );
}

/* ---------- hero ---------- */
function Hero({ p, d, f }) {
  const c = useSite(),
    { L } = c,
    mass = nextMass(f),
    massTime = mass && massWhen(c, mass),
    fe = feast(c, f),
    live = https(f.visit.livestream);
  return (
    <section
      className={'photo-hero on-photo dark ph-hero' + (f.photos[0] ? '' : ' img-interior')}
      style={f.photos[0] ? { backgroundImage: `url("${f.photos[0]}")` } : undefined}
      id="top"
      aria-labelledby="ph-title"
    >
      <div className="shade" aria-hidden="true"></div>
      <div className="wrap" style={{ paddingTop: 14, paddingBottom: 48 }}>
        <Crumbs L={L} items={[[L('All parishes', 'كل الرعايا'), 'public.html#directory'], [f.name]]} />
        <div className="hero-gap ph-hero-row">
          <div className="ph-hero-copy">
            <p className="kick">{plainLede(c, f)}</p>
            <h1 className="h1" id="ph-title">
              {f.name}
            </h1>
            {f.other ? (
              <p className="ph-other" lang={c.lang === 'ar' ? 'en' : 'ar'} dir={c.lang === 'ar' ? 'ltr' : 'rtl'}>
                {f.other}
              </p>
            ) : null}
            {fe && fe.days <= 40 ? (
              <p className="ph-feast">
                <A3Icon name="star" />
                <span>
                  {fe.days === 0 ? (
                    <>
                      {L('Today: ', 'اليوم: ')}
                      <bdi>{fe.name}</bdi>
                    </>
                  ) : (
                    <>
                      <bdi>{fe.name}</bdi>
                      {L(', ', '، ')}
                      {digits(c, fe.day)}
                    </>
                  )}
                </span>
              </p>
            ) : null}
            <p className="hl" dir="auto">
              {f.welcome
                ? clipLines(f.welcome)
                : L(
                    'Mass times, celebrations and a direct line to the parish office.',
                    'مواعيد القداديس والاحتفالات وتواصل مباشر مع مكتب الرعية.'
                  )}
            </p>
            <div className="acts">
              {f.open ? (
                <a className="btn btn-red" href={c.requestURL(p.id, 'custom')}>
                  {L('Ask the parish office', 'اطلب من مكتب الرعية')}
                </a>
              ) : null}
              <a className="btn btn-ghost" href={c.calendarURL(p.id)}>
                <A3Icon name="cal" />
                {L('Events and calendar', 'المناسبات والرزنامة')}
              </a>
              {f.phone ? (
                <a className="btn btn-ghost" href={`tel:${f.phone}`}>
                  <A3Icon name="phone" />
                  <bdi>{d.parish.phone}</bdi>
                </a>
              ) : null}
            </div>
          </div>
          {mass || live ? (
            <aside className="next-box" aria-labelledby="ph-next">
              <h2 id="ph-next" className="kick">
                {L('Next Mass', 'القداس التالي')}
              </h2>
              {mass ? (
                <>
                  <p className="next-t time">{massTime.when}</p>
                  <p className="next-sub">
                    <a href={evLink(c, p, mass)} dir="auto">
                      {title(c, mass)}
                    </a>
                    {massTime.soon ? `${L(', ', '، ')}${massTime.soon}` : ''}
                    {abroad() && TIME.test(mass.t || '') ? L(', Beirut time', '، بتوقيت بيروت') : ''}
                  </p>
                </>
              ) : (
                <p className="next-sub">
                  {L('No Mass is published for the coming days.', 'لا قداس منشوراً للأيام المقبلة.')}
                </p>
              )}
              {live ? (
                <a
                  className="btn btn-cream btn-wide"
                  href={live}
                  target="_blank"
                  rel="noopener"
                  data-track="livestream"
                >
                  <A3Icon name="play" />
                  {L('Watch Mass live', 'شاهد القداس مباشرة')}
                </a>
              ) : null}
            </aside>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* The parish's first words, kept to a couple of lines in the hero. */
const clipLines = text => {
  const first = String(text).split(/\n{2,}/)[0];
  return first.length > 260 ? first.slice(0, 260).replace(/\s+\S*$/, '') + '…' : first;
};

/* ---------- what is on the page ---------- */
function OnPage({ sections }) {
  const { L } = useSite();
  return (
    <nav className="onpage" aria-label={L('On this page', 'في هذه الصفحة')}>
      <div className="wrap">
        {sections.map(([id, label]) => (
          <a key={id} href={'#' + id}>
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

/* ---------- about ---------- */
function About({ p, d, f }) {
  const c = useSite(),
    { L } = c,
    fe = feast(c, f),
    clergy = d.clergy || [];
  const tiles = [
    ['pin', L('Town', 'البلدة'), f.town],
    ['cross', L('Rite', 'الطقس'), f.rite],
    ['church', L('Diocese', 'الأبرشية'), f.diocese],
    [
      'star',
      L('Feast day', 'عيد الرعية'),
      fe && `${String(f.visit.feastName || '').trim() ? fe.name + L(', ', '، ') : ''}${digits(c, fe.day)}`
    ]
  ].filter(t => t[2]);
  const text = f.history || f.welcome;
  return (
    <section className="wrap sec" id="about" aria-labelledby="about-title">
      <div className="head" style={{ alignItems: 'center' }}>
        <h2 id="about-title" className="h2">
          {L(`About ${f.name}`, `عن رعية ${f.name}`)}
        </h2>
        <CopyButton
          url={c.shareURL(c.profileURL(p.id))}
          icon="share"
          label={L('Share this parish', 'شارك صفحة الرعية')}
        />
      </div>
      {text ? (
        <div className="body-text" dir="auto">
          <Paragraphs text={text} />
        </div>
      ) : (
        <p className="body-text d">
          {L(
            'The parish office has not published the parish’s story yet. Its Mass times, news and calendar appear here as soon as they are shared.',
            'لم ينشر مكتب الرعية حكايتها بعد. تظهر هنا مواعيد القداديس والأخبار والرزنامة فور نشرها.'
          )}
        </p>
      )}
      {tiles.length ? (
        <ul className="g4 tints infos">
          {tiles.map(([icon, label, value]) => (
            <li key={icon} className="card info">
              <span className="ic" aria-hidden="true">
                <A3Icon name={icon} />
              </span>
              <span className="lab">{label}</span>
              <strong>{value}</strong>
            </li>
          ))}
        </ul>
      ) : null}
      {clergy.length ? (
        <>
          <h3 className="h3" style={{ marginTop: 36 }}>
            {L('Clergy', 'الإكليروس')}
          </h3>
          <div className="g3" style={{ marginTop: 14 }}>
            {clergy.map((m, i) => (
              <div key={i} className="card person">
                <span className="ini" aria-hidden="true">
                  <A3Icon name="person" />
                </span>
                <span>
                  <strong>{m.name}</strong>
                  <span className="d" style={{ display: 'block' }}>
                    {m.role === 'ParishPriest'
                      ? L('Parish priest', 'كاهن الرعية')
                      : m.role === 'Priest'
                        ? L('Priest', 'كاهن')
                        : m.role || ''}
                  </span>
                </span>
              </div>
            ))}
            {f.open ? (
              <a className="card person" href={c.requestURL(p.id, 'appointment')}>
                <span className="ic t-rose" aria-hidden="true">
                  <A3Icon name="mail" />
                </span>
                <span>
                  <strong className="more">{L('Write to the clergy', 'راسل الكهنة')}</strong>
                  <span className="d" style={{ display: 'block' }}>
                    {L('Through the parish office', 'عبر مكتب الرعية')}
                  </span>
                </span>
              </a>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

/* ---------- Mass times ---------- */
const VISIT_ROWS = [
  ['confessionTimes', ['Confession', 'الاعتراف']],
  ['officeHours', ['Parish office', 'مكتب الرعية']]
];

const hasTimes = f =>
  f.massTimes ||
  f.upcoming.some(e => e.kind === 'mass' && e.d < addDays(f.today, 7)) ||
  VISIT_ROWS.some(([k]) => String(f.visit[k] || '').trim()) ||
  https(f.visit.livestream);

function Times({ f }) {
  const c = useSite(),
    { L } = c,
    masses = f.upcoming.filter(e => e.kind === 'mass' && e.d < addDays(f.today, 7));
  const days = [...new Set(masses.map(e => e.d))];
  const visitRows = VISIT_ROWS.filter(([k]) => String(f.visit[k] || '').trim()),
    live = https(f.visit.livestream);
  return (
    <section className="wrap" id="times" aria-labelledby="times-title">
      <div className="walnut dark panel cols">
        <div>
          <h2 id="times-title" className="h2 on-dark">
            {L('Mass times', 'مواعيد القداديس')}
          </h2>
          <p className="cream-2">
            {L(
              'As the parish office publishes them. On feast days, the calendar shows any change.',
              'كما ينشرها مكتب الرعية. في الأعياد تظهر أي تغييرات في الرزنامة.'
            )}
          </p>
          {f.massTimes ? (
            <div className="times-text" dir="auto">
              <Lines text={f.massTimes} />
            </div>
          ) : null}
          {days.length ? (
            <>
              <h3 className="h3 on-dark" style={{ marginTop: 28, fontSize: '1.2em' }}>
                {L('Masses in the next seven days', 'القداديس في الأيام السبعة المقبلة')}
              </h3>
              <dl className="rows time">
                {days.map(day => (
                  <div key={day} className={'row' + (day === f.today ? ' now' : '')}>
                    <dt>
                      {day === f.today ? L('Today, ', 'اليوم، ') : ''}
                      {new Intl.DateTimeFormat(loc(c), { weekday: 'long', day: 'numeric' }).format(
                        new Date(day + 'T12:00:00')
                      )}
                    </dt>
                    <dd>
                      {masses
                        .filter(e => e.d === day)
                        .map(e => c.clock(e.t))
                        .filter(Boolean)
                        .join(L(', ', '، '))}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
        </div>
        {visitRows.length || live ? (
          <div className="dpanels">
            {live ? (
              <div className="dpanel">
                <h3 className="h3 on-dark">{L('Livestream', 'البث المباشر')}</h3>
                <p>{L('Watch the parish’s Masses online.', 'شاهد قداديس الرعية عبر الإنترنت.')}</p>
                <a className="btn btn-cream" href={live} target="_blank" rel="noopener" data-track="livestream">
                  <A3Icon name="play" />
                  {L('Watch Mass live', 'شاهد القداس مباشرة')}
                </a>
              </div>
            ) : null}
            {visitRows.map(([k, label]) => (
              <div key={k} className="dpanel">
                <h3 className="h3 on-dark">{L(...label)}</h3>
                <p dir="auto">
                  <Lines text={f.visit[k]} />
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- events ---------- */
function Events({ p, f }) {
  const c = useSite(),
    { L } = c,
    next = f.upcoming.slice(0, 3);
  return (
    <section className="wrap sec" id="calendar" aria-labelledby="cal-title">
      <div className="head">
        <h2 id="cal-title" className="h2">
          {L('Events', 'المناسبات')}
        </h2>
        <a className="more" href={c.calendarURL(p.id)}>
          {L('Open the calendar', 'افتح الرزنامة')}
        </a>
      </div>
      {next.length ? (
        <div className="g3 tints">
          {next.map((e, i) => (
            <EventCard key={(e.id || i) + e.d} e={e} p={p} hrefOf={x => evLink(c, p, x)} />
          ))}
        </div>
      ) : (
        <p className="empty-note">
          {f.events.length
            ? L('Nothing is coming up in the parish calendar yet.', 'لا شيء قادم في رزنامة الرعية بعد.')
            : L(
                'The parish has not published any events yet. Masses, feasts and gatherings appear here as soon as the parish office adds them to its calendar.',
                'لم تنشر الرعية أي مناسبات بعد. تظهر القداديس والأعياد واللقاءات هنا فور إضافتها إلى رزنامة مكتب الرعية.'
              )}
        </p>
      )}
      <Follow p={p} f={f} />
    </section>
  );
}

/* Follow the parish: its calendar in the visitor's own (kept up to date), its WhatsApp channel. */
export function Follow({ p, f }) {
  const c = useSite(),
    { L } = c,
    webcal = c.feedURL(p.id, 'webcal:'),
    feed = c.feedURL(p.id),
    whatsapp = https(f.visit.whatsapp);
  if (!feed) return null;
  return (
    <div className="card goldtop follow">
      <div className="follow-copy">
        <h3 className="h3">{L('Never miss a celebration', 'لا تفوّت أيّ احتفال')}</h3>
        <p>
          {L(
            `Subscribe once and every Mass and event ${f.name} publishes appears in your phone’s calendar, and stays up to date.`,
            `اشترك مرّة واحدة فتظهر كلّ القداديس والمناسبات التي تنشرها رعية ${f.name} في رزنامة هاتفك، وتبقى محدّثة.`
          )}
        </p>
      </div>
      <div className="acts" style={{ marginTop: 0 }}>
        <a className="btn btn-red" href={webcal}>
          <A3Icon name="cal" />
          {L('Subscribe in my calendar', 'اشترك في رزنامتي')}
        </a>
        <a
          className="btn btn-soft"
          href={'https://calendar.google.com/calendar/render?cid=' + encodeURIComponent(feed)}
          target="_blank"
          rel="noopener"
        >
          <A3Icon name="calplus" />
          {L('Google Calendar', 'رزنامة Google')}
        </a>
        {whatsapp ? (
          <a className="btn btn-soft" href={whatsapp} target="_blank" rel="noopener" data-track="whatsapp-follow">
            <A3Icon name="chat" />
            {L('Follow on WhatsApp', 'تابع عبر واتساب')}
          </a>
        ) : null}
        <CopyButton
          url={feed}
          label={L('Copy the calendar address', 'انسخ عنوان الرزنامة')}
          done={L('Address copied', 'نُسخ العنوان')}
        />
      </div>
    </div>
  );
}

/* ---------- ministries ---------- */
const MINISTRY_ICONS = ['music', 'people', 'book', 'heart'];
function Ministries({ p, d }) {
  const c = useSite(),
    { L } = c,
    list = d.ministries || [];
  const ask = g => c.requestURL(p.id, 'ministry') + '&ministry=' + encodeURIComponent(g.name);
  return (
    <section className="wrap sec ministries" id="ministries" aria-labelledby="min-title">
      <div className="head">
        <h2 id="min-title" className="h2">
          {L('Ministries', 'الخدمات')}
        </h2>
      </div>
      <div className="g4 tints">
        {list.map((g, i) => {
          const name = c.lang === 'ar' ? g.nameAr || g.name : g.name || g.nameAr;
          return (
            <article key={i} className="card mini">
              <span className="roundel" aria-hidden="true">
                <A3Icon name={MINISTRY_ICONS[i % 4]} />
              </span>
              <h3 className="t" dir="auto">
                {name}
              </h3>
              {g.description ? (
                <p className="d" dir="auto">
                  {g.description}
                </p>
              ) : null}
              <a className="more" href={ask(g)}>
                {L('Ask about joining', 'استفسر عن الانضمام')}
                <span className="sr-only">: {name}</span>
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- requests ---------- */
function Requests({ p, f }) {
  const c = useSite(),
    { L } = c;
  return (
    <section className="votive dark img-votive" id="sacraments" aria-labelledby="ask-title">
      <div className="votive-shade" aria-hidden="true"></div>
      <div className="wrap votive-inner">
        <h2 id="ask-title" className="votive-title">
          {L(`Ask ${f.name}`, `اطلب من رعية ${f.name}`)}
        </h2>
        <p className="votive-lede" dir="auto">
          {f.intro ? (
            <Lines text={f.intro} />
          ) : (
            L(
              'Baptisms, weddings, certificates and more. Send your request straight to the parish office without an account, and follow it with a private link.',
              'معموديات وأكاليل وشهادات وغيرها. أرسل طلبك مباشرة إلى مكتب الرعية من دون حساب، وتابعه برابط خاص.'
            )
          )}
        </p>
        <nav aria-label={L('Kinds of request', 'أنواع الطلبات')} className="chips">
          {KINDS.map(([kind, en, ar]) => (
            <a key={kind} className="chip" href={c.requestURL(p.id, kind)}>
              {L(en, ar)}
            </a>
          ))}
        </nav>
        <Bring f={f} className="votive-bring" />
      </div>
    </section>
  );
}

/* ---------- news and photographs ---------- */
function NewsAndPhotos({ d, f, onOpen }) {
  const c = useSite(),
    { L } = c,
    all = (d.posts || []).filter(x => x.title || x.body),
    mine = all.filter(x => !x.lang || x.lang === c.lang),
    posts = (mine.length ? mine : all).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 4);
  /* a post written in the editor keeps its formatting, made safe; plain text keeps its lines */
  const body = text =>
    /<[a-z][\s\S]*>/i.test(text || '') ? (
      <div className="published-body" dir="auto" dangerouslySetInnerHTML={{ __html: safeRichText(text) }} />
    ) : (
      <div className="published-body" dir="auto">
        <Lines text={text || ''} />
      </div>
    );
  const photos = f.photos.length >= 2;
  return (
    <section
      className="wrap sec"
      id={posts.length ? 'updates' : 'gallery'}
      aria-label={L('News and photographs', 'الأخبار والصور')}
    >
      <div className={posts.length && photos ? 'cols' : ''}>
        {posts.length ? (
          <div>
            <h2 className="h2">{L('From the parish', 'من الرعية')}</h2>
            {posts.map((post, i) => (
              <article key={post.id || i} className="card news-post">
                {c.publishedDate(post.at) ? (
                  <time className="d time" dateTime={post.at}>
                    {c.publishedDate(post.at)}
                  </time>
                ) : null}
                {post.title ? (
                  <h3 className="t" dir="auto">
                    {post.title}
                  </h3>
                ) : null}
                {body(post.body)}
              </article>
            ))}
          </div>
        ) : null}
        {photos ? (
          <div id={posts.length ? 'gallery' : undefined}>
            <h2 className="h2">{L('Photographs', 'صور الرعية')}</h2>
            <ul className="pgrid">
              {f.photos.map((src, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="media"
                    aria-label={L(`Open photograph ${i + 1}`, `افتح الصورة ${c.number(i + 1)}`)}
                    onClick={() => onOpen(i)}
                  >
                    <img src={src} alt="" loading="lazy" decoding="async" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Lightbox({ photos, at, onClose, onStep }) {
  const c = useSite(),
    { L } = c,
    dialog = useRef(null);
  useEffect(() => {
    const box = dialog.current;
    if (!box || typeof box.showModal !== 'function') return;
    if (at >= 0 && !box.open) box.showModal();
    if (at < 0 && box.open) box.close();
  }, [at]);
  const show = i => onStep((i + photos.length) % photos.length);
  const i = Math.max(0, at);
  return (
    <dialog
      className="lightbox"
      aria-label={L('Photographs', 'الصور')}
      ref={dialog}
      onClose={onClose}
      onClick={e => {
        if (e.target === dialog.current) dialog.current.close();
      }}
      onKeyDown={e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft')
          show(i + ((e.key === 'ArrowRight') === (c.lang !== 'ar') ? 1 : -1));
      }}
    >
      <figure>
        <img alt="" src={at >= 0 ? photos[i] : undefined} />
        <figcaption>
          {at >= 0 ? L(`${i + 1} of ${photos.length}`, `${c.number(i + 1)} من ${c.number(photos.length)}`) : ''}
        </figcaption>
      </figure>
      <button
        type="button"
        className="icon-button lb-close"
        aria-label={L('Close', 'إغلاق')}
        onClick={() => dialog.current.close()}
      >
        <A3Icon name="close" />
      </button>
      <button
        type="button"
        className="arrow lb-prev flip"
        aria-label={L('Previous photograph', 'الصورة السابقة')}
        onClick={() => show(i - 1)}
      >
        <A3Icon name="prev" />
      </button>
      <button
        type="button"
        className="arrow lb-next flip"
        aria-label={L('Next photograph', 'الصورة التالية')}
        onClick={() => show(i + 1)}
      >
        <A3Icon name="next" />
      </button>
    </dialog>
  );
}

/* ---------- visit ---------- */
function Visit({ p, d, f }) {
  const c = useSite(),
    { L } = c,
    v = f.visit,
    directions = directionsURL(p, d, v);
  const website = /^https:\/\/[^\s]+$/.test(v.website || '') ? v.website : '';
  const email = /^[^\s@]+@[^\s@]+$/.test(v.email || '') ? v.email : '';
  const rows = [
    f.address && [L('Address', 'العنوان'), f.address],
    f.phone && [
      L('Phone', 'الهاتف'),
      <a href={`tel:${f.phone}`}>
        <bdi>{d.parish.phone}</bdi>
      </a>
    ],
    email && [L('Email', 'البريد الإلكتروني'), <a href={`mailto:${email}`}>{email}</a>],
    website && [
      L('Website', 'الموقع'),
      <a href={website} target="_blank" rel="noopener">
        {website.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')}
      </a>
    ],
    String(v.officeHours || '').trim() && [L('Office hours', 'ساعات المكتب'), <Lines text={v.officeHours} />]
  ].filter(Boolean);
  /* Plan your visit: what a newcomer wonders before coming for the first time. */
  const plan = [
    [L('What to expect', 'ماذا تتوقّع'), v.expect],
    [L('Languages and rite', 'اللغات والطقس'), v.languages],
    [L('Parking', 'ركن السيارة'), v.parking],
    [L('Accessibility', 'إمكانية الوصول'), v.accessibility]
  ].filter(r => String(r[1] || '').trim());
  return (
    <section className="visit-sec" id="contact" aria-labelledby="visit-title">
      <div className="strip" aria-hidden="true"></div>
      <div className="wrap sec cols">
        <div>
          <h2 id="visit-title" className="h2">
            {L(`Visit ${f.name}`, `زيارة رعية ${f.name}`)}
          </h2>
          {f.contact ? (
            <p className="lede" dir="auto">
              <Lines text={f.contact} />
            </p>
          ) : null}
          {rows.length ? (
            <dl className="facts">
              {rows.map(([k, val]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd dir="auto">{val}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="d" style={{ marginTop: 14 }}>
              {L('Contact details have not been published yet.', 'لم تُنشر معلومات التواصل بعد.')}{' '}
              {f.open
                ? L(
                    'You can still reach the parish office through a request.',
                    'يمكنك مع ذلك مراسلة مكتب الرعية عبر طلب.'
                  )
                : ''}
            </p>
          )}
          <div className="acts" style={{ marginTop: 18 }}>
            <a className="btn btn-red" href={directions} target="_blank" rel="noopener">
              <A3Icon name="map" />
              {L('Open in Google Maps', 'افتح في خرائط Google')}
            </a>
            {f.phone ? (
              <a className="btn btn-soft" href={`tel:${f.phone}`}>
                <A3Icon name="phone" />
                {L('Call the parish office', 'اتصل بمكتب الرعية')}
              </a>
            ) : f.open ? (
              <a className="btn btn-soft" href={c.requestURL(p.id, 'appointment')}>
                {L('Ask for an appointment', 'اطلب موعداً')}
              </a>
            ) : null}
          </div>
        </div>
        {plan.length ? (
          <div>
            <h3 className="h3">{L('Plan your visit', 'خطّط لزيارتك')}</h3>
            <dl className="facts">
              {plan.map(([k, val]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd dir="auto">
                    <Lines text={val} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- neighbours ---------- */
function Nearby({ p, f }) {
  const c = useSite(),
    { L } = c,
    others = c.directory.filter(x => x.id !== p.id);
  if (!others.length) return null;
  const rows = others
    .map(x => {
      const at = locate(x, c.details.get(x.id));
      return { x, km: at && f.at ? Math.hypot(at.x - f.at.x, at.y - f.at.y) / KM : null };
    })
    .sort(
      (a, b) =>
        (a.km ?? Infinity) - (b.km ?? Infinity) ||
        (a.x.diocese === p.diocese ? -1 : 0) - (b.x.diocese === p.diocese ? -1 : 0)
    )
    .slice(0, 3);
  return (
    <section className="wrap sec" aria-labelledby="near-title">
      <div className="head">
        <h2 id="near-title" className="h2">
          {L('Parishes nearby', 'رعايا قريبة')}
        </h2>
        <a className="more" href="public.html#directory">
          {L('Every parish', 'كل الرعايا')}
        </a>
      </div>
      <div className="g3 tints">
        {rows.map(({ x, km }) => (
          <a key={x.id} className="card near" href={c.profileURL(x.id)}>
            <ParishMark p={x} />
            <span>
              <span className="t">{c.parishName(x)}</span>
              <span className="d">
                {c.townName(x)}
                {km !== null
                  ? `${L(', ', '، ')}${km < 1 ? L('under 1 km', 'أقل من ١ كم') : L(`about ${c.number(Math.round(km))} km`, `نحو ${c.number(Math.round(km))} كم`)}`
                  : ''}
              </span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
