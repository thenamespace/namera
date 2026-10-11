import { createFileRoute } from "@tanstack/react-router";

import { ImageResponse } from "takumi-js/response";

import { DocsOgImage } from "#/lib/docs/og-image";
import { getDocsSection } from "#/lib/docs/sections";
import { docsSource } from "#/lib/docs/source.server";

export const Route = createFileRoute("/(seo)/og/docs/$")({
  server: {
    handlers: {
      GET: ({ params }) => {
        // TanStack Router names its catch-all route parameter `_splat`.
        // eslint-disable-next-line no-underscore-dangle
        const segments = params._splat?.split("/") ?? [];
        if (segments.pop() !== "image.png") return new Response("Not found", { status: 404 });
        const page = docsSource.getPage(segments);
        if (!page) return new Response("Documentation page not found", { status: 404 });

        return new ImageResponse(
          <DocsOgImage
            section={getDocsSection(page.url)}
            title={page.data.title}
            description={page.data.description}
          />,
          {
            width: 1200,
            height: 630,
            format: "png",
            headers: {
              "Cache-Control": import.meta.env.DEV
                ? "no-store"
                : "public, max-age=3600, s-maxage=86400",
            },
          },
        );
      },
    },
  },
});
