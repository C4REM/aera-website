"""SEO pass over every page. Safe to rerun, and should be rerun after
tools/gen_team.py or tools/gen_services.py (they write plain .html links and
empty alts; this tidies both).

What it does to each page:
  * rewrites the <head> meta block: title, description, canonical, robots,
    Open Graph, Twitter card and icons, from the PAGES table below
  * rebuilds the JSON-LD (studio, website, service, person, project,
    breadcrumbs, and an FAQPage read from the FAQ actually on the page)
  * internal links -> clean URLs (Cloudflare Pages 308s /x.html to /x, so a
    .html link or canonical costs a redirect every time)
  * Squarespace images get ?format=1500w instead of the full-size original
  * fills empty alt text on real work photos

    python3 tools/seo_pass.py
"""
import html, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = 'https://aerastudios.org'
OG = SITE + '/assets/img/og/'

PAGES_ORDER = ['index', 'social-media', 'brand-commercial', 'events', 'work', 'team',
               'jack-careem', 'toosh-alzaeem', 'vance-serania',
               'rolls-royce', 'kia-motors', 'headspace', 'never-felt-so-alone', 'i-feel-good', 'green-planet-dubai',
               'photography', 'eid-al-etihad', 'graphic-design', 'on-stage', 'on-set', '404']
SLUGS = set(PAGES_ORDER)

def url(slug):
    return SITE + '/' if slug == 'index' else f'{SITE}/{slug}'

SQ = 'https://images.squarespace-cdn.com/content/v1/67a046e3af281e412f15579a/'

