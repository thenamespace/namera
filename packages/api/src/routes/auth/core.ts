import { Schema } from "effect";

import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { Authorization } from "@/middlewares";
import { InternalError, Unauthorized } from "@namera-ai/schema";
import { CurrentActor, ListSessionsResponse } from "@namera-ai/schema/dto";

export const authCoreGroup = HttpApiGroup.make("auth")
  .add(
    HttpApiEndpoint.get("currentUser", "/me", {
      success: CurrentActor,
      error: [Unauthorized, InternalError],
    }),
  )
  .add(
    HttpApiEndpoint.get("listSessions", "/sessions", {
      success: ListSessionsResponse,
      error: [Unauthorized, InternalError],
    }),
  )
  .add(
    HttpApiEndpoint.delete("logout", "/sessions/me", {
      success: Schema.Void,
      error: [Unauthorized, InternalError],
    }),
  )
  .add(
    HttpApiEndpoint.post("revokeOtherSessions", "/sessions", {
      success: Schema.Int,
      error: [Unauthorized, InternalError],
    }),
  )
  .middleware(Authorization)
  .prefix("/auth");
