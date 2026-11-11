/* Following a request with its private link: where it stands, what the office answered, and the
   letter or document once it is released. */
import { useEffect, useRef, useState } from 'react';
import { useSite } from '../site.jsx';

const REQUEST_STATUS = {
  submitted: ['Sent to the parish office', 'أُرسل إلى مكتب الرعية'],
  'office-review': ['The parish office is reviewing it', 'قيد المراجعة لدى مكتب الرعية'],
  'missing-documents': ['Documents are missing', 'مستندات ناقصة'],
  'ready-for-collection': ['Ready to collect from the parish', 'جاهز للاستلام من الرعية'],
  'ready-for-download': ['Ready to download', 'جاهز للتنزيل'],
  closed: ['Closed', 'مُغلق']
};

const TRACK_STEPS = [
  ['submitted', 'Sent', 'أُرسل'],
  ['office-review', 'Under review', 'قيد المراجعة'],
  ['ready', 'Ready', 'جاهز'],
  ['closed', 'Closed', 'مُغلق']
];

/* The private tracking page: where the request stands, as four steps, and any documents. */
export function TrackingPage({ token }) {
  const { L, lang } = useSite();
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch('/api/public/track/' + encodeURIComponent(token)),
          d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (live) setState({ data: d });
      } catch (e) {
        if (live) setState({ error: e.message });
      }
    })();
    return () => {
      live = false;
    };
  }, [token]);
  const d = state.data;
  if (!d)
    return (
      <section className="track site-wrap">
        <div className="track-card">
          <span className="track-lamp" aria-hidden="true"></span>
          <h1>{L('Your request', 'طلبك')}</h1>
          <p role="status">{state.error ?? L('Loading…', 'جارٍ التحميل…')}</p>
        </div>
      </section>
    );
  const updated = new Date(d.updated_at),
    status = String(d.status || 'submitted');
  const at = status === 'closed' ? 3 : /^ready/.test(status) ? 2 : status === 'submitted' ? 0 : 1,
    warn = status === 'missing-documents';
  return (
    <section className="track site-wrap">
      <div className="track-card">
        <span className="track-lamp" aria-hidden="true"></span>
        <h1>{L('Your request', 'طلبك')}</h1>
        <ol className="track-steps">
          {TRACK_STEPS.map(([k, en, ar], i) => (
            <li
              key={k}
              className={i < at ? 'is-done' : i === at ? 'is-current' + (warn ? ' is-warn' : '') : undefined}
              aria-current={i === at ? 'step' : undefined}
            >
              <span aria-hidden="true"></span>
              {L(en, ar)}
            </li>
          ))}
        </ol>
        <h2>{L(...(REQUEST_STATUS[status] || [status.replaceAll('-', ' '), status.replaceAll('-', ' ')]))}</h2>
        <p dir="auto">{d.response || L('The parish office has received your request.', 'استلم مكتب الرعية طلبك.')}</p>
        {Number.isNaN(updated.valueOf()) ? null : (
          <small>
            {L('Updated ', 'آخر تحديث: ') +
              new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB' : 'en-GB', {
                dateStyle: 'long',
                timeStyle: 'short'
              }).format(updated)}
          </small>
        )}
        {(d.files || []).length ? (
          <div className="track-files">
            {d.files.map(f => (
              <a
                key={f.id}
                className="btn btn-gilt"
                referrerPolicy="no-referrer"
                href={`/api/public/guest-files/${encodeURIComponent(token)}/${encodeURIComponent(f.id)}`}
                download
              >
                {L('Download', 'تنزيل')}: {f.name}
              </a>
            ))}
          </div>
        ) : null}
        <p className="track-note">
          {L(
            'Keep this page’s link private: anyone who has it can see this request.',
            'احتفظ برابط هذه الصفحة لنفسك: يستطيع كل من يملكه رؤية هذا الطلب.'
          )}
        </p>
      </div>
      {(d.letters || []).map(l => (
        <Letter key={l.code} l={l} />
      ))}
    </section>
  );
}

/* A letter from the parish office, with the writer's own signature and the code that checks it. */
const drawingPath = path => String(path || '').replace(/[^MLQCZmlqcz0-9 .,-]/g, '');

function Letter({ l }) {
  const { L, lang } = useSite(),
    sheet = useRef(null);
  const longDate = v => {
    const d = new Date(v);
    return Number.isNaN(d.valueOf())
      ? ''
      : new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB' : 'en-GB', { dateStyle: 'long' }).format(d);
  };
  const printLetter = () => {
    document.body.classList.add('is-printing-letter');
    sheet.current.classList.add('is-printing');
    print();
    setTimeout(() => {
      document.body.classList.remove('is-printing-letter');
      sheet.current?.classList.remove('is-printing');
    }, 500);
  };
  return (
    <article className="letter" aria-labelledby={`letter-${l.code}`} ref={sheet}>
      <header>
        <span className="letter-mark" aria-hidden="true">
          <svg viewBox="0 0 28 34" fill="none" focusable="false">
            <path d="M4 32V14a10 10 0 0 1 20 0v18" stroke="currentColor" strokeWidth="1.6" />
            <path d="M1 32.5h26" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="14" cy="20" r="3.2" fill="#D7A548" />
          </svg>
        </span>
        {l.parish?.name ? (
          <span className="letter-from">
            <b>{lang === 'ar' && l.parish.ar ? l.parish.ar : l.parish.name}</b>
            {l.parish.town ? <small>{l.parish.town}</small> : null}
          </span>
        ) : null}
        <time>{longDate(l.createdAt)}</time>
      </header>
      <h2 id={`letter-${l.code}`} dir="auto">
        {l.title}
      </h2>
      <div className="letter-body" dir="auto">
        {String(l.body ?? '')
          .split('\n')
          .map((line, i) => (i ? [<br key={i} />, line] : line))}
      </div>
      <footer>
        <div className="letter-signed">
          {l.drawing ? (
            <svg className="letter-sign" viewBox="0 0 400 140" aria-hidden="true" focusable="false">
              <path
                d={drawingPath(l.drawing)}
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
          <b>{l.name}</b>
          {l.role ? <span>{l.role}</span> : null}
        </div>
        <div className="letter-check">
          <span>{L('Digitally signed', 'موقّعة رقمياً')}</span>
          <a href={`public.html?verify=${encodeURIComponent(l.code)}`}>
            <bdi>{l.code}</bdi>
          </a>
          <small>
            {L('Anyone can check this code on ParishLife.', 'يمكن لأي شخص التحقّق من هذا الرمز على ParishLife.')}
          </small>
        </div>
      </footer>
      <button type="button" className="btn btn-ink-line btn-small letter-print" data-print-letter onClick={printLetter}>
        {L('Print or save as PDF', 'طباعة أو حفظ كـPDF')}
      </button>
    </article>
  );
}
