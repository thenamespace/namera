import type { EvmPolicyInput } from "@/components/policy/evm";
import type { OnchainPermissionInput } from "@/components/policy/evm/onchain/catalog";

// These variants have identical editable fields. Other policies deliberately
// keep separate drafts because their units, periods or signing rules differ.
export function toSharedPermission(policy: EvmPolicyInput): OnchainPermissionInput | undefined {
  switch (policy.type) {
    case "evm.contract-access":
      return { type: "contract-access", address: policy.address };
    case "evm.functions-on-contract":
      return {
        type: "functions-on-contract",
        address: policy.address,
        functions: policy.functions,
      };
    case "evm.functions-on-all-contracts":
      return { type: "functions-on-all-contracts", functions: policy.functions };
    case "evm.account-functions":
      return { type: "account-functions", functions: policy.functions };
    case "evm.erc20-token-transfer":
      return { type: "erc20-token-transfer", address: policy.address, allowance: policy.allowance };
    default:
      return undefined;
  }
}

export function toOffchainPermission(policy: OnchainPermissionInput): EvmPolicyInput | undefined {
  switch (policy.type) {
    case "contract-access":
      return { ...policy, type: "evm.contract-access", version: 1 };
    case "functions-on-contract":
      return { ...policy, type: "evm.functions-on-contract", version: 1 };
    case "functions-on-all-contracts":
      return { ...policy, type: "evm.functions-on-all-contracts", version: 1 };
    case "account-functions":
      return { ...policy, type: "evm.account-functions", version: 1 };
    case "erc20-token-transfer":
      return { ...policy, type: "evm.erc20-token-transfer", version: 1 };
    default:
      return undefined;
  }
}
