import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";

import { notImplemented } from "#/routes/not-implemented";

export const InvitationRoutes = HttpApiBuilder.group(NameraApi, "invitation", (handlers) =>
  Effect.succeed(
    handlers
      .handle("getInvitation", () => notImplemented)
      .handle("listInvitations", () => notImplemented)
      .handle("listUserInvitations", () => notImplemented)
      .handle("inviteMember", () => notImplemented)
      .handle("acceptInvitation", () => notImplemented)
      .handle("rejectInvitation", () => notImplemented)
      .handle("cancelInvitation", () => notImplemented),
  ),
);
