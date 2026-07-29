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
    '.hero-statement', 'h2.section-title', '.story-title',
    '.wheel-head h2', '.contact h2', 'header.page-hero h1', '.si-card h3'
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
    words.forEach((w, i) => { w.style.transitionDelay = (i * 0.045).toFixed(3) + 's'; });
    el.classList.add('split');
    el.dataset.split = '1';
  });

  // toggle (not unobserve) so it reverses on exit and replays on re-entry
  const io = new IntersectionObserver(es => es.forEach(e => {
    e.target.classList.toggle('in', e.isIntersecting);
  }), { threshold: .2 });

  // story cards are driven by their marker landing, so skip those here
  targets.forEach(el => {
    if (!el.closest('.hero') && !el.closest('.story-item')) io.observe(el);
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

    if (activeIdx !== activePrev){
      items.forEach((it, i) => it.classList.toggle('active', i === activeIdx));
      if (numEl) numEl.textContent = String(activeIdx + 1).padStart(2, '0');
      activePrev = activeIdx;
    }
  }
  function onScroll(){ if (!ticking){ ticking = true; requestAnimationFrame(update); } }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  addEventListener('load', update);
  update();
})();

/* ---- STORY TIMELINE (about) — scroll advances a flowing timeline ----
   The wave is generated from a sine so the nodes can be placed exactly on the
   curve. Scrolling the pinned section translates the whole "world" sideways,
   bringing one milestone at a time to the focal point, and draws the champagne
   progress line in behind it. */
(function(){
  const track = document.getElementById('storyTrack');
  const world = document.getElementById('storyWorld');
  const svg   = document.getElementById('storyWave');
  const base  = document.getElementById('waveBase');
  const prog  = document.getElementById('waveProg');
  const numEl = document.getElementById('storyNum');
  if (!track || !world || !svg) return;

  const items = Array.from(world.querySelectorAll('.story-item'));
  const N = items.length;
  if (!N) return;

  const grad = document.getElementById('progGrad');
  const gp0 = document.getElementById('gp0');
  const gp1 = document.getElementById('gp1');
  const gp2 = document.getElementById('gp2');

  const AMP = 54;          // wave amplitude
  const PHASE = 0.6;
  const FADE = 0.09;       // how much of the world the head fades over
  let vw = 0, vh = 0, worldW = 0, step = 0, midY = 0, waveLen = 0;
  let stacked = false;

  const yAt = x => midY + AMP * Math.sin((x / waveLen) * Math.PI * 2 + PHASE);

  function layout(){
    stacked = window.matchMedia('(max-width:880px)').matches;
    if (stacked){                       // stacked list — clear inline layout
      world.style.transform = '';
      world.style.width = '';
      items.forEach(it => { it.style.left = ''; });
      return;
    }
    vw = innerWidth; vh = innerHeight;
    step = vw * 0.78;                   // horizontal distance between milestones
    worldW = step * (N - 1) + vw;
    waveLen = vw * 1.35;                // one wave cycle per ~1.35 screens
    midY = vh * 0.46;

    world.style.width = worldW + 'px';
    svg.setAttribute('viewBox', `0 0 ${worldW} ${vh}`);
    svg.setAttribute('width', worldW);
    svg.setAttribute('height', vh);

    let d = '';
    for (let x = 0; x <= worldW; x += 16){
      d += (x === 0 ? 'M' : ' L') + x.toFixed(1) + ',' + yAt(x).toFixed(2);
    }
    base.setAttribute('d', d);
    prog.setAttribute('d', d);
    if (grad) grad.setAttribute('x2', worldW);   // gradient spans the world

    items.forEach((it, i) => {
      const x = vw * 0.5 + i * step;    // focal point is viewport centre
      it.style.left = x + 'px';
      it.style.setProperty('--ny', yAt(x).toFixed(1) + 'px');
      it.style.setProperty('--cardY', (yAt(x) + 150).toFixed(1) + 'px');
    });
  }

  let ticking = false, activePrev = -1;
  function update(){
    ticking = false;
    if (stacked) return;
    const rect = track.getBoundingClientRect();
    const scrollable = rect.height - vh;
    let p = scrollable > 0 ? (-rect.top) / scrollable : 0;
    p = Math.max(0, Math.min(1, p));

    const shift = p * step * (N - 1);
    world.style.transform = `translate3d(${-shift.toFixed(1)}px,0,0)`;

    // the champagne line runs up to the focal point then fades out into the
    // dark base line (gradient stops, so there's no hard edge)
    const head = Math.max(0, Math.min(1, (vw * 0.5 + shift) / worldW));
    if (gp1 && gp2){
      const mid = Math.max(0.0001, head - FADE);
      gp0.setAttribute('offset', '0');
      gp1.setAttribute('offset', mid.toFixed(4));
      gp2.setAttribute('offset', Math.max(mid + 0.0001, head).toFixed(4));
    }

    // markers fade in as they come into range; content only "arrives" when the
    // milestone is genuinely near the focal point
    let idx = -1;
    items.forEach((it, i) => {
      const dist = Math.abs(i * step - shift);
      const on = dist < step * 0.42;
      it.classList.toggle('is-near', dist < step * 0.95);
      it.classList.toggle('is-active', on);
      if (on) idx = i;
    });
    const shown = idx >= 0 ? idx : Math.round(p * (N - 1));
    if (shown !== activePrev){
      if (numEl) numEl.textContent = String(shown + 1).padStart(2, '0');
      activePrev = shown;
    }
  }
  function onScroll(){ if (!ticking){ ticking = true; requestAnimationFrame(update); } }

  layout(); update();
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { layout(); update(); });
  addEventListener('load', () => { layout(); update(); });
})();

