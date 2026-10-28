/* The homepage sanctuary: a stone wall at night, a stained-glass window (a rose with the cross
   above two lancets, the cedar of Lebanon and the chalice), the light it lets in, a sanctuary
   lamp, and candles on the window sill: one lit candle for each parish on ParishLife. The window
   is a rendered picture (assets/images/sanctuary); the rest is drawn here in SVG and CSS. Motion
   lives in home-motion.js; assets/sanctuary.css holds the styles. */

import { season } from './liturgy.js';

const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const r1 = v => Math.round(v * 10) / 10;
const polar = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
const pts = list => list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ');

/* The glass openings, in the window's units (a viewBox of -40 0 1080 1300). */
const GLASS_SHAPES = {
  rose: '<circle cx="500" cy="330" r="206"/><circle cx="185" cy="445" r="48"/><circle cx="815" cy="445" r="48"/>',
  left: '<path d="M120 1170V760A175 175 0 0 1 470 760V1170Z"/>',
  right: '<path d="M530 1170V760A175 175 0 0 1 880 760V1170Z"/>'
};
export const GLASS_OPENINGS = GLASS_SHAPES;
const glassClip = id => `<clipPath id="${id}">${Object.values(GLASS_SHAPES).join('')}</clipPath>`;

/* The window is a picture, rendered from its design (docs/tools/sanctuary_window.mjs and
   render_sanctuary.py): the cedar and the chalice under the rose. A parish's own window has the
   cedar on the right and the parish's initial in gold glass over the left medallion, on a ground
   of its own colour. Arabic mirrors the window, so the letter is turned back to read rightly. */
