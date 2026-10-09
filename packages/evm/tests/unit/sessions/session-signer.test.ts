import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { Hex } from "@namera-ai/protocol";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { resolveEvmSessionSigner } from "../../../src/sessions/signer.js";

it.effect("binds a valid local public key to its EVM address and rejects non-curve points", () =>
  Effect.gen(function* () {
    const local = privateKeyToAccount(generatePrivateKey());
    expect(yield* resolveEvmSessionSigner(Hex.make(local.publicKey))).toEqual({
      publicKey: local.publicKey.toLowerCase(),
      address: local.address,
    });
    expect(
      yield* resolveEvmSessionSigner(Hex.make(`0x04${"00".repeat(64)}`)).pipe(Effect.flip),
    ).toMatchObject({ _tag: "EvmExecutionError", code: "PREPARATION_FAILED" });
    expect(yield* resolveEvmSessionSigner(Hex.make("0x04")).pipe(Effect.flip)).toMatchObject({
      _tag: "EvmExecutionError",
      code: "PREPARATION_FAILED",
    });
  }),
);
