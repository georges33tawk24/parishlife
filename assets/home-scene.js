/* The homepage hero: a night valley in the Lebanese mountains, drawn as SVG.
   Every gold light on the slopes is a parish on ParishLife; houses stay dim.
   The scene is generated from a fixed seed, so it looks the same on every visit,
   and its width follows the viewport so phones get their own composition. */

export const mulberry = seed => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
const f = n => Math.round(n * 10) / 10;

/* A ridgeline: layered sine octaves with random phases, measured against a fixed
   1600-unit reference so a phone shows part of the same valley rather than a squeezed one.
   `crag` adds sharp high-frequency peaks; `peak` raises a summit around an x position. */
export function ridge(rand, width, base, amp, { octaves = 5, peak = null, spread = 360, step = 6, crag = 0 } = {}) {
  const waves = Array.from({length: octaves}, (_, i) => ({ k: (1.6 + i * 1.9) * (0.8 + rand() * 0.4), a: 1 / (1.8 ** i), p: rand() * Math.PI * 2 }));
  const crags = Array.from({length: 3}, (_, i) => ({ k: 9 + i * 7 + rand() * 4, a: 1 / (1.6 ** i), p: rand() * Math.PI * 2 }));
  const norm = waves.reduce((s, w) => s + w.a, 0), cnorm = crags.reduce((s, w) => s + w.a, 0);
  const pts = [];
  for (let x = -40; x <= width + 40; x += step) {
    const u = x / 1600;
    let h = 0.5 + 0.5 * waves.reduce((s, w) => s + w.a * Math.sin(u * w.k * Math.PI + w.p), 0) / norm;
    if (crag) h += crag * (crags.reduce((s, w) => s + w.a * (1 - Math.abs(Math.sin(u * w.k * Math.PI + w.p))), 0) / cnorm - 0.5);
    if (peak !== null) h = h * 0.55 + 0.72 * Math.exp(-(((x - peak) / spread) ** 2));
    pts.push([x, base - h * amp]);
  }
  return pts;
}
const linePath = pts => 'M' + pts.map(([x, y]) => f(x) + ',' + f(y)).join('L');
export const fillPath = (pts, bottom) => linePath(pts) + `L${f(pts.at(-1)[0])},${bottom}L${f(pts[0][0])},${bottom}Z`;
export const yAt = (pts, x) => {
  const i = Math.max(1, pts.findIndex(p => p[0] >= x));
  const [x0, y0] = pts[i - 1], [x1, y1] = pts[i] || pts[i - 1];
  return x1 === x0 ? y0 : y0 + (y1 - y0) * (x - x0) / (x1 - x0);
};

/* Snow keeps to the high crest of the far range, reaching down in gullies. */
function snow(pts, line) {
  const out = [];
  let run = [];
  for (const [x, y] of pts) {
    if (y < line) run.push([x, y]);
    else if (run.length) { out.push(run); run = []; }
  }
  if (run.length) out.push(run);
  return out.filter(r => r.length > 2).map(r => {
    const lower = r.map(([x, y]) => {
      const depth = Math.min(70, (line - y) * 0.75) * (0.45 + 0.55 * Math.abs(Math.sin(x * 0.043 + 1.3)) * (0.55 + 0.45 * Math.sin(x * 0.0137 + 0.4)));
      return [x, y + 3 + depth];
    }).reverse();
    return linePath(r) + 'L' + lower.map(([x, y]) => f(x) + ',' + f(y)).join('L') + 'Z';
  }).join('');
}

