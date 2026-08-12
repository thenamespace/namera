import { NodeCrypto } from "@effect/platform-node";
import { Config, Effect, Layer } from "effect";

import { Application } from "@namera-ai/application";
import { CryptoService } from "@namera-ai/crypto";
import { Database, DatabaseMigration, Repository, TransactionService } from "@namera-ai/database";
import { EmailJobs, EmailService, EmailWorkerLayer } from "@namera-ai/emails";
import { Evm } from "@namera-ai/evm";
import { GcpWalletKeysLayer, LocalWalletKeysLayer } from "@namera-ai/wallet-keys";

const PersistenceLive = Layer.mergeAll(Repository.layer, TransactionService.layer).pipe(
  Layer.provide(Database.layer),
);

const CryptoLive = CryptoService.layer.pipe(Layer.provide(NodeCrypto.layer));

const EmailProviderLive = Layer.unwrap(
  Effect.map(Config.string("NODE_ENV").pipe(Config.withDefault("development")), (environment) =>
    environment === "development" ? EmailService.developmentLayer : EmailService.layer,
  ),
);

const EmailJobsLive = EmailJobs.layer.pipe(
  Layer.provide(PersistenceLive),
  Layer.provide(CryptoLive),
  Layer.provide(EmailProviderLive),
);

const WalletKeysLive = Layer.unwrap(
  Effect.map(
    Config.literals(["local", "gcp-kms"], "WALLET_KEYS_PROVIDER").pipe(Config.withDefault("local")),
    (provider) => (provider === "gcp-kms" ? GcpWalletKeysLayer : LocalWalletKeysLayer),
  ),
);

export const ServicesLive = Layer.mergeAll(
  PersistenceLive,
  CryptoLive,
  EmailJobsLive,
  WalletKeysLive,
  Evm.layer,
);

export const ApplicationLive = Application.layer;

export const EmailWorkerLive = Layer.unwrap(
  Effect.gen(function* () {
    yield* DatabaseMigration;
    return EmailWorkerLayer;
  }),
).pipe(Layer.provide(DatabaseMigration.layer), Layer.provide(ServicesLive));
