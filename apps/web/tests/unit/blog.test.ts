import { Schema } from "effect";

import { describe, expect, it } from "vitest";

import { parse, doLayout } from "../../src/components/blog/diagrams/sequence-layout";
import { render } from "../../src/components/blog/diagrams/sequence-svg";
import { sequenceTheme } from "../../src/components/blog/diagrams/theme";
import { filterPosts } from "../../src/lib/blog/catalog";
import { renderBlogRss } from "../../src/lib/blog/rss";
import { BlogFrontmatter, type BlogPost } from "../../src/lib/blog/schema";
import { articleHead } from "../../src/lib/blog/seo";
import { jsonLd } from "../../src/lib/seo";

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
