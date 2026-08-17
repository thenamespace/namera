import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";

import { enforceActor, toOAuthAuthorizationResponse } from "#/helpers/index";

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
      .handle("getOAuthDeviceAuthorization", ({ query }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          const { authorization, client, userCode } = yield* app.oauth.device.get({
            userCode: query.userCode,
            userId: data.user.id,
          });
          return {
            id: authorization.id,
            userCode,
            client: {
              id: client.id,
              clientId: client.clientId,
              registrationType: client.registrationType,
              clientName: client.clientName,
              clientUri: client.clientUri,
              logoUri: client.logoUri,
            },
            requestedScopes: authorization.requestedScopes,
            resource: authorization.resource,
            deviceName: authorization.metadata.deviceName,
            cliVersion: authorization.metadata.cliVersion,
            platform: authorization.metadata.platform,
            expiresAt: authorization.expiresAt,
          };
        }),
      )
      .handle("approveOAuthDeviceAuthorization", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["cli-authorization:create"] },
          });
          if (data.organization.id !== payload.organizationId) {
            return yield* new HttpApiError.Forbidden();
          }
          yield* app.oauth.device.approve({
            ...payload,
            actorId: data.actorId,
            userId: data.user.id,
          });
          return { status: "approved" as const };
        }),
      )
      .handle("denyOAuthDeviceAuthorization", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          yield* app.oauth.device.deny({
            deviceAuthorizationId: payload.deviceAuthorizationId,
            userId: data.user.id,
          });
          return { status: "denied" as const };
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
          return (yield* app.oauth.authorization.list(data.organization.id, "mcp")).map(
            toOAuthAuthorizationResponse,
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
          return toOAuthAuthorizationResponse(
            yield* app.oauth.authorization.get(data.organization.id, params.authorizationId, "mcp"),
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
          return toOAuthAuthorizationResponse(
            yield* app.oauth.authorization.revoke({
              organizationId: data.organization.id,
              actorId: data.actorId,
              authorizationId: payload.authorizationId,
              type: "mcp",
            }),
          );
        }),
      )
      .handle("listCliAuthorizations", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["cli-authorization:read"] },
          });
          return (yield* app.oauth.authorization.list(data.organization.id, "cli")).map(
            toOAuthAuthorizationResponse,
          );
        }),
      )
      .handle("getCliAuthorization", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["cli-authorization:read"] },
          });
          return toOAuthAuthorizationResponse(
            yield* app.oauth.authorization.get(data.organization.id, params.authorizationId, "cli"),
          );
        }),
      )
      .handle("revokeCliAuthorization", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["cli-authorization:revoke"] },
          });
          return toOAuthAuthorizationResponse(
            yield* app.oauth.authorization.revoke({
              organizationId: data.organization.id,
              actorId: data.actorId,
              authorizationId: payload.authorizationId,
              type: "cli",
            }),
          );
        }),
      );
  }),
);
