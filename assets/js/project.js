/* Project pages ("screening" layout, see tools/gen_projects.py).
   The opening frame sits in a sticky viewport inside a taller header; as you
   scroll through the header the frame scales up, so the camera pushes in
   (on Headspace, Nolan falls towards you). The credit line and scroll cue
   fade out over the first third. One rAF per scroll, nothing per frame when
   idle, and nothing at all under reduced motion. */
(() => {
  const open = document.querySelector('.sc-open');
  if (!open) return;
  const img = open.querySelector('.sc-open-img');
  const meta = open.querySelectorAll('.sc-meta, .sc-cue');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const zoom = open.classList.contains('sc-dark') ? 1.9 : 1.18;
  let queued = false;
  const ease = t => 1 - Math.pow(1 - t, 2);
  const tick = () => {
    queued = false;
    const r = open.getBoundingClientRect();
    const span = Math.max(1, r.height - innerHeight);
    const p = Math.min(1, Math.max(0, -r.top / span));
    img.style.transform = `scale(${(1 + (zoom - 1) * ease(p)).toFixed(4)})`;
    const o = Math.max(0, 1 - p * 3).toFixed(3);
    meta.forEach(m => { m.style.opacity = o; });
    open.style.setProperty('--sc-dim', (p * 0.55).toFixed(3));
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(tick); } }, { passive: true });
  addEventListener('resize', tick);
  tick();
})();
