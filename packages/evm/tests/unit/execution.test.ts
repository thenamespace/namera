import { expect, it } from "@effect/vitest";
import { DateTime, Effect, Redacted, Schema } from "effect";

import { EthereumAddress, EvmSignedExecution, Hex, SupportedEvmChainId } from "@namera-ai/protocol";

import { getChainDataByCaip2 } from "../../src/chains/helpers.js";
import { makeExecutionClients } from "../../src/clients/execution.js";
import { toSimulationCalls } from "../../src/execution/prepare.js";
import { completeSignedEvmExecution } from "../../src/execution/signed-operation.js";
import {
  applyEvmExecutionSponsorship,
  normalizeEvmUserOperation,
  toViemUserOperation,
} from "../../src/execution/user-operation.js";
import { preparedExecutionFixture } from "../fixtures/prepared-execution.js";

const chainId = Schema.decodeSync(SupportedEvmChainId)("eip155:1");
const address = EthereumAddress.make("0x1111111111111111111111111111111111111111");

it.effect("preserves decoded sponsorship billing when finalizing a signed operation", () =>
  Effect.gen(function* () {
    const chain = getChainDataByCaip2(chainId);
    if (chain === undefined) throw new Error("Missing configured chain");
    const prepared = preparedExecutionFixture(
      yield* normalizeEvmUserOperation({
        sender: address,
        nonce: 0n,
        callData: "0x",
        signature: "0x",
        callGasLimit: 100_000n,
        verificationGasLimit: 100_000n,
        preVerificationGas: 0n,
        maxFeePerGas: 0n,
        maxPriorityFeePerGas: 0n,
      }),
      [],
    );
    const signed = yield* completeSignedEvmExecution(
      {
        ...prepared,
        chainId,
        sponsorship: "alchemy-bso",
        billing: {
          executionMeter: "execution.mainnet",
          sponsorship: {
            provider: "alchemy",
            mode: "bso",
            reservationAmountMicroUsd: 100_000n,
            quote: {
              provider: "alchemy",
              currency: "usd",
              nativeAsset: "ETH",
              nativePriceMicroUsd: 3_000_000_000n,
              surchargeBasisPoints: 800,
              quotedAt: DateTime.fromEpochSeconds(0),
            },
          },
        },
      },
      chain,
      "0x1234",
    );
    expect(signed.billing.sponsorship?.reservationAmountMicroUsd).toBe(100_000n);
    const encoded = yield* Schema.encodeEffect(EvmSignedExecution)(signed);
    expect(encoded.billing.sponsorship?.reservationAmountMicroUsd).toBe("100000");
    expect(encoded.billing.sponsorship?.quote.quotedAt).toBe("1970-01-01T00:00:00.000Z");
    expect(signed.userOperation.signature).toBe("0x1234");
  }),
);

it("bounds auxiliary simulation gas and omits only empty calldata", () => {
  const calls = toSimulationCalls(
    [
      { to: address, value: 1n, data: Hex.make("0x") },
      { to: address, value: 0n, data: Hex.make("0x1234") },
    ],
    250_000n,
  );

  expect(calls).toEqual([
    { to: address, value: 1n, gas: 271_000n },
    { to: address, value: 0n, data: "0x1234", gas: 271_080n },
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
