import { createFileRoute } from "@tanstack/react-router";

import { SITE } from "#/lib/seo";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          `User-agent: *\nAllow: /\n\nDisallow: /docs\n\nSitemap: ${SITE.origin}/sitemap.xml\n`,
          { headers: { "content-type": "text/plain; charset=utf-8" } },
        ),
    },
  },
});
