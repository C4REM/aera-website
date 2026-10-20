"""Generate every project page in the "screening" layout.

Run from the repo root:  python3 tools/gen_projects.py && python3 tools/seo_pass.py

Each page keeps its own <head> and nav (seo_pass.py owns the SEO block) and gets
a new body: the opening frame the camera pushes into as you scroll, a poster-
style title and billing block, short passages, the frames as a reel or a
contact grid, and a full-width link to the next project.

All copy is third person: the studio talks about Jack, Vance and Toosh, never
"I" or "me". Image lists for the older pages live in projects_images.json
(extracted from the previous pages); Headspace's stills are self-hosted.
"""
import html, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMGS = json.loads((ROOT / 'tools/projects_images.json').read_text())
JS_V = '20261019w1'
e = lambda s: html.escape(s, quote=True)
H = 'assets/img/work/headspace/'

def imgs(slug):
    d = IMGS[slug]
    return d['hero'], d['gal']

ORDER = ['headspace', 'warwick-application', 'never-felt-so-alone', 'i-feel-good', 'rolls-royce', 'green-planet-dubai',
         'photography', 'kia-motors', 'eid-al-etihad', 'graphic-design', 'on-stage', 'live-music', 'on-set']

TOOSH_NOTE = ('Photographed by <a href="/toosh-alzaeem">Toosh Alzaeem</a>. More of her work at '
              '<a href="http://madebyzooshportfolio.com" target="_blank" rel="noopener">madebyzoosh</a>.')

P = {}

P['headspace'] = dict(
    name='Headspace', credit='A film by Jack Careem',
    hero=(H + 'falling.webp', 'Nolan falling backwards through total darkness'), dark=True, origin='50% 45%',
    logline='Nolan isn’t the only version of himself in the room. A psychological thriller about the things people keep to themselves.',
    billing=[('Written, directed, shot & edited by', 'Jack Careem'), ('Year', '2025'), ('Genre', 'Psychological thriller'),
             ('Next screening', 'HollyShorts MENA, Dubai<br>14–17 January 2027')],
    laurels=[('assets/img/awards/black-sheep-winner.png', 'Winner, UAE Student Film Award, The Black Sheep Film Festival, 14th edition, 2026'),
             ('assets/img/awards/dune-editing.svg', 'Winner, Best Editing, Dune Creative Festival 2026')],
    frames=[(H + 'library.webp', 'Nolan stands still in a library while blurred figures rush past him'),
            (H + 'mirror.webp', 'Nolan sits facing another version of himself across a mirrored pillar'),
            (H + 'floor.webp', 'Nolan sits on the floor of a dark stage beside a tipped-over chair'),
            (H + 'lifts.webp', 'Three glass lifts in an atrium, each with the same man inside'),
            (H + 'red.webp', 'A kaleidoscope of red-lit doorways, Nolan standing in each one'),
            (H + 'run.webp', 'A blurred figure runs through a dim corridor')],
    blocks=[('text', 'The film', [
                'Every version of Nolan wants something different. One argues, one runs, one stands perfectly still while everyone else rushes past. The film puts them in the same frame until it’s hard to tell which one is really him.',
                'It’s built like a thriller, but it’s about mental health, and how long you can carry something on your own before you have to say it out loud.']),
            ('reel', 0, 4),
            ('text', 'Making it', [
                'Headspace started as a school project and took Jack over a year. He wrote, directed, shot and edited it, with one friend helping on set, and Fight Club as the reference throughout.',
                'The hardest part was the multiples: three or four Nolans sharing a frame, built shot by shot in After Effects. Those sequences are what won it Best Editing at Dune.']),
            ('reel', 4, 6),
            ('ledger', 'Festival run', [('2026', 'The Black Sheep Film Festival, Dubai', 'UAE Student Film Award · Winner'),
                                        ('2026', 'Dune Creative Festival', 'Best Editing · Winner'),
                                        ('2027', 'HollyShorts MENA, Dubai', 'Official selection')]),
            ('note', 'The UAE Student Film Award was new at Black Sheep’s fourteenth edition, the first year SAE Dubai opened its festival to students from across the country. HollyShorts MENA is the Dubai edition of the Oscar and BAFTA qualifying HollyShorts festival.')])

