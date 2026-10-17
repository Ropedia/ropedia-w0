// Regression checks for fullscreen exit, failed downloads and blocked autoplay.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { createServer } = require('./serve.cjs');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'xp-recovery-check-'));

(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true });
  const checks = [], errors = [];
  const base = `http://127.0.0.1:${server.address().port}/`;
  async function fresh(options = {}) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
    await context.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ body: '', contentType: 'text/css' }));
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    return { context, page };
  }
  const center = (page, selector) => page.locator(selector).evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const playing = (page, selector) => page.waitForFunction(selector => {
    const v = document.querySelector(selector);
    return !v.paused && v.readyState >= 3 && v.currentTime > .1;
  }, selector);
  try {
    const desktop = await fresh();
    await desktop.page.goto(base);
    await center(desktop.page, '#cmp');
    await desktop.page.locator('#cmp .mx-fs').click();
    await desktop.page.waitForFunction(() => !!document.fullscreenElement);
    await desktop.page.evaluate(() => document.exitFullscreen());
    await desktop.page.waitForTimeout(750);
    assert(await desktop.page.evaluate(() => !document.fullscreenElement && !document.querySelector('.is-theater') && !document.documentElement.classList.contains('no-scroll')));
    checks.push('Exiting fullscreen immediately leaves the page scrollable without reopening a theater overlay');

    await desktop.page.locator('#cmp .cmpstrip').evaluate(el => {
      el.requestFullscreen = () => Promise.reject(new DOMException('Denied', 'NotAllowedError'));
    });
    await desktop.page.locator('#cmp .mx-fs').click();
    await desktop.page.waitForFunction(() => !!document.querySelector('#cmp .is-theater'));
    await desktop.page.keyboard.press('Escape');
    assert(await desktop.page.evaluate(() => !document.querySelector('.is-theater') && !document.documentElement.classList.contains('no-scroll')));
    checks.push('A denied fullscreen request still opens the window-filling fallback, and Escape restores scrolling');
    await desktop.context.close();

    const mobile = await fresh({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    let unavailable = true;
    await mobile.context.route(/\.mp4(\?|$)/, route => unavailable ? route.abort() : route.continue());
    await mobile.page.goto(base);
    await center(mobile.page, '#wall');
    const retry = mobile.page.locator('#wall .video-retry');
    await retry.waitFor({ state: 'visible' });
    assert.equal(await mobile.page.locator('#wall .mx-bar').evaluate(el => getComputedStyle(el).opacity), '1');
    await center(mobile.page, '#citation');
    await center(mobile.page, '#wall');
    await retry.waitFor({ state: 'visible' });
    await mobile.page.locator('.lang-switch [data-lang=zh]').click();
    await mobile.page.waitForFunction(() => document.querySelector('#wall .video-retry').textContent === '重试播放');
    await mobile.page.screenshot({ path: path.join(out, 'mobile-retry.png') });
    unavailable = false;
    await retry.click();
    await playing(mobile.page, '#wallMain');
    assert(await retry.isHidden());
    checks.push('Failed phone videos expose a translated retry button after scrolling away and back; retry resumes actual playback');
    await mobile.context.close();

    const blocked = await fresh({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await blocked.context.addInitScript(() => {
      const play = HTMLMediaElement.prototype.play;
      let tapped = false;
      addEventListener('click', event => { if (event.isTrusted) tapped = true; }, true);
      HTMLMediaElement.prototype.play = function () {
        return tapped ? play.call(this) : Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
      };
    });
    await blocked.page.goto(base);
    await center(blocked.page, '#wall');
    await blocked.page.waitForFunction(() => document.querySelector('#wallMain').dataset.held);
    assert.equal(await blocked.page.locator('#wall .mx-bar').evaluate(el => getComputedStyle(el).opacity), '1');
    await blocked.page.screenshot({ path: path.join(out, 'mobile-blocked-autoplay.png') });
    await blocked.page.locator('#wall .mx-play').click();
    await playing(blocked.page, '#wallMain');
    checks.push('Blocked autoplay leaves a visible phone play control, and a user tap starts playback');
    await blocked.context.close();

    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
    console.log(checks.join('\n'));
    console.log('Report and screenshots:', out);
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exit(1); });
