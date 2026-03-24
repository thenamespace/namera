import { createFileRoute } from "@tanstack/react-router";

// import { ImageResponse } from "@takumi-rs/image-response";
import { Schema } from "effect";

const OgSearchSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  title: Schema.String,
});

export const Route = createFileRoute("/api/og")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url);
        const searchParams = Object.fromEntries(url.searchParams.entries());
        const search = Schema.decodeUnknownSync(OgSearchSchema)(searchParams);
        const { title, description } = search;

        return Response.json({});

        // return new ImageResponse(
        //   <div tw="flex flex-col gap-2">
        //     <div>Title: {title}</div>
        //     <div>Description: {description}</div>
        //   </div>,
        //   {
        //     height: 630,
        //     width: 1200,
        //   },
        // );
      },
    },
  },
});
