import { Effect, Schema } from "effect";

import {
  EvmExecutionError,
  EvmPreparedExecution,
  EvmSerializedUserOperation,
  UnsupportedChainError,
} from "@namera-ai/protocol";

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
    const prepared = yield* Effect.tryPromise({
      try: async () => {
        const userOperation = await clients.bundlerClient.prepareUserOperation({
          account,
          calls: input.calls,
        });
        const block = await clients.publicClient.getBlock();
        return { userOperation, block };
      },
      catch: (cause) => new EvmExecutionError({ code: "PREPARATION_FAILED", cause }),
    });

    const { userOperation, block } = prepared;
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
          number: block.number,
          hash: block.hash,
          timestamp: new Date(Number(block.timestamp) * 1_000),
        },
        calls: input.calls,
        userOperation: {
          nonce: userOperation.nonce,
          gas: {
            callGasLimit: userOperation.callGasLimit,
            verificationGasLimit: userOperation.verificationGasLimit,
            preVerificationGas: userOperation.preVerificationGas,
            paymasterVerificationGasLimit: userOperation.paymasterVerificationGasLimit ?? 0n,
            paymasterPostOpGasLimit: userOperation.paymasterPostOpGasLimit ?? 0n,
            maxFeePerGas: userOperation.maxFeePerGas,
            maxPriorityFeePerGas: userOperation.maxPriorityFeePerGas,
          },
          paymaster: userOperation.paymaster ?? null,
        },
        simulation: null,
      },
      userOperation: encodedUserOperation,
    }).pipe(
      Effect.mapError((cause) => new EvmExecutionError({ code: "PREPARATION_FAILED", cause })),
    );
  });
