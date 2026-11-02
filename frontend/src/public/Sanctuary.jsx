/* The homepage sanctuary: a stone wall at night, a stained-glass window (a rose with the cross
   above two lancets, the cedar of Lebanon and the chalice), the light it lets in, a sanctuary
   lamp, and candles on the window sill: one lit candle for each parish on ParishLife. The window
   is a rendered picture (assets/images/sanctuary); the rest is drawn here in SVG and CSS. Motion
   lives in motion.js; styles/sanctuary.css holds the styles. */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { season } from '../lib/liturgy.js';
import { BEAMS, GLASS, beamOutline, polar, pts, r1, rng } from './sanctuary-geometry.js';

const GlassShapes = ({ part }) => part === 'rose'
  ? GLASS.rose.map(c => <circle key={c.cx} cx={c.cx} cy={c.cy} r={c.r} />)
  : <path d={GLASS[part]} />;
const GLASS_PARTS = ['rose', 'left', 'right'];

/* The window is a picture, rendered from its design (docs/tools/sanctuary_window.mjs and
   render_sanctuary.py): the cedar and the chalice under the rose. A parish's own window has the
   cedar on the right and the parish's initial in gold glass over the left medallion, on a ground
   of its own colour. Arabic mirrors the window, so the letter is turned back to read rightly. */
