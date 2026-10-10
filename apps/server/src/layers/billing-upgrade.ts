import { Context, Effect, Layer } from "effect";

import { Audit, upgradeExistingFreeSubscriptions } from "@namera-ai/application";
import { DatabaseMigration } from "@namera-ai/database";

export class BillingStartupUpgrade extends Context.Service<
  BillingStartupUpgrade,
  { readonly completed: true }
>()("server/BillingStartupUpgrade") {
  static readonly layer = Layer.effect(
    BillingStartupUpgrade,
    Effect.gen(function* () {
      yield* DatabaseMigration;
      const result = yield* upgradeExistingFreeSubscriptions();
      yield* Effect.logInfo("billing.free_v2_startup_completed").pipe(Effect.annotateLogs(result));
      return { completed: true as const };
    }),
  ).pipe(Layer.provide(Audit.layer), Layer.provideMerge(DatabaseMigration.layer));
}
