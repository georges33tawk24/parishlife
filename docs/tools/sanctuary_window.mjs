// The sanctuary window's design, as the glazier's cartoon: every piece of glass with its colour,
// the lead between them, the stone tracery over them, and the outline of the stone around them.
// docs/tools/sanctuary_layers.mjs draws it in layers and docs/tools/render_sanctuary.py gives
// them their materials; the site shows the rendered pictures (assets/images/sanctuary).
//
// The window is 1000 by 1300 units, drawn in a viewBox of -40 0 1080 1300 so the sill can reach
// past the jambs. GLASS_OPENINGS (assets/home-sanctuary.js) are the openings the glass fills.
import { GLASS_OPENINGS } from '../../assets/home-sanctuary.js';

const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const r1 = v => Math.round(v * 10) / 10;
/* A colour a little lighter or darker, as no two sheets of hand-made glass are alike. */
function vary(hex, random, amount = 0.1) {
  const k = 1 + (random() * 2 - 1) * amount, n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, n >> 8 & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k))));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
export const GLASS = { ruby: '#B01E36', wine: '#7A1430', amber: '#E0962A', gold: '#F0BE4A', straw: '#F4DC8C', blue: '#2A58C2', deep: '#16307C', cobalt: '#2147A2',
  green: '#23915A', moss: '#14653F', leaf: '#6FA846', violet: '#5A3C9A', white: '#F2EBD6', pale: ['#E8D9AA', '#D7DCC6', '#EFDDA6', '#D5D9CD', '#E9CF92', '#E2D4B4'] };
