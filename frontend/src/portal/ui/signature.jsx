/* A handwritten signature: drawn as a path on a 400 × 140 page, and the pad it is drawn on with a
   finger, a pen or a mouse. Each stroke is smoothed into quadratic curves through the midpoints of
   what was drawn. */
import { forwardRef, useImperativeHandle, useRef } from 'react';

const clean = path => String(path || '').replace(/[^MLQCZmlqcz0-9 .,-]/g, '');
export const Drawing = ({ path, cls = 'sig-drawing' }) => (
  <svg className={cls} viewBox="0 0 400 140" aria-hidden="true" focusable="false">
    <path
      d={clean(path)}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const smooth = pts => {
  if (pts.length < 3) return `M${pts[0][0]} ${pts[0][1]}L${(pts.at(-1)[0] + 0.1).toFixed(1)} ${pts.at(-1)[1]}`;
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++)
    d += `Q${pts[i][0]} ${pts[i][1]} ${((pts[i][0] + pts[i + 1][0]) / 2).toFixed(1)} ${((pts[i][1] + pts[i + 1][1]) / 2).toFixed(1)}`;
  return d + `L${pts.at(-1)[0]} ${pts.at(-1)[1]}`;
};
/** The pad. Its handle gives path(), empty() and clear(); onDraw runs after every stroke moves. */
export const SignaturePad = forwardRef(function SignaturePad({ onDraw, children, ...props }, ref) {
  const svg = useRef(null),
    line = useRef(null),
    strokes = useRef([]),
    current = useRef(null);
  const paint = () => {
    line.current.setAttribute('d', strokes.current.map(smooth).join(''));
    onDraw?.();
  };
  const at = e => {
    const r = svg.current.getBoundingClientRect();
    return [
      Math.round(((e.clientX - r.left) / r.width) * 4000) / 10,
      Math.round(((e.clientY - r.top) / r.height) * 1400) / 10
    ];
  };
  useImperativeHandle(ref, () => ({
    path: () => strokes.current.map(smooth).join(''),
    empty: () => !strokes.current.some(s => s.length > 2),
    clear: () => {
      strokes.current = [];
      paint();
    }
  }));
  const end = () => {
    current.current = null;
  };
  return (
    <svg
      ref={svg}
      viewBox="0 0 400 140"
      {...props}
      onPointerDown={e => {
        e.preventDefault();
        svg.current.setPointerCapture(e.pointerId);
        current.current = [at(e)];
        strokes.current.push(current.current);
        paint();
      }}
      onPointerMove={e => {
        if (!current.current) return;
        const p = at(e),
          last = current.current.at(-1);
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 2.5) {
          current.current.push(p);
          paint();
        }
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {children}
      <path
        ref={line}
        d=""
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});
