import { Schema } from "effect";

import { WalletResponse } from "@namera-ai/protocol/dto";
import { SigningKey, Wallet } from "@namera-ai/protocol/model";
import { describe, expect, it } from "vitest";

import { toWalletResponse } from "../../src/helpers/dto/wallet.js";

const id = "01950000-0000-7000-8000-000000000001";
const timestamps = { createdAt: new Date(0), updatedAt: new Date(0) };
const wallet = Schema.decodeUnknownSync(Wallet)({
  id,
  organizationId: id,
  signingKeyId: id,
  createdByActorId: id,
  metadata: { version: 1, name: "Test managed account" },
  status: "active",
  namespace: "eip155",
  data: {
    version: 1,
    address: `0x${"11".repeat(20)}`,
    implementation: "alchemy-modular-v2",
    modularAccountVersion: "2.0.0",
    entryPointVersion: "0.7",
    validatorType: "ecdsa_secp256k1",
    accountMode: "7702",
    delegationVersion: "v1.1.0",
  },
  ...timestamps,
});
const signingKey = {
  id,
  organizationId: id,
  credentialId: "01950000-0000-7000-8000-000000000002",
  purpose: "wallet-root",
  custody: "namera-managed",
  algorithm: "secp256k1",
  publicKeyHex: `0x04${"11".repeat(64)}`,
  status: "active",
  data: {
    version: 1,
    type: "1claw",
    agentId: "test-agent",
    providerKeyId: "test-key",
    keyVersion: 1,
    chain: "ethereum",
  },
  ...timestamps,
};

describe("1Claw wallet response mapping", () => {
  it("serializes factory metadata without exposing provider credentials", () => {
    const factoryWallet = Schema.decodeUnknownSync(Wallet)({
      ...Schema.encodeSync(Wallet)(wallet),
      data: {
        ...wallet.data,
        accountMode: "factory",
        factoryVersion: "2.0.0",
        implementationVersion: "v1.0.0",
        ownerAddress: `0x${"22".repeat(20)}`,
        salt: "12345678901234567890",
      },
    });
    const response = toWalletResponse({
      wallet: factoryWallet,
      signingKey: Schema.decodeUnknownSync(SigningKey)(signingKey),
    });
    const encoded = Schema.encodeSync(WalletResponse)(response);
    expect(encoded.data).toMatchObject({
      accountMode: "factory",
      factoryVersion: "2.0.0",
      implementationVersion: "v1.0.0",
      ownerAddress: `0x${"22".repeat(20)}`,
      salt: "12345678901234567890",
    });
    expect(encoded.data).not.toHaveProperty("delegationVersion");
    expect(Schema.decodeUnknownSync(WalletResponse)(encoded)).toEqual(response);
    const serialized = JSON.stringify(encoded);
    expect(serialized).not.toContain(signingKey.credentialId);
    expect(serialized).not.toContain(signingKey.data.agentId);
    expect(serialized).not.toContain(signingKey.data.providerKeyId);
  });

  it("maps safe ownership without internal signer or credential references", () => {
    const response = toWalletResponse({
      wallet,
      signingKey: Schema.decodeUnknownSync(SigningKey)(signingKey),
    });
    expect(response.owner).toEqual({
      signingKeyId: id,
      custody: "namera-managed",
      provider: "1claw",
      algorithm: "secp256k1",
    });
    const serialized = JSON.stringify(response);
    for (const privateValue of [
      signingKey.credentialId,
      signingKey.data.agentId,
      signingKey.data.providerKeyId,
      "credentialId",
      "keyVersion",
      "publicKeyHex",
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it.each([
    ["bitcoin", "secp256k1"],
    ["solana", "ed25519"],
  ])("rejects a %s owner on an EVM wallet", (chain, algorithm) => {
    const otherKey = Schema.decodeUnknownSync(SigningKey)({
      ...signingKey,
      algorithm,
      data: { ...signingKey.data, chain },
    });
    expect(() => toWalletResponse({ wallet, signingKey: otherKey })).toThrow(
      "EVM wallet requires an Ethereum secp256k1 owner",
    );
  });
});