/* ---- METHOD — pinned sequence ----
   Phase A: the photo sits large while the copy column travels up the right.
   Phase B: the photo shrinks and rounds into a small ellipse near the top,
   uncovering the closing quote and signature underneath. */
(function(){
  const track = document.getElementById('methodTrack');
  const media = document.getElementById('mtMedia');
  const copy  = document.getElementById('mtCopy');
  const title = document.getElementById('mtTitle');
  const end   = document.getElementById('mtEnd');
  if (!track || !media) return;

  const SPLIT = 0.52;                       // where the shrink begins
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  let ticking = false, stacked = false;

  function update(){
    ticking = false;
    stacked = window.matchMedia('(max-width:880px)').matches;
    if (stacked){ media.style.transform = ''; media.style.borderRadius = ''; return; }

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
    return m.photo ? '<img src="' + esc(m.photo) + '" alt="">' : '<span class="tt-ph">Seat open</span>';
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
          '<div class="td-role">' + m.role + ' · ' + esc(m.loc || '') + '</div>' +
          '<h2 class="td-name">' + m.name + '</h2>' +
          '<p class="td-bio">' + esc(m.bio || '') + '</p>' +
          '<div class="td-skills">' + (m.skills || []).map(x => '<span>' + esc(x) + '</span>').join('') + '</div>' +
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
    wedding: {
      label: 'Wedding Photography & Film',
      blurb: 'Full-day coverage shot with a calm, editorial eye — one team from first look to last dance.',
      note: 'Style reference from Jack’s existing work — full wedding galleries land after Aera’s first bookings.',
      price: '£950 – £1,800', team: 'Founder & lead shooter, Leeds', link: 'weddings.html',
      images: [
        'https://images.squarespace-cdn.com/content/v1/67a046e3af281e412f15579a/2bf343c0-129e-4bfa-9f17-0c20e62069dd/A7400282-Enhanced-NR.jpg',
        'https://images.squarespace-cdn.com/content/v1/67a046e3af281e412f15579a/a5c290e2-e3f5-4aed-81bd-9e8fa29d2e44/A7400277.jpg',
        'https://images.squarespace-cdn.com/content/v1/67a046e3af281e412f15579a/3f7fc108-1721-4d25-8fbd-b1328cbbfbe9/Screenshot%202025-02-05%20at%2010.41.30%E2%80%AFPM.png'
      ],
      kw: ['wedding','marriage','bride','groom','engaged','fianc','barn','venue','vows','ceremony','reception']
    },
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
      addAeraMessage('Hi — I’m here on behalf of Aera. Tell me a little about your project — a wedding, an event, your brand’s socials — and I’ll match you to the right service, real work, and a price range.');
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
