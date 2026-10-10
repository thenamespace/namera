import { DateTime } from "effect";

import { DefaultModuleAddress, toReplaySafeTypedData } from "@alchemy/smart-accounts";
import type { PrepareSignatureRequest, PrepareSignatureResponse } from "@namera-ai/protocol/dto";
import type { LocalEvmSessionBinding } from "@namera-ai/protocol/local";
import { concatHex, hashMessage, hashTypedData, type TypedDataDefinition } from "viem";

const digest = (payload: PrepareSignatureRequest) =>
  payload.type === "message"
    ? hashMessage(payload.message)
    : hashTypedData(payload.typedData as unknown as TypedDataDefinition);

/** Construct the challenge from trusted local authority, never from server-supplied signing data. */
export const validateLocalSignature = ({
  request,
  response,
  binding,
  now,
}: {
  readonly request: PrepareSignatureRequest;
  readonly response: PrepareSignatureResponse;
  readonly binding: LocalEvmSessionBinding;
  readonly now: DateTime.Utc;
}) => {
  if (
    response.signing.method !== "eth_signTypedData_v4" ||
    binding.allowSignatures !== true ||
    request.walletId !== binding.walletId ||
    request.sessionKeyId !== binding.sessionKeyId ||
    request.chainId !== binding.chainId ||
    response.installationId !== binding.installationId ||
    response.signingKeyId !== binding.signingKeyId ||
    response.request.walletId !== request.walletId ||
    response.request.sessionKeyId !== request.sessionKeyId ||
    response.request.chainId !== request.chainId ||
    response.request.type !== request.type ||
    DateTime.toEpochMillis(now) < DateTime.toEpochMillis(binding.validAfter) ||
    DateTime.toEpochMillis(now) >= DateTime.toEpochMillis(binding.validUntil) ||
    DateTime.toEpochMillis(now) >= DateTime.toEpochMillis(response.expiresAt) ||
    DateTime.toEpochMillis(response.expiresAt) > DateTime.toEpochMillis(binding.validUntil)
  )
    throw new Error("Signature preparation does not match local authority");

  const hash = digest(request);
  if (digest(response.request) !== hash) throw new Error("Signature payload changed");
  const challenge = toReplaySafeTypedData({
    address: DefaultModuleAddress.SINGLE_SIGNER_VALIDATION,
    chainId: Number(binding.chainId.slice("eip155:".length)),
    hash,
    salt: concatHex([`0x${"00".repeat(12)}`, binding.walletAddress]),
  });
  if (
    hashTypedData(challenge) !==
    hashTypedData(response.signing.typedData as unknown as TypedDataDefinition)
  )
    throw new Error("Signature challenge changed");
  return challenge;
};
