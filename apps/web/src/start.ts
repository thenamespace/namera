import { createMiddleware, createStart } from "@tanstack/react-start";

import { isMarkdownPreferred } from "fumadocs-core/negotiation";

import { markdownResponse } from "#/lib/markdown/response";

const documentationAccess = createMiddleware().server(async ({ request, next, handlerType }) => {
  if (handlerType !== "router" || !["GET", "HEAD"].includes(request.method)) return next();

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");
  if (["/docs/dashboard", "/docs/dashboard.md"].includes(path)) {
    return new Response(null, {
      status: 308,
      headers: {
        Location: `${path.endsWith(".md") ? "/docs.md" : "/docs"}${url.search}`,
      },
    });
  }
  const isDocs = path === "/docs" || path === "/docs.md" || path.startsWith("/docs/");
  const isIndex = path === "/llms.txt" || path === "/llms-full.txt";
  const isPricing = path === "/pricing" || path === "/pricing.md";
  const isBlog = path.startsWith("/blog/") && !path.endsWith(".xml");
  const legalPath = path.replace(/\.md$/, "");
  const isLegal = legalPath === "/terms" || legalPath === "/privacy-policy";

  if (isLegal && (path.endsWith(".md") || isMarkdownPreferred(request))) {
    const { SITE } = await import("#/lib/seo");
    const content =
      legalPath === "/terms"
        ? await import("#/content/legal/terms.mdx?raw")
        : await import("#/content/legal/privacy-policy.mdx?raw");
    const title = legalPath === "/terms" ? "Terms of Service" : "Privacy Policy";
    const origin = import.meta.env.DEV ? url.origin : SITE.origin;
    const response = markdownResponse(
      `# ${title}\n\n> Documentation index: [llms.txt](${origin}/llms.txt).\n\nEffective October 5, 2026\n\n${content.default}`,
      `${SITE.origin}${legalPath}`,
    );
    response.headers.set("Vary", "Accept");
    return request.method === "HEAD" ? new Response(null, response) : response;
  }

  if (isBlog && (path.endsWith(".md") || isMarkdownPreferred(request))) {
    const { getPublishedPosts } = await import("#/lib/blog/source.server");
    const { SITE } = await import("#/lib/seo");
    const slug = path.slice("/blog/".length).replace(/\.md$/, "");
    const post = (await getPublishedPosts()).find((entry) => entry.slug === slug);
    if (!post)
      return new Response("Article not found", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    const origin = import.meta.env.DEV ? url.origin : SITE.origin;
    const response = markdownResponse(
      `# ${post.title}\n\n> Documentation index: [llms.txt](${origin}/llms.txt).\n\n${post.description}\n\nBy ${post.authors.map((author) => author.name).join(", ")} | Published ${post.date}\n\n${post.searchText}`,
      post.seo?.canonical ?? `${SITE.origin}/blog/${slug}`,
    );
    response.headers.set("Vary", "Accept");
    return request.method === "HEAD" ? new Response(null, response) : response;
  }

  if (isPricing && (path.endsWith(".md") || isMarkdownPreferred(request))) {
    const { pricingMarkdown } = await import("#/lib/pricing/markdown.server");
    const { SITE } = await import("#/lib/seo");
    const response = markdownResponse(
      pricingMarkdown(import.meta.env.DEV ? url.origin : SITE.origin),
      `${SITE.origin}/pricing`,
    );
    response.headers.set("Vary", "Accept");
    return request.method === "HEAD" ? new Response(null, response) : response;
  }

  if (isIndex || (isDocs && (path.endsWith(".md") || isMarkdownPreferred(request)))) {
    const { docsIndex, docsLlms } = await import("#/lib/docs/llms.server");
    const { docsSource } = await import("#/lib/docs/source.server");
    const { SITE } = await import("#/lib/seo");
    const origin = import.meta.env.DEV ? url.origin : SITE.origin;
    let response: Response;
    if (isIndex) {
      response = markdownResponse(
        path === "/llms.txt" ? await docsIndex(origin) : await docsLlms(origin).full(),
      );
      response.headers.set("Content-Type", "text/plain; charset=utf-8");
    } else {
      const pagePath = path.replace(/\.md$/, "");
      const slugs = pagePath.slice("/docs".length).split("/").filter(Boolean);
      const page = docsSource.getPage(slugs);
      response = page
        ? markdownResponse(await docsLlms(origin).page(page), `${SITE.origin}${page.url}`)
        : new Response("Documentation page not found", {
            status: 404,
            headers: { "Cache-Control": "no-store" },
          });
      response.headers.set("Vary", "Accept");
    }
    return request.method === "HEAD" ? new Response(null, response) : response;
  }

  const result = await next();
  if (isDocs || isPricing || isBlog || isLegal) {
    const vary = result.response.headers.get("Vary");
    if (!vary?.split(",").some((value) => ["accept", "*"].includes(value.trim().toLowerCase()))) {
      result.response.headers.set("Vary", vary ? `${vary}, Accept` : "Accept");
    }
  }
  if (!result.response.headers.has("Cache-Control")) {
    result.response.headers.set("Cache-Control", "no-cache");
  }
  return result;
});

export const startInstance = createStart(() => ({ requestMiddleware: [documentationAccess] }));
