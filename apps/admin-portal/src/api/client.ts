import { Cause, Effect, Exit, Layer, Option, Predicate } from "effect";
import { FetchHttpClient, HttpClientRequest } from "effect/unstable/http";
import { HttpApiClient, HttpApiMiddleware } from "effect/unstable/httpapi";

import { AdminAuthorization, NameraApi } from "@namera-ai/api";

import { env } from "@/env";
import { clearToken, readToken } from "@/lib/session";

/**
 * `OpenApi.Exclude` hides the operator routes from the published spec but not
 * from the contract, so the client is still fully typed for them.
 */
const authorizationLayer = HttpApiMiddleware.layerClient(AdminAuthorization, ({ next, request }) =>
  next(HttpClientRequest.setHeader(request, "authorization", `Bearer ${readToken() ?? ""}`)),
);

export const client = Effect.runSync(
  HttpApiClient.make(NameraApi, { baseUrl: env.backendUrl }).pipe(
    Effect.provide(Layer.merge(FetchHttpClient.layer, authorizationLayer)),
  ),
);

export type ApiFailure = {
  readonly kind: "unauthorized" | "rate-limited" | "network" | "contract" | "unexpected";
  readonly message: string;
  /** The underlying error tag, surfaced so a failure can be diagnosed from the UI. */
  readonly detail?: string;
  readonly retryAfterSeconds?: number;
};

const failureFrom = (error: unknown): ApiFailure => {
  if (!Predicate.isObject(error)) {
    return { kind: "unexpected", message: "The request failed.", detail: typeof error };
  }
  const tag = Reflect.get(error, "_tag");
  const detail = typeof tag === "string" ? tag : "unknown";

  if (tag === "Unauthorized") {
    // The token is wrong, revoked, or the server restarted with a new one.
    // Drop it so the app returns to sign-in instead of looping on a 401.
    clearToken();
    return { kind: "unauthorized", message: "That admin token was rejected.", detail };
  }

  if (tag === "RateLimitExceeded") {
    const retryAfterSeconds = Reflect.get(error, "retryAfterSeconds");
    return {
      kind: "rate-limited",
      message: "The operator rate limit is exhausted.",
      detail,
      ...(typeof retryAfterSeconds === "number" ? { retryAfterSeconds } : {}),
    };
  }

  // The fetch never completed: the server is down, the URL is wrong, or the
  // browser blocked the response. A blocked cross-origin request is
  // indistinguishable from an unreachable one here, by design of the fetch API.
  if (tag === "TransportError" || tag === "InvalidUrlError") {
    return {
      kind: "network",
      message:
        "Could not reach the API. Check that it is running, that VITE_API_URL is right, " +
        "and that this page's origin matches ADMIN_CORS_ORIGIN (localhost and 127.0.0.1 " +
        "are different origins).",
      detail,
    };
  }

  if (tag === "StatusCodeError" || tag === "HttpClientError") {
    const status = Reflect.get(error, "status");
    return {
      kind: "unexpected",
      message: `The API returned an unexpected status${typeof status === "number" ? ` (${status})` : ""}.`,
      detail,
    };
  }

  // The call succeeded but the payload did not match the contract, which means
  // the portal and the server are built from different versions of it.
  if (tag === "DecodeError" || tag === "EncodeError" || tag === "HttpApiSchemaError") {
    return {
      kind: "contract",
      message: "The API responded in an unexpected shape. The portal and API versions may differ.",
      detail,
    };
  }

  return { kind: "unexpected", message: "The request failed.", detail };
};

export const run = async <A, E>(effect: Effect.Effect<A, E>): Promise<A> => {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) return exit.value;

  const error = Cause.findErrorOption(exit.cause);
  throw failureFrom(Option.getOrElse(error, () => Cause.squash(exit.cause)));
};

export const asApiFailure = (error: unknown): ApiFailure =>
  Predicate.isObject(error) && typeof Reflect.get(error, "kind") === "string"
    ? (error as ApiFailure)
    : { kind: "unexpected", message: "The request failed." };
