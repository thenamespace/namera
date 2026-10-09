import { Schema } from "effect";

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
    { ...binding, entityId: 0 },
    { ...binding, validUntil: binding.validAfter },
    { ...binding, chainId: "eip155:137" },
  ])("rejects invalid or unsupported local authority", (value) => {
    expect(() => Schema.decodeUnknownSync(LocalEvmSessionBinding)(value)).toThrow();
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
    { ...material, bindings: [binding, binding] },
    {
      ...material,
      bindings: [
        binding,
        { ...binding, chainId: "eip155:1", walletId: "01950000-0000-7000-8000-000000000009" },
      ],
    },
    { ...material, apiOrigin: "https://api.example.com/path" },
    { ...material, apiOrigin: "http://api.example.com" },
    { ...material, privateKey: `0x${"00".repeat(32)}` },
  ])("rejects inconsistent exports or unsafe origins", (value) => {
    expect(() => Schema.decodeUnknownSync(LocalSessionKeyMaterial)(value)).toThrow();
  });
});
