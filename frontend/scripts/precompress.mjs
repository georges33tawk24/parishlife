/* Purpose: after `vite build`, writes a maximum-strength Brotli (.br) and gzip (.gz) copy of every built script, style sheet and SVG,
   once, so the API can send those instead of compressing each request on the fly at its fastest (weakest) setting: on a slow
   line every kilobyte counts (measured 24 November 2026: the public script went out at 185 KB on the fly, 152 KB with gzip -9).
   Main steps: walk dist/assets, compress with Node's own zlib (Brotli quality 11, gzip level 9), keep a copy only when it is smaller.
   The API serves them in Middleware/PrecompressedAssets.cs. */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const assets = fileURLToPath(new URL('../dist/assets', import.meta.url));
const TYPES = /\.(js|css|svg)$/;
let before = 0;
let after = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    if (statSync(file).isDirectory()) walk(file);
    else if (TYPES.test(name)) compress(file);
  }
}

function compress(file) {
  const raw = readFileSync(file);
  const br = brotliCompressSync(raw, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
      [constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
      [constants.BROTLI_PARAM_MODE]: file.endsWith('.svg') ? constants.BROTLI_MODE_GENERIC : constants.BROTLI_MODE_TEXT
    }
  });
  const gz = gzipSync(raw, { level: 9 });
  if (br.length < raw.length) writeFileSync(file + '.br', br);
  if (gz.length < raw.length) writeFileSync(file + '.gz', gz);
  before += raw.length;
  after += Math.min(br.length, raw.length);
}

walk(assets);
console.log(
  `precompress: ${Math.round(before / 1024)} KB of scripts, styles and SVG; ${Math.round(after / 1024)} KB with Brotli 11`
);
