import { Layer } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";

import { AuthCookieConfig } from "#/helpers/auth-cookie";
import { ApplicationLive, ServicesLive } from "#/layers/services";
import { AuthorizationLive } from "#/middlewares/authorization";
import { ApiKeyRoutes } from "#/routes/auth/api-key";
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
import { BillingRoutes } from "#/routes/billing/index";
import { HealthRoutes } from "#/routes/core/health";
import { ExecutionRoutes, SignatureRoutes } from "#/routes/execution/index";
import { SessionKeyRoutes, WalletRoutes } from "#/routes/wallet/index";

const ApiHandlers = Layer.mergeAll(
  ApiKeyRoutes,
  BillingRoutes,
  HealthRoutes,
  ExecutionRoutes,
  SessionKeyRoutes,
  SignatureRoutes,
  InvitationRoutes,
  MagicLinkRoutes,
  MemberRoutes,
  NotificationRoutes,
  OAuthRoutes,
  OrganizationRoutes,
  SessionRoutes,
  UserRoutes,
  WalletRoutes,
).pipe(
  Layer.provide(AuthorizationLive),
  Layer.provide(ApplicationLive),
  Layer.provide(ServicesLive),
  Layer.provide(AuthCookieConfig.layer),
);

export const ApiRoutes = HttpApiBuilder.layer(NameraApi, {
  openapiPath: "/openapi.json",
}).pipe(Layer.provide(ApiHandlers));
