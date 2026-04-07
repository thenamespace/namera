import { Effect } from "effect";

import { HttpApiBuilder } from "effect/unstable/httpapi";

import { api } from "@namera-ai/api";

export const HealthGroupLive = HttpApiBuilder.group(api, "health", (handlers) =>
  handlers.handle("health", () => Effect.succeed({ status: "ok" })),
);
