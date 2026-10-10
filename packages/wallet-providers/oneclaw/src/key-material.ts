import { Effect } from "effect";

import type { OneClawOperation } from "@namera-ai/protocol";
import * as Secp256k1 from "ox/Secp256k1";
import { hexToBytes, recoverPublicKey, type Hex } from "viem";
import { publicKeyToAddress } from "viem/accounts";

import { oneClawError } from "#/errors";
import type { KeyResponse, SignResponse } from "#/responses";

export interface EthereumKey {
  readonly id: string;
  readonly agentId: string;
  readonly chain: "ethereum";
  readonly curve: "secp256k1";
  readonly publicKey: Hex;
  readonly address: Hex;
  readonly version: number;
}

export const validateKey = Effect.fnUntraced(function* (
  operation: OneClawOperation,
  agentId: string,
  key: typeof KeyResponse.Type,
) {
  if (
    key.agent_id !== agentId ||
    !key.is_active ||
    key.chain !== "ethereum" ||
    key.curve !== "secp256k1" ||
    key.custody === "client_tss"
  ) {
    return yield* oneClawError(operation, "KEY_MISMATCH");
  }
  // 1Claw returns an uncompressed SEC1 public key, sometimes without 0x.
  const prefixed = key.public_key.startsWith("0x") ? key.public_key : `0x${key.public_key}`;
  if (!/^0x04[0-9a-fA-F]{128}$/.test(prefixed) || !/^0x[0-9a-fA-F]{40}$/.test(key.address)) {
    return yield* oneClawError(operation, "INVALID_RESPONSE");
  }
  const publicKey = prefixed as Hex;
  const address = yield* Effect.try({
    try: () => {
      Secp256k1.noble.Point.fromHex(publicKey.slice(2)).assertValidity();
      return publicKeyToAddress(publicKey);
    },
    catch: () => oneClawError(operation, "INVALID_RESPONSE"),
  });
  if (address.toLowerCase() !== key.address.toLowerCase())
    return yield* oneClawError(operation, "KEY_MISMATCH");
  return {
    id: key.id,
    agentId,
    chain: "ethereum",
    curve: "secp256k1",
    publicKey,
    address,
    version: key.key_version,
  } satisfies EthereumKey;
});

export const verifyDigestSignature = Effect.fnUntraced(function* (
  key: EthereumKey,
  digest: Hex,
  response: typeof SignResponse.Type,
) {
  const operation = "signing.signDigest";
  if (!/^0x[0-9a-fA-F]{130}$/.test(response.signature))
    return yield* oneClawError(operation, "INVALID_RESPONSE");
  if (
    response.from.toLowerCase() !== key.address.toLowerCase() ||
    response.typed_data_hash.toLowerCase() !== digest.toLowerCase()
  ) {
    return yield* oneClawError(operation, "KEY_MISMATCH");
  }
  const signature = response.signature as Hex;
  const recovery = Number.parseInt(signature.slice(-2), 16);
  if (![0, 1, 27, 28].includes(recovery)) return yield* oneClawError(operation, "INVALID_RESPONSE");
  const recovered = yield* Effect.tryPromise({
    try: () => recoverPublicKey({ hash: digest, signature }),
    catch: () => oneClawError(operation, "INVALID_RESPONSE"),
  });
  if (recovered.toLowerCase() !== key.publicKey.toLowerCase())
    return yield* oneClawError(operation, "KEY_MISMATCH");
  return hexToBytes(signature);
});
