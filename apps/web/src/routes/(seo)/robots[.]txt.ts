import { createFileRoute } from "@tanstack/react-router";

import { SITE } from "#/lib/seo";

export const Route = createFileRoute("/(seo)/robots.txt")({
  server: {
    handlers: {
      GET: ({ request }) =>
        new Response(
          `User-agent: *\nAllow: /\n\nSitemap: ${import.meta.env.DEV ? new URL(request.url).origin : SITE.origin}/sitemap.xml\n`,
          {
            headers: {
              "content-type": "text/plain; charset=utf-8",
              "cache-control": "public, max-age=300, must-revalidate",
            },
          },
        ),
    },
  },
});
