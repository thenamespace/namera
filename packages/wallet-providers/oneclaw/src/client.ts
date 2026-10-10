import { DateTime, Effect, Redacted, Schema } from "effect";

import { createClient, type OneclawResponse } from "@1claw/sdk";
import type { OneClawError, OneClawOperation } from "@namera-ai/protocol";
import { OneClawCustomerAuthority } from "@namera-ai/protocol/model";

import { OneClawConfig } from "#/config";
import { decodeResponse, fromOneClawException, fromOneClawResponse, oneClawError } from "#/errors";
import { IdentityResponse } from "#/responses";

export const makeClientContext = Effect.gen(function* () {
  const config = yield* OneClawConfig;
  const client = (token?: Redacted.Redacted<string>) =>
    createClient({
      baseUrl: config.baseUrl,
      ...(token ? { token: Redacted.value(token) } : {}),
    });
  const platform = client(config.platformApiKey);
  const anonymous = client();

  const request = <S extends Schema.Top & { readonly DecodingServices: never }>(
    operation: OneClawOperation,
    schema: S,
    call: () => Promise<OneclawResponse<unknown>>,
  ): Effect.Effect<S["Type"], OneClawError> =>
    Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: call,
        catch: (cause) => fromOneClawException(operation, cause),
      }).pipe(
        Effect.timeoutOrElse({
          duration: config.requestTimeout,
          orElse: () => Effect.fail(oneClawError(operation, "TIMEOUT")),
        }),
      );
      const status = response.meta?.status;
      if (status === undefined) return yield* oneClawError(operation, "INVALID_RESPONSE");
      if (
        Schema.is(
          Schema.Struct({ status: Schema.Literals(["pending_approval", "approval_required"]) }),
        )(response.data)
      ) {
        return yield* oneClawError(operation, "APPROVAL_REQUIRED");
      }
      // upsertUser deliberately returns 409 in data with error=null.
      if (response.error !== null || status < 200 || status >= 300 || status === 202) {
        const link =
          operation === "connections.upsert" &&
          Schema.is(Schema.Struct({ link_required: Schema.Unknown }))(response.data);
        return yield* fromOneClawResponse(
          operation,
          status,
          link ? "link_required" : response.error?.type,
        );
      }
      return yield* decodeResponse(operation, schema, response.data);
    });

  const customer = Effect.fnUntraced(function* (
    operation: OneClawOperation,
    authority: OneClawCustomerAuthority,
  ) {
    yield* Schema.decodeUnknownEffect(Schema.toType(OneClawCustomerAuthority))(authority).pipe(
      Effect.mapError(() => oneClawError(operation, "IDENTITY_MISMATCH")),
    );
    if (authority.connection.providerAppId !== config.platformAppId) {
      return yield* oneClawError(operation, "IDENTITY_MISMATCH");
    }
    const now = yield* DateTime.now;
    if (DateTime.toEpochMillis(authority.payload.expiresAt) <= DateTime.toEpochMillis(now)) {
      return yield* oneClawError(operation, "AUTHORITY_EXPIRED");
    }
    const authenticated = client(authority.payload.token);
    const identity = yield* request(operation, IdentityResponse, () =>
      authenticated.http.request("GET", "/v1/auth/me"),
    );
    if (identity.id !== authority.payload.customerId) {
      return yield* oneClawError(operation, "IDENTITY_MISMATCH");
    }
    return authenticated;
  });
  return { config, client, platform, anonymous, request, customer };
});

export type ClientContext = Effect.Success<typeof makeClientContext>;
