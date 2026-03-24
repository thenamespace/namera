import { createFileRoute } from "@tanstack/react-router";

import { ImageResponse } from "@takumi-rs/image-response";
import { Schema } from "effect";

const OgSearchSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  title: Schema.String,
});

export const Route = createFileRoute("/api/og")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const searchParams = Object.fromEntries(url.searchParams.entries());
        const search = Schema.decodeUnknownSync(OgSearchSchema)(searchParams);
        const { title, description } = search;

        const fontResponse = await fetch(
          "https://cdn.jsdelivr.net/npm/typeface-inter@3.15.1/Inter%20Web/Inter.var.woff2",
        );
        const fontData = await fontResponse.arrayBuffer();

        return new ImageResponse(
          <div tw="flex flex-col gap-2">
            <div>Title: {title}</div>
            <div>Description: {description}</div>
          </div>,
          {
            fonts: [
              {
                data: fontData,
                name: "Inter",
                style: "normal",
                weight: 400,
              },
            ],
            height: 630,
            width: 1200,
          },
        );
      },
    },
  },
});
