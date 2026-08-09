import { HttpApiError } from "effect/unstable/httpapi";

import { RateLimitExceeded } from "@namera-ai/protocol";

export const CommonErrors = [
  HttpApiError.ForbiddenNoContent,
  HttpApiError.InternalServerErrorNoContent,
  RateLimitExceeded,
] as const;
