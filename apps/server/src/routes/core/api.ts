import { Layer } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";

import { AuthCookieConfig } from "#/helpers/auth-cookie";
import { ApplicationLive, ServicesLive } from "#/layers/services";
import { AdminAuthorizationLive, PlatformSessionAuthorizationLive } from "#/middlewares/admin";
import { AuthorizationLive } from "#/middlewares/authorization";
import { AdminWaitlistRoutes } from "#/routes/auth/admin-waitlist";
import { ApiKeyRoutes } from "#/routes/auth/api-key";
import { BetaInviteRoutes } from "#/routes/auth/beta-invite";
import { GoogleRoutes, ConnectedAccountRoutes } from "#/routes/auth/core/google";
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
import { PlatformRoutes } from "#/routes/auth/platform";
import { WaitlistRoutes } from "#/routes/auth/waitlist";
import { BillingRoutes } from "#/routes/billing/index";
import { HealthRoutes } from "#/routes/core/health";
import { DashboardRoutes } from "#/routes/dashboard/index";
import { AddressMetadataRoutes, PortfolioRoutes } from "#/routes/data/index";
import { EnsRoutes } from "#/routes/ens";
import { ExecutionRoutes, SignatureRoutes } from "#/routes/execution/index";
import { SessionKeyRoutes, WalletRoutes } from "#/routes/wallet/index";

const ApiHandlers = Layer.mergeAll(
  PlatformRoutes,
  BetaInviteRoutes,
  AdminWaitlistRoutes,
  GoogleRoutes,
  ConnectedAccountRoutes,
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
  Layer.provide(AuthorizationLive),
  Layer.provide(AdminAuthorizationLive),
  Layer.provide(PlatformSessionAuthorizationLive),
  Layer.provide(ApplicationLive),
  Layer.provide(ServicesLive),
  Layer.provide(AuthCookieConfig.layer),
);

export const ApiRoutes = HttpApiBuilder.layer(NameraApi, {
  openapiPath: "/openapi.json",
}).pipe(Layer.provide(ApiHandlers));
