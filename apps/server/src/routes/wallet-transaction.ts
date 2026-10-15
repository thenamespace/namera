import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import { Application, AuthConfig } from "@namera-ai/application";

import { enforceWalletOwner, requireDashboardOrigin } from "#/helpers/index";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const WalletTransactionRoutes = HttpApiBuilder.group(
  NameraApi,
  "walletTransaction",
  (handlers) =>
    Effect.gen(function* () {
      const app = yield* Application;
      const config = yield* AuthConfig;
      const authorize = Effect.fnUntraced(function* (write: boolean) {
        const actor = yield* enforceWalletOwner(yield* CurrentActor);

        if (write) {
          yield* requireDashboardOrigin(config.dashboardPublicOrigin.origin);
        }

        yield* consumeRateLimit(
          `wallet.transaction.${write ? "write" : "read"}`,
          actor.user.id,
          write ? rateLimitPolicy.identity.writes : rateLimitPolicy.identity.reads,
        );
        return { organizationId: actor.organization.id, actorId: actor.actorId };
      });
      return handlers
        .handle("cancel", ({ params }) =>
          Effect.gen(function* () {
            return yield* app.wallet.transactions.cancel({
              ...(yield* authorize(true)),
              ...params,
            });
          }),
        )
        .handle("prepare", ({ params, payload, headers }) =>
          Effect.gen(function* () {
            return yield* app.wallet.transactions.prepare({
              ...(yield* authorize(true)),
              ...params,
              request: payload,
              idempotencyKey: headers["idempotency-key"],
            });
          }),
        )
        .handle("complete", ({ params, payload }) =>
          Effect.gen(function* () {
            return yield* app.wallet.transactions.complete({
              ...(yield* authorize(true)),
              ...params,
              request: payload,
            });
          }),
        )
        .handle("get", ({ params }) =>
          Effect.gen(function* () {
            return yield* app.wallet.transactions.get({ ...(yield* authorize(false)), ...params });
          }),
        );
    }),
);
