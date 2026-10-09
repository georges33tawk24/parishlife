/* Python semantics used by server.py, so the Worker port behaves the same way.
   Values are JSON values: null, booleans, numbers, strings, arrays and plain objects. */
import { Buffer } from 'node:buffer';
import { createHash, pbkdf2Sync, randomBytes } from 'node:crypto';
export { casefold } from './casefold.js';

export class Problem extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* Python's ValueError, TypeError, KeyError and AttributeError: the HTTP layer
   answers them with 400 "Invalid request data." just as server.py does. */
export class PyError extends Error {}

export const isDict = v => v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Set) && !(v instanceof Map) && !(v instanceof PyDict);
export const isList = Array.isArray;
export const isStr = v => typeof v === 'string';
export const isBool = v => typeof v === 'boolean';
/* isinstance(v, int): bool is a subclass of int in Python. */
export const isInt = v => typeof v === 'boolean' || (typeof v === 'number' && Number.isInteger(v));
/* isinstance(v, (int, float)) and not isinstance(v, bool) */
export const isNumber = v => typeof v === 'number';

export function truthy(v) {
  if (v === null || v === undefined || v === false) return false;
  if (v === true) return true;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string' || Array.isArray(v)) return v.length > 0;
  if (v instanceof Set || v instanceof Map || v instanceof PyDict) return v.size > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return Boolean(v);
}

export function need(ok, message, status = 400) {
  if (!truthy(ok)) throw new Problem(status, message);
}

/* Python == on JSON values. */
export function eq(a, b) {
  if (a === undefined) a = null;
  if (b === undefined) b = null;
  if (a === b) return true;
  const na = typeof a === 'number' || typeof a === 'boolean', nb = typeof b === 'number' || typeof b === 'boolean';
  if (na || nb) return na && nb && Number(a) === Number(b);
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!eq(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (!Object.prototype.hasOwnProperty.call(b, k) || !eq(a[k], b[k])) return false;
  return true;
}

const hashable = v => v === null || v === undefined || typeof v !== 'object';
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/* x in container */
export function has(container, x) {
  if (container instanceof Set) {
    if (!hashable(x)) throw new PyError('unhashable type');
    if (container.has(x ?? null)) return true;
    if (typeof x === 'boolean' || typeof x === 'number') {
      for (const item of container) if ((typeof item === 'number' || typeof item === 'boolean') && Number(item) === Number(x)) return true;
    }
    return false;
  }
  if (Array.isArray(container)) return container.some(item => eq(item, x));
  if (typeof container === 'string') {
    if (typeof x !== 'string') throw new PyError("'in <string>' requires string as left operand");
    return container.includes(x);
  }
  if (container instanceof PyDict) return container.has(x);
  if (isDict(container)) {
    if (!hashable(x)) throw new PyError('unhashable type');
    return typeof x === 'string' && own(container, x);
  }
  throw new PyError('argument is not iterable');
}

/* dict.get(key, default) */
export function get(obj, key, dflt = null) {
  if (obj instanceof PyDict) return obj.get(key, dflt);
  if (!isDict(obj)) throw new PyError("object has no attribute 'get'");
  if (typeof key !== 'string') {
    if (!hashable(key)) throw new PyError('unhashable type');
    return dflt;
  }
  return own(obj, key) ? obj[key] : dflt;
}

/* obj[key] for a dict or list */
export function K(obj, key) {
  if (obj instanceof PyDict) {
    if (!obj.has(key)) throw new PyError('KeyError');
    return obj.get(key);
  }
  if (isDict(obj)) {
    if (typeof key !== 'string' || !own(obj, key)) throw new PyError('KeyError');
    return obj[key];
  }
  if (Array.isArray(obj) || typeof obj === 'string') {
    if (!Number.isInteger(key)) throw new PyError('indices must be integers');
    const items = typeof obj === 'string' ? Array.from(obj) : obj;
    const index = key < 0 ? items.length + key : key;
    if (index < 0 || index >= items.length) throw new Error('IndexError');
    return items[index];
  }
  throw new PyError('object is not subscriptable');
}

/* dict.setdefault(key, value) */
export function setdefault(obj, key, value) {
  if (obj instanceof PyDict) {
    if (!obj.has(key)) obj.set(key, value);
    return obj.get(key);
  }
  if (!isDict(obj)) throw new PyError("object has no attribute 'setdefault'");
  const name = jsonKey(key);
  if (!own(obj, name)) setItem(obj, name, value);
  return obj[name];
}

/* d[key] = value for a JSON object, including a key named "__proto__". */
export function setItem(obj, key, value) {
  if (!isDict(obj)) throw new PyError('object does not support item assignment');
  const name = jsonKey(key);
  if (name === '__proto__') Object.defineProperty(obj, name, { value, writable: true, enumerable: true, configurable: true });
  else obj[name] = value;
  return value;
}

/* dict.pop(key, default) */
export function pop(obj, key, dflt = null) {
  if (!isDict(obj)) throw new PyError("object has no attribute 'pop'");
  if (typeof key !== 'string' || !own(obj, key)) return dflt;
  const value = obj[key];
  delete obj[key];
  return value;
}

/* A Python dict key as it appears after json.dumps. */
export function jsonKey(key) {
  if (typeof key === 'string') return key;
  if (key === null || key === undefined) return 'null';
  if (key === true) return 'true';
  if (key === false) return 'false';
  if (typeof key === 'number') return str(key);
  throw new PyError('unhashable type');
}

const hkey = k => {
  if (typeof k === 'string') return 's' + k;
  if (typeof k === 'number' || typeof k === 'boolean') return 'n' + Number(k);
  if (k === null || k === undefined) return 'z';
  throw new PyError('unhashable type');
};
/* A Python dict keyed by arbitrary JSON scalars (Python hashing rules). */
export class PyDict {
  constructor(entries = []) {
    this.map = new Map();
    for (const [k, v] of entries) this.set(k, v);
  }
  has(k) { return this.map.has(hkey(k)); }
  get(k, dflt = null) { const hit = this.map.get(hkey(k)); return hit ? hit[1] : dflt; }
  set(k, v) { const h = hkey(k), hit = this.map.get(h); if (hit) hit[1] = v; else this.map.set(h, [k ?? null, v]); }
  get size() { return this.map.size; }
  keys() { return [...this.map.values()].map(x => x[0]); }
  values() { return [...this.map.values()].map(x => x[1]); }
  entries() { return [...this.map.values()].map(x => [x[0], x[1]]); }
}
/* {key(x): x for x in items} */
export const keyed = (items, key) => new PyDict(iter(items).map(x => [key(x), x]));

/* Iterate like Python: lists, strings, dict keys, sets. */
export function iter(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return Array.from(v);
  if (v instanceof Set) return [...v];
  if (v instanceof PyDict) return v.keys();
  if (isDict(v)) return Object.keys(v);
  throw new PyError('object is not iterable');
}

export function len(v) {
  if (typeof v === 'string') {
    if (!/[\uD800-\uDFFF]/.test(v)) return v.length;
    const pairs = v.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g);
    return v.length - (pairs ? pairs.length : 0);
  }
  if (Array.isArray(v)) return v.length;
  if (v instanceof Set || v instanceof Map || v instanceof PyDict) return v.size;
  if (isDict(v)) return Object.keys(v).length;
  throw new PyError('object has no len()');
}

