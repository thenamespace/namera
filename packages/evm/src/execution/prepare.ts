import { Effect, Schema } from "effect";

import {
  EvmExecutionError,
  EvmPreparedExecution,
  EvmSerializedUserOperation,
  UnsupportedChainError,
} from "@namera-ai/protocol";
import { UserOperationExecutionError } from "viem/account-abstraction";

import { reconstructEvmAccount } from "../accounts/reconstruct.js";
import type { ChainData } from "../chains/data.js";
import { getChainDataByCaip2 } from "../chains/helpers.js";
import type { ExecutionClients } from "../clients/execution.js";
import type { PrepareEvmExecutionInput } from "./types.js";
import { normalizeEvmUserOperation } from "./user-operation.js";

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
    const block = yield* Effect.tryPromise({
      try: () => clients.publicClient.getBlock(),
      catch: (cause) => new EvmExecutionError({ code: "PREPARATION_FAILED", cause }),
    });
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
          source: "eth_estimateUserOperationGas",
          callGasLimit: simulation.callGasLimit.toString(),
          verificationGasLimit: simulation.verificationGasLimit.toString(),
          preVerificationGas: simulation.preVerificationGas.toString(),
          paymasterVerificationGasLimit: (
            simulation.paymasterVerificationGasLimit ?? 0n
          ).toString(),
          paymasterPostOpGasLimit: (simulation.paymasterPostOpGasLimit ?? 0n).toString(),
        },
      },
      userOperation: encodedUserOperation,
    }).pipe(
      Effect.mapError((cause) => new EvmExecutionError({ code: "PREPARATION_FAILED", cause })),
    );
  });
