import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { makeTestApiClient, resetTestState } from "./helpers/index.js";
import { TestServerLayer } from "./layers/index.js";

layer(TestServerLayer)("health routes", (it) => {
  it.effect("returns the service health", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;

      expect(yield* client.health.health()).toEqual({ status: true });
    }),
  );
});
