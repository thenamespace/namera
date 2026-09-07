import { Effect } from "effect";

import {
  EvmExecutionError,
  UserOperationHash,
  type EvmPreparedExecution,
  type EvmSignedExecution,
} from "@namera-ai/protocol";
import type { Hex } from "viem";
import { getUserOperationHash } from "viem/account-abstraction";

import type { ChainData } from "../chains/data.js";
import { normalizeEvmUserOperation, toViemUserOperation } from "./user-operation.js";

export const preparedUserOperationHash = (prepared: EvmPreparedExecution, chain: ChainData) =>
  getUserOperationHash({
    chainId: chain.chain.id,
    entryPointAddress: prepared.entryPoint,
    entryPointVersion: prepared.entryPointVersion,
    userOperation: toViemUserOperation(prepared.userOperation),
  });

export const completeSignedEvmExecution = Effect.fn("evm.execution.completeSignedOperation")(
  function* (
    prepared: EvmPreparedExecution,
    chain: ChainData,
    signature: Hex,
  ): Effect.fn.Return<EvmSignedExecution, EvmExecutionError> {
    const userOperation = yield* normalizeEvmUserOperation({
      ...toViemUserOperation(prepared.userOperation),
      signature,
    }).pipe(Effect.mapError((cause) => new EvmExecutionError({ code: "SIGNING_FAILED", cause })));

    // Prepared fields are already decoded. Decoding them again as wire JSON
    // rejects bigint/date values in the sponsorship billing envelope.
    return {
      version: 1,
      namespace: "eip155",
      chainId: prepared.chainId,
      entryPointVersion: prepared.entryPointVersion,
      entryPoint: prepared.entryPoint,
      sponsorship: prepared.sponsorship,
      userOperation,
      userOperationHash: UserOperationHash.make(preparedUserOperationHash(prepared, chain)),
      billing: prepared.billing,
    };
  },
);
