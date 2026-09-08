import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { CreateSessionKeyRequest } from "@namera-ai/protocol/dto";
import { describe, expect, it } from "vitest";

import { CreateSessionKeyFormSchema } from "../../src/routes/_authenticated/session-keys/-components/create-session-key-form/schema";

const resolve = standardSchemaResolver(Schema.toStandardSchemaV1(CreateSessionKeyFormSchema));
const options = { fields: {}, shouldUseNativeValidation: false };
const request = {
  namespace: "eip155",
  walletId: "00000000-0000-7000-8000-000000000001",
  metadata: { version: 1, name: "Agent" },
  signer: { custody: "local", algorithm: "secp256k1", publicKey: `0x04${"11".repeat(64)}` },
  onchain: {
    chains: ["eip155:8453"],
    validAfter: 0,
    validUntil: 2_000_000_000,
    permissions: [{ type: "native-token-transfer", allowance: "1000" }],
    allowSignatures: false,
  },
  policies: [],
} as const;

describe("optional session description", () => {
  it.each(["", undefined])(
    "omits a blank controlled field (%s) from the API payload",
    async (description) => {
      const result = await resolve(
        { ...request, metadata: { ...request.metadata, description } },
        undefined,
        options,
      );
      expect(result.errors).toEqual({});
      expect(result.values).not.toHaveProperty("metadata.description");
      expect(() => Schema.encodeUnknownSync(CreateSessionKeyRequest)(result.values)).not.toThrow();
    },
  );

  it("preserves provided text and rejects an oversized description", async () => {
    const description = "Treasury automation";
    const accepted = await resolve(
      { ...request, metadata: { ...request.metadata, description } },
      undefined,
      options,
    );
    expect(accepted.values).toHaveProperty("metadata.description", description);
    const rejected = await resolve(
      { ...request, metadata: { ...request.metadata, description: "x".repeat(1025) } },
      undefined,
      options,
    );
    expect(rejected.errors).toHaveProperty("metadata.description.message");
  });
});
