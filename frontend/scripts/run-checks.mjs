/* Purpose: runs every frontend check, each in its own Node process so their stand-in APIs never mix.
   Main parts: check-api.mjs (the client, session, People and public site), then each checks/*.mjs
   (one per connected module, plus the module registry). Stops at the first failure. */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path => fileURLToPath(new URL(path, import.meta.url));
const files = [
  here('check-api.mjs'),
  ...readdirSync(here('checks'))
    .filter(f => f.endsWith('.mjs'))
    .sort()
    .map(f => here('checks/' + f))
];
for (const file of files) {
  const run = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (run.status !== 0) process.exit(run.status || 1);
}
