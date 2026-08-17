/* ==========================================================================
   AERA — MOTION LAYER
   GSAP 3 + ScrollTrigger + SplitText, driven by the site's existing Lenis.

   Why this file exists
   -------------------
   Every scroll effect on this site was hand-rolled: a scroll listener, a
   rAF throttle, and per-section arithmetic mapping scrollY to a transform.
   That approach is why things kept breaking — the wheel's dead zones, the
   showreel's hold, the timeline's pin were each their own bespoke maths with
   their own edge cases, and none of them shared a timeline or a scheduler.

   ScrollTrigger replaces all of that with one scheduler: it owns the scroll
   position, batches every read, and does the pin/scrub/progress maths that
   was being re-derived by hand each time.

   Licensing: GSAP (including SplitText, ScrollTrigger, Flip — historically
   paid "Club" plugins) became free for everyone in 2025 under Webflow. No
   licence key, safe on a commercial site.

   THE ONE CRITICAL WIRE
   ---------------------
   Lenis runs its own rAF loop and applies a transform; ScrollTrigger reads
   native scroll. Left unconnected they drift — animations lag the smooth
   scroll by a frame or more, which reads as exactly the "laggy/catches up
   late" feel. lenis.on('scroll', ScrollTrigger.update) plus driving Lenis
   FROM gsap.ticker puts both on a single clock.
   ========================================================================== */
(function () {
  if (typeof gsap === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger);
  var hasSplit = typeof SplitText !== 'undefined';
  if (hasSplit) gsap.registerPlugin(SplitText);

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    document.querySelectorAll('[data-anim],[data-parallax],[data-reveal]')
      .forEach(function (el) { el.style.opacity = 1; el.style.transform = 'none'; el.style.clipPath = 'none'; });
    return;
  }

  /* ---------- 1. Lenis <-> ScrollTrigger, one clock ---------------------- */
  var lenis = window.lenis;
  if (lenis && typeof lenis.on === 'function') {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  var EASE = 'expo.out';

  /* ---------- 2. Masked line reveal -------------------------------------
     The signature move on every site in the reference set. Each line sits
     in an overflow-hidden wrapper and travels up from fully below it, so
     the type is *wiped* into place rather than faded. Fading is what reads
     as generic; masking reads as typeset.
     SplitText re-splits on resize (lines rewrap at different widths). */
  function splitLines(el) {
    if (!hasSplit) return null;
    return new SplitText(el, {
      type: 'lines',
      linesClass: 'ln-child',
      // each line gets an extra wrapper we can clip against
      autoSplit: true,
      mask: 'lines'          // GSAP 3.13+ builds the mask wrapper for us
    });
  }

  document.querySelectorAll('[data-anim="lines"]').forEach(function (el) {
    var run = function () {
      var split = splitLines(el);
      var targets = split ? split.lines : [el];
      gsap.set(el, { opacity: 1 });
      gsap.from(targets, {
        yPercent: 115,
        duration: 1.15,
        ease: EASE,
        stagger: 0.09,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    };
    // wait for webfonts, or lines split against fallback metrics and rewrap
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
    else run();
  });

  /* ---------- 3. Word-by-word for the big split headlines ---------------- */
  document.querySelectorAll('[data-anim="words"]').forEach(function (el) {
    var run = function () {
      var split = hasSplit ? new SplitText(el, { type: 'words', mask: 'words' }) : null;
      var targets = split ? split.words : [el];
      gsap.set(el, { opacity: 1 });
      gsap.from(targets, {
        yPercent: 110,
        rotate: 2,
        duration: 1.25,
        ease: EASE,
        stagger: 0.055,
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }
      });
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
    else run();
  });

  /* ---------- 4. Clip-path image reveal ---------------------------------
     The photo is uncovered by an animating inset, and the image inside
     counter-scales at the same time. Two moving parts going opposite ways
     is what gives it weight — a single fade has none. */
  document.querySelectorAll('[data-reveal="clip"]').forEach(function (fig) {
    var img = fig.querySelector('img, video');
    var tl = gsap.timeline({
      scrollTrigger: { trigger: fig, start: 'top 85%', once: true }
    });
    tl.fromTo(fig,
      { clipPath: 'inset(0% 0% 100% 0%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: EASE });
    if (img) tl.from(img, { scale: 1.35, duration: 1.6, ease: EASE }, 0);
  });

  /* ---------- 5. Parallax ------------------------------------------------
     scrub:true ties position to scroll rather than to time, so it tracks
     the finger/wheel exactly instead of easing toward a target. */
  document.querySelectorAll('[data-parallax]').forEach(function (el) {
    var amount = parseFloat(el.dataset.parallax) || 12;
    gsap.to(el, {
      yPercent: -amount,
      ease: 'none',
      scrollTrigger: { trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });

  /* ---------- 6. Scroll-velocity skew ------------------------------------
     Images lean into the direction of travel proportionally to scroll
     speed, then settle. This is the single cheapest trick that makes a
     page feel physical rather than static, and it's why the reference
     sites feel "alive" while scrolling.
     Clamped hard — past a few degrees it stops reading as momentum and
     starts reading as a rendering fault. */
  var skewTargets = document.querySelectorAll('[data-skew]');
  if (skewTargets.length) {
    var skewSetters = [];
    skewTargets.forEach(function (el) { skewSetters.push(gsap.quickTo(el, 'skewY', { duration: 0.5, ease: 'power3' })); });
    ScrollTrigger.create({
      onUpdate: function (self) {
        var v = gsap.utils.clamp(-4, 4, self.getVelocity() / -420);
        skewSetters.forEach(function (set) { set(v); });
      }
    });
  }

  /* ---------- 7. Marquee that responds to scroll -------------------------
     Constant-speed marquees look like decoration. Tying speed AND direction
     to scroll makes the strip feel like part of the same physical system as
     the page. */
  document.querySelectorAll('[data-marquee]').forEach(function (track) {
    var base = parseFloat(track.dataset.marquee) || 40;
    var tween = gsap.to(track, {
      xPercent: -50, repeat: -1, ease: 'none', duration: base
    });
    ScrollTrigger.create({
      onUpdate: function (self) {
        var v = self.getVelocity();
        tween.timeScale(gsap.utils.clamp(0.25, 6, 1 + Math.abs(v) / 900));
        if (v < 0) tween.reverse(); else tween.play();
      }
    });
  });

  /* ---------- 8. Sticky section index ------------------------------------
     The running "01 / 09" marker updates as sections pass. Small, but it's
     the kind of detail that signals a considered site. */
  var idxEl = document.querySelector('[data-section-readout]');
  if (idxEl) {
    document.querySelectorAll('[data-section-name]').forEach(function (sec) {
      ScrollTrigger.create({
        trigger: sec, start: 'top 50%', end: 'bottom 50%',
        onToggle: function (self) { if (self.isActive) idxEl.textContent = sec.dataset.sectionName; }
      });
    });
  }

  /* ---------- 9. Load intro ----------------------------------------------
     One timeline for the whole first screen so the beats are choreographed
     against each other rather than each element guessing a delay. */
  var intro = gsap.timeline({ delay: 0.15 });
  intro.from('[data-intro]', {
    yPercent: 60, opacity: 0, duration: 1.2, ease: EASE, stagger: 0.08
  });

  /* Recalculate once everything has loaded and laid out. */
  addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
