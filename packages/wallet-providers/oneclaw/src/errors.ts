import { Effect, Schema } from "effect";

import { OneclawError as SdkError } from "@1claw/sdk";
import { OneClawError, type OneClawOperation } from "@namera-ai/protocol";

export const oneClawError = (operation: OneClawOperation, code: OneClawError["code"]) =>
  new OneClawError({ operation, code });

const statusCodes: Readonly<Partial<Record<number, OneClawError["code"]>>> = {
  401: "UNAUTHENTICATED",
  402: "PAYMENT_REQUIRED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "RATE_LIMITED",
};

export const fromOneClawResponse = (
  operation: OneClawOperation,
  status: number,
  type?: string,
): OneClawError => {
  let code =
    statusCodes[status] ??
    (status >= 500 ? "UNAVAILABLE" : status >= 400 ? "INVALID_REQUEST" : "INVALID_RESPONSE");
  if (type === "approval_required" || type === "pending_approval" || status === 202) {
    code = "APPROVAL_REQUIRED";
  } else if (type === "link_required") {
    code = "LINK_REQUIRED";
  }
  return new OneClawError({
    operation,
    code,
    ...(Number.isInteger(status) && status >= 100 && status <= 599 ? { httpStatus: status } : {}),
  });
};

export const fromOneClawException = (operation: OneClawOperation, cause: unknown): OneClawError =>
  cause instanceof SdkError
    ? fromOneClawResponse(operation, cause.status, cause.type)
    : oneClawError(operation, cause instanceof SyntaxError ? "INVALID_RESPONSE" : "UNAVAILABLE");

export const decodeResponse = <S extends Schema.Top & { readonly DecodingServices: never }>(
  operation: OneClawOperation,
  schema: S,
  value: unknown,
): Effect.Effect<S["Type"], OneClawError> =>
  Schema.decodeUnknownEffect(schema)(value).pipe(
    Effect.mapError(() => oneClawError(operation, "INVALID_RESPONSE")),
  );
