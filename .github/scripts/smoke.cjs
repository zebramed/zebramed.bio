#!/usr/bin/env node
/*
 * Smoke test of the built site in a real browser.
 *
 * Usage: node smoke.cjs SITE_DIR [SCREENSHOT_DIR]
 *
 * Serves SITE_DIR the way GitHub Pages does, then loads every page at 375 and
 * 1440 wide and scrolls through it so the figures play. Fails on a console
 * error, an uncaught exception, a failed same-site request or horizontal
 * scroll. Then loads every page with reduced motion and without JavaScript:
 * still no errors, no horizontal scroll and real content on the page.
 * Screenshots (advisory) go to SCREENSHOT_DIR.
 *
 * Locally: PLAYWRIGHT_MODULE=/path/to/node_modules/playwright CHROMIUM_PATH=/usr/bin/chromium
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const SITE = path.resolve(process.argv[2] || '_site');
const SHOTS = process.argv[3];
const IN_CI = !!process.env.GITHUB_ACTIONS;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.json': 'application/json', '.xml': 'application/xml',
  '.txt': 'text/plain', '.pdf': 'application/pdf' };

// ---------- a static server that resolves paths like GitHub Pages ----------
function find(urlPath) {
  const p = path.join(SITE, decodeURIComponent(urlPath));
  if (!p.startsWith(SITE)) return null;
  for (const c of [p, p + '.html', path.join(p, 'index.html')]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

function serve() {
  const server = http.createServer((req, res) => {
    const file = find(new URL(req.url, 'http://x').pathname);
    if (!file) { res.writeHead(404); return res.end('not found'); }
    const stat = fs.statSync(file);
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range) {   // video needs range requests
      const start = range[1] ? +range[1] : 0, end = range[2] ? +range[2] : stat.size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ---------- checks ----------
const problems = [];
function fail(page, mode, msg) { problems.push({ page, mode, msg }); }

const pages = fs.readdirSync(SITE, { recursive: true })
  .filter(f => f.endsWith('.html') && path.basename(f) !== '404.html')
  .map(f => '/' + f.split(path.sep).join('/').replace(/index\.html$/, ''))
  .sort();

async function overflow(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= vw + 1) return null;
    const wide = [...document.querySelectorAll('body *')]
      .filter(el => el.getBoundingClientRect().right > vw + 1 && el.children.length === 0)
      .slice(0, 3)
      .map(el => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''));
    return `page is ${document.documentElement.scrollWidth}px wide at ${vw}px (${wide.join(', ') || 'unknown element'})`;
  });
}

async function scrollThrough(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => Math.round(window.innerHeight * 0.8));
  for (let y = 0; y < height; y += step) {
    await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), y);
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
}

async function visit(browser, base, url, mode, opts) {
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  const origin = new URL(base).origin;
  page.on('console', msg => { if (msg.type() === 'error') fail(url, mode, `console error: ${msg.text()}`); });
  page.on('pageerror', err => fail(url, mode, `uncaught exception: ${err.message}`));
  page.on('response', res => {
    if (res.url().startsWith(origin) && res.status() >= 400) fail(url, mode, `HTTP ${res.status()} for ${res.url().slice(origin.length)}`);
  });
  page.on('requestfailed', req => {
    const err = req.failure() && req.failure().errorText;
    // the browser aborts media requests it no longer needs; that is not a failure
    if (req.url().startsWith(origin) && !(err === 'net::ERR_ABORTED' && ['media', 'image'].includes(req.resourceType()))) {
      fail(url, mode, `request failed (${err}) for ${req.url().slice(origin.length)}`);
    }
  });
  await page.goto(base + url, { waitUntil: 'load' });
  if (opts.javaScriptEnabled !== false) await scrollThrough(page);
  const wide = await overflow(page);
  if (wide) fail(url, mode, `horizontal scroll: ${wide}`);
  const words = await page.evaluate(() => document.body.innerText.split(/\s+/).length);
  if (words < 30) fail(url, mode, `only ${words} words on the page`);
  return { context, page };
}

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const modes = [
    ['375', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }],
    ['1440', { viewport: { width: 1440, height: 900 } }],
    ['reduced motion', { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }],
    ['no JS 375', { viewport: { width: 375, height: 812 }, javaScriptEnabled: false }],
    ['no JS 1440', { viewport: { width: 1440, height: 900 }, javaScriptEnabled: false }],
  ];
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  for (const url of pages) {
    for (const [mode, opts] of modes) {
      const { context, page } = await visit(browser, base, url, mode, opts);
      if (SHOTS && (mode === '375' || mode === '1440')) {
        const name = (url === '/' ? 'home' : url.slice(1).replace(/\.html$/, '').replace(/\//g, '-')) + `-${mode}.png`;
        await page.screenshot({ path: path.join(SHOTS, name), fullPage: true });
      }
      await context.close();
    }
  }
  await browser.close();
  server.close();

  const seen = new Set();
  for (const { page, mode, msg } of problems) {
    const key = `${page}|${mode}|${msg}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(IN_CI ? `::error title=Smoke test (${mode})::${page}: ${msg}` : `ERROR   ${page} [${mode}]  ${msg}`);
  }
  console.log(`Smoke test: ${seen.size} problems across ${pages.length} pages and ${modes.length} modes.`);
  process.exit(seen.size ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
