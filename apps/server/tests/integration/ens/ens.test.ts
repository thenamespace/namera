import { expect, layer } from "@effect/vitest";
import { Effect, Exit, Schema } from "effect";

import { EnsLabel } from "@namera-ai/protocol";

import { makeTestApiClient, resetTestState } from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";

layer(TestServerLayer)("ENS routes", (it) => {
  it.effect("normalizes labels and exposes public availability", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;

      expect(yield* client.ens.isNameAvailable({ query: { label: "Treasury" } })).toEqual({
        label: "treasury",
        name: "treasury.namera.eth",
        available: true,
      });
      expect(Exit.isFailure(Schema.decodeUnknownExit(EnsLabel)("abc"))).toBe(true);
      expect(Exit.isFailure(Schema.decodeUnknownExit(EnsLabel)("name.namera.eth"))).toBe(true);
    }),
  );
});