h, g = imgs('never-felt-so-alone')
P['never-felt-so-alone'] = dict(
    name='Never Felt So Alone', credit='A music video by Jack Careem', hero=(h[0], 'A frame from Never Felt So Alone'),
    logline='A man sorting memory from the fact that she isn’t coming back. Set to Labrinth and Billie Eilish.',
    billing=[('Directed, shot & edited by', 'Jack Careem'), ('Year', '2023'), ('Format', 'Music video'), ('Camera', 'Canon EOS 5D Mark IV')],
    frames=g,
    blocks=[('text', 'The film', [
                'The video follows one man through the end of a relationship. He moves through the memories first, then runs into the flat fact that she has gone for good.',
                'Nothing is spelled out. The heartache, the regret and the slow letting go are all carried by the pictures.']),
            ('reel', 0, 4),
            ('text', 'Making it', [
                'It was 2023, and the first time Jack had used a professional camera. Everything was new at once: real settings, real problems on set, and a schedule that didn’t wait for him to catch up.',
                'It still ran like a proper production, with hired actors, paperwork and fixed deadlines. It’s also where he first pushed effects, grading and lighting, and learned how much of a film’s look is decided long after the shoot.']),
            ('reel', 4, None)])

h, g = imgs('i-feel-good')
P['i-feel-good'] = dict(
    name='I Feel Good', credit='A short film by Jack Careem', hero=(h[0], 'A frame from I Feel Good'),
    logline='A man dances round his flat getting ready for a date, and wrecks the planet a little on the way out.',
    billing=[('Directed, shot & edited by', 'Jack Careem'), ('Year', '2024'), ('Format', 'Short film'), ('Made for', 'World Ocean Day')],
    frames=g,
    blocks=[('text', 'The idea', [
                'He’s getting ready for a date and he’s thrilled about it, tearing round the flat without a second thought. Behind him he leaves the tap running, the hob on and rubbish everywhere.',
                'It starts as a silly few minutes and turns into a film about the habits nobody thinks twice about.']),
            ('reel', 0, 4),
            ('text', 'Making it', [
                'The environmental point was the reason for making it, but a film that lectures gets switched off. Wrapping it in something funny meant it reached people who would never sit through the serious version.',
                'It was the most ambitious thing Jack had tried at that point. The choreography alone took more planning than everything he’d shot before it.']),
            ('reel', 4, None)])

h, g = imgs('rolls-royce')
P['rolls-royce'] = dict(
    name='Rolls&#8209;Royce', plain='Rolls-Royce', credit='A brand film by Vance Serania', hero=(h[0], 'A Rolls-Royce Spectre on a desert road at sunset'),
    logline='A Spectre, an empty stretch of road, and about forty minutes of usable light.',
    billing=[('Directed & shot by', 'Vance Serania'), ('Year', '2025'), ('Client', 'Rolls-Royce'), ('Location', 'Desert road outside Dubai')],
    frames=g,
    blocks=[('text', 'The job', [
                'Vance shot this film for Rolls-Royce on a single stretch of road in the desert outside Dubai. The job came the way the good ones usually do: someone who had seen his work put his name forward.']),
            ('reel', 0, None),
            ('text', 'The light', [
                'Everything was built around sunset. A Spectre is a mirror on wheels, so the film depends on what it reflects. Too much sun and the paint blows out; too little and the car sinks into the road. The usable window was about forty minutes.',
                'The road did the rest. One lane, no traffic, and nothing either side competing with the car.',
                'It is still the most expensive thing anyone at Aera has been allowed near, and we’d like that on the record.'])])

h, g = imgs('green-planet-dubai')
P['green-planet-dubai'] = dict(
    name='Green Planet Dubai', credit='Photographs by Jack Careem', hero=(h[0], 'A bird in the rainforest canopy at the Green Planet, Dubai'),
    logline='A day inside a biodome, photographing birds and animals that mostly didn’t want to be photographed.',
    billing=[('Photographed by', 'Jack Careem'), ('Year', '2024'), ('Location', 'The Green Planet, Dubai'), ('For', 'A photography competition')],
    frames=g, grid=True,
    blocks=[('text', 'The shoot', [
                'The Green Planet is an indoor rainforest in the middle of Dubai, and a strange place to shoot: humid, dim under the canopy, and full of animals moving at their own pace.',
                'It was for a photography competition, so Jack set his own brief. He went for personality and movement over clean field-guide portraits, which mostly meant standing very still for a long time.']),
            ('grid', 0, None)])

