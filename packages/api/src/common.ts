import { HttpApiError } from "effect/http-api";

import { RateLimitExceeded, ManagementPermissionDeniedError } from "@namera-ai/protocol";

export const CommonErrors = [
  HttpApiError.ForbiddenNoContent,
  HttpApiError.InternalServerErrorNoContent,
  RateLimitExceeded,
  ManagementPermissionDeniedError,
] as const;