/* str[a:b] by code point */
export function slice(text, start, end) {
  if (typeof text !== 'string') throw new PyError('not a string');
  if (!/[\uD800-\uDFFF]/.test(text)) return text.slice(start, end);
  return Array.from(text).slice(start, end).join('');
}

const PY_SPACE = '\\t\\n\\x0b\\x0c\\r\\x1c\\x1d\\x1e\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const STRIP = new RegExp(`^[${PY_SPACE}]+|[${PY_SPACE}]+$`, 'g');
export function strip(text) {
  if (typeof text !== 'string') throw new PyError("object has no attribute 'strip'");
  return text.replace(STRIP, '');
}

function reprString(s) {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (ch === '\\') out += '\\\\';
    else if (ch === quote) out += '\\' + ch;
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (cp < 0x20 || cp === 0x7f) out += '\\x' + cp.toString(16).padStart(2, '0');
    else out += ch;
  }
  return out + quote;
}
function repr(v) {
  if (typeof v === 'string') return reprString(v);
  return str(v);
}
/* str(v) */
export function str(v) {
  if (v === null || v === undefined) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') {
    if (Number.isNaN(v)) return 'nan';
    if (!Number.isFinite(v)) return v > 0 ? 'inf' : '-inf';
    return String(v);
  }
  if (Array.isArray(v)) return '[' + v.map(repr).join(', ') + ']';
  if (isDict(v)) return '{' + Object.entries(v).map(([k, x]) => reprString(k) + ': ' + repr(x)).join(', ') + '}';
  return String(v);
}

