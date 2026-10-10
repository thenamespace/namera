# Public website and blog

`apps/web` owns the TanStack Start public website, including the landing page, waitlist form, pricing, legal pages, Fumadocs
documentation and MDX blog.
It does not call authenticated APIs for article content or store articles in
the application database.

- Fumadocs compiles the root-level `content/blog/*.mdx` collection. An Effect
  schema validates metadata. Draft subdirectories never enter the collection.
- The server catalog bundles text for search; Nitro requires no source files at
  runtime. Date eligibility is evaluated per request in UTC, not cached forever.
- `/blog` loads published metadata and searchable text through a read-only
  server function. Pagination uses URL state; UIKit command-menu search is local
  and supports Cmd/Ctrl+K with keyboard result navigation.
- `/blog/$slug` checks publication eligibility, then preloads the matching
  Fumadocs chunk. Unknown/future slugs return not found. Root-level scheduled
  content is bundled, so confidential drafts must remain in `_drafts`.
- `/blog/rss.xml`, sitemap, and article SEO share the catalog. Metadata supports
  multiple authors, image overrides, canonical URLs and noindex.
  The `feed` library serializes RSS 2.0, served with the RSS XML content type
  and a five-minute public cache lifetime.
- MDX is repository-owned executable code, not an untrusted content boundary.
  The supplied sequence renderer escapes labels and scopes SVG IDs per instance;
  generic Mermaid is lazy-loaded with strict security. Both provide source
  fallbacks; sequence motion respects reduced-motion preferences.

Article reads do not mutate application state. The landing-page waitlist form
calls the public waitlist API; admission, deduplication and confirmation email
are owned by the [waitlist workflow](../auth/waitlist.md). `/docs/$` renders the
repository-owned Fumadocs content. `/docs` redirects permanently (308) to
`/docs/dashboard`, including client-side navigation; `/docs.md` redirects to
the dashboard Markdown export. There is no root introduction page. Dashboard,
SDK, CLI, and MCP root folders in `content/docs` each contain a starter page.
The source-derived sitemap, search, and LLM index list only those actual pages.
The Spacious layout uses Fumadocs' native rounded inset panel and highlighted table of contents,
a Dashboard-first section picker, a section-specific responsive sidebar,
and heading-derived table of contents. A server function resolves the page and
serializes its tree; the route preloads only the selected MDX module. Unknown
paths return not found. `/api/docs/search` serves Fumadocs search results from
the repository-owned collection's structured content, tagged by Dashboard, SDK, CLI, or MCP
for the search dialog's section filter. Search sits below the section picker.
Page header actions copy or open processed Markdown served by
the page's `.md` URL; content is bundled at build time rather than read from
the filesystem at runtime. Unknown Markdown pages return 404, and Markdown
responses carry `X-Robots-Tag: noindex, follow` and a canonical link to HTML.
Public docs are indexable and included in the programmatic sitemap, while preview
content remains labeled as such. The legacy Markdown API remains compatible.
Global Start request middleware in `src/start.ts` serves `/llms.txt`,
`/llms-full.txt`, `.md` URLs and Fumadocs Accept negotiation. HTML and Markdown
responses vary on Accept; text exports have bounded caching. Pricing Markdown
shares the existing plan and FAQ data. Development discovery URLs use the request
origin, while production uses the configured canonical site origin.
Article and legal URLs also expose Markdown from bundled authored content.
The homepage and blog listing remain server-rendered HTML rather than duplicated
text exports; site-wide afdocs checks report this as partial Markdown coverage.

Doc compilation reads the latest Git author timestamp when a checkout is available,
bundling it for the page's last-updated footer. Missing history or uncommitted
files produce no date, not a build-time substitute. Edit links map the source
path to `thenamespace/namera-core` on `main`; newly added pages need to be
published there before those links resolve.

`/og/docs/$` resolves a docs page ending in `/image.png` and renders a 1200×630
PNG through Takumi using a custom Namera React template. Section, title,
and description come from repository-owned content, not arbitrary query
parameters. Missing pages or invalid suffixes return 404. The renderer uses
bundled fonts and inline SVG, avoiding request-time external assets. Docs SEO
sets the generated absolute image URL and page-specific alt text for Open Graph
and Twitter; other pages retain their existing image. Production responses use
bounded browser/CDN caching, with no caching in development. Public docs images
are indexable alongside their pages.

SEO uses a shared permissions-focused site identity. Server-rendered route heads
connect WebPage, WebSite, Organization, SoftwareApplication and BlogPosting
entities through stable IDs. The blog index emits CollectionPage, Blog and
ItemList JSON-LD for only the visible page of articles; pagination has its own
canonical URL, and empty later pages are noindex. Article metadata retains
author, publication/update dates, image and canonical/noindex overrides.
Docs add TechArticle and BreadcrumbList entities and `Page title | Namera Docs` titles.
Sitemap entries derive from the docs collection and published blog catalog;
modification dates use actual content history, never request time. RSS uses
published article metadata and excludes noindex entries. Root discovery links
advertise the sitemap, RSS, and LLM index. The manifest has docs/blog shortcuts.
The homepage does not advertise an offer while its primary action is a waitlist.

Authoring commands and frontmatter examples live in the package README.

Pricing cards and the comparison table use provider-neutral user-owned account,
managed account, local session key and managed session key labels. Free limits
match Free v2; paid figures remain provisional, with no checkout. Eight pricing
FAQs share their content with FAQPage structured data. The shared footer exposes
the contact email from `SITE_LINKS` as a mailto link.
