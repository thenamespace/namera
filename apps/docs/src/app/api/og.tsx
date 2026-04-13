import { createFileRoute } from "@tanstack/react-router";

import {
  ImageResponse,
  type ImageResponseOptions,
} from "@takumi-rs/image-response";
import { Schema } from "effect";

import { CommonOgImageResponse, CommonOgParams } from "@/components/og";

export const Route = createFileRoute("/api/og")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);

        const searchParams = Object.fromEntries(url.searchParams.entries());
        const search = Schema.decodeUnknownOption(CommonOgParams)(searchParams);

        if (search._tag === "None") {
          return Response.json(
            { error: "Invalid search params" },
            { status: 400 },
          );
        }

        const interRegularUrl = new URL("/fonts/InterRegular.ttf", url);
        const interMediumUrl = new URL("/fonts/InterMedium.ttf", url);

        const [interRegularText, interMediumText] = await Promise.all([
          fetch(interRegularUrl).then((res) => res.arrayBuffer()),
          fetch(interMediumUrl).then((res) => res.arrayBuffer()),
        ]);

        const imageOptions: ImageResponseOptions = {
          fonts: [
            {
              data: interRegularText,
              name: "Inter",
              style: "normal",
              weight: 400,
            },
            {
              data: interMediumText,
              name: "Inter",
              style: "normal",
              weight: 500,
            },
          ],
          format: "png",
          height: 630,
          quality: 100,
          width: 1200,
        };

        return new ImageResponse(
          <CommonOgImageResponse {...search.value} />,
          imageOptions,
        );
      },
    },
  },
});
