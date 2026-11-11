/* The product page's demonstration: one envelope recorded in a counting session. The amount goes in
   as dollars, the lira appears at the session's rate, and the session total follows in both.

   One window and one card straddling its edge, a cursor that moves only to do something, and
   figures that never rewind: each pass adds the next envelope and the oldest row fades away. Only
   placeholder rows run off the foot of the window. Everything moves by transform and opacity. Anyone
   can pause it, it stops while off screen, and a reader who asks for less motion gets the finished
   frame. */
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

const RATE = 89500;
const money = n => '$' + n.toLocaleString('en-US') + '.00';
const lira = n => (n * RATE).toLocaleString('en-US');

const SEATED = [
  { id: 213, initials: 'GH', en: 'Georges Haddad', ar: 'جورج حدّاد', usd: 50 },
  { id: 212, initials: 'NS', en: 'Nabil Saade', ar: 'نبيل سعادة', usd: 80 },
  { id: 211, initials: 'LK', en: 'Layal Khoury', ar: 'ليال خوري', usd: 25 },
  { id: 210, initials: 'TM', en: 'Tony Matar', ar: 'طوني مطر', usd: 100 },
  { id: 209, initials: 'SA', en: 'Salma Aoun', ar: 'سلمى عون', usd: 60 }
];
const ARRIVING = [
  { initials: 'RN', en: 'Rita Nassar', ar: 'ريتا نصّار', usd: 120 },
  { initials: 'MH', en: 'Maya Haddad', ar: 'مايا حدّاد', usd: 75 },
  { initials: 'EK', en: 'Elie Karam', ar: 'إيلي كرم', usd: 200 },
  { initials: 'JS', en: 'Joseph Saliba', ar: 'جوزيف صليبا', usd: 45 },
  { initials: 'CH', en: 'Carla Hage', ar: 'كارلا الحاج', usd: 90 },
  { initials: 'PF', en: 'Paul Fares', ar: 'بول فارس', usd: 30 },
  { initials: 'NG', en: 'Nada Ghanem', ar: 'ندى غانم', usd: 150 }
];
const START_TOTAL = 1250;

/* A digit that changes slides out as the new one slides in, the last digit first; digits that did not
   change stay still. The old figure is only on the page while it is leaving. */
function Digit({ value, delay }) {
  const [shown, setShown] = useState({ now: value, was: null });
  if (shown.now !== value) setShown({ now: value, was: shown.now });
  const style = { animationDelay: delay + 'ms' };
  return (
    <span className="roll-d">
      {shown.was !== null ? (
        <i key={shown.was} className="out" style={style} onAnimationEnd={() => setShown(s => ({ ...s, was: null }))}>
          {shown.was}
        </i>
      ) : null}
      <i key={shown.now} className={shown.was !== null ? 'in' : undefined} style={style}>
        {shown.now}
      </i>
    </span>
  );
}

function Roll({ text }) {
  const chars = [...text];
  return (
    <span className="roll" dir="ltr">
      {chars.map((c, i) => {
        const fromEnd = chars.length - 1 - i;
        return /\d/.test(c) ? <Digit key={fromEnd} value={c} delay={fromEnd * 28} /> : <span key={fromEnd}>{c}</span>;
      })}
    </span>
  );
}

function Row({ row, L }) {
  const typing = row.typing !== undefined;
  return (
    <div className={'tr demo-row' + (typing ? ' is-new' : '') + (row.leaving ? ' is-leaving' : '')}>
      <span className="who">
        <span className="avatar" data-tone={row.id % 6}>
          {row.initials}
        </span>
        <span>
          <b>{L(row.en, row.ar)}</b>
          <small>{L(row.ar, row.en)}</small>
        </span>
      </span>
      <span className="dim demo-env" dir="ltr">
        #{row.id}
      </span>
      <span className="num" dir="ltr">
        {typing ? (
          <>
            {'$' + row.typing}
            <i className="demo-caret"></i>
          </>
        ) : (
          money(row.usd)
        )}
      </span>
      <span className={'num dim demo-lira' + (typing ? ' is-waiting' : '')} dir="ltr">
        {typing ? '—' : <span className="demo-lira-v">{lira(row.usd)}</span>}
      </span>
    </div>
  );
}

