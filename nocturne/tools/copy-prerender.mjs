import { copyFileSync, existsSync, cpSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcHtml = resolve(root, 'dist/server/prerendered-routes/index.html');
const destClientHtml = resolve(root, 'dist/client/index.html');
const src404 = resolve(root, 'dist/server/prerendered-routes/404.html');
const destClient404 = resolve(root, 'dist/client/404.html');

if (existsSync(srcHtml)) {
  copyFileSync(srcHtml, destClientHtml);
  console.log('✓ Copied index.html -> dist/client/index.html');
} else {
  console.warn('⚠️ Warning: dist/server/prerendered-routes/index.html not found');
}

if (existsSync(src404)) {
  copyFileSync(src404, destClient404);
  console.log('✓ Copied 404.html -> dist/client/404.html');
}

// Also ensure dist/ has index.html and all static assets in case Vercel output is set to 'dist'
const distRoot = resolve(root, 'dist');
const distClient = resolve(root, 'dist/client');

if (existsSync(destClientHtml)) {
  copyFileSync(destClientHtml, resolve(distRoot, 'index.html'));
  console.log('✓ Copied index.html -> dist/index.html');
}
if (existsSync(destClient404)) {
  copyFileSync(destClient404, resolve(distRoot, '404.html'));
  console.log('✓ Copied 404.html -> dist/404.html');
}

// Copy _next, models, materials, environment into dist/ root for Vercel static serving
const folders = ['_next', 'models', 'materials', 'environment', 'project-covers', 'profile', 'resumes'];
for (const folder of folders) {
  const src = resolve(distClient, folder);
  const dest = resolve(distRoot, folder);
  if (existsSync(src)) {
    cpSync(src, dest, { recursive: true });
    console.log(`✓ Synced ${folder} -> dist/${folder}`);
  }
}

// Copy root static files
const rootFiles = ['favicon.svg', 'graveyard.webp', 'graveyard.png', 'og.png'];
for (const file of rootFiles) {
  const src = resolve(distClient, file);
  const dest = resolve(distRoot, file);
  if (existsSync(src)) {
    copyFileSync(src, dest);
    console.log(`✓ Copied ${file} -> dist/${file}`);
  }
}

console.log('✨ Build artifact packaging complete for Vercel deployment!');
