/* Differential API test: runs the same scenario against server.py and the Worker,
   each starting from a fresh database with the same accounts, and compares every
   response after normalising generated IDs and timestamps.

   node cloudflare/test/differential.mjs http://127.0.0.1:4399 http://127.0.0.1:8787 */
import { deflateRawSync } from 'node:zlib';

const [pyBase, cfBase] = process.argv.slice(2);
const PASSWORD = 'test-password-123';
let failures = 0, checks = 0;

class Client {
  constructor(base) { this.base = base; this.cookie = ''; this.csrf = ''; }
  async req(method, path, body, { headers = {}, raw = false } = {}) {
    const h = { 'Content-Type': 'application/json', 'X-CSRF-Token': this.csrf, Origin: this.base, ...headers };
    for (const [k, v] of Object.entries(h)) if (v === null) delete h[k];
    if (this.cookie) h.Cookie = this.cookie;
    const response = await fetch(this.base + path, { method, headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const value = setCookie.split(';')[0];
      this.cookie = value.endsWith('=') ? '' : value;
    }
    const type = response.headers.get('content-type') || '';
    const bytes = Buffer.from(await response.arrayBuffer());
    let json = null;
    if (type.includes('application/json')) json = JSON.parse(bytes.toString('utf8'));
    return { status: response.status, type, json, bytes: raw ? bytes : null, headers: response.headers };
  }
}

class Side {
  constructor(name, base) { this.name = name; this.base = base; this.clients = {}; this.fileIds = []; }
  client(user) { return (this.clients[user] ??= new Client(this.base)); }
  async login(user) {
    const c = this.client(user);
    const r = await c.req('POST', '/api/login', { username: user, password: PASSWORD });
    if (r.status === 200) c.csrf = (await c.req('GET', '/api/session')).json.csrf;
    return r;
  }
}
const py = new Side('py', pyBase), cf = new Side('cf', cfBase);

/* Replace generated values so both sides compare: timestamps, random hex IDs, file IDs. */
function normalise(value, side, numbered = true) {
  let text = JSON.stringify(value) ?? 'undefined';
  text = text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?\+00:00/g, '<ts>');
  for (const [i, id] of side.fileIds.entries()) text = text.split(id).join(`<file${i}>`);
  const seen = new Map();
  text = text.replace(/CMP-[0-9A-F]{16}|\bp[0-9a-f]{16}\b|(?<![0-9a-f])[0-9a-f]{24}(?![0-9a-f])/g, m => {
    if (!numbered) return '<id>';
    if (!seen.has(m)) seen.set(m, `<id${seen.size}>`);
    return seen.get(m);
  });
  return JSON.parse(text === 'undefined' ? 'null' : text);
}
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(key => [key, x[key]])) : x));
/* Lists whose order server.py takes from Python set iteration (hash order). */
function unorder(view) {
  if (view && typeof view === 'object' && view.content) {
    for (const key of ['content', 'formation', 'notifications']) if (Array.isArray(view[key])) view[key] = [...view[key]].sort((a, b) => canon(a).localeCompare(canon(b)));
  }
  return view;
}

function diff(a, b, path = '') {
  if (canon(a) === canon(b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) return `${path}: length ${a.length} vs ${b.length}`;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const d = diff(a[k], b[k], `${path}.${k}`);
      if (d) return d;
    }
  }
  return `${path}: ${JSON.stringify(a)?.slice(0, 300)} vs ${JSON.stringify(b)?.slice(0, 300)}`;
}

async function both(label, fn, { order = false } = {}) {
  const a = await fn(py), b = await fn(cf);
  /* Views whose lists server.py orders by set iteration compare IDs unnumbered. */
  const na = normalise(a, py, !order), nb = normalise(b, cf, !order);
  if (order) { unorder(na?.json ?? na); unorder(nb?.json ?? nb); }
  checks++;
  const d = diff(na, nb);
  if (d) { failures++; console.log(`✗ ${label}\n    ${d}`); }
  else console.log(`✓ ${label}`);
  return [a, b];
}
const view = r => ({ status: r.status, json: r.json });

/* ---- helpers for state edits ------------------------------------------------ */
async function getState(side, user) {
  return (await side.client(user).req('GET', '/api/parishes/p-elias/state')).json;
}
async function put(side, user, changesFn) {
  const state = await getState(side, user);
  const changes = changesFn(structuredClone(state.d));
  return side.client(user).req('PUT', '/api/parishes/p-elias/state', { revision: state.revision, changes });
}
async function flow(side, user, action, id, extra = {}) {
  const state = await getState(side, user === 'rita' || user === 'fr-antoine' ? user : 'fr-antoine');
  return side.client(user).req('POST', '/api/parishes/p-elias/workflow', { action, id, revision: state.revision, ...extra });
}
const member = (side, user, body) => side.client(user).req('POST', '/api/parishes/p-elias/member', body);

