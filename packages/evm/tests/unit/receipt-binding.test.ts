import { expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";

import { EthereumAddress, Hex, UserOperationHash } from "@namera-ai/protocol";

import { isReceiptForEvmExecution } from "../../src/execution/receipt-binding.js";
import { makeTestEvmExecutionService } from "../../src/execution/test.js";
import { preparedExecutionFixture } from "../fixtures/prepared-execution.js";

it.effect("binds receipt hash, chain, sender, nonce and EntryPoint independently of success", () =>
  Effect.gen(function* () {
    const hash = UserOperationHash.make(`0x${"11".repeat(32)}`);
    const signed = {
      ...preparedExecutionFixture(
        {
          sender: EthereumAddress.make("0x1111111111111111111111111111111111111111"),
          nonce: 0n,
          callData: Hex.make("0x"),
          signature: Hex.make("0x1234"),
          callGasLimit: 1n,
          verificationGasLimit: 1n,
          preVerificationGas: 1n,
          maxFeePerGas: 1n,
          maxPriorityFeePerGas: 1n,
        },
        [],
      ),
      userOperationHash: hash,
    };
    const receipt = Option.getOrThrow(
      yield* makeTestEvmExecutionService().getReceipt({
        chainId: signed.chainId,
        userOperationHash: hash,
      }),
    );
    expect(isReceiptForEvmExecution(signed, receipt)).toBe(true);
    expect(
      isReceiptForEvmExecution(signed, { ...receipt, success: false, reason: "reverted" }),
    ).toBe(true);
    const otherAddress = EthereumAddress.make("0x2222222222222222222222222222222222222222");
    for (const mismatch of [
      { ...receipt, chainId: "eip155:1" as const },
      { ...receipt, userOperationHash: UserOperationHash.make(`0x${"22".repeat(32)}`) },
      { ...receipt, sender: otherAddress },
      { ...receipt, nonce: 1n },
      { ...receipt, entryPoint: otherAddress },
    ])
      expect(isReceiptForEvmExecution(signed, mismatch)).toBe(false);
  }),
);
