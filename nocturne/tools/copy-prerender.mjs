import { copyFileSync, existsSync } from 'node:fs';
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

// Also copy index.html and 404.html to dist/
const distRoot = resolve(root, 'dist');
if (existsSync(srcHtml)) {
  copyFileSync(srcHtml, resolve(distRoot, 'index.html'));
  console.log('✓ Prerendered index.html copied to dist/index.html');
}
if (existsSync(src404)) {
  copyFileSync(src404, resolve(distRoot, '404.html'));
  console.log('✓ Prerendered 404.html copied to dist/404.html');
}
