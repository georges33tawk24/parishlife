/* Purpose: checks that the routes the frontend calls exist in ParishLife.Api, so the in-memory stand-ins
   used by `npm run check` cannot drift away from the real backend unnoticed.
   Main parts: runs every frontend check with route-recorder.mjs preloaded and collects the requests sent;
   reads the [Route]/[Http*] attributes of ParishLife.Api/Controllers (and the endpoints mapped in
   Program.cs); matches each request by method and path; prints the requests no API route answers.
   Run with `npm run check:routes` from frontend/. With --strict it fails when a request is unmatched and
   not listed in route-gaps.json (the known gaps, each with the reason it is still open). */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path => fileURLToPath(new URL(path, import.meta.url));
const strict = process.argv.includes('--strict');
const apiRoot = here('../../ParishLife.Api');

/* 1. The requests the frontend sends during its checks. */
const work = mkdtempSync(join(tmpdir(), 'parishlife-routes-'));
const log = join(work, 'requests.log');
const checks = [
  here('check-api.mjs'),
  ...readdirSync(here('checks'))
    .filter(f => f.endsWith('.mjs'))
    .sort()
    .map(f => here('checks/' + f))
];
for (const file of checks) {
  const run = spawnSync(process.execPath, ['--import', pathToFileURL(here('route-recorder.mjs')).href, file], {
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, PARISHLIFE_ROUTE_LOG: log }
  });
  if (run.status !== 0) {
    console.error(`check-routes: ${file} failed; run npm run check first.`);
    process.exit(run.status || 1);
  }
}
const requests = new Map();
for (const line of existsSync(log) ? readFileSync(log, 'utf8').split('\n') : []) {
  const [method, url] = line.split(' ');
  if (!url) continue;
  const path = url.replace(/^https?:\/\/[^/]+/, '').split(/[?#]/)[0];
  if (!path.startsWith('/api/')) continue;
  const key = `${method} ${path}`;
  if (!requests.has(key)) requests.set(key, { method, segments: path.slice(1).split('/').map(decodeURIComponent) });
}
rmSync(work, { recursive: true, force: true });

/* 1b. Literal paths in frontend/src passed to api(), parishAPI() or allPages(), so screens the checks do
   not exercise are covered too. A ${...} part counts as one route parameter; paths built from variables or
   joined with + are skipped, and a method that is not a literal ('*') matches any method. */
const sources = dir =>
  readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? sources(full) : /\.(js|jsx)$/.test(name) ? [full] : [];
  });
