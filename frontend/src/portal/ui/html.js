/* Small bridges for markup that arrives as text: attributes written as a string, a style written as
   CSS, a list joined with a separator, and a node turned back into HTML for a print sheet or a file. */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

const RENAME = { class: 'className', for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly', maxlength: 'maxLength', minlength: 'minLength', colspan: 'colSpan', rowspan: 'rowSpan', autocomplete: 'autoComplete', inputmode: 'inputMode', contenteditable: 'contentEditable', spellcheck: 'spellCheck', autofocus: 'autoFocus', datetime: 'dateTime', value: 'defaultValue', checked: 'defaultChecked' };
const BOOL = new Set(['disabled', 'hidden', 'checked', 'selected', 'readonly', 'required', 'multiple', 'autofocus', 'open']);
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => e[0] === '#'
  ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1))
  : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[e.toLowerCase()]);

/** CSS text to a React style object. */
export function css(text) {
  const style = {};
  String(text || '').split(';').forEach(decl => {
    const at = decl.indexOf(':');
    if (at < 0) return;
    const k = decl.slice(0, at).trim(), v = decl.slice(at + 1).trim();
    if (k) style[k.startsWith('--') ? k : k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  });
  return style;
}

/** 'data-x="1" disabled' to props. */
export function htmlAttrs(text) {
  const props = {};
  const re = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(String(text || '')))) {
    const raw = m[1], lower = raw.toLowerCase(), value = m[2] ?? m[3] ?? m[4];
    if (/^on[a-z]+$/.test(lower)) continue;
    const name = lower.startsWith('data-') || lower.startsWith('aria-') ? lower : RENAME[lower] || raw;
    if (value == null) props[name] = BOOL.has(lower) ? true : '';
    else props[name] = name === 'style' ? css(decode(value)) : decode(value);
  }
  return props;
}

/** A list of nodes with a separator between them. */
export const joinNodes = (list, sep) => list.flatMap((node, i) => i ? [sep, node] : [node]);
/** An empty list falls back, as an empty string of markup used to. */
export const nodesOr = (list, fallback) => list && list.length ? list : fallback;

/** Draw a node into an element that React does not otherwise fill (a preview, a list a dialog
    redraws as its fields change). The element becomes a small root of its own; the drawing is done
    by the time this returns, so what follows can read it. */
const roots = new WeakMap();
export function paint(el, node) {
  if (!el) return;
  let root = roots.get(el);
  if (!root) { root = createRoot(el); roots.set(el, root); }
  flushSync(() => root.render(node ?? null));
}

/** A node as HTML, for a print sheet or a downloaded file. */
export function markup(node) {
  if (node == null || typeof node === 'string') return node || '';
  const box = document.createElement('div'), root = createRoot(box);
  flushSync(() => root.render(node));
  const html = box.innerHTML;
  root.unmount();
  return html;
}
