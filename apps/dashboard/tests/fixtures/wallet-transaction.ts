import { Schema } from "effect";

import { PrepareWalletTransactionResponse, WalletResponse } from "@namera-ai/protocol/dto";
import { entryPoint07Address } from "viem/account-abstraction";

const address = `0x${"11".repeat(20)}`;
const gas = {
  callGasLimit: "100000",
  verificationGasLimit: "200000",
  preVerificationGas: "0",
  maxFeePerGas: "0",
  maxPriorityFeePerGas: "0",
};

export const managedWallet = Schema.decodeUnknownSync(WalletResponse)({
  id: "01950000-0000-7000-8000-000000000001",
  organizationId: "01950000-0000-7000-8000-000000000002",
  namespace: "eip155",
  implementation: "alchemy-modular-v2",
  address,
  metadata: { version: 1, name: "Review account" },
  status: "active",
  owner: {
    signingKeyId: "01950000-0000-7000-8000-000000000003",
    custody: "namera-managed",
    provider: "1claw",
    algorithm: "secp256k1",
  },
  data: {
    version: 1,
    modularAccountVersion: "2.0.0",
    entryPointVersion: "0.7",
    validatorType: "ecdsa_secp256k1",
    accountMode: "factory",
    factoryVersion: "2.0.0",
    implementationVersion: "v1.0.0",
    salt: "0",
    ownerAddress: address,
  },
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
});

export const preparedWalletTransaction = Schema.decodeUnknownSync(PrepareWalletTransactionResponse)(
  {
    namespace: "eip155",
    operationId: "01950000-0000-7000-8000-000000000004",
    signingKeyId: managedWallet.owner.signingKeyId,
    signing: { method: "server" },
    expiresAt: new Date("2026-10-01T12:05:00Z"),
    priceQuote: null,
    prepared: {
      version: 1,
      namespace: "eip155",
      chainId: "eip155:1",
      entryPoint: entryPoint07Address,
      entryPointVersion: "0.7",
      sponsorship: "alchemy-bso",
      billing: { executionMeter: "execution.mainnet", sponsorship: null },
      userOperation: {
        sender: address,
        nonce: String(1n << 64n),
        callData: "0x12345678",
        ...gas,
        signature: "0x",
      },
      context: {
        version: 1,
        namespace: "eip155",
        chainId: "eip155:1",
        account: address,
        block: {
          number: "123",
          hash: `0x${"44".repeat(32)}`,
          timestamp: new Date("2026-10-01T12:00:00Z"),
        },
        calls: [{ to: address, value: "0", data: "0x12345678" }],
        userOperation: {
          nonce: String(1n << 64n),
          paymaster: null,
          gas: { ...gas, paymasterVerificationGasLimit: "0", paymasterPostOpGasLimit: "0" },
        },
        simulation: {
          userOperation: { source: "eth_estimateUserOperationGas", ...gas },
          calls: {
            source: "viem.simulateCalls",
            results: [{ status: "success", returnData: "0x", gasUsed: "100" }],
            assetChanges: [],
            transfers: [],
          },
        },
      },
    },
  },
);
