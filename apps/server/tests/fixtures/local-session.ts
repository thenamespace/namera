import { createECDH } from "node:crypto";

import { DateTime, Effect } from "effect";

import { Hex, type SupportedEvmChainId } from "@namera-ai/protocol";

import type { TestApiClient } from "./api.js";

/** Registers public-only fixtures; it does not simulate owner approval or activation. */
export const registerPendingLocalSession = Effect.fn("test.registerPendingLocalSession")(function* (
  client: TestApiClient,
  chains: ReadonlyArray<SupportedEvmChainId> = ["eip155:11155111", "eip155:84532"],
) {
  const registration = yield* client.wallet.createPasskeyRegistrationOptions();
  const wallet = yield* client.wallet.create({
    payload: {
      namespace: "eip155",
      metadata: { version: 1, name: "Passkey wallet" },
      owner: {
        type: "passkey",
        verificationId: registration.verificationId,
        response: {
          id: "test-passkey",
          rawId: "test-passkey",
          type: "public-key",
          response: {
            clientDataJSON: "dGVzdA",
            attestationObject: "dGVzdA",
            transports: ["internal"],
          },
          clientExtensionResults: {},
        },
      },
    },
  });
  const signer = createECDH("secp256k1");
  signer.generateKeys();
  const now = Math.floor(DateTime.toEpochSeconds(yield* DateTime.now));
  const request = {
    namespace: "eip155" as const,
    walletId: wallet.id,
    metadata: { version: 1 as const, name: "Local agent" },
    signer: {
      custody: "local" as const,
      algorithm: "secp256k1" as const,
      publicKey: Hex.make(`0x${signer.getPublicKey("hex", "uncompressed")}`),
    },
    onchain: {
      chains,
      validAfter: now,
      validUntil: now + 3600,
      permissions: [{ type: "root" as const }],
    },
    policies: [],
  };
  return { wallet, request, session: yield* client.sessionKey.create({ payload: request }) };
});
