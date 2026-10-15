import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import { Application, AuthConfig } from "@namera-ai/application";

import { enforceWalletOwner, requireDashboardOrigin } from "#/helpers/index";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const WalletSignatureRoutes = HttpApiBuilder.group(
  NameraApi,
  "walletSignature",
  (handlers) =>
    Effect.gen(function* () {
      const app = yield* Application;
      const config = yield* AuthConfig;
      const authorize = Effect.fnUntraced(function* () {
        const actor = yield* enforceWalletOwner(yield* CurrentActor);

        yield* requireDashboardOrigin(config.dashboardPublicOrigin.origin);
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
