import { createFileRoute } from "@tanstack/react-router";

import { blogPath, xmlEscape } from "#/lib/blog/catalog";
import { getPublishedPosts } from "#/lib/blog/source.server";
import { SITE } from "#/lib/seo";

const PAGES = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/pricing", changefreq: "monthly", priority: "0.8" },
  { path: "/blog", changefreq: "weekly", priority: "0.7" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy-policy", changefreq: "yearly", priority: "0.3" },
] as const;

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = PAGES.map(
          (page) => `  <url>
    <loc>${xmlEscape(SITE.origin + page.path)}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
        ).join("\n");
        const articles = (await getPublishedPosts())
          .filter((post) => !post.seo?.noindex && !post.seo?.canonical)
          .map(
            (post) =>
              `<url><loc>${xmlEscape(SITE.origin + blogPath(post.slug))}</loc><lastmod>${post.updated ?? post.date}</lastmod></url>`,
          )
          .join("\n");

        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
${articles}
</urlset>
`,
          { headers: { "content-type": "application/xml; charset=utf-8" } },
        );
      },
    },
  },
});
