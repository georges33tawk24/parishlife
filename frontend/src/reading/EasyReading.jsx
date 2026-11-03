/* Easier reading, on the public site and the sign-in screen: the size of the text (A, A+, A++)
   and Simple view (nothing moves on its own, and the usual mouse pointer), remembered on this
   device. The page's head applies the choice before the first frame (see the inline script in
   public.html and index.html); this is the control in the header that changes it.

   html[data-text="2"|"3"] scales every font size on the page (--fs in site.css and auth.css);
   html[data-simple] stops the motion (motion.js, church.css, auth.css). */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

const root = document.documentElement;
const read = key => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* private mode */
  }
};
export function applyReading() {
  const size = read('pl-text');
  if (size === '2' || size === '3') root.dataset.text = size;
  else delete root.dataset.text;
  if (read('pl-simple') === '1') root.dataset.simple = '';
  else delete root.dataset.simple;
}

const WORDS = {
  en: {
    button: 'Text size',
    title: 'Easier reading',
    size: 'Text size',
    sizes: ['Normal text', 'Larger text', 'Largest text'],
    simple: 'Simple view',
    hint: 'Nothing moves on its own, and the usual mouse pointer'
  },
  ar: {
    button: 'حجم الخط',
    title: 'قراءة أسهل',
    size: 'حجم الخط',
    sizes: ['نص عادي', 'نص أكبر', 'أكبر نص'],
    simple: 'عرض مبسّط',
    hint: 'لا شيء يتحرّك من تلقاء نفسه، ومؤشّر الفأرة المعتاد'
  }
};

export function EasyReading({ lang }) {
  const w = WORDS[lang === 'ar' ? 'ar' : 'en'],
    id = 'ease' + useId().replace(/:/g, '');
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(() => root.dataset.text || '1');
  const slot = useRef(null),
    toggle = useRef(null),
    panel = useRef(null);
  const simple = 'simple' in root.dataset;

  /* an open panel stays on the screen: on a phone the button sits near one edge, and the panel,
     hung from the button's side, would otherwise reach past the other */
  const place = () => {
    const box = panel.current;
    if (!box || box.hidden) return;
    const gap = 12,
      width = root.clientWidth;
    box.style.transform = '';
    const r = box.getBoundingClientRect();
    const shift = r.left < gap ? gap - r.left : r.right > width - gap ? width - gap - r.right : 0;
    if (shift) box.style.transform = `translateX(${Math.round(shift)}px)`;
  };
  useLayoutEffect(() => {
    if (open) {
      place();
      panel.current.querySelector('[aria-pressed="true"]')?.focus();
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = e => {
      if (!slot.current.contains(e.target)) setOpen(false);
    };
    const escape = e => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggle.current.focus();
      }
    };
    document.addEventListener('click', outside);
    document.addEventListener('keydown', escape);
    addEventListener('resize', place);
    return () => {
      document.removeEventListener('click', outside);
      document.removeEventListener('keydown', escape);
      removeEventListener('resize', place);
    };
  }, [open]);

  const choose = next => {
    write('pl-text', next === '1' ? '' : next);
    applyReading();
    setSize(next);
    dispatchEvent(new Event('resize')); // the page measures itself again at the new size
  };
  return (
    <div className="ease" data-ease-slot ref={slot}>
      <button
        type="button"
        className="ease-toggle"
        data-ease-toggle
        aria-expanded={open}
        aria-controls={id}
        ref={toggle}
        onClick={() => setOpen(!open)}
      >
        <span className="ease-glyph" aria-hidden="true">
          A<small>A</small>
        </span>
        <span className="ease-word">{w.button}</span>
      </button>
      <div className="ease-panel" id={id} role="group" aria-labelledby={`${id}-title`} hidden={!open} ref={panel}>
        <p className="ease-title" id={`${id}-title`}>
          {w.title}
        </p>
        <p className="ease-label" id={`${id}-size`}>
          {w.size}
        </p>
        <div className="ease-sizes" role="group" aria-labelledby={`${id}-size`}>
          {['A', 'A+', 'A++'].map((t, i) => (
            <button
              key={t}
              type="button"
              data-text-size={i + 1}
              aria-pressed={String(i + 1) === size}
              aria-label={w.sizes[i]}
              onClick={() => choose(String(i + 1))}
            >
              <span className={`ease-a ease-a${i + 1}`} aria-hidden="true">
                {t}
              </span>
            </button>
          ))}
        </div>
        <label className="ease-simple">
          <input
            type="checkbox"
            data-simple-view
            defaultChecked={simple}
            onChange={e => {
              write('pl-simple', e.target.checked ? '1' : '');
              applyReading();
              location.reload(); // the page's motion is set up as it loads, so it loads again without it
            }}
          />
          <span>
            <b>{w.simple}</b>
            <small>{w.hint}</small>
          </span>
        </label>
      </div>
    </div>
  );
}
