/* Purpose: after `vite build`, renders the product page (landing.html) once in English with React's server renderer and writes the
   markup into dist/landing.html, so crawlers, link previews and visitors without JavaScript see the page's text (owner "go" for
   hardening T5 / QA bug 4, 26 November 2026). The browser then attaches to it (hydrateRoot in src/landing/main.jsx).
   Main steps: load src/landing/Landing.jsx through Vite's server-side module loader (no new package), render <Landing initialLang="en"/>,
   replace the contents of <div id="root"> in the built page. Fails the build if the root or the rendered text is missing. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const page = fileURLToPath(new URL('../dist/landing.html', import.meta.url));

const vite = await createServer({
  root,
  logLevel: 'error',
  server: { middlewareMode: true },
  appType: 'custom',
  // no dependency pre-bundling: one module graph is rendered once, and the scan would outlive the server
  optimizeDeps: { noDiscovery: true, include: [] }
});
try {
  const { Landing } = await vite.ssrLoadModule('/src/landing/Landing.jsx');
  const markup = renderToString(createElement(Landing, { initialLang: 'en' }));
  if (markup.length < 2000) throw new Error('The product page rendered almost nothing; refusing to write it.');
  const html = readFileSync(page, 'utf8');
  // The root holds only the loading placeholder (<div class="boot">…</div>); it is replaced by the page. A function replacement keeps
  // any $ in the text literal.
  const placeholder = /(<div id="root"[^>]*>)<div class="boot"[\s\S]*?<\/i><\/div><\/div>(<\/div>)/;
  if (!placeholder.test(html))
    throw new Error('dist/landing.html: the root and its loading placeholder were not found.');
  writeFileSync(
    page,
    html.replace(placeholder, (_, open, close) => open + markup + close)
  );
  console.log(`prerender: landing.html ${Math.round(markup.length / 1024)} KB of page text`);
} finally {
  await vite.close();
}
