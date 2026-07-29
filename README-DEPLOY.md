# Aera website — deployment guide

Everything in this `/site` folder is the finished, deployable website. It's plain
HTML/CSS/JS with no build step and no server required — you can put it live the
moment you have a domain.

## What's in here

```
site/
  index.html              Homepage
  weddings.html           Wedding Photography & Film
  events.html             Event Coverage
  brand-commercial.html   Brand & Commercial Content
  social-media.html       Social Media Content & Management
  assets/
    css/style.css         All styling, shared across every page
    js/main.js            Nav, scroll effects, FAQ accordions, "Find your fit" tool
    img/logo/             The finalised diamond mark, as SVG (favicon + brand mark)
  robots.txt              Allows Google + AI crawlers (GPTBot, ClaudeBot, PerplexityBot)
  sitemap.xml             Lists all 5 pages for search engines
  llms.txt                Plain-language summary for AI assistants (ChatGPT, Claude, etc.)
```

## Step 1 — Buy a domain

Any registrar works. Easy, low-friction options if you don't already have a
preference:

- **Cloudflare Registrar** — sells at wholesale price, no markup, and pairs
  perfectly with Cloudflare Pages hosting below (one account for both).
- **Namecheap** or **123-reg** — fine general-purpose UK-friendly registrars.

Something like `aerastudio.co.uk` or `aeramedia.co.uk` fits the brand — check
availability and grab whichever's free and short.

## Step 2 — Find a host and put the site live

You don't need a developer for this. Recommended, in order of ease:

**Cloudflare Pages (recommended)** — free, fast, and if you bought your domain
through Cloudflare the whole thing is one dashboard.
1. Create a free Cloudflare account.
2. Workers & Pages → Create → Pages → Upload assets.
3. Drag in the entire contents of this `site` folder (not the folder itself — its
   contents, so `index.html` sits at the top level of the upload).
4. Once deployed, go to your Pages project → Custom domains → add your domain and
   follow the on-screen DNS steps (automatic if the domain is already on
   Cloudflare).

**Netlify** — also free, arguably the simplest drag-and-drop of all.
1. Create a free Netlify account.
2. Sites → Add new site → Deploy manually → drag in the `site` folder's contents.
3. Site settings → Domain management → Add a custom domain → follow the DNS
   instructions it gives you (you'll add some records at your registrar).

Either one takes about 15 minutes end to end, and both are free at this scale.

## Step 3 — Domain (done)

The live domain is **aerastudios.org**. Every canonical link, Open Graph tag,
schema.org URL, `robots.txt` and `sitemap.xml` entry already points at it — the
old `REPLACE-WITH-YOUR-DOMAIN.com` placeholder is gone.

If the domain ever changes, it's one find-and-replace from inside `site/`:

```bash
grep -rl "aerastudios.org" . | xargs sed -i '' 's/aerastudios\.org/newdomain.com/g'
```

## Cache busting — READ THIS BEFORE EDITING CSS OR JS

Every page loads `style.css` and `main.js` with a `?v=` version string. Browsers
and Cloudflare's edge cache those files hard. **If you change `style.css` or
`main.js` without changing that version string, your edit will appear to do
nothing** — you'll be served the old file, and so will everyone else.

After editing either file, bump the version everywhere:

```bash
sed -i '' 's/?v=OLDVERSION/?v=NEWVERSION/g' *.html
```

then re-upload the changed asset *and* all the HTML files. Loading the page with
a `?something=1` query on the URL is a quick way to check you're seeing fresh
HTML rather than a cached copy.

## About the portfolio images

The portfolio photos across the site are currently hot-linked from your existing
personal site (c4rem.co.uk's Squarespace image host) — this was a deliberate
choice while Aera has no client galleries of its own yet, each one is labelled
honestly as a style reference. It works fine for launch, but it does mean the
images depend on that old site staying online.

When you're ready, the more resilient move is to download those same images and
save them into `assets/img/` here, then update the `src="..."` paths in each HTML
file to point at the local copies instead. Claude can do this for you in a couple
of minutes once the image files are available locally — the sandbox this session
ran in couldn't fetch them directly from Squarespace's CDN, so it had to stay as a
hotlink for now.

## Post-launch checklist

- [ ] Buy the domain (Step 1).
- [ ] Deploy to Cloudflare Pages or Netlify and connect the domain (Step 2).
- [ ] Run the find-and-replace for your real domain (Step 3).
- [ ] Set up a free **Google Business Profile** (category: Photographer /
      Videographer) — critical for local search and for collecting your first
      reviews.
- [ ] Add the site to **Google Search Console**, verify ownership, and submit
      `sitemap.xml`.
- [ ] Replace the hot-linked portfolio images with local files once convenient
      (see above), and swap in real client work as soon as it exists.
- [ ] Revisit pricing on each service page once you've done a few real jobs and
      know what things actually cost you.

This matches the priorities already laid out in `Aera-SEO-Strategy.md` — steps 3
and 4 there (Google Business Profile, `llms.txt`/`robots.txt`) are now already
done as part of this build.
