# @namera-ai/web

Namera's public website, built with TanStack Start and React. `/` is the
marketing landing page, `/pricing` the plan comparison, and `/docs` and `/blog`
are placeholders until there is something behind them.

## Legal pages

`/terms` and `/privacy-policy` render repository-owned MDX through Fumadocs MDX.
Edit `src/content/legal/*.mdx` for copy and `src/components/legal` for the shared
reading layout and semantic heading, paragraph, list, and link components.
The compiler generates heading anchors and the table of contents at build time;
there is no runtime Markdown fetching or documentation UI dependency.

The documents are dated October 5, 2026, based on the operator's confirmed
company details and processing practices, and are included in the sitemap.
The contact for legal and privacy requests is `hey@namera.ai`.
The copy describes the self-custodial flow; it does not promise private-key
recovery, deletion of blockchain records, or purely local CLI operation.

Publication is not a compliance certification. Open operational/legal items:

- Verify deployed PostHog masking, event/replay retention, and collection
  controls. No PostHog initialization was found in this checkout. The operator
  reports collection before consent; the notice does not claim consent gating.
  Implement appropriate controls or disable nonessential collection where
  required; policy wording does not supply consent.
- Confirm Resend's Tokyo sending region and provider/subprocessor transfer
  arrangements. Review applicable safeguards and regional representative needs.
- Establish retention/deletion procedures for live data, PostHog, and manual
  backups. Axiom's 30-day default was confirmed by the operator; do not infer
  other providers' actual retention from their pricing plans.
- Obtain counsel review, including applicable law, consumer rights, and data
  processing roles. No monetary liability cap, chosen dispute venue, or
  mandatory arbitration was added without approval.

Adding these pages does not implement contractual acceptance tracking, a
consent system, or automated data deletion. Update the notice whenever the
actual practices change, including before introducing paid plans.

## Development

```sh
pnpm --filter @namera-ai/web dev
pnpm --filter @namera-ai/web typecheck
pnpm --filter @namera-ai/web lint
pnpm --filter @namera-ai/web build
pnpm --filter @namera-ai/web preview
```

Development and preview use port 4000. Copy `.env.example` to `.env` and set
`VITE_API_URL` to the backend origin (defaults to `https://api.namera.ai`). It is
public configuration embedded at build time; rebuild after changing it.

Set `VITE_SITE_URL` to the public website URL. It defaults to `https://namera.ai`
and controls canonical URLs, Open Graph/Twitter images, structured data,
the sitemap, and the sitemap link in `robots.txt`. Trailing slashes are normalized.
For the current Vercel deployment, set
`VITE_SITE_URL=https://namera-landing.vercel.app` in Vercel's environment settings
and redeploy. This is a build-time setting for both Node and Vercel.

The CTA sends email to `POST /waitlist` without cookies or tokens. For local
testing use `VITE_API_URL=http://localhost:8080` and set the server's
`WAITLIST_CORS_ORIGIN=http://localhost:4000`. In production, use the exact public
website origin for that server setting. Never put `ADMIN_TOKEN` in this app.

The form validates with the shared email schema, disables duplicate submissions,
and shows success only after an accepted API response. Rate limits, network
failures and unexpected responses leave the form available for retry.
Run `pnpm --filter @namera-ai/web test` for transport and validation tests.

## Node container deployment

The primary infra deployment uses Nitro's `node-server` preset on Node.js 24.
Build from the repository root:

```sh
docker build -f apps/web/Dockerfile -t namera-web .
docker run --rm -p 4000:8080 namera-web
```

The non-root runtime serves the standalone `.output` bundle on port 8080,
including SSR, static assets, and `/sitemap.xml`. No workspace source or pnpm
installation is needed at runtime. `NITRO_HOST` and `NITRO_PORT` control binding.

The public API defaults to `https://api.namera.ai`. To change it, build with
`--build-arg DOTENV='VITE_API_URL=https://your-api.example'`. This is browser
configuration, not a secret; changing the runtime environment cannot update it.
Set the API's `WAITLIST_CORS_ORIGIN` to the exact deployed website origin.

Run **Deploy - Namera Website** manually in GitHub Actions with the ref,
environment, API URL, and public site URL. It builds/pushes through the existing GCP workflow
and dispatches the `namera-web` image tag to `thenamespace/infra`. Infra must
provide that application, port 8080 routing, and HTTPS termination. The workflow
uses the server workflow's GCP identity and `REPOSITORY_DISPATCH_PAT`; it does
not provision infra resources.

## Temporary Vercel deployment

Import this repository into Vercel with **Root Directory `apps/web`** and enable
**Include source files outside of the Root Directory** so the shared workspace
packages are available. Use Node.js **24.x** and the **TanStack Start** framework
preset. `vercel.json` supplies the install and build commands; leave the Output
Directory override disabled.

