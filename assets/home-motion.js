/* Homepage motion with GSAP (and Lenis for smooth scrolling). The orchestrated moment is
   the valley: the camera settles, the villages light up, then one gold light per parish;
   scrolling turns the night into the dawn render while the layers part. Sections then
   arrive once, headings rise word by word, the About text lights up as it is read, and
   numbers count up. Everything lives inside gsap.matchMedia: with reduced motion, or if
   a script fails to load, every element simply shows in its final state. */
let mm = null, introPlayed = false, introPlayedBefore = false, lenis = null;
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function stopHomeMotion() { mm?.revert(); mm = null; }

/* Scroll to a section, smoothly when motion is welcome; the sticky header is accounted for. */
export function scrollToTarget(el) {
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -72, duration: 1.4 });
  else el.scrollIntoView({ behavior: still() ? 'auto' : 'smooth' });
}

function smoothScroll(gsap, ScrollTrigger) {
  if (lenis || !window.Lenis || still()) return;
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, anchors: { offset: -72 } });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(time => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => { if (e.matches) { lenis?.destroy(); lenis = null; } });
}

export function animateHome(root, { onMapDrawn, onDawn } = {}) {
  stopHomeMotion();
  const { gsap, ScrollTrigger, SplitText } = window;
  if (!gsap || !ScrollTrigger) { onMapDrawn?.(); onDawn?.(); return; }
  gsap.registerPlugin(ScrollTrigger, ...(SplitText ? [SplitText] : []));
  mm = gsap.matchMedia();
  mm.add({ motion: '(prefers-reduced-motion: no-preference)', calm: '(prefers-reduced-motion: reduce)', fine: '(pointer: fine)' }, context => {
    if (context.conditions.calm) { onMapDrawn?.(); return undefined; }
    smoothScroll(gsap, ScrollTrigger);
    const hero = root.querySelector('[data-hero]');
    const stops = [
      hero && heroMotion(gsap, hero, onDawn),
      hero && context.conditions.fine && pointerDepth(gsap, hero),
      headings(gsap, root),
      reveals(gsap, root),
      counters(gsap, root),
      litText(gsap, root),
      parallaxImages(gsap, root),
      mapMotion(gsap, root, onMapDrawn)
    ];
    // Web fonts and images change the page height after the triggers are measured.
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    addEventListener('load', refresh, { once: true });
    root.querySelectorAll('img').forEach(img => { if (!img.complete) img.addEventListener('load', refresh, { once: true }); });
    return () => stops.forEach(stop => typeof stop === 'function' && stop());
  });
}

function heroMotion(gsap, hero, onDawn) {
  const q = s => hero.querySelectorAll(s);
  const title = hero.querySelector('.hero-title');
  let dawnAsked = false;
  const askDawn = () => { if (!dawnAsked) { dawnAsked = true; onDawn?.(); } };
  const intro = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: askDawn });
  intro.fromTo(q('.valley'), { scale: 1.16, opacity: 0 }, { scale: 1.04, opacity: 1, duration: 3.6, ease: 'power3.out' }, 0)
    .from(q('.vl-sky'), { yPercent: -4, duration: 3 }, 0)
    .from(q('.vl-far'), { yPercent: 5, duration: 3 }, 0.1)
    .from(q('.vl-near'), { yPercent: 9, duration: 3 }, 0.2)
    .fromTo(q('.vl-mist'), { opacity: 0 }, { opacity: 1, duration: 3, ease: 'sine.inOut' }, 0.6)
    .fromTo(q('.vl-glow'), { opacity: 0 }, { opacity: 1, duration: 2.6, ease: 'sine.inOut' }, 1.0);
  if (title && window.SplitText) {
    // Words only: Arabic letters must stay joined.
    const split = window.SplitText.create(title, { type: 'words', mask: 'words', aria: 'auto' });
    intro.from(split.words, { yPercent: 118, rotate: 3, duration: 1.5, stagger: 0.075 }, 0.55);
  } else if (title) intro.from(title, { y: 30, opacity: 0, duration: 1.2 }, 0.55);
  intro.from(q('[data-hero-rise]'), { y: 26, opacity: 0, duration: 1.2, stagger: 0.12 }, 1.15)
    .from(q('.valley-light'), { scale: 0, opacity: 0, duration: 1.1, stagger: 0.2, ease: 'back.out(3)' }, 1.9);
  introPlayedBefore = introPlayed;
  if (introPlayed) intro.progress(1);
  introPlayed = true;

  // Scrolling out of the hero: night turns to dawn while the layers part.
  const day = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.8, onUpdate: self => { if (self.progress > 0.02) askDawn(); } }
  });
  day.to(q('.vl-sky'), { yPercent: 16 }, 0)
    .to(q('.vl-far'), { yPercent: 10 }, 0)
    .to(q('.vl-near'), { yPercent: 3, scale: 1.06, transformOrigin: '50% 100%' }, 0)
    .to(q('.vl-dawn'), { opacity: 1, ease: 'sine.inOut' }, 0.05)
    .to(q('.vl-glow, .shooting-star'), { opacity: 0 }, 0)
    .to(q('.vl-lights'), { opacity: 0.2 }, 0.1)
    .to(q('.hero-inner'), { yPercent: -18, opacity: 0, ease: 'power1.in' }, 0);
  return () => intro.kill();
}

