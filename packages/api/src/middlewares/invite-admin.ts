import { HttpApiError, HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi";

import { RateLimitExceeded } from "@namera-ai/protocol";

export class InviteAdmin extends HttpApiMiddleware.Service<InviteAdmin>()(
  "@namera-ai/api/InviteAdmin",
  {
    error: [
      HttpApiError.UnauthorizedNoContent,
      HttpApiError.InternalServerErrorNoContent,
      RateLimitExceeded,
    ],
    security: { bearer: HttpApiSecurity.bearer },
  },
) {}