export const GROUNDS = { deep: GLASS.deep, wine: GLASS.wine, moss: GLASS.moss, violet: GLASS.violet };
const polar = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
const pts = list => list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ');
const piece = (d, fill) => `<path d="${d}" fill="${fill}"/>`;
const poly = (list, fill) => `<polygon points="${pts(list)}" fill="${fill}"/>`;
/* One ring segment between two radii and two angles. */
function sector(cx, cy, r0, r1_, a0, a1) {
  const [x0, y0] = polar(cx, cy, r1_, a0), [x1, y1] = polar(cx, cy, r1_, a1), [x2, y2] = polar(cx, cy, r0, a1), [x3, y3] = polar(cx, cy, r0, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${r1(x0)} ${r1(y0)}A${r1_} ${r1_} 0 ${large} 1 ${r1(x1)} ${r1(y1)}L${r1(x2)} ${r1(y2)}${r0 ? `A${r0} ${r0} 0 ${large} 0 ${r1(x3)} ${r1(y3)}` : ''}Z`;
}
/* A pointed leaf (a vesica) along the angle a, from radius r0 to r1 and w wide at its widest. */
function vesica(cx, cy, r0, r1_, a, w) {
  const out = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, half = w / 2 * Math.sin(Math.PI * t) ** .8, r = r0 + (r1_ - r0) * t;
    out.push(polar(cx, cy, r, a + half / r));
  }
  for (let i = 15; i > 0; i--) {
    const t = i / 16, half = w / 2 * Math.sin(Math.PI * t) ** .8, r = r0 + (r1_ - r0) * t;
    out.push(polar(cx, cy, r, a - half / r));
  }
  return out;
}

/* The rose: the cross of the Maronites at the heart, a ring of ruby and a ring of jewels, and
   twelve leaves of ruby and green between the stone spokes. */
function rose(random) {
  const cx = 500, cy = 330, out = [], step = Math.PI / 6, turn = -Math.PI / 2;
  out.push(piece(`M${cx - 62} ${cy}a62 62 0 1 0 124 0a62 62 0 1 0 -124 0Z`, vary(GLASS.deep, random, .05)));
  const arm = 46, bar = 7.5, ends = [];
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const ex = cx + dx * arm, ey = cy + dy * arm;
    ends.push(`<circle cx="${ex}" cy="${ey}" r="7.5"/>`, `<circle cx="${ex + (dy ? 8.5 : 0)}" cy="${ey - (dx ? 8.5 : 0)}" r="6"/>`, `<circle cx="${ex - (dy ? 8.5 : 0)}" cy="${ey + (dx ? 8.5 : 0)}" r="6"/>`);
  }
  out.push(`<g fill="${GLASS.gold}"><path d="M${cx - bar} ${cy - arm}h${bar * 2}v${arm * 2}h${-bar * 2}Z M${cx - arm} ${cy - bar}h${arm * 2}v${bar * 2}h${-arm * 2}Z"/>${ends.join('')}</g>`);
  for (let i = 0; i < 12; i++) out.push(piece(sector(cx, cy, 62, 90, turn + i * step, turn + (i + 1) * step), vary(i % 2 ? GLASS.wine : GLASS.ruby, random, .08)));
  for (let i = 0; i < 24; i++) out.push(piece(sector(cx, cy, 90, 116, turn + i * step / 2, turn + (i + 1) * step / 2), vary(i % 2 ? GLASS.blue : GLASS.gold, random, .08)));
  for (let i = 0; i < 12; i++) {
    const a0 = turn + i * step + step / 2, a1 = a0 + step, mid = (a0 + a1) / 2;
    out.push(piece(sector(cx, cy, 122, 202, a0, mid), vary(GLASS.deep, random, .1)), piece(sector(cx, cy, 122, 202, mid, a1), vary(GLASS.cobalt, random, .1)));
    out.push(poly(vesica(cx, cy, 130, 196, mid, 44), vary(i % 2 ? GLASS.green : GLASS.ruby, random, .08)));
    out.push(poly(vesica(cx, cy, 146, 184, mid, 18), vary(i % 2 ? GLASS.leaf : GLASS.amber, random, .08)));
  }
  const spokes = Array.from({ length: 12 }, (_, i) => { const a = turn + i * step + step / 2; const [x0, y0] = polar(cx, cy, 118, a), [x1, y1] = polar(cx, cy, 204, a); return `M${r1(x0)} ${r1(y0)}L${r1(x1)} ${r1(y1)}`; }).join('');
  const tracery = `<circle cx="${cx}" cy="${cy}" r="206" stroke-width="18"/><circle cx="${cx}" cy="${cy}" r="120" stroke-width="10"/><circle cx="${cx}" cy="${cy}" r="62" stroke-width="7"/><path d="${spokes}" stroke-width="10"/>`;
  return { glass: out.join(''), tracery };
}

/* A lancet: a jewelled border, pale quarries painted with a flower, and a medallion. */
function lancet(random, x0, motif, ground) {
  const w = 350, cx = x0 + w / 2, cy = 760, r = w / 2, bottom = 1170, band = 20, out = [], id = `l${x0}`;
  out.push(`<clipPath id="${id}"><path d="M${x0 + band} ${bottom - band}V${cy}A${r - band} ${r - band} 0 0 1 ${x0 + w - band} ${cy}V${bottom - band}Z"/></clipPath><g clip-path="url(#${id})">`);
  const dw = 58, dh = 84;
  for (let j = 0; j * dh / 2 < bottom - cy + r + dh; j++) {
    for (let i = -1; i * dw < w + dw; i++) {
      const qx = x0 + i * dw + (j % 2) * dw / 2, qy = cy - r + j * dh / 2;
      out.push(poly([[qx, qy - dh / 2], [qx + dw / 2, qy], [qx, qy + dh / 2], [qx - dw / 2, qy]], vary(GLASS.pale[Math.floor(random() * GLASS.pale.length)], random, .06)));
    }
  }
  out.push('</g>');
  const jewel = i => vary([GLASS.ruby, GLASS.blue, GLASS.gold, GLASS.blue][i % 4], random, .08);
  for (let i = 0; i < 10; i++) out.push(piece(sector(cx, cy, r - band, r, Math.PI + i * Math.PI / 10, Math.PI + (i + 1) * Math.PI / 10), jewel(i)));
  for (let y = cy, i = 0; y < bottom; y += 46, i++) {
    const h = Math.min(46, bottom - y);
    out.push(`<rect x="${x0}" y="${y}" width="${band}" height="${h}" fill="${jewel(i + 1)}"/><rect x="${x0 + w - band}" y="${y}" width="${band}" height="${h}" fill="${jewel(i + 3)}"/>`);
  }
  for (let x = x0 + band, i = 0; x < x0 + w - band; x += 52, i++) out.push(`<rect x="${x}" y="${bottom - band}" width="${Math.min(52, x0 + w - band - x)}" height="${band}" fill="${jewel(i)}"/>`);
  const mx = cx, my = 920, mr = 116;
  out.push(`<circle cx="${mx}" cy="${my}" r="${mr}" fill="${vary(GLASS.gold, random, .05)}"/>`);
  for (let i = 0; i < 8; i++) out.push(piece(sector(mx, my, 0, mr - 14, i * Math.PI / 4 + Math.PI / 8, (i + 1) * Math.PI / 4 + Math.PI / 8), vary(ground, random, .08)));
  out.push(`<clipPath id="m${x0}"><circle cx="${mx}" cy="${my}" r="${mr - 14}"/></clipPath><g clip-path="url(#m${x0})">${motif(mx, my, random)}</g>`);
  const tracery = `<circle cx="${mx}" cy="${my}" r="${mr}" stroke-width="6"/><circle cx="${mx}" cy="${my}" r="${mr - 14}" stroke-width="4"/><path d="M${x0} 700H${x0 + w}M${x0} 1050H${x0 + w}" stroke-width="7"/>`;
  const frame = `<path d="M${x0} ${bottom}V${cy}A${r} ${r} 0 0 1 ${x0 + w} ${cy}V${bottom}Z" stroke-width="16"/>`;
  return { glass: out.join(''), tracery: tracery + frame };
}

/* The cedar of Lebanon: tiers of spreading branches over a trunk, on a green hill. */
function cedar(mx, my, random) {
  const tiers = [[80, 50, 15], [68, 28, 14], [56, 7, 13], [43, -13, 12], [30, -32, 11], [17, -49, 10]];
  const tier = ([hw, y, th], i) => {
    const l = mx - hw, rr = mx + hw, droop = 6 + hw * .06;
    const d = `M${l} ${my + y + droop}Q${mx - hw * .55} ${my + y - th * .9} ${mx} ${my + y - th}Q${mx + hw * .55} ${my + y - th * .9} ${rr} ${my + y + droop}` +
      `Q${mx + hw * .5} ${my + y + th * .2} ${mx + hw * .18} ${my + y + th * .55}Q${mx} ${my + y + th * .2} ${mx - hw * .18} ${my + y + th * .55}Q${mx - hw * .5} ${my + y + th * .2} ${l} ${my + y + droop}Z`;
    return piece(d, vary(i % 2 ? GLASS.green : GLASS.moss, random, .08));
  };
  return `<path d="M${mx - 9} ${my + 76}L${mx - 6} ${my - 40}H${mx + 6}L${mx + 9} ${my + 76}Z" fill="${vary('#6B4426', random, .06)}"/>` +
    `<path d="M${mx - 104} ${my + 74}Q${mx} ${my + 52} ${mx + 104} ${my + 74}L${mx + 104} ${my + 110}H${mx - 104}Z" fill="${vary(GLASS.moss, random, .06)}"/>` +
    tiers.map(tier).join('') + `<path d="M${mx} ${my - 72}L${mx + 7} ${my - 54}H${mx - 7}Z" fill="${vary(GLASS.green, random, .08)}"/>`;
}
/* The chalice and the host above it. */
function chalice(mx, my, random) {
  return `<circle cx="${mx}" cy="${my - 50}" r="28" fill="${vary(GLASS.white, random, .03)}"/><path d="M${mx - 3.5} ${my - 66}h7v12.5h12.5v7h-12.5v12.5h-7v-12.5h-12.5v-7h12.5Z" fill="${vary(GLASS.gold, random, .04)}"/>
    <path d="M${mx - 50} ${my - 14}h100c-4 40-22 58-50 62c-28-4-46-22-50-62Z" fill="${vary(GLASS.gold, random, .05)}"/>
    <path d="M${mx - 44} ${my - 6}h88c-1 6-2 10-3 14h-82c-1-4-2-8-3-14Z" fill="${vary(GLASS.amber, random, .05)}"/>
    <rect x="${mx - 6}" y="${my + 46}" width="12" height="26" fill="${vary(GLASS.amber, random, .05)}"/>
    <path d="M${mx - 13} ${my + 52}a13 7 0 1 0 26 0a13 7 0 1 0 -26 0Z" fill="${vary(GLASS.gold, random, .05)}"/>
    <path d="M${mx - 40} ${my + 84}c10-14 24-14 40-14s30 0 40 14Z" fill="${vary(GLASS.gold, random, .05)}"/>`;
}
const blank = () => '';
const MOTIFS = { cedar, chalice, blank };

function oculus(random, cx, cy) {
  const out = [];
  for (let i = 0; i < 4; i++) out.push(piece(sector(cx, cy, 14, 44, i * Math.PI / 2 + Math.PI / 4, (i + 1) * Math.PI / 2 + Math.PI / 4), vary(i % 2 ? GLASS.blue : GLASS.ruby, random, .08)));
  out.push(`<circle cx="${cx}" cy="${cy}" r="14" fill="${vary(GLASS.gold, random)}"/>`);
  return { glass: out.join(''), tracery: `<circle cx="${cx}" cy="${cy}" r="48" stroke-width="12"/>` };
}

/* ground: the colour behind the left medallion (GROUNDS); left and right: the medallions' motifs
   (cedar, chalice, or blank where the site sets a parish's initial over the picture). */
export function windowDrawing({ ground = 'deep', left = 'cedar', right = 'chalice' } = {}) {
  const random = rng(19), parts = [rose(random), lancet(random, 120, MOTIFS[left], GROUNDS[ground]), lancet(random, 530, MOTIFS[right], GLASS.deep), oculus(random, 185, 445), oculus(random, 815, 445)];
  return `<svg viewBox="-40 0 1080 1300" xmlns="http://www.w3.org/2000/svg">
    <path class="stone" d="M10 1190V500A490 490 0 0 1 990 500V1190Z M-30 1190H1030V1300H-30Z" fill="#fff"/>
    <g class="glass" stroke="#000" stroke-width="3.4" stroke-linejoin="round">${parts.map(p => p.glass).join('')}</g>
    <g class="tracery" fill="none" stroke="#fff">${parts.map(p => p.tracery).join('')}</g>
  </svg>`;
}
export { GLASS_OPENINGS };
