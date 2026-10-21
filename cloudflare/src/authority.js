/* Organisation, roles and permissions, ported from server.py.
   Diocese → parishes → ministries. Access comes from role assignments scoped to the whole
   system, one diocese or one parish; one account can hold several, in different places.
   Accounts made before this (or by tools/accounts.mjs) keep their old access until something
   new is recorded for them, when it is first copied into the new tables (materializeLegacy). */
import {
  Problem, need, get, K, isStr, iter, len, str, strip, or, sorted, tokenHex, tokenUrlsafe, NOW, localToday,
  sha256hex, passwordHash, isoDate, deepcopy, dumps
} from './py.js';
import { SEED, FINANCE, READONLY, migrate_state, validate } from './state.js';
import { audit, sync_relationships, CONCERN_CATEGORIES } from './app.js';
/* accounts.js and member.js are loaded when first needed: app.js imports this module, and those
   two read app.js's exports as they load. */

export const STAFF_ROLES = ['priest', 'parishadmin', 'secretary', 'treasurer', 'leader'];   // strongest first
export const DIOCESE_ROLES = ['bishop', 'diocesanadmin'];
const RANK = { superadmin: 0, bishop: 1, diocesanadmin: 2, priest: 3, parishadmin: 4, secretary: 5, treasurer: 5, leader: 6 };
/* The parish workspace a role opens; a parish admin works in the office workspace. */
export const WORKSPACE_ROLE = { priest: 'priest', parishadmin: 'secretary', secretary: 'secretary', treasurer: 'treasurer', leader: 'leader' };
export const ROLE_TITLES = {
  superadmin: ['Super admin', 'المدير العام'], bishop: ['Bishop', 'المطران'],
  diocesanadmin: ['Diocesan admin', 'إداري الأبرشية'], priest: ['Parish priest', 'كاهن الرعية'],
  parishadmin: ['Parish admin', 'إداري الرعية'], secretary: ['Parish secretary', 'أمانة سرّ الرعية'],
  treasurer: ['Parish treasurer', 'أمين صندوق الرعية'], leader: ['Ministry leader', 'مسؤول خدمة'],
  member: ['Parish member', 'عضو في الرعية'], follower: ['Following', 'متابِع للرعية']
};
/* code, level, English, Arabic. Fixed permissions belong to one role and are never delegated. */
export const PERMISSIONS = [
  ['people.manage', 'parish', 'People, households and person records', 'المؤمنون والعائلات وسجلات الأشخاص'],
  ['sacraments.manage', 'parish', 'Sacrament requests and preparation', 'طلبات الأسرار والتحضير'],
  ['sacraments.sign', 'parish', 'Sign official sacramental documents', 'توقيع وثائق الأسرار الرسمية'],
  ['requests.manage', 'parish', 'Online requests, forms and workflows', 'الطلبات الإلكترونية والاستمارات والمسارات'],
  ['events.manage', 'parish', 'Calendar, services, registrations and check-in', 'الرزنامة والخدم والتسجيلات والحضور'],
  ['ministries.manage', 'parish', 'Ministries, volunteers and rotas', 'الخدمات والمتطوّعون وجداول الخدمة'],
  ['facilities.manage', 'parish', 'Rooms, bookings and equipment', 'القاعات والحجوزات والمعدّات'],
  ['communications.manage', 'parish', 'Notices, broadcasts and prayer requests', 'الإعلانات والرسائل الجماعية ونوايا الصلاة'],
  ['messages.office', 'parish', 'Read and answer the parish office inbox', 'قراءة بريد مكتب الرعية والردّ عليه'],
  ['website.publish', 'parish', 'Public website content', 'محتوى الموقع العام'],
  ['finance.view', 'parish', 'See giving and finance', 'الاطّلاع على التقدمات والمالية'],
  ['finance.edit', 'parish', 'Record gifts, expenses and the exchange rate', 'تسجيل التقدمات والمصاريف وسعر الصرف'],
  ['settings.manage', 'parish', 'Parish settings and profile', 'إعدادات الرعية وملفّها'],
  ['staff.manage', 'parish', 'Appoint staff and adjust their permissions', 'تعيين العاملين وتعديل صلاحياتهم'],
  ['access.manage', 'parish', 'Deactivate and reactivate access', 'إيقاف الوصول وإعادته'],
  ['audit.view', 'parish', 'Audit trail', 'سجل التدقيق'],
  ['notes.pastoral', 'parish', 'Pastoral notes (author-private unless shared)', 'الملاحظات الرعوية (خاصة بكاتبها ما لم تُشارك)'],
  ['plans.manage', 'parish', 'The parish plan and its modules', 'خطة الرعية ووحداتها'],
  ['parishes.create', 'diocese', 'Create parishes in the diocese', 'إنشاء رعايا في الأبرشية'],
  ['clergy.assign', 'diocese', 'Clergy service assignments', 'تعيينات خدمة الإكليروس'],
  ['clergy.title', 'diocese', 'Change clergy titles', 'تغيير ألقاب الإكليروس'],
  ['diocese.staff', 'diocese', 'Appoint diocesan and parish admins', 'تعيين إداريي الأبرشية والرعايا'],
  ['documents.accept', 'diocese', 'Accept documents signed by priests', 'قبول الوثائق التي وقّعها الكهنة'],
  ['diocese.policies', 'diocese', 'Diocesan policies', 'سياسات الأبرشية'],
  ['plans.sponsor', 'diocese', 'Diocesan plan arrangements and plan change requests', 'ترتيبات الخطط الأبرشية وطلبات تغيير الخطط'],
  ['dioceses.manage', 'system', 'Create dioceses and provision bishops', 'إنشاء الأبرشيات وتجهيز حسابات المطارنة'],
  ['accounts.global', 'system', 'Deactivate accounts everywhere', 'إيقاف الحسابات في كل مكان'],
  ['messages.emergency', 'system', 'Emergency review of a reported conversation', 'المراجعة الطارئة لمحادثة مُبلَّغ عنها'],
  ['plans.configure', 'system', 'Plan options offered to parishes', 'خيارات الخطط المعروضة على الرعايا']
];
const PERMISSION_CODES = new Set(PERMISSIONS.map(p => p[0]));
/* Never granted through an adjustment, and never part of a "full access" shortcut. */
export const FIXED_PERMISSIONS = {
  'sacraments.sign': 'priest', 'notes.pastoral': 'priest', 'clergy.title': 'bishop',
  'documents.accept': 'bishop', 'diocese.policies': 'bishop', 'messages.emergency': 'superadmin'
};
const isFixed = p => Object.prototype.hasOwnProperty.call(FIXED_PERMISSIONS, p);
const PARISH_OFFICE = ['people.manage', 'sacraments.manage', 'requests.manage', 'events.manage', 'ministries.manage',
  'facilities.manage', 'communications.manage', 'messages.office', 'website.publish'];
/* Diocesan and system roles also carry parish permissions: they never open a parish's records with
   them, but they are what such an administrator may hand on when appointing a parish admin. */
const PARISH_ADMIN = [...PARISH_OFFICE, 'settings.manage', 'staff.manage', 'access.manage', 'audit.view'];
export const ROLE_TEMPLATES = {
  superadmin: ['dioceses.manage', 'accounts.global', 'messages.emergency', 'plans.configure', 'parishes.create', 'clergy.assign', 'diocese.staff', 'plans.sponsor', 'finance.view', ...PARISH_ADMIN],
  bishop: ['parishes.create', 'clergy.assign', 'clergy.title', 'diocese.staff', 'documents.accept', 'diocese.policies', 'plans.sponsor', 'finance.view', ...PARISH_ADMIN],
  diocesanadmin: ['parishes.create', 'clergy.assign', 'diocese.staff', 'plans.sponsor', ...PARISH_ADMIN],
  priest: PERMISSIONS.filter(p => p[1] === 'parish').map(p => p[0]),
  parishadmin: [...PARISH_ADMIN],
  secretary: [...PARISH_OFFICE],
  treasurer: ['finance.view', 'finance.edit'],
  leader: []
};
/* What changing each part of the parish workspace needs. Parts not listed need settings.manage. */
export const KEY_PERMS = {};
for (const k of ['PEOPLE', 'ARCHIVED', 'HOUSEHOLDS', 'FAMILIES', 'BRANCHES', 'PERSON_EXTRA', 'PHOTOS', 'DUPLICATES', 'INCIDENTS', 'EVACUATION']) KEY_PERMS[k] = 'people.manage';
KEY_PERMS.SACRAMENTS = 'sacraments.manage';
for (const k of ['PORTAL_REQUESTS', 'REQUEST_HISTORY', 'WORKFLOWS', 'RUNS', 'RUN_LOG', 'FORM_FIELDS', 'FORM_RULES', 'AUTOMATIONS']) KEY_PERMS[k] = 'requests.manage';
for (const k of ['EVENTS', 'EVENT_DETAIL', 'EVENT_TEMPLATES', 'SERVICE', 'SERVICE_PLANS', 'SERVICE_TEMPLATES', 'SERVICE_REQUESTS', 'CHECKIN', 'PICKUP',
  'REGISTRATIONS', 'REG_FORM', 'REGISTRANTS', 'REFUNDS']) KEY_PERMS[k] = 'events.manage';
