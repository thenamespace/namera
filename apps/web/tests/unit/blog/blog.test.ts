import { Schema } from "effect";

import { describe, expect, it } from "vitest";

import { parse, doLayout } from "../../../src/components/blog/diagrams/sequence-layout";
import { render } from "../../../src/components/blog/diagrams/sequence-svg";
import { sequenceTheme } from "../../../src/components/blog/diagrams/theme";
import { filterPosts } from "../../../src/lib/blog/catalog";
import { renderBlogRss } from "../../../src/lib/blog/rss";
import { BlogFrontmatter, type BlogPost } from "../../../src/lib/blog/schema";
import { articleHead, blogIndexHead } from "../../../src/lib/blog/seo";
import { jsonLd, SITE } from "../../../src/lib/seo";

const post: BlogPost = {
  title: "Permissioned wallets",
  description: "Build <safe> & scoped agents",
  date: "2026-04-14",
  tags: ["Engineering"],
  authors: [{ name: "First Author" }, { name: "Second Author", url: "https://example.com" }],
  slug: "permissioned-wallets",
  path: "permissioned-wallets.mdx",
  readingMinutes: 1,
  searchText: "A cron job with scoped permissions",
};

describe("blog publishing", () => {
  it("uses the authored cover directly for Open Graph, Twitter and article images", () => {
    const cover = { src: "/blog/cover.png", alt: "Article cover", width: 1600, height: 900 };
    const head = articleHead({
      ...post,
      cover,
      seo: {
        image: { src: "/other.png", alt: "Other image", width: 1200, height: 630 },
      },
    });
    expect(head.meta).toContainEqual({
      property: "og:image",
      content: `${SITE.origin}${cover.src}`,
    });
    expect(head.meta).toContainEqual({
      name: "twitter:image",
      content: `${SITE.origin}${cover.src}`,
    });
    expect(head.meta).toContainEqual({ property: "og:image:width", content: "1600" });
    expect(JSON.parse(head.scripts[0]?.children ?? "{}").image).toBe(`${SITE.origin}${cover.src}`);
  });
  it("validates dates, authors, and safe metadata URLs", () => {
    const decode = Schema.decodeUnknownSync(BlogFrontmatter);
    expect(decode(post).authors).toHaveLength(2);
    expect(() => decode({ ...post, date: "2026-02-30" })).toThrow();
    expect(() => decode({ ...post, authors: [] })).toThrow();
    expect(() => decode({ ...post, updated: "2020-01-01" })).toThrow();
    expect(() =>
      decode({ ...post, authors: [{ name: "Author", url: "javascript:alert(1)" }] }),
    ).toThrow();
  });
  it("searches body and all authors, and combines query terms with a tag", () => {
    expect(filterPosts([post], "CRON second", "Engineering")).toEqual([post]);
    expect(filterPosts([post], "cron", "Product")).toEqual([]);
    expect(filterPosts([post], "missing")).toEqual([]);
    expect(filterPosts([], "")).toEqual([]);
  });
  it("escapes RSS content and includes each author", () => {
    const rss = renderBlogRss([post]);
    expect(rss).toContain("<![CDATA[Build <safe> & scoped agents]]>");
    expect(rss).toContain("<author>First Author</author>");
    expect(rss).toContain("<author>Second Author</author>");
    expect(rss).toContain('rel="self" type="application/rss+xml"');
    expect(rss).toContain("<pubDate>Tue, 14 Apr 2026 00:00:00 GMT</pubDate>");
    expect(rss).toContain("<category>Engineering</category>");
    expect(rss).toContain("/blog/permissioned-wallets");
    expect(renderBlogRss([{ ...post, seo: { noindex: true } }])).not.toContain("<item>");
  });
  it("emits article metadata with multiple authors and safe JSON-LD", () => {
    const head = articleHead(post);
    expect(head.meta).toContainEqual({ property: "og:type", content: "article" });
    expect(head.meta).toContainEqual({ name: "author", content: "Second Author" });
    expect(JSON.parse(head.scripts[0]?.children ?? "{}").author).toHaveLength(2);
    expect(jsonLd({ headline: "</script><script>alert(1)</script>" }).children).not.toContain("<");
  });

  it("keeps paginated canonicals and collection markup aligned with visible posts", () => {
    const posts = Array.from({ length: 13 }, (_, index) => ({ ...post, slug: `post-${index}` }));
    const head = blogIndexHead(posts, 2);
    expect(head.links).toContainEqual({ rel: "canonical", href: `${SITE.origin}/blog?page=2` });
    expect(head.meta).toContainEqual({ property: "og:url", content: `${SITE.origin}/blog?page=2` });
    const graph = JSON.parse(head.scripts[0]?.children ?? "{}")["@graph"];
    expect(
      graph.find((node: Record<string, unknown>) => node["@type"] === "ItemList").itemListElement,
    ).toEqual([
      { "@type": "ListItem", position: 13, name: post.title, url: `${SITE.origin}/blog/post-12` },
    ]);
    expect(blogIndexHead(posts, 3).meta).toContainEqual({
      name: "robots",
      content: "noindex, follow",
    });
  });

  it("preserves article overrides and links the article to its publisher and blog", () => {
    const canonical = "https://example.com/original";
    const head = articleHead({
      ...post,
      updated: "2026-05-01",
      seo: {
        canonical,
        noindex: true,
        title: "Custom title",
        description: "Custom description",
        keywords: ["custom"],
        image: { src: "/custom.png", alt: "Custom cover", width: 1200, height: 630 },
      },
    });
    expect(head.links).toContainEqual({ rel: "canonical", href: canonical });
    expect(head.meta).toContainEqual({ title: "Custom title" });
    expect(head.meta).toContainEqual({ name: "robots", content: "noindex, follow" });
    expect(head.meta).toContainEqual({
      property: "og:image",
      content: `${SITE.origin}/custom.png`,
    });
    expect(head.meta).not.toContainEqual({ property: "article:author", content: "First Author" });
    const article = JSON.parse(head.scripts[0]?.children ?? "{}");
    expect(article["@id"]).toBe(`${canonical}#article`);
    expect(article.publisher["@id"]).toBe(`${SITE.origin}/#organization`);
    expect(article.isPartOf["@id"]).toBe(`${SITE.origin}/blog#blog`);
    expect(article.dateModified).toBe("2026-05-01T00:00:00Z");
    expect(article.keywords).toBe("custom");
  });
});

