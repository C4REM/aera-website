"""Social share cards (1200x630) and PNG icons for every main page.

Run from the repo root:  python3 tools/og_cards.py
Writes assets/img/og/*.jpg and assets/img/icons/*.png.

Makcasa's free licence renders digits and dashes as blanks or watermarks, so
card titles must not contain either (the script refuses them).
"""
import pathlib, re
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets/img/og'
ICONS = ROOT / 'assets/img/icons'
OUT.mkdir(parents=True, exist_ok=True)
ICONS.mkdir(parents=True, exist_ok=True)

MAKCASA = str(ROOT / 'assets/fonts/Makcasa-Regular.ttf')
INTER = '/usr/share/fonts/opentype/inter/Inter-Regular.otf'
OBSIDIAN = (6, 6, 7)
CREAM = (234, 223, 205)
CREAM_DIM = (183, 174, 156)
CHAMPAGNE = (194, 168, 120)
W, H = 1200, 630


def mark(draw, cx, cy, s, colour=CHAMPAGNE):
    """The diamond of two A's, from the logo SVG (viewBox 0 0 200 200)."""
    def p(x, y):
        return (cx + (x - 100) * s, cy + (y - 100) * s)
    outline = [p(100, 52), p(138, 100), p(100, 148), p(62, 100), p(100, 52)]
    draw.line(outline, fill=colour + (120,) if draw.im.mode == 'RGBA' else tuple(int(c*0.55+o*0.45) for c,o in zip(colour,OBSIDIAN)), width=max(1, int(1.5 * s)))
    w = max(2, int(7 * s))
    for seg in [[p(100, 60), p(70, 100), p(130, 100), p(100, 60)],
                [p(100, 140), p(70, 100)], [p(130, 100), p(100, 140)],
                [p(82, 85), p(118, 85)], [p(82, 115), p(118, 115)]]:
        draw.line(seg, fill=colour, width=w, joint='curve')


def cover(img, w, h, fx=0.5, fy=0.5):
    iw, ih = img.size
    sc = max(w / iw, h / ih)
    img = img.resize((round(iw * sc), round(ih * sc)), Image.LANCZOS)
    iw, ih = img.size
    x = int((iw - w) * fx); y = int((ih - h) * fy)
    return img.crop((x, y, x + w, y + h))


def tracked(draw, xy, text, font, fill, spacing):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + spacing
    return x


def card(name, photo, title, kicker, fx=0.5, fy=0.5, photo_side='full', cutouts=None):
    if re.search(r'[0-9\-–—]', title):
        raise ValueError(f'{name}: Makcasa cannot render digits or dashes: {title!r}')
    base = Image.new('RGB', (W, H), OBSIDIAN)
    if photo:
        im = Image.open(ROOT / photo).convert('RGB')
        if photo_side == 'right':
            pw = 560
            ph = cover(im, pw, H, fx, fy)
            base.paste(ph, (W - pw, 0))
            # soft edge into the black
            mask = Image.new('L', (pw, H), 255)
            md = ImageDraw.Draw(mask)
            for i in range(160):
                md.line([(i, 0), (i, H)], fill=int(255 * i / 160))
            base.paste(Image.new('RGB', (pw, H), OBSIDIAN), (W - pw, 0), Image.eval(mask, lambda v: 255 - v))
        else:
            ph = cover(im, W, H, fx, fy)
            base.paste(ph, (0, 0))
            shade = Image.new('L', (W, H), 0)
            sd = ImageDraw.Draw(shade)
            for x in range(W):
                a = int(245 * max(0, 1 - x / (W * 0.85)) ** 1.1)
                sd.line([(x, 0), (x, H)], fill=a)
            base = Image.composite(Image.new('RGB', (W, H), OBSIDIAN), base, shade)
    if cutouts:
        glow = Image.new('RGB', (W, H), OBSIDIAN)
        gd = ImageDraw.Draw(glow)
        gd.ellipse((620, 120, 1240, 760), fill=(60, 44, 26))
        base = Image.blend(base, glow.filter(ImageFilter.GaussianBlur(120)), 0.9)
        n = len(cutouts)
        slot = 560 / n
        for i, c in enumerate(cutouts):
            cim = Image.open(ROOT / c).convert('RGBA')
            hgt = 600 if n == 1 else 470
            cim = cim.resize((int(cim.width * hgt / cim.height), hgt), Image.LANCZOS)
            cx = int(640 + slot * (i + 0.5) - cim.width / 2)
            base.paste(cim, (cx, H - hgt + (0 if n == 1 else 10)), cim)

    d = ImageDraw.Draw(base, 'RGBA')
    mark(d, 92, 92, 0.52)
    word = ImageFont.truetype(MAKCASA, 30)
    tracked(d, (128, 76), 'AERA', word, CREAM, 9)
    small = ImageFont.truetype(INTER, 17)
    tracked(d, (72, 482), kicker.upper(), small, CHAMPAGNE, 4)
    size = 78
    font = ImageFont.truetype(MAKCASA, size)
    lines = title.split('\n')
    limit = 540 if photo_side == 'right' or cutouts else 600
    while max(d.textlength(l, font=font) for l in lines) > limit and size > 40:
        size -= 4; font = ImageFont.truetype(MAKCASA, size)
    y = 450 - len(lines) * size * 1.08
    for l in lines:
        d.text((70, y), l, font=font, fill=CREAM)
        y += size * 1.08
    tracked(d, (72, 560), 'AERASTUDIOS.ORG', ImageFont.truetype(INTER, 14), CREAM_DIM, 4)
    base.save(OUT / f'{name}.jpg', quality=86, optimize=True, progressive=True)
    print('card', name)


