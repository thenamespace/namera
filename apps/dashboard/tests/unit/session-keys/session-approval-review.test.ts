import { Schema } from "effect";

import {
  GetWalletPasskeyOwnerResponse,
  SessionKeyInstallationResponse,
  WalletResponse,
} from "@namera-ai/protocol/dto";
import { describe, expect, it } from "vitest";

const wallet = Schema.decodeUnknownSync(WalletResponse)({
  id: "01950000-0000-7000-8000-000000000001",
  organizationId: "01950000-0000-7000-8000-000000000002",
  namespace: "eip155",
  implementation: "alchemy-modular-v2",
  address: `0x${"11".repeat(20)}`,
  metadata: { version: 1, name: "Review account" },
  status: "active",
  owner: {
    signingKeyId: "01950000-0000-7000-8000-000000000003",
    custody: "local",
    algorithm: "p256",
  },
  data: {
    version: 1,
    modularAccountVersion: "2.0.0",
    validatorType: "webauthn_p256",
    entryPointVersion: "0.7",
    salt: "0",
    entityId: 0,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
});
const installation = Schema.decodeUnknownSync(SessionKeyInstallationResponse)({
  id: "01950000-0000-7000-8000-000000000004",
  chainId: "eip155:11155111",
  status: "pending",
  authorization: {
    version: 1,
    entityId: 7,
    signerAddress: `0x${"22".repeat(20)}`,
    validAfter: 0,
    validUntil: 2_000_000_000,
    permissions: [{ type: "root" }],
    allowSignatures: false,
  },
  installTransactionHash: null,
  uninstallTransactionHash: null,
});
const descriptor = Schema.decodeUnknownSync(GetWalletPasskeyOwnerResponse)({
  walletId: wallet.id,
  owner: {
    signingKeyId: wallet.owner.signingKeyId,
    publicKeyHex: `0x04${"11".repeat(64)}`,
    credentialId: "dGVzdA",
    rpId: "localhost",
  },
});

describe("browser approval owner binding", () => {
  it("rejects another account's descriptor before RPC or a passkey prompt", async () => {
    const { reviewSessionInstallation } =
      await import("../../../src/components/session-key-installations/review");
    const foreign = Schema.decodeUnknownSync(GetWalletPasskeyOwnerResponse)({
      ...descriptor,
      walletId: "01950000-0000-7000-8000-000000000009",
    });
    await expect(
      reviewSessionInstallation(
        wallet,
        installation,
        foreign,
        "install",
        new AbortController().signal,
        "http://localhost:8080",
      ),
    ).rejects.toThrow("Passkey owner does not match");
  });

  it("rejects a missing or substituted owner key before RPC or a passkey prompt", async () => {
    const { reviewSessionInstallation } =
      await import("../../../src/components/session-key-installations/review");
    await Promise.all(
      [null, { ...descriptor.owner, signingKeyId: "01950000-0000-7000-8000-000000000009" }].map(
        async (owner) => {
          const substituted = Schema.decodeUnknownSync(GetWalletPasskeyOwnerResponse)({
            walletId: wallet.id,
            owner,
          });
          await expect(
            reviewSessionInstallation(
              wallet,
              installation,
              substituted,
              "install",
              new AbortController().signal,
              "http://localhost:8080",
            ),
          ).rejects.toThrow("Passkey owner does not match");
        },
      ),
    );
  });
});
