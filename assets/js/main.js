/* ==========================================================================
   AERA — shared site behaviour
   Preloader, custom cursor, sticky nav, mobile menu, scroll reveal,
   FAQ accordions, footer year, and the chat-style "Find your fit" tool
   (home page only — no-ops on every other page).
   ========================================================================== */

/* ---- SMOOTH SCROLL (Lenis) ----
   The Pop-Up Hotel runs this exact library; it's why their scroll feels
   continuous. A native wheel notch jumps the page ~100px in one frame, so the
   motion is stepped. Lenis keeps a target position and eases the real scroll
   toward it every frame, giving sub-pixel movement and momentum on release.
   Chosen over Bruut's approach (body:fixed + a hidden proxy scroller + a
   transformed wrapper) because that one breaks window.scrollY, which every
   scroll-driven section on this site depends on. Lenis drives the real
   scroll position, so all of it keeps working unchanged. */
(function(){
  if (typeof Lenis === 'undefined') return;                       // CDN blocked → native scroll, site still fine
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;  // leave touch momentum alone

  const lenis = new Lenis({
    lerp: 0.065,          // lower = longer glide. 0.085 was Pop-Up Hotel's weight; 0.065 carries further
    wheelMultiplier: 1,
    smoothWheel: true,
    syncTouch: false
  });
  window.lenis = lenis;

  function raf(t){ lenis.raf(t); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);

  // in-page anchors have to go through Lenis or they fight it
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.length < 2) return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -72 });        // clears the fixed nav
  });
})();

/* ---- PRELOADER — a slow blur-to-focus wordmark reveal, no progress counter ---- */
(function(){
  const pre = document.getElementById('preloader');
  if (!pre) return;
  const seen = sessionStorage.getItem('aera-seen-preloader');
  document.body.classList.add('preloading');
  if (seen) document.body.classList.add('preloader-seen');

  const hold = seen ? 650 : 2200; // snappier hold; quicker still on repeat views

  setTimeout(() => {
    pre.classList.add('done');
    document.body.classList.remove('preloading');
    sessionStorage.setItem('aera-seen-preloader', '1');
    window.dispatchEvent(new CustomEvent('aera:preloaderdone'));
    setTimeout(() => { pre.style.display = 'none'; }, 1100);
  }, hold);
})();

/* ---- LIVING BACKGROUND — flowing WebGL noise field ----
   A domain-warped fBm noise field flows slowly over near-black in warm amber
   tones and warms toward the cursor. Rendered at reduced resolution (+ CSS
   blur) so it stays smooth. Falls back silently to the CSS gradient if WebGL
   is unavailable or reduced-motion is set. */