/* The layers drift with the pointer at different depths. */
function pointerDepth(gsap, hero) {
  const layers = [['.vl-sky', 6], ['.vl-far', 13], ['.vl-mist-a', 20], ['.vl-near', 26], ['.vl-mist-b', 34]]
    .map(([s, k]) => [hero.querySelector(s), k]).filter(([el]) => el)
    .map(([el, k]) => ({ k, x: gsap.quickTo(el, 'x', { duration: 1.4, ease: 'power3.out' }), y: gsap.quickTo(el, 'y', { duration: 1.4, ease: 'power3.out' }) }));
  const move = e => {
    const r = hero.getBoundingClientRect();
    if (e.clientY > r.bottom) return;
    const dx = (e.clientX / innerWidth - 0.5) * 2, dy = ((e.clientY - r.top) / r.height - 0.5) * 2;
    layers.forEach(l => { l.x(-dx * l.k); l.y(-dy * l.k * 0.5); });
  };
  addEventListener('pointermove', move, { passive: true });
  return () => removeEventListener('pointermove', move);
}

/* Reveals use IntersectionObserver rather than measured scroll positions, so content
   that loads late above them can never leave a section hidden. */
function whenSeen(elements, onEnter, rootMargin = '0px 0px -10% 0px') {
  if (!elements.length) return null;
  const io = new IntersectionObserver(entries => {
    const seen = entries.filter(e => e.isIntersecting).map(e => e.target);
    seen.forEach(el => io.unobserve(el));
    if (seen.length) onEnter(seen);
  }, { rootMargin });
  elements.forEach(el => io.observe(el));
  return () => io.disconnect();
}

/* Section headings rise word by word from behind a mask. */
function headings(gsap, root) {
  if (!window.SplitText) return null;
  const list = [...root.querySelectorAll('section:not([data-hero]) h2')];
  const splits = list.map(h => window.SplitText.create(h, { type: 'words', mask: 'words', aria: 'auto' }));
  splits.forEach(s => gsap.set(s.words, { yPercent: 115 }));
  const stop = whenSeen(list, els => els.forEach(h => {
    const s = splits[list.indexOf(h)];
    gsap.to(s.words, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.06 });
  }));
  return () => { stop?.(); splits.forEach(s => s.revert()); };
}

