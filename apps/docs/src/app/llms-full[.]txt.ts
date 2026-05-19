import { createFileRoute } from "@tanstack/react-router";

import { getLLMText } from "@/lib/llms";
import { source } from "@/lib/source";

export const Route = createFileRoute("/llms-full.txt")({
  server: {
    handlers: {
      GET: async () => {
        const scan = source.getPages().map(getLLMText);
        const scanned = await Promise.all(scan);
        return new Response(scanned.join("\n\n"), {
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
