import { Effect, Schema } from "effect";

import {
  EvmExecutionBilling,
  EvmExecutionError,
  EvmPreparedExecution,
  EvmSerializedUserOperation,
  UnsupportedChainError,
} from "@namera-ai/protocol";
import type { EvmGasPriceQuote } from "@namera-ai/protocol";
import { getAddress, toEventSelector } from "viem";
import { UserOperationExecutionError } from "viem/account-abstraction";

import { makeEvmExecutionBilling } from "../billing/execution.js";
import type { ChainData } from "../chains/data.js";
import { getChainDataByCaip2 } from "../chains/helpers.js";
import type { ExecutionClients } from "../clients/execution.js";
import { reconstructExecutionAccount } from "./account.js";
import type { PrepareEvmExecutionInput } from "./types.js";
import { applyEvmExecutionSponsorship, normalizeEvmUserOperation } from "./user-operation.js";

const nativeTransferEmitter = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const transferEventSelector = toEventSelector("Transfer(address,address,uint256)");

const addressFromTopic = (topic: `0x${string}`): `0x${string}` =>
  getAddress(`0x${topic.slice(-40)}`);

const normalizeNativeTransfers = (
  results: ReadonlyArray<{
    readonly logs?:
      | ReadonlyArray<{
          readonly address: `0x${string}`;
          readonly data: `0x${string}`;
          readonly topics: readonly (`0x${string}` | null)[];
        }>
      | undefined;
  }>,
) =>
  results.flatMap((result, callIndex) =>
    (result.logs ?? []).flatMap((log) => {
      const [selector, from, to] = log.topics;
      if (
        log.address.toLowerCase() !== nativeTransferEmitter ||
        selector?.toLowerCase() !== transferEventSelector ||
        from === null ||
        from === undefined ||
        to === null ||
        to === undefined ||
        log.data === "0x"
      ) {
        return [];
      }

      return [
        {
          callIndex,
          from: addressFromTopic(from),
          to: addressFromTopic(to),
          value: BigInt(log.data).toString(),
        },
      ];
    }),
  );

export const toSimulationCalls = (calls: PrepareEvmExecutionInput["calls"], executionGas: bigint) =>
  calls.map(({ data, ...call }) => {
    // Raw transactions need intrinsic gas in addition to UserOperation call gas.
    // Forty per byte conservatively covers the EIP-7623 calldata floor; this
    // auxiliary allowance never changes the signed operation or billing estimate.
    const gas = executionGas + 21_000n + BigInt((data.length - 2) / 2) * 40n;
    // Viem discovers touched assets through eth_createAccessList whenever
    // calldata is present. Empty calldata carries no asset selector and must
    // be omitted from this auxiliary simulation to avoid provider gas errors.
    return data === "0x" ? { ...call, gas } : { ...call, data, gas };
  });

