import { Cause, Effect, Layer, Option, Predicate, Schedule, Schema } from "effect";
import type { Context } from "effect";
import { FetchHttpClient, HttpClientError, HttpClientRequest } from "effect/http";
import { HttpApiClient, HttpApiMiddleware } from "effect/http-api";

import { Authorization, NameraApi } from "@namera-ai/api";

import {
  failure,
  success,
  type NameraApiErrorCode,
  type NameraApiErrorTag,
  type NameraResult,
  type NameraSdkError,
} from "#/result";
import type { ResolveSessionSigner } from "#/signing/local-session";

import { NAMERA_API_ORIGIN } from "./defaults.js";

type NameraClientBaseConfig = {
  readonly baseUrl?: string;
  readonly fetch?: NameraFetch;
  readonly resolveSessionSigner?: ResolveSessionSigner;
};

export type NameraClientConfig = NameraClientBaseConfig &
  (
    | {
        readonly apiKey: string;
        readonly accessToken?: never;
        readonly getAccessToken?: never;
      }
    | {
        readonly apiKey?: never;
        readonly accessToken: string;
        readonly getAccessToken?: never;
      }
    | {
        readonly apiKey?: never;
        readonly accessToken?: never;
        readonly getAccessToken: () => Promise<string>;
      }
  );

export type NameraFetch = Context.Service.Shape<typeof FetchHttpClient.Fetch>;
export type NameraApiClient = HttpApiClient.ForApi<typeof NameraApi>;
export type NameraEndpointError<E> = Exclude<
  E,
  Schema.SchemaError | HttpClientError.HttpClientError
>;

const readField = (value: unknown, key: string): string | undefined => {
  if (!Predicate.isObject(value)) return undefined;

  const field = Reflect.get(value, key);
  return typeof field === "string" && field.length > 0 ? field : undefined;
};

const apiErrorMessages: Readonly<Record<string, string>> = {
  NETWORK_PAUSED: "New operations on this network are paused. Try again after it is re-enabled.",
  WALLET_NOT_FOUND: "The wallet was not found or is not available to this authorization.",
  SESSION_KEY_NOT_FOUND: "The session key was not found or is not available to this authorization.",
  EXECUTION_SUBMISSION_NOT_FOUND: "The transaction submission was not found.",
  NO_AUTHORIZED_SESSION_KEY: "No delegated session key can authorize this operation.",
  POLICY_DENIED: "Every eligible session key was denied by policy.",
  IDEMPOTENCY_CONFLICT: "The operation conflicts with an earlier request.",
  EXECUTION_FAILED: "The transaction could not be prepared, signed, or submitted.",
  EXECUTION_UNAVAILABLE: "Transaction execution is temporarily unavailable.",
  SIGNING_FAILED: "The wallet could not sign the requested payload.",
  SIGNATURE_UNAVAILABLE: "Signature creation is temporarily unavailable.",
  VERIFICATION_FAILED: "The smart-account signature could not be verified.",
  LIMIT_EXCEEDED: "The organization has reached the applicable plan limit.",
};

const toSdkError = <E>(error: E): NameraSdkError<NameraEndpointError<E>> => {
  if (Schema.isSchemaError(error)) {
    return {
      kind: "contract",
      message: "The request or response did not match the Namera API contract.",
      status: null,
      cause: error,
    };
  }

  if (HttpClientError.isHttpClientError(error)) {
    const status = error.response?.status ?? null;
    const isTransportError = error.reason instanceof HttpClientError.TransportError;

    return {
      kind: isTransportError ? "network" : "unexpected",
      message: isTransportError ? "The Namera API could not be reached." : error.message,
      status,
      cause: error,
    };
  }

  const code = readField(error, "code");
  const tag = readField(error, "_tag");
  const message = readField(error, "message");
  const fallbackMessage =
    tag === "RateLimitExceeded"
      ? "Too many requests were made. Retry after the returned delay."
      : code === undefined
        ? "The Namera API rejected the request."
        : (apiErrorMessages[code] ?? "The Namera API rejected the request.");

  return {
    kind: "api",
    message: message ?? fallbackMessage,
    status: null,
    ...(code === undefined ? {} : { code: code as NameraApiErrorCode<NameraEndpointError<E>> }),
    ...(tag === undefined ? {} : { tag: tag as NameraApiErrorTag<NameraEndpointError<E>> }),
    cause: error as NameraEndpointError<E>,
  };
};

const isTransientRequestError = (error: unknown): boolean => {
  if (Predicate.isTagged(error, "InternalServerError")) return true;
  if (!HttpClientError.isHttpClientError(error)) return false;
  if (error.reason instanceof HttpClientError.TransportError) return true;
  if (!(error.reason instanceof HttpClientError.StatusCodeError)) return false;

  return error.reason.response.status === 408 || error.reason.response.status >= 500;
};

const transientRetrySchedule = Schedule.exponential("100 millis");

export class NameraTransport {
  readonly client: NameraApiClient;
  readonly #fetch: NameraFetch | undefined;

  constructor(config: NameraClientConfig) {
    // The generated client is the single source of request paths, encoders,
    // response decoders, and declared API errors used by the public SDK.
    const authorizationLayer = HttpApiMiddleware.layerClient(Authorization, ({ next, request }) =>
      Effect.gen(function* () {
        if (config.apiKey !== undefined) {
          return yield* next(HttpClientRequest.setHeader(request, "x-api-key", config.apiKey));
        }

        const accessToken =
          config.accessToken ?? (yield* Effect.promise(() => config.getAccessToken()));
        return yield* next(
          HttpClientRequest.setHeader(request, "authorization", `Bearer ${accessToken}`),
        );
      }),
    );

    this.client = Effect.runSync(
      HttpApiClient.make(NameraApi, {
        baseUrl: config.baseUrl ?? NAMERA_API_ORIGIN,
      }).pipe(Effect.provide(Layer.merge(FetchHttpClient.layer, authorizationLayer))),
    );
    this.#fetch = config.fetch;
  }

  request<A, E>(effect: Effect.Effect<A, E>): Promise<NameraResult<A, NameraEndpointError<E>>> {
    // Effect failures remain fully typed until this boundary. Declared HttpApi
    // errors are preserved as `cause`; only transport and decoding failures are
    // normalized into SDK infrastructure errors.
    const handled = Effect.matchCause(effect, {
      onFailure: (cause) =>
        failure<A, NameraEndpointError<E>>(
          Option.match(Cause.findErrorOption(cause), {
            onNone: (): NameraSdkError<NameraEndpointError<E>> => ({
              kind: "unexpected",
              message: "The SDK encountered an unexpected failure.",
              status: null,
              cause: Cause.squash(cause),
            }),
            onSome: (error) => toSdkError<E>(error),
          }),
        ),
      onSuccess: (value) => success<A, NameraEndpointError<E>>(value),
    });

    return Effect.runPromise(
      this.#fetch === undefined
        ? handled
        : Effect.provideService(handled, FetchHttpClient.Fetch, this.#fetch),
    );
  }

  requestWithRetry<A, E>(
    effect: Effect.Effect<A, E>,
  ): Promise<NameraResult<A, NameraEndpointError<E>>> {
    return this.request(
      effect.pipe(
        Effect.retry({
          times: 3,
          schedule: transientRetrySchedule,
          while: isTransientRequestError,
        }),
      ),
    );
  }
}
