import { DateTime, Schema } from "effect";

import {
  SessionKeyResponse,
  WalletResponse,
  type CreateEvmSessionKeyRequest,
} from "@namera-ai/protocol/dto";
import { publicKeyToAddress } from "viem/accounts";

import { actor } from "./actor";
import { managedWallet } from "./wallet-transaction";

export const olderSessionAccount = Schema.decodeUnknownSync(Schema.toType(WalletResponse))({
  ...managedWallet,
  metadata: { version: 1, name: "Older account" },
  createdAt: DateTime.makeUnsafe("2026-10-01T00:00:00Z"),
});

export const newestSessionAccount = Schema.decodeUnknownSync(Schema.toType(WalletResponse))({
  ...managedWallet,
  id: "01950000-0000-7000-8000-000000000005",
  metadata: { version: 1, name: "Newest account" },
  createdAt: DateTime.makeUnsafe("2026-10-02T00:00:00Z"),
});

export const frozenSessionAccount = Schema.decodeUnknownSync(Schema.toType(WalletResponse))({
  ...managedWallet,
  id: "01950000-0000-7000-8000-000000000006",
  metadata: { version: 1, name: "Frozen account" },
  status: "frozen",
  createdAt: DateTime.makeUnsafe("2026-10-03T00:00:00Z"),
});

export const sessionPresetAccounts = [
  olderSessionAccount,
  frozenSessionAccount,
  newestSessionAccount,
];

// Public secp256k1 generator point; this fixture never holds a private key.
const publicKey =
  "0x0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8";

export function registeredPresetSession(request: CreateEvmSessionKeyRequest): SessionKeyResponse {
  return Schema.decodeUnknownSync(Schema.toType(SessionKeyResponse))({
    id: "01950000-0000-7000-8000-000000000013",
    organizationId: newestSessionAccount.organizationId,
    walletId: request.walletId,
    signingKeyId: "01950000-0000-7000-8000-000000000014",
    namespace: request.namespace,
    metadata: request.metadata,
    policies: request.policies.map((policy) => ({
      ...policy,
      id: "01950000-0000-7000-8000-000000000015",
      appliesTo: "signature",
    })),
    policyHash: "onboarding-policy",
    status: "pending",
    revokedAt: null,
    createdAt: newestSessionAccount.createdAt,
    signer: { ...request.signer, publicKey },
    wallet: sessionPresetAccounts.find((account) => account.id === request.walletId),
    creator: actor.member,
    installations: request.onchain.installations.map((installation) => ({
      id: "01950000-0000-7000-8000-000000000016",
      chainId: installation.chainId,
      status: "pending",
      authorization: {
        version: 1,
        entityId: 7,
        signerAddress: publicKeyToAddress(publicKey),
        ...installation,
      },
      installTransactionHash: null,
      uninstallTransactionHash: null,
    })),
  });
}
