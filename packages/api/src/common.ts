import { HttpApiError } from "effect/unstable/httpapi";

export const CommonErrors = [
  HttpApiError.ForbiddenNoContent,
  HttpApiError.InternalServerErrorNoContent,
] as const;
