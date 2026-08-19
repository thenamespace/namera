import { expect, it } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";

import { Bytes32, EthereumAddress, Hex, SupportedEvmChainId } from "@namera-ai/protocol";
import type { KernelWalletData } from "@namera-ai/protocol/model";
import { privateKeyToAccount } from "viem/accounts";

import { normalizeEvmUserOperation, toViemUserOperation } from "../src/execution/user-operation.js";
import { Evm } from "../src/index.js";

const chainId = Schema.decodeSync(SupportedEvmChainId)("eip155:1");
const address = EthereumAddress.make("0x1111111111111111111111111111111111111111");
const account = {
  wallet: {
    version: 1,
    implementation: "kernel",
    kernelVersion: "0.3.3",
    entryPointVersion: "0.7",
    validatorType: "ecdsa_secp256k1",
    accountIndex: 0n,
    address,
  } satisfies KernelWalletData,
  owner: privateKeyToAccount(`0x${"1".repeat(64)}`),
};

it.effect("round trips serializable EntryPoint 0.7 UserOperations", () =>
  Effect.gen(function* () {
    const normalized = yield* normalizeEvmUserOperation({
      sender: address,
      nonce: 1n,
      factory: EthereumAddress.make("0x2222222222222222222222222222222222222222"),
      factoryData: Hex.make("0x1234"),
      callData: Hex.make("0xabcd"),
      callGasLimit: 2n,
      verificationGasLimit: 3n,
      preVerificationGas: 4n,
      maxFeePerGas: 5n,
      maxPriorityFeePerGas: 6n,
      paymaster: EthereumAddress.make("0x3333333333333333333333333333333333333333"),
      paymasterVerificationGasLimit: 7n,
      paymasterPostOpGasLimit: 8n,
      paymasterData: Hex.make("0x5678"),
      signature: Hex.make("0x90"),
    });

    expect(toViemUserOperation(normalized)).toEqual({
      sender: address,
      nonce: 1n,
      factory: "0x2222222222222222222222222222222222222222",
      factoryData: "0x1234",
      callData: "0xabcd",
      callGasLimit: 2n,
      verificationGasLimit: 3n,
      preVerificationGas: 4n,
      maxFeePerGas: 5n,
      maxPriorityFeePerGas: 6n,
      paymaster: "0x3333333333333333333333333333333333333333",
      paymasterVerificationGasLimit: 7n,
      paymasterPostOpGasLimit: 8n,
      paymasterData: "0x5678",
      signature: "0x90",
    });
  }),
);

it.effect("exposes the complete deterministic execution lifecycle from the root service", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const prepared = yield* evm.execution.prepare({
      chainId,
      account,
      calls: [{ to: address, value: 0n, data: Hex.make("0x") }],
    });
    const signed = yield* evm.execution.sign({ account, prepared });
    const submitted = yield* evm.execution.submit({ signed });
    const receipt = yield* evm.execution.getReceipt({
      chainId,
      userOperationHash: submitted.userOperationHash,
    });
    const waited = yield* evm.execution.waitForReceipt({
      chainId,
      userOperationHash: submitted.userOperationHash,
    });

    expect(prepared.context.simulation.userOperation).toMatchObject({
      source: "eth_estimateUserOperationGas",
      callGasLimit: 0n,
    });
    expect(prepared.context.simulation.calls).toEqual({
      source: "viem.simulateCalls",
      results: [{ status: "success", returnData: "0x", gasUsed: 0n }],
      assetChanges: [],
      transfers: [],
    });
    expect(signed.userOperation.signature).not.toBe(Hex.make("0x"));
    expect(submitted.userOperationHash).toBe(signed.userOperationHash);
    expect(Option.getOrThrow(receipt)).toMatchObject({
      chainId,
      userOperationHash: submitted.userOperationHash,
      blockHash: Bytes32.make(`0x${"3".repeat(64)}`),
      success: true,
    });
    expect(Option.getOrThrow(waited).success).toBe(true);
  }).pipe(Effect.provide(Evm.testLayer)),
);