(function(){
  const canvas = document.getElementById('bgGL');
  if (!canvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return; // CSS fallback gradient remains

  const vert = `
    attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

  const frag = `
    precision highp float;
    uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
    float noise(vec2 p){
      vec2 i=floor(p), f=fract(p);
      vec2 u=f*f*(3.0-2.0*f);
      return mix(mix(hash(i+vec2(0.0,0.0)),hash(i+vec2(1.0,0.0)),u.x),
                 mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);
    }
    float fbm(vec2 p){
      float v=0.0, a=0.5;
      for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=0.5; }
      return v;
    }
    void main(){
      vec2 uv = gl_FragCoord.xy/uRes;
      vec2 p = uv; p.x *= uRes.x/uRes.y; p *= 1.5;
      float t = uTime*0.05;
      vec2 q = vec2(fbm(p+vec2(0.0,t)), fbm(p+vec2(5.2,-t)));
      vec2 r = vec2(fbm(p+3.5*q+vec2(1.7,9.2)+t*0.4),
                    fbm(p+3.5*q+vec2(8.3,2.8)-t*0.4));
      float f = fbm(p+3.5*r);
      float amt = pow(clamp(f,0.0,1.0),1.7);
      // warm boost near the cursor
      vec2 m = uMouse; m.x *= uRes.x/uRes.y;
      float md = distance(p, m*1.5);
      float warm = smoothstep(1.35,0.0,md);
      vec3 base  = vec3(0.020,0.020,0.024);
      vec3 deep  = vec3(0.32,0.18,0.09);
      vec3 amber = vec3(0.86,0.55,0.28);
      vec3 col = mix(base, deep, amt*0.50);
      col = mix(col, amber, amt*amt*0.45*(0.30+1.40*warm));
      col *= 1.0 - 0.34*length(uv-vec2(0.5,0.5));   // gentle vignette
      // keep the centre (where hero text sits) a touch darker
      col *= 0.72 + 0.28*smoothstep(0.16,0.55,length(uv-vec2(0.5,0.5)));
      gl_FragColor = vec4(col, 1.0);
    }`;

  function sh(type, src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s); return s; }
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vert));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return; // give up → CSS fallback
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uMouse = gl.getUniformLocation(prog, 'uMouse');

  const SCALE = 0.5; // render at half res, CSS blur smooths it
  function resize(){
    const w = Math.max(2, (innerWidth  * SCALE) | 0);
    const h = Math.max(2, (innerHeight * SCALE) | 0);
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  resize(); addEventListener('resize', resize);

  let mx = 0.5, my = 0.55, tmx = 0.5, tmy = 0.55;
  addEventListener('pointermove', e => {
    tmx = e.clientX / innerWidth;
    tmy = 1.0 - e.clientY / innerHeight;
  }, { passive: true });

  const t0 = performance.now();
  function frame(now){
    requestAnimationFrame(frame);
    mx += (tmx - mx) * 0.075; my += (tmy - my) * 0.075;  // eased cursor follow
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (now - t0) / 1000);
    gl.uniform2f(uMouse, mx, my);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  requestAnimationFrame(frame);
})();

/* ---- ANIMATED FILM GRAIN — throttled canvas noise over the living bg ---- */
(function(){
  const canvas = document.getElementById('grainCanvas');
  if (!canvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.body.classList.add('has-anim-grain');

  const ctx = canvas.getContext('2d', { alpha: true });
  const TILE = 160;               // small noise tile, scaled up by CSS → cheap
  canvas.width = TILE; canvas.height = TILE;
  const img = ctx.createImageData(TILE, TILE);
  const buf = new Uint32Array(img.data.buffer);

  let last = 0;
  const interval = 1000 / 14;     // ~14fps grain — plenty for a filmic shimmer

  function frame(now){
    requestAnimationFrame(frame);
    if (now - last < interval) return;
    last = now;
    for (let i = 0; i < buf.length; i++){
      const v = (Math.random() * 255) | 0;
      buf[i] = (255 << 24) | (v << 16) | (v << 8) | v; // grey noise, full alpha
    }
    ctx.putImageData(img, 0, 0);
  }
  requestAnimationFrame(frame);
})();

/* ---- CUSTOM CURSOR (desktop / fine pointer only) ---- */
(function(){
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  if (!dot || !ring) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  document.body.classList.add('has-cursor');
  let mx = -100, my = -100, rx = -100, ry = -100;

  addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
  });

  function loop(){
    rx += (mx - rx) * 0.22;
    ry += (my - ry) * 0.22;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  const hoverables = 'a, button, input, .chip, .tile, .service, .related-card, .price-card';
  document.addEventListener('mouseover', e => {
    const el = e.target.closest(hoverables);
    if (el) {
      ring.classList.add('hover');
      const label = el.getAttribute('data-cursor');
      if (label) { ring.setAttribute('data-label', label); ring.classList.add('hover-text'); }
    }
  });
  document.addEventListener('mouseout', e => {
    const el = e.target.closest(hoverables);
    if (el) { ring.classList.remove('hover','hover-text'); }
  });
})();

/* ---- WORD-LEVEL BLUR REVEAL ----
   Headings are split into per-word spans that resolve from nothing → blurred →
   sharp, lightly staggered. Splitting walks text nodes only, so inline markup
   (e.g. <em>) and its styling survive intact. */
(function(){
  const SELECTORS = [
    'h2.section-title', '.htrack-title',
    '.wheel-head h2', '.contact h2', 'header.page-hero h1',
    '.socials-title'
  ].join(',');

  function splitInto(node, out){
    Array.from(node.childNodes).forEach(child => {
      if (child.nodeType === 3){                       // text → wrap each word
        const parts = child.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)){ frag.appendChild(document.createTextNode(part)); return; }
          const s = document.createElement('span');
          s.className = 'w';
          s.textContent = part;
          frag.appendChild(s);
          out.push(s);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && !child.classList.contains('w')){
        splitInto(child, out);                          // keep <em>, <br> etc.
      }
    });
  }

  const targets = Array.from(document.querySelectorAll(SELECTORS));
  targets.forEach(el => {
    if (el.dataset.split) return;
    const words = [];
    splitInto(el, words);
    if (!words.length) return;
    /* Step widened from 0.045s to 0.09s to match couroazul.com's own word
       stagger (their .delay-0/1/2/3 classes step in 0.2s, but that's tuned
       for their typically 3-4 word headlines — 0.09s reads with the same
       "arriving one at a time" feel without very long Aera headlines, like
       the motto's three short sentences, dragging the reveal out past two
       seconds). Capped at 14 words' worth so an unusually long line doesn't
       keep pushing delay out indefinitely. Step is deliberately large next
       to the word's own (shortened, see .split .w) transition duration —
       if the gap between words is small relative to how long each one
       takes to resolve, every word is still mid-fade at once and it just
       reads as one soft block lighting up, not a wipe. Widening the gap is
       what makes the eye actually track a word arriving, then the next. */
    words.forEach((w, i) => { w.style.transitionDelay = (Math.min(i, 14) * 0.06).toFixed(3) + 's'; });
    el.classList.add('split');
    el.dataset.split = '1';
  });

  // toggle (not unobserve) so it reverses on exit and replays on re-entry
  const io = new IntersectionObserver(es => es.forEach(e => {
    e.target.classList.toggle('in', e.isIntersecting);
  }), { threshold: .2 });

  // story cards are driven by their marker landing, so skip those here
  targets.forEach(el => {
    if (!el.closest('.hero')) io.observe(el);
  });

  // the hero holds until the preloader lifts, then joins the same cycle
  const hero = document.querySelector('.hero-statement');
  if (hero){
    let started = false;
    const play = () => {
      if (started) return; started = true;
      requestAnimationFrame(() => { hero.classList.add('in'); io.observe(hero); });
    };
    addEventListener('aera:preloaderdone', play);
    setTimeout(play, 2500);
  }
})();

/* ---- MAGNETIC HOVER ---- */
(function(){
  /* magnetic nudge — elements lean toward the cursor, spring back on leave.
     The measured rect includes the transform we already applied, so the offset
     is taken from the element's ORIGINAL centre (current centre minus the live
     translate). Measuring the moved element instead creates a feedback loop
     that makes the button jitter/drift while you hover. Movement is also
     clamped, and the transition is only used for the spring-back so it can't
     fight the per-move updates. */
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches){
    const STRENGTH = 0.26, MAX = 15, EASE = 0.16;
    const clamp = v => Math.max(-MAX, Math.min(MAX, v));
    const items = Array.from(document.querySelectorAll('.magnetic')).map(el => ({
      el, tx: 0, ty: 0, cx: 0, cy: 0   // t = target, c = current (applied)
    }));
    let raf = null;

    // one shared rAF easing the current offset toward the target, so the
    // element GLIDES after the cursor instead of snapping to it
    function tick(){
      let moving = false;
      items.forEach(it => {
        it.cx += (it.tx - it.cx) * EASE;
        it.cy += (it.ty - it.cy) * EASE;
        if (Math.abs(it.tx - it.cx) > 0.08 || Math.abs(it.ty - it.cy) > 0.08) moving = true;
        else { it.cx = it.tx; it.cy = it.ty; }
        it.el.style.transform = (it.cx || it.cy)
          ? `translate(${it.cx.toFixed(2)}px, ${it.cy.toFixed(2)}px)` : '';
      });
      raf = moving ? requestAnimationFrame(tick) : null;
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

    items.forEach(it => {
      it.el.addEventListener('pointermove', e => {
        const r = it.el.getBoundingClientRect();
        const baseCx = r.left + r.width / 2 - it.cx;  // back out the applied offset
        const baseCy = r.top + r.height / 2 - it.cy;
        it.tx = clamp((e.clientX - baseCx) * STRENGTH);
        it.ty = clamp((e.clientY - baseCy) * STRENGTH);
        kick();
      });
      it.el.addEventListener('pointerleave', () => { it.tx = 0; it.ty = 0; kick(); });
    });
  }
})();

/* ---- NAV, MENU, REVEAL, FAQ, YEAR ---- */
(function(){
  const nav = document.getElementById('nav');
  if (nav) addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 40));

  const burger = document.getElementById('burger'), links = document.getElementById('navLinks');
  if (burger && links) {
    const setMenu = open => {
      links.classList.toggle('open', open);
      burger.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    burger.addEventListener('click', e => {
      e.stopPropagation();
      setMenu(!links.classList.contains('open'));
    });
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
    addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
    // click anywhere off the panel closes it
    document.addEventListener('click', e => {
      if (links.classList.contains('open') && !links.contains(e.target)) setMenu(false);
    });

    // open on hover (mouse only) — a short close delay lets you travel from the
    // icon down onto the panel without it snapping shut on the way
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches){
      let t;
      const openNow  = () => { clearTimeout(t); setMenu(true); };
      const closeSoon = () => { clearTimeout(t); t = setTimeout(() => setMenu(false), 180); };
      [burger, links].forEach(el => {
        el.addEventListener('pointerenter', openNow);
        el.addEventListener('pointerleave', closeSoon);
      });
    }
  }

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // toggle so blocks fade back out on exit and replay on re-entry
  const io = new IntersectionObserver(es => es.forEach(e => {
    e.target.classList.toggle('in', e.isIntersecting);
  }), { threshold: .15 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* The awards row and the socials fan both stage their own entrance (each
     child delayed by a CSS custom property so the group assembles as one
     move rather than everything fading in at once), so the SECTION is what
     needs the .in class, not the individual items. Same observer, two extra
     targets. */
  const awards = document.querySelector('.awards');
  if (awards) io.observe(awards);
  const socials = document.querySelector('.socials');
  if (socials) io.observe(socials);
})();

/* ---- SCROLL-LINKED BLUR-FOCUS (Valeran-inspired headline motion) ----
   Headline-scale text (.blur-focus) sharpens as it nears the vertical
   centre of the viewport and softens as it drifts away — a continuous,
   single rAF-driven loop (same anti-jank pattern as the cursor fix: one
   scroll listener flips a flag, one rAF reads it, no fighting timers). */
(function(){
  const els = Array.from(document.querySelectorAll('.blur-focus'));
  if (!els.length) return;
  const maxBlur = 2.4;   // gentle — text stays legible at all times
  const deadzone = 0.34; // fraction of viewport around centre kept fully sharp
  const range = 0.42;    // falloff distance beyond the deadzone
  let ticking = false;

  function update(){
    ticking = false;
    const vh = innerHeight;
    const center = vh * 0.5;
    const dead = vh * deadzone;
    const span = vh * range;
    els.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -300 || r.top > vh + 300) return;
      const elCenter = r.top + r.height / 2;
      const dist = Math.max(0, Math.abs(elCenter - center) - dead);
      const t = Math.min(1, dist / span);
      el.style.filter = t > 0.02 ? `blur(${(t * maxBlur).toFixed(2)}px)` : 'none';
      el.style.opacity = (1 - t * 0.28).toFixed(2);
    });
  }
  function onScroll(){ if (!ticking){ ticking = true; requestAnimationFrame(update); } }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  addEventListener('aera:preloaderdone', () => setTimeout(update, 50));
  update();
})();

/* ---- HERO PARALLAX EXIT (home) ----
   The mega headline drifts up faster than the page and fades as you leave,
   so exiting the hero feels like pulling away from it rather than the page
   scrolling past a flat banner. The two lines drift at slightly different
   rates, which separates them as they go and reads as depth rather than one
   flat block sliding. Same single-rAF pattern as the blur-focus effect
   above, and it stops doing work once the hero is off screen. */
(function(){
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const hero = document.querySelector('header.hero');
  const inner = document.querySelector('header.hero .hero-inner');
  const ring = document.querySelector('.hero-scrollring');
  if (!hero || !inner) return;
  let ticking = false;

  function update(){
    ticking = false;
    const h = hero.offsetHeight;
    const y = Math.max(0, -hero.getBoundingClientRect().top);
    if (y > h) return;                      // hero fully passed — nothing to do
    const t = Math.min(1, y / h);
    /* Only the inner column is moved. The per-line offsets that used to live
       here wrote inline transforms onto the very elements the entrance
       animation drives, which is what stranded it mid-flight. */
    inner.style.transform = `translateY(${(y * 0.3).toFixed(1)}px)`;
    inner.style.opacity = (1 - t * 0.95).toFixed(2);
    if (ring) ring.style.opacity = (1 - t * 2.4).toFixed(2);
  }
  function onScroll(){ if (!ticking){ ticking = true; requestAnimationFrame(update); } }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  update();
})();

/* ---- SERVICE WHEEL (home) — scroll-driven arc of service names ----
   Names sit in a vertical column that bulges rightward as each passes the
   viewport's centre; the centred name is "active" and swaps in its photo.
   Same single-rAF pattern as the other scroll effects. */
(function(){
  const section = document.getElementById('services');
  if (!section || !section.classList.contains('wheel')) return;
  const track = section.querySelector('.wheel-track');
  const items = Array.from(section.querySelectorAll('.wheel-item'));
  const media = Array.from(section.querySelectorAll('.wheel-media img'));
  const numEl = document.getElementById('wheelNum');
  if (!track || !items.length) return;
  const N = items.length;
  let ticking = false, activePrev = -1;

  function update(){
    ticking = false;
    const vh = innerHeight;
    const rect = track.getBoundingClientRect();
    const scrollable = rect.height - vh;
    let p = scrollable > 0 ? (-rect.top) / scrollable : 0;
    p = Math.max(0, Math.min(1, p));

    const gap = vh * 0.15;                 // on-screen spacing between names
    const travel = (N - 1) * gap + vh * 0.44;
    const cursor = p * travel;
    const bulgeMax = Math.min(innerWidth * 0.13, 180);
    const falloff = vh * 0.42;

    // --- NAMES: rise upward, bulge right at centre ---
    let activeIdx = 0, activeDist = 1e9;
    items.forEach((it, i) => {
      const baseY = i * gap + vh * 0.30;   // first name starts just below centre
      const y = baseY - cursor;            // 0 == viewport centre
      const dyN = y / falloff;
      const bulge = Math.max(0, 1 - dyN * dyN);
      const x = bulge * bulgeMax;
      it.style.transform = `translate(${x.toFixed(1)}px, calc(-50% + ${y.toFixed(1)}px))`;
      it.style.opacity = Math.max(0.08, 1 - Math.abs(dyN) * 0.72).toFixed(2);
      const d = Math.abs(y);
      if (d < activeDist){ activeDist = d; activeIdx = i; }
    });

    // --- PHOTO: one fixed frame, crossfading to whichever name is active ---
    // NOTHING moves inside the frame. Any transform on the image — even a slow
    // Ken Burns drift — means the picture slides around behind a static,
    // clipping edge, which reads exactly as "the photo moves but the frame
    // doesn't, so it gets cut off". The image fills its frame and stays put;
    // the only animation is the crossfade between services.
    if (media.length){
      media.forEach((m, i) => {
        m.style.opacity = i === activeIdx ? '1' : '0';
        m.style.transform = '';
      });
    }

    /* The ring used to be told only the INTEGER index, so it sat still and then
       lurched a whole panel each time the active name changed — next to the
       names, which glide continuously, it read as broken rather than snappy.
       It now also gets the fractional position (cursor measured in name-steps)
       on every frame, so it turns in lockstep with the column beside it. The
       discrete event still fires for anything that only cares about "which one
       is active". */
    document.dispatchEvent(new CustomEvent('aera:wheelpos', {
      detail: { pos: (cursor - vh * 0.30) / gap }
    }));

    if (activeIdx !== activePrev){
      items.forEach((it, i) => it.classList.toggle('active', i === activeIdx));
      if (numEl) numEl.textContent = String(activeIdx + 1).padStart(2, '0');
      activePrev = activeIdx;
      document.dispatchEvent(new CustomEvent('aera:wheelactive', { detail: { index: activeIdx } }));
    }
  }
  function onScroll(){ if (!ticking){ ticking = true; requestAnimationFrame(update); } }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  addEventListener('load', update);
  update();
})();

/* ---- TIMELINE (about) — horizontal pinned collage ----
   Vertical scroll through the tall section is remapped to horizontal travel
   across an irregular collage (the landonorris.com pattern). Items are
   absolutely positioned so each can set its own width/height/vertical offset,
   which means their horizontal placement has to be computed: layout() walks
   them in order and assigns a running --x, so adding, removing or resizing an
   item needs no constant updated by hand.

   Each item also drifts a little inside its own frame as it crosses the
   viewport, and fades up the first time it comes into range — so the row has
   depth and arrival rather than sliding as one rigid strip.

   Bails out under 880px, where the CSS drops the pin and stacks the items. */
(function(){
  const pin = document.getElementById('htrackPin');
  const row = document.getElementById('htrackRow');
  const bar = document.getElementById('htrackBar');
  const numEl = document.getElementById('htrackNum');
  if (!pin || !row) return;

  const section = pin.closest('.htrack');
  const items = Array.from(row.querySelectorAll('.hitem'));
  const GAP = 30;
  let stacked = false, travel = 0, rowW = 0, ticking = false, shownPrev = -1;

  // Mobile only: the pin/translateX rig is bypassed entirely below 880px
  // (see layout()'s stacked branch), so items would otherwise just sit
  // permanently visible with no arrival at all. This small observer gives
  // each one its own scroll-triggered fade+lift instead, independent of
  // the desktop rig below so there's no risk of the two fighting.
  let mobileObs = null;
  function armMobileReveal(){
    if (mobileObs || !('IntersectionObserver' in window)){
      if (!('IntersectionObserver' in window)) items.forEach(el => el.classList.add('in'));
      return;
    }
    mobileObs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
    }, { threshold: .2, rootMargin: '0px 0px -8% 0px' });
    items.forEach(el => mobileObs.observe(el));
  }

  function layout(){
    stacked = window.matchMedia('(max-width:880px)').matches;
    if (stacked){
      row.style.transform = '';
      items.forEach(el => el.style.removeProperty('--x'));
      section.style.height = '';
      armMobileReveal();
      return;
    }
    if (mobileObs){ mobileObs.disconnect(); mobileObs = null; }
    // walk the items, assigning each its running horizontal offset
    let x = 0;
    items.forEach(el => {
      el.style.setProperty('--x', x.toFixed(1) + 'px');
      x += el.offsetWidth + GAP;
    });
    rowW = x;
    const pad = parseFloat(getComputedStyle(row).paddingLeft) || 0;
    travel = Math.max(0, rowW + pad * 2 - window.innerWidth);
    section.style.height = (window.innerHeight + travel * 1.15) + 'px';
  }

  function update(){
    ticking = false;
    if (stacked) return;
    const r = section.getBoundingClientRect();
    const total = section.offsetHeight - window.innerHeight;
    const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;

    row.style.transform = 'translate3d(' + (-p * travel).toFixed(1) + 'px,0,0)';

    const vw = window.innerWidth, mid = vw / 2;
    items.forEach(el => {
      const cr = el.getBoundingClientRect();
      if (cr.right < -300 || cr.left > vw + 300) return;
      // reveal a touch before it's fully on-screen, so the settle-in has
      // room to actually play out rather than resolving in the last few
      // pixels of travel where it's barely perceptible
      if (cr.left < vw + 60) el.classList.add('in');
      const img = el.firstElementChild && el.querySelector('.hshot img');
      if (img){
        const d = ((cr.left + cr.width / 2) - mid) / vw;   // -0.5…0.5
        img.style.transform = 'translate3d(' + (d * -30).toFixed(1) + 'px,0,0)';
      }
    });

    if (bar) bar.style.width = (p * 100).toFixed(1) + '%';
    const shown = Math.min(4, Math.round(p * 4));
    if (numEl && shown !== shownPrev){
      numEl.textContent = String(shown + 1).padStart(2, '0');
      shownPrev = shown;
    }
  }

  function onScroll(){ if (!ticking){ ticking = true; requestAnimationFrame(update); } }
  layout(); update();
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { layout(); update(); });
  addEventListener('load', () => { layout(); update(); });
})();

/* ---- SOCIALS FAN — hover shuffle ----
   Every card's position comes from ONE formula: its own index (i) plus how far
   it sits from the hovered card (d). Neighbours slide outward by an amount
   that tapers with distance, the hovered card straightens and lifts, and
   z-index is assigned from the same distance so the overlap order is always
   consistent while the pointer moves.

   This used to be pure CSS with `+` and `:has()` sibling rules — four separate
   rules each setting a different transform. Moving between cards swapped which
   rule matched, so a card jumped straight from one transform to another
   instead of easing, and z-index (which can't transition) flipped mid-move so
   cards briefly overlapped the wrong way. One formula fixes both.

   Order is never changed: each card keeps its --i for life, so the fan always
   re-closes to exactly the arrangement it started in. */
(function(){
  const fan = document.querySelector('.fan');
  if (!fan) return;
  const cards = Array.from(fan.querySelectorAll('.fan-card'));
  if (!cards.length) return;

  /* ENTRANCE — opens once, the first time the stack scrolls into view, each
     card a beat behind the last working OUTWARD FROM THE CENTRE (--a is the
     distance from centre, so ordering by --a is what makes it read as one
     stack unfolding rather than a row arriving left-to-right). This is
     completely separate from the hover shuffle below: it only ever adds
     `.opened` to `.fan` (once, never removed) and only ever touches
     `transitionDelay`, which it clears again the moment the opening
     animation finishes. Nothing here can leak into a later hover. */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion){
    fan.classList.add('opened');
  } else {
    const OPEN_TRANSFORM_MS = 550, STEP_MS = 90;
    let opened = false;
    function openFan(){
      if (opened) return;
      opened = true;
      cards.forEach(card => {
        const a = Math.abs(parseFloat(card.style.getPropertyValue('--i')) || 0);
        card.style.transitionDelay = (a * STEP_MS) + 'ms';
      });
      fan.classList.add('opened');
      const maxDelay = 3 * STEP_MS + OPEN_TRANSFORM_MS + 80;
      setTimeout(() => { cards.forEach(card => { card.style.transitionDelay = ''; }); }, maxDelay);
    }
    const openObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { openFan(); openObserver.disconnect(); } });
    }, { threshold: .15 });
    openObserver.observe(fan);
  }

  /* HOVER SHUFFLE — desktop / fine-pointer only, unchanged from before. */
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(max-width:760px)').matches) return;

  const px = v => v + 'px';
  // matches the CSS clamps so JS and CSS agree at every viewport
  const spread = () => Math.max(58, Math.min(105, innerWidth * 0.066));
  const drop   = () => Math.max(9,  Math.min(20,  innerHeight * 0.015));
  const nudge  = () => Math.max(20, Math.min(40,  innerWidth * 0.026));

  let hovered = null;

  function paint(){
    const S = spread(), D = drop(), N = nudge();
    cards.forEach(card => {
      const i = parseFloat(card.style.getPropertyValue('--i')) || 0;
      const a = Math.abs(i);
      let x = i * S, y = a * D, rot = i * 7, sc = 1 - a * 0.075, z = 10 - a;

      if (hovered !== null){
        const d = i - hovered;                 // signed distance from hovered
        const ad = Math.abs(d);
        if (ad === 0){
          y = -22; rot = 0; sc = 1.07; z = 30;
        } else {
          // push away, tapering off with distance (1 step = full nudge, 2 = half…)
          const taper = 1 / ad;
          x += Math.sign(d) * N * taper;
          rot += Math.sign(d) * 3 * taper;
          z = 20 - ad;                          // still descends away from the lifted card
        }
      }
      card.style.zIndex = String(Math.round(z));
      card.style.transform =
        'translateX(' + px(x.toFixed(1)) + ') translateY(' + px(y.toFixed(1)) + ') ' +
        'rotate(' + rot.toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')';
      card.classList.toggle('is-lifted', hovered !== null && i === hovered);
    });
  }

  cards.forEach(card => {
    card.addEventListener('pointerenter', () => {
      hovered = parseFloat(card.style.getPropertyValue('--i')) || 0;
      paint();
    });
  });
  fan.addEventListener('pointerleave', () => { hovered = null; paint(); });
  /* No unconditional paint() on load, and resize only repaints while a card
     is actively hovered. Setting an inline transform at any other time would
     permanently override the CSS resting-position formula (inline always
     wins over a class rule) — including the closed/gathered entrance state
     above, which would make the stack skip straight to "already open" and
     just fade in instead of unfolding. Leaving the resting state to CSS
     alone means it's already correct at every viewport width via the same
     clamp() values, no JS required until the pointer actually arrives. */
  addEventListener('resize', () => { if (hovered !== null) paint(); });
})();

/* ---- METHOD — pinned sequence ----
   Phase A: the photo sits large while the copy column travels up the right.
   Phase B: the photo shrinks and rounds into a small ellipse near the top,
   uncovering the closing quote and signature underneath. */
(function(){
  const track   = document.getElementById('methodTrack');
  const media   = document.getElementById('mtMedia');
  const mask    = document.getElementById('mtMask');
  const copy    = document.getElementById('mtCopy');
  const title   = document.getElementById('mtTitle');
  const end     = document.getElementById('mtEnd');
  const eyebrow = document.getElementById('mtEyebrow');
  if (!track || !media) return;

  const SPLIT = 0.52;                       // where the shrink begins
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  let ticking = false, stacked = false;

  // Mobile only: update() bails before it ever reaches the mask/copy/title/
  // end logic below (that's all built around the pin's scroll progress,
  // which doesn't exist once the section is a static stack), so those
  // elements need their own scroll-triggered entrance instead.
  let mobileObs = null;
  function armMobileReveal(){
    if (mobileObs) return;
    const targets = [eyebrow, title, media, copy, end].filter(Boolean);
    if (!('IntersectionObserver' in window)){
      targets.forEach(el => el.classList.add('m-in'));
      return;
    }
    mobileObs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('m-in'); });
    }, { threshold: .2, rootMargin: '0px 0px -8% 0px' });
    targets.forEach(el => mobileObs.observe(el));
  }

  function update(){
    ticking = false;
    stacked = window.matchMedia('(max-width:880px)').matches;
    if (stacked){
      media.style.transform = '';
      media.style.borderRadius = '';
      armMobileReveal();
      return;
    }
    if (mobileObs){ mobileObs.disconnect(); mobileObs = null; }

    const vh = innerHeight;
    const r = track.getBoundingClientRect();
    const scrollable = r.height - vh;
    const p = clamp01(scrollable > 0 ? (-r.top) / scrollable : 0);

    // the photo sits left (31%) while the copy is readable on the right, then
    // slides to centre as it shrinks so it lands above the closing quote
    const LEFT_PCT = 0.31;
    let scale, ty, tx, radius;
    if (p < SPLIT){                          // A — hold large, drift in gently
      const t = p / SPLIT;
      scale  = lerp(0.98, 1.04, t);
      ty     = lerp(10, 0, t);
      tx     = 0;
      radius = 0;
    } else {                                 // B — shrink up into an ellipse
      const t = clamp01((p - SPLIT) / (1 - SPLIT));
      const e = t * t * (3 - 2 * t);         // smoothstep
      scale  = lerp(1.04, 0.30, e);
      ty     = lerp(0, -vh * 0.26, e);
      tx     = lerp(0, (0.5 - LEFT_PCT) * innerWidth, e);
      radius = lerp(0, 50, e);
    }
    media.style.transform =
      `translate(-50%,-50%) translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${scale.toFixed(3)})`;
    media.style.borderRadius = radius.toFixed(1) + '%';

    // the cover recedes early in Phase A — by the time the reader has
    // settled into the copy column, the photo is fully resolved
    if (mask){
      const reveal = 1 - clamp01((p / SPLIT) / 0.42);
      mask.style.opacity = reveal.toFixed(2);
    }

    // copy travels up and clears out before the shrink completes
    if (copy){
      const cy = lerp(70, -90, p);
      const cin  = clamp01(p / 0.12);
      const cout = 1 - clamp01((p - (SPLIT - 0.04)) / 0.12);
      copy.style.transform = `translateY(calc(-50% + ${cy.toFixed(1)}px))`;
      copy.style.opacity = (Math.min(cin, cout)).toFixed(2);
    }
    if (title){
      const o = 1 - clamp01((p - 0.40) / 0.16);
      title.style.opacity = o.toFixed(2);
      title.style.filter = o < 1 ? `blur(${((1 - o) * 6).toFixed(1)}px)` : 'none';
    }
    // the closing quote rises in once the photo is well clear
    if (end){
      const t = clamp01((p - 0.66) / 0.2);
      end.style.opacity = t.toFixed(2);
      end.style.transform = `translateX(-50%) translateY(${lerp(26, 0, t).toFixed(1)}px)`;
    }
  }
  function onScroll(){ if (!ticking){ ticking = true; requestAnimationFrame(update); } }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  addEventListener('load', update);
  update();
})();

/* ---- TEAM PAGE — names full width, each with its own portrait; clicking
   swaps the list out for that person's page, their photo promoted to the top.
   Two sequenced phases rather than a crossfade: the list clears to bare
   background first, THEN the detail arrives. Overlapping them just reads as
   mush — the pause is what makes the swap legible. */
(function(){
  const views  = document.getElementById('ttViews');
  const list   = document.getElementById('ttList');
  const detail = document.getElementById('ttDetail');
  const dataEl = document.getElementById('ttData');
  if (!views || !list || !dataEl) return;

  let data = [];
  try { data = JSON.parse(dataEl.textContent); } catch(e){ return; }
  const rows = Array.from(list.querySelectorAll('.tt-row'));
  const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const OUT = 460, IN = 90;
  let busy = false, current = -1;

  function heroFor(m){
    // `ph` lets a real, named person show "Photo to come" rather than the
    // "Seat open" wording used for vacancies — they are not the same thing.
    return m.photo ? '<img src="' + esc(m.photo) + '" alt="">'
                   : '<span class="tt-ph">' + esc(m.ph || 'Seat open') + '</span>';
  }
  const heroClass = m => 'td-hero' + (m.cut ? ' cut' : '');

  function build(m){
    detail.innerHTML =
      '<button class="td-back" type="button" id="tdBack">' +
        '<svg viewBox="0 0 24 24" fill="none"><path d="M20 12H5M11 6l-6 6 6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        'All of us</button>' +
      // name and copy left, portrait right — side by side rather than a banner
      '<div class="td-top">' +
        '<div class="td-info">' +
          // guard the separator — an empty loc otherwise leaves a dangling "·"
          '<div class="td-role">' + m.role + (m.loc ? ' · ' + esc(m.loc) : '') + '</div>' +
          '<h2 class="td-name">' + m.name + '</h2>' +
          '<p class="td-bio">' + esc(m.bio || '') + '</p>' +
          '<div class="td-skills">' + (m.skills || []).map(x => '<span>' + esc(x) + '</span>').join('') + '</div>' +
          // external portfolio, for anyone whose work lives on their own site
          (m.link ? '<a class="td-link" href="' + esc(m.link) + '" target="_blank" rel="noopener">' +
                      esc(m.linkLabel || 'View full portfolio') +
                      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                    '</a>' : '') +
          // credits list, for work that lives on someone else's site
          ((m.projects || []).length
            ? '<div class="td-credits"><span class="td-credits-label">Selected credits</span><ul>' +
                m.projects.map(p =>
                  '<li><a href="' + esc(p.url) + '" target="_blank" rel="noopener">' +
                    '<span class="tc-name">' + esc(p.name) + '</span>' +
                    '<span class="tc-meta">' + esc(p.meta || '') + '</span>' +
                  '</a></li>').join('') +
              '</ul></div>'
            : '') +
        '</div>' +
        '<figure class="' + heroClass(m) + '">' + heroFor(m) + '</figure>' +
      '</div>' +
      '<div class="td-folio">' + (m.folio || []).map((u, n) => '<img style="--i:' + n + '" src="' + esc(u) + '" loading="lazy" alt="">').join('') + '</div>';
    detail.querySelector('#tdBack').addEventListener('click', back);
  }

  // Height is animated between two measured pixel values. Letting it jump to
  // auto mid-transition is what makes this kind of swap stutter.
  function openDetail(i){
    if (busy) return;
    busy = true; current = i;
    views.classList.add('animating');
    views.style.height = views.scrollHeight + 'px';
    list.classList.add('out');                       // phase 1: clear to background
    setTimeout(() => {
      list.style.display = 'none';
      build(data[i]);
      detail.style.display = 'block';
      const target = detail.scrollHeight;
      void views.offsetHeight;
      views.style.height = target + 'px';
      setTimeout(() => {                             // phase 2: bring the page in
        detail.classList.add('in');
        setTimeout(() => { views.style.height = 'auto'; views.classList.remove('animating'); busy = false; }, 950);
      }, IN);
    }, OUT);
  }

  function back(){
    if (busy) return;
    busy = true;
    views.classList.add('animating');
    views.style.height = views.scrollHeight + 'px';
    detail.classList.remove('in');
    setTimeout(() => {
      detail.style.display = 'none';
      detail.innerHTML = '';
      list.style.display = '';
      const target = list.scrollHeight;
      void views.offsetHeight;
      views.style.height = target + 'px';
      setTimeout(() => {
        list.classList.remove('out');
        setTimeout(() => { views.style.height = 'auto'; views.classList.remove('animating'); busy = false; current = -1; }, 700);
      }, IN);
    }, OUT);
  }

  rows.forEach((row, i) => row.addEventListener('click', () => openDetail(i)));
  addEventListener('keydown', e => { if (e.key === 'Escape' && current >= 0) back(); });
  addEventListener('resize', () => { if (!busy) views.style.height = 'auto'; });
})();

/* ---- FAQ ACCORDIONS + FOOTER YEAR ---- */
(function(){
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    if (!q) return;
    q.addEventListener('click', () => {
      const wasOpen = item.classList.contains('open');
      item.closest('.faq').querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });
})();

/* ---- CHAT-STYLE "FIND YOUR FIT" (home page only) ----
   A small rule-based matcher standing in for a real assistant — swaps for
   one later without changing the UI. Images are Jack's existing portfolio
   (c4rem.co.uk) standing in until Aera has its own client galleries. */
(function(){
  const chatLog = document.getElementById('chatLog');
  const chatForm = document.getElementById('chatForm');
  const finderInput = document.getElementById('finderInput');
  if (!chatLog || !finderInput) return; // not on this page

  const FINDER_DATA = {
    event: {
      label: 'Event Coverage',
      blurb: 'Fast-moving, high-energy coverage — stills and a short recap edit from the same day.',
      note: 'Actual event coverage work — motorsport & national-day events.',
      price: '£250 – £600', team: 'Founder & lead shooter, Leeds', link: 'events.html',
      images: [
        'https://images.squarespace-cdn.com/content/v1/67a046e3af281e412f15579a/13f98449-a6da-4ea8-b125-01a7d5fc40b4/IMG_1199.jpg',
        'https://images.squarespace-cdn.com/content/v1/67a046e3af281e412f15579a/d68650ca-1652-44b5-823e-c43abab0b7e2/Lando+Photo.png',
        'https://images.squarespace-cdn.com/content/v1/67a046e3af281e412f15579a/50a7d34c-7a13-43f5-a5da-bc73d671fc8e/UAE+Flag.jpg'
      ],
      kw: ['event','launch','party','festival','conference','ball','carnival','corporate','concert']
    },
    brand: {
      label: 'Brand & Social Content',
      blurb: 'A rolling set of stills, reels and design — enough to keep the feed looking considered every week.',
      note: 'Actual design & content work — social posts, matchday graphics, campaign design.',
      price: '£300 – £500 / month', team: 'Founder & lead creator, Leeds', link: 'social-media.html',
      images: [
        'https://images.squarespace-cdn.com/content/v1/67a046e3af281e412f15579a/f5c5d3ac-57b1-4757-ab6c-6ac16ca6e090/Hauntfest++Poster.png',
        'https://images.squarespace-cdn.com/content/v1/67a046e3af281e412f15579a/ebc2d86a-43dc-45da-8c9a-9c069df080d2/Insta-Post-Dubai-23-24-_01.jpg',
        'https://images.squarespace-cdn.com/content/v1/67a046e3af281e412f15579a/956771b0-d277-4ee9-bde0-2c1b6d0a8d8c/Green+Planet+Photos-12.jpg'
      ],
      kw: ['brand','social','instagram','content','cafe','café','shop','boutique','gym','salon','business','marketing','reels','posts']
    },
    portrait: {
      label: 'Portrait & Personal',
      blurb: 'A relaxed, considered session — headshots, portraits or a personal shoot done properly.',
      note: 'Actual photography work from Jack’s portfolio.',
      price: '£120 – £250', team: 'Founder & lead shooter, Leeds', link: 'brand-commercial.html',
      images: [
        'https://images.squarespace-cdn.com/content/v1/67a046e3af281e412f15579a/717cb03f-faa2-4ff3-bb24-2a59f2af0aad/IMG_6821.jpg',
        'https://images.squarespace-cdn.com/content/v1/67a046e3af281e412f15579a/db5c3ac4-da30-40e7-84a7-28a43271390b/IMG_0831.jpg',
        'https://images.squarespace-cdn.com/content/v1/67a046e3af281e412f15579a/b5d862b4-ff71-42f0-9e9e-ce0c231c5a80/1J6A0134.jpg'
      ],
      kw: ['portrait','headshot','personal','profile','graduation','family','solo']
    }
  };

  // Keeps the panel to a single, clean exchange at a time — a fresh
  // question replaces the last answer instead of piling up into a long,
  // scrolling thread.
  function resetChat(){ chatLog.innerHTML = ''; }

  function addUserMessage(text){
    const el = document.createElement('div');
    el.className = 'msg msg-user';
    el.innerHTML = `<div class="msg-bubble">${escapeHtml(text)}</div>`;
    chatLog.appendChild(el);
  }

  function addAeraTyping(){
    const el = document.createElement('div');
    el.className = 'msg msg-aera';
    el.innerHTML = `<div class="msg-bubble typing"><span></span><span></span><span></span></div>`;
    chatLog.appendChild(el);
    return el;
  }

  function addAeraMessage(html){
    const el = document.createElement('div');
    el.className = 'msg msg-aera';
    el.innerHTML = `<div class="msg-bubble">${html}</div>`;
    chatLog.appendChild(el);
    return el;
  }

  function escapeHtml(s){
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function matchResultHtml(d, rawInput){
    const subject = encodeURIComponent(`Aera enquiry — ${d.label}`);
    const body = encodeURIComponent(`Hi Jack,\n\nI used "Tell Aera what you need" and described my project as:\n"${rawInput || d.label}"\n\nMatched category: ${d.label}\nEstimated range shown: ${d.price}\n\nHere's a bit more detail on what I need:\n`);
    return `
      <span class="fr-eyebrow">Matched to</span>
      <h4>${d.label}</h4>
      <p>${d.blurb}</p>
      <div class="chat-grid">${d.images.map(src => `<img src="${src}" loading="lazy" alt="Aera portfolio example — ${d.label}">`).join('')}</div>
      <div class="chat-meta">
        <div><div class="lbl">Estimated price</div><div class="val">${d.price}</div></div>
        <div><div class="lbl">Who you'd work with</div><div class="val">Jack Careem</div></div>
      </div>
      <div class="chat-actions">
        <a class="primary" href="mailto:jackcareem@icloud.com?subject=${subject}&body=${body}">Continue to enquire</a>
        <a class="secondary" href="${d.link}">See the full service</a>
      </div>`;
  }

  function matchFinder(text){
    const t = text.toLowerCase();
    let best = null, bestScore = 0;
    for (const [cat, d] of Object.entries(FINDER_DATA)){
      const score = d.kw.reduce((s,k) => s + (t.includes(k) ? 1 : 0), 0);
      if (score > bestScore){ bestScore = score; best = cat; }
    }
    return best || 'brand';
  }

  function respond(cat, rawInput){
    const d = FINDER_DATA[cat];
    const typingEl = addAeraTyping();
    setTimeout(() => {
      typingEl.remove();
      addAeraMessage(matchResultHtml(d, rawInput));
    }, 700 + Math.random() * 400);
  }

  function introduce(){
    const typingEl = addAeraTyping();
    setTimeout(() => {
      typingEl.remove();
      addAeraMessage('Hi — I’m here on behalf of Aera. Tell me a little about your project — an event, a brand shoot, your socials — and I’ll match you to the right service, real work, and a price range.');
    }, 900);
  }

  // No auto-greeting — the hero stays clean and sparse until the visitor
  // actually asks something. (introduce() kept for optional future use.)
  void introduce;

  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = finderInput.value.trim();
      if (!val) { finderInput.focus(); return; }
      resetChat();
      addUserMessage(val);
      finderInput.value = '';
      respond(matchFinder(val), val);
    });
  }

  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const label = chip.textContent.trim();
      resetChat();
      addUserMessage(label);
      respond(chip.dataset.cat, '');
    });
  });
})();