PAGES = {
    'index': dict(
        title='Aera | Photographer, Videographer & Social Media in Leeds',
        desc='Leeds media studio for photography, video and social media. Event coverage, brand and product shoots, and monthly social content across Yorkshire and Dubai.',
        og='og-home.jpg', kind='home'),
    'social-media': dict(
        title='Social Media Agency in Leeds | Content & Management | Aera',
        desc='Social media content and management for Leeds and Yorkshire brands: one shoot a month, reels and posts in one consistent style, posting handled. From £300.',
        og='og-social.jpg', kind='service', service='Social media content and management', crumb='Social Media'),
    'brand-commercial': dict(
        title='Commercial & Product Photography and Video in Leeds | Aera',
        desc='Commercial, product and headshot photography plus brand video for Leeds businesses. Studio-quality images and films, with full usage rights. From £150.',
        og='og-brand.jpg', kind='service', service='Commercial photography and video production', crumb='Brand & Commercial'),
    'events': dict(
        title='Event Photographer & Videographer in Leeds | Aera',
        desc='Event photography and video across Leeds, Yorkshire and Dubai: launches, parties, shows and car meets, with photos and a recap film the same week. From £250.',
        og='og-events.jpg', kind='service', service='Event photography and videography', crumb='Events'),
    'work': dict(
        title='Portfolio | Photography, Film & Design Work | Aera, Leeds',
        desc='Selected work from Aera: brand films for Rolls-Royce and KIA, music videos, event and theatre photography, wildlife, street photography and graphic design.',
        og='og-work.jpg', kind='work'),
    'team': dict(
        title='Meet the Team | Aera, a Leeds & Dubai Media Studio',
        desc='Meet Jack Careem, Toosh Alzaeem and Vance Serania, the photographers and filmmakers behind Aera, working from Leeds, Bournemouth and Dubai.',
        og='og-team.jpg', kind='team'),
    'jack-careem': dict(
        title='Jack Careem, Photographer & Filmmaker in Leeds | Aera',
        desc='Jack Careem is the founder of Aera: a photographer and filmmaker in Leeds shooting music videos, events, motorsport, portraits and brand content.',
        og='og-jack.jpg', kind='person', person='jack'),
    'toosh-alzaeem': dict(
        title='Toosh Alzaeem, Photographer & Videographer | Aera',
        desc='Toosh Alzaeem shoots photo and video for Aera, from live theatre and independent film sets to weddings and travel. Based in Bournemouth.',
        og='og-toosh.jpg', kind='person', person='toosh'),
    'vance-serania': dict(
        title='Vance Serania, Filmmaker & Photographer in Dubai | Aera',
        desc='Vance Serania leads Aera in the Middle East: brand films and photography for Rolls-Royce, KIA Motors and F1rst Motors, shot in Dubai and the UAE.',
        og='og-vance.jpg', kind='person', person='vance'),
    'rolls-royce': dict(
        title='Rolls-Royce Brand Film, Dubai | Aera',
        desc='A Rolls-Royce Spectre brand film shot by Vance Serania on a desert road outside Dubai, with an empty stretch of road and forty minutes of usable light.',
        kind='project', creator='vance', genre='Brand film'),
    'kia-motors': dict(
        title='KIA Motors Campaign, Behind the Scenes | Aera',
        desc='Behind the scenes of a KIA Motors campaign, with Vance Serania as camera assistant on a set of fifty-odd crew, an ARRI Alexa on the ground and a drone above.',
        kind='project', creator='vance', genre='Commercial'),
    'headspace': dict(
        title='Headspace | Award-Winning Short Film by Jack Careem | Aera',
        desc='Headspace: a psychological thriller about one man and the other versions of him, by Jack Careem. UAE Student Film Award winner; screening at HollyShorts MENA 2027.',
        og='og-headspace.jpg', kind='project', creator='jack', genre='Psychological thriller', type='Movie',
        award=['UAE Student Film Award, The Black Sheep Film Festival 2026', 'Best Editing, Dune Creative Festival 2026']),
    'never-felt-so-alone': dict(
        title='Never Felt So Alone | Music Video by Jack Careem | Aera',
        desc='A music video set to Labrinth and Billie Eilish’s Never Felt So Alone, directed by Jack Careem: a man sorting memory from the fact she isn’t coming back.',
        kind='project', creator='jack', genre='Music video'),
    'i-feel-good': dict(
        title='I Feel Good | Short Film for World Ocean Day | Aera',
        desc='A short film for World Ocean Day: a man dances round his flat getting ready for a date and wrecks the planet a little on the way out. Directed by Jack Careem.',
        kind='project', creator='jack', genre='Short film'),
    'green-planet-dubai': dict(
        title='Green Planet Dubai | Wildlife Photography | Aera',
        desc='Wildlife photography inside the Green Planet biodome in Dubai by Jack Careem: birds and animals that mostly did not want to be photographed.',
        kind='project', creator='jack', genre='Wildlife photography'),
    'photography': dict(
        title='Photography | Street, Travel & Portraits | Aera',
        desc='Street, travel and portrait photography by Jack Careem from Leeds, London, Prague and Dubai. Not everything is a project; some of it is the right moment.',
        kind='project', creator='jack', genre='Photography'),
    'eid-al-etihad': dict(
        title='Eid Al Etihad Day Campaign | Aera',
        desc='A UAE National Day (Eid Al Etihad) campaign for a school in Dubai, shot and designed by Jack Careem in three days.',
        kind='project', creator='jack', genre='Campaign'),
    'graphic-design': dict(
        title='Graphic Design | Social Posts & Posters | Aera',
        desc='Social media graphics, event posters and matchday designs by Jack Careem, built around the photography for school and sports clients.',
        kind='project', creator='jack', genre='Graphic design'),
    'on-stage': dict(
        title='On Stage | Theatre Photography | Aera',
        desc='Live theatre photography by Toosh Alzaeem, shot from the stalls and the wings during the real show.',
        kind='project', creator='toosh', genre='Theatre photography'),
    'on-set': dict(
        title='On Set | Behind the Scenes Film Photography | Aera',
        desc='Lighting and behind-the-scenes photography by Toosh Alzaeem on independent film sets.',
        kind='project', creator='toosh', genre='Behind the scenes photography'),
    '404': dict(title='Page not found | Aera', desc='That page has moved or no longer exists. Browse Aera’s film, photography and design work instead.',
                og='og-work.jpg', kind='404'),
}

