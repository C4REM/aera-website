/* ==========================================================================
   AERA — WEBSITE ENQUIRIES (public)
   GET  -> call slots for the next 10 days (days someone is marked On in the
           Week and not away; falls back to weekdays when nobody's marked On)
   POST -> an enquiry. It goes straight into the Jobs list as an Enquiry with
           the answers in its notes. A requested call slot is held so the same
           time can't be booked twice.
   Spam: a hidden honeypot field, and at most 5 enquiries per hour per IP.
   ========================================================================== */

const json = (d, s = 200) => new Response(JSON.stringify(d), {
  status: s, headers: { 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' }
});
const str = (v, n) => String(v ?? '').trim().slice(0, n);
async function get(kv, k, fb = null) { const r = await kv.get(k); if (!r) return fb; try { return JSON.parse(r); } catch { return fb; } }
const TIMES = ['11:00', '13:30', '17:00'];
const TYPES = { band: 'Live music', wedding: 'Wedding', business: 'Social content', event: 'Event', other: 'Other' };

/* ---- email to Jack ----
   Two ways, whichever is set up in Cloudflare (Pages → aera-website → Settings → Bindings):
   1. MAILER: a service binding to the small "aera-mailer" Worker (workers/mailer/),
      which sends through Cloudflare Email Routing to bookings@ → iCloud. Free.
   2. RESEND_API_KEY (+ optional NOTIFY_TO): Resend's HTTP API.
   With neither, the enquiry still lands in the portal and Compass as normal. */
async function notify(env, e) {
  const when = e.call ? new Date(e.call.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + ' at ' + e.call.slice(11) : '';
  const subject = `New enquiry: ${e.name} · ${e.type}`;
  const text = [
    `${e.name} just sent an enquiry through the website.`, '',
    `Type: ${e.type}`,
    ...e.answers.map(a => `${a.q} ${a.a}`),
    `Email: ${e.email}`,
    when ? `Wants a call: ${when}` : 'No call booked',
    '', 'Open it in the portal: https://aerastudios.org/portal/',
    '', 'Reply to this email to answer them directly.'
  ].join('\n');
  if (env.MAILER && env.MAILER.fetch) {
    await env.MAILER.fetch('https://mailer/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, text, replyTo: e.email }) });
  } else if (env.RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', { method: 'POST',
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Aera Portal <portal@aerastudios.org>', to: [env.NOTIFY_TO || 'bookings@aerastudios.org'], reply_to: e.email, subject, text }) });
  }
}

function londonISO(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }

async function slots(kv) {
  const planner = await get(kv, 'planner', {});
  const on = new Set(Array.isArray(planner.on) ? planner.on : []);
  const away = Array.isArray(planner.away) ? planner.away : [];
  const members = (planner.members || []).map(m => m.id);
  const held = new Set(await get(kv, 'enquire:held', []));
  const days = [];
  for (let i = 1; i <= 10; i++) {
    const d = new Date(Date.now() + i * 864e5);
    const iso = londonISO(d);
    const dow = new Date(iso + 'T12:00:00Z').getUTCDay();
    const free = members.filter(m => !away.some(a => a.memberId === m && a.from <= iso && iso <= a.to));
    days.push({ date: iso, dow, onCount: free.filter(m => on.has(`${iso}|${m}`)).length, freeCount: free.length });
  }
  const anyOn = days.some(d => d.onCount > 0);
  return days
    .filter(d => anyOn ? d.onCount > 0 : (d.dow !== 0 && d.dow !== 6 && d.freeCount > 0))
    .slice(0, 6)
    .map(d => ({ date: d.date, times: TIMES.filter(t => !held.has(`${d.date} ${t}`)) }))
    .filter(d => d.times.length);
}

export async function onRequest({ request, env, waitUntil }) {
  const kv = env.PORTAL_KV;
  if (!kv) return json({ error: 'unavailable' }, 503);
  if (request.method === 'GET') return json({ slots: await slots(kv) });
  if (request.method !== 'POST') return json({ error: 'Not supported' }, 405);

  let b; try { b = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
  if (b.website) return json({ ok: true });   // honeypot: bots fill every field

  const ip = str(request.headers.get('CF-Connecting-IP'), 64) || 'unknown';
  const rk = 'enquire:rate:' + ip;
  const n = Number(await kv.get(rk)) || 0;
  if (n >= 5) return json({ error: 'Too many enquiries from here. Please email bookings@aerastudios.org.' }, 429);
  await kv.put(rk, String(n + 1), { expirationTtl: 3600 });

  const name = str(b.name, 80), email = str(b.email, 120);
  if (name.length < 2) return json({ error: 'Please add your name.' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Please add an email we can reply to.' }, 400);
  const type = TYPES[b.type] ? b.type : 'other';
  const answers = (Array.isArray(b.answers) ? b.answers : []).slice(0, 4).map(a => ({ q: str(a.q, 120), a: str(a.a, 600) })).filter(a => a.a);

  let call = '';
  if (b.slot && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(b.slot)) {
    const open = (await slots(kv)).some(d => d.times.some(t => `${d.date} ${t}` === b.slot));
    if (!open) return json({ error: 'That call time has just gone. Please pick another.' }, 409);
    const held = await get(kv, 'enquire:held', []);
    held.push(b.slot);
    await kv.put('enquire:held', JSON.stringify(held.slice(-200)));
    call = b.slot;
  }

  const notes = [
    'Website enquiry · ' + TYPES[type],
    ...answers.map(a => `${a.q} ${a.a}`),
    `Contact: ${email}`,
    call ? `Wants a call: ${call}` : ''
  ].filter(Boolean).join('\n').slice(0, 600);

  const jobs = await get(kv, 'jobs', []);
  jobs.unshift({
    id: crypto.randomUUID(), client: name, type: TYPES[type], date: '', assignee: '', fee: '', notes,
    status: 'Enquiry', active: true, priority: false, rank: 9999, pitchUrl: '',
    source: 'Website', email, call, unread: true, created: new Date().toISOString(), updated: new Date().toISOString()
  });
  await kv.put('jobs', JSON.stringify(jobs));
  // Email Jack. Never blocks or fails the enquiry itself.
  const mail = notify(env, { name, email, type: TYPES[type], answers, call }).catch(() => {});
  if (waitUntil) waitUntil(mail); else await mail;
  return json({ ok: true, call });
}