/* Cedar of Lebanon: a heavy trunk carrying broad, flat plates of foliage with a flat crown. */
export function cedar(rand, x, y, h) {
  const parts = [`M${f(x - h * 0.05)},${f(y)}L${f(x - h * 0.028)},${f(y - h * 0.62)}L${f(x + h * 0.028)},${f(y - h * 0.62)}L${f(x + h * 0.05)},${f(y)}Z`];
  const plates = [[0.36, 1.25, 0.075], [0.55, 1.02, 0.08], [0.72, 0.8, 0.085], [0.86, 0.5, 0.08]];
  plates.forEach(([at, width, thick], i) => {
    const ty = y - h * at, w = h * width * (0.88 + rand() * 0.24), th = h * thick;
    const cx = x + (rand() - 0.5) * h * 0.22, l = cx - w / 2, n = 4 + Math.round(rand() * 2);
    let d = `M${f(l)},${f(ty)}`;
    for (let k = 0; k < n; k++) {
      const x1 = l + (k + 1) * w / n, rise = (k === 0 || k === n - 1) ? 0.55 : 1;
      d += `Q${f(l + (k + 0.5) * w / n)},${f(ty - th * (1.3 + rand() * 0.9) * rise)} ${f(x1)},${f(ty - th * (k === n - 1 ? 0 : 0.35 + rand() * 0.3))}`;
    }
    d += `Q${f(cx + w * 0.2)},${f(ty + th * 0.55)} ${f(cx)},${f(ty + th * 0.3)}Q${f(cx - w * 0.2)},${f(ty + th * 0.55)} ${f(l)},${f(ty)}Z`;
    parts.push(d);
    if (i < 3) {  // the branch that carries this plate
      const bx = cx + (rand() < 0.5 ? -1 : 1) * w * 0.22;
      parts.push(`M${f(x - h * 0.012)},${f(ty + th * 1.2)}L${f(bx)},${f(ty + th * 0.1)}L${f(bx + h * 0.02)},${f(ty + th * 0.1)}L${f(x + h * 0.012)},${f(ty + th * 1.6)}Z`);
    }
  });
  return parts.join('');
}

/* A mountain chapel, front on: stone gable, bell-cote with a cross, arched door and oculus. */
function chapel(x, y, s) {
  const P = (dx, dy) => f(x + dx * s) + ',' + f(y + dy * s);
  const body = `M${P(-30, 0)}L${P(-30, -44)}L${P(0, -62)}L${P(30, -44)}L${P(30, 0)}Z` +
    `M${P(30, 0)}L${P(30, -40)}L${P(96, -40)}L${P(96, 0)}Z M${P(26, -40)}L${P(62, -54)}L${P(100, -40)}Z` +
    `M${P(-9, -60)}L${P(-9, -80)}A${f(9 * s)},${f(9 * s)} 0 0 1 ${P(9, -80)}L${P(9, -60)}Z` +
    `M${P(-1.3, -89)}L${P(-1.3, -104)}L${P(1.3, -104)}L${P(1.3, -89)}Z M${P(-5, -99)}L${P(5, -99)}L${P(5, -96.6)}L${P(-5, -96.6)}Z`;
  const bell = `M${P(-4, -63)}Q${P(-4, -73)} ${P(0, -73)}Q${P(4, -73)} ${P(4, -63)}Z`;
  const door = `M${P(-7, 0)}L${P(-7, -16)}A${f(7 * s)},${f(7 * s)} 0 0 1 ${P(7, -16)}L${P(7, 0)}Z`;
  const windows = [[48, -22], [72, -22]].map(([dx, dy]) => `M${P(dx - 3, dy + 7)}L${P(dx - 3, dy - 3)}A${f(3 * s)},${f(3 * s)} 0 0 1 ${P(dx + 3, dy - 3)}L${P(dx + 3, dy + 7)}Z`).join('');
  return { body, bell, door, windows, oculus: [f(x), f(y - 33 * s), f(4.2 * s)] };
}

