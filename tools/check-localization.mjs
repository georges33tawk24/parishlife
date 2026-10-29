import fs from 'node:fs';
import path from 'node:path';
const walk = folder => fs.readdirSync(folder, { withFileTypes: true }).flatMap(x =>
  ['bin', 'obj'].includes(x.name) ? [] : x.isDirectory() ? walk(path.join(folder, x.name)) : [path.join(folder, x.name)]);
const root = 'src/ParishLive.Web/Resources/';
const resources = ['en', 'fr', 'ar'].map(lang => new Set([...fs.readFileSync(root + (lang === 'en' ? 'SharedResource.resx' : `SharedResource.${lang}.resx`), 'utf8').matchAll(/<data name="([^"]+)"/g)].map(m => m[1])));
const used = new Set();
for (const file of walk('src').filter(f => /\.(cshtml|cs)$/.test(f))) {
  const code = fs.readFileSync(file, 'utf8');
  for (const m of code.matchAll(/\bL\["([^"]+)"\s*\]/g)) used.add(m[1]);
  for (const m of code.matchAll(/"(Error\.[A-Za-z0-9]+)"/g)) used.add(m[1]);
}
let missing = false;
for (const [i, language] of ['en', 'fr', 'ar'].entries()) {
  const absent = [...used].filter(key => !resources[i].has(key)).sort();
  console.log(language, absent.length ? absent.join('\n') : 'All literal UI and error keys present.');
  if (absent.length) missing = true;
}
process.exitCode = missing ? 1 : 0;
