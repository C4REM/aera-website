/* =====================================================================
   TEAM CAST (Oct 2026)
   On team.html the cast stands on one stage. Pointing at someone moves the
   spotlight onto them: they come up to full light and colour, everyone else
   drops back into silhouette. Leaving the stage brings everyone back to the
   resting, evenly lit state. Touch screens never get a hover, so there the
   resting state is the whole show.
   On profile pages the giant first name drifts slightly against the cutout
   as the pointer moves, for a little depth between the two layers.
   ===================================================================== */
(function () {
  var stage = document.getElementById('castStage');
  if (stage && window.matchMedia('(hover: hover)').matches) {
    var members = [].slice.call(stage.querySelectorAll('.cast-m'));
    members.forEach(function (m) {
      m.addEventListener('mouseenter', function () {
        stage.classList.add('has-focus');
        members.forEach(function (o) { o.classList.toggle('is-focus', o === m); });
      });
      m.addEventListener('focus', function () {
        stage.classList.add('has-focus');
        members.forEach(function (o) { o.classList.toggle('is-focus', o === m); });
      });
    });
    stage.addEventListener('mouseleave', function () {
      stage.classList.remove('has-focus');
      members.forEach(function (o) { o.classList.remove('is-focus'); });
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
