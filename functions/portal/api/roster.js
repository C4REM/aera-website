/* ==========================================================================
   AERA — PORTAL DAY ROSTER API
   Behind /portal/, so _middleware.js has already rejected anyone not signed
   in by the time this runs.

   Two collections in one KV key:
     members — the people, in display order
     entries — one assignment per person per slot per day

   Entries are keyed logically by (date, memberId, slot) and UPSERTED on that
   triple rather than appended. A person can only be doing one thing in a given
   slot, so writing to an occupied cell should overwrite it, not silently
   create a second invisible entry underneath the first. That also means the
   UI never has to track ids for cells — it just says "this person, this slot,
   this day" and the server works out whether that's a create or an edit.
   ========================================================================== */

const KEY = 'roster';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow' }
  });

const SLOTS    = ['morning', 'midday', 'afternoon', 'evening'];
const STATUSES = ['Confirmed', 'Tentative', 'Off'];

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d);

/* Seeded with the two people who actually exist so the board isn't empty on
   first open. Anything added through the UI replaces this wholesale. */
const DEFAULT_MEMBERS = [
  { id: 'jack',  name: 'Jack',  role: 'Founder · Photo & Film' },
  { id: 'vance', name: 'Vance', role: 'Film · UAE' }
];

async function read(kv) {
  const raw = await kv.get(KEY);
  if (!raw) return { members: DEFAULT_MEMBERS, entries: [] };
  try {
    const p = JSON.parse(raw);
    return {
      members: Array.isArray(p.members) && p.members.length ? p.members : DEFAULT_MEMBERS,
      entries: Array.isArray(p.entries) ? p.entries : []
    };
  } catch {
    return { members: DEFAULT_MEMBERS, entries: [] };   // corrupt value shouldn't brick the board
  }
}

const save = (kv, data) => kv.put(KEY, JSON.stringify(data));

export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.PORTAL_KV;

  if (!kv) {
    return json({
      error: 'no-kv',
      message: 'KV namespace PORTAL_KV is not bound to this Pages project yet.'
    }, 501);
  }

  const method = request.method;
  if (method === 'GET') return json(await read(kv));

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Body must be JSON' }, 400); }

  const data = await read(kv);

  /* ---- replace the whole team list ---- */
  if (method === 'PUT' && Array.isArray(body.members)) {
    data.members = body.members
      .filter(m => str(m.name, 40))
      .slice(0, 20)                       // a studio roster, not a payroll system
      .map(m => ({
        id:   str(m.id, 40) || crypto.randomUUID(),
        name: str(m.name, 40),
        role: str(m.role, 60)
      }));
    // Drop assignments belonging to people who no longer exist, so removing
    // someone doesn't leave orphaned cells the UI can never show or clear.
    const ids = new Set(data.members.map(m => m.id));
    data.entries = data.entries.filter(e => ids.has(e.memberId));
    await save(kv, data);
    return json(data);
  }

  /* ---- write one cell ---- */
  if (method === 'POST') {
    const date     = str(body.date, 10);
    const memberId = str(body.memberId, 40);
    const slot     = str(body.slot, 20);

    if (!isDate(date))            return json({ error: 'date must be YYYY-MM-DD' }, 400);
    if (!SLOTS.includes(slot))    return json({ error: 'unknown slot' }, 400);
    if (!data.members.some(m => m.id === memberId))
      return json({ error: 'unknown member' }, 400);

    const entry = {
      id: crypto.randomUUID(),
      date, memberId, slot,
      title:  str(body.title, 80),
      detail: str(body.detail, 200),
      status: STATUSES.includes(body.status) ? body.status : 'Confirmed',
      updated: new Date().toISOString()
    };

    // upsert on the (date, member, slot) triple — see header note
    const i = data.entries.findIndex(e =>
      e.date === date && e.memberId === memberId && e.slot === slot);

    if (!entry.title && !entry.detail) {
      // an empty save is how the UI clears a cell
      if (i !== -1) data.entries.splice(i, 1);
    } else if (i === -1) {
      data.entries.push(entry);
    } else {
      entry.id = data.entries[i].id;
      data.entries[i] = entry;
    }

    await save(kv, data);
    return json(data);
  }

  if (method === 'DELETE') {
    const before = data.entries.length;
    data.entries = data.entries.filter(e => e.id !== str(body.id, 60));
    if (data.entries.length === before) return json({ error: 'No entry with that id' }, 404);
    await save(kv, data);
    return json(data);
  }

  return json({ error: `${method} not supported` }, 405);
}
