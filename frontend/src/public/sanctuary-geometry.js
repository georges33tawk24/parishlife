/* The sanctuary's geometry, in the window's units (a viewBox of -40 0 1080 1300): the glass
   openings, and the shafts of light they throw. The scene draws them (Sanctuary.jsx) and the
   dust drifts through them (motion.js). */

export const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export const r1 = v => Math.round(v * 10) / 10;
export const polar = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
export const pts = list => list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ');

/* The glass openings: the rose with its two small roundels, and the two lancets. */
export const GLASS = {
  rose: [{ cx: 500, cy: 330, r: 206 }, { cx: 185, cy: 445, r: 48 }, { cx: 815, cy: 445, r: 48 }],
  left: 'M120 1170V760A175 175 0 0 1 470 760V1170Z',
  right: 'M530 1170V760A175 175 0 0 1 880 760V1170Z'
};
/* The same openings as SVG markup, for masks drawn outside React. */
export const GLASS_MARKUP = GLASS.rose.map(c => `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}"/>`).join('') + `<path d="${GLASS.left}"/><path d="${GLASS.right}"/>`;

/* Where the light falls: each shaft is the window opening drawn out along the sun's direction. */
const SUN = (() => { const x = -0.72, y = 1, l = Math.hypot(x, y); return [x / l, y / l]; })();
const arch = (x0, w, cy, bottom) => { const r = w / 2, out = []; for (let i = 0; i <= 12; i++) out.push(polar(x0 + r, cy, r, Math.PI + i * Math.PI / 12)); out.push([x0 + w, bottom], [x0, bottom]); return out; };
const circle = (cx, cy, r) => Array.from({ length: 16 }, (_, i) => polar(cx, cy, r, i * Math.PI / 8));
export const BEAMS = [
  { shape: circle(500, 330, 200), length: 1900, tint: ['255 210 150', '232 160 190'], k: 'rose' },
  { shape: arch(120, 350, 760, 1170), length: 1300, tint: ['150 175 255', '170 140 240'], k: 'left' },
  { shape: arch(530, 350, 760, 1170), length: 1300, tint: ['255 205 120', '255 170 110'], k: 'right' }
];
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
/* The shaft's outline in window units, a little wider where it lands. */
export function beamOutline(beam) {
  const [sx, sy] = beam.shape.reduce(([a, b], [x, y]) => [a + x / beam.shape.length, b + y / beam.shape.length], [0, 0]);
  const far = beam.shape.map(([x, y]) => [sx + (x - sx) * 1.25 + SUN[0] * beam.length, sy + (y - sy) * 1.25 + SUN[1] * beam.length]);
  return { outline: hull([...beam.shape, ...far]), from: [sx, sy], to: [sx + SUN[0] * beam.length, sy + SUN[1] * beam.length] };
}
