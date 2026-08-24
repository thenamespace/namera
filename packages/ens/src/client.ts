import { Effect } from "effect";

import {
  AuthenticationError,
  RateLimitError,
  SubnameAlreadyExistsError,
  SubnameNotFoundError,
  ValidationError,
} from "@thenamespace/offchain-manager";

import { EnsError, type EnsErrorReason, type EnsOperation } from "./error.js";

const reasonFromCause = (cause: unknown): EnsErrorReason => {
  if (cause instanceof AuthenticationError) return "AUTHENTICATION_FAILED";
  if (cause instanceof ValidationError) return "VALIDATION_FAILED";
  if (cause instanceof SubnameNotFoundError) return "NOT_FOUND";
  if (cause instanceof SubnameAlreadyExistsError) return "ALREADY_EXISTS";
  if (cause instanceof RateLimitError) return "RATE_LIMITED";

  return "REQUEST_FAILED";
};

export const toEnsError = (operation: EnsOperation, cause: unknown) =>
  new EnsError({
    operation,
    reason: reasonFromCause(cause),
    cause,
  });

export const runEnsRequest = <A>(operation: EnsOperation, request: () => Promise<A>) =>
  Effect.tryPromise({
    try: request,
    catch: (cause) => toEnsError(operation, cause),
  });
