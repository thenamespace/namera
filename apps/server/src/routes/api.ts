import { Layer } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";

import { ApplicationLive, ServicesLive } from "#/layers/services";
import { AuthorizationLive } from "#/middlewares/authorization";
import {
  InvitationRoutes,
  MagicLinkRoutes,
  MemberRoutes,
  OrganizationRoutes,
  SessionRoutes,
  UserRoutes,
} from "#/routes/auth/index";
import { HealthRoutes } from "#/routes/health";

const ApiHandlers = Layer.mergeAll(
  HealthRoutes,
  InvitationRoutes,
  MagicLinkRoutes,
  MemberRoutes,
  OrganizationRoutes,
  SessionRoutes,
  UserRoutes,
).pipe(
  Layer.provide(AuthorizationLive),
  Layer.provide(ApplicationLive),
  Layer.provide(ServicesLive),
);

export const ApiRoutes = HttpApiBuilder.layer(NameraApi, {
  openapiPath: "/openapi.json",
}).pipe(Layer.provide(ApiHandlers));
