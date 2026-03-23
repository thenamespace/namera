import { isPluginInstalled } from "@zerodev/sdk/actions";
import { PLUGIN_TYPE } from "@zerodev/sdk/constants";
import type { Address, Client, Hex } from "viem";

export type IsSessionKeyInstalledParams = {
  accountAddress: Address;
  sessionKeyAddress: Address;
  data?: Hex;
};

export const isSessionKeyInstalled = async (
  client: Client,
  params: IsSessionKeyInstalledParams,
): Promise<boolean> => {
  return await isPluginInstalled(client, {
    address: params.accountAddress,
    plugin: {
      address: params.sessionKeyAddress,
      data: params.data,
      type: PLUGIN_TYPE.VALIDATOR,
    },
  });
};
