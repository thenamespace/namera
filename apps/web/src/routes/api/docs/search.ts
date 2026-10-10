import { createFileRoute } from "@tanstack/react-router";

import { docsSearch } from "#/lib/docs/search.server";

export const Route = createFileRoute("/api/docs/search")({
  server: {
    handlers: {
      GET: ({ request }) => docsSearch.GET(request),
    },
  },
});
