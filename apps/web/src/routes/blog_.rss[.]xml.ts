import { createFileRoute } from "@tanstack/react-router";

import { renderBlogRss } from "#/lib/blog/rss";
import { getPublishedPosts } from "#/lib/blog/source.server";

export const Route = createFileRoute("/blog_/rss.xml")({
  server: {
    handlers: {
      GET: async () =>
        new Response(renderBlogRss(await getPublishedPosts()), {
          headers: {
            "content-type": "application/rss+xml; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        }),
    },
  },
});
