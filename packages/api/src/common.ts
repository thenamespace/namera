import { HttpApiError } from "effect/http-api";

import { RateLimitExceeded } from "@namera-ai/protocol";

export const CommonErrors = [
  HttpApiError.ForbiddenNoContent,
  HttpApiError.InternalServerErrorNoContent,
  RateLimitExceeded,
] as const;
