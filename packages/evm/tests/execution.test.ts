import { expect, it } from "@effect/vitest";
import { Effect, Option, Redacted, Schema } from "effect";

import { Bytes32, EthereumAddress, Hex, SupportedEvmChainId } from "@namera-ai/protocol";
import type { AlchemyModularV2WalletData } from "@namera-ai/protocol/model";
import type { WebAuthnAccount } from "viem/account-abstraction";

import { getChainDataByCaip2 } from "../src/chains/helpers.js";
import { makeExecutionClients } from "../src/clients/execution.js";
import { toSimulationCalls } from "../src/execution/prepare.js";
import {
  applyEvmExecutionSponsorship,
  normalizeEvmUserOperation,
  toViemUserOperation,
} from "../src/execution/user-operation.js";
import { Evm } from "../src/index.js";

const chainId = Schema.decodeSync(SupportedEvmChainId)("eip155:1");
const address = EthereumAddress.make("0x1111111111111111111111111111111111111111");
const account = {
  wallet: {
    version: 1,
    implementation: "alchemy-modular-v2",
    modularAccountVersion: "2.0.0",
    entryPointVersion: "0.7",
    validatorType: "webauthn_p256",
    salt: 0n,
    entityId: 0,
    address,
  } satisfies AlchemyModularV2WalletData,
  owner: {
    validatorType: "webauthn_p256" as const,
    account: {
      id: "test-owner",
      publicKey: `0x04${"1".repeat(128)}`,
      type: "webAuthn",
      sign: () => Promise.reject(new Error("Not used by the deterministic execution service")),
      signMessage: () =>
        Promise.reject(new Error("Not used by the deterministic execution service")),
      signTypedData: () =>
        Promise.reject(new Error("Not used by the deterministic execution service")),
    } satisfies WebAuthnAccount,
  },
};

it("omits empty calldata only from auxiliary call simulation", () => {
  const calls = toSimulationCalls([
    { to: address, value: 1n, data: Hex.make("0x") },
    { to: address, value: 0n, data: Hex.make("0x1234") },
  ]);

  expect(calls).toEqual([
    { to: address, value: 1n },
    { to: address, value: 0n, data: "0x1234" },
  ]);
});

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

it("converts estimated operations into BSO submission envelopes", () => {
  const operation = applyEvmExecutionSponsorship(
    {
      sender: address,
      nonce: 1n,
      callData: "0x",
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
    },
    "alchemy-bso",
  );

  expect(operation).toMatchObject({
    preVerificationGas: 0n,
    maxFeePerGas: 0n,
    maxPriorityFeePerGas: 0n,
  });
  expect(operation).not.toHaveProperty("paymaster");
  expect(operation).not.toHaveProperty("paymasterData");
  expect(operation).not.toHaveProperty("paymasterVerificationGasLimit");
  expect(operation).not.toHaveProperty("paymasterPostOpGasLimit");
});

it("isolates the BSO policy header to sponsored submission", () => {
  const chain = getChainDataByCaip2(chainId);
  if (chain === undefined) throw new Error("Expected supported EVM chain");

  const clients = makeExecutionClients({
    alchemyApiKey: Redacted.make("alchemy-api-key"),
    alchemyBsoPolicyId: Redacted.make("bso-policy-id"),
    blockscoutApiKey: Redacted.make("blockscout-api-key"),
  })(chain);
  const sponsoredHeaders = new Headers(
    clients.getSubmissionClient("alchemy-bso").transport.fetchOptions?.headers,
  );
  const regularHeaders = new Headers(
    clients.getSubmissionClient("none").transport.fetchOptions?.headers,
  );

  expect(sponsoredHeaders.get("x-alchemy-policy-id")).toBe("bso-policy-id");
  expect(regularHeaders.has("x-alchemy-policy-id")).toBe(false);
});

it.effect("exposes the complete deterministic execution lifecycle from the root service", () =>
  Effect.gen(function* () {
    const evm = yield* Evm;
    const prepared = yield* evm.execution.prepare({
      chainId,
      account,
      calls: [{ to: address, value: 0n, data: Hex.make("0x") }],
      sponsorship: "none",
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
