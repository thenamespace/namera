import { Schema } from "effect";

import { SigningKey } from "@namera-ai/protocol/model";
import { describe, expect, it } from "vitest";

import { toSessionSignerResponse } from "../../src/helpers/dto/session-key.js";

const key = {
  id: "01950000-0000-7000-8000-000000000001",
  organizationId: "01950000-0000-7000-8000-000000000002",
  credentialId: "01950000-0000-7000-8000-000000000003",
  providerConnectionId: "01950000-0000-7000-8000-000000000004",
  custody: "namera-managed",
  purpose: "session",
  algorithm: "secp256k1",
  publicKeyHex: "0x04aabb",
  status: "active",
  data: {
    version: 1,
    type: "1claw",
    chain: "ethereum",
    agentId: "private-agent-reference",
    providerKeyId: "private-key-reference",
    keyVersion: 1,
  },
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe("public session signer mapping", () => {
  it("allows only safe public fields for a managed session", () => {
    expect(toSessionSignerResponse(Schema.decodeUnknownSync(SigningKey)(key))).toEqual({
      custody: "namera-managed",
      provider: "1claw",
      algorithm: "secp256k1",
      publicKey: key.publicKeyHex,
    });
  });
  it("rejects root substitution and unsupported chains", () => {
    for (const change of [
      { purpose: "wallet-root" },
      { data: { ...key.data, chain: "bitcoin" } },
    ]) {
      expect(() =>
        toSessionSignerResponse(Schema.decodeUnknownSync(SigningKey)({ ...key, ...change })),
      ).toThrow();
    }
  });
});
