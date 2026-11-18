/* ==========================================================================
   AERA — KIT (behind the portal password)
   KV 'gear': { items: [{id,name,owner}], bookings: [{id,itemId,date,who,jobId,note}] }
   Two bookings of the same item on the same day is a clash; the portal shows
   it in red (it's allowed, so you can sort it out, never blocked).
   POST ops: item.add {name, owner}, item.delete {id}, book {itemId,date,who,jobId,note}, unbook {id}
   ========================================================================== */
const json = (d, s = 200) => new Response(JSON.stringify(d), {
  status: s, headers: { 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' }
});
const str = (v, n) => String(v ?? '').trim().slice(0, n);
async function read(kv) {
  const r = await kv.get('gear'); let g = {};
  try { g = r ? JSON.parse(r) : {}; } catch {}
  return { items: Array.isArray(g.items) ? g.items : [], bookings: Array.isArray(g.bookings) ? g.bookings : [] };
}
export async function onRequest({ request, env }) {
  const kv = env.PORTAL_KV;
  if (!kv) return json({ error: 'no-kv' }, 501);
  const g = await read(kv);
  if (request.method === 'GET') return json(g);
  if (request.method !== 'POST') return json({ error: 'Not supported' }, 405);
  let b; try { b = await request.json(); } catch { return json({ error: 'Body must be JSON' }, 400); }
  switch (b.op) {
    case 'item.add': {
      const name = str(b.name, 60); if (!name) return json({ error: 'Name the kit' }, 400);
      if (g.items.length >= 80) return json({ error: 'Too many items' }, 400);
      g.items.push({ id: crypto.randomUUID(), name, owner: str(b.owner, 40) }); break;
    }
    case 'item.delete': {
      g.items = g.items.filter(i => i.id !== b.id);
      g.bookings = g.bookings.filter(x => x.itemId !== b.id); break;
    }
    case 'book': {
      const date = str(b.date, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'bad date' }, 400);
      if (!g.items.some(i => i.id === b.itemId)) return json({ error: 'unknown item' }, 400);
      g.bookings.push({ id: crypto.randomUUID(), itemId: b.itemId, date, who: str(b.who, 40), jobId: str(b.jobId, 60), note: str(b.note, 80) });
      const cutoff = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
      g.bookings = g.bookings.filter(x => x.date >= cutoff).slice(-600); break;
    }
    case 'unbook': g.bookings = g.bookings.filter(x => x.id !== b.id); break;
    default: return json({ error: 'unknown op' }, 400);
  }
  await kv.put('gear', JSON.stringify(g));
  return json(g);
}
