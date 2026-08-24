import { expect, layer } from "@effect/vitest";
import { Effect, Exit, Schema } from "effect";

import { EnsLabel } from "@namera-ai/protocol";

import { makeTestApiClient, resetTestState, signIn, testEmail } from "../helpers/index.js";
import { TestServerLayer } from "../layers/index.js";

layer(TestServerLayer)("ENS routes", (it) => {
  it.effect("normalizes labels and exposes public availability", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;

      expect(yield* client.ens.isNameAvailable({ query: { label: "Treasury" } })).toEqual({
        label: "treasury",
        name: "treasury.namera.id",
        available: true,
      });
      expect(Exit.isFailure(Schema.decodeUnknownExit(EnsLabel)("abc"))).toBe(true);
      expect(Exit.isFailure(Schema.decodeUnknownExit(EnsLabel)("name.namera.id"))).toBe(true);
    }),
  );

  it.effect("reserves the ENS name during wallet creation", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("ens-wallet-owner@example.com"));

      yield* client.wallet.create({
        payload: {
          namespace: "eip155",
          ensLabel: "agent-treasury",
          protectionLevel: "software",
          metadata: { version: 1, name: "Treasury" },
        },
      });

      expect(
        yield* client.ens.isNameAvailable({ query: { label: "agent-treasury" } }),
      ).toMatchObject({ available: false });
      expect(
        yield* client.wallet
          .create({
            payload: {
              namespace: "eip155",
              ensLabel: "agent-treasury",
              protectionLevel: "software",
              metadata: { version: 1, name: "Duplicate" },
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "EnsNameUnavailableError", code: "ENS_NAME_UNAVAILABLE" });
    }),
  );
});
