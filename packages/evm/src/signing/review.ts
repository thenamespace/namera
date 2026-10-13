import * as Base64Url from "effect/encoding/Base64Url";

import { hashMessage, hashTypedData, hexToBytes, type Address } from "viem";

import { replaySafeTypedData } from "../accounts/alchemy-modular-v2.js";

/** Independently bind an owner WebAuthn prompt to the reviewed message and account. */
export function ownerMessageChallenge(accountAddress: Address, chainId: number, message: string) {
  return Base64Url.encode(
    hexToBytes(
      hashTypedData(replaySafeTypedData({ accountAddress, chainId, hash: hashMessage(message) })),
    ),
  );
}
