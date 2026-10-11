import { createFileRoute } from "@tanstack/react-router";

import { docsLlms } from "#/lib/docs/llms.server";
import { docsSource } from "#/lib/docs/source.server";
import { markdownResponse } from "#/lib/markdown/response";
import { SITE } from "#/lib/seo";

export const Route = createFileRoute("/api/docs/markdown/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        // TanStack Router names its catch-all route parameter `_splat`.
        // eslint-disable-next-line no-underscore-dangle
        const page = docsSource.getPage(params._splat?.split("/").filter(Boolean) ?? []);
        if (!page) return new Response("Documentation page not found", { status: 404 });

        return markdownResponse(await docsLlms().page(page), `${SITE.origin}${page.url}`);
      },
    },
  },
});
