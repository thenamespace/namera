import { Context, Effect, Layer, Option, Ref } from "effect";
import { HttpClientRequest } from "effect/http";
import { HttpApiMiddleware } from "effect/http-api";

import { Authorization } from "@namera-ai/api";

export class TestAuthToken extends Context.Service<
  TestAuthToken,
  {
    readonly clear: Effect.Effect<void>;
    readonly clearApiKey: Effect.Effect<void>;
    readonly get: Effect.Effect<Option.Option<string>>;
    readonly getApiKey: Effect.Effect<Option.Option<string>>;
    readonly setApiKey: (apiKey: string) => Effect.Effect<void>;
    readonly set: (token: string) => Effect.Effect<void>;
  }
>()("@namera-ai/server/test/TestAuthToken") {
  static readonly layer = Layer.effect(
    TestAuthToken,
    Effect.gen(function* () {
      const token = yield* Ref.make(Option.none<string>());
      const apiKey = yield* Ref.make(Option.none<string>());
      return TestAuthToken.of({
        clear: Ref.set(token, Option.none()),
        clearApiKey: Ref.set(apiKey, Option.none()),
        get: Ref.get(token),
        getApiKey: Ref.get(apiKey),
        setApiKey: (value) => Ref.set(apiKey, Option.some(value)),
        set: (value) => Ref.set(token, Option.some(value)),
      });
    }),
  );
}

export const TestAuthorizationClientLayer = HttpApiMiddleware.layerClient(
  Authorization,
  Effect.fn("server.authorization.testClient")(function* ({ next, request }) {
    const authToken = yield* TestAuthToken;
    const token = yield* authToken.get;
    const apiKey = yield* authToken.getApiKey;

    return yield* next(
      Option.match(apiKey, {
        onNone: () =>
          Option.match(token, {
            onNone: () => request,
            onSome: (value) =>
              HttpClientRequest.setHeader(request, "cookie", `auth-token=${value}`),
          }),
        onSome: (value) => HttpClientRequest.setHeader(request, "x-api-key", value),
      }),
    );
  }),
);