h, g = imgs('photography')
P['photography'] = dict(
    name='Photography', credit='Photographs by Jack Careem', hero=(h[0], 'A photograph by Jack Careem'),
    logline='No brief and no client. The running set of frames worth keeping.',
    billing=[('Photographed by', 'Jack Careem'), ('Years', 'Ongoing'), ('Places', 'Leeds, London, Prague, Dubai'), ('Subjects', 'Portraits, streets, cars, sport')],
    frames=g, grid=True,
    blocks=[('text', 'The set', [
                'This is what Jack shoots when nobody has asked for anything: portraits, nights out, cars, whatever was in front of him. Each frame is here because it worked, not because it fits a theme.',
                'It’s the most honest answer to what his eye looks like without a brief.']),
            ('grid', 0, None)])

h, g = imgs('kia-motors')
P['kia-motors'] = dict(
    name='KIA Motors', credit='Behind the scenes with Vance Serania', hero=(h[0], 'On set for a KIA Motors campaign'),
    logline='Fifty-odd people on set, and Vance somewhere in the middle holding something expensive.',
    billing=[('Camera assistant', 'Vance Serania'), ('Year', '2024'), ('Client', 'KIA Motors'), ('Kit', 'ARRI Alexa · DJI Inspire 3')],
    frames=g,
    blocks=[('text', 'The set', [
                'A campaign for KIA Motors, and the first really big production Vance worked on: more than fifty crew, each with a job so specific you could go a whole day without working out what half of them did.',
                'He was camera assistant. On a set that size you are not the one making decisions, which was exactly the point of being there.']),
            ('reel', 0, None),
            ('text', 'What stuck', [
                'Not the cameras, though an Alexa on the ground and an Inspire 3 in the air are hard to forget. It was watching fifty people hold a schedule together, and seeing how much of a big shoot is really logistics.',
                'Knowing how a proper set runs is worth more to a client than the credit is to us, which is why it’s on this page.'])])

h, g = imgs('eid-al-etihad')
P['eid-al-etihad'] = dict(
    name='Eid Al Etihad Day', credit='A campaign by Jack Careem', hero=(h[0], 'The UAE flag'),
    logline='A national day campaign for a school in Dubai, planned, shot, lit and edited in three days.',
    billing=[('Shot, lit & edited by', 'Jack Careem'), ('Year', '2024'), ('Client', 'A school in Dubai'), ('Turnaround', 'Three days')],
    frames=[],
    blocks=[('text', 'The brief', [
                'Eid Al Etihad is the UAE’s national day, marking the union of the seven emirates. Jack’s school came to him with an idea for it and a deadline three days away, covering the planning, shooting, lighting and the full edit.']),
            ('text', 'Three days', [
                'There was no room to try anything twice, so the thinking had to be done before anyone picked up a camera. It’s the job that taught him to plan a shoot properly.',
                'It went out on time, which still feels like the real achievement.'])])

h, g = imgs('graphic-design')
P['graphic-design'] = dict(
    name='Graphic Design', credit='Design by Jack Careem', hero=(h[0], 'A matchday graphic designed by Jack Careem'),
    logline='Sometimes the photo isn’t enough, and something has to be built around it.',
    billing=[('Designed by', 'Jack Careem'), ('Years', 'Ongoing'), ('Work', 'Matchday graphics, social, posters')],
    frames=g, grid=True,
    blocks=[('text', 'Matchday', [
                'Fixtures, line-ups, results and goal graphics for school football and basketball. The set had to stay consistent across a whole season and still be quick to turn round between matches.']),
            ('text', 'His own feed', [
                'Most Instagram grids look the same. Jack treated his as a design project, with layouts and type made for the grid instead of photos posted as they came.']),
            ('text', 'Senior year', [
                'Posters, campaign graphics and announcements for his year group’s Instagram, all held to one look through a busy year.']),
            ('grid', 0, None)])

