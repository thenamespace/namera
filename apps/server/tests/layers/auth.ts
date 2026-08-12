import { Context, Effect, Layer, Option, Ref } from "effect";
import { HttpClientRequest } from "effect/unstable/http";
import { HttpApiMiddleware } from "effect/unstable/httpapi";

import { Authorization } from "@namera-ai/api";

export class TestAuthToken extends Context.Service<
  TestAuthToken,
  {
    readonly clear: Effect.Effect<void>;
    readonly get: Effect.Effect<Option.Option<string>>;
    readonly set: (token: string) => Effect.Effect<void>;
  }
>()("@namera-ai/server/test/TestAuthToken") {
  static readonly layer = Layer.effect(
    TestAuthToken,
    Effect.gen(function* () {
      const token = yield* Ref.make(Option.none<string>());
      return TestAuthToken.of({
        clear: Ref.set(token, Option.none()),
        get: Ref.get(token),
        set: (value) => Ref.set(token, Option.some(value)),
      });
    }),
  );
}

export const TestAuthorizationClientLayer = HttpApiMiddleware.layerClient(
  Authorization,
  Effect.fn("Authorization.testClient")(function* ({ next, request }) {
    const authToken = yield* TestAuthToken;
    const token = yield* authToken.get;

    return yield* next(
      Option.match(token, {
        onNone: () => request,
        onSome: (value) => HttpClientRequest.setHeader(request, "cookie", `auth-token=${value}`),
      }),
    );
  }),
);
