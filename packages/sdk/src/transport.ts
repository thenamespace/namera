import { Cause, Effect, Layer, Option, Predicate, Schema } from "effect";
import type { Context } from "effect";
import { FetchHttpClient, HttpClientError, HttpClientRequest } from "effect/unstable/http";
import { HttpApiClient, HttpApiMiddleware } from "effect/unstable/httpapi";

import { Authorization, NameraApi } from "@namera-ai/api";

import { failure, success, type NameraResult, type NameraSdkError } from "#/result";

export type NameraClientConfig = {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly fetch?: NameraFetch;
};

export type NameraFetch = Context.Service.Shape<typeof FetchHttpClient.Fetch>;
export type NameraApiClient = HttpApiClient.ForApi<typeof NameraApi>;

const readField = (value: unknown, key: string): string | undefined => {
  if (!Predicate.isObject(value)) return undefined;

  const field = Reflect.get(value, key);
  return typeof field === "string" && field.length > 0 ? field : undefined;
};

const toSdkError = (error: unknown): NameraSdkError => {
  if (Schema.isSchemaError(error)) {
    return {
      kind: "contract",
      message: "The request or response did not match the Namera API contract.",
      status: null,
      details: error,
    };
  }

  if (HttpClientError.isHttpClientError(error)) {
    const status = error.response?.status ?? null;
    const isTransportError = error.reason instanceof HttpClientError.TransportError;

    return {
      kind: isTransportError ? "network" : "api",
      message: isTransportError ? "The Namera API could not be reached." : error.message,
      status,
      details: error,
    };
  }

  const code = readField(error, "code");
  const tag = readField(error, "_tag");
  const message = readField(error, "message");

  return {
    kind: "api",
    message: message ?? "The Namera API rejected the request.",
    status: null,
    ...(code === undefined ? {} : { code }),
    ...(tag === undefined ? {} : { tag }),
    details: error,
  };
};

export class NameraTransport {
  readonly client: NameraApiClient;
  readonly #fetch: NameraFetch | undefined;

  constructor(config: NameraClientConfig) {
    // The generated client is the single source of request paths, encoders,
    // response decoders, and declared API errors used by the public SDK.
    const authorizationLayer = HttpApiMiddleware.layerClient(Authorization, ({ next, request }) =>
      next(HttpClientRequest.setHeader(request, "x-api-key", config.apiKey)),
    );

    this.client = Effect.runSync(
      HttpApiClient.make(NameraApi, {
        baseUrl: config.baseUrl ?? "https://api.namera.ai",
      }).pipe(Effect.provide(Layer.merge(FetchHttpClient.layer, authorizationLayer))),
    );
    this.#fetch = config.fetch;
  }

  request<A, E>(effect: Effect.Effect<A, E>): Promise<NameraResult<A>> {
    const handled = Effect.matchCause(effect, {
      onFailure: (cause) =>
        failure(
          Option.match(Cause.findErrorOption(cause), {
            onNone: (): NameraSdkError => ({
              kind: "unexpected",
              message: "The SDK encountered an unexpected failure.",
              status: null,
              details: Cause.squash(cause),
            }),
            onSome: toSdkError,
          }),
        ),
      onSuccess: success,
    });

    return Effect.runPromise(
      this.#fetch === undefined
        ? handled
        : Effect.provideService(handled, FetchHttpClient.Fetch, this.#fetch),
    );
  }
}
