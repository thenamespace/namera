import { Schema } from "effect";

import { EvmSessionPermission, SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { expect, it } from "vitest";

import { groupInstallationPermissions } from "../../../src/routes/_authenticated/session-key/-components/permission-groups";

it("keeps allowance variants and their network scopes separate in policy summaries", () => {
  const token = Schema.decodeUnknownSync(EvmSessionPermission)({
    type: "erc20-token-transfer",
    address: "0x1111111111111111111111111111111111111111",
    allowance: "1000000",
  });
  const larger = Schema.decodeUnknownSync(EvmSessionPermission)({
    ...Schema.encodeSync(EvmSessionPermission)(token),
    allowance: "2000000",
  });
  const ethereum = SupportedEvmChainId.make("eip155:1");
  const base = SupportedEvmChainId.make("eip155:8453");
  const groups = [
    ...groupInstallationPermissions([
      { chainId: ethereum, authorization: { permissions: [token] } },
      { chainId: base, authorization: { permissions: [larger] } },
      { chainId: ethereum, authorization: { permissions: [token] } },
    ]).values(),
  ];
  expect(groups).toEqual([
    { permission: Schema.encodeSync(EvmSessionPermission)(token), chainIds: [ethereum] },
    { permission: Schema.encodeSync(EvmSessionPermission)(larger), chainIds: [base] },
  ]);
  const shared = [
    ...groupInstallationPermissions([
      { chainId: ethereum, authorization: { permissions: [token] } },
      { chainId: base, authorization: { permissions: [token] } },
    ]).values(),
  ];
  expect(shared).toEqual([
    { permission: Schema.encodeSync(EvmSessionPermission)(token), chainIds: [ethereum, base] },
  ]);
});