for (const k of ['GROUPS', 'GROUP_DETAIL', 'VOLUNTEERS', 'ROTA', 'SIGNUP_SHEETS']) KEY_PERMS[k] = 'ministries.manage';
for (const k of ['RESERVATIONS', 'VENUES', 'EQUIPMENT', 'MAINTENANCE', 'ISSUES', 'RENTALS']) KEY_PERMS[k] = 'facilities.manage';
for (const k of ['MESSAGES', 'NOTICES', 'PRAYERS']) KEY_PERMS[k] = 'communications.manage';
KEY_PERMS.CONTENT = 'website.publish';
for (const k of [...FINANCE, 'RATE']) KEY_PERMS[k] = 'finance.edit';
KEY_PERMS.NOTES = 'notes.pastoral';
export const CLERGY_TITLES = ['Deacon', 'Priest', 'Monsignor', 'Archimandrite', 'Chorbishop', 'Bishop', 'Archbishop', 'Patriarch'];
export const CLERGY_OFFICES = {
  'parish-priest': ['Parish priest', 'كاهن الرعية'], 'assistant-priest': ['Assistant priest', 'كاهن مساعد'],
  deacon: ['Deacon', 'شمّاس'], other: ['Other service', 'خدمة أخرى']
};
const PRIESTLY_OFFICES = new Set(['parish-priest', 'assistant-priest']);

export const V2_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS role_assignments(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL, scope TEXT NOT NULL, scope_id TEXT NOT NULL, grants TEXT NOT NULL DEFAULT '[]', revokes TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'active', note TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, created_by TEXT, ended_at TEXT, ended_by TEXT)`,
  `CREATE INDEX IF NOT EXISTS role_assignments_user ON role_assignments(user_id,status)`,
  `CREATE INDEX IF NOT EXISTS role_assignments_scope ON role_assignments(scope,scope_id,status)`,
  `CREATE TABLE IF NOT EXISTS parish_links(user_id TEXT NOT NULL REFERENCES users(id), parish_id TEXT NOT NULL REFERENCES parishes(id), kind TEXT NOT NULL, status TEXT NOT NULL, person_id TEXT, is_primary INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, decided_at TEXT, decided_by TEXT, PRIMARY KEY(user_id,parish_id))`,
  `CREATE INDEX IF NOT EXISTS parish_links_parish ON parish_links(parish_id,status)`,
  `CREATE TABLE IF NOT EXISTS access_blocks(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), scope TEXT NOT NULL, scope_id TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL, created_by TEXT NOT NULL, lifted_at TEXT, lifted_by TEXT, lift_note TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS access_blocks_user ON access_blocks(user_id,lifted_at)`,
  `CREATE TABLE IF NOT EXISTS clergy(id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), name TEXT NOT NULL, name_ar TEXT NOT NULL DEFAULT '', diocese TEXT NOT NULL REFERENCES dioceses(id), created_at TEXT NOT NULL, created_by TEXT)`,
  `CREATE TABLE IF NOT EXISTS clergy_titles(id TEXT PRIMARY KEY, clergy_id TEXT NOT NULL REFERENCES clergy(id), title TEXT NOT NULL, effective_from TEXT NOT NULL, kind TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', set_by TEXT, set_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS clergy_assignments(id TEXT PRIMARY KEY, clergy_id TEXT NOT NULL REFERENCES clergy(id), parish_id TEXT NOT NULL REFERENCES parishes(id), office TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT, exception TEXT, note TEXT NOT NULL DEFAULT '', created_by TEXT, created_at TEXT NOT NULL, ended_by TEXT, ended_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS settings(scope TEXT NOT NULL, scope_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT, PRIMARY KEY(scope,scope_id,key))`
];

/* Additive: new tables, a diocese row for accounts that belong to none, then (once) the existing
   roles and parish links copied into the scoped model. Nothing is deleted. Runs in its own batch. */
/* The account tables (identity.js uses them). */
export const ACCOUNTS_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS user_contacts(user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, value TEXT NOT NULL, verified_at TEXT, created_at TEXT NOT NULL, PRIMARY KEY(kind,value))`,
  `CREATE INDEX IF NOT EXISTS user_contacts_user ON user_contacts(user_id)`,
  `CREATE TABLE IF NOT EXISTS user_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id), first_name TEXT NOT NULL DEFAULT '', last_name TEXT NOT NULL DEFAULT '', birth_date TEXT NOT NULL DEFAULT '', data TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS verification_codes(id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), purpose TEXT NOT NULL, channel TEXT NOT NULL, target TEXT NOT NULL, code_hash TEXT NOT NULL, created REAL NOT NULL, expires REAL NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, delivery TEXT NOT NULL, used_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS verification_codes_target ON verification_codes(target,purpose,created)`,
  `CREATE TABLE IF NOT EXISTS user_mfa(user_id TEXT NOT NULL REFERENCES users(id), method TEXT NOT NULL, secret TEXT NOT NULL DEFAULT '', enabled_at TEXT, last_step INTEGER NOT NULL DEFAULT 0, recovery TEXT NOT NULL DEFAULT '[]', PRIMARY KEY(user_id,method))`,
  `CREATE TABLE IF NOT EXISTS login_challenges(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), methods TEXT NOT NULL, expires REAL NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS user_identities(provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), email TEXT NOT NULL DEFAULT '', linked_at TEXT NOT NULL, PRIMARY KEY(provider,subject))`,
  `CREATE INDEX IF NOT EXISTS user_identities_user ON user_identities(user_id)`,
  `CREATE TABLE IF NOT EXISTS oauth_states(state TEXT PRIMARY KEY, provider TEXT NOT NULL, intent TEXT NOT NULL, user_id TEXT, verifier TEXT NOT NULL DEFAULT '', nonce TEXT NOT NULL DEFAULT '', data TEXT NOT NULL DEFAULT '{}', created REAL NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS login_failures(key TEXT PRIMARY KEY, count INTEGER NOT NULL, since REAL NOT NULL)`
];
const EMAIL_ADDRESS = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/* 'email' or 'phone' for a contact in loginName form, else null. */
export function contactKind(value) {
  value = str(or(value, ''));
  if (len(value) <= 120 && EMAIL_ADDRESS.test(value) && value === value.toLowerCase()) return 'email';
  if (/^\+[0-9]{8,15}$/.test(value)) return 'phone';
  return null;
}

/* Once: the email address or phone number an account was opened with becomes its first sign-in
   contact — unverified, because nothing ever checked it. */
export async function migrateAccounts(c) {
  const [done, users] = await c.reads([["SELECT 1 AS x FROM schema_migrations WHERE name='v2-contacts'", []], ['SELECT id,username FROM users', []]]);
  if (done.length) return;
  for (const user of users) {
    const kind = contactKind(user.username);
    if (kind) c.run('INSERT OR IGNORE INTO user_contacts VALUES(?,?,?,?,?)', user.id, kind, user.username, null, NOW());
  }
  c.run("INSERT OR IGNORE INTO schema_migrations VALUES('v2-contacts',?)", NOW());
}

/* Membership requests, invitations, and every account's roles per parish in one view (connections.js uses them). */
export const CONNECTIONS_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS membership_requests(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), parish_id TEXT NOT NULL REFERENCES parishes(id), status TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', profile TEXT NOT NULL DEFAULT '{}', person_id TEXT, invitation_id TEXT, created_at TEXT NOT NULL, decided_at TEXT, decided_by TEXT, decision_note TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS membership_requests_parish ON membership_requests(parish_id,status)`,
  `CREATE INDEX IF NOT EXISTS membership_requests_user ON membership_requests(user_id,status)`,
  `CREATE TABLE IF NOT EXISTS invitations(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id), person_id TEXT NOT NULL, channel TEXT NOT NULL, target TEXT NOT NULL DEFAULT '', token TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, created_by TEXT, expires REAL NOT NULL, delivery TEXT NOT NULL, accepted_at TEXT, accepted_by TEXT, revoked_at TEXT, revoked_by TEXT)`,
  `CREATE INDEX IF NOT EXISTS invitations_person ON invitations(parish_id,person_id)`,
  `CREATE VIEW IF NOT EXISTS parish_accounts AS
  SELECT l.user_id AS user_id, l.parish_id AS parish_id, l.person_id AS person_id, 'member' AS role
    FROM parish_links l JOIN users u ON u.id=l.user_id WHERE l.kind='member' AND l.status='active' AND u.role<>'disabled'
  UNION
  SELECT r.user_id, r.scope_id, COALESCE((SELECT l.person_id FROM parish_links l WHERE l.user_id=r.user_id AND l.parish_id=r.scope_id
      AND l.status='active'), u.person_id), r.role
    FROM role_assignments r JOIN users u ON u.id=r.user_id WHERE r.scope='parish' AND r.status='active' AND u.role<>'disabled'
  UNION
  SELECT u.id, a.parish_id, u.person_id, u.role FROM users u JOIN assignments a ON a.user_id=u.id
    WHERE u.role<>'disabled' AND NOT EXISTS (SELECT 1 FROM role_assignments r WHERE r.user_id=u.id)
      AND NOT EXISTS (SELECT 1 FROM parish_links l WHERE l.user_id=u.id)`
];

