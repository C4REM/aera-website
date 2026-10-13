"""Builds the three service pages (social-media, events, brand-commercial).

Keeps each page's existing <head> (titles, meta, JSON-LD) and rewrites the
<body> in the editorial grammar of the homepage. Safe to rerun: it only ever
replaces everything from <body> to </html>.

    python3 tools/gen_services.py
"""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
CSS_V = '20261013s1'
JS_V = '20261013b'

SQ = 'https://images.squarespace-cdn.com/content/v1/67a046e3af281e412f15579a/'
MP = 'https://cdn.myportfolio.com/306f0dec-b99e-4a9e-a71a-768e23a6c7b5/'

def sq(path, w=1500):
    return f'{SQ}{path}?format={w}w'

IMG = {
    # Vance, Sienna drinks menu (video stills, 16:9)
    'sienna1': MP + 'c6979076-ba84-49f5-803a-d47f2ddb403e_rw_1920.jpg?h=a8741af99f9c56a674d5706e8b55d0f0',
    'sienna2': MP + 'ea009fe7-dad3-405f-867a-a8d555c10eff_rw_1920.jpg?h=0a88af56bf32acacb0aac1bba05ede6a',
    'sienna3': MP + '9ce47b63-c83a-46bd-aaa2-5c72e86701c6_rw_1920.jpg?h=dc1f27b0a072dd1d0c37d6149633165a',
    'sienna4': MP + '3bc731af-6e8f-4baf-b189-63ee1a2516b7_rw_1920.jpg?h=80845641bc426c6165c64e6f5b42a0b7',
    # Vance, MyBrunchFit
    'mb1': MP + 'ed70cf90-e328-4776-89fd-46977ef3a5aa_rw_1920.jpg?h=162659f3d53d5c4ad79c5a90cb17ccff',
    'mb2': MP + '52106944-84c1-4f6b-ab50-4d905ba7c3ab_rw_1920.png?h=d63e1b16f801178ec89f017e7e7b239f',
    'mb3': MP + 'c6ccefd8-0d3b-4678-b948-bcedaf4bea1f_rw_1920.png?h=4062f4edf2644f6149bb93344d959c86',
    'mb4': MP + 'ccc63fbd-c5d8-4895-a771-fe54d74d8b81_rw_1920.png?h=84683bcfc4cb8241f00d19cc57204758',
    # Vance, F1rst Motors
    'fm1': MP + '12b2d31a-fcaa-4996-b4c9-2344356b2a0d_rw_3840.jpg?h=b4d734c385b4222702b0bf9cb7228b31',
    'fm2': MP + '67247d16-4c5c-40cc-872b-a7f78d1ba2f0_rw_1920.png?h=48d6a1fd58afd8bc017287356cf60906',
    'fm3': MP + '15390b93-96b7-4cb3-b49d-cf91dad7540a_rw_1920.png?h=d2f9455db4c042790c20a22b0605ca6f',
    'fm4': MP + '0adb6102-c8c1-4fb8-a7ac-4994ac30603e_rw_1920.png?h=5c26ea65c2411f1a1c673bf79ea17227',
    'fm5': MP + '8a7cd06d-234a-4b0e-a382-796778ecea91_rw_1920.png?h=23210a562ccf7ae1a8356fa84928c0d3',
    'fm7': MP + 'c8f35e8c-80de-4737-954d-46f139d2e1f5_rw_1920.png?h=05f31cc6116271d98b85d47f93388715',
    # Vance, Grand Picnic / Rolls-Royce / KIA
    'picnic': MP + 'd4816740-d960-460e-95c2-f3fb0f562098_rw_1920.png?h=8107a92dc357783fdb08384195bdd396',
    'rolls': MP + '4e1dea05-cfeb-4ec8-8bbb-edff7475ac5f_rwc_0x157x1920x768x1920.jpg?h=6da19d20ea4eb957d336eb7de3dbc5bf',
    'rolls2': MP + 'b8be5e7b-993f-4cd4-a9c8-880f69848b78_rw_1920.JPG?h=8b52edb83f11e442d9eb8da97f27b937',
    'kia': MP + '16daea74-6710-467e-943d-5a01a1150467_rw_3840.jpg?h=7c2bac025a21c60797a1bfc4a38d48bf',
    # Jack
    'lando': sq('d68650ca-1652-44b5-823e-c43abab0b7e2/Lando+Photo.png'),
    'cockpit': sq('13f98449-a6da-4ea8-b125-01a7d5fc40b4/IMG_1199.jpg'),
    'flag': sq('50a7d34c-7a13-43f5-a5da-bc73d671fc8e/UAE+Flag.jpg'),
    'chair': sq('db5c3ac4-da30-40e7-84a7-28a43271390b/IMG_0831.jpg'),
    'chair2': sq('7a30cec9-bb01-4c11-83a4-5442ac014212/1J6A0215.JPG'),
    'ferrari': sq('a5c290e2-e3f5-4aed-81bd-9e8fa29d2e44/A7400277.jpg'),
    'matchday': sq('b2cbb3f8-0cba-49bc-a84c-2d3257ea6781/Personal+Match-Day+Graphic.jpg', 1000),
    'dubaipost': sq('ebc2d86a-43dc-45da-8c9a-9c069df080d2/Insta-Post-Dubai-23-24-_01.jpg', 1000),
    'newyear': sq('b9c30616-8547-45ad-9575-93a6b0c68e50/New+Years+Post.png', 1000),
    'shawarma': sq('42132dc5-16b0-4f8f-ae1f-00521c8662e3/Senior+Shawarma+Poster.png', 1000),
    'football': sq('36620b16-0adc-419f-93ac-0d89016154b2/Football+Photo+Insta+V2+2.PNG', 1000),
    'hauntfest': sq('f5c5d3ac-57b1-4757-ab6c-6ac16ca6e090/Hauntfest++Poster.png', 1000),
    'prague': sq('f678cbf2-e3f8-4fa2-b79f-f14434d0cdfe/Insta+Post+Prague.PNG', 1000),
    # Toosh, school theatre
    'finale': 'assets/img/team/toosh/theatre-finale.jpg',
    'yellow': 'assets/img/team/toosh/theatre-yellow-suit.jpg',
    'green': 'assets/img/team/toosh/theatre-green-suit.jpg',
    'horns': 'assets/img/team/toosh/theatre-horns.jpg',
}

