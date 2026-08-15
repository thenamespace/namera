import { NodeCrypto } from "@effect/platform-node";
import { Config, Effect, Layer } from "effect";

import { Application } from "@namera-ai/application";
import { CryptoService } from "@namera-ai/crypto";
import { Database, DatabaseMigration, Repository, TransactionService } from "@namera-ai/database";
import { EmailJobs, EmailService, EmailWorkerLayer } from "@namera-ai/emails";
import { Evm } from "@namera-ai/evm";
import { WalletKeys } from "@namera-ai/wallet-keys";

import { ExecutionWorkerLayer } from "#/workers/execution";

const PersistenceLive = Layer.mergeAll(Repository.layer, TransactionService.layer).pipe(
  Layer.provide(Database.layer),
);

const CryptoLive = CryptoService.layer.pipe(Layer.provide(NodeCrypto.layer));

const EmailProviderLive = Layer.unwrap(
  Effect.map(Config.string("NODE_ENV").pipe(Config.withDefault("development")), (environment) =>
    environment === "development" ? EmailService.devLayer : EmailService.layer,
  ),
);

const EmailJobsLive = EmailJobs.layer.pipe(
  Layer.provide(PersistenceLive),
  Layer.provide(CryptoLive),
  Layer.provide(EmailProviderLive),
);

const WalletKeysLive = Layer.unwrap(
  Effect.map(Config.string("NODE_ENV").pipe(Config.withDefault("development")), (environment) =>
    environment === "development" ? WalletKeys.devLayer : WalletKeys.layer,
  ),
);

const EvmLive = Layer.unwrap(
  Effect.map(Config.string("NODE_ENV").pipe(Config.withDefault("development")), (environment) =>
    environment === "development" ? Evm.devLayer : Evm.layer,
  ),
);

export const ServicesLive = Layer.mergeAll(
  PersistenceLive,
  CryptoLive,
  EmailJobsLive,
  WalletKeysLive,
  EvmLive,
);

export const ApplicationLive = Application.layer;

export const EmailWorkerLive = Layer.unwrap(
  Effect.gen(function* () {
    yield* DatabaseMigration;
    return EmailWorkerLayer;
  }),
).pipe(Layer.provide(DatabaseMigration.layer), Layer.provide(ServicesLive));

export const ExecutionWorkerLive = Layer.unwrap(
  Effect.gen(function* () {
    yield* DatabaseMigration;
    return ExecutionWorkerLayer;
  }),
).pipe(
  Layer.provide(DatabaseMigration.layer),
  Layer.provide(ApplicationLive),
  Layer.provide(ServicesLive),
);
