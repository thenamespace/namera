import { DateTime, Schema } from "effect";

import { PrepareSignatureRequest, PrepareSignatureResponse } from "@namera-ai/protocol/dto";
import { LocalEvmSessionBinding } from "@namera-ai/protocol/local";
import { concatHex, hashMessage, toHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/** Independent wire fixture for Alchemy's replay-safe hash and ERC-1271 envelope. */
export const mcpSignatureFixture = (privateKey = generatePrivateKey()) => {
  const account = privateKeyToAccount(privateKey);
  const id = "01a00407-5961-75cf-933e-9cfd0336ec16";
  const sessionKeyId = "01a00407-5961-75cf-933e-9cfd0336ec17";
  const now = DateTime.nowUnsafe();
  const binding = Schema.decodeUnknownSync(LocalEvmSessionBinding)({
    walletId: id,
    sessionKeyId,
    signingKeyId: id,
    installationId: id,
    walletAddress: "0x1111111111111111111111111111111111111111",
    signerAddress: account.address,
    chainId: "eip155:1",
    entityId: 7,
    isGlobal: true,
    hasExecutionHooks: false,
    allowSignatures: true,
    validAfter: DateTime.formatIso(DateTime.subtract(now, { minutes: 1 })),
    validUntil: DateTime.formatIso(DateTime.add(now, { hours: 1 })),
  });
  const request = Schema.decodeUnknownSync(PrepareSignatureRequest)({
    namespace: "eip155",
    walletId: id,
    sessionKeyId,
    chainId: binding.chainId,
    type: "message",
    message: "Approve only this message",
  });
  const response = Schema.decodeUnknownSync(PrepareSignatureResponse)({
    namespace: "eip155",
    operationId: id,
    installationId: id,
    signingKeyId: id,
    request: Schema.encodeSync(PrepareSignatureRequest)(request),
    signing: {
      method: "eth_signTypedData_v4",
      typedData: {
        domain: {
          chainId: 1,
          verifyingContract: "0x00000000000099DE0BF6fA90dEB851E2A2df7d83",
          salt: concatHex([`0x${"00".repeat(12)}`, binding.walletAddress]),
        },
        types: { ReplaySafeHash: [{ name: "hash", type: "bytes32" }] },
        primaryType: "ReplaySafeHash",
        message: { hash: hashMessage("Approve only this message") },
      },
    },
    expiresAt: DateTime.toDateUtc(DateTime.add(now, { minutes: 5 })),
  });
  const grants = [
    {
      grant: {
        id,
        organizationId: id,
        actorId: id,
        sessionKeyId,
        grantedByActorId: id,
        revokedAt: null,
        revokedByActorId: null,
        createdAt: DateTime.toDateUtc(now),
      },
      sessionKey: {
        id: sessionKeyId,
        organizationId: id,
        walletId: id,
        signingKeyId: id,
        createdByActorId: id,
        metadata: { version: 1, name: "Local test session" },
        policyHash: "test",
        namespace: "eip155",
        policies: [],
        status: "active",
        revokedAt: null,
        revokedByActorId: null,
        createdAt: DateTime.toDateUtc(now),
      },
    },
  ];
  const complete = (signature: `0x${string}`) => ({
    namespace: "eip155",
    walletId: id,
    chainId: binding.chainId,
    account: binding.walletAddress,
    type: "message",
    signature: concatHex(["0x00", toHex(7, { size: 4 }), "0xff00", signature]),
  });
  if (response.signing.method !== "eth_signTypedData_v4")
    throw new Error("Expected local challenge");
  return {
    account,
    binding,
    request,
    response: { ...response, signing: response.signing },
    grants,
    complete,
  };
};
