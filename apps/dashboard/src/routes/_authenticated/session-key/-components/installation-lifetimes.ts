import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";

type InstallationLifetime = {
  readonly chainId: SupportedEvmChainId;
  readonly authorization: { readonly validAfter: number; readonly validUntil: number };
};

export function groupInstallationLifetimes(installations: readonly InstallationLifetime[]) {
  const groups = new Map<
    string,
    { validAfter: number; validUntil: number; chainIds: SupportedEvmChainId[] }
  >();
  for (const {
    chainId,
    authorization: { validAfter, validUntil },
  } of installations) {
    const key = `${validAfter}:${validUntil}`;
    const existing = groups.get(key);
    if (existing) {
      if (!existing.chainIds.includes(chainId)) existing.chainIds.push(chainId);
    } else {
      groups.set(key, { validAfter, validUntil, chainIds: [chainId] });
    }
  }
  return groups;
}
