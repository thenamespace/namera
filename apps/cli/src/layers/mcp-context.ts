import { ServiceMap } from "effect";
import type { LocalAccount } from "viem";

import type { LocalSmartAccount, SessionKeyData } from "@/dto";

export type McpContext = {
  account: LocalSmartAccount;
  sessionKeys: (SessionKeyData & {
    signer: LocalAccount;
  })[];
};

export const McpContext = ServiceMap.Service<McpContext>(
  "@namera-ai/cli/McpContext",
);
