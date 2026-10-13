"""Generate team.html (cast poster + end credits) and one profile page per person.
Run from the repo root: python3 tools/gen_team.py  (rewrites team.html and the profile pages)
"""
import json, html, re

src = open('team.html').read()
# The template is the current team.html itself: everything up to the first
# generated block. Safe to rerun; anything this script adds is stripped first.
_cut = min(i for i in (src.find('<header class="page-hero">'), src.find('<!-- TEAM PAGE')) if i >= 0)
HEAD = src[:_cut]
HEAD = re.sub(r'<link href="https://fonts.googleapis.com/css2\?family=Oswald[^>]*>\n', '', HEAD)
FOOT = src[src.index('<footer>'):src.index('</footer>') + len('</footer>')]
CSSV = '20261013l'
HEAD = re.sub(r'style\.css\?v=[0-9a-z]+', 'style.css?v=' + CSSV, HEAD)
if 'ed-js' not in HEAD:
    HEAD = HEAD.replace('<link rel="stylesheet" href="assets/css/style.css',
                        "<script>document.documentElement.classList.add('ed-js')</script>\n<link rel=\"stylesheet\" href=\"assets/css/style.css", 1)
SCRIPTS = '''<script src="assets/js/lenis.min.js?v=20260803h"></script>
<script src="assets/js/main.js?v=20261013a"></script>
<script src="assets/js/ed-home.js?v=20261013a"></script>
<script src="assets/js/team-cast.js?v=20261013b"></script>
</body>
</html>
'''
e = lambda s: html.escape(s, quote=True)
SQ = 'https://images.squarespace-cdn.com/content/v1/67a046e3af281e412f15579a/'
MP = 'https://cdn.myportfolio.com/306f0dec-b99e-4a9e-a71a-768e23a6c7b5/'
T = 'assets/img/team/toosh/'

