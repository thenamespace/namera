import { llms } from "fumadocs-core/source";

import { getPublishedPosts } from "#/lib/blog/source.server";
import { SITE } from "#/lib/seo";

import { docsSource } from "./source.server";

export const markdownPath = (url: string) => `${url}.md`;

function absoluteMarkdownLinks(body: string, url: string) {
  return body.replace(/(!?\[[^\]]*\]\()([^\s)]+)(\))/g, (match, before, href, after) => {
    if (/^[a-z][a-z\d+.-]*:/i.test(href)) return match;
    return `${before}${new URL(href, url).href}${after}`;
  });
}

export function docsLlms(origin = SITE.origin) {
  return llms(docsSource, {
    renderPage: async (page) => {
      const url = new URL(page.url, origin).href;
      const body = await page.data.getText("processed");
      // Make authored relative links portable outside the website's browser context.
      const markdown = absoluteMarkdownLinks(body, url);
      return `# ${page.data.title}\n\n> Documentation index: [llms.txt](${origin}/llms.txt).\n\nSource: ${url}\n\n${page.data.description ?? ""}\n\n${markdown}`;
    },
  });
}

export async function docsIndex(origin = SITE.origin) {
  const links = docsSource.getPages().map((page) => {
    const section = page.slugs[0];
    const name = section ? `${section.toUpperCase()}: ${page.data.title}` : page.data.title;
    return `- [${name}](${origin}${markdownPath(page.url)}): ${page.data.description ?? ""}`;
  });
  const posts = (await getPublishedPosts()).filter((post) => !post.seo?.noindex);
  const articles = posts.map(
    (post) => `- [${post.title}](${origin}/blog/${post.slug}.md): ${post.description}`,
  );
  return `# Namera Documentation\n\n> ${SITE.description}\n\nThese guides currently include documentation previews; do not infer unlisted APIs or commands.\n\n## Documentation\n\n${links.join("\n")}\n\n## Product\n\n- [Pricing](${origin}/pricing.md): Plans, allowances, and pricing questions.\n\n## Articles\n\n${articles.join("\n")}\n\n## Optional\n\n- [Complete documentation](${origin}/llms-full.txt): All documentation in one Markdown file.\n- [Privacy policy](${origin}/privacy-policy.md): Data processing practices.\n- [Terms of service](${origin}/terms.md): Service terms.\n`;
}

export function markdownResponse(body: string, canonical?: string) {
  return new Response(canonical ? absoluteMarkdownLinks(body, canonical) : body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300, must-revalidate",
      "X-Robots-Tag": "noindex, follow",
      "X-Content-Type-Options": "nosniff",
      ...(canonical ? { Link: `<${canonical}>; rel="canonical"` } : {}),
    },
  });
}
