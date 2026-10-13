/* =====================================================================
   TEAM POSTER + PROFILE DRIFT (Oct 2026)
   team.html: nothing is spotlit at rest. Pointing at a figure, or at their
   name billed above them, lights that person (full colour, spotlight, name
   in champagne) and drops everyone else into shadow. Leaving the stage
   puts everyone back to the even resting light. Touch never hovers, so
   phones simply see the resting poster.
   Profile pages: the giant first name and the cutout drift slightly against
   each other as the pointer moves, for a little depth between the layers.
   ===================================================================== */
(function () {
  var stage = document.getElementById('castStage');
  var bill = document.querySelector('.pt-billtop');
  if (stage && window.matchMedia('(hover: hover)').matches) {
    var figs = [].slice.call(stage.querySelectorAll('.pt-fig'));
    var names = bill ? [].slice.call(bill.querySelectorAll('.pt-name')) : [];
    function focus(i) {
      stage.classList.add('has-focus'); if (bill) bill.classList.add('has-focus');
      figs.forEach(function (f) { f.classList.toggle('is-focus', f.getAttribute('data-i') === i); });
      names.forEach(function (n) { n.classList.toggle('is-focus', n.getAttribute('data-i') === i); });
    }
    function clear() {
      stage.classList.remove('has-focus'); if (bill) bill.classList.remove('has-focus');
      figs.concat(names).forEach(function (x) { x.classList.remove('is-focus'); });
    }
    figs.concat(names).forEach(function (el) {
      el.addEventListener('mouseenter', function () { focus(el.getAttribute('data-i')); });
      el.addEventListener('focus', function () { focus(el.getAttribute('data-i')); });
      el.addEventListener('mouseleave', clear);
      el.addEventListener('blur', clear);
    });
  }

  var hero = document.querySelector('.pf-hero');
  if (hero && window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
    var giant = hero.querySelector('.pf-giant');
    var cut = hero.querySelector('.pf-cut');
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    function step() {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      if (giant) giant.style.transform = 'translate3d(' + (cx * -18).toFixed(2) + 'px,' + (cy * -8).toFixed(2) + 'px,0)';
      if (cut) cut.style.translate = (cx * 10).toFixed(2) + 'px ' + (cy * 4).toFixed(2) + 'px';
      raf = (Math.abs(tx - cx) + Math.abs(ty - cy) > 0.001) ? requestAnimationFrame(step) : 0;
    }
    hero.addEventListener('pointermove', function (ev) {
      var r = hero.getBoundingClientRect();
      tx = (ev.clientX - r.left) / r.width - 0.5;
      ty = (ev.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(step);
    });
    hero.addEventListener('pointerleave', function () { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(step); });
  }
})();
