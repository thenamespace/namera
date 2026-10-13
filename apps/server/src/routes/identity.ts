import { Effect } from "effect";
import { HttpServerRequest } from "effect/http";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import { Application, AuthConfig } from "@namera-ai/application";

import { enforceActor } from "#/helpers/index";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const IdentityRoutes = HttpApiBuilder.group(NameraApi, "identity", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application;
    const config = yield* AuthConfig;
    const authorize = Effect.fnUntraced(function* (write: boolean) {
      const actor = yield* enforceActor({
        actor: yield* CurrentActor,
        allowedActors: ["user"],
        requiredPermissions: { user: [write ? "wallet:update" : "wallet:read"] },
      });
      if (
        write &&
        (yield* HttpServerRequest.HttpServerRequest).headers.origin !==
          config.dashboardPublicOrigin.origin
      )
        return yield* new HttpApiError.Forbidden();
      yield* consumeRateLimit(
        `identity.${write ? "write" : "read"}`,
        actor.user.id,
        write ? rateLimitPolicy.identity.writes : rateLimitPolicy.identity.reads,
      );
      return { organizationId: actor.organization.id, actorId: actor.actorId };
    });
    return handlers
      .handle("primaryStatus", ({ params }) =>
        Effect.gen(function* () {
          return yield* app.ens.getPrimaryStatus({ ...(yield* authorize(false)), ...params });
        }),
      )
      .handle("preparePrimary", ({ params, payload }) =>
        Effect.gen(function* () {
          return yield* app.ens.preparePrimary({
            ...(yield* authorize(true)),
            ...params,
            request: payload,
          });
        }),
      )
      .handle("approvePrimary", ({ params, payload }) =>
        Effect.gen(function* () {
          return yield* app.ens.approvePrimary({
            ...(yield* authorize(true)),
            ...params,
            request: payload,
          });
        }),
      )
      .handle("networks", () =>
        Effect.gen(function* () {
          yield* authorize(false);
          return yield* app.ens.identityNetworks;
        }),
      )
      .handle("list", ({ params, query }) =>
        Effect.gen(function* () {
          return yield* app.ens.listIdentities({
            ...(yield* authorize(false)),
            ...params,
            ...query,
          });
        }),
      )
      .handle("get", ({ params }) =>
        Effect.gen(function* () {
          return yield* app.ens.getIdentity({ ...(yield* authorize(false)), ...params });
        }),
      )
      .handle("create", ({ params, payload }) =>
        Effect.gen(function* () {
          return yield* app.ens.createIdentity({
            ...(yield* authorize(true)),
            ...params,
            ...payload,
          });
        }),
      )
      .handle("updateRecords", ({ params, payload }) =>
        Effect.gen(function* () {
          return yield* app.ens.updateIdentityRecords({
            ...(yield* authorize(true)),
            ...params,
            request: payload,
          });
        }),
      );
  }),
);
