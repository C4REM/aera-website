/* ==========================================================================
   AERA MAILER — a tiny Cloudflare Worker that emails Jack.
   Only callable through a service binding from the aera-website Pages project
   (there is no public route), so nobody else can make it send anything.

   Setup (Cloudflare dashboard, account that owns aerastudios.org):
   1. Workers & Pages → Create → Worker → name it "aera-mailer" → paste this file → Deploy.
   2. aera-mailer → Settings → Domains & Routes → turn OFF the workers.dev route.
   3. aera-mailer → Settings → Bindings → Add → Send email:
        variable name EMAIL, destination address jackcareem@icloud.com
      (must be a verified destination in Email Routing; it already is).
   4. Pages → aera-website → Settings → Bindings → Add → Service binding:
        variable name MAILER, service aera-mailer → then redeploy the site.
   ========================================================================== */
import { EmailMessage } from 'cloudflare:email';

const FROM = 'portal@aerastudios.org';
const TO = 'jackcareem@icloud.com';
const b64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const clean = (s, n) => String(s || '').replace(/[\r\n]+/g, ' ').slice(0, n);

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('no', { status: 405 });
    let b; try { b = await request.json(); } catch { return new Response('bad', { status: 400 }); }
    const subject = clean(b.subject, 160), text = String(b.text || '').slice(0, 5000);
    const replyTo = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(b.replyTo || '') ? b.replyTo : '';
    const head = [
      `From: Aera Portal <${FROM}>`,
      `To: ${TO}`,
      ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
      `Subject: =?UTF-8?B?${b64(subject)}?=`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@aerastudios.org>`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64'
    ];
    const raw = head.join('\r\n') + '\r\n\r\n' + b64(text).replace(/.{76}/g, '$&\r\n');
    await env.EMAIL.send(new EmailMessage(FROM, TO, raw));
    return new Response('sent');
  }
};
