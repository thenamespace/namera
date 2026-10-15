import { Schema } from "effect";

import { describe, expect, it } from "vitest";

import { filterPosts, formatBlogDate } from "../../src/lib/blog/catalog";
import { renderBlogRss } from "../../src/lib/blog/rss";
import { BlogFrontmatter, type BlogPost } from "../../src/lib/blog/schema";

const frontmatter = {
  title: "Wallets & agents",
  description: "A guide to scoped access",
  date: "2026-10-01",
  tags: ["engineering"],
  authors: [{ name: "Example Author" }],
};
const post: BlogPost = {
  ...Schema.decodeUnknownSync(BlogFrontmatter)(frontmatter),
  slug: "wallets-and-agents",
  path: "wallets-and-agents.mdx",
  readingMinutes: 2,
  searchText: "Limits on token transfers",
};

describe("blog publication inputs and discovery", () => {
  it.each([
    ["impossible date", { date: "2026-02-30" }],
    ["update before publication", { updated: "2026-09-30" }],
    ["empty author list", { authors: [] }],
    ["unsafe author link", { authors: [{ name: "Example", url: "javascript:alert(1)" }] }],
  ])("rejects %s before publishing", (_label, invalid) => {
    expect(Schema.is(BlogFrontmatter)({ ...frontmatter, ...invalid })).toBe(false);
  });

  it("combines search terms across content and author with the selected tag", () => {
    const other = { ...post, slug: "other", tags: ["release"] };
    expect(filterPosts([post, other], "  TOKEN author ", "engineering")).toEqual([post]);
    expect(filterPosts([post], "wallets missing")).toEqual([]);
    expect(filterPosts([post], "", "release")).toEqual([]);
    expect(formatBlogDate("2026-10-01")).toBe("October 1, 2026");
  });

  it("omits noindex entries and escapes authored content in the RSS feed", () => {
    const rss = renderBlogRss([
      post,
      { ...post, slug: "private-preview", title: "Hidden draft", seo: { noindex: true } },
    ]);
    expect(rss).toContain("wallets-and-agents");
    expect(rss).not.toContain("private-preview");
    expect(rss).not.toContain("Hidden draft");
    expect(rss).toContain("<![CDATA[Wallets & agents]]>");
    expect(rss).toContain("Thu, 01 Oct 2026 00:00:00 GMT");
  });
});
