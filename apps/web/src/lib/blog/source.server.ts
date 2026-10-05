import { blog } from "../../../.source/server";
import type { BlogPost } from "./schema";

// Bundle the authored text for search; no filesystem access is needed in Nitro.
// Avoid Fumadocs' processed Markdown stringifier, which recurses on strong text
// in the currently pinned release.
const sources = import.meta.glob<string>("../../../content/blog/*.mdx", {
  query: "?raw",
  import: "default",
  eager: true,
});
// Compiled content is immutable for a deployment. Do not cache the date filter.
const catalog = Promise.all(
  blog.map(async (entry): Promise<BlogPost> => {
    const slug = entry.info.path.replace(/\.mdx$/, "");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error(`Blog filename must be a lowercase kebab-case slug: ${entry.info.path}`);
    }
    const text = (sources[`../../../content/blog/${entry.info.path}`] ?? "")
      .replace(/^---[\s\S]*?---\s*/, "")
      .replace(/<SequenceDiagram[\s\S]*?\/>/g, "")
      .replace(/\[!code[^\]]*\]/g, "");
    return {
      slug,
      path: entry.info.path,
      title: entry.title,
      description: entry.description,
      date: entry.date,
      updated: entry.updated,
      tags: entry.tags,
      authors: entry.authors,
      cover: entry.cover,
      seo: entry.seo,
      readingMinutes: Math.max(1, Math.ceil(text.split(/\s+/).length / 220)),
      searchText: text,
    };
  }),
);

export const getPublishedPosts = async () => {
  const today = new Date().toISOString().slice(0, 10);
  return (await catalog)
    .filter((post) => post.date <= today)
    .toSorted((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
};
