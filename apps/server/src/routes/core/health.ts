import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";

export const HealthRoutes = HttpApiBuilder.group(NameraApi, "health", (handlers) =>
  Effect.succeed(handlers.handle("health", () => Effect.succeed({ status: true }))),
);