const IMAGES = 'assets/images/sanctuary/';
const GROUNDS = ['deep', 'wine', 'moss', 'violet'];
const seedOf = text => [...String(text)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
function InitialGlass({ ch }) {
  const rtl = document.documentElement.dir === 'rtl', ar = /[؀-ۿ]/.test(ch), mx = 295, my = 920;
  const text = { x: mx, y: my + (ar ? 30 : 44), textAnchor: 'middle', fontFamily: ar ? 'Amiri, serif' : 'Marcellus, Georgia, serif', fontWeight: ar ? 700 : 400, fontSize: ar ? 128 : 124,
    transform: rtl ? `translate(${mx * 2} 0) scale(-1 1)` : undefined };
  return <svg className="sn-initial" viewBox="-40 0 1080 1300" aria-hidden="true" focusable="false"><defs>
    <linearGradient id="sn-gilt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF2C4" /><stop offset=".42" stopColor="#F7CB62" /><stop offset="1" stopColor="#D9901F" /></linearGradient>
    <filter id="sn-streak" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".012 .07" numOctaves="3" seed="9" /><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .32  0 0 0 0 .05  0 0 0 -.7 .62" /><feComposite in2="SourceGraphic" operator="in" /></filter></defs>
    <text {...text} fill="url(#sn-gilt)" stroke="#140D0B" strokeWidth="5" strokeLinejoin="round" paintOrder="stroke">{ch}</text>
    <text {...text} fill="#E9A33A" filter="url(#sn-streak)">{ch}</text></svg>;
}
function WindowPicture({ seed, initial }) {
  if (initial) {
    const ground = seed ? GROUNDS[seedOf(seed) % GROUNDS.length] : GROUNDS[0];
    return <><img className="sn-window-img" src={`${IMAGES}parish-${ground}-1080.webp`} alt="" decoding="async" fetchPriority="high" draggable="false" /><InitialGlass ch={initial} /></>;
  }
  return <img className="sn-window-img" src={`${IMAGES}window-1080.webp`} srcSet={`${IMAGES}window-1080.webp 1080w, ${IMAGES}window-1620.webp 1620w`} sizes="(max-width: 1099px) 86vw, 44vh" alt="" decoding="async" fetchPriority="high" draggable="false" />;
}

/* The light through the glass: clouds passing, the brightness behind, the warmth of morning that
   comes as the page scrolls, and the dark each pane starts from before it lights. */
function LightSVG() {
  return <svg className="sn-light" viewBox="-40 0 1080 1300" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="sn-back" cx="50%" cy="40%" r="62%"><stop offset="0" stopColor="#FFF7DE" stopOpacity=".26" /><stop offset=".5" stopColor="#FFE3B0" stopOpacity=".08" /><stop offset="1" stopColor="#FFE3B0" stopOpacity="0" /></radialGradient>
      <radialGradient id="sn-sun" cx="50%" cy="36%" r="64%"><stop offset="0" style={{ stopColor: 'var(--sun-a)' }} stopOpacity=".45" /><stop offset=".55" style={{ stopColor: 'var(--sun-b)' }} stopOpacity=".16" /><stop offset="1" style={{ stopColor: 'var(--sun-b)' }} stopOpacity="0" /></radialGradient>
      <radialGradient id="sn-warm" cx="50%" cy="40%" r="60%"><stop offset="0" stopColor="#FFC56A" stopOpacity=".3" /><stop offset="1" stopColor="#FF9A3C" stopOpacity="0" /></radialGradient>
      <linearGradient id="sn-cloud" x1="0" y1="0" x2="1" y2=".35"><stop offset="0" stopColor="#000" stopOpacity="0" /><stop offset=".22" stopColor="#000" stopOpacity=".24" /><stop offset=".4" stopColor="#000" stopOpacity="0" /><stop offset=".62" stopColor="#000" stopOpacity=".18" /><stop offset=".8" stopColor="#000" stopOpacity="0" /></linearGradient>
      <clipPath id="sn-glass-light">{GLASS_PARTS.map(part => <GlassShapes key={part} part={part} />)}</clipPath>
    </defs>
    <g clipPath="url(#sn-glass-light)">
      <rect className="sn-clouds" x="-1000" y="0" width="3000" height="1200" fill="url(#sn-cloud)" />
      <rect className="sn-backlight" x="-100" y="0" width="1200" height="1200" fill="url(#sn-back)" />
      <rect className="sn-sun" x="0" y="0" width="1000" height="1200" fill="url(#sn-sun)" />
      <rect className="sn-dawn" x="0" y="0" width="1000" height="1200" fill="url(#sn-warm)" />
    </g>
    <g fill="#070505">{GLASS_PARTS.map(part => <g key={part} className="sn-dark"><GlassShapes part={part} /></g>)}</g>
  </svg>;
}

const OUTLINES = BEAMS.map(beamOutline);
function Beams() {
  return BEAMS.map((beam, i) => {
    const { outline, from, to } = OUTLINES[i];
    return <svg key={beam.k} className={`sn-beam sn-beam-${beam.k}`} viewBox="-1600 0 2640 2100" aria-hidden="true" focusable="false"><defs><linearGradient id={`sn-beam-${i}`} gradientUnits="userSpaceOnUse" x1={r1(from[0])} y1={r1(from[1])} x2={r1(to[0])} y2={r1(to[1])}>
      <stop offset=".08" stopColor={`rgb(${beam.tint[0]})`} stopOpacity="0" /><stop offset=".3" stopColor={`rgb(${beam.tint[0]})`} style={{ stopOpacity: 'calc(.4 * var(--beam-k, 1))' }} /><stop offset=".66" stopColor={`rgb(${beam.tint[1]})`} style={{ stopOpacity: 'calc(.14 * var(--beam-k, 1))' }} /><stop offset="1" stopColor={`rgb(${beam.tint[1]})`} stopOpacity="0" /></linearGradient></defs>
      <polygon points={pts(outline)} fill={`url(#sn-beam-${i})`} /></svg>;
  });
}

/* The nave in shadow: a blind arcade of round arches on pilasters, carved into the same wall.
   It only adds light and shade over the stones, so the wall's texture shows through it. */
function Arcade() {
  const bays = [[-330, 70], [70, 470], [470, 870]], spring = 430;
  return <svg className="sn-arcade-svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMinYMax slice" aria-hidden="true" focusable="false">
    <defs><linearGradient id="sn-niche" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity=".55" /><stop offset=".55" stopColor="#000" stopOpacity=".34" /><stop offset="1" stopColor="#000" stopOpacity=".5" /></linearGradient>
      <linearGradient id="sn-pier" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFE6C0" stopOpacity=".11" /><stop offset=".7" stopColor="#FFE6C0" stopOpacity=".04" /><stop offset="1" stopColor="#000" stopOpacity=".4" /></linearGradient></defs>
    {bays.map(([x0, x1]) => {
      const r = (x1 - x0) / 2 - 34, cx = (x0 + x1) / 2, l = cx - r, rr = cx + r;
      return <Fragment key={x0}><path d={`M${l} 1000V${spring}A${r} ${r} 0 0 1 ${rr} ${spring}V1000Z`} fill="url(#sn-niche)" />
        <path d={`M${l - 16} ${spring}A${r + 16} ${r + 16} 0 0 1 ${rr + 16} ${spring}`} fill="none" stroke="#FFE6C0" strokeOpacity=".09" strokeWidth="10" />
        <path d={`M${l} ${spring}A${r} ${r} 0 0 1 ${rr} ${spring}`} fill="none" stroke="#000" strokeOpacity=".45" strokeWidth="5" /></Fragment>;
    })}
    {[70, 470, 870].map(x => <Fragment key={x}><rect x={x - 34} y={spring + 26} width="68" height={1000 - spring - 26} fill="url(#sn-pier)" />
      <path d={`M${x - 46} ${spring}h92l-8 26h-76Z`} fill="#FFE6C0" fillOpacity=".1" stroke="#000" strokeOpacity=".4" strokeWidth="2" />
      <path d={`M${x - 44} 962h88v38h-88Z`} fill="#FFE6C0" fillOpacity=".06" /></Fragment>)}
  </svg>;
}

/* Incense in the light: the shafts as a soft mask over a drifting haze (the haze itself is a
   texture made on the visitor's device, below). */
const HAZE_MASK = (() => {
  const shapes = OUTLINES.map(({ outline, from, to }, i) => `<linearGradient id="h${i}" gradientUnits="userSpaceOnUse" x1="${r1(from[0])}" y1="${r1(from[1])}" x2="${r1(to[0])}" y2="${r1(to[1])}"><stop offset=".24" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity=".8"/><stop offset=".74" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><polygon points="${pts(outline)}" fill="url(#h${i})"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1600 0 2640 2100"><filter id="b"><feGaussianBlur stdDeviation="26"/></filter><g filter="url(#b)">${shapes}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();

/* A soft, seamless haze: smoothed value noise on a wrapped lattice, white with varying alpha. */
let haze = null;
function hazeTexture() {
  if (haze) return haze;
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
  return haze = canvas.toDataURL('image/png');
}

/* What the season brings into the sanctuary (pictures rendered by docs/tools/render_seasons.py): in
   the Season of the Holy Cross a cross of light on the wall; at the Birth and the Epiphany the star
   over the window; in Lent and Passion Week a violet veil across it; at the Resurrection the paschal
   candle, bearing the Alpha, the Omega and the year. Only one shows (CSS). */
function Season() {
  return <div className="sn-season" aria-hidden="true">
    <span className="sn-cross-light"></span>
    <span className="sn-star"></span>
    <span className="sn-veil"></span>
    <span className="sn-paschal"><i className="sn-paschal-flame"></i><b className="sn-pa-alpha">{'Α'}</b><b className="sn-pa-omega">{'Ω'}</b>
      {[...String(new Date().getFullYear())].map((digit, i) => <b key={i} className={`sn-pa-year sn-pa-y${i}`}>{digit}</b>)}</span>
  </div>;
}

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

/* The candles on the sill. places: [{id, name, town}]: each parish lights one candle in the
   middle of the sill, the empty places keep unlit candles to either side, and a visitor may
   light one. */
function sill(places, lit) {
  const random = rng(places.length + 3), total = Math.min(40, Math.max(9, places.length + 5));
  const order = Array.from({ length: total }, (_, i) => i).sort((a, b) => Math.abs(a - (total - 1) / 2) - Math.abs(b - (total - 1) / 2));
  const parishAt = new Map(order.slice(0, places.length).map((slot, i) => [slot, places[i]]));
  return Array.from({ length: total }, (_, i) => {
    const p = parishAt.get(i), h = p ? 70 + random() * 34 : 34 + random() * 36;
    const lean = (random() * 2 - 1) * (p ? 2.6 : 4), x = 6 + (i + .5) * 88 / total + (random() - .5) * 1.2;
    return { i, p, lit: !!p || (i % 3 === 1 && i / 3 < lit),
      style: { '--x': r1(x) + '%', '--h': r1(h), '--lean': r1(lean) + 'deg', '--d': r1(1.7 + random() * 1.6) + 's', '--o': r1(-random() * 3) + 's' } };
  });
}

/* places: the parishes' candles; onPick: a parish candle chosen; words: what the tip says over an
   unlit candle and a lit one; onTip: shows the tip ({text, left, top}) or hides it (null). */
export function Sanctuary({ inscription = '', seed = '', initial = '', places = [], lit = 0, onPick, words = { light: '', lit: '' }, onTip }) {
  const scene = useRef(null), box = useRef(null), tray = useRef(null), hazeRef = useRef(null);
  const candles = useMemo(() => sill(places, lit), [places, lit]);
  const [lighted, setLighted] = useState(() => new Set());
  const conditions = useMemo(() => ({ light: lightNow(), season: seasonNow() }), []);

  useEffect(() => {
    if (hazeRef.current && !document.documentElement.classList.contains('is-lite')) hazeRef.current.style.backgroundImage = `url(${hazeTexture()})`;
    // each lit candle throws a little light on the brass beneath it (the intro lights them one by one)
    const glints = () => { tray.current?.style.setProperty('--glints', [...box.current.querySelectorAll('.sn-candle.is-lit')].map(el => `radial-gradient(ellipse 6% 90% at ${el.style.getPropertyValue('--x')} 10%,rgb(255 214 150 / .62),rgb(255 214 150 / 0) 72%)`).join(',') || 'none'); };
    glints();
    const watch = new MutationObserver(glints);
    watch.observe(box.current, { subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => watch.disconnect();
  }, []);

  const show = (el, text) => {
    if (!onTip || !text) return;
    const r = el.getBoundingClientRect(), b = (scene.current.closest('[data-hero]') || scene.current).getBoundingClientRect();
    onTip({ text, left: r.left + r.width / 2 - b.left, top: r.top - b.top - 8 });
  };
  const choose = (candle, el) => {
    if (candle.p) return onPick?.(candle.p.id);
    if (candle.lit || lighted.has(candle.i)) return;
    setLighted(new Set(lighted).add(candle.i));
    show(el, words.lit);
    scene.current.closest('[data-scene]')?.dispatchEvent(new CustomEvent('sn-lit', { detail: el }));
  };

  return <div className="sanctuary" data-sanctuary aria-hidden="true" ref={scene} data-light={conditions.light} data-season={conditions.season}>
    <div className="sn-wall"></div>
    <div className="sn-arcade"><Arcade /></div>
    <div className="sn-spill"></div>
    <div className="sn-stage" data-sn-stage>
      <div className="sn-bloom"></div>
      <div className="sn-window"><WindowPicture seed={seed} initial={initial} /><LightSVG /></div>
      {inscription ? <p className="sn-inscription">{inscription.replace(/[&<>"']/g, '')}</p> : null}
      <div className="sn-beams"><Beams /><div className="sn-haze" style={{ '--mask': HAZE_MASK }}><i data-sn-haze ref={hazeRef}></i></div></div>
      <div className="sn-candles" data-sn-candles ref={box}>
        {candles.map(candle => {
          const lighting = lighted.has(candle.i);
          return <span key={candle.i} className={'sn-candle' + (candle.p ? ' is-lit is-parish' : candle.lit || lighting ? ' is-lit' : '') + (lighting ? ' is-lighting' : '')} style={candle.style} data-candle={candle.p ? candle.i : undefined}
            onPointerEnter={e => show(e.currentTarget, candle.p ? (candle.p.town ? `${candle.p.name}, ${candle.p.town}` : candle.p.name) : candle.lit || lighting ? words.lit : words.light)}
            onPointerLeave={() => onTip?.(null)} onClick={e => choose(candle, e.currentTarget)}><i className="sn-flame"></i><b className="sn-halo"></b></span>;
        })}
        <span className="sn-tray" data-sn-tray ref={tray}></span>
      </div>
      <Season />
      {/* The sanctuary lamp, hanging on its chains, with the red glass that says the Lord is here
          (assets/images/sanctuary/lamp.webp); its flame and glow are the page's, so they can breathe. */}
      <div className="sn-lamp" aria-hidden="true"><i className="sn-lamp-flame"></i><i className="sn-lamp-glow"></i></div>
    </div>
  </div>;
}

/* The rose window again, drawn in gold lines, for the verse further down the page. */
export function RoseOutline() {
  const spokes = [], lobes = [], petals = [];
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 6, b = a + Math.PI / 12;
    const [x0, y0] = polar(0, 0, 150, b), [x1, y1] = polar(0, 0, 236, b);
    spokes.push(`M${r1(x0)} ${r1(y0)}L${r1(x1)} ${r1(y1)}`);
    const [lx, ly] = polar(0, 0, 193, a);
    lobes.push(<Fragment key={i}><circle cx={r1(lx)} cy={r1(ly)} r="34" /><circle cx={r1(lx)} cy={r1(ly)} r="12" /></Fragment>);
    const [px, py] = polar(0, 0, 150, a), [qx, qy] = polar(0, 0, 70, a - .2), [sx, sy] = polar(0, 0, 70, a + .2);
    petals.push(`M${r1(qx)} ${r1(qy)}Q${r1(polar(0, 0, 120, a - .34)[0])} ${r1(polar(0, 0, 120, a - .34)[1])} ${r1(px)} ${r1(py)}Q${r1(polar(0, 0, 120, a + .34)[0])} ${r1(polar(0, 0, 120, a + .34)[1])} ${r1(sx)} ${r1(sy)}`);
  }
  return <svg viewBox="-260 -260 520 520" fill="none" stroke="currentColor" strokeWidth="1.6" focusable="false"><circle r="252" /><circle r="240" /><circle r="150" /><circle r="70" /><circle r="62" />
    <path d={spokes.join('') + petals.join('')} />{lobes}<path d="M0 -44V44M-44 0H44" strokeWidth="3" /></svg>;
}

/* Gold mosaic, as in the apse of an old church: small tesserae of gold leaf and glass, a little
   uneven, set in dark grout. Made on the visitor's device as a seamless tile. */
let mosaic = null;
export function mosaicTexture() {
  if (mosaic) return mosaic;
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
  return mosaic = canvas.toDataURL('image/png');
}
