import { createFileRoute } from "@tanstack/react-router";

import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/lib/source";

const getTag = (slug: string) => {
  if (slug.startsWith("sdk")) return "sdk";
  if (slug.startsWith("cli")) return "cli";
  return "platform";
};

const server = createFromSource(source, {
  buildIndex(page) {
    return {
      description: page.data.description,
      id: page.url,
      structuredData: page.data.structuredData,
      tag: getTag(page.slugs[0] ?? ""),
      title: page.data.title,
      url: page.url,
    };
  },
  language: "english",
});

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: async ({ request }) => server.GET(request),
    },
  },
});
