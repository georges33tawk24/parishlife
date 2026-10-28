/* The homepage sanctuary: a stone wall at night, a stained-glass window (a rose with the cross
   above two lancets, the cedar of Lebanon and the chalice), the light it lets in, a sanctuary
   lamp, and candles on the window sill: one lit candle for each parish on ParishLife. Everything
   is drawn here (SVG and CSS), so nothing is downloaded for it. Motion lives in home-motion.js;
   assets/sanctuary.css holds the styles. */

const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const r1 = v => Math.round(v * 10) / 10;
/* A colour a little lighter or darker, as no two pieces of hand-made glass are alike. */
function vary(hex, random, amount = 0.12) {
  const k = 1 + (random() * 2 - 1) * amount, n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, n >> 8 & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k))));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
const GLASS = { ruby: '#B3203A', wine: '#7C1530', amber: '#E39A2D', gold: '#F2C14E', blue: '#2C5CC8', deep: '#173584', cobalt: '#2248A6',
  green: '#22955E', moss: '#156A43', violet: '#5D3E9E', pale: ['#EAD9A6', '#D8DCC6', '#F1DDA2', '#D4D8CF', '#ECCB86', '#E3D3B0'] };
const LEAD = '#1A1216';
const polar = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
const pts = list => list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ');
/* One ring segment between two radii and two angles. */
function sector(cx, cy, r0, r1_, a0, a1) {
  const [x0, y0] = polar(cx, cy, r1_, a0), [x1, y1] = polar(cx, cy, r1_, a1), [x2, y2] = polar(cx, cy, r0, a1), [x3, y3] = polar(cx, cy, r0, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${r1(x0)} ${r1(y0)}A${r1_} ${r1_} 0 ${large} 1 ${r1(x1)} ${r1(y1)}L${r1(x2)} ${r1(y2)}${r0 ? `A${r0} ${r0} 0 ${large} 0 ${r1(x3)} ${r1(y3)}` : ''}Z`;
}
const piece = (d, fill, cls = '') => `<path d="${d}" fill="${fill}"${cls ? ` class="${cls}"` : ''}/>`;

/* The rose: the cross at the heart, a ring of ruby and amber, twelve lobes between stone spokes. */
function rose(random) {
  const cx = 500, cy = 330, out = [], step = Math.PI / 6, turn = -Math.PI / 2;
  out.push(`<g>`, piece(`M${cx - 58} ${cy}a58 58 0 1 0 116 0a58 58 0 1 0 -116 0Z`, vary(GLASS.deep, random, .06)));
  // the cross of the Maronites: each arm ends in three small circles
  const arm = 44, bar = 7, ends = [];
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const ex = cx + dx * arm, ey = cy + dy * arm;
    ends.push(`<circle cx="${ex}" cy="${ey}" r="7"/>`, `<circle cx="${ex + (dy ? 8 : 0) * 1}" cy="${ey - (dx ? 8 : 0)}" r="5.5"/>`, `<circle cx="${ex - (dy ? 8 : 0)}" cy="${ey + (dx ? 8 : 0)}" r="5.5"/>`);
  }
  out.push(`<g fill="${GLASS.gold}" stroke="${LEAD}" stroke-width="2.4"><path d="M${cx - bar} ${cy - arm}h${bar * 2}v${arm * 2}h${-bar * 2}Z M${cx - arm} ${cy - bar}h${arm * 2}v${bar * 2}h${-arm * 2}Z"/>${ends.join('')}</g></g>`);
  out.push(`<g>`);
  for (let i = 0; i < 12; i++) {
    const a0 = turn + i * step, a1 = a0 + step, c = i % 2 ? GLASS.amber : GLASS.ruby;
    out.push(piece(sector(cx, cy, 64, 92, a0, a1), vary(c, random)), piece(sector(cx, cy, 92, 118, a0, a1), vary(i % 2 ? GLASS.gold : GLASS.wine, random)));
  }
  out.push(`</g><g>`);
  for (let i = 0; i < 12; i++) {
    const a0 = turn + i * step + step / 2, a1 = a0 + step, mid = (a0 + a1) / 2;
    out.push(piece(sector(cx, cy, 124, 162, a0, a1), vary(GLASS.deep, random)), piece(sector(cx, cy, 162, 198, a0, a1), vary(GLASS.cobalt, random)));
    const [lx, ly] = polar(cx, cy, 160, mid), lobe = [GLASS.ruby, GLASS.green, GLASS.violet][i % 3];
    out.push(`<circle cx="${r1(lx)}" cy="${r1(ly)}" r="31" fill="${vary(lobe, random)}"/>`, `<circle cx="${r1(lx)}" cy="${r1(ly)}" r="11" fill="${vary(GLASS.gold, random)}"/>`);
  }
  out.push('</g>');
  // the stone tracery over the glass: rings and spokes
  const spokes = Array.from({ length: 12 }, (_, i) => { const a = turn + i * step + step / 2; const [x0, y0] = polar(cx, cy, 118, a), [x1, y1] = polar(cx, cy, 204, a); return `M${r1(x0)} ${r1(y0)}L${r1(x1)} ${r1(y1)}`; }).join('');
  out.push(`<g class="sn-tracery" fill="none"><circle cx="${cx}" cy="${cy}" r="206" stroke-width="18"/><circle cx="${cx}" cy="${cy}" r="120" stroke-width="10"/><circle cx="${cx}" cy="${cy}" r="62" stroke-width="8"/><path d="${spokes}" stroke-width="9"/></g>`);
  return out.join('');
}

/* A lancet: a jewelled border, pale diamond quarries, and a medallion. */
function lancet(random, x0, motif) {
  const w = 350, cx = x0 + w / 2, cy = 760, r = w / 2, bottom = 1170, band = 20, out = [];
  const id = `sn-l${x0}`;
  out.push(`<clipPath id="${id}"><path d="M${x0 + band} ${bottom - band}V${cy}A${r - band} ${r - band} 0 0 1 ${x0 + w - band} ${cy}V${bottom - band}Z"/></clipPath>`);
  out.push(`<g><g clip-path="url(#${id})">`);
  const dw = 58, dh = 84;
  for (let j = 0; j * dh / 2 < bottom - cy + r + dh; j++) {
    for (let i = -1; i * dw < w + dw; i++) {
      const qx = x0 + i * dw + (j % 2) * dw / 2, qy = cy - r + j * dh / 2;
      const tone = random() < .07 ? [GLASS.amber, GLASS.ruby, GLASS.blue][Math.floor(random() * 3)] : GLASS.pale[Math.floor(random() * GLASS.pale.length)];
      out.push(`<polygon points="${pts([[qx, qy - dh / 2], [qx + dw / 2, qy], [qx, qy + dh / 2], [qx - dw / 2, qy]])}" fill="${vary(tone, random, .1)}"/>`);
    }
  }
  out.push('</g>');
  // the border: jewels along the arch, the sides and the foot
  const jewel = i => vary([GLASS.ruby, GLASS.blue, GLASS.gold, GLASS.blue][i % 4], random, .08);
  for (let i = 0; i < 10; i++) out.push(piece(sector(cx, cy, r - band, r, Math.PI + i * Math.PI / 10, Math.PI + (i + 1) * Math.PI / 10), jewel(i)));
  for (let y = cy, i = 0; y < bottom; y += 46, i++) {
    const h = Math.min(46, bottom - y);
    out.push(`<rect x="${x0}" y="${y}" width="${band}" height="${h}" fill="${jewel(i + 1)}"/><rect x="${x0 + w - band}" y="${y}" width="${band}" height="${h}" fill="${jewel(i + 3)}"/>`);
  }
  for (let x = x0 + band, i = 0; x < x0 + w - band; x += 52, i++) out.push(`<rect x="${x}" y="${bottom - band}" width="${Math.min(52, x0 + w - band - x)}" height="${band}" fill="${jewel(i)}"/>`);
  // the medallion
  const mx = cx, my = 920, mr = 116;
  out.push(`<circle cx="${mx}" cy="${my}" r="${mr}" fill="${vary(GLASS.gold, random, .06)}"/>`);
  for (let i = 0; i < 8; i++) out.push(piece(sector(mx, my, 0, mr - 14, i * Math.PI / 4, (i + 1) * Math.PI / 4), vary(GLASS.deep, random, .1)));
  out.push(motif(mx, my, random));
  out.push(`</g><g class="sn-tracery" fill="none"><circle cx="${mx}" cy="${my}" r="${mr}" stroke-width="6"/><circle cx="${mx}" cy="${my}" r="${mr - 14}" stroke-width="4"/>
    <path d="M${x0} 700H${x0 + w}M${x0} 1050H${x0 + w}" stroke-width="7"/></g>`);
  out.push(`<path class="sn-frame" d="M${x0} ${bottom}V${cy}A${r} ${r} 0 0 1 ${x0 + w} ${cy}V${bottom}Z" fill="none" stroke-width="16"/>`);
  return out.join('');
}
/* The cedar of Lebanon, in tiers of green glass. */
function cedar(mx, my, random) {
  const tiers = [[-78, 46, 44], [-64, 38, 18], [-50, 30, -6], [-36, 22, -30], [-22, 15, -52]];
  return `<rect x="${mx - 7}" y="${my - 10}" width="14" height="74" fill="${vary('#6B4426', random)}"/>` +
    tiers.map(([hw, hh, dy], i) => `<polygon points="${pts([[mx + hw, my + dy + hh * .55], [mx, my + dy - hh * .45], [mx - hw, my + dy + hh * .55]])}" fill="${vary(i % 2 ? GLASS.green : GLASS.moss, random)}"/>`).join('') +
    `<rect x="${mx - 84}" y="${my + 64}" width="168" height="14" fill="${vary(GLASS.moss, random)}"/>`;
}
/* The chalice and the host. */
function chalice(mx, my, random) {
  return `<circle cx="${mx}" cy="${my - 50}" r="28" fill="${vary('#F4E6B8', random, .04)}"/><path d="M${mx - 9} ${my - 50}h18M${mx} ${my - 59}v18" stroke="${GLASS.gold}" stroke-width="4"/>
    <path d="M${mx - 50} ${my - 14}h100c-4 40-22 58-50 62c-28-4-46-22-50-62Z" fill="${vary(GLASS.gold, random)}"/>
    <rect x="${mx - 6}" y="${my + 46}" width="12" height="26" fill="${vary(GLASS.amber, random)}"/>
    <path d="M${mx - 40} ${my + 84}c10-14 24-14 40-14s30 0 40 14Z" fill="${vary(GLASS.gold, random)}"/>`;
}
function oculus(random, cx, cy) {
  const out = [`<g>`];
  for (let i = 0; i < 4; i++) out.push(piece(sector(cx, cy, 14, 44, i * Math.PI / 2 + Math.PI / 4, (i + 1) * Math.PI / 2 + Math.PI / 4), vary(i % 2 ? GLASS.violet : GLASS.ruby, random)));
  out.push(`<circle cx="${cx}" cy="${cy}" r="14" fill="${vary(GLASS.gold, random)}"/></g><circle class="sn-frame" cx="${cx}" cy="${cy}" r="48" fill="none" stroke-width="12"/>`);
  return out.join('');
}

const GLASS_SHAPES = {
  rose: '<circle cx="500" cy="330" r="206"/><circle cx="185" cy="445" r="48"/><circle cx="815" cy="445" r="48"/>',
  left: '<path d="M120 1170V760A175 175 0 0 1 470 760V1170Z"/>',
  right: '<path d="M530 1170V760A175 175 0 0 1 880 760V1170Z"/>'
};
const glassClip = id => `<clipPath id="${id}">${Object.values(GLASS_SHAPES).join('')}</clipPath>`;

/* The window: stone surround, glass, tracery and sill. It never changes once drawn, so the
   browser paints its textures once; the light that moves is a second layer (lightSVG). */
function windowSVG() {
  const random = rng(19);
  const voussoirs = [];
  for (let a = 180; a <= 360; a += 7.5) {
    const t = a * Math.PI / 180, [x0, y0] = polar(500, 500, 430, t), [x1, y1] = polar(500, 500, 490, t);
    voussoirs.push(`M${r1(x0)} ${r1(y0)}L${r1(x1)} ${r1(y1)}`);
  }
  const joints = [];
  for (let y = 560; y < 1190; y += 78) joints.push(`M10 ${y}H70M930 ${y}H990`);
  return `<svg class="sn-window-svg" viewBox="-40 0 1080 1300" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="sn-stone" cx="50%" cy="46%" r="62%"><stop offset="0" stop-color="#6A5947"/><stop offset=".6" stop-color="#43382D"/><stop offset="1" stop-color="#241D18"/></radialGradient>
      <radialGradient id="sn-plate" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#3B3129"/><stop offset="1" stop-color="#1F1915"/></radialGradient>
      <linearGradient id="sn-sill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A7660"/><stop offset=".4" stop-color="#5E4F40"/><stop offset=".42" stop-color="#3A3028"/><stop offset="1" stop-color="#1E1814"/></linearGradient>
      <filter id="sn-mottle" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".021 .03" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 .96  0 0 0 0 .86  2.2 0 0 0 -.9"/></filter>
      <filter id="sn-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -.9 .62"/></filter>
      ${glassClip('sn-glass')}
    </defs>
    <path class="sn-surround" d="M10 1190V500A490 490 0 0 1 990 500V1190Z" fill="url(#sn-stone)"/>
    <path d="M70 1190V500A430 430 0 0 1 930 500V1190Z" fill="url(#sn-plate)"/>
    <path d="${voussoirs.join('')}${joints.join('')}" stroke="#16110E" stroke-width="3" opacity=".7"/>
    <path d="M478 22h44l6 50h-56Z" fill="#7A6754" stroke="#16110E" stroke-width="3"/>
    <path d="M70 1190V500A430 430 0 0 1 930 500V1190" fill="none" stroke="#7E6B57" stroke-width="5" opacity=".6"/>
    <g class="sn-glass" stroke="${LEAD}" stroke-width="3.2" stroke-linejoin="round">
      ${rose(random)}${lancet(random, 120, cedar)}${lancet(random, 530, chalice)}${oculus(random, 185, 445)}${oculus(random, 815, 445)}
    </g>
    <rect x="0" y="0" width="1000" height="1200" filter="url(#sn-mottle)" opacity=".42" clip-path="url(#sn-glass)" pointer-events="none"/>
    <g class="sn-stonework" stroke-linejoin="round">
      <path d="M-30 1190H1030V1300H-30Z" fill="url(#sn-sill)"/>
    </g>
    <rect x="-40" y="0" width="1080" height="1300" filter="url(#sn-grain)" opacity=".28" pointer-events="none"/>
  </svg>`;
}

/* The light through the glass: clouds passing, the brightness behind, the warmth of morning that
   comes as the page scrolls, and the dark each pane starts from before it lights. */
function lightSVG() {
  return `<svg class="sn-light" viewBox="-40 0 1080 1300" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="sn-back" cx="50%" cy="40%" r="62%"><stop offset="0" stop-color="#FFF7DE" stop-opacity=".7"/><stop offset=".5" stop-color="#FFE3B0" stop-opacity=".22"/><stop offset="1" stop-color="#FFE3B0" stop-opacity="0"/></radialGradient>
      <radialGradient id="sn-warm" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#FFC56A" stop-opacity=".5"/><stop offset="1" stop-color="#FF9A3C" stop-opacity="0"/></radialGradient>
      <linearGradient id="sn-cloud" x1="0" y1="0" x2="1" y2=".35"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".22" stop-color="#000" stop-opacity=".24"/><stop offset=".4" stop-color="#000" stop-opacity="0"/><stop offset=".62" stop-color="#000" stop-opacity=".18"/><stop offset=".8" stop-color="#000" stop-opacity="0"/></linearGradient>
      ${glassClip('sn-glass-light')}
    </defs>
    <g clip-path="url(#sn-glass-light)">
      <rect class="sn-clouds" x="-1000" y="0" width="3000" height="1200" fill="url(#sn-cloud)"/>
      <rect class="sn-backlight" x="-100" y="0" width="1200" height="1200" fill="url(#sn-back)"/>
      <rect class="sn-dawn" x="0" y="0" width="1000" height="1200" fill="url(#sn-warm)"/>
    </g>
    <g fill="#070505">${Object.values(GLASS_SHAPES).map(shape => `<g class="sn-dark">${shape}</g>`).join('')}</g>
  </svg>`;
}

/* The ashlar wall behind it: courses of sandstone blocks, never quite the same. */
function wallSVG() {
  const random = rng(5), rows = [], H = 64;
  for (let row = 0; row < 6; row++) {
    let x = -(row % 2) * 70;
    while (x < 720) {
      const w = 110 + Math.floor(random() * 90);
      rows.push(`<rect x="${x + 1.5}" y="${row * H + 1.5}" width="${w - 3}" height="${H - 3}" rx="2" fill="${vary('#44362A', random, .2)}"/>`);
      x += w;
    }
  }
  return `<svg class="sn-wall-svg" aria-hidden="true" focusable="false"><defs><pattern id="sn-ashlar" width="720" height="${H * 6}" patternUnits="userSpaceOnUse"><rect width="720" height="${H * 6}" fill="#1C1611"/>${rows.join('')}</pattern>
    <filter id="sn-wall-grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="11"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1 .7"/></filter>
    <filter id="sn-hewn" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="4" seed="4" result="n"/>
      <feDiffuseLighting in="n" surfaceScale="1.8" diffuseConstant="1.15" lighting-color="#FFF2E0" result="lit"><feDistantLight azimuth="225" elevation="50"/></feDiffuseLighting>
      <feComposite in="SourceGraphic" in2="lit" operator="arithmetic" k1="1.2" k2="0" k3="0" k4="0"/></filter></defs>
    <rect class="sn-hewn" width="100%" height="100%" fill="url(#sn-ashlar)" filter="url(#sn-hewn)"/><rect width="100%" height="100%" filter="url(#sn-wall-grain)" opacity=".35"/></svg>`;
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
      <stop offset=".08" stop-color="rgb(${beam.tint[0]})" stop-opacity="0"/><stop offset=".3" stop-color="rgb(${beam.tint[0]})" stop-opacity=".4"/><stop offset=".66" stop-color="rgb(${beam.tint[1]})" stop-opacity=".14"/><stop offset="1" stop-color="rgb(${beam.tint[1]})" stop-opacity="0"/></linearGradient></defs>
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

export function sanctuaryMarkup({ inscription = '' } = {}) {
  return `<div class="sanctuary" data-sanctuary aria-hidden="true">
    <div class="sn-wall">${wallSVG()}</div>
    <div class="sn-arcade">${arcadeSVG()}</div>
    <div class="sn-spill"></div>
    <div class="sn-stage" data-sn-stage>
      <div class="sn-bloom"></div>
      <div class="sn-window">${windowSVG()}${lightSVG()}</div>
      ${inscription ? `<p class="sn-inscription">${inscription.replace(/[&<>"']/g, '')}</p>` : ''}
      <div class="sn-beams">${beamsMarkup()}<div class="sn-haze" style='--mask:${hazeMask()}'><i data-sn-haze></i></div></div>
      <div class="sn-candles" data-sn-candles></div>
      ${lampMarkup()}
    </div>
  </div>`;
}

/* places: [{id, name, town}]. Each parish lights one candle on the sill; the empty places keep
   unlit candles, and a visitor may light one. Returns a controller like the valley's. */
export function mountSanctuary(host, places, { tip, onPick, words }) {
  const box = host.querySelector('[data-sn-candles]');
  if (!box) return { destroy() {} };
  host._beams = BEAMS.map(beamOutline);   // for the dust in the light (home-motion.js)
  const random = rng(places.length + 3), total = Math.min(40, Math.max(9, places.length + 5));
  // the parishes stand in the middle of the sill, the unlit candles to either side
  const order = Array.from({ length: total }, (_, i) => i).sort((a, b) => Math.abs(a - (total - 1) / 2) - Math.abs(b - (total - 1) / 2));
  const parishAt = new Map(order.slice(0, places.length).map((slot, i) => [slot, places[i]]));
  box.innerHTML = Array.from({ length: total }, (_, i) => {
    const p = parishAt.get(i), h = p ? 70 + random() * 34 : 34 + random() * 36;
    const lean = (random() * 2 - 1) * (p ? 2.6 : 4), x = 6 + (i + .5) * 88 / total + (random() - .5) * 1.2;
    return `<span class="sn-candle${p ? ' is-lit is-parish' : ''}" style="--x:${r1(x)}%;--h:${r1(h)};--lean:${r1(lean)}deg;--d:${r1(1.7 + random() * 1.6)}s;--o:${r1(-random() * 3)}s"${p ? ` data-candle="${i}"` : ''}><i class="sn-flame"></i><b class="sn-halo"></b></span>`;
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
    const r = el.getBoundingClientRect(), b = host.closest('[data-hero]').getBoundingClientRect();
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