PEOPLE = {
    'jack': dict(name='Jack Careem', job='Founder, photographer & filmmaker', slug='jack-careem', img='assets/img/team/cast-jack.webp',
                 place='Leeds', same=['https://instagram.com/_c4rem', 'https://c4rem.co.uk']),
    'toosh': dict(name='Toosh Alzaeem', job='Photographer & videographer', slug='toosh-alzaeem', img='assets/img/team/cast-toosh.webp',
                  place='Bournemouth', same=['http://madebyzooshportfolio.com']),
    'vance': dict(name='Vance Serania', job='Middle East lead, filmmaker & photographer', slug='vance-serania', img='assets/img/team/cast-vance.webp',
                  place='Dubai', same=['https://vanceserania.myportfolio.com']),
}

def person_ref(k):
    return {'@id': url(PEOPLE[k]['slug']) + '#person'}

def person_node(k):
    p = PEOPLE[k]
    return {'@type': 'Person', '@id': url(p['slug']) + '#person', 'name': p['name'], 'jobTitle': p['job'],
            'url': url(p['slug']), 'image': f"{SITE}/{p['img']}", 'worksFor': {'@id': SITE + '/#studio'},
            'homeLocation': {'@type': 'Place', 'name': p['place']}, 'sameAs': p['same']}

STUDIO = {
    '@type': 'ProfessionalService', '@id': SITE + '/#studio', 'name': 'Aera', 'alternateName': 'Aera Studios',
    'description': 'Media studio in Leeds and Dubai for photography, video and social media content: event coverage, brand and product shoots, and monthly social content.',
    'url': SITE + '/', 'email': 'bookings@aerastudios.org', 'logo': SITE + '/assets/img/icons/icon-512.png', 'image': OG + 'og-home.jpg',
    'priceRange': '££', 'foundingDate': '2026',
    'address': {'@type': 'PostalAddress', 'addressLocality': 'Leeds', 'addressRegion': 'West Yorkshire', 'addressCountry': 'GB'},
    'areaServed': [{'@type': 'City', 'name': 'Leeds'}, {'@type': 'AdministrativeArea', 'name': 'Yorkshire'},
                   {'@type': 'Country', 'name': 'United Kingdom'}, {'@type': 'City', 'name': 'Dubai'}],
    'founder': person_ref('jack'), 'employee': [person_ref('jack'), person_ref('toosh'), person_ref('vance')],
    'sameAs': ['https://instagram.com/_c4rem'],
    'knowsAbout': ['Event photography', 'Videography', 'Social media management', 'Commercial photography', 'Product photography', 'Brand films', 'Music videos'],
    'hasOfferCatalog': {'@type': 'OfferCatalog', 'name': 'Services', 'itemListElement': [
        {'@type': 'Offer', 'itemOffered': {'@type': 'Service', 'name': 'Social media content and management', 'url': url('social-media')}},
        {'@type': 'Offer', 'itemOffered': {'@type': 'Service', 'name': 'Commercial photography and video production', 'url': url('brand-commercial')}},
        {'@type': 'Offer', 'itemOffered': {'@type': 'Service', 'name': 'Event photography and videography', 'url': url('events')}}]},
}
WEBSITE = {'@type': 'WebSite', '@id': SITE + '/#website', 'url': SITE + '/', 'name': 'Aera', 'inLanguage': 'en-GB', 'publisher': {'@id': SITE + '/#studio'}}

def crumbs(*items):
    return {'@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': u} for i, (n, u) in enumerate(items)]}

def text(s):
    s = re.sub(r'<[^>]+>', '', s)
    return re.sub(r'\s+', ' ', html.unescape(s)).strip()

