import { DateTime, Encoding, Schema } from "effect";

import type { PrepareSessionKeyOperationResponse } from "@namera-ai/protocol/dto";
import { hashMessage, hexToBytes, isAddressEqual, type Address, type Hex } from "viem";
import { entryPoint07Address, getUserOperationHash } from "viem/account-abstraction";

export class OwnerApprovalValidationError extends Schema.TaggedError<OwnerApprovalValidationError>()(
  "OwnerApprovalValidationError",
  { reason: Schema.Literals(["identity", "expiry", "validator", "calls", "gas", "challenge"]) },
) {}

/** Locally reconstructed owner and compiled action, never copied from preparation. */
export type ReviewedOwnerOperation = {
  readonly chainId: PrepareSessionKeyOperationResponse["prepared"]["chainId"];
  readonly walletAddress: Address;
  readonly ownerEntityId: number;
  readonly callData: Hex;
  readonly factory: Address;
  readonly factoryData: Hex;
  readonly credentialId: string;
  readonly rpId: string;
  readonly sponsor: boolean;
  readonly maxGasCostWei?: bigint;
};

/** Validate decoded transport data before opening the authenticator prompt. */
export const validateOwnerApproval = ({
  reviewed,
  response,
  now,
}: {
  readonly reviewed: ReviewedOwnerOperation;
  readonly response: PrepareSessionKeyOperationResponse;
  readonly now: DateTime.Utc;
}) => {
  const { prepared, options } = response;
  const operation = prepared.userOperation;
  if (
    prepared.chainId !== reviewed.chainId ||
    prepared.context.chainId !== reviewed.chainId ||
    !isAddressEqual(operation.sender, reviewed.walletAddress) ||
    !isAddressEqual(prepared.context.account, reviewed.walletAddress) ||
    !isAddressEqual(prepared.entryPoint, entryPoint07Address) ||
    prepared.entryPointVersion !== "0.7"
  )
    throw new OwnerApprovalValidationError({ reason: "identity" });

  if (DateTime.toEpochMillis(now) >= DateTime.toEpochMillis(response.expiresAt))
    throw new OwnerApprovalValidationError({ reason: "expiry" });

  const ownerNonceKey = (BigInt(reviewed.ownerEntityId) << 8n) | 1n;
  const hasFactory = operation.factory !== undefined || operation.factoryData !== undefined;
  if (
    ((operation.nonce >> 64n) & ((1n << 40n) - 1n)) !== ownerNonceKey ||
    operation.authorization !== undefined ||
    (hasFactory &&
      (operation.factory === undefined ||
        !isAddressEqual(operation.factory, reviewed.factory) ||
        operation.factoryData?.toLowerCase() !== reviewed.factoryData.toLowerCase()))
  )
    throw new OwnerApprovalValidationError({ reason: "validator" });

  // Modular Account encodes a single self-call directly, without a value wrapper.
  const call = prepared.context.calls[0];
  if (
    operation.callData.toLowerCase() !== reviewed.callData.toLowerCase() ||
    prepared.context.calls.length !== 1 ||
    call === undefined ||
    !isAddressEqual(call.to, reviewed.walletAddress) ||
    call.value !== 0n ||
    call.data.toLowerCase() !== reviewed.callData.toLowerCase()
  )
    throw new OwnerApprovalValidationError({ reason: "calls" });

  const maxGasCost =
    (operation.callGasLimit + operation.verificationGasLimit + operation.preVerificationGas) *
    operation.maxFeePerGas;
  if (
    prepared.sponsorship !== (reviewed.sponsor ? "alchemy-bso" : "none") ||
    operation.paymaster !== undefined ||
    operation.paymasterData !== undefined ||
    operation.paymasterVerificationGasLimit !== undefined ||
    operation.paymasterPostOpGasLimit !== undefined ||
    operation.maxPriorityFeePerGas > operation.maxFeePerGas ||
    (reviewed.sponsor &&
      (operation.maxFeePerGas !== 0n ||
        operation.maxPriorityFeePerGas !== 0n ||
        operation.preVerificationGas !== 0n)) ||
    (!reviewed.sponsor &&
      (reviewed.maxGasCostWei === undefined ||
        reviewed.maxGasCostWei < 0n ||
        maxGasCost > reviewed.maxGasCostWei))
  )
    throw new OwnerApprovalValidationError({ reason: "gas" });

  const hash = getUserOperationHash({
    userOperation: operation,
    chainId: Number(reviewed.chainId.slice("eip155:".length)),
    entryPointAddress: entryPoint07Address,
    entryPointVersion: "0.7",
  });
  const challenge = Encoding.encodeBase64Url(hexToBytes(hashMessage({ raw: hash })));
  if (
    options.challenge !== challenge ||
    options.rpId !== reviewed.rpId ||
    options.userVerification !== "required" ||
    options.allowCredentials.length !== 1 ||
    options.allowCredentials[0]?.id !== reviewed.credentialId
  )
    throw new OwnerApprovalValidationError({ reason: "challenge" });
  return hash;
};
