/* The parts every page of the public site (design A3) shares: its line icons, the dropdown it draws
   itself instead of the phone's or computer's menu, the breadcrumbs, the title band at the top of a
   page, and the photograph with words over it.
   Main exports: A3Icon, Select, Crumbs, Band, PhotoHero. */
import { useEffect, useId, useRef, useState } from 'react';

const PATHS = {
  cal: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  calplus: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4M12 12.5v5M9.5 15h5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  map: (
    <>
      <path d="M9 4L3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </>
  ),
  near: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
      <circle cx="12" cy="12" r="7.5" />
    </>
  ),
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" />
    </>
  ),
  send: (
    <>
      <path d="M21 3L10 14" />
      <path d="M21 3l-7 18-4-7-7-4z" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  filecheck: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 14.5l2 2 4-4" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  prev: <path d="M15 6l-6 6 6 6" />,
  next: <path d="M9 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  church: (
    <>
      <path d="M12 2v4M10 4h4" />
      <path d="M6 21V11l6-4 6 4v10M3 21h18" />
      <path d="M10 21v-4a2 2 0 0 1 4 0v4" />
    </>
  ),
  star: <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7z" />,
  cross: <path d="M12 3v18M7 8.5h10" />,
  inbox: (
    <>
      <path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M3 13h5l1.5 2.5h5L16 13h5" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </>
  ),
  nopay: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M4 4l16 16" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M17 6l3 3M15 8l2 2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" />
    </>
  ),
  seal: (
    <>
      <path d="M12 3l2.3 1.7 2.8-.2.9 2.7 2.3 1.6-.8 2.7.8 2.7-2.3 1.6-.9 2.7-2.8-.2L12 21l-2.3-1.7-2.8.2-.9-2.7-2.3-1.6.8-2.7-.8-2.7 2.3-1.6.9-2.7 2.8.2z" />
      <path d="M8.5 12.3l2.4 2.4 4.6-4.9" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M3 20a6 6 0 0 1 12 0M14.5 14.5A5 5 0 0 1 21 19" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />,
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  )
};
/* The play triangle is filled; every other icon is a line drawing. */
export function A3Icon({ name, size }) {
  if (name === 'play')
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" width={size} height={size}>
        <path d="M8 5v14l11-7z" />
      </svg>
    );
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
    >
      {PATHS[name] || PATHS.info}
    </svg>
  );
}

const Chevron = () => (
  <svg
    viewBox="0 0 18 18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 7l5 5 5-5" />
  </svg>
);
const Tick = () => (
  <svg
    className="tick"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 10.5l4 4 8-9" />
  </svg>
);

/* A dropdown the site draws itself: a button showing the choice, and a list of large rows (an optional
   second line under each), a tick on the chosen one. Arrow keys, Home and End move through the list;
   Escape, a choice, or a tap anywhere else closes it. options: [{ value, label, sub }].
   label is the visible label's text; hideLabel keeps it for screen readers only. */
export function Select({ id, label, hideLabel = false, value, options, onChange, className = '', labelClass = 'lbl' }) {
  const auto = 'dd' + useId().replace(/:/g, '');
  const base = id || auto;
  const [open, setOpen] = useState(false);
  const box = useRef(null),
    button = useRef(null),
    focusAt = useRef(-1);
  const index = Math.max(
    0,
    options.findIndex(o => o.value === value)
  );
  const current = options[index];
  useEffect(() => {
    if (!open) return undefined;
    const list = box.current.querySelectorAll('[role="option"]');
    list[focusAt.current >= 0 ? focusAt.current : index]?.focus();
    const outside = e => {
      if (!box.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current.focus();
  };
  const keys = e => {
    const k = e.key;
    if (k === 'Escape' && open) {
      e.preventDefault();
      close();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(k)) return;
    e.preventDefault();
    if (!open) {
      focusAt.current = -1;
      setOpen(true);
      return;
    }
    const list = [...box.current.querySelectorAll('[role="option"]')];
    const at = list.indexOf(document.activeElement);
    const next =
      k === 'Home'
        ? 0
        : k === 'End'
          ? list.length - 1
          : k === 'ArrowDown'
            ? Math.min((at < 0 ? index : at) + 1, list.length - 1)
            : Math.max((at < 0 ? index : at) - 1, 0);
    list[next]?.focus();
  };
  return (
    <div className={className}>
      <label id={base + '-l'} htmlFor={base} className={hideLabel ? 'sr-only' : labelClass}>
        {label}
      </label>
      <div
        className="dd"
        ref={box}
        onKeyDown={keys}
        onBlur={e => {
          if (open && e.relatedTarget && !box.current.contains(e.relatedTarget)) setOpen(false);
        }}
      >
        <button
          type="button"
          id={base}
          ref={button}
          className={'field dd-btn' + (open ? ' is-open' : '')}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={base + '-l ' + base}
          onClick={() => {
            focusAt.current = -1;
            setOpen(!open);
          }}
        >
          <span className="dd-val">
            {current
              ? [current.label, current.sub].filter(Boolean).join(document.documentElement.lang === 'ar' ? '، ' : ', ')
              : ''}
          </span>
          <span className="dd-chev" aria-hidden="true">
            <Chevron />
          </span>
        </button>
        {open ? (
          <ul className="dd-list" role="listbox" aria-labelledby={base + '-l'}>
            {options.map((o, i) => (
              <li role="none" key={String(o.value)}>
                <button
                  type="button"
                  role="option"
                  id={base + '-o' + i}
                  aria-selected={i === index}
                  className="dd-opt"
                  onClick={() => {
                    onChange(o.value);
                    close();
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span className="dd-main">{o.label}</span>
                    {o.sub ? <span className="dd-sub">{o.sub}</span> : null}
                  </span>
                  <Tick />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/* Where this page sits: links back up, and this page's name. */
export function Crumbs({ L, items }) {
  return (
    <nav aria-label={L('Breadcrumb', 'مسار التنقّل')}>
      <ol className="crumbs">
        {items.map(([label, href], i) => (
          <li key={i} style={{ display: 'contents' }}>
            {i ? <span aria-hidden="true">/</span> : null}
            {href ? <a href={href}>{label}</a> : <span aria-current="page">{label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* The top of an inner page: breadcrumbs, the title in wine, a line under it, and a gold rule. */
export function Band({ L, crumbs, title, lede, children, docTitle }) {
  return (
    <section className="band-wrap" aria-labelledby="pg-title" data-doc-title={docTitle}>
      <div className="wrap band">
        <Crumbs L={L} items={crumbs} />
        <h1 id="pg-title" className="h1">
          {title}
        </h1>
        {lede ? <p className="lede">{lede}</p> : null}
        {children}
      </div>
      <div className="strip" aria-hidden="true"></div>
    </section>
  );
}

/* A photograph across the page, darkened on the side the words sit, with breadcrumbs above them. */
export function PhotoHero({ L, crumbs, image = 'img-interior', photo, children, docTitle, className = '' }) {
  return (
    <section
      className={`photo-hero on-photo dark ${photo ? '' : image} ${className}`}
      style={photo ? { backgroundImage: `url("${photo}")` } : undefined}
      aria-labelledby="pg-title"
      data-doc-title={docTitle}
    >
      <div className="shade" aria-hidden="true"></div>
      <div className="wrap" style={{ paddingTop: 14, paddingBottom: 56 }}>
        {crumbs ? <Crumbs L={L} items={crumbs} /> : null}
        {children}
      </div>
    </section>
  );
}
