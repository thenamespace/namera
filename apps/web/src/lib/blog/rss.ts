import { Feed } from "feed";

import { SITE } from "../seo";
import { blogPath } from "./catalog";
import type { BlogPost } from "./schema";
import { BLOG_DESCRIPTION } from "./seo";

export const renderBlogRss = (posts: readonly BlogPost[]) => {
  const publicPosts = posts.filter((post) => !post.seo?.noindex);
  const latestDate = publicPosts.reduce((latest, post) => {
    const date = post.updated ?? post.date;
    return date > latest ? date : latest;
  }, "");
  const feed = new Feed({
    title: "Namera Blog",
    description: BLOG_DESCRIPTION,
    id: `${SITE.origin}/blog`,
    link: `${SITE.origin}/blog`,
    language: "en-us",
    image: SITE.logo,
    favicon: "https://cdn.namera.ai/seo/favicon.ico",
    ...(latestDate ? { updated: new Date(`${latestDate}T00:00:00Z`) } : {}),
    copyright: "Namespace Inc. All rights reserved.",
    feedLinks: { rss: `${SITE.origin}/blog/rss.xml` },
  });

  for (const post of publicPosts) {
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
