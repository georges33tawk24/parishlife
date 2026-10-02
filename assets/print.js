/* Printing and saving documents without leaving the page.
   A sheet is written into a hidden frame and printed from there: no new tab opens, the app
   underneath stays exactly as it was, and only the sheet reaches the printer or the PDF. */
import { esc } from './ui.js';

const FONTS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap';
const wait = ms => new Promise(r => setTimeout(r, ms));

/** Print one sheet. body is the sheet's HTML; css styles it. Choosing "Save as PDF" in the
    print dialog gives the PDF. */
export function printSheet({ title, body, css = '', size = 'A4 portrait', margin = '14mm' }) {
  document.getElementById('printframe')?.remove();
  const frame = document.createElement('iframe');
  frame.id = 'printframe'; frame.title = title; frame.tabIndex = -1;
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.append(frame);
  const { lang, dir } = document.documentElement;
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html lang="${esc(lang)}" dir="${esc(dir)}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="${FONTS}"><style>@page{size:${size};margin:${margin}}
*{box-sizing:border-box}
html,body{margin:0;background:#FFFFFF;color:#3D4161;-webkit-print-color-adjust:exact;print-color-adjust:exact;
  font:400 11.5px/1.5 Inter,'IBM Plex Sans Arabic','Segoe UI',Arial,sans-serif}
[lang=ar],:lang(ar){font-family:'IBM Plex Sans Arabic',Inter,'Segoe UI',Tahoma,Arial,sans-serif}
.mono{font-family:'IBM Plex Mono',ui-monospace,monospace}
${css}</style></head><body>${body}</body></html>`);
  doc.close();
  /* print once the stylesheet and its fonts are in, or after a short wait when offline */
  const sheets = [...doc.querySelectorAll('link[rel=stylesheet]')]
    .map(l => l.sheet ? null : new Promise(r => { l.onload = l.onerror = r; }));
  Promise.race([Promise.all(sheets).then(() => doc.fonts?.ready), wait(3000)]).then(() => {
    const win = frame.contentWindow;
    if (!win) return;
    win.addEventListener('afterprint', () => setTimeout(() => frame.remove(), 1000));
    win.focus(); win.print();
  });
  return frame;
}

/** Save a Blob as a file in the browser's downloads. */
export function saveBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Draw an SVG document onto a white canvas and return it as a PNG. */
export async function svgToPng(svg, width, height) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = url; });
    const canvas = Object.assign(document.createElement('canvas'), { width, height });
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise(ok => canvas.toBlob(ok, 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

/** A file-system-safe name: letters, digits and dashes, Arabic kept. */
export const fileName = (...parts) => parts.filter(Boolean).join('-')
  .replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
