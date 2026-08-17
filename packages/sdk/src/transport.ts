import { Cause, Effect, Layer, Option, Predicate, Schema } from "effect";
import type { Context } from "effect";
import { FetchHttpClient, HttpClientError, HttpClientRequest } from "effect/unstable/http";
import { HttpApiClient, HttpApiMiddleware } from "effect/unstable/httpapi";

import { Authorization, NameraApi } from "@namera-ai/api";

import {
  failure,
  success,
  type NameraApiErrorCode,
  type NameraApiErrorTag,
  type NameraResult,
  type NameraSdkError,
} from "#/result";

type NameraClientBaseConfig = {
  readonly baseUrl?: string;
  readonly fetch?: NameraFetch;
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

  return {
    kind: "api",
    message: message ?? "The Namera API rejected the request.",
    status: null,
    ...(code === undefined ? {} : { code: code as NameraApiErrorCode<NameraEndpointError<E>> }),
    ...(tag === undefined ? {} : { tag: tag as NameraApiErrorTag<NameraEndpointError<E>> }),
    cause: error as NameraEndpointError<E>,
  };
};

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
        baseUrl: config.baseUrl ?? "https://api.namera.ai",
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
}
