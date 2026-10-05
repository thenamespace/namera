# Public website and blog

`apps/web` owns the TanStack Start public website, including the MDX blog.
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

There are no mutations, audit events, or new telemetry events in this flow.

SEO uses a shared permissions-focused site identity. Server-rendered route heads
connect WebPage, WebSite, Organization, SoftwareApplication and BlogPosting
entities through stable IDs. The blog index emits CollectionPage, Blog and
ItemList JSON-LD for only the visible page of articles; pagination has its own
canonical URL, and empty later pages are noindex. Article metadata retains
author, publication/update dates, image and canonical/noindex overrides.
The homepage does not advertise an offer while its primary action is a waitlist.

Tests in `apps/web/tests/unit/blog*.test.*` cover metadata, discovery, RSS,
SEO escaping, content compilation, and sequence layout/rendering.
Authoring commands and frontmatter examples live in the package README.