PEOPLE = [
  dict(slug='jack-careem', first='Jack', name='Jack Careem',
       role='Founder · Photographer & Filmmaker', short='Founder',
       loc='Leeds', cut='assets/img/team/cast-jack.webp?v=3',
       bio="Started with a camera and a lot of frames that missed. Shoots events, brands and portraits, and handles most of the edit and design himself.",
       skills=['Photography', 'Film', 'Editing', 'Grading', 'Design', 'Social'],
       links=[('Full portfolio', 'https://c4rem.co.uk'), ('Instagram', 'https://instagram.com/_c4rem')],
       credits=[('Never Felt So Alone', 'Music video', 'never-felt-so-alone.html'),
                ('I Feel Good', 'Short film', 'i-feel-good.html'),
                ('Green Planet Dubai', 'Photography', 'green-planet-dubai.html'),
                ('Eid Al Etihad Day', 'Commissioned', 'eid-al-etihad.html'),
                ('Graphic Design', 'Design', 'graphic-design.html')],
       folio=[SQ+'13f98449-a6da-4ea8-b125-01a7d5fc40b4/IMG_1199.jpg', SQ+'717cb03f-faa2-4ff3-bb24-2a59f2af0aad/IMG_6821.jpg',
              SQ+'d68650ca-1652-44b5-823e-c43abab0b7e2/Lando+Photo.png', SQ+'956771b0-d277-4ee9-bde0-2c1b6d0a8d8c/Green+Planet+Photos-12.jpg',
              SQ+'b5d862b4-ff71-42f0-9e9e-ce0c231c5a80/1J6A0134.jpg']),
  dict(slug='toosh-alzaeem', first='Toosh', name='Toosh Alzaeem',
       role='Photographer & Videographer', short='Theatre, gigs & film sets',
       loc='Bournemouth', cut='assets/img/team/cast-toosh.webp?v=3',
       bio="Shoots theatre, gigs, weddings and anything with a crowd and some energy in the room. Four years in, starting out in Dubai and now based in Bournemouth, and happy to travel for a good job. On independent film sets she has run the lighting as head of gaffing and shot the behind-the-scenes photography. Never poses anyone stiffly; she catches what is actually happening and keeps the mood light, because people having fun always look their best.",
       skills=['Theatre', 'Live music', 'Weddings', 'Reels', 'Gaffing', 'BTS photography', 'Social'],
       links=[('Full portfolio', 'http://madebyzooshportfolio.com'), ('Instagram', 'https://instagram.com/madebyzoosh')],
       credits=[('On Stage', 'Theatre', 'on-stage.html'), ('On Set', 'Behind the scenes', 'on-set.html')],
       folio=[T+'theatre-finale.jpg', T+'theatre-yellow-suit.jpg', T+'set-clapperboard.jpg', T+'wedding-altar.jpg', T+'socotra-dragon-tree.jpg']),
  dict(slug='vance-serania', first='Vance', name='Vance Serania',
       role='Middle East Lead · Filmmaker & Photographer', short='Middle East Lead',
       loc='UAE', cut='assets/img/team/cast-vance.webp?v=3',
       bio="Photographer and videographer, and the reason Aera can work in the Gulf rather than just talk about it. Came to it from a family of sculptors, sketch artists and designers, started shooting on a phone, then bought a Sony and never really stopped. Picked up cinematography, lighting and grading through a media course and has been taking freelance jobs around school ever since: brand films for Rolls-Royce and KIA Motors, boxing, fashion, and a fair amount of nobody-asked-me-to short film work. Cuts in Premiere and DaVinci.",
       skills=['Film', 'Photography', 'Cinematography', 'Lighting', 'Grading', 'Premiere', 'DaVinci Resolve'],
       links=[('Full portfolio', 'https://vanceserania.myportfolio.com')],
       credits=[('Rolls-Royce', 'Brand · 2025', 'rolls-royce.html'), ('KIA Motors', 'Brand · 2024', 'kia-motors.html'),
                ('F1rst Motors', 'Brand · 2024', 'https://vanceserania.myportfolio.com/copy-of-once-more-1'),
                ('City Social', 'Hospitality · 2025', 'https://vanceserania.myportfolio.com/copy-of-the-beam'),
                ('The Beam', 'Commercial · 2025', 'https://vanceserania.myportfolio.com/copy-of-the-beam-1'),
                ('Sienna', 'Hospitality · 2025', 'https://vanceserania.myportfolio.com/copy-of-once-more-2')],
       folio=[MP+'4e1dea05-cfeb-4ec8-8bbb-edff7475ac5f_rwc_0x157x1920x768x1920.jpg?h=6da19d20ea4eb957d336eb7de3dbc5bf',
              MP+'16daea74-6710-467e-943d-5a01a1150467_rw_3840.jpg?h=7c2bac025a21c60797a1bfc4a38d48bf',
              MP+'b8be5e7b-993f-4cd4-a9c8-880f69848b78_rw_1920.JPG?h=8b52edb83f11e442d9eb8da97f27b937',
              MP+'008b52cc-c7f1-4bb4-a8a3-0782501b6e4d_rw_1920.png?h=21c5cd2cc19eabfb642e9e353a16cb55',
              MP+'0b3cbde8-77b2-468a-9aa9-3f30d43c47d1_rw_1920.png?h=a1b91d43b05fe29d7de1453943244a32']),
]
OPEN = dict(role='Design & Art Direction')

def head(title, desc, url):
    h = HEAD
    h = re.sub(r'<title>[^<]*</title>', '<title>' + e(title) + '</title>', h)
    h = re.sub(r'(<meta name="description" content=")[^"]*', r'\g<1>' + e(desc), h)
    h = re.sub(r'(<meta property="og:title" content=")[^"]*', r'\g<1>' + e(title), h)
    h = re.sub(r'(<meta property="og:description" content=")[^"]*', r'\g<1>' + e(desc), h)
    h = h.replace('https://aerastudios.org/team.html', 'https://aerastudios.org/' + url)
    h = re.sub(r'<body[^>]*>', '<body class="ed-home tm-page">', h, count=1)
    return h

ext = lambda u: u.startswith('http')
target = lambda u: ' target="_blank" rel="noopener"' if ext(u) else ''