/* ---- CLIENTS MARQUEE — JS-driven scroll (home) ----
   This used to be a CSS @keyframes animation paused via
   `.marquee:hover .marquee-track{animation-play-state:paused}`. In practice,
   pausing a running keyframe animation on hover made the strip visibly hop
   backwards a few pixels the instant the pointer entered — a real browser
   quirk with resuming/pausing compositor-driven animations, not something
   fixable by tuning the CSS further.

   Replaced with a single rAF loop that just advances a translateX value each
   frame and stops advancing (rather than "pausing an animation") on hover —
   there's no animation state to snap back to, so there's nothing to glitch.
   The track holds 4 identical passes of the logo list; moving left by half
   its total width loops seamlessly, same as the old -50% keyframe. */
(function(){
  const wrap = document.querySelector('.marquee');
  const track = wrap && wrap.querySelector('.marquee-track');
  if (!wrap || !track) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const DURATION = 46; // seconds to cross half the track — matches the old keyframe pace
  let half = 0, speed = 0, x = 0, paused = false, last = null;

  function measure(){
    half = track.scrollWidth / 2;
    speed = half / DURATION;
  }
  measure();
  addEventListener('resize', measure);

  wrap.addEventListener('pointerenter', () => { paused = true; });
  wrap.addEventListener('pointerleave', () => { paused = false; });
  wrap.addEventListener('focusin', () => { paused = true; });
  wrap.addEventListener('focusout', () => { paused = false; });

  function tick(t){
    if (last === null) last = t;
    const dt = (t - last) / 1000;
    last = t;
    if (!paused && half > 0){
      x -= speed * dt;
      if (x <= -half) x += half;
    }
    track.style.transform = 'translateX(' + x.toFixed(2) + 'px)';
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* ==========================================================================
   SERVICE-PAGE SIGNATURE DEVICES
   Each of these is scoped to one page by its selector — if the element isn't
   on the page the block costs one querySelector and exits. All of them are
   progressive enhancement: with JS off the CSS leaves readable, laid-out
   content (see the .no-js rules and the static fallbacks in style.css).
   ========================================================================== */

/* ---- SCROLL-MASK PARAGRAPH (.smask) ----
   Words light from --stone to --cream as the block crosses the viewport, so
   the copy resolves at reading pace instead of all at once. Deliberately its
   OWN splitter rather than an entry in the sitewide SELECTORS list: that list
   drives the one-shot .split/.in blur reveal, and this needs per-word state
   tied to a continuously-updating scroll position, which is a different
   animation model on the same markup. */
(function(){
  const blocks = Array.from(document.querySelectorAll('.smask'));
  if (!blocks.length) return;

  function splitInto(node, out){
    Array.from(node.childNodes).forEach(child => {
      if (child.nodeType === 3){
        const parts = child.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)){ frag.appendChild(document.createTextNode(part)); return; }
          const s = document.createElement('span');
          s.className = 'w';
          s.textContent = part;
          frag.appendChild(s);
          out.push(s);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && !child.classList.contains('w')){
        splitInto(child, out);
      }
    });
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const items = blocks.map(el => {
    const words = [];
    splitInto(el, words);
    return { el, words };
  }).filter(i => i.words.length);

  if (reduce){
    items.forEach(i => i.words.forEach(w => w.classList.add('lit')));
    return;
  }

  let ticking = false;
  function update(){
    ticking = false;
    const vh = innerHeight;
    items.forEach(({ el, words }) => {
      const r = el.getBoundingClientRect();
      /* progress runs 0→1 as the block travels from "top just entered the
         lower third" to "bottom has reached the upper third", which keeps the
         whole fill inside the comfortable reading band rather than finishing
         while the text is still near the bottom edge */
      const start = vh * 0.82;
      const end   = vh * 0.32;
      const p = (start - r.top) / Math.max(1, (start - end) + r.height * 0.55);
      const lit = Math.round(Math.min(1, Math.max(0, p)) * words.length);
      words.forEach((w, i) => w.classList.toggle('lit', i < lit));
    });
  }
  addEventListener('scroll', () => {
    if (!ticking){ ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  addEventListener('resize', update);
  update();
})();

/* ---- STORY TRAY (.tray) ----
   Click a ring, that step's panel shows. Keyboard works for free because the
   rings are real <button>s. The first ring is opened on load so the section
   never renders as an empty shelf. */
(function(){
  const tray = document.querySelector('.tray');
  if (!tray) return;
  const rings  = Array.from(tray.querySelectorAll('.ring'));
  const panels = Array.from(tray.querySelectorAll('.tray-panel'));
  if (!rings.length || rings.length !== panels.length) return;

  function show(i){
    rings.forEach((r, n) => {
      const on = n === i;
      r.classList.toggle('on', on);
      r.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach((p, n) => p.classList.toggle('on', n === i));
  }
  rings.forEach((r, i) => r.addEventListener('click', () => show(i)));
  show(0);
})();

/* ---- CONTACT SHEET (.csheet) ----
   Vertical scroll through the tall .csheet-track is remapped to horizontal
   travel of the row inside the sticky pin. Same mechanism as the About page's
   .htrack, kept separate so tuning one can't disturb the other. Bails out
   under 880px, where the CSS has already unpinned it into a column. */
(function(){
  const sheet = document.querySelector('.csheet');
  if (!sheet) return;
  const track = sheet.querySelector('.csheet-track');
  const pin   = sheet.querySelector('.csheet-pin');
  const row   = sheet.querySelector('.csheet-row');
  const bar   = sheet.querySelector('.csheet-bar span');
  const count = sheet.querySelector('.csheet-count b');
  const frames= Array.from(sheet.querySelectorAll('.frame'));
  if (!track || !pin || !row) return;

  let maxX = 0;
  function measure(){
    maxX = Math.max(0, row.scrollWidth - innerWidth);
    /* the track only needs to be as tall as the horizontal distance to cover,
       plus one viewport to hold the pin — a fixed 300vh either runs out early
       on a wide screen or leaves dead scroll on a narrow one */
    track.style.height = (innerHeight + maxX) + 'px';
  }

  let ticking = false;
  function update(){
    ticking = false;
    if (innerWidth <= 880){ row.style.transform = ''; return; }
    const r = track.getBoundingClientRect();
    const total = track.offsetHeight - innerHeight;
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
    row.style.transform = 'translateX(' + (-p * maxX).toFixed(2) + 'px)';
    if (bar) bar.style.width = (p * 100).toFixed(1) + '%';
    if (count && frames.length){
      count.textContent = String(Math.min(frames.length, Math.floor(p * frames.length) + 1)).padStart(2, '0');
    }
  }

  addEventListener('scroll', () => {
    if (!ticking){ ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  addEventListener('resize', () => { measure(); update(); });
  measure(); update();
})();

/* ---- RUN OF SHOW (.runsheet) ----
   The champagne rule grows down the spine as you scroll, and each cue lights
   as the rule reaches it — so the fill and the highlighting can never disagree
   with each other, because both read the same number. */
(function(){
  const sheet = document.querySelector('.runsheet');
  if (!sheet) return;
  const fill = sheet.querySelector('.runsheet-fill');
  const cues = Array.from(sheet.querySelectorAll('.cue'));
  if (!cues.length) return;

  if (matchMedia('(prefers-reduced-motion: reduce)').matches){
    cues.forEach(c => c.classList.add('lit'));
    if (fill) fill.style.height = '100%';
    return;
  }

  let ticking = false;
  function update(){
    ticking = false;
    const r = sheet.getBoundingClientRect();
    /* the "playhead" is a fixed line 62% down the viewport; everything above
       it has happened, everything below hasn't yet */
    const head = innerHeight * 0.62;
    const p = Math.min(1, Math.max(0, (head - r.top) / Math.max(1, r.height)));
    if (fill) fill.style.height = (p * 100).toFixed(2) + '%';
    const reached = r.top + r.height * p;
    cues.forEach(c => {
      const cr = c.getBoundingClientRect();
      c.classList.toggle('lit', cr.top <= reached + 4);
    });
  }
  addEventListener('scroll', () => {
    if (!ticking){ ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  addEventListener('resize', update);
  update();
})();

/* ---- ENQUIRE CHIPS (home) ----
   Retarget the mailto's subject to whatever the visitor picks, so the enquiry
   lands pre-categorised. Multi-select, because "socials AND a launch event" is
   a completely normal brief. Purely additive: the link already has a working
   href in the markup, this only ever rewrites the ?subject= on it. */
(function(){
  const pick = document.querySelector('.ask-pick');
  const mail = document.querySelector('.contact .email');
  if (!pick || !mail) return;
  const chips = Array.from(pick.querySelectorAll('.ask-chip'));
  if (!chips.length) return;

  const base = mail.getAttribute('href').split('?')[0];
  function sync(){
    const picked = chips.filter(c => c.classList.contains('on')).map(c => c.dataset.svc);
    const subject = picked.length
      ? 'Aera enquiry — ' + picked.join(' + ')
      : 'Aera enquiry';
    mail.setAttribute('href', base + '?subject=' + encodeURIComponent(subject));
  }
  chips.forEach(c => c.addEventListener('click', () => {
    c.classList.toggle('on');
    c.setAttribute('aria-pressed', c.classList.contains('on') ? 'true' : 'false');
    sync();
  }));
  sync();
})();