MARK = ('<path d="M100,52 L138,100 L100,148 L62,100 Z" stroke="#C2A878" stroke-width="1.5" opacity="0.5"/>'
        '<path d="M100,60 L70,100 L130,100 Z M100,140 L70,100 M130,100 L100,140 M82,85 L118,85 M82,115 L118,115" '
        'stroke="#C2A878" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>')

def swap(t):
    return f'<span class="swap"><span class="swap-stack"><span>{t}</span><span aria-hidden="true">{t}</span></span></span>'

def chrome_top(page, active):
    links = [('work.html', 'Work'), ('social-media.html', 'Social Media'), ('brand-commercial.html', 'Brand &amp; Commercial'),
             ('events.html', 'Events'), ('index.html#intro', 'Studio'), ('team.html', 'Team'), ('#contact', 'Enquire')]
    nav = '\n'.join(f'    <a href="{h}"{" class=\"active\"" if h == active else ""}>{t}</a>' for h, t in links)
    return f'''<body class="ed-home sv-page sv-{page}">

<div class="bg-stage" aria-hidden="true"></div>
<canvas id="bgGL" aria-hidden="true"></canvas>

<div class="preloader" id="preloader">
  <div class="preloader-inner">
    <svg class="preloader-mark" viewBox="0 0 200 200" fill="none">
      {MARK}
    </svg>
    <span class="preloader-word">AERA</span>
  </div>
</div>
<div class="cursor-dot" id="cursorDot" aria-hidden="true"></div>
<div class="cursor-ring" id="cursorRing" aria-hidden="true"></div>

<nav id="nav">
  <div class="nav-left">
    <button class="burger nav-cell" id="burger" aria-label="Menu" aria-expanded="false" aria-controls="navLinks"><span></span><span></span><span></span></button>
    <a href="#contact" class="nav-cell nav-cta magnetic">Enquire</a>
  </div>
  <a href="index.html" class="brand">
    <svg class="mark" viewBox="61 51 78 98" fill="none">{MARK}</svg>
    AERA
  </a>
  <div class="nav-right">
    <a href="https://instagram.com/_c4rem" target="_blank" rel="noopener" class="nav-cell">{swap("Instagram")}</a>
  </div>
  <div class="nav-links" id="navLinks">
{nav}
  </div>
</nav>
'''

def chrome_bottom():
    foot = '\n'.join(f'      <a href="{h}">{swap(t)}</a>' for h, t in
                     [('work.html', 'Work'), ('social-media.html', 'Social Media'), ('brand-commercial.html', 'Brand &amp; Commercial'), ('events.html', 'Events'), ('team.html', 'Team')])
    return f'''
<footer>
  <div class="wrap">
    <span class="brand-sm" style="display:inline-flex;align-items:center;gap:.4em;justify-content:center">
      <svg width="16" height="16" viewBox="0 0 200 200" fill="none">{MARK}</svg>
      AERA
    </span>
    &copy; <span id="year"></span> Aera Media Studio &middot; Leeds, UK
    <div class="foot-links">
{foot}
    </div>
  </div>
</footer>

<script src="assets/js/lenis.min.js?v=20260803h"></script>
<script src="assets/js/main.js?v=20261012a"></script>
<script src="assets/js/ed-home.js?v=20261012a"></script>
<script src="assets/js/ed-services.js?v={JS_V}"></script>
</body>
</html>
'''

def label_row(left, right, cls=''):
    return f'''  <div class="ed-label-row {cls}" data-ed="draw">
    <span class="ed-label">{left}</span>
    <span class="ed-label">{right}</span>
  </div>'''

def photo(key, alt, ar=None, par=None, cls='', clip=True):
    style = f' style="aspect-ratio:{ar}"' if ar else ''
    p = f' data-par="{par}"' if par else ''
    ed = ' data-ed="clip"' if clip else ''
    return f'<figure class="ed-photo {cls}"{ed}{style}><img src="{IMG[key]}" loading="lazy" alt="{alt}"{p}></figure>'

