import { NodeCrypto, NodeHttpClient } from "@effect/platform-node";
import { Config, Effect, Layer } from "effect";

import { Application, GoogleIdentityProvider } from "@namera-ai/application";
import { CryptoService } from "@namera-ai/crypto";
import { Database, Repository, TransactionService } from "@namera-ai/database";
import { EmailJobs, EmailService } from "@namera-ai/emails";
import { Ens } from "@namera-ai/ens";
import { Evm } from "@namera-ai/evm";
import { Passkeys } from "@namera-ai/passkeys";
import { ProductAnalytics } from "@namera-ai/telemetry/analytics/server";
import { GcpService } from "@namera-ai/wallet-provider-gcp";
import { LocalService } from "@namera-ai/wallet-provider-local";
import { OneClawService, OneClawOidcService } from "@namera-ai/wallet-provider-oneclaw";

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
  ProductAnalytics.layer,
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
