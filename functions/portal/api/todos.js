/* ==========================================================================
   AERA — PORTAL TO-DO LISTS (admin side, behind the portal password)
   After a meeting, Jack assigns tasks to each attendee. Each person gets a
   private link (/todo/#<key>) that opens only their own list — no portal
   password needed, the long random key IS the access.

   KV:
     todo:keys        { memberId: key }           which key belongs to whom
     todo:<memberId>  { name, key, items:[...] }  that person's list
   The repo is public, so none of this content is ever committed.
   ========================================================================== */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow' }
  });

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const url = v => { const s = str(v, 400); return /^https?:\/\//i.test(s) ? s : ''; };
const links = arr => (Array.isArray(arr) ? arr : []).slice(0, 20)
  .map(l => ({ label: str(l && l.label, 80), url: url(l && l.url) })).filter(l => l.url);

const newKey = () => [...crypto.getRandomValues(new Uint8Array(18))]
  .map(b => b.toString(16).padStart(2, '0')).join('');

async function readJSON(kv, k, fallback) {
  const raw = await kv.get(k);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

export async function onRequest({ request, env }) {
  const kv = env.PORTAL_KV;
  if (!kv) return json({ error: 'no-kv', message: 'KV namespace PORTAL_KV is not bound.' }, 501);

  const keys = await readJSON(kv, 'todo:keys', {});

  if (request.method === 'GET') {
    // Everyone who has a list, with their open/done counts and private key.
    const people = [];
    for (const [memberId, key] of Object.entries(keys)) {
      const doc = await readJSON(kv, 'todo:' + memberId, null);
      if (!doc) continue;
      const items = doc.items || [];
      people.push({ memberId, name: doc.name, key,
        open: items.filter(i => !i.done).length, done: items.filter(i => i.done).length });
    }
    return json({ people });
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Body must be JSON' }, 400); }

  if (request.method === 'POST') {
    // { meeting:{id,title,date}, links:[...], people:[{memberId,name,items:[{text,links}]}] }
    const meeting = { id: str(body.meeting && body.meeting.id, 60), title: str(body.meeting && body.meeting.title, 100), date: str(body.meeting && body.meeting.date, 10) };
    const shared = links(body.links);
    const out = {};
    for (const p of (Array.isArray(body.people) ? body.people : []).slice(0, 20)) {
      const memberId = str(p.memberId, 40); if (!memberId) continue;
      const doc = await readJSON(kv, 'todo:' + memberId, null) || { items: [] };
      doc.name = str(p.name, 60) || doc.name || memberId;
      if (!keys[memberId]) keys[memberId] = newKey();
      doc.key = keys[memberId];
      // Re-sending the same meeting replaces that meeting's tasks rather than
      // duplicating them; ticks on tasks that are still there are kept.
      const old = doc.items.filter(i => i.meetingId === meeting.id);
      doc.items = doc.items.filter(i => i.meetingId !== meeting.id);
      for (const it of (Array.isArray(p.items) ? p.items : []).slice(0, 60)) {
        const text = str(it.text, 300); if (!text) continue;
        const prev = old.find(o => o.text === text);
        doc.items.push({ id: prev ? prev.id : crypto.randomUUID(), text, done: prev ? prev.done : false,
          links: links(it.links), meetingId: meeting.id, meetingTitle: meeting.title, meetingDate: meeting.date });
      }
      doc.links = doc.links || {};
      doc.links[meeting.id] = shared;   // the meeting's pitch decks / files, per meeting
      doc.updated = new Date().toISOString();
      await kv.put('todo:' + memberId, JSON.stringify(doc));
      out[memberId] = doc.key;
    }
    await kv.put('todo:keys', JSON.stringify(keys));
    return json({ keys: out });
  }

  if (request.method === 'DELETE') {
    // { memberId, rotate:true } issues a new private link (old one stops working).
    const memberId = str(body.memberId, 40);
    if (!keys[memberId]) return json({ error: 'No list for that person' }, 404);
    const doc = await readJSON(kv, 'todo:' + memberId, null);
    keys[memberId] = newKey();
    if (doc) { doc.key = keys[memberId]; await kv.put('todo:' + memberId, JSON.stringify(doc)); }
    await kv.put('todo:keys', JSON.stringify(keys));
    return json({ key: keys[memberId] });
  }

  return json({ error: `${request.method} not supported` }, 405);
}
