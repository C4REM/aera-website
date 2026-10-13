/* =====================================================================
   SERVICE PAGES (Oct 2026)
   The one signature interaction on each service page. Entrances and
   parallax are already handled by ed-home.js; this file only adds:
     1. .sv-phone   stories that play themselves (social)
     2. .sv-ros     a run of show whose clock follows the scroll (events)
     3. .sv-strip   a row of frames you can drag with a mouse (events)
     4. .sv-shots   a shot list that shows the picture you point at (brand)
        .sv-rel-list uses the same floating picture
   Everything is guarded, so a page only runs what it has.
   ===================================================================== */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover)').matches;

  /* ---- 1 · stories ---- */
  document.querySelectorAll('.sv-phone').forEach(function (phone) {
    var imgs = [].slice.call(phone.querySelectorAll('.sv-screen img'));
    var bars = phone.querySelector('.sv-bars');
    if (!imgs.length || !bars) return;
    var dur = 2800, i = -1, timer = 0, visible = false;
    bars.innerHTML = imgs.map(function () { return '<i></i>'; }).join('');
    var ticks = [].slice.call(bars.children);
    bars.style.setProperty('--dur', dur + 'ms');
    function show(n) {
      i = n % imgs.length;
      if (i === 0) ticks.forEach(function (t) { t.className = ''; });
      imgs.forEach(function (im, k) { im.classList.toggle('is-on', k === i); });
      ticks.forEach(function (t, k) {
        t.className = k < i ? 'done' : '';
      });
      // restart the running bar's animation
      void ticks[i].offsetWidth;
      ticks[i].className = 'run';
    }
    function loop() { show(i + 1); timer = setTimeout(loop, dur); }
    function start() { if (!timer && visible) loop(); }
    function stop() { clearTimeout(timer); timer = 0; }
    show(0);
    if (reduce) return;
    // tap the right half to skip ahead, like the real thing
    phone.addEventListener('click', function () { stop(); loop(); });
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible) { stop(); timer = setTimeout(loop, dur); } else stop();
    }, { threshold: 0.3 }).observe(phone);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  });

  /* ---- 2 · run of show ---- */
  var ros = document.querySelector('.sv-ros');
  if (ros) {
    var cues = [].slice.call(ros.querySelectorAll('.sv-cue'));
    var clock = ros.querySelector('.sv-clock');
    var clockSub = ros.querySelector('.sv-clock-sub');
    var line = ros.querySelector('.sv-ros-line i');
    var list = ros.querySelector('.sv-cues');
    var cur = -1, swapT = 0;
    function setCue(n) {
      if (n === cur) return;
      cur = n;
      cues.forEach(function (c, k) { c.classList.toggle('is-on', k === n); });
      var c = cues[n];
      if (!clock || !c) return;
      clearTimeout(swapT);
      clock.classList.add('tick');
      swapT = setTimeout(function () {
        clock.innerHTML = '<span>' + c.getAttribute('data-time') + '</span>';
        if (clockSub) clockSub.textContent = c.getAttribute('data-when') || '';
        void clock.offsetWidth;
        clock.classList.remove('tick');
      }, reduce ? 0 : 220);
    }
    var rosTick = false;
    function rosFrame() {
      rosTick = false;
      var mid = window.innerHeight * 0.5, best = 0;
      cues.forEach(function (c, k) { if (c.getBoundingClientRect().top < mid) best = k; });
      setCue(best);
      if (line && list) {
        var r = list.getBoundingClientRect();
        var p = Math.min(1, Math.max(0, (mid - r.top) / r.height));
        line.style.transform = 'scaleX(' + p.toFixed(3) + ')';
      }
    }
    window.addEventListener('scroll', function () { if (!rosTick) { rosTick = true; requestAnimationFrame(rosFrame); } }, { passive: true });
    window.addEventListener('resize', rosFrame);
    rosFrame();
  }

  /* ---- 3 · drag strip ---- */
  document.querySelectorAll('.sv-strip').forEach(function (strip) {
    var bar = strip.parentElement.querySelector('.sv-strip-bar i');
    function sync() {
      if (!bar) return;
      var max = strip.scrollWidth - strip.clientWidth;
      var vis = strip.clientWidth / strip.scrollWidth;
      var p = max > 0 ? strip.scrollLeft / max : 1;
      bar.style.transform = 'translateX(' + (p * (1 - vis) * 100 / vis).toFixed(2) + '%) scaleX(1)';
      bar.style.width = (vis * 100).toFixed(2) + '%';
    }
    strip.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    window.addEventListener('load', sync);
    sync();
    // mouse drag (touch already scrolls natively)
    var down = false, moved = false, sx = 0, sl = 0, vx = 0, lx = 0, lt = 0, raf = 0;
    strip.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false; sx = lx = e.clientX; sl = strip.scrollLeft; lt = performance.now(); vx = 0;
      cancelAnimationFrame(raf);
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 4) { moved = true; strip.classList.add('dragging'); }
      if (!moved) return;
      strip.scrollLeft = sl - dx;
      var now = performance.now();
      vx = (e.clientX - lx) / Math.max(1, now - lt);
      lx = e.clientX; lt = now;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false;
      if (!moved) return;
      setTimeout(function () { strip.classList.remove('dragging'); }, 0);
      if (reduce) return;
      var v = -vx * 16;
      (function glide() {
        if (Math.abs(v) < 0.4) return;
        strip.scrollLeft += v; v *= 0.93;
        raf = requestAnimationFrame(glide);
      })();
    });
    strip.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
  });

  /* ---- 4 · floating picture (shot list, related) ---- */
  var lists = [].slice.call(document.querySelectorAll('[data-float]'));
  if (lists.length && canHover && !reduce) {
    var fl = document.createElement('div');
    fl.className = 'sv-float';
    fl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(fl);
    var cache = {};
    function imgFor(src) {
      if (!cache[src]) {
        var im = new Image();
        im.src = src; im.alt = '';
        fl.appendChild(im);
        cache[src] = im;
      }
      return cache[src];
    }
    var tx = 0, ty = 0, cx = 0, cy = 0, frame = 0, on = false;
    function move() {
      cx += (tx - cx) * 0.14; cy += (ty - cy) * 0.14;
      var fx = cx + 48 + fl.offsetWidth > window.innerWidth - 16 ? cx - 48 - fl.offsetWidth : cx + 48;
      fl.style.transform = 'translate3d(' + fx.toFixed(1) + 'px,' + (cy - fl.offsetHeight / 2).toFixed(1) + 'px,0) rotate(' + ((tx - cx) * 0.02).toFixed(2) + 'deg)';
      frame = (on || Math.abs(tx - cx) > 0.5) ? requestAnimationFrame(move) : 0;
    }
    lists.forEach(function (list) {
      var items = [].slice.call(list.querySelectorAll('[data-img]'));
      // warm the cache so the first hover isn't blank
      items.forEach(function (it) { imgFor(it.getAttribute('data-img')); });
      items.forEach(function (it) {
        it.addEventListener('mouseenter', function (e) {
          var im = imgFor(it.getAttribute('data-img'));
          Object.keys(cache).forEach(function (k) { cache[k].classList.toggle('on', cache[k] === im); });
          items.forEach(function (x) { x.classList.toggle('is-on', x === it); });
          list.classList.add('has-hover');
          if (!on) { cx = tx = e.clientX; cy = ty = e.clientY; }
          on = true; fl.classList.add('on');
          if (!frame) frame = requestAnimationFrame(move);
        });
      });
      list.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; });
      list.addEventListener('mouseleave', function () {
        on = false; fl.classList.remove('on');
        list.classList.remove('has-hover');
        items.forEach(function (x) { x.classList.remove('is-on'); });
      });
    });
  }
})();
