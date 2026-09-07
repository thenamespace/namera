import type { Permission } from "@alchemy/smart-accounts";
import type { EvmSessionPermission } from "@namera-ai/protocol/evm";
import { toHex } from "viem";

export const toAlchemyPermission = (permission: EvmSessionPermission): Permission => {
  switch (permission.type) {
    case "root":
      return { type: permission.type };
    case "native-token-transfer":
      return { type: permission.type, data: { allowance: toHex(permission.allowance) } };
    case "erc20-token-transfer":
      return {
        type: permission.type,
        data: {
          address: permission.address.toLowerCase() as `0x${string}`,
          allowance: toHex(permission.allowance),
        },
      };
    case "gas-limit":
      return { type: permission.type, data: { limit: toHex(permission.limit) } };
    case "contract-access":
      return {
        type: permission.type,
        data: { address: permission.address.toLowerCase() as `0x${string}` },
      };
    case "functions-on-contract":
      return {
        type: permission.type,
        data: {
          address: permission.address.toLowerCase() as `0x${string}`,
          functions: permission.functions.map(
            (selector) => selector.toLowerCase() as `0x${string}`,
          ),
        },
      };
    case "account-functions":
    case "functions-on-all-contracts":
      return {
        type: permission.type,
        data: {
          functions: permission.functions.map(
            (selector) => selector.toLowerCase() as `0x${string}`,
          ),
        },
      };
  }
};
