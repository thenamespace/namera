import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";

import { notImplemented } from "#/routes/not-implemented";

export const MagicLinkRoutes = HttpApiBuilder.group(NameraApi, "magicLink", (handlers) =>
  Effect.succeed(
    handlers.handle("request", () => notImplemented).handle("verify", () => notImplemented),
  ),
);
