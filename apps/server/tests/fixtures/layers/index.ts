import { NodeCrypto } from "@effect/platform-node";
import { Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";

import { Application } from "@namera-ai/application";
import { CryptoService } from "@namera-ai/crypto";
import { type Database, Repository, TestDatabase, TransactionService } from "@namera-ai/database";
import { EmailJobs, EmailService } from "@namera-ai/emails";
import { EnsTestLayer } from "@namera-ai/ens";
import { Evm, type EvmTestOptions } from "@namera-ai/evm";
import { Passkeys } from "@namera-ai/passkeys";
import { WalletKeys } from "@namera-ai/wallet-keys";

import { AuthCookieConfig } from "#/helpers/auth-cookie";
import { AdminAuthorizationLive } from "#/middlewares/admin";
import { AuthorizationLive } from "#/middlewares/authorization";
import { RateLimiterLive } from "#/rate-limit";
import { AdminUserRoutes } from "#/routes/auth/admin";
import { ApiKeyRoutes } from "#/routes/auth/api-key";
import { BetaInviteRoutes } from "#/routes/auth/beta-invite";
import {
  InvitationRoutes,
  MagicLinkRoutes,
  MemberRoutes,
  NotificationRoutes,
  OAuthRoutes,
  OrganizationRoutes,
  SessionRoutes,
  UserRoutes,
} from "#/routes/auth/index";
import { WaitlistRoutes } from "#/routes/auth/waitlist";
import { BillingRoutes } from "#/routes/billing/index";
import { HealthRoutes } from "#/routes/core/health";
import { DashboardRoutes } from "#/routes/dashboard/index";
import { AddressMetadataRoutes, PortfolioRoutes } from "#/routes/data/index";
import { EnsRoutes } from "#/routes/ens";
import { ExecutionRoutes, SignatureRoutes } from "#/routes/execution/index";
import { SessionKeyRoutes, WalletRoutes } from "#/routes/wallet/index";

import { TestAuthToken, TestAuthorizationClientLayer } from "./auth.js";
import { TestConfigLayer } from "./config.js";

export * from "./auth.js";
export { TestDatabase } from "@namera-ai/database";
export { TestEmails } from "@namera-ai/emails";
export { TestEns } from "@namera-ai/ens";

const TestAuthTokenStateLayer = TestAuthToken.layer;

const TestDatabaseLayer: Layer.Layer<
  Database | TestDatabase,
  | Layer.Error<typeof TestDatabase.layer>
  | Layer.Error<ReturnType<typeof TestDatabase.postgresLayer>>
> =
  process.env.NAMERA_TEST_POSTGRES_PORT === undefined
    ? TestDatabase.layer
    : TestDatabase.postgresLayer(Number(process.env.NAMERA_TEST_POSTGRES_PORT));

const TestPersistenceLayer = Layer.mergeAll(Repository.layer, TransactionService.layer).pipe(
  Layer.provideMerge(TestDatabaseLayer),
);

const TestCryptoLayer = CryptoService.layer.pipe(Layer.provide(NodeCrypto.layer));

export const makeTestServerLayer = (
  evmOptions: EvmTestOptions = {},
  passkeysLayer: Layer.Layer<Passkeys> = Passkeys.testLayer,
  configLayer = TestConfigLayer,
) => {
  const TestServicesLayer = Layer.mergeAll(
    EmailJobs.layer,
    EnsTestLayer,
    Evm.testLayerWith(evmOptions),
    WalletKeys.testLayer,
    passkeysLayer,
  ).pipe(
    Layer.provideMerge(EmailService.testLayer),
    Layer.provideMerge(TestPersistenceLayer),
    Layer.provideMerge(TestCryptoLayer),
  );

  const TestApplicationLayer = Application.layer.pipe(Layer.provide(TestServicesLayer));
  const TestAdminAuthorizationLayer = AdminAuthorizationLive.pipe(Layer.provide(RateLimiterLive));

  const TestAuthorizationLayer = AuthorizationLive.pipe(
    Layer.provide(TestServicesLayer),
    Layer.provide(AuthCookieConfig.testLayer),
  );

  const TestHandlersLayer = Layer.mergeAll(
    AdminUserRoutes,
    BetaInviteRoutes,
    WaitlistRoutes,
    AddressMetadataRoutes,
    ApiKeyRoutes,
    BillingRoutes,
    DashboardRoutes,
    HealthRoutes,
    ExecutionRoutes,
    EnsRoutes,
    SessionKeyRoutes,
    SignatureRoutes,
    InvitationRoutes,
    MagicLinkRoutes,
    MemberRoutes,
    NotificationRoutes,
    PortfolioRoutes,
    OAuthRoutes,
    OrganizationRoutes,
    SessionRoutes,
    UserRoutes,
    WalletRoutes,
  ).pipe(
    Layer.provide(TestAuthorizationLayer),
    Layer.provide(TestAdminAuthorizationLayer),
    Layer.provide(TestApplicationLayer),
    Layer.provide(TestServicesLayer),
    Layer.provide(AuthCookieConfig.testLayer),
    HttpRouter.provideRequest(RateLimiterLive),
  );

  return Layer.mergeAll(
    TestHandlersLayer,
    TestApplicationLayer,
    TestAuthorizationLayer,
    TestAdminAuthorizationLayer,
    RateLimiterLive,
    TestServicesLayer,
    TestAuthTokenStateLayer,
    TestAuthorizationClientLayer.pipe(Layer.provide(TestAuthTokenStateLayer)),
    HttpServer.layerServices,
  ).pipe(Layer.provide(configLayer));
};

export const TestServerLayer = makeTestServerLayer();
