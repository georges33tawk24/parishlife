/* ParishLife API logic ported from server.py. Function names follow server.py so each
   piece can be compared with the original. `c` is a Tx (see db.js). */
import {
  Problem, PyError, PyDict, need, truthy, eq, has, get, K, setdefault, setItem, iter, len, slice, strip, str,
  set, union, intersection, difference, subset, intersects, any, all, next, keyed, items, values, add, sum, float,
  cmp, gt, ge, le, lt, sorted, int, isdigit, round, pad3, or, typeName, isDict, isList, isStr, isBool,
  fromisoformat, isoformat, isoDate, casefold, NOW, TODAY, localToday, tokenHex, deepcopy, dumps
} from './py.js';
import { SEED, ROLES, CLERGY, FINANCE, PROTECTED, migrate_state, validate, writable } from './state.js';
import { Tx, Conflict } from './db.js';

export { Problem, ROLES };

export const CONCERN_CATEGORIES = ['Ministry activities', 'Leadership', 'Meetings', 'Events', 'Facilities',
  'Behaviour or conduct', 'Safety', 'Communication', 'Financial concerns',
  'Harassment or inappropriate behaviour', 'Administrative issues', 'Suggestions', 'Other'];
export const CONCERN_STATUSES = new Set(['Submitted', 'Under Review', 'Additional Information Requested', 'Referred', 'Resolved', 'Closed']);
const SENSITIVE_CONCERNS = new Set(['Leadership', 'Behaviour or conduct', 'Safety', 'Financial concerns',
  'Harassment or inappropriate behaviour']);

