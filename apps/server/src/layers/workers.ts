import { Effect, Layer } from "effect";

import { DatabaseMigration } from "@namera-ai/database";
import { EmailWorkerLayer } from "@namera-ai/emails";
import { AnalyticsCollection } from "@namera-ai/telemetry/analytics/collection";
import { ProductAnalytics } from "@namera-ai/telemetry/analytics/server";

import { AnalyticsWorkerLayer } from "#/workers/analytics";
import { BillingWorkerLayer } from "#/workers/billing";
import { ExecutionWorkerLayer } from "#/workers/execution";
import { SessionKeyWorkerLayer } from "#/workers/session-key";
import { WalletOperationWorkerLayer } from "#/workers/wallet-operation";

import { ApplicationLive, ServicesLive } from "./services.js";

export const WorkersLive = Layer.unwrap(
  Effect.gen(function* () {
    // Workers can start before the HTTP listener, so they need their own migration gate.
    yield* DatabaseMigration;
    const analytics = yield* ProductAnalytics;

    const operationWorkers = Layer.mergeAll(
      ExecutionWorkerLayer,
      SessionKeyWorkerLayer,
      WalletOperationWorkerLayer,
    ).pipe(
      Layer.provide(
        Layer.succeed(AnalyticsCollection)(analytics.enabled ? "background" : "disabled"),
      ),
    );

    return Layer.mergeAll(
      EmailWorkerLayer,
      BillingWorkerLayer,
      AnalyticsWorkerLayer,
      operationWorkers,
    );
  }),
).pipe(
  Layer.provide(DatabaseMigration.layer),
  Layer.provide(ApplicationLive),
  Layer.provide(ServicesLive),
);
