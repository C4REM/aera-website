/* AERA — crew pack (public, key-protected). GET with X-Key -> the job's
   pre-pro, read only. Paperwork and internal notes on the client are left out. */
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } });
async function get(kv, k, fb = null) { const r = await kv.get(k); if (!r) return fb; try { return JSON.parse(r); } catch { return fb; } }
export async function onRequest({ request, env }) {
  const kv = env.PORTAL_KV;
  const key = String(request.headers.get('X-Key') || '');
  if (!kv || !/^[a-f0-9]{36}$/.test(key)) return json({ error: 'Not found' }, 404);
  const pub = await get(kv, 'pub:' + key);
  if (!pub || pub.kind !== 'crew') return json({ error: 'Not found' }, 404);
  const j = (await get(kv, 'jobs', [])).find(x => x.id === pub.jobId);
  const p = await get(kv, `job:${pub.jobId}:prepro`);
  if (!j || !p) return json({ error: 'Not found' }, 404);
  const { paper, crewKey, ...rest } = p;
  return json({ job: { client: j.client, type: j.type, date: j.date, team: j.assignee }, prepro: rest });
}
