import { Schema } from "effect";

import { EvmSessionPermission } from "@namera-ai/protocol/evm";

export type OnchainPermissionInput = typeof EvmSessionPermission.Encoded;
export type OnchainPermissionType = OnchainPermissionInput["type"];

export const onchainPermissionCatalog = {
  "contract-access": {
    name: "Contract access",
    description: "Call any function on one contract. Add a spend limit to restrict native value.",
    initial: { type: "contract-access", address: "0x" },
  },
  "functions-on-contract": {
    name: "Contract functions",
    description: "Call only the selected function selectors on one contract.",
    initial: { type: "functions-on-contract", address: "0x", functions: [] },
  },
  "functions-on-all-contracts": {
    name: "Functions on any contract",
    description: "Allow these selectors on any target. This is broader than choosing one contract.",
    initial: { type: "functions-on-all-contracts", functions: [] },
  },
  "account-functions": {
    name: "Account functions",
    description: "Allow selected non-management functions on the account itself.",
    initial: { type: "account-functions", functions: [] },
  },
  "native-token-transfer": {
    name: "Native spend limit",
    description:
      "Cap cumulative native value per network. Pair this with a target or function grant.",
    initial: { type: "native-token-transfer", allowance: "0" },
  },
  "erc20-token-transfer": {
    name: "Token spend limit",
    description:
      "Allow transfers and approvals for one ERC-20 token, within a cumulative allowance.",
    initial: { type: "erc20-token-transfer", address: "0x", allowance: "0" },
  },
  "gas-limit": {
    name: "Gas budget",
    description:
      "Cap cumulative native-token gas expenditure per network, not transaction count or USD.",
    initial: { type: "gas-limit", limit: "0" },
  },
  root: {
    name: "Unrestricted account access",
    description: "Grant full account authority. This cannot be combined with other permissions.",
    initial: { type: "root" },
  },
} satisfies Record<
  OnchainPermissionType,
  { name: string; description: string; initial: OnchainPermissionInput }
>;

export const OnchainPermissionForm = Schema.Struct({
  permission: EvmSessionPermission,
  acknowledgeRoot: Schema.Boolean,
}).check(
  Schema.makeFilter(({ permission, acknowledgeRoot }) =>
    permission.type !== "root" || acknowledgeRoot
      ? undefined
      : {
          path: ["acknowledgeRoot"],
          issue: "Acknowledge unrestricted account authority before continuing.",
        },
  ),
);
