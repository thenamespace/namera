import { DateTime, Schema } from "effect";

import { encodeCallsMAv2, EXECUTE_USER_OP_SELECTOR } from "@alchemy/smart-accounts";
import type { PrepareExecutionRequest, PrepareExecutionResponse } from "@namera-ai/protocol/dto";
import type { LocalEvmSessionBinding } from "@namera-ai/protocol/local";
import { concatHex, isAddressEqual } from "viem";
import { entryPoint07Address, getUserOperationHash } from "viem/account-abstraction";

export type { LocalEvmSessionBinding } from "@namera-ai/protocol/local";

export class LocalExecutionValidationError extends Schema.TaggedError<LocalExecutionValidationError>()(
  "LocalExecutionValidationError",
  {
    reason: Schema.Literals([
      "identity",
      "expiry",
      "validator",
      "calls",
      "sponsorship",
      "gas",
      "hash",
    ]),
  },
) {}

export const validateLocalExecution = ({
  request,
  response,
  binding,
  now,
  maxGasCostWei,
}: {
  readonly request: PrepareExecutionRequest;
  readonly response: PrepareExecutionResponse;
  readonly binding: LocalEvmSessionBinding;
  readonly now: DateTime.Utc;
  /** Required for self-funded operations; comes from local caller consent. */
  readonly maxGasCostWei?: bigint;
}) => {
  const { prepared } = response;
  const operation = prepared.userOperation;
  if (
    request.walletId !== binding.walletId ||
    request.sessionKeyId !== binding.sessionKeyId ||
    request.chainId !== binding.chainId ||
    response.sessionKeyId !== binding.sessionKeyId ||
    response.signingKeyId !== binding.signingKeyId ||
    response.installationId !== binding.installationId ||
    prepared.chainId !== binding.chainId ||
    prepared.context.chainId !== binding.chainId ||
    !isAddressEqual(operation.sender, binding.walletAddress) ||
    !isAddressEqual(prepared.context.account, binding.walletAddress) ||
    !isAddressEqual(prepared.entryPoint, entryPoint07Address) ||
    prepared.entryPointVersion !== "0.7"
  )
    throw new LocalExecutionValidationError({ reason: "identity" });

  if (
    DateTime.toEpochMillis(now) < DateTime.toEpochMillis(binding.validAfter) ||
    DateTime.toEpochMillis(now) >= DateTime.toEpochMillis(binding.validUntil) ||
    DateTime.toEpochMillis(now) >= DateTime.toEpochMillis(response.expiresAt) ||
    DateTime.toEpochMillis(response.expiresAt) > DateTime.toEpochMillis(binding.validUntil)
  )
    throw new LocalExecutionValidationError({ reason: "expiry" });

  const nonceKey = (BigInt(binding.entityId) << 8n) | (binding.isGlobal ? 1n : 0n);
  if (
    ((operation.nonce >> 64n) & ((1n << 40n) - 1n)) !== nonceKey ||
    operation.factory !== undefined ||
    operation.factoryData !== undefined ||
    operation.authorization !== undefined
  )
    throw new LocalExecutionValidationError({ reason: "validator" });

  const firstCall = request.calls[0];
  const isSelfCall =
    request.calls.length === 1 &&
    firstCall !== undefined &&
    isAddressEqual(firstCall.to, binding.walletAddress);
  // Alchemy encodes self-calls directly, without an execute(value) wrapper.
  // Refuse a value that cannot actually be represented by that encoding.
  if (isSelfCall && firstCall.value !== 0n)
    throw new LocalExecutionValidationError({ reason: "calls" });
  const encoded = isSelfCall ? firstCall.data : encodeCallsMAv2(request.calls);
  const expectedCallData = binding.hasExecutionHooks
    ? concatHex([EXECUTE_USER_OP_SELECTOR, encoded])
    : encoded;
  if (
    operation.callData.toLowerCase() !== expectedCallData.toLowerCase() ||
    prepared.context.calls.length !== request.calls.length ||
    prepared.context.calls.some((call, index) => {
      const expected = request.calls[index];
      return (
        expected === undefined ||
        !isAddressEqual(call.to, expected.to) ||
        call.value !== expected.value ||
        call.data.toLowerCase() !== expected.data.toLowerCase()
      );
    })
  )
    throw new LocalExecutionValidationError({ reason: "calls" });

  const sponsored = request.sponsor !== false;
  if (
    prepared.sponsorship !== (sponsored ? "alchemy-bso" : "none") ||
    operation.paymaster !== undefined ||
    operation.paymasterData !== undefined ||
    operation.paymasterVerificationGasLimit !== undefined ||
    operation.paymasterPostOpGasLimit !== undefined ||
    (sponsored &&
      (operation.maxFeePerGas !== 0n ||
        operation.maxPriorityFeePerGas !== 0n ||
        operation.preVerificationGas !== 0n))
  )
    throw new LocalExecutionValidationError({ reason: "sponsorship" });

  const maxGasCost =
    (operation.callGasLimit + operation.verificationGasLimit + operation.preVerificationGas) *
    operation.maxFeePerGas;
  if (
    operation.maxPriorityFeePerGas > operation.maxFeePerGas ||
    (!sponsored &&
      (maxGasCostWei === undefined || maxGasCostWei < 0n || maxGasCost > maxGasCostWei))
  )
    throw new LocalExecutionValidationError({ reason: "gas" });

  const message = getUserOperationHash({
    userOperation: operation,
    chainId: Number(binding.chainId.slice("eip155:".length)),
    entryPointAddress: entryPoint07Address,
    entryPointVersion: "0.7",
  });
  if (message.toLowerCase() !== response.signing.message.toLowerCase()) {
    throw new LocalExecutionValidationError({ reason: "hash" });
  }
  return message;
};
