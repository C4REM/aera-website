/* ==========================================================================
   AERA — PORTAL JOB TRACKER API
   Sits at /portal/api/jobs, which means it is BEHIND _middleware.js in the
   parent folder — an unauthenticated request never reaches this code, it gets
   a 401 from the gate first. That's the whole reason the API lives under
   /portal/ rather than at /api/.

   Storage is a single Cloudflare KV key holding the whole job list as JSON.
   One key rather than a key per job because the list is small (tens of jobs,
   not thousands) and reading it whole means the board renders in one request
   with no pagination and no consistency puzzles. Revisit this only if the
   list gets big enough to feel slow, which for a studio's live jobs it won't.

   Needs a KV namespace bound as PORTAL_KV in the Pages project settings. If
   it isn't bound the endpoint says so plainly instead of throwing, and the
   portal falls back to read-only with an explanatory banner.
   ========================================================================== */

const KEY = 'jobs';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow' }
  });

const STATUSES = ['Enquiry', 'Confirmed', 'Shot', 'Editing', 'Delivered'];

/* Trim and cap every field. Only Jack and the team can reach this endpoint, so
   this isn't defending against attackers so much as against a stray paste of
   half a document into the notes box bloating the KV value. */
function clean(body, existing = {}) {
  const str = (v, max) => String(v ?? '').trim().slice(0, max);
  const status = STATUSES.includes(body.status) ? body.status : (existing.status || 'Enquiry');
  return {
    id:       existing.id || crypto.randomUUID(),
    client:   str(body.client   ?? existing.client,   80),
    type:     str(body.type     ?? existing.type,     40),
    date:     str(body.date     ?? existing.date,     10),   // YYYY-MM-DD
    assignee: str(body.assignee ?? existing.assignee, 40),
    fee:      str(body.fee      ?? existing.fee,      12),
    notes:    str(body.notes    ?? existing.notes,    600),
    status,
    updated:  new Date().toISOString()
  };
}

async function readJobs(kv) {
  const raw = await kv.get(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];   // corrupt value shouldn't take the whole portal down
  }
}

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

  if (method === 'GET') {
    return json({ jobs: await readJobs(kv) });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }

  const jobs = await readJobs(kv);

  if (method === 'POST') {
    if (!String(body.client || '').trim()) {
      return json({ error: 'Client name is required' }, 400);
    }
    jobs.unshift(clean(body));
    await kv.put(KEY, JSON.stringify(jobs));
    return json({ jobs });
  }

  if (method === 'PUT') {
    const i = jobs.findIndex(j => j.id === body.id);
    if (i === -1) return json({ error: 'No job with that id' }, 404);
    jobs[i] = clean(body, jobs[i]);
    await kv.put(KEY, JSON.stringify(jobs));
    return json({ jobs });
  }

  if (method === 'DELETE') {
    const remaining = jobs.filter(j => j.id !== body.id);
    if (remaining.length === jobs.length) return json({ error: 'No job with that id' }, 404);
    await kv.put(KEY, JSON.stringify(remaining));
    return json({ jobs: remaining });
  }

  return json({ error: `${method} not supported` }, 405);
}
