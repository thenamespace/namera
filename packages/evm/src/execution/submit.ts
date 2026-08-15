import { Effect, Schema } from "effect";

import {
  EvmExecutionError,
  EvmSubmittedExecution,
  UnsupportedChainError,
} from "@namera-ai/protocol";
import { BaseError, RpcRequestError } from "viem";
import { getUserOperationHash } from "viem/account-abstraction";

import type { ChainData } from "../chains/data.js";
import { getChainDataByCaip2 } from "../chains/helpers.js";
import type { ExecutionClients } from "../clients/execution.js";
import type { SubmitEvmExecutionInput } from "./types.js";
import { toViemUserOperation } from "./user-operation.js";

export const makeSubmitEvmExecution = (getClients: (chain: ChainData) => ExecutionClients) =>
  Effect.fn("evm.execution.submit")(function* (input: SubmitEvmExecutionInput) {
    const chain = getChainDataByCaip2(input.signed.chainId);
    if (chain === undefined) {
      return yield* new UnsupportedChainError({
        namespace: "eip155",
        chainId: input.signed.chainId,
      });
    }

    const userOperation = toViemUserOperation(input.signed.userOperation);
    const expectedHash = getUserOperationHash({
      chainId: chain.chain.id,
      entryPointAddress: input.signed.entryPoint,
      entryPointVersion: input.signed.entryPointVersion,
      userOperation,
    });
    if (expectedHash.toLowerCase() !== input.signed.userOperationHash.toLowerCase()) {
      return yield* new EvmExecutionError({
        code: "SUBMISSION_HASH_MISMATCH",
        cause: new Error("The signed UserOperation does not match its stored hash"),
      });
    }

    const submittedHash = yield* Effect.tryPromise({
      try: () =>
        getClients(chain).bundlerClient.sendUserOperation({
          ...userOperation,
          entryPointAddress: input.signed.entryPoint,
        }),
      catch: (cause) => {
        const rpcError =
          cause instanceof BaseError &&
          cause.walk((error) => error instanceof RpcRequestError) !== null;
        return new EvmExecutionError({
          code: rpcError ? "SUBMISSION_REJECTED" : "SUBMISSION_UNKNOWN",
          cause,
        });
      },
    });

    if (submittedHash.toLowerCase() !== expectedHash.toLowerCase()) {
      return yield* new EvmExecutionError({
        code: "SUBMISSION_HASH_MISMATCH",
        cause: new Error("The bundler returned a different UserOperation hash"),
      });
    }

    return yield* Schema.decodeUnknownEffect(EvmSubmittedExecution)({
      version: 1,
      namespace: "eip155",
      chainId: input.signed.chainId,
      userOperationHash: submittedHash,
    }).pipe(
      Effect.mapError(
        (cause) => new EvmExecutionError({ code: "SUBMISSION_HASH_MISMATCH", cause }),
      ),
    );
  });
