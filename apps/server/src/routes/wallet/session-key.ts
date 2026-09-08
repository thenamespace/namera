import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceActor, toActorReadScope, toSessionKeyResponse } from "#/helpers/index";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const SessionKeyRoutes = HttpApiBuilder.group(NameraApi, "sessionKey", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;

    return handlers
      .handle("getActiveOperation", ({ params }) =>
        Effect.gen(function* () {
          const data = yield* enforceActor({
            actor: yield* CurrentActor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["session-key:read"] },
          });
          return yield* app.sessionKey.getActiveOperation({
            organizationId: data.organization.id,
            actorId: data.actorId,
            request: params,
          });
        }),
      )
      .handle("getOperation", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["session-key:read"] },
          });
          return yield* app.sessionKey.getOperation({
            organizationId: data.organization.id,
            operationId: params.operationId,
          });
        }),
      )
      .handle("completeOperation", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          const allowedKinds: Array<"install" | "uninstall"> = [];
          if (data.role.permissions.includes("session-key:create")) allowedKinds.push("install");
          if (data.role.permissions.includes("session-key:revoke")) allowedKinds.push("uninstall");
          yield* consumeRateLimit(
            "session_key.operation.organization",
            data.organization.id,
            rateLimitPolicy.sessionKey.revokeByOrganization,
          );
          return yield* app.sessionKey.completeOperation({
            organizationId: data.organization.id,
            actorId: data.actorId,
            allowedKinds,
            request: payload,
          });
        }),
      )
      .handle("prepareOperation", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: {
              user: [payload.kind === "install" ? "session-key:create" : "session-key:revoke"],
            },
          });
          yield* consumeRateLimit(
            "session_key.operation.organization",
            data.organization.id,
            rateLimitPolicy.sessionKey.revokeByOrganization,
          );
          return yield* app.sessionKey.prepareOperation({
            organizationId: data.organization.id,
            actorId: data.actorId,
            request: payload,
          });
        }),
      )
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["session-key:create"] },
          });
          return toSessionKeyResponse(
            yield* app.sessionKey.create({
              organizationId: data.organization.id,
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
          return (yield* app.sessionKey.listForOrganization(toActorReadScope(data))).map(
            toSessionKeyResponse,
          );
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
            ...toActorReadScope(data),
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
              ...toActorReadScope(data),
              sessionKeyId: params.sessionKeyId,
            }),
          );
        }),
      )
      .handle("revoke", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["session-key:revoke"] },
          });
          yield* consumeRateLimit(
            "session_key.revoke.organization",
            data.organization.id,
            rateLimitPolicy.sessionKey.revokeByOrganization,
          );
          return toSessionKeyResponse(
            yield* app.sessionKey.revoke({
              organizationId: data.organization.id,
              actorId: data.actorId,
              sessionKeyId: params.sessionKeyId,
            }),
          );
        }),
      );
  }),
);