/* A tiny xlsx: shared strings plus an inline string, numbers and a blank cell. */
function zip(files) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = b => { let c = 0xFFFFFFFF; for (const x of b) c = crcTable[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const parts = [], central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content), packed = deflateRawSync(data), nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(data), 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6); dir.writeUInt16LE(8, 10);
    dir.writeUInt32LE(crc32(data), 16); dir.writeUInt32LE(packed.length, 20); dir.writeUInt32LE(data.length, 24); dir.writeUInt16LE(nameBytes.length, 28); dir.writeUInt32LE(offset, 42);
    parts.push(local, nameBytes, packed);
    central.push(dir, nameBytes);
    offset += local.length + nameBytes.length + packed.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}
const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const workbook = zip({
  '[Content_Types].xml': '<Types/>',
  'xl/sharedStrings.xml': `<?xml version="1.0" encoding="UTF-8"?><sst ${NS}><si><t>Name</t></si><si><r><t>Maya </t></r><r><t>Haddad</t></r></si><si><t xml:space="preserve">  Carla &amp; Co  </t></si></sst>`,
  'xl/worksheets/sheet2.xml': `<worksheet ${NS}><sheetData><row><c r="A1"><v>ignored</v></c></row></sheetData></worksheet>`,
  'xl/worksheets/sheet1.xml': `<worksheet ${NS}><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>Status</t></is></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>3</v></c></row><row r="3"><c r="B3" t="s"><v>2</v></c><c r="AH3"><v>far</v></c></row><row r="4"/></sheetData></worksheet>`
}).toString('base64');

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 7)]);