/* Ministry applications, departures and guest inquiries, and notifications addressed to one account (ministries.js uses them). */
export const MINISTRY_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS ministry_applications(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id), group_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), person_id TEXT NOT NULL, status TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, leader_by TEXT, leader_at TEXT, priest_by TEXT, priest_at TEXT, decision_note TEXT NOT NULL DEFAULT '', withdraw_requested_at TEXT, withdraw_note TEXT NOT NULL DEFAULT '', closed_at TEXT, closed_by TEXT)`,
  `CREATE INDEX IF NOT EXISTS ministry_applications_group ON ministry_applications(parish_id,group_id,status)`,
  `CREATE TABLE IF NOT EXISTS ministry_departures(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id), group_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), person_id TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, created_at TEXT NOT NULL, decided_by TEXT, decided_at TEXT, note TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS ministry_inquiries(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id), group_id TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, created_at TEXT NOT NULL, handled_by TEXT, handled_at TEXT, note TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS ministry_inquiries_parish ON ministry_inquiries(parish_id,status)`,
  `CREATE TABLE IF NOT EXISTS account_notifications(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), parish_id TEXT, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', route TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, read_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS account_notifications_user ON account_notifications(user_id,created_at)`
];

/* Certificates asked for without an account (documents.js uses it). */
export const DOCUMENT_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS guest_requests(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id), reference TEXT NOT NULL, token TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, subject TEXT NOT NULL, requester TEXT NOT NULL, purpose TEXT NOT NULL DEFAULT '', delivery TEXT NOT NULL, status TEXT NOT NULL, certificate_id TEXT, response TEXT NOT NULL DEFAULT '', link_delivery TEXT NOT NULL, claim_user_id TEXT, claim_status TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, log TEXT NOT NULL DEFAULT '[]', UNIQUE(parish_id,reference))`,
  `CREATE INDEX IF NOT EXISTS guest_requests_parish ON guest_requests(parish_id,status)`
];

/* Private conversations, their reports and emergency reviews, and the people each complaint was sent to (privacy.js uses them). */
export const PRIVACY_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL, kind TEXT NOT NULL, subject TEXT NOT NULL, parish_id TEXT REFERENCES parishes(id), group_id TEXT, context TEXT NOT NULL DEFAULT '{}', created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, last_at TEXT NOT NULL, legacy_id TEXT UNIQUE)`,
  `CREATE INDEX IF NOT EXISTS conversations_place ON conversations(kind,parish_id,group_id)`,
  `CREATE TABLE IF NOT EXISTS conversation_members(conversation_id TEXT NOT NULL REFERENCES conversations(id), user_id TEXT NOT NULL REFERENCES users(id), side TEXT NOT NULL DEFAULT 'person', read_at TEXT NOT NULL DEFAULT '', archived INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(conversation_id,user_id))`,
  `CREATE INDEX IF NOT EXISTS conversation_members_user ON conversation_members(user_id,side)`,
  `CREATE TABLE IF NOT EXISTS conversation_messages(id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id), author_id TEXT NOT NULL REFERENCES users(id), side TEXT NOT NULL DEFAULT 'person', body TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS conversation_messages_thread ON conversation_messages(conversation_id,created_at)`,
  `CREATE TABLE IF NOT EXISTS conversation_reports(id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id), reporter_id TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, closed_at TEXT, closed_by TEXT, close_note TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS emergency_reviews(id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id), reviewer_id TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL, report_id TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS concern_recipients(concern_id TEXT NOT NULL REFERENCES member_concerns(id), user_id TEXT NOT NULL REFERENCES users(id), source TEXT NOT NULL, added_at TEXT NOT NULL, PRIMARY KEY(concern_id,user_id))`,
  `CREATE INDEX IF NOT EXISTS concern_recipients_user ON concern_recipients(user_id)`
];

/* The modules a parish can switch on (plans.js manages plans; parishes() reports each parish's modules).
   key, English, Arabic, what it covers in English and Arabic. Public presence is always included. */
export const PLAN_MODULES = [
  ['presence', 'Public presence', 'الحضور العام', 'The public parish page, published information, news and following. Always included.', 'صفحة الرعية العامة والمعلومات المنشورة والأخبار والمتابعة. مشمولة دائماً.'],
  ['members', 'Members and member portal', 'الأعضاء وبوّابتهم', 'Membership requests, invitations and the member portal.', 'طلبات الانتساب والدعوات وبوّابة الأعضاء.'],
  ['office', 'Parish office and records', 'مكتب الرعية والسجلات', 'People, households, pastoral notes and reports.', 'المؤمنون والعائلات والملاحظات الرعوية والتقارير.'],
  ['sacraments', 'Sacraments and certificates', 'الأسرار والشهادات', 'Sacrament requests and preparation, the register and certificates.', 'طلبات الأسرار والتحضير والسجل والشهادات.'],
  ['requests', 'Requests, forms and workflows', 'الطلبات والاستمارات والمسارات', 'General requests from members, forms and workflows.', 'الطلبات العامة من الأعضاء والاستمارات والمسارات.'],
  ['documents', 'Document requests without an account', 'طلب الوثائق دون حساب', 'Certificates asked for from the public page, with a private tracking link.', 'شهادات تُطلب من الصفحة العامة مع رابط متابعة خاص.'],
  ['ministries', 'Ministries and volunteers', 'الخدمات والمتطوّعون', 'Ministries, applications, attendance, volunteers and rotas.', 'الخدمات والطلبات والحضور والمتطوّعون وجداول الخدمة.'],
  ['events', 'Calendar, services and registrations', 'الرزنامة والخدم والتسجيلات', 'The calendar, service planning, the music library, registrations and check-in.', 'الرزنامة وتخطيط الخدم ومكتبة الألحان والتسجيلات والحضور.'],
  ['reservations', 'Reservations', 'الحجوزات', 'Hall and room booking requests and their approval.', 'طلبات حجز القاعات والغرف والموافقة عليها.'],
  ['resources', 'Facilities and resources', 'المرافق والموارد', 'Rooms, equipment and maintenance.', 'القاعات والمعدّات والصيانة.'],
  ['communications', 'Communications', 'التواصل', 'Notices, broadcasts, prayer requests and member communication.', 'الإعلانات والرسائل الجماعية ونوايا الصلاة والتواصل مع الأعضاء.'],
  ['finance', 'Giving and finance', 'التقدمات والمالية', 'Gifts, counting sessions, funds and expenses.', 'التقدمات وجلسات العدّ والصناديق والمصاريف.']
];
export const ALL_MODULES = PLAN_MODULES.map(m => m[0]);
export const PLAN_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS plan_bundles(id TEXT PRIMARY KEY, name TEXT NOT NULL, name_ar TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', description_ar TEXT NOT NULL DEFAULT '', modules TEXT NOT NULL, demo INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, created_by TEXT, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS plan_arrangements(id TEXT PRIMARY KEY, diocese TEXT NOT NULL REFERENCES dioceses(id), name TEXT NOT NULL, bundle_id TEXT, modules TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, created_by TEXT, ended_at TEXT, ended_by TEXT)`,
  `CREATE TABLE IF NOT EXISTS parish_plans(parish_id TEXT PRIMARY KEY REFERENCES parishes(id), mode TEXT NOT NULL, bundle_id TEXT, modules TEXT NOT NULL, arrangement_id TEXT, updated_at TEXT NOT NULL, updated_by TEXT)`,
  `CREATE TABLE IF NOT EXISTS plan_requests(id TEXT PRIMARY KEY, parish_id TEXT NOT NULL REFERENCES parishes(id), requested_by TEXT NOT NULL REFERENCES users(id), bundle_id TEXT, modules TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, created_at TEXT NOT NULL, decided_by TEXT, decided_at TEXT, decision_note TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS plan_requests_parish ON plan_requests(parish_id,status)`,
  `CREATE TABLE IF NOT EXISTS plan_history(id TEXT PRIMARY KEY, parish_id TEXT, arrangement_id TEXT, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '{}', actor TEXT, at TEXT NOT NULL)`
];

export async function migrateV2(db) {
  await db.batch([...V2_SCHEMA, ...ACCOUNTS_SCHEMA, ...CONNECTIONS_SCHEMA, ...MINISTRY_SCHEMA, ...DOCUMENT_SCHEMA, ...PRIVACY_SCHEMA, ...PLAN_SCHEMA].map(sql => db.prepare(sql)));
  const columns = await db.prepare("SELECT name FROM pragma_table_info('dioceses')").all();
  if (!columns.results.some(column => column.name === 'metadata'))
    await db.prepare("ALTER TABLE dioceses ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}'").run();
  await db.prepare("INSERT OR IGNORE INTO dioceses(id,name) VALUES('','No diocese')").run();
}

/* The once-only copy, run inside a transaction (see initialize in app.js). */
export async function migrateV2Roles(c) {
  const [done] = await c.reads([["SELECT 1 AS x FROM schema_migrations WHERE name='v2-roles'", []]]);
  if (!done.length) {
    const users = await c.all("SELECT * FROM users WHERE role IN ('bishop','priest','secretary','treasurer','leader','member')");
    for (const user of users) await materializeLegacy(c, user, 'Copied from the account’s earlier role');
    c.run("INSERT OR IGNORE INTO schema_migrations VALUES('v2-roles',?)", NOW());
  }
  await migrateAccounts(c);
  const { migratePrivacy } = await import('./privacy.js');
  await migratePrivacy(c);
  const { migratePlans } = await import('./plans.js');
  await migratePlans(c);
}

