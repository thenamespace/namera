import type { HtmlTagDescriptor, Plugin } from "vite";

import {
  dashboardSite,
  defaultSeo,
  pageMetadata,
  robotsForRequest,
  structuredData,
} from "../src/seo/site.ts";

export function documentSeoTags(): HtmlTagDescriptor[] {
  const metadata = pageMetadata({ ...defaultSeo, indexable: true });
  const tags: HtmlTagDescriptor[] = [
    { tag: "title", children: metadata.title },
    ...Object.entries(metadata.meta).map(([key, content]) => ({
      tag: "meta",
      attrs: {
        [key.startsWith("og:") ? "property" : "name"]: key,
        content,
        "data-dashboard-seo": key,
      },
    })),
    {
      tag: "link",
      attrs: { rel: "canonical", href: `${dashboardSite.origin}${dashboardSite.publicPath}` },
    },
    {
      tag: "script",
      attrs: { type: "application/ld+json" },
      children: JSON.stringify(structuredData).replaceAll("<", "\\u003c"),
    },
  ];

  for (const tag of tags) tag.injectTo = "head";
  return tags;
}

export function documentSeo(): Plugin {
  return {
    name: "namera-document-seo",
    transformIndexHtml: documentSeoTags,
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        res.setHeader("X-Robots-Tag", robotsForRequest(req.url ?? "/"));
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        res.setHeader("X-Robots-Tag", robotsForRequest(req.url ?? "/"));
        next();
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\nAllow: /\n\nSitemap: ${dashboardSite.origin}/sitemap.xml\n`,
      });
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${dashboardSite.origin}${dashboardSite.publicPath}</loc></url></urlset>\n`,
      });
    },
  };
}
