import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";

import { notImplemented } from "#/routes/not-implemented";

export const UserRoutes = HttpApiBuilder.group(NameraApi, "user", (handlers) =>
  Effect.succeed(handlers.handle("update", () => notImplemented)),
);
