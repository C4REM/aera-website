/* ==========================================================================
   AERA — WORK GALLERY
   Projects sit on the surface of a large invisible cylinder, arranged as a
   helix: each successive project advances one step around the axis AND one
   step up it. Scrolling turns the cylinder, so projects wind past the camera
   in a spiral. Modelled on jordigarreta.com, which does the same thing in
   WebGL2.

   Why Three.js and not CSS 3D: CSS can only transform flat quads. The whole
   character of the reference is that each panel is BENT around the cylinder,
   so its outer edges physically recede from the camera. That needs real
   geometry with subdivided vertices — a previous CSS attempt could not do it
   and read as flat cards floating in space.

   Degrades to a plain DOM grid (already in the markup) when WebGL is missing,
   reduced-motion is set, or we're on touch — a scroll-driven fly-through you
   cannot hover is not worth the scroll distance on a phone.
   ========================================================================== */
(function () {
  const stage    = document.getElementById('pgStage');
  const track    = document.getElementById('pgTrack');
  const canvas   = document.getElementById('pgCanvas');
  const dataEl   = document.getElementById('pgData');
  const fallback = document.getElementById('pgFallback');
  if (!stage || !track || !canvas || !dataEl) return;

  let PROJECTS = [];
  try { PROJECTS = JSON.parse(dataEl.textContent); } catch (e) { return; }
  if (!PROJECTS.length) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = !matchMedia('(hover: hover) and (pointer: fine)').matches;
  const small  = matchMedia('(max-width: 900px)').matches;

  // Bail to the DOM grid before touching WebGL at all.
  if (reduce || coarse || small || typeof THREE === 'undefined') return;

  const gl = (() => {
    try { return canvas.getContext('webgl2') || canvas.getContext('webgl'); }
    catch (e) { return null; }
  })();
  if (!gl) return;

  // WebGL is good — hand the page over to the canvas.
  document.body.classList.add('pg-live');
  if (fallback) fallback.setAttribute('aria-hidden', 'true');

  /* ---------------- geometry constants ---------------- */
  const N        = PROJECTS.length;
  const RADIUS   = 7.4;              // cylinder radius, world units
  const CARD_W   = 4.6;              // arc width of a panel
  const CARD_H   = 2.7;
  const SEG      = 40;               // horizontal subdivisions — the bend
  const ANGLE    = (Math.PI * 2) / N;// one full turn across all projects
  const Y_STEP   = 1.15;             // helix rise per project
  const FOV      = 46;
  // How much of the viewport the front panel should take up. Below ~0.55 you
  // stop reading it as a cylinder because the neighbours fall off-screen; above
  // ~0.65 the front panel covers everything and it looks like a slideshow.
  const FILL     = 0.56;

  /* ---------------- scene ---------------- */
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, RADIUS + 6);
  camera.lookAt(0, 0, 0);

  /* Bend a flat plane around a vertical axis of the given radius.
     A vertex at arc-offset x maps to angle phi = x / R on the cylinder, so it
     moves outward in x and BACKWARD in z. z is negative at the edges, i.e.
     away from a camera sitting at +z — which is exactly the recession that
     makes the panel read as curved rather than flat. */
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

  const cards = PROJECTS.map((p, i) => {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x1b1a1e,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    loader.load(
      p.cover,
      tex => {
        tex.encoding = THREE.sRGBEncoding;
        tex.minFilter = THREE.LinearFilter;          // no mipmaps → no NPOT issues
        tex.generateMipmaps = false;
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        mat.map = tex;
        mat.color.setHex(0xffffff);
        mat.needsUpdate = true;
        mesh.userData.hasTex = true;   // only textured panels may be tinted
      },
      undefined,
      () => { /* texture failed — the flat tile colour stands in */ }
    );

    const mesh = new THREE.Mesh(geom, mat);
    // hv = this panel's own eased hover amount, 0→1
    mesh.userData = { i, href: p.href, title: p.title, cat: p.cat, hv: 0, hasTex: false, facing: 0 };
    scene.add(mesh);
    return mesh;
  });

  /* ---------------- scroll → helix progress ---------------- */
  // Wrap an offset into [-N/2, N/2) so a project leaving one end reappears at
  // the other. The wrap happens at angle ±PI — the far side of the cylinder,
  // behind everything — so the jump is never visible.
  function wrap(v) {
    const m = ((v % N) + N) % N;
    return m > N / 2 ? m - N : m;
  }

  let target = 0;   // where the scroll says we are, in project units
  let current = 0;  // eased follower — this is what makes it glide
  let hovered = null;
  let dim = 0;      // eased 0→1 while ANY panel is hovered

  /* Hover feel, in one place.
     LIFT is along the panel's own radius, not toward the camera. Lerping toward
     camera.position (the previous approach) drags panels above and below the
     centre line diagonally inward, so they slide across the screen instead of
     stepping out of the wall. Pushing along the radius moves each panel
     perpendicular to its own face, which is what "lifting off the cylinder"
     actually looks like. */
  const LIFT  = 0.85;   // world units outward from the cylinder surface
  const GROW  = 0.055;  // extra scale at full hover
  const FADE  = 0.42;   // how far unhovered panels drop back
  const EASE_H = 12;    // hover in/out speed
  const EASE_D = 9;     // global dim speed

  function readScroll() {
    const r = track.getBoundingClientRect();
    const scrollable = r.height - innerHeight;
    let p = scrollable > 0 ? (-r.top) / scrollable : 0;
    p = Math.max(0, Math.min(1, p));
    target = p * N;
  }

  // Camera distance is solved from the viewport rather than hard-coded, so the
  // front panel occupies the same fraction of the screen on a laptop as on an
  // ultrawide. Solve it twice — once so the panel's HEIGHT fits, once so its
  // WIDTH fits — and take whichever pushes the camera further back, otherwise
  // a narrow window crops the panel's sides.
  function resize() {
    const w = stage.clientWidth || innerWidth;
    const h = stage.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const halfFov = (FOV * Math.PI / 180) / 2;
    const dForHeight = CARD_H / (2 * Math.tan(halfFov) * FILL);
    const dForWidth  = CARD_W / (2 * Math.tan(halfFov) * camera.aspect * FILL);
    camera.position.z = RADIUS + Math.max(dForHeight, dForWidth);
    camera.lookAt(0, 0, 0);
  }

  /* ---------------- pointer ---------------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(-2, -2);

  function setNdc(e) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  /* Cursor feedback rides the site's EXISTING custom cursor (#cursorRing in
     main.js) rather than a second label of our own. main.js only knows how to
     react to real DOM hoverables, and the panels are pixels on a canvas — so it
     can never light up by itself here. Driving its classes directly keeps the
     cylinder consistent with every other link on the site instead of inventing
     a parallel cursor that behaves slightly differently.

     main.js's own mouseover/mouseout handlers match `a, button, .tile, …`; the
     canvas matches none of them, so nothing fights us for these classes. */
  const ring = document.getElementById('cursorRing');
  const customCursor = !!ring && document.body.classList.contains('has-cursor');

  function setLabel(hit) {
    if (ring) {
      ring.classList.toggle('hover', !!hit);
      ring.classList.toggle('hover-text', !!hit);
      if (hit) ring.setAttribute('data-label', 'View');
    }
    // Only fall back to a real pointer when the custom cursor isn't running —
    // otherwise body{cursor:none} is defeated by an inline cursor:pointer and
    // you get the OS arrow and the champagne ring on screen at the same time.
    if (!customCursor) canvas.style.cursor = hit ? 'pointer' : 'default';
  }

  // One picking helper, used by BOTH the per-frame cursor update and the click
  // handler. The click must do its own pick rather than trusting the last
  // frame's hover state: the panels move under a stationary cursor while you
  // scroll, and a click that lands before the next frame would otherwise see a
  // stale (often null) hover and silently do nothing.
  /* Only the near face of the cylinder is pickable.

     Three.js r128's Raycaster does NOT skip meshes with visible=false, and the
     panels are DoubleSide with depthWrite:false — so every panel on the BACK of
     the cylinder is still a valid ray target even though you cannot see it.
     Point at a gap between two front panels and the ray sails through and hits
     whatever is round the back. Those panels are sweeping past as you scroll,
     so the hit flips between them (and to null) every few frames, which is the
     cursor "spamming" between projects.

     Filtering by facing — how square-on a panel is to the camera — restricts
     picking to panels genuinely presented to the viewer. 0.35 is comfortably
     past the point where a panel has turned edge-on, so a panel stops being
     clickable at roughly the moment it stops being legible.

     facing is written by the previous frame, which is the RIGHT frame to use:
     the ray runs against the previous frame's world matrices too, so the two
     agree. Reusing one array avoids allocating every frame. */
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
  canvas.addEventListener('pointerleave', () => {
    ndc.set(-2, -2);
    setLabel(null);
  });

  /* ---------------- open transition ---------------- */
  // The clicked panel flies at the camera while a veil fades up, then we
  // navigate. Doing it in-scene keeps the curvature through the whole move.
  let opening = null;
  const veil = document.getElementById('pgVeil');

  canvas.addEventListener('click', e => {
    if (opening) return;
    setNdc(e);                 // trust this event, not the last pointermove
    const mesh = pick();
    if (!mesh) return;
    opening = {
      mesh,
      t0: performance.now(),
      from: mesh.position.clone(),
      href: mesh.userData.href
    };
    setLabel(null);
  });

  /* ---------------- HUD ---------------- */
  const hudCat   = document.getElementById('pgCat');
  const hudTitle = document.getElementById('pgTitle');
  const hudNum   = document.getElementById('pgNum');
  let activePrev = -1;

  /* ---------------- frame ---------------- */
  const clock = new THREE.Clock();

  function frame() {
    requestAnimationFrame(frame);

    readScroll();
    // critically-damped-ish follow. Frame-rate independent so a 120Hz display
    // doesn't glide twice as fast as a 60Hz one.
    const dt = Math.min(clock.getDelta(), 0.05);
    current += (target - current) * (1 - Math.exp(-7.5 * dt));

    // Pick BEFORE positioning, so this frame's hover feeds this frame's layout.
    // (The ray uses last frame's matrices either way — one frame of lag that
    // nobody can see — but doing it here keeps hover and position in step.)
    const hit = opening ? null : pick();
    if (hit !== hovered) {
      hovered = hit;
      setLabel(hit);
    }

    // Frame-rate-independent easing, same shape as the scroll follower. The old
    // hover used a fixed per-frame lerp, which ran twice as fast on a 120Hz
    // display, and — because positions are rebuilt from the helix every frame —
    // snapped back instantly on exit instead of easing out.
    dim += ((hit ? 1 : 0) - dim) * (1 - Math.exp(-EASE_D * dt));

    let active = 0, bestScore = -Infinity;

    for (const mesh of cards) {
      const d = mesh.userData;
      d.hv += ((mesh === hit ? 1 : 0) - d.hv) * (1 - Math.exp(-EASE_H * dt));
      const hv = d.hv;

      const k = wrap(d.i - current);
      const a = k * ANGLE;

      // push out along this panel's own radius — perpendicular to its face
      const r = RADIUS + hv * LIFT;
      mesh.position.set(Math.sin(a) * r, k * Y_STEP, Math.cos(a) * r);
      mesh.rotation.set(0, a, 0);

      const s = 1 + hv * GROW;
      mesh.scale.set(s, s, s);

      // face-on-ness: 1 when the panel points straight at the camera.
      // Stashed on the mesh because pick() (which runs at the TOP of the next
      // frame, before this loop) uses it to ignore the back of the cylinder.
      const facing = Math.cos(a);
      d.facing = facing;
      const t = Math.max(0, facing);
      // fade the far side out rather than letting it clip through
      const base = Math.pow(t, 1.6) * 0.96 + 0.04;

      // everything that isn't the hovered panel recedes slightly, so the one
      // you're pointing at is the only thing at full strength
      const back = 1 - dim * (1 - hv) * FADE;
      mesh.material.opacity = base * back;
      if (d.hasTex) mesh.material.color.setScalar(back);

      mesh.renderOrder = hv > 0.01 ? 5 : 0;   // lifted panel draws over its neighbours
      mesh.visible = facing > -0.15;

      const score = facing - Math.abs(k) * 0.02;
      if (score > bestScore) { bestScore = score; active = d.i; }
    }

    if (active !== activePrev) {
      activePrev = active;
      const p = PROJECTS[active];
      if (hudCat)   hudCat.textContent   = p.cat;
      if (hudTitle) hudTitle.textContent = p.title;
      if (hudNum)   hudNum.textContent   = String(active + 1).padStart(2, '0');
    }

    if (opening) {
      setLabel(null);
      const k = Math.min(1, (performance.now() - opening.t0) / 820);
      const e = k * k * (3 - 2 * k);                       // smoothstep
      opening.mesh.position.lerpVectors(opening.from, camera.position, e * 0.97);
      opening.mesh.material.opacity = 1;
      opening.mesh.renderOrder = 10;
      if (veil) veil.style.opacity = String(Math.max(0, (k - 0.45) / 0.55));
      if (k >= 1) { location.href = opening.href; opening = null; }
    }

    renderer.render(scene, camera);
  }

  resize();
  addEventListener('resize', resize);
  requestAnimationFrame(frame);
})();
