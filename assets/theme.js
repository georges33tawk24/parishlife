/* Parish colour schemes.
   The stylesheets are written in Forest; every other scheme is derived from one colour and
   overrides the same tokens on <html>, so the office, the member portal, the CMS and the
   parish website all follow it. Text colours are checked for contrast before they are used. */

export const DEFAULT_PRIMARY = '#233B32';

export const SCHEMES = [
  { id: 'forest',   en: 'Forest',            ar: 'أخضر الغابة',   primary: DEFAULT_PRIMARY },
  { id: 'navy',     en: 'Navy',              ar: 'كحلي',          primary: '#1F3A5F' },
  { id: 'marian',   en: 'Marian blue',       ar: 'أزرق مريمي',    primary: '#1C4F8A' },
  { id: 'burgundy', en: 'Burgundy',          ar: 'خمري',          primary: '#6E1F31' },
  { id: 'purple',   en: 'Liturgical purple', ar: 'بنفسجي طقسي',   primary: '#4A2D6E' },
  { id: 'teal',     en: 'Teal',              ar: 'فيروزي',        primary: '#12514C' },
  { id: 'cedar',    en: 'Cedar brown',       ar: 'بنّي الأرز',     primary: '#5B3F2B' },
  { id: 'slate',    en: 'Slate',             ar: 'رمادي أردوازي', primary: '#2E3A46' }
];

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = v => HEX.test(String(v || ''));

/* ---------- OKLCH ⇄ sRGB ---------- */
const toLinear = c => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const fromLinear = c => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const channels = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };

function oklch(hex) {
  const [r, g, b] = channels(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return { l: L, c: Math.hypot(A, B), h: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 };
}

function linearRGB(L, C, H) {
  const a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
          -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
          -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}

/* Out-of-gamut colours keep their lightness and hue and lose chroma until they fit. */
const outside = rgb => rgb.some(v => v < -1e-4 || v > 1 + 1e-4);
function hex(L, C, H) {
  let rgb = linearRGB(L, C, H);
  if (outside(rgb)) {
    let lo = 0, hi = C;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (outside(linearRGB(L, mid, H))) hi = mid; else lo = mid; }
    rgb = linearRGB(L, lo, H);
  }
  return '#' + rgb.map(v => Math.round(Math.min(255, Math.max(0, fromLinear(Math.min(1, Math.max(0, v))))))
    .toString(16).padStart(2, '0')).join('').toUpperCase();
}

const luminance = h => { const [r, g, b] = channels(h).map(toLinear); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

/* Darken (keeping the hue) until the colour reaches the contrast it needs against every background. */
function atLeast(L, C, H, ratio, backgrounds) {
  let out = hex(L, C, H);
  while (L > 0.05 && backgrounds.some(bg => contrast(out, bg) < ratio)) { L -= 0.01; out = hex(L, C, H); }
  return out;
}

/* The colour the parish chose, made dark enough for white button text and for links on tinted panels. */
export function readable(color) {
  if (!isHex(color)) return DEFAULT_PRIMARY;
  const { l, c, h } = oklch(color);
  return atLeast(Math.min(l, 0.6), c, h, 7, ['#FFFFFF']);
}

export const rgbOf = h => channels(h).join(' ');
const overlay = (h, alpha) => '#' + channels(h).map(c => Math.round(255 * alpha + c * (1 - alpha)).toString(16).padStart(2, '0')).join('').toUpperCase();
/* Quiet white text on the coloured sidebar (counts, captions): as faint as Forest's, but never below 4.6:1. */
function quietOn(h) {
  let alpha = 0.62;
  while (alpha < 1 && contrast(overlay(h, alpha), h) < 4.6) alpha += 0.02;
  return overlay(h, Math.min(1, alpha));
}

/* Every token the stylesheets read, derived from one colour. */
export function palette(color) {
  const primary = readable(color);
  const { l, c, h } = oklch(primary);
  const quiet = k => Math.min(k, c);
  const bg = hex(0.975, quiet(0.006), h), muted = hex(0.951, quiet(0.012), h);
  const text = atLeast(Math.min(l, 0.33), Math.min(c, 0.045), h, 10, [bg]);
  const secondary = atLeast(0.529, quiet(0.023), h, 4.6, [bg, muted, '#FFFFFF']);
  return {
    primary, hover: hex(Math.max(0.12, l - 0.06), c * 0.9, h), text, secondary, bg, muted,
    selection: hex(0.897, quiet(0.026), h), border: hex(0.906, quiet(0.011), h), strong: hex(0.727, quiet(0.027), h),
    sage: hex(0.639, quiet(0.036), h), icon: atLeast(0.55, quiet(0.05), h, 4.5, [muted]), onInkQuiet: quietOn(primary)
  };
}

const APP_TOKENS = p => ({
  '--primary': p.primary, '--primary-hover': p.hover, '--primary-subtle': p.muted, '--primary-rgb': rgbOf(p.primary),
  '--ink': p.primary, '--on-dark': p.muted, '--on-dark-rgb': rgbOf(p.muted), '--on-ink-quiet': p.onInkQuiet, '--accent': p.primary,
  '--selection': p.selection, '--selection-hover': p.border,
  '--chart-1': p.primary, '--chart-2': p.secondary, '--chart-3': p.strong, '--chart-4': p.selection,
  '--text': p.text, '--text-2': p.secondary, '--text-3': p.secondary,
  '--bg': p.bg, '--surface-soft': p.bg, '--muted': p.muted, '--border': p.border, '--border-strong': p.strong,
  '--danger': p.primary, '--danger-subtle': p.muted, '--danger-ink': p.hover, '--danger-border': p.strong,
  '--info': p.secondary, '--info-subtle': p.bg, '--info-ink': p.text, '--info-border': p.border
});

const SITE_TOKENS = p => ({
  '--forest': p.primary, '--forest-rgb': rgbOf(p.primary), '--forest-hover': p.hover, '--deep-rgb': rgbOf(p.hover),
  '--icon': p.icon, '--ink': p.text, '--muted': p.secondary,
  '--sage': p.sage, '--sage-soft': p.strong, '--line': p.border, '--soft': p.muted, '--paper': p.bg, '--paper-rgb': rgbOf(p.bg)
});

/* A stored theme is { scheme, primary }; a scheme from SCHEMES is accepted too. Anything else is Forest. */
export function schemeOf(theme) {
  if (!theme || typeof theme !== 'object') return SCHEMES[0];
  const known = SCHEMES.find(s => s.id === (theme.scheme ?? theme.id));
  if (known) return known;
  return isHex(theme.primary) ? { id: 'custom', en: 'Custom colour', ar: 'لون مخصّص', primary: theme.primary.toUpperCase() } : SCHEMES[0];
}

const applied = new WeakMap();
function paint(theme, tokens, root) {
  const scheme = schemeOf(theme);
  const next = scheme.id === 'forest' ? {} : tokens(palette(scheme.primary));
  for (const name of applied.get(root) || []) if (!(name in next)) root.style.removeProperty(name);
  for (const [name, value] of Object.entries(next)) root.style.setProperty(name, value);
  applied.set(root, Object.keys(next));
  root.dataset.scheme = scheme.id;
  return scheme;
}

export const applyTheme = (theme, root = document.documentElement) => paint(theme, APP_TOKENS, root);
export const applySiteTheme = (theme, root = document.documentElement) => paint(theme, SITE_TOKENS, root);
