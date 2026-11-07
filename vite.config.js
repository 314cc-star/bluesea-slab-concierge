import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';
import { injectSeo } from './server/seo.js';

// Dev only: add the same product data to index.html that Express adds in production.
const seoInDev = {
  name: 'bsw-seo-dev',
  apply: 'serve',
  async transformIndexHtml(html) {
    const slabs = JSON.parse(await readFile(new URL('./data/slabs.json', import.meta.url), 'utf8'));
    return injectSeo(html, slabs, 'http://localhost:5173');
  },
};

export default defineConfig({
  root: 'client',
  plugins: [react(), seoInDev],
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      ['/api', '/photos', '/mcp', '/llms.txt', '/robots.txt'].map((p) => [p, 'http://localhost:3001']),
    ),
  },
});
