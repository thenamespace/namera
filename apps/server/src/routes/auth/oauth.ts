import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";

import { enforceActor, toMcpAuthorizationResponse } from "#/helpers/index";

export const OAuthRoutes = HttpApiBuilder.group(NameraApi, "oauth", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application;
    return handlers
      .handle("getOAuthAuthorizationRequest", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          yield* enforceActor({ actor, allowedActors: ["user"] });
          const { request, client } = yield* app.oauth.request.get(params.requestId);
          return {
            id: request.id,
            client: {
              id: client.id,
              clientId: client.clientId,
              registrationType: client.registrationType,
              clientName: client.clientName,
              clientUri: client.clientUri,
              logoUri: client.logoUri,
            },
            redirectUri: request.redirectUri,
            resource: request.resource,
            requestedScopes: request.requestedScopes,
            expiresAt: request.expiresAt,
            createdAt: request.createdAt,
          };
        }),
      )
      .handle("approveOAuthAuthorizationRequest", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["mcp-authorization:create"] },
          });
          if (data.organization.id !== payload.organizationId) {
            return yield* new HttpApiError.Forbidden();
          }
          const result = yield* app.oauth.authorization.approve({
            ...payload,
            actorId: data.actorId,
            userId: data.user.id,
          });
          return { redirectUrl: result.redirectUrl };
        }),
      )
      .handle("denyOAuthAuthorizationRequest", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          return yield* app.oauth.authorization.deny({
            requestId: payload.requestId,
            userId: data.user.id,
          });
        }),
      )
      .handle("listMcpAuthorizations", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["mcp-authorization:read"] },
          });
          return (yield* app.oauth.authorization.list(data.organization.id)).map(
            toMcpAuthorizationResponse,
          );
        }),
      )
      .handle("getMcpAuthorization", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["mcp-authorization:read"] },
          });
          return toMcpAuthorizationResponse(
            yield* app.oauth.authorization.get(data.organization.id, params.authorizationId),
          );
        }),
      )
      .handle("revokeMcpAuthorization", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["mcp-authorization:revoke"] },
          });
          return toMcpAuthorizationResponse(
            yield* app.oauth.authorization.revoke({
              organizationId: data.organization.id,
              actorId: data.actorId,
              authorizationId: payload.authorizationId,
            }),
          );
        }),
      );
  }),
);