def faq_from(body):
    qa = re.findall(r'<button class="faq-q"><span>(.*?)</span>.*?<div class="faq-a">(.*?)</div>', body, re.S)
    if not qa:
        return None
    return {'@type': 'FAQPage', 'mainEntity': [
        {'@type': 'Question', 'name': text(q), 'acceptedAnswer': {'@type': 'Answer', 'text': text(a)}} for q, a in qa]}

def offers_from(body):
    rows = re.findall(r'<li class="sv-rate"[^>]*>\s*<h3>(.*?)</h3>\s*<p>(.*?)</p>\s*<span class="sv-price">(.*?)</span>', body, re.S)
    out = []
    for n, d, p in rows:
        o = {'@type': 'Offer', 'name': text(n), 'description': text(d), 'priceCurrency': 'GBP'}
        m = re.search(r'(\d[\d,]*)', text(p))
        if m:
            o['price'] = m.group(1).replace(',', '')
            if 'from' in text(p).lower():
                o['priceSpecification'] = {'@type': 'PriceSpecification', 'minPrice': o['price'], 'priceCurrency': 'GBP'}
        out.append(o)
    return out

def first_image(body):
    m = re.search(r'<img[^>]+src="([^"]+)"', body)
    if not m:
        return None
    src = m.group(1)
    return src if src.startswith('http') else f'{SITE}/{src}'

def graph(slug, body, meta):
    k = meta['kind']; page = url(slug); nodes = []
    home = ('Home', SITE + '/')
    if k == 'home':
        nodes += [STUDIO, WEBSITE, {'@type': 'WebPage', '@id': page + '#page', 'url': page, 'name': meta['title'], 'isPartOf': {'@id': SITE + '/#website'}, 'about': {'@id': SITE + '/#studio'}}]
    elif k == 'service':
        nodes += [{'@type': 'Service', '@id': page + '#service', 'name': meta['service'], 'serviceType': meta['service'], 'url': page,
                   'description': meta['desc'], 'provider': {'@id': SITE + '/#studio'}, 'image': OG + meta['og'],
                   'areaServed': STUDIO['areaServed'], 'offers': offers_from(body)},
                  crumbs(home, (meta['crumb'], page))]
    elif k == 'work':
        nodes += [{'@type': 'CollectionPage', '@id': page + '#page', 'url': page, 'name': 'Selected work', 'isPartOf': {'@id': SITE + '/#website'}},
                  crumbs(home, ('Work', page))]
    elif k == 'team':
        nodes += [{'@type': 'AboutPage', '@id': page + '#page', 'url': page, 'name': 'The team', 'about': {'@id': SITE + '/#studio'},
                   'mainEntity': {'@type': 'ItemList', 'itemListElement': [
                       {'@type': 'ListItem', 'position': i + 1, 'item': person_ref(p)} for i, p in enumerate(['jack', 'toosh', 'vance'])]}},
                  crumbs(home, ('Team', page))]
    elif k == 'person':
        pn = person_node(meta['person'])
        nodes += [{'@type': 'ProfilePage', '@id': page + '#page', 'url': page, 'mainEntity': pn},
                  crumbs(home, ('Team', url('team')), (PEOPLE[meta['person']]['name'], page))]
    elif k == 'project':
        name = re.sub(r'\s*\|.*$', '', meta['title'])
        work = {'@type': meta.get('type', 'CreativeWork'), '@id': page + '#work', 'name': name, 'headline': name, 'url': page, 'description': meta['desc'],
                'genre': meta['genre'], 'image': OG + meta['og'] if meta.get('og') else first_image(body), 'creator': person_ref(meta['creator']),
                'publisher': {'@id': SITE + '/#studio'}}
        if meta.get('award'):
            work['award'] = meta['award']
        nodes += [work,
                  crumbs(home, ('Work', url('work')), (name, page))]
    else:
        return ''
    f = faq_from(body)
    if f and k in ('home', 'service'):
        nodes.append(f)
    return '<script type="application/ld+json">\n' + json.dumps({'@context': 'https://schema.org', '@graph': nodes}, ensure_ascii=False, indent=1) + '\n</script>\n'

