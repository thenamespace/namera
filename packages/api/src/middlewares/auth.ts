import type { CurrentActorResponse } from "@namera-ai/schema/dto";

import { Context } from "effect";

import { HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi";

import { InternalError, Unauthorized } from "@namera-ai/schema";

export class A extends Context.Service<A, {}>()("A") {}

export class CurrentActor extends Context.Service<
  CurrentActor,
  CurrentActorResponse
>()("CurrentActor") {}

export class Authorization extends HttpApiMiddleware.Service<
  Authorization,
  {
    provides: CurrentActor;
  }
>()("Authorization", {
  error: [Unauthorized, InternalError],
  security: {
    authToken: HttpApiSecurity.apiKey({
      in: "cookie",
      key: "auth-token",
    }),
  },
}) {}
