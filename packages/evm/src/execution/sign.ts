import { Effect, Schema } from "effect";

import {
  EvmExecutionError,
  EvmSerializedUserOperation,
  EvmSignedExecution,
  UnsupportedChainError,
} from "@namera-ai/protocol";
import { getUserOperationHash } from "viem/account-abstraction";

import { reconstructEvmAccount } from "../accounts/reconstruct.js";
import type { ChainData } from "../chains/data.js";
import { getChainDataByCaip2 } from "../chains/helpers.js";
import type { ExecutionClients } from "../clients/execution.js";
import type { SignEvmExecutionInput } from "./types.js";
import { normalizeEvmUserOperation, toViemUserOperation } from "./user-operation.js";

export const makeSignEvmExecution = (getClients: (chain: ChainData) => ExecutionClients) =>
  Effect.fn("evm.execution.sign")(function* (input: SignEvmExecutionInput) {
    const chain = getChainDataByCaip2(input.prepared.chainId);
    if (chain === undefined) {
      return yield* new UnsupportedChainError({
        namespace: "eip155",
        chainId: input.prepared.chainId,
      });
    }

    const account = yield* reconstructEvmAccount(input.account, getClients(chain).publicClient);
    const encodedCalls = yield* Effect.tryPromise({
      try: () => account.encodeCalls(input.prepared.context.calls),
      catch: (cause) => new EvmExecutionError({ code: "SIGNING_FAILED", cause }),
    });
    const contextGas = input.prepared.context.userOperation.gas;
    const preparedUserOperation = input.prepared.userOperation;
    if (
      input.prepared.context.chainId !== input.prepared.chainId ||
      input.prepared.context.account.toLowerCase() !== account.address.toLowerCase() ||
      preparedUserOperation.sender.toLowerCase() !== account.address.toLowerCase() ||
      input.prepared.entryPoint.toLowerCase() !== account.entryPoint.address.toLowerCase() ||
      input.prepared.entryPointVersion !== account.entryPoint.version ||
      preparedUserOperation.callData.toLowerCase() !== encodedCalls.toLowerCase() ||
      input.prepared.context.userOperation.nonce !== preparedUserOperation.nonce ||
      contextGas.callGasLimit !== preparedUserOperation.callGasLimit ||
      contextGas.verificationGasLimit !== preparedUserOperation.verificationGasLimit ||
      contextGas.preVerificationGas !== preparedUserOperation.preVerificationGas ||
      contextGas.paymasterVerificationGasLimit !==
        (preparedUserOperation.paymasterVerificationGasLimit ?? 0n) ||
      contextGas.paymasterPostOpGasLimit !==
        (preparedUserOperation.paymasterPostOpGasLimit ?? 0n) ||
      contextGas.maxFeePerGas !== preparedUserOperation.maxFeePerGas ||
      contextGas.maxPriorityFeePerGas !== preparedUserOperation.maxPriorityFeePerGas ||
      (input.prepared.context.userOperation.paymaster ?? "").toLowerCase() !==
        (preparedUserOperation.paymaster ?? "").toLowerCase()
    ) {
      return yield* new EvmExecutionError({
        code: "SIGNING_FAILED",
        cause: new Error("The prepared execution does not match the reconstructed account"),
      });
    }

    const userOperation = toViemUserOperation(input.prepared.userOperation);
    const signature = yield* Effect.tryPromise({
      try: () => account.signUserOperation({ ...userOperation, chainId: chain.chain.id }),
      catch: (cause) => new EvmExecutionError({ code: "SIGNING_FAILED", cause }),
    });
    const signedUserOperation = { ...userOperation, signature };
    const normalized = yield* normalizeEvmUserOperation(signedUserOperation).pipe(
      Effect.mapError((error) => new EvmExecutionError({ code: "SIGNING_FAILED", cause: error })),
    );
    const userOperationHash = getUserOperationHash({
      chainId: chain.chain.id,
      entryPointAddress: input.prepared.entryPoint,
      entryPointVersion: input.prepared.entryPointVersion,
      userOperation: signedUserOperation,
    });
    const encodedUserOperation = yield* Schema.encodeEffect(EvmSerializedUserOperation)(
      normalized,
    ).pipe(Effect.mapError((cause) => new EvmExecutionError({ code: "SIGNING_FAILED", cause })));

    return yield* Schema.decodeUnknownEffect(EvmSignedExecution)({
      version: 1,
      namespace: "eip155",
      chainId: input.prepared.chainId,
      entryPointVersion: input.prepared.entryPointVersion,
      entryPoint: input.prepared.entryPoint,
      sponsorship: input.prepared.sponsorship,
      userOperation: encodedUserOperation,
      userOperationHash,
      billing: input.prepared.billing,
    }).pipe(Effect.mapError((cause) => new EvmExecutionError({ code: "SIGNING_FAILED", cause })));
  });
