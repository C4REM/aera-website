/* AERA — serves pre-pro images uploaded through the portal. GET ?id=<32 hex>. */
export async function onRequest({ request, env }) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^[a-f0-9]{32}$/.test(id) || !env.PORTAL_KV) return new Response('Not found', { status: 404 });
  const { value, metadata } = await env.PORTAL_KV.getWithMetadata('img:' + id, 'arrayBuffer');
  if (!value) return new Response('Not found', { status: 404 });
  return new Response(value, { headers: { 'Content-Type': (metadata && metadata.type) || 'image/jpeg',
    'Cache-Control': 'public, max-age=31536000, immutable', 'X-Robots-Tag': 'noindex' } });
}
