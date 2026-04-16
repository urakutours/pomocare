#!/usr/bin/env node
/**
 * Post-build script: creates static entry points for SPA routes that must
 * return HTTP 200 on GitHub Pages (e.g. /account-deletion/ required by
 * Google Play Store listing). Each route gets a copy of dist/index.html.
 *
 * The React app reads window.location.pathname at mount and renders the
 * appropriate page, so these static copies just need to boot the SPA.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const indexHtml = join(distDir, 'index.html');

if (!existsSync(indexHtml)) {
  console.error('[post-build] dist/index.html not found. Run `vite build` first.');
  process.exit(1);
}

const html = readFileSync(indexHtml, 'utf8');

// List of SPA routes that need a physical HTML file for 200 response.
const routes = ['account-deletion'];

for (const route of routes) {
  const routeDir = join(distDir, route);
  if (!existsSync(routeDir)) mkdirSync(routeDir, { recursive: true });
  writeFileSync(join(routeDir, 'index.html'), html);
  console.log(`[post-build] wrote dist/${route}/index.html`);
}
