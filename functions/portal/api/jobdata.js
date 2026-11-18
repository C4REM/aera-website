/* ==========================================================================
   AERA — PER-JOB DATA (behind the portal password)
   Each job can have three extra parts, each in its own KV key so they never
   overwrite each other or the jobs list:
     job:<id>:proposal   what the client is offered, and their acceptance
     job:<id>:sheet      the shoot day sheet the crew sees
     job:<id>:review     deliverables the client reviews and approves
   A proposal or review can get a public link: pub:<key> -> { kind, jobId }.
   The repo is public, so none of this content is ever in code.

   GET  ?job=<id>            -> { proposal, sheet, review }
   GET  ?summary=1           -> { jobs: { <id>: { proposal: {...short}, review: {...short} } } }
   PUT  { job, part, data }  -> saves that part (cleaned)
   POST { job, part, action: 'link' } -> makes (or returns) the public key
   ========================================================================== */

const json = (d, s = 200) => new Response(JSON.stringify(d), {
  status: s, headers: { 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' }
});
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const num = (v, d = 0) => { const n = Number(String(v ?? '').replace(/[£,\s]/g, '')); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : d; };
const url = v => { const s = str(v, 500); return /^https:\/\//i.test(s) ? s : ''; };
const date = v => { const s = str(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; };
const id = v => str(v, 60) || crypto.randomUUID();
const newKey = () => [...crypto.getRandomValues(new Uint8Array(18))].map(b => b.toString(16).padStart(2, '0')).join('');
const PARTS = ['proposal', 'sheet', 'review'];

async function get(kv, k, fb = null) {
  const raw = await kv.get(k);
  if (!raw) return fb;
  try { return JSON.parse(raw); } catch { return fb; }
}

/* ---- cleaners: keep only known fields; anything the client controls is
   never touched here (acceptance, client comments are written by api/client) ---- */
function cleanProposal(b, old = {}) {
  return {
    key: old.key || '',
    title: str(b.title, 120),
    intro: str(b.intro, 1200),
    contactName: str(b.contactName, 80),
    base: { name: str(b.base && b.base.name, 100), desc: str(b.base && b.base.desc, 300), price: num(b.base && b.base.price) },
    addons: (Array.isArray(b.addons) ? b.addons : []).slice(0, 12).map(a => ({
      id: id(a.id), name: str(a.name, 100), desc: str(a.desc, 300), price: num(a.price), preselect: !!a.preselect
    })).filter(a => a.name),
    depositPct: Math.min(100, Math.max(0, Math.round(num(b.depositPct, 30)))),
    terms: (Array.isArray(b.terms) ? b.terms : String(b.terms || '').split('\n')).map(t => str(t, 400)).filter(Boolean).slice(0, 12),
    agreementUrl: url(b.agreementUrl),
    payUrl: url(b.payUrl),
    validUntil: date(b.validUntil),
    issued: date(b.issued) || old.issued || new Date().toISOString().slice(0, 10),
    ref: str(b.ref, 30),
    // set by the client page / by Jack's "mark paid" buttons
    status: old.status || 'draft',
    viewedAt: old.viewedAt || '',
    accepted: old.accepted || null,
    depositPaid: b.depositPaid !== undefined ? !!b.depositPaid : !!old.depositPaid,
    balancePaid: b.balancePaid !== undefined ? !!b.balancePaid : !!old.balancePaid,
    updated: new Date().toISOString()
  };
}

function cleanSheet(b, old = {}) {
  const list = (arr, n) => (Array.isArray(arr) ? arr : []).slice(0, n);
  return {
    date: date(b.date), call: str(b.call, 20), start: str(b.start, 20), end: str(b.end, 20),
    venue: str(b.venue, 120), address: str(b.address, 200), access: str(b.access, 200),
    contact: str(b.contact, 120),
    crew: list(b.crew, 12).map(c => ({ name: str(c.name, 60), role: str(c.role, 80) })).filter(c => c.name),
    kit: list(b.kit, 40).map(k => ({ text: str(k.text, 120), done: !!k.done })).filter(k => k.text),
    shots: list(b.shots, 60).map(s => ({ text: str(s.text, 200) })).filter(s => s.text),
    notes: str(b.notes, 1500),
    venueOk: !!b.venueOk,
    seen: old.seen || {},
    updated: new Date().toISOString()
  };
}

function cleanReview(b, old = {}) {
  const prev = new Map((old.items || []).map(i => [i.id, i]));
  return {
    key: old.key || '',
    title: str(b.title, 120),
    items: (Array.isArray(b.items) ? b.items : []).slice(0, 60).map(i => {
      const p = prev.get(i.id) || {};
      const changedMedia = p.url && p.url !== url(i.url);
      return {
        id: id(i.id), title: str(i.title, 120), kind: str(i.kind, 30), when: str(i.when, 40),
        url: url(i.url),
        version: changedMedia ? (p.version || 1) + 1 : (p.version || 1),
        // a new version goes back to waiting for the client
        status: changedMedia ? 'waiting' : (p.status || 'waiting'),
        comments: p.comments || []
      };
    }).filter(i => i.title),
    // Jack's replies are added with action 'reply'
    updated: new Date().toISOString()
  };
}

export async function onRequest({ request, env }) {
  const kv = env.PORTAL_KV;
  if (!kv) return json({ error: 'no-kv' }, 501);
  const u = new URL(request.url);

  if (request.method === 'GET') {
    if (u.searchParams.get('summary')) {
      const out = {};
      let cursor;
      do {
        const page = await kv.list({ prefix: 'job:', cursor });
        for (const k of page.keys) {
          const m = k.name.match(/^job:(.+):(proposal|review)$/); if (!m) continue;
          const v = await get(kv, k.name); if (!v) continue;
          const o = out[m[1]] = out[m[1]] || {};
          if (m[2] === 'proposal') {
            const total = v.accepted ? v.accepted.total : (v.base ? v.base.price : 0) + (v.addons || []).filter(a => a.preselect).reduce((s, a) => s + a.price, 0);
            o.proposal = { status: v.status, total, deposit: v.accepted ? v.accepted.deposit : Math.round(total * (v.depositPct || 0) / 100),
              acceptedAt: v.accepted ? v.accepted.at : '', depositPaid: !!v.depositPaid, balancePaid: !!v.balancePaid };
          } else {
            const items = v.items || [];
            o.review = { total: items.length, approved: items.filter(i => i.status === 'approved').length, changes: items.filter(i => i.status === 'changes').length };
          }
        }
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor);
      return json({ jobs: out });
    }
    const job = str(u.searchParams.get('job'), 60);
    if (!job) return json({ error: 'job required' }, 400);
    const [proposal, sheet, review] = await Promise.all(PARTS.map(p => get(kv, `job:${job}:${p}`)));
    return json({ proposal, sheet, review });
  }

  let b; try { b = await request.json(); } catch { return json({ error: 'Body must be JSON' }, 400); }
  const job = str(b.job, 60), part = str(b.part, 20);
  if (!job || !PARTS.includes(part)) return json({ error: 'job and part required' }, 400);
  const k = `job:${job}:${part}`;
  const old = await get(kv, k, {});

  if (request.method === 'PUT') {
    const data = b.data || {};
    let next;
    if (part === 'proposal') next = cleanProposal(data, old);
    else if (part === 'sheet') next = cleanSheet(data, old);
    else next = cleanReview(data, old);
    await kv.put(k, JSON.stringify(next));
    return json({ [part]: next });
  }

  if (request.method === 'POST') {
    if (b.action === 'link' && (part === 'proposal' || part === 'review')) {
      if (!old.key) {
        old.key = newKey();
        if (part === 'proposal' && (!old.status || old.status === 'draft')) old.status = 'sent';
        await kv.put(`pub:${old.key}`, JSON.stringify({ kind: part, jobId: job }));
        await kv.put(k, JSON.stringify(old));
      }
      return json({ key: old.key, [part]: old });
    }
    if (b.action === 'reply' && part === 'review') {
      const it = (old.items || []).find(i => i.id === b.item);
      if (!it) return json({ error: 'no such item' }, 404);
      it.comments = (it.comments || []).concat({ id: crypto.randomUUID(), who: str(b.who, 40) || 'Aera', team: true, at: str(b.at, 12), text: str(b.text, 1000), ts: new Date().toISOString() }).slice(-100);
      await kv.put(k, JSON.stringify(old));
      return json({ review: old });
    }
    if (b.action === 'seen' && part === 'sheet') {
      old.seen = old.seen || {}; old.seen[str(b.member, 40)] = new Date().toISOString();
      await kv.put(k, JSON.stringify(old));
      return json({ sheet: old });
    }
    if (b.action === 'unlink' && (part === 'proposal' || part === 'review') && old.key) {
      await kv.delete(`pub:${old.key}`);
      old.key = '';
      await kv.put(k, JSON.stringify(old));
      return json({ [part]: old });
    }
    return json({ error: 'unknown action' }, 400);
  }
  return json({ error: 'Not supported' }, 405);
}
