import { Cause, Effect, Exit, Layer, Option, Predicate } from "effect";
import { FetchHttpClient, HttpClientRequest } from "effect/unstable/http";
import { HttpApiClient, HttpApiMiddleware } from "effect/unstable/httpapi";

import { AdminAuthorization, NameraApi } from "@namera-ai/api";

import { env } from "@/env";
import { clearToken, readToken } from "@/lib/session";

/**
 * The typed client is generated from the same `NameraApi` contract the server
 * implements, so request paths, encoders and decoders cannot drift from it.
 * `OpenApi.Exclude` hides the operator routes from the published spec but not
 * from this contract, which is why the portal still gets full types for them.
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
  readonly kind: "unauthorized" | "rate-limited" | "network" | "unexpected";
  readonly message: string;
  readonly retryAfterSeconds?: number;
};

const failureFrom = (error: unknown): ApiFailure => {
  if (!Predicate.isObject(error)) {
    return { kind: "unexpected", message: "The request failed. Try again." };
  }
  const tag = Reflect.get(error, "_tag");

  if (tag === "Unauthorized" || tag === "UnauthorizedNoContent") {
    // The token is wrong, revoked, or the server was restarted with a new one.
    // Drop it so the app returns to the sign-in screen instead of looping.
    clearToken();
    return { kind: "unauthorized", message: "That admin token was rejected. Sign in again." };
  }

  if (tag === "RateLimitExceeded") {
    const retryAfterSeconds = Reflect.get(error, "retryAfterSeconds");
    return {
      kind: "rate-limited",
      message: "The operator rate limit is exhausted. Wait before retrying.",
      ...(typeof retryAfterSeconds === "number" ? { retryAfterSeconds } : {}),
    };
  }

  if (tag === "RequestError" || tag === "ResponseError") {
    return {
      kind: "network",
      message: "Could not reach the API. Check your connection and the API URL.",
    };
  }

  return { kind: "unexpected", message: "The request failed. Try again." };
};

/**
 * Bridges an Effect into the promise TanStack Query expects, turning declared
 * API errors into a small shape the screens can render. Rejecting with an
 * `ApiFailure` keeps Query's error channel typed for the UI.
 */
export const run = async <A, E>(effect: Effect.Effect<A, E>): Promise<A> => {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) return exit.value;

  const error = Cause.findErrorOption(exit.cause);
  throw failureFrom(Option.getOrElse(error, () => Cause.squash(exit.cause)));
};

export const asApiFailure = (error: unknown): ApiFailure =>
  Predicate.isObject(error) && typeof Reflect.get(error, "kind") === "string"
    ? (error as ApiFailure)
    : { kind: "unexpected", message: "The request failed. Try again." };
