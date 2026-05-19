import { createFileRoute } from "@tanstack/react-router";

import { getLLMsIndex } from "@/lib/llms";
import { source } from "@/lib/source";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET() {
        return new Response(getLLMsIndex(source.getPages()), {
          headers: {
            "Cache-Control": "public, max-age=300, must-revalidate",
            "Content-Type": "text/plain; charset=utf-8",
            "Last-Modified": new Date().toUTCString(),
          },
        });
      },
    },
  },
});
