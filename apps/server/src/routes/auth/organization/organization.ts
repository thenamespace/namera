import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";

import { notImplemented } from "#/routes/not-implemented";

export const OrganizationRoutes = HttpApiBuilder.group(NameraApi, "organization", (handlers) =>
  Effect.succeed(
    handlers
      .handle("create", () => notImplemented)
      .handle("list", () => notImplemented)
      .handle("setActive", () => notImplemented)
      .handle("getOrganization", () => notImplemented)
      .handle("update", () => notImplemented),
  ),
);