def meta_block(slug, meta, body):
    t = meta['title']; d = meta['desc']; page = url(slug)
    og_img = OG + meta['og'] if meta.get('og') else first_image(body) or OG + 'og-home.jpg'
    e = lambda s: html.escape(s, quote=True)
    robots = 'noindex, follow' if slug == '404' else 'index, follow, max-image-preview:large'
    lines = [
        f'<title>{e(t)}</title>',
        f'<meta name="description" content="{e(d)}">',
        f'<meta name="robots" content="{robots}">',
    ]
    if slug != '404':
        lines.append(f'<link rel="canonical" href="{page}">')
    lines += [
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="Aera">',
        '<meta property="og:locale" content="en_GB">',
        f'<meta property="og:title" content="{e(t)}">',
        f'<meta property="og:description" content="{e(d)}">',
        f'<meta property="og:url" content="{page}">',
        f'<meta property="og:image" content="{e(og_img)}">',
        f'<meta property="og:image:alt" content="{e(re.sub(r" \| Aera.*$", "", t))}">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{e(t)}">',
        f'<meta name="twitter:description" content="{e(d)}">',
        f'<meta name="twitter:image" content="{e(og_img)}">',
        '<meta name="theme-color" content="#060607">',
        '<link rel="icon" type="image/svg+xml" href="/assets/img/logo/aera-monogram-favicon.svg">',
        '<link rel="icon" href="/favicon.ico" sizes="any">',
        '<link rel="icon" type="image/png" sizes="96x96" href="/assets/img/icons/favicon-96.png">',
        '<link rel="icon" type="image/png" sizes="48x48" href="/assets/img/icons/favicon-48.png">',
        '<link rel="icon" type="image/png" sizes="32x32" href="/assets/img/icons/favicon-32.png">',
        '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
        '<link rel="mask-icon" href="/assets/img/logo/aera-mask-icon.svg" color="#C2A878">',
        '<link rel="manifest" href="/site.webmanifest">',
    ]
    if meta.get('og'):
        i = lines.index(f'<meta property="og:image" content="{e(og_img)}">')
        lines[i + 1:i + 1] = ['<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">']
    return '\n'.join(lines) + '\n'

HEAD_STRIP = [
    r'<title>.*?</title>\s*', r'<meta name="description"[^>]*>\s*', r'<meta name="robots"[^>]*>\s*', r'<link rel="canonical"[^>]*>\s*',
    r'<meta property="og:[^"]*"[^>]*>\s*', r'<meta name="twitter:[^"]*"[^>]*>\s*', r'<meta name="theme-color"[^>]*>\s*',
    r'<link rel="icon"[^>]*>\s*', r'<link rel="apple-touch-icon"[^>]*>\s*', r'<link rel="mask-icon"[^>]*>\s*', r'<link rel="manifest"[^>]*>\s*',
    r'<script type="application/ld\+json">.*?</script>\s*', r'<!-- SEO -->\s*', r'<!-- /SEO -->\s*',
]

ALTS = {
    'IMG_1199': 'A racing cockpit lit red under the start lights',
    '717cb03f': 'A sandstone building against a violet evening sky',
    'Lando+Photo': 'A McLaren Formula One car at speed',
    'Green+Planet+Photos-12': 'A bird half hidden in rainforest leaves at the Green Planet, Dubai',
    '1J6A0134': 'A footballer with a ball outside a stadium',
    'theatre-finale': 'A full cast throwing their arms up in a theatre finale',
    'theatre-yellow-suit': 'An actor in a yellow check suit under orange stage light',
    'set-clapperboard': 'An actor peeking over a clapperboard on a short film set',
    'wedding-altar': 'A couple at the altar during a wedding ceremony',
    'socotra-dragon-tree': 'Dragon blood trees on Socotra island',
    '4e1dea05': 'A Rolls-Royce Spectre on a desert road outside Dubai',
    '16daea74': 'A KIA campaign shoot on the beach',
    'b8be5e7b': 'A Rolls-Royce brand film still at sunset',
    '008b52cc': 'Behind the scenes on the KIA Motors campaign',
    '0b3cbde8': 'A still from the KIA Motors campaign',
}

