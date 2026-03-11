import { FetchHttpClient, HttpApiClient } from "@effect/platform";
import { api } from "@repo/api";
import { Email } from "@repo/schema";
import { Effect, Layer, ManagedRuntime } from "effect";

const CustomFetchLive = FetchHttpClient.layer.pipe(
  Layer.provide(
    Layer.succeed(FetchHttpClient.RequestInit, {
      credentials: "include",
    }),
  ),
);
export const runtime = ManagedRuntime.make(CustomFetchLive);

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
    }),
  );

export const health = () =>
  runtime.runPromise(
    Effect.gen(function* () {
      const client = yield* Api;
      return yield* client.health.health();
    }),
  );

export const currentUser = () =>
  runtime.runPromise(
    Effect.gen(function* () {
      const client = yield* Api;
      return yield* client.auth.currentUser();
    }),
  );