/* The access an account had before scoped roles: one role, the parishes in `assignments`. */
async function legacyAccess(c, u) {
  const role = u.role;
  const pids = (await c.all('SELECT parish_id FROM assignments WHERE user_id=? ORDER BY parish_id', u.id)).map(r => r.parish_id);
  const assignments = [], links = [];
  if (role === 'bishop') {
    assignments.push({ id: 'legacy:' + u.id, user_id: u.id, role: 'bishop', scope: 'diocese', scope_id: u.diocese, grants: '[]', revokes: '[]', status: 'active', created_at: '', note: '' });
  } else if (Object.prototype.hasOwnProperty.call(WORKSPACE_ROLE, role)) {
    for (const pid of pids) assignments.push({ id: `legacy:${u.id}:${pid}`, user_id: u.id, role, scope: 'parish', scope_id: pid, grants: '[]', revokes: '[]', status: 'active', created_at: '', note: '' });
  } else if (role === 'member') {
    pids.forEach((pid, i) => links.push({ user_id: u.id, parish_id: pid, kind: 'member', status: 'active', person_id: u.person_id, is_primary: i === 0 ? 1 : 0, created_at: '' }));
  }
  return [assignments, links];
}

/* Before anything new is recorded for an account still on its earlier access, copy that access.
   Returns the role assignments it queued, which this request cannot read back from D1. */
export async function materializeLegacy(c, u, note = 'Copied from the account’s earlier role') {
  const [existing, clergyRows] = await c.reads([
    ['SELECT 1 AS x FROM role_assignments WHERE user_id=? UNION SELECT 1 FROM parish_links WHERE user_id=?', [u.id, u.id]],
    ['SELECT 1 AS x FROM clergy WHERE user_id=?', [u.id]]
  ]);
  if (existing.length) return [];
  const [assignments, links] = await legacyAccess(c, u);
  const at = NOW();
  const queued = [];
  for (const a of assignments) {
    const id = 'ra-' + sha256hex(`${u.id}|${a.role}|${a.scope_id}`).slice(0, 20);
    c.run('INSERT OR IGNORE INTO role_assignments(id,user_id,role,scope,scope_id,note,source,created_at) VALUES(?,?,?,?,?,?,?,?)',
      id, u.id, a.role, a.scope, a.scope_id, note, 'migrated', at);
    queued.push({ ...a, id, status: 'active' });
  }
  for (const link of links) {
    c.run('INSERT OR IGNORE INTO parish_links(user_id,parish_id,kind,status,person_id,is_primary,note,created_at) VALUES(?,?,?,?,?,?,?,?)',
      u.id, link.parish_id, 'member', 'active', link.person_id, link.is_primary, note, at);
  }
  if ((u.role === 'bishop' || u.role === 'priest') && !clergyRows.length) {
    const cid = 'cl-' + sha256hex(u.id).slice(0, 16);
    c.run('INSERT OR IGNORE INTO clergy VALUES(?,?,?,?,?,?,?)', cid, u.id, u.name, '', u.diocese, at, null);
    c.run('INSERT OR IGNORE INTO clergy_titles VALUES(?,?,?,?,?,?,?,?)', cid + '-t0', cid, u.role === 'bishop' ? 'Bishop' : 'Priest', '', 'recorded',
      'Recorded when titles were introduced; the earlier history was not kept.', null, at);
    for (const a of assignments) {
      if (a.scope === 'parish') {
        c.run('INSERT OR IGNORE INTO clergy_assignments VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', cid + '-a-' + a.scope_id, cid, a.scope_id, 'parish-priest', '', null, null,
          'Recorded when assignments were introduced; the start date was not kept.', null, at, null, null);
      }
    }
  }
  return queued;
}

/* Everything that decides what this account may reach: role assignments, parish links and access blocks. */
export async function authority(c, u) {
  const [assignmentRows, linkRows, blocks] = await c.reads([
    ['SELECT * FROM role_assignments WHERE user_id=? ORDER BY created_at,id', [u.id]],
    ['SELECT * FROM parish_links WHERE user_id=? ORDER BY created_at,parish_id', [u.id]],
    ['SELECT * FROM access_blocks WHERE user_id=? AND lifted_at IS NULL ORDER BY created_at,id', [u.id]]
  ]);
  let assignments = assignmentRows, links = linkRows;
  if (!assignments.length && !links.length) [assignments, links] = await legacyAccess(c, u);
  return { assignments: assignments.filter(a => a.status === 'active'), links, blocks };
}

/* A role's template, with this assignment's own additions and removals. Fixed permissions stay with their role. */
export function assignmentPerms(a) {
  const out = new Set(ROLE_TEMPLATES[a.role] ?? []);
  for (const p of JSON.parse(a.grants || '[]')) if (PERMISSION_CODES.has(p) && !isFixed(p)) out.add(p);
  for (const p of JSON.parse(a.revokes || '[]')) out.delete(p);
  return out;
}

export const isBlocked = (auth, diocese, pid = null) => auth.blocks.some(b => b.scope === 'global' || (b.scope === 'diocese' && b.scope_id === diocese)
  || (pid !== null && b.scope === 'parish' && b.scope_id === pid));

export function systemPerms(auth) {
  const perms = new Set();
  for (const a of auth.assignments) if (a.scope === 'system') for (const p of assignmentPerms(a)) perms.add(p);
  return perms;
}

/* Diocesan authority: the super admin's, apart from what belongs to the bishop alone, and this diocese's roles. */
export function diocesePerms(auth, did) {
  const perms = new Set([...systemPerms(auth)].filter(p => !isFixed(p) || FIXED_PERMISSIONS[p] === 'superadmin'));
  for (const a of auth.assignments) if (a.scope === 'diocese' && a.scope_id === did) for (const p of assignmentPerms(a)) perms.add(p);
  return perms;
}

/* Administrative authority over one parish: from the system, its diocese, or the parish itself. */
export function adminPerms(auth, pid, did) {
  const perms = diocesePerms(auth, did);
  for (const a of auth.assignments) if (a.scope === 'parish' && a.scope_id === pid) for (const p of assignmentPerms(a)) perms.add(p);
  return perms;
}

/* The strongest role this account holds over a place (lower is stronger). */
function topRank(auth, pid = null, did = null) {
  const ranks = auth.assignments.filter(a => Object.prototype.hasOwnProperty.call(RANK, a.role) && (a.scope === 'system'
    || (a.scope === 'diocese' && a.scope_id === did) || (pid !== null && a.scope === 'parish' && a.scope_id === pid))).map(a => RANK[a.role]);
  return ranks.length ? Math.min(...ranks) : 99;
}

/* This account's role in one parish, or null. Staff roles first, then the bishop's oversight,
   then a parish connection (member or follower). */
export async function parishContext(c, u, pid, auth = null, parish = null) {
  parish = parish ?? await c.first('SELECT * FROM parishes WHERE id=?', pid);
  if (parish === null) return null;
  auth = auth ?? await authority(c, u);
  if (isBlocked(auth, parish.diocese, pid)) return null;
  const staff = auth.assignments.filter(a => a.scope === 'parish' && a.scope_id === pid);
  const link = auth.links.find(l => l.parish_id === pid && l.status === 'active') ?? null;
  const personId = (link && link.person_id) || u.person_id;
  if (staff.length) {
    const roles = new Set(staff.map(a => a.role));
    const role = STAFF_ROLES.find(r => roles.has(r));
    const perms = new Set();
    for (const a of staff) for (const p of assignmentPerms(a)) perms.add(p);
    return { role, workspace: WORKSPACE_ROLE[role], perms, person_id: personId, diocese: parish.diocese };
  }
  if (auth.assignments.some(a => a.scope === 'diocese' && a.scope_id === parish.diocese && a.role === 'bishop'))
    return { role: 'bishop', workspace: 'bishop', perms: new Set(), person_id: u.person_id, diocese: parish.diocese };
  if (link && link.kind === 'member') return { role: 'member', workspace: 'member', perms: new Set(), person_id: link.person_id ?? null, diocese: parish.diocese };
  if (link && link.kind === 'follow') return { role: 'follower', workspace: 'follower', perms: new Set(), person_id: null, diocese: parish.diocese };
  return null;
}

/* The account as it acts in one parish: its role there, its permissions and its person record. */
export async function parishUser(c, u, pid) {
  if (u.scope_pid === pid) return u;
  const ctx = await parishContext(c, u, pid);
  need(ctx !== null, 'This parish is not assigned to your account.', 403);
  return { ...u, role: ctx.workspace, roleCode: ctx.role, perms: ctx.perms, person_id: ctx.person_id, scope_pid: pid };
}

export async function access(c, u, pid) {
  await parishUser(c, u, pid);
}

/* Workspace permissions of an account acting in a parish (or its role template when acting outside one). */
export const permsOf = u => u.perms instanceof Set ? u.perms : new Set(ROLE_TEMPLATES[u.role] ?? []);