The Nitro Vite plugin packages SSR and server routes as Vercel functions and
static assets in `.vercel/output`. Do not deploy `dist/client` as a plain SPA or
add a catch-all rewrite to `index.html`; `/sitemap.xml` is a server route.
Both Vite and Nitro resolve workspace packages through `namera-source`, so clean
deployments do not require prebuilt `packages/protocol/dist` artifacts.

Set `VITE_API_URL=https://api.namera.ai` in the Vercel project's environment
variables before building. Configure the API server's `WAITLIST_CORS_ORIGIN`
to the exact production website origin. Preview domains need a separately
configured test backend/origin to submit the waitlist; do not allow arbitrary
preview origins on the production API. No backend secrets belong in Vercel.

Verify the deployment output locally without publishing:

```sh
pnpm --filter @namera-ai/web build:vercel
```

Ordinary `pnpm --filter @namera-ai/web build` uses Nitro's local Node target.
See the [official Vercel setup](https://vercel.com/docs/frameworks/full-stack/tanstack-start).

## Structure

- `src/routes` , the root document and one file per page.
- `src/components/marketing` , landing-page sections. These are page
  composition, not shared UI; anything reused across applications belongs in
  `@namera-ai/ui`.
- `src/components/pricing` , the plan columns, the comparison table, and the
  plan data.
- `src/lib/seo.ts` , every page's head.
- `src/lib/site-links.ts` , every destination the page can link to.
- `src/marketing.css` , the marketing-only presentation layer.
- `public/` , icons, the manifest, `robots.txt` and the Open Graph card.

## Links

`src/lib/site-links.ts` is the single source of truth for outbound
destinations. A link renders only when its entry is a string; entries left
`null` are destinations nobody has confirmed, and the corresponding nav item,
footer link, or button does not render at all. Fill one in and it appears. Do
not replace a `null` with a guess: a link that 404s costs more trust than a
missing one.

## SEO

Every route calls `seo()` from `src/lib/seo.ts`, which returns the title, the
description, the canonical, the Open Graph and Twitter cards, and a robots
directive together, so a page cannot ship with one and not the others. Titles
read `Page | Namera`; the home page leads with the name and a dash.

Structured data is JSON-LD in each route's `scripts`. `Organization` and
`WebSite` come from the root route, the landing page adds `SoftwareApplication`
and a `FAQPage` generated from the FAQ component's own questions, and pricing
adds `BreadcrumbList`, `Product` and its own `FAQPage`. Offers are `PreOrder`
while nothing is purchasable.

`/docs` and `/blog` carry `noindex`, are absent from `/sitemap.xml` and are
disallowed in `robots.txt`. All four change together when those pages get
content.

## Motion

Scroll reveals are a scroll-driven CSS animation (`animation-timeline: view()`)
behind an `@supports` guard, not JavaScript. Where the feature is unsupported
the content is simply visible and does not animate. This matters more than the
animation does: the failure mode of a reveal has to be "it did not move", never
"the page is blank". An earlier observer-driven version failed the other way
whenever the observer did not run, which includes hidden tabs, prerenders, and
offscreen captures. Nothing in the server HTML is hidden.

`motion` is used only for state transitions inside components (the FAQ, the
mobile nav, the hero visual's run), where a script is already required for the
interaction itself.

The closing section renders Paper Design's `NeuroNoise` shader, masked so it
fades before the section's edges and scrimmed in the middle so body copy keeps
its contrast ratio. It draws a static frame under `prefers-reduced-motion`.

## Accessibility

Contrast is verified against the rendered page, not against tokens. Note that
`--accent` (`#5e6ad2`) measures 3.98:1 on the canvas and cannot carry body
text; it is a fill and border colour only, and accent text uses
`--color-accent-text` (`#828fff`, 6.53:1).

Touch targets use the `tap-target` utility, which lifts the hit box to 44px
under `@media (pointer: coarse)` at any viewport width. A width breakpoint gets
tablets wrong in both directions. `tap-halo` does the same for controls whose
drawn size is the design.

## Conventions

The workspace default catalog supplies shared React, Tailwind, and TypeScript
versions. The `web` catalog isolates current Vite and Router tooling from the
dashboard. Routes are generated by Start during development and build, and by
`generate-routes` before typechecking. Commit `src/routeTree.gen.ts` when
routes change.

`resolve.dedupe` in `vite.config.ts` pins React and React DOM to one copy.
Without it a pre-bundled dependency resolves its own peer React out of
`.vite/deps` and every hook it calls throws "Invalid hook call".

Use `@namera-ai/ui` for shared UI components. Its stylesheet supplies Tailwind
CSS and scans shared components. The shared Namera theme is dark, so the
document uses that theme without a separate theme switcher.
