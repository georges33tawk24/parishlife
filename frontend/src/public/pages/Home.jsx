/* The public homepage. Every line comes from the dashboard: the Homepage editor
   (Administration → Homepage), each parish's Website content and public profile,
   and the events and announcements parishes publish. Empty sections say what a
   parish office can publish, rather than filling the page with placeholders. */
import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Sanctuary, RoseOutline, mosaicTexture } from '../components/Sanctuary.jsx';
import { LebanonMap, locate } from '../components/LebanonMap.jsx';
import { animateHome, stopHomeMotion, scrollToTarget } from '../motion.js';
import { icsHref, icsName, kindName, beirutNow } from '../components/ParishCalendar.jsx';
import { find } from '../../lib/search.js';
import { trackAction } from '../../lib/beacon.js';
import { HOME_DEFAULTS } from '../../lib/site-defaults.js';
import { observanceOn, seasonOn, nearbyParishes } from '../api-data.js';
import {
  useSite,
  Lines,
  Paragraphs,
  paragraphList,
  noun,
  counted,
  digits,
  dioceseName,
  words,
  either,
  plain,
  clip,
  Monogram,
  still,
  yearLabel
} from '../site.jsx';
import { Icon, Glyph, MaroniteCross, Bell } from '../components/icons.jsx';
import { useHeroWatch } from '../components/Chrome.jsx';

const isoDay = date =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');

/* A bell for Mass times: it swings when the section arrives and under the pointer, and rings when
   it is pressed. The sound is made here, from the partials of a cast bronze bell (hum, prime,
   tierce, quint, nominal...), each dying away at its own pace; nothing plays unasked. */
let bellAudio = null;

function ringBell() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  const ctx = (bellAudio ||= new Context()),
    now = ctx.currentTime + 0.02,
    strike = 196;
  const out = ctx.createGain();
  out.gain.value = 0.2;
  out.connect(ctx.destination);
  for (const [ratio, level, fade] of [
    [0.5, 0.55, 5.5],
    [1, 0.9, 4],
    [1.2, 0.5, 3],
    [1.5, 0.32, 2.4],
    [2, 0.4, 2],
    [2.52, 0.22, 1.4],
    [3.01, 0.14, 1],
    [4.07, 0.08, 0.6]
  ]) {
    const tone = ctx.createOscillator(),
      gain = ctx.createGain();
    tone.frequency.value = strike * ratio;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    tone.connect(gain);
    gain.connect(out);
    tone.start(now);
    tone.stop(now + fade + 0.05);
  }
}

function BellButton({ L }) {
  const [ring, setRing] = useState(0);
  const button = useRef(null);
  useLayoutEffect(() => {
    if (!ring) return;
    const el = button.current;
    el.classList.remove('is-ringing');
    void el.offsetWidth;
    el.classList.add('is-ringing');
  }, [ring]);
  return (
    <button
      type="button"
      className="times-mark"
      aria-label={L('Ring the bell', 'اقرع الجرس')}
      ref={button}
      onClick={() => {
        ringBell();
        setRing(n => n + 1);
      }}
    >
      <Bell />
    </button>
  );
}

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

function facts(c) {
  const dioceses = new Set(c.directory.map(p => p.diocese).filter(Boolean)).size;
  const towns = new Set(c.directory.map(p => (p.town || p.townAr || '').trim().toLowerCase()).filter(Boolean)).size;
  return { parishes: c.directory.length, dioceses, towns, week: weekEvents(c).inWeek.length };
}

export function Home() {
  const c = useSite(),
    { site } = c,
    on = key => site?.sections?.[key] !== false;
  const root = useRef(null),
    hero = useRef(null),
    directory = useRef(null),
    picker = useRef(null);
  const [asking, setAsking] = useState('');
  /* The parishes the map can place, by id. */
  const places = useMemo(() => {
    const out = new Map();
    for (const p of c.directory) {
      const at = locate(p, c.details.get(p.id));
      if (at) out.set(p.id, at);
    }
    return out;
  }, [c.directory, c.details]);
  useHeroWatch(hero);
  useLayoutEffect(() => {
    animateHome(root.current);
    return () => stopHomeMotion();
  }, []);
  const open = c.directory.filter(p => c.details.get(p.id)?.publicRequests !== false);
  /* A request chosen on the homepage asks which parish, when there is more than one. */
  const ask = (kind, event) => {
    if (open.length < 2 || typeof HTMLDialogElement === 'undefined') return;
    event.preventDefault();
    setAsking(kind);
    picker.current.open();
  };
  return (
    <div className="home" data-home ref={root}>
      <Hero heroRef={hero} directory={directory} places={places} />
      {on('week') ? <Week /> : null}
      {on('map') ? <Directory controller={directory} places={places} /> : null}
      {on('requests') ? <Requests open={open} onAsk={ask} /> : null}
      {on('times') ? <Times /> : null}
      {on('news') ? <News /> : null}
      {on('stories') ? <Stories /> : null}
      {on('verse') ? <Verse /> : null}
      {on('about') ? <About /> : null}
      {on('join') ? <Join /> : null}
      <Picker ref={picker} kind={asking} open={open} />
    </div>
  );
}

