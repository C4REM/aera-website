/* AERA — sign a paperwork form (public, key-protected).
   GET  (X-Key) -> { job, form }
   POST (X-Key) { name, guardian, sig: data:image/png, agree } -> records the
   signature with the time, IP and browser, and marks the paperwork item Done. */
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } });
async function get(kv, k, fb = null) { const r = await kv.get(k); if (!r) return fb; try { return JSON.parse(r); } catch { return fb; } }
const str = (v, n) => String(v ?? '').trim().slice(0, n);
export async function onRequest({ request, env }) {
  const kv = env.PORTAL_KV;
  const key = String(request.headers.get('X-Key') || '');
  if (!kv || !/^[a-f0-9]{36}$/.test(key)) return json({ error: 'Not found' }, 404);
  const pub = await get(kv, 'pub:' + key);
  if (!pub || pub.kind !== 'form') return json({ error: 'Not found' }, 404);
  const pk = `job:${pub.jobId}:prepro`, doc = await get(kv, pk);
  const form = doc && (doc.forms || []).find(f => f.id === pub.formId);
  const j = (await get(kv, 'jobs', [])).find(x => x.id === pub.jobId);
  if (!form || !j) return json({ error: 'Not found' }, 404);
  const { key: _k, ...safe } = form;
  if (request.method === 'GET') return json({ job: { client: j.client, type: j.type }, form: safe });
  if (request.method !== 'POST') return json({ error: 'Not supported' }, 405);
  if (form.sig) return json({ error: 'This has already been signed.', form: safe }, 409);
  let b; try { b = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const name = str(b.name, 80), sig = String(b.sig || '');
  if (name.length < 2) return json({ error: 'Please type your full name.' }, 400);
  if (!b.agree) return json({ error: 'Please tick to agree.' }, 400);
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(sig) || sig.length > 120000) return json({ error: 'Please sign in the box.' }, 400);
  form.sig = { name, guardian: str(b.guardian, 80), img: sig, at: new Date().toISOString(),
    ip: str(request.headers.get('CF-Connecting-IP'), 64), agent: str(request.headers.get('User-Agent'), 200) };
  (doc.paper || []).forEach(p => { if (p.formId === form.id) p.status = 'Done'; });
  await kv.put(pk, JSON.stringify(doc));
  const { key: _k2, ...out } = form;
  return json({ ok: true, form: out });
}