function reveals(gsap, root) {
  const blocks = [...root.querySelectorAll('[data-reveal]')];
  const items = [...root.querySelectorAll('[data-reveal-item]')].filter(el => !el.closest('.arcade'));
  const arches = [...root.querySelectorAll('.arcade > li')];
  gsap.set(blocks, { y: 32, opacity: 0 });
  gsap.set(items, { y: 28, opacity: 0 });
  gsap.set(arches, { y: 60, scaleY: 0.86, opacity: 0, transformOrigin: '50% 100%' });
  const a = whenSeen(blocks, els => gsap.to(els, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.08, overwrite: true }));
  const b = whenSeen(items, els => gsap.to(els, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.07, overwrite: true }));
  // the arcade is built arch by arch
  const c = whenSeen(arches.slice(0, 1), () => gsap.to(arches, { y: 0, scaleY: 1, opacity: 1, duration: 1.3, ease: 'expo.out', stagger: 0.09, overwrite: true }));
  return () => { a?.(); b?.(); c?.(); };
}

/* Numbers count up once they come into view, in the page's own digits. */
function counters(gsap, root) {
  const els = [...root.querySelectorAll('[data-count]')];
  const fmt = new Intl.NumberFormat(document.documentElement.lang === 'ar' ? 'ar-LB' : 'en');
  els.forEach(el => { el.textContent = fmt.format(0); });
  const stop = whenSeen(els, seen => seen.forEach(el => {
    const n = { v: 0 }, to = Number(el.dataset.count) || 0;
    gsap.to(n, { v: to, delay: el.closest('[data-hero]') && !introPlayedBefore ? 1.3 : 0, duration: Math.min(2.4, 0.9 + to * 0.05), ease: 'power2.out', onUpdate: () => { el.textContent = fmt.format(Math.round(n.v)); } });
  }), '0px');
  return () => { stop?.(); els.forEach(el => { el.textContent = new Intl.NumberFormat(document.documentElement.lang === 'ar' ? 'ar-LB' : 'en').format(Number(el.dataset.count) || 0); }); };
}

/* The About text lights up word by word as the visitor reads down the page. */
function litText(gsap, root) {
  if (!window.SplitText) return null;
  const blocks = [...root.querySelectorAll('[data-lit]')];
  const splits = blocks.map(b => window.SplitText.create(b.querySelectorAll('p'), { type: 'words', aria: 'auto' }));
  splits.forEach((s, i) => gsap.fromTo(s.words, { opacity: 0.22 }, {
    opacity: 1, ease: 'none', stagger: 0.04,
    scrollTrigger: { trigger: blocks[i], start: 'top 78%', end: 'bottom 52%', scrub: 0.6 }
  }));
  return () => splits.forEach(s => s.revert());
}

/* Images in arches drift slightly against the scroll. */
function parallaxImages(gsap, root) {
  root.querySelectorAll('[data-parallax]').forEach(img => {
    gsap.fromTo(img, { yPercent: -Number(img.dataset.parallax || 8) }, {
      yPercent: Number(img.dataset.parallax || 8), ease: 'none',
      scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });
  const join = root.querySelector('.join-art');
  if (join) {
    const imgs = join.querySelectorAll('img');
    imgs.forEach((img, i) => gsap.fromTo(img, { yPercent: [6, 10, 16][i] || 0 }, {
      yPercent: 0, ease: 'none', scrollTrigger: { trigger: join.parentElement, start: 'top bottom', end: 'bottom bottom', scrub: true }
    }));
  }
  return null;
}

function mapMotion(gsap, root, onMapDrawn) {
  const figure = root.querySelector('[data-lebanon-map]');
  if (!figure) return null;
  const lines = figure.querySelectorAll('.map-contours path, .map-rivers path');
  figure.classList.add('lights-off');
  gsap.set(lines, { strokeDasharray: 1, strokeDashoffset: 1 });
  const draw = gsap.timeline({ paused: true, onComplete: () => onMapDrawn?.() })
    .to(figure.querySelectorAll('.map-contours path'), { strokeDashoffset: 0, duration: 2.6, ease: 'power2.inOut', stagger: 0.12 }, 0)
    .to(figure.querySelectorAll('.map-rivers path'), { strokeDashoffset: 0, duration: 2, ease: 'power1.inOut' }, 0.8)
    .add(() => figure.classList.remove('lights-off'), 1.4);
  const stop = whenSeen([figure], () => draw.play(), '0px 0px -25% 0px');
  return () => { stop?.(); figure.classList.remove('lights-off'); };
}
