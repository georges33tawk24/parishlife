// Draws the sanctuary window's design (docs/tools/sanctuary_window.mjs) in layers, each a PNG, for
// docs/tools/render_sanctuary.py to give them their materials and light:
//   glass     the coloured pieces, without lead
//   lead      the lead between the pieces: black lines on white glass
//   tracery   the carved stone ribs over the glass and the frames of the openings, white
//   stone     the outline of the surround and the sill, white
//   openings  the openings the glass fills, white
//
//   node docs/tools/sanctuary_layers.mjs /tmp/sanctuary [scale] [variant ...]
//
// A variant is name:ground:left:right, e.g. window:deep:cedar:chalice (the default) or
// parish-wine:wine:blank:cedar; each is drawn into its own folder. It needs Playwright with
// Chromium (npm i playwright; npx playwright install chromium).
import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { windowDrawing, GLASS_OPENINGS } from './sanctuary_window.mjs';

const [out = '/tmp/sanctuary', scaleArg = '2', ...asked] = process.argv.slice(2);
const variants = (asked.length ? asked : ['window:deep:cedar:chalice']).map(v => v.split(':'));
const scale = Number(scaleArg);
const require = createRequire(import.meta.url);
let playwright;
for (const at of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { playwright = require(at); break; } catch { /* try the next */ } }
if (!playwright) throw new Error('Playwright is needed: npm i playwright');

const W = 1080 * scale, H = 1300 * scale;
const openings = `<svg viewBox="-40 0 1080 1300" xmlns="http://www.w3.org/2000/svg"><g fill="#fff">${Object.values(GLASS_OPENINGS).join('')}</g></svg>`;
// Each layer is the same drawing with everything else hidden.
const LAYERS = {
  glass: '.glass *{stroke:none!important}.stone,.tracery{display:none}',
  lead: '.glass *{fill:#fff!important}.stone,.tracery{display:none}',
  tracery: '.glass,.stone{display:none}',
  stone: '.glass,.tracery{display:none}',
  openings: ''
};

const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
for (const [name, ground, left, right] of variants) {
  const dir = join(out, name), svg = windowDrawing({ ground, left, right });
  mkdirSync(dir, { recursive: true });
  for (const [layer, css] of Object.entries(LAYERS)) {
    await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${W}px;height:${H}px}${css}</style>${layer === 'openings' ? openings : svg}`);
    await page.screenshot({ path: join(dir, `${layer}.png`), omitBackground: true, clip: { x: 0, y: 0, width: W, height: H } });
  }
  writeFileSync(join(dir, 'window.json'), JSON.stringify({ width: W, height: H, viewBox: [-40, 0, 1080, 1300], scale }));
  console.log('drew', name);
}
await browser.close();
