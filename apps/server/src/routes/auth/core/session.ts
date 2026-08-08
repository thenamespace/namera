import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";

import { notImplemented } from "#/routes/not-implemented";

export const SessionRoutes = HttpApiBuilder.group(NameraApi, "session", (handlers) =>
  Effect.succeed(
    handlers
      .handle("currentUser", () => notImplemented)
      .handle("listSessions", () => notImplemented)
      .handle("logout", () => notImplemented)
      .handle("revokeOtherSessions", () => notImplemented),
  ),
);
