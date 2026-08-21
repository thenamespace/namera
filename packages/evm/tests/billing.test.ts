import { expect, it } from "@effect/vitest";
import { DateTime, Effect, Schema } from "effect";

import {
  EthereumAddress,
  Hex,
  SupportedEvmChainId,
  type EvmGasPriceQuote,
} from "@namera-ai/protocol";

import {
  decimalUsdToMicroUsd,
  makeEvmExecutionBilling,
  nativeWeiToMicroUsd,
} from "../src/billing/index.js";
import { getChainDataByCaip2 } from "../src/chains/index.js";
import { normalizeEvmUserOperation } from "../src/execution/user-operation.js";

const address = EthereumAddress.make("0x1111111111111111111111111111111111111111");
const quote = {
  provider: "alchemy",
  currency: "usd",
  nativeAsset: "ETH",
  nativePriceMicroUsd: 3_000_000_000n,
  surchargeBasisPoints: 1_000,
  quotedAt: DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"),
} satisfies EvmGasPriceQuote;

it("converts provider USD quotes into conservative micro-USD amounts", () => {
  expect(decimalUsdToMicroUsd("3000")).toBe(3_000_000_000n);
  expect(decimalUsdToMicroUsd("3000.123456")).toBe(3_000_123_456n);
  expect(decimalUsdToMicroUsd("3000.1234561")).toBe(3_000_123_457n);
});

it("prices wei with the configured provider surcharge and rounds upward", () => {
  expect(
    nativeWeiToMicroUsd({
      amountWei: 100_000_000_000_000n,
      nativePriceMicroUsd: 3_000_000_000n,
      surchargeBasisPoints: 1_000,
    }),
  ).toBe(330_000n);
  expect(
    nativeWeiToMicroUsd({
      amountWei: 1n,
      nativePriceMicroUsd: 1n,
      surchargeBasisPoints: 0,
    }),
  ).toBe(1n);
});

it.effect("classifies execution meters and only prices mainnet sponsorship", () =>
  Effect.gen(function* () {
    const operation = yield* normalizeEvmUserOperation({
      sender: address,
      nonce: 1n,
      callData: Hex.make("0x"),
      callGasLimit: 100_000n,
      verificationGasLimit: 100_000n,
      preVerificationGas: 100_000n,
      maxFeePerGas: 1_000_000_000n,
      maxPriorityFeePerGas: 1n,
      paymaster: address,
      paymasterVerificationGasLimit: 100_000n,
      paymasterPostOpGasLimit: 100_000n,
      paymasterData: Hex.make("0x"),
      signature: Hex.make("0x"),
    });
    const mainnet = getChainDataByCaip2(Schema.decodeSync(SupportedEvmChainId)("eip155:1"));
    const testnet = getChainDataByCaip2(Schema.decodeSync(SupportedEvmChainId)("eip155:11155111"));
    if (mainnet === undefined || testnet === undefined) {
      return yield* Effect.die("Expected supported EVM chains");
    }

    expect(
      yield* makeEvmExecutionBilling({
        chain: mainnet,
        userOperation: operation,
        getGasPrice: () => Effect.succeed(quote),
      }),
    ).toEqual({
      executionMeter: "execution.mainnet",
      sponsorship: {
        provider: "alchemy",
        reservationAmountMicroUsd: 1_650_000n,
        quote,
      },
    });
    expect(
      yield* makeEvmExecutionBilling({
        chain: testnet,
        userOperation: operation,
        getGasPrice: () => Effect.die("Testnet pricing should not be requested"),
      }),
    ).toEqual({ executionMeter: "execution.testnet", sponsorship: null });
  }),
);