def rates(head_h2, head_body, rows, note=''):
    items = '\n'.join(f'''    <li class="sv-rate" data-ed="fade">
      <h3>{n}</h3>
      <p>{d}</p>
      <span class="sv-price">{p}</span>
      <a class="ed-link" href="#contact">Enquire</a>
    </li>''' for n, d, p in rows)
    note_html = f'\n  <p class="sv-note" data-ed="fade">{note}</p>' if note else ''
    return f'''
<!-- rates -->
<section class="ed sv-rates-sec" id="rates" aria-label="Rates">
{label_row("Rates", "Early days pricing")}
  <div class="sv-rates-head">
    <h2 class="sv-h2" data-ed="rise">{head_h2}</h2>
    <p class="sv-body" data-ed="fade">{head_body}</p>
  </div>
  <ul class="sv-rates">
{items}
  </ul>{note_html}
</section>
'''

def faq(title1, title2, qa):
    items = '\n'.join(f'''    <div class="faq-item">
      <button class="faq-q"><span>{q}</span><span class="icon">+</span></button>
      <div class="faq-a"><p>{a}</p></div>
    </div>''' for q, a in qa)
    return f'''
<!-- questions -->
<section class="ed ed-faqsec" id="faq" aria-label="Frequently asked questions">
  <div class="ed-faq-head">
    <h2 class="ed-twotone ed-faq-title" data-ed="rise">
      <span class="ed-line"><span>{title1}</span></span>
      <span class="ed-line"><span><em>{title2}</em></span></span>
    </h2>
  </div>
  <div class="faq ed-faq" data-ed="fade">
{items}
  </div>
</section>
'''

def related(items):
    lis = '\n'.join(f'    <li><a href="{h}" data-img="{IMG[k]}"><span class="w">{t}</span><span class="ed-label">{s}</span></a></li>' for h, t, s, k in items)
    return f'''
<!-- elsewhere -->
<section class="ed sv-related" aria-label="Other services">
{label_row("Also from the studio", "Two more ways in")}
  <ul class="sv-rel-list" data-float>
{lis}
  </ul>
</section>
'''

def contact(line1, line2, svc, subject):
    chips = ['Social Media', 'Brand &amp; Commercial', 'Events', 'Not sure yet']
    ch = '\n'.join(f'      <button class="ask-chip{" on" if c == svc else ""}" type="button" aria-pressed="{"true" if c == svc else "false"}" data-svc="{c}">{c}</button>' for c in chips)
    return f'''
<!-- enquire -->
<section class="ed ed-contact contact" id="contact">
  <span class="ed-drop" data-ed="drop" aria-hidden="true"><i></i></span>
  <span class="ed-label" data-ed="fade">Enquire</span>
  <h2 class="ed-ask" data-ed="track">{line1}<br>{line2}</h2>
  <div class="ask-pick" data-ed="fade">
    <span class="ask-pick-label">Pick what you need and it'll fill in the subject line</span>
    <div class="ask-chips">
{ch}
    </div>
  </div>
  <a class="email" href="mailto:bookings@aerastudios.org?subject={subject}" data-ed="fade">bookings@aerastudios.org</a>
  <div class="ed-contact-foot" data-ed="draw">
    <a href="https://instagram.com/_c4rem" target="_blank" rel="noopener">Instagram &middot; @_c4rem</a>
    <span>Leeds &amp; Dubai</span>
  </div>
</section>
'''

