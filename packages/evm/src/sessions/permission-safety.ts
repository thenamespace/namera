import {
  AllowlistModule,
  DefaultModuleAddress,
  NativeTokenLimitModule,
  PaymasterGuardModule,
  TimeRangeModule,
  EXECUTE_USER_OP_SELECTOR,
} from "@alchemy/smart-accounts";
import type { EvmSessionPermissions } from "@namera-ai/protocol/evm";
import { toFunctionSelector, type Address } from "viem";

import { webAuthnValidationModuleAddress } from "../accounts/alchemy-modular-v2.js";

const controlAddresses = new Set(
  [...Object.values(DefaultModuleAddress), webAuthnValidationModuleAddress].map((address) =>
    address.toLowerCase(),
  ),
);

const controlSelectors = new Set([
  ...[
    ...AllowlistModule.abi,
    ...NativeTokenLimitModule.abi,
    ...PaymasterGuardModule.abi,
    ...TimeRangeModule.abi,
  ]
    .filter(
      (entry) =>
        entry.type === "function" &&
        entry.stateMutability !== "view" &&
        entry.stateMutability !== "pure",
    )
    .map((entry) => toFunctionSelector(entry)),
  toFunctionSelector("transferSigner(uint32,address)"),
  toFunctionSelector("transferSigner(uint32,uint256,uint256)"),
  EXECUTE_USER_OP_SELECTOR.toLowerCase(),
]);

/** A restricted key must not be able to edit the module state enforcing its restrictions. */
export const assertSafeSessionPermissions = (
  accountAddress: Address,
  permissions: EvmSessionPermissions,
): void => {
  for (const permission of permissions) {
    if ("address" in permission) {
      const target = permission.address.toLowerCase();
      if (target === accountAddress.toLowerCase() || controlAddresses.has(target))
        throw new Error(
          "Session target cannot be the account or an account-control module; use explicit root authority instead",
        );
    }
    if (
      (permission.type === "functions-on-all-contracts" ||
        permission.type === "account-functions") &&
      permission.functions.some((selector) => controlSelectors.has(selector.toLowerCase()))
    )
      throw new Error("Session wildcard selectors cannot modify account-control modules");
  }
};
