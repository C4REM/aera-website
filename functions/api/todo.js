/* ==========================================================================
   AERA — PERSONAL TO-DO (public endpoint, key-protected)
   Used by /todo/. The caller proves who they are with the long random key from
   their private link (sent in a header, never in the URL, so it doesn't end up
   in logs or referrers). Returns only that person's tasks, plus the shared
   "who's working on what" overview and the pitch decks.
   ========================================================================== */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' }
  });

async function readJSON(kv, k, fallback) {
  const raw = await kv.get(k);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

export async function onRequest({ request, env }) {
  const kv = env.PORTAL_KV;
  if (!kv) return json({ error: 'unavailable' }, 503);

  const key = String(request.headers.get('X-Todo-Key') || '').trim();
  if (!/^[a-f0-9]{36}$/.test(key)) return json({ error: 'Not found' }, 404);

  const keys = await readJSON(kv, 'todo:keys', {});
  const memberId = Object.keys(keys).find(id => keys[id] === key);
  if (!memberId) return json({ error: 'Not found' }, 404);
  const doc = await readJSON(kv, 'todo:' + memberId, null);
  if (!doc) return json({ error: 'Not found' }, 404);

  if (request.method === 'PUT') {
    let body; try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
    if (body.sheetSeen) {
      const sk = 'job:' + String(body.sheetSeen).slice(0, 60) + ':sheet';
      const sh = await readJSON(kv, sk, null);
      if (!sh) return json({ error: 'No such sheet' }, 404);
      sh.seen = sh.seen || {}; sh.seen[memberId] = new Date().toISOString();
      await kv.put(sk, JSON.stringify(sh));
      return json({ ok: true });
    }
    const it = (doc.items || []).find(i => i.id === body.id);
    if (!it) return json({ error: 'No such task' }, 404);
    it.done = !!body.done;
    doc.updated = new Date().toISOString();
    await kv.put('todo:' + memberId, JSON.stringify(doc));
    return json({ ok: true });
  }

  if (request.method !== 'GET') return json({ error: 'Not supported' }, 405);

  // Who's working on what: everyone's open tasks + the jobs they're on.
  const team = [];
  for (const id of Object.keys(keys)) {
    const d = id === memberId ? doc : await readJSON(kv, 'todo:' + id, null);
    if (!d) continue;
    team.push({ name: d.name, me: id === memberId, tasks: (d.items || []).filter(i => !i.done).map(i => i.text) });
  }
  const jobs = (await readJSON(kv, 'jobs', [])).filter(j => j.active !== false);
  team.forEach(t => {
    const first = (t.name || '').split(' ')[0].toLowerCase();
    t.jobs = jobs.filter(j => String(j.assignee || '').toLowerCase().split(',').map(s => s.trim().split(' ')[0]).includes(first))
      .map(j => ({ client: j.client, status: j.status }));
  });

  // Pitch decks: from the meetings this person was given, plus any pitch a lead has.
  const files = [];
  const seen = new Set();
  Object.values(doc.links || {}).flat().forEach(l => { if (l && l.url && !seen.has(l.url)) { seen.add(l.url); files.push(l); } });
  jobs.forEach(j => {
    if (j.pitchUrl && !seen.has(j.pitchUrl)) { seen.add(j.pitchUrl); files.push({ label: j.client + ' pitch', url: j.pitchUrl }); }
  });
  (await readJSON(kv, 'leads', [])).forEach(l => {
    if (l.pitchUrl && !seen.has(l.pitchUrl)) { seen.add(l.pitchUrl); files.push({ label: l.name + ' pitch', url: l.pitchUrl }); }
  });

  // Shoot sheets for the jobs this person is crewing, from yesterday onwards.
  const mine = (doc.name || '').split(' ')[0].toLowerCase();
  const yday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const sheets = [];
  for (const j of jobs) {
    const sh = await readJSON(kv, 'job:' + j.id + ':sheet', null);
    if (!sh) continue;
    const crew = [...String(j.assignee || '').split(','), ...(sh.crew || []).map(c => c.name)].map(n => String(n).trim().split(' ')[0].toLowerCase());
    if (!mine || !crew.includes(mine)) continue;
    if ((sh.date || j.date) && (sh.date || j.date) < yday) continue;
    sheets.push({ jobId: j.id, client: j.client, type: j.type, date: sh.date || j.date, call: sh.call, start: sh.start, end: sh.end,
      venue: sh.venue, address: sh.address, access: sh.access, contact: sh.contact, crew: sh.crew || [], kit: (sh.kit || []).map(k => k.text),
      shots: (sh.shots || []).map(x => x.text), notes: sh.notes, seen: !!(sh.seen && sh.seen[memberId]) });
  }
  sheets.sort((a, b) => String(a.date || '9').localeCompare(String(b.date || '9')));

  return json({ name: doc.name, items: doc.items || [], team, files, sheets, updated: doc.updated });
}