/* ---------- hero ---------- */
function Hero({ heroRef, directory, places }) {
  const c = useSite(),
    { L, site } = c,
    f = facts(c);
  const [tip, setTip] = useState(null);
  const note = site?.announcement,
    text = note && either(c, note.text),
    detail = note && either(c, note.detail),
    label = note && either(c, note.linkLabel);
  const feast = observanceOn(c.liturgy, c.localToday());
  const candles = useMemo(
    () => c.directory.map(p => ({ id: p.id, name: c.parishName(p), town: c.townName(p) })),
    [c.directory, c.lang]
  );
  const stat = (n, key) => (
    <li key={key}>
      <b data-count={n}>{c.number(n)}</b>
      <span>{noun(c, n, key)}</span>
    </li>
  );
  return (
    <section className="hero hero-sanctuary" id="top" data-hero aria-labelledby="hero-title" ref={heroRef}>
      <div className="hero-art" data-scene>
        <Sanctuary
          inscription={L('Gloria in excelsis Deo', 'المجد لله في العُلى')}
          places={candles}
          onTip={setTip}
          words={{
            light: L('Light a candle', 'أضئ شمعة'),
            lit: L('A candle lit for your intention', 'شمعة مضاءة على نيّتك')
          }}
          onPick={id => {
            location.href = c.profileURL(id);
          }}
        />
      </div>
      <div className="hero-shade" aria-hidden="true"></div>
      <div className="site-wrap hero-inner">
        {text ? (
          <p className="hero-note" data-hero-rise>
            <span className="note-mark" aria-hidden="true"></span>
            <span {...text.attrs}>{text.text}</span>
            {detail ? <span {...detail.attrs}>{clip(detail.text, 240)}</span> : null}
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
        <p className="hero-mark" data-hero-rise>
          <MaroniteCross />
          <span>
            {feast ? L(`Today · ${feast.en}`, `اليوم · ${feast.ar}`) : L('The parishes of Lebanon', 'رعايا لبنان')}
          </span>
        </p>
        <h1 className="hero-title" id="hero-title">
          {words(c, site?.hero?.title, HOME_DEFAULTS.hero.title)}
        </h1>
        <p className="hero-lede" data-hero-rise>
          {words(c, site?.hero?.subtitle, HOME_DEFAULTS.hero.subtitle)}
        </p>
        <div className="hero-row">
          <HeroSearch directory={directory} />
          <ul className="hero-facts" data-hero-rise aria-label={L('ParishLife in numbers', 'ParishLife بالأرقام')}>
            {stat(f.parishes, 'parish')}
            {stat(f.dioceses, 'diocese')}
            {f.week ? stat(f.week, 'celebration') : stat(f.towns, 'town')}
          </ul>
        </div>
      </div>
      <p
        className="hero-tip"
        data-hero-tip
        role="status"
        hidden={!tip}
        style={tip ? { left: tip.left + 'px', top: tip.top + 'px' } : undefined}
      >
        {tip?.text}
      </p>
      <a
        className="scroll-cue"
        href="#week"
        data-scroll-cue
        aria-label={L('Scroll to this week', 'انتقل إلى هذا الأسبوع')}
        onClick={e => {
          e.preventDefault();
          scrollToTarget(e.currentTarget.closest('section').nextElementSibling);
        }}
      >
        <span aria-hidden="true"></span>
      </a>
    </section>
  );
}

/* The search in the hero: suggestions of parishes and towns as the visitor types; a town or a
   plain search narrows the directory and goes to it. */
function HeroSearch({ directory }) {
  const c = useSite(),
    { L } = c;
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const towns = useMemo(
    () => [...new Map(c.directory.filter(p => p.town || p.townAr).map(p => [p.town || p.townAr, p])).values()],
    [c.directory]
  );
  const options = useMemo(() => {
    if (!c.normalize(value.trim())) return [];
    const parishes = find(value, c.directory, p => [p.name, p.ar, p.town, p.townAr].join(' '), c.normalize)
      .slice(0, 5)
      .map(p => ({ kind: 'parish', id: p.id, label: c.parishName(p), sub: c.townName(p) }));
    const placesFound = find(value, towns, p => [p.town, p.townAr].join(' '), c.normalize)
      .slice(0, 3)
      .map(p => ({ kind: 'town', town: p.town, label: c.townName(p), sub: L('Town', 'بلدة') }));
    return [...parishes, ...placesFound];
  }, [value, c.directory, towns, c.lang]);
  const shown = open && !!c.normalize(value.trim());
  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const go = filters => {
    close();
    directory.current?.go(filters);
  };
  const pick = o => {
    if (!o) return;
    trackAction('search', o.kind === 'parish' ? o.id : '', value);
    if (o.kind === 'parish') {
      location.href = c.profileURL(o.id);
      return;
    }
    go({ q: '', town: o.town || '' });
  };
  const highlight = i => {
    if (options.length) setActive((i + options.length) % options.length);
  };
  return (
    <form
      className="hero-search"
      role="search"
      data-hero-search
      data-hero-rise
      onSubmit={e => {
        e.preventDefault();
        trackAction('search', '', value);
        go({ q: value.trim(), town: '' });
      }}
    >
      <label className="field-cap" htmlFor="hero-q">
        {L('Find a parish by its name, town or village', 'ابحث عن رعية باسمها أو بلدتها أو قريتها')}
      </label>
      <div className="hero-field">
        <Glyph name="search" />
        <input
          id="hero-q"
          type="search"
          autoComplete="off"
          spellCheck="false"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={shown}
          aria-controls="hero-suggest"
          aria-activedescendant={shown && active >= 0 ? `hero-opt-${active}` : undefined}
          placeholder={L('For example: Hadath', 'مثلاً: الحدث')}
          value={value}
          onChange={e => {
            setValue(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              highlight(active + 1);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              highlight(active - 1);
            } else if (e.key === 'Escape') close();
            else if (e.key === 'Enter' && shown && active >= 0) {
              e.preventDefault();
              pick(options[active]);
            }
          }}
          onBlur={() => setTimeout(close, 120)}
        />
        <button type="submit">{L('Search', 'ابحث')}</button>
      </div>
      <ul
        className="hero-suggest"
        id="hero-suggest"
        role="listbox"
        aria-label={L('Suggestions', 'اقتراحات')}
        hidden={!shown}
        onPointerDown={e => {
          const li = e.target.closest('[data-index]');
          if (li) {
            e.preventDefault();
            pick(options[Number(li.dataset.index)]);
          }
        }}
      >
        {!shown ? null : options.length ? (
          options.map((o, i) => (
            <li
              key={o.kind + (o.id || o.town)}
              role="option"
              id={`hero-opt-${i}`}
              data-index={i}
              aria-selected={i === active}
            >
              {o.kind === 'parish' ? <span className="lamp" aria-hidden="true"></span> : <Glyph name="pin" />}
              <span>
                <b>{o.label}</b>
                <small>{o.sub}</small>
              </span>
            </li>
          ))
        ) : (
          <li className="no-match" role="option" aria-disabled="true">
            {L(
              'No parish or town matches. Press Search to look through the directory.',
              'لا رعية أو بلدة مطابقة. اضغط «ابحث» للبحث في الدليل.'
            )}
          </li>
        )}
      </ul>
      <a className="hero-browse" href="#directory">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 4v15m-6-6 6 6 6-6" />
        </svg>
        {L('Find your parish', 'ابحث عن رعيتك')}
      </a>
    </form>
  );
}

/* ---------- this week ---------- */
/* The seven days as a ribbon (a red lamp marks today, dots mark what is published), and the
   week's celebrations as cards beneath; choosing a day narrows the cards to it. */
function WeekCard({ e, later = false, hidden = false }) {
  const c = useSite(),
    { L } = c,
    loc = c.lang === 'ar' ? 'ar-LB' : 'en-GB';
  const title = c.pair(e, 'title', 'titleAr') || kindName(L, e.kind),
    d = new Date(e.d + 'T12:00:00'),
    place = [c.parishName(e.parish), c.townName(e.parish)].filter(Boolean).join(L(', ', '، '));
  return (
    <li
      className={`wk-ev k-${e.kind || 'event'}`}
      data-day={e.d}
      data-parish={e.parish.id}
      data-reveal-item
      hidden={hidden}
    >
      <a className="wk-ev-link" href={e.id ? c.eventURL(e.parish.id, e.id) : c.calendarURL(e.parish.id)}>
        <span className="wk-date" aria-hidden="true">
          <small>{new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(d)}</small>
          <b>{digits(c, d.getDate())}</b>
          <small>{new Intl.DateTimeFormat(loc, { month: 'short' }).format(d)}</small>
        </span>
        <span className="wk-body">
          {later ? <span className="wk-later">{L('Coming later', 'لاحقاً')}</span> : null}
          <span className="wk-meta">
            {e.t ? <time>{digits(c, e.t)}</time> : null}
            <span className="wk-kind">{kindName(L, e.kind)}</span>
          </span>
          <strong dir="auto">{title}</strong>
          <span className="wk-where">
            <Glyph name="pin" />
            {place}
          </span>
          <span className="sr-only">
            {new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(d)}
          </span>
        </span>
      </a>
      <a
        className="wk-add"
        href={icsHref(e, title, place, e.id ? c.shareURL(c.eventURL(e.parish.id, e.id)) : '')}
        download={icsName(title)}
        aria-label={L(`Add ${title} to my calendar`, `أضف «${title}» إلى رزنامتي`)}
        title={L('Add to my calendar', 'أضف إلى رزنامتي')}
      >
        <Glyph name="add" />
      </a>
    </li>
  );
}

function Week() {
  const c = useSite(),
    { L } = c,
    { days, all, inWeek } = weekEvents(c),
    loc = c.lang === 'ar' ? 'ar-LB' : 'en-GB';
  const [day, setDay] = useState('');
  const list = useRef(null),
    first = useRef(true);
  const date = d => new Date(d + 'T12:00:00');
  const now = seasonOn(c.liturgy, days[0], c.lang);
  /* the cards of a newly chosen day settle into place */
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    list.current?.querySelectorAll('.wk-ev:not([hidden])').forEach(card =>
      card.animate?.(
        [
          { opacity: 0, transform: 'translateY(10px)' },
          { opacity: 1, transform: 'none' }
        ],
        { duration: 450, easing: 'cubic-bezier(.16,1,.3,1)' }
      )
    );
  }, [day]);
  const head = (
    <>
      <header className="sec-head" data-reveal>
        <h2 id="week-title">{L('This week', 'هذا الأسبوع')}</h2>
        <p>
          {L(
            'Masses and celebrations the parishes have published for the next seven days.',
            'القداديس والاحتفالات التي نشرتها الرعايا للأيام السبعة المقبلة.'
          )}
        </p>
      </header>
      {now ? (
        <p className="wk-season" data-reveal>
          <MaroniteCross />
          <span>{yearLabel(L, now.rite)}</span>
          <b dir="auto" lang={now.lang}>
            {now.text}
          </b>
        </p>
      ) : null}
    </>
  );
  const Tag = inWeek.length ? 'button' : 'span'; // with nothing to filter, the ribbon is only a picture of the week
  const ribbon = (
    <ol className="wk-days" aria-label={L('The next seven days', 'الأيام السبعة المقبلة')}>
      {days.map((d, i) => {
        const n = inWeek.filter(e => e.d === d).length,
          feast = observanceOn(c.liturgy, d);
        const props =
          Tag === 'button'
            ? { type: 'button', 'aria-pressed': day === d, onClick: () => setDay(day === d ? '' : d) }
            : {};
        return (
          <li key={d}>
            <Tag
              {...props}
              className={
                'wk-day' +
                (i === 0 ? ' is-today' : '') +
                (date(d).getDay() === 0 ? ' is-sunday' : '') +
                (feast ? ' is-feast' : '') +
                (n ? '' : ' is-quiet')
              }
              data-wk-day={d}
            >
              <span className="wk-dow">{new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(date(d))}</span>
              <b>{digits(c, date(d).getDate())}</b>
              {feast ? <span className="wk-feast">{L(feast.en, feast.ar)}</span> : null}
              <span className="wk-dots" aria-hidden="true">
                {i === 0 ? <span className="lamp"></span> : null}
                {Array.from({ length: Math.min(n, 3) }, (_, k) => (
                  <i key={k}></i>
                ))}
              </span>
              <span className="sr-only">
                {i === 0 ? L('Today, ', 'اليوم، ') : ''}
                {n ? L(`${n} published`, `منشور: ${c.number(n)}`) : L('nothing published', 'لا شيء منشور')}
              </span>
            </Tag>
          </li>
        );
      })}
    </ol>
  );
  if (!inWeek.length) {
    const next = all.find(e => e.d > days[6]);
    return (
      <section className="week" id="week" aria-labelledby="week-title">
        <div className="site-wrap">
          {head}
          <Tonight all={all} />
          <div className="wk" data-reveal>
            {ribbon}
            <div className="wk-quiet">
              <span className="lamp is-unlit" aria-hidden="true"></span>
              <p>
                {L(
                  'No celebrations have been published for the next seven days yet.',
                  'لم تُنشر احتفالات للأيام السبعة المقبلة بعد.'
                )}
                {next
                  ? ''
                  : ` ${L('Parish offices add public Masses and events from their parish calendar in ParishLife.', 'تضيف مكاتب الرعايا القداديس والأحداث العامة من رزنامة الرعية في ParishLife.')}`}
              </p>
            </div>
            {next ? (
              <ul className="wk-list">
                <WeekCard e={next} later />
              </ul>
            ) : null}
          </div>
        </div>
      </section>
    );
  }
  const shown = inWeek.filter(e => !day || e.d === day).length;
  const long =
    day &&
    new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(
      new Date(day + 'T12:00:00')
    );
  return (
    <section className="week" id="week" aria-labelledby="week-title">
      <div className="site-wrap">
        {head}
        <Tonight all={all} />
        <div className="wk" data-wk>
          {ribbon}
          <ul className="wk-list" data-wk-list ref={list}>
            {inWeek.map((e, i) => (
              <WeekCard key={(e.id || i) + e.parish.id} e={e} hidden={!!day && e.d !== day} />
            ))}
          </ul>
          <p className="wk-none" data-wk-none hidden={shown > 0}>
            {shown ? '' : c.L(`Nothing has been published for ${long}.`, `لم يُنشر شيء ليوم ${long}.`)}
          </p>
        </div>
      </div>
    </section>
  );
}

