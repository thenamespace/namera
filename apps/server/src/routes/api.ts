import { Layer } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";

import { AuthCookieConfig } from "#/helpers/auth-cookie";
import { ApplicationLive, ServicesLive } from "#/layers/services";
import { AuthorizationLive } from "#/middlewares/authorization";
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
import { ExecutionRoutes } from "#/routes/execution";
import { HealthRoutes } from "#/routes/health";
import { SessionKeyRoutes } from "#/routes/session-key";
import { WalletRoutes } from "#/routes/wallet";

const ApiHandlers = Layer.mergeAll(
  ApiKeyRoutes,
  BillingRoutes,
  HealthRoutes,
  ExecutionRoutes,
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
  Layer.provide(AuthorizationLive),
  Layer.provide(ApplicationLive),
  Layer.provide(ServicesLive),
  Layer.provide(AuthCookieConfig.layer),
);

export const ApiRoutes = HttpApiBuilder.layer(NameraApi, {
  openapiPath: "/openapi.json",
}).pipe(Layer.provide(ApiHandlers));