const IMAGES = 'assets/images/sanctuary/';
const GROUNDS = ['deep', 'wine', 'moss', 'violet'];
const seedOf = text => [...String(text)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
function initialGlass(ch) {
  const rtl = document.documentElement.dir === 'rtl', ar = /[\u0600-\u06FF]/.test(ch), mx = 295, my = 920;
  return `<svg class="sn-initial" viewBox="-40 0 1080 1300" aria-hidden="true" focusable="false"><defs>
    <linearGradient id="sn-gilt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF2C4"/><stop offset=".42" stop-color="#F7CB62"/><stop offset="1" stop-color="#D9901F"/></linearGradient>
    <filter id="sn-streak" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".012 .07" numOctaves="3" seed="9"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .32  0 0 0 0 .05  0 0 0 -.7 .62"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs>
    <text x="${mx}" y="${my + (ar ? 30 : 44)}" text-anchor="middle" font-family="${ar ? 'Amiri, serif' : 'Marcellus, Georgia, serif'}" font-weight="${ar ? 700 : 400}" font-size="${ar ? 128 : 124}" fill="url(#sn-gilt)" stroke="#140D0B" stroke-width="5" stroke-linejoin="round" paint-order="stroke"${rtl ? ` transform="translate(${mx * 2} 0) scale(-1 1)"` : ''}>${ch}</text>
    <text x="${mx}" y="${my + (ar ? 30 : 44)}" text-anchor="middle" font-family="${ar ? 'Amiri, serif' : 'Marcellus, Georgia, serif'}" font-weight="${ar ? 700 : 400}" font-size="${ar ? 128 : 124}" fill="#E9A33A" filter="url(#sn-streak)"${rtl ? ` transform="translate(${mx * 2} 0) scale(-1 1)"` : ''}>${ch}</text></svg>`;
}
function windowPicture({ seed = '', initial = '' }) {
  if (initial) {
    const ground = seed ? GROUNDS[seedOf(seed) % GROUNDS.length] : GROUNDS[0];
    return `<img class="sn-window-img" src="${IMAGES}parish-${ground}-1080.webp" alt="" decoding="async" fetchpriority="high" draggable="false">${initialGlass(initial)}`;
  }
  return `<img class="sn-window-img" src="${IMAGES}window-1080.webp" srcset="${IMAGES}window-1080.webp 1080w, ${IMAGES}window-1620.webp 1620w" sizes="(max-width: 1099px) 86vw, 44vh" alt="" decoding="async" fetchpriority="high" draggable="false">`;
}

/* The light through the glass: clouds passing, the brightness behind, the warmth of morning that
   comes as the page scrolls, and the dark each pane starts from before it lights. */
function lightSVG() {
  return `<svg class="sn-light" viewBox="-40 0 1080 1300" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="sn-back" cx="50%" cy="40%" r="62%"><stop offset="0" stop-color="#FFF7DE" stop-opacity=".26"/><stop offset=".5" stop-color="#FFE3B0" stop-opacity=".08"/><stop offset="1" stop-color="#FFE3B0" stop-opacity="0"/></radialGradient>
      <radialGradient id="sn-sun" cx="50%" cy="36%" r="64%"><stop offset="0" style="stop-color:var(--sun-a)" stop-opacity=".45"/><stop offset=".55" style="stop-color:var(--sun-b)" stop-opacity=".16"/><stop offset="1" style="stop-color:var(--sun-b)" stop-opacity="0"/></radialGradient>
      <radialGradient id="sn-warm" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#FFC56A" stop-opacity=".3"/><stop offset="1" stop-color="#FF9A3C" stop-opacity="0"/></radialGradient>
      <linearGradient id="sn-cloud" x1="0" y1="0" x2="1" y2=".35"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".22" stop-color="#000" stop-opacity=".24"/><stop offset=".4" stop-color="#000" stop-opacity="0"/><stop offset=".62" stop-color="#000" stop-opacity=".18"/><stop offset=".8" stop-color="#000" stop-opacity="0"/></linearGradient>
      ${glassClip('sn-glass-light')}
    </defs>
    <g clip-path="url(#sn-glass-light)">
      <rect class="sn-clouds" x="-1000" y="0" width="3000" height="1200" fill="url(#sn-cloud)"/>
      <rect class="sn-backlight" x="-100" y="0" width="1200" height="1200" fill="url(#sn-back)"/>
      <rect class="sn-sun" x="0" y="0" width="1000" height="1200" fill="url(#sn-sun)"/>
      <rect class="sn-dawn" x="0" y="0" width="1000" height="1200" fill="url(#sn-warm)"/>
    </g>
    <g fill="#070505">${Object.values(GLASS_SHAPES).map(shape => `<g class="sn-dark">${shape}</g>`).join('')}</g>
  </svg>`;
}

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
function beamsMarkup() {
  return BEAMS.map((beam, i) => {
    const { outline, from, to } = beamOutline(beam);
    return `<svg class="sn-beam sn-beam-${beam.k}" viewBox="-1600 0 2640 2100" aria-hidden="true" focusable="false"><defs><linearGradient id="sn-beam-${i}" gradientUnits="userSpaceOnUse" x1="${r1(from[0])}" y1="${r1(from[1])}" x2="${r1(to[0])}" y2="${r1(to[1])}">
      <stop offset=".08" stop-color="rgb(${beam.tint[0]})" stop-opacity="0"/><stop offset=".3" stop-color="rgb(${beam.tint[0]})" style="stop-opacity:calc(.4 * var(--beam-k, 1))"/><stop offset=".66" stop-color="rgb(${beam.tint[1]})" style="stop-opacity:calc(.14 * var(--beam-k, 1))"/><stop offset="1" stop-color="rgb(${beam.tint[1]})" stop-opacity="0"/></linearGradient></defs>
      <polygon points="${pts(outline)}" fill="url(#sn-beam-${i})"/></svg>`;
  }).join('');
}

/* The sanctuary lamp, hanging on its chains, with the red glass that says the Lord is here. */
function lampMarkup() {
  const links = Array.from({ length: 30 }, (_, i) => `<rect x="${i % 2 ? 28.6 : 27.4}" y="${i * 9}" width="${i % 2 ? 2.8 : 5.2}" height="10" rx="2.6" fill="none" stroke="#9C7A3C" stroke-width="1.6"/>`).join('');
  return `<div class="sn-lamp" aria-hidden="true"><svg viewBox="0 0 60 380" focusable="false">
    <defs><radialGradient id="sn-ruby" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#FF8A6A"/><stop offset=".45" stop-color="#C21D2C"/><stop offset="1" stop-color="#5A0B16"/></radialGradient>
      <linearGradient id="sn-brass" x1="0" x2="1"><stop offset="0" stop-color="#6E4E1C"/><stop offset=".45" stop-color="#E2B860"/><stop offset=".6" stop-color="#B98B3A"/><stop offset="1" stop-color="#5A3F15"/></linearGradient></defs>
    ${links}
    <path d="M30 270L12 304M30 270L48 304M30 270V304" stroke="#9C7A3C" stroke-width="1.4"/>
    <path d="M8 304h44l-3 8H11Z" fill="url(#sn-brass)"/>
    <path d="M13 312h34c0 24-7 40-17 44c-10-4-17-20-17-44Z" fill="url(#sn-ruby)"/>
    <ellipse class="sn-lamp-flame" cx="30" cy="326" rx="4" ry="7" fill="#FFE7A6"/>
    <path d="M24 356h12l-6 14Z" fill="url(#sn-brass)"/><circle cx="30" cy="372" r="3.4" fill="url(#sn-brass)"/>
  </svg><i class="sn-lamp-glow"></i></div>`;
}

/* The nave in shadow: a blind arcade of round arches on pilasters, carved into the same wall.
   It only adds light and shade over the stones, so the wall's texture shows through it. */
function arcadeSVG() {
  const bays = [[-330, 70], [70, 470], [470, 870]], spring = 430, out = [];
  out.push(`<defs><linearGradient id="sn-niche" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".55" stop-color="#000" stop-opacity=".34"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>
    <linearGradient id="sn-pier" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFE6C0" stop-opacity=".11"/><stop offset=".7" stop-color="#FFE6C0" stop-opacity=".04"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient></defs>`);
  for (const [x0, x1] of bays) {
    const r = (x1 - x0) / 2 - 34, cx = (x0 + x1) / 2, l = cx - r, rr = cx + r;
    out.push(`<path d="M${l} 1000V${spring}A${r} ${r} 0 0 1 ${rr} ${spring}V1000Z" fill="url(#sn-niche)"/>`,
      `<path d="M${l - 16} ${spring}A${r + 16} ${r + 16} 0 0 1 ${rr + 16} ${spring}" fill="none" stroke="#FFE6C0" stroke-opacity=".09" stroke-width="10"/>`,
      `<path d="M${l} ${spring}A${r} ${r} 0 0 1 ${rr} ${spring}" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="5"/>`);
  }
  for (const x of [70, 470, 870]) {
    out.push(`<rect x="${x - 34}" y="${spring + 26}" width="68" height="${1000 - spring - 26}" fill="url(#sn-pier)"/>`,
      `<path d="M${x - 46} ${spring}h92l-8 26h-76Z" fill="#FFE6C0" fill-opacity=".1" stroke="#000" stroke-opacity=".4" stroke-width="2"/>`,
      `<path d="M${x - 44} 962h88v38h-88Z" fill="#FFE6C0" fill-opacity=".06"/>`);
  }
  return `<svg class="sn-arcade-svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMinYMax slice" aria-hidden="true" focusable="false">${out.join('')}</svg>`;
}

/* Incense in the light: the shafts as a soft mask over a drifting haze (the haze itself is a
   texture made on the visitor's device, see mountSanctuary). */
function hazeMask() {
  const shapes = BEAMS.map((beam, i) => {
    const { outline, from, to } = beamOutline(beam);
    return `<linearGradient id="h${i}" gradientUnits="userSpaceOnUse" x1="${r1(from[0])}" y1="${r1(from[1])}" x2="${r1(to[0])}" y2="${r1(to[1])}"><stop offset=".24" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity=".8"/><stop offset=".74" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><polygon points="${pts(outline)}" fill="url(#h${i})"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1600 0 2640 2100"><filter id="b"><feGaussianBlur stdDeviation="26"/></filter><g filter="url(#b)">${shapes}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/* A soft, seamless haze: smoothed value noise on a wrapped lattice, white with varying alpha. */
function hazeTexture() {
  const size = 256, cells = 6, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), img = ctx.createImageData(size, size), random = rng(23);
  const octave = n => { const g = Array.from({ length: n * n }, () => random()); return (x, y) => {
    const fx = x * n, fy = y * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const at = (i, j) => g[((j % n + n) % n) * n + ((i % n + n) % n)];
    return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
  }; };
  const layers = [octave(cells), octave(cells * 2), octave(cells * 4)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = layers[0](x / size, y / size) * .58 + layers[1](x / size, y / size) * .28 + layers[2](x / size, y / size) * .14;
    const k = (y * size + x) * 4, a = Math.max(0, v - .42) * 1.5;
    img.data[k] = 255; img.data[k + 1] = 244; img.data[k + 2] = 226; img.data[k + 3] = Math.round(Math.min(1, a) * 255);
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/* What the season brings into the sanctuary (pictures rendered by docs/tools/render_seasons.py): in
   the Season of the Holy Cross a cross of light on the wall; at the Birth and the Epiphany the star
   over the window; in Lent and Passion Week a violet veil across it; at the Resurrection the paschal
   candle, bearing the Alpha, the Omega and the year. Only one shows (CSS). */
function seasonMarkup() {
  const year = [...String(new Date().getFullYear())].map((digit, i) => `<b class="sn-pa-year sn-pa-y${i}">${digit}</b>`).join('');
  return `<div class="sn-season" aria-hidden="true">
    <span class="sn-cross-light"></span>
    <span class="sn-star"></span>
    <span class="sn-veil"></span>
    <span class="sn-paschal"><i class="sn-paschal-flame"></i><b class="sn-pa-alpha">\u0391</b><b class="sn-pa-omega">\u03A9</b>${year}</span>
  </div>`;
}

export function sanctuaryMarkup({ inscription = '', seed = '', initial = '' } = {}) {
  return `<div class="sanctuary" data-sanctuary aria-hidden="true">
    <div class="sn-wall"></div>
    <div class="sn-arcade">${arcadeSVG()}</div>
    <div class="sn-spill"></div>
    <div class="sn-stage" data-sn-stage>
      <div class="sn-bloom"></div>
      <div class="sn-window">${windowPicture({ seed, initial })}${lightSVG()}</div>
      ${inscription ? `<p class="sn-inscription">${inscription.replace(/[&<>"']/g, '')}</p>` : ''}
      <div class="sn-beams">${beamsMarkup()}<div class="sn-haze" style='--mask:${hazeMask()}'><i data-sn-haze></i></div></div>
      <div class="sn-candles" data-sn-candles></div>
      ${seasonMarkup()}
      ${lampMarkup()}
    </div>
  </div>`;
}

/* places: [{id, name, town}]. Each parish lights one candle on the sill; the empty places keep
   unlit candles, and a visitor may light one. Returns a controller like the valley's. */
/* The light through the glass follows the hour in Beirut: moonlight, dawn, day or evening.
   ?light=dawn (or day, dusk, night) shows another hour. */
export function lightNow(date = new Date()) {
  const asked = new URLSearchParams(location.search).get('light');
  if (['night', 'dawn', 'day', 'dusk'].includes(asked)) return asked;
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Beirut', hour: 'numeric', hourCycle: 'h23' }).format(date));
  return hour >= 5 && hour < 8 ? 'dawn' : hour >= 8 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'dusk' : 'night';
}

/* The season of the Church's year in Beirut today (?season= shows another). */
export function seasonNow(date = new Date()) {
  const asked = new URLSearchParams(location.search).get('season');
  if (['church', 'birth', 'epiphany', 'lent', 'passion', 'resurrection', 'pentecost', 'cross'].includes(asked)) return asked;
  return season(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Beirut' }).format(date)).id;
}

export function mountSanctuary(host, places, { tip, onPick, words, lit = 0 }) {
  const box = host.querySelector('[data-sn-candles]');
  if (!box) return { destroy() {} };
  const scene = host.querySelector('[data-sanctuary]');
  scene.dataset.light = lightNow();
  scene.dataset.season = seasonNow();
  host._beams = BEAMS.map(beamOutline);   // for the dust in the light (home-motion.js)
  const random = rng(places.length + 3), total = Math.min(40, Math.max(9, places.length + 5));
  // the parishes stand in the middle of the sill, the unlit candles to either side
  const order = Array.from({ length: total }, (_, i) => i).sort((a, b) => Math.abs(a - (total - 1) / 2) - Math.abs(b - (total - 1) / 2));
  const parishAt = new Map(order.slice(0, places.length).map((slot, i) => [slot, places[i]]));
  box.innerHTML = Array.from({ length: total }, (_, i) => {
    const p = parishAt.get(i), h = p ? 70 + random() * 34 : 34 + random() * 36;
    const lean = (random() * 2 - 1) * (p ? 2.6 : 4), x = 6 + (i + .5) * 88 / total + (random() - .5) * 1.2;
    return `<span class="sn-candle${p ? ' is-lit is-parish' : !p && i % 3 === 1 && i / 3 < lit ? ' is-lit' : ''}" style="--x:${r1(x)}%;--h:${r1(h)};--lean:${r1(lean)}deg;--d:${r1(1.7 + random() * 1.6)}s;--o:${r1(-random() * 3)}s"${p ? ` data-candle="${i}"` : ''}><i class="sn-flame"></i><b class="sn-halo"></b></span>`;
  }).join('') + '<span class="sn-tray" data-sn-tray></span>';
  const haze = host.querySelector('[data-sn-haze]');
  if (haze && !document.documentElement.classList.contains('is-lite')) haze.style.backgroundImage = `url(${hazeTexture()})`;
  // each lit candle throws a little light on the brass beneath it
  const tray = box.querySelector('[data-sn-tray]');
  const glints = () => { tray.style.setProperty('--glints', [...box.querySelectorAll('.sn-candle.is-lit')].map(el => `radial-gradient(ellipse 6% 90% at ${el.style.getPropertyValue('--x')} 10%,rgb(255 214 150 / .62),rgb(255 214 150 / 0) 72%)`).join(',') || 'none'); };
  glints();
  const watch = new MutationObserver(glints);
  watch.observe(box, { subtree: true, attributes: true, attributeFilter: ['class'] });
  const show = (el, text) => {
    if (!tip || !text) return;
    const r = el.getBoundingClientRect(), b = (host.closest('[data-hero]') || host).getBoundingClientRect();
    tip.textContent = text; tip.hidden = false;
    tip.style.left = (r.left + r.width / 2 - b.left) + 'px';
    tip.style.top = (r.top - b.top - 8) + 'px';
  };
  const hide = () => { tip.hidden = true; };
  const off = [];
  box.querySelectorAll('.sn-candle').forEach(el => {
    const p = parishAt.get(Number(el.dataset.candle));
    const enter = () => show(el, p ? (p.town ? `${p.name}, ${p.town}` : p.name) : el.classList.contains('is-lit') ? words.lit : words.light);
    const click = () => {
      if (p) return onPick(p.id);
      if (el.classList.contains('is-lit')) return;
      el.classList.add('is-lit', 'is-lighting');
      show(el, words.lit);
      host.dispatchEvent(new CustomEvent('sn-lit', { detail: el }));
    };
    el.addEventListener('pointerenter', enter); el.addEventListener('pointerleave', hide); el.addEventListener('click', click);
    off.push(() => { el.removeEventListener('pointerenter', enter); el.removeEventListener('pointerleave', hide); el.removeEventListener('click', click); });
  });
  return { destroy() { watch.disconnect(); off.forEach(fn => fn()); } };
}

/* The rose window again, drawn in gold lines, for the verse further down the page. */
export function roseOutline() {
  const spokes = [], lobes = [], petals = [];
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 6, b = a + Math.PI / 12;
    const [x0, y0] = polar(0, 0, 150, b), [x1, y1] = polar(0, 0, 236, b);
    spokes.push(`M${r1(x0)} ${r1(y0)}L${r1(x1)} ${r1(y1)}`);
    const [lx, ly] = polar(0, 0, 193, a);
    lobes.push(`<circle cx="${r1(lx)}" cy="${r1(ly)}" r="34"/><circle cx="${r1(lx)}" cy="${r1(ly)}" r="12"/>`);
    const [px, py] = polar(0, 0, 150, a), [qx, qy] = polar(0, 0, 70, a - .2), [sx, sy] = polar(0, 0, 70, a + .2);
    petals.push(`M${r1(qx)} ${r1(qy)}Q${r1(polar(0, 0, 120, a - .34)[0])} ${r1(polar(0, 0, 120, a - .34)[1])} ${r1(px)} ${r1(py)}Q${r1(polar(0, 0, 120, a + .34)[0])} ${r1(polar(0, 0, 120, a + .34)[1])} ${r1(sx)} ${r1(sy)}`);
  }
  return `<svg viewBox="-260 -260 520 520" fill="none" stroke="currentColor" stroke-width="1.6" focusable="false"><circle r="252"/><circle r="240"/><circle r="150"/><circle r="70"/><circle r="62"/>
    <path d="${spokes.join('')}${petals.join('')}"/>${lobes.join('')}<path d="M0 -44V44M-44 0H44" stroke-width="3"/></svg>`;
}

/* Gold mosaic, as in the apse of an old church: small tesserae of gold leaf and glass, a little
   uneven, set in dark grout. Made on the visitor's device as a seamless tile. */
export function mosaicTexture() {
  const size = 240, step = 10, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), random = rng(41);
  ctx.fillStyle = '#5A4320'; ctx.fillRect(0, 0, size, size);
  const golds = ['#C9A14A', '#E2BC62', '#B88D35', '#F0D27E', '#D6AE52', '#A87D2A'];
  for (let row = 0; row < size / step; row++) {
    const shift = row % 2 ? step / 2 : 0;
    for (let col = -1; col < size / step + 1; col++) {
      const x = col * step + shift + (random() - .5) * 1.6, y = row * step + (random() - .5) * 1.6;
      const pick = random(), w = step - 1.6 - random() * 1.2, h = step - 1.6 - random() * 1.2;
      ctx.fillStyle = pick < .012 ? '#2C4FA3' : pick < .02 ? '#9E2A2B' : golds[Math.floor(random() * golds.length)];
      ctx.globalAlpha = .82 + random() * .18;
      ctx.fillRect(x, y, w, h);
      ctx.fillRect(x - size, y, w, h); ctx.fillRect(x + size, y, w, h);   // wrap the edges
      ctx.fillStyle = 'rgba(255,248,220,.35)'; ctx.fillRect(x, y, w * .5, 1.2);
    }
  }
  ctx.globalAlpha = 1;
  return canvas.toDataURL('image/png');
}

