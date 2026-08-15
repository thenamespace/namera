import { Context } from "effect";
import { HttpApiError, HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi";

import type { CurrentActorResponse } from "@namera-ai/protocol/dto";

export class CurrentActor extends Context.Service<CurrentActor, CurrentActorResponse>()(
  "@namera-ai/api/CurrentActor",
) {}

export const AuthTokenSecurity = HttpApiSecurity.apiKey({
  in: "cookie",
  key: "auth-token",
});

export const ApiKeySecurity = HttpApiSecurity.apiKey({
  in: "header",
  key: "x-api-key",
});

export class Authorization extends HttpApiMiddleware.Service<
  Authorization,
  {
    provides: CurrentActor;
  }
>()("@namera-ai/api/Authorization", {
  error: HttpApiError.UnauthorizedNoContent,
  security: {
    authToken: AuthTokenSecurity,
    apiKey: ApiKeySecurity,
  },
}) {}
