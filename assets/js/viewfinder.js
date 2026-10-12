/* ==========================================================================
   AERA — HERO LENS (home)
   The reel plays slowed and near-monochrome. A WebGL pass draws it through a
   lens: wherever the cursor rests, focus racks there (with a focus puller's
   lag) and that patch of the frame comes back into colour. Everything else
   stays soft and quiet. When the pointer is idle, or on touch, focus drifts
   slowly between a few points on its own. There is no visible UI for any of
   this; the image is the interface.

   Degrades in layers: no WebGL → the <video> plays, graded by CSS;
   reduced motion → no autoplay and no drift (poster frame, focus still
   follows the pointer); no JS → the video autoplays muted behind the type.
   ========================================================================== */
(function(){
  const hero = document.getElementById('top');
  if (!hero || !hero.classList.contains('vf')) return;

  const stage  = document.getElementById('vfStage');
  const video  = document.getElementById('vfVideo');
  const canvas = document.getElementById('vfGL');
  const fades  = Array.from(hero.querySelectorAll('.vf-meta, .vf-h1, .vf-cta'));

  const fine   = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RATE   = 0.75;                       // slowed: the reel reads as considered, not busy

  /* ---------------------------------------------------------------- video */
  video.muted = true;
  if (reduce){ video.removeAttribute('autoplay'); video.pause(); }
  const play = () => {
    if (reduce) return;
    video.playbackRate = RATE;
    const p = video.play(); if (p && p.catch) p.catch(() => {});
  };
  video.addEventListener('loadedmetadata', () => { video.playbackRate = RATE; });

  const poster = new Image();
  poster.src = video.getAttribute('poster');

  /* ------------------------------------------------------------ intro */
  let opened = false;
  const open = () => {
    if (opened) return; opened = true;
    play();
    requestAnimationFrame(() => hero.classList.add('vf-open'));
  };
  addEventListener('aera:preloaderdone', open);
  if (!document.getElementById('preloader')) open();
  setTimeout(open, 3600);

  /* -------------------------------------------------------- focus state */
  let tx = 0.5, ty = 0.4, fx = tx, fy = ty, lastInput = -1e9;
  const POI = [[0.5, 0.36], [0.62, 0.44], [0.4, 0.42], [0.55, 0.3]];

  if (fine){
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width;
      ty = (e.clientY - r.top) / r.height;
      lastInput = performance.now();
    });
  }

  /* ---------------------------------------------------------------- WebGL */
  let gl = null, tex, U = {}, hasFrame = false, renderScale = 1;
  try {
    gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false,
                                      premultipliedAlpha: false, preserveDrawingBuffer: false,
                                      powerPreference: 'high-performance' });
  } catch (e) { gl = null; }

  const VS = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
  const FS = `precision mediump float;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform vec4 uCover;
uniform vec2 uFocus;
uniform float uR0, uR1, uBlur, uTime;
const int N = 24;
void main(){
  vec2 s = gl_FragCoord.xy / uRes;
  s.y = 1.0 - s.y;
  vec2 uv = s * uCover.xy + uCover.zw;
  vec2 d = (s - uFocus) * vec2(uRes.x / uRes.y, 1.0);
  float coc = smoothstep(uR0, uR1, length(d));
  float rad = coc * uBlur;
  vec3 col;
  if (rad < 0.8){
    col = texture2D(uTex, uv).rgb;
  } else {
    vec2 px = rad / uRes * uCover.xy;
    vec3 acc = vec3(0.0); float wsum = 0.0;
    for (int i = 0; i < N; i++){
      float fi = float(i);
      float r = sqrt((fi + 0.5) / float(N));
      float a = fi * 2.3999632;
      vec3 c = texture2D(uTex, uv + vec2(cos(a), sin(a)) * r * px).rgb;
      float m = max(c.r, max(c.g, c.b));
      float w = 1.0 + 2.0 * m * m * m * m;
      acc += c * w; wsum += w;
    }
    col = acc / wsum;
  }
  // colour lives only where you look: near-monochrome out of focus
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col *= 1.0 - 0.38 * smoothstep(0.45, 1.0, l);     // roll off bright, backlit frames so the type holds
  l = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 mono = vec3(l) * vec3(1.06, 1.0, 0.9);      // warm, toward champagne
  col = mix(col, mono, mix(0.45, 0.94, coc));
  col *= mix(0.86, 0.6, coc);                       // the rest of the frame recedes
  vec2 v = s - 0.5;
  col *= 1.0 - dot(v, v) * 0.7;
  float n = fract(sin(dot(gl_FragCoord.xy + floor(uTime * 24.0) * 17.0, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * 0.035;
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
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['uTex','uRes','uCover','uFocus','uR0','uR1','uBlur','uTime'].forEach(n => U[n] = gl.getUniformLocation(prog, n));
      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(U.uTex, 0);
    } catch (err) { gl = null; }
  }

  function upload(src){
    try {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
      hasFrame = true;
    } catch (e) {}
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
    const va = vw / vh, sa = W / H, zoom = 1.03;
    let sx = 1, sy = 1;
    if (sa > va) sy = va / sa; else sx = sa / va;
    sx /= zoom; sy /= zoom;
    const t = performance.now() / 1000;
    const dx = (reduce ? 0 : Math.sin(t * 0.35) * 0.0014) + (fx - 0.5) * 0.006;
    const dy = (reduce ? 0 : Math.cos(t * 0.3) * 0.0012) + (fy - 0.5) * 0.004;
    return [sx, sy, 0.5 - 0.5 * sx + dx, 0.5 - 0.5 * sy + dy];
  }

  /* ---------------------------------------------------------- scroll exit
     The frame pulls back as the hero leaves: it scales down and rounds off,
     the type fades a beat ahead of it. */
  let scrollP = 0;
  const onScroll = () => { scrollP = Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight || 1))); };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------------------- the loop */
  let running = false, visible = true, last = performance.now(), frames = 0, slow = 0;

  new IntersectionObserver(es => {
    visible = es[0].isIntersecting;
    if (visible){ if (opened) play(); start(); } else video.pause();
  }, { threshold: 0 }).observe(hero);
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
    // performance.now(), not the rAF timestamp: under load the rAF time can
    // trail it by over a second, which would make dt negative.
    const now = performance.now();
    const dt = Math.min(0.064, Math.max(0, (now - last) / 1000)); last = now;

    if (!reduce && now - lastInput > 3500){
      const t = now / 1000, i = Math.floor(t / 6) % POI.length;
      tx = POI[i][0] + Math.sin(t * 0.4) * 0.012;
      ty = POI[i][1] + Math.cos(t * 0.33) * 0.01;
    }
    const k = 1 - Math.pow(0.004, dt);          // slower, softer pull than a snap
    fx += (tx - fx) * k; fy += (ty - fy) * k;

    const p = scrollP;
    stage.style.transform = p > 0 ? `scale(${(1 - p * 0.1).toFixed(4)})` : '';
    stage.style.borderRadius = p > 0 ? (p * 22).toFixed(1) + 'px' : '';
    fades.forEach(el => { el.style.opacity = p > 0 ? String(Math.max(0, 1 - p * 1.8)) : ''; });

    if (gl){
      if (!('requestVideoFrameCallback' in video) && video.readyState >= 2 && !video.paused) upload(video);
      if (hasFrame){
        const r = hero.getBoundingClientRect();
        const narrow = r.width < 760;
        const c = cover();
        gl.viewport(0, 0, W, H);
        gl.uniform2f(U.uRes, W, H);
        gl.uniform4f(U.uCover, c[0], c[1], c[2], c[3]);
        gl.uniform2f(U.uFocus, fx, fy);
        gl.uniform1f(U.uR0, narrow ? 0.16 : 0.13);
        gl.uniform1f(U.uR1, narrow ? 0.7 : 0.62);
        gl.uniform1f(U.uBlur, (narrow ? 6 : 9) * (W / Math.max(1, r.width)));
        gl.uniform1f(U.uTime, now / 1000);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      frames++; if (dt > 0.024) slow++;
      if (frames === 90){
        if (slow > 45 && renderScale > 0.6){ renderScale = Math.max(0.6, renderScale - 0.2); resize(); }
        frames = 0; slow = 0;
      }
    }
    requestAnimationFrame(loop);
  }
  start();
})();
