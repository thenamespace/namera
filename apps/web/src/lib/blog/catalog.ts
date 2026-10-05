import type { BlogPost } from "./schema";

export const BLOG_PAGE_SIZE = 12;

export const filterPosts = (posts: readonly BlogPost[], query = "", tag = "") => {
  const terms = query.toLocaleLowerCase("en").trim().split(/\s+/).filter(Boolean);
  return posts.filter((post) => {
    if (tag && !post.tags.includes(tag)) return false;
    const haystack = [
      post.title,
      post.description,
      ...post.tags,
      ...post.authors.map((author) => author.name),
      post.searchText,
    ]
      .join(" ")
      .toLocaleLowerCase("en");
    return terms.every((term) => haystack.includes(term));
  });
};
export const blogPath = (slug: string) => `/blog/${encodeURIComponent(slug)}`;
export const formatBlogDate = (date: string) =>
  new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

export const xmlEscape = (text: string) =>
  text.replace(
    /[<>&"']/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[character] ?? character,
  );
