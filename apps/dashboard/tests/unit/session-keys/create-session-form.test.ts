import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import * as chainRegistry from "@namera-ai/evm/chains";
import { afterEach, expect, it, vi } from "vitest";

import { selectInstallationNetworks } from "../../../src/routes/_authenticated/session-keys/-components/create-session-key-form/policies/installation-selection";
import { CreateSessionKeyFormSchema } from "../../../src/routes/_authenticated/session-keys/-components/create-session-key-form/schema";

const resolve = standardSchemaResolver(Schema.toStandardSchemaV1(CreateSessionKeyFormSchema));
const options = { fields: {}, shouldUseNativeValidation: false };
afterEach(() => vi.restoreAllMocks());
const request = {
  custody: "local",
  namespace: "eip155",
  walletId: "00000000-0000-7000-8000-000000000001",
  metadata: { version: 1, name: "Agent" },
  onchain: {
    installations: [
      {
        chainId: "eip155:8453",
        validAfter: 0,
        validUntil: 2_000_000_000,
        permissions: [
          { type: "contract-access", address: "0x1111111111111111111111111111111111111111" },
        ],
        allowSignatures: false,
      },
    ],
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
    "onchain.installations.message",
    "Choose networks that are not paused.",
  );
  vi.restoreAllMocks();
  const accepted = await resolve(request, undefined, options);
  expect(accepted.errors).toEqual({});
});

it.each(["local", "namera-managed"] as const)(
  "accepts %s session custody independently of the account",
  async (custody) => {
    expect((await resolve({ ...request, custody }, undefined, options)).errors).toEqual({});
  },
);

it("preserves per-chain edits and leaves new networks unconfigured", async () => {
  const first = request.onchain.installations[0];
  const next = selectInstallationNetworks([first], ["eip155:1", first.chainId], 3_000_000_000);
  expect(next[1]).toBe(first);
  expect(next[0]).toEqual({
    chainId: "eip155:1",
    validAfter: 0,
    validUntil: 3_000_000_000,
    permissions: [],
    allowSignatures: false,
  });
  expect(
    (await resolve({ ...request, onchain: { installations: next } }, undefined, options)).errors,
  ).not.toEqual({});
  expect(selectInstallationNetworks(next, [first.chainId], 4_000_000_000)).toEqual([first]);
});

it("accepts mixed signature authority but rejects rules on a disabled network", async () => {
  const first = request.onchain.installations[0];
  const installations = [
    first,
    { ...first, chainId: "eip155:1" as const, allowSignatures: true, validUntil: 3_000_000_000 },
  ];
  const signature = { type: "evm.signature", version: 1, allowedTypes: ["typed-data"] } as const;
  expect(
    (
      await resolve(
        { ...request, onchain: { installations }, policies: [signature] },
        undefined,
        options,
      )
    ).errors,
  ).toEqual({});
  const rules = [
    {
      chainId: first.chainId,
      verifyingContract: first.permissions[0].address,
      primaryTypes: ["Permit"],
    },
  ];
  expect(
    (
      await resolve(
        {
          ...request,
          onchain: { installations },
          policies: [{ ...signature, typedDataRules: rules }],
        },
        undefined,
        options,
      )
    ).errors,
  ).toHaveProperty("policies.message");
});

it("requires access with limits and keeps both signature layers consistent", async () => {
  const limitOnly = await resolve(
    {
      ...request,
      onchain: {
        installations: [
          {
            ...request.onchain.installations[0],
            permissions: [{ type: "gas-limit", limit: "100" }],
          },
        ],
      },
    },
    undefined,
    options,
  );
  expect(limitOnly.errors).toHaveProperty("onchain.installations.message");
  const signatures = [{ type: "evm.signature", version: 1, allowedTypes: ["message"] }] as const;
  await Promise.all(
    [
      { ...request, policies: signatures },
      {
        ...request,
        onchain: {
          installations: [{ ...request.onchain.installations[0], allowSignatures: true }],
        },
      },
    ].map(async (value) => {
      expect((await resolve(value, undefined, options)).errors).toHaveProperty("policies.message");
    }),
  );
  expect(
    (
      await resolve(
        {
          ...request,
          policies: signatures,
          onchain: {
            installations: [{ ...request.onchain.installations[0], allowSignatures: true }],
          },
        },
        undefined,
        options,
      )
    ).errors,
  ).toEqual({});
});
