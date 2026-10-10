import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export const operationWallet = {
  id: "01950000-0000-7000-8000-000000000001",
  organizationId: "01950000-0000-7000-8000-000000000002",
  namespace: "eip155",
  status: "active",
  implementation: "alchemy-modular-v2",
  metadata: { version: 1, name: "Trading Account", logo: { type: "emoji", value: "💳" } },
  address: `0x${"11".repeat(20)}`,
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
    entityId: 1,
  },
  createdAt: "2026-09-15T12:00:00.000Z",
  updatedAt: "2026-09-15T12:00:00.000Z",
};

export const operationKey = {
  signer: {
    custody: "local",
    algorithm: "secp256k1",
    publicKey: privateKeyToAccount(generatePrivateKey()).publicKey,
  },
  id: "01950000-0000-7000-8000-000000000005",
  organizationId: operationWallet.organizationId,
  walletId: operationWallet.id,
  signingKeyId: operationWallet.owner.signingKeyId,
  namespace: "eip155",
  metadata: { version: 1, name: "Trading key" },
  status: "active",
  policies: [],
  policyHash: "test-policy-hash",
  revokedAt: null,
  createdAt: operationWallet.createdAt,
  wallet: operationWallet,
  creator: {
    organizationMember: {
      id: operationWallet.id,
      userId: operationWallet.id,
      organizationId: operationWallet.organizationId,
      organizationRoleId: operationWallet.id,
      joinedAt: operationWallet.createdAt,
    },
    user: {
      id: operationWallet.id,
      email: "cli-test@example.com",
      emailVerified: true,
      metadata: { version: 1, name: "CLI tester" },
      lastLoginAt: null,
    },
    organizationRole: {
      id: operationWallet.id,
      key: "tester",
      metadata: { version: 1, name: "Tester" },
      type: "custom",
      permissions: [],
      systemRoleId: null,
    },
  },
  installations: [],
};

export const simulation = {
  namespace: "eip155",
  walletId: operationWallet.id,
  sessionKeyId: operationKey.id,
  chainId: "eip155:8453",
  account: operationWallet.address,
  callsSucceeded: true,
  allowed: true,
  simulation: {
    userOperation: {
      source: "eth_estimateUserOperationGas",
      callGasLimit: "1",
      verificationGasLimit: "1",
      preVerificationGas: "1",
      maxFeePerGas: "1",
      maxPriorityFeePerGas: "1",
    },
    calls: {
      source: "viem.simulateCalls",
      results: [{ status: "success", returnData: "0x", gasUsed: "1" }],
      assetChanges: [],
      transfers: [],
    },
  },
};
