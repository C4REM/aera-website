/* ==========================================================================
   AERA — PRE-PRODUCTION (behind the portal password)
   One KV key per job: job:<id>:prepro. Brief, moodboard, storyboard (which is
   also the shot list), locations + recces, people & props, schedule and
   paperwork. Images live separately as img:<id> (see api/img.js).
   GET  ?job=<id>               -> { job, prepro, sheet }
   PUT  { job, data }           -> saves the whole doc (cleaned)
   POST { job, action:'crew' }  -> makes (or returns) the crew pack key
   POST { job, action:'uncrew'} -> turns the crew pack link off
   ========================================================================== */
const json = (d, s = 200) => new Response(JSON.stringify(d), {
  status: s, headers: { 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' }
});
const str = (v, n) => String(v ?? '').slice(0, n);
const arr = (v, n) => (Array.isArray(v) ? v : []).slice(0, n);
const id = v => (/^[\w-]{6,60}$/.test(String(v || '')) ? String(v) : crypto.randomUUID());
const img = v => (/^[a-f0-9]{32}$/.test(String(v || '')) ? String(v) : '');
const url = v => { const s = str(v, 500).trim(); return /^https?:\/\//i.test(s) ? s : ''; };
const pick = (v, list, d) => (list.includes(v) ? v : d);
const newKey = () => [...crypto.getRandomValues(new Uint8Array(18))].map(b => b.toString(16).padStart(2, '0')).join('');
async function get(kv, k, fb = null) { const r = await kv.get(k); if (!r) return fb; try { return JSON.parse(r); } catch { return fb; } }

export const PAPER = ['Location release', 'Talent releases', 'Risk check', 'Filming permission (public places)', 'Insurance in place', 'Music cleared for socials'];

export function clean(b = {}, old = {}) {
  const br = b.brief || {};
  const lines = (v, n, m) => arr(v, n).map(x => ({ text: str(x && x.text, m), done: !!(x && x.done) })).filter(x => x.text.trim());
  return {
    brief: { purpose: str(br.purpose, 800), audience: str(br.audience, 400), feel: str(br.feel, 400), must: str(br.must, 600),
      avoid: str(br.avoid, 400), deliverables: str(br.deliverables, 600), due: str(br.due, 200), agreed: !!br.agreed },
    aspect: pick(b.aspect, ['16:9', '9:16', '4:5', '1:1', '2.39:1'], '16:9'),
    frames: arr(b.frames, 80).map(f => ({ id: id(f.id), img: img(f.img), size: str(f.size, 60), angle: str(f.angle, 40), move: str(f.move, 60),
      lens: str(f.lens, 20), cam: str(f.cam, 12), when: str(f.when, 40), desc: str(f.desc, 400), audio: str(f.audio, 300), graphics: str(f.graphics, 300), transition: str(f.transition, 80), must: !!f.must, got: !!f.got })),
    mood: arr(b.mood, 120).map(m => ({ id: id(m.id), img: img(m.img), url: url(m.url), tag: str(m.tag, 20), note: str(m.note, 300), shot: str(m.shot, 60), by: str(m.by, 40), main: !!m.main }))
      .filter(m => m.img || m.url),
    locations: arr(b.locations, 12).map(l => ({ id: id(l.id), name: str(l.name, 80), role: pick(l.role, ['Main', 'Backup', 'Shortlist'], 'Shortlist'),
      status: pick(l.status, ['Idea', 'Recce booked', 'Recced', 'Booked'], 'Idea'), address: str(l.address, 200), contact: str(l.contact, 160),
      recce: str(l.recce, 120), photos: arr(l.photos, 16).map(img).filter(Boolean),
      access: str(l.access, 800), light: str(l.light, 800), power: str(l.power, 800), sound: str(l.sound, 800), site: str(l.site, 800), permission: str(l.permission, 800),
      problems: lines(l.problems, 20, 200) })),
    people: arr(b.people, 40).map(p => ({ name: str(p.name, 60), role: str(p.role, 60), contact: str(p.contact, 120), notes: str(p.notes, 200) })).filter(p => p.name.trim()),
    props: lines(b.props, 60, 160),
    date: /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : '',
    schedule: arr(b.schedule, 60).map(s => ({ time: str(s.time, 10), what: str(s.what, 160), who: str(s.who, 80) })).filter(s => s.time || s.what),
    paper: arr(b.paper, 30).map(p => ({ text: str(p.text, 120), status: pick(p.status, ['To do', 'Sent', 'Done', 'Not needed'], 'To do'), url: url(p.url), note: str(p.note, 200), formId: str(p.formId, 60) }))
      .filter(p => p.text.trim()),
    // Paperwork templates. Signatures are only ever written by api/sign.js,
    // so they're carried over from the stored copy, never from the page.
    forms: arr(b.forms, 30).map(f => { const o = (old.forms || []).find(x => x.id === f.id) || {};
      const fl = {}; Object.entries(f.fields || {}).slice(0, 30).forEach(([k, v]) => { if (/^\w{1,20}$/.test(k)) fl[k] = str(v, 600); });
      return { id: id(f.id), type: pick(f.type, ['talent', 'location', 'risk', 'music'], 'talent'), title: str(f.title, 80), fields: fl,
        uses: arr(f.uses, 8).map(u => str(u, 60)), rows: arr(f.rows, 30).map(r => ({ hazard: str(r.hazard, 160), who: str(r.who, 120), control: str(r.control, 300), level: pick(r.level, ['Low', 'Medium', 'High'], 'Low') })),
        key: o.key || '', sig: o.sig || null }; }),
    crewKey: old.crewKey || '',
    updated: new Date().toISOString()
  };
}

export async function onRequest({ request, env }) {
  const kv = env.PORTAL_KV;
  if (!kv) return json({ error: 'no-kv' }, 501);
  const u = new URL(request.url);
  if (request.method === 'GET') {
    const job = str(u.searchParams.get('job'), 60);
    const j = (await get(kv, 'jobs', [])).find(x => x.id === job);
    if (!j) return json({ error: 'No such job' }, 404);
    const [prepro, sheet] = await Promise.all([get(kv, `job:${job}:prepro`), get(kv, `job:${job}:sheet`)]);
    return json({ job: j, prepro: prepro || clean({ paper: PAPER.map(text => ({ text })) }), sheet, isNew: !prepro });
  }
  let b; try { b = await request.json(); } catch { return json({ error: 'Body must be JSON' }, 400); }
  const job = str(b.job, 60); if (!job) return json({ error: 'job required' }, 400);
  const k = `job:${job}:prepro`;
  const old = await get(kv, k, {});
  if (request.method === 'PUT') {
    const next = clean(b.data || {}, old);
    await kv.put(k, JSON.stringify(next));
    return json({ ok: true, updated: next.updated });
  }
  if (request.method === 'POST' && b.action === 'crew') {
    const doc = old.brief ? old : clean({ paper: PAPER.map(text => ({ text })) });
    if (!doc.crewKey) { doc.crewKey = newKey(); await kv.put(`pub:${doc.crewKey}`, JSON.stringify({ kind: 'crew', jobId: job })); await kv.put(k, JSON.stringify(doc)); }
    return json({ key: doc.crewKey });
  }
  if (request.method === 'POST' && b.action === 'formlink') {
    const f = (old.forms || []).find(x => x.id === b.form);
    if (!f) return json({ error: 'Save the form first' }, 404);
    if (!f.key) { f.key = newKey(); await kv.put(`pub:${f.key}`, JSON.stringify({ kind: 'form', jobId: job, formId: f.id })); await kv.put(k, JSON.stringify(old)); }
    return json({ key: f.key });
  }
  if (request.method === 'POST' && b.action === 'uncrew' && old.crewKey) {
    await kv.delete(`pub:${old.crewKey}`); old.crewKey = ''; await kv.put(k, JSON.stringify(old));
    return json({ ok: true });
  }
  return json({ error: 'Not supported' }, 405);
}
