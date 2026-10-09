import { Redacted, Schema } from "effect";

import { describe, expect, it } from "vitest";

import { CreateWalletOwnerRequest, WalletOwnerResponse } from "../../../src/dto/wallet/index.js";
import {
  CredentialInsert,
  CreateWalletKeyInput,
  CreatedWalletKey,
  DestroyWalletKeyInput,
  DisableWalletKeyInput,
  OneClawAgentCredentialPayload,
  SigningKey,
  SigningKeyInsert,
  SignWalletKeyHashInput,
  SignWalletKeyMessageInput,
} from "../../../src/model/index.js";

const id = "01950000-0000-7000-8000-000000000001";
const organizationId = "01950000-0000-7000-8000-000000000002";
const credentialId = "01950000-0000-7000-8000-000000000003";
const data = {
  version: 1,
  type: "1claw",
  agentId: "test-agent",
  providerKeyId: "test-provider-key",
  chain: "ethereum",
  keyVersion: 1,
};
const signer = {
  id,
  organizationId,
  credentialId,
  purpose: "wallet-root",
  custody: "namera-managed",
  algorithm: "secp256k1",
  publicKeyHex: `0x04${"11".repeat(64)}`,
  status: "active",
  data,
};

describe("1Claw signing key contracts", () => {
  it.each([
    ["ethereum", "secp256k1"],
    ["bitcoin", "secp256k1"],
    ["tron", "secp256k1"],
    ["solana", "ed25519"],
    ["xrp", "ed25519"],
    ["cardano", "ed25519"],
  ])("describes %s with its matching %s algorithm", (chain, algorithm) => {
    const value = { ...signer, algorithm, data: { ...data, chain } };
    expect(Schema.decodeUnknownSync(SigningKeyInsert)(value)).toEqual(value);
    expect(() =>
      Schema.decodeUnknownSync(SigningKey)({
        ...value,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      }),
    ).not.toThrow();
  });

  it.each([
    { ...signer, algorithm: "p256" },
    { ...signer, algorithm: "ed25519" },
    { ...signer, data: { ...data, chain: "solana" } },
    { ...signer, data: { ...data, chain: "midnight" } },
    { ...signer, custody: "local" },
    { ...signer, credentialId: undefined },
    { ...signer, credentialId: null },
    { ...signer, data: { ...data, keyVersion: 0 } },
    { ...signer, data: { ...data, keyVersion: 1.5 } },
    { ...signer, data: { ...data, providerKeyId: "" } },
    { ...signer, data: { ...data, agentId: "" } },
    { ...signer, data: { ...data, version: 2 } },
  ])("rejects an inconsistent signer", (value) => {
    expect(() => Schema.decodeUnknownSync(SigningKeyInsert)(value)).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(SigningKey)({
        ...value,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      }),
    ).toThrow();
  });

  it("preserves existing local/passkey and managed-provider records without a credential reference", () => {
    const { credentialId: _, ...base } = signer;
    for (const variant of [
      { custody: "local", algorithm: "secp256k1", data: { version: 1, type: "local-key" } },
      {
        custody: "local",
        algorithm: "p256",
        data: {
          version: 1,
          type: "passkey",
          credentialId: "webauthn-id",
          rpId: "example.com",
          transports: [],
          signCount: 0,
        },
      },
      {
        custody: "namera-managed",
        algorithm: "p256",
        data: {
          version: 1,
          type: "local-provider",
          protectionLevel: "software",
          fileName: "test.json",
        },
      },
      {
        custody: "namera-managed",
        algorithm: "p256",
        data: {
          version: 1,
          type: "gcp-kms",
          protectionLevel: "hsm",
          providerAlgorithm: "EC_SIGN_P256_SHA256",
          keyVersionName: "test-key-version",
        },
      },
    ]) {
      expect(() =>
        Schema.decodeUnknownSync(SigningKeyInsert)({ ...base, ...variant }),
      ).not.toThrow();
      expect(() =>
        Schema.decodeUnknownSync(SigningKeyInsert)({ ...base, ...variant, credentialId }),
      ).toThrow();
    }
  });

  it("limits new provider operations to Ethereum digest signing, not destruction or message signing", () => {
    const input = { provider: "1claw", organizationId, credentialId, algorithm: "secp256k1", data };
    expect(() =>
      Schema.decodeUnknownSync(SignWalletKeyHashInput)({ ...input, hash: new Uint8Array(32) }),
    ).not.toThrow();
    expect(() =>
      Schema.decodeUnknownSync(SignWalletKeyHashInput)({ ...input, hash: new Uint8Array(31) }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(SignWalletKeyHashInput)({
        ...input,
        data: { ...data, chain: "bitcoin" },
        hash: new Uint8Array(32),
      }),
    ).toThrow();
    expect(() => Schema.decodeUnknownSync(DisableWalletKeyInput)(input)).not.toThrow();
    expect(() => Schema.decodeUnknownSync(DestroyWalletKeyInput)(input)).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(SignWalletKeyMessageInput)({
        ...input,
        message: new Uint8Array(32),
      }),
    ).toThrow();
  });

  it("does not invent an HSM guarantee or weaken existing creation constraints", () => {
    const input = {
      id,
      organizationId,
      credentialId,
      provider: "1claw",
      algorithm: "secp256k1",
      chain: "ethereum",
    };
    expect(Schema.decodeUnknownSync(CreateWalletKeyInput)(input)).toEqual(input);
    for (const invalid of [
      { ...input, protectionLevel: "hsm" },
      { ...input, chain: "bitcoin" },
      { ...input, algorithm: "p256" },
      { ...input, credentialId: undefined },
      { id, algorithm: "secp256k1", protectionLevel: "software" },
    ])
      expect(() => Schema.decodeUnknownSync(CreateWalletKeyInput)(invalid)).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(CreateWalletKeyInput)({
        id,
        algorithm: "secp256k1",
        protectionLevel: "hsm",
      }),
    ).not.toThrow();
  });

  it("rejects a created key paired with another agent's credential", () => {
    const result = {
      provider: "1claw",
      algorithm: "secp256k1",
      publicKeyHex: signer.publicKeyHex,
      data,
      credential: {
        version: 1,
        credentialId,
        organizationId,
        agentId: data.agentId,
        apiKey: "synthetic-test-token",
      },
    };
    expect(() => Schema.decodeUnknownSync(CreatedWalletKey)(result)).not.toThrow();
    expect(() =>
      Schema.decodeUnknownSync(CreatedWalletKey)({
        ...result,
        credential: { ...result.credential, agentId: "different-agent" },
      }),
    ).toThrow();
  });
});