const srcRoot = here('../src');
for (const file of sources(srcRoot)) {
  const text = readFileSync(file, 'utf8');
  for (const [, fn, , raw, next, verb] of text.matchAll(
    /\b(api|parishAPI|allPages)\(\s*(['`])((?:(?!\2)[^\n])*)\2\s*([+,)]?)\s*(?:'([A-Z]+)')?/g
  )) {
    if (raw.startsWith('${') || next === '+') continue;
    const literal = (fn === 'parishAPI' ? 'parishes/{}/' : '') + raw.replace(/\$\{[^}]*\}/g, '{}');
    const path = '/api/' + literal.split(/[?#]/)[0].replace(/\/+$/, '');
    const parts = path.split('/').slice(2);
    if (parts.some(s => s === '{}{}' || /\{\}[^/]|[^/]\{\}/.test(s))) continue;
    if (parts.slice(1).every(s => s === '{}')) continue; // e.g. parishes/${id}/${path}: the route is a variable
    const method = verb || (next === ',' && fn !== 'allPages' ? '*' : 'GET');
    const key = `${method} ${path}`;
    if (!requests.has(key))
      requests.set(key, {
        method,
        segments: path.slice(1).split('/'),
        source: file.slice(srcRoot.length + 1).replaceAll('\\', '/')
      });
  }
}

/* 2. The routes ParishLife.Api declares. */
const filesUnder = dir =>
  readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : full.endsWith('.cs') ? [full] : [];
  });
/* ASP.NET combines class, method and verb templates; one that starts with "~/" or "/" ignores the ones before. */
const compose = (...parts) => {
  const kept = [];
  for (const part of parts.reverse()) {
    if (part.startsWith('~/') || part.startsWith('/')) {
      kept.unshift(part.replace(/^~?\//, ''));
      break;
    }
    kept.unshift(part);
  }
  return kept.filter(Boolean).join('/');
};
const routes = [];
for (const file of filesUnder(join(apiRoot, 'Controllers'))) {
  let pending = [],
    classRoutes = [''];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const text = line.trim();
    if (text.startsWith('[')) {
      for (const [, name, template] of text.matchAll(
        /\b(Route|Http(?:Get|Post|Put|Patch|Delete))\b(?:\(\s*"([^"]*)")?/g
      ))
        pending.push({ name, template: template ?? '' });
      continue;
    }
    if (/\bclass\b/.test(text)) {
      const found = pending.filter(a => a.name === 'Route').map(a => a.template);
      classRoutes = found.length ? found : [''];
      pending = [];
    } else if (/^public\b.*\(/.test(text)) {
      const methodRoute = pending.find(a => a.name === 'Route')?.template ?? '';
      for (const verb of pending.filter(a => a.name !== 'Route'))
        for (const prefix of classRoutes)
          routes.push({
            method: verb.name.slice(4).toUpperCase(),
            template: compose(prefix, methodRoute, verb.template),
            file: file.slice(apiRoot.length + 1)
          });
      pending = [];
    } else if (text && !text.startsWith('//') && !text.startsWith('///')) pending = [];
  }
}
for (const [, verb, template] of readFileSync(join(apiRoot, 'Program.cs'), 'utf8').matchAll(
  /\bMap(Get|Post|Put|Patch|Delete)\(\s*"([^"]+)"/g
))
  routes.push({ method: verb.toUpperCase(), template: template.replace(/^\//, ''), file: 'Program.cs' });
for (const route of routes) route.segments = route.template.split('/').filter(Boolean);

const segmentMatches = (pattern, actual) =>
  pattern.includes('{') ? actual.length > 0 : pattern.toLowerCase() === actual.toLowerCase();
const matches = (route, request) => {
  if (request.method !== '*' && route.method !== request.method) return false;
  const last = route.segments.at(-1) || '';
  if (last.startsWith('{*') || last.startsWith('{**'))
    return (
      request.segments.length >= route.segments.length &&
      route.segments.slice(0, -1).every((p, i) => segmentMatches(p, request.segments[i]))
    );
  return (
    route.segments.length === request.segments.length &&
    route.segments.every((p, i) => segmentMatches(p, request.segments[i]))
  );
};

/* 3. The report. */
const gapsFile = here('route-gaps.json');
const known = existsSync(gapsFile) ? JSON.parse(readFileSync(gapsFile, 'utf8')) : [];
const gapFor = key =>
  known.find(gap => {
    const [method, path] = gap.route.split(' ');
    return matches({ method, segments: path.slice(1).split('/') }, requests.get(key));
  });
const unmatched = [...requests]
  .filter(([, request]) => !routes.some(route => matches(route, request)))
  .map(([key]) => key)
  .sort();
const unknown = unmatched.filter(key => !gapFor(key));

console.log(
  `routes: ${routes.length} API routes, ${requests.size} distinct frontend requests, ` +
    `${requests.size - unmatched.length} matched, ${unmatched.length} unmatched ` +
    `(${unmatched.length - unknown.length} known gaps, ${unknown.length} new)`
);
for (const key of unmatched) {
  const gap = gapFor(key),
    source = requests.get(key).source;
  console.log(`  ${gap ? 'known' : 'NEW  '} ${key}${source ? `  (${source})` : ''}${gap ? ` - ${gap.reason}` : ''}`);
}
const stale = known.filter(gap => !unmatched.some(key => gapFor(key) === gap));
for (const gap of stale)
  console.log(`  closed ${gap.route}: an API route answers it now; remove it from route-gaps.json`);
if (strict && unknown.length) {
  console.error(`check-routes: ${unknown.length} request(s) have no API route and are not listed in route-gaps.json.`);
  process.exit(1);
}
