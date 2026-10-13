import { Effect } from "effect";

import { EthereumAddress, IdentityPrimaryError, type EvmIntentCall } from "@namera-ai/protocol";

import type { ChainData } from "../chains/data.js";
import { getChainDataByChainId } from "../chains/helpers.js";
import type { ExecutionClients } from "../clients/execution.js";
import { primaryNameCall } from "./call.js";

export type PrimaryNameStatus = {
  readonly primaryName: string | null;
  readonly forwardAddress: string | null;
  readonly verified: boolean;
};
export interface EvmIdentityService {
  readonly status: (
    name: string,
    address: EthereumAddress,
  ) => Effect.Effect<PrimaryNameStatus, IdentityPrimaryError>;
  readonly call: (name: string) => Effect.Effect<EvmIntentCall, IdentityPrimaryError>;
}

export const makeEvmIdentityService = (
  getClients: (chain: ChainData) => Pick<ExecutionClients, "publicClient">,
): EvmIdentityService => {
  const chain = getChainDataByChainId(1);
  if (!chain) throw new Error("Ethereum is required for ENS identity");
  const { publicClient } = getClients(chain);
  return {
    status: (name, address) =>
      Effect.tryPromise({
        try: async () => {
          const [primaryName, forwardAddress] = await Promise.all([
            publicClient.getEnsName({ address, coinType: 60n }),
            publicClient.getEnsAddress({ name, coinType: 60n }),
          ]);
          return {
            primaryName,
            forwardAddress,
            verified:
              primaryName === name && forwardAddress?.toLowerCase() === address.toLowerCase(),
          };
        },
        catch: () => new IdentityPrimaryError({ code: "PREPARATION_FAILED" }),
      }),
    call: (name) =>
      Effect.tryPromise({
        try: async () => {
          const call = await primaryNameCall(publicClient, name);
          return { ...call, to: EthereumAddress.make(call.to) };
        },
        catch: () => new IdentityPrimaryError({ code: "PREPARATION_FAILED" }),
      }),
  };
};
