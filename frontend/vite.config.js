/* Purpose: builds the React frontend (public site, portal and sign-in, product page) and serves it in
   development beside the .NET API.
   Main parts: three page entries; images, fonts, sw.js and the manifest copied from public/; a dev
   server on HTTPS that proxies /api to ParishLife.Api.

   The API's cookies are `__Host-` cookies, Secure and SameSite=Strict, and it has no CORS: the browser
   must reach the pages and /api from the same HTTPS origin. In development Vite is that origin and
   forwards /api; in production the pages and the API must be served behind one host. */
import { createLogger, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path => fileURLToPath(new URL(path, import.meta.url));
const api = process.env.PARISHLIFE_API || 'https://localhost:7243';

/* The .NET development certificate, exported once (see frontend/README.md). Without it the dev server
   falls back to plain HTTP, where the API's Secure cookies only work in browsers that treat localhost
   as a secure origin. */
const cert = here('.cert/localhost.pem'),
  key = here('.cert/localhost.key');
const https = existsSync(cert) && existsSync(key) ? { cert: readFileSync(cert), key: readFileSync(key) } : undefined;

/* A few actions use import() to run after the current click has finished, not to split code. */
const logger = createLogger();
const quiet = message => /dynamic import will not move module into another chunk/.test(message);
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
  build: {
    outDir: here('dist'),
    emptyOutDir: true,
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
  server: {
    port: 5173,
    https,
    proxy: {
      // the development certificate is self-signed, so the proxy does not verify it
      '/api': { target: api, changeOrigin: false, secure: false },
      '/health': { target: api, changeOrigin: false, secure: false }
    }
  }
});
