// One owner for lazy loading, source changes and off-screen cancellation.
// data-src keeps hidden videos out of the browser's speculative media loader.
(function () {
  const states = new Map();
  const variants = window.XP_VIDEO_VARIANTS || {};
  const posterRequests = new WeakMap();
  const POSTER_VERSION = '20261017-cover-frames';
  const sizes = window.XP_VIDEO_SIZES || {};
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection || {};
  let scheduled = false;
  let nativeFullscreen = null;
  const groups = new Map();
  const warmAttempts = new Map();
  const warmFinished = new Set();
  const warmRetryAt = new Map();
  const MAX_WARM_FILE = 16 * 1024 * 1024;
  const MAX_WARM_BYTES = 64 * 1024 * 1024;
  let warm = null, warmTimer = null, warmBytes = 0, lastScroll = performance.now();

  function slowConnection() {
    return connection.effectiveType === '3g' || (connection.downlink > 0 && connection.downlink < 1.5);
  }

  // The visible players always take priority. Reading a text-only part of the page
  // also gives the next video region time to download before it reaches the viewport.
  function canWarm() {
    if (document.hidden || reducedMotion.matches || connection.saveData ||
        /(^|-)2g$/.test(connection.effectiveType || '') ||
        nativeFullscreen || document.fullscreenElement || document.webkitFullscreenElement ||
        document.querySelector('.is-theater')) return false;
    // The canvas demo owns its own video loader; leave its bandwidth alone.
    const drag = document.querySelector('#rollout');
    if (drag && visible(drag)) return false;
    return [...states.values()].filter(s => s.src && visible(s.v)).every(s => {
      const v = s.v;
      if (s.failed || v.dataset.held) return v.networkState !== 2;
      const runway = slowConnection() ? v.duration : 6;
      // A fully buffered loop briefly seeks/waits at its start without needing
      // the network. Do not discard another player's download at every loop.
      return !s.pending && !v.paused && (fullyBuffered(v) || (!v.seeking && v.readyState >= 3 &&
        ahead(v) >= Math.min(runway, v.duration - v.currentTime) - 0.05));
    });
  }

  function warmPlan() {
    const regions = [...document.querySelectorAll('[data-video-region]')].map(root => {
      const members = [...states.values()].filter(s => s.region === root && s.src);
      const shown = members.filter(s => {
        const r = s.v.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      return { root, members, shown, rect: root.getBoundingClientRect() };
    }).filter(r => r.shown.length && r.rect.width && r.rect.height);
    const current = regions.filter(r => r.rect.bottom > 0 && r.rect.top < innerHeight);
    // Geometry, not cache completion, determines the next region. Finishing one
    // warmup must never walk the queue through the rest of the entire page.
    const next = regions.find(r => r.rect.top >= innerHeight);
    const plan = current.flatMap(r => r.shown);
    for (const r of current) {
      if (r.root.dataset.videoRegion === 'long') {
        plan.push(...r.members.filter(s => s.v.closest('.media')?.hidden));
      }
    }
    if (next) plan.push(...next.shown);
    return plan.filter(s => s.quality !== 'hd' && !s.failed && !s.originalFallback &&
      !s.v.dataset.held && (!s.v.hasAttribute('src') || s.prepared) && !visible(s.v));
  }

  function releaseWarm() {
    const job = warm;
    if (!job) return null;
    clearTimeout(job.timeout);
    warm = null;
    return job;
  }

  function stopWarm() {
    const job = releaseWarm();
    if (!job) return;
    warmRetryAt.set(job.url, performance.now() + 3000);
    detach(job.s, false);
    queueWarm();
  }

  function finishWarm() {
    const job = releaseWarm();
    if (!job) return;
    warmFinished.add(job.url);
    // Keep the same paused player, decoded frame and buffers until it is shown.
    queueWarm(100);
  }

  function queueWarm(delay = 1200) {
    if (warm || warmTimer || document.hidden || reducedMotion.matches || connection.saveData || warmBytes >= MAX_WARM_BYTES) return;
    warmTimer = setTimeout(warmNext, Math.max(delay, 600 - (performance.now() - lastScroll)));
  }

  function warmNext() {
    warmTimer = null;
    if (!canWarm()) return;
    if (performance.now() - lastScroll < 600) { queueWarm(); return; }
    const maxFile = slowConnection() ? 2 * 1024 * 1024 : MAX_WARM_FILE;
    const plan = warmPlan();
    plan.forEach(s => loadPoster(s.v));
    const candidates = plan.filter(s => !s.v.hasAttribute('src')).map(s => ({ s, url: source(s) })).filter(c =>
      !warmFinished.has(c.url) && (warmAttempts.get(c.url) || 0) < 2 &&
      sizes[c.url] > 0 && sizes[c.url] <= maxFile && warmBytes + sizes[c.url] <= MAX_WARM_BYTES);
    const next = candidates.find(c => (warmRetryAt.get(c.url) || 0) <= performance.now());
    if (!next) {
      if (candidates.length) queueWarm(Math.max(100, Math.min(...candidates.map(c => warmRetryAt.get(c.url))) - performance.now()));
      return;
    }
    warmAttempts.set(next.url, (warmAttempts.get(next.url) || 0) + 1);
    warmBytes += sizes[next.url]; // Charge aborted attempts too; bound speculative traffic.
    warm = { ...next, timeout: setTimeout(stopWarm, 45000) };
    const s = next.s;
    s.prepared = true;
    s.restoring = false;
    s.v.pause();
    s.v.preload = 'auto';
    // Prepare the actual player. If it enters the viewport halfway through the
    // download, start() promotes it without discarding bytes or issuing a new URL.
    s.v.src = next.url;
  }

  function loadPoster(v) {
    const url = v.dataset.poster;
    if (!url || posterRequests.get(v) === url) return;
    posterRequests.set(v, url);
    const box = v.closest('.media,.player');
    if (!box) { v.poster = url; return; }
    const imageUrl = `${url}${url.includes('?') ? '&' : '?'}v=${POSTER_VERSION}`;
    const cover = new Image();
    cover.decoding = 'async';
    cover.fetchPriority = visible(v) ? 'high' : 'low';
    cover.onload = () => {
      // A slower previous task's cover must not overwrite the selected task.
      if (v.dataset.poster === url) box.style.backgroundImage = `url("${imageUrl}")`;
    };
    // A failed image leaves the theme-colored surface, with no broken-image icon.
    cover.src = imageUrl;
  }

  function poster(v, url) {
    const changed = v.dataset.poster !== url;
    v.dataset.poster = url;
    const box = v.closest('.media,.player');
    if (box) {
      box.classList.add('video-placeholder');
      if (changed) {
        posterRequests.delete(v);
        box.classList.remove('has-video-frame');
        box.style.backgroundImage = '';
      }
      // The independently loaded background stays visible until a real frame
      // arrives, rather than waiting for the video to expose its native poster.
      v.removeAttribute('poster');
    } else {
      v.poster = url;
    }
    if (visible(v)) loadPoster(v);
  }

  function groupFor(v) {
    return groups.get(v.closest('[data-video-group]')?.dataset.videoGroup);
  }

  function visible(v) {
    if (document.hidden) return false;
    if (nativeFullscreen) return nativeFullscreen === v;
    const fullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    if (fullscreen && !fullscreen.contains(v)) return false;
    const theater = document.querySelector('.is-theater');
    if (theater && !theater.contains(v)) return false;
    const r = v.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  }

  function source(s) {
    const options = variants[s.src];
    if (s.quality === 'hd' || !options || s.originalFallback) return s.src;
    const low = s.low || connection.saveData || /(^|-)2g$/.test(connection.effectiveType || '') ||
      (connection.downlink > 0 && connection.downlink < 2) || innerWidth <= 640;
    return (low && options.low) || options.preview;
  }

  function status(s, loading, error = false) {
    const box = s.v.closest('.player,.media');
    if (!box) return;
    box.setAttribute('aria-busy', String(loading));
    const retry = box.querySelector('.video-retry');
    if (retry) retry.hidden = !error;
    const label = box.querySelector('.video-status');
    if (loading) {
      if (!s.loading) {
        s.loading = true;
        if (label) label.hidden = true;
        s.statusTimer = setTimeout(() => {
          box.classList.add('is-buffering');
          if (label) { label.textContent = 'Loading video…'; label.hidden = false; }
        }, 500);
      }
    } else {
      s.loading = false;
      clearTimeout(s.statusTimer);
      box.classList.remove('is-buffering');
      if (label) {
        label.hidden = !error;
        if (error) label.textContent = 'Video could not load. Press play to retry.';
      }
    }
  }

  function detach(s, remember = true) {
    if (warm?.s === s) { releaseWarm(); queueWarm(); }
    clearTimeout(s.waitTimer);
    clearTimeout(s.startTimer);
    if (remember && s.v.readyState && !s.restoring && !s.prepared) s.position = s.v.currentTime;
    s.v.pause();
    s.pending = false;
    s.requested = false;
    s.restoring = false;
    s.prepared = false;
    if (s.v.hasAttribute('src')) {
      s.v.removeAttribute('src');
      s.v.preload = 'none';
      s.v.load(); // aborts the old request, including a partially downloaded MP4
    }
    status(s, false);
  }

  function start(s) {
    const v = s.v;
    const url = source(s);
    if (s.prepared && v.getAttribute('src') === url) {
      if (warm?.s === s) releaseWarm();
      s.prepared = false;
      s.started = performance.now() - 1200;
      s.pending = v.readyState < 3;
      s.restoring = s.position > 0;
      if (s.restoring && v.readyState) {
        v.currentTime = Math.min(s.position, Math.max(0, v.duration - 0.05));
        s.restoring = false;
      }
      status(s, s.pending);
    }
    if (v.getAttribute('src') !== url) {
      stopWarm();
      if (v.hasAttribute('src')) detach(s);
      s.pending = true;
      s.started = performance.now();
      s.restoring = s.position > 0;
      v.preload = 'auto';
      v.src = url;
      status(s, true);
      s.startTimer = setTimeout(schedule, 1200);
    }
    // Give a grid tile a short runway before autoplay. Film and explicit play start immediately.
    if (!s.manual && v.id !== 'film' && !v.classList.contains('hero-bg') &&
        performance.now() - s.started < 1200 && ahead(v) < Math.min(1, v.duration || 1)) return;
    if (v.paused && !s.requested) {
      s.requested = true;
      v.play().catch(error => {
        s.requested = false;
        if (error.name === 'NotAllowedError') {
          v.dataset.held = '1';
          s.pending = false;
          status(s, false);
        }
      });
    }
  }

  function refresh() {
    scheduled = false;
    const candidates = [];
    for (const s of states.values()) {
      const v = s.v;
      if (!visible(v)) {
        v.pause();
        s.requested = false;
        // Keep completed clips and the one explicit warmup; cancel other off-screen transfers.
        if (!s.prepared && v.hasAttribute('src') && (v.networkState === 2 || s.pending || v.readyState < 2)) detach(s);
        status(s, false);
        continue;
      }
      loadPoster(v);
      if (v.dataset.held || s.failed || (reducedMotion.matches && !s.manual)) {
        v.pause();
        s.requested = false;
        if (s.failed) status(s, false, true);
        continue;
      }
      if (s.src) candidates.push(s);
    }
    // Start the selected four-task row together; other regions retain staggered starts.
    candidates.sort((a, b) => Number(b.manual) - Number(a.manual) ||
      Number(b.v.id === 'film') - Number(a.v.id === 'film'));
    let pending = candidates.filter(s => s.pending).length;
    const slots = candidates.some(s => s.v.closest('#longgrid')) ? 4 : 2;
    for (const s of candidates) {
      if (s.v.hasAttribute('src') || pending < slots) {
        const wasPending = s.pending;
        start(s);
        if (!wasPending && s.pending) pending++;
      }
    }
    if (warm && (!canWarm() || !warmPlan().includes(warm.s) || source(warm.s) !== warm.url)) stopWarm();
    queueWarm();
  }

  function schedule() {
    if (warm && !visible(warm.s.v) && (!canWarm() || !warmPlan().includes(warm.s) || source(warm.s) !== warm.url)) stopWarm();
    if (!scheduled) { scheduled = true; requestAnimationFrame(refresh); }
  }

  const observer = new IntersectionObserver(schedule, { threshold: [0, 0.01] });
  const posters = new IntersectionObserver(entries => entries.forEach(({ target: v, isIntersecting }) => {
    if (isIntersecting) loadPoster(v);
  }), { rootMargin: '1200px' });
  function ahead(v) {
    let seconds = 0;
    for (let i = 0; i < v.buffered.length; i++) {
      if (v.buffered.start(i) <= v.currentTime + 0.05) seconds = Math.max(seconds, v.buffered.end(i) - v.currentTime);
    }
    return seconds;
  }
  function fullyBuffered(v) {
    return v.buffered.length === 1 && v.buffered.start(0) < 0.05 &&
      v.buffered.end(0) >= v.duration - 0.05;
  }
  function register(v) {
    if (states.has(v)) return states.get(v);
    const s = { v, src: v.dataset.src || '', region: v.closest('[data-video-region]'), position: 0,
      quality: groupFor(v)?.value || 'auto', pending: false, manual: false };
    states.set(v, s);
    const box = v.closest('.media,.player');
    if (box) {
      if (box.matches('.media')) {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'video-retry';
        retry.textContent = 'Retry video';
        retry.setAttribute('aria-label', 'Video could not load. Press play to retry.');
        retry.hidden = true;
        retry.addEventListener('click', () => play(v));
        box.append(retry);
      }
      v.addEventListener('loadeddata', () => box.classList.toggle('has-video-frame', v.readyState >= 2));
      v.addEventListener('emptied', () => box.classList.remove('has-video-frame'));
    }
    const posterURL = v.dataset.poster || v.getAttribute('poster');
    if (posterURL) poster(v, posterURL);
    observer.observe(v);
    posters.observe(v);
    v.addEventListener('webkitbeginfullscreen', () => { nativeFullscreen = v; schedule(); });
    v.addEventListener('webkitendfullscreen', () => { nativeFullscreen = null; schedule(); });
    v.addEventListener('loadedmetadata', () => {
      if (!v.hasAttribute('src')) return;
      if (s.restoring) {
        v.currentTime = Math.min(s.position, Math.max(0, v.duration - 0.05));
        s.restoring = false;
      }
    });
    const buffered = () => {
      if (warm?.s === s && v.readyState >= 2 && (v.networkState === 1 || fullyBuffered(v))) finishWarm();
      if (s.pending && (ahead(v) >= Math.min(2, v.duration || 2) || v.networkState === 1)) {
        s.pending = false;
        schedule();
      }
      if (!s.requested && visible(v)) schedule();
      queueWarm();
    };
    ['progress', 'canplay', 'suspend'].forEach(event => v.addEventListener(event, buffered));
    v.addEventListener('timeupdate', () => { if (warm && !visible(warm.s.v) && !canWarm()) stopWarm(); });
    v.addEventListener('playing', () => { clearTimeout(s.waitTimer); clearTimeout(s.startTimer); status(s, false); buffered(); });
    v.addEventListener('waiting', () => {
      if (!visible(v) || v.dataset.held) return;
      if (!fullyBuffered(v)) stopWarm();
      status(s, true);
      clearTimeout(s.waitTimer);
      s.waitTimer = setTimeout(() => {
        // A stalled Auto stream can step down once, preserving its playhead.
        if (visible(v) && !v.paused && v.readyState < 3 && s.quality === 'auto' && variants[s.src]?.low &&
            v.getAttribute('src') !== variants[s.src].low && !s.low) {
          s.low = true;
          detach(s);
          schedule();
        }
      }, 2500);
    });
    v.addEventListener('error', () => {
      if (!v.hasAttribute('src')) return;
      if (s.prepared) {
        warmFinished.add(v.getAttribute('src'));
        detach(s, false);
        schedule(); // Retry normally, including the original fallback, only when viewed.
        return;
      }
      s.pending = false;
      if (v.getAttribute('src') !== s.src && !s.originalFallback) {
        s.originalFallback = true;
        detach(s);
      } else {
        s.failed = true;
        status(s, false, true);
      }
      schedule();
    });
    schedule();
    return s;
  }

  function setSource(v, src, reset = true) {
    const s = register(v);
    if (s.src === src) return;
    detach(s, !reset);
    s.src = v.dataset.src = src;
    if (reset) s.position = 0;
    s.low = s.failed = s.originalFallback = false;
    delete v.dataset.held;
    v.dispatchEvent(new Event('videosourcechange'));
    schedule();
  }

  function play(v) {
    const s = register(v);
    if (s.failed) detach(s);
    s.manual = true;
    s.failed = false;
    s.requested = false;
    delete v.dataset.held;
    if (visible(v)) start(s); // preserve the user activation for browsers' audio/fullscreen policies
    schedule();
  }

  function pause(v) {
    const s = register(v);
    // A newly selected, explicitly paused video still owns its prepared frame.
    if (warm?.s === s && visible(v)) releaseWarm();
    v.dataset.held = '1';
    v.pause();
    s.requested = false;
    s.pending = false;
    clearTimeout(s.waitTimer);
    status(s, false);
    schedule();
  }

  function seek(v, time) {
    const s = register(v);
    if (warm?.s === s && visible(v)) releaseWarm();
    else stopWarm();
    s.position = time;
    if (v.readyState) v.currentTime = Math.min(time, Math.max(0, v.duration - 0.05));
    else s.restoring = time > 0;
  }

  function quality(v, value) {
    const s = register(v);
    if (s.quality === value) return;
    s.quality = value;
    // Clips without a preview already use their original; leave them playing.
    if (!variants[s.src]) return;
    detach(s);
    s.low = s.failed = s.originalFallback = false;
    // Keep an explicitly paused video paused while changing quality.
    if (visible(v) && v.dataset.held) {
      v.preload = 'metadata';
      s.restoring = s.position > 0;
      v.src = source(s);
    }
    schedule();
  }

  function setQuality(key, value) {
    const group = groups.get(key);
    if (!group) return;
    group.value = value === 'hd' ? 'hd' : 'auto';
    try { localStorage.setItem('xp0-video-quality-' + key, group.value); } catch (e) {}
    group.root.querySelectorAll('video:not(.hidden-src)').forEach(v => {
      if (groupFor(v) === group) quality(v, group.value);
    });
    group.control.value = group.value;
  }

  // Each figure owns one choice, including clips created later or selected in its tabs.
  document.querySelectorAll('[data-video-group]').forEach(root => {
    const key = root.dataset.videoGroup;
    const control = root.querySelector('[data-video-quality]');
    if (!control) return;
    let value = 'auto';
    try { if (localStorage.getItem('xp0-video-quality-' + key) === 'hd') value = 'hd'; } catch (e) {}
    groups.set(key, { root, control, value });
    control.value = value;
    control.addEventListener('change', () => setQuality(key, control.value));
  });

  window.XPVideo = { register, setSource, play, pause, seek, setQuality, poster, refresh: schedule,
    time: v => v.readyState ? v.currentTime : (states.get(v)?.position || 0) };
  const hero = document.querySelector('.hero-bg');
  if (hero && innerWidth <= 640) {
    hero.dataset.src = 'media/hero_backdrop_m.mp4';
    hero.poster = 'media/hero_backdrop_m.jpg';
  }
  document.querySelectorAll('video[data-auto]').forEach(register);
  addEventListener('scroll', () => { lastScroll = performance.now(); schedule(); }, { passive: true, capture: true });
  addEventListener('resize', schedule);
  ['visibilitychange', 'fullscreenchange', 'webkitfullscreenchange'].forEach(event => document.addEventListener(event, schedule));
  reducedMotion.addEventListener('change', schedule);
  connection.addEventListener?.('change', schedule);
})();
