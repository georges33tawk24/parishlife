/* The directory map: Lebanon with its relief, and a gold light for every parish.
   A parish appears where its public profile's coordinates place it; otherwise at the
   centre of its town when the town is known. Close lights gather into a numbered
   cluster that zooms in when chosen. Geography never mirrors in Arabic. */
import { forwardRef, memo, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import MAP from '../../lib/data/lebanon-map.js';
import { still } from '../site.jsx';

export const projection = MAP.projection;

const { width: W, height: H } = MAP;

const fold = value =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ًͯ-ٰٟ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();

const TOWNS = new Map();

for (const t of MAP.towns) {
  TOWNS.set(fold(t.en), t);
  TOWNS.set(fold(t.ar), t);
}

/* Where a parish sits on the map, in map units, or null when nothing places it. */
export function locate(parish, detail) {
  const visit = detail?.visit || {};
  const lat = Number(visit.latitude),
    lon = Number(visit.longitude);
  if (
    String(visit.latitude ?? '').trim() &&
    String(visit.longitude ?? '').trim() &&
    Number.isFinite(lat) &&
    Number.isFinite(lon)
  ) {
    const x = (lon - MAP.projection.lon0) * MAP.projection.kx,
      y = (MAP.projection.lat1 - lat) * MAP.projection.ky;
    if (x >= 0 && x <= W && y >= 0 && y <= H) return { x, y, exact: true };
  }
  const town = TOWNS.get(fold(parish.town)) || TOWNS.get(fold(parish.townAr));
  return town ? { x: town.x, y: town.y, exact: false } : null;
}

const r1 = n => Math.round(n * 10) / 10;

const placed = new Set(MAP.places.map(p => r1(p.x) + ',' + r1(p.y)));

const TOWN_DOTS = (() => {
  const seen = new Set();
  return MAP.towns.filter(t => {
    const key = r1(t.x) + ',' + r1(t.y);
    if (placed.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
})();

const FULL = { x: 0, y: 0, w: W, h: H },
  MIN_W = 110;

/* The land, its relief, rivers and names. Labels and dots are sized in screen pixels: each scales
   by u, map units per pixel, set by the map as it zooms. */
const Land = memo(function Land({ L, u, relief }) {
  const s = `scale(${u})`;
  return (
    <>
      <path className="map-land" d={MAP.land} />
      <g clipPath="url(#land-clip)" className="map-relief" data-relief>
        {relief ? (
          <image href="assets/images/lebanon-relief.webp" width={W} height={H} preserveAspectRatio="none" />
        ) : null}
      </g>
      <path className="map-regions" d={MAP.regions} />
      <g className="map-contours">
        {MAP.relief.map((r, i) => (
          <path key={i} className={'c' + r.level} d={r.d} pathLength="1" />
        ))}
      </g>
      <g className="map-rivers">
        {MAP.rivers.map((r, i) => (
          <path key={i} d={r.d} pathLength="1">
            <title>{L(r.en, r.ar)}</title>
          </path>
        ))}
      </g>
      <path className="map-coast" d={MAP.land} />
      <g className="map-labels">
        {MAP.labels.map((l, i) => (
          <g
            key={i}
            className={`map-label map-label-${l.kind}`}
            transform={`translate(${l.x} ${l.y}) rotate(${l.rotate})`}
          >
            <text className="px" transform={s}>
              {L(l.en, l.ar)}
            </text>
          </g>
        ))}
      </g>
      <g className="map-towns">
        {TOWN_DOTS.map((t, i) => (
          <g key={i} transform={`translate(${t.x} ${t.y})`}>
            <g className="px" transform={s}>
              <circle r="1.8" />
              <text x="5" y="4">
                {L(t.en, t.ar)}
              </text>
            </g>
          </g>
        ))}
      </g>
      <g className="map-places">
        {MAP.places.map((p, i) => (
          <g key={i} className={`map-place rank-${p.rank}`} transform={`translate(${p.x} ${p.y})`}>
            <g className="px" transform={s}>
              <circle r="2.2" />
              <text x="6" y="4">
                {L(p.en, p.ar)}
              </text>
            </g>
          </g>
        ))}
      </g>
    </>
  );
});

/* items: [{id, x, y, exact, name, town}]; card(item, close) draws the chosen parish's card. The
   ref is the controller the list drives: mark, choose, focus and reset. visible: the parishes the
   list shows (the others dim), or null for all. */
export const LebanonMap = forwardRef(function LebanonMap({ L, items, visible = null, card, onChoose }, ref) {
  const figure = useRef(null),
    svg = useRef(null),
    lights = useRef(null);
  const [view, setView] = useState(FULL);
  const [box, setBox] = useState({ width: W, height: H });
  const shown = visible ? new Set(visible) : null;
  const [hot, setHot] = useState(null);
  const [raised, setRaised] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [relief, setRelief] = useState(false);
  const flight = useRef({ frame: 0, view: FULL });
  flight.current.view = view;

  /* Map units per screen pixel; the SVG letterboxes (meet), so the larger ratio applies. */
  const unitOf = v => Math.max(v.w / Math.max(1, box.width || W), v.h / Math.max(1, box.height || H));
  const u = unitOf(view);

  /* Parishes in the same town share a point; spread them on a small ring. Close lights gather. */
  const clusters = useMemo(() => {
    const groups = new Map();
    for (const item of items) {
      const key = r1(item.x) + ',' + r1(item.y);
      groups.set(key, [...(groups.get(key) || []), item]);
    }
    const positions = [];
    for (const members of groups.values())
      members.forEach((item, i) => {
        if (members.length === 1) return positions.push({ ...item, px: item.x, py: item.y });
        const a = (i / members.length) * Math.PI * 2 - Math.PI / 2,
          rad = 11 * u;
        positions.push({ ...item, px: item.x + Math.cos(a) * rad, py: item.y + Math.sin(a) * rad });
      });
    if (view.w <= MIN_W + 0.5) return positions.map(p => ({ members: [p], x: p.px, y: p.py }));
    const radius = 24 * u,
      used = new Set(),
      out = [];
    for (const p of positions) {
      if (used.has(p.id)) continue;
      const near = positions.filter(q => !used.has(q.id) && Math.hypot(q.px - p.px, q.py - p.py) < radius);
      near.forEach(q => used.add(q.id));
      out.push({
        members: near,
        x: near.reduce((s, q) => s + q.px, 0) / near.length,
        y: near.reduce((s, q) => s + q.py, 0) / near.length
      });
    }
    return out;
  }, [items, view.w, u]);

  const hotIndex = hot ? clusters.findIndex(c => c.members.some(m => m.id === hot)) : -1;
  // a light marked from the list comes to the front
  const ordered =
    raised && hotIndex >= 0 ? [...clusters.filter((_, i) => i !== hotIndex), clusters[hotIndex]] : clusters;

  function animate(to) {
    cancelAnimationFrame(flight.current.frame);
    const from = { ...flight.current.view },
      start = performance.now(),
      dur = still() ? 0 : 900;
    const ease = t => 1 - Math.pow(1 - t, 4);
    /* In flight the view and the sizes change in place; the lights are drawn again when it lands. */
    const step = now => {
      const t = dur ? Math.min(1, (now - start) / dur) : 1,
        k = ease(t);
      const v = {
        x: from.x + (to.x - from.x) * k,
        y: from.y + (to.y - from.y) * k,
        w: from.w + (to.w - from.w) * k,
        h: from.h + (to.h - from.h) * k
      };
      flight.current.view = v;
      if (t < 1) {
        const s = `scale(${unitOf(v)})`;
        svg.current.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
        svg.current.querySelectorAll('.px').forEach(el => el.setAttribute('transform', s));
        lights.current.querySelectorAll(':scope > g').forEach(g => {
          const tr = g.getAttribute('transform');
          if (tr) g.setAttribute('transform', tr.replace(/scale\([^)]*\)/, s));
        });
        flight.current.frame = requestAnimationFrame(step);
      } else setView(to);
    };
    flight.current.frame = requestAnimationFrame(step);
  }
  function fit(xs, ys, pad = 40) {
    const minX = Math.min(...xs) - pad,
      maxX = Math.max(...xs) + pad,
      minY = Math.min(...ys) - pad,
      maxY = Math.max(...ys) + pad;
    let w = Math.max(MIN_W, maxX - minX, ((maxY - minY) * W) / H),
      h = (w * H) / W;
    w = Math.min(w, W);
    h = Math.min(h, H);
    const cx = (minX + maxX) / 2,
      cy = (minY + maxY) / 2;
    return { x: Math.min(Math.max(0, cx - w / 2), W - w), y: Math.min(Math.max(0, cy - h / 2), H - h), w, h };
  }
  const zoomTo = members => {
    setChosen(null);
    animate(
      fit(
        members.map(m => m.x),
        members.map(m => m.y),
        30
      )
    );
  };
  function choose(id) {
    if (!clusters.some(c => c.members.length === 1 && c.members[0].id === id)) {
      const item = items.find(i => i.id === id);
      if (item) {
        zoomTo([item]);
        return;
      }
    }
    setChosen(id);
  }
  const close = () => setChosen(null);

  useImperativeHandle(ref, () => ({
    mark: id => {
      setHot(id);
      setRaised(id);
    },
    choose,
    focus: ids => {
      const pts = items.filter(i => ids.includes(i.id));
      if (pts.length) zoomTo(pts);
      else animate(FULL);
    },
    reset: () => animate(FULL)
  }));

  /* The map follows its size; the relief raster loads only when the map comes near the viewport. */
  useLayoutEffect(() => {
    const measure = () => {
      const r = svg.current.getBoundingClientRect();
      setBox(b => (b.width === r.width && b.height === r.height ? b : { width: r.width, height: r.height }));
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(svg.current);
    let seen;
    if ('IntersectionObserver' in window) {
      seen = new IntersectionObserver(
        e => {
          if (e.some(x => x.isIntersecting)) {
            setRelief(true);
            seen.disconnect();
          }
        },
        { rootMargin: '600px' }
      );
      seen.observe(figure.current);
    } else setRelief(true);
    return () => {
      resize.disconnect();
      seen?.disconnect();
      cancelAnimationFrame(flight.current.frame);
    };
  }, []);
  useLayoutEffect(() => {
    figure.current.classList.toggle('is-zoomed', view.w < W - 1);
  }, [view.w]);

  /* A town name under a parish light gives way to the light. */
  useLayoutEffect(() => {
    const marks = clusters.map(c => ({ x: c.x, y: c.y, r: (c.members.length > 1 ? 13 : 9) * u }));
    svg.current.querySelectorAll('.map-places > g, .map-towns > g').forEach(g => {
      const m = /translate\(([-\d.e]+) ([-\d.e]+)\)/.exec(g.getAttribute('transform')),
        text = g.querySelector('text');
      if (!m || !text) return;
      let b;
      try {
        b = text.getBBox();
      } catch {
        return;
      }
      if (!b.width) return;
      // the font box carries generous ascent and descent (Arabic most of all); test the ink band
      const x0 = +m[1] + b.x * u,
        x1 = +m[1] + (b.x + b.width) * u,
        y0 = +m[2] + (b.y + b.height * 0.22) * u,
        y1 = +m[2] + (b.y + b.height * 0.78) * u;
      g.classList.toggle(
        'is-covered',
        marks.some(k => k.x + k.r > x0 && k.x - k.r < x1 && k.y + k.r > y0 && k.y - k.r < y1)
      );
    });
  }, [clusters, u]);

  const chosenItem = chosen && items.find(i => i.id === chosen);
  return (
    <figure className="lebanon-map" data-lebanon-map ref={figure}>
      <svg
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        role="img"
        aria-label={L(
          'Map of Lebanon with the parishes on ParishLife',
          'خريطة لبنان مع الرعايا المسجّلة على ParishLife'
        )}
        ref={svg}
      >
        <defs>
          <clipPath id="land-clip">
            <path d={MAP.land} />
          </clipPath>
          <radialGradient id="map-lamp" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#FFE3A3" />
            <stop offset=".45" stopColor="#D7A548" stopOpacity=".5" />
            <stop offset="1" stopColor="#D7A548" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="map-world">
          <Land L={L} u={u} relief={relief} />
          <g className="map-lights" data-lights ref={lights}>
            {ordered.map((c, i) => {
              const transform = `translate(${c.x} ${c.y}) scale(${u})`;
              if (c.members.length > 1) {
                const isHot = hot && c.members.some(m => m.id === hot);
                return (
                  <g
                    key={'c' + c.members.map(m => m.id).join(' ')}
                    className={
                      'map-cluster' +
                      (shown && !c.members.some(m => shown.has(m.id)) ? ' is-dim' : '') +
                      (isHot ? ' is-hot' : '')
                    }
                    style={{ '--i': i }}
                    transform={transform}
                    data-members={c.members.map(m => m.id).join(' ')}
                    onClick={() => zoomTo(c.members)}
                  >
                    <circle className="pulse" r="13" />
                    <circle className="halo" r="26" />
                    <circle className="disc" r="13" />
                    <text dy="4.6">{c.members.length}</text>
                  </g>
                );
              }
              const m = c.members[0];
              return (
                <g
                  key={m.id}
                  className={
                    'map-light' +
                    (m.exact ? '' : ' is-approx') +
                    (shown && !shown.has(m.id) ? ' is-dim' : '') +
                    (hot === m.id ? ' is-hot' : '') +
                    (chosen === m.id ? ' is-chosen' : '')
                  }
                  style={{ '--i': i }}
                  transform={transform}
                  data-id={m.id}
                  onClick={() => {
                    choose(m.id);
                    onChoose?.(m.id);
                  }}
                  onPointerEnter={() => {
                    setHot(m.id);
                    setRaised(null);
                  }}
                  onPointerLeave={() => setHot(null)}
                >
                  <circle className="pulse" r="8" />
                  <circle className="halo" r="20" />
                  <circle className="ring" r="9" />
                  <path className="core" d="M0-8.4C3.1-4 4.1-1.3 4.1 1.2a4.1 4.1 0 0 1-8.2 0c0-2.5 1-5.2 4.1-9.6Z" />
                  <ellipse className="wick-light" cx="0" cy="1.6" rx="1.5" ry="2.3" />
                  <text className="tag" x="13" y="4.5">
                    {m.name}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
      <button
        type="button"
        className="map-reset"
        data-map-reset
        hidden={view.w >= W - 1}
        onClick={() => {
          setChosen(null);
          animate(FULL);
        }}
      >
        {L('Show all of Lebanon', 'عرض لبنان كاملاً')}
      </button>
      <div className="map-card" data-map-card hidden={!chosenItem}>
        {chosenItem ? card(chosenItem, close) : null}
      </div>
      <figcaption>
        {L(
          'Each flame is a parish, a candle lit on the map. Relief and rivers are illustrative; borders from Natural Earth.',
          'كل شعلة رعية، شمعة مضاءة على الخريطة. التضاريس والأنهار توضيحية؛ الحدود من Natural Earth.'
        )}
      </figcaption>
    </figure>
  );
});
