/* The React frontend builds into the paths server.py and the Cloudflare Worker already serve:
   index.html, public.html and landing.html at the repository root, and the scripts and styles
   under assets/app/. Images and fonts stay where they are (assets/images, assets/fonts) and are
   referenced by their absolute paths, so the build never copies them. */
import { createLogger, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const here = path => fileURLToPath(new URL(path, import.meta.url));
const server = 'http://127.0.0.1:4399';

/* Three notices describe how this project is meant to work, so the build leaves them out and any
   other warning stands out:
   - the stylesheets' images and fonts are served from assets/, not built;
   - the pages are written to the repository root, the parent of this folder, on purpose;
   - a few actions use import() to run after the current click has finished, not to split code. */
const logger = createLogger();
const expected = [
  /\/assets\/(images|fonts)\/\S+ referenced in .* didn't resolve at build time/,
  /build\.outDir must not be the same directory of root or a parent directory of root/,
  /dynamic import will not move module into another chunk/
];
const quiet = message => expected.some(pattern => pattern.test(message));
const { warn, warnOnce } = logger;
logger.warn = (message, options) => {
  if (!quiet(message)) warn(message, options);
};
logger.warnOnce = (message, options) => {
  if (!quiet(message)) warnOnce(message, options);
};

export default defineConfig({
  plugins: [react()],
  customLogger: logger,
  publicDir: false,
  build: {
    outDir: here('..'),
    emptyOutDir: false,
    assetsDir: 'assets/app',
    assetsInlineLimit: 0,
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: { portal: here('index.html'), public: here('public.html'), landing: here('landing.html') },
      /* React itself is shared by the three pages, in a file of its own */
      output: {
        manualChunks: id => (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id) ? 'react' : undefined)
      }
    }
  },
  /* `npm run dev` beside server.py: the API, the images and the fonts come from it. */
  server: {
    port: 5173,
    proxy: {
      '/api': server,
      '/assets/images': server,
      '/assets/fonts': server,
      '/sw.js': server,
      '/site.webmanifest': server
    }
  }
});
