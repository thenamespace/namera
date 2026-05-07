// src/routes/api/rss.ts

import { createFileRoute } from "@tanstack/react-router";

import { Feed, type Item } from "feed";

import { env } from "@/lib/env";
import { sourceBlog } from "@/lib/source";

export const Route = createFileRoute("/blog/rss.xml")({
  server: {
    handlers: {
      GET: async () => {
        const pages = sourceBlog.getPages();

        const posts = await Promise.all(
          pages.map(async (page) => {
            const text = await page.data.getText("processed");
            const datePublished =
              typeof page.data.date === "string"
                ? new Date(page.data.date)
                : page.data.date;
            const dateModified = page.data.lastModified ?? new Date();
            // biome-ignore lint/style/noNonNullAssertion: safe
            const slug = page.slugs[0]!;
            const url = new URL(`/blog/${slug}`, env.baseUrl);

            return {
              title: page.data.title,
              description: page.data.description,
              link: url.toString(),
              date: dateModified,
              author: page.data.authors.map((a) => ({
                name: a.name,
                url: a.url,
              })),
              content: text,
              image: page.data.image,
              published: datePublished,
              id: url.toString(),
            } satisfies Item;
          }),
        );

        // 2. Initialize the feed
        const feed = new Feed({
          title: "Namera Blog",
          description:
            "Deep dives on programmable wallet infrastructure, session keys, smart accounts, and safe onchain execution for developers building autonomous agents.",
          id: "https://namera.ai/blog",
          link: "https://namera.ai/blog",
          language: "en",
          copyright: `All rights reserved ${new Date().getFullYear()}, Namera`,
          updated: new Date(),
        });

        for (const post of posts) {
          feed.addItem(post);
        }

        return new Response(feed.rss2(), {
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control":
              "public, max-age=3600, stale-while-revalidate=86400",
          },
        });
      },
    },
  },
});
