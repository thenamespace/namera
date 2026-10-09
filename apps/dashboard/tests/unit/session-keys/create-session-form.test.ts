import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import * as chainRegistry from "@namera-ai/evm/chains";
import { afterEach, expect, it, vi } from "vitest";

import { CreateSessionKeyFormSchema } from "../../../src/routes/_authenticated/session-keys/-components/create-session-key-form/schema";

const resolve = standardSchemaResolver(Schema.toStandardSchemaV1(CreateSessionKeyFormSchema));
const options = { fields: {}, shouldUseNativeValidation: false };
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
