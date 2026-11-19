/* Aera paperwork templates, shared by the pre-pro page (filling in) and
   /sign/ (the other person signing). Plain English. Not legal advice: worth
   having a solicitor look over the wording once before relying on it. */
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const v = (f, k, ph) => { const x = String((f.fields || {})[k] || '').trim(); return x ? `<b>${esc(x)}</b>` : `<span class="blank">${esc(ph || '________')}</span>`; };
  const USES = ["The client's own channels", 'Aera portfolio and website', 'Aera social media', 'Paid adverts'];
  const LICENCES = ['Royalty-free library', 'Sync licence from the rights holder', 'Written permission from the artist', 'Original music made for us'];
  const RISK_ROWS = [
    ['Trailing cables', 'Crew, talent, public', 'Tape down or run along walls; cable mats across walkways'],
    ['Light stands tipping', 'Everyone nearby', 'Sandbag every stand; keep them out of walkways'],
    ['Hot lamps', 'Crew', 'Gloves; let lamps cool before moving'],
    ['Haze or smoke', 'Everyone', 'Check the venue allows it; cover or isolate alarms with permission; ventilate'],
    ['Lifting heavy kit', 'Crew', 'Two-person lifts; use trolleys and cases'],
    ['Electrics', 'Everyone', 'Kit PAT tested; no overloaded sockets; RCD on extension leads'],
    ['Public and passers-by', 'Public', 'Keep walkways clear; a crew member watches the frame edges'],
    ['Late finish and travel', 'Crew, talent', 'Arrange lifts or taxis; nobody travels alone late']
  ];
  const defs = {
    talent: {
      title: 'Talent release', sign: true, signer: 'The person filmed',
      fields: [['name', 'Full name of the person filmed'], ['contact', 'Their phone or email'], ['project', 'Project'], ['dates', 'Shoot date(s)'], ['location', 'Where'], ['fee', 'Payment', 'e.g. None, or £50']],
      body: f => `<p>I, ${v(f, 'name', 'full name')}, agree that Aera Studios (“Aera”) and its client may film, photograph and record me for ${v(f, 'project')} on ${v(f, 'dates')} at ${v(f, 'location')}.</p>
        <p>I give permission for the footage, photographs and recordings, including my name, voice and likeness, to be edited and used in: ${(f.uses || []).length ? `<b>${(f.uses || []).map(esc).join('; ')}</b>` : '<span class="blank">________</span>'}. This applies worldwide and without a time limit.</p>
        <p>${/^\s*(none|0|£0|)\s*$/i.test((f.fields || {}).fee || '') ? 'I am not owed any payment' : `I am not owed any payment beyond ${v(f, 'fee')}`}, and I will not own the finished work.</p>
        <p>I can ask Aera to stop using my image in new material at any time by emailing bookings@aerastudios.org. Work already published or delivered to the client may stay up.</p>
        <p>I am 18 or over, or a parent or guardian has signed below for me.</p>`
    },
    location: {
      title: 'Location release', sign: true, signer: 'The owner or manager',
      fields: [['place', 'Name of the place'], ['address', 'Address'], ['owner', 'Person giving permission'], ['role', 'Their role', 'e.g. Owner, Manager'], ['contact', 'Their phone or email'], ['project', 'Project'], ['dates', 'Date(s)'], ['times', 'Times', 'e.g. 16:00 to 22:00'], ['areas', 'Areas we can use'], ['fee', 'Fee', 'e.g. None, or £80'], ['conditions', 'Any other conditions']],
      body: f => `<p>${v(f, 'owner', 'name')}, as ${v(f, 'role', 'owner / manager')} of ${v(f, 'place')}, ${v(f, 'address')}, gives Aera Studios (“Aera”) permission to film and photograph there on ${v(f, 'dates')}, ${v(f, 'times')}, for ${v(f, 'project')}.</p>
        <p>Areas Aera can use: ${v(f, 'areas')}. Fee: ${v(f, 'fee', 'none')}.</p>
        <p>Aera and its client may use the footage and photographs, including anything that shows the location, its name and its signs, in the finished work and to promote it, worldwide and without a time limit.</p>
        <p>Aera will keep to the agreed times, leave the location as it found it, and report any damage straight away.</p>
        ${String((f.fields || {}).conditions || '').trim() ? `<p>Other conditions: ${v(f, 'conditions')}</p>` : ''}
        <p>The person signing confirms they have the authority to give this permission.</p>`
    },
    risk: {
      title: 'Risk assessment', sign: false, rows: true,
      fields: [['project', 'Project'], ['date', 'Shoot date'], ['location', 'Location'], ['lead', 'Person responsible on the day'], ['firstaid', 'First aid', 'Kit location, first aider, nearest A&E'], ['emergency', 'Emergency contacts']],
      body: f => `<p>Project: ${v(f, 'project')} · Date: ${v(f, 'date')} · Location: ${v(f, 'location')}</p>
        <p>Responsible on the day: ${v(f, 'lead')}. First aid: ${v(f, 'firstaid')}. Emergency contacts: ${v(f, 'emergency')}.</p>
        <table class="risk"><thead><tr><th>Hazard</th><th>Who could be hurt</th><th>What we do about it</th><th>Risk</th></tr></thead><tbody>
        ${(f.rows || []).map(r => `<tr><td>${esc(r.hazard)}</td><td>${esc(r.who)}</td><td>${esc(r.control)}</td><td>${esc(r.level)}</td></tr>`).join('')}</tbody></table>
        <p>Everyone on the shoot is told about these risks before we start. Anyone can stop the shoot if something feels unsafe.</p>`
    },
    music: {
      title: 'Music clearance', sign: false,
      fields: [['track', 'Track'], ['artist', 'Artist'], ['holder', 'Rights holder', 'Label or publisher'], ['licence', 'Licence type'], ['where', 'Where it will be used', 'e.g. YouTube, Instagram reels, client website'], ['proof', 'Proof', 'Link to the licence or permission email'], ['cost', 'Cost'], ['notes', 'Notes']],
      body: f => `<p>Track: ${v(f, 'track')} by ${v(f, 'artist')}. Rights holder: ${v(f, 'holder')}.</p>
        <p>Licence: ${v(f, 'licence')}. Used in: ${v(f, 'where')}. Cost: ${v(f, 'cost', 'none')}.</p>
        <p>Proof: ${v(f, 'proof', 'not added yet')}</p>
        ${String((f.fields || {}).notes || '').trim() ? `<p>Notes: ${v(f, 'notes')}</p>` : ''}
        <p>Social platforms can mute or block videos with uncleared music, even with credit given. Keep the proof with the project.</p>`
    }
  };
  function render(f, job) {
    const d = defs[f.type]; if (!d) return '';
    const s = f.sig;
    return `<article class="formdoc">
      <header><div class="fd-mark">AERA</div><div class="fd-k">${esc(job && job.client ? job.client : '')}</div></header>
      <h1>${esc(f.title || d.title)}</h1>
      ${d.body(f)}
      ${d.sign ? `<div class="sigblock">
        <div><div class="sl">Signed</div>${s && s.img ? `<img src="${esc(s.img)}" alt="Signature">` : '<div class="line"></div>'}</div>
        <div><div class="sl">Name</div><div class="sv">${s ? esc(s.name) : ''}</div></div>
        <div><div class="sl">Date</div><div class="sv">${s ? new Date(s.at).toLocaleDateString('en-GB') : ''}</div></div>
        ${s && s.guardian ? `<div><div class="sl">Parent or guardian</div><div class="sv">${esc(s.guardian)}</div></div>` : ''}
        <div><div class="sl">For Aera Studios</div><div class="sv">bookings@aerastudios.org</div></div>
      </div>` : ''}
      <footer>Aera Studios · Leeds · aerastudios.org${s ? ` · Signed online ${esc(new Date(s.at).toLocaleString('en-GB'))}` : ''}</footer>
    </article>`;
  }
  const css = `.formdoc{background:#fff;color:#0E0E10;border:1px solid #DDD5C6;border-radius:4px;padding:44px 48px;max-width:760px;margin:0 auto;font:400 15px/1.65 Inter,sans-serif}
.formdoc header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #C2A878;padding-bottom:12px;margin-bottom:26px}
.formdoc .fd-mark{font-family:'Playfair Display',Georgia,serif;letter-spacing:.32em;font-size:15px}.formdoc .fd-k{font-size:12.5px;color:#5F594F}
.formdoc h1{font-family:'Playfair Display',Georgia,serif;font-weight:500;font-size:30px;margin:0 0 18px}
.formdoc p{margin:0 0 12px}.formdoc .blank{color:#A39C90}
.formdoc table.risk{width:100%;border-collapse:collapse;font-size:13px;margin:14px 0}
.formdoc table.risk th,.formdoc table.risk td{border:1px solid #DDD5C6;padding:6px 8px;text-align:left;vertical-align:top}
.formdoc table.risk th{background:#F5F1E9;font-weight:600}
.formdoc .sigblock{display:grid;grid-template-columns:2fr 1.4fr 1fr;gap:16px 22px;margin-top:30px}
.formdoc .sl{font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;color:#8A6E3E;margin-bottom:6px}
.formdoc .sv{border-bottom:1px solid #0E0E10;min-height:26px;font-size:15px}.formdoc .line{border-bottom:1px solid #0E0E10;height:60px}
.formdoc .sigblock img{height:64px;display:block;border-bottom:1px solid #0E0E10;width:100%;object-fit:contain;object-position:left}
.formdoc footer{margin-top:34px;padding-top:10px;border-top:1px solid #DDD5C6;font-size:11.5px;color:#5F594F}
@media(max-width:640px){.formdoc{padding:26px 20px}.formdoc .sigblock{grid-template-columns:1fr}}
@media print{.formdoc{border:0;padding:0;max-width:none}}`;
  window.AERA_FORMS = { defs, render, css, USES, LICENCES, RISK_ROWS, esc };
})();
