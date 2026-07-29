/* ==========================================================================
   AERA — HOMEPAGE SERVICE WHEEL, MINI CYLINDER
   The six service photos sit on the surface of a small invisible ring, one
   step apart, facing outward — a shrunk-down version of the work page's
   cylinder (same curved-plane technique), but flat rather than a helix: with
   only six cards and a ~300px frame, any vertical rise would push neighbours
   out of frame instead of just around it.

   Unlike the work-page gallery this ring never turns on its own. It has no
   scroll track, no click-to-open, no raycaster — it turns ONLY because
   main.js tells it to. main.js already walks the six .wheel-item names every
   frame and works out which one is centred (activeIdx); it dispatches
   `aera:wheelactive` with that index whenever it changes, and all this module
   does is ease its rotation so that card faces the camera. Photo and name
   cannot drift apart because they share one source of truth.

   Degrades to the flat crossfading <img> stack (already in the markup) when
   WebGL is missing, reduced-motion is set, on touch, or under 880px — the
   same width the section's CSS already hides `.wheel-media` below, so there
   is nothing to gain by running this there anyway.
   ========================================================================== */
(function () {
  const frame  = document.getElementById('wheelMedia');
  const canvas = document.getElementById('wheelCanvas');
  if (!frame || !canvas) return;

  const imgs = Array.from(frame.querySelectorAll('img'));
  if (!imgs.length) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = !matchMedia('(hover: hover) and (pointer: fine)').matches;
  const small  = matchMedia('(max-width: 880px)').matches;
  if (reduce || coarse || small || typeof THREE === 'undefined') return;

  const gl = (() => {
    try { return canvas.getContext('webgl2') || canvas.getContext('webgl'); }
    catch (e) { return null; }
  })();
  if (!gl) return;

  // WebGL is good — hand the frame over to the canvas. The CSS rule this adds
  // (`body.wheel-live .wheel-media img{opacity:0!important}`) overrides the
  // inline opacity main.js's crossfade sets, without that code needing to
  // know this module exists at all.
  document.body.classList.add('wheel-live');

  /* ---------------- geometry constants ---------------- */
  const N      = imgs.length;
  const RADIUS = 3.6;
  const CARD_W = 2.3;
  const CARD_H = 2.875;           // 4:5, matching the frame's own aspect-ratio
  const SEG    = 24;
  const ANGLE  = (Math.PI * 2) / N;
  const FOV    = 40;
  const FILL   = 0.66;            // the active card should all but fill the frame

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  camera.position.set(0, 0, RADIUS + 4);
  camera.lookAt(0, 0, 0);

  // Same bend as the work page: a vertex at arc-offset x maps to angle
  // phi = x / r on the cylinder, moving outward in x and back in z.
  function curvedPlane(w, h, r, seg) {
    const g = new THREE.PlaneGeometry(w, h, seg, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const phi = x / r;
      pos.setX(i, Math.sin(phi) * r);
      pos.setZ(i, Math.cos(phi) * r - r);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }

  const geom = curvedPlane(CARD_W, CARD_H, RADIUS, SEG);
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');

  const cards = imgs.map((img, i) => {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x1b1a1e, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false
    });
    loader.load(
      img.currentSrc || img.src,
      tex => {
        tex.encoding = THREE.sRGBEncoding;
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        mat.map = tex;
        mat.color.setHex(0xffffff);
        mat.needsUpdate = true;
      },
      undefined,
      () => { /* texture failed — the flat tile colour stands in */ }
    );
    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData.i = i;
    scene.add(mesh);
    return mesh;
  });

  function wrap(v) {
    const m = ((v % N) + N) % N;
    return m > N / 2 ? m - N : m;
  }

  let target = 0, current = 0;

  // The one and only input: main.js's index, whenever it changes.
  document.addEventListener('aera:wheelactive', e => {
    target = e.detail.index;
  });

  function resize() {
    const w = frame.clientWidth  || 300;
    const h = frame.clientHeight || 375;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const halfFov = (FOV * Math.PI / 180) / 2;
    const dForHeight = CARD_H / (2 * Math.tan(halfFov) * FILL);
    const dForWidth  = CARD_W / (2 * Math.tan(halfFov) * camera.aspect * FILL);
    camera.position.z = RADIUS + Math.max(dForHeight, dForWidth);
    camera.lookAt(0, 0, 0);
  }

  const clock = new THREE.Clock();

  function frameLoop() {
    requestAnimationFrame(frameLoop);
    const dt = Math.min(clock.getDelta(), 0.05);
    // shortest-path ease: approach target via whichever wrapped direction is
    // nearer, so swapping from item 6 back to item 1 turns forward, not back
    // across all five others
    const delta = wrap(target - current);
    current += delta * (1 - Math.exp(-7 * dt));

    for (const mesh of cards) {
      const k = wrap(mesh.userData.i - current);
      const a = k * ANGLE;
      mesh.position.set(Math.sin(a) * RADIUS, 0, Math.cos(a) * RADIUS);
      mesh.rotation.set(0, a, 0);

      const facing = Math.cos(a);
      const t = Math.max(0, facing);
      mesh.material.opacity = Math.pow(t, 1.6) * 0.96 + 0.04;
      mesh.visible = facing > -0.15;
    }

    renderer.render(scene, camera);
  }

  resize();
  addEventListener('resize', resize);
  requestAnimationFrame(frameLoop);
})();
