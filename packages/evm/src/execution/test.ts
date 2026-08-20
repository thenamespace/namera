import { DateTime, Effect, Option } from "effect";

import {
  Bytes32,
  EthereumAddress,
  Hex,
  TransactionHash,
  UserOperationHash,
} from "@namera-ai/protocol";
import { entryPoint07Address } from "viem/account-abstraction";

import type { EvmExecutionService } from "./types.js";

export const makeTestEvmExecutionService = (
  overrides: Partial<EvmExecutionService> = {},
): EvmExecutionService => {
  const entryPoint = EthereumAddress.make(entryPoint07Address);
  const userOperationHash = UserOperationHash.make(`0x${"1".repeat(64)}`);
  const paymaster = EthereumAddress.make("0x3333333333333333333333333333333333333333");
  const receipt = {
    version: 1,
    namespace: "eip155",
    chainId: "eip155:1",
    userOperationHash,
    transactionHash: TransactionHash.make(`0x${"2".repeat(64)}`),
    blockHash: Bytes32.make(`0x${"3".repeat(64)}`),
    blockNumber: 1n,
    sender: EthereumAddress.make("0x1111111111111111111111111111111111111111"),
    nonce: 0n,
    entryPoint,
    paymaster,
    actualGasCost: 10_000_000_000_000n,
    actualGasUsed: 100_000n,
    success: true,
    reason: null,
  } as const;

  return {
    prepare: Effect.fn("evm.execution.test.prepare")((input) =>
      Effect.succeed({
        version: 1,
        namespace: "eip155",
        chainId: input.chainId,
        entryPointVersion: "0.7",
        entryPoint,
        context: {
          version: 1,
          namespace: "eip155",
          chainId: input.chainId,
          account: input.account.wallet.address,
          block: {
            number: 0n,
            hash: Bytes32.make(`0x${"0".repeat(64)}`),
            timestamp: DateTime.fromEpochSeconds(0),
          },
          calls: input.calls,
          userOperation: {
            nonce: 0n,
            gas: {
              callGasLimit: 0n,
              verificationGasLimit: 0n,
              preVerificationGas: 0n,
              paymasterVerificationGasLimit: 0n,
              paymasterPostOpGasLimit: 0n,
              maxFeePerGas: 0n,
              maxPriorityFeePerGas: 0n,
            },
            paymaster: input.sponsorship === "pimlico" ? paymaster : null,
          },
          simulation: {
            userOperation: {
              source: "eth_estimateUserOperationGas",
              callGasLimit: 0n,
              verificationGasLimit: 0n,
              preVerificationGas: 0n,
              paymasterVerificationGasLimit: 0n,
              paymasterPostOpGasLimit: 0n,
            },
            calls: {
              source: "viem.simulateCalls",
              results: input.calls.map(() => ({
                status: "success" as const,
                returnData: Hex.make("0x"),
                gasUsed: 0n,
              })),
              assetChanges: [],
              transfers: [],
            },
          },
        },
        userOperation: {
          sender: input.account.wallet.address,
          nonce: 0n,
          callData: Hex.make("0x"),
          callGasLimit: 0n,
          verificationGasLimit: 0n,
          preVerificationGas: 0n,
          maxFeePerGas: 0n,
          maxPriorityFeePerGas: 0n,
          signature: Hex.make("0x"),
          ...(input.sponsorship === "pimlico"
            ? {
                paymaster,
                paymasterVerificationGasLimit: 10_000n,
                paymasterPostOpGasLimit: 10_000n,
              }
            : {}),
        },
        billing: {
          executionMeter: input.chainId === "eip155:1" ? "execution.mainnet" : "execution.testnet",
          sponsorship:
            input.sponsorship === "pimlico" && input.chainId === "eip155:1"
              ? {
                  provider: "pimlico",
                  reservationAmountMicroUsd: 100_000n,
                  quote: {
                    provider: "alchemy",
                    currency: "usd",
                    nativeAsset: "ETH",
                    nativePriceMicroUsd: 3_000_000_000n,
                    surchargeBasisPoints: 1_000,
                    quotedAt: DateTime.fromEpochSeconds(0),
                  },
                }
              : null,
        },
      }),
    ),
    sign: Effect.fn("evm.execution.test.sign")((input) =>
      Effect.succeed({
        version: 1,
        namespace: "eip155",
        chainId: input.prepared.chainId,
        entryPointVersion: input.prepared.entryPointVersion,
        entryPoint: input.prepared.entryPoint,
        userOperation: {
          ...input.prepared.userOperation,
          signature: Hex.make(`0x${"4".repeat(128)}`),
        },
        userOperationHash,
        billing: input.prepared.billing,
      }),
    ),
    submit: Effect.fn("evm.execution.test.submit")((input) =>
      Effect.succeed({
        version: 1,
        namespace: "eip155",
        chainId: input.signed.chainId,
        userOperationHash: input.signed.userOperationHash,
      }),
    ),
    getReceipt: Effect.fn("evm.execution.test.getReceipt")((input) =>
      Effect.succeed(
        Option.some({
          ...receipt,
          chainId: input.chainId,
          userOperationHash: input.userOperationHash,
        }),
      ),
    ),
    getStatus: Effect.fn("evm.execution.test.getStatus")(() =>
      Effect.succeed({ status: "included", transactionHash: receipt.transactionHash }),
    ),
    waitForReceipt: Effect.fn("evm.execution.test.waitForReceipt")((input) =>
      Effect.succeed(
        Option.some({
          ...receipt,
          chainId: input.chainId,
          userOperationHash: input.userOperationHash,
        }),
      ),
    ),
    ...overrides,
  };
};
