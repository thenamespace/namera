import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { makeTestApiClient, resetTestState, testEmail } from "../helpers/index.js";
import { TestServerLayer } from "../layers/index.js";

layer(TestServerLayer)("authentication rate limits", (it) => {
  it.effect("limits repeated magic-link requests for the same email", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const email = testEmail("limited@example.com");

      for (let request = 0; request < 5; request += 1) {
        yield* client.magicLink.request({ payload: { email } });
      }
      const error = yield* client.magicLink.request({ payload: { email } }).pipe(Effect.flip);

      expect(error).toMatchObject({ _tag: "RateLimitExceeded" });
    }),
  );
});
