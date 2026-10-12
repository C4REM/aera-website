/* =====================================================================
   EDITORIAL HOMEPAGE MOTION (Oct 2026)
   1. Entrances: any [data-ed] element gets .in once, the first time it
      scrolls into view. The CSS decides what that looks like per type
      (fade, draw, rise, clip, drop, track), which keeps every section's
      motion distinct while the timing curve stays shared.
   2. Parallax: images marked [data-par] drift a little against the scroll.
      Written to a CSS variable (--py) so it composes with the hover scale.
   3. Services switcher: the pinned #services track maps scroll progress to
      one of five services and swaps the photo, the copy and the counter.
   One passive scroll listener, one rAF per frame; nothing runs off-screen.
   ===================================================================== */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- 1 · entrances ---- */
  var targets = [].slice.call(document.querySelectorAll('[data-ed]'));
  if (reduce || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('in'); });
  } else {
    /* A [data-ed="clip"] photo starts fully clipped, and Chrome's observer
       counts a fully clipped element as never visible, so for those we
       watch the parent and reveal the child. */
    var proxy = new Map();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        (proxy.get(e.target) || [e.target]).forEach(function (el) { el.classList.add('in'); });
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    targets.forEach(function (el) {
      var watch = el.getAttribute('data-ed') === 'clip' ? el.parentElement : el;
      if (watch !== el) {
        if (!proxy.has(watch)) { proxy.set(watch, []); io.observe(watch); }
        proxy.get(watch).push(el);
      } else io.observe(el);
    });
  }

  /* ---- 2 · parallax ---- */
  var par = reduce ? [] : [].slice.call(document.querySelectorAll('[data-par]'));

  /* ---- 3 · services switcher ---- */
  var track = document.getElementById('svcTrack');
  var items = track ? [].slice.call(track.querySelectorAll('.ed-svc-list li')) : [];
  var imgs = track ? [].slice.call(track.querySelectorAll('.ed-svc-media img')) : [];
  var copy = track ? [].slice.call(track.querySelectorAll('.ed-svc-copy > div')) : [];
  var num = document.getElementById('svcNum');
  var bar = document.getElementById('svcBar');
  var active = 0;

  function setActive(i) {
    if (i === active) return;
    active = i;
    [items, imgs, copy].forEach(function (list) {
      list.forEach(function (el, k) { el.classList.toggle('is-on', k === i); });
    });
    if (num) num.textContent = ('0' + (i + 1)).slice(-2);
  }

  /* clicking a name scrolls to that service's slot rather than leaving the page
     straight away, unless it's already the active one */
  items.forEach(function (li, i) {
    var a = li.querySelector('a');
    a.addEventListener('click', function (ev) {
      if (i === active) return;
      ev.preventDefault();
      var top = track.getBoundingClientRect().top + window.scrollY;
      var span = track.offsetHeight - window.innerHeight;
      var y = top + span * ((i + 0.5) / items.length);
      if (window.lenis && window.lenis.scrollTo) window.lenis.scrollTo(y);
      else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  var ticking = false;
  function frame() {
    ticking = false;
    var vh = window.innerHeight;

    for (var i = 0; i < par.length; i++) {
      var r = par[i].getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) continue;
      var f = parseFloat(par[i].getAttribute('data-par')) || 0.08;
      var off = (r.top + r.height / 2 - vh / 2) * -f;
      par[i].style.setProperty('--py', off.toFixed(1) + 'px');
    }

    if (track) {
      var tr = track.getBoundingClientRect();
      var span = track.offsetHeight - vh;
      var p = span > 0 ? Math.min(1, Math.max(0, -tr.top / span)) : 0;
      setActive(Math.min(items.length - 1, Math.floor(p * items.length)));
      if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  frame();
})();
