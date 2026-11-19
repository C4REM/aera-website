/* AERA — image upload for pre-pro boards (behind the portal password).
   POST raw bytes (image/jpeg|png|webp, <= 4 MB) -> { id }. The page shrinks
   photos to 1600px before sending. Served publicly by /api/img?id=<id>: the
   id is 32 random hex characters, so an image is only reachable by its link. */
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export async function onRequest({ request, env }) {
  const kv = env.PORTAL_KV;
  if (!kv) return json({ error: 'no-kv' }, 501);
  if (request.method !== 'POST') return json({ error: 'Not supported' }, 405);
  const type = (request.headers.get('Content-Type') || '').split(';')[0].trim();
  if (!TYPES.includes(type)) return json({ error: 'Images only (JPG, PNG, WebP)' }, 415);
  const buf = await request.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > 4 * 1024 * 1024) return json({ error: 'Image too big (4 MB max)' }, 413);
  const id = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  await kv.put('img:' + id, buf, { metadata: { type } });
  return json({ id });
}
