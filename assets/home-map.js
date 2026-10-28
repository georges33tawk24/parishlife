/* The directory map: Lebanon with its relief, and a gold light for every parish.
   A parish appears where its public profile's coordinates place it; otherwise at the
   centre of its town when the town is known. Close lights gather into a numbered
   cluster that zooms in when chosen. Geography never mirrors in Arabic. */
import MAP from './data/lebanon-map.js';

export const projection = MAP.projection;

const { width: W, height: H } = MAP;
const NS = 'http://www.w3.org/2000/svg';
const fold = value => String(value || '').normalize('NFKD').replace(/[̀-ًͯ-ٰٟ]/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
const TOWNS = new Map();
for (const t of MAP.towns) { TOWNS.set(fold(t.en), t); TOWNS.set(fold(t.ar), t); }

/* Where a parish sits on the map, in map units, or null when nothing places it. */
export function locate(parish, detail) {
  const visit = detail?.visit || {};
  const lat = Number(visit.latitude), lon = Number(visit.longitude);
  if (String(visit.latitude ?? '').trim() && String(visit.longitude ?? '').trim() && Number.isFinite(lat) && Number.isFinite(lon)) {
    const x = (lon - MAP.projection.lon0) * MAP.projection.kx, y = (MAP.projection.lat1 - lat) * MAP.projection.ky;
    if (x >= 0 && x <= W && y >= 0 && y <= H) return { x, y, exact: true };
  }
  const town = TOWNS.get(fold(parish.town)) || TOWNS.get(fold(parish.townAr));
  return town ? { x: town.x, y: town.y, exact: false } : null;
}

const r1 = n => Math.round(n * 10) / 10;
export function mapMarkup(L) {
  /* Labels and dots are sized in screen pixels: the inner group scales by --u, map units per pixel. */
  const labels = MAP.labels.map(l => `<g class="map-label map-label-${l.kind}" transform="translate(${l.x} ${l.y}) rotate(${l.rotate})"><text class="px">${L(l.en, l.ar)}</text></g>`).join('');
  const places = MAP.places.map(p => `<g class="map-place rank-${p.rank}" transform="translate(${p.x} ${p.y})"><g class="px"><circle r="2.2"/><text x="6" y="4">${L(p.en, p.ar)}</text></g></g>`).join('');
  const placed = new Set(MAP.places.map(p => r1(p.x) + ',' + r1(p.y))), seen = new Set();
  const towns = MAP.towns.filter(t => { const key = r1(t.x) + ',' + r1(t.y); if (placed.has(key) || seen.has(key)) return false; seen.add(key); return true; })
    .map(t => `<g transform="translate(${t.x} ${t.y})"><g class="px"><circle r="1.8"/><text x="5" y="4">${L(t.en, t.ar)}</text></g></g>`).join('');
  return `<figure class="lebanon-map" data-lebanon-map>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${L('Map of Lebanon with the parishes on ParishLife', 'خريطة لبنان مع الرعايا المسجّلة على ParishLife')}">
      <defs><clipPath id="land-clip"><path d="${MAP.land}"/></clipPath>
        <radialGradient id="map-lamp" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE3A3"/><stop offset=".45" stop-color="#D7A548" stop-opacity=".5"/><stop offset="1" stop-color="#D7A548" stop-opacity="0"/></radialGradient></defs>
      <g class="map-world">
        <path class="map-land" d="${MAP.land}"/>
        <g clip-path="url(#land-clip)" class="map-relief" data-relief></g>
        <path class="map-regions" d="${MAP.regions}"/>
        <g class="map-contours">${MAP.relief.map(r => `<path class="c${r.level}" d="${r.d}" pathLength="1"/>`).join('')}</g>
        <g class="map-rivers">${MAP.rivers.map(r => `<path d="${r.d}" pathLength="1"><title>${L(r.en, r.ar)}</title></path>`).join('')}</g>
        <path class="map-coast" d="${MAP.land}"/>
        <g class="map-labels">${labels}</g>
        <g class="map-towns">${towns}</g>
        <g class="map-places">${places}</g>
        <g class="map-lights" data-lights></g>
      </g>
    </svg>
    <button type="button" class="map-reset" data-map-reset hidden>${L('Show all of Lebanon', 'عرض لبنان كاملاً')}</button>
    <div class="map-card" data-map-card hidden></div>
    <figcaption>${L('Each flame is a parish, a candle lit on the map. Relief and rivers are illustrative; borders from Natural Earth.', 'كل شعلة رعية، شمعة مضاءة على الخريطة. التضاريس والأنهار توضيحية؛ الحدود من Natural Earth.')}</figcaption>
  </figure>`;
}

/* items: [{id, x, y, exact, name, town}]; returns a controller for the list to drive. */
export function mountMap(figure, items, { L, onChoose, card }) {
  const svg = figure.querySelector('svg'), world = svg.querySelector('[data-lights]'), reset = figure.querySelector('[data-map-reset]');
  const panel = figure.querySelector('[data-map-card]');
  const full = { x: 0, y: 0, w: W, h: H }, MIN_W = 110;
  let view = { ...full }, hot = null, chosen = null, frame = 0, visible = null;
  /* Map units per screen pixel; the SVG letterboxes (meet), so the larger ratio applies. */
  const unit = () => { const r = svg.getBoundingClientRect(); return Math.max(view.w / Math.max(1, r.width || W), view.h / Math.max(1, r.height || H)); };

  /* Parishes in the same town share a point; spread them on a small ring. */
  const groups = new Map();
  for (const item of items) {
    const key = r1(item.x) + ',' + r1(item.y);
    groups.set(key, [...(groups.get(key) || []), item]);
  }

  function positions() {
    const u = unit(), out = [];
    for (const members of groups.values()) members.forEach((item, i) => {
      if (members.length === 1) return out.push({ ...item, px: item.x, py: item.y });
      const a = (i / members.length) * Math.PI * 2 - Math.PI / 2, rad = 11 * u;
      out.push({ ...item, px: item.x + Math.cos(a) * rad, py: item.y + Math.sin(a) * rad });
    });
    return out;
  }
  function clusters() {
    const u = unit(), pts = positions(), radius = 24 * u, used = new Set(), out = [];
    if (view.w <= MIN_W + 0.5) return pts.map(p => ({ members: [p], x: p.px, y: p.py }));
    for (const p of pts) {
      if (used.has(p.id)) continue;
      const near = pts.filter(q => !used.has(q.id) && Math.hypot(q.px - p.px, q.py - p.py) < radius);
      near.forEach(q => used.add(q.id));
      out.push({ members: near, x: near.reduce((s, q) => s + q.px, 0) / near.length, y: near.reduce((s, q) => s + q.py, 0) / near.length });
    }
    return out;
  }
  /* Labels, dots and lights keep their size on screen at every zoom, including mid-flight. */
  let scaled = [];
  function rescale() {
    const u = unit();
    if (!scaled.length) scaled = [...svg.querySelectorAll('.px')];
    scaled.forEach(el => el.setAttribute('transform', `scale(${u})`));
    world.querySelectorAll(':scope > g').forEach(g => { const t = g.getAttribute('transform'); if (t) g.setAttribute('transform', t.replace(/scale\([^)]*\)/, `scale(${u})`)); });
    return u;
  }
  function paint() {
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    const u = rescale();
    figure.classList.toggle('is-zoomed', view.w < W - 1);
    reset.hidden = view.w >= W - 1;
    world.replaceChildren(...clusters().map((c, i) => {
      const g = document.createElementNS(NS, 'g');
      g.style.setProperty('--i', i);
      g.setAttribute('transform', `translate(${c.x} ${c.y}) scale(${u})`);
      if (c.members.length > 1) {
        g.setAttribute('class', 'map-cluster' + (visible && !c.members.some(m => visible.has(m.id)) ? ' is-dim' : ''));
        g.dataset.members = c.members.map(m => m.id).join(' ');
        g.innerHTML = `<circle class="pulse" r="13"/><circle class="halo" r="26"/><circle class="disc" r="13"/><text dy="4.6">${c.members.length}</text>`;
        g.addEventListener('click', () => zoomTo(c.members));
      } else {
        const m = c.members[0];
        g.setAttribute('class', 'map-light' + (m.exact ? '' : ' is-approx') + (visible && !visible.has(m.id) ? ' is-dim' : ''));
        g.dataset.id = m.id;
        g.innerHTML = `<circle class="pulse" r="8"/><circle class="halo" r="20"/><circle class="ring" r="9"/><path class="core" d="M0-8.4C3.1-4 4.1-1.3 4.1 1.2a4.1 4.1 0 0 1-8.2 0c0-2.5 1-5.2 4.1-9.6Z"/><ellipse class="wick-light" cx="0" cy="1.6" rx="1.5" ry="2.3"/><text class="tag" x="13" y="4.5">${escapeXML(m.name)}</text>`;
        g.addEventListener('click', () => { choose(m.id); onChoose?.(m.id); });
        g.addEventListener('pointerenter', () => mark(m.id, true));
        g.addEventListener('pointerleave', () => mark(null, true));
      }
      return g;
    }));
    mark(hot, true);
    if (chosen) showCard(chosen);
    declutter();
  }
  /* A town name under a parish light gives way to the light. */
  function declutter() {
    const u = unit(), marks = [...world.children].map(g => {
      const m = /translate\(([-\d.e]+) ([-\d.e]+)\)/.exec(g.getAttribute('transform'));
      return m && { x: +m[1], y: +m[2], r: (g.classList.contains('map-cluster') ? 13 : 9) * u };
    }).filter(Boolean);
    svg.querySelectorAll('.map-places > g, .map-towns > g').forEach(g => {
      const m = /translate\(([-\d.e]+) ([-\d.e]+)\)/.exec(g.getAttribute('transform')), text = g.querySelector('text');
      if (!m || !text) return;
      let b;
      try { b = text.getBBox(); } catch { return; }
      if (!b.width) return;
      // the font box carries generous ascent and descent (Arabic most of all); test the ink band
      const x0 = +m[1] + b.x * u, x1 = +m[1] + (b.x + b.width) * u, y0 = +m[2] + (b.y + b.height * 0.22) * u, y1 = +m[2] + (b.y + b.height * 0.78) * u;
      g.classList.toggle('is-covered', marks.some(k => k.x + k.r > x0 && k.x - k.r < x1 && k.y + k.r > y0 && k.y - k.r < y1));
    });
  }
  function animate(to) {
    cancelAnimationFrame(frame);
    const from = { ...view }, start = performance.now(), still = matchMedia('(prefers-reduced-motion: reduce)').matches, dur = still ? 0 : 900;
    const ease = t => 1 - Math.pow(1 - t, 4);
    const step = now => {
      const t = dur ? Math.min(1, (now - start) / dur) : 1, k = ease(t);
      view = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, w: from.w + (to.w - from.w) * k, h: from.h + (to.h - from.h) * k };
      svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
      rescale();
      if (t < 1) frame = requestAnimationFrame(step); else paint();
    };
    frame = requestAnimationFrame(step);
  }
  function fit(xs, ys, pad = 40) {
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
    let w = Math.max(MIN_W, maxX - minX, (maxY - minY) * W / H), h = w * H / W;
    w = Math.min(w, W); h = Math.min(h, H);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    return { x: Math.min(Math.max(0, cx - w / 2), W - w), y: Math.min(Math.max(0, cy - h / 2), H - h), w, h };
  }
  function zoomTo(members) {
    hideCard();
    animate(fit(members.map(m => m.x), members.map(m => m.y), 30));
  }
  function mark(id, fromMap) {
    hot = id;
    world.querySelectorAll('.is-hot').forEach(el => el.classList.remove('is-hot'));
    if (!id) return;
    const el = world.querySelector(`.map-light[data-id="${CSS.escape(id)}"]`) ||
      [...world.querySelectorAll('.map-cluster')].find(c => c.dataset.members.split(' ').includes(id));
    el?.classList.add('is-hot');
    if (!fromMap) el?.parentNode.appendChild(el);
  }
  function showCard(id) {
    const item = items.find(i => i.id === id);
    if (!item) return hideCard();
    panel.innerHTML = card(item);
    panel.hidden = false;
    panel.querySelector('[data-card-close]')?.addEventListener('click', () => { chosen = null; hideCard(); world.querySelectorAll('.is-chosen').forEach(el => el.classList.remove('is-chosen')); });
  }
  function hideCard() { panel.hidden = true; panel.replaceChildren(); }
  function choose(id) {
    chosen = id;
    world.querySelectorAll('.is-chosen').forEach(el => el.classList.remove('is-chosen'));
    const light = world.querySelector(`.map-light[data-id="${CSS.escape(id)}"]`);
    if (!light) {
      const item = items.find(i => i.id === id);
      if (item) { zoomTo([item]); return; }
    }
    light?.classList.add('is-chosen');
    showCard(id);
  }
  reset.addEventListener('click', () => { chosen = null; hideCard(); animate(full); });

  /* The relief raster loads only when the map comes near the viewport. */
  const relief = svg.querySelector('[data-relief]');
  const load = () => { if (!relief.firstChild) relief.innerHTML = `<image href="assets/images/lebanon-relief.webp" width="${W}" height="${H}" preserveAspectRatio="none"/>`; };
  let seen;
  if ('IntersectionObserver' in window) { seen = new IntersectionObserver(e => { if (e.some(x => x.isIntersecting)) { load(); seen.disconnect(); } }, { rootMargin: '600px' }); seen.observe(figure); }
  else load();
  const resize = new ResizeObserver(() => paint());
  resize.observe(svg);
  paint();
  return {
    mark: id => mark(id, false),
    choose: id => choose(id),
    filter: ids => { visible = new Set(ids); paint(); },
    focus: ids => { const pts = items.filter(i => ids.includes(i.id)); if (pts.length) zoomTo(pts); else animate(full); },
    reset: () => animate(full),
    destroy: () => { resize.disconnect(); seen?.disconnect(); cancelAnimationFrame(frame); }
  };
}
const escapeXML = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
