/* ==========================================================================
   AERA — HOMEPAGE SERVICE WHEEL, MINI CYLINDER
   A shrunk-down version of the work page's gallery: the six service photos sit
   on the surface of an invisible cylinder arranged as a helix, each one step
   around the axis and one step up it. Same curved-plane technique, same hover
   feel, same fade for the far side — see gallery.js for the reasoning behind
   each of those. This is deliberately the same object, smaller.

   Two differences from the work page, both forced by context:

   1. It never turns on its own. No scroll track of its own, no click-to-open.
      main.js already walks the six .wheel-item names every frame and works out
      which is centred; it dispatches `aera:wheelactive` with that index, and
      all this module does is ease its rotation so that card faces the camera.
      Photo and name cannot drift apart because they share one source of truth.

   2. The whole cylinder is one link to work.html — the <a> in the markup — so
      hovering any panel lifts it off the wall but clicking anywhere goes to the
      same place. That also means the site's custom cursor lights up on its own
      (main.js matches `a`, and the canvas sits inside one), so unlike gallery.js
      there's no cursor-label code here.

   Degrades to the flat crossfading <img> stack (already in the markup) when
   WebGL is missing, reduced-motion is set, on touch, or under 880px — the same
   width the section's CSS already hides `.wheel-media` below.
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

  // WebGL is good — hand the frame over to the canvas. Among other things this
  // drops the bordered box the fallback images live in: a cylinder inside a
  // hard-edged 4:5 window reads as a slideshow, because the panels turning away
  // get clipped exactly where they'd otherwise show their depth.
  document.body.classList.add('wheel-live');

  /* ---------------- geometry constants ---------------- */
  const N      = imgs.length;
  const RADIUS = 7.4;              // cylinder radius, world units
  const CARD_W = 5.4;              // arc width of a panel
  const CARD_H = 3.6;              // 3:2 — textures are fitted to it, see below
  const SEG    = 40;               // horizontal subdivisions — the bend
  const ANGLE  = (Math.PI * 2) / N;
  const Y_STEP = 0.72;             // helix rise per service
  const FOV    = 46;
  // Same reasoning as the work page: below ~0.5 the neighbours fall off-screen
  // and you stop reading a cylinder; above ~0.65 the front panel covers
  // everything and it's a slideshow again.
  const FILL   = 0.54;

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, RADIUS + 6);
  camera.lookAt(0, 0, 0);

  /* Bend a flat plane around a vertical axis: a vertex at arc-offset x maps to
     angle phi = x / R, moving outward in x and BACKWARD in z, away from a
     camera at +z. That recession is what makes a panel read as curved. */
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

  const CARD_ASPECT = CARD_W / CARD_H;

  /* object-fit: cover, in texture space.

     The work page gets away without this because every project cover is already
     landscape. These six are not — they're posters, portraits and stills at
     wildly different shapes, and a plane stretches whatever texture it's given
     across its full face, so a portrait poster on a 3:2 panel comes out visibly
     squashed. Scaling the UV rect down on the long axis and re-centring it
     crops the overflow instead of squeezing it, which is exactly what
     object-fit:cover does for the flat <img> fallback below. */
  function cover(tex) {
    const img = tex.image;
    if (!img || !img.width || !img.height) return;
    const a = img.width / img.height;
    if (a > CARD_ASPECT) {
      const r = CARD_ASPECT / a;              // image is wider — crop the sides
      tex.repeat.set(r, 1);
      tex.offset.set((1 - r) / 2, 0);
    } else {
      const r = a / CARD_ASPECT;              // image is taller — crop top/bottom
      tex.repeat.set(1, r);
      tex.offset.set(0, (1 - r) / 2);
    }
  }

  const cards = imgs.map((img, i) => {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x1b1a1e, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false
    });
    const mesh = new THREE.Mesh(geom, mat);
    // hv = this panel's own eased hover amount, 0→1
    mesh.userData = { i, hv: 0, hasTex: false, facing: 0 };

    loader.load(
      img.currentSrc || img.src,
      tex => {
        tex.encoding = THREE.sRGBEncoding;
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        cover(tex);
        mat.map = tex;
        mat.color.setHex(0xffffff);
        mat.needsUpdate = true;
        mesh.userData.hasTex = true;
      },
      undefined,
      () => { /* texture failed — the flat tile colour stands in */ }
    );

    scene.add(mesh);
    return mesh;
  });

  // Wrap an offset into [-N/2, N/2) so a card leaving one end reappears at the
  // other. The wrap happens at angle ±PI, round the back, so it's never seen.
  function wrap(v) {
    const m = ((v % N) + N) % N;
    return m > N / 2 ? m - N : m;
  }

  /* Hover feel — same shape as gallery.js. LIFT pushes along the panel's own
     radius, perpendicular to its face, so it steps out of the wall rather than
     sliding diagonally across the screen toward the camera. */
  const LIFT   = 0.85;
  const GROW   = 0.055;
  const FADE   = 0.42;
  const EASE_H = 12;
  const EASE_D = 9;

  let target = 0, current = 0;
  let hovered = null;
  let dim = 0;

  // The one and only rotation input: main.js's index, whenever it changes.
  document.addEventListener('aera:wheelactive', e => {
    target = e.detail.index;
  });

  /* ---------------- pointer ---------------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(-2, -2);

  function setNdc(e) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  /* Only the near face is pickable. r128's Raycaster ignores visible=false and
     these panels are DoubleSide, so without a facing filter the ray sails
     through the gaps and hits the back of the cylinder, flipping the hover
     between panels you cannot see. Reuses one array to avoid per-frame garbage. */
  const pickable = [];

  function pick() {
    pickable.length = 0;
    for (const mesh of cards) {
      if (mesh.visible && mesh.userData.facing > 0.35) pickable.push(mesh);
    }
    if (!pickable.length) return null;
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pickable, false);
    return hits.length ? hits[0].object : null;
  }

  canvas.addEventListener('pointermove', setNdc, { passive: true });
  canvas.addEventListener('pointerleave', () => ndc.set(-2, -2));

  // Camera distance is solved from the frame rather than hard-coded, so the
  // front panel takes up the same fraction of it at any window size. Solve
  // twice — once for the panel's height, once for its width — and take
  // whichever pushes the camera further back, or a narrow frame crops the sides.
  function resize() {
    const w = frame.clientWidth  || 400;
    const h = frame.clientHeight || 400;
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

    // shortest-path ease: approach the target via whichever wrapped direction is
    // nearer, so going from item 6 back to item 1 turns forward, not back
    // across all five others
    current += wrap(target - current) * (1 - Math.exp(-7 * dt));

    // Pick before positioning so this frame's hover feeds this frame's layout.
    const hit = pick();
    if (hit !== hovered) hovered = hit;

    dim += ((hit ? 1 : 0) - dim) * (1 - Math.exp(-EASE_D * dt));

    for (const mesh of cards) {
      const d = mesh.userData;
      d.hv += ((mesh === hit ? 1 : 0) - d.hv) * (1 - Math.exp(-EASE_H * dt));
      const hv = d.hv;

      const k = wrap(d.i - current);
      const a = k * ANGLE;

      const r = RADIUS + hv * LIFT;
      mesh.position.set(Math.sin(a) * r, k * Y_STEP, Math.cos(a) * r);
      mesh.rotation.set(0, a, 0);

      const s = 1 + hv * GROW;
      mesh.scale.set(s, s, s);

      const facing = Math.cos(a);
      d.facing = facing;
      const t = Math.max(0, facing);
      const base = Math.pow(t, 1.6) * 0.96 + 0.04;

      // everything that isn't the hovered panel recedes slightly
      const back = 1 - dim * (1 - hv) * FADE;
      mesh.material.opacity = base * back;
      if (d.hasTex) mesh.material.color.setScalar(back);

      mesh.renderOrder = hv > 0.01 ? 5 : 0;
      mesh.visible = facing > -0.15;
    }

    renderer.render(scene, camera);
  }

  resize();
  addEventListener('resize', resize);
  requestAnimationFrame(frameLoop);
})();
