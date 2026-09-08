import { createECDH } from "node:crypto";

import { DateTime, Effect } from "effect";

import { Hex, type SupportedEvmChainId, type WalletId } from "@namera-ai/protocol";

import type { TestApiClient } from "./api.js";

export const createTestPasskeyWallet = Effect.fn("test.createPasskeyWallet")(function* (
  client: TestApiClient,
  name = "Passkey wallet",
) {
  const registration = yield* client.wallet.createPasskeyRegistrationOptions();
  return yield* client.wallet.create({
    payload: {
      namespace: "eip155",
      metadata: { version: 1, name },
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
});

export const localSessionRequest = Effect.fn("test.localSessionRequest")(function* (
  walletId: WalletId,
  chains: ReadonlyArray<SupportedEvmChainId> = ["eip155:1"],
) {
  const signer = createECDH("secp256k1");
  signer.generateKeys();
  const now = Math.floor(DateTime.toEpochSeconds(yield* DateTime.now));
  return {
    namespace: "eip155" as const,
    walletId,
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
});

/** Registers public-only fixtures; it does not simulate owner approval or activation. */
export const registerPendingLocalSession = Effect.fn("test.registerPendingLocalSession")(function* (
  client: TestApiClient,
  chains: ReadonlyArray<SupportedEvmChainId> = ["eip155:11155111", "eip155:84532"],
) {
  const wallet = yield* createTestPasskeyWallet(client);
  const request = yield* localSessionRequest(wallet.id, chains);
  return { wallet, request, session: yield* client.sessionKey.create({ payload: request }) };
});
