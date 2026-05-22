import { Schema } from "effect";

import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { Authorization } from "@/middlewares";
import {
  AuthenticatedUserResponse,
  DatabaseError,
  ListSessionResponse,
  Unauthorized,
} from "@namera-ai/schema";

export const authCoreGroup = HttpApiGroup.make("auth")
  .add(
    HttpApiEndpoint.get("currentUser", "/me", {
      success: AuthenticatedUserResponse,
      error: [Unauthorized, DatabaseError],
    }),
  )
  .add(
    HttpApiEndpoint.get("listSessions", "/sessions", {
      success: ListSessionResponse,
      error: [Unauthorized, DatabaseError],
    }),
  )
  .add(
    HttpApiEndpoint.delete("logout", "/sessions/me", {
      success: Schema.Void,
      error: [Unauthorized, DatabaseError],
    }),
  )
  .add(
    HttpApiEndpoint.post("revokeOtherSessions", "/sessions", {
      success: Schema.Int,
      error: [Unauthorized, DatabaseError],
    }),
  )
  .middleware(Authorization)
  .prefix("/auth");
