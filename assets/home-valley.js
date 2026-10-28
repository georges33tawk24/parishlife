/* The hero valley: rendered layers of a Lebanese valley at blue hour (sky, far crest,
   valley with its villages), with the dawn versions laid over them. The images come from
   docs/tools/render_valley.py; VALLEY lists their sizes and the village spots where the
   parish lights can sit. Each parish on ParishLife gets one gold light. */
import VALLEY from './data/valley.js';

const DIR = 'assets/images/valley/';
const LAYERS = ['sky', 'far', 'near'];

export function valleyMarkup() {
  const layer = name => `<div class="vl vl-${name}" data-layer="${name}">
      <img class="vl-night" alt="" decoding="async" ${name === 'sky' ? 'fetchpriority="high"' : ''} data-part="${name}">
      <img class="vl-dawn" alt="" decoding="async" data-part="${name}" data-mood="dawn">
      ${name === 'near' ? '<img class="vl-glow" alt="" decoding="async" data-part="glow"><div class="vl-lights" data-lights></div>' : ''}
    </div>`;
  return `<div class="valley" data-valley aria-hidden="true">
    ${layer('sky')}<span class="shooting-star"></span>${layer('far')}
    <div class="vl vl-mist vl-mist-a"><i></i></div>
    ${layer('near')}
    <div class="vl vl-mist vl-mist-b"><i></i></div>
  </div>`;
}

/* places: [{id, name, town}]. Returns a controller; positions follow resizes. */
export function mountValley(host, places, { tip, onPick }) {
  const valley = host.querySelector('[data-valley]'), lightsBox = host.querySelector('[data-lights]');
  let frame = null, dawnWanted = false;
  const pick = () => (innerWidth / Math.max(1, host.clientHeight || innerHeight) < 0.85 ? 'tall' : 'wide');
  const src = (part, mood) => `${DIR}valley-${frame}-${mood}-${part}.webp`;
  function setSources() {
    valley.querySelectorAll('img[data-part]').forEach(img => {
      const mood = img.dataset.mood || 'dusk';
      if (mood === 'dawn' && !dawnWanted) return;
      const next = src(img.dataset.part, mood);
      if (img.getAttribute('src') !== next) img.src = next;
    });
  }
  /* The layers use object-fit: cover, so a spot in the image maps through the same crop. */
  function place() {
    const meta = VALLEY[frame], box = lightsBox.getBoundingClientRect();
    const w = lightsBox.clientWidth || box.width, h = lightsBox.clientHeight || box.height;
    const scale = Math.max(w / meta.width, h / meta.height);
    const ox = (w - meta.width * scale) / 2, oy = (h - meta.height * scale) * 0.5;
    const spots = slotsFor(meta.slots, places.length, frame);
    lightsBox.querySelectorAll('.valley-light').forEach((el, i) => {
      const s = spots[i];
      el.style.left = (ox + s.x * meta.width * scale) + 'px';
      el.style.top = (oy + s.y * meta.height * scale) + 'px';
      el.hidden = s.y * meta.height * scale + oy > h * 0.92;
    });
  }
  lightsBox.innerHTML = places.slice(0, 60).map((p, i) => `<span class="valley-light" data-light="${i}" style="--i:${i}"><i></i></span>`).join('');
  lightsBox.querySelectorAll('.valley-light').forEach((el, i) => {
    const p = places[i];
    el.addEventListener('pointerenter', () => {
      const r = el.getBoundingClientRect(), b = host.getBoundingClientRect();
      tip.textContent = p.town ? `${p.name}, ${p.town}` : p.name;
      tip.hidden = false;
      tip.style.left = (r.left + r.width / 2 - b.left) + 'px';
      tip.style.top = (r.top - b.top) + 'px';
    });
    el.addEventListener('pointerleave', () => { tip.hidden = true; });
    el.addEventListener('click', () => onPick(p.id));
  });
  function refresh() {
    const next = pick();
    if (next !== frame) { frame = next; valley.dataset.frame = frame; setSources(); }
    place();
  }
  refresh();
  const ro = new ResizeObserver(() => refresh());
  ro.observe(host);
  return {
    valley,
    loadDawn() { if (!dawnWanted) { dawnWanted = true; setSources(); } },
    destroy() { ro.disconnect(); }
  };
}

/* Spread the parishes over the village spots, keeping the side of the headline clear. */
function slotsFor(slots, count, frame) {
  const clear = frame === 'wide' ? slots.filter(s => s.x > 0.42 && s.x < 0.97) : slots.filter(s => s.y > 0.4);
  const pool = clear.length >= Math.min(count, 6) ? clear : slots;
  const out = [];
  for (let i = 0; i < count; i++) {
    const base = pool[i % pool.length], ring = Math.floor(i / pool.length);
    const a = ring * 2.4;
    out.push(ring ? { x: base.x + Math.cos(a) * 0.012 * ring, y: base.y + Math.sin(a) * 0.01 * ring } : base);
  }
  return out;
}