/* Python ordering: TypeError between unrelated types. Strings compare by code point. */
export function cmp(a, b) {
  const na = typeof a === 'number' || typeof a === 'boolean', nb = typeof b === 'number' || typeof b === 'boolean';
  if (na && nb) {
    const x = Number(a), y = Number(b);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    if (a === b) return 0;
    if (!/[\uD800-\uDFFF]/.test(a) && !/[\uD800-\uDFFF]/.test(b)) return a < b ? -1 : 1;
    const x = Array.from(a), y = Array.from(b);
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const d = x[i].codePointAt(0) - y[i].codePointAt(0);
      if (d) return d < 0 ? -1 : 1;
    }
    return x.length < y.length ? -1 : x.length > y.length ? 1 : 0;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (eq(a[i], b[i])) continue;
      return cmp(a[i], b[i]);
    }
    return a.length < b.length ? -1 : a.length > b.length ? 1 : 0;
  }
  throw new PyError("'<' not supported between instances");
}
export const lt = (a, b) => cmp(a, b) < 0;
export const le = (a, b) => cmp(a, b) <= 0;
export const gt = (a, b) => cmp(a, b) > 0;
export const ge = (a, b) => cmp(a, b) >= 0;

/* sorted(items, key=..., reverse=...) — stable, like Python. */
export function sorted(items, key = x => x, reverse = false) {
  const keyed = Array.from(items, (item, index) => ({ item, index, key: key(item) }));
  keyed.sort((x, y) => (reverse ? cmp(y.key, x.key) : cmp(x.key, y.key)) || x.index - y.index);
  return keyed.map(x => x.item);
}

/* any()/all() with Python truthiness */
export const any = (items, fn = x => x) => {
  for (const item of iter(items)) if (truthy(fn(item))) return true;
  return false;
};
export const all = (items, fn = x => x) => {
  for (const item of iter(items)) if (!truthy(fn(item))) return false;
  return true;
};
export const next = (items, fn, dflt = null) => {
  for (const item of iter(items)) if (truthy(fn(item))) return item;
  return dflt;
};

/* Set helpers for collections of strings/numbers (Python sets of JSON scalars). */
export const set = items => {
  const out = new Set();
  for (const item of iter(items)) {
    if (!hashable(item)) throw new PyError('unhashable type');
    out.add(item ?? null);
  }
  return out;
};
export const union = (...sets) => { const out = new Set(); for (const s of sets) for (const x of s) out.add(x); return out; };
export const intersection = (a, b) => new Set([...a].filter(x => has(b, x)));
export const difference = (a, b) => new Set([...a].filter(x => !has(b, x)));
export const subset = (a, b) => [...a].every(x => has(b, x));
export const intersects = (a, b) => [...a].some(x => has(b, x));

/* int(v) */
export function int(v) {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error('OverflowError');
    return Math.trunc(v);
  }
  if (typeof v === 'string') {
    const text = strip(v).replace(/[٠-٩]/g, ch => String(ch.charCodeAt(0) - 0x660))
      .replace(/[۰-۹]/g, ch => String(ch.charCodeAt(0) - 0x6F0));
    if (!/^[+-]?\d+(?:_\d+)*$/.test(text)) throw new PyError('invalid literal for int()');
    return Number(text.replace(/_/g, ''));
  }
  throw new PyError('int() argument must be a string or a number');
}

/* str.isdigit() */
export const isdigit = v => typeof v === 'string' && v.length > 0 && /^[\p{Nd}²³¹⁰⁴-⁹₀-₉①-⑨⑴-⑼⒈-⒐⓪⓵-⓽⓿❶-❾➀-➈➊-➒፩-፱᧚]+$/u.test(v);

