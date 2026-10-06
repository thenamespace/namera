import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import * as chainRegistry from "@namera-ai/evm/chains";
import { CreateSessionKeyRequest } from "@namera-ai/protocol/dto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateSessionKeyFormSchema } from "../../src/routes/_authenticated/session-keys/-components/create-session-key-form/schema";

const resolve = standardSchemaResolver(Schema.toStandardSchemaV1(CreateSessionKeyFormSchema));
const options = { fields: {}, shouldUseNativeValidation: false };
const signer = {
  custody: "local",
  algorithm: "secp256k1",
  publicKey: `0x04${"11".repeat(64)}`,
} as const;
afterEach(() => vi.restoreAllMocks());
const request = {
  namespace: "eip155",
  walletId: "00000000-0000-7000-8000-000000000001",
  metadata: { version: 1, name: "Agent" },
  onchain: {
    chains: ["eip155:8453"],
    validAfter: 0,
    validUntil: 2_000_000_000,
    permissions: [
      { type: "contract-access", address: "0x1111111111111111111111111111111111111111" },
    ],
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
      expect(() =>
        Schema.encodeUnknownSync(CreateSessionKeyRequest)({ ...result.values, signer }),
      ).not.toThrow();
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

it("rejects paused networks through the actual session creation form resolver", async () => {
  const chain = chainRegistry.chains["base-mainnet"];
  vi.spyOn(chainRegistry, "getChainDataByCaip2").mockReturnValue({
    ...chain,
    operationsEnabled: false,
  });
  const rejected = await resolve(request, undefined, options);
  expect(rejected.errors).toHaveProperty(
    "onchain.chains.message",
    "Choose networks that are not paused.",
  );
  vi.restoreAllMocks();
  const accepted = await resolve(request, undefined, options);
  expect(accepted.errors).toEqual({});
});

it("requires access with limits and keeps both signature layers consistent", async () => {
  const limitOnly = await resolve(
    {
      ...request,
      onchain: { ...request.onchain, permissions: [{ type: "gas-limit", limit: "100" }] },
    },
    undefined,
    options,
  );
  expect(limitOnly.errors).toHaveProperty("onchain.permissions.message");
  const signatures = [{ type: "evm.signature", version: 1, allowedTypes: ["message"] }] as const;
  await Promise.all(
    [
      { ...request, policies: signatures },
      { ...request, onchain: { ...request.onchain, allowSignatures: true } },
    ].map(async (value) => {
      expect((await resolve(value, undefined, options)).errors).toHaveProperty(
        "onchain.allowSignatures.message",
      );
    }),
  );
  expect(
    (
      await resolve(
        {
          ...request,
          policies: signatures,
          onchain: { ...request.onchain, allowSignatures: true },
        },
        undefined,
        options,
      )
    ).errors,
  ).toEqual({});
});
