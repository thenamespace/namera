import { Effect } from "effect";
import { HttpServerRequest } from "effect/http";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import { Application, AuthConfig } from "@namera-ai/application";

import { enforceActor } from "#/helpers/index";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const WalletSignatureRoutes = HttpApiBuilder.group(
  NameraApi,
  "walletSignature",
  (handlers) =>
    Effect.gen(function* () {
      const app = yield* Application;
      const config = yield* AuthConfig;
      const authorize = Effect.fnUntraced(function* () {
        const actor = yield* enforceActor({
          actor: yield* CurrentActor,
          allowedActors: ["user"],
          requiredPermissions: { user: ["wallet:update"] },
        });
        if (
          actor.role.type !== "system" ||
          actor.role.key !== "owner" ||
          (yield* HttpServerRequest.HttpServerRequest).headers.origin !==
            config.dashboardPublicOrigin.origin
        )
          return yield* new HttpApiError.Forbidden();
        yield* consumeRateLimit(
          "wallet.signature.write",
          actor.user.id,
          rateLimitPolicy.walletSignature,
        );
        return { organizationId: actor.organization.id, actorId: actor.actorId };
      });
      return handlers
        .handle("prepare", ({ params, payload, headers }) =>
          Effect.gen(function* () {
            return yield* app.wallet.signatures.prepare({
              ...(yield* authorize()),
              ...params,
              request: payload,
              idempotencyKey: headers["idempotency-key"],
            });
          }),
        )
        .handle("complete", ({ params, payload }) =>
          Effect.gen(function* () {
            return yield* app.wallet.signatures.complete({
              ...(yield* authorize()),
              ...params,
              request: payload,
            });
          }),
        );
    }),
);