/* round(x) with ties to even */
export function round(x) {
  const f = Math.floor(x), diff = x - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

export const pad3 = n => (n < 0 ? '-' + String(-n).padStart(3, '0') : String(n).padStart(3, '0'));

/* ---- dates ---------------------------------------------------------------- */
const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const daysIn = (y, m) => (m === 2 && isLeap(y) ? 29 : DAYS[m - 1]);
/* Proleptic Gregorian ordinal, day 1 = 0001-01-01 (Python date.toordinal()). */
export function toOrdinal(y, m, d) {
  const before = y - 1;
  let days = before * 365 + Math.floor(before / 4) - Math.floor(before / 100) + Math.floor(before / 400);
  for (let i = 1; i < m; i++) days += daysIn(y, i);
  return days + d;
}
export function fromOrdinal(n) {
  let y = Math.floor((n - 1) / 365.2425) + 1;
  while (toOrdinal(y, 1, 1) > n) y--;
  while (toOrdinal(y + 1, 1, 1) <= n) y++;
  let rest = n - toOrdinal(y, 1, 1) + 1, m = 1;
  while (rest > daysIn(y, m)) { rest -= daysIn(y, m); m++; }
  return [y, m, rest];
}
const digits = (s, at, n) => {
  const part = s.slice(at, at + n);
  return part.length === n && /^[0-9]+$/.test(part) ? Number(part) : null;
};
/* datetime.date.fromisoformat (CPython 3.11 C implementation). Returns an ordinal. */
export function fromisoformat(value) {
  if (typeof value !== 'string') throw new PyError('fromisoformat: argument must be str');
  const bad = () => new PyError('Invalid isoformat string');
  const n = value.length;
  if (![7, 8, 10].includes(n) || /[^\x00-\x7f]/.test(value)) throw bad();
  let y = digits(value, 0, 4);
  if (y === null) throw bad();
  let p = 4;
  const sep = value[p] === '-';
  if (sep) p++;
  let m, d;
  if (value[p] === 'W') {
    p++;
    const week = digits(value, p, 2);
    if (week === null) throw bad();
    p += 2;
    let day = 1;
    if (p < n) {
      if (sep && value[p++] !== '-') throw bad();
      day = digits(value, p, 1);
      if (day === null) throw bad();
    }
    if (week <= 0 || week >= 53) {
      let out = true;
      if (week === 53) {
        const first = (toOrdinal(y, 1, 1) + 6) % 7;
        if (first === 3 || (first === 2 && isLeap(y))) out = false;
      }
      if (out) throw bad();
    }
    if (day <= 0 || day >= 8) throw bad();
    const jan4 = toOrdinal(y, 1, 4), firstWeekday = (jan4 + 6) % 7;
    const week1Monday = jan4 - firstWeekday;
    [y, m, d] = fromOrdinal(week1Monday + (week - 1) * 7 + day - 1);
  } else {
    m = digits(value, p, 2);
    if (m === null) throw bad();
    p += 2;
    if (sep && value[p++] !== '-') throw bad();
    d = digits(value, p, 2);
    if (d === null) throw bad();
  }
  if (y < 1 || y > 9999) throw new PyError('year is out of range');
  if (m < 1 || m > 12) throw new PyError('month must be in 1..12');
  if (d < 1 || d > daysIn(y, m)) throw new PyError('day is out of range for month');
  return toOrdinal(y, m, d);
}
export const isoformat = ordinal => {
  const [y, m, d] = fromOrdinal(ordinal);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};
/* validate()'s iso_date: a canonical YYYY-MM-DD string. */
export function isoDate(value) {
  if (typeof value !== 'string') return false;
  try { return isoformat(fromisoformat(value)) === value; } catch { return false; }
}

/* ---- clock ---------------------------------------------------------------- */
let zone = 'UTC';
export const setTimeZone = name => { zone = name || 'UTC'; };
let lastMicros = 0;
/* datetime.now(timezone.utc).isoformat(): microseconds, strictly increasing here. */
export function NOW() {
  let micros = Date.now() * 1000;
  if (micros <= lastMicros) micros = lastMicros + 1;
  lastMicros = micros;
  const date = new Date(Math.floor(micros / 1000));
  const fraction = micros % 1000000;
  const base = date.toISOString().slice(0, 19);
  return base + (fraction ? '.' + String(fraction).padStart(6, '0') : '') + '+00:00';
}
let formatter = null;
function localParts() {
  if (!formatter || formatter.zone !== zone) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    formatter.zone = zone;
  }
  return Object.fromEntries(formatter.formatToParts(new Date()).map(part => [part.type, part.value]));
}
/* date.today().isoformat() in the parish's time zone */
export function localToday() {
  const p = localParts();
  return `${p.year}-${p.month}-${p.day}`;
}
/* server.py's TODAY(); the Python tests replace it to move the calendar, so the
   test bridge can too. The places where server.py calls date.today() directly use
   localToday(). */
let todayOverride = null;
export const overrideToday = value => { todayOverride = value || null; };
export const TODAY = () => todayOverride ?? localToday();
/* datetime.now().strftime('%H:%M') */
export function nowHM() {
  const p = localParts();
  return `${p.hour}:${p.minute}`;
}
export const time = () => Date.now() / 1000;

/* ---- secrets and hashing -------------------------------------------------- */
export const tokenHex = n => randomBytes(n).toString('hex');
export const tokenUrlsafe = n => randomBytes(n).toString('base64url');
export const sha256hex = text => createHash('sha256').update(text, 'utf8').digest('hex');

