import { HttpApiBuilder } from "@effect/platform";
import { api } from "@namera-ai/api";
import { Effect } from "effect";

const healthHandler = () => Effect.succeed("ok");

export const HealthGroupLive = HttpApiBuilder.group(api, "health", (handlers) =>
  handlers.handle("health", healthHandler),
);
