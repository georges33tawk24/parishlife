/* xlsx_preview() from server.py: read cells from the first worksheet of an uploaded
   workbook without storing it. Python reads the ZIP with zipfile and the XML with
   xml.etree.ElementTree; this is a small equivalent of the parts it uses. */
import { inflateRawSync } from 'node:zlib';
import { Problem, PyError, need, b64decode, strip, slice } from './py.js';

class BadWorkbook extends Error {}
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

let crcTable = null;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function readZip(raw) {
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const u16 = at => { if (at + 2 > raw.length) throw new BadWorkbook(); return view.getUint16(at, true); };
  const u32 = at => { if (at + 4 > raw.length) throw new BadWorkbook(); return view.getUint32(at, true); };
  let eocd = -1;
  for (let at = raw.length - 22; at >= Math.max(0, raw.length - 22 - 65535); at--) {
    if (u32(at) === 0x06054b50) { eocd = at; break; }
  }
  if (eocd < 0) throw new BadWorkbook();
  const count = u16(eocd + 10), size = u32(eocd + 12);
  let offset = u32(eocd + 16);
  /* zipfile allows data prepended to the archive; locate the directory from the end. */
  const concat = eocd - size - offset;
  if (concat < 0) throw new BadWorkbook();
  let at = offset + concat;
  const entries = [];
  const decoder = new TextDecoder('utf-8');
  const cp437 = bytes => String.fromCharCode(...bytes);
  for (let i = 0; i < count; i++) {
    if (u32(at) !== 0x02014b50) throw new BadWorkbook();
    const flags = u16(at + 8), method = u16(at + 10), crc = u32(at + 16);
    const compressed = u32(at + 20), fileSize = u32(at + 24);
    const nameLength = u16(at + 28), extraLength = u16(at + 30), commentLength = u16(at + 32);
    const local = u32(at + 42) + concat;
    const nameBytes = raw.subarray(at + 46, at + 46 + nameLength);
    if (nameBytes.length !== nameLength) throw new BadWorkbook();
    const name = flags & 0x800 ? decoder.decode(nameBytes) : cp437(nameBytes);
    entries.push({ name, flags, method, crc, compressed, fileSize, local });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return {
    names: entries.map(e => e.name),
    entries,
    read(name) {
      const entry = [...entries].reverse().find(e => e.name === name);
      if (u32(entry.local) !== 0x04034b50) throw new BadWorkbook();
      if (entry.flags & 0x1) throw new Error('File is encrypted');
      const start = entry.local + 30 + u16(entry.local + 26) + u16(entry.local + 28);
      const data = raw.subarray(start, start + entry.compressed);
      if (data.length !== entry.compressed) throw new BadWorkbook();
      let out;
      if (entry.method === 0) out = data;
      else if (entry.method === 8) {
        try { out = inflateRawSync(data, { maxOutputLength: entry.fileSize + 1 }); } catch { throw new BadWorkbook(); }
      } else throw new Error('That compression method is not supported');
      if (out.length !== entry.fileSize || crc32(out) !== entry.crc) throw new BadWorkbook();
      return out;
    }
  };
}

/* ---- a minimal namespace-aware XML reader (ElementTree subset) ------------- */
const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
function decodeEntities(text) {
  return text.replace(/&(#x[0-9A-Fa-f]+|#[0-9]+|[A-Za-z_][\w.-]*);/g, (whole, name) => {
    if (name[0] === '#') {
      const cp = name[1] === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      if (!(cp === 0x9 || cp === 0xA || cp === 0xD || (cp >= 0x20 && cp <= 0xD7FF) || (cp >= 0xE000 && cp <= 0xFFFD) || (cp >= 0x10000 && cp <= 0x10FFFF))) throw new BadWorkbook();
      return String.fromCodePoint(cp);
    }
    if (!(name in ENTITIES)) throw new BadWorkbook();
    return ENTITIES[name];
  }).replace(/\r\n?/g, '\n');
}
function parseXml(bytes) {
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new BadWorkbook(); }
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const root = { children: [] };
  const stack = [{ el: root, ns: { xml: 'http://www.w3.org/XML/1998/namespace' } }];
  let at = 0, rootSeen = false;
  const resolve = (qname, ns, isAttr) => {
    const colon = qname.indexOf(':');
    if (colon < 0) return isAttr ? qname : (ns[''] ? `{${ns['']}}${qname}` : qname);
    const prefix = qname.slice(0, colon);
    if (!(prefix in ns)) throw new BadWorkbook();
    return `{${ns[prefix]}}${qname.slice(colon + 1)}`;
  };
  const addText = value => {
    const top = stack[stack.length - 1].el;
    if (top === root) {
      if (value.trim()) throw new BadWorkbook();
      return;
    }
    const last = top.children[top.children.length - 1];
    if (last) last.tail = (last.tail ?? '') + value;
    else top.text = (top.text ?? '') + value;
  };
  while (at < text.length) {
    const lt = text.indexOf('<', at);
    if (lt < 0) { addText(decodeEntities(text.slice(at))); break; }
    if (lt > at) addText(decodeEntities(text.slice(at, lt)));
    if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt + 4);
      if (end < 0) throw new BadWorkbook();
      at = end + 3;
    } else if (text.startsWith('<![CDATA[', lt)) {
      const end = text.indexOf(']]>', lt + 9);
      if (end < 0 || stack.length === 1) throw new BadWorkbook();
      addText(text.slice(lt + 9, end));
      at = end + 3;
    } else if (text.startsWith('<?', lt)) {
      const end = text.indexOf('?>', lt + 2);
      if (end < 0) throw new BadWorkbook();
      at = end + 2;
    } else if (text.startsWith('<!DOCTYPE', lt)) {
      /* Workbooks have no document type; an internal subset (entity definitions) is refused. */
      const end = text.indexOf('>', lt);
      if (end < 0 || text.slice(lt, end).includes('[')) throw new BadWorkbook();
      at = end + 1;
    } else if (text[lt + 1] === '/') {
      const end = text.indexOf('>', lt);
      if (end < 0) throw new BadWorkbook();
      const name = text.slice(lt + 2, end).trim();
      const frame = stack.pop();
      if (stack.length === 0 || frame.qname !== name) throw new BadWorkbook();
      at = end + 1;
    } else {
      const match = /^<([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>/.exec(text.slice(lt));
      if (!match) throw new BadWorkbook();
      if (stack.length === 1) {
        if (rootSeen) throw new BadWorkbook();
        rootSeen = true;
      }
      const qname = match[1];
      const rawAttrs = [...match[2].matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/g)].map(m => [m[1], decodeEntities((m[2] ?? m[3]).replace(/[\t\n\r]/g, ' '))]);
      const ns = { ...stack[stack.length - 1].ns };
      for (const [name, value] of rawAttrs) {
        if (name === 'xmlns') ns[''] = value;
        else if (name.startsWith('xmlns:')) ns[name.slice(6)] = value;
      }
      const attrs = {};
      for (const [name, value] of rawAttrs) {
        if (name === 'xmlns' || name.startsWith('xmlns:')) continue;
        const key = resolve(name, ns, true);
        if (key in attrs) throw new BadWorkbook();
        attrs[key] = value;
      }
      const el = { tag: resolve(qname, ns, false), attrs, children: [], text: null, tail: null };
      stack[stack.length - 1].el.children.push(el);
      if (!match[3]) stack.push({ el, ns, qname });
      at = lt + match[0].length;
    }
  }
  if (stack.length !== 1 || !rootSeen) throw new BadWorkbook();
  return root.children[0];
}
const itertext = el => (el.text ?? '') + el.children.map(child => itertext(child) + (child.tail ?? '')).join('');
const childrenNamed = (el, tag) => el.children.filter(child => child.tag === tag);
function descendants(el, out = []) {
  for (const child of el.children) { out.push(child); descendants(child, out); }
  return out;
}

