/* Purpose: checks the shared account-name lookup (src/portal/model/names.js): names arrive in chunks of
   at most 100, are asked for once, and a failing or missing route leaves names empty without throwing. */
import assert from 'node:assert/strict';
import { mockApi, json } from '../mock-api.mjs';

const asked = [];
let failing = false;
mockApi((method, path) => {
  const m = path.match(/^parishes\/P\/account-names\?ids=(.*)$/);
  if (!m) return undefined;
  const ids = m[1].split(',').map(decodeURIComponent);
  asked.push(ids.length);
  if (failing) return json(500, { title: 'boom' });
  return json(
    200,
    ids.filter(id => id !== 'hidden').map(id => ({ accountId: id, displayName: `Name ${id}` }))
  );
});
const { loadNames, nameOf, forgetNames } = await import('../../src/portal/model/names.js');

const ids = Array.from({ length: 150 }, (_, i) => `a${i}`);
await loadNames('P', [...ids, 'hidden', 'a1', null]);
assert.deepEqual(asked, [100, 51], 'chunks of at most 100, each id once');
assert.equal(nameOf('P', 'a1'), 'Name a1');
assert.equal(nameOf('P', 'hidden'), '', 'an account the caller may not see has no name');
assert.equal(nameOf('P', ''), '');

await loadNames('P', ['a1', 'a2']);
assert.deepEqual(asked, [100, 51], 'known names are not asked for again');

forgetNames();
failing = true;
await loadNames('P', ['x1']);
assert.equal(nameOf('P', 'x1'), '', 'a failing lookup leaves the name empty and does not throw');
console.log('names: all assertions passed');
