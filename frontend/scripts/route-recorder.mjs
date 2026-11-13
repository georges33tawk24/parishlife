/* Purpose: a Node preload (`node --import`) used only by check-routes.mjs. It records every request the
   frontend sends during a module check, whatever stand-in fetch the check installs.
   Main parts: an accessor on globalThis.fetch that wraps each assigned fetch, and appends
   "METHOD url" lines to the file named by PARISHLIFE_ROUTE_LOG. */
import { appendFileSync } from 'node:fs';

const log = process.env.PARISHLIFE_ROUTE_LOG;
const wrap = inner =>
  typeof inner !== 'function' || !log
    ? inner
    : (url, options = {}) => {
        const target = typeof url === 'string' ? url : url?.url || String(url);
        const method = (options.method || url?.method || 'GET').toUpperCase();
        appendFileSync(log, `${method} ${target}\n`);
        return inner(url, options);
      };

let wrapped = wrap(globalThis.fetch);
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  get: () => wrapped,
  set: value => {
    wrapped = wrap(value);
  }
});
