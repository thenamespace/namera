import { Context } from "effect";
import { HttpApiError, HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi";

import { RateLimitExceeded } from "@namera-ai/protocol";

export class CurrentAdmin extends Context.Service<
  CurrentAdmin,
  { readonly type: "admin"; readonly credential: "shared-token" }
>()("@namera-ai/api/CurrentAdmin") {}

export class AdminAuthorization extends HttpApiMiddleware.Service<
  AdminAuthorization,
  { provides: CurrentAdmin }
>()("@namera-ai/api/AdminAuthorization", {
  error: [
    HttpApiError.UnauthorizedNoContent,
    HttpApiError.InternalServerErrorNoContent,
    RateLimitExceeded,
  ],
  security: { bearer: HttpApiSecurity.bearer },
}) {}
