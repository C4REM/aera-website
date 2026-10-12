/* ==========================================================================
   AERA — THE VIEWFINDER (home hero)
   The reel plays behind a camera HUD. The pointer is the autofocus point:
   a WebGL pass draws the video through a lens, so focus racks (with a focus
   puller's lag) to wherever the AF point sits and the rest of the frame
   falls into bokeh. Click / tap / [ take the shot ] fires the shutter — the
   live frame is grabbed off the video and flies into a six-frame roll.
   Fill the roll and the hero hands you to the enquiry.

   Degrades in layers: no WebGL → the <video> plays sharp under the same HUD;
   reduced motion → no autoplay, no iris, no flight (the frame just lands);
   no JS → the video still autoplays (muted, playsinline) behind the title.
   ========================================================================== */
(function(){
  const hero = document.getElementById('top');
  if (!hero || !hero.classList.contains('vf')) return;

  const stage  = document.getElementById('vfStage');
  const video  = document.getElementById('vfVideo');
  const canvas = document.getElementById('vfGL');
  const af     = document.getElementById('vfAF');
  const afRead = document.getElementById('vfAFRead');
  const tcEl   = document.getElementById('vfTC');
  const flash  = document.getElementById('vfFlash');
  const rollW  = document.getElementById('vfRollWrap');
  const slots  = Array.from(document.querySelectorAll('#vfRoll .vf-slot'));
  const meta   = document.getElementById('vfMeta');
  const shootBtn = document.getElementById('vfShoot');
  const title  = hero.querySelector('.vf-title');
  const huds   = Array.from(hero.querySelectorAll('.vf-hud, .vf-lines'));

  const fine   = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ROLL   = slots.length;

  /* ---------------------------------------------------------------- video */
  video.muted = true;
  if (reduce){ video.removeAttribute('autoplay'); video.pause(); }
  const play = () => { if (reduce) return; const p = video.play(); if (p && p.catch) p.catch(() => {}); };

  const poster = new Image();
  poster.src = video.getAttribute('poster');

  /* ---------------------------------------------------------- iris intro */
  let opened = false;
  const open = () => {
    if (opened) return; opened = true;
    play();
    requestAnimationFrame(() => hero.classList.add('vf-open'));
  };
  addEventListener('aera:preloaderdone', open);
  if (!document.getElementById('preloader')) open();
  setTimeout(open, 3600);                       // never stay shut

  /* ------------------------------------------------------------ HUD: clocks */
  const fmt = tz => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const fL = fmt('Europe/London'), fD = fmt('Asia/Dubai');
  const doing = h => h < 7 ? 'asleep' : h < 9 ? 'coffee' : h < 13 ? 'editing'
                   : h < 14 ? 'lunch' : h < 18 ? 'on set' : h < 22 ? 'grading' : 'rendering';
  const elL = document.getElementById('vfClockL'), elD = document.getElementById('vfClockD');
  const doL = document.getElementById('vfDoL'),    doD = document.getElementById('vfDoD');
  function clocks(){
    const now = new Date();
    const l = fL.format(now), d = fD.format(now);
    elL.textContent = l; elD.textContent = d;
    doL.textContent = doing(parseInt(l, 10)); doD.textContent = doing(parseInt(d, 10));
  }
  clocks(); setInterval(clocks, 20000);

  /* -------------------------------------------------------- focus state
     t* = where the operator is pointing, f* = where focus actually is.
     Focus chases the target with lag; while it is still travelling the AF
     box reads as hunting, and it locks (champagne) once it arrives. */
  let tx = 0.62, ty = 0.42, fx = tx, fy = ty;
  let lastInput = -1e9, lock = 0, aiming = false, inHero = false;
  const POI = [[0.62, 0.42], [0.38, 0.38], [0.52, 0.56], [0.7, 0.3]];

  function toLocal(e){
    const r = hero.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, r];
  }
  const overUI = el => !!(el && el.closest && el.closest('.vf-roll, .vf-sub-link, a, button'));

  if (fine){
    hero.addEventListener('pointermove', e => {
      const ui = overUI(e.target);
      hero.classList.toggle('vf-aiming', !ui);
      document.body.classList.toggle('vf-in', !ui);
      aiming = !ui;
      if (ui) return;
      const [x, y] = toLocal(e);
      tx = x; ty = y; lastInput = performance.now();
    });
    hero.addEventListener('pointerenter', () => { inHero = true; });
    hero.addEventListener('pointerleave', () => {
      inHero = false; aiming = false;
      hero.classList.remove('vf-aiming'); document.body.classList.remove('vf-in');
    });
  }

  /* ---------------------------------------------------------------- WebGL */
  let gl = null, prog, tex, buf, U = {}, hasFrame = false, renderScale = 1;
  try {
    gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false,
                                      premultipliedAlpha: false, preserveDrawingBuffer: false,
                                      powerPreference: 'high-performance' });
  } catch (e) { gl = null; }

  const VS = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
  const FS = `precision mediump float;
uniform sampler2D uTex;
uniform vec2 uRes;      // canvas px
uniform vec4 uCover;    // xy = scale, zw = offset (object-fit: cover)
uniform vec2 uFocus;    // screen uv, y down
uniform float uR0, uR1; // focus radius in screen-height units
uniform float uBlur;    // max circle of confusion, px
uniform float uHunt;    // 0 locked .. 1 hunting (global softness)
uniform float uShot;    // shutter blackout
uniform float uTime;
const int N = 28;
vec3 tap(vec2 uv){ return texture2D(uTex, uv).rgb; }
void main(){
  vec2 s = gl_FragCoord.xy / uRes;
  s.y = 1.0 - s.y;
  vec2 uv = s * uCover.xy + uCover.zw;   // texture rows run top-down, same as s
  vec2 d = (s - uFocus) * vec2(uRes.x / uRes.y, 1.0);
  float coc = smoothstep(uR0, uR1, length(d));
  float rad = max(coc * uBlur, uHunt * 5.0);
  vec3 col;
  if (rad < 0.8){
    col = tap(uv);
  } else {
    vec2 px = rad / uRes * uCover.xy;
    vec3 acc = vec3(0.0); float wsum = 0.0;
    for (int i = 0; i < N; i++){
      float fi = float(i);
      float r = sqrt((fi + 0.5) / float(N));
      float a = fi * 2.3999632;
      vec3 c = tap(uv + vec2(cos(a), sin(a)) * r * px);
      float m = max(c.r, max(c.g, c.b));
      float w = 1.0 + 3.0 * m * m * m * m;   // highlights bloom into bokeh discs
      acc += c * w; wsum += w;
    }
    col = acc / wsum;
  }
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(l), coc * 0.3);          // the out-of-focus world desaturates
  col *= 1.0 - coc * 0.3;                      // ...and recedes
  vec2 v = s - 0.5;
  col *= 1.0 - dot(v, v) * 0.6;                // lens vignette
  col *= vec3(1.03, 1.0, 0.95);                // warm, toward champagne
  float n = fract(sin(dot(gl_FragCoord.xy + floor(uTime * 24.0) * 17.0, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * 0.05;                     // grain
  col *= 1.0 - uShot;
  gl_FragColor = vec4(col, 1.0);
}`;

  function compile(type, src){
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }
  if (gl){
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['uTex','uRes','uCover','uFocus','uR0','uR1','uBlur','uHunt','uShot','uTime']
        .forEach(n => U[n] = gl.getUniformLocation(prog, n));
      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(U.uTex, 0);
    } catch (err) {
      gl = null;
    }
  }

  function upload(src){
    try {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
      hasFrame = true;
    } catch (e) { /* tainted or not ready — try again next frame */ }
  }

  let W = 0, H = 0;
  function resize(){
    const r = hero.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, fine ? 1.25 : 1);
    W = Math.max(2, Math.round(r.width * dpr * renderScale));
    H = Math.max(2, Math.round(r.height * dpr * renderScale));
    if (canvas.width !== W || canvas.height !== H){ canvas.width = W; canvas.height = H; }
  }

  function cover(){
    const vw = video.videoWidth || poster.naturalWidth || 16, vh = video.videoHeight || poster.naturalHeight || 9;
    const va = vw / vh, sa = W / H;
    const zoom = 1.035;                                  // headroom for the handheld drift
    let sx = 1, sy = 1;
    if (sa > va) sy = va / sa; else sx = sa / va;
    sx /= zoom; sy /= zoom;
    // a breath of handheld drift, leaning a hair toward the focus point
    const t = performance.now() / 1000;
    const dx = (reduce ? 0 : Math.sin(t * 0.6) * 0.0018 + Math.sin(t * 1.7) * 0.0007) + (fx - 0.5) * 0.008;
    const dy = (reduce ? 0 : Math.cos(t * 0.5) * 0.0016 + Math.sin(t * 1.3) * 0.0006) + (fy - 0.5) * 0.006;
    return [sx, sy, 0.5 - 0.5 * sx + dx, 0.5 - 0.5 * sy + dy];
  }

  /* -------------------------------------------------------------- shutter */
  let shot = 0;                       // 0..1 blackout envelope driven in the loop
  let shotT = -1;
  let count = 0;

  function grab(){
    const c = document.createElement('canvas');
    c.width = 320; c.height = 180;
    const g = c.getContext('2d');
    const src = (video.readyState >= 2) ? video : poster;
    const sw = src.videoWidth || src.naturalWidth, sh = src.videoHeight || src.naturalHeight;
    if (sw && sh){
      const a = 16 / 9, sa = sw / sh;
      let cw = sw, ch = sh, cx = 0, cy = 0;
      if (sa > a){ cw = sh * a; cx = (sw - cw) / 2; } else { ch = sw / a; cy = (sh - ch) / 2; }
      try { g.drawImage(src, cx, cy, cw, ch, 0, 0, 320, 180); } catch (e) {}
    }
    return c;
  }

  function timecode(t){
    const fr = Math.floor((t % 1) * 30), s = Math.floor(t);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(fr)}`;
  }

  function setMeta(){
    document.getElementById('vfCount').textContent = `Roll ${count}/${ROLL}`;
  }

  function fullRoll(){
    rollW.classList.add('full');
    meta.innerHTML = `<span class="vf-count">Full roll.</span>
      <a href="#contact">Now imagine a brief &rarr;</a>
      <button class="vf-reset" type="button">Reset</button>`;
    meta.querySelector('.vf-reset').addEventListener('click', e => { e.stopPropagation(); resetRoll(); });
  }

  function resetRoll(){
    count = 0;
    slots.forEach(s => { s.classList.remove('filled'); s.innerHTML = ''; s.removeAttribute('data-n'); });
    rollW.classList.remove('full');
    meta.innerHTML = '';
    const c = document.createElement('span'); c.className = 'vf-count'; c.id = 'vfCount';
    meta.appendChild(c); meta.appendChild(shootBtn);
    setMeta();
  }

  function fire(clientX, clientY){
    if (count >= ROLL){
      rollW.classList.remove('nudge'); void rollW.offsetWidth; rollW.classList.add('nudge');
      return;
    }
    const r = hero.getBoundingClientRect();
    if (clientX == null){ clientX = r.left + fx * r.width; clientY = r.top + fy * r.height; }
    // snap focus to where the shot was taken — you focus, then you fire
    tx = fx = (clientX - r.left) / r.width;
    ty = fy = (clientY - r.top) / r.height;
    lock = 1;

    const frame = grab();
    const n = count + 1;
    const slot = slots[count];
    count = n;
    setMeta();

    if (!reduce){
      shotT = performance.now();
      if (!gl){ flash.animate([{ opacity: 0 }, { opacity: .92, offset: .35 }, { opacity: 0 }], { duration: 190, easing: 'ease-out' }); }
    }

    const land = () => {
      slot.innerHTML = ''; slot.appendChild(frame);
      slot.dataset.n = String(n).padStart(2, '0');
      slot.classList.add('filled');
      if (count >= ROLL) fullRoll();
    };

    if (reduce || !slot.animate){ land(); return; }

    const sr = slot.getBoundingClientRect();
    const pw = Math.min(260, r.width * 0.22), ph = pw * 9 / 16;
    const print = document.createElement('div');
    print.className = 'vf-print';
    print.style.width = pw + 'px'; print.style.height = ph + 'px';
    const copy = document.createElement('canvas');
    copy.width = 320; copy.height = 180;
    copy.getContext('2d').drawImage(frame, 0, 0);
    print.appendChild(copy);
    document.body.appendChild(print);

    const sx = clientX - pw / 2, sy = clientY - ph / 2;
    const ex = sr.left + sr.width / 2 - pw / 2, ey = sr.top + sr.height / 2 - ph / 2;
    const k = sr.width / pw;
    const rot = (Math.random() * 10 - 5).toFixed(1);
    const anim = print.animate([
      { transform: `translate(${sx}px,${sy}px) scale(.6) rotate(0deg)`, opacity: 0 },
      { transform: `translate(${sx}px,${sy - 24}px) scale(1.04) rotate(${rot}deg)`, opacity: 1, offset: .22 },
      { transform: `translate(${ex}px,${ey}px) scale(${k}) rotate(0deg)`, opacity: 1 }
    ], { duration: 820, easing: 'cubic-bezier(.3,.7,.15,1)', fill: 'forwards' });
    anim.onfinish = () => { land(); print.remove(); };
  }

  hero.addEventListener('click', e => {
    if (overUI(e.target)) return;
    fire(e.clientX, e.clientY);
  });
  shootBtn.addEventListener('click', e => { e.stopPropagation(); fire(); });
  setMeta();

  /* ---------------------------------------------------------- scroll exit
     As the hero leaves, the frame pulls back from viewfinder to screen:
     the stage scales down and rounds off, the furniture fades first. */
  let scrollP = 0;
  function onScroll(){
    const h = hero.offsetHeight || 1;
    scrollP = Math.min(1, Math.max(0, window.scrollY / h));
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ----------------------------------------------------------- the loop */
  let running = false, visible = true, last = performance.now();
  let slowFrames = 0, frames = 0;

  const io = new IntersectionObserver(es => {
    visible = es[0].isIntersecting;
    if (visible){ if (opened) play(); start(); }
    else { video.pause(); }
  }, { threshold: 0 });
  io.observe(hero);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause(); else if (visible && opened) play();
  });

  if (gl){
    hero.classList.add('gl-on');
    resize();
    addEventListener('resize', resize);
    if ('requestVideoFrameCallback' in video){
      const onFrame = () => { if (running) upload(video); video.requestVideoFrameCallback(onFrame); };
      video.requestVideoFrameCallback(onFrame);
    }
    if (poster.complete) upload(poster); else poster.addEventListener('load', () => { if (!hasFrame) upload(poster); });
  }

  function start(){ if (!running){ running = true; last = performance.now(); requestAnimationFrame(loop); } }

  function loop(){
    if (!visible){ running = false; return; }
    // performance.now(), not the rAF timestamp: under main-thread load the
    // rAF time can trail performance.now() by over a second, which made dt
    // negative and sent the focus chase off to infinity.
    const now = performance.now();
    const dt = Math.min(0.064, Math.max(0, (now - last) / 1000)); last = now;

    // idle → the camera hunts between points of interest on its own
    const idle = now - lastInput > 3200;
    if (idle && !reduce){
      const t = now / 1000;
      const i = Math.floor(t / 3.6) % POI.length;
      tx = POI[i][0] + Math.sin(t * 0.7) * 0.015;
      ty = POI[i][1] + Math.cos(t * 0.6) * 0.012;
    }

    // focus puller: critically-damped-ish chase
    const k = 1 - Math.pow(0.0009, dt);
    const px = fx, py = fy;
    fx += (tx - fx) * k; fy += (ty - fy) * k;
    const speed = Math.hypot(fx - px, fy - py) / Math.max(dt, 1e-3);
    const target = Math.max(0, 1 - speed * 2.2);
    lock += (target - lock) * (1 - Math.pow(0.02, dt));

    // HUD
    const r = hero.getBoundingClientRect();
    af.style.transform = `translate(${(fx * r.width).toFixed(1)}px,${(fy * r.height).toFixed(1)}px)`;
    const locked = lock > 0.86;
    af.classList.toggle('locked', locked);
    const dist = (0.9 + (1 - fy) * 3.4 + Math.abs(fx - 0.5) * 1.2).toFixed(1);
    afRead.textContent = (locked ? 'AF-C ● ' : 'AF-C ○ ') + dist + 'm';
    af.style.opacity = (fine && inHero && !aiming) ? '0' : String(Math.max(0, 1 - scrollP * 3));
    if (video.readyState >= 2) tcEl.textContent = timecode(video.currentTime);

    // shutter envelope: 60ms close, 160ms open
    if (shotT > 0){
      const e = now - shotT;
      shot = e < 60 ? e / 60 : e < 220 ? 1 - (e - 60) / 160 : 0;
      if (e >= 220) shotT = -1;
    }

    // scroll pull-back
    const p = scrollP;
    stage.style.transform = p > 0 ? `scale(${(1 - p * 0.12).toFixed(4)})` : '';
    stage.style.borderRadius = p > 0 ? (p * 26).toFixed(1) + 'px' : '';
    if (title){ title.style.transform = p > 0 ? `translateY(${(-p * 90).toFixed(1)}px)` : ''; title.style.opacity = String(1 - Math.min(1, p * 1.4)); }
    rollW.style.opacity = String(1 - Math.min(1, p * 2.2));
    huds.forEach(h => { h.style.opacity = String(1 - Math.min(1, p * 2.6)); });

    if (gl){
      if (!('requestVideoFrameCallback' in video) && video.readyState >= 2 && !video.paused) upload(video);
      if (hasFrame){
        gl.viewport(0, 0, W, H);
        const c = cover();
        gl.uniform2f(U.uRes, W, H);
        gl.uniform4f(U.uCover, c[0], c[1], c[2], c[3]);
        gl.uniform2f(U.uFocus, fx, fy);
        const narrow = r.width < 760;
        gl.uniform1f(U.uR0, narrow ? 0.14 : 0.11);
        gl.uniform1f(U.uR1, narrow ? 0.62 : 0.58);
        gl.uniform1f(U.uBlur, (narrow ? 8 : 12) * (W / Math.max(1, r.width)));
        gl.uniform1f(U.uHunt, reduce ? 0 : Math.max(0, 0.75 - lock) * 0.9);
        gl.uniform1f(U.uShot, shot * 0.94);
        gl.uniform1f(U.uTime, now / 1000);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      // adaptive resolution: if the GPU can't hold ~45fps, render smaller
      frames++;
      if (dt > 0.024) slowFrames++;
      if (frames === 90){
        if (slowFrames > 45 && renderScale > 0.6){ renderScale = Math.max(0.6, renderScale - 0.2); resize(); }
        frames = 0; slowFrames = 0;
      }
    }

    requestAnimationFrame(loop);
  }
  start();
})();
