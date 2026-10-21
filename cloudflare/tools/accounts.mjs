/* Account operations for the Cloudflare deployment, the counterparts of server.py's
   --create-user, --assign-user and --grant-complaints. This prints SQL; run it against
   the D1 database with
     npx wrangler d1 execute parishlife --remote --command "<SQL>"
   or paste it into the D1 console in the Cloudflare dashboard.

     node cloudflare/tools/accounts.mjs create-user rita --role secretary --name "Rita Nassar" --person-id p4 --parish p-elias
     node cloudflare/tools/accounts.mjs set-password rita
     node cloudflare/tools/accounts.mjs assign-user fr-antoine --parish p-sauveur
     node cloudflare/tools/accounts.mjs grant-complaints fr-antoine --parish p-elias --permission Review --permission Respond
     node cloudflare/tools/accounts.mjs create-super-admin admin-georges --name "Georges Tawk"

   create-super-admin is the production initialisation of the first super admin. It always
   generates a strong password (or takes --password of 12+ characters) and never uses the
   local demonstration password. Deploy the Worker first: it creates the role tables on its
   first request. Afterwards the super admin creates dioceses and provisions their bishops.

   A strong random password is generated unless --password is given (12+ characters).
   Hashes use PBKDF2-SHA256 with 10,000 iterations by default, which keeps a sign-in
   within the Workers Free plan's CPU allowance; on Workers Paid use --iterations 600000. */
import { randomBytes, randomInt } from 'node:crypto';
import { passwordHash } from '../src/py.js';

const ROLES = ['bishop', 'priest', 'secretary', 'treasurer', 'leader', 'member'];
const PERMISSIONS = ['Review', 'Assign', 'Respond', 'Resolve', 'ViewIdentity', 'ViewSensitive', 'ManageCategories'];
const quote = value => (value === null || value === undefined ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`);
const fail = message => { console.error(message); process.exit(1); };

const [command, username, ...rest] = process.argv.slice(2);
const options = { parish: [], permission: [] };
for (let i = 0; i < rest.length; i += 2) {
  const key = rest[i]?.replace(/^--/, '');
  if (!key || rest[i + 1] === undefined) fail(`Missing value for ${rest[i]}`);
  if (key === 'parish' || key === 'permission') options[key].push(rest[i + 1]);
  else options[key] = rest[i + 1];
}
if (!username) fail('Give a username, for example: create-user rita --role secretary ...');

function newPassword() {
  if (options.password !== undefined) {
    if (options.password.length < 12) fail('Use at least 12 characters.');
    return options.password;
  }
  const letters = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 4 }, () => Array.from({ length: 5 }, () => letters[randomInt(letters.length)]).join('')).join('-');
}
const iterations = Number(options.iterations ?? 10000);
if (!Number.isInteger(iterations) || iterations < 10000) fail('Use at least 10000 iterations.');
const hash = password => passwordHash(password, randomBytes(16).toString('hex'), iterations);
const user = `(SELECT id FROM users WHERE username=${quote(username)})`;
const statements = [];
let password = null;

if (command === 'create-user') {
  const role = options.role ?? 'priest';
  if (!ROLES.includes(role)) fail(`Choose a role: ${ROLES.join(', ')}`);
  if (role === 'member' && !(options['person-id'] && options.parish.length)) fail('Member accounts need --person-id and at least one --parish.');
  password = newPassword();
  statements.push(`INSERT INTO users VALUES(${[randomBytes(12).toString('hex'), username, options.name ?? username, role, 'beirut', options['person-id'] ?? null, hash(password)].map(quote).join(',')})`);
  for (const pid of options.parish) statements.push(`INSERT INTO assignments VALUES(${user},${quote(pid)})`);
} else if (command === 'create-super-admin') {
  if (!/^[a-z0-9][a-z0-9._-]{2,40}$/.test(username)) fail('Choose a username of 3–40 lowercase letters, digits, dots or dashes.');
  if (options.password === '123456789') fail('That is the public demonstration password. Choose another, or omit --password for a generated one.');
  password = newPassword();
  const id = 'u-' + randomBytes(8).toString('hex');
  statements.push(`INSERT INTO users VALUES(${[id, username, options.name ?? username, 'user', '', null, hash(password)].map(quote).join(',')})`);
  statements.push(`INSERT INTO role_assignments(id,user_id,role,scope,scope_id,note,source,created_at) VALUES(${[
    'ra-' + randomBytes(10).toString('hex'), id, 'superadmin', 'system', '', 'Production initialisation', 'setup', new Date().toISOString()].map(quote).join(',')})`);
} else if (command === 'set-password') {
  password = newPassword();
  statements.push(`UPDATE users SET password=${quote(hash(password))} WHERE username=${quote(username)}`);
  statements.push(`DELETE FROM sessions WHERE user_id=${user}`);
} else if (command === 'assign-user') {
  if (!options.parish.length) fail('Specify at least one --parish.');
  /* server.py assigns existing priest accounts only. */
  for (const pid of options.parish)
    statements.push(`INSERT OR IGNORE INTO assignments SELECT id,${quote(pid)} FROM users WHERE username=${quote(username)} AND role='priest' AND diocese=(SELECT diocese FROM parishes WHERE id=${quote(pid)})`);
} else if (command === 'grant-complaints') {
  if (!options.parish.length || !options.permission.length) fail('Specify a parish and at least one complaint permission.');
  const unknown = options.permission.filter(p => !PERMISSIONS.includes(p));
  if (unknown.length) fail(`Unknown complaint permission: ${unknown.join(', ')}`);
  const granted = JSON.stringify([...new Set(options.permission)].sort()).replace(/","/g, '", "');
  for (const pid of options.parish)
    statements.push(`INSERT INTO complaint_reviewers SELECT ${quote(pid)},id,${quote(granted)} FROM users WHERE username=${quote(username)} AND id IN (SELECT user_id FROM assignments WHERE parish_id=${quote(pid)}) ON CONFLICT(parish_id,user_id) DO UPDATE SET permissions=excluded.permissions`);
} else {
  fail('Commands: create-user, set-password, assign-user, grant-complaints, create-super-admin');
}
console.log(statements.join(';\n') + ';');
if (password) console.error(`\nPassword for ${username}: ${password}`);
