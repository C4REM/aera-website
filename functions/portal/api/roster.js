/* ==========================================================================
   AERA — PORTAL WEEK PLANNER API
   Behind /portal/, so _middleware.js has already rejected anyone not signed
   in by the time this runs.

   Shape (one KV key):
     members — the people, in row order, each with a daily capacity in hours
     tasks   — many per person per day; what they're on and for how long
     off     — "date|memberId" markers for days someone isn't working

   Tasks are a flat list rather than nested under member/day. The board reads
   the whole week at once and filters in the browser, and a flat list means
   moving a task to another person or day is a field edit rather than a
   restructure. At studio scale (a handful of people, a few tasks a day) the
   filtering cost is nil.

   Every write returns the full document, so the browser never has to merge —
   it just replaces its state with whatever the server now says is true. That
   removes a whole class of bug where two people editing at once leave one of
   them looking at a board that never actually existed.
   ========================================================================== */

const KEY = 'planner';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow' }
  });

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d);

/* Hours: quarter-hour steps, capped at a genuinely long day. Stored as a
   number so totals add up without float surprises from string maths. */
function hours(v, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(24, Math.round(n * 4) / 4);
}

const DEFAULT_MEMBERS = [
  { id: 'jack',  name: 'Jack Careem',  role: 'Founder · Photo & Film', capacity: 8 },
  { id: 'vance', name: 'Vance Serania', role: 'Film · UAE',            capacity: 8 }
];

async function read(kv) {
  const raw = await kv.get(KEY);
  const empty = { members: DEFAULT_MEMBERS, tasks: [], off: [] };
  if (!raw) return empty;
  try {
    const p = JSON.parse(raw);
    return {
      members: Array.isArray(p.members) && p.members.length ? p.members : DEFAULT_MEMBERS,
      tasks:   Array.isArray(p.tasks) ? p.tasks : [],
      off:     Array.isArray(p.off)   ? p.off   : []
    };
  } catch {
    return empty;   // a corrupt value shouldn't brick the board
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

  if (request.method === 'GET') return json(await read(kv));
  if (request.method !== 'POST') return json({ error: `${request.method} not supported` }, 405);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Body must be JSON' }, 400); }

  const data = await read(kv);
  const known = id => data.members.some(m => m.id === id);

  switch (body.op) {

    /* ---- replace the whole team ---- */
    case 'team.save': {
      if (!Array.isArray(body.members)) return json({ error: 'members must be an array' }, 400);
      data.members = body.members
        .filter(m => str(m.name, 40))
        .slice(0, 24)
        .map(m => ({
          id:       str(m.id, 40) || crypto.randomUUID(),
          name:     str(m.name, 40),
          role:     str(m.role, 60),
          capacity: hours(m.capacity, 8) || 8
        }));
      // Drop work belonging to people who no longer exist, so removing someone
      // doesn't leave orphaned tasks the board can never show or clear.
      const ids = new Set(data.members.map(m => m.id));
      data.tasks = data.tasks.filter(t => ids.has(t.memberId));
      data.off   = data.off.filter(k => ids.has(String(k).split('|')[1]));
      break;
    }

    /* ---- add a task ---- */
    case 'task.add': {
      const date = str(body.date, 10);
      if (!isDate(date))          return json({ error: 'date must be YYYY-MM-DD' }, 400);
      if (!known(body.memberId))  return json({ error: 'unknown member' }, 400);
      const client = str(body.client, 60);
      const task   = str(body.task, 60);
      if (!client && !task)       return json({ error: 'needs a client or a task' }, 400);

      data.tasks.push({
        id: crypto.randomUUID(),
        date,
        memberId: str(body.memberId, 40),
        client, task,
        hours: hours(body.hours, 0),
        updated: new Date().toISOString()
      });
      break;
    }

    /* ---- edit a task (including moving it to another day or person) ---- */
    case 'task.update': {
      const i = data.tasks.findIndex(t => t.id === str(body.id, 60));
      if (i === -1) return json({ error: 'no task with that id' }, 404);
      const t = data.tasks[i];

      if (body.date !== undefined) {
        if (!isDate(str(body.date, 10))) return json({ error: 'bad date' }, 400);
        t.date = str(body.date, 10);
      }
      if (body.memberId !== undefined) {
        if (!known(body.memberId)) return json({ error: 'unknown member' }, 400);
        t.memberId = str(body.memberId, 40);
      }
      if (body.client !== undefined) t.client = str(body.client, 60);
      if (body.task   !== undefined) t.task   = str(body.task, 60);
      if (body.hours  !== undefined) t.hours  = hours(body.hours, t.hours);
      t.updated = new Date().toISOString();

      if (!t.client && !t.task) data.tasks.splice(i, 1);   // emptied = removed
      break;
    }

    case 'task.delete': {
      const before = data.tasks.length;
      data.tasks = data.tasks.filter(t => t.id !== str(body.id, 60));
      if (data.tasks.length === before) return json({ error: 'no task with that id' }, 404);
      break;
    }

    /* ---- mark a person off for a day, or back on ---- */
    case 'off.toggle': {
      const date = str(body.date, 10);
      if (!isDate(date))         return json({ error: 'bad date' }, 400);
      if (!known(body.memberId)) return json({ error: 'unknown member' }, 400);
      const key = `${date}|${str(body.memberId, 40)}`;
      data.off = data.off.includes(key)
        ? data.off.filter(k => k !== key)
        : [...data.off, key];
      break;
    }

    default:
      return json({ error: 'unknown op' }, 400);
  }

  await save(kv, data);
  return json(data);
}
