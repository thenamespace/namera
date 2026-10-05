import { renderToStaticMarkup } from "react-dom/server";

import { expect, it, vi } from "vitest";

import { blog } from "../../.source/server";
import { blogMdxComponents } from "../../src/components/blog/mdx-components";
import { getPublishedPosts } from "../../src/lib/blog/source.server";

it("routes Mermaid code fences to the lazy diagram component", () => {
  const Pre = blogMdxComponents.pre;
  const html = renderToStaticMarkup(
    <Pre>
      <code className="language-mermaid">{"flowchart LR\nA --> B"}</code>
    </Pre>,
  );
  expect(html).toContain("Loading diagram");
  expect(html).toContain("Diagram source");
});

it("renders the first article with all supplied diagrams and highlighted code", async () => {
  const article = blog.find(
    (entry) => entry.info.path === "agents-need-permissions-not-private-keys.mdx",
  );
  if (!article) throw new Error("First article missing");
  const { body: Article } = await article.load();
  const html = renderToStaticMarkup(<Article components={blogMdxComponents} />);
  expect(html).toContain("Introducing Namera");
  expect(html.match(/<figure/g)).toHaveLength(3);
  expect(html).toContain("createSessionKey");
  expect(html).not.toContain("[!code focus]");
  expect(html).toContain("--shiki-dark:");
  expect(html).toContain("github-dark-default");
  expect(html).not.toContain("Diagram source");
  expect(html).not.toContain("Show all");
  expect(html.match(/aria-label="Replay sequence diagram"/g)).toHaveLength(3);
});

it("publishes only public collection entries with searchable article text", async () => {
  const posts = await getPublishedPosts();
  expect(posts.some((post) => post.slug === "agents-need-permissions-not-private-keys")).toBe(true);
  expect(posts.every((post) => !post.path.includes("_drafts"))).toBe(true);
  expect(posts[0]?.searchText).toContain("cron job");
});

it("evaluates scheduled publication at request time", async () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date("2026-04-13T23:59:59Z"));
    expect(await getPublishedPosts()).toEqual([]);
    vi.setSystemTime(new Date("2026-04-14T00:00:00Z"));
    expect(
      (await getPublishedPosts()).some(
        (post) => post.slug === "agents-need-permissions-not-private-keys",
      ),
    ).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});
