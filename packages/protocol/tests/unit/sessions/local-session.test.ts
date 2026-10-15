import { Redacted, Schema } from "effect";

import { describe, expect, it } from "vitest";

import { LocalEvmSessionBinding, LocalSessionKeyMaterial } from "../../../src/local/index.js";

const binding = {
  walletId: "01950000-0000-7000-8000-000000000001",
  sessionKeyId: "01950000-0000-7000-8000-000000000002",
  signingKeyId: "01950000-0000-7000-8000-000000000003",
  installationId: "01950000-0000-7000-8000-000000000004",
  walletAddress: `0x${"11".repeat(20)}`,
  signerAddress: `0x${"22".repeat(20)}`,
  chainId: "eip155:11155111",
  entityId: 7,
  isGlobal: true,
  hasExecutionHooks: false,
  validAfter: "2026-09-08T12:00:00.000Z",
  validUntil: "2026-09-08T13:00:00.000Z",
};

describe("local session authority schema", () => {
  it.each([
    { name: "owner entity", change: { entityId: 0 } },
    { name: "zero-duration validity", change: { validUntil: binding.validAfter } },
    { name: "unsupported chain", change: { chainId: "eip155:137" } },
  ])("rejects $name", ({ change }) => {
    expect(() =>
      Schema.decodeUnknownSync(LocalEvmSessionBinding)({ ...binding, ...change }),
    ).toThrow();
  });

  // Shape-only fixture, never used to construct or sign an account.
  const material = {
    version: 1,
    namespace: "eip155",
    apiOrigin: "https://api.example.com",
    privateKey: `0x${"01".repeat(32)}`,
    bindings: [binding],
  };
  it.each([
    "https://api.example.com",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://[::1]:3001",
  ])("roundtrips a multi-chain export for %s without exposing the decoded key", (apiOrigin) => {
    const encoded = {
      ...material,
      apiOrigin,
      bindings: [binding, { ...binding, chainId: "eip155:1" }],
    };
    const decoded = Schema.decodeUnknownSync(LocalSessionKeyMaterial)(encoded);
    expect(Redacted.value(decoded.privateKey)).toBe(material.privateKey);
    expect(JSON.stringify(decoded)).not.toContain(material.privateKey);
    expect(Schema.encodeSync(LocalSessionKeyMaterial)(decoded)).toEqual(encoded);
  });

  it.each([
    { name: "no installations", change: { bindings: [] } },
    { name: "duplicate chains", change: { bindings: [binding, binding] } },
    { name: "origin path", change: { apiOrigin: "https://api.example.com/path" } },
    { name: "remote HTTP", change: { apiOrigin: "http://api.example.com" } },
    { name: "origin credentials", change: { apiOrigin: "https://user:password@api.example.com" } },
    { name: "origin query", change: { apiOrigin: "https://api.example.com?key=example" } },
    { name: "zero scalar", change: { privateKey: `0x${"00".repeat(32)}` } },
    {
      name: "curve order scalar",
      change: { privateKey: "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141" },
    },
  ])("rejects $name", ({ change }) => {
    expect(() =>
      Schema.decodeUnknownSync(LocalSessionKeyMaterial)({ ...material, ...change }),
    ).toThrow();
  });

  it.each([
    { field: "walletId", value: "01950000-0000-7000-8000-000000000009" },
    { field: "sessionKeyId", value: "01950000-0000-7000-8000-000000000009" },
    { field: "signingKeyId", value: "01950000-0000-7000-8000-000000000009" },
    { field: "walletAddress", value: `0x${"33".repeat(20)}` },
    { field: "signerAddress", value: `0x${"33".repeat(20)}` },
  ])("rejects a second installation with another $field", ({ field, value }) => {
    expect(() =>
      Schema.decodeUnknownSync(LocalSessionKeyMaterial)({
        ...material,
        bindings: [binding, { ...binding, chainId: "eip155:1", [field]: value }],
      }),
    ).toThrow("Installations must belong to one wallet and signing key");
  });
});