def fix_alts(body):
    def rep(m):
        tag = m.group(0)
        if 'alt=""' not in tag or 'aria-hidden' in tag:
            return tag
        src = re.search(r'src="([^"]+)"', tag)
        if not src:
            return tag
        for key, alt in ALTS.items():
            if key in src.group(1):
                return tag.replace('alt=""', f'alt="{alt}"')
        return tag
    # skip images inside aria-hidden containers (svc media, marquee duplicates)
    return re.sub(r'<img\b[^>]*>', rep, body)

def clean_links(s):
    pages = '|'.join(re.escape(p) for p in PAGES_ORDER if p != '404')
    s = re.sub(r'(href=["\'])index\.html(#[^"\']*)?(["\'])', lambda m: f'{m.group(1)}/{m.group(2) or ""}{m.group(3)}', s)
    s = re.sub(rf'(href=["\'])(?:\./|/)?({pages})\.html(#[^"\']*)?(["\'])', lambda m: f'{m.group(1)}/{m.group(2)}{m.group(3) or ""}{m.group(4)}', s)
    # links inside inline JSON (work gallery data)
    s = re.sub(rf'("href":\s*")(?:\./|/)?({pages})\.html(")', r'\1/\2\3', s)
    s = re.sub(rf'(data-href=["\'])(?:\./|/)?({pages})\.html(["\'])', r'\1/\2\3', s)
    return s

def sq_format(s):
    return re.sub(r'(https://images\.squarespace-cdn\.com/[^"\'\s?)]+\.(?:jpe?g|png|JPE?G|PNG))(?=["\'\s)])', r'\1?format=1500w', s)

def process(slug):
    p = ROOT / f'{slug}.html'
    s = p.read_text()
    meta = PAGES[slug]
    hi = s.index('</head>')
    head, body = s[:hi], s[hi:]
    body = fix_alts(sq_format(clean_links(body)))
    for pat in HEAD_STRIP:
        head = re.sub(pat, '', head, flags=re.S)
    head = sq_format(head)
    vp = re.search(r'<meta name="viewport"[^>]*>\n?', head)
    block = '<!-- SEO -->\n' + meta_block(slug, meta, body) + graph(slug, body, meta) + '<!-- /SEO -->\n'
    head = head[:vp.end()] + block + head[vp.end():]
    head = head.replace('<html lang="en">', '<html lang="en-GB">')
    p.write_text(head + body)

def sitemap():
    lastmod = '2026-10-13'
    prio = {'index': '1.0', 'social-media': '0.9', 'brand-commercial': '0.9', 'events': '0.9', 'work': '0.8', 'team': '0.7'}
    rows = []
    for slug in PAGES_ORDER:
        if slug == '404':
            continue
        rows.append(f'  <url><loc>{url(slug)}</loc><lastmod>{lastmod}</lastmod><priority>{prio.get(slug, "0.6")}</priority></url>')
    (ROOT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(rows) + '\n</urlset>\n')

def manifest():
    (ROOT / 'site.webmanifest').write_text(json.dumps({
        'name': 'Aera', 'short_name': 'Aera', 'start_url': '/', 'display': 'browser', 'background_color': '#060607', 'theme_color': '#060607',
        'icons': [{'src': '/assets/img/icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
                  {'src': '/assets/img/icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png'}]}, indent=1) + '\n')

if __name__ == '__main__':
    for slug in PAGES_ORDER:
        process(slug)
        print('seo', slug)
    sitemap(); manifest()
    print('sitemap + manifest written')
