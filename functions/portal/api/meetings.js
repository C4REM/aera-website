/* ==========================================================================
   AERA — PORTAL MEETINGS API
   Lives under /portal/ so _middleware.js gates it: an unauthenticated request
   gets a 401 from the gate and never reaches this code.

   The repo is PUBLIC, so no meeting content is ever committed here. Minutes
   live only in KV (key `meetings`), written through the portal UI.

   One KV key holding the whole list, same reasoning as jobs.js: a studio has
   tens of meetings a year, not thousands, so reading it whole is simplest.
   ========================================================================== */

const KEY = 'meetings';
const STATUSES = ['Draft', 'Agreed'];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow' }
  });

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

/* Trim and cap everything so a stray paste can't bloat the KV value. */
function clean(body, existing = {}) {
  const pick = k => (body[k] !== undefined ? body[k] : existing[k]);
  return {
    id:        existing.id || crypto.randomUUID(),
    title:     str(pick('title'), 100) || 'Team meeting',
    date:      str(pick('date'), 10),            // YYYY-MM-DD
    time:      str(pick('time'), 20),
    location:  str(pick('location'), 100),
    attendees: str(pick('attendees'), 300),
    status:    STATUSES.includes(pick('status')) ? pick('status') : 'Draft',
    agenda: list(pick('agenda'), 25).map(a => ({
      title: str(a && a.title, 140),
      notes: str(a && a.notes, 4000)
    })).filter(a => a.title || a.notes),
    decisions: str(pick('decisions'), 4000),
    links: list(pick('links'), 15).map(l => ({
      label: str(l && l.label, 80),
      url:   str(l && l.url, 400)
    })).filter(l => /^https?:\/\//i.test(l.url)),
    actions: list(pick('actions'), 50).map(a => ({
      id:    str(a && a.id, 40) || crypto.randomUUID(),
      text:  str(a && a.text, 300),
      owner: str(a && a.owner, 40),
      due:   str(a && a.due, 10),
      done:  !!(a && a.done)
    })).filter(a => a.text),
    updated: new Date().toISOString()
  };
}

async function readAll(kv) {
  const raw = await kv.get(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const sortDesc = arr => arr.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

export async function onRequest({ request, env }) {
  const kv = env.PORTAL_KV;
  if (!kv) return json({ error: 'no-kv', message: 'KV namespace PORTAL_KV is not bound.' }, 501);

  const method = request.method;
  if (method === 'GET') return json({ meetings: sortDesc(await readAll(kv)) });

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Body must be JSON' }, 400); }

  const all = await readAll(kv);

  if (method === 'POST') {
    all.push(clean(body));
  } else if (method === 'PUT') {
    const i = all.findIndex(m => m.id === body.id);
    if (i === -1) return json({ error: 'No meeting with that id' }, 404);
    all[i] = clean(body, all[i]);
  } else if (method === 'DELETE') {
    const i = all.findIndex(m => m.id === body.id);
    if (i === -1) return json({ error: 'No meeting with that id' }, 404);
    all.splice(i, 1);
  } else {
    return json({ error: `${method} not supported` }, 405);
  }

  await kv.put(KEY, JSON.stringify(all));
  return json({ meetings: sortDesc(all) });
}
