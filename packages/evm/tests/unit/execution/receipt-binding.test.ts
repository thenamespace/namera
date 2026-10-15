import { expect, it } from "@effect/vitest";
import { Schema } from "effect";

import { EthereumAddress, EvmExecutionReceipt, Hex, UserOperationHash } from "@namera-ai/protocol";

import { isReceiptForEvmExecution } from "../../../src/execution/receipt-binding.js";
import { preparedExecutionFixture } from "../../fixtures/prepared-execution.js";

it("binds receipt hash, chain, sender, nonce and EntryPoint independently of success", () => {
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
  const receipt = Schema.decodeUnknownSync(EvmExecutionReceipt)({
    version: 1,
    namespace: "eip155",
    chainId: signed.chainId,
    userOperationHash: hash,
    transactionHash: `0x${"22".repeat(32)}`,
    blockHash: `0x${"33".repeat(32)}`,
    blockNumber: "42",
    sender: signed.userOperation.sender,
    nonce: "0",
    entryPoint: signed.entryPoint,
    paymaster: null,
    actualGasCost: "100",
    actualGasUsed: "50",
    success: true,
    reason: null,
  });
  expect(isReceiptForEvmExecution(signed, receipt)).toBe(true);
  expect(isReceiptForEvmExecution(signed, { ...receipt, success: false, reason: "reverted" })).toBe(
    true,
  );
  const otherAddress = EthereumAddress.make("0x2222222222222222222222222222222222222222");
  for (const mismatch of [
    { ...receipt, chainId: "eip155:1" as const },
    { ...receipt, userOperationHash: UserOperationHash.make(`0x${"22".repeat(32)}`) },
    { ...receipt, sender: otherAddress },
    { ...receipt, nonce: 1n },
    { ...receipt, entryPoint: otherAddress },
  ])
    expect(isReceiptForEvmExecution(signed, mismatch)).toBe(false);
});
