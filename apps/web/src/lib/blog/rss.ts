import { Feed } from "feed";

import { SITE } from "../seo";
import { blogPath } from "./catalog";
import type { BlogPost } from "./schema";
import { BLOG_DESCRIPTION } from "./seo";

export const renderBlogRss = (posts: readonly BlogPost[]) => {
  const feed = new Feed({
    title: "Namera Blog",
    description: BLOG_DESCRIPTION,
    id: `${SITE.origin}/blog`,
    link: `${SITE.origin}/blog`,
    language: "en-us",
    copyright: "Namespace Inc. All rights reserved.",
    feedLinks: { rss: `${SITE.origin}/blog/rss.xml` },
  });

  for (const post of posts) {
    if (post.seo?.noindex) continue;
    const url = `${SITE.origin}${blogPath(post.slug)}`;
    feed.addItem({
      title: post.title,
      id: url,
      link: url,
      description: post.description,
      date: new Date(`${post.date}T00:00:00Z`),
      author: post.authors.map((author) => ({
        name: author.name,
        ...(author.url ? { link: author.url } : {}),
      })),
      category: post.tags.map((name) => ({ name })),
    });
  }

  return feed.rss2();
};
