import { FetchHttpClient, HttpApiClient } from "@effect/platform";
import { api } from "@namera-ai/api";
import { Email } from "@namera-ai/schema";
import { Effect, Layer, ManagedRuntime } from "effect";

import { EnvLive } from "./env";
import { OtelWebLive } from "./otel";

const CustomFetchLive = FetchHttpClient.layer.pipe(
  Layer.provide(
    Layer.succeed(FetchHttpClient.RequestInit, {
      credentials: "include",
    }),
  ),
);
export const runtime = ManagedRuntime.make(
  CustomFetchLive.pipe(
    Layer.provide(OtelWebLive),
    Layer.provide(Layer.setConfigProvider(EnvLive)),
  ),
);

const Api = HttpApiClient.make(api, {
  baseUrl: "http://localhost:8080",
});

export const signIn = () =>
  runtime.runPromise(
    Effect.gen(function* () {
      const client = yield* Api;

      const callbackUrl = new URL("http://localhost:3000");

      yield* client.auth.signInMagicLink({
        payload: {
          callbackUrl,
          email: Email.make("vedant@test.com"),
          errorCallbackUrl: callbackUrl,
          name: "Vedant",
          newUserCallbackUrl: callbackUrl,
        },
      });
    }).pipe(Effect.withSpan("user sign in")),
  );

export const health = () =>
  runtime.runPromise(
    Effect.gen(function* () {
      const client = yield* Api;
      return yield* client.health.health();
    }).pipe(Effect.withSpan("user health check")),
  );

export const currentUser = () =>
  runtime.runPromise(
    Effect.gen(function* () {
      const client = yield* Api;
      return yield* client.auth.currentUser();
    }).pipe(Effect.withSpan("user current")),
  );
