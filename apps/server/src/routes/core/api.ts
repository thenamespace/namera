import { Layer } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";

import { AuthCookieConfig } from "#/helpers/auth-cookie";
import { ApplicationLive, ServicesLive } from "#/layers/services";
import { AdminAuthorizationLive } from "#/middlewares/admin";
import { AuthorizationLive } from "#/middlewares/authorization";
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

const ApiHandlers = Layer.mergeAll(
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
  Layer.provide(AuthorizationLive),
  Layer.provide(AdminAuthorizationLive),
  Layer.provide(ApplicationLive),
  Layer.provide(ServicesLive),
  Layer.provide(AuthCookieConfig.layer),
);

export const ApiRoutes = HttpApiBuilder.layer(NameraApi, {
  openapiPath: "/openapi.json",
}).pipe(Layer.provide(ApiHandlers));
