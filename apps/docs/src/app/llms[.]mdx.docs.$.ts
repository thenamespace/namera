import { createFileRoute, notFound } from "@tanstack/react-router";

import { getLLMText } from "@/lib/llms";
import { source } from "@/lib/source";

export const Route = createFileRoute("/llms.mdx/docs/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slugs = params._splat?.split("/") ?? [];
        const page = source.getPage(slugs);
        if (!page) throw notFound();

        return new Response(await getLLMText(page), {
          headers: {
            "Cache-Control": "public, max-age=300, must-revalidate",
            "Content-Type": "text/markdown",
            "Last-Modified": (
              page.data.lastModified ?? new Date()
            ).toUTCString(),
          },
        });
      },
    },
  },
});
