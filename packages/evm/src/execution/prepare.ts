import { Effect, Schema } from "effect";

import {
  EvmExecutionError,
  EvmPreparedExecution,
  EvmSerializedUserOperation,
  UnsupportedChainError,
} from "@namera-ai/protocol";
import { getAddress, toEventSelector } from "viem";
import { UserOperationExecutionError } from "viem/account-abstraction";

import { reconstructEvmAccount } from "../accounts/reconstruct.js";
import type { ChainData } from "../chains/data.js";
import { getChainDataByCaip2 } from "../chains/helpers.js";
import type { ExecutionClients } from "../clients/execution.js";
import type { PrepareEvmExecutionInput } from "./types.js";
import { normalizeEvmUserOperation } from "./user-operation.js";

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

export const toSimulationCalls = (calls: PrepareEvmExecutionInput["calls"]) =>
  calls.map(({ data, ...call }) =>
    // Viem discovers touched assets through eth_createAccessList whenever
    // calldata is present. Empty calldata carries no asset selector and must
    // be omitted from this auxiliary simulation to avoid provider gas errors.
    data === "0x" ? call : { ...call, data },
  );

export const makePrepareEvmExecution = (getClients: (chain: ChainData) => ExecutionClients) =>
  Effect.fn("evm.execution.prepare")(function* (input: PrepareEvmExecutionInput) {
    const chain = getChainDataByCaip2(input.chainId);
    if (chain === undefined) {
      return yield* new UnsupportedChainError({
        namespace: "eip155",
        chainId: input.chainId,
      });
    }

    const clients = getClients(chain);
    const account = yield* reconstructEvmAccount(input.account, clients.publicClient);
    const smartAccountClient = clients.createSmartAccountClient(account);
    const userOperation = yield* Effect.tryPromise({
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
    const simulation = yield* Effect.tryPromise({
      try: () =>
        clients.pimlicoClient.estimateUserOperationGas({
          ...userOperation,
          entryPointAddress: account.entryPoint.address,
        }),
      catch: (cause) => new EvmExecutionError({ code: "SIMULATION_FAILED", cause }),
    });
    const callSimulation = yield* Effect.tryPromise({
      try: () =>
        clients.publicClient.simulateCalls({
          account: account.address,
          calls: toSimulationCalls(input.calls),
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
    const normalizedUserOperation = yield* normalizeEvmUserOperation(userOperation);
    const encodedUserOperation = yield* Schema.encodeEffect(EvmSerializedUserOperation)(
      normalizedUserOperation,
    ).pipe(
      Effect.mapError((cause) => new EvmExecutionError({ code: "PREPARATION_FAILED", cause })),
    );

    return yield* Schema.decodeUnknownEffect(EvmPreparedExecution)({
      version: 1,
      namespace: "eip155",
      chainId: chain.chainId,
      entryPointVersion: account.entryPoint.version,
      entryPoint: account.entryPoint.address,
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
            callGasLimit: simulation.callGasLimit.toString(),
            verificationGasLimit: simulation.verificationGasLimit.toString(),
            preVerificationGas: simulation.preVerificationGas.toString(),
            paymasterVerificationGasLimit: (
              simulation.paymasterVerificationGasLimit ?? 0n
            ).toString(),
            paymasterPostOpGasLimit: (simulation.paymasterPostOpGasLimit ?? 0n).toString(),
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
    }).pipe(
      Effect.mapError((cause) => new EvmExecutionError({ code: "PREPARATION_FAILED", cause })),
    );
  });
