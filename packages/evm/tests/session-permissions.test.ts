import { Schema } from "effect";

import { DefaultModuleAddress } from "@alchemy/smart-accounts";
import { EvmSessionAuthorization, EvmSessionPermissions } from "@namera-ai/protocol/evm";
import { toFunctionSelector } from "viem";
import { describe, expect, it } from "vitest";

import { assertSafeSessionPermissions } from "../src/sessions/permission-safety.js";
import { toAlchemyPermission } from "../src/sessions/permissions.js";

const address = "0x000000000000000000000000000000000000aBcD";
const decode = Schema.decodeUnknownSync(EvmSessionPermissions);

describe("onchain session permission contracts", () => {
  it("prevents restricted sessions from rewriting module-owned permissions", () => {
    expect(() =>
      assertSafeSessionPermissions(
        address,
        decode([{ type: "contract-access", address: address.toLowerCase() }]),
      ),
    ).toThrow();
    expect(() =>
      assertSafeSessionPermissions(
        address,
        decode([{ type: "contract-access", address: DefaultModuleAddress.TIME_RANGE }]),
      ),
    ).toThrow();
    expect(() =>
      assertSafeSessionPermissions(
        address,
        decode([
          {
            type: "functions-on-all-contracts",
            functions: [toFunctionSelector("setTimeRange(uint32,uint48,uint48)")],
          },
        ]),
      ),
    ).toThrow();
    expect(() =>
      assertSafeSessionPermissions(
        address,
        decode([
          {
            type: "functions-on-all-contracts",
            functions: [toFunctionSelector("transfer(address,uint256)")],
          },
        ]),
      ),
    ).not.toThrow();
    expect(() => assertSafeSessionPermissions(address, decode([{ type: "root" }]))).not.toThrow();
  });
  it("translates every supported Alchemy permission without losing integer precision", () => {
    const permissions = [
      { type: "native-token-transfer", allowance: "1000000000000000001" },
      { type: "erc20-token-transfer", address, allowance: "20" },
      { type: "gas-limit", limit: "30" },
      { type: "contract-access", address },
      { type: "account-functions", functions: ["0xAABBCCDD"] },
      { type: "functions-on-all-contracts", functions: ["0xAABBCCDD"] },
      { type: "functions-on-contract", address, functions: ["0xAABBCCDD"] },
      { type: "root" },
    ];
    expect(
      permissions.map((permission) => decode([permission]).map(toAlchemyPermission)[0]),
    ).toEqual([
      { type: "native-token-transfer", data: { allowance: "0xde0b6b3a7640001" } },
      { type: "erc20-token-transfer", data: { address: address.toLowerCase(), allowance: "0x14" } },
      { type: "gas-limit", data: { limit: "0x1e" } },
      { type: "contract-access", data: { address: address.toLowerCase() } },
      { type: "account-functions", data: { functions: ["0xaabbccdd"] } },
      { type: "functions-on-all-contracts", data: { functions: ["0xaabbccdd"] } },
      {
        type: "functions-on-contract",
        data: { address: address.toLowerCase(), functions: ["0xaabbccdd"] },
      },
      { type: "root" },
    ]);
  });

  const invalidPermissions = [
    [],
    [{ type: "root" }, { type: "gas-limit", limit: "1" }],
    [
      { type: "gas-limit", limit: "1" },
      { type: "gas-limit", limit: "2" },
    ],
    [
      { type: "contract-access", address },
      { type: "functions-on-contract", address: address.toLowerCase(), functions: ["0xaabbccdd"] },
    ],
    [
      { type: "contract-access", address },
      { type: "erc20-token-transfer", address, allowance: "1" },
    ],
    [{ type: "native-token-transfer", allowance: "-1" }],
    [{ type: "native-token-transfer", allowance: (2n ** 256n).toString() }],
    [{ type: "functions-on-all-contracts", functions: [] }],
    [{ type: "functions-on-all-contracts", functions: ["0xaabb"] }],
  ];
  it.each(invalidPermissions.map((permissions) => ({ permissions })))(
    "rejects ambiguous or malformed permissions: $permissions",
    ({ permissions }) => {
      expect(() => decode(permissions)).toThrow();
    },
  );

  it("reserves root and hook entity IDs and requires a finite expiry", () => {
    const authorization = {
      version: 1,
      entityId: 1,
      signerAddress: address,
      validAfter: 100,
      validUntil: 200,
      permissions: [{ type: "root" }],
    };
    const parse = Schema.decodeUnknownSync(EvmSessionAuthorization);
    expect(parse(authorization).entityId).toBe(1);
    for (const entityId of [0, -1, 2_147_483_647, 1.2])
      expect(() => parse({ ...authorization, entityId })).toThrow();
    expect(() => parse({ ...authorization, validUntil: 0 })).toThrow();
    expect(() => parse({ ...authorization, validUntil: 100 })).toThrow();
  });
});
