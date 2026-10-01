import { copyFileSync, existsSync, readdirSync, cpSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcHtml = resolve(root, 'dist/server/prerendered-routes/index.html');
const destClientHtml = resolve(root, 'dist/client/index.html');
const src404 = resolve(root, 'dist/server/prerendered-routes/404.html');
const destClient404 = resolve(root, 'dist/client/404.html');

if (existsSync(srcHtml)) {
  copyFileSync(srcHtml, destClientHtml);
  console.log('✓ Prerendered index.html copied to dist/client/index.html');
} else {
  console.warn('⚠️ Warning: dist/server/prerendered-routes/index.html not found');
}

if (existsSync(src404)) {
  copyFileSync(src404, destClient404);
  console.log('✓ Prerendered 404.html copied to dist/client/404.html');
}

// Copy everything from dist/client to dist/ so Vercel finds all assets regardless of whether Output Directory is 'dist' or 'dist/client'
const distRoot = resolve(root, 'dist');
const distClient = resolve(root, 'dist/client');

if (existsSync(distClient)) {
  for (const entry of readdirSync(distClient)) {
    const srcPath = resolve(distClient, entry);
    const destPath = resolve(distRoot, entry);
    const stat = statSync(srcPath);
    if (stat.isDirectory()) {
      cpSync(srcPath, destPath, { recursive: true, force: true });
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
  console.log('✓ Synced all dist/client assets into dist/ root for Vercel');
}
