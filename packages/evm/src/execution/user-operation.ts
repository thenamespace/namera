import { Effect, Schema } from "effect";

import {
  EvmExecutionError,
  type EvmExecutionSponsorship,
  EvmSerializedUserOperation,
  type EvmSerializedUserOperation as EvmSerializedUserOperationType,
} from "@namera-ai/protocol";
import type { UserOperation } from "viem/account-abstraction";

export const applyEvmExecutionSponsorship = (
  userOperation: UserOperation<"0.7">,
  sponsorship: EvmExecutionSponsorship,
): UserOperation<"0.7"> => {
  if (sponsorship === "none") return userOperation;

  const {
    paymaster: _paymaster,
    paymasterData: _paymasterData,
    paymasterPostOpGasLimit: _paymasterPostOpGasLimit,
    paymasterVerificationGasLimit: _paymasterVerificationGasLimit,
    ...operation
  } = userOperation;

  return {
    ...operation,
    maxFeePerGas: 0n,
    maxPriorityFeePerGas: 0n,
    preVerificationGas: 0n,
  };
};

export const toViemUserOperation = (
  userOperation: EvmSerializedUserOperationType,
): UserOperation<"0.7"> => ({
  sender: userOperation.sender,
  nonce: userOperation.nonce,
  ...(userOperation.factory === undefined ? {} : { factory: userOperation.factory }),
  ...(userOperation.factoryData === undefined ? {} : { factoryData: userOperation.factoryData }),
  callData: userOperation.callData,
  callGasLimit: userOperation.callGasLimit,
  verificationGasLimit: userOperation.verificationGasLimit,
  preVerificationGas: userOperation.preVerificationGas,
  maxFeePerGas: userOperation.maxFeePerGas,
  maxPriorityFeePerGas: userOperation.maxPriorityFeePerGas,
  ...(userOperation.paymaster === undefined ? {} : { paymaster: userOperation.paymaster }),
  ...(userOperation.paymasterVerificationGasLimit === undefined
    ? {}
    : { paymasterVerificationGasLimit: userOperation.paymasterVerificationGasLimit }),
  ...(userOperation.paymasterPostOpGasLimit === undefined
    ? {}
    : { paymasterPostOpGasLimit: userOperation.paymasterPostOpGasLimit }),
  ...(userOperation.paymasterData === undefined
    ? {}
    : { paymasterData: userOperation.paymasterData }),
  signature: userOperation.signature,
  ...(userOperation.authorization === undefined
    ? {}
    : { authorization: userOperation.authorization }),
});

export const normalizeEvmUserOperation = Effect.fn("evm.execution.normalizeUserOperation")(
  function* (userOperation: UserOperation<"0.7">) {
    return yield* Schema.decodeUnknownEffect(EvmSerializedUserOperation)({
      sender: userOperation.sender,
      nonce: userOperation.nonce.toString(),
      ...(userOperation.factory === undefined ? {} : { factory: userOperation.factory }),
      ...(userOperation.factoryData === undefined
        ? {}
        : { factoryData: userOperation.factoryData }),
      callData: userOperation.callData,
      callGasLimit: userOperation.callGasLimit.toString(),
      verificationGasLimit: userOperation.verificationGasLimit.toString(),
      preVerificationGas: userOperation.preVerificationGas.toString(),
      maxFeePerGas: userOperation.maxFeePerGas.toString(),
      maxPriorityFeePerGas: userOperation.maxPriorityFeePerGas.toString(),
      ...(userOperation.paymaster === undefined ? {} : { paymaster: userOperation.paymaster }),
      ...(userOperation.paymasterVerificationGasLimit === undefined
        ? {}
        : {
            paymasterVerificationGasLimit: userOperation.paymasterVerificationGasLimit.toString(),
          }),
      ...(userOperation.paymasterPostOpGasLimit === undefined
        ? {}
        : { paymasterPostOpGasLimit: userOperation.paymasterPostOpGasLimit.toString() }),
      ...(userOperation.paymasterData === undefined
        ? {}
        : { paymasterData: userOperation.paymasterData }),
      signature: userOperation.signature,
      ...(userOperation.authorization === undefined
        ? {}
        : { authorization: userOperation.authorization }),
    }).pipe(
      Effect.mapError((cause) => new EvmExecutionError({ code: "PREPARATION_FAILED", cause })),
    );
  },
);
