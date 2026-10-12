import { Schema } from "effect";

import { describe, expect, it } from "vitest";

import {
  CreateSessionKeyRequest,
  EvmSessionSignerResponse,
} from "../../../src/dto/session-key/index.js";
import { SigningKeyInsert } from "../../../src/model/index.js";

const publicKey = `0x04${"11".repeat(64)}`;
const managed = { custody: "namera-managed", provider: "1claw", algorithm: "secp256k1" };
const request = {
  namespace: "eip155",
  walletId: "01950000-0000-7000-8000-000000000001",
  metadata: { version: 1, name: "Session" },
  signer: managed,
  onchain: {
    installations: [
      {
        chainId: "eip155:11155111",
        validAfter: 0,
        validUntil: 2_000_000_000,
        permissions: [{ type: "root" }],
      },
    ] as const,
  },
  policies: [],
};

describe("managed session contracts", () => {
  it("preserves independent network permissions, lifetimes and signature flags", () => {
    const first = request.onchain.installations[0];
    const input = {
      ...request,
      onchain: {
        installations: [
          first,
          {
            chainId: "eip155:1",
            validAfter: 100,
            validUntil: 3_000_000_000,
            allowSignatures: true,
            permissions: [
              { type: "erc20-token-transfer", address: `0x${"12".repeat(20)}`, allowance: "100" },
            ],
          },
        ],
      },
    };
    expect(
      Schema.encodeSync(CreateSessionKeyRequest)(
        Schema.decodeUnknownSync(CreateSessionKeyRequest)(input),
      ),
    ).toEqual(input);
  });

  it("rejects missing, duplicate, expired-order and ambiguous shared installations", () => {
    const first = request.onchain.installations[0];
    for (const onchain of [
      { chains: [first.chainId], ...first },
      { installations: [] },
      { installations: [first, first] },
      { installations: [{ ...first, validAfter: first.validUntil }] },
      ...Array.from(
        ["chains", "permissions", "validAfter", "validUntil", "allowSignatures"],
        (key) => ({ ...request.onchain, [key]: key === "allowSignatures" ? false : 0 }),
      ),
    ]) {
      expect(() =>
        Schema.decodeUnknownSync(CreateSessionKeyRequest)({ ...request, onchain }),
      ).toThrow();
    }
  });

  it("round trips managed requests without caller-owned key material and preserves local requests", () => {
    for (const signer of [managed, { custody: "local", algorithm: "secp256k1", publicKey }]) {
      const input = { ...request, signer };
      const decoded = Schema.decodeUnknownSync(CreateSessionKeyRequest)(input);
      expect(Schema.encodeSync(CreateSessionKeyRequest)(decoded)).toEqual(input);
    }
  });

  it.each([
    { ...managed, provider: "gcp" },
    { ...managed, algorithm: "ed25519" },
    { ...managed, publicKey },
    { ...managed, privateKey: "not-accepted" },
    { ...managed, agentId: "caller-agent" },
    { ...managed, credentialId: "caller-credential" },
    { ...managed, providerConnectionId: "caller-connection" },
  ])("rejects unsupported or caller-selected provider material", (signer) => {
    expect(() =>
      Schema.decodeUnknownSync(CreateSessionKeyRequest)({ ...request, signer }),
    ).toThrow();
  });

  it("encodes only public signer fields", () => {
    const decoded = Schema.decodeUnknownSync(EvmSessionSignerResponse)({
      ...managed,
      publicKey,
      credentialId: "secret-ref",
      encryptedPayload: "secret",
      agentId: "internal",
    });
    expect(Schema.encodeSync(EvmSessionSignerResponse)(decoded)).toEqual({ ...managed, publicKey });
  });

  it("requires a connection for new managed session signers without breaking legacy root inserts", () => {
    const key = {
      id: "01950000-0000-7000-8000-000000000002",
      organizationId: "01950000-0000-7000-8000-000000000003",
      credentialId: "01950000-0000-7000-8000-000000000004",
      purpose: "session",
      custody: "namera-managed",
      algorithm: "secp256k1",
      status: "active",
      publicKeyHex: publicKey,
      data: {
        version: 1,
        type: "1claw",
        chain: "ethereum",
        agentId: "agent",
        providerKeyId: "key",
        keyVersion: 1,
      },
    };
    expect(() => Schema.decodeUnknownSync(SigningKeyInsert)(key)).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(SigningKeyInsert)({ ...key, purpose: "wallet-root" }),
    ).not.toThrow();
    expect(() =>
      Schema.decodeUnknownSync(SigningKeyInsert)({
        ...key,
        providerConnectionId: "01950000-0000-7000-8000-000000000005",
      }),
    ).not.toThrow();
  });
});
