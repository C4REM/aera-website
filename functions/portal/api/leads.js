/* ==========================================================================
   AERA — PORTAL LEADS API
   Lives under /portal/api/ so it sits BEHIND _middleware.js, like jobs.js.
   One KV key ('leads') holds the whole list as JSON. The repo is public, so
   lead data (names, assessments, contact details) lives ONLY in KV, never in
   code. POST accepts either one lead or { leads: [...] } and upserts by a
   slug of name + area, so importing the same batch twice does not duplicate.
   ========================================================================== */

const KEY = 'leads';
const STATUSES = ['New', 'Pursuing', 'Dismissed'];
const SCORES = ['strong', 'good', 'medium', 'low'];
const PITCH = ['', 'requested', 'ready'];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow' }
  });

const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

/* A pitch link must be one of Jack's own Claude artifacts. */
const pitchLink = v => {
  const s = String(v ?? '').trim().slice(0, 200);
  return /^https:\/\/claude\.ai\/(artifact|code\/artifact)\/[A-Za-z0-9_\-]+/.test(s) ? s : '';
};

/* Links are rendered as href attributes, so only http(s) survives. */
const url = v => {
  const s = String(v ?? '').trim().slice(0, 300);
  return /^https?:\/\//i.test(s) ? s : '';
};

function clean(body, existing = {}) {
  const str = (v, max) => String(v ?? '').trim().slice(0, max);
  const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);
  const signals = Array.isArray(body.signals ?? existing.signals)
    ? (body.signals ?? existing.signals).map(x => str(x, 40)).filter(Boolean).slice(0, 8)
    : [];
  const name = str(body.name ?? existing.name, 80);
  const area = str(body.area ?? existing.area, 60);
  return {
    id:         existing.id || slug(name + ' ' + area) || crypto.randomUUID(),
    name,
    type:       str(body.type       ?? existing.type,       40),
    area,
    website:    url(body.website    ?? existing.website),
    facebook:   url(body.facebook   ?? existing.facebook),
    instagram:  url(body.instagram  ?? existing.instagram),
    phone:      str(body.phone      ?? existing.phone,      30),
    email:      str(body.email      ?? existing.email,      80),
    assessment: str(body.assessment ?? existing.assessment, 700),
    draftSubject: str(body.draftSubject ?? existing.draftSubject, 140),
    draft:      str(body.draft      ?? existing.draft,      3000),
    signals,
    score:      pick(body.score ?? existing.score, SCORES, 'medium'),
    source:     str(body.source     ?? existing.source,     60),
    added:      existing.added || str(body.added, 10) || new Date().toISOString().slice(0, 10),
    status:     pick(body.status ?? existing.status, STATUSES, 'New'),
    jobId:      str(body.jobId      ?? existing.jobId,      80),
    pitchUrl:   pitchLink(body.pitchUrl ?? existing.pitchUrl),
    pitchStatus: (() => {
      const url = pitchLink(body.pitchUrl ?? existing.pitchUrl);
      if (url) return 'ready';
      return pick(body.pitchStatus ?? existing.pitchStatus, PITCH, '');
    })(),
    updated:    new Date().toISOString()
  };
}

async function read(kv) {
  const raw = await kv.get(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.PORTAL_KV;
  if (!kv) {
    return json({ error: 'no-kv', message: 'KV namespace PORTAL_KV is not bound to this Pages project yet.' }, 501);
  }

  const method = request.method;
  if (method === 'GET') return json({ leads: await read(kv) });

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Body must be JSON' }, 400); }

  const leads = await read(kv);

  if (method === 'POST') {
    const incoming = Array.isArray(body.leads) ? body.leads : [body];
    let added = 0, updated = 0;
    for (const item of incoming.slice(0, 100)) {
      if (!String(item.name || '').trim()) continue;
      const id = slug(String(item.name) + ' ' + String(item.area || ''));
      const i = leads.findIndex(l => l.id === id);
      if (i === -1) { leads.unshift(clean(item)); added++; }
      else {
        // Re-importing refreshes the facts and assessment but never undoes a
        // decision Jack has already made (Pursuing / Dismissed).
        const keep = leads[i];
        leads[i] = clean({ ...item, status: keep.status, jobId: keep.jobId }, keep);
        updated++;
      }
    }
    await kv.put(KEY, JSON.stringify(leads.slice(0, 500)));
    return json({ leads, added, updated });
  }

  if (method === 'PUT') {
    const i = leads.findIndex(l => l.id === body.id);
    if (i === -1) return json({ error: 'No lead with that id' }, 404);
    leads[i] = clean(body, leads[i]);
    await kv.put(KEY, JSON.stringify(leads));
    return json({ leads });
  }

  if (method === 'DELETE') {
    const remaining = leads.filter(l => l.id !== body.id);
    if (remaining.length === leads.length) return json({ error: 'No lead with that id' }, 404);
    await kv.put(KEY, JSON.stringify(remaining));
    return json({ leads: remaining });
  }

  return json({ error: `${method} not supported` }, 405);
}
