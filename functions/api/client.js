/* ==========================================================================
   AERA — CLIENT LINKS (public, key-protected)
   Used by /p/ (proposal) and /r/ (review). The page sends the long random key
   from its link in the X-Key header; the key maps to one job's proposal or
   review via pub:<key>. Clients never need a password.

   Proposal: GET shows it (and marks it viewed); POST {action:'accept'} records
   the typed-name acceptance, works out the total on the server, and moves the
   job to Confirmed with that fee.
   Review: GET lists items; POST {action:'comment'|'changes'|'approve'}.
   When every item is approved the job moves to Delivered.
   ========================================================================== */

const json = (d, s = 200) => new Response(JSON.stringify(d), {
  status: s, headers: { 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' }
});
const str = (v, n) => String(v ?? '').trim().slice(0, n);
async function get(kv, k, fb = null) { const r = await kv.get(k); if (!r) return fb; try { return JSON.parse(r); } catch { return fb; } }

async function updateJob(kv, jobId, patch) {
  const jobs = await get(kv, 'jobs', []);
  const j = jobs.find(x => x.id === jobId); if (!j) return null;
  Object.assign(j, patch, { updated: new Date().toISOString() });
  await kv.put('jobs', JSON.stringify(jobs));
  return j;
}

export async function onRequest({ request, env }) {
  const kv = env.PORTAL_KV;
  if (!kv) return json({ error: 'unavailable' }, 503);
  const key = str(request.headers.get('X-Key'), 40);
  if (!/^[a-f0-9]{36}$/.test(key)) return json({ error: 'Not found' }, 404);
  const pub = await get(kv, 'pub:' + key);
  if (!pub) return json({ error: 'Not found' }, 404);
  const k = `job:${pub.jobId}:${pub.kind}`;
  const doc = await get(kv, k);
  if (!doc || doc.key !== key) return json({ error: 'Not found' }, 404);
  const jobs = await get(kv, 'jobs', []);
  const job = jobs.find(j => j.id === pub.jobId) || {};

  /* ---------------- proposal ---------------- */
  if (pub.kind === 'proposal') {
    if (request.method === 'GET') {
      if (doc.status === 'sent') { doc.status = 'viewed'; doc.viewedAt = new Date().toISOString(); await kv.put(k, JSON.stringify(doc)); }
      const { key: _k, ...view } = doc;
      return json({ kind: 'proposal', client: job.client || '', proposal: view });
    }
    if (request.method === 'POST') {
      let b; try { b = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
      if (b.action !== 'accept') return json({ error: 'Unknown action' }, 400);
      if (doc.accepted) return json({ error: 'This proposal has already been accepted.', accepted: doc.accepted, payUrl: doc.payUrl || '' }, 409);
      if (doc.validUntil && doc.validUntil < new Date().toISOString().slice(0, 10)) return json({ error: 'This proposal has expired. Please ask Aera for an updated one.' }, 410);
      const name = str(b.name, 80);
      if (name.length < 2 || !b.agree) return json({ error: 'Please type your full name and tick the box to agree.' }, 400);
      const picked = (doc.addons || []).filter(a => (b.picked || []).includes(a.id));
      const total = Math.round(((doc.base ? doc.base.price : 0) + picked.reduce((s, a) => s + a.price, 0)) * 100) / 100;
      const deposit = Math.round(total * (doc.depositPct || 0) / 100 * 100) / 100;
      doc.accepted = {
        name, for: str(b.for, 80) || job.client || '', at: new Date().toISOString(),
        items: [doc.base && doc.base.name, ...picked.map(a => a.name)].filter(Boolean),
        picked: picked.map(a => a.id), total, deposit,
        ip: str(request.headers.get('CF-Connecting-IP'), 64), agent: str(request.headers.get('User-Agent'), 200)
      };
      doc.status = 'accepted';
      await kv.put(k, JSON.stringify(doc));
      await updateJob(kv, pub.jobId, { status: job.status === 'Enquiry' || !job.status ? 'Confirmed' : job.status, fee: '£' + total });
      return json({ accepted: doc.accepted, payUrl: doc.payUrl || '' });
    }
  }

  /* ---------------- review ---------------- */
  if (pub.kind === 'review') {
    if (request.method === 'GET') {
      const { key: _k, ...view } = doc;
      return json({ kind: 'review', client: job.client || '', review: view });
    }
    if (request.method === 'POST') {
      let b; try { b = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
      const it = (doc.items || []).find(i => i.id === b.item);
      if (!it) return json({ error: 'No such item' }, 404);
      if (b.action === 'comment' || b.action === 'changes') {
        const text = str(b.text, 1000);
        if (!text && b.action === 'comment') return json({ error: 'Write a comment first.' }, 400);
        if ((it.comments || []).length >= 200) return json({ error: 'Too many comments on this item.' }, 429);
        if (text) it.comments = (it.comments || []).concat({ id: crypto.randomUUID(), who: str(b.who, 40) || job.client || 'Client', at: str(b.at, 12), text, ts: new Date().toISOString() });
        if (b.action === 'changes') it.status = 'changes';
      } else if (b.action === 'approve') {
        it.status = b.undo ? 'waiting' : 'approved';
      } else return json({ error: 'Unknown action' }, 400);
      await kv.put(k, JSON.stringify(doc));
      const items = doc.items || [];
      if (items.length && items.every(i => i.status === 'approved')) await updateJob(kv, pub.jobId, { status: 'Delivered' });
      const { key: _k, ...view } = doc;
      return json({ review: view });
    }
  }
  return json({ error: 'Not supported' }, 405);
}
