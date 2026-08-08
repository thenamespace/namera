import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { ListSessionsResponse, UserActorData } from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class SessionGroup extends HttpApiGroup.make("session")
  .add(
    HttpApiEndpoint.get("currentUser", "/me", {
      success: UserActorData,
      error: CommonErrors,
    }),
  )
  .add(
    HttpApiEndpoint.get("listSessions", "/sessions", {
      success: ListSessionsResponse,
      error: CommonErrors,
    }),
  )
  .add(
    HttpApiEndpoint.delete("logout", "/sessions/logout", {
      success: Schema.Void,
      error: CommonErrors,
    }),
  )
  .add(
    HttpApiEndpoint.post("revokeOtherSessions", "/sessions/revoke", {
      success: Schema.Int,
      error: CommonErrors,
    }),
  )
  .middleware(Authorization)
  .prefix("/auth/session") {}