# =====================================================================
# SOCIAL MEDIA
# =====================================================================
def social():
    stories = ['sienna2', 'mb2', 'sienna3', 'mb4', 'sienna4', 'mb3']
    story_imgs = '\n'.join(f'          <img src="{IMG[k]}" alt="" {"" if i == 0 else "loading=\"lazy\""}>' for i, k in enumerate(stories))

    def tile(k, cap, alt):
        crop = ' crop' if k.startswith(('sienna', 'mb')) else ''
        return f'      <figure class="sv-tile{crop}" data-ed="fade"><img src="{IMG[k]}" loading="lazy" alt="{alt}"><figcaption>{cap}</figcaption></figure>'
    cols = [
        [('sienna2', 'Sienna &middot; drinks menu', 'A cocktail being poured from a copper shaker'),
         ('matchday', 'Matchday graphic', 'A matchday graphic for a footballer'),
         ('mb2', 'MyBrunchFit &middot; campaign', 'Two women in party dresses against a white wall'),
         ('prague', 'Prague &middot; post', 'A street portrait in Prague laid out as an Instagram post')],
        [('dubaipost', 'Dubai 23/24 &middot; carousel', 'A boat on open water laid out as an Instagram post'),
         ('sienna4', 'Sienna &middot; reel still', 'A finished cocktail on the bar'),
         ('newyear', 'New Year &middot; post', 'Two friends watching a sunset, with a Happy New Year title'),
         ('shawarma', 'Event poster', 'A poster for a sixth form shawarma event')],
        [('football', 'Season opener &middot; post', 'A football team in a huddle with an Instagram caption'),
         ('mb3', 'MyBrunchFit &middot; launch', 'Two women carrying shopping bags in a white room'),
         ('hauntfest', 'Hauntfest &middot; poster', 'A Halloween event poster with a bat'),
         ('sienna3', 'Sienna &middot; reel still', 'A cocktail glass filling with a frothy pour')],
    ]
    pars = ['0.06', '-0.05', '0.1']
    col_html = '\n'.join(f'    <div class="sv-col" data-par="{pars[i]}">\n' + '\n'.join(tile(*t) for t in c) + '\n    </div>' for i, c in enumerate(cols))

    return chrome_top('social', 'social-media.html') + f'''
<!-- 1 · hero: the feed, playing -->
<header class="sv-hero" id="top">
{label_row('<a href="index.html">Aera</a> &nbsp;/&nbsp; Social media', 'Instagram &middot; TikTok &middot; Reels')}
  <div class="sv-hero-grid">
    <div class="sv-hero-text">
      <h1 class="sv-title" data-ed="rise">
        <span class="ed-line"><span>A feed people</span></span>
        <span class="ed-line"><span><em>stop on.</em></span></span>
      </h1>
      <p class="sv-lede" data-ed="fade">Content, management and a bit of strategy for brands that want a feed people stop scrolling for, instead of one that quietly dies every March.</p>
      <div class="sv-acts" data-ed="fade">
        <a class="ed-link" href="#contact">Start a conversation</a>
        <a class="ed-link" href="#rates">See the rates</a>
      </div>
    </div>
    <div class="sv-phone-wrap" data-ed="fade">
      <div class="sv-phone" role="img" aria-label="Stories from Sienna and MyBrunchFit, shot by Vance Serania">
        <div class="sv-screen">
{story_imgs}
          <div class="sv-bars"></div>
          <div class="sv-handle"><i></i>aerastudios <span>&middot; now</span></div>
          <div class="sv-reply">Send message</div>
        </div>
      </div>
      <p class="sv-phone-cap sv-credit">Shot by <b>Vance Serania</b></p>
    </div>
  </div>
</header>

<!-- 2 · the point -->
<section class="ed sv-statement" aria-label="How we think about a feed">
  <p class="smask">Most accounts don&rsquo;t run out of things to post. They run out of a look. We plan a month at a time, shoot it in one go and cut everything to one style, so the feed reads like it all came from <em>the same brand.</em></p>
</section>

<!-- 3 · the feed, three columns drifting at their own pace -->
<section class="ed sv-feed" aria-label="Recent social work">
{label_row("From the feed", "Posts, reels &amp; graphics")}
  <div class="sv-feed-head">
    <h2 class="sv-h2" data-ed="rise"><span class="ed-line"><span>Things we&rsquo;ve</span></span><span class="ed-line"><span><em>put on phones.</em></span></span></h2>
    <p class="sv-body" data-ed="fade">Real posts, reels and graphics the team has made for clients, schools and events.</p>
  </div>
  <div class="sv-cols">
{col_html}
  </div>
</section>

<!-- 4 · the ones who stayed -->
<section class="ed sv-cases" aria-label="Ongoing clients">
{label_row("Clients", "Ongoing work")}
  <h2 class="sv-h2 sv-cases-head" data-ed="rise"><span class="ed-line"><span>The ones</span></span><span class="ed-line"><span><em>who came back.</em></span></span></h2>

  <article class="sv-case">
    {photo('sienna1', 'A bartender pouring a cocktail into a coupe glass', par='0.05')}
    <div class="sv-case-text" data-ed="fade">
      <h3 class="sv-case-name">Sienna</h3>
      <p class="sv-body">The brief was a new drink for the menu, and making it look as good on a phone as it does on the bar. Controlled light, a lot of reflections in the glass, and a lot of patience with a cocktail shaker.</p>
      <p class="sv-body">Vance does the same every month for City Social: each time a new dish or drink goes on, it gets filmed for their feed.</p>
      <dl><dt>Type</dt><dd>Hospitality &middot; menu content</dd><dt>Shot by</dt><dd><a href="vance-serania.html">Vance Serania</a></dd></dl>
    </div>
  </article>

  <article class="sv-case flip">
    {photo('mb1', 'Two women in red dresses toasting beside a Christmas tree', par='0.05')}
    <div class="sv-case-text" data-ed="fade">
      <h3 class="sv-case-name">MyBrunchFit</h3>
      <p class="sv-body">Someone in another client&rsquo;s group asked Vance for his number on a shoot. Three projects later he&rsquo;s the brand&rsquo;s main photographer and videographer.</p>
      <p class="sv-body">This was their first clothing shoot: two looks, one white room, and a Christmas tree doing a lot of work.</p>
      <dl><dt>Type</dt><dd>Fashion &middot; campaign</dd><dt>Shot by</dt><dd><a href="vance-serania.html">Vance Serania</a></dd></dl>
    </div>
  </article>
</section>

<!-- 5 · a month, in four weeks -->
<section class="ed sv-month" aria-label="How a month runs">
  <div class="sv-month-head">
    <h2 class="sv-h2" data-ed="rise"><span class="ed-line"><span>How a month</span></span><span class="ed-line"><span><em>actually runs.</em></span></span></h2>
    <span class="ed-label" data-ed="fade">You&rsquo;re needed for one of these</span>
  </div>
  <div class="sv-weeks">
    <div class="sv-week is-you" data-ed="fade"><span class="ed-label">Week one</span><h3>A call and a plan</h3><p>We talk about what&rsquo;s coming up for you that month, then agree a simple content calendar so shoot day isn&rsquo;t spent deciding things.</p></div>
    <div class="sv-week" data-ed="fade"><span class="ed-label">Week two</span><h3>One shoot day</h3><p>Stills and reels in one focused session. We&rsquo;re not turning up every week to get in your staff&rsquo;s way.</p></div>
    <div class="sv-week" data-ed="fade"><span class="ed-label">Week three</span><h3>The edit</h3><p>Everything cut to the same look, captions drafted, and sent over for a once-over.</p></div>
    <div class="sv-week" data-ed="fade"><span class="ed-label">Week four</span><h3>Posting</h3><p>Ready-to-post files, or scheduled for you if you&rsquo;d rather never open the app.</p></div>
  </div>
</section>
''' + rates(
        '<span class="ed-line"><span>Rates while</span></span><span class="ed-line"><span><em>we&rsquo;re new at this.</em></span></span>',
        'Start with one shoot to see if it&rsquo;s useful, or go straight to a monthly arrangement if you already know it will be. No minimum contract either way.',
        [('Starter content set', 'One shoot, no commitment. Hero stills and two or three reels.', 'from &pound;300'),
         ('Monthly partner', 'A shoot day every month with the content calendar included. Pause or stop whenever.', '&pound;300 to &pound;500 a month'),
         ('Full management', 'Content, posting and strategy, quoted to your platforms and what you want from them.', 'Quoted')]
    ) + faq('Good to know', 'before you email.', [
        ('Do you post on our behalf or just create content?', 'Either. Content-only hands everything back for you to post. Full management means we post and schedule it too, so you can stop thinking about it.'),
        ('What if we just want a one-off shoot?', 'That&rsquo;s what the starter content set is. One shoot, no ongoing commitment, and no follow-up call trying to upsell you.'),
        ('Which platforms do you create for?', 'Mostly Instagram and TikTok, formatted for wherever your audience actually is rather than whatever&rsquo;s trendy that week.'),
        ('Is there a minimum contract length?', 'No. Monthly means monthly. Pause or stop whenever it stops being useful to you.'),
    ]) + related([
        ('brand-commercial.html', 'Brand &amp; Commercial', 'Product &middot; portrait &middot; campaign', 'fm2'),
        ('events.html', 'Events', 'Launches &middot; nights &middot; shows', 'finale'),
    ]) + contact('Whose feed', 'are we fixing?', 'Social Media', 'Aera%20enquiry%20%E2%80%94%20Social%20Media') + chrome_bottom()

