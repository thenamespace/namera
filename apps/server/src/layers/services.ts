import { NodeCrypto, NodeHttpClient } from "@effect/platform-node";
import { Config, Effect, Layer } from "effect";

import { Application, GoogleIdentityProvider } from "@namera-ai/application";
import { CryptoService } from "@namera-ai/crypto";
import { Database, DatabaseMigration, Repository, TransactionService } from "@namera-ai/database";
import { EmailJobs, EmailService, EmailWorkerLayer } from "@namera-ai/emails";
import { Ens } from "@namera-ai/ens";
import { Evm } from "@namera-ai/evm";
import { Passkeys } from "@namera-ai/passkeys";
import { GcpService } from "@namera-ai/wallet-provider-gcp";
import { LocalService } from "@namera-ai/wallet-provider-local";
import { OneClawService, OneClawOidcService } from "@namera-ai/wallet-provider-oneclaw";

import { BillingWorkerLayer } from "#/workers/billing";
import { ExecutionWorkerLayer } from "#/workers/execution";
import { SessionKeyWorkerLayer } from "#/workers/session-key";

const PersistenceLive = Layer.mergeAll(Repository.layer, TransactionService.layer).pipe(
  Layer.provide(Database.layer),
);

const CryptoLive = CryptoService.layer.pipe(Layer.provide(NodeCrypto.layer));

const EmailProviderLive = Layer.unwrap(
  Effect.map(Config.String("NODE_ENV").pipe(Config.withDefault("development")), (environment) =>
    environment === "development" ? EmailService.devLayer : EmailService.layer,
  ),
);

// Environment selection happens only at the server boundary. Domain packages
// expose live/dev/test layers, but application code sees one stable service and
// cannot branch on NODE_ENV itself.
const EmailJobsLive = EmailJobs.layer.pipe(
  Layer.provide(PersistenceLive),
  Layer.provide(CryptoLive),
  Layer.provide(EmailProviderLive),
);

const EvmLive = Layer.unwrap(
  Effect.map(Config.String("NODE_ENV").pipe(Config.withDefault("development")), (environment) =>
    environment === "development" ? Evm.devLayer : Evm.layer,
  ),
).pipe(Layer.provide(NodeHttpClient.layerUndici));

export const OneClawLive = Layer.unwrap(
  Effect.gen(function* () {
    yield* Config.String("ONECLAW_ORG_EMAIL_DOMAIN");
    return Layer.merge(OneClawService.layer, OneClawOidcService.layer);
  }),
);

export const ServicesLive = Layer.mergeAll(
  GoogleIdentityProvider.layer.pipe(Layer.provide(NodeHttpClient.layerUndici)),
  PersistenceLive,
  CryptoLive,
  EmailJobsLive,
  GcpService.disabledLayer,
  LocalService.disabledLayer,
  OneClawLive,
  EvmLive,
  Ens.layer,
  Passkeys.layer,
);

export const ApplicationLive = Application.layer;

// Workers wait for migrations independently because they are long-lived layers
// and may begin polling before the HTTP listener is constructed.
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

export const BillingWorkerLive = Layer.unwrap(
  Effect.gen(function* () {
    yield* DatabaseMigration;
    return BillingWorkerLayer;
  }),
).pipe(
  Layer.provide(DatabaseMigration.layer),
  Layer.provide(ApplicationLive),
  Layer.provide(ServicesLive),
);

export const SessionKeyWorkerLive = Layer.unwrap(
  Effect.gen(function* () {
    yield* DatabaseMigration;
    return SessionKeyWorkerLayer;
  }),
).pipe(
  Layer.provide(DatabaseMigration.layer),
  Layer.provide(ApplicationLive),
  Layer.provide(ServicesLive),
);