describe("supplied sequence renderer", () => {
  it("renders self calls, dashed responses, numbered notes and scoped gradients", () => {
    const diagram = parse(
      "sequenceDiagram\nparticipant A as Agent\nparticipant B as Account\nA->>B: (1) Request\nB->>B: Check\nNote over B: (2) Spend limit<br/>Expiry\nB-->>A: 200 OK",
    );
    const layout = doLayout(diagram);
    expect(layout.actors).toHaveLength(2);
    expect(layout.messages).toHaveLength(3);
    expect(layout.notes[0]?.num).toBe("2");
    expect(layout.notes[0]?.lines).toEqual(["Spend limit", "Expiry"]);
    const svg = render(layout, sequenceTheme, "first");
    expect(svg).toContain("<path data-step=");
    expect(svg).toContain('stroke-dasharray="6 4"');
    expect(svg).toContain("grad-success-first");
    expect(render(layout, sequenceTheme, "second")).not.toContain("grad-success-first");
  });
  it("escapes authored labels and rejects an empty diagram", () => {
    const svg = render(
      doLayout(parse('A->>B: <script>alert("x")</script>')),
      sequenceTheme,
      "test",
    );
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(() => doLayout(parse(""))).toThrow();
    expect(() => parse("sequenceDiagram\nalt success")).toThrow();
  });
});
