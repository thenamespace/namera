import type { EvmSessionKeyPolicy } from "#/model/core/session-key";

/** Shared presentation names; policy identifiers remain the wire contract. */
export const evmPolicyDisplayNames = {
  "evm.contract-access": "Contract Access",
  "evm.functions-on-contract": "Contract Functions",
  "evm.functions-on-all-contracts": "Functions on Any Contract",
  "evm.account-functions": "Account Functions",
  "evm.erc20-token-transfer": "Token Spend Limit",
  "evm.chain-allowlist": "Allowed Networks",
  "evm.gas-budget": "Gas Budget",
  "evm.native-spend-limit": "Native Spend Limit",
  "evm.time-window": "Time Limit",
  "evm.signature": "Signatures",
} as const satisfies Readonly<Record<EvmSessionKeyPolicy["type"], string>>;
