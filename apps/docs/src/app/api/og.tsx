import { createFileRoute } from "@tanstack/react-router";

import {
  ImageResponse,
  type ImageResponseOptions,
} from "@takumi-rs/image-response";
import { Schema } from "effect";

import {
  BlogOgImageResponse,
  BlogOgParams,
  DocsOgImageResponse,
  DocsOgParams,
} from "@/components/og";

const OgParams = Schema.Union([BlogOgParams, DocsOgParams]);

export const Route = createFileRoute("/api/og")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);

        const searchParams = Object.fromEntries(url.searchParams.entries());
        const search = Schema.decodeUnknownOption(OgParams)(searchParams);

        if (search._tag === "None") {
          return Response.json(
            { error: "Invalid search params" },
            { status: 400 },
          );
        }

        const helveticaNowTextUrl = new URL(
          "/fonts/HelveticaNowText-Regular.woff2",
          url,
        );

        const helveticaNowDisplayUrl = new URL(
          "/fonts/HelveticaNowDisplay-Medium.woff2",
          url,
        );

        const helveticaNowText = await fetch(helveticaNowTextUrl).then((res) =>
          res.arrayBuffer(),
        );

        const helveticaNowDisplay = await fetch(helveticaNowDisplayUrl).then(
          (res) => res.arrayBuffer(),
        );

        const imageOptions: ImageResponseOptions = {
          fonts: [
            {
              data: helveticaNowText,
              name: "Helvetica Now Text",
              style: "normal",
              weight: 400,
            },
            {
              data: helveticaNowDisplay,
              name: "HelveticaDisplay",
              style: "normal",
              weight: 500,
            },
          ],
          format: "png",
          height: 630,
          quality: 100,
          width: 1200,
        };

        if (search.value.type === "blog") {
          return new ImageResponse(
            <BlogOgImageResponse {...search.value} baseUrl={url.toString()} />,
            imageOptions,
          );
        }

        if (search.value.type === "docs") {
          return new ImageResponse(
            <DocsOgImageResponse {...search.value} baseUrl={url.toString()} />,
            imageOptions,
          );
        }

        return Response.json(
          { error: "Invalid search params" },
          { status: 400 },
        );
      },
    },
  },
});
