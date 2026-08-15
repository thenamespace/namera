import { expect, it } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";

import { SupportedEvmChainId, UserOperationHash } from "@namera-ai/protocol";

import { Evm } from "../src/index.js";

it.effect("allows focused execution overrides without replacing the EVM service", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const receipt = yield* evm.execution.getReceipt({
      chainId: Schema.decodeSync(SupportedEvmChainId)("eip155:1"),
      userOperationHash: UserOperationHash.make(`0x${"1".repeat(64)}`),
    });

    expect(Option.isNone(receipt)).toBe(true);
    expect(yield* evm.getRpcUrl(1, "public")).toBe("https://example.test/1/public");
  }).pipe(
    Effect.provide(
      Evm.testLayerWith({
        execution: {
          getReceipt: Effect.fn("evm.test.pendingReceipt")(() => Effect.succeed(Option.none())),
        },
      }),
    ),
  ),
);
