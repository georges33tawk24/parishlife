import { api } from './api.js';
import { bytes, text } from './passkeys.js';

/* Signing with a person's own signature (backend/signatures.py): the server names what is to be
   signed and its fingerprint; the person unlocks the passkey their signature is kept with (face,
   fingerprint or PIN), and that passkey signs the fingerprint. */
export async function signWith(options) {
  const credential = await navigator.credentials.get({ publicKey: { challenge: bytes(options.challenge), rpId: options.rpId, timeout: options.timeout,
    userVerification: 'required', allowCredentials: options.allowCredentials.map(c => ({ ...c, id: bytes(c.id) })) } });
  const r = credential.response;
  return { id: credential.id, clientDataJSON: text(r.clientDataJSON), authenticatorData: text(r.authenticatorData), signature: text(r.signature), userHandle: r.userHandle ? text(r.userHandle) : '' };
}
/* what: { type: 'certificate', parish, id } | { type: 'letter', parish, request, title, body } | { type: 'setup', drawing } */
export const sign = async what => signWith(await api('sign/options', 'POST', what));

/* A handwritten signature, kept as a path on a 400 × 140 page. */
export const drawingSVG = (path, cls = 'sig-drawing') =>
  `<svg class="${cls}" viewBox="0 0 400 140" aria-hidden="true" focusable="false"><path d="${String(path).replace(/[^MLQCZmlqcz0-9 .,-]/g, '')}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* A pad to draw a signature on with a finger, a pen or a mouse. Each stroke is smoothed into
   quadratic curves through the midpoints of what was drawn. */
export function signaturePad(svg) {
  const strokes = [];
  let current = null;
  const at = e => { const r = svg.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * 4000) / 10, Math.round((e.clientY - r.top) / r.height * 1400) / 10]; };
  const smooth = pts => {
    if (pts.length < 3) return `M${pts[0][0]} ${pts[0][1]}L${(pts.at(-1)[0] + .1).toFixed(1)} ${pts.at(-1)[1]}`;
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) d += `Q${pts[i][0]} ${pts[i][1]} ${((pts[i][0] + pts[i + 1][0]) / 2).toFixed(1)} ${((pts[i][1] + pts[i + 1][1]) / 2).toFixed(1)}`;
    return d + `L${pts.at(-1)[0]} ${pts.at(-1)[1]}`;
  };
  const path = svg.querySelector('path');
  const paint = () => { path.setAttribute('d', strokes.map(smooth).join('')); svg.dispatchEvent(new CustomEvent('signature', { bubbles: true })); };
  svg.addEventListener('pointerdown', e => { e.preventDefault(); svg.setPointerCapture(e.pointerId); current = [at(e)]; strokes.push(current); paint(); });
  svg.addEventListener('pointermove', e => {
    if (!current) return;
    const p = at(e), last = current.at(-1);
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 2.5) { current.push(p); paint(); }
  });
  const end = () => { current = null; };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  return { path: () => strokes.map(smooth).join(''), empty: () => !strokes.some(s => s.length > 2), clear: () => { strokes.length = 0; paint(); } };
}
