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

## Step 3 — Point the real domain at every file

Every page currently uses a placeholder domain — `REPLACE-WITH-YOUR-DOMAIN.com` —
in canonical links, Open Graph tags, the schema.org markup, `robots.txt` and
`sitemap.xml`. This is deliberate: it's a single find-and-replace once you know
your real domain, rather than guessing one now.

Once you own a domain, run this from inside the `site` folder (Mac Terminal):

```bash
grep -rl "REPLACE-WITH-YOUR-DOMAIN.com" . | xargs sed -i '' 's/REPLACE-WITH-YOUR-DOMAIN\.com/yourdomain.co.uk/g'
```

Swap `yourdomain.co.uk` for whatever you bought, then re-upload to your host (or
just ask Claude to do this find-and-replace for you if you'd rather not touch the
terminal — tell it the domain and it'll handle it directly in these files).

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
