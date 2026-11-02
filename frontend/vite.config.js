/* The React frontend builds into the paths server.py and the Cloudflare Worker already serve:
   index.html, public.html and landing.html at the repository root, and the scripts and styles
   under assets/app/. Images and fonts stay where they are (assets/images, assets/fonts) and are
   referenced by their absolute paths, so the build never copies them. */
import { createLogger, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const here = path => fileURLToPath(new URL(path, import.meta.url));
const server = 'http://127.0.0.1:4399';

/* The stylesheets' images and fonts are served from assets/, not built: say nothing about them. */
const logger = createLogger();
const warn = logger.warn;
logger.warn = (message, options) => { if (!/^\/assets\/(images|fonts)\/.* didn't resolve at build time/.test(message)) warn(message, options); };

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
      input: { index: here('index.html'), public: here('public.html'), landing: here('landing.html') }
    }
  },
  /* `npm run dev` beside server.py: the API, the images and the fonts come from it. */
  server: {
    port: 5173,
    proxy: { '/api': server, '/assets/images': server, '/assets/fonts': server, '/sw.js': server, '/site.webmanifest': server }
  }
});