# =====================================================================
# EVENTS
# =====================================================================
def events():
    cues = [
        ('2 wks', 'Before', 'The brief', 'Tell us what it is, how long it runs and where the content is going. We&rsquo;ll say honestly if half a day is enough.', None),
        ('18:00', 'Doors', 'In before the guests', 'The room while it&rsquo;s still clean: the setup, the details, the things the venue spent money on, before three hundred people fill it.', ('cockpit', 'A racing cockpit lit red, before the doors open')),
        ('20:30', 'The middle of it', 'Moving with it', 'Working around the event rather than stopping it every five minutes for one more shot. Nobody is paying to watch someone find their settings.', ('finale', 'A full cast throwing their arms up in a theatre finale')),
        ('+4 days', 'After', 'Same-week edit', 'Stills and a short recap film, turned around while it&rsquo;s still worth posting rather than three weeks later when nobody cares.', None),
        ('+7 days', 'Delivered', 'Yours to use', 'A shareable gallery and the edit, with full usage rights. Use it however you like.', None),
    ]
    cue_html = '\n'.join(
        f'''    <li class="sv-cue" data-time="{t}" data-when="{w}">
      <span class="ed-label">{t} &middot; {w}</span>
      <h3>{h}</h3>
      <p>{p}</p>{"" if not ph else chr(10) + "      " + photo(ph[0], ph[1])}
    </li>''' for t, w, h, p, ph in cues)

    frames = [('yellow', 'School theatre', 'Toosh Alzaeem', 'An actor in a yellow check suit under orange stage light'),
              ('lando', 'Race day', 'Jack Careem', 'A McLaren Formula One car at speed'),
              ('horns', 'School theatre', 'Toosh Alzaeem', 'A performer in horns singing in front of stained glass'),
              ('picnic', 'Grand Picnic, Dubai', 'Vance Serania', 'A blue Ford GT on the lawn at a car meet'),
              ('green', 'School theatre', 'Toosh Alzaeem', 'An actor in a sparkling green suit and top hat'),
              ('flag', 'Eid Al Etihad', 'Jack Careem', 'The UAE flag against a pale sky')]
    frame_html = '\n'.join(f'''    <figure class="sv-frame">
      <div class="ed-photo"><img src="{IMG[k]}" loading="lazy" alt="{alt}" draggable="false"></div>
      <figcaption class="sv-credit">{ev} &middot; <b>{who}</b></figcaption>
    </figure>''' for k, ev, who, alt in frames)

    return chrome_top('events', 'events.html') + f'''
<!-- 1 · hero: one full-bleed night -->
<header class="sv-hero" id="top">
  <figure class="sv-night"><img src="{IMG['picnic']}" alt="A blue Ford GT on the lawn at the Grand Picnic car meet in Dubai, crowd behind it"></figure>
{label_row('<a href="index.html">Aera</a> &nbsp;/&nbsp; Events', 'Launches &middot; nights &middot; shows')}
  <div class="sv-hero-in">
    <h1 class="sv-title" data-ed="rise">
      <span class="ed-line"><span>Event coverage</span></span>
      <span class="ed-line"><span><em>that keeps up.</em></span></span>
    </h1>
    <div class="sv-hero-foot">
      <p class="sv-lede" data-ed="fade">Parties, launches, car meets, theatre and the odd chaotic corporate away-day. Covered with some actual energy, and edited fast enough that it&rsquo;s still worth posting.</p>
      <p class="sv-credit" data-ed="fade">Grand Picnic, Dubai &middot; <b>Vance Serania</b></p>
    </div>
  </div>
</header>

<!-- 2 · run of show: the clock keeps time with the scroll -->
<section class="ed" aria-label="How the night runs">
{label_row("Run of show", "A typical evening job")}
  <div class="sv-ros">
    <div class="sv-ros-side">
      <h2 class="sv-h2" data-ed="rise"><span class="ed-line"><span>How the night</span></span><span class="ed-line"><span><em>runs.</em></span></span></h2>
      <span class="sv-clock" aria-hidden="true"><span>2 wks</span></span>
      <span class="ed-label sv-clock-sub" aria-hidden="true">Before</span>
      <div class="sv-ros-line" aria-hidden="true"><i></i></div>
    </div>
    <ol class="sv-cues">
{cue_html}
    </ol>
  </div>
</section>

<!-- 3 · frames from the floor, dragged through -->
<section class="ed sv-strip-sec" aria-label="Event photography">
  <div class="sv-strip-head">
    <h2 class="sv-h2" data-ed="rise"><span class="ed-line"><span>From the</span></span><span class="ed-line"><span><em>floor.</em></span></span></h2>
    <span class="ed-label sv-drag-hint" data-ed="fade">Drag or swipe <i></i></span>
  </div>
  <div class="sv-strip" tabindex="0" aria-label="Event photographs, scroll sideways">
{frame_html}
  </div>
  <div class="sv-strip-bar" aria-hidden="true"><i></i></div>
</section>

<!-- 4 · on the night / after it -->
<section class="ed" aria-label="What you get">
  <div class="sv-two">
    <h2 class="sv-h2" data-ed="rise"><span class="ed-line"><span>What you</span></span><span class="ed-line"><span><em>get back.</em></span></span></h2>
    <div class="sv-two-cols" data-ed="fade">
      <div>
        <h3 class="ed-label">On the night</h3>
        <ul>
          <li>Stills and video, same team<span>So the photos and the film look like the same night</span></li>
          <li>Someone who stays out of the way<span>Guests shouldn&rsquo;t remember being photographed</span></li>
          <li>A few teasers the same evening<span>If you want something up before people get home</span></li>
        </ul>
      </div>
      <div>
        <h3 class="ed-label">After it</h3>
        <ul>
          <li>An edited gallery within the week<span>Not two hundred near-duplicates</span></li>
          <li>A 60 to 90 second recap film<span>Cut to the atmosphere, not a slideshow with music</span></li>
          <li>Full usage rights<span>Post it, print it, put it in the sponsor deck</span></li>
        </ul>
      </div>
    </div>
  </div>
</section>
''' + rates(
        '<span class="ed-line"><span>Priced to</span></span><span class="ed-line"><span><em>the night.</em></span></span>',
        'Priced to the size of the event, not a flat rate that punishes small ones. You&rsquo;ll get a final number once we know the brief.',
        [('Half day', 'Up to four hours on site, an edited stills gallery, and a 48-hour turnaround if you need it.', 'from &pound;250'),
         ('Full day', 'A full day on site, stills and a short recap edit, delivered the same week.', 'from &pound;450'),
         ('Multi-day or festival', 'Coverage across several days, with the scope and team size built around it.', 'from &pound;600')],
        'Running a uni society or charity event on basically no budget? Ask anyway. We were a uni society two minutes ago too.'
    ) + faq('Good to know', 'before the night.', [
        ('How quickly do we get photos back?', 'Same week as standard. If it&rsquo;s time-sensitive, like press or a launch, say so and we&rsquo;ll move faster.'),
        ('Can you cover multi-day events?', 'Yes, quoted to however many days you actually need covered rather than a fixed package that doesn&rsquo;t fit.'),
        ('Do you shoot video and stills together?', 'Usually, yes. Same team, same day, so the stills and the recap edit look like they belong together.'),
        ('What&rsquo;s included in the recap edit?', 'A 60 to 90 second highlight film that captures the atmosphere, not a slideshow with music slapped over it.'),
    ]) + related([
        ('social-media.html', 'Social Media', 'Posts &middot; reels &middot; management', 'sienna2'),
        ('brand-commercial.html', 'Brand &amp; Commercial', 'Product &middot; portrait &middot; campaign', 'fm2'),
    ]) + contact('What&rsquo;s the', 'date?', 'Events', 'Aera%20enquiry%20%E2%80%94%20Events') + chrome_bottom()

