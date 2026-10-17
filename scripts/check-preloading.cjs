// Run with the same PLAYWRIGHT_MODULE and CHROME_PATH options as check-playback.cjs.
// Observe real requests without Playwright routing, which would disable the browser cache.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { createServer } = require('./serve.cjs');
const root = path.resolve(__dirname, '..');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'xp-preloading-check-'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const normal = { downlink: 5, effectiveType: '4g', saveData: false };

(async () => {
  const requests = [], errors = [], checks = [];
  let hold = null;
  const server = createServer(), handler = server.listeners('request')[0];
  server.removeAllListeners('request');
  server.on('request', (req, res) => {
    // Exercise the project-page subdirectory used by GitHub Pages as well.
    req.url = req.url.replace(/^\/ropedia-w0\//, '/');
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/^.*<link[^\n]*fonts\.(googleapis|gstatic)\.com[^\n]*\n/gm, ''));
      return;
    }
    if (req.url.endsWith('.mp4')) {
      const record = { url: req.url, range: req.headers.range, start: Date.now(), done: false, aborted: false };
      requests.push(record);
      res.on('finish', () => { record.done = true; record.end = Date.now(); });
      res.on('close', () => { record.aborted = !record.done; });
      if (hold?.matches(record.url)) {
        const data = fs.readFileSync(path.join(root, req.url));
        const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
        const start = range ? Number(range[1]) : 0;
        const end = range?.[2] ? Number(range[2]) : data.length - 1;
        const headers = { 'Content-Type': 'video/mp4', 'Content-Length': end - start + 1,
          'Accept-Ranges': 'bytes', 'Cache-Control': 'public,max-age=600' };
        if (range) headers['Content-Range'] = `bytes ${start}-${end}/${data.length}`;
        res.writeHead(range ? 206 : 200, headers);
        const split = Math.min(end + 1, start + hold.bytes);
        res.write(data.subarray(start, split));
        record.release = () => { if (!res.destroyed && !res.writableEnded) res.end(data.subarray(split, end + 1)); };
        return;
      }
    }
    handler(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/ropedia-w0/`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true });
  const waitFor = async (predicate, label) => {
    const start = Date.now();
    while (!predicate()) { assert(Date.now() - start < 15000, `Timed out: ${label}`); await delay(50); }
  };
  const transfers = suffix => requests.filter(r => r.url.endsWith(suffix));
  const center = (page, selector) => page.locator(selector).evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const ready = (page, selector) => page.waitForFunction(selector => {
    const vs = [...document.querySelectorAll(selector)];
    return vs.length && vs.every(v => v.readyState >= 2);
  }, selector, { timeout: 60000 }).catch(async error => {
    console.error('Preparation timeout:', selector, await page.locator('video[src]').evaluateAll(vs => vs.map(v => ({ src: v.getAttribute('src'), ready: v.readyState, paused: v.paused, network: v.networkState,
      duration: v.duration, time: v.currentTime, buffered: [...Array(v.buffered.length)].map((_, i) => [v.buffered.start(i), v.buffered.end(i)]) }))));
    throw error;
  });
  const playing = (page, selector) => page.waitForFunction(selector => {
    const vs = [...document.querySelectorAll(selector)];
    return vs.length && vs.every(v => v.readyState >= 3 && !v.paused && v.currentTime > .1);
  }, selector);
  const longShown = '#longgrid > .media:not([hidden]) video';
  const longHidden = '#longgrid > .media[hidden] video';
  async function fresh(connection = normal, options = {}, originals = [], network = null) {
    requests.length = 0;
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
    await context.addInitScript(({ connection, originals }) => {
      Object.defineProperty(navigator, 'connection', { value: connection, configurable: true });
      originals.forEach(group => localStorage.setItem('xp0-video-quality-' + group, 'hd'));
    }, { connection, originals });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    if (network) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', network);
    }
    await page.goto(base);
    return { context, page };
  }
  async function beforeLong(page) {
    await page.locator('[data-video-region=long]').evaluate(el => {
      scrollTo({ top: scrollY + el.getBoundingClientRect().top - innerHeight - 30, behavior: 'instant' });
    });
  }
  try {
    const top = await fresh();
    await ready(top.page, '#film');
    assert(await top.page.locator('#film').evaluate(v => v.paused && v.getBoundingClientRect().top >= innerHeight));
    await delay(1800);
    assert.equal(await top.page.locator('#dataCarousel video[src]').count(), 0);
    const filmRequests = transfers('/preview/teaser.mp4').length;
    assert(filmRequests > 0);
    await center(top.page, '#film-section');
    await playing(top.page, '#film');
    assert.equal(transfers('/preview/teaser.mp4').length, filmRequests);
    await ready(top.page, '#dataCarousel .car-slide:not([hidden]) video');
    assert(await top.page.locator('#dataCarousel video').evaluateAll(vs => vs.every(v => v.paused)));
    assert.equal(await top.page.locator('#dataCarousel .car-slide[hidden] video[src]').count(), 0);
    assert.equal(await top.page.locator('#cmp video[src]').count(), 0);
    checks.push('Cover prepares the film; film prepares both selected Data videos; completed preparation never cascades through later regions');
    await top.context.close();

    const reading = await fresh();
    await reading.page.locator('#dataCarousel').evaluate(el => {
      scrollTo({ top: scrollY + el.getBoundingClientRect().bottom + 100, behavior: 'instant' });
    });
    await ready(reading.page, '#cmpVideo');
    assert(await reading.page.locator('#cmpVideo').evaluate(v => v.paused && v.getBoundingClientRect().top > innerHeight));
    assert.equal(await reading.page.locator('#embwall video[src]').count(), 0);
    checks.push('Reading text prepares the next video region even when no player is visible');
    await reading.context.close();

    const row = await fresh(normal, {}, [], { offline: false, latency: 400, downloadThroughput: 250000, uploadThroughput: 125000 });
    await beforeLong(row.page);
    await ready(row.page, longShown);
    assert(await row.page.locator(longShown).evaluateAll(vs => vs.every(v => v.paused && v.getBoundingClientRect().top >= innerHeight)));
    assert.equal(await row.page.locator(longHidden + '[src]').count(), 0);
    assert.equal(await row.page.locator('#wallMain').getAttribute('src'), null);
    const selectedCounts = [0, 1, 2, 3].map(i => transfers(`/preview/long_${i}.mp4`).length);
    await center(row.page, '#longgrid');
    await playing(row.page, longShown);
    assert.deepEqual([0, 1, 2, 3].map(i => transfers(`/preview/long_${i}.mp4`).length), selectedCounts);
    await ready(row.page, longHidden);
    await ready(row.page, '#wallMain');
    assert(await row.page.locator(longHidden).evaluateAll(vs => vs.every(v => v.paused)));
    assert.equal(await row.page.locator('#rr video[src]').count(), 0);
    const warmRow = requests.filter(r => /\/preview\/long_[4-7]\.mp4$/.test(r.url));
    assert.equal(warmRow.length, 4);
    for (let i = 1; i < warmRow.length; i++) assert(warmRow[i].start >= warmRow[i - 1].end, 'Preparation must be sequential');
    await row.page.evaluate(() => {
      window.flipStart = performance.now();
      window.playTimes = {};
      document.querySelectorAll('#longgrid > .media[hidden] video').forEach(v => {
        v.addEventListener('playing', () => { window.playTimes[v.dataset.src] = Math.round(performance.now() - window.flipStart); }, { once: true });
      });
      document.querySelectorAll('#longPages button')[1].click();
    });
    await playing(row.page, longShown);
    const playTimes = await row.page.evaluate(() => window.playTimes);
    assert.equal(Object.keys(playTimes).length, 4);
    assert(Object.values(playTimes).every(ms => ms < 1200), JSON.stringify(playTimes));
    assert.equal(requests.filter(r => /\/preview\/long_[4-7]\.mp4$/.test(r.url)).length, 4);
    checks.push('All four next-region videos prepare before scrolling; all four alternate tasks prepare sequentially and play without another transfer at 2 Mbps / 400 ms');
    await row.context.close();

    // Keep foreground bytes pending: no background video may compete with them.
    hold = { matches: url => /\/preview\/long_[0-3]\.mp4$/.test(url), bytes: 1024 };
    const priority = await fresh();
    await center(priority.page, '#longgrid');
    await waitFor(() => requests.filter(r => hold.matches(r.url)).length === 4, 'foreground requests');
    await delay(2200);
    assert.equal(requests.filter(r => /\/preview\/(long_[4-7]|live_0)\.mp4$/.test(r.url)).length, 0);
    const pending = requests.filter(r => hold.matches(r.url));
    hold = null;
    pending.forEach(r => r.release());
    await playing(priority.page, longShown);
    await ready(priority.page, longHidden);
    checks.push('Pending foreground videos prevent speculative transfers; preparation resumes when the current row is buffered');
    await priority.context.close();

    // Enter a video while only part of its paused preparation has arrived.
    hold = { matches: url => url.endsWith('/preview/long_4.mp4'), bytes: 128 * 1024 };
    const promote = await fresh();
    await center(promote.page, '#longgrid');
    await playing(promote.page, longShown);
    await ready(promote.page, '#longgrid video[data-src="media/long_4.mp4"]');
    const inflight = transfers('/preview/long_4.mp4')[0];
    assert(inflight && !inflight.done && !inflight.aborted);
    await promote.page.locator('#longPlay').click();
    await promote.page.locator('#longPages button').nth(1).click();
    assert(await promote.page.locator('#longgrid video[data-src="media/long_4.mp4"]').evaluate(v => v.paused && v.readyState >= 2));
    await promote.page.locator('#longPlay').click();
    await playing(promote.page, '#longgrid video[data-src="media/long_4.mp4"]');
    assert(!inflight.aborted && !inflight.done, 'Promotion must retain the unfinished transfer');
    assert.equal(transfers('/preview/long_4.mp4').length, 1);
    hold = null;
    inflight.release();
    await playing(promote.page, longShown);
    checks.push('Scrolling or switching into a partially prepared video promotes the same player and keeps its unfinished request');
    await promote.context.close();

    for (const action of ['scroll', 'background']) {
      hold = { matches: url => url.endsWith('/preview/long_4.mp4'), bytes: 1024 };
      const cancel = await fresh();
      await center(cancel.page, '#longgrid');
      await waitFor(() => transfers('/preview/long_4.mp4').length > 0, 'unfinished preparation');
      const pending = transfers('/preview/long_4.mp4')[0];
      if (action === 'scroll') await center(cancel.page, '#dataCarousel');
      else await cancel.page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await waitFor(() => pending.aborted, action + ' cancellation');
      if (action === 'scroll') await playing(cancel.page, '#dataCarousel .car-slide:not([hidden]) video');
      else {
        const count = requests.length;
        await delay(1800);
        assert.equal(requests.length, count);
      }
      await cancel.context.close();
      hold = null;
    }
    checks.push('Unrelated foreground loading and background-page visibility cancel unfinished preparation');

    for (const connection of [{ ...normal, saveData: true }, { ...normal, effectiveType: '2g' }]) {
      const limited = await fresh(connection);
      await center(limited.page, '#longgrid');
      await playing(limited.page, longShown);
      await delay(2200);
      assert.equal(await limited.page.locator(longHidden + '[src]').count(), 0);
      assert.equal(await limited.page.locator('#wallMain').getAttribute('src'), null);
      await limited.context.close();
    }
    const slow = await fresh({ ...normal, downlink: 1, effectiveType: '3g' });
    await center(slow.page, '#longgrid');
    await ready(slow.page, longHidden);
    assert(await slow.page.locator(longShown).evaluateAll(vs => vs.every(v => v.buffered.end(v.buffered.length - 1) >= v.duration - .05)));
    assert.equal(await slow.page.locator('#wallMain').getAttribute('src'), null);
    await slow.context.close();
    const original = await fresh(normal, {}, ['long']);
    await beforeLong(original.page);
    await delay(3500);
    assert.equal(await original.page.locator('#longgrid video[src]').count(), 0);
    assert.equal(await original.page.locator('#wallMain').getAttribute('src'), null);
    await original.context.close();
    checks.push('Data Saver and 2G disable preparation; 3G waits for complete foreground buffers and limits file sizes; Original is never speculatively loaded');

    const mobile = await fresh(normal, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await beforeLong(mobile.page);
    await ready(mobile.page, longShown);
    assert(await mobile.page.locator(longShown).evaluateAll(vs => vs.length === 4 && vs.every(v => v.paused)));
    assert(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await center(mobile.page, '#longgrid');
    await mobile.page.locator('#longgrid').evaluate(el => { el.scrollLeft = el.scrollWidth; });
    await playing(mobile.page, '#longgrid > .media:nth-child(4) video');
    await mobile.page.screenshot({ path: path.join(out, 'mobile-prepared-row.png') });
    checks.push('Phone prepares the whole selected row, including horizontally off-screen tiles, without page overflow');
    await mobile.context.close();

    // Hold videos while their independent, full-resolution covers arrive.
    const posters = await fresh(normal, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    let releaseVideos;
    const videoGate = new Promise(resolve => { releaseVideos = resolve; });
    await posters.context.route(/\.mp4(\?|$)/, async route => {
      await videoGate;
      await route.continue().catch(() => {}); // Scrolled-away requests may have been cancelled.
    });
    await posters.page.reload({ waitUntil: 'domcontentloaded' });
    const coverReady = (page, selector) => page.waitForFunction(selector => {
      const v = document.querySelector(selector), box = v.closest('.media,.player');
      return box.style.backgroundImage.includes(v.dataset.poster);
    }, selector);
    for (const selector of ['#film', '#dataCarousel video', '#cmpVideo', '#longgrid video', '#wallMain', '#rrExt']) {
      const video = posters.page.locator(selector).first();
      await video.evaluate(v => v.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await coverReady(posters.page, selector);
      assert(await video.evaluate(v => v.readyState === 0 && getComputedStyle(v).opacity === '0' &&
        !v.closest('.media,.player').style.backgroundImage.includes('data:')));
    }
    await center(posters.page, '#longgrid');
    await posters.page.waitForFunction(() => document.querySelector('#longgrid .media').classList.contains('is-buffering'));
    await posters.page.screenshot({ path: path.join(out, 'mobile-sharp-covers.png') });
    await posters.page.setViewportSize({ width: 1440, height: 900 });
    await center(posters.page, '#film-section');
    await coverReady(posters.page, '#film');
    await posters.page.evaluate(() => {
      const box = document.querySelector('#film').closest('.player');
      window.loadingShownAfter = null;
      const start = performance.now();
      const observer = new MutationObserver(() => {
        if (box.classList.contains('is-buffering')) {
          window.loadingShownAfter = performance.now() - start;
          observer.disconnect();
        }
      });
      observer.observe(box, { attributes: true, attributeFilter: ['class'] });
      document.querySelector('[data-film=full]').click();
    });
    await coverReady(posters.page, '#film');
    await posters.page.waitForFunction(() => window.loadingShownAfter !== null);
    assert(await posters.page.evaluate(() => window.loadingShownAfter >= 450));
    assert((await posters.page.locator('#film').evaluate(v => v.closest('.player').style.backgroundImage)).includes('assets/film-poster.jpg'));
    await posters.page.screenshot({ path: path.join(out, 'desktop-sharp-cover.png') });
    releaseVideos();
    await playing(posters.page, '#film');
    await posters.page.waitForFunction(() => {
      const v = document.querySelector('#film'), box = v.closest('.player');
      return getComputedStyle(v).opacity === '1' && !box.classList.contains('is-buffering');
    });
    checks.push('Clear covers display before any video bytes; loading indicators wait 500 ms, film changes update the cover, and playback replaces it');
    await posters.context.close();

    // The previous task's image can finish later than the newly selected one.
    const race = await fresh();
    let releaseOldCover;
    const oldGate = new Promise(resolve => { releaseOldCover = resolve; });
    await race.context.route(/\.mp4(\?|$)/, route => route.abort());
    await race.context.route(/\/assets\/teaser-poster\.jpg(\?|$)/, async route => {
      await oldGate;
      await route.continue().catch(() => {});
    });
    await race.page.reload({ waitUntil: 'domcontentloaded' });
    await center(race.page, '#film-section');
    await race.page.locator('[data-film=full]').click();
    await coverReady(race.page, '#film');
    const oldResponse = race.page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/assets/teaser-poster.jpg'));
    releaseOldCover();
    await (await oldResponse).finished();
    await delay(200);
    assert((await race.page.locator('#film').evaluate(v => v.closest('.player').style.backgroundImage)).includes('assets/film-poster.jpg'));
    checks.push('A late cover response from the previous film cannot replace the selected film cover');
    await race.context.close();

    const plain = await fresh();
    await plain.context.route(/\.(mp4|jpg)(\?|$)/, route => route.abort());
    await plain.page.reload();
    for (const selector of ['#film', '#dataCarousel video', '#cmpVideo', '#longgrid video', '#wallMain', '#rrExt']) {
      const video = plain.page.locator(selector).first();
      await video.evaluate(v => v.scrollIntoView({ block: 'center', behavior: 'instant' }));
      const fallback = await video.evaluate(v => {
        const box = v.closest('.media,.player'), css = getComputedStyle(box);
        return { background: css.backgroundImage, color: css.backgroundColor, opacity: getComputedStyle(v).opacity };
      });
      assert(fallback.background === 'none' && fallback.color !== 'rgba(0, 0, 0, 0)' && fallback.opacity === '0', selector);
    }
    checks.push('Unavailable images leave a plain surface with no blurry thumbnail or broken-image icon');
    await plain.context.close();
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ checks, playTimes, errors }, null, 2));
    console.log(checks.join('\n'));
    console.log('Prepared task playback after switch at 2 Mbps / 400 ms latency:', playTimes);
    console.log('Report and screenshots:', out);
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exit(1); });
