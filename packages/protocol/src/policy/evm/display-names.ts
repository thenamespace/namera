import type { EvmSessionKeyPolicy } from "#/model/core/session-key";

/** Shared presentation names; policy identifiers remain the wire contract. */
export const evmPolicyDisplayNames = {
  "evm.chain-allowlist": "Allowed Networks",
  "evm.time-window": "Time Limit",
  "evm.signature": "Signatures",
} as const satisfies Readonly<Record<EvmSessionKeyPolicy["type"], string>>;