/* ---- schema -------------------------------------------------------------- */
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS dioceses(id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS parishes(id TEXT PRIMARY KEY, diocese TEXT NOT NULL REFERENCES dioceses(id), metadata TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, diocese TEXT NOT NULL REFERENCES dioceses(id), person_id TEXT, password TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS assignments(user_id TEXT REFERENCES users(id), parish_id TEXT REFERENCES parishes(id), PRIMARY KEY(user_id,parish_id))`,
  `CREATE TABLE IF NOT EXISTS states(parish_id TEXT PRIMARY KEY REFERENCES parishes(id), revision INTEGER NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), csrf TEXT NOT NULL, expires REAL NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, parish_id TEXT REFERENCES parishes(id), actor TEXT REFERENCES users(id), at TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS people(parish_id TEXT NOT NULL REFERENCES parishes(id), person_id TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(parish_id,person_id))`,
  `CREATE TABLE IF NOT EXISTS families(parish_id TEXT NOT NULL REFERENCES parishes(id), family_id TEXT NOT NULL, PRIMARY KEY(parish_id,family_id))`,
  `CREATE TABLE IF NOT EXISTS family_branches(parish_id TEXT NOT NULL, branch_id TEXT NOT NULL, family_id TEXT NOT NULL, PRIMARY KEY(parish_id,branch_id), FOREIGN KEY(parish_id,family_id) REFERENCES families(parish_id,family_id))`,
  `CREATE TABLE IF NOT EXISTS households(parish_id TEXT NOT NULL, household_id TEXT NOT NULL, family_id TEXT, branch_id TEXT, head_id TEXT, PRIMARY KEY(parish_id,household_id), FOREIGN KEY(parish_id,family_id) REFERENCES families(parish_id,family_id), FOREIGN KEY(parish_id,branch_id) REFERENCES family_branches(parish_id,branch_id), FOREIGN KEY(parish_id,head_id) REFERENCES people(parish_id,person_id))`,
  `CREATE TABLE IF NOT EXISTS household_members(parish_id TEXT NOT NULL, household_id TEXT NOT NULL, person_id TEXT NOT NULL, relationship TEXT NOT NULL, relative_id TEXT, PRIMARY KEY(parish_id,person_id), UNIQUE(parish_id,household_id,person_id), FOREIGN KEY(parish_id,household_id) REFERENCES households(parish_id,household_id), FOREIGN KEY(parish_id,person_id) REFERENCES people(parish_id,person_id), FOREIGN KEY(parish_id,household_id,relative_id) REFERENCES household_members(parish_id,household_id,person_id))`,
  `CREATE TABLE IF NOT EXISTS parish_groups(parish_id TEXT NOT NULL REFERENCES parishes(id), group_id TEXT NOT NULL, PRIMARY KEY(parish_id,group_id))`,
  `CREATE TABLE IF NOT EXISTS group_members(parish_id TEXT NOT NULL, group_id TEXT NOT NULL, person_id TEXT NOT NULL, PRIMARY KEY(parish_id,group_id,person_id), FOREIGN KEY(parish_id,group_id) REFERENCES parish_groups(parish_id,group_id), FOREIGN KEY(parish_id,person_id) REFERENCES people(parish_id,person_id))`,
  `CREATE TABLE IF NOT EXISTS sacramental_register(parish_id TEXT NOT NULL REFERENCES parishes(id), record_id TEXT NOT NULL, person_id TEXT NOT NULL, reference TEXT NOT NULL, status TEXT NOT NULL, PRIMARY KEY(parish_id,record_id), UNIQUE(parish_id,reference), FOREIGN KEY(parish_id,person_id) REFERENCES people(parish_id,person_id))`,
  `CREATE TABLE IF NOT EXISTS certificate_sources(parish_id TEXT NOT NULL, request_id TEXT NOT NULL, source_record_id TEXT NOT NULL, PRIMARY KEY(parish_id,request_id), FOREIGN KEY(parish_id,request_id) REFERENCES sacramental_register(parish_id,record_id), FOREIGN KEY(parish_id,source_record_id) REFERENCES sacramental_register(parish_id,record_id))`,
  `CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY)`,
  `CREATE TABLE IF NOT EXISTS member_private(parish_id TEXT NOT NULL REFERENCES parishes(id), user_id TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL, PRIMARY KEY(parish_id,user_id))`,
  `CREATE TABLE IF NOT EXISTS member_content(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id), group_id TEXT, kind TEXT NOT NULL, author_id TEXT NOT NULL REFERENCES users(id), recipient_id TEXT REFERENCES users(id), title TEXT NOT NULL, body TEXT NOT NULL, category TEXT NOT NULL DEFAULT '', event_id TEXT, attachment TEXT, pinned INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS member_replies(id TEXT PRIMARY KEY, content_id TEXT NOT NULL REFERENCES member_content(id), author_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS member_concerns(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id), reference TEXT UNIQUE NOT NULL, user_id TEXT REFERENCES users(id), category TEXT NOT NULL, group_id TEXT, event_id TEXT, subject TEXT NOT NULL, description TEXT NOT NULL, happened_at TEXT, people_involved TEXT, attachment TEXT, follow_up TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL, assigned_to TEXT REFERENCES users(id))`,
  `CREATE TABLE IF NOT EXISTS member_concern_updates(id TEXT PRIMARY KEY, concern_id TEXT NOT NULL REFERENCES member_concerns(id), actor_id TEXT REFERENCES users(id), status TEXT NOT NULL, public_text TEXT NOT NULL DEFAULT '', internal_text TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS complaint_audit(id INTEGER PRIMARY KEY, concern_id TEXT NOT NULL REFERENCES member_concerns(id), actor_id TEXT REFERENCES users(id), action TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS complaint_reviewers(parish_id TEXT NOT NULL REFERENCES parishes(id), user_id TEXT NOT NULL REFERENCES users(id), permissions TEXT NOT NULL, PRIMARY KEY(parish_id,user_id))`,
  `CREATE TABLE IF NOT EXISTS complaint_categories(parish_id TEXT NOT NULL REFERENCES parishes(id), name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(parish_id,name))`,
  `CREATE TABLE IF NOT EXISTS member_profile_requests(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id), user_id TEXT NOT NULL REFERENCES users(id), field TEXT NOT NULL, requested_value TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS member_commitments(parish_id TEXT NOT NULL REFERENCES parishes(id), user_id TEXT NOT NULL REFERENCES users(id), content_id TEXT NOT NULL REFERENCES member_content(id), status TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(parish_id,user_id,content_id))`,
  `CREATE TABLE IF NOT EXISTS member_rsvp(parish_id TEXT NOT NULL REFERENCES parishes(id), user_id TEXT NOT NULL REFERENCES users(id), group_id TEXT NOT NULL, meeting_id TEXT NOT NULL, status TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(parish_id,user_id,meeting_id))`,
  `CREATE TABLE IF NOT EXISTS member_notifications(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id), user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, route TEXT NOT NULL, created_at TEXT NOT NULL, read_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS uploaded_files(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id), scope TEXT NOT NULL, owner_id TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, data BLOB NOT NULL, uploaded_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS uploaded_files_owner ON uploaded_files(parish_id,scope,owner_id)`,
  /* Cloudflare additions. cf_meta holds the commit counter (see db.js); file bytes are
     kept as base64 text chunks because a D1 row is limited to 2 MB. The indexes keep
     the daily D1 row-read allowance for the lists server.py reads most often. */
  `CREATE TABLE IF NOT EXISTS cf_meta(id INTEGER PRIMARY KEY CHECK (id = 1), seq INTEGER NOT NULL, init TEXT NOT NULL DEFAULT '')`,
  `CREATE TRIGGER IF NOT EXISTS cf_meta_seq BEFORE UPDATE OF seq ON cf_meta WHEN NEW.seq IS NOT OLD.seq + 1 BEGIN SELECT RAISE(ABORT, 'cf-conflict'); END`,
  `CREATE TABLE IF NOT EXISTS cf_file_chunks(file_id TEXT NOT NULL REFERENCES uploaded_files(id), seq INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(file_id,seq))`,
  `CREATE INDEX IF NOT EXISTS cf_audit_parish ON audit(parish_id,id)`,
  `CREATE INDEX IF NOT EXISTS cf_member_content_parish ON member_content(parish_id,created_at)`,
  `CREATE INDEX IF NOT EXISTS cf_member_replies_content ON member_replies(content_id,created_at)`,
  `CREATE INDEX IF NOT EXISTS cf_member_concerns_parish ON member_concerns(parish_id,created_at)`,
  `CREATE INDEX IF NOT EXISTS cf_member_concern_updates ON member_concern_updates(concern_id,created_at)`,
  `CREATE INDEX IF NOT EXISTS cf_member_profile_requests ON member_profile_requests(parish_id,created_at)`,
  `CREATE INDEX IF NOT EXISTS cf_member_notifications ON member_notifications(parish_id,user_id,created_at)`
];
export const INIT_VERSION = 'server.py schema 5';

let ready = null;
/* init_db() runs once per Worker instance, the way server.py runs it once per start. */
export function ensureDatabase(db) {
  ready ??= initialize(db).catch(error => {
    ready = null;
    throw error;
  });
  return ready;
}
/* `force` repeats every startup step even when this schema version already ran,
   as server.py does on each start (the Python test suite relies on that). */
export async function initialize(db, force = false) {
  if (!force) {
    try {
      const row = await db.prepare('SELECT init FROM cf_meta WHERE id=1').first();
      if (row && row.init === INIT_VERSION) return;
    } catch {
      /* No schema yet. */
    }
  }
  await db.batch(SCHEMA.map(sql => db.prepare(sql)));
  await db.prepare("INSERT OR IGNORE INTO cf_meta(id,seq,init) VALUES(1,0,'')").run();
  for (let attempt = 1; ; attempt++) {
    const c = new Tx(db);
    try {
      await init_db(c, force);
      await c.commit();
      return;
    } catch (error) {
      if (!(error instanceof Conflict) || attempt >= 8) throw error;
    }
  }
}

export async function init_db(c, force = false) {
  const [meta] = await c.reads([['SELECT init FROM cf_meta WHERE id=1', []]]);
  if (!force && meta[0] && meta[0].init === INIT_VERSION) return;
  /* Keep legacy account IDs for audit/history, but remove the old volunteer-only
     login and revoke any sessions it already opened. (member_concerns.assigned_to is
     part of CREATE TABLE here, so server.py's ALTER TABLE step never applies.) */
  c.run("UPDATE users SET role='disabled' WHERE role='volunteer'");
  c.run("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role='disabled')");
  c.run("INSERT OR IGNORE INTO dioceses VALUES('beirut','Archeparchy of Beirut')");
  const [stored] = await c.reads([['SELECT * FROM states', []]]);
  const states = stored.map(row => ({ parish_id: row.parish_id, data: row.data }));
  const present = new Set(states.map(row => row.parish_id));
  for (const p of SEED.PARISHES) {
    c.run('INSERT OR IGNORE INTO parishes VALUES(?,?,?)', p.id, 'beirut', JSON.stringify(p));
    for (const category of CONCERN_CATEGORIES) c.run('INSERT OR IGNORE INTO complaint_categories VALUES(?,?,1)', p.id, category);
    let d;
    if (p.id !== 'p-elias') {
      /* Independent empty records, with safe structural defaults for the existing views. */
      d = {};
      for (const [k, v] of Object.entries(SEED)) d[k] = isList(v) ? [] : isDict(v) ? {} : deepcopy(v);
      for (const k of ['RATE', 'SERVICE', 'ROTA', 'CHECKIN', 'BATCH', 'REG_FORM', 'EVACUATION']) d[k] = deepcopy(SEED[k]);
      Object.assign(d.SERVICE, { order: [], celebrant: null, coordinator: null, venue: null });
      d.ROTA.teams = [];
      Object.assign(d.CHECKIN, { rows: [], present: 0, expected: 0, awaitingGuardian: 0, room: null });
      Object.assign(d.BATCH, { lines: [], counters: [] });
      Object.assign(d.REG_FORM, { fields: [], discounts: [], installments: [] });
      d.EVACUATION.rooms = [];
      d.PARISH = deepcopy(SEED.PARISH);
    } else {
      d = deepcopy(SEED);
    }
    Object.assign(d.PARISH, { id: p.id, name: p.name, nameAr: p.ar, town: p.town, townAr: p.townAr });
    d.PARISHES = [];
    const text = JSON.stringify(migrate_state(d));
    c.run('INSERT OR IGNORE INTO states VALUES(?,1,?)', p.id, text);
    if (!present.has(p.id)) {
      states.push({ parish_id: p.id, data: text });
      present.add(p.id);
    }
  }
  for (const row of states) {
    const d = migrate_state(JSON.parse(row.data));
    const text = JSON.stringify(d);
    if (text !== row.data) c.run('UPDATE states SET data=? WHERE parish_id=?', text, row.parish_id);
    await sync_relationships(c, row.parish_id, d);
  }
  c.run('DELETE FROM schema_version');
  c.run('INSERT INTO schema_version VALUES(5)');
  c.run('UPDATE cf_meta SET init=? WHERE id=1', INIT_VERSION);
}

/* ---- normalized relationship tables -------------------------------------- */
/* table, primary key columns, all columns (all TEXT except people.archived) */
const RELATIONS = [
  ['people', ['person_id'], ['parish_id', 'person_id', 'archived']],
  ['families', ['family_id'], ['parish_id', 'family_id']],
  ['family_branches', ['branch_id'], ['parish_id', 'branch_id', 'family_id']],
  ['households', ['household_id'], ['parish_id', 'household_id', 'family_id', 'branch_id', 'head_id']],
  ['household_members', ['person_id'], ['parish_id', 'household_id', 'person_id', 'relationship', 'relative_id']],
  ['parish_groups', ['group_id'], ['parish_id', 'group_id']],
  ['group_members', ['group_id', 'person_id'], ['parish_id', 'group_id', 'person_id']],
  ['sacramental_register', ['record_id'], ['parish_id', 'record_id', 'person_id', 'reference', 'status']],
  ['certificate_sources', ['request_id'], ['parish_id', 'request_id', 'source_record_id']]
];
/* The value SQLite stores in a TEXT (or INTEGER) column for a bound value. */
function stored(value, column) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') value = value ? 1 : 0;
  if (column === 'archived') return value;
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value);
  return value;
}

/* Mirror key church relationships into normalized, foreign-keyed tables.
   server.py deletes and reinserts every row; writing only the differences gives the
   same table contents with far fewer D1 row writes. */
export async function sync_relationships(c, pid, d) {
  const people = add(K(d, 'PEOPLE'), K(d, 'ARCHIVED'));
  const archived = K(d, 'ARCHIVED');
  const wanted = Object.fromEntries(RELATIONS.map(([table]) => [table, []]));
  for (const p of people) wanted.people.push([pid, K(p, 'id'), has(archived, p) ? 1 : 0]);
  for (const f of iter(K(d, 'FAMILIES'))) wanted.families.push([pid, K(f, 'id')]);
  for (const b of iter(K(d, 'BRANCHES'))) wanted.family_branches.push([pid, K(b, 'id'), K(b, 'family')]);
  for (const h of iter(K(d, 'HOUSEHOLDS'))) wanted.households.push([pid, K(h, 'id'), get(h, 'family'), get(h, 'branch'), get(h, 'head')]);
  for (const h of iter(K(d, 'HOUSEHOLDS'))) {
    for (const personId of iter(K(h, 'members'))) {
      const p = people.find(person => eq(K(person, 'id'), personId));
      if (!p) throw new Error('StopIteration');
      wanted.household_members.push([pid, K(h, 'id'), personId, get(p, 'rel', 'relative'), get(p, 'relativeTo')]);
    }
  }
  for (const g of iter(K(d, 'GROUPS'))) wanted.parish_groups.push([pid, K(g, 'id')]);
  for (const [gid, info] of items(K(d, 'GROUP_DETAIL'))) {
    for (const member of iter(get(info, 'roster', []))) wanted.group_members.push([pid, gid, K(member, 'p')]);
  }
  for (const s of iter(K(d, 'SACRAMENTS'))) wanted.sacramental_register.push([pid, K(s, 'id'), K(s, 'person'), K(s, 'reg'), K(s, 'status')]);
  for (const s of iter(K(d, 'SACRAMENTS'))) {
    if (eq(get(s, 'kind'), 'certificate') && truthy(get(s, 'sourceRecordId')))
      wanted.certificate_sources.push([pid, K(s, 'id'), K(s, 'sourceRecordId')]);
  }
  for (const rows of Object.values(wanted)) {
    for (const row of rows) for (const value of row) if (value !== null && typeof value === 'object') throw new Error('Error binding parameter: type not supported');
  }
  const existing = await c.reads(RELATIONS.map(([table]) => [`SELECT * FROM ${table} WHERE parish_id=?`, [pid]]));
  const deletes = [], inserts = [];
  RELATIONS.forEach(([table, keyColumns, columns], index) => {
    const keyOf = values => JSON.stringify(keyColumns.map(column => values[columns.indexOf(column)]));
    const desired = new Map();
    for (const row of wanted[table]) {
      const normal = row.map((value, i) => stored(value, columns[i]));
      const key = keyOf(normal);
      if (desired.has(key)) throw new Error(`UNIQUE constraint failed: ${table}`);
      desired.set(key, { normal, row });
    }
    if (table === 'sacramental_register') {
      const references = new Set();
      for (const { normal } of desired.values()) {
        if (references.has(normal[3])) throw new Error('UNIQUE constraint failed: sacramental_register.reference');
        references.add(normal[3]);
      }
    }
    const current = new Map(existing[index].map(record => {
      const normal = columns.map(column => record[column]);
      return [keyOf(normal), normal];
    }));
    const keyWhere = keyColumns.map(column => `${column}=?`).join(' AND ');
    for (const [key, normal] of current) {
      const want = desired.get(key);
      if (!want || want.normal.some((value, i) => value !== normal[i]))
        deletes.push([table, `DELETE FROM ${table} WHERE parish_id=? AND ${keyWhere}`, [pid, ...keyColumns.map(column => normal[columns.indexOf(column)])]]);
    }
    for (const [key, want] of desired) {
      const have = current.get(key);
      if (!have || want.normal.some((value, i) => value !== have[i]))
        inserts.push([table, `INSERT INTO ${table} VALUES(${columns.map(() => '?').join(',')})`, want.row]);
    }
  });
  c.run('PRAGMA defer_foreign_keys=ON');
  const order = ['certificate_sources', 'sacramental_register', 'group_members', 'household_members', 'households', 'family_branches', 'families', 'parish_groups', 'people'];
  for (const table of order) for (const [name, sql, params] of deletes) if (name === table) c.run(sql, ...params);
  for (const table of [...order].reverse()) for (const [name, sql, params] of inserts) if (name === table) c.run(sql, ...params);
}

/* ---- access --------------------------------------------------------------- */
export async function access(c, u, pid) {
  const [parish, assignment] = await c.reads([
    ['SELECT * FROM parishes WHERE id=? AND diocese=?', [pid, K(u, 'diocese')]],
    ['SELECT 1 FROM assignments WHERE user_id=? AND parish_id=?', [K(u, 'id'), pid]]
  ]);
  need(parish.length > 0 && (K(u, 'role') === 'bishop' || assignment.length > 0), 'This parish is not assigned to your account.', 403);
}

export async function file_access(c, u, pid, scope, owner_id, write = false) {
  need(has(new Set(['group', 'person']), scope), 'Invalid file owner.');
  const row = await c.first('SELECT data FROM states WHERE parish_id=?', pid);
  need(row !== null, 'Parish not found.', 404);
  const state = JSON.parse(row.data);
  if (scope === 'person') {
    need(any(add(K(state, 'PEOPLE'), K(state, 'ARCHIVED')), person => eq(K(person, 'id'), owner_id)), 'Person not found.', 404);
    need(has(new Set(['priest', 'secretary']), K(u, 'role')) || (!truthy(write) && K(u, 'role') === 'member' && eq(K(u, 'person_id'), owner_id)),
      'Person attachments are restricted.', 403);
  } else {
    const group = next(K(state, 'GROUPS'), item => eq(K(item, 'id'), owner_id));
    need(group !== null, 'Group not found.', 404);
    let permitted = has(new Set(['priest', 'secretary']), K(u, 'role')) ||
      (K(u, 'role') === 'leader' && has(set([get(group, 'leader'), get(group, 'assistant')]), K(u, 'person_id')));
    if (!truthy(write) && K(u, 'role') === 'member') {
      permitted = any(get(get(K(state, 'GROUP_DETAIL'), owner_id, {}), 'roster', []), item => eq(get(item, 'p'), K(u, 'person_id')));
    }
    need(permitted, 'Group files are outside your scope.', 403);
  }
}

const ROLE_NAMES = {
  bishop: ['Archdiocese oversight', 'إشراف الأبرشية'], priest: ['Assigned parish priest', 'كاهن معيّن'],
  secretary: ['Parish secretary', 'أمانة سرّ الرعية'], treasurer: ['Parish treasurer', 'أمين صندوق الرعية'],
  leader: ['Ministry leader', 'مسؤول خدمة'], member: ['Ministry member', 'عضو خدمة']
};

/* `known` maps a parish ID to its state already read in this transaction, so the
   counts below need not parse it again. */
export async function parishes(c, u, known = {}) {
  const [rows, assignedRows] = await c.reads([
    ['SELECT * FROM parishes WHERE diocese=?', [K(u, 'diocese')]],
    ['SELECT parish_id FROM assignments WHERE user_id=?', [K(u, 'id')]]
  ]);
  const assigned = new Set(assignedRows.map(r => r.parish_id));
  const role = K(u, 'role');
  if (!Object.prototype.hasOwnProperty.call(ROLE_NAMES, role)) throw new PyError('KeyError');
  const chosen = rows.filter(r => role === 'bishop' || assigned.has(r.id));
  const missing = role !== 'member' ? chosen.filter(r => !Object.prototype.hasOwnProperty.call(known, r.id)) : [];
  const stateRows = missing.length ? await c.reads(missing.map(r => ['SELECT data FROM states WHERE parish_id=?', [r.id]])) : [];
  const parsed = new Map(missing.map((r, i) => [r.id, stateRows[i][0] ? JSON.parse(stateRows[i][0].data) : null]));
  const year = localToday().slice(0, 4).replace(/^0+/, '');
  return chosen.map(r => {
    const p = JSON.parse(r.metadata);
    [p.role, p.roleAr] = ROLE_NAMES[role];
    const data = role === 'member' ? null : Object.prototype.hasOwnProperty.call(known, r.id) ? known[r.id] : parsed.get(r.id);
    if (data) {
      p.people = len(K(data, 'PEOPLE'));
      p.households = len(K(data, 'HOUSEHOLDS'));
      p.sacramentsYear = iter(K(data, 'SACRAMENTS')).filter(s => str(get(s, 'date', '')).startsWith(year)
        && !eq(get(s, 'kind'), 'certificate') && has(new Set(['registered', 'issued']), get(s, 'status'))).length;
    }
    return p;
  });
}

/* A separate projection: no private notes, contact data, or parish editing model. */
export async function oversight(c, u, pid = null) {
  need(K(u, 'role') === 'bishop', 'Bishop oversight access required.', 403);
  const result = [];
  const today = TODAY();
  for (const parish of await parishes(c, u)) {
    if (truthy(pid) && parish.id !== pid) continue;
    const stateRow = await c.first('SELECT data FROM states WHERE parish_id=?', parish.id);
    if (stateRow === null) throw new PyError("'NoneType' object is not subscriptable");
    const d = JSON.parse(stateRow.data);
    const sacraments = iter(K(d, 'SACRAMENTS'));
    const counts = {
      people: len(K(d, 'PEOPLE')), households: len(K(d, 'HOUSEHOLDS')), groups: len(K(d, 'GROUPS')),
      registers: sacraments.filter(s => !eq(get(s, 'kind'), 'certificate') && has(new Set(['registered', 'issued']), get(s, 'status'))).length,
      pendingRequests: sacraments.filter(s => has(new Set(['draft', 'scheduled', 'awaiting-signature', 'approved']), get(s, 'status'))).length,
      upcomingEvents: iter(K(d, 'EVENTS')).filter(e => ge(slice(str(get(e, 'd', get(e, 'date', ''))), 0, 10), today)).length
    };
    const item = { parish, counts };
    if (truthy(pid)) {
      const people = keyed(add(K(d, 'PEOPLE'), K(d, 'ARCHIVED')), p => K(p, 'id'));
      const name = personId => Object.fromEntries(['lat', 'ar'].map(key => [key, get(people.get(personId, {}), key, '')]));
      const households = keyed(K(d, 'HOUSEHOLDS'), h => K(h, 'id'));
      const groupDetail = K(d, 'GROUP_DETAIL');
      item.people = iter(K(d, 'PEOPLE')).map(p => ({
        id: K(p, 'id'), lat: K(p, 'lat'), ar: K(p, 'ar'), status: get(p, 'status', ''),
        town: get(p, 'town', ''), townAr: get(p, 'townAr', ''), rite: get(p, 'rite', ''),
        household: Object.fromEntries(['name', 'ar'].map(k => [k, get(households.get(get(p, 'hh'), {}), k, '')])),
        groups: iter(K(d, 'GROUPS')).filter(g => any(get(get(groupDetail, K(g, 'id'), {}), 'roster', []), r => eq(get(r, 'p'), K(p, 'id'))))
          .map(g => ({ id: K(g, 'id'), name: K(g, 'name'), ar: get(g, 'ar', '') }))
      }));
      item.records = sacraments.map(s => ({ id: K(s, 'id'), reference: get(s, 'reg', ''), kind: K(s, 'kind'), status: K(s, 'status'),
        date: get(s, 'date', ''), personId: K(s, 'person'), person: name(K(s, 'person')) }));
      item.events = iter(K(d, 'EVENTS')).map(e => ({ id: K(e, 'id'), title: get(e, 'title', ''), titleAr: get(e, 'titleAr', ''),
        date: get(e, 'd', get(e, 'date', '')), time: get(e, 'time', get(e, 't', '')), kind: get(e, 'kind', ''), venue: get(e, 'venue', '') }));
      item.groups = [];
      for (const g of iter(K(d, 'GROUPS'))) {
        const detail = get(groupDetail, K(g, 'id'), {});
        const meetings = [];
        let present = 0, recorded = 0;
        for (const m of iter(get(detail, 'meetings', []))) {
          const marks = values(get(m, 'attendance', {}));
          let came, marked;
          if (marks.length) {
            came = marks.filter(mark => eq(mark, 'present')).length;
            marked = marks.filter(mark => has(new Set(['present', 'absent', 'excused']), mark)).length;
          } else if (truthy(get(m, 'done'))) {
            came = int(or(get(m, 'present'), 0));
            marked = add(came, len(get(m, 'absent', [])));
          } else {
            came = marked = 0;
          }
          present = add(present, came);
          recorded = add(recorded, marked);
          meetings.push({ id: get(m, 'id', ''), title: or(get(m, 'title'), get(m, 'topic'), K(g, 'name')),
            date: get(m, 'd', ''), time: get(m, 't', ''), present: came, recorded: marked });
        }
        item.groups.push({ id: K(g, 'id'), name: K(g, 'name'), ar: get(g, 'ar', ''),
          members: len(get(detail, 'roster', [])), meetings,
          attendance: { present, recorded, percentage: recorded ? round(100 * present / recorded) : null },
          roster: iter(get(detail, 'roster', [])).map(r => ({ id: K(r, 'p'), ...name(K(r, 'p')) })) });
      }
      const [actorRows, auditRows] = await c.reads([
        ['SELECT id,name FROM users WHERE diocese=?', [K(u, 'diocese')]],
        ['SELECT at,action,actor FROM audit WHERE parish_id=? ORDER BY id DESC LIMIT 50', [pid]]
      ]);
      const actors = new Map(actorRows.map(r => [r.id, r.name]));
      item.activity = auditRows.map(r => ({ at: r.at, action: r.action, actor: actors.has(r.actor) ? actors.get(r.actor) : 'System' }));
    }
    result.push(item);
  }
  need(!truthy(pid) || result.length, 'Parish not found in your archdiocese.', 404);
  return truthy(pid) ? result[0] : result;
}

const leaderGroups = (d, u) => set(iter(K(d, 'GROUPS'))
  .filter(g => eq(get(g, 'leader'), K(u, 'person_id')) || eq(get(g, 'assistant'), K(u, 'person_id'))).map(g => K(g, 'id')));

/* visible(). Options: `fresh` — `d` was parsed for this call alone and is not used
   afterwards, so the copy server.py makes is not needed; `stored` — `d` is the parish's
   state as stored in this transaction, so parishes() can count from it. */
export async function visible(c, u, pid, d, { fresh = false, stored = false } = {}) {
  need(!has(new Set(['bishop', 'member']), K(u, 'role')), 'Use your dedicated portal.', 403);
  const known = stored ? { [pid]: d } : {};
  if (!fresh) d = deepcopy(d);
  const allPeople = K(d, 'PEOPLE');
  Object.assign(K(d, 'PARISH'), { people: len(K(d, 'PEOPLE')), households: len(K(d, 'HOUSEHOLDS')), groups: len(K(d, 'GROUPS')) });
  d.PARISHES = await parishes(c, u, known);
  const role = K(u, 'role');
  if (!CLERGY.has(role)) {
    d.NOTES = [];
    d.AUDIT = [];
    for (const k of ['SESSIONS', 'SECURITY_ALERTS', 'WEBHOOKS', 'EXCEPTIONS']) d[k] = [];
    delete d.PARISH.apiKey;
  } else {
    const [actorRows, auditRows] = await c.reads([
      ['SELECT id,name,person_id FROM users WHERE diocese=?', [K(u, 'diocese')]],
      ['SELECT * FROM audit WHERE parish_id=? ORDER BY id DESC LIMIT 500', [pid]]
    ]);
    const actors = new Map(actorRows.map(r => [r.id, r]));
    d.AUDIT = auditRows.map(r => ({
      at: r.at, who: actors.has(r.actor) ? actors.get(r.actor).person_id : null,
      actorName: actors.has(r.actor) ? actors.get(r.actor).name : 'System',
      what: r.action, whatAr: r.action, kind: r.action.includes('approve') ? 'approve' : 'create'
    }));
  }
  if (!(CLERGY.has(role) || role === 'treasurer')) {
    for (const k of FINANCE) d[k] = isList(get(d, k)) ? [] : { lines: [], status: 'unavailable', counters: [] };
  }
  if (role === 'treasurer') {
    for (const k of ['SACRAMENTS', 'CORRECTIONS', 'PORTAL_REQUESTS', 'REQUEST_HISTORY', 'PRAYERS', 'INCIDENTS', 'PICKUP']) d[k] = [];
  }
  if (role === 'leader') {
    const gs = leaderGroups(d, u);
    const ids = new Set([K(u, 'person_id') ?? null]);
    const detailOf = g => get(K(d, 'GROUP_DETAIL'), g, {});
    for (const g of gs) for (const r of iter(get(detailOf(g), 'roster', []))) ids.add(hashableValue(K(r, 'p')));
    for (const g of gs) for (const meeting of iter(get(detailOf(g), 'meetings', []))) for (const member of iter(get(meeting, 'attendance', {}))) ids.add(hashableValue(member));
    for (const g of gs) for (const milestone of iter(get(detailOf(g), 'milestones', []))) for (const member of iter(get(milestone, 'completions', {}))) ids.add(hashableValue(member));
    d.PEOPLE = iter(K(d, 'PEOPLE')).filter(p => has(ids, K(p, 'id'))).map(p => ({
      id: K(p, 'id'), lat: K(p, 'lat'), ar: K(p, 'ar'), tags: [], hh: null, phone: '—', born: '', status: K(p, 'status') }));
    for (const k of ['ARCHIVED', 'HOUSEHOLDS', 'SACRAMENTS', 'CORRECTIONS', 'FAMILIES', 'BRANCHES', 'PORTAL_REQUESTS', 'REQUEST_HISTORY']) d[k] = [];
    d.PERSON_EXTRA = {};
    d.GROUPS = iter(K(d, 'GROUPS')).filter(g => has(gs, K(g, 'id')));
    d.GROUP_DETAIL = filterDict(K(d, 'GROUP_DETAIL'), g => has(gs, g));
    d.VOLUNTEERS = iter(K(d, 'VOLUNTEERS')).filter(v => has(ids, get(v, 'p')));
    setItem(K(d, 'ROTA'), 'teams', []);
    d.SIGNUP_SHEETS = [];
  }
  if (!(role === 'priest' || role === 'secretary')) {
    const memberGroups = set(items(K(d, 'GROUP_DETAIL'))
      .filter(([, detail]) => any(get(detail, 'roster', []), member => eq(get(member, 'p'), K(u, 'person_id')))).map(([gid]) => gid));
    const allowedGroups = union(memberGroups, leaderGroups(d, u));
    const eventDetail = K(d, 'EVENT_DETAIL');
    const allowedEvents = set(iter(K(d, 'EVENTS')).filter(event => {
      const detail = get(eventDetail, K(event, 'id'), {});
      return eq(get(detail, 'visibility', 'public'), 'public') ||
        (eq(get(detail, 'visibility'), 'groups') && intersects(set(get(detail, 'visibleGroupIds', [])), allowedGroups));
    }).map(event => K(event, 'id')));
    d.EVENTS = iter(K(d, 'EVENTS')).filter(event => has(allowedEvents, K(event, 'id')));
    d.EVENT_DETAIL = filterDict(K(d, 'EVENT_DETAIL'), eid => has(allowedEvents, eid));
    d.REGISTRATIONS = iter(K(d, 'REGISTRATIONS')).filter(form => has(allowedEvents, get(form, 'eventId')));
    const allowedForms = set(d.REGISTRATIONS.map(form => K(form, 'id')));
    d.REGISTRANTS = iter(K(d, 'REGISTRANTS')).filter(row => has(allowedForms, get(row, 'registrationId')));
    if (role === 'leader') {
      const participantIds = set(d.REGISTRANTS.map(row => get(row, 'p')));
      d.PICKUP = filterDict(K(d, 'PICKUP'), personId => has(participantIds, personId));
    }
    if (role === 'leader') {
      const existing = set(d.PEOPLE.map(person => K(person, 'id')));
      const allowedPeople = difference(set(d.REGISTRANTS.map(row => K(row, 'p'))), existing);
      for (const person of iter(allPeople)) {
        if (has(allowedPeople, K(person, 'id'))) d.PEOPLE.push({ id: K(person, 'id'), lat: K(person, 'lat'), ar: K(person, 'ar'), tags: [], hh: null,
          phone: '—', born: '', status: K(person, 'status') });
      }
    }
    /* Legacy unlinked form/check-in records remain in storage, but have no
       event visibility rule and must not be sent to restricted users. */
    d.REG_FORM = {};
    const checkin = K(d, 'CHECKIN');
    for (const [key, value] of Object.entries({ rows: [], present: 0, expected: 0, awaitingGuardian: 0, room: null, session: '', sessionAr: '' })) setItem(checkin, key, value);
    setItem(checkin, 'sessions', filterDict(get(checkin, 'sessions', {}), eid => has(allowedEvents, eid)));
  }
  return d;
}
function hashableValue(v) {
  if (v !== null && typeof v === 'object') throw new PyError('unhashable type');
  return v;
}
function filterDict(obj, keep) {
  const out = {};
  for (const [k, v] of items(obj)) if (keep(k)) setItem(out, k, v);
  return out;
}

/* ---- saving parish records ----------------------------------------------- */
function references(value, personId) {
  if (isDict(value)) return Object.entries(value).some(([key, item]) => eq(key, personId) || references(item, personId));
  if (isList(value)) return value.some(item => references(item, personId));
  return eq(value, personId);
}

export async function save_patch(c, u, pid, payload) {
  await access(c, u, pid);
  need(!has(new Set(['bishop', 'member']), K(u, 'role')), 'Parish staff access required.', 403);
  const row = await c.first('SELECT * FROM states WHERE parish_id=?', pid);
  if (row === null) throw new PyError("'NoneType' object is not subscriptable");
  need(eq(get(payload, 'revision'), row.revision), 'Another user changed this parish. Reload before saving.', 409);
  const old = JSON.parse(row.data);
  let d = JSON.parse(row.data);
  const changes = get(payload, 'changes');
  need(isDict(changes), 'Expected changes.');
  const role = K(u, 'role');
  for (const [key, value] of Object.entries(changes)) {
    need(has(d, key) && writable(role, key), 'Your role cannot change ' + key, 403);
    need(typeName(value) === typeName(d[key]), 'Invalid collection type: ' + key);
    if (key === 'GROUP_DETAIL' && role === 'leader') {
      const permitted = leaderGroups(old, u);
      need(subset(set(value), permitted), 'Group is outside your ministry.', 403);
      for (const [gid, detail] of items(value)) setItem(d[key], gid, detail);
    } else if (key === 'CHECKIN' && role === 'leader') {
      const scoped = await visible(c, u, pid, old, { stored: true });
      const permitted = union(set(get(K(scoped, 'CHECKIN'), 'sessions', {})), set(iter(K(scoped, 'REGISTRATIONS')).map(form => get(form, 'eventId'))));
      need(subset(set(get(value, 'sessions', {})), permitted), 'Event is outside your check-in scope.', 403);
      for (const [eventId, eventSession] of items(get(value, 'sessions', {}))) setItem(K(K(d, 'CHECKIN'), 'sessions'), eventId, eventSession);
    } else if (key === 'PICKUP' && role === 'leader') {
      const scoped = await visible(c, u, pid, old, { stored: true });
      const permitted = set(iter(K(scoped, 'REGISTRANTS')).map(r => get(r, 'p')));
      need(subset(set(value), permitted), 'Person is outside your check-in scope.', 403);
      for (const [personId, info] of items(value)) {
        const previous = get(K(old, 'PICKUP'), personId, {});
        need(eq(get(info, 'restricted', []), get(previous, 'restricted', [])), 'A leader cannot change pickup restrictions.', 403);
        need(!truthy(get(info, 'restricted')) || get(info, 'required') !== false, 'Restricted pickup remains required.', 403);
        setItem(K(d, 'PICKUP'), personId, info);
      }
    } else {
      d[key] = value;
    }
  }
  const before = set(add(K(old, 'PEOPLE'), K(old, 'ARCHIVED')).map(person => K(person, 'id')));
  const after = set(add(K(d, 'PEOPLE'), K(d, 'ARCHIVED')).map(person => K(person, 'id')));
  const removedPeople = difference(before, after);
  if (removedPeople.size) {
    const preserved = Object.entries(old).filter(([key]) => !['PEOPLE', 'ARCHIVED', 'PERSON_EXTRA', 'PHOTOS', 'PREFS'].includes(key)).map(([, value]) => value);
    const oldPeople = add(K(old, 'PEOPLE'), K(old, 'ARCHIVED'));
    for (const personId of removedPeople) {
      need(!preserved.some(value => references(value, personId)) &&
        !oldPeople.some(person => !eq(K(person, 'id'), personId) && references(person, personId)),
        'Archive a person with linked records instead of permanently deleting them.');
    }
  }
  const oldForms = keyed(K(old, 'REGISTRATIONS'), form => K(form, 'id'));
  const eventIds = () => set(iter(K(d, 'EVENTS')).map(event => K(event, 'id')));
  for (const form of iter(K(d, 'REGISTRATIONS'))) {
    if (!oldForms.has(K(form, 'id')) || !eq(form, oldForms.get(K(form, 'id')))) {
      const eventId = get(form, 'eventId');
      need(truthy(eventId) && has(eventIds(), eventId), 'Select an eligible event before saving a registration form.');
    }
  }
  const previousRegistrants = keyed(K(old, 'REGISTRANTS'), registrant => K(registrant, 'id'));
  const currentForms = keyed(K(d, 'REGISTRATIONS'), form => K(form, 'id'));
  const addedByForm = new PyDict();
  for (const registrant of iter(K(d, 'REGISTRANTS'))) {
    const beforeRegistrant = previousRegistrants.get(K(registrant, 'id'));
    if (beforeRegistrant === null) {
      need(get(registrant, 'registrationId'), 'Select a registration form before adding participants.');
      const form = currentForms.get(K(registrant, 'registrationId'));
      need(form !== null && truthy(get(form, 'eventId')) && truthy(get(form, 'open')),
        'New participants require an open registration form linked to an event.');
      need(eq(get(registrant, 'paid', 0), 0) && has(new Set(['pending', 'registered']), get(registrant, 'status'))
        && (!eq(get(registrant, 'status'), 'registered') || truthy(get(registrant, 'consent')))
        && !truthy(get(registrant, 'payments')), 'New participant status is inconsistent.');
      addedByForm.set(K(form, 'id'), add(addedByForm.get(K(form, 'id'), 0), 1));
      need(!iter(K(d, 'REGISTRANTS')).some(other => other !== registrant && eq(get(other, 'p'), get(registrant, 'p')) &&
        eq(get(currentForms.get(get(other, 'registrationId'), {}), 'eventId'), K(form, 'eventId'))),
        'This person is already registered for that event.');
    } else {
      need(eq(get(registrant, 'p'), get(beforeRegistrant, 'p')) && eq(get(registrant, 'registrationId'), get(beforeRegistrant, 'registrationId')),
        'An existing registration cannot change its person or event.');
      const previousStatus = get(beforeRegistrant, 'status'), currentStatus = get(registrant, 'status');
      if (!eq(currentStatus, previousStatus)) {
        const allowed = new PyDict([['awaiting-approval', new Set(['pending'])], ['pending', new Set(['registered'])], ['paid', new Set(['registered'])]]);
        need(has(allowed.get(previousStatus, new Set()), currentStatus), 'Invalid registration progression.');
        need(!eq(currentStatus, 'registered') || truthy(get(registrant, 'consent')), 'Consent is required before confirming a place.');
      }
      need(!truthy(get(beforeRegistrant, 'consent')) || truthy(get(registrant, 'consent')), 'Received consent cannot be silently removed.');
      const oldPayments = get(beforeRegistrant, 'payments', []), payments = get(registrant, 'payments', []);
      need(isList(payments) && eq(payments.slice(0, len(oldPayments)), oldPayments), 'Registration payment history is immutable.');
      const addedPayments = payments.slice(len(oldPayments));
      need(addedPayments.length <= 1 && addedPayments.every(item => eq(get(item, 'by'), K(u, 'id')))
        && Math.abs(float(get(registrant, 'paid', 0)) - float(get(beforeRegistrant, 'paid', 0)) - sum(addedPayments.map(item => K(item, 'amount')))) < 0.001,
        'Payment changes require a matching audit entry.');
    }
  }
  for (const [formId, count] of addedByForm.entries()) {
    const form = currentForms.get(formId);
    need(ge(get(form, 'cap', 0), get(form, 'taken', 0)) &&
      ge(get(form, 'taken', 0), add(get(oldForms.get(formId, {}), 'taken', 0), count)),
      'Registration capacity or participant count is inconsistent.');
  }
  if (has(changes, 'CHECKIN')) {
    for (const key of ['rows', 'present', 'expected', 'awaitingGuardian', 'room', 'session', 'sessionAr']) {
      need(eq(get(K(d, 'CHECKIN'), key), get(K(old, 'CHECKIN'), key)), 'Legacy check-in data is preserved; select an event for new check-ins.');
    }
  }
  if (has(changes, 'GROUP_DETAIL')) {
    for (const [gid, detail] of items(K(d, 'GROUP_DETAIL'))) {
      const currentMembers = set(iter(get(detail, 'roster', [])).map(member => K(member, 'p')));
      const oldDetail = get(K(old, 'GROUP_DETAIL'), gid, {});
      const earlier = keyed(get(oldDetail, 'meetings', []), meeting => get(meeting, 'id'));
      for (const meeting of iter(get(detail, 'meetings', []))) {
        const previousIds = set(get(earlier.get(get(meeting, 'id'), {}), 'attendance', {}));
        const addedIds = difference(set(get(meeting, 'attendance', {})), previousIds);
        need(subset(addedIds, currentMembers), 'New attendance may be recorded only for current group members.');
        const previousParticipants = set(get(earlier.get(get(meeting, 'id'), {}), 'participants', []));
        const addedParticipants = difference(set(get(meeting, 'participants', [])), previousParticipants);
        need(subset(addedParticipants, currentMembers), 'New meeting participants must be current group members.');
      }
      const earlierMilestones = keyed(get(oldDetail, 'milestones', []), item => get(item, 'id'));
      for (const item of iter(get(detail, 'milestones', []))) {
        const previousIds = set(get(earlierMilestones.get(get(item, 'id'), {}), 'completions', {}));
        const addedIds = difference(set(get(item, 'completions', {})), previousIds);
        need(subset(addedIds, currentMembers), 'New formation completions require current group members.');
      }
    }
  }
  /* Register lifecycle and immutable history only change through the workflow API. */
  const previous = keyed(K(old, 'SACRAMENTS'), s => K(s, 'id'));
  const current = keyed(K(d, 'SACRAMENTS'), s => K(s, 'id'));
  need(previous.keys().every(key => current.has(key)), 'Register entries cannot be deleted.');
  for (const [sid, s] of current.entries()) {
    if (previous.has(sid)) {
      need(eq(s, previous.get(sid)), 'Use the approval or correction workflow to change a register entry.');
    } else {
      need(eq(get(s, 'kind'), 'certificate') && has(new Set(['draft', 'scheduled', 'awaiting-signature']), get(s, 'status')),
        'Create sacrament requests through the review process.');
      need(![...PROTECTED].filter(k => k !== 'status' && k !== 'revision').some(k => truthy(get(s, k))), 'Approval metadata is server-managed.');
      if (eq(get(s, 'kind'), 'certificate')) {
        const source = previous.get(get(s, 'sourceRecordId'));
        need(source !== null && !eq(K(source, 'kind'), 'certificate') && eq(K(source, 'person'), get(s, 'person'))
          && has(new Set(['registered', 'issued']), K(source, 'status')), 'Choose an official register entry for the certificate request.');
      }
      Object.assign(s, { history: [], revision: 1 });
    }
  }
  const earlierServices = keyed(K(old, 'SERVICE_REQUESTS'), item => K(item, 'id'));
  const nextService = new PyDict([['pending', new Set(['approved', 'rejected'])], ['approved', new Set(['preparing'])],
    ['preparing', new Set(['ready'])], ['ready', new Set(['celebrated'])]]);
  for (const request of iter(K(d, 'SERVICE_REQUESTS'))) {
    const before = earlierServices.get(K(request, 'id'));
    if (before === null) {
      need(eq(K(request, 'status'), 'pending') && truthy(get(request, 'by')) && truthy(get(request, 'time'))
        && truthy(strip(get(request, 'contact', ''))) && truthy(strip(get(request, 'purpose', ''))),
        'New service requests need a requester, date, time, contact, and purpose.');
      need(!truthy(get(request, 'history')), 'New service requests cannot contain approval history.');
    } else {
      need(eq(get(request, 'history', []), get(before, 'history', [])) || !eq(get(before, 'status'), get(request, 'status')),
        'Service approval history is immutable.');
    }
    if (truthy(before) && !eq(get(before, 'status'), get(request, 'status'))) {
      need(has(nextService.get(K(before, 'status'), new Set()), K(request, 'status')), 'Invalid service request progression.');
      need(CLERGY.has(role), 'Priest approval is required.', 403);
      const history = get(request, 'history', []);
      need(isList(history) && history.length === add(len(get(before, 'history', [])), 1)
        && eq(history.slice(0, -1), get(before, 'history', [])) && eq(get(K(history, -1), 'status'), K(request, 'status'))
        && eq(get(K(history, -1), 'by'), K(u, 'person_id')), 'Service transition requires an audit entry.');
      if (eq(K(request, 'status'), 'ready') && has(new Set(['baptism', 'wedding']), lower(get(request, 'kind', '')))) {
        const required = lower(K(request, 'kind')) === 'baptism'
          ? ['Parents’ marriage certificate', 'Godparent baptism certificate', 'Preparation session attended']
          : ['Baptism certificates, both', 'Freedom-to-marry declaration', 'Pre-marriage course', 'Civil file reference'];
        need(required.every(item => truthy(get(get(request, 'documents', {}), item))), 'Complete the missing preparation requirements first.');
      }
      if (eq(K(request, 'status'), 'celebrated')) {
        need(isoDate(get(request, 'celebratedAt')) && le(K(request, 'celebratedAt'), TODAY()),
          'Record the actual celebration date, today or earlier.');
      }
    }
  }
  if (role === 'leader' && has(changes, 'GROUP_DETAIL')) {
    for (const group of iter(K(d, 'GROUPS'))) {
      const gid = K(group, 'id');
      if (has(changes.GROUP_DETAIL, gid)) {
        const beforeCount = len(get(get(K(old, 'GROUP_DETAIL'), gid, {}), 'roster', []));
        const afterCount = len(get(get(K(d, 'GROUP_DETAIL'), gid, {}), 'roster', []));
        group.members = Math.max(0, int(get(group, 'members', 0)) + afterCount - beforeCount);
      }
    }
  }
  const formerGroups = keyed(K(old, 'GROUPS'), item => K(item, 'id'));
  const roleChanges = [];
  for (const group of iter(K(d, 'GROUPS'))) {
    const former = formerGroups.get(K(group, 'id'));
    if (!truthy(former)) continue;
    for (const field of ['leader', 'assistant']) {
      if (eq(get(former, field), get(group, field))) continue;
      need(CLERGY.has(role) || role === 'secretary', 'Parish office approval is required for leadership changes.', 403);
      const detail = get(K(d, 'GROUP_DETAIL'), K(group, 'id'), {});
      need(!truthy(get(group, field)) || has(set(iter(get(detail, 'roster', [])).map(r => get(r, 'p'))), K(group, field)),
        'Leader and assistant must be in the group roster.');
      if (field === 'leader') {
        need(get(group, 'leader'), 'A group needs a leader.');
        need(!eq(get(detail, 'history', []), get(get(K(old, 'GROUP_DETAIL'), K(group, 'id'), {}), 'history', [])),
          'Record a leadership handover in the group history.');
      }
      roleChanges.push([field, K(group, 'id'), get(former, field), get(group, field)]);
    }
  }
  if (!CLERGY.has(role)) {
    for (const key of ['RESERVATIONS', 'EXPENSES', 'SERVICE_REQUESTS']) {
      const earlier = keyed(K(old, key), x => K(x, 'id'));
      for (const x of iter(K(d, key))) {
        if (has(new Set(['approved', 'preparing', 'ready', 'celebrated', 'rejected']), get(x, 'status'))) {
          need(earlier.has(K(x, 'id')) && eq(get(earlier.get(K(x, 'id')), 'status'), K(x, 'status')), 'Priest approval is required.', 403);
        }
      }
    }
  }
  d = migrate_state(d);
  validate(d);
  await sync_relationships(c, pid, d);
  /* Account roles changed here are kept in `roles` so the reads below see them,
     as they would inside server.py's transaction. */
  let roles = null;
  if (roleChanges.length) {
    const accounts = await c.all('SELECT * FROM users WHERE id IN (SELECT user_id FROM assignments WHERE parish_id=?)', pid);
    roles = new Map(accounts.map(account => [account.id, account.role]));
    for (const [field, groupId, outgoing, incoming] of roleChanges) {
      if (truthy(incoming)) {
        c.run("UPDATE users SET role='leader' WHERE role='member' AND person_id=? AND id IN (SELECT user_id FROM assignments WHERE parish_id=?)", incoming, pid);
        for (const account of accounts) if (roles.get(account.id) === 'member' && eq(account.person_id, incoming)) roles.set(account.id, 'leader');
      }
      for (const account of accounts.filter(a => roles.get(a.id) === 'leader' && eq(a.person_id, outgoing))) {
        let otherLeadership = false;
        const assigned = await c.all('SELECT parish_id FROM assignments WHERE user_id=?', account.id);
        for (const parishRow of assigned) {
          let state = d;
          if (parishRow.parish_id !== pid) {
            const other = await c.first('SELECT data FROM states WHERE parish_id=?', parishRow.parish_id);
            if (other === null) throw new PyError("'NoneType' object is not subscriptable");
            state = JSON.parse(other.data);
          }
          if (any(K(state, 'GROUPS'), item => has(set([get(item, 'leader'), get(item, 'assistant')]), account.person_id))) {
            otherLeadership = true;
            break;
          }
        }
        if (!otherLeadership) {
          c.run("UPDATE users SET role='member' WHERE id=?", account.id);
          roles.set(account.id, 'member');
        }
      }
      audit(c, u, pid, field === 'leader' ? 'Leadership handover' : 'Group assistant changed', { group: groupId, from: outgoing, to: incoming });
    }
  }
  c.run('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?', dumps(d), pid);
  if (has(changes, 'GROUP_DETAIL')) await notify_meeting_changes(c, pid, old, d, roles);
  audit(c, u, pid, 'Records updated', { collections: Object.keys(changes) });
  return row.revision + 1;
}
const lower = value => {
  if (!isStr(value)) throw new PyError("object has no attribute 'lower'");
  return value.toLowerCase();
};

export function audit(c, u, pid, action, detail) {
  c.run('INSERT INTO audit(parish_id,actor,at,action,detail) VALUES(?,?,?,?,?)', pid, K(u, 'id'), NOW(), action, dumps(detail));
}

/* ---- member notifications used by staff saves ----------------------------- */
export async function memberPrivateRows(c, pid, userIds) {
  const ids = [...new Set(userIds)];
  const out = new Map();
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    const rows = await c.all(`SELECT user_id,data FROM member_private WHERE parish_id=? AND user_id IN (${chunk.map(() => '?').join(',')})`, pid, ...chunk);
    for (const row of rows) out.set(row.user_id, row.data);
  }
  return out;
}
export function privateData(text) {
  const data = text === undefined || text === null ? {} : JSON.parse(text);
  for (const [key, dflt] of [['notes', []], ['todos', []], ['concernIds', []], ['rsvp', {}], ['commitments', {}], ['readIds', []], ['archivedIds', []],
    ['preferences', { email: true, inSystem: true, meetings: true, announcements: true, messages: true }]]) setdefault(data, key, dflt);
  return data;
}
/* notify_member(); `privateText` is the recipient's member_private data, already read. */
export function notify_member(c, pid, userId, kind, title, body, route, privateText) {
  const prefs = privateText === undefined || privateText === null ? {} : get(JSON.parse(privateText), 'preferences', {});
  if (get(prefs, 'inSystem', true) === false) return;
  if (kind === 'announcement' && get(prefs, 'announcements', true) === false) return;
  if (kind === 'message' && get(prefs, 'messages', true) === false) return;
  c.run('INSERT INTO member_notifications VALUES(?,?,?,?,?,?,?,?,?)', tokenHex(12), pid, userId, kind, title, slice(body, 0, 300), route, NOW(), null);
}

export async function notify_meeting_changes(c, pid, old, current, roles = null) {
  const accounts = new Map();
  const rows = roles
    ? (await c.all('SELECT u.id,u.person_id FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=?', pid)).filter(row => roles.get(row.id) === 'member')
    : await c.all("SELECT u.id,u.person_id FROM users u JOIN assignments a ON a.user_id=u.id WHERE a.parish_id=? AND u.role='member'", pid);
  for (const row of rows) {
    if (truthy(row.person_id)) {
      if (!accounts.has(row.person_id)) accounts.set(row.person_id, []);
      accounts.get(row.person_id).push(row.id);
    }
  }
  if (!accounts.size) return;
  const privateRows = await memberPrivateRows(c, pid, [...accounts.values()].flat());
  const today = TODAY();
  for (const group of iter(K(current, 'GROUPS'))) {
    const gid = K(group, 'id');
    const before = keyed(get(get(K(old, 'GROUP_DETAIL'), gid, {}), 'meetings', []), m => K(m, 'id'));
    const after = keyed(get(get(K(current, 'GROUP_DETAIL'), gid, {}), 'meetings', []), m => K(m, 'id'));
    const members = set(iter(get(get(K(current, 'GROUP_DETAIL'), gid, {}), 'roster', [])).map(r => get(r, 'p')));
    for (const mid of union(set(before.keys()), set(after.keys()))) {
      const previous = before.get(mid), meeting = after.get(mid);
      if (eq(previous, meeting)) continue;
      const subject = or(meeting, previous);
      if (!truthy(subject)) continue;
      const title = truthy(get(subject, 'title')) ? get(subject, 'title') : add(K(group, 'name'), ' meeting');
      const details = strip(add(add(get(subject, 'd', ''), ' '), get(subject, 't', '')));
      const invitees = intersection(set(or(get(subject, 'participants'), members)), members);
      for (const personId of invitees) {
        for (const userId of accounts.get(personId) ?? []) {
          const preferences = privateData(privateRows.get(userId)).preferences;
          if (ge(get(subject, 'd', ''), today) && truthy(get(preferences, 'meetings', true))) {
            if (meeting === null) notify_member(c, pid, userId, 'meeting', add('Meeting cancelled: ', title), details, 'mymeetings', privateRows.get(userId));
            else if (previous === null) notify_member(c, pid, userId, 'meeting', add('New meeting: ', title), details, 'mymeetings', privateRows.get(userId));
            else if (['title', 'd', 't', 'place', 'location', 'description'].some(k => !eq(get(previous, k), get(meeting, k))))
              notify_member(c, pid, userId, 'meeting', add('Meeting changed: ', title), details, 'mymeetings', privateRows.get(userId));
          }
          const oldAttendance = get(get(or(previous, {}), 'attendance', {}), personId);
          const newAttendance = get(get(or(meeting, {}), 'attendance', {}), personId);
          if (!eq(oldAttendance, newAttendance) && truthy(newAttendance))
            notify_member(c, pid, userId, 'attendance', add('Attendance recorded: ', title), str(newAttendance), 'myattendance', privateRows.get(userId));
        }
      }
    }
  }
}

/* ---- sacrament workflow -------------------------------------------------- */
const fromiso = (value, message) => {
  try { return fromisoformat(value); } catch (error) {
    if (error instanceof PyError) throw new Problem(400, message);
    throw error;
  }
};
const nextNumber = (sacraments, prefix) => {
  const numbers = iter(sacraments).filter(x => str(get(x, 'reg', '')).startsWith(prefix) && isdigit(str(slice(K(x, 'reg'), prefix.length))))
    .map(x => int(slice(K(x, 'reg'), prefix.length)));
  return Math.max(...(numbers.length ? numbers : [0])) + 1;
};

export async function workflow(c, u, pid, q) {
  await access(c, u, pid);
  need(CLERGY.has(K(u, 'role')) || K(u, 'role') === 'secretary', 'Office access required.', 403);
  const row = await c.first('SELECT * FROM states WHERE parish_id=?', pid);
  if (row === null) throw new PyError("'NoneType' object is not subscriptable");
  need(eq(get(q, 'revision'), row.revision), 'Record changed. Reload before continuing.', 409);
  let d = JSON.parse(row.data);
  const action = get(q, 'action'), sid = get(q, 'id');
  let s = next(K(d, 'SACRAMENTS'), x => eq(K(x, 'id'), sid));
  const at = NOW();
  const by = K(u, 'name');
  const history = (target, entry) => setdefault(target, 'history', []).push(entry);
  const clergy = CLERGY.has(K(u, 'role'));
  if (action === 'create-sacrament-request') {
    need(s === null && isStr(sid) && sid.startsWith('sc') && len(sid) <= 48, 'Choose a unique request reference.');
    need(has(new Set(['baptism', 'confirmation', 'communion', 'marriage', 'funeral']), get(q, 'kind')), 'Choose a sacrament.');
    const child = get(q, 'child');
    let personId;
    if (child !== null) {
      need(eq(K(q, 'kind'), 'baptism') && isDict(child), 'Manual child details are for baptism requests only.');
      need(all(['lat', 'ar'], k => isStr(get(child, k)) && len(strip(K(child, k))) > 0 && len(strip(K(child, k))) <= 120),
        'Enter the child’s English and Arabic names.');
      const born = get(child, 'born');
      need(isStr(born) && le(fromiso(born, 'Enter a valid birth date.'), fromisoformat(localToday())), 'Enter a valid birth date.');
      for (const key of ['father', 'mother']) need(isStr(get(child, key, '')) && len(get(child, key, '')) <= 120, 'Parent name is too long.');
      need(!add(K(d, 'PEOPLE'), K(d, 'ARCHIVED')).some(p => casefold(strip(K(p, 'lat'))) === casefold(strip(K(child, 'lat'))) && eq(get(p, 'born'), born)),
        'A person with this name and birth date already exists. Choose the existing record.');
      personId = 'p' + tokenHex(8);
      K(d, 'PEOPLE').push({ id: personId, lat: strip(K(child, 'lat')), ar: strip(K(child, 'ar')), born,
        phone: '—', town: '', townAr: '', rite: 'Maronite', status: 'member', hh: null, tags: [] });
      setItem(K(d, 'PERSON_EXTRA'), personId, { skills: [], dates: [], occupation: '' });
    } else {
      personId = get(q, 'person');
      need(any(K(d, 'PEOPLE'), p => eq(K(p, 'id'), personId)), 'Choose a parishioner.');
    }
    need(!iter(K(d, 'SACRAMENTS')).some(x => eq(K(x, 'id'), sid)), 'Request already exists.');
    const requestedDate = strip(str(or(get(q, 'date'), '')));
    if (truthy(requestedDate)) fromiso(requestedDate, 'Enter a valid preferred date.');
    const notes = strip(str(or(get(q, 'notes'), '')));
    need(len(notes) <= 500, 'Keep request notes within 500 characters.');
    const prefix = `SRQ/${TODAY().slice(0, 4)}/`;
    const number = nextNumber(K(d, 'SACRAMENTS'), prefix);
    K(d, 'SACRAMENTS').unshift({ id: sid, kind: K(q, 'kind'), reg: `${prefix}${pad3(number)}`,
      person: personId, father: child !== null ? strip(get(child, 'father', '')) : '', mother: child !== null ? strip(get(child, 'mother', '')) : '',
      date: requestedDate, requestedDate, requestedAt: at, requestNotes: notes,
      status: 'requested', preparation: [], history: [{ action: 'sacrament requested', by, at }], revision: 1 });
  } else if (action === 'review-sacrament-request') {
    need(s !== null && !eq(get(s, 'kind'), 'certificate') && eq(K(s, 'status'), 'requested'), 'Only a new sacrament request can be reviewed by the office.');
    s.status = 'office-reviewed';
    history(s, { action: 'office review completed', by, at });
  } else if (action === 'approve-sacrament-request') {
    need(clergy, 'Only a priest can accept a sacrament request.', 403);
    need(s !== null && !eq(get(s, 'kind'), 'certificate') && has(new Set(['requested', 'office-reviewed']), K(s, 'status')),
      'This request is no longer awaiting priest approval.');
    s.status = 'preparing';
    Object.assign(s, { requestApprovedBy: by, requestApprovedAt: at });
    history(s, { action: 'request accepted for preparation', by, at });
  } else if (action === 'decline-sacrament-request') {
    need(clergy, 'Only a priest can decline a sacrament request.', 403);
    need(s !== null && !eq(get(s, 'kind'), 'certificate') && has(new Set(['requested', 'office-reviewed']), K(s, 'status')),
      'This request is no longer awaiting priest approval.');
    const reason = strip(str(or(get(q, 'reason'), '')));
    need(len(reason) > 0 && len(reason) <= 500, 'Enter a reason for declining this request.');
    s.status = 'rejected';
    history(s, { action: 'request declined', by, at, reason });
  } else if (action === 'propose-request-amendment') {
    need(s !== null && !eq(get(s, 'kind'), 'certificate') && truthy(get(s, 'requestApprovedAt'))
      && has(new Set(['preparing', 'scheduled', 'draft', 'awaiting-signature']), K(s, 'status')), 'Only an accepted sacrament request can be amended.');
    need(!truthy(get(s, 'pendingAmendment')), 'Review the pending amendment first.');
    const date = get(q, 'date', '');
    need(isStr(date), 'Invalid requested date.');
    if (truthy(date)) fromiso(date, 'Enter a valid requested date.');
    const notes = get(q, 'notes', ''), reason = get(q, 'reason', '');
    need(isStr(notes) && len(notes) <= 500 && isStr(reason) && len(strip(reason)) > 0 && len(strip(reason)) <= 500,
      'Enter an amendment reason and keep notes within 500 characters.');
    need(!eq(date, get(s, 'requestedDate', '')) || !eq(strip(notes), get(s, 'requestNotes', '')), 'No request details changed.');
    s.pendingAmendment = { date, notes: strip(notes), reason: strip(reason), by, at };
    history(s, { action: 'request amendment proposed', by, at, reason: strip(reason) });
  } else if (action === 'approve-request-amendment' || action === 'reject-request-amendment') {
    need(clergy, 'Only a priest can decide a request amendment.', 403);
    need(s !== null && truthy(get(s, 'pendingAmendment')), 'There is no pending amendment.');
    const amendment = s.pendingAmendment;
    delete s.pendingAmendment;
    if (action === 'approve-request-amendment') {
      const before = { date: get(s, 'requestedDate', ''), notes: get(s, 'requestNotes', '') };
      Object.assign(s, { requestedDate: K(amendment, 'date'), requestNotes: K(amendment, 'notes') });
      history(s, { action: 'request amendment approved', by, at, reason: K(amendment, 'reason'), before,
        after: { date: K(amendment, 'date'), notes: K(amendment, 'notes') } });
    } else {
      history(s, { action: 'request amendment rejected', by, at, reason: slice(str(or(get(q, 'reason'), '')), 0, 500) });
    }
  } else if (action === 'update-preparation') {
    need(s !== null && !eq(get(s, 'kind'), 'certificate') && has(new Set(['preparing', 'scheduled']), K(s, 'status')), 'Only accepted preparations can be edited.');
    const checklist = get(q, 'checklist');
    const requirements = get(get(d, 'PREP_REQUIREMENTS', {}), K(s, 'kind'), []);
    need(isList(checklist) && checklist.length === len(requirements) && checklist.every(value => isBool(value)), 'Complete the preparation checklist.');
    const date = strip(str(or(get(q, 'date'), '')));
    if (truthy(date)) fromiso(date, 'Enter a valid celebration date.');
    s.date = date;
    s.preparation = checklist;
    if (eq(K(s, 'status'), 'scheduled') && (!truthy(date) || iter(requirements).some((item, index) => truthy(K(item, 2)) && !truthy(K(checklist, index)))))
      s.status = 'preparing';
    s.revision = add(get(s, 'revision', 1), 1);
    history(s, { action: 'preparation updated', by, at });
  } else if (action === 'complete-preparation') {
    need(s !== null && !eq(get(s, 'kind'), 'certificate') && eq(K(s, 'status'), 'preparing'), 'Only active preparation can be completed.');
    const requirements = get(get(d, 'PREP_REQUIREMENTS', {}), K(s, 'kind'), []);
    need(truthy(get(s, 'date')) && len(get(s, 'preparation', [])) === len(requirements)
      && iter(requirements).every((item, index) => !truthy(K(item, 2)) || truthy(K(K(s, 'preparation'), index))),
      'Set a celebration date and complete every required preparation item.');
    s.status = 'scheduled';
    history(s, { action: 'preparation completed', by, at });
  } else if (action === 'cancel-preparation') {
    need(s !== null && !eq(get(s, 'kind'), 'certificate') && has(new Set(['preparing', 'scheduled']), K(s, 'status')), 'Only active preparation can be cancelled.');
    const reason = strip(str(or(get(q, 'reason'), '')));
    need(len(reason) > 0 && len(reason) <= 500, 'Enter a cancellation reason.');
    s.status = 'cancelled';
    history(s, { action: 'preparation cancelled', by, at, reason });
  } else if (action === 'update-entry') {
    need(s !== null && !eq(get(s, 'kind'), 'certificate') && has(new Set(['draft', 'scheduled']), get(s, 'status')),
      'Only a planned or unsubmitted sacrament can be edited. Approved entries need a correction request.');
    const fields = get(q, 'fields');
    const allowed = new Set(['date', 'celebrant', 'godparents', 'book', 'page', 'father', 'mother', 'place', 'externalParish', 'externalReference']);
    need(isDict(fields) && truthy(fields) && subset(set(fields), allowed), 'Choose editable sacrament details.');
    for (const [key, value] of Object.entries(fields)) {
      need(isStr(value) && len(value) <= 500, 'Invalid sacrament detail.');
      if (key === 'date') fromiso(value, 'Enter a valid celebration date.');
      if (key === 'celebrant' && truthy(value))
        need(any(K(d, 'PEOPLE'), p => eq(K(p, 'id'), value) && eq(get(p, 'status'), 'clergy')), 'Choose a parish celebrant.');
      s[key] = strip(value);
    }
    /* Editing the plan must not silently mark an uncelebrated sacrament as celebrated. */
    s.status = eq(K(s, 'status'), 'scheduled') || gt(slice(str(K(s, 'date')), 0, 10), TODAY()) ? 'scheduled' : 'draft';
    s.revision = add(get(s, 'revision', 1), 1);
    history(s, { action: 'details updated', by, at, fields: sorted(Object.keys(fields)) });
  } else if (action === 'create-certificate-request') {
    const personId = get(q, 'person');
    need(any(K(d, 'PEOPLE'), p => eq(K(p, 'id'), personId)), 'Choose a parishioner for the request.');
    const purpose = strip(str(get(q, 'purpose', '')));
    need(len(purpose) > 0 && len(purpose) <= 500, 'Enter a purpose of 500 characters or less.');
    const sourceId = or(get(q, 'sourceRecordId'), null);
    const plannedId = or(get(q, 'requestedSacramentId'), null);
    need(!(truthy(sourceId) && truthy(plannedId)), 'Choose either an official entry or a scheduled sacrament.');
    const source = truthy(sourceId) ? next(K(d, 'SACRAMENTS'), x => eq(K(x, 'id'), sourceId)) : null;
    const planned = truthy(plannedId) ? next(K(d, 'SACRAMENTS'), x => eq(K(x, 'id'), plannedId)) : null;
    if (truthy(sourceId)) {
      need(source !== null && !eq(K(source, 'kind'), 'certificate') && eq(K(source, 'person'), personId)
        && has(new Set(['registered', 'issued']), K(source, 'status')), 'Choose an official entry for this parishioner.');
    }
    if (truthy(plannedId)) {
      need(planned !== null && !eq(K(planned, 'kind'), 'certificate') && eq(K(planned, 'person'), personId)
        && has(new Set(['requested', 'office-reviewed', 'preparing', 'draft', 'scheduled', 'awaiting-signature']), K(planned, 'status')),
        'Choose a pending sacrament for this parishioner.');
    }
    const requestId = str(get(q, 'requestId', ''));
    need(eq(requestId, sid) && requestId.startsWith('sc') && len(requestId) <= 48
      && !iter(K(d, 'SACRAMENTS')).some(x => eq(K(x, 'id'), requestId)), 'Invalid or duplicate request reference.');
    const year = TODAY().slice(0, 4);
    const prefix = `REQ/${year}/`;
    const number = nextNumber(K(d, 'SACRAMENTS'), prefix);
    const requestHistory = [{ action: 'request submitted', by, at }];
    if (truthy(source)) requestHistory.push({ action: 'submitted for clergy review', by, at });
    const celebrant = or(get(or(source, planned, {}), 'celebrant'), null);
    K(d, 'SACRAMENTS').unshift({ id: requestId, kind: 'certificate', kindAr: 'طلب شهادة',
      reg: `${prefix}${pad3(number)}`, person: personId, date: TODAY(),
      celebrant: truthy(celebrant) ? celebrant : or(K(u, 'person_id'), ''),
      status: truthy(source) ? 'awaiting-signature' : 'draft', sourceRecordId: sourceId, requestedSacramentId: plannedId,
      purpose, godparents: '', history: requestHistory, revision: 1 });
  } else if (['submit', 'approve', 'issue', 'reject', 'cancel'].includes(action)) {
    need(s !== null, 'Register entry not found.', 404);
    if (action === 'cancel') {
      need(eq(get(s, 'kind'), 'certificate') && has(new Set(['draft', 'awaiting-signature']), K(s, 'status')),
        'Only an open certificate request can be cancelled.');
      const reason = strip(str(get(q, 'reason', '')));
      need(len(reason) > 0 && len(reason) <= 500, 'Enter a cancellation reason of 500 characters or less.');
      s.status = 'cancelled';
      history(s, { action: 'cancelled', by, at, reason });
    } else {
      let reason;
      if ((action === 'approve' || action === 'issue') && eq(get(s, 'kind'), 'certificate')) {
        const source = next(K(d, 'SACRAMENTS'), x => eq(K(x, 'id'), get(s, 'sourceRecordId')));
        need(source !== null && eq(K(source, 'person'), K(s, 'person')) && has(new Set(['registered', 'issued']), K(source, 'status')),
          'Link an official register entry for this person before approving the certificate request.');
      }
      if (action === 'submit') {
        need(has(new Set(['draft', 'scheduled']), K(s, 'status')), 'This entry is already submitted.');
        const wasScheduled = eq(K(s, 'status'), 'scheduled');
        if (eq(get(s, 'kind'), 'certificate')) {
          const source = next(K(d, 'SACRAMENTS'), x => eq(K(x, 'id'), get(s, 'sourceRecordId')));
          need(source !== null && eq(K(source, 'person'), K(s, 'person')) && has(new Set(['registered', 'issued']), K(source, 'status')),
            'An official register entry must be linked before priest review.');
        } else {
          need(le(slice(str(K(s, 'date')), 0, 10), TODAY()), 'Wait until the celebration date before submitting the register entry.');
        }
        s.status = 'awaiting-signature';
        if (!eq(get(s, 'kind'), 'certificate') && wasScheduled) history(s, { action: 'sacrament celebrated', by, at });
      } else {
        need(clergy, 'Only the assigned parish priest can approve and issue.', 403);
        need(get(q, 'verified') === true, 'Confirm that you checked the original register.');
        if (action === 'approve' || action === 'reject') {
          need(eq(K(s, 'status'), 'awaiting-signature'), 'This entry is not awaiting approval.');
          need(eq(get(s, 'kind'), 'certificate') || le(slice(str(K(s, 'date')), 0, 10), TODAY()), 'A future sacrament cannot yet be approved.');
          if (action === 'reject') {
            reason = strip(str(get(q, 'reason', '')));
            need(len(reason) > 0 && len(reason) <= 500, 'Enter a rejection reason of 500 characters or less.');
          }
          s.status = action === 'approve' ? (eq(get(s, 'kind'), 'certificate') ? 'approved' : 'registered') : 'rejected';
          if (action === 'approve' && !eq(get(s, 'kind'), 'certificate') && K(s, 'reg').startsWith('SRQ/')) {
            const prefixes = new PyDict([['baptism', 'B'], ['confirmation', 'K'], ['communion', 'C'], ['marriage', 'M'], ['funeral', 'F']]);
            if (!prefixes.has(K(s, 'kind'))) throw new PyError('KeyError');
            const prefix = `${prefixes.get(K(s, 'kind'))}/${slice(str(K(s, 'date')), 0, 4)}/`;
            const number = nextNumber(K(d, 'SACRAMENTS'), prefix);
            s.requestReference = K(s, 'reg');
            s.reg = `${prefix}${pad3(number)}`;
          }
          if (action === 'approve') Object.assign(s, { approvedBy: by, approvedAt: at });
          else Object.assign(s, { reviewedBy: by, reviewedAt: at });
          if (action === 'approve' && !eq(get(s, 'kind'), 'certificate')) {
            for (const request of iter(K(d, 'SACRAMENTS'))) {
              if (eq(get(request, 'kind'), 'certificate') && eq(get(request, 'requestedSacramentId'), K(s, 'id'))
                && eq(get(request, 'status'), 'draft') && !truthy(get(request, 'sourceRecordId'))) {
                request.sourceRecordId = K(s, 'id');
                history(request, { action: 'source linked', by, at, source: K(s, 'reg') });
              }
            }
          }
        } else {
          need(eq(get(s, 'kind'), 'certificate') && eq(K(s, 'status'), 'approved'), 'Approve a certificate request before issuing it.');
          Object.assign(s, { status: 'issued', issuedBy: by, issuedAt: at });
        }
      }
      const entry = { action, by, at };
      if (action === 'reject') entry.reason = reason;
      history(s, entry);
    }
  } else if (action === 'link-source') {
    need(s !== null && eq(get(s, 'kind'), 'certificate') && has(new Set(['draft', 'scheduled', 'awaiting-signature']), K(s, 'status')),
      'Only an open certificate request can be linked.');
    const source = next(K(d, 'SACRAMENTS'), x => eq(K(x, 'id'), get(q, 'sourceRecordId')));
    need(source !== null && !eq(K(source, 'kind'), 'certificate') && eq(K(source, 'person'), K(s, 'person')) && has(new Set(['registered', 'issued']), K(source, 'status')),
      'Choose an official register entry for this person.');
    const prior = get(s, 'sourceRecordId');
    s.sourceRecordId = K(source, 'id');
    history(s, { action: 'source linked', by, at, source: K(source, 'reg'), priorSource: prior });
  } else if (action === 'correction-request') {
    need(s !== null, 'Register entry not found.', 404);
    need(!eq(get(s, 'kind'), 'certificate') && has(new Set(['approved', 'registered', 'issued']), get(s, 'status')),
      'Corrections apply to approved register entries. Edit or reject an entry before approval.');
    const field = get(q, 'field');
    need(has(new Set(['date', 'godparents', 'book', 'page', 'externalReference', 'externalParish', 'father', 'mother', 'place']), field), 'Unsupported correction field.');
    need(truthy(strip(str(get(q, 'reason', '')))) && truthy(strip(str(get(q, 'value', '')))), 'A replacement and a reason are required.');
    K(d, 'CORRECTIONS').push({ id: tokenHex(12), sacrament: sid, reg: K(s, 'reg'), field, fieldAr: field,
      from: get(s, field, ''), to: K(q, 'value'), reason: K(q, 'reason'), by, at, status: 'awaiting-approval', baseRevision: get(s, 'revision', 1) });
  } else if (action === 'correction-approve' || action === 'correction-reject') {
    need(clergy, 'Priest approval is required.', 403);
    const cor = next(K(d, 'CORRECTIONS'), x => eq(K(x, 'id'), sid));
    need(cor !== null && eq(K(cor, 'status'), 'awaiting-approval'), 'Correction is not awaiting review.');
    s = next(K(d, 'SACRAMENTS'), x => eq(K(x, 'id'), get(cor, 'sacrament')));
    need(s !== null, 'Legacy correction has no linked entry. Create a linked correction request first.');
    if (action === 'correction-approve') {
      need(eq(K(cor, 'baseRevision'), get(s, 'revision', 1)) && eq(get(s, K(cor, 'field'), ''), K(cor, 'from')),
        'Entry changed since the correction request. Submit a new request.', 409);
      setdefault(s, 'original', deepcopy(s));
      setItem(s, K(cor, 'field'), K(cor, 'to'));
      s.revision = add(get(s, 'revision', 1), 1);
      history(s, { action: 'correction', by, at, correction: K(cor, 'id') });
    }
    Object.assign(cor, { status: action.endsWith('approve') ? 'approved' : 'rejected', approver: by, reviewedAt: at });
  } else {
    throw new Problem(400, 'Unknown workflow action.');
  }
  d = migrate_state(d);
  validate(d);
  await sync_relationships(c, pid, d);
  c.run('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?', dumps(d), pid);
  audit(c, u, pid, action, q);
}