/* hmac.compare_digest for str: TypeError for non-ASCII text, like Python. */
export function compareDigest(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || /[^\x00-\x7f]/.test(a) || /[^\x00-\x7f]/.test(b))
    throw new PyError('comparing strings with non-ASCII characters is not supported');
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/* Password hashes. server.py stores "salt:hex" (PBKDF2-SHA256, 600,000 iterations).
   This deployment can also store "pbkdf2_sha256$iterations$salt$hex" so the iteration
   count fits the Cloudflare plan's CPU allowance. Both are verified here. */
export function passwordHash(password, salt = tokenHex(16), iterations = 600000) {
  const digest = pbkdf2Sync(Buffer.from(password, 'utf8'), Buffer.from(salt, 'utf8'), iterations, 32, 'sha256').toString('hex');
  return iterations === 600000 ? salt + ':' + digest : `pbkdf2_sha256$${iterations}$${salt}$${digest}`;
}
export function passwordMatches(stored, password) {
  if (typeof stored === 'string' && stored.startsWith('pbkdf2_sha256$')) {
    const [, rounds, salt, digest] = stored.split('$');
    const iterations = Number(rounds);
    if (!Number.isInteger(iterations) || iterations < 1 || iterations > 10000000 || !salt || !digest) return false;
    return compareDigest(stored, passwordHash(password, salt, iterations));
  }
  return compareDigest(stored, passwordHash(password, String(stored).split(':')[0], 600000));
}

/* urllib.parse.quote(text) with its default safe='/' */
export function quote(text) {
  return encodeURIComponent(text).replace(/[!'()*]/g, ch => '%' + ch.charCodeAt(0).toString(16).toUpperCase()).replace(/%2F/g, '/');
}

/* dict.items() / dict.values() for JSON objects (AttributeError otherwise) */
export function items(obj) {
  if (obj instanceof PyDict) return obj.entries();
  if (!isDict(obj)) throw new PyError("object has no attribute 'items'");
  return Object.entries(obj);
}
export function values(obj) {
  if (obj instanceof PyDict) return obj.values();
  if (!isDict(obj)) throw new PyError("object has no attribute 'values'");
  return Object.values(obj);
}

/* a + b for str, list and numbers only */
export function add(a, b) {
  if (typeof a === 'string' && typeof b === 'string') return a + b;
  if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
  const na = typeof a === 'number' || typeof a === 'boolean', nb = typeof b === 'number' || typeof b === 'boolean';
  if (na && nb) return Number(a) + Number(b);
  throw new PyError('unsupported operand types for +');
}
/* sum(values) */
export function sum(values) {
  let total = 0;
  for (const v of values) total = add(total, v);
  return total;
}
/* float(v) */
export function float(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const text = strip(v).replace(/(\d)_(?=\d)/g, '$1').toLowerCase();
    if (/^[+-]?(inf|infinity)$/.test(text)) return text.startsWith('-') ? -Infinity : Infinity;
    if (/^[+-]?nan$/.test(text)) return NaN;
    if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(text)) return Number(text);
    throw new PyError('could not convert string to float');
  }
  throw new PyError('float() argument must be a string or a real number');
}
/* Python's `a or b` and `a and b` return operands. */
export const or = (...xs) => { for (const x of xs.slice(0, -1)) if (truthy(x)) return x; return xs[xs.length - 1]; };
/* type(v).__name__ for JSON values */
export function typeName(v) {
  if (v === null || v === undefined) return 'NoneType';
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
  if (typeof v === 'string') return 'str';
  if (Array.isArray(v)) return 'list';
  return 'dict';
}

export const deepcopy = v => structuredClone(v);
export const dumps = v => JSON.stringify(v);

/* base64.b64decode(text, validate=True) as CPython 3.11 behaves; returns bytes. */
export function b64decode(text) {
  return Buffer.from(text.slice(0, b64length(text)), 'base64');
}
/* Checks `text` as b64decode() does and returns the number of base64 data characters,
   without decoding (large uploads are validated this way). */
export function b64length(text) {
  if (typeof text !== 'string') throw new PyError('argument should be a bytes-like object or ASCII string');
  if (/[^A-Za-z0-9+/=]/.test(text)) throw new PyError('Only base64 data is allowed');
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === 61) end--;
  const padding = text.length - end;
  const first = text.indexOf('=');
  if (first >= 0 && first < end) throw new PyError('Excess data after padding');
  if (!end && padding) throw new PyError('Leading padding not allowed');
  const rest = end % 4;
  if (rest === 1) throw new PyError('Invalid base64-encoded string');
  if ((rest === 2 && padding !== 2) || (rest === 3 && padding !== 1)) throw new PyError(padding ? 'Excess data after padding' : 'Incorrect padding');
  return end;
}
