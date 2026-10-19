import { DateTime, Effect, Redacted, Schema } from "effect";

import { createClient, type OneclawResponse } from "@1claw/sdk";
import { OneClawError, type OneClawOperation } from "@namera-ai/protocol";
import { OneClawCustomerAuthority } from "@namera-ai/protocol/model";

import { OneClawConfig } from "#/config";
import { decodeResponse, fromOneClawException, fromOneClawResponse } from "#/errors";
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

  const request = Effect.fnUntraced(function* <
    S extends Schema.Top & { readonly DecodingServices: never },
  >(
    operation: OneClawOperation,
    schema: S,
    call: () => Promise<OneclawResponse<unknown>>,
  ): Effect.fn.Return<S["Type"], OneClawError> {
    const response = yield* Effect.tryPromise({
      try: call,
      catch: (cause) => fromOneClawException(operation, cause),
    }).pipe(
      Effect.timeoutOrElse({
        duration: config.requestTimeout,
        orElse: () => Effect.fail(new OneClawError({ operation, code: "TIMEOUT" })),
      }),
    );
    const status = response.meta?.status;
    const guardrail = Schema.Struct({
      status: Schema.Literal("awaiting_approval"),
      approval_id: Schema.NonEmptyString,
    });
    const consensus = Schema.Struct({
      status: Schema.Literal("pending_approval"),
      pending_approval_id: Schema.NonEmptyString,
    });
    if (status === 202 && Schema.is(guardrail)(response.data)) {
      return yield* new OneClawError({
        operation,
        code: "APPROVAL_REQUIRED",
        httpStatus: status,
        approval: { kind: "guardrail", id: response.data.approval_id },
      });
    }
    if (status === 202 && Schema.is(consensus)(response.data)) {
      return yield* new OneClawError({
        operation,
        code: "APPROVAL_REQUIRED",
        httpStatus: status,
        approval: { kind: "consensus", id: response.data.pending_approval_id },
      });
    }
    if (status === undefined)
      return yield* new OneClawError({ operation, code: "INVALID_RESPONSE" });
    if (
      Schema.is(
        Schema.Struct({ status: Schema.Literals(["pending_approval", "approval_required"]) }),
      )(response.data)
    ) {
      return yield* new OneClawError({ operation, code: "APPROVAL_REQUIRED" });
    }
    // upsertUser deliberately returns 409 in data with error=null.
    if (response.error !== null || status < 200 || status >= 300 || status === 202) {
      const link =
        operation === "connections.upsert" &&
        Schema.is(Schema.Struct({ link_required: Schema.Unknown }))(response.data);
      const error = fromOneClawResponse(
        operation,
        status,
        link ? "link_required" : response.error?.type,
      );
      return yield* error;
    }
    return yield* decodeResponse(operation, schema, response.data);
  });

  const customer = Effect.fnUntraced(function* (
    operation: OneClawOperation,
    authority: OneClawCustomerAuthority,
  ) {
    yield* Schema.decodeUnknownEffect(Schema.toType(OneClawCustomerAuthority))(authority).pipe(
      Effect.mapError(() => new OneClawError({ operation, code: "IDENTITY_MISMATCH" })),
    );
    if (authority.connection.providerAppId !== config.platformAppId) {
      return yield* new OneClawError({ operation, code: "IDENTITY_MISMATCH" });
    }
    const now = yield* DateTime.now;
    if (DateTime.toEpochMillis(authority.payload.expiresAt) <= DateTime.toEpochMillis(now)) {
      return yield* new OneClawError({ operation, code: "AUTHORITY_EXPIRED" });
    }
    const authenticated = client(authority.payload.token);
    const identity = yield* request(operation, IdentityResponse, () =>
      authenticated.http.request("GET", "/v1/auth/me"),
    );
    if (identity.id !== authority.payload.customerId) {
      return yield* new OneClawError({ operation, code: "IDENTITY_MISMATCH" });
    }
    return authenticated;
  });
  return { config, client, platform, anonymous, request, customer };
});

export type ClientContext = Effect.Success<typeof makeClientContext>;
