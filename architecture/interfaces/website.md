# Website and documentation

The public website uses TanStack Start, React, Fumadocs MDX, and Nitro. It serves
marketing pages, pricing, documentation, a blog, and legal pages. Unlike the
dashboard and admin portal, it has a server-rendered Node output.

## Content pipeline

| Content             | Source                                 | Delivery                             |
| ------------------- | -------------------------------------- | ------------------------------------ |
| Marketing/pricing   | Route components and code-owned data   | HTML and client interactions         |
| Documentation       | `content/docs`, ordered by `meta.json` | HTML, search, Markdown, LLM indexes  |
| Shared doc snippets | `content/snippets`                     | Expanded before MDX parsing          |
| Blog                | Root-level `content/blog/*.mdx`        | Article pages, RSS, discovery/search |
| Legal               | `src/content/legal/*.mdx`              | HTML and negotiated Markdown         |

MDX is trusted executable repository content, not an upload format. Blog drafts
are outside the compiled collection. Future publication dates hide articles from
the published list but do not make deployed source confidential.

Blog `cover` and `seo.image` frontmatter contain asset slugs, resolved by the
server catalog under `https://cdn.namera.ai/`. The catalog supplies the post title
as alt text and 1200 × 630 dimensions to article, listing, search, and social
metadata consumers. Asset uploads are managed separately from the website build.

Documentation groups are Dashboard, SDK, CLI and MCP. SDK Guides includes a
collapsible Templates folder at `/docs/sdk/guides/templates`, with setup, one
page per built-in template and custom-builder guides. These pages use the SDK
search filter, metadata and share-image label.
The build produces processed
Markdown and structured search content from the same expanded source. Request
middleware supports `.md` URLs and Markdown content negotiation, with `Vary: Accept`.
`/llms.txt` and `/llms-full.txt` expose the documentation index and full text.

Takumi renders documentation share images from bundled fonts and artwork. Its
native runtime assets are traced into the Node output. SEO metadata, canonical
origins, and public destinations are centralized rather than assembled per component.

## Service boundary

Start request middleware applies TanStack's same-origin CSRF checks to server
functions before content negotiation. Cross-site and headerless RPC requests
are rejected; public routes remain available to ordinary cross-site navigation.

Homepage and Free pricing calls to action link directly to the dashboard for
open beta signup. The website no longer collects waitlist emails and does not
need `VITE_API_URL` or `WAITLIST_CORS_ORIGIN`. The existing public waitlist API and
operator records remain on the server for compatibility; no admin credential
belongs here. The shared browser analytics listener records dashboard links as
`cta_clicked`, with code-owned placements for the header, hero, closing section,
and pricing controls. These clicks do not imply a completed signup.
The hero and closing section also offer a Docs button beside Get started.

`VITE_*` configuration is public build-time input. Source-map upload credentials
are build-only configuration. The website does not implement account management,
wallet signing, or database access. Publishing legal text does not implement
consent tracking or data-deletion workflows.

## Source

- [Collections](../../apps/web/source.config.ts)
- [Request middleware](../../apps/web/src/start.ts)
- [Documentation utilities](../../apps/web/src/lib/docs)
- [Blog utilities](../../apps/web/src/lib/blog)
- [Signup and documentation calls to action](../../apps/web/src/components/marketing/hero-cta.tsx)
- [Build](../../apps/web/vite.config.ts)
