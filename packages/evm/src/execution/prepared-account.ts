import { Effect } from "effect";

import { EvmExecutionError, UnsupportedChainError } from "@namera-ai/protocol";

import type { ChainData } from "../chains/data.js";
import { getChainDataByCaip2 } from "../chains/helpers.js";
import type { ExecutionClients } from "../clients/execution.js";
import { reconstructExecutionAccount } from "./account.js";
import type { SignEvmExecutionInput } from "./types.js";
import { toViemUserOperation } from "./user-operation.js";

export const makeReconstructPreparedAccount = (
  getClients: (chain: ChainData) => Pick<ExecutionClients, "publicClient">,
) =>
  Effect.fn("evm.execution.reconstructPreparedAccount")(function* (input: SignEvmExecutionInput) {
    const chain = getChainDataByCaip2(input.prepared.chainId);
    if (chain !== undefined && !chain.operationsEnabled) {
      return yield* new EvmExecutionError({
        code: "NETWORK_PAUSED",
        cause: new Error("New operations on this network are paused"),
      });
    }
    if (chain === undefined) {
      return yield* new UnsupportedChainError({
        namespace: "eip155",
        chainId: input.prepared.chainId,
      });
    }

    const account = yield* reconstructExecutionAccount(
      input,
      chain,
      getClients(chain).publicClient,
    );
    const encodedCalls = yield* Effect.tryPromise({
      try: () => account.encodeCalls(input.prepared.context.calls),
      catch: (cause) => new EvmExecutionError({ code: "SIGNING_FAILED", cause }),
    });
    const contextGas = input.prepared.context.userOperation.gas;
    const operation = input.prepared.userOperation;
    if (input.session !== undefined) {
      const nonceKey =
        (BigInt(input.session.authorization.entityId) << 8n) | (input.session.isGlobal ? 1n : 0n);
      // Viem allocates a parallel lane in the upper 152 bits of the nonce key.
      // The lower 40 bits select the validation entity and flags, not the lane.
      if (
        ((operation.nonce >> 64n) & ((1n << 40n) - 1n)) !== nonceKey ||
        operation.factory !== undefined ||
        operation.factoryData !== undefined ||
        operation.authorization !== undefined
      ) {
        return yield* new EvmExecutionError({
          code: "SIGNING_FAILED",
          cause: new Error("Prepared operation does not select the stored session validator"),
        });
      }
    }
    if (
      input.prepared.context.chainId !== input.prepared.chainId ||
      input.prepared.context.account.toLowerCase() !== account.address.toLowerCase() ||
      operation.sender.toLowerCase() !== account.address.toLowerCase() ||
      input.prepared.entryPoint.toLowerCase() !== account.entryPoint.address.toLowerCase() ||
      input.prepared.entryPointVersion !== account.entryPoint.version ||
      operation.callData.toLowerCase() !== encodedCalls.toLowerCase() ||
      input.prepared.context.userOperation.nonce !== operation.nonce ||
      contextGas.callGasLimit !== operation.callGasLimit ||
      contextGas.verificationGasLimit !== operation.verificationGasLimit ||
      contextGas.preVerificationGas !== operation.preVerificationGas ||
      contextGas.paymasterVerificationGasLimit !==
        (operation.paymasterVerificationGasLimit ?? 0n) ||
      contextGas.paymasterPostOpGasLimit !== (operation.paymasterPostOpGasLimit ?? 0n) ||
      contextGas.maxFeePerGas !== operation.maxFeePerGas ||
      contextGas.maxPriorityFeePerGas !== operation.maxPriorityFeePerGas ||
      (input.prepared.context.userOperation.paymaster ?? "").toLowerCase() !==
        (operation.paymaster ?? "").toLowerCase()
    ) {
      return yield* new EvmExecutionError({
        code: "SIGNING_FAILED",
        cause: new Error("The prepared execution does not match the reconstructed account"),
      });
    }

    return { account, chain, userOperation: toViemUserOperation(operation) };
  });
