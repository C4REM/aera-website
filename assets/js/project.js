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

/* Film player (sc-film). The video carries its HLS playlist in data-hls and
   loads nothing until someone presses play. Safari plays HLS natively; every
   other browser gets our self-hosted hls.js light build, fetched on demand. */
(() => {
  document.querySelectorAll('.sc-film').forEach(box => {
    const v = box.querySelector('video'), btn = box.querySelector('.sc-play');
    if (!v || !btn) return;
    let ready = false;
    const loadScript = src => new Promise((ok, no) => {
      const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s);
    });
    const start = async () => {
      box.classList.add('is-playing');
      v.controls = true;  // native controls only once the film is running
      if (!ready) {
        ready = true;
        const src = v.dataset.hls;
        if (v.canPlayType('application/vnd.apple.mpegurl')) v.src = src;
        else {
          try { await loadScript('/assets/js/hls.light.min.js'); } catch (e) {}
          if (window.Hls && window.Hls.isSupported()) { const h = new window.Hls({ capLevelToPlayerSize: true }); h.loadSource(src); h.attachMedia(v); }
          else v.src = src;
        }
      }
      v.play().catch(() => {});
    };
    btn.addEventListener('click', start);
    v.addEventListener('play', () => box.classList.add('is-playing'));
  });
})();
