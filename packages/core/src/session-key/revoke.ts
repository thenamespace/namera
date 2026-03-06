import type { PermissionPlugin } from "@zerodev/permissions";
import type { KernelAccountClient } from "@zerodev/sdk";
import type { Chain, Client, Hex, RpcSchema, Transport } from "viem";
import type { SmartAccount } from "viem/account-abstraction";

export type RevokeSessionKeyParams = {
  permissionPlugin: PermissionPlugin;
};

export const revokeSessionKey = async <
  TClientTransport extends Transport = Transport,
  TChain extends Chain = Chain,
  TRpcSchema extends RpcSchema | undefined = undefined,
>(
  client: KernelAccountClient<
    TClientTransport,
    TChain,
    SmartAccount,
    Client,
    TRpcSchema
  >,
  params: RevokeSessionKeyParams,
): Promise<Hex> => {
  const { permissionPlugin } = params;

  const txHash = await client.uninstallPlugin({
    plugin: permissionPlugin,
  });

  return txHash;
};
