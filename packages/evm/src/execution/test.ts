import { DateTime, Effect, Option, type Duration } from "effect";

import {
  Bytes32,
  EthereumAddress,
  Hex,
  TransactionHash,
  UserOperationHash,
  EvmExecutionError,
} from "@namera-ai/protocol";
import { verifyMessage } from "viem";
import { entryPoint07Address } from "viem/account-abstraction";

import { getChainDataByCaip2 } from "../chains/helpers.js";
import type { EvmExecutionService } from "./types.js";

export const makeTestEvmExecutionService = (
  overrides: Partial<EvmExecutionService> = {},
  options: {
    readonly signWithOwner?: boolean;
    readonly verifySessionSignature?: boolean;
    readonly sessionVerificationDelay?: Duration.Input;
    readonly onSessionVerification?: Effect.Effect<void>;
  } = {},
): EvmExecutionService => {
  const entryPoint = EthereumAddress.make(entryPoint07Address);
  const userOperationHash = UserOperationHash.make(`0x${"1".repeat(64)}`);
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
    paymaster: null,
    actualGasCost: 10_000_000_000_000n,
    actualGasUsed: 100_000n,
    success: true,
    reason: null,
  } as const;

  return {
    sessionSigningMessage: Effect.fn("evm.execution.test.sessionSigningMessage")(() =>
      Effect.fail(
        new EvmExecutionError({
          code: "SIGNING_FAILED",
          cause: new Error("Configure an explicit local session test adapter"),
        }),
      ),
    ),
    completeSessionExecution: Effect.fn("evm.execution.test.completeSessionExecution")(
      function* (input) {
        if (options.verifySessionSignature) {
          if (options.onSessionVerification !== undefined) yield* options.onSessionVerification;
          if (options.sessionVerificationDelay !== undefined)
            yield* Effect.sleep(options.sessionVerificationDelay);
          const valid = yield* Effect.tryPromise({
            try: () =>
              verifyMessage({
                address: input.session.authorization.signerAddress,
                message: { raw: Hex.make(`0x${"22".repeat(32)}`) },
                signature: input.signature,
              }),
            catch: (cause) => new EvmExecutionError({ code: "SIGNING_FAILED", cause }),
          });
          if (valid) {
            const signed = yield* makeTestEvmExecutionService().sign(input);
            return {
              ...signed,
              userOperation: { ...signed.userOperation, signature: input.signature },
            };
          }
        }
        return yield* Effect.fail(
          new EvmExecutionError({
            code: "SIGNING_FAILED",
            cause: new Error("Configure an explicit local session test adapter"),
          }),
        );
      },
    ),
    ownerApprovalChallenge: Effect.fn("evm.execution.test.ownerApprovalChallenge")(() =>
      Effect.fail(
        new EvmExecutionError({
          code: "SIGNING_FAILED",
          cause: new Error("Configure an explicit owner approval test adapter"),
        }),
      ),
    ),
    completeOwnerApproval: Effect.fn("evm.execution.test.completeOwnerApproval")(() =>
      Effect.fail(
        new EvmExecutionError({
          code: "SIGNING_FAILED",
          cause: new Error("Configure an explicit owner approval test adapter"),
        }),
      ),
    ),
    prepare: Effect.fn("evm.execution.test.prepare")((input) =>
      Effect.succeed({
        version: 1,
        namespace: "eip155",
        chainId: input.chainId,
        entryPointVersion: "0.7",
        entryPoint,
        sponsorship: input.sponsorship,
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
            paymaster: null,
          },
          simulation: {
            userOperation: {
              source: "eth_estimateUserOperationGas",
              callGasLimit: 0n,
              verificationGasLimit: 0n,
              preVerificationGas: 0n,
              maxFeePerGas: 1_000_000_000n,
              maxPriorityFeePerGas: 1n,
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
        },
        billing: {
          executionMeter:
            getChainDataByCaip2(input.chainId)?.environment === "mainnet"
              ? "execution.mainnet"
              : "execution.testnet",
          sponsorship:
            input.sponsorship === "alchemy-bso" &&
            getChainDataByCaip2(input.chainId)?.environment === "mainnet"
              ? {
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
                }
              : null,
        },
      }),
    ),
    sign: Effect.fn("evm.execution.test.sign")(function* (input) {
      const signature = options.signWithOwner
        ? yield* Effect.tryPromise({
            try: async () => {
              if (input.account.owner.validatorType !== "ecdsa_secp256k1")
                throw new Error("Test managed signing requires an ECDSA owner");
              return Hex.make(
                await input.account.owner.account.signMessage({
                  message: { raw: userOperationHash },
                }),
              );
            },
            catch: (cause) => new EvmExecutionError({ code: "SIGNING_FAILED", cause }),
          })
        : Hex.make(`0x${"4".repeat(128)}`);
      return {
        version: 1,
        namespace: "eip155",
        chainId: input.prepared.chainId,
        entryPointVersion: input.prepared.entryPointVersion,
        entryPoint: input.prepared.entryPoint,
        sponsorship: input.prepared.sponsorship,
        userOperation: {
          ...input.prepared.userOperation,
          signature,
        },
        userOperationHash,
        billing: input.prepared.billing,
      };
    }),
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
