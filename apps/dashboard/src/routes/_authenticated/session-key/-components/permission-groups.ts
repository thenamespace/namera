import { Schema } from "effect";

import { EvmSessionPermission, type SupportedEvmChainId } from "@namera-ai/protocol/evm";

import type { OnchainPermissionInput } from "@/components/policy/evm/onchain/catalog";

type InstallationPermissions = {
  readonly chainId: SupportedEvmChainId;
  readonly authorization: { readonly permissions: readonly EvmSessionPermission[] };
};

export function groupInstallationPermissions(installations: readonly InstallationPermissions[]) {
  const groups = new Map<
    string,
    { permission: OnchainPermissionInput; chainIds: SupportedEvmChainId[] }
  >();
  for (const installation of installations) {
    for (const permission of installation.authorization.permissions) {
      const encoded = Schema.encodeSync(EvmSessionPermission)(permission);
      const key = JSON.stringify(encoded);
      const existing = groups.get(key);
      if (existing) {
        if (!existing.chainIds.includes(installation.chainId))
          existing.chainIds.push(installation.chainId);
      } else {
        groups.set(key, { permission: encoded, chainIds: [installation.chainId] });
      }
    }
  }
  return groups;
}
