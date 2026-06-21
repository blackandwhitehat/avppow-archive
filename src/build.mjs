import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve('.');
const sourceRoot = path.join(projectRoot, 'content');
const distRoot = path.join(projectRoot, 'dist');
const site = {
  name: 'AVPPOW Archive',
  originalHost: 'avppow.dyndns.org',
  author: 'AvPPoW',
};

const ratingLabels = new Map([
  ['0', '0'],
  ['0.5', '0.5'],
  ['1', '1'],
  ['1.5', '1.5'],
  ['2', '2'],
  ['2.5', '2.5'],
  ['3', '3'],
  ['3.5', '3.5'],
  ['4', '4'],
  ['4.5', '4.5'],
  ['5', '5'],
]);

function esc(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replaceAll('&', 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatDate(epoch) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  }).format(new Date(Number(epoch) * 1000));
}

function cleanHtml(fragment) {
  return String(fragment)
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replace(/https?:\/\/avppow\.dyndns\.org\/\?view=reviews&review=([^"'\s<>]+)/gi, (_m, file) => `/reviews/${slugify(file.replace(/\.txt$/i, ''))}/`)
    .replace(/https?:\/\/avppow\.dyndns\.org\/\?view=print&review=([^"'\s<>]+)/gi, (_m, file) => `/reviews/${slugify(file.replace(/\.txt$/i, ''))}/`)
    .replace(/https?:\/\/avppow\.dyndns\.org\/Reviews\/Images\//gi, '/assets/reviews/images/')
    .replace(/https?:\/\/avppow\.dyndns\.org\/reviews\/images\//gi, '/assets/reviews/images/')
    .replace(/https?:\/\/avppow\.dyndns\.org\/Reviews\/Images\/Rogue%20Spear\//gi, '/assets/reviews/images/Rogue%20Spear/')
    .replace(/https?:\/\/avppow\.dyndns\.org\/Reviews\/Images\/Rogue Spear\//gi, '/assets/reviews/images/Rogue%20Spear/')
    .replace(/<br\s*\/?>/gi, '<br>')
    .replace(/<p>/gi, '<p>')
    .replace(/<P>/g, '<p>')
    .replace(/<I>/g, '<em>')
    .replace(/<\/I>/g, '</em>')
    .replace(/<A /g, '<a ')
    .replace(/<\/A>/g, '</a>')
    .replace(/<IMG /g, '<img ')
    .replace(/\s+align="(?:left|right)"/gi, '')
    .replace(/\s+hspace="\d+"/gi, '')
    .replace(/\s+vspace="\d+"/gi, '')
    .replace(/\s+space="\d+"/gi, '')
    .replace(/\s+border="\d+"/gi, '')
    .replace(/<center>/gi, '<div class="center">')
    .replace(/<\/center>/gi, '</div>');
}

function page({ title, section, body, description = '' }) {
  const nav = [
    ['/', 'News'],
    ['/journal/', 'Journal'],
    ['/reviews/', 'Reviews'],
    ['/archive/', 'Archive'],
    ['/about/', 'About'],
  ];
  const links = nav.map(([href, label]) => {
    const active = section === label.toLowerCase() ? ' aria-current="page"' : '';
    return `<a href="${href}"${active}>${label}</a>`;
  }).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} | ${site.name}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="stylesheet" href="/assets/site.css">
</head>
<body>
  <div class="shell">
    <header class="site-header">
      <a class="brand" href="/" aria-label="${site.name}">
        <img src="/assets/titlebar.gif" alt="${site.name}">
      </a>
      <nav class="nav" aria-label="Primary">${links}</nav>
      <div class="crumb">main / ${esc(section)}</div>
    </header>
    <main>
      ${body}
    </main>
    <footer>
      <img src="/assets/copyright.gif" alt="">
      <p>Static archive of ${site.originalHost}. Coranto CGI and admin tools retired.</p>
    </footer>
  </div>
</body>
</html>
`;
}

async function writePage(route, html) {
  const dir = path.join(distRoot, route);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), html);
}

async function readText(file) {
  return readFile(path.join(sourceRoot, file), 'utf8');
}

function parseCoranto(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line.split('``x');
      return {
        title: parts[0],
        author: parts[1],
        body: parts[2],
        id: parts[3],
        timestamp: Number(parts[4]),
        category: parts[5],
        platform: parts[6],
        reviewTitle: parts[7],
        buyUrl: parts[8],
        boxshot: parts[9],
        graphics: parts[10],
        graphicsRating: parts[11],
        gameplay: parts[12],
        controls: parts[13],
        controlsRating: parts[14],
        gameplayRating: parts[15],
        sound: parts[16],
        soundRating: parts[17],
        multiplayer: parts[18],
        multiplayerRating: parts[19],
        finalThoughts: parts[20],
        overallRating: parts[21],
      };
    })
    .filter((item) => Number.isFinite(item.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp);
}

function rating(value) {
  const normalized = ratingLabels.get(String(value));
  if (normalized === undefined) {
    return '';
  }
  return `<span class="rating" aria-label="${normalized} out of 5">${normalized}/5</span>`;
}

function postCard(item) {
  return `<article class="post-card" id="${esc(item.id)}">
  <header>
    <p class="meta">${formatDate(item.timestamp)} / ${esc(item.category)} / ${esc(item.author)}</p>
    <h2>${esc(item.title)}</h2>
  </header>
  <div class="prose">${cleanHtml(item.body)}</div>
</article>`;
}

function archiveList(items) {
  return `<div class="archive-list">
${items.map((item) => `<a href="/archive/#${esc(item.id)}"><span>${esc(item.title)}</span><time>${formatDate(item.timestamp)}</time><small>${esc(item.category)}</small></a>`).join('\n')}
</div>`;
}

function reviewSummary(review) {
  return `<a class="review-card" href="/reviews/${review.slug}/">
  ${review.boxshot ? `<img src="${review.boxshot}" alt="">` : '<div class="cover-placeholder">PC</div>'}
  <span>
    <strong>${esc(review.title)}</strong>
    <small>${esc(review.platform)} / ${review.overallRating}/5</small>
  </span>
</a>`;
}

function transformReviewHtml(raw) {
  return cleanHtml(raw)
    .replace(/<img src="\/assets\/reviews\/images\/rating([0-9.]+)\.gif" alt="[^"]*">/g, (_m, value) => rating(value));
}

function reviewFromEntry(entry, fileName) {
  const slug = slugify(fileName.replace(/\.txt$/i, ''));
  const boxshot = entry.boxshot ? cleanHtml(entry.boxshot) : '';
  return {
    slug,
    fileName,
    title: entry.reviewTitle,
    platform: entry.platform,
    timestamp: entry.timestamp,
    buyUrl: entry.buyUrl,
    boxshot,
    overallRating: entry.overallRating,
    entry,
  };
}

async function build() {
  await rm(distRoot, { recursive: true, force: true });
  await mkdir(path.join(distRoot, 'assets', 'reviews'), { recursive: true });
  await cp(path.join(sourceRoot, 'Reviews', 'Images'), path.join(distRoot, 'assets', 'reviews', 'images'), {
    recursive: true,
    filter: (src) => !src.endsWith('Thumbs.db') && !src.endsWith('index.html'),
  });
  for (const asset of ['bg.gif', 'copyright.gif', 'titlebar.gif', 'titlebarbg.gif', 'fun.gif', 'gade.JPG']) {
    await cp(path.join(sourceRoot, asset), path.join(distRoot, 'assets', asset));
  }
  await writeFile(path.join(distRoot, 'assets', 'site.css'), siteCss);

  const items = parseCoranto(await readText('newsdat.txt'));
  const reviewEntries = items.filter((item) => item.category === 'reviews');
  const reviewFiles = [
    ['GraalOnline.txt', reviewEntries.find((item) => item.reviewTitle === 'Graal Online')],
    ['OmikronTheNomadSoul.txt', reviewEntries.find((item) => item.reviewTitle === 'Omikron: The Nomad Soul')],
    ['RainbowSixRogueSpear.txt', reviewEntries.find((item) => item.reviewTitle === 'Rainbow Six: Rogue Spear')],
    ['RedFaction.txt', reviewEntries.find((item) => item.reviewTitle === 'Red Faction')],
  ].map(([fileName, entry]) => reviewFromEntry(entry, fileName));

  const newsItems = items.filter((item) => item.category === 'news');
  const journalItems = items.filter((item) => item.category === 'journal');

  await writePage('', page({
    title: 'News',
    section: 'news',
    description: 'Static archive of AVPPOW news posts and PC game reviews.',
    body: `<section class="hero">
  <div>
    <p class="eyebrow">2002 Coranto archive</p>
    <h1>AVPPOW news, journal notes, and PC game reviews.</h1>
    <p>This static Cloudflare Pages port preserves the readable site content while retiring the Perl CGI backend.</p>
  </div>
  <img src="/assets/fun.gif" alt="">
</section>
<section class="grid two">
  <div>
    <div class="section-head"><span>Latest news</span><a href="/archive/">Full archive</a></div>
    ${newsItems.slice(0, 6).map(postCard).join('\n')}
  </div>
  <aside>
    <div class="section-head"><span>Reviews</span><a href="/reviews/">All reviews</a></div>
    <div class="review-grid compact">${reviewFiles.map(reviewSummary).join('\n')}</div>
  </aside>
</section>`,
  }));

  await writePage('journal', page({
    title: 'Journal',
    section: 'journal',
    body: `<section class="page-title"><h1>Journal</h1><p>Personal updates recovered from the Coranto data files.</p></section>${journalItems.map(postCard).join('\n')}`,
  }));

  await writePage('archive', page({
    title: 'Archive',
    section: 'archive',
    body: `<section class="page-title"><h1>Archive</h1><p>${items.length} recovered posts sorted by original timestamp.</p></section>${archiveList(items)}<section>${items.map(postCard).join('\n')}</section>`,
  }));

  await writePage('about', page({
    title: 'About',
    section: 'about',
    body: `<section class="page-title"><h1>About</h1><p>The original about page only said: <strong>about me k bye</strong>.</p></section>
<article class="post-card"><div class="prose"><p>This version is a static preservation of an early-2000s personal gaming site. The live Perl CMS, admin links, upload handlers, binary downloads, and automation scripts have been removed for safety and maintainability.</p></div></article>`,
  }));

  await writePage('reviews', page({
    title: 'Reviews',
    section: 'reviews',
    body: `<section class="page-title"><h1>Reviews</h1><p>Recovered PC reviews with original screenshots, box art, and ratings.</p></section><div class="review-grid">${reviewFiles.map(reviewSummary).join('\n')}</div>`,
  }));

  for (const review of reviewFiles) {
    const raw = await readText(path.join('Reviews', review.fileName));
    await writePage(path.join('reviews', review.slug), page({
      title: review.title,
      section: 'reviews',
      description: `${review.title} review from the AVPPOW archive.`,
      body: `<article class="review-article">${transformReviewHtml(raw)}</article>`,
    }));
  }

  await writeFile(path.join(projectRoot, 'READY.md'), `READY\n\nStatic port built at: ${projectRoot}\nGenerated output: ${distRoot}\n\nNext steps: create GitHub repo, push this project, and configure Cloudflare Pages with build command npm run build and output directory dist.\n`);
}

const siteCss = `:root {
  color-scheme: light;
  --bg: #d7d7d7;
  --panel: #ffffff;
  --panel-2: #f2f2f2;
  --ink: #111111;
  --muted: #5d6470;
  --line: #000000;
  --accent: #0090ff;
  --accent-soft: rgba(0, 144, 255, .12);
  --shadow: 0 18px 40px rgba(0, 0, 0, .16);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg) url("/assets/bg.gif");
  color: var(--ink);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 15px;
  line-height: 1.55;
}

a {
  color: var(--ink);
  text-decoration: none;
}

a:hover {
  color: var(--accent);
}

img {
  max-width: 100%;
  height: auto;
}

.shell {
  width: min(980px, calc(100% - 24px));
  min-height: 100vh;
  margin: 0 auto;
  background: var(--panel);
  border-left: 1px solid var(--line);
  border-right: 1px solid var(--line);
  box-shadow: var(--shadow);
}

.site-header {
  display: grid;
  grid-template-columns: 193px 1fr;
  grid-template-areas:
    "brand nav"
    "brand crumb";
  border-bottom: 1px solid #c8c8c8;
  background: linear-gradient(#e1e1e1, #f8f8f8);
}

.brand {
  grid-area: brand;
  display: block;
  min-height: 49px;
  background: url("/assets/titlebarbg.gif");
}

.brand img {
  display: block;
  width: 193px;
  height: 49px;
}

.nav {
  grid-area: nav;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 18px;
  padding: 9px 16px 6px;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
}

.nav a[aria-current="page"] {
  color: var(--accent);
}

.crumb {
  grid-area: crumb;
  padding: 5px 18px;
  background: #e8e8e8;
  color: var(--muted);
  font-size: 13px;
}

main {
  padding: 24px;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 250px;
  gap: 24px;
  align-items: center;
  padding: 24px;
  margin-bottom: 24px;
  border: 1px solid #d5d5d5;
  background: linear-gradient(135deg, #ffffff, #eef7ff);
}

.hero h1,
.page-title h1 {
  margin: 0 0 10px;
  font-size: clamp(28px, 4vw, 48px);
  line-height: 1.02;
  letter-spacing: 0;
}

.hero p,
.page-title p {
  max-width: 680px;
  margin: 0;
  color: var(--muted);
}

.eyebrow {
  margin-bottom: 12px !important;
  color: var(--accent) !important;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.grid.two {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 24px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 0 0 12px;
  padding: 9px 12px;
  background: var(--panel-2);
  border: 1px solid #d9d9d9;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
}

.section-head a {
  color: var(--accent);
  font-size: 12px;
}

.page-title {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #d9d9d9;
}

.post-card,
.review-article {
  margin-bottom: 18px;
  padding: 18px;
  border: 1px solid #d9d9d9;
  background: #ffffff;
}

.post-card h2 {
  margin: 0 0 8px;
  font-size: 22px;
}

.meta {
  margin: 0 0 5px;
  color: var(--muted);
  font-size: 12px;
  text-transform: uppercase;
}

.prose p,
.review-article p {
  margin: 0 0 1em;
}

.review-article > img:first-child {
  float: right;
  width: min(180px, 42vw);
  margin: 0 0 16px 18px;
  border: 1px solid #cccccc;
  background: #f5f5f5;
}

.review-article img:not(:first-child) {
  margin: 8px 14px 8px 0;
  border: 1px solid #d1d1d1;
  vertical-align: middle;
}

.review-article strong {
  font-size: 18px;
}

.rating {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 8px;
  color: #b07200;
  font-weight: 700;
  white-space: nowrap;
}

.rating span {
  color: var(--muted);
  font-size: 12px;
}

.review-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 14px;
}

.review-grid.compact {
  grid-template-columns: 1fr;
}

.review-card {
  display: grid;
  grid-template-columns: 76px 1fr;
  gap: 12px;
  align-items: center;
  min-height: 104px;
  padding: 10px;
  border: 1px solid #d6d6d6;
  background: linear-gradient(#ffffff, #f4f4f4);
}

.review-card:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.review-card img,
.cover-placeholder {
  width: 76px;
  height: 92px;
  object-fit: cover;
  border: 1px solid #bfbfbf;
  background: #eeeeee;
}

.review-card strong {
  display: block;
  margin-bottom: 4px;
}

.review-card small {
  color: var(--muted);
}

.archive-list {
  display: grid;
  gap: 8px;
  margin-bottom: 24px;
}

.archive-list a {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 170px 80px;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #d9d9d9;
  background: #ffffff;
}

.archive-list time,
.archive-list small {
  color: var(--muted);
}

.center {
  text-align: center;
}

footer {
  padding: 24px;
  border-top: 1px solid #d9d9d9;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}

footer img {
  display: block;
  margin: 0 auto 10px;
}

@media (max-width: 760px) {
  .shell {
    width: 100%;
    border: 0;
  }

  .site-header,
  .hero,
  .grid.two {
    grid-template-columns: 1fr;
  }

  .site-header {
    grid-template-areas:
      "brand"
      "nav"
      "crumb";
  }

  .brand img {
    margin: 0 auto;
  }

  main {
    padding: 16px;
  }

  .hero {
    padding: 18px;
  }

  .hero img {
    max-width: 220px;
  }

  .archive-list a {
    grid-template-columns: 1fr;
  }
}
`;

await build();