export function xlsx_preview(encoded) {
  need(typeof encoded === 'string' && [...encoded].length <= 3000000, 'Workbook is too large.', 413);
  try {
    if (/[^\x00-\x7f]/.test(encoded)) throw new BadWorkbook();
    const raw = b64decode(encoded);
    need(raw.length <= 2000000, 'Workbook is too large.', 413);
    const workbook = readZip(raw);
    const names = workbook.names;
    need(names.length <= 150 && workbook.entries.every(info => info.fileSize <= 4000000), 'Workbook is too large.', 413);
    const sheets = names.filter(name => /^xl\/worksheets\/sheet\p{Nd}+\.xml$/u.test(name)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    need(sheets.length, 'No worksheet found.');
    let shared = [];
    if (names.includes('xl/sharedStrings.xml')) {
      const root = parseXml(workbook.read('xl/sharedStrings.xml'));
      shared = childrenNamed(root, `{${NS}}si`).map(itertext);
    }
    const root = parseXml(workbook.read(sheets[0]));
    const rowNodes = [];
    for (const node of [root, ...descendants(root)]) {
      if (node.tag === `{${NS}}sheetData`) rowNodes.push(...childrenNamed(node, `{${NS}}row`));
    }
    const rows = [];
    for (const node of rowNodes.slice(0, 2001)) {
      const cells = new Map();
      for (const cell of childrenNamed(node, `{${NS}}c`)) {
        const match = /^([A-Z]+)/.exec(cell.attrs.r ?? '');
        if (!match) continue;
        let col = 0;
        for (const char of match[1]) col = col * 26 + char.charCodeAt(0) - 64;
        if (col > 32) continue;
        const value = childrenNamed(cell, `{${NS}}v`)[0] ?? null;
        let text;
        if (cell.attrs.t === 'inlineStr') {
          const inline = childrenNamed(cell, `{${NS}}is`)[0];
          text = inline ? itertext(inline) : '';
        } else if (value === null) text = '';
        else if (cell.attrs.t === 's') {
          const raw = value.text || '-1';
          if (!/^\s*[+-]?\d+(?:_\d+)*\s*$/.test(raw)) throw new BadWorkbook();
          const index = Number(raw.replace(/_/g, ''));
          text = index >= 0 && index < shared.length ? shared[index] : '';
        } else text = value.text || '';
        cells.set(col - 1, slice(strip(text), 0, 500));
      }
      if (cells.size) {
        const width = Math.max(...cells.keys()) + 1;
        rows.push(Array.from({ length: width }, (_, i) => cells.get(i) ?? ''));
      }
    }
    need(rows.length, 'The worksheet is empty.');
    return rows;
  } catch (error) {
    if (error instanceof BadWorkbook || error instanceof PyError) throw new Problem(400, 'Invalid .xlsx workbook.');
    throw error;
  }
}