export function CountingDemo({ L, Use }) {
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  /* the finished frame is what a reader asking for less motion sees, and it needs no script */
  const [rows, setRows] = useState(() => (reduced ? [{ ...ARRIVING[0], id: 214 }, ...SEATED.slice(0, -1)] : SEATED));
  const [total, setTotal] = useState(() => START_TOTAL + (reduced ? ARRIVING[0].usd : 0));
  const [pressed, setPressed] = useState(false);
  const [paused, setPaused] = useState(false);

  const stage = useRef(null),
    button = useRef(null),
    cursor = useRef(null),
    list = useRef(null),
    holds = useRef({ paused: false, away: true });
  holds.current.paused = paused;

  /* stop while nobody can see it */
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => (holds.current.away = !e.isIntersecting), { threshold: 0.25 });
    io.observe(stage.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced) return undefined;
    const STOP = Symbol();
    let alive = true;
    const timers = new Set();
    const sleep = ms =>
      new Promise(done => {
        const id = setTimeout(() => {
          timers.delete(id);
          done();
        }, ms);
        timers.add(id);
      });
    const beat = async ms => {
      await sleep(ms);
      while (alive && (holds.current.paused || holds.current.away || document.hidden)) await sleep(200);
      if (!alive) throw STOP;
    };
    /* measured every time: the window's width and its direction both change where things are */
    const cursorTo = press => {
      const s = stage.current.getBoundingClientRect(),
        b = button.current.getBoundingClientRect(),
        rtl = document.documentElement.dir === 'rtl';
      const x = press ? (rtl ? b.left + 22 : b.right - 22) : rtl ? b.right + 140 : b.left - 140;
      const y = press ? b.bottom - 6 : b.top + 4;
      cursor.current.style.transform = `translate(${x - s.left}px,${y - s.top}px)`;
    };
    (async () => {
      let sum = START_TOTAL,
        next = 214;
      cursorTo(false);
      await beat(1100);
      for (let i = 0; ; i++) {
        const envelope = ARRIVING[i % ARRIVING.length],
          id = next++;
        cursorTo(true);
        await beat(950);
        setPressed(true);
        await beat(130);
        setPressed(false);
        /* the list slides down by one row inside its window: the new row comes in from under the header,
           and the oldest goes out at the foot. The list's height never changes, so nothing reflows. */
        setRows(rs => rs.map((r, n) => (n === rs.length - 1 ? { ...r, leaving: true } : r)));
        await beat(120); // it has gone before anything moves
        flushSync(() => setRows(rs => [{ ...envelope, id, typing: '' }, ...rs]));
        list.current.animate(
          [{ transform: `translateY(-${list.current.firstElementChild.offsetHeight}px)` }, { transform: 'none' }],
          { duration: 460, easing: 'cubic-bezier(.25,.8,.25,1)' }
        );
        cursorTo(false);
        await beat(560);
        setRows(rs => rs.filter(r => !r.leaving));
        const digits = String(envelope.usd);
        for (let n = 1; n <= digits.length; n++) {
          const typed = digits.slice(0, n);
          setRows(rs => rs.map(r => (r.id === id ? { ...r, typing: typed } : r)));
          await beat(150);
        }
        await beat(240);
        /* the lira arrive the moment the amount is whole, and the total a beat later: cause, then effect */
        setRows(rs => rs.map(r => (r.id === id ? { ...envelope, id } : r)));
        await beat(420);
        sum += envelope.usd;
        setTotal(sum);
        await beat(3400); // the result holds, so it can be read
      }
    })().catch(e => {
      if (e !== STOP) throw e;
    });
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, [reduced]);

  return (
    <figure className="demo">
      <div
        className="demo-stage"
        ref={stage}
        role="img"
        aria-label={L(
          'A counting session in ParishLife. An envelope of 120 dollars is recorded, its value in lira appears at the session rate, and the session total updates in both currencies.',
          'جلسة عدّ في «حياة الرعية». يُسجَّل مغلّف بقيمة ١٢٠ دولاراً، فتظهر قيمته بالليرة على سعر الجلسة، ويتحدّث مجموع الجلسة بالعملتين.'
        )}
      >
        <div className="shot">
          <div className="shot-bar">
            <i></i>
            <i></i>
            <i></i>
            <span className="mono">parishlife.app / saint-elias</span>
          </div>
          <div className="shell">
            <div className="shell-rail">
              <div className="shell-parish">
                <span className="mark">P</span>
                <span>
                  <b>{L('Saint Elias', 'مار الياس')}</b>
                  <small>{L('Hadath · Maronite', 'الحدث · ماروني')}</small>
                </span>
              </div>
              <div className="navgroup">{L('Records', 'السجلات')}</div>
              <div className="navitem">
                <Use id="people" />
                <span>{L('People', 'المؤمنون')}</span>
                <span className="badge tnum">1,380</span>
              </div>
              <div className="navitem">
                <Use id="family" />
                <span>{L('Families', 'العائلات')}</span>
                <span className="badge tnum">412</span>
              </div>
              <div className="navitem">
                <Use id="sacr" />
                <span>{L('Sacraments', 'الأسرار')}</span>
              </div>
              <div className="navgroup">{L('Parish life', 'حياة الرعية')}</div>
              <div className="navitem">
                <Use id="attend" />
                <span>{L('Attendance', 'الحضور')}</span>
              </div>
              <div className="navitem on">
                <Use id="give" />
                <span>{L('Giving', 'التقدمات')}</span>
              </div>
            </div>
            <div className="shell-main">
              <div className="shell-top">
                <span></span>
                <div className="shell-search">
                  <Use id="search" size={14} />
                  <span>{L('Search people, records, pages', 'ابحث عن شخص أو سجل')}</span>
                  <kbd>⌘K</kbd>
                </div>
                <div className="shell-right">
                  <span className="shell-bell">
                    <Use id="bell" size={16} />
                  </span>
                  <span className="avatar">AK</span>
                </div>
              </div>
              <div className="shell-body">
                <div className="shell-head">
                  <div>
                    <div className="shell-title">{L('Counting session 214', 'جلسة العدّ ٢١٤')}</div>
                    <p>{L('Sunday 4 October · 9:00 Mass', 'الأحد ٤ تشرين الأول · قدّاس ٩:٠٠')}</p>
                  </div>
                  <span className={'btn btn-primary demo-add' + (pressed ? ' is-pressed' : '')} ref={button}>
                    {L('Add envelope', 'إضافة مغلّف')}
                  </span>
                </div>
                <div className="mtable">
                  <div className="th">
                    <span>{L('Name', 'الاسم')}</span>
                    <span className="demo-env">{L('Envelope', 'المغلّف')}</span>
                    <span className="num">USD</span>
                    <span className="num">L.L</span>
                  </div>
                  <div className="demo-list">
                    <div ref={list}>
                      {rows.map(row => (
                        <Row key={row.id} row={row} L={L} />
                      ))}
                    </div>
                  </div>
                  <div className="demo-foot">
                    {/* what the window fades out over: only placeholders run off the edge */}
                    {[62, 48, 56, 44].map(width => (
                      <div key={width} className="tr demo-filler">
                        <span className="who">
                          <span className="avatar"></span>
                          <i style={{ width: width + '%' }}></i>
                        </span>
                        <i className="demo-env"></i>
                        <i></i>
                        <i></i>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="demo-total">
          <span className="demo-total-k">{L('Session total', 'مجموع الجلسة')}</span>
          <div className="demo-usd">
            <Roll text={money(total)} />
          </div>
          <div className="demo-lbp">
            L.L <Roll text={lira(total)} />
          </div>
          <div className="demo-rate">{L('at 89,500 · set 4 Oct 2026', 'على سعر 89,500 · حُدّد في ٤ ت١ ٢٠٢٦')}</div>
        </div>

        {reduced ? null : (
          <svg className="demo-cursor" ref={cursor} viewBox="0 0 26 26" width="26" height="26" aria-hidden="true">
            <path
              className={pressed ? 'is-pressed' : ''}
              d="M4.5 3.2v17.6l4.6-4.4 3 7 3.3-1.4-3-6.9 6.4-.4Z"
              fill="#172B23"
              stroke="#FFFFFF"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <figcaption className="demo-note">
        <span>
          {L(
            'Switch to ع above: the window mirrors, and the figures stay left to right.',
            'بدّل إلى EN في الأعلى: تنعكس النافذة، وتبقى الأرقام من اليسار إلى اليمين.'
          )}
        </span>
        {reduced ? null : (
          <button
            type="button"
            className="btn btn-ghost btn-dense"
            aria-pressed={paused}
            onClick={() => setPaused(p => !p)}
          >
            {paused ? L('Play', 'تشغيل') : L('Pause', 'إيقاف مؤقّت')}
          </button>
        )}
      </figcaption>
    </figure>
  );
}
