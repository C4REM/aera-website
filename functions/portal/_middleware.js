/* =======================================================================
   AERA — PORTAL ACCESS GATE
   A Cloudflare Pages Function that runs on Cloudflare's edge BEFORE any file
   under /portal/ is served. Nothing behind it is ever sent to a browser that
   hasn't authenticated, so unlike a client-side password check there is no
   "view source and read the answer" hole — the HTML simply never leaves the
   server.

   The password lives in the PORTAL_PASSWORD environment variable set in the
   Cloudflare dashboard, NOT in this repository. The repo is public; anything
   committed here is world-readable forever, including in git history.

   Sessions: on a correct password we set a cookie holding an expiry timestamp
   plus an HMAC of that timestamp, keyed on the password itself. The browser
   can read the cookie but cannot forge one, because it never learns the key.
   Keying on the password also means changing PORTAL_PASSWORD instantly signs
   everyone out — which is exactly what you want the moment someone leaves.
   ========================================================================== */

const COOKIE_NAME  = 'aera_portal';
const SESSION_DAYS = 14;

/* ---------- crypto helpers ---------- */

async function sign(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* Compare in constant time. A plain === bails out at the first wrong byte, and
   the time it took to bail leaks how much of the guess was right — enough,
   over many attempts, to recover a password byte by byte. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function makeCookie(password) {
  const expires = Date.now() + SESSION_DAYS * 864e5;
  return `${expires}.${await sign(password, String(expires))}`;
}

async function cookieValid(value, password) {
  if (!value) return false;
  const dot = value.lastIndexOf('.');
  if (dot < 1) return false;
  const expires = value.slice(0, dot);
  const mac     = value.slice(dot + 1);
  if (!/^\d+$/.test(expires) || Number(expires) < Date.now()) return false;
  return safeEqual(mac, await sign(password, expires));
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

/* ---------- login page ---------- */
/* Served inline rather than as a file in /portal/ so that it is reachable
   without authentication while everything genuinely private stays gated. */

function loginPage(error) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Aera</title>
<link rel="icon" type="image/svg+xml" href="/assets/img/logo/aera-monogram-favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500&family=Inter:wght@300;400&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    background:#060607;color:#EADFCD;font-family:'Inter',sans-serif;font-weight:300;
    min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
  }
  .box{width:100%;max-width:340px;text-align:center}
  svg{width:52px;height:52px;margin:0 auto 28px}
  h1{
    font-family:'Playfair Display',Georgia,serif;font-weight:500;
    font-size:1.6rem;letter-spacing:.02em;margin-bottom:6px;
  }
  p.sub{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#8C887F;margin-bottom:32px}
  input{
    width:100%;background:transparent;border:1px solid #1C1C1F;color:#EADFCD;
    padding:13px 15px;font-family:inherit;font-size:15px;font-weight:300;
    outline:none;transition:border-color .3s ease;text-align:center;
  }
  input:focus{border-color:#C2A878}
  button{
    width:100%;margin-top:12px;background:#C2A878;color:#060607;border:0;
    padding:13px;font-family:inherit;font-size:12px;font-weight:400;
    letter-spacing:.2em;text-transform:uppercase;cursor:pointer;
    transition:opacity .3s ease;
  }
  button:hover{opacity:.85}
  .err{color:#C97B6E;font-size:13px;margin-top:16px;min-height:20px}
  a.back{display:inline-block;margin-top:36px;font-size:11px;letter-spacing:.18em;
    text-transform:uppercase;color:#8C887F;text-decoration:none;transition:color .3s}
  a.back:hover{color:#EADFCD}
</style>
</head>
<body>
  <div class="box">
    <svg viewBox="0 0 200 200" fill="none" aria-label="Aera">
      <path d="M100,52 L138,100 L100,148 L62,100 Z" stroke="#C2A878" stroke-width="1.5" opacity="0.5"/>
      <path d="M100,60 L70,100 L130,100 Z M100,140 L70,100 M130,100 L100,140 M82,85 L118,85 M82,115 L118,115"
            stroke="#C2A878" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <h1>Studio Portal</h1>
    <p class="sub">Team access only</p>
    <form method="POST" autocomplete="off">
      <input type="password" name="password" placeholder="Password" autofocus required
             aria-label="Portal password">
      <button type="submit">Enter</button>
    </form>
    <div class="err">${error || ''}</div>
    <a class="back" href="/">← aerastudios.org</a>
  </div>
</body>
</html>`;
}

/* ---------- the gate ---------- */

export async function onRequest(context) {
  const { request, env, next } = context;
  const password = env.PORTAL_PASSWORD;
  const url = new URL(request.url);
  const isApi = url.pathname.startsWith('/portal/api/');

  // Fail closed. If the environment variable is missing the portal locks
  // rather than falling open to the public — a misconfiguration should never
  // be the thing that publishes your internal pages.
  if (!password) {
    return new Response(
      isApi
        ? JSON.stringify({ error: 'PORTAL_PASSWORD is not set' })
        : loginPage('Portal not configured yet — set PORTAL_PASSWORD in Cloudflare.'),
      {
        status: isApi ? 500 : 503,
        headers: {
          'Content-Type': isApi ? 'application/json' : 'text/html; charset=utf-8',
          'X-Robots-Tag': 'noindex, nofollow'
        }
      }
    );
  }

  // Already signed in → hand the request on to the real page (or API route).
  if (await cookieValid(readCookie(request, COOKIE_NAME), password)) {
    const response = await next();
    // Belt and braces: even authenticated pages should never be indexed.
    const out = new Response(response.body, response);
    out.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return out;
  }

  // A login attempt.
  if (request.method === 'POST' && !isApi) {
    const form = await request.formData();
    const attempt = String(form.get('password') || '');

    if (safeEqual(attempt, password)) {
      return new Response(null, {
        status: 303,
        headers: {
          Location: url.pathname,
          'X-Robots-Tag': 'noindex, nofollow',
          'Set-Cookie': [
            `${COOKIE_NAME}=${await makeCookie(password)}`,
            'Path=/portal',
            'HttpOnly',                    // JavaScript can't read it, so XSS can't steal it
            'Secure',
            'SameSite=Lax',
            `Max-Age=${SESSION_DAYS * 86400}`
          ].join('; ')
        }
      });
    }

    // Slow every wrong guess down. At ~1s a try, brute-forcing even a weak
    // password over the network stops being practical.
    await new Promise(r => setTimeout(r, 1000));
    return new Response(loginPage('Incorrect password.'), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' }
    });
  }

  // Unauthenticated: API callers get JSON they can act on, humans get the form.
  if (isApi) {
    return new Response(JSON.stringify({ error: 'Not signed in' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow' }
    });
  }

  return new Response(loginPage(''), {
    status: 401,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' }
  });
}
