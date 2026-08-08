import { NodeCrypto } from "@effect/platform-node";
import { Config, Effect, Layer } from "effect";

import {
  AccountService,
  CryptoService,
  MagicLinkService,
  OrganizationService,
} from "@namera-ai/application";
import { Database, Repository, TransactionService } from "@namera-ai/database";
import { EmailService } from "@namera-ai/emails";

const PersistenceLive = Layer.mergeAll(Repository.layer, TransactionService.layer).pipe(
  Layer.provide(Database.layer),
);

const CryptoLive = CryptoService.layer.pipe(Layer.provide(NodeCrypto.layer));

const EmailLive = Layer.unwrap(
  Effect.map(Config.string("NODE_ENV").pipe(Config.withDefault("development")), (environment) =>
    environment === "development" ? EmailService.developmentLayer : EmailService.layer,
  ),
);

export const ServicesLive = Layer.mergeAll(PersistenceLive, CryptoLive, EmailLive);

export const ApplicationLive = Layer.mergeAll(
  AccountService.layer,
  MagicLinkService.layer,
  OrganizationService.layer,
);
