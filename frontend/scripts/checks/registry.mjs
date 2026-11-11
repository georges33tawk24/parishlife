/* Purpose: checks the list of connected modules (src/portal/model/modules/index.js) as modules are
   added in parallel: every module has the expected parts, owns only collections that exist in
   model/data.js, and no collection or page is claimed by two modules. */
import assert from 'node:assert/strict';
import { mockApi } from '../mock-api.mjs';

mockApi(() => undefined);
const D = await import('../../src/portal/model/data.js');
const { MODULES } = await import('../../src/portal/model/modules/index.js');

const keys = new Map(),
  routes = new Map();
for (const m of MODULES) {
  assert.ok(Array.isArray(m.keys) && Array.isArray(m.routes), 'a module exports keys and routes');
  assert.equal(typeof m.load, 'function', 'a module exports load(parish, d)');
  assert.equal(typeof m.save, 'function', 'a module exports save(before, now, parish)');
  for (const k of m.keys) {
    assert.ok(k in D, `${k} is not a collection in model/data.js`);
    assert.ok(!keys.has(k), `${k} is owned by two modules`);
    keys.set(k, m);
  }
  for (const r of m.routes) {
    assert.ok(!routes.has(r), `the page ${r} is claimed by two modules`);
    routes.set(r, m);
  }
}
console.log(`registry: ${MODULES.length} modules, ${keys.size} collections, ${routes.size} pages`);