/* `known` maps a parish ID to its state already read in this transaction, so the counts need not parse it again. */
export async function parishes(c, u, known = {}, auth = null) {
  auth = auth ?? await authority(c, u);
  const rows = await c.all('SELECT * FROM parishes ORDER BY rowid');
  const contexts = [];
  for (const r of rows) {
    const ctx = await parishContext(c, u, r.id, auth, r);
    if (ctx !== null) contexts.push([r, ctx]);
  }
  const wanted = contexts.filter(([r, ctx]) => ctx.workspace !== 'member' && ctx.workspace !== 'follower');
  const missing = wanted.filter(([r]) => !Object.prototype.hasOwnProperty.call(known, r.id));
  const stateRows = missing.length ? await c.reads(missing.map(([r]) => ['SELECT data FROM states WHERE parish_id=?', [r.id]])) : [];
  const parsed = new Map(missing.map(([r], i) => [r.id, stateRows[i][0] ? JSON.parse(stateRows[i][0].data) : null]));
  const year = localToday().slice(0, 4).replace(/^0+/, '');
  /* a parish without a plan keeps every module (see plans.js) */
  const plans = new Map((await c.all('SELECT parish_id,modules FROM parish_plans')).map(r => [r.parish_id, JSON.parse(r.modules)]));
  return contexts.map(([r, ctx]) => {
    const p = JSON.parse(r.metadata);
    [p.role, p.roleAr] = ROLE_TITLES[ctx.role];
    const link = auth.links.find(l => l.parish_id === r.id && l.status === 'active');
    Object.assign(p, { roleCode: ctx.role, perms: sorted([...ctx.perms]), diocese: r.diocese, primary: Boolean(link?.is_primary), kind: link ? link.kind : null,
      modules: plans.get(r.id) ?? [...ALL_MODULES] });
    const data = ctx.workspace === 'member' || ctx.workspace === 'follower' ? null
      : Object.prototype.hasOwnProperty.call(known, r.id) ? known[r.id] : parsed.get(r.id);
    if (data) {
      p.people = len(K(data, 'PEOPLE'));
      p.households = len(K(data, 'HOUSEHOLDS'));
      p.sacramentsYear = iter(K(data, 'SACRAMENTS')).filter(s => str(get(s, 'date', '')).startsWith(year)
        && get(s, 'kind') !== 'certificate' && ['registered', 'issued'].includes(get(s, 'status'))).length;
    }
    return p;
  });
}

/* What the browser needs to build the account's workspaces: system and diocesan roles, and whether it administers anything. */
export async function sessionAuthority(c, u, auth = null) {
  auth = auth ?? await authority(c, u);
  const names = new Map((await c.all("SELECT * FROM dioceses WHERE id<>''")).map(r => [r.id, [r.name, JSON.parse(r.metadata || '{}').ar ?? '']]));
  const dioceses = auth.assignments.filter(a => a.scope === 'diocese' && names.has(a.scope_id)).map(a => ({
    id: a.scope_id, name: names.get(a.scope_id)[0], nameAr: names.get(a.scope_id)[1], role: a.role, perms: sorted([...assignmentPerms(a)])
  }));
  const system = sorted([...systemPerms(auth)]);
  const admin = Boolean(system.length || dioceses.length || auth.assignments.some(a => a.scope === 'parish'
    && [...assignmentPerms(a)].some(p => p === 'staff.manage' || p === 'access.manage')));
  return { superadmin: system.includes('dioceses.manage'), system, dioceses, admin, blocked: auth.blocks.some(b => b.scope === 'global') };
}

export async function loginAllowed(c, u) {
  if (u === null || u.role === 'disabled') return false;
  return !(await c.first("SELECT 1 AS x FROM access_blocks WHERE user_id=? AND scope='global' AND lifted_at IS NULL", u.id));
}

/* ---- administration: dioceses, parishes, staff, clergy, access ----------- */
function slug(text, prefix) {
  const base = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || prefix;
  return base.startsWith(prefix + '-') ? base : `${prefix}-${base}`;
}

/* str.split()'s whitespace */
const PY_SPACES = new RegExp('[\\t\\n\\x0b\\x0c\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]+');
export function clean(value, limit, message, required = true) {
  const text = str(or(value, '')).split(PY_SPACES).filter(Boolean).join(' ');
  need((!required || text) && len(text) <= limit, message);
  return text;
}

async function userBrief(c, ids) {
  const wanted = sorted([...new Set(ids.filter(Boolean))]);
  const rows = wanted.length ? await c.all(`SELECT id,username,name FROM users WHERE id IN (${wanted.map(() => '?').join(',')})`, ...wanted) : [];
  const out = {};
  for (const r of rows) out[r.id] = { name: r.name, username: r.username };
  return out;
}

/* Every place this account administers, with its authority there. */
async function adminScope(c, auth) {
  const [dioceseRows, parishRows] = await c.reads([
    ["SELECT * FROM dioceses WHERE id<>'' ORDER BY name", []],
    ['SELECT * FROM parishes ORDER BY rowid', []]
  ]);
  const scope = { system: systemPerms(auth), dioceses: new Map(), parishes: new Map() };
  for (const d of dioceseRows) {
    const perms = diocesePerms(auth, d.id);
    if (perms.size) scope.dioceses.set(d.id, perms);
  }
  for (const p of parishRows) {
    const perms = adminPerms(auth, p.id, p.diocese);
    if (['staff.manage', 'access.manage', 'finance.view', 'settings.manage'].some(x => perms.has(x))) scope.parishes.set(p.id, perms);
  }
  return [scope, dioceseRows, parishRows];
}

export async function setting(c, scope, scopeId, key, dflt) {
  const row = await c.first('SELECT value FROM settings WHERE scope=? AND scope_id=? AND key=?', scope, scopeId, key);
  return row ? row.value : dflt;
}

