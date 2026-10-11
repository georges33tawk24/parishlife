/* Accounts a parishioner opens themselves, ported from server.py (login_name, signup). */
import { need, get, K, isStr, len, str, or, strip, truthy, NOW, tokenHex, passwordHash, dumps } from './py.js';
import { audit, sync_relationships } from './app.js';
import { migrate_state, validate } from './state.js';
import { ROUNDS } from './member.js';

const EASTERN_DIGITS = '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹';
const EMAIL_ADDRESS = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/* str.split()'s whitespace */
const PY_SPACES = new RegExp('[\\t\\n\\x0b\\x0c\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]+');
export const SIGNUPS_PER_HOUR = 30;

/* How an account is found: an email address in lower case, a phone number in international
   form (Lebanon unless another country code is given), any other username as typed. */
export function loginName(value) {
  const text = [...strip(str(or(value, '')))].map(ch => {
    const i = EASTERN_DIGITS.indexOf(ch);
    return i < 0 ? ch : String(i % 10);
  }).join('');
  if (text.includes('@')) return text.toLowerCase();
  const digits = text.replace(/[ \t \-().]/g, '');
  if (!/^(\+|00)?[0-9]{6,15}$/.test(digits)) return text;
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('961') && digits.length >= 10) return '+' + digits;
  return '+961' + digits.replace(/^0+/, '');
}

/* A phone number as People records it: a Lebanese number without +961 in groups ('3 123 456', '76 220 415'),
   any other in full. */
export function recordPhone(number) {
  if (!number.startsWith('+961')) return number;
  const digits = number.slice(4);
  return [digits.slice(0, -6), digits.slice(-6, -3), digits.slice(-3)].filter(Boolean).join(' ');
}

/* A parishioner opens their own account with a phone number or an email address. It adds a
   person record to the chosen parish, marked as registered online until the office verifies it. */
export async function signup(c, q) {
  need(!truthy(get(q, 'website')), 'The account could not be created.'); // a field only robots fill in
  const pid = get(q, 'parish');
  const row = isStr(pid) ? await c.first('SELECT s.data,p.diocese FROM states s JOIN parishes p ON p.id=s.parish_id WHERE s.parish_id=?', pid) : null;
  need(row !== null, 'Choose your parish.');
  const rawName = get(q, 'name');
  const name = isStr(rawName) ? rawName.split(PY_SPACES).filter(Boolean).join(' ') : '';
  need(len(name) >= 2 && len(name) <= 120, 'Enter your full name.');
  const method = get(q, 'method');
  let phone = '', email = '', username;
  need(method === 'phone' || method === 'email', 'Choose a phone number or an email address.');
  if (method === 'phone') {
    phone = strip(str(or(get(q, 'phone'), '')));
    username = loginName(phone);
    need(len(phone) <= 40 && /^\+[0-9]{8,15}$/.test(username), 'Enter a valid phone number.');
  } else {
    email = strip(str(or(get(q, 'email'), ''))).toLowerCase();
    need(len(email) <= 120 && EMAIL_ADDRESS.test(email), 'Enter a valid email address.');
    username = email;
  }
  const password = get(q, 'password');
  need(isStr(password) && len(password) >= 8 && len(password) <= 200, 'Choose a password of at least 8 characters.');
  const hourAgo = (Date.now() - 3600 * 1000) * 1000, fraction = hourAgo % 1000000;  // as NOW() writes it, an hour ago
  const since = new Date(Math.floor(hourAgo / 1000)).toISOString().slice(0, 19) + (fraction ? '.' + String(fraction).padStart(6, '0') : '') + '+00:00';
  const [taken, recent] = await c.reads([
    ['SELECT 1 AS x FROM users WHERE username=?', [username]],
    ["SELECT COUNT(*) AS n FROM audit WHERE parish_id=? AND action='member.signup' AND at>?", [pid, since]]
  ]);
  need(taken.length === 0, (method === 'phone' ? 'This phone number' : 'This email address') + ' already has an account. Sign in instead.', 409);
  need(recent[0].n < SIGNUPS_PER_HOUR, 'Many accounts were opened in the last hour. Please try again later or call the parish office.', 429);
  let d = JSON.parse(row.data);
  const at = NOW(), personId = 'p' + tokenHex(8), userId = 'u-' + tokenHex(8);
  K(d, 'PEOPLE').push({ id: personId, lat: name, ar: name, town: '', townAr: '', rite: '', status: 'member',
    phone: method === 'phone' ? recordPhone(username) : '—', email, born: '', hh: null, tags: [], registeredOnline: { at, via: method, verified: false } });
  K(d, 'PERSON_EXTRA')[personId] = { skills: [], dates: [], occupation: '' };
  d = migrate_state(d);
  validate(d);
  await sync_relationships(c, pid, d);
  c.run('UPDATE states SET revision=revision+1,data=? WHERE parish_id=?', dumps(d), pid);
  c.run('INSERT INTO users VALUES(?,?,?,?,?,?,?)', userId, username, name, 'member', row.diocese, personId, passwordHash(password, tokenHex(16), ROUNDS));
  c.run('INSERT INTO assignments VALUES(?,?)', userId, pid);
  audit(c, { id: userId }, pid, 'member.signup', { via: method });
  return userId;
}
