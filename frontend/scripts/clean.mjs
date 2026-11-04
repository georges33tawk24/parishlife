/* Removes the previous build's scripts and styles (assets/app) before a new build writes them. */
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

rmSync(fileURLToPath(new URL('../../assets/app', import.meta.url)), { recursive: true, force: true });
