import fs from 'node:fs';
const root = 'src/ParishLive.Web/Resources/';
const data = JSON.parse(fs.readFileSync('tools/localization.json', 'utf8'));
Object.assign(data, JSON.parse(fs.readFileSync('tools/localization-errors.json', 'utf8')),
  JSON.parse(fs.readFileSync('tools/localization-enums.json', 'utf8')));
Object.assign(data, JSON.parse(fs.readFileSync('tools/localization-auth.json', 'utf8')));
Object.assign(data, JSON.parse(fs.readFileSync('tools/localization-additions.json', 'utf8')));
Object.assign(data, JSON.parse(fs.readFileSync('tools/localization-finance.json', 'utf8')));
const french = JSON.parse(fs.readFileSync('tools/french.json', 'utf8'));
const source = fs.readFileSync('docs/ux-discovery/reviewed-answers/notification-matrix.md', 'utf8');
for (const m of source.matchAll(/^\| (M\d\d) \| (.*?) \| (.*?) \| (.*?) \|$/gm))
  data['Notice.' + m[1]] = m.slice(2, 5).map(s => s.replaceAll('{reference}', '{0}'));
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
for (const [index, lang] of ['en', 'fr', 'ar'].entries()) {
  let xml = fs.readFileSync(root + (lang === 'ar' ? 'SharedResource.ar.resx' : 'SharedResource.resx'), 'utf8');
  const write = (key, value) => {
    const row = `<data name="${key}" xml:space="preserve"><value>${escape(value)}</value></data>`;
    const re = new RegExp('<data name="' + key.replaceAll('.', '\\.') + '"[^>]*>[\\s\\S]*?</data>');
    xml = re.test(xml) ? xml.replace(re, () => row) : xml.replace('</root>', row + '\n</root>');
  };
  if (lang === 'fr') for (const [key, value] of Object.entries(french)) write(key, value);
  for (const [key, values] of Object.entries(data)) write(key, values[index]);
  fs.writeFileSync(root + (lang === 'en' ? 'SharedResource.resx' : `SharedResource.${lang}.resx`), xml);
}
