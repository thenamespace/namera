import { Schema } from "effect";

import { EthereumAddress, SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { formatUnits, parseUnits } from "viem";

import type { EvmAddressSelection } from "@/components/evm-address-picker/types";

import type { OnchainPermissionInput } from "../catalog";

export type TokenSpendingSelection =
  | EvmAddressSelection<"erc20">
  | {
      readonly source: "custom";
      readonly value: { readonly address: EthereumAddress; readonly decimals: number };
    };

export const TokenAllowanceForm = Schema.Struct({
  address: Schema.String.pipe(Schema.decodeTo(EthereumAddress)),
  amount: Schema.String.check(
    Schema.isPattern(/^(?:0|[1-9]\d*)(?:\.\d+)?$/, {
      message: "Enter a non-negative token amount",
    }),
  ),
  decimals: Schema.String.check(
    Schema.isPattern(/^\d{1,3}$/, { message: "Enter token decimals from 0 to 255" }),
  ).pipe(
    Schema.decodeTo(
      Schema.NumberFromString.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(0),
        Schema.isLessThanOrEqualTo(255),
      ),
    ),
  ),
}).check(
  Schema.makeFilter(({ amount, decimals }) => {
    if ((amount.split(".")[1]?.length ?? 0) > decimals)
      return { path: ["amount"], issue: `Use at most ${decimals} decimal places` };
    if (parseUnits(amount, decimals) > 2n ** 256n - 1n)
      return { path: ["amount"], issue: "Amount is too large" };
    return undefined;
  }),
);

export function tokenAllowanceDefaults(permission?: OnchainPermissionInput) {
  return {
    address: permission?.type === "erc20-token-transfer" ? permission.address : "",
    amount:
      permission?.type === "erc20-token-transfer"
        ? formatUnits(BigInt(permission.allowance), 6)
        : "",
    decimals: "6",
  };
}

export function toTokenAllowancePermission(
  value: typeof TokenAllowanceForm.Type,
): OnchainPermissionInput {
  return {
    type: "erc20-token-transfer",
    address: value.address,
    allowance: parseUnits(value.amount, value.decimals).toString(),
  };
}

export const tokenSpendingForm = (chainIds: readonly SupportedEvmChainId[]) =>
  Schema.Struct({
    token: TokenAllowanceForm,
    chainId: Schema.NullOr(
      Schema.String.pipe(Schema.decodeTo(SupportedEvmChainId)).check(
        Schema.makeFilter((chainId) => chainIds.includes(chainId), {
          message: "Select a token on one of the session networks",
        }),
      ),
    ),
  });

export function tokenSelectionFields(
  selection: TokenSpendingSelection,
  initial?: OnchainPermissionInput,
) {
  const deployment = selection.source === "catalog" ? selection.deployment : selection.value;
  const decimals =
    selection.source === "catalog" ? selection.deployment.data.decimals : selection.value.decimals;
  return {
    address: deployment.address,
    chainId: selection.source === "catalog" ? selection.deployment.chainId : null,
    decimals: String(decimals),
    amount:
      initial?.type === "erc20-token-transfer" &&
      initial.address.toLowerCase() === deployment.address.toLowerCase()
        ? formatUnits(BigInt(initial.allowance), decimals)
        : "",
  };
}