# ---------------- team.html ----------------
# Poster order (left to right). Toosh sits on the left so her gimbal points out
# into empty space rather than across Jack; the founder takes the centre.
POSTER = [('toosh-alzaeem', 'cast-toosh'), ('jack-careem', 'cast-jack'), ('vance-serania', 'cast-vance')]
BY = {p['slug']: p for p in PEOPLE}
# short labels that rise above the billed names on hover
POSTER_ROLE = {'toosh-alzaeem': 'Photo & Video', 'jack-careem': 'Founder', 'vance-serania': 'Middle East Lead'}
bill_top = []
figs = []
for k, (slug, img) in enumerate(POSTER):
    p = BY[slug]
    bill_top.append(f'<a class="pt-name" href="{slug}.html" data-i="{k}" data-ed="fade" style="--k:{k}"><span class="pt-role">{e(POSTER_ROLE[slug])}</span>{e(p["name"])}</a>')
    figs.append(
        f'    <a class="pt-fig pt-f{k}" href="{slug}.html" data-i="{k}" aria-label="{e(p["name"])}, {e(p["role"])}">\n'
        f'      <span class="pt-light" aria-hidden="true"></span>\n'
        f'      <img src="assets/img/team/{img}.webp?v=3" alt="{e(p["name"])}" loading="eager" decoding="async">\n'
        f'    </a>')

# Billing block: the dense credit text at the foot of every film poster.
# Small connecting words are .s, names are links to their profiles.
def nm(slug):
    return f'<a href="{slug}.html">{e(BY[slug]["name"])}</a>'
billing = (f'<span class="s">Aera Studios presents</span> <span class="s">a</span> {nm("jack-careem")} <span class="s">production</span> '
           f'<span class="s">photography by</span> {nm("toosh-alzaeem")} '
           f'<span class="s">cinematography by</span> {nm("vance-serania")} '
           f'<span class="s">edited &amp; graded by</span> {nm("jack-careem")} '
           f'<span class="s">gaffer</span> {nm("toosh-alzaeem")} '
           f'<span class="s">middle east unit</span> {nm("vance-serania")} '
           f'<span class="s">design &amp; art direction</span> {nm("vance-serania")} '
           f'<span class="s">shot on location in</span> Leeds <span class="s">&middot;</span> Bournemouth <span class="s">&middot;</span> Dubai')

credits_rows = [
  ('Founder', 'Jack Careem', 'jack-careem.html'),
  ('Photography &amp; Film', 'Jack Careem', 'jack-careem.html'),
  ('Photography &amp; Video', 'Toosh Alzaeem', 'toosh-alzaeem.html'),
  ('Gaffing &amp; Behind the Scenes', 'Toosh Alzaeem', 'toosh-alzaeem.html'),
  ('Middle East Lead', 'Vance Serania', 'vance-serania.html'),
  ('Cinematography &amp; Grading', 'Vance Serania', 'vance-serania.html'),
  ('Design &amp; Art Direction', 'Vance Serania', 'vance-serania.html'),
]
cr = '\n'.join(f'      <li data-ed="fade"><span class="cr-role">{r}</span><a class="cr-name" href="{u}">{n}</a></li>' for r, n, u in credits_rows)

team = head('The Team | Aera — Media Studio in Leeds', "Meet the people behind Aera, a small studio working across Leeds, Bournemouth and Dubai.", 'team.html').replace('<link rel="stylesheet" href="assets/css/style.css', '<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@200;300&display=swap" rel="stylesheet">\n<link rel="stylesheet" href="assets/css/style.css', 1) + f'''<!-- TEAM PAGE (Oct 2026)
     A media studio's team page as a film poster: names billed above heads,
     the cast on one stage (pointing at someone lights them and drops the
     rest into shadow; nothing is spotlit at rest), the title over the fade,
     a billing block, then an end-credits roll. Each person opens on
     their own profile page, modelled on Poison Studio's member pages.
     Generated by gen_team.py; edit PEOPLE there rather than by hand. -->
<section class="tm-poster" aria-label="The team">
  <div class="pt-crumb"><span class="ed-label"><a href="index.html">Home</a> &nbsp;/&nbsp; Team</span><span class="ed-label">Leeds &middot; Bournemouth &middot; Dubai</span></div>
  <div class="pt-billtop">{''.join(bill_top)}</div>
  <div class="pt-stage" id="castStage">
{chr(10).join(figs)}
  </div>
  <div class="pt-title">
    <span class="pt-tag" data-ed="fade">Every project close to the heart</span>
    <h1 class="pt-word" data-ed="track">Aera</h1>
    <p class="pt-billing" data-ed="fade">{billing}</p>
  </div>
</section>

<section class="ed tm-credits" aria-label="Credits">
  <span class="ed-drop" data-ed="drop" aria-hidden="true"><i></i></span>
  <h2 class="tm-credits-title" data-ed="track">Credits</h2>
  <ul class="cr-list">
{cr}
  </ul>
  <p class="cr-foot" data-ed="fade">Shot in Leeds, Bournemouth &amp; Dubai</p>
  <div class="ed-center" data-ed="fade"><a class="ed-link" href="mailto:bookings@aerastudios.org?subject=Joining%20Aera">Want in? Say hello</a></div>
</section>

{FOOT}

''' + SCRIPTS
open('team.html', 'w').write(team)