/* Still to come today, across every parish: the Masses and celebrations that have not started
   yet by the clock in Beirut, soonest first. Nothing is shown once the day's last one has begun. */
function Tonight({ all }) {
  const c = useSite(),
    { L } = c,
    now = beirutNow();
  const left = all.filter(e => e.d === now.d && /^\d{2}:\d{2}$/.test(e.t || '') && e.t >= now.t).slice(0, 8);
  if (!left.length) return null;
  return (
    <div className="wk-tonight" data-reveal>
      <h3>
        <span className="lamp" aria-hidden="true"></span>
        {L('Still to come today', 'لاحقاً اليوم')}
      </h3>
      <ul>
        {left.map((e, i) => (
          <li key={(e.id || i) + e.parish.id}>
            <a href={e.id ? c.eventURL(e.parish.id, e.id) : c.calendarURL(e.parish.id)}>
              <time>{digits(c, e.t)}</time>
              <span>
                <b dir="auto">{c.pair(e, 'title', 'titleAr') || kindName(L, e.kind)}</b>
                <small>{[c.parishName(e.parish), c.townName(e.parish)].filter(Boolean).join(L(', ', '، '))}</small>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- directory ---------- */
/* Near me: the API measures from the visitor's point (POST /api/public/parishes/nearby) and the
   distances arrive in filters.distances, by parish id. */
function filtered(c, filters = c.filters) {
  const chosen = c.directory.filter(
    p =>
      (!filters.town || p.town === filters.town) &&
      (!filters.diocese || p.diocese === filters.diocese) &&
      (!filters.rite || c.details.get(p.id)?.parish?.rite === filters.rite)
  );
  return find(filters.q, chosen, p => [p.name, p.ar, p.town, p.townAr, p.diocese].join(' '), c.normalize)
    .map(p => ({ p, d: filters.distances?.[p.id] ?? null }))
    .sort((a, b) =>
      filters.location
        ? (a.d ?? Infinity) - (b.d ?? Infinity) || c.parishName(a.p).localeCompare(c.parishName(b.p), c.lang)
        : (filters.sort === 'town' ? c.townName(a.p).localeCompare(c.townName(b.p), c.lang) : 0) ||
          c.parishName(a.p).localeCompare(c.parishName(b.p), c.lang)
    );
}

export function Thumb({ p, photo }) {
  const c = useSite(),
    src = photo ?? c.parishPhotos(c.details.get(p.id))[0];
  return (
    <span className="arch-thumb">
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <Monogram name={c.parishName(p)} />}
    </span>
  );
}

function Choices({ name, label, values, show = v => v, update }) {
  const { filters } = useSite();
  return (
    <label className="dir-select">
      <span className="sr-only">{label}</span>
      <select data-filter={name} value={filters[name] || ''} onChange={e => update({ [name]: e.target.value })}>
        <option value="">{label}</option>
        {values.map(v => (
          <option key={v} value={v}>
            {show(v)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Directory({ controller, places }) {
  const c = useSite(),
    { L, filters, setFilters } = c;
  const map = useRef(null),
    section = useRef(null),
    list = useRef(null),
    typed = useRef(0);
  const [note, setNote] = useState('');
  const [chosen, setChosen] = useState(null);
  const uniq = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, c.lang));
  const rows = filtered(c);
  const items = useMemo(
    () =>
      c.directory
        .filter(p => places.has(p.id))
        .map(p => ({ id: p.id, ...places.get(p.id), name: c.parishName(p), town: c.townName(p) })),
    [places, c.lang]
  );
  const writeURL = next => {
    const url = new URL(location.href);
    for (const key of ['q', 'town', 'sort'])
      next[key] && !(key === 'sort' && next.sort === 'name')
        ? url.searchParams.set(key, next[key])
        : url.searchParams.delete(key);
    history.replaceState(null, '', url);
  };
  const update = (change, url = true) => {
    const next = { ...filters, ...change };
    setFilters(next);
    if (url) writeURL(next);
    setNote('');
    return next;
  };
  useImperativeHandle(controller, () => ({
    /* The hero's search: narrow the list, zoom the map to what is left, and go there. */
    go(change) {
      const next = update(change),
        ids = filtered(c, next).map(r => r.p.id);
      if (ids.length && ids.length < c.directory.length) map.current?.focus(ids);
      scrollToTarget(section.current);
    }
  }));
  useEffect(() => {
    if (!chosen) return;
    list.current
      .querySelector(`[data-parish="${CSS.escape(chosen)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: still() ? 'auto' : 'smooth' });
  }, [chosen]);
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
  const card = (item, close) => {
    const p = c.directory.find(x => x.id === item.id),
      open = c.details.get(item.id)?.publicRequests !== false;
    return (
      <>
        <button
          type="button"
          className="icon-button card-close"
          data-card-close
          aria-label={L('Close', 'إغلاق')}
          onClick={close}
        >
          <Glyph name="close" />
        </button>
        <Thumb p={p} />
        <div>
          <h3>{item.name}</h3>
          <p>
            {item.town}
            {item.exact ? null : (
              <>
                {' '}
                <small>{L('(shown at the town centre)', '(تظهر في وسط البلدة)')}</small>
              </>
            )}
          </p>
          <div className="card-actions">
            <a className="btn btn-gilt btn-small" href={c.profileURL(item.id)}>
              {L('Parish page', 'صفحة الرعية')}
            </a>
            {open ? (
              <a className="btn btn-line btn-small" href={c.requestURL(item.id, 'certificate')}>
                {L('Make a request', 'قدّم طلباً')}
              </a>
            ) : null}
          </div>
        </div>
      </>
    );
  };
  const status =
    rows.length === c.directory.length
      ? counted(c, rows.length, 'parish')
      : L(
          `${rows.length} of ${c.directory.length} parishes`,
          `${c.number(rows.length)} من أصل ${counted(c, c.directory.length, 'parish')}`
        );
  const off = c.directory.filter(p => !places.has(p.id)).length;
  return (
    <section className="directory" id="directory" aria-labelledby="directory-title" ref={section}>
      <div className="site-wrap dir-grid">
        <header className="sec-head dir-head" data-reveal>
          <h2 id="directory-title">{L('Find a parish', 'ابحث عن رعية')}</h2>
          <p>
            {L(
              'Every parish on ParishLife, on the map of Lebanon. Choose a light, or search by name or town.',
              'جميع الرعايا المسجّلة في ParishLife على خريطة لبنان. اختر نوراً، أو ابحث باسم الرعية أو البلدة.'
            )}
          </p>
        </header>
        <div className="dir-map" data-reveal>
          <LebanonMap ref={map} L={L} items={items} visible={rows.map(r => r.p.id)} card={card} onChoose={setChosen} />
        </div>
        <div className="dir-list">
          <form
            className="dir-filters"
            role="search"
            data-dir-form
            data-reveal
            onSubmit={e => e.preventDefault()}
            onReset={e => {
              e.preventDefault();
              update({ q: '', town: '', diocese: '', rite: '', sort: 'name', location: null, distances: null });
              map.current?.reset();
            }}
          >
            <label className="field-cap" htmlFor="directory-filter">
              {L('Search by parish or town', 'ابحث باسم الرعية أو البلدة')}
            </label>
            <label className="dir-search">
              <Glyph name="search" />
              <input
                id="directory-filter"
                type="search"
                value={filters.q}
                placeholder={L('For example: Hadath', 'مثلاً: الحدث')}
                onChange={e => {
                  const value = e.target.value;
                  update({ q: value });
                  clearTimeout(typed.current);
                  typed.current = setTimeout(() => value.trim().length >= 3 && trackAction('search', '', value), 1500);
                }}
              />
            </label>
            <div className="dir-row">
              <Choices
                update={update}
                name="town"
                label={L('All towns', 'كل البلدات')}
                values={uniq(c.directory.map(p => p.town))}
                show={v => c.townName(c.directory.find(p => p.town === v)) || v}
              />
              <Choices
                update={update}
                name="diocese"
                label={L('All dioceses', 'كل الأبرشيات')}
                values={uniq(c.directory.map(p => p.diocese))}
                show={v => dioceseName(c, v)}
              />
              <Choices
                update={update}
                name="rite"
                label={L('All rites', 'كل الطقوس')}
                values={uniq(c.directory.map(p => c.details.get(p.id)?.parish?.rite))}
                show={v =>
                  c.pair(
                    c.directory.map(p => c.details.get(p.id)?.parish).find(r => r?.rite === v),
                    'rite',
                    'riteAr'
                  ) || v
                }
              />
            </div>
            <div className="dir-row dir-tools">
              <button
                type="button"
                className="chip"
                data-near
                aria-pressed={filters.location ? 'true' : 'false'}
                onClick={near}
              >
                <Glyph name="near" />
                {L('Near me', 'بالقرب مني')}
              </button>
              <label className="dir-sort">
                {L('Sort by', 'ترتيب حسب')}{' '}
                <select data-filter="sort" value={filters.sort} onChange={e => update({ sort: e.target.value })}>
                  <option value="name">{L('Name', 'الاسم')}</option>
                  <option value="town">{L('Town', 'البلدة')}</option>
                </select>
              </label>
              <button type="reset" className="text-button" data-dir-reset>
                {L('Clear', 'مسح')}
              </button>
            </div>
            <p className="dir-status" data-dir-status role="status">
              {note || status}
            </p>
          </form>
          <ol className="parish-list" data-parish-list ref={list}>
            {rows.length ? (
              rows.map(({ p, d }) => {
                const rite = c.details.get(p.id)?.parish,
                  riteName = c.pair(rite, 'rite', 'riteAr'),
                  isPlaced = places.get(p.id);
                return (
                  <li
                    key={p.id}
                    className={'parish-item' + (chosen === p.id ? ' is-chosen' : '')}
                    data-parish={p.id}
                    data-reveal-item
                    onPointerEnter={() => map.current?.mark(p.id)}
                    onPointerLeave={() => map.current?.mark(null)}
                    onFocus={() => map.current?.mark(p.id)}
                    onBlur={() => map.current?.mark(null)}
                  >
                    <a href={c.profileURL(p.id)}>
                      <Thumb p={p} />
                      <span className="pi-text">
                        <strong>{c.parishName(p)}</strong>
                        <span className="pi-town">
                          <Glyph name="pin" />
                          {c.townName(p) || L('Town not published', 'البلدة غير منشورة')}
                        </span>
                        <small>{[dioceseName(c, p.diocese), riteName].filter(Boolean).join(L(', ', '، '))}</small>
                      </span>
                      {d !== null ? (
                        <span className="pi-km">
                          {c.number(Math.round(d * 10) / 10)} {L('km', 'كم')}
                        </span>
                      ) : isPlaced ? null : (
                        <span className="pi-km is-off">{L('Not on the map yet', 'ليست على الخريطة بعد')}</span>
                      )}
                    </a>
                  </li>
                );
              })
            ) : (
              <li className="list-empty">
                <p>{L('No parish matches this search.', 'لا رعية تطابق هذا البحث.')}</p>
                <button
                  type="button"
                  className="text-button"
                  data-dir-clear
                  onClick={() => update({ q: '', town: '', diocese: '', rite: '' })}
                >
                  {L('Show every parish', 'عرض كل الرعايا')}
                </button>
              </li>
            )}
          </ol>
          <p className="dir-note" data-dir-note>
            {off
              ? L(
                  `${off} ${off === 1 ? 'parish is' : 'parishes are'} not on the map yet. A parish office places its parish by adding coordinates to its public parish profile.`,
                  `عدد الرعايا التي لا تظهر على الخريطة بعد: ${c.number(off)}. يضع مكتب الرعية رعيته على الخريطة بإضافة الإحداثيات إلى صفحة الرعية العامة.`
                )
              : ''}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- requests ---------- */
function Requests({ open, onAsk }) {
  const c = useSite(),
    { L } = c;
  if (!open.length) return null;
  const href = kind => (open.length === 1 ? c.requestURL(open[0].id, kind) : '#requests');
  return (
    <section className="ask" id="requests" aria-labelledby="requests-title">
      <div className="site-wrap">
        <header className="sec-head" data-reveal>
          <h2 id="requests-title">{L('Ask your parish', 'اطلب من رعيتك')}</h2>
          <p>
            {L(
              'Baptisms, weddings, certificates and more. Send your request to the parish office without an account, and follow it with a private link.',
              'معموديات وأكاليل وشهادات وغيرها. أرسل طلبك إلى مكتب الرعية من دون حساب، وتابعه برابط خاص.'
            )}
          </p>
        </header>
        <ul className="arcade">
          {c.REQUESTS.map(([kind, art, title, sub]) => (
            <li key={kind} data-reveal-item>
              <a className="arch" href={href(kind)} data-request={kind} data-tilt onClick={e => onAsk(kind, e)}>
                <span className="arch-icon">
                  <Icon name={art} />
                </span>
                <strong>{L(...title)}</strong>
                <small>{L(...sub)}</small>
              </a>
            </li>
          ))}
        </ul>
        <div className="ask-more">
          {c.OTHER_REQUESTS.map(([kind, art, title, sub]) => (
            <a
              key={kind}
              className="ask-wide"
              href={href(kind)}
              data-request={kind}
              data-reveal-item
              onClick={e => onAsk(kind, e)}
            >
              <span className="arch-icon">
                <Icon name={art} />
              </span>
              <span>
                <strong>{L(...title)}</strong>
                <small>{L(...sub)}</small>
              </span>
            </a>
          ))}
        </div>
        <ol className="steps" data-reveal>
          <li>
            <b>{L('Choose your parish and what you need', 'اختر رعيتك وما تحتاجه')}</b>
            <span>
              {L(
                'Describe the request in a few lines. No account is needed.',
                'صِف طلبك في بضعة أسطر. لا حاجة إلى حساب.'
              )}
            </span>
          </li>
          <li>
            <b>{L('The parish office reviews it', 'يراجعه مكتب الرعية')}</b>
            <span>
              {L(
                'The office answers, asks for documents if needed, and prepares what you asked for.',
                'يجيب المكتب، ويطلب المستندات عند الحاجة، ويحضّر ما طلبته.'
              )}
            </span>
          </li>
          <li>
            <b>{L('Follow it with your private link', 'تابعه برابطك الخاص')}</b>
            <span>
              {L(
                'Keep the link you receive to see each step and collect your documents.',
                'احتفظ بالرابط الذي تتلقاه لتتابع كل خطوة وتستلم مستنداتك.'
              )}
            </span>
          </li>
        </ol>
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
  const label = [...c.REQUESTS, ...c.OTHER_REQUESTS].find(r => r[0] === kind);
  const rows = find(q, open, p => [p.name, p.ar, p.town, p.townAr].join(' '), c.normalize).sort((a, b) =>
    c.parishName(a).localeCompare(c.parishName(b), c.lang)
  );
  return (
    <dialog
      className="parish-picker"
      data-picker
      aria-labelledby="picker-title"
      ref={dialog}
      onClick={e => {
        if (e.target === dialog.current) dialog.current.close();
      }}
    >
      <form method="dialog" className="picker-head">
        <h2 id="picker-title">
          {kind
            ? L(`${label ? label[2][0] : 'Request'}: which parish?`, `${label ? label[2][1] : 'طلب'}: في أي رعية؟`)
            : ''}
        </h2>
        <button className="icon-button" aria-label={L('Close', 'إغلاق')}>
          <Glyph name="close" />
        </button>
      </form>
      <label className="field-cap" htmlFor="picker-q">
        {L('Search parishes', 'ابحث عن رعية')}
      </label>
      <label className="picker-search">
        <Glyph name="search" />
        <input
          id="picker-q"
          type="search"
          data-picker-filter
          placeholder={L('Name or town', 'الاسم أو البلدة')}
          value={q}
          onChange={e => setQ(e.target.value)}
          ref={input}
        />
      </label>
      <ul className="picker-list" data-picker-list>
        {kind ? (
          rows.length ? (
            rows.map(p => (
              <li key={p.id}>
                <a href={c.requestURL(p.id, kind)}>
                  <Thumb p={p} />
                  <span>
                    <b>{c.parishName(p)}</b>
                    <small>{c.townName(p)}</small>
                  </span>
                </a>
              </li>
            ))
          ) : (
            <li className="no-match">{L('No parish matches.', 'لا رعية مطابقة.')}</li>
          )
        ) : null}
      </ul>
    </dialog>
  );
}

/* ---------- Mass times ---------- */
function Times() {
  const c = useSite(),
    { L } = c,
    rows = c.directory.filter(p => c.content(c.details.get(p.id), 'massTimes').trim());
  const [all, setAll] = useState(false);
  /* Until a parish publishes its times, the section is a slim band rather than a page of white. */
  if (!rows.length)
    return (
      <section className="times is-empty" id="times" aria-labelledby="times-title">
        <div className="site-wrap times-slim" data-reveal>
          <BellButton L={L} />
          <div>
            <h2 id="times-title">{L('Mass times', 'مواعيد القداديس')}</h2>
            <p>
              {L(
                'No parish has published its Mass times yet. Parish offices add them under Website content in ParishLife, and they appear here and on the parish’s page.',
                'لم تنشر أي رعية مواعيد قداديسها بعد. تضيفها مكاتب الرعايا ضمن محتوى الموقع في ParishLife، فتظهر هنا وفي صفحة الرعية.'
              )}
            </p>
          </div>
          <a
            className="btn btn-ink-line btn-small"
            href="#directory"
            data-jump
            onClick={e => {
              const t = document.querySelector('#directory');
              if (t) {
                e.preventDefault();
                scrollToTarget(t);
              }
            }}
          >
            {L('Find a parish', 'ابحث عن رعية')}
          </a>
        </div>
      </section>
    );
  return (
    <section className="times" id="times" aria-labelledby="times-title">
      <div className="site-wrap times-grid">
        <header className="sec-head" data-reveal>
          <BellButton L={L} />
          <h2 id="times-title">{L('Mass times', 'مواعيد القداديس')}</h2>
          <p>
            {L(
              'As published by each parish office. On feast days, check the parish page for changes.',
              'كما ينشرها مكتب كل رعية. في الأعياد، راجع صفحة الرعية لمعرفة أي تغيير.'
            )}
          </p>
        </header>
        <div>
          <div className="times-board">
            {rows.map((p, i) => (
              <article
                key={p.id}
                className="times-entry"
                data-reveal-item
                data-extra={i >= 6 ? '' : undefined}
                hidden={i >= 6 && !all}
              >
                <h3>
                  <a href={c.profileURL(p.id, '#times')}>{c.parishName(p)}</a>
                </h3>
                <p className="times-town">{c.townName(p)}</p>
                <div className="times-text" dir="auto">
                  <Lines text={c.content(c.details.get(p.id), 'massTimes')} />
                </div>
              </article>
            ))}
          </div>
          {rows.length > 6 && !all ? (
            <button type="button" className="text-button times-all" data-times-all onClick={() => setAll(true)}>
              {L(`Show all ${rows.length} parishes`, `عرض جميع الرعايا (${c.number(rows.length)})`)}
            </button>
          ) : null}
        </div>
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
    <section className="news" id="news" aria-labelledby="news-title">
      <div className="site-wrap">
        <header className="sec-head" data-reveal>
          <h2 id="news-title">{L('From the parishes', 'من الرعايا')}</h2>
          <p>
            {L('The latest announcements published by parish offices.', 'آخر الإعلانات التي نشرتها مكاتب الرعايا.')}
          </p>
        </header>
        <div className="news-list">
          {posts.map((post, i) => (
            <article
              key={(post.id || i) + post.parish.id}
              className={'news-item' + (i === 0 ? ' is-lead' : '')}
              data-reveal-item
            >
              {c.publishedDate(post.at) ? <time dateTime={post.at}>{c.publishedDate(post.at)}</time> : null}
              <h3 dir="auto">
                <a href={c.profileURL(post.parish.id, '#updates')}>{post.title || clip(plain(post.body), 80)}</a>
              </h3>
              <p dir="auto">{clip(plain(post.body), i === 0 ? 320 : 170)}</p>
              <p className="news-parish">{c.parishName(post.parish)}</p>
            </article>
          ))}
        </div>
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
  const track = useRef(null);
  const [fits, setFits] = useState(false);
  useEffect(() => {
    if (!track.current || list.length < 2) return;
    const watch = new ResizeObserver(() => setFits(track.current.scrollWidth <= track.current.clientWidth + 4));
    watch.observe(track.current);
    return () => watch.disconnect();
  }, [list.length]);
  if (!list.length) return null;
  const step = n => {
    const story = track.current.querySelector('.story'),
      width = (story?.getBoundingClientRect().width || 300) + 32;
    const dir = getComputedStyle(track.current).direction === 'rtl' ? -1 : 1;
    track.current.scrollBy({ left: n * width * dir, behavior: still() ? 'auto' : 'smooth' });
  };
  return (
    <section className="stories" id="stories" aria-labelledby="stories-title">
      <div className="site-wrap stories-head">
        <h2 id="stories-title" data-reveal>
          {L('Stories', 'قصص')}
        </h2>
        {list.length > 1 ? (
          <div className="story-nav" hidden={fits}>
            <button
              type="button"
              className="icon-button"
              data-story-step="-1"
              aria-label={L('Previous story', 'القصة السابقة')}
              onClick={() => step(-1)}
            >
              <Glyph name="prev" />
            </button>
            <button
              type="button"
              className="icon-button"
              data-story-step="1"
              aria-label={L('Next story', 'القصة التالية')}
              onClick={() => step(1)}
            >
              <Glyph name="next" />
            </button>
          </div>
        ) : null}
      </div>
      <div
        className="story-track"
        data-story-track
        tabIndex="0"
        role="region"
        aria-label={L('Stories', 'قصص')}
        ref={track}
      >
        {list.map((s, i) => (
          <article key={i} className="story" data-reveal-item>
            <figure className="story-arch">
              <img src={s.image || 'assets/images/valley/crest-dawn.webp'} alt="" loading="lazy" decoding="async" />
            </figure>
            <h3 {...s.t.attrs}>{s.t.text}</h3>
            {s.b ? <p {...s.b.attrs}>{s.b.text}</p> : null}
            {s.link ? (
              <a className="story-link" href={s.link}>
                <span {...(s.more?.attrs || {})}>{s.more?.text || L('Read more', 'اقرأ المزيد')}</span>
                <span className="sr-only">: {s.t.text}</span>
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------- the verse: every parish is one of these lights ---------- */
function Verse() {
  const { L, lang } = useSite();
  /* the gold mosaic of the apse behind the verse */
  const mosaic = useMemo(
    () =>
      document.documentElement.classList.contains('is-lite') ? undefined : { '--mosaic': `url(${mosaicTexture()})` },
    []
  );
  return (
    <section className="verse" id="verse" aria-labelledby="verse-text" style={mosaic}>
      <div className="site-wrap verse-inner">
        <div className="verse-rose" aria-hidden="true">
          <RoseOutline />
        </div>
        <span className="verse-cross" aria-hidden="true">
          <MaroniteCross />
        </span>
        <blockquote className="verse-quote" data-lit>
          <p id="verse-text">
            {lang === 'ar' ? (
              <>
                فَلْيُضِئْ <em>نُورُكُمْ</em> هكَذَا قُدَّامَ النَّاسِ، لِكَيْ يَرَوْا أَعْمَالَكُمُ الْحَسَنَةَ،
                وَيُمَجِّدُوا أَبَاكُمُ الَّذِي فِي السَّمَاوَاتِ.
              </>
            ) : (
              <>
                Let your <em>light</em> shine before others, so that they may see your good works and give glory to your
                Father in heaven.
              </>
            )}
          </p>
          <footer>
            <cite>{L('Matthew 5:16', 'متّى ٥: ١٦')}</cite>
          </footer>
        </blockquote>
        <p className="verse-note" data-reveal>
          {L('Every parish on ParishLife is one of those lights.', 'وكلّ رعية على ParishLife نورٌ من هذه الأنوار.')}
        </p>
      </div>
    </section>
  );
}

/* ---------- about and join ---------- */
/* Beside the About words, a votive stand in the dark church: each parish one light among many
   (assets/images/votives.webp, docs/tools/render_votives.py). The first letter of the About text
   is an illuminated initial, as in a liturgical book: the letter stays in the paragraph for reading
   aloud; the painted one beside it is decoration. */
function About() {
  const c = useSite(),
    { L } = c;
  if (c.site && !c.site.about) return null;
  const a = c.site?.about,
    f = facts(c),
    paragraphs = paragraphList(words(c, a?.body, HOME_DEFAULTS.about.body));
  const initial = c.lang !== 'ar' && /^[A-Za-z]/.test(paragraphs[0] || '') ? paragraphs[0][0] : '';
  return (
    <section className="about" id="about" aria-labelledby="about-title">
      <div className="site-wrap about-grid">
        <figure className="about-mark" data-reveal>
          <img src="assets/images/votives.webp" alt="" loading="lazy" decoding="async" data-parallax="-8" />
        </figure>
        <div className="about-copy" data-reveal>
          <h2 id="about-title">{words(c, a?.title, HOME_DEFAULTS.about.title)}</h2>
          {initial ? (
            <span className="about-initial" aria-hidden="true">
              {initial}
            </span>
          ) : null}
          {paragraphs.map((p, i) => (
            <p key={i} className={i === 0 && initial ? 'has-initial' : undefined}>
              <Lines text={p} />
            </p>
          ))}
          <dl className="about-facts">
            {[
              [f.parishes, 'parish'],
              [f.dioceses, 'diocese'],
              [f.towns, 'town']
            ].map(([n, key]) => (
              <div key={key}>
                <dt>{noun(c, n, key).replace(/^./, ch => ch.toUpperCase())}</dt>
                <dd data-count={n}>{c.number(n)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function Join() {
  const c = useSite(),
    { L } = c;
  if (c.site && !c.site.join) return null;
  const j = c.site?.join;
  return (
    <section className="join" id="join" aria-labelledby="join-title">
      <div className="join-art" aria-hidden="true">
        {['sky', 'far', 'near'].map(part => (
          <img
            key={part}
            src={`assets/images/valley/valley-wide-dusk-${part}.webp`}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ))}
      </div>
      <div className="site-wrap join-inner" data-reveal>
        <h2 id="join-title">{words(c, j?.title, HOME_DEFAULTS.join.title)}</h2>
        <Paragraphs text={words(c, j?.body, HOME_DEFAULTS.join.body)} />
        <div className="join-actions">
          <a className="btn btn-gilt" href="index.html">
            {L('Open the members portal', 'ادخل إلى بوّابة المؤمنين')}
          </a>
          <a className="btn btn-line" href="index.html?signup=1">
            {L('Create an account', 'أنشئ حساباً')}
          </a>
          <a className="text-button" href="public.html?view=bundles">
            {L('ParishLife bundles', 'باقات ParishLife')}
          </a>
        </div>
      </div>
    </section>
  );
}
