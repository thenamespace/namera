import { Schema } from "effect";

import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

export const healthGroup = HttpApiGroup.make("health").add(
  HttpApiEndpoint.get("health", "/health", {
    success: Schema.Struct({
      status: Schema.Literal("ok"),
    }),
  }),
);