describe("credentials and public ownership", () => {
  it("requires typed metadata and keeps decrypted API keys redacted in memory", () => {
    const payload = {
      version: 1,
      credentialId,
      organizationId,
      agentId: "test-agent",
      apiKey: "synthetic-test-token",
    };
    const decoded = Schema.decodeUnknownSync(OneClawAgentCredentialPayload)(payload);
    expect(Redacted.value(decoded.apiKey)).toBe(payload.apiKey);
    expect(JSON.stringify(decoded)).not.toContain(payload.apiKey);
    const row = {
      id: credentialId,
      organizationId,
      type: "1claw-agent",
      data: { version: 1, agentId: "test-agent" },
      encryptedPayload: "test-ciphertext",
    };
    expect(Schema.decodeUnknownSync(CredentialInsert)(row)).toEqual(row);
    for (const invalid of [
      { ...row, type: "arbitrary" },
      { ...row, data: {} },
      { ...row, encryptedPayload: "" },
    ]) {
      expect(() => Schema.decodeUnknownSync(CredentialInsert)(invalid)).toThrow();
    }
    for (const invalid of [
      { ...payload, organizationId: undefined },
      { ...payload, credentialId: undefined },
      { ...payload, apiKey: "" },
    ]) {
      expect(() => Schema.decodeUnknownSync(OneClawAgentCredentialPayload)(invalid)).toThrow();
    }
  });

  it("adds explicit 1Claw ownership without accepting conflicting protection claims", () => {
    const owner = { type: "namera-managed", provider: "1claw" };
    expect(Schema.decodeUnknownSync(CreateWalletOwnerRequest)(owner)).toEqual(owner);
    expect(() =>
      Schema.decodeUnknownSync(CreateWalletOwnerRequest)({ ...owner, protectionLevel: "hsm" }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(CreateWalletOwnerRequest)({
        ...owner,
        provider: "unknown",
        protectionLevel: "hsm",
      }),
    ).toThrow();
    expect(
      Schema.decodeUnknownSync(CreateWalletOwnerRequest)({
        type: "namera-managed",
        protectionLevel: "software",
      }),
    ).toEqual({ type: "namera-managed", protectionLevel: "software" });
  });

  it("strips credentials and provider locators from the public ownership response", () => {
    const owner = {
      signingKeyId: id,
      custody: "namera-managed",
      provider: "1claw",
      algorithm: "secp256k1",
    };
    const decoded = Schema.decodeUnknownSync(WalletOwnerResponse)({
      ...owner,
      credentialId,
      data,
      apiKey: "synthetic-test-token",
      encryptedPayload: "test-ciphertext",
    });
    expect(Schema.encodeSync(WalletOwnerResponse)(decoded)).toEqual(owner);
    expect(() =>
      Schema.decodeUnknownSync(WalletOwnerResponse)({ ...owner, algorithm: "ed25519" }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(WalletOwnerResponse)({ ...owner, protectionLevel: "hsm" }),
    ).toThrow();
  });
});