export const makePrepareEvmExecution = (
  getClients: (chain: ChainData) => ExecutionClients,
  getGasPrice: () => Effect.Effect<EvmGasPriceQuote, EvmExecutionError>,
) =>
  Effect.fn("evm.execution.prepare")(function* (input: PrepareEvmExecutionInput) {
    const chain = getChainDataByCaip2(input.chainId);
    if (chain !== undefined && !chain.operationsEnabled) {
      return yield* new EvmExecutionError({
        code: "NETWORK_PAUSED",
        cause: new Error("New operations on this network are paused"),
      });
    }
    if (chain === undefined) {
      return yield* new UnsupportedChainError({
        namespace: "eip155",
        chainId: input.chainId,
      });
    }

    const clients = getClients(chain);
    const account = yield* reconstructExecutionAccount(input, chain, clients.publicClient);
    const smartAccountClient = clients.createSmartAccountClient(account);
    const estimatedUserOperation = yield* Effect.tryPromise({
      try: () => smartAccountClient.prepareUserOperation({ account, calls: input.calls }),
      catch: (cause) =>
        new EvmExecutionError({
          code:
            cause instanceof UserOperationExecutionError
              ? "SIMULATION_FAILED"
              : "PREPARATION_FAILED",
          cause,
        }),
    });
    const userOperation = applyEvmExecutionSponsorship(estimatedUserOperation, input.sponsorship);
    const callSimulation = yield* Effect.tryPromise({
      try: () =>
        clients.publicClient.simulateCalls({
          account: account.address,
          // Viem forwards this limit to its access-list discovery requests too.
          calls: toSimulationCalls(input.calls, estimatedUserOperation.callGasLimit),
          traceAssetChanges: true,
          traceTransfers: true,
        }),
      catch: (cause) => new EvmExecutionError({ code: "SIMULATION_FAILED", cause }),
    });
    const block = callSimulation.block;
    if (block.hash === null || block.number === null) {
      return yield* new EvmExecutionError({
        code: "PREPARATION_FAILED",
        cause: new Error("The latest block is missing its hash or number"),
      });
    }
    const normalizedEstimatedUserOperation =
      yield* normalizeEvmUserOperation(estimatedUserOperation);
    const normalizedUserOperation = yield* normalizeEvmUserOperation(userOperation);
    const encodedUserOperation = yield* Schema.encodeEffect(EvmSerializedUserOperation)(
      normalizedUserOperation,
    ).pipe(
      Effect.mapError((cause) => new EvmExecutionError({ code: "PREPARATION_FAILED", cause })),
    );
    const billing = yield* makeEvmExecutionBilling({
      chain,
      sponsorship: input.sponsorship,
      estimatedUserOperation: normalizedEstimatedUserOperation,
      getGasPrice,
    }).pipe(
      Effect.flatMap(Schema.encodeEffect(EvmExecutionBilling)),
      Effect.mapError((cause) =>
        cause instanceof EvmExecutionError
          ? cause
          : new EvmExecutionError({ code: "PREPARATION_FAILED", cause }),
      ),
    );

    return yield* Schema.decodeUnknownEffect(EvmPreparedExecution)({
      version: 1,
      namespace: "eip155",
      chainId: chain.chainId,
      entryPointVersion: account.entryPoint.version,
      entryPoint: account.entryPoint.address,
      sponsorship: input.sponsorship,
      context: {
        version: 1,
        namespace: "eip155",
        chainId: chain.chainId,
        account: account.address,
        block: {
          number: block.number.toString(),
          hash: block.hash,
          timestamp: new Date(Number(block.timestamp) * 1_000),
        },
        calls: input.calls.map((call) => ({
          ...call,
          value: call.value.toString(),
        })),
        userOperation: {
          nonce: userOperation.nonce.toString(),
          gas: {
            callGasLimit: userOperation.callGasLimit.toString(),
            verificationGasLimit: userOperation.verificationGasLimit.toString(),
            preVerificationGas: userOperation.preVerificationGas.toString(),
            paymasterVerificationGasLimit: (
              userOperation.paymasterVerificationGasLimit ?? 0n
            ).toString(),
            paymasterPostOpGasLimit: (userOperation.paymasterPostOpGasLimit ?? 0n).toString(),
            maxFeePerGas: userOperation.maxFeePerGas.toString(),
            maxPriorityFeePerGas: userOperation.maxPriorityFeePerGas.toString(),
          },
          paymaster: userOperation.paymaster ?? null,
        },
        simulation: {
          userOperation: {
            source: "eth_estimateUserOperationGas",
            callGasLimit: estimatedUserOperation.callGasLimit.toString(),
            verificationGasLimit: estimatedUserOperation.verificationGasLimit.toString(),
            preVerificationGas: estimatedUserOperation.preVerificationGas.toString(),
            maxFeePerGas: estimatedUserOperation.maxFeePerGas.toString(),
            maxPriorityFeePerGas: estimatedUserOperation.maxPriorityFeePerGas.toString(),
          },
          calls: {
            source: "viem.simulateCalls",
            results: callSimulation.results.map((result) => ({
              status: result.status,
              returnData: result.data,
              gasUsed: result.gasUsed.toString(),
            })),
            assetChanges: callSimulation.assetChanges.map((change) => ({
              asset: {
                address: change.token.address,
                symbol:
                  change.token.symbol !== undefined && change.token.symbol.length <= 64
                    ? change.token.symbol
                    : null,
                decimals:
                  change.token.decimals !== undefined &&
                  Number.isInteger(change.token.decimals) &&
                  change.token.decimals >= 0 &&
                  change.token.decimals <= 255
                    ? change.token.decimals
                    : null,
              },
              pre: change.value.pre.toString(),
              post: change.value.post.toString(),
              diff: change.value.diff.toString(),
            })),
            transfers: normalizeNativeTransfers(callSimulation.results),
          },
        },
      },
      userOperation: encodedUserOperation,
      billing,
    }).pipe(
      Effect.mapError((cause) => new EvmExecutionError({ code: "PREPARATION_FAILED", cause })),
    );
  });