h, g = imgs('on-stage')
S = 'assets/img/work/on-stage/'
P['on-stage'] = dict(
    name='On Stage', credit='Photographs by Toosh Alzaeem & Jack Careem', hero=(h[0], h[1]),
    logline='Shot from the stalls and the wings, during the real show.',
    billing=[('Photographed by', 'Toosh Alzaeem<br>Jack Careem'), ('Work', 'Theatre photography'), ('Shot during', 'Live performances, not photocalls')],
    frames=g + [(S + 'jack-hat-smoke.webp', 'A performer in a wide black hat and green scarf, caught in a single beam through stage haze'),
                (S + 'jack-roses-dark.webp', 'A woman in a green dress with a basket of red roses, alone in a pool of light on a dark stage'),
                (S + 'jack-hat-point.webp', 'The same performer in a mustard shirt, pointing skyward mid-song under blue light'),
                (S + 'jack-roses.webp', 'The flower seller holding out a single red rose')],
    blocks=[('text', 'The job', [
                'Toosh shoots theatre during real performances rather than a staged photocall, so what you see is the show itself: the lights, the costumes, and a cast clearly having the time of their lives.',
                'She works from the stalls and the wings. Nothing is posed or restaged afterwards, and the cast and crew get pictures they can relive the night with.']),
            ('reel', 0, 3),
            ('text', 'Jack’s frames', [
                'Jack shoots the same way, during the real show, but leans into the dark: one light, one performer, and everything else allowed to fall away to black.',
                'It suits the quiet moments as much as the big numbers. A flower seller alone in a spotlight can carry a frame on her own.']),
            ('reel', 3, 5),
            ('reel', 5, 7),
            ('note', 'Photographed by <a href="/toosh-alzaeem">Toosh Alzaeem</a> and <a href="/jack-careem">Jack Careem</a>. More of Toosh’s work at <a href="http://madebyzooshportfolio.com" target="_blank" rel="noopener">madebyzoosh</a>.')])

h, g = imgs('on-set')
L = 'assets/img/work/live-music/'
P['live-music'] = dict(
    name='Live Music', credit='Photographs by Toosh Alzaeem',
    hero=(L + 'music-02.webp', 'A guitarist with long red hair singing at the mic, the band behind her'), origin='55% 40%',
    logline='Gigs and live sets, shot from right up by the stage.',
    billing=[('Photographed by', 'Toosh Alzaeem'), ('Work', 'Live music photography'), ('Shot during', 'Real gigs, from the front')],
    frames=[(L + 'music-03.webp', 'A small venue stage under purple light, with big light-up letters on the floor'),
            (L + 'music-04.webp', 'A guitarist with red hair singing under green and blue stage light'),
            (L + 'music-08.webp', 'A singer gripping a red microphone, lit in deep blue'),
            (L + 'music-01.webp', 'A singer with glasses and a red microphone, eyes closed mid-note under blue light'),
            (L + 'music-06.webp', 'A singer playing guitar, lit pink and red, mid-song'),
            (L + 'music-07.webp', 'A bassist in a white t-shirt playing in front of a dark curtain'),
            (L + 'music-10.webp', 'A black and white shot of a bassist, head down'),
            (L + 'music-05.webp', 'A singer in a blue shirt belting into the mic in front of a red curtain'),
            (L + 'music-12.webp', 'A guitarist with red hair singing into the mic with green light behind her'),
            (L + 'music-13.webp', 'A guitarist in a cap and hoodie playing an angular electric guitar'),
            (L + 'music-09.webp', 'A singer and guitarist lit in pink and blue, mid-chorus'),
            (L + 'music-14.webp', 'A singer holding a red microphone with both hands')],
    blocks=[('text', 'The job', [
                'Toosh gets as close to the stage as she can, then waits for the moment the band really goes for it: the held note, the chorus, the guitarist leaning into the mic.',
                'She works with whatever the venue’s lights are doing rather than fighting them, so every set comes out looking like its own room, and you can almost hear it.']),
            ('reel', 0, 3),
            ('text', 'For bands and venues', [
                'Nothing is staged and nobody is asked to stop. Bands and venues come away with pictures that look the way the night felt, ready for the next poster, post or press kit.']),
            ('grid', 3, None),
            ('note', 'Photographed by <a href="/toosh-alzaeem">Toosh Alzaeem</a>. More of her live work at <a href="https://madebyzooshportfolio.com/photography.html#live-music" target="_blank" rel="noopener">madebyzoosh</a>.')])

P['on-set'] = dict(
    name='On Set', credit='Photographs by Toosh Alzaeem', hero=(h[0], h[1]),
    logline='Lighting and behind-the-scenes photography on independent film sets.',
    billing=[('Gaffer & BTS photographer', 'Toosh Alzaeem'), ('Project', 'Short film teaser'), ('Work', 'Lighting · stills')],
    frames=g,
    blocks=[('text', 'The job', [
                'Toosh has worked on independent film sets as head of gaffing and as the behind-the-scenes photographer. These are from a short film teaser, and she likes the moments between takes as much as the takes.',
                'Gaffing has taught her a lot about light and about how a crew works together. The long-term plan is cinematography on big productions.']),
            ('reel', 0, None),
            ('note', TOOSH_NOTE)])