export async function adminView(c, u) {
  const auth = await authority(c, u);
  const [scope, dioceseRows, parishRows] = await adminScope(c, auth);
  need(scope.system.size || scope.dioceses.size || scope.parishes.size, 'Administration is not part of your account.', 403);
  const parishIds = new Set(scope.parishes.keys());
  const outDioceses = [];
  for (const d of dioceseRows) {
    if (!scope.dioceses.has(d.id)) continue;
    const meta = JSON.parse(d.metadata || '{}');
    const bishops = await c.all("SELECT * FROM role_assignments WHERE role='bishop' AND scope='diocese' AND scope_id=? AND status='active'", d.id);
    outDioceses.push({ id: d.id, name: d.name, nameAr: meta.ar ?? '', bishops: bishops.map(b => b.user_id), perms: sorted([...scope.dioceses.get(d.id)]),
      releasePolicy: await setting(c, 'diocese', d.id, 'documentRelease', 'unset') });
  }
  const byId = new Map(parishRows.map(p => [p.id, p]));
  const outParishes = [...parishIds].map(pid => {
    const p = byId.get(pid), meta = JSON.parse(p.metadata);
    return { id: pid, diocese: p.diocese, name: meta.name ?? '', nameAr: meta.ar ?? '', town: meta.town ?? '', townAr: meta.townAr ?? '', perms: sorted([...scope.parishes.get(pid)]),
      demo: Boolean(meta.demo) };
  });
  outParishes.sort((a, b) => (a.diocese < b.diocese ? -1 : a.diocese > b.diocese ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const assignmentVisible = a => a.scope === 'parish' ? parishIds.has(a.scope_id) && scope.parishes.get(a.scope_id).has('staff.manage')
    : a.scope === 'diocese' ? scope.dioceses.has(a.scope_id) : scope.system.has('dioceses.manage');
  const assignments = (await c.all('SELECT * FROM role_assignments ORDER BY created_at DESC,id')).filter(assignmentVisible).map(a => ({
    id: a.id, userId: a.user_id, role: a.role, scope: a.scope, scopeId: a.scope_id, grants: JSON.parse(a.grants), revokes: JSON.parse(a.revokes),
    status: a.status, note: a.note, source: a.source, createdAt: a.created_at, createdBy: a.created_by, endedAt: a.ended_at,
    perms: sorted([...assignmentPerms(a)])
  }));
  const clergy = [];
  for (const row of await c.all('SELECT * FROM clergy ORDER BY name')) {
    const [serviceRows, titleRows] = await c.reads([
      ['SELECT * FROM clergy_assignments WHERE clergy_id=? ORDER BY created_at,id', [row.id]],
      ['SELECT * FROM clergy_titles WHERE clergy_id=? ORDER BY set_at,id', [row.id]]
    ]);
    if (!scope.dioceses.has(row.diocese) && !serviceRows.some(ca => parishIds.has(ca.parish_id))) continue;
    const titles = titleRows.map(t => ({ id: t.id, title: t.title, effectiveFrom: t.effective_from, kind: t.kind, note: t.note, setBy: t.set_by, setAt: t.set_at }));
    const services = serviceRows.map(s => ({ id: s.id, parishId: s.parish_id, office: s.office, startDate: s.start_date, endDate: s.end_date,
      exception: s.exception ? JSON.parse(s.exception) : null, note: s.note, createdAt: s.created_at, createdBy: s.created_by, endedBy: s.ended_by }));
    clergy.push({ id: row.id, userId: row.user_id, name: row.name, nameAr: row.name_ar, diocese: row.diocese,
      title: titles.length ? titles[titles.length - 1].title : '', titles, services });
  }
  const blockVisible = b => b.scope === 'global' ? scope.system.has('accounts.global') : b.scope === 'diocese' ? scope.dioceses.has(b.scope_id)
    : parishIds.has(b.scope_id) && scope.parishes.get(b.scope_id).has('access.manage');
  const blocks = (await c.all('SELECT * FROM access_blocks ORDER BY created_at DESC,id')).filter(blockVisible).map(b => ({
    id: b.id, userId: b.user_id, scope: b.scope, scopeId: b.scope_id, reason: b.reason, createdAt: b.created_at, createdBy: b.created_by,
    liftedAt: b.lifted_at, liftedBy: b.lifted_by, liftNote: b.lift_note
  }));
  const users = await userBrief(c, [...assignments.map(a => a.userId), ...assignments.map(a => a.createdBy), ...blocks.map(b => b.userId),
    ...blocks.map(b => b.createdBy), ...blocks.map(b => b.liftedBy), ...clergy.map(x => x.userId), ...outDioceses.flatMap(d => d.bishops),
    ...clergy.flatMap(x => x.titles.map(t => t.setBy))]);
  const roles = {}, offices = {}, templates = {};
  for (const [k, v] of Object.entries(ROLE_TITLES)) roles[k] = [...v];
  for (const [k, v] of Object.entries(CLERGY_OFFICES)) offices[k] = [...v];
  for (const [k, v] of Object.entries(ROLE_TEMPLATES)) templates[k] = sorted([...v]);
  const { financeOverview } = await import('./documents.js');
  const finance = await financeOverview(c, auth, parishRows);
  return { system: sorted([...scope.system]), dioceses: outDioceses, parishes: outParishes, assignments, clergy, blocks, users, finance,
    catalog: { permissions: PERMISSIONS.map(p => ({ code: p[0], level: p[1], en: p[2], ar: p[3], fixed: FIXED_PERMISSIONS[p[0]] ?? '' })),
      templates, titles: [...CLERGY_TITLES], offices, roles } };
}

/* A new parish's records: empty lists and safe structural defaults for the existing views. */
export function emptyParishState(pid, meta, dioceseName = '', dioceseAr = '') {
  const d = {};
  for (const [k, v] of Object.entries(SEED)) d[k] = Array.isArray(v) ? [] : v !== null && typeof v === 'object' ? {} : deepcopy(v);
  for (const k of ['RATE', 'SERVICE', 'ROTA', 'CHECKIN', 'BATCH', 'REG_FORM', 'EVACUATION', 'PREP_REQUIREMENTS']) d[k] = deepcopy(SEED[k]);
  Object.assign(d.SERVICE, { order: [], celebrant: null, coordinator: null, venue: null });
  d.ROTA.teams = [];
  Object.assign(d.CHECKIN, { rows: [], present: 0, expected: 0, awaitingGuardian: 0, room: null });
  Object.assign(d.BATCH, { lines: [], counters: [] });
  Object.assign(d.REG_FORM, { fields: [], discounts: [], installments: [] });
  d.EVACUATION.rooms = [];
  d.PARISH = deepcopy(SEED.PARISH);
  Object.assign(d.PARISH, { id: pid, name: meta.name, nameAr: meta.ar, town: meta.town, townAr: meta.townAr, rite: meta.rite ?? '', riteAr: meta.riteAr ?? '',
    eparchy: dioceseName, eparchyAr: dioceseAr, address: '', addressAr: '', phone: '', people: 0, households: 0, groups: 0, volunteers: 0 });
  d.PARISHES = [];
  return d;
}

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/* Appoint someone, checking the appointer's authority: no one appoints at or above their own rank in a
   parish, and no one hands on a permission they do not hold themselves or one fixed to another role. */
async function assignRole(c, actor, auth, userId, role, scope, scopeId, grants = [], revokes = [], note = '', source = '') {
  const target = await c.first('SELECT * FROM users WHERE id=?', userId);
  need(target !== null && target.role !== 'disabled', 'Choose an existing account.');
  grants = sorted([...new Set(iter(grants).map(p => str(p)))]); revokes = sorted([...new Set(iter(revokes).map(p => str(p)))]);
  need([...grants, ...revokes].every(p => PERMISSION_CODES.has(p)), 'Unknown permission.');
  need(!grants.some(isFixed), 'That permission belongs to one role and cannot be granted.');
  let held;
  if (scope === 'parish') {
    const parish = await c.first('SELECT * FROM parishes WHERE id=?', scopeId);
    need(parish !== null, 'Parish not found.', 404);
    need(['parishadmin', 'secretary', 'treasurer', 'leader'].includes(role), 'Choose a parish role. A priest’s access follows their clergy assignment.');
    held = adminPerms(auth, scopeId, parish.diocese);
    need(held.has('staff.manage'), 'You cannot appoint staff in this parish.', 403);
    need(RANK[role] > topRank(auth, scopeId, parish.diocese), 'You cannot appoint someone at or above your own role.', 403);
  } else if (scope === 'diocese') {
    need(await c.first("SELECT 1 AS x FROM dioceses WHERE id=? AND id<>''", scopeId), 'Diocese not found.', 404);
    need(role === 'diocesanadmin', 'Choose a diocesan role. The first bishop is provisioned by the super admin.');
    held = diocesePerms(auth, scopeId);
    need(held.has('diocese.staff') && topRank(auth, null, scopeId) <= RANK.bishop, 'Only the bishop or the super admin appoints diocesan admins.', 403);
  } else {
    throw new Problem(403, 'System roles are created by the setup process.');
  }
  const final = assignmentPerms({ role, grants: JSON.stringify(grants), revokes: JSON.stringify(revokes) });
  const beyond = sorted([...final].filter(p => !held.has(p) || isFixed(p)));
  need(!beyond.length, 'You cannot give permissions you do not hold yourself: ' + beyond.join(', '), 403);
  const queued = await materializeLegacy(c, target);
  const duplicate = await c.first("SELECT 1 AS x FROM role_assignments WHERE user_id=? AND role=? AND scope=? AND scope_id=? AND status='active'", userId, role, scope, scopeId);
  need(!duplicate && !queued.some(a => a.role === role && a.scope === scope && a.scope_id === scopeId), 'This person already holds that role there.', 409);
  const aid = 'ra-' + tokenHex(10);
  c.run('INSERT INTO role_assignments VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', aid, userId, role, scope, scopeId, dumps(grants), dumps(revokes), 'active', note, source, NOW(), actor.id, null, null);
  return aid;
}

async function canManageAssignment(c, auth, a) {
  if (a.scope === 'parish') {
    const parish = await c.first('SELECT * FROM parishes WHERE id=?', a.scope_id);
    const held = adminPerms(auth, a.scope_id, parish.diocese);
    return [held.has('staff.manage') && (RANK[a.role] ?? 99) > topRank(auth, a.scope_id, parish.diocese), held];
  }
  if (a.scope === 'diocese') {
    const held = diocesePerms(auth, a.scope_id);
    return [held.has('diocese.staff') && (RANK[a.role] ?? 99) > topRank(auth, null, a.scope_id) && a.role !== 'bishop', held];
  }
  return [false, new Set()];
}

/* May this account deactivate or reactivate access at this scope? */
async function blockAuthority(c, auth, scope, scopeId) {
  if (scope === 'global') return systemPerms(auth).has('accounts.global');
  if (scope === 'diocese') return diocesePerms(auth, scopeId).has('access.manage') && topRank(auth, null, scopeId) <= RANK.diocesanadmin;
  const parish = await c.first('SELECT * FROM parishes WHERE id=?', scopeId);
  return parish !== null && adminPerms(auth, scopeId, parish.diocese).has('access.manage');
}

const auditScope = (scope, scopeId) => (scope === 'parish' ? scopeId : null);

export async function adminAction(c, u, q) {
  const auth = await authority(c, u);
  const op = get(q, 'op'), at = NOW();
  if (op === 'findUser') {
    const [scope] = await adminScope(c, auth);
    need(scope.system.size || scope.dioceses.size || scope.parishes.size, 'Administration is not part of your account.', 403);
    const needle = strip(str(or(get(q, 'query'), '')));
    need(len(needle) >= 3 && len(needle) <= 120, 'Enter the person’s exact username, email address or phone number.');
    const { loginName } = await import('./accounts.js');
    const key = loginName(needle);
    const row = await c.first('SELECT id,username,name FROM users WHERE username=? AND role<>?', key, 'disabled')
      ?? await c.first('SELECT u.id,u.username,u.name FROM user_contacts k JOIN users u ON u.id=k.user_id WHERE k.value=? AND u.role<>?', key, 'disabled');
    return { user: row ? { id: row.id, username: row.username, name: row.name } : null };
  }
  if (op === 'setPolicy') {
    const did = get(q, 'diocese');
    need(await c.first("SELECT 1 AS x FROM dioceses WHERE id=? AND id<>''", did), 'Diocese not found.', 404);
    need(diocesePerms(auth, did).has('diocese.policies'), 'Diocesan policies are set by the bishop.', 403);
    need(get(q, 'key') === 'documentRelease' && ['unset', 'after-signature', 'after-acceptance'].includes(get(q, 'value')), 'Choose a policy.');
    c.run('INSERT INTO settings VALUES(?,?,?,?,?,?) ON CONFLICT(scope,scope_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by',
      'diocese', did, 'documentRelease', get(q, 'value'), at, u.id);
    audit(c, u, null, 'diocese.policy', { diocese: did, documentRelease: get(q, 'value') });
    return {};
  }
  if (op === 'createDiocese') {
    need(systemPerms(auth).has('dioceses.manage'), 'Only the super admin creates dioceses.', 403);
    const name = clean(get(q, 'name'), 120, 'Enter the diocese’s name.');
    const nameAr = clean(get(q, 'nameAr'), 120, 'Enter the Arabic name.', false);
    const did = slug(name, 'dio');
    need(!(await c.first('SELECT 1 AS x FROM dioceses WHERE id=?', did)), 'A diocese with this name already exists.', 409);
    c.run('INSERT INTO dioceses(id,name,metadata) VALUES(?,?,?)', did, name, dumps({ ar: nameAr, createdAt: at, createdBy: u.id }));
    audit(c, u, null, 'diocese.created', { diocese: did });
    return { id: did };
  }
  if (op === 'provisionBishop') {
    need(systemPerms(auth).has('dioceses.manage'), 'Only the super admin provisions a bishop account.', 403);
    const did = get(q, 'diocese');
    need(await c.first("SELECT 1 AS x FROM dioceses WHERE id=? AND id<>''", did), 'Diocese not found.', 404);
    need(!(await c.first("SELECT 1 AS x FROM role_assignments WHERE role='bishop' AND scope='diocese' AND scope_id=? AND status='active'", did)),
      'This diocese already has a bishop. Provisioning is for the first bishop account only.', 409);
    const name = clean(get(q, 'name'), 120, 'Enter the bishop’s name.');
    const nameAr = clean(get(q, 'nameAr'), 120, 'Enter the Arabic name.', false);
    const username = strip(str(or(get(q, 'username'), '')));
    need(/^[a-z0-9][a-z0-9._-]{2,40}$/.test(username), 'Choose a username of 3–40 lowercase letters, digits, dots or dashes.');
    need(!(await c.first('SELECT 1 AS x FROM users WHERE username=?', username)), 'This username is taken.', 409);
    const { ROUNDS } = await import('./member.js');
    const password = tokenUrlsafe(12);
    const userId = 'u-' + tokenHex(8);
    c.run('INSERT INTO users VALUES(?,?,?,?,?,?,?)', userId, username, name, 'user', did, null, passwordHash(password, tokenHex(16), ROUNDS));
    const cid = 'cl-' + tokenHex(8);
    c.run('INSERT INTO clergy VALUES(?,?,?,?,?,?,?)', cid, userId, name, nameAr, did, at, u.id);
    c.run('INSERT INTO clergy_titles VALUES(?,?,?,?,?,?,?,?)', cid + '-t0', cid, 'Bishop', at.slice(0, 10), 'initial', 'Set when the account was provisioned.', u.id, at);
    c.run('INSERT INTO role_assignments VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', 'ra-' + tokenHex(10), userId, 'bishop', 'diocese', did, '[]', '[]', 'active', '', 'provision', at, u.id, null, null);
    audit(c, u, null, 'bishop.provisioned', { diocese: did, user: userId });
    return { userId, username, temporaryPassword: password };
  }
  if (op === 'createParish') {
    const did = get(q, 'diocese');
    need(isStr(did) && await c.first("SELECT 1 AS x FROM dioceses WHERE id=? AND id<>''", did), 'Choose a diocese.', 404);
    need(diocesePerms(auth, did).has('parishes.create'), 'You cannot create parishes in this diocese.', 403);
    const meta = {
      name: clean(get(q, 'name'), 120, 'Enter the parish’s name.'), ar: clean(get(q, 'nameAr'), 120, 'Enter the Arabic name.', false),
      town: clean(get(q, 'town'), 80, 'Enter the town.'), townAr: clean(get(q, 'townAr'), 80, 'Enter the town in Arabic.', false),
      rite: clean(get(q, 'rite'), 60, 'Enter the rite.', false), riteAr: clean(get(q, 'riteAr'), 60, 'Enter the rite in Arabic.', false)
    };
    const pid = slug(meta.name + ' ' + meta.town, 'p');
    need(!(await c.first('SELECT 1 AS x FROM parishes WHERE id=?', pid)), 'A parish with this name already exists in this town.', 409);
    meta.id = pid;
    c.run('INSERT INTO parishes VALUES(?,?,?)', pid, did, dumps(meta));
    for (const category of CONCERN_CATEGORIES) c.run('INSERT OR IGNORE INTO complaint_categories VALUES(?,?,1)', pid, category);
    const drow = await c.first('SELECT * FROM dioceses WHERE id=?', did);
    const d = migrate_state(emptyParishState(pid, meta, drow.name, JSON.parse(drow.metadata || '{}').ar ?? ''));
    validate(d);
    c.run('INSERT INTO states VALUES(?,1,?)', pid, dumps(d));
    await sync_relationships(c, pid, d);
    audit(c, u, pid, 'parish.created', { diocese: did });
    return { id: pid };
  }
  if (op === 'setDemo') {   // whether a parish's information is demonstration data, shown as such on its public page
    need(systemPerms(auth).has('dioceses.manage'), 'Only a super admin marks demonstration data.', 403);
    const row = await c.first('SELECT * FROM parishes WHERE id=?', get(q, 'parish'));
    need(row !== null && typeof get(q, 'demo') === 'boolean', 'Choose a parish.', 404);
    const meta = JSON.parse(row.metadata);
    meta.demo = get(q, 'demo');
    c.run('UPDATE parishes SET metadata=? WHERE id=?', JSON.stringify(meta), row.id);
    audit(c, u, row.id, 'parish.demo-' + (meta.demo ? 'on' : 'off'), {});
    return {};
  }
  if (op === 'assign') {
    const aid = await assignRole(c, u, auth, get(q, 'userId'), get(q, 'role'), get(q, 'scope'), get(q, 'scopeId'),
      or(get(q, 'grants'), []), or(get(q, 'revokes'), []), clean(get(q, 'note'), 300, '', false));
    audit(c, u, get(q, 'scope') === 'parish' ? get(q, 'scopeId') : null, 'role.assigned',
      { assignment: aid, user: get(q, 'userId'), role: get(q, 'role'), scope: get(q, 'scope'), scopeId: get(q, 'scopeId') });
    return { id: aid };
  }
  if (op === 'adjust' || op === 'endAssignment') {
    const a = await c.first("SELECT * FROM role_assignments WHERE id=? AND status='active'", get(q, 'id'));
    need(a !== null, 'Appointment not found.', 404);
    const [allowed, held] = await canManageAssignment(c, auth, a);
    need(allowed, 'This appointment is outside your authority.', 403);
    need(a.user_id !== u.id, 'You cannot change your own appointment.', 403);
    if (op === 'endAssignment') {
      need(a.role !== 'priest', 'End the clergy assignment instead; the priest’s access follows it.');
      c.run("UPDATE role_assignments SET status='ended',ended_at=?,ended_by=? WHERE id=?", at, u.id, a.id);
      audit(c, u, auditScope(a.scope, a.scope_id), 'role.ended', { assignment: a.id });
      return { ok: true };
    }
    const grants = sorted([...new Set(iter(or(get(q, 'grants'), [])).map(p => str(p)))]);
    const revokes = sorted([...new Set(iter(or(get(q, 'revokes'), [])).map(p => str(p)))]);
    need([...grants, ...revokes].every(p => PERMISSION_CODES.has(p)), 'Unknown permission.');
    need(![...grants, ...revokes].some(isFixed), 'Fixed permissions stay with their role and cannot be changed.');
    const final = assignmentPerms({ role: a.role, grants: JSON.stringify(grants), revokes: JSON.stringify(revokes) });
    const before = assignmentPerms(a);
    const changed = new Set([...final].filter(p => !before.has(p)).concat([...before].filter(p => !final.has(p))));
    const beyond = sorted([...changed].filter(p => !held.has(p) || isFixed(p)));
    need(!beyond.length, 'You cannot change permissions you do not hold yourself: ' + beyond.join(', '), 403);
    c.run('UPDATE role_assignments SET grants=?,revokes=? WHERE id=?', dumps(grants), dumps(revokes), a.id);
    audit(c, u, auditScope(a.scope, a.scope_id), 'role.permissions', { assignment: a.id, grants, revokes });
    return { ok: true };
  }
  if (op === 'addClergy') {
    const did = get(q, 'diocese');
    need(isStr(did) && diocesePerms(auth, did).has('clergy.assign'), 'You cannot register clergy in this diocese.', 403);
    const title = get(q, 'title');
    need(CLERGY_TITLES.includes(title), 'Choose a title.');
    const userId = get(q, 'userId') || null;
    if (userId) {
      need(await c.first('SELECT 1 AS x FROM users WHERE id=?', userId), 'Account not found.', 404);
      need(!(await c.first('SELECT 1 AS x FROM clergy WHERE user_id=?', userId)), 'This account is already linked to a clergy record.', 409);
    }
    const cid = 'cl-' + tokenHex(8);
    c.run('INSERT INTO clergy VALUES(?,?,?,?,?,?,?)', cid, userId, clean(get(q, 'name'), 120, 'Enter the name.'), clean(get(q, 'nameAr'), 120, '', false), did, at, u.id);
    c.run('INSERT INTO clergy_titles VALUES(?,?,?,?,?,?,?,?)', cid + '-t0', cid, title, str(or(get(q, 'effectiveFrom'), at.slice(0, 10))).slice(0, 10), 'initial',
      'Recorded when the clergy record was created.', u.id, at);
    audit(c, u, null, 'clergy.added', { clergy: cid, diocese: did });
    return { id: cid };
  }
  if (op === 'setClergyTitle') {
    const row = await c.first('SELECT * FROM clergy WHERE id=?', get(q, 'clergyId'));
    need(row !== null, 'Clergy record not found.', 404);
    need(auth.assignments.some(a => a.role === 'bishop' && a.scope === 'diocese' && a.scope_id === row.diocese), 'Only the bishop of this diocese changes a clergy title.', 403);
    const title = get(q, 'title');
    need(CLERGY_TITLES.includes(title), 'Choose a title.');
    const effective = str(or(get(q, 'effectiveFrom'), '')).slice(0, 10);
    need(isoDate(effective), 'Enter the date the title takes effect.');
    c.run('INSERT INTO clergy_titles VALUES(?,?,?,?,?,?,?,?)', 'ct-' + tokenHex(8), row.id, title, effective, 'change', clean(get(q, 'note'), 300, '', false), u.id, at);
    audit(c, u, null, 'clergy.title', { clergy: row.id, title });
    return { ok: true };
  }
  if (op === 'linkClergyAccount') {
    const row = await c.first('SELECT * FROM clergy WHERE id=?', get(q, 'clergyId'));
    need(row !== null && diocesePerms(auth, row.diocese).has('clergy.assign'), 'Clergy record outside your authority.', 403);
    need(!row.user_id, 'This clergy record already has an account.', 409);
    const user = await c.first('SELECT * FROM users WHERE id=?', get(q, 'userId'));
    need(user !== null && !(await c.first('SELECT 1 AS x FROM clergy WHERE user_id=?', user.id)), 'Choose an account not linked to clergy.');
    c.run('UPDATE clergy SET user_id=? WHERE id=?', user.id, row.id);
    audit(c, u, null, 'clergy.account', { clergy: row.id, user: user.id });
    return { ok: true };
  }
  if (op === 'assignClergy') {
    const [rows, parishRows] = await c.reads([['SELECT * FROM clergy WHERE id=?', [get(q, 'clergyId')]], ['SELECT * FROM parishes WHERE id=?', [get(q, 'parishId')]]]);
    const row = rows[0] ?? null, parish = parishRows[0] ?? null;
    need(row !== null && parish !== null, 'Choose a clergy member and a parish.', 404);
    need(diocesePerms(auth, parish.diocese).has('clergy.assign'), 'You cannot assign clergy to this parish.', 403);
    const office = get(q, 'office');
    need(isStr(office) && has(CLERGY_OFFICES, office), 'Choose the office.');
    const start = str(or(get(q, 'startDate'), '')).slice(0, 10);
    need(isoDate(start), 'Enter the start date.');
    let exception = null;
    if (row.diocese !== parish.diocese) {
      const reason = clean(get(q, 'exceptionReason'), 500, 'A clergy member from another diocese needs a recorded exception: give the reason.');
      need(auth.assignments.some(a => a.role === 'bishop' && a.scope === 'diocese' && a.scope_id === parish.diocese) || systemPerms(auth).has('dioceses.manage'),
        'Only the receiving diocese’s bishop or the super admin authorises service across dioceses.', 403);
      exception = dumps({ reason, homeDiocese: row.diocese, authorizedBy: u.id, authorizedAt: at });
    }
    const titles = await c.first('SELECT title FROM clergy_titles WHERE clergy_id=? ORDER BY set_at DESC,id DESC LIMIT 1', row.id);
    if (PRIESTLY_OFFICES.has(office)) need(titles && titles.title !== 'Deacon', 'A priestly office needs a clergy member ordained a priest.');
    const sid = 'ca-' + tokenHex(8);
    c.run('INSERT INTO clergy_assignments VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', sid, row.id, parish.id, office, start, null, exception, clean(get(q, 'note'), 300, '', false), u.id, at, null, null);
    if (row.user_id && PRIESTLY_OFFICES.has(office)) {
      const target = await c.first('SELECT * FROM users WHERE id=?', row.user_id);
      const queued = await materializeLegacy(c, target);
      const existing = await c.first("SELECT 1 AS x FROM role_assignments WHERE user_id=? AND role='priest' AND scope='parish' AND scope_id=? AND status='active'", row.user_id, parish.id);
      if (!existing && !queued.some(a => a.role === 'priest' && a.scope === 'parish' && a.scope_id === parish.id)) {
        c.run('INSERT INTO role_assignments VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', 'ra-' + tokenHex(10), row.user_id, 'priest', 'parish', parish.id, '[]', '[]', 'active',
          'Follows clergy assignment ' + sid, 'clergy', at, u.id, null, null);
      }
    }
    audit(c, u, parish.id, 'clergy.assigned', { clergy: row.id, assignment: sid, office });
    return { id: sid };
  }
  if (op === 'endClergyAssignment') {
    const s = await c.first('SELECT * FROM clergy_assignments WHERE id=? AND end_date IS NULL', get(q, 'id'));
    need(s !== null, 'Assignment not found.', 404);
    const parish = await c.first('SELECT * FROM parishes WHERE id=?', s.parish_id);
    need(diocesePerms(auth, parish.diocese).has('clergy.assign'), 'This assignment is outside your authority.', 403);
    const end = str(or(get(q, 'endDate'), '')).slice(0, 10);
    need(isoDate(end) && end >= (s.start_date || '0000'), 'Enter an end date after the start.');
    c.run('UPDATE clergy_assignments SET end_date=?,ended_by=?,ended_at=? WHERE id=?', end, u.id, at, s.id);
    const row = await c.first('SELECT * FROM clergy WHERE id=?', s.clergy_id);
    if (row.user_id && PRIESTLY_OFFICES.has(s.office) && !(await c.first(
      "SELECT 1 AS x FROM clergy_assignments WHERE clergy_id=? AND parish_id=? AND end_date IS NULL AND id<>? AND office IN ('parish-priest','assistant-priest')", row.id, s.parish_id, s.id))) {
      c.run("UPDATE role_assignments SET status='ended',ended_at=?,ended_by=? WHERE user_id=? AND role='priest' AND scope='parish' AND scope_id=? AND status='active'",
        at, u.id, row.user_id, s.parish_id);
    }
    audit(c, u, s.parish_id, 'clergy.assignment-ended', { assignment: s.id });
    return { ok: true };
  }
  if (op === 'block') {
    const scope = get(q, 'scope'), scopeId = get(q, 'scopeId') || '';
    need(['parish', 'diocese', 'global'].includes(scope), 'Choose where to deactivate access.');
    need(await blockAuthority(c, auth, scope, scopeId), 'Deactivating access there is outside your authority.', 403);
    const target = await c.first('SELECT * FROM users WHERE id=?', get(q, 'userId'));
    need(target !== null, 'Account not found.', 404);
    need(target.id !== u.id, 'You cannot deactivate your own access.', 403);
    const targetAuth = await authority(c, target);
    if (scope === 'global') {
      need(!systemPerms(targetAuth).has('dioceses.manage'), 'Another super admin’s account cannot be deactivated here.', 403);
    } else {
      const did = scope === 'diocese' ? scopeId : (await c.first('SELECT diocese FROM parishes WHERE id=?', scopeId)).diocese;
      const pid = scope === 'parish' ? scopeId : null;
      need(topRank(targetAuth, pid, did) > topRank(auth, pid, did), 'You cannot deactivate someone at or above your own role.', 403);
    }
    const reason = clean(get(q, 'reason'), 500, 'Give the reason for deactivating access.');
    const bid = 'blk-' + tokenHex(8);
    c.run('INSERT INTO access_blocks VALUES(?,?,?,?,?,?,?,?,?,?)', bid, target.id, scope, scopeId, reason, at, u.id, null, null, '');
    if (scope === 'global') c.run('DELETE FROM sessions WHERE user_id=?', target.id);
    audit(c, u, auditScope(scope, scopeId), 'access.deactivated', { user: target.id, scope, scopeId });
    return { id: bid };
  }
  if (op === 'unblock') {
    const b = await c.first('SELECT * FROM access_blocks WHERE id=? AND lifted_at IS NULL', get(q, 'id'));
    need(b !== null, 'Deactivation not found.', 404);
    need(await blockAuthority(c, auth, b.scope, b.scope_id), 'This deactivation was made above your authority; only that level can lift it.', 403);
    c.run('UPDATE access_blocks SET lifted_at=?,lifted_by=?,lift_note=? WHERE id=?', at, u.id, clean(get(q, 'note'), 300, '', false), b.id);
    audit(c, u, auditScope(b.scope, b.scope_id), 'access.reactivated', { block: b.id });
    return { ok: true };
  }
  throw new Problem(400, 'Unknown administration action.');
}

/* May this account change one part of the parish workspace? Each part needs one permission;
   a ministry leader changes only their own ministry's parts, checked again in save_patch. */
export function writable(u, key) {
  const role = u.role;
  if (role === 'bishop' || role === 'member' || role === 'follower') return false;
  if (READONLY.has(key)) return false;
  if (key === 'NOTIFICATIONS' || key === 'PREFS') return true;
  if (role === 'leader' && ['GROUP_DETAIL', 'MUSIC', 'MUSIC_DETAIL', 'SETLISTS', 'CHECKIN', 'PICKUP'].includes(key)) return true;
  return permsOf(u).has(KEY_PERMS[key] ?? 'settings.manage');
}