# =====================================================================
# BRAND & COMMERCIAL
# =====================================================================
def brand():
    shots = [('Product &amp; detail', 'F1rst Motors', 'fm3', 'The GT2 RS badge on a white Porsche'),
             ('Portraits &amp; personal brand', 'Personal brand', 'chair', 'A man in white on a chair at the water&rsquo;s edge at sunset'),
             ('Campaign film', 'Rolls-Royce', 'rolls', 'A Rolls-Royce on a desert road outside Dubai'),
             ('Fashion &amp; lifestyle', 'MyBrunchFit', 'mb4', 'Two women in red dresses by a window'),
             ('On set, as crew', 'KIA Motors', 'kia', 'A KIA campaign shoot on the beach')]
    shot_html = '\n'.join(f'''    <li class="sv-shot" data-img="{IMG[k]}" data-ed="fade">
      <h3>{t}</h3>
      <figure class="ed-photo sv-thumb"><img src="{IMG[k]}" loading="lazy" alt="{alt}"></figure>
      <span class="ed-label">{c}</span>
    </li>''' for t, c, k, alt in shots)

    prints = [
        ('F1rst ', 'Motors', 'fm2', 'A white Porsche GT2 RS in a white studio',
         ['Vance emailed dealership after dealership in Dubai and collected a lot of polite no&rsquo;s. Then one of the biggest in the region said yes: an account with 2.8 million followers.',
          'A GT2 RS, a white studio and a day to make it look like the poster on somebody&rsquo;s wall.'],
         'Car dealership &middot; 2024', None),
        ('Rolls', '&#8209;Royce', 'rolls2', 'A Rolls-Royce on a single stretch of desert road',
         ['A film shot on one stretch of road in the desert outside Dubai. The job came the way the good ones usually do: someone who had seen Vance&rsquo;s work put his name forward.'],
         'Brand film &middot; Dubai', 'rolls-royce.html'),
        ('KIA ', 'Motors', 'kia', 'A KIA campaign set on the beach',
         ['Fifty-odd people on set, an ARRI Alexa on the ground and a drone in the air. Vance was camera assistant, which on a set that size means learning how a proper production holds its schedule together.',
          'Knowing how a big set runs is why our small ones run on time.'],
         'Campaign &middot; on set', 'kia-motors.html'),
    ]
    def print_card(i, a, b, k, alt, paras, meta, link):
        ps = ''.join(f'<p class="sv-body">{p}</p>' for p in paras)
        lk = f'<a class="ed-link" href="{link}">The full story</a>' if link else '<span class="sv-credit">Shot by <b>Vance Serania</b></span>'
        return f'''    <article class="sv-print" style="--i:{i}">
      <figure class="ed-photo"><img src="{IMG[k]}" loading="lazy" alt="{alt}"></figure>
      <div class="sv-print-text">
        <div>
          <span class="ed-label sv-kicker">{meta}</span>
          <h3 class="sv-case-name">{a}<em>{b}</em></h3>
          {ps}
        </div>
        <div class="sv-print-foot"><span class="ed-label">Brief {["one", "two", "three"][i]}</span>{lk}</div>
      </div>
    </article>'''
    prints_html = '\n'.join(print_card(i, *p) for i, p in enumerate(prints))

    frames = [('Call', 'fm7', 'Discovery call', 'A real conversation about your brand and what these images need to do, rather than a form to fill in.'),
              ('Plan', 'mb2', 'Shot list &amp; styling', 'A simple plan agreed up front, so shoot day doesn&rsquo;t turn into standing around deciding things.'),
              ('Shoot', 'kia', 'Shoot day', 'On location or in a studio, worked through properly. If a shot isn&rsquo;t right it gets reshot.'),
              ('Deliver', 'fm5', 'Edited delivery', 'A finished gallery, ready to go straight onto your website and socials.')]
    frame_html = '\n'.join(f'''      <div class="frame">
        <div class="frame-inner">
          <span class="frame-num">{n}</span>
          <div class="frame-shot"><img src="{IMG[k]}" loading="lazy" alt="{t}"></div>
          <h4>{t}</h4>
          <p>{p}</p>
        </div>
      </div>''' for n, k, t, p in frames)

    return chrome_top('brand', 'brand-commercial.html') + f'''
<!-- 1 · hero: the studio frame -->
<header class="sv-hero" id="top">
{label_row('<a href="index.html">Aera</a> &nbsp;/&nbsp; Brand &amp; commercial', 'Product &middot; portrait &middot; campaign')}
  <h1 class="sv-title" data-ed="rise">
    <span class="ed-line"><span>Brand content</span></span>
    <span class="ed-line"><span><em>with a studio finish.</em></span></span>
  </h1>
  <p class="sv-lede" data-ed="fade">Product shots, portraits and campaign work that make a small business look like it has a marketing department. It doesn&rsquo;t. It has us.</p>
  <div class="sv-acts" data-ed="fade">
    <a class="ed-link" href="#contact">Start a shoot</a>
    <a class="ed-link" href="#rates">See the rates</a>
  </div>
  <figure class="sv-wide">
    {photo('fm1', 'A white Porsche GT2 RS under a light panel in a white studio, F1rst Motors on the wall', par='0.06')}
    <figcaption><span class="sv-credit">F1rst Motors, Dubai &middot; <b>Vance Serania</b></span><span class="ed-label">GT2 RS &middot; studio</span></figcaption>
  </figure>
</header>

<!-- 2 · shot list: point at a line, see the picture -->
<section class="ed sv-shots-sec" aria-label="What we shoot">
{label_row("Shot list", "What we photograph &amp; film")}
  <div class="sv-shots-head">
    <h2 class="sv-h2" data-ed="rise"><span class="ed-line"><span>What we</span></span><span class="ed-line"><span><em>point it at.</em></span></span></h2>
    <p class="sv-body" data-ed="fade">Most businesses don&rsquo;t need an agency retainer. They need one properly good shoot: hero images for the site, product stills that weren&rsquo;t lit with a phone torch, portraits that don&rsquo;t look like stock.</p>
  </div>
  <ol class="sv-shots" data-float>
{shot_html}
  </ol>
</section>

<!-- 3 · three briefs, stacked like prints -->
<section class="ed sv-stack-sec" aria-label="Three briefs">
{label_row("Briefs", "Recent commercial work")}
  <h2 class="sv-h2 sv-stack-head" data-ed="rise"><span class="ed-line"><span>Three briefs,</span></span><span class="ed-line"><span><em>start to finish.</em></span></span></h2>
  <div class="sv-stack">
{prints_html}
  </div>
</section>

<!-- 4 · how a shoot comes together: the contact sheet (main.js) -->
<section id="process" class="csheet">
  <div class="csheet-track">
    <div class="csheet-pin">
      <div class="wrap" style="margin-bottom:clamp(24px,4vh,44px)">
        <span class="ed-label">How it works</span>
        <h2 class="section-title" style="margin-top:14px">How a shoot <em>comes together.</em></h2>
      </div>
      <div class="csheet-row">
{frame_html}
      </div>
      <div class="csheet-foot">
        <div class="csheet-bar"><span></span></div>
        <div class="csheet-count"><b>01</b> / 04</div>
      </div>
    </div>
  </div>
</section>
''' + rates(
        '<span class="ed-line"><span>Rates before</span></span><span class="ed-line"><span><em>we know better.</em></span></span>',
        'Priced so trying us once doesn&rsquo;t feel like a commitment. Full usage rights come with every image, with no re-licensing later.',
        [('Portrait or product session', 'One location, up to two hours, 10 to 15 edited images. Good for headshots or a small range.', 'from &pound;150'),
         ('Content day', 'Half a day on site, 20 to 30 edited images, hero stills and a short reel.', 'from &pound;250'),
         ('Ongoing commercial partner', 'Recurring product or campaign shoots, quoted to your catalogue and schedule.', 'Quoted')]
    ) + faq('Good to know', 'before the shoot.', [
        ('What&rsquo;s included in a content day?', 'Half a day on site covering hero stills, product or interior shots and a short reel. Usually 20 to 30 edited images, not two hundred near-duplicates.'),
        ('Do you shoot product photography for e-commerce?', 'Yes. Clean, consistent stills that actually match each other, quoted per session or per range.'),
        ('Can I get headshots for my team?', 'Yes, individually or as a group, at your workplace or somewhere that isn&rsquo;t a plain grey wall.'),
        ('How do I use the images?', 'However you like. Full usage rights come with every delivered image.'),
    ]) + related([
        ('social-media.html', 'Social Media', 'Posts &middot; reels &middot; management', 'sienna2'),
        ('events.html', 'Events', 'Launches &middot; nights &middot; shows', 'finale'),
    ]) + contact('What are', 'we shooting?', 'Brand &amp; Commercial', 'Aera%20enquiry%20%E2%80%94%20Brand%20%26%20Commercial') + chrome_bottom()


def write(name, body):
    p = ROOT / name
    s = p.read_text()
    head = s[:s.index('<body')]
    head = re.sub(r'assets/css/style\.css\?v=[^"]+', f'assets/css/style.css?v={CSS_V}', head)
    if "classList.add('ed-js')" not in head:
        head = head.replace('<link rel="stylesheet" href="assets/css/style.css',
                            "<script>document.documentElement.classList.add('ed-js')</script>\n<link rel=\"stylesheet\" href=\"assets/css/style.css", 1)
    p.write_text(head + body)
    print('wrote', name)

if __name__ == '__main__':
    write('social-media.html', social())
    write('events.html', events())
    write('brand-commercial.html', brand())