def icons():
    """Opaque obsidian squares with the mark filling ~87% of the tile height.

    Safari and Google both show the icon tiny; at the old 68% fill the mark
    read as a speck and Safari's light tab bar showed round the edge. Sizes
    are multiples of 48 because that's what Google's search favicon wants.
    """
    FILL = 110  # mark units per tile: the diamond is 96 tall, so ~87% fill with a hair of margin
    sizes = [(180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png'),
             (32, 'favicon-32.png'), (48, 'favicon-48.png'), (96, 'favicon-96.png')]
    for size, name in sizes:
        big = size * 4
        im = Image.new('RGB', (big, big), OBSIDIAN)
        mark(ImageDraw.Draw(im), big / 2, big / 2, big / FILL)
        im.resize((size, size), Image.LANCZOS).save(ICONS / name)
        print('icon', name)
    big = 256 * 4
    im = Image.new('RGB', (big, big), OBSIDIAN)
    mark(ImageDraw.Draw(im), big / 2, big / 2, big / FILL)
    im.resize((256, 256), Image.LANCZOS).save(ROOT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print('icon favicon.ico')
    # Safari asks for these at the site root no matter what the page links to;
    # a 404 there is what made it draw a tiny icon on a white tile.
    import shutil
    for n in ('apple-touch-icon.png', 'apple-touch-icon-precomposed.png'):
        shutil.copy(ICONS / 'apple-touch-icon.png', ROOT / n)


if __name__ == '__main__':
    card('og-home', 'assets/img/quote-stage.jpg', 'Photography, film\n& social content', 'Media studio · Leeds & Dubai', fx=0.5)
    card('og-social', 'assets/img/work/social-gameday.jpg', 'Social media\ncontent & management', 'Leeds & Yorkshire', fx=0.5, fy=0.35, photo_side='right')
    card('og-events', 'assets/img/team/toosh/theatre-finale.jpg', 'Event photography\n& video', 'Leeds · Yorkshire · Dubai', fx=0.62, photo_side='right')
    card('og-brand', 'assets/img/work/method-photo.jpg', 'Commercial & product\nphotography and video', 'Leeds & Yorkshire', fx=0.5, fy=0.45, photo_side='right')
    card('og-work', 'assets/img/hero-poster.jpg', 'Selected work', 'Film · photography · design', fx=0.62)
    card('og-team', None, 'The team', 'Leeds · Bournemouth · Dubai',
         cutouts=['assets/img/team/cast-toosh.webp', 'assets/img/team/cast-jack.webp', 'assets/img/team/cast-vance.webp'])
    card('og-jack', None, 'Jack Careem', 'Founder · photographer & filmmaker', cutouts=['assets/img/team/cast-jack.webp'])
    card('og-toosh', None, 'Toosh Alzaeem', 'Photographer & videographer', cutouts=['assets/img/team/cast-toosh.webp'])
    card('og-vance', None, 'Vance Serania', 'Middle East lead · filmmaker', cutouts=['assets/img/team/cast-vance.webp'])
    card('og-headspace', 'assets/img/work/headspace/falling.jpg', 'Headspace', 'Short film · UAE Student Film Award', fx=0.5, fy=0.45, photo_side='right')
    card('og-warwick', 'assets/img/work/warwick/asleep-hero.jpg', 'Warwick\nApplication', 'A video application · Jack Careem', fx=0.5, photo_side='right')
    card('og-live-music', 'assets/img/work/live-music/music-02.jpg', 'Live Music', 'Gigs & live sets · Toosh Alzaeem', fx=0.55, photo_side='right')
    icons()
