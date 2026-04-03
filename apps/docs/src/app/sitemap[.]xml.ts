import { createFileRoute } from "@tanstack/react-router";

import { env } from "@/lib/env";
import { source, sourceBlog, sourceMisc } from "@/lib/source";

const getDocs = () => {
  const res = source.getPages();

  return res.map((page) => ({
    updatedAt: page.data.lastModified ?? new Date(),
    url: page.url,
  }));
};

const getBlogPosts = () => {
  const res = sourceBlog.getPages();

  return res.map((page) => ({
    updatedAt: page.data.lastModified ?? new Date(),
    url: page.url,
  }));
};

const getLegalPages = () => {
  const res = sourceMisc.getPages();

  return res.map((page) => ({
    updatedAt: page.data.lastModified ?? new Date(),
    url: page.url,
  }));
};

const buildUrls = (
  items: { url: string; updatedAt: Date }[],
  priority: number,
) => {
  return items
    .map((item) => {
      return `
  <url>
    <loc>${new URL(item.url, env.baseUrl).toString()}</loc>
    <lastmod>${item.updatedAt.toISOString()}</lastmod>
    <priority>${priority}</priority>
  </url>`;
    })
    .join("");
};

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const docs = getDocs();
        const blogs = getBlogPosts();
        const legalPages = getLegalPages();

        const latestBlogPostDate = blogs.reduce(
          (acc, cur) => (cur.updatedAt > acc ? cur.updatedAt : acc),
          new Date(0),
        );

        const now = new Date().toISOString();
        const staticUrls = [
          {
            loc: env.baseUrl.toString(),
            lastmod: now,
            priority: 1.0,
          },
          {
            loc: new URL("/blog", env.baseUrl).toString(),
            lastmod: latestBlogPostDate.toISOString(),
            priority: 0.7,
          },
        ];

        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  ${staticUrls
    .map(
      (url) => `
  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <priority>${url.priority}</priority>
  </url>`,
    )
    .join("")}

  ${buildUrls(docs, 0.9)}
  ${buildUrls(blogs, 0.7)}
  ${buildUrls(legalPages, 0.3)}

</urlset>`.trim();

        return new Response(sitemap, {
          headers: {
            "Content-Type": "application/xml",
          },
        });
      },
    },
  },
});
