import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";

import {
  ListSessionsResponse,
  CurrentActorResponse,
  RevokeSessionRequest,
  RevokeSessionResponse,
  UserActorData,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class SessionGroup extends HttpApiGroup.make("session")
  .add(
    HttpApiEndpoint.get("currentActor", "/actor", {
      success: CurrentActorResponse,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "Get the current user or delegated actor"),
  )
  .add(
    HttpApiEndpoint.get("currentUser", "/me", {
      success: UserActorData,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "Get the current authenticated actor"),
  )
  .add(
    HttpApiEndpoint.get("listSessions", "/sessions", {
      success: ListSessionsResponse,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "List active sessions"),
  )
  .add(
    HttpApiEndpoint.delete("logout", "/sessions/logout", {
      success: Schema.Void,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "Log out the current session"),
  )
  .add(
    HttpApiEndpoint.post("revokeOtherSessions", "/sessions/revoke", {
      success: Schema.Int,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "Revoke every other active session"),
  )
  .add(
    HttpApiEndpoint.delete("revokeSession", "/sessions/:sessionId", {
      params: RevokeSessionRequest,
      success: RevokeSessionResponse,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "Revoke one user session"),
  )
  .annotate(OpenApi.Description, "Authenticated session management")
  .middleware(Authorization)
  .prefix("/auth/session") {}
