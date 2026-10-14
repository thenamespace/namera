# @namera-ai/web

Namera's public website and documentation, built with TanStack Start, React,
Fumadocs MDX, and Nitro. Serves the landing page, pricing, docs, blog, and legal pages.

## Development

Copy [.env.example](.env.example) to `.env`, then run from the repository root:

```sh
pnpm --filter @namera-ai/web dev
```

Development and preview use port 4000. The email preview uses the same port;
run them separately.

| Variable           | Purpose                                                   |
| ------------------ | --------------------------------------------------------- |
| `VITE_API_URL`     | Public API origin for the waitlist                        |
| `VITE_SITE_URL`    | Canonical website origin; defaults to `https://namera.ai` |
| `VITE_POSTHOG_KEY` | Public analytics project key when configured              |

Values are embedded at build time. Configure the API's `WAITLIST_CORS_ORIGIN`
to the exact website origin. Never put credentials in browser configuration.

## Content

- `src/components/marketing` and `src/lib/seo.ts` own positioning and landing copy.
- `content/docs` contains docs; `meta.json` files define navigation.
- `content/snippets` holds shared Markdown expanded before MDX compilation.
- `content/blog/*.mdx` contains articles. Put drafts in `_drafts`.
- `src/content/legal` contains legal text.
- `src/lib/site-links.ts` owns public destinations.

Follow the [public documentation conventions](../../AGENTS.md#public-docs-writing-style).
MDX is executable trusted source. Future-dated posts are hidden from publication
lists, not protected from access to deployed assets.

HTML, search, Markdown, and LLM indexes derive from the same documentation source.
See [website architecture](../../architecture/interfaces/website.md).

## Checks

```sh
pnpm --filter @namera-ai/web test
pnpm --filter @namera-ai/web typecheck
pnpm --filter @namera-ai/web lint
pnpm --filter @namera-ai/web build
pnpm --filter @namera-ai/web preview
```

Typechecking generates the MDX collection and route tree. The production build
generates the complete TanStack Start registration.

## Deployment

```sh
docker build -f apps/web/Dockerfile -t namera-web .
docker run --rm -p 4000:8080 namera-web
```

Build from the repository root. The Node.js 24 image runs Nitro's standalone
output. Retain Takumi's traced native dependencies for documentation share images.
Vercel uses the package's `build:vercel` command with access to workspace sources.

Full Git history supplies documentation update dates; source archives omit them.