/* ---- scenario ---------------------------------------------------------------- */
async function main() {
  await both('public parish list', async s => view(await s.client('anon').req('GET', '/api/public/parishes')));
  await both('public parish detail', async s => view(await s.client('anon').req('GET', '/api/public/parishes/p-elias')));
  await both('public unknown parish', async s => view(await s.client('anon').req('GET', '/api/public/parishes/nope')));
  await both('session without login', async s => view(await s.client('anon').req('GET', '/api/session')));
  await both('wrong password', async s => view(await s.client('x').req('POST', '/api/login', { username: 'rita', password: 'nope-nope-nope' })));
  await both('unknown user', async s => view(await s.client('x').req('POST', '/api/login', { username: 'nobody', password: PASSWORD })));
  await both('login as JSON list', async s => view(await s.client('x').req('POST', '/api/login', '[]')));
  await both('login invalid JSON', async s => view(await s.client('x').req('POST', '/api/login', '{bad')));
  await both('login wrong content type', async s => view(await s.client('x').req('POST', '/api/login', '{}', { headers: { 'Content-Type': 'text/plain' } })));
  await both('login cross-origin', async s => view(await s.client('x').req('POST', '/api/login', { username: 'rita', password: PASSWORD }, { headers: { Origin: 'http://evil.example' } })));
  await both('login empty body', async s => view(await s.client('x').req('POST', '/api/login', '')));
  for (const user of ['fr-antoine', 'rita', 'nabil', 'maya', 'carla', 'tony', 'bishop'])
    await both(`login ${user}`, async s => view(await s.login(user)));
  for (const user of ['fr-antoine', 'rita', 'nabil', 'maya', 'carla', 'bishop'])
    await both(`session ${user}`, async s => { const r = await s.client(user).req('GET', '/api/session'); delete r.json.csrf; return view(r); });
  await both('POST without CSRF token', async s => { const c = s.client('rita'); const saved = c.csrf; c.csrf = 'wrong'; const r = await c.req('POST', '/api/parishes/p-elias/workflow', { action: 'x' }); c.csrf = saved; return view(r); });
  for (const user of ['fr-antoine', 'rita', 'nabil', 'maya'])
    await both(`state as ${user}`, async s => view(await s.client(user).req('GET', '/api/parishes/p-elias/state')));
  await both('state as member', async s => view(await s.client('carla').req('GET', '/api/parishes/p-elias/state')));
  await both('state as bishop', async s => view(await s.client('bishop').req('GET', '/api/parishes/p-elias/state')));
  await both('state for unassigned parish', async s => view(await s.client('rita').req('GET', '/api/parishes/p-charbel/state')));
  await both('unknown endpoint', async s => view(await s.client('rita').req('GET', '/api/parishes/p-elias/nothing')));
  await both('unknown api path', async s => view(await s.client('rita').req('GET', '/api/whatever')));
  await both('oversight list', async s => view(await s.client('bishop').req('GET', '/api/oversight')));
  await both('oversight detail', async s => view(await s.client('bishop').req('GET', '/api/parishes/p-elias/oversight')));
  await both('oversight by priest', async s => view(await s.client('fr-antoine').req('GET', '/api/oversight')));
  await both('assignments', async s => view(await s.client('bishop').req('GET', '/api/assignments')));
  await both('bishop write refused', async s => view(await s.client('bishop').req('POST', '/api/parishes/p-elias/workflow', { action: 'x' })));

  /* Parish records */
  await both('priest adds a pastoral task', async s => view(await put(s, 'fr-antoine', d => ({ NOTES: [...d.NOTES, { id: 'nt-test', kind: 'task', p: null, at: '2026-10-09', body: 'Call the family', bodyAr: '', priority: 'urgent', pinned: true, done: false, due: '2026-10-12' }] }))));
  await both('secretary cannot write notes', async s => view(await put(s, 'rita', d => ({ NOTES: d.NOTES }))));
  await both('stale revision', async s => view(await s.client('rita').req('PUT', '/api/parishes/p-elias/state', { revision: 1, changes: { NOTICES: [] } })));
  await both('wrong collection type', async s => view(await put(s, 'rita', () => ({ NOTICES: {} }))));
  await both('secretary adds a template', async s => view(await put(s, 'rita', d => ({ EVENT_TEMPLATES: [...d.EVENT_TEMPLATES, { id: 'tpl-x', name: 'Council', nameAr: 'مجلس', icon: 'groups', kind: 'group', venue: 'v1', duration: 60, description: '', capacity: 0 }] }))));
  await both('invalid template refused', async s => view(await put(s, 'rita', d => ({ EVENT_TEMPLATES: [...d.EVENT_TEMPLATES, { id: 'tpl-y', name: ' ', kind: 'group' }] }))));
  await both('new person, household and family', async s => view(await put(s, 'rita', d => {
    d.PEOPLE.push({ id: 'p-new1', lat: 'Rami Khoury', ar: 'رامي خوري', born: '1990-02-03', phone: '03 000 000', town: 'Hadath', townAr: 'الحدث', rite: 'Latin', status: 'member', hh: 'h-new', tags: [], rel: 'head' });
    d.PEOPLE.push({ id: 'p-new2', lat: 'Lina Khoury', ar: 'لينا خوري', born: '1992-05-06', phone: '', town: 'Hadath', townAr: 'الحدث', rite: 'Maronite', status: 'member', hh: 'h-new', tags: [], rel: 'spouse', relativeTo: 'p-new1' });
    d.HOUSEHOLDS.push({ id: 'h-new', name: 'Khoury', ar: 'خوري', head: 'p-new1', members: ['p-new1', 'p-new2'], town: 'Hadath', townAr: 'الحدث', address: 'Main street' });
    return { PEOPLE: d.PEOPLE, HOUSEHOLDS: d.HOUSEHOLDS };
  })));
  await both('state after household', async s => view(await s.client('rita').req('GET', '/api/parishes/p-elias/state')));
  await both('delete linked person refused', async s => view(await put(s, 'rita', d => ({ PEOPLE: d.PEOPLE.filter(p => p.id !== 'p7') }))));
  await both('address cascade check', async s => view(await put(s, 'rita', d => { d.PERSON_EXTRA.p1 = { ...d.PERSON_EXTRA.p1, address: { governorate: 'nope', district: 'x' } }; return { PERSON_EXTRA: d.PERSON_EXTRA }; })));
  await both('secretary service request', async s => view(await put(s, 'rita', d => ({ SERVICE_REQUESTS: [...d.SERVICE_REQUESTS, { id: 'sr-test', kind: 'Mass', kindAr: 'قداس', by: 'p1', date: '2026-11-01', time: '10:00', contact: '0123', purpose: 'Memorial', venue: 'v1', language: 'Arabic', notes: '', documents: {}, prep: 'documents missing', status: 'pending', stage: 'request', history: [] }] }))));
  await both('secretary cannot approve service', async s => view(await put(s, 'rita', d => { const r = d.SERVICE_REQUESTS.find(x => x.id === 'sr-test'); r.status = 'approved'; r.history = [{ status: 'approved', by: 'p4', at: '2026-10-09' }]; return { SERVICE_REQUESTS: d.SERVICE_REQUESTS }; })));
  await both('priest approves service (with history)', async s => view(await put(s, 'fr-antoine', d => { const r = d.SERVICE_REQUESTS.find(x => x.id === 'sr-test'); r.status = 'approved'; r.history = [{ status: 'approved', by: 'p17', at: '2026-10-09' }]; return { SERVICE_REQUESTS: d.SERVICE_REQUESTS }; })));
  for (const [label, next] of [['start preparation', 'preparing'], ['mark ready', 'ready']])
    await both(`priest service request: ${label}`, async s => view(await put(s, 'fr-antoine', d => { const r = d.SERVICE_REQUESTS.find(x => x.id === 'sr-test'); r.status = next; r.history = [...r.history, { status: next, by: 'p17', at: '2026-10-09' }]; return { SERVICE_REQUESTS: d.SERVICE_REQUESTS }; })));
  await both('celebration date in the future refused', async s => view(await put(s, 'fr-antoine', d => { const r = d.SERVICE_REQUESTS.find(x => x.id === 'sr-test'); r.status = 'celebrated'; r.celebratedAt = '2030-01-01'; r.history = [...r.history, { status: 'celebrated', by: 'p17', at: '2026-10-09' }]; return { SERVICE_REQUESTS: d.SERVICE_REQUESTS }; })));
  await both('priest records celebration', async s => view(await put(s, 'fr-antoine', d => { const r = d.SERVICE_REQUESTS.find(x => x.id === 'sr-test'); r.status = 'celebrated'; r.celebratedAt = '2026-10-09'; r.history = [...r.history, { status: 'celebrated', by: 'p17', at: '2026-10-09' }]; return { SERVICE_REQUESTS: d.SERVICE_REQUESTS }; })));
  await both('music link check', async s => view(await put(s, 'rita', d => { d.MUSIC[0].youtubeUrl = 'http://youtube.com/x'; return { MUSIC: d.MUSIC }; })));
  await both('music link valid', async s => view(await put(s, 'fr-antoine', d => { d.MUSIC[0].youtubeUrl = 'https://www.youtube.com/watch?v=1'; d.MUSIC[0].anghamiUrl = 'https://play.anghami.com/song/1'; return { MUSIC: d.MUSIC }; })));
  await both('leader attendance and meeting change', async s => view(await put(s, 'maya', d => {
    const g = d.GROUP_DETAIL.g1;
    g.meetings[0].attendance = { p6: 'present', p9: 'absent' };
    g.meetings.push({ id: 'mt-new', d: '2026-10-10', t: '18:00', title: 'Extra rehearsal', done: false, attendance: {} });
    g.meetings[1].t = '19:30';
    return { GROUP_DETAIL: { g1: g } };
  })));
  await both('leader other group refused', async s => view(await put(s, 'maya', d => ({ GROUP_DETAIL: { g3: {} } }))));
  await both('attendance for non-member refused', async s => view(await put(s, 'maya', d => { d.GROUP_DETAIL.g1.meetings[0].attendance.p1 = 'present'; return { GROUP_DETAIL: { g1: d.GROUP_DETAIL.g1 } }; })));
  await both('resource loan', async s => view(await put(s, 'maya', d => {
    const g = d.GROUP_DETAIL.g1;
    g.belongings = [...g.belongings, { id: 'res-x', name: 'Robes', ar: '', qty: 2, condition: 'good' }];
    g.resourceLoans = [{ id: 'loan-1', resourceId: 'res-x', borrower: 'Carla', qty: 2, due: '2026-10-20', checkedOutAt: '2026-10-09' }];
    return { GROUP_DETAIL: { g1: g } };
  })));
  await both('loan beyond quantity', async s => view(await put(s, 'maya', d => { d.GROUP_DETAIL.g1.resourceLoans.push({ id: 'loan-2', resourceId: 'res-x', borrower: 'Tony', qty: 1, due: '2026-10-20', checkedOutAt: '2026-10-09' }); return { GROUP_DETAIL: { g1: d.GROUP_DETAIL.g1 } }; })));
  await both('leadership handover needs history', async s => view(await put(s, 'rita', d => { d.GROUPS.find(g => g.id === 'g1').leader = 'p6'; return { GROUPS: d.GROUPS }; })));
  await both('registration for mass refused', async s => view(await put(s, 'rita', d => ({ REGISTRATIONS: [...d.REGISTRATIONS, { id: 'rg-x', event: 'X', open: true, cap: 5, taken: 0, eventId: 'ev1' }] }))));
  await both('registration and registrant', async s => view(await put(s, 'rita', d => {
    d.REGISTRATIONS.push({ id: 'rg-x', event: 'Retreat', open: true, cap: 5, taken: 1, eventId: 'ev10', fields: [], discounts: [], installments: [] });
    d.REGISTRANTS.push({ id: 'reg-1', p: 'p6', paid: 0, status: 'pending', consent: false, registrationId: 'rg-x' });
    return { REGISTRATIONS: d.REGISTRATIONS, REGISTRANTS: d.REGISTRANTS };
  })));
  await both('payment without audit refused', async s => view(await put(s, 'rita', d => { d.REGISTRANTS.find(r => r.id === 'reg-1').paid = 10; return { REGISTRANTS: d.REGISTRANTS }; })));
  await both('check-in session', async s => view(await put(s, 'rita', d => { d.CHECKIN.sessions.ev10 = { eventId: 'ev10', rows: [{ p: 'p6', in: '09:00' }] }; return { CHECKIN: d.CHECKIN }; })));
  await both('treasurer state', async s => view(await s.client('nabil').req('GET', '/api/parishes/p-elias/state')));
  await both('treasurer finance write', async s => view(await put(s, 'nabil', d => ({ FUNDS: d.FUNDS }))));
  await both('treasurer cannot write people', async s => view(await put(s, 'nabil', d => ({ PEOPLE: [] }))));

  /* Sacrament workflow */
  await both('create sacrament request', async s => view(await flow(s, 'rita', 'create-sacrament-request', 'sc-a', { kind: 'baptism', person: 'p20', date: '2026-10-12', notes: 'Family' })));
  await both('create child baptism', async s => view(await flow(s, 'rita', 'create-sacrament-request', 'sc-b', { kind: 'baptism', child: { lat: 'Baby Khoury', ar: 'طفل', born: '2026-09-01', father: 'Rami', mother: 'Lina' } })));
  await both('duplicate child refused', async s => view(await flow(s, 'rita', 'create-sacrament-request', 'sc-c', { kind: 'baptism', child: { lat: 'baby khoury ', ar: 'طفل', born: '2026-09-01' } })));
  await both('bad birth date', async s => view(await flow(s, 'rita', 'create-sacrament-request', 'sc-d', { kind: 'baptism', child: { lat: 'X', ar: 'Y', born: '2026-13-01' } })));
  await both('secretary review', async s => view(await flow(s, 'rita', 'review-sacrament-request', 'sc-a')));
  await both('secretary cannot approve request', async s => view(await flow(s, 'rita', 'approve-sacrament-request', 'sc-a')));
  await both('priest approves request', async s => view(await flow(s, 'fr-antoine', 'approve-sacrament-request', 'sc-a')));
  await both('propose amendment', async s => view(await flow(s, 'rita', 'propose-request-amendment', 'sc-a', { date: '2026-10-13', notes: 'Changed', reason: 'Family asked' })));
  await both('approve amendment', async s => view(await flow(s, 'fr-antoine', 'approve-request-amendment', 'sc-a')));
  await both('update preparation', async s => view(await flow(s, 'rita', 'update-preparation', 'sc-a', { date: '2026-10-09', checklist: [true, false, true] })));
  await both('complete preparation', async s => view(await flow(s, 'rita', 'complete-preparation', 'sc-a')));
  await both('submit celebrated', async s => view(await flow(s, 'rita', 'submit', 'sc-a')));
  await both('approve without verification', async s => view(await flow(s, 'fr-antoine', 'approve', 'sc-a')));
  await both('approve entry', async s => view(await flow(s, 'fr-antoine', 'approve', 'sc-a', { verified: true })));
  await both('certificate request (official entry)', async s => view(await flow(s, 'rita', 'create-certificate-request', 'sc-cert', { requestId: 'sc-cert', person: 'p20', purpose: 'School', sourceRecordId: 'sc-a' })));
  await both('approve certificate', async s => view(await flow(s, 'fr-antoine', 'approve', 'sc-cert', { verified: true })));
  await both('issue certificate', async s => view(await flow(s, 'fr-antoine', 'issue', 'sc-cert', { verified: true })));
  await both('certificate for planned sacrament', async s => view(await flow(s, 'rita', 'create-certificate-request', 'sc-cert2', { requestId: 'sc-cert2', person: 'p20', purpose: 'Visa', requestedSacramentId: 'sc1' })));
  await both('certificate falls back to account person', async s => view(await flow(s, 'rita', 'create-certificate-request', 'sc-cert3', { requestId: 'sc-cert3', person: 'p9', purpose: 'Work', sourceRecordId: 'sc5' })));
  await both('cancel certificate', async s => view(await flow(s, 'rita', 'cancel', 'sc-cert2', { reason: 'Not needed' })));
  await both('correction request', async s => view(await flow(s, 'rita', 'correction-request', 'sc2', { field: 'place', value: 'Hadath', reason: 'Typo' })));
  await both('decline request', async s => view(await flow(s, 'fr-antoine', 'decline-sacrament-request', 'sc-b', { reason: 'Duplicate' })));
  await both('update entry', async s => view(await flow(s, 'rita', 'update-entry', 'sc1', { fields: { godparents: 'Tony', date: '2026-10-11' } })));
  await both('unknown workflow', async s => view(await flow(s, 'rita', 'nope', 'sc1')));
  await both('state after workflows (priest)', async s => view(await s.client('fr-antoine').req('GET', '/api/parishes/p-elias/state')));
  await both('correction approve', async s => {
    const state = await getState(s, 'fr-antoine');
    const cor = state.d.CORRECTIONS.find(x => x.sacrament === 'sc2' && x.status === 'awaiting-approval');
    return view(await s.client('fr-antoine').req('POST', '/api/parishes/p-elias/workflow', { action: 'correction-approve', id: cor.id, revision: state.revision }));
  });

  /* Member portal sacrament and certificate requests */
  const portal = async (s, user) => {
    const r = await s.client(user).req('GET', '/api/parishes/p-elias/member');
    return { status: r.status, requests: r.json?.requests, options: r.json?.requestOptions,
      notifications: r.json?.notifications?.filter(n => n.kind.startsWith('request-')) };
  };
  const ask = async (s, user, key, body) => {
    const r = await member(s, user, { op: 'sacramentRequest', ...body });
    if (r.json?.id) (s.requests ??= {})[key] = r.json.id;
    return view(r);
  };
  await both('request options', async s => portal(s, 'tony'));
  await both('request a child baptism', async s => ask(s, 'tony', 'child', { kind: 'baptism', child: { lat: 'Elie Gemayel', ar: 'إيلي الجميّل', born: '2026-08-15', father: 'Tony Gemayel', mother: 'Rita' }, date: '2099-05-03', notes: 'Godmother: Carla', phone: '03 112 233' }));
  await both('request first communion', async s => ask(s, 'tony', 'communion', { kind: 'communion', personId: 'p5', date: '2099-06-01' }));
  await both('request marriage', async s => ask(s, 'carla', 'marriage', { kind: 'marriage', personId: 'p6', partner: 'Marc Aoun', partnerParish: 'Saint Maron', date: '2099-09-12' }));
  await both('request certificate', async s => ask(s, 'carla', 'certificate', { kind: 'certificate', personId: 'p6', certificateOf: 'baptism', purpose: 'Marriage file', language: 'arabic' }));
  await both('duplicate request refused', async s => ask(s, 'tony', 'x', { kind: 'baptism', child: { lat: 'elie gemayel ', ar: 'إيلي', born: '2026-08-15' } }));
  await both('request outside household refused', async s => ask(s, 'tony', 'x', { kind: 'communion', personId: 'p1' }));
  await both('funeral for oneself refused', async s => ask(s, 'tony', 'x', { kind: 'funeral', personId: 'p5' }));
  await both('past preferred date refused', async s => ask(s, 'carla', 'x', { kind: 'confirmation', personId: 'p6', date: '2001-01-01' }));
  await both('unknown request kind refused', async s => ask(s, 'carla', 'x', { kind: 'blessing', personId: 'p6' }));
  await both('certificate without purpose refused', async s => ask(s, 'carla', 'x', { kind: 'certificate', personId: 'p6', certificateOf: 'baptism' }));
  await both('member cannot use the office workflow', async s => view(await flow(s, 'tony', 'decline-member-request', null, { requestId: s.requests.child, reason: 'No' })));
  await both('office sees online requests', async s => ({ secretary: (await getState(s, 'rita')).d.MEMBER_REQUESTS, leader: (await getState(s, 'maya')).d.MEMBER_REQUESTS }));
  await both('office cannot write online requests', async s => view(await put(s, 'rita', () => ({ MEMBER_REQUESTS: [] }))));
  await both('secretary accepts child baptism into household', async s => view(await flow(s, 'rita', 'accept-member-request', 'sc-web1', { requestId: s.requests.child, household: true, note: 'Welcome' })));
  await both('already handled', async s => view(await flow(s, 'rita', 'accept-member-request', 'sc-web9', { requestId: s.requests.child })));
  await both('priest accepts the baptism', async s => view(await flow(s, 'fr-antoine', 'approve-sacrament-request', 'sc-web1')));
  await both('preparation date set', async s => view(await flow(s, 'rita', 'update-preparation', 'sc-web1', { date: '2099-05-10', checklist: [true, false, true] })));
  await both('preparation complete', async s => view(await flow(s, 'rita', 'complete-preparation', 'sc-web1')));
  await both('priest accepts communion directly', async s => view(await flow(s, 'fr-antoine', 'accept-member-request', 'sc-web2', { requestId: s.requests.communion })));
  await both('decline without message refused', async s => view(await flow(s, 'rita', 'decline-member-request', null, { requestId: s.requests.marriage, reason: ' ' })));
  await both('office declines marriage', async s => view(await flow(s, 'rita', 'decline-member-request', null, { requestId: s.requests.marriage, reason: 'Please visit the office first.' })));
  await both('certificate with wrong entry refused', async s => view(await flow(s, 'rita', 'accept-member-request', 'sc-web3', { requestId: s.requests.certificate, sourceRecordId: 'sc5' })));
  await both('member withdraws certificate request', async s => view(await member(s, 'carla', { op: 'requestWithdraw', id: s.requests.certificate })));
  await both('withdraw twice refused', async s => view(await member(s, 'carla', { op: 'requestWithdraw', id: s.requests.certificate })));
  await both('state after online requests', async s => {
    const d = (await getState(s, 'fr-antoine')).d;
    return { requests: d.MEMBER_REQUESTS, sacraments: d.SACRAMENTS.filter(x => x.memberRequestId), households: d.HOUSEHOLDS, people: d.PEOPLE.slice(-2) };
  });
  await both('tony follows his requests', async s => portal(s, 'tony'));
  await both('carla follows her requests', async s => portal(s, 'carla'));

  /* Files */
  await both('upload PDF to person', async s => { const r = await s.client('rita').req('POST', '/api/parishes/p-elias/files', { scope: 'person', id: 'p1', name: 'c:\\docs\\Letter.PDF', data: PDF.toString('base64') }); if (r.json?.id) s.fileIds.push(r.json.id); return view(r); });
  await both('upload PNG to group', async s => { const r = await s.client('maya').req('POST', '/api/parishes/p-elias/files', { scope: 'group', id: 'g1', name: 'photo.png', data: PNG.toString('base64') }); if (r.json?.id) s.fileIds.push(r.json.id); return view(r); });
  await both('upload mismatched content', async s => view(await s.client('rita').req('POST', '/api/parishes/p-elias/files', { scope: 'person', id: 'p1', name: 'x.pdf', data: PNG.toString('base64') })));
  await both('upload bad base64', async s => view(await s.client('rita').req('POST', '/api/parishes/p-elias/files', { scope: 'person', id: 'p1', name: 'x.pdf', data: 'QQ=' })));
  await both('upload unsupported type', async s => view(await s.client('rita').req('POST', '/api/parishes/p-elias/files', { scope: 'person', id: 'p1', name: 'x.gif', data: PDF.toString('base64') })));
  await both('leader cannot upload to person', async s => view(await s.client('maya').req('POST', '/api/parishes/p-elias/files', { scope: 'person', id: 'p1', name: 'x.pdf', data: PDF.toString('base64') })));
  await both('list person files', async s => view(await s.client('rita').req('GET', '/api/parishes/p-elias/files?scope=person&id=p1')));
  await both('list group files as member', async s => view(await s.client('carla').req('GET', '/api/parishes/p-elias/files?scope=group&id=g1')));
  await both('member cannot list other group', async s => view(await s.client('carla').req('GET', '/api/parishes/p-elias/files?scope=group&id=g3')));
  await both('download PDF', async s => { const r = await s.client('rita').req('GET', `/api/parishes/p-elias/files/${s.fileIds[0]}`, undefined, { raw: true });
    return { status: r.status, type: r.type, disposition: r.headers.get('content-disposition'), length: r.headers.get('content-length'), same: r.bytes.equals(PDF) }; });
  await both('download PNG as member', async s => { const r = await s.client('carla').req('GET', `/api/parishes/p-elias/files/${s.fileIds[1]}`, undefined, { raw: true }); return { status: r.status, same: r.bytes.equals(PNG) }; });
  await both('download missing file', async s => view(await s.client('rita').req('GET', '/api/parishes/p-elias/files/nope')));
  await both('delete file', async s => view(await s.client('rita').req('DELETE', `/api/parishes/p-elias/files/${s.fileIds[0]}`)));
  await both('patch on file route', async s => view(await s.client('rita').req('PUT', `/api/parishes/p-elias/files/${s.fileIds[1]}`, {})));
  await both('xlsx preview', async s => view(await s.client('maya').req('POST', '/api/parishes/p-elias/attendance-preview', { groupId: 'g1', data: workbook })));
  await both('xlsx invalid', async s => view(await s.client('maya').req('POST', '/api/parishes/p-elias/attendance-preview', { groupId: 'g1', data: Buffer.from('not a zip').toString('base64') })));
  await both('xlsx other group', async s => view(await s.client('maya').req('POST', '/api/parishes/p-elias/attendance-preview', { groupId: 'g3', data: workbook })));

  /* Member portal */
  await both('member view carla', async s => view(await s.client('carla').req('GET', '/api/parishes/p-elias/member')), { order: true });
  await both('member note', async s => view(await member(s, 'carla', { op: 'note', title: 'Practice', body: 'Bring music', category: 'Choir', tags: ['x'], meetingId: 'mt1', pinned: true })));
  await both('member note bad meeting', async s => view(await member(s, 'carla', { op: 'note', title: 'X', meetingId: 'mt-zzz' })));
  await both('member todo', async s => view(await member(s, 'carla', { op: 'todo', title: 'Call Tony', due: '2026-10-20' })));
  await both('member todo bad date', async s => view(await member(s, 'carla', { op: 'todo', title: 'Bad', due: '2026-02-30' })));
  await both('member rsvp', async s => view(await member(s, 'carla', { op: 'rsvp', meetingId: 'mt-new', status: 'yes', reason: '' })));
  await both('member rsvp past meeting', async s => view(await member(s, 'carla', { op: 'rsvp', meetingId: 'mt3', status: 'no' })));
  await both('member preference', async s => view(await member(s, 'carla', { op: 'preference', key: 'email', value: false })));
  await both('priest publishes announcement', async s => view(await member(s, 'fr-antoine', { op: 'publish', kind: 'announcement', title: 'Parish feast', body: 'Join us', category: 'Feast', pinned: true })));
  await both('leader publishes discussion', async s => view(await member(s, 'maya', { op: 'publish', kind: 'discussion', groupId: 'g1', title: 'Robes', body: 'Sizes?' })));
  await both('leader publishes opportunity', async s => view(await member(s, 'maya', { op: 'publish', kind: 'opportunity', groupId: 'g1', title: 'Help set up', body: '', attachment: { name: 'a.txt', mime: 'text/plain', data: 'data:text/plain;base64,SGVsbG8=' } })));
  await both('bad attachment', async s => view(await member(s, 'maya', { op: 'publish', kind: 'post', groupId: 'g1', title: 'X', attachment: { name: 'a.txt', mime: 'text/plain', data: 'data:text/plain;base64,SGVsbG' } })));
  await both('member publish refused', async s => view(await member(s, 'carla', { op: 'publish', kind: 'post', title: 'X' })));
  let content = null;
  await both('member view after posts', async s => { const r = await s.client('carla').req('GET', '/api/parishes/p-elias/member'); if (s === cf) content = r.json; s.memberContent = r.json; return view(r); }, { order: true });
  await both('discussion reply', async s => view(await member(s, 'carla', { op: 'discussionReply', id: s.memberContent.content.find(x => x.kind === 'discussion').id, body: 'Medium' })));
  await both('volunteer', async s => view(await member(s, 'carla', { op: 'volunteer', id: s.memberContent.content.find(x => x.kind === 'opportunity').id, status: 'volunteer' })));
  await both('leader confirms volunteer', async s => view(await member(s, 'maya', { op: 'confirmVolunteer', userId: 'u-carla', id: s.memberContent.content.find(x => x.kind === 'opportunity').id, status: 'confirmed' })));
  await both('read item', async s => view(await member(s, 'carla', { op: 'read', id: s.memberContent.content.find(x => x.kind === 'discussion').id })));
  await both('archive item', async s => view(await member(s, 'carla', { op: 'archive', id: s.memberContent.content.find(x => x.kind === 'discussion').id })));
  await both('read all', async s => view(await member(s, 'carla', { op: 'readAll' })));
  await both('message to ministry', async s => view(await member(s, 'carla', { op: 'message', groupId: 'g1', body: 'Hello leader' })));
  await both('staff message', async s => view(await member(s, 'fr-antoine', { op: 'staffMessage', recipientPersonId: 'p6', title: 'Thanks', body: 'Thank you' })));
  await both('leader inbox', async s => { const r = await s.client('maya').req('GET', '/api/parishes/p-elias/member'); s.leaderView = r.json; return view(r); }, { order: true });
  await both('leader replies', async s => view(await member(s, 'maya', { op: 'messageReply', id: s.leaderView.content.find(x => x.kind === 'message' && x.title.startsWith('Message to')).id, body: 'Got it' })));
  await both('profile request', async s => view(await member(s, 'carla', { op: 'profileRequest', field: 'phone', value: '03 123 456' })));
  await both('office view', async s => { const r = await s.client('rita').req('GET', '/api/parishes/p-elias/member'); s.officeView = r.json; return view(r); }, { order: true });
  await both('profile review', async s => view(await member(s, 'rita', { op: 'profileReview', id: s.officeView.profileReview[0].id, status: 'Reviewed' })));
  await both('identified concern', async s => view(await member(s, 'carla', { op: 'concern', category: 'Meetings', groupId: 'g1', subject: 'Late start', description: 'Meetings start late', peopleInvolved: 'Someone', followUp: 'system' })));
  await both('anonymous concern', async s => view(await member(s, 'carla', { op: 'concern', category: 'Safety', subject: 'Stairs', description: 'Broken step', anonymous: true })));
  await both('concern bad category', async s => view(await member(s, 'carla', { op: 'concern', category: 'Nope', subject: 'x', description: 'y' })));
  await both('member view with concerns', async s => { const r = await s.client('carla').req('GET', '/api/parishes/p-elias/member'); s.concerns = r.json.concerns; return view(r); }, { order: true });
  await both('concern follow-up', async s => view(await member(s, 'carla', { op: 'concernFollowUp', id: s.concerns.find(c => c.anonymous).id, message: 'More detail' })));
  await both('reviewer view', async s => { const r = await s.client('fr-antoine').req('GET', '/api/parishes/p-elias/member'); s.review = r.json.review; return view(r); }, { order: true });
  await both('concern update', async s => view(await member(s, 'fr-antoine', { op: 'concernUpdate', id: s.review[0].id, status: 'Under Review', publicText: 'Looking into it', internalText: 'note' })));
  await both('concern assign', async s => view(await member(s, 'fr-antoine', { op: 'concernAssign', id: s.review[0].id, reviewerId: 'u-fr-antoine' })));
  await both('category manage', async s => view(await member(s, 'fr-antoine', { op: 'categoryManage', name: 'Parking', active: true })));
  await both('leader concerns view', async s => view(await s.client('maya').req('GET', '/api/parishes/p-elias/member')), { order: true });
  await both('member view final', async s => view(await s.client('carla').req('GET', '/api/parishes/p-elias/member')), { order: true });
  await both('notification read all', async s => view(await member(s, 'carla', { op: 'notificationReadAll' })));
  await both('unknown member op', async s => view(await member(s, 'carla', { op: 'nope' })));
  await both('tony member view (no ministry)', async s => view(await s.client('tony').req('GET', '/api/parishes/p-elias/member')), { order: true });
  await both('bishop member view refused', async s => view(await s.client('bishop').req('GET', '/api/parishes/p-elias/member')));

  /* Leadership changes in one save: Carla (member) takes g1, Maya leaves her last group. */
  await both('leadership handover in one save', async s => view(await put(s, 'rita', d => {
    d.GROUPS.find(g => g.id === 'g1').leader = 'p6';
    d.GROUP_DETAIL.g1.history = [...(d.GROUP_DETAIL.g1.history || []), { at: '2026-10-09', text: 'Handover to Carla' }];
    d.GROUPS.find(g => g.id === 'g2').leader = 'p11';
    d.GROUP_DETAIL.g2 = { roster: [{ p: 'p11', role: 'Leader' }, { p: 'p3', role: 'Member' }], history: [{ at: '2026-10-09', text: 'Handover' }],
      meetings: [{ id: 'g2m1', d: '2026-10-20', t: '17:00', attendance: {}, participants: [] }] };
    return { GROUPS: d.GROUPS, GROUP_DETAIL: d.GROUP_DETAIL };
  })));
  for (const user of ['carla', 'maya'])
    await both(`${user} session after handover`, async s => { const r = await s.client(user).req('GET', '/api/session'); delete r.json?.csrf; return view(r); });
  await both('maya member view after handover', async s => view(await s.client('maya').req('GET', '/api/parishes/p-elias/member')), { order: true });

  /* Final states and logout */
  for (const user of ['fr-antoine', 'rita', 'nabil', 'maya'])
    await both(`final state as ${user}`, async s => view(await s.client(user).req('GET', '/api/parishes/p-elias/state')));
  await both('public detail after posts', async s => view(await s.client('anon').req('GET', '/api/public/parishes/p-elias')));
  await both('oversight detail final', async s => view(await s.client('bishop').req('GET', '/api/parishes/p-elias/oversight')));
  await both('logout', async s => view(await s.client('rita').req('POST', '/api/logout', {})));
  await both('session after logout', async s => view(await s.client('rita').req('GET', '/api/session')));
  console.log(`\n${checks - failures}/${checks} responses identical`);
  process.exit(failures ? 1 : 0);
}
main().catch(error => { console.error(error); process.exit(2); });