W = 'assets/img/work/warwick/'
P['warwick-application'] = dict(
    name='Warwick Application', credit='A video application by Jack Careem',
    hero=(W + 'asleep-hero.webp', 'Jack asleep face-down on a glowing keyboard, monitors lit behind him'), origin='45% 55%',
    logline='Five minutes, straight to camera: who Jack is, and the three projects that taught him how to make things.',
    billing=[('Written, shot & edited by', 'Jack Careem'), ('Year', '2025'), ('Made for', 'University of Warwick application'), ('Runtime', '5 minutes')],
    film=dict(src='assets/video/warwick-application/index.m3u8', poster=W + 'poster.webp', title='Warwick Application', runtime='5:03'),
    frames=[(W + 'laptop-reveal.webp', 'Jack lit from below as he opens a glowing laptop'),
            (W + 'notebook.webp', '2023 written in a notebook'),
            (W + 'flip-screen.webp', 'Jack seen on the flip-out screen of a camera'),
            (W + 'doorway-three.webp', 'Jack in a warm-lit doorway with a large yellow number three across his back'),
            (W + 'phone-laptop.webp', 'A phone showing 5:50 resting on a closed laptop'),
            (W + 'stick-figures.webp', 'Stick-figure animation of the three-person crew, each with a camera or clapperboard'),
            (W + 'editing-room.webp', 'A dark room at night, an edit open on the laptop by the window')],
    blocks=[('film',),
            ('text', 'The brief', [
                'Applicants were asked for a short video introducing themselves. Jack made a five-minute film instead: half confession, half showreel.',
                'It opens on home videos of him as a kid, then comes back to the present to walk through how he learned to make things. A media diploma course in Dubai and his first music video. A campaign film for Head Boy, made in two weeks with nothing but a phone. A short for World Ocean Day.']),
            ('reel', 0, 3),
            ('text', 'Making it', [
                'Each project gets its own look. The Head Boy section leans into being shot on a phone, with a retro 4:3 frame and a scrapbook feel. The rest mixes talking to camera with stick-figure animation, behind-the-scenes clips and recreated scenes.',
                'Jack wrote, shot and cut all of it around his own narration, captions included.']),
            ('reel', 3, 7)])


def fig(src, alt, cls=''):
    return f'<figure class="sc-f{cls} reveal"><img src="{e(src)}" loading="lazy" alt="{e(alt)}"></figure>'

def reel(frames):
    """Alternate a full-bleed frame with an inset pair; a lone leftover runs full."""
    out, i, n = [], 0, len(frames)
    if n == 2:  # two frames read better side by side than as two walls
        return '<section class="sc-reel" aria-label="Frames">\n  <div class="sc-pair">' + fig(*frames[0]) + fig(*frames[1]) + '</div>\n</section>'
    while i < n:
        if (len(out) % 2 == 0) or i == n - 1:
            out.append(fig(*frames[i], ' sc-full')); i += 1
        else:
            out.append('<div class="sc-pair">' + fig(*frames[i]) + fig(*frames[i + 1]) + '</div>'); i += 2
    return '<section class="sc-reel" aria-label="Frames">\n  ' + '\n  '.join(out) + '\n</section>'

def film(f):
    """The full film, streamed as HLS from our own host (each segment stays under
    Cloudflare Pages' 25 MB file limit). project.js attaches hls.js on first play;
    Safari plays the playlist natively."""
    return (f'<section class="sc-film reveal" aria-label="Watch the film">\n'
            f'  <div class="sc-film-frame">\n'
            f'    <video class="sc-video" data-hls="{e(f["src"])}" poster="{e(f["poster"])}" playsinline preload="none"></video>\n'
            f'    <button class="sc-play" type="button" aria-label="Play {e(f["title"])}"><span class="sc-play-dot" aria-hidden="true"></span>'
            f'<span class="sc-play-lbl">Play film</span><span class="sc-play-rt">{e(f["runtime"])}</span></button>\n'
            f'  </div>\n</section>')

def grid(frames):
    items = '\n    '.join(f'<figure class="sc-g reveal"><img src="{e(s)}" loading="lazy" alt="{e(a)}"><figcaption>{i + 1:02d}</figcaption></figure>'
                           for i, (s, a) in enumerate(frames))
    return f'<section class="sc-grid" aria-label="Frames">\n    {items}\n</section>'

