/* Homepage motion with GSAP. One orchestrated moment: dawn breaking over the valley,
   on load and as the visitor scrolls out of the hero. Sections then settle once as
   they arrive, and the map draws its relief. Everything lives inside gsap.matchMedia,
   so reduced motion (or GSAP failing to load) leaves every element in its final state. */
let mm = null, introPlayed = false;

export function stopHomeMotion() { mm?.revert(); mm = null; }

/* heroOnly: a resize redraws the hero scene; sections already revealed stay as they are. */
export function animateHome(root, { onMapDrawn, heroOnly = false } = {}) {
  stopHomeMotion();
  const { gsap, ScrollTrigger, SplitText } = window;
  if (!gsap || !ScrollTrigger) { onMapDrawn?.(); return; }
  gsap.registerPlugin(ScrollTrigger, ...(SplitText ? [SplitText] : []));
  mm = gsap.matchMedia();
  mm.add({ motion: '(prefers-reduced-motion: no-preference)', still: '(prefers-reduced-motion: reduce)' }, context => {
    if (context.conditions.still) { onMapDrawn?.(); return; }
    const hero = root.querySelector('[data-hero]');
    if (hero) heroMotion(gsap, hero);
    if (heroOnly) return undefined;
    const stops = [reveals(gsap, root), mapMotion(gsap, root, onMapDrawn)];
    // Web fonts and images change the page height after the triggers are measured.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => stops.forEach(stop => stop?.());
  });
}

function heroMotion(gsap, hero) {
  const q = selector => hero.querySelectorAll(selector);
  const title = hero.querySelector('.hero-title');
  const intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
  intro.fromTo(q('.sky-dawn'), { opacity: 0 }, { opacity: 0.38, duration: 3.2, ease: 'sine.inOut' }, 0)
    .fromTo(q('.sun'), { opacity: 0 }, { opacity: 0.32, duration: 3.4, ease: 'sine.inOut' }, 0.3)
    .from(q('.stars'), { opacity: 0, duration: 2.4, ease: 'sine.out' }, 0)
    .from(q('.rise'), { y: (i, el, all) => 70 - i * (55 / all.length), duration: 2.2, stagger: 0.1 }, 0.05)
    .fromTo(q('.rim'), { opacity: 0 }, { opacity: 0.38, duration: 2.6, ease: 'sine.inOut' }, 1.2)
    .from(q('.chapel-door, .chapel-window, .door-glow'), { opacity: 0, duration: 1.2, stagger: 0.12, ease: 'power2.out' }, 0.9);
  if (title && window.SplitText) {
    // Words only: Arabic letters must stay joined.
    const split = window.SplitText.create(title, { type: 'words', mask: 'words', aria: 'auto' });
    intro.from(split.words, { yPercent: 115, duration: 1.3, stagger: 0.065 }, 0.35);
  } else if (title) intro.from(title, { y: 30, opacity: 0, duration: 1.2 }, 0.35);
  intro.from(q('[data-hero-rise]'), { y: 22, opacity: 0, duration: 1.1, stagger: 0.12 }, 0.85)
    .from(q('.parish-light'), { scale: 0, opacity: 0, transformOrigin: '50% 50%', duration: 0.9, stagger: 0.18, ease: 'back.out(2.4)' }, 1.15);
  if (introPlayed) intro.progress(1);
  introPlayed = true;

  // Scrolling out of the hero: the sky turns to morning, the ridges part, the lights fade.
  const parallax = [['.layer-far', 170], ['.layer-mid', 120], ['.layer-village', 78], ['.layer-hill', 36]];
  const day = gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.7 }, defaults: { ease: 'none' } });
  day.to(q('.sky-day'), { opacity: 0.9 }, 0)
    .to(q('.sun'), { attr: { cy: '-=140' } }, 0)
    .fromTo(q('.sun'), { scale: 1 }, { scale: 1.25, transformOrigin: '50% 50%', immediateRender: false }, 0)
    .to(q('.stars'), { opacity: 0 }, 0)
    .to(q('.lights'), { opacity: 0.3 }, 0)
    .to(q('.hero-inner'), { y: -110, opacity: 0, ease: 'power1.in' }, 0);
  parallax.forEach(([selector, distance]) => day.to(q(selector), { y: distance }, 0));
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

function reveals(gsap, root) {
  const blocks = [...root.querySelectorAll('[data-reveal]')], items = [...root.querySelectorAll('[data-reveal-item]')];
  gsap.set(blocks, { y: 32, opacity: 0 });
  gsap.set(items, { y: 28, opacity: 0 });
  const a = whenSeen(blocks, els => gsap.to(els, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.08, overwrite: true }));
  const b = whenSeen(items, els => gsap.to(els, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.07, overwrite: true }));
  return () => { a?.(); b?.(); };
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
