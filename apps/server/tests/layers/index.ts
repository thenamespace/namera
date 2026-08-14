import { NodeCrypto } from "@effect/platform-node";
import { Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";

import { Application } from "@namera-ai/application";
import { CryptoService } from "@namera-ai/crypto";
import { Repository, TestDatabase, TransactionService } from "@namera-ai/database";
import { EmailJobs, EmailService } from "@namera-ai/emails";
import { Evm } from "@namera-ai/evm";
import { WalletKeys } from "@namera-ai/wallet-keys";

import { AuthCookieConfig } from "#/helpers/auth-cookie";
import { AuthorizationLive } from "#/middlewares/authorization";
import { RateLimiterLive } from "#/rate-limit";
import { ApiKeyRoutes } from "#/routes/api-key";
import {
  InvitationRoutes,
  MagicLinkRoutes,
  MemberRoutes,
  NotificationRoutes,
  OrganizationRoutes,
  SessionRoutes,
  UserRoutes,
} from "#/routes/auth/index";
import { BillingRoutes } from "#/routes/billing";
import { HealthRoutes } from "#/routes/health";
import { SessionKeyRoutes } from "#/routes/session-key";
import { WalletRoutes } from "#/routes/wallet";

import { TestAuthToken, TestAuthorizationClientLayer } from "./auth.js";
import { TestConfigLayer } from "./config.js";

export * from "./auth.js";
export { TestDatabase } from "@namera-ai/database";
export { TestEmails } from "@namera-ai/emails";

const TestAuthTokenStateLayer = TestAuthToken.layer;

const TestPersistenceLayer = Layer.mergeAll(Repository.layer, TransactionService.layer).pipe(
  Layer.provideMerge(TestDatabase.layer),
);

const TestCryptoLayer = CryptoService.layer.pipe(Layer.provide(NodeCrypto.layer));

const TestServicesLayer = Layer.mergeAll(EmailJobs.layer, Evm.testLayer, WalletKeys.testLayer).pipe(
  Layer.provideMerge(EmailService.testLayer),
  Layer.provideMerge(TestPersistenceLayer),
  Layer.provideMerge(TestCryptoLayer),
  Layer.provide(TestConfigLayer),
);

const TestApplicationLayer = Application.layer.pipe(
  Layer.provide(TestServicesLayer),
  Layer.provide(TestConfigLayer),
);

const TestAuthorizationLayer = AuthorizationLive.pipe(
  Layer.provide(TestServicesLayer),
  Layer.provide(AuthCookieConfig.testLayer),
);

const TestHandlersLayer = Layer.mergeAll(
  ApiKeyRoutes,
  BillingRoutes,
  HealthRoutes,
  SessionKeyRoutes,
  InvitationRoutes,
  MagicLinkRoutes,
  MemberRoutes,
  NotificationRoutes,
  OrganizationRoutes,
  SessionRoutes,
  UserRoutes,
  WalletRoutes,
).pipe(
  Layer.provide(TestAuthorizationLayer),
  Layer.provide(TestApplicationLayer),
  Layer.provide(TestServicesLayer),
  Layer.provide(AuthCookieConfig.testLayer),
  HttpRouter.provideRequest(RateLimiterLive),
);

export const TestServerLayer = Layer.mergeAll(
  TestHandlersLayer,
  TestAuthorizationLayer,
  RateLimiterLive,
  TestServicesLayer,
  TestAuthTokenStateLayer,
  TestAuthorizationClientLayer.pipe(Layer.provide(TestAuthTokenStateLayer)),
  HttpServer.layerServices,
);
