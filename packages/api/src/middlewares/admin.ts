import { Context } from "effect";
import { HttpApiError, HttpApiMiddleware } from "effect/http-api";

import { RateLimitExceeded } from "@namera-ai/protocol";
import type { SessionId, UserId } from "@namera-ai/protocol";
import type { PlatformMember } from "@namera-ai/protocol/model";

import { AuthTokenSecurity } from "./auth.js";

export class CurrentPlatformSession extends Context.Service<
  CurrentPlatformSession,
  {
    readonly userId: UserId;
    readonly sessionId: SessionId;
  }
>()("@namera-ai/api/CurrentPlatformSession") {}

export class PlatformSessionAuthorization extends HttpApiMiddleware.Service<
  PlatformSessionAuthorization,
  { provides: CurrentPlatformSession }
>()("@namera-ai/api/PlatformSessionAuthorization", {
  error: [
    HttpApiError.UnauthorizedNoContent,
    HttpApiError.ForbiddenNoContent,
    HttpApiError.InternalServerErrorNoContent,
    RateLimitExceeded,
  ],
  security: { authToken: AuthTokenSecurity },
}) {}

export class CurrentAdmin extends Context.Service<
  CurrentAdmin,
  { readonly userId: UserId; readonly sessionId: SessionId; readonly member: PlatformMember }
>()("@namera-ai/api/CurrentAdmin") {}

export class AdminAuthorization extends HttpApiMiddleware.Service<
  AdminAuthorization,
  { provides: CurrentAdmin }
>()("@namera-ai/api/AdminAuthorization", {
  error: [
    HttpApiError.UnauthorizedNoContent,
    HttpApiError.ForbiddenNoContent,
    HttpApiError.InternalServerErrorNoContent,
    RateLimitExceeded,
  ],
  security: { authToken: AuthTokenSecurity },
}) {}