def text(label, paras, k):
    side = ' sc-text-alt' if k % 2 else ''
    ps = '\n      '.join(f'<p>{e(p)}</p>' for p in paras)
    return (f'<section class="sc-text{side}">\n  <div class="sc-row reveal">\n    <span class="sc-lbl">{e(label)}</span>\n'
            f'    <div class="sc-copy">\n      {ps}\n    </div>\n  </div>\n</section>')

def ledger(label, rows):
    li = '\n      '.join(f'<li><span class="y">{e(y)}</span><span class="f">{e(f)}</span><span class="a">{e(a)}</span></li>' for y, f, a in rows)
    return (f'<section class="sc-text">\n  <div class="sc-row reveal">\n    <span class="sc-lbl">{e(label)}</span>\n'
            f'    <ol class="sc-ledger">\n      {li}\n    </ol>\n  </div>\n</section>')

def body(slug):
    p = P[slug]
    plain = p.get('plain', html.unescape(p['name']))
    nxt = ORDER[(ORDER.index(slug) + 1) % len(ORDER)]
    np = P[nxt]
    hero_src, hero_alt = p['hero']
    bill = '\n    '.join(f'<div><dt>{e(k)}</dt><dd>{v if "<br>" in v else e(v)}</dd></div>' for k, v in p['billing'])
    laur = ''
    if p.get('laurels'):
        laur = ('\n  <ul class="sc-laurels reveal" aria-label="Awards">\n    ' +
                '\n    '.join(f'<li><img src="{e(s)}" alt="{e(a)}"></li>' for s, a in p['laurels']) + '\n  </ul>')
    parts, k = [], 0
    for b in p['blocks']:
        if b[0] == 'text':
            parts.append(text(b[1], b[2], k)); k += 1
        elif b[0] == 'reel':
            fr = p['frames'][b[1]:b[2]]
            if fr: parts.append(reel(fr))
        elif b[0] == 'grid':
            fr = p['frames'][b[1]:b[2]]
            if fr: parts.append(grid(fr))
        elif b[0] == 'ledger':
            parts.append(ledger(b[1], b[2]))
        elif b[0] == 'film':
            parts.append(film(p['film']))
        elif b[0] == 'note':
            parts.append(f'<section class="sc-text sc-note-wrap"><p class="sc-note reveal">{b[1] if "<a " in b[1] else e(b[1])}</p></section>')
    dark = ' sc-dark' if p.get('dark') else ''
    origin = f' style="transform-origin:{p["origin"]}"' if p.get('origin') else ''
    return f'''<!-- PROJECT ({slug}) — generated by tools/gen_projects.py; edit the data there, not here.
     The opening frame is held in the dark and project.js pushes the camera
     in as you scroll; then a poster-style title and billing block, short
     passages between the frames, and the next project as one big link. -->
<header class="sc-open{dark}">
  <div class="sc-stick">
    <img class="sc-open-img" src="{e(hero_src)}" alt="{e(hero_alt)}" fetchpriority="high"{origin}>
    <div class="sc-meta">
      <span>{e(p["credit"])}</span>
      <span class="sc-crumb"><a href="/work">Work</a> / {e(plain)}</span>
    </div>
    <div class="sc-cue" aria-hidden="true">Scroll</div>
  </div>
</header>

<section class="sc-title">
  <h1 class="sc-h1 reveal">{p["name"]}</h1>
  <p class="sc-logline reveal">{e(p["logline"])}</p>
  <dl class="sc-billing reveal">
    {bill}
  </dl>{laur}
</section>

''' + '\n\n'.join(parts) + f'''

<a class="sc-next" href="/{nxt}">
  <img src="{e(np["hero"][0])}" alt="" loading="lazy">
  <span class="sc-next-lbl">Next</span>
  <span class="sc-next-ttl">{np["name"]}</span>
</a>

'''

for slug in ORDER:
    f = ROOT / f'{slug}.html'
    s = f.read_text()
    a = min(i for i in [s.find('<header class="pj-hero'), s.find('<header class="sc-open'), s.find('<!-- HEADSPACE'), s.find('<!-- PROJECT (')] if i >= 0)
    b = s.index('<section id="contact"')
    s = s[:a] + body(slug) + s[b:]
    s = re.sub(r'<body[^>]*>', '<body class="sc-page">', s, count=1)
    s = re.sub(r'\n<script src="assets/js/(hs|project)\.js[^"]*"( defer)?></script>', '', s)
    s = s.replace('<script src="assets/js/main.js', f'<script src="assets/js/project.js?v={JS_V}" defer></script>\n<script src="assets/js/main.js', 1)
    f.write_text(s)
    print('project', slug)
