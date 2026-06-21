import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const htmlFiles = [];

async function walk(dir) {
  for (const name of await readdir(dir)) {
    const full = path.join(dir, name);
    const info = await stat(full);
    if (info.isDirectory()) {
      await walk(full);
    } else if (name.endsWith('.html')) {
      htmlFiles.push(full);
    }
  }
}

function routeToFile(fromFile, href) {
  if (href.startsWith('http:') || href.startsWith('https:') || href.startsWith('mailto:') || href.startsWith('#')) {
    return null;
  }
  const clean = href.split('#')[0].split('?')[0];
  if (clean === '') {
    return null;
  }
  const base = clean.startsWith('/') ? root : path.dirname(fromFile);
  const resolved = path.resolve(base, clean.replace(/^\//, ''));
  if (clean.endsWith('/')) {
    return path.join(resolved, 'index.html');
  }
  if (path.extname(resolved) === '') {
    return path.join(resolved, 'index.html');
  }
  return resolved;
}

await walk(root);
const missing = [];
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const target = routeToFile(file, match[1]);
    if (target === null) {
      continue;
    }
    try {
      await stat(target);
    } catch {
      missing.push(`${path.relative(root, file)} -> ${match[1]}`);
    }
  }
}

if (missing.length > 0) {
  console.error(missing.join('\n'));
  process.exit(1);
}

console.log(`Checked ${htmlFiles.length} HTML files.`);
