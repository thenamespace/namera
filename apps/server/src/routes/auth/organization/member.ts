import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";

import { notImplemented } from "#/routes/not-implemented";

export const MemberRoutes = HttpApiBuilder.group(NameraApi, "member", (handlers) =>
  Effect.succeed(handlers.handle("listOrgMembers", () => notImplemented)),
);
