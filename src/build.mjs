// build.mjs
// Static export of the 2002 avppow.dyndns.org Coranto Perl site.
// Reproduces what index.pl + layout.htm would have emitted for each
// view= action. Original markup + CSS + content preserved verbatim;
// only changes are:
//   1. internal href targets that pointed at http://avppow.dyndns.org/
//      get rewritten to relative paths so the static export resolves
//   2. the inline admin link to /News/coranto.pl is stripped (CGI gone)
//   3. no perl runtime - the action selector becomes the URL path

import { readFile, mkdir, copyFile, readdir, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const contentDir = path.join(root, 'content');
const distDir = path.join(root, 'dist');

const DYNDNS = 'http://avppow.dyndns.org';

function rewriteUrls(html) {
  return html
    .replace(/http:\/\/avppow\.dyndns\.org\/\?view=reviews&(?:amp;)?review=([A-Za-z0-9_-]+)\.txt/g, (_, n) => `/reviews/${n}/`)
    .replace(/http:\/\/avppow\.dyndns\.org\/\?view=reviews&(?:amp;)?letter=([A-Za-z])/g, (_, l) => `/reviews/letter/${l}/`)
    .replace(/http:\/\/avppow\.dyndns\.org\/\?view=([a-z]+)/g, (_, v) => `/${v}/`)
    .replace(/http:\/\/avppow\.dyndns\.org\/?(?=["'])/g, '/');
}

const NAV = rewriteUrls(`
<A HREF="${DYNDNS}/?view=news" CLASS="nav">NEWS</A>&nbsp;&nbsp;&nbsp;
<A HREF="${DYNDNS}/?view=about" CLASS="nav">ABOUT ME</A>&nbsp;&nbsp;&nbsp;
<A HREF="${DYNDNS}/?view=blerk" CLASS="nav">BLERK</A>&nbsp;&nbsp;&nbsp;
<A HREF="${DYNDNS}/?view=reviews" CLASS="nav">REVIEWS</A>&nbsp;&nbsp;&nbsp;
<A HREF="${DYNDNS}/?view=journal" CLASS="nav">JOURNAL</A>&nbsp;&nbsp;&nbsp;
<A HREF="${DYNDNS}/?view=links" CLASS="nav">LINKS</A>
`);

// from index.pl - $news = qq~ ... ~ literals for views without a data file
const INLINE = {
  about: `\nabout me k bye\n`,
  blerk: `\nfiles and stuff kthxdie\n`,
  links: `\ncoolsites\n`,
};

const secFor = (action) => `main·${action}`;

function render(layout, news, sec, opts = {}) {
  return layout
    .replace(/<!--NAV-->/g, NAV)
    .replace(/<!--SEC-->/g, `&nbsp;${sec}`)
    .replace(/<!--NEWS-->/g, () => {
      const lb = opts.linkbar ? `${opts.linkbar}\n` : '';
      return `${lb}${news}`;
    });
}

function stripAdminLink(layout) {
  return layout.replace(/<A HREF="[^"]*coranto\.pl" CLASS="admin">admin<\/A>/g, '');
}

// Make every relative asset reference in layout.htm absolute. The original
// markup uses bare filenames (HREF="index.css", SRC="titlebar.gif", etc.)
// which resolved against the page URL in 2002 - fine when every page was
// served at the same /index.pl path. Once we split into /about/, /journal/,
// /reviews/, etc., bare filenames resolve to /about/index.css which 404s.
// Rewrite to root-absolute. Same bytes served, just under a path that works.
function absolutizeAssets(layout) {
  const assets = ['index.css', 'titlebar.gif', 'titlebarbg.gif', 'bg.gif', 'copyright.gif', 'fun.gif', 'gade.JPG'];
  let out = layout;
  for (const a of assets) {
    const re = new RegExp(`((?:HREF|SRC|BACKGROUND)=")(?!\\/|http)${a.replace('.', '\\.')}(")`, 'g');
    out = out.replace(re, `$1/${a}$2`);
  }
  return out;
}

async function emit(outRel, html) {
  const target = path.join(distDir, outRel, 'index.html');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html);
}

async function copyTree(src, dst) {
  await mkdir(dst, { recursive: true });
  for (const name of await readdir(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    const st = await stat(s);
    if (st.isDirectory()) await copyTree(s, d);
    else await copyFile(s, d);
  }
}

async function copyAssets() {
  const passthrough = [
    'index.css', 'bg.gif', 'copyright.gif', 'titlebar.gif',
    'titlebarbg.gif', 'fun.gif', 'gade.JPG',
  ];
  for (const f of passthrough) {
    await copyFile(path.join(contentDir, f), path.join(distDir, f));
  }
  const reviewsImg = path.join(contentDir, 'Reviews', 'Images');
  if (existsSync(reviewsImg)) {
    await copyTree(reviewsImg, path.join(distDir, 'reviews', 'Images'));
  }
}

async function build() {
  await mkdir(distDir, { recursive: true });
  const layoutRaw = stripAdminLink(await readFile(path.join(contentDir, 'layout.htm'), 'utf8'));
  const layout = absolutizeAssets(rewriteUrls(layoutRaw));

  await copyAssets();

  const news = rewriteUrls(await readFile(path.join(contentDir, 'news.txt'), 'utf8'));
  const newsHtml = render(layout, news, secFor('news'));
  await emit('', newsHtml);
  await emit('news', newsHtml);

  await emit('about', render(layout, INLINE.about, secFor('about')));
  await emit('blerk', render(layout, INLINE.blerk, secFor('blerk')));
  await emit('links', render(layout, INLINE.links, secFor('links')));

  const journal = rewriteUrls(await readFile(path.join(contentDir, 'journal.txt'), 'utf8'));
  await emit('journal', render(layout, journal, secFor('journal')));

  const reviewList = rewriteUrls(await readFile(path.join(contentDir, 'reviewlist.txt'), 'utf8'));
  const linkbar = rewriteUrls(await readFile(path.join(contentDir, 'reviewlist-linkbar.txt'), 'utf8'));
  await emit('reviews', render(layout, reviewList, secFor('reviews'), { linkbar }));

  for (const L of ['G', 'H', 'O', 'R']) {
    const txt = rewriteUrls(await readFile(path.join(contentDir, `reviewlist-${L}.txt`), 'utf8'));
    await emit(`reviews/letter/${L}`, render(layout, txt, secFor('reviews'), { linkbar }));
  }

  const reviewsDir = path.join(contentDir, 'Reviews');
  for (const f of await readdir(reviewsDir)) {
    if (!f.endsWith('.txt')) continue;
    const slug = f.replace(/\.txt$/, '');
    const body = rewriteUrls(await readFile(path.join(reviewsDir, f), 'utf8'));
    await emit(`reviews/${slug}`, render(layout, body, secFor('reviews')));
  }

  console.log('built', distDir);
}

build().catch((e) => { console.error(e); process.exit(1); });