/* places: one per parish ({id, label}); returns the SVG markup and the light positions. */
export function heroScene({ width = 1600, height = 1000, places = [], mirror = false } = {}) {
  const rand = mulberry(1925), W = Math.round(width), H = height, portrait = W < 1000;
  const chapelX = W * (portrait ? 0.6 : 0.79);
  const far = ridge(rand, W, H * 0.57, H * 0.27, { octaves: 7, peak: W * (portrait ? 0.62 : 0.66), spread: 420, crag: 0.22, step: 4 });
  const mid = ridge(rand, W, H * 0.67, H * 0.16, { octaves: 7, crag: 0.12 });
  const village = ridge(rand, W, H * 0.76, H * 0.1, { octaves: 6 });
  const hill = ridge(rand, W, H * 0.9, H * 0.07, { octaves: 4, peak: chapelX, spread: portrait ? 260 : 300 });
  const front = ridge(rand, W, H * 1.0, H * 0.06, { octaves: 4, step: 10 });
  const crest = Math.min(...far.map(p => p[1]));

  const stars = Array.from({length: Math.round(W / 14)}, () => {
    const x = rand() * W, y = rand() * H * 0.5, r = 0.5 + rand() ** 3 * 1.4;
    return `<circle class="${rand() < 0.18 ? 'star tw' : 'star'}" cx="${f(x)}" cy="${f(y)}" r="${f(r)}" style="--o:${f(0.35 + rand() * 0.6)};--d:${f(2 + rand() * 4)}s;--w:${f(rand() * 4)}s"/>`;
  }).join('');

  /* Dim houses scattered on the village slope and the hill. */
  const houses = [];
  for (let i = 0; i < W / 26; i++) {
    const x = 30 + rand() * (W - 60), y = yAt(village, x) + 6 + rand() * H * 0.06, w = 5 + rand() * 6, h = 4 + rand() * 4;
    houses.push(`<rect x="${f(x)}" y="${f(y - h)}" width="${f(w)}" height="${f(h)}"/>` + (rand() < 0.35 ? `<rect class="win" x="${f(x + w * 0.35)}" y="${f(y - h * 0.65)}" width="1.6" height="1.8"/>` : ''));
  }

  /* Parish lights: spread over the village slope, clear of the headline. */
  const from = portrait ? 0.08 : 0.5, to = portrait ? 0.94 : 0.97;
  const slots = places.slice(0, 48).map((place, i, all) => {
    const t = all.length === 1 ? 0.5 : i / (all.length - 1);
    const x = W * (from + (to - from) * ((t * 0.92 + 0.04) + (rand() - 0.5) * 0.04));
    const y = yAt(village, x) + 10 + rand() * H * 0.045;
    return { ...place, x: f(x), y: f(y) };
  });
  const lights = slots.map(s => `<g class="parish-light" data-light="${s.id}" transform="translate(${s.x} ${s.y})"><circle class="halo" r="22"/><circle class="core" r="3.2"/></g>`).join('');

  const c = chapel(chapelX, yAt(hill, chapelX) + 2, portrait ? 1.05 : 1.25);
  const ground = yAt(hill, chapelX);
  const trees = (portrait ? [[-118, 0.15], [-200, 0.1]] : [[-150, 0.16], [-235, 0.11], [150, 0.12]]).map(([dx, hh]) => {
    const x = chapelX + dx * (portrait ? 0.72 : 1);
    return cedar(rand, x, yAt(hill, x) + 4, H * hh * (portrait ? 0.82 : 1));
  }).join('');

  const flip = mirror ? ` transform="translate(${W} 0) scale(-1 1)"` : '';
  return {
    lights: slots,
    svg: `<svg class="hero-scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="sky-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050B19"/><stop offset=".55" stop-color="#0E1A31"/><stop offset="1" stop-color="#1C2C54"/></linearGradient>
    <linearGradient id="sky-dawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101E3C"/><stop offset=".42" stop-color="#2C4378"/><stop offset=".66" stop-color="#7D6A8C"/><stop offset=".8" stop-color="#D49A6A"/><stop offset=".92" stop-color="#EBC48A"/></linearGradient>
    <linearGradient id="sky-day" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3D5C9C"/><stop offset=".5" stop-color="#8FA8D2"/><stop offset=".8" stop-color="#E9C9A0"/><stop offset="1" stop-color="#F4DDB4"/></linearGradient>
    <radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FBE2B0" stop-opacity=".9"/><stop offset=".3" stop-color="#E9A77E" stop-opacity=".42"/><stop offset=".65" stop-color="#B07C9A" stop-opacity=".14"/><stop offset="1" stop-color="#B07C9A" stop-opacity="0"/></radialGradient>
    <linearGradient id="far-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34466F"/><stop offset="1" stop-color="#1B2848"/></linearGradient>
    <linearGradient id="mid-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22325A"/><stop offset="1" stop-color="#162241"/></linearGradient>
    <linearGradient id="village-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#18264A"/><stop offset="1" stop-color="#101A33"/></linearGradient>
    <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9D3E6" stop-opacity="0"/><stop offset=".5" stop-color="#C9D3E6" stop-opacity=".13"/><stop offset="1" stop-color="#C9D3E6" stop-opacity="0"/></linearGradient>
    <radialGradient id="lamp" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE3A3"/><stop offset=".4" stop-color="#D7A548" stop-opacity=".55"/><stop offset="1" stop-color="#D7A548" stop-opacity="0"/></radialGradient>
  </defs>
  <g${flip}>
    <rect class="sky-night" width="${W}" height="${H}" fill="url(#sky-night)"/>
    <rect class="sky-dawn" width="${W}" height="${H}" fill="url(#sky-dawn)"/>
    <rect class="sky-day" width="${W}" height="${H}" fill="url(#sky-day)" opacity="0"/>
    <g class="stars" fill="#EEF1F6">${stars}</g>
    <ellipse class="sun" cx="${f(W * (portrait ? 0.62 : 0.68))}" cy="${f(crest + H * 0.12)}" rx="${f(W * 0.32)}" ry="${f(H * 0.3)}" fill="url(#sun)"/>
    <g class="layer layer-far"><g class="rise"><path d="${fillPath(far, H)}" fill="url(#far-fill)"/><path class="snow" d="${snow(far, crest + H * 0.075)}" fill="#E6DED0"/><path class="rim" d="${linePath(far)}" fill="none" stroke="#F1C77A" stroke-width="1.6" stroke-linejoin="round"/></g></g>
    <rect class="mist mist-a" x="${-W * 0.25}" y="${f(H * 0.52)}" width="${W * 1.5}" height="${f(H * 0.2)}" fill="url(#mist)"/>
    <g class="layer layer-mid"><g class="rise"><path d="${fillPath(mid, H)}" fill="url(#mid-fill)"/></g></g>
    <rect class="mist mist-b" x="${-W * 0.25}" y="${f(H * 0.64)}" width="${W * 1.5}" height="${f(H * 0.16)}" fill="url(#mist)"/>
    <g class="layer layer-village"><g class="rise"><path d="${fillPath(village, H)}" fill="url(#village-fill)"/><g class="houses" fill="#22325A">${houses.join('')}</g><g class="lights">${lights}</g></g></g>
    <g class="layer layer-hill"><g class="rise"><path d="${fillPath(hill, H)}" fill="#0C152B"/>
      <ellipse class="door-glow" cx="${f(chapelX)}" cy="${f(ground + 3)}" rx="${f(W * 0.035)}" ry="${f(H * 0.012)}" fill="url(#lamp)"/>
      <g fill="#0A1226"><path d="${trees}"/><path d="${c.body}"/></g>
      <path class="chapel-bell" d="${c.bell}" fill="#3B3A3A"/>
      <path class="chapel-door" d="${c.door}" fill="#E9B95E"/><path class="chapel-window" d="${c.windows}" fill="#D7A548" opacity=".85"/>
      <circle class="chapel-window" cx="${c.oculus[0]}" cy="${c.oculus[1]}" r="${c.oculus[2]}" fill="#E9B95E"/></g></g>
    <g class="layer layer-front"><g class="rise"><path d="${fillPath(front, H + 2)}" fill="#08101F"/></g></g>
  </g>
</svg>`
  };
}
