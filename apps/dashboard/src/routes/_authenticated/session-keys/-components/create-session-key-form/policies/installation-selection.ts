import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";

import type { CreateSessionKeyFormInput } from "../types";

type Installation = CreateSessionKeyFormInput["onchain"]["installations"][number];

/** Keep reviewed network configurations intact; new chains never inherit addresses or authority. */
export function selectInstallationNetworks(
  current: readonly Installation[],
  chainIds: readonly SupportedEvmChainId[],
  defaultExpiry: number,
): readonly Installation[] {
  return chainIds.map(
    (chainId) =>
      current.find((entry) => entry.chainId === chainId) ?? {
        chainId,
        validAfter: 0,
        validUntil: defaultExpiry,
        permissions: [],
        allowSignatures: false,
      },
  );
}