# ---------------- profile pages ----------------
for k, p in enumerate(PEOPLE):
    nxt = PEOPLE[(k + 1) % len(PEOPLE)]
    skills = ''.join(f'<li>{e(s)}</li>' for s in p['skills'])
    links = ''.join(f'<a class="ed-link" href="{u}"{target(u)}>{e(l)}</a>' for l, u in p['links'])
    credits = '\n'.join(f'''      <li><a href="{u}"{target(u)}><i>{j+1:02d}</i><span>{e(n)}</span><em>{e(m)}</em></a></li>''' for j, (n, m, u) in enumerate(p['credits']))
    folio = '\n'.join(f'''    <figure class="pf-shot pf-s{j+1} ed-photo" data-ed="clip"><img src="{u}" loading="lazy" alt="" data-par="0.05"></figure>''' for j, u in enumerate(p['folio']))
    page = head(f"{p['name']} — Team | Aera", f"{p['name']}, {p['role']} at Aera. Based in {p['loc']}.", p['slug'] + '.html') + f'''<!-- PROFILE PAGE · generated by gen_team.py (modelled on Poison Studio's member pages):
     giant first name behind the cutout, a details card that stays put while
     the bio, credits and work scroll past, then the next person in the cast. -->
<header class="pf-hero">
  <div class="pf-top">
    <span class="ed-label"><a href="team.html">Team</a> &nbsp;/&nbsp; {e(p['name'])}</span>
    <span class="ed-label">{e(p['loc'])}</span>
  </div>
  <h1 class="pf-giant" data-ed="rise" aria-label="{e(p['name'])}"><span class="ed-line"><span>{e(p['first'])}</span></span></h1>
  <span class="pf-glow" aria-hidden="true"></span>
  <img class="pf-cut" src="{p['cut']}" alt="{e(p['name'])}" data-ed="fade">
  <div class="pf-tag" data-ed="fade">
    <span class="ed-label">{e(p['role'])}</span>
    <span class="pf-fullname">{e(p['name'])}</span>
  </div>
</header>

<section class="ed pf-body">
  <aside class="pf-card" data-ed="fade">
    <dl>
      <dt>Role</dt><dd>{e(p['role'])}</dd>
      <dt>Based in</dt><dd>{e(p['loc'])}</dd>
      <dt>Specialisms</dt><dd><ul class="pf-skills">{skills}</ul></dd>
    </dl>
    <div class="pf-links">{links}</div>
  </aside>
  <div class="pf-main">
    <p class="pf-bio smask">{e(p['bio'])}</p>
    <div class="pf-credits">
      <div class="ed-label-row" data-ed="draw"><span class="ed-label">Selected credits</span><span class="ed-label ed-num">({len(p['credits']):02d})</span></div>
      <ol class="pf-index">
{credits}
      </ol>
    </div>
  </div>
</section>

<section class="ed pf-work" aria-label="Selected work">
  <div class="ed-label-row" data-ed="draw"><span class="ed-label">Work</span><span class="ed-label">{e(p['first'])}&rsquo;s frames</span></div>
  <div class="pf-spread">
{folio}
  </div>
</section>

<a class="pf-next" href="{nxt['slug']}.html">
  <span class="ed-label pf-next-lbl"><span>Next in the cast</span><span>{e(nxt['role'])}</span></span>
  <span class="pf-next-name">{e(nxt['name'])}</span>
  <img class="pf-next-cut" src="{nxt['cut']}" alt="" loading="lazy">
</a>

{FOOT}

''' + SCRIPTS
    open(p['slug'] + '.html', 'w').write(page)
print('ok')
