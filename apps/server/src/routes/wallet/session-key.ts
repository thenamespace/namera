import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import {
  enforceActor,
  enforceManagementActor,
  requireDashboardOrigin,
  toActorReadScope,
  toSessionKeyResponse,
} from "#/helpers/index";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const SessionKeyRoutes = HttpApiBuilder.group(NameraApi, "sessionKey", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    const config = yield* Application.AuthConfig;

    return handlers
      .handle("cancelOperation", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceManagementActor(actor);
          if (actor.type === "user")
            yield* requireDashboardOrigin(config.dashboardPublicOrigin.origin);
          yield* consumeRateLimit(
            "session_key.operation.organization",
            data.organizationId,
            rateLimitPolicy.sessionKey.revokeByOrganization,
          );
          return yield* app.sessionKey.cancelOperation({
            organizationId: data.organizationId,
            actorId: data.actorId,
            allowedKinds: data.allowedKinds,
            ...params,
          });
        }),
      )
      .handle("prepareManagedOperation", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceManagementActor(
            actor,
            payload.kind === "install" ? "session-key:install" : "session-key:uninstall",
          );
          if (actor.type === "user")
            yield* requireDashboardOrigin(config.dashboardPublicOrigin.origin);
          yield* consumeRateLimit(
            "session_key.operation.organization",
            data.organizationId,
            rateLimitPolicy.sessionKey.revokeByOrganization,
          );
          return yield* app.sessionKey.prepareManagedOperation({
            organizationId: data.organizationId,
            actorId: data.actorId,
            request: payload,
          });
        }),
      )
      .handle("approveManagedOperation", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceManagementActor(actor);
          if (actor.type === "user")
            yield* requireDashboardOrigin(config.dashboardPublicOrigin.origin);
          yield* consumeRateLimit(
            "session_key.operation.organization",
            data.organizationId,
            rateLimitPolicy.sessionKey.revokeByOrganization,
          );
          return yield* app.sessionKey.approveManagedOperation({
            organizationId: data.organizationId,
            actorId: data.actorId,
            allowedKinds: data.allowedKinds,
            request: payload,
          });
        }),
      )
      .handle("getActiveOperation", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceManagementActor(actor, "session-key:read");
          return yield* app.sessionKey.getActiveOperation({
            organizationId: data.organizationId,
            actorId: data.actorId,
            request: params,
            ownOperationsOnly: actor.type === "api-key",
          });
        }),
      )
      .handle("getOperation", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceManagementActor(actor, "session-key:read");
          return yield* app.sessionKey.getOperation({
            organizationId: data.organizationId,
            operationId: params.operationId,
            ...(actor.type === "api-key" ? { actorId: data.actorId } : {}),
          });
        }),
      )
      .handle("completeOperation", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceManagementActor(actor);
          if (actor.type === "user")
            yield* requireDashboardOrigin(config.dashboardPublicOrigin.origin);
          yield* consumeRateLimit(
            "session_key.operation.organization",
            data.organizationId,
            rateLimitPolicy.sessionKey.revokeByOrganization,
          );
          return yield* app.sessionKey.completeOperation({
            organizationId: data.organizationId,
            actorId: data.actorId,
            allowedKinds: data.allowedKinds,
            request: payload,
          });
        }),
      )
      .handle("prepareOperation", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceManagementActor(
            actor,
            payload.kind === "install" ? "session-key:install" : "session-key:uninstall",
          );
          if (actor.type === "user")
            yield* requireDashboardOrigin(config.dashboardPublicOrigin.origin);
          yield* consumeRateLimit(
            "session_key.operation.organization",
            data.organizationId,
            rateLimitPolicy.sessionKey.revokeByOrganization,
          );
          return yield* app.sessionKey.prepareOperation({
            organizationId: data.organizationId,
            actorId: data.actorId,
            request: payload,
          });
        }),
      )
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceManagementActor(actor, "session-key:create");
          if (actor.type === "user")
            yield* requireDashboardOrigin(config.dashboardPublicOrigin.origin);
          if (payload.signer.custody === "namera-managed") {
            yield* consumeRateLimit(
              "session_key.create_managed.organization",
              data.organizationId,
              rateLimitPolicy.sessionKey.createManagedByOrganization,
            );
          }
          return toSessionKeyResponse(
            yield* app.sessionKey.create({
              organizationId: data.organizationId,
              actorId: data.actorId,
              request: payload,
            }),
          );
        }),
      )
      .handle("listForOrganization", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user", "api-key", "cli", "mcp"],
            requiredPermissions: {
              user: ["session-key:read"],
              "api-key": [],
              cli: ["session-key:read"],
              mcp: ["mcp:read"],
            },
          });
          return (yield* app.sessionKey.listForOrganization(
            toActorReadScope(data, "session-key:read"),
          )).map(toSessionKeyResponse);
        }),
      )
      .handle("listForWallet", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user", "api-key", "cli", "mcp"],
            requiredPermissions: {
              user: ["session-key:read"],
              "api-key": [],
              cli: ["session-key:read"],
              mcp: ["mcp:read"],
            },
          });
          return (yield* app.sessionKey.listForWallet({
            ...toActorReadScope(data, "session-key:read"),
            walletId: params.walletId,
          })).map(toSessionKeyResponse);
        }),
      )
      .handle("get", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user", "api-key", "cli", "mcp"],
            requiredPermissions: {
              user: ["session-key:read"],
              "api-key": [],
              cli: ["session-key:read"],
              mcp: ["mcp:read"],
            },
          });
          return toSessionKeyResponse(
            yield* app.sessionKey.get({
              ...toActorReadScope(data, "session-key:read"),
              sessionKeyId: params.sessionKeyId,
            }),
          );
        }),
      )
      .handle("revoke", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceManagementActor(actor, "session-key:revoke");
          if (actor.type === "user")
            yield* requireDashboardOrigin(config.dashboardPublicOrigin.origin);
          yield* consumeRateLimit(
            "session_key.revoke.organization",
            data.organizationId,
            rateLimitPolicy.sessionKey.revokeByOrganization,
          );
          return toSessionKeyResponse(
            yield* app.sessionKey.revoke({
              organizationId: data.organizationId,
              actorId: data.actorId,
              sessionKeyId: params.sessionKeyId,
            }),
          );
        }),
      );
  }),
);
