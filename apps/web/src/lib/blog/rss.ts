import { SITE } from "../seo";
import { blogPath, xmlEscape } from "./catalog";
import type { BlogPost } from "./schema";

export const renderBlogRss = (posts: readonly BlogPost[]) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel><title>Namera Blog</title><link>${xmlEscape(SITE.origin)}/blog</link>
<description>Product updates, engineering, and writing from Namera.</description><language>en-us</language>
<atom:link href="${xmlEscape(SITE.origin)}/blog/rss.xml" rel="self" type="application/rss+xml"/>
${posts
  .filter((post) => !post.seo?.noindex)
  .map((post) => {
    const url = xmlEscape(`${SITE.origin}${blogPath(post.slug)}`);
    return `<item><title>${xmlEscape(post.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid>
<description>${xmlEscape(post.description)}</description><pubDate>${new Date(`${post.date}T00:00:00Z`).toUTCString()}</pubDate>
${post.authors.map((author) => `<dc:creator>${xmlEscape(author.name)}</dc:creator>`).join("")}
${post.tags.map((tag) => `<category>${xmlEscape(tag)}</category>`).join("")}</item>`;
  })
  .join("\n")}
</channel></rss>`;
