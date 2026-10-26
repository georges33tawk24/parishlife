/* Generate a one-time operator provisioning file. No network access or secrets
   in command arguments, stdout, or application logs. Apply only to the intended
   D1 database after reviewing the generated SQL and taking a database backup. */
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { passwordHash } from '../src/py.js';

const usage = 'Usage: node cloudflare/tools/bootstrap-super-admin.mjs USERNAME OUTPUT.sql [DISPLAY_NAME] [--password-stdin]';
const argumentsList = process.argv.slice(2);
const fromStdin = argumentsList.includes('--password-stdin');
const positional = argumentsList.filter(value => value !== '--password-stdin');
const [username, output, displayName = username] = positional;
if (!username || !output || positional.length > 3 || !/^[A-Za-z0-9_.-]{3,80}$/.test(username)) {
  console.error(usage);
  process.exit(1);
}

async function hiddenPassword(prompt) {
  if (!process.stdin.isTTY) throw new Error('Use a terminal or pass a password through --password-stdin.');
  process.stderr.write(prompt);
  process.stdin.setEncoding('utf8');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((accept, reject) => {
    let value = '';
    const finish = (error) => {
      process.stdin.removeListener('data', collect);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stderr.write('\n');
      if (error) reject(error); else accept(value);
    };
    const collect = chunk => {
      for (const character of chunk) {
        if (character === '\u0003') { finish(new Error('Provisioning cancelled.')); return; }
        if (character === '\r' || character === '\n') { finish(); return; }
        if (character === '\u007f' || character === '\b') value = [...value].slice(0,-1).join('');
        else if (character >= ' ') value += character;
      }
    };
    process.stdin.on('data', collect);
  });
}

try {
  let password;
  if (fromStdin) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk));
      if (chunks.reduce((size, value) => size + value.length, 0) > 1024) throw new Error('Password input is too long.');
    }
    password = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
  } else {
    password = await hiddenPassword('Super Admin password (16–200 characters): ');
    if (password !== await hiddenPassword('Repeat password: ')) throw new Error('Passwords do not match.');
  }
  if (password.length < 16 || password.length > 200) throw new Error('Use a password of 16–200 characters.');
  const quote = value => `'${String(value).replaceAll("'", "''")}'`;
  const userId = 'u-' + randomBytes(12).toString('hex');
  const grantId = randomBytes(12).toString('hex');
  const stamp = new Date().toISOString();
  const hash = passwordHash(password, randomBytes(16).toString('hex'), 600000);
  password = null;
  const sql = [
    '-- Operator-controlled provisioning. Existing usernames are never overwritten or promoted.',
    "INSERT OR IGNORE INTO dioceses VALUES('pl-platform','ParishLife platform');",
    `INSERT INTO users VALUES(${[userId, username, displayName, 'member', 'pl-platform'].map(quote).join(',')},NULL,${quote(hash)});`,
    `INSERT INTO pl_grants VALUES(${quote(grantId)},${quote(userId)},'global','*','super_admin',1,NULL,${quote(stamp)});`,
    `INSERT INTO pl_history VALUES(${quote(randomBytes(16).toString('hex'))},NULL,'*','super-admin.operator.provisioned',${quote(JSON.stringify({user:userId,username}))},${quote(stamp)});`
  ].join('\n')+'\n';
  const target = resolve(output);
  writeFileSync(target, sql, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  console.error(`Provisioning SQL saved to ${target}. No plaintext password was written. Keep the file private and review it before applying it to D1.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
